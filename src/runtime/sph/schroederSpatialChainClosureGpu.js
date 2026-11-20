import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { validateSphExactMassRead } from './sphExactMassInventoryGpu.js';
import { prepareSchroederChainInventoryCheck } from './schroederSpatialChainMassConservationGpu.js';
import { validateSphExactFiniteWallRecord, sphExactFiniteWallAdmissionWgsl } from './sphExactFiniteWallGpu.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { prepareSphResidentClockAdvance } from './sphResidentClockGpu.js';
import { validateSphReactionLineageCandidate, sphReactionLineageAdmissionWgsl } from './sphReactionLineageGpu.js';
import { prepareSphLedgerReactionHistory } from './sphLedgerReactionHistoryGpu.js';
import { prepareSphReactionResidualHistory } from './sphReactionResidualHistoryGpu.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT, SPH_EXACT_THERMAL_ENERGY_WORDS,
  sphExactThermalEnergyRecordWords } from './sphExactThermalEnergyWgsl.js';

// Numerical finalization only. The closure holds the actual G2P/stage owners.
// This GPU receipt is still a candidate: publication requires its consumption
// by the resident runner. The clock now shares this numerical decision; its
// private record still needs the resident owner's publication/retirement path.
export function prepareSchroederSpatialChainClosure({ device, capture, original,
  candidate, refreshValidationBuffer, thermalValidationBuffer = refreshValidationBuffer,
  originalQuantities = null, candidateQuantities = null,
  originalEnergy = null, candidateEnergy = null, originalMassRead = null, candidateMassRead = null,
  phaseValidationBuffer = null, phaseLineageCount = 0, phasePredecessorMassRead = originalMassRead,
  phaseCandidateMassRead = candidateMassRead, refinementValidationBuffer = null,
  reactionValidationBuffer = null, sourceHistoryRead = null, candidateHistory = null,
  parcelRecord = null, wallRecord = null, lineageRecord = null,
  sourceResidualHistory = null, emittedResidualLedger = null,
  residualSourceControlBuffer = null,
  clockOrigin, sourceClock = null }) {
  capture.validate();
  const owned = [];
  const allocate = (label, size, usage) => {
    const buffer = tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
    owned.push(buffer); return buffer;
  };
  let clockAdvance = null, residualHistory = null;
  const destroy = () => { residualHistory?.destroy(); clockAdvance?.destroy(); for (const buffer of owned.splice(0)) buffer.destroy(); };
  try {
    const controlBuffer = allocate('ulg-chain-closure-control', 128, 128 | 4 | 8);
    const history = prepareSphLedgerReactionHistory({ device, sourceRead: sourceHistoryRead,
      candidate: candidateHistory, controlBuffer, allocate });
    residualHistory = prepareSphReactionResidualHistory({ device, source: sourceResidualHistory,
      emitted: emittedResidualLedger, controlBuffer });
    if(!clockOrigin) throw new TypeError('Chain closure requires its original source clock');
    clockAdvance=prepareSphResidentClockAdvance({device,source:sourceClock,...clockOrigin,
      dt:capture.dt,controlBuffer});
    const params = allocate('ulg-chain-closure-params', 48, 64 | 8);
    const pairs = ['stateBuffer', 'thermoBuffer', 'mechanicsBuffer'].map(key => [original[key], candidate[key]]);
    if (lineageRecord) {
      validateSphReactionLineageCandidate(lineageRecord, device);
      pairs.push([lineageRecord.beforeBuffer, lineageRecord.buffer]);
    }
    if (wallRecord) {
      validateSphExactFiniteWallRecord(wallRecord, device);
      if (!candidateEnergy || wallRecord.particleCount !== capture.particleCount) {
        throw new TypeError('Finite wall closure requires its matching canonical carrier energy');
      }
      pairs.push([wallRecord.originalBuffer, wallRecord.buffer]);
    }
    if (originalQuantities || candidateQuantities) {
      if (!originalQuantities || !candidateQuantities) throw new TypeError('Chain closure lost exact quantities');
      pairs.push([originalQuantities.quantityBuffer, candidateQuantities.quantityBuffer]);
    }
    if (parcelRecord) {
      if (!parcelRecord.validationBuffer || !candidateEnergy || !candidateMassRead
        || parcelRecord.carrierMassRead !== candidateMassRead || parcelRecord.exactEnergy !== candidateEnergy
        || parcelRecord.originalParcels.count !== parcelRecord.parcels.count
        || parcelRecord.parcels.count < 1 || parcelRecord.parcels.device !== device) {
        throw new TypeError('Chain parcel closure requires its complete captured successor');
      }
      for (const key of ['paramsBuffer','ledgerBuffer','sinkBuffer']) {
        if (parcelRecord.originalParcels[key] === parcelRecord.parcels[key]) {
          throw new TypeError('Chain parcel candidate aliases its accepted source');
        }
        pairs.push([parcelRecord.originalParcels[key],parcelRecord.parcels[key]]);
      }
    }
    let thermalErrorWord = 0;
    if (originalEnergy || candidateEnergy) {
      if (originalQuantities || candidateQuantities || !originalEnergy || !candidateEnergy) {
        throw new TypeError('Chain closure requires one complete exact energy representation');
      }
      for (const energy of [originalEnergy, candidateEnergy]) {
        if (energy.rowCount !== capture.particleCount
          || energy.format?.wordCount !== SPH_EXACT_THERMAL_ENERGY_WORDS
          || energy.format?.quantumExponent !== SPH_EXACT_THERMAL_ENERGY_FORMAT.quantumExponent
          || energy.energyBuffer?.size !== 4 * sphExactThermalEnergyRecordWords(capture.particleCount)) {
          throw new TypeError('Chain closure requires aligned canonical energy records');
        }
      }
      thermalErrorWord = 2 * capture.particleCount * SPH_EXACT_THERMAL_ENERGY_WORDS;
      thermalValidationBuffer = candidateEnergy.energyBuffer;
      pairs.push([originalEnergy.energyBuffer, candidateEnergy.energyBuffer]);
    }
    const preservingMass = Boolean(candidateMassRead && candidateMassRead === originalMassRead
      && !phaseValidationBuffer && !reactionValidationBuffer && !refinementValidationBuffer
      && !parcelRecord && phaseLineageCount === 0);
    const validateMass = () => {
      if (!candidateMassRead && !originalMassRead && !phaseValidationBuffer && !reactionValidationBuffer && !refinementValidationBuffer && phaseLineageCount === 0) return;
      const phaseReady = phaseValidationBuffer && phaseValidationBuffer.size >= 64
        && Number.isSafeInteger(phaseLineageCount) && phaseLineageCount > 0
        && phaseLineageCount * 4 === capture.particleCount;
      if (!candidateEnergy || (!phaseReady && !reactionValidationBuffer && !preservingMass)
        || (reactionValidationBuffer && reactionValidationBuffer.size < 32)
        || (refinementValidationBuffer && (!phaseReady || refinementValidationBuffer.size < 32))
        || ((phaseValidationBuffer || phaseLineageCount !== 0) && !phaseReady)
        || (!preservingMass && candidateMassRead?.buffer === originalMassRead?.buffer)
        || ![originalMassRead, candidateMassRead, ...(phaseReady ? [phasePredecessorMassRead, phaseCandidateMassRead] : [])].every(read => validateSphExactMassRead(read, {
          device, family: read?.family, expectedGeneration: read?.generation,
          rowCount: capture.particleCount, format: candidateEnergy.format
        }))) throw new TypeError('Chain reaction/phase closure requires genuine aligned successor mass and validation');
    };
    validateMass();
    device.queue.writeBuffer(params, 0, new Uint32Array([
      capture.particleCount, capture.levelCount, thermalErrorWord, candidateEnergy ? 1 : 0,
      candidateMassRead?.byteOffset / 4 || 0, phasePredecessorMassRead?.byteOffset / 4 || 0, phaseLineageCount, candidateMassRead ? 1 : 0,
      phaseCandidateMassRead?.byteOffset / 4 || 0, 0, 0, 0
    ]));
    for (const [source, output] of pairs) {
      if (!source || !output || source.size !== output.size
        || Math.ceil(output.size / 256) > device.limits.maxComputeWorkgroupsPerDimension) {
        throw new RangeError('Chain closure requires aligned bounded output families');
      }
    }
    const checkCode = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
struct Params { step:vec4<u32>, mass:vec4<u32>, phase_mass:vec4<u32> };
@group(0) @binding(0) var<storage, read> upstream: array<u32>;
@group(0) @binding(1) var<storage, read> refresh: array<u32>;
@group(0) @binding(2) var<storage, read> thermal: array<u32>;
@group(0) @binding(3) var<storage, read> s: array<f32>;
@group(0) @binding(4) var<storage, read> t: array<f32>;
@group(0) @binding(5) var<storage, read> m: array<f32>;
@group(0) @binding(6) var<storage, read_write> control: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> cfg: Params;
@group(0) @binding(8) var<storage, read> original_s: array<u32>;
@group(0) @binding(9) var<storage, read> original_energy: array<u32>;
@group(0) @binding(10) var<storage, read> mass:array<u32>;
@group(0) @binding(12) var<storage, read> phase:array<u32>;
fn mass_row(row:u32)->ExactMass {
  var value:ExactMass;
  for(var i=0u;i<EM_WORDS;i++) {
    value.words[i]=mass[cfg.mass.x+row*EM_WORDS+i];
  }
  return value;
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; let params = cfg.step;
  if (row == 0u) {
    atomicStore(&control[0], 0x53434331u);
    for (var i=3u; i<16u; i++) { atomicStore(&control[i], upstream[i]); }
    atomicStore(&control[16], params.y);
    if (upstream[0]!=0x53475031u || upstream[1]!=3u || upstream[2]!=0u || upstream[16]!=params.y) {
      atomicOr(&control[2], 1u);
    }
    if (refresh[0]!=0u) { atomicOr(&control[2], 2u); }
    if (thermal[params.z]!=0u) { atomicOr(&control[2], 4u); }
    // A rejected canonical header records skipped particle-steps instead of
    // an arithmetic error. Do not admit an interval that omitted pair laws.
    if (params.w!=0u && thermal[params.z+2u]!=original_energy[params.z+2u]) {
      atomicOr(&control[2], 4u);
    }
  }
    if (cfg.mass.z>0u && row==0u) {
      if (phase[0]!=0x50544631u || phase[1]!=1u || phase[2]!=0u
        || phase[3]!=cfg.mass.z || phase[6]!=0u) {atomicOr(&control[2],256u);}
    }
  if (row >= params.x) { return; }
  if (cfg.mass.w!=0u) {
    let projected=em_project_f32_bits(mass_row(row));
    if(projected.error!=0u || projected.bits!=bitcast<u32>(s[row*8u+3u])) {atomicOr(&control[2],512u);}
  } else if (bitcast<u32>(s[row*8u+3u])!=original_s[row*8u+3u]) { atomicOr(&control[2],128u); }
  for (var i=0u; i<8u; i++) { if (!(abs(s[row*8u+i])<=3.402823e38)) { atomicOr(&control[2],8u); } }
  for (var i=0u; i<12u; i++) { if (!(abs(t[row*12u+i])<=3.402823e38)) { atomicOr(&control[2],16u); } }
  for (var i=0u; i<32u; i++) { if (!(abs(m[row*32u+i])<=3.402823e38)) { atomicOr(&control[2],32u); } }
  if (s[row*8u+3u]>0.0 && (t[row*12u+10u]!=1.0 || t[row*12u+2u]<0.0)) { atomicOr(&control[2],64u); }
}
@compute @workgroup_size(1) fn finalize() {
  atomicStore(&control[1], select(5u,3u,atomicLoad(&control[2])==0u));
}`;
    const checkBindings = ['read-only-storage', 'read-only-storage', 'read-only-storage',
      'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage'];
    const checkResources = [capture.controlBuffer, refreshValidationBuffer, thermalValidationBuffer,
      candidate.stateBuffer, candidate.thermoBuffer, candidate.mechanicsBuffer, controlBuffer, params, original.stateBuffer,
      originalEnergy?.energyBuffer ?? refreshValidationBuffer,
      candidateMassRead?.buffer ?? refreshValidationBuffer, phasePredecessorMassRead?.buffer ?? refreshValidationBuffer,
      phaseValidationBuffer ?? refreshValidationBuffer];
    const prepare = (code, entryPoint, types, buffers, key) => {
      const pipeline = createCachedExplicitComputePipeline(device, { code, entryPoint,
        cacheKey: `ulg-chain-closure-v6-refinement-${key}`, label: `ulg-chain-closure-${entryPoint}`,
        bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
      const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      return (encoder, count) => {
        const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline);
        pass.setBindGroup(0, group); pass.dispatchWorkgroups(count); pass.end();
      };
    };
    const check = prepare(checkCode, 'check', checkBindings, checkResources, 'check');
    const finalize = prepare(checkCode, 'finalize', checkBindings, checkResources, 'finalize');
    // Check the phase stage's own per-lineage output. Refinement may legitimately
    // move its mass to different lineages, so only the global gate sees that successor.
    const checkPhaseMass = phaseLineageCount ? prepare(`
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
struct Params { step:vec4<u32>, mass:vec4<u32>, phase_mass:vec4<u32> };
@group(0) @binding(3) var<uniform> cfg:Params;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x>=cfg.mass.z) {return;}
  var a:ExactMass;var b:ExactMass;
  for(var lane=0u;lane<4u;lane++) {
    let row=id.x+lane*cfg.mass.z;var x:ExactMass;var y:ExactMass;
    for(var w=0u;w<EM_WORDS;w++) {
      x.words[w]=before[cfg.mass.y+row*EM_WORDS+w];
      y.words[w]=after[cfg.phase_mass.x+row*EM_WORDS+w];
    }
    let aa=em_add(a,x);let bb=em_add(b,y);a=aa.value;b=bb.value;
    if((aa.error|bb.error)!=0u) {atomicOr(&control[2],512u);}
  }
  if(em_compare(a,b)!=0) {atomicOr(&control[2],512u);}
}`, 'check', ['read-only-storage','read-only-storage','storage','uniform'],
      [phasePredecessorMassRead.buffer,phaseCandidateMassRead.buffer,controlBuffer,params], 'phase-mass') : null;
    const checkRefinement = refinementValidationBuffer ? prepare(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  for(var w=0u;w<8u;w++) {atomicStore(&control[23u+w],evidence[w]);}
  if(evidence[0]!=0u || evidence[5]!=0u) {atomicOr(&control[2],8192u);}
}`, 'check', ['read-only-storage','storage'], [refinementValidationBuffer,controlBuffer], 'refinement') : null;
    const checkParcels = parcelRecord ? prepare(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  atomicStore(&control[31],evidence[2]);
  if(evidence[0]!=0x50435231u || evidence[1]!=1u || evidence[2]!=0u
    || evidence[3]!=${parcelRecord.parcels.count}u || evidence[7]!=1u) {atomicOr(&control[2],16384u);}
}`, 'check', ['read-only-storage','storage'], [parcelRecord.validationBuffer,controlBuffer],
      `parcels-${parcelRecord.parcels.count}`) : null;
    const checkWalls = wallRecord ? prepare(sphExactFiniteWallAdmissionWgsl(), 'check',
      ['read-only-storage','read-only-storage','read-only-storage','read-only-storage','storage'],
      [wallRecord.originalBuffer,wallRecord.buffer,wallRecord.deltaBuffer,wallRecord.validationBuffer,controlBuffer],
      'finite-walls-v1') : null;
    const checkLineage = lineageRecord ? prepare(sphReactionLineageAdmissionWgsl(), 'check',
      ['read-only-storage','read-only-storage','storage'],
      [lineageRecord.beforeBuffer,lineageRecord.buffer,controlBuffer], 'reaction-lineage-v1') : null;
    const checkInventory = originalEnergy && candidateEnergy && originalMassRead && candidateMassRead ? prepareSchroederChainInventoryCheck({
      device, allocate, controlBuffer, originalMassRead, candidateMassRead, originalEnergy,
      candidateEnergy, reactionValidationBuffer, residualHistory:residualHistory?.record??null,
      originalParcels: parcelRecord?.originalParcels, candidateParcels: parcelRecord?.parcels
    }) : null;
    const restoreCode = /* wgsl */ `
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> control: array<u32>;
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x<arrayLength(&output) && control[2]!=0u) { output[id.x]=source[id.x]; }
}`;
    const restores = pairs.filter(([source, output]) => source !== output).map(([source, output]) => ({
      words: output.size / 4,
      run: prepare(restoreCode, 'restore', ['read-only-storage', 'storage', 'read-only-storage'],
        [source, output, controlBuffer], 'restore')
    }));
    if (candidateMassRead && !preservingMass) {
      const massRestoreParams = allocate('ulg-chain-closure-mass-restore', 16, 64 | 8);
      device.queue.writeBuffer(massRestoreParams,0,new Uint32Array([
        originalMassRead.byteOffset/4, candidateMassRead.byteOffset/4, candidateMassRead.byteLength/4, 0
      ]));
      if (Math.ceil(candidateMassRead.byteLength/256)>device.limits.maxComputeWorkgroupsPerDimension) {
        throw new RangeError('Chain phase mass restoration exceeds dispatch capacity');
      }
      const code = restoreCode.replace('@compute @workgroup_size(64)',
        '@group(0) @binding(3) var<uniform> offsets:vec4<u32>;\n@compute @workgroup_size(64)')
        .replace('id.x<arrayLength(&output)', 'id.x<offsets.z')
        .replace('output[id.x]=source[id.x]', 'output[offsets.y+id.x]=source[offsets.x+id.x]');
      restores.push({ words:candidateMassRead.byteLength/4,
        run:prepare(code,'restore',['read-only-storage','storage','read-only-storage','uniform'],
          [originalMassRead.buffer,candidateMassRead.buffer,controlBuffer,massRestoreParams],'restore-mass') });
    }
    // Expanded retained-product rows are already included in the complete
    // carrier inventory. Preserve their original projection verdict too:
    // an invalid source must never become an accepted interval or advance time.
    const checkResidualSource=residualSourceControlBuffer?prepare(`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){
 if(source[0]!=0x524d5331u || source[1]!=1u || source[2]!=0u){atomicOr(&control[2],4194304u);}
}`, 'check',['read-only-storage','storage'],[residualSourceControlBuffer,controlBuffer],'residual-source'):null;
    return { controlBuffer, clock:clockAdvance.clock, transferClock:clockAdvance.transfer, destroy,
      residualHistory:residualHistory?.record??null,transferResidualHistory:residualHistory?.transfer??null,
      encode(encoder) {
        capture.validate(); validateMass(); encoder.clearBuffer(controlBuffer);
        residualHistory?.encode(encoder);
        check(encoder, Math.ceil(capture.particleCount / 64));
        checkResidualSource?.(encoder,1);
        checkPhaseMass?.(encoder, Math.ceil(phaseLineageCount / 64));
        checkRefinement?.(encoder, 1);
        checkParcels?.(encoder, 1);
        checkWalls?.(encoder, 6);
        if (lineageRecord) {
          validateSphReactionLineageCandidate(lineageRecord, device);
          checkLineage(encoder, Math.ceil(lineageRecord.capacity / 64));
        }
        checkInventory?.(encoder);
        history?.check(encoder);
        residualHistory?.check(encoder);
        residualHistory?.requireEmptyForMechanics(encoder);
        clockAdvance.check(encoder);
        for (const restore of restores) restore.run(encoder, Math.ceil(restore.words / 64));
        history?.restore(encoder);
        residualHistory?.restore(encoder);
        finalize(encoder, 1);
        clockAdvance.advance(encoder);
      }
    };
  } catch (error) { destroy(); throw error; }
}
