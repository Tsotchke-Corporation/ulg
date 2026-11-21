import * as potential from '../../src/runtime/material/thermalPotentialGpu.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import * as thermo from '../../src/runtime/material/condensableThermodynamics.js';
import { createExtendedPhaseCaloricFixture } from './sphExtendedPhaseCaloric.js';
import { StateManager } from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';

export async function runThermalPotentialMultiPhaseNativeProof() {
  let adapter = null;
  for (let i = 0; i < 5 && !adapter; i += 1) {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!adapter) {
    throw new Error('WebGPU adapter unavailable');
  }
  const device = await adapter.requestDevice({
    requiredLimits: { maxStorageBuffersPerShaderStage: 16 }
  });
  const errors = [];
  device.addEventListener('uncapturederror', (event) => {
    if (errors.length < 20) {
      errors.push(event.error.message);
    }
  });
  device.pushErrorScope('validation');

  const manager = new StateManager(null, {
    enablePersistence: false,
    disableBroadcast: true,
    disableNetworkProvider: true
  });
  await manager.initialize();
  const ledger = manager.createReservationLedger({ name: 'g6-multiphase', maxKeys: 3 });

  const fixture = createExtendedPhaseCaloricFixture(thermo);
  const table = thermal.buildSphThermalMaterialTable(fixture.materialProperties);
  const graphs = thermal.buildSphThermalClosureGraphBuffers(table);
  const records = graphs.graphBank.graphRecords;
  const origNodeRows = graphs.graphBank.nodeRows;
  const origSampleRows = graphs.graphBank.sampleRows;
  const solidGraph = records.findIndex((r) => r.phaseFromId === 1 && r.phaseToId === 1);
  const liquidGraph = records.findIndex((r) => r.phaseFromId === 2 && r.phaseToId === 2);
  const gasGraph = records.findIndex((r, idx) => {
    if (r.phaseFromId !== 3 || r.phaseToId !== 3) return false;
    const sampleOff = Math.round(origNodeRows[idx * 16 + 4]);
    return origSampleRows[sampleOff * 4 + 1] > 0;
  });

  if (solidGraph < 0 || liquidGraph < 0 || gasGraph < 0) {
    throw new Error(`Missing phase graph(s): solid=${solidGraph} liquid=${liquidGraph} gas=${gasGraph}`);
  }

  // Upgrade the solid graph's raw sample array into a smooth 17-sample nonlinear
  // Debye-like caloric curve (varying cv(T)) while keeping the exact same energy
  // domain [u0, u1], proving multi-sample nonlinear Chebyshev fitting on GPU!
  const debyeSampleCount = 17;
  const origNodeBase = solidGraph * 16;
  const origSampleOffset = Math.round(origNodeRows[origNodeBase + 4]);
  const uLo = origNodeRows[origNodeBase + 6];
  const uHi = origNodeRows[origNodeBase + 7];
  const tLo = Math.max(80, origSampleRows[origSampleOffset * 4 + 1]);
  const tHi = Math.max(tLo + 50, origSampleRows[(origSampleOffset + 1) * 4 + 1]);
  const newSamples = new Float32Array(origSampleRows.length + debyeSampleCount * 4);
  newSamples.set(origSampleRows);
  const newSolidOffset = origSampleRows.length / 4;
  // Smooth nonlinear convex T(u) curve matching Debye-like cv(T) growth:
  // T(s) = tLo + (tHi - tLo) * (0.72*s + 0.28*s^2), strictly increasing with smooth dT/du > 0.
  for (let k = 0; k < debyeSampleCount; k += 1) {
    const s = k / (debyeSampleCount - 1);
    const u = uLo + s * (uHi - uLo);
    const t = tLo + (tHi - tLo) * (0.72 * s + 0.28 * s * s);
    const base = (newSolidOffset + k) * 4;
    newSamples[base + 0] = u;
    newSamples[base + 1] = t;
    newSamples[base + 2] = 0;
    newSamples[base + 3] = 0;
  }
  const patchedNodes = new Float32Array(origNodeRows);
  patchedNodes[origNodeBase + 4] = newSolidOffset;
  patchedNodes[origNodeBase + 5] = debyeSampleCount;
  const patchedGraphs = {
    ...graphs,
    graphBank: {
      ...graphs.graphBank,
      nodeRows: patchedNodes,
      sampleRows: newSamples,
      sampleCount: newSamples.length / 4,
      sampleRowByteLength: newSamples.byteLength
    }
  };

  const upload = thermal.uploadSphThermalResponseGraphBuffers(device, {
    thermalMaterialTable: table,
    thermalClosureGraphSet: patchedGraphs
  });
  const cache = potential.createThermalPotentialGpu(device, {
    thermalResponseGraphUpload: upload,
    reservationLedger: ledger
  });

  const probeCode = /* wgsl */ `
@group(0) @binding(0) var<storage, read> g6_table: array<f32>;
@group(0) @binding(1) var<storage, read> g6_metadata: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> g6_requests: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> samples: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out: array<atomic<u32>>;
${potential.thermalPotentialLookupWgsl()}
@compute @workgroup_size(64)
fn probe(@builtin(global_invocation_id) id: vec3<u32>) {
  var graphs_to_test = array<u32, 3>(${solidGraph}u, ${liquidGraph}u, ${gasGraph}u);
  var phases_to_test = array<f32, 3>(1.0, 2.0, 3.0);
  var wrong_phases = array<f32, 3>(2.0, 3.0, 1.0);
  if (id.x >= 48u) { return; }
  let slot = id.x / 16u;
  let k = id.x % 16u;
  let g = graphs_to_test[slot];
  let phase = phases_to_test[slot];
  let wrong = wrong_phases[slot];
  let n = nodes[g * 4u + 1u];
  let offset = u32(n.x);
  let sample_count = u32(n.y);
  let left = samples[offset].xy;
  let right = samples[offset + sample_count - 1u].xy;
  // Query a physical 12% temperature window near the lower branch end so all
  // three phases (including wide 373..1e6 K gas branches) lie inside the G6
  // local dimensionless radius |x| <= 0.25.
  let cv_approx = (right.x - left.x) / max(right.y - left.y, 1.0);
  let t_span = min(right.y - left.y, max(left.y * 0.22, 10.0));
  let u_span = min(right.x - left.x, cv_approx * t_span);
  let u_start = left.x + 0.10 * u_span;
  let u_end = left.x + 0.80 * u_span;
  let u = u_start + (f32(k) / 15.0) * (u_end - u_start);
  let res = g6_temperature(g, u, phase);
  if (res.w == 1.0) { atomicAdd(&out[slot], 1u); }
  if (g6_temperature(g, u, wrong).w != 0.0) { atomicAdd(&out[3u], 1u); }
}
`;
  const mod = device.createShaderModule({ code: probeCode });
  const pipe = device.createComputePipeline({
    layout: 'auto',
    compute: { module: mod, entryPoint: 'probe' }
  });
  const outBuf = device.createBuffer({ size: 32, usage: 0x80 | 0x04 | 0x08 });
  const runProbe = async (lease) => {
    const enc = device.createCommandEncoder();
    enc.clearBuffer(outBuf);
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [lease.table, lease.metadata, lease.requests, upload.graphNodeBuffer, upload.graphSampleBuffer, outBuf]
        .map((buffer, binding) => ({ binding, resource: { buffer } }))
    }));
    pass.dispatchWorkgroups(1);
    pass.end();
    const read = device.createBuffer({ size: 32, usage: 1 | 8 });
    enc.copyBufferToBuffer(outBuf, 0, read, 0, 32);
    device.queue.submit([enc.finish()]);
    await read.mapAsync(1);
    const words = Array.from(new Uint32Array(read.getMappedRange()));
    read.unmap();
    read.destroy();
    return words;
  };

  const lease0 = potential.retainThermalPotentialGpu(cache, device, upload);
  const before = await runProbe(lease0);
  const candidate = potential.encodeThermalPotentialCandidateGpu(cache, device.createCommandEncoder());
  potential.submitThermalPotentialCandidateGpu(candidate);
  await potential.completeThermalPotentialCandidateGpu(candidate);
  const delta = { id: 'g6-mp-1' };
  potential.attachThermalPotentialCandidateToDelta(candidate, delta);
  const adopted = potential.settleThermalPotentialDelta(delta, true);
  const lease1 = potential.retainThermalPotentialGpu(cache, device, upload);
  const after = await runProbe(lease1);

  const val = await device.popErrorScope();
  lease0.release();
  lease1.release();
  outBuf.destroy();
  potential.destroyThermalPotentialGpu(cache);
  thermal.destroySphThermalResponseGraphBuffers(upload);
  await manager.destroy();
  device.destroy();

  return {
    solidGraph,
    liquidGraph,
    gasGraph,
    solidSamples: debyeSampleCount,
    liquidSamples: records[liquidGraph]?.sampleCount ?? null,
    gasSamples: records[gasGraph]?.sampleCount ?? null,
    before,
    adopted,
    after,
    validation: val?.message ?? null,
    errors
  };
}
