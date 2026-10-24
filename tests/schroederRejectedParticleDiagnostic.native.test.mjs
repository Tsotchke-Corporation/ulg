import assert from 'node:assert/strict';
import test from 'node:test';

test('native rejected-particle gather covers remapped contributors, raw folds and fail-closed provenance', {
  skip: process.env.ULG_RUN_NATIVE_REJECTED_PARTICLE === '1' ? false : 'set ULG_RUN_NATIVE_REJECTED_PARTICLE=1',
  timeout: 180_000
}, async t => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('/package.json', process.env.ULG_REJECTED_PARTICLE_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    result = await page.evaluate(async () => {
      const module = await import('/src/runtime/sph/schroederRejectedParticleDiagnosticGpu.js');
      const fieldModule = await import('/src/runtime/sph/schroederRejectedFieldDiagnosticGpu.js');
      const { createSchroederSpatialMechanicsFieldViewLayout } = await import('/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js');
      const { createSchroederSpatialActiveSourceViewLayout } = await import('/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js');
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const errors = [], results = [];
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      try {
        const compilation = await device.createShaderModule({ code: module.schroederRejectedParticleDiagnosticWgsl }).getCompilationInfo();
        const compileErrors = compilation.messages.filter(m => m.type === 'error').map(m => m.message);
        if (compileErrors.length) return { status: 'compile-failed', compileErrors };
        const variants = ['affine', 'many-contributors', 'raw-fold', 'deformation-disabled', 'solid-pressure-off',
          'none', 'source-epoch', 'reverse-map', 'source-seal', 'field-completion', 'rejection-tag',
          'missing-positive-node', 'pressure-invalid', 'field-nonfinite', 'input-F-nonfinite',
          'rejected-field-state', 'clipped-support', 'zero-contributors', 'dt-mismatch', 'field-layout',
          'grid-overflow-xy', 'grid-overflow-xyz', 'padded-capacity', 'legacy-receipt-gap'];
        for (const variant of variants) {
          const count = variant === 'many-contributors' ? 70 : 3;
          const members = variant === 'many-contributors'
            ? Array.from({ length: 65 }, (_, i) => 64 - i) : [2, 0];
          const h = 0.25, dt = 0.01, pressureScale = 0.5;
          const liquid = variant === 'deformation-disabled';
          const internalPressureScale = liquid || variant === 'solid-pressure-off' ? 0 : 1;
          const phase = liquid ? 2 : 1;
          const dim = variant === 'clipped-support' ? 5 : 6;
          const physicalPosition = [0.8125, 0.8125, 0.8125];
          const diagonal = variant === 'raw-fold' ? [-200, 1, 1.5] : [0.5, 1, 1.5];
          const sourceCapacity = count + (variant === 'padded-capacity' ? 5 : 0);
          const fieldCapacity = variant === 'padded-capacity' ? 35 : 27;
          const layout = createSchroederSpatialMechanicsFieldViewLayout({ sourceCapacity, fieldCapacity });
          // Keep a negative fixture for the former self-consistent but invented
          // 64-word receipt arena. Positive fixtures use only the real ABI.
          const extraReceiptWords = variant === 'legacy-receipt-gap' ? 64 - layout.receiptControlWords : 0;
          const field = new Uint32Array(layout.wordLength + extraReceiptWords), f = new Float32Array(field.buffer);
          const descriptorOffset = layout.descriptorOffsetWords, keyOffset = layout.keyOffsetWords;
          const accumulatorOffset = layout.accumulatorOffsetWords;
          const stateOffset = layout.stateOffsetWords + extraReceiptWords;
          const pressureOffset = layout.pressureOffsetWords + extraReceiptWords;
          field.set([0x53464635, 5, variant === 'rejected-field-state' ? 7 : 3, 7, 4, 5, 6, 7]);
          field.set([11, 12, 13, 14, 15, 16, 17, 18], 8);
          field[16] = count; field[17] = 0; field[18] = dim ** 3;
          field.set([dim, dim, dim, 1], 19); f[23] = h;
          field[24] = descriptorOffset; field[25] = layout.descriptorWords; field[26] = keyOffset; field[27] = layout.keyWords;
          field[28] = accumulatorOffset; field[29] = layout.accumulatorWords;
          field[30] = stateOffset; field[31] = layout.stateWords; field[32] = layout.fieldCapacity; field[34] = 27;
          field[38] = 9; field[42] = field.length; field[59] = 2; field[63] = 2;
          const state = new Float32Array(count * 8), mechanics = new Float32Array(count * 32);
          for (const p of members) {
            field.set([phase, 55, 2, 1], descriptorOffset + p * 32);
            field.set(Array.from({ length: 27 }, (_, i) => i), descriptorOffset + p * 32 + 4);
            state.set([...physicalPosition, 1, 9, 8, 7, 100], p * 8);
            const inputF = p === 0 ? [2,0.2,0,0,3,0.1,0,0,4] : [1,0,0,0,0.5,0,0,0,1.5];
            mechanics.set(inputF, p * 32); mechanics.fill(123, p * 32 + 9, p * 32 + 18);
            mechanics[p * 32 + 18] = p === 0 ? 24 : 0.75;
            mechanics[p * 32 + 20] = liquid ? 0 : 1; mechanics[p * 32 + 26] = liquid ? 1 : 2;
          }
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
            const i = a * 9 + b * 3 + c, nodes = [2 + a, 2 + b, 2 + c];
            const node = ((nodes[0] + 1) * dim + nodes[1] + 1) * dim + nodes[2] + 1;
            field.set([node, phase, 55, 2], keyOffset + i * 4);
            const v = nodes.map((coordinate, axis) => axis + 1 + diagonal[axis] * (coordinate * h - physicalPosition[axis]));
            f.set([1, ...v, 0, 0, 0], stateOffset + i * 8); field[stateOffset + i * 8 + 7] = 1;
            f.set([100, 1, 100], pressureOffset + i * 4); field[pressureOffset + i * 4 + 3] = 2;
          }
          const activeLayout = createSchroederSpatialActiveSourceViewLayout({ physicalSourceCapacity: sourceCapacity, activeSourceCapacity: count });
          const active = new Uint32Array(activeLayout.wordLength);
          active.set(field.subarray(0, 16)); active[0] = 0x53535631; active[1] = 1; active[2] = 3;
          active.set([count, sourceCapacity, members.length, count, count - members.length, 0, 0, 1, 16,
            activeLayout.activeToPhysicalOffsetWords, activeLayout.physicalToActiveOffsetWords, active.length], 16);
          active[29] = 9; active[30] = 9; active[31] = 123;
          active[32] = count; active[33] = members.length; active[34] = members.length; active[35] = members.length;
          active.fill(0xffffffff, active[26]); active.set(members, 64);
          members.forEach((p, ordinal) => { active[active[26] + p] = ordinal; });
          active[47] = [25,26,27,18,20,30].reduce((seal, index) => Math.imul(seal ^ active[index], 0x01000193) >>> 0, active[31]);
          const moment = new Uint32Array(27 * 12), mf = new Float32Array(moment.buffer);
          moment.set(field.subarray(keyOffset, keyOffset + 4)); mf.set([1, 0.01, 0.02, 0.03], 4);
          moment[8] = 1; moment[9] = 3;
          const control = new Uint32Array(64); control.set([0x53505631, 1, 3, 7]);
          control.set(field.subarray(8, 16), 8); control[18] = 27; control[20] = 0; control[23] = 9; control[29] = 12;
          const reflux = new Uint32Array(136); reflux.set([0x53524c33, 3, 39]);
          reflux[7] = 23; reflux[82] = 23; reflux[83] = 29; reflux[124] = 0xc7000000;
          const scratch = new Uint32Array(12 + fieldCapacity * 12), sf = new Float32Array(scratch.buffer);
          scratch.set([0x53425031, 1, 0, fieldCapacity, 7, 9, 17, 12, 27, 0x53424631, 0x53425331]);
          scratch[11] = [0,1,3,4,5,6,7].reduce((seal, i) => seal ^ scratch[i], 0);
          sf.set([...f.subarray(stateOffset + 1, stateOffset + 4), 0.1, 0.2, 0.3, 0.25, 1, 1, 100], 12);
          scratch[22] = 0x53425259; scratch[23] = scratch.slice(12, 22).reduce((seal, x) => seal ^ x, scratch[22]);
          if (variant === 'none') reflux[124] = 0xffffffff;
          if (variant === 'source-epoch') active[11]++;
          if (variant === 'reverse-map') active[active[26] + 2] = 1;
          if (variant === 'source-seal') active[47]++;
          if (variant === 'field-layout') field[28] = keyOffset;
          if (variant === 'grid-overflow-xy') field.set([65536, 65536, 6], 19);
          if (variant === 'grid-overflow-xyz') field.set([65535, 65535, 2], 19);
          if (variant === 'field-completion') control[23] = 8;
          if (variant === 'rejection-tag') reflux[124] |= 1 << 22;
          if (variant === 'missing-positive-node') field[descriptorOffset + 2 * 32 + 4 + 13] = 0xffffffff;
          if (variant === 'pressure-invalid') field[pressureOffset + 13 * 4 + 3] = 0;
          if (variant === 'field-nonfinite') f[stateOffset + 13 * 8 + 1] = NaN;
          if (variant === 'input-F-nonfinite') mechanics[2 * 32] = Infinity;
          if (variant === 'zero-contributors') for (const p of members) field[descriptorOffset + p * 32 + 4] = 1;
          const owned = [], inputBuffers = [];
          const upload = array => {
            const buffer = device.createBuffer({ size: array.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(buffer, 0, array); owned.push(buffer); inputBuffers.push(buffer); return buffer;
          };
          const encoder = device.createCommandEncoder();
          const fieldBuffer = upload(field), activeSourceBuffer = upload(active), stateBuffer = upload(state), mechanicsBuffer = upload(mechanics);
          const fieldPacket = fieldModule.encodeSchroederRejectedFieldDiagnostic({ device, encoder,
            fieldBuffer, refluxBuffer: upload(reflux), phaseVolumeMoment: { momentBuffer: upload(moment), controlBuffer: upload(control) },
            selectedLevel: 0, generationId: 7,
            refluxIdentity: { completionOrdinal: 23, macroOwnerId: 23, ownerGeneration: 29 },
            scratchCapture: { buffer: upload(scratch), gasExecutionGeneration: 17, fineSubstepOrdinal: 0, dtS: dt, pressureScale } });
          const packet = module.encodeSchroederRejectedParticleDiagnostic({ device, encoder,
            fieldBuffer, fieldDiagnosticBuffer: fieldPacket.buffer, activeSourceBuffer, stateBuffer, mechanicsBuffer,
            particleCount: count, dtS: variant === 'dt-mismatch' ? dt * 2 : dt, pressureScale, internalPressureScale,
            gridSpacingM: h });
          const readback = device.createBuffer({ size: 768, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          try {
            encoder.copyBufferToBuffer(fieldPacket.buffer, 0, readback, 0, 256);
            encoder.copyBufferToBuffer(packet.buffer, 0, readback, 256, 512);
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap();
            results.push({ variant, fieldStatus: fieldModule.decodeSchroederRejectedFieldDiagnostic(words.slice(0,64)).status,
              ...module.decodeSchroederRejectedParticleDiagnostic(words.slice(64)) });
          } catch (error) {
            return { status: 'execution-failed', variant, message: String(error), errors, completedVariants: results.map(row => row.variant) };
          } finally { readback.destroy(); packet.destroy(); fieldPacket.destroy(); owned.forEach(buffer => buffer.destroy()); }
        }
        return { status: 'executed', results, errors, mappedBytesPerCase: 768 };
      } finally { device.destroy(); }
    });
  } finally { await browser.close(); }
  assert.equal(result.status, 'executed', JSON.stringify(result));
  assert.deepEqual(result.errors, []);
  const cases = Object.fromEntries(result.results.map(row => [row.variant, row]));
  for (const name of ['affine','many-contributors','raw-fold','deformation-disabled','solid-pressure-off','rejected-field-state','padded-capacity']) {
    assert.equal(cases[name].status, 'rejected-particle-gather-ready', JSON.stringify(cases[name]));
  }
  const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 2e-4 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
  const affine = cases.affine;
  assert.equal(affine.contributorCount, 2); assert.equal(affine.completeContributorCount, 2);
  assert.equal(affine.minimumRawJ.particleIndex, 2); assert.equal(affine.maximumDisplacement.particleIndex, 0);
  close(affine.minimumRawJ.rawGatherDeterminant, 0.75 * 1.005 * 1.01 * 1.015, 'nonidentity raw J');
  [1,2,3].forEach((v,i) => close(affine.maximumDisplacement.gatheredVelocityMPerS[i], v, `velocity${i}`));
  [0.5,0,0,0,1,0,0,0,1.5].forEach((v,i) => close(affine.minimumRawJ.gatheredAffineCPerS[i], v, `affine${i}`));
  assert.deepEqual(affine.maximumDisplacement.inputF, [2,Math.fround(0.2),0,0,3,Math.fround(0.1),0,0,4]);
  assert.equal(cases['many-contributors'].contributorCount, 65);
  assert.equal(cases['many-contributors'].completeContributorCount, 65);
  assert.equal(cases['many-contributors'].scannedActiveParticleCount, 65);
  assert.equal(cases['many-contributors'].minimumRawJ.particleIndex, 1);
  assert.equal(cases['raw-fold'].rawFoldCount, 2); assert.ok(cases['raw-fold'].minRawGatherDeterminant < 0);
  assert.equal(cases['deformation-disabled'].deformationDisabledCount, 2);
  close(cases['deformation-disabled'].minimumRawJ.effectiveRawDeterminant, 0.75, 'disabled actual F');
  assert.deepEqual(cases['deformation-disabled'].minimumRawJ.effectiveAffineCPerS, Array(9).fill(0));
  assert.equal(cases['solid-pressure-off'].deformationDisabledCount, 0);
  assert.equal(cases['rejected-field-state'].sourceFieldStatusFlags, 7);
  assert.equal(cases.none.status, 'no-cfl-rejection');
  for (const name of ['source-epoch','reverse-map','source-seal','field-layout','legacy-receipt-gap']) assert.equal(cases[name].status, 'particle-source-identity-mismatch', name);
  for (const name of ['field-completion','rejection-tag']) assert.equal(cases[name].status, 'rejection-packet-mismatch', name);
  for (const name of ['missing-positive-node','pressure-invalid','clipped-support']) assert.equal(cases[name].status, 'particle-gather-incomplete', name);
  for (const name of ['field-nonfinite','input-F-nonfinite']) assert.equal(cases[name].status, 'particle-gather-nonfinite', name);
  assert.equal(cases['zero-contributors'].status, 'rejected-field-has-no-particle-contributors');
  assert.equal(cases['dt-mismatch'].status, 'particle-input-invalid');
  for (const name of ['grid-overflow-xy','grid-overflow-xyz']) assert.equal(cases[name].status, 'particle-input-invalid', name);
  t.diagnostic(JSON.stringify({ cases: result.results.length, mappedBytesPerCase: result.mappedBytesPerCase,
    affine, manyContributors: cases['many-contributors'].contributorCount, rawFoldMinimumJ: cases['raw-fold'].minRawGatherDeterminant }));
});
