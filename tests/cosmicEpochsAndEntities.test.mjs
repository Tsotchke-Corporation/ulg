import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  COSMIC_EPOCH_PRESETS,
  computeCosmicAgeGyr,
  evaluateCosmicEpochState,
  evaluateCosmicIonizationFraction,
  evaluateEisensteinHuBaoTransfer,
  evaluateStellarEvolutionaryState
} from '../src/runtime/astrophysics/cosmicEpochState.js';
import { evaluateKerrSpacetimeMetrics } from '../src/runtime/astrophysics/relativisticCompactObjectGpu.js';
import { evaluateCompactMagnetospherePhysics } from '../src/runtime/astrophysics/compactMagnetosphereGpu.js';
import { eggletonRocheLobeRatio } from '../src/runtime/astrophysics/relativisticBinaryMergerGpu.js';
import { evaluateOutgassingAndPhotoevaporation } from '../src/runtime/astrophysics/radiativePhotoionizationWindGpu.js';
import { evaluateRocheAndTidalHeating } from '../src/runtime/astrophysics/tidalRocheDisruptionGpu.js';
import {
  UNIVERSAL_LAW_GRAPH_NODES,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('All 24 Universal Law Graph nodes validate cleanly with 0 errors, 0 private-grid debt, and 0 new @workgroup_size(1)', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(check.debt.length, 0);
  assert.equal(check.nodeCount, 32);
  assert.equal(UNIVERSAL_LAW_GRAPH_NODES.length, 32);

  for (const rel of [
    'src/runtime/astrophysics/cosmicEpochState.js',
    'src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js',
    'src/runtime/astrophysics/relativisticCompactObjectGpu.js',
    'src/runtime/astrophysics/compactMagnetosphereGpu.js',
    'src/runtime/astrophysics/relativisticBinaryMergerGpu.js',
    'src/runtime/astrophysics/radiativePhotoionizationWindGpu.js',
    'src/runtime/astrophysics/tidalRocheDisruptionGpu.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must add 0 @workgroup_size(1) kernels`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain discrete phase_mode hacks`);
  }
});

test('Cosmic Epoch Spine accurately spans Recombination (z=1100) -> Cosmic Dawn -> Quasar Peak -> Present (13.8 Gyr) -> Far-Future (+5 Gyr)', () => {
  assert.equal(COSMIC_EPOCH_PRESETS.length, 5);
  const ageToday = computeCosmicAgeGyr(1.0);
  assert.ok(ageToday > 13.5 && ageToday < 14.1, `Present ΛCDM age must be ~13.8 Gyr (got ${ageToday})`);

  const rec = evaluateCosmicEpochState({ redshiftZ: 1100 });
  const dawn = evaluateCosmicEpochState({ redshiftZ: 10 });
  const qso = evaluateCosmicEpochState({ redshiftZ: 2.8 });
  const now = evaluateCosmicEpochState({ redshiftZ: 0, localSystemAgeGyr: 4.57 });
  const fut = evaluateCosmicEpochState({ redshiftZ: -0.28, localSystemAgeGyr: 10.85 });

  assert.ok(rec.cmbTempK > 2900 && rec.cmbTempK < 3100, `T_CMB(z=1100) must be ~3000 K (got ${rec.cmbTempK})`);
  assert.ok(dawn.meanMetallicitySolar < 0.01 && dawn.galaxyGasFraction > now.galaxyGasFraction);
  assert.ok(qso.quasarActivityFactor > now.quasarActivityFactor * 2.5, 'Quasar activity must peak near z~2-3');
  assert.ok(fut.cosmicAgeGyr > 17.0 && fut.stellarState.radiusSolar > 20.0, 'At t_sys=10.85 Gyr, 1 M☉ star must inflate into Red Giant');

  // Eisenstein-Hu BAO sound horizon r_s ≈ 147 Mpc and Silk damping
  const ehLow = evaluateEisensteinHuBaoTransfer(0.01);
  const ehHigh = evaluateEisensteinHuBaoTransfer(0.5);
  assert.ok(ehLow.soundHorizonMpc > 135 && ehLow.soundHorizonMpc < 160, `BAO sound horizon must be ~147 Mpc (got ${ehLow.soundHorizonMpc})`);
  assert.ok(ehLow.transfer > ehHigh.transfer * 5);

  // Peebles recombination + Cosmic Reionization ionization fraction
  assert.ok(evaluateCosmicIonizationFraction(1400) > 0.9);
  assert.ok(evaluateCosmicIonizationFraction(30) < 0.01);
  assert.ok(evaluateCosmicIonizationFraction(0) > 0.99);

  // Continuous stellar evolution from Brown Dwarf -> MS -> RGB -> WD / NS / BH
  assert.equal(evaluateStellarEvolutionaryState({ massSolar: 0.05, ageGyr: 1.0 }).stage, 'brown-dwarf');
  assert.equal(evaluateStellarEvolutionaryState({ massSolar: 1.0, ageGyr: 4.57 }).stage, 'main-sequence');
  assert.equal(evaluateStellarEvolutionaryState({ massSolar: 1.0, ageGyr: 12.5 }).remnantClass, 'white-dwarf');
  assert.equal(evaluateStellarEvolutionaryState({ massSolar: 14.0, ageGyr: 0.05 }).remnantClass, 'neutron-star');
  assert.equal(evaluateStellarEvolutionaryState({ massSolar: 35.0, ageGyr: 0.02 }).remnantClass, 'black-hole');
});

test('First-principles analytic physics closures satisfy exact limits and dynamic Law Graph activation', () => {
  // 1. Kerr spacetime & Blandford-Znajek jet power (spin=0 or B=0 -> exact 0 BZ power!)
  const schw = evaluateKerrSpacetimeMetrics({ massSolar: 1e8, spinA: 0.0, accretionRateEddington: 0.4, magneticFluxNorm: 1.0 });
  const kerr = evaluateKerrSpacetimeMetrics({ massSolar: 1e8, spinA: 0.95, accretionRateEddington: 0.4, magneticFluxNorm: 1.0 });
  const kerrNoB = evaluateKerrSpacetimeMetrics({ massSolar: 1e8, spinA: 0.95, accretionRateEddington: 0.4, magneticFluxNorm: 0.0 });
  assert.ok(Math.abs(schw.rIscoRg - 6.0) < 1e-4, 'Schwarzschild r_ISCO must equal 6 r_g');
  assert.ok(kerr.rIscoRg < 2.2, `High-spin Kerr prograde r_ISCO must shrink < 2.2 r_g (got ${kerr.rIscoRg})`);
  assert.equal(schw.jetPowerW, 0);
  assert.equal(kerrNoB.jetPowerW, 0);
  assert.ok(kerr.jetPowerW > 1e37 && kerr.lorentzGamma > 2.0);

  // 2. Pulsar vs Magnetar vs non-magnetic NS (B=0 -> 0 spin-down!)
  const deadNs = evaluateCompactMagnetospherePhysics({ surfaceBFieldTesla: 0 });
  const pulsar = evaluateCompactMagnetospherePhysics({ surfaceBFieldTesla: 4e8, spinPeriodS: 0.033 });
  const magnetar = evaluateCompactMagnetospherePhysics({ surfaceBFieldTesla: 1.2e11, spinPeriodS: 2.0 });
  assert.equal(deadNs.spinDownLumW, 0);
  assert.equal(pulsar.magnetarRegime, false);
  assert.ok(pulsar.spinDownLumW > 1e30);
  assert.equal(magnetar.magnetarRegime, true);
  assert.ok(magnetar.crustYieldRatio > 1.0);

  // 3. Eggleton Roche lobe, comet sublimation, Hot-Jupiter XUV, and Roche tidal heating
  assert.ok(Math.abs(eggletonRocheLobeRatio(1.0) - 0.3789) < 0.01);
  const coldComet = evaluateOutgassingAndPhotoevaporation({ surfaceTempK: 50, sublimationTempK: 170 });
  const warmComet = evaluateOutgassingAndPhotoevaporation({ surfaceTempK: 245, sublimationTempK: 170 });
  assert.equal(coldComet.cometMassLossKgS, 0);
  assert.ok(warmComet.cometMassLossKgS > 1.0);

  const enceladus0 = evaluateRocheAndTidalHeating({ eccentricity: 0 });
  const enceladusE = evaluateRocheAndTidalHeating({ eccentricity: 0.0047 });
  assert.equal(enceladus0.tidalHeatingW, 0);
  assert.ok(enceladusE.tidalHeatingW > 1e8);

  // 4. Dynamic Universal Law Graph activates ONLY laws whose physical state is present
  const magnetarState = resolveActiveUniversalLaws({
    compactnessGMOverRc2: 0.18,
    surfaceBFieldTesla: 1e11,
    compactRadiusM: 12000,
    spinOmegaRadS: 3.14
  });
  assert.equal(magnetarState.active.some((l) => l.id === 'compact-magnetosphere-spindown'), true);
  assert.equal(magnetarState.active.some((l) => l.id === 'relativistic-compact-kerr-jet'), true);
  assert.equal(magnetarState.active.some((l) => l.id === 'cosmological-baryon-radiation'), false);
  assert.equal(magnetarState.active.some((l) => l.id === 'planetary-atmosphere-em'), false);
});
