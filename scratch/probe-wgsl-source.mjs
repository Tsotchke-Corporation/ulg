import { chromium } from '@playwright/test';

// Compile an arbitrary WGSL string into a compute pipeline on the real device.
// Used to bisect a driver compiler crash between two versions of a shader.
const ENTRY = process.env.PROBE_ENTRY || 'initialize_parent_field_workspace';

const dirty = (await import(
  '../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js'
)).schroederSpatialParentFieldMechanicsWorkspaceWgsl;
const baseline = (await import(
  process.env.PROBE_BASELINE
  || '/tmp/claude-1000/-home-cos-projects-ulg/b05b8ba8-d47f-4b82-b225-7850fa11ea01/scratchpad/baseline/ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js'
)).schroederSpatialParentFieldMechanicsWorkspaceWgsl;

const which = process.env.PROBE_WHICH || 'dirty';
let code = which === 'baseline' ? baseline : dirty;
if (process.env.PROBE_HYBRID) {
  code = (await import(process.env.PROBE_HYBRID))
    .schroederSpatialParentFieldMechanicsWorkspaceWgsl;
}

// Optional transform: drop every declared binding at or above an index.
const dropBindingsFrom = Number(process.env.PROBE_DROP_BINDINGS_FROM || NaN);
if (Number.isFinite(dropBindingsFrom)) {
  code = code.replace(
    /@group\(0\) @binding\((\d+)\)[^;]*;\n/g,
    (match, index) => (Number(index) >= dropBindingsFrom ? '' : match)
  );
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist'
  ]
});
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(process.env.PROBE_BASE_URL || 'https://127.0.0.1:5174/', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  });
  const result = await page.evaluate(async ({ source, entryPoint }) => {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    const device = await adapter.requestDevice();
    const module = device.createShaderModule({ label: 'bisect', code: source });
    const info = await module.getCompilationInfo();
    const errors = info.messages
      .filter((m) => m.type === 'error')
      .map((m) => `${m.lineNum}: ${m.message}`)
      .slice(0, 3);
    if (errors.length) return { status: 'invalid', errors };
    const t0 = performance.now();
    try {
      await device.createComputePipelineAsync({
        label: 'bisect-pipeline',
        layout: 'auto',
        compute: { module, entryPoint }
      });
      return { status: 'COMPILES', ms: Math.round(performance.now() - t0) };
    } catch (error) {
      return {
        status: 'PIPELINE_ERROR',
        ms: Math.round(performance.now() - t0),
        error: (error?.message || String(error)).slice(0, 70)
      };
    }
  }, { source: code, entryPoint: ENTRY });
  console.log(JSON.stringify({ which, entry: ENTRY, len: code.length, ...result }));
} catch (error) {
  console.log(JSON.stringify({
    which,
    entry: ENTRY,
    len: code.length,
    status: 'DEVICE_DIED',
    error: (error?.message || String(error)).slice(0, 90)
  }));
} finally {
  await browser.close();
}
