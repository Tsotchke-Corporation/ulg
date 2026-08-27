import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyRouteCacheHeaders,
  createRemoteDevCacheEpoch,
  getCacheControl,
  isRemoteDevCachePath,
  mergeVaryHeader,
  resolveRemoteDevCacheEnabled
} from '../vite.config.mjs';

function fakeResponse() {
  const headers = new Map();
  return {
    headers,
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
      return this;
    }
  };
}

function installMiddleware(options = {}) {
  let middleware = null;
  applyRouteCacheHeaders({
    middlewares: {
      use(value) {
        middleware = value;
      }
    }
  }, options);
  assert.equal(typeof middleware, 'function');
  return middleware;
}

test('remote Vite cache classifies app modules and immutable-by-epoch data routes', () => {
  for (const pathname of [
    '/src/main.js',
    '/ulg-gpu-abi/src/wgsl.js',
    '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/index.js',
    '/@id/__x00__virtual:module',
    '/node_modules/.vite/deps/three.js',
    '/data/material-properties/elements.json',
    '/plan/background-1.jpg'
  ]) {
    assert.equal(isRemoteDevCachePath(pathname), true, pathname);
  }
  assert.equal(isRemoteDevCachePath('/'), false);
  assert.equal(isRemoteDevCachePath('/@vite/client'), false);
  assert.equal(isRemoteDevCachePath('/api/private-state'), false);
  assert.equal(isRemoteDevCachePath('/plan/log.md'), false);

  assert.equal(
    getCacheControl('/src/main.js', {
      enableRemoteDevCache: true,
      remoteCacheControl: 'private, max-age=60, immutable'
    }),
    'private, max-age=60, immutable'
  );
  assert.equal(getCacheControl('/src/main.js'), null);
  assert.equal(getCacheControl('/'), 'no-cache');
  assert.match(getCacheControl('/service-assets/moonlab/moonlab.wasm'), /max-age=86400/);
});

test('remote Vite cache is disabled by default and requires an explicit opt-in', () => {
  assert.equal(resolveRemoteDevCacheEnabled(), false);
  assert.equal(resolveRemoteDevCacheEnabled('0'), false);
  assert.equal(resolveRemoteDevCacheEnabled('true'), false);
  assert.equal(resolveRemoteDevCacheEnabled('1'), true);

  const middleware = installMiddleware({ secureCookie: true });
  const htmlResponse = fakeResponse();
  middleware({
    url: '/?scenario=sodium-water',
    headers: { cookie: 'ulg_vite_cache_epoch=old-epoch' }
  }, htmlResponse, () => {});

  assert.equal(htmlResponse.getHeader('cache-control'), 'no-cache');
  assert.deepEqual(htmlResponse.getHeader('set-cookie'), [
    'ulg_vite_cache_epoch=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure'
  ]);

  const moduleResponse = fakeResponse();
  middleware({
    url: '/src/main.js',
    headers: { cookie: 'ulg_vite_cache_epoch=old-epoch' }
  }, moduleResponse, () => {});
  assert.equal(moduleResponse.getHeader('cache-control'), undefined);
  assert.equal(moduleResponse.getHeader('set-cookie'), undefined);
});

test('remote Vite cache epoch rotates and Vary fields remain de-duplicated', () => {
  const epoch = createRemoteDevCacheEpoch({ bootId: 'test-boot' });
  assert.equal(epoch.current(), 'test-boot-0');
  assert.equal(epoch.rotate(), 'test-boot-1');
  assert.equal(epoch.current(), 'test-boot-1');
  assert.equal(
    mergeVaryHeader('Origin', 'Cookie', 'origin, Accept-Encoding'),
    'Origin, Cookie, Accept-Encoding'
  );
});

test('remote Vite cache middleware overrides Vite no-cache and partitions by epoch cookie', () => {
  const epoch = createRemoteDevCacheEpoch({ bootId: 'middleware' });
  const middleware = installMiddleware({
    enableRemoteDevCache: true,
    remoteCacheControl: 'private, max-age=60, immutable',
    cacheEpoch: epoch,
    secureCookie: true,
    cacheCookieMaxAgeSeconds: 60
  });
  const response = fakeResponse();
  let continued = false;
  middleware({
    url: '/src/main.js?t=123',
    headers: { cookie: 'unrelated=1' }
  }, response, () => {
    continued = true;
  });

  assert.equal(continued, true);
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Vary', 'Origin');
  assert.equal(
    response.getHeader('cache-control'),
    'private, max-age=60, immutable'
  );
  assert.equal(response.getHeader('vary'), 'Cookie, Origin');
  assert.deepEqual(response.getHeader('set-cookie'), [
    'ulg_vite_cache_epoch=middleware-0; Path=/; Max-Age=60; SameSite=Lax; Secure'
  ]);

  const matchingResponse = fakeResponse();
  middleware({
    url: '/src/main.js',
    headers: { cookie: 'ulg_vite_cache_epoch=middleware-0' }
  }, matchingResponse, () => {});
  assert.equal(matchingResponse.getHeader('set-cookie'), undefined);
});

test('remote Vite cache publishes the epoch on uncached HTML before modules load', () => {
  const middleware = installMiddleware({
    enableRemoteDevCache: true,
    cacheEpoch: createRemoteDevCacheEpoch({ bootId: 'html' }),
    cacheCookieMaxAgeSeconds: 60
  });
  const response = fakeResponse();
  middleware({ url: '/?scenario=magnetar', headers: {} }, response, () => {});

  assert.equal(response.getHeader('cache-control'), 'no-cache');
  assert.equal(response.getHeader('vary'), undefined);
  assert.deepEqual(response.getHeader('set-cookie'), [
    'ulg_vite_cache_epoch=html-0; Path=/; Max-Age=60; SameSite=Lax'
  ]);
});
