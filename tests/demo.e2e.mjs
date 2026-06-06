import { expect, test } from '@playwright/test';

test('supervised service smoke renders desktop and mobile worker trees', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await expect(page.getByText('PeerCompute')).toBeVisible();
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.length === 2);
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.some((service) => service.serviceId === 'moonlab' && service.assetProbe?.status));
  const moonlabAssetStatus = await page.evaluate(() => window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'moonlab').assetProbe.status);
  expect(moonlabAssetStatus).not.toBe('skipped');
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

  const fixtureProbe = await consumeMoonLabFixturesInBrowserWorker(page);
  expect(fixtureProbe.type).toBe('fixture-consumed');
  expect(fixtureProbe.serviceId).toBe('moonlab');
  expect(fixtureProbe.taskKind).toBe('moonlab.quantum.response');
  expect(fixtureProbe.resolvedCount).toBe(1);
  expect(fixtureProbe.assetProbe.locateFile.resolved).toContain('/service-assets/moonlab/moonlab.wasm');

  const moonlabArtifact = await readMoonLabArtifact(page);
  if (moonlabAssetStatus === 'ready') {
    expect(moonlabArtifact.method).toBe('moonlab-wasm-bell-phi-plus-probe');
    expect(moonlabArtifact.runtime.coreProbe.status).toBe('ready');
    expect(moonlabArtifact.outputs.bellState).toBe('bell_phi_plus');
    expect(moonlabArtifact.outputs.basisProbabilities[0]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.outputs.basisProbabilities[3]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.responseDescriptor.schema).toBe('peercompute.ulg.quantum-response-descriptor.v0');
    expect(moonlabArtifact.responseDescriptor.invariants.normalizationDelta).toBeLessThan(1e-9);
    expect(moonlabArtifact.parity.schema).toBe('peercompute.ulg.quantum-response-parity.v0');
    expect(moonlabArtifact.parity.status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-wasm-core').status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-webgpu').status).toBe('unsupported');
    expect(moonlabArtifact.validationMetrics.unsupportedParityModeCount).toBe(1);
    expect(moonlabArtifact.validation.status).toBe('pass');
  }
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

async function consumeMoonLabFixturesInBrowserWorker(page) {
  return page.evaluate(async () => {
    const [manifest, taskCapsule] = await Promise.all([
      fetch('/ulg-gpu-abi/examples/moonlab-service-manifest.json').then((response) => response.json()),
      fetch('/ulg-gpu-abi/examples/moonlab-task-capsule.json').then((response) => response.json())
    ]);

    return new Promise((resolve, reject) => {
      const worker = new Worker('/src/services/serviceContractProbe.worker.js', {
        type: 'module',
        name: 'ulg-contract-fixture-probe'
      });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Timed out waiting for contract fixture probe worker'));
      }, 5000);
      worker.addEventListener('message', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        if (event.data.type === 'fixture-error') {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data);
      });
      worker.addEventListener('error', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(event.message));
      });
      worker.postMessage({ manifest, taskCapsule });
    });
  });
}

async function readMoonLabArtifact(page) {
  await page.waitForFunction(
    () => window.__ulgDemo?.telemetry?.artifacts?.some((record) => record.ref.sourceService === 'moonlab'),
    undefined,
    { timeout: 8000 }
  );
  return page.evaluate(async () => {
    const record = window.__ulgDemo.telemetry.artifacts.find((artifact) => (
      artifact.ref.sourceService === 'moonlab'
    ));
    return window.__ulgDemo.artifactCache.get(record.ref);
  });
}
