import{g as e,m as t}from"./webgpuComputeLayout-CHUyeeFd.js";var n=`ulg.gpumath.fft3d-webgpu.v1`,r=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),i=`
struct FftParams {
  n: u32,
  log_n: u32,
  axis: u32,      // 0 = X, 1 = Y, 2 = Z
  stage: u32,     // 0 .. log_n - 1
  direction: f32, // -1.0 for forward FFT, +1.0 for inverse IFFT
  scale: f32,     // normalization or box length L
  smooth_r2: f32, // optional Gaussian smoothing r_s^2 (for TreePM split)
  grad_axis: u32, // 0 = phi, 1 = dphi/dx, 2 = dphi/dy, 3 = dphi/dz
};

@group(0) @binding(0) var<uniform> params: FftParams;
@group(0) @binding(1) var<storage, read> src_grid: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> dst_grid: array<vec2<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn bit_reverse(val: u32, bits: u32) -> u32 {
  var x = val;
  var r = 0u;
  for (var i = 0u; i < bits; i = i + 1u) {
    r = (r << 1u) | (x & 1u);
    x = x >> 1u;
  }
  return r;
}

fn c_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn grid_idx(x: u32, y: u32, z: u32, n: u32) -> u32 {
  return (z * n + y) * n + x;
}

@compute @workgroup_size(64)
fn bitrev_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let x = idx % n;
  let y = (idx / n) % n;
  let z = idx / (n * n);
  var sx = x;
  var sy = y;
  var sz = z;
  if (params.axis == 0u) {
    sx = bit_reverse(x, params.log_n);
  } else if (params.axis == 1u) {
    sy = bit_reverse(y, params.log_n);
  } else {
    sz = bit_reverse(z, params.log_n);
  }
  dst_grid[idx] = src_grid[grid_idx(sx, sy, sz, n)];
}

@compute @workgroup_size(64)
fn butterfly_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let half_total = (n * n * n) >> 1u;
  let b_idx = id.x;
  if (b_idx >= half_total) { return; }

  let half_n = n >> 1u;
  let pair_in_line = b_idx % half_n;
  let line_id = b_idx / half_n;
  let line_a = line_id % n;
  let line_b = line_id / n;

  let m = 1u << (params.stage + 1u);
  let half_m = m >> 1u;
  let group = pair_in_line / half_m;
  let j = pair_in_line % half_m;
  let i0 = group * m + j;
  let i1 = i0 + half_m;

  var p0: u32;
  var p1: u32;
  if (params.axis == 0u) {
    p0 = grid_idx(i0, line_a, line_b, n);
    p1 = grid_idx(i1, line_a, line_b, n);
  } else if (params.axis == 1u) {
    p0 = grid_idx(line_a, i0, line_b, n);
    p1 = grid_idx(line_a, i1, line_b, n);
  } else {
    p0 = grid_idx(line_a, line_b, i0, n);
    p1 = grid_idx(line_a, line_b, i1, n);
  }

  let angle = params.direction * TWO_PI * f32(j) / f32(m);
  let twiddle = vec2<f32>(cos(angle), sin(angle));
  let u = src_grid[p0];
  let t = c_mul(twiddle, src_grid[p1]);
  dst_grid[p0] = u + t;
  dst_grid[p1] = u - t;
}

@compute @workgroup_size(64)
fn scale_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  dst_grid[idx] = src_grid[idx] * params.scale;
}

// Spectral 3D Poisson kernel in k-space for periodic box length L = params.scale:
//   nabla^2 phi = rhs  ==>  phi_hat(k) = -rhs_hat(k) / |k|^2 * exp(-|k|^2 * smooth_r2)
//   grad_axis == 1,2,3 computes d(phi)/d(x_axis) = i * k_axis * phi_hat(k)
@compute @workgroup_size(64)
fn poisson_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix == 0u && iy == 0u && iz == 0u) {
    dst_grid[idx] = vec2<f32>(0.0, 0.0);
    return;
  }
  let half_n = n >> 1u;
  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.scale, 1.0e-30);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let gauss_win = select(1.0, exp(-k2 * params.smooth_r2), params.smooth_r2 > 0.0);
  let green = -(gauss_win / k2);
  let rhs_k = src_grid[idx];
  let phi_k = rhs_k * green;
  if (params.grad_axis == 0u) {
    dst_grid[idx] = phi_k;
  } else {
    let k_comp = select(select(kz, ky, params.grad_axis == 2u), kx, params.grad_axis == 1u);
    // Multiply by i * k_comp: i*(a + ib) = (-b + ia)
    dst_grid[idx] = vec2<f32>(-phi_k.y * k_comp, phi_k.x * k_comp);
  }
}
`;function a(e){let t=Math.trunc(Number(e));if(!(t>=4&&t<=128&&!(t&t-1)))throw RangeError(`fft3dWebGpu requires power-of-2 N in [4..128], got ${e}`);return{dim:t,logN:Math.round(Math.log2(t))}}function o(n){let r=[t(0,`uniform`),t(1,`read-only-storage`),t(2,`storage`)];return{bitrev:e(n,{cacheKey:`ulg-gpumath-fft3d-bitrev.v1`,label:`ulg-gpumath-fft3d-bitrev`,code:i,entryPoint:`bitrev_axis`,bindings:r}),butterfly:e(n,{cacheKey:`ulg-gpumath-fft3d-butterfly.v1`,label:`ulg-gpumath-fft3d-butterfly`,code:i,entryPoint:`butterfly_axis`,bindings:r}),scale:e(n,{cacheKey:`ulg-gpumath-fft3d-scale.v1`,label:`ulg-gpumath-fft3d-scale`,code:i,entryPoint:`scale_grid`,bindings:r}),poisson:e(n,{cacheKey:`ulg-gpumath-fft3d-poisson.v1`,label:`ulg-gpumath-fft3d-poisson`,code:i,entryPoint:`poisson_kspace`,bindings:r})}}function s(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createFft3dWorkspaceWebGpu requires a live WebGPU GPUDevice`);let{dim:i,logN:s}=a(t),c=i*i*i,l=c*8,u=o(e),d=u.butterfly.bindGroupLayout,f=e.createBuffer({label:`ulg-fft3d-${i}-a`,size:l,usage:r.STORAGE|r.COPY_DST|r.COPY_SRC}),p=e.createBuffer({label:`ulg-fft3d-${i}-b`,size:l,usage:r.STORAGE|r.COPY_DST|r.COPY_SRC}),m=[],h=(t,n,a,o=1,c=0,l=0)=>{let u=new ArrayBuffer(32);new Uint32Array(u,0,4).set([i,s,t,n]),new Float32Array(u,16,3).set([a,o,c]),new Uint32Array(u,28,1).set([l]);let d=e.createBuffer({size:32,usage:r.UNIFORM|r.COPY_DST});return e.queue.writeBuffer(d,0,u),m.push(d),d},g=(t,n,r)=>e.createBindGroup({layout:d,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:r}}]}),_=(e=>{let t=[],n=f,r=p,i=()=>{let e=n;n=r,r=e};for(let a=0;a<3;a+=1){let o=h(a,0,e);t.push({pipeline:u.bitrev.pipeline,bg:g(o,n,r),wg:Math.ceil(c/64)}),i();for(let o=0;o<s;o+=1){let s=h(a,o,e);t.push({pipeline:u.butterfly.pipeline,bg:g(s,n,r),wg:Math.ceil((c>>1)/64)}),i()}}if(e>0){let e=h(0,0,1,1/c);t.push({pipeline:u.scale.pipeline,bg:g(e,n,r),wg:Math.ceil(c/64)}),i()}return{steps:t,outputBuffer:n,scratchBuffer:r}})(-1),v=(e,t,n)=>{let r=[],i=t,a=n,o=()=>{let e=i;i=a,a=e};for(let t=0;t<3;t+=1){let n=h(t,0,e);r.push({pipeline:u.bitrev.pipeline,bg:g(n,i,a),wg:Math.ceil(c/64)}),o();for(let n=0;n<s;n+=1){let s=h(t,n,e);r.push({pipeline:u.butterfly.pipeline,bg:g(s,i,a),wg:Math.ceil((c>>1)/64)}),o()}}if(e>0){let e=h(0,0,1,1/c);r.push({pipeline:u.scale.pipeline,bg:g(e,i,a),wg:Math.ceil(c/64)}),o()}return{steps:r,outputBuffer:i,scratchBuffer:a}},y=v(1,f,p),b=v(1,p,f),x=e.createBuffer({size:32,usage:r.UNIFORM|r.COPY_DST});m.push(x);let S=g(x,f,p),C=g(x,p,f),w=[0,1,2,3].map(()=>{let t=e.createBuffer({size:32,usage:r.UNIFORM|r.COPY_DST});return m.push(t),t}),T=w.map(e=>g(e,f,p)),E=w.map(e=>g(e,p,f)),D=new WeakMap;function O(e,t){let n=D.get(e);return n||(n=w.map(t=>g(t,e,f)),D.set(e,n)),n[t]}function k(e,t,n){let r=e.beginComputePass({label:n});for(let e of t.steps)r.setPipeline(e.pipeline),r.setBindGroup(0,e.bg),r.dispatchWorkgroups(e.wg);return r.end(),t.outputBuffer}function A(t,{boxLength:n=1,smoothR2:r=0}={}){let a=new ArrayBuffer(32);new Uint32Array(a,0,4).set([i,s,0,0]),new Float32Array(a,16,3).set([-1,Number(n),Number(r)]),new Uint32Array(a,28,1).set([t]),e.queue.writeBuffer(w[t],0,a)}return Object.freeze({schema:n,n:i,total:c,byteLength:l,inputBuffer:f,bufferA:f,bufferB:p,forwardOutputBuffer:_.outputBuffer,encodeForward(e){return k(e,_,`ulg-fft3d-fwd-${i}`)},encodeInverseFrom(e,t){return k(e,t===f?y:b,`ulg-fft3d-inv-${i}`)},writeAxisPoissonParams({boxLength:e=1,smoothR2:t=0}={}){for(let n=0;n<=3;n+=1)A(n,{boxLength:e,smoothR2:t})},encodePoissonInverseFromKSpace(e,t,{gradAxis:n=0}={}){let r=Math.max(0,Math.min(3,Math.trunc(n))),a,o;t===f?(a=T[r],o=p):t===p?(a=E[r],o=f):(a=O(t,r),o=f);let s=e.beginComputePass({label:`ulg-poisson-kspace-ax${r}-${i}`});return s.setPipeline(u.poisson.pipeline),s.setBindGroup(0,a),s.dispatchWorkgroups(Math.ceil(c/64)),s.end(),k(e,o===f?y:b,`ulg-poisson-inv-ax${r}-${i}`)},encodePoissonSolve(t,{boxLength:n=1,smoothR2:r=0,gradAxis:a=0}={}){let o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([i,s,0,0]),new Float32Array(o,16,3).set([-1,Number(n),Number(r)]),new Uint32Array(o,28,1).set([Math.trunc(a)]),e.queue.writeBuffer(x,0,o);let l=k(t,_,`ulg-poisson-fwd-${i}`),d=t.beginComputePass({label:`ulg-poisson-kspace-${i}`});return d.setPipeline(u.poisson.pipeline),d.setBindGroup(0,l===f?S:C),d.dispatchWorkgroups(Math.ceil(c/64)),d.end(),k(t,(l===f?p:f)===f?y:b,`ulg-poisson-inv-${i}`)},destroy(){f.destroy(),p.destroy();for(let e of m)e.destroy()}})}async function c(e,{data:t,n:i,inverse:a=!1}={}){let o=s(e,i),c=t instanceof Float32Array?t:Float32Array.from(t);if(c.length!==o.total*2)throw o.destroy(),RangeError(`Expected ${o.total*2} complex floats for N=${i}, got ${c.length}`);let l=e.createBuffer({size:o.byteLength,usage:r.MAP_READ|r.COPY_DST});try{e.queue.writeBuffer(o.inputBuffer,0,c);let t=e.createCommandEncoder({label:`ulg-fft3d-oneshot`}),i=a?o.encodeInverseFrom(t,o.inputBuffer):o.encodeForward(t);t.copyBufferToBuffer(i,0,l,0,o.byteLength),e.queue.submit([t.finish()]),await l.mapAsync(r.MAP_READ);let s=new Float32Array(l.getMappedRange().slice(0,o.byteLength));return l.unmap(),Object.freeze({schema:n,backend:`webgpu`,n:o.n,inverse:!!a,data:s})}finally{l.destroy(),o.destroy()}}async function l({label:e=`ulg-webgpu`,retries:t=6,retryDelayMs:n=200,requiredFeatures:r=[],optionalLimits:i=null,xrCompatible:a=!1}={}){if(typeof navigator>`u`||!navigator.gpu)throw Error(`WebGPU is unavailable in this browser. Use Chrome 121+, Edge 121+, or Safari 18+/26+ with WebGPU enabled over HTTPS.`);let o=null;for(let e=0;e<t&&!o;e+=1){if(a&&navigator.xr!==void 0){try{o=await navigator.gpu.requestAdapter({powerPreference:`high-performance`,xrCompatible:!0})}catch{o=null}if(!o)try{o=await navigator.gpu.requestAdapter({xrCompatible:!0})}catch{o=null}}if(!o)try{o=await navigator.gpu.requestAdapter({powerPreference:`high-performance`})}catch{o=null}if(!o)try{o=await navigator.gpu.requestAdapter()}catch{o=null}!o&&e+1<t&&await new Promise(e=>setTimeout(e,n))}if(!o)throw Error(`No compatible WebGPU GPUAdapter available (${e}).`);let s={label:e};if(Array.isArray(r)&&r.length>0&&o.features){let e=r.filter(e=>o.features.has(e));e.length>0&&(s.requiredFeatures=e)}if(i&&typeof i==`object`&&o.limits){let e={};for(let[t,n]of Object.entries(i)){let r=Number(o.limits[t]),i=Number(n);Number.isFinite(r)&&Number.isFinite(i)&&i>0&&(e[t]=Math.min(r,i))}Object.keys(e).length>0&&(s.requiredLimits=e)}let c=null;try{c=await o.requestDevice(s)}catch{c=await o.requestDevice()}return{adapter:o,device:c}}function u(e,t,{preferCopySrc:n=!1}={}){if(!e)throw Error(`WebGPU canvas context unavailable`);let r=typeof navigator<`u`&&navigator.gpu?.getPreferredCanvasFormat?navigator.gpu.getPreferredCanvasFormat():`bgra8unorm`,i=[];n&&(i.push({device:t,format:r,alphaMode:`opaque`,usage:17}),i.push({device:t,format:r,alphaMode:`premultiplied`,usage:17})),i.push({device:t,format:r,alphaMode:`opaque`}),i.push({device:t,format:r,alphaMode:`premultiplied`});let a=null;for(let t of i)try{return e.configure(t),{format:r,alphaMode:t.alphaMode}}catch(e){a=e}if(a)throw a;return{format:r,alphaMode:`opaque`}}function d(e){let t=Number(e?.deltaY)||0;return e?.deltaMode===1?t*=16:e?.deltaMode===2&&(t*=240),e?.ctrlKey&&(t*=3.2),t}var f=`
const ULG_PI: f32 = 3.14159265359;

fn ulg_srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2));
}

fn ulg_linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
}

fn ulg_complex_f0(n_rgb: vec3<f32>, k_rgb: vec3<f32>) -> vec3<f32> {
  let num = (n_rgb - vec3<f32>(1.0)) * (n_rgb - vec3<f32>(1.0)) + k_rgb * k_rgb;
  let den = (n_rgb + vec3<f32>(1.0)) * (n_rgb + vec3<f32>(1.0)) + k_rgb * k_rgb;
  return clamp(num / max(den, vec3<f32>(1e-5)), vec3<f32>(0.02), vec3<f32>(0.995));
}

fn ulg_dielectric_f0(ior: f32) -> f32 {
  let n = max(1.0, ior);
  let r = (n - 1.0) / (n + 1.0);
  return clamp(r * r, 0.015, 0.35);
}

fn ulg_fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  return f0 + (vec3<f32>(1.0) - f0) * (x2 * x2 * x);
}

fn ulg_fresnel_schlick_rough(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  let max_f = max(vec3<f32>(1.0 - clamp(roughness, 0.04, 1.0)), f0);
  return f0 + (max_f - f0) * (x2 * x2 * x);
}

fn ulg_d_ggx(ndh: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / max(ULG_PI * d * d, 1e-5);
}

fn ulg_v_smith_ggx(ndv: f32, ndl: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let ggx_v = ndl * sqrt(max(1e-6, ndv * ndv * (1.0 - a2) + a2));
  let ggx_l = ndv * sqrt(max(1e-6, ndl * ndl * (1.0 - a2) + a2));
  return 0.5 / max(ggx_v + ggx_l, 1e-5);
}

// Energy-conserving direct Cook-Torrance GGX + Lambert BRDF in linear light space
fn ulg_pbr_direct(
  n: vec3<f32>,
  v: vec3<f32>,
  l: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  radiance: vec3<f32>
) -> vec3<f32> {
  let ndl = max(0.0, dot(n, l));
  if (ndl <= 0.0) { return vec3<f32>(0.0); }
  let ndv = max(1e-4, dot(n, v));
  let h = normalize(l + v);
  let ndh = max(0.0, dot(n, h));
  let vdh = max(0.0, dot(v, h));

  let F = ulg_fresnel_schlick(vdh, f0_rgb);
  let D = ulg_d_ggx(ndh, roughness);
  let V = ulg_v_smith_ggx(ndv, ndl, roughness);
  let spec = D * V * F;
  let k_d = (vec3<f32>(1.0) - F) * (1.0 - clamp(metallic, 0.0, 1.0));
  let diff = k_d * albedo_lin / ULG_PI;
  return (diff + spec) * radiance * ndl;
}

// Analytic split-sum studio/sky hemisphere IBL (gives true colored conductor reflections & dielectric glazing)
fn ulg_pbr_env_hemi(
  n: vec3<f32>,
  v: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  sky_zen_lin: vec3<f32>,
  sky_hor_lin: vec3<f32>,
  ground_lin: vec3<f32>
) -> vec3<f32> {
  let ndv = max(1e-4, dot(n, v));
  let r_dir = reflect(-v, n);
  let r_up = clamp(r_dir.y, -1.0, 1.0);
  let n_up = clamp(n.y, -1.0, 1.0);

  let env_sharp = select(
    mix(sky_hor_lin, ground_lin, clamp(-r_up * 1.4, 0.0, 1.0)),
    mix(sky_hor_lin, sky_zen_lin, pow(clamp(r_up, 0.0, 1.0), 0.65)),
    r_up >= 0.0
  );
  let env_blur = mix(ground_lin, mix(sky_hor_lin, sky_zen_lin, 0.55), n_up * 0.5 + 0.5);
  let env_spec = mix(env_sharp, env_blur, clamp(roughness * roughness, 0.0, 1.0));

  let F_env = ulg_fresnel_schlick_rough(ndv, f0_rgb, roughness);
  let k_d = (vec3<f32>(1.0) - F_env) * (1.0 - clamp(metallic, 0.0, 1.0));
  let spec_atten = 1.0 - clamp(roughness, 0.04, 1.0) * 0.42;
  return k_d * albedo_lin * env_blur + F_env * env_spec * spec_atten;
}
`;export{s as a,l as i,u as n,c as o,d as r,f as t};