import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  createEshkolClosureBundleAssetSpec,
  createMoonLabServiceAssetSpec,
  createUlgServiceManifest
} from '../ulg-gpu-abi/src/serviceContract.js';
import {
  createMoonLabLocateFile,
  probeManifestServiceAssets
} from '../src/runtime/ServiceAssetProbe.js';

test('service asset staging canonicalizes the MoonLab normalized reference suite', () => {
  const source = readFileSync(resolve('scripts/stage-service-assets.mjs'), 'utf8');
  const normalizeIndex = source.indexOf("'--normalize-references'");
  const canonicalIndex = source.indexOf("'--canonical'", normalizeIndex);
  const strictIndex = source.indexOf("'--strict'", normalizeIndex);
  const webGpuParityIndex = source.indexOf("'webgpu:complex64:browser-smoke'");
  const requireBackendIndex = source.indexOf("'--require-backend'", webGpuParityIndex);
  const paritySchemaIndex = source.indexOf('moonlab.webgpu.complex64-parity-scope.v0');
  const executedEvidenceIndex = source.indexOf('MoonLab WebGPU parity scope must carry executed browser WebGPU evidence');
  const deviceAcquiredIndex = source.indexOf("'device-acquired'", executedEvidenceIndex);

  assert.ok(normalizeIndex > 0);
  assert.ok(canonicalIndex > normalizeIndex);
  assert.ok(strictIndex > canonicalIndex);
  assert.ok(webGpuParityIndex > 0);
  assert.ok(requireBackendIndex > webGpuParityIndex);
  assert.ok(paritySchemaIndex > requireBackendIndex);
  assert.ok(executedEvidenceIndex > paritySchemaIndex);
  assert.ok(deviceAcquiredIndex > executedEvidenceIndex);
});

test('MoonLab service asset spec resolves locateFile-compatible URLs', () => {
  const assets = createMoonLabServiceAssetSpec();
  const locateFile = createMoonLabLocateFile({
    baseUrl: assets.baseUrl,
    wasmModule: assets.wasmModule,
    locationHref: 'https://ulg.local/demo/'
  });

  assert.equal(assets.loaderModule, '/service-assets/moonlab/moonlab.js');
  assert.equal(assets.wasmModule, '/service-assets/moonlab/moonlab.wasm');
  assert.equal(assets.referenceContractModule, '/service-assets/moonlab/magnetar-reference-contracts.json');
  assert.equal(assets.webGpuParityScopeModule, '/service-assets/moonlab/webgpu-complex64-parity-scope.json');
  assert.equal(assets.coreProbeWorkerModule, '/workers/moonlab-core-probe.worker.js');
  assert.deepEqual(assets.required, ['loaderModule', 'wasmModule']);
  assert.deepEqual(assets.files, {
    loaderModule: 'moonlab.js',
    wasmModule: 'moonlab.wasm',
    referenceContractModule: 'magnetar-reference-contracts.json',
    webGpuParityScopeModule: 'webgpu-complex64-parity-scope.json'
  });
  assert.equal(
    locateFile('moonlab.wasm'),
    'https://ulg.local/service-assets/moonlab/moonlab.wasm'
  );
});

test('Eshkol closure bundle asset spec declares deployable JSON and WASM files', async () => {
  const assets = createEshkolClosureBundleAssetSpec({ bundleName: 'magnetar-closure' });
  assert.equal(assets.baseUrl, '/service-assets/eshkol/closures/magnetar-closure/');
  assert.equal(assets.artifactModule, '/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.ulg.json');
  assert.equal(assets.wasmModule, '/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm');
  assert.equal(assets.schemaModule, '/service-assets/eshkol/closures/magnetar-closure/schemas/ulg/closure_artifact.schema.json');
  assert.equal(assets.bundleManifest, '/service-assets/eshkol/closures/magnetar-closure/ulg_bundle_manifest.json');

  const manifest = createUlgServiceManifest({
    serviceId: 'eshkol',
    workerModule: '/workers/eshkol.service.worker.js',
    serviceAssets: assets
  });
  const requests = [];
  const probe = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async (url) => {
      requests.push(url);
      return fakeResponse({
        status: 200,
        contentType: url.endsWith('.wasm') ? 'application/wasm' : 'application/json'
      });
    }
  });

  assert.equal(probe.status, 'ready');
  assert.deepEqual(requests, [
    'https://ulg.local/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm',
    'https://ulg.local/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.ulg.json',
    'https://ulg.local/service-assets/eshkol/closures/magnetar-closure/schemas/ulg/closure_artifact.schema.json',
    'https://ulg.local/service-assets/eshkol/closures/magnetar-closure/ulg_bundle_manifest.json'
  ]);
  assert.deepEqual(
    probe.assets.map((asset) => [asset.kind, asset.expected, asset.status]),
    [
      ['wasmModule', 'application/wasm', 'ready'],
      ['artifactModule', 'json', 'ready'],
      ['schemaModule', 'json', 'ready'],
      ['bundleManifest', 'json', 'ready']
    ]
  );
});

test('Eshkol hello closure bundle asset spec points at smoke output-semantics assets', () => {
  const assets = createEshkolClosureBundleAssetSpec({ bundleName: 'hello' });

  assert.equal(assets.baseUrl, '/service-assets/eshkol/closures/hello/');
  assert.equal(assets.artifactModule, '/service-assets/eshkol/closures/hello/hello.ulg.json');
  assert.equal(assets.wasmModule, '/service-assets/eshkol/closures/hello/hello.wasm');
  assert.equal(assets.schemaModule, '/service-assets/eshkol/closures/hello/schemas/ulg/closure_artifact.schema.json');
  assert.equal(assets.bundleManifest, '/service-assets/eshkol/closures/hello/ulg_bundle_manifest.json');
  assert.deepEqual(assets.required, [
    'artifactModule',
    'wasmModule',
    'schemaModule',
    'bundleManifest'
  ]);
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
        contentType: contentTypeForMoonLabAsset(url)
      });
    }
  });

  assert.equal(probe.status, 'ready');
  assert.deepEqual(requests, [
    'https://ulg.local/service-assets/moonlab/moonlab.js',
    'https://ulg.local/service-assets/moonlab/moonlab.wasm',
    'https://ulg.local/service-assets/moonlab/magnetar-reference-contracts.json',
    'https://ulg.local/service-assets/moonlab/webgpu-complex64-parity-scope.json'
  ]);
  assert.deepEqual(
    probe.assets.map((asset) => [asset.kind, asset.expected, asset.status, asset.required]),
    [
      ['loaderModule', 'javascript', 'ready', true],
      ['wasmModule', 'application/wasm', 'ready', true],
      ['referenceContractModule', 'json', 'ready', false],
      ['webGpuParityScopeModule', 'json', 'ready', false]
    ]
  );
  assert.equal(probe.locateFile.resolved, 'https://ulg.local/service-assets/moonlab/moonlab.wasm');
});

test('service asset probe treats the MoonLab reference contract JSON as optional', async () => {
  const assets = createMoonLabServiceAssetSpec();
  const manifest = createUlgServiceManifest({
    serviceId: 'moonlab',
    runtime: 'wasm',
    workerModule: '/workers/moonlab.service.worker.js',
    serviceAssets: assets
  });
  const probe = await probeManifestServiceAssets(manifest, {
    locationHref: 'https://ulg.local/demo/',
    fetchImpl: async (url) => fakeResponse({
      status: url.endsWith('magnetar-reference-contracts.json') ? 404 : 200,
      contentType: contentTypeForMoonLabAsset(url)
    })
  });

  assert.equal(probe.status, 'ready');
  assert.equal(probe.reason, 'all required service assets are fetchable');
  const referenceAsset = probe.assets.find((asset) => asset.kind === 'referenceContractModule');
  assert.equal(referenceAsset.status, 'missing');
  assert.equal(referenceAsset.required, false);
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

function contentTypeForMoonLabAsset(url) {
  if (url.endsWith('.wasm')) return 'application/wasm';
  if (url.endsWith('.json')) return 'application/json';
  return 'text/javascript';
}

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
