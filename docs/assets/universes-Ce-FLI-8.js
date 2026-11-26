import{Et as e,O as t,_ as n,_t as r,a as i,b as a,gt as o,h as s,k as c,r as l,u,wt as d,xt as f}from"./molecularDynamicsWebGpu-0B_SAXrs.js";import{C as p,T as m,_ as h,w as g,x as _}from"./batchedSymmetricEigensolverGpu-DvdPNMKk.js";import{t as v}from"./ClosureRegistry-M0viNlhZ.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-it7y5O2_.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as C,createCachedExplicitBindGroup as w,createCachedExplicitComputePipeline as T}from"../runtime/webgpuComputeLayout.js";import{t as E}from"./radiationClosure-CLl7QZ6e.js";import{d as D,l as O,m as k,n as A,p as j,t as M}from"./simulationModuleRegistry-C5Gdj6G_.js";import{t as N}from"./fft3dWebGpu-U-dm_fNS.js";import{C as ee,D as P,E as F,O as I,S as L,T as te,_ as R,b as ne,g as z,h as re,i as ie,k as ae,m as oe,n as se,r as ce,t as le,v as ue,w as de,x as fe,y as pe}from"./gpuEntityPickerWebGpu-B3LIdtEA.js";import{r as me}from"./schroederSpatialScaleAtlasRuntime-BEEQ_kpz.js";var B=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,he=149597870700,ge=30034896e-13,_e=4*Math.PI*Math.PI,V=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),ve=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:0,surfacePressurePa:0,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,surfacePressurePa:92e5,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:ge,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,surfacePressurePa:101325,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,surfacePressurePa:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,surfacePressurePa:610,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,surfacePressurePa:1e5,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:0,surfacePressurePa:0,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:0,surfacePressurePa:0,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:0,surfacePressurePa:0,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,surfacePressurePa:1e5,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,surfacePressurePa:146700,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ice Giant · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,surfacePressurePa:1e5,tempK:59,centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · H₂/He Atm`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,surfacePressurePa:1e5,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Eccentric Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`}]);function ye(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function be(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function xe({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=be((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=S*C+x*w*T,k=w*E,A=-x*w-S*C*T,j=-S*w+x*C*T,M=C*E;return{pos:[D*g+A*_,k*g+M*_,O*g+j*_],vel:[D*y+A*b,k*y+M*b,O*y+j*b]}}function Se(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Ce(e,{asteroidCount:t=512,beltZoneAu:n=null,seed:r=20261125,starMassScale:i=1,centerOffsetAu:a=[0,0,0]}={}){let o=Array.isArray(e)&&e.length>0?e:ve,s=o.length,c=Math.max(0,Math.min(4096,Math.trunc(Number(t)||0))),l=s+c,u=Array.from({length:l},()=>[0,0,0]),d=Array.from({length:l},()=>[0,0,0]),f=new Float64Array(l),p=new Float64Array(l),m=new Float32Array(l),h=Math.max(.1,Number(i)||1),g=0;for(let e=0;e<s;e+=1){let t=o[e],n=!!t.isStar||e===0;n&&(g+=1),f[e]=n?t.massSolar*h:t.massSolar,p[e]=t.radiusKm*1e3/he,m[e]=t.kind}let _=[0,0,0],v=[0,0,0],y=f[0];if(g>=2&&o[1]?.orbitRole===`binary-companion`){let e=f[0],t=f[1];y=e+t;let n=xe(o[1],_e*y),r=-t/Math.max(1e-12,y),i=e/Math.max(1e-12,y);u[0]=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],d[0]=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r],u[1]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[1]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}if(g>=3&&o[2]?.orbitRole===`trinary-outer`){let e=f[2],t=y+e,n=xe(o[2],_e*t),r=-e/Math.max(1e-12,t),i=y/Math.max(1e-12,t);_=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],v=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r];for(let e=0;e<2;e+=1)u[e]=[u[e][0]+_[0],u[e][1]+_[1],u[e][2]+_[2]],d[e]=[d[e][0]+v[0],d[e][1]+v[1],d[e][2]+v[2]];u[2]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[2]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}for(let e=g;e<s;e+=1){let t=o[e],n=f[e];if(t.parent===-2){let r=xe(t,_e*(y+n));u[e]=[_[0]+r.pos[0],_[1]+r.pos[1],_[2]+r.pos[2]],d[e]=[v[0]+r.vel[0],v[1]+r.vel[1],v[2]+r.vel[2]]}else if(t.parent>=0&&t.parent<e){let r=t.parent,i=xe(t,_e*(f[r]+n));u[e]=[u[r][0]+i.pos[0],u[r][1]+i.pos[1],u[r][2]+i.pos[2]],d[e]=[d[r][0]+i.vel[0],d[r][1]+i.vel[1],d[r][2]+i.vel[2]]}}let b=0,x=0,S=0,C=0,w=0,T=0,E=0;for(let e=0;e<s;e+=1){let t=f[e];b+=t,x+=t*u[e][0],S+=t*u[e][1],C+=t*u[e][2],w+=t*d[e][0],T+=t*d[e][1],E+=t*d[e][2]}x/=Math.max(1e-12,b),S/=Math.max(1e-12,b),C/=Math.max(1e-12,b);let D=w/Math.max(1e-12,b),O=T/Math.max(1e-12,b),k=E/Math.max(1e-12,b);for(let e=0;e<s;e+=1)u[e][0]-=x,u[e][1]-=S,u[e][2]-=C,d[e][0]-=D,d[e][1]-=O,d[e][2]-=k;_=[_[0]-x,_[1]-S,_[2]-C],v=[v[0]-D,v[1]-O,v[2]-k];let A=Se(r^2654435769),j=g>=2&&(o[1]?.aAu||10)<1.5,M=j?_:u[0],N=j?v:d[0],ee=_e*(j?y:f[0]),P=n?.innerAu??2.15,F=n?.outerAu??3.3,I=n?.kuiperInnerAu??32,L=n?.kuiperOuterAu??46;for(let e=0;e<c;e+=1){let t=s+e,n=e>=Math.floor(c*.72),r=xe({aAu:n?I+A()*Math.max(.5,L-I):P+A()*Math.max(.25,F-P),e:n?.02+A()*.14:.01+A()*.16,incDeg:(A()-.5)*(n?14:12),omDeg:A()*360,wDeg:A()*360,m0Deg:A()*360},ee);u[t]=[M[0]+r.pos[0],M[1]+r.pos[1],M[2]+r.pos[2]],d[t]=[N[0]+r.vel[0],N[1]+r.vel[1],N[2]+r.vel[2]],f[t]=0,p[t]=(15+A()*85)*1e3/he,m[t]=n?7:6}let te=Number(a?.[0])||0,R=Number(a?.[1])||0,ne=Number(a?.[2])||0,z=new Float32Array(l*16);for(let e=0;e<l;e+=1){let[t,n]=ye(u[e][0]+te),[r,i]=ye(u[e][1]+R),[a,o]=ye(u[e][2]+ne),s=e*16;z[s+0]=t,z[s+1]=r,z[s+2]=a,z[s+3]=f[e],z[s+4]=n,z[s+5]=i,z[s+6]=o,z[s+7]=p[e],z[s+8]=d[e][0],z[s+9]=d[e][1],z[s+10]=d[e][2],z[s+11]=m[e],z[s+12]=0,z[s+13]=0,z[s+14]=0,z[s+15]=0}return Object.freeze({packed:z,massiveCount:s,starCount:g,asteroidCount:c,totalCount:l,catalog:o})}var we=`
struct SolarNBodyParams {
  total_count: u32,
  massive_count: u32,
  pad0: u32,
  pad1: u32,
  dt_yr: f32,
  g_const: f32,
  softening2: f32,
  df_zero: f32, // Runtime 0.0 uniform blocking SPIR-V fast-math folding of Knuth TwoSum
};

struct SolarBody {
  pos_hi_m: vec4<f32>, // xyz = pos_hi (AU), w = mass (M_sun)
  pos_lo_r: vec4<f32>, // xyz = pos_lo (AU), w = physical radius (AU)
  vel_k: vec4<f32>,    // xyz = vel (AU/yr), w = kind
  acc_phi: vec4<f32>,  // xyz = acc (AU/yr^2), w = specific potential phi
};

@group(0) @binding(0) var<uniform> params: SolarNBodyParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<SolarBody>;

fn df_barrier(x: f32) -> f32 {
  return x + params.df_zero;
}

fn two_sum(a: f32, b: f32) -> vec2<f32> {
  let s = df_barrier(a + b);
  let bb = df_barrier(s - a);
  let e = df_barrier(a - df_barrier(s - bb)) + df_barrier(b - bb);
  return vec2<f32>(s, e);
}

fn df_add_f32(a_hi: f32, a_lo: f32, b: f32) -> vec2<f32> {
  let s = two_sum(a_hi, b);
  return two_sum(s.x, df_barrier(s.y + a_lo));
}

fn df_sub(a_hi: f32, a_lo: f32, b_hi: f32, b_lo: f32) -> f32 {
  let s = two_sum(a_hi, -b_hi);
  return df_barrier(s.x) + df_barrier(s.y + df_barrier(a_lo - b_lo));
}

@compute @workgroup_size(64)
fn compute_nbody_accel(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }

  let bi = bodies[i];
  let pi_hi = bi.pos_hi_m.xyz;
  let pi_lo = bi.pos_lo_r.xyz;
  let m_count = params.massive_count;
  let eps2 = params.softening2;
  let G = params.g_const;

  var ax = 0.0;
  var ay = 0.0;
  var az = 0.0;
  var phi = 0.0;

  for (var j = 0u; j < m_count; j = j + 1u) {
    if (j == i) { continue; }
    let bj = bodies[j];
    let mj = bj.pos_hi_m.w;
    if (!(mj > 0.0)) { continue; }
    // Double-float subtraction preserves millimeter precision even for Earth-Moon at 1,000+ AU!
    let dx = df_sub(bj.pos_hi_m.x, bj.pos_lo_r.x, pi_hi.x, pi_lo.x);
    let dy = df_sub(bj.pos_hi_m.y, bj.pos_lo_r.y, pi_hi.y, pi_lo.y);
    let dz = df_sub(bj.pos_hi_m.z, bj.pos_lo_r.z, pi_hi.z, pi_lo.z);
    let r2 = dx * dx + dy * dy + dz * dz + eps2;
    let inv_r = inverseSqrt(r2);
    let inv_r3 = inv_r * inv_r * inv_r;
    let fac = G * mj * inv_r3;
    ax = ax + fac * dx;
    ay = ay + fac * dy;
    az = az + fac * dz;
    phi = phi - G * mj * inv_r;
  }

  bodies[i].acc_phi = vec4<f32>(ax, ay, az, phi);
}

@compute @workgroup_size(64)
fn kdk_half_kick_drift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }

  let dt = params.dt_yr;
  var b = bodies[i];
  let v_half = b.vel_k.xyz + 0.5 * dt * b.acc_phi.xyz;
  let nx = df_add_f32(b.pos_hi_m.x, b.pos_lo_r.x, v_half.x * dt);
  let ny = df_add_f32(b.pos_hi_m.y, b.pos_lo_r.y, v_half.y * dt);
  let nz = df_add_f32(b.pos_hi_m.z, b.pos_lo_r.z, v_half.z * dt);

  b.pos_hi_m = vec4<f32>(nx.x, ny.x, nz.x, b.pos_hi_m.w);
  b.pos_lo_r = vec4<f32>(nx.y, ny.y, nz.y, b.pos_lo_r.w);
  b.vel_k = vec4<f32>(v_half, b.vel_k.w);
  bodies[i] = b;
}

@compute @workgroup_size(64)
fn kdk_second_kick(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }
  let dt = params.dt_yr;
  let b = bodies[i];
  bodies[i].vel_k = vec4<f32>(b.vel_k.xyz + 0.5 * dt * b.acc_phi.xyz, b.vel_k.w);
}
`;function Te(e,{catalog:t=null,beltZoneAu:n=null,asteroidCount:r=512,seed:i=20261125,starMassScale:a=1,centerOffsetAu:o=[0,0,0],softeningAu:s=1e-7,label:c=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let l=Ce(t||ve,{asteroidCount:r,beltZoneAu:n,seed:i,starMassScale:a,centerOffsetAu:o}),u=[C(0,`uniform`),C(1,`storage`)],d=t=>T(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${c}-${t}`,code:we,entryPoint:t,bindings:u}),f=d(`compute_nbody_accel`),p=d(`kdk_half_kick_drift`),m=d(`kdk_second_kick`),h=e.createBuffer({label:`${c}-params`,size:32,usage:V.UNIFORM|V.COPY_DST}),g=e.createBuffer({label:`${c}-bodies`,size:l.packed.byteLength,usage:V.STORAGE|V.VERTEX|V.COPY_DST|V.COPY_SRC});e.queue.writeBuffer(g,0,l.packed);let _=l.massiveCount*64,v=e.createBuffer({label:`${c}-massive-staging`,size:_,usage:V.MAP_READ|V.COPY_DST}),y=w(e,{layout:f.bindGroupLayout,label:`${c}-bg`,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}}]}),b=Float32Array.from(l.packed.subarray(0,l.massiveCount*16)),x=0,S=0,E=!1,D=!1,O=!1;function k(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([l.totalCount,l.massiveCount,0,0]),new Float32Array(n,16,4).set([t,_e,s*s,0]),e.queue.writeBuffer(h,0,n)}async function A({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(O)return b;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));k(a);let o=Math.ceil(l.totalCount/64),s=e.createCommandEncoder({label:`${c}-step-${S}`}),u=s.beginComputePass({label:`${c}-pass`});u.setBindGroup(0,y),E||=(u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),!0);for(let e=0;e<i;e+=1)u.setPipeline(p.pipeline),u.dispatchWorkgroups(o),u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),u.setPipeline(m.pipeline),u.dispatchWorkgroups(o);u.end();let d=r&&!D;if(d&&s.copyBufferToBuffer(g,0,v,0,_),e.queue.submit([s.finish()]),S+=i,x+=a*i,d){D=!0;try{await v.mapAsync(V.MAP_READ),O||b.set(new Float32Array(v.getMappedRange(0,_))),v.unmap()}finally{D=!1}}return b}function j(e){let t=e*16;return{posAu:[b[t+0]+b[t+4],b[t+1]+b[t+5],b[t+2]+b[t+6]],velAuPerYr:[b[t+8],b[t+9],b[t+10]],massSolar:b[t+3],radiusAu:b[t+7],phi:b[t+15]}}function M(){let e=0,t=0,n=0,r=0,i=0,a=0,o=Array.from({length:l.massiveCount},(e,t)=>j(t));for(let c=0;c<o.length;c+=1){let l=o[c],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],a+=l.massSolar*Math.sqrt(u);for(let e=c+1;e<o.length;e+=1){let n=o[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],a=n.posAu[2]-l.posAu[2],c=Math.sqrt(r*r+i*i+a*a+s*s);t-=_e*l.massSolar*n.massSolar/c}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,a),simTimeYr:x,stepIndex:S})}function N(){if(!O){O=!0;for(let e of[h,g,v])try{e.destroy()}catch{}}}return Object.freeze({schema:B,get massiveCount(){return l.massiveCount},get starCount(){return l.starCount},get asteroidCount(){return l.asteroidCount},get totalCount(){return l.totalCount},get stepIndex(){return S},get simTimeYr(){return x},get catalog(){return l.catalog},getResidentBuffer:()=>g,getMassiveSnapshot:()=>b,getMassiveBodyState64:j,computeConservationDiagnostics:M,step:A,dispose:N})}var Ee=25.4,De=-14.8,Oe=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Supergalactic Cosmic Web`,exponentLabel:`10²⁵ m`,log10SpanM:24.8,minLog10:21.8,maxLog10:25.5,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).`,kernels:`build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Spiral Galaxy & Halo`,exponentLabel:`10²¹ m`,log10SpanM:21,minLog10:15.8,maxLog10:22.8,diveVerb:`APPROACHING SOLAR SYSTEM`,diveButton:`⚡ ZOOM TO TARGET`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O`,summary:`Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Solar System & Protoplanetary Formation`,exponentLabel:`10¹² m`,log10SpanM:12.6,minLog10:7.9,maxLog10:16.8,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ ZOOM TO SELECTED BODY`,engineSchema:`ulg.astrophysics.solar-system-nbody-webgpu.v1`,plotTitle:`SYMPLECTIC N-BODY & ACCRETION DISK`,equations:`d²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]
v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals`,summary:`Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.`,kernels:`createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star/MHD`,name:`MHD Nebular Collapse & Stellar Fusion`,exponentLabel:`10⁹ m`,log10SpanM:9.2,minLog10:7.4,maxLog10:10.6,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ ZOOM TO EARTH / MATTER`,engineSchema:`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,plotTitle:`GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY`,equations:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]
du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]`,summary:`Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).`,kernels:`createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary World, Atmosphere & Electrodynamics`,exponentLabel:`10⁷ m`,log10SpanM:7.2,minLog10:-5.8,maxLog10:8.6,diveVerb:`DIVING TO CRYSTAL LATTICE`,diveButton:`⚡ ZOOM TO ATOMIC LATTICE`,engineSchema:`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ATMOSPHERIC EM`,equations:`dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge
dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae`,summary:`Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball & Rogue Worlds, Gate 2 Polytope Atlas cutaway — PLUS an interactive Planetary Surface Explorer (TinyPlanetControls) with a 6-Wheel Jump-Rocket Mars Rover and Coaxial Atmospheric Drone whose rotor lift emerges strictly from local ρ_atm & g!`,kernels:`createPlanetaryAtmosphereElectricSessionWebGpu · createPlanetarySurfaceSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8.2,minLog10:-9.5,maxLog10:-5.2,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ ZOOM TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)`,summary:`Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,minLog10:-13.2,maxLog10:-9,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ ZOOM TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-14.3,minLog10:-15.2,maxLog10:-12.6,diveVerb:`ZOOMING OUT TO COSMOS`,diveButton:`↻ FLY OUT TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),ke=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),Ae=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:22,cosmoFftN:16,galaxyStars:16384,solarAsteroids:256,stellarParticles:2048,mdCells:6,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:28,cosmoFftN:32,galaxyStars:32768,solarAsteroids:512,stellarParticles:4096,mdCells:7,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:32,cosmoFftN:32,galaxyStars:49152,solarAsteroids:1024,stellarParticles:6144,mdCells:8,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:36,cosmoFftN:32,galaxyStars:65536,solarAsteroids:1536,stellarParticles:8192,mdCells:9,orbitalPoints:24e4,nuclearVolDim:32})});function je(e){let t=10**e;return e>=22?`${(t/308567758e14).toFixed(1)} Mpc`:e>=19?`${(t/0x834b443cc4108000).toFixed(1)} kly`:e>=15.8?`${(t/946073047e7).toFixed(2)} ly`:e>=10.6?`${(t/149597870700).toFixed(2)} AU`:e>=8.7?`${(t/6957e5).toFixed(2)} R☉`:e>=4?`${Math.round(t/1e3).toLocaleString()} km`:e>=0?`${t.toFixed(1)} m`:e>=-3?`${(t*1e3).toFixed(1)} mm`:e>=-6?`${(t*1e6).toFixed(1)} μm`:e>=-9.2?`${(t*1e9).toFixed(2)} nm`:e>=-11.5?`${(t*1e10).toFixed(2)} Å`:e>=-13?`${(t*0xe8d4a51000).toFixed(2)} pm`:`${(t*0x38d7ea4c68000).toFixed(1)} fm`}function Me(){return`
    <p><strong>ULG Universes</strong> is a single-canvas, <strong>continuous-zoom 40-order-of-magnitude</strong> WebGPU cosmos spanning <code>10⁺²⁵ m</code> supergalactic filaments down to <code>10⁻¹⁵ m</code> atomic nuclei — paired with a continuous <strong>Cosmic Epoch Spine</strong> from CMB Recombination (<code>z = 1100</code>) through Cosmic Dawn (<code>z = 10</code>), Cosmic Noon / Quasar Peak (<code>z = 2.8</code>), and Present Day (<code>z = 0</code>) into the <code>+5 Gyr</code> Red-Giant &amp; Remnant Era.</p>
    <p>Every astronomical entity emerges dynamically from ULG’s <strong>16-node Universal Law Graph</strong> on WebGPU — zero hardcoded entity/planet hacks or scripted animations:</p>
    <ul>
      <li><strong>L0 Cosmology (10²⁵ m):</strong> 2LPT 1-submit FLRW 3D-FFT TreePM Cosmic Web + Eisenstein–Hu BAO/CMB ΔT/T shell (<code>z=1100</code>), Pop III Reionization bubbles (<code>z=10</code>), and Bullet-Cluster X-ray ICM / 2D gravitational lensing.</li>
      <li><strong>L1 Galaxies &amp; Clusters (10²¹ m):</strong> <code>16K–65K</code> GPU stars on parallel <code>SchroederScaleAtlas</code> multipole gravity across Spiral, Barred Spiral, Major Merger, Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf &amp; Halo Stream, and Core-Collapsed Globular Cluster + Gate 1 ISM cooling <code>Λ(T, Z)</code>.</li>
      <li><strong>L2 Planetary, Small-Body &amp; Relativistic Systems (10¹² m → 10⁷ m):</strong> Double-float (<code>f32x2</code>) symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption &amp; Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment, Kerr Blandford–Znajek Quasar/Blazar Jets (live Doppler beaming), Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW-Chirp BNS Kilonova &amp; BBH Mergers.</li>
      <li><strong>L3 Stars, Nebulae &amp; Compact Remnants (10⁹ m):</strong> Thermonuclear Fusion Core, 3D Resistive MHD Nebular Collapse &amp; Bipolar Jets, Strömgren Photoionized H II Pillars, Bipolar Planetary Nebulae, SNR / Crab PWN, Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).</li>
      <li><strong>L4 Planetary Worlds (10⁷ m):</strong> Spherical baroclinic atmosphere, triboelectric Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean, Cryovolcanic Icy Plumes, Tidally Locked Eyeball &amp; Rogue Worlds, plus Gate 2 Polytope Atlas cutaway.</li>
      <li><strong>L5–L7 Microphysics (10⁻⁸ m → 10⁻¹⁵ m):</strong> Linked-cell GPU MD, 4-component Dirac–KS Atoms + RHF Molecules + PeerCompute 2-of-2 quorum mesh, and quantized Woods–Saxon Atomic Nuclei + Visscher α-tunneling TDSE.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark comparisons remain offline and advisory.</p>
  `}function Ne(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:Me()}var Pe=`ulg.astrophysics.causal-nebular-cascade.v1`,Fe=Object.freeze([`Vela`,`Kepler`,`Cygnus`,`Lyra`,`Carina`,`Draco`,`Perseus`,`Norma`,`Scutum`,`Centauri`,`Aurelia`,`Eridani`,`Pavonis`,`Ceti`,`Tauri`,`Hydrae`]),H=`bcdefghijklm`,Ie=Object.freeze([`I`,`II`,`III`,`IV`,`V`,`VI`]);function Le(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Re(e,t,n,r=1){let i=(r^2654435769)>>>0,a=e=>{let t=Math.round(Number(e)*1e3)|0;i=Math.imul(i^t,2246822507)>>>0,i=(i^i>>>13)>>>0};return a(e),a(t),a(n),i>>>0}function ze(e){let t=Math.max(2200,Math.min(55e3,Number(e)||5778));return t>=26e3?{color0:[.62,.78,1],color1:[.36,.56,1],spectral:`O`}:t>=10500?{color0:[.74,.86,1],color1:[.48,.68,1],spectral:`B`}:t>=7400?{color0:[.88,.93,1],color1:[.66,.78,.98],spectral:`A`}:t>=6e3?{color0:[1,.97,.88],color1:[.95,.84,.6],spectral:`F`}:t>=5200?{color0:[1,.93,.74],color1:[1,.6,.2],spectral:`G`}:t>=3750?{color0:[1,.76,.46],color1:[.94,.42,.14],spectral:`K`}:{color0:[1,.5,.28],color1:[.78,.18,.08],spectral:`M`}}function Be(e,t=!1){if(e.stage===`white-dwarf`||e.stage===`planetary-nebula`)return`DA-WD`;if(e.stage===`neutron-star`||e.stage===`supernova-remnant-pwn`)return`NS`;if(e.stage===`stellar-black-hole`||e.stage===`hypernova-remnant`)return`BH`;if(e.stage===`brown-dwarf`)return e.effectiveTempK>1400?`L-BD`:`T-BD`;if(e.stage===`red-giant`||e.stage===`agb-superwind`)return e.effectiveTempK<3600?`M2III`:`K2III`;let n=ze(e.effectiveTempK),r=Math.max(0,Math.min(9,Math.round(9-e.effectiveTempK%1200/1200*9)));return t?`PopIII-${n.spectral}`:`${n.spectral}${r}V`}function Ve(e,t,n){let r=Math.max(1e-4,Number(e)||.2),i=Math.max(0,Math.min(.65,Number(t)||.05)),a=Math.max(.05,Math.min(.5,Number(n)||.35)),o=i*i,s=a*a,c=r*(1.6+5.1*i-2.22*o+4.12*a-4.27*i*a-5.09*s+4.61*o*s),l=r*(.464-.38*a-.631*i+.586*a*i+.15*o-.198*a*o);return{rCritPAu:Math.max(r*1.85,c),rCritSAu:Math.max(.02,l)}}function He({cosmicEpoch:e=null,regionPosMpc:t=[0,0,0],localOverdensity:n=1,seed:r=20261125}={}){let i=e||de({redshiftZ:0}),a=Number(i.redshiftZ)||0,o=Math.max(.05,Number(i.cosmicAgeGyr)||13.8),s=Math.max(.15,Math.min(8,Number(n)||1)),c=Re(t[0]||0,t[1]||0,t[2]||0,r^257),l=Le(c),u=`disk`,d=`Grand-Design Spiral`;a>=4.5?(u=`proto`,d=`Primordial High-z Protogalaxy`):a>=1.4?(u=s>2.4?`binary`:`proto`,d=u===`binary`?`Cosmic-Noon Starburst Merger`:`High-z Clumpy Starburst Disk`):a<-.15?(u=s>1.3?`sphere`:`barred`,d=u===`sphere`?`Evolved Giant Elliptical`:`Aging Barred Spiral`):s>2.8?(u=l()<.72?`sphere`:`binary`,d=u===`sphere`?`Cluster-Core Giant Elliptical`:`Interacting Major Merger Pair`):s<.48?(u=l()<.55?`dwarf-stream`:`globular`,d=u===`dwarf-stream`?`Void-Edge Dwarf & Tidal Stream`:`Metal-Poor Globular Cluster`):(u=l()<.42?`barred`:`disk`,d=u===`barred`?`Barred Spiral (SBb)`:`Grand-Design Spiral (Sc/Sb)`);let f=Math.max(1e-4,Number(i.meanMetallicitySolar)||1),p=s**.28,m=u===`globular`?.08:u===`dwarf-stream`?.35:u===`sphere`?1.45:1,h=Math.max(1e-4,Math.min(3.2,f*p*m)),g=Math.log10(h),_=Number(i.galaxyGasFraction??i.haloGasFraction)||.16,v=Math.max(.01,Math.min(.88,_*(u===`sphere`?.22:u===`globular`?.05:1))),y=Math.max(.32,Math.min(.88,.38+.18*Math.min(1.4,h)+(l()-.5)*.12));return Object.freeze({schema:Pe,cosmicEraId:i.eraId||`present-day`,redshiftZ:a,cosmicAgeGyr:o,localOverdensity:s,regionPosMpc:Object.freeze([t[0]||0,t[1]||0,t[2]||0]),morphology:u,morphologyLabel:d,meanMetallicitySolar:h,baseFeH:g,baseCO:y,gasFraction:v,isPrimordialPopIII:a>=7.5||h<.004,seed:c})}function Ue(e,{isPopIII:t=!1,isYoungArm:n=!1,isAncient:r=!1}={}){let i=e();return t?5*11**i**.72:n?i<.32?.18+e()*.35:i<.52?.53+e()*.32:i<.7?.85+e()*.35:i<.86?1.2+e()*1.4:2.6+e()**1.8*18:r?i<.48?.14+e()*.36:i<.74?.5+e()*.34:i<.88?.84+e()*.24:1.08+e()**1.4*2.2:i<.44?.12+e()*.38:i<.68?.5+e()*.32:i<.84?.82+e()*.28:i<.93?1.1+e()*.45:i<.98?1.55+e()*1.15:2.7+e()**1.6*8.5}function We({cosmicEpoch:e=null,galaxyEnv:t=null,starPosGal:n=[4.8,.04,2.1],popTag:r=.48,starIndex:i=0,seed:a=20261125,forceMultiplicity:o=null}={}){let s=e||de({redshiftZ:0}),c=t||He({cosmicEpoch:s,seed:a}),l=Math.hypot(n[0]||0,n[2]||0),u=Math.abs(n[1]||0),d=Math.max(.2,l*1.65),f=u*1.65,p=Re(n[0]||0,n[1]||0,n[2]||0,(a^(i+1)*2654435761)>>>0),m=Le(p),h=d<2.6||c.morphology===`sphere`,g=f>1.4||c.morphology===`globular`||c.morphology===`dwarf-stream`,_=r>=.76&&!h&&!g&&c.gasFraction>.08,v=h||g||c.redshiftZ<-.15,y=-.068*(d-8.2),b=-.32*Math.min(1.8,f),x=_?.14:0,S=(m()-.5)*.24,C=c.baseFeH+y+b+x+S;c.isPrimordialPopIII&&(C=Math.min(-2.4,C-1.2)),C=Math.max(-4,Math.min(.55,C));let w=10**C,T=Math.max(.25,Math.min(1.08,c.baseCO+(h?.22:0)+C*.22+(m()-.5)*.26)),E=g||c.redshiftZ>1.5?.38:h?.22:.04,D=Math.max(.05,c.cosmicAgeGyr-.25),O;O=c.isPrimordialPopIII?Math.min(D,.002+m()*.015):_?Math.min(D,.015+m()*.35):v?Math.min(D,Math.max(.4,D*(.58+m()*.34))):Math.min(D,Math.max(.2,(.6+m()*8.6)*Math.min(1,D/10)));let k=Ue(m,{isPopIII:c.isPrimordialPopIII,isYoungArm:_,isAncient:v}),A=1;if(o===1||o===2||o===3)A=o;else{let e=m();A=k<.5?e<.73?1:e<.96?2:3:k<1.3?e<.54?1:e<.88?2:3:e<.28?1:e<.74?2:3}let j=[k];if(A>=2){let e=.28+.68*m()**.75;j.push(Math.max(.08,k*e))}if(A===3){let e=.22+.58*m()**.9;j.push(Math.max(.08,k*e))}let M=Fe[p%Fe.length],N=100+(p>>>5)%899,ee=`${M}-${N}`,P=[`A`,`B`,`C`],F=j.map((e,t)=>{let n=te({massSolar:e,ageGyr:O,metallicitySolar:w}),r=ze(n.effectiveTempK),i=Be(n,c.isPrimordialPopIII),a=n.remnantClass!==`none`,o=Math.max(12,n.radiusSolar*695700),s=Math.min(8,1.42*w),l=Math.min(34,24.8+1.8*w),u=Math.max(60,100-l-s),d=n.stage===`white-dwarf`?`Degenerate C/O Core · Thin H/He Envelope`:n.stage===`neutron-star`?`Superfluid Neutron Interior · Iron Crust`:n.stage===`stellar-black-hole`?`Relativistic Kerr Event Horizon`:`H ${u.toFixed(1)}% · He ${l.toFixed(1)}% · Metals ${s.toFixed(2)}% ([Fe/H]=${C>=0?`+`:``}${C.toFixed(2)})`;return Object.freeze({component:P[t],name:A>1?`${ee} ${P[t]} (${i})`:`${ee} (${i})`,spectralCode:i,stage:n.stage,remnantClass:n.remnantClass,initialMassSolar:e,massSolar:n.massSolar,radiusSolar:n.radiusSolar,radiusKm:o,luminositySolar:Math.max(1e-4,n.luminositySolar),effectiveTempK:Math.max(1200,n.effectiveTempK||5778),color0:n.stage===`white-dwarf`?[.8,.94,1]:n.stage===`neutron-star`?[.68,.88,1]:r.color0,color1:n.stage===`white-dwarf`?[.46,.72,1]:n.stage===`neutron-star`?[.76,.36,1]:r.color1,isRemnant:a,composition:d})}),I=`single`,L=null,R=null;if(A===2){let e=m()<.58;I=e?`binary-p-type`:`binary-s-type`;let t=Math.max(.08,(F[0].radiusSolar+F[1].radiusSolar)*.00465*4.5),n=e?Math.max(t,.11+m()*.24):Math.max(t*4,14.5+m()*14),r=e?.02+m()*.14:.06+m()*.22;L=Object.freeze({aAu:n,e:r,incDeg:(m()-.5)*4.5,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360})}else if(A===3){I=`hierarchical-trinary`;let e=Math.max(.08,(F[0].radiusSolar+F[1].radiusSolar)*.00465*4.5);L=Object.freeze({aAu:Math.max(e,.1+m()*.22),e:.02+m()*.12,incDeg:(m()-.5)*3,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360}),R=Object.freeze({aAu:16.5+m()*13.5,e:.05+m()*.18,incDeg:(m()-.5)*14,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360})}let ne=Math.max(1e-6,.012*w),z=Object.freeze({feH:C,metallicitySolar:w,cToO:T,alphaOverFe:E,dustToGasRatio:ne,carbonRich:T>=.8,solidDiskMassEarth:Math.max(0,48*w*Math.max(.15,k)**.85),volatileInventory:Math.max(0,(1.15-Math.max(0,T-.55)*1.1)*Math.min(2.2,w+.12)),nebulaSummary:`[Fe/H]=${C>=0?`+`:``}${C.toFixed(2)} · C/O=${T.toFixed(2)} · Dust/Gas=${(ne*100).toFixed(3)}%${T>=.8?` (Carbon-Rich)`:``}`}),re=h?`Galactic Bulge`:g?`Stellar Halo`:_?`Spiral-Arm H II Nursery`:`Galactic Disk`;return Object.freeze({schema:Pe,systemId:`${M.toLowerCase()}-${N}`,systemName:ee,galacticRegion:re,rKpc:Number(d.toFixed(2)),zKpc:Number(f.toFixed(2)),systemAgeGyr:Number(O.toFixed(2)),multiplicity:A,architecture:I,stars:Object.freeze(F),binaryPair:L,outerCompanion:R,nebulaEnv:z,galaxyEnv:c,seed:p})}function Ge(e,{seedOverride:t=null}={}){let n=e||We(),r=Le(((t??n.seed)^328103)>>>0),{stars:i,multiplicity:a,architecture:o,binaryPair:s,outerCompanion:c,nebulaEnv:l}=n,u=[];for(let e=0;e<i.length;e+=1){let t=i[e],n={id:`star-${e}`,name:t.name,subtitle:`${t.stage.replace(/-/g,` `)} · ${t.massSolar.toFixed(2)} M☉ · T=${Math.round(t.effectiveTempK).toLocaleString()} K`,isStar:!0,starIndex:e,parent:-1,kind:t.stage===`stellar-black-hole`?5:0,massSolar:t.massSolar,radiusKm:t.radiusKm,luminositySolar:t.luminositySolar,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[...t.color0],color1:[...t.color1],atm:0,surfacePressurePa:0,tempK:Math.round(t.effectiveTempK),centralP:t.stage===`neutron-star`?1e34:t.stage===`white-dwarf`?1e22:0x58d15e17628000*t.massSolar**1.4,coreZ:t.stage===`white-dwarf`?6:t.stage===`neutron-star`?26:1,mantleZ:t.stage===`white-dwarf`?8:2,surfZ:1,composition:t.composition,stage:t.stage,spectralCode:t.spectralCode};e===1&&s?(n.parent=0,n.orbitRole=`binary-companion`,n.aAu=s.aAu,n.e=s.e,n.incDeg=s.incDeg,n.omDeg=s.omDeg,n.wDeg=s.wDeg,n.m0Deg=s.m0Deg):e===2&&c&&(n.parent=-2,n.orbitRole=`trinary-outer`,n.aAu=c.aAu,n.e=c.e,n.incDeg=c.incDeg,n.omDeg=c.omDeg,n.wDeg=c.wDeg,n.m0Deg=c.m0Deg),u.push(n)}let d=o===`binary-p-type`||o===`hierarchical-trinary`,f=d?i[0].luminositySolar+i[1].luminositySolar:i[0].luminositySolar,p=d?i[0].massSolar+i[1].massSolar:i[0].massSolar,m=d?-2:0,h=Math.sqrt(Math.max(1e-4,f)),g=Math.max(.05,.085*h),_=Math.max(.18,2.7*h),v=Math.max(.75,11.2*h),y=Math.max(.08,.94*h),b=Math.max(.16,1.68*h),x=Math.max(g*1.15,i[0].radiusSolar*.00465*6),S=Math.min(38,Math.max(6,26*p**.35));if(d&&s){let e=Math.min(i[0].massSolar,i[1].massSolar)/(i[0].massSolar+i[1].massSolar),t=Ve(s.aAu,s.e,e);x=Math.max(x,t.rCritPAu*1.18)}if(o===`binary-s-type`&&s){let e=i[1].massSolar/(i[0].massSolar+i[1].massSolar),t=Ve(s.aAu,s.e,e);S=Math.min(S,t.rCritSAu*.92)}else if(o===`hierarchical-trinary`&&c){let e=i[0].massSolar+i[1].massSolar,t=i[2].massSolar/(e+i[2].massSolar),n=Ve(c.aAu,c.e,t);S=Math.min(S,n.rCritSAu*.9)}let C=l.metallicitySolar>=.015&&i[0].stage!==`stellar-black-hole`&&i[0].stage!==`neutron-star`&&S>x*1.45,w=0;if(C){let e=Math.log(S/x),t=Math.max(1,Math.min(8,Math.floor(e/.48))),n=Math.max(.25,Math.min(1.25,.65+.35*(l.feH+1)));w=Math.max(1,Math.min(t,Math.round((2+r()*5)*n)))}let T=Math.max(.04,Math.min(.88,.14*l.metallicitySolar**1.75)),E=i[0].stage===`red-giant`||i[0].stage===`agb-superwind`,D=i[0].stage===`white-dwarf`,O=x*(1.08+r()*.45),k=!1,A=[];for(let e=0;e<w&&!(O>=S*.96);e+=1){let t=O;O*=1.52+r()*.62;let i=Math.max(28,Math.round(278*Math.max(1e-4,f)**.25/Math.sqrt(Math.max(.02,t)))),a=t>=_,o=t>=v,s=t>=y&&t<=b,c=r(),d=`rocky-arid`;a&&c<T*1.15&&!D?d=o||r()<.38?`ice-giant`:`gas-giant`:!a&&t<_*.25&&c<T*.22&&!E&&!D?d=`hot-jupiter`:i>=950||E&&t<1.8?d=r()<.55?`lava-world`:`iron-core`:l.carbonRich&&!a?d=`carbon-world`:s&&!k&&!E&&!D&&n.systemAgeGyr>=.35&&l.volatileInventory>=.35&&c<.42?(d=`earth-like`,k=!0):d=s&&l.volatileInventory>=.55&&c<.72?`ocean-super-earth`:i>390&&i<950&&l.metallicitySolar>.25?`greenhouse`:a?c<.45?`ice-giant`:`icy-dwarf`:i<250&&c<.55?`arid-oxide`:r()<.45?`super-earth`:`iron-core`;let p=H[e]||`p${e+1}`,h=`${n.systemName} ${p}`,g=null;if(d===`earth-like`){let e=.68+r()*.95,n=Math.round(6371*e**.27),a=Math.round((.65+r()*1.15)*101325),o=Math.max(268,Math.min(312,Math.round(i+28+(r()-.5)*14)));g={name:`${h} (Earth-like)`,planetClass:`earth-like`,subtitle:`Earth-like Oceanic Silicate-Iron World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ge,radiusKm:n,color0:[.22+r()*.12,.46+r()*.12,.22+r()*.08],color1:[.05,.24+r()*.1,.58+r()*.1],atm:.72,surfacePressurePa:a,volatileMassFrac:.045+r()*.025,particulateMassFrac:.006,tempK:o,centralP:Math.round((260+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · MgSiO₃ Mantle · Liquid H₂O Ocean · N₂/O₂ ${(a/1e5).toFixed(2)} bar`}}else if(d===`ocean-super-earth`){let e=2.2+r()*3.8,n=Math.round(6371*e**.29*1.08),a=Math.round((1.5+r()*4.5)*101325);g={name:`${h} (Ocean World)`,planetClass:`ocean-world`,subtitle:`Pelagic Super-Earth · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ge,radiusKm:n,color0:[.16,.44,.56],color1:[.04,.2,.56],atm:.78,surfacePressurePa:a,volatileMassFrac:.085,particulateMassFrac:.004,tempK:Math.max(270,Math.min(345,i+36)),centralP:Math.round((420+e*95)*1e9),coreZ:26,mantleZ:8,surfZ:8,composition:`Fe Core · High-P H₂O Ice-VII Mantle · Global Liquid Ocean (${e.toFixed(1)} M⊕)`}}else if(d===`carbon-world`){let e=.6+r()*3.2,n=Math.round(6371*e**.27*.96),a=i>550?24e4:42e3;g={name:`${h} (Carbon World)`,planetClass:`carbon-world`,subtitle:`High-C/O Graphite–SiC–Diamond World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ge,radiusKm:n,color0:[.34,.32,.36],color1:[.16,.15,.2],atm:.32,surfacePressurePa:a,volatileMassFrac:.012,particulateMassFrac:.035,tempK:i+18,centralP:Math.round((240+e*115)*1e9),coreZ:26,mantleZ:6,surfZ:6,composition:`Fe-C Core · Diamond/SiC Mantle · Graphite & Hydrocarbon Crust (C/O=${l.cToO.toFixed(2)})`}}else if(d===`lava-world`){let e=.4+r()*3.6,n=Math.round(6371*e**.27);g={name:`${h} (Lava World)`,planetClass:`lava-world`,subtitle:`Molten Silicate Magma Ocean World · ${t.toFixed(2)} AU`,kind:7,massSolar:e*ge,radiusKm:n,color0:[1,.44,.1],color1:[.22,.08,.05],atm:.42,surfacePressurePa:14e4,volatileMassFrac:.005,particulateMassFrac:.06,tempK:Math.max(1350,i),centralP:Math.round((220+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Molten Fe-Ni Core · Magma MgSiO₃ Ocean · Vaporized SiO/Na Exosphere`}}else if(d===`iron-core`){let e=.05+r()*.45,n=Math.round(2200+e**.3*3200);g={name:`${h} (Iron World)`,planetClass:`iron-world`,subtitle:`Refractory Iron-Rich Terrestrial Core · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ge,radiusKm:n,color0:[.56,.52,.48],color1:[.34,.31,.29],atm:0,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:i,centralP:Math.round((35+e*120)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-Ni Core 68% · Silicate Mantle 32% · Airless Cratered Regolith`}}else if(d===`greenhouse`){let e=.65+r()*1.8,n=Math.round(5600+e**.27*1600),a=Math.round((2.5+r()*7.5)*1e6);g={name:`${h} (Greenhouse)`,planetClass:`greenhouse`,subtitle:`Super-Greenhouse CO₂ World · ${t.toFixed(2)} AU`,kind:2,massSolar:e*ge,radiusKm:n,color0:[.9,.78,.52],color1:[.74,.54,.3],atm:.85,surfacePressurePa:a,volatileMassFrac:.025,particulateMassFrac:.055,tempK:Math.min(920,i+280),centralP:Math.round((240+e*105)*1e9),coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · Supercritical CO₂ ${(a/1e5).toFixed(0)} bar Atm`}}else if(d===`arid-oxide`||d===`super-earth`){let e=d===`super-earth`,n=e?1.8+r()*3.2:.1+r()*.42,a=Math.round(e?6371*n**.27:3e3+n**.3*2100),o=Math.round(e?(.8+r()*2.2)*1e5:450+r()*2400);g={name:`${h} (${e?`Super-Earth`:`Arid World`})`,planetClass:e?`super-earth`:`arid-world`,subtitle:`${e?`Rocky Silicate Super-Earth`:`Arid Iron-Oxide Desert World`} · ${t.toFixed(2)} AU`,kind:1,massSolar:n*ge,radiusKm:a,color0:e?[.64,.46,.32]:[.76,.36,.2],color1:e?[.38,.28,.2]:[.5,.22,.14],atm:e?.46:.18,surfacePressurePa:o,volatileMassFrac:e?.015:.002,particulateMassFrac:.048,tempK:Math.max(140,i+(e?22:6)),centralP:Math.round((e?420:45)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Silicate Crust · ${(o/1e5).toFixed(o<5e3?3:2)} bar CO₂/N₂`}}else if(d===`hot-jupiter`||d===`gas-giant`){let e=d===`hot-jupiter`,n=e?.35+r()*2.4:.22+r()*3.1,a=Math.round((54e3+r()*24e3)*(e?1.18:1)),o=!e&&r()<.48;g={name:`${h} (${e?`Hot Jupiter`:o?`Ringed Giant`:`Gas Giant`})`,planetClass:e?`hot-jupiter`:`gas-giant`,subtitle:`${e?`Tidally Inflated Hot Jupiter`:`Metallic-Hydrogen Gas Giant`} · ${t.toFixed(2)} AU`,kind:2,massSolar:n*954588e-9,radiusKm:a,color0:e?[.96,.52,.24]:[.8+r()*.14,.68+r()*.14,.5+r()*.14],color1:e?[.54,.18,.12]:[.52+r()*.14,.36+r()*.12,.24+r()*.1],atm:.55,surfacePressurePa:1e5,volatileMassFrac:.08,particulateMassFrac:.02,ringed:o,ringInnerKm:o?Math.round(a*1.28):0,ringOuterKm:o?Math.round(a*2.38):0,tempK:Math.max(90,i),centralP:Math.round((360+n*180)*1e9),coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ ${(88+r()*7).toFixed(1)}% · He · Metallic H Mantle (${n.toFixed(2)} M_J)`}}else if(d===`ice-giant`){let e=10+r()*14,n=Math.round(21e3+r()*7500),a=r()<.28,o=r()<.52;g={name:`${h} (Ice Giant)`,planetClass:`ice-giant`,subtitle:`Superionic H₂O/NH₃/CH₄ Ice Giant · ${t.toFixed(2)} AU`,kind:3,massSolar:e*ge,radiusKm:n,color0:o?[.26,.5,.94]:[.54,.84,.9],color1:o?[.14,.3,.76]:[.36,.68,.8],atm:.62,surfacePressurePa:1e5,volatileMassFrac:.06,particulateMassFrac:.01,ringed:a,ringInnerKm:a?Math.round(n*1.45):0,ringOuterKm:a?Math.round(n*2.15):0,tempK:Math.max(42,i),centralP:Math.round((240+e*4.5)*1e9),coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Superionic Mantle · H₂/He Envelope (${e.toFixed(1)} M⊕)`}}else{let e=.015+r()*.14,n=Math.round(1350+r()*1650);g={name:`${h} (Cryo Dwarf)`,planetClass:`icy-dwarf`,subtitle:`Outer-Disk Volatile Ice World · ${t.toFixed(2)} AU`,kind:3,massSolar:e*ge,radiusKm:n,color0:[.78,.84,.9],color1:[.46,.56,.68],atm:.04,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:Math.max(35,i),centralP:5e9,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/N₂/CH₄ Ice Shell · Silicate Core`}}let x=u.length;u.push({id:`planet-${e}`,parent:m,aAu:Number(t.toFixed(4)),e:Number((.008+r()*(d===`earth-like`?.045:.095)).toFixed(4)),incDeg:Number(((r()-.5)*4.2).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),...g}),A.push(x);let S=d===`gas-giant`||d===`ice-giant`,C=S?1+Math.floor(r()*2.4):+((d===`earth-like`||d===`ocean-super-earth`)&&r()<.65);for(let t=0;t<C;t+=1){let n=Math.round(S?1450+r()*1350:1150+r()*850),o=(n/1737.4)**3*3.6943e-8,s=g.radiusKm*(5.2+t*5.8+r()*2.5)*1e3/149597870700,c=S&&a&&n>2350&&i<125,l=S&&t===0&&r()<.45;u.push({id:`moon-${e}-${t}`,name:`${h}-${Ie[t]||t+1}`,planetClass:c?`hazy-moon`:l?`volcanic-moon`:a?`icy-moon`:`rocky-moon`,subtitle:`${c?`Dense-Atmosphere Methane Moon`:l?`Tidally Heated Volcanic Moon`:a?`Subsurface-Ocean Icy Moon`:`Natural Rocky Satellite`}`,parent:x,kind:c?2:l?1:3,massSolar:o,radiusKm:n,aAu:Number(s.toFixed(6)),e:Number((.005+r()*.035).toFixed(4)),incDeg:Number(((r()-.5)*4).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),color0:c?[.86,.68,.34]:l?[.92,.8,.3]:a?[.84,.86,.9]:[.66,.65,.63],color1:c?[.62,.44,.2]:l?[.68,.44,.14]:a?[.54,.66,.78]:[.4,.39,.38],atm:c?.78:0,surfacePressurePa:c?142e3:0,volatileMassFrac:c?.04:0,particulateMassFrac:c?.03:0,tempK:Math.max(45,i),centralP:6e9,coreZ:a?14:26,mantleZ:a?8:14,surfZ:l?16:c?6:a?8:14,composition:c?`N₂/CH₄ Haze Atm · H₂O/Silicate Interior`:l?`Silicate Mantle · Sulfur Volcanic Crust`:a?`H₂O Ice/Ocean Shell · Silicate Core`:`Silicate Regolith · Fe Core`})}}let j=u.findIndex(e=>e.planetClass===`earth-like`),M=u.findIndex(e=>!e.isStar),N=j>=0?j:M>=0?M:0;return Object.freeze({schema:Pe,systemId:n.systemId,systemName:n.systemName,starSystem:n,multiplicity:a,architecture:o,starCount:i.length,planetCount:A.length,hasEarthLike:k,earthLikeIndex:j,defaultFocusIndex:N,condensationFrontsAu:Object.freeze({rSilicateAu:Number(g.toFixed(3)),rHzInnerAu:Number(y.toFixed(3)),rHzOuterAu:Number(b.toFixed(3)),rSnowLineAu:Number(_.toFixed(3)),rCoIceAu:Number(v.toFixed(3)),rMinStableAu:Number(x.toFixed(3)),rMaxStableAu:Number(S.toFixed(3))}),beltZoneAu:Object.freeze({innerAu:Math.max(x*1.4,_*.78),outerAu:Math.min(S*.95,_*1.25),kuiperInnerAu:Math.min(S*.96,Math.max(v*1.1,_*2.4)),kuiperOuterAu:Math.min(44,Math.max(v*1.6,_*3.6))}),catalog:Object.freeze(u)})}var Ke=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,U=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),qe=16,Je=32,Ye=`
struct CosmoParams {
  particle_count: u32,
  grid_n: u32,
  step_index: u32,
  remote_tile_count: u32,
  box_l: f32,
  a_scale: f32,
  da: f32,
  h_a: f32,             // H(a) / H_0
  omega_m: f32,
  grav_pref: f32,       // (3/2) * Omega_m / a
  mean_mass_cell: f32,
  short_range_r_s: f32, // TreePM force-split scale r_s (0 => pure PM)
  prev_kick_fac: f32,   // previous step kick factor for exact KDK synchronization
  tile_x_min: f32,
  tile_x_max: f32,
  pad0: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoParams;
@group(0) @binding(1) var<storage, read_write> particles: array<CosmoParticle>;
// Fixed-point atomic CIC density grid (grid_n^3)
@group(0) @binding(2) var<storage, read_write> cic_mass_i32: array<atomic<i32>>;
// Complex density / gradient / k-space grid bound to fft3d workspace or saved k-space
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// 3-component PM force grid: vec4(fx, fy, fz, delta)
@group(0) @binding(4) var<storage, read_write> force_grid: array<vec4<f32>>;
// Float32 telemetry + 16-bin P(k) + tile multipole summary buffer:
//   [0]: vec4(sum_delta2, max_delta, sum_delta, grid_total)
//   [1]: vec4(sum_ke, px, py, pz)
//   [2..17]: 16 P(k) bins: vec4(k_sum, pk_sum, mode_count, 0.0)
//   [18]: tile multipole 0: vec4(total_mass, com_x, com_y, com_z)
//   [19]: tile multipole 1: vec4(quad_trace, particle_count, 0.0, 0.0)
@group(0) @binding(5) var<storage, read_write> telemetry_f32: array<vec4<f32>>;
// Short-range sub-cell TreePM atomic cell-multipole accumulators (grid_n^3 * 4 i32): [m, m*dx, m*dy, m*dz]
@group(0) @binding(6) var<storage, read_write> sr_cell_accum: array<atomic<i32>>;
// Resolved short-range TreePM cell multipole nodes (cell-local COM offset, NOT wrapped abs!):
//   vec4(com_off_x, com_off_y, com_off_z, cell_mass) + remote tile multipoles appended at [grid_total .. grid_total + 31]:
//   remote_tile[r]: vec4(com_x, com_y, com_z, total_mass)
@group(0) @binding(7) var<storage, read_write> sr_cell_nodes: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;
const PK_BINS: u32 = ${qe}u;

var<workgroup> wg_f0: array<f32, 256>;
var<workgroup> wg_f1: array<f32, 256>;
var<workgroup> wg_f2: array<f32, 256>;
var<workgroup> wg_f3: array<f32, 256>;
var<workgroup> wg_f4: array<f32, 256>;
var<workgroup> wg_f5: array<f32, 256>;

fn wrap_coord(u: f32, L: f32) -> f32 {
  let half_l = 0.5 * L;
  var x = u + half_l;
  x = x - L * floor(x / L);
  return x - half_l;
}

fn wrap_delta(d: f32, L: f32) -> f32 {
  return d - L * round(d / L);
}

fn safe_grid_index(g: f32, n: u32) -> u32 {
  let ni = i32(n);
  let gi = i32(floor(g));
  let m = ((gi % ni) + ni) % ni;
  return u32(m);
}

fn erfc_approx(x_in: f32) -> f32 {
  let x = max(0.0, x_in);
  let t = 1.0 / (1.0 + 0.3275911 * x);
  let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * exp(-x * x);
}

fn treepm_short_range_split(r: f32, r_s: f32) -> f32 {
  let u = r / max(2.0 * r_s, 1.0e-5);
  return erfc_approx(u) + (2.0 * u * 0.5641895835) * exp(-u * u);
}

@compute @workgroup_size(64)
fn clear_grids(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx < total) {
    atomicStore(&cic_mass_i32[idx], 0);
    force_grid[idx] = vec4<f32>(0.0);
    atomicStore(&sr_cell_accum[idx * 4u + 0u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 1u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 2u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 3u], 0);
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
  if (idx < 20u) {
    telemetry_f32[idx] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn cic_deposit(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  let p = particles[i].pos_m;
  if (!(p.w > 0.0)) { return; }
  let gx = ((p.x + 0.5 * L) / L) * nf;
  let gy = ((p.y + 0.5 * L) / L) * nf;
  let gz = ((p.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);
  let wx0 = 1.0 - fx; let wy0 = 1.0 - fy; let wz0 = 1.0 - fz;
  let scale = p.w * 4096.0;

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(wx0, fx);
  let wys = array<f32, 2>(wy0, fy);
  let wzs = array<f32, 2>(wz0, fz);

  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w_i = i32(round(scale * wxs[dx] * wys[dy] * wzs[dz]));
        atomicAdd(&cic_mass_i32[cidx], w_i);
      }
    }
  }
  // Exact cell-local monopole (relative to cell center -> wrap-free self-COM subtraction!)
  let cell_len = L / nf;
  let home_idx = (iz0 * n + iy0) * n + ix0;
  let cx_center = (f32(ix0) + 0.5) * cell_len - 0.5 * L;
  let cy_center = (f32(iy0) + 0.5) * cell_len - 0.5 * L;
  let cz_center = (f32(iz0) + 0.5) * cell_len - 0.5 * L;
  let dx_loc = wrap_delta(p.x - cx_center, L);
  let dy_loc = wrap_delta(p.y - cy_center, L);
  let dz_loc = wrap_delta(p.z - cz_center, L);
  atomicAdd(&sr_cell_accum[home_idx * 4u + 0u], i32(round(p.w * 4096.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 1u], i32(round(p.w * dx_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 2u], i32(round(p.w * dy_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 3u], i32(round(p.w * dz_loc * 2048.0)));
}

@compute @workgroup_size(64)
fn prepare_poisson_rhs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (idx >= total) { return; }
  let m_cell = f32(atomicLoad(&cic_mass_i32[idx])) / 4096.0;
  let delta = (m_cell / max(params.mean_mass_cell, 1.0e-6)) - 1.0;
  fft_grid[idx] = vec2<f32>(params.grav_pref * delta, 0.0);
  force_grid[idx].w = delta;

  let sr_m = f32(atomicLoad(&sr_cell_accum[idx * 4u + 0u])) / 4096.0;
  if (sr_m > 1.0e-6) {
    let inv_m = 1.0 / sr_m;
    let ox = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 1u])) / 2048.0) * inv_m;
    let oy = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 2u])) / 2048.0) * inv_m;
    let oz = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 3u])) / 2048.0) * inv_m;
    sr_cell_nodes[idx] = vec4<f32>(ox, oy, oz, sr_m);
  } else {
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
}

// Live 16-bin GPU radial matter power spectrum P(k) reduction directly from k-space FFT!
// Dispatched with 16 workgroups (one workgroup per logarithmic k-shell), @workgroup_size(256).
@compute @workgroup_size(256)
fn reduce_power_spectrum_pk(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let bin = wid.x;
  if (bin >= PK_BINS) { return; }
  let tid = lid.x;
  let n = params.grid_n;
  let half_n = n >> 1u;
  let total = n * n * n;
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let k_min = dk;
  let k_max = dk * f32(half_n) * 1.7320508;
  let log_span = max(1e-5, log(k_max / k_min));
  let inv_pref2 = 1.0 / max(1e-12, params.grav_pref * params.grav_pref);
  let vol_norm = (params.box_l * params.box_l * params.box_l) / (f32(total) * f32(total));

  var k_sum = 0.0;
  var pk_sum = 0.0;
  var cnt = 0.0;

  var idx = tid;
  loop {
    if (idx >= total) { break; }
    if (idx != 0u) {
      let ix = idx % n;
      let iy = (idx / n) % n;
      let iz = idx / (n * n);
      let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
      let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
      let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
      let k_mag = sqrt(nx * nx + ny * ny + nz * nz) * dk;
      let u = clamp(log(max(k_min, k_mag) / k_min) / log_span, 0.0, 0.99999);
      let b_idx = min(PK_BINS - 1u, u32(u * f32(PK_BINS)));
      if (b_idx == bin) {
        let c = fft_grid[idx];
        let p2 = (c.x * c.x + c.y * c.y) * inv_pref2 * vol_norm;
        k_sum = k_sum + k_mag;
        pk_sum = pk_sum + p2;
        cnt = cnt + 1.0;
      }
    }
    idx = idx + 256u;
  }

  wg_f0[tid] = k_sum;
  wg_f1[tid] = pk_sum;
  wg_f2[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_cnt = wg_f2[0u];
    if (m_cnt > 0.0) {
      telemetry_f32[2u + bin] = vec4<f32>(wg_f0[0u] / m_cnt, wg_f1[0u] / m_cnt, m_cnt, 0.0);
    } else {
      telemetry_f32[2u + bin] = vec4<f32>(0.0);
    }
  }
}

@compute @workgroup_size(64)
fn store_force_x(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].x = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_y(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].y = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_z(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].z = -fft_grid[idx].x;
}

// CIC trilinear force interpolation + Short-Range TreePM (exact self-COM subtraction
// + empty-cell background symmetry) + Remote-Slab Multipole Coupling + Symplectic KDK!
@compute @workgroup_size(64)
fn cic_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let n_i = i32(n);
  let total_cells = n * n * n;
  let L = params.box_l;
  var pt = particles[i];
  if (!(pt.pos_m.w > 0.0)) { return; }

  let gx = ((pt.pos_m.x + 0.5 * L) / L) * nf;
  let gy = ((pt.pos_m.y + 0.5 * L) / L) * nf;
  let gz = ((pt.pos_m.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(1.0 - fx, fx);
  let wys = array<f32, 2>(1.0 - fy, fy);
  let wzs = array<f32, 2>(1.0 - fz, fz);

  var acc = vec3<f32>(0.0);
  var local_delta = 0.0;
  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w = wxs[dx] * wys[dy] * wzs[dz];
        let fg = force_grid[cidx];
        acc = acc + fg.xyz * w;
        local_delta = local_delta + fg.w * w;
      }
    }
  }

  let cell_len = L / nf;
  let g_eff = (params.grav_pref * cell_len * cell_len * cell_len) / (12.566370614 * max(params.mean_mass_cell, 1.0e-6));

  // Hybrid TreePM short-range 3x3x3 cell-multipole correction:
  //   (a) exact self-COM subtraction in home cell, AND
  //   (b) uniform -mean_mass_cell peculiar background at EVERY cell center (including empty voids!)
  if (params.short_range_r_s > 0.0) {
    let r_s = params.short_range_r_s;
    let r_cut = 2.0 * r_s;
    let r_cut2 = r_cut * r_cut;
    let eps2 = (0.55 * cell_len) * (0.55 * cell_len);
    for (var oz: i32 = -1; oz <= 1; oz = oz + 1) {
      let nz = u32(((i32(iz0) + oz) % n_i + n_i) % n_i);
      let cz_c = (f32(nz) + 0.5) * cell_len - 0.5 * L;
      for (var oy: i32 = -1; oy <= 1; oy = oy + 1) {
        let ny = u32(((i32(iy0) + oy) % n_i + n_i) % n_i);
        let cy_c = (f32(ny) + 0.5) * cell_len - 0.5 * L;
        for (var ox: i32 = -1; ox <= 1; ox = ox + 1) {
          let nx = u32(((i32(ix0) + ox) % n_i + n_i) % n_i);
          let cx_c = (f32(nx) + 0.5) * cell_len - 0.5 * L;
          let nidx = (nz * n + ny) * n + nx;
          let node = sr_cell_nodes[nidx];
          let is_home = (ox == 0 && oy == 0 && oz == 0);

          // 1. Positive mass attraction from actual particles in cell (with EXACT self-COM subtraction!)
          if (node.w > 1.0e-6) {
            let eff_m = select(node.w, max(0.0, node.w - pt.pos_m.w), is_home);
            if (eff_m > 1.0e-6) {
              var d_p = vec3<f32>(0.0);
              if (is_home) {
                let self_off = vec3<f32>(
                  wrap_delta(pt.pos_m.x - cx_c, L),
                  wrap_delta(pt.pos_m.y - cy_c, L),
                  wrap_delta(pt.pos_m.z - cz_c, L)
                );
                let other_off = (node.xyz * node.w - self_off * pt.pos_m.w) / eff_m;
                d_p = other_off - self_off;
              } else {
                let com_x = cx_c + node.x;
                let com_y = cy_c + node.y;
                let com_z = cz_c + node.z;
                d_p = vec3<f32>(
                  wrap_delta(com_x - pt.pos_m.x, L),
                  wrap_delta(com_y - pt.pos_m.y, L),
                  wrap_delta(com_z - pt.pos_m.z, L)
                );
              }
              let r2_p = dot(d_p, d_p);
              if (r2_p <= r_cut2 && r2_p > 1.0e-10) {
                let r_p = sqrt(r2_p);
                let sw_p = treepm_short_range_split(r_p, r_s);
                let inv_r3_p = 1.0 / ((r2_p + eps2) * sqrt(r2_p + eps2));
                acc = acc + d_p * (g_eff * eff_m * sw_p * inv_r3_p);
              }
            }
          }

          // 2. Uniform -mean_mass_cell background subtraction at cell center (INCLUDING empty cells!)
          let d_bg = vec3<f32>(
            wrap_delta(cx_c - pt.pos_m.x, L),
            wrap_delta(cy_c - pt.pos_m.y, L),
            wrap_delta(cz_c - pt.pos_m.z, L)
          );
          let r2_bg = dot(d_bg, d_bg);
          if (r2_bg <= r_cut2 && r2_bg > 1.0e-10) {
            let r_bg = sqrt(r2_bg);
            let sw_bg = treepm_short_range_split(r_bg, r_s);
            let inv_r3_bg = 1.0 / ((r2_bg + eps2) * sqrt(r2_bg + eps2));
            acc = acc - d_bg * (g_eff * params.mean_mass_cell * sw_bg * inv_r3_bg);
          }
        }
      }
    }
  }

  // Remote-slab cross-peer multipole gravitational coupling (multi-host PeerCompute!)
  // Direct non-wrapped displacement along slab-partitioned X avoids half-box sign-flip
  // discontinuities while retaining full periodic minimum-image wrapping along Y and Z.
  let n_rem = min(params.remote_tile_count, ${Je}u);
  if (n_rem > 0u) {
    let eps_rem2 = (0.12 * L) * (0.12 * L);
    for (var r = 0u; r < n_rem; r = r + 1u) {
      let rt = sr_cell_nodes[total_cells + r];
      if (rt.w <= 1.0e-6) { continue; }
      let d_r = vec3<f32>(
        rt.x - pt.pos_m.x,
        wrap_delta(rt.y - pt.pos_m.y, L),
        wrap_delta(rt.z - pt.pos_m.z, L)
      );
      let r2_r = dot(d_r, d_r) + eps_rem2;
      let inv_r3_r = 1.0 / (r2_r * sqrt(r2_r));
      acc = acc + d_r * (g_eff * rt.w * inv_r3_r);
    }
  }

  // Canonical comoving Symplectic Kick-Drift-Kick (KDK) in scale factor a:
  //   step 0:  v_half = v_0 + 0.5 * acc_0 * kick_0;  x_1 = x_0 + v_half * drift_0
  //   step s:  v_sync = v_{s-1/2} + 0.5 * acc_s * kick_{s-1}
  //            v_half = v_sync + 0.5 * acc_s * kick_s;  x_{s+1} = x_s + v_half * drift_s
  let a = max(0.01, params.a_scale);
  let h_a = max(0.05, params.h_a);
  let da = params.da;
  let kick_fac = da / (a * a * h_a);
  let a_mid = a + 0.5 * da;
  let drift_fac = da / (a_mid * a_mid * a_mid * h_a);

  let v_sync = select(pt.vel_rho.xyz, pt.vel_rho.xyz + acc * (0.5 * params.prev_kick_fac), params.step_index > 0u);
  let v_half = v_sync + acc * (0.5 * kick_fac);
  let p_new = vec3<f32>(
    wrap_coord(pt.pos_m.x + v_half.x * drift_fac, L),
    wrap_coord(pt.pos_m.y + v_half.y * drift_fac, L),
    wrap_coord(pt.pos_m.z + v_half.z * drift_fac, L)
  );
  let rho_vis = clamp(0.18 + 0.25 * log2(max(1.0, 1.0 + local_delta)), 0.05, 1.0);
  pt.pos_m = vec4<f32>(p_new, pt.pos_m.w);
  pt.vel_rho = vec4<f32>(v_half, rho_vis);
  pt.acc_phi = vec4<f32>(acc, local_delta);
  pt.tag.z = a;
  particles[i] = pt;
}

// Pure IEEE-754 float32 parallel workgroup telemetry reduction (ZERO i32 overflow!)
// Dispatch 2 workgroups of 256 threads:
//   wid.x == 0 -> grid overdensity stats [sum_delta2, max_delta, sum_delta, total]
//   wid.x == 1 -> particle KE & linear momentum [sum_ke, px, py, pz]
@compute @workgroup_size(256)
fn reduce_telemetry_f32(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let tid = lid.x;
  if (wid.x == 0u) {
    let total = params.grid_n * params.grid_n * params.grid_n;
    var s_d2 = 0.0;
    var m_d = -1.0e30;
    var s_d = 0.0;
    var i = tid;
    loop {
      if (i >= total) { break; }
      let d = force_grid[i].w;
      s_d2 = s_d2 + d * d;
      m_d = max(m_d, d);
      s_d = s_d + d;
      i = i + 256u;
    }
    wg_f0[tid] = s_d2;
    wg_f1[tid] = m_d;
    wg_f2[tid] = s_d;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = max(wg_f1[tid], wg_f1[tid + stride]);
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[0u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], f32(total));
    }
  } else if (wid.x == 1u) {
    let n_p = params.particle_count;
    var s_ke = 0.0;
    var px = 0.0;
    var py = 0.0;
    var pz = 0.0;
    var i = tid;
    loop {
      if (i >= n_p) { break; }
      let pt = particles[i];
      let m = pt.pos_m.w;
      let v = pt.vel_rho.xyz;
      s_ke = s_ke + 0.5 * m * dot(v, v);
      px = px + m * v.x;
      py = py + m * v.y;
      pz = pz + m * v.z;
      i = i + 256u;
    }
    wg_f0[tid] = s_ke;
    wg_f1[tid] = px;
    wg_f2[tid] = py;
    wg_f3[tid] = pz;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
        wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[1u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], wg_f3[0u]);
    }
  }
}

// Parallel GPU tile multipole reduction for PeerCompute slab exchange (32-byte readback!)
@compute @workgroup_size(256)
fn reduce_tile_multipole(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n_p = params.particle_count;
  var m_sum = 0.0;
  var mx = 0.0;
  var my = 0.0;
  var mz = 0.0;
  var r2_sum = 0.0;
  var cnt = 0.0;
  var i = tid;
  loop {
    if (i >= n_p) { break; }
    let pm = particles[i].pos_m;
    if (pm.w > 0.0 && pm.x >= params.tile_x_min && pm.x < params.tile_x_max) {
      m_sum = m_sum + pm.w;
      mx = mx + pm.w * pm.x;
      my = my + pm.w * pm.y;
      mz = mz + pm.w * pm.z;
      r2_sum = r2_sum + pm.w * dot(pm.xyz, pm.xyz);
      cnt = cnt + 1.0;
    }
    i = i + 256u;
  }
  wg_f0[tid] = m_sum;
  wg_f1[tid] = mx;
  wg_f2[tid] = my;
  wg_f3[tid] = mz;
  wg_f4[tid] = r2_sum;
  wg_f5[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      wg_f4[tid] = wg_f4[tid] + wg_f4[tid + stride];
      wg_f5[tid] = wg_f5[tid] + wg_f5[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }
  if (tid == 0u) {
    let m_tot = wg_f0[0u];
    if (m_tot > 1.0e-6) {
      let cx = wg_f1[0u] / m_tot;
      let cy = wg_f2[0u] / m_tot;
      let cz = wg_f3[0u] / m_tot;
      // Exact parallel-axis identity: sum m_i |r_i - com|^2 = sum m_i |r_i|^2 - M |com|^2
      let q_trace = max(0.0, wg_f4[0u] - m_tot * (cx * cx + cy * cy + cz * cz));
      telemetry_f32[18u] = vec4<f32>(m_tot, cx, cy, cz);
      telemetry_f32[19u] = vec4<f32>(q_trace, wg_f5[0u], 0.0, 0.0);
    } else {
      telemetry_f32[18u] = vec4<f32>(0.0);
      telemetry_f32[19u] = vec4<f32>(0.0);
    }
  }
}
`,Xe=`
struct ZeldParams {
  n: u32,
  seed: u32,
  axis: u32,
  pad0: u32,
  box_l: f32,
  amplitude: f32,
  k_eq: f32,
  v_pref: f32,
};

@group(0) @binding(0) var<uniform> params: ZeldParams;
@group(0) @binding(1) var<storage, read_write> k_field: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> disp_field: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v * 9u;
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn rand01(h: u32) -> f32 {
  return (f32(h & 0x00ffffffu) + 0.5) / 16777216.0;
}

// Generates Hermitian-symmetric primordial Gaussian random displacement mode Psi_k = i * (k / k^2) * delta_k
@compute @workgroup_size(64)
fn generate_zeldovich_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  if (idx == 0u) {
    k_field[0u] = vec2<f32>(0.0, 0.0);
    return;
  }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  let half_n = n >> 1u;

  // Canonical Hermitian conjugate pairing: (-k) mod N
  let cx = (n - ix) % n;
  let cy = (n - iy) % n;
  let cz = (n - iz) % n;
  let conj_idx = (cz * n + cy) * n + cx;
  let canon_idx = min(idx, conj_idx);
  let is_conj = idx > conj_idx;
  let is_self_conj = idx == conj_idx;

  let h1 = hash_u32(canon_idx * 747796405u + params.seed * 2891336453u + 17u);
  let h2 = hash_u32(h1 + 1013904223u);
  let u1 = max(1e-6, rand01(h1));
  let u2 = rand01(h2);
  let gauss_r = sqrt(-2.0 * log(u1));
  let theta = TWO_PI * u2;
  var delta_re = gauss_r * cos(theta);
  var delta_im = select(gauss_r * sin(theta), 0.0, is_self_conj);
  if (is_conj) { delta_im = -delta_im; }

  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let k_mag = sqrt(k2);
  // Eisenstein-Hu-like primordial matter power spectrum P(k) ~ k / (1 + (k/k_eq)^2)^2
  let ratio = k_mag / max(params.k_eq, 1.0e-6);
  let pk = k_mag / ((1.0 + ratio * ratio) * (1.0 + ratio * ratio));
  // Smooth Nyquist filter so small-scale modes are clean & isotropic
  let k_nyq = f32(half_n) * dk;
  let nyq_win = exp(-2.2 * (k_mag / k_nyq) * (k_mag / k_nyq));
  let amp = params.amplitude * sqrt(pk * nyq_win) * (params.box_l * 0.28) * f32(total);
  let k_comp = select(select(kz, ky, params.axis == 1u), kx, params.axis == 0u);
  // Psi_k = i * (k_comp / k^2) * delta_k -> i * (re + i im) = (-im, re)
  let fac = (k_comp / max(k2, 1.0e-12)) * amp;
  k_field[idx] = vec2<f32>(-delta_im * fac, delta_re * fac);
}

@compute @workgroup_size(64)
fn store_disp_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let total = params.n * params.n * params.n;
  let idx = id.x;
  if (idx >= total) { return; }
  var cur = disp_field[idx];
  let v = k_field[idx].x;
  if (params.axis == 0u) { cur.x = v; }
  else if (params.axis == 1u) { cur.y = v; }
  else { cur.z = v; }
  disp_field[idx] = cur;
}
`;function Ze(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function Qe(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function $e(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=Ze(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/f*2.5,x=N(e,n),S=x.n,w=x.total,E=[C(0,`uniform`),C(1,`storage`),C(2,`storage`)],D=T(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:Xe,entryPoint:`generate_zeldovich_kspace`,bindings:E}),O=T(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:Xe,entryPoint:`store_disp_axis`,bindings:E}),k=e.createBuffer({size:w*16,usage:U.STORAGE|U.COPY_SRC}),A=e.createBuffer({size:w*16,usage:U.MAP_READ|U.COPY_DST}),j=e.createBuffer({size:x.byteLength,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),M=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([S,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,b,v]);let r=e.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(w/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:x.bufferA}},{binding:2,resource:{buffer:k}}]}),a=t.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=x.encodeInverseFrom(t,x.bufferA),s=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:k}}]});a=t.beginComputePass(),a.setPipeline(O.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([t.finish()]),await A.mapAsync(U.MAP_READ);let r=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let a=0;for(let e=0;e<w;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,w)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<w;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/S,_=.5/g,b=new Float32Array(w*2),C=(e,t,n)=>(((n+S)%S*S+(t+S)%S)*S+(e+S)%S)*4;for(let e=0;e<S;e+=1)for(let t=0;t<S;t+=1)for(let n=0;n<S;n+=1){let i=C(n+1,t,e),a=C(n-1,t,e),o=C(n,t+1,e),s=C(n,t-1,e),c=C(n,t,e+1),l=C(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*S+t)*S+n)*2]=g}e.queue.writeBuffer(x.bufferA,0,b),x.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let T=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),E=x.encodeForward(T);T.copyBufferToBuffer(E,0,j,0,x.byteLength);for(let t=0;t<3;t+=1){let r=x.encodePoissonInverseFromKSpace(T,j,{gradAxis:t+1}),i=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:k}}]}),a=T.beginComputePass();a.setPipeline(O.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}T.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([T.finish()]),await A.mapAsync(U.MAP_READ);let N=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let ee=-.42857142857142855*Math.max(.001,h)**(-1/143),P=0;for(let e=0;e<w;e+=1){let t=ee*N[e*4+0],n=ee*N[e*4+1],r=ee*N[e*4+2];N[e*4+0]=t,N[e*4+1]=n,N[e*4+2]=r,P+=t*t+n*n+r*r}let F=Math.sqrt(P/Math.max(1,w)),I=(e,t,n,r)=>{let i=(t+.5*f)/f*S,a=(n+.5*f)/f*S,o=(r+.5*f)/f*S,s=(Math.floor(i)%S+S)%S,c=(Math.floor(a)%S+S)%S,l=(Math.floor(o)%S+S)%S,u=(s+1)%S,d=(c+1)%S,p=(l+1)%S,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((C[t]*S+x[n])*S+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},L=Number(u?.[0])||0,te=Number(u?.[1])||0,R=Number(u?.[2])||0,ne=d*d*d,z=new Float32Array(ne*16),re=0,ie=0,ae=0,oe=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=I(r,a,o,s),l=I(N,a,o,s),u=Qe(a+c[0]+l[0]+L,f),d=Qe(o+c[1]+l[1]+te,f),m=Qe(s+c[2]+l[2]+R,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];re+=h,ie+=g,ae+=_;let b=oe*16;z[b+0]=u,z[b+1]=d,z[b+2]=m,z[b+3]=1,z[b+4]=h,z[b+5]=g,z[b+6]=_,z[b+7]=.28,z[b+12]=+(oe%6==0),z[b+14]=i,oe+=1}re/=ne,ie/=ne,ae/=ne;for(let e=0;e<ne;e+=1)z[e*16+4]-=re,z[e*16+5]-=ie,z[e*16+6]-=ae;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<ne;t+=1){let n=z[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(z.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:ne,data:t,boxLengthMpc:f,aInit:i,rms2Over1:F/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:ne,globalParticleCount:ne,data:z,boxLengthMpc:f,aInit:i,rms2Over1:F/Math.max(1e-9,c)}}finally{x.destroy(),k.destroy(),A.destroy(),j.destroy();for(let e of M)e.destroy()}}function et({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=Ze(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=Qe(i+s+b,f),g=Qe(a+c+x,f),_=Qe(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function tt(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:f=null,initialConditions:p=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let m=p||et({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:f,initialPositionsShift:d}),g=m.particleCount,_=m.globalParticleCount??m.particleCount,v=n,y=v**3,b=N(e,v),x=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`),C(5,`storage`),C(6,`storage`),C(7,`storage`)],S=t=>T(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:Ye,entryPoint:t,bindings:x}),w=S(`clear_grids`),E=S(`cic_deposit`),D=S(`prepare_poisson_rhs`),O=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),A=S(`store_force_y`),j=S(`store_force_z`),M=S(`cic_kick_drift`),ee=S(`reduce_telemetry_f32`),P=S(`reduce_tile_multipole`),F=e.createBuffer({size:64,usage:U.UNIFORM|U.COPY_DST}),I=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,m.data.byteLength),usage:U.VERTEX|U.STORAGE|U.COPY_DST|U.COPY_SRC});m.data.byteLength>0&&e.queue.writeBuffer(I,0,m.data);let L=e.createBuffer({size:y*4,usage:U.STORAGE}),te=e.createBuffer({size:y*16,usage:U.STORAGE}),R=e.createBuffer({size:320,usage:U.STORAGE|U.COPY_SRC}),ne=e.createBuffer({size:320,usage:U.MAP_READ|U.COPY_DST}),z=e.createBuffer({size:32,usage:U.MAP_READ|U.COPY_DST}),re=e.createBuffer({size:y*16,usage:U.STORAGE}),ie=e.createBuffer({size:(y+Je)*16,usage:U.STORAGE|U.COPY_DST}),ae=e.createBuffer({size:b.byteLength,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),oe=t=>e.createBindGroup({layout:w.bindGroupLayout,entries:[F,I,L,t,te,R,re,ie].map((e,t)=>({binding:t,resource:{buffer:e}}))}),se=oe(b.bufferA),ce=oe(b.bufferB),le=oe(ae),ue=e=>e===b.bufferA?se:e===b.bufferB?ce:le,de=r/v,fe=(c*de)**2,pe=l?c*de:0,me=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:fe});let B=i,he=0,ge=0,_e=0,V=1,ve=null,ye={xMin:-.5*r,xMax:.5*r},be=(t=null)=>{let n=t||ye,i=Ze(B,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,B),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,he,_e]),new Float32Array(l,16,12).set([r,B,a,i,o,c,me,pe,ge,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(F,0,l),{hA:i,gravPref:c}};function xe(t=[]){let n=Array.isArray(t)?t.slice(0,Je):[],r=new Float32Array(Je*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return _e=n.length,e.queue.writeBuffer(ie,y*16,r),_e}let Se=Math.ceil(y/64),Ce=Math.max(1,Math.ceil(g/64));async function we({readTelemetry:t=!0}={}){let{hA:n}=be(),i=a/(Math.max(.01,B)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${he}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,se),u.setPipeline(w.pipeline),u.dispatchWorkgroups(Se),g>0&&(u.setPipeline(E.pipeline),u.dispatchWorkgroups(Ce)),u.setPipeline(D.pipeline),u.dispatchWorkgroups(Se),u.end();let d=b.encodeForward(c);c.copyBufferToBuffer(d,0,ae,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,le),u.setPipeline(O.pipeline),u.dispatchWorkgroups(qe),u.end();let f=[k,A,j];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,ae,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,ue(t)),u.setPipeline(f[e-1].pipeline),u.dispatchWorkgroups(Se),u.end()}if(u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,se),g>0&&(u.setPipeline(M.pipeline),u.dispatchWorkgroups(Ce)),u.setPipeline(ee.pipeline),u.dispatchWorkgroups(2),u.end(),t&&c.copyBufferToBuffer(R,0,ne,0,320),e.queue.submit([c.finish()]),V=1,ge=i,B=Math.min(1.5,B+a),he+=1,!t)return null;await ne.mapAsync(U.MAP_READ);let p=new Float32Array(ne.getMappedRange().slice(0,320));ne.unmap();let y=Math.sqrt(Math.max(0,p[0]/Math.max(1,p[3]))),x=p[1],S=p[4],C=[p[5],p[6],p[7]],T=Math.max(0,1/B-1),N=[],P=[],F=[],I=0;for(let e=0;e<qe;e+=1){let t=(2+e)*4,n=Math.round(p[t+2]);n>0&&(N.push(p[t+0]),P.push(p[t+1]),F.push(n),I+=n)}let L=P.length>0?P.slice(0,Math.min(4,P.length)).reduce((e,t)=>e+t,0)/Math.min(4,P.length):0;ve===null&&L>0&&(ve=L);let te=ve>0?Math.sqrt(L/ve):1;return Object.freeze({schema:Ke,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:m.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:V,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:pe,remoteTileCount:_e,stepIndex:he,scaleFactorA:B,redshiftZ:T,hOverH0:Ze(B,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:y,maxOverdensity:x,kineticEnergy:S,momentum:C,powerSpectrumPk:Object.freeze({kBins:Object.freeze(N),pkValues:Object.freeze(P),modeCounts:Object.freeze(F),totalModes:I,lowKPower:L,linearGrowthRatio:te}),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function Te(){if(g===0)return new Float32Array;let t=e.createBuffer({size:m.data.byteLength,usage:U.MAP_READ|U.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(I,0,t,0,m.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(U.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function Ee({xMin:t=-.5*r,xMax:n=.5*r}={}){ye={xMin:Number(t),xMax:Number(n)},be(ye);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,se),a.setPipeline(P.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(R,288,z,0,32),e.queue.submit([i.finish()]),await z.mapAsync(U.MAP_READ);let o=new Float32Array(z.getMappedRange().slice(0,32));return z.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:B,stepIndex:he})}return Object.freeze({schema:Ke,icBackend:m.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:pe,particlesBuffer:I,forceGridBuffer:te,injectRemoteTileMultipoles:xe,step:we,readParticlesSnapshot:Te,readTileMultipoleSummary:Ee,getState:()=>({aScale:B,redshiftZ:Math.max(0,1/B-1),stepIndex:he,submitsPerStep:V,remoteTileCount:_e}),destroy(){b.destroy();for(let e of[F,I,L,te,R,ne,z,re,ie,ae])e.destroy()}})}var nt=27.211386245988,W=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var G=null,rt=null;function it({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*W)),o=Math.log10(Math.max(4e4,.31*t*W)),s=Math.log10(Math.max(8e4,.78*(n+r)*W));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function K(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*nt);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*nt*1.45):t}async function at(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(rt&&!t)return rt;let[n,r,i,a]=await Promise.all([k(e,1,{A:1,maxScf:36}),k(e,2,{A:4,maxScf:36}),k(e,6,{A:12,maxScf:42}),k(e,8,{A:16,maxScf:42})]);return rt=it({iH:K(n,13.6),iHe:K(r,24.59),iC:K(i,11.26),iO:K(a,13.62),backend:`webgpu-gate1-radial-ks`}),rt}function ot(){if(rt)return rt;if(G)return G;let e=o(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=o(2,{gridPointsN:160,maxScf:80,tol:1e-5}),n=o(6,{gridPointsN:160,maxScf:80,tol:1e-5}),r=o(8,{gridPointsN:160,maxScf:80,tol:1e-5});return G=it({iH:Math.max(10,Math.abs(e.totalEnergyHa)*nt),iHe:K(t,24.59),iC:K(n,11.26),iO:K(r,13.62),backend:`host-gate1-radial-ks`}),G}function st(e,t=1,n=null){let r=n||ot(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var ct=`ulg.astrophysics.planetary-interior-webgpu.v1`,lt=66743e-15,ut=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function dt(e,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:o=12e3,degrees:s=[5,5],relativeTolerance:l=.025,maxBisectDepth:u=3,materialIndex:d=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let f=c(),p=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),g=Math.max(p+20,Number(n.thermodynamic.boilingPointK??p*1.5)),v=Math.max(g*2.5,Number(o)),y=f.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:p,boilingPointK:g,ionizationTempK:v,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(v*1.5,Number(o)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let r of y){let i=await t(e,r,(e,t)=>a(n,r.phase,e,t),{degrees:s,relativeTolerance:l,requirePositive:!0,maxDepth:u,propertyName:`densityKgPerM3`,logScale:!0});b.push(...i.polytopes)}let x=m(b,{materialIndex:d});return Object.freeze({schema:_,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var q=`
${p}

struct PlanetParams {
  model_count: u32,
  layer_count: u32,
  max_profile_samples: u32,
  converge_passes: u32,
  surface_pressure_pa: f32,
  radial_step_m: f32,
  max_radius_m: f32,
  g_si: f32,
};

// Layer spec: vec4(cum_mass_frac, temp_k, material_id_f32, pad)
// Model spec: vec4(central_pressure_pa, initial_est_mass_kg, pad0, pad1)
// Model out (3 vec4 per model):
//   [m*3 + 0]: vec4(total_mass_kg, radius_m, moi_factor, status_code)
//              status_code: 1.0 = converged-valid, 2.0 = fail-closed-polytope-out-of-domain, 3.0 = hit-max-radius
//   [m*3 + 1]: vec4(mean_density, surface_gravity, escape_vel, sample_count)
//   [m*3 + 2]: vec4(fail_pressure_pa, fail_temp_k, fail_layer_idx, min_polytope_margin)
@group(0) @binding(0) var<uniform> params: PlanetParams;
@group(0) @binding(1) var<storage, read> atlas_bank: array<f32>;
@group(0) @binding(2) var<storage, read> layer_specs: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> model_specs: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> model_out: array<vec4<f32>>;
// Profile buffer for model 0: 2 vec4 per sample:
//   [s*2 + 0]: vec4(radius_m, pressure_pa, density_kg_m3, mass_enclosed_kg)
//   [s*2 + 1]: vec4(gravity_m_s2, layer_idx_f32, phase_code, hit_flag)
@group(0) @binding(5) var<storage, read_write> profile_out: array<vec4<f32>>;

fn pick_layer_idx(mass_frac: f32) -> u32 {
  let n = params.layer_count;
  for (var i = 0u; i < n; i = i + 1u) {
    if (mass_frac <= layer_specs[i].x || i + 1u == n) {
      return i;
    }
  }
  return max(1u, n) - 1u;
}

@compute @workgroup_size(64)
fn solve_planetary_hydrostatic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let mid = gid.x;
  if (mid >= params.model_count) { return; }

  let mspec = model_specs[mid];
  let p_center = mspec.x;
  var est_mass = max(1.0e20, mspec.y);
  let dr = max(2000.0, params.radial_step_m);
  let max_steps = u32(min(50000.0, ceil(params.max_radius_m / dr)));

  var final_mass = 0.0;
  var final_radius = 0.0;
  var final_moi = 0.0;
  var status_code = 1.0;
  var fail_p = 0.0;
  var fail_t = 0.0;
  var fail_layer = -1.0;
  var min_margin = 1.0e30;
  var sample_count = 0u;

  let passes = max(1u, params.converge_passes);
  for (var iter_pass = 0u; iter_pass < passes; iter_pass = iter_pass + 1u) {
    var r = 0.0;
    var m = 0.0;
    var p_cur = p_center;
    var I_moi_scaled = 0.0;
    var failed = false;
    var cur_samples = 0u;
    var pass_min_margin = 1.0e30;
    let is_last = (iter_pass + 1u == passes);

    for (var s = 0u; s < max_steps; s = s + 1u) {
      if (p_cur <= params.surface_pressure_pa || r >= params.max_radius_m) {
        break;
      }
      let lidx = pick_layer_idx(m / max(1.0e20, est_mass));
      let lspec = layer_specs[lidx];
      let temp_k = lspec.y;
      let mat_id = lspec.z;

      // Inline Gate 2 Convex Polytope Atlas evaluation (strictly fail-closed!)
      let eval_res = eval_polytope_atlas_bank_2d(&atlas_bank, mat_id, temp_k, p_cur);
      if (eval_res.w < 0.5 || !(eval_res.x > 0.0)) {
        failed = true;
        status_code = 2.0;
        fail_p = p_cur;
        fail_t = temp_k;
        fail_layer = f32(lidx);
        break;
      }
      let rho = eval_res.x;
      pass_min_margin = min(pass_min_margin, eval_res.y);

      // Midpoint RK2 radial hydrostatic step
      let r_mid = r + 0.5 * dr;
      let dM = 12.566370614 * r_mid * r_mid * rho * dr;
      let m_mid = m + 0.5 * dM;
      let g = select(0.0, (params.g_si * m_mid) / (r_mid * r_mid), r_mid > 1.0);
      let dP = -rho * g * dr;

      if (is_last && mid == 0u && cur_samples < params.max_profile_samples && ((s & 1u) == 0u || s < 16u)) {
        profile_out[cur_samples * 2u + 0u] = vec4<f32>(r, p_cur, rho, m);
        profile_out[cur_samples * 2u + 1u] = vec4<f32>(g, f32(lidx), eval_res.z, eval_res.w);
        cur_samples = cur_samples + 1u;
      }

      m = m + dM;
      // Scale into (Mm)^2 * (Yg) so f32 never overflows (>3.4e38) for planetary/substellar bodies
      let r_mm = r_mid * 1.0e-6;
      let dm_yg = dM * 1.0e-24;
      I_moi_scaled = I_moi_scaled + (2.0 / 3.0) * r_mm * r_mm * dm_yg;
      p_cur = p_cur + dP;
      r = r + dr;
    }

    if (failed) {
      final_mass = m;
      final_radius = r;
      final_moi = I_moi_scaled;
      sample_count = cur_samples;
      min_margin = -1.0;
      break;
    }
    status_code = select(1.0, 3.0, r >= params.max_radius_m && p_cur > params.surface_pressure_pa);
    final_mass = m;
    final_radius = r;
    final_moi = I_moi_scaled;
    est_mass = max(1.0e20, m);
    min_margin = pass_min_margin;
    sample_count = cur_samples;
  }

  let vol = (4.0 / 3.0) * 3.14159265359 * final_radius * final_radius * final_radius;
  let mean_rho = final_mass / max(1.0, vol);
  let surf_g = (params.g_si * final_mass) / max(1.0, final_radius * final_radius);
  let v_esc = sqrt((2.0 * params.g_si * final_mass) / max(1.0, final_radius));
  let r_final_mm = final_radius * 1.0e-6;
  let m_final_yg = final_mass * 1.0e-24;
  let moi_factor = final_moi / max(1.0e-20, m_final_yg * r_final_mm * r_final_mm);

  model_out[mid * 3u + 0u] = vec4<f32>(final_mass, final_radius, moi_factor, status_code);
  model_out[mid * 3u + 1u] = vec4<f32>(mean_rho, surf_g, v_esc, f32(sample_count));
  model_out[mid * 3u + 2u] = vec4<f32>(fail_p, fail_t, fail_layer, min_margin);
}
`;async function ft(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:i=2e4,maxRadiusM:a=15e7,convergePasses:o=3,maxProfileSamples:s=256,autoFitMaxPressurePa:c=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let l=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=m(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await dt(e,n.bundle,{maxPressurePa:c,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);l.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let u=g(l.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),d=l.reduce((e,t)=>e+t.massFractionTarget,0)||1,f=new Float32Array(l.length*4),p=0;for(let e=0;e<l.length;e+=1)p+=l[e].massFractionTarget/d,f.set([p,l[e].tempK,l[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,l.length,s,o]),new Float32Array(v,16,4).set([Number(n),Number(i),Number(a),lt]);let y=T(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:q,entryPoint:`solve_planetary_hydrostatic`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`read-only-storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`storage`)]}),b=e.createBuffer({size:32,usage:ut.UNIFORM|ut.COPY_DST}),x=e.createBuffer({size:Math.max(64,u.data.byteLength),usage:ut.STORAGE|ut.COPY_DST}),S=e.createBuffer({size:Math.max(16,f.byteLength),usage:ut.STORAGE|ut.COPY_DST}),w=e.createBuffer({size:16,usage:ut.STORAGE|ut.COPY_DST}),E=e.createBuffer({size:48,usage:ut.STORAGE|ut.COPY_SRC}),D=e.createBuffer({size:s*32,usage:ut.STORAGE|ut.COPY_SRC}),O=e.createBuffer({size:48,usage:ut.MAP_READ|ut.COPY_DST}),k=e.createBuffer({size:s*32,usage:ut.MAP_READ|ut.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,u.data),e.queue.writeBuffer(S,0,f),e.queue.writeBuffer(w,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,w,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,s*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(ut.MAP_READ),k.mapAsync(ut.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,s*32));O.unmap(),k.unmap();let c=Math.round(a[3]),d=c===2,p=c===1,m=Math.min(s,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(l.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:l[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let C=Number(l[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:ct,backend:`webgpu-polytope-atlas`,valid:p,failClosed:d,reason:d?`polytope-out-of-domain`:c===3?`max-radius-reached`:`ok`,failureState:d?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:l[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:C,dynamoCapable:p&&C>1e4&&t>1e10,layerCount:l.length,profile:Object.freeze(g),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,w,E,D,O,k])e.destroy()}}var pt=`ulg.astrophysics.stellar-nuclear-network.v1`,mt=`ulg.astrophysics.stellar-nuclear-webgpu.v1`,ht=`ulg.astrophysics.lane-emden-webgpu.v1`,J=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),gt=-.7823334099999784,_t=1602176634e-22,vt=167262192369e-38,yt=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),bt=null;function xt(){if(bt)return bt;let e=yt.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+s(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+s(t,n)*r,0),c=r-i,l=o-a+c*gt,u=Number(e.neutrinoLossMeV||0),d=l>0?Math.max(0,l-u):l,f=Math.abs(d)*_t/(t*vt);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:c,ignitionTempK:e.ignitionTempK,qValueMeV:l,qValueTotalMeV:l,qValueThermalMeV:d,neutrinoLossMeV:u,qValueJPerKg:f,exothermic:l>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return bt=Object.freeze({schema:pt,channels:Object.freeze(e),byId:t,accuracyTier:h.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),bt}function St(){let{byId:e}=xt();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var Ct=`
struct NuclearNetParams {
  sample_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  pad3: f32,
};

struct NuclearSampleIn {
  // [rhoKgM3, temperatureK, xH, xHe]
  state0: vec4<f32>,
  // [xZ, dtS, pad, pad]
  state1: vec4<f32>,
};

struct NuclearSampleOut {
  // [epsPpWPerKg, epsCnoWPerKg, eps3aWPerKg, epsPhotodisWPerKg]
  rates: vec4<f32>,
  // [nextXH, nextXHe, nextXZ, energyDepositedJPerKg]
  burn: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: NuclearNetParams;
@group(0) @binding(1) var<storage, read> samples_in: array<NuclearSampleIn>;
@group(0) @binding(2) var<storage, read_write> samples_out: array<NuclearSampleOut>;

@compute @workgroup_size(64)
fn eval_stellar_nuclear_network(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.sample_count) { return; }
  let s0 = samples_in[i].state0;
  let s1 = samples_in[i].state1;
  let rho = max(0.0, s0.x);
  let temp_k = max(1.0, s0.y);
  let sum_x = max(1e-12, s0.z + s0.w + s1.x);
  var xH = max(0.0, s0.z / sum_x);
  var xHe = max(0.0, s0.w / sum_x);
  var xZ = max(0.0, s1.x / sum_x);
  let dt_s = max(0.0, s1.y);

  let rho_cgs = rho * 1e-3;
  let t6 = temp_k * 1e-6;
  let t8 = temp_k * 1e-8;
  let t9 = temp_k * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.5 && xH > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 85.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 5.0 && xH > 1e-6 && xZ > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.35 && xHe > 1e-6) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 85.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  var e_dep_j_per_kg = 0.0;
  if (dt_s > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_s) / max(1.0, params.q_pp_j_per_kg));
    let dY = min(xHe + dX, (eps_3a * dt_s) / max(1.0, params.q_3a_j_per_kg));
    let dZ_photo = min(xZ + dY, (eps_photodis * dt_s) / max(1.0, params.q_photodis_j_per_kg));
    e_dep_j_per_kg = dX * params.q_pp_j_per_kg + dY * params.q_3a_j_per_kg - dZ_photo * params.q_photodis_j_per_kg;
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY + dZ_photo);
    xZ = max(0.0, xZ + dY - dZ_photo);
    let norm = max(1e-12, xH + xHe + xZ);
    xH = xH / norm;
    xHe = xHe / norm;
    xZ = xZ / norm;
  }

  samples_out[i] = NuclearSampleOut(
    vec4<f32>(eps_pp, eps_cno, eps_3a, eps_photodis),
    vec4<f32>(xH, xHe, xZ, e_dep_j_per_kg)
  );
}
`;async function wt(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice`);let n=Array.isArray(t)?t:[];if(n.length===0)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires at least one state sample`);let r=St(),i=new Float32Array(n.length*8);for(let e=0;e<n.length;e+=1){let t=n[e];i.set([Number(t.rhoKgM3??15e4),Number(t.temperatureK??15e6),Number(t.xH??.74),Number(t.xHe??.25),Number(t.xZ??t.xMetals??.01),Number(t.dtS??0),0,0],e*8)}let a=T(e,{cacheKey:`ulg-stellar-nuclear-network.v1`,label:`ulg-stellar-nuclear-network`,code:Ct,entryPoint:`eval_stellar_nuclear_network`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n.length,0,0,0]),new Float32Array(o,16,4).set([r.ppJPerKgH,r.tripleAlphaJPerKgHe,r.fePhotodisJPerKgFe,0]);let s=e.createBuffer({size:32,usage:J.UNIFORM|J.COPY_DST}),c=e.createBuffer({size:i.byteLength,usage:J.STORAGE|J.COPY_DST}),l=e.createBuffer({size:i.byteLength,usage:J.STORAGE|J.COPY_SRC}),u=e.createBuffer({size:i.byteLength,usage:J.MAP_READ|J.COPY_DST});try{e.queue.writeBuffer(s,0,o),e.queue.writeBuffer(c,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[s,c,l].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-stellar-nuclear-network`}),f=d.beginComputePass();f.setPipeline(a.pipeline),f.setBindGroup(0,t),f.dispatchWorkgroups(Math.ceil(n.length/64)),f.end(),d.copyBufferToBuffer(l,0,u,0,i.byteLength),e.queue.submit([d.finish()]),await u.mapAsync(J.MAP_READ);let p=new Float32Array(u.getMappedRange().slice(0,i.byteLength));u.unmap();let m=[];for(let e=0;e<n.length;e+=1){let t=e*8;m.push(Object.freeze({epsPpWPerKg:p[t+0],epsCnoWPerKg:p[t+1],eps3aWPerKg:p[t+2],epsPhotodisWPerKg:p[t+3],epsTotalWPerKg:p[t+0]+p[t+1]+p[t+2],nextMassFractions:Object.freeze({xH:p[t+4],xHe:p[t+5],xZ:p[t+6]}),energyDepositedJPerKg:p[t+7]}))}return Object.freeze({schema:mt,backend:`webgpu`,burnConstants:r,results:Object.freeze(m),provenance:Object.freeze({status:`gate1-nuclear-webgpu-derived`,scientificValidation:!1})})}finally{for(let e of[s,c,l,u])e.destroy()}}var Tt=`
struct LaneEmdenParams {
  count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
  d_xi: f32,
  max_xi: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<uniform> params: LaneEmdenParams;
@group(0) @binding(1) var<storage, read> indices_n: array<f32>;
// Output vec4(polytropeIndexN, xi1, massIntegral, centralToMeanDensityRatio)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>;

fn le_deriv(x: f32, th: f32, dth: f32, poly_n: f32) -> vec2<f32> {
  let th_safe = max(0.0, th);
  let th_n = select(0.0, pow(th_safe, poly_n), th_safe > 0.0 || poly_n == 0.0);
  return vec2<f32>(dth, -(2.0 / x) * dth - th_n);
}

@compute @workgroup_size(64)
fn solve_lane_emden_rk4(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  let poly_n = indices_n[i];
  let dxi = params.d_xi;
  var xi = dxi;
  let xi2 = xi * xi;
  var theta = 1.0 - xi2 / 6.0 + (poly_n * xi2 * xi2) / 120.0;
  var dtheta = -xi / 3.0 + (poly_n * xi2 * xi) / 30.0;

  for (var step = 0u; step < params.max_steps; step = step + 1u) {
    if (theta <= 0.0 || xi >= params.max_xi) { break; }
    let k1 = le_deriv(xi, theta, dtheta, poly_n);
    let k2 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k1.x, dtheta + 0.5 * dxi * k1.y, poly_n);
    let k3 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k2.x, dtheta + 0.5 * dxi * k2.y, poly_n);
    let k4 = le_deriv(xi + dxi, theta + dxi * k3.x, dtheta + dxi * k3.y, poly_n);
    let next_theta = theta + (dxi / 6.0) * (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x);
    let next_dtheta = dtheta + (dxi / 6.0) * (k1.y + 2.0 * k2.y + 2.0 * k3.y + k4.y);
    if (next_theta <= 0.0) {
      let frac = theta / max(1e-12, theta - next_theta);
      xi = xi + frac * dxi;
      dtheta = dtheta + frac * (next_dtheta - dtheta);
      theta = 0.0;
      break;
    }
    xi = xi + dxi;
    theta = next_theta;
    dtheta = next_dtheta;
  }

  let mass_int = -(xi * xi * dtheta);
  let rho_ratio = -(xi / min(-1e-12, 3.0 * dtheta));
  results[i] = vec4<f32>(poly_n, xi, mass_int, rho_ratio);
}
`;async function Et(e,t=[1.5,3],{dXi:n=.002,maxXi:r=25}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice`);let i=Float32Array.from(Array.isArray(t)?t:[t]);if(i.length===0)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires at least one polytrope index`);let a=T(e,{cacheKey:`ulg-lane-emden-rk4.v1`,label:`ulg-lane-emden-rk4`,code:Tt,entryPoint:`solve_lane_emden_rk4`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=Math.ceil(r/Math.max(1e-5,n))+4,s=new ArrayBuffer(32);new Uint32Array(s,0,4).set([i.length,o,0,0]),new Float32Array(s,16,4).set([n,r,0,0]);let c=e.createBuffer({size:32,usage:J.UNIFORM|J.COPY_DST}),l=e.createBuffer({size:Math.max(16,i.byteLength),usage:J.STORAGE|J.COPY_DST}),u=e.createBuffer({size:i.length*16,usage:J.STORAGE|J.COPY_SRC}),d=e.createBuffer({size:i.length*16,usage:J.MAP_READ|J.COPY_DST});try{e.queue.writeBuffer(c,0,s),e.queue.writeBuffer(l,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[c,l,u].map((e,t)=>({binding:t,resource:{buffer:e}}))}),n=e.createCommandEncoder({label:`ulg-lane-emden-rk4`}),r=n.beginComputePass();r.setPipeline(a.pipeline),r.setBindGroup(0,t),r.dispatchWorkgroups(Math.ceil(i.length/64)),r.end(),n.copyBufferToBuffer(u,0,d,0,i.length*16),e.queue.submit([n.finish()]),await d.mapAsync(J.MAP_READ);let o=new Float32Array(d.getMappedRange().slice(0,i.length*16));d.unmap();let f=[];for(let e=0;e<i.length;e+=1){let t=e*4;f.push(Object.freeze({polytropeIndexN:o[t+0],xi1:o[t+1],massIntegral:o[t+2],centralToMeanDensityRatio:o[t+3],g7Advisory:!0}))}return Object.freeze({schema:ht,backend:`webgpu`,solutions:Object.freeze(f)})}finally{for(let e of[c,l,u,d])e.destroy()}}var Dt=`peercompute.ulg.hydrogen-stellar-closure.v1`,Ot=`peercompute.ulg.stellar-closure-table-abi.v1`,kt=1380649e-29,At=16605390666e-37,jt=167262192369e-38,Mt=91093837015e-41,Nt=1054571817e-43,Pt=299792458,Y=66743e-15,Ft=4*5.670374419e-8/Pt,X=1602176634e-28,It=27.211386245988,Lt=198847e25,Rt=St();Rt.ppThermalMeV;var zt=Rt.ppJPerKgH;Rt.tripleAlphaMeV;var Bt=Rt.tripleAlphaJPerKgHe;Rt.fePhotodisMeV;var Vt=null;async function Ht(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Vt?.backend===`webgpu`&&!t)return Vt;let n=await k(e,1,{A:1,maxScf:45}),i=Number(n.totalEnergyHa??-.5),a=Number(n.homoEnergyHa??n.orbitals?.[0]?.energyHa??-.5),o=Math.max(11,Math.min(15,Math.abs(i)*It)),s=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),c=.05,l=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),p=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-c]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),m=2*i,h=Math.max(.08,m-s.totalEnergyHa)*It,g=Math.max(.1,(l.totalEnergyHa-2*s.totalEnergyHa+p.totalEnergyHa)/(c*c)),_=Math.sqrt(g/(.5*1836.152673))*It*X/kt,v=d(15e4/jt*r**3),y=f(v);return Vt=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:a,hIonizationEv:o,hIonizationTempK:o*X/kt,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:m,h2DiradicalStretched:1,h2DissociationEv:h,h2DissociationTempK:h*X/kt,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Vt}function Ut({forceRecompute:t=!1}={}){if(Vt&&!t)return Vt;let n=o(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),i=n.orbitals?.[0]?.energyHa??-.5,a=Math.max(11,Math.min(15,Math.abs(n.totalEnergyHa)*It)),s=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),c=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),l=Math.max(.08,c.totalEnergyHa-s.totalEnergyHa)*It,u=.04,p=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-u]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(u*u)),_=Math.sqrt(g/(.5*1836.152673))*It*X/kt,v=d(15e4/jt*r**3),y=f(v);return Vt=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:n.totalEnergyHa,h1sOrbitalEnergyHa:i,hIonizationEv:a,hIonizationTempK:a*X/kt,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:c.totalEnergyHa,h2DiradicalStretched:c.diradicalCharacter,h2DissociationEv:l,h2DissociationTempK:l*X/kt,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Vt}function Wt(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/jt);if(n<=0)return 0;let r=Nt*Math.cbrt(3*Math.PI*Math.PI*n)/(Mt*Pt),i=r*r,a=Mt**4*Pt**5/(24*Math.PI*Math.PI*Nt**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function Gt(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function Kt({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||Ut(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/jt,m=s*d/(4*jt),h=s*f/(16*jt),g=2*Math.PI*jt*kt*c/(2*Math.PI*Nt)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*Mt*kt*c/(2*Math.PI*Nt)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/At/A,M=A*kt*c,N=Ft/3*c**4,ee=Wt(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),P=Gt(s),F=M+N+ee+P,I=ee/Math.max(1e-30,F),L=N/Math.max(1e-30,F),te=P/Math.max(1e-30,F),R=4*b*(1-b),ne=4*w*(1-w),z=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,re=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),ie=re*(1-L)+4/3*L,ae=Math.max(1.06,ie-.5*R-.48*ne-z)*(1-te)+2.75*te,oe=.1*(1/(1+Math.exp((c-1600)/180))),se=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),ce=4e21*(1+u)*(f+.001)*s*c**-3.5,le=.02*(1+u)*Math.max(.01,w),ue=Math.max(1e-4,Math.min(1e5,oe+se+ce+le)),de=M/(Math.max(.15,re-1)*s)+3*N/s,fe=(1-b)*.5*u*o.h2DissociationEv*X/jt,pe=w*u*o.hIonizationEv*X/jt,me=de+fe+pe;return{schema:Dt,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:ae,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:ee,pressureNucSatPa:P,pressureTotalPa:F,pDegFraction:I,pRadFraction:L,pNucFraction:te,soundSpeedMPerS:Math.sqrt(Math.max(1,ae*F/s)),kappaM2PerKg:ue,specificEnergyJPerKg:me,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function qt({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/zt),E=Math.min(d+T,x*a/Bt),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*Y*e*Lt/(Pt*Pt),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Jt(e){let t=E(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function Yt({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function Xt({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||Ut(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=Kt({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:Ot,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function Zt({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=Xt({anchors:t?await Ht(t):Ut()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:Ot,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Qt=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,$t=128,en=32,tn=en*en*en,nn=tn*8,rn=`
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
  reset_peaks: u32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  theta2: f32,
  log_rho_min: f32,
  log_rho_max: f32,
  log_t_min: f32,
  log_t_max: f32,
  base_log_rho: f32,
  ref_rho_sim: f32,
  burn_timescale_s: f32,
  time_accel: f32,
  t_scale_k: f32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  u_scale_j_per_kg: f32,
  pad_f0: f32,
  pad_f1: f32,
};

@group(0) @binding(0) var<storage, read> src_particles: array<HydroParticle>;
@group(0) @binding(1) var<storage, read_write> dst_particles: array<HydroParticle>;
// Uniform full-domain 32^3 compressible hydro accumulators (32768 * 8 atomic<i32>)
@group(0) @binding(2) var<storage, read_write> hydro_accum: array<atomic<i32>>;
// Canonical SchroederScaleAtlas multipole gravity output:
//   [0..count-1]: vec4(ax, ay, az, grav_phi), [count]: vec4(R_com, M_tot), [count+1]: vec4(V_com, 0)
@group(0) @binding(3) var<storage, read> ss_acc_phi: array<vec4<f32>>;
// Uniform full-domain 32^3 hydro grid: 2 vec4 per cell:
//   [c*2 + 0]: vec4(mass_cell, press_cell, cell_com_rel_x, cell_com_rel_y)
//   [c*2 + 1]: vec4(cell_vx_rel, cell_vy_rel, cell_vz_rel, cell_com_rel_z)
@group(0) @binding(4) var<storage, read_write> hydro_grid: array<vec4<f32>>;
// Pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
@group(0) @binding(5) var<storage, read> eos_table: array<EosClosureCell>;
// 16 atomic<u32> global diagnostic telemetry slots (64 B)
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: HydroParams;

const HYDRO_DIM: u32 = ${en}u;
const HYDRO_COUNT: u32 = ${tn}u;

const Q_MASS: f32 = 65536.0;
const Q_MOM: f32 = 4096.0;
const Q_PRESS: f32 = 64.0;

fn clamp_cell32(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(31u, u32(u * 32.0));
}

fn cell_idx32(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 1024u) + (cy * 32u) + cx;
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
  if (i < 16u) {
    let is_peak_slot = (i <= 2u || i == 14u);
    if (!is_peak_slot || params.reset_peaks != 0u) {
      atomicStore(&telemetry[i], 0u);
    }
  }
  if (i < HYDRO_COUNT) {
    let hb = i * 8u;
    atomicStore(&hydro_accum[hb + 0u], 0);
    atomicStore(&hydro_accum[hb + 1u], 0);
    atomicStore(&hydro_accum[hb + 2u], 0);
    atomicStore(&hydro_accum[hb + 3u], 0);
    atomicStore(&hydro_accum[hb + 4u], 0);
    atomicStore(&hydro_accum[hb + 5u], 0);
    atomicStore(&hydro_accum[hb + 6u], 0);
    atomicStore(&hydro_accum[hb + 7u], 0);
    hydro_grid[i * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[i * 2u + 1u] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn sgh_deposit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = src_particles[i];
  let pm = p.pos_mass;
  if (!(pm.w > 0.0)) { return; }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let rel_pos = pm.xyz - com_pos;
  let rel_vel = p.vel_smooth.xyz - com_vel;

  // Uniform full-domain 32^3 smooth CIC trilinear compressible hydrodynamics grid deposition
  // (eliminates NGP cell-face discontinuities & grid-waffle clumping while conserving exact mass/momentum/pressure!)
  let logT = clamp(p.thermo.x, 1.0, 9.6);
  let logRho = clamp(p.thermo.y, -18.0, 11.0);
  let eos = sample_eos_table(logRho, logT);
  let mu_g = max(0.45, eos.eos0.x);
  let gamma_g = clamp(eos.eos0.y, 1.05, 2.75);
  let p_deg = clamp(eos.eos1.x, 0.0, 1.0);
  let log10_kappa_dep = eos.eos1.y;
  let p_nuc = clamp(eos.eos1.z, 0.0, 1.0);
  let p_rad = clamp(eos.eos1.w, 0.0, 1.0);

  let temp_k = pow(10.0, logT);
  let u_therm = temp_k / (params.t_scale_k * mu_g);
  let opt_trap_dep = clamp((logRho + log10_kappa_dep + 6.5) / 7.5, 0.0, 1.0);
  let gamma_soft = clamp((gamma_g - 1.02) / 0.65, 0.16, 2.8);
  let cs2_thermal = clamp((gamma_g - 1.0) * u_therm, 0.0, 320.0) * gamma_soft;
  let cs2_rad = p_rad * opt_trap_dep * opt_trap_dep * 14.0;
  let cs2_deg = p_deg * 28.0;
  let cs2_nuc = p_nuc * 1600.0;
  let press_cell = pm.w * (cs2_thermal + cs2_rad + cs2_deg + cs2_nuc);

  let u_dep = clamp(
    ((rel_pos + vec3<f32>(params.box_half)) / (2.0 * params.box_half)) * 32.0 - vec3<f32>(0.5),
    vec3<f32>(0.0),
    vec3<f32>(30.999)
  );
  let ix0 = u32(floor(u_dep.x));
  let iy0 = u32(floor(u_dep.y));
  let iz0 = u32(floor(u_dep.z));
  let fx = u_dep.x - f32(ix0);
  let fy = u_dep.y - f32(iy0);
  let fz = u_dep.z - f32(iz0);

  for (var dz: u32 = 0u; dz < 2u; dz = dz + 1u) {
    let wz = select(1.0 - fz, fz, dz == 1u);
    for (var dy: u32 = 0u; dy < 2u; dy = dy + 1u) {
      let wyz = wz * select(1.0 - fy, fy, dy == 1u);
      for (var dx: u32 = 0u; dx < 2u; dx = dx + 1u) {
        let w = wyz * select(1.0 - fx, fx, dx == 1u);
        if (w > 1e-5) {
          let hb = cell_idx32(ix0 + dx, iy0 + dy, iz0 + dz) * 8u;
          let wm = pm.w * w;
          atomicAdd(&hydro_accum[hb + 0u], i32(round(clamp(wm * Q_MASS, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 1u], i32(round(clamp(press_cell * w * Q_PRESS, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 2u], i32(round(clamp(wm * rel_pos.x * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 3u], i32(round(clamp(wm * rel_pos.y * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 4u], i32(round(clamp(wm * rel_pos.z * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 5u], i32(round(clamp(wm * rel_vel.x * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 6u], i32(round(clamp(wm * rel_vel.y * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 7u], i32(round(clamp(wm * rel_vel.z * Q_MOM, -1e8, 1e8))));
        }
      }
    }
  }
}

@compute @workgroup_size(64)
fn sgh_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= HYDRO_COUNT) { return; }
  let hb = cell * 8u;
  let m_h = f32(atomicLoad(&hydro_accum[hb + 0u])) / Q_MASS;
  if (m_h > 1e-6) {
    let inv_m = 1.0 / m_h;
    let p_sum = f32(atomicLoad(&hydro_accum[hb + 1u])) / Q_PRESS;
    let cx = (f32(atomicLoad(&hydro_accum[hb + 2u])) / Q_MOM) * inv_m;
    let cy = (f32(atomicLoad(&hydro_accum[hb + 3u])) / Q_MOM) * inv_m;
    let cz = (f32(atomicLoad(&hydro_accum[hb + 4u])) / Q_MOM) * inv_m;
    let vx = (f32(atomicLoad(&hydro_accum[hb + 5u])) / Q_MOM) * inv_m;
    let vy = (f32(atomicLoad(&hydro_accum[hb + 6u])) / Q_MOM) * inv_m;
    let vz = (f32(atomicLoad(&hydro_accum[hb + 7u])) / Q_MOM) * inv_m;
    hydro_grid[cell * 2u + 0u] = vec4<f32>(m_h, p_sum, cx, cy);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(vx, vy, vz, cz);
  } else {
    hydro_grid[cell * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(0.0);
  }
}

fn read_hydro_a(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 0u];
}

fn read_hydro_b(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 1u];
}

fn sample_hydro_trilin_mp(u_in: vec3<f32>) -> vec2<f32> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  let a000 = read_hydro_a(ix, iy, iz).xy;
  let a100 = read_hydro_a(ix + 1, iy, iz).xy;
  let a010 = read_hydro_a(ix, iy + 1, iz).xy;
  let a110 = read_hydro_a(ix + 1, iy + 1, iz).xy;
  let a001 = read_hydro_a(ix, iy, iz + 1).xy;
  let a101 = read_hydro_a(ix + 1, iy, iz + 1).xy;
  let a011 = read_hydro_a(ix, iy + 1, iz + 1).xy;
  let a111 = read_hydro_a(ix + 1, iy + 1, iz + 1).xy;

  let c00 = mix(a000, a100, fx);
  let c10 = mix(a010, a110, fx);
  let c01 = mix(a001, a101, fx);
  let c11 = mix(a011, a111, fx);
  let c0 = mix(c00, c10, fy);
  let c1 = mix(c01, c11, fy);
  return mix(c0, c1, fz);
}

fn sample_hydro_trilin_grad_p(u_in: vec3<f32>, cell_w: f32) -> vec4<f32> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  let a000 = read_hydro_a(ix, iy, iz).xy;
  let a100 = read_hydro_a(ix + 1, iy, iz).xy;
  let a010 = read_hydro_a(ix, iy + 1, iz).xy;
  let a110 = read_hydro_a(ix + 1, iy + 1, iz).xy;
  let a001 = read_hydro_a(ix, iy, iz + 1).xy;
  let a101 = read_hydro_a(ix + 1, iy, iz + 1).xy;
  let a011 = read_hydro_a(ix, iy + 1, iz + 1).xy;
  let a111 = read_hydro_a(ix + 1, iy + 1, iz + 1).xy;

  let inv_w = 1.0 / cell_w;
  let dpdx = mix(mix(a100.y - a000.y, a110.y - a010.y, fy), mix(a101.y - a001.y, a111.y - a011.y, fy), fz) * inv_w;
  let dpdy = mix(mix(a010.y - a000.y, a110.y - a100.y, fx), mix(a011.y - a001.y, a111.y - a101.y, fx), fz) * inv_w;
  let dpdz = mix(mix(a001.y - a000.y, a101.y - a100.y, fx), mix(a011.y - a010.y, a111.y - a110.y, fx), fy) * inv_w;
  // Symmetric 8-corner cell mass average prevents vacuum-edge blowup while matching exact local density in interior
  let m_avg = 0.125 * (a000.x + a100.x + a010.x + a110.x + a001.x + a101.x + a011.x + a111.x);
  return vec4<f32>(dpdx, dpdy, dpdz, m_avg);
}

fn sample_hydro_trilin_com_vel(u_in: vec3<f32>, fallback_r: vec3<f32>, fallback_v: vec3<f32>) -> array<vec3<f32>, 2> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  var r_sum = vec3<f32>(0.0);
  var v_sum = vec3<f32>(0.0);
  var w_sum = 0.0;
  for (var dz: i32 = 0; dz < 2; dz = dz + 1) {
    let wz = select(1.0 - fz, fz, dz == 1);
    for (var dy: i32 = 0; dy < 2; dy = dy + 1) {
      let wyz = wz * select(1.0 - fy, fy, dy == 1);
      for (var dx: i32 = 0; dx < 2; dx = dx + 1) {
        let w = wyz * select(1.0 - fx, fx, dx == 1);
        let a = read_hydro_a(ix + dx, iy + dy, iz + dz);
        if (a.x > 1e-6) {
          let b = read_hydro_b(ix + dx, iy + dy, iz + dz);
          let wm = w * a.x;
          r_sum = r_sum + vec3<f32>(a.z, a.w, b.w) * wm;
          v_sum = v_sum + b.xyz * wm;
          w_sum = w_sum + wm;
        }
      }
    }
  }
  let inv_w = 1.0 / max(1e-6, w_sum);
  return array<vec3<f32>, 2>(
    select(fallback_r, r_sum * inv_w, w_sum > 1e-6),
    select(fallback_v, v_sum * inv_w, w_sum > 1e-6)
  );
}

fn sample_hydro_trilin_v(u_in: vec3<f32>, fallback_v: vec3<f32>) -> vec3<f32> {
  return sample_hydro_trilin_com_vel(u_in, vec3<f32>(0.0), fallback_v)[1];
}

@compute @workgroup_size(64)
fn sgh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let p = src_particles[idx];
  let self_pm = p.pos_mass;
  let self_vs = p.vel_smooth;
  if (!(self_pm.w > 0.0)) {
    dst_particles[idx] = p;
    return;
  }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let self_rel = self_pm.xyz - com_pos;
  let self_vrel_sys = self_vs.xyz - com_vel;

  // 1. Canonical SchroederScaleAtlas multipole gravity acceleration & potential |Phi_i|
  let grav_sample = ss_acc_phi[idx];
  let acc_grav = grav_sample.xyz;
  let grav_phi = grav_sample.w;

  // 2. Smooth CIC trilinear full-domain 32^3 hydro stencil (ZERO origin-centered inner grid,
  //    ZERO NGP cell-face discontinuities or Cartesian grid-waffle clumping!)
  let cell_w = (2.0 * params.box_half) / 32.0;
  let u_vec = clamp(
    ((self_rel + vec3<f32>(params.box_half)) / (2.0 * params.box_half)) * 32.0 - vec3<f32>(0.5),
    vec3<f32>(0.0),
    vec3<f32>(30.999)
  );
  let mp_here = sample_hydro_trilin_mp(u_vec);
  let grad_p_m = sample_hydro_trilin_grad_p(u_vec, cell_w);

  let m_local = max(1e-5, mp_here.x);
  // Smooth 3D CIC sub-cell peak density recovery
  let local_rho_sim = max(self_pm.w * 2.0, mp_here.x * 4.5);

  let com_vel_trilin = sample_hydro_trilin_com_vel(u_vec, self_rel, self_vrel_sys);
  let cell_com_rel = com_vel_trilin[0];
  let cell_vel_rel = com_vel_trilin[1];
  let r_cell_rel = self_rel - cell_com_rel;
  let v_cell_rel = self_vrel_sys - cell_vel_rel;

  let vx_p = sample_hydro_trilin_v(u_vec + vec3<f32>(1.0, 0.0, 0.0), cell_vel_rel).x;
  let vx_m = sample_hydro_trilin_v(u_vec - vec3<f32>(1.0, 0.0, 0.0), cell_vel_rel).x;
  let vy_p = sample_hydro_trilin_v(u_vec + vec3<f32>(0.0, 1.0, 0.0), cell_vel_rel).y;
  let vy_m = sample_hydro_trilin_v(u_vec - vec3<f32>(0.0, 1.0, 0.0), cell_vel_rel).y;
  let vz_p = sample_hydro_trilin_v(u_vec + vec3<f32>(0.0, 0.0, 1.0), cell_vel_rel).z;
  let vz_m = sample_hydro_trilin_v(u_vec - vec3<f32>(0.0, 0.0, 1.0), cell_vel_rel).z;
  let div_v_grid = ((vx_p - vx_m) + (vy_p - vy_m) + (vz_p - vz_m)) / (2.0 * cell_w);
  let div_v_sub = dot(v_cell_rel, r_cell_rel) / (dot(r_cell_rel, r_cell_rel) + 0.16 * cell_w * cell_w);
  let div_v = clamp(0.65 * div_v_grid + 0.35 * div_v_sub, -6.0, 6.0);

  let cs2_local = select(0.0, mp_here.y / m_local, mp_here.x > 1e-6);
  // Exact 1-cell analytical trilinear CIC pressure gradient -(grad P)/rho (eliminates odd-even checkerboard!)
  let rho_eff = max(self_pm.w * 2.5, 0.55 * mp_here.x + 0.45 * grad_p_m.w);
  let acc_press_grad = (-grad_p_m.xyz / rho_eff) * 0.58;
  // Smooth sub-cell isotropic pressure cushion: identically 0 in resolved hydrostatic envelopes
  // (cs2_local <= 8.0), engaging smoothly only when a collapsing core compresses below grid-cell
  // resolution (protostellar core & nuclear-saturation bounce) to prevent sub-cell shock focus!
  var acc_press_sub = vec3<f32>(0.0);
  let sub_engage = smoothstep(8.0, 22.0, cs2_local);
  if (sub_engage > 0.001) {
    let sub_k_max = select(0.32, 0.72, cs2_local > 600.0) / max(1e-4, params.dt * params.dt);
    let sub_k = min(cs2_local / (0.52 * cell_w * cell_w), sub_k_max) * sub_engage;
    acc_press_sub = r_cell_rel * sub_k;
    let sub_mag = length(acc_press_sub);
    let sub_acc_cap = select(min(140.0, (sqrt(max(0.0, cs2_local)) + 6.0) / max(0.02, params.dt * 1.6)), 900.0, cs2_local > 600.0);
    if (sub_mag > sub_acc_cap) {
      acc_press_sub = acc_press_sub * (sub_acc_cap / sub_mag);
    }
  }

  // 3. Local Jeans sub-grid physical density scaling from local_rho_sim & local |Phi_i|
  let prev_logT = clamp(p.thermo.x, 1.0, 9.6);
  let prev_logRho = clamp(p.thermo.y, -18.0, 10.8);
  let rho_ratio = max(1e-3, local_rho_sim / max(1e-4, params.ref_rho_sim));
  let log10_rho_ratio = log2(rho_ratio) * 0.30103;
  let phi_overburden = clamp(log2(max(1.0, grav_phi / 16.0)) * 0.30103 * 3.15, 0.0, 6.8);
  let target_logRho = clamp(
    params.base_log_rho + 6.35 * log10_rho_ratio + phi_overburden,
    -17.8,
    10.6
  );
  let logRho = mix(prev_logRho, target_logRho, min(1.0, params.dt * 12.0));

  // 4. Query pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
  let cell_eos = sample_eos_table(logRho, prev_logT);
  let mu_gas = max(0.45, cell_eos.eos0.x);
  let gamma_eff = clamp(cell_eos.eos0.y, 1.05, 2.75);
  let fMol = clamp(cell_eos.eos0.z, 0.0, 1.0);
  let xIon = clamp(cell_eos.eos0.w, 0.0, 1.0);
  let pDeg_frac = clamp(cell_eos.eos1.x, 0.0, 1.0);
  let log10_kappa = cell_eos.eos1.y;
  let pNuc_frac = clamp(cell_eos.eos1.z, 0.0, 1.0);
  let pRad_frac = clamp(cell_eos.eos1.w, 0.0, 1.0);

  // 5. General Gamow-window thermonuclear reaction network using Gate 1 Q-values
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
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  let eps_exo = eps_pp + eps_cno + eps_3a;
  let log10_eps = log2(eps_exo + 1e-30) * 0.30103;

  // 6. Exact nucleon-conserving nuclear transmutation & conservative Gate 1 Q * dX energy release
  let dt_burn = params.dt * params.burn_timescale_s * params.time_accel;
  var dX_burned = 0.0;
  var dY_burned = 0.0;
  var dZ_photo = 0.0;
  if (eps_exo > 1e-7 && dt_burn > 0.0) {
    dX_burned = min(xH, ((eps_pp + eps_cno) * dt_burn) / max(1.0, params.q_pp_j_per_kg));
    dY_burned = min(xHe + dX_burned, (eps_3a * dt_burn) / max(1.0, params.q_3a_j_per_kg));
    xH = max(0.0, xH - dX_burned);
    xHe = max(0.0, xHe + dX_burned - dY_burned);
    xZ = max(0.0, xZ + dY_burned);
    let x_sum = max(1e-6, xH + xHe + xZ);
    xH = xH / x_sum;
    xHe = xHe / x_sum;
    xZ = xZ / x_sum;
  }
  if (eps_photodis > 1.0 && dt_burn > 0.0) {
    dZ_photo = min(xZ, (eps_photodis * dt_burn) / max(1.0, params.q_photodis_j_per_kg));
  }

  // 7. True First-Law Specific Internal Energy Conservation (exact Q * dX nuclear heating!)
  let dt_eff = params.dt * params.time_accel;
  let u_prev = tempK / (params.t_scale_k * mu_gas);
  let gamma_m1 = clamp(gamma_eff - 1.0, 0.06, 0.90);

  let is_compressing = div_v_grid < -0.04 && cs2_local < 900.0;
  let is_hot_core = cs2_local > 24.0 && cs2_local < 600.0;
  let damp_local = select(select(0.994, 0.962, is_hot_core), 0.925, is_compressing);
  let v_rel2 = dot(v_cell_rel, v_cell_rel);
  let ke_dissipated = 0.5 * (1.0 - damp_local * damp_local) * v_rel2;
  let optical_trap = clamp((logRho + log10_kappa + 6.5) / 7.5, 0.0, 1.0);

  let du_pdv = gamma_m1 * u_prev * clamp(-div_v, -6.0, 6.0) * params.dt;
  let du_visc = ke_dissipated * (0.35 + 0.65 * optical_trap);
  // Conservative nuclear specific-energy deposition from Gate 1 Q-values (J/kg -> dimensionless u):
  let e_nuc_j_per_kg = dX_burned * params.q_pp_j_per_kg + dY_burned * params.q_3a_j_per_kg;
  let e_endo_j_per_kg = dZ_photo * params.q_photodis_j_per_kg;
  let u_norm_j_per_kg = max(1e6, params.u_scale_j_per_kg);
  let du_nuc = clamp(e_nuc_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, 18.0 * dt_eff);
  let du_endo = clamp(e_endo_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, u_prev * 0.65);

  let thin_cool = (1.0 - optical_trap * 0.94) * max(0.0, u_prev - 3.5e-5) * 1.15 * params.dt;
  let thick_cool = optical_trap * (u_prev * 0.06 + 0.0005 * u_prev * u_prev / (1.0 + 0.003 * u_prev)) * params.dt;
  let du_rad = thin_cool + thick_cool;

  let u_next = max(2.0e-5, u_prev + du_pdv + du_visc + du_nuc - du_endo - du_rad);
  let next_temp_k = clamp(u_next * params.t_scale_k * mu_gas, 14.0, 3.5e9);
  let next_logT = clamp(log2(next_temp_k) * 0.30103, 1.15, 9.55);

  // 8. General Hydrodynamic Equations of Motion (100% translation- & multi-body-invariant):
  //    a_total = a_grav + (-grad P / rho) + a_sub_cell_pressure
  //    (gamma_soft is already encoded symmetrically in cell cs2 inside sgh_deposit so
  //     inter-cell face forces obey Newton's 3rd Law identically!)
  let acc_press_total = acc_press_grad + acc_press_sub;
  let acc_total = acc_grav + acc_press_total;

  var vel = com_vel + cell_vel_rel + v_cell_rel * damp_local + acc_total * params.dt;
  let v_rel_next = vel - com_vel;
  let spd_rel = length(v_rel_next);
  let v_cap = 42.0;
  if (spd_rel > v_cap) {
    vel = com_vel + v_rel_next * (v_cap / spd_rel);
  }
  var pos = self_pm.xyz + vel * params.dt;

  // Soft COM-relative outer domain confinement ONLY for bound non-escaping gas at domain edge
  let next_rel = pos - com_pos;
  let r_rel_box = length(next_rel);
  if (r_rel_box > params.box_half - 0.45 && spd_rel < 14.0) {
    pos = com_pos + next_rel * ((params.box_half - 0.45) / r_rel_box);
    vel = com_vel + (vel - com_vel) * 0.72;
  }

  dst_particles[idx] = HydroParticle(
    vec4<f32>(pos, self_pm.w),
    vec4<f32>(vel, self_vs.w),
    vec4<f32>(next_logT, logRho, xH, log10_eps),
    vec4<f32>(fMol, xIon, xHe, xZ)
  );

  // 9. 64-byte atomic global diagnostic telemetry reduction (purely physical & translation-invariant!)
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
  if (logRho > -3.0) {
    atomicAdd(&telemetry[10u], 1u);
    atomicAdd(&telemetry[11u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[12u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[15u], u32(clamp(gamma_eff * 1000.0, 0.0, 3000.0)));
  }
  let v_out = select(0.0, dot(vel - com_vel, next_rel / max(0.25, r_rel_box)), r_rel_box > 0.6);
  if (v_out > 6.5) {
    atomicAdd(&telemetry[13u], 1u);
  }
  if (pNuc_frac > 0.08) {
    atomicAdd(&telemetry[14u], 1u);
  }
}
`;function an(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=Kt({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=qt({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=Yt({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=Jt(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function on({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,rCellFactor:o=.075,baseLogRho:s=-16.2,refRhoSim:c=.08,burnTimescaleS:l=42e13,tScaleK:u=78e4,label:d=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let f=Float32Array.from(t),p=f.length/16,m=n||Xt({nRho:28,nTemp:40});function h(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let g=h(f),_=0,v=0,y=!1,b=!1;function x(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<p;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/p*1e3),c[12]=Math.round(i/p*1e3),c[15]=1667,an(c,p,g,!1)}let S=x(f),E=Math.max(64,f.byteLength),D=[e.createBuffer({label:`${d}-p0`,size:E,usage:172}),e.createBuffer({label:`${d}-p1`,size:E,usage:172})],O=me(e,{maxCount:p,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:o,label:`${d}-ss-atlas`}),k=St(),A=e.createBuffer({label:`${d}-hydro-accum`,size:nn*4,usage:$t}),j=e.createBuffer({label:`${d}-hydro-grid`,size:tn*2*16,usage:$t}),M=e.createBuffer({label:`${d}-eos-table`,size:m.data.byteLength,usage:136}),N=e.createBuffer({label:`${d}-telemetry`,size:64,usage:132}),ee=e.createBuffer({label:`${d}-telemetry-staging`,size:64,usage:9}),P=e.createBuffer({label:`${d}-params`,size:96,usage:72}),F=e.createBuffer({label:`${d}-body-staging`,size:E,usage:9});e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f),e.queue.writeBuffer(M,0,m.data);let I=[C(0,`read-only-storage`),C(1,`storage`),C(2,`storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`read-only-storage`),C(6,`storage`),C(7,`uniform`)],L=t=>T(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v26-cic-grad-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:rn,entryPoint:t,bindings:I}),te={clear:L(`sgh_clear`),deposit:L(`sgh_deposit`),finalize:L(`sgh_finalize`),integrate:L(`sgh_integrate`)},R=(t,n,r)=>w(e,{layout:te.integrate.bindGroupLayout,label:`${d}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:O.accPhiBuffer}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}},{binding:6,resource:{buffer:N}},{binding:7,resource:{buffer:P}}]}),ne=[R(D[0],D[1],0),R(D[1],D[0],1)],z=0,re=!1,ie=!1,ae=!0;async function oe(){if(!D||!F||ie||b)return f;ie=!0;try{let t=e.createCommandEncoder({label:`${d}-readback`});t.copyBufferToBuffer(D[z],0,F,0,f.byteLength),e.queue.submit([t.finish()]),await F.mapAsync(1),f.set(new Float32Array(F.getMappedRange())),F.unmap()}finally{ie=!1}return f}async function se({dt:t=.018,timeAccel:n=1,readTelemetry:o=!0}={}){if(b||!D)return S;let f=Math.max(.25,Math.min(25,Number(n)||1)),h=Math.max(.004,Math.min(.028,Number(t)||.018)),x=1380649e-29/167262192369e-38*1.5*u,C=new ArrayBuffer(96),w=new Uint32Array(C),T=new Float32Array(C);w[0]=p,w[1]=m.nRho,w[2]=m.nTemp,w[3]=+!!ae,T[4]=h,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=m.logRhoMin,T[10]=m.logRhoMax,T[11]=m.logTempMin,T[12]=m.logTempMax,T[13]=s,T[14]=c,T[15]=l,T[16]=f,T[17]=u,T[18]=k.ppJPerKgH,T[19]=k.tripleAlphaJPerKgHe,T[20]=k.fePhotodisJPerKgFe,T[21]=x,e.queue.writeBuffer(P,0,C),O.writeParams({count:p,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let E=z,A=1-z,j=ne[E],M=Math.ceil(p/64),F=Math.ceil(tn/64),I=e.createCommandEncoder({label:`${d}-step-${_}`}),L=I.beginComputePass({label:`${d}-pass`});O.encodeIntoPass(L,{srcBuffer:D[E],count:p}),L.setPipeline(te.clear.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(F),L.setPipeline(te.deposit.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.setPipeline(te.finalize.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(F),L.setPipeline(te.integrate.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.end();let R=o&&!re;if(R&&I.copyBufferToBuffer(N,0,ee,0,64),ae=R,e.queue.submit([I.finish()]),z=A,_+=1,v+=h*f*.35,R){re=!0;try{await ee.mapAsync(1);let e=new Uint32Array(ee.getMappedRange().slice(0));ee.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=15e7&&(y=!0),S=an(e,p,g,y)}finally{re=!1}}return S}function ce(t){return f=Float32Array.from(t),g=h(f),_=0,v=0,y=!1,z=0,ae=!0,S=x(f),D&&(e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f)),S}function le(){b||(b=!0,D?.[0]?.destroy(),D?.[1]?.destroy(),O.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),ee.destroy(),P.destroy(),F.destroy(),D=null)}return{schema:Qt,get count(){return p},get totalMassSolar(){return g},get stepIndex(){return _},get simTimeMyr(){return v},get backend(){return`webgpu`},get gravityMode(){return O.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return k},get closureTable(){return m},get anchors(){return m.anchors},getTelemetry:()=>S,getBodies:()=>f,getResidentBuffer:()=>D?D[z]:null,readbackBodies:oe,step:se,resetBodies:ce,dispose:le}}var sn=Object.freeze({id:`main-sequence-star`,label:`Hydrostatic Main-Sequence Star (1.0 M☉)`,shortLabel:`1 M☉ Active Star`,description:`Hydrostatic Lane-Emden convective 1.0 M☉ G2V star in nuclear-thermal equilibrium with differential rotation driving an emergent 3D convective dynamo.`,totalMassSolar:1,initialTempK:15e6,initialLog10Rho:5.15,angularMomentum:.36,cloudRadius:4,geometry:`lane-emden-star`}),cn=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function ln(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Z({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=t===`main-sequence-star`?sn:cn[t]||cn[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=ln(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0,C=null,w=null,T=null,E=null,D=.74,O=.25,k=.01;if(a.geometry===`lane-emden-star`){let e=.5;for(let t=0;t<24;t+=1){let t=d(),n=t*t*Math.max(0,1-t*t)**1.5;if(d()*.19<=n){e=t;break}}let t=.12+e*(a.cloudRadius-.12),n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*o*Math.cos(s),i=t*n,v=t*o*Math.sin(s);let c=(.48-n*n*.14)*(.78+.35*Math.exp(-e*1.4)),l=Math.max(0,(e-.56)/.44),u=Math.sin(s*6+n*4)*Math.cos(e*8)*l*.18;y=-v*c+r/t*u+f()*.03,b=i/t*u+f()*.03,x=r*c+v/t*u+f()*.03;let p=Math.max(.002,1-e*e*.996),m=Math.max(5800,5800+(a.initialTempK-5800)*p),h=10**(-3.6+(a.initialLog10Rho- -3.6)*p**.72);C=Math.log10(m),w=Math.log10(h),T=0,E=e<.92?1:.45;let g=.22*Math.exp(-e*e*8);D=.72-g,O=.26+g,k=.02}else if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let A=Math.hypot(r-S,i,v),j=Math.exp(-A*A/12),M=w??g+j*1,N=C??h+j*.1,ee=.32+.04*Math.min(6,A);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=ee,s[t+8]=N,s[t+9]=M,s[t+10]=D,s[t+11]=C!=null&&C>6.8?-1.5:-30,s[t+12]=T??.998,s[t+13]=E??0,s[t+14]=O,s[t+15]=k}return s}var un=`ulg.astrophysics.galactic-cic-pm-webgpu.v1`,Q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),dn=`
struct Body {
  pos_mass: vec4<f32>,   // x, y, z, mass
  vel_pop: vec4<f32>,    // vx, vy, vz, popTag (-1 = dark matter halo, >=0 = visible star/HII)
};

struct PmParams {
  count: u32,
  grid_n: u32,
  smbh_idx_b: u32,       // Optional 2nd SMBH index for binary galaxy mergers (0 = single galaxy)
  step_index: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  smbh_soft2: f32,
  mean_rho: f32,
  inv_dv: f32,
};

@group(0) @binding(0) var<uniform> params: PmParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<Body>;
@group(0) @binding(2) var<storage, read_write> rho_accum: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// Stored gravitational potential Phi(x, y, z) copied from FFT output for trilinear -grad(Phi)!
@group(0) @binding(4) var<storage, read_write> phi_grid: array<f32>;

const Q_RHO: f32 = 16384.0;

fn wrap_cell(c: i32, n: i32) -> u32 {
  return u32(((c % n) + n) % n);
}

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = wrap_cell(x, n);
  let wy = wrap_cell(y, n);
  let wz = wrap_cell(z, n);
  return (wz * u32(n) + wy) * u32(n) + wx;
}

// 1. Half-step symplectic Drift: x(t + dt/2) = x(t) + 0.5 * dt * v(t)
@compute @workgroup_size(64)
fn pm_drift_half(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }
  b.pos_mass = vec4<f32>(b.pos_mass.xyz + b.vel_pop.xyz * (0.5 * params.dt), b.pos_mass.w);
  bodies[i] = b;
}

// 2. Clear quantized density accumulator
@compute @workgroup_size(64)
fn pm_clear_rho(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  atomicStore(&rho_accum[i], 0);
}

// 3. Smooth Trilinear Cloud-in-Cell (CIC) Mass Deposition (skips point-mass SMBH anchors
//    whose exact softened 1/r^2 gravity is evaluated directly without mesh blurring!)
@compute @workgroup_size(64)
fn pm_deposit_cic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  if (i == 0u || (params.smbh_idx_b > 0u && i == params.smbh_idx_b)) { return; }
  let pm = bodies[i].pos_mass;
  if (!(pm.w > 0.0)) { return; }

  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let g = ((pm.xyz + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  // Ignore rare escaped outliers far outside the oversized box
  if (abs(pm.x) > half * 0.94 || abs(pm.y) > half * 0.94 || abs(pm.z) > half * 0.94) { return; }
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let w0 = vec3<f32>(1.0) - f;
  let m_q = pm.w * Q_RHO;

  atomicAdd(&rho_accum[cidx(i0.x,     i0.y,     i0.z,     n)], i32(round(m_q * w0.x * w0.y * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y,     i0.z,     n)], i32(round(m_q * f.x  * w0.y * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y + 1, i0.z,     n)], i32(round(m_q * w0.x * f.y  * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y + 1, i0.z,     n)], i32(round(m_q * f.x  * f.y  * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y,     i0.z + 1, n)], i32(round(m_q * w0.x * w0.y * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y,     i0.z + 1, n)], i32(round(m_q * f.x  * w0.y * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y + 1, i0.z + 1, n)], i32(round(m_q * w0.x * f.y  * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)], i32(round(m_q * f.x  * f.y  * f.z)));
}

// 4. Pack 4*pi*G*(rho - rho_bar) into Gate 0B 3D-FFT complex buffer
@compute @workgroup_size(64)
fn pm_pack_fft_rhs(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let mass_cell = f32(atomicLoad(&rho_accum[i])) / Q_RHO;
  let rho = mass_cell * params.inv_dv;
  let rhs = 12.566370614359172 * params.gravity_g * (rho - params.mean_rho);
  fft_grid[i] = vec2<f32>(rhs, 0.0);
}

// 5. Copy solved real gravitational potential Phi(x) into phi_grid
@compute @workgroup_size(64)
fn pm_store_phi(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  phi_grid[i] = fft_grid[i].x;
}

fn sample_neg_grad_phi(ix: i32, iy: i32, iz: i32, n: i32, inv2dx: f32) -> vec3<f32> {
  let gx = (phi_grid[cidx(ix + 1, iy, iz, n)] - phi_grid[cidx(ix - 1, iy, iz, n)]) * inv2dx;
  let gy = (phi_grid[cidx(ix, iy + 1, iz, n)] - phi_grid[cidx(ix, iy - 1, iz, n)]) * inv2dx;
  let gz = (phi_grid[cidx(ix, iy, iz + 1, n)] - phi_grid[cidx(ix, iy, iz - 1, n)]) * inv2dx;
  return vec3<f32>(-gx, -gy, -gz);
}

// 6. Symplectic Full-Step Kick + Second Half-Step Drift (exact Velocity-Verlet DKD!)
@compute @workgroup_size(64)
fn pm_kick_and_drift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }

  let pos = b.pos_mass.xyz;
  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let inv2dx = 0.5 / params.dx;

  var acc = vec3<f32>(0.0);

  // Smooth trilinear CIC interpolation of mesh gravity -grad(Phi)
  if (abs(pos.x) < half * 0.90 && abs(pos.y) < half * 0.90 && abs(pos.z) < half * 0.90) {
    let g = ((pos + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
    let i0 = vec3<i32>(floor(g));
    let f = fract(g);
    let a000 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z,     n, inv2dx);
    let a100 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z,     n, inv2dx);
    let a010 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z,     n, inv2dx);
    let a110 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z,     n, inv2dx);
    let a001 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z + 1, n, inv2dx);
    let a101 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z + 1, n, inv2dx);
    let a011 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z + 1, n, inv2dx);
    let a111 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z + 1, n, inv2dx);
    acc = mix(
      mix(mix(a000, a100, f.x), mix(a010, a110, f.x), f.y),
      mix(mix(a001, a101, f.x), mix(a011, a111, f.x), f.y),
      f.z
    );
  } else {
    // Smooth distant monopole fallback outside box edge
    let r2 = dot(pos, pos) + params.softening2;
    let inv_r3 = 1.0 / (r2 * sqrt(r2));
    acc = -pos * (params.gravity_g * params.mean_rho * (params.box_size * params.box_size * params.box_size) * inv_r3);
  }

  // Exact direct softened gravity from central SMBH anchor(s) (eliminates inner mesh blurring!)
  if (i != 0u) {
    let bh0 = bodies[0u].pos_mass;
    if (bh0.w > 0.0) {
      let d0 = bh0.xyz - pos;
      let r2 = dot(d0, d0) + params.smbh_soft2;
      acc = acc + d0 * (params.gravity_g * bh0.w / (r2 * sqrt(r2)));
    }
  }
  if (params.smbh_idx_b > 0u && i != params.smbh_idx_b) {
    let bh1 = bodies[params.smbh_idx_b].pos_mass;
    if (bh1.w > 0.0) {
      let d1 = bh1.xyz - pos;
      let r2 = dot(d1, d1) + params.smbh_soft2;
      acc = acc + d1 * (params.gravity_g * bh1.w / (r2 * sqrt(r2)));
    }
  }

  let vel_next = b.vel_pop.xyz + acc * params.dt;
  let pos_next = pos + vel_next * (0.5 * params.dt);
  bodies[i] = Body(vec4<f32>(pos_next, b.pos_mass.w), vec4<f32>(vel_next, b.vel_pop.w));
}

// 7. Exact Initial Circular/Virial Equilibrium Calibration in the ACTUAL GPU CIC-PM + SMBH Potential!
//    Measures the exact live GPU centripetal acceleration at every particle's position on step 0
//    and rescales azimuthal/virial speed so rotating disks match the finite-grid + SMBH potential
//    with 100% precision (zero spurious radial expansion or collapse!).
@compute @workgroup_size(64)
fn pm_calibrate_equilibrium(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count || i == 0u || (params.smbh_idx_b > 0u && i == params.smbh_idx_b)) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }

  let bh0 = bodies[0u].pos_mass;
  let pos = b.pos_mass.xyz;
  let rel = pos - bh0.xyz;
  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let inv2dx = 0.5 / params.dx;

  var acc = vec3<f32>(0.0);
  if (abs(pos.x) < half * 0.90 && abs(pos.y) < half * 0.90 && abs(pos.z) < half * 0.90) {
    let g = ((pos + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
    let i0 = vec3<i32>(floor(g));
    let f = fract(g);
    let a000 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z,     n, inv2dx);
    let a100 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z,     n, inv2dx);
    let a010 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z,     n, inv2dx);
    let a110 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z,     n, inv2dx);
    let a001 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z + 1, n, inv2dx);
    let a101 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z + 1, n, inv2dx);
    let a011 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z + 1, n, inv2dx);
    let a111 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z + 1, n, inv2dx);
    acc = mix(
      mix(mix(a000, a100, f.x), mix(a010, a110, f.x), f.y),
      mix(mix(a001, a101, f.x), mix(a011, a111, f.x), f.y),
      f.z
    );
  }
  if (bh0.w > 0.0) {
    let d0 = bh0.xyz - pos;
    let r2 = dot(d0, d0) + params.smbh_soft2;
    acc = acc + d0 * (params.gravity_g * bh0.w / (r2 * sqrt(r2)));
  }

  let r_xz = length(rel.xz);
  let r_3d = length(rel);
  if (r_3d < 0.15) { return; }
  let a_in_3d = max(0.0, -dot(acc, rel / r_3d));
  let v_circ_exact = sqrt(r_3d * a_in_3d);

  let v = b.vel_pop.xyz;
  let pop = b.vel_pop.w;
  if (pop < -0.5) {
    // Dark-matter halo: rescale isotropic velocity to actual GPU virial speed
    let v_mag = length(v);
    if (v_mag > 1e-4) {
      let target_scale = clamp((v_circ_exact * 0.58) / max(0.4, v_mag * 0.72), 0.45, 1.15);
      b.vel_pop = vec4<f32>(v * target_scale, pop);
    }
  } else if (r_xz > 0.25) {
    // Visible disk & bulge stars: decompose into azimuthal + radial + vertical relative to disk plane
    let r_hat = vec2<f32>(rel.x / r_xz, rel.z / r_xz);
    let t_hat = vec2<f32>(-r_hat.y, r_hat.x);
    let a_in_xz = max(0.0, -(acc.x * r_hat.x + acc.z * r_hat.y));
    let vc_disk = sqrt(r_xz * a_in_xz);
    let v_tan = v.x * t_hat.x + v.z * t_hat.y;
    let v_rad = v.x * r_hat.x + v.z * r_hat.y;
    let abs_vt = abs(v_tan);
    if (abs_vt > 0.2) {
      let sgn_t = select(-1.0, 1.0, v_tan >= 0.0);
      // Preserve fractional spin (bulge slower than disk) while locking disk stars strictly to vc_disk!
      let is_bulge = pop < 0.28 && r_xz < 2.2;
      let goal_vt = select(vc_disk * 0.985, min(abs_vt, vc_disk * 0.68), is_bulge);
      let ratio = clamp(goal_vt / abs_vt, 0.35, 1.15);
      let new_vt = sgn_t * goal_vt;
      let new_vr = v_rad * min(1.0, ratio);
      let new_vy = v.y * min(1.0, ratio);
      b.vel_pop = vec4<f32>(
        r_hat.x * new_vr + t_hat.x * new_vt,
        new_vy,
        r_hat.y * new_vr + t_hat.y * new_vt,
        pop
      );
    }
  }
  bodies[i] = b;
}
`;function fn({device:e=null,initialBodies:t,gridN:n=32,boxSize:r=48,secondSmbhIndex:i=0,smbhSoftening:a=.72,label:o=`ulg-galactic-cic-pm`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createGalacticParticleMeshEngineWebGpu requires a live WebGPU GPUDevice`);let s=Float32Array.from(t),c=Math.floor(s.length/8),l=Math.max(16,Math.min(64,Math.trunc(n))),u=l*l*l,d=r/l,f=1/(d*d*d),p=0;for(let e=0;e<c;e+=1)e===0||i>0&&e===i||(p+=Math.max(0,s[e*8+3]));let m=p/(r*r*r),h=N(e,l);h.writeAxisPoissonParams({boxLength:r,smoothR2:(.55*d)**2});let g=Math.max(32,s.byteLength),_=e.createBuffer({label:`${o}-bodies`,size:g,usage:Q.STORAGE|Q.VERTEX|Q.COPY_DST|Q.COPY_SRC}),v=e.createBuffer({label:`${o}-rho`,size:u*4,usage:Q.STORAGE}),y=e.createBuffer({label:`${o}-phi`,size:u*4,usage:Q.STORAGE}),b=e.createBuffer({label:`${o}-params`,size:48,usage:Q.UNIFORM|Q.COPY_DST}),x=e.createBuffer({label:`${o}-staging`,size:g,usage:Q.MAP_READ|Q.COPY_DST});e.queue.writeBuffer(_,0,s);let S=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`)],E=t=>T(e,{cacheKey:`ulg-galactic-pm-${t}.v1`,label:`${o}-${t}`,code:dn,entryPoint:t,bindings:S}),D=E(`pm_drift_half`),O=E(`pm_clear_rho`),k=E(`pm_deposit_cic`),A=E(`pm_pack_fft_rhs`),j=E(`pm_store_phi`),M=E(`pm_kick_and_drift`),ee=E(`pm_calibrate_equilibrium`),P=(t,n)=>w(e,{layout:M.bindGroupLayout,label:`${o}-bg-${n}`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:t}},{binding:4,resource:{buffer:y}}]}),F=P(h.bufferA,`a`),I=P(h.bufferB,`b`),L=0,te=!1,R=!1,ne=Math.ceil(c/64),z=Math.ceil(u/64);async function re(){if(R||te||x.mapState!==`unmapped`)return s;te=!0;try{let t=e.createCommandEncoder({label:`${o}-readback`});t.copyBufferToBuffer(_,0,x,0,g),e.queue.submit([t.finish()]),await x.mapAsync(Q.MAP_READ),R||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!R&&e?.name!==`AbortError`)throw e}finally{te=!1}return s}async function ie({gravity:t=1,softening:n=.35}={}){if(R||i>0)return;let s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([c,l,i,L]),new Float32Array(s,16,8).set([r,d,.004,t,n*n,a*a,m,f]),e.queue.writeBuffer(b,0,s);let u=e.createCommandEncoder({label:`${o}-cal-eq`}),p=u.beginComputePass({label:`${o}-cal-dep`});p.setBindGroup(0,F),p.setPipeline(O.pipeline),p.dispatchWorkgroups(z),p.setPipeline(k.pipeline),p.dispatchWorkgroups(ne),p.setPipeline(A.pipeline),p.dispatchWorkgroups(z),p.end();let g=h.encodePoissonSolve(u,{gradAxis:0})===h.bufferA?F:I;p=u.beginComputePass({label:`${o}-cal-apply`}),p.setBindGroup(0,g),p.setPipeline(j.pipeline),p.dispatchWorkgroups(z),p.setPipeline(ee.pipeline),p.dispatchWorkgroups(ne),p.end(),e.queue.submit([u.finish()])}async function ae({dt:t=.008,substeps:n=2,gravity:u=1,softening:p=.35,readback:v=!1}={}){if(R)return s;let y=Math.max(1,Math.min(8,Math.trunc(n))),S=Math.max(5e-4,Math.min(.012,(Number(t)||.008)/y)),C=new ArrayBuffer(48);new Uint32Array(C,0,4).set([c,l,i,L]),new Float32Array(C,16,8).set([r,d,S,u,p*p,a*a,m,f]),e.queue.writeBuffer(b,0,C);let w=e.createCommandEncoder({label:`${o}-step-${L}`});for(let e=0;e<y;e+=1){let t=w.beginComputePass({label:`${o}-dep-${e}`});t.setBindGroup(0,F),t.setPipeline(D.pipeline),t.dispatchWorkgroups(ne),t.setPipeline(O.pipeline),t.dispatchWorkgroups(z),t.setPipeline(k.pipeline),t.dispatchWorkgroups(ne),t.setPipeline(A.pipeline),t.dispatchWorkgroups(z),t.end();let n=h.encodePoissonSolve(w,{gradAxis:0})===h.bufferA?F:I;t=w.beginComputePass({label:`${o}-kick-${e}`}),t.setBindGroup(0,n),t.setPipeline(j.pipeline),t.dispatchWorkgroups(z),t.setPipeline(M.pipeline),t.dispatchWorkgroups(ne),t.end(),L+=1}let T=v&&!te&&x.mapState===`unmapped`;if(T&&(te=!0,w.copyBufferToBuffer(_,0,x,0,g)),e.queue.submit([w.finish()]),T)try{await x.mapAsync(Q.MAP_READ),R||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!R&&e?.name!==`AbortError`)throw e}finally{te=!1}return s}function oe(){if(!R){R=!0,h.destroy();for(let e of[_,v,y,b,x])try{e.destroy()}catch{}}}return Object.freeze({schema:un,get count(){return c},get activeCount(){return c},get stepIndex(){return L},get gridN(){return l},get boxSize(){return r},get backend(){return`webgpu`},get gravityMode(){return`webgpu-cic-3dfft-pm+smbh`},getBodies:()=>s,getResidentBuffer:()=>_,calibrateEquilibrium:ie,readbackBodies:re,step:ae,dispose:oe})}function pn(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var mn=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;function hn({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){pn(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=T(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:mn,entryPoint:`step_nbody`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`uniform`)]}),m=[w(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),w(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function gn(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var $=[`disk`,`barred`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`],_n=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],vn=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function yn({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.28,centerOffset:a=[0,0,0]}={}){let o=Math.max(256,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=gn(n),l=()=>{let e=Math.max(1e-7,c()),t=c();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},u=Number(a?.[0])||0,d=Number(a?.[1])||0,f=Number(a?.[2])||0,p=(e,t,n,i,a,o,p,m,h,g,_=1)=>{let v=t-e,y=44*_,b=135*_,x=290*_,S=780*_,C=1.25*_,w=3.2*_,T=7.4*_,E=1.05*_,D=.72*_,O=e=>{let t=Math.max(.15*_,e),n=r*y*t/(t*t+D*D)**1.5,i=Math.hypot(t,E),a=t*t*b/((t+C)*(t+C)),o=t/w,s=x*(1-(1+o)*Math.exp(-o)),c=t*t*S/((t+T)*(t+T));return n+r*(a+s+c)*t/(i*i*i)},k=e=>Math.sqrt(Math.max(0,e*O(e))),A=Math.cos(h),j=Math.sin(h),M=Math.cos(g),N=Math.sin(g),ee=(e,t,n)=>{let r=t*A-n*j,i=t*j+n*A;return[e*M-r*N,e*N+r*M,i]};s.set([n+u,i+d,a+f,y,o,p,m,.05],e*8);let P=Math.floor((v-1)*.36),F=Math.floor((v-1)*.14),I=Math.floor((v-1)*.04),L=v-1-P-F-I,te=S/Math.max(1,P),R=b/Math.max(1,F+I),ne=x/Math.max(1,L),z=e+1;for(let e=0;e<P&&z<t;e+=1,z+=1){let e=Math.max(.01,Math.min(.88,c())),t=Math.min(18.5*_,T*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),r=2*c()-1,h=Math.sqrt(Math.max(0,1-r*r)),g=2*Math.PI*c(),v=t*h*Math.cos(g),y=t*r,b=t*h*Math.sin(g),x=k(t)*.56,S=ee(v,y,b),C=ee(l()*x,l()*x,l()*x);s.set([n+S[0]+u,i+S[1]+d,a+S[2]+f,te,o+C[0],p+C[1],m+C[2],-1],z*8)}for(let e=0;e<F+I&&z<t;e+=1,z+=1){let t=e>=F,r=Math.max(.005,Math.min(.92,c())),h=t?C*4:C,g=Math.min(11.5*_,h*Math.sqrt(r)/Math.max(.07,1-Math.sqrt(r))),v=2*c()-1,y=Math.sqrt(Math.max(0,1-v*v)),b=2*Math.PI*c(),x=g*y*Math.cos(b),S=g*v*(t?.85:.62),w=g*y*Math.sin(b),T=k(g),E=T*(t?.5:.36),D=t?.18:.62,O=-Math.sin(b)*T*D+l()*E,A=l()*E*.68,j=Math.cos(b)*T*D+l()*E,M=ee(x,S,w),N=ee(O,A,j),P=t?.24+c()*.1:.02+Math.min(.28,g/(2.6*_)*.24);s.set([n+M[0]+u,i+M[1]+d,a+M[2]+f,R,o+N[0],p+N[1],m+N[2],P],z*8)}let re=Math.tan(17*Math.PI/180);for(;z<t;z+=1){let e=-w*Math.log(Math.max(1e-4,c()*c())),t=Math.max(.32*_,Math.min(11.5*_,e*.78)),r=Math.min(1,Math.max(0,(t-.75*_)/(2*_))),h=c()<.72*r,g,v;if(h){let e=z&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*_))/re,a=(n?.26:.36)+t/_*.022;g=r+i+l()*a,v=c()<.11&&t>1.4*_&&t<8.5*_?.82+c()*.22:.38+c()*.38}else g=c()*Math.PI*2,v=.08+c()*.26;let y=(.14+t/_*.028)*_,b=t*Math.cos(g),x=t*Math.sin(g),S=l()*y,C=k(t),T=C*.985,E=C*(.08+.05*Math.exp(-t/w)),D=C*.045,O=l()*E,A=T+l()*(E*.72),j=Math.cos(g)*O-Math.sin(g)*A,M=l()*D,N=Math.sin(g)*O+Math.cos(g)*A,P=ee(b,S,x),F=ee(j,M,N);s.set([n+P[0]+u,i+P[1]+d,a+P[2]+f,ne,o+F[0],p+F[1],m+F[2],v],z*8)}};if(t===`binary`){let e=o>>1;p(0,e,-5.8,.9,-1.5,1.35,-.22,1.05,.35,.18,.68),p(e,o,5.8,-.9,1.5,-1.35,.22,-1.05,-.42,-.25,.68)}else if(t===`barred`){p(0,o,0,0,0,0,0,0,0,0,1);let e=Math.floor(o*.42);for(let t=Math.floor(o*.22);t<e;t+=1){let e=t*8;if(s[e+7]<0)continue;let n=(c()*2-1)*3.6,r=l()*.24,i=l()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;s.set([n+u,r+d,i+f,s[e+3]*1.15,-i*o+l()*.45,l()*.25,n*o+l()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<o;n+=1){let e=n*8;if(!(s[e+7]<0)&&c()<.78){let a=n&1,o=3.1+c()**.85*7.8,p=a*Math.PI+Math.log(o/3)/t+l()*(.2+.02*o),m=l()*(.12+.025*o),h=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),g=c()<.14;s.set([Math.cos(p)*o+u,m+d,Math.sin(p)*o+f,s[e+3],-Math.sin(p)*h+l()*.45,l()*.2,Math.cos(p)*h+l()*.45,g?.85+c()*.2:.44+c()*.34],e)}}}else if(t===`proto`){p(0,o,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(c()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(o*.45);for(let n=t;n<o;n+=1){let t=n*8;if(!(s[t+7]<0))if(c()<.52){let i=e[n%e.length],a=c()**.6*1.35,o=c()*Math.PI*2,p=2*c()-1,m=Math.sqrt(Math.max(0,1-p*p)),h=i[0]+a*m*Math.cos(o)*1.25,g=i[1]+a*p*.45,_=i[2]+a*m*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(h,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));s.set([h+u,g+d,_+f,s[t+3]*1.2,-_/v*y+l()*1.25,l()*.95,h/v*y+l()*1.25,.78+c()*.28],t)}else s[t+1]=s[t+1]*2.4,s[t+7]=Math.min(1.02,s[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(o*.72);p(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((o-e)*.3);for(let n=e;n<o;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(c())*1.15,n=2*c()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=c()*Math.PI*2;s.set([7.4+e*r*Math.cos(a)+u,2.2+e*n+d,-2+e*r*Math.sin(a)+f,45/Math.max(1,t),-1.4+l()*.55,2.4+l()*.55,4.1+l()*.55,.52+c()*.34],i)}else{let n=(a-t)/Math.max(1,o-e-t),p=-.35+n*Math.PI*1.85,m=7.4+Math.sin(p*1.5)*1.65,h=.25+.42*n,g=Math.cos(p)*m+l()*h,_=Math.sin(p)*m*.72+l()*h,v=Math.sin(p+.8)*m*.58+l()*h,y=Math.max(1,Math.hypot(g,_,v)),b=Math.sqrt(r*1150/y);s.set([g+u,_+d,v+f,12/Math.max(1,o-e-t),-Math.sin(p)*b*.75,Math.cos(p)*b*.55,Math.cos(p+.8)*b*.42,.34+c()*.42],i)}}}else if(t===`globular`){let e=520/o,t=.65;s.set([u,d,f,8,0,0,0,.12],0);for(let n=1;n<o;n+=1){let i=Math.max(.001,Math.min(.96,c())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=c()*Math.PI*2,h=8+520*a**3/(a*a+t*t)**1.5,g=Math.sqrt(r*h/(3*Math.hypot(a,.45))),_=a<1.3&&c()<.08;s.set([a*p*Math.cos(m)+u,a*o+d,a*p*Math.sin(m)+f,e,l()*g,l()*g,l()*g,_?.68+c()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`sphere`){let e=3.2,t=950/o;s.set([u,d,f,60,0,0,0,.05],0);for(let n=1;n<o;n+=1){let i=Math.max(.004,Math.min(.93,c())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=2*Math.PI*c(),h=60+a*a*950/((a+e)*(a+e)),g=Math.sqrt(r*h/(3*Math.hypot(a,1.2)));s.set([a*p*Math.cos(m)+u,a*o*.78+d,a*p*Math.sin(m)+f,t,l()*g,l()*g,l()*g,.04+Math.min(.3,a/10*.26)],n*8)}}else p(0,o,0,0,0,0,0,0,0,0,1);return s}function bn(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=gn(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function xn(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function Sn(e,{seed:t=20261125,qualityId:r=`med`,initialElementZ:a=26}={}){let o=t>>>0,s=Ae[r]||Ae.med,c=new v({artifactCache:new b});ce(M);let d=new Map,f=new Map,p=`present-day`,m=de({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),h=He({cosmicEpoch:m,regionPosMpc:[0,0,0],localOverdensity:1.15,seed:o}),g={posGal:[4.8,.04,2.1],popTag:.52,starIndex:0},_=!1,S=Ge(We({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:o}));function C(){return _?ve:S?.catalog?.length?S.catalog:ve}function w(e=C()){let t=e.findIndex(e=>e.planetClass===`earth-like`||e.id===`earth`);if(t>0)return t;let n=e.findIndex(e=>!e.isStar&&e.kind!==0);return n>0?n:0}let T=`web`,E=null,k=null,N=null,se=[],le=null,me=null,B=null,ge=null,_e=null,V=new Float32Array,ye=.3,be=`disk`,xe=1,Se=null,Ce=[],we=[4.8,.04,2.1],Ee=`solar-system`,De=!0,Oe=null,je=null,Me=null,Ne=null,Pe=null,Fe=w(),H=`nbody`,Ie=null,Le=null,Re=!0,ze=null,Be=null,Ve=.94,Ue=null,Ke=null,U=null,qe=null,Je=null,Ye=null,Xe=null,Ze=null,Qe=null,et=null,nt=null,W=null,G=new Float32Array,rt=.36,it=`main-sequence-star`,K=null,ot=null,ct=null,lt=null,ut=2,q=`fusion`,pt=null,mt=null,ht=new Float32Array,J=.58,gt=null,_t=null,vt=null,yt=null,bt=null,xt=null,Ct=new Float32Array,Tt=null,Dt=`standard`,Ot=null,kt=w(),At=!1,jt=[],Mt=null,Nt=null,Pt=null,Y=!0,Ft=null,X=null,It=!1,Lt=null,Rt=null,zt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},Bt=null,Vt=null,Ht=a,Ut=300,Wt=!1,Gt=`solid`,Kt=[],qt=a,Jt=3,Yt=2,Xt=0,Qt=!0,$t=`atom`,en=`H2O`,tn=null,nn=null,rn=a,an=56,sn=null,cn=null,ln=null,un=null,Q={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},dn=!1,pn=!1;async function mn(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(d.has(o))return d.get(o);let s=await j(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return d.set(o,s),s}async function xn({seedOverride:t=null}={}){E&&=(E.destroy(),null);let n=(t??o)>>>0,r=await $e(e,{gridPerSide:s.cosmoGridPerSide,fftGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,amplitude:.44,seed:n});E=tt(e,{gridPerSide:s.cosmoGridPerSide,pmGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,da:.0085,initialConditions:r}),N=null;for(let e=0;e<6;e+=1)k=await E.step({readTelemetry:e===0||e===5}),e===0&&k?.powerSpectrumPk?.kBins?.length&&(N={kBins:[...k.powerSpectrumPk.kBins],pkValues:[...k.powerSpectrumPk.pkValues]});let i=gn(n^5370206);se=Array.from({length:5},(e,t)=>{let n=$[t%$.length],r=_n[Math.floor(i()*_n.length)],a=1e3+Math.floor(i()*8900),o=t===0?18:72,s=(i()-.5)*2*o,c=(i()-.5)*1.4*o,l=(i()-.5)*2*o,u=Number((.6+i()*1.1).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${a} Supercluster`,subtitle:`${n===`disk`?`Grand-Design Spiral`:n===`binary`?`Interacting Merger Pair`:`Giant Elliptical`} · Z=${u} Z☉`,posMpc:[s,c,l],pos:[s*.1,c*.1,l*.1],radius:1,morphology:n,metallicity:u,massLabel:`${(1.2+i()*4.5).toFixed(2)}×10¹² M☉`,tempK:6500+Math.round(i()*4500),composition:`DM 84% · H 12% · He 3.8% · Met ${(.2*u).toFixed(2)}%`,nextLevel:1}})}async function Sn({preset:t=null,metallicity:n=null,galaxyEnvOverride:r=null,seedOverride:i=null}={}){r?h=r:(t||n!=null)&&(h=Object.freeze({...h,morphology:$.includes(t)?t:h.morphology,meanMetallicitySolar:n==null?h.meanMetallicitySolar:Math.max(1e-4,Math.min(3.2,Number(n))),baseFeH:Math.log10(Math.max(1e-4,n==null?h.meanMetallicitySolar:Number(n)))})),be=$.includes(t||h.morphology)?t||h.morphology:`disk`,xe=Math.max(.01,Math.min(3,Number(n??h.meanMetallicitySolar)||1)),B&&=(B.dispose(),null),ge&&=(ge.dispose(),null),Se||=await at(e);let a=(i??o)+825>>>0;B=fn({device:e,initialBodies:yn({count:s.galaxyStars,preset:be,seed:a}),gridN:32,boxSize:48,secondSmbhIndex:be===`binary`?s.galaxyStars>>1:0,smbhSoftening:.72,label:`ulg-universes-galaxy-pm-${s.galaxyStars}`}),(be===`disk`||be===`barred`||be===`proto`||be===`sphere`||be===`globular`)&&await B.calibrateEquilibrium({gravity:1,softening:.35}),await B.step({dt:.008,substeps:2,gravity:1,softening:.35,readback:!1}),ge=pe(e,{gridN:24,boxSize:26,strideFloats:8,geometry:`galactic`,initialB0:ye,alphaAmp:.035,etaRes:.16,bSat:.85,velScale:.22,label:`ulg-universes-galactic-dynamo`}),_e=await ge.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.04,substeps:8,readTelemetry:!0,readBField:!0}),V=ge.buildStreamlines({worldScale:1,alpha:.3});let c=gn(a^141729),l=[4.8,.04,2.1],u=[-4.4,-.05,3.6],d=[Math.cos(c()*6.28)*6.8,.08,Math.sin(c()*6.28)*6.8],f=[1.05,.14,-.85];we=[...l];let p=(e,t,n)=>{let r=We({cosmicEpoch:m,galaxyEnv:h,starPosGal:e,popTag:t,starIndex:n,seed:a}),i=Ge(r),o=r.multiplicity===3?`Trinary`:r.multiplicity===2?`Binary`:`Single`;return{stSys:r,plSys:i,title:`${r.systemName} · ${o} (${r.stars.map(e=>e.spectralCode).join(` + `)})`,sub:`${r.galacticRegion} · R=${r.rKpc} kpc · ${i.planetCount} worlds · ${r.nebulaEnv.nebulaSummary}`}},g=p(l,.52,0),_=p(u,.88,1),v=p(d,.36,2),y=p(f,.14,3);Ce=[{id:`star-disk-causal`,level:1,branch:`solar-system`,starSite:{posGal:l,popTag:.52,starIndex:0},name:g.title,subtitle:g.sub,pos:l,radius:.8,tempK:g.stSys.stars[0].effectiveTempK,massLabel:`${g.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:g.stSys.stars[0].composition,nextLevel:2},{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Galactic Core SMBH (Sgr-ULG*)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Zoom In for Schwarzschild Lensing`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2},{id:`star-h2`,level:1,branch:`solar-system`,starSite:{posGal:u,popTag:.88,starIndex:1},name:_.title,subtitle:_.sub,pos:u,radius:.8,tempK:_.stSys.stars[0].effectiveTempK,massLabel:`${_.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:_.stSys.stars[0].composition,nextLevel:2},{id:`star-outer`,level:1,branch:`solar-system`,starSite:{posGal:d,popTag:.36,starIndex:2},name:v.title,subtitle:v.sub,pos:d,radius:.75,tempK:v.stSys.stars[0].effectiveTempK,massLabel:`${v.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:v.stSys.stars[0].composition,nextLevel:2},{id:`star-bulge`,level:1,branch:`solar-system`,starSite:{posGal:f,popTag:.14,starIndex:3},name:y.title,subtitle:y.sub,pos:f,radius:.75,tempK:y.stSys.stars[0].effectiveTempK,massLabel:`${y.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:y.stSys.stars[0].composition,nextLevel:2}]}async function Cn(){if(Oe)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=gn((o^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}Oe=hn({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),je=await Oe.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function wn({seedOverride:t=null,starSite:n=null,solReference:r=null,forceMultiplicity:i=null}={}){Me&&=(Me.dispose(),null),typeof r==`boolean`&&(_=r),n&&(g={posGal:n.posGal||g.posGal,popTag:n.popTag??g.popTag,starIndex:n.starIndex??g.starIndex},_=!1);let a=(t??o)+409>>>0;_||(S=Ge(We({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:a,forceMultiplicity:i}),{seedOverride:a}));let c=C();Fe=_?3:w(c),kt=Fe,Me=Te(e,{catalog:c,beltZoneAu:_?null:S?.beltZoneAu,asteroidCount:s.solarAsteroids,seed:a,label:_?`ulg-universes-sol-reference`:`ulg-universes-causal-${S?.systemId||`sys`}`}),await Me.step({dtSubYr:35e-6,substeps:4,readMassive:!0}),Ne=Me.computeConservationDiagnostics(),Pe=Ne,Ot&&=null}async function Tn({posGal:e,popTag:t=.5,starIndex:n=0,forceMultiplicity:r=null,seedOverride:i=null}={}){g={posGal:Array.isArray(e)?[...e]:[...g.posGal],popTag:Number.isFinite(Number(t))?Number(t):.5,starIndex:Math.trunc(Number(n)||0)},we=[...g.posGal],_=!1,await wn({starSite:g,forceMultiplicity:r,seedOverride:i});let a=S?.starSystem?.stars?.[0];return a&&(a.stage===`white-dwarf`?q=`white-dwarf-tov`:a.stage===`neutron-star`?q=`pulsar`:(q=`fusion`,it=a.initialMassSolar>=10?`massive-supernova`:a.stage===`protostar-yso`?`binary-nursery`:`main-sequence-star`)),S}async function En({forceMultiplicity:e=null}={}){let t=(g.starIndex||0)+1,n=gn((o^t*1103515245)>>>0),r=.8+n()**.72*8.2,i=n()*Math.PI*2,a=(n()-.5)*(r<2.2?1.4:.42),s=r<2?.08+n()*.22:.32+n()*.65;return Tn({posGal:[Math.cos(i)*r,a,Math.sin(i)*r],popTag:s,starIndex:t,forceMultiplicity:e})}async function Dn(e){return _=!!e,await wn({solReference:_}),C()}async function On({seedOverride:t=null}={}){Ie&&=(Ie.dispose(),null);let n=(t??o)+773>>>0,r=F(e,{pebbleCount:Math.min(4096,Math.max(1536,(s.solarAsteroids||512)*4)),embryoCount:18,enableGasDrag:Re,seed:n,label:`ulg-universes-protoplanetary-disk`});Le=await r.step({dt:.018,substeps:3,readTelemetry:!0}),Ie=r}async function kn({initialB0:t=J,seedOverride:n=null}={}){J=Math.max(0,Math.min(1.5,Number(t)??.58));let r=pt;pt=null,r&&r.dispose();let i=(n??o)+3133>>>0,a=ae(e,{gridN:s.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,s.stellarParticles||4096)),initialB0:J,spinOmega:2.35,gravityG:2.4,seed:i,label:`ulg-universes-nebular-mhd`});mt=await a.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),ht=a.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),pt=a}async function An(t=T){let n=le;le=null,n&&n.dispose();let r=t===`cmb`,i=t===`reionization`,a=t===`cluster-merger`,c=r?1100:i?10:.25,l=s.id===`low`?4096:s.id===`ultra`?10240:6656,u=L(e,{gridN:s.id===`low`?16:24,tracerCount:l,boxSizeMpc:260,redshiftZ:c,clusterMergerMode:a,uvFlux:i?1.55:r?0:.25,gravityG:a?1.65:1.15,seed:(o^(r?4352:i?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=i?5:a?4:2;for(let e=0;e<d;e+=1)me=await u.step({dt:i?.14:.09,substeps:2,readTelemetry:e===d-1});le=u}async function jn({spinA:t=Ve}={}){Ve=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=ze;ze=null,n&&n.dispose();let r=s.id===`low`?4096:6656,i=ne(e,{massSolar:45e7,spinA:Ve,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(o^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)Be=await i.step({dt:.032,substeps:2,readTelemetry:e===4});ze=i}async function Mn(t=`bns-kilonova`){let n=Ue;Ue=null,n&&n.dispose(),U=t;let r=s.id===`low`?3072:5120,i=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},a=R(e,{...i,particleCount:r,seed:(o^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<i.warm;e+=1)Ke=await a.step({dt:.032,substeps:4,readTelemetry:e===i.warm-1});Ue=a}async function Nn(t=`comet-tails`){let n=qe;qe=null,n&&n.dispose(),Ye=t;let r=t===`comet-tails`,i=z(e,{regime:r?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:r?1.45:2.35,radBeta:r?.95:.72,windSpeed:r?2.25:1.95,sublimationDrive:r?1.35:1.45,sourceDir:r?[.76,.24,.6]:[.82,.14,.55],particleCount:s.id===`low`?3072:5120,seed:(o^(r?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)Je=await i.step({dt:.04,substeps:3,readTelemetry:e===7});qe=i}async function Pn(t=`roche-rings`){let n=Xe;Xe=null,n&&n.dispose(),Qe=t;let r=re(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:2.8,rHostSim:t===`red-giant`?1.85:t===`giant-impact`?1.48:1.38,rRocheSim:3.65,gmHost:24,cohesionStrength:.55,tidalHeatDrive:1.25,shepherdGm:.72,particleCount:s.id===`low`?3072:5120,seed:(o^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),i=t===`roche-rings`?12:6;for(let e=0;e<i;e+=1)Ze=await r.step({dt:.028,substeps:3,readTelemetry:e===i-1});Xe=r}async function Fn(t=`h2-pillars`){let n=gt;gt=null,n&&n.dispose(),vt=t;let r=z(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`planetary-nebula`?1.65:1.48,radBeta:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:1.45,sourceDir:[.65,.58,.48],particleCount:s.id===`low`?3584:5632,seed:(o^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)_t=await r.step({dt:.036,substeps:2,readTelemetry:e===5});gt=r}async function In(t=`magnetar`){let n=yt;yt=null,n&&n.dispose(),xt=t;let r=t===`magnetar`,i=ue(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:s.id===`low`?3584:5632,seed:(o^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),a=r?8:4;for(let e=0;e<a;e+=1)bt=await i.step({dt:.055,substeps:3,readTelemetry:e===a-1});Ct=i.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}),yt=i}async function Ln(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,ye:.5});Tt=await fe(e,t)}async function Rn(){let t=Ft;Ft=null,t&&t.dispose();let n=re(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:s.id===`low`?2560:4096,seed:(o^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)X=await n.step({dt:.032,substeps:3,readTelemetry:e===7});Ft=n}async function zn({preset:t=it,seedOverride:n=null}={}){it=[`main-sequence-star`,`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`main-sequence-star`,et&&=(et.dispose(),null),nt&&=(nt.dispose(),null),lt||=(await Zt({closureRegistry:c,device:e})).ref;let r=(n??o)+1939>>>0,i=Z({count:s.stellarParticles,preset:it,seed:r}),a=it===`main-sequence-star`;et=on({device:e,initialBodies:i,closureRegistry:c,closureRef:lt,boxHalf:a?7.5:14,rCellFactor:a?.385:.075,softening:a?.45:.25,baseLogRho:a?-1.6:-16.2,refRhoSim:a?.095:.08,tScaleK:a?185e4:78e4,label:`ulg-universes-stellar-${it}`}),K=await et.step({dt:.015,timeAccel:ut,readTelemetry:!0}),nt=pe(e,{gridN:24,boxSize:16,strideFloats:16,geometry:`stellar`,initialB0:rt,alphaAmp:.22,etaRes:.055,bSat:.95,velScale:.35,label:`ulg-universes-stellar-dynamo`}),W=await nt.step({particleBuffer:et.getResidentBuffer(),particleCount:et.count,dt:.042,substeps:8,readTelemetry:!0,readBField:!0}),G=nt.buildStreamlines({worldScale:1,alpha:.42});let[l,u]=await Promise.all([wt(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),Et(e,[1.5,3],{dXi:.01,maxXi:12})]);ot=l,ct=u}async function Bn({bodyIndex:t=kt}={}){let n=C(),r=Math.max(0,Math.min(n.length-1,Math.trunc(Number(t)??kt)));if(n[r]?.isStar||r===0){let e=w(n);e>0&&(r=e)}kt=r;let i=n[r]||ve[3],a=i.coreZ||26,c=i.mantleZ||14,l=i.surfZ||29;Bt||(Ht=l),tn||(qt=a),sn||(rn=a);let[u,d,p]=await Promise.all([mn(a,{relativistic:!0,returnOrbitalWavefunctions:!1}),mn(c,{relativistic:!0,returnOrbitalWavefunctions:!1}),mn(l,{relativistic:!0,returnOrbitalWavefunctions:!1})]),m=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(f.has(n))return f.get(n);let r=await dt(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return f.set(n,r),r},[h,g]=await Promise.all([m(u),m(d)]),_=Math.max(5e9,Math.min(85e10,Number(i.centralP)||36e10));Ot=await ft(e,{centralPressurePa:_,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${u.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:h},{name:`${d.bundle.symbol} Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:g}]});let v=.52,y=Ot?.profile||[],b=Math.max(1,Ot?.radiusM||i.radiusKm*1e3);for(let e=0;e<y.length;e+=1)if((y[e].layerIndex??0)>=1){v=Math.max(.22,Math.min(.78,y[e].radiusM/b));break}jt=[{id:`layer-core`,level:4,name:`${i.name} · ${u.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(_/1e9).toFixed(0)} GPa · MoI = ${(Ot?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:a,rCoreNorm:v,rMantleNorm:.94,tempK:5200,massLabel:`R = ${i.radiusKm.toLocaleString()} km`,composition:i.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${i.name} · ${d.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:c,rCoreNorm:v,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(Ot?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${d.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${i.name} · ${p.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${p.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:l,rCoreNorm:v,rMantleNorm:.94,tempK:i.tempK||288,massLabel:`T_eq = ${i.tempK||288} K`,composition:`${p.bundle.symbol} (${p.bundle.mechanical.crystalStructure})`,nextLevel:5}],Nt&&(Nt.dispose(),Nt=null,Pt=null);let x=Number(u.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,S=i.parent>=0?n[i.parent]:null,T=Math.max(.15,Number(i.aAu||S?.aAu||1));if(Mt=I({...i,coreRadiusNorm:v,coreConductivitySm:x},{...Ot,coreRadiusFraction:v,centralPressurePa:_},{solarDistanceAu:T,coreConductivitySm:x}),Mt.activation.anyActive){let t=P(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:Mt,enableTriboelectric:Y,seed:(o^r*2654435761)>>>0,label:`ulg-universes-atmo-${r}`});for(let e=0;e<4;e+=1)Pt=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});Nt=t}}async function Vn({Z:t=Ht,tempK:n=null,phasePreset:r=null,gravity:a=Wt}={}){Ht=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Wt=!!a,Bt&&=(Bt.destroy(),null);let o=await mn(Ht,{relativistic:!0,returnOrbitalWavefunctions:!1}),c=o.visualData.bulk,u=o.visualData.thermo.potential,d=o.bundle,f=Math.max(20,Number(d.thermodynamic.meltingPointK||600)),p=Math.max(f*1.4+20,Number(d.thermodynamic.boilingPointK||f*2.4));r===`melt`?(Gt=`melt`,Ut=Math.round(f*1.42)):r===`vapor`?(Gt=`vapor`,Ut=Math.round(p*1.38)):r===`solid`?(Gt=`solid`,Ut=Math.max(20,Math.round(f*.25))):n!=null&&Number.isFinite(Number(n))?Ut=Math.max(15,Math.round(Number(n))):(Gt=`solid`,Ut=Math.max(20,Math.round(f*.25)));let m=Math.max(1,Number(d.nuclear.atomicMassU||28)),h=Math.min(2,Math.max(.45,.09*Math.sqrt(m))),g=s.mdCells;Bt=i(e,{...l({crystalStructure:c.crystalStructure,cellsVec:[g,g,g],latticeConstantA:Math.max(2.4,Number(c.latticeConstantA||3.6)),massU:m,temperatureK:Ut}),potentialModel:u.potentialModel,epsilonEv:u.epsilonEv,sigmaOrR0A:u.sigmaOrR0A,alphaOrLambda:u.alphaOrLambda,rcutA:u.rcutA,eamAEv:u.eamAEv,eamBeta:u.eamBeta,swGamma:u.swGamma,dtFs:h,targetTemperatureK:Ut,thermostatCouplingFs:20,meltingPointK:f,bulkModulusGPa:Math.max(1,Number(c.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(c.cohesiveEnergyEv||2)),crystalStructure:c.crystalStructure,gravityEnabled:Wt}),Vt=await Bt.stepBatch(4,{readTelemetry:!0,targetTemperatureK:Ut}),Kt=Vt?.rdf?Array.from(Vt.rdf):[]}async function Hn({Z:t=qt,n=null,l:r=null,m:i=null,relativistic:a=Qt,mode:c=$t,moleculeKey:l=en}={}){qt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Qt=!!a,$t=c===`molecule`?`molecule`:`atom`,en=vn[l]?l:`H2O`;let d=ke.find(e=>e.Z===qt);n==null?d&&(Jt=d.defaultN):Jt=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?d&&(Yt=Math.min(Jt-1,d.defaultL)):Yt=Math.max(0,Math.min(Jt-1,Math.trunc(Number(r)))),Xt=i==null?0:Math.max(-Yt,Math.min(Yt,Math.trunc(Number(i))));let f=await mn(qt,{relativistic:Qt,returnOrbitalWavefunctions:!0});if($t===`molecule`){let t=vn[en];nn=await u(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}tn=D(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,s.orbitalPoints),seed:(o^1779033703)>>>0,reuseBuffer:tn?.pointsBuffer||null})}else{let t=f.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===Jt&&e.l===Yt&&e.u?.length);tn=O(e,{Z:qt,n:Jt,l:Yt,m:Xt,pointCount:s.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:Qt,colorMode:1,seed:(o^qt*2654435761)>>>0,reuseBuffer:tn?.pointsBuffer||null})}}async function Un({Z:t=rn,A:r=null}={}){rn=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let i=ke.find(e=>e.Z===rn);an=r==null?i?.A||Math.round(rn*2.15):Math.max(rn,Math.trunc(Number(r))),cn&&=(cn.destroy(),null),sn=await n(e,rn,an,{volDim:s.nuclearVolDim}),cn=A(e,sn),ln=cn?await cn.stepBatch(8):null}async function Wn(e,t,n=1){if(!(dn||pn)){dn=!0;try{if(e===0)T!==`web`&&le?me=await le.step({dt:(T===`reionization`?.12:.08)*Math.max(.2,Math.min(2.5,n)),substeps:1,readTelemetry:!0}):E&&E.getState().aScale<1.15&&(k=await E.step({readTelemetry:!0}));else if(e===1&&B){let e=.009*Math.max(.1,Math.min(3,n));if(await B.step({dt:e,substeps:2,gravity:1,softening:.35,readback:!1}),ge){let e=B.stepIndex%4==0;_e=await ge.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.04*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:e,readBField:e}),e&&(V=ge.buildStreamlines({worldScale:1,alpha:.3}))}}else if(e===2){if(Ee===`smbh-core`&&Oe)je=await Oe.step({dt:.008*Math.max(.1,Math.min(3,n)),gravity:1,softening:.08,readback:!0});else if(H===`formation`&&Ie)Le=await Ie.step({dt:.016*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(H===`quasar-jet`&&ze)Be=await ze.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((H===`xray-binary`||H===`bns-kilonova`||H===`type-ia`||H===`bbh-merger`)&&Ue)Ke=await Ue.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:3,readTelemetry:!0});else if((H===`comet-tails`||H===`hot-jupiter`)&&qe)Je=await qe.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((H===`roche-rings`||H===`giant-impact`||H===`red-giant`)&&Xe)Ze=await Xe.step({dt:.024*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(Me){let e=t<10.2,r=e?18e-6:55e-6,i=Math.max(2,Math.min(48,Math.round((e?8:24)*n)));await Me.step({dtSubYr:r,substeps:i,readMassive:!0}),Pe=Me.computeConservationDiagnostics()}}else if(e===3){if(q===`nebular-mhd`&&pt){let e=pt.stepIndex%4==0;mt=await pt.step({dt:.022*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:e}),e&&(ht=pt.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}))}else if((q===`h2-pillars`||q===`planetary-nebula`||q===`snr-pwn`)&&gt)_t=await gt.step({dt:.032*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((q===`pulsar`||q===`magnetar`)&&yt){let e=yt.stepIndex%4==0;bt=await yt.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0,readBField:e}),e&&(Ct=yt.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}))}else if(q!==`white-dwarf-tov`&&et&&(K=await et.step({dt:.014*Math.max(.2,Math.min(2.5,n)),timeAccel:ut,readTelemetry:!0}),nt)){let e=et.stepIndex%4==0;W=await nt.step({particleBuffer:et.getResidentBuffer(),particleCount:et.count,dt:.038*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:e,readBField:e}),e&&(G=nt.buildStreamlines({worldScale:1,alpha:.42}))}}else if(e===4)if(It&&Lt)Rt=await Lt.step({dt:.02*Math.max(.25,Math.min(2.5,n)),controls:zt,readTelemetry:Lt.stepIndex%4==0});else{let e=Dt===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(Dt===`cryo-plumes`&&Ft&&(X=await Ft.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0})),Me&&Dt!==`eyeball-locked`&&Dt!==`rogue`){await Me.step({dtSubYr:12e-6,substeps:Math.max(1,Math.round(4*n)),readMassive:!0}),Pe=Me.computeConservationDiagnostics();let t=Me.getMassiveBodyState64(Fe),r=Me.getMassiveBodyState64(0),i=r.posAu[0]-t.posAu[0],a=r.posAu[1]-t.posAu[1],o=r.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}Nt&&(Pt=await Nt.step({dtSim:.042*Math.max(.2,Math.min(2.5,n)),substeps:2,sunDir:e,readTelemetry:!0}))}else if(e===5&&Bt){let e=Math.max(1,Math.min(8,Math.round(3*n)));Vt=await Bt.stepBatch(e,{readTelemetry:!0,targetTemperatureK:Ut,nonBlocking:!0}),Vt?.rdf&&(Kt=Array.from(Vt.rdf))}else if(e===7&&cn){let e=Math.max(2,Math.min(24,Math.round(10*n))),t=await cn.stepBatch(e,{nonBlocking:!0});t&&(ln=t)}}catch(e){let t=String(e?.message||e||``);if(!pn&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{dn=!1}}}async function Gn(){if(!un)return;let e=un;un=null;try{await e.stop()}catch{}Q={...Q,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Kn({relayUrl:e=Q.relayUrl,roomId:t=Q.roomId,role:n=Q.role}={}){await Gn();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return Q={...Q,connected:!1,relayUrl:``,roomId:i,role:a,error:null},Q;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),Q.remotePeers=t.size,Q.witnessedMessages=a,Q.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}un={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};Q={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){Q={...Q,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return qn()}function qn(){let e=un?.handle?.getStatus?.();return{...Q,connected:e?!!e.connected:Q.connected,remotePeers:e?e.remotePeerCount:Q.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:Q.remotePeerIds||[],quorumReady:e?!!e.quorumReady:Q.quorumReady,witnessedMessages:e?.witnessedMessages??Q.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??Q.lastWitnessedType??null}}async function Jn(e=qt){let t=un?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${Q.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return Q.dispatches+=1,Q.lastResult=r,r}let Yn=new Map;async function Xn(e,t={}){if(e===0&&E||e===1&&B||e===2&&(Ee===`smbh-core`?Oe:Me)||e===3&&et||e===4&&Ot||e===5&&Bt||e===6&&tn||e===7&&sn)return;let n=e===2?`2:${Ee}`:String(e);if(Yn.has(n))return Yn.get(n);let r=(async()=>{e===0?await xn(t):e===1?await Sn(t):e===2?Ee===`smbh-core`?await Cn():await wn(t):e===3?await zn(t):e===4?await Bn(t):e===5?await Vn(t):e===6?await Hn(t):e===7&&await Un(t)})();Yn.set(n,r);try{await r}finally{Yn.delete(n)}}function Zn(e){return Ae[e]?(s=Ae[e],!0):!1}function Qn(e){o=Number(e)>>>0||1}function $n(e){Wt=!!e,Bt&&typeof Bt.setGravity==`function`&&Bt.setGravity(Wt)}function er(e){Ut=Math.max(15,Math.round(Number(e)||300))}function tr(e){At=!!e}function nr(e){ut=Math.max(.4,Math.min(8,Number(e)||2))}async function rr(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=ee.find(t=>t.id===e)||ee[3];p=t.id,m=de({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(p=e.id||`custom`,m=de(e));return h=He({cosmicEpoch:m,regionPosMpc:se[0]?.posMpc||[0,0,0],localOverdensity:h.localOverdensity||1.15,seed:o}),_||(S=Ge(We({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:o+409>>>0}),{seedOverride:o+409>>>0})),t===0?m.eraId===`recombination`?await ir(`cmb`):m.eraId===`cosmic-dawn`?await ir(`reionization`):m.eraId===`far-future`?await ir(`cluster-merger`):await ir(`web`):t===1?await Sn({galaxyEnvOverride:h}):t===2?m.eraId===`quasar-peak`?await ar(`quasar-jet`):m.eraId===`cosmic-dawn`?await ar(`formation`):m.eraId===`far-future`?await ar(`red-giant`):(await wn(),await ar(`nbody`)):t===3?m.eraId===`far-future`?await cr(`planetary-nebula`):m.eraId===`cosmic-dawn`?await cr(`h2-pillars`):m.eraId===`quasar-peak`?await cr(`nebular-mhd`):await cr(`fusion`):t===4&&(m.eraId===`quasar-peak`?await lr(`magma-ocean`):await lr(`standard`)),m}async function ir(e){T=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,T===`web`?E||await xn():await An(T)}async function ar(e){H=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,H===`formation`?Ie||await On():H===`quasar-jet`?ze||await jn():H===`xray-binary`||H===`bns-kilonova`||H===`type-ia`||H===`bbh-merger`?(!Ue||U!==H)&&await Mn(H):H===`comet-tails`||H===`hot-jupiter`?(!qe||Ye!==H)&&await Nn(H):H===`roche-rings`||H===`giant-impact`||H===`red-giant`?(!Xe||Qe!==H)&&await Pn(H):Me||await wn()}async function or(e){Ve=Math.max(-.99,Math.min(.99,Number(e)??.94)),ze&&await jn({spinA:Ve})}function sr(e){Re=!!e,Ie?.setEnableGasDrag?.(Re)}async function cr(e){q=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`pulsar`,`magnetar`,`white-dwarf-tov`].includes(e)?e:`fusion`,q===`nebular-mhd`?pt||await kn():q===`h2-pillars`||q===`planetary-nebula`||q===`snr-pwn`?(!gt||vt!==q)&&await Fn(q):q===`pulsar`||q===`magnetar`?(!yt||xt!==q)&&await In(q):q===`white-dwarf-tov`?Tt||await Ln():et||await zn()}async function lr(t){if(Dt=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,Dt===`cryo-plumes`)Ft||await Rn();else if(Dt===`eyeball-locked`||Dt===`rogue`){let t=Nt;Nt=null,t&&t.dispose();let n=C()[kt]||ve[3],r=I({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:Dt===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},Ot||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:Dt===`rogue`?500:.14,coreConductivitySm:12e5});Mt=r;let i=P(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:r,enableTriboelectric:Y,seed:(o^(Dt===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${Dt}`});for(let e=0;e<4;e+=1)Pt=await i.step({dtSim:.048,substeps:2,sunDir:Dt===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});Nt=i}else Dt===`standard`&&await Bn({bodyIndex:kt})}async function ur(e){J=Math.max(0,Math.min(1.5,Number(e)??.58)),pt&&await kn({initialB0:J})}function dr(e){De=!!e}async function fr(e){ye=Math.max(0,Math.min(1.2,Number(e)||0)),ge&&B&&(ge.resetSeedB(ye),_e=await ge.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.045,substeps:ye>1e-6?8:1,readTelemetry:!0,readBField:!0}),V=ge.buildStreamlines({worldScale:1,alpha:.44}))}async function pr(e){rt=Math.max(0,Math.min(1.2,Number(e)||0)),nt&&et&&(nt.resetSeedB(rt),W=await nt.step({particleBuffer:et.getResidentBuffer(),particleCount:et.count,dt:.042,substeps:rt>1e-6?8:1,readTelemetry:!0,readBField:!0}),G=nt.buildStreamlines({worldScale:1,alpha:.42}))}function mr(e){Array.isArray(e)&&e.length>=3&&se.length>0&&(se[0]={...se[0],posMpc:[Number(e[0])||0,Number(e[1])||0,Number(e[2])||0]})}function hr(e){Y=!!e,Nt?.setEnableTriboelectric?.(Y)}async function gr({bodyIndex:t=kt,planetaryModeOverride:n=null}={}){let r=t,i=C();if(typeof r==`string`){let e=i.findIndex(e=>e.id===r);if(e>=0&&!i[e].isStar)r=e;else{let e=ve.findIndex(e=>e.id===r);e>0?(_=!0,await wn({solReference:!0}),i=C(),r=e):r=kt}}if(r=Math.max(0,Math.min(i.length-1,Math.trunc(Number(r)??kt))),i[r]?.isStar||r===0){let e=w(i);e>0&&(r=e)}Fe=r,n&&(Dt=n),(!Ot||kt!==r)&&await Bn({bodyIndex:r});let a=i[r]||ve[3],c=oe(e,{bodySpec:a,planetaryResult:Ot,planetaryAtmoState:Mt,planetaryMode:Dt,gridN:s.id===`low`?81:129,cellSizeM:2.35,particleCount:s.id===`low`?1024:2048,seed:(o^r*7919+84212430)>>>0,label:`ulg-universes-surface-${a.id}`});zt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},Rt=await c.step({dt:.016,controls:zt,readTelemetry:!1}),Rt=await c.step({dt:.016,controls:zt,readTelemetry:!0});let l=Lt;return Lt=c,It=!0,l&&l.dispose(),Rt}function _r(){It=!1,zt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0};let e=Lt;Lt=null,Rt=null,e&&e.dispose()}function vr(e){return Lt?Lt.setActiveVehicle(e):null}function yr(e){return Lt?Lt.setUfoAltitudeKm?.(e)??null:null}function br(e){return Lt?Lt.setCameraMode(e):null}function xr(e={}){zt={...zt,...e}}function Sr(e,t){Lt?.addLookDelta?.(e,t)}function Cr(e,t){let n=10**t,r=C(),i=r[Fe]||r[w(r)]||ve[3],a=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(H),o=e===2&&[`roche-rings`,`giant-impact`,`red-giant`].includes(H),s=e===2&&[`comet-tails`,`hot-jupiter`].includes(H),c=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(q),l=e===3&&[`pulsar`,`magnetar`].includes(q);return ie({viewSpanM:n,redshiftZ:m.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&T!==`web`?.157:0,clusterMassSolar:e===0&&T===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?B?.count||32768:0,nebulaCloudMass:e===3&&q===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&q===`nebular-mhd`?J:e===2&&H===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(q===`nebular-mhd`||c),starMassSolar:+(e===2&&H===`formation`),diskSolidMassEarth:e===2&&H===`formation`?45:0,gravitatingBodyCount:e===2||e===4?a?2:Me?.totalCount||15:0,solidBodyCount:e===2&&(H===`formation`||o)?18:0,solidParticleCount:e===2&&H===`formation`?90:0,coreTempK:e===3&&q===`fusion`?K?.coreTempK||15e6:0,bodyMassKg:e===4?i.massSolar*198847e25:e===3&&q===`fusion`?198847e25:0,bodyRadiusM:e===4?i.radiusKm*1e3:0,surfacePressurePa:e===4&&Mt?.surfacePressurePa||0,volatileMassFrac:e===4&&Mt?.volatileMassFrac||0,particulateMassFrac:e===4&&Mt?.particulateMassFrac||0,dynamo:e===4&&Mt?.dynamo||null,compactnessGMOverRc2:e===2&&(H===`quasar-jet`||a)||e===3&&(l||q===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&H===`quasar-jet`?45e7:a?10:0,accretionRateEddington:e===2&&(H===`quasar-jet`||H===`xray-binary`)?.55:0,kerrSpinA:e===2&&H===`quasar-jet`?Ve:0,surfaceBFieldTesla:l?q===`magnetar`?165e9:42e7:0,compactRadiusM:l?12e3:0,spinOmegaRadS:l?q===`magnetar`?45:740:0,maxPairwiseVOverC:a?.22:0,rocheOverflowPresent:e===2&&H===`xray-binary`,uvFluxNorm:s||c?1.5:0,xuvFluxWPerM2:e===2&&H===`hot-jupiter`?180:0,surfaceTempK:e===2&&H===`comet-tails`?260:0,sublimationTempK:e===2&&H===`comet-tails`?170:1e9,maxTidalStrain:o||e===4&&Dt===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&Dt===`magma-ocean`||e===2&&(H===`giant-impact`||H===`red-giant`)?2400:0,surfaceViewActive:It})}function wr(e,t=null){Ee=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(we=[...t])}function Tr(e){let t=C();if(typeof e==`string`){let n=t.findIndex(t=>t.id===e);if(n>=0)return Fe=n,Fe;let r=ve.findIndex(t=>t.id===e);if(r>=0)return _=!0,Fe=r,Fe}else Number.isFinite(Number(e))&&(Fe=Math.max(0,Math.min(t.length-1,Math.trunc(Number(e)))));return Fe}function Er(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return d.get(`${n}:std:${+!!t}:1`)||d.get(`${n}:std:${+!!t}:0`)||d.get(`${n}:std:1:1`)||d.get(`${n}:std:1:0`)||null}function Dr(e,t={}){if(e===0){if(T===`cmb`){let e=me;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(T===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((me?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(T===`cluster-merger`){let e=me;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return se.map(t=>({...t,pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return Ce.map(t=>({...t,pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(Ee===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(H!==`nbody`&&H!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${Ve.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(Be?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${Ke?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((Ze?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`}},t=e[H]||e[`quasar-jet`];return[{id:`l2-${H}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(!Me)return[];let e=C(),n=Math.max(0,Math.min(e.length-1,Fe)),r=Me.getMassiveBodyState64(n),i=t.solarScaleAuToWorld??1;return e.map((e,t)=>{let n=Me.getMassiveBodyState64(t),a=(n.posAu[0]-r.posAu[0])*i,o=(n.posAu[1]-r.posAu[1])*i,s=(n.posAu[2]-r.posAu[2])*i,c=!!e.isStar||t===0;return{id:e.id,level:2,bodyIndex:t,spec:e,name:e.name,subtitle:e.subtitle,pos:[a,o,s],radius:Math.max(1e-7,n.radiusAu*i),radiusKm:e.radiusKm,tempK:e.tempK,massLabel:c?`${e.massSolar.toFixed(2)} M☉`:`${(e.massSolar/30034896e-13).toFixed(e.massSolar>1e-5?1:3)} M⊕`,composition:e.composition,nextLevel:c?3:4}})}if(e===3){if(q!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${J.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${bt?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[q]||e[`nebular-mhd`];return[{id:`l3-${q}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}return[{id:`stellar-fusion-core`,level:3,name:`Thermonuclear Fusion Core`,subtitle:`Gate 1 pp/CNO/3α Burn · Q_pp = ${St().ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:K?.coreTempK||15e6,massLabel:`${(et?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((K?.meanXH??.72)*100).toFixed(1)}% · He ${((K?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((K?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4}]}if(e===4){if(Dt!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[Dt];if(e)return[{id:`l4-${Dt}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:jt[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return jt}if(e===5){let e=Er(Ht,!0)?.bundle;return[{id:`md-lattice-atom`,level:5,name:`${e?.symbol||`Fe`} Representative Lattice`,subtitle:`${e?.mechanical?.crystalStructure||`crystal`} · ${Bt?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:Ht,tempK:Vt?.temperatureK||Ut,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:`Phase: ${Vt?.emergentPhase||Gt} · ⟨Z⟩ = ${(Vt?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=Er(qt,Qt)?.bundle,t=e?.symbol||`Fe`,n=`${Jt}${[`s`,`p`,`d`,`f`,`g`][Yt]||`d`} (m=${Xt})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:$t===`molecule`?`${vn[en].formula} Molecule (RHF)`:`${t} (Z=${qt}) · ${n}`,subtitle:$t===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(nn?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${Qt?`Relativistic ON`:`Non-Rel`}) · ${tn?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:qt,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${qt} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=sn?.isotope?.split(`-`)[0]||`Z=${rn}`,t=Number(sn?.bindingPerNucleonMeV??8.79),n=Number(sn?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${an}${e} Atomic Nucleus`,subtitle:`Z=${rn} protons, N=${Math.max(0,an-rn)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${rn} · Neutrons ${Math.max(0,an-rn)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function Or(){pn=!0,Gn();try{E?.destroy()}catch{}try{le?.dispose()}catch{}try{B?.dispose()}catch{}try{ge?.dispose()}catch{}try{Oe?.dispose()}catch{}try{Me?.dispose()}catch{}try{Ie?.dispose()}catch{}try{ze?.dispose()}catch{}try{Ue?.dispose()}catch{}try{qe?.dispose()}catch{}try{Xe?.dispose()}catch{}try{et?.dispose()}catch{}try{nt?.dispose()}catch{}try{pt?.dispose()}catch{}try{gt?.dispose()}catch{}try{yt?.dispose()}catch{}try{Nt?.dispose()}catch{}try{Ft?.dispose()}catch{}try{Lt?.dispose()}catch{}try{Bt?.destroy()}catch{}try{tn?.pointsBuffer?.destroy()}catch{}try{cn?.destroy()}catch{}}return Object.freeze({AU_METERS:he,REAL_SOLAR_SYSTEM_CATALOG:ve,MOLECULE_SPECS:vn,COSMIC_EPOCH_PRESETS:ee,get seed(){return o},get quality(){return s},get cosmicEpochId(){return p},get cosmicEpoch(){return m},get activeGalaxyEnv(){return h},get activeCausalSystem(){return S},get useSolReference(){return _},getActiveSystemCatalog:C,getDefaultPlanetIndex:w,selectCausalStarSite:Tn,sampleNewGalacticSector:En,setUseSolReference:Dn,deriveGalaxyEnvironmentFromCosmicContext:He,deriveStarSystemFromGalacticLocation:We,synthesizeNebularPlanetarySystem:Ge,get cosmoMode(){return T},get cosmoSession(){return E},get cosmoTelemetry(){return k},get cosmoFirstPk(){return N},get cosmoTargets(){return se},get cosmoBaryonSession(){return le},get cosmoBaryonTelemetry(){return me},get galaxyEngine(){return B},get galacticDynamoSession(){return ge},get galacticDynamoTelemetry(){return _e},get galacticDynamoStreamlines(){return V},get galacticB0(){return ye},get galaxyPreset(){return be},get galaxyMetallicity(){return xe},get galaxyFocusPos(){return we},get galaxyBranch(){return Ee},get showGalacticBField(){return De},get smbhEngine(){return Oe},get smbhBodies(){return je},get ismCoolingAnchors(){return Se},get solarEngine(){return Me},get solarMode(){return H},get protoplanetarySession(){return Ie},get protoplanetaryTelemetry(){return Le},get protoplanetaryGasDrag(){return Re},get kerrJetSession(){return ze},get kerrJetTelemetry(){return Be},get kerrSpinA(){return Ve},get relBinarySession(){return Ue},get relBinaryTelemetry(){return Ke},get relBinaryMode(){return U},get radWindL2Session(){return qe},get radWindL2Telemetry(){return Je},get tidalRocheSession(){return Xe},get tidalRocheTelemetry(){return Ze},get solarConservation0(){return Ne},get solarConservation(){return Pe},get focusedSolarBodyIndex(){return Fe},get stellarEngine(){return et},get stellarDynamoSession(){return nt},get stellarDynamoTelemetry(){return W},get stellarDynamoStreamlines(){return G},get stellarB0(){return rt},get stellarMode(){return q},get nebulaMhdSession(){return pt},get nebulaMhdTelemetry(){return mt},get nebulaMhdStreamlines(){return ht},get nebulaB0(){return J},get radWindL3Session(){return gt},get radWindL3Telemetry(){return _t},get magnetosphereSession(){return yt},get magnetosphereTelemetry(){return bt},get magnetosphereFieldLines(){return Ct},get tovCurve(){return Tt},get stellarPreset(){return it},get stellarTelemetry(){return K},get stellarNuclearNetwork(){return ot},get stellarLaneEmden(){return ct},get stellarTimeAccel(){return ut},get planetaryMode(){return Dt},get planetaryResult(){return Ot},get planetaryBodyIndex(){return kt},get planetaryCutaway(){return At},get planetaryAtmoState(){return Mt},get planetaryAtmoSession(){return Nt},get planetaryAtmoTelemetry(){return Pt},get planetaryTriboelectric(){return Y},get cryoPlumeSession(){return Ft},get cryoPlumeTelemetry(){return X},get surfaceActive(){return It},get surfaceSession(){return Lt},get surfaceTelemetry(){return Rt},get surfaceControls(){return zt},get mdSession(){return Bt},get mdTelemetry(){return Vt},get mdElementZ(){return Ht},get mdTempK(){return Ut},get mdGravity(){return Wt},get mdPhasePreset(){return Gt},get mdRdfHistory(){return Kt},get quantumZ(){return qt},get quantumN(){return Jt},get quantumL(){return Yt},get quantumM(){return Xt},get quantumRelativistic(){return Qt},get quantumMode(){return $t},get quantumMoleculeKey(){return en},get orbitalCloud(){return tn},get moleculeRhfResult(){return nn},get nuclearZ(){return rn},get nuclearA(){return an},get nuclearResult(){return sn},get tdseSession(){return cn},get tdseTelemetry(){return ln},evaluateIsmRadiativeCoolingErgCm3PerS:st,evaluateStellarEvolutionaryState:te,buildQuantizedNucleonSpheres:bn,getElementBundle:mn,getCachedElementBundle:Er,ensureLevelInitialized:Xn,initCosmicWeb:xn,initCosmoBaryonRegime:An,initGalaxy:Sn,initSmbhCore:Cn,initSolarSystem:wn,initProtoplanetaryDisk:On,initKerrQuasarJet:jn,initRelativisticBinary:Mn,initRadiativeWindL2:Nn,initTidalRocheL2:Pn,initNebularMhd:kn,initRadiativeWindL3:Fn,initCompactMagnetosphere:In,initWhiteDwarfTovCurve:Ln,initStellarCore:zn,initPlanetaryInterior:Bn,initCryoPlumesL4:Rn,initMolecularDynamics:Vn,initQuantumAtom:Hn,initAtomicNucleus:Un,stepActiveRegimes:Wn,setCosmicEpoch:rr,setCosmoMode:ir,setQuality:Zn,setSeed:Qn,setMdGravity:$n,setMdTemp:er,setPlanetaryCutaway:tr,setPlanetaryTriboelectric:hr,setPlanetaryMode:lr,enterSurfaceView:gr,exitSurfaceView:_r,setSurfaceVehicle:vr,setSurfaceUfoAltitudeKm:yr,setSurfaceCameraMode:br,setSurfaceControls:xr,addSurfaceLookDelta:Sr,setStellarTimeAccel:nr,setSolarMode:ar,setKerrSpinA:or,setProtoplanetaryGasDrag:sr,setStellarMode:cr,setNebulaB0:ur,setGalacticB0:fr,setStellarB0:pr,setCosmoFocusMpc:mr,setShowGalacticBField:dr,setGalaxyBranch:wr,setFocusedSolarBody:Tr,getActiveUniversalLaws:Cr,getTargetsForLevel:Dr,connectPeerMesh:Kn,disconnectPeerMesh:Gn,getPeerMeshState:qn,dispatchPeerDerivation:Jn,dispose:Or})}var Cn=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),wn=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),Tn=`
struct CameraUniforms {
  view_proj: mat4x4<f32>,
  cam_pos: vec4<f32>,    // xyz = camera world position, w = timeSec
  cam_right: vec4<f32>,  // xyz = right basis, w = aspect
  cam_up: vec4<f32>,     // xyz = up basis, w = fovTanHalf
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = log10SpanM
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
};
`,En=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31(cell + 17.1), hash31(cell + 41.7), hash31(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.52);
  let spark = exp(-d * d * 78.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31(cell + 99.9);
  let col = mix(vec3<f32>(0.68, 0.82, 1.0), vec3<f32>(1.0, 0.84, 0.64), temp);
  return col * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let log_span = cam.cam_fwd.w;
  // Subtle Milky Way galactic band visible at solar/planetary scales, darker vacuum at cosmic/quantum
  let gal_vis = smoothstep(23.0, 17.0, log_span) * smoothstep(-4.0, 4.0, log_span);
  let gal_band = exp(-pow(dir.y * 2.8 + dir.x * 0.72, 2.0) * 4.5);
  let dust = 0.5 + 0.5 * sin(dir.x * 4.5 + dir.z * 3.2) * cos(dir.y * 3.9 - dir.x * 2.8);
  let base_void = mix(vec3<f32>(0.005, 0.009, 0.020), vec3<f32>(0.004, 0.007, 0.015), smoothstep(0.0, -8.0, log_span));
  var col = base_void + vec3<f32>(0.028, 0.036, 0.068) * gal_band * dust * (0.25 + 0.75 * gal_vis);

  let star_vis = smoothstep(-6.0, 6.0, log_span) * 0.85 + 0.15;
  col = col + star_layer(dir, 58.0, 0.972) * 1.15 * star_vis;
  col = col + star_layer(dir, 130.0, 0.978) * 0.68 * star_vis;
  col = col + star_layer(dir, 230.0, 0.986) * 0.32 * star_vis;
  return vec4<f32>(col, 1.0);
}
`,Dn=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31_s(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer_s(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31_s(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31_s(cell + 17.1), hash31_s(cell + 41.7), hash31_s(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.50);
  let spark = exp(-d * d * 82.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31_s(cell + 99.9);
  return mix(vec3<f32>(0.72, 0.84, 1.0), vec3<f32>(1.0, 0.86, 0.66), temp) * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;

  // Smooth elevation gradient from horizon haze band to deep zenith sky!
  let elev = clamp(dir.y, -0.35, 1.0);
  let sky_t = pow(clamp((elev + 0.04) / 1.04, 0.0, 1.0), 0.56);
  var col = mix(sky_hor, sky_zen, sky_t);

  // Subtle below-horizon horizon-haze fill so curved TinyPlanet terrain melts seamlessly into the horizon!
  if (dir.y < 0.0) {
    let below = 1.0 - smoothstep(-0.36, 0.0, dir.y);
    col = mix(col, sky_hor * mix(0.96, 0.84, opt_depth), below);
  }

  // Forward Mie solar scattering + crisp HDR solar disk
  let cos_sun = dot(dir, sun_dir);
  let sun_disk = smoothstep(0.9986, 0.9996, cos_sun);
  let sun_halo = pow(max(0.0, cos_sun), 10.0) * (0.28 + 0.52 * opt_depth)
    + pow(max(0.0, cos_sun), 64.0) * (0.55 + 0.65 * opt_depth);
  let sun_col = mix(vec3<f32>(1.0, 0.96, 0.88), vec3<f32>(1.0, 0.78, 0.52), opt_depth * 0.45);
  col = col + sun_col * sun_halo + vec3<f32>(2.4, 2.25, 1.95) * sun_disk;

  // High-contrast crisp stars shine brightly in airless vacuum (Moon/Mercury!) and fade cleanly in atmospheric skies
  let star_vis = clamp((1.0 - smoothstep(0.03, 0.30, opt_depth)) * smoothstep(-0.02, 0.14, dir.y), 0.0, 1.0);
  if (star_vis > 0.02) {
    let stars = star_layer_s(dir, 62.0, 0.970) * 1.25
      + star_layer_s(dir, 140.0, 0.978) * 0.72
      + star_layer_s(dir, 240.0, 0.986) * 0.35;
    col = col + stars * star_vis;
  }

  return vec4<f32>(col, 1.0);
}
`,On=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos_curv: vec4<f32>,
  @location(1) norm_tag: vec4<f32>,
  @location(2) col_emiss: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) albedo: vec3<f32>,
  @location(3) surf_info: vec3<f32>, // x = tag, y = emissive, z = rawHeight
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0);
  out.world_pos = in.pos_curv.xyz;
  out.norm = in.norm_tag.xyz;
  out.albedo = in.col_emiss.rgb;
  out.surf_info = vec3<f32>(in.norm_tag.w, in.col_emiss.w, in.pos_curv.w);
  return out;
}

fn surf_hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn surf_noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(surf_hash(i), surf_hash(i + vec2<f32>(1.0, 0.0)), u.x),
    mix(surf_hash(i + vec2<f32>(0.0, 1.0)), surf_hash(i + vec2<f32>(1.0, 1.0)), u.x),
    u.y
  );
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;

  let n = normalize(in.norm);
  let view_v = cam.cam_pos.xyz - in.world_pos;
  let dist = length(view_v);
  let v = view_v / max(1e-4, dist);
  let half_v = normalize(sun_dir + v);

  let tag = in.surf_info.x;
  let emissive = in.surf_info.y;

  // Fine procedural micro-regolith grain on natural terrain (crisp smooth metal/foil on vehicles!)
  var base_col = in.albedo;
  if (tag < 3.5 && tag != 2.0) {
    let g1 = surf_noise(in.world_pos.xz * 0.72);
    let g2 = surf_noise(in.world_pos.xz * 2.85 + vec2<f32>(11.3, -7.1));
    let grain = 0.86 + 0.20 * g1 + 0.12 * g2;
    base_col = base_col * grain;
  }

  let ndl = max(0.0, dot(n, sun_dir));
  let ndv = max(0.0, dot(n, v));
  let fresnel = pow(1.0 - ndv, 3.8);

  // Hemispheric sky-bounce ambient (deep crisp shadows in vacuum; soft atmospheric scatter in dense air!)
  let hemi_up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  let amb_sky = mix(sky_hor * 0.42 + vec3<f32>(0.04, 0.05, 0.07), sky_zen * 0.55 + vec3<f32>(0.05, 0.06, 0.09), hemi_up);
  let amb_gain = mix(0.24, 0.55, opt_depth);
  let sun_tint = mix(vec3<f32>(1.05, 1.02, 0.96), vec3<f32>(1.12, 0.95, 0.78), opt_depth * 0.35);

  var lit = base_col * (amb_sky * amb_gain + sun_tint * (ndl * 1.18));

  if (tag > 1.5 && tag < 2.5) {
    // Liquid ocean surface: non-orthogonal rotated multi-octave waves + crisp Fresnel sky reflection & sun specular glint!
    let t = cam.cam_pos.w;
    let p_w = in.world_pos.xz;
    let ph1 = dot(p_w, vec2<f32>(0.86, 0.51)) * 0.72 + t * 1.9;
    let ph2 = dot(p_w, vec2<f32>(-0.42, 0.91)) * 1.18 - t * 1.5;
    let ph3 = dot(p_w, vec2<f32>(0.31, -0.95)) * 1.95 + t * 2.4;
    let wn = (surf_noise(p_w * 0.65 + vec2<f32>(t * 0.35, -t * 0.28)) - 0.5) * 0.05;
    let wx = sin(ph1) * 0.024 + cos(ph2) * 0.018 + sin(ph3) * 0.012 + wn;
    let wz = cos(ph1) * 0.020 - sin(ph2) * 0.022 + cos(ph3) * 0.012 - wn;
    let nw = normalize(n + vec3<f32>(wx, 0.0, wz));
    let hw = normalize(sun_dir + v);
    let w_spec = pow(max(0.0, dot(nw, hw)), 84.0) * 1.35;
    let w_fres = pow(1.0 - max(0.0, dot(nw, v)), 3.2);
    lit = mix(lit, sky_hor * 0.95 + vec3<f32>(0.08, 0.16, 0.28), w_fres * 0.70) + sun_tint * w_spec;
  } else if (tag > 3.5) {
    // Metallic Rover & Drone hardware: crisp Blinn-Phong specular + rim edge highlight!
    let m_spec = pow(max(0.0, dot(n, half_v)), 42.0) * 0.65;
    lit = lit + sun_tint * m_spec + (sky_hor * 0.35 + vec3<f32>(0.12, 0.16, 0.22)) * fresnel * 0.45;
  } else {
    // Subtle mineral sheen on ice/basalt slopes
    let r_spec = pow(max(0.0, dot(n, half_v)), 18.0) * select(0.08, 0.26, tag > 0.5 && tag < 1.5);
    lit = lit + sun_tint * r_spec;
  }

  // Per-pixel volcanic basalt-fissure glow enhancement on Magma Ocean worlds (zero blocky vertex borders!)
  var emiss_eff = emissive;
  var emiss_col = in.albedo;
  if (cam.extra2.w > 0.5 && tag < 3.5) {
    let f1 = surf_noise(in.world_pos.xz * 0.38 + vec2<f32>(3.1, -5.2));
    let f2 = surf_noise(in.world_pos.xz * 1.15 - vec2<f32>(7.4, 2.8));
    let vein = 1.0 - smoothstep(0.03, 0.16, abs((f1 * 0.7 + f2 * 0.3) - 0.5));
    let molten = clamp(emissive * (0.65 + 0.55 * f2) + vein * 1.15, 0.0, 2.2);
    emiss_eff = molten;
    emiss_col = mix(vec3<f32>(1.0, 0.24, 0.03), vec3<f32>(1.0, 0.86, 0.32), clamp(molten * 0.62, 0.0, 1.0));
  }
  lit = lit + emiss_col * emiss_eff * 1.20;

  // Exponential atmospheric perspective fog + smooth horizontal radial horizon fade (zero jagged patch rim!)
  let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
  let fog_density = mix(0.0020, 0.0078, opt_depth);
  let fog_amt = clamp(1.0 - exp(-dist * fog_density), 0.0, 0.92);
  let patch_edge = smoothstep(82.0, 146.0, horiz_dist);
  let total_fog = clamp(max(fog_amt, patch_edge), 0.0, 1.0);
  let final_col = mix(lit, sky_hor, total_fog);
  return vec4<f32>(final_col, 1.0);
}
`,kn=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) shape: f32, // 0 = crisp glowing star/spark, 1 = soft volumetric 3D cloud billow, 2 = CFD flow streak
};

fn blackbody_rgb(log10_t: f32) -> vec3<f32> {
  if (log10_t < 2.2) { return vec3<f32>(0.42, 0.24, 0.78); }
  if (log10_t < 3.45) {
    let f = clamp((log10_t - 2.2) / 1.25, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.28, 0.14), vec3<f32>(1.0, 0.56, 0.20), f);
  }
  if (log10_t < 4.1) {
    let f = clamp((log10_t - 3.45) / 0.65, 0.0, 1.0);
    return mix(vec3<f32>(1.0, 0.62, 0.24), vec3<f32>(1.0, 0.96, 0.84), f);
  }
  let f = clamp((log10_t - 4.1) / 2.2, 0.0, 1.0);
  return mix(vec3<f32>(0.96, 0.98, 1.0), vec3<f32>(0.42, 0.78, 1.0), f);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let mode = u32(round(cam.extra0.x));
  let world_scale = cam.extra0.y;
  let pt_size_base = cam.extra0.z;
  let alpha_gain = cam.extra0.w;

  var p_world = vec3<f32>(0.0);
  var col = vec3<f32>(0.6, 0.85, 1.0);
  var pt_size = pt_size_base;
  var alpha = alpha_gain;
  var shape = 0.0;
  var streak_axis = vec3<f32>(0.0);
  var streak_len = 0.0;

  if (mode == 0u) {
    // L0: Supergalactic 2LPT + TreePM (16 floats/particle) — IllustrisTNG / Millennium cosmic web
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let box_sz = max(10.0, cam.extra1.w);
    // Smooth observable-horizon spherical survey vignette (eliminates harsh periodic box wall edges!)
    let r_box = length(raw_p) / box_sz;
    let sphere_fade = 1.0 - smoothstep(0.32, 0.495, r_box);
    if (sphere_fade < 0.01) {
      var culled0: VsOut;
      culled0.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled0.color = vec4<f32>(0.0);
      culled0.uv = vec2<f32>(0.0);
      return culled0;
    }
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.04, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_void = vec3<f32>(0.14, 0.18, 0.62);
    let col_fil = vec3<f32>(0.18, 0.64, 1.0);
    let col_node = vec3<f32>(1.0, 0.72, 0.28);
    var c_dm = mix(col_void, col_fil, smoothstep(0.08, 0.56, rho));
    c_dm = mix(c_dm, col_node, smoothstep(0.60, 0.96, rho));
    let c_bar = mix(vec3<f32>(0.94, 0.38, 0.22), vec3<f32>(1.0, 0.80, 0.36), smoothstep(0.18, 0.90, rho));
    col = select(c_dm, c_bar, is_baryon) * (0.78 + 1.05 * pow(rho, 0.90));
    pt_size = pt_size_base * (0.56 + 0.92 * pow(rho, 0.85));
    alpha = alpha_gain * (0.28 + 0.72 * pow(rho, 0.92)) * sphere_fade;
  } else if (mode == 1u) {
    // L1: Realistic Flat-Rotation Spiral Galaxy (8 floats/star: pos, mass, vel, popTag)
    // popTag < 0 => invisible dark-matter NFW halo particle (provides REAL GPU gravity for flat rotation curve!)
    let o = iid * 8u;
    let pop_tag = raw_f32[o + 7u];
    if (pop_tag < 0.0) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let m = raw_f32[o + 3u];
    // pop_tag encodes astrophysical population (HDR linear colors tone-mapped cleanly via ACES!):
    //   [0.01..0.35]: warm golden-amber bulge & old disk K/M/G stars
    //   [0.35..0.78]: young blue-white spiral-arm O/B/A stars
    //   [0.78..1.10]: rose-magenta H-alpha / H II star-forming knots
    let warm_bulge = vec3<f32>(1.0, 0.68, 0.34);
    let gold_core = vec3<f32>(1.0, 0.84, 0.52);
    let ob_blue = vec3<f32>(0.42, 0.74, 1.0);
    let h2_rose = vec3<f32>(1.0, 0.32, 0.58);
    if (pop_tag < 0.35) {
      let f = clamp(pop_tag / 0.35, 0.0, 1.0);
      col = mix(gold_core, warm_bulge, f);
      pt_size = pt_size_base * (0.45 + 0.55 * (1.0 - f));
      alpha = alpha_gain * (0.24 + 0.34 * (1.0 - f));
    } else if (pop_tag < 0.78) {
      let f = clamp((pop_tag - 0.35) / 0.43, 0.0, 1.0);
      col = mix(vec3<f32>(0.86, 0.91, 1.0), ob_blue, f);
      pt_size = pt_size_base * (0.44 + 0.72 * f);
      alpha = alpha_gain * (0.28 + 0.56 * f);
    } else {
      let f = clamp((pop_tag - 0.78) / 0.32, 0.0, 1.0);
      col = mix(h2_rose, vec3<f32>(1.0, 0.56, 0.78), f);
      pt_size = pt_size_base * (0.95 + 0.75 * f);
      alpha = alpha_gain * (0.36 + 0.44 * f);
    }
    if (m > 25.0) {
      // Galactic nucleus soft warm amber glow (zero giant black hole at 100 kly!)
      col = vec3<f32>(1.0, 0.88, 0.62);
      pt_size = pt_size_base * 1.8;
      alpha = alpha_gain * 0.55;
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro Plasma (16 floats/parcel)
    // Purely physical (log_t, log_rho, log_eps) radiative-transport thermalization:
    //   - Diffuse molecular clouds (log_rho < -5): exact blackbody_rgb(log_t) (violet -> crimson -> amber)
    //   - Optically thick stellar envelope (log_rho >= -5): solar photospheric golden-orange-white
    //     transitioning to radiant white-gold core & luminous cyan-white only in active nuclear fusion / SN!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-0.5, 4.5, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    let thick_star = smoothstep(3.45, 4.10, log_t);
    let env_t = clamp((log_t - 5.2) / 1.9, 0.0, 1.0);
    let solar_surf = mix(vec3<f32>(1.0, 0.42, 0.08), vec3<f32>(1.0, 0.76, 0.28), env_t);
    let solar_mid = mix(solar_surf, vec3<f32>(1.0, 0.94, 0.74), smoothstep(0.55, 0.96, env_t));
    let sn_flash = smoothstep(7.6, 8.6, log_t);
    let star_col = mix(solar_mid, vec3<f32>(0.76, 0.94, 1.0), clamp(fusion_glow * 0.52 + sn_flash * 0.85, 0.0, 1.0));
    let cloud_col = mix(blackbody_rgb(log_t), vec3<f32>(0.58, 0.94, 1.0), fusion_glow * 0.55);
    col = mix(cloud_col, star_col, thick_star) * (0.90 + 0.95 * fusion_glow + 0.35 * sn_flash);
    pt_size = pt_size_base * (0.72 + 1.05 * dens_w);
    alpha = alpha_gain * (0.28 + 0.58 * dens_w);
  } else if (mode == 3u) {
    // L6: Quantum Orbital Point Cloud (4 floats/point: vec4(x, y, z, packed_meta))
    let o = iid * 4u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let packed_meta = raw_f32[o + 3u];
    let mag = clamp(abs(packed_meta), 0.15, 1.0);
    let pos_phase = packed_meta >= 0.0;
    let c_pos = cam.extra1.rgb;
    let c_neg = cam.extra2.rgb;
    col = select(c_neg, c_pos, pos_phase) * (0.70 + 0.95 * mag);
    pt_size = pt_size_base * (0.72 + 0.55 * mag);
    alpha = alpha_gain * (0.30 + 0.70 * mag);
  } else if (mode == 4u) {
    // Mode 4: L2 Real-Scale Solar System Minor Bodies / Main & Kuiper Belt Asteroids (f32x2 double-float!)
    let skip_n = u32(round(cam.extra1.w));
    if (iid < skip_n) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    let o = iid * 16u;
    let dx = (raw_f32[o + 0u] - cam.extra1.x) + (raw_f32[o + 4u] - cam.extra2.x);
    let dy = (raw_f32[o + 1u] - cam.extra1.y) + (raw_f32[o + 5u] - cam.extra2.y);
    let dz = (raw_f32[o + 2u] - cam.extra1.z) + (raw_f32[o + 6u] - cam.extra2.z);
    p_world = vec3<f32>(dx, dy, dz) * world_scale;
    let kind_f = raw_f32[o + 11u];
    col = select(vec3<f32>(0.78, 0.70, 0.56), vec3<f32>(0.54, 0.76, 1.0), kind_f > 6.5);
    pt_size = pt_size_base;
    alpha = alpha_gain * 0.75;
  } else if (mode == 5u) {
    // Mode 5: L3 3D Self-Gravitating Resistive MHD Nebular Collapse & Magnetocentrifugal Bipolar Jets!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let b_mag = raw_f32[o + 7u];
    let rho = raw_f32[o + 11u];
    let u_int = raw_f32[o + 12u];
    let jet_out = raw_f32[o + 13u];
    let dens_f = clamp(log(1.0 + rho * 2.8) * 0.58, 0.0, 1.0);
    let jet_f = smoothstep(0.04, 0.45, jet_out) * smoothstep(0.05, 0.35, b_mag);
    let mag_f = clamp(b_mag * 0.72, 0.0, 1.0);
    // Warm dusty molecular cloud & golden collapsing accretion disk -> electric cyan/violet MHD jet plasma!
    let dust_col = mix(vec3<f32>(0.76, 0.28, 0.32), vec3<f32>(1.0, 0.64, 0.20), dens_f);
    let core_col = mix(dust_col, vec3<f32>(1.0, 0.92, 0.66), smoothstep(0.45, 0.95, dens_f + u_int * 0.22));
    let jet_col = mix(vec3<f32>(0.24, 0.82, 1.0), vec3<f32>(0.76, 0.46, 1.0), mag_f);
    col = mix(core_col, jet_col * 1.55, clamp(jet_f * 0.90 + mag_f * 0.18 * (1.0 - dens_f), 0.0, 1.0));
    pt_size = pt_size_base * (0.58 + 0.82 * dens_f + 0.75 * jet_f);
    alpha = alpha_gain * (0.26 + 0.56 * dens_f + 0.62 * jet_f);
  } else if (mode == 6u) {
    // Mode 6: L2 Protoplanetary Accretion Disk Pebbles (warm silicate dust inside snow line, icy sapphire outside!)
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5 || raw_f32[o + 3u] <= 0.0) {
      var culled6: VsOut;
      culled6.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled6.color = vec4<f32>(0.0);
      culled6.uv = vec2<f32>(0.0);
      return culled6;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let temp_k = raw_f32[o + 8u];
    let ice_f = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let hot_inner = mix(vec3<f32>(0.92, 0.52, 0.24), vec3<f32>(1.0, 0.82, 0.48), clamp((temp_k - 220.0) / 360.0, 0.0, 1.0));
    let icy_outer = vec3<f32>(0.48, 0.80, 1.0);
    col = mix(hot_inner, icy_outer, ice_f);
    pt_size = pt_size_base * (0.78 + 0.45 * ice_f);
    alpha = alpha_gain * (0.48 + 0.36 * (1.0 - ice_f * 0.35));
  } else if (mode == 7u) {
    // Mode 7: Relativistic Kerr/BZ Jet (real camera-angle Doppler beaming!), Magnetar Flares/Pulsar Beams, & BNS Kilonova r-Process Ejecta!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled7: VsOut;
      culled7.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled7.color = vec4<f32>(0.0);
      culled7.uv = vec2<f32>(0.0);
      return culled7;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let role = raw_f32[o + 3u];
    let vel = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let gamma = max(1.0, raw_f32[o + 7u]);
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let aux_ye = raw_f32[o + 9u];
    let emiss = clamp(raw_f32[o + 10u], 0.0, 2.6);
    // Live relativistic Doppler beaming factor delta = 1 / (Gamma * (1 - beta * cos(theta)))!
    // Orbiting into a Quasar jet cone naturally boosts it into a blazing blue-white Blazar!
    let to_obs = normalize(cam.cam_pos.xyz - p_world);
    let v_mag = length(vel);
    let beta = sqrt(max(0.0, 1.0 - 1.0 / (gamma * gamma)));
    let cos_th = select(0.0, dot(vel / v_mag, to_obs), v_mag > 1e-4);
    let doppler = clamp(1.0 / max(0.28, gamma * (1.0 - min(0.88, beta) * cos_th)), 0.35, 3.2);
    let beam_boost = mix(1.0, pow(doppler, 1.35), smoothstep(1.15, 2.5, gamma));
    if (role > 0.5 && role < 1.5) {
      // Relativistic BZ Jet / Polar Lighthouse Beam / Blue Polar Kilonova Wind
      col = mix(vec3<f32>(0.24, 0.72, 1.0), vec3<f32>(0.88, 0.96, 1.0), clamp(beam_boost * 0.45, 0.0, 1.0)) * (0.9 + 0.85 * emiss) * beam_boost;
      pt_size = pt_size_base * (0.65 + 0.55 * min(2.0, beam_boost));
      alpha = alpha_gain * clamp(0.32 + 0.48 * emiss * min(1.8, beam_boost), 0.05, 0.95);
    } else if (role >= 1.5) {
      // Red Lanthanide r-Process Kilonova / Magnetar Giant Flare Fireball / Dusty Torus
      let is_red_rproc = aux_ye > 0.01 && aux_ye < 0.25;
      let base_c = select(
        mix(vec3<f32>(0.92, 0.34, 0.72), vec3<f32>(1.0, 0.86, 0.42), clamp(t_norm * 0.65, 0.0, 1.0)),
        mix(vec3<f32>(0.96, 0.26, 0.14), vec3<f32>(1.0, 0.70, 0.26), clamp(t_norm * 0.7, 0.0, 1.0)),
        is_red_rproc
      );
      col = base_c * (0.75 + 0.95 * emiss);
      pt_size = pt_size_base * (0.82 + 0.65 * clamp(emiss * 0.5, 0.0, 1.0));
      alpha = alpha_gain * clamp(0.26 + 0.52 * emiss, 0.05, 0.92);
    } else {
      // Novikov-Thorne Hot Kerr Accretion Disk / Twisted Magnetosphere Loops
      let disk_c = mix(vec3<f32>(1.0, 0.42, 0.14), vec3<f32>(0.94, 0.96, 1.0), clamp(t_norm * 0.75, 0.0, 1.0));
      col = disk_c * (0.8 + 0.7 * emiss) * mix(1.0, doppler, 0.45);
      pt_size = pt_size_base * (0.62 + 0.52 * min(1.5, t_norm));
      alpha = alpha_gain * clamp(0.30 + 0.48 * emiss, 0.06, 0.88);
    }
  } else if (mode == 8u) {
    // Mode 8: Photoionized Nebulae (H II Pillars / Planetary Nebula / SNR-PWN: H-alpha, [O III], [S II]) + Dual-Tail Comets + Hot-Jupiter XUV!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled8: VsOut;
      culled8.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled8.color = vec4<f32>(0.0);
      culled8.uv = vec2<f32>(0.0);
      return culled8;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let ha = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let o3 = clamp(raw_f32[o + 9u], 0.0, 2.0);
    let s2_dust = clamp(raw_f32[o + 10u], 0.0, 2.0);
    // Physically mapped optical emission palette:
    //   [O III] 500.7nm -> electric teal-cyan, H-alpha 656.3nm -> rose-crimson, [S II]/Dust -> warm amber-gold!
    let c_ha = vec3<f32>(1.0, 0.28, 0.44) * ha;
    let c_o3 = vec3<f32>(0.16, 0.88, 1.0) * o3;
    let c_s2 = vec3<f32>(1.0, 0.72, 0.28) * s2_dust;
    let tot = max(0.12, ha + o3 + s2_dust);
    col = (c_ha + c_o3 + c_s2) * (0.95 / pow(tot, 0.28));
    pt_size = pt_size_base * (0.72 + 0.62 * min(1.5, tot));
    alpha = alpha_gain * clamp(0.24 + 0.56 * min(1.5, tot), 0.05, 0.90);
  } else if (mode == 9u) {
    // Mode 9: Roche-Limit Tidal Disruption Debris, Shepherd-Moon Rings, Giant Impact Ejecta, & Cryovolcanic Ice Plumes!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled9: VsOut;
      culled9.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled9.color = vec4<f32>(0.0);
      culled9.uv = vec2<f32>(0.0);
      return culled9;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let intact = raw_f32[o + 7u];
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let role = raw_f32[o + 10u];
    if (role > 1.5 && role < 2.5) {
      // Cryovolcanic icy water-vapor plume crystals
      col = vec3<f32>(0.68, 0.92, 1.0) * (0.85 + 0.45 * t_norm);
      pt_size = pt_size_base * 0.85;
      alpha = alpha_gain * 0.58;
    } else if (t_norm > 0.72) {
      // Incandescent molten silicate Giant-Impact / Red-Giant engulfment debris
      col = mix(vec3<f32>(0.96, 0.34, 0.10), vec3<f32>(1.0, 0.88, 0.48), clamp((t_norm - 0.72) * 1.1, 0.0, 1.0));
      pt_size = pt_size_base * (0.78 + 0.45 * min(1.2, t_norm));
      alpha = alpha_gain * 0.72;
    } else {
      // Icy/rocky Roche ring & rubble-pile particles
      col = mix(vec3<f32>(0.88, 0.80, 0.66), vec3<f32>(0.76, 0.88, 1.0), select(0.25, 0.75, intact > 0.5));
      pt_size = pt_size_base * select(0.65, 0.95, intact > 0.5);
      alpha = alpha_gain * 0.64;
    }
  } else if (mode == 10u) {
    // Mode 10: Cosmological Baryon & Radiation (CMB ΔT/T Shell, Reionization H II Bubbles, & Galaxy Cluster X-Ray ICM + DM!)
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.05, 6.0);
    let temp_k = raw_f32[o + 8u];
    let x_hii = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let sz_dt = raw_f32[o + 10u];
    let is_dm = raw_f32[o + 11u] > 0.5;
    let flags = u32(round(raw_f32[o + 14u]));
    if ((flags & 1u) != 0u) {
      // CMB Recombination Acoustic Surface (authentic Planck cold-indigo -> deep-teal -> amber-gold -> vermilion ΔT/T!)
      let f = clamp(sz_dt * 0.56 + 0.5, 0.0, 1.0);
      let c_cold = vec3<f32>(0.04, 0.18, 0.88);
      let c_teal = vec3<f32>(0.10, 0.62, 0.72);
      let c_warm = vec3<f32>(0.96, 0.74, 0.18);
      let c_hot  = vec3<f32>(0.95, 0.26, 0.06);
      if (f < 0.35) {
        col = mix(c_cold, c_teal, f / 0.35);
      } else if (f < 0.68) {
        col = mix(c_teal, c_warm, (f - 0.35) / 0.33);
      } else {
        col = mix(c_warm, c_hot, (f - 0.68) / 0.32);
      }
      pt_size = pt_size_base * 1.05;
      alpha = alpha_gain * 0.72;
    } else if ((flags & 2u) != 0u) {
      // Cosmic Dawn Reionization: Neutral dark-crimson HI web vs glowing electric-cyan H II ionization bubbles!
      let c_hi = vec3<f32>(0.48, 0.12, 0.34);
      let c_hii = vec3<f32>(0.10, 0.82, 1.0);
      let c_pop3 = vec3<f32>(1.0, 0.86, 0.44);
      col = mix(c_hi, c_hii, smoothstep(0.08, 0.72, x_hii));
      col = mix(col, c_pop3, smoothstep(0.84, 0.99, x_hii));
      pt_size = pt_size_base * (0.62 + 0.75 * x_hii);
      alpha = alpha_gain * (0.24 + 0.68 * x_hii);
    } else {
      // Bullet-Cluster Galaxy Cluster Merger: Vivid Magenta-Rose X-Ray Shocked ICM vs Deep Electric-Blue DM Lensing Halos!
      let x_em = clamp(log(1.0 + max(0.0, temp_k * 1e-7) * rho) * 0.55, 0.15, 1.15);
      col = select(
        mix(vec3<f32>(0.96, 0.16, 0.48), vec3<f32>(1.0, 0.62, 0.24), clamp(x_em * 0.65, 0.0, 1.0)),
        vec3<f32>(0.14, 0.48, 1.0) * (0.75 + 0.55 * min(1.3, rho * 0.35)),
        is_dm
      );
      pt_size = pt_size_base * select(0.75 + 0.48 * min(1.1, x_em), 1.05, is_dm);
      alpha = alpha_gain * select(0.32 + 0.45 * min(1.0, x_em), 0.72, is_dm);
    }
  } else {
    // Mode 11: Planetary Surface Jump-Rocket Exhaust Flames, Ballistic Regolith Dust, & Drone Rotor Downwash!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.05) {
      var culled11: VsOut;
      culled11.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled11.color = vec4<f32>(0.0);
      culled11.uv = vec2<f32>(0.0);
      return culled11;
    }
    var rp = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let role = raw_f32[o + 3u];
    // Apply exact TinyPlanet spherical curvature drop to surface plumes (roles 0..2);
    // keep 3D volumetric atmospheric CFD cloud strata & vortex tracers (roles 3..4) in true 3D space!
    if (role < 2.5) {
      let dx_c = rp.x - cam.extra1.x;
      let dz_c = rp.z - cam.extra1.z;
      rp.y = rp.y - (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
    }
    p_world = rp * world_scale;
    let age = raw_f32[o + 7u];
    let base_rgb = vec3<f32>(raw_f32[o + 8u], raw_f32[o + 9u], raw_f32[o + 10u]);
    let max_life = max(0.15, raw_f32[o + 11u]);
    let sz = max(0.10, raw_f32[o + 12u]);
    let life_f = clamp(age / max_life, 0.0, 1.0);
    let fade = (1.0 - life_f) * smoothstep(0.0, 0.08, life_f + 0.04);
    if (role < 0.5) {
      // Blazing jump-rocket exhaust: cyan-white hot Mach diamond core -> incandescent orange tail!
      let flame_c = mix(vec3<f32>(0.90, 0.96, 1.0), vec3<f32>(1.0, 0.40, 0.06), clamp(life_f * 2.1, 0.0, 1.0));
      col = flame_c * (2.1 - 0.9 * life_f);
      pt_size = pt_size_base * sz * (0.72 + 1.15 * life_f);
      alpha = alpha_gain * fade * 0.36;
    } else if (role < 1.5) {
      // Sunlit ballistic regolith / dust plume (gentle additive weight so dust never blows out to pure white!)
      col = base_rgb * (0.48 + 0.22 * (1.0 - life_f));
      pt_size = pt_size_base * sz * (0.48 + 0.92 * life_f);
      alpha = alpha_gain * fade * 0.052;
    } else if (role < 2.5) {
      // Subtle drone rotor downwash dust ring & fine wind-blown atmospheric motes!
      col = base_rgb * 0.52;
      pt_size = pt_size_base * sz * (0.42 + 0.55 * life_f);
      alpha = alpha_gain * fade * 0.068;
    } else if (role < 3.5) {
      // 3D Volumetric Atmospheric CFD Cloud Strata Bank (huge soft layered cumulus/NH3/NH4SH billows!)
      let puff_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let d_cam = length(p_world - cam.cam_pos.xyz);
      let near_fade = smoothstep(5.0, 18.0, d_cam);
      col = base_rgb * 0.48;
      pt_size = pt_size_base * sz * 2.15 * (0.85 + 0.30 * puff_fade);
      alpha = alpha_gain * is_live * (0.42 + 0.58 * puff_fade) * near_fade * 0.14;
      shape = 1.0;
    } else {
      // Crisp Velocity-Aligned 3D CFD Flow Ribbon / Eddy Streamline!
      let s_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let v_raw = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
      let v_mag = length(v_raw);
      col = base_rgb * 1.15;
      pt_size = pt_size_base * max(0.28, sz * 0.42);
      alpha = alpha_gain * is_live * (0.28 + 0.72 * s_fade) * 0.42;
      if (v_mag > 0.15) {
        streak_axis = v_raw / v_mag;
        streak_len = clamp(v_mag * 0.36, 1.4, 6.2);
        shape = 2.0;
      }
    }
  }

  var world_corner: vec3<f32>;
  if (shape > 1.5) {
    // Orient billboard cleanly along projected 3D CFD velocity vector so airflow curves visually in 3D!
    let to_cam = normalize(cam.cam_pos.xyz - p_world);
    let side = normalize(cross(streak_axis, to_cam) + vec3<f32>(0.0, 1e-4, 0.0));
    world_corner = p_world
      + streak_axis * (uv.x * streak_len)
      + side * (uv.y * pt_size * 0.42);
  } else {
    world_corner = p_world
      + cam.cam_right.xyz * (uv.x * pt_size)
      + cam.cam_up.xyz * (uv.y * pt_size);
  }
  let clip = cam.view_proj * vec4<f32>(world_corner, 1.0);

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  out.shape = shape;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  var w: f32;
  if (in.shape > 1.5) {
    // Sleek glowing 3D aerodynamic CFD streamline ribbon!
    let core_y = exp(-7.5 * in.uv.y * in.uv.y);
    let tip_x = max(0.0, 1.0 - in.uv.x * in.uv.x);
    w = core_y * tip_x * 1.15;
  } else if (in.shape > 0.5) {
    // Soft broad volumetric 3D cloud billow (zero bright pinpoint snowflake dots!)
    let soft = max(0.0, 1.0 - r2);
    w = soft * soft * 0.72;
  } else {
    let core = exp(-6.2 * r2);
    let halo = exp(-2.2 * r2) * 0.28;
    w = core + halo;
  }
  return vec4<f32>(in.color.rgb * w * in.color.a, in.color.a * w);
}
`,An=`
${Tn}

// 4 vec4s (64 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, true_radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=terrestrial/ocean/rocky, 2=gas-giant/haze, 3=ice/moon, 4=cutaway-planet, 5=black-hole/nucleus, 6=nucleon
//   color1: vec4(r2, g2, b2, atm_strength)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;
// Zero-copy live GPU Planetary Baroclinic Atmosphere + Triboelectric Lightning + Aurora grid!
// 2 vec4 per cell: [i*2+0]=em0(rhoQ, phi, eMag, flash), [i*2+1]=vis(cloud, dust, lightningGlow, auroraGlow)
@group(0) @binding(2) var<storage, read> atmo_em_grid: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) color0: vec4<f32>,
  @location(4) color1: vec4<f32>,
  @location(5) params: vec4<f32>,
  @location(6) quad_uv: vec2<f32>,
  @location(7) pinpoint_w: f32,
  @location(8) @interpolate(flat) inst_id: u32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let sp = spheres[iid];
  let center = sp.pos_r.xyz;
  let radius = sp.pos_r.w;
  let kind = u32(round(sp.color0.w));

  let to_cam_v = cam.cam_pos.xyz - center;
  let dist = max(1e-5, length(to_cam_v));
  let to_cam = to_cam_v / dist;
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);

  // Compute approximate apparent radius in screen height fraction:
  let app_frac = radius / max(1e-5, dist * cam.cam_up.w);
  let min_glint_frac = select(0.0062, 0.013, kind == 0u);
  let pinpoint_w = smoothstep(min_glint_frac * 2.2, min_glint_frac * 0.55, app_frac);
  let min_world_half = dist * cam.cam_up.w * min_glint_frac;

  let base_inflate = radius * select(1.48, 1.24, dist > radius * 2.6);
  let inflate = max(base_inflate, select(0.0, min_world_half, kind <= 4u));
  let world_quad = center + to_cam * min(radius * 0.15, dist * 0.05) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  out.quad_uv = uv;
  out.pinpoint_w = select(0.0, pinpoint_w, kind <= 4u);
  out.inst_id = iid;
  return out;
}

fn sample_live_atmo_vis(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  let lon = atan2(n_hit.z, n_hit.x); // [-pi, pi]
  let lat = asin(clamp(n_hit.y, -1.0, 1.0)); // [-pi/2, pi/2]
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(w_u) - 0.5;
  let gy = v * f32(h_u) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(w_u);
  let hi = i32(h_u);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = atmo_em_grid[(iy0 * w_u + ix0) * 2u + 1u];
  let c10 = atmo_em_grid[(iy0 * w_u + ix1) * 2u + 1u];
  let c01 = atmo_em_grid[(iy1 * w_u + ix0) * 2u + 1u];
  let c11 = atmo_em_grid[(iy1 * w_u + ix1) * 2u + 1u];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

fn hash3(p_in: vec3<f32>) -> f32 {
  var p = fract(p_in * 0.3183099 + vec3<f32>(0.1, 0.2, 0.3));
  p = p * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn vnoise3(x: vec3<f32>) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 0.0)), hash3(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 0.0)), hash3(i + vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 1.0)), hash3(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 1.0)), hash3(i + vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y),
    u.z
  );
}

fn fbm5(p_in: vec3<f32>) -> f32 {
  var p = p_in;
  var sum = 0.0;
  var amp = 0.5;
  for (var i = 0u; i < 5u; i = i + 1u) {
    sum = sum + amp * vnoise3(p);
    p = p * 2.07 + vec3<f32>(13.7, -9.2, 5.4);
    amp = amp * 0.5;
  }
  return sum;
}

fn is_cutaway_octant(p_loc: vec3<f32>, cut_active: f32) -> bool {
  return cut_active > 0.5 && p_loc.x > 0.0 && p_loc.y > 0.0 && p_loc.z > 0.0;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let disc = b * b - c;

  let kind = u32(round(in.color0.w));
  let light_dir = normalize(cam.extra1.xyz);
  let cut_active = in.params.z;

  if (disc < 0.0) {
    // 1. Sub-pixel astronomical pinpoint glint when true physical disk is < ~2.5 px at AU distances
    if (in.pinpoint_w > 0.02) {
      let q2 = dot(in.quad_uv, in.quad_uv);
      if (q2 < 1.0) {
        let g_core = exp(-8.0 * q2);
        let g_halo = exp(-2.6 * q2) * select(0.32, 0.58, kind == 0u);
        let glint_col = mix(in.color0.rgb, vec3<f32>(1.0, 0.98, 0.94), select(0.45, 0.65, kind == 0u));
        let alpha = clamp((g_core + g_halo) * in.pinpoint_w * select(0.95, 1.25, kind == 0u), 0.0, 1.0);
        var out_g: FsOut;
        out_g.color = vec4<f32>(glint_col * (g_core * 1.45 + g_halo) * in.pinpoint_w, alpha);
        let clip_g = cam.view_proj * vec4<f32>(in.center, 1.0);
        out_g.depth = clamp(clip_g.z / max(1e-5, clip_g.w), 0.0, 0.9999);
        return out_g;
      }
    }
    // 2. Physical solar corona glow for stars (kind 0) & Rayleigh atmospheric halo for planets (kind 1/4)
    let closest = max(0.0, -b);
    let d_min = length(ro + rd * closest) / max(1e-6, r);
    if (kind == 0u && d_min < 1.45) {
      let corona = exp(-(d_min - 1.0) * 6.8) * 0.78;
      var out_c: FsOut;
      out_c.color = vec4<f32>(in.color0.rgb * corona * 1.5, corona);
      // Far depth so translucent stellar corona glow NEVER carves square cutouts out of nebula/ring/jet particles!
      out_c.depth = 0.99999;
      return out_c;
    }
    if ((kind == 1u || kind == 4u) && in.color1.w > 0.25 && d_min < 1.07) {
      let h_atmo = exp(-(d_min - 1.0) * 42.0) * in.color1.w * 0.62;
      let lit_side = clamp(dot(normalize(ro + rd * closest), light_dir) * 0.8 + 0.35, 0.0, 1.0);
      var out_a: FsOut;
      out_a.color = vec4<f32>(vec3<f32>(0.34, 0.68, 1.0) * h_atmo * lit_side, h_atmo * lit_side);
      out_a.depth = 0.99999;
      return out_a;
    }
    discard;
  }

  let sqrt_d = sqrt(disc);
  var t_hit = -b - sqrt_d;
  if (t_hit < 0.000001) { t_hit = -b + sqrt_d; }
  if (t_hit < 0.000001) { discard; }

  var p_hit = ro + rd * t_hit;
  var n_hit = normalize(p_hit);
  var is_interior = false;

  // True 3D Cutaway Plane intersection when user enables L4 Planetary Interior Cutaway
  if ((kind == 4u || kind == 1u || kind == 2u) && is_cutaway_octant(p_hit, cut_active)) {
    var best_t = 1e20;
    var best_n = vec3<f32>(0.0, 1.0, 0.0);
    if (abs(rd.x) > 1e-5) {
      let tx = -ro.x / rd.x;
      if (tx > 1e-6 && tx < best_t) {
        let q = ro + rd * tx;
        if (dot(q, q) <= r * r && q.y >= 0.0 && q.z >= 0.0) {
          best_t = tx;
          best_n = vec3<f32>(select(1.0, -1.0, rd.x > 0.0), 0.0, 0.0);
        }
      }
    }
    if (abs(rd.y) > 1e-5) {
      let ty = -ro.y / rd.y;
      if (ty > 1e-6 && ty < best_t) {
        let q = ro + rd * ty;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.z >= 0.0) {
          best_t = ty;
          best_n = vec3<f32>(0.0, select(1.0, -1.0, rd.y > 0.0), 0.0);
        }
      }
    }
    if (abs(rd.z) > 1e-5) {
      let tz = -ro.z / rd.z;
      if (tz > 1e-6 && tz < best_t) {
        let q = ro + rd * tz;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.y >= 0.0) {
          best_t = tz;
          best_n = vec3<f32>(0.0, 0.0, select(1.0, -1.0, rd.z > 0.0));
        }
      }
    }
    if (best_t < 1e19) {
      t_hit = best_t;
      p_hit = ro + rd * t_hit;
      n_hit = best_n;
      is_interior = true;
    } else {
      discard;
    }
  }

  let view_dir = -rd;
  let ndv = max(0.0, dot(n_hit, view_dir));
  let ndl = max(0.0, dot(n_hit, light_dir));
  let soft_term = smoothstep(-0.08, 0.14, dot(n_hit, light_dir));
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 44.0);
  let fresnel = pow(1.0 - ndv, 3.6);
  let seed_v = vec3<f32>(in.params.w * 2.13, in.params.w * 1.47, in.params.w * 3.19);

  var col = vec3<f32>(0.8);

  if (kind == 0u) {
    // Realistic convective solar photosphere with multi-scale granulation & limb darkening
    let g1 = fbm5(n_hit * 8.5 + seed_v + vec3<f32>(cam.cam_pos.w * 0.04, 0.0, 0.0));
    let g2 = fbm5(n_hit * 22.0 - seed_v);
    let gran = clamp(0.65 * g1 + 0.35 * g2, 0.0, 1.0);
    let limb = pow(ndv, 0.52);
    col = mix(in.color1.rgb, in.color0.rgb, 0.35 + 0.65 * gran) * (0.58 + 0.85 * limb);
  } else if (is_interior) {
    // Exact GPU-solved planetary cutaway shells!
    let r_norm = length(p_hit) / max(1e-6, r);
    let r_core = clamp(in.params.x, 0.12, 0.85);
    let r_mantle = clamp(in.params.y, r_core + 0.04, 0.99);
    let r_inner = r_core * 0.46;
    let conv = fbm5(p_hit / max(1e-6, r) * 7.5 + seed_v);
    var shell_col = in.color0.rgb;
    if (r_norm < r_inner) {
      shell_col = vec3<f32>(1.0, 0.93, 0.68) * (0.92 + 0.14 * conv);
    } else if (r_norm < r_core) {
      let f = (r_norm - r_inner) / max(0.02, r_core - r_inner);
      shell_col = mix(vec3<f32>(1.0, 0.68, 0.20), vec3<f32>(0.94, 0.34, 0.10), f) * (0.85 + 0.25 * conv);
    } else if (r_norm < r_mantle) {
      let f = (r_norm - r_core) / max(0.02, r_mantle - r_core);
      shell_col = mix(vec3<f32>(0.76, 0.24, 0.12), vec3<f32>(0.38, 0.26, 0.18), f) * (0.78 + 0.35 * conv);
    } else {
      shell_col = in.color1.rgb;
    }
    let edge_core = smoothstep(0.007, 0.016, abs(r_norm - r_core));
    let edge_mantle = smoothstep(0.007, 0.016, abs(r_norm - r_mantle));
    shell_col = shell_col * (0.55 + 0.45 * edge_core * edge_mantle);
    let shade = 0.52 + 0.48 * max(0.25, dot(n_hit, normalize(vec3<f32>(0.55, 0.72, 0.45))));
    col = shell_col * shade;
  } else if (kind == 2u) {
    // Banded Gas / Dense-Cloud World with live GPU zonal jets, lightning superbolts, & polar aurorae!
    let turb = fbm5(n_hit * 5.2 + seed_v);
    let lat = n_hit.y * 16.0 + (turb - 0.5) * 3.0;
    let band = 0.5 + 0.5 * sin(lat) * cos(lat * 0.45 + turb * 1.6);
    let fine_jet = fbm5(vec3<f32>(n_hit.x * 4.5, n_hit.y * 22.0, n_hit.z * 4.5) + seed_v);
    var base = mix(in.color1.rgb * 0.82, in.color0.rgb * 1.08, clamp(0.18 + 0.58 * band + 0.26 * fine_jet, 0.0, 1.0));
    var em_fx = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      // Modulate storm-band bright ammonia decks & cyclonic ovals without washing out color bands
      let storm_w = smoothstep(0.28, 0.78, av.x);
      base = mix(base, mix(in.color0.rgb, vec3<f32>(0.98, 0.93, 0.84), 0.55), storm_w * 0.34);
      let bolt = smoothstep(0.38, 1.15, av.z);
      em_fx = em_fx + vec3<f32>(0.68, 0.90, 1.0) * bolt * (1.8 + 1.4 * (1.0 - ndl));
      // Electric blue-violet auroral oval glowing cleanly around magnetic cusps
      let aur = clamp(av.w, 0.0, 1.2);
      em_fx = em_fx + mix(vec3<f32>(0.24, 0.78, 1.0), vec3<f32>(0.62, 0.36, 1.0), clamp(abs(n_hit.y), 0.0, 1.0)) * aur * (0.38 + 0.82 * (1.0 - ndl));
    }
    let atm = vec3<f32>(0.58, 0.76, 1.0) * fresnel * in.color1.w;
    col = base * (0.04 + 0.98 * ndl) * soft_term + base * 0.03 + atm * (0.15 + 0.85 * ndl) + em_fx;
  } else if (kind == 1u || kind == 4u) {
    // Photorealistic Terrestrial / Ocean / Mars / Mercury world with 5-octave FBM continents, relief, polar caps, & clouds
    let elev = fbm5(n_hit * 3.4 + seed_v);
    let detail = fbm5(n_hit * 14.0 + seed_v * 1.7);
    let has_ocean = in.color1.b > in.color1.r + 0.14;
    var surf = in.color0.rgb;
    var water_spec = 0.0;

    if (has_ocean) {
      let sea_lvl = 0.51;
      if (elev < sea_lvl) {
        let depth_f = clamp((sea_lvl - elev) / 0.26, 0.0, 1.0);
        surf = mix(vec3<f32>(0.08, 0.42, 0.68), in.color1.rgb * 0.72, depth_f);
        water_spec = spec * 0.68;
      } else {
        let h_land = clamp((elev - sea_lvl) / 0.32, 0.0, 1.0);
        let desert = vec3<f32>(0.68, 0.58, 0.38);
        let mtn = vec3<f32>(0.48, 0.46, 0.44);
        let arid = smoothstep(0.25, 0.72, detail) * (1.0 - abs(n_hit.y));
        surf = mix(in.color0.rgb * (0.75 + 0.45 * detail), desert, arid * 0.55);
        surf = mix(surf, mtn, smoothstep(0.42, 0.85, h_land));
        surf = mix(surf, vec3<f32>(0.92, 0.95, 0.98), smoothstep(0.76, 0.95, h_land));
      }
      // Polar ice caps
      let polar = smoothstep(0.76, 0.90, abs(n_hit.y) + (detail - 0.5) * 0.14);
      surf = mix(surf, vec3<f32>(0.90, 0.94, 0.98), polar);
    } else {
      // Rocky / Mars / Mercury world with craters & dust basins
      let crater = smoothstep(0.32, 0.68, detail);
      surf = mix(in.color1.rgb, in.color0.rgb, clamp(elev * 1.15 - 0.1 + 0.25 * crater, 0.0, 1.0));
      let polar = smoothstep(0.84, 0.94, abs(n_hit.y) + (detail - 0.5) * 0.08);
      surf = mix(surf, vec3<f32>(0.88, 0.90, 0.94), polar * select(0.0, 0.85, in.color1.w > 0.12));
    }

    // Live zero-copy GPU baroclinic clouds, billowing dust storms, Paschen lightning, & polar aurorae!
    let live_atmo = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var em_lightning = vec3<f32>(0.0);
    var em_aurora = vec3<f32>(0.0);
    if (live_atmo) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      // Advect fine wispy 3D FBM cloud micro-structure onto the live GPU baroclinic cloud field
      // so synoptic ITCZ & Rossby storm bands break into realistic feathery cumulus/cyclone wisps (zero blocky texels!)
      let drift_v = vec3<f32>(cam.cam_pos.w * 0.018, 0.0, -cam.cam_pos.w * 0.014);
      let wisp1 = fbm5(n_hit * 10.5 + drift_v + seed_v * 0.6);
      let wisp2 = fbm5(n_hit * 23.0 - drift_v * 1.4 - seed_v);
      let cloud_wisp = clamp(wisp1 * 0.68 + wisp2 * 0.42, 0.0, 1.0);
      let cloud_raw = av.x * (0.55 + 0.85 * cloud_wisp);
      let cloud_d = smoothstep(0.18, 0.72, cloud_raw) * 0.88;
      // Subtle 3D cloud drop-shadow cast onto ocean & continents directly away from host-star light_dir!
      let n_sh = normalize(n_hit + light_dir * 0.018);
      let av_sh = sample_live_atmo_vis(n_sh, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      let cloud_shadow = smoothstep(0.22, 0.72, av_sh.x * (0.55 + 0.85 * cloud_wisp)) * 0.28 * ndl;
      surf = surf * (1.0 - cloud_shadow);
      // Vivid billowing rust-amber aeolian dust fronts modulated by fine turbulent eddies
      let dust_d = smoothstep(0.15, 0.66, av.y * (0.65 + 0.65 * wisp1)) * 0.80;
      surf = mix(surf, vec3<f32>(0.88, 0.48, 0.22), dust_d * select(0.76, 0.18, has_ocean));
      surf = mix(surf, vec3<f32>(0.97, 0.985, 1.0), cloud_d * 0.92);
      water_spec = water_spec * (1.0 - max(cloud_d, dust_d));
      // Real Paschen dielectric-breakdown lightning: crisp localized convective pinpoint flashes inside active storm cores!
      let spark_n = fbm5(n_hit * 34.0 + vec3<f32>(cam.cam_pos.w * 1.8, -cam.cam_pos.w * 1.3, 4.1));
      let spark_core = smoothstep(0.56, 0.82, spark_n);
      let bolt = smoothstep(0.42, 1.20, av.z) * spark_core;
      let bolt_col = mix(vec3<f32>(0.84, 0.56, 1.0), vec3<f32>(0.76, 0.95, 1.0), select(0.20, 1.0, has_ocean));
      em_lightning = bolt_col * bolt * (2.6 + 2.2 * (1.0 - ndl));
      // Core-geodynamo polar auroral oval curtains (emerald-green 557.7nm O I -> violet N2+)!
      let aur = clamp(av.w, 0.0, 1.15);
      em_aurora = mix(vec3<f32>(0.14, 0.96, 0.56), vec3<f32>(0.58, 0.30, 1.0), clamp((abs(n_hit.y) - 0.80) * 4.0, 0.0, 1.0)) * aur * (0.42 + 0.90 * (1.0 - ndl));
    } else if (in.color1.w > 0.45) {
      let c_raw = fbm5(n_hit * 4.8 + vec3<f32>(cam.cam_pos.w * 0.012, 2.4, -1.9) + seed_v);
      let cloud = smoothstep(0.52, 0.74, c_raw) * 0.78;
      surf = mix(surf, vec3<f32>(0.95, 0.97, 1.0), cloud);
      water_spec = water_spec * (1.0 - cloud);
    }

    let rayleigh = mix(vec3<f32>(0.76, 0.52, 0.34), vec3<f32>(0.32, 0.68, 1.0), select(0.25, 1.0, has_ocean));
    let atm = rayleigh * fresnel * in.color1.w * 0.95;
    col = surf * (0.03 + 0.98 * ndl) * soft_term + surf * 0.03 + vec3<f32>(1.0, 0.96, 0.88) * water_spec * ndl + atm * (0.14 + 0.86 * ndl) + em_lightning + em_aurora;
  } else if (kind == 3u) {
    // Cratered Moon / Icy World / Ice Giant (live GPU clouds/lightning/aurora if atmosphere active!)
    let n1 = fbm5(n_hit * 6.0 + seed_v);
    let n2 = fbm5(n_hit * 18.0 - seed_v);
    var base = mix(in.color1.rgb, in.color0.rgb, clamp(0.2 + 0.7 * n1 + 0.25 * n2, 0.0, 1.0));
    var em_ice = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      base = mix(base, vec3<f32>(0.88, 0.94, 1.0), clamp(av.x * 0.52, 0.0, 0.60));
      let bolt = smoothstep(0.32, 1.15, av.z);
      em_ice = em_ice + vec3<f32>(0.68, 0.92, 1.0) * bolt * (1.7 + 1.2 * (1.0 - ndl));
      em_ice = em_ice + vec3<f32>(0.24, 0.96, 0.72) * clamp(av.w, 0.0, 1.4) * (0.42 + 0.85 * (1.0 - ndl));
    }
    let atm = vec3<f32>(0.42, 0.76, 1.0) * fresnel * in.color1.w;
    col = base * (0.04 + 0.96 * ndl) * soft_term + base * 0.03 + vec3<f32>(1.0) * spec * 0.16 * ndl + atm * (0.15 + 0.85 * ndl) + em_ice;
  } else if (kind == 5u) {
    // Event horizon shadow OR glowing atomic nucleus pin
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(1.0 - ndv, 4.8);
      col = vec3<f32>(1.0, 0.88, 0.64) * photon_rim * 1.4;
    } else {
      let base = mix(in.color0.rgb, in.color1.rgb, 0.25 + 0.45 * fresnel);
      col = base * (0.3 + 0.75 * ndl) + vec3<f32>(1.0) * spec * 0.65;
    }
  } else if (kind == 7u) {
    // Kind 7: Incandescent Hadean Magma Ocean World (dark cooled basalt plates rifted by glowing molten lava cracks!)
    let crust = fbm5(n_hit * 4.2 + seed_v);
    let cracks = fbm5(n_hit * 13.5 - seed_v * 1.4);
    let rift = smoothstep(0.46, 0.64, abs(crust - 0.50) * -2.0 + 0.72 + (cracks - 0.5) * 0.35);
    let basalt = mix(vec3<f32>(0.10, 0.08, 0.09), vec3<f32>(0.24, 0.16, 0.14), cracks);
    let lava = mix(vec3<f32>(0.96, 0.22, 0.04), vec3<f32>(1.0, 0.86, 0.32), smoothstep(0.45, 0.95, rift));
    let atm = vec3<f32>(1.0, 0.48, 0.18) * fresnel * in.color1.w * 0.9;
    col = basalt * (0.08 + 0.85 * ndl) * soft_term + lava * rift * 1.65 + atm * (0.35 + 0.65 * ndl);
  } else {
    // Kind 6: Quantized L7 Nuclear Protons (warm ruby-amber) & Neutrons (cool sapphire-silver)
    let base = mix(in.color0.rgb, in.color1.rgb, 0.22 + 0.55 * fresnel);
    col = base * (0.28 + 0.76 * ndl) + vec3<f32>(1.0, 0.96, 0.92) * spec * 0.72 + in.color0.rgb * fresnel * 0.35;
  }

  let world_hit = in.center + p_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,jn=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> md_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> md_vel: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) tint: vec3<f32>,
  @location(4) alpha_fade: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let p_raw = md_pos[iid];
  let v_raw = md_vel[iid];
  let half_box = cam.extra0.xyz;
  let world_scale = cam.extra0.w;
  let radius = cam.extra1.w;
  let alpha_fade = clamp(cam.extra2.x, 0.0, 1.0);
  let ideal_coord = max(4.0, cam.extra2.w);

  let center = (p_raw.xyz - half_box) * world_scale;
  let raw_coord = p_raw.w;
  // On frame 0 before first neighbor build raw_coord can be 0; treat 0 as crystal base color!
  let coord_frac = select(clamp(raw_coord / ideal_coord, 0.0, 1.2), 1.0, raw_coord < 0.01);
  let speed = length(v_raw.xyz);
  let heat = clamp(speed * 1.4, 0.0, 1.0);

  // True Gate 1 optical reflectance for solid crystals; warm amber glow on melted low-coord atoms
  let base_rgb = cam.extra1.rgb;
  let liq_rgb = mix(base_rgb, vec3<f32>(1.0, 0.56, 0.20), 0.52);
  let vap_rgb = mix(base_rgb, vec3<f32>(0.42, 0.84, 1.0), 0.55);
  var tint = mix(vap_rgb, liq_rgb, smoothstep(0.08, 0.35, coord_frac));
  tint = mix(tint, base_rgb, smoothstep(0.35, 0.72, coord_frac));
  tint = mix(tint, vec3<f32>(1.0, 0.82, 0.48), heat * 0.22);

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * radius * 1.24) + up * (uv.y * radius * 1.24);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.tint = tint;
  out.alpha_fade = alpha_fade;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - in.radius * in.radius;
  let disc = b * b - c;
  if (disc < 0.0) { discard; }
  let t_hit = -b - sqrt(disc);
  if (t_hit < 0.001) { discard; }
  let p_hit = ro + rd * t_hit;
  let n = normalize(p_hit);
  let light = normalize(vec3<f32>(0.62, 0.80, 0.52));
  let light2 = normalize(vec3<f32>(-0.55, -0.30, 0.75));
  let view = -rd;
  let ndl = max(0.0, dot(n, light));
  let ndl2 = max(0.0, dot(n, light2));
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 52.0);
  let rim = pow(1.0 - max(0.0, dot(n, view)), 3.0);
  let col = in.tint * (0.20 + 0.78 * ndl + 0.18 * ndl2) + vec3<f32>(1.0, 0.98, 0.94) * spec * 0.68 + in.tint * rim * 0.24;
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col * in.alpha_fade, in.alpha_fade);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,Mn=`
${Tn}

struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> disks: array<DiskInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_xy: vec2<f32>,
  @location(1) r_in: f32,
  @location(2) r_out: f32,
  @location(3) color_kind: vec4<f32>,
  @location(4) world_pos: vec3<f32>,
  @location(5) center: vec3<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let d = disks[iid];
  let n = normalize(d.normal_r_out.xyz);
  let ref_v = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n.y) > 0.9);
  let t1 = normalize(cross(ref_v, n));
  let t2 = cross(n, t1);
  let r_out = d.normal_r_out.w;
  let world_pos = d.center_r_in.xyz + (t1 * uv.x + t2 * uv.y) * r_out;

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_pos, 1.0);
  out.local_xy = uv * r_out;
  out.r_in = d.center_r_in.w;
  out.r_out = r_out;
  out.color_kind = d.color_kind;
  out.world_pos = world_pos;
  out.center = d.center_r_in.xyz;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r = length(in.local_xy);
  if (r > in.r_out || r < in.r_in) { discard; }
  let kind = u32(round(in.color_kind.w));

  if (kind == 0u) {
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let ang = atan2(in.local_xy.y, in.local_xy.x);
    let shear = 0.55 + 0.45 * sin(ang * 3.0 + 16.0 / (u + 0.22) - cam.cam_pos.w * 2.2);
    let rel_p = in.world_pos - in.center;
    let tang = normalize(vec3<f32>(-rel_p.z, 0.0, rel_p.x) + vec3<f32>(1e-5));
    let view_dir = normalize(cam.cam_pos.xyz - in.world_pos);
    let beta = 0.44 / sqrt(max(0.18, u + 0.16));
    let doppler = clamp(1.0 + beta * dot(tang, view_dir), 0.35, 1.92);
    let beam = doppler * doppler;

    let hot_inner = vec3<f32>(0.90, 0.96, 1.0);
    let mid_gold = vec3<f32>(1.0, 0.66, 0.24);
    let cool_red = vec3<f32>(0.76, 0.18, 0.06);
    var col = mix(hot_inner, mid_gold, smoothstep(0.0, 0.35, u));
    col = mix(col, cool_red, smoothstep(0.30, 0.95, u));
    col = mix(col, vec3<f32>(0.75, 0.92, 1.0), clamp((doppler - 1.0) * 0.55, 0.0, 0.5));
    let radial_fade = (1.0 - smoothstep(0.58, 1.0, u)) * smoothstep(0.0, 0.07, u);
    let alpha = clamp(radial_fade * (0.48 + 0.52 * shear) * 0.92, 0.0, 1.0);
    return vec4<f32>(col * beam * (0.62 + 0.52 * shear) * alpha, alpha);
  } else {
    // Saturn Cassini-division ring system
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let cassini = 1.0 - 0.88 * exp(-pow((u - 0.60) * 32.0, 2.0));
    let encke = 1.0 - 0.60 * exp(-pow((u - 0.88) * 55.0, 2.0));
    let ringlets = 0.72 + 0.28 * sin(u * 76.0) * cos(u * 27.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
    let alpha = clamp(fade * cassini * encke * ringlets * 0.74, 0.0, 0.86);
    return vec4<f32>(in.color_kind.rgb * (0.85 + 0.25 * ringlets) * alpha, alpha);
  }
}
`,Nn=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos: vec3<f32>,
  @location(1) color: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(in.pos, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`,Pn=`
${Tn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn fetch_vox(i: vec3<u32>, dim: u32) -> vec4<f32> {
  return vol_data[(i.z * dim + i.y) * dim + i.x];
}

fn sample_vol(p_unit: vec3<f32>, dim: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = fetch_vox(vec3<u32>(i0.x, i0.y, i0.z), dim);
  let c100 = fetch_vox(vec3<u32>(i1.x, i0.y, i0.z), dim);
  let c010 = fetch_vox(vec3<u32>(i0.x, i1.y, i0.z), dim);
  let c110 = fetch_vox(vec3<u32>(i1.x, i1.y, i0.z), dim);
  let c001 = fetch_vox(vec3<u32>(i0.x, i0.y, i1.z), dim);
  let c101 = fetch_vox(vec3<u32>(i1.x, i0.y, i1.z), dim);
  let c011 = fetch_vox(vec3<u32>(i0.x, i1.y, i1.z), dim);
  let c111 = fetch_vox(vec3<u32>(i1.x, i1.y, i1.z), dim);
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(0.5, cam.extra0.y);
  let tdse_tun = cam.extra0.z;
  let tdse_crest_r = clamp(cam.extra0.w, 0.36, 0.95);
  let alpha_mul = clamp(cam.extra1.x, 0.0, 1.0);
  if (alpha_mul < 0.01) { discard; }

  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = cam.cam_pos.xyz / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  let inv_rd = 1.0 / (rd + select(vec3<f32>(0.0), vec3<f32>(1e-6), abs(rd) < vec3<f32>(1e-6)));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(0.0, max(tmin_v.x, max(tmin_v.y, tmin_v.z)));
  let t_exit = min(tmax_v.x, min(tmax_v.y, tmax_v.z));
  if (t_exit <= t_enter) { discard; }

  let steps = 44u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_vol(p, dim);
    let rho_p = v.x;
    let rho_n = v.y;
    let dens = v.w;
    let rr = length(p);

    // Translucent Woods-Saxon potential aura + bright neutron-skin edge + emerald TDSE tunneling shell
    let edge_shell = dens * (1.0 - dens) * 4.0;
    let skin_col = mix(vec3<f32>(1.0, 0.45, 0.16), vec3<f32>(0.18, 0.84, 1.0), clamp((rho_n - rho_p) * 4.8 + 0.45, 0.0, 1.0));
    let tdse_ring = exp(-pow((rr - tdse_crest_r) * 20.0, 2.0)) * (0.25 + 0.85 * clamp(tdse_tun * 5.0, 0.0, 1.0));
    let shell_col = vec3<f32>(0.24, 1.0, 0.72);

    let sigma = (edge_shell * 0.55 + tdse_ring * 0.65) * dt;
    let emit = (skin_col * edge_shell * 0.85 + shell_col * tdse_ring * 1.65) * dt;
    accum = accum + trans * emit;
    trans = trans * exp(-sigma);
    if (trans < 0.05) { break; }
  }
  let alpha = clamp((1.0 - trans) * alpha_mul, 0.0, 0.82);
  if (alpha < 0.004) { discard; }
  return vec4<f32>(accum * alpha_mul, alpha);
}
`,Fn=`
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,
  bh_strength: f32,
  warp_amount: f32,
  flash_amount: f32,
  crt_enabled: f32,
  pixel_size: f32,
  time_sec: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  var uv = in.uv;
  let aspect = u.resolution.x / max(1.0, u.resolution.y);

  if (u.crt_enabled > 0.5 && u.pixel_size > 1.0) {
    let step_uv = vec2<f32>(u.pixel_size) / max(vec2<f32>(1.0), u.resolution);
    uv = (floor(uv / step_uv) + 0.5) * step_uv;
  }

  // Exact Schwarzschild Einstein-ring deflection around projected SMBH UV (active ONLY at SMBH Core scale!)
  var photon_glow = vec3<f32>(0.0);
  if (u.bh_strength > 1e-6) {
    let d_aspect = vec2<f32>((uv.x - u.bh_uv.x) * aspect, uv.y - u.bh_uv.y);
    let r2 = dot(d_aspect, d_aspect);
    let r = sqrt(max(1e-6, r2));
    let rs = sqrt(u.bh_strength) * 0.65;
    let outside_shadow = smoothstep(rs * 0.85, rs * 1.25, r);
    let falloff = exp(-r2 * 18.0) * outside_shadow;
    let deflect = (u.bh_strength / max(r2 + rs * rs * 0.75, 0.0005)) * falloff;
    let dir_uv = vec2<f32>(d_aspect.x / aspect, d_aspect.y) / max(r, 1e-4);
    uv = clamp(uv - dir_uv * min(0.095, deflect * 0.11), vec2<f32>(0.001), vec2<f32>(0.999));
    let ring = exp(-pow((r - rs * 1.16) / max(0.005, rs * 0.22), 2.0)) * 0.48;
    photon_glow = vec3<f32>(1.0, 0.86, 0.64) * ring;
  }

  var col = textureSample(scene_tex, scene_samp, uv).rgb + photon_glow;

  if (u.warp_amount > 0.005) {
    let from_c = uv - vec2<f32>(0.5, 0.5);
    var streak = vec3<f32>(0.0);
    for (var s = 1u; s <= 4u; s = s + 1u) {
      let f = f32(s) * 0.012 * u.warp_amount;
      let uv_r = clamp(uv - from_c * (f * 1.12), vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_g = clamp(uv - from_c * f, vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_b = clamp(uv - from_c * (f * 0.88), vec2<f32>(0.001), vec2<f32>(0.999));
      streak.r += textureSample(scene_tex, scene_samp, uv_r).r;
      streak.g += textureSample(scene_tex, scene_samp, uv_g).g;
      streak.b += textureSample(scene_tex, scene_samp, uv_b).b;
    }
    col = mix(col, (col + streak * 0.24) * (1.0 + 0.30 * u.warp_amount), clamp(u.warp_amount, 0.0, 0.72));
  }

  if (u.flash_amount > 0.002) {
    let rad = length((in.uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0));
    let burst = exp(-rad * rad * 1.8) * u.flash_amount;
    col = col + vec3<f32>(1.0, 0.92, 0.78) * burst * 2.0;
  }

  col = aces_tonemap(col * 1.12);

  if (u.crt_enabled > 0.5) {
    let scan = 0.82 + 0.18 * sin(in.uv.y * u.resolution.y * 1.65);
    let vig_d = length((in.uv - vec2<f32>(0.5)) * 1.38);
    let vig = clamp(1.0 - vig_d * vig_d * 0.45, 0.35, 1.0);
    col = col * scan * vig;
    col = mix(col, col * vec3<f32>(0.92, 1.04, 1.02), 0.35);
  }

  return vec4<f32>(col, 1.0);
}
`;function In(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let r=navigator.gpu.getPreferredCanvasFormat();function i(){let t=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],i=null;for(let e of t)try{n.configure(e);return}catch(e){i=e}if(i)throw i}i();let a=`rgba16float`,o=`depth24plus`,s=0,c=0,l=null,u=null,d=null,f=null,p=e.createBuffer({label:`uv-cam-base`,size:176,usage:Cn.UNIFORM|Cn.COPY_DST}),m=e.createBuffer({label:`uv-cam-cloud-a`,size:176,usage:Cn.UNIFORM|Cn.COPY_DST}),h=e.createBuffer({label:`uv-cam-cloud-b`,size:176,usage:Cn.UNIFORM|Cn.COPY_DST}),g=e.createBuffer({label:`uv-cam-aux`,size:176,usage:Cn.UNIFORM|Cn.COPY_DST}),_=e.createBuffer({label:`uv-post-uniform`,size:48,usage:Cn.UNIFORM|Cn.COPY_DST}),v=e.createSampler({magFilter:`linear`,minFilter:`linear`}),y=e.createBuffer({label:`uv-spheres`,size:320*64,usage:Cn.STORAGE|Cn.COPY_DST}),b=e.createBuffer({label:`uv-disks`,size:768,usage:Cn.STORAGE|Cn.COPY_DST}),x=24576,S=e.createBuffer({label:`uv-lines`,size:x*28,usage:Cn.VERTEX|Cn.COPY_DST}),C=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:Cn.STORAGE|Cn.COPY_DST}),w=1024*32*16,T=(t,n)=>e.createShaderModule({label:t,code:n}),E=T(`uv-backdrop`,En),D=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_main`},fragment:{module:E,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),O=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),k=T(`uv-surface-sky`,Dn),A=e.createRenderPipeline({label:`uv-surface-sky-pipe`,layout:`auto`,vertex:{module:k,entryPoint:`vs_main`},fragment:{module:k,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),j=e.createBindGroup({layout:A.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),M=T(`uv-surface-mesh`,On),N=e.createRenderPipeline({label:`uv-surface-mesh-pipe`,layout:`auto`,vertex:{module:M,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:M,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),ee=e.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),P=T(`uv-cloud`,kn),F=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:P,entryPoint:`vs_main`},fragment:{module:P,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),I=T(`uv-lit-sphere`,An),L=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_main`},fragment:{module:I,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),te=e.createBuffer({label:`uv-dummy-atmo-em`,size:64,usage:Cn.STORAGE|Cn.COPY_DST}),R=new WeakMap;function ne(t){let n=t||te,r=R.get(n);return r||(r=e.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:n}}]}),R.set(n,r)),r}let z=T(`uv-md-sphere`,jn),re=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),ie=T(`uv-disk`,Mn),ae=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:ie,entryPoint:`vs_main`},fragment:{module:ie,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),oe=e.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:b}}]}),se=T(`uv-line`,Nn),ce=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:se,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:se,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),le=e.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),ue=T(`uv-nuclear-vol`,Pn),de=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:ue,entryPoint:`vs_main`},fragment:{module:ue,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),fe=e.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]}),pe=T(`uv-post`,Fn),me=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:pe,entryPoint:`vs_main`},fragment:{module:pe,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),B=null,he=new WeakMap,ge=new WeakMap,_e=new WeakMap;function V(t,n){let r=n===0?he:ge,i=n===0?m:h,a=r.get(t);return a||(a=e.createBindGroup({layout:F.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:t}}]}),r.set(t,a)),a}function ve(t,n){let r=_e.get(t);return r||(r=e.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),_e.set(t,r)),r}function ye(t,n){let r=Math.max(2,Math.floor(t)),p=Math.max(2,Math.floor(n));l&&s===r&&c===p||(s=r,c=p,i(),l?.destroy(),d?.destroy(),l=e.createTexture({label:`uv-scene-color`,size:[s,c],format:a,usage:wn.RENDER_ATTACHMENT|wn.TEXTURE_BINDING}),u=l.createView(),d=e.createTexture({label:`uv-scene-depth`,size:[s,c],format:o,usage:wn.RENDER_ATTACHMENT}),f=d.createView(),B=e.createBindGroup({layout:me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:u},{binding:2,resource:v}]}))}function be(t){!t||t.byteLength===0||(t.byteLength>w&&(C.destroy(),w=t.byteLength,C=e.createBuffer({label:`uv-nuclear-vol`,size:w,usage:Cn.STORAGE|Cn.COPY_DST}),fe=e.createBindGroup({layout:de.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]})),e.queue.writeBuffer(C,0,t))}let xe=new Float32Array(44),Se=new Float32Array(12),Ce=new Float32Array(320*16),we=new Float32Array(192),Te=new Float32Array(x*7);function Ee(t,n,r,i,a){xe.set(n.viewProj,0),xe.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),xe.set([n.right[0],n.right[1],n.right[2],n.aspect],20),xe.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),xe.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),xe.set(r||[0,0,0,0],32),xe.set(i||[0,0,0,0],36),xe.set(a||[0,0,0,0],40),e.queue.writeBuffer(t,0,xe)}function De({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:o=null,surfaceScene:l=null,lightDir:d=[.6,.75,.55],mdCloud:v=null,disks:C=null,lines:w=null,nuclearVol:T=null,post:E={}}){ye(t.width,t.height);let k=0;if(Array.isArray(a)&&a.length>0){k=Math.min(320,a.length);for(let e=0;e<k;e+=1){let t=a[e],n=e*16;Ce[n+0]=t.pos[0],Ce[n+1]=t.pos[1],Ce[n+2]=t.pos[2],Ce[n+3]=t.radius,Ce[n+4]=t.color0[0],Ce[n+5]=t.color0[1],Ce[n+6]=t.color0[2],Ce[n+7]=t.kind??1,Ce[n+8]=t.color1?.[0]??t.color0[0],Ce[n+9]=t.color1?.[1]??t.color0[1],Ce[n+10]=t.color1?.[2]??t.color0[2],Ce[n+11]=t.atm??.35,Ce[n+12]=t.rCore??.52,Ce[n+13]=t.rMantle??.94,Ce[n+14]=+!!t.cutaway,Ce[n+15]=t.seed??(e+1)*1.37}e.queue.writeBuffer(y,0,Ce.subarray(0,k*16))}let M=0;if(Array.isArray(C)&&C.length>0){M=Math.min(16,C.length);for(let e=0;e<M;e+=1){let t=C[e],n=e*12;we[n+0]=t.center[0],we[n+1]=t.center[1],we[n+2]=t.center[2],we[n+3]=t.rIn,we[n+4]=t.normal[0],we[n+5]=t.normal[1],we[n+6]=t.normal[2],we[n+7]=t.rOut,we[n+8]=t.color?.[0]??.9,we[n+9]=t.color?.[1]??.85,we[n+10]=t.color?.[2]??.72,we[n+11]=t.kind??0}e.queue.writeBuffer(b,0,we.subarray(0,M*12))}let P=0;w&&w.length>=14&&(P=Math.min(x,Math.floor(w.length/7)),Te.set(w.subarray(0,P*7),0),e.queue.writeBuffer(S,0,Te.subarray(0,P*7)));let I=!!(o&&o.buffer&&o.width>0&&o.height>0);Ee(p,r,[r.level||0,0,0,0],[d[0],d[1],d[2],0],I?[o.width,o.height,o.sphereIndex??0,1]:[1,1,-1,0]);let te=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,2);for(let e=0;e<te.length;e+=1){let t=te[e];Ee(e===0?m:h,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0])}if(l&&l.env){let e=l.env,t=l.lightDir||d;Ee(g,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],1/(2*(e.tinyPlanetCurvatureRadiusM||280))],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],+!!e.isMagmaOcean])}else v&&v.positionsBuffer&&v.velocitiesBuffer&&v.count>0?Ee(g,r,[v.halfBox[0],v.halfBox[1],v.halfBox[2],v.worldScale],[v.baseRgb[0],v.baseRgb[1],v.baseRgb[2],v.radius],[v.alphaFade??1,0,0,v.idealCoord||12]):T&&T.dim>0&&Ee(g,r,[T.dim,T.boxRadius||3.4,T.tdseTunneled||0,T.tdseCrestNorm||.72],[T.alphaMul??1,0,0,0],[0,0,0,0]);Se[0]=s,Se[1]=c,Se[2]=E.bhUv?.[0]??.5,Se[3]=E.bhUv?.[1]??.5,Se[4]=E.bhStrength??0,Se[5]=E.warpAmount??0,Se[6]=E.flashAmount??0,Se[7]=+!!E.crtEnabled,Se[8]=E.pixelSize??3,Se[9]=E.timeSec??0,Se[10]=0,Se[11]=0,e.queue.writeBuffer(_,0,Se);let R=e.createCommandEncoder({label:`uv-frame-fused`});{let e=R.beginRenderPass({colorAttachments:[{view:u,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:f,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});l&&l.env?(e.setPipeline(A),e.setBindGroup(0,j),e.draw(3,1,0,0),!l.hideTerrain&&l.terrainVertBuf&&l.terrainIdxBuf&&l.indexCount>0&&(e.setPipeline(N),e.setBindGroup(0,ee),e.setVertexBuffer(0,l.terrainVertBuf),e.setIndexBuffer(l.terrainIdxBuf,`uint32`),e.drawIndexed(l.indexCount,1,0,0,0)),l.vehicleVertBuf&&l.vehicleVertCount>0&&(e.setPipeline(N),e.setBindGroup(0,ee),e.setVertexBuffer(0,l.vehicleVertBuf,0,l.vehicleVertCount*48),e.draw(l.vehicleVertCount,1,0,0))):(e.setPipeline(D),e.setBindGroup(0,O),e.draw(3,1,0,0)),P>0&&(e.setPipeline(ce),e.setBindGroup(0,le),e.setVertexBuffer(0,S,0,P*28),e.draw(P,1,0,0)),k>0&&(e.setPipeline(L),e.setBindGroup(0,ne(I?o.buffer:null)),e.draw(6,k,0,0)),v&&v.positionsBuffer&&v.velocitiesBuffer&&v.count>0&&(e.setPipeline(re),e.setBindGroup(0,ve(v.positionsBuffer,v.velocitiesBuffer)),e.draw(6,v.count,0,0)),M>0&&(e.setPipeline(ae),e.setBindGroup(0,oe),e.draw(6,M,0,0));for(let t=0;t<te.length;t+=1){let n=te[t];e.setPipeline(F),e.setBindGroup(0,V(n.buffer,t)),e.draw(6,n.count,0,0)}T&&T.dim>0&&(e.setPipeline(de),e.setBindGroup(0,fe),e.draw(3,1,0,0)),e.end()}{let e=n.getCurrentTexture().createView(),t=R.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(me),t.setBindGroup(0,B),t.draw(3,1,0,0),t.end()}e.queue.submit([R.finish()])}function Oe(){l?.destroy(),d?.destroy();for(let e of[p,m,h,g,_,y,te,b,S,C])try{e.destroy()}catch{}}return Object.freeze({renderFrame:De,uploadNuclearVolume:be,dispose:Oe})}function Ln(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function Rn(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function zn(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Bn(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Vn(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.25,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=n*r*a,o}function Hn(e,t,n){let r=Bn(Ln(t,e)),i=Bn(Rn(r,n)),a=Rn(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-zn(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-zn(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=zn(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function Un(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function Wn(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function Gn(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function Kn(e){return Math.max(0,Math.min(1,e))}function qn(e,t,n){let r=Kn((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function Jn(e,t,n,r,i){return e<=t||e>=i?0:e<n?qn(t,n,e):e>r?1-qn(r,i,e):1}function Yn(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function Xn(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.catalog||ve,s=Math.min(e.massiveCount,o.length),c=Array.from({length:s},(t,n)=>e.getMassiveBodyState64(n)),l=c[0]?.posAu||[0,0,0],u=c[0]?.velAuPerYr||[0,0,0],d=c[0]?.massSolar||1;if(s>=2&&(o[1]?.isStar||o[1]?.orbitRole===`binary-companion`)){let e=c[0].massSolar,t=c[1].massSolar;d=Math.max(1e-12,e+t),l=[(e*c[0].posAu[0]+t*c[1].posAu[0])/d,(e*c[0].posAu[1]+t*c[1].posAu[1])/d,(e*c[0].posAu[2]+t*c[1].posAu[2])/d],u=[(e*c[0].velAuPerYr[0]+t*c[1].velAuPerYr[0])/d,(e*c[0].velAuPerYr[1]+t*c[1].velAuPerYr[1])/d,(e*c[0].velAuPerYr[2]+t*c[1].velAuPerYr[2])/d]}for(let e=1;e<s;e+=1){let s=o[e],f=s.parent===-2,p=f?-2:s.parent>=0?s.parent:0,m=!!s.isStar,h=!m&&p>=0&&!o[p]?.isStar&&p>0;if(h&&r>10.6||!h&&r<8.4)continue;let g=f?l:c[p].posAu,_=f?u:c[p].velAuPerYr,v=f?d:c[p].massSolar,y=c[e],b=y.posAu[0]-g[0],x=y.posAu[1]-g[1],S=y.posAu[2]-g[2],C=y.velAuPerYr[0]-_[0],w=y.velAuPerYr[1]-_[1],T=y.velAuPerYr[2]-_[2],E=Math.hypot(b,x,S),D=C*C+w*w+T*T,O=_e*(v+y.massSolar);if(!(E>1e-8&&O>1e-12))continue;let k=.5*D-O/E;if(k>=-1e-6)continue;let A=-O/(2*k),j=Rn([b,x,S],[C,w,T]),M=Math.hypot(j[0],j[1],j[2]);if(!(M>1e-10))continue;let N=[j[0]/M,j[1]/M,j[2]/M],ee=Rn([C,w,T],j),P=[ee[0]/O-b/E,ee[1]/O-x/E,ee[2]/O-S/E],F=Math.min(.985,Math.hypot(P[0],P[1],P[2])),I=F>1e-5?[P[0]/F,P[1]/F,P[2]/F]:Bn([b,x,S]),L=Rn(N,I),te=A*Math.sqrt(Math.max(.01,1-F*F)),R=g[0]-t[0],ne=g[1]-t[1],z=g[2]-t[2],re=s.color0||[.38,.72,1],ie=(m?.52:h?.34:s.id===`halley`?.16:.28)*i,ae=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=A*(Math.cos(t)-F),i=te*Math.sin(t),o=[(R+r*I[0]+i*L[0])*n,(ne+r*I[1]+i*L[1])*n,(z+r*I[2]+i*L[2])*n];ae&&(a.push(...ae,re[0],re[1],re[2],ie),a.push(...o,re[0],re[1],re[2],ie)),ae=o}}return a}function Zn(e,{focusedSolarBodyIndex:t=3,galaxyBranch:n=`solar-system`}={}){return e>=22.3?0:e>=16.2?1:e>=8.75?n!==`smbh-core`&&t===0&&e<=9.8?3:2:e>=-5.6?t===0&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function Qn(e){let t=Math.max(2e5,(Number(e?.radiusKm)||6371)*1e3),n=e?.ringed?5.2:3.65;return Math.min(8.68,Math.max(6.2,Math.log10(t*n)))}function $n(e){return Math.max(De,Math.min(Ee,Number(e)))}async function er(){if(!navigator.gpu)throw Error(`navigator.gpu is unavailable in this browser.`);let e=null;for(let t=0;t<6&&!e;t+=1)e=await navigator.gpu.requestAdapter({powerPreference:`high-performance`}),e||await new Promise(e=>setTimeout(e,250));if(!e)throw Error(`No WebGPU adapter available on this device.`);let t=await e.requestDevice(),n=[];t.addEventListener(`uncapturederror`,e=>{n.push(String(e?.error?.message??e))}),S(t,`ulg-universes-demo`);let r=new URLSearchParams(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(r.get(`Z`)||r.get(`z`)||`26`,10)||26)),a=Number.parseInt(r.get(`seed`)||`20261125`,10)||20261125,o=Ae[r.get(`quality`)]?r.get(`quality`):`med`,s=Oe[0].log10SpanM;r.has(`scale`)?s=$n(Number.parseFloat(r.get(`scale`))||24.8):r.has(`level`)&&(s=Oe[Math.max(0,Math.min(7,Number.parseInt(r.get(`level`),10)||0))].log10SpanM);let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-epoch-rail`),p=document.getElementById(`uv-zoom-slider`),m=document.getElementById(`uv-zoom-readout`),h=document.getElementById(`uv-status-dot`),g=document.getElementById(`uv-scale-badge`),_=document.getElementById(`uv-fps-badge`),v=document.getElementById(`uv-autopilot-btn`),y=document.getElementById(`uv-sim-btn`),b=document.getElementById(`uv-config-btn`),x=document.getElementById(`uv-help-btn`),C=document.getElementById(`uv-sim-drawer`),w=document.getElementById(`uv-config-drawer`),T=document.getElementById(`uv-help-drawer`),E=document.getElementById(`uv-pause-btn`),D=document.getElementById(`uv-orbit-up-btn`),O=document.getElementById(`uv-timescale-slider`),k=document.getElementById(`uv-timescale-val`),A=document.getElementById(`uv-bigbang-btn`),j=document.getElementById(`uv-reseed-btn`),M=document.getElementById(`uv-scale-controls`),N=document.getElementById(`uv-quality-group`),ee=document.getElementById(`uv-lensing-toggle`),P=document.getElementById(`uv-orbits-toggle`),F=document.getElementById(`uv-travel-toggle`),I=document.getElementById(`uv-autospin-toggle`),L=document.getElementById(`uv-crt-toggle`),te=document.getElementById(`uv-pixel-slider`),R=document.getElementById(`uv-pixel-val`),ne=document.getElementById(`uv-peer-url`),z=document.getElementById(`uv-peer-role`),re=document.getElementById(`uv-peer-connect-btn`),ie=document.getElementById(`uv-peer-status`),ae=document.getElementById(`uv-inspector`),oe=document.getElementById(`uv-collapse-btn`),ce=document.getElementById(`uv-info-quick-btn`),ue=document.getElementById(`uv-target-kicker`),de=document.getElementById(`uv-target-name`),fe=document.getElementById(`uv-target-sub`),pe=document.getElementById(`uv-spec-title`),me=document.getElementById(`uv-comp-text`),B=document.getElementById(`uv-spectrograph-canvas`),ge=document.getElementById(`uv-stats-grid`),_e=document.getElementById(`uv-plot-title`),V=document.getElementById(`uv-plot-meta`),ye=document.getElementById(`uv-plot-canvas`),be=document.getElementById(`uv-dive-btn`),xe=document.getElementById(`uv-focus-mote-btn`),Se=document.getElementById(`uv-surface-quick-btn`),Ce=document.getElementById(`uv-return-btn`),we=document.getElementById(`uv-engine-tag`),Te=document.getElementById(`uv-breadcrumb`),Pe=document.getElementById(`uv-hint-pill`),Fe=document.getElementById(`uv-surface-hud`),H=document.getElementById(`uv-surf-telemetry`),Ie=document.getElementById(`uv-surf-chem-bar`),Le=document.getElementById(`uv-surf-jump-btn`),Re=document.getElementById(`uv-surf-descend-btn`),ze=document.getElementById(`uv-surf-vehicle-btn`),Be=document.getElementById(`uv-surf-cam-btn`),Ve=document.getElementById(`uv-surf-orbit-btn`),He=document.getElementById(`uv-touch-pads`),Ue=document.getElementById(`uv-joy-move`),We=document.getElementById(`uv-joy-move-knob`),Ge=document.getElementById(`uv-joy-look`),Ke=document.getElementById(`uv-joy-look-knob`),U=document.getElementById(`uv-warp-overlay`),qe=document.getElementById(`uv-help-scale-tag`),Je=document.getElementById(`uv-about-scale-btn`),Ye=document.getElementById(`uv-about-ulg-btn`),Xe=document.getElementById(`uv-modal-backdrop`),Ze=document.getElementById(`uv-modal-title`),Qe=document.getElementById(`uv-modal-sub`),$e=document.getElementById(`uv-modal-content`),et=document.getElementById(`uv-modal-close`),tt=In(t,c),nt=se(t),W=Sn(t,{seed:a,qualityId:o,initialElementZ:i}),G=Zn(s,{focusedSolarBodyIndex:W.focusedSolarBodyIndex,galaxyBranch:W.galaxyBranch}),rt=null,it=null,K=null,at=!1,ot=[0,0,0],st=[],ct=0,lt=!0,ut=1,dt=!0,q=!0,ft=r.get(`cameraAutoSpin`)===`1`,pt=r.get(`crt`)===`1`,mt=3,ht=r.get(`autopilot`)===`1`,J=0,gt=!1,_t=0,vt=null,yt=0,bt={yaw:.56,pitch:.42,dist:18},xt=new Float32Array(16),St=window.innerWidth,Ct=window.innerHeight,wt={},Tt=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(I&&(I.checked=ft),L&&(L.checked=pt),v&&ht&&(v.classList.add(`active`),v.textContent=`⏹ Stop Tour`),N)for(let e of N.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=Oe.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);if(Number.isFinite(t)){if(W.surfaceActive&&Ht(),ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),t===3)W.setFocusedSolarBody(0);else if(t===4){let e=W.getActiveSystemCatalog();(e[W.focusedSolarBodyIndex]?.isStar||W.focusedSolarBodyIndex===0)&&W.setFocusedSolarBody(W.getDefaultPlanetIndex(e))}Pt(Oe[t].log10SpanM)}})}function Et(){if(f)for(let e of f.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===W.cosmicEpochId)}if(f){f.innerHTML=W.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===W.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of f.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await W.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:G}),Et(),X(),Y(),Z(),$(performance.now())})}p?.addEventListener(`input`,e=>{W.surfaceActive&&Ht(),ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),vt=null,s=Math.max(De,Math.min(Ee,Number(e.target.value))),Mt(s)});function Dt(){let e=Math.min(window.devicePixelRatio||1,2);St=Math.max(320,window.innerWidth),Ct=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(St*e)),n=Math.max(2,Math.floor(Ct*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==St||l.height!==Ct)&&(l.width=St,l.height=Ct)}Dt(),window.addEventListener(`resize`,Dt);let Ot=[{el:C,btn:y},{el:w,btn:b},{el:T,btn:x}];function kt(e){for(let t of Ot){let n=t.el===e&&!t.el?.classList.contains(`open`);t.el?.classList.toggle(`open`,n),t.btn?.classList.toggle(`active`,n)}}function At(){for(let e of Ot)e.el?.classList.remove(`open`),e.btn?.classList.remove(`active`)}y?.addEventListener(`click`,()=>kt(C)),b?.addEventListener(`click`,()=>kt(w)),x?.addEventListener(`click`,()=>kt(T));for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>At());function jt(e,t,n){At(),Ze&&(Ze.textContent=e),Qe&&(Qe.textContent=t),$e&&($e.innerHTML=n),Xe?.classList.add(`open`)}et?.addEventListener(`click`,()=>Xe?.classList.remove(`open`)),Xe?.addEventListener(`click`,e=>{e.target===Xe&&Xe.classList.remove(`open`)}),Je?.addEventListener(`click`,()=>{let e=Oe[G];jt(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ne(e))}),ce?.addEventListener(`click`,()=>{let e=Oe[G];jt(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ne(e))}),Ye?.addEventListener(`click`,()=>{jt(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,Me())}),oe?.addEventListener(`click`,()=>{let e=ae?.classList.toggle(`collapsed`);oe&&(oe.textContent=e?`+`:`−`)});async function Mt(e){let t=Zn(e,{focusedSolarBodyIndex:W.focusedSolarBodyIndex,galaxyBranch:W.galaxyBranch}),n=new Set([t]);e>=20.5&&n.add(0),e>=14.8&&e<=23.5&&n.add(1),e>=6.5&&e<=18.2&&n.add(2),e>=6.8&&e<=10.8&&W.focusedSolarBodyIndex===0&&n.add(3),e>=-6.2&&e<=9.2&&W.focusedSolarBodyIndex>0&&n.add(4),e>=-10&&e<=-4.5&&n.add(5),e>=-13.5&&e<=-8.4&&n.add(6),e<=-11.5&&n.add(7);let r=W.nuclearResult;for(let e of n)await W.ensureLevelInitialized(e);W.nuclearResult&&W.nuclearResult!==r&&W.nuclearResult.volumeData&&tt.uploadNuclearVolume(W.nuclearResult.volumeData)}function Nt(e=W.focusedSolarBodyIndex){if(!W.solarEngine||e<=0)return;let t=W.solarEngine.getMassiveBodyState64(e),n=W.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];bt.yaw=Math.atan2(r,i)-.92,bt.pitch=.24}function Pt(e){vt=Math.max(De,Math.min(Ee,Number(e))),Mt(vt)}function Y(){if(M)if(G===0)M.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${W.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${W.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${W.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${W.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${W.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:W.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:W.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${W.quality.cosmoGridPerSide}³</code> particles on a <code>${W.quality.cosmoFftN}³</code> periodic FFT mesh.`}</div>`,M.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await W.setCosmoMode(e.target.value),X(),Y(),Z(),$(performance.now())});else if(G===1)M.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${W.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${W.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="binary" ${W.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${W.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${W.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${W.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${W.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${W.galaxyBranch===`solar-system`?`selected`:``}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${W.galaxyBranch===`smbh-core`?`selected`:``}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${W.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${W.galaxyMetallicity.toFixed(1)}</span>
        </div>
        <div class="uv-row" title="Seed field B₀ for the live GPU 24³ 3D α–ω galactic dynamo (0 = strictly zero B-field!)">
          <span>Dynamo B₀</span>
          <input id="uv-gal-b0-slider" type="range" min="0.0" max="0.8" step="0.05" value="${W.galacticB0.toFixed(2)}" />
          <span id="uv-gal-b0-val" style="font-family:var(--mono);font-size:11px;">${W.galacticB0.toFixed(2)}</span>
        </div>`,M.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await W.initGalaxy({preset:e.target.value}),K=null,at=!1,X(),Y(),$(performance.now())}),M.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;W.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),Mt(s)}),M.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await W.initGalaxy({preset:W.galaxyPreset,metallicity:t})}),M.querySelector(`#uv-gal-b0-slider`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-gal-b0-val`);n&&(n.textContent=t.toFixed(2)),await W.setGalacticB0(t),Z(),$(performance.now())});else if(G===2)W.galaxyBranch===`smbh-core`?(M.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,M.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{W.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await W.ensureLevelInitialized(2),Y()})):(M.innerHTML=`
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${W.solarMode===`nbody`?`selected`:``}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${W.solarMode===`formation`?`selected`:``}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${W.solarMode===`roche-rings`?`selected`:``}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${W.solarMode===`giant-impact`?`selected`:``}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${W.solarMode===`comet-tails`?`selected`:``}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${W.solarMode===`hot-jupiter`?`selected`:``}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${W.solarMode===`red-giant`?`selected`:``}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${W.solarMode===`quasar-jet`?`selected`:``}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="xray-binary" ${W.solarMode===`xray-binary`?`selected`:``}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${W.solarMode===`bns-kilonova`?`selected`:``}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${W.solarMode===`type-ia`?`selected`:``}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${W.solarMode===`bbh-merger`?`selected`:``}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${W.solarMode===`formation`?`
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${W.protoplanetaryGasDrag?`checked`:``} />
            </label>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(W.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          `:W.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${W.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${W.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:W.solarMode===`nbody`?(()=>{let e=W.getActiveSystemCatalog(),t=W.activeCausalSystem,n=t?.starSystem?.nebulaEnv,r=t?.condensationFrontsAu;return`
            <div style="font-size:10.5px;color:#cbd5e1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;padding:6px 7px;line-height:1.35;">
              <div><strong>${W.useSolReference?`Sol Reference (G2V · 8 Planets)`:`${t?.systemName||`System`} · ${t?.architecture||`single`} (${t?.starCount||1}★, ${t?.planetCount||0} planets${t?.hasEarthLike?`, Earth-like!`:``})`}</strong></div>
              ${!W.useSolReference&&n?`<div style="color:var(--muted);margin-top:2px;">Nebula: <code>${n.nebulaSummary}</code> · Snow <code>${r?.rSnowLineAu} AU</code> · HZ <code>${r?.rHzInnerAu}–${r?.rHzOuterAu} AU</code></div>`:`<div style="color:var(--muted);margin-top:2px;">Reference J2000 Solar System (exact astronomical radii: Earth = 0.00916 R☉).</div>`}
            </div>
            <div class="uv-seg-group">
              <button id="uv-sample-star-btn" class="uv-seg-btn" type="button" title="Sample a new star from the live galaxy and synthesize its nebular planetary system">🎲 New Galactic Star</button>
              <button id="uv-toggle-sol-btn" class="uv-seg-btn ${W.useSolReference?`active`:``}" type="button" title="Toggle between Causal Galactic Nebular Synthesis and Sol Reference System">${W.useSolReference?`🌌 Causal Nebular`:`☀ Sol Reference`}</button>
            </div>
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${e.map((e,t)=>`<option value="${t}" ${t===W.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>`})():`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,M.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await W.setSolarMode(e.target.value),X(),Y(),Z(),$(performance.now())}),M.querySelector(`#uv-sample-star-btn`)?.addEventListener(`click`,async()=>{await W.sampleNewGalacticSector(),X(),It(),Z(),$(performance.now())}),M.querySelector(`#uv-toggle-sol-btn`)?.addEventListener(`click`,async()=>{await W.setUseSolReference(!W.useSolReference),X(),It(),Z(),$(performance.now())}),M.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{W.setProtoplanetaryGasDrag(e.target.checked)}),M.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await W.setKerrSpinA(t),Z(),$(performance.now())}),M.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=W.getActiveSystemCatalog();W.setFocusedSolarBody(t),rt=n[t]?.id||null,!n[t]?.isStar&&t>0&&await W.initPlanetaryInterior({bodyIndex:t}),Z(),$(performance.now())}));else if(G===3){M.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${W.stellarMode===`fusion`?`selected`:``}>Thermonuclear Fusion Core (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${W.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${W.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars ([O III]/Hα/[S II])</option>
            <option value="planetary-nebula" ${W.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${W.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN</option>
            <option value="pulsar" ${W.stellarMode===`pulsar`?`selected`:``}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${W.stellarMode===`magnetar`?`selected`:``}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${W.stellarMode===`white-dwarf-tov`?`selected`:``}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${W.stellarMode===`nebular-mhd`?`
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${W.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${W.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        `:W.stellarMode===`fusion`?`
          <div class="uv-seg-group">
            <button class="uv-seg-btn ${W.stellarPreset===`main-sequence-star`?`active`:``}" data-st-preset="main-sequence-star" type="button">Active Star</button>
            <button class="uv-seg-btn ${W.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${W.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${W.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${W.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${W.stellarTimeAccel.toFixed(1)}×</span>
          </div>
          <div class="uv-row" title="Seed B₀ for the live GPU 24³ 3D stellar convective dynamo (0 = zero coronal B-field!)">
            <span>Dynamo B₀</span>
            <input id="uv-st-b0" type="range" min="0.0" max="0.9" step="0.05" value="${W.stellarB0.toFixed(2)}" />
            <span id="uv-st-b0-val" style="font-family:var(--mono);font-size:11px;">${W.stellarB0.toFixed(2)}</span>
          </div>
        `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,M.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await W.setStellarMode(e.target.value),K=null,at=!1,X(),Y(),Z(),$(performance.now())}),M.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await W.setNebulaB0(t)});for(let e of M.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await W.initStellarCore({preset:e.dataset.stPreset}),K=null,at=!1,Y(),Z(),$(performance.now())});M.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{W.setStellarTimeAccel(Number(e.target.value));let t=M.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${W.stellarTimeAccel.toFixed(1)}×`)}),M.querySelector(`#uv-st-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-st-b0-val`);n&&(n.textContent=t.toFixed(2)),await W.setStellarB0(t),Z(),$(performance.now())})}else if(G===4){let e=W.planetaryAtmoState?.activation;M.innerHTML=`
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${W.planetaryMode===`standard`?`selected`:``}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${W.planetaryMode===`magma-ocean`?`selected`:``}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${W.planetaryMode===`cryo-plumes`?`selected`:``}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${W.planetaryMode===`eyeball-locked`?`selected`:``}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${W.planetaryMode===`rogue`?`selected`:``}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${W.getActiveSystemCatalog().map((e,t)=>e.isStar||t===0?``:`<option value="${t}" ${t===W.planetaryBodyIndex?`selected`:``}>${e.name} (${e.radiusKm.toLocaleString()} km)</option>`).join(``)}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${W.planetaryTriboelectric?`checked`:``} ${e?.triboelectricActive?``:`disabled`} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${W.planetaryCutaway?`checked`:``} />
        </label>
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${W.surfaceActive?`🚀 Launch Back to Orbit (Esc)`:`🚙 Land on Surface (Rover + Drone)`}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${W.surfaceActive?`planetary-surface-vehicles · `:``}${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,M.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await W.setPlanetaryMode(e.target.value),W.surfaceActive?await Vt({bodyIndex:W.planetaryBodyIndex}):(X(),Y(),Z(),$(performance.now()))}),M.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);W.setFocusedSolarBody(t),await W.initPlanetaryInterior({bodyIndex:t}),W.surfaceActive?await Vt({bodyIndex:t}):(s=Qn(W.getActiveSystemCatalog()[t]),Nt(t),X(),It())}),M.querySelector(`#uv-land-surface-btn`)?.addEventListener(`click`,async()=>{W.surfaceActive?Ht():await Vt({bodyIndex:W.planetaryBodyIndex})}),M.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{W.setPlanetaryTriboelectric(e.target.checked)}),M.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{W.setPlanetaryCutaway(e.target.checked)})}else if(G===5){M.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${ke.map(e=>`<option value="${e.Z}" ${e.Z===W.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${W.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${W.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${W.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,W.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${W.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${W.mdGravity?`checked`:``} />
        </label>`,M.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await W.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),X(),Y()});for(let e of M.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await W.initMolecularDynamics({Z:W.mdElementZ,phasePreset:e.dataset.mdPhase}),Y()});M.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{W.setMdTemp(Number(e.target.value));let t=M.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${W.mdTempK} K`)}),M.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{W.setMdGravity(e.target.checked)})}else if(G===6){M.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${W.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${W.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${W.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${ke.map(e=>`<option value="${e.Z}" ${e.Z===W.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===W.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<W.quantumN).map(e=>`<option value="${e}" ${e===W.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${W.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(W.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${W.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${W.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of M.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await W.initQuantumAtom({mode:e.dataset.qmMode}),X(),Y()});M.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await W.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),X(),Y()}),M.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await W.initQuantumAtom({n:t,l:Math.min(W.quantumL,t-1),m:0}),Y()}),M.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await W.initQuantumAtom({l:Number(e.target.value),m:0}),Y()}),M.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await W.initQuantumAtom({relativistic:e.target.checked}),X()});for(let e of M.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await W.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),X(),Y()})}else G===7&&(M.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${ke.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===W.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,M.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await W.initAtomicNucleus({Z:Number(t),A:Number(n)}),W.nuclearResult?.volumeData&&tt.uploadNuclearVolume(W.nuclearResult.volumeData),X()}),M.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{W.tdseSession?.resetWavepacket?.()}))}function Ft(){let e=W.getTargetsForLevel(G,wt);return e.find(e=>e.id===rt)||e[0]||null}function X(){let e=W.getTargetsForLevel(G,wt);rt=G===2&&W.galaxyBranch!==`smbh-core`?W.getActiveSystemCatalog()[W.focusedSolarBodyIndex]?.id||e[0]?.id||null:e[0]?.id||null}function It(){let e=Oe[G];if(g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=je(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),qe&&(qe.textContent=`L${e.level}`),we&&(we.textContent=e.engineSchema),_e&&(_e.textContent=e.plotTitle),be&&(be.textContent=e.diveButton),Se&&(Se.style.display=G===4&&!W.surfaceActive?`inline-flex`:`none`),Ce&&(Ce.disabled=G===0&&!W.surfaceActive),D&&(D.disabled=G===0&&!W.surfaceActive),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===G);if(Te){let e=W.getActiveSystemCatalog();Tt[2]=W.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:W.useSolReference?`Sol Reference`:W.activeCausalSystem?.systemName||`Star System`,Tt[4]=e[W.planetaryBodyIndex]?.name||`World`;let t=Tt.slice(0,G+1);Te.innerHTML=t.map((e,n)=>n===t.length-1?`<strong>${e}</strong>`:e).join(` › `)}Y()}async function Lt(){let e=Ft();if(G===0&&K?.kind===`cosmo-web`){let e=Number(K.localOverdensity)||1.2,t=W.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:W.cosmicEpoch,regionPosMpc:K.rawPos,localOverdensity:e,seed:W.seed});await W.initGalaxy({galaxyEnvOverride:t})}else G===1&&(K?.kind===`galaxy-star`&&K.starSite?(W.setGalaxyBranch(`solar-system`,K.rawPos),await W.selectCausalStarSite(K.starSite)):e?.branch&&(W.setGalaxyBranch(e.branch,e.pos),e.branch===`solar-system`&&e.starSite&&await W.selectCausalStarSite(e.starSite)));if(G===2&&e?.bodyIndex!=null){let t=W.getActiveSystemCatalog();W.setFocusedSolarBody(e.bodyIndex),!t[e.bodyIndex]?.isStar&&e.bodyIndex>0&&await W.initPlanetaryInterior({bodyIndex:e.bodyIndex})}G===4&&e?.sampleZ&&await W.initMolecularDynamics({Z:e.sampleZ,phasePreset:`solid`}),G===5&&e?.sampleZ&&await W.initQuantumAtom({Z:e.sampleZ,mode:`atom`}),G===6&&e?.sampleZ&&(await W.initAtomicNucleus({Z:e.sampleZ}),W.nuclearResult?.volumeData&&tt.uploadNuclearVolume(W.nuclearResult.volumeData));let t=e?.nextLevel==null?(G+1)%8:e.nextLevel;if(t===4){let e=W.getActiveSystemCatalog();(e[W.focusedSolarBodyIndex]?.isStar||W.focusedSolarBodyIndex===0)&&W.setFocusedSolarBody(W.getDefaultPlanetIndex(e))}Pt(Oe[t].log10SpanM)}async function Rt(){if(W.surfaceActive){Ht();return}G<=0||Pt(Oe[G-1].log10SpanM)}function zt(){if(!W.surfaceSession)return;let e=W.surfaceSession,t=e.env,n=e.activeVehicle,r=!!e.cfdProfile,i=n;i=t.hasSolidCrust?r?n===`rover`?`drone`:n===`drone`?`ufo`:`rover`:n===`drone`?`rover`:`drone`:n===`ufo`?`drone`:`ufo`,W.setSurfaceVehicle(i),Bt(),$(performance.now())}function Bt(){let e=!!(W.surfaceActive&&W.surfaceSession);if(Fe?.classList.toggle(`active`,e),He?.classList.toggle(`active`,e),Se){let t=W.getActiveSystemCatalog()[W.planetaryBodyIndex]||ve[3],n=(Number(t?.radiusKm)||6371)>=16e3;Se.textContent=n?`🛸 Dive`:`🚙 Land`,Se.title=n?`Deploy Buoyant 3D CFD Research UFO into deep planetary atmosphere (L)`:`Land 6-Wheel Rover / Drone / 3D CFD UFO on planetary surface (L)`,Se.style.display=G===4&&!e?`inline-flex`:`none`}if(Pe&&(Pe.style.display=e?`none`:``),!e)return;let t=W.surfaceSession,n=W.surfaceTelemetry||t.getTelemetry(),r=t.env,i=t.activeVehicle===`ufo`,a=t.activeVehicle===`drone`,o=W.getActiveSystemCatalog()[W.planetaryBodyIndex]||ve[3],s=W.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:W.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:o.name,c=n.rhoAtmKgM3??r.rhoAtmKgM3,l=c>1e-4?`ρ=${c.toFixed(c<.1?3:2)} kg/m³`:`<span class="warn">VACUUM (0 Pa)</span>`,u=n.cfdTelemetry,d=u?.chemistry,f=i?`🛸 3D CFD UFO`:a?`🚁 DRONE`:`🚙 ROVER`,p;if(i&&d){let e=d.pressureBar>=.1?`${d.pressureBar.toFixed(2)} bar`:`${(d.pressureBar*101.325).toFixed(1)} kPa`,t=u?.craftWindSpeedMS||0;p=`Alt ${d.altKm.toFixed(1)} km · <strong>${e}</strong> · ${Math.round(d.tempK)} K · <span class="good">3D Wind ${t.toFixed(1)} m/s</span> · Deck: <strong>${d.activeCloudDeck}</strong>`}else p=a?r.droneFlightCapable?`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · Spd ${(n.droneSpeedMS||0).toFixed(1)} m/s · <span class="good">Lift ${(n.droneAeroLiftN||0).toFixed(1)}/${r.maxAeroLiftN.toFixed(1)} N</span>`:`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`:`Alt ${(n.roverAltitudeM||0).toFixed(1)} m · Spd ${(n.roverSpeedMS||0).toFixed(1)} m/s · Fuel ${Math.round((n.roverRocketFuel??1)*100)}%`;if(H&&(H.innerHTML=`<span><strong>${f}</strong> · ${s} · g=${r.gravityMS2.toFixed(2)} m/s² · ${l} · ${p}</span>`),Ie)if(i&&d&&d.species?.length>0){let e=d.species.slice(0,5).map(e=>{let t=e.moleFrac*100,n=t>=1?`${t.toFixed(1)}%`:t>=.01?`${t.toFixed(2)}%`:`${(t*1e4).toFixed(0)} ppm`,r=e.condensedFrac>1e-6?` <span class="warn">(☁)</span>`:``;return`<span><strong>${e.id}</strong> ${n}${r}</span>`}).join(` · `),t=u?.craftWindMS||[0,0,0];Ie.innerHTML=`<span>3D CFD: v=(${t[0].toFixed(1)}, ${t[1].toFixed(1)}, ${t[2].toFixed(1)}) m/s · |ω|=${(u?.craftVorticity||0).toFixed(2)}</span> · ${e}`,Ie.style.display=`flex`}else Ie.style.display=`none`;Le&&(Le.textContent=i||a?`⬆ ASCEND (Space)`:`🔥 ROCKET JUMP`,Le.classList.toggle(`firing`,!!W.surfaceControls.jump)),Re&&(Re.style.display=i||a?`inline-flex`:`none`,Re.classList.toggle(`active`,!!W.surfaceControls.down)),ze&&(r.hasSolidCrust?t.cfdProfile?ze.textContent=i?`🛸 3D CFD UFO (F→Rover)`:a?`🚁 DRONE (F→UFO)`:`🚙 ROVER (F→Drone)`:ze.textContent=a?`🚙 SWITCH ROVER (F)`:`🚁 DEPLOY DRONE (F)`:ze.textContent=i?`🛸 3D CFD UFO (F→Drone)`:`🚁 DRONE (F→UFO)`,ze.classList.toggle(`active`,i||a)),Be&&(Be.textContent=t.cameraMode===`first-person`?`📷 1ST CAM (V)`:`📷 3RD CAM (V)`,Be.classList.toggle(`active`,t.cameraMode===`first-person`))}async function Vt({bodyIndex:e=null,planetaryModeOverride:t=null}={}){ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),vt=null;let n=e;if(typeof n==`string`){let e=W.getActiveSystemCatalog(),t=e.findIndex(e=>e.id===n);n=t>=0&&!e[t].isStar?t:ve.findIndex(e=>e.id===n)>0?n:W.planetaryBodyIndex}else if(!(n>0)){let e=W.getActiveSystemCatalog();n=!e[W.focusedSolarBodyIndex]?.isStar&&W.focusedSolarBodyIndex>0?W.focusedSolarBodyIndex:W.getDefaultPlanetIndex(e)}return G=4,s=2,await W.enterSurfaceView({bodyIndex:n,planetaryModeOverride:t}),X(),It(),Bt(),Z(),$(performance.now()),W.surfaceTelemetry}function Ht(){if(!W.surfaceActive)return;W.exitSurfaceView();let e=W.getActiveSystemCatalog()[W.planetaryBodyIndex]||ve[3];G=4,s=Qn(e),Nt(W.planetaryBodyIndex),It(),Bt(),Z(),$(performance.now())}Se?.addEventListener(`click`,()=>{Vt({bodyIndex:W.planetaryBodyIndex})}),Le?.addEventListener(`pointerdown`,e=>{e.preventDefault(),W.setSurfaceControls({jump:!0}),Bt()});let Ut=()=>{W.surfaceControls.jump&&(W.setSurfaceControls({jump:!1}),Bt())};Le?.addEventListener(`pointerup`,Ut),Le?.addEventListener(`pointerleave`,Ut),Le?.addEventListener(`pointercancel`,Ut),Re?.addEventListener(`pointerdown`,e=>{e.preventDefault(),W.setSurfaceControls({down:!0}),Bt()});let Wt=()=>{W.surfaceControls.down&&(W.setSurfaceControls({down:!1}),Bt())};Re?.addEventListener(`pointerup`,Wt),Re?.addEventListener(`pointerleave`,Wt),Re?.addEventListener(`pointercancel`,Wt),ze?.addEventListener(`click`,()=>zt()),Be?.addEventListener(`click`,()=>{if(!W.surfaceSession)return;let e=W.surfaceSession.cameraMode===`chase`?`first-person`:`chase`;W.setSurfaceCameraMode(e),Bt(),$(performance.now())}),Ve?.addEventListener(`click`,()=>Ht());function Gt(e,t,n){if(!e||!t)return;let r=null,i=r=>{let i=e.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5,s=r.clientX-a,c=r.clientY-o,l=Math.hypot(s,c);l>36&&(s=s/l*36,c=c/l*36),t.style.transform=`translate(calc(-50% + ${s.toFixed(1)}px), calc(-50% + ${c.toFixed(1)}px))`,n(s/36,-c/36)};e.addEventListener(`pointerdown`,t=>{t.preventDefault(),r=t.pointerId,e.setPointerCapture?.(t.pointerId),i(t)}),e.addEventListener(`pointermove`,e=>{e.pointerId===r&&i(e)});let a=e=>{e.pointerId===r&&(r=null,t.style.transform=`translate(-50%, -50%)`,n(0,0))};e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a)}Gt(Ue,We,(e,t)=>{W.setSurfaceControls({moveX:e,moveY:t})}),Gt(Ge,Ke,(e,t)=>{W.addSurfaceLookDelta(-e*.08,-t*.05)});let Kt=e=>{let t=document.activeElement?.tagName;if(!(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)){if(!W.surfaceActive){e.code===`KeyL`&&G===4&&!e.repeat&&Vt({bodyIndex:W.planetaryBodyIndex});return}e.code===`KeyW`||e.code===`ArrowUp`?(W.setSurfaceControls({forward:!0}),e.preventDefault()):e.code===`KeyS`||e.code===`ArrowDown`?(W.setSurfaceControls({backward:!0}),e.preventDefault()):e.code===`KeyA`||e.code===`ArrowLeft`?(W.setSurfaceControls({left:!0}),e.preventDefault()):e.code===`KeyD`||e.code===`ArrowRight`?(W.setSurfaceControls({right:!0}),e.preventDefault()):e.code===`Space`?(W.setSurfaceControls({jump:!0}),e.preventDefault()):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?W.setSurfaceControls({down:!0}):e.code===`ShiftLeft`||e.code===`ShiftRight`?W.setSurfaceControls({turbo:!0}):e.code===`KeyQ`?W.setSurfaceControls({yawLeft:!0}):e.code===`KeyE`?W.setSurfaceControls({yawRight:!0}):e.code===`KeyF`&&!e.repeat&&W.surfaceSession?zt():e.code===`KeyV`&&!e.repeat&&W.surfaceSession?(W.setSurfaceCameraMode(W.surfaceSession.cameraMode===`chase`?`first-person`:`chase`),Bt()):e.code===`Escape`&&Ht()}},qt=e=>{W.surfaceActive&&(e.code===`KeyW`||e.code===`ArrowUp`?W.setSurfaceControls({forward:!1}):e.code===`KeyS`||e.code===`ArrowDown`?W.setSurfaceControls({backward:!1}):e.code===`KeyA`||e.code===`ArrowLeft`?W.setSurfaceControls({left:!1}):e.code===`KeyD`||e.code===`ArrowRight`?W.setSurfaceControls({right:!1}):e.code===`Space`?W.setSurfaceControls({jump:!1}):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?W.setSurfaceControls({down:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?W.setSurfaceControls({turbo:!1}):e.code===`KeyQ`?W.setSurfaceControls({yawLeft:!1}):e.code===`KeyE`&&W.setSurfaceControls({yawRight:!1}))};if(window.addEventListener(`keydown`,Kt),window.addEventListener(`keyup`,qt),be?.addEventListener(`click`,()=>{ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Lt()}),Ce?.addEventListener(`click`,()=>{ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Rt()}),D?.addEventListener(`click`,()=>{ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Rt()}),v?.addEventListener(`click`,()=>{ht=!ht,v.classList.toggle(`active`,ht),v.textContent=ht?`⏹ Stop Tour`:`▶ Tour`,ht&&(vt=null)}),E?.addEventListener(`click`,()=>{lt=!lt,E.textContent=lt?`⏸ Pause`:`▶ Resume`,h?.classList.toggle(`paused`,!lt)}),O?.addEventListener(`input`,e=>{ut=Number(e.target.value)||1,k&&(k.textContent=`${ut.toFixed(1)}×`)}),A?.addEventListener(`click`,async()=>{J=1,await W.initCosmicWeb(),vt=null,s=Oe[0].log10SpanM,G=0,X(),It()}),j?.addEventListener(`click`,async()=>{J=.75,W.setSeed(W.seed+7919>>>0),await W.initCosmicWeb(),W.galaxyEngine&&await W.initGalaxy(),W.solarEngine&&await W.initSolarSystem(),X()}),N)for(let e of N.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(W.setQuality(t)){for(let e of N.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);G===0?await W.initCosmicWeb():G===1?await W.initGalaxy():G===2&&W.galaxyBranch!==`smbh-core`?await W.initSolarSystem():G===3?await W.initStellarCore():G===5?await W.initMolecularDynamics():G===6?await W.initQuantumAtom():G===7&&(await W.initAtomicNucleus(),W.nuclearResult?.volumeData&&tt.uploadNuclearVolume(W.nuclearResult.volumeData)),Y()}});ee?.addEventListener(`change`,e=>{dt=e.target.checked}),P?.addEventListener(`change`,e=>{q=e.target.checked}),F?.addEventListener(`change`,e=>{e.target.checked}),I?.addEventListener(`change`,e=>{ft=e.target.checked}),L?.addEventListener(`change`,e=>{pt=e.target.checked}),te?.addEventListener(`input`,e=>{mt=Number(e.target.value)||3,R&&(R.textContent=`${mt}×`)}),re?.addEventListener(`click`,async()=>{W.getPeerMeshState().connected?await W.disconnectPeerMesh():await W.connectPeerMesh({relayUrl:ne?.value||``,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:z?.value||`requester`}),Jt()});function Jt(){let e=W.getPeerMeshState();re&&(re.textContent=e.connected?`Leave`:`Join Mesh`),ie&&(ie.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let Yt=!1,Xt=!1,Zt=0,Qt=0,$t=0,en=0;function tn(){let e=s;if(G===0){if(W.cosmoMode!==`web`&&W.cosmoBaryonSession){let t=12.2/Math.max(100,W.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-e));return{kind:`cosmo-baryon`,buffer:W.cosmoBaryonSession.getResidentTracersBuffer(),count:W.cosmoBaryonSession.tracerCount,strideFloats:16,layoutMode:le.STANDARD,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(W.cosmoSession)return{kind:`cosmo-web`,buffer:W.cosmoSession.particlesBuffer,count:W.cosmoSession.particleCount,strideFloats:8,layoutMode:le.STANDARD,worldScale:wt.cosmoScale??.09,offsetHi:wt.cosmoOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(G===1&&W.galaxyEngine)return{kind:`galaxy-star`,buffer:W.galaxyEngine.getResidentBuffer(),count:W.galaxyEngine.count,strideFloats:8,layoutMode:le.GALAXY_VISIBLE,worldScale:wt.galaxyScale??.85,offsetHi:wt.galaxyOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0};else if(G===2&&W.galaxyBranch!==`smbh-core`){if(W.solarMode===`formation`&&W.protoplanetarySession){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-e));return{kind:`proto-pebble`,buffer:W.protoplanetarySession.getResidentPebblesBuffer(),count:W.protoplanetarySession.pebbleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(W.solarMode===`quasar-jet`&&W.kerrJetSession){let t=.85*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`kerr-parcel`,buffer:W.kerrJetSession.getResidentParcelsBuffer(),count:W.kerrJetSession.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(W.solarMode)&&W.relBinarySession){let t=1.12*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`relbin-parcel`,buffer:W.relBinarySession.getResidentParcelsBuffer(),count:W.relBinarySession.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`comet-tails`,`hot-jupiter`].includes(W.solarMode)&&W.radWindL2Session){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`radwind-parcel`,buffer:W.radWindL2Session.getResidentParcelsBuffer(),count:W.radWindL2Session.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`roche-rings`,`giant-impact`,`red-giant`].includes(W.solarMode)&&W.tidalRocheSession){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`roche-parcel`,buffer:W.tidalRocheSession.getResidentParticlesBuffer(),count:W.tidalRocheSession.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(W.solarEngine){let e=W.solarEngine.getMassiveBodyState64(W.focusedSolarBodyIndex),t=[Math.fround(e.posAu[0]),Math.fround(e.posAu[1]),Math.fround(e.posAu[2])],n=[Math.fround(e.posAu[0]-t[0]),Math.fround(e.posAu[1]-t[1]),Math.fround(e.posAu[2]-t[2])];return{kind:`solar-asteroid`,buffer:W.solarEngine.getResidentBuffer(),count:W.solarEngine.totalCount,strideFloats:16,layoutMode:le.SOLAR_DOUBLE_FLOAT,worldScale:wt.solarScaleAuToWorld??1,offsetHi:t,offsetLo:n,skipFirst:W.solarEngine.massiveCount}}}else if(G===3){let t=.92*10**Math.max(-1,Math.min(1,9.2-e));if(W.stellarMode===`nebular-mhd`&&W.nebulaMhdSession)return{kind:`nebula-mhd-parcel`,buffer:W.nebulaMhdSession.getResidentTracersBuffer(),count:W.nebulaMhdSession.tracerCount,strideFloats:16,layoutMode:le.STANDARD,worldScale:t*1.15,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(W.stellarMode)&&W.radWindL3Session)return{kind:`radwind-parcel`,buffer:W.radWindL3Session.getResidentParcelsBuffer(),count:W.radWindL3Session.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t*1.05,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if((W.stellarMode===`pulsar`||W.stellarMode===`magnetar`)&&W.magnetosphereSession)return{kind:`mag-parcel`,buffer:W.magnetosphereSession.getResidentParcelsBuffer(),count:W.magnetosphereSession.particleCount,strideFloats:16,layoutMode:le.FLAGGED_LIVE_16F,worldScale:t*1.12,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if(W.stellarEngine)return{kind:`stellar-hydro-parcel`,buffer:W.stellarEngine.getResidentBuffer(),count:W.stellarEngine.count,strideFloats:16,layoutMode:le.STANDARD,worldScale:t*.95,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(G===5&&W.mdSession){let t=W.mdSession.boxLengthsA,n=8.4/Math.max(t[0],t[1],t[2],6),r=10**Math.max(-1.2,Math.min(1.4,-8.2-e));return{kind:`md-atom`,buffer:W.mdSession.positionsBuffer,velBuffer:W.mdSession.velocitiesBuffer,count:W.mdSession.atomCount,strideFloats:4,layoutMode:le.MD_PERIODIC_4F,worldScale:n*r,offsetHi:[0,0,0],offsetLo:[t[0]*.5,t[1]*.5,t[2]*.5],skipFirst:0}}return null}function nn(e,t,n){let r=n,i=e.worldScale||1,a=e.offsetHi||[0,0,0],o=e.offsetLo||[0,0,0],s=[r[0]||0,r[1]||0,r[2]||0],c;if(e.layoutMode===le.SOLAR_DOUBLE_FLOAT?(s=[r[0]+r[4],r[1]+r[5],r[2]+r[6]],c=[(r[0]-a[0]+(r[4]-o[0]))*i,(r[1]-a[1]+(r[5]-o[1]))*i,(r[2]-a[2]+(r[6]-o[2]))*i]):c=e.layoutMode===le.MD_PERIODIC_4F?[(r[0]-o[0])*i,(r[1]-o[1])*i,(r[2]-o[2])*i]:[(r[0]-a[0])*i,(r[1]-a[1])*i,(r[2]-a[2])*i],e.kind===`cosmo-web`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0),i=Math.max(.1,Number(r[7])||1),a=W.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:W.cosmicEpoch,regionPosMpc:s,localOverdensity:i,seed:W.seed});return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,localOverdensity:i,name:`Cosmic-Web Halo Mote #${t}`,subtitle:`${a.morphologyLabel} · δ/ρ̄=${i.toFixed(2)}× · [Fe/H]=${a.baseFeH>=0?`+`:``}${a.baseFeH.toFixed(2)}`,composition:`Causal Cosmic Context: f_gas=${(a.gasFraction*100).toFixed(0)}% · C/O=${a.baseCO.toFixed(2)} · Dive to form this galaxy`,tempK:8500,stats:[[`Comoving r`,`${Math.hypot(...s).toFixed(1)} Mpc`],[`Peculiar |v|`,`${(n*120).toFixed(0)} km/s`],[`Local δ/ρ̄`,`${i.toFixed(2)}×`],[`Morphology`,a.morphology]]}}if(e.kind===`cosmo-baryon`){let n=(r[11]||0)>.5,i=Number(r[8])||3e3,a=Number(r[9])||0,o=Number(r[7])||1;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`${n?`Dark-Matter Lensing Halo`:`Baryon / IGM Parcel`} #${t}`,subtitle:`Live GPU Cosmological Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:n?`Collisionless CDM Mass Tracer`:`H/He Plasma · x_HII=${(a*100).toFixed(1)}% · T=${i>1e5?`${(i/1e6).toFixed(1)} MK`:`${Math.round(i)} K`}`,tempK:Math.max(2500,Math.min(35e3,i)),stats:[[`Species`,n?`Dark Matter`:`Baryon Gas`],[`Temp T`,i>1e5?`${(i/1e6).toFixed(2)} MK`:`${Math.round(i)} K`],[`Ionized x_HII`,`${(a*100).toFixed(1)}%`],[`Density ρ`,`${o.toFixed(2)} ρ̄`]]}}if(e.kind===`galaxy-star`){let n=Number(r[7])||0,i=Math.hypot(s[0],s[2])*5.2;s[1]*5.2;let a=Math.hypot(r[4]||0,r[5]||0,r[6]||0),o=W.galacticDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],l=Math.hypot(o[0],o[1],o[2]),u={posGal:[...s],popTag:n,starIndex:t},d=W.deriveStarSystemFromGalacticLocation({cosmicEpoch:W.cosmicEpoch,galaxyEnv:W.activeGalaxyEnv,starPosGal:s,popTag:n,starIndex:t,seed:W.seed+409>>>0}),f=W.synthesizeNebularPlanetarySystem(d,{seedOverride:W.seed+409>>>0}),p=d.multiplicity===3?`Trinary`:d.multiplicity===2?`Binary`:`Single`,m=d.stars.map(e=>e.spectralCode).join(`+`);return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,starSite:u,name:`Star #${t} · ${d.systemName} (${p} ${m})`,subtitle:`${d.galacticRegion} · R=${i.toFixed(1)} kly · ${f.planetCount} worlds${f.hasEarthLike?` (Earth-like!)`:``}`,composition:`Nebula: ${d.nebulaEnv.nebulaSummary} · Click 🎯 Focus or Dive to simulate this system`,tempK:d.stars[0].effectiveTempK,stats:[[`Multiplicity`,`${p} (${m})`],[`Nebula [Fe/H]`,`${d.nebulaEnv.feH>=0?`+`:``}${d.nebulaEnv.feH.toFixed(2)}`],[`Local |B|`,`${(l*12).toFixed(2)} μG`],[`Orbital |v|`,`${(a*24.5).toFixed(0)} km/s`]]}}if(e.kind===`solar-asteroid`){let n=Math.hypot(s[0],s[1],s[2]),i=Math.hypot(r[8]||0,r[9]||0,r[10]||0)*4.7405,a=(r[11]||0)>6.5||n>12;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`${a?`Kuiper Belt Object`:`Main-Belt Asteroid`} #${t}`,subtitle:`f32x2 Symplectic N-Body Minor Body · r = ${n.toFixed(3)} AU`,composition:a?`H₂O / CH₄ / N₂ Outer-System Icy Planetesimal`:`Carbonaceous / Silicate Chondrite Asteroid`,tempK:Math.max(40,Math.round(280/Math.sqrt(Math.max(.2,n)))),stats:[[`Helio r`,`${n.toFixed(3)} AU`],[`Speed |v|`,`${i.toFixed(2)} km/s`],[`Zone`,a?`Kuiper Belt`:`Main Belt`],[`GPU Index`,`#${t}`]]}}if(e.kind===`proto-pebble`){let n=Math.hypot(s[0],s[1],s[2]),i=Number(r[8])||180,a=Number(r[9])||0;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`${a>.5?`Icy Outer`:`Rocky Silicate`} Pebble #${t}`,subtitle:`Epstein/Stokes Gas-Drag Disk Tracer · r = ${n.toFixed(2)} AU`,composition:a>.5?`Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)`:`Refractory Silicate + Fe-Ni Chondrule Dust`,tempK:Math.max(50,Math.min(2e3,i)),stats:[[`Disk r`,`${n.toFixed(2)} AU`],[`Temp T(r)`,`${Math.round(i)} K`],[`Ice Frac`,`${(a*100).toFixed(0)}%`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`stellar-hydro-parcel`){let n=Number(r[8])||4,i=Number(r[9])||-5,a=10**n,o=Number(r[10])||.72,l=Number(r[11])||-30,u=Number(r[13])||0,d=Number(r[14])||.26,f=Number(r[15])||.02,p=W.stellarDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],m=Math.hypot(p[0],p[1],p[2]);return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`Stellar Plasma Parcel #${t}`,subtitle:`self-gravitating-hydro@1 · r = ${Math.hypot(...s).toFixed(2)} · x_ion = ${(u*100).toFixed(0)}%`,composition:`H ${(o*100).toFixed(1)}% · He ${(d*100).toFixed(1)}% · Z ${(f*100).toFixed(2)}%`,tempK:Math.max(2e3,Math.min(4e4,a)),stats:[[`Parcel T`,a>=1e6?`${(a/1e6).toFixed(2)} MK`:`${Math.round(a).toLocaleString()} K`],[`log₁₀ ρ`,`${i.toFixed(2)} kg/m³`],[`Fusion ε`,l>-12?`10^${l.toFixed(1)} W/kg`:`Inactive`],[`Dynamo |B|`,`${m.toFixed(3)} B_sim`]]}}if(e.kind===`nebula-mhd-parcel`){let n=Number(r[7])||0,i=Number(r[11])||0,a=Number(r[13])||0;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`MHD Nebula Parcel #${t}`,subtitle:`3D Resistive MHD · B = (${(r[8]||0).toFixed(2)}, ${(r[9]||0).toFixed(2)}, ${(r[10]||0).toFixed(2)})`,composition:a>.15?`Magnetocentrifugal (J×B) Bipolar Jet Plasma`:`Rotating Magnetized Molecular Cloud Gas & Dust`,tempK:a>.15?14e3:4200,stats:[[`Local |B|`,`${n.toFixed(3)}`],[`Density ρ`,`${i.toFixed(2)}`],[`Jet Outflow`,`${a.toFixed(2)}`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`mag-parcel`||e.kind===`kerr-parcel`||e.kind===`relbin-parcel`){let n=Number(r[3])||0,i=Math.max(1,Number(r[7])||1),a=Number(r[9])||0,o=e.kind===`mag-parcel`?n>1.5?`Reconnection Flare / PWN`:n>.5?`Polar-Cap Open Beam`:`Closed Magnetosphere Loop`:e.kind===`kerr-parcel`?n>.5&&n<1.5?`Blandford–Znajek Jet`:`Novikov–Thorne Disk`:n>1.5?`r-Process Ejecta`:`Relativistic Stream`;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`${o} Parcel #${t}`,subtitle:`Persistent GPU Plasma Mote · Lorentz Γ = ${i.toFixed(2)}×`,composition:`Speed |v| = ${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)} · r = ${Math.hypot(...s).toFixed(2)}`,tempK:22e3,stats:[[`Role`,o.slice(0,14)],[`Lorentz Γ`,`${i.toFixed(2)}×`],[e.kind===`mag-parcel`?`Local |B|`:`Y_e / Aux`,`${a.toFixed(3)}`],[`Emissivity`,`${(r[10]||0).toFixed(2)}`]]}}if(e.kind===`radwind-parcel`||e.kind===`roche-parcel`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0);return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`${e.kind===`radwind-parcel`?`Photoionized Nebula/Tail`:`Tidal Debris/Ring`} Parcel #${t}`,subtitle:`Live GPU Parcel · r = ${Math.hypot(...s).toFixed(2)} · |v| = ${n.toFixed(2)}`,composition:e.kind===`radwind-parcel`?`Hα=${(r[8]||0).toFixed(2)} · [O III]=${(r[9]||0).toFixed(2)} · [S II]=${(r[10]||0).toFixed(2)}`:`Intact=${(r[7]||0)>.5?`Cohesive`:`Disrupted`} · T_norm=${(r[8]||0).toFixed(2)}`,tempK:11e3,stats:[[`Radius r`,`${Math.hypot(...s).toFixed(2)}`],[`Speed |v|`,`${n.toFixed(2)}`],[e.kind===`radwind-parcel`?`Hα / [O III]`:`Temp Norm`,e.kind===`radwind-parcel`?`${(r[8]||0).toFixed(1)} / ${(r[9]||0).toFixed(1)}`:`${(r[8]||0).toFixed(2)}`],[`GPU Index`,`#${t}`]]}}if(e.kind===`md-atom`){let n=W.getCachedElementBundle(W.mdElementZ,!0)?.bundle,r=n?.symbol||`Z=${W.mdElementZ}`;return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`Atom #${t} · ${r} (Z=${W.mdElementZ})`,subtitle:`Live WebGPU MD Atom · (${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}) Å`,composition:`${n?.mechanical?.crystalStructure||`lattice`} · m = ${(n?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,tempK:W.mdTelemetry?.temperatureK||W.mdTempK,stats:[[`Element`,`${r} (Z=${W.mdElementZ})`],[`Lattice x,y`,`${s[0].toFixed(1)}, ${s[1].toFixed(1)} Å`],[`Lattice z`,`${s[2].toFixed(2)} Å`],[`Bath Temp`,`${Math.round(W.mdTelemetry?.temperatureK||W.mdTempK)} K`]]}}return{kind:e.kind,level:G,index:t,rawPos:s,worldPos:c,name:`GPU Mote #${t}`,subtitle:`Live Resident WebGPU Entity`,composition:``,tempK:6e3,stats:[[`Index`,`#${t}`],[`X`,s[0].toFixed(2)],[`Y`,s[1].toFixed(2)],[`Z`,s[2].toFixed(2)]]}}function rn(e,t){let n=W.getTargetsForLevel(G,wt),r=null,i=42;for(let a of n){if(G===0&&W.cosmoMode!==`web`||G===2&&![`nbody`,`smbh-core`].includes(W.solarMode)&&W.galaxyBranch!==`smbh-core`||G===3||G===5)continue;let n=Wn(a.pos,xt,St,Ct);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r=a)}return r}async function an(e,t,{preferGpuMote:n=!1}={}){if(G===7&&st.length>0){let n=null,r=36;for(let i=0;i<st.length;i+=1){let a=st[i],o=Wn(a.pos,xt,St,Ct);if(!o.visible)continue;let s=Math.hypot(o.sx-e,o.sy-t);s<r&&(r=s,n={idx:i,sphere:a})}if(n){let e=n.sphere.color0[0]>.7,t=Math.hypot(...n.sphere.pos)*(Number(W.nuclearResult?.chargeRadiusFm||3.7)/2.2);return K={kind:`nucleon`,level:7,index:n.idx,rawPos:[...n.sphere.pos],worldPos:[...n.sphere.pos],name:`${e?`Proton p⁺`:`Neutron n⁰`} #${n.idx+1} (${W.nuclearA}${W.nuclearResult?.isotope?.split(`-`)[0]||``})`,subtitle:e?`Valence Quarks u-u-d · Charge +1e · Spin ½`:`Valence Quarks u-d-d · Charge 0 · Spin ½`,composition:`Bound inside Woods–Saxon nuclear potential (B/A = ${(W.nuclearResult?.bindingPerNucleonMeV||8.79).toFixed(3)} MeV)`,tempK:1e10,stats:[[`Baryon`,e?`Proton (p⁺)`:`Neutron (n⁰)`],[`Shell r`,`${t.toFixed(2)} fm`],[`Mass`,e?`938.27 MeV`:`939.57 MeV`],[`Quarks`,e?`u u d`:`u d d`]]},Z(),$(performance.now()),K}}if(!n){let n=rn(e,t);if(n&&(G===2||G===4||G===1&&n.isSmbh))return K=null,at=!1,rt=n.id,G===1&&n.branch?W.setGalaxyBranch(n.branch,n.pos):G===2&&n.bodyIndex!=null&&(W.setFocusedSolarBody(n.bodyIndex),n.bodyIndex>0&&W.initPlanetaryInterior({bodyIndex:n.bodyIndex})),Y(),Z(),n}let r=tn();if(r&&r.buffer&&r.count>0){let n=e/Math.max(1,St)*2-1,i=1-t/Math.max(1,Ct)*2,a=St/Math.max(1,Ct),o=await nt.pickEntity({buffer:r.buffer,count:r.count,strideFloats:r.strideFloats,layoutMode:r.layoutMode,skipFirst:r.skipFirst||0,viewProj:xt,clickNdcX:n,clickNdcY:i,aspect:a,maxPickNdc:.14,offsetHi:r.offsetHi,offsetLo:r.offsetLo,worldScale:r.worldScale});if(o){let e=new Float32Array([...o.vec0,...o.vec1,...o.vec2,...o.vec3]);return K=nn(r,o.index,e),Z(),$(performance.now()),K}}let i=rn(e,t);return i?(K=null,at=!1,rt=i.id,G===1&&i.branch&&W.setGalaxyBranch(i.branch,i.pos),Y(),Z(),i):null}async function on(){if(!K||K.level!==G||K.kind===`nucleon`)return;let e=tn();if(!e||e.kind!==K.kind||!e.buffer)return;let t=await nt.readSingleEntity(e.buffer,K.index,e.strideFloats);t&&K&&K.kind===e.kind&&(K=nn(e,K.index,t))}function sn({zoomIn:e=!1}={}){return K?(G===0&&K.kind===`cosmo-web`?(W.setCosmoFocusMpc(K.rawPos),at=!0,e&&Pt(Math.max(21.2,s-1.6))):G===1&&K.kind===`galaxy-star`?(W.setGalaxyBranch(`solar-system`,K.rawPos),K.starSite&&W.selectCausalStarSite(K.starSite),at=!0,e&&Pt(Math.max(17.5,s-1.5))):(at=!at||e,at?(ot=[...K.worldPos],e&&(bt.dist=Math.max(6.5,bt.dist*.62))):(ot=[0,0,0],bt.dist=18)),Z(),$(performance.now()),!0):!1}xe?.addEventListener(`click`,()=>{sn({zoomIn:!at})}),c.addEventListener(`pointerdown`,e=>{Yt=!0,Xt=!1,Zt=e.clientX,Qt=e.clientY,$t=e.clientX,en=e.clientY,c.setPointerCapture?.(e.pointerId)}),c.addEventListener(`pointermove`,e=>{if(Yt){let t=e.clientX-$t,n=e.clientY-en;Math.hypot(e.clientX-Zt,e.clientY-Qt)>5&&(Xt=!0),W.surfaceActive?W.addSurfaceLookDelta(-t*.0055,n*.0055):(bt.yaw-=t*.006,bt.pitch=Math.max(-1.42,Math.min(1.42,bt.pitch+n*.006))),$t=e.clientX,en=e.clientY}else if(!W.surfaceActive){let t=rn(e.clientX,e.clientY);it=t?.id||null,c.style.cursor=t?`pointer`:`crosshair`}}),c.addEventListener(`pointerup`,e=>{Yt&&!Xt&&!W.surfaceActive&&(ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),an(e.clientX,e.clientY)),Yt=!1}),c.addEventListener(`dblclick`,async e=>{if(W.surfaceActive)return;ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`);let t=await an(e.clientX,e.clientY);t&&t===K?sn({zoomIn:!0}):Lt()}),c.addEventListener(`wheel`,e=>{if(e.preventDefault(),W.surfaceActive)return;ht=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),vt=null;let t=Math.max(-.55,Math.min(.55,e.deltaY*.0024));s=Math.max(De,Math.min(Ee,s+t)),yt=Math.abs(t)*10,Mt(s)},{passive:!1});function cn(e){if(!B)return;let t=B.getContext(`2d`);if(!t)return;let n=B.width,r=B.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=Gn(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=G>=5?W.getCachedElementBundle(G===5?W.mdElementZ:W.quantumZ,W.quantumRelativistic):null,a=xn(G,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=Gn(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}}function ln(){if(!ye)return;let e=ye.getContext(`2d`);if(!e)return;let t=ye.width,n=ye.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(G===0){let e=W.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;V&&(V.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=W.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(G===1){V&&(V.textContent=`Gate 1 H/He/C/O · Z=${W.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=W.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,W.galaxyMetallicity,W.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(G===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(W.solarMode)&&W.relBinaryTelemetry?.gwStrainHistory?.length){let e=W.relBinaryTelemetry.gwStrainHistory;_e&&(_e.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),V&&(V.textContent=`f_GW=${(W.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(W.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(W.solarMode===`quasar-jet`&&W.kerrJetTelemetry){_e&&(_e.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=W.kerrJetTelemetry;V&&(V.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{_e&&(_e.textContent=Oe[2].plotTitle);let r=W.solarConservation0,i=W.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;V&&(V.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${W.solarEngine?.totalCount||0} bodies`);let o=W.getActiveSystemCatalog().filter(e=>!e.isStar&&(e.parent===0||e.parent===-2)&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3.3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.split(` `).slice(-1)[0].replace(/[()]/g,``).slice(0,4),a,n-14-i)})}else if(G===3)if((W.stellarMode===`pulsar`||W.stellarMode===`magnetar`)&&W.magnetosphereTelemetry?.flareHistory?.length){let e=W.magnetosphereTelemetry.flareHistory;_e&&(_e.textContent=W.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),V&&(V.textContent=`B=${W.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${W.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),W.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(W.stellarMode===`white-dwarf-tov`&&W.tovCurve?.length){_e&&(_e.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=W.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);V&&(V.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{_e&&(_e.textContent=Oe[3].plotTitle);let e=W.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);V&&(V.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(W.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(G===4){let e=W.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,W.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));V&&(V.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(W.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(G===5){let e=W.mdRdfHistory;if(!e?.length)return;V&&(V.textContent=`Phase: ${W.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(W.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(G===6){let e=W.getCachedElementBundle(W.quantumZ,W.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;V&&(V.textContent=`Dirac–KS ${W.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${W.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(G===7){let e=W.tdseTelemetry;if(!e?.prob?.length)return;V&&(V.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}function Z(){let e=Oe[G],t=!!(K&&K.level===G),n=t?K:Ft();g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=je(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),ue&&(ue.textContent=t?`GPU MOTE INSPECTOR · L${e.level} · ${je(s)}`:`L${e.level} · ${e.name.toUpperCase()} · ${je(s)}`),de&&(de.textContent=n?.name||e.name),fe&&(fe.textContent=n?.subtitle||e.engineSchema),me&&(me.textContent=n?.composition||``),pe&&(pe.textContent=G>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`),xe&&(xe.style.display=t&&!W.surfaceActive?`inline-flex`:`none`,xe.textContent=at?`🎯 Locked`:`🎯 Focus`,xe.classList.toggle(`active`,at));let r=[];if(t&&Array.isArray(K.stats)&&K.stats.length)r=K.stats;else if(G===0)if(W.cosmoMode!==`web`&&W.cosmoBaryonTelemetry){let e=W.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;r=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=W.cosmoTelemetry;r=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(G===1)r=[[`GPU Particles`,`${(W.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,W.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${W.galaxyEngine?.stepIndex||0}`]];else if(G===2)if(W.solarMode===`formation`&&W.protoplanetaryTelemetry){let e=W.protoplanetaryTelemetry;r=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(W.solarMode===`quasar-jet`&&W.kerrJetTelemetry){let e=W.kerrJetTelemetry;r=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(W.solarMode)&&W.relBinaryTelemetry){let e=W.relBinaryTelemetry;r=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(W.solarMode)&&W.radWindL2Telemetry){let e=W.radWindL2Telemetry;r=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(W.solarMode)&&W.tidalRocheTelemetry){let e=W.tidalRocheTelemetry;r=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=W.solarConservation,t=W.getActiveSystemCatalog(),n=t[W.focusedSolarBodyIndex]||t[0],i=W.useSolReference?`Sol (1★)`:`${W.activeCausalSystem?.starCount||1}★ ${W.activeCausalSystem?.architecture||`single`}`;r=[[`Focus`,(n?.name||`World`).slice(0,18)],[`Architecture`,i],[`True Radius`,n?`${n.radiusKm.toLocaleString()} km`:`—`],[`Sim Time`,`${(W.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&W.galaxyBranch===`smbh-core`&&(r[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],r[1]=[`Lensing`,dt?`Active WGSL`:`OFF`])}else if(G===3)if(W.stellarMode===`nebular-mhd`&&W.nebulaMhdTelemetry){let e=W.nebulaMhdTelemetry;r=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(W.stellarMode)&&W.radWindL3Telemetry){let e=W.radWindL3Telemetry;r=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((W.stellarMode===`pulsar`||W.stellarMode===`magnetar`)&&W.magnetosphereTelemetry){let e=W.magnetosphereTelemetry;r=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(W.stellarMode===`white-dwarf-tov`&&W.tovCurve?.length){let e=W.tovCurve.find(e=>e.branch===`white-dwarf`)||W.tovCurve[2],t=W.tovCurve.find(e=>e.branch===`neutron-star`)||W.tovCurve[11];r=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else{let e=W.stellarTelemetry;r=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,e?.stage||`hydro-collapse`],[`GPU Steps`,`${W.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(W.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(G===4)if(W.surfaceActive&&W.surfaceSession){let e=W.surfaceTelemetry||W.surfaceSession.getTelemetry(),t=W.surfaceSession.env;r=[[`Surface g`,`${t.gravityMS2.toFixed(2)} m/s²`],[`Air ρ_atm`,t.rhoAtmKgM3>1e-4?`${t.rhoAtmKgM3.toFixed(3)} kg/m³`:`0 (Vacuum)`],[`Rover Alt/Fuel`,`${e.roverAltitudeM.toFixed(1)}m / ${Math.round(e.roverRocketFuel*100)}%`],[`Drone Max Lift`,t.droneFlightCapable?`${t.maxAeroLiftN.toFixed(1)} N (OK)`:`0.0 N (Vac)`]]}else{let e=W.planetaryResult,t=W.planetaryAtmoTelemetry,n=W.getActiveSystemCatalog();r=[[`World`,((n[W.planetaryBodyIndex]||n[0])?.name||`World`).slice(0,18)],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(G===5){let e=W.mdTelemetry;r=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${W.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,W.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(G===6){let e=W.getCachedElementBundle(W.quantumZ,W.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],n=Number(e?.atomic?.totalEnergyHa);r=[[`Samples`,`${(W.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(n)?`${n.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(G===7){let e=W.nuclearResult,t=W.tdseTelemetry,n=Number(e?.bindingPerNucleonMeV),i=Number(e?.chargeRadiusFm);r=[[`B / A`,Number.isFinite(n)?`${n.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(i)?`${i.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}ge&&(ge.innerHTML=r.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``)),cn(n),ln()}function un(e){if(!u)return;u.clearRect(0,0,St,Ct);let t=W.getTargetsForLevel(G,wt);if(t.length){for(let n of t){if(G===2&&n.spec?.parent>0&&s>10.5||G===4&&!W.planetaryCutaway)continue;let t=Wn(n.pos,e,St,Ct);if(!t.visible)continue;let r=n.id===rt,i=n.id===it;if(!r&&!i&&G>=3)continue;let a=r?18:i?15:8;u.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:i?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,u.lineWidth=r?1.6:1;let o=Math.max(4,a*.45);for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(t.sx+e*a,t.sy+n*(a-o)),u.lineTo(t.sx+e*a,t.sy+n*a),u.lineTo(t.sx+e*(a-o),t.sy+n*a),u.stroke();(r||i||G===2&&n.spec?.parent===0&&s>9.5)&&(u.font=r?`600 11px monospace`:`500 9.5px monospace`,u.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,u.fillText(n.name,t.sx+a+6,t.sy+3.5))}if(K&&K.level===G&&K.worldPos){let t=Wn(K.worldPos,e,St,Ct);t.visible&&(u.save(),u.strokeStyle=`rgba(250, 204, 21, 0.96)`,u.lineWidth=1.9,u.beginPath(),u.moveTo(t.sx,t.sy-14),u.lineTo(t.sx+14,t.sy),u.lineTo(t.sx,t.sy+14),u.lineTo(t.sx-14,t.sy),u.closePath(),u.stroke(),u.beginPath(),u.arc(t.sx,t.sy,3,0,Math.PI*2),u.fillStyle=`#fde047`,u.fill(),u.font=`600 11px monospace`,u.fillStyle=`#fef08a`,u.fillText(K.name,t.sx+14+7,t.sy+3.5),u.restore())}}}function Q(e,t){let n=s,r=10**n,i=[],a=[],o=[],c=[],l=[.62,.55,.55],u=null,d=null,f=null,p={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,yt*.08),flashAmount:J,crtEnabled:pt,pixelSize:mt,timeSec:t},m=Jn(n,20.8,22,25.6,26),h=W.cosmoTargets[0]?.posMpc||[0,0,0],g=qn(23.8,21.8,n),_=[h[0]*g,h[1]*g,h[2]*g],v=16/178*10**Math.min(2.6,24.8-n);if(wt.cosmoScale=v,wt.cosmoOffset=_,m>.01)if(W.cosmoMode!==`web`&&W.cosmoBaryonSession&&n>=22){let t=Jn(n,22,22.7,25.6,26),r=12.2/Math.max(100,W.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-n));if(i.push({buffer:W.cosmoBaryonSession.getResidentTracersBuffer(),count:W.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:W.cosmoMode===`cmb`?.16:W.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(W.cosmoMode===`cmb`?.15:W.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,W.cosmoBaryonSession.boxSizeMpc||260]}),W.cosmoMode===`cluster-merger`&&dt&&t>.25){let n=Wn([0,0,0],e.viewProj,St,Ct);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=9e-4*t)}}else W.cosmoSession&&W.cosmoMode===`web`&&i.push({buffer:W.cosmoSession.particlesBuffer,count:W.cosmoSession.particleCount,mode:0,worldScale:v,pointSize:Math.max(.048,Math.min(.17,.068*10**Math.max(-.5,Math.min(.8,24.8-n)))),alphaGain:.44*m,extra1:[_[0],_[1],_[2],W.cosmoSession.boxSizeMpc||200]});let y=Jn(n,15.4,16.6,22,22.8),b=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,x=W.galaxyFocusPos||[4.8,.04,2.1],S=qn(20.6,18.8,n),C=[x[0]*S,x[1]*S,x[2]*S];if(wt.galaxyScale=b,wt.galaxyOffset=C,y>.01&&W.galaxyEngine&&(i.push({buffer:W.galaxyEngine.getResidentBuffer(),count:W.galaxyEngine.count,mode:1,worldScale:b,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*y,extra1:[C[0],C[1],C[2],0]}),q&&W.showGalacticBField&&W.galacticDynamoStreamlines?.length>=14&&n>18.8)){let e=y*qn(18.8,20.2,n),t=W.galacticDynamoStreamlines;for(let n=0;n<t.length;n+=7)c.push((t[n]-C[0])*b,(t[n+1]-C[1])*b,(t[n+2]-C[2])*b,t[n+3],t[n+4],t[n+5],t[n+6]*e)}if(W.galaxyBranch===`smbh-core`){let t=Jn(n,9.2,10.6,15.8,17);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),W.smbhBodies){let e=Math.floor(W.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[W.smbhBodies[e]*r,W.smbhBodies[e+1]*r,W.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(dt){let n=Wn([0,0,0],e.viewProj,St,Ct);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(W.solarMode===`formation`&&G===2&&W.protoplanetarySession){let e=Jn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n));if(i.push({buffer:W.protoplanetarySession.getResidentPebblesBuffer(),count:W.protoplanetarySession.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...W.protoplanetarySession.getEmbryoRenderSpheres(t)),q){let n=W.protoplanetarySession.snowLineAu*t,r=null;for(let t=0;t<=72;t+=1){let i=t/72*Math.PI*2,a=[Math.cos(i)*n,0,Math.sin(i)*n];r&&(c.push(...r,.36,.84,1,.45*e),c.push(...a,.36,.84,1,.45*e)),r=a}}}}else if(W.solarMode===`quasar-jet`&&G===2&&W.kerrJetSession){let t=Jn(n,9.6,10.6,15.6,16.8);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=W.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:W.kerrJetSession.getResidentParcelsBuffer(),count:W.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),dt){let n=Wn([0,0,0],e.viewProj,St,Ct);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(W.solarMode)&&G===2&&W.relBinarySession){let t=Jn(n,9.6,10.6,15.6,16.8);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...W.relBinarySession.getRenderSpheres(r)),i.push({buffer:W.relBinarySession.getResidentParcelsBuffer(),count:W.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),dt&&(W.solarMode===`bbh-merger`||W.solarMode===`xray-binary`)){let n=Wn([0,0,0],e.viewProj,St,Ct);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=(W.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(W.solarMode)&&G===2&&W.radWindL2Session){let e=Jn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=W.solarMode===`comet-tails`;l=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:W.radWindL2Session.getResidentParcelsBuffer(),count:W.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(W.solarMode)&&G===2&&W.tidalRocheSession){let e=Jn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...W.tidalRocheSession.getRenderSpheres(t)),i.push({buffer:W.tidalRocheSession.getResidentParticlesBuffer(),count:W.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else{let e=Jn(n,5.4,6.4,15.8,17.2),t=r/he,s=16/Math.max(1e-9,t);if(wt.solarScaleAuToWorld=s,e>.01&&W.solarEngine){let t=W.solarEngine.catalog||W.getActiveSystemCatalog(),r=Math.max(0,Math.min(t.length-1,W.focusedSolarBodyIndex)),d=!!t[r]?.isStar||r===0,f=W.solarEngine.getMassiveBodyState64(r),p=W.solarEngine.getMassiveBodyState64(0),m=[Math.fround(f.posAu[0]),Math.fround(f.posAu[1]),Math.fround(f.posAu[2])],h=[Math.fround(f.posAu[0]-m[0]),Math.fround(f.posAu[1]-m[1]),Math.fround(f.posAu[2]-m[2])];d||(l=G===4&&W.planetaryMode===`eyeball-locked`?[1,0,0]:G===4&&W.planetaryMode===`rogue`?[.15,.96,.22]:Bn([p.posAu[0]-f.posAu[0],p.posAu[1]-f.posAu[1],p.posAu[2]-f.posAu[2]]));let g=W.getTargetsForLevel(4)[0],_=g?.rCoreNorm??.54,v=g?.rMantleNorm??.94,y=Math.min(W.solarEngine.massiveCount,t.length);for(let c=0;c<y;c+=1){let l=t[c],d=W.solarEngine.getMassiveBodyState64(c),p=(d.posAu[0]-f.posAu[0])*s,m=(d.posAu[1]-f.posAu[1])*s,h=(d.posAu[2]-f.posAu[2])*s;if(Math.hypot(p,m,h)>180&&c!==r)continue;let g=d.radiusAu*s,y=!!l.isStar||c===0;if(c===r&&y&&n<=9.9)continue;let b=c===r&&!y&&n<8.85,x=b&&W.planetaryCutaway,S=b&&!x&&(W.planetaryMode===`magma-ocean`||l.kind===7),C=b&&!x&&W.planetaryMode===`cryo-plumes`,w=b&&!x&&W.planetaryMode===`rogue`,T=a.length;if(a.push({pos:[p,m,h],radius:g,color0:S?[1,.44,.1]:C?[.86,.92,.98]:w?[.16,.24,.36]:l.color0,color1:S?[.22,.08,.05]:C?[.48,.68,.86]:w?[.06,.1,.18]:l.color1,kind:x?4:S?7:C?3:l.kind,atm:S?.55:C?.18:l.atm??.35,rCore:_,rMantle:v,cutaway:x,seed:c*2.17+1.3}),b&&!S&&!C&&W.planetaryAtmoSession&&(u={buffer:W.planetaryAtmoSession.getResidentEmVisBuffer(),width:W.planetaryAtmoSession.width,height:W.planetaryAtmoSession.height,sphereIndex:T}),C&&W.cryoPlumeSession){let t=g/2.35;i.push({buffer:W.cryoPlumeSession.getResidentParticlesBuffer(),count:W.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[0,0,0,0]})}l.ringed&&g>.008&&o.push({center:[p,m,h],rIn:l.ringInnerKm/l.radiusKm*g,normal:[.16,.89,.42],rOut:l.ringOuterKm/l.radiusKm*g,color:[.88,.78,.62],kind:1})}let b=Jn(n,10.6,11.4,14.5,16.2);if(b>.01&&i.push({buffer:W.solarEngine.getResidentBuffer(),count:W.solarEngine.totalCount,mode:4,worldScale:s,pointSize:.055,alphaGain:.42*b,extra1:[m[0],m[1],m[2],W.solarEngine.massiveCount],extra2:[h[0],h[1],h[2],0]}),q&&n>8.1){let e=Jn(n,8.1,8.8,15.2,16.4);c.push(...Xn(W.solarEngine,f.posAu,s,n,e))}}}let w=W.focusedSolarBodyIndex===0&&W.galaxyBranch!==`smbh-core`?Jn(n,7,7.8,9.7,10.4):0;if(w>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(W.stellarMode===`nebular-mhd`&&W.nebulaMhdSession){if(i.push({buffer:W.nebulaMhdSession.getResidentTracersBuffer(),count:W.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*w,extra1:[0,0,0,0]}),W.nebulaMhdStreamlines?.length>=14){let t=W.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(W.stellarMode)&&W.radWindL3Session)i.push({buffer:W.radWindL3Session.getResidentParcelsBuffer(),count:W.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.18,.105*e)),alphaGain:.17*w,extra1:[0,0,0,0]}),W.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):W.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((W.stellarMode===`pulsar`||W.stellarMode===`magnetar`)&&W.magnetosphereSession){let t=W.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:W.magnetosphereSession.getResidentParcelsBuffer(),count:W.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*w,extra1:[0,0,0,0]}),W.magnetosphereFieldLines?.length>=14){let t=W.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if(W.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(c.push(...r,.42,.84,1,(.34-t*.08)*w),c.push(...o,.42,.84,1,(.34-t*.08)*w)),r=o}}}else if(W.stellarEngine&&(i.push({buffer:W.stellarEngine.getResidentBuffer(),count:W.stellarEngine.count,mode:2,worldScale:e*.95,pointSize:Math.max(.045,Math.min(.2,.125*e)),alphaGain:.3*w,extra1:[0,0,0,0]}),q&&W.stellarDynamoStreamlines?.length>=14)){let t=W.stellarDynamoStreamlines,n=e*.95;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}let T=Jn(n,-9.6,-8.9,-6.2,-5.2);if(T>.01&&W.mdSession){let e=W.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(W.getCachedElementBundle(W.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];d={positionsBuffer:W.mdSession.positionsBuffer,velocitiesBuffer:W.mdSession.velocitiesBuffer,count:W.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(W.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:T,idealCoord:W.mdSession.idealCoordination||12},q&&T>.3&&c.push(...Yn([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*T]))}let E=Jn(n,-13.2,-12,-9.4,-8.8);if(E>.01&&W.orbitalCloud){let e=(W.getCachedElementBundle(W.quantumZ,W.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:W.orbitalCloud.pointsBuffer,count:W.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*E,colorPos:W.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:W.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),W.quantumMode===`molecule`){let e=W.MOLECULE_SPECS[W.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let D=Jn(n,-15.5,-14.8,-13.3,-12.4);if(D>.01&&W.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=W.buildQuantizedNucleonSpheres(W.nuclearResult,2.2*e,t);st=r,a.push(...r);let i=W.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);f={dim:W.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:D}}if(K&&K.worldPos&&K.level===G){let t=K.worldPos,n=Math.max(.4,Math.hypot(e.pos[0]-t[0],e.pos[1]-t[1],e.pos[2]-t[2])),r=Math.max(.14,Math.min(2.2,n*.032)),i=[t[0]+r,t[1],t[2]],a=[t[0]-r,t[1],t[2]],o=[t[0],t[1]+r,t[2]],s=[t[0],t[1]-r,t[2]],l=[t[0],t[1],t[2]+r],u=[t[0],t[1],t[2]-r],d=(e,t,n=1,r=.84,i=.3,a=.96)=>{c.push(e[0],e[1],e[2],n,r,i,a,t[0],t[1],t[2],n,r,i,a)};d(o,i),d(o,a),d(o,l),d(o,u),d(s,i),d(s,a),d(s,l),d(s,u),d(i,l),d(l,a),d(a,u),d(u,i);let f=r*1.65;d([t[0]+r*1.15,t[1],t[2]],[t[0]+f,t[1],t[2]],.45,.92,1,.88),d([t[0]-r*1.15,t[1],t[2]],[t[0]-f,t[1],t[2]],.45,.92,1,.88),d([t[0],t[1]+r*1.15,t[2]],[t[0],t[1]+f,t[2]],.45,.92,1,.88),d([t[0],t[1]-r*1.15,t[2]],[t[0],t[1]-f,t[2]],.45,.92,1,.88)}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,lightDir:l,mdCloud:d,disks:o.length?o:null,lines:c.length>=14?new Float32Array(c):null,nuclearVol:f,post:p}}let dn=performance.now(),fn=0,pn=0,mn=0,hn=0,gn=60;function $(e=performance.now()){Dt();let t=c.width/Math.max(1,c.height);if(W.surfaceActive&&W.surfaceSession){let n=W.surfaceSession,r=n.getCameraPose(),i=58*Math.PI/180,a=Vn(i,t,.15,420),o=Hn(r.eye,r.target,r.up),s=Un(a,o.mat);xt=s;let c={viewProj:s,pos:r.eye,right:o.right,up:o.up,fwd:o.fwd,aspect:t,fovTanHalf:Math.tan(i*.5),timeSec:e*.001,level:4,log10SpanM:2},l=n.env.isRogue?Bn([.15,.96,.22]):n.env.isMagmaOcean?Bn([.7,.28,.65]):Bn([.58,.44,.68]),d=n.getActiveSkyEnv?n.getActiveSkyEnv():n.env,f=[{buffer:n.getResidentPlumesBuffer(),count:n.particleCount,mode:11,worldScale:1,pointSize:.72,alphaGain:.92,extra1:[r.focusPos[0],0,r.focusPos[2],n.env.hasSolidCrust?1/(2*n.env.tinyPlanetCurvatureRadiusM):0]}],p=n.getResidentCfdMotesBuffer?.();p&&n.cfdMoteCount>0&&(n.activeVehicle===`ufo`||!n.env.hasSolidCrust)&&f.push({buffer:p,count:n.cfdMoteCount,mode:11,worldScale:1,pointSize:1.15,alphaGain:1,extra1:[r.focusPos[0],0,r.focusPos[2],0]}),tt.renderFrame({camera:c,lightDir:l,surfaceScene:{terrainVertBuf:n.getResidentTerrainVertBuffer(),terrainIdxBuf:n.getResidentTerrainIndexBuffer(),indexCount:n.indexCount,hideTerrain:!n.env.hasSolidCrust,vehicleVertBuf:n.getResidentVehicleVertBuffer(),vehicleVertCount:n.vehicleVertCount,env:d,lightDir:l},particleClouds:f,post:{bhUv:[.5,.5],bhStrength:0,warpAmount:0,flashAmount:J,crtEnabled:pt,pixelSize:mt,timeSec:e*.001}}),u&&u.clearRect(0,0,St,Ct);return}ot=at&&K&&K.level===G&&K.worldPos?[ot[0]+(K.worldPos[0]-ot[0])*.25,ot[1]+(K.worldPos[1]-ot[1])*.25,ot[2]+(K.worldPos[2]-ot[2])*.25]:[ot[0]*.82,ot[1]*.82,ot[2]*.82];let n=Math.cos(bt.pitch),r=Math.sin(bt.pitch),i=Math.cos(bt.yaw),a=Math.sin(bt.yaw),o=[ot[0]+bt.dist*n*a,ot[1]+bt.dist*r,ot[2]+bt.dist*n*i],l=48*Math.PI/180,d=Vn(l,t,.05,260),f=Hn(o,ot,[0,1,0]),p=Un(d,f.mat);xt=p;let m=Q({viewProj:p,pos:o,right:f.right,up:f.up,fwd:f.fwd,aspect:t,fovTanHalf:Math.tan(l*.5),timeSec:e*.001,level:G,log10SpanM:s},e*.001);tt.renderFrame(m),un(p)}function _n(e){if(gt)return;_t=requestAnimationFrame(_n);let t=Math.min(.1,Math.max(.001,(e-dn)/1e3));if(dn=e,mn+=t,hn+=1,mn>=.45&&(gn=Math.round(hn/mn),mn=0,hn=0),ft&&!Yt&&(bt.yaw+=t*.22),J>0&&(J=Math.max(0,J-t*1.45)),yt=Math.max(0,yt-t*12),vt!==null){let e=vt-s,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);s+=n,yt=Math.abs(n)/Math.max(.001,t),Math.abs(vt-s)<.015&&(s=vt,vt=null),Mt(s)}ht&&vt===null&&(s-=t*1.15,s<=-14.75&&(s=Ee-.3),Mt(s));let n=Zn(s,{focusedSolarBodyIndex:W.focusedSolarBodyIndex,galaxyBranch:W.galaxyBranch});if(n!==G){let e=G;G=n,K=null,at=!1,ot=[0,0,0],bt.dist=18,G===4&&e!==4&&!Yt&&Nt(W.focusedSolarBodyIndex),X(),It(),Mt(s)}lt&&W.stepActiveRegimes(G,s,ut),ct+=t,ct>=.1&&K&&K.level===G&&(ct=0,on()),(!(G===6&&!Yt&&!ft&&vt===null&&!ht&&J<=0)||e-fn>=120)&&(fn=e,$(e)),pn+=t,pn>=.18&&(pn=0,_&&(_.textContent=`${gn} FPS · WebGPU`),W.surfaceActive&&Bt(),Z(),Jt())}U?.classList.remove(`active`),await Mt(s),X(),It();let vn=r.get(`peerRelay`);if(vn){ne&&(ne.value=vn);let e=r.get(`peerRole`)||`requester`;z&&(z.value=e),await W.connectPeerMesh({relayUrl:vn,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),Jt()}Z();let yn=()=>{W.disconnectPeerMesh()};return window.addEventListener(`pagehide`,yn),window.addEventListener(`beforeunload`,yn),_t=requestAnimationFrame(_n),Object.freeze({getState(){let e=Oe[G],t=W.cosmoSession?.getState?.()||null,r=ve[0],i=ve[3],a=ve[6],o=W.solarConservation0,c=W.solarConservation;return{ready:!0,continuousZoom:!0,level:G,scaleId:e.id,scaleName:e.name,log10ViewSpanM:s,physicalSpanLabel:je(s),totalSpanOom:Number((Ee-De).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:ft,running:lt,autopilot:ht,retroCrt:pt,lensingEnabled:dt,qualityId:W.quality.id,seed:W.seed,gpuErrorCount:n.length,gpuErrors:[...n],scientificValidation:!1,cosmicEpochId:W.cosmicEpochId,cosmicEpochRedshiftZ:W.cosmicEpoch?.redshiftZ??0,cosmoMode:W.cosmoMode,cosmoBaryonSteps:W.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:W.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:W.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:W.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:t?.stepIndex??0,scaleFactorA:t?.aScale??null,redshiftZ:t?.redshiftZ??null,submitsPerStep:W.cosmoTelemetry?.submitsPerStep??t?.submitsPerStep??null,sigmaDensity:W.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:W.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:W.galaxyEngine?.stepIndex??0,galaxyPreset:W.galaxyPreset,galacticBodyCount:W.galaxyEngine?.count??0,galacticGravityMode:W.galaxyEngine?.gravityMode??null,galacticDynamoMagEnergy:W.galacticDynamoTelemetry?.magneticEnergy??null,galacticDynamoStreamlineFloats:W.galacticDynamoStreamlines?.length??0,galacticB0:W.galacticB0,galaxyBranch:W.galaxyBranch,planetarySteps:W.solarEngine?.stepIndex??0,solarSimTimeYr:W.solarEngine?.simTimeYr??0,solarTotalBodies:W.solarEngine?.totalCount??0,focusedSolarBody:W.getActiveSystemCatalog()[W.focusedSolarBodyIndex]?.id??`star-0`,useSolReference:W.useSolReference,causalSystemName:W.useSolReference?`Sol Reference`:W.activeCausalSystem?.systemName??null,causalArchitecture:W.useSolReference?`single`:W.activeCausalSystem?.architecture??`single`,causalStarCount:W.useSolReference?1:W.activeCausalSystem?.starCount??1,causalPlanetCount:W.useSolReference?8:W.activeCausalSystem?.planetCount??0,causalHasEarthLike:W.useSolReference?!0:!!W.activeCausalSystem?.hasEarthLike,causalFeH:W.useSolReference?0:W.activeCausalSystem?.starSystem?.nebulaEnv?.feH??0,causalCToO:W.useSolReference?.55:W.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&c?Math.abs(c.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:c?.relMomentumError??null,stellarSteps:W.stellarEngine?.stepIndex??0,stellarMode:W.stellarMode,stellarPreset:W.stellarPreset,stellarCoreTempK:W.stellarTelemetry?.coreTempK??null,stellarDynamoMagEnergy:W.stellarDynamoTelemetry?.magneticEnergy??null,stellarDynamoStreamlineFloats:W.stellarDynamoStreamlines?.length??0,stellarB0:W.stellarB0,magnetosphereStreamlineFloats:W.magnetosphereFieldLines?.length??0,pickedGpuMote:K?{kind:K.kind,index:K.index,name:K.name,subtitle:K.subtitle}:null,moteFocusLocked:at,nebulaMhdSteps:W.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:W.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:W.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:W.solarMode,kerrSpinA:W.kerrSpinA,kerrMaxGamma:W.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:W.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:W.relBinaryTelemetry?.merged??!1,relBinaryRemnant:W.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:W.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:W.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:W.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:W.tovCurve?.length??0,tidalRupturedFrac:W.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:W.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:W.protoplanetaryTelemetry?.accretedPebbles??null,planetaryMode:W.planetaryMode,planetaryInteriorValid:!!W.planetaryResult?.valid,planetaryMoiFactor:W.planetaryResult?.moiFactor??null,planetaryCutaway:W.planetaryCutaway,planetaryAtmoActive:!!W.planetaryAtmoSession,planetaryAtmoSteps:W.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:W.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:W.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,surfaceActive:W.surfaceActive,surfaceVehicle:W.surfaceSession?.activeVehicle??null,surfaceCameraMode:W.surfaceSession?.cameraMode??null,surfaceGravityMS2:W.surfaceSession?.env?.gravityMS2??null,surfaceAtmoDensityKgM3:W.surfaceSession?.env?.rhoAtmKgM3??null,surfaceDroneFlightCapable:W.surfaceSession?.env?.droneFlightCapable??null,surfaceDroneMaxAeroLiftN:W.surfaceSession?.env?.maxAeroLiftN??null,surfaceTelemetry:W.surfaceTelemetry??null,activeUniversalLaws:W.getActiveUniversalLaws(G,s).active.map(e=>e.id),mdSteps:W.mdTelemetry?.totalSteps??0,mdAtomCount:W.mdSession?.atomCount??0,mdGravity:W.mdGravity,mdElementZ:W.mdElementZ,quantumZ:W.quantumZ,quantumRelativistic:W.quantumRelativistic,orbitalPointCount:W.orbitalCloud?.pointCount??0,nuclearZ:W.nuclearZ,nuclearA:W.nuclearA,nuclearBindingPerNucleonMeV:W.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:W.tdseTelemetry?.stepCount??0,selectedTarget:Ft()?.id??null,peerMeshState:W.getPeerMeshState()}},async setLog10Span(e){return vt=null,s=$n(e),G=Zn(s,{focusedSolarBodyIndex:W.focusedSolarBodyIndex,galaxyBranch:W.galaxyBranch}),await Mt(s),X(),It(),Z(),$(performance.now()),this.getState()},flyToLog10Span:Pt,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0))),r=W.getActiveSystemCatalog();if(n===3?W.setFocusedSolarBody(0):n===4&&(r[W.focusedSolarBodyIndex]?.isStar||W.focusedSolarBodyIndex===0)&&W.setFocusedSolarBody(W.getDefaultPlanetIndex(r)),t){let e=await this.setLog10Span(Oe[n].log10SpanM);return n===4&&(Nt(W.focusedSolarBodyIndex),$(performance.now())),e}return Pt(Oe[n].log10SpanM),this.getState()},async sampleNewGalacticSector(e={}){return await W.sampleNewGalacticSector(e),X(),It(),Z(),$(performance.now()),this.getState()},async selectCausalStarSite(e={}){return await W.selectCausalStarSite(e),X(),It(),Z(),$(performance.now()),this.getState()},async setUseSolReference(e){return await W.setUseSolReference(e),X(),It(),Z(),$(performance.now()),this.getState()},async focusSolarBody(e){let t=W.useSolReference;W.setFocusedSolarBody(e),W.useSolReference!==t&&(await W.initSolarSystem({solReference:W.useSolReference}),W.setFocusedSolarBody(e));let n=W.getActiveSystemCatalog(),r=Math.max(0,Math.min(n.length-1,W.focusedSolarBodyIndex));return!n[r]?.isStar&&r>0&&await W.initPlanetaryInterior({bodyIndex:r}),G===4&&!n[r]?.isStar&&r>0&&(s=Qn(n[r]),Nt(r)),X(),It(),$(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await W.setCosmicEpoch(e,t),Et(),X(),Y(),Z(),$(performance.now()),this.getState()},async setCosmoMode(e){return await W.setCosmoMode(e),X(),Y(),Z(),$(performance.now()),this.getState()},async setGalaxyPreset(e){return await W.initGalaxy({preset:e}),X(),Y(),Z(),$(performance.now()),this.getState()},async setSolarMode(e){return await W.setSolarMode(e),X(),Y(),Z(),$(performance.now()),this.getState()},async setKerrSpinA(e){return await W.setKerrSpinA(e),Y(),Z(),$(performance.now()),this.getState()},async setStellarMode(e){return await W.setStellarMode(e),X(),Y(),Z(),$(performance.now()),this.getState()},async setPlanetaryMode(e){return await W.setPlanetaryMode(e),e===`cryo-plumes`&&G===4&&(s=Math.max(s,7.56),Nt(W.focusedSolarBodyIndex),bt.pitch=-.18),X(),Y(),Z(),$(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(bt.yaw=Number(e)),Number.isFinite(Number(t))&&(bt.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),$(performance.now()),this.getState()},async setNebulaB0(e){return await W.setNebulaB0(e),Y(),$(performance.now()),this.getState()},async setGalacticB0(e){return await W.setGalacticB0(e),Y(),Z(),$(performance.now()),this.getState()},async setStellarB0(e){return await W.setStellarB0(e),Y(),Z(),$(performance.now()),this.getState()},async setStellarPreset(e){return await W.initStellarCore({preset:e}),K=null,at=!1,Y(),Z(),$(performance.now()),this.getState()},async pickAtCanvasFraction(e=.5,t=.5,{preferGpuMote:n=!0}={}){return $(performance.now()),an(e*St,t*Ct,{preferGpuMote:n})},focusPickedMote(e={zoomIn:!0}){return sn(e)},getPickedMote(){return K},async readGalaxyDiagnostics(){if(!W.galaxyEngine)return null;let e=await W.galaxyEngine.readbackBodies(),t=Math.floor(e.length/8),n=0,r=0,i=0,a=0,o=0;for(let s=1;s<t;s+=1){let t=s*8;if(e[t+7]<-.5)continue;let c=Math.hypot(e[t],e[t+2]),l=e[t+1];n+=1,r+=c,i+=l*l,c>a&&(a=c),(c>18||Math.abs(l)>10)&&(o+=1)}return{stepIndex:W.galaxyEngine.stepIndex,visibleStars:n,meanRadius:r/Math.max(1,n),rmsHeightZ:Math.sqrt(i/Math.max(1,n)),maxRadius:a,escapedFrac:o/Math.max(1,n)}},async readStellarDiagnostics(){if(!W.stellarEngine)return null;let e=await W.stellarEngine.readbackBodies(),t=Math.floor(e.length/16),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=o*16,s=Math.hypot(e[t],e[t+1],e[t+2]),c=Math.hypot(e[t+4],e[t+5],e[t+6]);n+=s,r+=c*c,c>i&&(i=c),s<6.5&&(a+=1)}return{stepIndex:W.stellarEngine.stepIndex,count:t,meanRadius:n/Math.max(1,t),rmsSpeed:Math.sqrt(r/Math.max(1,t)),maxSpeed:i,boundFrac:a/Math.max(1,t),coreTempK:W.stellarTelemetry?.coreTempK??null}},setPlanetaryTriboelectric(e){return W.setPlanetaryTriboelectric(e),Y(),this.getState()},getActiveUniversalLaws(){return W.getActiveUniversalLaws(G,s)},async setGalaxyBranch(e){return W.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await Mt(s),It(),this.getState()},setPlanetaryCutaway(e){W.setPlanetaryCutaway(e),$(performance.now())},async enterSurfaceView(e={}){return await Vt(e),this.getState()},exitSurfaceView(){return Ht(),this.getState()},setSurfaceVehicle(e){return W.setSurfaceVehicle(e),Bt(),$(performance.now()),this.getState()},setSurfaceUfoAltitudeKm(e){return W.setSurfaceUfoAltitudeKm(e),Bt(),$(performance.now()),this.getState()},setSurfaceCameraMode(e){return W.setSurfaceCameraMode(e),Bt(),$(performance.now()),this.getState()},setSurfaceControls(e={}){return W.setSurfaceControls(e),Bt(),this.getState()},addSurfaceLookDelta(e,t){return W.addSurfaceLookDelta(e,t),$(performance.now()),this.getState()},async setMdPhase(e){return await W.initMolecularDynamics({Z:W.mdElementZ,phasePreset:e}),Y(),this.getState()},selectTarget(e){return W.getTargetsForLevel(G,wt).some(t=>t.id===e)?(rt=e,Z(),!0):!1},initiateHyperdrive:Lt,returnToOrbit:Rt,setAutopilot(e){ht=!!e,v?.classList.toggle(`active`,ht),v&&(v.textContent=ht?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=mt){pt=!!e,mt=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),L&&(L.checked=pt),te&&(te.value=String(mt)),R&&(R.textContent=`${mt}×`)},setCameraAutoSpin(e){ft=!!e,I&&(I.checked=ft)},async bigBang(){return J=1,await W.initCosmicWeb(),this.setLog10Span(Oe[0].log10SpanM)},async reseed(e=null){return W.setSeed(e??W.seed+7919>>>0),await W.initCosmicWeb(),this.getState()},connectPeerMesh:e=>W.connectPeerMesh(e),disconnectPeerMesh:()=>W.disconnectPeerMesh(),dispatchPeerDerivation:e=>W.dispatchPeerDerivation(e),async stepOnce(){return await W.stepActiveRegimes(G,s,ut),Z(),this.getState()},capturePng(){return $(performance.now()),c.toDataURL(`image/png`)},dispose(){gt=!0,cancelAnimationFrame(_t),window.removeEventListener(`resize`,Dt),window.removeEventListener(`keydown`,Kt),window.removeEventListener(`keyup`,qt),window.removeEventListener(`pagehide`,yn),window.removeEventListener(`beforeunload`,yn),nt.dispose(),W.dispose(),tt.dispose()}})}async function tr(){try{let e=await er();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}tr();