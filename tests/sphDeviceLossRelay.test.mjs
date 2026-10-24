import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphDeviceLossRelay } from '../src/runtime/sph/sphDeviceLossRelay.js';

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
