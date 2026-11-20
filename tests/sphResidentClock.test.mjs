import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveSphResidentClockOrigin,prepareSphResidentClockAdvance,validateSphResidentClock}
  from '../src/runtime/sph/sphResidentClockGpu.js';

test('resident source clock rejects conflicting or malformed host origins',()=>{
  assert.deepEqual(resolveSphResidentClockOrigin({step:17,time:1.25},{step:17,time:1.25},{}),
    {baseStep:17,baseTime:1.25});
  assert.deepEqual(resolveSphResidentClockOrigin({}),{baseStep:0,baseTime:0});
  for(const other of [{step:18},{time:1.5},{step:'17'},{time:NaN},{step:-1},{time:-1}]) {
    assert.throws(()=>resolveSphResidentClockOrigin({step:17,time:1.25},other),/inconsistent or invalid/);
  }
});

test('resident clock refuses forged sources and unusable time before allocating',()=>{
  const device={createBuffer(){throw new Error('unexpected allocation');}},controlBuffer={size:128};
  for(const dt of [0,-1,NaN,Infinity]) assert.throws(()=>prepareSphResidentClockAdvance({device,controlBuffer,dt}),/positive duration/);
  assert.throws(()=>prepareSphResidentClockAdvance({device,controlBuffer,dt:0.001,source:{buffer:{}}}),/original live/);
  assert.throws(()=>validateSphResidentClock({},device),/original live/);
  for(const origin of [{baseStep:0.5},{baseStep:-1},{baseTime:Infinity},{baseTime:-1}]) {
    assert.throws(()=>prepareSphResidentClockAdvance({device,controlBuffer,dt:0.001,...origin}),/nonnegative origin/);
  }
});
