import assert from 'node:assert/strict';
import test from 'node:test';

// Slice 2.4 A6 Real-Browser Native Gate (plan/CURRENT-PLAN.md):
//   A6-1 Warm /workers/eshkol-warm-vm.worker.js reuse across multiple real
//        Eshkol-AD EOS stiffness misses (spawns === 1, loads === 1, calls >= 2,
//        AD cross-check < 1e-10) -> G5 ReservationLedger adoption into
//        regionalClosureWorkerLane + live sphImplicitPressureGpu stiffness update;
//   A6-2 Warm /workers/moonlab-warm-webgpu.worker.js WebGPU reuse (spawns === 1,
//        loads === 1, calls >= 2, probabilitySum ~ 1.0);
//   A6-3 Worker crash/termination + malformed-program error recovery: bridge
//        releases G5 reservation, stays non-blocking, respawns a fresh warm
//        Eshkol worker (spawns === 2, recoveries >= 1), and adopts cleanly!
// ULG_RUN_NATIVE_A6=1 (or ULG_RUN_NATIVE_SOLID_RIGID=1); run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_A6 === '1' || process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native browser A6 warm Eshkol & MoonLab workers wired to Slice 1.5 misses over G5 reservations with failure recovery', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_A6=1 for native browser A6 WASM/WebGPU worker test',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (gpuErrors.length < 10) gpuErrors.push(String(e.error?.message ?? e).slice(0, 300));
      });

      const bridgeMod = await import('/src/runtime/material/warmClosureMissBridge.js');
      const laneMod = await import('/src/runtime/material/regionalClosureWorkerLane.js');
      const clientMod = await import('/src/services/clientWarmDerivationTask.js');
      const eosMod = await import('/src/runtime/material/eshkolEosStiffness.js');

      const lane = laneMod.createRegionalClosureWorkerLane(device, {
        name: 'ulg-a6-native-test-lane',
        maxGenerations: 4,
        memberCapacity: 64
      });
      const commits = [];
      const bridge = bridgeMod.createWarmClosureMissBridge({
        device,
        lane,
        maxInFlight: 3,
        onStateCommit: (delta) => commits.push(delta)
      });

      // A6-1: Two distinct real EOS stiffness misses -> warm Eshkol WASM worker reuse (spawns === 1, loads === 1).
      const m1 = bridge.requestEosStiffnessClosureMiss({
        missKey: 'h2o-liquid-tait',
        eosModel: eosMod.ESHKOL_EOS_MODEL.TAIT,
        restDensityKgPerM3: 998,
        soundSpeedMPerS: 1480,
        scheduleId: 'sched-1'
      });
      const r1 = await m1.promise;
      const adopt1 = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-1' });

      const m2 = bridge.requestEosStiffnessClosureMiss({
        missKey: 'fe-liquid-tait',
        eosModel: eosMod.ESHKOL_EOS_MODEL.TAIT,
        restDensityKgPerM3: 7000,
        soundSpeedMPerS: 3800,
        scheduleId: 'sched-2'
      });
      const r2 = await m2.promise;
      const adopt2 = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-2' });
      const eshkolWarmResidency = clientMod.getWarmDerivationResidency();

      // A6-2: Two MoonLab WebGPU quantum probes -> warm MoonLab worker reuse (spawns === 1, loads === 1).
      const q1 = bridge.requestQuantumClosureProbeMiss({ missKey: 'ghz-10-a', qubits: 10, scheduleId: 'sched-2' });
      const qr1 = await q1.promise;
      const q2 = bridge.requestQuantumClosureProbeMiss({ missKey: 'ghz-10-b', qubits: 10, scheduleId: 'sched-3' });
      const qr2 = await q2.promise;
      const adoptQ = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-3' });
      const moonlabWarmResidency = clientMod.getWarmDerivationResidency();

      // A6-3: Failure & worker-crash recovery!
      // (a) Malformed Eshkol program -> rejected cleanly, worker remains alive & reservation released.
      let malformedError = null;
      let malformedReply = null;
      try {
        malformedReply = await clientMod.run({
          service: 'eshkol',
          operation: 'sample',
          definition: '(define (broken x) (/ 1',
          call: 'broken',
          points: [[1]]
        });
      } catch (err) {
        malformedError = String(err?.message ?? err);
      }
      // (b) Force-terminate the warm Eshkol worker (simulating OOM/crash) and verify
      //     a brand-new EOS stiffness miss respawns cleanly (spawns: 1 -> 2) and adopts!
      const terminated = clientMod.terminateWarmWorker('eshkol', { countRecovery: true });
      const m3 = bridge.requestEosStiffnessClosureMiss({
        missKey: 'na-liquid-linear',
        eosModel: eosMod.ESHKOL_EOS_MODEL.LINEAR_GAS,
        restDensityKgPerM3: 927,
        soundSpeedMPerS: 2500,
        scheduleId: 'sched-4'
      });
      const r3 = await m3.promise;
      const adopt3 = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-4' });
      const afterRecoveryResidency = clientMod.getWarmDerivationResidency();
      const finalStatus = bridge.getStatus();
      const finalLaneBindings = laneMod.regionalClosureLaneBindings(lane);

      bridge.destroy({ terminateWorkers: true });
      laneMod.destroyRegionalClosureWorkerLane(lane);
      device.destroy();

      return {
        status: 'ran',
        gpuErrors,
        r1: { failed: r1?.failed ?? false, err: r1?.error ?? null, crossCheck: r1?.derived?.crossCheckMaxRelativeError, samples: r1?.derived?.sampleCount, loads: r1?.commitDelta?.payload?.residency?.worker?.loads, calls: r1?.commitDelta?.payload?.residency?.worker?.calls },
        r2: { failed: r2?.failed ?? false, err: r2?.error ?? null, crossCheck: r2?.derived?.crossCheckMaxRelativeError, samples: r2?.derived?.sampleCount, loads: r2?.commitDelta?.payload?.residency?.worker?.loads, calls: r2?.commitDelta?.payload?.residency?.worker?.calls },
        r3: { failed: r3?.failed ?? false, err: r3?.error ?? null, crossCheck: r3?.derived?.crossCheckMaxRelativeError, samples: r3?.derived?.sampleCount, loads: r3?.commitDelta?.payload?.residency?.worker?.loads, calls: r3?.commitDelta?.payload?.residency?.worker?.calls },
        qr1: { failed: qr1?.failed ?? false, err: qr1?.error ?? null, probSum: qr1?.value?.probabilitySum, dim: qr1?.value?.dim, loads: qr1?.commitDelta?.payload?.residency?.worker?.loads, calls: qr1?.commitDelta?.payload?.residency?.worker?.calls, nativeAccelerated: qr1?.commitDelta?.payload?.residency?.worker?.nativeAccelerated },
        qr2: { failed: qr2?.failed ?? false, err: qr2?.error ?? null, probSum: qr2?.value?.probabilitySum, dim: qr2?.value?.dim, loads: qr2?.commitDelta?.payload?.residency?.worker?.loads, calls: qr2?.commitDelta?.payload?.residency?.worker?.calls },
        adopt1: { count: adopt1.adoptedCount, ordinal: adopt1.activeOrdinal },
        adopt2: { count: adopt2.adoptedCount, ordinal: adopt2.activeOrdinal },
        adoptQ: { count: adoptQ.adoptedCount, ordinal: adoptQ.activeOrdinal },
        adopt3: { count: adopt3.adoptedCount, ordinal: adopt3.activeOrdinal },
        eshkolWarmResidency,
        moonlabWarmResidency,
        malformedError,
        malformedReply,
        terminated,
        afterRecoveryResidency,
        finalLedgerActive: finalStatus.ledgerActiveCount,
        finalOrdinal: finalLaneBindings.ordinal,
        commitCount: commits.length,
        implicitPressureUpdates: commits.filter((c) => c.implicitPressureUpdated).length
      };
    });

    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.deepEqual(pageErrors, [], `zero page errors: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(out.gpuErrors, [], `zero GPU errors: ${JSON.stringify(out.gpuErrors)}`);

    // A6-1: Eshkol warm reuse + AD accuracy + G5 adoption + implicit pressure table swap.
    assert.equal(out.r1.failed, false, `r1 succeeded: ${out.r1.err}`);
    assert.equal(out.r2.failed, false, `r2 succeeded: ${out.r2.err}`);
    assert.ok(out.r1.crossCheck < 1e-10, `Eshkol AD h2o cross-check (${out.r1.crossCheck})`);
    assert.ok(out.r2.crossCheck < 1e-10, `Eshkol AD fe cross-check (${out.r2.crossCheck})`);
    assert.equal(out.eshkolWarmResidency.spawns.eshkol, 1, 'Eshkol worker spawned ONCE across both misses');
    assert.equal(out.r2.loads, 1, 'Eshkol WASM VM loaded ONCE across warm calls');
    assert.equal(out.r2.calls, 2, 'Eshkol WASM VM served 2 warm calls');
    assert.equal(out.adopt1.count, 1);
    assert.equal(out.adopt2.count, 1);

    // A6-2: MoonLab warm WebGPU reuse.
    assert.equal(out.qr1.failed, false, `qr1 succeeded: ${out.qr1.err}`);
    assert.equal(out.qr2.failed, false, `qr2 succeeded: ${out.qr2.err}`);
    assert.ok(Math.abs(out.qr1.probSum - 1) < 1e-5, `MoonLab GHZ probabilitySum ~ 1 (${out.qr1.probSum})`);
    assert.equal(out.moonlabWarmResidency.spawns.moonlab, 1, 'MoonLab worker spawned ONCE across both probes');
    assert.equal(out.qr2.loads, 1, 'MoonLab WASM+WebGPU context loaded ONCE');
    assert.equal(out.qr2.calls, 2, 'MoonLab worker served 2 warm calls');
    assert.equal(out.adoptQ.count, 2);

    // A6-3: Failure + crash/respawn recovery.
    assert.ok(out.malformedError && out.malformedError.length > 0, `malformed Eshkol expression rejected cleanly (reply=${JSON.stringify(out.malformedReply)})`);
    assert.equal(out.terminated, true);
    assert.equal(out.r3.failed, false, `post-crash Eshkol miss recovered cleanly: ${out.r3.err}`);
    assert.ok(out.r3.crossCheck < 1e-10, `recovered Eshkol AD cross-check (${out.r3.crossCheck})`);
    assert.equal(out.afterRecoveryResidency.spawns.eshkol, 2, 'fresh Eshkol worker spawned after termination');
    assert.ok(out.afterRecoveryResidency.recoveries.eshkol >= 1, 'recovery counter incremented');
    assert.equal(out.r3.loads, 1, 'fresh worker initialized cleanly');
    assert.equal(out.adopt3.count, 1);
    assert.equal(out.finalLedgerActive, 0, 'zero leaked G5 reservations');
    assert.equal(out.implicitPressureUpdates, 3, 'all 3 Eshkol EOS fits updated GPU implicit pressure table');
    assert.equal(out.commitCount, 5, 'all 5 StateManager commit deltas published');

    console.log(JSON.stringify({
      eshkolWarm: { spawns: out.eshkolWarmResidency.spawns.eshkol, r1CrossCheck: out.r1.crossCheck, r2CrossCheck: out.r2.crossCheck, loads: out.r2.loads, calls: out.r2.calls },
      moonlabWarm: { spawns: out.moonlabWarmResidency.spawns.moonlab, probSum: out.qr1.probSum, nativeAccelerated: out.qr1.nativeAccelerated, loads: out.qr2.loads, calls: out.qr2.calls },
      recovery: { spawnsAfterCrash: out.afterRecoveryResidency.spawns.eshkol, recoveries: out.afterRecoveryResidency.recoveries.eshkol, r3CrossCheck: out.r3.crossCheck, implicitPressureUpdates: out.implicitPressureUpdates, finalLedgerActive: out.finalLedgerActive }
    }));
  } finally {
    await browser.close();
  }
});
