import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MATERIAL_RESOLVER_MANIFEST,
  MATERIAL_RESOLVER_MANIFEST_SCHEMA,
  MATERIAL_RESOLVER_STATUS,
  MATERIAL_RESOLVER_VALIDATION_FLAGS,
  materialResolverFamilies,
  materialResolverFamilyById,
  materialResolverFamilyIds
} from '../src/runtime/material/materialResolverManifest.js';

const REQUIRED_FAMILIES = Object.freeze([
  'electronic-structure-band-optics',
  'molecular-geometry-md',
  'thermodynamic-phase-eos',
  'mechanical-properties',
  'optical-pbr-closures',
  'reaction-energetics-products',
  'radiation-nuclear-closures',
  'cache-fingerprint-policy'
]);

test('material resolver manifest enumerates the WebGPU migration resolver families', () => {
  assert.equal(MATERIAL_RESOLVER_MANIFEST.schema, MATERIAL_RESOLVER_MANIFEST_SCHEMA);
  assert.deepEqual(
    materialResolverFamilies().map((entry) => entry.family),
    REQUIRED_FAMILIES
  );
  assert.equal(new Set(materialResolverFamilyIds()).size, REQUIRED_FAMILIES.length);
  for (const id of materialResolverFamilyIds()) {
    assert.match(id, /^peercompute\.ulg\.material-resolver\.[a-z0-9-]+\.v0$/);
    assert.equal(materialResolverFamilyById(id)?.id, id);
  }
  assert.equal(materialResolverFamilyById('missing'), null);
});

test('each resolver family declares CPU anchors, residency target, cache ingredients, status, and false validation flags', () => {
  const allowedStatuses = new Set(Object.values(MATERIAL_RESOLVER_STATUS));
  for (const entry of materialResolverFamilies()) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.cpu.status, 'string');
    assert.ok(entry.cpu.entrypoints.length > 0, `${entry.family} should name at least one CPU anchor`);
    for (const point of entry.cpu.entrypoints) {
      assert.match(point.module, /^src\/runtime\//);
      assert.ok(Array.isArray(point.exports));
      assert.ok(point.exports.length > 0);
    }
    assert.equal(typeof entry.webgpuResidencyTarget.target, 'string');
    assert.equal(typeof entry.webgpuResidencyTarget.residency, 'string');
    assert.ok(entry.cacheKeyIngredients.includes('schemaVersion'));
    assert.ok(entry.cacheKeyIngredients.includes('generatorFingerprint'));
    assert.ok(allowedStatuses.has(entry.currentStatus), `unexpected status ${entry.currentStatus}`);
    assert.deepEqual(Object.keys(entry.validationFlags).sort(), [...MATERIAL_RESOLVER_VALIDATION_FLAGS].sort());
    assert.ok(Object.values(entry.validationFlags).every((value) => value === false));
  }
});

test('manifest is a general resolver scaffold, not a material-specific patch list', () => {
  const serialized = JSON.stringify(MATERIAL_RESOLVER_MANIFEST).toLowerCase();
  for (const materialToken of ['h2o', 'naoh', 'sodium', 'iron', 'gold']) {
    assert.equal(serialized.includes(materialToken), false, `${materialToken} should not be a resolver manifest special case`);
  }
});

test('cache and fingerprint policy records lower-level closure and WebGPU program guards', () => {
  const policy = materialResolverFamilyById('peercompute.ulg.material-resolver.cache-fingerprint-policy.v0');
  assert.ok(policy);
  for (const required of ['inputHash', 'methodHash', 'validityDomainHash', 'lowerLevelClosureHashes', 'webgpuProgramHash', 'abiLayoutHash']) {
    assert.ok(policy.cacheKeyIngredients.includes(required), `missing ${required}`);
  }
  assert.equal(policy.currentStatus, MATERIAL_RESOLVER_STATUS.CPU_CONTROL_PLANE_POLICY);
});
