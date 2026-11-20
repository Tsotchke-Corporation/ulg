import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactPhaseLedgerReconcileStage } from '../src/runtime/sph/sphExactPhaseLedgerReconcileGpu.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format,
  sphExactThermalEnergyRecordWords } from '../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { createSphExactMassInventoryWebGpu, acquireSphExactMassRead, forkSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory, validateSphExactMassRead } from '../src/runtime/sph/sphExactMassInventoryGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

// Ownership protocol only. Numerical phase acceptance runs on native WebGPU.
function fixture() {
  let fences=0;
  const device={ lost:new Promise(()=>{}), limits:{maxBufferSize:1e7,maxStorageBufferBindingSize:1e7},
    queue:{writeBuffer(){},submit(){},onSubmittedWorkDone(){fences++;return Promise.resolve();}},
    createBuffer(options){return {...options,destroyed:false,destroy(){this.destroyed=true;}};},
    createShaderModule:options=>options,createComputePipeline:options=>options,
    createBindGroupLayout:options=>options,createPipelineLayout:options=>options,createBindGroup:options=>options,
    createCommandEncoder(){return {beginComputePass(){return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},finish(){return {};}};}
  };
  const buffer=size=>tagWebGpuBufferDevice(device.createBuffer({size,usage:140}),device);
  const family=createSphExactMassInventoryWebGpu({device,format,massesKg:[1,0,0,0],
    provenance:{kind:'initial-conditions',reference:'phase ownership protocol'}});
  const massRead=acquireSphExactMassRead({device,family});
  const energy={format,rowCount:4,energyBuffer:buffer(sphExactThermalEnergyRecordWords(4)*4)};
  const stage=createSphExactPhaseLedgerReconcileStage({device,lineageCount:1,laneStride:1,particleCount:4,
    inputStateBuffer:buffer(128),outStateBuffer:buffer(128),outThermoBuffer:buffer(192),
    outMechanicsBuffer:buffer(512),massRead,energy});
  const encoder=device.createCommandEncoder();stage.encode(encoder);device.queue.submit([encoder.finish()]);
  return {device,stage,committed:stage.commit(),fences:()=>fences,
    async closeSource(){releaseSphExactMassInventory(family);await releaseSphExactMassRead(massRead);}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('abandoned phase output retires both ledger allocations behind the existing two fences', async()=>{
  const f=fixture(), output=f.committed;
  const pending=f.stage.releaseUnadopted(output);
  assert.equal(output.exactEnergy.energyBuffer.destroyed,false);
  await pending;await flush();
  assert.equal(output.exactEnergy.energyBuffer.destroyed,true);
  assert.equal(output.carrierMassRead.buffer.destroyed,true);
  assert.throws(()=>acquireSphExactMassRead({device:f.device,family:output.carrierMassRead.family}),/live original family/);
  assert.equal(f.fences(),2,'read retirement and family retirement replace preliminary cleanup and read retirement');
  await f.closeSource();
});

test('phase producer retirement preserves delegated mass and adopted energy', async()=>{
  const f=fixture(), output=f.committed;
  const inherited=forkSphExactMassRead(output.carrierMassRead,{device:f.device});
  output.transferExactEnergy();
  await f.stage.releaseUnadopted(output);await flush();
  assert.equal(output.exactEnergy.energyBuffer.destroyed,false);
  assert.equal(inherited.buffer.destroyed,false);
  assert.equal(validateSphExactMassRead(inherited,{device:f.device,family:inherited.family,
    format,expectedGeneration:inherited.generation}),true);
  assert.equal(f.fences(),1);
  await releaseSphExactMassRead(inherited);await flush();
  assert.equal(inherited.buffer.destroyed,true);
  output.exactEnergy.energyBuffer.destroy();await f.closeSource();
});
