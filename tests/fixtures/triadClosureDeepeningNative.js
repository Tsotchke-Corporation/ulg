import { eshkolTriadClosuresWgsl } from '../../src/runtime/material/eshkolTriadClosures.js';
import { createWarmClosureMissBridge } from '../../src/runtime/material/warmClosureMissBridge.js';
import {
  createRegionalClosureWorkerLane,
  regionalClosureLaneBindings,
  destroyRegionalClosureWorkerLane
} from '../../src/runtime/material/regionalClosureWorkerLane.js';
import * as potential from '../../src/runtime/material/thermalPotentialGpu.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import * as thermo from '../../src/runtime/material/condensableThermodynamics.js';
import { createExtendedPhaseCaloricFixture } from './sphExtendedPhaseCaloric.js';
import { StateManager } from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';

export async function runTriadClosureDeepeningNativeProof() {
  let adapter = null;
  for (let i = 0; i < 5 && !adapter; i += 1) {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) throw new Error('WebGPU adapter unavailable');
  const device = await adapter.requestDevice({
    requiredLimits: { maxStorageBuffersPerShaderStage: 16 }
  });
  const errors = [];
  device.addEventListener('uncapturederror', (e) => {
    if (errors.length < 20) errors.push(e.error.message);
  });
  device.pushErrorScope('validation');

  const lane = createRegionalClosureWorkerLane(device, { name: 'triad-deepening-lane' });
  const bridge = createWarmClosureMissBridge({
    device,
    lane,
    maxInFlight: 2,
    sourceIdentity: 'triad-native-gpu-v1',
    taskRunner: async (payload) => ({
      value: { qubits: payload.qubits, verified: true },
      commitDelta: { taskId: 'native-moonlab-probe', payload: { residency: 'local-warm-proof' } }
    })
  });

  // 1. Trigger MoonLab + Eshkol first-principles cold-miss synthesis for Iron through PeerCompute A6 bridge
  const req = bridge.requestTriadClosureSynthesisMiss({
    missKey: 'triad:fe-native',
    material: 'fe',
    molarMassKgPerMol: 0.055845,
    atomsPerFormula: 1,
    cohesiveEnergyEvPerAtom: 4.28,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.52e-10,
    refDensityKgPerM3: 7874,
    meltTemperatureK: 1811,
    temperatureRangeK: [240, 1200],
    scheduleId: 'native-sched-1'
  });
  const entry = await req.promise;
  const adoption = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'native-sched-2' });
  const laneBindings = regionalClosureLaneBindings(lane);
  const syn = entry.synthesized;

  // Pick interior test coordinates inside all domains
  const testT = 620.0;
  const v0 = 1.0 / syn.parameters.refDensityKgPerM3;
  const testV = 0.99 * v0;
  const testJ = 0.98;
  const testRho = 1.8 * syn.parameters.gasRefDensityKgPerM3;

  // 2. Evaluate the adopted GPU A4 5-slot table natively on Vulkan WebGPU
  const probeWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> triad_a4_table: array<f32>;
@group(0) @binding(1) var<storage, read_write> out: array<f32>;
${eshkolTriadClosuresWgsl('triad_a4_table')}
@compute @workgroup_size(1)
fn main() {
  let h = triad_eval_helmholtz(0u, ${testT}, ${testV});
  let s = triad_eval_solid_hyperelastic(1u, ${testJ}, ${testT});
  let tr = triad_eval_transport(2u, 3u, 4u, ${testT}, ${testRho});
  let oob = triad_eval_helmholtz(0u, 50.0, ${testV});
  out[0] = h.free_energy_j_per_kg;
  out[1] = h.entropy_j_per_kg_k;
  out[2] = h.pressure_pa;
  out[3] = h.cv_j_per_kg_k;
  out[4] = h.bulk_modulus_kt_pa;
  out[5] = f32(h.ok);
  out[6] = s.x;
  out[7] = s.y;
  out[8] = s.z;
  out[9] = s.w;
  out[10] = tr.x;
  out[11] = tr.y;
  out[12] = tr.z;
  out[13] = tr.w;
  out[14] = f32(oob.ok);
}
`;
  const mod = device.createShaderModule({ code: probeWgsl });
  const pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
  const outBuf = device.createBuffer({ size: 64, usage: 0x80 | 0x04 });
  const readBuf = device.createBuffer({ size: 64, usage: 1 | 8 });
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipe);
  pass.setBindGroup(0, device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: laneBindings.tableBuffer } },
      { binding: 1, resource: { buffer: outBuf } }
    ]
  }));
  pass.dispatchWorkgroups(1);
  pass.end();
  enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, 64);
  device.queue.submit([enc.finish()]);
  await readBuf.mapAsync(1);
  const gpuOut = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  readBuf.destroy();
  outBuf.destroy();

  // Compare GPU results against exact closed-form physics
  const hRef = syn.helmholtz.program.closedForm;
  const sRef = syn.solidHyperelastic.program.closedForm;
  const tRef = syn.transport.program.closedForm;
  const relErr = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
  const epsJ = 1e-6;
  const exactSolidP = -(sRef.psi(testJ + epsJ, testT) - sRef.psi(testJ - epsJ, testT)) / (2 * epsJ);

  // 3. Also feed MoonLab's synthesized 17-sample Debye G6 caloric curve into thermalPotentialGpu on Vulkan WebGPU!
  const manager = new StateManager(null, {
    enablePersistence: false,
    disableBroadcast: true,
    disableNetworkProvider: true
  });
  await manager.initialize();
  const ledger = manager.createReservationLedger({ name: 'triad-g6-debye', maxKeys: 3 });
  const fixture = createExtendedPhaseCaloricFixture(thermo);
  const matTable = thermal.buildSphThermalMaterialTable(fixture.materialProperties);
  const graphs = thermal.buildSphThermalClosureGraphBuffers(matTable);
  const solidGraph = graphs.graphBank.graphRecords.findIndex((r) => r.phaseFromId === 1 && r.phaseToId === 1);
  const debye = syn.g6DebyeSamples;
  const origNodeRows = graphs.graphBank.nodeRows;
  const origSampleRows = graphs.graphBank.sampleRows;
  const newSamples = new Float32Array(origSampleRows.length + debye.length * 4);
  newSamples.set(origSampleRows);
  const newOff = origSampleRows.length / 4;
  for (let i = 0; i < debye.length; i += 1) {
    newSamples[(newOff + i) * 4 + 0] = debye[i].u;
    newSamples[(newOff + i) * 4 + 1] = debye[i].temperatureK;
  }
  const patchedNodes = new Float32Array(origNodeRows);
  const nb = solidGraph * 16;
  patchedNodes[nb + 4] = newOff;
  patchedNodes[nb + 5] = debye.length;
  patchedNodes[nb + 6] = debye[0].u;
  patchedNodes[nb + 7] = debye[debye.length - 1].u;
  const upload = thermal.uploadSphThermalResponseGraphBuffers(device, {
    thermalMaterialTable: matTable,
    thermalClosureGraphSet: {
      ...graphs,
      graphBank: {
        ...graphs.graphBank,
        nodeRows: patchedNodes,
        sampleRows: newSamples,
        sampleCount: newSamples.length / 4,
        sampleRowByteLength: newSamples.byteLength
      }
    }
  });
  const cache = potential.createThermalPotentialGpu(device, {
    thermalResponseGraphUpload: upload,
    reservationLedger: ledger
  });
  const g6Code = /* wgsl */ `
@group(0) @binding(0) var<storage, read> g6_table: array<f32>;
@group(0) @binding(1) var<storage, read> g6_metadata: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> g6_requests: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> hits: array<atomic<u32>>;
${potential.thermalPotentialLookupWgsl()}
@compute @workgroup_size(64)
fn probe(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= 16u) { return; }
  let g = ${solidGraph}u;
  let n = nodes[g * 4u + 1u];
  let u = n.z + (0.38 + 0.14 * f32(id.x) / 15.0) * (n.w - n.z);
  let res = g6_temperature(g, u, 1.0);
  if (res.w == 1.0) { atomicAdd(&hits[0u], 1u); }
}
`;
  const g6Mod = device.createShaderModule({ code: g6Code });
  const g6Pipe = device.createComputePipeline({ layout: 'auto', compute: { module: g6Mod, entryPoint: 'probe' } });
  const hitBuf = device.createBuffer({ size: 16, usage: 0x80 | 0x04 | 0x08 });
  const runG6 = async (lease) => {
    const e = device.createCommandEncoder();
    e.clearBuffer(hitBuf);
    const p = e.beginComputePass();
    p.setPipeline(g6Pipe);
    p.setBindGroup(0, device.createBindGroup({
      layout: g6Pipe.getBindGroupLayout(0),
      entries: [lease.table, lease.metadata, lease.requests, upload.graphNodeBuffer, hitBuf]
        .map((buffer, binding) => ({ binding, resource: { buffer } }))
    }));
    p.dispatchWorkgroups(1);
    p.end();
    const rd = device.createBuffer({ size: 16, usage: 1 | 8 });
    e.copyBufferToBuffer(hitBuf, 0, rd, 0, 16);
    device.queue.submit([e.finish()]);
    await rd.mapAsync(1);
    const count = new Uint32Array(rd.getMappedRange())[0];
    rd.unmap();
    rd.destroy();
    return count;
  };

  const l0 = potential.retainThermalPotentialGpu(cache, device, upload);
  await runG6(l0);
  const cand = potential.encodeThermalPotentialCandidateGpu(cache, device.createCommandEncoder());
  potential.submitThermalPotentialCandidateGpu(cand);
  await potential.completeThermalPotentialCandidateGpu(cand);
  const delta = { id: 'triad-g6-1' };
  potential.attachThermalPotentialCandidateToDelta(cand, delta);
  const g6DebyeAdopted = potential.settleThermalPotentialDelta(delta, true);
  const l1 = potential.retainThermalPotentialGpu(cache, device, upload);
  const g6DebyeHits = await runG6(l1);

  const val = await device.popErrorScope();
  l0.release();
  l1.release();
  hitBuf.destroy();
  potential.destroyThermalPotentialGpu(cache);
  thermal.destroySphThermalResponseGraphBuffers(upload);
  await manager.destroy();
  bridge.destroy();
  destroyRegionalClosureWorkerLane(lane);
  device.destroy();

  return {
    adoptedCount: adoption.adoptedCount,
    laneOrdinal: laneBindings.ordinal,
    inBoxOk: gpuOut[5] === 1 && gpuOut[9] === 1 && gpuOut[13] === 1 ? 1 : 0,
    outOfBoxOk: gpuOut[14],
    helmholtzRelErr: relErr(gpuOut[0], hRef.a(testT, testV)),
    entropyRelErr: relErr(gpuOut[1], hRef.s(testT, testV)),
    pressureRelErr: relErr(gpuOut[2], hRef.p(testT, testV)),
    cvRelErr: relErr(gpuOut[3], hRef.cv(testT, testV)),
    ktRelErr: relErr(gpuOut[4], hRef.kt(testT, testV)),
    solidPressureRelErr: relErr(gpuOut[7], exactSolidP),
    kRelErr: relErr(gpuOut[10], tRef.k(testT, testRho)),
    muRelErr: relErr(gpuOut[11], tRef.mu(testT, testRho)),
    dRelErr: relErr(gpuOut[12], tRef.D(testT, testRho)),
    g6DebyeAdopted,
    g6DebyeHits,
    validation: val?.message ?? null,
    errors
  };
}
