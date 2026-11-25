import{Et as e,O as t,_ as n,_t as r,a as i,b as a,gt as o,h as s,k as c,r as l,u,wt as d,xt as f}from"./molecularDynamicsWebGpu-0B_SAXrs.js";import{C as p,T as m,_ as h,w as g,x as _}from"./batchedSymmetricEigensolverGpu-DvdPNMKk.js";import{t as v}from"./ClosureRegistry-M0viNlhZ.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-it7y5O2_.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as C,createCachedExplicitBindGroup as w,createCachedExplicitComputePipeline as T}from"../runtime/webgpuComputeLayout.js";import{t as E}from"./radiationClosure-CLl7QZ6e.js";import{d as D,l as O,m as k,n as A,p as ee,t as j}from"./simulationModuleRegistry-C5Gdj6G_.js";import{t as M}from"./fft3dWebGpu-U-dm_fNS.js";import{C as te,D as N,E as P,O as F,S as I,T as ne,_ as re,b as ie,g as L,h as ae,i as oe,k as se,m as ce,n as le,r as ue,t as de,v as fe,w as pe,x as me,y as he}from"./gpuEntityPickerWebGpu-BgJ4rZto.js";import{r as ge}from"./schroederSpatialScaleAtlasRuntime-BEEQ_kpz.js";var _e=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,ve=149597870700,ye=30034896e-13,be=4*Math.PI*Math.PI,R=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),z=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:0,surfacePressurePa:0,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,surfacePressurePa:92e5,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:ye,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,surfacePressurePa:101325,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,surfacePressurePa:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,surfacePressurePa:610,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,surfacePressurePa:1e5,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:0,surfacePressurePa:0,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:0,surfacePressurePa:0,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:0,surfacePressurePa:0,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,surfacePressurePa:1e5,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,surfacePressurePa:146700,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ice Giant · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,surfacePressurePa:1e5,tempK:59,centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · H₂/He Atm`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,surfacePressurePa:1e5,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Eccentric Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`}]);function xe(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function Se(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function Ce({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=Se((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=S*C+x*w*T,k=w*E,A=-x*w-S*C*T,ee=-S*w+x*C*T,j=C*E;return{pos:[D*g+A*_,k*g+j*_,O*g+ee*_],vel:[D*y+A*b,k*y+j*b,O*y+ee*b]}}function we(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function B({asteroidCount:e=512,seed:t=20261125,starMassScale:n=1,centerOffsetAu:r=[0,0,0]}={}){let i=z.length,a=Math.max(0,Math.min(4096,Math.trunc(Number(e)||0))),o=i+a,s=Array.from({length:o},()=>[0,0,0]),c=Array.from({length:o},()=>[0,0,0]),l=new Float64Array(o),u=new Float64Array(o),d=new Float32Array(o);for(let e=0;e<i;e+=1){let t=z[e],r=e===0?t.massSolar*Math.max(.1,Number(n)||1):t.massSolar;if(l[e]=r,u[e]=t.radiusKm*1e3/ve,d[e]=t.kind,t.parent<0)continue;let i=t.parent,a=Ce(t,be*(l[i]+r));s[e]=[s[i][0]+a.pos[0],s[i][1]+a.pos[1],s[i][2]+a.pos[2]],c[e]=[c[i][0]+a.vel[0],c[i][1]+a.vel[1],c[i][2]+a.vel[2]]}let f=0,p=0,m=0,h=0,g=0,_=0,v=0;for(let e=0;e<i;e+=1){let t=l[e];f+=t,p+=t*s[e][0],m+=t*s[e][1],h+=t*s[e][2],g+=t*c[e][0],_+=t*c[e][1],v+=t*c[e][2]}p/=f,m/=f,h/=f;let y=g/f,b=_/f,x=v/f;for(let e=0;e<i;e+=1)s[e][0]-=p,s[e][1]-=m,s[e][2]-=h,c[e][0]-=y,c[e][1]-=b,c[e][2]-=x;let S=we(t^2654435769),C=be*l[0];for(let e=0;e<a;e+=1){let t=i+e,n=e>=Math.floor(a*.72),r=Ce({aAu:n?32+S()*14:2.15+S()*1.15,e:n?.02+S()*.14:.01+S()*.16,incDeg:(S()-.5)*(n?14:12),omDeg:S()*360,wDeg:S()*360,m0Deg:S()*360},C);s[t]=[s[0][0]+r.pos[0],s[0][1]+r.pos[1],s[0][2]+r.pos[2]],c[t]=[c[0][0]+r.vel[0],c[0][1]+r.vel[1],c[0][2]+r.vel[2]],l[t]=0,u[t]=(15+S()*85)*1e3/ve,d[t]=n?7:6}let w=Number(r?.[0])||0,T=Number(r?.[1])||0,E=Number(r?.[2])||0,D=new Float32Array(o*16);for(let e=0;e<o;e+=1){let[t,n]=xe(s[e][0]+w),[r,i]=xe(s[e][1]+T),[a,o]=xe(s[e][2]+E),f=e*16;D[f+0]=t,D[f+1]=r,D[f+2]=a,D[f+3]=l[e],D[f+4]=n,D[f+5]=i,D[f+6]=o,D[f+7]=u[e],D[f+8]=c[e][0],D[f+9]=c[e][1],D[f+10]=c[e][2],D[f+11]=d[e],D[f+12]=0,D[f+13]=0,D[f+14]=0,D[f+15]=0}return Object.freeze({packed:D,massiveCount:i,asteroidCount:a,totalCount:o,catalog:z})}var Te=`
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
`;function Ee(e,{asteroidCount:t=512,seed:n=20261125,starMassScale:r=1,centerOffsetAu:i=[0,0,0],softeningAu:a=1e-7,label:o=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let s=B({asteroidCount:t,seed:n,starMassScale:r,centerOffsetAu:i}),c=[C(0,`uniform`),C(1,`storage`)],l=t=>T(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${o}-${t}`,code:Te,entryPoint:t,bindings:c}),u=l(`compute_nbody_accel`),d=l(`kdk_half_kick_drift`),f=l(`kdk_second_kick`),p=e.createBuffer({label:`${o}-params`,size:32,usage:R.UNIFORM|R.COPY_DST}),m=e.createBuffer({label:`${o}-bodies`,size:s.packed.byteLength,usage:R.STORAGE|R.VERTEX|R.COPY_DST|R.COPY_SRC});e.queue.writeBuffer(m,0,s.packed);let h=s.massiveCount*64,g=e.createBuffer({label:`${o}-massive-staging`,size:h,usage:R.MAP_READ|R.COPY_DST}),_=w(e,{layout:u.bindGroupLayout,label:`${o}-bg`,entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:m}}]}),v=Float32Array.from(s.packed.subarray(0,s.massiveCount*16)),y=0,b=0,x=!1,S=!1,E=!1;function D(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([s.totalCount,s.massiveCount,0,0]),new Float32Array(n,16,4).set([t,be,a*a,0]),e.queue.writeBuffer(p,0,n)}async function O({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(E)return v;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));D(a);let c=Math.ceil(s.totalCount/64),l=e.createCommandEncoder({label:`${o}-step-${b}`}),p=l.beginComputePass({label:`${o}-pass`});p.setBindGroup(0,_),x||=(p.setPipeline(u.pipeline),p.dispatchWorkgroups(c),!0);for(let e=0;e<i;e+=1)p.setPipeline(d.pipeline),p.dispatchWorkgroups(c),p.setPipeline(u.pipeline),p.dispatchWorkgroups(c),p.setPipeline(f.pipeline),p.dispatchWorkgroups(c);p.end();let C=r&&!S;if(C&&l.copyBufferToBuffer(m,0,g,0,h),e.queue.submit([l.finish()]),b+=i,y+=a*i,C){S=!0;try{await g.mapAsync(R.MAP_READ),E||v.set(new Float32Array(g.getMappedRange(0,h))),g.unmap()}finally{S=!1}}return v}function k(e){let t=e*16;return{posAu:[v[t+0]+v[t+4],v[t+1]+v[t+5],v[t+2]+v[t+6]],velAuPerYr:[v[t+8],v[t+9],v[t+10]],massSolar:v[t+3],radiusAu:v[t+7],phi:v[t+15]}}function A(){let e=0,t=0,n=0,r=0,i=0,o=0,c=Array.from({length:s.massiveCount},(e,t)=>k(t));for(let s=0;s<c.length;s+=1){let l=c[s],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],o+=l.massSolar*Math.sqrt(u);for(let e=s+1;e<c.length;e+=1){let n=c[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],o=n.posAu[2]-l.posAu[2],s=Math.sqrt(r*r+i*i+o*o+a*a);t-=be*l.massSolar*n.massSolar/s}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,o),simTimeYr:y,stepIndex:b})}function ee(){if(!E){E=!0;for(let e of[p,m,g])try{e.destroy()}catch{}}}return Object.freeze({schema:_e,get massiveCount(){return s.massiveCount},get asteroidCount(){return s.asteroidCount},get totalCount(){return s.totalCount},get stepIndex(){return b},get simTimeYr(){return y},get catalog(){return z},getResidentBuffer:()=>m,getMassiveSnapshot:()=>v,getMassiveBodyState64:k,computeConservationDiagnostics:A,step:O,dispose:ee})}var De=25.4,Oe=-14.8,V=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Supergalactic Cosmic Web`,exponentLabel:`10²⁵ m`,log10SpanM:24.8,minLog10:21.8,maxLog10:25.5,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
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
  `:Me()}var Pe=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,H=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Fe=16,Ie=32,Le=`
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
const PK_BINS: u32 = ${Fe}u;

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
  let n_rem = min(params.remote_tile_count, ${Ie}u);
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
`,Re=`
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
`;function ze(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function Be(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function Ve(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=ze(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/f*2.5,x=M(e,n),S=x.n,w=x.total,E=[C(0,`uniform`),C(1,`storage`),C(2,`storage`)],D=T(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:Re,entryPoint:`generate_zeldovich_kspace`,bindings:E}),O=T(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:Re,entryPoint:`store_disp_axis`,bindings:E}),k=e.createBuffer({size:w*16,usage:H.STORAGE|H.COPY_SRC}),A=e.createBuffer({size:w*16,usage:H.MAP_READ|H.COPY_DST}),ee=e.createBuffer({size:x.byteLength,usage:H.STORAGE|H.COPY_DST|H.COPY_SRC}),j=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([S,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,b,v]);let r=e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(w/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[r]}},{binding:1,resource:{buffer:x.bufferA}},{binding:2,resource:{buffer:k}}]}),a=t.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=x.encodeInverseFrom(t,x.bufferA),s=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:k}}]});a=t.beginComputePass(),a.setPipeline(O.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([t.finish()]),await A.mapAsync(H.MAP_READ);let r=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let a=0;for(let e=0;e<w;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,w)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<w;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/S,_=.5/g,b=new Float32Array(w*2),C=(e,t,n)=>(((n+S)%S*S+(t+S)%S)*S+(e+S)%S)*4;for(let e=0;e<S;e+=1)for(let t=0;t<S;t+=1)for(let n=0;n<S;n+=1){let i=C(n+1,t,e),a=C(n-1,t,e),o=C(n,t+1,e),s=C(n,t-1,e),c=C(n,t,e+1),l=C(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*S+t)*S+n)*2]=g}e.queue.writeBuffer(x.bufferA,0,b),x.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let T=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),E=x.encodeForward(T);T.copyBufferToBuffer(E,0,ee,0,x.byteLength);for(let t=0;t<3;t+=1){let r=x.encodePoissonInverseFromKSpace(T,ee,{gradAxis:t+1}),i=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:k}}]}),a=T.beginComputePass();a.setPipeline(O.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}T.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([T.finish()]),await A.mapAsync(H.MAP_READ);let M=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let te=-.42857142857142855*Math.max(.001,h)**(-1/143),N=0;for(let e=0;e<w;e+=1){let t=te*M[e*4+0],n=te*M[e*4+1],r=te*M[e*4+2];M[e*4+0]=t,M[e*4+1]=n,M[e*4+2]=r,N+=t*t+n*n+r*r}let P=Math.sqrt(N/Math.max(1,w)),F=(e,t,n,r)=>{let i=(t+.5*f)/f*S,a=(n+.5*f)/f*S,o=(r+.5*f)/f*S,s=(Math.floor(i)%S+S)%S,c=(Math.floor(a)%S+S)%S,l=(Math.floor(o)%S+S)%S,u=(s+1)%S,d=(c+1)%S,p=(l+1)%S,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((C[t]*S+x[n])*S+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},I=Number(u?.[0])||0,ne=Number(u?.[1])||0,re=Number(u?.[2])||0,ie=d*d*d,L=new Float32Array(ie*16),ae=0,oe=0,se=0,ce=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=F(r,a,o,s),l=F(M,a,o,s),u=Be(a+c[0]+l[0]+I,f),d=Be(o+c[1]+l[1]+ne,f),m=Be(s+c[2]+l[2]+re,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];ae+=h,oe+=g,se+=_;let b=ce*16;L[b+0]=u,L[b+1]=d,L[b+2]=m,L[b+3]=1,L[b+4]=h,L[b+5]=g,L[b+6]=_,L[b+7]=.28,L[b+12]=+(ce%6==0),L[b+14]=i,ce+=1}ae/=ie,oe/=ie,se/=ie;for(let e=0;e<ie;e+=1)L[e*16+4]-=ae,L[e*16+5]-=oe,L[e*16+6]-=se;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<ie;t+=1){let n=L[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(L.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:ie,data:t,boxLengthMpc:f,aInit:i,rms2Over1:P/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:ie,globalParticleCount:ie,data:L,boxLengthMpc:f,aInit:i,rms2Over1:P/Math.max(1e-9,c)}}finally{x.destroy(),k.destroy(),A.destroy(),ee.destroy();for(let e of j)e.destroy()}}function He({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=ze(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=Be(i+s+b,f),g=Be(a+c+x,f),_=Be(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function Ue(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:f=null,initialConditions:p=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let m=p||He({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:f,initialPositionsShift:d}),g=m.particleCount,_=m.globalParticleCount??m.particleCount,v=n,y=v**3,b=M(e,v),x=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`),C(5,`storage`),C(6,`storage`),C(7,`storage`)],S=t=>T(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:Le,entryPoint:t,bindings:x}),w=S(`clear_grids`),E=S(`cic_deposit`),D=S(`prepare_poisson_rhs`),O=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),A=S(`store_force_y`),ee=S(`store_force_z`),j=S(`cic_kick_drift`),te=S(`reduce_telemetry_f32`),N=S(`reduce_tile_multipole`),P=e.createBuffer({size:64,usage:H.UNIFORM|H.COPY_DST}),F=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,m.data.byteLength),usage:H.VERTEX|H.STORAGE|H.COPY_DST|H.COPY_SRC});m.data.byteLength>0&&e.queue.writeBuffer(F,0,m.data);let I=e.createBuffer({size:y*4,usage:H.STORAGE}),ne=e.createBuffer({size:y*16,usage:H.STORAGE}),re=e.createBuffer({size:320,usage:H.STORAGE|H.COPY_SRC}),ie=e.createBuffer({size:320,usage:H.MAP_READ|H.COPY_DST}),L=e.createBuffer({size:32,usage:H.MAP_READ|H.COPY_DST}),ae=e.createBuffer({size:y*16,usage:H.STORAGE}),oe=e.createBuffer({size:(y+Ie)*16,usage:H.STORAGE|H.COPY_DST}),se=e.createBuffer({size:b.byteLength,usage:H.STORAGE|H.COPY_DST|H.COPY_SRC}),ce=t=>e.createBindGroup({layout:w.bindGroupLayout,entries:[P,F,I,t,ne,re,ae,oe].map((e,t)=>({binding:t,resource:{buffer:e}}))}),le=ce(b.bufferA),ue=ce(b.bufferB),de=ce(se),fe=e=>e===b.bufferA?le:e===b.bufferB?ue:de,pe=r/v,me=(c*pe)**2,he=l?c*pe:0,ge=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:me});let _e=i,ve=0,ye=0,be=0,R=1,z=null,xe={xMin:-.5*r,xMax:.5*r},Se=(t=null)=>{let n=t||xe,i=ze(_e,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,_e),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,ve,be]),new Float32Array(l,16,12).set([r,_e,a,i,o,c,ge,he,ye,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(P,0,l),{hA:i,gravPref:c}};function Ce(t=[]){let n=Array.isArray(t)?t.slice(0,Ie):[],r=new Float32Array(Ie*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return be=n.length,e.queue.writeBuffer(oe,y*16,r),be}let we=Math.ceil(y/64),B=Math.max(1,Math.ceil(g/64));async function Te({readTelemetry:t=!0}={}){let{hA:n}=Se(),i=a/(Math.max(.01,_e)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${ve}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,le),u.setPipeline(w.pipeline),u.dispatchWorkgroups(we),g>0&&(u.setPipeline(E.pipeline),u.dispatchWorkgroups(B)),u.setPipeline(D.pipeline),u.dispatchWorkgroups(we),u.end();let d=b.encodeForward(c);c.copyBufferToBuffer(d,0,se,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,de),u.setPipeline(O.pipeline),u.dispatchWorkgroups(Fe),u.end();let f=[k,A,ee];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,se,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,fe(t)),u.setPipeline(f[e-1].pipeline),u.dispatchWorkgroups(we),u.end()}if(u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,le),g>0&&(u.setPipeline(j.pipeline),u.dispatchWorkgroups(B)),u.setPipeline(te.pipeline),u.dispatchWorkgroups(2),u.end(),t&&c.copyBufferToBuffer(re,0,ie,0,320),e.queue.submit([c.finish()]),R=1,ye=i,_e=Math.min(1.5,_e+a),ve+=1,!t)return null;await ie.mapAsync(H.MAP_READ);let p=new Float32Array(ie.getMappedRange().slice(0,320));ie.unmap();let y=Math.sqrt(Math.max(0,p[0]/Math.max(1,p[3]))),x=p[1],S=p[4],C=[p[5],p[6],p[7]],T=Math.max(0,1/_e-1),M=[],N=[],P=[],F=0;for(let e=0;e<Fe;e+=1){let t=(2+e)*4,n=Math.round(p[t+2]);n>0&&(M.push(p[t+0]),N.push(p[t+1]),P.push(n),F+=n)}let I=N.length>0?N.slice(0,Math.min(4,N.length)).reduce((e,t)=>e+t,0)/Math.min(4,N.length):0;z===null&&I>0&&(z=I);let ne=z>0?Math.sqrt(I/z):1;return Object.freeze({schema:Pe,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:m.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:R,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:he,remoteTileCount:be,stepIndex:ve,scaleFactorA:_e,redshiftZ:T,hOverH0:ze(_e,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:y,maxOverdensity:x,kineticEnergy:S,momentum:C,powerSpectrumPk:Object.freeze({kBins:Object.freeze(M),pkValues:Object.freeze(N),modeCounts:Object.freeze(P),totalModes:F,lowKPower:I,linearGrowthRatio:ne}),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function Ee(){if(g===0)return new Float32Array;let t=e.createBuffer({size:m.data.byteLength,usage:H.MAP_READ|H.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(F,0,t,0,m.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(H.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function De({xMin:t=-.5*r,xMax:n=.5*r}={}){xe={xMin:Number(t),xMax:Number(n)},Se(xe);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,le),a.setPipeline(N.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(re,288,L,0,32),e.queue.submit([i.finish()]),await L.mapAsync(H.MAP_READ);let o=new Float32Array(L.getMappedRange().slice(0,32));return L.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:_e,stepIndex:ve})}return Object.freeze({schema:Pe,icBackend:m.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:he,particlesBuffer:F,forceGridBuffer:ne,injectRemoteTileMultipoles:Ce,step:Te,readParticlesSnapshot:Ee,readTileMultipoleSummary:De,getState:()=>({aScale:_e,redshiftZ:Math.max(0,1/_e-1),stepIndex:ve,submitsPerStep:R,remoteTileCount:be}),destroy(){b.destroy();for(let e of[P,F,I,ne,re,ie,L,ae,oe,se])e.destroy()}})}var We=27.211386245988,Ge=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var Ke=null,qe=null;function Je({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*Ge)),o=Math.log10(Math.max(4e4,.31*t*Ge)),s=Math.log10(Math.max(8e4,.78*(n+r)*Ge));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function Ye(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*We);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*We*1.45):t}async function Xe(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(qe&&!t)return qe;let[n,r,i,a]=await Promise.all([k(e,1,{A:1,maxScf:36}),k(e,2,{A:4,maxScf:36}),k(e,6,{A:12,maxScf:42}),k(e,8,{A:16,maxScf:42})]);return qe=Je({iH:Ye(n,13.6),iHe:Ye(r,24.59),iC:Ye(i,11.26),iO:Ye(a,13.62),backend:`webgpu-gate1-radial-ks`}),qe}function Ze(){if(qe)return qe;if(Ke)return Ke;let e=o(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=o(2,{gridPointsN:160,maxScf:80,tol:1e-5}),n=o(6,{gridPointsN:160,maxScf:80,tol:1e-5}),r=o(8,{gridPointsN:160,maxScf:80,tol:1e-5});return Ke=Je({iH:Math.max(10,Math.abs(e.totalEnergyHa)*We),iHe:Ye(t,24.59),iC:Ye(n,11.26),iO:Ye(r,13.62),backend:`host-gate1-radial-ks`}),Ke}function Qe(e,t=1,n=null){let r=n||Ze(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var $e=`ulg.astrophysics.planetary-interior-webgpu.v1`,et=66743e-15,tt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function U(e,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:o=12e3,degrees:s=[5,5],relativeTolerance:l=.025,maxBisectDepth:u=3,materialIndex:d=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let f=c(),p=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),g=Math.max(p+20,Number(n.thermodynamic.boilingPointK??p*1.5)),v=Math.max(g*2.5,Number(o)),y=f.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:p,boilingPointK:g,ionizationTempK:v,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(v*1.5,Number(o)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let r of y){let i=await t(e,r,(e,t)=>a(n,r.phase,e,t),{degrees:s,relativeTolerance:l,requirePositive:!0,maxDepth:u,propertyName:`densityKgPerM3`,logScale:!0});b.push(...i.polytopes)}let x=m(b,{materialIndex:d});return Object.freeze({schema:_,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var W=`
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
`;async function nt(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:i=2e4,maxRadiusM:a=15e7,convergePasses:o=3,maxProfileSamples:s=256,autoFitMaxPressurePa:c=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let l=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=m(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await U(e,n.bundle,{maxPressurePa:c,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);l.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let u=g(l.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),d=l.reduce((e,t)=>e+t.massFractionTarget,0)||1,f=new Float32Array(l.length*4),p=0;for(let e=0;e<l.length;e+=1)p+=l[e].massFractionTarget/d,f.set([p,l[e].tempK,l[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,l.length,s,o]),new Float32Array(v,16,4).set([Number(n),Number(i),Number(a),et]);let y=T(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:W,entryPoint:`solve_planetary_hydrostatic`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`read-only-storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`storage`)]}),b=e.createBuffer({size:32,usage:tt.UNIFORM|tt.COPY_DST}),x=e.createBuffer({size:Math.max(64,u.data.byteLength),usage:tt.STORAGE|tt.COPY_DST}),S=e.createBuffer({size:Math.max(16,f.byteLength),usage:tt.STORAGE|tt.COPY_DST}),w=e.createBuffer({size:16,usage:tt.STORAGE|tt.COPY_DST}),E=e.createBuffer({size:48,usage:tt.STORAGE|tt.COPY_SRC}),D=e.createBuffer({size:s*32,usage:tt.STORAGE|tt.COPY_SRC}),O=e.createBuffer({size:48,usage:tt.MAP_READ|tt.COPY_DST}),k=e.createBuffer({size:s*32,usage:tt.MAP_READ|tt.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,u.data),e.queue.writeBuffer(S,0,f),e.queue.writeBuffer(w,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,w,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,s*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(tt.MAP_READ),k.mapAsync(tt.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,s*32));O.unmap(),k.unmap();let c=Math.round(a[3]),d=c===2,p=c===1,m=Math.min(s,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(l.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:l[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let C=Number(l[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:$e,backend:`webgpu-polytope-atlas`,valid:p,failClosed:d,reason:d?`polytope-out-of-domain`:c===3?`max-radius-reached`:`ok`,failureState:d?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:l[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:C,dynamoCapable:p&&C>1e4&&t>1e10,layerCount:l.length,profile:Object.freeze(g),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,w,E,D,O,k])e.destroy()}}var rt=`ulg.astrophysics.stellar-nuclear-network.v1`,G=`ulg.astrophysics.stellar-nuclear-webgpu.v1`,it=`ulg.astrophysics.lane-emden-webgpu.v1`,K=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),at=-.7823334099999784,ot=1602176634e-22,st=167262192369e-38,ct=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),lt=null;function ut(){if(lt)return lt;let e=ct.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+s(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+s(t,n)*r,0),c=r-i,l=o-a+c*at,u=Number(e.neutrinoLossMeV||0),d=l>0?Math.max(0,l-u):l,f=Math.abs(d)*ot/(t*st);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:c,ignitionTempK:e.ignitionTempK,qValueMeV:l,qValueTotalMeV:l,qValueThermalMeV:d,neutrinoLossMeV:u,qValueJPerKg:f,exothermic:l>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return lt=Object.freeze({schema:rt,channels:Object.freeze(e),byId:t,accuracyTier:h.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),lt}function dt(){let{byId:e}=ut();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var ft=`
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
`;async function pt(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice`);let n=Array.isArray(t)?t:[];if(n.length===0)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires at least one state sample`);let r=dt(),i=new Float32Array(n.length*8);for(let e=0;e<n.length;e+=1){let t=n[e];i.set([Number(t.rhoKgM3??15e4),Number(t.temperatureK??15e6),Number(t.xH??.74),Number(t.xHe??.25),Number(t.xZ??t.xMetals??.01),Number(t.dtS??0),0,0],e*8)}let a=T(e,{cacheKey:`ulg-stellar-nuclear-network.v1`,label:`ulg-stellar-nuclear-network`,code:ft,entryPoint:`eval_stellar_nuclear_network`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n.length,0,0,0]),new Float32Array(o,16,4).set([r.ppJPerKgH,r.tripleAlphaJPerKgHe,r.fePhotodisJPerKgFe,0]);let s=e.createBuffer({size:32,usage:K.UNIFORM|K.COPY_DST}),c=e.createBuffer({size:i.byteLength,usage:K.STORAGE|K.COPY_DST}),l=e.createBuffer({size:i.byteLength,usage:K.STORAGE|K.COPY_SRC}),u=e.createBuffer({size:i.byteLength,usage:K.MAP_READ|K.COPY_DST});try{e.queue.writeBuffer(s,0,o),e.queue.writeBuffer(c,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[s,c,l].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-stellar-nuclear-network`}),f=d.beginComputePass();f.setPipeline(a.pipeline),f.setBindGroup(0,t),f.dispatchWorkgroups(Math.ceil(n.length/64)),f.end(),d.copyBufferToBuffer(l,0,u,0,i.byteLength),e.queue.submit([d.finish()]),await u.mapAsync(K.MAP_READ);let p=new Float32Array(u.getMappedRange().slice(0,i.byteLength));u.unmap();let m=[];for(let e=0;e<n.length;e+=1){let t=e*8;m.push(Object.freeze({epsPpWPerKg:p[t+0],epsCnoWPerKg:p[t+1],eps3aWPerKg:p[t+2],epsPhotodisWPerKg:p[t+3],epsTotalWPerKg:p[t+0]+p[t+1]+p[t+2],nextMassFractions:Object.freeze({xH:p[t+4],xHe:p[t+5],xZ:p[t+6]}),energyDepositedJPerKg:p[t+7]}))}return Object.freeze({schema:G,backend:`webgpu`,burnConstants:r,results:Object.freeze(m),provenance:Object.freeze({status:`gate1-nuclear-webgpu-derived`,scientificValidation:!1})})}finally{for(let e of[s,c,l,u])e.destroy()}}var q=`
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
`;async function mt(e,t=[1.5,3],{dXi:n=.002,maxXi:r=25}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice`);let i=Float32Array.from(Array.isArray(t)?t:[t]);if(i.length===0)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires at least one polytrope index`);let a=T(e,{cacheKey:`ulg-lane-emden-rk4.v1`,label:`ulg-lane-emden-rk4`,code:q,entryPoint:`solve_lane_emden_rk4`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=Math.ceil(r/Math.max(1e-5,n))+4,s=new ArrayBuffer(32);new Uint32Array(s,0,4).set([i.length,o,0,0]),new Float32Array(s,16,4).set([n,r,0,0]);let c=e.createBuffer({size:32,usage:K.UNIFORM|K.COPY_DST}),l=e.createBuffer({size:Math.max(16,i.byteLength),usage:K.STORAGE|K.COPY_DST}),u=e.createBuffer({size:i.length*16,usage:K.STORAGE|K.COPY_SRC}),d=e.createBuffer({size:i.length*16,usage:K.MAP_READ|K.COPY_DST});try{e.queue.writeBuffer(c,0,s),e.queue.writeBuffer(l,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[c,l,u].map((e,t)=>({binding:t,resource:{buffer:e}}))}),n=e.createCommandEncoder({label:`ulg-lane-emden-rk4`}),r=n.beginComputePass();r.setPipeline(a.pipeline),r.setBindGroup(0,t),r.dispatchWorkgroups(Math.ceil(i.length/64)),r.end(),n.copyBufferToBuffer(u,0,d,0,i.length*16),e.queue.submit([n.finish()]),await d.mapAsync(K.MAP_READ);let o=new Float32Array(d.getMappedRange().slice(0,i.length*16));d.unmap();let f=[];for(let e=0;e<i.length;e+=1){let t=e*4;f.push(Object.freeze({polytropeIndexN:o[t+0],xi1:o[t+1],massIntegral:o[t+2],centralToMeanDensityRatio:o[t+3],g7Advisory:!0}))}return Object.freeze({schema:it,backend:`webgpu`,solutions:Object.freeze(f)})}finally{for(let e of[c,l,u,d])e.destroy()}}var ht=`peercompute.ulg.hydrogen-stellar-closure.v1`,gt=`peercompute.ulg.stellar-closure-table-abi.v1`,_t=1380649e-29,vt=16605390666e-37,J=167262192369e-38,yt=91093837015e-41,bt=1054571817e-43,xt=299792458,St=66743e-15,Ct=4*5.670374419e-8/xt,wt=1602176634e-28,Tt=27.211386245988,Et=198847e25,Dt=dt();Dt.ppThermalMeV;var Ot=Dt.ppJPerKgH;Dt.tripleAlphaMeV;var kt=Dt.tripleAlphaJPerKgHe;Dt.fePhotodisMeV;var Y=null;async function At(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Y?.backend===`webgpu`&&!t)return Y;let n=await k(e,1,{A:1,maxScf:45}),i=Number(n.totalEnergyHa??-.5),a=Number(n.homoEnergyHa??n.orbitals?.[0]?.energyHa??-.5),o=Math.max(11,Math.min(15,Math.abs(i)*Tt)),s=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),c=.05,l=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),p=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-c]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),m=2*i,h=Math.max(.08,m-s.totalEnergyHa)*Tt,g=Math.max(.1,(l.totalEnergyHa-2*s.totalEnergyHa+p.totalEnergyHa)/(c*c)),_=Math.sqrt(g/(.5*1836.152673))*Tt*wt/_t,v=d(15e4/J*r**3),y=f(v);return Y=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:a,hIonizationEv:o,hIonizationTempK:o*wt/_t,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:m,h2DiradicalStretched:1,h2DissociationEv:h,h2DissociationTempK:h*wt/_t,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Y}function jt({forceRecompute:t=!1}={}){if(Y&&!t)return Y;let n=o(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),i=n.orbitals?.[0]?.energyHa??-.5,a=Math.max(11,Math.min(15,Math.abs(n.totalEnergyHa)*Tt)),s=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),c=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),l=Math.max(.08,c.totalEnergyHa-s.totalEnergyHa)*Tt,u=.04,p=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-u]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(u*u)),_=Math.sqrt(g/(.5*1836.152673))*Tt*wt/_t,v=d(15e4/J*r**3),y=f(v);return Y=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:n.totalEnergyHa,h1sOrbitalEnergyHa:i,hIonizationEv:a,hIonizationTempK:a*wt/_t,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:c.totalEnergyHa,h2DiradicalStretched:c.diradicalCharacter,h2DissociationEv:l,h2DissociationTempK:l*wt/_t,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Y}function X(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/J);if(n<=0)return 0;let r=bt*Math.cbrt(3*Math.PI*Math.PI*n)/(yt*xt),i=r*r,a=yt**4*xt**5/(24*Math.PI*Math.PI*bt**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function Mt(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function Z({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||jt(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/J,m=s*d/(4*J),h=s*f/(16*J),g=2*Math.PI*J*_t*c/(2*Math.PI*bt)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*yt*_t*c/(2*Math.PI*bt)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),ee=s/vt/A,j=A*_t*c,M=Ct/3*c**4,te=X(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),N=Mt(s),P=j+M+te+N,F=te/Math.max(1e-30,P),I=M/Math.max(1e-30,P),ne=N/Math.max(1e-30,P),re=4*b*(1-b),ie=4*w*(1-w),L=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,ae=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),oe=ae*(1-I)+4/3*I,se=Math.max(1.06,oe-.5*re-.48*ie-L)*(1-ne)+2.75*ne,ce=.1*(1/(1+Math.exp((c-1600)/180))),le=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),ue=4e21*(1+u)*(f+.001)*s*c**-3.5,de=.02*(1+u)*Math.max(.01,w),fe=Math.max(1e-4,Math.min(1e5,ce+le+ue+de)),pe=j/(Math.max(.15,ae-1)*s)+3*M/s,me=(1-b)*.5*u*o.h2DissociationEv*wt/J,he=w*u*o.hIonizationEv*wt/J,ge=pe+me+he;return{schema:ht,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:ee,gammaEff:se,pressureIdealPa:j,pressureRadPa:M,pressureDegPa:te,pressureNucSatPa:N,pressureTotalPa:P,pDegFraction:F,pRadFraction:I,pNucFraction:ne,soundSpeedMPerS:Math.sqrt(Math.max(1,se*P/s)),kappaM2PerKg:fe,specificEnergyJPerKg:ge,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Nt({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/Ot),E=Math.min(d+T,x*a/kt),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*St*e*Et/(xt*xt),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Pt(e){let t=E(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function Ft({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function It({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||jt(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=Z({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:gt,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function Lt({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=It({anchors:t?await At(t):jt()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:gt,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Rt=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,zt=128,Bt=32,Vt=Bt*Bt*Bt,Ht=Vt*8,Ut=`
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

const HYDRO_DIM: u32 = ${Bt}u;
const HYDRO_COUNT: u32 = ${Vt}u;

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
`;function Wt(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=Z({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=Nt({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=Ft({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),ee=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),j=Pt(ee);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:ee,photosphereSrgb:j,stage:A}}function Gt({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,rCellFactor:o=.075,baseLogRho:s=-16.2,refRhoSim:c=.08,burnTimescaleS:l=42e13,tScaleK:u=78e4,label:d=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let f=Float32Array.from(t),p=f.length/16,m=n||It({nRho:28,nTemp:40});function h(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let g=h(f),_=0,v=0,y=!1,b=!1;function x(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<p;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/p*1e3),c[12]=Math.round(i/p*1e3),c[15]=1667,Wt(c,p,g,!1)}let S=x(f),E=Math.max(64,f.byteLength),D=[e.createBuffer({label:`${d}-p0`,size:E,usage:172}),e.createBuffer({label:`${d}-p1`,size:E,usage:172})],O=ge(e,{maxCount:p,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:o,label:`${d}-ss-atlas`}),k=dt(),A=e.createBuffer({label:`${d}-hydro-accum`,size:Ht*4,usage:zt}),ee=e.createBuffer({label:`${d}-hydro-grid`,size:Vt*2*16,usage:zt}),j=e.createBuffer({label:`${d}-eos-table`,size:m.data.byteLength,usage:136}),M=e.createBuffer({label:`${d}-telemetry`,size:64,usage:132}),te=e.createBuffer({label:`${d}-telemetry-staging`,size:64,usage:9}),N=e.createBuffer({label:`${d}-params`,size:96,usage:72}),P=e.createBuffer({label:`${d}-body-staging`,size:E,usage:9});e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f),e.queue.writeBuffer(j,0,m.data);let F=[C(0,`read-only-storage`),C(1,`storage`),C(2,`storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`read-only-storage`),C(6,`storage`),C(7,`uniform`)],I=t=>T(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v26-cic-grad-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:Ut,entryPoint:t,bindings:F}),ne={clear:I(`sgh_clear`),deposit:I(`sgh_deposit`),finalize:I(`sgh_finalize`),integrate:I(`sgh_integrate`)},re=(t,n,r)=>w(e,{layout:ne.integrate.bindGroupLayout,label:`${d}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:O.accPhiBuffer}},{binding:4,resource:{buffer:ee}},{binding:5,resource:{buffer:j}},{binding:6,resource:{buffer:M}},{binding:7,resource:{buffer:N}}]}),ie=[re(D[0],D[1],0),re(D[1],D[0],1)],L=0,ae=!1,oe=!1,se=!0;async function ce(){if(!D||!P||oe||b)return f;oe=!0;try{let t=e.createCommandEncoder({label:`${d}-readback`});t.copyBufferToBuffer(D[L],0,P,0,f.byteLength),e.queue.submit([t.finish()]),await P.mapAsync(1),f.set(new Float32Array(P.getMappedRange())),P.unmap()}finally{oe=!1}return f}async function le({dt:t=.018,timeAccel:n=1,readTelemetry:o=!0}={}){if(b||!D)return S;let f=Math.max(.25,Math.min(25,Number(n)||1)),h=Math.max(.004,Math.min(.028,Number(t)||.018)),x=1380649e-29/167262192369e-38*1.5*u,C=new ArrayBuffer(96),w=new Uint32Array(C),T=new Float32Array(C);w[0]=p,w[1]=m.nRho,w[2]=m.nTemp,w[3]=+!!se,T[4]=h,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=m.logRhoMin,T[10]=m.logRhoMax,T[11]=m.logTempMin,T[12]=m.logTempMax,T[13]=s,T[14]=c,T[15]=l,T[16]=f,T[17]=u,T[18]=k.ppJPerKgH,T[19]=k.tripleAlphaJPerKgHe,T[20]=k.fePhotodisJPerKgFe,T[21]=x,e.queue.writeBuffer(N,0,C),O.writeParams({count:p,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let E=L,A=1-L,ee=ie[E],j=Math.ceil(p/64),P=Math.ceil(Vt/64),F=e.createCommandEncoder({label:`${d}-step-${_}`}),I=F.beginComputePass({label:`${d}-pass`});O.encodeIntoPass(I,{srcBuffer:D[E],count:p}),I.setPipeline(ne.clear.pipeline),I.setBindGroup(0,ee),I.dispatchWorkgroups(P),I.setPipeline(ne.deposit.pipeline),I.setBindGroup(0,ee),I.dispatchWorkgroups(j),I.setPipeline(ne.finalize.pipeline),I.setBindGroup(0,ee),I.dispatchWorkgroups(P),I.setPipeline(ne.integrate.pipeline),I.setBindGroup(0,ee),I.dispatchWorkgroups(j),I.end();let re=o&&!ae;if(re&&F.copyBufferToBuffer(M,0,te,0,64),se=re,e.queue.submit([F.finish()]),L=A,_+=1,v+=h*f*.35,re){ae=!0;try{await te.mapAsync(1);let e=new Uint32Array(te.getMappedRange().slice(0));te.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=15e7&&(y=!0),S=Wt(e,p,g,y)}finally{ae=!1}}return S}function ue(t){return f=Float32Array.from(t),g=h(f),_=0,v=0,y=!1,L=0,se=!0,S=x(f),D&&(e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f)),S}function de(){b||(b=!0,D?.[0]?.destroy(),D?.[1]?.destroy(),O.destroy(),A.destroy(),ee.destroy(),j.destroy(),M.destroy(),te.destroy(),N.destroy(),P.destroy(),D=null)}return{schema:Rt,get count(){return p},get totalMassSolar(){return g},get stepIndex(){return _},get simTimeMyr(){return v},get backend(){return`webgpu`},get gravityMode(){return O.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return k},get closureTable(){return m},get anchors(){return m.anchors},getTelemetry:()=>S,getBodies:()=>f,getResidentBuffer:()=>D?D[L]:null,readbackBodies:ce,step:le,resetBodies:ue,dispose:de}}var Kt=Object.freeze({id:`main-sequence-star`,label:`Hydrostatic Main-Sequence Star (1.0 M☉)`,shortLabel:`1 M☉ Active Star`,description:`Hydrostatic Lane-Emden convective 1.0 M☉ G2V star in nuclear-thermal equilibrium with differential rotation driving an emergent 3D convective dynamo.`,totalMassSolar:1,initialTempK:15e6,initialLog10Rho:5.15,angularMomentum:.36,cloudRadius:4,geometry:`lane-emden-star`}),qt=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function Jt(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Yt({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=t===`main-sequence-star`?Kt:qt[t]||qt[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=Jt(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0,C=null,w=null,T=null,E=null,D=.74,O=.25,k=.01;if(a.geometry===`lane-emden-star`){let e=.5;for(let t=0;t<24;t+=1){let t=d(),n=t*t*Math.max(0,1-t*t)**1.5;if(d()*.19<=n){e=t;break}}let t=.12+e*(a.cloudRadius-.12),n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*o*Math.cos(s),i=t*n,v=t*o*Math.sin(s);let c=(.48-n*n*.14)*(.78+.35*Math.exp(-e*1.4)),l=Math.max(0,(e-.56)/.44),u=Math.sin(s*6+n*4)*Math.cos(e*8)*l*.18;y=-v*c+r/t*u+f()*.03,b=i/t*u+f()*.03,x=r*c+v/t*u+f()*.03;let p=Math.max(.002,1-e*e*.996),m=Math.max(5800,5800+(a.initialTempK-5800)*p),h=10**(-3.6+(a.initialLog10Rho- -3.6)*p**.72);C=Math.log10(m),w=Math.log10(h),T=0,E=e<.92?1:.45;let g=.22*Math.exp(-e*e*8);D=.72-g,O=.26+g,k=.02}else if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let A=Math.hypot(r-S,i,v),ee=Math.exp(-A*A/12),j=w??g+ee*1,M=C??h+ee*.1,te=.32+.04*Math.min(6,A);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=te,s[t+8]=M,s[t+9]=j,s[t+10]=D,s[t+11]=C!=null&&C>6.8?-1.5:-30,s[t+12]=T??.998,s[t+13]=E??0,s[t+14]=O,s[t+15]=k}return s}var Xt=`ulg.astrophysics.galactic-cic-pm-webgpu.v1`,Zt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Qt=`
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
`;function $t({device:e=null,initialBodies:t,gridN:n=32,boxSize:r=48,secondSmbhIndex:i=0,smbhSoftening:a=.72,label:o=`ulg-galactic-cic-pm`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createGalacticParticleMeshEngineWebGpu requires a live WebGPU GPUDevice`);let s=Float32Array.from(t),c=Math.floor(s.length/8),l=Math.max(16,Math.min(64,Math.trunc(n))),u=l*l*l,d=r/l,f=1/(d*d*d),p=0;for(let e=0;e<c;e+=1)e===0||i>0&&e===i||(p+=Math.max(0,s[e*8+3]));let m=p/(r*r*r),h=M(e,l);h.writeAxisPoissonParams({boxLength:r,smoothR2:(.55*d)**2});let g=Math.max(32,s.byteLength),_=e.createBuffer({label:`${o}-bodies`,size:g,usage:Zt.STORAGE|Zt.VERTEX|Zt.COPY_DST|Zt.COPY_SRC}),v=e.createBuffer({label:`${o}-rho`,size:u*4,usage:Zt.STORAGE}),y=e.createBuffer({label:`${o}-phi`,size:u*4,usage:Zt.STORAGE}),b=e.createBuffer({label:`${o}-params`,size:48,usage:Zt.UNIFORM|Zt.COPY_DST}),x=e.createBuffer({label:`${o}-staging`,size:g,usage:Zt.MAP_READ|Zt.COPY_DST});e.queue.writeBuffer(_,0,s);let S=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`)],E=t=>T(e,{cacheKey:`ulg-galactic-pm-${t}.v1`,label:`${o}-${t}`,code:Qt,entryPoint:t,bindings:S}),D=E(`pm_drift_half`),O=E(`pm_clear_rho`),k=E(`pm_deposit_cic`),A=E(`pm_pack_fft_rhs`),ee=E(`pm_store_phi`),j=E(`pm_kick_and_drift`),te=E(`pm_calibrate_equilibrium`),N=(t,n)=>w(e,{layout:j.bindGroupLayout,label:`${o}-bg-${n}`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:t}},{binding:4,resource:{buffer:y}}]}),P=N(h.bufferA,`a`),F=N(h.bufferB,`b`),I=0,ne=!1,re=!1,ie=Math.ceil(c/64),L=Math.ceil(u/64);async function ae(){if(re||ne||x.mapState!==`unmapped`)return s;ne=!0;try{let t=e.createCommandEncoder({label:`${o}-readback`});t.copyBufferToBuffer(_,0,x,0,g),e.queue.submit([t.finish()]),await x.mapAsync(Zt.MAP_READ),re||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!re&&e?.name!==`AbortError`)throw e}finally{ne=!1}return s}async function oe({gravity:t=1,softening:n=.35}={}){if(re||i>0)return;let s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([c,l,i,I]),new Float32Array(s,16,8).set([r,d,.004,t,n*n,a*a,m,f]),e.queue.writeBuffer(b,0,s);let u=e.createCommandEncoder({label:`${o}-cal-eq`}),p=u.beginComputePass({label:`${o}-cal-dep`});p.setBindGroup(0,P),p.setPipeline(O.pipeline),p.dispatchWorkgroups(L),p.setPipeline(k.pipeline),p.dispatchWorkgroups(ie),p.setPipeline(A.pipeline),p.dispatchWorkgroups(L),p.end();let g=h.encodePoissonSolve(u,{gradAxis:0})===h.bufferA?P:F;p=u.beginComputePass({label:`${o}-cal-apply`}),p.setBindGroup(0,g),p.setPipeline(ee.pipeline),p.dispatchWorkgroups(L),p.setPipeline(te.pipeline),p.dispatchWorkgroups(ie),p.end(),e.queue.submit([u.finish()])}async function se({dt:t=.008,substeps:n=2,gravity:u=1,softening:p=.35,readback:v=!1}={}){if(re)return s;let y=Math.max(1,Math.min(8,Math.trunc(n))),S=Math.max(5e-4,Math.min(.012,(Number(t)||.008)/y)),C=new ArrayBuffer(48);new Uint32Array(C,0,4).set([c,l,i,I]),new Float32Array(C,16,8).set([r,d,S,u,p*p,a*a,m,f]),e.queue.writeBuffer(b,0,C);let w=e.createCommandEncoder({label:`${o}-step-${I}`});for(let e=0;e<y;e+=1){let t=w.beginComputePass({label:`${o}-dep-${e}`});t.setBindGroup(0,P),t.setPipeline(D.pipeline),t.dispatchWorkgroups(ie),t.setPipeline(O.pipeline),t.dispatchWorkgroups(L),t.setPipeline(k.pipeline),t.dispatchWorkgroups(ie),t.setPipeline(A.pipeline),t.dispatchWorkgroups(L),t.end();let n=h.encodePoissonSolve(w,{gradAxis:0})===h.bufferA?P:F;t=w.beginComputePass({label:`${o}-kick-${e}`}),t.setBindGroup(0,n),t.setPipeline(ee.pipeline),t.dispatchWorkgroups(L),t.setPipeline(j.pipeline),t.dispatchWorkgroups(ie),t.end(),I+=1}let T=v&&!ne&&x.mapState===`unmapped`;if(T&&(ne=!0,w.copyBufferToBuffer(_,0,x,0,g)),e.queue.submit([w.finish()]),T)try{await x.mapAsync(Zt.MAP_READ),re||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!re&&e?.name!==`AbortError`)throw e}finally{ne=!1}return s}function ce(){if(!re){re=!0,h.destroy();for(let e of[_,v,y,b,x])try{e.destroy()}catch{}}}return Object.freeze({schema:Xt,get count(){return c},get activeCount(){return c},get stepIndex(){return I},get gridN(){return l},get boxSize(){return r},get backend(){return`webgpu`},get gravityMode(){return`webgpu-cic-3dfft-pm+smbh`},getBodies:()=>s,getResidentBuffer:()=>_,calibrateEquilibrium:oe,readbackBodies:ae,step:se,dispose:ce})}function en(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var tn=`
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
`;function nn({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){en(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=T(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:tn,entryPoint:`step_nbody`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`uniform`)]}),m=[w(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),w(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function rn(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Q=[`disk`,`barred`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`],an=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],on=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function sn({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.28,centerOffset:a=[0,0,0]}={}){let o=Math.max(256,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=rn(n),l=()=>{let e=Math.max(1e-7,c()),t=c();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},u=Number(a?.[0])||0,d=Number(a?.[1])||0,f=Number(a?.[2])||0,p=(e,t,n,i,a,o,p,m,h,g,_=1)=>{let v=t-e,y=44*_,b=135*_,x=290*_,S=780*_,C=1.25*_,w=3.2*_,T=7.4*_,E=1.05*_,D=.72*_,O=e=>{let t=Math.max(.15*_,e),n=r*y*t/(t*t+D*D)**1.5,i=Math.hypot(t,E),a=t*t*b/((t+C)*(t+C)),o=t/w,s=x*(1-(1+o)*Math.exp(-o)),c=t*t*S/((t+T)*(t+T));return n+r*(a+s+c)*t/(i*i*i)},k=e=>Math.sqrt(Math.max(0,e*O(e))),A=Math.cos(h),ee=Math.sin(h),j=Math.cos(g),M=Math.sin(g),te=(e,t,n)=>{let r=t*A-n*ee,i=t*ee+n*A;return[e*j-r*M,e*M+r*j,i]};s.set([n+u,i+d,a+f,y,o,p,m,.05],e*8);let N=Math.floor((v-1)*.36),P=Math.floor((v-1)*.14),F=Math.floor((v-1)*.04),I=v-1-N-P-F,ne=S/Math.max(1,N),re=b/Math.max(1,P+F),ie=x/Math.max(1,I),L=e+1;for(let e=0;e<N&&L<t;e+=1,L+=1){let e=Math.max(.01,Math.min(.88,c())),t=Math.min(18.5*_,T*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),r=2*c()-1,h=Math.sqrt(Math.max(0,1-r*r)),g=2*Math.PI*c(),v=t*h*Math.cos(g),y=t*r,b=t*h*Math.sin(g),x=k(t)*.56,S=te(v,y,b),C=te(l()*x,l()*x,l()*x);s.set([n+S[0]+u,i+S[1]+d,a+S[2]+f,ne,o+C[0],p+C[1],m+C[2],-1],L*8)}for(let e=0;e<P+F&&L<t;e+=1,L+=1){let t=e>=P,r=Math.max(.005,Math.min(.92,c())),h=t?C*4:C,g=Math.min(11.5*_,h*Math.sqrt(r)/Math.max(.07,1-Math.sqrt(r))),v=2*c()-1,y=Math.sqrt(Math.max(0,1-v*v)),b=2*Math.PI*c(),x=g*y*Math.cos(b),S=g*v*(t?.85:.62),w=g*y*Math.sin(b),T=k(g),E=T*(t?.5:.36),D=t?.18:.62,O=-Math.sin(b)*T*D+l()*E,A=l()*E*.68,ee=Math.cos(b)*T*D+l()*E,j=te(x,S,w),M=te(O,A,ee),N=t?.24+c()*.1:.02+Math.min(.28,g/(2.6*_)*.24);s.set([n+j[0]+u,i+j[1]+d,a+j[2]+f,re,o+M[0],p+M[1],m+M[2],N],L*8)}let ae=Math.tan(17*Math.PI/180);for(;L<t;L+=1){let e=-w*Math.log(Math.max(1e-4,c()*c())),t=Math.max(.32*_,Math.min(11.5*_,e*.78)),r=Math.min(1,Math.max(0,(t-.75*_)/(2*_))),h=c()<.72*r,g,v;if(h){let e=L&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*_))/ae,a=(n?.26:.36)+t/_*.022;g=r+i+l()*a,v=c()<.11&&t>1.4*_&&t<8.5*_?.82+c()*.22:.38+c()*.38}else g=c()*Math.PI*2,v=.08+c()*.26;let y=(.14+t/_*.028)*_,b=t*Math.cos(g),x=t*Math.sin(g),S=l()*y,C=k(t),T=C*.985,E=C*(.08+.05*Math.exp(-t/w)),D=C*.045,O=l()*E,A=T+l()*(E*.72),ee=Math.cos(g)*O-Math.sin(g)*A,j=l()*D,M=Math.sin(g)*O+Math.cos(g)*A,N=te(b,S,x),P=te(ee,j,M);s.set([n+N[0]+u,i+N[1]+d,a+N[2]+f,ie,o+P[0],p+P[1],m+P[2],v],L*8)}};if(t===`binary`){let e=o>>1;p(0,e,-5.8,.9,-1.5,1.35,-.22,1.05,.35,.18,.68),p(e,o,5.8,-.9,1.5,-1.35,.22,-1.05,-.42,-.25,.68)}else if(t===`barred`){p(0,o,0,0,0,0,0,0,0,0,1);let e=Math.floor(o*.42);for(let t=Math.floor(o*.22);t<e;t+=1){let e=t*8;if(s[e+7]<0)continue;let n=(c()*2-1)*3.6,r=l()*.24,i=l()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;s.set([n+u,r+d,i+f,s[e+3]*1.15,-i*o+l()*.45,l()*.25,n*o+l()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<o;n+=1){let e=n*8;if(!(s[e+7]<0)&&c()<.78){let a=n&1,o=3.1+c()**.85*7.8,p=a*Math.PI+Math.log(o/3)/t+l()*(.2+.02*o),m=l()*(.12+.025*o),h=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),g=c()<.14;s.set([Math.cos(p)*o+u,m+d,Math.sin(p)*o+f,s[e+3],-Math.sin(p)*h+l()*.45,l()*.2,Math.cos(p)*h+l()*.45,g?.85+c()*.2:.44+c()*.34],e)}}}else if(t===`proto`){p(0,o,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(c()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(o*.45);for(let n=t;n<o;n+=1){let t=n*8;if(!(s[t+7]<0))if(c()<.52){let i=e[n%e.length],a=c()**.6*1.35,o=c()*Math.PI*2,p=2*c()-1,m=Math.sqrt(Math.max(0,1-p*p)),h=i[0]+a*m*Math.cos(o)*1.25,g=i[1]+a*p*.45,_=i[2]+a*m*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(h,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));s.set([h+u,g+d,_+f,s[t+3]*1.2,-_/v*y+l()*1.25,l()*.95,h/v*y+l()*1.25,.78+c()*.28],t)}else s[t+1]=s[t+1]*2.4,s[t+7]=Math.min(1.02,s[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(o*.72);p(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((o-e)*.3);for(let n=e;n<o;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(c())*1.15,n=2*c()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=c()*Math.PI*2;s.set([7.4+e*r*Math.cos(a)+u,2.2+e*n+d,-2+e*r*Math.sin(a)+f,45/Math.max(1,t),-1.4+l()*.55,2.4+l()*.55,4.1+l()*.55,.52+c()*.34],i)}else{let n=(a-t)/Math.max(1,o-e-t),p=-.35+n*Math.PI*1.85,m=7.4+Math.sin(p*1.5)*1.65,h=.25+.42*n,g=Math.cos(p)*m+l()*h,_=Math.sin(p)*m*.72+l()*h,v=Math.sin(p+.8)*m*.58+l()*h,y=Math.max(1,Math.hypot(g,_,v)),b=Math.sqrt(r*1150/y);s.set([g+u,_+d,v+f,12/Math.max(1,o-e-t),-Math.sin(p)*b*.75,Math.cos(p)*b*.55,Math.cos(p+.8)*b*.42,.34+c()*.42],i)}}}else if(t===`globular`){let e=520/o,t=.65;s.set([u,d,f,8,0,0,0,.12],0);for(let n=1;n<o;n+=1){let i=Math.max(.001,Math.min(.96,c())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=c()*Math.PI*2,h=8+520*a**3/(a*a+t*t)**1.5,g=Math.sqrt(r*h/(3*Math.hypot(a,.45))),_=a<1.3&&c()<.08;s.set([a*p*Math.cos(m)+u,a*o+d,a*p*Math.sin(m)+f,e,l()*g,l()*g,l()*g,_?.68+c()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`sphere`){let e=3.2,t=950/o;s.set([u,d,f,60,0,0,0,.05],0);for(let n=1;n<o;n+=1){let i=Math.max(.004,Math.min(.93,c())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=2*Math.PI*c(),h=60+a*a*950/((a+e)*(a+e)),g=Math.sqrt(r*h/(3*Math.hypot(a,1.2)));s.set([a*p*Math.cos(m)+u,a*o*.78+d,a*p*Math.sin(m)+f,t,l()*g,l()*g,l()*g,.04+Math.min(.3,a/10*.26)],n*8)}}else p(0,o,0,0,0,0,0,0,0,0,1);return s}function cn(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=rn(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function ln(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function un(e,{seed:t=20261125,qualityId:r=`med`,initialElementZ:a=26}={}){let o=t>>>0,s=Ae[r]||Ae.med,c=new v({artifactCache:new b});ue(j);let d=new Map,f=new Map,p=`present-day`,m=pe({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),h=`web`,g=null,_=null,S=null,C=[],w=null,T=null,E=null,k=null,M=null,le=new Float32Array,de=.3,ge=`disk`,_e=1,ye=null,be=[],R=[4.8,.04,2.1],xe=`solar-system`,Se=!0,Ce=null,we=null,B=null,Te=null,De=null,Oe=3,V=`nbody`,je=null,Me=null,Ne=!0,Pe=null,H=null,Fe=.94,Ie=null,Le=null,Re=null,ze=null,Be=null,He=null,We=null,Ge=null,Ke=null,qe=null,Je=null,Ye=null,Ze=new Float32Array,$e=.36,et=`main-sequence-star`,tt=null,W=null,rt=null,G=null,it=2,K=`fusion`,at=null,ot=null,st=new Float32Array,ct=.58,lt=null,ut=null,ft=null,q=null,ht=null,gt=null,_t=new Float32Array,vt=null,J=`standard`,yt=null,bt=3,xt=!1,St=[],Ct=null,wt=null,Tt=null,Et=!0,Dt=null,Ot=null,kt=!1,Y=null,At=null,jt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},X=null,Mt=null,Z=a,Nt=300,Pt=!1,Ft=`solid`,It=[],Rt=a,zt=3,Bt=2,Vt=0,Ht=!0,Ut=`atom`,Wt=`H2O`,Kt=null,qt=null,Jt=a,Xt=56,Zt=null,Qt=null,en=null,tn=null,ln={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},un=!1,dn=!1;async function fn(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(d.has(o))return d.get(o);let s=await ee(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return d.set(o,s),s}async function pn({seedOverride:t=null}={}){g&&=(g.destroy(),null);let n=(t??o)>>>0,r=await Ve(e,{gridPerSide:s.cosmoGridPerSide,fftGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,amplitude:.44,seed:n});g=Ue(e,{gridPerSide:s.cosmoGridPerSide,pmGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,da:.0085,initialConditions:r}),S=null;for(let e=0;e<6;e+=1)_=await g.step({readTelemetry:e===0||e===5}),e===0&&_?.powerSpectrumPk?.kBins?.length&&(S={kBins:[..._.powerSpectrumPk.kBins],pkValues:[..._.powerSpectrumPk.pkValues]});let i=rn(n^5370206);C=Array.from({length:5},(e,t)=>{let n=Q[t%Q.length],r=an[Math.floor(i()*an.length)],a=1e3+Math.floor(i()*8900),o=t===0?18:72,s=(i()-.5)*2*o,c=(i()-.5)*1.4*o,l=(i()-.5)*2*o,u=Number((.6+i()*1.1).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${a} Supercluster`,subtitle:`${n===`disk`?`Grand-Design Spiral`:n===`binary`?`Interacting Merger Pair`:`Giant Elliptical`} · Z=${u} Z☉`,posMpc:[s,c,l],pos:[s*.1,c*.1,l*.1],radius:1,morphology:n,metallicity:u,massLabel:`${(1.2+i()*4.5).toFixed(2)}×10¹² M☉`,tempK:6500+Math.round(i()*4500),composition:`DM 84% · H 12% · He 3.8% · Met ${(.2*u).toFixed(2)}%`,nextLevel:1}})}async function mn({preset:t=ge,metallicity:n=_e,seedOverride:r=null}={}){ge=Q.includes(t)?t:`disk`,_e=Math.max(.1,Math.min(3,Number(n)||1)),E&&=(E.dispose(),null),k&&=(k.dispose(),null),ye||=await Xe(e);let i=(r??o)+825>>>0;E=$t({device:e,initialBodies:sn({count:s.galaxyStars,preset:ge,seed:i}),gridN:32,boxSize:48,secondSmbhIndex:ge===`binary`?s.galaxyStars>>1:0,smbhSoftening:.72,label:`ulg-universes-galaxy-pm-${s.galaxyStars}`}),(ge===`disk`||ge===`barred`||ge===`proto`||ge===`sphere`||ge===`globular`)&&await E.calibrateEquilibrium({gravity:1,softening:.35}),await E.step({dt:.008,substeps:2,gravity:1,softening:.35,readback:!1}),k=he(e,{gridN:24,boxSize:26,strideFloats:8,geometry:`galactic`,initialB0:de,alphaAmp:.035,etaRes:.16,bSat:.85,velScale:.22,label:`ulg-universes-galactic-dynamo`}),M=await k.step({particleBuffer:E.getResidentBuffer(),particleCount:E.count,dt:.04,substeps:8,readTelemetry:!0,readBField:!0}),le=k.buildStreamlines({worldScale:1,alpha:.3});let a=rn(i^141729),c=[4.8,.04,2.1];R=[...c],be=[{id:`star-solar`,level:1,branch:`solar-system`,name:`Orion Spur · Solar System`,subtitle:`G2V Main-Sequence Star · 8 Planets · 512 Asteroids (26 kly from Core)`,pos:c,radius:.8,tempK:5778,massLabel:`1.00 M☉`,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`,nextLevel:2},{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Sagittarius-ULG* (Galactic Core SMBH)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Zoom In for Schwarzschild Lensing`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2},{id:`star-h2`,level:1,branch:`solar-system`,name:`Carina-ULG OB Association`,subtitle:`Young Spiral-Arm H II Star-Forming Region`,pos:[-4.4,-.05,3.6],radius:.8,tempK:16500,massLabel:`18.2 M☉`,composition:`H 70% · He 28% · O III / Hα Emission`,nextLevel:2},{id:`star-outer`,level:1,branch:`solar-system`,name:`Perseus Arm K-Dwarf System`,subtitle:`Flat-Rotation-Curve Outer Disk System (38 kly)`,pos:[Math.cos(a()*6.28)*6.8,.08,Math.sin(a()*6.28)*6.8],radius:.75,tempK:4850,massLabel:`0.82 M☉`,composition:`H 74% · He 24.7% · Metals 1.3%`,nextLevel:2}]}async function $(){if(Ce)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=rn((o^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}Ce=nn({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),we=await Ce.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function hn({seedOverride:t=null}={}){B&&=(B.dispose(),null);let n=(t??o)+409>>>0;B=Ee(e,{asteroidCount:s.solarAsteroids,seed:n,label:`ulg-universes-solar-system`}),await B.step({dtSubYr:4e-5,substeps:4,readMassive:!0}),Te=B.computeConservationDiagnostics(),De=Te}async function gn({seedOverride:t=null}={}){je&&=(je.dispose(),null);let n=(t??o)+773>>>0,r=P(e,{pebbleCount:Math.min(4096,Math.max(1536,(s.solarAsteroids||512)*4)),embryoCount:18,enableGasDrag:Ne,seed:n,label:`ulg-universes-protoplanetary-disk`});Me=await r.step({dt:.018,substeps:3,readTelemetry:!0}),je=r}async function _n({initialB0:t=ct,seedOverride:n=null}={}){ct=Math.max(0,Math.min(1.5,Number(t)??.58));let r=at;at=null,r&&r.dispose();let i=(n??o)+3133>>>0,a=se(e,{gridN:s.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,s.stellarParticles||4096)),initialB0:ct,spinOmega:2.35,gravityG:2.4,seed:i,label:`ulg-universes-nebular-mhd`});ot=await a.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),st=a.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),at=a}async function vn(t=h){let n=w;w=null,n&&n.dispose();let r=t===`cmb`,i=t===`reionization`,a=t===`cluster-merger`,c=r?1100:i?10:.25,l=s.id===`low`?4096:s.id===`ultra`?10240:6656,u=I(e,{gridN:s.id===`low`?16:24,tracerCount:l,boxSizeMpc:260,redshiftZ:c,clusterMergerMode:a,uvFlux:i?1.55:r?0:.25,gravityG:a?1.65:1.15,seed:(o^(r?4352:i?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=i?5:a?4:2;for(let e=0;e<d;e+=1)T=await u.step({dt:i?.14:.09,substeps:2,readTelemetry:e===d-1});w=u}async function yn({spinA:t=Fe}={}){Fe=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=Pe;Pe=null,n&&n.dispose();let r=s.id===`low`?4096:6656,i=ie(e,{massSolar:45e7,spinA:Fe,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(o^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)H=await i.step({dt:.032,substeps:2,readTelemetry:e===4});Pe=i}async function bn(t=`bns-kilonova`){let n=Ie;Ie=null,n&&n.dispose(),Re=t;let r=s.id===`low`?3072:5120,i=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},a=re(e,{...i,particleCount:r,seed:(o^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<i.warm;e+=1)Le=await a.step({dt:.032,substeps:4,readTelemetry:e===i.warm-1});Ie=a}async function xn(t=`comet-tails`){let n=ze;ze=null,n&&n.dispose(),He=t;let r=t===`comet-tails`,i=L(e,{regime:r?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:r?1.45:2.35,radBeta:r?.95:.72,windSpeed:r?2.25:1.95,sublimationDrive:r?1.35:1.45,sourceDir:r?[.76,.24,.6]:[.82,.14,.55],particleCount:s.id===`low`?3072:5120,seed:(o^(r?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)Be=await i.step({dt:.04,substeps:3,readTelemetry:e===7});ze=i}async function Sn(t=`roche-rings`){let n=We;We=null,n&&n.dispose(),Ke=t;let r=ae(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:2.8,rHostSim:t===`red-giant`?1.85:t===`giant-impact`?1.48:1.38,rRocheSim:3.65,gmHost:24,cohesionStrength:.55,tidalHeatDrive:1.25,shepherdGm:.72,particleCount:s.id===`low`?3072:5120,seed:(o^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),i=t===`roche-rings`?12:6;for(let e=0;e<i;e+=1)Ge=await r.step({dt:.028,substeps:3,readTelemetry:e===i-1});We=r}async function Cn(t=`h2-pillars`){let n=lt;lt=null,n&&n.dispose(),ft=t;let r=L(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`planetary-nebula`?1.65:1.48,radBeta:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:1.45,sourceDir:[.65,.58,.48],particleCount:s.id===`low`?3584:5632,seed:(o^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)ut=await r.step({dt:.036,substeps:2,readTelemetry:e===5});lt=r}async function wn(t=`magnetar`){let n=q;q=null,n&&n.dispose(),gt=t;let r=t===`magnetar`,i=fe(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:s.id===`low`?3584:5632,seed:(o^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),a=r?8:4;for(let e=0;e<a;e+=1)ht=await i.step({dt:.055,substeps:3,readTelemetry:e===a-1});_t=i.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}),q=i}async function Tn(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,ye:.5});vt=await me(e,t)}async function En(){let t=Dt;Dt=null,t&&t.dispose();let n=ae(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:s.id===`low`?2560:4096,seed:(o^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)Ot=await n.step({dt:.032,substeps:3,readTelemetry:e===7});Dt=n}async function Dn({preset:t=et,seedOverride:n=null}={}){et=[`main-sequence-star`,`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`main-sequence-star`,qe&&=(qe.dispose(),null),Je&&=(Je.dispose(),null),G||=(await Lt({closureRegistry:c,device:e})).ref;let r=(n??o)+1939>>>0,i=Yt({count:s.stellarParticles,preset:et,seed:r}),a=et===`main-sequence-star`;qe=Gt({device:e,initialBodies:i,closureRegistry:c,closureRef:G,boxHalf:a?7.5:14,rCellFactor:a?.385:.075,softening:a?.45:.25,baseLogRho:a?-1.6:-16.2,refRhoSim:a?.095:.08,tScaleK:a?185e4:78e4,label:`ulg-universes-stellar-${et}`}),tt=await qe.step({dt:.015,timeAccel:it,readTelemetry:!0}),Je=he(e,{gridN:24,boxSize:16,strideFloats:16,geometry:`stellar`,initialB0:$e,alphaAmp:.22,etaRes:.055,bSat:.95,velScale:.35,label:`ulg-universes-stellar-dynamo`}),Ye=await Je.step({particleBuffer:qe.getResidentBuffer(),particleCount:qe.count,dt:.042,substeps:8,readTelemetry:!0,readBField:!0}),Ze=Je.buildStreamlines({worldScale:1,alpha:.42});let[l,u]=await Promise.all([pt(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),mt(e,[1.5,3],{dXi:.01,maxXi:12})]);W=l,rt=u}async function On({bodyIndex:t=bt}={}){let n=Math.max(1,Math.min(z.length-1,Math.trunc(Number(t)||3)));bt=n;let r=z[n],i=r.coreZ||26,a=r.mantleZ||14,c=r.surfZ||29,[l,u,d]=await Promise.all([fn(i,{relativistic:!0,returnOrbitalWavefunctions:!1}),fn(a,{relativistic:!0,returnOrbitalWavefunctions:!1}),fn(c,{relativistic:!0,returnOrbitalWavefunctions:!1})]),p=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(f.has(n))return f.get(n);let r=await U(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return f.set(n,r),r},[m,h]=await Promise.all([p(l),p(u)]),g=Math.max(5e9,Math.min(85e10,Number(r.centralP)||36e10));yt=await nt(e,{centralPressurePa:g,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${l.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:m},{name:`${u.bundle.symbol} Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:h}]});let _=.52,v=yt?.profile||[],y=Math.max(1,yt?.radiusM||r.radiusKm*1e3);for(let e=0;e<v.length;e+=1)if((v[e].layerIndex??0)>=1){_=Math.max(.22,Math.min(.78,v[e].radiusM/y));break}St=[{id:`layer-core`,level:4,name:`${r.name} · ${l.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(g/1e9).toFixed(0)} GPa · MoI = ${(yt?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:i,rCoreNorm:_,rMantleNorm:.94,tempK:5200,massLabel:`R = ${r.radiusKm.toLocaleString()} km`,composition:r.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${r.name} · ${u.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:a,rCoreNorm:_,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(yt?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${u.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${r.name} · ${d.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${d.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:c,rCoreNorm:_,rMantleNorm:.94,tempK:r.tempK||288,massLabel:`T_eq = ${r.tempK||288} K`,composition:`${d.bundle.symbol} (${d.bundle.mechanical.crystalStructure})`,nextLevel:5}],wt&&(wt.dispose(),wt=null,Tt=null);let b=Number(l.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,x=Math.max(.2,Number(r.aAu||(r.parent>0?z[r.parent]?.aAu:1)||1));if(Ct=F({...r,coreRadiusNorm:_,coreConductivitySm:b},{...yt,coreRadiusFraction:_,centralPressurePa:g},{solarDistanceAu:x,coreConductivitySm:b}),Ct.activation.anyActive){let t=N(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:Ct,enableTriboelectric:Et,seed:(o^n*2654435761)>>>0,label:`ulg-universes-atmo-${n}`});for(let e=0;e<4;e+=1)Tt=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});wt=t}}async function kn({Z:t=Z,tempK:n=null,phasePreset:r=null,gravity:a=Pt}={}){Z=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Pt=!!a,X&&=(X.destroy(),null);let o=await fn(Z,{relativistic:!0,returnOrbitalWavefunctions:!1}),c=o.visualData.bulk,u=o.visualData.thermo.potential,d=o.bundle,f=Math.max(20,Number(d.thermodynamic.meltingPointK||600)),p=Math.max(f*1.4+20,Number(d.thermodynamic.boilingPointK||f*2.4));r===`melt`?(Ft=`melt`,Nt=Math.round(f*1.42)):r===`vapor`?(Ft=`vapor`,Nt=Math.round(p*1.38)):r===`solid`?(Ft=`solid`,Nt=Math.max(20,Math.round(f*.25))):n!=null&&Number.isFinite(Number(n))?Nt=Math.max(15,Math.round(Number(n))):(Ft=`solid`,Nt=Math.max(20,Math.round(f*.25)));let m=Math.max(1,Number(d.nuclear.atomicMassU||28)),h=Math.min(2,Math.max(.45,.09*Math.sqrt(m))),g=s.mdCells;X=i(e,{...l({crystalStructure:c.crystalStructure,cellsVec:[g,g,g],latticeConstantA:Math.max(2.4,Number(c.latticeConstantA||3.6)),massU:m,temperatureK:Nt}),potentialModel:u.potentialModel,epsilonEv:u.epsilonEv,sigmaOrR0A:u.sigmaOrR0A,alphaOrLambda:u.alphaOrLambda,rcutA:u.rcutA,eamAEv:u.eamAEv,eamBeta:u.eamBeta,swGamma:u.swGamma,dtFs:h,targetTemperatureK:Nt,thermostatCouplingFs:20,meltingPointK:f,bulkModulusGPa:Math.max(1,Number(c.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(c.cohesiveEnergyEv||2)),crystalStructure:c.crystalStructure,gravityEnabled:Pt}),Mt=await X.stepBatch(4,{readTelemetry:!0,targetTemperatureK:Nt}),It=Mt?.rdf?Array.from(Mt.rdf):[]}async function An({Z:t=Rt,n=null,l:r=null,m:i=null,relativistic:a=Ht,mode:c=Ut,moleculeKey:l=Wt}={}){Rt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Ht=!!a,Ut=c===`molecule`?`molecule`:`atom`,Wt=on[l]?l:`H2O`;let d=ke.find(e=>e.Z===Rt);n==null?d&&(zt=d.defaultN):zt=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?d&&(Bt=Math.min(zt-1,d.defaultL)):Bt=Math.max(0,Math.min(zt-1,Math.trunc(Number(r)))),Vt=i==null?0:Math.max(-Bt,Math.min(Bt,Math.trunc(Number(i))));let f=await fn(Rt,{relativistic:Ht,returnOrbitalWavefunctions:!0});if(Ut===`molecule`){let t=on[Wt];qt=await u(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}Kt=D(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,s.orbitalPoints),seed:(o^1779033703)>>>0,reuseBuffer:Kt?.pointsBuffer||null})}else{let t=f.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===zt&&e.l===Bt&&e.u?.length);Kt=O(e,{Z:Rt,n:zt,l:Bt,m:Vt,pointCount:s.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:Ht,colorMode:1,seed:(o^Rt*2654435761)>>>0,reuseBuffer:Kt?.pointsBuffer||null})}}async function jn({Z:t=Jt,A:r=null}={}){Jt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let i=ke.find(e=>e.Z===Jt);Xt=r==null?i?.A||Math.round(Jt*2.15):Math.max(Jt,Math.trunc(Number(r))),Qt&&=(Qt.destroy(),null),Zt=await n(e,Jt,Xt,{volDim:s.nuclearVolDim}),Qt=A(e,Zt),en=Qt?await Qt.stepBatch(8):null}async function Mn(e,t,n=1){if(!(un||dn)){un=!0;try{if(e===0)h!==`web`&&w?T=await w.step({dt:(h===`reionization`?.12:.08)*Math.max(.2,Math.min(2.5,n)),substeps:1,readTelemetry:!0}):g&&g.getState().aScale<1.15&&(_=await g.step({readTelemetry:!0}));else if(e===1&&E){let e=.009*Math.max(.1,Math.min(3,n));if(await E.step({dt:e,substeps:2,gravity:1,softening:.35,readback:!1}),k){let e=E.stepIndex%4==0;M=await k.step({particleBuffer:E.getResidentBuffer(),particleCount:E.count,dt:.04*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:e,readBField:e}),e&&(le=k.buildStreamlines({worldScale:1,alpha:.3}))}}else if(e===2){if(xe===`smbh-core`&&Ce)we=await Ce.step({dt:.008*Math.max(.1,Math.min(3,n)),gravity:1,softening:.08,readback:!0});else if(V===`formation`&&je)Me=await je.step({dt:.016*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(V===`quasar-jet`&&Pe)H=await Pe.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((V===`xray-binary`||V===`bns-kilonova`||V===`type-ia`||V===`bbh-merger`)&&Ie)Le=await Ie.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:3,readTelemetry:!0});else if((V===`comet-tails`||V===`hot-jupiter`)&&ze)Be=await ze.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((V===`roche-rings`||V===`giant-impact`||V===`red-giant`)&&We)Ge=await We.step({dt:.024*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(B){let e=t<10.2,r=e?18e-6:55e-6,i=Math.max(2,Math.min(48,Math.round((e?8:24)*n)));await B.step({dtSubYr:r,substeps:i,readMassive:!0}),De=B.computeConservationDiagnostics()}}else if(e===3){if(K===`nebular-mhd`&&at){let e=at.stepIndex%4==0;ot=await at.step({dt:.022*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:e}),e&&(st=at.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}))}else if((K===`h2-pillars`||K===`planetary-nebula`||K===`snr-pwn`)&&lt)ut=await lt.step({dt:.032*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((K===`pulsar`||K===`magnetar`)&&q){let e=q.stepIndex%4==0;ht=await q.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0,readBField:e}),e&&(_t=q.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}))}else if(K!==`white-dwarf-tov`&&qe&&(tt=await qe.step({dt:.014*Math.max(.2,Math.min(2.5,n)),timeAccel:it,readTelemetry:!0}),Je)){let e=qe.stepIndex%4==0;Ye=await Je.step({particleBuffer:qe.getResidentBuffer(),particleCount:qe.count,dt:.038*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:e,readBField:e}),e&&(Ze=Je.buildStreamlines({worldScale:1,alpha:.42}))}}else if(e===4)if(kt&&Y)At=await Y.step({dt:.02*Math.max(.25,Math.min(2.5,n)),controls:jt,readTelemetry:Y.stepIndex%4==0});else{let e=J===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(J===`cryo-plumes`&&Dt&&(Ot=await Dt.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0})),B&&J!==`eyeball-locked`&&J!==`rogue`){await B.step({dtSubYr:12e-6,substeps:Math.max(1,Math.round(4*n)),readMassive:!0}),De=B.computeConservationDiagnostics();let t=B.getMassiveBodyState64(Oe),r=B.getMassiveBodyState64(0),i=r.posAu[0]-t.posAu[0],a=r.posAu[1]-t.posAu[1],o=r.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}wt&&(Tt=await wt.step({dtSim:.042*Math.max(.2,Math.min(2.5,n)),substeps:2,sunDir:e,readTelemetry:!0}))}else if(e===5&&X){let e=Math.max(1,Math.min(8,Math.round(3*n)));Mt=await X.stepBatch(e,{readTelemetry:!0,targetTemperatureK:Nt,nonBlocking:!0}),Mt?.rdf&&(It=Array.from(Mt.rdf))}else if(e===7&&Qt){let e=Math.max(2,Math.min(24,Math.round(10*n))),t=await Qt.stepBatch(e,{nonBlocking:!0});t&&(en=t)}}catch(e){let t=String(e?.message||e||``);if(!dn&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{un=!1}}}async function Nn(){if(!tn)return;let e=tn;tn=null;try{await e.stop()}catch{}ln={...ln,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Pn({relayUrl:e=ln.relayUrl,roomId:t=ln.roomId,role:n=ln.role}={}){await Nn();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return ln={...ln,connected:!1,relayUrl:``,roomId:i,role:a,error:null},ln;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),ln.remotePeers=t.size,ln.witnessedMessages=a,ln.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}tn={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};ln={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){ln={...ln,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return Fn()}function Fn(){let e=tn?.handle?.getStatus?.();return{...ln,connected:e?!!e.connected:ln.connected,remotePeers:e?e.remotePeerCount:ln.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:ln.remotePeerIds||[],quorumReady:e?!!e.quorumReady:ln.quorumReady,witnessedMessages:e?.witnessedMessages??ln.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??ln.lastWitnessedType??null}}async function In(e=Rt){let t=tn?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${ln.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return ln.dispatches+=1,ln.lastResult=r,r}let Ln=new Map;async function Rn(e,t={}){if(e===0&&g||e===1&&E||e===2&&(xe===`smbh-core`?Ce:B)||e===3&&qe||e===4&&yt||e===5&&X||e===6&&Kt||e===7&&Zt)return;let n=e===2?`2:${xe}`:String(e);if(Ln.has(n))return Ln.get(n);let r=(async()=>{e===0?await pn(t):e===1?await mn(t):e===2?xe===`smbh-core`?await $():await hn(t):e===3?await Dn(t):e===4?await On(t):e===5?await kn(t):e===6?await An(t):e===7&&await jn(t)})();Ln.set(n,r);try{await r}finally{Ln.delete(n)}}function zn(e){return Ae[e]?(s=Ae[e],!0):!1}function Bn(e){o=Number(e)>>>0||1}function Vn(e){Pt=!!e,X&&typeof X.setGravity==`function`&&X.setGravity(Pt)}function Hn(e){Nt=Math.max(15,Math.round(Number(e)||300))}function Un(e){xt=!!e}function Wn(e){it=Math.max(.4,Math.min(8,Number(e)||2))}async function Gn(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=te.find(t=>t.id===e)||te[3];p=t.id,m=pe({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(p=e.id||`custom`,m=pe(e));return t===0?m.eraId===`recombination`?await Kn(`cmb`):m.eraId===`cosmic-dawn`?await Kn(`reionization`):m.eraId===`far-future`?await Kn(`cluster-merger`):await Kn(`web`):t===1?m.eraId===`cosmic-dawn`||m.eraId===`quasar-peak`?await mn({preset:`proto`,metallicity:Math.max(.1,m.meanMetallicitySolar)}):m.eraId===`far-future`?await mn({preset:`sphere`,metallicity:1.4}):await mn({preset:`disk`,metallicity:1}):t===2?m.eraId===`quasar-peak`?await qn(`quasar-jet`):m.eraId===`cosmic-dawn`?await qn(`formation`):m.eraId===`far-future`?await qn(`red-giant`):await qn(`nbody`):t===3?m.eraId===`far-future`?await Xn(`planetary-nebula`):m.eraId===`cosmic-dawn`?await Xn(`h2-pillars`):m.eraId===`quasar-peak`?await Xn(`nebular-mhd`):await Xn(`fusion`):t===4&&(m.eraId===`quasar-peak`?await Zn(`magma-ocean`):await Zn(`standard`)),m}async function Kn(e){h=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,h===`web`?g||await pn():await vn(h)}async function qn(e){V=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,V===`formation`?je||await gn():V===`quasar-jet`?Pe||await yn():V===`xray-binary`||V===`bns-kilonova`||V===`type-ia`||V===`bbh-merger`?(!Ie||Re!==V)&&await bn(V):V===`comet-tails`||V===`hot-jupiter`?(!ze||He!==V)&&await xn(V):V===`roche-rings`||V===`giant-impact`||V===`red-giant`?(!We||Ke!==V)&&await Sn(V):B||await hn()}async function Jn(e){Fe=Math.max(-.99,Math.min(.99,Number(e)??.94)),Pe&&await yn({spinA:Fe})}function Yn(e){Ne=!!e,je?.setEnableGasDrag?.(Ne)}async function Xn(e){K=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`pulsar`,`magnetar`,`white-dwarf-tov`].includes(e)?e:`fusion`,K===`nebular-mhd`?at||await _n():K===`h2-pillars`||K===`planetary-nebula`||K===`snr-pwn`?(!lt||ft!==K)&&await Cn(K):K===`pulsar`||K===`magnetar`?(!q||gt!==K)&&await wn(K):K===`white-dwarf-tov`?vt||await Tn():qe||await Dn()}async function Zn(t){if(J=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,J===`cryo-plumes`)Dt||await En();else if(J===`eyeball-locked`||J===`rogue`){let t=wt;wt=null,t&&t.dispose();let n=z[bt]||z[3],r=F({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:J===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},yt||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:J===`rogue`?500:.14,coreConductivitySm:12e5});Ct=r;let i=N(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:r,enableTriboelectric:Et,seed:(o^(J===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${J}`});for(let e=0;e<4;e+=1)Tt=await i.step({dtSim:.048,substeps:2,sunDir:J===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});wt=i}else J===`standard`&&await On({bodyIndex:bt})}async function Qn(e){ct=Math.max(0,Math.min(1.5,Number(e)??.58)),at&&await _n({initialB0:ct})}function $n(e){Se=!!e}async function er(e){de=Math.max(0,Math.min(1.2,Number(e)||0)),k&&E&&(k.resetSeedB(de),M=await k.step({particleBuffer:E.getResidentBuffer(),particleCount:E.count,dt:.045,substeps:de>1e-6?8:1,readTelemetry:!0,readBField:!0}),le=k.buildStreamlines({worldScale:1,alpha:.44}))}async function tr(e){$e=Math.max(0,Math.min(1.2,Number(e)||0)),Je&&qe&&(Je.resetSeedB($e),Ye=await Je.step({particleBuffer:qe.getResidentBuffer(),particleCount:qe.count,dt:.042,substeps:$e>1e-6?8:1,readTelemetry:!0,readBField:!0}),Ze=Je.buildStreamlines({worldScale:1,alpha:.42}))}function nr(e){Array.isArray(e)&&e.length>=3&&C.length>0&&(C[0]={...C[0],posMpc:[Number(e[0])||0,Number(e[1])||0,Number(e[2])||0]})}function rr(e){Et=!!e,wt?.setEnableTriboelectric?.(Et)}async function ir({bodyIndex:t=bt,planetaryModeOverride:n=null}={}){let r=Math.max(1,Math.min(z.length-1,Math.trunc(Number(t)||bt||3)));Oe=r,n&&(J=n),(!yt||bt!==r)&&await On({bodyIndex:r});let i=z[r]||z[3],a=ce(e,{bodySpec:i,planetaryResult:yt,planetaryAtmoState:Ct,planetaryMode:J,gridN:s.id===`low`?81:129,cellSizeM:2.35,particleCount:s.id===`low`?1024:2048,seed:(o^r*7919+84212430)>>>0,label:`ulg-universes-surface-${i.id}`});jt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},At=await a.step({dt:.016,controls:jt,readTelemetry:!1}),At=await a.step({dt:.016,controls:jt,readTelemetry:!0});let c=Y;return Y=a,kt=!0,c&&c.dispose(),At}function ar(){kt=!1,jt={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0};let e=Y;Y=null,At=null,e&&e.dispose()}function or(e){return Y?Y.setActiveVehicle(e):null}function sr(e){return Y?Y.setCameraMode(e):null}function cr(e={}){jt={...jt,...e}}function lr(e,t){Y?.addLookDelta?.(e,t)}function ur(e,t){let n=10**t,r=z[Oe]||z[3],i=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(V),a=e===2&&[`roche-rings`,`giant-impact`,`red-giant`].includes(V),o=e===2&&[`comet-tails`,`hot-jupiter`].includes(V),s=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(K),c=e===3&&[`pulsar`,`magnetar`].includes(K);return oe({viewSpanM:n,redshiftZ:m.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&h!==`web`?.157:0,clusterMassSolar:e===0&&h===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?E?.count||32768:0,nebulaCloudMass:e===3&&K===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&K===`nebular-mhd`?ct:e===2&&V===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(K===`nebular-mhd`||s),starMassSolar:+(e===2&&V===`formation`),diskSolidMassEarth:e===2&&V===`formation`?45:0,gravitatingBodyCount:e===2||e===4?i?2:B?.totalCount||15:0,solidBodyCount:e===2&&(V===`formation`||a)?18:0,solidParticleCount:e===2&&V===`formation`?90:0,coreTempK:e===3&&K===`fusion`?tt?.coreTempK||15e6:0,bodyMassKg:e===4?r.massSolar*198847e25:e===3&&K===`fusion`?198847e25:0,bodyRadiusM:e===4?r.radiusKm*1e3:0,surfacePressurePa:e===4&&Ct?.surfacePressurePa||0,volatileMassFrac:e===4&&Ct?.volatileMassFrac||0,particulateMassFrac:e===4&&Ct?.particulateMassFrac||0,dynamo:e===4&&Ct?.dynamo||null,compactnessGMOverRc2:e===2&&(V===`quasar-jet`||i)||e===3&&(c||K===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&V===`quasar-jet`?45e7:i?10:0,accretionRateEddington:e===2&&(V===`quasar-jet`||V===`xray-binary`)?.55:0,kerrSpinA:e===2&&V===`quasar-jet`?Fe:0,surfaceBFieldTesla:c?K===`magnetar`?165e9:42e7:0,compactRadiusM:c?12e3:0,spinOmegaRadS:c?K===`magnetar`?45:740:0,maxPairwiseVOverC:i?.22:0,rocheOverflowPresent:e===2&&V===`xray-binary`,uvFluxNorm:o||s?1.5:0,xuvFluxWPerM2:e===2&&V===`hot-jupiter`?180:0,surfaceTempK:e===2&&V===`comet-tails`?260:0,sublimationTempK:e===2&&V===`comet-tails`?170:1e9,maxTidalStrain:a||e===4&&J===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&J===`magma-ocean`||e===2&&(V===`giant-impact`||V===`red-giant`)?2400:0,surfaceViewActive:kt})}function dr(e,t=null){xe=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(R=[...t])}function fr(e){if(typeof e==`string`){let t=z.findIndex(t=>t.id===e);t>=0&&(Oe=t)}else Number.isFinite(Number(e))&&(Oe=Math.max(0,Math.min(z.length-1,Math.trunc(Number(e)))));return Oe}function pr(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return d.get(`${n}:std:${+!!t}:1`)||d.get(`${n}:std:${+!!t}:0`)||d.get(`${n}:std:1:1`)||d.get(`${n}:std:1:0`)||null}function mr(e,t={}){if(e===0){if(h===`cmb`){let e=T;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(h===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((T?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(h===`cluster-merger`){let e=T;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return C.map(t=>({...t,pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return be.map(t=>({...t,pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(xe===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(V!==`nbody`&&V!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${Fe.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(H?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${Le?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((Ge?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`}},t=e[V]||e[`quasar-jet`];return[{id:`l2-${V}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(!B)return[];let e=B.getMassiveBodyState64(Oe),n=t.solarScaleAuToWorld??1;return z.map((t,r)=>{let i=B.getMassiveBodyState64(r),a=(i.posAu[0]-e.posAu[0])*n,o=(i.posAu[1]-e.posAu[1])*n,s=(i.posAu[2]-e.posAu[2])*n;return{id:t.id,level:2,bodyIndex:r,spec:t,name:t.name,subtitle:t.subtitle,pos:[a,o,s],radius:Math.max(1e-7,i.radiusAu*n),radiusKm:t.radiusKm,tempK:t.tempK,massLabel:r===0?`1.00 M☉`:`${(t.massSolar/30034896e-13).toFixed(t.massSolar>1e-5?1:3)} M⊕`,composition:t.composition,nextLevel:r===0?3:4}})}if(e===3){if(K!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${ct.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${ht?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[K]||e[`nebular-mhd`];return[{id:`l3-${K}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}return[{id:`stellar-fusion-core`,level:3,name:`Thermonuclear Fusion Core`,subtitle:`Gate 1 pp/CNO/3α Burn · Q_pp = ${dt().ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:tt?.coreTempK||15e6,massLabel:`${(qe?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((tt?.meanXH??.72)*100).toFixed(1)}% · He ${((tt?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((tt?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4}]}if(e===4){if(J!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[J];if(e)return[{id:`l4-${J}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:St[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return St}if(e===5){let e=pr(Z,!0)?.bundle;return[{id:`md-lattice-atom`,level:5,name:`${e?.symbol||`Fe`} Representative Lattice`,subtitle:`${e?.mechanical?.crystalStructure||`crystal`} · ${X?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:Z,tempK:Mt?.temperatureK||Nt,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:`Phase: ${Mt?.emergentPhase||Ft} · ⟨Z⟩ = ${(Mt?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=pr(Rt,Ht)?.bundle,t=e?.symbol||`Fe`,n=`${zt}${[`s`,`p`,`d`,`f`,`g`][Bt]||`d`} (m=${Vt})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:Ut===`molecule`?`${on[Wt].formula} Molecule (RHF)`:`${t} (Z=${Rt}) · ${n}`,subtitle:Ut===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(qt?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${Ht?`Relativistic ON`:`Non-Rel`}) · ${Kt?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:Rt,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${Rt} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=Zt?.isotope?.split(`-`)[0]||`Z=${Jt}`,t=Number(Zt?.bindingPerNucleonMeV??8.79),n=Number(Zt?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${Xt}${e} Atomic Nucleus`,subtitle:`Z=${Jt} protons, N=${Math.max(0,Xt-Jt)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${Jt} · Neutrons ${Math.max(0,Xt-Jt)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function hr(){dn=!0,Nn();try{g?.destroy()}catch{}try{w?.dispose()}catch{}try{E?.dispose()}catch{}try{k?.dispose()}catch{}try{Ce?.dispose()}catch{}try{B?.dispose()}catch{}try{je?.dispose()}catch{}try{Pe?.dispose()}catch{}try{Ie?.dispose()}catch{}try{ze?.dispose()}catch{}try{We?.dispose()}catch{}try{qe?.dispose()}catch{}try{Je?.dispose()}catch{}try{at?.dispose()}catch{}try{lt?.dispose()}catch{}try{q?.dispose()}catch{}try{wt?.dispose()}catch{}try{Dt?.dispose()}catch{}try{Y?.dispose()}catch{}try{X?.destroy()}catch{}try{Kt?.pointsBuffer?.destroy()}catch{}try{Qt?.destroy()}catch{}}return Object.freeze({AU_METERS:ve,REAL_SOLAR_SYSTEM_CATALOG:z,MOLECULE_SPECS:on,COSMIC_EPOCH_PRESETS:te,get seed(){return o},get quality(){return s},get cosmicEpochId(){return p},get cosmicEpoch(){return m},get cosmoMode(){return h},get cosmoSession(){return g},get cosmoTelemetry(){return _},get cosmoFirstPk(){return S},get cosmoTargets(){return C},get cosmoBaryonSession(){return w},get cosmoBaryonTelemetry(){return T},get galaxyEngine(){return E},get galacticDynamoSession(){return k},get galacticDynamoTelemetry(){return M},get galacticDynamoStreamlines(){return le},get galacticB0(){return de},get galaxyPreset(){return ge},get galaxyMetallicity(){return _e},get galaxyFocusPos(){return R},get galaxyBranch(){return xe},get showGalacticBField(){return Se},get smbhEngine(){return Ce},get smbhBodies(){return we},get ismCoolingAnchors(){return ye},get solarEngine(){return B},get solarMode(){return V},get protoplanetarySession(){return je},get protoplanetaryTelemetry(){return Me},get protoplanetaryGasDrag(){return Ne},get kerrJetSession(){return Pe},get kerrJetTelemetry(){return H},get kerrSpinA(){return Fe},get relBinarySession(){return Ie},get relBinaryTelemetry(){return Le},get relBinaryMode(){return Re},get radWindL2Session(){return ze},get radWindL2Telemetry(){return Be},get tidalRocheSession(){return We},get tidalRocheTelemetry(){return Ge},get solarConservation0(){return Te},get solarConservation(){return De},get focusedSolarBodyIndex(){return Oe},get stellarEngine(){return qe},get stellarDynamoSession(){return Je},get stellarDynamoTelemetry(){return Ye},get stellarDynamoStreamlines(){return Ze},get stellarB0(){return $e},get stellarMode(){return K},get nebulaMhdSession(){return at},get nebulaMhdTelemetry(){return ot},get nebulaMhdStreamlines(){return st},get nebulaB0(){return ct},get radWindL3Session(){return lt},get radWindL3Telemetry(){return ut},get magnetosphereSession(){return q},get magnetosphereTelemetry(){return ht},get magnetosphereFieldLines(){return _t},get tovCurve(){return vt},get stellarPreset(){return et},get stellarTelemetry(){return tt},get stellarNuclearNetwork(){return W},get stellarLaneEmden(){return rt},get stellarTimeAccel(){return it},get planetaryMode(){return J},get planetaryResult(){return yt},get planetaryBodyIndex(){return bt},get planetaryCutaway(){return xt},get planetaryAtmoState(){return Ct},get planetaryAtmoSession(){return wt},get planetaryAtmoTelemetry(){return Tt},get planetaryTriboelectric(){return Et},get cryoPlumeSession(){return Dt},get cryoPlumeTelemetry(){return Ot},get surfaceActive(){return kt},get surfaceSession(){return Y},get surfaceTelemetry(){return At},get surfaceControls(){return jt},get mdSession(){return X},get mdTelemetry(){return Mt},get mdElementZ(){return Z},get mdTempK(){return Nt},get mdGravity(){return Pt},get mdPhasePreset(){return Ft},get mdRdfHistory(){return It},get quantumZ(){return Rt},get quantumN(){return zt},get quantumL(){return Bt},get quantumM(){return Vt},get quantumRelativistic(){return Ht},get quantumMode(){return Ut},get quantumMoleculeKey(){return Wt},get orbitalCloud(){return Kt},get moleculeRhfResult(){return qt},get nuclearZ(){return Jt},get nuclearA(){return Xt},get nuclearResult(){return Zt},get tdseSession(){return Qt},get tdseTelemetry(){return en},evaluateIsmRadiativeCoolingErgCm3PerS:Qe,evaluateStellarEvolutionaryState:ne,buildQuantizedNucleonSpheres:cn,getElementBundle:fn,getCachedElementBundle:pr,ensureLevelInitialized:Rn,initCosmicWeb:pn,initCosmoBaryonRegime:vn,initGalaxy:mn,initSmbhCore:$,initSolarSystem:hn,initProtoplanetaryDisk:gn,initKerrQuasarJet:yn,initRelativisticBinary:bn,initRadiativeWindL2:xn,initTidalRocheL2:Sn,initNebularMhd:_n,initRadiativeWindL3:Cn,initCompactMagnetosphere:wn,initWhiteDwarfTovCurve:Tn,initStellarCore:Dn,initPlanetaryInterior:On,initCryoPlumesL4:En,initMolecularDynamics:kn,initQuantumAtom:An,initAtomicNucleus:jn,stepActiveRegimes:Mn,setCosmicEpoch:Gn,setCosmoMode:Kn,setQuality:zn,setSeed:Bn,setMdGravity:Vn,setMdTemp:Hn,setPlanetaryCutaway:Un,setPlanetaryTriboelectric:rr,setPlanetaryMode:Zn,enterSurfaceView:ir,exitSurfaceView:ar,setSurfaceVehicle:or,setSurfaceCameraMode:sr,setSurfaceControls:cr,addSurfaceLookDelta:lr,setStellarTimeAccel:Wn,setSolarMode:qn,setKerrSpinA:Jn,setProtoplanetaryGasDrag:Yn,setStellarMode:Xn,setNebulaB0:Qn,setGalacticB0:er,setStellarB0:tr,setCosmoFocusMpc:nr,setShowGalacticBField:$n,setGalaxyBranch:dr,setFocusedSolarBody:fr,getActiveUniversalLaws:ur,getTargetsForLevel:mr,connectPeerMesh:Pn,disconnectPeerMesh:Nn,getPeerMeshState:Fn,dispatchPeerDerivation:In,dispose:hr})}var dn=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),fn=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),pn=`
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
`,mn=`
${pn}

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
`,$=`
${pn}

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
`,hn=`
${pn}

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
`,gn=`
${pn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
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
    if (is_live < 0.5) {
      var culled11: VsOut;
      culled11.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled11.color = vec4<f32>(0.0);
      culled11.uv = vec2<f32>(0.0);
      return culled11;
    }
    var rp = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    // Apply exact same TinyPlanet spherical curvature drop around active vehicle focus (extra1.xz, curv_inv_2r = extra1.w)
    let dx_c = rp.x - cam.extra1.x;
    let dz_c = rp.z - cam.extra1.z;
    rp.y = rp.y - (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
    p_world = rp * world_scale;
    let role = raw_f32[o + 3u];
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
    } else {
      // Subtle drone rotor downwash dust ring & fine wind-blown atmospheric motes!
      col = base_rgb * 0.52;
      pt_size = pt_size_base * sz * (0.42 + 0.55 * life_f);
      alpha = alpha_gain * fade * 0.068;
    }
  }

  let world_corner = p_world
    + cam.cam_right.xyz * (uv.x * pt_size)
    + cam.cam_up.xyz * (uv.y * pt_size);
  let clip = cam.view_proj * vec4<f32>(world_corner, 1.0);

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-6.2 * r2);
  let halo = exp(-2.2 * r2) * 0.28;
  let w = core + halo;
  return vec4<f32>(in.color.rgb * w * in.color.a, in.color.a * w);
}
`,_n=`
${pn}

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
      // Crisp broken swirling baroclinic cloud bands (clear oceans & continents between cyclonic fronts!)
      let cloud_d = smoothstep(0.20, 0.76, av.x) * 0.86;
      // Vivid billowing rust-amber aeolian dust fronts
      let dust_d = smoothstep(0.14, 0.68, av.y) * 0.82;
      surf = mix(surf, vec3<f32>(0.88, 0.48, 0.22), dust_d * select(0.78, 0.20, has_ocean));
      surf = mix(surf, vec3<f32>(0.97, 0.98, 1.0), cloud_d * 0.88);
      water_spec = water_spec * (1.0 - max(cloud_d, dust_d));
      // Real Paschen dielectric-breakdown lightning bolts (electric cyan in moist clouds, violet-gold in CO2 dust!)
      let bolt = smoothstep(0.36, 1.15, av.z);
      let bolt_col = mix(vec3<f32>(0.82, 0.54, 1.0), vec3<f32>(0.62, 0.94, 1.0), select(0.20, 1.0, has_ocean));
      em_lightning = bolt_col * bolt * (2.0 + 1.8 * (1.0 - ndl));
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
`,vn=`
${pn}

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
`,yn=`
${pn}

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
`,bn=`
${pn}

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
`,xn=`
${pn}

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
`,Sn=`
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
`;function Cn(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let r=navigator.gpu.getPreferredCanvasFormat();function i(){let t=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],i=null;for(let e of t)try{n.configure(e);return}catch(e){i=e}if(i)throw i}i();let a=`rgba16float`,o=`depth24plus`,s=0,c=0,l=null,u=null,d=null,f=null,p=e.createBuffer({label:`uv-cam-base`,size:176,usage:dn.UNIFORM|dn.COPY_DST}),m=e.createBuffer({label:`uv-cam-cloud-a`,size:176,usage:dn.UNIFORM|dn.COPY_DST}),h=e.createBuffer({label:`uv-cam-cloud-b`,size:176,usage:dn.UNIFORM|dn.COPY_DST}),g=e.createBuffer({label:`uv-cam-aux`,size:176,usage:dn.UNIFORM|dn.COPY_DST}),_=e.createBuffer({label:`uv-post-uniform`,size:48,usage:dn.UNIFORM|dn.COPY_DST}),v=e.createSampler({magFilter:`linear`,minFilter:`linear`}),y=e.createBuffer({label:`uv-spheres`,size:320*64,usage:dn.STORAGE|dn.COPY_DST}),b=e.createBuffer({label:`uv-disks`,size:768,usage:dn.STORAGE|dn.COPY_DST}),x=24576,S=e.createBuffer({label:`uv-lines`,size:x*28,usage:dn.VERTEX|dn.COPY_DST}),C=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:dn.STORAGE|dn.COPY_DST}),w=1024*32*16,T=(t,n)=>e.createShaderModule({label:t,code:n}),E=T(`uv-backdrop`,mn),D=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_main`},fragment:{module:E,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),O=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),k=T(`uv-surface-sky`,$),A=e.createRenderPipeline({label:`uv-surface-sky-pipe`,layout:`auto`,vertex:{module:k,entryPoint:`vs_main`},fragment:{module:k,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),ee=e.createBindGroup({layout:A.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),j=T(`uv-surface-mesh`,hn),M=e.createRenderPipeline({label:`uv-surface-mesh-pipe`,layout:`auto`,vertex:{module:j,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:j,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),te=e.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),N=T(`uv-cloud`,gn),P=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:N,entryPoint:`vs_main`},fragment:{module:N,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),F=T(`uv-lit-sphere`,_n),I=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:F,entryPoint:`vs_main`},fragment:{module:F,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),ne=e.createBuffer({label:`uv-dummy-atmo-em`,size:64,usage:dn.STORAGE|dn.COPY_DST}),re=new WeakMap;function ie(t){let n=t||ne,r=re.get(n);return r||(r=e.createBindGroup({layout:I.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:n}}]}),re.set(n,r)),r}let L=T(`uv-md-sphere`,vn),ae=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:L,entryPoint:`vs_main`},fragment:{module:L,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),oe=T(`uv-disk`,yn),se=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:oe,entryPoint:`vs_main`},fragment:{module:oe,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),ce=e.createBindGroup({layout:se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:b}}]}),le=T(`uv-line`,bn),ue=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:le,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:le,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),de=e.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),fe=T(`uv-nuclear-vol`,xn),pe=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:fe,entryPoint:`vs_main`},fragment:{module:fe,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),me=e.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]}),he=T(`uv-post`,Sn),ge=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:he,entryPoint:`vs_main`},fragment:{module:he,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),_e=null,ve=new WeakMap,ye=new WeakMap,be=new WeakMap;function R(t,n){let r=n===0?ve:ye,i=n===0?m:h,a=r.get(t);return a||(a=e.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:t}}]}),r.set(t,a)),a}function z(t,n){let r=be.get(t);return r||(r=e.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),be.set(t,r)),r}function xe(t,n){let r=Math.max(2,Math.floor(t)),p=Math.max(2,Math.floor(n));l&&s===r&&c===p||(s=r,c=p,i(),l?.destroy(),d?.destroy(),l=e.createTexture({label:`uv-scene-color`,size:[s,c],format:a,usage:fn.RENDER_ATTACHMENT|fn.TEXTURE_BINDING}),u=l.createView(),d=e.createTexture({label:`uv-scene-depth`,size:[s,c],format:o,usage:fn.RENDER_ATTACHMENT}),f=d.createView(),_e=e.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:u},{binding:2,resource:v}]}))}function Se(t){!t||t.byteLength===0||(t.byteLength>w&&(C.destroy(),w=t.byteLength,C=e.createBuffer({label:`uv-nuclear-vol`,size:w,usage:dn.STORAGE|dn.COPY_DST}),me=e.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]})),e.queue.writeBuffer(C,0,t))}let Ce=new Float32Array(44),we=new Float32Array(12),B=new Float32Array(320*16),Te=new Float32Array(192),Ee=new Float32Array(x*7);function De(t,n,r,i,a){Ce.set(n.viewProj,0),Ce.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),Ce.set([n.right[0],n.right[1],n.right[2],n.aspect],20),Ce.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),Ce.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),Ce.set(r||[0,0,0,0],32),Ce.set(i||[0,0,0,0],36),Ce.set(a||[0,0,0,0],40),e.queue.writeBuffer(t,0,Ce)}function Oe({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:o=null,surfaceScene:l=null,lightDir:d=[.6,.75,.55],mdCloud:v=null,disks:C=null,lines:w=null,nuclearVol:T=null,post:E={}}){xe(t.width,t.height);let k=0;if(Array.isArray(a)&&a.length>0){k=Math.min(320,a.length);for(let e=0;e<k;e+=1){let t=a[e],n=e*16;B[n+0]=t.pos[0],B[n+1]=t.pos[1],B[n+2]=t.pos[2],B[n+3]=t.radius,B[n+4]=t.color0[0],B[n+5]=t.color0[1],B[n+6]=t.color0[2],B[n+7]=t.kind??1,B[n+8]=t.color1?.[0]??t.color0[0],B[n+9]=t.color1?.[1]??t.color0[1],B[n+10]=t.color1?.[2]??t.color0[2],B[n+11]=t.atm??.35,B[n+12]=t.rCore??.52,B[n+13]=t.rMantle??.94,B[n+14]=+!!t.cutaway,B[n+15]=t.seed??(e+1)*1.37}e.queue.writeBuffer(y,0,B.subarray(0,k*16))}let j=0;if(Array.isArray(C)&&C.length>0){j=Math.min(16,C.length);for(let e=0;e<j;e+=1){let t=C[e],n=e*12;Te[n+0]=t.center[0],Te[n+1]=t.center[1],Te[n+2]=t.center[2],Te[n+3]=t.rIn,Te[n+4]=t.normal[0],Te[n+5]=t.normal[1],Te[n+6]=t.normal[2],Te[n+7]=t.rOut,Te[n+8]=t.color?.[0]??.9,Te[n+9]=t.color?.[1]??.85,Te[n+10]=t.color?.[2]??.72,Te[n+11]=t.kind??0}e.queue.writeBuffer(b,0,Te.subarray(0,j*12))}let N=0;w&&w.length>=14&&(N=Math.min(x,Math.floor(w.length/7)),Ee.set(w.subarray(0,N*7),0),e.queue.writeBuffer(S,0,Ee.subarray(0,N*7)));let F=!!(o&&o.buffer&&o.width>0&&o.height>0);De(p,r,[r.level||0,0,0,0],[d[0],d[1],d[2],0],F?[o.width,o.height,o.sphereIndex??0,1]:[1,1,-1,0]);let ne=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,2);for(let e=0;e<ne.length;e+=1){let t=ne[e];De(e===0?m:h,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0])}if(l&&l.env){let e=l.env,t=l.lightDir||d;De(g,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],1/(2*(e.tinyPlanetCurvatureRadiusM||280))],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],+!!e.isMagmaOcean])}else v&&v.positionsBuffer&&v.velocitiesBuffer&&v.count>0?De(g,r,[v.halfBox[0],v.halfBox[1],v.halfBox[2],v.worldScale],[v.baseRgb[0],v.baseRgb[1],v.baseRgb[2],v.radius],[v.alphaFade??1,0,0,v.idealCoord||12]):T&&T.dim>0&&De(g,r,[T.dim,T.boxRadius||3.4,T.tdseTunneled||0,T.tdseCrestNorm||.72],[T.alphaMul??1,0,0,0],[0,0,0,0]);we[0]=s,we[1]=c,we[2]=E.bhUv?.[0]??.5,we[3]=E.bhUv?.[1]??.5,we[4]=E.bhStrength??0,we[5]=E.warpAmount??0,we[6]=E.flashAmount??0,we[7]=+!!E.crtEnabled,we[8]=E.pixelSize??3,we[9]=E.timeSec??0,we[10]=0,we[11]=0,e.queue.writeBuffer(_,0,we);let re=e.createCommandEncoder({label:`uv-frame-fused`});{let e=re.beginRenderPass({colorAttachments:[{view:u,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:f,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});l&&l.env?(e.setPipeline(A),e.setBindGroup(0,ee),e.draw(3,1,0,0),l.terrainVertBuf&&l.terrainIdxBuf&&l.indexCount>0&&(e.setPipeline(M),e.setBindGroup(0,te),e.setVertexBuffer(0,l.terrainVertBuf),e.setIndexBuffer(l.terrainIdxBuf,`uint32`),e.drawIndexed(l.indexCount,1,0,0,0)),l.vehicleVertBuf&&l.vehicleVertCount>0&&(e.setPipeline(M),e.setBindGroup(0,te),e.setVertexBuffer(0,l.vehicleVertBuf,0,l.vehicleVertCount*48),e.draw(l.vehicleVertCount,1,0,0))):(e.setPipeline(D),e.setBindGroup(0,O),e.draw(3,1,0,0)),N>0&&(e.setPipeline(ue),e.setBindGroup(0,de),e.setVertexBuffer(0,S,0,N*28),e.draw(N,1,0,0)),k>0&&(e.setPipeline(I),e.setBindGroup(0,ie(F?o.buffer:null)),e.draw(6,k,0,0)),v&&v.positionsBuffer&&v.velocitiesBuffer&&v.count>0&&(e.setPipeline(ae),e.setBindGroup(0,z(v.positionsBuffer,v.velocitiesBuffer)),e.draw(6,v.count,0,0)),j>0&&(e.setPipeline(se),e.setBindGroup(0,ce),e.draw(6,j,0,0));for(let t=0;t<ne.length;t+=1){let n=ne[t];e.setPipeline(P),e.setBindGroup(0,R(n.buffer,t)),e.draw(6,n.count,0,0)}T&&T.dim>0&&(e.setPipeline(pe),e.setBindGroup(0,me),e.draw(3,1,0,0)),e.end()}{let e=n.getCurrentTexture().createView(),t=re.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(ge),t.setBindGroup(0,_e),t.draw(3,1,0,0),t.end()}e.queue.submit([re.finish()])}function V(){l?.destroy(),d?.destroy();for(let e of[p,m,h,g,_,y,ne,b,S,C])try{e.destroy()}catch{}}return Object.freeze({renderFrame:Oe,uploadNuclearVolume:Se,dispose:V})}function wn(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function Tn(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function En(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Dn(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function On(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.25,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=n*r*a,o}function kn(e,t,n){let r=Dn(wn(t,e)),i=Dn(Tn(r,n)),a=Tn(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-En(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-En(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=En(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function An(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function jn(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function Mn(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function Nn(e){return Math.max(0,Math.min(1,e))}function Pn(e,t,n){let r=Nn((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function Fn(e,t,n,r,i){return e<=t||e>=i?0:e<n?Pn(t,n,e):e>r?1-Pn(r,i,e):1}function In(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function Ln(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.massiveCount,s=Array.from({length:o},(t,n)=>e.getMassiveBodyState64(n));for(let e=1;e<o;e+=1){let o=z[e],c=o.parent>=0?o.parent:0,l=c>0;if(l&&r>10.6||!l&&r<8.4)continue;let u=s[c],d=s[e],f=d.posAu[0]-u.posAu[0],p=d.posAu[1]-u.posAu[1],m=d.posAu[2]-u.posAu[2],h=d.velAuPerYr[0]-u.velAuPerYr[0],g=d.velAuPerYr[1]-u.velAuPerYr[1],_=d.velAuPerYr[2]-u.velAuPerYr[2],v=Math.hypot(f,p,m),y=h*h+g*g+_*_,b=be*(u.massSolar+d.massSolar);if(!(v>1e-8&&b>1e-12))continue;let x=.5*y-b/v;if(x>=-1e-6)continue;let S=-b/(2*x),C=Tn([f,p,m],[h,g,_]),w=Math.hypot(C[0],C[1],C[2]);if(!(w>1e-10))continue;let T=[C[0]/w,C[1]/w,C[2]/w],E=Tn([h,g,_],C),D=[E[0]/b-f/v,E[1]/b-p/v,E[2]/b-m/v],O=Math.min(.985,Math.hypot(D[0],D[1],D[2])),k=O>1e-5?[D[0]/O,D[1]/O,D[2]/O]:Dn([f,p,m]),A=Tn(T,k),ee=S*Math.sqrt(Math.max(.01,1-O*O)),j=u.posAu[0]-t[0],M=u.posAu[1]-t[1],te=u.posAu[2]-t[2],N=o.color0||[.38,.72,1],P=(l?.34:o.id===`halley`?.16:.28)*i,F=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=S*(Math.cos(t)-O),i=ee*Math.sin(t),o=[(j+r*k[0]+i*A[0])*n,(M+r*k[1]+i*A[1])*n,(te+r*k[2]+i*A[2])*n];F&&(a.push(...F,N[0],N[1],N[2],P),a.push(...o,N[0],N[1],N[2],P)),F=o}}return a}function Rn(e,{focusedSolarBodyIndex:t=3,galaxyBranch:n=`solar-system`}={}){return e>=22.3?0:e>=16.2?1:e>=8.75?n!==`smbh-core`&&t===0&&e<=9.8?3:2:e>=-5.6?t===0&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function zn(e){let t=Math.max(2e5,(Number(e?.radiusKm)||6371)*1e3),n=e?.ringed?5.2:3.65;return Math.min(8.68,Math.max(6.2,Math.log10(t*n)))}function Bn(e){return Math.max(Oe,Math.min(De,Number(e)))}async function Vn(){if(!navigator.gpu)throw Error(`navigator.gpu is unavailable in this browser.`);let e=null;for(let t=0;t<6&&!e;t+=1)e=await navigator.gpu.requestAdapter({powerPreference:`high-performance`}),e||await new Promise(e=>setTimeout(e,250));if(!e)throw Error(`No WebGPU adapter available on this device.`);let t=await e.requestDevice(),n=[];t.addEventListener(`uncapturederror`,e=>{n.push(String(e?.error?.message??e))}),S(t,`ulg-universes-demo`);let r=new URLSearchParams(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(r.get(`Z`)||r.get(`z`)||`26`,10)||26)),a=Number.parseInt(r.get(`seed`)||`20261125`,10)||20261125,o=Ae[r.get(`quality`)]?r.get(`quality`):`med`,s=V[0].log10SpanM;r.has(`scale`)?s=Bn(Number.parseFloat(r.get(`scale`))||24.8):r.has(`level`)&&(s=V[Math.max(0,Math.min(7,Number.parseInt(r.get(`level`),10)||0))].log10SpanM);let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-epoch-rail`),p=document.getElementById(`uv-zoom-slider`),m=document.getElementById(`uv-zoom-readout`),h=document.getElementById(`uv-status-dot`),g=document.getElementById(`uv-scale-badge`),_=document.getElementById(`uv-fps-badge`),v=document.getElementById(`uv-autopilot-btn`),y=document.getElementById(`uv-sim-btn`),b=document.getElementById(`uv-config-btn`),x=document.getElementById(`uv-help-btn`),C=document.getElementById(`uv-sim-drawer`),w=document.getElementById(`uv-config-drawer`),T=document.getElementById(`uv-help-drawer`),E=document.getElementById(`uv-pause-btn`),D=document.getElementById(`uv-orbit-up-btn`),O=document.getElementById(`uv-timescale-slider`),k=document.getElementById(`uv-timescale-val`),A=document.getElementById(`uv-bigbang-btn`),ee=document.getElementById(`uv-reseed-btn`),j=document.getElementById(`uv-scale-controls`),M=document.getElementById(`uv-quality-group`),te=document.getElementById(`uv-lensing-toggle`),N=document.getElementById(`uv-orbits-toggle`),P=document.getElementById(`uv-travel-toggle`),F=document.getElementById(`uv-autospin-toggle`),I=document.getElementById(`uv-crt-toggle`),ne=document.getElementById(`uv-pixel-slider`),re=document.getElementById(`uv-pixel-val`),ie=document.getElementById(`uv-peer-url`),L=document.getElementById(`uv-peer-role`),ae=document.getElementById(`uv-peer-connect-btn`),oe=document.getElementById(`uv-peer-status`),se=document.getElementById(`uv-inspector`),ce=document.getElementById(`uv-collapse-btn`),ue=document.getElementById(`uv-info-quick-btn`),fe=document.getElementById(`uv-target-kicker`),pe=document.getElementById(`uv-target-name`),me=document.getElementById(`uv-target-sub`),he=document.getElementById(`uv-spec-title`),ge=document.getElementById(`uv-comp-text`),_e=document.getElementById(`uv-spectrograph-canvas`),ye=document.getElementById(`uv-stats-grid`),be=document.getElementById(`uv-plot-title`),R=document.getElementById(`uv-plot-meta`),xe=document.getElementById(`uv-plot-canvas`),Se=document.getElementById(`uv-dive-btn`),Ce=document.getElementById(`uv-focus-mote-btn`),we=document.getElementById(`uv-surface-quick-btn`),B=document.getElementById(`uv-return-btn`),Te=document.getElementById(`uv-engine-tag`),Ee=document.getElementById(`uv-breadcrumb`),Pe=document.getElementById(`uv-hint-pill`),H=document.getElementById(`uv-surface-hud`),Fe=document.getElementById(`uv-surf-telemetry`),Ie=document.getElementById(`uv-surf-jump-btn`),Le=document.getElementById(`uv-surf-vehicle-btn`),Re=document.getElementById(`uv-surf-cam-btn`),ze=document.getElementById(`uv-surf-orbit-btn`),Be=document.getElementById(`uv-touch-pads`),Ve=document.getElementById(`uv-joy-move`),He=document.getElementById(`uv-joy-move-knob`),Ue=document.getElementById(`uv-joy-look`),We=document.getElementById(`uv-joy-look-knob`),Ge=document.getElementById(`uv-warp-overlay`),Ke=document.getElementById(`uv-help-scale-tag`),qe=document.getElementById(`uv-about-scale-btn`),Je=document.getElementById(`uv-about-ulg-btn`),Ye=document.getElementById(`uv-modal-backdrop`),Xe=document.getElementById(`uv-modal-title`),Ze=document.getElementById(`uv-modal-sub`),Qe=document.getElementById(`uv-modal-content`),$e=document.getElementById(`uv-modal-close`),et=Cn(t,c),tt=le(t),U=un(t,{seed:a,qualityId:o,initialElementZ:i}),W=Rn(s,{focusedSolarBodyIndex:U.focusedSolarBodyIndex,galaxyBranch:U.galaxyBranch}),nt=null,rt=null,G=null,it=!1,K=[0,0,0],at=[],ot=0,st=!0,ct=1,lt=!0,ut=!0,dt=r.get(`cameraAutoSpin`)===`1`,ft=r.get(`crt`)===`1`,pt=3,q=r.get(`autopilot`)===`1`,mt=0,ht=!1,gt=0,_t=null,vt=0,J={yaw:.56,pitch:.42,dist:18},yt=new Float32Array(16),bt=window.innerWidth,xt=window.innerHeight,St={},Ct=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(F&&(F.checked=dt),I&&(I.checked=ft),v&&q&&(v.classList.add(`active`),v.textContent=`⏹ Stop Tour`),M)for(let e of M.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=V.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);Number.isFinite(t)&&(U.surfaceActive&&Rt(),q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),t===3?U.setFocusedSolarBody(0):t===4&&U.focusedSolarBodyIndex===0&&U.setFocusedSolarBody(3),jt(V[t].log10SpanM))})}function wt(){if(f)for(let e of f.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===U.cosmicEpochId)}if(f){f.innerHTML=U.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===U.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of f.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await U.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:W}),wt(),Z(),X(),Q(),$(performance.now())})}p?.addEventListener(`input`,e=>{U.surfaceActive&&Rt(),q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),_t=null,s=Math.max(Oe,Math.min(De,Number(e.target.value))),Y(s)});function Tt(){let e=Math.min(window.devicePixelRatio||1,2);bt=Math.max(320,window.innerWidth),xt=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(bt*e)),n=Math.max(2,Math.floor(xt*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==bt||l.height!==xt)&&(l.width=bt,l.height=xt)}Tt(),window.addEventListener(`resize`,Tt);let Et=[{el:C,btn:y},{el:w,btn:b},{el:T,btn:x}];function Dt(e){for(let t of Et){let n=t.el===e&&!t.el?.classList.contains(`open`);t.el?.classList.toggle(`open`,n),t.btn?.classList.toggle(`active`,n)}}function Ot(){for(let e of Et)e.el?.classList.remove(`open`),e.btn?.classList.remove(`active`)}y?.addEventListener(`click`,()=>Dt(C)),b?.addEventListener(`click`,()=>Dt(w)),x?.addEventListener(`click`,()=>Dt(T));for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>Ot());function kt(e,t,n){Ot(),Xe&&(Xe.textContent=e),Ze&&(Ze.textContent=t),Qe&&(Qe.innerHTML=n),Ye?.classList.add(`open`)}$e?.addEventListener(`click`,()=>Ye?.classList.remove(`open`)),Ye?.addEventListener(`click`,e=>{e.target===Ye&&Ye.classList.remove(`open`)}),qe?.addEventListener(`click`,()=>{let e=V[W];kt(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ne(e))}),ue?.addEventListener(`click`,()=>{let e=V[W];kt(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ne(e))}),Je?.addEventListener(`click`,()=>{kt(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,Me())}),ce?.addEventListener(`click`,()=>{let e=se?.classList.toggle(`collapsed`);ce&&(ce.textContent=e?`+`:`−`)});async function Y(e){let t=Rn(e,{focusedSolarBodyIndex:U.focusedSolarBodyIndex,galaxyBranch:U.galaxyBranch}),n=new Set([t]);e>=20.5&&n.add(0),e>=14.8&&e<=23.5&&n.add(1),e>=6.5&&e<=18.2&&n.add(2),e>=6.8&&e<=10.8&&U.focusedSolarBodyIndex===0&&n.add(3),e>=-6.2&&e<=9.2&&U.focusedSolarBodyIndex>0&&n.add(4),e>=-10&&e<=-4.5&&n.add(5),e>=-13.5&&e<=-8.4&&n.add(6),e<=-11.5&&n.add(7);let r=U.nuclearResult;for(let e of n)await U.ensureLevelInitialized(e);U.nuclearResult&&U.nuclearResult!==r&&U.nuclearResult.volumeData&&et.uploadNuclearVolume(U.nuclearResult.volumeData)}function At(e=U.focusedSolarBodyIndex){if(!U.solarEngine||e<=0)return;let t=U.solarEngine.getMassiveBodyState64(e),n=U.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];J.yaw=Math.atan2(r,i)-.92,J.pitch=.24}function jt(e){_t=Math.max(Oe,Math.min(De,Number(e))),Y(_t)}function X(){if(j)if(W===0)j.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${U.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${U.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${U.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${U.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${U.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:U.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:U.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${U.quality.cosmoGridPerSide}³</code> particles on a <code>${U.quality.cosmoFftN}³</code> periodic FFT mesh.`}</div>`,j.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await U.setCosmoMode(e.target.value),Z(),X(),Q(),$(performance.now())});else if(W===1)j.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${U.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${U.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="binary" ${U.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${U.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${U.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${U.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${U.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${U.galaxyBranch===`solar-system`?`selected`:``}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${U.galaxyBranch===`smbh-core`?`selected`:``}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${U.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${U.galaxyMetallicity.toFixed(1)}</span>
        </div>
        <div class="uv-row" title="Seed field B₀ for the live GPU 24³ 3D α–ω galactic dynamo (0 = strictly zero B-field!)">
          <span>Dynamo B₀</span>
          <input id="uv-gal-b0-slider" type="range" min="0.0" max="0.8" step="0.05" value="${U.galacticB0.toFixed(2)}" />
          <span id="uv-gal-b0-val" style="font-family:var(--mono);font-size:11px;">${U.galacticB0.toFixed(2)}</span>
        </div>`,j.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await U.initGalaxy({preset:e.target.value}),G=null,it=!1,Z(),X(),$(performance.now())}),j.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;U.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),Y(s)}),j.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=j.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await U.initGalaxy({preset:U.galaxyPreset,metallicity:t})}),j.querySelector(`#uv-gal-b0-slider`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=j.querySelector(`#uv-gal-b0-val`);n&&(n.textContent=t.toFixed(2)),await U.setGalacticB0(t),Q(),$(performance.now())});else if(W===2)U.galaxyBranch===`smbh-core`?(j.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,j.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{U.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await U.ensureLevelInitialized(2),X()})):(j.innerHTML=`
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${U.solarMode===`nbody`?`selected`:``}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${U.solarMode===`formation`?`selected`:``}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${U.solarMode===`roche-rings`?`selected`:``}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${U.solarMode===`giant-impact`?`selected`:``}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${U.solarMode===`comet-tails`?`selected`:``}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${U.solarMode===`hot-jupiter`?`selected`:``}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${U.solarMode===`red-giant`?`selected`:``}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${U.solarMode===`quasar-jet`?`selected`:``}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="xray-binary" ${U.solarMode===`xray-binary`?`selected`:``}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${U.solarMode===`bns-kilonova`?`selected`:``}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${U.solarMode===`type-ia`?`selected`:``}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${U.solarMode===`bbh-merger`?`selected`:``}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${U.solarMode===`formation`?`
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${U.protoplanetaryGasDrag?`checked`:``} />
            </label>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(U.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          `:U.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${U.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${U.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:U.solarMode===`nbody`?`
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${z.map((e,t)=>`<option value="${t}" ${t===U.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">100% WebGPU f32x2 double-float symplectic N-body at exact astronomical radii (Earth = 0.00916 R☉).</div>
          `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,j.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await U.setSolarMode(e.target.value),Z(),X(),Q(),$(performance.now())}),j.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{U.setProtoplanetaryGasDrag(e.target.checked)}),j.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=j.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await U.setKerrSpinA(t),Q(),$(performance.now())}),j.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);U.setFocusedSolarBody(t),nt=z[t].id,t>0&&await U.initPlanetaryInterior({bodyIndex:t})}));else if(W===3){j.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${U.stellarMode===`fusion`?`selected`:``}>Thermonuclear Fusion Core (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${U.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${U.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars ([O III]/Hα/[S II])</option>
            <option value="planetary-nebula" ${U.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${U.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN</option>
            <option value="pulsar" ${U.stellarMode===`pulsar`?`selected`:``}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${U.stellarMode===`magnetar`?`selected`:``}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${U.stellarMode===`white-dwarf-tov`?`selected`:``}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${U.stellarMode===`nebular-mhd`?`
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${U.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${U.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        `:U.stellarMode===`fusion`?`
          <div class="uv-seg-group">
            <button class="uv-seg-btn ${U.stellarPreset===`main-sequence-star`?`active`:``}" data-st-preset="main-sequence-star" type="button">Active Star</button>
            <button class="uv-seg-btn ${U.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${U.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${U.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${U.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${U.stellarTimeAccel.toFixed(1)}×</span>
          </div>
          <div class="uv-row" title="Seed B₀ for the live GPU 24³ 3D stellar convective dynamo (0 = zero coronal B-field!)">
            <span>Dynamo B₀</span>
            <input id="uv-st-b0" type="range" min="0.0" max="0.9" step="0.05" value="${U.stellarB0.toFixed(2)}" />
            <span id="uv-st-b0-val" style="font-family:var(--mono);font-size:11px;">${U.stellarB0.toFixed(2)}</span>
          </div>
        `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,j.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await U.setStellarMode(e.target.value),G=null,it=!1,Z(),X(),Q(),$(performance.now())}),j.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=j.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await U.setNebulaB0(t)});for(let e of j.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await U.initStellarCore({preset:e.dataset.stPreset}),G=null,it=!1,X(),Q(),$(performance.now())});j.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{U.setStellarTimeAccel(Number(e.target.value));let t=j.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${U.stellarTimeAccel.toFixed(1)}×`)}),j.querySelector(`#uv-st-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=j.querySelector(`#uv-st-b0-val`);n&&(n.textContent=t.toFixed(2)),await U.setStellarB0(t),Q(),$(performance.now())})}else if(W===4){let e=U.planetaryAtmoState?.activation;j.innerHTML=`
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${U.planetaryMode===`standard`?`selected`:``}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${U.planetaryMode===`magma-ocean`?`selected`:``}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${U.planetaryMode===`cryo-plumes`?`selected`:``}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${U.planetaryMode===`eyeball-locked`?`selected`:``}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${U.planetaryMode===`rogue`?`selected`:``}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${z.slice(1).map((e,t)=>`<option value="${t+1}" ${t+1===U.planetaryBodyIndex?`selected`:``}>${e.name} (${e.radiusKm.toLocaleString()} km)</option>`).join(``)}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${U.planetaryTriboelectric?`checked`:``} ${e?.triboelectricActive?``:`disabled`} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${U.planetaryCutaway?`checked`:``} />
        </label>
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${U.surfaceActive?`🚀 Launch Back to Orbit (Esc)`:`🚙 Land on Surface (Rover + Drone)`}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${U.surfaceActive?`planetary-surface-vehicles · `:``}${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,j.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await U.setPlanetaryMode(e.target.value),U.surfaceActive?await Lt({bodyIndex:U.planetaryBodyIndex}):(Z(),X(),Q(),$(performance.now()))}),j.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);U.setFocusedSolarBody(t),await U.initPlanetaryInterior({bodyIndex:t}),U.surfaceActive?await Lt({bodyIndex:t}):(s=zn(z[t]),At(t),Z(),Nt())}),j.querySelector(`#uv-land-surface-btn`)?.addEventListener(`click`,async()=>{U.surfaceActive?Rt():await Lt({bodyIndex:U.planetaryBodyIndex})}),j.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{U.setPlanetaryTriboelectric(e.target.checked)}),j.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{U.setPlanetaryCutaway(e.target.checked)})}else if(W===5){j.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${ke.map(e=>`<option value="${e.Z}" ${e.Z===U.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${U.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${U.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${U.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,U.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${U.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${U.mdGravity?`checked`:``} />
        </label>`,j.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await U.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),Z(),X()});for(let e of j.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await U.initMolecularDynamics({Z:U.mdElementZ,phasePreset:e.dataset.mdPhase}),X()});j.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{U.setMdTemp(Number(e.target.value));let t=j.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${U.mdTempK} K`)}),j.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{U.setMdGravity(e.target.checked)})}else if(W===6){j.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${U.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${U.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${U.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${ke.map(e=>`<option value="${e.Z}" ${e.Z===U.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===U.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<U.quantumN).map(e=>`<option value="${e}" ${e===U.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${U.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(U.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${U.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${U.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of j.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await U.initQuantumAtom({mode:e.dataset.qmMode}),Z(),X()});j.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await U.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),Z(),X()}),j.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await U.initQuantumAtom({n:t,l:Math.min(U.quantumL,t-1),m:0}),X()}),j.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await U.initQuantumAtom({l:Number(e.target.value),m:0}),X()}),j.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await U.initQuantumAtom({relativistic:e.target.checked}),Z()});for(let e of j.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await U.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),Z(),X()})}else W===7&&(j.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${ke.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===U.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,j.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await U.initAtomicNucleus({Z:Number(t),A:Number(n)}),U.nuclearResult?.volumeData&&et.uploadNuclearVolume(U.nuclearResult.volumeData),Z()}),j.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{U.tdseSession?.resetWavepacket?.()}))}function Mt(){let e=U.getTargetsForLevel(W,St);return e.find(e=>e.id===nt)||e[0]||null}function Z(){let e=U.getTargetsForLevel(W,St);nt=W===2&&U.galaxyBranch!==`smbh-core`?z[U.focusedSolarBodyIndex]?.id||`earth`:e[0]?.id||null}function Nt(){let e=V[W];if(g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=je(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),Ke&&(Ke.textContent=`L${e.level}`),Te&&(Te.textContent=e.engineSchema),be&&(be.textContent=e.plotTitle),Se&&(Se.textContent=e.diveButton),we&&(we.style.display=W===4&&!U.surfaceActive?`inline-flex`:`none`),B&&(B.disabled=W===0&&!U.surfaceActive),D&&(D.disabled=W===0&&!U.surfaceActive),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===W);if(Ee){Ct[2]=U.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:`Solar System`,Ct[4]=z[U.planetaryBodyIndex]?.name||`Earth`;let e=Ct.slice(0,W+1);Ee.innerHTML=e.map((t,n)=>n===e.length-1?`<strong>${t}</strong>`:t).join(` › `)}X()}async function Pt(){let e=Mt();W===1&&e?.branch&&U.setGalaxyBranch(e.branch,e.pos),W===2&&e?.bodyIndex!=null&&(U.setFocusedSolarBody(e.bodyIndex),e.bodyIndex>0&&await U.initPlanetaryInterior({bodyIndex:e.bodyIndex})),W===4&&e?.sampleZ&&await U.initMolecularDynamics({Z:e.sampleZ,phasePreset:`solid`}),W===5&&e?.sampleZ&&await U.initQuantumAtom({Z:e.sampleZ,mode:`atom`}),W===6&&e?.sampleZ&&(await U.initAtomicNucleus({Z:e.sampleZ}),U.nuclearResult?.volumeData&&et.uploadNuclearVolume(U.nuclearResult.volumeData));let t=e?.nextLevel==null?(W+1)%8:e.nextLevel;t===4&&U.focusedSolarBodyIndex===0&&U.setFocusedSolarBody(3),jt(V[t].log10SpanM)}async function Ft(){if(U.surfaceActive){Rt();return}W<=0||jt(V[W-1].log10SpanM)}function It(){let e=!!(U.surfaceActive&&U.surfaceSession);if(H?.classList.toggle(`active`,e),Be?.classList.toggle(`active`,e),we&&(we.style.display=W===4&&!e?`inline-flex`:`none`),Pe&&(Pe.style.display=e?`none`:``),!e)return;let t=U.surfaceSession,n=U.surfaceTelemetry||t.getTelemetry(),r=t.env,i=t.activeVehicle===`drone`,a=z[U.planetaryBodyIndex]||z[3],o=U.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:U.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:a.name,s=r.rhoAtmKgM3>1e-4?`ρ=${r.rhoAtmKgM3.toFixed(r.rhoAtmKgM3<.1?3:2)} kg/m³`:`<span class="warn">VACUUM (0 Pa)</span>`,c=i?r.droneFlightCapable?`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · Spd ${(n.droneSpeedMS||0).toFixed(1)} m/s · <span class="good">Lift ${(n.droneAeroLiftN||0).toFixed(1)}/${r.maxAeroLiftN.toFixed(1)} N</span>`:`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`:`Alt ${(n.roverAltitudeM||0).toFixed(1)} m · Spd ${(n.roverSpeedMS||0).toFixed(1)} m/s · Fuel ${Math.round((n.roverRocketFuel??1)*100)}%`;Fe&&(Fe.innerHTML=`<span><strong>${i?`🚁 DRONE`:`🚙 ROVER`}</strong> · ${o} · g=${r.gravityMS2.toFixed(2)} m/s² · ${s} · ${c}</span>`),Ie&&(Ie.textContent=i?`⬆ ASCEND (Space)`:`🔥 ROCKET JUMP`,Ie.classList.toggle(`firing`,!!U.surfaceControls.jump)),Le&&(Le.textContent=i?r.hasSolidCrust?`🚙 SWITCH ROVER (F)`:`☁ CLOUD DECK DRONE`:`🚁 DEPLOY DRONE (F)`,Le.classList.toggle(`active`,i)),Re&&(Re.textContent=t.cameraMode===`first-person`?`📷 1ST CAM (V)`:`📷 3RD CAM (V)`,Re.classList.toggle(`active`,t.cameraMode===`first-person`))}async function Lt({bodyIndex:e=null,planetaryModeOverride:t=null}={}){q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),_t=null;let n=e;if(typeof n==`string`){let e=z.findIndex(e=>e.id===n);n=e>0?e:U.planetaryBodyIndex}return n>0||(n=U.focusedSolarBodyIndex>0?U.focusedSolarBodyIndex:U.planetaryBodyIndex>0?U.planetaryBodyIndex:4),W=4,s=2,await U.enterSurfaceView({bodyIndex:n,planetaryModeOverride:t}),Z(),Nt(),It(),Q(),$(performance.now()),U.surfaceTelemetry}function Rt(){if(!U.surfaceActive)return;U.exitSurfaceView();let e=z[U.planetaryBodyIndex]||z[3];W=4,s=zn(e),At(U.planetaryBodyIndex),Nt(),It(),Q(),$(performance.now())}we?.addEventListener(`click`,()=>{Lt({bodyIndex:U.planetaryBodyIndex})}),Ie?.addEventListener(`pointerdown`,e=>{e.preventDefault(),U.setSurfaceControls({jump:!0}),It()});let zt=()=>{U.surfaceControls.jump&&(U.setSurfaceControls({jump:!1}),It())};Ie?.addEventListener(`pointerup`,zt),Ie?.addEventListener(`pointerleave`,zt),Ie?.addEventListener(`pointercancel`,zt),Le?.addEventListener(`click`,()=>{if(!U.surfaceSession)return;let e=U.surfaceSession.activeVehicle===`drone`?`rover`:`drone`;U.setSurfaceVehicle(e),It(),$(performance.now())}),Re?.addEventListener(`click`,()=>{if(!U.surfaceSession)return;let e=U.surfaceSession.cameraMode===`chase`?`first-person`:`chase`;U.setSurfaceCameraMode(e),It(),$(performance.now())}),ze?.addEventListener(`click`,()=>Rt());function Bt(e,t,n){if(!e||!t)return;let r=null,i=r=>{let i=e.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5,s=r.clientX-a,c=r.clientY-o,l=Math.hypot(s,c);l>36&&(s=s/l*36,c=c/l*36),t.style.transform=`translate(calc(-50% + ${s.toFixed(1)}px), calc(-50% + ${c.toFixed(1)}px))`,n(s/36,-c/36)};e.addEventListener(`pointerdown`,t=>{t.preventDefault(),r=t.pointerId,e.setPointerCapture?.(t.pointerId),i(t)}),e.addEventListener(`pointermove`,e=>{e.pointerId===r&&i(e)});let a=e=>{e.pointerId===r&&(r=null,t.style.transform=`translate(-50%, -50%)`,n(0,0))};e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a)}Bt(Ve,He,(e,t)=>{U.setSurfaceControls({moveX:e,moveY:t})}),Bt(Ue,We,(e,t)=>{U.addSurfaceLookDelta(-e*.08,-t*.05)});let Vt=e=>{let t=document.activeElement?.tagName;if(!(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)){if(!U.surfaceActive){e.code===`KeyL`&&W===4&&!e.repeat&&Lt({bodyIndex:U.planetaryBodyIndex});return}e.code===`KeyW`||e.code===`ArrowUp`?(U.setSurfaceControls({forward:!0}),e.preventDefault()):e.code===`KeyS`||e.code===`ArrowDown`?(U.setSurfaceControls({backward:!0}),e.preventDefault()):e.code===`KeyA`||e.code===`ArrowLeft`?(U.setSurfaceControls({left:!0}),e.preventDefault()):e.code===`KeyD`||e.code===`ArrowRight`?(U.setSurfaceControls({right:!0}),e.preventDefault()):e.code===`Space`?(U.setSurfaceControls({jump:!0}),e.preventDefault()):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?U.setSurfaceControls({down:!0}):e.code===`ShiftLeft`||e.code===`ShiftRight`?U.setSurfaceControls({turbo:!0}):e.code===`KeyQ`?U.setSurfaceControls({yawLeft:!0}):e.code===`KeyE`?U.setSurfaceControls({yawRight:!0}):e.code===`KeyF`&&!e.repeat&&U.surfaceSession?(U.setSurfaceVehicle(U.surfaceSession.activeVehicle===`drone`?`rover`:`drone`),It()):e.code===`KeyV`&&!e.repeat&&U.surfaceSession?(U.setSurfaceCameraMode(U.surfaceSession.cameraMode===`chase`?`first-person`:`chase`),It()):e.code===`Escape`&&Rt()}},Ht=e=>{U.surfaceActive&&(e.code===`KeyW`||e.code===`ArrowUp`?U.setSurfaceControls({forward:!1}):e.code===`KeyS`||e.code===`ArrowDown`?U.setSurfaceControls({backward:!1}):e.code===`KeyA`||e.code===`ArrowLeft`?U.setSurfaceControls({left:!1}):e.code===`KeyD`||e.code===`ArrowRight`?U.setSurfaceControls({right:!1}):e.code===`Space`?U.setSurfaceControls({jump:!1}):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?U.setSurfaceControls({down:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?U.setSurfaceControls({turbo:!1}):e.code===`KeyQ`?U.setSurfaceControls({yawLeft:!1}):e.code===`KeyE`&&U.setSurfaceControls({yawRight:!1}))};if(window.addEventListener(`keydown`,Vt),window.addEventListener(`keyup`,Ht),Se?.addEventListener(`click`,()=>{q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Pt()}),B?.addEventListener(`click`,()=>{q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Ft()}),D?.addEventListener(`click`,()=>{q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Ft()}),v?.addEventListener(`click`,()=>{q=!q,v.classList.toggle(`active`,q),v.textContent=q?`⏹ Stop Tour`:`▶ Tour`,q&&(_t=null)}),E?.addEventListener(`click`,()=>{st=!st,E.textContent=st?`⏸ Pause`:`▶ Resume`,h?.classList.toggle(`paused`,!st)}),O?.addEventListener(`input`,e=>{ct=Number(e.target.value)||1,k&&(k.textContent=`${ct.toFixed(1)}×`)}),A?.addEventListener(`click`,async()=>{mt=1,await U.initCosmicWeb(),_t=null,s=V[0].log10SpanM,W=0,Z(),Nt()}),ee?.addEventListener(`click`,async()=>{mt=.75,U.setSeed(U.seed+7919>>>0),await U.initCosmicWeb(),U.galaxyEngine&&await U.initGalaxy(),U.solarEngine&&await U.initSolarSystem(),Z()}),M)for(let e of M.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(U.setQuality(t)){for(let e of M.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);W===0?await U.initCosmicWeb():W===1?await U.initGalaxy():W===2&&U.galaxyBranch!==`smbh-core`?await U.initSolarSystem():W===3?await U.initStellarCore():W===5?await U.initMolecularDynamics():W===6?await U.initQuantumAtom():W===7&&(await U.initAtomicNucleus(),U.nuclearResult?.volumeData&&et.uploadNuclearVolume(U.nuclearResult.volumeData)),X()}});te?.addEventListener(`change`,e=>{lt=e.target.checked}),N?.addEventListener(`change`,e=>{ut=e.target.checked}),P?.addEventListener(`change`,e=>{e.target.checked}),F?.addEventListener(`change`,e=>{dt=e.target.checked}),I?.addEventListener(`change`,e=>{ft=e.target.checked}),ne?.addEventListener(`input`,e=>{pt=Number(e.target.value)||3,re&&(re.textContent=`${pt}×`)}),ae?.addEventListener(`click`,async()=>{U.getPeerMeshState().connected?await U.disconnectPeerMesh():await U.connectPeerMesh({relayUrl:ie?.value||``,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:L?.value||`requester`}),Ut()});function Ut(){let e=U.getPeerMeshState();ae&&(ae.textContent=e.connected?`Leave`:`Join Mesh`),oe&&(oe.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let Wt=!1,Gt=!1,Kt=0,qt=0,Jt=0,Yt=0;function Xt(){let e=s;if(W===0){if(U.cosmoMode!==`web`&&U.cosmoBaryonSession){let t=12.2/Math.max(100,U.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-e));return{kind:`cosmo-baryon`,buffer:U.cosmoBaryonSession.getResidentTracersBuffer(),count:U.cosmoBaryonSession.tracerCount,strideFloats:16,layoutMode:de.STANDARD,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(U.cosmoSession)return{kind:`cosmo-web`,buffer:U.cosmoSession.particlesBuffer,count:U.cosmoSession.particleCount,strideFloats:8,layoutMode:de.STANDARD,worldScale:St.cosmoScale??.09,offsetHi:St.cosmoOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(W===1&&U.galaxyEngine)return{kind:`galaxy-star`,buffer:U.galaxyEngine.getResidentBuffer(),count:U.galaxyEngine.count,strideFloats:8,layoutMode:de.GALAXY_VISIBLE,worldScale:St.galaxyScale??.85,offsetHi:St.galaxyOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0};else if(W===2&&U.galaxyBranch!==`smbh-core`){if(U.solarMode===`formation`&&U.protoplanetarySession){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-e));return{kind:`proto-pebble`,buffer:U.protoplanetarySession.getResidentPebblesBuffer(),count:U.protoplanetarySession.pebbleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(U.solarMode===`quasar-jet`&&U.kerrJetSession){let t=.85*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`kerr-parcel`,buffer:U.kerrJetSession.getResidentParcelsBuffer(),count:U.kerrJetSession.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U.solarMode)&&U.relBinarySession){let t=1.12*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`relbin-parcel`,buffer:U.relBinarySession.getResidentParcelsBuffer(),count:U.relBinarySession.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`comet-tails`,`hot-jupiter`].includes(U.solarMode)&&U.radWindL2Session){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`radwind-parcel`,buffer:U.radWindL2Session.getResidentParcelsBuffer(),count:U.radWindL2Session.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`roche-rings`,`giant-impact`,`red-giant`].includes(U.solarMode)&&U.tidalRocheSession){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`roche-parcel`,buffer:U.tidalRocheSession.getResidentParticlesBuffer(),count:U.tidalRocheSession.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(U.solarEngine){let e=U.solarEngine.getMassiveBodyState64(U.focusedSolarBodyIndex),t=[Math.fround(e.posAu[0]),Math.fround(e.posAu[1]),Math.fround(e.posAu[2])],n=[Math.fround(e.posAu[0]-t[0]),Math.fround(e.posAu[1]-t[1]),Math.fround(e.posAu[2]-t[2])];return{kind:`solar-asteroid`,buffer:U.solarEngine.getResidentBuffer(),count:U.solarEngine.totalCount,strideFloats:16,layoutMode:de.SOLAR_DOUBLE_FLOAT,worldScale:St.solarScaleAuToWorld??1,offsetHi:t,offsetLo:n,skipFirst:U.solarEngine.massiveCount}}}else if(W===3){let t=.92*10**Math.max(-1,Math.min(1,9.2-e));if(U.stellarMode===`nebular-mhd`&&U.nebulaMhdSession)return{kind:`nebula-mhd-parcel`,buffer:U.nebulaMhdSession.getResidentTracersBuffer(),count:U.nebulaMhdSession.tracerCount,strideFloats:16,layoutMode:de.STANDARD,worldScale:t*1.15,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(U.stellarMode)&&U.radWindL3Session)return{kind:`radwind-parcel`,buffer:U.radWindL3Session.getResidentParcelsBuffer(),count:U.radWindL3Session.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t*1.05,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if((U.stellarMode===`pulsar`||U.stellarMode===`magnetar`)&&U.magnetosphereSession)return{kind:`mag-parcel`,buffer:U.magnetosphereSession.getResidentParcelsBuffer(),count:U.magnetosphereSession.particleCount,strideFloats:16,layoutMode:de.FLAGGED_LIVE_16F,worldScale:t*1.12,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if(U.stellarEngine)return{kind:`stellar-hydro-parcel`,buffer:U.stellarEngine.getResidentBuffer(),count:U.stellarEngine.count,strideFloats:16,layoutMode:de.STANDARD,worldScale:t*.95,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(W===5&&U.mdSession){let t=U.mdSession.boxLengthsA,n=8.4/Math.max(t[0],t[1],t[2],6),r=10**Math.max(-1.2,Math.min(1.4,-8.2-e));return{kind:`md-atom`,buffer:U.mdSession.positionsBuffer,velBuffer:U.mdSession.velocitiesBuffer,count:U.mdSession.atomCount,strideFloats:4,layoutMode:de.MD_PERIODIC_4F,worldScale:n*r,offsetHi:[0,0,0],offsetLo:[t[0]*.5,t[1]*.5,t[2]*.5],skipFirst:0}}return null}function Zt(e,t,n){let r=n,i=e.worldScale||1,a=e.offsetHi||[0,0,0],o=e.offsetLo||[0,0,0],s=[r[0]||0,r[1]||0,r[2]||0],c;if(e.layoutMode===de.SOLAR_DOUBLE_FLOAT?(s=[r[0]+r[4],r[1]+r[5],r[2]+r[6]],c=[(r[0]-a[0]+(r[4]-o[0]))*i,(r[1]-a[1]+(r[5]-o[1]))*i,(r[2]-a[2]+(r[6]-o[2]))*i]):c=e.layoutMode===de.MD_PERIODIC_4F?[(r[0]-o[0])*i,(r[1]-o[1])*i,(r[2]-o[2])*i]:[(r[0]-a[0])*i,(r[1]-a[1])*i,(r[2]-a[2])*i],e.kind===`cosmo-web`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0),i=Math.max(.1,Number(r[7])||1);return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`Cosmic-Web Halo Mote #${t}`,subtitle:`2LPT FLRW TreePM Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:`Collisionless Dark-Matter + Baryon Filament Tracer · Click 🎯 Focus to dive into this knot`,tempK:8500,stats:[[`Comoving r`,`${Math.hypot(...s).toFixed(1)} Mpc`],[`Peculiar |v|`,`${(n*120).toFixed(0)} km/s`],[`Local δ/ρ̄`,`${i.toFixed(2)}×`],[`GPU Buffer`,`Index #${t}`]]}}if(e.kind===`cosmo-baryon`){let n=(r[11]||0)>.5,i=Number(r[8])||3e3,a=Number(r[9])||0,o=Number(r[7])||1;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`${n?`Dark-Matter Lensing Halo`:`Baryon / IGM Parcel`} #${t}`,subtitle:`Live GPU Cosmological Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:n?`Collisionless CDM Mass Tracer`:`H/He Plasma · x_HII=${(a*100).toFixed(1)}% · T=${i>1e5?`${(i/1e6).toFixed(1)} MK`:`${Math.round(i)} K`}`,tempK:Math.max(2500,Math.min(35e3,i)),stats:[[`Species`,n?`Dark Matter`:`Baryon Gas`],[`Temp T`,i>1e5?`${(i/1e6).toFixed(2)} MK`:`${Math.round(i)} K`],[`Ionized x_HII`,`${(a*100).toFixed(1)}%`],[`Density ρ`,`${o.toFixed(2)} ρ̄`]]}}if(e.kind===`galaxy-star`){let n=Number(r[7])||0,i=Math.hypot(s[0],s[2])*5.2,a=s[1]*5.2,o=Math.hypot(r[4]||0,r[5]||0,r[6]||0),l=U.galacticDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],u=Math.hypot(l[0],l[1],l[2]),d=t===0?`Central SMBH Core Anchor`:n>=.8?`H II Star-Forming Knot (OB)`:n>=.36?`Spiral-Arm Blue-White Star`:`Golden Bulge / Disk K-G Star`,f=n>=.8?22e3:n>=.36?9800:4800;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`Star #${t} · ${d}`,subtitle:`Live 32³ CIC Particle-Mesh Orbit · R = ${i.toFixed(1)} kly · z = ${a.toFixed(2)} kly`,composition:`GPU Baryonic Star Buffer · Click 🎯 Focus or Dive to inspect this star's system`,tempK:f,stats:[[`Radius R`,`${i.toFixed(1)} kly`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`],[`Local |B|`,`${(u*12).toFixed(2)} μG`],[`Mass Unit`,`${(r[3]||0).toFixed(4)}`]]}}if(e.kind===`solar-asteroid`){let n=Math.hypot(s[0],s[1],s[2]),i=Math.hypot(r[8]||0,r[9]||0,r[10]||0)*4.7405,a=(r[11]||0)>6.5||n>12;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`${a?`Kuiper Belt Object`:`Main-Belt Asteroid`} #${t}`,subtitle:`f32x2 Symplectic N-Body Minor Body · r = ${n.toFixed(3)} AU`,composition:a?`H₂O / CH₄ / N₂ Outer-System Icy Planetesimal`:`Carbonaceous / Silicate Chondrite Asteroid`,tempK:Math.max(40,Math.round(280/Math.sqrt(Math.max(.2,n)))),stats:[[`Helio r`,`${n.toFixed(3)} AU`],[`Speed |v|`,`${i.toFixed(2)} km/s`],[`Zone`,a?`Kuiper Belt`:`Main Belt`],[`GPU Index`,`#${t}`]]}}if(e.kind===`proto-pebble`){let n=Math.hypot(s[0],s[1],s[2]),i=Number(r[8])||180,a=Number(r[9])||0;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`${a>.5?`Icy Outer`:`Rocky Silicate`} Pebble #${t}`,subtitle:`Epstein/Stokes Gas-Drag Disk Tracer · r = ${n.toFixed(2)} AU`,composition:a>.5?`Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)`:`Refractory Silicate + Fe-Ni Chondrule Dust`,tempK:Math.max(50,Math.min(2e3,i)),stats:[[`Disk r`,`${n.toFixed(2)} AU`],[`Temp T(r)`,`${Math.round(i)} K`],[`Ice Frac`,`${(a*100).toFixed(0)}%`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`stellar-hydro-parcel`){let n=Number(r[8])||4,i=Number(r[9])||-5,a=10**n,o=Number(r[10])||.72,l=Number(r[11])||-30,u=Number(r[13])||0,d=Number(r[14])||.26,f=Number(r[15])||.02,p=U.stellarDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],m=Math.hypot(p[0],p[1],p[2]);return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`Stellar Plasma Parcel #${t}`,subtitle:`self-gravitating-hydro@1 · r = ${Math.hypot(...s).toFixed(2)} · x_ion = ${(u*100).toFixed(0)}%`,composition:`H ${(o*100).toFixed(1)}% · He ${(d*100).toFixed(1)}% · Z ${(f*100).toFixed(2)}%`,tempK:Math.max(2e3,Math.min(4e4,a)),stats:[[`Parcel T`,a>=1e6?`${(a/1e6).toFixed(2)} MK`:`${Math.round(a).toLocaleString()} K`],[`log₁₀ ρ`,`${i.toFixed(2)} kg/m³`],[`Fusion ε`,l>-12?`10^${l.toFixed(1)} W/kg`:`Inactive`],[`Dynamo |B|`,`${m.toFixed(3)} B_sim`]]}}if(e.kind===`nebula-mhd-parcel`){let n=Number(r[7])||0,i=Number(r[11])||0,a=Number(r[13])||0;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`MHD Nebula Parcel #${t}`,subtitle:`3D Resistive MHD · B = (${(r[8]||0).toFixed(2)}, ${(r[9]||0).toFixed(2)}, ${(r[10]||0).toFixed(2)})`,composition:a>.15?`Magnetocentrifugal (J×B) Bipolar Jet Plasma`:`Rotating Magnetized Molecular Cloud Gas & Dust`,tempK:a>.15?14e3:4200,stats:[[`Local |B|`,`${n.toFixed(3)}`],[`Density ρ`,`${i.toFixed(2)}`],[`Jet Outflow`,`${a.toFixed(2)}`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`mag-parcel`||e.kind===`kerr-parcel`||e.kind===`relbin-parcel`){let n=Number(r[3])||0,i=Math.max(1,Number(r[7])||1),a=Number(r[9])||0,o=e.kind===`mag-parcel`?n>1.5?`Reconnection Flare / PWN`:n>.5?`Polar-Cap Open Beam`:`Closed Magnetosphere Loop`:e.kind===`kerr-parcel`?n>.5&&n<1.5?`Blandford–Znajek Jet`:`Novikov–Thorne Disk`:n>1.5?`r-Process Ejecta`:`Relativistic Stream`;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`${o} Parcel #${t}`,subtitle:`Persistent GPU Plasma Mote · Lorentz Γ = ${i.toFixed(2)}×`,composition:`Speed |v| = ${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)} · r = ${Math.hypot(...s).toFixed(2)}`,tempK:22e3,stats:[[`Role`,o.slice(0,14)],[`Lorentz Γ`,`${i.toFixed(2)}×`],[e.kind===`mag-parcel`?`Local |B|`:`Y_e / Aux`,`${a.toFixed(3)}`],[`Emissivity`,`${(r[10]||0).toFixed(2)}`]]}}if(e.kind===`radwind-parcel`||e.kind===`roche-parcel`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0);return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`${e.kind===`radwind-parcel`?`Photoionized Nebula/Tail`:`Tidal Debris/Ring`} Parcel #${t}`,subtitle:`Live GPU Parcel · r = ${Math.hypot(...s).toFixed(2)} · |v| = ${n.toFixed(2)}`,composition:e.kind===`radwind-parcel`?`Hα=${(r[8]||0).toFixed(2)} · [O III]=${(r[9]||0).toFixed(2)} · [S II]=${(r[10]||0).toFixed(2)}`:`Intact=${(r[7]||0)>.5?`Cohesive`:`Disrupted`} · T_norm=${(r[8]||0).toFixed(2)}`,tempK:11e3,stats:[[`Radius r`,`${Math.hypot(...s).toFixed(2)}`],[`Speed |v|`,`${n.toFixed(2)}`],[e.kind===`radwind-parcel`?`Hα / [O III]`:`Temp Norm`,e.kind===`radwind-parcel`?`${(r[8]||0).toFixed(1)} / ${(r[9]||0).toFixed(1)}`:`${(r[8]||0).toFixed(2)}`],[`GPU Index`,`#${t}`]]}}if(e.kind===`md-atom`){let n=U.getCachedElementBundle(U.mdElementZ,!0)?.bundle,r=n?.symbol||`Z=${U.mdElementZ}`;return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`Atom #${t} · ${r} (Z=${U.mdElementZ})`,subtitle:`Live WebGPU MD Atom · (${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}) Å`,composition:`${n?.mechanical?.crystalStructure||`lattice`} · m = ${(n?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,tempK:U.mdTelemetry?.temperatureK||U.mdTempK,stats:[[`Element`,`${r} (Z=${U.mdElementZ})`],[`Lattice x,y`,`${s[0].toFixed(1)}, ${s[1].toFixed(1)} Å`],[`Lattice z`,`${s[2].toFixed(2)} Å`],[`Bath Temp`,`${Math.round(U.mdTelemetry?.temperatureK||U.mdTempK)} K`]]}}return{kind:e.kind,level:W,index:t,rawPos:s,worldPos:c,name:`GPU Mote #${t}`,subtitle:`Live Resident WebGPU Entity`,composition:``,tempK:6e3,stats:[[`Index`,`#${t}`],[`X`,s[0].toFixed(2)],[`Y`,s[1].toFixed(2)],[`Z`,s[2].toFixed(2)]]}}function Qt(e,t){let n=U.getTargetsForLevel(W,St),r=null,i=42;for(let a of n){if(W===0&&U.cosmoMode!==`web`||W===2&&![`nbody`,`smbh-core`].includes(U.solarMode)&&U.galaxyBranch!==`smbh-core`||W===3||W===5)continue;let n=jn(a.pos,yt,bt,xt);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r=a)}return r}async function $t(e,t,{preferGpuMote:n=!1}={}){if(W===7&&at.length>0){let n=null,r=36;for(let i=0;i<at.length;i+=1){let a=at[i],o=jn(a.pos,yt,bt,xt);if(!o.visible)continue;let s=Math.hypot(o.sx-e,o.sy-t);s<r&&(r=s,n={idx:i,sphere:a})}if(n){let e=n.sphere.color0[0]>.7,t=Math.hypot(...n.sphere.pos)*(Number(U.nuclearResult?.chargeRadiusFm||3.7)/2.2);return G={kind:`nucleon`,level:7,index:n.idx,rawPos:[...n.sphere.pos],worldPos:[...n.sphere.pos],name:`${e?`Proton p⁺`:`Neutron n⁰`} #${n.idx+1} (${U.nuclearA}${U.nuclearResult?.isotope?.split(`-`)[0]||``})`,subtitle:e?`Valence Quarks u-u-d · Charge +1e · Spin ½`:`Valence Quarks u-d-d · Charge 0 · Spin ½`,composition:`Bound inside Woods–Saxon nuclear potential (B/A = ${(U.nuclearResult?.bindingPerNucleonMeV||8.79).toFixed(3)} MeV)`,tempK:1e10,stats:[[`Baryon`,e?`Proton (p⁺)`:`Neutron (n⁰)`],[`Shell r`,`${t.toFixed(2)} fm`],[`Mass`,e?`938.27 MeV`:`939.57 MeV`],[`Quarks`,e?`u u d`:`u d d`]]},Q(),$(performance.now()),G}}if(!n){let n=Qt(e,t);if(n&&(W===2||W===4||W===1&&n.isSmbh))return G=null,it=!1,nt=n.id,W===1&&n.branch?U.setGalaxyBranch(n.branch,n.pos):W===2&&n.bodyIndex!=null&&(U.setFocusedSolarBody(n.bodyIndex),n.bodyIndex>0&&U.initPlanetaryInterior({bodyIndex:n.bodyIndex})),X(),Q(),n}let r=Xt();if(r&&r.buffer&&r.count>0){let n=e/Math.max(1,bt)*2-1,i=1-t/Math.max(1,xt)*2,a=bt/Math.max(1,xt),o=await tt.pickEntity({buffer:r.buffer,count:r.count,strideFloats:r.strideFloats,layoutMode:r.layoutMode,skipFirst:r.skipFirst||0,viewProj:yt,clickNdcX:n,clickNdcY:i,aspect:a,maxPickNdc:.14,offsetHi:r.offsetHi,offsetLo:r.offsetLo,worldScale:r.worldScale});if(o){let e=new Float32Array([...o.vec0,...o.vec1,...o.vec2,...o.vec3]);return G=Zt(r,o.index,e),Q(),$(performance.now()),G}}let i=Qt(e,t);return i?(G=null,it=!1,nt=i.id,W===1&&i.branch&&U.setGalaxyBranch(i.branch,i.pos),X(),Q(),i):null}async function en(){if(!G||G.level!==W||G.kind===`nucleon`)return;let e=Xt();if(!e||e.kind!==G.kind||!e.buffer)return;let t=await tt.readSingleEntity(e.buffer,G.index,e.strideFloats);t&&G&&G.kind===e.kind&&(G=Zt(e,G.index,t))}function tn({zoomIn:e=!1}={}){return G?(W===0&&G.kind===`cosmo-web`?(U.setCosmoFocusMpc(G.rawPos),it=!0,e&&jt(Math.max(21.2,s-1.6))):W===1&&G.kind===`galaxy-star`?(U.setGalaxyBranch(`solar-system`,G.rawPos),it=!0,e&&jt(Math.max(17.5,s-1.5))):(it=!it||e,it?(K=[...G.worldPos],e&&(J.dist=Math.max(6.5,J.dist*.62))):(K=[0,0,0],J.dist=18)),Q(),$(performance.now()),!0):!1}Ce?.addEventListener(`click`,()=>{tn({zoomIn:!it})}),c.addEventListener(`pointerdown`,e=>{Wt=!0,Gt=!1,Kt=e.clientX,qt=e.clientY,Jt=e.clientX,Yt=e.clientY,c.setPointerCapture?.(e.pointerId)}),c.addEventListener(`pointermove`,e=>{if(Wt){let t=e.clientX-Jt,n=e.clientY-Yt;Math.hypot(e.clientX-Kt,e.clientY-qt)>5&&(Gt=!0),U.surfaceActive?U.addSurfaceLookDelta(-t*.0055,n*.0055):(J.yaw-=t*.006,J.pitch=Math.max(-1.42,Math.min(1.42,J.pitch+n*.006))),Jt=e.clientX,Yt=e.clientY}else if(!U.surfaceActive){let t=Qt(e.clientX,e.clientY);rt=t?.id||null,c.style.cursor=t?`pointer`:`crosshair`}}),c.addEventListener(`pointerup`,e=>{Wt&&!Gt&&!U.surfaceActive&&(q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),$t(e.clientX,e.clientY)),Wt=!1}),c.addEventListener(`dblclick`,async e=>{if(U.surfaceActive)return;q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`);let t=await $t(e.clientX,e.clientY);t&&t===G?tn({zoomIn:!0}):Pt()}),c.addEventListener(`wheel`,e=>{if(e.preventDefault(),U.surfaceActive)return;q=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),_t=null;let t=Math.max(-.55,Math.min(.55,e.deltaY*.0024));s=Math.max(Oe,Math.min(De,s+t)),vt=Math.abs(t)*10,Y(s)},{passive:!1});function nn(e){if(!_e)return;let t=_e.getContext(`2d`);if(!t)return;let n=_e.width,r=_e.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=Mn(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=W>=5?U.getCachedElementBundle(W===5?U.mdElementZ:U.quantumZ,U.quantumRelativistic):null,a=ln(W,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=Mn(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}}function rn(){if(!xe)return;let e=xe.getContext(`2d`);if(!e)return;let t=xe.width,n=xe.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(W===0){let e=U.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;R&&(R.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=U.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(W===1){R&&(R.textContent=`Gate 1 H/He/C/O · Z=${U.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=U.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,U.galaxyMetallicity,U.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(W===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U.solarMode)&&U.relBinaryTelemetry?.gwStrainHistory?.length){let e=U.relBinaryTelemetry.gwStrainHistory;be&&(be.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),R&&(R.textContent=`f_GW=${(U.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(U.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(U.solarMode===`quasar-jet`&&U.kerrJetTelemetry){be&&(be.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=U.kerrJetTelemetry;R&&(R.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{be&&(be.textContent=V[2].plotTitle);let r=U.solarConservation0,i=U.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;R&&(R.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${U.solarEngine?.totalCount||0} bodies`);let o=z.filter(e=>e.parent===0&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.slice(0,3),a,n-14-i)})}else if(W===3)if((U.stellarMode===`pulsar`||U.stellarMode===`magnetar`)&&U.magnetosphereTelemetry?.flareHistory?.length){let e=U.magnetosphereTelemetry.flareHistory;be&&(be.textContent=U.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),R&&(R.textContent=`B=${U.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${U.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),U.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(U.stellarMode===`white-dwarf-tov`&&U.tovCurve?.length){be&&(be.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=U.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);R&&(R.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{be&&(be.textContent=V[3].plotTitle);let e=U.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);R&&(R.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(U.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(W===4){let e=U.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,U.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));R&&(R.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(U.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(W===5){let e=U.mdRdfHistory;if(!e?.length)return;R&&(R.textContent=`Phase: ${U.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(U.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(W===6){let e=U.getCachedElementBundle(U.quantumZ,U.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;R&&(R.textContent=`Dirac–KS ${U.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${U.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(W===7){let e=U.tdseTelemetry;if(!e?.prob?.length)return;R&&(R.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}function Q(){let e=V[W],t=!!(G&&G.level===W),n=t?G:Mt();g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=je(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),fe&&(fe.textContent=t?`GPU MOTE INSPECTOR · L${e.level} · ${je(s)}`:`L${e.level} · ${e.name.toUpperCase()} · ${je(s)}`),pe&&(pe.textContent=n?.name||e.name),me&&(me.textContent=n?.subtitle||e.engineSchema),ge&&(ge.textContent=n?.composition||``),he&&(he.textContent=W>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`),Ce&&(Ce.style.display=t&&!U.surfaceActive?`inline-flex`:`none`,Ce.textContent=it?`🎯 Locked`:`🎯 Focus`,Ce.classList.toggle(`active`,it));let r=[];if(t&&Array.isArray(G.stats)&&G.stats.length)r=G.stats;else if(W===0)if(U.cosmoMode!==`web`&&U.cosmoBaryonTelemetry){let e=U.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;r=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=U.cosmoTelemetry;r=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(W===1)r=[[`GPU Particles`,`${(U.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,U.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${U.galaxyEngine?.stepIndex||0}`]];else if(W===2)if(U.solarMode===`formation`&&U.protoplanetaryTelemetry){let e=U.protoplanetaryTelemetry;r=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(U.solarMode===`quasar-jet`&&U.kerrJetTelemetry){let e=U.kerrJetTelemetry;r=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U.solarMode)&&U.relBinaryTelemetry){let e=U.relBinaryTelemetry;r=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(U.solarMode)&&U.radWindL2Telemetry){let e=U.radWindL2Telemetry;r=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(U.solarMode)&&U.tidalRocheTelemetry){let e=U.tidalRocheTelemetry;r=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=U.solarConservation,t=z[U.focusedSolarBodyIndex];r=[[`Focus`,t?.name||`Earth`],[`True Radius`,t?`${t.radiusKm.toLocaleString()} km`:`—`],[`N-Body Steps`,`${U.solarEngine?.stepIndex||0}`],[`Sim Time`,`${(U.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&U.galaxyBranch===`smbh-core`&&(r[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],r[1]=[`Lensing`,lt?`Active WGSL`:`OFF`])}else if(W===3)if(U.stellarMode===`nebular-mhd`&&U.nebulaMhdTelemetry){let e=U.nebulaMhdTelemetry;r=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(U.stellarMode)&&U.radWindL3Telemetry){let e=U.radWindL3Telemetry;r=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((U.stellarMode===`pulsar`||U.stellarMode===`magnetar`)&&U.magnetosphereTelemetry){let e=U.magnetosphereTelemetry;r=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(U.stellarMode===`white-dwarf-tov`&&U.tovCurve?.length){let e=U.tovCurve.find(e=>e.branch===`white-dwarf`)||U.tovCurve[2],t=U.tovCurve.find(e=>e.branch===`neutron-star`)||U.tovCurve[11];r=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else{let e=U.stellarTelemetry;r=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,e?.stage||`hydro-collapse`],[`GPU Steps`,`${U.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(U.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(W===4)if(U.surfaceActive&&U.surfaceSession){let e=U.surfaceTelemetry||U.surfaceSession.getTelemetry(),t=U.surfaceSession.env;r=[[`Surface g`,`${t.gravityMS2.toFixed(2)} m/s²`],[`Air ρ_atm`,t.rhoAtmKgM3>1e-4?`${t.rhoAtmKgM3.toFixed(3)} kg/m³`:`0 (Vacuum)`],[`Rover Alt/Fuel`,`${e.roverAltitudeM.toFixed(1)}m / ${Math.round(e.roverRocketFuel*100)}%`],[`Drone Max Lift`,t.droneFlightCapable?`${t.maxAeroLiftN.toFixed(1)} N (OK)`:`0.0 N (Vac)`]]}else{let e=U.planetaryResult,t=U.planetaryAtmoTelemetry;r=[[`World`,z[U.planetaryBodyIndex]?.name||`Earth`],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(W===5){let e=U.mdTelemetry;r=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${U.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,U.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(W===6){let e=U.getCachedElementBundle(U.quantumZ,U.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],n=Number(e?.atomic?.totalEnergyHa);r=[[`Samples`,`${(U.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(n)?`${n.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(W===7){let e=U.nuclearResult,t=U.tdseTelemetry,n=Number(e?.bindingPerNucleonMeV),i=Number(e?.chargeRadiusFm);r=[[`B / A`,Number.isFinite(n)?`${n.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(i)?`${i.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}ye&&(ye.innerHTML=r.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``)),nn(n),rn()}function an(e){if(!u)return;u.clearRect(0,0,bt,xt);let t=U.getTargetsForLevel(W,St);if(t.length){for(let n of t){if(W===2&&n.spec?.parent>0&&s>10.5||W===4&&!U.planetaryCutaway)continue;let t=jn(n.pos,e,bt,xt);if(!t.visible)continue;let r=n.id===nt,i=n.id===rt;if(!r&&!i&&W>=3)continue;let a=r?18:i?15:8;u.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:i?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,u.lineWidth=r?1.6:1;let o=Math.max(4,a*.45);for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(t.sx+e*a,t.sy+n*(a-o)),u.lineTo(t.sx+e*a,t.sy+n*a),u.lineTo(t.sx+e*(a-o),t.sy+n*a),u.stroke();(r||i||W===2&&n.spec?.parent===0&&s>9.5)&&(u.font=r?`600 11px monospace`:`500 9.5px monospace`,u.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,u.fillText(n.name,t.sx+a+6,t.sy+3.5))}if(G&&G.level===W&&G.worldPos){let t=jn(G.worldPos,e,bt,xt);t.visible&&(u.save(),u.strokeStyle=`rgba(250, 204, 21, 0.96)`,u.lineWidth=1.9,u.beginPath(),u.moveTo(t.sx,t.sy-14),u.lineTo(t.sx+14,t.sy),u.lineTo(t.sx,t.sy+14),u.lineTo(t.sx-14,t.sy),u.closePath(),u.stroke(),u.beginPath(),u.arc(t.sx,t.sy,3,0,Math.PI*2),u.fillStyle=`#fde047`,u.fill(),u.font=`600 11px monospace`,u.fillStyle=`#fef08a`,u.fillText(G.name,t.sx+14+7,t.sy+3.5),u.restore())}}}function on(e,t){let n=s,r=10**n,i=[],a=[],o=[],c=[],l=[.62,.55,.55],u=null,d=null,f=null,p={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,vt*.08),flashAmount:mt,crtEnabled:ft,pixelSize:pt,timeSec:t},m=Fn(n,20.8,22,25.6,26),h=U.cosmoTargets[0]?.posMpc||[0,0,0],g=Pn(23.8,21.8,n),_=[h[0]*g,h[1]*g,h[2]*g],v=16/178*10**Math.min(2.6,24.8-n);if(St.cosmoScale=v,St.cosmoOffset=_,m>.01)if(U.cosmoMode!==`web`&&U.cosmoBaryonSession&&n>=22){let t=Fn(n,22,22.7,25.6,26),r=12.2/Math.max(100,U.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-n));if(i.push({buffer:U.cosmoBaryonSession.getResidentTracersBuffer(),count:U.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:U.cosmoMode===`cmb`?.16:U.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(U.cosmoMode===`cmb`?.15:U.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,U.cosmoBaryonSession.boxSizeMpc||260]}),U.cosmoMode===`cluster-merger`&&lt&&t>.25){let n=jn([0,0,0],e.viewProj,bt,xt);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=9e-4*t)}}else U.cosmoSession&&U.cosmoMode===`web`&&i.push({buffer:U.cosmoSession.particlesBuffer,count:U.cosmoSession.particleCount,mode:0,worldScale:v,pointSize:Math.max(.048,Math.min(.17,.068*10**Math.max(-.5,Math.min(.8,24.8-n)))),alphaGain:.44*m,extra1:[_[0],_[1],_[2],U.cosmoSession.boxSizeMpc||200]});let y=Fn(n,15.4,16.6,22,22.8),b=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,x=U.galaxyFocusPos||[4.8,.04,2.1],S=Pn(20.6,18.8,n),C=[x[0]*S,x[1]*S,x[2]*S];if(St.galaxyScale=b,St.galaxyOffset=C,y>.01&&U.galaxyEngine&&(i.push({buffer:U.galaxyEngine.getResidentBuffer(),count:U.galaxyEngine.count,mode:1,worldScale:b,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*y,extra1:[C[0],C[1],C[2],0]}),ut&&U.showGalacticBField&&U.galacticDynamoStreamlines?.length>=14&&n>18.8)){let e=y*Pn(18.8,20.2,n),t=U.galacticDynamoStreamlines;for(let n=0;n<t.length;n+=7)c.push((t[n]-C[0])*b,(t[n+1]-C[1])*b,(t[n+2]-C[2])*b,t[n+3],t[n+4],t[n+5],t[n+6]*e)}if(U.galaxyBranch===`smbh-core`){let t=Fn(n,9.2,10.6,15.8,17);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),U.smbhBodies){let e=Math.floor(U.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[U.smbhBodies[e]*r,U.smbhBodies[e+1]*r,U.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(lt){let n=jn([0,0,0],e.viewProj,bt,xt);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(U.solarMode===`formation`&&W===2&&U.protoplanetarySession){let e=Fn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n));if(i.push({buffer:U.protoplanetarySession.getResidentPebblesBuffer(),count:U.protoplanetarySession.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...U.protoplanetarySession.getEmbryoRenderSpheres(t)),ut){let n=U.protoplanetarySession.snowLineAu*t,r=null;for(let t=0;t<=72;t+=1){let i=t/72*Math.PI*2,a=[Math.cos(i)*n,0,Math.sin(i)*n];r&&(c.push(...r,.36,.84,1,.45*e),c.push(...a,.36,.84,1,.45*e)),r=a}}}}else if(U.solarMode===`quasar-jet`&&W===2&&U.kerrJetSession){let t=Fn(n,9.6,10.6,15.6,16.8);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=U.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:U.kerrJetSession.getResidentParcelsBuffer(),count:U.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),lt){let n=jn([0,0,0],e.viewProj,bt,xt);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U.solarMode)&&W===2&&U.relBinarySession){let t=Fn(n,9.6,10.6,15.6,16.8);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...U.relBinarySession.getRenderSpheres(r)),i.push({buffer:U.relBinarySession.getResidentParcelsBuffer(),count:U.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),lt&&(U.solarMode===`bbh-merger`||U.solarMode===`xray-binary`)){let n=jn([0,0,0],e.viewProj,bt,xt);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=(U.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(U.solarMode)&&W===2&&U.radWindL2Session){let e=Fn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=U.solarMode===`comet-tails`;l=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:U.radWindL2Session.getResidentParcelsBuffer(),count:U.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(U.solarMode)&&W===2&&U.tidalRocheSession){let e=Fn(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...U.tidalRocheSession.getRenderSpheres(t)),i.push({buffer:U.tidalRocheSession.getResidentParticlesBuffer(),count:U.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else{let e=Fn(n,5.4,6.4,15.8,17.2),t=r/ve,s=16/Math.max(1e-9,t);if(St.solarScaleAuToWorld=s,e>.01&&U.solarEngine){let t=U.focusedSolarBodyIndex,r=U.solarEngine.getMassiveBodyState64(t),d=U.solarEngine.getMassiveBodyState64(0),f=[Math.fround(r.posAu[0]),Math.fround(r.posAu[1]),Math.fround(r.posAu[2])],p=[Math.fround(r.posAu[0]-f[0]),Math.fround(r.posAu[1]-f[1]),Math.fround(r.posAu[2]-f[2])];t>0&&(l=W===4&&U.planetaryMode===`eyeball-locked`?[1,0,0]:W===4&&U.planetaryMode===`rogue`?[.15,.96,.22]:Dn([d.posAu[0]-r.posAu[0],d.posAu[1]-r.posAu[1],d.posAu[2]-r.posAu[2]]));let m=U.getTargetsForLevel(4)[0],h=m?.rCoreNorm??.54,g=m?.rMantleNorm??.94;for(let c=0;c<U.solarEngine.massiveCount;c+=1){let l=z[c],d=U.solarEngine.getMassiveBodyState64(c),f=(d.posAu[0]-r.posAu[0])*s,p=(d.posAu[1]-r.posAu[1])*s,m=(d.posAu[2]-r.posAu[2])*s;if(Math.hypot(f,p,m)>180&&c!==t)continue;let _=d.radiusAu*s;if(c===0&&t===0&&n<=9.9)continue;let v=c===t&&c>0&&n<8.85,y=v&&U.planetaryCutaway,b=v&&!y&&U.planetaryMode===`magma-ocean`,x=v&&!y&&U.planetaryMode===`cryo-plumes`,S=v&&!y&&U.planetaryMode===`rogue`,C=a.length;if(a.push({pos:[f,p,m],radius:_,color0:b?[1,.44,.1]:x?[.86,.92,.98]:S?[.16,.24,.36]:l.color0,color1:b?[.22,.08,.05]:x?[.48,.68,.86]:S?[.06,.1,.18]:l.color1,kind:y?4:b?7:x?3:l.kind,atm:b?.55:x?.18:l.atm??.35,rCore:h,rMantle:g,cutaway:y,seed:c*2.17+1.3}),v&&!b&&!x&&U.planetaryAtmoSession&&(u={buffer:U.planetaryAtmoSession.getResidentEmVisBuffer(),width:U.planetaryAtmoSession.width,height:U.planetaryAtmoSession.height,sphereIndex:C}),x&&U.cryoPlumeSession){let t=_/2.35;i.push({buffer:U.cryoPlumeSession.getResidentParticlesBuffer(),count:U.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[0,0,0,0]})}l.ringed&&_>.008&&o.push({center:[f,p,m],rIn:l.ringInnerKm/l.radiusKm*_,normal:[.16,.89,.42],rOut:l.ringOuterKm/l.radiusKm*_,color:[.88,.78,.62],kind:1})}let _=Fn(n,10.6,11.4,14.5,16.2);if(_>.01&&i.push({buffer:U.solarEngine.getResidentBuffer(),count:U.solarEngine.totalCount,mode:4,worldScale:s,pointSize:.055,alphaGain:.42*_,extra1:[f[0],f[1],f[2],U.solarEngine.massiveCount],extra2:[p[0],p[1],p[2],0]}),ut&&n>8.1){let e=Fn(n,8.1,8.8,15.2,16.4);c.push(...Ln(U.solarEngine,r.posAu,s,n,e))}}}let w=U.focusedSolarBodyIndex===0&&U.galaxyBranch!==`smbh-core`?Fn(n,7,7.8,9.7,10.4):0;if(w>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(U.stellarMode===`nebular-mhd`&&U.nebulaMhdSession){if(i.push({buffer:U.nebulaMhdSession.getResidentTracersBuffer(),count:U.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*w,extra1:[0,0,0,0]}),U.nebulaMhdStreamlines?.length>=14){let t=U.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(U.stellarMode)&&U.radWindL3Session)i.push({buffer:U.radWindL3Session.getResidentParcelsBuffer(),count:U.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.18,.105*e)),alphaGain:.17*w,extra1:[0,0,0,0]}),U.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):U.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((U.stellarMode===`pulsar`||U.stellarMode===`magnetar`)&&U.magnetosphereSession){let t=U.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:U.magnetosphereSession.getResidentParcelsBuffer(),count:U.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*w,extra1:[0,0,0,0]}),U.magnetosphereFieldLines?.length>=14){let t=U.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if(U.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(c.push(...r,.42,.84,1,(.34-t*.08)*w),c.push(...o,.42,.84,1,(.34-t*.08)*w)),r=o}}}else if(U.stellarEngine&&(i.push({buffer:U.stellarEngine.getResidentBuffer(),count:U.stellarEngine.count,mode:2,worldScale:e*.95,pointSize:Math.max(.045,Math.min(.2,.125*e)),alphaGain:.3*w,extra1:[0,0,0,0]}),ut&&U.stellarDynamoStreamlines?.length>=14)){let t=U.stellarDynamoStreamlines,n=e*.95;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}let T=Fn(n,-9.6,-8.9,-6.2,-5.2);if(T>.01&&U.mdSession){let e=U.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(U.getCachedElementBundle(U.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];d={positionsBuffer:U.mdSession.positionsBuffer,velocitiesBuffer:U.mdSession.velocitiesBuffer,count:U.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(U.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:T,idealCoord:U.mdSession.idealCoordination||12},ut&&T>.3&&c.push(...In([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*T]))}let E=Fn(n,-13.2,-12,-9.4,-8.8);if(E>.01&&U.orbitalCloud){let e=(U.getCachedElementBundle(U.quantumZ,U.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:U.orbitalCloud.pointsBuffer,count:U.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*E,colorPos:U.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:U.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),U.quantumMode===`molecule`){let e=U.MOLECULE_SPECS[U.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let D=Fn(n,-15.5,-14.8,-13.3,-12.4);if(D>.01&&U.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=U.buildQuantizedNucleonSpheres(U.nuclearResult,2.2*e,t);at=r,a.push(...r);let i=U.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);f={dim:U.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:D}}if(G&&G.worldPos&&G.level===W){let t=G.worldPos,n=Math.max(.4,Math.hypot(e.pos[0]-t[0],e.pos[1]-t[1],e.pos[2]-t[2])),r=Math.max(.14,Math.min(2.2,n*.032)),i=[t[0]+r,t[1],t[2]],a=[t[0]-r,t[1],t[2]],o=[t[0],t[1]+r,t[2]],s=[t[0],t[1]-r,t[2]],l=[t[0],t[1],t[2]+r],u=[t[0],t[1],t[2]-r],d=(e,t,n=1,r=.84,i=.3,a=.96)=>{c.push(e[0],e[1],e[2],n,r,i,a,t[0],t[1],t[2],n,r,i,a)};d(o,i),d(o,a),d(o,l),d(o,u),d(s,i),d(s,a),d(s,l),d(s,u),d(i,l),d(l,a),d(a,u),d(u,i);let f=r*1.65;d([t[0]+r*1.15,t[1],t[2]],[t[0]+f,t[1],t[2]],.45,.92,1,.88),d([t[0]-r*1.15,t[1],t[2]],[t[0]-f,t[1],t[2]],.45,.92,1,.88),d([t[0],t[1]+r*1.15,t[2]],[t[0],t[1]+f,t[2]],.45,.92,1,.88),d([t[0],t[1]-r*1.15,t[2]],[t[0],t[1]-f,t[2]],.45,.92,1,.88)}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,lightDir:l,mdCloud:d,disks:o.length?o:null,lines:c.length>=14?new Float32Array(c):null,nuclearVol:f,post:p}}let sn=performance.now(),cn=0,dn=0,fn=0,pn=0,mn=60;function $(e=performance.now()){Tt();let t=c.width/Math.max(1,c.height);if(U.surfaceActive&&U.surfaceSession){let n=U.surfaceSession,r=n.getCameraPose(),i=58*Math.PI/180,a=On(i,t,.15,420),o=kn(r.eye,r.target,r.up),s=An(a,o.mat);yt=s;let c={viewProj:s,pos:r.eye,right:o.right,up:o.up,fwd:o.fwd,aspect:t,fovTanHalf:Math.tan(i*.5),timeSec:e*.001,level:4,log10SpanM:2},l=n.env.isRogue?Dn([.15,.96,.22]):n.env.isMagmaOcean?Dn([.7,.28,.65]):Dn([.58,.44,.68]);et.renderFrame({camera:c,lightDir:l,surfaceScene:{terrainVertBuf:n.getResidentTerrainVertBuffer(),terrainIdxBuf:n.getResidentTerrainIndexBuffer(),indexCount:n.indexCount,vehicleVertBuf:n.getResidentVehicleVertBuffer(),vehicleVertCount:n.vehicleVertCount,env:n.env,lightDir:l},particleClouds:[{buffer:n.getResidentPlumesBuffer(),count:n.particleCount,mode:11,worldScale:1,pointSize:.72,alphaGain:.92,extra1:[r.focusPos[0],0,r.focusPos[2],1/(2*n.env.tinyPlanetCurvatureRadiusM)]}],post:{bhUv:[.5,.5],bhStrength:0,warpAmount:0,flashAmount:mt,crtEnabled:ft,pixelSize:pt,timeSec:e*.001}}),u&&u.clearRect(0,0,bt,xt);return}K=it&&G&&G.level===W&&G.worldPos?[K[0]+(G.worldPos[0]-K[0])*.25,K[1]+(G.worldPos[1]-K[1])*.25,K[2]+(G.worldPos[2]-K[2])*.25]:[K[0]*.82,K[1]*.82,K[2]*.82];let n=Math.cos(J.pitch),r=Math.sin(J.pitch),i=Math.cos(J.yaw),a=Math.sin(J.yaw),o=[K[0]+J.dist*n*a,K[1]+J.dist*r,K[2]+J.dist*n*i],l=48*Math.PI/180,d=On(l,t,.05,260),f=kn(o,K,[0,1,0]),p=An(d,f.mat);yt=p;let m=on({viewProj:p,pos:o,right:f.right,up:f.up,fwd:f.fwd,aspect:t,fovTanHalf:Math.tan(l*.5),timeSec:e*.001,level:W,log10SpanM:s},e*.001);et.renderFrame(m),an(p)}function hn(e){if(ht)return;gt=requestAnimationFrame(hn);let t=Math.min(.1,Math.max(.001,(e-sn)/1e3));if(sn=e,fn+=t,pn+=1,fn>=.45&&(mn=Math.round(pn/fn),fn=0,pn=0),dt&&!Wt&&(J.yaw+=t*.22),mt>0&&(mt=Math.max(0,mt-t*1.45)),vt=Math.max(0,vt-t*12),_t!==null){let e=_t-s,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);s+=n,vt=Math.abs(n)/Math.max(.001,t),Math.abs(_t-s)<.015&&(s=_t,_t=null),Y(s)}q&&_t===null&&(s-=t*1.15,s<=-14.75&&(s=De-.3),Y(s));let n=Rn(s,{focusedSolarBodyIndex:U.focusedSolarBodyIndex,galaxyBranch:U.galaxyBranch});if(n!==W){let e=W;W=n,G=null,it=!1,K=[0,0,0],J.dist=18,W===4&&e!==4&&!Wt&&At(U.focusedSolarBodyIndex),Z(),Nt(),Y(s)}st&&U.stepActiveRegimes(W,s,ct),ot+=t,ot>=.1&&G&&G.level===W&&(ot=0,en()),(!(W===6&&!Wt&&!dt&&_t===null&&!q&&mt<=0)||e-cn>=120)&&(cn=e,$(e)),dn+=t,dn>=.18&&(dn=0,_&&(_.textContent=`${mn} FPS · WebGPU`),U.surfaceActive&&It(),Q(),Ut())}Ge?.classList.remove(`active`),await Y(s),Z(),Nt();let gn=r.get(`peerRelay`);if(gn){ie&&(ie.value=gn);let e=r.get(`peerRole`)||`requester`;L&&(L.value=e),await U.connectPeerMesh({relayUrl:gn,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),Ut()}Q();let _n=()=>{U.disconnectPeerMesh()};return window.addEventListener(`pagehide`,_n),window.addEventListener(`beforeunload`,_n),gt=requestAnimationFrame(hn),Object.freeze({getState(){let e=V[W],t=U.cosmoSession?.getState?.()||null,r=z[0],i=z[3],a=z[6],o=U.solarConservation0,c=U.solarConservation;return{ready:!0,continuousZoom:!0,level:W,scaleId:e.id,scaleName:e.name,log10ViewSpanM:s,physicalSpanLabel:je(s),totalSpanOom:Number((De-Oe).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:dt,running:st,autopilot:q,retroCrt:ft,lensingEnabled:lt,qualityId:U.quality.id,seed:U.seed,gpuErrorCount:n.length,gpuErrors:[...n],scientificValidation:!1,cosmicEpochId:U.cosmicEpochId,cosmicEpochRedshiftZ:U.cosmicEpoch?.redshiftZ??0,cosmoMode:U.cosmoMode,cosmoBaryonSteps:U.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:U.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:U.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:U.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:t?.stepIndex??0,scaleFactorA:t?.aScale??null,redshiftZ:t?.redshiftZ??null,submitsPerStep:U.cosmoTelemetry?.submitsPerStep??t?.submitsPerStep??null,sigmaDensity:U.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:U.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:U.galaxyEngine?.stepIndex??0,galaxyPreset:U.galaxyPreset,galacticBodyCount:U.galaxyEngine?.count??0,galacticGravityMode:U.galaxyEngine?.gravityMode??null,galacticDynamoMagEnergy:U.galacticDynamoTelemetry?.magneticEnergy??null,galacticDynamoStreamlineFloats:U.galacticDynamoStreamlines?.length??0,galacticB0:U.galacticB0,galaxyBranch:U.galaxyBranch,planetarySteps:U.solarEngine?.stepIndex??0,solarSimTimeYr:U.solarEngine?.simTimeYr??0,solarTotalBodies:U.solarEngine?.totalCount??0,focusedSolarBody:z[U.focusedSolarBodyIndex]?.id??`earth`,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&c?Math.abs(c.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:c?.relMomentumError??null,stellarSteps:U.stellarEngine?.stepIndex??0,stellarMode:U.stellarMode,stellarPreset:U.stellarPreset,stellarCoreTempK:U.stellarTelemetry?.coreTempK??null,stellarDynamoMagEnergy:U.stellarDynamoTelemetry?.magneticEnergy??null,stellarDynamoStreamlineFloats:U.stellarDynamoStreamlines?.length??0,stellarB0:U.stellarB0,magnetosphereStreamlineFloats:U.magnetosphereFieldLines?.length??0,pickedGpuMote:G?{kind:G.kind,index:G.index,name:G.name,subtitle:G.subtitle}:null,moteFocusLocked:it,nebulaMhdSteps:U.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:U.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:U.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:U.solarMode,kerrSpinA:U.kerrSpinA,kerrMaxGamma:U.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:U.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:U.relBinaryTelemetry?.merged??!1,relBinaryRemnant:U.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:U.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:U.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:U.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:U.tovCurve?.length??0,tidalRupturedFrac:U.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:U.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:U.protoplanetaryTelemetry?.accretedPebbles??null,planetaryMode:U.planetaryMode,planetaryInteriorValid:!!U.planetaryResult?.valid,planetaryMoiFactor:U.planetaryResult?.moiFactor??null,planetaryCutaway:U.planetaryCutaway,planetaryAtmoActive:!!U.planetaryAtmoSession,planetaryAtmoSteps:U.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:U.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:U.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,surfaceActive:U.surfaceActive,surfaceVehicle:U.surfaceSession?.activeVehicle??null,surfaceCameraMode:U.surfaceSession?.cameraMode??null,surfaceGravityMS2:U.surfaceSession?.env?.gravityMS2??null,surfaceAtmoDensityKgM3:U.surfaceSession?.env?.rhoAtmKgM3??null,surfaceDroneFlightCapable:U.surfaceSession?.env?.droneFlightCapable??null,surfaceDroneMaxAeroLiftN:U.surfaceSession?.env?.maxAeroLiftN??null,surfaceTelemetry:U.surfaceTelemetry??null,activeUniversalLaws:U.getActiveUniversalLaws(W,s).active.map(e=>e.id),mdSteps:U.mdTelemetry?.totalSteps??0,mdAtomCount:U.mdSession?.atomCount??0,mdGravity:U.mdGravity,mdElementZ:U.mdElementZ,quantumZ:U.quantumZ,quantumRelativistic:U.quantumRelativistic,orbitalPointCount:U.orbitalCloud?.pointCount??0,nuclearZ:U.nuclearZ,nuclearA:U.nuclearA,nuclearBindingPerNucleonMeV:U.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:U.tdseTelemetry?.stepCount??0,selectedTarget:Mt()?.id??null,peerMeshState:U.getPeerMeshState()}},async setLog10Span(e){return _t=null,s=Bn(e),W=Rn(s,{focusedSolarBodyIndex:U.focusedSolarBodyIndex,galaxyBranch:U.galaxyBranch}),await Y(s),Z(),Nt(),Q(),$(performance.now()),this.getState()},flyToLog10Span:jt,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));if(n===3?U.setFocusedSolarBody(0):n===4&&U.focusedSolarBodyIndex===0&&U.setFocusedSolarBody(3),t){let e=await this.setLog10Span(V[n].log10SpanM);return n===4&&(At(U.focusedSolarBodyIndex),$(performance.now())),e}return jt(V[n].log10SpanM),this.getState()},async focusSolarBody(e){let t=U.setFocusedSolarBody(e);return t>0&&await U.initPlanetaryInterior({bodyIndex:t}),W===4&&t>0&&(s=zn(z[t]),At(t)),Z(),Nt(),$(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await U.setCosmicEpoch(e,t),wt(),Z(),X(),Q(),$(performance.now()),this.getState()},async setCosmoMode(e){return await U.setCosmoMode(e),Z(),X(),Q(),$(performance.now()),this.getState()},async setGalaxyPreset(e){return await U.initGalaxy({preset:e}),Z(),X(),Q(),$(performance.now()),this.getState()},async setSolarMode(e){return await U.setSolarMode(e),Z(),X(),Q(),$(performance.now()),this.getState()},async setKerrSpinA(e){return await U.setKerrSpinA(e),X(),Q(),$(performance.now()),this.getState()},async setStellarMode(e){return await U.setStellarMode(e),Z(),X(),Q(),$(performance.now()),this.getState()},async setPlanetaryMode(e){return await U.setPlanetaryMode(e),e===`cryo-plumes`&&W===4&&(s=Math.max(s,7.56),At(U.focusedSolarBodyIndex),J.pitch=-.18),Z(),X(),Q(),$(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(J.yaw=Number(e)),Number.isFinite(Number(t))&&(J.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),$(performance.now()),this.getState()},async setNebulaB0(e){return await U.setNebulaB0(e),X(),$(performance.now()),this.getState()},async setGalacticB0(e){return await U.setGalacticB0(e),X(),Q(),$(performance.now()),this.getState()},async setStellarB0(e){return await U.setStellarB0(e),X(),Q(),$(performance.now()),this.getState()},async setStellarPreset(e){return await U.initStellarCore({preset:e}),G=null,it=!1,X(),Q(),$(performance.now()),this.getState()},async pickAtCanvasFraction(e=.5,t=.5,{preferGpuMote:n=!0}={}){return $(performance.now()),$t(e*bt,t*xt,{preferGpuMote:n})},focusPickedMote(e={zoomIn:!0}){return tn(e)},getPickedMote(){return G},async readGalaxyDiagnostics(){if(!U.galaxyEngine)return null;let e=await U.galaxyEngine.readbackBodies(),t=Math.floor(e.length/8),n=0,r=0,i=0,a=0,o=0;for(let s=1;s<t;s+=1){let t=s*8;if(e[t+7]<-.5)continue;let c=Math.hypot(e[t],e[t+2]),l=e[t+1];n+=1,r+=c,i+=l*l,c>a&&(a=c),(c>18||Math.abs(l)>10)&&(o+=1)}return{stepIndex:U.galaxyEngine.stepIndex,visibleStars:n,meanRadius:r/Math.max(1,n),rmsHeightZ:Math.sqrt(i/Math.max(1,n)),maxRadius:a,escapedFrac:o/Math.max(1,n)}},async readStellarDiagnostics(){if(!U.stellarEngine)return null;let e=await U.stellarEngine.readbackBodies(),t=Math.floor(e.length/16),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=o*16,s=Math.hypot(e[t],e[t+1],e[t+2]),c=Math.hypot(e[t+4],e[t+5],e[t+6]);n+=s,r+=c*c,c>i&&(i=c),s<6.5&&(a+=1)}return{stepIndex:U.stellarEngine.stepIndex,count:t,meanRadius:n/Math.max(1,t),rmsSpeed:Math.sqrt(r/Math.max(1,t)),maxSpeed:i,boundFrac:a/Math.max(1,t),coreTempK:U.stellarTelemetry?.coreTempK??null}},setPlanetaryTriboelectric(e){return U.setPlanetaryTriboelectric(e),X(),this.getState()},getActiveUniversalLaws(){return U.getActiveUniversalLaws(W,s)},async setGalaxyBranch(e){return U.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await Y(s),Nt(),this.getState()},setPlanetaryCutaway(e){U.setPlanetaryCutaway(e),$(performance.now())},async enterSurfaceView(e={}){return await Lt(e),this.getState()},exitSurfaceView(){return Rt(),this.getState()},setSurfaceVehicle(e){return U.setSurfaceVehicle(e),It(),$(performance.now()),this.getState()},setSurfaceCameraMode(e){return U.setSurfaceCameraMode(e),It(),$(performance.now()),this.getState()},setSurfaceControls(e={}){return U.setSurfaceControls(e),It(),this.getState()},addSurfaceLookDelta(e,t){return U.addSurfaceLookDelta(e,t),$(performance.now()),this.getState()},async setMdPhase(e){return await U.initMolecularDynamics({Z:U.mdElementZ,phasePreset:e}),X(),this.getState()},selectTarget(e){return U.getTargetsForLevel(W,St).some(t=>t.id===e)?(nt=e,Q(),!0):!1},initiateHyperdrive:Pt,returnToOrbit:Ft,setAutopilot(e){q=!!e,v?.classList.toggle(`active`,q),v&&(v.textContent=q?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=pt){ft=!!e,pt=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),I&&(I.checked=ft),ne&&(ne.value=String(pt)),re&&(re.textContent=`${pt}×`)},setCameraAutoSpin(e){dt=!!e,F&&(F.checked=dt)},async bigBang(){return mt=1,await U.initCosmicWeb(),this.setLog10Span(V[0].log10SpanM)},async reseed(e=null){return U.setSeed(e??U.seed+7919>>>0),await U.initCosmicWeb(),this.getState()},connectPeerMesh:e=>U.connectPeerMesh(e),disconnectPeerMesh:()=>U.disconnectPeerMesh(),dispatchPeerDerivation:e=>U.dispatchPeerDerivation(e),async stepOnce(){return await U.stepActiveRegimes(W,s,ct),Q(),this.getState()},capturePng(){return $(performance.now()),c.toDataURL(`image/png`)},dispose(){ht=!0,cancelAnimationFrame(gt),window.removeEventListener(`resize`,Tt),window.removeEventListener(`keydown`,Vt),window.removeEventListener(`keyup`,Ht),window.removeEventListener(`pagehide`,_n),window.removeEventListener(`beforeunload`,_n),tt.dispose(),U.dispose(),et.dispose()}})}async function Hn(){try{let e=await Vn();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}Hn();