import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const peercomputeRoot = fileURLToPath(new URL('../peercompute/peercompute', import.meta.url));
const webGpuMarchingCubesRoot = fileURLToPath(new URL('../webgpu-marching-cubes', import.meta.url));
const localHttpsKeyPath = fileURLToPath(new URL('./.cache/vite-https/key.pem', import.meta.url));
const localHttpsCertPath = fileURLToPath(new URL('./.cache/vite-https/cert.pem', import.meta.url));
const HASHED_BUILD_ASSET_PATH = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const STABLE_ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const HTML_CACHE = 'no-cache';

function getCacheControl(pathname) {
  if (HASHED_BUILD_ASSET_PATH.test(pathname)) {
    return IMMUTABLE_CACHE;
  }
  if (pathname.startsWith('/service-assets/') || pathname.startsWith('/workers/')) {
    return STABLE_ASSET_CACHE;
  }
  if (pathname === '/' || pathname.endsWith('.html')) {
    return HTML_CACHE;
  }
  return null;
}

function applyRouteCacheHeaders(server) {
  server.middlewares.use((request, response, next) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const cacheControl = getCacheControl(pathname);
    if (!cacheControl) {
      next();
      return;
    }

    const setHeader = response.setHeader.bind(response);
    response.setHeader = (name, value) => {
      if (String(name).toLowerCase() === 'cache-control') {
        return setHeader(name, cacheControl);
      }
      return setHeader(name, value);
    };
    response.setHeader('Cache-Control', cacheControl);
    next();
  });
}

function routeCacheHeadersPlugin() {
  return {
    name: 'ulg-route-cache-headers',
    configureServer: applyRouteCacheHeaders,
    configurePreviewServer: applyRouteCacheHeaders
  };
}

function resolveLocalHttpsConfig() {
  if (process.env.ULG_VITE_HTTPS !== '1') return undefined;
  if (!existsSync(localHttpsKeyPath) || !existsSync(localHttpsCertPath)) {
    throw new Error(
      `ULG_VITE_HTTPS=1 requires ${localHttpsKeyPath} and ${localHttpsCertPath}`
    );
  }
  return {
    key: readFileSync(localHttpsKeyPath),
    cert: readFileSync(localHttpsCertPath)
  };
}

export default defineConfig({
  plugins: [
    routeCacheHeadersPlugin()
  ],
  server: {
    https: resolveLocalHttpsConfig(),
    // Pre-transform the heavy runtime module graphs at server start: e2e
    // gates dynamically import these mid-test, and a cold transform (or a
    // dep re-optimize storm) can 504 module fetches long enough to exhaust
    // in-page retry budgets.
    warmup: {
      clientFiles: [
        './src/runtime/peercomputeBrowserResidentHost.js',
        './src/runtime/sph/sphMlsMpmGpuStep.js',
        './src/runtime/sph/schroederHierarchyGpu.js',
        './src/runtime/sph/sphMarchingCubesSurfaceAdapter.js',
        './src/visualization/sphPhaseScene.js',
        './src/visualization/sphPhaseDemoMount.js'
      ]
    },
    fs: {
      allow: [
        repoRoot,
        peercomputeRoot,
        webGpuMarchingCubesRoot
      ]
    }
  }
});
