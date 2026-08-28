import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 560 } });
await page.goto(`${process.env.ULG_SCEN || 'https://localhost:5173/?scenario=bulk-water'}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });
await page.waitForFunction(() => /completion=\d/.test(document.querySelector('#sph-fps')?.textContent || ''), null, { timeout: 120000 });
await page.waitForTimeout(3000);
// Canvas inventory: who exists, who is visible, sizes, z-order.
const canvases = await page.evaluate(() => Array.from(document.querySelectorAll('canvas')).map((c) => {
  const cs = getComputedStyle(c);
  const r = c.getBoundingClientRect();
  return {
    id: c.id || null, cls: c.className || null, w: c.width, h: c.height,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    visibility: cs.visibility, display: cs.display, opacity: cs.opacity, zIndex: cs.zIndex,
  };
}));
const bridgeState = await page.evaluate(() => {
  const p = document.querySelector('#sph-phase-overlay')?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
  return p ? {
    status: p.status, displayOwner: p.displayOwner, displayOwnerEpoch: p.displayOwnerEpoch,
    displayOwnerContentReady: p.displayOwnerContentReady,
    displayOwnerContentFrameSerial: p.displayOwnerContentFrameSerial,
    displayCanvasVisible: p.displayCanvasVisible,
    reason: p.reason,
  } : null;
});
// Masked motion: hash only the fluid region (below the HUD, above bottom chrome).
const region = { x: 0, y: 90, width: 900, height: 400 };
const hashes = [];
for (let i = 0; i < 30; i += 1) {
  const buf = await page.screenshot({ clip: region });
  hashes.push(createHash('sha256').update(buf).digest('hex').slice(0, 10));
  await page.waitForTimeout(150);
}
let transitions = 0;
for (let i = 1; i < hashes.length; i += 1) if (hashes[i] !== hashes[i - 1]) transitions += 1;
const fps = await page.evaluate(() => (document.querySelector('#sph-fps')?.textContent || '').slice(0, 130));
await browser.close();
console.log(JSON.stringify({ canvases, bridgeState, maskedTransitions: transitions, samples: hashes.length, approxWindowS: 30 * 0.15 + 1.5, fps }, null, 1));
