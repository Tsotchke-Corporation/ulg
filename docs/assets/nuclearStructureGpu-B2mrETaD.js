import{st as e}from"./eshkolTriadClosures-D-cceDKA.js";import{o as t}from"./materialFoundationAbi-FyZ8ey5s.js";import{computeBufferBinding as n,createCachedExplicitComputePipeline as r}from"../runtime/webgpuComputeLayout.js";var i=`ulg.nuclear.structure-webgpu.v1`,a=`nuclear-ldm-strutinsky-ws-wkb.v1`,o=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),s=15.75,c=17.8,l=.711,u=11.18,d=Object.freeze([2,8,20,28,50,82,126,184]),f=938.27208816,p=939.56542052,m=.51099895,h=931.49410242,g=197.3269804,_=1/137.035999084,v=52917.7210903,y=Object.freeze([{label:`1s1/2`,n:1,l:0,twoJ:1},{label:`1p3/2`,n:1,l:1,twoJ:3},{label:`1p1/2`,n:1,l:1,twoJ:1},{label:`1d5/2`,n:1,l:2,twoJ:5},{label:`2s1/2`,n:2,l:0,twoJ:1},{label:`1d3/2`,n:1,l:2,twoJ:3},{label:`1f7/2`,n:1,l:3,twoJ:7},{label:`2p3/2`,n:2,l:1,twoJ:3},{label:`1f5/2`,n:1,l:3,twoJ:5},{label:`2p1/2`,n:2,l:1,twoJ:1},{label:`1g9/2`,n:1,l:4,twoJ:9},{label:`1g7/2`,n:1,l:4,twoJ:7},{label:`2d5/2`,n:2,l:2,twoJ:5},{label:`2d3/2`,n:2,l:2,twoJ:3},{label:`3s1/2`,n:3,l:0,twoJ:1},{label:`1h11/2`,n:1,l:5,twoJ:11},{label:`1h9/2`,n:1,l:5,twoJ:9},{label:`2f7/2`,n:2,l:3,twoJ:7},{label:`1i13/2`,n:1,l:6,twoJ:13},{label:`2f5/2`,n:2,l:3,twoJ:5},{label:`3p3/2`,n:3,l:1,twoJ:3},{label:`3p1/2`,n:3,l:1,twoJ:1},{label:`2g9/2`,n:2,l:4,twoJ:9},{label:`1i11/2`,n:1,l:6,twoJ:11},{label:`1j15/2`,n:1,l:7,twoJ:15},{label:`3d5/2`,n:3,l:2,twoJ:5},{label:`4s1/2`,n:4,l:0,twoJ:1},{label:`2g7/2`,n:2,l:4,twoJ:7},{label:`3d3/2`,n:3,l:2,twoJ:3}]);function b(e,t){let n=0;for(let r of d){let i=e-r,a=t-r,o=1.6+.03*r;n+=3.8*Math.exp(-(i*i)/(2*o*o)),n+=3.8*Math.exp(-(a*a)/(2*o*o))}return n}function x(e,t){let n=Math.trunc(e),r=Math.trunc(t),i=r-n;if(n<0||i<0||r<=0||r===1)return 0;if(n===1&&r===2)return 2.22457;if(n===2&&r===4)return 28.2957;let a=Math.cbrt(r),o=a*a,c=s*r,l=-17.8*o,d=-.711*(n*(n-1))/a,f=-23.7*((i-n)*(i-n))/r,p=0;n%2==0&&i%2==0?p=u/Math.sqrt(r):n%2==1&&i%2==1&&(p=-11.18/Math.sqrt(r));let m=b(n,i);return Math.max(0,c+l+d+f+p+m)}function S(e){let t=Math.max(1,Math.trunc(e));if(t===1)return .8414;let n=Math.cbrt(t),r=Math.max(.9,1.23*n-.6/n),i=.523;return Math.sqrt(.6*r*r+1.4*Math.PI*Math.PI*i*i)}function C(e){let t=Math.max(0,Math.trunc(e)),n=y[0];for(let e of y){let r=e.twoJ+1;if(t<=r){n=e;break}t-=r,n=e}return n}function w(e,t){let n=Math.trunc(e),r=Math.trunc(t)-n,i=(n&1)==1,a=(r&1)==1;if(!i&&!a)return Object.freeze({spinI:0,parity:`+`,shellLabel:`even-even paired`,magneticMomentMuN:0});let o=(e,t)=>{let n=e.twoJ/2,r=e.l,i=+!!t,a=t?5.5857:-3.8261;return Math.abs(n-(r+.5))<1e-6?(n-.5)*i+.5*a:n/(n+1)*((n+1.5)*i-.5*a)};if(i&&!a){let e=C(n);return Object.freeze({spinI:e.twoJ/2,parity:e.l&1?`-`:`+`,shellLabel:`p:${e.label}`,magneticMomentMuN:o(e,!0)})}if(!i&&a){let e=C(r);return Object.freeze({spinI:e.twoJ/2,parity:e.l&1?`-`:`+`,shellLabel:`n:${e.label}`,magneticMomentMuN:o(e,!1)})}let s=C(n),c=C(r),l=s.twoJ/2,u=c.twoJ/2,d=Math.max(1,Math.abs(l-u)+1);return Object.freeze({spinI:d,parity:s.l+c.l&1?`-`:`+`,shellLabel:`p:${s.label}+n:${c.label}`,magneticMomentMuN:.5*(o(s,!0)+o(c,!1))})}function T(e){let t=Math.trunc(e);if(t===1)return 1;if(t===2)return 4;let n=Math.max(t,Math.floor(1.8*t)),r=Math.min(310,Math.ceil(2.75*t)+8),i=Math.round(2*t+.015*t**(5/3)),a=-1/0;for(let e=n;e<=r;e+=1){let n=x(t,e)/e,r=x(t+1,e),o=x(t-1,e),s=x(t,e),c=r-s+(p-f-m),l=o-s-1.804331310000022,u=n+(c<=0&&l<=0?.35:0);u>a&&(a=u,i=e)}return i}function E(e,t,n,{sampleCount:r=64}={}){let i=Math.max(1,e-2),a=Math.max(1,t-4),o=1.25*(Math.cbrt(a)+Math.cbrt(4)),s=4*a/(4+a)*h,c=2*i*_*g,l=c/o,u=Number(n),d=u>.05?Math.min(250,c/u*1.25):Math.max(40,o*4),f=new Float32Array(r),p=new Float32Array(r);for(let e=0;e<r;e+=1){let t=.5+e/(r-1)*d;f[e]=t,p[e]=-45/(1+Math.exp((t-o)/.55))+(t>=o?c/t:c/(2*o)*(3-t*t/(o*o)))}if(!(u>.05))return Object.freeze({tunnelingAllowed:!1,barrierHeightMeV:l,turningPointFm:1/0,gamowExponent:1/0,log10HalfLifeS:1/0,rFm:f,vMeV:p});let m=c/u,v=0;if(m>o){let e=(m-o)/64;for(let t=0;t<64;t+=1){let n=o+(t+.5)*e,r=Math.max(0,c/n-u);v+=Math.sqrt(2*s*r)/g*e}v*=2}let y=Math.sqrt(2*u/s)*299792458e15/(2*o),b=v/Math.LN10-Math.log10(Math.max(1e10,y))+Math.log10(Math.LN2);return Object.freeze({tunnelingAllowed:!0,barrierHeightMeV:l,turningPointFm:m,gamowExponent:v,log10HalfLifeS:b,rFm:f,vMeV:p})}function D(n,r=null){let o=Math.trunc(n),s=r==null?T(o):Math.trunc(r),l=s-o,u=x(o,s),d=u/s,g=o*938.78308711+l*p-u,_=g/h,y=g-s*h,b=S(s),C=b/v,D=w(o,s),O=o>=2&&s>=5?x(o-2,s-4)+x(2,4)-u:-10,k=x(o+1,s)-u+(p-f-m),A=o>1?x(o-1,s)-u-(p-f-m):-10,j=o*o/(s*48),M=Math.max(0,.72*c*Math.cbrt(s*s)*Math.max(0,1-j)**3),N=E(o,s,O),P=`stable`,F=1/0,I=o,L=s;j>=.92&&o>=96?(P=`spontaneous-fission`,F=Math.max(-6,18*(1-j)*10),I=Math.floor(o/2),L=Math.floor(s/2)):k>.05&&k>=A?(P=`beta-minus`,F=Math.max(-3,5.5-5*Math.log10(Math.max(.1,k))),I=o+1,L=s):A>.05?(P=A>1.022?`beta-plus`:`electron-capture`,F=Math.max(-3,5.8-4.5*Math.log10(Math.max(.1,A))),I=o-1,L=s):(o>=84||O>1.8&&N.log10HalfLifeS<22)&&(P=`alpha`,F=N.log10HalfLifeS,I=o-2,L=s-4);let R=e(o)||`Z${o}`;return Object.freeze({schema:i,generatorFingerprint:a,isotope:`${R}-${s}`,Z:o,N:l,A:s,bindingEnergyMeV:u,bindingPerNucleonMeV:d,atomicMassU:_,massExcessMeV:y,chargeRadiusFm:b,chargeRadiusBohr:C,spinI:D.spinI,parity:D.parity,shellLabel:D.shellLabel,magneticMomentMuN:D.magneticMomentMuN,fissility:j,fissionBarrierMeV:M,qAlphaMeV:O,qBetaMinusMeV:k,qElectronCaptureMeV:A,dominantMode:P,daughterZ:I,daughterA:L,log10HalfLifeS:F,alphaWkb:N,accuracyTier:o<=100?t.TIER_1_QUANTITATIVE:t.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,model:`ldm-strutinsky-woods-saxon-wkb`})})}var O=`
struct NuclearParams {
  z_sel: u32,
  a_sel: u32,
  vol_dim: u32,
  max_z: u32,
  max_n: u32,
  r_half_fm: f32,
  diffuseness_fm: f32,
  box_half_fm: f32,
};

@group(0) @binding(0) var<uniform> params: NuclearParams;
// Output 2D chart of nuclides: vec4(B_per_A_MeV, Q_alpha, Q_beta_minus, modeCode)
// modeCode: 0=unbound, 1=stable, 2=beta-, 3=beta+/EC, 4=alpha, 5=fission
@group(0) @binding(1) var<storage, read_write> nuclide_chart: array<vec4<f32>>;
// Output 3D nuclear density volume (vol_dim^3): vec4(rho_p, rho_n, V_coul_norm, alpha_density)
@group(0) @binding(2) var<storage, read_write> nuclear_volume: array<vec4<f32>>;

fn shell_corr(z_f: f32, n_f: f32) -> f32 {
  var mag = array<f32, 8>(2.0, 8.0, 20.0, 28.0, 50.0, 82.0, 126.0, 184.0);
  var acc = 0.0;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let m = mag[i];
    let w = 1.6 + 0.03 * m;
    let inv2w2 = 0.5 / (w * w);
    let dz = z_f - m;
    let dn = n_f - m;
    acc = acc + 3.8 * exp(-dz * dz * inv2w2) + 3.8 * exp(-dn * dn * inv2w2);
  }
  return acc;
}

fn binding_mev(z_i: i32, a_i: i32) -> f32 {
  let n_i = a_i - z_i;
  if (z_i < 0 || n_i < 0 || a_i <= 1) { return 0.0; }
  if (z_i == 1 && a_i == 2) { return 2.22457; }
  if (z_i == 2 && a_i == 4) { return 28.2957; }
  let z = f32(z_i);
  let n = f32(n_i);
  let a = f32(a_i);
  let a13 = pow(a, 1.0 / 3.0);
  let a23 = a13 * a13;
  var pair = 0.0;
  if ((z_i & 1) == 0 && (n_i & 1) == 0) {
    pair = 11.18 / sqrt(a);
  } else if ((z_i & 1) == 1 && (n_i & 1) == 1) {
    pair = -11.18 / sqrt(a);
  }
  let b = 15.75 * a - 17.80 * a23 - 0.711 * z * (z - 1.0) / a13
    - 23.70 * (n - z) * (n - z) / a + pair + shell_corr(z, n);
  return max(0.0, b);
}

@compute @workgroup_size(64)
fn compute_nuclide_chart(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.max_z * params.max_n;
  if (idx >= total) { return; }
  let z = i32(idx / params.max_n) + 1;
  let n = i32(idx % params.max_n);
  let a = z + n;
  let b = binding_mev(z, a);
  let ba = b / f32(a);
  let b_n_prev = binding_mev(z, a - 1);
  let b_p_prev = binding_mev(z - 1, a - 1);
  // Outside drip lines -> unbound
  if (a > 1 && (b - b_n_prev < 0.0 || b - b_p_prev < 0.0)) {
    nuclide_chart[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }
  let q_alpha = select(-10.0, binding_mev(z - 2, a - 4) + 28.2957 - b, z >= 2 && a >= 5);
  let q_bm = binding_mev(z + 1, a) - b + 0.78233;
  let q_ec = select(-10.0, binding_mev(z - 1, a) - b - 0.78233, z > 1);
  let fiss = f32(z * z) / (f32(a) * 48.0);
  var mode = 1.0; // stable
  if (fiss >= 0.92 && z >= 96) {
    mode = 5.0;
  } else if (q_bm > 0.05 && q_bm >= q_ec) {
    mode = 2.0;
  } else if (q_ec > 0.05) {
    mode = 3.0;
  } else if (z >= 84 || q_alpha > 2.2) {
    mode = 4.0;
  }
  nuclide_chart[idx] = vec4<f32>(ba, q_alpha, q_bm, mode);
}

@compute @workgroup_size(64)
fn compute_nuclear_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.vol_dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let r_fm = length(vec3<f32>(fx, fy, fz)) * params.box_half_fm;
  let r_p = params.r_half_fm;
  // Neutron skin thickness delta_r_np ~ 0.12 * (N - Z) / A * 2.5 fm
  let z_f = f32(params.z_sel);
  let a_f = max(1.0, f32(params.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let r_n = r_p + max(0.0, 0.3 * (n_f - z_f) / a_f);
  let rho_p = (z_f / a_f) / (1.0 + exp((r_fm - r_p) / params.diffuseness_fm));
  let rho_n = (n_f / a_f) / (1.0 + exp((r_fm - r_n) / params.diffuseness_fm));
  let v_coul = select(r_p / max(r_fm, 0.1), 0.5 * (3.0 - (r_fm * r_fm) / max(r_p * r_p, 0.01)), r_fm < r_p);
  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  nuclear_volume[idx] = vec4<f32>(rho_p, rho_n, clamp(v_coul * 0.65, 0.0, 1.0), dens);
}
`;async function k(e,t,i=null,{volDim:a=32,maxZ:s=118,maxN:c=200}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveNuclearStructureWebGpu requires a live WebGPU GPUDevice`);let l=D(t,i),u=Math.cbrt(l.A),d=Math.max(.9,1.23*u-.6/u),f=Math.max(4.5,d*1.9),p=s*c,m=a*a*a,h=[n(0,`uniform`),n(1,`storage`),n(2,`storage`)],g=r(e,{cacheKey:`ulg-nuclear-chart.v1`,label:`ulg-nuclear-chart`,code:O,entryPoint:`compute_nuclide_chart`,bindings:h}),_=r(e,{cacheKey:`ulg-nuclear-volume.v1`,label:`ulg-nuclear-volume`,code:O,entryPoint:`compute_nuclear_volume`,bindings:h}),v=new ArrayBuffer(32);new Uint32Array(v,0,5).set([l.Z,l.A,a,s,c]),new Float32Array(v,20,3).set([d,.523,f]);let y=e.createBuffer({size:32,usage:o.UNIFORM|o.COPY_DST});e.queue.writeBuffer(y,0,v);let b=e.createBuffer({size:p*16,usage:o.STORAGE|o.COPY_SRC}),x=e.createBuffer({size:m*16,usage:o.STORAGE|o.COPY_SRC}),S=e.createBuffer({size:p*16,usage:o.MAP_READ|o.COPY_DST}),C=e.createBuffer({size:m*16,usage:o.MAP_READ|o.COPY_DST}),w=e.createBindGroup({layout:g.bindGroupLayout,entries:[y,b,x].map((e,t)=>({binding:t,resource:{buffer:e}}))}),T=e.createCommandEncoder({label:`ulg-nuclear-structure`}),E=T.beginComputePass({label:`ulg-nuclear-structure-pass`});E.setBindGroup(0,w),E.setPipeline(g.pipeline),E.dispatchWorkgroups(Math.ceil(p/64)),E.setPipeline(_.pipeline),E.dispatchWorkgroups(Math.ceil(m/64)),E.end(),T.copyBufferToBuffer(b,0,S,0,p*16),T.copyBufferToBuffer(x,0,C,0,m*16),e.queue.submit([T.finish()]);try{await Promise.all([S.mapAsync(o.MAP_READ),C.mapAsync(o.MAP_READ)]);let e=new Float32Array(S.getMappedRange().slice(0,p*16)),t=new Float32Array(C.getMappedRange().slice(0,m*16));return S.unmap(),C.unmap(),Object.freeze({...l,backend:`webgpu`,chartDims:Object.freeze({maxZ:s,maxN:c}),chartData:e,volDim:a,boxHalfFm:f,volumeData:t})}finally{for(let e of[y,b,x,S,C])e.destroy()}}var A=`ulg.nuclear.fission-ldm-webgpu.v1`;function j(e,t,{samples:n=48}={}){let r=Math.max(1,Math.trunc(Number(e)||92)),i=Math.max(r,Math.trunc(Number(t)||235)),a=Math.cbrt(i),o=a*a*c,s=l*(r*(r-1))/a,u=Math.max(.01,Math.min(1.25,s/Math.max(1e-6,2*o))),d=new Float32Array(n),f=new Float32Array(n),p=0,m=.72,h=0;for(let e=0;e<n;e+=1){let t=e/(n-1)*1.35;d[e]=t;let r=t*t,i=r*t,a=r*r,c=o*(.4*r-4/105*i-.14*a),l=s*(-.2*r-4/105*i-.18*a),u=t>.9?-Math.min(185,.35*s*((t-.9)/.45)**2.2):0,g=c+l+u;f[e]=g,t<=1.05&&g>p&&(p=g,m=t,h=e)}return Object.freeze({schema:A,Z:r,A:i,fissility:u,eSurf0MeV:o,eCoul0MeV:s,barrierMeV:p,saddleBeta:m,scissionBeta:1.02,peakIdx:h,betas:d,deltaEMeV:f})}var M=`
struct FissionParams {
  dim: u32,
  z_sel: u32,
  a_sel: u32,
  pad0: u32,
  beta2: f32,
  r_half_fm: f32,
  box_half_fm: f32,
  diffuseness_fm: f32,
};

@group(0) @binding(0) var<uniform> p: FissionParams;
@group(0) @binding(1) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn compute_fission_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = p.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }

  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  let pos = vec3<f32>(fx, fy, fz) * p.box_half_fm;
  let beta = clamp(p.beta2, 0.0, 1.4);
  let z_f = f32(p.z_sel);
  let a_f = max(1.0, f32(p.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let skin = max(0.0, 0.30 * (n_f - z_f) / a_f);
  let diff = max(0.25, p.diffuseness_fm);

  var rho_p = 0.0;
  var rho_n = 0.0;

  if (beta <= 0.98) {
    // Continuous volume-conserving quadrupole + hexadecapole necking liquid drop along X!
    let r = max(1.0e-4, length(pos));
    let ct = pos.x / r;
    let p2 = 0.5 * (3.0 * ct * ct - 1.0);
    let p4 = 0.125 * (35.0 * ct * ct * ct * ct - 30.0 * ct * ct + 3.0);
    // Necking constriction deepens smoothly past beta = 0.45
    let neck = max(0.0, beta - 0.35) * 0.48;
    let vol_norm = 1.0 / pow(max(0.25, 1.0 + 0.12 * beta * beta), 0.3333333);
    let r_surf_p = p.r_half_fm * vol_norm * max(0.06, 1.0 + 0.62 * beta * p2 + neck * p4);
    let r_surf_n = r_surf_p + skin;
    rho_p = (z_f / a_f) / (1.0 + exp((r - r_surf_p) / diff));
    rho_n = (n_f / a_f) / (1.0 + exp((r - r_surf_n) / diff));
  } else {
    // Post-scission: two asymmetric Coulomb-repelling fission fragments (e.g. ~58%/42% mass split!)
    let sep = (beta - 0.96) * p.r_half_fm * 2.35;
    let r_heavy = p.r_half_fm * pow(0.58, 0.3333333);
    let r_light = p.r_half_fm * pow(0.42, 0.3333333);
    let c_heavy = vec3<f32>(-sep * 0.88 - r_heavy * 0.72, 0.0, 0.0);
    let c_light = vec3<f32>( sep * 1.12 + r_light * 0.72, 0.0, 0.0);
    let dh = length(pos - c_heavy);
    let dl = length(pos - c_light);
    let rp_h = (z_f / a_f) / (1.0 + exp((dh - r_heavy) / diff));
    let rp_l = (z_f / a_f) / (1.0 + exp((dl - r_light) / diff));
    let rn_h = (n_f / a_f) / (1.0 + exp((dh - (r_heavy + skin)) / diff));
    let rn_l = (n_f / a_f) / (1.0 + exp((dl - (r_light + skin)) / diff));
    rho_p = clamp(rp_h + rp_l, 0.0, 1.0);
    rho_n = clamp(rn_h + rn_l, 0.0, 1.0);
  }

  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  // Warm amber-orange proton core, cyan neutron skin, radiant white-gold neck stress highlight
  let neck_glow = exp(-pos.x * pos.x / max(0.5, p.r_half_fm * 0.45)) * smoothstep(0.4, 0.98, beta) * step(beta, 1.02) * dens;
  let col_r = clamp(rho_p * 2.1 + neck_glow * 0.75, 0.0, 1.0);
  let col_g = clamp(rho_p * 1.15 + rho_n * 0.85 + neck_glow * 0.60, 0.0, 1.0);
  let col_b = clamp(rho_n * 1.75 + neck_glow * 0.25, 0.0, 1.0);
  vol_out[idx] = vec4<f32>(col_r, col_g, col_b, dens);
}
`,N=new WeakMap;function P(e,t,{beta2:i=0,dim:a=28,reuseBuffer:s=null}={}){if(!e||typeof e.createBuffer!=`function`)return null;let c=N.get(e);c||(c={pipe:r(e,{cacheKey:`ulg-nuclear-fission-vol.v1`,label:`ulg-nuclear-fission-vol`,code:M,entryPoint:`compute_fission_volume`,bindings:[n(0,`uniform`),n(1,`storage`)]}),pBuf:e.createBuffer({label:`ulg-fission-params`,size:32,usage:o.UNIFORM|o.COPY_DST})},N.set(e,c));let l=Math.max(1,Math.trunc(Number(t?.Z)||92)),u=Math.max(l,Math.trunc(Number(t?.A)||235)),d=Math.cbrt(u),f=Math.max(.9,1.23*d-.6/d),p=Math.max(6.5,f*2.55),m=a*a*a,h=m*16,g=s&&s.size>=h?s:e.createBuffer({label:`ulg-nuclear-fission-3d`,size:h,usage:o.STORAGE|o.COPY_SRC}),_=new ArrayBuffer(32);new Uint32Array(_,0,4).set([a,l,u,0]),new Float32Array(_,16,4).set([Number(i)||0,f,p,.523]),e.queue.writeBuffer(c.pBuf,0,_);let v=e.createBindGroup({layout:c.pipe.bindGroupLayout,entries:[{binding:0,resource:{buffer:c.pBuf}},{binding:1,resource:{buffer:g}}]}),y=e.createCommandEncoder({label:`ulg-fission-vol-enc`}),b=y.beginComputePass();return b.setPipeline(c.pipe.pipeline),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(m/64)),b.end(),e.queue.submit([y.finish()]),{buffer:g,dim:a,beta2:Number(i)||0}}function F(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`nuclear-fission-ldm`,version:`1`},kernel:{sourceModule:`src/runtime/nuclear/nuclearStructureGpu.js`,entryPoint:`compute_fission_volume`,workgroupSize:64,wgsl:M},parameterSchema:{Z:{type:`number`,min:1,max:118},A:{type:`number`,min:1,max:310},beta2:{type:`number`,min:0,max:1.35}},stateLayout:{tensorId:`nuclear_fission_volume_3d`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=e?.parameters||{},r=j(n.Z??92,n.A??235),i=t?.device?P(t.device,{Z:n.Z??92,A:n.A??235},{beta2:n.beta2??r.saddleBeta,dim:16}):null;return i?.buffer&&i.buffer.destroy(),{status:`ok`,curve:r}}})}export{x as a,T as i,P as n,F as o,D as r,k as s,j as t};