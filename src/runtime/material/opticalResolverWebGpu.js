/**
 * Phase 6: True WebGPU-Derived Optical & Spectral Material Resolver.
 *
 * Computes Drude-Lorentz + spin-orbit relativistic interband dielectric
 * response ε(ω), complex refractive index (n, k), normal-incidence Fresnel
 * reflectance R(λ), luminous absorption coefficient α(λ), Frank-Tamm Cherenkov
 * spectral emission, band-gap Beer-Lambert transmission, CIE 1931 (Wyman 2013)
 * tristimulus integration, sRGB encoding, and packed PBR optical rows directly
 * inside a WGSL compute kernel (1 workgroup of 128 threads per material across
 * all 81 visible wavelengths 380..780 nm step 5 nm in parallel).
 *
 * Keeps CPU opticalClosure.js as the non-blocking fallback and reference parity
 * anchor; records explicit `webgpu-derived` status and WGSL program hash guard.
 */

import {
  plasmaFrequencyRadPerS,
  relativisticInterbandOscillators
} from './opticalClosure.js';

export const OPTICAL_RESOLVER_WEBGPU_SCHEMA = 'peercompute.ulg.optical-resolver-webgpu.v1';
export const OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ = 0;
export const OPTICAL_RESOLVER_MODE_CHERENKOV = 1;
export const OPTICAL_RESOLVER_MODE_BAND_GAP = 2;

export const OPTICAL_DESCRIPTOR_FLOATS = 8;
export const OPTICAL_OSCILLATOR_FLOATS = 4;
export const OPTICAL_OUTPUT_ROW_FLOATS = 16;
export const OPTICAL_SPECTRAL_SAMPLES_PER_MATERIAL = 9;
export const OPTICAL_SPECTRAL_SAMPLE_FLOATS = 4;

const HBAR_EV_S = 6.582119569e-16;
const GPU_BUF_STORAGE = 0x0080;
const GPU_BUF_COPY_DST = 0x0008;
const GPU_BUF_COPY_SRC = 0x0004;
const GPU_BUF_MAP_READ = 0x0001;
const GPU_MAP_READ = 0x0001;

export const OPTICAL_RESOLVER_WGSL = /* wgsl */ `
struct OpticalDescriptor {
  plasma_energy_ev: f32,
  damping_ev: f32,
  path_length_m: f32,
  osc_offset: f32,
  osc_count: f32,
  mode: f32,
  param0: f32,
  param1: f32,
};

struct OpticalOscillator {
  energy_ev: f32,
  damping_ev: f32,
  strength_weight: f32,
  _pad: f32,
};

struct OpticalOutputRow {
  base_r: f32,
  base_g: f32,
  base_b: f32,
  reflectance: f32,
  absorption_or_photons: f32,
  optical_depth_or_angle_deg: f32,
  opacity_or_active: f32,
  transmission: f32,
  metalness: f32,
  roughness: f32,
  cie_x: f32,
  cie_y: f32,
  cie_z: f32,
  plasma_energy_ev: f32,
  osc_count: f32,
  mode: f32,
};

struct SpectralSampleRow {
  wavelength_nm: f32,
  reflectance: f32,
  absorption_per_m: f32,
  n_re: f32,
};

@group(0) @binding(0) var<storage, read> descriptors: array<OpticalDescriptor>;
@group(0) @binding(1) var<storage, read> oscillators: array<OpticalOscillator>;
@group(0) @binding(2) var<storage, read_write> outputs: array<OpticalOutputRow>;
@group(0) @binding(3) var<storage, read_write> spectral_samples: array<SpectralSampleRow>;

const PI: f32 = 3.14159265358979323846;
const FINE_STRUCTURE_ALPHA: f32 = 0.0072973525693;
const INTERBAND_STRENGTH_SCALE: f32 = 0.36;
const NUM_WAVELENGTHS: u32 = 81u;

var<workgroup> sh_x: array<f32, 128>;
var<workgroup> sh_y: array<f32, 128>;
var<workgroup> sh_z: array<f32, 128>;
var<workgroup> sh_norm: array<f32, 128>;
var<workgroup> sh_refl: array<f32, 128>;
var<workgroup> sh_abs: array<f32, 128>;
var<workgroup> sh_peak: array<f32, 128>;
var<workgroup> sh_raw_spec: array<f32, 128>;

fn gauss_piecewise(x: f32, mu: f32, s1: f32, s2: f32) -> f32 {
  let inv_s = select(1.0 / s2, 1.0 / s1, x < mu);
  let t = (x - mu) * inv_s;
  return exp(-0.5 * t * t);
}

fn cie_x(nm: f32) -> f32 {
  return 1.056 * gauss_piecewise(nm, 599.8, 37.9, 31.0)
    + 0.362 * gauss_piecewise(nm, 442.0, 16.0, 26.7)
    - 0.065 * gauss_piecewise(nm, 501.1, 20.4, 26.2);
}

fn cie_y(nm: f32) -> f32 {
  return 0.821 * gauss_piecewise(nm, 568.8, 46.9, 40.5)
    + 0.286 * gauss_piecewise(nm, 530.9, 16.3, 31.1);
}

fn cie_z(nm: f32) -> f32 {
  return 1.217 * gauss_piecewise(nm, 437.0, 11.8, 36.0)
    + 0.681 * gauss_piecewise(nm, 459.0, 26.0, 13.8);
}

fn srgb_encode(c: f32) -> f32 {
  let x = clamp(c, 0.0, 1.0);
  if (x <= 0.0031308) {
    return 12.92 * x;
  }
  return 1.055 * pow(max(0.0, x), 1.0 / 2.4) - 0.055;
}

fn cdiv(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  let denom = max(b.x * b.x + b.y * b.y, 1e-30);
  return vec2<f32>(
    (a.x * b.x + a.y * b.y) / denom,
    (a.y * b.x - a.x * b.y) / denom
  );
}

@compute @workgroup_size(128, 1, 1)
fn resolve_optical_materials(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let mat_idx = wg_id.x;
  let tid = lid.x;
  if (mat_idx >= arrayLength(&descriptors)) {
    return;
  }

  let desc = descriptors[mat_idx];
  let mode = u32(round(desc.mode));
  let active_wl = tid < NUM_WAVELENGTHS;
  let nm = 380.0 + 5.0 * f32(tid);
  let wy = select(0.0, cie_y(nm), active_wl);
  let wx = select(0.0, cie_x(nm), active_wl);
  let wz = select(0.0, cie_z(nm), active_wl);

  var s_resp: f32 = 0.0;
  var refl_val: f32 = 0.0;
  var abs_val: f32 = 0.0;
  var n_re_val: f32 = 1.0;
  var raw_cherenkov: f32 = 0.0;

  if (active_wl) {
    let photon_ev = 1239.841984 / nm;
    if (mode == 0u) {
      // Drude-Lorentz + spin-orbit relativistic interband dielectric
      let wp2 = desc.plasma_energy_ev * desc.plasma_energy_ev;
      var eps = vec2<f32>(1.0, 0.0) - cdiv(
        vec2<f32>(wp2, 0.0),
        vec2<f32>(photon_ev * photon_ev, photon_ev * desc.damping_ev)
      );
      let osc_start = u32(max(0.0, desc.osc_offset));
      let osc_count = u32(max(0.0, desc.osc_count));
      let osc_limit = arrayLength(&oscillators);
      for (var k: u32 = 0u; k < osc_count; k = k + 1u) {
        let idx = osc_start + k;
        if (idx >= osc_limit) { break; }
        let osc = oscillators[idx];
        let strength_ev2 = INTERBAND_STRENGTH_SCALE * wp2 * osc.strength_weight;
        eps = eps + cdiv(
          vec2<f32>(strength_ev2, 0.0),
          vec2<f32>(osc.energy_ev * osc.energy_ev - photon_ev * photon_ev, -osc.damping_ev * photon_ev)
        );
      }
      let mag = sqrt(eps.x * eps.x + eps.y * eps.y);
      let n_re = sqrt(max(0.0, 0.5 * (mag + eps.x)));
      let k_im = sqrt(max(0.0, 0.5 * (mag - eps.x)));
      let num_r = (n_re - 1.0) * (n_re - 1.0) + k_im * k_im;
      let den_r = max((n_re + 1.0) * (n_re + 1.0) + k_im * k_im, 1e-30);
      refl_val = clamp(num_r / den_r, 0.0, 1.0);
      abs_val = (4.0 * PI * k_im) / (nm * 1e-9);
      n_re_val = n_re;
      s_resp = refl_val;
    } else if (mode == 1u) {
      // Frank-Tamm Cherenkov spectral photon density d^2N/(dx dlambda)
      let beta = desc.param0;
      let n_ior = max(1.0, desc.param1);
      let z_charge = desc.plasma_energy_ev;
      let sin2 = select(-1.0, 1.0 - 1.0 / (beta * beta * n_ior * n_ior), beta > 0.0);
      if (sin2 > 0.0) {
        let lam_m = nm * 1e-9;
        raw_cherenkov = ((2.0 * PI * FINE_STRUCTURE_ALPHA * z_charge * z_charge) / (lam_m * lam_m)) * sin2;
      }
      abs_val = raw_cherenkov * 5e-9; // photons per meter in this 5 nm bin
      n_re_val = n_ior;
    } else {
      // Mode 2: Band-gap Beer-Lambert transmission with Herve-Vandamme refractive index & exact Fresnel R0
      let gap_ev = max(0.0, desc.param0);
      let density_cross = desc.param1;
      let osc_frac = select(0.0, clamp((photon_ev - gap_ev) / max(1.0, photon_ev), 0.0, 1.0), photon_ev > gap_ev);
      abs_val = density_cross * osc_frac;
      let hv_n = sqrt(1.0 + (13.6 / (gap_ev + 3.47)) * (13.6 / (gap_ev + 3.47)));
      let n_derived = select(clamp(hv_n, 1.0, 4.5), max(1.0, desc.plasma_energy_ev), desc.plasma_energy_ev > 1.0);
      let r_num = (n_derived - 1.0) * (n_derived - 1.0);
      let r_den = max((n_derived + 1.0) * (n_derived + 1.0), 1e-12);
      n_re_val = n_derived;
      refl_val = clamp(r_num / r_den, 0.0, 1.0);
      s_resp = exp(-min(80.0, abs_val * max(0.0, desc.path_length_m)));
    }
  }

  // For Cherenkov mode, first reduce peak spectrum across the workgroup so s_resp = raw / peak
  sh_raw_spec[tid] = raw_cherenkov;
  sh_peak[tid] = raw_cherenkov;
  workgroupBarrier();

  for (var stride: u32 = 64u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_peak[tid] = max(sh_peak[tid], sh_peak[tid + stride]);
    }
    workgroupBarrier();
  }

  if (mode == 1u && active_wl) {
    let peak = sh_peak[0];
    s_resp = select(0.0, clamp(sh_raw_spec[tid] / peak, 0.0, 1.0), peak > 0.0);
    refl_val = s_resp;
  }

  // Write the 9 canonical spectral sample slots: indices 0, 10, 20, ..., 80 -> 380, 430, ..., 780 nm
  if (active_wl && (tid % 10u) == 0u) {
    let sample_idx = tid / 10u;
    let out_sample = mat_idx * 9u + sample_idx;
    if (out_sample < arrayLength(&spectral_samples)) {
      spectral_samples[out_sample] = SpectralSampleRow(nm, refl_val, abs_val, n_re_val);
    }
  }

  sh_x[tid] = s_resp * wx;
  sh_y[tid] = s_resp * wy;
  sh_z[tid] = s_resp * wz;
  sh_norm[tid] = wy;
  sh_refl[tid] = refl_val * wy;
  sh_abs[tid] = select(abs_val * wy, abs_val, mode == 1u);
  workgroupBarrier();

  for (var stride: u32 = 64u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_x[tid] = sh_x[tid] + sh_x[tid + stride];
      sh_y[tid] = sh_y[tid] + sh_y[tid + stride];
      sh_z[tid] = sh_z[tid] + sh_z[tid + stride];
      sh_norm[tid] = sh_norm[tid] + sh_norm[tid + stride];
      sh_refl[tid] = sh_refl[tid] + sh_refl[tid + stride];
      sh_abs[tid] = sh_abs[tid] + sh_abs[tid + stride];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let norm = max(sh_norm[0], 1e-30);
    let X = sh_x[0] / norm;
    let Y = sh_y[0] / norm;
    let Z = sh_z[0] / norm;
    let lin_r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let lin_g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let lin_b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    var base_r = srgb_encode(max(0.0, lin_r));
    var base_g = srgb_encode(max(0.0, lin_g));
    var base_b = srgb_encode(max(0.0, lin_b));
    let mean_refl = sh_refl[0] / norm;
    var abs_or_photons = select(sh_abs[0] / norm, sh_abs[0], mode == 1u);
    var depth_or_angle: f32 = 0.0;
    var opacity_or_active: f32 = 0.0;
    var transmission: f32 = 1.0;
    var metalness: f32 = 0.0;
    var roughness: f32 = 0.32;

    if (mode == 1u) {
      let peak = sh_peak[0];
      let is_active = peak > 0.0 && abs_or_photons > 0.0;
      if (is_active) {
        let beta = desc.param0;
        let n_ior = max(1.0, desc.param1);
        let cos_t = clamp(1.0 / max(beta * n_ior, 1e-12), -1.0, 1.0);
        depth_or_angle = acos(cos_t) * (180.0 / PI);
        opacity_or_active = 1.0;
      } else {
        base_r = 0.0;
        base_g = 0.0;
        base_b = 0.0;
        abs_or_photons = 0.0;
        depth_or_angle = 0.0;
        opacity_or_active = 0.0;
      }
      roughness = 0.1;
    } else {
      depth_or_angle = abs_or_photons * max(0.0, desc.path_length_m);
      opacity_or_active = select(0.0, 1.0 - exp(-min(80.0, depth_or_angle)), depth_or_angle > 0.0);
      transmission = exp(-min(80.0, depth_or_angle));
      if (mode == 0u) {
        metalness = select(opacity_or_active, 1.0, opacity_or_active > 0.5);
        roughness = 0.32;
      } else {
        metalness = 0.0;
        roughness = 0.4;
      }
    }

    outputs[mat_idx] = OpticalOutputRow(
      base_r, base_g, base_b, mean_refl,
      abs_or_photons, depth_or_angle, opacity_or_active, transmission,
      metalness, roughness, X, Y, Z,
      desc.plasma_energy_ev, desc.osc_count, desc.mode
    );
  }
}
`;

function fnv1aHashString(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `wgsl-fnv1a64:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export const OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH = fnv1aHashString(OPTICAL_RESOLVER_WGSL);

const pipelineCacheByDevice = new WeakMap();

function getOpticalPipeline(device) {
  let cached = pipelineCacheByDevice.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({
    label: 'ulg-optical-resolver-wgsl',
    code: OPTICAL_RESOLVER_WGSL
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-optical-resolver-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-optical-resolver-pl',
    bindGroupLayouts: [bindGroupLayout]
  });
  const pipeline = device.createComputePipeline({
    label: 'ulg-optical-resolver-pipeline',
    layout: pipelineLayout,
    compute: { module, entryPoint: 'resolve_optical_materials' }
  });
  cached = { pipeline, bindGroupLayout };
  pipelineCacheByDevice.set(device, cached);
  return cached;
}

/**
 * Pack an array of material optical resolver requests into flat Float32Arrays
 * ready for single-dispatch GPU derivation.
 */
export function packOpticalResolverRequests(requests = []) {
  const list = Array.isArray(requests) ? requests : [];
  const descData = new Float32Array(Math.max(1, list.length) * OPTICAL_DESCRIPTOR_FLOATS);
  const oscList = [];

  const oscSources = new Array(list.length).fill('none');
  for (let i = 0; i < list.length; i += 1) {
    const req = list[i] || {};
    const mode = Number.isInteger(req.mode) ? req.mode : OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ;
    const base = i * OPTICAL_DESCRIPTOR_FLOATS;
    if (mode === OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ) {
      const wp = Number.isFinite(req.plasmaRadPerS)
        ? req.plasmaRadPerS
        : plasmaFrequencyRadPerS(Math.max(1e10, Number(req.conductionElectronDensityPerM3) || 1e28));
      const plasmaEnergyEv = Number.isFinite(req.plasmaEnergyEv) ? req.plasmaEnergyEv : HBAR_EV_S * wp;
      const dampingEv = Number.isFinite(req.dampingEv) ? req.dampingEv : plasmaEnergyEv / 30;
      const callerSuppliedOsc = Array.isArray(req.interbandOscillators);
      const oscillators = callerSuppliedOsc
        ? req.interbandOscillators
        : req.atomicNumberZ
          ? relativisticInterbandOscillators({
            atomicNumberZ: req.atomicNumberZ,
            conductionElectronDensityPerM3: req.conductionElectronDensityPerM3,
            options: req.interbandOptions || {}
          })
          : [];
      oscSources[i] = callerSuppliedOsc
        ? 'caller-supplied'
        : req.atomicNumberZ
          ? 'cpu-radial-ks-interband'
          : 'drude-only';
      const oscOffset = oscList.length;
      for (const osc of oscillators) {
        oscList.push([
          Number(osc.energyEv) || 0,
          Number(osc.dampingEv) || 0.22,
          Number(osc.strengthWeight) || 0,
          0
        ]);
      }
      descData[base + 0] = plasmaEnergyEv;
      descData[base + 1] = dampingEv;
      descData[base + 2] = Number.isFinite(req.pathLengthM) ? req.pathLengthM : 0.3;
      descData[base + 3] = oscOffset;
      descData[base + 4] = oscillators.length;
      descData[base + 5] = OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ;
      descData[base + 6] = 0;
      descData[base + 7] = 0;
    } else if (mode === OPTICAL_RESOLVER_MODE_CHERENKOV) {
      // Fail closed to vacuum (n = 1.0) when refractiveIndex is omitted (never silently assume H2O 1.333)
      const nIor = Number.isFinite(Number(req.refractiveIndex)) && Number(req.refractiveIndex) >= 1.0
        ? Number(req.refractiveIndex)
        : 1.0;
      descData[base + 0] = Number.isFinite(req.chargeZ) ? req.chargeZ : 1;
      descData[base + 1] = 0;
      descData[base + 2] = 0;
      descData[base + 3] = 0;
      descData[base + 4] = 0;
      descData[base + 5] = OPTICAL_RESOLVER_MODE_CHERENKOV;
      descData[base + 6] = Math.max(0, Math.min(0.9999999, Number(req.beta) || 0));
      descData[base + 7] = nIor;
      oscSources[i] = 'frank-tamm-webgpu';
    } else {
      const explicitIor = Number.isFinite(Number(req.refractiveIndex ?? req.ior)) && Number(req.refractiveIndex ?? req.ior) > 1.0
        ? Number(req.refractiveIndex ?? req.ior)
        : 0;
      descData[base + 0] = explicitIor;
      descData[base + 1] = 0;
      descData[base + 2] = Number.isFinite(req.pathLengthM) ? req.pathLengthM : 0.3;
      descData[base + 3] = 0;
      descData[base + 4] = 0;
      descData[base + 5] = OPTICAL_RESOLVER_MODE_BAND_GAP;
      descData[base + 6] = Math.max(0, Number(req.electronicGapEv) || 0);
      descData[base + 7] = Math.max(0, Number(req.densityCrossSectionPerM) || 0);
      oscSources[i] = explicitIor > 1.0 ? 'band-gap-explicit-ior' : 'band-gap-herve-vandamme-webgpu';
    }
  }

  const oscData = new Float32Array(Math.max(1, oscList.length) * OPTICAL_OSCILLATOR_FLOATS);
  for (let i = 0; i < oscList.length; i += 1) {
    const o = oscList[i];
    const b = i * OPTICAL_OSCILLATOR_FLOATS;
    oscData[b + 0] = o[0];
    oscData[b + 1] = o[1];
    oscData[b + 2] = o[2];
    oscData[b + 3] = o[3];
  }

  return {
    materialCount: list.length,
    oscillatorCount: oscList.length,
    oscSources,
    descData,
    oscData
  };
}

/**
 * Execute batched Drude-Lorentz / Cherenkov / band-gap spectral optical
 * derivation natively on WebGPU.
 *
 * Returns decoded optical rows + optional GPU-resident output buffer if
 * `keepResident: true` (caller owns `.destroy()` on resident buffers).
 */
export async function resolveOpticalBatchWebGpu(device, requests = [], { keepResident = false, readback = true } = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('resolveOpticalBatchWebGpu requires a valid WebGPU GPUDevice.');
  }
  const packed = packOpticalResolverRequests(requests);
  const count = packed.materialCount;
  if (count === 0) {
    return {
      schema: OPTICAL_RESOLVER_WEBGPU_SCHEMA,
      resolverStatus: 'webgpu-derived',
      webgpuProgramHash: OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
      results: [],
      residentBuffers: null
    };
  }

  const doReadback = readback !== false || !keepResident;
  const { pipeline, bindGroupLayout } = getOpticalPipeline(device);

  const descBuffer = device.createBuffer({
    label: 'ulg-opt-desc',
    size: packed.descData.byteLength,
    usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST
  });
  const oscBuffer = device.createBuffer({
    label: 'ulg-opt-osc',
    size: packed.oscData.byteLength,
    usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST
  });
  const outByteLength = count * OPTICAL_OUTPUT_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const outBuffer = device.createBuffer({
    label: 'ulg-opt-out',
    size: outByteLength,
    usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC
  });
  const specByteLength = count * OPTICAL_SPECTRAL_SAMPLES_PER_MATERIAL * OPTICAL_SPECTRAL_SAMPLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const specBuffer = device.createBuffer({
    label: 'ulg-opt-spec',
    size: specByteLength,
    usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC
  });
  const readOutBuffer = doReadback ? device.createBuffer({
    label: 'ulg-opt-out-read',
    size: outByteLength,
    usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST
  }) : null;
  const readSpecBuffer = doReadback ? device.createBuffer({
    label: 'ulg-opt-spec-read',
    size: specByteLength,
    usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST
  }) : null;

  try {
    device.queue.writeBuffer(descBuffer, 0, packed.descData);
    device.queue.writeBuffer(oscBuffer, 0, packed.oscData);

    const bindGroup = device.createBindGroup({
      label: 'ulg-opt-bg',
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: descBuffer } },
        { binding: 1, resource: { buffer: oscBuffer } },
        { binding: 2, resource: { buffer: outBuffer } },
        { binding: 3, resource: { buffer: specBuffer } }
      ]
    });

    const encoder = device.createCommandEncoder({ label: 'ulg-opt-resolver-enc' });
    const pass = encoder.beginComputePass({ label: 'ulg-opt-resolver-pass' });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(count, 1, 1);
    pass.end();
    if (doReadback) {
      encoder.copyBufferToBuffer(outBuffer, 0, readOutBuffer, 0, outByteLength);
      encoder.copyBufferToBuffer(specBuffer, 0, readSpecBuffer, 0, specByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let results = null;
    if (doReadback) {
      await Promise.all([
        readOutBuffer.mapAsync(GPU_MAP_READ),
        readSpecBuffer.mapAsync(GPU_MAP_READ)
      ]);
      const outFloats = new Float32Array(readOutBuffer.getMappedRange().slice(0));
      const specFloats = new Float32Array(readSpecBuffer.getMappedRange().slice(0));
      readOutBuffer.unmap();
      readSpecBuffer.unmap();

      results = [];
      for (let i = 0; i < count; i += 1) {
        const b = i * OPTICAL_OUTPUT_ROW_FLOATS;
        const mode = Math.round(outFloats[b + 15]);
        const spectralSamples = [];
        for (let s = 0; s < OPTICAL_SPECTRAL_SAMPLES_PER_MATERIAL; s += 1) {
          const sb = (i * OPTICAL_SPECTRAL_SAMPLES_PER_MATERIAL + s) * OPTICAL_SPECTRAL_SAMPLE_FLOATS;
          spectralSamples.push({
            wavelengthNm: specFloats[sb + 0],
            reflectance: specFloats[sb + 1],
            absorptionCoefficientPerM: specFloats[sb + 2],
            nRe: specFloats[sb + 3]
          });
        }
        const baseColorSrgb = [outFloats[b + 0], outFloats[b + 1], outFloats[b + 2]];
        results.push({
          mode,
          baseColorSrgb,
          r: baseColorSrgb[0],
          g: baseColorSrgb[1],
          b: baseColorSrgb[2],
          reflectance: outFloats[b + 3],
          absorptionCoefficientPerM: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? 0 : outFloats[b + 4],
          photonsPerMeter: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? outFloats[b + 4] : 0,
          opticalDepth: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? 0 : outFloats[b + 5],
          cherenkovAngleDeg: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? outFloats[b + 5] : 0,
          opacity: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? 0 : outFloats[b + 6],
          active: mode === OPTICAL_RESOLVER_MODE_CHERENKOV ? outFloats[b + 6] > 0.5 : true,
          transmission: outFloats[b + 7],
          metalness: outFloats[b + 8],
          roughness: outFloats[b + 9],
          cieXYZ: [outFloats[b + 10], outFloats[b + 11], outFloats[b + 12]],
          plasmaEnergyEv: outFloats[b + 13],
          oscillatorCount: Math.round(outFloats[b + 14]),
          oscillatorSource: packed.oscSources[i],
          spectralSamples,
          resolverStatus: packed.oscSources[i] === 'cpu-radial-ks-interband'
            ? 'hybrid-webgpu-spectral-cpu-oscillators'
            : 'webgpu-derived',
          webgpuProgramHash: OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
          validation: Object.freeze({
            scientificValidation: false,
            opticalValidation: false,
            webgpuParity: false
          })
        });
      }
    }

    const hasCpuOsc = packed.oscSources.includes('cpu-radial-ks-interband');
    return {
      schema: OPTICAL_RESOLVER_WEBGPU_SCHEMA,
      resolverStatus: hasCpuOsc ? 'hybrid-webgpu-spectral-cpu-oscillators' : 'webgpu-derived',
      webgpuProgramHash: OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
      materialCount: count,
      readbackSkipped: !doReadback,
      results,
      residentBuffers: keepResident
        ? {
          outputBuffer: outBuffer,
          spectralBuffer: specBuffer,
          destroy() {
            outBuffer.destroy();
            specBuffer.destroy();
          }
        }
        : null
    };
  } finally {
    descBuffer.destroy();
    oscBuffer.destroy();
    readOutBuffer?.destroy();
    readSpecBuffer?.destroy();
    if (!keepResident) {
      outBuffer.destroy();
      specBuffer.destroy();
    }
  }
}

/**
 * Convenience single-metal WebGPU derivation matching `metalRelativisticColorSrgb`.
 */
export async function resolveMetalOpticalWebGpu(device, {
  atomicNumberZ = null,
  conductionElectronDensityPerM3,
  pathLengthM = 0.3,
  interbandOscillators = null,
  interbandOptions = {},
  keepResident = false
} = {}) {
  const batch = await resolveOpticalBatchWebGpu(device, [{
    mode: OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
    atomicNumberZ,
    conductionElectronDensityPerM3,
    pathLengthM,
    interbandOscillators,
    interbandOptions
  }], { keepResident });
  return {
    ...batch.results[0],
    residentBuffers: batch.residentBuffers
  };
}
