import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { cloneSchroederSplitSpareReserve, splitSpareReservesEqual } from './schroederSplitSpareReserve.js';
import { assertSphLegacyMassPathAllowed, validateSphParticleExactMassRead } from './sphGpuBuffers.js';
// First-class air, slice 1b (plan/todo/first-class-air.md): GPU discovery of
// free SS split-spare lineages on the worker lane's phase-carrier v2 layout.
//
// Split-spare lineages are a contiguous lineage range appended at scene build
// (`appendSplitSpareLineages`, status 252 while dormant). Row addressing is
// lane-major: row = lane * lineageCapacity + lineage. A spare lineage is free
// when every one of its phase lanes carries zero mass, so a merge that empties
// a lineage returns it to the pool without restamping any status.
//
// The scan is exact and deterministic, like the reaction-product spare pool:
// a per-workgroup exclusive prefix, then a serial scan of the group totals,
// then a scatter in ascending lineage order. No atomics order the output.
// It publishes:
//   spare_lineages[k]  the k-th free lineage (ascending), 0xffffffff past the
//                      free count;
//   free_list[0..7]    one stride-8 free-list row for the existing slot
//                      assignment stage: baseSlotIndex 0, slotCapacity and
//                      availableSlotCount = free count, maxSlotsPerRow,
//                      committedEpoch, targetStateFamilyMask 0, status 1;
//                      a "slot" there is a rank into spare_lineages.

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPLIT_SPARE_FREE_LIST_STRIDE = 8;
export const SCHROEDER_SPLIT_SPARE_INVALID_LINEAGE = 0xffffffff;
const PARAMS_BYTES = 48;

function createSplitSpareScanWgsl(ledger) { return /* wgsl */ `
struct SplitSpareScanParams {
  lineage_capacity: u32,
  lane_count: u32,
  first_spare_lineage: u32,
  spare_count: u32,
  state_stride_vec4: u32,
  group_count: u32,
  max_slots_per_row: u32,
  epoch: u32,
  ledger_words: u32, mass_offset: u32, ledger_rows: u32, pad: u32,
};

@group(0) @binding(0) var<storage, read> state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> local_prefix: array<u32>;
@group(0) @binding(2) var<storage, read_write> group_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> spare_lineages: array<u32>;
@group(0) @binding(4) var<storage, read_write> free_list: array<f32>;
@group(0) @binding(5) var<uniform> params: SplitSpareScanParams;
${ledger ? `@group(0) @binding(6) var<storage, read> exact_mass: array<u32>;
@group(0) @binding(7) var<storage, read> exact_energy: array<u32>;` : ''}

const WORKGROUP: u32 = ${SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE}u;
const FLAG_BIT: u32 = 0x80000000u;
const INVALID_LINEAGE: u32 = 0xffffffffu;

var<workgroup> scan: array<u32, ${SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE}>;

fn finite_f32(value: f32) -> bool {
  return (bitcast<u32>(value) & 0x7f800000u) != 0x7f800000u;
}

// Free means provably empty in every lane. A non-finite mass is not free.
fn lineage_free(spare: u32) -> bool {
  let lineage = params.first_spare_lineage + spare;
  for (var lane = 0u; lane < params.lane_count; lane = lane + 1u) {
    let row = lane * params.lineage_capacity + lineage;
    ${ledger ? `for (var w = 0u; w < params.ledger_words; w++) {
      let m = params.mass_offset + row * params.ledger_words + w;
      let u = row * params.ledger_words + w;
      let s = (params.ledger_rows + row) * params.ledger_words + w;
      if (m >= arrayLength(&exact_mass) || s >= arrayLength(&exact_energy)
          || exact_mass[m] != 0u || exact_energy[u] != 0u || exact_energy[s] != 0u) { return false; }
    }` : ''}
    let index = row * params.state_stride_vec4;
    if (index >= arrayLength(&state_rows)) { return false; }
    let mass = state_rows[index].w;
    if (!finite_f32(mass) || mass != 0.0) { return false; }
  }
  return true;
}

@compute @workgroup_size(${SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE})
fn mark_free_spares(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let spare = global_id.x;
  let lane = local_id.x;
  var flag = 0u;
  if (spare < params.spare_count && lineage_free(spare)) { flag = 1u; }
  scan[lane] = flag;
  workgroupBarrier();
  // Hillis-Steele inclusive scan; the exclusive prefix is inclusive - flag.
  var offset = 1u;
  loop {
    if (offset >= WORKGROUP) { break; }
    var add = 0u;
    if (lane >= offset) { add = scan[lane - offset]; }
    workgroupBarrier();
    scan[lane] = scan[lane] + add;
    workgroupBarrier();
    offset = offset * 2u;
  }
  if (spare < params.spare_count) {
    local_prefix[spare] = (scan[lane] - flag) | select(0u, FLAG_BIT, flag == 1u);
  }
  if (lane == WORKGROUP - 1u && workgroup_id.x < params.group_count) {
    group_offsets[workgroup_id.x] = scan[lane];
  }
}

// One invocation: exclusive prefix over the group totals, the total at
// [group_count], and the free-list row for slot assignment.
@compute @workgroup_size(1)
fn scan_group_totals() {
  var running = 0u;
  for (var group = 0u; group < params.group_count; group = group + 1u) {
    let total = group_offsets[group];
    group_offsets[group] = running;
    running = running + total;
  }
  group_offsets[params.group_count] = running;
  free_list[0] = 0.0;
  free_list[1] = f32(running);
  free_list[2] = f32(running);
  free_list[3] = f32(params.max_slots_per_row);
  free_list[4] = f32(params.epoch);
  free_list[5] = 0.0;
  free_list[6] = 1.0;
  free_list[7] = 0.0;
}

@compute @workgroup_size(${SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE})
fn scatter_free_spares(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let spare = global_id.x;
  if (spare >= params.spare_count) { return; }
  let total = group_offsets[params.group_count];
  let packed = local_prefix[spare];
  if ((packed & FLAG_BIT) != 0u) {
    let rank = group_offsets[spare / WORKGROUP] + (packed & ~FLAG_BIT);
    spare_lineages[rank] = params.first_spare_lineage + spare;
  }
  // Ranks below the total are written by flagged spares above; the tail is
  // disjoint, so the sentinel fill never races a lineage write.
  if (spare >= total) { spare_lineages[spare] = INVALID_LINEAGE; }
}
`;
}
export const schroederSplitSpareLineageScanWgsl = createSplitSpareScanWgsl(false);

const BINDINGS = [
  computeBufferBinding(0, 'read-only-storage'),
  computeBufferBinding(1, 'storage'),
  computeBufferBinding(2, 'storage'),
  computeBufferBinding(3, 'storage'),
  computeBufferBinding(4, 'storage'),
  computeBufferBinding(5, 'uniform')
];

function positiveInteger(value, name, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) {
    throw new RangeError(`${name} must be an integer >= ${min}`);
  }
  return number;
}

function pipelinesFor(device, ledger) {
  const make = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-schroeder-split-spare-scan.${entryPoint}.${ledger ? "integer" : "f32"}.v2`,
    label: `ulg-schroeder-split-spare-scan-${entryPoint}`,
    code: createSplitSpareScanWgsl(ledger),
    entryPoint,
    bindings: ledger ? [...BINDINGS, computeBufferBinding(6, 'read-only-storage'), computeBufferBinding(7, 'read-only-storage')] : BINDINGS
  });
  return {
    mark: make('mark_free_spares'),
    scan: make('scan_group_totals'),
    scatter: make('scatter_free_spares')
  };
}

/** Allocate the scan's resident buffers for a fixed spare-lineage count. */
export function createSchroederSplitSpareLineageScan(device, {
  spareCount,
  label = 'ulg-schroeder-split-spare-scan'
} = {}) {
  const count = positiveInteger(spareCount, 'spareCount', { min: 1 });
  const groupCount = Math.ceil(count / SCHROEDER_SPLIT_SPARE_SCAN_WORKGROUP_SIZE);
  const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const buffer = (suffix, bytes, usage = storage) => tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-${suffix}`,
    size: Math.max(16, Math.ceil(bytes / 16) * 16),
    usage
  }), device);
  return Object.freeze({
    spareCount: count,
    groupCount,
    localPrefixBuffer: buffer('local-prefix', count * 4),
    groupOffsetsBuffer: buffer('group-offsets', (groupCount + 1) * 4),
    spareLineagesBuffer: buffer('lineages', count * 4),
    freeListBuffer: buffer('free-list', SCHROEDER_SPLIT_SPARE_FREE_LIST_STRIDE * 4),
    paramsBuffer: buffer('params', PARAMS_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
  });
}

/**
 * Encode the scan into `encoder` (three compute passes). The state buffer is
 * the lane-major MLS-MPM/SPH particle state (vec4 rows, mass in row 0 .w).
 */
export function encodeSchroederSplitSpareLineageScan(device, encoder, {
  scan,
  stateBuffer,
  lineageCapacity,
  laneCount = 4,
  firstSpareLineage,
  stateStrideVec4 = 2,
  maxSlotsPerRow = 8,
  epoch = 0, exactLedger = null
} = {}) {
  if (!scan?.spareLineagesBuffer) throw new TypeError('encodeSchroederSplitSpareLineageScan requires a scan');
  if (!stateBuffer) throw new TypeError('encodeSchroederSplitSpareLineageScan requires a state buffer');
  const capacity = positiveInteger(lineageCapacity, 'lineageCapacity', { min: 1 });
  const lanes = positiveInteger(laneCount, 'laneCount', { min: 1 });
  const first = positiveInteger(firstSpareLineage, 'firstSpareLineage');
  if (first + scan.spareCount > capacity) {
    throw new RangeError('split-spare lineages exceed the phase-lane stride');
  }
  device.queue.writeBuffer(scan.paramsBuffer, 0, new Uint32Array([
    capacity, lanes, first, scan.spareCount,
    positiveInteger(stateStrideVec4, 'stateStrideVec4', { min: 1 }),
    scan.groupCount,
    positiveInteger(maxSlotsPerRow, 'maxSlotsPerRow', { min: 1 }),
    positiveInteger(epoch, 'epoch') >>> 0,
    exactLedger?.massRead.format.wordCount ?? 0, (exactLedger?.massRead.byteOffset ?? 0) / 4,
    exactLedger?.massRead.rowCount ?? 0, 0
  ]));
  const pipelines = pipelinesFor(device, Boolean(exactLedger));
  const group = device.createBindGroup({
    label: 'ulg-schroeder-split-spare-scan-group',
    layout: pipelines.mark.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: scan.localPrefixBuffer } },
      { binding: 2, resource: { buffer: scan.groupOffsetsBuffer } },
      { binding: 3, resource: { buffer: scan.spareLineagesBuffer } },
      { binding: 4, resource: { buffer: scan.freeListBuffer } },
      { binding: 5, resource: { buffer: scan.paramsBuffer } },
      ...(exactLedger ? [{ binding: 6, resource: { buffer: exactLedger.massRead.buffer } },
        { binding: 7, resource: { buffer: exactLedger.energy.energyBuffer } }] : [])
    ]
  });
  const passes = [
    [pipelines.mark, scan.groupCount],
    [pipelines.scan, 1],
    [pipelines.scatter, scan.groupCount]
  ];
  for (const [pipeline, groups] of passes) {
    const pass = encoder.beginComputePass({ label: `${pipeline.label ?? 'split-spare-scan'}-pass` });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(groups);
    pass.end();
  }
  return Object.freeze({
    spareLineagesBuffer: scan.spareLineagesBuffer,
    freeListBuffer: scan.freeListBuffer,
    groupOffsetsBuffer: scan.groupOffsetsBuffer,
    spareCount: scan.spareCount
  });
}

// The hierarchy owns these buffers until slot assignment and the post-phase
// writer have submitted their last reads. Occupancy stays entirely on the GPU.
export function runSchroederSplitSpareLineageScanWebGpu(args) {
  const { device, sphParticleState, mlsMpmParticleState, sphParticleUpload,
    mlsMpmParticleUpload, epoch = 0 } = args;
  const exactSource = args.exactMassSourceRead ?? null;
  if (exactSource) {
    if (!validateSphParticleExactMassRead(exactSource, { device, sourceSphUpload: sphParticleUpload })
        || !exactSource.energy || exactSource.energy.rowCount !== sphParticleState.particleCount) {
      throw new TypeError('Phase-slot spare scan requires its original current integer-ledger source');
    }
  } else assertSphLegacyMassPathAllowed(args, 'Phase-slot spare scan');
  const count = sphParticleState?.particleCount;
  const sources = [sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload];
  const reserves = sources.map(source => {
    if (source?.particleCount !== count || source?.phaseCarrierPlan?.phaseLaneCount !== 4) {
      throw new RangeError('Phase-slot spare scan requires matching four-lane source families');
    }
    return cloneSchroederSplitSpareReserve(source.phaseCarrierPlan, count);
  });
  if (!reserves[0] || reserves.some(reserve => !splitSpareReservesEqual(reserve, reserves[0]))) {
    throw new RangeError('Phase-slot spare scan requires one matching split reserve');
  }
  if (!sphParticleUpload?.stateBuffer || webGpuBufferDevice(sphParticleUpload.stateBuffer) !== device) {
    throw new TypeError('Phase-slot spare scan requires the resident same-device state buffer');
  }
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch > 0x00ffffff) {
    throw new RangeError('Phase-slot spare scan epoch must be an exactly represented nonnegative f32 integer');
  }
  const scan = createSchroederSplitSpareLineageScan(device, { spareCount: reserves[0].count });
  let destroyed = false;
  const destroyScanBuffers = () => {
    if (destroyed) return true;
    for (const buffer of [scan.localPrefixBuffer, scan.groupOffsetsBuffer, scan.spareLineagesBuffer,
      scan.freeListBuffer, scan.paramsBuffer]) buffer.destroy();
    destroyed = true;
    return true;
  };
  try {
    const encoder = device.createCommandEncoder({ label: 'ulg-phase-slot-free-lineages' });
    encodeSchroederSplitSpareLineageScan(device, encoder, { scan,
      stateBuffer: sphParticleUpload.stateBuffer,
      lineageCapacity: sphParticleState.phaseCarrierPlan.lineageCapacity,
      firstSpareLineage: reserves[0].firstLineageIndex, epoch,
      exactLedger: exactSource ? { massRead: exactSource.read, energy: exactSource.energy } : null });
    device.queue.submit([encoder.finish()]);
    return { ...scan, destroyScanBuffers, status: 'phase-slot-spare-scan-submitted',
      backend: 'webgpu', readbackMode: 'no-full-readback', fullParticleReadbackFree: true,
      fullParticleReadbackPerformed: false, mapAsyncCount: 0, readbackBytes: 0, hostQueueFenceCount: 0 };
  } catch (error) { destroyScanBuffers(); throw error; }
}
