import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_RESIDENT_MODULE_CHECKPOINT_SCHEMA,
  ULG_RESIDENT_MODULE_LEASE_HANDLE_SCHEMA,
  createResidentModuleBufferSession
} from '../src/runtime/residentBufferLease.js';
import {
  ULG_SIMULATION_MODULE_REGISTRATION_SCHEMA,
  canonicalSimulationMethodKey,
  createNBodyGravityModuleRegistration,
  createSimulationModuleRegistry,
  stepNBodyInterleavedReference
} from '../src/runtime/simulationModuleRegistry.js';
import {
  QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
  QUANTUM_DERIVATION_STATUS,
  ULG_ATOMIC_RADIAL_DENSITY_SAMPLE_SCHEMA,
  ULG_BOND_DISCOVERY_TRACE_SCHEMA,
  ULG_MATERIAL_DERIVATION_VISUALIZATION_BUNDLE_SCHEMA,
  ULG_MATERIAL_RESPONSE_FIT_REPLAY_SCHEMA,
  ULG_MOLECULAR_CHARGE_DENSITY_GRID_SCHEMA,
  ULG_ORBITAL_CLOUD_GRID_SCHEMA,
  buildAtomicRadialDensityArtifact,
  buildMaterialDerivationVisualizationBundle,
  buildMolecularChargeDensityArtifact,
  createQuantumDerivationSimulationModule,
  validateDerivationVisualizationBundle
} from '../src/runtime/electronicStructure/quantumDerivationArtifacts.js';
import {
  COSMIC_QUANTUM_SCALE_REGIMES,
  ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA,
  createCosmicQuantumScaleBridge
} from '../src/runtime/sph/cosmicQuantumScaleBridge.js';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../ulg-gpu-abi/src/serviceContract.js';
import { createSimulationArtifact } from '../ulg-gpu-abi/src/index.js';

const H2O_ATOMS = [
  { Z: 8, position: [0, 0, 0] },
  { Z: 1, position: [1.43, 0, 1.108] },
  { Z: 1, position: [-1.43, 0, 1.108] }
];

test('resident module buffer session issues epoch-fenced read leases, rejects stale handles after reset, and restores checkpoints', async () => {
  let destroyCalls = 0;
  const mockBuf = { label: 'bodies-v0', size: 64, destroy() { destroyCalls += 1; } };
  const session = createResidentModuleBufferSession({
    sessionId: 'nbody-session-1',
    moduleId: 'nbody-gravity@1',
    layout: {
      tensorId: 'bodies',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 8,
      strideBytes: 32,
      fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
    }
  });

  const initialBodies = Float32Array.from([
    -1, 0, 0, 2, 0, 0, 0, 0.1,
    1, 0, 0, 3, 0, 0, 0, 0.1
  ]);
  const pub = session.publishBuffer({
    resourceKey: 'bodies',
    buffer: mockBuf,
    byteLength: 64,
    rowCount: 2,
    stepIndex: 1,
    portableSnapshotFn: () => Float32Array.from(initialBodies)
  });
  assert.equal(pub.resetEpoch, 0);
  assert.equal(pub.stepIndex, 1);

  const handle = session.borrowBufferReadLease({
    resourceKey: 'bodies',
    consumerStage: 'threejs-renderer'
  });
  assert.equal(handle.schema, ULG_RESIDENT_MODULE_LEASE_HANDLE_SCHEMA);
  assert.equal(handle.readOnly, true);
  assert.equal(handle.isCurrent(), true);
  assert.equal(session.validateLeaseHandle(handle).ok, true);

  const checkpoint = await session.createPortableCheckpoint({ resourceKey: 'bodies' });
  assert.equal(checkpoint.schema, ULG_RESIDENT_MODULE_CHECKPOINT_SCHEMA);
  assert.equal(checkpoint.stepIndex, 1);
  assert.equal(checkpoint.values.length, 16);

  // Tampering with checkpoint values must fail closed on restore.
  const tampered = { ...checkpoint, values: [999, ...checkpoint.values.slice(1)] };
  await assert.rejects(() => session.restoreFromCheckpoint(tampered), /Checkpoint integrity mismatch/);

  // Reset invalidates all previously issued handles and destroys old GPU buffer.
  const resetReceipt = session.reset({ nextStep: 0, reason: 'user-reset' });
  assert.equal(resetReceipt.resetEpoch, 1);
  assert.equal(resetReceipt.revokedHandleCount, 1);
  assert.equal(destroyCalls, 1);
  assert.equal(handle.isCurrent(), false);
  assert.equal(session.validateLeaseHandle(handle).reason, 'stale-reset-epoch');
  assert.throws(() => session.assertValidLeaseHandle(handle), (err) => err.code === 'ERR_STALE_RESIDENT_BUFFER_LEASE');

  // Restoring from valid checkpoint starts a fresh epoch and issues valid new handles.
  const restored = await session.restoreFromCheckpoint(checkpoint, {
    uploadFn: (cp) => ({
      buffer: { label: 'bodies-restored', size: cp.values.length * 4, destroy() {} },
      byteLength: cp.values.length * 4
    })
  });
  assert.equal(restored.restored, true);
  assert.equal(restored.published.stepIndex, 1);
  assert.equal(restored.published.resetEpoch, 2);
  const freshHandle = session.borrowBufferReadLease({ resourceKey: 'bodies', consumerStage: 'renderer' });
  assert.equal(freshHandle.isCurrent(), true);
  assert.equal(handle.isCurrent(), false);
});

test('simulation module registry routes nbody-gravity@1 simulation.step capsules, reproduces exact 2-body kinematics, and enforces fail-closed reset', async () => {
  const registry = createSimulationModuleRegistry();
  const pair = Float32Array.from([
    -1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.1,
    1.0, 0.0, 0.0, 3.0, 0.0, 0.0, 0.0, 0.1
  ]);
  const desc = registry.registerModule(createNBodyGravityModuleRegistration({
    initialBodies: pair
  }));
  assert.equal(desc.schema, ULG_SIMULATION_MODULE_REGISTRATION_SCHEMA);
  assert.equal(desc.methodKey, 'nbody-gravity@1');
  assert.equal(canonicalSimulationMethodKey({ model: 'nbody-gravity', version: 1 }), 'nbody-gravity@1');

  const params = { dt: 0.01, gravity: 1.0, softening: 0.1, collisions: true };
  const capsule = createUlgTaskCapsule({
    taskId: 'nbody-2body-step-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'nbody-gravity', version: 1 },
    input: { stepIndex: 0, parameters: params },
    resources: { gpu: 'optional', childWorkers: 0 },
    validation: { mode: 'self' }
  });

  const dispatched = await registry.dispatchSimulationStepCapsule(capsule);
  assert.equal(dispatched.matched, true);
  assert.equal(dispatched.artifact.representation, 'nbody-interleaved-f32');
  assert.equal(dispatched.artifact.validity.bodyCount, 2);
  assert.equal(dispatched.artifact.validity.slotCount, 2);
  assert.equal(dispatched.artifact.execution.registeredModule, 'nbody-gravity@1');
  assert.equal(dispatched.leaseHandle.isCurrent(), true);

  // Must reproduce standalone symplectic-Euler reference identically.
  const ref = stepNBodyInterleavedReference(pair, params);
  const actual = Float32Array.from(dispatched.artifact.outputs.finalState.values);
  assert.equal(actual.length, ref.bodies.length);
  for (let i = 0; i < ref.bodies.length; i += 1) {
    assert.ok(Math.abs(actual[i] - ref.bodies[i]) < 1e-6, `body float[${i}] mismatch`);
  }
  // Exact momentum conservation for unequal two-body gravitational kick: m1*v1 + m2*v2 = 0.
  const totalPx = actual[3] * actual[4] + actual[11] * actual[12];
  assert.ok(Math.abs(totalPx) < 1e-6, `momentum drift ${totalPx}`);

  // Unregistered method cleanly falls through (matched: false) for default carrier handler.
  const defaultCapsule = createUlgTaskCapsule({
    taskId: 'default-carrier',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    input: { steps: 4 }
  });
  const unmatched = await registry.dispatchSimulationStepCapsule(defaultCapsule);
  assert.equal(unmatched.matched, false);

  // Parameter schema violation fails closed.
  const badCapsule = createUlgTaskCapsule({
    taskId: 'nbody-bad-dt',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'nbody-gravity', version: 1 },
    input: { stepIndex: 1, parameters: { dt: -1, gravity: 1, softening: 0.1 } }
  });
  await assert.rejects(() => registry.dispatchSimulationStepCapsule(badCapsule), (err) => err.code === 'ERR_INVALID_SIMULATION_MODULE_PARAMETERS');

  // Resetting the module session invalidates the prior lease handle.
  const preResetHandle = dispatched.leaseHandle;
  await registry.resetModuleSession({ model: 'nbody-gravity', version: 1 });
  assert.equal(preResetHandle.isCurrent(), false);
  assert.throws(() => dispatched.leaseSession.assertValidLeaseHandle(preResetHandle), (err) => err.code === 'ERR_STALE_RESIDENT_BUFFER_LEASE');

  // Sticky merger conserves mass, momentum, and volume (r_new^3 = r1^3 + r2^3).
  const touching = Float32Array.from([
    0.0, 0.0, 0.0, 2.0, 1.0, 0.0, 0.0, 0.3,
    0.4, 0.0, 0.0, 3.0, -0.5, 0.0, 0.0, 0.3
  ]);
  const merged = stepNBodyInterleavedReference(touching, { dt: 0.001, gravity: 1.0, softening: 0.1, collisions: true });
  assert.equal(merged.activeCount, 1);
  assert.ok(Math.abs(merged.bodies[3] - 5.0) < 1e-6);
  assert.ok(Math.abs(merged.bodies[4] - (2 * 1 + 3 * -0.5) / 5) < 1e-3);
  assert.ok(Math.abs(merged.bodies[7] ** 3 - (0.3 ** 3 + 0.3 ** 3)) < 1e-5);
  assert.equal(merged.bodies[11], 0);
});

test('simulation module registry supports external runNBodyCapsule adapter contract (eshkols-in-space)', async () => {
  const registry = createSimulationModuleRegistry();
  const simState = {
    count: 2,
    activeCount: 2,
    stepIndex: 0,
    gravityMode: 'direct',
    bodies: Float32Array.from([
      -1, 0, 0, 2, 0, 0, 0, 0.1,
      1, 0, 0, 3, 0, 0, 0, 0.1
    ]),
    async step(parameters) {
      const next = stepNBodyInterleavedReference(this.bodies, parameters);
      this.bodies = next.bodies;
      this.activeCount = next.activeCount;
      this.stepIndex += 1;
      return this.bodies;
    }
  };
  let runnerInvoked = 0;
  const externalRunner = async (capsule, { simulation, createSimulationArtifact: makeArtifact }) => {
    runnerInvoked += 1;
    const bodies = await simulation.step(capsule.input.parameters);
    return makeArtifact({
      artifactId: `${capsule.taskId}:ext:${simulation.stepIndex}`,
      taskKind: capsule.taskKind,
      closureRef: { module: 'physics/nbody.esk', entryPoint: 'step-world', kernelEntryPoint: 'main' },
      representation: 'nbody-interleaved-f32',
      outputs: {
        deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep: 0, toStep: 1 }],
        finalState: { tensorId: 'bodies', dtype: 'f32', layout: 'interleaved', shape: [2, 8], stepIndex: 1, values: Array.from(bodies) }
      },
      execution: { backend: 'webgpu', stage: 'eshkol.nbody.step', gravityMode: simulation.gravityMode },
      validity: { finite: true, bodyCount: simulation.activeCount, slotCount: simulation.count },
      validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
      provenance: capsule.provenance
    });
  };
  registry.registerModule(createNBodyGravityModuleRegistration({
    simulation: simState,
    externalRunner
  }));
  const capsule = createUlgTaskCapsule({
    taskId: 'ext-nbody-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'nbody-gravity', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.015, gravity: 1.0, softening: 0.18, collisions: false } }
  });
  const res = await registry.dispatchSimulationStepCapsule(capsule);
  assert.equal(runnerInvoked, 1);
  assert.equal(res.matched, true);
  assert.equal(res.artifact.validity.bodyCount, 2);
  assert.equal(res.leaseHandle.stepIndex, 1);
});

test('atomic radial density and molecular 3D charge density artifacts emit strict provenance, dense payloads, and accurate electron counts', () => {
  // 1. Atomic PBE + KH + Spin-Orbit artifact on Neon (Z=10)
  const { artifact: neArt, densePayloads: nePayloads } = buildAtomicRadialDensityArtifact(10, {
    functional: 'pbe',
    scalarRelativistic: true,
    spinOrbit: true,
    gridPointsN: 700,
    cloudGridDim: 20,
    maxGridDim: 12 // verifies mobile/device LOD downsample cap + explicit reason
  });
  assert.equal(neArt.schema, ULG_ATOMIC_RADIAL_DENSITY_SAMPLE_SCHEMA);
  assert.equal(neArt.symbol, 'Ne');
  assert.equal(neArt.statusBadge, QUANTUM_DERIVATION_STATUS.firstPrinciplesDerived);
  assert.ok(Math.abs(neArt.summary.integratedElectrons - 10) < 1e-4);
  assert.ok(neArt.summary.containmentRadii.r95Bohr > 1.0 && neArt.summary.containmentRadii.r95Bohr < 4.0);
  const ne2p = neArt.orbitals.find((o) => o.n === 2 && o.l === 1);
  assert.ok(ne2p.spinOrbitSplittingHa > 0 && ne2p.energyJMinusHa < ne2p.energyJPlusHa);
  assert.equal(neArt.orbitalCloudGrid.schema, ULG_ORBITAL_CLOUD_GRID_SCHEMA);
  assert.equal(neArt.orbitalCloudGrid.reconstructionKind, 'radial-atomic-density-reconstruction');
  assert.equal(neArt.orbitalCloudGrid.anisotropicOrbitalClaim, false);
  assert.equal(neArt.orbitalCloudGrid.payloadHandle.downsampled, true);
  assert.deepEqual(neArt.orbitalCloudGrid.payloadHandle.dimensions, [12, 12, 12]);
  const cloudKey = neArt.orbitalCloudGrid.payloadHandle.key;
  assert.equal(nePayloads[cloudKey].length, 12 * 12 * 12);

  // 2. Molecular 6-31G(d) 3D charge density + HOMO/LUMO + Mulliken/Mayer bonds on H2O
  const { artifact: h2oArt, densePayloads: h2oPayloads } = buildMolecularChargeDensityArtifact(H2O_ATOMS, {
    formula: 'H2O',
    basis: '6-31g(d)',
    gridDim: 18,
    includeUmp2: false,
    includeAnalyticGradient: true
  });
  assert.equal(h2oArt.schema, ULG_MOLECULAR_CHARGE_DENSITY_GRID_SCHEMA);
  assert.equal(h2oArt.electronicSummary.nBasis, 19);
  assert.equal(h2oArt.electronicSummary.nElectrons, 10);
  assert.ok(h2oArt.electronicSummary.homoLumoGapHa > 0.3);
  assert.equal(h2oArt.bondDiscoveryTrace.schema, ULG_BOND_DISCOVERY_TRACE_SCHEMA);
  assert.equal(h2oArt.bondDiscoveryTrace.bonds.length, 2, 'H2O must have 2 O-H bonds');
  for (const bond of h2oArt.bondDiscoveryTrace.bonds) {
    assert.ok(bond.mayerBondOrder > 0.7 && bond.mayerBondOrder < 1.2, `O-H Mayer bond order ${bond.mayerBondOrder}`);
  }
  assert.ok(h2oArt.bondDiscoveryTrace.mullikenCharges[0] < -0.2, 'O must carry negative Mulliken partial charge');
  assert.ok(h2oArt.grid.maxDensityPerBohr3 > 1.0);
  // Numerical integration on a coarse 18^3 grid recovers ~10 electrons (within grid quadrature error around tight 1s cusp).
  assert.ok(h2oArt.grid.voxelIntegralElectrons > 5.0 && h2oArt.grid.voxelIntegralElectrons < 15.0, `voxel integral ${h2oArt.grid.voxelIntegralElectrons}`);
  const densKey = h2oArt.grid.payloadHandles.chargeDensity.key;
  assert.equal(h2oPayloads[densKey].length, 18 * 18 * 18);
  assert.ok(h2oPayloads[h2oArt.grid.payloadHandles.homoOrbital.key].length === 18 * 18 * 18);
  assert.equal(h2oArt.validation.scientificValidation, false);
});

test('material derivation visualization bundle chains quantum->QHA->Triad A4, validates fail-closed, and dispatches via SimulationModuleRegistry', async () => {
  const { bundle, densePayloads } = buildMaterialDerivationVisualizationBundle({
    materialKey: 'h2o',
    formula: 'H2O',
    atoms: H2O_ATOMS,
    basis: 'sto-3g',
    functional: 'pbe',
    gridDim: 10,
    includeUmp2: true,
    includeQhaClosure: true,
    includeTriadA4Replay: true
  });
  assert.equal(bundle.schema, ULG_MATERIAL_DERIVATION_VISUALIZATION_BUNDLE_SCHEMA);
  assert.equal(bundle.stages.length, 4);
  assert.equal(bundle.responseFitReplay.schema, ULG_MATERIAL_RESPONSE_FIT_REPLAY_SCHEMA);
  assert.ok(bundle.responseFitReplay.functionCount >= 1);
  assert.ok(bundle.qhaBulkClosure.meltingPointK > 100);
  assert.ok(Object.keys(densePayloads).length >= 2);
  // Verify hot UI bundle contains only payload index descriptors, not inline Float32Arrays.
  assert.doesNotThrow(() => JSON.stringify(bundle));

  const valid = validateDerivationVisualizationBundle(bundle, {
    expectedGeneratorFingerprint: QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
    strict: true
  });
  assert.equal(valid.ok, true);

  // Stale generator fingerprint must fail closed with cache-stale status.
  const stale = validateDerivationVisualizationBundle(bundle, {
    expectedGeneratorFingerprint: 'stale-fingerprint-v0',
    strict: true
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, QUANTUM_DERIVATION_STATUS.cacheStale);

  // Overclaiming scientificValidation: true must fail closed in strict mode.
  const overclaim = validateDerivationVisualizationBundle({
    ...bundle,
    validation: { ...bundle.validation, scientificValidation: true }
  }, { strict: true });
  assert.equal(overclaim.ok, false);
  assert.ok(overclaim.blockers.includes('unsupported-scientific-validation-claim'));

  // Dispatch through SimulationModuleRegistry on ulg-runtime contract!
  const registry = createSimulationModuleRegistry({ createArtifact: createSimulationArtifact });
  registry.registerModule(createQuantumDerivationSimulationModule());
  const capsule = createUlgTaskCapsule({
    taskId: 'quantum-bundle-h2o',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'quantum-material-derivation', version: 1 },
    input: {
      materialKey: 'h2o',
      formula: 'H2O',
      atoms: H2O_ATOMS,
      parameters: { basis: 'sto-3g', functional: 'pbe', gridDim: 8 },
      includeUmp2: false,
      includeQhaClosure: false,
      includeTriadA4Replay: true
    }
  });
  const res = await registry.dispatchSimulationStepCapsule(capsule);
  assert.equal(res.matched, true);
  assert.equal(res.artifact.representation, 'quantum-derivation-bundle');
  assert.equal(res.artifact.validation.scientificValidation, false);
  assert.equal(res.leaseHandle.isCurrent(), true);

  // Missing material input must fail closed (no silent H2O default!)
  const missingMatCapsule = createUlgTaskCapsule({
    taskId: 'quantum-bundle-missing',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'quantum-material-derivation', version: 1 },
    input: { parameters: { gridDim: 8 } }
  });
  await assert.rejects(() => registry.dispatchSimulationStepCapsule(missingMatCapsule), RangeError);
});

test('cosmic-to-quantum scale bridge spans 38+ OOM across all 6 regimes with floating-origin stability and comoving headroom', () => {
  const registry = createSimulationModuleRegistry();
  registry.registerModule(createNBodyGravityModuleRegistration({
    initialBodies: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0.1])
  }));
  registry.registerModule(createQuantumDerivationSimulationModule());

  const bridge = createCosmicQuantumScaleBridge({ moduleRegistry: registry });
  const sum = bridge.summary();
  assert.equal(sum.schema, ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA);
  assert.equal(sum.regimeCount, COSMIC_QUANTUM_SCALE_REGIMES.length);
  assert.equal(sum.activeChartCount, 6);
  assert.ok(sum.totalSpanOrdersOfMagnitude >= 38.0, `expected >= 38 OOM, got ${sum.totalSpanOrdersOfMagnitude}`);

  // Sweep continuous zoom from 10^-11 m (Bohr) to 10^27 m (observable universe)
  const stops = [-11, -9, 0, 10, 21, 26.9];
  const expectedIds = [
    'atomic-orbital',
    'molecular-lattice',
    'continuum-sph-solids',
    'planetary-orbital',
    'galactic-nbody',
    'supergalactic-cosmic'
  ];
  for (let i = 0; i < stops.length; i += 1) {
    const cam = bridge.evaluateContinuousZoomCamera(stops[i]);
    assert.equal(cam.primaryRegime.id, expectedIds[i]);
    assert.ok(cam.floatingOriginCamera.cameraPosHi.every(Number.isFinite));
    assert.ok(cam.floatingOriginCamera.spanInChartUnits > 0 && Number.isFinite(cam.floatingOriginCamera.spanInChartUnits));
    if (expectedIds[i] === 'atomic-orbital' || expectedIds[i] === 'galactic-nbody') {
      assert.equal(cam.primaryModuleRegistered, true);
    }
    if (expectedIds[i] === 'supergalactic-cosmic') {
      assert.equal(cam.cosmologyFrame.comoving, true);
      assert.ok(cam.cosmologyFrame.hubbleParameterPerS > 2e-18 && cam.cosmologyFrame.hubbleParameterPerS < 3e-18);
    }
  }

  // Portal cross-fade triggers smoothly near regime boundaries (e.g., atomic <-> molecular at -9.5)
  const portalCam = bridge.evaluateContinuousZoomCamera(-9.4);
  assert.equal(portalCam.primaryRegime.id, 'molecular-lattice');
  assert.equal(portalCam.secondaryRegime.id, 'atomic-orbital');
  assert.ok(portalCam.portalBlendAlpha > 0 && portalCam.portalBlendAlpha < 0.5);
});
