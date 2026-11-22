import assert from 'node:assert/strict';
import test from 'node:test';
import {createSchroederPhaseSlotMaterializer} from '../src/runtime/sph/schroederPhaseSlotMaterializationGpu.js';
import {SPH_EXACT_THERMAL_ENERGY_FORMAT as format,sphExactThermalEnergyRecordWords} from '../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import {createSphExactMassInventoryWebGpu,acquireSphExactMassRead,forkSphExactMassRead,
  releaseSphExactMassRead,releaseSphExactMassInventory,validateSphExactMassRead} from '../src/runtime/sph/sphExactMassInventoryGpu.js';
import {tagWebGpuBufferDevice} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

globalThis.GPUBufferUsage ??= {STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64};
// Ownership protocol only; native tests execute the numerical kernels.
function fixture(exact=false) {
  let fences=0;
  const device={lost:new Promise(()=>{}),limits:{maxBufferSize:1e7,maxStorageBufferBindingSize:1e7,
    maxStorageBuffersPerShaderStage:13,maxComputeWorkgroupsPerDimension:65535},
    queue:{writeBuffer(){},submit(){},onSubmittedWorkDone(){fences++;return Promise.resolve();}},
    createBuffer(options){return {...options,destroyed:false,failures:0,destroy(){
      if(this.failures>0){this.failures--;throw new Error('destroy failed');}this.destroyed=true;
    }};},
    createShaderModule:o=>o,createComputePipeline:o=>o,createBindGroupLayout:o=>o,
    createPipelineLayout:o=>o,createBindGroup:o=>o,
    createCommandEncoder(){return {copyBufferToBuffer(){},beginComputePass(){return {
      setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},finish(){return {};}};}
  };
  const make=size=>tagWebGpuBufferDevice(device.createBuffer({size,usage:140}),device);
  let family,massRead,energy;
  if(exact) {
    family=createSphExactMassInventoryWebGpu({device,format,massesKg:[1,0,0,0,0,0,0,0],
      provenance:{kind:'initial-conditions',reference:'refinement ownership protocol'}});
    massRead=acquireSphExactMassRead({device,family});
    energy={format,rowCount:8,energyBuffer:make(sphExactThermalEnergyRecordWords(8)*4)};
  }
  const stage=createSchroederPhaseSlotMaterializer(device,{lineageCapacity:2,firstSpareLineage:1,spareCount:1,
    assignmentRowCount:1,thermalMaterialTable:{segments:new Float32Array(12)},boxDimsM:[10,10,10],
    admissionApproved:true,exactLedger:exact?{massRead,energy}:null});
  const encoder=device.createCommandEncoder();stage.encode(encoder,{sourceStateBuffer:make(256),
    sourceThermoBuffer:make(384),sourceMechanicsBuffer:make(1024),slotAssignmentBuffer:make(128),spareLineagesBuffer:make(4)});
  device.queue.submit([encoder.finish()]);
  return {device,stage,fences:()=>fences,async close(){stage.destroy();
    if(exact){releaseSphExactMassInventory(family);await releaseSphExactMassRead(massRead);energy.energyBuffer.destroy();}}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('refinement validation survives scratch and partial output retirement, with retry after failure',async()=>{
  const f=fixture(),s=f.stage;
  s.cleanupSubmittedWork();assert.equal(s.evidenceBuffer.destroyed,false);
  s.destroyOutputParticleBufferComponents({state:true,thermo:true});
  assert.equal(s.evidenceBuffer.destroyed,false);
  s.mechanicsBuffer.failures=1;
  assert.throws(()=>s.destroyOutputParticleBufferComponents({mechanics:true}),/destroy failed/);
  assert.equal(s.evidenceBuffer.destroyed,false);
  s.evidenceBuffer.failures=1;
  assert.throws(()=>s.destroyOutputParticleBufferComponents({mechanics:true}),/destroy failed/);
  assert.equal(s.evidenceBuffer.destroyed,false);
  s.destroyOutputParticleBufferComponents({mechanics:true});
  assert.equal(s.evidenceBuffer.destroyed,true);await f.close();
});

test('abandoned refinement energy retires after its mass-read fence',async()=>{
  const f=fixture(true),out=f.stage.ledgerStage.commit();
  const done=f.stage.ledgerStage.releaseUnadopted(out);
  assert.equal(out.exactEnergy.energyBuffer.destroyed,false);
  await done;await flush();
  assert.equal(out.exactEnergy.energyBuffer.destroyed,true);
  assert.equal(out.carrierMassRead.buffer.destroyed,true);
  // Queue fence coalescing retires the unshared exact-mass inventory on the
  // already-confirmed mass-read fence without adding a second redundant wait.
  assert.ok(f.fences()>=1 && f.fences()<=2);await f.close();
});

test('refinement retirement preserves delegated mass and adopted energy',async()=>{
  const f=fixture(true),out=f.stage.ledgerStage.commit();
  const read=forkSphExactMassRead(out.carrierMassRead,{device:f.device});out.transferExactEnergy();
  await f.stage.ledgerStage.releaseUnadopted(out);await flush();
  assert.equal(out.exactEnergy.energyBuffer.destroyed,false);assert.equal(read.buffer.destroyed,false);
  assert.equal(validateSphExactMassRead(read,{device:f.device,family:read.family,format,expectedGeneration:read.generation}),true);
  assert.equal(f.fences(),1);await releaseSphExactMassRead(read);await flush();
  assert.equal(read.buffer.destroyed,true);out.exactEnergy.energyBuffer.destroy();await f.close();
});
