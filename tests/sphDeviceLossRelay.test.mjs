import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSphDeviceLossRelay,
  watchSphDeviceLoss,
  watchSphDeviceLossFor
} from '../src/runtime/sph/sphDeviceLossRelay.js';

test('device-loss relay records the latest value before a plain-call notification', () => {
  const state = { info: null };
  const values = [{ reason: 'destroyed' }, undefined, null, 0, false];
  const observed = [];
  const relay = createSphDeviceLossRelay(state, function (info) {
    assert.equal(this, undefined);
    assert.equal(state.info, info);
    observed.push(info);
  });
  for (const value of values) relay(value);
  assert.deepEqual(observed, values);
  assert.equal(state.info, false);
});

test('device-loss relay preserves independent callbacks sharing one state', () => {
  const state = { info: null };
  const otherState = { info: null };
  const first = createSphDeviceLossRelay(state, null);
  const second = createSphDeviceLossRelay(state, null);
  const independent = createSphDeviceLossRelay(otherState, null);
  assert.notEqual(first, second);
  const loss = { reason: 'unknown' };
  first(loss);
  assert.equal(state.info, loss);
  assert.equal(otherState.info, null);
  second(undefined);
  independent(loss);
  assert.equal(state.info, undefined);
  assert.equal(otherState.info, loss);
});

test('device-loss relay ignores nonfunction notifiers without dropping the state update', () => {
  for (const notifier of [null, undefined, false, 7, {}, 'notify']) {
    const state = { info: null };
    const loss = { reason: 'destroyed' };
    createSphDeviceLossRelay(state, notifier)(loss);
    assert.equal(state.info, loss);
  }
});

test('device-loss relay does not return or adopt the notifier result', async () => {
  const state = { info: null };
  let thenReads = 0;
  const result = { get then() { thenReads += 1; throw new Error('must not adopt'); } };
  const relay = createSphDeviceLossRelay(state, () => result);
  assert.equal(relay('direct'), undefined);
  await Promise.resolve('async').then(relay).catch(relay);
  assert.equal(thenReads, 0);
  assert.equal(state.info, 'async');
});

test('device-loss relay preserves synchronous throws and then-catch forwarding', async () => {
  const state = { info: null };
  const firstError = new Error('first notification');
  const secondError = new Error('second notification');
  const loss = { reason: 'destroyed' };
  const observed = [];
  const relay = createSphDeviceLossRelay(state, (info) => {
    observed.push(info);
    assert.equal(state.info, info);
    throw info === loss ? firstError : secondError;
  });
  await assert.rejects(Promise.resolve(loss).then(relay).catch(relay),
    (error) => error === secondError);
  assert.deepEqual(observed, [loss, firstError]);
  assert.equal(state.info, firstError);
});

test('device-loss relay preserves rejected-promise notification identity', async () => {
  const state = { info: null };
  const error = new Error('device lost promise rejection');
  const observed = [];
  const relay = createSphDeviceLossRelay(state, (info) => observed.push(info));
  await Promise.reject(error).then(relay).catch(relay);
  assert.deepEqual(observed, [error]);
  assert.equal(state.info, error);
});

function countedLossDevice() {
  let resolve;
  let reject;
  const lost = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  lost.catch(() => {});
  let subscriptions = 0;
  const originalThen = lost.then.bind(lost);
  lost.then = (...args) => { subscriptions += 1; return originalThen(...args); };
  return { device: { lost }, resolve, reject, get subscriptions() { return subscriptions; } };
}
const settle = () => new Promise((done) => setImmediate(done));

test('device-loss registry adds one reaction per device however many steps watch it', async () => {
  const f = countedLossDevice();
  const states = [];
  const calls = [];
  for (let step = 0; step < 1000; step += 1) {
    const state = { info: null };
    states.push(state);
    assert.equal(watchSphDeviceLoss(f.device, state, (info) => calls.push([step, info])), true);
  }
  assert.equal(f.subscriptions, 1);
  const info = { reason: 'destroyed' };
  f.resolve(info);
  await settle();
  assert.ok(states.every((state) => state.info === info), 'every live loss state learns the loss');
  assert.equal(calls.length, 1000);
  assert.ok(calls.every(([, value]) => value === info));
});

test('device-loss registry notifies a watcher registered after the loss', async () => {
  const f = countedLossDevice();
  watchSphDeviceLoss(f.device, { info: null });
  const info = { reason: 'unknown' };
  f.resolve(info);
  await settle();
  const late = { info: null };
  const calls = [];
  watchSphDeviceLoss(f.device, late, (value) => calls.push(value));
  assert.equal(late.info, null, 'delivered on a later microtask, never synchronously');
  await settle();
  assert.equal(late.info, info);
  assert.deepEqual(calls, [info]);
  assert.equal(f.subscriptions, 1);
});

test('device-loss registry forwards a fulfilled-loss notifier throw once, after all watchers', async () => {
  const f = countedLossDevice();
  const order = [];
  const failure = new Error('notifier failed');
  for (const name of ['a', 'b']) {
    watchSphDeviceLoss(f.device, { info: null }, (value) => {
      order.push([name, value]);
      if (value !== failure) throw failure;
    });
  }
  const info = { reason: 'destroyed' };
  f.resolve(info);
  await settle();
  assert.deepEqual(order, [['a', info], ['b', info], ['a', failure], ['b', failure]]);
});

test('device-loss registry calls a rejected-loss notifier once even when it throws', async () => {
  const f = countedLossDevice();
  const calls = [];
  watchSphDeviceLoss(f.device, { info: null }, (value) => { calls.push(value); throw new Error('x'); });
  const error = new Error('loss observation rejected');
  f.reject(error);
  await settle();
  assert.deepEqual(calls, [error]);
});

test('device-loss target watch works on frozen targets and passes the live target', async () => {
  const f = countedLossDevice();
  const target = Object.freeze({ id: 7 });
  const seen = [];
  assert.equal(watchSphDeviceLossFor(f.device, target, (live, info) => seen.push([live, info])), true);
  const info = { reason: 'destroyed' };
  f.resolve(info);
  await settle();
  assert.deepEqual(seen, [[target, info]]);
});

test('device-loss registry rejects devices without a loss promise', () => {
  assert.equal(watchSphDeviceLoss({}, { info: null }), false);
  assert.equal(watchSphDeviceLoss(null, { info: null }), false);
  assert.equal(watchSphDeviceLossFor({}, {}, () => {}), false);
});
