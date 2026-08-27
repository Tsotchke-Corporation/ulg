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
  process.env.ULG_VITE_VPN_HOST || 'shitbox.tail5c077c.ts.net'
).trim().toLowerCase();
// `server.host` controls where Vite listens, but it does not tell a remote
// browser where its HMR socket lives.  With an HTTPS tailnet server Vite's
// default direct-socket fallback is `localhost`, which means *the phone*, not
// this machine.  Keep the port configurable for alternate local HTTPS runs,
// while making the established VPN server unambiguous by default.
const vpnHmrClientPort = Number.parseInt(
  String(process.env.ULG_VITE_HMR_CLIENT_PORT || process.env.ULG_VITE_PORT || '5173'),
  10
);
const vpnHttpsHmr = process.env.ULG_VITE_HTTPS === '1' && vpnDevHost
  ? {
    protocol: 'wss',
    host: vpnDevHost,
    clientPort: Number.isSafeInteger(vpnHmrClientPort) && vpnHmrClientPort > 0
      ? vpnHmrClientPort
      : 5173
  }
  : undefined;
const HASHED_BUILD_ASSET_PATH = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const STABLE_ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const HTML_CACHE = 'no-cache';
const REMOTE_DEV_CACHE_COOKIE = 'ulg_vite_cache_epoch';
const DEFAULT_REMOTE_DEV_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Correctness-first default: HTTPS/Tailscale access alone must never enable
// immutable development modules. Opt in only for deliberate bandwidth tests.
export function resolveRemoteDevCacheEnabled(value) {
  return value === '1';
}

const remoteDevCacheEnabled = resolveRemoteDevCacheEnabled(
  process.env.ULG_VITE_REMOTE_CACHE
);
const remoteDevCacheMaxAgeSeconds = positiveInteger(
  process.env.ULG_VITE_REMOTE_CACHE_MAX_AGE_SECONDS,
  DEFAULT_REMOTE_DEV_CACHE_MAX_AGE_SECONDS
);
const remoteDevCacheControl =
  `private, max-age=${remoteDevCacheMaxAgeSeconds}, immutable`;

export function isRemoteDevCachePath(pathname) {
  return pathname.startsWith('/src/')
    || pathname.startsWith('/ulg-gpu-abi/')
    || pathname.startsWith('/@fs/')
    || pathname.startsWith('/@id/')
    || pathname.startsWith('/node_modules/.vite/deps/')
    || pathname.startsWith('/data/')
    || /^\/plan\/background-[^/]+\.(?:avif|jpe?g|png|webp)$/i.test(pathname);
}

export function mergeVaryHeader(...values) {
  const names = new Map();
  for (const value of values.flat()) {
    for (const name of String(value ?? '').split(',')) {
      const trimmed = name.trim();
      if (trimmed && !names.has(trimmed.toLowerCase())) {
        names.set(trimmed.toLowerCase(), trimmed);
      }
    }
  }
  return [...names.values()].join(', ');
}

function cookieValue(cookieHeader, name) {
  for (const pair of String(cookieHeader ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

export function createRemoteDevCacheEpoch({
  bootId = `${Date.now().toString(36)}-${process.pid.toString(36)}`
} = {}) {
  let generation = 0;
  return {
    current() {
      return `${bootId}-${generation.toString(36)}`;
    },
    rotate() {
      generation += 1;
      return this.current();
    }
  };
}

export function getCacheControl(pathname, {
  enableRemoteDevCache = false,
  remoteCacheControl = remoteDevCacheControl
} = {}) {
  if (enableRemoteDevCache && isRemoteDevCachePath(pathname)) {
    return remoteCacheControl;
  }

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

export function applyRouteCacheHeaders(server, {
  enableRemoteDevCache = false,
  remoteCacheControl = remoteDevCacheControl,
  cacheEpoch = createRemoteDevCacheEpoch(),
  secureCookie = false,
  cacheCookieMaxAgeSeconds = remoteDevCacheMaxAgeSeconds
} = {}) {
  server.middlewares.use((request, response, next) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const htmlRequest = pathname === '/' || pathname.endsWith('.html');
    const remoteCacheable = enableRemoteDevCache && isRemoteDevCachePath(pathname);
    const epochCarrier = enableRemoteDevCache && htmlRequest;
    const cacheControl = getCacheControl(pathname, {
      enableRemoteDevCache,
      remoteCacheControl
    });
    if (!cacheControl) {
      next();
      return;
    }

    const setHeader = response.setHeader.bind(response);
    response.setHeader = (name, value) => {
      const normalizedName = String(name).toLowerCase();
      if (normalizedName === 'cache-control') {
        return setHeader(name, cacheControl);
      }
      if (remoteCacheable && normalizedName === 'vary') {
        return setHeader(
          name,
          mergeVaryHeader(response.getHeader?.('Vary'), value, 'Cookie')
        );
      }
      return setHeader(name, value);
    };
    response.setHeader('Cache-Control', cacheControl);
    if (remoteCacheable) {
      response.setHeader(
        'Vary',
        mergeVaryHeader(response.getHeader?.('Vary'), 'Cookie')
      );
    }
    if (remoteCacheable || epochCarrier) {
      const epoch = cacheEpoch.current();
      if (cookieValue(request.headers?.cookie, REMOTE_DEV_CACHE_COOKIE) !== epoch) {
        const cookie = [
          `${REMOTE_DEV_CACHE_COOKIE}=${epoch}`,
          'Path=/',
          `Max-Age=${cacheCookieMaxAgeSeconds}`,
          'SameSite=Lax',
          ...(secureCookie ? ['Secure'] : [])
        ].join('; ');
        const existing = response.getHeader?.('Set-Cookie');
        const cookies = Array.isArray(existing)
          ? [...existing, cookie]
          : (existing ? [existing, cookie] : [cookie]);
        setHeader('Set-Cookie', cookies);
      }
    } else if (
      htmlRequest
      && cookieValue(request.headers?.cookie, REMOTE_DEV_CACHE_COOKIE) !== null
    ) {
      // Default-off runs must also stop matching immutable module responses
      // cached by an earlier opt-in session. Removing the epoch partition on
      // the revalidated HTML response does that before module imports begin.
      const cookie = [
        `${REMOTE_DEV_CACHE_COOKIE}=`,
        'Path=/',
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'SameSite=Lax',
        ...(secureCookie ? ['Secure'] : [])
      ].join('; ');
      const existing = response.getHeader?.('Set-Cookie');
      const cookies = Array.isArray(existing)
        ? [...existing, cookie]
        : (existing ? [existing, cookie] : [cookie]);
      setHeader('Set-Cookie', cookies);
    }
    next();
  });
}

function routeCacheHeadersPlugin({
  enableRemoteDevCache = remoteDevCacheEnabled
} = {}) {
  const cacheEpoch = createRemoteDevCacheEpoch();
  return {
    name: 'ulg-route-cache-headers',
    configureServer(server) {
      applyRouteCacheHeaders(server, {
        enableRemoteDevCache,
        cacheEpoch,
        secureCookie: process.env.ULG_VITE_HTTPS === '1'
      });
    },
    configurePreviewServer(server) {
      applyRouteCacheHeaders(server);
    },
    handleHotUpdate() {
      if (enableRemoteDevCache) cacheEpoch.rotate();
    }
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
