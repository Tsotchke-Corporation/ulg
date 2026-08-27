import { chromium } from '@playwright/test';

const query = process.env.ULG_QUERY ?? 'scenario=sodium-water';
const waitS = Number(process.env.ULG_WAIT_S ?? 30);
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?${query}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });
await page.waitForTimeout(8000);
const before = await page.evaluate(() => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0);
if (before === 0) await page.click('#sph-play').catch(() => {});
await page.waitForTimeout(waitS * 1000);
const out = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const env = o?.__mlsMpmResidentSteps;
  const lane = env?.workerOwnedResidentLane;
  const compact = (v, depth = 0) => {
    if (v == null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return `[typedarray len=${v.length}]`;
    if (Array.isArray(v)) return depth > 1 ? `[array len=${v.length}]` : v.slice(0, 6).map((x) => compact(x, depth + 1));
    if (depth > 2) return `{object keys=${Object.keys(v).length}}`;
    const r = {};
    for (const k of Object.keys(v).slice(0, 40)) r[k] = compact(v[k], depth + 1);
    return r;
  };
  return {
    steps: lane?.laneCompletedStepTotal ?? 0,
    envLawQueue: compact(env?.lawQueue),
    envLawNeighborCandidates: compact(env?.lawNeighborCandidates),
    envActiveNodeIndex: compact(env?.activeNodeIndex),
    envActiveNodeSortedIndex: compact(env?.activeNodeSortedIndex),
    laneHierarchyStageSummaryKeys: lane?.hierarchyStageSummary ? Object.keys(lane.hierarchyStageSummary) : null,
    laneHierarchyStageSummary: compact(lane?.hierarchyStageSummary),
    laneKeys: lane ? Object.keys(lane) : null,
    finalStepTraversal: compact(env?.finalStep?.lawNeighborCandidates ?? env?.finalStep?.schroederLawNeighborTraversal ?? null),
    finalStepKeysLaw: env?.finalStep ? Object.keys(env.finalStep).filter((k) => /law|traversal|neighbor|contact|schroeder|index/i.test(k)) : null,
  };
});
console.log(JSON.stringify({ query, ...out }, null, 1));
await browser.close();
