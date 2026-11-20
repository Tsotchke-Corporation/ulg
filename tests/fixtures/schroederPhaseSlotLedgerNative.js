import { createSchroederSplitSpareLineageScan, encodeSchroederSplitSpareLineageScan } from '../../src/runtime/sph/schroederSplitSpareLineageScanGpu.js';
import { createSchroederPhaseSlotMaterializer } from '../../src/runtime/sph/schroederPhaseSlotMaterializationGpu.js';
import { createSphExactMassInventoryWebGpu, acquireSphExactMassRead, releaseSphExactMassRead,
  releaseSphExactMassInventory } from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format, sphExactThermalEnergyRecordWords }
  from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

// Only cold declarations enter from the host. Numerical comparisons and full
// integer conservation run on the GPU; only eight diagnostic words return.
export async function runPhaseSlotLedgerNative(device) {
  const count = 36, capacity = 9, words = format.wordCount;
  const receipts = [], owned = [], stages = [], committed = [], reads = [], families = [];
  const make = (data, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ size: typeof data === 'number' ? data : data.byteLength, usage }), device);
    owned.push(b); if (typeof data !== 'number') device.queue.writeBuffer(b, 0, data); return b;
  };
  const dispatch = (encoder, code, buffers) => {
    const p = device.createComputePipeline({ layout: 'auto', compute: {
      entryPoint: 'main', module: device.createShaderModule({ code }) } });
    const g = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries:
      buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const pass = encoder.beginComputePass(); pass.setPipeline(p); pass.setBindGroup(0, g); pass.dispatchWorkgroups(1); pass.end();
  };
  const arithmetic = createSphExactMassWgsl(format) + createSphExactLedgerWgsl(format);
  const table = { segments: new Float32Array([7,5,3,3,-10000,10000,10,2010,1,1,1,0]) };
  const assignment = (i, action, rank, n) => {
    const a = new Float32Array(32); a[0]=i; a[3]=9; a[6]=1; a[8]=action;
    a[9]=rank; a[10]=n; a[11]=action===7 ? i : -1; a[12]=action===7 ? 1 : 0; a[20]=2; return a;
  };
  const run = (input, rows) => {
    const assignments = new Float32Array(rows.length*32); rows.forEach((r,i)=>assignments.set(r,i*32));
    const stage = createSchroederPhaseSlotMaterializer(device, { lineageCapacity:capacity,
      firstSpareLineage:2,spareCount:7,assignmentRowCount:rows.length,thermalMaterialTable:table,
      boxDimsM:[20,20,20],admissionApproved:true,exactLedger:{massRead:input.mass,energy:input.energy} });
    stages.push(stage);
    const encoder=device.createCommandEncoder();
    stage.encode(encoder,{sourceStateBuffer:input.s,sourceThermoBuffer:input.t,sourceMechanicsBuffer:input.m,
      slotAssignmentBuffer:make(assignments),spareLineagesBuffer:make(new Uint32Array([2,3,4,5,6,7,8]))});
    device.queue.submit([encoder.finish()]);
    const record=stage.ledgerStage.commit(); committed.push([stage.ledgerStage,record]);
    return {s:stage.stateBuffer,t:stage.thermoBuffer,m:stage.mechanicsBuffer,
      mass:record.carrierMassRead,energy:record.exactEnergy,evidence:stage.evidenceBuffer};
  };
  try {
    for (const mode of ['split3','split8','merge','cycle','hidden-mass','hidden-energy','hidden-source','overflow','domain']) {
      const merge = mode==='merge' || mode==='overflow';
      const negative = mode==='split3' || mode==='cycle';
      const state=new Float32Array(count*8),thermo=new Float32Array(count*12),mechanics=new Float32Array(count*32);
      const massWords=new Uint32Array(count*words);
      for(let i=0;i<count;i++) {
        const live=i===18 || (merge && i===19), mass=live?8:0, u=negative?-1000:1000;
        state.set([10,10,10,mass,merge?(i===18?1:-1):0,0,0,u],i*8);
        thermo.set([7,3,1010+u/10,1,0,0,1,0,1,mass,live?1:254,.5],i*12);
        mechanics[i*32]=mechanics[i*32+4]=mechanics[i*32+8]=1;
        mechanics.set([1,mass,0,1,100,0,0,10,2,1,101325,0,0,mass],i*32+18);
        massWords.set(encodeSphExactMass(mass,format),i*words);
      }
      // One quantum hidden below the view's ULP must survive every operation.
      massWords[18*words]=1;
      if(mode==='hidden-mass') massWords[2*words]=1;
      const family=createSphExactMassInventoryWebGpu({device,format,massWords,
        provenance:{kind:'initial-conditions',reference:`phase-slot integer ${mode}`}});
      families.push(family); const mass=acquireSphExactMassRead({family,device});reads.push(mass);
      const energyBuffer=make(sphExactThermalEnergyRecordWords(count)*4);
      const input={s:make(state),t:make(thermo),m:make(mechanics),mass,
        energy:{energyBuffer,format,rowCount:count}};
      const seed=device.createCommandEncoder();
      dispatch(seed,`${arithmetic}
        @group(0) @binding(0) var<storage,read> state:array<vec4<f32>>;
        @group(0) @binding(1) var<storage,read_write> energy:array<u32>;
        @compute @workgroup_size(1) fn main(){
          for(var i=0u;i<${count}u;i++){
            var u=el_from_f32_bits(bitcast<u32>(state[2u*i].w*state[2u*i+1u].w)).value;
            var s=ExactMass();
            if(state[2u*i].w>0.0){s=el_from_f32_bits(bitcast<u32>(-3.0)).value;}
            if(i==18u){var q:ExactMass;q.words[0]=3u;u=el_add(u,q).value;s=el_add(s,q).value;}
            ${mode==='hidden-energy'?'if(i==2u){u.words[0]=1u;}':''}
            ${mode==='hidden-source'?'if(i==2u){s.words[0]=1u;}':''}
            ${mode==='overflow'?'if(i==18u || i==19u){u=ExactMass();u.words[EM_WORDS-1u]=0x60000000u;}':''}
            ${mode==='domain'?'if(i==18u){u=el_from_f32_bits(bitcast<u32>(1000000.0)).value;}':''}
            for(var w=0u;w<EM_WORDS;w++){energy[i*EM_WORDS+w]=u.words[w];energy[(${count}u+i)*EM_WORDS+w]=s.words[w];}
          }
          energy[${2*count*words+1}u]=19u;
        }`,[input.s,energyBuffer]);
      const scan=createSchroederSplitSpareLineageScan(device,{spareCount:7});
      owned.push(scan.localPrefixBuffer,scan.groupOffsetsBuffer,scan.spareLineagesBuffer,scan.freeListBuffer,scan.paramsBuffer);
      encodeSchroederSplitSpareLineageScan(device,seed,{scan,stateBuffer:input.s,lineageCapacity:capacity,
        firstSpareLineage:2,exactLedger:{massRead:mass,energy:input.energy}});
      device.queue.submit([seed.finish()]);
      const splitCount=mode==='split8'?7:2;
      let output=run(input,merge?[assignment(18,6,18,1),assignment(19,7,-1,0)]:[assignment(18,5,0,splitCount)]);
      if(mode==='cycle') output=run(output,[assignment(18,6,18,1),assignment(20,7,-1,0),assignment(21,7,-1,0)]);
      const refused=mode.startsWith('hidden-')||mode==='overflow'||mode==='domain';
      const expected=refused?(merge?2:1):merge||mode==='cycle'?1:splitCount+1;
      const receipt=make(32),encoder=device.createCommandEncoder();
      dispatch(encoder,`${arithmetic}
        @group(0) @binding(0) var<storage,read> before_m:array<u32>;
        @group(0) @binding(1) var<storage,read> before_e:array<u32>;
        @group(0) @binding(2) var<storage,read> after_m:array<u32>;
        @group(0) @binding(3) var<storage,read> after_e:array<u32>;
        @group(0) @binding(4) var<storage,read> before_s:array<vec4<f32>>;
        @group(0) @binding(5) var<storage,read> after_s:array<vec4<f32>>;
        @group(0) @binding(6) var<storage,read_write> receipt:array<u32>;
        @group(0) @binding(7) var<storage,read> free:array<f32>;
        fn eq(a:ExactMass,b:ExactMass,code:u32){for(var w=0u;w<EM_WORDS;w++){if(a.words[w]!=b.words[w]){receipt[0]++;receipt[2]=code;}}}
        @compute @workgroup_size(1) fn main(){
          var bm:ExactMass;var am:ExactMass;var bu:ExactMass;var au:ExactMass;var bs:ExactMass;var asrc:ExactMass;
          var before_k=0.0;var after_k=0.0;
          for(var i=0u;i<${count}u;i++){
            var mi:ExactMass;var mo:ExactMass;var ui:ExactMass;var uo:ExactMass;var si:ExactMass;var so:ExactMass;
            for(var w=0u;w<EM_WORDS;w++){
              mi.words[w]=before_m[i*EM_WORDS+w];mo.words[w]=after_m[i*EM_WORDS+w];
              ui.words[w]=before_e[i*EM_WORDS+w];uo.words[w]=after_e[i*EM_WORDS+w];
              si.words[w]=before_e[(${count}u+i)*EM_WORDS+w];so.words[w]=after_e[(${count}u+i)*EM_WORDS+w];
            }
            ${refused?'eq(mi,mo,1u);eq(ui,uo,2u);eq(si,so,3u);if(any(bitcast<vec4<u32>>(before_s[2u*i])!=bitcast<vec4<u32>>(after_s[2u*i]))||any(bitcast<vec4<u32>>(before_s[2u*i+1u])!=bitcast<vec4<u32>>(after_s[2u*i+1u]))){receipt[0]++;}':''}
            bm=em_add(bm,mi).value;am=em_add(am,mo).value;bu=el_add(bu,ui).value;au=el_add(au,uo).value;
            bs=el_add(bs,si).value;asrc=el_add(asrc,so).value;
            let st=after_s[2u*i];let vu=after_s[2u*i+1u];
            if(st.w>0.0){receipt[1]++;}
            ${!refused?'if(em_project_f32_bits(mo).bits!=bitcast<u32>(st.w)){receipt[0]++;receipt[2]=4u;}':''}
            before_k+=0.5*before_s[2u*i].w*dot(before_s[2u*i+1u].xyz,before_s[2u*i+1u].xyz);
            after_k+=0.5*st.w*dot(vu.xyz,vu.xyz);
          }
          eq(bm,am,5u);eq(el_subtract(bu,bs).value,el_subtract(au,asrc).value,6u);
          ${mode==='merge'?'eq(el_subtract(au,bu).value,el_from_f32_bits(bitcast<u32>(before_k-after_k)).value,7u);if(!(before_k>after_k)){receipt[0]++;}':''}
          ${mode==='cycle'?'eq(bu,au,8u);eq(bs,asrc,9u);':''}
          if(receipt[1]!=${expected}u){receipt[0]++;receipt[2]=10u;}
          for(var w=0u;w<4u;w++){if(before_e[${2*count*words}u+w]!=after_e[${2*count*words}u+w]){receipt[0]++;receipt[2]=11u;}}
          receipt[6]=u32(free[2]);
          if(receipt[6]!=${mode.startsWith('hidden-')?6:7}u){receipt[0]++;receipt[2]=12u;}
          receipt[7]=1u;
        }`,[mass.buffer,energyBuffer,output.mass.buffer,output.energy.energyBuffer,input.s,output.s,receipt,scan.freeListBuffer]);
      const read=make(32,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
      encoder.copyBufferToBuffer(receipt,0,read,0,32);device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);receipts.push({mode,words:[...new Uint32Array(read.getMappedRange())]});read.unmap();
    }
    return receipts;
  } finally {
    await device.queue.onSubmittedWorkDone();
    for(const [stage,record] of committed) stage.releaseUnadopted(record);
    for(const stage of stages) stage.destroy();
    await Promise.all(reads.map(read=>releaseSphExactMassRead(read)));
    for(const family of families) releaseSphExactMassInventory(family);
    for(const buffer of owned) buffer.destroy();
  }
}
