// Native cold-payload integration fixture. This worker receives only plain
// authored material inputs and initial particles, then uses the real remote
// seed receiver and thermal stage. Fixed four-particle evidence only.
import { refreshUlgSphMlsMpmHotBuffersFromRemoteSeed } from '../../src/runtime/peercomputeBrowserResidentHost.js';
import { buildSphThermalMaterialTableFromViewState } from '../../src/runtime/sph/sphStaticTableInputs.js';
import { runSphThermalStepWebGpu } from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { destroySphGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers } from '../../src/runtime/sph/sphGpuBuffers.js';
import { webGpuDeviceDescriptorForResidentSph } from '../../src/runtime/webgpuDeviceLimits.js';

self.onmessage = async ({ data: payload }) => {
  let device, hot, thermal;
  const evidence = { errors: [], fatalError: null, deviceDestroyed: false };
  try {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('Worker WebGPU adapter unavailable');
    device = await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter) || {});
    device.addEventListener('uncapturederror', (event) => evidence.errors.push(String(event.error?.message || event.error)));
    for (const kind of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(kind);
    const receipt = refreshUlgSphMlsMpmHotBuffersFromRemoteSeed({ device, stateSeedPayload: payload,
      cacheKey: 'native-caloric-worker-input', stateKey: 'native-caloric-worker-state',
      stateManager: { setHotBuffer(_key, record) { hot = record; } } });
    if (!hot) throw new Error('Actual remote receiver did not publish its cold upload');
    const table = buildSphThermalMaterialTableFromViewState(payload);
    for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
    thermal = await runSphThermalStepWebGpu({ device, sphParticleState: hot.sphPacked,
      sphParticleUpload: hot.sphUpload, thermalMaterialTable: table,
      sourceStateBuffer: hot.sphUpload.stateBuffer, sourceThermoBuffer: hot.sphUpload.thermoBuffer,
      proposalStateBuffer: hot.sphUpload.stateBuffer, proposalThermoBuffer: hot.sphUpload.thermoBuffer,
      wallTemperaturesK: { xMin: 320 }, wallLayerM: 1, wallRate: 2000, dtS: .1,
      conductionRate: 0, boxDimsM: [4, 4, 4], retainOutputParticleBuffers: true,
      readbackMode: 'full-parity-readback' });
    Object.assign(evidence, { receiverStatus: receipt.status, backend: thermal.backend,
      initial: { state: [...hot.sphPacked.state], thermo: [...hot.sphPacked.thermo], mechanics: [...hot.mlsMpmPacked.mechanics] },
      state: [...thermal.state], thermo: [...thermal.thermo],
      sphSignature: hot.sphPacked.phaseCaloricInitializationSignature,
      mlsSignature: hot.mlsMpmPacked.phaseCaloricInitializationSignature,
      inputSchemas: Object.fromEntries(Object.entries(payload.materialProperties)
        .map(([material, properties]) => [material, properties.phaseCaloricModel.schema])) });
  } catch (error) { evidence.fatalError = String(error?.stack || error); }
  finally {
    if (device) {
      try { await device.queue.onSubmittedWorkDone(); } catch (error) { evidence.errors.push(String(error)); }
      thermal?.destroyOutputParticleBuffers?.();
      if (hot) {
        destroyMlsMpmGpuParticleBuffers(hot.mlsMpmUpload);
        destroySphGpuParticleBuffers(hot.sphUpload);
      }
      for (const kind of ['out-of-memory', 'internal', 'validation']) {
        const error = await device.popErrorScope();
        if (error) evidence.errors.push(kind + ': ' + error.message);
      }
      device.destroy(); evidence.deviceDestroyed = true;
    }
  }
  self.postMessage(evidence);
};
