import {
  ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA,
  parseRowLayoutDescriptor,
  resolveLayoutFieldOffset
} from './laneAccessorGenerator.js';

export const ULG_REPRESENTED_VOLUME_SCHEMA =
  'peercompute.ulg.represented-volume.v1';

const REPRESENTED_VOLUME_BRAND = Symbol('ulg.representedVolume');

function requireFinitePositive(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || !(n > 0)) {
    throw new RangeError(`${label} must be finite and > 0 (got ${value})`);
  }
  return n;
}

function makeRepresentedVolume(restVolumeM3, volumeRatioJ, currentVolumeM3, origin) {
  const v0 = requireFinitePositive(restVolumeM3, 'restVolumeM3');
  const j = requireFinitePositive(volumeRatioJ, 'volumeRatioJ');
  const current = requireFinitePositive(currentVolumeM3, 'currentVolumeM3');
  const expectedCurrent = v0 * j;
  if (!Number.isFinite(expectedCurrent) || Math.abs(current - expectedCurrent) > 1e-6 * Math.max(1, expectedCurrent, current)) {
    throw new RangeError(
      `RepresentedVolume invariant violated: V0*J (${expectedCurrent}) != currentVolumeM3 (${current})`
    );
  }
  return Object.freeze({
    [REPRESENTED_VOLUME_BRAND]: true,
    schema: ULG_REPRESENTED_VOLUME_SCHEMA,
    restVolumeM3: v0,
    volumeRatioJ: j,
    currentVolumeM3: current,
    origin
  });
}

export function isRepresentedVolume(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value[REPRESENTED_VOLUME_BRAND] === true
    && value.schema === ULG_REPRESENTED_VOLUME_SCHEMA
  );
}

export function assertRepresentedVolume(value, label = 'representedVolume') {
  if (!isRepresentedVolume(value)) {
    throw new TypeError(
      `${label} must be constructed via a RepresentedVolume constructor (V0 and J cannot be assigned independently)`
    );
  }
  return value;
}

/**
 * Construct a paired `(V0, J = 1)` represented volume at rest density for a given mass.
 */
export function representedVolumeAtRestState(massKg, restDensityKgPerM3) {
  const m = requireFinitePositive(massKg, 'massKg');
  const rho0 = requireFinitePositive(restDensityKgPerM3, 'restDensityKgPerM3');
  const v0 = m / rho0;
  return makeRepresentedVolume(v0, 1.0, v0, 'at-rest-state');
}

/**
 * Construct a paired `(V0, J = Vcurrent / V0)` represented volume from an explicit
 * reference rest volume and physical current volume.
 */
export function representedVolumeFromCurrent(restVolumeM3, currentVolumeM3) {
  const v0 = requireFinitePositive(restVolumeM3, 'restVolumeM3');
  const current = requireFinitePositive(currentVolumeM3, 'currentVolumeM3');
  return makeRepresentedVolume(v0, current / v0, current, 'from-current');
}

/**
 * Compute 3x3 determinant of a row-major 9-element deformation gradient F.
 */
export function deformationGradientDeterminant(F) {
  if ((!Array.isArray(F) && !ArrayBuffer.isView(F)) || F.length < 9) {
    throw new TypeError('deformationGradientDeterminant requires a 9-element row-major matrix');
  }
  const f00 = Number(F[0]), f01 = Number(F[1]), f02 = Number(F[2]);
  const f10 = Number(F[3]), f11 = Number(F[4]), f12 = Number(F[5]);
  const f20 = Number(F[6]), f21 = Number(F[7]), f22 = Number(F[8]);
  return (
    f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20)
  );
}

/**
 * Construct a paired `(V0, J = det(F))` represented volume from rest volume and F.
 */
export function representedVolumeFromDeformationGradient(restVolumeM3, deformationF9) {
  const v0 = requireFinitePositive(restVolumeM3, 'restVolumeM3');
  const j = deformationGradientDeterminant(deformationF9);
  if (!Number.isFinite(j) || !(j > 0)) {
    throw new RangeError(`Deformation gradient determinant det(F) must be finite and > 0 (got ${j})`);
  }
  return makeRepresentedVolume(v0, j, v0 * j, 'from-deformation-gradient');
}

/**
 * Safely re-base a particle's represented volume onto a new target phase rest
 * density while conserving exact physical current volume `Vcurrent = V0_new * J_new`.
 * Prevents the Slice 9 blow-up where V0_target was combined with stale J_source.
 */
export function retargetRepresentedVolumeToPhase(currentVolume, massKg, targetRestDensityKgPerM3) {
  const src = assertRepresentedVolume(currentVolume, 'currentVolume');
  const m = requireFinitePositive(massKg, 'massKg');
  const rhoTarget = requireFinitePositive(targetRestDensityKgPerM3, 'targetRestDensityKgPerM3');
  const v0Target = m / rhoTarget;
  return makeRepresentedVolume(v0Target, src.currentVolumeM3 / v0Target, src.currentVolumeM3, 'retarget-phase');
}

/**
 * Split a represented volume into `childCount` equal children conserving exact total
 * rest volume, current volume, and deformation ratio J.
 */
export function splitRepresentedVolume(volume, childCount) {
  const src = assertRepresentedVolume(volume, 'volume');
  const n = Number(childCount);
  if (!Number.isSafeInteger(n) || n < 2) {
    throw new RangeError(`splitRepresentedVolume requires integer childCount >= 2 (got ${childCount})`);
  }
  const child = makeRepresentedVolume(
    src.restVolumeM3 / n,
    src.volumeRatioJ,
    src.currentVolumeM3 / n,
    'split'
  );
  return Object.freeze({ child, count: n });
}

/**
 * Merge multiple represented volumes conservatively: sums V0 and Vcurrent and
 * derives the unique consistent `J = sum(Vcurrent) / sum(V0)`.
 */
export function mergeRepresentedVolumes(volumes) {
  if (!Array.isArray(volumes) || volumes.length === 0) {
    throw new TypeError('mergeRepresentedVolumes requires a non-empty array of RepresentedVolume');
  }
  let sumV0 = 0;
  let sumCurrent = 0;
  for (let i = 0; i < volumes.length; i += 1) {
    const vol = assertRepresentedVolume(volumes[i], `volumes[${i}]`);
    sumV0 += vol.restVolumeM3;
    sumCurrent += vol.currentVolumeM3;
  }
  return makeRepresentedVolume(sumV0, sumCurrent / sumV0, sumCurrent, 'merge');
}

/**
 * Read a validated paired RepresentedVolume from a packed MLS-MPM mechanics array
 * using offsets derived directly from `mechanicsLayout` (zero hardcoded indices).
 */
export function readRepresentedVolumeFromMechanicsRow(mechanicsRows, rowFloatOffset, mechanicsLayout) {
  const jField = resolveLayoutFieldOffset(mechanicsLayout, 'volumeRatioJ', {
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT'
  });
  const v0Field = resolveLayoutFieldOffset(mechanicsLayout, 'restVolumeM3', {
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT'
  });
  const j = mechanicsRows[rowFloatOffset + jField.scalarIndex];
  const v0 = mechanicsRows[rowFloatOffset + v0Field.scalarIndex];
  return makeRepresentedVolume(v0, j, v0 * j, 'mechanics-row');
}

/**
 * Atomically write BOTH `volumeRatioJ` and `restVolumeM3` of a validated
 * RepresentedVolume into a packed MLS-MPM mechanics array from layout offsets.
 */
export function writeRepresentedVolumeToMechanicsRow(mechanicsRows, rowFloatOffset, volume, mechanicsLayout) {
  const vol = assertRepresentedVolume(volume, 'volume');
  const jField = resolveLayoutFieldOffset(mechanicsLayout, 'volumeRatioJ', {
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT'
  });
  const v0Field = resolveLayoutFieldOffset(mechanicsLayout, 'restVolumeM3', {
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT'
  });
  mechanicsRows[rowFloatOffset + jField.scalarIndex] = vol.volumeRatioJ;
  mechanicsRows[rowFloatOffset + v0Field.scalarIndex] = vol.restVolumeM3;
  return vol;
}

/**
 * Generate WGSL `RepresentedVolume` struct and paired constructors/loaders whose
 * mechanics buffer indices are derived strictly from `mechanicsLayout`.
 */
export function generateRepresentedVolumeWgsl({
  mechanicsLayout,
  bufferName = 'mls_mechanics'
} = {}) {
  const parsed = mechanicsLayout?.schema === ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA
    ? mechanicsLayout
    : parseRowLayoutDescriptor(mechanicsLayout, {
        layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
        requireVec4Aligned: true
      });
  const jField = resolveLayoutFieldOffset(parsed, 'volumeRatioJ');
  const v0Field = resolveLayoutFieldOffset(parsed, 'restVolumeM3');
  const stride = parsed.vec4Stride;
  return `// Generated paired RepresentedVolume WGSL (derived from ${parsed.layoutName})
struct RepresentedVolume {
  v0_m3: f32,
  j: f32,
  current_m3: f32,
  valid: u32,
};

fn represented_volume_invalid() -> RepresentedVolume {
  return RepresentedVolume(0.0, 0.0, 0.0, 0u);
}

fn represented_volume_from_pair(v0_m3: f32, j: f32) -> RepresentedVolume {
  let finite_ok = v0_m3 == v0_m3 && j == j && v0_m3 > 0.0 && j > 0.0;
  let current_m3 = select(0.0, v0_m3 * j, finite_ok);
  let valid = select(0u, 1u, finite_ok && current_m3 == current_m3 && current_m3 > 0.0);
  return RepresentedVolume(
    select(0.0, v0_m3, valid == 1u),
    select(0.0, j, valid == 1u),
    select(0.0, current_m3, valid == 1u),
    valid
  );
}

fn represented_volume_at_rest(mass_kg: f32, rest_density_kg_per_m3: f32) -> RepresentedVolume {
  if (!(mass_kg > 0.0) || !(rest_density_kg_per_m3 > 0.0)) {
    return represented_volume_invalid();
  }
  return represented_volume_from_pair(mass_kg / rest_density_kg_per_m3, 1.0);
}

fn represented_volume_from_current(v0_m3: f32, current_m3: f32) -> RepresentedVolume {
  if (!(v0_m3 > 0.0) || !(current_m3 > 0.0)) {
    return represented_volume_invalid();
  }
  return represented_volume_from_pair(v0_m3, current_m3 / v0_m3);
}

fn represented_volume_retarget_phase(src: RepresentedVolume, mass_kg: f32, target_rest_density_kg_per_m3: f32) -> RepresentedVolume {
  if (src.valid == 0u || !(mass_kg > 0.0) || !(target_rest_density_kg_per_m3 > 0.0)) {
    return represented_volume_invalid();
  }
  let v0_target = mass_kg / target_rest_density_kg_per_m3;
  return represented_volume_from_current(v0_target, src.current_m3);
}

fn represented_volume_from_mechanics(particle_index: u32) -> RepresentedVolume {
  let j = ${bufferName}[particle_index * ${stride}u + ${jField.vec4Index}u].${jField.component};
  let v0 = ${bufferName}[particle_index * ${stride}u + ${v0Field.vec4Index}u].${v0Field.component};
  return represented_volume_from_pair(v0, j);
}`;
}
