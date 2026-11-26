import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AMPHIPHILE_MEMBRANE_LAW_ADAPTER } from '../src/runtime/biology/amphiphileMembraneGpu.js';
import {
  BIOPOLYMER_FOLDING_LAW_ADAPTER,
  POLYMER_SEQUENCE_TEMPLATES
} from '../src/runtime/biology/biopolymerFoldingGpu.js';
import {
  TEMPLATE_REPLICATION_LAW_ADAPTER,
  evaluateDuplexMeltingCurve
} from '../src/runtime/biology/templateReplicationGpu.js';
import {
  MEMBRANE_BIOENERGETICS_LAW_ADAPTER,
  evaluateChemiosmoticBioenergetics
} from '../src/runtime/biology/membraneBioenergeticsGpu.js';
import {
  MORPHOGENESIS_ACTIVE_LAW_ADAPTER,
  TURING_MORPHOGEN_REGIMES
} from '../src/runtime/biology/morphogenesisActiveMatterGpu.js';
import {
  FUNDAMENTAL_LAW_FAMILIES,
  UNIVERSAL_LAW_GRAPH_NODES,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Emergent Biology Law Nodes #20-24 validate cleanly against Law Adapter Contract with 0 debt and 0 @workgroup_size(1)', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Contract errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(check.debt.length, 0);
  assert.equal(UNIVERSAL_LAW_GRAPH_NODES.length, 32);
  assert.equal(FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS, 'soft-matter-biophysics');
  assert.equal(FUNDAMENTAL_LAW_FAMILIES.REACTION_DIFFUSION_ACTIVE, 'reaction-diffusion-active');

  assert.equal(AMPHIPHILE_MEMBRANE_LAW_ADAPTER.id, 'amphiphile-membrane-self-assembly');
  assert.equal(BIOPOLYMER_FOLDING_LAW_ADAPTER.id, 'biopolymer-folding-catalysis');
  assert.equal(TEMPLATE_REPLICATION_LAW_ADAPTER.id, 'template-replication-evolution');
  assert.equal(MEMBRANE_BIOENERGETICS_LAW_ADAPTER.id, 'chemiosmotic-bioenergetics-electrophysiology');
  assert.equal(MORPHOGENESIS_ACTIVE_LAW_ADAPTER.id, 'reaction-diffusion-active-matter');

  for (const rel of [
    'src/runtime/biology/amphiphileMembraneGpu.js',
    'src/runtime/biology/biopolymerFoldingGpu.js',
    'src/runtime/biology/templateReplicationGpu.js',
    'src/runtime/biology/membraneBioenergeticsGpu.js',
    'src/runtime/biology/morphogenesisActiveMatterGpu.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must not contain @workgroup_size(1)`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain phase_mode hacks`);
  }
});

test('Complementary H-Bond Duplex Melting T_m increases with 3-H-bond strong-pair fraction & Eigen error threshold scales as 1/L', () => {
  const weak = evaluateDuplexMeltingCurve({ lengthL: 16, strongPairFraction: 0.1 });
  const mid = evaluateDuplexMeltingCurve({ lengthL: 16, strongPairFraction: 0.5 });
  const strong = evaluateDuplexMeltingCurve({ lengthL: 16, strongPairFraction: 0.9 });
  const longSeq = evaluateDuplexMeltingCurve({ lengthL: 32, strongPairFraction: 0.5 });

  assert.ok(strong.meltingTempK > mid.meltingTempK, 'Higher 3-H-bond fraction must raise T_m');
  assert.ok(mid.meltingTempK > weak.meltingTempK, 'T_m must rise monotonically with strong-pair fraction');
  assert.ok(strong.meltingTempK - weak.meltingTempK > 20.0, `Expected >20 K Tm shift (got ${strong.meltingTempK - weak.meltingTempK} K)`);

  // Melting curve must transition cleanly from duplex (~1) below Tm to melted (~0) above Tm
  assert.ok(mid.curve[0].duplexFraction > 0.85, 'Cold duplex must stay hybridized');
  assert.ok(mid.curve[mid.curve.length - 1].duplexFraction < 0.15, 'Hot duplex must melt');

  // Eigen error threshold mu_crit = ln(sigma)/L halves when genome length doubles!
  assert.ok(Math.abs(longSeq.eigenErrorThresholdMu - mid.eigenErrorThresholdMu * 0.5) < 1e-6);
});

test('Mitchell Chemiosmosis: exact 0 ATP flux at Delta_p = 0 or protonophore uncoupler=1, positive flux under physiological gradient', () => {
  // Physiological mitochondrial/bacterial gradient: DeltaPsi = 150 mV, Delta pH = 1.0 -> Delta_p ≈ 211.5 mV
  const phys = evaluateChemiosmoticBioenergetics({ deltaPsiMv: 150, deltaPh: 1.0, uncouplerLeak: 0.0 });
  assert.ok(phys.protonMotiveForceMv > 200 && phys.protonMotiveForceMv < 225, `Expected ~211.5 mV PMF (got ${phys.protonMotiveForceMv})`);
  assert.equal(phys.thermodynamicallyFeasible, true);
  assert.ok(phys.atpSynthesisFlux > 15.0, `Expected strong ATP flux (got ${phys.atpSynthesisFlux})`);

  // Falsifiable Null Limit 1: Zero electrochemical gradient -> EXACT 0 PMF & EXACT 0 ATP synthesis!
  const zeroGrad = evaluateChemiosmoticBioenergetics({ deltaPsiMv: 0, deltaPh: 0, uncouplerLeak: 0.0 });
  assert.equal(zeroGrad.protonMotiveForceMv, 0);
  assert.equal(zeroGrad.atpSynthesisFlux, 0);
  assert.equal(zeroGrad.thermodynamicallyFeasible, false);

  // Falsifiable Null Limit 2: Complete DNP-like protonophore uncoupler (leak=1) collapses PMF to 0 and dissipates heat!
  const uncoupled = evaluateChemiosmoticBioenergetics({ deltaPsiMv: 150, deltaPh: 1.0, uncouplerLeak: 1.0 });
  assert.equal(uncoupled.protonMotiveForceMv, 0);
  assert.equal(uncoupled.atpSynthesisFlux, 0);
  assert.ok(uncoupled.dissipationHeatWProxy > 0, 'Protonophore short-circuit must dissipate gradient energy as heat');
});

test('Biopolymer sequence templates, Turing regimes, and dynamic Law Graph activation stay strictly state-driven', () => {
  assert.ok(Object.keys(POLYMER_SEQUENCE_TEMPLATES).length >= 3);
  assert.ok(Object.keys(TURING_MORPHOGEN_REGIMES).length >= 3);

  const empty = resolveActiveUniversalLaws({});
  assert.equal(empty.active.some((l) => l.id === 'amphiphile-membrane-self-assembly'), false);
  assert.equal(empty.active.some((l) => l.id === 'biopolymer-folding-catalysis'), false);
  assert.equal(empty.active.some((l) => l.id === 'template-replication-evolution'), false);
  assert.equal(empty.active.some((l) => l.id === 'chemiosmotic-bioenergetics-electrophysiology'), false);
  assert.equal(empty.active.some((l) => l.id === 'reaction-diffusion-active-matter'), false);

  const bio = resolveActiveUniversalLaws({
    amphiphileCount: 256,
    polymerResidueCount: 36,
    replicatorCount: 512,
    deltaPh: 1.0,
    activeAgentCount: 1024
  });
  assert.equal(bio.active.some((l) => l.id === 'amphiphile-membrane-self-assembly'), true);
  assert.equal(bio.active.some((l) => l.id === 'biopolymer-folding-catalysis'), true);
  assert.equal(bio.active.some((l) => l.id === 'template-replication-evolution'), true);
  assert.equal(bio.active.some((l) => l.id === 'chemiosmotic-bioenergetics-electrophysiology'), true);
  assert.equal(bio.active.some((l) => l.id === 'reaction-diffusion-active-matter'), true);
  assert.equal(bio.activeFamilies.includes(FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS), true);
  assert.equal(bio.activeFamilies.includes(FUNDAMENTAL_LAW_FAMILIES.REACTION_DIFFUSION_ACTIVE), true);
});
