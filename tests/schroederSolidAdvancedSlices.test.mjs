import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA,
  buildSchroederDeformableSolidSurfaceMesh
} from '../src/runtime/sph/schroederSolidDeformableShapeGpu.js';
import { SCHROEDER_SOLID_FRACTURE_SCHEMA } from '../src/runtime/sph/schroederSolidFractureGpu.js';
import {
  SCHROEDER_SOLID_MULTILEVEL_SCHEMA,
  buildSchroederMultilevelProxyCatalog,
  splitFloat64ToHiLo
} from '../src/runtime/sph/schroederSolidMultilevelGpu.js';

test('SOL-4 deformable surface mesh builds watertight closed manifold with partition-of-unity 8-neighbor weights', () => {
  const pitch = 0.05;
  const pts = [];
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      for (let k = 0; k < 3; k += 1) {
        pts.push({ x: [i * pitch, j * pitch, k * pitch], massKg: 0.125 });
      }
    }
  }
  const mesh = buildSchroederDeformableSolidSurfaceMesh(pts, { pitchM: pitch });
  assert.equal(mesh.schema, SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA);
  assert.equal(mesh.particleCount, 12);
  // Exposed faces on 2x2x3 block: 2*(2*2 + 2*3 + 2*3) = 32 quads = 64 triangles
  assert.equal(mesh.triangleCount, 64);

  // Verify exact partition of unity on every surface vertex and analytical divergence-theorem volume
  for (let v = 0; v < mesh.vertexCount; v += 1) {
    let sum = 0;
    for (let k = 0; k < 8; k += 1) {
      const w = mesh.vertexEmbedWeights[v * 8 + k];
      assert.ok(w >= 0);
      sum += w;
    }
    assert.ok(Math.abs(sum - 1.0) < 1e-6, `Vertex ${v} weights sum to 1 (${sum})`);
  }

  let vol6 = 0;
  const vr = mesh.vertexRestPositions;
  const tr = mesh.triangleIndices;
  for (let t = 0; t < mesh.triangleCount; t += 1) {
    const i0 = tr[t * 3 + 0] * 4;
    const i1 = tr[t * 3 + 1] * 4;
    const i2 = tr[t * 3 + 2] * 4;
    const p0 = [vr[i0], vr[i0 + 1], vr[i0 + 2]];
    const e1 = [vr[i1] - p0[0], vr[i1 + 1] - p0[1], vr[i1 + 2] - p0[2]];
    const e2 = [vr[i2] - p0[0], vr[i2 + 1] - p0[1], vr[i2 + 2] - p0[2]];
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0]
    ];
    vol6 += p0[0] * cr[0] + p0[1] * cr[1] + p0[2] * cr[2];
  }
  assert.ok(Math.abs(vol6 / 6 - 12 * pitch ** 3) < 1e-8, 'Closed surface volume matches 12 * pitch^3');
  assert.equal(SCHROEDER_SOLID_FRACTURE_SCHEMA, 'peercompute.ulg.schroeder-solid-fracture.v1');
});

test('SOL-6 multilevel proxy catalog and double-float hi/lo split preserve exact area and f64 precision', () => {
  const catalog = buildSchroederMultilevelProxyCatalog({
    bodyIndex: 2,
    halfExtentsM: [0.08, 0.08, 0.16],
    finePitchM: 0.04
  });
  assert.equal(catalog.schema, SCHROEDER_SOLID_MULTILEVEL_SCHEMA);
  // Dimensions: 0.16 x 0.16 x 0.32 -> surface area = 2*(0.0256 + 0.0512 + 0.0512) = 0.256 m^2
  assert.ok(Math.abs(catalog.exactAreaM2 - 0.256) < 1e-12);
  // 4x4x8 fine grid -> macro 4x4 counts: 2*(1*1 + 1*2 + 1*2) = 10 macro patches = 160 leaves
  assert.equal(catalog.macroCount, 10);
  assert.equal(catalog.leafCount, 160);

  const exactCoord = 100000000.1234567;
  const [hi, lo] = splitFloat64ToHiLo(exactCoord);
  assert.ok(Math.abs(hi + lo - exactCoord) < 1e-6, 'Double-float split preserves sub-millimetre precision at 1e8 m');
});
