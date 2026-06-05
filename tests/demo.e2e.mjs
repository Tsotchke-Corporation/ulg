import { expect, test } from '@playwright/test';

test('supervised service smoke renders desktop and mobile worker trees', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await expect(page.getByText('PeerCompute')).toBeVisible();
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.length === 2);
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.tasks?.length === 2);
  await page.waitForTimeout(1200);

  const desktopPixels = await sampledCanvasPixels(page);
  expect(desktopPixels.nonBlank).toBeGreaterThan(80);
  await page.screenshot({ path: 'test-results/ulg-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const mobilePixels = await sampledCanvasPixels(page);
  expect(mobilePixels.nonBlank).toBeGreaterThan(60);
  await page.screenshot({ path: 'test-results/ulg-mobile.png', fullPage: true });
});

async function sampledCanvasPixels(page) {
  return page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBlank = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      if (r + g + b > 16) {
        nonBlank += 1;
      }
    }
    return { width, height, nonBlank };
  });
}
