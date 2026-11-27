import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import { registerAllTopDownLawModules } from '../src/runtime/universalLawGraph.js';
import { validateLawAdapterDescriptor } from '../src/runtime/sph/lawAdapterContract.js';
import {
  destroyTriadClosureRegistry,
  getTriadClosureGpuBinding,
  registerGasResponseTableOnDevice,
  triadClosureMechanicsRefreshWgsl
} from '../src/runtime/material/triadClosureGpuRegistry.js';
import { buildMaterialGasResponseFunctions } from '../src/runtime/material/gasResponseFunctions.js';
import {
  createDistributedSpatialPartitioner,
  encodeTileMultipolePayload
} from '../src/services/distributedSpatialPartitioner.js';
import {
  createCanonicalMlsMpmLawDagEpochScheduler
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  compileDeclarativeLawIrToWgsl,
  createRepresentedVolumePhaseRetargetLawIr,
  createTaitEosCavitationLawIr
} from '../src/runtime/material/eshkolHigherOrderLawCompiler.js';
import { SUPERGALACTIC_TREEPM_LAW_ADAPTER } from '../src/runtime/astrophysics/supergalacticTreePmGpu.js';
import { GALACTIC_PARTICLE_MESH_LAW_ADAPTER } from '../src/runtime/astrophysics/galacticParticleMeshGpu.js';
import { SOLAR_SYSTEM_NBODY_LAW_ADAPTER } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import { PLANETARY_STRUCTURE_LAW_ADAPTER } from '../src/runtime/astrophysics/planetaryStructureGpu.js';
import { GALACTIC_ISM_COOLING_LAW_ADAPTER } from '../src/runtime/astrophysics/galacticIsmCoolingGpu.js';

const ROOT = path.resolve(import.meta.dirname, '..');

function createMockGpuDevice(maxStorageBuffersPerShaderStage = 10) {
  return {
    limits: {
      maxStorageBuffersPerShaderStage,
      maxBufferSize: 128 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone: () => Promise.resolve()
    },
    createBuffer(desc) {
      return { ...desc, destroyed: false, destroy() { this.destroyed = true; } };
    }
  };
}

test('Wave D5.1: sphMechanicsRefreshGpuKernel retires raw .replace() patching and packs Triad table+map within reduced storage slots', async () => {
  const kernelSrc = await fs.readFile(
    path.join(ROOT, 'src/runtime/sph/sphMechanicsRefreshGpuKernel.js'),
    'utf8'
  );
  assert.match(kernelSrc, /composeWgslVariantFromSource/);
  assert.doesNotMatch(kernelSrc, /refreshCode\s*=\s*refreshCode[\s\S]{0,60}\.replace\(/);
  assert.match(kernelSrc, /packedMap:\s*true/);
  assert.match(kernelSrc, /packedTableAndMapBuffer/);

  const device = createMockGpuDevice(10);
  const gasBundle = buildMaterialGasResponseFunctions({
    n2: {
      molarMassKgPerMol: 0.0280134,
      atomsPerFormula: 2,
      phases: [{ name: 'gas', densityKgPerM3: 1.16, cpJPerKgK: 1040, temperatureK: 293.15 }]
    }
  });
  registerGasResponseTableOnDevice(device, {
    a4GasResponseTable: gasBundle.packedGpuTable,
    a4GasResponseByMaterial: gasBundle.byMaterial
  });
  const binding = getTriadClosureGpuBinding(device);
  assert.equal(binding.active, true);
  assert.ok(binding.packedTableAndMapBuffer, 'Triad registry must build packedTableAndMapBuffer');

  const packedWgsl = triadClosureMechanicsRefreshWgsl({
    packedMap: true,
    tableBinding: 9,
    receiptBinding: 10
  });
  assert.match(packedWgsl, /@group\(0\) @binding\(9\) var<storage, read> triad_a4_table/);
  assert.match(packedWgsl, /@group\(0\) @binding\(10\) var<storage, read_write> triad_envelope_receipt/);
  assert.doesNotMatch(packedWgsl, /triad_material_map/, 'packed Triad WGSL must eliminate the separate triad_material_map storage buffer');
  assert.match(packedWgsl, /bitcast<u32>\(triad_a4_table\[total_words - 2u\]\)/);

  assert.equal(destroyTriadClosureRegistry(device), true);
});

test('Wave D5.1: Studio worker gates A3 thermal submits off non-thermal/adiabatic lanes and reports strictly honest sphImplicitThermalStatus', async () => {
  const workerSrc = await fs.readFile(
    path.join(ROOT, 'src/services/ulgMechanicsResidentStage.worker.js'),
    'utf8'
  );
  assert.match(workerSrc, /resolveSphWallReservoirAuthority/);
  assert.match(workerSrc, /const a3ThermalConsumerActive = \(\(\) =>/);
  assert.match(workerSrc, /if \(a3ThermalConsumerActive && submitBurstOpened/);
  assert.match(workerSrc, /a3ThermalConsumerActive\s*\n\s*&& !a3ThermalTickEncodedInBurst/);

  // Strictly honest implicit thermal status: zero fabricated passCount: 1 or active: true when 0 GPU IMEX passes ran
  assert.match(workerSrc, /dispatchedOnGpu:\s*false/);
  assert.match(workerSrc, /passCount:\s*0/);
  assert.match(workerSrc, /mode:\s*'advisory-envelope-only'/);
  assert.match(workerSrc, /envelopeExceeded:\s*Boolean\(foEnv\.exceedsExplicitStability\)/);
  assert.match(workerSrc, /fourierEnvelopeExceeded:\s*Boolean\(implicitThermalStatus\?\.envelopeExceeded/);
});

test('Wave D5.2: Studio worker runs live LawDagEpochScheduler, compiles canonical Law-IR modules, and feeds live GPU telemetry into dynamicHierarchyLod', async () => {
  const workerSrc = await fs.readFile(
    path.join(ROOT, 'src/services/ulgMechanicsResidentStage.worker.js'),
    'utf8'
  );
  assert.match(workerSrc, /createCanonicalMlsMpmLawDagEpochScheduler/);
  assert.match(workerSrc, /compileDeclarativeLawIrToWgsl/);
  assert.match(workerSrc, /createTaitEosCavitationLawIr/);
  assert.match(workerSrc, /createRepresentedVolumePhaseRetargetLawIr/);
  assert.match(workerSrc, /lawDagEpoch:\s*lawDagEpochStatus/);
  assert.match(workerSrc, /telemetrySource:\s*liveGpuMetricsUsed/);
  assert.match(workerSrc, /liveTempSpanK/);

  // Verify live Law-DAG scheduler + Law-IR compilation invariants directly
  const dag = createCanonicalMlsMpmLawDagEpochScheduler({
    epochId: 'wave-d5-test-epoch',
    epochGeneration: 7,
    requireCanonicalSsAuthority: true
  });
  assert.equal(dag.validation.valid, true);
  assert.equal(dag.validation.debt.length, 0);
  for (const [mode, stageIds] of Object.entries(dag.hoistingPlan)) {
    for (let i = 0; i < stageIds.length; i += 1) {
      dag.acquireHoistedSpatialView(mode, () => ({ mode }));
    }
  }
  dag.releaseHoistedViews();
  const drained = dag.leaseScope.assertDrained({ requireAllReleased: true });
  assert.equal(drained.live, 0);
  assert.ok(drained.released > 0);
  assert.ok(dag.snapshot().hoistedViewBuilds > 0);
  assert.ok(dag.snapshot().hoistedViewReuses > 0);

  const taitIr = compileDeclarativeLawIrToWgsl(createTaitEosCavitationLawIr(), { includeEnvelopeWatch: true });
  const phaseIr = compileDeclarativeLawIrToWgsl(createRepresentedVolumePhaseRetargetLawIr(), { includeEnvelopeWatch: true });
  assert.match(taitIr.wgsl, /@compute/);
  assert.match(phaseIr.wgsl, /@compute/);
  assert.ok(typeof taitIr.fingerprint === 'string' && taitIr.fingerprint.length >= 8);
  assert.ok(typeof phaseIr.fingerprint === 'string' && phaseIr.fingerprint.length >= 8);
});

test('Wave D5.2: all 5 previously unregistered L0-L4 astrophysics modules are registered on SimulationModuleRegistry with live WGSL entryPoints and zero-debt Law Adapters', async () => {
  const reg = createSimulationModuleRegistry();
  registerAllTopDownLawModules(reg);

  const expected = [
    { key: 'flrw-treepm-cosmology@1', source: 'src/runtime/astrophysics/supergalacticTreePmGpu.js', entry: 'cic_kick_drift', adapter: SUPERGALACTIC_TREEPM_LAW_ADAPTER },
    { key: 'galactic-mhd-evolution@1', source: 'src/runtime/astrophysics/galacticParticleMeshGpu.js', entry: 'pm_kick_and_drift', adapter: GALACTIC_PARTICLE_MESH_LAW_ADAPTER },
    { key: 'solar-system-nbody@1', source: 'src/runtime/astrophysics/solarSystemNBodyGpu.js', entry: 'compute_nbody_accel', adapter: SOLAR_SYSTEM_NBODY_LAW_ADAPTER },
    { key: 'planetary-interior-polytope@1', source: 'src/runtime/astrophysics/planetaryStructureGpu.js', entry: 'solve_planetary_hydrostatic', adapter: PLANETARY_STRUCTURE_LAW_ADAPTER },
    { key: 'galactic-ism-cooling@1', source: 'src/runtime/astrophysics/galacticIsmCoolingGpu.js', entry: 'step_galactic_ism', adapter: GALACTIC_ISM_COOLING_LAW_ADAPTER }
  ];

  for (const spec of expected) {
    assert.equal(reg.hasModule(spec.key), true, `${spec.key} must be registered`);
    const resolved = reg.resolveModule(spec.key);
    assert.ok(resolved?.descriptor, `${spec.key} descriptor missing`);
    assert.equal(resolved.descriptor.kernel.sourceModule, spec.source);
    assert.equal(resolved.descriptor.kernel.entryPoint, spec.entry);

    const adapterCheck = validateLawAdapterDescriptor(spec.adapter, {
      requireExtendedMetadata: true
    });
    assert.equal(adapterCheck.valid, true, `${spec.key} adapter errors: ${adapterCheck.errors.join(', ')}`);
    assert.equal(adapterCheck.debt.length, 0, `${spec.key} adapter debt: ${adapterCheck.debt.join(', ')}`);

    const src = await fs.readFile(path.join(ROOT, spec.source), 'utf8');
    assert.match(src, new RegExp(`fn\\s+${spec.entry}\\s*\\(`), `${spec.key} WGSL entryPoint "${spec.entry}" must exist in ${spec.source}`);
  }
});

test('Wave D5.2: L0 cosmology wires PeerCompute SpatialTileLeaseBroker fail-closed tile leasing & multipole admission', async () => {
  const physSrc = await fs.readFile(path.join(ROOT, 'src/demos/ulgUniversesPhysics.js'), 'utf8');
  assert.match(physSrc, /createDistributedSpatialPartitioner/);
  assert.match(physSrc, /cosmoSpatialPartitioner = createDistributedSpatialPartitioner\(/);
  assert.match(physSrc, /admitRemoteCosmoTileMultipole\(/);
  assert.match(physSrc, /cosmoSession\.injectRemoteTileMultipoles\(/);

  // Verify fail-closed PeerCompute SpatialTileLeaseBroker behavior on 4-slab L0 partition
  const part = createDistributedSpatialPartitioner({
    domainId: 'ulg-universes-l0-test',
    boxLength: 1425,
    tileCount: 4
  });
  const localClaim = part.claimTile(0, 'peer-local');
  assert.equal(localClaim.claimed, true);

  // Unclaimed remote tile MUST be rejected fail-closed
  const rejectedUnclaimed = part.submitTileMultipoleSummary({
    tileIndex: 1,
    peerId: 'peer-remote',
    summaryEpoch: part.getEpoch(),
    payload: encodeTileMultipolePayload({ totalMass: 120, com: [250, 0, 0], particleCount: 512 })
  });
  assert.equal(rejectedUnclaimed.accepted, false);

  // Claimed remote tile with valid token MUST be admitted
  const remoteClaim = part.claimTile(1, 'peer-remote');
  assert.equal(remoteClaim.claimed, true);
  const admitted = part.submitTileMultipoleSummary({
    tileIndex: 1,
    peerId: 'peer-remote',
    token: remoteClaim.token,
    summaryEpoch: part.getEpoch(),
    payload: encodeTileMultipolePayload({ totalMass: 120, com: [250, 12, -8], particleCount: 512, scaleFactorA: 0.65, stepIndex: 4 })
  });
  assert.equal(admitted.accepted, true);
  const remoteList = part.getAdmittedTileSummaries({ excludePeerId: 'peer-local' });
  assert.equal(remoteList.length, 1);
  assert.equal(remoteList[0].totalMass, 120);

  // Wrong owner on peer-remote's tile MUST be rejected fail-closed
  const rejectedWrongOwner = part.submitTileMultipoleSummary({
    tileIndex: 1,
    peerId: 'peer-spoof',
    token: remoteClaim.token,
    summaryEpoch: part.getEpoch(),
    payload: encodeTileMultipolePayload({ totalMass: 999, com: [0, 0, 0] })
  });
  assert.equal(rejectedWrongOwner.accepted, false);

  // Evicting peer-remote drops its admitted multipole summary immediately
  part.evictPeer('peer-remote');
  assert.equal(part.getAdmittedTileSummaries({ excludePeerId: 'peer-local' }).length, 0);
});
