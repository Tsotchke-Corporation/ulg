import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_PORT = 5310;
const DEFAULT_OUTPUT_DIR = '/tmp/ulg-visual-sanity-matrix';
const DEFAULT_BATCHES = 4;
const DEFAULT_BATCH_STEPS = 24;
const DEFAULT_TIMEOUT_MS = 180_000;

const SCENARIOS = [
  {
    label: 'liquid-liquid-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'liquid-liquid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'solid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=250&baset=250&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedH2oVisibleSurfaceCount: 2,
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'solid-liquid-contact-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5'
  },
  {
    label: 'phase-change-hot-h2o-water',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5'
  },
  {
    label: 'reaction-product-na-h2o',
    url: '/?drop=na&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5'
  },
  {
    label: 'law-static-mechanics-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&lawmech=0&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectStatic: true,
    staticMaxDisplacementM: 1e-7,
    staticMaxCenterOfMassDeltaM: 1e-7
  },
  {
    label: 'law-static-gravity-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.5&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&lawmech=1&lawg=0&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'law-pressure-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawmech=1&lawg=1&laweos=1&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-eos-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawmech=1&lawg=1&laweos=0&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-thermal-off-hot-h2o',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-reactions-off-na-h2o',
    url: '/?drop=na&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=0&lawv=1&lawst=0',
    maxSpeedMPerS: 25
  }
];

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function selectedScenarios() {
  const filter = String(process.env.ULG_VISUAL_MATRIX_SCENARIOS || '').trim();
  if (!filter) return SCENARIOS;
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
  if (scenario.liquidMergeMaxFinalSupportGapM != null) {
    env.ULG_PROBE_LIQUID_MERGE_MAX_FINAL_SUPPORT_GAP_M = String(scenario.liquidMergeMaxFinalSupportGapM);
  }
  if (scenario.liquidSettledMinTimeS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S = String(scenario.liquidSettledMinTimeS);
  }
  if (scenario.liquidSettledMaxFinalDropSpeedMPerS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED = String(scenario.liquidSettledMaxFinalDropSpeedMPerS);
  }
  if (process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES === '1') {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_EVERY, 1));
    env.ULG_PROBE_FRAME_MAX = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_MAX, 64));
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
    const failed = run.code !== 0 || probe?.status === 'bad' || (probe?.issues || []).length > 0;
    results.push({
      label: scenario.label,
      url: scenario.url,
      code: run.code,
      timedOut: run.timedOut,
      status: probe?.status || null,
      issues: probe?.issues || [],
      visualSurfaceIssues: probe?.visualSurfaceIssues || [],
      outputPath,
      logPath,
      frameDir: process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES === '1' ? frameDir : null,
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
