import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
  compareResidentNeighborhoodCellKeys,
  compareResidentNeighborhoodStructuralCellKeys,
  createResidentNeighborhoodAuthorityToken,
  createResidentNeighborhoodCapacityPlan,
  createResidentNeighborhoodCellKey,
  createResidentNeighborhoodDescriptor,
  createResidentNeighborhoodPositionValidity,
  decodeResidentNeighborhoodCellKey,
  decodeResidentNeighborhoodSignedOrderKey,
  encodeResidentNeighborhoodSignedOrderKey,
  normalizeResidentNeighborhoodSelfInclusionPolicy,
  normalizeResidentNeighborhoodSourceSupportAssignments,
  normalizeResidentNeighborhoodSupportClasses,
  packResidentNeighborhoodCapacityEvidenceU32,
  packResidentNeighborhoodSourceSupportAssignmentsU32,
  packResidentNeighborhoodSupportClassesU32,
  residentNeighborhoodCellKeyEquals,
  residentNeighborhoodSelfPolicyForConsumer,
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

const sourceSupportAssignment = Object.freeze({
  mechanics: 7,
  contact: 7,
  thermal: 11,
  radiation: 11,
  reaction: 19,
  pressureInterface: 19,
  solidKinematics: 7,
  ssUniqueNodeCompaction: 19
});

const sourceSupportAssignments = Array.from(
  { length: 4 },
  () => ({ ...sourceSupportAssignment })
);

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
    sourceSupportAssignments,
    positionEpoch: 101,
    skinDistanceM: 0.4,
    maxDisplacementM: 0.1,
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

test('each source explicitly assigns one support class per enabled consumer family', () => {
  const normalized = normalizeResidentNeighborhoodSourceSupportAssignments(
    sourceSupportAssignments,
    { sourceCount: 4, supportClasses }
  );
  const rows = packResidentNeighborhoodSourceSupportAssignmentsU32(
    sourceSupportAssignments,
    { sourceCount: 4, supportClasses }
  );

  assert.equal(normalized.rowCount, 4);
  assert.equal(normalized.rowStrideU32, 8);
  assert.equal(normalized.consumerMask, 0xff);
  assert.equal(rows.length, 4 * RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT.length);
  assert.deepEqual([...rows.slice(0, 8)], [7, 7, 11, 11, 19, 19, 7, 19]);
  assert.throws(() => normalizeResidentNeighborhoodSourceSupportAssignments(
    sourceSupportAssignments.slice(0, 3),
    { sourceCount: 4, supportClasses }
  ), /exactly 4 source rows/);
  assert.throws(() => normalizeResidentNeighborhoodSourceSupportAssignments([
    { ...sourceSupportAssignment, thermal: 7 }
  ], {
    sourceCount: 1,
    supportClasses
  }), /does not admit the thermal consumer/);
  const inactive = packResidentNeighborhoodSourceSupportAssignmentsU32([{
    mechanics: RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS
  }], {
    sourceCount: 1,
    supportClasses
  });
  assert.ok([...inactive].every((word) => word === RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS));
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
  assert.equal(evidence.required.sourceSupportAssignmentCount, 4);
  assert.equal(evidence.required.bytes, 764);
  assert.deepEqual(evidence.admitted, { ...evidence.required });
  assert.deepEqual(evidence.overflow, {
    uniqueCellCount: 0,
    cellOffsetCount: 0,
    cellMemberCount: 0,
    sourceOffsetCount: 0,
    sourceSupportAssignmentCount: 0,
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
  assert.equal(descriptor.positionValidity.positionEpoch, 101);
  assert.equal(descriptor.positionValidity.displacementBudgetM, 0.2);
  assert.equal(descriptor.positionValidity.valid, true);
  assert.equal(descriptor.sourceSupportAssignments.rowCount, 4);
  assert.equal(descriptor.sourceSupportAssignments.rows.length, 32);
  assert.equal(residentNeighborhoodSelfPolicyForConsumer(descriptor, 'pressureInterface'), 'include');
  assert.equal(residentNeighborhoodSelfPolicyForConsumer(descriptor, 'mechanics'), 'exclude');
  assert.equal(descriptor.reuse.mechanics, true);
  assert.equal(descriptor.reuse.contact, true);
  assert.equal(descriptor.reuse.thermal, true);
  assert.equal(descriptor.reuse.radiation, true);
  assert.equal(descriptor.reuse.reaction, true);
  assert.equal(descriptor.reuse.pressureInterface, true);
  assert.equal(descriptor.reuse.solidKinematics, true);
  assert.equal(descriptor.reuse.ssUniqueNodeCompaction, true);
  assert.equal(descriptor.cpuSolverOracleRequired, false);
  assert.equal(descriptor.fullParticleReadbackRequired, false);
  assert.equal(descriptor.capacityEvidenceU32.length, 44);
  assert.equal(
    descriptor.capacityEvidenceU32.length,
    RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length
  );
  assert.equal(descriptor.capacityEvidenceU32[21], 4);
  assert.equal(descriptor.capacityEvidenceU32[22], 4);
  assert.equal(descriptor.capacityEvidenceU32[25], 10);
  assert.equal(descriptor.capacityEvidenceU32[26], 10);
  assert.equal(descriptor.capacityEvidenceU32[29], 764);
  assert.equal(descriptor.capacityEvidenceU32[30], 0);
});

test('packed CSR exposes aligned source offsets, assignments, and candidates through one binding', () => {
  const descriptor = createReadyDescriptor();
  const packed = descriptor.packedCsr;

  assert.equal(packed.singleStorageBinding, true);
  assert.equal(packed.storageBindingCount, 1);
  assert.equal(packed.shaderStorageType, 'array<u32>');
  assert.equal(packed.thermalStorageBindingCompatible, true);
  assert.equal(packed.headerU32.length, RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT.length);
  assert.equal(packed.headerU32.length, 40);
  assert.equal(packed.regions.sourceOffsets.baseU32, 40);
  assert.equal(packed.regions.sourceOffsets.capacity, 5);
  assert.equal(packed.regions.sourceSupportAssignments.baseU32, 48);
  assert.equal(packed.regions.sourceSupportAssignments.strideU32, 8);
  assert.equal(packed.regions.candidates.baseU32, 80);
  assert.equal(packed.regions.candidates.strideU32, 2);
  assert.equal(packed.requiredPayloadU32, 100);
  assert.equal(packed.backingCapacityU32, 100);
  assert.equal(packed.backingBufferByteLength, 400);
  assert.equal(packed.headerU32[23], RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE
    | RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION);
  assert.equal(packed.headerU32[24], RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS
    | RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT
    | RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL
    | RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION
    | RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION
    | RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS);
  assert.equal(packed.headerU32[31], 1);
  assert.equal(packed.headerU32[32], 0);
  assert.equal(packed.headerU32[33], 0);
});

test('resident neighborhood descriptor conforms to its standalone ABI schema', () => {
  const schema = JSON.parse(fs.readFileSync(
    new URL('../ulg-gpu-abi/src/schemas/resident_neighborhood.schema.json', import.meta.url),
    'utf8'
  ));
  const validate = new Ajv2020({ strict: false }).compile(schema);
  const validateDenseUniformChart = new Ajv2020({ strict: false }).compile(
    schema.$defs.denseUniformChart
  );
  const descriptor = createReadyDescriptor();

  assert.equal(validate(descriptor), true, JSON.stringify(validate.errors));
  assert.equal(validateDenseUniformChart({
    schema: 'peercompute.ulg.resident-neighborhood-dense-uniform-chart.v0',
    chartId: 0,
    level: 0,
    cellSizeM: 0.25,
    originM: [-1, -1, -1],
    minCell: [0, 0, 0],
    dimensions: [64, 32, 16],
    gridCellCount: 32768,
    admitted: true,
    admissionReason: 'grid-cell-count-within-source-count'
  }), true, JSON.stringify(validateDenseUniformChart.errors));
});

test('any CSR capacity overflow rejects the whole neighborhood without truncation', () => {
  const descriptor = createReadyDescriptor({
    capacities: {
      uniqueCellCount: 2,
      cellOffsetCount: 3,
      cellMemberCount: 4,
      sourceOffsetCount: 5,
      sourceSupportAssignmentCount: 4,
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
    sourceSupportAssignmentCount: 0,
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
  assert.equal(descriptor.capacityEvidenceU32[25], 10);
  assert.equal(descriptor.capacityEvidenceU32[26], 0);
  assert.equal(descriptor.capacityEvidenceU32[27], 8);
  assert.equal(descriptor.capacityEvidenceU32[28], 2);
  assert.equal(descriptor.capacityEvidenceU32[40], 1);
  assert.equal(descriptor.capacityEvidenceU32[41], 0);
  assert.equal(descriptor.packedCsr.headerU32[19], 0);
  assert.equal(descriptor.packedCsr.headerU32[31], 0);
  assert.equal(descriptor.packedCsr.headerU32[33], 1);
});

test('source support-assignment capacity participates in fail-closed admission', () => {
  const descriptor = createReadyDescriptor({
    capacities: {
      uniqueCellCount: 2,
      cellOffsetCount: 3,
      cellMemberCount: 4,
      sourceOffsetCount: 5,
      sourceSupportAssignmentCount: 3,
      candidateCount: 10,
      bytes: 10_000
    }
  });

  assert.equal(descriptor.capacityEvidence.overflow.sourceSupportAssignmentCount, 1);
  assert.deepEqual(descriptor.capacityEvidence.reasonCodes, [
    'sourceSupportAssignmentCount-capacity-overflow'
  ]);
  assert.equal(descriptor.capacityEvidence.admitted.sourceSupportAssignmentCount, 0);
  assert.equal(descriptor.packedCsr.regions.sourceSupportAssignments.capacity, 3);
  assert.equal(descriptor.packedCsr.regions.sourceSupportAssignments.admittedCount, 0);
  assert.equal(descriptor.admission.consumerDispatchAllowed, false);
});

test('position skin exhaustion rejects consumption without reporting capacity overflow', () => {
  const descriptor = createReadyDescriptor({ maxDisplacementM: 0.21 });
  const evidence = descriptor.capacityEvidence;

  assert.equal(descriptor.status, 'resident-neighborhood-position-validity-fail-closed');
  assert.equal(descriptor.positionValidity.status,
    'resident-neighborhood-position-envelope-exhausted-rebuild-required');
  assert.equal(descriptor.positionValidity.valid, false);
  assert.equal(descriptor.positionValidity.rebuildRequired, true);
  assert.ok(Object.values(evidence.overflow).every((value) => value === 0));
  assert.equal(evidence.capacityReasonCodes.length, 0);
  assert.deepEqual(evidence.validityReasonCodes, ['position-skin-envelope-exhausted']);
  assert.equal(evidence.admitted.sourceOffsetCount, 0);
  assert.equal(evidence.admitted.sourceSupportAssignmentCount, 0);
  assert.equal(evidence.admitted.candidateCount, 0);
  assert.equal(Boolean(evidence.statusFlags & RESIDENT_NEIGHBORHOOD_STATUS_FLAG.OVERFLOW), false);
  assert.equal(Boolean(evidence.statusFlags & RESIDENT_NEIGHBORHOOD_STATUS_FLAG.FAIL_CLOSED), true);
  assert.equal(descriptor.admission.consumerDispatchAllowed, false);
  assert.equal(descriptor.admission.stateMutationAllowed, false);
  assert.equal(descriptor.packedCsr.headerU32[31], 0);
  assert.equal(descriptor.packedCsr.headerU32[33], 1);
});

test('self policy partitions every enabled consumer and permits explicit overrides', () => {
  const canonical = normalizeResidentNeighborhoodSelfInclusionPolicy({}, { consumerMask: 0xff });
  const overridden = normalizeResidentNeighborhoodSelfInclusionPolicy({
    contact: 'include',
    pressureInterface: 'exclude'
  }, { consumerMask: 0xff });

  assert.equal(canonical.complete, true);
  assert.equal(canonical.includeConsumerMask, RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE
    | RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION);
  assert.equal(canonical.coveredConsumerMask, 0xff);
  assert.equal(overridden.byConsumer.contact, 'include');
  assert.equal(overridden.byConsumer.pressureInterface, 'exclude');
  assert.throws(() => normalizeResidentNeighborhoodSelfInclusionPolicy({
    includeConsumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
    excludeConsumerMask: 0
  }, {
    consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS
      | RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL
  }), /cover every enabled consumer/);
});

test('generation and lease validation rejects stale resident handles fail closed', () => {
  const descriptor = createReadyDescriptor();
  const current = validateResidentNeighborhoodLease(descriptor, {
    generation: 23,
    positionEpoch: 101,
    leaseId: 'neighborhood-lease-23',
    laneId: 'compute-manager-lane-0',
    stateKey: 'simulation/hot-state/23',
    sourceFamily: 'sph-particle-state',
    leaseTokenLow: 0x89ab_cdef,
    leaseTokenHigh: 0x0123_4567
  });
  const stale = validateResidentNeighborhoodLease(descriptor, {
    generation: 24,
    positionEpoch: 102,
    leaseId: 'neighborhood-lease-23',
    leaseTokenLow: 0
  });

  assert.equal(current.status, 'resident-neighborhood-lease-valid');
  assert.equal(current.consumerDispatchAllowed, true);
  assert.equal(current.stateMutationAllowed, false);
  assert.equal(stale.status, 'resident-neighborhood-lease-invalid-fail-closed');
  assert.equal(stale.identityValid, false);
  assert.equal(stale.consumerDispatchAllowed, false);
  assert.deepEqual(stale.mismatches, ['generation', 'positionEpoch', 'leaseTokenLow']);

  const movedBeyondSkin = validateResidentNeighborhoodLease(descriptor, {
    generation: 23,
    positionEpoch: 101,
    leaseId: 'neighborhood-lease-23',
    maxDisplacementM: 0.201
  });
  assert.equal(movedBeyondSkin.capacityAdmitted, true);
  assert.equal(movedBeyondSkin.descriptorAdmitted, true);
  assert.equal(movedBeyondSkin.positionValid, false);
  assert.equal(movedBeyondSkin.rebuildRequired, true);
  assert.equal(movedBeyondSkin.consumerDispatchAllowed, false);
});

test('authoritative descriptor binds its GPU token to the acquired ComputeManager identity', () => {
  const leaseAuthorityIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'neighborhood-lease-23',
    laneId: 'compute-manager-lane-0',
    stateKey: 'simulation/hot-state/23',
    sourceFamily: 'sph-particle-state'
  };
  const expected = createResidentNeighborhoodAuthorityToken(leaseAuthorityIdentity);
  const descriptor = createReadyDescriptor({ leaseAuthorityIdentity });

  assert.equal(descriptor.lease.authoritative, true);
  assert.equal(descriptor.lease.identitySchema, leaseAuthorityIdentity.schema);
  assert.equal(descriptor.lease.tokenBinding, expected.binding);
  assert.equal(descriptor.lease.tokenLow, expected.low);
  assert.equal(descriptor.lease.tokenHigh, expected.high);
  const mismatch = validateResidentNeighborhoodLease(descriptor, {
    sourceFamily: 'different-state-family'
  });
  assert.deepEqual(mismatch.mismatches, ['sourceFamily']);
  assert.equal(mismatch.consumerDispatchAllowed, false);
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
  assert.equal(row[29], evidence.required.bytes >>> 0);
  assert.equal(row[30] > 0, true);
  assert.equal(row.length, RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length);
});

test('position validity uses a conservative two-endpoint displacement envelope', () => {
  const exact = createResidentNeighborhoodPositionValidity({
    positionEpoch: 8,
    skinDistanceM: 0.5,
    maxDisplacementM: 0.25
  });
  const exceeded = createResidentNeighborhoodPositionValidity({
    positionEpoch: 8,
    skinDistanceM: 0.5,
    maxDisplacementM: 0.250001
  });

  assert.equal(exact.valid, true);
  assert.equal(exact.displacementBudgetM, 0.25);
  assert.equal(exact.pairClosureBoundM, 0.5);
  assert.equal(exceeded.valid, false);
  assert.equal(exceeded.rebuildRequired, true);
});
