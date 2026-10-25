import { createExactReactionAllocationFixture } from './sphExactReactionAllocationNative.js';
import { inspectExactCaloricSource } from './sphExactCaloricSourceInspection.js';
import { inspectExactReactionPacket } from './sphExactReactionPacketInspection.js';
// Native consumers must share the producer's actual module instances. A bare
// browser import of a Vite HMR alias would create a different private registry.
export { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection }
  from '../../src/runtime/sph/sphExactReactionSourceGpu.js';
export { runSphReactionStepWebGpu } from '../../src/runtime/sph/sphReactionGpuKernel.js';
export { resolveSphExactReactionRoutingCandidate } from '../../src/runtime/sph/sphExactReactionRoutingGpu.js';
export { selectSphExactReactionAllocation } from '../../src/runtime/sph/sphExactReactionAllocation.js';
export { selectSphExactReactionKineticCap } from '../../src/runtime/sph/sphExactReactionKineticCap.js';
export { encodeSphExactMassUnits, projectSphExactMassF32Bits } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as hierarchy from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { acquireMlsMpmMechanicsExactMassCapture } from '../../src/runtime/sph/sphG2pGpuKernel.js';
import { runSchroederSpatialReactionDiscoveryProposalWebGpu }
  from '../../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection,
  sphExactReactionSourcePipelineDescriptors }
  from '../../src/runtime/sph/sphExactReactionSourceGpu.js';
import { prewarmCachedExplicitComputePipeline } from '../../src/runtime/webgpuComputeLayout.js';
import { selectSphExactReactionAllocation } from '../../src/runtime/sph/sphExactReactionAllocation.js';
import { selectSphExactReactionKineticCap } from '../../src/runtime/sph/sphExactReactionKineticCap.js';
import { sphReactionEnergyEntry } from '../../src/runtime/sph/sphReactionEnergyAuthority.js';
import { createSphExactMassFormat, encodeSphExactMass }
  from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

const integer = words => { let value = 0n; for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i]); return value; };
// Independent integer arithmetic over the actual captured GPU input bits.
// A midpoint interval check verifies projection without a binary64 division
// followed by Math.fround (which can double-round a rational at a tie).
const f32Bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
function scalar(bits) {
  const exponent = (bits >>> 23) & 255;
  if (exponent === 255) throw new Error('Nonfinite captured extensive input');
  return { coefficient: BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0)) * (bits >>> 31 ? -1n : 1n),
    exponent: exponent ? exponent - 150 : -149 };
}
function product(mass, first, second = 0x3f800000, half = false) {
  const a = scalar(first), b = scalar(second);
  return mass * a.coefficient * b.coefficient << BigInt(a.exponent + b.exponent + 299 - Number(half));
}
function projectionMatches(numerator, denominator, bits) {
  if (!numerator) return bits === 0;
  if ((bits >>> 31) !== Number(numerator < 0n) || (bits & 0x7fffffff) >= 0x7f800000) return false;
  const magnitude = bits & 0x7fffffff, n = numerator < 0n ? -numerator : numerator;
  const at = value => product(1n, value);
  const value = at(magnitude), previous = magnitude ? at(magnitude - 1) : 0n;
  const next = magnitude === 0x7f7fffff ? value + (value - previous) : at(magnitude + 1);
  const twice = 2n * n, lower = (value + previous) * denominator, upper = (value + next) * denominator;
  const even = !(magnitude & 1);
  return (magnitude === 0 || twice > lower || (twice === lower && even))
    && (twice < upper || (twice === upper && even));
}

function inspectExtensives(words, selected, base, stateWords, entry, expected) {
  const header = words.slice(base, base + selected.headerWords), a = header[2], b = header[3];
  const va = stateWords.slice(a * 8 + 4, a * 8 + 8), vb = stateWords.slice(b * 8 + 4, b * 8 + 8);
  const masses = [expected.debitA, expected.debitB], states = [va, vb];
  const momentum = [0, 1, 2].map(axis => masses.reduce((sum, mass, i) => sum + product(mass, states[i][axis]), 0n));
  const internal = masses.reduce((sum, mass, i) => sum + product(mass, states[i][3]), 0n);
  const kinetic = masses.reduce((sum, mass, i) => sum + [0, 1, 2].reduce((k, axis) =>
    k + product(mass, states[i][axis], states[i][axis], true), 0n), 0n);
  const reference = masses.reduce((sum, mass, i) => sum + product(mass, f32Bits(entry.reactants[i].uRef)), 0n);
  const at = base + selected.extensiveOffsetWords, com = Array.from(words.slice(at, at + 3));
  const projectionsMatch = com.every((bits, axis) => projectionMatches(momentum[axis], expected.total, bits));
  const residual = momentum.map((p, axis) => p - product(expected.total, com[axis]));
  const comKinetic = com.reduce((sum, bits) => sum + product(expected.total, bits, bits, true), 0n);
  const wanted = [...momentum, internal, kinetic, reference, internal + kinetic - reference,
    ...residual, comKinetic, internal + kinetic - reference - comKinetic];
  const fields = selected.extensiveFields.map((name, index) => {
    const start = at + 4 + index * (selected.extensiveWordCount + 2);
    const sign = words[start], error = words[start + 1];
    const magnitude = integer(words.slice(start + 2, start + 2 + selected.extensiveWordCount));
    const value = magnitude * (sign ? -1n : 1n);
    return { name, value: String(value), expected: String(wanted[index]), error,
      matches: value === wanted[index] && error === 0 && sign <= 1 && (magnitude !== 0n || sign === 0) };
  });
  return { comBits: com, referenceBits: entry.reactants.map(term => f32Bits(term.uRef)),
    projectionError: words[at + 3], projectionsMatch, fields,
    nonzeroMomentumResidual: residual.some(value => value !== 0n),
    matches: header[9] === 1 && header[10] === 0 && header[11] === 0
      && words[at + 3] === 0 && projectionsMatch && fields.every(field => field.matches) };
}
async function readWords(device, source) {
  const copy = device.createBuffer({ size: source.size, usage: 1 | 8 });
  try {
    const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(source, 0, copy, 0, copy.size);
    device.queue.submit([encoder.finish()]); await copy.mapAsync(1);
    const words = new Uint32Array(copy.getMappedRange()).slice(); copy.unmap(); return words;
  } finally { copy.destroy(); }
}

/** Runs inside a genuine canonical mechanics stage before that epoch retires.
 * The stage wrapper returns its original result unchanged. This fixture does
 * not register public buffers as producers or inject a fake proposal. */
export async function runExactReactionSourceNative(device, { reverse = false, dtSeconds = .000001,
  wordCount = 9, velocities = [[0, 0, 0], [0, 0, 0]], fixtureOptions = {},
  massesKg = [.006 + 2 ** -35, .064 + 2 ** -33], quantumExponent = wordCount === 66 ? -1074 : -149,
  internalPressureScale = 1, expectedCaloricError = 0, inspect = null, prewarm = false, onProgress = null } = {}) {
  const progress = (stage, extra = {}) => onProgress?.({ stage, wordCount, dtSeconds, reverse, timeMs: performance.now(), ...extra });
  const fixture = createExactReactionAllocationFixture(fixtureOptions);
  const { materialProperties, models, thermalMaterialTable, reactionTable } = fixture;
  const format = createSphExactMassFormat({ wordCount, quantumExponent });
  if (prewarm) {
    for (const descriptor of sphExactReactionSourcePipelineDescriptors(format)) {
      progress('prewarm-start', { entryPoint: descriptor.entryPoint });
      const warmed = await prewarmCachedExplicitComputePipeline(device, descriptor);
      if (!warmed.pipeline) throw new Error(`Exact source prewarm failed: ${descriptor.entryPoint}: ${warmed.error ?? warmed.reason ?? warmed.status}`);
      progress('prewarm-complete', { entryPoint: descriptor.entryPoint });
    }
  }
  const particles = ['h2', 'o2'].map((material, index) => ({ material,
    id: `source-${material}`, x: [1 + index * .02, 1, 1], v: velocities[index],
    massKg: massesKg[index],
    specificInternalEnergyJPerKg: models[material].liquidReferenceInternalEnergyJPerKg,
    phaseCaloric: { phaseId: 2, phaseFractions: [0, 1, 0, 0] } }));
  if (reverse) particles.reverse();
  const initial = { smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1, particles };
  const packOptions = { materialProperties, condensableThermodynamicsByMaterial: models,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 };
  const sphParticleState = buffers.buildSphGpuParticleBuffers(initial, { ...packOptions,
    exactMass: { format, reference: 'manufactured real canonical exact reaction sources' } });
  const mlsMpmParticleState = buffers.buildMlsMpmGpuParticleBuffers(initial, packOptions);
  const sphParticleUpload = buffers.uploadSphGpuParticleBuffers(device, sphParticleState);
  const mlsMpmParticleUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, mlsMpmParticleState);
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(materialProperties, packOptions);
  let execution, observed, failure, visits = 0;
  try {
    const runOptions = {
      device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
      selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
      dt: dtSeconds, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
      enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
      enableLawQueue: false, enableLawNeighborCandidates: false,
      enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
      residentStepOptions: { thermalMaterialTable, mechanicsMaterialTable,
        internalPressureScale,
        thermalStepOptions: { conductionRate: 0 },
        fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null,
        gpuTimestampRecorder: { active: true, async measureQueueStage(meta, work) {
          const original = await work();
          if (meta.stage !== 'g2pReconstruction') return original;
          visits++;
          progress('g2p-complete');
          const g2pResult = original.gpuResult;
          const capture = await acquireMlsMpmMechanicsExactMassCapture(g2pResult, { device, sphParticleUpload });
          let thermalResult, proposal, selected;
          const thermalSourceCapture = Object.freeze({});
          try {
            if (!capture.generation || !capture.transaction) throw new Error('Native source requires actual canonical G2P');
            const generation = capture.generation, transaction = capture.transaction;
            thermalResult = await thermal.runSphThermalStepWebGpu({ device, sphParticleState,
              sphParticleUpload, thermalMaterialTable, exactMassG2pResult: g2pResult,
              exactMassSpatialEpochTransaction: transaction, exactMassSpatialEpochGeneration: generation,
              sourceStateBuffer: capture.stateBuffer, sourceThermoBuffer: capture.thermoBuffer,
              dtS: dtSeconds, conductionRate: 0, boxDimsM: [2, 2, 2],
              retainOutputParticleBuffers: true, readbackMode: 'no-full-readback', postMechanicsSourceCapture: thermalSourceCapture });
            progress('thermal-complete');
            proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({ device, generation,
              sphParticleState, sphParticleUpload, reactionTable,
              sourceStateBuffer: thermalResult.stateBuffer, sourceThermoBuffer: thermalResult.thermoBuffer,
              sourceMechanicsBuffer: capture.mechanicsBuffer });
            progress('discovery-complete');
            const args = { device, thermalResult, thermalSourceCapture, g2pResult, transaction, generation,
              sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload, thermalMaterialTable, reactionTable,
              dtSeconds, reactionDiscoveryProposal: proposal };
            if (inspect) { observed = await inspect(args); return original; }
            const before = await readWords(device, capture.sourceRead.read.buffer);
            progress('source-read-complete');
            selected = await runSphExactReactionSourceSelectionWebGpu(args);
            progress('selection-submitted');
            const issued = resolveSphExactReactionSourceSelection(selected, { device });
            const [words, after, proposals, evidence, stateWords, thermoWords, mechanicsWords] = await Promise.all([
              readWords(device, selected.outputBuffer), readWords(device, capture.sourceRead.read.buffer),
              readWords(device, proposal.proposalBuffer), readWords(device, proposal.evidenceBuffer),
              readWords(device, thermalResult.stateBuffer), readWords(device, thermalResult.thermoBuffer),
              readWords(device, capture.mechanicsBuffer)
            ]);
            progress('selection-read-complete');
            const rows = [];
            for (let row = 0; row < particles.length; row++) {
              const base = row * selected.recordWords, header = Array.from(words.slice(base, base + selected.headerWords));
              if (!header[0] && !header[1]) continue;
              const token = issued.compiled[header[4]], a = header[2], b = header[3], n = format.wordCount;
              const availableA = integer(encodeSphExactMass(particles[a].massKg, format));
              const availableB = integer(encodeSphExactMass(particles[b].massKg, format));
              const cap = header[8] ? selectSphExactReactionKineticCap(token, header[6], availableA + availableB) : availableA + availableB;
              const expected = selectSphExactReactionAllocation(token, { availableA, availableB, kineticCap: cap });
              const cursor = base + selected.headerWords;
              const amounts = Array.from({ length: 7 }, (_, index) => integer(words.slice(cursor + index * n, cursor + (index + 1) * n)));
              const products = token.products.map((term, index) => {
                const start = cursor + 7 * n + index * (4 + 3 * n);
                const ids = Array.from(words.slice(start, start + 4));
                const actual = Array.from({ length: 3 }, (_, field) => integer(words.slice(start + 4 + field * n, start + 4 + (field + 1) * n)));
                const wanted = expected.products[index];
                return { ids, amounts: actual.map(String), matches: ids[0] === wanted.termIndex
                  && ids[1] === wanted.materialId && ids[2] === wanted.targetPhase && ids[3] === 0
                  && actual[0] === wanted.mass && actual[1] === wanted.fromA && actual[2] === wanted.fromB };
              });
              const extensives = inspectExtensives(words, selected, base, stateWords,
                sphReactionEnergyEntry(reactionTable, header[4]), expected);
              const caloric = inspectExactCaloricSource({ words, selected, base, stateWords,
                entry: sphReactionEnergyEntry(reactionTable, header[4]), token, allocation: expected,
                expectedError: expectedCaloricError });
              const packet = inspectExactReactionPacket({ words, selected, base, stateWords, mechanicsWords, thermoWords,
                entry: sphReactionEnergyEntry(reactionTable, header[4]), token, allocation: expected,
                reactionTable, expectedCaloricError });
              rows.push({ header, amounts: amounts.map(String), products, extensives, caloric, packet, matches: header[1] === expected.error
                && header[0] === Number(expected.active)
                && amounts.every((value, index) => value === [expected.total, expected.debitA, expected.debitB,
                  expected.remainderA, expected.remainderB, cap, availableA + availableB][index])
                && products.every(product => product.matches) && extensives.matches && caloric.matches && packet.matches });
            }
            observed = { reverse, dtSeconds, wordCount, velocities, fixtureOptions, expectedCaloricError,
              internalPressureScale, g2pInternalPressureScale: g2pResult.internalPressureScale, visits, rows,
              proposals: Array.from(new Float32Array(proposals.buffer)),
              discoveryEvidence: Array.from(evidence), state: Array.from(new Float32Array(stateWords.buffer)),
              thermo: Array.from(new Float32Array(thermoWords.buffer)), sourceUnchanged: before.every((value, index) => value === after[index]),
              mechanics: Array.from(new Float32Array(mechanicsWords.buffer)),
              physicalPublicationAdmitted: selected.physicalPublicationAdmitted,
              pass: rows.length === 1 && rows.every(row => row.matches && row.header[0] === 1 && row.header[1] === 0) };
          } catch (error) {
            // A failed asynchronous preparation still owns its source reads
            // until its explicit cleanup receipt settles. Retire those reads
            // before releasing the original producer and preserve the cause.
            await error.exactReactionSourceCleanupCompletion;
            throw error;
          } finally {
            if (selected) await selected.release();
            proposal?.destroy();
            if (thermalResult) {
              thermal.resolveSphThermalSourceCapture(thermalResult, thermalSourceCapture).release();
              thermalResult.destroyOutputParticleBuffers();
            }
            capture.release();
          }
          return original;
        } }
      }
    };
    runOptions.gpuTimestampRecorder = runOptions.residentStepOptions.gpuTimestampRecorder;
    execution = await hierarchy.runSchroederSameLevelMechanicsWebGpu(runOptions);
    if (visits !== 1 || observed === undefined) throw new Error('Actual canonical G2P source hook did not execute once');
    return observed;
  } catch (error) { failure = error; throw error;
  } finally {
    if (execution?.residentStep) steps.destroyMlsMpmResidentStepBuffers(execution.residentStep);
    buffers.destroySphGpuParticleBuffers(sphParticleUpload); buffers.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
    try { await device.queue.onSubmittedWorkDone(); } catch (error) { if (!failure) throw error; }
  }
}
