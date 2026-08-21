import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  STANDARD_SCENARIOS,
  checkpointMassWeightedMeanTemperature,
  durableVisualMatrixReleasePublicationEnabled,
  deterministicRandomPairScenarios,
  evaluateAuthoritativeTwoLevelMechanicsEvidence,
  evaluateSurfaceStressExecutionEvidence,
  persistVisualMatrixArtifact,
  resolveVisualMatrixScenarioTimeoutMs,
  scenarioEnv,
  scaleStandardPhaseAcceptance,
  SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV,
  standardScenarioPhysicalLengthScale,
  synthesizeStandardScenarioIssues
} from '../scripts/sph-visual-sanity-matrix.mjs';
import {
  probeStdoutPayload
} from '../scripts/sph-long-horizon-probe.mjs';
import {
  parseSphInitialBodies
} from '../src/runtime/sphInitialBodies.js';
import {
  buildSphPhaseDemoState
} from '../src/runtime/sphPhaseDemo.js';
import {
  createSphPhaseScenario
} from '../src/runtime/thermoPreflight.js';
import {
  estimateSchroederLevelFromSupportRadius
} from '../src/runtime/sph/schroederHierarchyGpu.js';

test('an explicit matrix timeout overrides a scenario timeout', () => {
  assert.equal(resolveVisualMatrixScenarioTimeoutMs({
    scenarioTimeoutMs: 360_000,
    matrixTimeoutMs: 900_000,
    matrixTimeoutExplicit: true
  }), 900_000);
  assert.equal(resolveVisualMatrixScenarioTimeoutMs({
    scenarioTimeoutMs: 360_000,
    matrixTimeoutMs: 180_000,
    matrixTimeoutExplicit: false
  }), 360_000);
});

test('standard scenario issue synthesis is ordered and deduplicated', () => {
  const scenario = {
    expectedMechanics: 'mlsmpm',
    visualRendererMode: 'native-webgpu'
  };
  const probe = {
    issues: ['probe-top-level', 'shared'],
    analysis: {
      issues: ['shared', 'probe-analysis']
    }
  };
  assert.deepEqual(
    synthesizeStandardScenarioIssues(scenario, probe, {
      mechanicsIntegrator: 'sph',
      rendererModes: ['webgl'],
      expectedBehavior: {
        status: 'fail',
        checks: [
          { id: 'steam-forms', status: 'fail' },
          { id: 'steam-rises', status: 'inconclusive' },
          { id: 'iron-cools', status: 'pass' },
          { id: 'steam-forms', status: 'fail' }
        ]
      }
    }),
    [
      'probe-top-level',
      'shared',
      'probe-analysis',
      'mechanics-integrator-mismatch',
      'visual-renderer-mode-mismatch',
      'expected-behavior:steam-forms',
      'expected-behavior:steam-rises'
    ]
  );
});

test('visual matrix keeps authoritative probe JSON off the child stdout pipe', () => {
  const outputPath = '/tmp/ulg-probe-output.json';
  const env = scenarioEnv({
    scenario: { url: '/?preset=iron-ice-quench' },
    outputPath,
    frameDir: '/tmp/ulg-probe-frames',
    port: 5310,
    batches: 16,
    batchSteps: 512,
    timeoutMs: 900_000
  });
  assert.equal(env.ULG_PROBE_OUTPUT, outputPath);
  assert.equal(env.ULG_PROBE_STDOUT_MODE, 'none');
  assert.equal(env.ULG_PROBE_ARTIFACT_DETAIL_MODE, 'visual-compact');
  assert.equal(env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, undefined);
  const inheritedDurableFlag = process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION;
  try {
    process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION = '1';
    const inheritedEnv = scenarioEnv({
      scenario: { url: '/?preset=iron-ice-quench' },
      outputPath,
      frameDir: '/tmp/ulg-probe-frames',
      port: 5310,
      batches: 16,
      batchSteps: 512,
      timeoutMs: 900_000
    });
    assert.equal(inheritedEnv.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, undefined);
    const durableEnv = scenarioEnv({
      scenario: { url: '/?preset=iron-ice-quench' },
      outputPath,
      frameDir: '/tmp/ulg-probe-frames',
      port: 5310,
      batches: 16,
      batchSteps: 512,
      timeoutMs: 900_000,
      durableReleasePublication: true
    });
    assert.equal(durableEnv.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, '1');
  } finally {
    if (inheritedDurableFlag == null) {
      delete process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION;
    } else {
      process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION = inheritedDurableFlag;
    }
  }

  const result = {
    status: 'good',
    probeMode: 'scene',
    scenarioUrl: '/?preset=iron-ice-quench',
    analysis: { issues: [] }
  };
  assert.equal(probeStdoutPayload({
    output: outputPath,
    stdoutMode: 'none',
    result,
    fullText: '{"large":"payload"}\n'
  }), null);
  const summary = JSON.parse(probeStdoutPayload({
    output: outputPath,
    stdoutMode: 'summary',
    result,
    fullText: '{"large":"payload"}\n'
  }));
  assert.equal(summary.output, outputPath);
  assert.equal(summary.status, 'good');
  assert.equal(probeStdoutPayload({
    output: null,
    stdoutMode: 'none',
    result,
    fullText: '{"large":"payload"}\n'
  }), '{"large":"payload"}\n');
});

test('visual matrix durable publication uses no-clobber private external artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-matrix-publication-'));
  try {
    const repoDir = path.join(root, 'repo');
    const releaseDir = path.join(root, 'release');
    const artifactPath = path.join(releaseDir, 'matrix.log');
    await mkdir(repoDir);
    assert.equal(durableVisualMatrixReleasePublicationEnabled('1'), true);
    assert.equal(durableVisualMatrixReleasePublicationEnabled('true'), false);
    assert.equal(
      SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV,
      'ULG_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION'
    );
    await persistVisualMatrixArtifact({
      artifactPath,
      repoDir,
      value: 'durable log\n',
      label: 'test durable matrix log',
      durableReleasePublication: true
    });
    assert.deepEqual(await readFile(artifactPath), Buffer.from('durable log\n'));
    assert.equal((await lstat(artifactPath)).mode & 0o777, 0o600);
    assert.equal((await lstat(releaseDir)).mode & 0o777, 0o700);
    for (const [name, value] of [
      ['fallback.json', '{"status":"bad"}\n'],
      ['summary.json', '{"failedCount":0}\n']
    ]) {
      const target = path.join(releaseDir, name);
      await persistVisualMatrixArtifact({
        artifactPath: target,
        repoDir,
        value,
        label: `test durable matrix ${name}`,
        durableReleasePublication: true
      });
      assert.equal(await readFile(target, 'utf8'), value);
      assert.equal((await lstat(target)).mode & 0o777, 0o600);
    }
    await assert.rejects(
      persistVisualMatrixArtifact({
        artifactPath,
        repoDir,
        value: 'replacement\n',
        label: 'test durable matrix log',
        durableReleasePublication: true
      }),
      /already exists and will not be replaced/u
    );
    assert.deepEqual(await readFile(artifactPath), Buffer.from('durable log\n'));
    await assert.rejects(
      persistVisualMatrixArtifact({
        artifactPath: path.join(repoDir, 'forbidden.log'),
        repoDir,
        value: 'forbidden\n',
        durableReleasePublication: true
      }),
      /outside the repository/u
    );
    const legacyPath = path.join(repoDir, 'legacy.log');
    await persistVisualMatrixArtifact({ artifactPath: legacyPath, repoDir, value: 'first' });
    await persistVisualMatrixArtifact({ artifactPath: legacyPath, repoDir, value: 'second' });
    assert.equal(await readFile(legacyPath, 'utf8'), 'second');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('visual displacement acceptance follows the scenario length scale', () => {
  const source = Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']) }),
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2
    }),
    condensedLaunch: Object.freeze({
      selector: Object.freeze({ excludePhases: Object.freeze(['gas']) }),
      maxUpwardExcursionM: 0.35,
      minimumSampleCount: 4
    }),
    coldCeilingCondensation: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']) }),
      minimumCeilingContactYM: 4.75,
      minimumReturnDropM: 0.25
    })
  });
  const scaled = scaleStandardPhaseAcceptance(source, 0.028);

  assert.ok(
    Math.abs(scaled.generatedGas.minimumSustainedRiseM - 0.0014) < 1e-15
  );
  assert.ok(
    Math.abs(scaled.condensedLaunch.maxUpwardExcursionM - 0.0098) < 1e-15
  );
  assert.equal(scaled.generatedGas.tailSampleCount, 2);
  assert.equal(scaled.condensedLaunch.minimumSampleCount, 4);
  assert.ok(
    Math.abs(
      scaled.coldCeilingCondensation.minimumCeilingContactYM - 0.133
    ) < 1e-15
  );
  assert.ok(
    Math.abs(
      scaled.coldCeilingCondensation.minimumReturnDropM - 0.007
    ) < 1e-15
  );
  assert.equal(source.generatedGas.minimumSustainedRiseM, 0.05);
  assert.equal(source.condensedLaunch.maxUpwardExcursionM, 0.35);
});

test('standard generated-gas gates route one exact material and mass floor to the probe', () => {
  const expectations = new Map([
    ['water-cycle', 'h2o'],
    ['iron-ice-quench', 'h2o'],
    ['sodium-water', 'h2']
  ]);
  for (const [presetId, targetMaterial] of expectations) {
    const scenario = STANDARD_SCENARIOS.find(
      (candidate) => candidate.presetId === presetId
    );
    assert.ok(scenario);
    const env = scenarioEnv({
      scenario,
      outputPath: `/tmp/${presetId}.json`,
      frameDir: `/tmp/${presetId}-frames`,
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    });
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_TARGET_MATERIAL,
      targetMaterial
    );
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_KG,
      '0'
    );
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_FRACTION_OF_SYSTEM,
      '0.000001'
    );
  }

  assert.throws(() => scenarioEnv({
    scenario: {
      label: 'ambiguous-gas',
      url: '/',
      phaseAwareAcceptance: {
        generatedGas: {
          selector: { materials: ['h2o', 'h2'] }
        }
      }
    },
    outputPath: '/tmp/ambiguous.json',
    frameDir: '/tmp/ambiguous-frames',
    port: 5310,
    batches: 1,
    batchSteps: 1,
    timeoutMs: 1000
  }), /requires exactly one target material/);
});

test('visual acceptance rejects invalid similarity scales', () => {
  assert.throws(
    () => scaleStandardPhaseAcceptance({ generatedGas: {} }, 0),
    /sceneLengthScale must be a positive finite number/
  );
  assert.equal(scaleStandardPhaseAcceptance(null, 0), null);
});

test('spatial refinement preserves physical visual acceptance distances', () => {
  const ironIce = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'iron-ice-quench'
  );
  assert.ok(ironIce);
  assert.ok(Math.abs(standardScenarioPhysicalLengthScale({
    controls: { basen: '10' },
    runtime: { sceneLengthScale: '0.014' }
  }) - 0.028) < 1e-15);
  assert.ok(
    Math.abs(
      ironIce.phaseAwareAcceptance.generatedGas.minimumSustainedRiseM
      - 0.0014
    ) < 1e-15
  );
  assert.ok(
    Math.abs(
      ironIce.phaseAwareAcceptance.condensedLaunch.maxUpwardExcursionM
      - 0.0098
    ) < 1e-15
  );
});

test('iron cooling statistic is mass weighted across phase rows', () => {
  const checkpoint = {
    materialPhases: [
      {
        material: 'fe',
        phase: 'solid',
        massKg: 1,
        temperatureMassWeightedMeanK: 1700
      },
      {
        material: 'fe',
        phase: 'liquid',
        massKg: 3,
        temperatureMassWeightedMeanK: 1800
      },
      {
        material: 'h2o',
        phase: 'liquid',
        massKg: 10,
        temperatureMassWeightedMeanK: 300
      }
    ]
  };
  assert.equal(
    checkpointMassWeightedMeanTemperature(checkpoint, 'fe'),
    1775
  );
});

test('visual scenarios restore one authoritative adjacent-level arm and keep the remaining matrix single-level', () => {
  const cesiumFluorine = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.ok(cesiumFluorine);
  const scenarios = [
    ...STANDARD_SCENARIOS.filter(
      (scenario) => scenario !== cesiumFluorine
    ),
    ...deterministicRandomPairScenarios()
  ];
  assert.ok(scenarios.length >= 6);
  for (const scenario of scenarios) {
    const url = new URL(scenario.url, 'https://ulg.invalid');
    assert.equal(url.searchParams.get('schroederLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederMinLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederMaxLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederTwoLevel'), '0', scenario.label);
    assert.equal(
      url.searchParams.get('schroederTwoLevelAuthority'),
      null,
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederTwoLevelSubsteps'),
      null,
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederCrossLevelCoupling'),
      '0',
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederMechanicsFieldPairV2'),
      null,
      scenario.label
    );
    assert.equal(url.searchParams.get('ss'), '1', scenario.label);
  }

  const url = new URL(cesiumFluorine.url, 'https://ulg.invalid');
  assert.equal(url.searchParams.get('schroederLevel'), '0');
  assert.equal(url.searchParams.get('schroederMinLevel'), '0');
  assert.equal(url.searchParams.get('schroederMaxLevel'), '1');
  assert.equal(url.searchParams.get('schroederTwoLevel'), '1');
  assert.equal(
    url.searchParams.get('schroederTwoLevelAuthority'),
    'authoritative'
  );
  assert.equal(url.searchParams.get('schroederTwoLevelSubsteps'), '2');
  assert.equal(url.searchParams.get('schroederCrossLevelCoupling'), '1');
  assert.equal(
    url.searchParams.get('schroederMechanicsFieldPairV2'),
    '1'
  );
  assert.ok(Number(url.searchParams.get('schroederBaseGridSpacingM')) > 0);
  assert.ok(url.searchParams.get('bodies'));
  assert.equal(cesiumFluorine.expectAuthoritativeTwoLevelMechanics, true);
});

test('cesium-fluorine matrix URL bodies physically populate both declared Schroeder levels', () => {
  const matrixScenario = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.ok(matrixScenario);
  const url = new URL(matrixScenario.url, 'https://ulg.invalid');
  const initialBodies = parseSphInitialBodies(
    url.searchParams.get('bodies')
  );
  const demo = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [4, 4, 4]
    }),
    initialBodies,
    allowFixtureMaterialProperties: true,
    mechanics: 'mlsmpm'
  });
  const baseDx = Number(
    url.searchParams.get('schroederBaseGridSpacingM')
  );
  const levelForBody = (bodyId) => {
    const particle = demo.state.particles.find(
      (candidate) => candidate.initialBodyId === bodyId
    );
    assert.ok(particle, `missing ${bodyId} initial-body particle`);
    const supportRadiusM = Math.cbrt(
      (3 * particle.continuumCellVolumeM3) / (4 * Math.PI)
    );
    return {
      supportRadiusM,
      level: estimateSchroederLevelFromSupportRadius({
        supportRadiusM,
        baseGridSpacingM: baseDx,
        targetSupportCells: 1.5,
        minLevel: 0,
        maxLevel: 1
      })
    };
  };
  const cesium = levelForBody('drop');
  const fluorine = levelForBody('base');
  assert.ok(Math.abs(cesium.supportRadiusM - 0.074442058907928) < 1e-12);
  assert.ok(
    Math.abs(fluorine.supportRadiusM - 0.12407009817988002) < 1e-12
  );
  assert.deepEqual(
    { Cs: cesium.level, F: fluorine.level },
    { Cs: 0, F: 1 }
  );
  assert.deepEqual(
    [...new Set([cesium.level, fluorine.level])].sort(),
    [0, 1]
  );
});

test('iron-ice surface-stress visual evidence is exact and fail-closed', () => {
  const scenario = STANDARD_SCENARIOS.find(
    (entry) => entry.presetId === 'iron-ice-quench'
  );
  assert.ok(scenario);
  assert.equal(
    new URL(scenario.url, 'https://ulg.invalid').searchParams.get('lawst'),
    '1'
  );
  const receipt = {
    schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
    status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
    requested: true,
    submitted: true,
    dispatchCount: 18,
    lifecycleDispatchCount: 21,
    lifecycleMode:
      'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit',
    ambientBuoyancyMode:
      'field-local-s9ab-current-volume-ambient-source',
    selectedLevel: 0,
    levelRole: 'single',
    twoLevel: false,
    positiveSurfaceTensionPhaseRecordCount: 1,
    surfaceTensionCoefficientStatus:
      'positive-surface-tension-coefficient-ready',
    verification: 'queue-submitted-no-full-readback'
  };
  const probe = {
    timeline: {
      metrics: [
        {
          residentSteps: {
            completedStepCount: 1,
            finalStepPhaseVolumeSurfaceStressSubmission: receipt,
            phaseVolumeSurfaceStressRequired: true,
            phaseVolumeSurfaceStressExpectedSubmissionCount: 1,
            phaseVolumeSurfaceStressSubmissionCount: 1,
            phaseVolumeSurfaceStressSubmissionEvidenceComplete: true,
            phaseVolumeSurfaceStressSubmissions: [receipt]
          }
        },
        {
          residentStep: {
            status: 'submitted-unverified',
            phaseVolumeSurfaceStressSubmission: { ...receipt }
          }
        }
      ]
    }
  };

  const pass = evaluateSurfaceStressExecutionEvidence(scenario, probe);
  assert.equal(pass.status, 'pass');
  assert.equal(pass.observed.exactSubmissionCount, 2);

  const missing = structuredClone(probe);
  delete missing.timeline.metrics[1].residentStep
    .phaseVolumeSurfaceStressSubmission;
  const fail = evaluateSurfaceStressExecutionEvidence(scenario, missing);
  assert.equal(fail.status, 'fail');
  assert.equal(fail.observed.exactSubmissionCount, 1);
});

test('authoritative two-level matrix evidence is complete for every retained resident sample', () => {
  const scenario = {
    expectAuthoritativeTwoLevelMechanics: true
  };
  const probe = {
    timeline: {
      metrics: [
        {
          residentStep: { status: 'submitted-unverified' },
          schroederTelemetry: {
            twoLevelMechanicsCoverageComplete: true
          }
        },
        {
          residentSteps: { completedStepCount: 2 },
          schroederTelemetry: {
            twoLevelMechanicsCoverageComplete: true
          }
        }
      ]
    }
  };
  const pass = evaluateAuthoritativeTwoLevelMechanicsEvidence(
    scenario,
    probe
  );
  assert.equal(pass.status, 'pass');
  assert.equal(pass.observed.completeSampleCount, 2);

  const missing = structuredClone(probe);
  missing.timeline.metrics[1].schroederTelemetry
    .twoLevelMechanicsCoverageComplete = false;
  const fail = evaluateAuthoritativeTwoLevelMechanicsEvidence(
    scenario,
    missing
  );
  assert.equal(fail.status, 'fail');
  assert.equal(fail.observed.completeSampleCount, 1);
  assert.equal(
    evaluateAuthoritativeTwoLevelMechanicsEvidence({}, probe),
    null
  );
});
