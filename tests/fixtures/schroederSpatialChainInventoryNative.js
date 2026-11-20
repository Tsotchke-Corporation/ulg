import { prepareSchroederChainInventoryCheck } from '../../src/runtime/sph/schroederSpatialChainMassConservationGpu.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format,
  sphExactThermalEnergyRecordWords } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { encodeSphExactMassUnits } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

// Cold integer declarations exercise all three reduction levels, offsets,
// carries, signed sources, and rejection. Only the 128-byte control is mapped.
export async function runChainInventoryNative({ parcels = false } = {}) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter) throw new Error('Native inventory test has no WebGPU adapter');
  const device=await adapter.requestDevice(parcels ? {requiredLimits:{maxStorageBuffersPerShaderStage:11}} : {});const errors=[];
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const owned=[];const results=[];
  const allocate=(label,size,usage)=>{const b=device.createBuffer({label,size,usage});owned.push(b);return b;};
  const n=4097,w=format.wordCount;
  const encode=v=>encodeSphExactMassUnits(v<0n ? (1n<<BigInt(w*32))+v : v,format);
  try {
    for(const fault of ['none','mass','energy','placement','mass-overflow','energy-overflow',
      ...(parcels ? ['parcel-mass','parcel-energy','sink-mass','sink-energy','parcel-sum-overflow','sink-sum-overflow'] : [])]) {
      const bm=new Uint32Array((n+1)*w),am=new Uint32Array((n+3)*w);
      const be=new Uint32Array(sphExactThermalEnergyRecordWords(n)),ae=new Uint32Array(be.length);
      for(let i=0;i<n;i++) {
        const mass=i===0 ? (1n<<200n)+(1n<<32n)-1n : BigInt(i+10);
        bm.set(encode(mass),(i+1)*w);am.set(encode(mass+(i===0 ? -9n : i===n-1 ? 9n : 0n)),(i+3)*w);
        const u=BigInt(500+i),s=-BigInt(i);
        be.set(encode(u),i*w);be.set(encode(s),(n+i)*w);
        ae.set(encode(u+(i===0 ? 17n : 0n)),i*w);
        ae.set(encode(s+(i===n-1 ? 17n : 0n)),(n+i)*w);
      }
      if(fault==='mass') am[(n+2)*w]+=1;
      if(fault==='energy') ae[(n-1)*w]+=1;
      if(fault==='mass-overflow') {bm.set(encode((1n<<288n)-1n),w);am.set(encode((1n<<288n)-1n),3*w);}
      if(fault==='energy-overflow') {be.set(encode((1n<<287n)-1n),0);ae.set(encode((1n<<287n)-1n),0);}
      const upload=(label,words)=>{const b=allocate(label,words.byteLength,128|8);device.queue.writeBuffer(b,0,words);return b;};
      let originalParcels=null,candidateParcels=null;
      if(parcels) {
        const bp=new Uint32Array(n*3*w),ap=new Uint32Array(n*3*w),bs=new Uint32Array(3*w),asink=new Uint32Array(3*w);
        for(let i=0;i<n;i++) {
          bp.set(encode(1n),i*3*w);bp.set(encode(10n),(i*3+1)*w);bp.set(encode(-20n),(i*3+2)*w);
        }
        ap.set(bp);ap.set(encode(13n),w);ap.set(encode(-18n),2*w);
        asink.set(encode(4n),0);asink.set(encode(3n),w);
        // Shift seven mass units and five energy units out of a carrier,
        // into the parcel and wall inventories, with no change to global totals.
        am.set(encode(BigInt(n+9)-7n+9n+(fault==='mass'?1n:0n)),(n+2)*w);
        ae.set(encode(BigInt(500+n-1)-5n+(fault==='energy'?1n:0n)),(n-1)*w);
        if(fault==='parcel-mass') ap[w]++;
        if(fault==='parcel-energy') ap[2*w]++;
        if(fault==='sink-mass') asink[0]++;
        if(fault==='sink-energy') asink[w]++;
        if(fault==='parcel-sum-overflow') {bp.set(encode((1n<<288n)-1n),0);ap.set(encode((1n<<288n)-1n),0);}
        if(fault==='sink-sum-overflow') {
          bs.set(encode((1n<<288n)-1n),0);asink.set(encode((1n<<288n)-1n),0);
          bs.set(encode(1n),2*w);asink.set(encode(1n),2*w);
        }
        originalParcels={count:n,ledgerBuffer:upload('before-parcels',bp),sinkBuffer:upload('before-sinks',bs)};
        candidateParcels={count:n,ledgerBuffer:upload('after-parcels',ap),sinkBuffer:upload('after-sinks',asink)};
      }
      const control=allocate('inventory-control',128,128|4|8),read=allocate('inventory-read',128,1|8);
      const check=prepareSchroederChainInventoryCheck({device,allocate,controlBuffer:control,originalParcels,candidateParcels,
        originalMassRead:{rowCount:n,buffer:upload('before-mass',bm),byteOffset:w*4},
        candidateMassRead:{rowCount:n,buffer:upload('after-mass',am),byteOffset:w*12},
        originalEnergy:{energyBuffer:upload('before-energy',be)},candidateEnergy:{energyBuffer:upload('after-energy',ae)},
        reactionValidationBuffer:upload('placement',new Uint32Array([0x524c4731,1,fault==='placement' ? 2 : 1,1,1,0,1,0]))});
      const encoder=device.createCommandEncoder();check(encoder);encoder.copyBufferToBuffer(control,0,read,0,128);
      device.queue.submit([encoder.finish()]);await read.mapAsync(1);
      results.push({fault,words:Array.from(new Uint32Array(read.getMappedRange()))});read.unmap();
      for(const b of owned.splice(0)) b.destroy();
    }
    return {results,errors};
  } finally {for(const b of owned) b.destroy();device.destroy();}
}
