import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSpinLatticeParams,
  registerSpinLatticeClosureArtifact,
  registerSpinLatticeSimulationModule
} from '../src/runtime/material/spinLatticeMagnetismWebGpu.js';
import {
  buildElectronTransportParams,
  registerElectronTransportClosureArtifact,
  registerElectronTransportSimulationModule
} from '../src/runtime/material/electronTransportWebGpu.js';
import {
  MD_EXPERIMENT_MODES,
  buildCrystalMdState,
  computePhononVdosFromVacf,
  registerMdSimulationModules
} from '../src/runtime/gpuMath/molecularDynamicsWebGpu.js';
import {
  bohrWheelerFissionCurve,
  registerNuclearFissionSimulationModule
} from '../src/runtime/nuclear/nuclearStructureGpu.js';
import { computeStarkPolarizationState } from '../src/runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';

test('Sim 1 (Spin-Lattice LLG): exchange sign and parameters emerge from magnetic phase (zero element hacks)', () => {
  const ferro = buildSpinLatticeParams({ magneticPhase: 'ferromagnetic', curieOrNeelTempK: 1043, magneticMomentMuB: 2.2 });
  const afm = buildSpinLatticeParams({ magneticPhase: 'antiferromagnetic', curieOrNeelTempK: 311, magneticMomentMuB: 1.0 });
  const dia = buildSpinLatticeParams({ magneticPhase: 'diamagnetic', magneticSusceptibilitySi: -1e-5 });
  assert.ok(ferro.exchangeJEv > 0 && ferro.anisotropyEv > 0 && ferro.diamagneticSign === 1);
  assert.ok(afm.exchangeJEv < 0 && afm.anisotropyEv > 0);
  assert.equal(dia.exchangeJEv, 0);
  assert.equal(dia.diamagneticSign, -1);
});

test('Sim 2 (Electron-Phonon & BCS Transport): resistivity rises with T in metals, activates in semiconductors, vanishes below T_c', () => {
  const metalCold = buildElectronTransportParams({ isMetal: true, plasmaEnergyEv: 10, dosAtFermiStatesPerEvAtom: 0.4, superconductingTcK: 0 }, { debyeTemperatureK: 340 }, { temperatureK: 80 });
  const metalHot = buildElectronTransportParams({ isMetal: true, plasmaEnergyEv: 10, dosAtFermiStatesPerEvAtom: 0.4, superconductingTcK: 0 }, { debyeTemperatureK: 340 }, { temperatureK: 600 });
  assert.ok(metalHot.scatterProbStep > metalCold.scatterProbStep * 2, 'higher T must increase phonon scattering');
  assert.ok(metalHot.analyticResistivityOhmM > metalCold.analyticResistivityOhmM);

  const scBelow = buildElectronTransportParams({ isMetal: true, plasmaEnergyEv: 13, superconductingTcK: 7.2 }, { debyeTemperatureK: 105 }, { temperatureK: 2.0 });
  const scAbove = buildElectronTransportParams({ isMetal: true, plasmaEnergyEv: 13, superconductingTcK: 7.2 }, { debyeTemperatureK: 105 }, { temperatureK: 20.0 });
  assert.equal(scBelow.isSuperconducting, true);
  assert.equal(scBelow.scatterProbStep, 0);
  assert.ok(scBelow.cooperFraction > 0.9);
  assert.equal(scAbove.isSuperconducting, false);

  const semiCold = buildElectronTransportParams({ isMetal: false, bandGapEv: 1.12 }, { debyeTemperatureK: 640 }, { temperatureK: 100 });
  const semiHot = buildElectronTransportParams({ isMetal: false, bandGapEv: 1.12 }, { debyeTemperatureK: 640 }, { temperatureK: 900 });
  assert.ok(semiHot.activeCarrierFraction > semiCold.activeCarrierFraction * 5, 'heating semiconductor must activate carriers across E_g');
});

test('Sim 3 & 4 (MD Mechanical, NEMD & Phonon VDOS): elongated acoustic cells, vacuum slabs & VACF phonon peak', () => {
  const bar = buildCrystalMdState({ crystalStructure: 'fcc', cellsVec: [5, 2, 2], latticeConstantA: 4.0, massU: 63.5, temperatureK: 300 });
  assert.equal(bar.atomCount, 4 * 5 * 2 * 2);
  assert.ok(bar.boxLengthsA[0] > bar.boxLengthsA[1] * 2);

  const slab = buildCrystalMdState({ crystalStructure: 'fcc', cellsPerSide: 2, vacuumZFactor: 2.5, latticeConstantA: 4.0, massU: 27, temperatureK: 300 });
  assert.ok(slab.boxLengthsA[2] > slab.boxLengthsA[0] * 2.4);

  // Synthetic 5 THz damped harmonic VACF -> VDOS peak must recover ~5 THz!
  const dtFs = 10;
  const fTargetThz = 5.0;
  const vacf = Array.from({ length: 64 }, (_, n) => Math.exp(-n * 0.03) * Math.cos(2 * Math.PI * fTargetThz * 1e-3 * n * dtFs));
  const spec = computePhononVdosFromVacf(vacf, dtFs, 48);
  assert.ok(Math.abs(spec.peakThz - fTargetThz) < 1.0, `VDOS peak=${spec.peakThz} THz expected ~${fTargetThz} THz`);
  assert.equal(MD_EXPERIMENT_MODES.SURFACE_SLAB, 5);
});

test('Sim 5 (Atomic Stark Polarization & Nuclear Bohr-Wheeler Fission): linear p = alpha_0 E & fissility barrier scaling', () => {
  const atomMock = {
    electronCount: 79,
    orbitals: [{ n: 6, l: 0, occupancy: 1, energyHa: -0.34 }],
    radialGrid: {
      dx: 0.1,
      r: Float32Array.from({ length: 80 }, (_, i) => (i + 1) * 0.1),
      rho: Float32Array.from({ length: 80 }, (_, i) => {
        const rv = (i + 1) * 0.1;
        return 79 / (8 * Math.PI * 1.4 ** 3) * Math.exp(-rv / 1.4);
      })
    }
  };
  const s1 = computeStarkPolarizationState({ atomResult: atomMock, eFieldVPerA: 1.0 });
  const s2 = computeStarkPolarizationState({ atomResult: atomMock, eFieldVPerA: 2.0 });
  assert.ok(s1.alpha0Bohr3 > 5 && s1.alpha0Angstrom3 > 0.5);
  assert.ok(Math.abs(s2.inducedDipoleDebye / s1.inducedDipoleDebye - 2.0) < 1e-6, 'Stark induced dipole must be linear in E');
  assert.ok(Math.abs(s2.starkShiftEv / s1.starkShiftEv - 4.0) < 1e-6, 'Second-order Stark shift must be quadratic in E');

  const feCurve = bohrWheelerFissionCurve(26, 56);
  const uCurve = bohrWheelerFissionCurve(92, 235);
  const ogCurve = bohrWheelerFissionCurve(118, 294);
  assert.ok(uCurve.fissility > feCurve.fissility && ogCurve.fissility > uCurve.fissility);
  assert.ok(uCurve.barrierMeV < feCurve.barrierMeV, 'Heavy actinides must have lower fission barrier than Fe-56');
  assert.ok(uCurve.deltaEMeV[uCurve.deltaEMeV.length - 1] < 0, 'Post-scission Coulomb repulsion must release fission energy');
});

test('Canonical ULG SimulationModuleRegistry & ClosureRegistry registration for all 5 new simulations', async () => {
  const reg = createSimulationModuleRegistry();
  registerSpinLatticeSimulationModule(reg);
  registerElectronTransportSimulationModule(reg);
  registerMdSimulationModules(reg);
  registerNuclearFissionSimulationModule(reg);
  const keys = reg.listModules().map((m) => m.methodKey);
  for (const k of ['spin-lattice-llg@1', 'electron-transport-gpu@1', 'md-mechanical-probe@1', 'md-nemd-transport@1', 'nuclear-fission-ldm@1']) {
    assert.ok(keys.includes(k), `missing canonical module ${k}`);
  }

  const store = new Map();
  const creg = new ClosureRegistry({
    artifactCache: {
      async put(a) { const uri = `mem://${a.closureId}`; store.set(uri, a); return { uri, hash: a.inputHash }; },
      async get(r) { return store.get(r.uri) || null; }
    }
  });
  const sArt = await registerSpinLatticeClosureArtifact({ closureRegistry: creg, materialKey: 'Fe', electromagnetic: { magneticPhase: 'ferromagnetic', curieOrNeelTempK: 1043 } });
  const tArt = await registerElectronTransportClosureArtifact({ closureRegistry: creg, materialKey: 'Cu', electromagnetic: { isMetal: true, plasmaEnergyEv: 10.8 } });
  assert.ok(sArt.ref?.uri && tArt.ref?.uri);
});
