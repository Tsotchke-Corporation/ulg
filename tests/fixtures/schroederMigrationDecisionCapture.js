import { schroederPhaseVolumeMigrationWgsl } from '../../ulg-gpu-abi/src/wgsl.js';

// Test-only interception keeps the production runner and its buffer ownership
// unchanged. Append a read-only reduction before its queue-ordered cleanup.
const records = new WeakMap();
const encoders = new WeakMap();
const passes = new WeakMap();
const groups = new WeakMap();
const pending = new WeakMap();
const nativeEncoder = GPUDevice.prototype.createCommandEncoder;
const nativeGroup = GPUDevice.prototype.createBindGroup;
const nativePass = GPUCommandEncoder.prototype.beginComputePass;
const nativeSetGroup = GPUComputePassEncoder.prototype.setBindGroup;
const nativeFinish = GPUCommandEncoder.prototype.finish;

const code = `${schroederPhaseVolumeMigrationWgsl}
@group(0) @binding(6) var<storage, read_write> decision: array<u32>;
@compute @workgroup_size(1) fn capture_decisions() {
  for (var k=0u; k<16u; k++) { decision[k]=0u; }
  decision[10]=params.flags; decision[11]=params.particle_count;
  for (var i=0u; i<params.particle_count; i++) {
    let a=i*max(params.assignment_stride,16u);
    let m=i*max(params.migration_stride,32u);
    if (abs(level_assignments[a+8u]-params.gas_phase_id)>=0.5) { continue; }
    let volume=level_assignments[a+3u];
    if (!ss_pvm_positive(volume) || !ss_pvm_positive(level_assignments[a+4u])) {
      decision[8]++; continue;
    }
    decision[0]++;
    let ready=ss_pvm_interface_source_ready(i);
    let nearby=ss_pvm_condensed_interface(i);
    let support=ss_pvm_volume_radius(volume)*max(params.support_radius_scale,0.0);
    let threshold=max(params.target_support_cells,1.0)*level_assignments[a+1u]
      *(1.0+max(level_assignments[a+11u],0.0));
    let oversized=support>threshold;
    if (ready) { decision[1]++; }
    if (nearby) { decision[2]++; }
    if (oversized) { decision[3]++; }
    if (nearby && oversized) { decision[4]++; }
    if ((u32(migration_rows[m+31u])&64u)!=0u) { decision[5]++; }
    if (migration_rows[m+23u]>0.0) { decision[6]++; }
    if (migration_rows[m+3u]>=32.0) { decision[7]++; }
    decision[9]=max(decision[9],bitcast<u32>(support/max(threshold,1e-30)));
    if (migration_rows[m+22u]>0.0) { decision[12]++; }
  }
  for (var k=0u; k<9u; k++) { decision[16u+k]+=decision[k]; }
  decision[25]=max(decision[25],decision[9]);
  decision[26]++; decision[27]=1u; decision[15]=1u;
}`;

function recordFor(device) {
  let record=records.get(device);
  if (record) return record;
  const buffer=device.createBuffer({label:'test-migration-decisions',size:128,
    usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const layout=device.createBindGroupLayout({entries:Array.from({length:7},(_,binding)=>({
    binding,visibility:GPUShaderStage.COMPUTE,
    buffer:{type:binding===3?'uniform':binding===2||binding===6?'storage':'read-only-storage'},
  }))});
  const pipeline=device.createComputePipeline({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),
    compute:{module:device.createShaderModule({code}),entryPoint:'capture_decisions'}});
  record={buffer,pipeline,layout}; records.set(device,record); return record;
}

GPUDevice.prototype.createCommandEncoder=function(...args) {
  const encoder=nativeEncoder.apply(this,args);encoders.set(encoder,this);return encoder;
};
GPUDevice.prototype.createBindGroup=function(descriptor) {
  const group=nativeGroup.call(this,descriptor);
  if (descriptor.entries.length===6 && descriptor.entries.some(entry=>entry.binding===2
      && entry.resource.buffer?.label==='ulg-schroeder-phase-volume-migration-out')) {
    groups.set(group,descriptor.entries);
  }
  return group;
};
GPUCommandEncoder.prototype.beginComputePass=function(...args) {
  const pass=nativePass.apply(this,args);passes.set(pass,this);return pass;
};
GPUComputePassEncoder.prototype.setBindGroup=function(index,group,...args) {
  const entries=groups.get(group);
  if (entries && index===0) pending.set(passes.get(this),entries);
  return nativeSetGroup.call(this,index,group,...args);
};
GPUCommandEncoder.prototype.finish=function(...args) {
  const entries=pending.get(this);
  if (entries) {
    pending.delete(this);
    const device=encoders.get(this),record=recordFor(device);
    const group=device.createBindGroup({layout:record.layout,entries:[...entries,
      {binding:6,resource:{buffer:record.buffer}}]});
    const pass=this.beginComputePass({label:'test-migration-decision-capture'});
    pass.setPipeline(record.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
  }
  return nativeFinish.apply(this,args);
};

export async function readMigrationDecisions(device) {
  const record=records.get(device);
  if (!record) return {captured:false};
  const read=device.createBuffer({size:128,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try {
    const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(record.buffer,0,read,0,128);
    device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
    const words=[...new Uint32Array(read.getMappedRange())];read.unmap();
    const ratio=index=>new Float32Array(new Uint32Array([words[index]]).buffer)[0];
    return {captured:true,words,maxSupportRatio:ratio(9),cumulativeMaxSupportRatio:ratio(25),
      lanes:['validGas','sourceReady','condensedInterface','oversized','interfaceAndOversized',
        'interfaceReasonEmitted','refineRequested','invalidMigration','invalidVolume','maxSupportRatioBits',
        'flags','particleCount','coarsenRequested','reserved','reserved','ready']};
  } finally { read.destroy(); }
}
