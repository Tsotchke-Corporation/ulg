import { defineConfig } from 'vite';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
// Sibling repos live next to the MAIN checkout. Git worktrees sit at
// .claude/worktrees/<agent>/ (three levels below the main root), so the
// config-relative '../' lookup misses there and the /@fs allow list silently
// dropped peercompute — the resident authority host then failed to
// initialize in every worktree-served dev server, which poisoned the
// host-dependent e2e gates with environment (not product) failures.
// Resolve to a real path so vite's fs.allow prefix check matches the
// canonical /@fs module URLs.
const siblingRoot = (relativePath) => {
  for (const base of ['../', '../../../../']) {
    const candidate = fileURLToPath(new URL(base + relativePath, import.meta.url));
    if (existsSync(candidate)) {
      return realpathSync(candidate);
    }
  }
  return fileURLToPath(new URL('../' + relativePath, import.meta.url));
};
const peercomputeRoot = siblingRoot('peercompute/peercompute');
const webGpuMarchingCubesRoot = siblingRoot('webgpu-marching-cubes');
const localHttpsKeyPath = fileURLToPath(new URL('./.cache/vite-https/key.pem', import.meta.url));
const localHttpsCertPath = fileURLToPath(new URL('./.cache/vite-https/cert.pem', import.meta.url));
// The dev server is deliberately reachable through this machine's tailnet
// name. Vite validates WebSocket Host headers separately from normal page
// requests; without this exact allowlist entry the initial remote HMR socket
// gets a 400, then Vite falls back to `localhost` (the *client* device on a
// phone), leaving that page unable to receive live fixes.
const vpnDevHost = String(
  process.env.ULG_VITE_VPN_HOST || 'dadbox.tail5c077c.ts.net'
).trim().toLowerCase();
// `server.host` controls where Vite listens, but it does not tell a remote
// browser where its HMR socket lives.  With an HTTPS tailnet server Vite's
// default direct-socket fallback is `localhost`, which means *the phone*, not
// this machine.  Keep the port configurable for alternate local HTTPS runs,
// while making the established VPN server unambiguous by default.
const vpnHmrClientPort = Number.parseInt(
  String(process.env.ULG_VITE_HMR_CLIENT_PORT || process.env.ULG_VITE_PORT || '5174'),
  10
);
const vpnHttpsHmr = process.env.ULG_VITE_HTTPS === '1' && vpnDevHost
  ? {
    protocol: 'wss',
    host: vpnDevHost,
    clientPort: Number.isSafeInteger(vpnHmrClientPort) && vpnHmrClientPort > 0
      ? vpnHmrClientPort
      : 5174
  }
  : undefined;
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
  worker: {
    // Every runtime worker is constructed as a module worker. The ULG runtime
    // reaches code-split SPH modules, which cannot be emitted as one IIFE.
    format: 'es'
  },
  server: {
    https: resolveLocalHttpsConfig(),
    // Keep this narrow rather than setting `allowedHosts: true`: the exact
    // tailnet name is enough for VPN HMR while preserving Vite's DNS-rebind
    // protection for arbitrary Host headers.
    allowedHosts: vpnDevHost ? [vpnDevHost] : [],
    // Explicitly publish the tailnet HMR endpoint for HTTPS development. This
    // suppresses Vite's unusable `localhost` fallback on a remote device.
    hmr: vpnHttpsHmr,
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
