import{D as e,T as t}from"./eshkolTriadClosures-CAdZ5Pha.js";var n=`peercompute.ulg.optical-resolver-webgpu.v1`,r=6582119569e-25,i=1,a=`
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
  return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
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
`;function o(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var s=o(a),c=new WeakMap;function l(e){let t=c.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-optical-resolver-wgsl`,code:a}),r=e.createBindGroupLayout({label:`ulg-optical-resolver-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`read-only-storage`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({label:`ulg-optical-resolver-pl`,bindGroupLayouts:[r]});return t={pipeline:e.createComputePipeline({label:`ulg-optical-resolver-pipeline`,layout:i,compute:{module:n,entryPoint:`resolve_optical_materials`}}),bindGroupLayout:r},c.set(e,t),t}function u(n=[]){let i=Array.isArray(n)?n:[],a=new Float32Array(Math.max(1,i.length)*8),o=[],s=Array(i.length).fill(`none`);for(let n=0;n<i.length;n+=1){let c=i[n]||{},l=Number.isInteger(c.mode)?c.mode:0,u=n*8;if(l===0){let i=Number.isFinite(c.plasmaRadPerS)?c.plasmaRadPerS:t(Math.max(1e10,Number(c.conductionElectronDensityPerM3)||1e28)),l=Number.isFinite(c.plasmaEnergyEv)?c.plasmaEnergyEv:r*i,d=Number.isFinite(c.dampingEv)?c.dampingEv:l/30,f=Array.isArray(c.interbandOscillators),p=f?c.interbandOscillators:c.atomicNumberZ?e({atomicNumberZ:c.atomicNumberZ,conductionElectronDensityPerM3:c.conductionElectronDensityPerM3,options:c.interbandOptions||{}}):[];s[n]=f?`caller-supplied`:c.atomicNumberZ?`cpu-radial-ks-interband`:`drude-only`;let m=o.length;for(let e of p)o.push([Number(e.energyEv)||0,Number(e.dampingEv)||.22,Number(e.strengthWeight)||0,0]);a[u+0]=l,a[u+1]=d,a[u+2]=Number.isFinite(c.pathLengthM)?c.pathLengthM:.3,a[u+3]=m,a[u+4]=p.length,a[u+5]=0,a[u+6]=0,a[u+7]=0}else if(l===1){let e=Number.isFinite(Number(c.refractiveIndex))&&Number(c.refractiveIndex)>=1?Number(c.refractiveIndex):1;a[u+0]=Number.isFinite(c.chargeZ)?c.chargeZ:1,a[u+1]=0,a[u+2]=0,a[u+3]=0,a[u+4]=0,a[u+5]=1,a[u+6]=Math.max(0,Math.min(.9999999,Number(c.beta)||0)),a[u+7]=e,s[n]=`frank-tamm-webgpu`}else{let e=Number.isFinite(Number(c.refractiveIndex??c.ior))&&Number(c.refractiveIndex??c.ior)>1?Number(c.refractiveIndex??c.ior):0;a[u+0]=e,a[u+1]=0,a[u+2]=Number.isFinite(c.pathLengthM)?c.pathLengthM:.3,a[u+3]=0,a[u+4]=0,a[u+5]=2,a[u+6]=Math.max(0,Number(c.electronicGapEv)||0),a[u+7]=Math.max(0,Number(c.densityCrossSectionPerM)||0),s[n]=e>1?`band-gap-explicit-ior`:`band-gap-herve-vandamme-webgpu`}}let c=new Float32Array(Math.max(1,o.length)*4);for(let e=0;e<o.length;e+=1){let t=o[e],n=e*4;c[n+0]=t[0],c[n+1]=t[1],c[n+2]=t[2],c[n+3]=t[3]}return{materialCount:i.length,oscillatorCount:o.length,oscSources:s,descData:a,oscData:c}}async function d(e,t=[],{keepResident:r=!1,readback:a=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`resolveOpticalBatchWebGpu requires a valid WebGPU GPUDevice.`);let o=u(t),c=o.materialCount;if(c===0)return{schema:n,resolverStatus:`webgpu-derived`,webgpuProgramHash:s,results:[],residentBuffers:null};let d=a!==!1||!r,{pipeline:f,bindGroupLayout:p}=l(e),m=e.createBuffer({label:`ulg-opt-desc`,size:o.descData.byteLength,usage:136}),h=e.createBuffer({label:`ulg-opt-osc`,size:o.oscData.byteLength,usage:136}),g=c*16*Float32Array.BYTES_PER_ELEMENT,_=e.createBuffer({label:`ulg-opt-out`,size:g,usage:132}),v=c*9*4*Float32Array.BYTES_PER_ELEMENT,y=e.createBuffer({label:`ulg-opt-spec`,size:v,usage:132}),b=d?e.createBuffer({label:`ulg-opt-out-read`,size:g,usage:9}):null,x=d?e.createBuffer({label:`ulg-opt-spec-read`,size:v,usage:9}):null;try{e.queue.writeBuffer(m,0,o.descData),e.queue.writeBuffer(h,0,o.oscData);let t=e.createBindGroup({label:`ulg-opt-bg`,layout:p,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:h}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:y}}]}),a=e.createCommandEncoder({label:`ulg-opt-resolver-enc`}),l=a.beginComputePass({label:`ulg-opt-resolver-pass`});l.setPipeline(f),l.setBindGroup(0,t),l.dispatchWorkgroups(c,1,1),l.end(),d&&(a.copyBufferToBuffer(_,0,b,0,g),a.copyBufferToBuffer(y,0,x,0,v)),e.queue.submit([a.finish()]);let u=null;if(d){await Promise.all([b.mapAsync(i),x.mapAsync(i)]);let e=new Float32Array(b.getMappedRange().slice(0)),t=new Float32Array(x.getMappedRange().slice(0));b.unmap(),x.unmap(),u=[];for(let n=0;n<c;n+=1){let r=n*16,i=Math.round(e[r+15]),a=[];for(let e=0;e<9;e+=1){let r=(n*9+e)*4;a.push({wavelengthNm:t[r+0],reflectance:t[r+1],absorptionCoefficientPerM:t[r+2],nRe:t[r+3]})}let c=[e[r+0],e[r+1],e[r+2]];u.push({mode:i,baseColorSrgb:c,r:c[0],g:c[1],b:c[2],reflectance:e[r+3],absorptionCoefficientPerM:i===1?0:e[r+4],photonsPerMeter:i===1?e[r+4]:0,opticalDepth:i===1?0:e[r+5],cherenkovAngleDeg:i===1?e[r+5]:0,opacity:i===1?0:e[r+6],active:i===1?e[r+6]>.5:!0,transmission:e[r+7],metalness:e[r+8],roughness:e[r+9],cieXYZ:[e[r+10],e[r+11],e[r+12]],plasmaEnergyEv:e[r+13],oscillatorCount:Math.round(e[r+14]),oscillatorSource:o.oscSources[n],spectralSamples:a,resolverStatus:o.oscSources[n]===`cpu-radial-ks-interband`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:s,validation:Object.freeze({scientificValidation:!1,opticalValidation:!1,webgpuParity:!1})})}}return{schema:n,resolverStatus:o.oscSources.includes(`cpu-radial-ks-interband`)?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:s,materialCount:c,readbackSkipped:!d,results:u,residentBuffers:r?{outputBuffer:_,spectralBuffer:y,destroy(){_.destroy(),y.destroy()}}:null}}finally{m.destroy(),h.destroy(),b?.destroy(),x?.destroy(),r||(_.destroy(),y.destroy())}}async function f(e,{atomicNumberZ:t=null,conductionElectronDensityPerM3:n,pathLengthM:r=.3,interbandOscillators:i=null,interbandOptions:a={},keepResident:o=!1}={}){let s=await d(e,[{mode:0,atomicNumberZ:t,conductionElectronDensityPerM3:n,pathLengthM:r,interbandOscillators:i,interbandOptions:a}],{keepResident:o});return{...s.results[0],residentBuffers:s.residentBuffers}}export{f as n,d as r,s as t};