#!/usr/bin/env node
// Priority 3 measurement, not a fix.
//
// sol-critic P0 says the active-node list "permits one active row per particle".
// Two compactions are possible and they are not equivalent:
//
//   (a) dedup on the row's own AABB tuple (level, min_tile, max_tile). Exactly
//       equivalent to today -- no over-approximation, no consumer change. Only
//       compacts particles whose *inflated support boxes* round identically.
//   (b) dedup on the tile coordinate alone, storing the union of the occupants'
//       support boxes. One row per occupied tile, which is what P0 asks for, but
//       the union widens each node's scan range.
//
// The ratio each achieves decides whether (b)'s wider scan is worth paying for,
// and neither ratio was known. This runs the real kernel on a real GPU over a
// realistic particle lattice and reports both, plus what (b) costs in scan
// volume, so the choice is made on numbers instead of on intuition.
//
//   ULG_ACTIVE_NODE_COMPACTION_BASE_URL=https://127.0.0.1:5174/ \
//   node scripts/schroeder-active-node-compaction-probe.mjs

import { writeFile } from 'node:fs/promises';

const BASE_URL = process.env.ULG_ACTIVE_NODE_COMPACTION_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_ACTIVE_NODE_COMPACTION_CHROME
  || '/usr/bin/google-chrome';
const OUTPUT = process.env.ULG_ACTIVE_NODE_COMPACTION_OUTPUT || null;

// Particles per edge of the cubic lattice. 22^3 = 10,648, the same order as the
// scenarios the rest of this campaign measured.
const EDGE = Number.parseInt(process.env.ULG_ACTIVE_NODE_COMPACTION_EDGE || '22', 10);

async function main() {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let measured;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    measured = await page.evaluate(async ({ edge }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncaptured = [];
      device.addEventListener('uncapturederror', (event) => {
        uncaptured.push(event.error?.message || String(event.error));
      });

      const hierarchy = await import('/src/runtime/sph/schroederHierarchyGpu.js');

      // A cubic lattice at the particle spacing a real scenario produces: the
      // support radius is what drives tile inflation, so the spacing has to be
      // in the same ratio to it as the real thing, not arbitrary.
      const spacingM = 0.1;
      const smoothingLengthM = 0.1;
      const particleCount = edge * edge * edge;
      const stateFloats = 8;
      const thermoFloats = 12;
      // 32, from MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT. A short stride here
      // misaligns every row and the level kernel silently classifies the whole
      // lattice inactive -- which is exactly what the first run of this probe
      // measured, and why it reported a compaction ratio of 1.0.
      const mechanicsFloats = 32;
      const state = new Float32Array(particleCount * stateFloats);
      const thermo = new Float32Array(particleCount * thermoFloats);
      const mechanics = new Float32Array(particleCount * mechanicsFloats);
      let index = 0;
      for (let x = 0; x < edge; x += 1) {
        for (let y = 0; y < edge; y += 1) {
          for (let z = 0; z < edge; z += 1) {
            const s = index * stateFloats;
            state[s] = x * spacingM;
            state[s + 1] = y * spacingM;
            state[s + 2] = z * spacingM;
            state[s + 3] = 1000;
            const t = index * thermoFloats;
            thermo[t] = 1;
            thermo[t + 1] = 2;
            thermo[t + 3] = 1000;
            thermo[t + 8] = smoothingLengthM;
            thermo[t + 11] = spacingM / 2;
            const m = index * mechanicsFloats;
            mechanics[m + 18] = 1;
            mechanics[m + 19] = 1;
            // The level kernel admits a particle only when both of these read
            // 1.0; otherwise it takes the inactive branch with support 0.
            mechanics[m + 21] = 1;
            mechanics[m + 27] = 1;
            index += 1;
          }
        }
      }

      const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
      const upload = (label, data) => {
        const buffer = device.createBuffer({ label, size: Math.max(4, data.byteLength), usage });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const stateBuffer = upload('compaction-probe-state', state);
      const thermoBuffer = upload('compaction-probe-thermo', thermo);
      const mechanicsBuffer = upload('compaction-probe-mechanics', mechanics);

      const sphParticleState = {
        schema: 'peercompute.ulg.sph-gpu-particle-buffer.v0',
        particleCount,
        smoothingLengthM,
        state,
        thermo
      };
      const mlsMpmParticleState = {
        schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer.v0',
        particleCount,
        mechanics
      };
      const storageGeneration = 1;

      const levelAssignment = await hierarchy.runSchroederLevelAssignmentWebGpu({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload: {
          status: 'webgpu-uploaded',
          particleCount,
          storageGeneration,
          stateBuffer,
          thermoBuffer
        },
        mlsMpmParticleUpload: {
          status: 'webgpu-uploaded',
          particleCount,
          storageGeneration,
          mechanicsBuffer
        },
        // Everything else left at the shipped defaults -- targetSupportCells
        // 1.5, supportRadiusScale 1, tileCellCount 8, supportInflateCells 1 --
        // so the ratios describe the geometry that actually runs.
        baseGridSpacingM: spacingM
      });

      const activeNodes = await hierarchy.runSchroederActiveNodeListWebGpu({
        device,
        levelAssignment,
        // Defaults, so the measurement describes the shipped geometry.
        readbackMode: 'full-active-node-readback'
      });

      const rows = activeNodes.activeNodes;
      const stride = rows.length / particleCount;
      if (!Number.isInteger(stride) || stride < 16) {
        return {
          status: 'unreadable',
          reason: `active node rows ${rows.length} do not divide ${particleCount} into a >=16 float stride`,
          uncaptured
        };
      }

      // Row layout, from ulg-gpu-abi/src/wgsl.js:
      //   0 level | 1..3 min_tile | 4..6 max_tile | 7 tile_spacing
      //   8 native_dx | 9 support_radius | 10 particle | 11 status
      //   12..14 position | 15 chart
      const aabbKeys = new Set();
      const tileKeys = new Set();
      const tileUnion = new Map();
      let admitted = 0;
      let scannedTilesPerRow = 0;
      let tileSpacing = 0;
      let supportRadius = 0;
      for (let row = 0; row < particleCount; row += 1) {
        const at = row * stride;
        const status = rows[at + 11];
        if (!(status > 0)) continue;
        admitted += 1;
        const level = rows[at];
        const chart = rows[at + 15];
        const minT = [rows[at + 1], rows[at + 2], rows[at + 3]];
        const maxT = [rows[at + 4], rows[at + 5], rows[at + 6]];
        tileSpacing = rows[at + 7];
        supportRadius = rows[at + 9];
        scannedTilesPerRow +=
          (maxT[0] - minT[0] + 1) * (maxT[1] - minT[1] + 1) * (maxT[2] - minT[2] + 1);
        aabbKeys.add(`${level}|${chart}|${minT.join(',')}|${maxT.join(',')}`);
        // Design (b) keys on the tile the particle itself occupies.
        const own = [
          Math.floor(rows[at + 12] / tileSpacing),
          Math.floor(rows[at + 13] / tileSpacing),
          Math.floor(rows[at + 14] / tileSpacing)
        ];
        const tileKey = `${level}|${chart}|${own.join(',')}`;
        tileKeys.add(tileKey);
        const existing = tileUnion.get(tileKey);
        if (existing) {
          for (let axis = 0; axis < 3; axis += 1) {
            existing.min[axis] = Math.min(existing.min[axis], minT[axis]);
            existing.max[axis] = Math.max(existing.max[axis], maxT[axis]);
          }
        } else {
          tileUnion.set(tileKey, { min: minT.slice(), max: maxT.slice() });
        }
      }

      // Design (b)'s cost is not the sum over unique tiles -- every particle
      // still scans a node, so the comparison has to be per particle: its own
      // box today versus its tile's unioned box after compaction. Summing over
      // unique tiles instead would divide the cost by the compaction ratio and
      // make the union look free.
      let unionScannedTilesPerParticle = 0;
      for (let row = 0; row < particleCount; row += 1) {
        const at = row * stride;
        if (!(rows[at + 11] > 0)) continue;
        const level = rows[at];
        const chart = rows[at + 15];
        const spacing = rows[at + 7];
        const key = `${level}|${chart}|${Math.floor(rows[at + 12] / spacing)},`
          + `${Math.floor(rows[at + 13] / spacing)},${Math.floor(rows[at + 14] / spacing)}`;
        const box = tileUnion.get(key);
        if (!box) continue;
        unionScannedTilesPerParticle +=
          (box.max[0] - box.min[0] + 1) * (box.max[1] - box.min[1] + 1) * (box.max[2] - box.min[2] + 1);
      }

      return {
        status: 'measured',
        particleCount,
        admittedRowCount: admitted,
        spacingM,
        supportRadiusM: supportRadius,
        tileSpacingM: tileSpacing,
        designA: {
          uniqueRowCount: aabbKeys.size,
          compactionRatio: admitted / Math.max(1, aabbKeys.size)
        },
        designB: {
          uniqueRowCount: tileKeys.size,
          compactionRatio: admitted / Math.max(1, tileKeys.size)
        },
        // What (b) costs: total tiles every consumer would scan, before and
        // after unioning each tile's occupants into one box.
        nativeGridSpacingM: tileSpacing / 8,
        latticeExtentM: (edge - 1) * spacingM,
        // Tiles scanned across all particles: today each scans its own box,
        // under (b) each scans its tile's unioned box.
        scannedTilesToday: scannedTilesPerRow,
        scannedTilesUnderDesignB: unionScannedTilesPerParticle,
        designBScanInflation: unionScannedTilesPerParticle / Math.max(1, scannedTilesPerRow),
        uncaptured
      };
    }, { edge: EDGE });
  } finally {
    await browser.close();
  }

  const report = {
    schema: 'peercompute.ulg.schroeder-active-node-compaction-probe.v0',
    baseUrl: BASE_URL,
    edge: EDGE,
    ...measured
  };
  const text = JSON.stringify(report, null, 2);
  if (OUTPUT) await writeFile(OUTPUT, text);
  console.log(text);
  if (measured?.status !== 'measured') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
