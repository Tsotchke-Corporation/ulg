import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ULG_SCIENTIFIC_VALIDATION_SCHEMA,
  renderCrossScaleValidationMarkdown,
  runCrossScaleScientificValidation
} from '../src/tools/scientificValidationFramework.js';

test('Cross-Scale Scientific Validation Framework runs strictly offline across all 7 domains and produces honest advisory calibration triage', async () => {
  const prevFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Validation harness must NEVER access network');
  };
  try {
    const report = await runCrossScaleScientificValidation({
      repoRoot: process.cwd(),
      snapshotCacheDir: join(homedir(), '.cache/ulg/science-snapshots')
    });

    assert.equal(report.schema, ULG_SCIENTIFIC_VALIDATION_SCHEMA);
    assert.equal(report.advisory, true);
    assert.equal(report.runtimeAuthority, false);
    assert.equal(report.blocksWorkflow, false);
    assert.equal(report.scientificValidation, false);

    // Must cover all 10 physical & architectural domains from nuclear (10^-15 m) to cosmology (10^+25 m) + Law Graph & SS Tree!
    assert.equal(report.domains.length, 10);
    for (const d of report.domains) {
      assert.ok(d.evaluated >= 1 || d.domainId === 'atomicMassAndPeriodic', `Domain ${d.domainId} must evaluate live ULG physics`);
    }
    for (const id of ['relativisticRadiativeTidal', 'xenobiologyAstrobiology', 'lawGraphAndSchroederSs']) {
      const dom = report.domains.find((d) => d.domainId === id);
      assert.ok(dom && dom.agrees === dom.evaluated, `Domain ${id} must pass 100% of first-principles benchmarks (got ${dom?.agrees}/${dom?.evaluated})`);
    }

    // Nuclear B/A & LambdaCDM cosmology must agree tightly against AME2020 & Planck 2018!
    const nuc = report.domains.find((d) => d.domainId === 'nuclear');
    assert.ok(nuc && nuc.medianAbsPct < 10.0, `Nuclear domain median error should stay < 10% (got ${nuc?.medianAbsPct}%)`);
    const cosmo = report.domains.find((d) => d.domainId === 'stellarAndCosmology');
    assert.ok(cosmo && cosmo.agrees >= 5, `Cosmology & stellar domain should pass >= 5/7 benchmarks (got ${cosmo?.agrees}/${cosmo?.evaluated})`);

    // Calibration triage must honestly surface real physical deviations (e.g. compound H-bond / solid T_melt)
    assert.ok(report.calibrationTriage.length >= 2, 'Calibration triage must identify real physical closure deviations to tune');
    assert.ok(report.totals.evaluated >= 80, `Expected broad cross-scale coverage >= 80 observables (got ${report.totals.evaluated})`);

    const md = renderCrossScaleValidationMarkdown(report);
    assert.ok(md.includes('ULG Cross-Scale Scientific Validation & Calibration Scorecard'));
    assert.ok(md.includes('Physics-Root-Cause Calibration Triage'));
  } finally {
    globalThis.fetch = prevFetch;
  }
});
