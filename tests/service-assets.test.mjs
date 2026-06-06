import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMoonLabServiceAssetSpec,
  createUlgServiceManifest
} from '../ulg-gpu-abi/src/serviceContract.js';
import {
  createMoonLabLocateFile,
  probeManifestServiceAssets
} from '../src/runtime/ServiceAssetProbe.js';

test('MoonLab service asset spec resolves locateFile-compatible URLs', () => {
  const assets = createMoonLabServiceAssetSpec();
  const locateFile = createMoonLabLocateFile({
    baseUrl: assets.baseUrl,
    wasmModule: assets.wasmModule,
    locationHref: 'https://ulg.local/demo/'
  });

  assert.equal(assets.loaderModule, '/service-assets/moonlab/moonlab.js');
  assert.equal(assets.wasmModule, '/service-assets/moonlab/moonlab.wasm');
  assert.equal(assets.coreProbeWorkerModule, '/workers/moonlab-core-probe.worker.js');
  assert.equal(
    locateFile('moonlab.wasm'),
    'https://ulg.local/service-assets/moonlab/moonlab.wasm'
  );
});

test('service asset probe marks declared MoonLab artifacts ready when MIME types match', async () => {
  const assets = createMoonLabServiceAssetSpec();
  const manifest = createUlgServiceManifest({
    serviceId: 'moonlab',
    runtime: 'wasm',
    workerModule: '/workers/moonlab.service.worker.js',
    serviceAssets: assets
  });
  assert.equal(manifest.childWorkers.allowedModules.includes('/workers/moonlab-core-probe.worker.js'), true);
  const requests = [];
  const probe = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async (url) => {
      requests.push(url);
      return fakeResponse({
        status: 200,
        contentType: url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
      });
    }
  });

  assert.equal(probe.status, 'ready');
  assert.deepEqual(requests, [
    'https://ulg.local/service-assets/moonlab/moonlab.js',
    'https://ulg.local/service-assets/moonlab/moonlab.wasm'
  ]);
  assert.equal(probe.locateFile.resolved, 'https://ulg.local/service-assets/moonlab/moonlab.wasm');
});

test('service asset probe distinguishes missing assets from wrong WASM MIME', async () => {
  const assets = createMoonLabServiceAssetSpec();
  const manifest = createUlgServiceManifest({
    serviceId: 'moonlab',
    runtime: 'wasm',
    workerModule: '/workers/moonlab.service.worker.js',
    serviceAssets: assets
  });

  const missing = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async () => fakeResponse({ status: 404, contentType: 'text/html' })
  });
  assert.equal(missing.status, 'missing');

  const htmlFallback = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async () => fakeResponse({ status: 200, contentType: 'text/html' })
  });
  assert.equal(htmlFallback.status, 'missing');

  const mimeMismatch = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async (url) => fakeResponse({
      status: 200,
      contentType: url.endsWith('.wasm') ? 'application/octet-stream' : 'text/javascript'
    })
  });
  assert.equal(mimeMismatch.status, 'mime-mismatch');
  assert.equal(mimeMismatch.assets.find((asset) => asset.kind === 'wasmModule').status, 'mime-mismatch');
});

function fakeResponse({ status, contentType }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      }
    }
  };
}
