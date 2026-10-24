import assert from 'node:assert/strict';
import test from 'node:test';

test('native rejected-field gather selects only the exact fine pressure row and rejects stale provenance', {
  skip: process.env.ULG_RUN_NATIVE_REJECTED_FIELD === '1' ? false : 'set ULG_RUN_NATIVE_REJECTED_FIELD=1',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let result;
  try {
    const page = await browser.newPage();
    await page.goto(new URL('/package.json', process.env.ULG_REJECTED_FIELD_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    result = await page.evaluate(async () => {
      const { encodeSchroederRejectedFieldDiagnostic, decodeSchroederRejectedFieldDiagnostic,
        schroederRejectedFieldDiagnosticWgsl } = await import('/src/runtime/sph/schroederRejectedFieldDiagnosticGpu.js');
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
      const module = device.createShaderModule({ code: schroederRejectedFieldDiagnosticWgsl });
      const compileErrors = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error')
        .map((m) => m.message);
      if (compileErrors.length) { device.destroy(); return { status: 'compile-failed', compileErrors }; }
      const variants = ['ready', 'none', 'coarse', 'global', 'successor', 'overflow', 'later-substep',
        'field-generation', 'scratch-completion', 'gas-generation', 'row-seal',
        'moment-key', 'moment-epoch', 'out-of-bounds', 'field-count', 'scratch-absent',
        'stale-macro', 'not-rejected', 'moment-schema', 'moment-status', 'scratch-not-committed', 'scratch-volume'];
      const evidence = [];
      try {
        for (const variant of variants) {
          // Deliberately large arena. Exactly 256 bytes are copied/mapped per
          // execution, independent of capacity; no input arena is downloaded.
          const field = new Uint32Array(262144), f = new Float32Array(field.buffer);
          field.set([0x53464635, 5, 3, 7]); field[17] = 0; field[18] = 100;
          field[23] = new Uint32Array(new Float32Array([0.05]).buffer)[0];
          field[26] = 64; field[27] = 4; field[30] = 128; field[31] = 8;
          field[32] = 2; field[34] = 2; field[38] = 9; field[59] = 2; field[63] = 1;
          field.set([42, 1, 55, 8], 68); f.set([2e-9, 1, 167, 9], 136);
          const moment = new Uint32Array(24), mf = new Float32Array(moment.buffer);
          moment.set([42, 1, 55, 8], 12); mf.set([3e-12, 1e-8, 2e-8, 3e-8], 16);
          moment[20] = 1; moment[21] = 3;
          const control = new Uint32Array(64);
          control.set([0x53505631, 1, 3]);
          control[3] = 7; control[18] = 2; control[20] = 0; control[23] = 9; control[29] = 12;
          const reflux = new Uint32Array(136); reflux[124] = 0xc7000001;
          reflux.set([0x53524c33, 3, 39]); reflux[7] = 23; reflux[82] = 23; reflux[83] = 29;
          const scratch = new Uint32Array(36), sf = new Float32Array(scratch.buffer);
          scratch.set([0x53425031, 1, 0, 2, 7, 9, 17, 12, 2, 0x53424631, 0x53425331]);
          scratch[11] = scratch[0] ^ scratch[1] ^ scratch[3] ^ scratch[4] ^ scratch[5] ^ scratch[6] ^ scratch[7];
          sf.set([1, 167, 9, 4e-8, 5e-8, 6e-8, 0.25, f[136], 3e-12, 2e6], 24);
          scratch[34] = 0x53425259;
          scratch[35] = scratch.slice(24, 34).reduce((a, b) => a ^ b, 1 ^ scratch[34]);
          if (variant === 'none') reflux[124] = 0xffffffff;
          if (variant === 'coarse') reflux[124] |= 1 << 22;
          if (variant === 'global') reflux[124] |= 2 << 22;
          if (variant === 'successor') reflux[124] |= 3 << 22;
          if (variant === 'overflow') reflux[124] |= 1 << 16;
          if (variant === 'later-substep') reflux[8] = 1;
          if (variant === 'field-generation') field[3] = 8;
          if (variant === 'scratch-completion') scratch[5] = 10;
          if (variant === 'gas-generation') scratch[6] = 18;
          if (variant === 'row-seal') scratch[35] ^= 1;
          if (variant === 'moment-key') moment[12] = 41;
          if (variant === 'moment-epoch') control[15] = 1;
          if (variant === 'out-of-bounds') field[26] = 0xfffffff0;
          if (variant === 'field-count') reflux[124] = 0xc7000002;
          if (variant === 'stale-macro') reflux[83] = 28;
          if (variant === 'not-rejected') reflux[2] = 3;
          if (variant === 'moment-schema') control[1] = 0;
          if (variant === 'moment-status') moment[21] = 7;
          if (variant === 'scratch-not-committed') scratch[8] = 1;
          if (variant === 'scratch-volume') {
            sf[32] = 0;
            scratch[35] = scratch.slice(24, 34).reduce((a, b) => a ^ b, 1 ^ scratch[34]);
          }
          const inputs = [];
          const upload = (words) => {
            const b = device.createBuffer({ size: words.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(b, 0, words); inputs.push(b); return b;
          };
          const encoder = device.createCommandEncoder();
          const packet = encodeSchroederRejectedFieldDiagnostic({ device, encoder,
            fieldBuffer: upload(field), refluxBuffer: upload(reflux),
            phaseVolumeMoment: { momentBuffer: upload(moment), controlBuffer: upload(control) },
            selectedLevel: 0, generationId: 7,
            refluxIdentity: { completionOrdinal: 23, macroOwnerId: 23, ownerGeneration: 29 },
            scratchCapture: { buffer: upload(variant === 'scratch-absent' ? new Uint32Array(1) : scratch),
              gasExecutionGeneration: 17, fineSubstepOrdinal: 0, dtS: 0.00025, pressureScale: 0.5 }
          });
          const readback = device.createBuffer({ size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          try {
            encoder.copyBufferToBuffer(packet.buffer, 0, readback, 0, 256);
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            evidence.push({ variant, ...decodeSchroederRejectedFieldDiagnostic(
              new Uint32Array(readback.getMappedRange()).slice()) });
            readback.unmap();
          } finally { readback.destroy(); packet.destroy(); inputs.forEach((b) => b.destroy()); }
        }
        return { status: 'executed', evidence, errors, inputArenaBytes: 1048576, mappedBytesPerCase: 256 };
      } finally { device.destroy(); }
    });
  } finally { await browser.close(); }
  assert.equal(result.status, 'executed', JSON.stringify(result));
  assert.deepEqual(result.errors, []);
  const byName = Object.fromEntries(result.evidence.map((e) => [e.variant, e]));
  assert.equal(byName.ready.status, 'rejected-field-pressure-ready');
  assert.deepEqual(byName.ready.key, [42, 1, 55, 8]);
  assert.equal(byName.ready.fieldIndex, 1);
  assert.equal(byName.ready.availableSections, 7);
  assert.deepEqual(byName.ready.pressure.postGasVelocityMPerS, [1, 167, 9]);
  assert.equal(byName.ready.pressure.effectiveGaugePa, 2e6);
  assert.equal(byName.ready.massKg, Math.fround(2e-9));
  assert.equal(byName.none.status, 'no-cfl-rejection');
  for (const name of ['coarse', 'global', 'successor', 'overflow', 'later-substep', 'stale-macro', 'not-rejected']) {
    assert.equal(byName[name].status, 'unsupported-or-stale-rejection', name);
    assert.equal(byName[name].pressure, null);
  }
  for (const name of ['field-generation', 'field-count']) assert.equal(byName[name].status, 'field-identity-mismatch', name);
  for (const name of ['scratch-completion', 'gas-generation', 'row-seal', 'scratch-not-committed', 'scratch-volume']) assert.equal(byName[name].status, 'pressure-scratch-mismatch', name);
  for (const name of ['moment-key', 'moment-epoch', 'moment-schema', 'moment-status']) assert.equal(byName[name].status, 'moment-identity-mismatch', name);
  assert.equal(byName['out-of-bounds'].status, 'row-out-of-bounds');
  assert.equal(byName['scratch-absent'].status, 'pressure-scratch-unavailable');
  t.diagnostic(JSON.stringify({ cases: result.evidence.length, mappedBytesPerCase: result.mappedBytesPerCase,
    inputArenaBytes: result.inputArenaBytes }));
});
