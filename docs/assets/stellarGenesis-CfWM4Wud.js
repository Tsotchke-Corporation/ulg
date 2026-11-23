import{Bi as e,Go as t,Jn as n,Li as r,Nt as i,Pn as a,Qi as o,Ro as s,To as c,Wo as l,X as u,dt as d,ei as f,hc as p,li as m,m as h,mc as g,n as _,ps as v,qt as y,r as b,rt as x,ti as S,vo as C,yc as w}from"./three.webgpu-CS9zZwr2.js";import{H as T,I as E,N as D,P as O,xw as k,z as A}from"./eshkolTriadClosures-2aA1ll1H.js";import{n as ee,t as j}from"./ClosureRegistry-CGNmlK6s.js";import{computeBufferBinding as M,createCachedExplicitBindGroup as N,createCachedExplicitComputePipeline as P}from"../runtime/webgpuComputeLayout.js";import{t as F}from"./radiationClosure-BGs3nxOr.js";import{f as te,i as I,m as L,n as R,o as ne,p as re}from"./volumetricOrbitalRaymarcher-CrgVTiqZ.js";var ie=`peercompute.ulg.hydrogen-stellar-closure.v1`,z=`peercompute.ulg.stellar-closure-table-abi.v1`,B=1380649e-29,ae=16605390666e-37,V=167262192369e-38,H=91093837015e-41,U=1054571817e-43,W=299792458,oe=66743e-15,se=4*5.670374419e-8/W,G=1602176634e-28,ce=1602176634e-22,K=27.211386245988,q=198847e25,J=26.2*ce/(4*V),Y=7.275*ce/(12*V),X=null;function Z({forceRecompute:e=!1}={}){if(X&&!e)return X;let t=D(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),n=t.orbitals?.[0]?.energyHa??-.5,r=Math.max(11,Math.min(15,Math.abs(t.totalEnergyHa)*K)),i=T([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),a=T([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),o=Math.max(.08,a.totalEnergyHa-i.totalEnergyHa)*K,s=.04,c=T([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,l=T([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,u=T([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-s]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,d=Math.max(.1,(c-2*l+u)/(s*s)),f=Math.sqrt(d/(.5*1836.152673))*K*G/B,p=A(15e4/V*O**3),m=E(p);return X=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:t.totalEnergyHa,h1sOrbitalEnergyHa:n,hIonizationEv:r,hIonizationTempK:r*G/B,h2EqEnergyHa:i.totalEnergyHa,h2DissEnergyHa:a.totalEnergyHa,h2DiradicalStretched:a.diradicalCharacter,h2DissociationEv:o,h2DissociationTempK:o*G/B,h2VibrationalTempK:f,uegSolarCoreRsBohr:p,uegSolarCoreKineticHa:m,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),X}function le(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/V);if(n<=0)return 0;let r=U*Math.cbrt(3*Math.PI*Math.PI*n)/(H*W),i=r*r,a=H**4*W**5/(24*Math.PI*Math.PI*U**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function ue(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function de({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||Z(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/V,m=s*d/(4*V),h=s*f/(16*V),g=2*Math.PI*V*B*c/(2*Math.PI*U)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*H*B*c/(2*Math.PI*U)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),ee=s/ae/A,j=A*B*c,M=se/3*c**4,N=le(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),P=ue(s),F=j+M+N+P,te=N/Math.max(1e-30,F),I=M/Math.max(1e-30,F),L=P/Math.max(1e-30,F),R=4*b*(1-b),ne=4*w*(1-w),re=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,z=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),W=z*(1-I)+4/3*I,oe=Math.max(1.06,W-.5*R-.48*ne-re)*(1-L)+2.75*L,ce=.1*(1/(1+Math.exp((c-1600)/180))),K=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),q=4e21*(1+u)*(f+.001)*s*c**-3.5,J=.02*(1+u)*Math.max(.01,w),Y=Math.max(1e-4,Math.min(1e5,ce+K+q+J)),X=j/(Math.max(.15,z-1)*s)+3*M/s,de=(1-b)*.5*u*o.h2DissociationEv*G/V,fe=w*u*o.hIonizationEv*G/V,pe=X+de+fe;return{schema:ie,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:ee,gammaEff:oe,pressureIdealPa:j,pressureRadPa:M,pressureDegPa:N,pressureNucSatPa:P,pressureTotalPa:F,pDegFraction:te,pRadFraction:I,pNucFraction:L,soundSpeedMPerS:Math.sqrt(Math.max(1,oe*F/s)),kappaM2PerKg:Y,specificEnergyJPerKg:pe,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function fe({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/J),E=Math.min(d+T,x*a/Y),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*oe*e*q/(W*W),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function pe(e){let t=F(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function me({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function he({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01}={}){let l=Z(),u=new Float32Array(e*t*8);for(let d=0;d<t;d+=1){let f=10**(i+d/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=de({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:l}),a=(d*e+t)*8;u[a+0]=i.mu,u[a+1]=i.gammaEff,u[a+2]=i.fH2,u[a+3]=i.xIonized,u[a+4]=i.pDegFraction,u[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),u[a+6]=i.pNucFraction,u[a+7]=i.pRadFraction}}return{schema:z,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:l,data:u,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function ge({closureRegistry:e,closureTable:t=null,closureId:n=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let r=t||he(),i={closureId:n,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${r.nRho}x${r.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:r},validity:{log10Rho:[r.logRhoMin,r.logRhoMax],log10T:[r.logTempMin,r.logTempMax]},provenance:{schema:z,anchors:r.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:r.validation}};return{ref:e?await e.store(i):null,artifact:i,table:r}}var _e=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,ve=128,ye=`
struct HydroParticle {
  pos_mass: vec4<f32>,   // [x, y, z, mass_sim]
  vel_smooth: vec4<f32>, // [vx, vy, vz, h_smooth]
  thermo: vec4<f32>,     // [log10T, log10Rho, xH, log10EpsNuc]
  state: vec4<f32>,      // [fMol, xIon, xHe, xZ]
};

struct EosClosureCell {
  eos0: vec4<f32>,       // [mu, gammaEff, fMol, xIon]
  eos1: vec4<f32>,       // [pDegFrac, log10Kappa, pNucFrac, pRadFrac]
};

struct HydroParams {
  count: u32,
  n_rho: u32,
  n_temp: u32,
  pad_u32: u32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  inner_half: f32,
  theta2: f32,
  log_rho_min: f32,
  log_rho_max: f32,
  log_t_min: f32,
  log_t_max: f32,
  base_log_rho: f32,
  ref_rho_sim: f32,
  burn_timescale_s: f32,
  time_accel: f32,
  pad_f0: f32,
  pad_f1: f32,
};

@group(0) @binding(0) var<storage, read> src_particles: array<HydroParticle>;
@group(0) @binding(1) var<storage, read_write> dst_particles: array<HydroParticle>;
// Outer 16^3 Barnes-Hut leaf accum: 4096 * 4 atomic<i32> = [mass_q, mx_q, my_q, mz_q]
@group(0) @binding(2) var<storage, read_write> outer_accum: array<atomic<i32>>;
// Outer octree nodes: 4096 L2 + 64 L1 = 4160 vec4<f32> [com.xyz, mass]
@group(0) @binding(3) var<storage, read_write> outer_tree: array<vec4<f32>>;
// Inner 16^3 core SPH grid accum: 4096 * 4 atomic<i32> = [mass_q, press_q, temp_q, vr_q]
@group(0) @binding(4) var<storage, read_write> inner_accum: array<atomic<i32>>;
// Inner 16^3 finalized core fields: 4096 vec4<f32> [mass_cell, press_cell, mean_logT, mean_vr]
@group(0) @binding(5) var<storage, read_write> inner_grid: array<vec4<f32>>;
// Pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
@group(0) @binding(6) var<storage, read> eos_table: array<EosClosureCell>;
// 16 atomic<u32> global diagnostic telemetry slots (64 B)
@group(0) @binding(7) var<storage, read_write> telemetry: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: HydroParams;

const L2_COUNT: u32 = 4096u;
const L1_COUNT: u32 = 64u;
const Q_MASS: f32 = 1024.0;
const Q_MOM: f32 = 64.0;
const Q_FIELD: f32 = 64.0;

fn clamp_cell16(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(15u, u32(u * 16.0));
}

fn cell_idx16(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 256u) + (cy * 16u) + cx;
}

fn sample_eos_table(log_rho: f32, log_t: f32) -> EosClosureCell {
  let nr = max(2u, params.n_rho);
  let nt = max(2u, params.n_temp);
  let ur = clamp((log_rho - params.log_rho_min) / max(1e-4, params.log_rho_max - params.log_rho_min), 0.0, 0.9999) * f32(nr - 1u);
  let ut = clamp((log_t - params.log_t_min) / max(1e-4, params.log_t_max - params.log_t_min), 0.0, 0.9999) * f32(nt - 1u);
  let r0 = min(nr - 2u, u32(ur));
  let t0 = min(nt - 2u, u32(ut));
  let fr = ur - f32(r0);
  let ft = ut - f32(t0);

  let c00 = eos_table[t0 * nr + r0];
  let c10 = eos_table[t0 * nr + (r0 + 1u)];
  let c01 = eos_table[(t0 + 1u) * nr + r0];
  let c11 = eos_table[(t0 + 1u) * nr + (r0 + 1u)];

  let e0_lo = mix(c00.eos0, c10.eos0, fr);
  let e0_hi = mix(c01.eos0, c11.eos0, fr);
  let e1_lo = mix(c00.eos1, c10.eos1, fr);
  let e1_hi = mix(c01.eos1, c11.eos1, fr);

  return EosClosureCell(mix(e0_lo, e0_hi, ft), mix(e1_lo, e1_hi, ft));
}

@compute @workgroup_size(64)
fn sgh_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < L2_COUNT) {
    let base = i * 4u;
    atomicStore(&outer_accum[base + 0u], 0);
    atomicStore(&outer_accum[base + 1u], 0);
    atomicStore(&outer_accum[base + 2u], 0);
    atomicStore(&outer_accum[base + 3u], 0);
    atomicStore(&inner_accum[base + 0u], 0);
    atomicStore(&inner_accum[base + 1u], 0);
    atomicStore(&inner_accum[base + 2u], 0);
    atomicStore(&inner_accum[base + 3u], 0);
    outer_tree[i] = vec4<f32>(0.0);
    inner_grid[i] = vec4<f32>(0.0);
  }
  if (i < L1_COUNT) {
    outer_tree[L2_COUNT + i] = vec4<f32>(0.0);
  }
  if (i < 16u) {
    atomicStore(&telemetry[i], 0u);
  }
}

@compute @workgroup_size(64)
fn sgh_deposit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = src_particles[i];
  let pm = p.pos_mass;
  if (pm.w <= 0.0) { return; }

  // 1. Outer 16^3 Barnes-Hut monopole accumulation
  let cx = clamp_cell16(pm.x, params.box_half);
  let cy = clamp_cell16(pm.y, params.box_half);
  let cz = clamp_cell16(pm.z, params.box_half);
  let obase = cell_idx16(cx, cy, cz) * 4u;
  atomicAdd(&outer_accum[obase + 0u], i32(clamp(pm.w * Q_MASS, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 1u], i32(clamp(pm.w * pm.x * Q_MOM, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 2u], i32(clamp(pm.w * pm.y * Q_MOM, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 3u], i32(clamp(pm.w * pm.z * Q_MOM, -1e8, 1e8)));

  // 2. Inner high-resolution 16^3 SPH core grid accumulation
  let ih = params.inner_half;
  if (abs(pm.x) < ih && abs(pm.y) < ih && abs(pm.z) < ih) {
    let ix = clamp_cell16(pm.x, ih);
    let iy = clamp_cell16(pm.y, ih);
    let iz = clamp_cell16(pm.z, ih);
    let ibase = cell_idx16(ix, iy, iz) * 4u;
    let logT = clamp(p.thermo.x, 1.0, 9.6);
    let logRho = clamp(p.thermo.y, -18.0, 11.0);
    let eos = sample_eos_table(logRho, logT);
    let mu_g = max(0.45, eos.eos0.x);
    let gamma_g = clamp(eos.eos0.y, 1.05, 2.75);
    let p_deg = clamp(eos.eos1.x, 0.0, 1.0);
    let p_nuc = clamp(eos.eos1.z, 0.0, 1.0);
    let p_rad = clamp(eos.eos1.w, 0.0, 1.0);

    // General dimensionless hydrodynamic pressure from EOS closure:
    //   thermal ideal gas + radiation + Fermi-Dirac degeneracy + stiff nuclear-saturation EOS wall!
    let t_therm = clamp((logT - 1.35) / 6.2, 0.0, 1.65);
    let soften = clamp((gamma_g - 1.02) / 0.65, 0.18, 2.6);
    let cs2_thermal = (0.02 + 3.2 * t_therm * t_therm * t_therm / mu_g) * soften;
    let cs2_rad = p_rad * 12.0;
    let cs2_deg = p_deg * 18.0;
    let cs2_nuc = p_nuc * 460.0;
    let press_cell = pm.w * (cs2_thermal + cs2_rad + cs2_deg + cs2_nuc);

    let r_len = max(0.15, length(pm.xyz));
    let vr = dot(p.vel_smooth.xyz, pm.xyz) / r_len;
    atomicAdd(&inner_accum[ibase + 0u], i32(clamp(pm.w * Q_MASS, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 1u], i32(clamp(press_cell * Q_FIELD, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 2u], i32(clamp(pm.w * logT * Q_FIELD, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 3u], i32(clamp(pm.w * vr * Q_FIELD, -1e8, 1e8)));
  }
}

@compute @workgroup_size(64)
fn sgh_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= L2_COUNT) { return; }
  let base = cell * 4u;

  let m_out = f32(atomicLoad(&outer_accum[base + 0u])) / Q_MASS;
  if (m_out > 1e-6) {
    let inv_m = 1.0 / m_out;
    let mx = (f32(atomicLoad(&outer_accum[base + 1u])) / Q_MOM) * inv_m;
    let my = (f32(atomicLoad(&outer_accum[base + 2u])) / Q_MOM) * inv_m;
    let mz = (f32(atomicLoad(&outer_accum[base + 3u])) / Q_MOM) * inv_m;
    outer_tree[cell] = vec4<f32>(mx, my, mz, m_out);
  } else {
    outer_tree[cell] = vec4<f32>(0.0);
  }

  let m_in = f32(atomicLoad(&inner_accum[base + 0u])) / Q_MASS;
  if (m_in > 1e-6) {
    let p_sum = f32(atomicLoad(&inner_accum[base + 1u])) / Q_FIELD;
    let t_mean = (f32(atomicLoad(&inner_accum[base + 2u])) / Q_FIELD) / m_in;
    let vr_mean = (f32(atomicLoad(&inner_accum[base + 3u])) / Q_FIELD) / m_in;
    inner_grid[cell] = vec4<f32>(m_in, p_sum, t_mean, vr_mean);
  } else {
    inner_grid[cell] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn sgh_reduce_coarse(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= L1_COUNT) { return; }
  let px = p & 3u;
  let py = (p >> 2u) & 3u;
  let pz = (p >> 4u) & 3u;
  var m_sum = 0.0;
  var mom = vec3<f32>(0.0);
  for (var dz = 0u; dz < 4u; dz = dz + 1u) {
    for (var dy = 0u; dy < 4u; dy = dy + 1u) {
      for (var dx = 0u; dx < 4u; dx = dx + 1u) {
        let leaf = outer_tree[cell_idx16(px * 4u + dx, py * 4u + dy, pz * 4u + dz)];
        if (leaf.w > 0.0) {
          m_sum = m_sum + leaf.w;
          mom = mom + leaf.xyz * leaf.w;
        }
      }
    }
  }
  if (m_sum > 1e-6) {
    outer_tree[L2_COUNT + p] = vec4<f32>(mom / m_sum, m_sum);
  } else {
    outer_tree[L2_COUNT + p] = vec4<f32>(0.0);
  }
}

fn read_inner(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 15 || iy < 0 || iy > 15 || iz < 0 || iz > 15) {
    return vec4<f32>(0.0);
  }
  return inner_grid[cell_idx16(u32(ix), u32(iy), u32(iz))];
}

@compute @workgroup_size(64)
fn sgh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let p = src_particles[idx];
  let self_pm = p.pos_mass;
  let self_vs = p.vel_smooth;
  if (self_pm.w <= 0.0) {
    dst_particles[idx] = p;
    return;
  }

  let l1_size = (2.0 * params.box_half) / 4.0;
  let open_thresh2 = (l1_size * l1_size) / max(0.05, params.theta2);
  let self_cx = clamp_cell16(self_pm.x, params.box_half);
  let self_cy = clamp_cell16(self_pm.y, params.box_half);
  let self_cz = clamp_cell16(self_pm.z, params.box_half);
  let self_leaf_id = cell_idx16(self_cx, self_cy, self_cz);

  // 1. General Barnes-Hut self-gravity acceleration AND gravitational potential depth |Phi_i|
  //    Strictly proportional to actual particle masses m_j (ZERO preset parameters!)
  var acc_grav = vec3<f32>(0.0);
  var grav_phi = 0.0;
  for (var coarse_i = 0u; coarse_i < L1_COUNT; coarse_i = coarse_i + 1u) {
    let coarse = outer_tree[L2_COUNT + coarse_i];
    if (coarse.w <= 0.0) { continue; }
    let d_c = coarse.xyz - self_pm.xyz;
    let dist2_c = dot(d_c, d_c);
    if (dist2_c > open_thresh2) {
      let r2 = dist2_c + params.softening2;
      let inv_r = inverseSqrt(r2);
      acc_grav = acc_grav + d_c * (coarse.w * inv_r * inv_r * inv_r);
      grav_phi = grav_phi + coarse.w * inv_r;
    } else {
      let px = coarse_i & 3u;
      let py = (coarse_i >> 2u) & 3u;
      let pz = (coarse_i >> 4u) & 3u;
      for (var dz = 0u; dz < 4u; dz = dz + 1u) {
        for (var dy = 0u; dy < 4u; dy = dy + 1u) {
          for (var dx = 0u; dx < 4u; dx = dx + 1u) {
            let leaf_id = cell_idx16(px * 4u + dx, py * 4u + dy, pz * 4u + dz);
            let leaf = outer_tree[leaf_id];
            if (leaf.w <= 0.0) { continue; }
            var eff_m = leaf.w;
            var eff_pos = leaf.xyz;
            if (leaf_id == self_leaf_id) {
              eff_m = leaf.w - self_pm.w;
              if (eff_m <= 1e-6) { continue; }
              eff_pos = (leaf.xyz * leaf.w - self_pm.xyz * self_pm.w) / eff_m;
            }
            let d = eff_pos - self_pm.xyz;
            let r2 = dot(d, d) + params.softening2;
            let inv_r = inverseSqrt(r2);
            acc_grav = acc_grav + d * (eff_m * inv_r * inv_r * inv_r);
            grav_phi = grav_phi + eff_m * inv_r;
          }
        }
      }
    }
  }
  acc_grav = acc_grav * params.gravity_g;
  grav_phi = grav_phi * params.gravity_g;

  // 2. Measure local SPH mass density, pressure gradient (-grad P / rho), and velocity convergence
  let ih = params.inner_half;
  let outer_m = outer_tree[self_leaf_id].w;
  var local_rho_sim = max(self_pm.w * 1.5, outer_m * 0.14);
  var acc_press = vec3<f32>(0.0);
  var infall_compress = 0.0;
  let inside_inner = abs(self_pm.x) < ih && abs(self_pm.y) < ih && abs(self_pm.z) < ih;
  if (inside_inner) {
    let ix = i32(clamp_cell16(self_pm.x, ih));
    let iy = i32(clamp_cell16(self_pm.y, ih));
    let iz = i32(clamp_cell16(self_pm.z, ih));
    let c_mid = read_inner(ix, iy, iz);
    let c_xp = read_inner(ix + 1, iy, iz);
    let c_xm = read_inner(ix - 1, iy, iz);
    let c_yp = read_inner(ix, iy + 1, iz);
    let c_ym = read_inner(ix, iy - 1, iz);
    let c_zp = read_inner(ix, iy, iz + 1);
    let c_zm = read_inner(ix, iy, iz - 1);

    let nbr_mass = c_mid.x + 0.18 * (c_xp.x + c_xm.x + c_yp.x + c_ym.x + c_zp.x + c_zm.x);
    local_rho_sim = max(local_rho_sim, nbr_mass * 3.8);

    let cell_w = (2.0 * ih) / 16.0;
    let grad_p = vec3<f32>(
      (c_xp.y - c_xm.y) / (2.0 * cell_w),
      (c_yp.y - c_ym.y) / (2.0 * cell_w),
      (c_zp.y - c_zm.y) / (2.0 * cell_w)
    );
    let rho_eff = max(0.35, c_mid.x + 0.28);
    acc_press = -grad_p / rho_eff;

    let r_pos = max(0.18, length(self_pm.xyz));
    let v_rad = dot(self_vs.xyz, self_pm.xyz) / r_pos;
    // Signed radial compression/expansion rate (-div v proxy: heats on infall, cools on expansion!)
    infall_compress = clamp(-v_rad / (r_pos + 0.45), -1.8, 2.2);
  } else {
    let r_pos = max(0.5, length(self_pm.xyz));
    let v_rad = dot(self_vs.xyz, self_pm.xyz) / r_pos;
    infall_compress = clamp(-v_rad / (r_pos + 1.5), -1.2, 1.5);
  }

  // 3. Universal Jeans sub-grid physical density scaling directly from measured local_rho_sim & |Phi_i|
  //    Higher total mass -> naturally higher local_rho_sim & deeper |Phi_i| (ZERO preset flags!).
  let prev_logT = clamp(p.thermo.x, 1.0, 9.6);
  let prev_logRho = clamp(p.thermo.y, -18.0, 10.8);
  let rho_ratio = max(1e-3, local_rho_sim / max(1e-4, params.ref_rho_sim));
  let log10_rho_ratio = log2(rho_ratio) * 0.30103;
  // Virial hydrostatic overburden weight from actual measured potential depth |Phi_i|
  let phi_overburden = clamp(log2(max(1.0, grav_phi / 18.0)) * 0.30103 * 2.55, 0.0, 4.8);
  let target_logRho = clamp(
    params.base_log_rho + 6.55 * log10_rho_ratio + phi_overburden,
    -17.8,
    10.6
  );
  let logRho = mix(prev_logRho, target_logRho, min(1.0, params.dt * 3.0));
  let dlogRho_signed = clamp((logRho - prev_logRho) / max(1e-4, params.dt), -4.0, 6.0);

  // 4. Query pluggable 2D (log10 rho, log10 T) EOS & opacity closure table!
  let cell_eos = sample_eos_table(logRho, prev_logT);
  let mu_gas = max(0.45, cell_eos.eos0.x);
  let gamma_eff = clamp(cell_eos.eos0.y, 1.05, 2.75);
  let fMol = clamp(cell_eos.eos0.z, 0.0, 1.0);
  let xIon = clamp(cell_eos.eos0.w, 0.0, 1.0);
  let pDeg_frac = clamp(cell_eos.eos1.x, 0.0, 1.0);
  let log10_kappa = cell_eos.eos1.y;
  let pNuc_frac = clamp(cell_eos.eos1.z, 0.0, 1.0);
  let pRad_frac = clamp(cell_eos.eos1.w, 0.0, 1.0);

  // 5. General Gamow-window thermonuclear reaction network (pp-chain, CNO, triple-alpha, Fe photodisintegration)
  var xH = clamp(p.thermo.z, 0.0, 1.0);
  var xHe = clamp(p.state.z, 0.0, 1.0);
  var xZ = clamp(p.state.w, 0.0, 1.0);

  let tempK = pow(10.0, prev_logT);
  let rho_cgs = pow(10.0, clamp(logRho - 3.0, -21.0, 8.5));
  let t6 = tempK * 1e-6;
  let t8 = tempK * 1e-8;
  let t9 = tempK * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.8 && xH > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 80.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 7.0 && xH > 1e-5 && xZ > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.45 && xHe > 1e-5) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 80.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  // Endothermic Fe-peak photodisintegration sink (Fe-56 + gamma -> 13 alpha + 4n)
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  let eps_exo = eps_pp + eps_cno + eps_3a;
  let log10_eps = log2(eps_exo + 1e-30) * 0.30103;

  // 6. Exact nucleon-conserving nuclear transmutation (X_H -> X_He -> X_Z, sum == 1.0)
  let dt_burn = params.dt * params.burn_timescale_s * params.time_accel;
  if (eps_exo > 1e-7 && dt_burn > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_burn) / 6.27e14);
    let dY = min(xHe + dX, (eps_3a * dt_burn) / 5.81e13);
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY);
    xZ = max(0.0, xZ + dY);
    let x_sum = max(1e-6, xH + xHe + xZ);
    xH = xH / x_sum;
    xHe = xHe / x_sum;
    xZ = xZ / x_sum;
  }

  // 7. General thermodynamic energy evolution:
  //    Signed PdV compressional heating/expansion cooling + Virial Kelvin-Helmholtz relaxation
  //    + exothermic fusion - endothermic Fe photodisintegration - Rosseland radiative cooling!
  let gamma_minus_1 = max(0.06, min(0.75, gamma_eff - 1.0));
  let pdv_heat = gamma_minus_1 * (dlogRho_signed * 0.72 + infall_compress * 0.22);

  // Virial equilibrium temperature from actual local gravitational potential |Phi_i| & mean molecular weight mu:
  //   - Diffuse cold cloud (|Phi| ~ 8): logT_vir ~ 1.5 (30 K)
  //   - 1 M_sun collapsed core (|Phi| ~ 50, mu=0.6): logT_vir ~ 7.18 (15 MK -> stable pp-chain!)
  //   - 18 M_sun collapsed core (|Phi| ~ 900, mu=0.6 -> 1.8): logT_vir ~ 7.6 -> 9.4 (CNO -> 3a -> Fe collapse!)
  let vir_arg = max(0.5, (grav_phi * mu_gas) / 14.0);
  let logT_virial = clamp(
    select(1.45, 6.25 + log2(vir_arg) * 0.30103 * 1.95, logRho > -8.0),
    1.35,
    9.42
  );
  let optical_depth_trap = clamp((logRho + log10_kappa + 6.5) / 7.5, 0.0, 1.0);
  // Relax optically thick core cleanly toward its own gravitational virial equilibrium (prevents unphysical 1 M_sun overshoot!)
  let kh_drive = optical_depth_trap * clamp((logT_virial - prev_logT) * 0.58, -0.85, 0.65);

  // Exothermic nuclear heating gently raises core T into hydrostatic balance (capped to physical thermostat!)
  let nuc_heat = select(0.0, clamp((log10_eps + 6.0) * 0.032, 0.0, 0.36), log10_eps > -6.0);
  // Endothermic photodisintegration drains thermal energy during Fe-core collapse!
  let endo_sink = select(0.0, clamp(log2(eps_photodis + 1.0) * 0.035, 0.0, 0.65), eps_photodis > 1.0);
  let rad_cool = (1.0 - optical_depth_trap * 0.86) * clamp((prev_logT - 1.42) * 0.38, 0.0, 1.15);

  let next_logT = clamp(
    prev_logT + (pdv_heat + kh_drive + nuc_heat - endo_sink - rad_cool) * params.dt * params.time_accel,
    1.15,
    9.50
  );

  // 8. General Hydrodynamic Equations of Motion:
  //    a_total = a_grav + a_press(EOS) + a_core_eos(thermal + radiation + degeneracy + nuclear-saturation bounce!)
  let collapse_soften = clamp((gamma_eff - 1.02) / 0.62, 0.20, 2.4);
  let r_vec = self_pm.xyz;
  let r_dist = max(0.18, length(r_vec));
  let r_dir = r_vec / r_dist;

  // Hydrostatic + nuclear-bounce radial pressure acceleration strictly from local EOS state!
  let t_sup = clamp((next_logT - 3.6) / 4.2, 0.0, 1.85);
  let p_therm_sup = (t_sup * t_sup * 4.2 / mu_gas) * collapse_soften;
  let p_rad_sup = pRad_frac * 14.0;
  let p_deg_sup = pDeg_frac * 22.0;
  let p_nuc_bounce = pNuc_frac * 460.0;
  let core_press_mag = select(
    0.0,
    p_therm_sup + p_rad_sup + p_deg_sup + p_nuc_bounce,
    inside_inner && r_dist < 2.2
  );
  let acc_core_eos = r_dir * (core_press_mag / (r_dist * r_dist + 0.16));
  let acc_total = acc_grav + acc_press * (1.25 * collapse_soften) + acc_core_eos;

  // Angular-momentum-conserving shock damping: damp ONLY radial infall oscillations,
  // preserving tangential orbital angular momentum (L = r x v) for binary orbits & disks!
  let v_rad_now = dot(self_vs.xyz, r_dir);
  let v_tan_now = self_vs.xyz - r_dir * v_rad_now;
  let rad_damp = select(0.992, 0.972, inside_inner && pNuc_frac < 0.05);
  var vel = (r_dir * (v_rad_now * rad_damp) + v_tan_now * 0.9994) + acc_total * params.dt;
  let spd = length(vel);
  let v_cap = 26.0;
  if (spd > v_cap) {
    vel = vel * (v_cap / spd);
  }
  var pos = self_pm.xyz + vel * params.dt;

  // Soft outer domain confinement for bound non-escaping gas
  let r_next = length(pos);
  if (r_next > params.box_half - 0.45 && spd < 10.0) {
    pos = pos * ((params.box_half - 0.45) / r_next);
    vel = vel * 0.72;
  }

  dst_particles[idx] = HydroParticle(
    vec4<f32>(pos, self_pm.w),
    vec4<f32>(vel, self_vs.w),
    vec4<f32>(next_logT, logRho, xH, log10_eps),
    vec4<f32>(fMol, xIon, xHe, xZ)
  );

  // 9. 64-byte atomic global diagnostic telemetry reduction (pure observer!)
  let logT_u = u32(clamp(next_logT * 1000.0, 0.0, 20000.0));
  let logRho_u = u32(clamp((logRho + 20.0) * 1000.0, 0.0, 40000.0));
  let logEps_u = u32(clamp((log10_eps + 30.0) * 1000.0, 0.0, 60000.0));
  atomicMax(&telemetry[0u], logT_u);
  atomicMax(&telemetry[1u], logRho_u);
  atomicMax(&telemetry[2u], logEps_u);
  if (log10_eps > -5.5) {
    atomicAdd(&telemetry[3u], 1u);
  }
  atomicAdd(&telemetry[4u], u32(clamp(fMol * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[5u], u32(clamp(xIon * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[6u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[7u], u32(clamp(xHe * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[8u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[9u], u32(clamp(pDeg_frac * 1000.0, 0.0, 1000.0)));
  if (logRho > -3.0 || r_dist < 1.6) {
    atomicAdd(&telemetry[10u], 1u);
    atomicAdd(&telemetry[11u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[12u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[15u], u32(clamp(gamma_eff * 1000.0, 0.0, 3000.0)));
  }
  let v_out = dot(vel, r_dir);
  if (v_out > 5.0 && r_dist > 0.6) {
    atomicAdd(&telemetry[13u], 1u);
  }
  if (pNuc_frac > 0.08) {
    atomicAdd(&telemetry[14u], 1u);
  }
}
`;function Q(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=Math.min(1,(e[11]||0)/(a*1e3)),_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=de({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=fe({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=5e8||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=me({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),ee=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),j=pe(ee);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:ee,photosphereSrgb:j,stage:A}}function be({cpuBodies:e,count:t,gravityG:n,baseLogRho:r,refRhoSim:i,burnTimescaleS:a,dt:o,timeAccel:s,totalMassSolar:c,hadNuclearBounce:l,anchors:u}){let d=new Float32Array(e.length),f=t>384?Math.ceil(t/384):1,p=1.2,m=r,h=-30,g=0,_=0,v=0,y=0,b=0,x=0,S=0,C=0,w=0,T=0,E=0,D=0,O=0;for(let l=0;l<t;l+=1){let k=l*16,A=e[k],ee=e[k+1],j=e[k+2],M=e[k+3],N=e[k+4],P=e[k+5],F=e[k+6],te=e[k+7],I=e[k+8],L=e[k+9],R=e[k+10],ne=e[k+14],re=e[k+15],ie=0,z=0,B=0,ae=0,V=M*4;for(let n=0;n<t;n+=f){let t=n*16,r=e[t+3]*f,i=e[t]-A,a=e[t+1]-ee,o=e[t+2]-j,s=i*i+a*a+o*o+.0625,c=1/Math.sqrt(s),l=r*c*c*c;ie+=i*l,z+=a*l,B+=o*l,ae+=r*c,s<2.2&&(V+=r*Math.exp(-s*.9))}ie*=n,z*=n,B*=n,ae*=n;let H=Math.max(.18,Math.hypot(A,ee,j)),U=A/H,W=ee/H,oe=j/H,se=N*U+P*W+F*oe,G=Math.max(-1.8,Math.min(2.2,-se/(H+.45))),ce=Math.max(.001,V/Math.max(1e-4,i)),K=Math.max(0,Math.min(4.8,Math.log10(Math.max(1,ae/18))*2.55)),q=L+(Math.max(-17.8,Math.min(10.6,r+6.55*Math.log10(ce)+K))-L)*Math.min(1,o*3),J=Math.max(-4,Math.min(6,(q-L)/Math.max(1e-4,o))),Y=de({rhoKgM3:10**q,temperatureK:10**I,xH:R,xHe:ne,xMetals:re,anchors:u}),X=fe({rhoKgM3:10**q,temperatureK:10**I,xH:R,xHe:ne,xMetals:re,dtS:o*a*s,coreMassSolar:c});R=X.nextMassFractions.xH,ne=X.nextMassFractions.xHe,re=X.nextMassFractions.xMetals;let Z=Math.log10(X.epsTotalWPerKg+1e-30),le=Math.log10(Math.max(1e-6,Y.kappaM2PerKg)),ue=Math.max(.06,Math.min(.75,Y.gammaEff-1))*(J*.72+G*.22),pe=Math.max(.5,ae*Y.mu/14),me=q>-8?Math.max(1.35,Math.min(9.42,6.25+Math.log10(pe)*1.95)):1.45,he=Math.max(0,Math.min(1,(q+le+6.5)/7.5)),ge=he*Math.max(-.85,Math.min(.65,(me-I)*.58)),_e=Z>-6?Math.min(.36,Math.max(0,(Z+6)*.032)):0,ve=X.epsPhotodisWPerKg>1?Math.min(.65,Math.log2(X.epsPhotodisWPerKg+1)*.035):0,ye=(1-he*.86)*Math.max(0,Math.min(1.15,(I-1.42)*.38)),Q=Math.max(1.15,Math.min(9.5,I+(ue+ge+_e-ve-ye)*o*s)),be=Math.max(.2,Math.min(2.4,(Y.gammaEff-1.02)/.62));if(H<2.2){let e=Math.max(0,Math.min(1.85,(Q-3.6)/4.2)),t=(e*e*4.2/Y.mu*be+Y.pRadFraction*14+Y.pDegFraction*22+Y.pNucFraction*460)/(H*H+.16);ie+=U*t,z+=W*t,B+=oe*t}let xe=H<3.2&&Y.pNucFraction<.05?.972:.992,Se=N-U*se,Ce=P-W*se,we=F-oe*se;N=se*xe*U+Se*.9994+ie*o,P=se*xe*W+Ce*.9994+z*o,F=se*xe*oe+we*.9994+B*o;let Te=Math.hypot(N,P,F);if(Te>26){let e=26/Te;N*=e,P*=e,F*=e}let Ee=A+N*o,De=ee+P*o,Oe=j+F*o,ke=Math.hypot(Ee,De,Oe);if(ke>13.55&&Te<10){let e=13.55/ke;Ee*=e,De*=e,Oe*=e,N*=.72,P*=.72,F*=.72}d[k+0]=Ee,d[k+1]=De,d[k+2]=Oe,d[k+3]=M,d[k+4]=N,d[k+5]=P,d[k+6]=F,d[k+7]=te,d[k+8]=Q,d[k+9]=q,d[k+10]=R,d[k+11]=Z,d[k+12]=Y.fH2,d[k+13]=Y.xIonized,d[k+14]=ne,d[k+15]=re,Q>p&&(p=Q),q>m&&(m=q),Z>h&&(h=Z),Z>-5.5&&(g+=1),_+=Y.fH2,v+=Y.xIonized,y+=R,b+=ne,x+=re,S+=Y.pDegFraction,(q>-3||H<1.6)&&(C+=1,w+=re,T+=R,E+=Y.gammaEff),N*U+P*W+F*oe>5&&H>.6&&(D+=1),Y.pNucFraction>.08&&(O+=1)}let k=new Uint32Array(16);k[0]=Math.round(p*1e3),k[1]=Math.round((m+20)*1e3),k[2]=Math.round((h+30)*1e3),k[3]=g,k[4]=Math.round(_*1e3),k[5]=Math.round(v*1e3),k[6]=Math.round(y*1e3),k[7]=Math.round(b*1e3),k[8]=Math.round(x*1e3),k[9]=Math.round(S*1e3),k[10]=C,k[11]=Math.round(w*1e3),k[12]=Math.round(T*1e3),k[13]=D,k[14]=O,k[15]=Math.round(E*1e3);let A=l||O>4&&10**p>=5e8;return{nextBodies:d,hadNuclearBounce:A,telemetry:Q(k,t,c,A)}}function xe({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,innerHalf:o=3.2,baseLogRho:s=-16.2,refRhoSim:c=.075,burnTimescaleS:l=42e13,label:u=`ulg-self-gravitating-hydro`}={}){let d=Float32Array.from(t),f=d.length/16,p=n||he({nRho:28,nTemp:40});function m(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let h=m(d),g=0,_=0,v=!1,y=!1,b=null,x=null,S=null,C=null,w=null,T=null,E=null,D=null,O=null,k=null,A=null,ee=null,j=0,F=!1,te=!1;function I(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<f;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/f*1e3),c[12]=Math.round(i/f*1e3),c[15]=1667,Q(c,f,h,!1)}let L=I(d);if(e&&typeof e.createBuffer==`function`){let t=Math.max(64,d.byteLength);b=[e.createBuffer({label:`${u}-p0`,size:t,usage:172}),e.createBuffer({label:`${u}-p1`,size:t,usage:172})],x=e.createBuffer({label:`${u}-outer-accum`,size:4096*16,usage:ve}),S=e.createBuffer({label:`${u}-outer-tree`,size:4160*16,usage:ve}),C=e.createBuffer({label:`${u}-inner-accum`,size:4096*16,usage:ve}),w=e.createBuffer({label:`${u}-inner-grid`,size:4096*16,usage:ve}),T=e.createBuffer({label:`${u}-eos-table`,size:p.data.byteLength,usage:136}),E=e.createBuffer({label:`${u}-telemetry`,size:64,usage:132}),D=e.createBuffer({label:`${u}-telemetry-staging`,size:64,usage:9}),O=e.createBuffer({label:`${u}-params`,size:80,usage:72}),k=e.createBuffer({label:`${u}-body-staging`,size:t,usage:9}),e.queue.writeBuffer(b[0],0,d),e.queue.writeBuffer(b[1],0,d),e.queue.writeBuffer(T,0,p.data);let n=[M(0,`read-only-storage`),M(1,`storage`),M(2,`storage`),M(3,`storage`),M(4,`storage`),M(5,`storage`),M(6,`read-only-storage`),M(7,`storage`),M(8,`uniform`)],r=t=>P(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v1`,label:`ulg-self-gravitating-hydro-${t}`,code:ye,entryPoint:t,bindings:n});A={clear:r(`sgh_clear`),deposit:r(`sgh_deposit`),finalize:r(`sgh_finalize`),reduce:r(`sgh_reduce_coarse`),integrate:r(`sgh_integrate`)};let i=(t,n,r)=>N(e,{layout:A.integrate.bindGroupLayout,label:`${u}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:x}},{binding:3,resource:{buffer:S}},{binding:4,resource:{buffer:C}},{binding:5,resource:{buffer:w}},{binding:6,resource:{buffer:T}},{binding:7,resource:{buffer:E}},{binding:8,resource:{buffer:O}}]});ee=[i(b[0],b[1],0),i(b[1],b[0],1)]}async function R(){if(!b||!k||te||y)return d;te=!0;try{let t=e.createCommandEncoder({label:`${u}-readback`});t.copyBufferToBuffer(b[j],0,k,0,d.byteLength),e.queue.submit([t.finish()]),await k.mapAsync(1),d.set(new Float32Array(k.getMappedRange())),k.unmap()}finally{te=!1}return d}async function ne({dt:t=.018,timeAccel:n=1,readTelemetry:m=!0}={}){if(y)return L;let x=Math.max(.25,Math.min(25,Number(n)||1)),S=Math.max(.004,Math.min(.028,Number(t)||.018));if(!b||!A){let e=be({cpuBodies:d,count:f,gravityG:r,baseLogRho:s,refRhoSim:c,burnTimescaleS:l,dt:S,timeAccel:x,totalMassSolar:h,hadNuclearBounce:v,anchors:p.anchors});return d=e.nextBodies,v=e.hadNuclearBounce,L=e.telemetry,g+=1,_+=S*x*.35,L}let C=new ArrayBuffer(80),w=new Uint32Array(C),T=new Float32Array(C);w[0]=f,w[1]=p.nRho,w[2]=p.nTemp,w[3]=0,T[4]=S,T[5]=r,T[6]=i*i,T[7]=a,T[8]=o,T[9]=.65*.65,T[10]=p.logRhoMin,T[11]=p.logRhoMax,T[12]=p.logTempMin,T[13]=p.logTempMax,T[14]=s,T[15]=c,T[16]=l,T[17]=x,e.queue.writeBuffer(O,0,C);let k=j,M=1-j,N=ee[k],P=Math.ceil(f/64),te=e.createCommandEncoder({label:`${u}-step-${g}`}),I=te.beginComputePass({label:`${u}-pass`});I.setPipeline(A.clear.pipeline),I.setBindGroup(0,N),I.dispatchWorkgroups(64),I.setPipeline(A.deposit.pipeline),I.setBindGroup(0,N),I.dispatchWorkgroups(P),I.setPipeline(A.finalize.pipeline),I.setBindGroup(0,N),I.dispatchWorkgroups(64),I.setPipeline(A.reduce.pipeline),I.setBindGroup(0,N),I.dispatchWorkgroups(1),I.setPipeline(A.integrate.pipeline),I.setBindGroup(0,N),I.dispatchWorkgroups(P),I.end();let R=m&&!F;if(R&&te.copyBufferToBuffer(E,0,D,0,64),e.queue.submit([te.finish()]),j=M,g+=1,_+=S*x*.35,R){F=!0;try{await D.mapAsync(1);let e=new Uint32Array(D.getMappedRange().slice(0));D.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=5e8&&(v=!0),L=Q(e,f,h,v)}finally{F=!1}}return L}function re(t){return d=Float32Array.from(t),h=m(d),g=0,_=0,v=!1,j=0,L=I(d),b&&e&&(e.queue.writeBuffer(b[0],0,d),e.queue.writeBuffer(b[1],0,d)),L}function ie(){y||(y=!0,b?.[0]?.destroy(),b?.[1]?.destroy(),x?.destroy(),S?.destroy(),C?.destroy(),w?.destroy(),T?.destroy(),E?.destroy(),D?.destroy(),O?.destroy(),k?.destroy(),b=null)}return{schema:_e,get count(){return f},get totalMassSolar(){return h},get stepIndex(){return g},get simTimeMyr(){return _},get backend(){return b?`webgpu`:`cpu-fallback`},get solverMode(){return b?`webgpu-self-gravitating-hydro-eos`:`cpu-self-gravitating-hydro-eos`},get closureTable(){return p},get anchors(){return p.anchors},getTelemetry:()=>L,getBodies:()=>d,getResidentBuffer:()=>b?b[j]:null,readbackBodies:R,step:ne,resetBodies:re,dispose:ie}}function Se({engine:e,zeroCopy:t=!0}){let n={tensorId:`hydro_particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`mass`,`vx`,`vy`,`vz`,`hSmooth`,`log10T`,`log10Rho`,`xH`,`log10EpsNuc`,`fMol`,`xIon`,`xHe`,`xZ`]};return{method:{model:`self-gravitating-hydro`,version:1},kernel:{sourceModule:`src/runtime/sph/selfGravitatingHydroGpu.js`,entryPoint:`sgh_integrate`,wgsl:ye,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:0,required:!0},timeAccel:{type:`number`,min:.1,required:!1},readTelemetry:{type:`boolean`,required:!1}},stateLayout:n,scaleRangeM:[1e-11,0x16345785d8a0000],async stepCapsule(r,{createSimulationArtifact:i,leaseSession:a}){let o=e.stepIndex,s=r.input?.parameters||{},c=await e.step(s),l=e.stepIndex;a.publishBuffer({resourceKey:`hydro_particles`,buffer:e.getResidentBuffer(),destroyFn:()=>!0,byteLength:e.count*64,rowCount:e.count,layout:n,stepIndex:l,portableSnapshotFn:async()=>Float32Array.from(await e.readbackBodies())});let u=a.borrowBufferReadLease({resourceKey:`hydro_particles`,consumerStage:`resident-gpu-presenter`,reason:t?`zero-copy-gpu-vertex-lease`:`cpu-instanced-render-lease`});return{artifact:i({artifactId:`${r.taskId}:self-gravitating-hydro:${l}`,taskKind:r.taskKind,closureRef:{module:`src/runtime/sph/selfGravitatingHydroGpu.js`,entryPoint:e.solverMode},representation:`self-gravitating-hydro-f32-64b`,outputs:{deltas:[{operation:`replace`,tensorId:`hydro_particles`,fromStep:o,toStep:l}],telemetry:c},execution:{backend:e.backend,stage:`self-gravitating-hydro.step`,placement:`local`,solverMode:e.solverMode,zeroCopyParticleReadbackBytes:t?0:e.count*64},validity:{finite:Number.isFinite(c.coreTempK)&&Number.isFinite(c.coreRhoKgM3),particleCount:e.count,nucleonSum:c.nucleonSum},validation:{status:`pass`,validationMode:`finite-output`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...r.provenance,sourceService:g.ulgRuntime,methodHash:r.methodHash,inputHash:r.inputHash}}),leaseHandle:u}}}}var Ce=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function we(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Te({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939}={}){let i=Ce[t]||Ce[`solar-nebula`],a=Math.max(256,Math.min(32768,Math.floor(e))),o=new Float32Array(a*16),s=we(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),c=()=>{let e=Math.max(1e-7,s()),t=s();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},l=i.totalMassSolar*100,u=l/a,d=Math.log10(i.initialTempK),f=i.initialLog10Rho,p=[];for(let e=0;e<8;e+=1)p.push({kx:(s()-.5)*.72,ky:(s()-.5)*.72,kz:(s()-.5)*.72,phase:s()*Math.PI*2,amp:.45+s()*.65});for(let e=0;e<a;e+=1){let t=e*16,r,m,h,g,_,v;if(i.geometry===`twin-lobe`){let t=e&1?1:-1,i=4.5,a=e%10==0;if(a){let e=(s()*2-1)*i;r=e,m=c()*.65,h=c()*.85+Math.sin(e*.55)*.75}else{let e=.18+s()**1.15*2.55,n=2*s()-1,a=Math.sqrt(Math.max(0,1-n*n)),o=s()*Math.PI*2;r=t*i+e*a*Math.cos(o),m=e*n*.62,h=e*a*Math.sin(o)}let o=Math.sqrt(n*l/(4*i))*1.04,u=r-t*i,d=h,f=Math.hypot(u,d)+.35,p=Math.sqrt(n*l*.22/(f+.6))*.42;g=(a?-h/(Math.hypot(r,h)+.5)*o*.7:-d/f*p)+c()*.1,_=c()*.08,v=(a?r/(Math.hypot(r,h)+.5)*o*.7:t*o+u/f*p)+c()*.1}else{let t=e>a*.72,o=s(),u=t?3.3+o**.8*(i.cloudRadius-3.3):.18+o**1.28*5,d=2*s()-1,f=Math.sqrt(Math.max(0,1-d*d)),y=s()*Math.PI*2,b=u*f*Math.cos(y),x=u*d*(t?.56:.78),S=u*f*Math.sin(y),C=0,w=0,T=0;for(let e of p){let t=Math.sin(e.kx*b+e.ky*x+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=b+C*.92,m=x+w*.62,h=S+T*.92;let E=Math.hypot(r,h)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*l*.38/(E+1.1))*i.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,m,h)+.4;g=-h/E*O+r/A*k+c()*.14,_=m/A*k*.8+c()*.1,v=r/E*O+h/A*k+c()*.14}let y=Math.hypot(r,m,h),b=Math.exp(-y*y/12),x=f+b*1,S=d+b*.1,C=.32+.04*Math.min(6,y);o[t+0]=r,o[t+1]=m,o[t+2]=h,o[t+3]=u,o[t+4]=g,o[t+5]=_,o[t+6]=v,o[t+7]=C,o[t+8]=S,o[t+9]=x,o[t+10]=.74,o[t+11]=-30,o[t+12]=.998,o[t+13]=0,o[t+14]=.25,o[t+15]=.01}return o}var Ee=Object.freeze([{id:`quantum-core`,log10:-10.8,label:`10⁻¹¹m Quantum H₂ / Gamow`},{id:`stellar-core`,log10:9.2,label:`10⁹m Stellar Core`},{id:`protoplanetary-disk`,log10:12.6,label:`10¹²m Disk & Envelope`},{id:`molecular-nebula`,log10:16.4,label:`10¹⁷m Molecular Nebula`}]),De=Object.freeze({"molecular-nebula":`#a78bfa`,"larson-core":`#fb923c`,"h2-dissociation":`#f97316`,"saha-protostar":`#fbbf24`,"fusion-ignition":`#fde047`,"main-sequence":`#fef08a`,"helium-burning":`#fb7185`,supernova:`#22d3ee`,"neutron-star":`#38bdf8`,"black-hole":`#c084fc`});function Oe(e){return!(e>0)||!Number.isFinite(e)?`—`:e<1e-9?`${(e*0xe8d4a51000).toFixed(1)} pm (${(e/O).toFixed(2)} a₀)`:e<1e-6?`${(e*1e9).toFixed(2)} nm`:e<1e3?`${e.toFixed(1)} m`:e<1e9?`${(e/1e3).toFixed(0)} km`:e<0xe8d4a51000?`${(e/6957e5).toFixed(1)} R☉`:e<0x38d7ea4c68000?`${(e/149597870700).toFixed(1)} AU`:`${(e/9460730472580800).toFixed(2)} ly`}function ke(e){return Number.isFinite(e)?e<1e4?`${Math.round(e).toLocaleString()} K`:e<1e6?`${(e/1e3).toFixed(1)}×10³ K`:e<1e9?`${(e/1e6).toFixed(2)} MK`:`${(e/1e9).toFixed(2)} GK`:`—`}function Ae(e,t=``){if(!Number.isFinite(e))return`—`;if(e===0)return`0${t?` `+t:``}`;let n=Math.floor(Math.log10(Math.abs(e)));return`${(e/10**n).toFixed(2)}×10^${n}${t?` `+t:``}`}function je(e){let t=Math.max(10,e?.coreTempK||25),n=t*8.617333262e-8,r=e?.gamowPeakKeV>0?e.gamowPeakKeV:1.22*Math.max(1e-4,t*1e-6)**(2/3);if(!(t>=12e5))return`<svg viewBox="0 0 286 84" style="width:100%;height:84px;display:block;background:rgba(4,10,20,0.82);border-radius:7px;border:1px solid rgba(148,163,184,0.22);">
      <line x1="12" y1="70" x2="274" y2="70" stroke="rgba(148,163,184,0.3)" stroke-width="1" />
      <path d="M 14 69 Q 65 26, 140 68 L 272 69" fill="rgba(251,191,36,0.16)" stroke="#fbbf24" stroke-width="1.3" />
      <path d="M 175 69 Q 230 60, 272 18" fill="none" stroke="#38bdf8" stroke-dasharray="3,2" stroke-width="1.3" />
      <text x="12" y="14" fill="#cbd5e1" font-size="9.5" font-family="monospace">Gamow Tunneling Window (p + p → ²H + e⁺ + ν)</text>
      <text x="12" y="27" fill="#94a3b8" font-size="8.8" font-family="monospace">${t<1200?`Molecular H₂ bound (T ≪ 10⁶ K · zero tunneling)`:t<8e3?`H₂ dissociating (CAS(2,2) D_e) · sub-fusion`:`Saha H⁺ plasma · compressing toward Gamow window`}</text>
      <text x="12" y="81" fill="#64748b" font-size="8" font-family="monospace">Thermal kT=${(n*1e3).toFixed(2)} eV · Barrier E_G=493 keV</text>
    </svg>`;let i=Math.max(18,Math.min(260,r*3.1)),a=[],o=[],s=[],c=1e-300;for(let e=1;e<=48;e+=1){let t=e/48*i,r=12+e/48*262,l=Math.exp(-Math.min(50,t/Math.max(.001,n))),u=Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,t)))),d=l*u;d>c&&(c=d),s.push({x:r,g:d}),a.push(`${r.toFixed(1)},${(70-Math.min(1,l)*52).toFixed(1)}`);let f=Math.min(1,u/Math.max(1e-20,Math.exp(-Math.sqrt(493/i))))**.35;o.push(`${r.toFixed(1)},${(70-f*50).toFixed(1)}`)}let l=s.map(e=>{let t=Math.max(0,Math.min(1,e.g/Math.max(1e-300,c)));return`${e.x.toFixed(1)},${(70-t*50).toFixed(1)}`}).join(` `),u=12+Math.min(1,r/i)*262;return`<svg viewBox="0 0 286 84" style="width:100%;height:84px;display:block;background:rgba(4,12,22,0.86);border-radius:7px;border:1px solid rgba(52,211,153,0.42);">
    <line x1="12" y1="70" x2="274" y2="70" stroke="rgba(148,163,184,0.28)" stroke-width="1" />
    <polyline fill="none" stroke="#fbbf24" stroke-width="1.2" opacity="0.72" points="${a.join(` `)}" />
    <polyline fill="none" stroke="#38bdf8" stroke-width="1.2" opacity="0.75" points="${o.join(` `)}" />
    <polygon fill="rgba(52,211,153,0.34)" stroke="#34d399" stroke-width="1.8" points="12,70 ${l} 274,70" />
    <line x1="${u.toFixed(1)}" y1="18" x2="${u.toFixed(1)}" y2="70" stroke="#fef08a" stroke-dasharray="2,2" stroke-width="1.1" />
    <text x="10" y="13" fill="#6ee7b7" font-size="9.5" font-family="monospace">ACTIVE GAMOW PEAK · E₀=${r.toFixed(1)} keV</text>
    <text x="10" y="81" fill="#94a3b8" font-size="8" font-family="monospace">kT=${n.toFixed(2)} keV · ε=${Ae(e.peakEpsNucWPerKg,`W/kg`)}</text>
  </svg>`}function Me(){let t=1100,i=new n(new e(.32,0),new S({color:16777215}),t);i.frustumCulled=!1;let a=new r,o=new x,s=88421,c=()=>(s=Math.imul(s,1664525)+1013904223>>>0,s/4294967296);for(let e=0;e<t;e+=1){let t=c()*2-1,n=c()*Math.PI*2,r=Math.sqrt(Math.max(0,1-t*t)),s=140+c()*110;a.position.set(s*r*Math.cos(n),s*t,s*r*Math.sin(n)),a.scale.setScalar(.35+c()*.85),a.updateMatrix(),i.setMatrixAt(e,a.matrix);let l=c();o.setRGB(l>.7?.96:.65,l>.3?.84:.72,1),i.setColorAt(e,o)}return i.instanceMatrix.needsUpdate=!0,i.instanceColor&&(i.instanceColor.needsUpdate=!0),i}function Ne(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);n.addColorStop(0,`rgba(255,255,255,1.0)`),n.addColorStop(.16,`rgba(255,248,236,0.85)`),n.addColorStop(.42,`rgba(255,215,155,0.34)`),n.addColorStop(.75,`rgba(130,185,255,0.08)`),n.addColorStop(1,`rgba(0,0,0,0.0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new u(e);return r.needsUpdate=!0,r}function Pe(e,n,r,i=.75){let a=new l(new t({map:e,color:n,transparent:!0,opacity:i,blending:2,depthWrite:!1}));return a.scale.set(r,r,1),a}async function Fe(e){let t=document.createElement(`div`);t.id=`ulg-stellar-genesis-root`,t.style.cssText=[`position:fixed`,`inset:0`,`background:#03060f`,`color:#e2f1ec`,`font-family:"Inter",system-ui,-apple-system,sans-serif`,`overflow:hidden`,`user-select:none`].join(`;`),e.innerHTML=``,e.appendChild(t);let n=document.createElement(`div`);n.style.cssText=`position:absolute;inset:0;`,t.appendChild(n);let r=new URLSearchParams(window.location.search),l=Ce[r.get(`preset`)]?r.get(`preset`):`solar-nebula`,u=r.get(`scale`),x=u!==null&&Number.isFinite(Number(u))?Number(u):16,T=x,E=Number(r.get(`speed`))||4;(!Number.isFinite(E)||E<.5||E>25)&&(E=4);let D=r.get(`paused`)!==`1`,O=null;try{let e=await navigator.gpu?.requestAdapter?.({powerPreference:`high-performance`});e&&(O=await e.requestDevice(),e.info?.description||e.info?.vendor)}catch{O=null}let A=null,M=`three-webgl`;if(O&&typeof _==`function`)try{let e=new _({antialias:!0,device:O});e.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.setSize(window.innerWidth,window.innerHeight),e.setClearColor(198159,1),e.toneMapping=4,e.toneMappingExposure=1.24,await e.init(),A=e,M=`three-webgpu`}catch{A=null}if(!A){let e=await k(()=>import(`./three.module-BCyWaJXC.js`).then(e=>e.r),[],import.meta.url);A=new e.WebGLRenderer({antialias:!0,powerPreference:`high-performance`}),A.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),A.setSize(window.innerWidth,window.innerHeight),A.setClearColor(198159,1),A.toneMapping=e.ACESFilmicToneMapping,A.toneMappingExposure=1.24,M=`three-webgl`}n.appendChild(A.domElement);let N=!!(O&&A.isWebGPURenderer),P=O?8192:2048,F=await ge({closureRegistry:new j({artifactCache:new ee})}),ie=Te({count:P,preset:l,seed:1939}),z=xe({device:O,initialBodies:ie,eosClosureTable:F.table,label:`ulg-stellar-genesis-sgh`}),B=re();B.registerModule(Se({engine:z,zeroCopy:N}));let ae=I({moduleRegistry:B}),V=new c,H=new o(48,window.innerWidth/window.innerHeight,.01,600),U=.55,W=.34,oe=new h(9156313,.72),se=new y(16774364,1.7);se.position.set(16,20,14),V.add(oe,se),V.add(Me());let G=Ne(),ce=new a;V.add(ce);let K=te({THREE:b,TSL:L,renderer:A,bodyCount:z.count,strideFloats:16,palette:`blackbody-thermo`,initialBuffer:z.getResidentBuffer()});ce.add(K.mesh),K.zeroCopy||K.syncFromCpuBodies(z.getBodies());let q=Pe(G,16766346,1.2,.05),J=Pe(G,3718648,2,.02),Y=Pe(G,16766346,1,0),X=Pe(G,9684477,1,0);ce.add(q,J,Y,X);let Z=new a;Z.visible=!1;let le=new f(new s(.56,36,26),new S({color:0})),ue=new f(new v(.76,.07,18,72),new S({color:16707722,transparent:!0,opacity:.96}));ue.rotation.x=Math.PI*.43;let de=new f(new C(.88,2.75,72),new S({color:3718648,side:2,transparent:!0,opacity:.52,blending:2,depthWrite:!1}));de.rotation.x=Math.PI*.43;let fe=Pe(G,2282478,6,.22),pe=new f(new v(1,.018,12,96),new S({color:6809849,transparent:!0,opacity:.48,blending:2,depthWrite:!1}));pe.rotation.x=Math.PI*.42;let me=new f(new v(1,.014,12,96),new S({color:12616956,transparent:!0,opacity:.36,blending:2,depthWrite:!1}));me.rotation.x=Math.PI*.22,me.rotation.y=Math.PI*.28;let he=new d(.16,6.4,16,1,!0),_e=new S({color:10980346,transparent:!0,opacity:.42,side:2,blending:2,depthWrite:!1}),ve=new f(he,_e);ve.position.y=3.5,ve.rotation.x=Math.PI;let ye=new f(he,_e);ye.position.y=-3.5,Z.add(le,ue,de,fe,pe,me,ve,ye),ce.add(Z);let Q=new a;Q.visible=!1,V.add(Q);let be=ne(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:360,cloudGridDim:16,maxGridDim:24}).artifact,we=R({THREE:b,TSL:L,renderer:A,radialSamples:be.radialProfile.samples||[],rMaxBohr:be.radialProfile.rMaxBohr||8,r95Bohr:be.summary.containmentRadii.r95Bohr||3.2,modeId:`total-density`,boxHalfExtent:4.8,dim:40});Q.add(we.mesh);let Fe=new m({color:16007006,emissive:14753096,emissiveIntensity:.65,roughness:.22}),Ie=new f(new s(.32,24,18),Fe),Le=new f(new s(.32,24,18),Fe);Ie.add(Pe(G,16478597,1.9,.85)),Le.add(Pe(G,3718648,1.9,.85));let Re=new S({color:6220500,transparent:!0,opacity:.72}),ze=new f(new i(.14,.14,2.2,16),Re);ze.rotation.z=Math.PI/2;let Be=new S({color:3462041,wireframe:!0,transparent:!0,opacity:0}),Ve=new f(new s(1.55,24,16),Be),He=Pe(G,16707722,3.8,0);Q.add(Ie,Le,ze,Ve,He);let $=document.createElement(`div`);$.style.cssText=`position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;pointer-events:none;z-index:10;`,$.innerHTML=`
    <div style="pointer-events:auto;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:rgba(5,11,22,0.86);border:1px solid rgba(56,189,248,0.30);backdrop-filter:blur(10px);">
      <span id="sg-stage-dot" style="width:10px;height:10px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa;"></span>
      <div>
        <div id="sg-stage-title" style="font-size:13px;font-weight:700;letter-spacing:0.01em;color:#f8fafc;">Cold Molecular H₂ Nebula</div>
        <div id="sg-scale-readout" style="font-size:11px;font-family:monospace;color:#7dd3fc;">10^16.0 m · self-gravitating-hydro@1</div>
      </div>
    </div>
    <div style="pointer-events:auto;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
      ${Object.values(Ce).map(e=>`<button type="button" data-sg-preset="${e.id}" style="padding:7px 11px;border-radius:8px;border:1px solid ${e.id===l?`#38bdf8`:`rgba(148,163,184,0.3)`};background:${e.id===l?`rgba(14,116,144,0.45)`:`rgba(10,18,32,0.86)`};color:#f0f9ff;font-size:12px;font-weight:600;cursor:pointer;">${e.shortLabel}</button>`).join(``)}
      <button id="sg-speed-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(6,40,36,0.84);color:#6ee7b7;font-size:12px;font-weight:600;font-family:monospace;cursor:pointer;">${E}×</button>
      <button id="sg-play-btn" type="button" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;">${D?`⏸ Pause`:`▶ Play`}</button>
      <button id="sg-reset-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;">↺ Reset</button>
      <a href="./cosmic-quantum.html" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(94,234,212,0.4);background:rgba(14,42,46,0.85);color:#99f6e4;font-size:12px;font-weight:600;text-decoration:none;">Cosmic ↔ Quantum ↗</a>
      <a href="./" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:rgba(38,24,10,0.85);color:#fde68a;font-size:12px;font-weight:600;text-decoration:none;">SPH Lab ↗</a>
    </div>
  `,t.appendChild($);let Ue=document.createElement(`aside`);Ue.id=`sg-inspector`,Ue.style.cssText=`position:absolute;top:72px;right:16px;width:336px;max-height:calc(100vh - 176px);overflow-x:hidden;overflow-y:auto;word-break:break-word;padding:13px 14px;border-radius:12px;background:rgba(5,11,22,0.86);border:1px solid rgba(148,186,210,0.24);backdrop-filter:blur(12px);font-size:12px;line-height:1.45;z-index:10;display:flex;flex-direction:column;gap:9px;`,t.appendChild(Ue);let We=document.createElement(`div`);We.style.cssText=`position:absolute;left:16px;right:16px;bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(5,11,22,0.88);border:1px solid rgba(56,189,248,0.24);backdrop-filter:blur(10px);z-index:10;display:flex;flex-direction:column;gap:8px;`,We.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m (H₂ / Gamow)</span>
      <input id="sg-zoom-slider" type="range" min="-11.0" max="16.8" step="0.05" value="${T}" style="flex:1;accent-color:#38bdf8;cursor:pointer;" />
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10¹⁷ m (Nebula)</span>
    </div>
    <div id="sg-zoom-pills" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;"></div>
  `,t.appendChild(We);let Ge=We.querySelector(`#sg-zoom-pills`),Ke=new Map;for(let e of Ee){let t=document.createElement(`button`);t.type=`button`,t.dataset.sgZoom=e.id,t.textContent=e.label,t.style.cssText=`flex:1;min-width:130px;padding:5px 8px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(10,20,34,0.78);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;`,t.addEventListener(`click`,()=>{x=e.log10}),Ge.appendChild(t),Ke.set(e.id,t)}let qe=$.querySelector(`#sg-stage-dot`),Je=$.querySelector(`#sg-stage-title`),Ye=$.querySelector(`#sg-scale-readout`),Xe=$.querySelector(`#sg-speed-btn`),Ze=$.querySelector(`#sg-play-btn`),Qe=$.querySelector(`#sg-reset-btn`),$e=We.querySelector(`#sg-zoom-slider`),et=1;function tt(){for(let e of $.querySelectorAll(`[data-sg-preset]`)){let t=e.dataset.sgPreset===l;e.style.borderColor=t?`#38bdf8`:`rgba(148,163,184,0.3)`,e.style.background=t?`rgba(14,116,144,0.45)`:`rgba(10,18,32,0.86)`}}function nt(e){if(!Ce[e])return;l=e;let t=Te({count:z.count,preset:l,seed:1939});z.resetBodies(t),et=1,K.zeroCopy?K.bindResidentBuffer(z.getResidentBuffer()):K.syncFromCpuBodies(z.getBodies()),tt(),st()}for(let e of $.querySelectorAll(`[data-sg-preset]`))e.addEventListener(`click`,()=>nt(e.dataset.sgPreset));let rt=[1,4,12];Xe.addEventListener(`click`,()=>{E=rt[(rt.findIndex(e=>Math.abs(e-E)<.25)+1)%rt.length],Xe.textContent=`${E}×`}),Ze.addEventListener(`click`,()=>{D=!D,Ze.textContent=D?`⏸ Pause`:`▶ Play`}),Qe.addEventListener(`click`,()=>nt(l)),$e.addEventListener(`input`,()=>{x=Number($e.value)});let it=!1,at=0,ot=0;A.domElement.addEventListener(`pointerdown`,e=>{it=!0,at=e.clientX,ot=e.clientY}),window.addEventListener(`pointerup`,()=>{it=!1}),window.addEventListener(`pointermove`,e=>{it&&(U-=(e.clientX-at)*.006,W=Math.max(-1.25,Math.min(1.25,W+(e.clientY-ot)*.006)),at=e.clientX,ot=e.clientY)}),A.domElement.addEventListener(`wheel`,e=>{e.preventDefault(),x=Math.max(-11,Math.min(16.8,x+e.deltaY*.004))},{passive:!1});function st(){let e=z.getTelemetry(),t=z.anchors,n=Ce[l],r=ae.evaluateContinuousZoomCamera(T),i=K.getStats(),a=De[e.stage.id]||`#38bdf8`;qe.style.background=a,qe.style.boxShadow=`0 0 12px ${a}`,Je.textContent=e.stage.label,Ye.textContent=`10^${T.toFixed(1)} m (${Oe(10**T)}) · Chart L=${r.primaryRegime.globalBaseLevel} · ${z.totalMassSolar.toFixed(1)} M☉`;let o=Math.max(0,Math.min(100,e.coreXH*100)),s=Math.max(0,Math.min(100-o,e.coreXZ*100)),c=Math.max(0,100-o-s),u=e.coreGammaEff<4/3,d=e.supernovaTriggered?`<div style="padding:6px 8px;border-radius:6px;background:rgba(192,132,252,0.16);border:1px solid rgba(192,132,252,0.45);font-family:monospace;font-size:11px;color:#e9d5ff;">
          <b>REMNANT:</b> ${e.remnantClass===`black-hole`?`Stellar Black Hole`:`Neutron Star`} · r_s=${(e.schwarzschildRadiusM/1e3).toFixed(1)} km · Bounce pts=${e.nuclearBounceCount}
        </div>`:``;Ue.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;letter-spacing:0.04em;font-size:11px;text-transform:uppercase;color:#94a3b8;">General ULG Runtime Laws</span>
        <span style="padding:2px 6px;border-radius:4px;background:rgba(56,189,248,0.16);color:#7dd3fc;font-family:monospace;font-size:10px;">${z.count.toLocaleString()} pts</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.4;">${n.description}</div>
      ${d}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:11px;color:#cbd5e1;line-height:1.55;">
        <div style="color:#5eead4;font-weight:700;margin-bottom:2px;">Live Emergent Core State</div>
        Core T: <span style="color:${a};font-weight:700;">${ke(e.coreTempK)}</span> · ρ: ${Ae(e.coreRhoKgM3,`kg/m³`)}<br/>
        γ_eff: <span style="color:${u?`#fb923c`:`#6ee7b7`};font-weight:700;">${e.coreGammaEff.toFixed(2)}${u?` (<4/3 COLLAPSE)`:``}</span> · μ=${e.coreMu.toFixed(2)}<br/>
        Core H₂: ${(e.coreFH2*100).toFixed(1)}% · Ionized H⁺: ${(e.coreXIonized*100).toFixed(1)}%<br/>
        Fusing pts: <span style="color:#fde047;">${e.fusingCount.toLocaleString()}</span> · P_deg/P: ${(e.corePDegFraction*100).toFixed(1)}%
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:3px;">
          <span>Core Nucleons (Σ=${e.nucleonSum.toFixed(4)})</span>
          <span>H ${o.toFixed(0)}% · He ${c.toFixed(0)}% · Z ${s.toFixed(0)}%</span>
        </div>
        <div style="height:8px;border-radius:4px;overflow:hidden;display:flex;background:#0f172a;border:1px solid rgba(148,163,184,0.25);">
          <div style="width:${o.toFixed(1)}%;background:#38bdf8;"></div>
          <div style="width:${c.toFixed(1)}%;background:#fbbf24;"></div>
          <div style="width:${s.toFixed(1)}%;background:#c084fc;"></div>
        </div>
      </div>
      ${je(e)}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:10.5px;color:#94a3b8;line-height:1.5;">
        <div style="color:#a5b4fc;font-weight:700;margin-bottom:2px;">Composed ULG Subsystems</div>
        Module: <span style="color:#7dd3fc;">self-gravitating-hydro@1</span> (preset-free)<br/>
        ClosureRegistry: <span style="color:#6ee7b7;">${F.artifact.closureId}</span><br/>
        Anchors: KS-PBE I_H=${t.hIonizationEv.toFixed(2)} eV · CAS(2,2) D_e=${t.h2DissociationEv.toFixed(2)} eV<br/>
        Presenter: ${i.zeroCopy?`zero-copy GPU (0 B/frame)`:`cpu-instanced`} · ${M}<br/>
        Governance: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
    `}function ct(e,t){let n=Math.max(0,Math.min(1,(-3-T)/5.5));if(ce.visible=n<.96,Q.visible=n>.04,ce.visible){let e=6.2+Math.max(0,Math.min(1,(T-8.5)/8.3))*16.5;H.position.set(Math.cos(W)*Math.sin(U)*e,Math.sin(W)*e,Math.cos(W)*Math.cos(U)*e),H.lookAt(0,0,0)}else{let e=11.2;H.position.set(Math.cos(W)*Math.sin(U)*e,Math.sin(W)*e,Math.cos(W)*Math.cos(U)*e),H.lookAt(0,0,0)}let[r,i,a]=e.photosphereSrgb,o=Math.max(0,Math.min(1,(e.coreLogT-2.4)/4.8)),s=e.fusingCount>8?Math.min(1,Math.log10(1+e.fusingCount)/3):0,c=l===`binary-nursery`;if(e.supernovaTriggered)q.visible=!1,J.visible=!0,J.material.color.setRGB(.25,.85,1),J.material.opacity=.65,J.scale.setScalar(4.8+Math.sin(t*4)*.25),Z.visible=!0,le.visible=e.remnantClass===`black-hole`,ue.rotation.z=t*1.4,de.rotation.z=-t*1.9,et=Math.min(11.5,et+(D?.045:0)),fe.scale.setScalar(et*2.1),fe.material.opacity=Math.max(.06,.28*(1-et/16)),pe.scale.setScalar(et*.94),pe.rotation.z=t*.35,pe.material.opacity=Math.max(.12,.52*(1-et/16)),me.scale.setScalar(et*.78),me.rotation.z=-t*.28,me.material.opacity=Math.max(.08,.38*(1-et/16)),Y.visible=!1,X.visible=!1;else if(c){Z.visible=!1,q.visible=!1,J.visible=!1;let e=t*.42,n=2.4*Math.max(.55,1-o*.35);Y.visible=o>.12,X.visible=o>.12,Y.position.set(Math.cos(e)*n,0,Math.sin(e)*n),X.position.set(-Math.cos(e)*n,0,-Math.sin(e)*n);let c=1.4+o*3.4+s*2.2;Y.scale.setScalar(c),X.scale.setScalar(c*.92),Y.material.color.setRGB(r,i,a),X.material.color.setRGB(Math.min(1,r*.85+.15),Math.min(1,i*.92+.08),Math.min(1,a*1.1)),Y.material.opacity=Math.min(.92,o*.65+s*.4),X.material.opacity=Math.min(.92,o*.62+s*.38)}else Z.visible=!1,Y.visible=!1,X.visible=!1,q.visible=o>.08,J.visible=o>.25,q.material.color.setRGB(r,i,a),q.material.opacity=Math.min(.95,.05+o*.62+s*.36),q.scale.setScalar(1.3+o*3.2+s*3.8),J.material.color.setRGB(r*.8+.2,i*.85+.1,Math.min(1,a+.25)),J.material.opacity=Math.min(.55,o*.25+s*.35),J.scale.setScalar(3.4+o*4.5+s*4.8);if(Q.visible){let n=e.coreFH2;if(e.peakEpsNucWPerKg>1e-6){let e=t*1.85%1,n=e<.72?2.6*(1-e/.72)+.22:.22+(e-.72)/.28*2.4;Ie.position.set(-n,0,0),Le.position.set(n,0,0),ze.visible=!1,Be.opacity=.28,Ve.rotation.y=t*.5;let r=e>.62&&e<.82?Math.sin((e-.62)/.2*Math.PI):0;He.material.opacity=r*.95,He.scale.setScalar(2.4+r*4.2),we.mesh.scale.setScalar(.55)}else if(n>.15){let e=Math.sin(t*4.2)*.12*(1.2-n),r=1.12+(1-n)*1.2+e;Ie.position.set(-r,0,0),Le.position.set(r,0,0),ze.visible=!0,ze.scale.set(1,r/1.1,1),Re.opacity=Math.max(.08,n*.75),Be.opacity=0,He.material.opacity=0,we.mesh.scale.setScalar(1)}else{let e=1.8+Math.sin(t*2.1)*.45;Ie.position.set(-e,Math.cos(t*1.7)*.4,0),Le.position.set(e,-Math.cos(t*1.7)*.4,0),ze.visible=!1,Be.opacity=.14,He.material.opacity=0,we.mesh.scale.setScalar(.85)}Q.rotation.y=t*.24}let u=Ee[0],d=1/0;for(let e of Ee){let t=Math.abs(e.log10-T);t<d&&(d=t,u=e)}for(let[e,t]of Ke.entries()){let n=e===u.id;t.style.borderColor=n?`#38bdf8`:`rgba(148,163,184,0.25)`,t.style.background=n?`rgba(14,116,144,0.42)`:`rgba(10,20,34,0.78)`,t.style.color=n?`#f0f9ff`:`#cbd5e1`}$e.value=String(T.toFixed(2))}let lt=!1;async function ut(e=null){if(!(lt||ft)){lt=!0;try{let t=w({taskId:`sgh-${l}-${z.stepIndex}`,serviceId:g.ulgRuntime,taskKind:p.simulationStep,method:{model:`self-gravitating-hydro`,version:1},input:{stepIndex:z.stepIndex,parameters:{dt:.018,timeAccel:e??E,readTelemetry:z.stepIndex%4==0||e!==null}}}),n=await B.dispatchSimulationStepCapsule(t,{device:O});K.zeroCopy?K.bindLeaseHandle(n.leaseHandle):K.syncFromCpuBodies(z.getBodies()),n.leaseHandle?.release?.()}finally{lt=!1}}}let dt=0,ft=!1,pt=0,mt=performance.now();function ht(){H.aspect=window.innerWidth/window.innerHeight,H.updateProjectionMatrix(),A.setSize(window.innerWidth,window.innerHeight)}window.addEventListener(`resize`,ht),st();function gt(e){if(ft)return;dt=requestAnimationFrame(gt);let t=(e-mt)*.001;T+=(x-T)*.14,it||(U+=.0018),D&&!lt&&ut(),ct(z.getTelemetry(),t),pt%10==0&&st(),pt+=1,A.render(V,H)}dt=requestAnimationFrame(gt);let _t={getState(){return{presetId:l,moduleModel:`self-gravitating-hydro@1`,closureId:F.artifact.closureId,backend:z.backend,rendererBackend:M,zeroCopy:K.zeroCopy,readbackBytesPerFrame:K.readbackBytesPerFrame,particleCount:z.count,totalMassSolar:z.totalMassSolar,stepIndex:z.stepIndex,simTimeMyr:z.simTimeMyr,log10SpanM:T,timeScale:E,simRunning:D,telemetry:z.getTelemetry(),anchors:z.anchors,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}},selectPreset(e){return nt(e),_t.getState()},setLog10Span(e){return x=Math.max(-11,Math.min(16.8,Number(e))),T=x,ct(z.getTelemetry(),(performance.now()-mt)*.001),st(),_t.getState()},setTimeScale(e){return E=Math.max(.5,Math.min(25,Number(e)||4)),Xe.textContent=`${E}×`,E},setPlaying(e){return D=!!e,Ze.textContent=D?`⏸ Pause`:`▶ Play`,D},async stepMany(e=40,t=6){let n=D;for(D=!1;lt;)await new Promise(e=>setTimeout(e,8));for(let n=0;n<e;n+=1)await ut(t);D=n;let r=z.getTelemetry();return r.supernovaTriggered&&(et=Math.max(et,5.2)),ct(r,(performance.now()-mt)*.001),st(),A.render(V,H),_t.getState()},reset(){return nt(l),_t.getState()},dispose(){ft||(ft=!0,cancelAnimationFrame(dt),window.removeEventListener(`resize`,ht),K.dispose(),we.dispose(),z.dispose(),G.dispose(),A.dispose?.())}};return globalThis.__ulgStellarGenesisDemo=_t,_t}Fe(document.getElementById(`stellar-genesis-app`)||document.body);