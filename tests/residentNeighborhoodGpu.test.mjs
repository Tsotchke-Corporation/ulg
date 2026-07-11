import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
  compareResidentNeighborhoodCellKeys,
  compareResidentNeighborhoodStructuralCellKeys,
  createResidentNeighborhoodCapacityPlan,
  createResidentNeighborhoodCellKey,
  createResidentNeighborhoodDescriptor,
  decodeResidentNeighborhoodCellKey,
  decodeResidentNeighborhoodSignedOrderKey,
  encodeResidentNeighborhoodSignedOrderKey,
  normalizeResidentNeighborhoodSupportClasses,
  packResidentNeighborhoodCapacityEvidenceU32,
  packResidentNeighborhoodSupportClassesU32,
  residentNeighborhoodCellKeyEquals,
  validateResidentNeighborhoodLease
} from '../src/runtime/sph/residentNeighborhoodGpu.js';

const supportClasses = [
  {
    supportClassId: 19,
    name: 'reaction-pressure-structural',
    consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION
      | RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE
      | RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION,
    minLevelDelta: -2,
    maxLevelDelta: 2,
    cellRadius: 3,
    maxCandidatesPerSource: 384,
    flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_LEVEL
  },
  {
    supportClassId: 7,
    name: 'mechanics-contact-solid',
    consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS
      | RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT
      | RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS,
    minLevelDelta: -1,
    maxLevelDelta: 1,
    cellRadius: 2,
    maxCandidatesPerSource: 256,
    flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.INCLUDE_SOURCE_CELL
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXCLUDE_SELF
  },
  {
    supportClassId: 11,
    name: 'thermal-radiation',
    consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL
      | RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION,
    minLevelDelta: -1,
    maxLevelDelta: 1,
    cellRadius: 4,
    maxCandidatesPerSource: 512,
    flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_LEVEL
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.AGGREGATE_FAR_ALLOWED
  }
];

function createReadyDescriptor(overrides = {}) {
  return createResidentNeighborhoodDescriptor({
    generation: 23,
    leaseId: 'neighborhood-lease-23',
    laneId: 'compute-manager-lane-0',
    stateKey: 'simulation/hot-state/23',
    deviceId: 'gpu-device-0',
    leaseTokenLow: 0x89ab_cdef,
    leaseTokenHigh: 0x0123_4567,
    supportClasses,
    sourceCount: 4,
    requiredUniqueCellCount: 2,
    requiredCellMemberCount: 4,
    requiredCandidateCount: 10,
    ...overrides
  });
}

test('resident neighborhood cell keys are structural u32 rows with signed radix order', () => {
  const negative = createResidentNeighborhoodCellKey({
    chartId: 3,
    level: -2,
    cell: [-7, 4, -1],
    generation: 9
  });
  const zero = createResidentNeighborhoodCellKey({
    chartId: 3,
    level: 0,
    cell: [-7, 4, -1],
    generation: 9
  });
  const laterGeneration = createResidentNeighborhoodCellKey({
    chartId: 3,
    level: -2,
    cell: [-7, 4, -1],
    generation: 10
  });

  assert.equal(negative instanceof Uint32Array, true);
  assert.equal(negative.length, 8);
  assert.equal(encodeResidentNeighborhoodSignedOrderKey(-2), 0x7fff_fffe);
  assert.equal(encodeResidentNeighborhoodSignedOrderKey(-1), 0x7fff_ffff);
  assert.equal(encodeResidentNeighborhoodSignedOrderKey(0), 0x8000_0000);
  assert.equal(decodeResidentNeighborhoodSignedOrderKey(0x7fff_fffe), -2);
  assert.deepEqual(decodeResidentNeighborhoodCellKey(negative), {
    chartId: 3,
    level: -2,
    cell: [-7, 4, -1],
    generation: 9,
    keyFlags: 0
  });
  assert.equal(compareResidentNeighborhoodCellKeys(negative, zero), -1);
  assert.equal(compareResidentNeighborhoodStructuralCellKeys(negative, laterGeneration), 0);
  assert.equal(compareResidentNeighborhoodCellKeys(negative, laterGeneration), -1);
  assert.equal(residentNeighborhoodCellKeyEquals(negative, negative.slice()), true);
  assert.equal(residentNeighborhoodCellKeyEquals(negative, laterGeneration), false);
});

test('support classes normalize deterministically and retain all solver consumer families', () => {
  const normalized = normalizeResidentNeighborhoodSupportClasses(supportClasses, {
    generation: 23
  });
  const rows = packResidentNeighborhoodSupportClassesU32(supportClasses, {
    generation: 23
  });

  assert.deepEqual(normalized.map((entry) => entry.supportClassId), [7, 11, 19]);
  assert.equal(rows.length, 24);
  assert.equal(rows[0], 7);
  assert.equal(rows[1] & RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS, 1);
  assert.equal(rows[2], encodeResidentNeighborhoodSignedOrderKey(-1));
  assert.equal(rows[3], encodeResidentNeighborhoodSignedOrderKey(1));
  assert.equal(rows[6], 23);
  assert.throws(
    () => normalizeResidentNeighborhoodSupportClasses([
      supportClasses[0],
      { ...supportClasses[0] }
    ]),
    /duplicate supportClassId/
  );
});

test('resident neighborhood descriptor admits exact CSR capacity with compact evidence', () => {
  const descriptor = createReadyDescriptor();
  const evidence = descriptor.capacityEvidence;

  assert.equal(descriptor.schema, ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA);
  assert.equal(descriptor.status, 'resident-neighborhood-descriptor-ready');
  assert.equal(descriptor.authority.laneOwner, 'peercompute-compute-manager');
  assert.equal(descriptor.authority.resourceOwner, 'peercompute-gpu-hub');
  assert.equal(descriptor.authority.mutationAdmission, 'peercompute-state-manager');
  assert.equal(descriptor.authority.sceneLocalScheduler, false);
  assert.equal(descriptor.keyEncoding.hashAuthority, false);
  assert.equal(evidence.required.cellOffsetCount, 3);
  assert.equal(evidence.required.sourceOffsetCount, 5);
  assert.equal(evidence.required.bytes, 448);
  assert.deepEqual(evidence.admitted, { ...evidence.required });
  assert.deepEqual(evidence.overflow, {
    uniqueCellCount: 0,
    cellOffsetCount: 0,
    cellMemberCount: 0,
    sourceOffsetCount: 0,
    candidateCount: 0,
    bytes: 0
  });
  assert.equal(
    Boolean(evidence.statusFlags & RESIDENT_NEIGHBORHOOD_STATUS_FLAG.READY),
    true
  );
  assert.equal(descriptor.admission.consumerDispatchAllowed, true);
  assert.equal(descriptor.admission.stateMutationAllowed, false);
  assert.equal(descriptor.admission.stateMutationAdmissionRequired, true);
  assert.equal(descriptor.reuse.mechanics, true);
  assert.equal(descriptor.reuse.contact, true);
  assert.equal(descriptor.reuse.thermal, true);
  assert.equal(descriptor.reuse.radiation, true);
  assert.equal(descriptor.reuse.reaction, true);
  assert.equal(descriptor.reuse.ssUniqueNodeCompaction, true);
  assert.equal(descriptor.cpuSolverOracleRequired, false);
  assert.equal(descriptor.fullParticleReadbackRequired, false);
  assert.equal(descriptor.capacityEvidenceU32.length, 40);
  assert.equal(
    descriptor.capacityEvidenceU32.length,
    RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length
  );
  assert.equal(descriptor.capacityEvidenceU32[21], 10);
  assert.equal(descriptor.capacityEvidenceU32[22], 10);
  assert.equal(descriptor.capacityEvidenceU32[25], 448);
  assert.equal(descriptor.capacityEvidenceU32[26], 0);
});

test('resident neighborhood descriptor conforms to its standalone ABI schema', () => {
  const schema = JSON.parse(fs.readFileSync(
    new URL('../ulg-gpu-abi/src/schemas/resident_neighborhood.schema.json', import.meta.url),
    'utf8'
  ));
  const validate = new Ajv2020({ strict: false }).compile(schema);
  const descriptor = createReadyDescriptor();

  assert.equal(validate(descriptor), true, JSON.stringify(validate.errors));
});

test('any CSR capacity overflow rejects the whole neighborhood without truncation', () => {
  const descriptor = createReadyDescriptor({
    capacities: {
      uniqueCellCount: 2,
      cellOffsetCount: 3,
      cellMemberCount: 4,
      sourceOffsetCount: 5,
      candidateCount: 8,
      bytes: 10_000
    }
  });
  const evidence = descriptor.capacityEvidence;

  assert.equal(descriptor.status, 'resident-neighborhood-capacity-overflow-fail-closed');
  assert.equal(evidence.failClosed, true);
  assert.equal(evidence.overflow.candidateCount, 2);
  assert.equal(evidence.overflow.bytes, 0);
  assert.deepEqual(evidence.admitted, {
    uniqueCellCount: 0,
    cellOffsetCount: 0,
    cellMemberCount: 0,
    sourceOffsetCount: 0,
    candidateCount: 0,
    bytes: 0
  });
  assert.deepEqual(evidence.reasonCodes, ['candidateCount-capacity-overflow']);
  assert.equal(
    Boolean(evidence.statusFlags & RESIDENT_NEIGHBORHOOD_STATUS_FLAG.OVERFLOW),
    true
  );
  assert.equal(
    Boolean(evidence.statusFlags & RESIDENT_NEIGHBORHOOD_STATUS_FLAG.FAIL_CLOSED),
    true
  );
  assert.equal(descriptor.admission.consumerDispatchAllowed, false);
  assert.equal(descriptor.capacityEvidenceU32[21], 10);
  assert.equal(descriptor.capacityEvidenceU32[22], 0);
  assert.equal(descriptor.capacityEvidenceU32[23], 8);
  assert.equal(descriptor.capacityEvidenceU32[24], 2);
  assert.equal(descriptor.capacityEvidenceU32[36], 1);
  assert.equal(descriptor.capacityEvidenceU32[37], 0);
});

test('generation and lease validation rejects stale resident handles fail closed', () => {
  const descriptor = createReadyDescriptor();
  const current = validateResidentNeighborhoodLease(descriptor, {
    generation: 23,
    leaseId: 'neighborhood-lease-23',
    laneId: 'compute-manager-lane-0',
    stateKey: 'simulation/hot-state/23',
    leaseTokenLow: 0x89ab_cdef,
    leaseTokenHigh: 0x0123_4567
  });
  const stale = validateResidentNeighborhoodLease(descriptor, {
    generation: 24,
    leaseId: 'neighborhood-lease-23',
    leaseTokenLow: 0
  });

  assert.equal(current.status, 'resident-neighborhood-lease-valid');
  assert.equal(current.consumerDispatchAllowed, true);
  assert.equal(current.stateMutationAllowed, false);
  assert.equal(stale.status, 'resident-neighborhood-lease-invalid-fail-closed');
  assert.equal(stale.identityValid, false);
  assert.equal(stale.consumerDispatchAllowed, false);
  assert.deepEqual(stale.mismatches, ['generation', 'leaseTokenLow']);
});

test('capacity evidence preserves byte counts above four GiB as u32 word pairs', () => {
  const evidence = createResidentNeighborhoodCapacityPlan({
    generation: 2,
    sourceCount: 0,
    requiredUniqueCellCount: 0,
    requiredCandidateCount: 600_000_000,
    supportClassCount: 0
  });
  const row = packResidentNeighborhoodCapacityEvidenceU32(evidence);

  assert.equal(evidence.required.bytes > 0xffff_ffff, true);
  assert.equal(row[25], evidence.required.bytes >>> 0);
  assert.equal(row[26] > 0, true);
  assert.equal(row.length, RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length);
});
