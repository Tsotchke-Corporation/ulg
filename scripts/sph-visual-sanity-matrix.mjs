import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_PORT = 5310;
const DEFAULT_OUTPUT_DIR = '/tmp/ulg-visual-sanity-matrix';
const DEFAULT_BATCHES = 4;
const DEFAULT_BATCH_STEPS = 24;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_FRAME_MAX = 16;

const SCENARIOS = [
  {
    label: 'liquid-liquid-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'liquid-liquid-h2o-mlsmpm-flow-sequence',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 4,
    batchSteps: 512,
    defaultEnabled: false
  },
  {
    label: 'liquid-liquid-h2o-mlsmpm-flow-smoke',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=4&boxx=5&boxy=5&boxz=5&mech=mlsmpm',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    liquidFreeSurfaceMaxTallnessRatio: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 8,
    batchSteps: 256,
    defaultEnabled: false
  },
  {
    label: 'liquid-liquid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'liquid-liquid-h2o-cpu-sph-flow-sequence',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 8,
    batchSteps: 384,
    defaultEnabled: false
  },
  {
    label: 'solid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=250&baset=250&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 2,
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'solid-liquid-contact-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph'
  },
  {
    label: 'phase-change-hot-h2o-water',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph'
  },
  {
    label: 'reaction-product-na-h2o',
    url: '/?drop=na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&blob=1',
    expectedMechanics: 'sph',
    expectedMaterialPresent: ['naoh', 'h2'],
    expectedMaterialAbsent: ['Na'],
    minReactionEventsTotal: 1
  },
  {
    label: 'law-static-mechanics-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=0&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'sph',
    expectStatic: true,
    staticMaxDisplacementM: 1e-7,
    staticMaxCenterOfMassDeltaM: 1e-7
  },
  {
    label: 'law-static-gravity-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.5&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=1&lawg=0&laweos=0&lawp=0&lawt=0&lawr=0&lawv=0&lawst=0',
    expectedMechanics: 'sph',
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'law-pressure-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-eos-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=0&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-thermal-off-hot-h2o',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-reactions-off-na-h2o',
    url: '/?drop=na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=0&lawv=1&lawst=0&blob=1',
    expectedMechanics: 'sph',
    maxSpeedMPerS: 25
  }
];

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function envFlagEnabled(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  return fallback;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(...sources) {
  const values = [];
  const seen = new Set();
  for (const source of sources) {
    for (const value of arrayOf(source)) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      values.push(text);
    }
  }
  return values;
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inferMechanicsIntegrator(probe) {
  const direct = String(probe?.timeline?.mechanicsIntegrator || probe?.analysis?.mechanicsIntegrator || '').trim();
  if (direct) return direct;
  const metrics = Array.isArray(probe?.timeline?.metrics) ? probe.timeline.metrics : [];
  const lastMetric = metrics.length ? metrics[metrics.length - 1] : null;
  const schemaText = [
    lastMetric?.residentStep?.schema,
    lastMetric?.residentSteps?.schema,
    probe?.timeline?.schema
  ].filter(Boolean).join(' ');
  if (schemaText.includes('plain-sph')) return 'sph';
  if (schemaText.includes('mls-mpm')) return 'mlsmpm';
  return null;
}

function visualSurfaceIssueKey(issue) {
  const axes = Array.isArray(issue?.axes) ? issue.axes.join(',') : '';
  return [
    issue?.issue || 'unknown',
    issue?.materialKey || '',
    issue?.phase || '',
    issue?.renderSource || '',
    axes
  ].join('|');
}

function compactVisualSurfaceIssue(issue) {
  return {
    issue: issue?.issue || 'unknown',
    metricIndex: Number.isFinite(Number(issue?.metricIndex)) ? Number(issue.metricIndex) : null,
    materialKey: issue?.materialKey ?? null,
    phase: issue?.phase ?? null,
    renderSource: issue?.renderSource ?? null,
    renderLayer: issue?.renderLayer ?? null,
    renderOrder: finiteOrNull(issue?.renderOrder),
    renderOrderBase: finiteOrNull(issue?.renderOrderBase),
    renderOrderPolicy: issue?.renderOrderPolicy ?? null,
    materialTransparent: issue?.materialTransparent ?? null,
    materialDepthWrite: issue?.materialDepthWrite ?? null,
    materialDepthTest: issue?.materialDepthTest ?? null,
    axes: Array.isArray(issue?.axes) ? issue.axes : [],
    maxOverflowM: finiteOrNull(issue?.maxOverflowM),
    particleBoundsToleranceM: finiteOrNull(issue?.particleBoundsToleranceM),
    particleSupportRadiusM: finiteOrNull(issue?.particleSupportRadiusM),
    marchingCubesCellSizeM: finiteOrNull(issue?.marchingCubesCellSizeM),
    allowedParticleBoundsOverflowM: finiteOrNull(issue?.allowedParticleBoundsOverflowM)
  };
}

function uniqueVisualSurfaceIssues(...sources) {
  const values = [];
  const seen = new Set();
  for (const source of sources) {
    for (const issue of arrayOf(source)) {
      if (!issue || typeof issue !== 'object') continue;
      const key = visualSurfaceIssueKey(issue);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(compactVisualSurfaceIssue(issue));
    }
  }
  return values;
}

function countBy(values, keyOf = (value) => value) {
  const counts = {};
  for (const value of arrayOf(values)) {
    const key = String(keyOf(value) || '').trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function selectedScenarios() {
  const filter = String(process.env.ULG_VISUAL_MATRIX_SCENARIOS || '').trim();
  if (!filter) return SCENARIOS.filter((scenario) => scenario.defaultEnabled !== false);
  const wanted = new Set(filter.split(',').map((entry) => entry.trim()).filter(Boolean));
  return SCENARIOS.filter((scenario) => wanted.has(scenario.label));
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function terminateProcessGroup(proc) {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => {
    if (proc.exitCode != null || proc.killed) return;
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      try { proc.kill('SIGKILL'); } catch {}
    }
  }, 5000).unref();
}

function runCommand(command, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut, ...result });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\n[sph-visual-matrix] scenario hard timeout after ${timeoutMs} ms\n`;
      terminateProcessGroup(proc);
    }, Math.max(1000, timeoutMs)).unref();
    proc.stdout.on('data', (chunk) => { stdout += String(chunk); });
    proc.stderr.on('data', (chunk) => { stderr += String(chunk); });
    proc.on('error', (error) => {
      finish({ code: 1, stdout, stderr: `${stderr}${error.stack || error.message || String(error)}\n` });
    });
    proc.on('close', (code) => {
      finish({ code: code ?? (timedOut ? 124 : 1), stdout, stderr });
    });
  });
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function scenarioEnv({
  scenario,
  outputPath,
  frameDir,
  port,
  batches,
  batchSteps,
  timeoutMs
}) {
  const env = {
    ...process.env,
    ULG_PROBE_URL: scenario.url,
    ULG_PROBE_OUTPUT: outputPath,
    ULG_PROBE_PORT: String(port),
    ULG_PROBE_BATCHES: String(scenario.batches ?? batches),
    ULG_PROBE_BATCH_STEPS: String(scenario.batchSteps ?? batchSteps),
    ULG_PROBE_RENDER_EVERY: String(scenario.renderEvery ?? 1),
    ULG_PROBE_TIMEOUT_MS: String(scenario.timeoutMs ?? timeoutMs),
    ULG_PROBE_FAIL_ON_BAD: '1'
  };
  if (scenario.expectedH2oVisibleSurfaceCount != null) {
    env.ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT = String(scenario.expectedH2oVisibleSurfaceCount);
  }
  if (Array.isArray(scenario.expectedMaterialPresent) && scenario.expectedMaterialPresent.length) {
    env.ULG_PROBE_EXPECT_MATERIAL_PRESENT = scenario.expectedMaterialPresent.join(',');
  }
  if (Array.isArray(scenario.expectedMaterialAbsent) && scenario.expectedMaterialAbsent.length) {
    env.ULG_PROBE_EXPECT_MATERIAL_ABSENT = scenario.expectedMaterialAbsent.join(',');
  }
  if (scenario.minReactionEventsTotal != null) {
    env.ULG_PROBE_MIN_REACTION_EVENTS_TOTAL = String(scenario.minReactionEventsTotal);
  }
  if (scenario.maxSpeedMPerS != null) {
    env.ULG_PROBE_MAX_SPEED = String(scenario.maxSpeedMPerS);
  }
  if (scenario.minVolumeRatioJ != null) {
    env.ULG_PROBE_MIN_J = String(scenario.minVolumeRatioJ);
  }
  if (scenario.maxVolumeRatioJ != null) {
    env.ULG_PROBE_MAX_J = String(scenario.maxVolumeRatioJ);
  }
  if (scenario.expectStatic === true) {
    env.ULG_PROBE_EXPECT_STATIC = '1';
  }
  if (scenario.staticMaxDisplacementM != null) {
    env.ULG_PROBE_STATIC_MAX_DISPLACEMENT_M = String(scenario.staticMaxDisplacementM);
  }
  if (scenario.staticMaxCenterOfMassDeltaM != null) {
    env.ULG_PROBE_STATIC_MAX_COM_DELTA_M = String(scenario.staticMaxCenterOfMassDeltaM);
  }
  if (scenario.expectLiquidMerge === true) {
    env.ULG_PROBE_EXPECT_LIQUID_MERGE = '1';
  }
  if (scenario.expectLiquidSettled === true) {
    env.ULG_PROBE_EXPECT_LIQUID_SETTLE = '1';
  }
  if (scenario.expectLiquidFreeSurface === true) {
    env.ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE = '1';
  }
  if (scenario.liquidMergeMaxFinalSupportGapM != null) {
    env.ULG_PROBE_LIQUID_MERGE_MAX_FINAL_SUPPORT_GAP_M = String(scenario.liquidMergeMaxFinalSupportGapM);
  }
  if (scenario.liquidSettledMinTimeS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S = String(scenario.liquidSettledMinTimeS);
  }
  if (scenario.liquidSettledMaxFinalDropSpeedMPerS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED = String(scenario.liquidSettledMaxFinalDropSpeedMPerS);
  }
  if (scenario.liquidFreeSurfaceMinTimeS != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S = String(scenario.liquidFreeSurfaceMinTimeS);
  }
  if (scenario.liquidFreeSurfaceMaxTallnessRatio != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_TALLNESS = String(scenario.liquidFreeSurfaceMaxTallnessRatio);
  }
  if (scenario.liquidFreeSurfaceMinFootprintFillRatio != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_FOOTPRINT_FILL = String(scenario.liquidFreeSurfaceMinFootprintFillRatio);
  }
  if (scenario.liquidFreeSurfaceMaxHeightM != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_HEIGHT_M = String(scenario.liquidFreeSurfaceMaxHeightM);
  }
  if (scenario.minVisualFrameTimeSpanS != null) {
    env.ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S = String(scenario.minVisualFrameTimeSpanS);
  }
  if (process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES === '1') {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_EVERY, 1));
    env.ULG_PROBE_FRAME_MAX = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_MAX, DEFAULT_FRAME_MAX));
  } else if (envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true)) {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_EVERY, 1));
    env.ULG_PROBE_FRAME_MAX = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_MAX, DEFAULT_FRAME_MAX));
  }
  return env;
}

async function main() {
  if (process.argv.includes('--list')) {
    for (const scenario of SCENARIOS) console.log(scenario.label);
    return;
  }
  const repoDir = process.env.ULG_VISUAL_MATRIX_REPO_DIR || process.cwd();
  const runId = process.env.ULG_VISUAL_MATRIX_RUN_ID || timestampSlug();
  const outputRoot = path.join(process.env.ULG_VISUAL_MATRIX_OUTPUT_DIR || DEFAULT_OUTPUT_DIR, runId);
  const basePort = positiveInteger(process.env.ULG_VISUAL_MATRIX_BASE_PORT, DEFAULT_BASE_PORT);
  const batches = positiveInteger(process.env.ULG_VISUAL_MATRIX_BATCHES, DEFAULT_BATCHES);
  const batchSteps = positiveInteger(process.env.ULG_VISUAL_MATRIX_BATCH_STEPS, DEFAULT_BATCH_STEPS);
  const timeoutMs = positiveInteger(process.env.ULG_VISUAL_MATRIX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const allowFailures = process.env.ULG_VISUAL_MATRIX_ALLOW_FAILURES === '1';
  const captureFrames = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true);
  const scenarios = selectedScenarios();
  if (!scenarios.length) {
    throw new Error('No SPH visual sanity matrix scenarios selected');
  }
  await mkdir(outputRoot, { recursive: true });

  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const outputPath = path.join(outputRoot, `${scenario.label}.json`);
    const logPath = path.join(outputRoot, `${scenario.label}.log`);
    const frameDir = path.join(outputRoot, `${scenario.label}-frames`);
    const env = scenarioEnv({
      scenario,
      outputPath,
      frameDir,
      port: basePort + index,
      batches,
      batchSteps,
      timeoutMs
    });
    console.log(`[sph-visual-matrix] ${scenario.label}`);
    const run = await runCommand(process.execPath, ['scripts/sph-long-horizon-probe.mjs'], {
      cwd: repoDir,
      env,
      timeoutMs: (scenario.timeoutMs ?? timeoutMs) + 30_000
    });
    await writeFile(logPath, `${run.stdout}\n${run.stderr}`, 'utf8');
    let probe = await readJsonIfPresent(outputPath);
    if (!probe) {
      probe = {
        schema: 'peercompute.ulg.sph-visual-sanity-matrix-scenario-result.v0',
        status: 'bad',
        label: scenario.label,
        url: scenario.url,
        code: run.code,
        timedOut: run.timedOut,
        issues: [
          run.timedOut
            ? 'visual-matrix-scenario-timeout'
            : 'visual-matrix-scenario-output-missing'
        ],
        visualSurfaceIssues: [],
        logPath,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      await writeFile(outputPath, `${JSON.stringify(probe, null, 2)}\n`, 'utf8');
    }
    const analysis = probe?.analysis || {};
    const mechanicsIntegrator = inferMechanicsIntegrator(probe);
    const mechanicsMismatchIssues = scenario.expectedMechanics
      && mechanicsIntegrator
      && mechanicsIntegrator !== scenario.expectedMechanics
      ? ['mechanics-integrator-mismatch']
      : [];
    const issues = uniqueStrings(probe?.issues, probe?.analysis?.issues, mechanicsMismatchIssues);
    const visualSurfaceIssues = uniqueVisualSurfaceIssues(
      probe?.visualSurfaceIssues,
      probe?.analysis?.visualSurfaceIssues
    );
    const failed = run.code !== 0 || probe?.status === 'bad' || issues.length > 0;
    results.push({
      label: scenario.label,
      url: scenario.url,
      expectedMechanics: scenario.expectedMechanics || null,
      mechanicsIntegrator,
      code: run.code,
      timedOut: run.timedOut,
      status: probe?.status || null,
      analysisStatus: analysis.status || null,
      issues,
      issueCount: issues.length,
      visualSurfaceIssues,
      visualSurfaceIssueCount: visualSurfaceIssues.length,
      visualSurfaceIssueTypes: Object.keys(countBy(visualSurfaceIssues, (issue) => issue.issue)),
      browserConsoleIssueCounts: analysis.browserConsoleIssueCounts || {},
      browserConsoleWarningCounts: analysis.browserConsoleWarningCounts || {},
      browserConsoleIssueCount: finiteOrNull(analysis.browserConsoleIssueCount) ?? 0,
      browserConsoleWarningCount: finiteOrNull(analysis.browserConsoleWarningCount) ?? 0,
      maxSpeedObservedMPerS: finiteOrNull(analysis.maxSpeedObservedMPerS),
      maxDisplacementObservedM: finiteOrNull(analysis.maxDisplacementObservedM),
      minVolumeObservedJ: finiteOrNull(analysis.minVolumeObservedJ),
      maxVolumeObservedJ: finiteOrNull(analysis.maxVolumeObservedJ),
      maxPressureImpulseNSeconds: finiteOrNull(analysis.maxPressureImpulseNSeconds),
      maxReactionEventsTotal: finiteOrNull(analysis.maxReactionEventsTotal),
      finalParticlesByMaterial: analysis.finalParticlesByMaterial || null,
      maxNextTimeS: finiteOrNull(analysis.maxNextTimeS),
      minVisualFrameTimeSpanS: finiteOrNull(analysis.minVisualFrameTimeSpanS),
      visualFrameTimeSpanS: finiteOrNull(analysis.visualFrameTimeSpanS),
      visualFrameTimesS: Array.isArray(analysis.visualFrameTimesS) ? analysis.visualFrameTimesS : [],
      expectLiquidFreeSurface: analysis.expectLiquidFreeSurface === true,
      liquidFreeSurfaceMinTimeS: finiteOrNull(analysis.liquidFreeSurfaceMinTimeS),
      liquidFreeSurfaceMaxTallnessRatio: finiteOrNull(analysis.liquidFreeSurfaceMaxTallnessRatio),
      liquidFreeSurfaceMinFootprintFillRatio: finiteOrNull(analysis.liquidFreeSurfaceMinFootprintFillRatio),
      liquidFreeSurfaceMaxHeightM: finiteOrNull(analysis.liquidFreeSurfaceMaxHeightM),
      firstH2oVisibleSurfaceCount: finiteOrNull(analysis.firstH2oVisibleSurfaceCount),
      lastH2oVisibleSurfaceCount: finiteOrNull(analysis.lastH2oVisibleSurfaceCount),
      maxVisibleSurfaceComponentCount: finiteOrNull(analysis.maxVisibleSurfaceComponentCount),
      maxVisibleSurfaceSmallComponentCount: finiteOrNull(analysis.maxVisibleSurfaceSmallComponentCount),
      minVisibleSurfaceLargestComponentRatio: finiteOrNull(analysis.minVisibleSurfaceLargestComponentRatio),
      maxH2oLiquidSurfaceHeightM: finiteOrNull(analysis.maxH2oLiquidSurfaceHeightM),
      maxH2oLiquidSurfaceTallnessRatio: finiteOrNull(analysis.maxH2oLiquidSurfaceTallnessRatio),
      minH2oLiquidSurfaceFootprintFillRatio: finiteOrNull(analysis.minH2oLiquidSurfaceFootprintFillRatio),
      lastH2oLiquidSurfaceHeightM: finiteOrNull(analysis.lastH2oLiquidSurfaceHeightM),
      lastH2oLiquidSurfaceTallnessRatio: finiteOrNull(analysis.lastH2oLiquidSurfaceTallnessRatio),
      lastH2oLiquidSurfaceFootprintFillRatio: finiteOrNull(analysis.lastH2oLiquidSurfaceFootprintFillRatio),
      maxVisibleSurfaceOutsideM: finiteOrNull(analysis.maxVisibleSurfaceOutsideM),
      maxVisibleSurfaceOutsideParticleBoundsM: finiteOrNull(analysis.maxVisibleSurfaceOutsideParticleBoundsM),
      outputPath,
      logPath,
      frameDir: captureFrames ? frameDir : null,
      frameArtifactStatus: probe?.visualFrameArtifacts?.status || null,
      frameCount: probe?.visualFrameArtifacts?.frameCount ?? 0,
      failed
    });
  }

  const summary = {
    schema: 'peercompute.ulg.sph-visual-sanity-matrix.v0',
    runId,
    outputRoot,
    scenarioCount: results.length,
    failedCount: results.filter((result) => result.failed).length,
    captureFrames,
    issueCounts: countBy(results.flatMap((result) => result.issues)),
    browserConsoleIssueCounts: results.reduce((counts, result) => {
      for (const [key, value] of Object.entries(result.browserConsoleIssueCounts || {})) {
        counts[key] = (counts[key] || 0) + Number(value || 0);
      }
      return counts;
    }, {}),
    browserConsoleWarningCounts: results.reduce((counts, result) => {
      for (const [key, value] of Object.entries(result.browserConsoleWarningCounts || {})) {
        counts[key] = (counts[key] || 0) + Number(value || 0);
      }
      return counts;
    }, {}),
    visualSurfaceIssueCounts: countBy(
      results.flatMap((result) => result.visualSurfaceIssues),
      (issue) => issue.issue
    ),
    results
  };
  const summaryPath = path.join(outputRoot, 'summary.json');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedCount > 0 && !allowFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
