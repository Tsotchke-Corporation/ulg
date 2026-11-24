import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import viteConfig from '../vite.config.mjs';
import {
  PEERCOMPUTE_CORE_ENTRYPOINT_SCHEMA,
  NodeKernel,
  ComputeManager,
  StateManager,
  ReservationLedger,
  SpatialTileLeaseBroker
} from '../src/runtime/peercomputeCore.js';
import {
  ULG_ACCURACY_TIERS,
  ULG_MATERIAL_PROPERTY_BUNDLE_SCHEMA,
  ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
  createMaterialPropertyBundle,
  validateMaterialPropertyBundle,
  packPolytopeAtlasForGpu
} from '../ulg-gpu-abi/src/index.js';
import {
  buildConvexPolytope,
  bisectConvexPolytope,
  evaluatePolytopeMembership,
  createMaterialPolytopeRegistry
} from '../src/runtime/material/materialPolytopeRegistry.js';
import { buildFccCrystalMdState, evalChebyshev2d } from '../src/runtime/gpuMath/index.js';

test('Gate 0A: peercomputeCore exposes pure scheduling/state/reservation primitives cleanly', () => {
  assert.equal(PEERCOMPUTE_CORE_ENTRYPOINT_SCHEMA, 'peercompute.ulg.peercompute-core.v1');
  assert.equal(typeof NodeKernel, 'function');
  assert.equal(typeof ComputeManager, 'function');
  assert.equal(typeof StateManager, 'function');
  assert.equal(typeof ReservationLedger, 'function');
  assert.equal(typeof SpatialTileLeaseBroker, 'function');

  // Verify Vite dev server fs.allow covers the restructured PeerCompute workspace
  // root so hoisted workspace node_modules/ (e.g. yjs, libp2p) never 403.
  const siblingPeercomputeWorkspace = fileURLToPath(new URL('../../peercompute', import.meta.url));
  if (existsSync(siblingPeercomputeWorkspace)) {
    const allowed = (viteConfig?.server?.fs?.allow || []).map((p) => (existsSync(p) ? realpathSync(p) : p));
    assert.ok(
      allowed.includes(realpathSync(siblingPeercomputeWorkspace)),
      `vite.config.mjs server.fs.allow must include PeerCompute workspace root ${siblingPeercomputeWorkspace}`
    );
  }
});

test('Gate 0C: ulg.material-property-bundle.v1 validates 5 domains, accuracy tiers, and fail-closed policy', () => {
  const bundle = createMaterialPropertyBundle({
    materialKey: 'Fe',
    symbol: 'Fe',
    atomicNumber: 26,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
    nuclear: { Z: 26, A: 56, bindingEnergyMeV: 492.26, chargeRadiusFm: 3.74 },
    atomic: { totalEnergyHa: -1262.4, valenceMomentMuB: 4 },
    electromagnetic: { magneticPhase: 'ferromagnetic', conductivitySPerM: 1e7 },
    mechanical: { crystalStructure: 'bcc', densityKgPerM3: 7874, bulkModulusPa: 170e9 },
    thermodynamic: { meltingPointK: 1811, boilingPointK: 3134 }
  });
  assert.equal(bundle.schema, ULG_MATERIAL_PROPERTY_BUNDLE_SCHEMA);
  const check = validateMaterialPropertyBundle(bundle);
  assert.equal(check.ok, true);
  assert.equal(bundle.provenance.extrapolationPolicy, 'fail-closed');
  assert.equal(bundle.provenance.scientificValidation, false);

  assert.throws(() => createMaterialPropertyBundle({
    materialKey: 'Bad',
    accuracyTier: 'bogus-tier',
    nuclear: {}, atomic: {}, electromagnetic: {}, mechanical: {}, thermodynamic: {}
  }), RangeError);
  assert.throws(() => createMaterialPropertyBundle({
    materialKey: 'Incomplete',
    nuclear: {}, atomic: {}
  }), TypeError);
});

test('Gate 0C: Convex Polytope Registry supports slanted Clausius-Clapeyron facets, bisection, fail-closed membership, and GPU packing', () => {
  const reg = createMaterialPolytopeRegistry();
  const polys = reg.discoverMaterialPolytopes({
    materialKey: 'Fe',
    meltingPointK: 1811,
    boilingPointK: 3134,
    ionizationTempK: 9000,
    meltingSlopeKPerLogP: 40,
    boilingSlopeKPerLogP: 350,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash: 'fe-v1'
  });
  assert.equal(polys.length, 4); // solid, liquid, gas, plasma
  // At 101325 Pa (logP ~ 5.0057): 1800 K is solid, 2200 K is liquid, 4000 K is gas, 12000 K is plasma
  assert.equal(reg.resolveState('Fe', { temperatureK: 1000, pressurePa: 101325 }).polytope.phase, 'solid');
  assert.equal(reg.resolveState('Fe', { temperatureK: 2200, pressurePa: 101325 }).polytope.phase, 'liquid');
  assert.equal(reg.resolveState('Fe', { temperatureK: 4500, pressurePa: 101325 }).polytope.phase, 'gas');
  assert.equal(reg.resolveState('Fe', { temperatureK: 12000, pressurePa: 101325 }).polytope.phase, 'plasma');

  // Slanted boiling facet check: at high P = 1e8 Pa (+3 decades -> T_b rises by ~1050 K to ~4184 K!),
  // T = 3600 K must resolve to LIQUID instead of gas!
  assert.equal(reg.resolveState('Fe', { temperatureK: 3600, pressurePa: 1e8 }).polytope.phase, 'liquid');
  // At low P = 100 Pa (-3 decades -> T_b drops by ~1050 K to ~2084 K!), T = 2600 K is GAS!
  assert.equal(reg.resolveState('Fe', { temperatureK: 2600, pressurePa: 100 }).polytope.phase, 'gas');

  // Strict fail-closed outside domain
  const miss = reg.resolveState('Fe', { temperatureK: 1000, pressurePa: 1e14 });
  assert.equal(miss.found, false);
  assert.equal(miss.status, 'outside-domain');

  // Bisection preserves slanted half-space inequalities
  const solid = polys[0];
  const [left, right] = bisectConvexPolytope(solid, 0);
  assert.equal(left.inequalities.length, solid.inequalities.length);
  assert.equal(right.inequalities.length, solid.inequalities.length);
  assert.equal(evaluatePolytopeMembership(left, { temperatureK: 500, pressurePa: 101325 }).inside, true);
  assert.equal(evaluatePolytopeMembership(right, { temperatureK: 500, pressurePa: 101325 }).inside, false);

  // GPU atlas packing
  const packed = reg.packMaterialAtlasGpu('Fe', { materialIndex: 26 });
  assert.equal(packed.schema, ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA);
  assert.equal(packed.polytopeCount, 4);
  assert.ok(packed.totalFacets >= 19);
  assert.equal(packed.data[0], 4);
});

test('Gate 0B: FCC MD initializer produces exact zero net momentum and target temperature; Chebyshev 2D eval matches exact polynomial', () => {
  const md = buildFccCrystalMdState({ cellsPerSide: 3, latticeConstantA: 4.05, massU: 26.982, temperatureK: 300 });
  assert.equal(md.atomCount, 108);
  let px = 0; let py = 0; let pz = 0; let ke = 0;
  for (let i = 0; i < md.atomCount; i += 1) {
    const vx = md.velocities[i * 4];
    const vy = md.velocities[i * 4 + 1];
    const vz = md.velocities[i * 4 + 2];
    const m = md.velocities[i * 4 + 3];
    px += m * vx; py += m * vy; pz += m * vz;
    ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
  }
  assert.ok(Math.hypot(px, py, pz) < 1e-4, 'Zero initial COM momentum');
  const tempK = (2 * ke) / ((3 * md.atomCount - 3) * 8.617333262e-5);
  assert.ok(Math.abs(tempK - 300) < 1e-2, `Expected 300 K, got ${tempK}`);

  // f(u0, u1) = 3 + 2*T_1(u0) + 5*T_1(u1) = 3 + 2*u0 + 5*u1
  const coeffs = Float32Array.from([3, 5, 2, 0]);
  const val = evalChebyshev2d(coeffs, 1, 1, [[0, 10], [0, 10]], 7.5, 2.5);
  // u0 = 0.5, u1 = -0.5 -> 3 + 1 - 2.5 = 1.5
  assert.ok(Math.abs(val - 1.5) < 1e-6);
});
