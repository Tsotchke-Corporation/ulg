import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';

// A clock segment keeps the caller's binary64 base time and dt unchanged.
// Only accepted intervals increment its integer count. This avoids accumulating
// f32 time error and lets the existing batch receipt report baseTime + count*dt.
// A new dt requires a new segment at an admitted batch boundary.
export const SPH_RESIDENT_CLOCK_MAGIC = 0x53434c31;
export const SPH_RESIDENT_CLOCK_BYTES = 64;
export const SPH_RESIDENT_CLOCK_ERROR = 131072;
const records = new WeakMap();

function float64Words(value) {
  const words = new Uint32Array(2);
  new DataView(words.buffer).setFloat64(0, value, true);
  return [...words];
}

function clockRecord(clock, device) {
  const record = records.get(clock);
  if (!record || record.device !== device || record.destroyed
    || record.buffer.destroyed === true) {
    throw new TypeError('Resident clock requires its original live same-device record');
  }
  return record;
}

export function validateSphResidentClock(clock, device) {
  clockRecord(clock,device); return true;
}

export function resolveSphResidentClockOrigin(...sources) {
  const resolve = (key, valid) => {
    const values=sources.map(source=>source?.[key]).filter(value=>value!=null);
    if(values.some(value=>!valid(value) || value!==values[0])) {
      throw new TypeError(`Resident clock source ${key} is inconsistent or invalid`);
    }
    return values[0] ?? 0;
  };
  return Object.freeze({baseStep:resolve('step',value=>Number.isSafeInteger(value) && value>=0),
    baseTime:resolve('time',value=>Number.isFinite(value) && value>=0)});
}

/** Prepare a numerical clock candidate, not StateManager publication authority.
 * check must run before whole-state rollback; advance must run after it, using
 * that same final error word. Neither method submits, maps or fences the queue. */
export function prepareSphResidentClockAdvance({ device, source = null,
  baseStep = 0, baseTime = 0, dt, controlBuffer } = {}) {
  if (!Number.isFinite(dt) || dt <= 0 || !controlBuffer || controlBuffer.size < 12) {
    throw new TypeError('Resident clock requires a positive duration and final admission control');
  }
  const prior = source == null ? null : clockRecord(source, device);
  if (prior) {
    if(prior.ownerClosed) throw new TypeError('Resident clock owner has retired');
    if(!prior.encoded) throw new TypeError('Resident clock predecessor has not encoded its admission');
    if (dt !== prior.dt) throw new TypeError('Resident clock duration changed inside its segment');
    baseStep = prior.baseStep; baseTime = prior.baseTime;
  }
  if (!Number.isSafeInteger(baseStep) || baseStep < 0 || !Number.isFinite(baseTime) || baseTime < 0
    || !Number.isFinite(baseTime + dt)) {
    throw new RangeError('Resident clock requires a finite nonnegative origin');
  }
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const owned = [];
  const make = (label, size, usage) => {
    const buffer = tagWebGpuBufferDevice(
      useQueueOrderedPool
        ? registerQueueOrderedPooledBufferReturn(
            acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
            device,
            { bucketKey: label, size, usage }
          )
        : device.createBuffer({ label, size, usage }),
      device
    );
    owned.push(buffer); return buffer;
  };
  let sourceReleased = false, record, transferred = false, inputsRetired = false;
  if (prior) prior.borrows++;
  const releaseSource = () => {
    if (!sourceReleased) {
      sourceReleased = true;
      if (prior && --prior.borrows===0 && prior.ownerClosed) prior.dispose();
    }
  };
  try {
    const expected = new Uint32Array(16);
    expected[0] = SPH_RESIDENT_CLOCK_MAGIC; expected[1] = 1;
    expected[4] = baseStep % 0x100000000;
    expected[5] = Math.floor(baseStep / 0x100000000);
    expected.set(float64Words(baseTime), 6); expected.set(float64Words(dt), 8);
    const sourceBuffer = prior?.buffer ?? make('ulg-resident-clock-origin', 64, 128 | 8);
    if (!prior) device.queue.writeBuffer(sourceBuffer, 0, expected);
    const buffer = make('ulg-resident-clock-successor', 64, 128 | 8 | 4);
    const parameters = make('ulg-resident-clock-parameters', 64, 64 | 8);
    // Bound count before addition. Both the public integer step and time must
    // remain representable; no overflow may turn a rejected interval accepted.
    expected[10] = Math.min(0xffffffff, Number.MAX_SAFE_INTEGER - baseStep,
      Math.floor((Number.MAX_VALUE - baseTime) / dt));
    device.queue.writeBuffer(parameters, 0, expected);
    const code = /* wgsl */ `
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> next:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
struct Params { a:vec4<u32>, b:vec4<u32>, c:vec4<u32>, d:vec4<u32> };
@group(0) @binding(3) var<uniform> params:Params;
@compute @workgroup_size(1) fn check() {
  var valid=source[0]==${SPH_RESIDENT_CLOCK_MAGIC}u && source[1]==1u;
  valid=valid && all(vec4<u32>(source[4],source[5],source[6],source[7])==params.b)
    && source[8]==params.c.x && source[9]==params.c.y;
  valid=valid && source[2]<params.c.z && source[12]!=0xffffffffu
    && source[3]<=source[12] && source[2]==source[12]-source[3]
    && source[13]==0u && source[14]==0u && source[15]==0u;
  if(!valid) { atomicOr(&control[2],${SPH_RESIDENT_CLOCK_ERROR}u); }
}
@compute @workgroup_size(1) fn advance() {
  for(var i=0u;i<16u;i++) {next[i]=source[i];}
  let error=atomicLoad(&control[2]);
  // Invalid/corrupted origins are never converted into new valid records.
  if((error & ${SPH_RESIDENT_CLOCK_ERROR}u)!=0u) {return;}
  let accepted=error==0u;
  next[2]=source[2]+select(0u,1u,accepted);
  next[3]=source[3]+select(1u,0u,accepted);
  next[10]=select(0u,1u,accepted); next[11]=error; next[12]=source[12]+1u;
}`;
    const prepare = entryPoint => {
      const pipeline = createCachedExplicitComputePipeline(device, { code, entryPoint,
        cacheKey: `ulg-resident-clock-v1-${entryPoint}`, label: `ulg-resident-clock-${entryPoint}`,
        bindings: ['read-only-storage','storage','storage','uniform']
          .map((type,binding) => computeBufferBinding(binding,type)) });
      const group = createCachedExplicitBindGroup(device, { layout:pipeline.bindGroupLayout,
        entries:[sourceBuffer,buffer,controlBuffer,parameters]
          .map((buffer,binding) => ({binding,resource:{buffer}})) });
      return encoder => {
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline.pipeline);
        pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
      };
    };
    const check=prepare('check'), advance=prepare('advance');
    record={device,buffer,baseStep,baseTime,dt,borrows:0,destroyed:false,encoded:false,encoder:null,ownerClosed:false};
    const destroyBuffer=buffer.destroy.bind(buffer);
    buffer.destroy=()=>{
      if(!record.destroyed) throw new Error('Resident clock belongs to its retained producer');
      if(useQueueOrderedPool) {
        buffer.destroy=destroyBuffer;
        releaseOrDestroyQueueOrderedPooledBuffer(buffer);
      } else {
        destroyBuffer();
      }
    };
    record.dispose=()=>{
      if(record.destroyed) return false;
      record.destroyed=true;
      if(useQueueOrderedPool) {
        buffer.destroy=destroyBuffer;
        releaseOrDestroyQueueOrderedPooledBuffer(buffer);
      } else {
        destroyBuffer();
      }
      return true;
    };
    const retireInputs=()=>{
      if(inputsRetired) return;
      inputsRetired=true;releaseSource();
      for(const input of owned) if(input!==buffer) releaseOrDestroyQueueOrderedPooledBuffer(input);
    };
    const clock=Object.freeze({schema:'peercompute.ulg.resident-clock.v1',buffer,baseStep,baseTime,dt});
    records.set(clock,record);
    return Object.freeze({clock,
      check(encoder) {
        validateSphResidentClock(clock,device);
        if(prior) validateSphResidentClock(source,device);
        if(record.encoder) throw new TypeError('Resident clock check cannot be replayed');
        record.encoder=encoder;
        check(encoder);
      },
      advance(encoder) {
        validateSphResidentClock(clock,device);
        if(record.encoder!==encoder || record.encoded) throw new TypeError('Resident clock advance requires its original single check');
        advance(encoder);record.encoded=true;
      },
      transfer() {
        validateSphResidentClock(clock,device);
        if(!record.encoded || transferred) throw new TypeError('Clock handover requires its single encoded successor');
        transferred=true;
        return Object.freeze({clock,destroy() {
          if(record.ownerClosed) return false;
          record.ownerClosed=true;
          if(!record.borrows) record.dispose();
          return true;
        }});
      },
      destroy() {
        if(inputsRetired) return false;
        if(!transferred && record.borrows) throw new Error('Resident clock is retained by a successor');
        retireInputs();if(!transferred) record.dispose();return true;
      }
    });
  } catch(error) {releaseSource();for(const buffer of owned) buffer.destroy();throw error;}
}
