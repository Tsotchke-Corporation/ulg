import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_REACTION_SOA_BASE_URL || 'http://127.0.0.1:5173/';
const outputPath = process.env.ULG_REACTION_SOA_OUTPUT
  || '/tmp/ulg-sph-reaction-direct-soa.json';

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  let result;
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const reaction = await import('/src/runtime/sph/sphReactionGpuKernel.js');
      const thermal = await import('/src/runtime/sph/sphThermalGpuKernel.js');
      const optical = await import('/src/runtime/material/opticalGpuBuffers.js');
      const buffers = await import('/src/runtime/sph/sphGpuBuffers.js');
      const productEvents = await import('/src/runtime/sph/sphReactionProductEventGpu.js');

      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const requestedStorageBuffers = Math.min(
        16,
        Number(adapter.limits.maxStorageBuffersPerShaderStage || 8)
      );
      const nativeDevice = await adapter.requestDevice({
        requiredLimits: { maxStorageBuffersPerShaderStage: requestedStorageBuffers }
      });
      const validationErrors = [];
      nativeDevice.addEventListener('uncapturederror', (event) => {
        validationErrors.push(event.error?.message || String(event.error));
      });
      const createdBuffers = [];
      const pipelineEntryPoints = [];
      const queueWrites = [];
      const queueSubmissions = [];
      const queue = new Proxy(nativeDevice.queue, {
        get(target, property) {
          if (property === 'writeBuffer') {
            return (buffer, offset, data, ...rest) => {
              queueWrites.push({
                label: buffer?.label ?? null,
                byteLength: data?.byteLength ?? 0
              });
              return target.writeBuffer(buffer, offset, data, ...rest);
            };
          }
          if (property === 'submit') {
            return (commandBuffers) => {
              queueSubmissions.push(commandBuffers?.length ?? 0);
              return target.submit(commandBuffers);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const device = new Proxy(nativeDevice, {
        get(target, property) {
          if (property === 'queue') return queue;
          if (property === 'createBuffer') {
            return (descriptor) => {
              createdBuffers.push({
                label: descriptor?.label ?? null,
                size: descriptor?.size ?? 0,
                usage: descriptor?.usage ?? 0
              });
              return target.createBuffer(descriptor);
            };
          }
          if (property === 'createComputePipeline') {
            return (descriptor) => {
              pipelineEntryPoints.push(descriptor?.compute?.entryPoint ?? null);
              return target.createComputePipeline(descriptor);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      device.pushErrorScope('validation');

      const materialProperties = {
        a: {
          molarMassKgPerMol: 0.01,
          phases: [{
            name: 'solid', temperatureRange: [0, 2000], cpJPerKgK: 1000,
            densityKgPerM3: 1000, bulkModulusPa: 1e6, shearModulusPa: 2e5
          }],
          transitions: []
        },
        b: {
          molarMassKgPerMol: 0.02,
          phases: [{
            name: 'liquid', temperatureRange: [0, 2000], cpJPerKgK: 1200,
            densityKgPerM3: 800, bulkModulusPa: 8e5, shearModulusPa: 0
          }],
          transitions: []
        },
        ab: {
          molarMassKgPerMol: 0.03,
          phases: [{
            name: 'liquid', temperatureRange: [0, 3000], cpJPerKgK: 1500,
            densityKgPerM3: 500, bulkModulusPa: 5e5, shearModulusPa: 0
          }],
          transitions: []
        }
      };
      const particleCount = 3;
      const state = new Float32Array(particleCount * buffers.SPH_GPU_PARTICLE_STATE_FLOATS);
      state.set([0, 0, 0, 2, 0, 0, 0, 100], 0);
      state.set([0.04, 0, 0, 4, 0, 0, 0, 200], buffers.SPH_GPU_PARTICLE_STATE_FLOATS);
      state.set([1, 0, 0, 3, 0, 0, 0, 300], buffers.SPH_GPU_PARTICLE_STATE_FLOATS * 2);
      const thermoRows = new Float32Array(
        particleCount * buffers.SPH_GPU_PARTICLE_THERMO_FLOATS
      );
      thermoRows.set([
        optical.stableOpticalMaterialId('a'), optical.GPU_PHASE_IDS.solid,
        300, 1000, 1, 0, 0, 0, 0.1, 1, 1, 0
      ], 0);
      thermoRows.set([
        optical.stableOpticalMaterialId('b'), optical.GPU_PHASE_IDS.liquid,
        300, 800, 0, 1, 0, 0, 0.1, 1, 1, 0
      ], buffers.SPH_GPU_PARTICLE_THERMO_FLOATS);
      thermoRows.set([
        optical.stableOpticalMaterialId('b'), optical.GPU_PHASE_IDS.liquid,
        300, 800, 0, 1, 0, 0, 0.1, 1, 1, 0
      ], buffers.SPH_GPU_PARTICLE_THERMO_FLOATS * 2);
      const mechanics = new Float32Array(
        particleCount * buffers.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
      );
      const mechanicsRow = [
        2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 9, 9, 9, 9,
        9, 9, 8, 0.01, 1, 1, 1e6, 2e5, 8e5, 30, 1, 1, 0, 0, 0, 0
      ];
      for (let index = 0; index < particleCount; index += 1) {
        mechanics.set(mechanicsRow, index * buffers.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
      }
      const sphParticleState = {
        schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'manufactured-direct-soa-input',
        particleCount,
        step: 0,
        time: 0,
        smoothingLengthM: 0.1,
        state,
        thermo: thermoRows
      };
      const mlsMpmParticleState = {
        schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'manufactured-direct-soa-input',
        particleCount,
        step: 0,
        time: 0,
        mechanics
      };
      const reactionTable = reaction.buildSphReactionTable([{
        a: 'a',
        b: 'b',
        product: 'ab',
        activationTemperatureK: 0,
        phaseRequirements: { b: ['liquid'] },
        specificEnthalpyJPerKg: -1000,
        stoichiometry: {
          equation: 'A + B -> AB',
          atomBalance: { balanced: true },
          reactants: [
            { coefficient: 1, formula: 'A', material: 'a' },
            { coefficient: 1, formula: 'B', material: 'b' }
          ],
          products: [
            { coefficient: 1, formula: 'AB', material: 'ab' }
          ]
        }
      }], { materialProperties, contactRadiusM: 0.1 });
      const thermalMaterialTable = thermal.buildSphThermalMaterialTable(materialProperties);
      const execution = await reaction.runSphReactionStepWebGpu({
        device,
        sphParticleState,
        mlsMpmParticleState,
        reactionTable,
        thermalMaterialTable,
        boxDimsM: [2, 2, 2],
        emitResidentProductEvents: false,
        readCompactReactionSummary: false,
        readReactionGasSpeciesSummary: false,
        readReactionProductInventory: false,
        readReactionAtomResidual: false
      });
      await nativeDevice.queue.onSubmittedWorkDone();

      const upload = (label, data) => {
        const buffer = device.createBuffer({
          label,
          size: data.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const output = (label, byteLength) => device.createBuffer({
        label,
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const sourceStateBuffer = upload('outcome-probe-source-state', state);
      const sourceThermoBuffer = upload('outcome-probe-source-thermo', thermoRows);
      const sourceMechanicsBuffer = upload('outcome-probe-source-mechanics', mechanics);
      const outputStateBuffer = output('outcome-probe-output-state', state.byteLength);
      const outputThermoBuffer = output('outcome-probe-output-thermo', thermoRows.byteLength);
      const outputMechanicsBuffer = output('outcome-probe-output-mechanics', mechanics.byteLength);
      const outcomeCapacityRows = productEvents.sphReactionProductEventCapacityRows({
        particleCount,
        reactionTable
      });
      const productEventWorkspace =
        productEvents.createSphReactionProductEventPlacementWorkspaceGpu(device, {
          eventCapacityRows: outcomeCapacityRows,
          particleCapacity: particleCount,
          label: 'reaction-resolve-outcome-probe'
        });
      const outcomeEncoder = device.createCommandEncoder({
        label: 'reaction-resolve-outcome-probe'
      });
      const outcomeStage = await reaction.createSphReactionStepWebGpuEncoderStage({
        device,
        commandEncoder: outcomeEncoder,
        sphParticleState,
        mlsMpmParticleState,
        reactionTable,
        thermalMaterialTable,
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer,
        outputStateBuffer,
        outputThermoBuffer,
        outputMechanicsBuffer,
        productEventPlacementWorkspace: productEventWorkspace,
        placeReactionProductEvents: false,
        boxDimsM: [2, 2, 2]
      });
      const outcomeReadback = device.createBuffer({
        label: 'reaction-resolve-outcome-evidence',
        size: 64,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const prefixReadback = device.createBuffer({
        label: 'reaction-resolve-prefix-evidence',
        size: 80,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      outcomeEncoder.copyBufferToBuffer(
        productEventWorkspace.reactionOutcomeBuffer,
        0,
        outcomeReadback,
        0,
        64
      );
      outcomeEncoder.copyBufferToBuffer(
        productEventWorkspace.prefixMetadataBuffer,
        0,
        prefixReadback,
        0,
        80
      );
      device.queue.submit([outcomeEncoder.finish()]);
      await nativeDevice.queue.onSubmittedWorkDone();
      await Promise.all([
        outcomeReadback.mapAsync(GPUMapMode.READ),
        prefixReadback.mapAsync(GPUMapMode.READ)
      ]);
      const outcomeWords = new Uint32Array(outcomeReadback.getMappedRange()).slice();
      const outcomeFloats = new Float32Array(outcomeWords.buffer);
      const prefixWords = new Uint32Array(prefixReadback.getMappedRange()).slice();
      outcomeReadback.unmap();
      prefixReadback.unmap();
      outcomeStage.cleanupSubmittedWork({ destroyOutputs: false });
      productEventWorkspace.destroy();
      for (const buffer of [
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer,
        outputStateBuffer,
        outputThermoBuffer,
        outputMechanicsBuffer,
        outcomeReadback,
        prefixReadback
      ]) buffer.destroy();
      const scopedError = await device.popErrorScope();
      if (scopedError) validationErrors.push(scopedError.message || String(scopedError));

      const stateOut = Array.from(execution.state);
      const thermoOut = Array.from(execution.thermo);
      const proposals = Array.from(execution.proposals);
      const mechanicsOut = Array.from(execution.mechanics);
      const abId = optical.stableOpticalMaterialId('ab');
      const bId = optical.stableOpticalMaterialId('b');
      const checks = {
        validationClean: validationErrors.length === 0,
        directSoaMode:
          execution.sourceParticlePackInitializationMode
            === 'host-uploads-direct-soa-source-buffers',
        proposalOnlyWorkspace:
          execution.reactionCoreWorkspaceByteLength === particleCount * 16
            && execution.reactionCoreWorkspaceBufferCount === 1,
        noPackedBuffers: createdBuffers.every(
          ({ label }) => !String(label || '').includes('packed-source')
            && !String(label || '').includes('packed-output')
        ),
        noPackDispatches:
          !pipelineEntryPoints.includes('pack_source')
            && !pipelineEntryPoints.includes('unpack'),
        directPipelines:
          pipelineEntryPoints.includes('bin_particles')
            && pipelineEntryPoints.includes('propose')
            && pipelineEntryPoints.includes('resolve'),
        resolvePublishedCanonicalOutcome:
          outcomeWords[0] === 1
            && outcomeWords[1] === 0
            && outcomeWords[2] === 0
            && outcomeWords[3] === 1,
        resolveOutcomeKinetics:
          Math.abs(outcomeFloats[4] - 200) < 1e-4
            && Math.abs(outcomeFloats[5] - 1) < 1e-6
            && Math.abs(outcomeFloats[6] - 2) < 1e-6
            && Math.abs(outcomeFloats[7] - 4) < 1e-6,
        prefixConsumedResolveOutcome:
          prefixWords[6] === 0
            && prefixWords[7] === 0
            && prefixWords[10] === 0
            && prefixWords[17] === 4
            && prefixWords[18] === prefixWords[2]
            && prefixWords[19] === 0x4f555443,
        mutualPair:
          Math.round(proposals[0]) === 1
            && Math.round(proposals[4]) === 0
            && proposals[8] < 0,
        productAndFarParticle:
          thermoOut[0] === abId
            && thermoOut[buffers.SPH_GPU_PARTICLE_THERMO_FLOATS] === abId
            && thermoOut[buffers.SPH_GPU_PARTICLE_THERMO_FLOATS * 2] === bId,
        massConserved: Math.abs(
          stateOut[3]
            + stateOut[buffers.SPH_GPU_PARTICLE_STATE_FLOATS + 3]
            + stateOut[buffers.SPH_GPU_PARTICLE_STATE_FLOATS * 2 + 3]
            - 9
        ) < 1e-5,
        finiteOutputs:
          stateOut.every(Number.isFinite)
            && thermoOut.every(Number.isFinite)
            && mechanicsOut.every(Number.isFinite)
      };
      return {
        schema: 'peercompute.ulg.sph-reaction-direct-soa-probe.v0',
        status: Object.values(checks).every(Boolean) ? 'pass' : 'fail',
        checks,
        adapter: {
          maxStorageBuffersPerShaderStage:
            Number(adapter.limits.maxStorageBuffersPerShaderStage || 0),
          requestedStorageBuffers
        },
        pipelineEntryPoints,
        createdBuffers,
        queueWrites,
        queueSubmissions,
        validationErrors,
        evidence: {
          sourceMode: execution.sourceParticlePackInitializationMode,
          shaderInitializedLiveByteLength: execution.shaderInitializedLiveByteLength,
          workspaceBufferCount: execution.reactionCoreWorkspaceBufferCount,
          workspaceByteLength: execution.reactionCoreWorkspaceByteLength,
          reactionOutcomeAuthority: outcomeStage.reactionOutcomeAuthority,
          reactionOutcomeWords: Array.from(outcomeWords.slice(0, 8)),
          reactionOutcomeKinetics: Array.from(outcomeFloats.slice(4, 8)),
          productEventPrefixWords: Array.from(prefixWords),
          proposals,
          materialIds: [
            thermoOut[0],
            thermoOut[buffers.SPH_GPU_PARTICLE_THERMO_FLOATS],
            thermoOut[buffers.SPH_GPU_PARTICLE_THERMO_FLOATS * 2]
          ],
          massesKg: [
            stateOut[3],
            stateOut[buffers.SPH_GPU_PARTICLE_STATE_FLOATS + 3],
            stateOut[buffers.SPH_GPU_PARTICLE_STATE_FLOATS * 2 + 3]
          ]
        }
      };
    });
  } finally {
    await browser.close();
  }

  const artifact = {
    ...result,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    chromiumArgs: chromiumArgs()
  };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  if (artifact.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
