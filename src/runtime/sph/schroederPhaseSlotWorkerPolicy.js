import { schroederAuthorityTextFingerprint } from './schroederAuthorityFingerprint.js';

// Clone only control-plane receipts. GPU state and occupancy never cross the
// page/worker boundary through this policy, and this descriptor grants no new
// authority: each existing allocator/materializer still validates its receipt.
export const PHASE_SLOT_ADMISSION_FIELDS = Object.freeze([
  'phaseVolumeSplitMergeAdmission', 'particleStorageAllocatorAdmission',
  'particleStorageSlotAssignmentAdmission', 'particleStorageMaterializationAdmission'
]);

function clonePlain(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (depth > 12 || !value || typeof value !== 'object' || seen.has(value)
      || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError('Phase-slot worker admission must contain acyclic plain control-plane values');
  }
  seen.add(value);
  const copy = Array.isArray(value)
    ? value.map(entry => clonePlain(entry, seen, depth + 1))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, clonePlain(value[key], seen, depth + 1)]));
  seen.delete(value);
  return Object.freeze(copy);
}

export function cloneSchroederPhaseSlotWorkerAdmissions(value) {
  if (!value || Object.keys(value).length !== PHASE_SLOT_ADMISSION_FIELDS.length
      || PHASE_SLOT_ADMISSION_FIELDS.some(field => !value[field]
        || typeof value[field] !== 'object' || Array.isArray(value[field]))) {
    throw new TypeError('Phase-slot worker policy requires all four storage admission receipts');
  }
  return clonePlain(value);
}

export function schroederPhaseSlotAdmissionFingerprint(value) {
  return schroederAuthorityTextFingerprint(
    JSON.stringify(cloneSchroederPhaseSlotWorkerAdmissions(value)), 'phase-slot-admissions');
}
