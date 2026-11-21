import { pressureIntervalReceipt } from './schroederSpatialChainPressureIntervalReceipt.js';
import { chainWallReceiptShader } from './schroederSpatialChainWallReceipt.js';
import { chainParcelReceiptShader } from './schroederSpatialChainParcelReceipt.js';
import {
  runSchroederSpatialEpochGenerationWebGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue
} from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSchroederSpatialParentFieldViewGpu } from '../../src/runtime/sph/schroederSpatialParentFieldViewGpu.js';
import { validateSchroederSpatialParentFieldViewDescriptor } from '../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import { runSchroederSpatialThermalProposalWebGpu, SCHROEDER_SPATIAL_THERMAL_CONSUMERS } from '../../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import { chainReactionReceiptShader } from './schroederSpatialChainReactionReceipt.js';
import { runSchroederSpatialReactionDiscoveryProposalWebGpu } from '../../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import { chainRefinementReceiptShader } from './schroederSpatialChainRefinementReceipt.js';
import { chainPhaseReceiptShader } from './schroederSpatialChainPhaseReceipt.js';
import { chainLedgerReceiptShader } from './schroederSpatialChainLedgerReceipt.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createSchroederSpatialCompositeMechanicsGpu } from '../../src/runtime/sph/schroederSpatialCompositeMechanicsGpu.js';
import { runMlsMpmP2gGridProjectionWebGpu } from '../../src/runtime/sph/sphGridGpuKernel.js';
import { runMlsMpmLevelChainG2pWebGpu, acquireMlsMpmG2pExactMassCapture } from '../../src/runtime/sph/sphG2pGpuKernel.js';
import { runSchroederSpatialMechanicalProposalWebGpu } from '../../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import { prepareSphExactParticleMassSeed, bindSphExactParticleMassSeed } from '../../src/runtime/sph/sphExactMassParticleSeed.js';
import { createSphExactMassFormat, encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers, sphGpuParticleUploadLedgerParcels } from '../../src/runtime/sph/sphGpuBuffers.js';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';
import {
  createSchroederSpatialEpochTransaction,
  admitSchroederSpatialEpochTransactionReader,
  resolveSchroederSpatialMechanicsChainAuthority,
  abortSchroederSpatialEpochTransaction,
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE
} from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';

// Only this fixed 128-byte record is mapped. Inputs are cold manufactured
// declarations. The mathematical checks run on actual production GPU output;
// no particle/field arrays or CPU reference solution cross the device boundary.
const RECEIPT_BYTES = 128;

function invariantShader(pairIndex, levelCount, fluid = false, sharedDomain = false, materialId = 26, secondMaterialId = materialId, phaseId = fluid ? 2 : 1, secondPhaseId = phaseId) {
  return /* wgsl */ `
@group(0) @binding(0) var<storage, read> parent: array<u32>;
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read> coarse: array<u32>;
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
const INHERITED: bool = ${pairIndex > 0};
const PAIR: u32 = ${pairIndex}u;
const SECOND_LEVEL: u32 = ${Math.min(levelCount - 1, 2)}u;
fn fail(mask: u32) { atomicOr(&receipt[0], mask); }
fn position(node: u32, dims: vec3<u32>, shift: u32, spacing: f32) -> vec3<f32> {
  let yz = dims.y * dims.z;
  let p = vec3<u32>(node / yz, (node % yz) / dims.z, node % dims.z);
  return (vec3<f32>(p) - vec3<f32>(f32(shift))) * spacing;
}
@compute @workgroup_size(64)
fn check(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let sourceCount = select(source[34], source[37], INHERITED);
  let sourceKeys = select(source[26], source[48], INHERITED);
  let count = parent[37];
  if (i == 0u) {
    atomicAdd(&receipt[1], 1u);
    if (PAIR < 5u) {
      let debug = 8u + PAIR * 4u;
      atomicStore(&receipt[debug], parent[2]);
      atomicStore(&receipt[debug+1u], parent[35]);
      atomicStore(&receipt[debug+2u], count);
      atomicStore(&receipt[debug+3u], parent[39] | parent[40] | parent[41] | parent[71] | parent[78] | parent[79]);
    }
    if (PAIR == 1u) {
      atomicStore(&receipt[28], parent[78]); atomicStore(&receipt[29], parent[79]);
      atomicStore(&receipt[30], source[33]); atomicStore(&receipt[31], parent[30]);
    }
    if (parent[0] != 0x53504631u || parent[1] != 1u || parent[2] != 3u
        || parent[16] != PAIR || parent[17] != PAIR+1u || parent[67] != 2u
        || parent[39] != 0u || parent[40] != 0u || parent[41] != 0u || parent[71] != 0u) { fail(1u); }
    if (parent[35] != sourceCount || parent[36] != coarse[34]
        || count == 0u || count > parent[33] || parent[38] > parent[34]) { fail(2u); }
    if (${levelCount > 2} && PAIR == 0u && parent[36] != 0u) { fail(128u); }
    if (INHERITED && sourceCount == 0u) { fail(128u); }
    var domains = 0u;
    for (var k=0u; k<count; k++) {
      let domain = parent[parent[48]+k*4u+3u];
      if (${fluid} && domain == 0u) { domains |= 3u; }
      if (domain == 101u) { domains |= 1u; }
      if (domain == 202u) { domains |= 2u; }
    }
    if ((domains & 1u) == 0u || (PAIR+1u >= SECOND_LEVEL && domains != ${sharedDomain ? 1 : 3}u)) { fail(4u); }
  }
  if (parent[2] != 3u) { return; }
  if (i < count) {
    atomicAdd(&receipt[3], 1u);
    let key = parent[48]+i*4u;
    if (parent[key] >= parent[19] || (parent[key+1u] != ${phaseId}u && parent[key+1u] != ${secondPhaseId}u) || (parent[key+2u] != ${materialId}u && parent[key+2u] != ${secondMaterialId}u)) { fail(32u); }
    if (${fluid} && parent[key+3u] == 0u) { atomicAdd(&receipt[4], 1u); }
    else if (parent[key+3u] == 101u) { atomicAdd(&receipt[4], 1u); }
    else if (parent[key+3u] == 202u) { atomicAdd(&receipt[5], 1u); }
    else { fail(32u); }
  }
  if (i < sourceCount) {
    atomicAdd(&receipt[2], 1u);
    let begin = parent[parent[51]+i];
    let end = parent[parent[51]+i+1u];
    if (end <= begin || end-begin > 8u || end > parent[38]
        || end-begin != parent[parent[50]+i]) { fail(2u); return; }
    let key = sourceKeys+i*4u;
    var weight = 0.0;
    var moment = vec3<f32>(0.0);
    for (var edge=begin; edge<end; edge++) {
      let destination = parent[parent[52]+edge];
      let w = bitcast<f32>(parent[parent[53]+edge]);
      if (destination >= count || !(w > 0.0) || !(w <= 1.0)) { fail(256u); continue; }
      let targetKey = parent[48]+destination*4u;
      for (var c=1u; c<4u; c++) {
        if (parent[targetKey+c] != source[key+c]) { fail(32u); }
      }
      weight += w;
      moment += w * position(parent[targetKey], vec3<u32>(parent[23],parent[24],parent[25]), parent[27], bitcast<f32>(parent[29]));
      atomicAdd(&receipt[6], 1u);
    }
    let origin = position(source[key], vec3<u32>(parent[20],parent[21],parent[22]), parent[26], bitcast<f32>(parent[28]));
    if (!(abs(weight-1.0) <= 0.000002)) { fail(8u); }
    if (!all(abs(moment-origin) <= vec3<f32>(0.00002))) { fail(16u); }
  }
  if (i < coarse[34]) {
    atomicAdd(&receipt[7], 1u);
    let destination = parent[parent[54]+i];
    if (destination >= count) { fail(64u); return; }
    for (var c=0u; c<4u; c++) {
      if (parent[parent[48]+destination*4u+c] != coarse[coarse[26]+i*4u+c]) { fail(64u); }
    }
  }
}`;
}

function encodeReceipt(device, encoder, code, buffers, count = 1) {
  const module = device.createShaderModule({ code });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'check' } });
  const bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindings);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
}

async function readReceipt(device, encoder, receipt, readback) {
  encoder.copyBufferToBuffer(receipt, 0, readback, 0, RECEIPT_BYTES);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const words = Array.from(new Uint32Array(readback.getMappedRange()));
  readback.unmap();
  return words;
}

async function rejectBadTopology(device, generation, kind, receipt, readback) {
  const pair = generation.mechanicsAdjacentLevelPairs[1];
  const previous = generation.mechanicsAdjacentLevelPairs[0].parentFieldView;
  const parent = pair.parentFieldView;
  const runtime = createSchroederSpatialParentFieldViewGpu(device, {
    fineGrid: parent.fineGrid, coarseGrid: parent.coarseGrid,
    fineFieldCapacity: previous.parentFieldCapacity, coarseFieldCapacity: parent.coarseFieldCapacity,
    parentFieldCapacityLimit: kind === 'capacity' ? 1 : 54, arenaCount: 1
  });
  const encoder = device.createCommandEncoder();
  if (kind === 'stale-source') {
    device.queue.writeBuffer(previous.parentFieldViewBuffer, 12, new Uint32Array([previous.generationId + 1]));
  }
  const execution = runtime.encode(encoder, {
    mechanicsFieldViews: parent.mechanicsFieldViews, hierarchyView: pair.hierarchyView,
    inheritedFineParentView: previous
  });
  encoder.clearBuffer(receipt);
  encodeReceipt(device, encoder, /* wgsl */ `
    @group(0) @binding(0) var<storage, read> parent: array<u32>;
    @group(0) @binding(1) var<storage, read_write> receipt: array<atomic<u32>>;
    @compute @workgroup_size(1) fn check() {
      var error = 0u;
      if ((parent[2] & 4u) == 0u || (parent[2] & 2u) != 0u) { error |= 1u; }
      if (${kind === 'capacity'} && (parent[2] & 16u) == 0u) { error |= 2u; }
      for (var start=60u; start<=68u; start+=4u) {
        if (parent[start] != 0u || parent[start+1u] != 0u || parent[start+2u] != 0u) { error |= 4u; }
      }
      atomicStore(&receipt[0], error); atomicStore(&receipt[1], 1u);
      atomicStore(&receipt[2], parent[2]); atomicStore(&receipt[3], parent[78]);
    }`, [execution.parentFieldViewBuffer, receipt]);
  const pending = readReceipt(device, encoder, receipt, readback);
  runtime.markExecutionSubmitted(execution);
  const words = await pending;
  if (kind === 'stale-source') {
    device.queue.writeBuffer(previous.parentFieldViewBuffer, 12, new Uint32Array([previous.generationId]));
  }
  await runtime.releaseExecutionAfter(execution, device.queue.onSubmittedWorkDone());
  runtime.destroy();
  return { kind, words };
}

function compositeInvariantShader(inherited, last) {
  return /* wgsl */ `
  @group(0) @binding(0) var<storage, read> source: array<u32>;
  @group(0) @binding(1) var<storage, read> native: array<u32>;
  @group(0) @binding(2) var<storage, read> composite: array<u32>;
  @group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
  fn kinetic(m: f32, p: vec3<f32>) -> f32 { if (m > 0.0) { return dot(p,p)/(2.0*m); } return 0.0; }
  @compute @workgroup_size(1) fn check() {
    var error=0u;
    if (composite[0] != 0x53434d31u || composite[1] != 1u || composite[2] != 3u || composite[27] != 0u) { error |= 1u; }
    var expected: array<f32,8>; var fine: array<f32,8>;
    var baseline: array<f32,8>; var combined: array<f32,8>;
    let sourceCount = select(source[34],source[17],${inherited});
    let sourceOffset = select(source[30],source[32],${inherited});
    for (var i=0u; i<sourceCount; i++) {
      let s=sourceOffset+i*8u;
      for (var w=0u; w<7u; w++) { fine[w] += bitcast<f32>(source[s+w]); }
      if (${inherited}) { fine[7] += bitcast<f32>(source[s+7u]); }
      else { fine[7] += kinetic(bitcast<f32>(source[s]),vec3<f32>(bitcast<f32>(source[s+1u]),bitcast<f32>(source[s+2u]),bitcast<f32>(source[s+3u]))); }
    }
    expected=fine;
    for (var i=0u; i<native[34]; i++) {
      let s=native[30]+i*8u;
      for (var w=0u; w<7u; w++) { expected[w] += bitcast<f32>(native[s+w]); }
      expected[7] += kinetic(bitcast<f32>(native[s]),vec3<f32>(bitcast<f32>(native[s+1u]),bitcast<f32>(native[s+2u]),bitcast<f32>(native[s+3u])));
    }
    var representedKinetic=0.0;
    for (var i=0u; i<composite[17]; i++) {
      let b=composite[19]+i*8u; let c=composite[32]+i*8u;
      for (var w=0u; w<8u; w++) { baseline[w] += bitcast<f32>(composite[b+w]); combined[w] += bitcast<f32>(composite[c+w]); }
      representedKinetic += kinetic(bitcast<f32>(composite[c]),vec3<f32>(bitcast<f32>(composite[c+1u]),bitcast<f32>(composite[c+2u]),bitcast<f32>(composite[c+3u])));
    }
    for (var w=0u; w<8u; w++) {
      if (!(abs(fine[w]-baseline[w]) <= 0.00001*max(1.0,abs(fine[w])))
        || !(abs(expected[w]-combined[w]) <= 0.00001*max(1.0,abs(expected[w])))) { error |= 2u; }
    }
    if (representedKinetic > combined[7]+0.00001*max(1.0,combined[7])) { error |= 4u; }
    atomicOr(&receipt[0],error); atomicAdd(&receipt[1],1u);
    atomicOr(&receipt[2],composite[27]); atomicOr(&receipt[3],composite[2]);
    if (${last}) {
      for (var w=0u; w<8u; w++) { atomicStore(&receipt[8u+w],bitcast<u32>(combined[w])); }
      atomicStore(&receipt[16],bitcast<u32>(representedKinetic));
    }
  }`;
}

function correctionInvariantShader(last, forceCase, gravity, dt) {
  return /* wgsl */ `
  @group(0) @binding(0) var<storage,read> control:array<u32>;
  @group(0) @binding(1) var<storage,read> top_before:array<u32>;
  @group(0) @binding(2) var<storage,read> top_after:array<u32>;
  @group(0) @binding(3) var<storage,read> original:array<u32>;
  @group(0) @binding(4) var<storage,read> output:array<u32>;
  @group(0) @binding(5) var<storage,read_write> receipt:array<u32>;
  fn kinetic(m:f32,p:vec3<f32>)->f32 { if(m>0.0) { return dot(p,p)/(2.0*m); } return 0.0; }
  fn add(word:u32,value:f32) { receipt[word]=bitcast<u32>(bitcast<f32>(receipt[word])+value); }
  fn close(a:f32,b:f32)->bool { return abs(a-b)<=0.00005*max(1.0,max(abs(a),abs(b))); }
  @compute @workgroup_size(1) fn check() {
    var error=0u;
    if(control[0]!=0x53435331u || control[2]!=3u || control[18]!=0u
      || output[0]!=0x534d4331u || output[2]!=3u || output[27]!=0u || output[17]!=original[34]) { error|=1u; }
    receipt[1]+=1u;receipt[2]=control[2];receipt[3]=control[18];
    for(var i=0u;i<original[34];i++) {
      let a=original[30]+i*8u;let b=64u+i*8u;let mass=bitcast<f32>(original[a]);
      let before=vec3<f32>(bitcast<f32>(original[a+1u]),bitcast<f32>(original[a+2u]),bitcast<f32>(original[a+3u]));
      let after=vec3<f32>(bitcast<f32>(output[b+1u]),bitcast<f32>(output[b+2u]),bitcast<f32>(output[b+3u]));
      let budget=bitcast<f32>(output[b+7u]);let represented=kinetic(mass,after);let oldK=kinetic(mass,before);
      if(output[b]!=original[a]) { error|=2u; }
      for(var w=4u;w<=6u;w++) { if(output[b+w]!=original[a+w]) { error|=2u; } }
      for(var w=0u;w<8u;w++) {
        let value=bitcast<f32>(output[b+w]);if((bitcast<u32>(value)&0x7f800000u)==0x7f800000u) { error|=4u; }
        add(8u+w,value);if(w<7u) { add(16u+w,bitcast<f32>(original[a+w])); } else { add(23u,oldK); }
      }
      add(24u,represented);
      if(represented>budget+0.00001*max(1.0,abs(budget))) { error|=8u; }
      if(${forceCase === 'off' || forceCase === 'gravity'}) {
        let dv=vec3<f32>(${gravity.map(v=>Number(v).toFixed(9)).join(',')})*${Number(dt).toFixed(9)};
        let expected=before+mass*dv;
        for(var axis=0u;axis<3u;axis++) { if(!close(after[axis],expected[axis])) { error|=16u; } }
        if(!close(budget,oldK+dot(before,dv)+0.5*mass*dot(dv,dv))) { error|=16u; }
      }
    }
    if(${last}) {
      var total:array<f32,8>;var initialBudget=0.0;
      for(var i=0u;i<top_after[17];i++) {
        for(var w=0u;w<8u;w++) { total[w]+=bitcast<f32>(top_after[64u+i*8u+w]); }
        initialBudget+=bitcast<f32>(top_before[top_before[32]+i*8u+7u]);
      }
      for(var w=0u;w<8u;w++) { if(!close(bitcast<f32>(receipt[8u+w]),total[w])) { error|=32u; } }
      if(!close(bitcast<f32>(receipt[8]),bitcast<f32>(receipt[16]))) { error|=64u; }
      if(${forceCase !== 'gravity'}) {
        if(!close(total[7],initialBudget)) { error|=64u; }
      }
      if(${forceCase !== 'walls'}) {
        let dv=vec3<f32>(${gravity.map(v=>Number(v).toFixed(9)).join(',')})*${Number(dt).toFixed(9)};
        for(var axis=0u;axis<3u;axis++) {
          if(!close(total[axis+1u],bitcast<f32>(receipt[17u+axis])+bitcast<f32>(receipt[16])*dv[axis])) { error|=64u; }
        }
      }
      receipt[25]=bitcast<u32>(initialBudget);receipt[26]=bitcast<u32>(total[7]);
    }
    receipt[0]|=error;
  }`;
}

export async function runLevelChainNative(levelCount, { composite = false, fluid = false, forceCase = null, publish = false, particles = false, exact = false, particleFault = false, closure = false, closureFault = false, ledger = false, thermalPair = false, phaseTransfer = false, reaction = false, refinement = false, refinementLegacy = false, parcels = false, finiteWalls = false, clockExhausted = false, privateContinuation = false, privateSteps = 0, privatePublish = false, dtSeconds = null, continuationRejected = false, privateWallFault = false, privateReactionFault = false, privateReactionCarry = false, privateInventoryFault = false, continuationRejectedAfter = null, continuationRejectionMask = 1, phaseLineageCapacity = null, privatePressure = null, privatePressureRejected = false, privateNativeTransport = false, privateSurface = false } = {}) {
  const reactionRejected=finiteWalls==='legacy' || finiteWalls==='underflow' || parcels==='stokes' || reaction==='no-spares' || reaction==='no-lineages' || refinementLegacy || refinement==='duplicate-spare';
  const explicitRefinement=(refinement || parcels) && !refinementLegacy;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return { fatal: 'WebGPU adapter unavailable' };
  const device = await adapter.requestDevice(composite ? {
    requiredLimits: { maxStorageBuffersPerShaderStage: Math.min(closure ? 13 : 12, adapter.limits.maxStorageBuffersPerShaderStage) }
  } : {});
  const errors = [];
  device.addEventListener('uncapturederror', event => errors.push(event.error.message));
  const owned = [];
  const makeBuffer = (label, size, usage) => {
    const buffer = tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
    owned.push(buffer); return buffer;
  };
  let generation, transaction, compositeRuntime, compositeExecution;
  let exactUploads = null;
  const cycles = [], negatives = [];
  let closureModule, thermalMaterialTable, mechanicsMaterialTable, privateMechanicsMaterialTable, thermalRunner, responseUpload, destroyResponse, energyAt, initialEnergy = 1, initialTemperature = 300, materialId = 26, molarMass = 0.055845;
  const materialKey = reaction ? 'h2' : typeof phaseTransfer === 'string' ? 'h2o' : 'fe';
  let reactionTable=null, reactionMaterials=null, liquidEnergy=0, waterReferenceU0=0;
  if (closure) {
    closureModule = await import('../../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js');
    const { createReferenceMaterialClosures } = await import('../../src/runtime/material/materialClosures.js');
    const { specificInternalEnergyJPerKg } = await import('../../src/runtime/material/thermoState.js');
    const thermalModule = await import('../../src/runtime/sph/sphThermalGpuKernel.js');
    const { buildSphThermalMaterialTable } = thermalModule;
    thermalRunner = thermalModule.runSphThermalStepWebGpu;
    const { buildMlsMpmMechanicsMaterialTable } = await import('../../src/runtime/sph/sphMechanicsMaterialTable.js');
    const references=createReferenceMaterialClosures();
    const {withRoomAirCaloricReference}=await import('../../src/runtime/material/roomAirCaloricReference.js');
    const props = Object.fromEntries((reaction ? ['h2','o2','h2o'] : [materialKey]).map(key=>[key,
      (explicitRefinement && (!reaction || key!=='h2o') ? withRoomAirCaloricReference(references[key],key) : references[key]).properties]));
    if(finiteWalls) {
      // Explicit manufactured conductivity; the caloric reference fixtures do
      // not declare transport coefficients. This is a conservation input,
      // not a measured material-property or live-preset acceptance claim.
      for(const [key,value] of Object.entries(props)) props[key]={...value,phases:value.phases.map(phase=>({...phase,
        thermalConductivityWPerMK:8,thermalConductivityProvenance:{source:'manufactured-native-wall-conservation'}}))};
    }
    if(privateSurface) {
      // Explicit manufactured surface coefficient. The caloric fixtures do not
      // declare one; preserve their caloric/elastic laws and test composition.
      for(const [key,value] of Object.entries(props)) props[key]={...value,
        phases:value.phases.map(phase=>({...phase,
          surfaceTensionNPerM:phase.name==='liquid'?0.072:0}))};
    }
    thermalMaterialTable = buildSphThermalMaterialTable(props);
    mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(props);
    privateMechanicsMaterialTable = privateSurface
      ? buildMlsMpmMechanicsMaterialTable(props,{surfaceTensionEnabled:privateSurface!=='off'})
      : mechanicsMaterialTable;
    energyAt = temperature => specificInternalEnergyJPerKg(props[materialKey], temperature);
    initialEnergy = energyAt(300);
    materialId=thermalMaterialTable.segmentMetadata[0].materialId;
    molarMass=props[materialKey].molarMassKgPerMol;
    if (phaseTransfer && !reaction && !explicitRefinement) {
      const plateau=thermalMaterialTable.segmentMetadata.find(s=>s.type==='plateau' && s.from===(phaseTransfer==='boiling' ? 'liquid' : 'solid') && s.to===(phaseTransfer==='boiling' ? 'gas' : 'liquid'));
      if(!plateau) throw new Error('Manufactured phase transfer requires a real phase plateau');
      initialEnergy=(plateau.eStart+plateau.eEnd)/2;initialTemperature=plateau.temperatureK;
    }
if(explicitRefinement) {
      const gas=thermalMaterialTable.segmentMetadata.find(s=>s.phase==='gas' && s.materialId===materialId);
      if(!gas) throw new Error('Refinement requires explicit cold gas caloric inputs');
      initialEnergy=gas.eStart+(300-gas.tLo)*(gas.eEnd-gas.eStart)/(gas.tHi-gas.tLo);
    }
    if(parcels) {
      const l=thermalMaterialTable.segmentMetadata.find(s=>s.phase==='liquid' && s.materialId===materialId);
      liquidEnergy=l.eStart+(300-l.tLo)*(l.eEnd-l.eStart)/(l.tHi-l.tLo);
      waterReferenceU0=l.eStart+(273.15-l.tLo)*(l.eEnd-l.eStart)/(l.tHi-l.tLo);
    }
    if(reaction) {
      const {buildSphReactionTable}=await import('../../src/runtime/sph/sphReactionGpuKernel.js');
      const {stableOpticalMaterialId}=await import('../../src/runtime/material/opticalGpuBuffers.js');
      reactionMaterials=Object.fromEntries(Object.entries(props).map(([key,properties])=>[key,{
        id:stableOpticalMaterialId(key),molarMass:properties.molarMassKgPerMol,
        energy:explicitRefinement && properties.phaseCaloricModel ? (()=>{
          const g=thermalMaterialTable.segmentMetadata.find(s=>s.phase==='gas' && s.materialId===stableOpticalMaterialId(key));
          return g.eStart+(300-g.tLo)*(g.eEnd-g.eStart)/(g.tHi-g.tLo);
        })() : specificInternalEnergyJPerKg(properties,300)}]));
      materialId=reactionMaterials.h2.id;
      // A manufactured heat-proxy interval using the real H2/O2/H2O caloric
      // tables and 2 H2 + O2 -> 2 H2O stoichiometry. This is a conservation and
      // composition test, not a measured reaction-rate or enthalpy claim.
      reactionTable=buildSphReactionTable([{a:'h2',b:'o2',product:'h2o',activationTemperatureK:0,
        specificEnthalpyJPerKg:-100000,phaseRequirements:{h2:['gas'],o2:['gas']},
        stoichiometry:{reactants:[{material:'h2',formula:'H2',coefficient:2},{material:'o2',formula:'O2',coefficient:1}],
          products:[{material:'h2o',formula:'H2O',coefficient:2,phase:'liquid'}]}}],
        {materialProperties:props,...(explicitRefinement?{thermalMaterialTable}:{}),contactRadiusM:0.15});
      if(reactionTable.reactionCount!==1) throw new Error('Missing manufactured reaction');
    }
    if (ledger) {
      const graphSet = thermalModule.buildSphThermalClosureGraphBuffers(thermalMaterialTable);
      responseUpload = thermalModule.uploadSphThermalResponseGraphBuffers(device, {
        thermalMaterialTable, thermalClosureGraphSet: graphSet, thermalClosureGraphBank: graphSet.graphBank,
        thermalPhaseResponseTable: thermalModule.buildSphThermalPhaseResponseTable(thermalMaterialTable, graphSet)
      });
      destroyResponse = () => thermalModule.destroySphThermalResponseGraphBuffers(responseUpload);
    }
  }
  let clonedPredecessorRejected = false;
  try {
    const phaseLineages=phaseLineageCapacity ?? (refinement ? (reaction ? 6 : 4) : reaction && reaction!=='no-lineages' ? 4 : 2);
    const particleCount=phaseTransfer ? phaseLineages*4 : reaction && reaction!=='no-spares' ? 8 : 2;
    const phaseCarrierPlan=phaseTransfer ? { schema:'peercompute.ulg.sph-phase-carrier-plan.v2',
      status:'phase-lane-capacity-ready',stableLaneAddress:'phaseLane*phaseLaneStride+lineageIndex',
      lineageCapacity:phaseLineages,primaryCapacity:phaseLineages,phaseLaneCount:4,
      phaseLaneStride:phaseLineages,companionStart:phaseLineages,companionCapacity:phaseLineages*3,particleCapacity:phaseLineages*4,
      ...(refinement ? {splitSpareReserve:{schema:'peercompute.ulg.schroeder-split-spare-reserve.v1',
        firstLineageIndex:phaseLineages-2,count:2,firstContinuityDomainId:102}} : {}) } : null;
    const identities = Array.from({length:particleCount},(_,i)=>thermalPair ? 101 : i%2 ? 202 : 101);
    const rows = new Float32Array(particleCount*16);
    const state = new Float32Array(particleCount*8);
    const mechanics = new Float32Array(particleCount*32);
    const thermo = new Float32Array(particleCount*12);
    for (let i=0; i<particleCount; i++) {
      const level = i%2 ? Math.min(2, levelCount-1) : 0;
      rows.set([level, 0.5 * 2**level, 1, 0.001, 0.001, 0.001, 1, 1000,
        (reaction || explicitRefinement) ? 3 : fluid ? 2 : 1, reaction ? reactionMaterials[i%2 ? 'o2' : 'h2'].id : materialId, 1, 0.15, 8.25, 8.25, 8.25, 0], i*16);
      state.set([8.25, 8.25, 8.25, 1, 0, 0, 0, reaction ? reactionMaterials[i%2 ? 'o2':'h2'].energy : initialEnergy], i*8);
      // Separate approaching domains so their mass-gradient normals differ.
      // Coincident distributions have no contact normal and should not collide.
      if (forceCase==='contact' && i===1) { rows[i*16+12]=9.25;state[i*8]=9.25; }
      if (thermalPair && i===1) { rows[i*16+12]=8.30; state[i*8]=8.30; state[i*8+7]=energyAt(600); }
      if (composite) state.set(i ? [-2,0.5,1] : [1,-0.75,0.25], i*8+4);
      mechanics.set([1,0,0,0,1,0,0,0,1], i*32);
      mechanics[i*32+18] = 1;
      mechanics[i*32+19] = 0.001;
      if (composite) mechanics[i*32+9] = 0.5;
      for (const word of [20,21,27,31]) mechanics[i*32+word] = 1;
      thermo.set([reaction ? reactionMaterials[i%2 ? 'o2':'h2'].id : materialId,(reaction || explicitRefinement) ? 3 : 1,thermalPair && i===1 ? 600 : initialTemperature,1000,1,0,0,0,0.5,1,1,0.1], i*12);
      if(explicitRefinement) thermo.set([0,0,1,0],i*12+4);
      if(i>=2) {
        state[i*8+3]=0;rows[i*16+6]=0;
        for(const w of [2,3,4,5]) rows[i*16+w]=0;
        mechanics[i*32+19]=0;mechanics[i*32+31]=0;
        if(phaseCarrierPlan && i>=phaseLineages) {
          thermo[i*12+10]=254;mechanics[i*32+21]=254;mechanics[i*32+27]=254;
        }
      }
    }
    if(parcels==='carrier') {
      rows[16+8]=2;state[8+7]=liquidEnergy;thermo[12+1]=2;thermo.set([0,1,0,0],12+4);
    }
    if(privatePressure!=null) {
      // The older mechanics fixture used one placeholder entity per carrier.
      // Actual EOS pressure needs the physical cold inventory m / M * N_A.
      // This seeds initial data only; evolving inventories stay on the GPU.
      for(let i=0;i<particleCount;i++) thermo[i*12+9]=state[i*8+3]/molarMass*6.02214076e23;
    }
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    const assignmentBuffer = makeBuffer('chain assignments', rows.byteLength, usage);
    let sourceStateBuffer = makeBuffer('chain state', state.byteLength, usage);
    let particleIdentityBuffer = makeBuffer('chain identities', particleCount*4, usage);
    let sourceMechanicsBuffer = makeBuffer('chain raw mechanics', mechanics.byteLength, usage);
    let sourceThermoBuffer = makeBuffer('chain thermo', thermo.byteLength, usage);
    device.queue.writeBuffer(assignmentBuffer, 0, rows);
    device.queue.writeBuffer(sourceStateBuffer, 0, state);
    device.queue.writeBuffer(particleIdentityBuffer, 0, new Uint32Array(identities));
    device.queue.writeBuffer(sourceMechanicsBuffer, 0, mechanics);
    device.queue.writeBuffer(sourceThermoBuffer, 0, thermo);
    const levelAssignment = {
      schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
      status: 'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
      particleCount, assignmentStrideFloats: 16, assignments: rows,
      assignmentBuffer, assignmentBufferByteLength: rows.byteLength,
      sourceStateBuffer, sourceStateBufferBorrowed: true,
      sourceMechanicsBuffer, sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength: mechanics.byteLength,
      storageGeneration: 1, physicsTick: 0, physicsSubstep: 0, positionEpoch: 0,
      topologyEpoch: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0,
      minLevel: 0, maxLevel: levelCount-1, chartId: 0, baseGridSpacingM: 0.5
    };
    const mechanicsLevels = Array.from({ length: levelCount }, (_, selectedLevel) => {
      const gridSpacingM = 0.5 * 2**selectedLevel;
      const n = Math.max(1, Math.ceil(32 / gridSpacingM)) + (composite ? 5 : 3);
      return { selectedLevel, mechanicsGrid: {
        gridNodeCount: n**3, gridDims: [n,n,n], gridShift: 1, gridSpacingM, boxDimsM:[32,32,32]
      } };
    });
    const receipt = makeBuffer('chain fixed GPU receipt', RECEIPT_BYTES, usage);
    const readback = makeBuffer('chain fixed readback', RECEIPT_BYTES, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    let sphParticleUpload = { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded', particleCount,
      stateStrideBytes: 32, thermoStrideBytes: 48, identityStrideBytes: 4,
      stateBufferByteLength: state.byteLength, thermoBufferByteLength: thermo.byteLength, identityBufferByteLength: particleCount*4,
      phaseCarrierPlan,
      stateBuffer: sourceStateBuffer, thermoBuffer: sourceThermoBuffer,
      identityBuffer: particleIdentityBuffer,
      storageGeneration: 1, physicsTick: 0, physicsSubstep: 0, positionEpoch: 0,
      topologyEpoch: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0 };
    let mlsMpmParticleUpload = { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded', storageGeneration: 1, particleCount, mechanicsStrideBytes: 128,
      mechanicsBufferByteLength: mechanics.byteLength, mechanicsBuffer: sourceMechanicsBuffer };
    const baselineColdUpload = sphParticleUpload;
    const baselineColdState = { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount,
      state: state.slice(), thermo: thermo.slice() };
    if (exact) {
      // Genuine cold upload, including mass below one f32 ulp. No continuing
      // inventory is seeded from hot physical projections.
      const packed={schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount,state,thermo,phaseCarrierPlan,
        identity:new Uint32Array(identities),topologyEpoch:0,identityRevision:'chain-cold-v1',storageGeneration:1,
        physicsTick:0,physicsSubstep:0,positionEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0,
        stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,
        metadata:identities.map((id,i)=>({id:`chain-${id}`,material:reaction ? (i%2 ? 'o2':'h2') : materialKey,materialId:reaction ? reactionMaterials[i%2 ? 'o2':'h2'].id : materialId,phaseId:(reaction || explicitRefinement) ? 3 : 1,
          renderDomainId:id,initialPhaseReferenceMatchesMass:true,
          molarMassBits:new Uint32Array(new Float32Array([reaction ? reactionMaterials[i%2 ? 'o2':'h2'].molarMass : molarMass]).buffer)[0]}))};
      const seed=prepareSphExactParticleMassSeed({particles:Array.from({length:particleCount},(_,i)=>({massKg:i<2 ? 1+2**-30 : 0}))},
        {format:createSphExactMassFormat(),reference:'cold multilevel particle invariant',initialQuantities:!ledger,energyLedger:ledger});
      if(parcels) {
        const radius=parcels==='stokes' ? 1e-3 : 5e-8, multiplicity=parcels==='stokes' ? 1 : 1e12;
        const dryMass=Math.fround(1770*4/3*Math.PI*radius**3*multiplicity);
        packed.ledgerParcels={schema:'peercompute.ulg.sph-ledger-parcels.v1',
          cellsPerAxis:parcels==='wall'?1:8,boxDimensionsM:[32,32,32],vaporMaterialId:materialId,pressurePa:101325,waterReferenceU0,
          parcels:[{x:parcels==='wall' ? [0.00001,8.25,8.25] : parcels==='carrier' ? [8.25,8.25,8.25] : [9,9,9],
            multiplicity,densityKgPerM3:1770,hygroscopicity:.61,dryRadiusM:radius,
            dryMassWords:Array.from(encodeSphExactMass(dryMass,seed.format))}]};
      }
      bindSphExactParticleMassSeed(packed,seed);
      sphParticleUpload=uploadSphGpuParticleBuffers(device,packed);
      mlsMpmParticleUpload=uploadMlsMpmGpuParticleBuffers(device,{
        schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,particleCount,mechanics,phaseCarrierPlan,mechanicsStrideBytes:128,
        topologyEpoch:0,storageGeneration:1,physicsTick:0,physicsSubstep:0,positionEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0});
      exactUploads=[sphParticleUpload,mlsMpmParticleUpload];
      sourceStateBuffer=sphParticleUpload.stateBuffer;sourceThermoBuffer=sphParticleUpload.thermoBuffer;
      particleIdentityBuffer=sphParticleUpload.identityBuffer;sourceMechanicsBuffer=mlsMpmParticleUpload.mechanicsBuffer;
      Object.assign(levelAssignment,{sourceStateBuffer,sourceMechanicsBuffer});
    }
    const parcelSnapshot={};
    if(parcels) {
      const source=sphGpuParticleUploadLedgerParcels(sphParticleUpload),enc=device.createCommandEncoder();
      for(const key of ['paramsBuffer','ledgerBuffer','sinkBuffer']) {
        parcelSnapshot[key]=makeBuffer(`source parcel snapshot ${key}`,source[key].size,usage);
        enc.copyBufferToBuffer(source[key],0,parcelSnapshot[key],0,source[key].size);
      }
      device.queue.submit([enc.finish()]);
    }
    const forceInputs=forceCase ? {
      dt:forceCase==='cfl' ? 0.5 : dtSeconds ?? 0.001,gravityMPerS2:forceCase==='gravity' ? [0.25,-9.81,0.125] : [0,0,0],
      boxDimsM:finiteWalls?[thermalPair?8.31:8.26,8.26,8.26]:[32,32,32],wallsEnabled:forceCase==='walls',contactEnabled:forceCase==='contact',
      cflFactor:0.4,wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001
    } : null;
    for (let cycle=0; cycle<2; cycle++) {
      generation = runSchroederSpatialEpochGenerationWebGpu({ device, levelAssignment,
        particleCount, particleIdentityBuffer, particleIdentityStrideWords: 1, mechanicsLevels });
      if (!generation.ready) throw new Error(`Generation rejected: ${generation.reason}`);
      const pairs = generation.mechanicsAdjacentLevelPairs;
      const encoder = device.createCommandEncoder();
      encoder.clearBuffer(receipt);
      for (const [i, pair] of pairs.entries()) {
        const p = pair.parentFieldView;
        const source = i ? pairs[i-1].parentFieldView.parentFieldViewBuffer : p.fineFieldView.fieldViewBuffer;
        encodeReceipt(device, encoder, invariantShader(i, levelCount, fluid, thermalPair, materialId,reaction ? reactionMaterials.o2.id : materialId,(reaction || explicitRefinement) ? 3 : fluid ? 2 : 1,parcels==='carrier'?2:undefined),
          [p.parentFieldViewBuffer, source, p.coarseFieldView.fieldViewBuffer, receipt],
          Math.max(p.parentFieldCapacity, p.fineFieldCapacity, p.coarseFieldCapacity));
      }
      encoder.clearBuffer(receipt, 28*4, 4*4);
      for (const view of generation.mechanicsLevelViews) {
        encodeReceipt(device, encoder, /* wgsl */ `
          @group(0) @binding(0) var<storage, read> moment: array<u32>;
          @group(0) @binding(1) var<storage, read> phase: array<u32>;
          @group(0) @binding(2) var<storage, read> field: array<u32>;
          @group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
          @compute @workgroup_size(1) fn check() {
            var error = 0u;
            if (moment[0] != 0x53505631u || moment[1] != 1u || moment[2] != 3u
              || phase[0] != 0x53505652u || phase[1] != 2u || phase[2] != 3u
              || moment[18] != field[34] || phase[18] != field[34]
              || moment[20] != field[17] || phase[21] != field[17]) { error |= 1u; }
            for (var word=3u; word<=15u; word++) {
              if (moment[word] != field[word] || phase[word] != field[word]) { error |= 2u; }
            }
            for (var word=41u; word<=46u; word++) { if (phase[word] != 0u) { error |= 4u; } }
            if (error != 0u) { atomicOr(&receipt[0], 512u); }
            atomicAdd(&receipt[28], 1u); atomicOr(&receipt[29], moment[2]);
            atomicOr(&receipt[30], phase[2]); atomicAdd(&receipt[31], phase[47]);
          }`, [view.phaseVolumeMoment.controlBuffer, view.phaseVolumeReceipt.controlBuffer,
            view.mechanicsFieldView.fieldViewBuffer, receipt]);
      }
      const words = await readReceipt(device, encoder, receipt, readback);
      transaction = createSchroederSpatialEpochTransaction({ device, generation,
        sphParticleUpload, mlsMpmParticleUpload, mechanicsChainAuthoritative: true,
        ...(ledger ? { enabledConsumerReaderIds: SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(c=>c.consumerId),
          consumerSupportProfileIds: Object.fromEntries(SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(c=>[c.consumerId,c.supportProfileId])) } : {}) });
      const authorityOptions = { device, generation };
      let beforeP2gRejected = false;
      try { resolveSchroederSpatialMechanicsChainAuthority(transaction, authorityOptions); }
      catch (error) { beforeP2gRejected = error.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_LIFECYCLE'; }
      const readerInputs = { generation, sphParticleUpload, mlsMpmParticleUpload };
      admitSchroederSpatialEpochTransactionReader(transaction, { ...readerInputs,
        readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION });
      const chain = resolveSchroederSpatialMechanicsChainAuthority(transaction, authorityOptions);
      const chainAuthenticated = chain.mechanicsLevelViews.length === levelCount
        && chain.pairAuthorities.length === levelCount-1
        && chain.pairAuthorities.every((p,i) => p.parentFieldView === pairs[i].parentFieldView);
      let compositeWords = null, compositeNegativeWords = null, correctionWords = null;
      let publicationWords = null, particleWords = null, closureWords = null, privateWords = null, continuationWords = null, wallContinuationWords = null, reactionContinuationWords = null, pressureContinuation = null;
      let unprojectedRejected = false, cloneRejected = false, backpressureRejected = false;
      const producerChecks = {};
      if (composite) {
        compositeRuntime ??= createSchroederSpatialCompositeMechanicsGpu(device, {
          parentFieldCapacities: pairs.map(p => p.parentFieldView.parentFieldCapacity), arenaCount: 1,
          nativeFieldCapacities:forceCase ? generation.mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity) : null
        });
        try { compositeRuntime.encode(device.createCommandEncoder(), { transaction }); }
        catch (error) { unprojectedRejected = /P2G momentum/.test(error.message); }
        const p2gProjections = [];
        for (const spec of mechanicsLevels) {
          p2gProjections.push(await runMlsMpmP2gGridProjectionWebGpu({ device,
            sphParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount },
            mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount },
            sphParticleUpload, mlsMpmParticleUpload,
            schroederSpatialEpochGeneration: generation, canonicalSpatialRequired: true,
            schroederSelectedLevel: spec.selectedLevel, mechanicsFieldMode: 'required',
            pressureCrossLevelConsumerRequired: forceCase==='missing-pressure',
            gridSpacingM: spec.mechanicsGrid.gridSpacingM, boxDimsM: [32,32,32],
            dt: forceInputs?.dt ?? 0.001, internalPressureScale: 0, readbackMode: 'no-full-readback' }));
        }
        if (forceInputs) {
          const reject = (name, projections, forces = forceInputs) => {
            try { compositeRuntime.encode(device.createCommandEncoder(), {
              transaction, forceInputs: forces, p2gProjections: projections
            }); producerChecks[name] = false; }
            catch (error) { producerChecks[name] = /exact submitted native P2G/.test(error.message); }
            if (!producerChecks[name]) throw new Error(`Native producer admission failed: ${name}`);
          };
          reject('missing', null);
          reject('incomplete', p2gProjections.slice(1));
          reject('cloned', p2gProjections.map(p => ({...p})));
          reject('reordered', [...p2gProjections].reverse());
          reject('wrongDt', p2gProjections, {...forceInputs, dt: forceInputs.dt * 2});
          const p = p2gProjections[0], pressure = p.internalPressureScale;
          p.internalPressureScale = 0.25;
          reject('changedPressure', p2gProjections); p.internalPressureScale = pressure;
          const n = p.gridDims[0]; p.gridDims[0]++;
          reject('changedGrid', p2gProjections); p.gridDims[0] = n;
          const originalState = sphParticleUpload.stateBuffer;
          sphParticleUpload.stateBuffer = sourceThermoBuffer;
          reject('reboundSource', p2gProjections); sphParticleUpload.stateBuffer = originalState;
        }
        try { compositeRuntime.encode(device.createCommandEncoder(), { transaction: { ...transaction } }); }
        catch { cloneRejected = true; }
        const combinedEncoder = device.createCommandEncoder();
        compositeExecution = compositeRuntime.encode(combinedEncoder, { transaction, forceInputs, p2gProjections });
        if (forceInputs) {
          const p = p2gProjections[0], dt = p.dt;
          p.dt *= 2;
          producerChecks.changedAfterEncode = !compositeRuntime.ownsExecution(compositeExecution);
          try { compositeRuntime.markExecutionSubmitted(compositeExecution); producerChecks.submitRecheck = false; }
          catch { producerChecks.submitRecheck = true; }
          p.dt = dt;
          producerChecks.restored = compositeRuntime.ownsExecution(compositeExecution);
          producerChecks.frozenInputs = Object.isFrozen(compositeExecution.correction.p2gProjections)
            && Object.isFrozen(compositeExecution.correction.forceInputs.gravityMPerS2);
        }
        try { compositeRuntime.encode(device.createCommandEncoder(), { transaction }); }
        catch (error) { backpressureRejected = /backpressure/.test(error.message); }
        combinedEncoder.clearBuffer(receipt);
        for (const [i,p] of compositeExecution.pairs.entries()) {
          encodeReceipt(device, combinedEncoder, compositeInvariantShader(i > 0,i === pairs.length-1),
            [p.sourceStateBuffer,p.nativeStateBuffer,p.stateBuffer,receipt]);
        }
        const pending = readReceipt(device, combinedEncoder, receipt, readback);
        compositeRuntime.markExecutionSubmitted(compositeExecution);
        compositeWords = await pending;
        if (forceCase) {
          const correctionEncoder=device.createCommandEncoder();correctionEncoder.clearBuffer(receipt);
          const top=compositeExecution.pairs.at(-1), correctedTop=compositeExecution.correction.updatedPairs.at(-1);
          for (const [i,state] of compositeExecution.correction.nativeStates.entries()) {
            if (forceCase==='cfl') {
              encodeReceipt(device,correctionEncoder,/* wgsl */ `
                @group(0) @binding(0) var<storage,read> control:array<u32>;
                @group(0) @binding(1) var<storage,read> output:array<u32>;
                @group(0) @binding(2) var<storage,read_write> receipt:array<u32>;
                @compute @workgroup_size(1) fn check() {
                  if(control[2]!=5u || control[18]==0u) { receipt[0]|=1u; }
                  receipt[1]++;receipt[2]=control[2];receipt[3]=control[18];
                  if(output[2]==3u) { receipt[4]++; } else if(output[2]==5u) { receipt[5]++; } else { receipt[0]|=2u; }
                }`,[compositeExecution.correction.controlBuffer,state.stateBuffer,receipt]);
            } else {
              encodeReceipt(device,correctionEncoder,correctionInvariantShader(i===levelCount-1,forceCase,forceInputs.gravityMPerS2,forceInputs.dt),
                [compositeExecution.correction.controlBuffer,top.stateBuffer,correctedTop.stateBuffer,
                  state.fieldView.fieldViewBuffer,state.stateBuffer,receipt]);
            }
          }
          correctionWords=await readReceipt(device,correctionEncoder,receipt,readback);
        }
        if(publish) {
          const publication=await compositeRuntime.publishNativeState(compositeExecution);
          const pubEncoder=device.createCommandEncoder();pubEncoder.clearBuffer(receipt);
          for(const state of compositeExecution.correction.nativeStates) {
            encodeReceipt(device,pubEncoder,/* wgsl */ `
              @group(0) @binding(0) var<storage,read> field:array<u32>;
              @group(0) @binding(1) var<storage,read> proposal:array<u32>;
              @group(0) @binding(2) var<storage,read> control:array<u32>;
              @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
              fn close(a:f32,b:f32)->bool { return abs(a-b)<=max(1e-6,max(abs(a),abs(b))*4e-5); }
              @compute @workgroup_size(1) fn check() {
                receipt[1]++;receipt[2]=control[20];receipt[3]=control[19];
                let r=field[30]-36u;
                if(${forceCase==='cfl'||forceCase==='missing-pressure'}) {
                  if(control[2]!=5u || control[20]!=5u || field[2]==3u) { receipt[0]|=1u; }
                  return;
                }
                if(control[2]!=3u || control[20]!=3u || control[19]!=${levelCount}u
                  || field[2]!=3u || field[59]!=2u || field[63]!=proposal[25]+1u
                  || field[r+2]!=3u || field[r+3]!=4u || field[r+5]!=field[63]
                  || field[r+32]!=1u || field[r+33]!=1u || field[r+34]!=1u) { receipt[0]|=2u; }
                var heat=0.0;var budget=0.0;var energy=0.0;var mass=0.0;
                for(var i=0u;i<field[34];i++) {
                  let s=field[30]+i*8u;let p=64u+i*8u;let a=field[28]+i*8u;
                  let m=bitcast<f32>(field[s]);mass+=m;
                  let v=vec3<f32>(bitcast<f32>(field[s+1]),bitcast<f32>(field[s+2]),bitcast<f32>(field[s+3]));
                  let momentum=vec3<f32>(bitcast<f32>(proposal[p+1]),bitcast<f32>(proposal[p+2]),bitcast<f32>(proposal[p+3]));
                  if(field[s]!=proposal[p] || any(abs(m*v-momentum)>max(vec3<f32>(1e-6),abs(momentum)*4e-5))) { receipt[0]|=4u; }
                  for(var w=4u;w<7u;w++) { if(field[s+w]!=proposal[p+w]) {receipt[0]|=8u;} }
                  let h=bitcast<f32>(field[a]);if(h<0.0 || !(h==h)) {receipt[0]|=16u;}
                  heat+=h;budget+=bitcast<f32>(proposal[p+7]);energy+=0.5*m*dot(v,v)+h;
                }
                if(!close(heat,bitcast<f32>(field[r+8])) || !close(heat,bitcast<f32>(field[r+9])) || !close(budget,energy)) {receipt[0]|=32u;}
                receipt[8]=bitcast<u32>(bitcast<f32>(receipt[8])+mass);
                receipt[9]=bitcast<u32>(bitcast<f32>(receipt[9])+heat);
                receipt[10]=bitcast<u32>(bitcast<f32>(receipt[10])+energy);
                receipt[11]=bitcast<u32>(bitcast<f32>(receipt[11])+budget);
              }`,[state.fieldView.fieldViewBuffer,state.stateBuffer,publication.controlBuffer,receipt]);
          }
          publicationWords=await readReceipt(device,pubEncoder,receipt,readback);
          if (particles) {
            if(particleFault) {
              const field=publication.updates.at(-1).mechanicsFieldViewExecution;
              device.queue.writeBuffer(field.fieldViewBuffer,(field.layout.stateOffsetWords-36+3)*4,new Uint32Array([6]));
            }
            const sphParticleState={schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount,state,thermo,phaseCarrierPlan,smoothingLengthM:0.15,
              stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4};
            const mlsMpmParticleState={schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,particleCount,mechanics,phaseCarrierPlan,mechanicsStrideBytes:128};
            if(clockExhausted) {sphParticleState.step=Number.MAX_SAFE_INTEGER;mlsMpmParticleState.step=Number.MAX_SAFE_INTEGER;}
            const proposals=mechanicsLevels.map(spec=>runSchroederSpatialMechanicalProposalWebGpu({
              device,generation,sphParticleState,mlsMpmParticleState,sphParticleUpload,mlsMpmParticleUpload,
              boxDimsM:[32,32,32],gridSpacingM:spec.mechanicsGrid.gridSpacingM,
              selectedLevel:spec.selectedLevel,relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024
            }));
            let result, completedClosure, coldThermalBaseline, thermalProposal, privateOwner, privateParcelBorrow, privateWallBorrow;
            try {
              result=await runMlsMpmLevelChainG2pWebGpu({device,nativePublication:publication,
                mechanicalProposals:proposals,sphParticleState,mlsMpmParticleState,sphParticleUpload,mlsMpmParticleUpload,
                schroederSpatialEpochTransaction:transaction,schroederSpatialEpochGeneration:generation,
                dt:forceInputs.dt,mechanicsMaterialTable,internalPressureScale:0,retainOutputParticleBuffers:true,readbackMode:'no-full-readback'});
              const check=device.createCommandEncoder();check.clearBuffer(receipt);
              encodeReceipt(device,check,/* wgsl */ `
@group(0) @binding(0) var<storage,read> s:array<u32>;
@group(0) @binding(1) var<storage,read> old:array<u32>;
@group(0) @binding(2) var<storage,read> m:array<u32>;
@group(0) @binding(3) var<storage,read> old_m:array<u32>;
@group(0) @binding(4) var<storage,read> control:array<u32>;
@group(0) @binding(5) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn check() {
  receipt[1]=control[1];receipt[2]=control[2];receipt[3]=control[16];
  if(control[0]!=0x53475031u || control[16]!=${levelCount}u) {receipt[0]|=1u;}
  if(${forceCase==='cfl'||forceCase==='missing-pressure'||particleFault}) {
    if(control[1]!=5u) {receipt[0]|=2u;}
    for(var i=0u;i<arrayLength(&s);i++) {if(s[i]!=old[i]) {receipt[0]|=4u;}}
    for(var i=0u;i<arrayLength(&m);i++) {if(m[i]!=old_m[i]) {receipt[0]|=8u;}}
    return;
  }
  if(control[1]!=3u || control[2]!=0u) {receipt[0]|=16u;}
  for(var row=0u;row<2u;row++) {
    if(s[row*8u+3u]!=old[row*8u+3u]) {receipt[0]|=32u;}
    var moved=false;
    for(var w=0u;w<3u;w++) {
      let value=bitcast<f32>(s[row*8u+w]);
      if(!(abs(value)<3.402823e38)) {receipt[0]|=64u;}
      moved=moved || s[row*8u+w]!=old[row*8u+w];
    }
    if(!moved) {receipt[0]|=128u;}
    if(!(bitcast<f32>(s[row*8u+7u])>=bitcast<f32>(old[row*8u+7u]))) {receipt[0]|=256u;}
    receipt[8u+row]=s[row*8u+7u];
  }
}`,[result.stateBuffer,sourceStateBuffer,result.mechanicsBuffer,sourceMechanicsBuffer,result.controlBuffer,receipt]);
              particleWords=await readReceipt(device,check,receipt,readback);
              if(exact && !ledger) {
                const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                try {
                  if(!pin.quantities || pin.sourceRead.read.family!==sphParticleUpload.exactMassInventory) {
                    throw new Error('Chain output lost the original exact inventory or quantities');
                  }
                  let refused=false;
                  try {result.destroyOutputParticleBuffers();} catch {refused=true;}
                  if(!refused) throw new Error('Pinned exact chain output was destroyed');
                  const q=pin.quantities,original=pin.sourceRead.quantities;
                  const qcheck=device.createCommandEncoder();qcheck.clearBuffer(receipt);
                  encodeReceipt(device,qcheck,/* wgsl */ `
@group(0) @binding(0) var<storage,read> q:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> validation:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn check() {
  receipt[1]=validation[0];
  if(${particleFault} != (validation[0]!=0u)) {receipt[0]|=1u;}
  for(var row=0u;row<2u;row++) {
    let base=row*${q.quantityLayout.recordWords}u+${q.quantityLayout.massOffsetWords}u;
    for(var w=0u;w<${q.format.wordCount}u;w++) {if(q[base+w]!=original[base+w]) {receipt[0]|=2u;}}
  }
  if(${particleFault}) {
    for(var w=0u;w<arrayLength(&q);w++) {if(q[w]!=original[w]) {receipt[0]|=4u;}}
  }
}`,[q.quantityBuffer,original.quantityBuffer,q.validationBuffer,receipt]);
                  const qwords=await readReceipt(device,qcheck,receipt,readback);
                  particleWords[12]=qwords[0];particleWords[13]=qwords[1];particleWords[14]=1;
                } finally {pin.release();}
              }
              if (closure) {
                if (result.dt !== forceInputs.dt) throw new Error('Chain changed the original caller duration');
                const options = { device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
                  postMechanicsParticleBuffers: result, postMechanicsG2pResult: result,
                  thermalMaterialTable, mechanicsMaterialTable, reactionTable, dtSeconds: forceInputs.dt, boxDimsM: [32,32,32],
                  spatialReactionDiscoveryProposalRunner: runSchroederSpatialReactionDiscoveryProposalWebGpu,
                  readbackMode: 'no-full-readback', schroederSpatialEpochTransaction: transaction,
                  schroederSpatialEpochGeneration: generation,
                  thermalStepOptions: { conductionRate: thermalPair ? 1 : 0, wallRate: 0 } };
                let wallSource=null,wallSnapshot=null;
                if(finiteWalls) {
                  const env=await import('../../src/runtime/thermalEnvironmentAuthority.js');
                  const walls=await import('../../src/runtime/sph/sphFiniteWallStateGpu.js');
                  const faces=Object.fromEntries(env.SPH_THERMAL_WALL_FACE_IDS.map((face,i)=>[face,
                    finiteWalls==='cold'?200:finiteWalls==='mixed'?(i<2?350:200):350]));
                  const authority=env.resolveSphWallReservoirAuthority({wallModel:env.SPH_THERMAL_WALL_MODEL_FINITE,
                    wallTemperaturesK:faces,wallFaceHeatCapacitiesJPerK:Object.fromEntries(env.SPH_THERMAL_WALL_FACE_IDS.map(face=>
                      [face,finiteWalls==='underflow'?1e-12:privateContinuation?0.01:100]))});
                  wallSource=walls.sphFiniteWallStateFor(device,authority);
                  options.boxDimsM=[thermalPair?8.31:8.26,8.26,8.26];
                  options.thermalStepOptions={...options.thermalStepOptions,wallReservoirAuthority:authority,
                    wallRate:1,wallLayerM:64,ambientTemperatureK:0};
                  const e=device.createCommandEncoder();
                  if(finiteWalls==='legacy') wallSource.encodeUpdate(e);
                  wallSnapshot=makeBuffer('cold wall snapshot',wallSource.buffer.size,usage);
                  e.copyBufferToBuffer(wallSource.buffer,0,wallSnapshot,0,wallSnapshot.size);device.queue.submit([e.finish()]);
                }
                for (const override of [{ postMechanicsG2pResult: { ...result } }, { postMechanicsG2pResult: null },
                  { dtSeconds: forceInputs.dt * 2 }, { dtSeconds: forceInputs.dt + 1e-12 }]) {
                  let refused = false;
                  try { await closureModule.runMlsMpmPostMechanicsClosureWebGpu({ ...options, ...override }); }
                  catch (error) { refused = /Chain closure/.test(error.message) || (exact && override.postMechanicsG2pResult === null && /unadmitted: g2p-result/.test(error.message)); await error.chainClosureCleanupCompletion; if (!refused) throw error; }
                  if (!refused) throw new Error('Closure accepted a copied/missing producer or wrong duration');
                }
                if (ledger) {
                  thermalProposal = runSchroederSpatialThermalProposalWebGpu({ device, generation,
                    schroederSpatialEpochTransaction: transaction, sphParticleState, sphParticleUpload, mlsMpmParticleUpload,
                    thermalResponseGraphUpload: responseUpload, dtS: forceInputs.dt,
                    smoothingLengthM: 0.15, conductionRate: thermalPair ? 1 : 0, exactEnergyLedger: true });
                  options.schroederSpatialThermalProposal = thermalProposal;
                  options.thermalResponseGraphUpload = responseUpload;
                }
                if(refinement) {
                  // Explicit cold assignment/admission inputs. The real producer validates
                  // current phase output and exact inventories on the device.
                  const h=await import('../../src/runtime/sph/schroederHierarchyGpu.js');
                  const merge=refinement==='merge', assignments=new Float32Array(merge?64:32);
                  for(let row=0;row<(merge?2:1);row++) {
                    const at=row*32,source=2*phaseLineages+(merge?row:1);
                    assignments[at]=source;assignments[at+3]=9;assignments[at+6]=1;
                    assignments[at+8]=merge?(row?7:6):5;
                    assignments[at+9]=merge?(row?-1:source):0;
                    assignments[at+10]=merge?(row?0:1):2;
                    assignments[at+11]=merge&&row?source:-1;
                    assignments[at+12]=merge&&row?1:0;assignments[at+20]=2;
                  }
                  const slotAssignmentBuffer=makeBuffer('chain refinement assignments',assignments.byteLength,usage);
                  const spareLineagesBuffer=makeBuffer('chain refinement spares',8,usage);
                  device.queue.writeBuffer(slotAssignmentBuffer,0,assignments);
                  device.queue.writeBuffer(spareLineagesBuffer,0,new Uint32Array([phaseLineages-2,phaseLineages-(refinement==='duplicate-spare'?2:1)]));
                  options.phaseSlotRefinement={sourceSphParticleUpload:sphParticleUpload,sourceMlsMpmParticleUpload:mlsMpmParticleUpload,
                    spareLineagesBuffer,particleStorageSlotAssignment:{preservePhaseSlots:true,slotAssignmentBuffer,
                      status:'schroeder-particle-storage-slot-assignment-submitted',
                      particleStorageSlotAssignmentAdmissionApproved:true,allocationRowCount:merge?2:1},
                    particleStorageMaterializationAdmission:{committed:true,particleStorageMaterializationApproved:true,
                      particleIdentityMutationApproved:true,slotAssignmentDescriptorApproved:true,
                      outputFamilies:['schroeder-particle-storage-materialization'],
                      targetStateFamilies:[...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
                      schroederParticleStorageMaterializationRowCount:merge?2:1}};
                }
                let completedThermalState, completedThermalEnergy, completedPhase, completedReaction, completedRefinement, completedParcels, completedWall;
                if (closureFault || refinement || parcels || finiteWalls) options.timedStage = async (name, run) => {
                  const stage = await run();
                  if (name === 'mechanicsRefresh' && closureFault) {
                    if (closureFault === 'wall-energy') {
                      device.queue.writeBuffer(completedWall.buffer,64*4,new Uint32Array([1]));
                    } else if (closureFault === 'wall-temperature') {
                      device.queue.writeBuffer(completedWall.buffer,0,new Float32Array([0]));
                    } else if (closureFault === 'wall-error') {
                      device.queue.writeBuffer(completedWall.validationBuffer,8,new Uint32Array([1]));
                    } else if (closureFault === 'parcel-error') {
                      device.queue.writeBuffer(completedParcels.validationBuffer,8,new Uint32Array([1]));
                    } else if (closureFault === 'parcel-inventory') {
                      device.queue.writeBuffer(completedParcels.parcels.sinkBuffer,0,new Uint32Array([1]));
                    } else if (closureFault === 'refinement-error' || closureFault === 'refinement-ledger-error') {
                      device.queue.writeBuffer(completedRefinement.evidenceBuffer,closureFault==='refinement-error'?0:20,new Uint32Array([1]));
                    } else if (closureFault === 'phase-error') {
                      device.queue.writeBuffer(completedPhase.evidenceBuffer,8,new Uint32Array([4]));
                    } else if (closureFault === 'phase-projection' || closureFault === 'reaction-projection' || closureFault === 'refinement-projection') {
                      const encoder=device.createCommandEncoder();
                      encodeReceipt(device,encoder,`@group(0) @binding(0) var<storage,read_write> s:array<u32>;
                        @compute @workgroup_size(1) fn check(){
                          for(var row=0u;row<arrayLength(&s)/8u;row++) {
                            if(bitcast<f32>(s[row*8u+3u])>0.0){s[row*8u+3u]=0u;break;}
                          }
                        }`, [closureFault === 'refinement-projection' ? completedRefinement.stateBuffer : closureFault === 'phase-projection' ? completedPhase.stateBuffer : completedReaction.stateBuffer]);
                      device.queue.submit([encoder.finish()]);
                    } else if (closureFault === 'ledger-error' || closureFault === 'skipped-pair') {
                      const word = 2*particleCount*9 + (closureFault === 'skipped-pair' ? 2 : 0);
                      device.queue.writeBuffer(completedThermalEnergy, word * 4, new Uint32Array([1]));
                    } else if (closureFault === 'missing-output') {
                      const encoder = device.createCommandEncoder();
                      // Storage output intentionally has no COPY_DST usage.
                      encodeReceipt(device, encoder, `
                        @group(0) @binding(0) var<storage,read_write> state:array<u32>;
                        @compute @workgroup_size(1) fn check() {
                          for(var i=0u;i<arrayLength(&state);i++) {state[i]=0u;}
                        }`, [completedThermalState]);
                      device.queue.submit([encoder.finish()]);
                    } else device.queue.writeBuffer(stage.authorityValidationBuffer, 0, new Uint32Array([1]));
                  }
                  if (name === 'phaseCarrierTransfer') completedPhase=stage;
                  if (name === 'reactionStep') completedReaction=stage;
                  if (name === 'phaseSlotRefinement') completedRefinement=stage;
                  if (name === 'ledgerParcels') completedParcels=stage;
                  if (name === 'thermalStep') { completedWall=stage.exactFiniteWall; completedThermalState = stage.stateBuffer; completedThermalEnergy = stage.exactEnergy?.energyBuffer; }
                  return stage;
                };
                // Same-device caloric baseline: the sampled GPU material closure
                // need not match the CPU cold declaration's temperature exactly.
                // Its independent buffers were built from cold declarations before
                // exact upload. No hot exact projection is relabeled or reseeded,
                // and no baseline rows are read or reuploaded.
                coldThermalBaseline = await thermalRunner({ device, sphParticleState: baselineColdState, sphParticleUpload: baselineColdUpload,
                  sourceStateBuffer: baselineColdUpload.stateBuffer, sourceThermoBuffer: baselineColdUpload.thermoBuffer, thermalMaterialTable,
                  dtS: forceInputs.dt, boxDimsM: [32,32,32], conductionRate: 0, wallRate: 0,
                  retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
                completedClosure = await closureModule.runMlsMpmPostMechanicsClosureWebGpu(options);
                const admitted = closureModule.resolveMlsMpmChainClosureAdmission(completedClosure);
                if (completedClosure.residentContinuationReady || completedClosure.status !== 'post-mechanics-closure-awaiting-chain-admission') {
                  throw new Error('Candidate claimed publication without resident admission');
                }
                if(finiteWalls) {
                  const wr=admitted.wallRecord;
                  if(!wr || wr.originalBuffer!==wallSource.buffer || wr.buffer===wr.originalBuffer) throw new Error('Missing genuine wall successor');
                  for(const buffer of [wr.buffer,wr.originalBuffer,wr.deltaBuffer]) {
                    let refused=false;try{buffer.destroy();}catch{refused=true;}
                    if(!refused) throw new Error('Wall candidate lost its owner guard');
                  }
                  let refused=false;try{wallSource.encodeUpdate(device.createCommandEncoder());}catch{refused=true;}
                  if(!refused) throw new Error('Legacy wall writer overlapped canonical read');
                  const stage=completedClosure.thermalStep, original=stage.exactFiniteWall;
                  stage.exactFiniteWall={...original};let cloned=false;
                  try{closureModule.resolveMlsMpmChainClosureAdmission(completedClosure);}catch{cloned=true;}
                  finally{stage.exactFiniteWall=original;}
                  if(!cloned) throw new Error('Thermal producer accepted cloned wall record');
                }
                if(parcels) {
                  const stage=completedClosure.ledgerParcelStep;
                  let refused=false;
                  try {stage.destroyOutputParticleBuffers();}catch {refused=true;}
                  if(!refused) throw new Error('Live parcel candidate lost its owner guard');
                  for(const key of ['parcels','exactEnergy','carrierMassRead']) {
                    const original=stage[key];stage[key]={...original};let rejected=false;
                    try {closureModule.resolveMlsMpmChainClosureAdmission(completedClosure);}catch {rejected=true;}
                    finally {stage[key]=original;}
                    if(!rejected) throw new Error(`Parcel candidate accepted cloned ${key}`);
                  }
                  closureModule.resolveMlsMpmChainClosureAdmission(completedClosure);
                }
                let claimRefused=false, pinRefused=false;
                try { closureModule.claimMlsMpmPostMechanicsContinuation(completedClosure, admitted); } catch { claimRefused=true; }
                try { result.destroyOutputParticleBuffers(); } catch { pinRefused=true; }
                if (!claimRefused || !pinRefused) throw new Error('Chain candidate bypassed admission or producer retention');
                const finalCheck=device.createCommandEncoder();finalCheck.clearBuffer(receipt);
                encodeReceipt(device,finalCheck,/* wgsl */ `
@group(0) @binding(0) var<storage,read> s:array<u32>;
@group(0) @binding(1) var<storage,read> t:array<u32>;
@group(0) @binding(2) var<storage,read> m:array<u32>;
@group(0) @binding(3) var<storage,read> old_s:array<u32>;
@group(0) @binding(4) var<storage,read> old_t:array<u32>;
@group(0) @binding(5) var<storage,read> old_m:array<u32>;
@group(0) @binding(6) var<storage,read> control:array<u32>;
@group(0) @binding(7) var<storage,read_write> receipt:array<u32>;
@group(0) @binding(8) var<storage,read> baseline_t:array<f32>;
@group(0) @binding(9) var<storage,read> g2p_s:array<u32>;
@group(0) @binding(10) var<storage,read> clock:array<u32>;
@compute @workgroup_size(1) fn check() {
  receipt[1]=control[1];receipt[2]=control[2];receipt[3]=control[16];
  if(clock[0]!=0x53434c31u || clock[1]!=1u) {receipt[0]|=4096u;}
  if(${clockExhausted}) {
    if(clock[2]!=0u || clock[3]!=0u || clock[12]!=0u || (control[2]&131072u)==0u) {receipt[0]|=4096u;}
  } else {
    let accepted=select(0u,1u,control[2]==0u);
    if(clock[2]!=accepted || clock[3]!=1u-accepted || clock[10]!=accepted
      || clock[11]!=control[2] || clock[12]!=1u) {receipt[0]|=4096u;}
  }
  if(control[0]!=0x53434331u || control[16]!=${levelCount}u) {receipt[0]|=1u;}
  for(var w=0u;w<6u;w++) {receipt[20u+w]=control[17u+w];}
  if(${Boolean(clockExhausted || particleFault || closureFault || reactionRejected || forceCase==='missing-pressure')}) {
    if(control[1]!=5u) {receipt[0]|=2u;}
    for(var i=0u;i<arrayLength(&s);i++) {if(s[i]!=old_s[i]) {receipt[0]|=4u;}}
    for(var i=0u;i<arrayLength(&t);i++) {if(t[i]!=old_t[i]) {receipt[0]|=8u;}}
    for(var i=0u;i<arrayLength(&m);i++) {if(m[i]!=old_m[i]) {receipt[0]|=16u;}}
  } else {
    if(control[1]!=3u || control[2]!=0u) {receipt[0]|=32u;}
    for(var i=0u;i<2u;i++) {
      let temperature=bitcast<f32>(t[i*12u+2u]);
      let energy=bitcast<f32>(s[i*8u+7u]);let old_energy=bitcast<f32>(old_s[i*8u+7u]);
      if(${Boolean(phaseTransfer || reaction)}) {continue;}
      if(${forceCase==='contact'}) {
        if(!(temperature>baseline_t[i*12u+2u]) || !(energy>old_energy)) {receipt[0]|=64u;}
      } else if(!${Boolean(thermalPair || finiteWalls)} && (abs(temperature-baseline_t[i*12u+2u])>0.0001 || abs(energy-old_energy)>0.01)) {receipt[0]|=64u;}
      if(s[i*8u+3u]!=old_s[i*8u+3u]) {receipt[0]|=128u;}
      for(var w=0u;w<8u;w++) {if((!${Boolean(thermalPair || finiteWalls)} || w!=7u) && s[i*8u+w]!=g2p_s[i*8u+w]) {receipt[0]|=256u;}}
    }
  }
  receipt[8]=t[2];receipt[9]=t[14];receipt[10]=s[7];receipt[11]=s[15];
  receipt[16]=bitcast<u32>(baseline_t[2]);receipt[17]=bitcast<u32>(baseline_t[14]);
}`,[admitted.stateBuffer,admitted.thermoBuffer,admitted.mechanicsBuffer,sourceStateBuffer,sourceThermoBuffer,sourceMechanicsBuffer,admitted.controlBuffer,receipt,coldThermalBaseline.thermoBuffer,result.stateBuffer,admitted.clock.buffer]);
                closureWords=await readReceipt(device,finalCheck,receipt,readback);
                if (ledger && !phaseTransfer && !reaction) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    if (pin.quantities || !pin.sourceRead.energy || !admitted.exactEnergy
                      || pin.sourceRead.read.family !== sphParticleUpload.exactMassInventory) {
                      throw new Error('Chain ledger lost its genuine energy/inventory owner');
                    }
                    const ledgerCheck=device.createCommandEncoder();ledgerCheck.clearBuffer(receipt);
                    encodeReceipt(device,ledgerCheck,chainLedgerReceiptShader({
                      rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected), contact:forceCase==='contact', thermalPair
                    }),[admitted.exactEnergy.energyBuffer,pin.sourceRead.energy.energyBuffer,receipt]);
                    const energyWords=await readReceipt(device,ledgerCheck,receipt,readback);
                    closureWords[12]=energyWords[0];closureWords[13]=energyWords[1];closureWords[14]=energyWords[2];
                  } finally { pin.release(); }
                }
                if (phaseTransfer && !reaction && !refinement && !parcels) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    if(!completedClosure.phaseCarrierTransferStep || !admitted.carrierMassRead || !admitted.exactEnergy) {
                      throw new Error('Chain phase closure lost its successor owners');
                    }
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,chainPhaseReceiptShader({ rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected),
                      sourceMassOffset:pin.sourceRead.read.byteOffset/4, candidateMassOffset:admitted.carrierMassRead.byteOffset/4, firstPhase:phaseTransfer==='boiling' ? 2 : 1 }),
                      [admitted.carrierMassRead.buffer,pin.sourceRead.read.buffer,admitted.exactEnergy.energyBuffer,
                        pin.sourceRead.energy.energyBuffer,admitted.stateBuffer,admitted.thermoBuffer,receipt]);
                    const phaseWords=await readReceipt(device,check,receipt,readback);
                    closureWords[12]=phaseWords[0];closureWords[13]=phaseWords[1];closureWords[14]=phaseWords[2];
                  } finally {pin.release();}
                }
                if(refinement && !parcels) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,chainRefinementReceiptShader({particleCount,
                      rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected),merge:refinement==='merge',
                      sourceMassOffset:pin.sourceRead.read.byteOffset/4,candidateMassOffset:admitted.carrierMassRead.byteOffset/4}),
                      [admitted.carrierMassRead.buffer,pin.sourceRead.read.buffer,admitted.exactEnergy.energyBuffer,
                        pin.sourceRead.energy.energyBuffer,admitted.stateBuffer,admitted.thermoBuffer,receipt,
                        completedRefinement.evidenceBuffer]);
                    const words=await readReceipt(device,check,receipt,readback);
                    closureWords[26]=words[0];closureWords[27]=words[1];closureWords[28]=words[2];
                    closureWords[29]=words[3];closureWords[30]=words[4];closureWords[31]=words[5];
                  } finally {pin.release();}
                }
                if(reaction) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    if(!completedClosure.reactionStep || !admitted.carrierMassRead || !admitted.exactEnergy)
                      throw new Error('Reaction closure lost its retained ledger');
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,chainReactionReceiptShader({particleCount,rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected),
                      sourceMassOffset:pin.sourceRead.read.byteOffset/4,candidateMassOffset:admitted.carrierMassRead.byteOffset/4,
                      waterId:reactionMaterials.h2o.id,phaseTransfer:Boolean(phaseTransfer)}),
                      [admitted.carrierMassRead.buffer,pin.sourceRead.read.buffer,admitted.exactEnergy.energyBuffer,
                        pin.sourceRead.energy.energyBuffer,admitted.stateBuffer,admitted.thermoBuffer,receipt,
                        completedClosure.continuation.residentProductMass.productEventBuffer]);
                    const words=await readReceipt(device,check,receipt,readback);
                    closureWords[12]=words[0];closureWords[13]=words[1];closureWords[14]=words[2];
                  } finally {pin.release();}
                }
                if(parcels) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    const pr=admitted.parcelRecord;
                    if(!pr || pr.parcels===pr.originalParcels) throw new Error('Missing separate parcel successor');
                    encodeReceipt(device,check,chainParcelReceiptShader({particleCount,parcelCount:pr.parcels.count,
                      rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected),kind:parcels,
                      sourceMassOffset:pin.sourceRead.read.byteOffset/4,candidateMassOffset:admitted.carrierMassRead.byteOffset/4}),
                      [pin.sourceRead.read.buffer,admitted.carrierMassRead.buffer,pin.sourceRead.energy.energyBuffer,
                        admitted.exactEnergy.energyBuffer,pr.originalParcels.ledgerBuffer,pr.parcels.ledgerBuffer,
                        pr.originalParcels.sinkBuffer,pr.parcels.sinkBuffer,pr.originalParcels.paramsBuffer,
                        pr.parcels.paramsBuffer,pr.validationBuffer,receipt,admitted.stateBuffer]);
                    encodeReceipt(device,check,`@group(0) @binding(0) var<storage,read> bp:array<u32>;
                      @group(0) @binding(1) var<storage,read> ap:array<u32>;
                      @group(0) @binding(2) var<storage,read> bl:array<u32>;
                      @group(0) @binding(3) var<storage,read> al:array<u32>;
                      @group(0) @binding(4) var<storage,read> bs:array<u32>;
                      @group(0) @binding(5) var<storage,read> asink:array<u32>;
                      @group(0) @binding(6) var<storage,read_write> r:array<u32>;
                      @compute @workgroup_size(1) fn check(){
                        for(var i=0u;i<arrayLength(&bp);i++){if(bp[i]!=ap[i]){r[0]|=256u;}}
                        for(var i=0u;i<arrayLength(&bl);i++){if(bl[i]!=al[i]){r[0]|=256u;}}
                        for(var i=0u;i<arrayLength(&bs);i++){if(bs[i]!=asink[i]){r[0]|=256u;}}
                      }`,[parcelSnapshot.paramsBuffer,pr.originalParcels.paramsBuffer,parcelSnapshot.ledgerBuffer,
                        pr.originalParcels.ledgerBuffer,parcelSnapshot.sinkBuffer,pr.originalParcels.sinkBuffer,receipt]);
                    const words=await readReceipt(device,check,receipt,readback);
                    closureWords[26]=words[0];closureWords[27]=words[1];closureWords[28]=words[2];
                    closureWords[29]=words[3];closureWords[30]=words[4];closureWords[31]=words[5];
                  } finally {pin.release();}
                }
                if(finiteWalls) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    const wr=admitted.wallRecord,check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,chainWallReceiptShader({particleCount,
                      rejected:Boolean(clockExhausted || particleFault || closureFault || reactionRejected),
                      isolated:!phaseTransfer && !reaction && forceCase==='off',kind:finiteWalls}),
                      [wr.buffer,wr.originalBuffer,wallSnapshot,admitted.exactEnergy.energyBuffer,
                        pin.sourceRead.energy.energyBuffer,wr.validationBuffer,receipt]);
                    const words=await readReceipt(device,check,receipt,readback);
                    closureWords[28]=words[0];closureWords[29]=words[1];closureWords[30]=words[2];closureWords[31]=words[3];
                  } finally {pin.release();}
                }
                if(privateContinuation) {
                  const {createMlsMpmChainPrivateContinuation}=await import('../../src/runtime/sph/sphMlsMpmGpuStep.js');
                  const ownerModule=await import('../../src/runtime/sph/sphGpuBuffers.js');
                  const clockModule=await import('../../src/runtime/sph/sphResidentClockGpu.js');
                  const walls=await import('../../src/runtime/sph/sphExactFiniteWallGpu.js');
                  const residuals=await import('../../src/runtime/sph/sphReactionResidualHistoryGpu.js');
                  const wallCache=await import('../../src/runtime/sph/sphFiniteWallStateGpu.js');
                  const next=await createMlsMpmChainPrivateContinuation(completedClosure);privateOwner=next;
                  if(privateSteps) {
                    const continuation=await continueLevelChain({device,source:next,privateSteps,privatePublish,
                      mechanicsLevels,forceInputs,mechanicsMaterialTable:privateMechanicsMaterialTable,
                      surfaceReferenceTable:privateSurface?mechanicsMaterialTable:null,thermalMaterialTable,
                      thermalResponseGraphUpload:responseUpload,receipt,readback,continuationRejected,finiteWalls,privateWallFault,privatePressure,privatePressureRejected,privateNativeTransport,
                      thermalStepOptions:options.thermalStepOptions,reactionTable,privateReactionFault,privateReactionCarry,privateInventoryFault,continuationRejectedAfter,continuationRejectionMask});
                    continuationWords=continuation.words;wallContinuationWords=continuation.wallWords;
                    reactionContinuationWords=continuation.reactionWords;pressureContinuation=continuation.pressure;
                  }
                  if(next.residentContinuationReady || !next.pendingBatchAdmission
                    || next.nextParticleUploads.sphParticleUpload.step!==(sphParticleState.step??0)
                    || next.nextParticleUploads.sphParticleUpload.time!==(sphParticleState.time??0)
                    || closureModule.validateMlsMpmPostMechanicsContinuationClaim(completedClosure,next.claim,{nextParticleUploads:next.nextParticleUploads})) {
                    throw new Error('Private owner incorrectly published state or host time');
                  }
                  let refused=false;try{closureModule.claimMlsMpmPostMechanicsContinuation(completedClosure,{nextParticleUploads:next.nextParticleUploads});}catch{refused=true;}
                  if(!refused) throw new Error('Private ownership bypassed public batch admission');
                  const read=ownerModule.acquireSphParticleExactMassRead(next.nextParticleUploads.sphParticleUpload,device,
                    {mlsMpmParticleUpload:next.nextParticleUploads.mlsMpmParticleUpload});
                  let parcelBorrow=null,residualBorrow=null;
                  try {
                    if(read.residentClock!==next.clock || read.energy.energyBuffer!==admitted.exactEnergy.energyBuffer) throw new Error('Private owner lost clock/energy handover');
                    if(reaction) {
                      if(!read.residualHistory) throw new Error('Private reaction lost canonical residual history');
                      for(const operation of [
                        ()=>residuals.borrowSphReactionResidualHistory({...read.residualHistory},{device}),
                        ()=>residuals.borrowSphReactionResidualHistory(read.residualHistory,{device:{}}),
                        ()=>read.residualHistory.buffer.destroy()
                      ]) {
                        let refused=false;try{operation();}catch{refused=true;}
                        if(!refused) throw new Error('Canonical residual history accepted a forged owner or external retirement');
                      }
                      residualBorrow=residuals.borrowSphReactionResidualHistory(read.residualHistory,{device});
                    }
                    if(finiteWalls) {
                      if(read.finiteWallState.buffer!==admitted.wallRecord.buffer) throw new Error('Private owner lost its wall successor');
                      for(const operation of [
                        ()=>walls.borrowSphPrivateFiniteWallState(device,{...read.finiteWallState}),
                        ()=>walls.borrowSphPrivateFiniteWallState({},read.finiteWallState),
                        ()=>read.finiteWallState.buffer.destroy(),
                        ()=>wallSource.encodeUpdate(device.createCommandEncoder()),
                        ()=>wallCache.borrowSphFiniteWallState(device,wallSource)
                      ]) {
                        let refused=false;try{operation();}catch{refused=true;}
                        if(!refused) throw new Error('Private wall accepted a forged owner or concurrent writer');
                      }
                      privateWallBorrow=walls.borrowSphPrivateFiniteWallState(device,read.finiteWallState);
                    }
                    if(parcels) {
                      parcelBorrow=ownerModule.beginSphGpuParticleUploadLedgerParcelsBorrow(next.nextParticleUploads.sphParticleUpload);privateParcelBorrow=parcelBorrow;
                      if(parcelBorrow.parcels!==admitted.parcelRecord.parcels
                        || parcelBorrow.parcels===admitted.parcelRecord.originalParcels) throw new Error('Private continuation retained the old parcel reservoir');
                    }
                    refused=false;try{ownerModule.destroySphGpuParticleBuffers(next.nextParticleUploads.sphParticleUpload);}catch{refused=true;}
                    if(!refused) throw new Error('Private owner retired without the batch fence');
                    let fenceRefused=false;try{await next.retire(Promise.resolve(false));}catch{fenceRefused=true;}
                    if(!fenceRefused) throw new Error('Private owner accepted an unconfirmed batch fence');
                    await next.retire(device.queue.onSubmittedWorkDone().then(()=>true));
                    if(!ownerModule.validateSphParticleExactMassRead(read,{device,sourceSphUpload:next.nextParticleUploads.sphParticleUpload})
                      || !clockModule.validateSphResidentClock(next.clock,device)) throw new Error('Retirement destroyed a borrowed private source');
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,`
                      @group(0) @binding(0) var<storage,read> clock:array<u32>;
                      @group(0) @binding(1) var<storage,read> mass:array<u32>;
                      @group(0) @binding(2) var<storage,read> state:array<f32>;
                      @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
                      @compute @workgroup_size(1) fn check(){
                        receipt[1]=clock[2];receipt[2]=clock[3];receipt[3]=clock[12];
                        if(clock[0]!=0x53434c31u || arrayLength(&mass)==0u) {receipt[0]|=1u;}
                        for(var i=0u;i<arrayLength(&state);i++){if(!(abs(state[i])<=3.402823e38)){receipt[0]|=2u;}}
                      }`,[read.residentClock.buffer,read.read.buffer,next.nextParticleUploads.sphParticleUpload.stateBuffer,receipt]);
                    if(residualBorrow) {
                      residualBorrow.validate();
                      encodeReceipt(device,check,`
                        @group(0) @binding(0) var<storage,read> history:array<u32>;
                        @group(0) @binding(1) var<storage,read_write> receipt:array<u32>;
                        @compute @workgroup_size(1) fn check(){
                          if(history[0]!=0x50484731u || history[3]!=0u || history[6]!=1u
                            || history[7]!=${read.residualHistory.seal}u){receipt[0]|=4u;}
                          for(var w=64u;w<arrayLength(&history);w++){if(history[w]!=0u){receipt[0]|=8u;}}
                        }`,[residualBorrow.buffer,receipt]);
                    }
                    privateWords=await readReceipt(device,check,receipt,readback);
                  } finally {await ownerModule.releaseSphParticleExactMassRead(read);}
                  if(residualBorrow) {
                    residualBorrow.validate();residualBorrow.release();
                    refused=false;try{residualBorrow.validate();}catch{refused=true;}
                    if(!refused) throw new Error('Released canonical residual reader remained live');
                  }
                  refused=false;try{clockModule.validateSphResidentClock(next.clock,device);}catch{refused=true;}
                  if(!refused) throw new Error('Retired private clock remained live after its last borrow');
                  if(privateWallBorrow) {
                    privateWallBorrow.validate();
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,`
                      @group(0) @binding(0) var<storage,read> wall:array<u32>;
                      @group(0) @binding(1) var<storage,read> original:array<u32>;
                      @group(0) @binding(2) var<storage,read> snapshot:array<u32>;
                      @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
                      @compute @workgroup_size(1) fn check(){
                        if(wall[24]!=0x46574c31u || wall[118]!=0x46574531u){receipt[0]|=1u;}
                        for(var w=0u;w<arrayLength(&original);w++) {if(original[w]!=snapshot[w]){receipt[0]|=2u;}}
                      }`,[privateWallBorrow.buffer,wallSource.buffer,wallSnapshot,receipt]);
                    const words=await readReceipt(device,check,receipt,readback);privateWords[0]|=words[0];
                    privateWallBorrow.release();
                    refused=false;try{privateWallBorrow.validate();}catch{refused=true;}
                    if(!refused) throw new Error('Released private wall reader remained live');
                    await device.queue.onSubmittedWorkDone();
                    const cacheRead=wallCache.borrowSphFiniteWallState(device,wallSource);cacheRead.release();
                  }
                  if(parcelBorrow) {
                    const check=device.createCommandEncoder();check.clearBuffer(receipt);
                    encodeReceipt(device,check,`
                      @group(0) @binding(0) var<storage,read> params:array<f32>;
                      @group(0) @binding(1) var<storage,read> ledger:array<u32>;
                      @group(0) @binding(2) var<storage,read_write> receipt:array<u32>;
                      @compute @workgroup_size(1) fn check(){
                        if(arrayLength(&ledger)==0u){receipt[0]|=4u;}
                        for(var i=0u;i<arrayLength(&params);i++){if(!(abs(params[i])<=3.402823e38)){receipt[0]|=8u;}}
                      }`,[parcelBorrow.parcels.paramsBuffer,parcelBorrow.parcels.ledgerBuffer,receipt]);
                    const words=await readReceipt(device,check,receipt,readback);privateWords[0]|=words[0];parcelBorrow.release();
                  }
                  completedClosure=null;
                }
                if (exact && !ledger) {
                  const pin=acquireMlsMpmG2pExactMassCapture(result,{device,sphParticleUpload});
                  try {
                    const q=admitted.exactQuantities, original=pin.sourceRead.quantities;
                    const qcheck=device.createCommandEncoder();qcheck.clearBuffer(receipt);
                    encodeReceipt(device,qcheck,/* wgsl */ `
@group(0) @binding(0) var<storage,read> q:array<u32>;
@group(0) @binding(1) var<storage,read> old:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn check() {
  for(var row=0u;row<2u;row++) {
    for(var i=0u;i<${original.format.wordCount}u;i++) {
      let at=row*${original.quantityLayout.recordWords}u+${original.quantityLayout.massOffsetWords}u+i;
      if(q[at]!=old[at]) {receipt[0]|=1u;}
    }
  }
  if(${Boolean(clockExhausted || particleFault || closureFault || reactionRejected || forceCase==='missing-pressure')}) {
    for(var i=0u;i<arrayLength(&q);i++) {if(q[i]!=old[i]) {receipt[0]|=2u;}}
  }
}`,[q.quantityBuffer,original.quantityBuffer,receipt]);
                    const qwords=await readReceipt(device,qcheck,receipt,readback);closureWords[12]=qwords[0];
                  } finally {pin.release();}
                }
              }
            } catch (error) {
              await error.chainClosureCleanupCompletion;
              throw error;
            } finally {
              if(privateOwner) await privateOwner.retire(device.queue.onSubmittedWorkDone().then(()=>true));
              else if(completedClosure) await closureModule.retireMlsMpmPostMechanicsClosureOutputsAfter(completedClosure,
                { after: device.queue.onSubmittedWorkDone().then(() => true), abandon: true });
              privateParcelBorrow?.release();
              privateWallBorrow?.release();
              coldThermalBaseline?.destroyOutputParticleBuffers();
              thermalProposal?.abandonPreparedWork();
              if(result) result.destroyOutputParticleBuffers();
              for(const proposal of proposals) await proposal.releaseAfterSubmittedWork?.();
            }
          }
        }
        await compositeRuntime.releaseExecutionAfter(compositeExecution);
        compositeExecution = null;
        if (cycle === 0 && !publish) {
          const nativeFine = generation.mechanicsLevelViews[0].mechanicsFieldView;
          device.queue.writeBuffer(nativeFine.fieldViewBuffer, 63*4,
            new Uint32Array([nativeFine.stateMutationOrdinal+1]));
          const badEncoder = device.createCommandEncoder();
          compositeExecution = compositeRuntime.encode(badEncoder,{ transaction, forceInputs, p2gProjections });
          badEncoder.clearBuffer(receipt);
          for (const p of compositeExecution.pairs) {
            encodeReceipt(device,badEncoder, /* wgsl */ `
              @group(0) @binding(0) var<storage,read> state: array<u32>;
              @group(0) @binding(1) var<storage,read_write> receipt: array<atomic<u32>>;
              @compute @workgroup_size(1) fn check() {
                if (state[2] != 5u || state[27] == 0u || state[60] != 0u || state[61] != 0u || state[62] != 0u) { atomicOr(&receipt[0],1u); }
                atomicAdd(&receipt[1],1u);
              }`,[p.stateBuffer,receipt]);
          }
          if (forceCase) {
            encodeReceipt(device,badEncoder,/* wgsl */ `
              @group(0) @binding(0) var<storage,read> control:array<u32>;
              @group(0) @binding(1) var<storage,read_write> receipt:array<u32>;
              @compute @workgroup_size(1) fn check() {
                if(control[2]!=5u || control[18]==0u) { receipt[0]|=2u; }
                receipt[2]=control[2];receipt[3]=control[18];
              }`,[compositeExecution.correction.controlBuffer,receipt]);
          }
          const badPending=readReceipt(device,badEncoder,receipt,readback);
          compositeRuntime.markExecutionSubmitted(compositeExecution);
          compositeNegativeWords=await badPending;
          await compositeRuntime.releaseExecutionAfter(compositeExecution); compositeExecution=null;
          device.queue.writeBuffer(nativeFine.fieldViewBuffer,63*4,new Uint32Array([nativeFine.stateMutationOrdinal]));
        }
      }
      const allOwned = pairs.every(p => validateSchroederSpatialParentFieldViewDescriptor(p.parentFieldView).admitted
        && p.hierarchyViewRuntime.isExecutionSubmitted(p.hierarchyView));
      const inheritedIdentity = pairs.every((p,i) => p.parentFieldView.inheritedFineParentView === (i ? pairs[i-1].parentFieldView : null));
      const capacityBound = levelCount === 2 || pairs.every(p => p.parentFieldView.parentFieldCapacity <= 54);
      if (levelCount === 3 && cycle === 0 && words[0] === 0) {
        const p = pairs[1];
        try {
          p.parentFieldViewRuntime.encode(device.createCommandEncoder(), {
            mechanicsFieldViews: p.parentFieldView.mechanicsFieldViews, hierarchyView: p.hierarchyView,
            inheritedFineParentView: { ...pairs[0].parentFieldView }
          });
        } catch (error) { clonedPredecessorRejected = /exact live preceding/.test(error.message); }
        for (const kind of ['capacity', 'stale-source']) {
          negatives.push(await rejectBadTopology(device, generation, kind, receipt, readback));
        }
      }
      if (!releaseSchroederSpatialEpochGenerationAfterQueue(generation, device)) {
        throw new Error(`Retirement rejected: ${generation.releaseReason}`);
      }
      const released = await generation.releasePromise;
      const allReleased = released === true && pairs.every(p => p.parentFieldView.released && p.hierarchyView.released)
        && generation.mechanicsLevelViews.every(v => v.mechanicsFieldView.released && v.mechanicsView.released
          && v.phaseVolumeMoment.released && v.phaseVolumeReceipt.released);
      let retiredChainRejected = false;
      try { resolveSchroederSpatialMechanicsChainAuthority(transaction, authorityOptions); }
      catch (error) { retiredChainRejected = error.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_IDENTITY'; }
      abortSchroederSpatialEpochTransaction(transaction);
      transaction = null;
      cycles.push({ words, allOwned, inheritedIdentity, capacityBound, allReleased,
        chainAuthenticated, beforeP2gRejected, retiredChainRejected,
        compositeWords, compositeNegativeWords, correctionWords, publicationWords, particleWords, closureWords, privateWords, continuationWords, wallContinuationWords, reactionContinuationWords, pressureContinuation, producerChecks,
        unprojectedRejected, cloneRejected, backpressureRejected });
      generation = null;
    }
    await device.queue.onSubmittedWorkDone();
    return { levelCount, cycles, negatives, clonedPredecessorRejected, errors };
  } catch (error) {
    return { levelCount, fatal: error.stack || String(error), cycles, negatives, errors };
  } finally {
    if (compositeExecution) {
      try { await compositeRuntime.releaseExecutionAfter(compositeExecution); }
      catch(error) {
        if(!/requires submitted work/.test(error.message)) throw error;
        compositeRuntime.discardExecution(compositeExecution,{discardedEncoder:true});
      }
    }
    compositeRuntime?.destroy();
    if (transaction) abortSchroederSpatialEpochTransaction(transaction);
    if (generation && releaseSchroederSpatialEpochGenerationAfterQueue(generation, device)) {
      await generation.releasePromise;
    }
    if(exactUploads) {destroySphGpuParticleBuffers(exactUploads[0]);destroyMlsMpmGpuParticleBuffers(exactUploads[1]);}
    destroyResponse?.();
    for (const buffer of owned) buffer.destroy();
    device.destroy();
  }
}

// Advance genuine retained successors without mapping any intermediate state.
// The compact receipt covers every closure decision, the carried clock, fresh
// GPU assignment positions, finite state and actual movement. Cleanup happens
// only after the caller's completed batch, in reverse ownership order.
async function continueLevelChain({device,source,privateSteps,privatePublish,mechanicsLevels,forceInputs,
  mechanicsMaterialTable,surfaceReferenceTable,thermalMaterialTable,thermalResponseGraphUpload,receipt,readback,continuationRejected,finiteWalls,privateWallFault,thermalStepOptions,reactionTable,privateReactionFault,privateReactionCarry,privateInventoryFault,continuationRejectedAfter,continuationRejectionMask,privatePressure,privatePressureRejected,privateNativeTransport}) {
  const {runSchroederSpatialChainStepWebGpu}=await import('../../src/runtime/sph/schroederSpatialChainStepGpu.js');
  const owners=await import('../../src/runtime/sph/sphGpuBuffers.js');
  const successors=[],publications=[],wallChecks=[],wallSnapshots=[];const pressure=[],pressureReferences=[];
  const pressureReceipt=privatePressure!=null?device.createBuffer({label:"private pressure interval receipt",size:128,usage:140}):null;
  const reactionChecks=[],reactionSnapshots=[];
  const reactionReceipt=reactionTable?device.createBuffer({label:'private chain reaction receipt',size:128,usage:128|4|8}):null;
  const wallReceipt=finiteWalls?device.createBuffer({label:'private chain wall receipt',size:128,usage:128|4|8}):null;
  const {uploadMlsMpmMechanicsMaterialPhaseRecords}=await import('../../src/runtime/sph/sphMechanicsRefreshGpuKernel.js');
  const phaseUpload=privateNativeTransport || mechanicsMaterialTable.surfaceTensionEnabled
    ? uploadMlsMpmMechanicsMaterialPhaseRecords(device,mechanicsMaterialTable) : null;
  const surfaceReferenceUpload=surfaceReferenceTable && privateNativeTransport
    ? uploadMlsMpmMechanicsMaterialPhaseRecords(device,surfaceReferenceTable) : null;
  let current=source;
  try {
    for(let i=0;i<privateSteps;i++) {
      if(reactionTable) {
        const read=owners.acquireSphParticleExactMassRead(current.nextParticleUploads.sphParticleUpload,device);
        try {
          if(!read.reactionLineage || !read.residentProductHistoryRead || !read.residualHistory) throw new Error('Private reaction lost retained lineage/history');
          const snapshot=device.createBuffer({label:'private predecessor lineage snapshot',size:read.reactionLineage.buffer.size,usage:128|4|8});
          const residualSnapshot=device.createBuffer({label:'private predecessor canonical residual snapshot',size:read.residualHistory.buffer.size,usage:128|4|8});
          reactionSnapshots.push(snapshot,residualSnapshot);
          const copy=device.createCommandEncoder();copy.copyBufferToBuffer(read.reactionLineage.buffer,0,snapshot,0,snapshot.size);
          copy.copyBufferToBuffer(read.residualHistory.buffer,0,residualSnapshot,0,residualSnapshot.size);
          device.queue.submit([copy.finish()]);
          reactionChecks.push({source:read.reactionLineage.buffer,snapshot,residual:read.residualHistory,residualSnapshot});
        } finally {await owners.releaseSphParticleExactMassRead(read);}
      }
      let wallRead=null,wallSnapshot=null;
      if(finiteWalls) {
        wallRead=owners.acquireSphParticleExactMassRead(current.nextParticleUploads.sphParticleUpload,device);
        try {
          wallSnapshot=device.createBuffer({label:'private predecessor wall snapshot',size:wallRead.finiteWallState.buffer.size,usage:128|4|8});
          wallSnapshots.push(wallSnapshot);
          const copy=device.createCommandEncoder();
          copy.copyBufferToBuffer(wallRead.finiteWallState.buffer,0,wallSnapshot,0,wallSnapshot.size);
          device.queue.submit([copy.finish()]);
          wallChecks.push({source:wallRead.finiteWallState.buffer,energy:wallRead.energy.energyBuffer,snapshot:wallSnapshot});
        } finally {await owners.releaseSphParticleExactMassRead(wallRead);}
      }
      let candidateWall=null,candidateEnergy=null;
      const lateFault=privateWallFault && i===1;
      const reactionFault=privateReactionFault && i===1;
      const inventoryFault=privateInventoryFault && i===1;
      const stepOptions={device,retainForPublication:privatePublish && i>=1,
        phaseVolumeInterfaceTransportRequired:privateNativeTransport,mechanicsMaterialPhaseUpload:phaseUpload,phaseVolumePressureScale:0,
        ...(privatePressure!=null?{gasPressureMechanicsBoundaryEnabled:true,ambientPressurePa:0,gasPressureMechanicsScale:privatePressure}:{}),
        sphParticleState:current.sphParticleState,mlsMpmParticleState:current.mlsMpmParticleState,
        ...current.nextParticleUploads,mechanicsLevels,
        classificationPolicy:{baseGridSpacingM:.5,targetSupportCells:2,supportRadiusScale:1,hysteresisBand:0},
        forceInputs,internalPressureScale:0,mechanicsMaterialTable,thermalMaterialTable,thermalResponseGraphUpload,
        mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
        closureOptions:{reactionTable:privateReactionCarry && i>=1?null:reactionTable,spatialReactionDiscoveryProposalRunner:runSchroederSpatialReactionDiscoveryProposalWebGpu,
          thermalStepOptions:{...thermalStepOptions,conductionRate:0},
          ...(lateFault || reactionFault || inventoryFault?{timedStage:async(name,run)=>{
            const stage=await run();
            if(lateFault && name==='thermalStep') candidateWall=stage.exactFiniteWall;
            if(inventoryFault && name==='thermalStep') {
              candidateEnergy=stage.exactEnergy;
              if(privatePressure!=null) {
                // Inject before phase transfer consumes this exact predecessor;
                // touching it after phase transfer would miss the successor.
                const encoder=device.createCommandEncoder();
                encodeReceipt(device,encoder,`@group(0) @binding(0) var<storage,read_write> energy:array<u32>;
                  @compute @workgroup_size(1) fn check(){energy[0]^=1u;}`, [candidateEnergy.energyBuffer]);
                device.queue.submit([encoder.finish()]);
              }
            }
            if(inventoryFault && name==='mechanicsRefresh' && privatePressure==null) {
              if(!candidateEnergy) throw new Error('Missing genuine carry energy for conservation fault');
              device.queue.writeBuffer(candidateEnergy.energyBuffer,0,new Uint32Array([1]));
            }
            if(lateFault && name==='mechanicsRefresh') device.queue.writeBuffer(candidateWall.buffer,0,new Float32Array([0]));
            if(reactionFault && name==='reactionStep') {
              const lineage=stage.reactionLineageRecord;
              device.queue.writeBuffer(lineage.buffer,privateReactionFault==='count'?0:40,
                new Uint32Array([privateReactionFault==='count'?lineage.capacity+1:0xffffffff]));
            }
            return stage;
          }}:{})}};
      if(privateWallFault && i===0) {
        for(const wallReservoirAuthority of [undefined,{...thermalStepOptions.wallReservoirAuthority,instanceId:'wrong-private-wall'}]) {
          let refused=false;
          try {await runSchroederSpatialChainStepWebGpu({...stepOptions,closureOptions:{thermalStepOptions:{
            ...thermalStepOptions,wallReservoirAuthority}}});}
          catch(error) {
            await error.chainStepCleanupCompletion;
            refused=/same explicit wall authority/.test(error.message);
            if(!refused) throw error;
          }
          if(!refused) throw new Error('Private wall continuation dropped or replaced its authority');
        }
      }
      const reference=privatePressure!=null && i===0?await runSchroederSpatialChainStepWebGpu({...stepOptions,
        ...(surfaceReferenceTable?{mechanicsMaterialTable:surfaceReferenceTable,
          mechanicsMaterialPhaseUpload:surfaceReferenceUpload}:
          {gasPressureMechanicsBoundaryEnabled:privatePressure>0,gasPressureMechanicsScale:0})}):null;
      if(reference)pressureReferences.push(reference);
      const next=await runSchroederSpatialChainStepWebGpu(stepOptions);
      successors.push(next);
      if(privatePressure!=null) {
        pressure.push(next.gasPressure);
        const before=owners.acquireSphParticleExactMassRead(current.nextParticleUploads.sphParticleUpload,device);
        const after=owners.acquireSphParticleExactMassRead(next.nextParticleUploads.sphParticleUpload,device);
        try{
          const encoder=device.createCommandEncoder();
          encodeReceipt(device,encoder,pressureIntervalReceipt({count:after.particleCount,
            beforeOffset:before.read.rowOffset,afterOffset:after.read.rowOffset,step:i,
            rejected:inventoryFault||privatePressureRejected,compare:Boolean(reference)&&!privatePressureRejected&&!surfaceReferenceTable,enabled:privatePressure>0}),
            [before.read.buffer,after.read.buffer,before.energy.energyBuffer,after.energy.energyBuffer,
              next.nextParticleUploads.sphParticleUpload.stateBuffer,current.nextParticleUploads.sphParticleUpload.stateBuffer,
              (reference??next).nextParticleUploads.sphParticleUpload.stateBuffer,pressureReceipt]);
          if(reference && surfaceReferenceTable) {
            // Symmetric surface stress may leave centre-of-mass velocity fixed
            // while changing the actual particle affine velocity gradient.
            encodeReceipt(device,encoder,`
              @group(0) @binding(0) var<storage,read> state:array<u32>;
              @group(0) @binding(1) var<storage,read> baseline:array<u32>;
              @group(0) @binding(2) var<storage,read> mechanics:array<u32>;
              @group(0) @binding(3) var<storage,read> baseline_m:array<u32>;
              @group(0) @binding(4) var<storage,read_write> receipt:array<u32>;
              @compute @workgroup_size(1) fn check(){
                var changed=0u;
                for(var row=0u;row<${after.particleCount}u;row++){
                  if(bitcast<f32>(state[row*8u+3u])<=0.0){continue;}
                  for(var w=4u;w<7u;w++){if(state[row*8u+w]!=baseline[row*8u+w]){changed++;}}
                  for(var w=9u;w<18u;w++){if(mechanics[row*32u+w]!=baseline_m[row*32u+w]){changed++;}}
                }
                receipt[8]=changed;receipt[9]=${mechanicsMaterialTable.surfaceTensionEnabled?1:0}u;
                if((changed>0u)!=${mechanicsMaterialTable.surfaceTensionEnabled}){receipt[0]|=64u;}
              }`,[next.nextParticleUploads.sphParticleUpload.stateBuffer,reference.nextParticleUploads.sphParticleUpload.stateBuffer,
                next.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,reference.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,pressureReceipt]);
          }
          if(inventoryFault || privatePressureRejected) for(const key of ['thermoBuffer','mechanicsBuffer']){
            const old=key==='thermoBuffer'?current.nextParticleUploads.sphParticleUpload:current.nextParticleUploads.mlsMpmParticleUpload;
            const updated=key==='thermoBuffer'?next.nextParticleUploads.sphParticleUpload:next.nextParticleUploads.mlsMpmParticleUpload;
            encodeReceipt(device,encoder,`@group(0) @binding(0) var<storage,read> old:array<u32>;
              @group(0) @binding(1) var<storage,read> updated:array<u32>;
              @group(0) @binding(2) var<storage,read_write> receipt:array<u32>;
              @compute @workgroup_size(1) fn check(){for(var w=0u;w<arrayLength(&old);w++){
                if(old[w]!=updated[w]){receipt[0]|=32u;}}}`, [old[key],updated[key],pressureReceipt]);
          }
          device.queue.submit([encoder.finish()]);
        }finally{await owners.releaseSphParticleExactMassRead(after);await owners.releaseSphParticleExactMassRead(before);}
      }
      if(finiteWalls && next.wallRecord.originalBuffer!==wallChecks[i].source) throw new Error('Private step did not consume its retained wall predecessor');
      if(next.assignment.sourceStateBuffer!==current.nextParticleUploads.sphParticleUpload.stateBuffer
        || next.assignment.sourceMechanicsBuffer!==current.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
        || next.assignment.fullReadbackPerformed || next.residentContinuationReady
        || next.sphParticleState.step!==current.sphParticleState.step
        || next.sphParticleState.time!==current.sphParticleState.time) throw new Error('Repeated chain lost private GPU source authority');
      current=next;
      if(privatePublish && i>=1) {
        const {publishSchroederSpatialChainBatchWebGpu}=await import('../../src/runtime/sph/schroederSpatialChainPublicationGpu.js');
        const published=await publishSchroederSpatialChainBatchWebGpu({device,finalStep:next});
        publications.push(published);current=published;
        if(!published.publication.published || published.clockReceipt.mapAsyncCount!==1
          || published.clockReceipt.readbackBytes!==128)throw new Error('Auxiliary chain publication did not use the existing spatial owner');
      }
    }
    if(privatePublish && publications.length!==Math.max(0,privateSteps-1))throw new Error('Missing auxiliary chain publication');
    const encoder=device.createCommandEncoder();encoder.clearBuffer(receipt);
    if(wallReceipt) encoder.clearBuffer(wallReceipt);
    if(reactionReceipt) encoder.clearBuffer(reactionReceipt);
    for(const [i,next] of successors.entries()) {
      const physicalRejection=continuationRejected || (continuationRejectedAfter!=null && i>=continuationRejectedAfter);
      const rejected=physicalRejection || privatePressureRejected || ((privateWallFault || privateReactionFault || privateInventoryFault) && i===1);
      const prior=i?successors[i-1]:source;
      if(reactionReceipt) {
        const old=owners.acquireSphParticleExactMassRead(prior.nextParticleUploads.sphParticleUpload,device);
        const read=owners.acquireSphParticleExactMassRead(next.nextParticleUploads.sphParticleUpload,device);
        try {
          if(!read.residualHistory || old.residualHistory!==reactionChecks[i].residual
            || read.residualHistory.buffer===old.residualHistory.buffer
            || read.residualHistory.generation!==old.residualHistory.generation+1
            || read.residualHistory.seal===old.residualHistory.seal) throw new Error('Private step lost its canonical residual successor');
          encodeReceipt(device,encoder,`
            @group(0) @binding(0) var<storage,read> history:array<u32>;
            @group(0) @binding(1) var<storage,read> old:array<u32>;
            @group(0) @binding(2) var<storage,read> snapshot:array<u32>;
            @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
            @compute @workgroup_size(1) fn check(){
              if(history[0]!=0x50484731u || history[3]!=0u || old[3]!=0u
                || history[4]!=old[4] || history[5]!=old[5] || history[6]!=old[6]+1u
                || history[7]!=${read.residualHistory.seal}u || history[8]!=0u
                || history[9]!=1u || history[10]!=1u || history[11]!=0u){receipt[${i*8}]|=16384u;}
              for(var w=0u;w<arrayLength(&old);w++) {
                if(old[w]!=snapshot[w]){receipt[${i*8}]|=32768u;}
                if(w>=64u && history[w]!=0u){receipt[${i*8}]|=65536u;}
              }
            }`,[read.residualHistory.buffer,old.residualHistory.buffer,reactionChecks[i].residualSnapshot,reactionReceipt]);
          encodeReceipt(device,encoder,chainReactionReceiptShader({particleCount:read.particleCount,rejected,
            sourceMassOffset:old.read.byteOffset/4,candidateMassOffset:read.read.byteOffset/4,
            continuation:true,waterId:0,phaseTransfer:false}).replaceAll('receipt[',`receipt[${i*8}u+`),
            [read.read.buffer,old.read.buffer,read.energy.energyBuffer,old.energy.energyBuffer,
              next.nextParticleUploads.sphParticleUpload.stateBuffer,next.nextParticleUploads.sphParticleUpload.thermoBuffer,
              reactionReceipt,read.residentProductHistoryRead.buffer]);
          encodeReceipt(device,encoder,`
            @group(0) @binding(0) var<storage,read> lineage:array<u32>;
            @group(0) @binding(1) var<storage,read> old:array<u32>;
            @group(0) @binding(2) var<storage,read> snapshot:array<u32>;
            @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
            @group(0) @binding(4) var<storage,read> fine:array<u32>;
            @group(0) @binding(5) var<storage,read> updated:array<u32>;
            @group(0) @binding(6) var<storage,read> control:array<u32>;
            @compute @workgroup_size(1) fn check(){
              receipt[${i*8+3}]=old[0];receipt[${i*8+4}]=lineage[0];
              receipt[${i*8+7}]=fine[29];
              receipt[${i*8+6}]=updated[29];
              receipt[${i*8+5}]=control[18];
              if((fine[29]&8u)!=0u) {for(var w=0u;w<8u;w++) {receipt[24u+w]=fine[40u+w];}}
              if((updated[29]&2u)!=0u) {for(var w=0u;w<8u;w++) {receipt[24u+w]=updated[40u+w];}}
              if((control[2]&4096u)!=0u) {
                for(var w=0u;w<6u;w++) {receipt[24u+w]=control[17u+w];}
                receipt[30]=${i}u;receipt[31]=control[2];
              }
              if(lineage[0]<old[0] || lineage[0]>65536u || lineage[1]!=0u){receipt[${i*8}]|=1024u;}
              for(var w=0u;w<arrayLength(&old);w++) {
                if(old[w]!=snapshot[w]){receipt[${i*8}]|=2048u;}
                if(${rejected} && lineage[w]!=old[w]){receipt[${i*8}]|=4096u;}
                if(w>=8u && w<8u+old[0]*8u && lineage[w]!=old[w]){receipt[${i*8}]|=8192u;}
              }
            }`,[read.reactionLineage.buffer,old.reactionLineage.buffer,reactionChecks[i].snapshot,reactionReceipt,
              next.correction.nativeStates[0].stateBuffer,next.correction.updatedPairs.at(-1).stateBuffer,next.admissionControlBuffer]);
        } finally {await owners.releaseSphParticleExactMassRead(read);await owners.releaseSphParticleExactMassRead(old);}
      }
      if(wallReceipt) {
        const read=owners.acquireSphParticleExactMassRead(next.nextParticleUploads.sphParticleUpload,device);
        try {
          if(read.finiteWallState.buffer!==next.wallRecord.buffer) throw new Error('Private step dropped its wall successor');
          encodeReceipt(device,encoder,chainWallReceiptShader({particleCount:read.particleCount,rejected,
            isolated:true,kind:finiteWalls,receiptOffset:i*8,mechanics:true}),
            [next.wallRecord.buffer,next.wallRecord.originalBuffer,wallChecks[i].snapshot,read.energy.energyBuffer,
              wallChecks[i].energy,next.wallRecord.validationBuffer,wallReceipt,next.postMechanicsStateBuffer]);
        } finally {await owners.releaseSphParticleExactMassRead(read);}
      }
      encodeReceipt(device,encoder,`
        @group(0) @binding(0) var<storage,read> control:array<u32>;
        @group(0) @binding(1) var<storage,read> clock:array<u32>;
        @group(0) @binding(2) var<storage,read> state:array<f32>;
        @group(0) @binding(3) var<storage,read> old:array<f32>;
        @group(0) @binding(4) var<storage,read> assignment:array<f32>;
        @group(0) @binding(5) var<storage,read_write> receipt:array<u32>;
        @group(0) @binding(6) var<storage,read> mechanics:array<u32>;
        @group(0) @binding(7) var<storage,read> force:array<u32>;
        @group(0) @binding(8) var<storage,read> fine:array<u32>;
        @group(0) @binding(9) var<storage,read> coarse:array<u32>;
        @group(0) @binding(10) var<storage,read> restriction:array<u32>;
        @group(0) @binding(11) var<storage,read> updated:array<u32>;
        @compute @workgroup_size(1) fn check(){
          receipt[1]=clock[2];receipt[2]=clock[3];receipt[3]=clock[12];
          receipt[4u+${i}u]=control[2];
          receipt[8u+${i}u]=mechanics[2];receipt[12u+${i}u]=force[18];
          receipt[16u+${i}u]=fine[27];receipt[20u+${i}u]=coarse[27];
          receipt[24u+${i}u]=restriction[27];receipt[28u+${i}u]=updated[27];
          if(${privateSteps===1}) {
            var maxSpeed=0.0;var bad=0u;var cfl=0u;
            let vmax:f32=${forceInputs.cflFactor*mechanicsLevels.at(-1).mechanicsGrid.gridSpacingM/forceInputs.dt};
            for(var row=0u;row<updated[17];row++) {
              let b=64u+row*8u;let mass=bitcast<f32>(updated[b]);
              let momentum=vec3<f32>(bitcast<f32>(updated[b+1u]),bitcast<f32>(updated[b+2u]),bitcast<f32>(updated[b+3u]));
              if(mass>0.0) {
                maxSpeed=max(maxSpeed,length(momentum/mass));
                if(dot(momentum,momentum)>mass*mass*vmax*vmax){cfl++;}
                let k=dot(momentum,momentum)/(2.0*mass);let budget=bitcast<f32>(updated[b+7u]);
                if(k>budget+max(1e-12,abs(budget)*3e-5)){bad|=1u;}
              }
              for(var w=0u;w<8u;w++) {
                let value=bitcast<f32>(updated[b+w]);
                if(!(abs(value)<=3.402823e38)){bad|=2u;}
                if(mass==0.0 && value!=0.0){bad|=4u;}
              }
              if(mass<0.0 || bitcast<f32>(updated[b+7u])<0.0){bad|=8u;}
            }
            receipt[17]=bitcast<u32>(maxSpeed);receipt[18]=bitcast<u32>(vmax);receipt[19]=bad;receipt[23]=cfl;
          }
          if(${rejected}) {
            if(control[1]!=5u || control[2]==0u || clock[10]!=0u || (${physicalRejection} && ((control[2]&${continuationRejectionMask}u)==0u || (${continuationRejectionMask===1} && (updated[27]&8u)==0u)))) {receipt[0]|=1u;}
          } else if(control[1]!=3u || control[2]!=0u || clock[10]!=1u) {receipt[0]|=1u;}
          var moved=false;
          for(var row=0u;row<arrayLength(&state)/8u;row++) {
            for(var w=0u;w<8u;w++){
              if(!(abs(state[row*8u+w])<=3.402823e38)){receipt[0]|=2u;}
              if(${rejected} && bitcast<u32>(state[row*8u+w])!=bitcast<u32>(old[row*8u+w])){receipt[0]|=16u;}
            }
            for(var w=0u;w<3u;w++) {
              if(assignment[row*16u+12u+w]!=old[row*8u+w]) {receipt[0]|=4u;}
              if(old[row*8u+3u]>0.0 && state[row*8u+w]!=old[row*8u+w]) {moved=true;}
            }
          }
          // Reaction can exactly cancel the initial opposing momentum.
          if(!${rejected} && !${Boolean(reactionTable)} && !moved){receipt[0]|=8u;}
        }`,[next.admissionControlBuffer,next.clock.buffer,next.nextParticleUploads.sphParticleUpload.stateBuffer,
          prior.nextParticleUploads.sphParticleUpload.stateBuffer,next.assignment.assignmentBuffer,receipt,
          next.mechanicsControlBuffer,next.forceControlBuffer,
          next.correction.nativeStates[0].stateBuffer,next.correction.nativeStates.at(-1).stateBuffer,
          next.restriction.at(-1).stateBuffer,next.correction.updatedPairs.at(-1).stateBuffer]);
    }
    const words=await readReceipt(device,encoder,receipt,readback);
    const wallWords=wallReceipt?await readReceipt(device,device.createCommandEncoder(),wallReceipt,readback):null;
    const reactionWords=reactionReceipt?await readReceipt(device,device.createCommandEncoder(),reactionReceipt,readback):null;
    let refused=false;try{await current.retire(Promise.resolve(false));}catch{refused=true;}
    if(!refused) throw new Error('Repeated chain retired without confirmed batch completion');
    const pressureWords=pressureReceipt?await readReceipt(device,device.createCommandEncoder(),pressureReceipt,readback):null;
    return {words,wallWords,reactionWords,pressure:{consumers:pressure,words:pressureWords}};
  } finally {
    const after=device.queue.onSubmittedWorkDone().then(()=>true);
    await after;
    for(const published of publications.reverse())await published.retire(after);
    for(const next of successors.reverse()) await next.retire(after);
    for(const reference of pressureReferences.reverse())await reference.retire(after);
    pressureReceipt?.destroy();phaseUpload?.destroyMechanicsMaterialPhaseUpload();surfaceReferenceUpload?.destroyMechanicsMaterialPhaseUpload();
    wallReceipt?.destroy();for(const buffer of wallSnapshots) buffer.destroy();
    reactionReceipt?.destroy();for(const buffer of reactionSnapshots) buffer.destroy();
  }
}
