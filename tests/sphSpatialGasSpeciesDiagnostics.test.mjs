import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_OFFSETS as OFFSETS,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS as STATUS,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_VERSION,
  ULG_SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_SCHEMA,
  sphSpatialGasSpeciesDiagnosticsWgsl
} from '../src/runtime/sph/sphSpatialGasSpeciesDiagnosticsWgsl.js';

test('species packet has a versioned 128-byte ABI with explicit unavailable and provenance states', () => {
  assert.equal(ULG_SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_SCHEMA,
    'peercompute.ulg.sph-spatial-gas-species-diagnostic.v1');
  assert.equal(SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC, 0x53474431);
  assert.equal(SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_VERSION, 1);
  assert.equal(SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS * 4, 128);
  assert.deepEqual(Object.values(OFFSETS), Array.from({ length: 23 }, (_, i) => i));
  assert.equal(Object.isFrozen(OFFSETS), true);
  assert.equal(Object.isFrozen(STATUS), true);
  const values = Object.values(STATUS);
  assert.equal(new Set(values).size, values.length);
  assert.ok(values.every((value) => value > 0 && (value & (value - 1)) === 0));
  assert.ok(STATUS.SATURATION_READY && STATUS.TEMPERATURE_FALLBACK
    && STATUS.PROVENANCE_INVALID && STATUS.MIXED_CELL_TEMPERATURE
    && STATUS.LAW_AMBIGUOUS && STATUS.SOURCE_EMPTY);
});

test('diagnostic suffix can only write its sidecar and cannot publish physical authority', () => {
  const writes = [...sphSpatialGasSpeciesDiagnosticsWgsl.matchAll(
    /\b([a-z_]+)\[[^\]\n]+\]\s*=(?!=)/g
  )].map((match) => match[1]);
  assert.ok(writes.length > 20);
  assert.deepEqual([...new Set(writes)], ['species_diagnostics']);
  assert.doesNotMatch(sphSpatialGasSpeciesDiagnosticsWgsl,
    /\batomic(?:Add|Sub|Max|Min|And|Or|Xor|Exchange|CompareExchangeWeak|Store)\s*\(/);
  assert.doesNotMatch(sphSpatialGasSpeciesDiagnosticsWgsl,
    /\brecord_eos_error\s*\(|\bfree_volume_contract_ready\s*\(/);
  assert.deepEqual([...sphSpatialGasSpeciesDiagnosticsWgsl.matchAll(
    /@binding\((\d+)\)/g
  )].map((match) => Number(match[1])), [7, 8, 9, 10]);
});
