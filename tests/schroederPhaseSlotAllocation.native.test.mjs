import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_SLOT_ALLOCATION === '1';
const BASE_URL = process.env.ULG_SPLIT_SPARE_SCAN_BASE_URL || 'https://127.0.0.1:5173/';

// Manufactured storage intents, verified on the GPU. No host solver and no
// particle/assignment readback: all cases return one fixed 32-byte receipt.
test('phase-slot allocation retains sources, grants spare ranks, and guards merge retirement', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_PHASE_SLOT_ALLOCATION=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    // Import kernels from Vite without starting the application or its solver.
    const url = new URL('/__phase_slot_allocation_test__', BASE_URL).href;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>GPU storage gate</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const out = await page.evaluate(async () => {
      // A newly launched GPU process can return null on its first request.
      let adapter = null;
      for (let attempt = 0; attempt < 5 && !adapter; attempt++) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const owned = [];
      const errors = [];
      device.addEventListener('uncapturederror', e => errors.push(String(e.error.message)));
      device.pushErrorScope('validation');
      const make = (size, usage, data) => {
        const b = device.createBuffer({ size, usage });
        owned.push(b);
        if (data) device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
      const uniform = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
      try {
        const wgsl = await import('/ulg-gpu-abi/src/wgsl.js');
        const host = await import('/src/runtime/sph/schroederHierarchyGpu.js');
        const scanModule = await import('/src/runtime/sph/schroederSplitSpareLineageScanGpu.js');
        for (const code of [wgsl.schroederParticleStorageAllocationWgsl,
          wgsl.schroederParticleStorageSlotAssignmentWgsl,
          wgsl.schroederParticleStorageMaterializationWgsl,
          scanModule.schroederSplitSpareLineageScanWgsl]) {
          const info = await device.createShaderModule({ code }).getCompilationInfo();
          const bad = info.messages.filter(m => m.type === 'error');
          if (bad.length) throw new Error(bad.map(m => `${m.lineNum}: ${m.message}`).join('\n'));
        }
        const pipeline = code => device.createComputePipeline({
          layout: 'auto', compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
        const allocate = pipeline(wgsl.schroederParticleStorageAllocationWgsl);
        const assign = pipeline(wgsl.schroederParticleStorageSlotAssignmentWgsl);
        const check = pipeline(`
          @group(0) @binding(0) var<storage, read> a: array<f32>;
          @group(0) @binding(1) var<storage, read> slots: array<f32>;
          @group(0) @binding(2) var<storage, read> lineages: array<u32>;
          @group(0) @binding(3) var<storage, read> free_list: array<f32>;
          @group(0) @binding(4) var<storage, read_write> receipt: array<u32>;
          @group(0) @binding(5) var<uniform> config: vec4<u32>;
          fn expect(actual: f32, expected: f32, code: u32) {
            if (actual != expected) {
              receipt[0] += 1u;
              if (receipt[2] == 0u) {
                receipt[2] = config.x + 1u; receipt[3] = code;
                receipt[4] = bitcast<u32>(actual); receipt[5] = bitcast<u32>(expected);
              }
            }
          }
          fn slot(row: u32, column: u32, expected: f32) {
            expect(slots[row * 32u + column], expected, 100u + row * 32u + column);
          }
          @compute @workgroup_size(1) fn main() {
            receipt[1] += 1u;
            let id = config.x;
            let available = config.y;
            expect(free_list[1], f32(available), 1u);
            expect(free_list[2], f32(available), 2u);
            for (var i = 0u; i < 5u; i++) {
              // By construction only lineages 59, 61, and 63 are empty.
              var expected = 0xffffffffu;
              if (i < available) { expected = 59u + 2u * i; }
              if (lineages[i] != expected) { expect(1.0, 0.0, 10u + i); }
            }
            if (id == 3u || id == 5u) {
              // Missing admission, or fixed intents sent to a legacy consumer.
              for (var row = 0u; row < 7u; row++) {
                // The inert singleton action 1 is safe for either consumer.
                if (id == 5u && row >= 5u) { continue; }
                slot(row, 3u, 32.0); slot(row, 9u, -1.0);
                slot(row, 11u, -1.0); slot(row, 12u, 0.0);
              }
              return;
            }
            if (id == 4u) {
              // Legacy mode still replaces sources with delta+1 children.
              expect(a[1u * 32u + 8u], 4.0, 40u);
              expect(a[1u * 32u + 10u], 3.0, 41u);
              expect(a[1u * 32u + 12u], 1.0, 42u);
              slot(0u, 9u, 0.0); slot(0u, 10u, 1.0);
              slot(0u, 11u, 3.0); slot(2u, 11u, 5.0); slot(4u, 11u, 9.0);
              // Remaining 2 spares cannot satisfy this 3-child legacy split.
              slot(1u, 9u, -1.0); slot(1u, 11u, -1.0);
              return;
            }
            // Fixed allocation never consumes a spare for a merge leader.
            if (id == 6u) {
              // GPU-side invalidation of the leader must deny every member.
              slot(0u, 3u, 32.0); slot(2u, 11u, -1.0); slot(4u, 11u, -1.0);
              slot(2u, 12u, 0.0); slot(4u, 12u, 0.0);
            } else {
              slot(0u, 8u, 6.0); slot(0u, 9u, 3.0); slot(0u, 10u, 1.0);
              slot(0u, 11u, -1.0); slot(0u, 12u, 0.0);
              slot(2u, 8u, 7.0); slot(2u, 11u, 5.0); slot(2u, 12u, 1.0);
              slot(4u, 8u, 7.0); slot(4u, 11u, 9.0); slot(4u, 12u, 1.0);
            }
            slot(1u, 8u, 5.0); slot(1u, 10u, 2.0);
            slot(1u, 9u, select(-1.0, 0.0, available >= 2u));
            slot(1u, 11u, -1.0); slot(1u, 12u, 0.0);
            slot(3u, 8u, 5.0); slot(3u, 10u, 1.0);
            slot(3u, 9u, select(-1.0, 2.0, available >= 3u));
            slot(3u, 11u, -1.0); slot(3u, 12u, 0.0);
            slot(5u, 8u, 1.0); slot(5u, 11u, -1.0); slot(5u, 12u, 0.0);
            // A negative delta alone cannot retire a fixed slot.
            slot(6u, 8u, 1.0); slot(6u, 11u, -1.0); slot(6u, 12u, 0.0);
            for (var row = 0u; row < 7u; row++) {
              expect(a[row * 32u + 15u], 0.0, 300u + row);
            }
          }
        `);
        const receipt = make(32, storage);
        const encoder = device.createCommandEncoder();
        const dispatch = (p, buffers) => {
          const group = device.createBindGroup({ layout: p.getBindGroupLayout(0),
            entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
          const pass = encoder.beginComputePass();
          pass.setPipeline(p); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end();
        };
        for (let id = 0; id < 7; id++) {
          const available = id === 1 ? 2 : id === 2 ? 0 : 3;
          const state = new Float32Array(4 * 64 * 8);
          // Reserved pool [59, 64). Invalid negative and NaN masses must
          // never be overwritten, even when the other three lanes are empty.
          state[(64 + 60) * 8 + 3] = -1;
          state[(128 + 62) * 8 + 3] = NaN;
          if (available < 3) state[(192 + 63) * 8 + 3] = 1;
          if (available === 0) {
            state[59 * 8 + 3] = 1; state[(64 + 61) * 8 + 3] = 1;
          }
          const input = make(state.byteLength, storage, state);
          const scan = scanModule.createSchroederSplitSpareLineageScan(device, { spareCount: 5 });
          owned.push(scan.localPrefixBuffer, scan.groupOffsetsBuffer, scan.spareLineagesBuffer,
            scan.freeListBuffer, scan.paramsBuffer);
          scanModule.encodeSchroederSplitSpareLineageScan(device, encoder, {
            scan, stateBuffer: input, lineageCapacity: 64, firstSpareLineage: 59
          });
          const rows = new Float32Array(7 * 32);
          // Interleaved group members, two splits, and an isolated merge row.
          const fixtures = [[3, 2, -2, 8], [12, 4, 2, -1], [5, 2, -2, 8],
            [6, 4, 1, -1], [9, 2, -2, 8], [11, 2, 0, 99], [13, 1, -1, -1]];
          fixtures.forEach(([source, status, delta, group], row) => {
            rows[row * 32] = source; rows[row * 32 + 3] = status;
            rows[row * 32 + 6] = 1; rows[row * 32 + 7] = delta;
            rows[row * 32 + 21] = group;
          });
          const applied = make(rows.byteLength, storage, rows);
          const allocated = make(rows.byteLength, storage);
          const assigned = make(rows.byteLength, storage);
          const ap = host.createSchroederParticleStorageAllocationParamsArray({
            applyRowCount: 7, admissionApproved: id !== 3,
            currentParticleCapacity: 256, requiredParticleCapacity: id === 4 ? 512 : 256,
            preservePhaseSlots: id !== 4
          });
          const sp = host.createSchroederParticleStorageSlotAssignmentParamsArray({
            allocationRowCount: 7, admissionApproved: id !== 3,
            preservePhaseSlots: id !== 4 && id !== 5
          });
          dispatch(allocate, [applied, allocated, make(ap.byteLength, uniform, ap)]);
          if (id === 6) encoder.clearBuffer(allocated, 0, 32 * 4);
          dispatch(assign, [allocated, scan.freeListBuffer, assigned, make(sp.byteLength, uniform, sp)]);
          dispatch(check, [allocated, assigned, scan.spareLineagesBuffer, scan.freeListBuffer,
            receipt, make(16, uniform, new Uint32Array([id, available, 0, 0]))]);
        }
        const read = make(32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        encoder.copyBufferToBuffer(receipt, 0, read, 0, 32);
        device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        const result = Array.from(new Uint32Array(read.getMappedRange()).slice());
        read.unmap();
        const validation = await device.popErrorScope();
        if (validation) errors.push(validation.message);
        return { receipt: result, errors };
      } finally {
        for (const buffer of owned) buffer.destroy();
        device.destroy();
      }
    });
    assert.deepEqual(out.errors, []);
    assert.equal(out.receipt[1], 7, 'all manufactured cases executed on GPU');
    assert.equal(out.receipt[0], 0, `GPU invariant failures: ${JSON.stringify(out.receipt)}`);
    console.log(JSON.stringify(out));
  } finally {
    await browser.close();
  }
});
