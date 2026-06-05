const JAVASCRIPT_MIME_MARKERS = ['javascript', 'ecmascript'];
const WASM_MIME = 'application/wasm';

export async function probeManifestServiceAssets(manifest, {
  fetchImpl = globalThis.fetch,
  locationHref = globalThis.location?.href ?? 'http://localhost/'
} = {}) {
  const serviceId = manifest?.serviceId ?? 'unknown';
  const entry = manifest?.entry ?? {};
  const serviceAssets = entry.serviceAssets ?? {};
  const checks = buildAssetChecks({ serviceId, entry, serviceAssets, locationHref });

  if (checks.length === 0) {
    return {
      serviceId,
      status: 'skipped',
      reason: 'manifest does not declare browser service assets',
      checkedAt: new Date().toISOString(),
      assets: []
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      serviceId,
      status: 'unavailable',
      reason: 'fetch is unavailable in this runtime',
      checkedAt: new Date().toISOString(),
      assets: checks.map(({ kind, url, expected }) => ({
        kind,
        url,
        expected,
        status: 'unavailable'
      }))
    };
  }

  const assets = await Promise.all(checks.map((check) => probeAsset(check, fetchImpl)));
  const status = summarizeStatus(assets);

  return {
    serviceId,
    status,
    reason: status === 'ready' ? 'all declared service assets are fetchable' : 'one or more service assets failed readiness checks',
    checkedAt: new Date().toISOString(),
    baseUrl: toAbsoluteUrl(serviceAssets.baseUrl, locationHref),
    locateFile: createLocateFileProbe({ serviceAssets, entry, locationHref }),
    assets
  };
}

export function createMoonLabLocateFile({
  baseUrl = '/service-assets/moonlab/',
  wasmModule,
  wasmFile = 'moonlab.wasm',
  locationHref = globalThis.location?.href ?? 'http://localhost/'
} = {}) {
  const resolvedBase = ensureTrailingSlash(toAbsoluteUrl(baseUrl, locationHref));
  const resolvedWasm = wasmModule ? toAbsoluteUrl(wasmModule, locationHref) : toAbsoluteUrl(wasmFile, resolvedBase);

  return (path) => {
    const fileName = String(path).split('/').pop();
    if (fileName === wasmFile) {
      return resolvedWasm;
    }
    return toAbsoluteUrl(path, resolvedBase);
  };
}

function buildAssetChecks({ serviceId, entry, serviceAssets, locationHref }) {
  const checks = [];
  const loaderModule = serviceAssets.loaderModule ?? entry.loaderModule;
  const wasmModule = serviceAssets.wasmModule ?? entry.wasmModule;
  const locateFile = createMoonLabLocateFile({
    baseUrl: serviceAssets.baseUrl,
    wasmModule,
    wasmFile: serviceAssets.locateFileProbe,
    locationHref
  });

  if (loaderModule) {
    checks.push({
      serviceId,
      kind: 'loaderModule',
      url: toAbsoluteUrl(loaderModule, locationHref),
      expected: 'javascript'
    });
  }

  if (wasmModule) {
    checks.push({
      serviceId,
      kind: 'wasmModule',
      url: toAbsoluteUrl(wasmModule, locationHref),
      expected: WASM_MIME
    });
  } else if (serviceAssets.locateFileProbe) {
    checks.push({
      serviceId,
      kind: 'wasmModule',
      url: locateFile(serviceAssets.locateFileProbe),
      expected: WASM_MIME
    });
  }

  return checks;
}

function createLocateFileProbe({ serviceAssets, entry, locationHref }) {
  if (!serviceAssets.locateFileProbe) {
    return null;
  }

  const locateFile = createMoonLabLocateFile({
    baseUrl: serviceAssets.baseUrl,
    wasmModule: serviceAssets.wasmModule ?? entry.wasmModule,
    wasmFile: serviceAssets.locateFileProbe,
    locationHref
  });

  return {
    input: serviceAssets.locateFileProbe,
    resolved: locateFile(serviceAssets.locateFileProbe)
  };
}

async function probeAsset(check, fetchImpl) {
  try {
    const response = await fetchImpl(check.url, { method: 'GET', cache: 'no-store' });
    const contentType = normalizeContentType(response.headers?.get?.('content-type'));
    const status = classifyResponse(response, contentType, check.expected);
    return {
      serviceId: check.serviceId,
      kind: check.kind,
      url: check.url,
      expected: check.expected,
      status,
      httpStatus: response.status,
      contentType
    };
  } catch (error) {
    return {
      serviceId: check.serviceId,
      kind: check.kind,
      url: check.url,
      expected: check.expected,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function classifyResponse(response, contentType, expected) {
  if (!response.ok) {
    return response.status === 404 ? 'missing' : 'error';
  }
  if (contentType === 'text/html' && expected !== 'text/html') {
    return 'missing';
  }
  if (!matchesExpectedMime(contentType, expected)) {
    return 'mime-mismatch';
  }
  return 'ready';
}

function matchesExpectedMime(contentType, expected) {
  if (!expected) {
    return true;
  }
  if (expected === 'javascript') {
    return JAVASCRIPT_MIME_MARKERS.some((marker) => contentType.includes(marker));
  }
  return contentType === expected;
}

function summarizeStatus(assets) {
  if (assets.every((asset) => asset.status === 'ready')) {
    return 'ready';
  }
  if (assets.some((asset) => asset.status === 'missing')) {
    return 'missing';
  }
  if (assets.some((asset) => asset.status === 'mime-mismatch')) {
    return 'mime-mismatch';
  }
  return 'error';
}

function normalizeContentType(contentType) {
  return String(contentType ?? '').split(';')[0].trim().toLowerCase();
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function toAbsoluteUrl(value, base) {
  if (!value) {
    return undefined;
  }
  return new URL(value, base).href;
}
