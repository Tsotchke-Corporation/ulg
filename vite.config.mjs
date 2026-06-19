import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const peercomputeRoot = fileURLToPath(new URL('../peercompute/peercompute', import.meta.url));
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

export default defineConfig({
  plugins: [
    routeCacheHeadersPlugin()
  ],
  server: {
    fs: {
      allow: [
        repoRoot,
        peercomputeRoot
      ]
    }
  }
});
