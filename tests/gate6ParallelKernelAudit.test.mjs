import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();

const REQUIRED_PARALLEL_KERNELS = [
  ['src/runtime/sph/schroederSplitSpareLineageScanGpu.js', 'scan_group_totals', 64],
  ['ulg-gpu-abi/src/sphReactionWgsl.js', 'scan_placement_row_groups', 64],
  ['ulg-gpu-abi/src/sphReactionWgsl.js', 'finalize_placement_spatial_envelope', 64],
  ['ulg-gpu-abi/src/sphReactionProductEventSpatialClassificationWgsl.js', 'scan_spare_groups', 64],
  ['src/runtime/sph/sphExactVaporParcelLedgerGpu.js', 'scan_members', 64],
  ['src/runtime/sph/sphExactParcelTransportLedgerGpu.js', 'deposit_into_sinks', 64],
  ['src/runtime/webgpuRadixScanUnique.js', 'scan_histogram_serial', 64]
];

const ZERO_SERIAL_WORKGROUP_DIRS = [
  'src/runtime/gpuMath',
  'src/runtime/astrophysics',
  'src/runtime/chemistry',
  'src/runtime/quantum'
];

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (full.endsWith('.js') || full.endsWith('.wgsl')) out.push(full);
  }
  return out;
}

test('Gate 6 Phase B: hot-path prefix-scan and reduction kernels are workgroup-parallel (zero @workgroup_size(1))', () => {
  for (const [relPath, fnName, minWg] of REQUIRED_PARALLEL_KERNELS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    const badRe = new RegExp(`@workgroup_size\\(\\s*1(?:\\s*,\\s*1(?:\\s*,\\s*1)?)?\\s*\\)\\s*(?:@compute\\s*)?fn\\s+${fnName}\\b`);
    assert.equal(badRe.test(src), false, `${relPath}:${fnName} must not use @workgroup_size(1)`);
    const wgMatches = [...src.matchAll(new RegExp(`@workgroup_size\\(([^)]+)\\)\\s*(?:@compute\\s*)?fn\\s+${fnName}\\b`, 'g'))];
    assert.ok(wgMatches.length >= 1, `expected parallel @workgroup_size declaration for ${relPath}:${fnName}`);
    for (const m of wgMatches) {
      const expr = m[1].trim();
      const numeric = Number(expr.split(',')[0].trim());
      if (Number.isFinite(numeric)) {
        assert.ok(numeric >= minWg, `${relPath}:${fnName} workgroup_size ${numeric} < ${minWg}`);
      }
    }
  }

  // Resident & reaction summary finalizers are parallel workgroup reductions within 16 KiB baseline workgroup memory
  const rxWgslSrc = fs.readFileSync(path.join(REPO_ROOT, 'ulg-gpu-abi/src/sphReactionWgsl.js'), 'utf8');
  const mpmWgslSrc = fs.readFileSync(path.join(REPO_ROOT, 'ulg-gpu-abi/src/mlsMpmWgsl.js'), 'utf8');
  assert.match(rxWgslSrc, /var<workgroup> rx_sum_r0: array<vec4<f32>, 64>;/);
  assert.match(mpmWgslSrc, /var<workgroup> res_wg_rows: array<array<vec4<f32>, 22>, 32>;/);
  // 22 * 32 * 16 bytes = 11,264 <= 16,384 baseline WebGPU maxComputeWorkgroupStorageSize
  assert.ok(22 * 32 * 16 <= 16384);
});

test('Gate 6 Phase B: permanent @workgroup_size(1) ceiling & zero serial compute in parallel-only domains', () => {
  const wg1Re = /@workgroup_size\(\s*1(?:\s*,\s*1(?:\s*,\s*1)?)?\s*\)/g;
  for (const relDir of ZERO_SERIAL_WORKGROUP_DIRS) {
    const files = walkFiles(path.join(REPO_ROOT, relDir));
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const hits = src.match(wg1Re) || [];
      assert.equal(hits.length, 0, `${path.relative(REPO_ROOT, file)} must have 0 @workgroup_size(1) kernels (found ${hits.length})`);
    }
  }

  // Global non-regression ratchet across all runtime & ABI shaders
  const allFiles = [
    ...walkFiles(path.join(REPO_ROOT, 'src/runtime')),
    ...walkFiles(path.join(REPO_ROOT, 'ulg-gpu-abi/src'))
  ];
  let totalWg1 = 0;
  for (const file of allFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const hits = src.match(wg1Re);
    if (hits) totalWg1 += hits.length;
  }
  assert.ok(
    totalWg1 <= 233,
    `Global @workgroup_size(1) count regressed above Gate 6 Phase B ratchet: ${totalWg1} > 233`
  );
});
