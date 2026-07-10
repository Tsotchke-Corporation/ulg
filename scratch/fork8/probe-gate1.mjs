import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const url = 'http://127.0.0.1:5190/?drop=Na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=sph&residentAuto=0&visualCapture=1&blob=1';
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage();
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForFunction(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const scene = overlay?.__sphScene;
  return Boolean(!overlay?.__sphCpuClosureTask?.active
    && scene?.getSphGpuParticleState?.()?.schema
    && scene?.getSphReactionTable?.()?.reactionCount > 0
    && typeof scene?.refreshMlsMpmResidentSteps === 'function');
}, null, { timeout: 120000 });
await page.waitForTimeout(20000);
const hostStatus = await page.evaluate(() => document.querySelector('#sph-phase-overlay')?.__sphPeerComputeResidentAuthorityHost || null);
console.log('HOSTSTATUS:', JSON.stringify(hostStatus).slice(0, 400));
const out = await page.evaluate(async () => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const scene = overlay.__sphScene;
  const execution = await scene.refreshMlsMpmResidentSteps({
    preferWebGpu: true, stepCount: 1, readbackMode: 'no-full-readback',
    compactSummaryScope: 'particle-visual', continueFromResidentState: false, force: true
  });
  overlay.__mlsMpmResidentSteps = execution;
  const fs = execution?.finalStep || null;
  const gp = overlay.__sphUpdateResidentGasPressureSummary(fs);
  const pis = await scene.refreshSphResidentPressureInterfaceState?.({
    preferWebGpu: true, gasPressureSummary: gp,
    residentProductMass: fs?.residentProductMass || null,
    reactionSummary: fs?.reactionStep?.result?.reactionSummary || fs?.reactionStep?.reactionSummary || null,
    reactionTable: scene.getSphReactionTable?.() || null,
    source: 'probe', sourceCadence: 'probe'
  });
  const pick = (o) => o && Object.fromEntries(Object.entries(o).filter(([k, v]) =>
    /status|schema|source|blocker|promoted|cellCount|rowCount|ledger/i.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null)));
  return {
    stepBackend: execution?.backend ?? null,
    reactionStatus: fs?.stageStatus?.reaction ?? null,
    residentProductMassStatus: fs?.residentProductMass?.status ?? null,
    productRows: fs?.residentProductMass?.productEventRowCount ?? null,
    pis: pick(pis),
    strictGate: fs?.residentProductMass?.strictReactionGate
      || fs?.reactionStep?.result?.reactionSummary?.strictReactionGate
      || fs?.reactionStep?.reactionSummary?.strictReactionGate
      || null,
    spatialLedger: pick(pis?.spatialGasSpeciesLedger || pis?.residentSpatialGasSpeciesLedger || null),
    gasPressureStatus: gp?.status ?? null,
    spatialKeys: Object.keys(fs || {}).filter((k) => /spatialGas/i.test(k)),
    diagSpatial: Object.fromEntries(Object.entries(fs?.diagnostics || {}).filter(([k]) => /spatialGas/i.test(k))),
    stageStatusKeys: fs?.stageStatus ? Object.keys(fs.stageStatus) : null,
    hostPresent: Boolean(globalThis.__ulgResidentAuthorityHost),
    hostSubmitSpatial: typeof globalThis.__ulgResidentAuthorityHost?.submitSpatialGasLedgerProducerStageTask,
    hostKeys: globalThis.__ulgResidentAuthorityHost
      ? Object.keys(globalThis.__ulgResidentAuthorityHost).filter((k) => /submit/i.test(k)).slice(0, 12)
      : null
  };
});
console.log('STRICT:', JSON.stringify(out.strictGate));
console.log('LEDGER:', JSON.stringify(out.spatialLedger));
console.log('GP:', out.gasPressureStatus, 'PM:', out.residentProductMassStatus, 'rows:', out.productRows);
console.log('SPATIALKEYS:', JSON.stringify(out.spatialKeys));
console.log('DIAG:', JSON.stringify(out.diagSpatial).slice(0, 600));
console.log('STAGES:', JSON.stringify(out.stageStatusKeys));
console.log('HOST:', out.hostPresent, out.hostSubmitSpatial, JSON.stringify(out.hostKeys));
await browser.close();
