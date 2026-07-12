import {
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA
} from '../../../ulg-gpu-abi/src/residentNeighborhood.js';
import { ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA } from
  '../../../ulg-gpu-abi/src/residentNeighborhoodBuilderWgsl.js';
import { validateResidentNeighborhoodLease } from './residentNeighborhoodGpu.js';
import { webGpuDeviceMismatchInfo } from './sphGpuDeviceIdentity.js';

export const ULG_RESIDENT_NEIGHBORHOOD_CONSUMER_ADMISSION_SCHEMA =
  'peercompute.ulg.resident-neighborhood-consumer-admission.v0';

const UINT32_MAX = 0xffff_ffff;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const HEADER_BYTES = RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT.length * U32_BYTES;

const CONSUMER_BITS = Object.freeze({
  mechanics: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
  contact: RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT,
  thermal: RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL,
  radiation: RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION,
  reaction: RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION,
  pressureInterface: RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE,
  solidKinematics: RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS,
  ssUniqueNodeCompaction: RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION
});

function uint32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a uint32`);
  }
  return number >>> 0;
}

export function residentNeighborhoodConsumerBit(consumer) {
  const bit = typeof consumer === 'string'
    ? CONSUMER_BITS[consumer]
    : uint32(consumer, 'consumer');
  if (!bit || (bit & (bit - 1)) !== 0) {
    throw new RangeError('consumer must identify exactly one resident-neighborhood family');
  }
  return bit >>> 0;
}

function rejected({ consumerBit, reasonCodes, descriptor = null, mismatch = null }) {
  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_CONSUMER_ADMISSION_SCHEMA,
    status: 'resident-neighborhood-consumer-rejected-fail-closed',
    mode: 'resident-neighborhood-unavailable',
    admitted: false,
    consumerDispatchAllowed: false,
    stateMutationAllowed: false,
    consumerBit,
    descriptor,
    packedCandidateCsrBuffer: null,
    expectedIdentity: null,
    reasonCodes,
    deviceMismatch: mismatch?.mismatch === true,
    sourceDeviceId: mismatch?.sourceDeviceId ?? null,
    consumerDeviceId: mismatch?.consumerDeviceId ?? null,
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false
  };
}

/**
 * Resolve an already encoded resident-neighborhood build for a same-device
 * consumer. The packed GPU header remains the execution-time authority; this
 * host gate only rejects stale leases, missing capabilities, or cross-device
 * buffers without mapping any hot state.
 */
export function resolveResidentNeighborhoodConsumer({
  residentNeighborhood,
  device,
  consumer,
  sourceCount,
  generation,
  positionEpoch,
  maxDisplacementM,
  leaseId,
  laneId,
  stateKey,
  sourceFamily,
  leaseTokenLow,
  leaseTokenHigh
} = {}) {
  const consumerBit = residentNeighborhoodConsumerBit(consumer);
  if (!residentNeighborhood) {
    return rejected({ consumerBit, reasonCodes: ['resident-neighborhood-not-provided'] });
  }
  if (residentNeighborhood.schema !== ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA) {
    return rejected({ consumerBit, reasonCodes: ['resident-neighborhood-builder-schema-mismatch'] });
  }
  const descriptor = residentNeighborhood.descriptor;
  if (descriptor?.schema !== ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA) {
    return rejected({
      consumerBit,
      descriptor,
      reasonCodes: ['resident-neighborhood-descriptor-schema-mismatch']
    });
  }
  const packedResource = residentNeighborhood.resources?.outputs?.sourceCandidateCsr;
  const packedCandidateCsrBuffer = packedResource?.buffer
    ?? residentNeighborhood.retainedBuffers?.packedCandidateCsrBuffer
    ?? null;
  const reasonCodes = [];
  if (residentNeighborhood.hostAdmission !== true) reasonCodes.push('host-admission-rejected');
  if (residentNeighborhood.encoded !== true) reasonCodes.push('build-not-encoded');
  if (residentNeighborhood.released === true) reasonCodes.push('build-released');
  if (!packedCandidateCsrBuffer) reasonCodes.push('packed-csr-buffer-missing');
  if (packedCandidateCsrBuffer
    && Number.isFinite(Number(packedCandidateCsrBuffer.size))
    && Number(packedCandidateCsrBuffer.size) < HEADER_BYTES) {
    reasonCodes.push('packed-csr-buffer-too-small');
  }
  if ((descriptor.consumerMask & consumerBit) === 0) {
    reasonCodes.push('consumer-family-not-enabled');
  }
  if (sourceCount !== undefined
    && descriptor.capacityEvidence.sourceCount !== uint32(sourceCount, 'sourceCount')) {
    reasonCodes.push('source-count-mismatch');
  }
  const leaseValidation = validateResidentNeighborhoodLease(descriptor, {
    generation,
    positionEpoch,
    maxDisplacementM,
    leaseId,
    laneId,
    stateKey,
    sourceFamily,
    leaseTokenLow,
    leaseTokenHigh
  });
  reasonCodes.push(...leaseValidation.mismatches.map((field) => `${field}-mismatch`));
  if (!leaseValidation.positionValid) reasonCodes.push('position-skin-envelope-invalid');
  if (!leaseValidation.descriptorAdmitted) reasonCodes.push('descriptor-admission-rejected');
  const mismatch = webGpuDeviceMismatchInfo({ buffer: packedCandidateCsrBuffer, device });
  if (device && packedCandidateCsrBuffer && mismatch.sourceDeviceId === null) {
    reasonCodes.push('gpu-device-identity-unavailable');
  }
  if (mismatch.mismatch) reasonCodes.push('gpu-device-mismatch');
  if (reasonCodes.length > 0) {
    return rejected({ consumerBit, descriptor, reasonCodes, mismatch });
  }
  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_CONSUMER_ADMISSION_SCHEMA,
    status: 'resident-neighborhood-consumer-admitted-pending-gpu-header-guard',
    mode: 'resident-neighborhood-packed-csr',
    admitted: true,
    consumerDispatchAllowed: 'packed-header-gpu-guarded',
    stateMutationAllowed: false,
    consumerBit,
    descriptor,
    packedCandidateCsrBuffer,
    packedCandidateCsrByteLength: Number(
      packedResource?.byteLength ?? packedCandidateCsrBuffer.size ?? descriptor.packedCsr.backingBufferByteLength
    ),
    expectedIdentity: {
      generation: descriptor.generation >>> 0,
      leaseTokenLow: descriptor.lease.tokenLow >>> 0,
      leaseTokenHigh: descriptor.lease.tokenHigh >>> 0,
      positionEpoch: descriptor.positionValidity.positionEpoch >>> 0,
      sourceCount: descriptor.capacityEvidence.sourceCount >>> 0,
      sourceFamily: descriptor.lease.sourceFamily,
      consumerBit
    },
    reasonCodes: [],
    deviceMismatch: false,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId,
    submissionOwnership: 'caller',
    commandEncoderOwnership: 'caller',
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false
  };
}

export function createResidentNeighborhoodConsumerGuardU32(admission, {
  mode = 2,
  wordCount = 8
} = {}) {
  if (!Number.isInteger(wordCount) || wordCount < 8) {
    throw new RangeError('wordCount must be an integer of at least 8');
  }
  const output = new Uint32Array(wordCount);
  if (!admission?.admitted) return output;
  const identity = admission.expectedIdentity;
  output[0] = uint32(mode, 'mode');
  output[1] = identity.generation;
  output[2] = identity.leaseTokenLow;
  output[3] = identity.leaseTokenHigh;
  output[4] = identity.positionEpoch;
  output[5] = identity.sourceCount;
  output[6] = identity.consumerBit;
  output[7] = 1;
  return output;
}
