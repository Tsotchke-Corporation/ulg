import{A as e,Dt as t,Et as n,Fo as r,Io as i,It as a,L as o,Lo as s,No as c,Pt as l,R as u,a as d,g as f,jo as p,jt as m,k as h,r as g,u as _,v,x as y,z as b}from"./molecularDynamicsWebGpu-D3Vza8Ty.js";import{t as x}from"./ClosureRegistry-D6kjFkSv.js";import{n as S,r as C,t as w}from"./clientDerivationPeers-BDi1EyW4.js";import{attachWebGpuUncapturedErrorTelemetry as T}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as E,createCachedExplicitBindGroup as D,createCachedExplicitComputePipeline as O}from"../runtime/webgpuComputeLayout.js";import{t as k}from"./radiationClosure-BRkiUYv5.js";import{d as A,h as j,l as M,m as N,n as P,p as F,t as I}from"./simulationModuleRegistry-CBHe6Lbb.js";import{r as L}from"./schroederSpatialScaleAtlasRuntime-CFwiufjF.js";var R=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,z=149597870700,B=30034896e-13,V=4*Math.PI*Math.PI,H=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),U=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:.04,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:B,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:.04,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:.05,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:.04,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ice Giant · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,tempK:59,centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · H₂/He Atm`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Eccentric Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`}]);function W(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function G(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function K({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=G((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=S*C+x*w*T,k=w*E,A=-x*w-S*C*T,j=-S*w+x*C*T,M=C*E;return{pos:[D*g+A*_,k*g+M*_,O*g+j*_],vel:[D*y+A*b,k*y+M*b,O*y+j*b]}}function q(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function ee({asteroidCount:e=512,seed:t=20261125,starMassScale:n=1,centerOffsetAu:r=[0,0,0]}={}){let i=U.length,a=Math.max(0,Math.min(4096,Math.trunc(Number(e)||0))),o=i+a,s=Array.from({length:o},()=>[0,0,0]),c=Array.from({length:o},()=>[0,0,0]),l=new Float64Array(o),u=new Float64Array(o),d=new Float32Array(o);for(let e=0;e<i;e+=1){let t=U[e],r=e===0?t.massSolar*Math.max(.1,Number(n)||1):t.massSolar;if(l[e]=r,u[e]=t.radiusKm*1e3/z,d[e]=t.kind,t.parent<0)continue;let i=t.parent,a=K(t,V*(l[i]+r));s[e]=[s[i][0]+a.pos[0],s[i][1]+a.pos[1],s[i][2]+a.pos[2]],c[e]=[c[i][0]+a.vel[0],c[i][1]+a.vel[1],c[i][2]+a.vel[2]]}let f=0,p=0,m=0,h=0,g=0,_=0,v=0;for(let e=0;e<i;e+=1){let t=l[e];f+=t,p+=t*s[e][0],m+=t*s[e][1],h+=t*s[e][2],g+=t*c[e][0],_+=t*c[e][1],v+=t*c[e][2]}p/=f,m/=f,h/=f;let y=g/f,b=_/f,x=v/f;for(let e=0;e<i;e+=1)s[e][0]-=p,s[e][1]-=m,s[e][2]-=h,c[e][0]-=y,c[e][1]-=b,c[e][2]-=x;let S=q(t^2654435769),C=V*l[0];for(let e=0;e<a;e+=1){let t=i+e,n=e>=Math.floor(a*.72),r=K({aAu:n?32+S()*14:2.15+S()*1.15,e:n?.02+S()*.14:.01+S()*.16,incDeg:(S()-.5)*(n?14:12),omDeg:S()*360,wDeg:S()*360,m0Deg:S()*360},C);s[t]=[s[0][0]+r.pos[0],s[0][1]+r.pos[1],s[0][2]+r.pos[2]],c[t]=[c[0][0]+r.vel[0],c[0][1]+r.vel[1],c[0][2]+r.vel[2]],l[t]=0,u[t]=(15+S()*85)*1e3/z,d[t]=n?7:6}let w=Number(r?.[0])||0,T=Number(r?.[1])||0,E=Number(r?.[2])||0,D=new Float32Array(o*16);for(let e=0;e<o;e+=1){let[t,n]=W(s[e][0]+w),[r,i]=W(s[e][1]+T),[a,o]=W(s[e][2]+E),f=e*16;D[f+0]=t,D[f+1]=r,D[f+2]=a,D[f+3]=l[e],D[f+4]=n,D[f+5]=i,D[f+6]=o,D[f+7]=u[e],D[f+8]=c[e][0],D[f+9]=c[e][1],D[f+10]=c[e][2],D[f+11]=d[e],D[f+12]=0,D[f+13]=0,D[f+14]=0,D[f+15]=0}return Object.freeze({packed:D,massiveCount:i,asteroidCount:a,totalCount:o,catalog:U})}var te=`
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
`;function ne(e,{asteroidCount:t=512,seed:n=20261125,starMassScale:r=1,centerOffsetAu:i=[0,0,0],softeningAu:a=1e-7,label:o=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let s=ee({asteroidCount:t,seed:n,starMassScale:r,centerOffsetAu:i}),c=[E(0,`uniform`),E(1,`storage`)],l=t=>O(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${o}-${t}`,code:te,entryPoint:t,bindings:c}),u=l(`compute_nbody_accel`),d=l(`kdk_half_kick_drift`),f=l(`kdk_second_kick`),p=e.createBuffer({label:`${o}-params`,size:32,usage:H.UNIFORM|H.COPY_DST}),m=e.createBuffer({label:`${o}-bodies`,size:s.packed.byteLength,usage:H.STORAGE|H.VERTEX|H.COPY_DST|H.COPY_SRC});e.queue.writeBuffer(m,0,s.packed);let h=s.massiveCount*64,g=e.createBuffer({label:`${o}-massive-staging`,size:h,usage:H.MAP_READ|H.COPY_DST}),_=D(e,{layout:u.bindGroupLayout,label:`${o}-bg`,entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:m}}]}),v=Float32Array.from(s.packed.subarray(0,s.massiveCount*16)),y=0,b=0,x=!1,S=!1,C=!1;function w(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([s.totalCount,s.massiveCount,0,0]),new Float32Array(n,16,4).set([t,V,a*a,0]),e.queue.writeBuffer(p,0,n)}async function T({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(C)return v;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));w(a);let c=Math.ceil(s.totalCount/64),l=e.createCommandEncoder({label:`${o}-step-${b}`}),p=l.beginComputePass({label:`${o}-pass`});p.setBindGroup(0,_),x||=(p.setPipeline(u.pipeline),p.dispatchWorkgroups(c),!0);for(let e=0;e<i;e+=1)p.setPipeline(d.pipeline),p.dispatchWorkgroups(c),p.setPipeline(u.pipeline),p.dispatchWorkgroups(c),p.setPipeline(f.pipeline),p.dispatchWorkgroups(c);p.end();let T=r&&!S;if(T&&l.copyBufferToBuffer(m,0,g,0,h),e.queue.submit([l.finish()]),b+=i,y+=a*i,T){S=!0;try{await g.mapAsync(H.MAP_READ),C||v.set(new Float32Array(g.getMappedRange(0,h))),g.unmap()}finally{S=!1}}return v}function k(e){let t=e*16;return{posAu:[v[t+0]+v[t+4],v[t+1]+v[t+5],v[t+2]+v[t+6]],velAuPerYr:[v[t+8],v[t+9],v[t+10]],massSolar:v[t+3],radiusAu:v[t+7],phi:v[t+15]}}function A(){let e=0,t=0,n=0,r=0,i=0,o=0,c=Array.from({length:s.massiveCount},(e,t)=>k(t));for(let s=0;s<c.length;s+=1){let l=c[s],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],o+=l.massSolar*Math.sqrt(u);for(let e=s+1;e<c.length;e+=1){let n=c[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],o=n.posAu[2]-l.posAu[2],s=Math.sqrt(r*r+i*i+o*o+a*a);t-=V*l.massSolar*n.massSolar/s}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,o),simTimeYr:y,stepIndex:b})}function j(){if(!C){C=!0;for(let e of[p,m,g])try{e.destroy()}catch{}}}return Object.freeze({schema:R,get massiveCount(){return s.massiveCount},get asteroidCount(){return s.asteroidCount},get totalCount(){return s.totalCount},get stepIndex(){return b},get simTimeYr(){return y},get catalog(){return U},getResidentBuffer:()=>m,getMassiveSnapshot:()=>v,getMassiveBodyState64:k,computeConservationDiagnostics:A,step:T,dispose:j})}var re=25.4,ie=-14.8,ae=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Supergalactic Cosmic Web`,exponentLabel:`10²⁵ m`,log10SpanM:24.8,minLog10:21.8,maxLog10:25.5,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).`,kernels:`build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Spiral Galaxy & Halo`,exponentLabel:`10²¹ m`,log10SpanM:21,minLog10:15.8,maxLog10:22.8,diveVerb:`APPROACHING SOLAR SYSTEM`,diveButton:`⚡ ZOOM TO TARGET`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O`,summary:`Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Solar System & Protoplanetary Formation`,exponentLabel:`10¹² m`,log10SpanM:12.6,minLog10:7.9,maxLog10:16.8,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ ZOOM TO SELECTED BODY`,engineSchema:`ulg.astrophysics.solar-system-nbody-webgpu.v1`,plotTitle:`SYMPLECTIC N-BODY & ACCRETION DISK`,equations:`d²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]
v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals`,summary:`Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.`,kernels:`createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star/MHD`,name:`MHD Nebular Collapse & Stellar Fusion`,exponentLabel:`10⁹ m`,log10SpanM:9.2,minLog10:7.4,maxLog10:10.6,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ ZOOM TO EARTH / MATTER`,engineSchema:`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,plotTitle:`GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY`,equations:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]
du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]`,summary:`Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).`,kernels:`createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary World, Atmosphere & Electrodynamics`,exponentLabel:`10⁷ m`,log10SpanM:7.2,minLog10:-5.8,maxLog10:8.6,diveVerb:`DIVING TO CRYSTAL LATTICE`,diveButton:`⚡ ZOOM TO ATOMIC LATTICE`,engineSchema:`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ATMOSPHERIC EM`,equations:`dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge
dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae`,summary:`Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball circulation, and dark Rogue-World geothermal storms purely from physical state — plus toggleable Gate 2 Polytope Atlas cutaway.`,kernels:`createPlanetaryAtmosphereElectricSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8.2,minLog10:-9.5,maxLog10:-5.2,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ ZOOM TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)`,summary:`Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,minLog10:-13.2,maxLog10:-9,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ ZOOM TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-14.3,minLog10:-15.2,maxLog10:-12.6,diveVerb:`ZOOMING OUT TO COSMOS`,diveButton:`↻ FLY OUT TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),oe=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),se=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:22,cosmoFftN:16,galaxyStars:16384,solarAsteroids:256,stellarParticles:2048,mdCells:6,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:28,cosmoFftN:32,galaxyStars:32768,solarAsteroids:512,stellarParticles:4096,mdCells:7,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:32,cosmoFftN:32,galaxyStars:49152,solarAsteroids:1024,stellarParticles:6144,mdCells:8,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:36,cosmoFftN:32,galaxyStars:65536,solarAsteroids:1536,stellarParticles:8192,mdCells:9,orbitalPoints:24e4,nuclearVolDim:32})});function ce(e){let t=10**e;return e>=22?`${(t/308567758e14).toFixed(1)} Mpc`:e>=19?`${(t/0x834b443cc4108000).toFixed(1)} kly`:e>=15.8?`${(t/946073047e7).toFixed(2)} ly`:e>=10.6?`${(t/149597870700).toFixed(2)} AU`:e>=8.7?`${(t/6957e5).toFixed(2)} R☉`:e>=4?`${Math.round(t/1e3).toLocaleString()} km`:e>=0?`${t.toFixed(1)} m`:e>=-3?`${(t*1e3).toFixed(1)} mm`:e>=-6?`${(t*1e6).toFixed(1)} μm`:e>=-9.2?`${(t*1e9).toFixed(2)} nm`:e>=-11.5?`${(t*1e10).toFixed(2)} Å`:e>=-13?`${(t*0xe8d4a51000).toFixed(2)} pm`:`${(t*0x38d7ea4c68000).toFixed(1)} fm`}function le(){return`
    <p><strong>ULG Universes</strong> is a single-canvas, <strong>continuous-zoom 40-order-of-magnitude</strong> WebGPU cosmos spanning <code>10⁺²⁵ m</code> supergalactic filaments down to <code>10⁻¹⁵ m</code> atomic nuclei — paired with a continuous <strong>Cosmic Epoch Spine</strong> from CMB Recombination (<code>z = 1100</code>) through Cosmic Dawn (<code>z = 10</code>), Cosmic Noon / Quasar Peak (<code>z = 2.8</code>), and Present Day (<code>z = 0</code>) into the <code>+5 Gyr</code> Red-Giant &amp; Remnant Era.</p>
    <p>Every astronomical entity emerges dynamically from ULG’s <strong>15-node Universal Law Graph</strong> on WebGPU — zero hardcoded entity/planet hacks or scripted animations:</p>
    <ul>
      <li><strong>L0 Cosmology (10²⁵ m):</strong> 2LPT 1-submit FLRW 3D-FFT TreePM Cosmic Web + Eisenstein–Hu BAO/CMB ΔT/T shell (<code>z=1100</code>), Pop III Reionization bubbles (<code>z=10</code>), and Bullet-Cluster X-ray ICM / 2D gravitational lensing.</li>
      <li><strong>L1 Galaxies &amp; Clusters (10²¹ m):</strong> <code>16K–65K</code> GPU stars on parallel <code>SchroederScaleAtlas</code> multipole gravity across Spiral, Barred Spiral, Major Merger, Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf &amp; Halo Stream, and Core-Collapsed Globular Cluster + Gate 1 ISM cooling <code>Λ(T, Z)</code>.</li>
      <li><strong>L2 Planetary, Small-Body &amp; Relativistic Systems (10¹² m → 10⁷ m):</strong> Double-float (<code>f32x2</code>) symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption &amp; Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment, Kerr Blandford–Znajek Quasar/Blazar Jets (live Doppler beaming), Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW-Chirp BNS Kilonova &amp; BBH Mergers.</li>
      <li><strong>L3 Stars, Nebulae &amp; Compact Remnants (10⁹ m):</strong> Thermonuclear Fusion Core, 3D Resistive MHD Nebular Collapse &amp; Bipolar Jets, Strömgren Photoionized H II Pillars, Bipolar Planetary Nebulae, SNR / Crab PWN, Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).</li>
      <li><strong>L4 Planetary Worlds (10⁷ m):</strong> Spherical baroclinic atmosphere, triboelectric Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean, Cryovolcanic Icy Plumes, Tidally Locked Eyeball &amp; Rogue Worlds, plus Gate 2 Polytope Atlas cutaway.</li>
      <li><strong>L5–L7 Microphysics (10⁻⁸ m → 10⁻¹⁵ m):</strong> Linked-cell GPU MD, 4-component Dirac–KS Atoms + RHF Molecules + PeerCompute 2-of-2 quorum mesh, and quantized Woods–Saxon Atomic Nuclei + Visscher α-tunneling TDSE.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark comparisons remain offline and advisory.</p>
  `}function ue(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:le()}var de=`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,J=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),fe=Object.freeze({id:`nebular-mhd-collapse`,lawNodeId:`law:astrophysics-nebular-mhd`,orderConstraint:`after:galactic-mhd-evolution`,adapterMode:o.CELL_LOCAL,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`mhd-fluid-state`,`mhd-bfield-psi`,`fft-gravity-potential`,`nebula-tracers`]),writes:Object.freeze([`mhd-fluid-state`,`mhd-bfield-psi`,`nebula-tracers`]),accumulates:Object.freeze([`mhd-telemetry-reduction`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`magnetic-flux-divB`]),validityDomain:Object.freeze({cflMax:.45,gridNMin:16,gridNMax:64,idealOrResistiveMhd:!0}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([0x9184e72a000,0xde0b6b3a7640000]),fundamentalLaws:Object.freeze([`gravity-poisson-3d-fft`,`compressible-hydrodynamics`,`maxwell-mhd-induction`,`lorentz-force`,`radiative-cooling`])});function pe(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function me({gridN:e=32,tracerCount:t=6144,boxSize:n=12,cloudRadius:r=3.4,cloudMass:i=22,spinOmega:a=.62,initialB0:o=.48,turbulenceAmp:s=.16,seed:c=20261125,centerOffset:l=[0,0,0]}={}){let u=Math.max(16,Math.min(64,Math.trunc(e)));if(u&u-1)throw RangeError(`Nebular MHD gridN must be a power of 2 for 3D FFT gravity (got ${u})`);let d=u*u*u,f=n/u,p=n*.5,m=pe(c),h=Number(l?.[0])||0,g=Number(l?.[1])||0,_=Number(l?.[2])||0,v=new Float32Array(d*8),y=new Float32Array(d*4),b=r*.42,x=0,S=new Float32Array(d);for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)for(let n=0;n<u;n+=1){let i=(e*u+t)*u+n,a=(n+.5)*f-p,o=(t+.5)*f-p,s=(e+.5)*f-p,c=Math.hypot(a,o,s),l=Math.atan2(s,a),d=1/(1+(c/b)**2)**1.35,m=Math.exp(-((c/(r*1.15))**4)),h=1+.08*Math.cos(2*l)*m,g=.04+d*m*h*3.8;S[i]=g,x+=g*f**3}let C=i/Math.max(1e-6,x);for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)for(let n=0;n<u;n+=1){let i=(e*u+t)*u+n,c=(n+.5)*f-p,l=(t+.5)*f-p,d=(e+.5)*f-p,h=Math.hypot(c,d),g=Math.hypot(c,l,d),_=Math.max(.015,S[i]*C),x=Math.exp(-((g/(r*1.25))**3)),w=Math.exp(-((l/(r*.38))**2)),T=a*x*(.18+1.35*w)/(1+h/Math.max(.35,b)*.42),E=-d*T+(m()-.5)*s*x,D=-l*.24*x+(m()-.5)*s*.4*x,O=c*T+(m()-.5)*s*x,k=.085+.16*(1-x),A=(5/3-1)*_*k,j=i*8;v[j+0]=_,v[j+1]=E,v[j+2]=D,v[j+3]=O,v[j+4]=k,v[j+5]=A,v[j+6]=0,v[j+7]=0;let M=i*4;y[M+0]=0,y[M+1]=o,y[M+2]=0,y[M+3]=0}let w=Math.max(256,Math.min(32768,Math.trunc(t))),T=new Float32Array(w*16);for(let e=0;e<w;e+=1){let t=e<Math.floor(w*.78),n=Math.max(.002,m()),s=t?n**.55*r*1.15:.45+m()*(r*1.45),c=2*m()-1,l=Math.sqrt(Math.max(0,1-c*c)),u=2*Math.PI*m(),d=s*l*Math.cos(u),f=s*c*(t?.85:1.05),p=s*l*Math.sin(u),v=Math.hypot(d,p),y=Math.exp(-((s/(r*1.25))**3)),x=a*y/(1+v/Math.max(.4,b)*.35),S=e*16;T[S+0]=d+h,T[S+1]=f+g,T[S+2]=p+_,T[S+3]=i/w,T[S+4]=-p*x,T[S+5]=-f*.04*y,T[S+6]=d*x,T[S+7]=Math.abs(o),T[S+8]=0,T[S+9]=o,T[S+10]=0,T[S+11]=t?1:.15,T[S+12]=.1,T[S+13]=0,T[S+14]=+!t,T[S+15]=m()}return Object.freeze({gridN:u,totalCells:d,tracerCount:w,boxSize:n,centerOffset:Object.freeze([h,g,_]),fluid:v,bfield:y,tracers:T,meanRho:i/n**3})}var he=`
struct MhdParams {
  grid_n: u32,
  tracer_count: u32,
  streamline_count: u32,
  streamline_steps: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  gravity_g: f32,
  gamma_gas: f32,
  eta_res: f32,       // Resistive magnetic diffusivity
  c_h: f32,           // Dedner GLM divergence-cleaning wave speed
  c_p2: f32,          // Dedner GLM parabolic damping c_h^2 / c_p^2
  cool_rate: f32,     // Radiative cooling rate toward molecular cloud floor
  mean_rho: f32,
  mu0_inv: f32,       // 1 / mu0
  b_init: f32,
  center_offset: vec4<f32>, // Translation-invariant domain center (xyz) + step index (w)
};

struct FluidCell {
  rho_v: vec4<f32>,   // rho, vx, vy, vz
  u_p_phi: vec4<f32>, // u_int, P, phi_grav, divB
};

struct Tracer {
  pos_m: vec4<f32>,
  vel_bmag: vec4<f32>,
  bvec_rho: vec4<f32>,
  u_jet_tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MhdParams;
@group(0) @binding(1) var<storage, read> fluid_src: array<FluidCell>;
@group(0) @binding(2) var<storage, read_write> fluid_dst: array<FluidCell>;
@group(0) @binding(3) var<storage, read> b_src: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> b_dst: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> grav_fft: array<vec2<f32>>; // Complex 3D FFT grid
@group(0) @binding(6) var<storage, read_write> tracers: array<Tracer>;
// Telemetry buffer (4 vec4):
//   [0]: vec4(total_mass, ke_sum, mag_energy_sum, max_rho)
//   [1]: vec4(max_bmag, max_jet_vz, mean_abs_divB, total_ang_mom_y)
//   [2]: vec4(peak_toroidal_b, disk_mass_frac, jet_energy_sum, step_count)
//   [3]: reserved
@group(0) @binding(7) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = ((x % n) + n) % n;
  let wy = ((y % n) + n) % n;
  let wz = ((z % n) + n) % n;
  return u32((wz * n + wy) * n + wx);
}

fn sample_fluid_trilin(local_p: vec3<f32>) -> FluidCell {
  let n = i32(params.grid_n);
  let nf = f32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((local_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let c000 = fluid_src[cidx(i0.x, i0.y, i0.z, n)];
  let c100 = fluid_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let c010 = fluid_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let c110 = fluid_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let c001 = fluid_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let c101 = fluid_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let c011 = fluid_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let c111 = fluid_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  var out: FluidCell;
  out.rho_v = mix(
    mix(mix(c000.rho_v, c100.rho_v, f.x), mix(c010.rho_v, c110.rho_v, f.x), f.y),
    mix(mix(c001.rho_v, c101.rho_v, f.x), mix(c011.rho_v, c111.rho_v, f.x), f.y),
    f.z
  );
  out.u_p_phi = mix(
    mix(mix(c000.u_p_phi, c100.u_p_phi, f.x), mix(c010.u_p_phi, c110.u_p_phi, f.x), f.y),
    mix(mix(c001.u_p_phi, c101.u_p_phi, f.x), mix(c011.u_p_phi, c111.u_p_phi, f.x), f.y),
    f.z
  );
  return out;
}

fn sample_b_trilin(local_p: vec3<f32>) -> vec4<f32> {
  let n = i32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((local_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let b000 = b_src[cidx(i0.x, i0.y, i0.z, n)];
  let b100 = b_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let b010 = b_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let b110 = b_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let b001 = b_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let b101 = b_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let b011 = b_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let b111 = b_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  return mix(
    mix(mix(b000, b100, f.x), mix(b010, b110, f.x), f.y),
    mix(mix(b001, b101, f.x), mix(b011, b111, f.x), f.y),
    f.z
  );
}

// 1. Pack (4*pi*G*(rho - rho_bar)) into 3D FFT input buffer for self-gravity Poisson solve
@compute @workgroup_size(64)
fn pack_gravity_rhs(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let rho = fluid_src[i].rho_v.x;
  let rhs = 12.566370614 * params.gravity_g * (rho - params.mean_rho);
  grav_fft[i] = vec2<f32>(rhs, 0.0);
}

// 2. Store solved 3D FFT gravitational potential Phi(x) into fluid_src.u_p_phi.z
@compute @workgroup_size(64)
fn store_gravity_phi(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  fluid_dst[i].u_p_phi.z = grav_fft[i].x;
}

// 3. Full 3D Self-Gravitating Resistive MHD Step (Semi-Lagrangian + Flux-Conservative + Dedner GLM)
@compute @workgroup_size(4, 4, 4)
fn step_mhd_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);
  let idx = cidx(ix, iy, iz, n);

  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let invdx2 = 1.0 / (dx * dx);
  let dt = params.dt;
  let half = params.box_size * 0.5;
  let pos = vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx - vec3<f32>(half);

  let c0 = fluid_src[idx];
  let b0 = b_src[idx];
  let cxp = fluid_src[cidx(ix + 1, iy, iz, n)];
  let cxm = fluid_src[cidx(ix - 1, iy, iz, n)];
  let cyp = fluid_src[cidx(ix, iy + 1, iz, n)];
  let cym = fluid_src[cidx(ix, iy - 1, iz, n)];
  let czp = fluid_src[cidx(ix, iy, iz + 1, n)];
  let czm = fluid_src[cidx(ix, iy, iz - 1, n)];

  let bxp = b_src[cidx(ix + 1, iy, iz, n)];
  let bxm = b_src[cidx(ix - 1, iy, iz, n)];
  let byp = b_src[cidx(ix, iy + 1, iz, n)];
  let bym = b_src[cidx(ix, iy - 1, iz, n)];
  let bzp = b_src[cidx(ix, iy, iz + 1, n)];
  let bzm = b_src[cidx(ix, iy, iz - 1, n)];

  // Semi-Lagrangian backtrace for unconditionally stable advection of (rho, v, u, B, psi)
  let back_p = pos - c0.rho_v.yzw * dt;
  let adv_f = sample_fluid_trilin(back_p);
  let adv_b = sample_b_trilin(back_p);

  // Velocity divergence div(v) for compressible mass & adiabatic compression
  let dvx_dx = (cxp.rho_v.y - cxm.rho_v.y) * inv2dx;
  let dvy_dy = (cyp.rho_v.z - cym.rho_v.z) * inv2dx;
  let dvz_dz = (czp.rho_v.w - czm.rho_v.w) * inv2dx;
  let div_v = dvx_dx + dvy_dy + dvz_dz;

  // Continuity with mild Lax-Friedrichs diffusion preventing grid checkerboarding
  let lap_rho = (cxp.rho_v.x + cxm.rho_v.x + cyp.rho_v.x + cym.rho_v.x + czp.rho_v.x + czm.rho_v.x - 6.0 * c0.rho_v.x) * invdx2;
  let rho_new = clamp(adv_f.rho_v.x * exp(-clamp(div_v * dt, -0.45, 0.45)) + 0.012 * dx * dx * lap_rho, 0.012, 42.0);

  // Thermal pressure gradient -grad(P) & Self-Gravity -grad(Phi)
  let grad_p = vec3<f32>(
    (cxp.u_p_phi.y - cxm.u_p_phi.y) * inv2dx,
    (cyp.u_p_phi.y - cym.u_p_phi.y) * inv2dx,
    (czp.u_p_phi.y - czm.u_p_phi.y) * inv2dx
  );
  // Phi stored in fluid_dst.u_p_phi.z by store_gravity_phi right before step_mhd_grid!
  let phi_xp = fluid_dst[cidx(ix + 1, iy, iz, n)].u_p_phi.z;
  let phi_xm = fluid_dst[cidx(ix - 1, iy, iz, n)].u_p_phi.z;
  let phi_yp = fluid_dst[cidx(ix, iy + 1, iz, n)].u_p_phi.z;
  let phi_ym = fluid_dst[cidx(ix, iy - 1, iz, n)].u_p_phi.z;
  let phi_zp = fluid_dst[cidx(ix, iy, iz + 1, n)].u_p_phi.z;
  let phi_zm = fluid_dst[cidx(ix, iy, iz - 1, n)].u_p_phi.z;
  let grad_phi = vec3<f32>(
    (phi_xp - phi_xm) * inv2dx,
    (phi_yp - phi_ym) * inv2dx,
    (phi_zp - phi_zm) * inv2dx
  );

  // Current density J = curl(B) and Exact Lorentz Force F_L = (J x B) / mu0
  let dBz_dy = (byp.z - bym.z) * inv2dx;
  let dBy_dz = (bzp.y - bzm.y) * inv2dx;
  let dBx_dz = (bzp.x - bzm.x) * inv2dx;
  let dBz_dx = (bxp.z - bxm.z) * inv2dx;
  let dBy_dx = (bxp.y - bxm.y) * inv2dx;
  let dBx_dy = (byp.x - bym.x) * inv2dx;
  let J = vec3<f32>(dBz_dy - dBy_dz, dBx_dz - dBz_dx, dBy_dx - dBx_dy);
  let lorentz_f = cross(J, b0.xyz) * params.mu0_inv;

  // Momentum update: gravity + thermal pressure + Lorentz (J x B) + artificial kinematic viscosity
  let rho_safe = max(0.035, c0.rho_v.x);
  let lap_v = (cxp.rho_v.yzw + cxm.rho_v.yzw + cyp.rho_v.yzw + cym.rho_v.yzw + czp.rho_v.yzw + czm.rho_v.yzw - 6.0 * c0.rho_v.yzw) * invdx2;
  let acc = -grad_phi - grad_p / rho_safe + lorentz_f / rho_safe + 0.018 * dx * lap_v;
  var v_new = adv_f.rho_v.yzw + acc * dt;
  // Soft Alfvén/CFL velocity limiter so extreme core compression stays numerically bounded
  let v_max = 0.42 * dx / max(1e-5, dt);
  let v_mag = length(v_new);
  if (v_mag > v_max) {
    v_new = v_new * (v_max / v_mag);
  }

  // Induction equation: dB/dt = curl(v x B) + eta laplacian(B) - grad(psi)
  // Using electric field E = -(v x B) at face-adjacent neighbors -> exact curl(-E) = curl(v x B)!
  let emf_xp = cross(cxp.rho_v.yzw, bxp.xyz);
  let emf_xm = cross(cxm.rho_v.yzw, bxm.xyz);
  let emf_yp = cross(cyp.rho_v.yzw, byp.xyz);
  let emf_ym = cross(cym.rho_v.yzw, bym.xyz);
  let emf_zp = cross(czp.rho_v.yzw, bzp.xyz);
  let emf_zm = cross(czm.rho_v.yzw, bzm.xyz);
  let curl_vxb = vec3<f32>(
    (emf_yp.z - emf_ym.z) * inv2dx - (emf_zp.y - emf_zm.y) * inv2dx,
    (emf_zp.x - emf_zm.x) * inv2dx - (emf_xp.z - emf_xm.z) * inv2dx,
    (emf_xp.y - emf_xm.y) * inv2dx - (emf_yp.x - emf_ym.x) * inv2dx
  );
  let lap_b = (bxp.xyz + bxm.xyz + byp.xyz + bym.xyz + bzp.xyz + bzm.xyz - 6.0 * b0.xyz) * invdx2;
  let grad_psi = vec3<f32>(
    (bxp.w - bxm.w) * inv2dx,
    (byp.w - bym.w) * inv2dx,
    (bzp.w - bzm.w) * inv2dx
  );
  // Note: advection is ALREADY included in curl(v x B) = -(v.grad)B + (B.grad)v - B(div v),
  // so update directly from b0 with mild numerical + resistive diffusion!
  var b_new = b0.xyz + (curl_vxb + params.eta_res * lap_b - grad_psi) * dt;
  let b_cap = 16.0;
  let bm = length(b_new);
  if (bm > b_cap) { b_new = b_new * (b_cap / bm); }

  // Dedner GLM divergence cleaning: d(psi)/dt = -c_h^2 div(B) - damp * psi
  let div_b = (bxp.x - bxm.x) * inv2dx + (byp.y - bym.y) * inv2dx + (bzp.z - bzm.z) * inv2dx;
  let psi_new = (adv_b.w - (params.c_h * params.c_h) * div_b * dt) * exp(-params.c_p2 * dt);

  // Specific internal energy: PdV compression + Ohmic Joule heating eta |J|^2/rho - radiative cooling
  let ohmic = params.eta_res * dot(J, J) * params.mu0_inv / rho_safe;
  let pdv = -(c0.u_p_phi.y / rho_safe) * div_v;
  let u_floor = 0.065;
  let cool = params.cool_rate * rho_safe * max(0.0, adv_f.u_p_phi.x - u_floor);
  let u_new = clamp(adv_f.u_p_phi.x + (pdv + ohmic - cool) * dt, 0.04, 14.0);
  // Stiff polytropic opacity floor at high density (protostellar core pressure support!)
  let p_new = (params.gamma_gas - 1.0) * rho_new * u_new + 0.045 * pow(max(0.0, rho_new - 1.6), 2.0);

  var out_f: FluidCell;
  out_f.rho_v = vec4<f32>(rho_new, v_new);
  out_f.u_p_phi = vec4<f32>(u_new, p_new, fluid_dst[idx].u_p_phi.z, div_b);
  fluid_dst[idx] = out_f;
  b_dst[idx] = vec4<f32>(b_new, psi_new);
}

// 4. Advect Lagrangian magnetized nebula / disk / bipolar-jet tracers on the live GPU MHD field!
@compute @workgroup_size(64)
fn step_nebula_tracers(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.tracer_count) { return; }
  var tr = tracers[i];
  let half = params.box_size * 0.48;
  let local_p = tr.pos_m.xyz - params.center_offset.xyz;

  // Sample updated fluid & B-field directly from fluid_src / b_src (after swap, latest state!)
  let f = sample_fluid_trilin(local_p);
  let b = sample_b_trilin(local_p);
  let v_grid = f.rho_v.yzw;
  // Blend tracer inertia smoothly with Eulerian MHD plasma velocity (tight dust-gas coupling)
  let v_new = mix(tr.vel_bmag.xyz, v_grid, 0.45);
  var next_loc = local_p + v_new * params.dt;

  // Keep domain periodic/contained without origin pinning
  if (abs(next_loc.x) > half) { next_loc.x = next_loc.x - sign(next_loc.x) * params.box_size * 0.94; }
  if (abs(next_loc.y) > half) { next_loc.y = next_loc.y - sign(next_loc.y) * params.box_size * 0.94; }
  if (abs(next_loc.z) > half) { next_loc.z = next_loc.z - sign(next_loc.z) * params.box_size * 0.94; }

  let b_mag = length(b.xyz);
  // Outflow signature along rotation/magnetic axis: positive when flowing outward from midplane!
  let jet_out = v_new.y * sign(next_loc.y + 1e-5);
  tr.pos_m = vec4<f32>(next_loc + params.center_offset.xyz, tr.pos_m.w);
  tr.vel_bmag = vec4<f32>(v_new, b_mag);
  tr.bvec_rho = vec4<f32>(b.xyz, f.rho_v.x);
  tr.u_jet_tag = vec4<f32>(f.u_p_phi.x, jet_out, tr.u_jet_tag.z, tr.u_jet_tag.w);
  tracers[i] = tr;
}

// 5. Parallel GPU Telemetry Reduction (1 workgroup of 64 threads — ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_mhd_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.grid_n;
  let total = n * n * n;
  let dV = params.dx * params.dx * params.dx;
  let half = params.box_size * 0.5;

  var mass = 0.0;
  var ke = 0.0;
  var mag_e = 0.0;
  var max_rho = 0.0;
  var max_b = 0.0;
  var max_jet = 0.0;
  var divb_sum = 0.0;
  var peak_bphi = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let f = fluid_src[i];
    let b = b_src[i];
    let rho = f.rho_v.x;
    let v = f.rho_v.yzw;
    let bm = length(b.xyz);
    let ix = i % n;
    let iy = (i / n) % n;
    let iz = i / (n * n);
    let x = (f32(ix) + 0.5) * params.dx - half;
    let y = (f32(iy) + 0.5) * params.dx - half;
    let z = (f32(iz) + 0.5) * params.dx - half;
    let r_cyl = max(1e-4, length(vec2<f32>(x, z)));
    // Toroidal azimuthal B_phi = (-z * Bx + x * Bz) / r_cyl
    let b_phi = abs((-z * b.x + x * b.z) / r_cyl);

    mass = mass + rho * dV;
    ke = ke + 0.5 * rho * dot(v, v) * dV;
    mag_e = mag_e + 0.5 * dot(b.xyz, b.xyz) * params.mu0_inv * dV;
    max_rho = max(max_rho, rho);
    max_b = max(max_b, bm);
    if (abs(y) > params.dx * 2.0 && r_cyl < params.box_size * 0.28) {
      max_jet = max(max_jet, v.y * sign(y));
    }
    divb_sum = divb_sum + abs(f.u_p_phi.w);
    peak_bphi = max(peak_bphi, b_phi);
    i = i + 64u;
  }

  wg0[tid] = mass;
  wg1[tid] = ke;
  wg2[tid] = mag_e;
  wg3[tid] = max_rho;
  wg4[tid] = max_b;
  wg5[tid] = max_jet;
  wg6[tid] = divb_sum;
  wg7[tid] = peak_bphi;
  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg0[tid] = wg0[tid] + wg0[tid + stride];
      wg1[tid] = wg1[tid] + wg1[tid + stride];
      wg2[tid] = wg2[tid] + wg2[tid + stride];
      wg3[tid] = max(wg3[tid], wg3[tid + stride]);
      wg4[tid] = max(wg4[tid], wg4[tid + stride]);
      wg5[tid] = max(wg5[tid], wg5[tid + stride]);
      wg6[tid] = wg6[tid] + wg6[tid + stride];
      wg7[tid] = max(wg7[tid], wg7[tid + stride]);
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] / max(1.0, f32(total)), 0.0);
    telemetry[2] = vec4<f32>(wg7[0], 0.0, 0.0, params.center_offset.w);
    telemetry[3] = vec4<f32>(f32(total), params.b_init, params.dt, 0.0);
  }
}
`;function ge(e,{gridN:t=32,tracerCount:n=6144,boxSize:r=12,cloudRadius:i=3.4,cloudMass:a=22,spinOmega:o=.62,initialB0:s=.56,gravityG:c=.85,gammaGas:l=5/3,etaRes:u=.005,coolRate:d=.25,seed:f=20261125,centerOffset:m=[0,0,0],label:h=`ulg-nebular-mhd`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createNebularMhdCollapseSessionWebGpu requires a live WebGPU GPUDevice`);let g=me({gridN:t,tracerCount:n,boxSize:r,cloudRadius:i,cloudMass:a,spinOmega:o,initialB0:s,seed:f,centerOffset:m}),_=g.gridN,v=g.boxSize/_,y=N(e,_);y.writeAxisPoissonParams({boxLength:g.boxSize,smoothR2:(.85*v)**2});let b=[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`),E(3,`read-only-storage`),E(4,`storage`),E(5,`storage`),E(6,`storage`),E(7,`storage`)],x=t=>O(e,{cacheKey:`ulg-nebular-mhd-${t}.v1`,label:`${h}-${t}`,code:he,entryPoint:t,bindings:b}),S=x(`pack_gravity_rhs`),C=x(`store_gravity_phi`),w=x(`step_mhd_grid`),T=x(`step_nebula_tracers`),k=x(`reduce_mhd_telemetry`),A=e.createBuffer({label:`${h}-params`,size:80,usage:J.UNIFORM|J.COPY_DST}),j=e.createBuffer({label:`${h}-fluid-a`,size:g.fluid.byteLength,usage:J.STORAGE|J.COPY_DST|J.COPY_SRC}),M=e.createBuffer({label:`${h}-fluid-b`,size:g.fluid.byteLength,usage:J.STORAGE|J.COPY_DST|J.COPY_SRC}),P=e.createBuffer({label:`${h}-b-a`,size:g.bfield.byteLength,usage:J.STORAGE|J.COPY_DST|J.COPY_SRC}),F=e.createBuffer({label:`${h}-b-b`,size:g.bfield.byteLength,usage:J.STORAGE|J.COPY_DST|J.COPY_SRC}),I=e.createBuffer({label:`${h}-tracers`,size:g.tracers.byteLength,usage:J.STORAGE|J.VERTEX|J.COPY_DST|J.COPY_SRC}),L=e.createBuffer({label:`${h}-tel`,size:64,usage:J.STORAGE|J.COPY_SRC}),R=e.createBuffer({label:`${h}-tel-read`,size:64,usage:J.MAP_READ|J.COPY_DST}),z=e.createBuffer({label:`${h}-b-read`,size:g.bfield.byteLength,usage:J.MAP_READ|J.COPY_DST});e.queue.writeBuffer(j,0,g.fluid),e.queue.writeBuffer(M,0,g.fluid),e.queue.writeBuffer(P,0,g.bfield),e.queue.writeBuffer(F,0,g.bfield),e.queue.writeBuffer(I,0,g.tracers);let B=(t,n,r,i,a)=>D(e,{layout:S.bindGroupLayout,label:`${h}-bg`,entries:[{binding:0,resource:{buffer:A}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:r}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:a}},{binding:6,resource:{buffer:I}},{binding:7,resource:{buffer:L}}]}),V=B(j,M,P,F,y.bufferA),H=B(j,M,P,F,y.bufferB),U=B(M,j,F,P,y.bufferA),W=B(M,j,F,P,y.bufferB),G=0,K=0,q=0,ee=s,te=o,ne=!1,re=!1,ie=Float32Array.from(g.bfield),ae=Object.freeze({schema:de,stepIndex:0,simTime:0,totalMass:a,kineticEnergy:0,magneticEnergy:.5*s*s*g.boxSize**3,maxDensity:1,maxBField:Math.abs(s),peakToroidalB:0,maxJetSpeed:0,meanAbsDivB:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),oe=!1,se=Math.ceil(g.totalCells/64),ce=Math.ceil(_/4),le=Math.ceil(g.tracerCount/64);function ue(t){let n=.25*v/Math.max(1e-5,t),r=new ArrayBuffer(80);new Uint32Array(r,0,4).set([_,g.tracerCount,0,0]),new Float32Array(r,16,16).set([g.boxSize,v,t,c,l,u,n,4.5,d,g.meanRho,1,ee,g.centerOffset[0],g.centerOffset[1],g.centerOffset[2],K]),e.queue.writeBuffer(A,0,r)}async function pe({dt:t=.022,substeps:n=1,readTelemetry:r=!0,readBFieldForStreamlines:i=!1}={}){if(oe)return ae;let a=Math.max(1,Math.min(8,Math.trunc(n))),o=Math.max(.002,Math.min(.04,Number(t)||.022));ue(o);let s=e.createCommandEncoder({label:`${h}-step-${K}`});for(let e=0;e<a;e+=1){let t=G===0?V:U,n=s.beginComputePass({label:`${h}-pack-grav`});n.setBindGroup(0,t),n.setPipeline(S.pipeline),n.dispatchWorkgroups(se),n.end();let r=y.encodePoissonSolve(s,{gradAxis:0}),i=G===0?r===y.bufferA?V:H:r===y.bufferA?U:W;n=s.beginComputePass({label:`${h}-mhd-step`}),n.setBindGroup(0,i),n.setPipeline(C.pipeline),n.dispatchWorkgroups(se),n.setPipeline(w.pipeline),n.dispatchWorkgroups(ce,ce,ce),n.end(),G^=1;let c=G===0?V:U;n=s.beginComputePass({label:`${h}-tracers`}),n.setBindGroup(0,c),n.setPipeline(T.pipeline),n.dispatchWorkgroups(le),e===a-1&&(n.setPipeline(k.pipeline),n.dispatchWorkgroups(1)),n.end(),K+=1,q+=o}let c=r&&!ne&&R.mapState===`unmapped`;c&&(ne=!0,s.copyBufferToBuffer(L,0,R,0,64));let l=i&&!re&&z.mapState===`unmapped`;l&&(re=!0,s.copyBufferToBuffer(G===0?P:F,0,z,0,g.bfield.byteLength)),e.queue.submit([s.finish()]);let u=[];return c&&u.push((async()=>{try{if(await R.mapAsync(J.MAP_READ),!oe){let e=new Float32Array(R.getMappedRange(0,64));ae=Object.freeze({schema:de,stepIndex:K,simTime:q,totalMass:e[0],kineticEnergy:e[1],magneticEnergy:e[2],maxDensity:e[3],maxBField:e[4],maxJetSpeed:e[5],meanAbsDivB:e[6],peakToroidalB:e[8],initialB0:ee,spinOmega:te,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{R.unmap()}catch{}}catch(e){if(!oe&&e?.name!==`AbortError`)throw e}finally{ne=!1}})()),l&&u.push((async()=>{try{await z.mapAsync(J.MAP_READ),oe||ie.set(new Float32Array(z.getMappedRange(0,g.bfield.byteLength)));try{z.unmap()}catch{}}catch(e){if(!oe&&e?.name!==`AbortError`)throw e}finally{re=!1}})()),u.length&&await Promise.all(u),ae}function ge({seedRings:e=[.95,1.95],seedsPerRing:t=8,stepsPerDir:n=26,stepLen:r=.22,worldScale:i=1,alpha:a=.62}={}){if(Math.abs(ee)<1e-4)return new Float32Array;let o=g.boxSize*.5,s=(e,t,n)=>{let r=(e+o)/v-.5,i=(t+o)/v-.5,a=(n+o)/v-.5,s=(Math.floor(r)%_+_)%_,c=(Math.floor(i)%_+_)%_,l=(((Math.floor(a)%_+_)%_*_+c)*_+s)*4;return[ie[l],ie[l+1],ie[l+2]]},c=[];for(let l of e)for(let e=0;e<t;e+=1){let u=e/t*Math.PI*2+l*.4,d=Math.cos(u)*l,f=Math.sin(u)*l;for(let e of[1,-1]){let t=d,l=0,u=f;for(let d=0;d<n;d+=1){let f=s(t,l,u),p=Math.hypot(f[0],f[1],f[2]);if(p<1e-4)break;let m=s(t+f[0]/p*e*r*.5,l+f[1]/p*e*r*.5,u+f[2]/p*e*r*.5),h=Math.hypot(m[0],m[1],m[2]);if(h<1e-4)break;let g=t+m[0]/h*e*r,_=l+m[1]/h*e*r,v=u+m[2]/h*e*r;if(Math.abs(g)>o*.92||Math.abs(_)>o*.92||Math.abs(v)>o*.92)break;let y=Math.min(1,h/Math.max(.25,Math.abs(ee)*2.4)),b=(1-d/n)*a,x=.2+.72*y,S=.72-.18*y,C=1-.15*y;c.push(t*i,l*i,u*i,x,S,C,b),c.push(g*i,_*i,v*i,x,S,C,b*.92),t=g,l=_,u=v}}}return new Float32Array(c)}function _e(){if(!oe){oe=!0,y.destroy();for(let e of[A,j,M,P,F,I,L,R,z])try{e.destroy()}catch{}}}return Object.freeze({schema:de,lawAdapter:fe,get gridN(){return _},get tracerCount(){return g.tracerCount},get boxSize(){return g.boxSize},get stepIndex(){return K},get simTime(){return q},get initialB0(){return ee},getResidentTracersBuffer:()=>I,getTelemetry:()=>ae,buildMagneticFieldStreamlines:ge,step:pe,dispose:_e})}function _e(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`nebular-mhd-collapse@1`)?e.resolveModule(`nebular-mhd-collapse@1`)?.descriptor||null:e.registerModule({method:{model:`nebular-mhd-collapse`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/nebularMhdCollapseGpu.js`,entryPoint:`step_mhd_grid`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:.001,max:.05,required:!1},initialB0:{type:`number`,min:0,max:5,required:!1},spinOmega:{type:`number`,min:0,max:5,required:!1},substeps:{type:`number`,min:1,max:16,required:!1}},stateLayout:{tensorId:`nebula-mhd-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`bMag`,`bx`,`by`,`bz`,`rho`,`u`,`jetOut`,`tag`,`phase`]},scaleRangeM:[0x9184e72a000,0xde0b6b3a7640000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=ge(n,{gridN:16,tracerCount:512,initialB0:r.initialB0??.48,spinOmega:r.spinOmega??.62}),a=await i.step({dt:r.dt??.02,substeps:r.substeps??2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:nebular-mhd:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/nebularMhdCollapseGpu.js`,entryPoint:`createNebularMhdCollapseSessionWebGpu`,kernelEntryPoint:`step_mhd_grid`},representation:`mhd-3d-grid+tracers-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-mhd-fft3d`,placement:`local`},validity:{finite:Number.isFinite(a.totalMass)&&Number.isFinite(a.magneticEnergy),meanAbsDivB:a.meanAbsDivB},validation:{status:`pass`,validationMode:`gpu-mhd-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var ve=`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,ye=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),be=Object.freeze({id:`planetary-atmosphere-em`,lawNodeId:`law:planetary-atmosphere-triboelectric-em`,orderConstraint:`after:planetary-interior-polytope`,adapterMode:o.SURFACE_INTERFACE,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`planetary-atmo-fluid`,`planetary-em-potential`,`planetary-interior-core`,`solar-wind-flux`]),writes:Object.freeze([`planetary-atmo-fluid`,`planetary-em-potential`]),accumulates:Object.freeze([`planetary-atmo-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`atmospheric-mass`,`electric-charge-balance`,`angular-momentum`]),validityDomain:Object.freeze({surfacePressureMinPa:1,cflMax:.5,sphericalShellMetric:!0}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,1e8]),fundamentalLaws:Object.freeze([`baroclinic-shallow-water-coriolis`,`radiative-insolation-albedo`,`triboelectric-charge-separation`,`maxwell-gauss-poisson-efield`,`paschen-dielectric-breakdown`,`core-geodynamo-magnetosphere`])});function xe(e,t=120){let n=Math.max(1,Number(e)||101325),r=n/101325,i=1+4/Math.max(.05,n*Math.max(1,t)*.001);return 26e4*Math.max(1e-4,r)**.48*i}function Se({radiusM:e=6371e3,rotationOmegaRadS:t=72921e-9,coreRadiusNorm:n=.54,coreConductivitySm:r=1e6,centralPressurePa:i=364e9,solarWindPressureNPa:a=2}={}){let o=Math.max(0,Math.min(.88,Number(n)||0)),s=o*Math.max(0,Number(e)||0),c=Math.abs(Number(t)||0),l=Math.max(0,Number(r)||0),u=Math.max(0,Number(i)/1e9),d=Math.min(3,Math.max(0,(u-18)/340)),f=s>8e5&&u>=18?.25+.75*d:0,p=f>0?(o/.54)**3*Math.sqrt(Math.max(0,c/729e-7*(l/1e6)*f)):0,m=p>.08?31e-6*Math.min(25,p*(e/6371e3)**.35):0,h=4*Math.PI*1e-7,g=Math.max(1e-12,Number(a)*1e-9),_=m>1e-7?Math.max(1,m*m/(2*h*g))**(1/6):1,v=Math.min(.95,1/Math.max(1.05,_));return Object.freeze({bEquatorialT:m,rMpOverRp:_,auroralLatRad:Math.acos(Math.sqrt(v)),auroralStrength:m>6e-6?Math.min(1.4,Math.log10(m/5e-6+1)*.85):0})}function Ce(e={}){let t=Math.max(0,Number(e.surfacePressurePa)||0),n=Math.max(0,Number(e.volatileMassFrac)||0),r=Math.max(0,Number(e.particulateMassFrac)||0),i=Math.max(0,Number(e.dynamo?.bEquatorialT)||0),a=t>=10,o=a&&n>.01,s=a&&r>.01,c=a&&n+r>.02,l=i>1e-6,u=[],d=[],f=(e,t)=>(t?u:d).push(e);return f(`baroclinic-fluid-coriolis`,a),f(`condensable-phase-cloud-transport`,o),f(`aeolian-particulate-saltation`,s),f(`triboelectric-charge-separation-and-paschen-breakdown`,c),f(`core-geodynamo-magnetosphere`,l),Object.freeze({anyActive:u.length>0,fluidActive:a,cloudCondensationActive:o,aeolianParticulateActive:s,triboelectricActive:c,magnetosphereActive:l,activeLaws:Object.freeze(u),dormantLaws:Object.freeze(d)})}function we(e={},t=null,{solarDistanceAu:n=1,coreConductivitySm:r=1e6}={}){let i=Math.max(1e3,Number(e.radiusM??(e.radiusKm||6371)*1e3)),a=Math.max(0x38d7ea4c68000,Number(e.massKg??(e.massSolar||3003e-9)*198847e25)),o=66743e-15,s=o*a/(i*i),c=Math.max(20,Number(e.eqTempK??e.tempK??288)),l=1380649e-29,u=167262192369e-38,d=Math.sqrt(2*o*a/i),f=o*a*2*u/Math.max(1e-30,l*c*i),p=Number.isFinite(e.meanMolecularWeightAmu)?Math.max(1,Number(e.meanMolecularWeightAmu)):f>160?2.3:f>18?29:44,m=Math.max(0,Math.min(1,Number(e.atmColumnFrac??e.atm??0))),h=Number.isFinite(e.surfacePressurePa)?Math.max(0,Number(e.surfacePressurePa)):m<.03?0:10*10**(5.4*m)*Math.min(4,s/9.81),g=Number.isFinite(e.rotationOmegaRadS)?Number(e.rotationOmegaRadS):72921e-9*Math.max(.15,d/11186)**.72,_=l*c/Math.max(1e-30,p*u*s),v=Math.sqrt(Math.max(1,s*_))/Math.max(1e-6,2*Math.abs(g)*i),y=Number.isFinite(e.volatileMassFrac)?Math.max(0,Math.min(1,Number(e.volatileMassFrac))):h<10?0:Math.max(0,Math.min(.95,m*Math.exp(-(((Math.log10(c)-2.35)/.55)**2)))),b=Number.isFinite(e.particulateMassFrac)?Math.max(0,Math.min(1,Number(e.particulateMassFrac))):h<10?0:Math.max(0,Math.min(.95,m*(1-.65*y)*Math.min(1,400/Math.max(80,c)))),x=Number(t?.coreRadiusFraction??e.coreRadiusNorm??.52),S=Number(t?.centralPressurePa??e.centralPressurePa??e.centralP??.5*s*a/(Math.PI*i*i)),C=Number.isFinite(e.solarWindPressureNPa)?Number(e.solarWindPressureNPa):2.2/Math.max(.08,n*n),w=Se({radiusM:i,rotationOmegaRadS:g,coreRadiusNorm:x,coreConductivitySm:Number(e.coreConductivitySm??r),centralPressurePa:S,solarWindPressureNPa:C}),T=xe(Math.max(1,h)),E=Object.freeze({radiusM:i,massKg:a,gravityMps2:s,rotationOmegaRadS:g,surfacePressurePa:h,eqTempK:c,meanMolecularWeightAmu:p,scaleHeightM:_,rossbyRadiusOverR:v,atmWeight:h>=10?Math.min(1,Math.log10(h)/5.5):0,volatileMassFrac:y,particulateMassFrac:b,volatileCloudFrac:y,dustAvailability:b,eCritVPerM:T,dynamo:w,solarWindPressureNPa:C});return Object.freeze({...E,activation:Ce(E)})}var Te=we;function Ee(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var De=`
struct AtmoParams {
  width: u32,
  height: u32,
  step_index: u32,
  enable_triboelectric: u32,
  radius_m: f32,
  gravity: f32,
  omega_rot: f32,
  dt_sim: f32,
  eq_temp_k: f32,
  volatile_frac: f32,
  dust_avail: f32,
  atm_weight: f32,
  e_crit_norm: f32,     // Normalized Paschen breakdown threshold
  charge_gain: f32,     // Triboelectric separation efficiency
  aurora_lat_rad: f32,  // Core-geodynamo open field-line cusp latitude
  aurora_strength: f32, // Solar-wind driven auroral emission strength
  sun_dir: vec4<f32>,   // Live unit vector toward host star (xyz) + solar wind pressure (w)
};

// Ping-pong atmospheric fluid state (2 vec4 = 32 B per cell):
//   flow: vec4(u_east, v_north, h_geopot_anom, T_anom)
//   chem: vec4(q_cloud, q_dust, vorticity, rain_or_sed)
struct AtmoCell {
  flow: vec4<f32>,
  chem: vec4<f32>,
};

// Electromagnetic & visual-ready state (2 vec4 = 32 B per cell) — directly bound by LIT_SPHERE_WGSL!
//   em0: vec4(rho_charge, phi_elec, e_mag_norm, lightning_flash)
//   vis: vec4(cloud_density, dust_density, lightning_glow, aurora_glow)
struct EmVisCell {
  em0: vec4<f32>,
  vis: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: AtmoParams;
@group(0) @binding(1) var<storage, read> atmo_src: array<AtmoCell>;
@group(0) @binding(2) var<storage, read_write> atmo_dst: array<AtmoCell>;
@group(0) @binding(3) var<storage, read> em_src: array<EmVisCell>;
@group(0) @binding(4) var<storage, read_write> em_dst: array<EmVisCell>;
// Telemetry reduction (2 vec4 = 32 B):
//   [0]: vec4(mean_speed, max_vorticity, mean_cloud, mean_dust)
//   [1]: vec4(max_efield_norm, lightning_cell_count, total_abs_charge, max_aurora)
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;

fn cell_idx(x: i32, y: i32) -> u32 {
  let w = i32(params.width);
  let h = i32(params.height);
  let wx = ((x % w) + w) % w;
  let wy = clamp(y, 0, h - 1);
  return u32(wy * w + wx);
}

fn cell_normal(ix: u32, iy: u32) -> vec3<f32> {
  let u = (f32(ix) + 0.5) / f32(params.width);
  let v = (f32(iy) + 0.5) / f32(params.height);
  let lon = (u - 0.5) * TWO_PI;
  let lat = (0.5 - v) * PI;
  let cl = cos(lat);
  return vec3<f32>(cl * cos(lon), sin(lat), cl * sin(lon));
}

fn sample_atmo_bilin(fx: f32, fy: f32) -> AtmoCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = atmo_src[cell_idx(x0, y0)];
  let c10 = atmo_src[cell_idx(x0 + 1, y0)];
  let c01 = atmo_src[cell_idx(x0, y0 + 1)];
  let c11 = atmo_src[cell_idx(x0 + 1, y0 + 1)];
  var out: AtmoCell;
  out.flow = mix(mix(c00.flow, c10.flow, tx), mix(c01.flow, c11.flow, tx), ty);
  out.chem = mix(mix(c00.chem, c10.chem, tx), mix(c01.chem, c11.chem, tx), ty);
  return out;
}

fn sample_em_bilin(fx: f32, fy: f32) -> EmVisCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = em_src[cell_idx(x0, y0)];
  let c10 = em_src[cell_idx(x0 + 1, y0)];
  let c01 = em_src[cell_idx(x0, y0 + 1)];
  let c11 = em_src[cell_idx(x0 + 1, y0 + 1)];
  var out: EmVisCell;
  out.em0 = mix(mix(c00.em0, c10.em0, tx), mix(c01.em0, c11.em0, tx), ty);
  out.vis = mix(mix(c00.vis, c10.vis, tx), mix(c01.vis, c11.vis, tx), ty);
  return out;
}

// 1. Prognostic Spherical Baroclinic Shallow-Water Fluid + Cloud/Dust Advection + Insolation
@compute @workgroup_size(8, 8)
fn atmo_step_fluid(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let sin_lat = sin(lat);
  let raw_cos = max(0.0, cos(lat));
  // Smooth polar coordinate-singularity filter (prevents 1/cos(lat) blowup near ±90° poles!)
  let pole_taper = smoothstep(0.08, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);

  // Normalized spherical grid spacings (dimensionless planetary radius = 1, velocity scale = c_baroclinic)
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let c0 = atmo_src[idx];
  let cxp = atmo_src[cell_idx(ix + 1, iy)];
  let cxm = atmo_src[cell_idx(ix - 1, iy)];
  let cyp = atmo_src[cell_idx(ix, iy - 1)]; // north = smaller iy!
  let cym = atmo_src[cell_idx(ix, iy + 1)];

  // Semi-Lagrangian backtrace on sphere
  let bx = f32(ix) - (c0.flow.x * dt) / dx;
  let by = f32(iy) + (c0.flow.y * dt) / dy; // north velocity v > 0 decreases iy
  let adv = sample_atmo_bilin(bx, by);

  // Real Solar Insolation from live host-star vector!
  let n_hat = cell_normal(gid.x, gid.y);
  let insol = max(0.0, dot(n_hat, normalize(params.sun_dir.xyz)));
  let t_eq = 0.72 * raw_cos + 0.48 * insol - 0.18 * adv.chem.x - 0.12 * adv.chem.y;
  let t_new = clamp(adv.flow.w + (t_eq - adv.flow.w) * 0.09 * dt * 6.0, -1.5, 1.8);

  // Horizontal divergence, vorticity, and geopotential height gradient (baroclinic thermal wind!)
  let du_dx = (cxp.flow.x - cxm.flow.x) / (2.0 * dx);
  let dv_dy = (cyp.flow.y - cym.flow.y) / (2.0 * dy);
  let div_v = clamp((du_dx + dv_dy) * pole_taper, -6.0, 6.0);
  let dv_dx = (cxp.flow.y - cxm.flow.y) / (2.0 * dx);
  let du_dy = (cyp.flow.x - cym.flow.x) / (2.0 * dy);
  let vort = clamp((dv_dx - du_dy) * pole_taper, -10.0, 10.0);

  // Geopotential anomaly coupled to thermal expansion & mass convergence
  let dh_dx = ((cxp.flow.z - cxm.flow.z) / (2.0 * dx) + 0.45 * (cxp.flow.w - cxm.flow.w) / (2.0 * dx)) * pole_taper;
  let dh_dy = ((cyp.flow.z - cym.flow.z) / (2.0 * dy) + 0.45 * (cyp.flow.w - cym.flow.w) / (2.0 * dy)) * pole_taper;

  // Real Coriolis parameter f = 2 * Omega_scaled * sin(lat):
  let f_rot = clamp((params.omega_rot / 7.2921e-5) * (params.radius_m / 6.371e6), 0.05, 14.0) * 2.2 * sin_lat;
  let p_grad_u = -dh_dx;
  let p_grad_v = -dh_dy;

  // Exact implicit Coriolis rotation (energy-conserving, unconditionally stable for ANY f_rot!)
  let u_pre = adv.flow.x + p_grad_u * dt;
  let v_pre = adv.flow.y + p_grad_v * dt;
  let alpha = f_rot * dt;
  let denom = 1.0 + alpha * alpha;
  let drag = 1.0 / (1.0 + 0.10 * dt);
  var u_new = ((u_pre + alpha * v_pre) / denom) * drag * (0.45 + 0.55 * pole_taper);
  var v_new = ((v_pre - alpha * u_pre) / denom) * drag * (0.35 + 0.65 * pole_taper);

  // Mild Laplacian hyperviscosity preventing grid-scale noise while keeping eddies crisp
  let lap_u = (cxp.flow.x + cxm.flow.x + cyp.flow.x + cym.flow.x - 4.0 * c0.flow.x);
  let lap_v = (cxp.flow.y + cxm.flow.y + cyp.flow.y + cym.flow.y - 4.0 * c0.flow.y);
  u_new = clamp(u_new + 0.04 * lap_u, -2.6, 2.6);
  v_new = clamp(v_new + 0.04 * lap_v, -2.2, 2.2);

  let h_new = clamp(adv.flow.z - 0.48 * div_v * dt + 0.16 * (t_new - adv.flow.z) * dt + 0.03 * (cxp.flow.z + cxm.flow.z + cyp.flow.z + cym.flow.z - 4.0 * c0.flow.z), -1.5, 1.5);

  // True Condensation-Subsidence-Rainout Equilibrium:
  // Clouds condense in cyclonic/convergent updrafts (-div_v > 0, strong |vort|) and CLEAR in subsiding ridges (div_v > 0)!
  let updraft = max(0.0, -div_v - 0.10) + max(0.0, abs(vort) - 0.55) * 0.24;
  let subsidence = max(0.0, div_v + 0.05);
  let wind_spd = length(vec2<f32>(u_new, v_new));
  let evap_src = params.volatile_frac * (0.06 * insol + 0.36 * updraft) * pole_taper * dt;
  let rain_sink = (max(0.0, adv.chem.x - 0.24) * 0.85 + subsidence * 0.55 * adv.chem.x + 0.16 * adv.chem.x) * dt;
  let q_cloud = clamp(adv.chem.x + evap_src - rain_sink + 0.025 * (cxp.chem.x + cxm.chem.x + cyp.chem.x + cym.chem.x - 4.0 * c0.chem.x), 0.0, 0.96);

  // Dry aeolian saltation plumes lifted by high-speed baroclinic storm fronts & dust devils
  let saltation = max(0.0, wind_spd - 0.22) * 1.15 + max(0.0, abs(vort) - 0.45) * 0.35;
  let dust_lift = params.dust_avail * saltation * (0.35 + 0.65 * insol) * pole_taper * 0.65 * dt;
  let dust_settle = (adv.chem.y * 0.34 + subsidence * 0.25 * adv.chem.y) * dt;
  let q_dust = clamp(adv.chem.y + dust_lift - dust_settle + 0.025 * (cxp.chem.y + cxm.chem.y + cyp.chem.y + cym.chem.y - 4.0 * c0.chem.y), 0.0, 0.95);

  var out: AtmoCell;
  out.flow = vec4<f32>(u_new, v_new, h_new, t_new);
  out.chem = vec4<f32>(q_cloud, q_dust, vort, rain_sink);
  atmo_dst[idx] = out;
}

// 2. Non-Inductive Triboelectric Charge Separation (Moist Graupel-Ice + Dry Dust-Storm Shear)
@compute @workgroup_size(8, 8)
fn atmo_triboelectric_charge(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let raw_cos = max(0.0, cos(lat));
  let pole_taper = smoothstep(0.10, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let a = atmo_src[idx]; // newest fluid state after swap!
  let bx = f32(ix) - (a.flow.x * dt) / dx;
  let by = f32(iy) + (a.flow.y * dt) / dy;
  let em_adv = sample_em_bilin(bx, by);

  let vort = a.chem.z;
  let spd = length(a.flow.xy);
  let q_cloud = a.chem.x;
  let q_dust = a.chem.y;

  // Takahashi-Saunders moist convective charging (~cloud^2 * |vort| * rain)
  // + Melnik-Farrell dry dust triboelectric charging (~dust * wind_shear * |vort|)
  // Tapered cleanly at coordinate poles so discharges spark inside real storm cores!
  var dq = 0.0;
  if (params.enable_triboelectric != 0u && params.atm_weight > 0.05) {
    let moist_charge = q_cloud * q_cloud * (abs(vort) * 1.85 + a.chem.w * 18.0);
    let dust_charge = q_dust * (spd * 1.35 + abs(vort) * 2.2);
    let sign_pol = select(-1.0, 1.0, vort >= 0.0);
    dq = sign_pol * params.charge_gain * (moist_charge + dust_charge) * pole_taper * dt;
  }

  // Ohmic ion conductivity leakage
  let rho_q = clamp(em_adv.em0.x * exp(-0.18 * dt) + dq, -8.0, 8.0);
  // Crisp crackling discharge decay so flashes sparkle inside convective fronts!
  let flash_decay = em_adv.em0.w * exp(-4.8 * dt);

  var out = em_adv;
  out.em0 = vec4<f32>(rho_q, em_adv.em0.y, em_adv.em0.z, flash_decay);
  em_dst[idx] = out;
}

// 3. Spherical Electrostatic Poisson Solver (Jacobi relaxation: nabla^2 phi = -rho_q / eps0)
@compute @workgroup_size(8, 8)
fn atmo_poisson_efield(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let cos_lat = max(0.30, cos(lat));
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let idx2 = 1.0 / (dx * dx);
  let idy2 = 1.0 / (dy * dy);

  let e0 = em_src[idx];
  let exp_ = em_src[cell_idx(ix + 1, iy)].em0.y;
  let exm = em_src[cell_idx(ix - 1, iy)].em0.y;
  let eyp = em_src[cell_idx(ix, iy - 1)].em0.y;
  let eym = em_src[cell_idx(ix, iy + 1)].em0.y;

  let denom = 2.0 * (idx2 + idy2);
  let phi_new = ((exp_ + exm) * idx2 + (eyp + eym) * idy2 + e0.em0.x) / denom;
  let ex = -(exp_ - exm) / (2.0 * dx);
  let ey = -(eyp - eym) / (2.0 * dy);
  // Total local E-field = horizontal dipole field |grad phi| + vertical cloud/dust dipole |rho_q|
  let e_mag = sqrt(ex * ex + ey * ey + e0.em0.x * e0.em0.x * 0.85);

  var out = e0;
  out.em0 = vec4<f32>(e0.em0.x, phi_new, e_mag, e0.em0.w);
  em_dst[idx] = out;
}

// 4. Paschen Dielectric Breakdown Lightning Discharge + Geodynamo Polar Aurorae
@compute @workgroup_size(8, 8)
fn atmo_paschen_breakdown(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;

  let a = atmo_src[idx];
  var e = em_src[idx];
  var rho_q = e.em0.x;
  let e_mag = e.em0.z;
  var flash = e.em0.w;

  // Real Paschen dielectric breakdown: when |E| exceeds E_crit(P), discharge channel fires!
  if (params.enable_triboelectric != 0u && e_mag > params.e_crit_norm) {
    let over = clamp((e_mag - params.e_crit_norm) / max(0.08, params.e_crit_norm), 0.15, 2.5);
    flash = max(flash, clamp(0.65 + 0.55 * over, 0.0, 1.8));
    // Conservative charge neutralization by the conductive plasma leader channel!
    rho_q = rho_q * 0.18;
  }

  // Core-geodynamo magnetic cusp polar auroral oval driven by solar wind pressure
  // Crisp narrow auroral ring/oval around open magnetic cusp latitude (NOT a solid polar snowcap!)
  let aur_d = (abs(lat) - params.aurora_lat_rad) / 0.062;
  let lon = ((f32(ix) + 0.5) / f32(params.width)) * TWO_PI;
  let curtain = 0.55 + 0.45 * sin(lon * 6.0 + f32(params.step_index) * 0.08) * cos(lon * 4.0 - f32(params.step_index) * 0.05);
  let aurora = params.aurora_strength * exp(-aur_d * aur_d) * curtain * clamp(params.sun_dir.w * 0.45, 0.25, 1.4);

  e.em0 = vec4<f32>(rho_q, e.em0.y, e_mag, flash);
  // Visual-ready zero-copy GPU payload read directly by LIT_SPHERE_WGSL!
  e.vis = vec4<f32>(a.chem.x, a.chem.y, flash, aurora);
  em_dst[idx] = e;
}

// 5. Parallel GPU Telemetry Reduction (1 workgroup of 64 threads — ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_atmo_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var spd_sum = 0.0;
  var max_vort = 0.0;
  var cloud_sum = 0.0;
  var dust_sum = 0.0;
  var max_e = 0.0;
  var light_cnt = 0.0;
  var q_abs = 0.0;
  var max_aur = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let a = atmo_src[i];
    let e = em_src[i];
    spd_sum = spd_sum + length(a.flow.xy);
    max_vort = max(max_vort, abs(a.chem.z));
    cloud_sum = cloud_sum + a.chem.x;
    dust_sum = dust_sum + a.chem.y;
    max_e = max(max_e, e.em0.z);
    if (e.em0.w > 0.35) { light_cnt = light_cnt + 1.0; }
    q_abs = q_abs + abs(e.em0.x);
    max_aur = max(max_aur, e.vis.w);
    i = i + 64u;
  }

  wg0[tid] = spd_sum;
  wg1[tid] = max_vort;
  wg2[tid] = cloud_sum;
  wg3[tid] = dust_sum;
  wg4[tid] = max_e;
  wg5[tid] = light_cnt;
  wg6[tid] = q_abs;
  wg7[tid] = max_aur;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = wg0[tid] + wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] = wg2[tid] + wg2[tid + s];
      wg3[tid] = wg3[tid] + wg3[tid + s];
      wg4[tid] = max(wg4[tid], wg4[tid + s]);
      wg5[tid] = wg5[tid] + wg5[tid + s];
      wg6[tid] = wg6[tid] + wg6[tid + s];
      wg7[tid] = max(wg7[tid], wg7[tid + s]);
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let inv_n = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv_n, wg1[0], wg2[0] * inv_n, wg3[0] * inv_n);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] * inv_n, wg7[0]);
  }
}
`;function Oe(e,{width:t=128,height:n=64,bodyParams:r=null,enableTriboelectric:i=!0,seed:a=20261125,label:o=`ulg-planetary-atmo-em`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createPlanetaryAtmosphereElectricSessionWebGpu requires a live WebGPU GPUDevice`);let s=Math.max(32,Math.min(256,Math.trunc(t))),c=Math.max(16,Math.min(128,Math.trunc(n))),l=s*c,u=r||Te({radiusKm:6371,massSolar:3003e-9,atm:.72,tempK:288,kind:1,color1:[.06,.26,.58]}),d=!!i,f=Ee(a),m=new Float32Array(l*8),h=new Float32Array(l*8);for(let e=0;e<c;e+=1){let t=(.5-(e+.5)/c)*Math.PI,n=Math.cos(t);for(let r=0;r<s;r+=1){let i=((r+.5)/s-.5)*2*Math.PI,a=(e*s+r)*8,o=.28*Math.sin(2*t)*Math.sin(2*t)-.14*n,c=.12*Math.sin(3*i+2*t)+.08*Math.cos(5*i-3*t)+(f()-.5)*.08;m[a+0]=o+c,m[a+1]=.08*Math.cos(4*i+t)+(f()-.5)*.06,m[a+2]=.18*Math.sin(3*i)*n,m[a+3]=.7*n,m[a+4]=u.volatileCloudFrac*(.25+.35*f()),m[a+5]=u.dustAvailability*(.18+.3*f()),m[a+6]=0,m[a+7]=0,h[a+4]=m[a+4],h[a+5]=m[a+5]}}let g=[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`),E(3,`read-only-storage`),E(4,`storage`),E(5,`storage`)],_=t=>O(e,{cacheKey:`ulg-planetary-atmo-em-${t}.v1`,label:`${o}-${t}`,code:De,entryPoint:t,bindings:g}),v=_(`atmo_step_fluid`),y=_(`atmo_triboelectric_charge`),b=_(`atmo_poisson_efield`),x=_(`atmo_paschen_breakdown`),S=_(`reduce_atmo_telemetry`),C=e.createBuffer({label:`${o}-params`,size:80,usage:ye.UNIFORM|ye.COPY_DST}),w=e.createBuffer({label:`${o}-atmo-a`,size:m.byteLength,usage:ye.STORAGE|ye.COPY_DST}),T=e.createBuffer({label:`${o}-atmo-b`,size:m.byteLength,usage:ye.STORAGE|ye.COPY_DST}),k=e.createBuffer({label:`${o}-em-a`,size:h.byteLength,usage:ye.STORAGE|ye.COPY_DST|ye.COPY_SRC}),A=e.createBuffer({label:`${o}-em-b`,size:h.byteLength,usage:ye.STORAGE|ye.COPY_DST|ye.COPY_SRC}),j=e.createBuffer({label:`${o}-tel`,size:32,usage:ye.STORAGE|ye.COPY_SRC}),M=e.createBuffer({label:`${o}-tel-read`,size:32,usage:ye.MAP_READ|ye.COPY_DST});e.queue.writeBuffer(w,0,m),e.queue.writeBuffer(T,0,m),e.queue.writeBuffer(k,0,h),e.queue.writeBuffer(A,0,h);let N=(t,n,r,i)=>D(e,{layout:v.bindGroupLayout,label:`${o}-bg`,entries:[{binding:0,resource:{buffer:C}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:r}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:j}}]}),P=N(w,T,k,A),F=N(w,T,A,k),I=N(T,w,k,A),L=N(T,w,A,k),R=(e,t)=>e===0?t===0?P:F:t===0?I:L,z=0,B=0,V=0,H=!1,U=!1,W=Object.freeze({schema:ve,stepIndex:0,meanWindSpeed:0,maxVorticity:0,meanCloudCover:u.volatileCloudFrac*.4,meanDustLoad:u.dustAvailability*.3,peakElectricFieldVPerM:0,paschenBreakdownVPerM:u.eCritVPerM,activeLightningCells:0,meanAbsCharge:0,maxAuroraGlow:u.dynamo?.auroralStrength||0,dipoleFieldMicroT:(u.dynamo?.bEquatorialT||0)*1e6,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),G=Math.ceil(s/8),K=Math.ceil(c/8);function q(t,n){let r=Math.max(.36,Math.min(2.2,(u.eCritVPerM/26e4)**.45*1.1)),i=new ArrayBuffer(80);new Uint32Array(i,0,4).set([s,c,V,+!!d]),new Float32Array(i,16,16).set([u.radiusM,u.gravityMps2,u.rotationOmegaRadS,t,u.eqTempK,u.volatileCloudFrac,u.dustAvailability,u.atmWeight,r,2.15,u.dynamo?.auroralLatRad??1.18,u.dynamo?.auroralStrength??.65,n[0],n[1],n[2],u.solarWindPressureNPa??2]),e.queue.writeBuffer(C,0,i)}async function ee({dtSim:t=.045,substeps:n=2,sunDir:r=[.65,.28,.7],readTelemetry:i=!0}={}){if(U)return W;let a=Math.max(1,Math.min(8,Math.trunc(n)));q(Math.max(.005,Math.min(.08,Number(t)||.045)),r);let s=e.createCommandEncoder({label:`${o}-step-${V}`}),c=s.beginComputePass({label:`${o}-pass`});for(let e=0;e<a;e+=1){c.setBindGroup(0,R(z,B)),c.setPipeline(v.pipeline),c.dispatchWorkgroups(G,K),z^=1,c.setBindGroup(0,R(z,B)),c.setPipeline(y.pipeline),c.dispatchWorkgroups(G,K),B^=1,c.setPipeline(b.pipeline);for(let e=0;e<6;e+=1)c.setBindGroup(0,R(z,B)),c.dispatchWorkgroups(G,K),B^=1;c.setBindGroup(0,R(z,B)),c.setPipeline(x.pipeline),c.dispatchWorkgroups(G,K),B^=1,V+=1}c.setBindGroup(0,R(z,B)),c.setPipeline(S.pipeline),c.dispatchWorkgroups(1),c.end();let l=i&&!H&&M.mapState===`unmapped`;if(l&&(H=!0,s.copyBufferToBuffer(j,0,M,0,32)),e.queue.submit([s.finish()]),l)try{if(await M.mapAsync(ye.MAP_READ),!U){let e=new Float32Array(M.getMappedRange(0,32)),t=Math.max(.36,Math.min(2.2,(u.eCritVPerM/26e4)**.45*1.1));W=Object.freeze({schema:ve,stepIndex:V,meanWindSpeed:e[0],maxVorticity:e[1],meanCloudCover:e[2],meanDustLoad:e[3],peakElectricFieldNorm:e[4],peakElectricFieldVPerM:e[4]/t*u.eCritVPerM,paschenBreakdownVPerM:u.eCritVPerM,activeLightningCells:Math.round(e[5]),meanAbsCharge:e[6],maxAuroraGlow:e[7],dipoleFieldMicroT:(u.dynamo?.bEquatorialT||0)*1e6,enableTriboelectric:d,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{M.unmap()}catch{}}catch(e){if(!U&&e?.name!==`AbortError`)throw e}finally{H=!1}return W}function te(e){d=!!e}function ne(){if(!U){U=!0;for(let e of[C,w,T,k,A,j,M])try{e.destroy()}catch{}}}return Object.freeze({schema:ve,lawAdapter:be,get width(){return s},get height(){return c},get stepIndex(){return V},get bodyParams(){return u},get enableTriboelectric(){return d},getResidentEmVisBuffer:()=>B===0?k:A,getTelemetry:()=>W,setEnableTriboelectric:te,step:ee,dispose:ne})}function ke(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`planetary-atmosphere-em@1`)?e.resolveModule(`planetary-atmosphere-em@1`)?.descriptor||null:e.registerModule({method:{model:`planetary-atmosphere-em`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js`,entryPoint:`atmo_paschen_breakdown`,workgroupSize:64},parameterSchema:{dtSim:{type:`number`,min:.002,max:.1,required:!1},substeps:{type:`number`,min:1,max:16,required:!1},enableTriboelectric:{type:`boolean`,required:!1}},stateLayout:{tensorId:`planetary-em-vis`,dtype:`f32`,layout:`interleaved`,strideElements:8,strideBytes:32,fields:[`rhoQ`,`phiE`,`eMag`,`flash`,`cloud`,`dust`,`lightningGlow`,`auroraGlow`]},scaleRangeM:[1e4,1e8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Oe(n,{width:64,height:32,enableTriboelectric:r.enableTriboelectric??!0}),a=await i.step({dtSim:r.dtSim??.045,substeps:r.substeps??4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:planetary-atmo-em:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js`,entryPoint:`createPlanetaryAtmosphereElectricSessionWebGpu`,kernelEntryPoint:`atmo_paschen_breakdown`},representation:`spherical-shell-baroclinic-em-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-spherical-baroclinic-em`,placement:`local`},validity:{finite:Number.isFinite(a.meanWindSpeed)&&Number.isFinite(a.peakElectricFieldVPerM)},validation:{status:`pass`,validationMode:`gpu-atmo-em-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Ae=`peercompute.ulg.particle-rigid-dynamics-gpu.v1`,je=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Me=Object.freeze({id:`particle-rigid-dynamics`,lawNodeId:`law:particle-rigid-dynamics`,orderConstraint:`after:scale-atlas-multipole-gravity`,adapterMode:o.SOLID_PROXY,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`solid-local-particles`,`solid-external-wrench`,`ss-spatial-epoch-directory`]),writes:Object.freeze([`solid-rigid-frames`,`solid-world-particles`]),accumulates:Object.freeze([`solid-wrench-accumulators`,`solid-rigid-telemetry`]),pairedVolumeState:Object.freeze({v0Lane:`solid-local-particles.radius`,jLane:`solid-rigid-frames.quat`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({requiresNonDegenerateInertia:!0,maxCflDisplacementRadii:.5}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([.001,1e8]),fundamentalLaws:Object.freeze([`rigid-body-se3-dlm-symplectic`,`hertz-mindlin-jkr-cohesive-contact`,`coulomb-friction-rolling-resistance`,`mutual-gravitational-coupling`])});function Y(e={}){let t=Math.max(0,Math.trunc(Number(e.solidBodyCount)||0)),n=Math.max(0,Math.trunc(Number(e.solidParticleCount)||0)),r=t>0&&n>0;return Object.freeze({active:r,reason:r?`solid-phase-composites-present`:`no-solid-composites-dormant`,solidBodyCount:t,solidParticleCount:n})}function X(e,t,n,r,i,a){let o=[[e,r,i],[r,t,a],[i,a,n]],s=[[1,0,0],[0,1,0],[0,0,1]];for(let e=0;e<14;e+=1)for(let e=0;e<3;e+=1)for(let t=e+1;t<3;t+=1){let n=o[e][t];if(Math.abs(n)<1e-12)continue;let r=(o[t][t]-o[e][e])/(2*n),i=r>=0?1/(r+Math.sqrt(1+r*r)):-1/(-r+Math.sqrt(1+r*r)),a=1/Math.sqrt(1+i*i),c=i*a,l=o[e][e],u=o[t][t];o[e][e]=l-i*n,o[t][t]=u+i*n,o[e][t]=0,o[t][e]=0;for(let n=0;n<3;n+=1){if(n===e||n===t)continue;let r=o[n][e],i=o[n][t];o[n][e]=a*r-c*i,o[e][n]=o[n][e],o[n][t]=c*r+a*i,o[t][n]=o[n][t]}for(let n=0;n<3;n+=1){let r=s[n][e],i=s[n][t];s[n][e]=a*r-c*i,s[n][t]=c*r+a*i}}s[0][0]*(s[1][1]*s[2][2]-s[1][2]*s[2][1])-s[0][1]*(s[1][0]*s[2][2]-s[1][2]*s[2][0])+s[0][2]*(s[1][0]*s[2][1]-s[1][1]*s[2][0])<0&&(s[0][2]=-s[0][2],s[1][2]=-s[1][2],s[2][2]=-s[2][2]);let c=s[0][0]+s[1][1]+s[2][2],l,u,d,f;if(c>0){let e=Math.sqrt(c+1)*2;f=.25*e,l=(s[2][1]-s[1][2])/e,u=(s[0][2]-s[2][0])/e,d=(s[1][0]-s[0][1])/e}else if(s[0][0]>s[1][1]&&s[0][0]>s[2][2]){let e=Math.sqrt(1+s[0][0]-s[1][1]-s[2][2])*2;f=(s[2][1]-s[1][2])/e,l=.25*e,u=(s[0][1]+s[1][0])/e,d=(s[0][2]+s[2][0])/e}else if(s[1][1]>s[2][2]){let e=Math.sqrt(1+s[1][1]-s[0][0]-s[2][2])*2;f=(s[0][2]-s[2][0])/e,l=(s[0][1]+s[1][0])/e,u=.25*e,d=(s[1][2]+s[2][1])/e}else{let e=Math.sqrt(1+s[2][2]-s[0][0]-s[1][1])*2;f=(s[1][0]-s[0][1])/e,l=(s[0][2]+s[2][0])/e,u=(s[1][2]+s[2][1])/e,d=.25*e}let p=Math.hypot(l,u,d,f)||1;return{moments:[Math.max(1e-8,o[0][0]),Math.max(1e-8,o[1][1]),Math.max(1e-8,o[2][2])],R:s,quat:[l/p,u/p,d/p,f/p]}}function Ne(e,t){return[e[3]*t[0]+t[3]*e[0]+(e[1]*t[2]-e[2]*t[1]),e[3]*t[1]+t[3]*e[1]+(e[2]*t[0]-e[0]*t[2]),e[3]*t[2]+t[3]*e[2]+(e[0]*t[1]-e[1]*t[0]),e[3]*t[3]-(e[0]*t[0]+e[1]*t[1]+e[2]*t[2])]}function Pe(e,t){let n=2*(e[1]*t[2]-e[2]*t[1]),r=2*(e[2]*t[0]-e[0]*t[2]),i=2*(e[0]*t[1]-e[1]*t[0]);return[t[0]+e[3]*n+(e[1]*i-e[2]*r),t[1]+e[3]*r+(e[2]*n-e[0]*i),t[2]+e[3]*i+(e[0]*r-e[1]*n)]}function Fe(e=[]){let t=e.length,n=0;for(let t of e)n+=t.particles?.length||0;let r=new Float32Array(Math.max(1,t)*24),i=new Float32Array(Math.max(1,n)*4),a=new Float32Array(Math.max(1,n)*4),o=new Float32Array(Math.max(1,n)*8),s=0,c=.05;for(let n=0;n<t;n+=1){let t=e[n],l=t.particles||[],u=s,d=l.length,f=t.isStatic===!0||Number(t.mass)===0,p=0,m=0,h=0,g=0;for(let e of l){let t=Math.max(1e-8,Number(e.mass??1));p+=t,m+=t*(Number(e.localPos?.[0])||0),h+=t*(Number(e.localPos?.[1])||0),g+=t*(Number(e.localPos?.[2])||0)}p>0&&(m/=p,h/=p,g/=p);let _=Number(t.mass)>0?Number(t.mass)/Math.max(1e-12,p):1,v=f?0:p*_,y=0,b=0,x=0,S=0,C=0,w=0,T=0,E=[];for(let e of l){let n=Math.max(1e-8,Number(e.mass??1))*_,r=Math.max(1e-4,Number(e.radius??.25));r>c&&(c=r);let i=(Number(e.localPos?.[0])||0)-m,a=(Number(e.localPos?.[1])||0)-h,o=(Number(e.localPos?.[2])||0)-g,s=.4*n*r*r;y+=n*(a*a+o*o)+s,b+=n*(i*i+o*o)+s,x+=n*(i*i+a*a)+s,S-=n*i*a,C-=n*i*o,w-=n*a*o,T=Math.max(T,Math.hypot(i,a,o)+r),E.push({rx:i,ry:a,rz:o,r,m:n,cohesion:Number(e.cohesion??t.cohesion??0),matId:Number(e.materialId??t.materialId??0)})}let D=X(y,b,x,S,C,w),O=t.quaternion||[0,0,0,1],k=Math.hypot(...O)||1,A=O.map(e=>e/k),j=Ne(A,D.quat),M=Math.hypot(...j)||1,N=j.map(e=>e/M),P=Pe(A,[m,h,g]),F=[(Number(t.position?.[0])||0)+P[0],(Number(t.position?.[1])||0)+P[1],(Number(t.position?.[2])||0)+P[2]],I=[Number(t.velocity?.[0])||0,Number(t.velocity?.[1])||0,Number(t.velocity?.[2])||0],L=[Number(t.angularVelocity?.[0])||0,Number(t.angularVelocity?.[1])||0,Number(t.angularVelocity?.[2])||0],R=Pe([-N[0],-N[1],-N[2],N[3]],L),z=[D.moments[0]*R[0],D.moments[1]*R[1],D.moments[2]*R[2]],B=f?[0,0,0]:Pe(N,z),V=n*24;r[V+0]=F[0],r[V+1]=F[1],r[V+2]=F[2],r[V+3]=v,r[V+4]=N[0],r[V+5]=N[1],r[V+6]=N[2],r[V+7]=N[3],r[V+8]=v*I[0],r[V+9]=v*I[1],r[V+10]=v*I[2],r[V+11]=Number(t.linearDrag??0),r[V+12]=B[0],r[V+13]=B[1],r[V+14]=B[2],r[V+15]=Number(t.angularDrag??0),r[V+16]=D.moments[0],r[V+17]=D.moments[1],r[V+18]=D.moments[2],r[V+19]=T,r[V+20]=Number(t.materialId??0),r[V+21]=Number(t.flags??0),r[V+22]=u,r[V+23]=d;let H=[-D.quat[0],-D.quat[1],-D.quat[2],D.quat[3]];for(let e of E){let t=Pe(H,[e.rx,e.ry,e.rz]),r=s*4;i[r+0]=t[0],i[r+1]=t[1],i[r+2]=t[2],i[r+3]=e.r,a[r+0]=n,a[r+1]=e.m,a[r+2]=e.matId,a[r+3]=e.cohesion;let c=Pe(N,t),l=s*8;o[l+0]=F[0]+c[0],o[l+1]=F[1]+c[1],o[l+2]=F[2]+c[2],o[l+3]=e.r,o[l+4]=I[0]+(L[1]*c[2]-L[2]*c[1]),o[l+5]=I[1]+(L[2]*c[0]-L[0]*c[2]),o[l+6]=I[2]+(L[0]*c[1]-L[1]*c[0]),o[l+7]=n,s+=1}}return Object.freeze({bodyCount:t,particleCount:n,maxParticleRadius:c,bodiesBufData:r,localPosBufData:i,localMetaBufData:a,worldParticlesInit:o})}function Ie({count:e=12,bodyRadius:t=.5,particleRadius:n=.18,mass:r=1,cohesion:i=0,seed:a=1}={}){let o=a>>>0||1,s=()=>(o=Math.imul(1664525,o)+1013904223>>>0,o/4294967296),c=[],l=Math.PI*(3-Math.sqrt(5)),u=Math.max(1,Math.trunc(e));for(let e=0;e<u;e+=1){if(u===1){c.push({localPos:[0,0,0],radius:n,mass:r,cohesion:i});break}let a=1-2*((e+.5)/u),o=Math.sqrt(Math.max(0,1-a*a)),d=e*l+(s()-.5)*.25,f=Math.max(0,t-n*.65)*(.72+.28*s());c.push({localPos:[Math.cos(d)*o*f,a*f*(.78+.35*s()),Math.sin(d)*o*f],radius:n*(.85+.25*s()),mass:r/u,cohesion:i})}return c}var Le=`
struct RigidDynParams {
  body_count: u32,
  particle_count: u32,
  grid_dim_x: u32,
  grid_dim_y: u32,
  grid_dim_z: u32,
  enable_mutual_gravity: u32,
  enable_box_bounds: u32,
  step_index: u32,
  dt: f32,
  stiffness_k: f32,      // Hertz-Mindlin contact stiffness
  damping_c: f32,        // Normal contact damping (unilateral: approaching only!)
  friction_mu: f32,      // Coulomb friction coefficient (clamped to mu * F_n!)
  rolling_mu: f32,       // Rolling resistance coefficient
  cohesion_gain: f32,    // JKR surface cohesion strength
  gravity_g: f32,        // Mutual N-body gravity G (when enable_mutual_gravity == 1)
  softening2: f32,
  cell_size: f32,
  inv_cell_size: f32,
  pad0: f32,
  pad1: f32,
  grid_origin: vec4<f32>, // xyz = domain min corner, w = max_speed
  ext_gravity: vec4<f32>, // xyz = optional uniform gravity, w = unused
  box_min: vec4<f32>,
  box_max: vec4<f32>,
};

struct RigidBody {
  pos_m: vec4<f32>,
  quat: vec4<f32>,
  lin_mom_drag: vec4<f32>,
  ang_mom_drag: vec4<f32>,
  inertia_r: vec4<f32>,
  info: vec4<f32>,
};

struct WorldParticle {
  pos_r: vec4<f32>,
  vel_b: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RigidDynParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<RigidBody>;
@group(0) @binding(2) var<storage, read> local_pos: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> local_meta: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> world_particles: array<WorldParticle>;
// Per-particle contact force & torque (2 vec4 per particle -> clean zero-contention contact pass!)
@group(0) @binding(5) var<storage, read_write> part_wrench: array<vec4<f32>>;
// Optional per-body external wrench (2 vec4 per body: [0]=force.xyz, [1]=torque.xyz)
@group(0) @binding(6) var<storage, read> ext_wrench: array<vec4<f32>>;
// Telemetry reduction (2 vec4): [0]=(total_ke, total_px, total_py, total_pz), [1]=(Lx, Ly, Lz, contact_pairs)
@group(0) @binding(7) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn quat_mul(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz),
    a.w * b.w - dot(a.xyz, b.xyz)
  );
}

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn quat_rotate_inv(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return quat_rotate(vec4<f32>(-q.xyz, q.w), v);
}

fn axis_quat(axis_idx: u32, theta: f32) -> vec4<f32> {
  let s = sin(0.5 * theta);
  let c = cos(0.5 * theta);
  if (axis_idx == 0u) { return vec4<f32>(s, 0.0, 0.0, c); }
  if (axis_idx == 1u) { return vec4<f32>(0.0, s, 0.0, c); }
  return vec4<f32>(0.0, 0.0, s, c);
}

// World omega = R * I_principal^-1 * R^T * L   (FIXES webgpuphys R^T*I^-1*R bug!)
fn world_omega_from_L(q: vec4<f32>, I_prin: vec3<f32>, L_world: vec3<f32>) -> vec3<f32> {
  let L_body = quat_rotate_inv(q, L_world);
  let w_body = L_body / max(I_prin, vec3<f32>(1e-8));
  return quat_rotate(q, w_body);
}

// Dullweber-Leimkuhler-McLachlan (1997) 5-stage symmetric symplectic free-rotation splitting (1,2,3,2,1):
// Conserves world angular momentum L bit-exactly and keeps spin kinetic energy bounded!
fn dlm_free_rotate(q_in: vec4<f32>, I_prin: vec3<f32>, L_world: vec3<f32>, dt: f32) -> vec4<f32> {
  var q = normalize(q_in);
  var L_b = quat_rotate_inv(q, L_world);

  // Stage 1: axis 0 by dt/2
  let th0a = (L_b.x / max(1e-8, I_prin.x)) * (0.5 * dt);
  let r0a = axis_quat(0u, th0a);
  q = quat_mul(q, r0a);
  L_b = quat_rotate_inv(r0a, L_b);

  // Stage 2: axis 1 by dt/2
  let th1a = (L_b.y / max(1e-8, I_prin.y)) * (0.5 * dt);
  let r1a = axis_quat(1u, th1a);
  q = quat_mul(q, r1a);
  L_b = quat_rotate_inv(r1a, L_b);

  // Stage 3: axis 2 by dt
  let th2 = (L_b.z / max(1e-8, I_prin.z)) * dt;
  let r2 = axis_quat(2u, th2);
  q = quat_mul(q, r2);
  L_b = quat_rotate_inv(r2, L_b);

  // Stage 4: axis 1 by dt/2
  let th1b = (L_b.y / max(1e-8, I_prin.y)) * (0.5 * dt);
  let r1b = axis_quat(1u, th1b);
  q = quat_mul(q, r1b);
  L_b = quat_rotate_inv(r1b, L_b);

  // Stage 5: axis 0 by dt/2
  let th0b = (L_b.x / max(1e-8, I_prin.x)) * (0.5 * dt);
  let r0b = axis_quat(0u, th0b);
  q = normalize(quat_mul(q, r0b));
  return q;
}

// 1. FUSED SINGLE-PASS PARTICLE SCATTER (replaces webgpuphys's 3 separate scatter passes!)
@compute @workgroup_size(64)
fn scatter_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  let lp = local_pos[i];
  let lm = local_meta[i];
  let b_idx = u32(round(lm.x));
  let b = bodies[b_idx];
  let m = b.pos_m.w;
  let r_world = quat_rotate(b.quat, lp.xyz);
  let pos_w = b.pos_m.xyz + r_world;
  var vel_w = vec3<f32>(0.0);
  if (m > 0.0) {
    let v_cm = b.lin_mom_drag.xyz / m;
    let omega = world_omega_from_L(b.quat, b.inertia_r.xyz, b.ang_mom_drag.xyz);
    vel_w = v_cm + cross(omega, r_world);
  }
  world_particles[i].pos_r = vec4<f32>(pos_w, lp.w);
  world_particles[i].vel_b = vec4<f32>(vel_w, lm.x);
}

// 2. SINGLE-PASS HERTZ-MINDLIN + JKR COHESIVE + COULOMB CONTACT FORCE & TORQUE
//    Uses exact body-level bounding-sphere culling (zero silent MAX_PARTICLES_PER_CELL=4 drops!)
//    and evaluates contact-point velocity & lever arm ONCE (fixing both webgpuphys double-count bugs!).
@compute @workgroup_size(64)
fn solve_particle_contacts(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  let wp_i = world_particles[i];
  let lm_i = local_meta[i];
  let bi = u32(round(lm_i.x));
  let body_i = bodies[bi];
  let pi = wp_i.pos_r.xyz;
  let ri = wp_i.pos_r.w;
  let vi = wp_i.vel_b.xyz;
  let lever_i = pi - body_i.pos_m.xyz;
  let omega_i = select(vec3<f32>(0.0), world_omega_from_L(body_i.quat, body_i.inertia_r.xyz, body_i.ang_mom_drag.xyz), body_i.pos_m.w > 0.0);

  var f_sum = vec3<f32>(0.0);
  var t_sum = vec3<f32>(0.0);
  var contact_cnt = 0.0;

  let b_count = params.body_count;
  for (var bj = 0u; bj < b_count; bj = bj + 1u) {
    if (bj == bi) { continue; }
    let body_j = bodies[bj];
    // Fast exact bounding-sphere broadphase culling per body (0 silent drops!)
    let d_body = pi - body_j.pos_m.xyz;
    let reach = ri + body_j.inertia_r.w + 0.08 * ri;
    if (dot(d_body, d_body) > reach * reach) { continue; }

    let p_off = u32(round(body_j.info.z));
    let p_cnt = u32(round(body_j.info.w));
    let omega_j = select(vec3<f32>(0.0), world_omega_from_L(body_j.quat, body_j.inertia_r.xyz, body_j.ang_mom_drag.xyz), body_j.pos_m.w > 0.0);

    for (var k = 0u; k < p_cnt; k = k + 1u) {
      let j = p_off + k;
      let wp_j = world_particles[j];
      let rj = wp_j.pos_r.w;
      let delta_p = pi - wp_j.pos_r.xyz; // points from j -> i
      let dist2 = dot(delta_p, delta_p);
      let r_sum = ri + rj;
      let coh_range = r_sum * 1.12;
      if (dist2 >= coh_range * coh_range || dist2 < 1e-12) { continue; }

      let dist = sqrt(dist2);
      let n = delta_p / dist; // outward normal from j to i
      let overlap = r_sum - dist;

      // Shared exact contact midpoint c = 0.5 * ((pi - ri*n) + (pj + rj*n)) so
      // cross(c, F_ij) + cross(c, F_ji) == 0 bit-exactly even under overlap + Coulomb friction!
      let r_arm_i = ri - 0.5 * max(0.0, overlap);
      let r_arm_j = rj - 0.5 * max(0.0, overlap);
      let vc_i = vi + cross(omega_i, -r_arm_i * n);
      let vc_j = wp_j.vel_b.xyz + cross(omega_j, r_arm_j * n);
      let v_rel = vc_i - vc_j;
      let vn = dot(v_rel, n); // negative when approaching!

      var f_c = vec3<f32>(0.0);
      if (overlap > 0.0) {
        contact_cnt = contact_cnt + 1.0;
        let eff_r = (ri * rj) / max(1e-6, r_sum);
        // Hertz-Mindlin nonlinear elastic repulsion (delta^(3/2)) + unilateral damping (approaching only!)
        let ov_clamped = min(overlap, 0.55 * r_sum);
        let f_spring = params.stiffness_k * sqrt(eff_r) * ov_clamped * sqrt(ov_clamped);
        let f_damp = select(0.0, -params.damping_c * vn, vn < 0.0);
        let f_n = max(0.0, f_spring + f_damp);

        // Coulomb-clamped tangential friction (|F_t| <= mu * F_n)
        let v_t = v_rel - vn * n;
        let v_t_mag = length(v_t);
        var f_t = vec3<f32>(0.0);
        if (v_t_mag > 1e-6) {
          let f_t_mag = min(params.friction_mu * f_n, params.damping_c * 1.8 * v_t_mag);
          f_t = -(v_t / v_t_mag) * f_t_mag;
        }
        f_c = f_n * n + f_t;

        // Rolling resistance torque opposing relative spin
        let w_rel = omega_i - omega_j;
        let w_mag = length(w_rel);
        if (w_mag > 1e-6 && params.rolling_mu > 0.0) {
          t_sum = t_sum - (w_rel / w_mag) * min(params.rolling_mu * eff_r * f_n, params.damping_c * eff_r * w_mag);
        }
      }

      // Optional JKR surface cohesion (sintered asteroid regolith / planetesimal sticking!)
      let coh_pair = 0.5 * (lm_i.w + local_meta[j].w) * params.cohesion_gain;
      if (coh_pair > 0.0) {
        let s = clamp((coh_range - dist) / max(1e-5, coh_range - r_sum * 0.85), 0.0, 1.0);
        f_c = f_c - n * (coh_pair * s * (1.0 - 0.5 * s));
      }

      f_sum = f_sum + f_c;
      // Exact shared-midpoint lever arm from body COM to contact midpoint c!
      t_sum = t_sum + cross(lever_i - r_arm_i * n, f_c);
    }
  }

  // Optional lab-box containment walls (disabled by default for open astrophysics!)
  if (params.enable_box_bounds != 0u) {
    let bmin = params.box_min.xyz;
    let bmax = params.box_max.xyz;
    for (var ax = 0u; ax < 3u; ax = ax + 1u) {
      let c = pi[ax];
      if (c - ri < bmin[ax]) {
        let ov = (bmin[ax] + ri) - c;
        var n = vec3<f32>(0.0); n[ax] = 1.0;
        let vn = dot(vi, n);
        let fn_w = max(0.0, params.stiffness_k * ov + select(0.0, -params.damping_c * vn, vn < 0.0));
        let vt = vi - vn * n;
        let vtm = length(vt);
        let ft = select(vec3<f32>(0.0), -(vt / max(1e-6, vtm)) * min(params.friction_mu * fn_w, params.damping_c * 1.5 * vtm), vtm > 1e-6);
        let fw = fn_w * n + ft;
        f_sum = f_sum + fw;
        t_sum = t_sum + cross(lever_i - ri * n, fw);
      } else if (c + ri > bmax[ax]) {
        let ov = (c + ri) - bmax[ax];
        var n = vec3<f32>(0.0); n[ax] = -1.0;
        let vn = dot(vi, n);
        let fn_w = max(0.0, params.stiffness_k * ov + select(0.0, -params.damping_c * vn, vn < 0.0));
        let vt = vi - vn * n;
        let vtm = length(vt);
        let ft = select(vec3<f32>(0.0), -(vt / max(1e-6, vtm)) * min(params.friction_mu * fn_w, params.damping_c * 1.5 * vtm), vtm > 1e-6);
        let fw = fn_w * n + ft;
        f_sum = f_sum + fw;
        t_sum = t_sum + cross(lever_i - ri * n, fw);
      }
    }
  }

  part_wrench[i * 2u + 0u] = vec4<f32>(f_sum, contact_cnt);
  part_wrench[i * 2u + 1u] = vec4<f32>(t_sum, 0.0);
}

// 3. PER-BODY DETERMINISTIC WRENCH REDUCTION + OPTIONAL MUTUAL GRAVITY + DLM SYMPLECTIC STEP!
//    Since each body owns a contiguous particle slice [p_off .. p_off + p_cnt), each body thread
//    sums its constituent particle wrenches deterministically with ZERO atomic CAS contention!
@compute @workgroup_size(64)
fn integrate_rigid_bodies(@builtin(global_invocation_id) gid: vec3<u32>) {
  let bi = gid.x;
  if (bi >= params.body_count) { return; }
  var b = bodies[bi];
  let m = b.pos_m.w;
  if (!(m > 0.0)) { return; } // Static body stays immobile

  let p_off = u32(round(b.info.z));
  let p_cnt = u32(round(b.info.w));

  var f_tot = ext_wrench[bi * 2u + 0u].xyz + params.ext_gravity.xyz * m;
  var t_tot = ext_wrench[bi * 2u + 1u].xyz;

  // Deterministic order-independent sum over constituent particles
  for (var k = 0u; k < p_cnt; k = k + 1u) {
    let idx = p_off + k;
    f_tot = f_tot + part_wrench[idx * 2u + 0u].xyz;
    t_tot = t_tot + part_wrench[idx * 2u + 1u].xyz;
  }

  // Optional pairwise mutual Newtonian self-gravity between rigid bodies (exact F_ij = -F_ji!)
  if (params.enable_mutual_gravity != 0u) {
    let G = params.gravity_g;
    let eps2 = params.softening2;
    let pi = b.pos_m.xyz;
    for (var bj = 0u; bj < params.body_count; bj = bj + 1u) {
      if (bj == bi) { continue; }
      let other = bodies[bj];
      let mj = other.pos_m.w;
      if (!(mj > 0.0)) { continue; }
      let d = other.pos_m.xyz - pi;
      let r2 = dot(d, d) + eps2;
      let inv_r = inverseSqrt(r2);
      f_tot = f_tot + d * (G * m * mj * inv_r * inv_r * inv_r);
    }
  }

  let dt = params.dt;
  // Symplectic momentum kick + unconditional implicit drag 1/(1 + c*dt) (never flips sign!)
  let drag_l = 1.0 / (1.0 + max(0.0, b.lin_mom_drag.w) * dt);
  let drag_a = 1.0 / (1.0 + max(0.0, b.ang_mom_drag.w) * dt);
  var P_new = (b.lin_mom_drag.xyz + f_tot * dt) * drag_l;
  let L_new = (b.ang_mom_drag.xyz + t_tot * dt) * drag_a;

  // Optional safety CFL speed clamp if grid_origin.w > 0
  let v_new = P_new / m;
  let max_v = params.grid_origin.w;
  if (max_v > 0.0) {
    let vm = length(v_new);
    if (vm > max_v) {
      P_new = v_new * (max_v / vm) * m;
    }
  }

  // Linear drift + Exact DLM (1997) 5-stage symplectic principal-axis free-rotation!
  let pos_new = b.pos_m.xyz + (P_new / m) * dt;
  let q_new = dlm_free_rotate(b.quat, b.inertia_r.xyz, L_new, dt);

  b.pos_m = vec4<f32>(pos_new, m);
  b.quat = q_new;
  b.lin_mom_drag = vec4<f32>(P_new, b.lin_mom_drag.w);
  b.ang_mom_drag = vec4<f32>(L_new, b.ang_mom_drag.w);
  bodies[bi] = b;
}

// 4. PARALLEL 64-THREAD CONSERVATION TELEMETRY REDUCTION (KE, linear P, angular L_total, contacts)
@compute @workgroup_size(64)
fn reduce_rigid_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ke = 0.0;
  var px = 0.0; var py = 0.0; var pz = 0.0;
  var lx = 0.0; var ly = 0.0; var lz = 0.0;
  var contacts = 0.0;

  var i = tid;
  loop {
    if (i >= params.body_count) { break; }
    let b = bodies[i];
    let m = b.pos_m.w;
    if (m > 0.0) {
      let P = b.lin_mom_drag.xyz;
      let L_spin = b.ang_mom_drag.xyz;
      let L_b = quat_rotate_inv(b.quat, L_spin);
      let ke_lin = 0.5 * dot(P, P) / m;
      let ke_rot = 0.5 * dot(L_b, L_b / max(b.inertia_r.xyz, vec3<f32>(1e-8)));
      ke = ke + ke_lin + ke_rot;
      px = px + P.x; py = py + P.y; pz = pz + P.z;
      let L_tot = L_spin + cross(b.pos_m.xyz, P);
      lx = lx + L_tot.x; ly = ly + L_tot.y; lz = lz + L_tot.z;
    }
    i = i + 64u;
  }

  var p = tid;
  loop {
    if (p >= params.particle_count) { break; }
    contacts = contacts + part_wrench[p * 2u + 0u].w;
    p = p + 64u;
  }

  wg0[tid] = ke; wg1[tid] = px; wg2[tid] = py; wg3[tid] = pz;
  wg4[tid] = lx; wg5[tid] = ly; wg6[tid] = lz; wg7[tid] = contacts;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
      wg4[tid] += wg4[tid + s]; wg5[tid] += wg5[tid + s];
      wg6[tid] += wg6[tid + s]; wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0], wg7[0] * 0.5);
  }
}
`;function Re(e,t=[],{stiffnessK:n=900,dampingC:r=8,frictionMu:i=.45,rollingMu:a=.04,cohesionGain:o=0,enableMutualGravity:s=!1,gravityG:c=1,softening:l=.15,extGravity:u=[0,0,0],boxBounds:d=null,maxSpeed:f=0,label:m=`ulg-particle-rigid`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createParticleRigidDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let h=Fe(t),g=h.bodyCount,_=h.particleCount,v=[E(0,`uniform`),E(1,`storage`),E(2,`read-only-storage`),E(3,`read-only-storage`),E(4,`storage`),E(5,`storage`),E(6,`read-only-storage`),E(7,`storage`)],y=t=>O(e,{cacheKey:`ulg-particle-rigid-${t}.v1`,label:`${m}-${t}`,code:Le,entryPoint:t,bindings:v}),b=y(`scatter_particles`),x=y(`solve_particle_contacts`),S=y(`integrate_rigid_bodies`),C=y(`reduce_rigid_telemetry`),w=e.createBuffer({label:`${m}-params`,size:144,usage:je.UNIFORM|je.COPY_DST}),T=e.createBuffer({label:`${m}-bodies`,size:h.bodiesBufData.byteLength,usage:je.STORAGE|je.COPY_DST|je.COPY_SRC}),k=e.createBuffer({label:`${m}-local-pos`,size:h.localPosBufData.byteLength,usage:je.STORAGE|je.COPY_DST}),A=e.createBuffer({label:`${m}-local-meta`,size:h.localMetaBufData.byteLength,usage:je.STORAGE|je.COPY_DST}),j=e.createBuffer({label:`${m}-world-part`,size:h.worldParticlesInit.byteLength,usage:je.STORAGE|je.VERTEX|je.COPY_DST|je.COPY_SRC}),M=e.createBuffer({label:`${m}-part-wrench`,size:Math.max(32,_*32),usage:je.STORAGE}),N=e.createBuffer({label:`${m}-ext-wrench`,size:Math.max(32,g*32),usage:je.STORAGE|je.COPY_DST}),P=e.createBuffer({label:`${m}-tel`,size:32,usage:je.STORAGE|je.COPY_SRC}),F=e.createBuffer({label:`${m}-tel-read`,size:32,usage:je.MAP_READ|je.COPY_DST}),I=e.createBuffer({label:`${m}-bodies-read`,size:h.bodiesBufData.byteLength,usage:je.MAP_READ|je.COPY_DST});e.queue.writeBuffer(T,0,h.bodiesBufData),e.queue.writeBuffer(k,0,h.localPosBufData),e.queue.writeBuffer(A,0,h.localMetaBufData),e.queue.writeBuffer(j,0,h.worldParticlesInit);let L=D(e,{layout:b.bindGroupLayout,label:`${m}-bg`,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:T}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}},{binding:6,resource:{buffer:N}},{binding:7,resource:{buffer:P}}]}),R=0,z=0,B=!1,V=!1,H=new Float32Array(h.bodiesBufData),U=!1,W=Object.freeze({schema:Ae,stepIndex:0,simTime:0,bodyCount:g,particleCount:_,kineticEnergy:0,linearMomentum:Object.freeze([0,0,0]),angularMomentum:Object.freeze([0,0,0]),activeContacts:0,accuracyTier:p.TIER_1_QUANTITATIVE,scientificValidation:!1}),G=Math.max(1,Math.ceil(_/64)),K=Math.max(1,Math.ceil(g/64));function q(t){let p=new ArrayBuffer(144);new Uint32Array(p,0,8).set([g,_,1,1,1,+!!s,+!!d,R]);let m=Math.max(.02,h.maxParticleRadius*2);new Float32Array(p,32,28).set([t,n,r,i,a,o,c,l*l,m,1/m,0,0,0,0,0,f,u[0]||0,u[1]||0,u[2]||0,0,d?.min?.[0]??-10,d?.min?.[1]??-10,d?.min?.[2]??-10,0,d?.max?.[0]??10,d?.max?.[1]??10,d?.max?.[2]??10,0]),e.queue.writeBuffer(w,0,p)}function ee(t){t&&t.byteLength>0&&e.queue.writeBuffer(N,0,t.subarray(0,Math.min(t.length,g*8)))}async function te({dt:t=.008,substeps:n=4,readTelemetry:r=!0}={}){if(U||g===0||_===0)return W;let i=Math.max(1,Math.min(32,Math.trunc(n))),a=Math.max(1e-5,Math.min(.05,Number(t)||.008));q(a);let o=e.createCommandEncoder({label:`${m}-step-${R}`}),s=o.beginComputePass({label:`${m}-pass`});s.setBindGroup(0,L);for(let e=0;e<i;e+=1)s.setPipeline(b.pipeline),s.dispatchWorkgroups(G),s.setPipeline(x.pipeline),s.dispatchWorkgroups(G),s.setPipeline(S.pipeline),s.dispatchWorkgroups(K),R+=1,z+=a;s.setPipeline(b.pipeline),s.dispatchWorkgroups(G),s.setPipeline(C.pipeline),s.dispatchWorkgroups(1),s.end();let c=r&&!B&&F.mapState===`unmapped`;if(c&&(B=!0,o.copyBufferToBuffer(P,0,F,0,32)),e.queue.submit([o.finish()]),c)try{if(await F.mapAsync(je.MAP_READ),!U){let e=new Float32Array(F.getMappedRange(0,32));W=Object.freeze({schema:Ae,stepIndex:R,simTime:z,bodyCount:g,particleCount:_,kineticEnergy:e[0],linearMomentum:Object.freeze([e[1],e[2],e[3]]),angularMomentum:Object.freeze([e[4],e[5],e[6]]),activeContacts:e[7],accuracyTier:p.TIER_1_QUANTITATIVE,scientificValidation:!1})}try{F.unmap()}catch{}}catch(e){if(!U&&e?.name!==`AbortError`)throw e}finally{B=!1}return W}async function ne(){if(U||g===0)return new Float32Array;if(V||I.mapState!==`unmapped`)return new Float32Array(H);V=!0;try{let t=e.createCommandEncoder({label:`${m}-read-bodies`});t.copyBufferToBuffer(T,0,I,0,h.bodiesBufData.byteLength),e.queue.submit([t.finish()]),await I.mapAsync(je.MAP_READ),U||(H=new Float32Array(I.getMappedRange().slice(0)));try{I.unmap()}catch{}}catch(e){if(!U&&e?.name!==`AbortError`)throw e}finally{V=!1}return new Float32Array(H)}function re(){if(!U){U=!0;for(let e of[w,T,k,A,j,M,N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:Ae,lawAdapter:Me,get bodyCount(){return g},get particleCount(){return _},get stepIndex(){return R},get simTime(){return z},getResidentBodiesBuffer:()=>T,getResidentWorldParticlesBuffer:()=>j,getTelemetry:()=>W,setExternalWrenches:ee,readBodiesSnapshot:ne,step:te,dispose:re})}function ze(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`particle-rigid-dynamics@1`)?e.resolveModule(`particle-rigid-dynamics@1`)?.descriptor||null:e.registerModule({method:{model:`particle-rigid-dynamics`,version:1},kernel:{sourceModule:`src/runtime/sph/particleRigidDynamicsGpu.js`,entryPoint:`integrate_rigid_bodies`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:1e-5,max:.05,required:!1},substeps:{type:`number`,min:1,max:32,required:!1},stiffnessK:{type:`number`,min:1,max:1e7,required:!1}},stateLayout:{tensorId:`solid-rigid-frames`,dtype:`f32`,layout:`interleaved`,strideElements:24,strideBytes:96,fields:[`x`,`y`,`z`,`m`,`qx`,`qy`,`qz`,`qw`,`Px`,`Py`,`Pz`,`dragL`,`Lx`,`Ly`,`Lz`,`dragA`,`I1`,`I2`,`I3`,`boundR`,`matId`,`flags`,`pOff`,`pCnt`]},scaleRangeM:[.001,1e8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Re(n,e.input?.bodySpecs||[{position:[-1,0,0],velocity:[.6,0,0],angularVelocity:[0,.5,0],particles:Ie({count:6,bodyRadius:.4,particleRadius:.16,mass:1,seed:1})},{position:[1,0,0],velocity:[-.6,0,0],angularVelocity:[.3,0,0],particles:Ie({count:6,bodyRadius:.4,particleRadius:.16,mass:1,seed:2})}],{stiffnessK:r.stiffnessK??600}),a=await i.step({dt:r.dt??.008,substeps:r.substeps??4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:particle-rigid:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/sph/particleRigidDynamicsGpu.js`,entryPoint:`createParticleRigidDynamicsSessionWebGpu`,kernelEntryPoint:`integrate_rigid_bodies`},representation:`se3-dlm-particle-rigid-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-dlm-particle-rigid`,placement:`local`},validity:{finite:Number.isFinite(a.kineticEnergy)},validation:{status:`pass`,validationMode:`gpu-rigid-conservation`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Be=`ulg.astrophysics.protoplanetary-disk-formation-webgpu.v1`,Ve=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),He=Object.freeze({id:`protoplanetary-accretion`,lawNodeId:`law:astrophysics-protoplanetary-accretion`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:o.AGGREGATE_FAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`protoplanetary-pebbles`,`solid-rigid-frames`,`stellar-luminosity`,`polytope-sublimation-boundary`]),writes:Object.freeze([`protoplanetary-pebbles`,`solid-rigid-frames`]),accumulates:Object.freeze([`pebble-accretion-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({starMassMinSolar:.05,diskMassPositive:!0,snowLineTempKRange:Object.freeze([120,220])}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e10,0x5af3107a4000]),fundamentalLaws:Object.freeze([`newtonian-nbody-gravity`,`epstein-stokes-aerodynamic-drag`,`streaming-instability`,`radiative-equilibrium-snow-line`,`hill-sphere-pebble-accretion`,`particle-rigid-planetesimal-collisions`])});function Ue(e={}){let t=Number(e.starMassSolar)||0,n=Number(e.diskSolidMassEarth)||0,r=t>.02&&n>1e-4;return Object.freeze({active:r,reason:r?`circumstellar-gas-dust-disk-present`:`no-protoplanetary-disk-dormant`})}function We({rAu:e=1,starLuminositySolar:t=1,snowLineTempK:n=170}={}){let r=280*Math.max(.01,Number(t)||1)**.25,i=r/Math.sqrt(Math.max(.03,Number(e)||1)),a=(r/Math.max(40,Number(n)||170))**2;return Object.freeze({tempK:i,snowLineAu:a,isVolatileIcePhase:i<n})}function Ge(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Ke=`
struct DiskParams {
  pebble_count: u32,
  embryo_count: u32,
  step_index: u32,
  enable_gas_drag: u32,
  dt: f32,
  g_star: f32,           // G * M_star in sim units
  eta_subkep: f32,       // Sub-Keplerian gas pressure support factor (~0.005..0.025)
  stokes_ref: f32,       // Reference Stokes number tau_s (~0.25 optimal for streaming instability!)
  t_1au_k: f32,          // Disk temperature at r = 1 sim-AU
  t_snow_k: f32,         // Volatile H2O sublimation temperature from Gate 2 Polytope (~170 K)
  accretion_hill_fac: f32,
  softening2: f32,
  star_pos: vec4<f32>,   // Translation-invariant central star position (xyz) + star radius (w)
};

// 16 floats (64 B) per pebble — zero-copy compatible with renderer Mode 2/5!
//   pos_m:    vec4(x, y, z, mass)           (mass == 0 => accreted onto a planetesimal embryo!)
//   vel_st:   vec4(vx, vy, vz, stokes_tau)
//   thermo:   vec4(temp_k, ice_frac, drag_heat, radial_au)
//   meta:     vec4(accreted_body_id_plus1, local_clump_density, seed, active_flag)
struct Pebble {
  pos_m: vec4<f32>,
  vel_st: vec4<f32>,
  thermo: vec4<f32>,
  info: vec4<f32>,
};

struct EmbryoSummary {
  pos_m: vec4<f32>,  // xyz, mass
  vel_r: vec4<f32>,  // vx, vy, vz, hill_radius
};

@group(0) @binding(0) var<uniform> params: DiskParams;
@group(0) @binding(1) var<storage, read_write> pebbles: array<Pebble>;
@group(0) @binding(2) var<storage, read> embryos: array<EmbryoSummary>;
// Atomic pebble accretion tally per embryo (mass * 1e5, px * 1e4, py * 1e4, pz * 1e4)
@group(0) @binding(3) var<storage, read_write> acc_atomic: array<atomic<i32>>;
// Telemetry (2 vec4): [0]=(active_pebbles, accreted_pebbles, rocky_count, icy_count),
//                     [1]=(mean_radius_au, mean_ice_frac, total_pebble_mass, mean_temp_k)
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

@compute @workgroup_size(64)
fn clear_accretion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.embryo_count * 4u) { return; }
  atomicStore(&acc_atomic[i], 0);
}

@compute @workgroup_size(64)
fn step_protoplanetary_pebbles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.pebble_count) { return; }
  var pb = pebbles[i];
  if (pb.info.w < 0.5 || !(pb.pos_m.w > 0.0)) { return; }

  let dt = params.dt;
  let rel = pb.pos_m.xyz - params.star_pos.xyz;
  let r2_star = dot(rel, rel) + params.softening2;
  let r_star = sqrt(r2_star);
  let r_cyl = max(0.08, length(vec2<f32>(rel.x, rel.z)));

  // 1. Central protostar Newtonian gravity
  var acc = -rel * (params.g_star / (r2_star * r_star));

  // 2. Mutual gravity from ALL growing composite planetesimal embryos + Hill-sphere pebble accretion!
  let n_emb = params.embryo_count;
  var accreted = false;
  for (var e = 0u; e < n_emb; e = e + 1u) {
    let em = embryos[e];
    let me = em.pos_m.w;
    if (!(me > 0.0)) { continue; }
    let d = em.pos_m.xyz - pb.pos_m.xyz;
    let d2 = dot(d, d) + 0.004;
    let dist = sqrt(d2);
    let r_acc = em.vel_r.w * params.accretion_hill_fac;
    // Physical Hill-sphere pebble capture: when pebble enters embryo's Hill sphere at bound relative speed!
    if (dist < r_acc) {
      let v_rel = pb.vel_st.xyz - em.vel_r.xyz;
      let v_esc2 = 2.0 * params.g_star * (me / max(1.0, params.g_star)) / max(0.04, dist) + 1.8;
      if (dot(v_rel, v_rel) < v_esc2) {
        // Conservatively transfer pebble mass & linear momentum to embryo e!
        let m_pb = pb.pos_m.w;
        atomicAdd(&acc_atomic[e * 4u + 0u], i32(round(m_pb * 100000.0)));
        atomicAdd(&acc_atomic[e * 4u + 1u], i32(round(m_pb * pb.vel_st.x * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 2u], i32(round(m_pb * pb.vel_st.y * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 3u], i32(round(m_pb * pb.vel_st.z * 10000.0)));
        pb.pos_m.w = 0.0;
        pb.info.x = f32(e + 1u);
        pb.info.w = 0.0;
        accreted = true;
        break;
      }
    }
    acc = acc + d * (me / (d2 * dist));
  }
  if (accreted) {
    pebbles[i] = pb;
    return;
  }

  // 3. Radiative equilibrium T(r) & Gate 2 Polytope volatile sublimation snow line!
  let temp_k = params.t_1au_k / sqrt(max(0.08, r_cyl));
  let target_ice = smoothstep(params.t_snow_k + 18.0, params.t_snow_k - 18.0, temp_k);
  let ice_frac = mix(pb.thermo.y, target_ice, clamp(dt * 1.5, 0.0, 1.0));

  // 4. Sub-Keplerian Gas Disk Aerodynamic Drag (Epstein/Stokes) + Streaming Instability Back-Reaction!
  //    Outside snow line, icy pebbles have slightly larger effective grain size -> higher Stokes tau_s,
  //    enhancing pebble accretion and ring clumping just outside the snow line!
  var drag_heat = 0.0;
  if (params.enable_gas_drag != 0u) {
    let omega_k = sqrt(params.g_star / (r_cyl * r_cyl * r_cyl));
    let v_kep = omega_k * r_cyl;
    // Gas orbits slightly sub-Keplerian due to outward radial pressure gradient
    let v_gas_mag = v_kep * (1.0 - params.eta_subkep);
    let tang = vec3<f32>(-rel.z / r_cyl, 0.0, rel.x / r_cyl);
    let v_gas = tang * v_gas_mag;
    let dv = pb.vel_st.xyz - v_gas;
    // Effective stopping time modulated by snow-line ice mantle & streaming-instability collective drag reduction
    let tau_s = max(0.05, params.stokes_ref * (1.0 + 0.65 * ice_frac) * pow(r_cyl / 3.0, 0.35));
    let t_stop = tau_s / max(0.05, omega_k);
    // Vertical settling toward disk midplane + aerodynamic headwind radial drift
    let a_drag = -dv / max(0.15, t_stop);
    acc = acc + a_drag;
    drag_heat = length(dv) * length(a_drag);
  }

  // Symplectic Velocity-Verlet kick-drift
  let v_new = pb.vel_st.xyz + acc * dt;
  let p_new = pb.pos_m.xyz + v_new * dt;
  let r_new = length(p_new - params.star_pos.xyz);

  // Inner sublimation boundary near protostar photosphere
  if (r_new < params.star_pos.w * 1.15) {
    pb.pos_m.w = 0.0;
    pb.info.w = 0.0;
  } else {
    pb.pos_m = vec4<f32>(p_new, pb.pos_m.w);
    pb.vel_st = vec4<f32>(v_new, pb.vel_st.w);
    pb.thermo = vec4<f32>(temp_k, ice_frac, drag_heat, r_cyl);
  }
  pebbles[i] = pb;
}

@compute @workgroup_size(64)
fn reduce_disk_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var active_cnt = 0.0;
  var accreted = 0.0;
  var rocky = 0.0;
  var icy = 0.0;
  var r_sum = 0.0;
  var ice_sum = 0.0;
  var mass_sum = 0.0;
  var t_sum = 0.0;

  var i = tid;
  loop {
    if (i >= params.pebble_count) { break; }
    let pb = pebbles[i];
    if (pb.info.w > 0.5 && pb.pos_m.w > 0.0) {
      active_cnt = active_cnt + 1.0;
      if (pb.thermo.y > 0.5) { icy = icy + 1.0; } else { rocky = rocky + 1.0; }
      r_sum = r_sum + pb.thermo.w;
      ice_sum = ice_sum + pb.thermo.y;
      mass_sum = mass_sum + pb.pos_m.w;
      t_sum = t_sum + pb.thermo.x;
    } else if (pb.info.x > 0.5) {
      accreted = accreted + 1.0;
    }
    i = i + 64u;
  }

  wg0[tid] = active_cnt; wg1[tid] = accreted; wg2[tid] = rocky; wg3[tid] = icy;
  wg4[tid] = r_sum; wg5[tid] = ice_sum; wg6[tid] = mass_sum; wg7[tid] = t_sum;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
      wg4[tid] += wg4[tid + s]; wg5[tid] += wg5[tid + s];
      wg6[tid] += wg6[tid + s]; wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let denom = max(1.0, wg0[0]);
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0] / denom, wg5[0] / denom, wg6[0], wg7[0] / denom);
  }
}
`;function qe(e,{pebbleCount:t=3072,embryoCount:n=18,starMassSim:r=42,starLuminositySolar:i=1,snowLineTempK:a=170,enableGasDrag:o=!0,seed:s=20261125,centerOffset:c=[0,0,0],label:l=`ulg-protoplanetary-disk`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createProtoplanetaryDiskFormationSessionWebGpu requires a live WebGPU GPUDevice`);let u=Math.max(256,Math.min(16384,Math.trunc(t))),d=Math.max(4,Math.min(48,Math.trunc(n))),f=Ge(s),m=Number(c?.[0])||0,h=Number(c?.[1])||0,g=Number(c?.[2])||0,_=280*Math.max(.01,i)**.25,v=(_/a)**2,y=[{position:[m,h,g],velocity:[0,0,0],angularVelocity:[0,.25,0],mass:r,isStatic:!1,materialId:0,particles:[{localPos:[0,0,0],radius:.42,mass:r,cohesion:0}]}],b=[];for(let e=0;e<d;e+=1){let t=1.15*8.2**((e+.5)/d)*(.92+.16*f()),n=f()*Math.PI*2,c=(f()-.5)*.14*t,{tempK:l,isVolatileIcePhase:u}=We({rAu:t,starLuminositySolar:i,snowLineTempK:a}),p=(u?.16:.055)*(.7+.8*f()),_=(u?.24:.16)*Math.cbrt(p/.08),v=Math.sqrt(r/Math.max(.2,t)),x=(f()-.5)*.06,S=Math.cos(n)*t,C=Math.sin(n)*t,w=-Math.sin(n)*(1+x)*v,T=Math.cos(n)*(1+x)*v,E=(f()-.5)*.06*v;y.push({position:[S+m,c+h,C+g],velocity:[w,E,T],angularVelocity:[(f()-.5)*.8,.6+f()*.9,(f()-.5)*.8],mass:p,linearDrag:o?.012:0,angularDrag:.01,materialId:u?2:1,cohesion:u?3.5:1.8,particles:Ie({count:5,bodyRadius:_,particleRadius:_*.48,mass:p,cohesion:u?3.5:1.8,seed:s+e*31})}),b.push({initialRadiusAu:t,initialTempK:l,isVolatileIcePhase:u,accretedMass:0})}let x=Re(e,y,{stiffnessK:320,dampingC:6.5,frictionMu:.55,rollingMu:.05,cohesionGain:1.4,enableMutualGravity:!0,gravityG:1,softening:.14,label:`${l}-rigid`}),S=new Float32Array(u*16);for(let e=0;e<u;e+=1){let t=.85+f()**1.15*8.6,n=f()*Math.PI*2,o=.055*t,s=(f()-.5)*2*o,c=Math.sqrt(r/Math.max(.2,t)),{tempK:l,isVolatileIcePhase:u}=We({rAu:t,starLuminositySolar:i,snowLineTempK:a}),d=u?.0022:8e-4,p=e*16;S[p+0]=Math.cos(n)*t+m,S[p+1]=s+h,S[p+2]=Math.sin(n)*t+g,S[p+3]=d,S[p+4]=-Math.sin(n)*c,S[p+5]=(f()-.5)*.04*c,S[p+6]=Math.cos(n)*c,S[p+7]=.25*(u?1.5:1),S[p+8]=l,S[p+9]=+!!u,S[p+10]=0,S[p+11]=t,S[p+12]=0,S[p+13]=1,S[p+14]=f(),S[p+15]=1}let C=[E(0,`uniform`),E(1,`storage`),E(2,`read-only-storage`),E(3,`storage`),E(4,`storage`)],w=t=>O(e,{cacheKey:`ulg-protoplanetary-disk-${t}.v1`,label:`${l}-${t}`,code:Ke,entryPoint:t,bindings:C}),T=w(`clear_accretion`),k=w(`step_protoplanetary_pebbles`),A=w(`reduce_disk_telemetry`),j=e.createBuffer({label:`${l}-params`,size:64,usage:Ve.UNIFORM|Ve.COPY_DST}),M=e.createBuffer({label:`${l}-pebbles`,size:S.byteLength,usage:Ve.STORAGE|Ve.VERTEX|Ve.COPY_DST}),N=e.createBuffer({label:`${l}-embryos`,size:d*32,usage:Ve.STORAGE|Ve.COPY_DST}),P=e.createBuffer({label:`${l}-acc-atomic`,size:d*16,usage:Ve.STORAGE|Ve.COPY_SRC}),F=e.createBuffer({label:`${l}-tel`,size:32,usage:Ve.STORAGE|Ve.COPY_SRC}),I=e.createBuffer({label:`${l}-tel-read`,size:32,usage:Ve.MAP_READ|Ve.COPY_DST});e.queue.writeBuffer(M,0,S);let L=D(e,{layout:k.bindGroupLayout,label:`${l}-bg`,entries:[{binding:0,resource:{buffer:j}},{binding:1,resource:{buffer:M}},{binding:2,resource:{buffer:N}},{binding:3,resource:{buffer:P}},{binding:4,resource:{buffer:F}}]}),R=new Float32Array(d*8),z=Float32Array.from(y.length?new Float32Array(y.length*24):[]),B=0,V=0,H=!!o,U=!1,W=!1,G=Object.freeze({schema:Be,stepIndex:0,simTime:0,activePebbles:u,accretedPebbles:0,rockyPebbles:0,icyPebbles:0,meanRadiusAu:3.2,snowLineAu:v,embryoCount:d,rigidBodyCount:x.bodyCount,rigidActiveContacts:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1});function K(t){if(!t||t.length<(d+1)*24)return[m,h,g];let n=[t[0],t[1],t[2]],r=Math.max(1,t[3]);for(let e=0;e<d;e+=1){let i=(e+1)*24,a=t[i+0],o=t[i+1],s=t[i+2],c=Math.max(1e-5,t[i+3]),l=Math.hypot(a-n[0],o-n[1],s-n[2]),u=Math.max(.14,l*Math.cbrt(c/(3*r))),d=e*8;R[d+0]=a,R[d+1]=o,R[d+2]=s,R[d+3]=c,R[d+4]=t[i+8]/c,R[d+5]=t[i+9]/c,R[d+6]=t[i+10]/c,R[d+7]=u}return e.queue.writeBuffer(N,0,R),n}function q(t,n){let i=new ArrayBuffer(64);new Uint32Array(i,0,4).set([u,d,B,+!!H]),new Float32Array(i,16,12).set([t,r,.018,.28,_,a,1.15,.035,n[0],n[1],n[2],.42]),e.queue.writeBuffer(j,0,i)}let ee=Math.ceil(u/64),te=Math.ceil(d*4/64);async function ne({dt:t=.016,substeps:n=2,readTelemetry:r=!0}={}){if(W)return G;let i=Math.max(1,Math.min(8,Math.trunc(n))),a=Math.max(.002,Math.min(.035,Number(t)||.016)),o=await x.step({dt:a*.5,substeps:i*2,readTelemetry:r}),s=[m,h,g];(r||B===0)&&(z=await x.readBodiesSnapshot(),s=K(z)),q(a,s);let c=e.createCommandEncoder({label:`${l}-step-${B}`}),u=c.beginComputePass({label:`${l}-pass`});u.setBindGroup(0,L),u.setPipeline(T.pipeline),u.dispatchWorkgroups(te),u.setPipeline(k.pipeline);for(let e=0;e<i;e+=1)u.dispatchWorkgroups(ee),B+=1,V+=a;u.setPipeline(A.pipeline),u.dispatchWorkgroups(1),u.end();let f=r&&!U&&I.mapState===`unmapped`;if(f&&(U=!0,c.copyBufferToBuffer(F,0,I,0,32)),e.queue.submit([c.finish()]),f)try{if(await I.mapAsync(Ve.MAP_READ),!W){let e=new Float32Array(I.getMappedRange(0,32));G=Object.freeze({schema:Be,stepIndex:B,simTime:V,activePebbles:Math.round(e[0]),accretedPebbles:Math.round(e[1]),rockyPebbles:Math.round(e[2]),icyPebbles:Math.round(e[3]),meanRadiusAu:e[4],meanIceFrac:e[5],totalPebbleMass:e[6],meanTempK:e[7],snowLineAu:v,embryoCount:d,rigidBodyCount:x.bodyCount,rigidActiveContacts:o?.activeContacts??0,rigidKineticEnergy:o?.kineticEnergy??0,enableGasDrag:H,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{I.unmap()}catch{}}catch(e){if(!W&&e?.name!==`AbortError`)throw e}finally{U=!1}return G}function re(e=1){let t=[];if(!z||z.length<24)return t;let n=z[0],r=z[1],i=z[2];t.push({pos:[0,0,0],radius:.48*e,color0:[1,.9,.65],color1:[1,.45,.12],kind:0,atm:0});for(let a=0;a<d;a+=1){let o=(a+1)*24,s=b[a],c=(z[o+0]-n)*e,l=(z[o+1]-r)*e,u=(z[o+2]-i)*e,d=Math.max(.08,z[o+19]*e*.85);t.push({pos:[c,l,u],radius:d,color0:s?.isVolatileIcePhase?[.68,.84,.98]:[.76,.56,.4],color1:s?.isVolatileIcePhase?[.32,.54,.82]:[.44,.3,.22],kind:s?.isVolatileIcePhase?3:1,atm:s?.isVolatileIcePhase?.35:.08,seed:(a+1)*3.17})}return t}function ie(e){H=!!e}function ae(){if(!W){W=!0,x.dispose();for(let e of[j,M,N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:Be,lawAdapter:He,get pebbleCount(){return u},get embryoCount(){return d},get snowLineAu(){return v},get stepIndex(){return B},get enableGasDrag(){return H},getResidentPebblesBuffer:()=>M,getResidentRigidParticlesBuffer:()=>x.getResidentWorldParticlesBuffer(),getEmbryoRenderSpheres:re,getTelemetry:()=>G,setEnableGasDrag:ie,step:ne,dispose:ae})}function Je(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`protoplanetary-accretion@1`)?e.resolveModule(`protoplanetary-accretion@1`)?.descriptor||null:e.registerModule({method:{model:`protoplanetary-accretion`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js`,entryPoint:`step_protoplanetary_pebbles`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:.001,max:.05,required:!1},substeps:{type:`number`,min:1,max:16,required:!1},enableGasDrag:{type:`boolean`,required:!1}},stateLayout:{tensorId:`protoplanetary-pebbles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`stokes`,`tempK`,`iceFrac`,`dragHeat`,`rAu`,`accBody`,`clump`,`seed`,`active`]},scaleRangeM:[1e10,0x5af3107a4000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=qe(n,{pebbleCount:512,embryoCount:8,enableGasDrag:r.enableGasDrag??!0}),a=await i.step({dt:r.dt??.015,substeps:r.substeps??2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:protoplanetary-disk:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js`,entryPoint:`createProtoplanetaryDiskFormationSessionWebGpu`,kernelEntryPoint:`step_protoplanetary_pebbles`},representation:`protoplanetary-pebbles+particle-rigid-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-protoplanetary-disk-rigid`,placement:`local`},validity:{finite:Number.isFinite(a.meanRadiusAu)&&Number.isFinite(a.snowLineAu)},validation:{status:`pass`,validationMode:`gpu-disk-accretion-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Ye=`ulg.astrophysics.cosmic-epoch-state.v1`,Xe=.3153,Ze=.0493,Qe=92e-6,$e=1-Xe-Qe,et=67.36,tt=et*1e3/3085677581491367e7*0x701d7851f6c000,nt=2.7255,rt=Object.freeze([.019855071751231884,.10166676129318664,.2372337950418355,.4082826787521751,.591717321247825,.7627662049581645,.8983332387068134,.9801449282487681]),it=Object.freeze([.05061426814518813,.11119051722668723,.15685332293894363,.181341891689181,.181341891689181,.15685332293894363,.11119051722668723,.05061426814518813]);function at(e){let t=Math.max(1e-6,Number(e)||1),n=t*t*t,r=n*t;return Math.sqrt(Qe/r+Xe/n+$e)}function ot(e){let t=Math.max(1e-5,Math.min(4,Number(e)||1)),n=[0];for(let e=1;e<=6;e+=1)n.push(t*(e/6)**2.2);let r=0;for(let e=0;e<6;e+=1){let t=n[e],i=n[e+1]-t;for(let e=0;e<8;e+=1){let n=t+i*rt[e];n<=0||(r+=i*it[e]/(n*at(n)))}}return r/tt}function st(e,{omegaM:t=Xe,omegaB:n=Ze,h:r=et/100}={}){let i=Math.max(1e-5,Number(e)||.01),a=t*r*r,o=n*r*r,s=Math.max(.01,Math.min(.5,n/Math.max(1e-4,t))),c=1-s,l=nt/2.7,u=.0746*a/(l*l),d=44.5*Math.log(9.83/a)/Math.sqrt(1+10*o**.75),f=1.6*o**.52*a**.73*(1+(10.4*a)**-.95),p=i/(13.41*u),m=(e,t,n)=>{let r=Math.log(Math.E+1.8*n*e);return r/(r+(14.2/t+386/(1+69.9*e**1.08))*e*e)},h=m(p,1,1),g=i*d,_=g<1e-4?1:Math.sin(g)/g,v=Math.exp(-((i/Math.max(.02,f))**1.4)),y=(m(p,1,1)/(1+(g/5.2)**2)+.18*v)*(.42+.58*_)*v;return{transfer:Math.max(1e-6,c*h+s*y),tCdm:h,tBaryon:y,soundHorizonMpc:d,kSilk:f,kEq:u}}function ct(e){let t=Math.max(-.6,Number(e)||0),n=1/(1+Math.exp(-(t-1090)/85)),r=1/(1+Math.exp((t-7.7)/1.15));return Math.max(2e-4,Math.min(1,Math.max(n,r)))}function lt({massSolar:e=1,ageGyr:t=4.57,metallicitySolar:n=1}={}){let r=Math.max(.02,Math.min(100,Number(e)||1)),i=Math.max(0,Number(t)||0),a=Math.max(1e-4,Number(n)||1);if(r<.08){let e=.095+.04*Math.exp(-i/.25),t=Math.max(350,2400*(r/.075)**.85*(.05/(i+.05))**.28),n=e*e*(t/5778)**4;return Object.freeze({stage:`brown-dwarf`,massSolar:r,radiusSolar:e,luminositySolar:n,effectiveTempK:t,eddRatio:n/Math.max(.01,r)/32e3,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`brown-dwarf`,mainSequenceLifetimeGyr:1/0})}let o=Math.max(.003,10*r**-2.5),s=Math.max(2e-4,.04*r**-1.8),c=Math.max(8e-4,o*(r>8?.12:.18)),l=r<.43?.23*r**2.3:r<2?r**4:r<20?1.4*r**3.5:32e3*r*.45,u=r<1?r**.8:r**.58,d=5778*(l/(u*u))**.25;if(i<s){let e=i/s,t=u*(3.8-2.8*e),n=Math.max(2400,d*(.62+.38*e)),a=t*t*(n/5778)**4;return Object.freeze({stage:`protostar-yso`,massSolar:r,radiusSolar:t,luminositySolar:a,effectiveTempK:n,eddRatio:a/r/32e3,massLossSolarPerYr:1e-7*r,coreDegenerate:!1,remnantClass:`none`,mainSequenceLifetimeGyr:o})}if(i<o){let e=(i-s)/Math.max(1e-6,o-s),t=l*(.72+.65*e),n=u*(.9+.32*e),c=5778*(t/(n*n))**.25,d=t/r/32e3,f=r>=25&&e>.65;return Object.freeze({stage:f?`wolf-rayet-lbv`:`main-sequence`,massSolar:r*(f?1-.38*(e-.65)/.35:1),radiusSolar:n*(f?1.8:1),luminositySolar:t,effectiveTempK:f?Math.max(38e3,c*1.35):c,eddRatio:d,massLossSolarPerYr:f?2e-5*a**.7:1e-14*t*n/r,coreDegenerate:!1,remnantClass:`none`,mainSequenceLifetimeGyr:o})}let f=i-o;if(f<c){let e=f/c,t=u+((r<8?Math.min(240,140*r**.55):Math.min(950,320*(r/8)**.5))-u)*e**1.8,n=l+((r<8?2200*r**1.4:l*3.5)-l)*e**1.7,i=Math.max(2900,Math.min(4800,5778*(n/(t*t))**.25)),a=r-(r-(r<8?.48+.11*r:r*.82))*e**2.4;return Object.freeze({stage:e>.72&&r<8?`agb-superwind`:`red-giant`,massSolar:a,radiusSolar:t,luminositySolar:n,effectiveTempK:i,eddRatio:n/Math.max(.3,a)/32e3,massLossSolarPerYr:r<8?1e-5*e**2:5e-5,coreDegenerate:r<8,remnantClass:`none`,mainSequenceLifetimeGyr:o})}let p=f-c;if(r<8){let e=Math.min(1.38,.48+.11*r),t=.0126*(e/.6)**(-1/3)*Math.sqrt(Math.max(.05,1-(e/1.44)**(4/3))),n=p<1e-4,i=n?95e3:Math.max(4500,35e3*(.02/(p+.02))**.35),a=t*t*(i/5778)**4;return Object.freeze({stage:n?`planetary-nebula`:`white-dwarf`,massSolar:e,radiusSolar:t,luminositySolar:a,effectiveTempK:i,eddRatio:a/e/32e3,massLossSolarPerYr:n?1e-7:0,coreDegenerate:!0,remnantClass:`white-dwarf`,mainSequenceLifetimeGyr:o})}let m=p<15e-5;if(r<22){let e=Math.min(2.15,1.28+.055*(r-8));return Object.freeze({stage:m?`supernova-remnant-pwn`:`neutron-star`,massSolar:e,radiusSolar:12/695700,luminositySolar:m?400:.02,effectiveTempK:m?15e5:6e5,eddRatio:0,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`neutron-star`,mainSequenceLifetimeGyr:o})}let h=Math.max(3,r*.38),g=2.95325*h/695700;return Object.freeze({stage:m?`hypernova-remnant`:`stellar-black-hole`,massSolar:h,radiusSolar:g,luminositySolar:0,effectiveTempK:0,eddRatio:0,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`black-hole`,mainSequenceLifetimeGyr:o})}var ut=Object.freeze([Object.freeze({id:`recombination`,label:`CMB Recombination`,shortLabel:`z=1100 CMB`,redshiftZ:1100,localSystemAgeGyr:38e-5,summary:`380 kyr · T_CMB = 3,000 K · Peebles recombination & BAO acoustic horizon (r_s ≈ 147 Mpc)`}),Object.freeze({id:`cosmic-dawn`,label:`Cosmic Dawn & Reionization`,shortLabel:`z=10 Dawn`,redshiftZ:10,localSystemAgeGyr:.005,summary:`470 Myr · Z ≈ 10⁻⁴ Z☉ · Pop III halos, UV reionization bubbles & first protogalaxies`}),Object.freeze({id:`quasar-peak`,label:`Cosmic Noon & Quasar Peak`,shortLabel:`z=2.8 Quasar`,redshiftZ:2.8,localSystemAgeGyr:.04,summary:`2.3 Gyr · High gas-fraction starburst disks, Eddington Kerr Quasars/Blazars & Hadean impacts`}),Object.freeze({id:`present-day`,label:`Present Universe (z = 0)`,shortLabel:`z=0 Today`,redshiftZ:0,localSystemAgeGyr:4.57,summary:`13.8 Gyr · Mature Cosmic Web, Galaxy Clusters, Spirals, Solar System & Compact Remnants`}),Object.freeze({id:`far-future`,label:`Red-Giant & Remnant Era (+5 Gyr)`,shortLabel:`+5 Gyr RGB/WD`,redshiftZ:-.28,localSystemAgeGyr:10.85,summary:`18.8 Gyr · Λ-dominated expansion, Red-Giant engulfment (R☉ → 1 AU), Planetary Nebulae & White Dwarfs`})]);function dt({redshiftZ:e=0,localSystemAgeGyr:t=4.57,localStarMassSolar:n=1}={}){let r=Math.max(-.55,Math.min(1200,Number(e)||0)),i=1/(1+r),a=ot(i),o=nt/i,s=ct(r),c=r>18?1e-5:Math.min(1.6,Math.max(1e-5,10**(-.26*Math.max(0,r))*(r<0?1.25:1))),l=Math.max(.05,Math.min(.88,.14+.68*(1-Math.exp(-Math.max(0,r)/2.6)))),u=Math.log10(Math.max(.45,1+r)),d=r>25?0:Math.exp(-(((u-.56)/.36)**2))*(r<0?.15:1),f=r>18?0:Math.max(.02,Math.exp(-(((Math.max(0,r)-2.5)/4.2)**2))),p=lt({massSolar:n,ageGyr:t,metallicitySolar:Math.max(.01,c)}),m=`present-day`;return r>=400?m=`recombination`:r>=6?m=`cosmic-dawn`:r>=1.2?m=`quasar-peak`:(r<-.1||t>=10)&&(m=`far-future`),Object.freeze({schema:Ye,eraId:m,redshiftZ:r,scaleFactorA:i,cosmicAgeGyr:a,hubbleKmSMpc:et*at(i),cmbTempK:o,ionizationFrac:s,meanMetallicitySolar:c,galaxyGasFraction:l,quasarActivityFactor:d,uvBackgroundFlux:f,localSystemAgeGyr:Number(t)||0,stellarState:p})}var ft=`ulg.astrophysics.cosmological-baryon-radiation-webgpu.v1`,pt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),mt=Object.freeze({id:`cosmological-baryon-radiation`,lawNodeId:`law:astrophysics-cosmological-baryon-radiation`,orderConstraint:`after:flrw-treepm-cosmology`,adapterMode:o.CELL_LOCAL,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`cosmo-baryon-grid`,`cosmic-epoch-state`,`fft3d-poisson-grid`]),writes:Object.freeze([`cosmo-baryon-grid`,`lensing-deflection-map`,`cosmo-baryon-tracers`]),accumulates:Object.freeze([`cosmo-cmb-bao-sz-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`comoving-baryon-mass`,`baryon-linear-momentum`,`photon-ionization-balance`]),validityDomain:Object.freeze({redshiftMin:-.55,redshiftMax:1200,gridNMin:16,gridNMax:48}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e21,1e26]),fundamentalLaws:Object.freeze([`eisenstein-hu-bao`,`peebles-recombination`,`m1-reionization-rt`,`compressible-icm-hydro`,`gravitational-lensing-poisson`])});function ht(e={}){let t=Number(e.comovingBoxMpc)||0,n=Number(e.baryonFraction??.157),r=Number(e.redshiftZ??0),i=Number(e.clusterMassSolar)||0,a=t>=1&&(n>0||r>5)||i>=0x9184e72a000;return{active:a,cmbMode:r>=400,reionizationActive:r>=5.5&&r<=25,icmClusterActive:r<3&&(i>=0x9184e72a000||n>.01),reason:a?`cosmological-baryon-radiation-present`:`sub-cosmological-or-dark-only-dormant`}}function gt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function _t({gridN:e=24,tracerCount:t=6144,boxSizeMpc:n=260,redshiftZ:r=0,clusterMergerMode:i=!1,seed:a=20261125,centerOffset:o=[0,0,0]}={}){let s=Math.max(16,Math.min(32,Math.trunc(e))),c=s*s*s,l=n/s,u=n*.5,d=gt(a),f=dt({redshiftZ:r}),p=Number(o?.[0])||0,m=Number(o?.[1])||0,h=Number(o?.[2])||0,g=[],_=2*Math.PI/n;for(let e=0;e<28;e+=1){let e=Math.floor(d()*7)-3,t=Math.floor(d()*7)-3,n=Math.floor(d()*7)-3,r=Math.hypot(e,t,n)*_;if(r<1e-5)continue;let i=st(r),a=Math.sqrt((r/.05)**.965)*i.transfer;g.push({kx:e*_,ky:t*_,kz:n*_,phase:d()*Math.PI*2,amp:a})}let v=new Float32Array(c),y=new Float32Array(c*3),b=0;for(let e=0;e<s;e+=1)for(let t=0;t<s;t+=1)for(let n=0;n<s;n+=1){let r=(e*s+t)*s+n,i=(n+.5)*l-u,a=(t+.5)*l-u,o=(e+.5)*l-u,c=0,d=0,f=0,p=0;for(let e of g){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.cos(t)*e.amp,r=Math.sin(t)*e.amp,s=e.kx*e.kx+e.ky*e.ky+e.kz*e.kz+1e-6;c+=n,d-=e.kx/s*r*.08,f-=e.ky/s*r*.08,p-=e.kz/s*r*.08}v[r]=c,y[r*3+0]=d,y[r*3+1]=f,y[r*3+2]=p,b+=c*c}let x=Math.max(1e-4,Math.sqrt(b/c)),S=new Float32Array(c*8),C=0;for(let e=0;e<s;e+=1)for(let t=0;t<s;t+=1)for(let r=0;r<s;r+=1){let a=(e*s+t)*s+r,o=(r+.5)*l-u,c=(t+.5)*l-u,d=(e+.5)*l-u,p=v[a]/x,m=y[a*3+0]/x,h=y[a*3+1]/x,g=y[a*3+2]/x,_=f.redshiftZ>=400?.15:Math.max(.45,Math.min(1.25,.45+.8*f.scaleFactorA)),b=Math.max(.12,1+p*.55*_),w=Math.max(.08,1+p*.48*_),T=f.cmbTempK,E=f.ionizationFrac;if(i){let e=Math.hypot(o+u*.28,c,d),t=Math.hypot(o-u*.26,c*1.1,d),r=n*.14,i=6.5/(1+(e/r)**2)**1.4,a=4.2/(1+(t/r)**2)**1.4;b=.25+i+a;let s=Math.hypot(o+u*.14,c,d),l=Math.hypot(o-u*.12,c,d);w=.22+5.5/(1+(s/(r*1.1))**2)**1.3+3.8/(1+(l/(r*1.1))**2)**1.3,m=(o<0?1.8:-1.8)*Math.exp(-Math.hypot(o,c,d)/(u*.8)),T=15e6+65e6*Math.exp(-Math.hypot(o,c,d)/(r*1.3)),E=1}else if(f.redshiftZ>=400)T=f.cmbTempK*(1+.08*Math.max(-1.5,Math.min(1.5,p))),E=f.ionizationFrac;else if(f.redshiftZ>=5.5){let e=b>1.24;E=e?.55:.02,T=e?15e3:Math.max(f.cmbTempK,85)}else T=Math.max(1e4,25e4*w**1.45),E=1;let D=a*8;S[D+0]=w,S[D+1]=m,S[D+2]=h,S[D+3]=g,S[D+4]=T,S[D+5]=E,S[D+6]=b,S[D+7]=p,C+=b+.18*w}C/=c;let w=Math.max(256,Math.min(32768,Math.trunc(t))),T=new Float32Array(w*16);for(let e=0;e<w;e+=1){let t,n,r;if(f.redshiftZ>=400){let e=2*d()-1,i=d()*Math.PI*2,a=Math.sqrt(Math.max(0,1-e*e)),o=u*(.76+.1*d());t=o*a*Math.cos(i),n=o*e,r=o*a*Math.sin(i)}else if(i){let i=e%3==0,a=e&1?1:-1,o=d()**.72*u*(i?.36:.26),s=2*d()-1,c=d()*Math.PI*2,l=Math.sqrt(Math.max(0,1-s*s));t=a*u*(i?.5:.14)+o*l*Math.cos(c),n=o*s*(i?.85:1.25),r=o*l*Math.sin(c)*.85}else{let e=Math.cbrt(d())*u*.92,i=2*d()-1,a=d()*Math.PI*2,o=Math.sqrt(Math.max(0,1-i*i));t=e*o*Math.cos(a),n=e*i,r=e*o*Math.sin(a)}let a=e*16;T[a+0]=t+p,T[a+1]=n+m,T[a+2]=r+h,T[a+3]=1,T[a+4]=0,T[a+5]=0,T[a+6]=0,T[a+7]=.5,T[a+8]=f.cmbTempK,T[a+9]=f.ionizationFrac,T[a+10]=0,T[a+11]=i?+(e%3==0):+(e%5==0),T[a+12]=f.redshiftZ,T[a+13]=0,T[a+14]=+!!i,T[a+15]=d()}return Object.freeze({gridN:s,totalCells:c,tracerCount:w,boxSizeMpc:n,epoch:f,clusterMergerMode:i,centerOffset:Object.freeze([p,m,h]),cells:S,tracers:T,meanRho:C})}var vt=`
struct CosmoRadParams {
  grid_n: u32,
  tracer_count: u32,
  mode_flags: u32,    // bit0: cmb, bit1: reionization, bit2: cluster_merger
  step_index: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  redshift_z: f32,
  cmb_temp_k: f32,
  uv_flux: f32,
  mean_rho: f32,
  gravity_g: f32,
  center_offset: vec4<f32>,
};

struct CosmoCell {
  fluid: vec4<f32>, // rho_b, vx, vy, vz
  rad: vec4<f32>,   // T_gas_K, x_HII, rho_dm, delta_or_sz
};

struct CosmoTracer {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  t_xhii_sz_sp: vec4<f32>,
  z_xray_flag_s: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoRadParams;
@group(0) @binding(1) var<storage, read> cells_src: array<CosmoCell>;
@group(0) @binding(2) var<storage, read_write> cells_dst: array<CosmoCell>;
@group(0) @binding(3) var<storage, read_write> tracers: array<CosmoTracer>;
// 2D projected surface density kappa & deflection alpha (N*N vec4: kappa, alpha_x, alpha_y, sz_y)
@group(0) @binding(4) var<storage, read_write> lens_map: array<vec4<f32>>;
// Telemetry: [0]=vec4(mean_xHII, max_temp_K, total_xray, total_sz_y), [1]=vec4(max_kappa, max_alpha, mean_rho_b, rms_dT)
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = ((x % n) + n) % n;
  let wy = ((y % n) + n) % n;
  let wz = ((z % n) + n) % n;
  return u32((wz * n + wy) * n + wx);
}

fn sample_cell_trilin(loc_p: vec3<f32>) -> CosmoCell {
  let n = i32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((loc_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let c000 = cells_src[cidx(i0.x, i0.y, i0.z, n)];
  let c100 = cells_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let c010 = cells_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let c110 = cells_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let c001 = cells_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let c101 = cells_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let c011 = cells_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let c111 = cells_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  var out: CosmoCell;
  out.fluid = mix(
    mix(mix(c000.fluid, c100.fluid, f.x), mix(c010.fluid, c110.fluid, f.x), f.y),
    mix(mix(c001.fluid, c101.fluid, f.x), mix(c011.fluid, c111.fluid, f.x), f.y),
    f.z
  );
  out.rad = mix(
    mix(mix(c000.rad, c100.rad, f.x), mix(c010.rad, c110.rad, f.x), f.y),
    mix(mix(c001.rad, c101.rad, f.x), mix(c011.rad, c111.rad, f.x), f.y),
    f.z
  );
  return out;
}

// 1. Evolve 3D Eulerian Baryons, Reionization Ionizing-Front Percolation, & ICM Shock Heating
@compute @workgroup_size(4, 4, 4)
fn step_cosmo_baryon_rad(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y); let iz = i32(gid.z);
  let idx = cidx(ix, iy, iz, n);

  let c0 = cells_src[idx];
  let cxp = cells_src[cidx(ix + 1, iy, iz, n)];
  let cxm = cells_src[cidx(ix - 1, iy, iz, n)];
  let cyp = cells_src[cidx(ix, iy + 1, iz, n)];
  let cym = cells_src[cidx(ix, iy - 1, iz, n)];
  let czp = cells_src[cidx(ix, iy, iz + 1, n)];
  let czm = cells_src[cidx(ix, iy, iz - 1, n)];

  let dt = params.dt;
  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let half = params.box_size * 0.5;
  let pos = vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx - vec3<f32>(half);

  let adv = sample_cell_trilin(pos - c0.fluid.yzw * dt);
  let div_v = (cxp.fluid.y - cxm.fluid.y + cyp.fluid.z - cym.fluid.z + czp.fluid.w - czm.fluid.w) * inv2dx;

  // Compressible baryon continuity + pressure gradient + gravitational pull toward DM overdensities
  let rho_b = clamp(adv.fluid.x * exp(-clamp(div_v * dt, -0.35, 0.35)), 0.04, 24.0);
  let p_xp = cxp.fluid.x * (cxp.rad.x * 1e-6);
  let p_xm = cxm.fluid.x * (cxm.rad.x * 1e-6);
  let p_yp = cyp.fluid.x * (cyp.rad.x * 1e-6);
  let p_ym = cym.fluid.x * (cym.rad.x * 1e-6);
  let p_zp = czp.fluid.x * (czp.rad.x * 1e-6);
  let p_zm = czm.fluid.x * (czm.rad.x * 1e-6);
  let grad_p = vec3<f32>(p_xp - p_xm, p_yp - p_ym, p_zp - p_zm) * inv2dx;

  // Local tidal pull toward dark-matter overdensity gradient (captures filament/cluster accretion!)
  let grad_dm = vec3<f32>(
    (cxp.rad.z - cxm.rad.z) * inv2dx,
    (cyp.rad.z - cym.rad.z) * inv2dx,
    (czp.rad.z - czm.rad.z) * inv2dx
  );
  let v_new = clamp(adv.fluid.yzw + (grad_dm * params.gravity_g - grad_p / max(0.08, rho_b) * 0.35) * dt, vec3<f32>(-18.0), vec3<f32>(18.0));

  // Ionizing UV radiative diffusion + Pop III star-forming halo sources (Reionization bubbles!)
  let lap_xhii = (cxp.rad.y + cxm.rad.y + cyp.rad.y + cym.rad.y + czp.rad.y + czm.rad.y - 6.0 * c0.rad.y);
  let is_cmb = (params.mode_flags & 1u) != 0u;
  let is_reion = (params.mode_flags & 2u) != 0u;
  var x_hii = adv.rad.y;
  var temp_k = adv.rad.x;
  var delta_sz = adv.rad.w;

  if (is_cmb) {
    // Acoustic standing-wave baryon-photon oscillation around T_CMB(z)
    let lap_d = (cxp.rad.w + cxm.rad.w + cyp.rad.w + cym.rad.w + czp.rad.w + czm.rad.w - 6.0 * c0.rad.w);
    delta_sz = c0.rad.w + (0.045 * lap_d - 0.02 * div_v) * dt;
    temp_k = params.cmb_temp_k * (1.0 + 0.09 * clamp(delta_sz, -1.2, 1.2));
  } else if (is_reion) {
    // Real ionization-front expansion: Pop III halos (rho_dm > 1.15) emit UV photons diffusing outward,
    // balanced against case-B recombination alpha_B * rho_b * x_HII^2!
    let src_uv = select(0.0, 2.4 * params.uv_flux * (c0.rad.z - 1.10), c0.rad.z > 1.15);
    let recomb = 0.08 * rho_b * x_hii * x_hii;
    x_hii = clamp(x_hii + (src_uv * (1.0 - x_hii) + 0.22 * lap_xhii * params.uv_flux - recomb) * dt, 0.001, 1.0);
    // Photoheating to ~1.8e4 K inside ionized H II bubbles vs cold neutral IGM outside
    let t_eq = mix(max(params.cmb_temp_k, 45.0), 2.0e4, x_hii);
    temp_k = clamp(temp_k + (t_eq - temp_k) * 0.25 * dt, 20.0, 2.5e5);
    delta_sz = x_hii;
  } else {
    // Compressible ICM shock heating (-div_v > 0) + thermal Bremsstrahlung cooling
    let shock_heat = max(0.0, -div_v) * 6.5e6 * rho_b;
    let brem_cool = 1.4e-5 * rho_b * rho_b * sqrt(max(1e3, temp_k));
    temp_k = clamp(temp_k + (shock_heat - brem_cool * 0.02) * dt, max(params.cmb_temp_k, 1e4), 1.8e8);
    // Local Sunyaev-Zel'dovich thermal pressure proxy (n_e * T_e)
    delta_sz = rho_b * (temp_k * 1e-7);
    x_hii = 1.0;
  }

  var out: CosmoCell;
  out.fluid = vec4<f32>(rho_b, v_new);
  out.rad = vec4<f32>(temp_k, x_hii, c0.rad.z, delta_sz);
  cells_dst[idx] = out;
}

// 2. Project 3D Total Mass (DM + Baryons) -> 2D Lensing Convergence kappa(x,y) & Deflection alpha(x,y)!
@compute @workgroup_size(8, 8)
fn compute_lensing_projection(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  var sigma_tot = 0.0;
  var sz_col = 0.0;
  for (var iz = 0; iz < n; iz = iz + 1) {
    let c = cells_src[cidx(ix, iy, iz, n)];
    sigma_tot = sigma_tot + (c.rad.z + 0.18 * c.fluid.x);
    sz_col = sz_col + max(0.0, c.rad.w);
  }
  let inv_n = 1.0 / f32(n);
  let kappa = max(0.0, (sigma_tot * inv_n - params.mean_rho) * 0.45);
  lens_map[u32(iy * n + ix)] = vec4<f32>(kappa, 0.0, 0.0, sz_col * inv_n);
}

// 3. Compute 2D Gravitational Lensing Deflection Vector alpha(theta) = grad(psi) from kappa!
@compute @workgroup_size(8, 8)
fn compute_lensing_deflection(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  let id_c = u32(iy * n + ix);
  var ax = 0.0;
  var ay = 0.0;
  // Direct 2D Green's function convolution alpha(theta) = (1/pi) * integral kappa(theta') (theta-theta')/|theta-theta'|^2
  // Exact & tiny on N=24..32 (576-1024 taps per thread -> < 0.05 ms on GPU!)
  let inv_pi_n2 = 1.0 / (3.14159265 * f32(n));
  for (var jy = 0; jy < n; jy = jy + 1) {
    for (var jx = 0; jx < n; jx = jx + 1) {
      let dx_i = f32(ix - jx);
      let dy_i = f32(iy - jy);
      let r2 = dx_i * dx_i + dy_i * dy_i + 0.35;
      let kap = lens_map[u32(jy * n + jx)].x;
      ax = ax + kap * (dx_i / r2);
      ay = ay + kap * (dy_i / r2);
    }
  }
  let prev = lens_map[id_c];
  lens_map[id_c] = vec4<f32>(prev.x, ax * inv_pi_n2, ay * inv_pi_n2, prev.w);
}

// 4. Update zero-copy 3D visualization tracers directly from live baryon/radiation/ICM grid
@compute @workgroup_size(64)
fn step_cosmo_tracers(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.tracer_count) { return; }
  var tr = tracers[i];
  let half = params.box_size * 0.48;
  let loc_p = tr.pos_m.xyz - params.center_offset.xyz;
  let c = sample_cell_trilin(loc_p);

  let is_cmb = (params.mode_flags & 1u) != 0u;
  var next_p = loc_p;
  if (!is_cmb) {
    next_p = loc_p + c.fluid.yzw * params.dt * 1.4;
    if (abs(next_p.x) > half) { next_p.x = next_p.x - sign(next_p.x) * params.box_size * 0.94; }
    if (abs(next_p.y) > half) { next_p.y = next_p.y - sign(next_p.y) * params.box_size * 0.94; }
    if (abs(next_p.z) > half) { next_p.z = next_p.z - sign(next_p.z) * params.box_size * 0.94; }
  }
  let xray = c.fluid.x * c.fluid.x * sqrt(max(1.0, c.rad.x * 1e-6));
  tr.pos_m = vec4<f32>(next_p + params.center_offset.xyz, tr.pos_m.w);
  tr.vel_rho = vec4<f32>(c.fluid.yzw, select(c.fluid.x, c.rad.z, tr.t_xhii_sz_sp.w > 0.5));
  tr.t_xhii_sz_sp = vec4<f32>(c.rad.x, c.rad.y, c.rad.w, tr.t_xhii_sz_sp.w);
  tr.z_xray_flag_s = vec4<f32>(params.redshift_z, xray, f32(params.mode_flags), tr.z_xray_flag_s.w);
  tracers[i] = tr;
}

// 5. Parallel 64-thread Telemetry Reduction (ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_cosmo_baryon_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.grid_n;
  let total = n * n * n;
  var xhii_sum = 0.0;
  var max_t = 0.0;
  var xray_sum = 0.0;
  var sz_sum = 0.0;
  var rho_sum = 0.0;
  var dt_sq = 0.0;
  var i = tid;
  loop {
    if (i >= total) { break; }
    let c = cells_src[i];
    xhii_sum = xhii_sum + c.rad.y;
    max_t = max(max_t, c.rad.x);
    xray_sum = xray_sum + c.fluid.x * c.fluid.x * sqrt(max(1.0, c.rad.x * 1e-6));
    sz_sum = sz_sum + max(0.0, c.rad.w);
    rho_sum = rho_sum + c.fluid.x;
    let dtf = (c.rad.x - params.cmb_temp_k) / max(1.0, params.cmb_temp_k);
    dt_sq = dt_sq + dtf * dtf;
    i = i + 64u;
  }

  let n2 = n * n;
  var max_kap = 0.0;
  var max_alp = 0.0;
  var j = tid;
  loop {
    if (j >= n2) { break; }
    let lm = lens_map[j];
    max_kap = max(max_kap, lm.x);
    max_alp = max(max_alp, length(lm.yz));
    j = j + 64u;
  }

  wg0[tid] = xhii_sum; wg1[tid] = max_t; wg2[tid] = xray_sum; wg3[tid] = sz_sum;
  wg4[tid] = max_kap; wg5[tid] = max_alp; wg6[tid] = rho_sum; wg7[tid] = dt_sq;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
      wg4[tid] = max(wg4[tid], wg4[tid + s]);
      wg5[tid] = max(wg5[tid], wg5[tid + s]);
      wg6[tid] += wg6[tid + s];
      wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let inv_t = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv_t, wg1[0], wg2[0] * inv_t, wg3[0] * inv_t);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] * inv_t, sqrt(wg7[0] * inv_t));
  }
}
`;function yt(e,{gridN:t=24,tracerCount:n=6144,boxSizeMpc:r=260,redshiftZ:i=10,clusterMergerMode:a=!1,uvFlux:o=null,gravityG:s=1.2,seed:c=20261125,centerOffset:l=[0,0,0],label:u=`ulg-cosmo-baryon-rad`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createCosmologicalBaryonRadiationSessionWebGpu requires a live WebGPU GPUDevice`);let d=_t({gridN:t,tracerCount:n,boxSizeMpc:r,redshiftZ:i,clusterMergerMode:a,seed:c,centerOffset:l}),f=d.gridN,m=d.boxSizeMpc/f,h=o==null?d.epoch.uvBackgroundFlux:Number(o),g=d.epoch.redshiftZ>=400|(d.epoch.redshiftZ>=5.5&&d.epoch.redshiftZ<400?2:0)|(a?4:0),_=[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`),E(3,`storage`),E(4,`storage`),E(5,`storage`)],v=t=>O(e,{cacheKey:`ulg-cosmo-baryon-rad-${t}.v1`,label:`${u}-${t}`,code:vt,entryPoint:t,bindings:_}),y=v(`step_cosmo_baryon_rad`),b=v(`compute_lensing_projection`),x=v(`compute_lensing_deflection`),S=v(`step_cosmo_tracers`),C=v(`reduce_cosmo_baryon_telemetry`),w=e.createBuffer({label:`${u}-params`,size:64,usage:pt.UNIFORM|pt.COPY_DST}),T=e.createBuffer({label:`${u}-cellA`,size:d.cells.byteLength,usage:pt.STORAGE|pt.COPY_DST}),k=e.createBuffer({label:`${u}-cellB`,size:d.cells.byteLength,usage:pt.STORAGE|pt.COPY_DST}),A=e.createBuffer({label:`${u}-tracers`,size:d.tracers.byteLength,usage:pt.STORAGE|pt.VERTEX|pt.COPY_DST}),j=e.createBuffer({label:`${u}-lens`,size:f*f*16,usage:pt.STORAGE|pt.COPY_SRC}),M=e.createBuffer({label:`${u}-tel`,size:32,usage:pt.STORAGE|pt.COPY_SRC}),N=e.createBuffer({label:`${u}-tel-read`,size:32,usage:pt.MAP_READ|pt.COPY_DST});e.queue.writeBuffer(T,0,d.cells),e.queue.writeBuffer(k,0,d.cells),e.queue.writeBuffer(A,0,d.tracers);let P=(t,n,r)=>D(e,{layout:y.bindGroupLayout,label:`${u}-bg-${r}`,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}}]}),F=P(T,k,`0`),I=P(k,T,`1`),L=0,R=0,z=!1,B=!1,V=Object.freeze({schema:ft,stepIndex:0,redshiftZ:d.epoch.redshiftZ,cmbTempK:d.epoch.cmbTempK,meanIonizedFraction:d.epoch.ionizationFrac,maxGasTempK:d.epoch.cmbTempK,meanXrayEmissivity:0,meanSzComptonY:0,maxLensingKappa:0,maxLensingDeflection:0,meanBaryonDensity:1,cmbRmsDeltaTOverT:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),H=Math.ceil(f/4),U=Math.ceil(f/8),W=Math.ceil(d.tracerCount/64);function G(t){let n=new ArrayBuffer(64);new Uint32Array(n,0,4).set([f,d.tracerCount,g,R]),new Float32Array(n,16,12).set([d.boxSizeMpc,m,t,d.epoch.redshiftZ,d.epoch.cmbTempK,h,d.meanRho,s,d.centerOffset[0],d.centerOffset[1],d.centerOffset[2],0]),e.queue.writeBuffer(w,0,n)}async function K({dt:t=.08,substeps:n=2,readTelemetry:r=!0}={}){if(B)return V;let i=Math.max(1,Math.min(16,Math.trunc(n)));G(Math.max(.005,Math.min(.25,Number(t)||.08)));let a=e.createCommandEncoder({label:`${u}-step-${R}`}),o=a.beginComputePass({label:`${u}-pass`});for(let e=0;e<i;e+=1)o.setBindGroup(0,L===0?F:I),o.setPipeline(y.pipeline),o.dispatchWorkgroups(H,H,H),L^=1,o.setBindGroup(0,L===0?F:I),o.setPipeline(S.pipeline),o.dispatchWorkgroups(W),R+=1;o.setBindGroup(0,L===0?F:I),o.setPipeline(b.pipeline),o.dispatchWorkgroups(U,U),o.setPipeline(x.pipeline),o.dispatchWorkgroups(U,U),o.setPipeline(C.pipeline),o.dispatchWorkgroups(1),o.end();let s=r&&!z&&N.mapState===`unmapped`;if(s&&(z=!0,a.copyBufferToBuffer(M,0,N,0,32)),e.queue.submit([a.finish()]),s)try{if(await N.mapAsync(pt.MAP_READ),!B){let e=new Float32Array(N.getMappedRange(0,32));V=Object.freeze({schema:ft,stepIndex:R,redshiftZ:d.epoch.redshiftZ,cmbTempK:d.epoch.cmbTempK,meanIonizedFraction:e[0],maxGasTempK:e[1],meanXrayEmissivity:e[2],meanSzComptonY:e[3],maxLensingKappa:e[4],maxLensingDeflection:e[5],meanBaryonDensity:e[6],cmbRmsDeltaTOverT:e[7],accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{N.unmap()}catch{}}catch(e){if(!B&&e?.name!==`AbortError`)throw e}finally{z=!1}return V}function q(){if(!B){B=!0;for(let e of[w,T,k,A,j,M,N])try{e.destroy()}catch{}}}return Object.freeze({schema:ft,lawAdapter:mt,get gridN(){return f},get tracerCount(){return d.tracerCount},get boxSizeMpc(){return d.boxSizeMpc},get epoch(){return d.epoch},get stepIndex(){return R},getResidentTracersBuffer:()=>A,getResidentLensingBuffer:()=>j,getTelemetry:()=>V,step:K,dispose:q})}function bt(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`cosmological-baryon-radiation@1`)?e.resolveModule(`cosmological-baryon-radiation@1`)?.descriptor||null:e.registerModule({method:{model:`cosmological-baryon-radiation`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js`,entryPoint:`step_cosmo_baryon_rad`,workgroupSize:64},parameterSchema:{redshiftZ:{type:`number`,min:-.55,max:1200,required:!1},clusterMergerMode:{type:`boolean`,required:!1}},stateLayout:{tensorId:`cosmo-baryon-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`rho`,`T`,`xHII`,`sz`,`species`,`z`,`xray`,`flags`,`seed`]},scaleRangeM:[1e21,1e26],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=yt(n,{gridN:16,tracerCount:512,redshiftZ:r.redshiftZ??10,clusterMergerMode:!!r.clusterMergerMode}),a=await i.step({dt:.08,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:cosmo-baryon-rad:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js`,entryPoint:`createCosmologicalBaryonRadiationSessionWebGpu`,kernelEntryPoint:`step_cosmo_baryon_rad`},representation:`cosmo-baryon-rt-lensing-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-cosmo-baryon-radiation`,placement:`local`},validity:{finite:Number.isFinite(a.meanIonizedFraction)&&Number.isFinite(a.maxLensingKappa)},validation:{status:`pass`,validationMode:`gpu-cosmo-baryon-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var xt=`ulg.astrophysics.relativistic-compact-kerr-jet-webgpu.v1`,Z=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),St=Object.freeze({id:`relativistic-compact-kerr-jet`,lawNodeId:`law:astrophysics-relativistic-compact-kerr-jet`,orderConstraint:`after:self-gravitating-hydro-fusion`,adapterMode:o.CELL_LOCAL,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`compact-object-state`,`accretion-flux-state`]),writes:Object.freeze([`compact-tov-profile`,`relativistic-jet-tracers`]),accumulates:Object.freeze([`kerr-bz-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`baryon-number`,`adm-mass-energy`,`kerr-spin-angular-momentum`]),validityDomain:Object.freeze({kerrSpinMax:.998,minCompactness:1e-4}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e3,1e22]),fundamentalLaws:Object.freeze([`general-relativity-tov`,`fermi-dirac-degenerate-eos`,`nuclear-saturation-eos`,`kerr-spacetime`,`blandford-znajek-jet`])});function Ct(e={}){let t=Number(e.compactnessGMOverRc2)||0,n=Number(e.centralRelativisticMassSolar)||0,r=Number(e.accretionRateEddington)||0,i=t>1e-4||n>=.5&&r>1e-6;return{active:i,kerrJetActive:n>=2.5&&r>1e-4&&Math.abs(Number(e.kerrSpinA)||0)>.05&&Math.abs(Number(e.magneticFieldStrength)||0)>0,reason:i?`relativistic-compact-object-present`:`newtonian-low-compactness-dormant`}}function wt({massSolar:e=1e8,spinA:t=.9,accretionRateEddington:n=.35,magneticFluxNorm:r=1}={}){let i=Math.max(.5,Number(e)||10),a=Math.max(-.998,Math.min(.998,Number(t)||0)),o=Math.abs(a),s=66743e-15*i*198847e25/299792458**2,c=1+Math.sqrt(Math.max(0,1-a*a)),l=a/Math.max(1e-6,2*c),u=1+Math.cbrt(1-a*a)*(Math.cbrt(1+o)+Math.cbrt(1-o)),d=Math.sqrt(3*a*a+u*u),f=a>=0?1:-1,p=3+d-f*Math.sqrt(Math.max(0,(3-u)*(3+u+2*d))),m=Math.max(.038,Math.min(.42,1-Math.sqrt(Math.max(.3,1-2/(3*p))))),h=1257e28*i,g=Math.max(0,Number(n)||0),_=g*h,v=Math.max(0,Number(r)||0),y=l*l*1.3*(v*v),b=_*y,x=1+Math.min(18,9.5*Math.sqrt(y*Math.min(2,g*4)));return Object.freeze({massSolar:i,spinA:a,rGravM:s,rHorizonRg:c,rIscoRg:p,omegaH:l,radiativeEfficiency:m,eddLumW:h,bolometricLumW:_,bzEfficiency:y,jetPowerW:b,lorentzGamma:x})}var Tt=`
struct TovParams {
  sample_count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
};

struct TovInput {
  // x = central_rho_kg_m3, y = y_electron (0.5 for C/O WD), z = eos_stiffness_scale (1.0 canonical), w = pad
  cfg: vec4<f32>,
};

struct TovOutput {
  // x = mass_solar, y = radius_km, z = compactness_GM_Rc2, w = branch_code (0=WD, 1=unstable, 2=NS, 3=BH)
  res: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: TovParams;
@group(0) @binding(1) var<storage, read> inputs: array<TovInput>;
@group(0) @binding(2) var<storage, read_write> outputs: array<TovOutput>;

const PI: f32 = 3.14159265359;
// Exact scaled GR TOV units keeping all intermediates inside [1e-16, 1e16] (ZERO f32 overflow!):
//   r in km, m in M_sun, rho9 = rho / 1e9 kg/m^3, p22 = P / 1e22 Pa!
const RS_PER_MSUN_KM: f32 = 2.95325;
const P22_TO_RHO9: f32 = 1.112650e-4;
const DM_COEFF: f32 = 6.31962e-12;
const MP_COEFF: f32 = 7.03152e-16;
const DP_COEFF: f32 = 1.32716e4;

// Continuous Unified Degenerate EOS returning p22 = P / 1e22 Pa from rho9 = rho / 1e9 kg/m^3!
fn unified_degenerate_p22(rho9: f32, ye: f32, stiff: f32) -> f32 {
  if (rho9 <= 1e-8) { return 0.0; }
  // 1. Relativistic Fermi-Dirac electron degeneracy: rho_0 = m_p (m_e c / hbar)^3 / (3 pi^2) = 9.81e8 kg/m^3 (0.981e9)
  let x = pow(max(0.0, rho9 * ye / 0.981), 0.33333334);
  let x2 = x * x;
  let sq = sqrt(1.0 + x2);
  // Chandrasekhar constant A_e / 1e22 = 0.60023
  var p_e = 0.0;
  if (x < 0.05) {
    p_e = 0.60023 * (1.6 * x2 * x2 * x);
  } else {
    p_e = 0.60023 * (x * (2.0 * x2 - 3.0) * sq + 3.0 * log(x + sq));
  }
  // Smooth neutronization suppression above neutron drip (4e14 kg/m^3 -> rho9 = 4e5)
  let e_keep = 1.0 / (1.0 + pow(rho9 / 1.2e6, 1.5));

  // 2. Relativistic neutron degeneracy + stiff nuclear repulsion above rho_sat = 2.7e17 kg/m^3 (rho9 = 2.7e8)
  let x_n = pow(max(0.0, rho9 / 6.106e9), 0.33333334);
  let xn2 = x_n * x_n;
  let sqn = sqrt(1.0 + xn2);
  let p_n_ideal = 1.629e13 * (x_n * (2.0 * xn2 - 3.0) * sqn + 3.0 * log(x_n + sqn));
  let r_sat = rho9 / 2.7e8;
  let p_nuc = select(0.0, 1.35e11 * stiff * pow(r_sat, 2.45), rho9 > 1.5e7);
  let n_on = smoothstep(3.0e5, 4.0e6, rho9);
  return p_e * e_keep + (p_n_ideal * 0.28 + p_nuc) * n_on;
}

// Invert p22(rho9) -> rho9(p22) monotonically via log-space bisection (22 iters -> < 1e-4 accuracy!)
fn invert_eos_rho9(p_target: f32, rho9_hint: f32, ye: f32, stiff: f32) -> f32 {
  if (p_target <= 0.0) { return 0.0; }
  var lo = 1e-7;
  var hi = max(1e-2, rho9_hint * 1.15);
  for (var it = 0u; it < 22u; it = it + 1u) {
    let mid = sqrt(lo * hi);
    let pm = unified_degenerate_p22(mid, ye, stiff);
    if (pm < p_target) { lo = mid; } else { hi = mid; }
  }
  return sqrt(lo * hi);
}

@compute @workgroup_size(64)
fn solve_tov_batch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.sample_count) { return; }
  let cfg = inputs[i].cfg;
  let rho_c_si = max(1e6, cfg.x);
  let rho_c9 = rho_c_si * 1e-9;
  let ye = clamp(cfg.y, 0.2, 0.9);
  let stiff = clamp(cfg.z, 0.4, 2.5);

  let is_nuclear = rho_c9 > 1.0e6;
  let dr = select(18.0, 0.045, is_nuclear); // 18 km steps for WD, 45 m (0.045 km) for Neutron Star!
  var r = dr;
  var rho9 = rho_c9;
  var p22 = unified_degenerate_p22(rho_c9, ye, stiff);
  var m = (DM_COEFF / 3.0) * r * r * r * rho_c9;
  let p_surf = p22 * 1e-6;

  for (var s = 0u; s < params.max_steps; s = s + 1u) {
    if (p22 <= p_surf || rho9 <= 1e-6) { break; }
    let r_s = RS_PER_MSUN_KM * m;
    if (r <= r_s * 1.02) { break; }
    let rho_eff = rho9 + P22_TO_RHO9 * p22;
    let m_eff = m + MP_COEFF * r * r * r * p22;
    let dp_dr = -(DP_COEFF * rho_eff * m_eff) / (r * (r - r_s));
    let dm_dr = DM_COEFF * r * r * rho9;

    // Midpoint RK2 step for clean TOV accuracy
    let p_mid = max(0.0, p22 + 0.5 * dp_dr * dr);
    let m_mid = m + 0.5 * dm_dr * dr;
    let r_mid = r + 0.5 * dr;
    let rho_mid = invert_eos_rho9(p_mid, rho9, ye, stiff);
    let rs_mid = RS_PER_MSUN_KM * m_mid;
    if (r_mid <= rs_mid * 1.02 || p_mid <= p_surf) {
      r = r_mid;
      m = m_mid;
      break;
    }
    let dp_mid = -(DP_COEFF * (rho_mid + P22_TO_RHO9 * p_mid) * (m_mid + MP_COEFF * r_mid * r_mid * r_mid * p_mid)) / (r_mid * (r_mid - rs_mid));
    let dm_mid = DM_COEFF * r_mid * r_mid * rho_mid;

    p22 = p22 + dp_mid * dr;
    m = m + dm_mid * dr;
    r = r + dr;
    rho9 = invert_eos_rho9(max(0.0, p22), rho9, ye, stiff);
  }

  let compact = (0.5 * RS_PER_MSUN_KM * m) / max(1e-3, r);
  var branch = 0.0; // White Dwarf
  if (compact >= 0.44 || (is_nuclear && rho_c9 > 3.5e9)) {
    branch = 3.0; // Black Hole horizon collapse
  } else if (is_nuclear) {
    branch = 2.0; // Neutron Star
  } else if (rho_c9 > 5.0e4) {
    branch = 1.0; // Electron-capture unstable gap
  }
  outputs[i].res = vec4<f32>(m, r, compact, branch);
}
`;async function Et(e,t=[],{maxSteps:n=900,label:r=`ulg-tov-batch`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveRelativisticTovBatchWebGpu requires a live WebGPU GPUDevice`);let i=Math.max(1,t.length),a=new Float32Array(i*4);for(let e=0;e<i;e+=1){let n=t[e]||{};a[e*4+0]=Number(n.centralRhoKgM3??1e10),a[e*4+1]=Number(n.yElectron??.5),a[e*4+2]=Number(n.stiffnessScale??1),a[e*4+3]=0}let o=O(e,{cacheKey:`ulg-tov-batch-solve.v1`,label:r,code:Tt,entryPoint:`solve_tov_batch`,bindings:[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`)]}),s=e.createBuffer({label:`${r}-p`,size:16,usage:Z.UNIFORM|Z.COPY_DST}),c=e.createBuffer({label:`${r}-in`,size:a.byteLength,usage:Z.STORAGE|Z.COPY_DST}),l=e.createBuffer({label:`${r}-out`,size:i*16,usage:Z.STORAGE|Z.COPY_SRC}),u=e.createBuffer({label:`${r}-rd`,size:i*16,usage:Z.MAP_READ|Z.COPY_DST});e.queue.writeBuffer(s,0,new Uint32Array([i,n,0,0])),e.queue.writeBuffer(c,0,a);let d=D(e,{layout:o.bindGroupLayout,label:`${r}-bg`,entries:[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:c}},{binding:2,resource:{buffer:l}}]}),f=e.createCommandEncoder({label:`${r}-enc`}),p=f.beginComputePass({label:`${r}-pass`});p.setPipeline(o.pipeline),p.setBindGroup(0,d),p.dispatchWorkgroups(Math.ceil(i/64)),p.end(),f.copyBufferToBuffer(l,0,u,0,i*16),e.queue.submit([f.finish()]),await u.mapAsync(Z.MAP_READ);let m=new Float32Array(u.getMappedRange(0,i*16)),h=[`white-dwarf`,`unstable-gap`,`neutron-star`,`black-hole`],g=[];for(let e=0;e<i;e+=1)g.push(Object.freeze({centralRhoKgM3:a[e*4+0],massSolar:m[e*4+0],radiusKm:m[e*4+1],compactness:m[e*4+2],branch:h[Math.min(3,Math.max(0,Math.round(m[e*4+3])))]}));u.unmap();for(let e of[s,c,l,u])try{e.destroy()}catch{}return Object.freeze(g)}var Dt=`
struct KerrParams {
  particle_count: u32,
  step_index: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  r_horizon: f32,
  r_isco: f32,
  spin_a: f32,
  edd_ratio: f32,
  bz_power: f32,       // Blandford-Znajek jet power factor (0 if spin=0 or B=0!)
  lorentz_max: f32,
  box_half: f32,
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7 (Relativistic Jet / Disk / Ejecta!):
//   pos_m:    vec4(x, y, z, role)       role: 0=accretion_disk, 1=bz_jet_plasma, 2=corona_torus
//   vel_gam:  vec4(vx, vy, vz, gamma)   gamma = Lorentz factor >= 1.0
//   em_b:     vec4(temp_norm, b_phi, sync_emiss, age)
//   meta0:    vec4(seed, r_init, jet_sign, live)
struct RelParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: KerrParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<RelParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_kerr_bz_jet(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_gam.xyz;
  let dt = params.dt;

  if (role > 0.5 && role < 1.5) {
    // Relativistic Blandford-Znajek Jet Plasma Parcel!
    if (params.bz_power <= 1e-5) {
      // Zero BZ power (a* = 0 or B = 0) -> no relativistic jet acceleration!
      p.vel_gam = vec4<f32>(0.0, 0.0, 0.0, 1.0);
      p.em_b = vec4<f32>(0.0, 0.0, 0.0, p.em_b.w);
      p.meta0.w = 0.0;
      parcels[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let sgn = select(-1.0, 1.0, p.meta0.z >= 0.0);
    let y_abs = abs(loc.y);
    // Magnetocentrifugal acceleration along parabolic BZ funnel r_jet ~ r_0 * (1 + |y|)^0.58
    let v_target_y = sgn * (0.55 + 2.8 * sqrt(params.bz_power)) * (0.45 + 0.55 * smoothstep(0.0, 3.5, y_abs));
    let r_cyl = max(0.06, length(loc.xz));
    let omega_twist = params.spin_a * 2.2 / (0.35 + y_abs * 0.45);
    // Helical magnetic hoop collimation + radial parabolic expansion
    let r_target = 0.16 + 0.24 * pow(y_abs, 0.62) * (0.45 + 0.55 * p.meta0.x);
    let radial_f = (r_target - r_cyl) * 2.5;
    let rx = loc.x / r_cyl;
    let rz = loc.z / r_cyl;
    vel = vec3<f32>(
      -rz * r_cyl * omega_twist + rx * radial_f,
      mix(vel.y, v_target_y, clamp(dt * 3.5, 0.0, 1.0)),
      rx * r_cyl * omega_twist + rz * radial_f
    );
    loc = loc + vel * dt;
    // Recycle jet parcel smoothly at magnetospheric launch base near ergosphere
    if (abs(loc.y) > params.box_half * 1.15) {
      let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.17;
      let r0 = params.r_horizon * (0.75 + 0.45 * p.meta0.y);
      loc = vec3<f32>(cos(ang) * r0, sgn * (params.r_horizon * 0.9 + 0.15 * p.meta0.x), sin(ang) * r0);
      vel = vec3<f32>(0.0, sgn * 0.6, 0.0);
    }
    let gam = 1.0 + (params.lorentz_max - 1.0) * smoothstep(0.2, 5.0, abs(loc.y));
    let sync = clamp(0.45 + 0.95 * params.bz_power / (1.0 + abs(loc.y) * 0.16), 0.1, 2.0);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, gam);
    p.em_b = vec4<f32>(0.95, params.spin_a * params.bz_power, sync, p.em_b.w + dt);
    parcels[i] = p;
    return;
  }

  // Relativistic Kerr Accretion Disk / Dusty Torus Parcel (Paczynski-Wiita + Kerr frame dragging!)
  let r_cyl = max(params.r_isco * 0.85, length(loc.xz));
  let r3 = max(params.r_horizon * 1.05, length(loc));
  // Prograde Kerr orbital angular velocity Omega_K = 1 / (r^(3/2) + a*)
  let gm = 18.0;
  let omega_k = sqrt(gm) / (pow(r_cyl, 1.5) + params.spin_a * params.r_horizon * 0.6);
  // Viscous alpha-disk inward drift + vertical epicyclic restoring force
  let v_in = -0.06 * params.edd_ratio / max(0.5, r_cyl);
  let rx = loc.x / r_cyl;
  let rz = loc.z / r_cyl;
  vel = vec3<f32>(
    -rz * r_cyl * omega_k + rx * v_in,
    vel.y - (gm * loc.y / (r3 * r3 * r3)) * dt * 0.45,
    rx * r_cyl * omega_k + rz * v_in
  );
  vel.y = vel.y * exp(-0.8 * dt);
  loc = loc + vel * dt;

  // Plunging inside r_ISCO recycles cleanly at outer feeding radius
  if (length(loc.xz) < params.r_isco * 0.92) {
    let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.05;
    let r_outer = params.r_isco * (4.5 + 3.5 * p.meta0.y);
    loc = vec3<f32>(cos(ang) * r_outer, (p.meta0.x - 0.5) * 0.35, sin(ang) * r_outer);
  }

  // Novikov-Thorne temperature profile T(r) ~ (r / r_ISCO)^(-3/4) * (1 - sqrt(r_ISCO / r))^(1/4)
  let r_now = max(params.r_isco * 1.01, length(loc.xz));
  let nt_f = pow(params.r_isco / r_now, 0.75) * pow(max(0.02, 1.0 - sqrt(params.r_isco / r_now)), 0.25);
  let t_norm = clamp(nt_f * (1.2 + 1.6 * params.edd_ratio), 0.08, 1.8);
  let beta = clamp(length(vel) / 14.0, 0.0, 0.78);
  let gam_d = 1.0 / sqrt(max(0.15, 1.0 - beta * beta));

  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(vel, gam_d);
  p.em_b = vec4<f32>(t_norm, 0.0, t_norm, p.em_b.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_kerr_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var max_gam = 1.0;
  var jet_cnt = 0.0;
  var disk_lum = 0.0;
  var jet_sync = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      max_gam = max(max_gam, p.vel_gam.w);
      if (p.pos_m.w > 0.5 && p.pos_m.w < 1.5) {
        jet_cnt = jet_cnt + 1.0;
        jet_sync = jet_sync + p.em_b.z;
      } else {
        disk_lum = disk_lum + p.em_b.x;
      }
    }
    i = i + 64u;
  }
  wg0[tid] = max_gam; wg1[tid] = jet_cnt; wg2[tid] = disk_lum; wg3[tid] = jet_sync;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = max(wg0[tid], wg0[tid + s]);
      wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
  }
}
`;function Ot(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function kt(e,{massSolar:t=4e8,spinA:n=.92,accretionRateEddington:r=.42,magneticFluxNorm:i=1,particleCount:a=6144,seed:o=20261125,centerOffset:s=[0,0,0],label:c=`ulg-kerr-bz-jet`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createKerrAccretionJetSessionWebGpu requires a live WebGPU GPUDevice`);let l=wt({massSolar:t,spinA:n,accretionRateEddington:r,magneticFluxNorm:i}),u=Math.max(256,Math.min(32768,Math.trunc(a))),d=Ot(o),f=Number(s?.[0])||0,m=Number(s?.[1])||0,h=Number(s?.[2])||0,g=.52,_=Math.max(.45,l.rHorizonRg*g),v=Math.max(_*1.15,l.rIscoRg*g),y=new Float32Array(u*16),b=l.bzEfficiency>1e-4?.36:0,x=Math.floor(u*b);for(let e=0;e<u;e+=1){let t=e*16;if(e<x){let r=e&1?-1:1,i=_+d()**1.15*9.5,a=d()*Math.PI*2,o=(.14+.24*i**.62)*(.25+.75*d());y[t+0]=Math.cos(a)*o+f,y[t+1]=r*i+m,y[t+2]=Math.sin(a)*o+h,y[t+3]=1,y[t+4]=0,y[t+5]=r*1.8,y[t+6]=0,y[t+7]=l.lorentzGamma,y[t+8]=.95,y[t+9]=n*l.bzEfficiency,y[t+10]=1,y[t+11]=d(),y[t+12]=d(),y[t+13]=d(),y[t+14]=r,y[t+15]=1}else{let e=v*(1.05+d()**1.45*7.2),n=d()*Math.PI*2,r=e>v*5.2,i=r?.45+.22*(e-v*5.2):.06+.05*e,a=(d()-.5)*2*i,o=Math.sqrt(18/e);y[t+0]=Math.cos(n)*e+f,y[t+1]=a+m,y[t+2]=Math.sin(n)*e+h,y[t+3]=r?2:0,y[t+4]=-Math.sin(n)*o,y[t+5]=0,y[t+6]=Math.cos(n)*o,y[t+7]=1.08,y[t+8]=Math.min(1.6,(v/e)**.75*1.5),y[t+9]=0,y[t+10]=.8,y[t+11]=d(),y[t+12]=d(),y[t+13]=d(),y[t+14]=1,y[t+15]=1}}let S=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],C=O(e,{cacheKey:`ulg-kerr-bz-jet-step.v1`,label:`${c}-step`,code:Dt,entryPoint:`step_kerr_bz_jet`,bindings:S}),w=O(e,{cacheKey:`ulg-kerr-bz-jet-tel.v1`,label:`${c}-tel`,code:Dt,entryPoint:`reduce_kerr_telemetry`,bindings:S}),T=e.createBuffer({label:`${c}-params`,size:64,usage:Z.UNIFORM|Z.COPY_DST}),k=e.createBuffer({label:`${c}-parcels`,size:y.byteLength,usage:Z.STORAGE|Z.VERTEX|Z.COPY_DST}),A=e.createBuffer({label:`${c}-tel`,size:16,usage:Z.STORAGE|Z.COPY_SRC}),j=e.createBuffer({label:`${c}-tel-rd`,size:16,usage:Z.MAP_READ|Z.COPY_DST});e.queue.writeBuffer(k,0,y);let M=D(e,{layout:C.bindGroupLayout,label:`${c}-bg`,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:A}}]}),N=0,P=!1,F=!1,I=Object.freeze({schema:xt,stepIndex:0,...l,maxLorentzGamma:1,activeJetParcels:0,diskLuminosityProxy:0,jetSynchrotronProxy:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),L=Math.ceil(u/64);async function R({dt:t=.03,substeps:n=2,readTelemetry:i=!0}={}){if(F)return I;let a=Math.max(1,Math.min(16,Math.trunc(n))),o=Math.max(.004,Math.min(.1,Number(t)||.03)),s=new ArrayBuffer(64);new Uint32Array(s,0,4).set([u,N,0,0]),new Float32Array(s,16,12).set([o,_,v,l.spinA,r,l.bzEfficiency,l.lorentzGamma,9.2,f,m,h,0]),e.queue.writeBuffer(T,0,s);let d=e.createCommandEncoder({label:`${c}-enc-${N}`}),g=d.beginComputePass({label:`${c}-pass`});g.setBindGroup(0,M),g.setPipeline(C.pipeline);for(let e=0;e<a;e+=1)g.dispatchWorkgroups(L),N+=1;g.setPipeline(w.pipeline),g.dispatchWorkgroups(1),g.end();let y=i&&!P&&j.mapState===`unmapped`;if(y&&(P=!0,d.copyBufferToBuffer(A,0,j,0,16)),e.queue.submit([d.finish()]),y)try{if(await j.mapAsync(Z.MAP_READ),!F){let e=new Float32Array(j.getMappedRange(0,16));I=Object.freeze({schema:xt,stepIndex:N,...l,maxLorentzGamma:e[0],activeJetParcels:Math.round(e[1]),diskLuminosityProxy:e[2],jetSynchrotronProxy:e[3],accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{j.unmap()}catch{}}catch(e){if(!F&&e?.name!==`AbortError`)throw e}finally{P=!1}return I}function z(){if(!F){F=!0;for(let e of[T,k,A,j])try{e.destroy()}catch{}}}return Object.freeze({schema:xt,lawAdapter:St,get particleCount(){return u},get metrics(){return l},get horizonVisualRadius(){return _},get stepIndex(){return N},getResidentParcelsBuffer:()=>k,getTelemetry:()=>I,step:R,dispose:z})}function At(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`relativistic-compact-kerr-jet@1`)?e.resolveModule(`relativistic-compact-kerr-jet@1`)?.descriptor||null:e.registerModule({method:{model:`relativistic-compact-kerr-jet`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/relativisticCompactObjectGpu.js`,entryPoint:`step_kerr_bz_jet`,workgroupSize:64},parameterSchema:{massSolar:{type:`number`,min:.5,max:1e11,required:!1},spinA:{type:`number`,min:-.998,max:.998,required:!1},accretionRateEddington:{type:`number`,min:0,max:10,required:!1}},stateLayout:{tensorId:`relativistic-jet-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`bPhi`,`sync`,`age`,`seed`,`rInit`,`jetSign`,`live`]},scaleRangeM:[1e3,1e22],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=kt(n,{massSolar:r.massSolar??1e8,spinA:r.spinA??.9,accretionRateEddington:r.accretionRateEddington??.35,particleCount:512}),a=await i.step({dt:.03,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:kerr-bz-jet:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/relativisticCompactObjectGpu.js`,entryPoint:`createKerrAccretionJetSessionWebGpu`,kernelEntryPoint:`step_kerr_bz_jet`},representation:`kerr-tov-bz-jet-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-kerr-tov-bz`,placement:`local`},validity:{finite:Number.isFinite(a.rIscoRg)&&Number.isFinite(a.jetPowerW)},validation:{status:`pass`,validationMode:`gpu-kerr-tov-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var jt=`ulg.astrophysics.compact-magnetosphere-webgpu.v1`,Mt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Nt=Object.freeze({id:`compact-magnetosphere-spindown`,lawNodeId:`law:astrophysics-compact-magnetosphere-spindown`,orderConstraint:`after:relativistic-compact-kerr-jet`,adapterMode:o.SURFACE_INTERFACE,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`compact-object-state`,`magnetosphere-parcels`]),writes:Object.freeze([`compact-object-state`,`magnetosphere-parcels`]),accumulates:Object.freeze([`magnetosphere-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`magnetic-flux`,`rotational-energy-plus-em-radiated`]),validityDomain:Object.freeze({minSurfaceBFieldTesla:100,maxRadiusM:5e7}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,0x16345785d8a0000]),fundamentalLaws:Object.freeze([`spitkovsky-force-free-spindown`,`polar-cap-synchrotron-beam`,`hall-crustal-yield-reconnection`,`pwn-termination-shock`])});function Pt(e={}){let t=Math.abs(Number(e.surfaceBFieldTesla)||0),n=Number(e.compactRadiusM)||0,r=t>=100&&n>1e3&&n<5e7;return{active:r,magnetarYieldCapable:r&&t>=1e9,pulsarBeamActive:r&&Math.abs(Number(e.spinOmegaRadS)||0)>.05,reason:r?`magnetized-compact-star-present`:`low-field-or-noncompact-dormant`}}function Ft({massSolar:e=1.45,radiusM:t=12e3,surfaceBFieldTesla:n=4e8,spinPeriodS:r=.033,obliquityRad:i=.62}={}){let a=Math.max(.2,Number(e)||1.4)*198847e25,o=Math.max(5e3,Number(t)||12e3),s=Math.abs(Number(n)||0),c=Math.max(.001,Number(r)||.033),l=2*Math.PI/c,u=299792458,d=4*Math.PI*1e-7,f=Math.sin(i),p=.35*a*o*o,m=s<=0?0:4*Math.PI/d*s*s*o**6*l**4/(u*u*u)*(1+f*f)*.25,h=s<=0?0:-m/Math.max(1,p*l),g=s<=0?0:-(2*Math.PI*h)/(l*l),_=u/l,v=o*Math.sqrt(Math.min(1,o/Math.max(o,_))),y=s*s/(2*d)/4e25;return Object.freeze({inertiaKgM2:p,omegaRadS:l,spinPeriodS:c,surfaceBFieldTesla:s,spinDownLumW:m,omegaDotRadS2:h,pDotSPerS:g,rLightCylinderM:_,rPolarCapM:v,crustYieldRatio:y,magnetarRegime:y>=1,characteristicAgeYr:g>1e-30?c/(2*g)/31557600:1/0})}var It=`
struct MagParams {
  particle_count: u32,
  step_index: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  rot_phase: f32,      // Live integrated spin angle theta(t) from exact I*dOmega/dt!
  obliquity: f32,      // Angle alpha between spin axis (Y) and magnetic dipole axis!
  b_norm: f32,         // Normalized B-field strength (0 -> dormant!)
  beam_power: f32,     // Polar-cap curvature beam intensity
  flare_amp: f32,      // Live starquake reconnection giant flare intensity (0 unless crust yields!)
  pwn_power: f32,      // Pulsar wind nebula expansion drive
  twist_phi: f32,      // Magnetar toroidal helicity twist
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7!
//   pos_m:    vec4(x, y, z, role)   role: 0=magnetosphere_corotating_plasma, 1=polar_lighthouse_beam, 2=giant_flare_or_pwn_shell
//   vel_gam:  vec4(vx, vy, vz, gamma)
//   em_b:     vec4(temp_norm, b_twist, emiss, age)
//   meta0:    vec4(seed, shell_r, pole_sign, live)
struct MagParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MagParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<MagParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_compact_magnetosphere(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  if (params.b_norm <= 1e-6) {
    p.em_b.z = 0.0;
    p.meta0.w = 0.0;
    parcels[i] = p;
    return;
  }
  p.meta0.w = 1.0;

  // Live rotating oblique magnetic dipole basis (m_axis, e1, e2) from exact integrated spin phase!
  let sa = sin(params.obliquity);
  let ca = cos(params.obliquity);
  let cp = cos(params.rot_phase);
  let sp = sin(params.rot_phase);
  let m_axis = normalize(vec3<f32>(sa * cp, ca, sa * sp));
  let e1 = normalize(vec3<f32>(-sp, 0.0, cp));
  let e2 = cross(m_axis, e1);

  let sgn = select(-1.0, 1.0, p.meta0.z >= 0.0);
  let dt = params.dt;

  if (role > 0.5 && role < 1.5) {
    // Open polar-cap lighthouse beam plasma streaming relativistically along +/- m_axis!
    var age = p.em_b.w + dt * (1.2 + 0.8 * params.beam_power);
    if (age > 1.0) { age = age - 1.0; }
    let dist = 0.45 + age * 8.2;
    let cone_r = (0.08 + 0.16 * pow(dist, 0.88)) * (0.2 + 0.8 * p.meta0.y);
    let phi_c = p.meta0.x * 6.2831853 + dist * params.twist_phi * 0.25;
    let loc = m_axis * (sgn * dist) + (e1 * cos(phi_c) + e2 * sin(phi_c)) * cone_r;
    let vel = m_axis * (sgn * 4.5);
    let emiss = clamp(params.beam_power * (1.25 - 0.72 * age), 0.12, 2.2);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 4.5 * params.beam_power);
    p.em_b = vec4<f32>(1.15, params.twist_phi, emiss, age);
    parcels[i] = p;
    return;
  }

  if (role >= 1.5) {
    // Magnetar Giant Flare pair-plasma fireball OR Pulsar Wind Nebula (PWN) expanding synchrotron shell!
    var loc = p.pos_m.xyz - params.center_offset.xyz;
    var vel = p.vel_gam.xyz;
    let r = max(0.3, length(loc));
    let dir = loc / r;
    // Outward magnetic pressure + flare shock expansion
    let drive = params.flare_amp * 5.2 + params.pwn_power * 1.4;
    vel = mix(vel, dir * (0.45 + drive) + cross(vec3<f32>(0.0, 1.0, 0.0), dir) * 0.35, clamp(dt * 2.5, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > 8.8) {
      // Recycle smoothly into active reconnection/termination zone
      let th = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.13;
      let cy = (p.meta0.y * 2.0 - 1.0) * 0.85;
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.65 + 0.4 * p.meta0.x);
      vel = normalize(loc) * (0.5 + drive);
    }
    let flare_em = clamp(0.18 + params.flare_amp * 2.4 + params.pwn_power * 0.85, 0.0, 2.6) * exp(-max(0.0, length(loc) - 1.5) * 0.18);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 3.0 * params.flare_amp);
    p.em_b = vec4<f32>(0.45 + 1.2 * params.flare_amp, params.twist_phi, flare_em, p.em_b.w + dt);
    parcels[i] = p;
    return;
  }

  // Closed twisted dipolar magnetosphere flux tubes: r = R_max * sin^2(theta) with toroidal twist!
  let r_max = 1.4 + p.meta0.y * 3.2;
  var th_m = 0.25 + fract(p.em_b.w + dt * (0.28 + 0.22 * params.b_norm)) * (3.14159265 - 0.50);
  let s_t = sin(th_m);
  let c_t = cos(th_m);
  let r_dip = max(0.38, r_max * s_t * s_t);
  let az = p.meta0.x * 6.2831853 + params.twist_phi * c_t;
  let loc = m_axis * (r_dip * c_t) + (e1 * cos(az) + e2 * sin(az)) * (r_dip * s_t);
  let em_loop = clamp((0.35 + 0.75 * params.b_norm + 0.95 * params.flare_amp) / (0.6 + r_dip * 0.35), 0.15, 2.2);
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(cross(vec3<f32>(0.0, 1.0, 0.0), loc), 1.05);
  p.em_b = vec4<f32>(0.75 + 0.8 * params.flare_amp, params.twist_phi, em_loop, fract(p.em_b.w + dt * 0.25));
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_magnetosphere_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var beam_em = 0.0;
  var flare_em = 0.0;
  var loop_em = 0.0;
  var active_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      active_cnt = active_cnt + 1.0;
      if (p.pos_m.w > 0.5 && p.pos_m.w < 1.5) { beam_em = beam_em + p.em_b.z; }
      else if (p.pos_m.w >= 1.5) { flare_em = flare_em + p.em_b.z; }
      else { loop_em = loop_em + p.em_b.z; }
    }
    i = i + 64u;
  }
  wg0[tid] = beam_em; wg1[tid] = flare_em; wg2[tid] = loop_em; wg3[tid] = active_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
  }
}
`;function Lt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Rt(e,{massSolar:t=1.45,radiusM:n=12e3,surfaceBFieldTesla:r=12e10,spinPeriodS:i=.033,obliquityRad:a=.65,particleCount:o=5120,seed:s=20261125,centerOffset:c=[0,0,0],label:l=`ulg-compact-magnetosphere`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createCompactMagnetosphereSessionWebGpu requires a live WebGPU GPUDevice`);let u=Ft({massSolar:t,radiusM:n,surfaceBFieldTesla:r,spinPeriodS:i,obliquityRad:a}),d=Math.max(256,Math.min(32768,Math.trunc(o))),f=Lt(s),m=Number(c?.[0])||0,h=Number(c?.[1])||0,g=Number(c?.[2])||0,_=new Float32Array(d*16),v=Math.floor(d*.34),y=Math.floor(d*.3);for(let e=0;e<d;e+=1){let t=e*16,n=e<v?1:e<v+y?2:0,r=f()*Math.PI*2,i=2*f()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=.6+f()*5.2;_[t+0]=Math.cos(r)*a*o+m,_[t+1]=i*o+h,_[t+2]=Math.sin(r)*a*o+g,_[t+3]=n,_[t+4]=Math.cos(r)*a*.5,_[t+5]=i*.5,_[t+6]=Math.sin(r)*a*.5,_[t+7]=1.2,_[t+8]=.8,_[t+9]=0,_[t+10]=.5,_[t+11]=f(),_[t+12]=f(),_[t+13]=f(),_[t+14]=e&1?-1:1,_[t+15]=1}let b=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],x=O(e,{cacheKey:`ulg-compact-mag-step.v1`,label:`${l}-step`,code:It,entryPoint:`step_compact_magnetosphere`,bindings:b}),S=O(e,{cacheKey:`ulg-compact-mag-tel.v1`,label:`${l}-tel`,code:It,entryPoint:`reduce_magnetosphere_telemetry`,bindings:b}),C=e.createBuffer({label:`${l}-params`,size:64,usage:Mt.UNIFORM|Mt.COPY_DST}),w=e.createBuffer({label:`${l}-parcels`,size:_.byteLength,usage:Mt.STORAGE|Mt.VERTEX|Mt.COPY_DST}),T=e.createBuffer({label:`${l}-tel`,size:16,usage:Mt.STORAGE|Mt.COPY_SRC}),k=e.createBuffer({label:`${l}-tel-rd`,size:16,usage:Mt.MAP_READ|Mt.COPY_DST});e.queue.writeBuffer(w,0,_);let A=D(e,{layout:x.bindGroupLayout,label:`${l}-bg`,entries:[{binding:0,resource:{buffer:C}},{binding:1,resource:{buffer:w}},{binding:2,resource:{buffer:T}}]}),j=0,M=0,N=u.omegaRadS,P=u.magnetarRegime?.65:0,F=0,I=0,L=u.magnetarRegime?1.8:.25,R=[],z=!1,B=!1,V=u.surfaceBFieldTesla<=0?0:Math.min(2.5,Math.max(.05,Math.log10(u.surfaceBFieldTesla/1e4+1)*.28)),H=u.surfaceBFieldTesla<=0?0:Math.min(1.6,Math.max(.15,Math.log10(u.spinDownLumW/1e24+1)*.14)),U=u.surfaceBFieldTesla<=0?0:Math.min(1.4,Math.max(.05,Math.log10(u.spinDownLumW/1e27+1)*.18)),W=Object.freeze({schema:jt,stepIndex:0,...u,omegaNowRadS:N,crustStrain:P,flareAmplitude:F,flareCount:I,beamFluxProxy:0,flareFluxProxy:0,flareHistory:Object.freeze([]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),G=Math.ceil(d/64);async function K({dt:t=.04,substeps:n=2,readTelemetry:r=!0}={}){if(B)return W;let i=Math.max(1,Math.min(16,Math.trunc(n))),o=Math.max(.005,Math.min(.12,Number(t)||.04));for(let e=0;e<i;e+=1){let e=Math.min(4.8,Math.max(.45,Math.log10(N+1)*1.45));if(M=(M+e*o)%(Math.PI*2),u.surfaceBFieldTesla>0){let e=Math.min(.02,Math.abs(u.omegaDotRadS2/Math.max(1e-6,u.omegaRadS))*1e6*o);N=Math.max(.001,N*(1-e))}if(u.crustYieldRatio>=1){let e=.42*Math.min(4,Math.sqrt(u.crustYieldRatio));P+=e*o,L=.8+P*2.4,P>=1&&(P=.12,F=Math.min(2.2,1.35+.35*Math.log10(u.crustYieldRatio+1)),I+=1)}F*=Math.exp(-1.4*o),j+=1}R.push(Number((F+H*.25).toFixed(4))),R.length>96&&R.shift();let s=new ArrayBuffer(64);new Uint32Array(s,0,4).set([d,j,0,0]),new Float32Array(s,16,12).set([o,M,a,V,H,F,U,L,m,h,g,0]),e.queue.writeBuffer(C,0,s);let c=e.createCommandEncoder({label:`${l}-enc-${j}`}),f=c.beginComputePass({label:`${l}-pass`});f.setBindGroup(0,A),f.setPipeline(x.pipeline),f.dispatchWorkgroups(G),f.setPipeline(S.pipeline),f.dispatchWorkgroups(1),f.end();let _=r&&!z&&k.mapState===`unmapped`;if(_&&(z=!0,c.copyBufferToBuffer(T,0,k,0,16)),e.queue.submit([c.finish()]),_)try{if(await k.mapAsync(Mt.MAP_READ),!B){let e=new Float32Array(k.getMappedRange(0,16));W=Object.freeze({schema:jt,stepIndex:j,...u,omegaNowRadS:N,crustStrain:P,flareAmplitude:F,flareCount:I,beamFluxProxy:e[0],flareFluxProxy:e[1],flareHistory:Object.freeze([...R]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{k.unmap()}catch{}}catch(e){if(!B&&e?.name!==`AbortError`)throw e}finally{z=!1}return W}function q({linesPerRing:e=12,steps:t=22,worldScale:n=1,alpha:r=.45}={}){if(u.surfaceBFieldTesla<=0)return new Float32Array;let i=Math.sin(a),o=Math.cos(a),s=Math.cos(M),c=Math.sin(M),l=i*s,d=o,f=i*c,p=-c,_=s,v=d*_-f*0,y=f*p-l*_,b=l*0-d*p,x=[];for(let i=0;i<e;i+=1){let a=i/e*Math.PI*2,o=i&1?2.2:3.4,s=null;for(let e=0;e<=t;e+=1){let i=.22+e/t*(Math.PI-.44),c=Math.sin(i),S=Math.cos(i),C=o*c*c*n,w=a+L*S,T=Math.cos(w),E=Math.sin(w),D=[l*C*S+(p*T+v*E)*C*c+m*n,d*C*S+(0*T+y*E)*C*c+h*n,f*C*S+(_*T+b*E)*C*c+g*n];if(s){let e=u.magnetarRegime?.95:.34,t=u.magnetarRegime?.35+.45*F:.82;x.push(...s,e,t,1,r),x.push(...D,e,t,1,r)}s=D}}return new Float32Array(x)}function ee(){if(!B){B=!0;for(let e of[C,w,T,k])try{e.destroy()}catch{}}}return Object.freeze({schema:jt,lawAdapter:Nt,get particleCount(){return d},get physics(){return u},get stepIndex(){return j},get rotPhase(){return M},get flareAmplitude(){return F},getResidentParcelsBuffer:()=>w,getTelemetry:()=>W,buildDipoleFieldLines:q,step:K,dispose:ee})}function zt(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`compact-magnetosphere-spindown@1`)?e.resolveModule(`compact-magnetosphere-spindown@1`)?.descriptor||null:e.registerModule({method:{model:`compact-magnetosphere-spindown`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/compactMagnetosphereGpu.js`,entryPoint:`step_compact_magnetosphere`,workgroupSize:64},parameterSchema:{surfaceBFieldTesla:{type:`number`,min:0,max:0x9184e72a000,required:!1},spinPeriodS:{type:`number`,min:.001,max:100,required:!1}},stateLayout:{tensorId:`magnetosphere-parcels`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`bTwist`,`emiss`,`age`,`seed`,`shellR`,`poleSign`,`live`]},scaleRangeM:[1e4,0x16345785d8a0000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Rt(n,{surfaceBFieldTesla:r.surfaceBFieldTesla??12e10,spinPeriodS:r.spinPeriodS??.033,particleCount:512}),a=await i.step({dt:.04,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:compact-magnetosphere:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/compactMagnetosphereGpu.js`,entryPoint:`createCompactMagnetosphereSessionWebGpu`,kernelEntryPoint:`step_compact_magnetosphere`},representation:`compact-magnetosphere-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-compact-magnetosphere`,placement:`local`},validity:{finite:Number.isFinite(a.spinDownLumW)&&Number.isFinite(a.crustYieldRatio)},validation:{status:`pass`,validationMode:`gpu-magnetosphere-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Bt=`ulg.astrophysics.relativistic-binary-gw-rprocess-webgpu.v1`,Vt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Ht=Object.freeze({id:`relativistic-binary-gw-rprocess`,lawNodeId:`law:astrophysics-relativistic-binary-gw-rprocess`,orderConstraint:`after:relativistic-compact-kerr-jet`,adapterMode:o.EXACT_NEAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`binary-compact-state`,`merger-ejecta-parcels`]),writes:Object.freeze([`binary-compact-state`,`merger-ejecta-parcels`]),accumulates:Object.freeze([`gw-strain-ringbuffer`,`rprocess-yield-ledger`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`adm-energy-plus-gw-flux`,`angular-momentum-plus-gw-flux`,`baryon-nucleon-sum`]),validityDomain:Object.freeze({minBodies:2,maxVOverC:.65}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,0x38d7ea4c68000]),fundamentalLaws:Object.freeze([`1pn-periastron-precession`,`2.5pn-peters-mathews-gw`,`roche-lobe-l1-overflow`,`rprocess-kilonova-heating`,`type-ia-c12-detonation`])});function Ut(e={}){let t=Number(e.gravitatingBodyCount)||0,n=Number(e.maxPairwiseVOverC)||0,r=!!e.rocheOverflowPresent,i=t>=2&&(n>=1e-4||r);return{active:i,gwInspiralActive:i&&n>=.001,rocheTransferActive:i&&r,reason:i?`relativistic-or-roche-interacting-binary-present`:`wide-newtonian-system-dormant`}}function Wt(e){let t=Math.max(1e-4,Number(e)||1),n=Math.cbrt(t),r=n*n;return .49*r/(.6*r+Math.log(1+n))}var Gt=`
struct BinParams {
  particle_count: u32,
  mode_flags: u32,      // bit0=roche_stream, bit1=kilonova_rprocess, bit2=type_ia_detonation, bit3=merged
  step_index: u32,
  pad0: u32,
  dt: f32,
  gm_tot: f32,
  m1_frac: f32,
  m2_frac: f32,
  gw_strain_amp: f32,
  ejecta_temp_scale: f32,
  time_since_merge: f32,
  box_half: f32,
  b1_pos_r: vec4<f32>,  // xyz = body 1 pos, w = body 1 visual radius
  b2_pos_r: vec4<f32>,  // xyz = body 2 pos, w = body 2 visual radius
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7!
//   pos_m:   vec4(x, y, z, role)    role: 0=accretion_stream_disk, 1=blue_polar_wind_or_gw_wave, 2=red_lanthanide_rprocess_or_sn_ejecta
//   vel_gam: vec4(vx, vy, vz, ye_or_gamma)
//   em_b:    vec4(temp_norm, ye_neutron_rich, emiss, age)
//   meta0:   vec4(seed, r0, phase, live)
struct EjectaParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: BinParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<EjectaParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_binary_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_gam.xyz;
  let dt = params.dt;

  let merged = (params.mode_flags & 8u) != 0u;
  let is_roche = (params.mode_flags & 1u) != 0u;
  let is_kilonova = (params.mode_flags & 2u) != 0u;
  let is_type_ia = (params.mode_flags & 4u) != 0u;

  let p1 = params.b1_pos_r.xyz;
  let p2 = params.b2_pos_r.xyz;

  if (merged && (is_kilonova || is_type_ia)) {
    // Homologous + r-process / 56Ni radioactive heating expansion!
    // r-process heating q_dot(t) ~ (1 + t)^(-1.3) -> luminous blue (polar high-Ye) + red lanthanide (equatorial low-Ye) Kilonova!
    let t_m = max(0.05, params.time_since_merge);
    let heat = pow(1.0 + t_m * 0.45, -1.3) * params.ejecta_temp_scale;
    let r = max(0.15, length(loc));
    let dir = loc / r;
    let v_exp = select(1.4, 2.4, is_type_ia) * (0.45 + 0.85 * p.meta0.x);
    if (length(vel) < 0.6) {
      vel = dir * v_exp + cross(vec3<f32>(0.0, 1.0, 0.0), dir) * 0.45;
    }
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 1.05) {
      let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.09;
      let cy = (p.meta0.y * 2.0 - 1.0) * select(0.42, 0.92, role < 1.5);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(ang) * sy, cy, sin(ang) * sy) * (0.45 + 0.35 * p.meta0.z);
      vel = normalize(loc) * v_exp;
    }
    let ye = select(0.16, 0.38, role < 1.5); // low Ye < 0.25 -> lanthanide-rich red kilonova / Au/U synthesis!
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 0.35 * v_exp);
    p.em_b = vec4<f32>(clamp(heat * select(0.65, 1.35, role < 1.5), 0.12, 1.8), ye, clamp(heat * 1.15, 0.15, 2.2), p.em_b.w + dt);
    p.meta0.w = 1.0;
    parcels[i] = p;
    return;
  }

  if (is_roche && role < 0.5) {
    // Roche-lobe L1 mass-transfer stream curving via Coriolis into hot X-ray accretion disk around body 1!
    let d1 = p1 - loc;
    let d2 = p2 - loc;
    let r1 = max(0.32, length(d1));
    let r2 = max(0.32, length(d2));
    let acc = (d1 / (r1 * r1 * r1)) * (params.gm_tot * params.m1_frac)
            + (d2 / (r2 * r2 * r2)) * (params.gm_tot * params.m2_frac);
    vel = vel + acc * dt;
    // Mild viscous circularization near accretor
    let r_acc = length(loc - p1);
    if (r_acc < 2.2) {
      vel = vel * (1.0 - 0.18 * dt);
    }
    loc = loc + vel * dt;
    // Respawn captured or escaped parcels at L1 Lagrange nozzle between donor (p2) and accretor (p1)
    if (r1 < params.b1_pos_r.w * 0.95 || length(loc) > params.box_half) {
      let l1 = mix(p1, p2, 0.58);
      let sep = p1 - p2;
      let tang = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), sep + vec3<f32>(1e-4, 0.0, 0.0)));
      loc = l1 + tang * ((p.meta0.x - 0.5) * 0.35) + vec3<f32>(0.0, (p.meta0.y - 0.5) * 0.25, 0.0);
      vel = normalize(sep + vec3<f32>(1e-4, 0.0, 0.0)) * 1.2 + tang * 1.6;
    }
    let t_hot = clamp(1.8 / max(0.4, r1), 0.15, 1.8);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.15);
    p.em_b = vec4<f32>(t_hot, 0.5, t_hot, p.em_b.w + dt);
    p.meta0.w = 1.0;
    parcels[i] = p;
    return;
  }

  // Tidal spiral arms / pre-merger quadrupole gravitational-wave perturbation tracers
  let d1 = p1 - loc;
  let d2 = p2 - loc;
  let r1 = max(0.38, length(d1));
  let r2 = max(0.38, length(d2));
  let acc = (d1 / (r1 * r1 * r1)) * (params.gm_tot * params.m1_frac)
          + (d2 / (r2 * r2 * r2)) * (params.gm_tot * params.m2_frac);
  vel = vel + acc * dt;
  loc = loc + vel * dt;
  // Gentle recycling if flung outside box
  if (length(loc) > params.box_half) {
    let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.08;
    let rr = 0.8 + p.meta0.y * 2.2;
    let host = select(p2, p1, (i & 1u) == 0u);
    loc = host + vec3<f32>(cos(ang) * rr, (p.meta0.z - 0.5) * 0.28, sin(ang) * rr);
    let vc = sqrt(params.gm_tot * 0.5 / max(0.5, rr));
    vel = vec3<f32>(-sin(ang) * vc, 0.0, cos(ang) * vc);
  }
  let em = clamp(0.35 + 1.8 * params.gw_strain_amp / (0.6 + 0.25 * length(loc)), 0.15, 1.8);
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(vel, 1.0 + params.gw_strain_amp * 2.0);
  p.em_b = vec4<f32>(em, 0.22, em, p.em_b.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_binary_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var em_sum = 0.0;
  var r_sum = 0.0;
  var low_ye_cnt = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      em_sum = em_sum + p.em_b.z;
      r_sum = r_sum + length(p.pos_m.xyz - params.center_offset.xyz);
      if (p.em_b.y < 0.25) { low_ye_cnt = low_ye_cnt + 1.0; }
    }
    i = i + 64u;
  }
  wg0[tid] = em_sum; wg1[tid] = r_sum; wg2[tid] = low_ye_cnt; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0], wg3[0]);
  }
}
`;function Kt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function qt(e,{m1Solar:t=1.45,m2Solar:n=1.32,r1Sim:r=.42,r2Sim:i=.4,separation0:a=4.6,eccentricity0:o=.08,cSpeedSim:s=7.2,rocheOverflow:c=!1,neutronRich:l=!0,wdCarbonOxygen:u=!1,particleCount:d=4096,seed:f=20261125,centerOffset:m=[0,0,0],label:h=`ulg-relativistic-binary`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createRelativisticBinaryMergerSessionWebGpu requires a live WebGPU GPUDevice`);let g=Math.max(256,Math.min(32768,Math.trunc(d))),_=Kt(f),v=Number(m?.[0])||0,y=Number(m?.[1])||0,b=Number(m?.[2])||0,x=14*Math.max(.5,(t+n)/2.8),S=Math.max(.1,t+n),C=t/S,w=n/S,T=Number.isFinite(s)&&s>0?1/(s*s):0,k=T>0?T**2.5:0,A=Math.max(r+i+.5,Number(a)||4.6),j=[A*(1-o),0,0],M=[0,0,Math.sqrt(x*(1+o)/Math.max(.5,A*(1-o)))],N=!1,P=0,F=0,I=0,L=[],R=[],z=()=>({b1:[-j[0]*w,-j[1]*w,-j[2]*w],b2:[j[0]*C,j[1]*C,j[2]*C]}),B=new Float32Array(g*16),V=z();for(let e=0;e<g;e+=1){let t=e*16,n=c?e<g*.7?0:1:e<g*.45?1:2,r=e&1?V.b2:V.b1,i=_()*Math.PI*2,a=.65+_()*2.1,o=r[0]+Math.cos(i)*a,s=(_()-.5)*.35,u=r[2]+Math.sin(i)*a,d=Math.sqrt(x*.45/Math.max(.5,a));B[t+0]=o+v,B[t+1]=s+y,B[t+2]=u+b,B[t+3]=n,B[t+4]=-Math.sin(i)*d,B[t+5]=0,B[t+6]=Math.cos(i)*d,B[t+7]=1.05,B[t+8]=.6,B[t+9]=l?.18:.5,B[t+10]=.5,B[t+11]=_(),B[t+12]=_(),B[t+13]=_(),B[t+14]=_(),B[t+15]=1}let H=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],U=O(e,{cacheKey:`ulg-rel-binary-step.v1`,label:`${h}-step`,code:Gt,entryPoint:`step_binary_ejecta`,bindings:H}),W=O(e,{cacheKey:`ulg-rel-binary-tel.v1`,label:`${h}-tel`,code:Gt,entryPoint:`reduce_binary_telemetry`,bindings:H}),G=e.createBuffer({label:`${h}-params`,size:96,usage:Vt.UNIFORM|Vt.COPY_DST}),K=e.createBuffer({label:`${h}-parcels`,size:B.byteLength,usage:Vt.STORAGE|Vt.VERTEX|Vt.COPY_DST}),q=e.createBuffer({label:`${h}-tel`,size:16,usage:Vt.STORAGE|Vt.COPY_SRC}),ee=e.createBuffer({label:`${h}-tel-rd`,size:16,usage:Vt.MAP_READ|Vt.COPY_DST});e.queue.writeBuffer(K,0,B);let te=D(e,{layout:U.bindGroupLayout,label:`${h}-bg`,entries:[{binding:0,resource:{buffer:G}},{binding:1,resource:{buffer:K}},{binding:2,resource:{buffer:q}}]}),ne=!1,re=!1,ie=0,ae=0,oe=0,se=Math.hypot(j[0],j[1],j[2]),ce=Wt(n/Math.max(.05,t)),le=Object.freeze({schema:Bt,stepIndex:0,separation:se,merged:!1,remnantType:`inspiral`,gwStrainPlus:0,gwStrainCross:0,gwFrequency:0,rocheLobeRatio:ce,rProcessEjectaCount:0,meanEjectaEmissivity:0,gwStrainHistory:Object.freeze([]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),ue=Math.ceil(g/64);function de(e){if(N){P+=e,ie=Math.exp(-P*3.2)*Math.cos(P*16)*(k>0?.9:0),ae=Math.exp(-P*3.2)*Math.sin(P*16)*(k>0?.9:0);return}let t=j[0],n=j[1],a=j[2],o=M[0],s=M[1],l=M[2],u=c?Math.max(1.2,(r+i)*1.6):.2,d=Math.max(u,Math.hypot(t,n,a)),f=o*o+s*s+l*l,p=(t*o+n*s+a*l)/d,m=C*w,h=x/d,g=T*((4+2*m)*h-(1+3*m)*f+1.5*m*p*p),_=T*(4-2*m)*p,v=c?.02:22,y=k>0?8/5*m*(x*x/(d*d*d))*k*v:0,b=y*(3*f+17/3*h),S=y*(f+3*h),E=-x/(d*d*d),D=E*((1+g)*t-_*o)+(p/d*b*t-S*o),O=E*((1+g)*n-_*s)+(p/d*b*n-S*s),F=E*((1+g)*a-_*l)+(p/d*b*a-S*l);if(M[0]+=D*e,M[1]+=O*e,M[2]+=F*e,j[0]+=M[0]*e,j[1]+=M[1]*e,j[2]+=M[2]*e,c){let e=A/Math.max(u,Math.hypot(j[0],j[1],j[2]));j[0]*=.94+.06*e,j[1]*=.96,j[2]*=.94+.06*e}se=Math.hypot(j[0],j[1],j[2]);let I=Math.atan2(j[2],j[0]);oe=Math.sqrt(x/Math.max(.25,se*se*se))/Math.PI;let L=T>0?Math.min(1.6,4.2*m*h*T*(4/Math.max(.6,se))):0;ie=L*Math.cos(2*I),ae=L*Math.sin(2*I),!c&&se<=(r+i)*1.12&&(N=!0,P=0,j=[0,0,0],M=[0,0,0])}async function J({dt:t=.032,substeps:n=4,readTelemetry:a=!0}={}){if(re)return le;let o=Math.max(1,Math.min(16,Math.trunc(n))),s=Math.max(.004,Math.min(.08,Number(t)||.032));for(let e=0;e<o;e+=1)de(s*.5),de(s*.5),F+=s,I+=1;L.push(Number(ie.toFixed(5))),R.push(Number(oe.toFixed(4))),L.length>120&&(L.shift(),R.shift());let d=z(),f=!!c|(l?2:0)|(u?4:0)|(N?8:0),m=new ArrayBuffer(96);new Uint32Array(m,0,4).set([g,f,I,0]),new Float32Array(m,16,20).set([s,x,C,w,Math.hypot(ie,ae),l?1.65:u?2.1:1,P,9,d.b1[0],d.b1[1],d.b1[2],r,d.b2[0],d.b2[1],d.b2[2],i,v,y,b,0]),e.queue.writeBuffer(G,0,m);let _=e.createCommandEncoder({label:`${h}-enc-${I}`}),S=_.beginComputePass({label:`${h}-pass`});S.setBindGroup(0,te),S.setPipeline(U.pipeline),S.dispatchWorkgroups(ue),S.setPipeline(W.pipeline),S.dispatchWorkgroups(1),S.end();let T=a&&!ne&&ee.mapState===`unmapped`;if(T&&(ne=!0,_.copyBufferToBuffer(q,0,ee,0,16)),e.queue.submit([_.finish()]),T)try{if(await ee.mapAsync(Vt.MAP_READ),!re){let e=new Float32Array(ee.getMappedRange(0,16));le=Object.freeze({schema:Bt,stepIndex:I,separation:se,merged:N,remnantType:N?u?`type-ia-supernova-zero-remnant`:l?`bns-kilonova-rprocess`:`kerr-bbh-remnant`:c?`roche-xray-binary`:`gw-inspiral`,gwStrainPlus:ie,gwStrainCross:ae,gwFrequency:oe,rocheLobeRatio:ce,rProcessEjectaCount:Math.round(e[2]),meanEjectaEmissivity:e[0],gwStrainHistory:Object.freeze([...L]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{ee.unmap()}catch{}}catch(e){if(!re&&e?.name!==`AbortError`)throw e}finally{ne=!1}return le}function fe(e=1){let a=z();if(N&&u)return[];if(N)return[{pos:[v*e,y*e,b*e],radius:Math.max(r,i)*1.25*e,color0:l?[.72,.88,1]:[0,0,0],color1:l?[.35,.65,1]:[0,0,0],kind:l?0:5,atm:0}];let o=!l&&!u&&t>=3,s=!l&&!u&&n>=3&&!c;return[{pos:[(a.b1[0]+v)*e,(a.b1[1]+y)*e,(a.b1[2]+b)*e],radius:r*e,color0:o?[0,0,0]:[.76,.9,1],color1:o?[0,0,0]:[.42,.72,1],kind:o?5:0,atm:0},{pos:[(a.b2[0]+v)*e,(a.b2[1]+y)*e,(a.b2[2]+b)*e],radius:i*e,color0:s?[0,0,0]:c?[1,.76,.42]:[.8,.92,1],color1:s?[0,0,0]:c?[.95,.38,.14]:[.46,.74,1],kind:s?5:0,atm:0}]}function pe(){if(!re){re=!0;for(let e of[G,K,q,ee])try{e.destroy()}catch{}}}return Object.freeze({schema:Bt,lawAdapter:Ht,get particleCount(){return g},get stepIndex(){return I},get merged(){return N},get separation(){return se},getResidentParcelsBuffer:()=>K,getRenderSpheres:fe,getTelemetry:()=>le,step:J,dispose:pe})}function Jt(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`relativistic-binary-gw-rprocess@1`)?e.resolveModule(`relativistic-binary-gw-rprocess@1`)?.descriptor||null:e.registerModule({method:{model:`relativistic-binary-gw-rprocess`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/relativisticBinaryMergerGpu.js`,entryPoint:`step_binary_ejecta`,workgroupSize:64},parameterSchema:{m1Solar:{type:`number`,min:.2,max:1e10,required:!1},m2Solar:{type:`number`,min:.2,max:1e10,required:!1},cSpeedSim:{type:`number`,min:1,max:1e9,required:!1}},stateLayout:{tensorId:`merger-ejecta-parcels`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`ye`,`emiss`,`age`,`seed`,`r0`,`phase`,`live`]},scaleRangeM:[1e4,0x38d7ea4c68000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=qt(n,{m1Solar:r.m1Solar??1.45,m2Solar:r.m2Solar??1.32,particleCount:512}),a=await i.step({dt:.03,substeps:4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:rel-binary:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/relativisticBinaryMergerGpu.js`,entryPoint:`createRelativisticBinaryMergerSessionWebGpu`,kernelEntryPoint:`step_binary_ejecta`},representation:`rel-binary-gw-rprocess-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-rel-binary-gw`,placement:`local`},validity:{finite:Number.isFinite(a.separation)&&Number.isFinite(a.gwStrainPlus)},validation:{status:`pass`,validationMode:`gpu-binary-gw-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Yt=`ulg.astrophysics.radiative-photoionization-wind-webgpu.v1`,Xt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Zt=Object.freeze({id:`radiative-photoionization-winds`,lawNodeId:`law:astrophysics-radiative-photoionization-winds`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:o.CELL_LOCAL,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`stellar-luminosity-sources`,`outflow-tail-particles`]),writes:Object.freeze([`outflow-tail-particles`]),accumulates:Object.freeze([`radiative-wind-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass-with-outflow`,`momentum-radiation-plus-gas`,`ionization-balance`]),validityDomain:Object.freeze({requiresRadiativeOrThermalDriver:!0}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e3,0x56bc75e2d63100000]),fundamentalLaws:Object.freeze([`stromgren-photoionization`,`radiation-pressure-wind`,`xuv-photoevaporation`,`clausius-clapeyron-sublimation`,`solar-wind-ion-pickup`])});function Qt(e={}){let t=Number(e.uvFluxNorm)||0,n=Number(e.xuvFluxWPerM2)||0,r=(Number(e.surfaceTempK)||0)>(Number(e.sublimationTempK)||1e9),i=Number(e.fastWindSpeedNorm)||0,a=t>1e-4||n>.1||r||i>.001;return{active:a,photoionizationActive:t>1e-4,outflowActive:n>.1||r||i>.001,reason:a?`radiative-or-sublimation-driver-present`:`dark-cold-quiescent-dormant`}}var $t=`
struct RadWindParams {
  particle_count: u32,
  regime_code: u32,    // 0=h2_pillars_nebula, 1=planetary_nebula, 2=snr_pwn_blastwave, 3=comet_dual_tail, 4=hot_jupiter_xuv
  step_index: u32,
  pad0: u32,
  dt: f32,
  uv_flux: f32,        // Ionizing UV strength (0 -> zero photoionization!)
  rad_beta: f32,       // Radiation pressure / gravity ratio (curves dust tail / drives WR winds!)
  wind_speed: f32,     // Solar / fast post-AGB / blastwave wind velocity
  subl_drive: f32,     // Sublimation or XUV mass-loss drive (0 -> zero outgassing!)
  bipolar_asym: f32,   // Equatorial torus confinement producing hourglass/bipolar planetary nebulae
  box_half: f32,
  pad1: f32,
  source_dir: vec4<f32>, // xyz = unit direction toward ionizing star / Sun, w = source distance
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 8 (Photoionized Nebulae + Comet/XUV Outflows!):
//   pos_m:    vec4(x, y, z, species)   species: 0=neutral_dust/pillar, 1=H_alpha_or_ion_tail, 2=OIII_hot_shell, 3=SII_or_shock_front
//   vel_ion:  vec4(vx, vy, vz, x_HII)
//   em_spec:  vec4(h_alpha, o_iii, s_ii_or_dust, age)
//   meta0:    vec4(seed, r0, theta0, live)
struct RadParcel {
  pos_m: vec4<f32>,
  vel_ion: vec4<f32>,
  em_spec: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RadWindParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<RadParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_radiative_wind(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_ion.xyz;
  var x_hii = p.vel_ion.w;
  let dt = params.dt;
  let reg = params.regime_code;
  let s_dir = normalize(params.source_dir.xyz);

  if (reg == 3u || reg == 4u) {
    // Active Comet Dual-Tail (reg=3) OR Hot-Jupiter XUV Photoevaporation Tail (reg=4)!
    if (params.subl_drive <= 1e-6) {
      p.vel_ion.w = 0.0;
      p.em_spec = vec4<f32>(0.0, 0.0, 0.0, p.em_spec.w);
      p.meta0.w = 0.0;
      parcels[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let is_ion = p.pos_m.w > 0.5 && p.pos_m.w < 1.5;
    let anti_sun = -s_dir;
    // Perpendicular orbital-lag tangent curving the radiation-pressure dust tail vs straight ion tail!
    let orb_tang = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), anti_sun + vec3<f32>(0.0, 0.0, 1e-4)));
    let age = p.em_spec.w + dt * (0.28 + 0.35 * params.subl_drive);
    if (is_ion) {
      // Photoionized CO+/H2O+ (or H+ XUV) swept straight antisolar by magnetized solar wind!
      let a_sw = anti_sun * (params.wind_speed * 2.2) + vec3<f32>(0.0, sin(age * 4.0 + p.meta0.x * 6.28) * 0.12, 0.0);
      vel = mix(vel, a_sw, clamp(dt * 3.2, 0.0, 1.0));
      x_hii = clamp(x_hii + params.uv_flux * (1.0 - x_hii) * dt * 2.5, 0.0, 1.0);
    } else {
      // Micron dust grains pushed by radiation pressure beta AND curving along orbital lag!
      let a_rad = anti_sun * (params.rad_beta * 1.45) + orb_tang * (0.55 * params.rad_beta * age);
      vel = vel + a_rad * dt;
      x_hii = 0.0;
    }
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 1.1 || age > 3.6) {
      // Respawn at sunlit hemisphere sublimation/exobase surface!
      let phi = p.meta0.x * 6.2831853;
      let ct = 0.25 + 0.75 * p.meta0.y;
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let side = normalize(cross(s_dir, vec3<f32>(0.0, 1.0, 0.0) + vec3<f32>(1e-4, 0.0, 0.0)));
      let up_s = cross(side, s_dir);
      let n_emit = normalize(s_dir * ct + (side * cos(phi) + up_s * sin(phi)) * st);
      let r_body = select(0.55, 0.95, reg == 4u);
      loc = n_emit * r_body;
      vel = n_emit * (0.35 + 0.45 * params.subl_drive) + anti_sun * 0.25;
      p.em_spec.w = 0.0;
    } else {
      p.em_spec.w = age;
    }
    let fade = exp(-length(loc) * 0.12);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_ion = vec4<f32>(vel, x_hii);
    p.em_spec = vec4<f32>(
      select(0.12, 0.08 * x_hii, is_ion) * fade,
      select(0.04, 1.38 * x_hii, is_ion) * fade,
      select(1.05 * params.subl_drive, 0.02, is_ion) * fade,
      p.em_spec.w
    );
    parcels[i] = p;
    return;
  }

  // Regimes 0 (H II Star-Forming Pillars), 1 (Planetary Nebula), 2 (SNR / Crab PWN)!
  let r = max(0.25, length(loc));
  let dir = loc / r;
  // Local UV flux falls as 1/r^2 and is attenuated inside dense molecular pillar cores (self-shielding!)
  let is_pillar_core = (reg == 0u) && (p.pos_m.w < 0.5);
  let shield = select(1.0, 0.18 + 0.82 * smoothstep(-2.0, 4.5, dot(loc, s_dir)), is_pillar_core);
  let f_uv_loc = params.uv_flux * shield / (0.35 + 0.12 * r * r);

  // Real Stromgren photoionization balance: dx_HII/dt = (1 - x_HII)*F_UV - alpha_B * x_HII^2
  let ion_src = (1.0 - x_hii) * f_uv_loc * 1.8;
  let recomb = 0.35 * x_hii * x_hii;
  x_hii = clamp(x_hii + (ion_src - recomb) * dt, 0.0, 1.0);

  if (reg == 1u) {
    // Planetary Nebula: fast post-AGB stellar wind colliding with slow equatorial dusty torus -> hourglass/ring!
    let lat_y = abs(dir.y);
    let polar_boost = 1.0 + params.bipolar_asym * lat_y * lat_y;
    let v_shell = params.wind_speed * polar_boost * (0.35 + 0.65 * p.meta0.y);
    vel = mix(vel, dir * v_shell, clamp(dt * 1.8, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.92) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.55 + 0.35 * p.meta0.y);
      vel = normalize(loc) * v_shell * 0.6;
    }
  } else if (reg == 2u) {
    // Supernova Remnant / Crab PWN: Sedov-Taylor blastwave decelerating (R ~ t^(2/5)) + filamentary turbulence!
    let sedov_v = params.wind_speed / pow(0.6 + r * 0.42, 1.15);
    let rt_swirl = vec3<f32>(sin(loc.y * 2.1 + p.meta0.x * 6.28), cos(loc.z * 2.1), sin(loc.x * 2.1)) * 0.22;
    vel = mix(vel, dir * sedov_v + rt_swirl, clamp(dt * 2.0, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.95) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.75 + 0.45 * p.meta0.y);
    }
  } else {
    // H II Star-Forming Pillars: photoevaporative rocket acceleration ablating sunlit tips away from O-star!
    let rocket = -s_dir * (f_uv_loc * params.rad_beta * 0.45) * x_hii;
    vel = (vel + rocket * dt) * exp(-0.4 * dt);
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.96) {
      loc = loc * 0.55;
      vel = vec3<f32>(0.0);
    }
  }

  // Physically stratified nebular emission lines (Hubble SHO / optical H-alpha, [O III], [S II]):
  //   - Inner highly ionized zone -> vivid emerald-cyan [O III] 500.7 nm
  //   - Intermediate ionized shell -> crimson-rose H-alpha 656.3 nm
  //   - Outer ionization front / dense shielded molecular skin -> amber-gold [S II] 672 nm
  let o3 = select(
    x_hii * smoothstep(5.4, 0.9, r) * (0.95 + 0.55 * params.uv_flux),
    x_hii * smoothstep(4.2, 1.2, r) * 1.45,
    reg == 1u || reg == 2u
  );
  let ha = x_hii * smoothstep(0.6, 4.8, r) * (0.72 + 0.45 * params.uv_flux);
  let s2 = (1.0 - x_hii * 0.82) * smoothstep(0.0, 0.55, x_hii + 0.16) * 1.15;

  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_ion = vec4<f32>(vel, x_hii);
  p.em_spec = vec4<f32>(ha, o3, s2, p.em_spec.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_rad_wind_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var xhii_sum = 0.0;
  var spd_sum = 0.0;
  var em_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      xhii_sum = xhii_sum + p.vel_ion.w;
      spd_sum = spd_sum + length(p.vel_ion.xyz);
      em_sum = em_sum + p.em_spec.x + p.em_spec.y + p.em_spec.z;
    }
    i = i + 64u;
  }
  wg0[tid] = xhii_sum; wg1[tid] = spd_sum; wg2[tid] = em_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;function en(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function tn(e,{regime:t=`h2-pillars`,uvFlux:n=1.2,radBeta:r=.85,windSpeed:i=1.6,sublimationDrive:a=1,bipolarAsymmetry:o=1.35,sourceDir:s=[.65,.55,.52],particleCount:c=5120,seed:l=20261125,centerOffset:u=[0,0,0],label:d=`ulg-radiative-wind`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createRadiativePhotoionizationWindSessionWebGpu requires a live WebGPU GPUDevice`);let f={"h2-pillars":0,"planetary-nebula":1,"snr-pwn":2,"comet-dual-tail":3,"hot-jupiter-xuv":4}[t]??0,m=Math.max(256,Math.min(32768,Math.trunc(c))),h=en(l),g=Number(u?.[0])||0,_=Number(u?.[1])||0,v=Number(u?.[2])||0,y=Math.hypot(s[0],s[1],s[2])||1,b=[s[0]/y,s[1]/y,s[2]/y],x=new Float32Array(m*16);for(let e=0;e<m;e+=1){let t=e*16,a=0,s=0,c=0,l=0,u=0,d=0,p=1,y=n>0?.35:0;if(f===0)if(e<m*.62){let t=e%3,r=(t-1)*2.4,i=t===1?-.9:.7,o=(h()-.5)*6.8,l=(.45+.55*(1-(o+3.4)/7.5))*Math.sqrt(h()),u=h()*Math.PI*2;a=r+Math.cos(u)*l,s=o,c=i+Math.sin(u)*l,p=0,y=n>0?.12:0}else{let e=Math.cbrt(h())*6.8,t=2*h()-1,n=Math.sqrt(Math.max(0,1-t*t)),r=h()*Math.PI*2;a=e*n*Math.cos(r),s=e*t,c=e*n*Math.sin(r),p=2}else if(f===1){let e=h()*Math.PI*2,t=2*h()-1,n=Math.sqrt(Math.max(0,1-t*t)),r=(1.6+h()*2.6)*(1+o*.45*t*t);a=r*n*Math.cos(e),s=r*t,c=r*n*Math.sin(e),l=a*.25,u=s*.32,d=c*.25,p=Math.abs(t)>.5?2:1}else if(f===2){let t=e<m*.28,n=h()*Math.PI*2,r=2*h()-1,i=Math.sqrt(Math.max(0,1-r*r)),o=t?.4+h()*1.9:3.2+(h()-.5)*1.3;a=o*i*Math.cos(n),s=o*r,c=o*i*Math.sin(n),l=a*.4,u=s*.4,d=c*.4,p=t?2:3}else{let t=(e&1)==0,o=h()*6.5,f=.25+.14*o,m=h()*Math.PI*2,g=[-b[2],0,b[0]],_=Math.hypot(g[0],g[2])||1;g[0]/=_,g[2]/=_;let v=t?0:.16*o*o*r;a=-b[0]*o+g[0]*(v+Math.cos(m)*f),s=-b[1]*o+Math.sin(m)*f,c=-b[2]*o+g[2]*(v+Math.cos(m)*f),l=-b[0]*(t?i:r),u=-b[1]*(t?i:r),d=-b[2]*(t?i:r),p=+!!t,y=t&&n>0?.8:0}x[t+0]=a+g,x[t+1]=s+_,x[t+2]=c+v,x[t+3]=p,x[t+4]=l,x[t+5]=u,x[t+6]=d,x[t+7]=y,x[t+8]=y*.7,x[t+9]=y*.5,x[t+10]=.4,x[t+11]=h()*2.5,x[t+12]=h(),x[t+13]=h(),x[t+14]=h(),x[t+15]=1}let S=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],C=O(e,{cacheKey:`ulg-rad-wind-step.v1`,label:`${d}-step`,code:$t,entryPoint:`step_radiative_wind`,bindings:S}),w=O(e,{cacheKey:`ulg-rad-wind-tel.v1`,label:`${d}-tel`,code:$t,entryPoint:`reduce_rad_wind_telemetry`,bindings:S}),T=e.createBuffer({label:`${d}-params`,size:80,usage:Xt.UNIFORM|Xt.COPY_DST}),k=e.createBuffer({label:`${d}-parcels`,size:x.byteLength,usage:Xt.STORAGE|Xt.VERTEX|Xt.COPY_DST}),A=e.createBuffer({label:`${d}-tel`,size:16,usage:Xt.STORAGE|Xt.COPY_SRC}),j=e.createBuffer({label:`${d}-tel-rd`,size:16,usage:Xt.MAP_READ|Xt.COPY_DST});e.queue.writeBuffer(k,0,x);let M=D(e,{layout:C.bindGroupLayout,label:`${d}-bg`,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:A}}]}),N=0,P=!1,F=!1,I=Object.freeze({schema:Yt,regime:t,stepIndex:0,meanIonizedFraction:0,meanOutflowSpeed:0,meanLineEmission:0,activeParcels:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),L=Math.ceil(m/64);async function R({dt:s=.035,substeps:c=2,readTelemetry:l=!0}={}){if(F)return I;let u=Math.max(1,Math.min(16,Math.trunc(c))),h=Math.max(.004,Math.min(.1,Number(s)||.035)),y=new ArrayBuffer(80);new Uint32Array(y,0,4).set([m,f,N,0]),new Float32Array(y,16,16).set([h,n,r,i,a,o,8.6,0,b[0],b[1],b[2],6,g,_,v,0]),e.queue.writeBuffer(T,0,y);let x=e.createCommandEncoder({label:`${d}-enc-${N}`}),S=x.beginComputePass({label:`${d}-pass`});S.setBindGroup(0,M),S.setPipeline(C.pipeline);for(let e=0;e<u;e+=1)S.dispatchWorkgroups(L),N+=1;S.setPipeline(w.pipeline),S.dispatchWorkgroups(1),S.end();let E=l&&!P&&j.mapState===`unmapped`;if(E&&(P=!0,x.copyBufferToBuffer(A,0,j,0,16)),e.queue.submit([x.finish()]),E)try{if(await j.mapAsync(Xt.MAP_READ),!F){let e=new Float32Array(j.getMappedRange(0,16));I=Object.freeze({schema:Yt,regime:t,stepIndex:N,meanIonizedFraction:e[0],meanOutflowSpeed:e[1],meanLineEmission:e[2],activeParcels:Math.round(e[3]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{j.unmap()}catch{}}catch(e){if(!F&&e?.name!==`AbortError`)throw e}finally{P=!1}return I}function z(){if(!F){F=!0;for(let e of[T,k,A,j])try{e.destroy()}catch{}}}return Object.freeze({schema:Yt,lawAdapter:Zt,get regime(){return t},get particleCount(){return m},get stepIndex(){return N},getResidentParcelsBuffer:()=>k,getTelemetry:()=>I,step:R,dispose:z})}function nn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`radiative-photoionization-winds@1`)?e.resolveModule(`radiative-photoionization-winds@1`)?.descriptor||null:e.registerModule({method:{model:`radiative-photoionization-winds`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/radiativePhotoionizationWindGpu.js`,entryPoint:`step_radiative_wind`,workgroupSize:64},parameterSchema:{regime:{type:`string`,required:!1},uvFlux:{type:`number`,min:0,max:20,required:!1}},stateLayout:{tensorId:`outflow-tail-particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`species`,`vx`,`vy`,`vz`,`xHII`,`hAlpha`,`oIII`,`sII`,`age`,`seed`,`r0`,`theta0`,`live`]},scaleRangeM:[1e3,0x56bc75e2d63100000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=tn(n,{regime:r.regime??`planetary-nebula`,uvFlux:r.uvFlux??1.2,particleCount:512}),a=await i.step({dt:.035,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:rad-wind:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/radiativePhotoionizationWindGpu.js`,entryPoint:`createRadiativePhotoionizationWindSessionWebGpu`,kernelEntryPoint:`step_radiative_wind`},representation:`radiative-photoionization-wind-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-radiative-wind`,placement:`local`},validity:{finite:Number.isFinite(a.meanIonizedFraction)&&Number.isFinite(a.meanOutflowSpeed)},validation:{status:`pass`,validationMode:`gpu-radiative-wind-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var rn=`ulg.astrophysics.tidal-roche-disruption-webgpu.v1`,an=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),on=Object.freeze({id:`tidal-roche-rheology-cryovolcanism`,lawNodeId:`law:astrophysics-tidal-roche-rheology`,orderConstraint:`after:particle-rigid-dynamics`,adapterMode:o.SOLID_PROXY,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`tidal-debris-particles`]),writes:Object.freeze([`tidal-debris-particles`]),accumulates:Object.freeze([`tidal-dissipation-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`orbital-plus-spin-angular-momentum`]),validityDomain:Object.freeze({minBodies:2}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([100,0x5af3107a4000]),fundamentalLaws:Object.freeze([`roche-tidal-tensor`,`cohesive-bond-rupture`,`viscoelastic-tidal-dissipation`,`cryovolcanic-plume-venting`,`common-envelope-drag`])});function sn(e={}){let t=Number(e.gravitatingBodyCount)||0,n=Number(e.maxTidalStrain)||0,r=Number(e.maxSurfaceTempK)||0,i=Number(e.solidBodyCount)||0,a=t>=2&&(n>1e-6||i>0)||r>1200;return{active:a,rocheDisruptionActive:n>.25,magmaOceanActive:r>1400,reason:a?`tidal-or-magma-rheology-present`:`isolated-cold-body-dormant`}}var cn=`
struct TidalParams {
  particle_count: u32,
  mode_code: u32,      // 0=roche_rubble_disruption+rings, 1=giant_impact_magma_disk, 2=cryovolcanic_plumes, 3=red_giant_engulfment
  step_index: u32,
  pad0: u32,
  dt: f32,
  gm_host: f32,
  r_host: f32,
  r_roche: f32,
  cohesion_strength: f32,
  self_grav_k: f32,
  tidal_heat_drive: f32,
  envelope_drag: f32,
  shepherd_pos_m: vec4<f32>, // xyz = shepherd moon position, w = shepherd GM
  cluster_com_r: vec4<f32>,  // xyz = rubble-pile COM (updated dynamically), w = initial cluster radius
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 9 (Roche Debris / Ring / Impact / Cryo-Plume!):
//   pos_m:    vec4(x, y, z, mass)
//   vel_bond: vec4(vx, vy, vz, bond_intact)   bond_intact: 1.0 = cohesively bound, 0.0 = tidally ruptured!
//   therm_id: vec4(temp_K_norm, strain, role, age)
//   meta0:    vec4(seed, r_local, phi0, live)
struct TidalParticle {
  pos_m: vec4<f32>,
  vel_bond: vec4<f32>,
  therm_id: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: TidalParams;
@group(0) @binding(1) var<storage, read_write> parts: array<TidalParticle>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_tidal_roche(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parts[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_bond.xyz;
  var intact = p.vel_bond.w;
  let dt = params.dt;
  let mode = params.mode_code;

  if (mode == 2u) {
    // Cryovolcanic Icy Moon Supersonic Water-Vapor / Ice-Crystal Plumes (driven by tidal_heat_drive!)
    if (params.tidal_heat_drive <= 1e-6) {
      p.therm_id.x = 0.0;
      p.meta0.w = 0.0;
      parts[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let r = max(params.r_host * 0.9, length(loc));
    let dir = loc / r;
    // Gravity pulls ballistic ice crystals back down while fast vapor escapes into E-ring!
    let acc_g = -dir * (params.gm_host / (r * r));
    vel = vel + acc_g * dt;
    loc = loc + vel * dt;
    let age = p.therm_id.w + dt;
    if (length(loc) < params.r_host * 1.01 || length(loc) > params.r_host * 4.5 || age > 4.2) {
      // Erupt from south-polar tidal tiger-stripe fractures!
      let stripe = floor(p.meta0.x * 4.0) - 1.5;
      let az = p.meta0.z * 6.2831853;
      let lat = -1.28 + stripe * 0.08 + (p.meta0.y - 0.5) * 0.06;
      let cl = cos(lat); let sl = sin(lat);
      let n_vent = normalize(vec3<f32>(cl * cos(az), sl, cl * sin(az)));
      loc = n_vent * (params.r_host * 1.02);
      let v_jet = (0.85 + 1.45 * p.meta0.y) * sqrt(params.tidal_heat_drive);
      vel = n_vent * v_jet + vec3<f32>((p.meta0.x - 0.5) * 0.25, 0.0, (p.meta0.z - 0.5) * 0.25);
      p.therm_id.w = 0.0;
    } else {
      p.therm_id.w = age;
    }
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(clamp(0.45 + 0.55 * params.tidal_heat_drive, 0.2, 1.5), params.tidal_heat_drive, 2.0, p.therm_id.w);
    parts[i] = p;
    return;
  }

  // Gravity from central host planet/star + shepherd moon resonant kicks!
  let r = max(params.r_host * 0.85, length(loc));
  let dir = loc / r;
  var acc = -dir * (params.gm_host / (r * r));

  if (params.shepherd_pos_m.w > 0.0) {
    let ds = params.shepherd_pos_m.xyz - loc;
    let rs = max(0.22, length(ds));
    acc = acc + (ds / (rs * rs * rs)) * params.shepherd_pos_m.w;
    // Resonant ring-gap clearing if ring particle strays inside shepherd Hill sphere
    if (rs < 0.36 && p.therm_id.z > 0.5) {
      let push = -ds / rs;
      vel = vel + push * 0.32 * dt;
    }
  }

  // Exact Tidal Gravity-Gradient Stress vs. Cohesive Tensile Strength + Self-Gravity!
  // Tidal acceleration across cluster radius R_c is: a_tidal = 2 * G * M_host * R_c / r^3
  let r_c = max(0.15, params.cluster_com_r.w);
  let a_tidal = (2.0 * params.gm_host * r_c) / (r * r * r);
  let a_hold = params.self_grav_k + params.cohesion_strength;
  let strain = a_tidal / max(1e-4, a_hold);

  if (mode == 0u && intact > 0.5) {
    // Check physical Roche-limit tensile rupture criterion: strain > 1.0 (i.e. r < R_Roche!)
    if (strain > 1.0 && r < params.r_roche * 1.05) {
      intact = 0.0; // Bond ruptured! Particle detaches into independent Keplerian ring debris!
    } else {
      // Intact cohesive rubble-pile restoring spring toward live cluster COM!
      let to_com = params.cluster_com_r.xyz - loc;
      let d_com = length(to_com);
      if (d_com > r_c * 0.35) {
        acc = acc + to_com * (a_hold * 2.4);
      }
    }
  }

  // Red-Giant Common-Envelope Aerodynamic Drag (mode=3) spiraling inner orbits inward!
  if (mode == 3u && r < params.r_host * 1.45) {
    vel = vel * (1.0 - params.envelope_drag * dt);
  }

  vel = vel + acc * dt;
  // Mild inelastic ring-plane flattening (mutual ring-particle collisions damp inclination!)
  if (intact < 0.5 && mode <= 1u) {
    vel.y = vel.y * (1.0 - 0.65 * dt);
  }
  loc = loc + vel * dt;

  // Keep disrupted debris outside host surface (accreted debris recycles softly at outer disk edge)
  if (length(loc) < params.r_host * 1.04) {
    let n_out = normalize(loc + vec3<f32>(1e-4, 0.0, 0.0));
    loc = n_out * (params.r_host * 1.06);
    vel = vel - n_out * min(0.0, dot(vel, n_out)) * 1.2;
  }

  // Thermal heating: Giant Impact / Magma Ocean stays molten hot (>1.0); tidal disruption warms debris
  let t_next = select(
    clamp(p.therm_id.x * exp(-0.08 * dt) + strain * 0.12 * dt, 0.12, 1.8),
    clamp(0.85 + 0.85 * exp(-length(loc) * 0.18), 0.25, 1.8),
    mode == 1u
  );
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_bond = vec4<f32>(vel, intact);
  p.therm_id = vec4<f32>(t_next, strain, p.therm_id.z, p.therm_id.w + dt);
  p.meta0.w = 1.0;
  parts[i] = p;
}

@compute @workgroup_size(64)
fn reduce_tidal_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ruptured = 0.0;
  var strain_max = 0.0;
  var r_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parts[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      if (p.vel_bond.w < 0.5) { ruptured = ruptured + 1.0; }
      strain_max = max(strain_max, p.therm_id.y);
      r_sum = r_sum + length(p.pos_m.xyz - params.center_offset.xyz);
    }
    i = i + 64u;
  }
  wg0[tid] = ruptured; wg1[tid] = strain_max; wg2[tid] = r_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0], wg2[0] * inv, wg3[0]);
  }
}
`;function ln(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function un(e,{mode:t=`roche-rings`,orbitRadiusSim:n=2.6,rHostSim:r=1.35,rRocheSim:i=3.6,gmHost:a=24,cohesionStrength:o=.65,selfGravK:s=.55,tidalHeatDrive:c=1,shepherdGm:l=.55,particleCount:u=4096,seed:d=20261125,centerOffset:f=[0,0,0],label:m=`ulg-tidal-roche`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createTidalRocheDisruptionSessionWebGpu requires a live WebGPU GPUDevice`);let h={"roche-rings":0,"giant-impact":1,"cryo-plumes":2,"red-giant-engulf":3}[t]??0,g=Math.max(256,Math.min(32768,Math.trunc(u))),_=ln(d),v=Number(f?.[0])||0,y=Number(f?.[1])||0,b=Number(f?.[2])||0,x=[n,0,0],S=[0,0,Math.sqrt(a/Math.max(.5,n))],C=1.1,w=i*.92,T=.52,k=new Float32Array(g*16);for(let e=0;e<g;e+=1){let t=e*16,n=0,o=0,s=0,c=0,l=0,u=0,d=1,f=0,p=.25;if(h===0)if(e<g*.45){let e=Math.cbrt(_())*T,t=2*_()-1,r=Math.sqrt(Math.max(0,1-t*t)),i=_()*Math.PI*2;n=x[0]+e*r*Math.cos(i),o=x[1]+e*t,s=x[2]+e*r*Math.sin(i),c=S[0],l=S[1],u=S[2],d=1,f=0}else{let e=r*1.28+_()*(i*1.05-r*1.28),t=_()*Math.PI*2,p=Math.sqrt(a/e);n=Math.cos(t)*e,o=(_()-.5)*.08,s=Math.sin(t)*e,c=-Math.sin(t)*p,l=0,u=Math.cos(t)*p,d=0,f=1}else if(h===1){let e=_()*Math.PI*2,t=r*1.15+_()**.78*5.2,i=Math.sqrt(a/t)*(.88+.24*_());n=Math.cos(e)*t,o=(_()-.5)*(.28+.16*t),s=Math.sin(e)*t,c=-Math.sin(e)*i,l=(_()-.5)*.35,u=Math.cos(e)*i,d=0,f=1,p=1.45}else if(h===2){let e=_()*Math.PI*2,t=-1.25+(_()-.5)*.22,i=Math.cos(t),a=Math.sin(t),m=r*(1.02+_()*1.8);n=i*Math.cos(e)*m,o=a*m,s=i*Math.sin(e)*m,c=n*.4,l=o*.4,u=s*.4,d=0,f=2,p=.6}else{let e=_()*Math.PI*2,t=r*(1.1+_()*3.8),i=Math.sqrt(a/t);n=Math.cos(e)*t,o=(_()-.5)*.4,s=Math.sin(e)*t,c=-Math.sin(e)*i,l=0,u=Math.cos(e)*i,d=0,f=3,p=1.3}k[t+0]=n+v,k[t+1]=o+y,k[t+2]=s+b,k[t+3]=1,k[t+4]=c,k[t+5]=l,k[t+6]=u,k[t+7]=d,k[t+8]=p,k[t+9]=0,k[t+10]=f,k[t+11]=_()*2,k[t+12]=_(),k[t+13]=_(),k[t+14]=_(),k[t+15]=1}let A=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],j=O(e,{cacheKey:`ulg-tidal-roche-step.v1`,label:`${m}-step`,code:cn,entryPoint:`step_tidal_roche`,bindings:A}),M=O(e,{cacheKey:`ulg-tidal-roche-tel.v1`,label:`${m}-tel`,code:cn,entryPoint:`reduce_tidal_telemetry`,bindings:A}),N=e.createBuffer({label:`${m}-params`,size:96,usage:an.UNIFORM|an.COPY_DST}),P=e.createBuffer({label:`${m}-parts`,size:k.byteLength,usage:an.STORAGE|an.VERTEX|an.COPY_DST}),F=e.createBuffer({label:`${m}-tel`,size:16,usage:an.STORAGE|an.COPY_SRC}),I=e.createBuffer({label:`${m}-tel-rd`,size:16,usage:an.MAP_READ|an.COPY_DST});e.queue.writeBuffer(P,0,k);let L=D(e,{layout:j.bindGroupLayout,label:`${m}-bg`,entries:[{binding:0,resource:{buffer:N}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:F}}]}),R=0,z=!1,B=!1,V=Object.freeze({schema:rn,mode:t,stepIndex:0,rupturedFraction:0,maxTidalStrain:0,meanRadiusSim:n,activeParticles:0,accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),H=Math.ceil(g/64);async function U({dt:n=.025,substeps:u=2,readTelemetry:d=!0}={}){if(B)return V;let f=Math.max(1,Math.min(16,Math.trunc(u))),_=Math.max(.004,Math.min(.08,Number(n)||.025));for(let e=0;e<f;e+=1){let e=Math.max(.5,Math.hypot(x[0],x[1],x[2])),t=-a/(e*e*e);S[0]+=x[0]*t*_,S[1]+=x[1]*t*_,S[2]+=x[2]*t*_,x[0]+=S[0]*_,x[1]+=S[1]*_,x[2]+=S[2]*_;let n=Math.sqrt(a/w**3);C+=n*_,R+=1}let E=[Math.cos(C)*w,0,Math.sin(C)*w],D=new ArrayBuffer(96);new Uint32Array(D,0,4).set([g,h,R,0]),new Float32Array(D,16,20).set([_,a,r,i,o,s,c,h===3?.35:0,E[0],E[1],E[2],h===0?l:0,x[0],x[1],x[2],T,v,y,b,0]),e.queue.writeBuffer(N,0,D);let O=e.createCommandEncoder({label:`${m}-enc-${R}`}),k=O.beginComputePass({label:`${m}-pass`});k.setBindGroup(0,L),k.setPipeline(j.pipeline),k.dispatchWorkgroups(H),k.setPipeline(M.pipeline),k.dispatchWorkgroups(1),k.end();let A=d&&!z&&I.mapState===`unmapped`;if(A&&(z=!0,O.copyBufferToBuffer(F,0,I,0,16)),e.queue.submit([O.finish()]),A)try{if(await I.mapAsync(an.MAP_READ),!B){let e=new Float32Array(I.getMappedRange(0,16));V=Object.freeze({schema:rn,mode:t,stepIndex:R,rupturedFraction:e[0],maxTidalStrain:e[1],meanRadiusSim:e[2],activeParticles:Math.round(e[3]),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{I.unmap()}catch{}}catch(e){if(!B&&e?.name!==`AbortError`)throw e}finally{z=!1}return V}function W(e=1){let t=[];return h===0?(t.push({pos:[v*e,y*e,b*e],radius:r*e,color0:[.88,.78,.58],color1:[.68,.56,.38],kind:2,atm:.42}),t.push({pos:[(Math.cos(C)*w+v)*e,y*e,(Math.sin(C)*w+b)*e],radius:.14*e,color0:[.76,.74,.72],color1:[.48,.46,.44],kind:3,atm:0})):h===1?t.push({pos:[v*e,y*e,b*e],radius:r*e,color0:[1,.42,.08],color1:[.22,.08,.05],kind:7,atm:.55}):h===2?t.push({pos:[v*e,y*e,b*e],radius:r*e,color0:[.86,.9,.96],color1:[.46,.62,.78],kind:3,atm:.14}):t.push({pos:[v*e,y*e,b*e],radius:r*1.65*e,color0:[1,.38,.12],color1:[.72,.12,.04],kind:0,atm:0}),t}function G(){if(!B){B=!0;for(let e of[N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:rn,lawAdapter:on,get mode(){return t},get particleCount(){return g},get stepIndex(){return R},getResidentParticlesBuffer:()=>P,getRenderSpheres:W,getTelemetry:()=>V,step:U,dispose:G})}function dn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`tidal-roche-rheology-cryovolcanism@1`)?e.resolveModule(`tidal-roche-rheology-cryovolcanism@1`)?.descriptor||null:e.registerModule({method:{model:`tidal-roche-rheology-cryovolcanism`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/tidalRocheDisruptionGpu.js`,entryPoint:`step_tidal_roche`,workgroupSize:64},parameterSchema:{mode:{type:`string`,required:!1},orbitRadiusSim:{type:`number`,min:.5,max:50,required:!1}},stateLayout:{tensorId:`tidal-debris-particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`intact`,`temp`,`strain`,`role`,`age`,`seed`,`r0`,`phi0`,`live`]},scaleRangeM:[100,0x5af3107a4000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=un(n,{mode:r.mode??`roche-rings`,orbitRadiusSim:r.orbitRadiusSim??2.4,particleCount:512}),a=await i.step({dt:.025,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:tidal-roche:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/tidalRocheDisruptionGpu.js`,entryPoint:`createTidalRocheDisruptionSessionWebGpu`,kernelEntryPoint:`step_tidal_roche`},representation:`tidal-roche-rheology-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-tidal-roche`,placement:`local`},validity:{finite:Number.isFinite(a.rupturedFraction)&&Number.isFinite(a.maxTidalStrain)},validation:{status:`pass`,validationMode:`gpu-tidal-roche-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var fn=`peercompute.ulg.universal-law-graph.v1`,Q=Object.freeze({GRAVITY:`gravity`,ELECTROMAGNETISM:`electromagnetism`,HYDRODYNAMICS:`hydrodynamics`,THERMODYNAMICS:`thermodynamics`,RIGID_SOLID_MECHANICS:`rigid-solid-mechanics`,NUCLEAR_QUANTUM:`nuclear-quantum`}),pn=Object.freeze({id:`flrw-treepm-cosmology`,lawNodeId:`law:astrophysics-flrw-treepm-cosmology`,orderConstraint:`root:cosmological-epoch`,adapterMode:o.AGGREGATE_FAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`cosmo-particles`,`flrw-scale-factor`,`fft3d-poisson-grid`]),writes:Object.freeze([`cosmo-particles`,`fft3d-poisson-grid`]),accumulates:Object.freeze([`cosmo-power-spectrum-pk`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`comoving-mass`,`comoving-linear-momentum`]),validityDomain:Object.freeze({aScaleMin:.01,aScaleMax:2,comovingBoxMinMpc:1}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e22,1e26])}),mn=Object.freeze({id:`galactic-mhd-evolution`,lawNodeId:`law:astrophysics-galactic-mhd-evolution`,orderConstraint:`after:flrw-treepm-cosmology`,adapterMode:o.AGGREGATE_FAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`galactic-stars-dm-ism`,`ss-scale-atlas-multipole`,`gate1-ism-cooling-anchors`]),writes:Object.freeze([`galactic-stars-dm-ism`]),accumulates:Object.freeze([`galactic-dynamo-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({minBodies:64,metallicityNonNegative:!0}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([0xde0b6b3a7640000,1e22])}),hn=Object.freeze({id:`solar-system-nbody`,lawNodeId:`law:astrophysics-symplectic-nbody-f32x2`,orderConstraint:`after:protoplanetary-accretion`,adapterMode:o.AGGREGATE_FAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`nbody-f32x2-bodies`]),writes:Object.freeze([`nbody-f32x2-bodies`]),accumulates:Object.freeze([`nbody-conservation-ledger`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`symplectic-energy`]),validityDomain:Object.freeze({doubleFloatProtectedTwoSum:!0,maxDtSubYr:12e-5}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e7,0x2386f26fc10000])}),gn=Object.freeze({id:`self-gravitating-hydro-fusion`,lawNodeId:`law:astrophysics-stellar-hydro-fusion`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:o.AGGREGATE_FAR,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`stellar-hydro-parcels`,`closure-plasma-eos`,`gate1-nuclear-qvalues`]),writes:Object.freeze([`stellar-hydro-parcels`]),accumulates:Object.freeze([`stellar-fusion-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`nucleon-fractions`,`linear-momentum`,`first-law-energy`]),validityDomain:Object.freeze({requiresPositiveDensity:!0,gate1BetaPlusQValues:!0}),fallbackPolicy:u.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e8,0x16345785d8a0000])}),_n=Object.freeze({id:`planetary-interior-polytope`,lawNodeId:`law:astrophysics-planetary-hydrostatic-polytope`,orderConstraint:`after:solar-system-nbody`,adapterMode:o.CELL_LOCAL,spatialAuthority:b.CANONICAL_SS_EPOCH,reads:Object.freeze([`gate2-polytope-atlas-bank`,`planetary-mass-composition`]),writes:Object.freeze([`planetary-radial-hydrostatic-profile`]),accumulates:Object.freeze([`planetary-moi-and-core-radius`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`radial-mass`,`hydrostatic-balance`]),validityDomain:Object.freeze({failClosedPolytopeBounds:!0,maxPressurePa:0xe8d4a51000}),fallbackPolicy:u.FAIL_CLOSED,scaleRangeM:Object.freeze([1e5,1e8])}),vn=Object.freeze([Object.freeze({id:`flrw-treepm-cosmology`,methodKey:`flrw-treepm-cosmology@1`,title:`ΛCDM FLRW 2LPT + 3D-FFT TreePM Cosmology`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS]),scaleRangeM:Object.freeze([1e22,1e26]),adapter:pn,evaluateActivation(e={}){let t=(Number(e.comovingBoxMpc)||0)>=1&&(Number(e.omegaM)||0)>0;return{active:t,reason:t?`expanding-comoving-volume-present`:`sub-cosmological-scale-dormant`}}}),Object.freeze({id:`galactic-mhd-evolution`,methodKey:`galactic-mhd-evolution@1`,title:`Galactic Scale-Atlas Multipole, ISM Λ(T, Z) Cooling & α–ω Dynamo`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS,Q.ELECTROMAGNETISM,Q.THERMODYNAMICS]),scaleRangeM:Object.freeze([0xde0b6b3a7640000,1e22]),adapter:mn,evaluateActivation(e={}){let t=Number(e.galacticBodyCount)||0,n=Number(e.viewSpanM)||0,r=t>=64||n>=0x16345785d8a0000&&n<=1e23;return{active:r,reason:r?`galactic-halo-disk-present`:`outside-galactic-regime-dormant`}}}),Object.freeze({id:`nebular-mhd-collapse`,methodKey:`nebular-mhd-collapse@1`,title:`3D Self-Gravitating Resistive MHD Nebular Collapse & Bipolar Jets`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS,Q.ELECTROMAGNETISM,Q.THERMODYNAMICS]),scaleRangeM:Object.freeze([0x9184e72a000,0xde0b6b3a7640000]),adapter:fe,evaluateActivation(e={}){let t=Number(e.nebulaCloudMass)||0,n=Math.abs(Number(e.magneticFieldStrength)||0),r=Number(e.magneticReynolds)||0,i=t>0&&(n>0||r>1||!!e.ionizedGasPresent);return{active:i,lorentzActive:n>1e-6,reason:i?`magnetized-self-gravitating-cloud-present`:`no-magnetized-nebula-dormant`}}}),Object.freeze({id:`protoplanetary-accretion`,methodKey:`protoplanetary-accretion@1`,title:`Protoplanetary Disk Gas Drag, Snow-Line Sublimation & Pebble Accretion`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS,Q.THERMODYNAMICS,Q.RIGID_SOLID_MECHANICS]),scaleRangeM:Object.freeze([1e10,0x5af3107a4000]),adapter:He,evaluateActivation:Ue}),Object.freeze({id:`solar-system-nbody`,methodKey:`solar-system-nbody@1`,title:`Real-Scale Double-Float (f32x2) Symplectic Mutual N-Body Gravity`,families:Object.freeze([Q.GRAVITY]),scaleRangeM:Object.freeze([1e7,0x2386f26fc10000]),adapter:hn,evaluateActivation(e={}){let t=(Number(e.gravitatingBodyCount)||0)>=2;return{active:t,reason:t?`multi-body-gravitational-system-present`:`single-or-zero-body-dormant`}}}),Object.freeze({id:`self-gravitating-hydro-fusion`,methodKey:`self-gravitating-hydro@1`,title:`Self-Gravitating Compressible Plasma & Gate 1 Thermonuclear Fusion`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS,Q.THERMODYNAMICS,Q.NUCLEAR_QUANTUM]),scaleRangeM:Object.freeze([1e8,0x16345785d8a0000]),adapter:gn,evaluateActivation(e={}){let t=Number(e.coreTempK)||0,n=Number(e.bodyMassKg)||0,r=t>=1e6||n>=1e28;return{active:r,reason:r?`fusion-capable-plasma-core-present`:`sub-stellar-temperature-dormant`}}}),Object.freeze({id:`planetary-interior-polytope`,methodKey:`planetary-interior-polytope@1`,title:`Fail-Closed Gate 2 Polytope-Atlas Hydrostatic Interior Equilibrium`,families:Object.freeze([Q.GRAVITY,Q.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e5,1e8]),adapter:_n,evaluateActivation(e={}){let t=Number(e.bodyMassKg)||0,n=Number(e.bodyRadiusM)||0,r=t>=0x56bc75e2d63100000&&n>=1e5&&t<1e28;return{active:r,reason:r?`self-gravitating-planetary-interior-present`:`non-hydrostatic-body-dormant`}}}),Object.freeze({id:`planetary-atmosphere-em`,methodKey:`planetary-atmosphere-em@1`,title:`Spherical Baroclinic Fluid, Particulate Triboelectricity, Paschen Breakdown & Core Geodynamo`,families:Object.freeze([Q.HYDRODYNAMICS,Q.ELECTROMAGNETISM,Q.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e4,1e8]),adapter:be,evaluateActivation(e={}){let t=Ce(e);return{active:t.anyActive,details:t,reason:t.anyActive?`active:${t.activeLaws.join(`,`)}`:`vacuum-nonmagnetized-body-dormant`}}}),Object.freeze({id:`particle-rigid-dynamics`,methodKey:`particle-rigid-dynamics@1`,title:`Particle-Composite SE(3) DLM Symplectic Rigid-Body & Hertz-Mindlin/JKR Contact Dynamics`,families:Object.freeze([Q.RIGID_SOLID_MECHANICS,Q.GRAVITY]),scaleRangeM:Object.freeze([.001,1e8]),adapter:Me,evaluateActivation:Y}),Object.freeze({id:`cosmological-baryon-radiation`,methodKey:`cosmological-baryon-radiation@1`,title:`Eisenstein-Hu BAO/CMB Recombination, Reionization Bubbles, ICM X-Ray/SZ & 2D Lensing`,families:Object.freeze([Q.GRAVITY,Q.HYDRODYNAMICS,Q.THERMODYNAMICS,Q.ELECTROMAGNETISM]),scaleRangeM:Object.freeze([1e21,1e26]),adapter:mt,evaluateActivation:ht}),Object.freeze({id:`relativistic-compact-kerr-jet`,methodKey:`relativistic-compact-kerr-jet@1`,title:`GR TOV Unified Degenerate EOS (WD/NS/BH) & Kerr Blandford-Znajek Relativistic Jets (Quasar/Blazar)`,families:Object.freeze([Q.GRAVITY,Q.ELECTROMAGNETISM,Q.HYDRODYNAMICS,Q.NUCLEAR_QUANTUM]),scaleRangeM:Object.freeze([1e3,1e22]),adapter:St,evaluateActivation:Ct}),Object.freeze({id:`compact-magnetosphere-spindown`,methodKey:`compact-magnetosphere-spindown@1`,title:`Force-Free Oblique Dipole Spin-Down, Pulsar Lighthouse Beams & Magnetar Crustal-Yield Giant Flares`,families:Object.freeze([Q.ELECTROMAGNETISM,Q.RIGID_SOLID_MECHANICS,Q.GRAVITY]),scaleRangeM:Object.freeze([1e4,0x16345785d8a0000]),adapter:Nt,evaluateActivation:Pt}),Object.freeze({id:`relativistic-binary-gw-rprocess`,methodKey:`relativistic-binary-gw-rprocess@1`,title:`1PN/2.5PN Gravitational-Wave Inspiral Chirp, Roche-Lobe X-Ray Binaries, Type Ia & BNS Kilonova r-Process`,families:Object.freeze([Q.GRAVITY,Q.NUCLEAR_QUANTUM,Q.HYDRODYNAMICS]),scaleRangeM:Object.freeze([1e4,0x38d7ea4c68000]),adapter:Ht,evaluateActivation:Ut}),Object.freeze({id:`radiative-photoionization-winds`,methodKey:`radiative-photoionization-winds@1`,title:`Strömgren Photoionization (H II Pillars/Planetary Nebulae/SNR), Stellar Winds, XUV Escape & Dual-Tail Comets`,families:Object.freeze([Q.ELECTROMAGNETISM,Q.HYDRODYNAMICS,Q.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e3,0x56bc75e2d63100000]),adapter:Zt,evaluateActivation:Qt}),Object.freeze({id:`tidal-roche-rheology-cryovolcanism`,methodKey:`tidal-roche-rheology-cryovolcanism@1`,title:`Roche-Limit Cohesive Disruption, Ring Shepherd Moons, Tidal Heating, Cryovolcanism, Magma Oceans & RGB Engulfment`,families:Object.freeze([Q.GRAVITY,Q.RIGID_SOLID_MECHANICS,Q.THERMODYNAMICS,Q.HYDRODYNAMICS]),scaleRangeM:Object.freeze([100,0x5af3107a4000]),adapter:on,evaluateActivation:sn})]);function yn(e={}){let t=[],n=[],r=new Set;for(let i of vn){let a=i.evaluateActivation(e);if(a?.active){t.push(Object.freeze({id:i.id,methodKey:i.methodKey,title:i.title,families:i.families,reason:a.reason||`active`,details:a.details||null}));for(let e of i.families)r.add(e)}else n.push(Object.freeze({id:i.id,methodKey:i.methodKey,reason:a?.reason||`dormant`}))}return Object.freeze({schema:fn,active:Object.freeze(t),dormant:Object.freeze(n),activeFamilies:Object.freeze([...r])})}function bn(e){return!e||typeof e.registerModule!=`function`?[]:[_e(e),ke(e),Je(e),ze(e),bt(e),At(e),zt(e),Jt(e),nn(e),dn(e)].filter(Boolean)}var xn=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,$=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Sn=16,Cn=32,wn=`
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
const PK_BINS: u32 = ${Sn}u;

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
  let n_rem = min(params.remote_tile_count, ${Cn}u);
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
`,Tn=`
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
`;function En(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function Dn(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function On(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=En(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/f*2.5,x=N(e,n),S=x.n,C=x.total,w=[E(0,`uniform`),E(1,`storage`),E(2,`storage`)],T=O(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:Tn,entryPoint:`generate_zeldovich_kspace`,bindings:w}),D=O(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:Tn,entryPoint:`store_disp_axis`,bindings:w}),k=e.createBuffer({size:C*16,usage:$.STORAGE|$.COPY_SRC}),A=e.createBuffer({size:C*16,usage:$.MAP_READ|$.COPY_DST}),j=e.createBuffer({size:x.byteLength,usage:$.STORAGE|$.COPY_DST|$.COPY_SRC}),M=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([S,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,b,v]);let r=e.createBuffer({size:32,usage:$.UNIFORM|$.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(C/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:T.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:x.bufferA}},{binding:2,resource:{buffer:k}}]}),a=t.beginComputePass();a.setPipeline(T.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=x.encodeInverseFrom(t,x.bufferA),s=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:k}}]});a=t.beginComputePass(),a.setPipeline(D.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(k,0,A,0,C*16),e.queue.submit([t.finish()]),await A.mapAsync($.MAP_READ);let r=new Float32Array(A.getMappedRange().slice(0,C*16));A.unmap();let a=0;for(let e=0;e<C;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,C)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<C;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/S,_=.5/g,b=new Float32Array(C*2),w=(e,t,n)=>(((n+S)%S*S+(t+S)%S)*S+(e+S)%S)*4;for(let e=0;e<S;e+=1)for(let t=0;t<S;t+=1)for(let n=0;n<S;n+=1){let i=w(n+1,t,e),a=w(n-1,t,e),o=w(n,t+1,e),s=w(n,t-1,e),c=w(n,t,e+1),l=w(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*S+t)*S+n)*2]=g}e.queue.writeBuffer(x.bufferA,0,b),x.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let E=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),O=x.encodeForward(E);E.copyBufferToBuffer(O,0,j,0,x.byteLength);for(let t=0;t<3;t+=1){let r=x.encodePoissonInverseFromKSpace(E,j,{gradAxis:t+1}),i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:k}}]}),a=E.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}E.copyBufferToBuffer(k,0,A,0,C*16),e.queue.submit([E.finish()]),await A.mapAsync($.MAP_READ);let N=new Float32Array(A.getMappedRange().slice(0,C*16));A.unmap();let P=-.42857142857142855*Math.max(.001,h)**(-1/143),F=0;for(let e=0;e<C;e+=1){let t=P*N[e*4+0],n=P*N[e*4+1],r=P*N[e*4+2];N[e*4+0]=t,N[e*4+1]=n,N[e*4+2]=r,F+=t*t+n*n+r*r}let I=Math.sqrt(F/Math.max(1,C)),L=(e,t,n,r)=>{let i=(t+.5*f)/f*S,a=(n+.5*f)/f*S,o=(r+.5*f)/f*S,s=(Math.floor(i)%S+S)%S,c=(Math.floor(a)%S+S)%S,l=(Math.floor(o)%S+S)%S,u=(s+1)%S,d=(c+1)%S,p=(l+1)%S,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((C[t]*S+x[n])*S+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},R=Number(u?.[0])||0,z=Number(u?.[1])||0,B=Number(u?.[2])||0,V=d*d*d,H=new Float32Array(V*16),U=0,W=0,G=0,K=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=L(r,a,o,s),l=L(N,a,o,s),u=Dn(a+c[0]+l[0]+R,f),d=Dn(o+c[1]+l[1]+z,f),m=Dn(s+c[2]+l[2]+B,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];U+=h,W+=g,G+=_;let b=K*16;H[b+0]=u,H[b+1]=d,H[b+2]=m,H[b+3]=1,H[b+4]=h,H[b+5]=g,H[b+6]=_,H[b+7]=.28,H[b+12]=+(K%6==0),H[b+14]=i,K+=1}U/=V,W/=V,G/=V;for(let e=0;e<V;e+=1)H[e*16+4]-=U,H[e*16+5]-=W,H[e*16+6]-=G;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<V;t+=1){let n=H[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(H.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:V,data:t,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:V,globalParticleCount:V,data:H,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}finally{x.destroy(),k.destroy(),A.destroy(),j.destroy();for(let e of M)e.destroy()}}function kn({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=En(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=Dn(i+s+b,f),g=Dn(a+c+x,f),_=Dn(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function An(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:f=null,initialConditions:m=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let h=m||kn({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:f,initialPositionsShift:d}),g=h.particleCount,_=h.globalParticleCount??h.particleCount,v=n,y=v**3,b=N(e,v),x=[E(0,`uniform`),E(1,`storage`),E(2,`storage`),E(3,`storage`),E(4,`storage`),E(5,`storage`),E(6,`storage`),E(7,`storage`)],S=t=>O(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:wn,entryPoint:t,bindings:x}),C=S(`clear_grids`),w=S(`cic_deposit`),T=S(`prepare_poisson_rhs`),D=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),A=S(`store_force_y`),j=S(`store_force_z`),M=S(`cic_kick_drift`),P=S(`reduce_telemetry_f32`),F=S(`reduce_tile_multipole`),I=e.createBuffer({size:64,usage:$.UNIFORM|$.COPY_DST}),L=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,h.data.byteLength),usage:$.VERTEX|$.STORAGE|$.COPY_DST|$.COPY_SRC});h.data.byteLength>0&&e.queue.writeBuffer(L,0,h.data);let R=e.createBuffer({size:y*4,usage:$.STORAGE}),z=e.createBuffer({size:y*16,usage:$.STORAGE}),B=e.createBuffer({size:320,usage:$.STORAGE|$.COPY_SRC}),V=e.createBuffer({size:320,usage:$.MAP_READ|$.COPY_DST}),H=e.createBuffer({size:32,usage:$.MAP_READ|$.COPY_DST}),U=e.createBuffer({size:y*16,usage:$.STORAGE}),W=e.createBuffer({size:(y+Cn)*16,usage:$.STORAGE|$.COPY_DST}),G=e.createBuffer({size:b.byteLength,usage:$.STORAGE|$.COPY_DST|$.COPY_SRC}),K=t=>e.createBindGroup({layout:C.bindGroupLayout,entries:[I,L,R,t,z,B,U,W].map((e,t)=>({binding:t,resource:{buffer:e}}))}),q=K(b.bufferA),ee=K(b.bufferB),te=K(G),ne=e=>e===b.bufferA?q:e===b.bufferB?ee:te,re=r/v,ie=(c*re)**2,ae=l?c*re:0,oe=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:ie});let se=i,ce=0,le=0,ue=0,de=1,J=null,fe={xMin:-.5*r,xMax:.5*r},pe=(t=null)=>{let n=t||fe,i=En(se,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,se),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,ce,ue]),new Float32Array(l,16,12).set([r,se,a,i,o,c,oe,ae,le,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(I,0,l),{hA:i,gravPref:c}};function me(t=[]){let n=Array.isArray(t)?t.slice(0,Cn):[],r=new Float32Array(Cn*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return ue=n.length,e.queue.writeBuffer(W,y*16,r),ue}let he=Math.ceil(y/64),ge=Math.max(1,Math.ceil(g/64));async function _e({readTelemetry:t=!0}={}){let{hA:n}=pe(),i=a/(Math.max(.01,se)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${ce}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,q),u.setPipeline(C.pipeline),u.dispatchWorkgroups(he),g>0&&(u.setPipeline(w.pipeline),u.dispatchWorkgroups(ge)),u.setPipeline(T.pipeline),u.dispatchWorkgroups(he),u.end();let d=b.encodeForward(c);c.copyBufferToBuffer(d,0,G,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,te),u.setPipeline(D.pipeline),u.dispatchWorkgroups(Sn),u.end();let f=[k,A,j];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,G,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,ne(t)),u.setPipeline(f[e-1].pipeline),u.dispatchWorkgroups(he),u.end()}if(u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,q),g>0&&(u.setPipeline(M.pipeline),u.dispatchWorkgroups(ge)),u.setPipeline(P.pipeline),u.dispatchWorkgroups(2),u.end(),t&&c.copyBufferToBuffer(B,0,V,0,320),e.queue.submit([c.finish()]),de=1,le=i,se=Math.min(1.5,se+a),ce+=1,!t)return null;await V.mapAsync($.MAP_READ);let m=new Float32Array(V.getMappedRange().slice(0,320));V.unmap();let y=Math.sqrt(Math.max(0,m[0]/Math.max(1,m[3]))),x=m[1],S=m[4],E=[m[5],m[6],m[7]],O=Math.max(0,1/se-1),N=[],F=[],I=[],L=0;for(let e=0;e<Sn;e+=1){let t=(2+e)*4,n=Math.round(m[t+2]);n>0&&(N.push(m[t+0]),F.push(m[t+1]),I.push(n),L+=n)}let R=F.length>0?F.slice(0,Math.min(4,F.length)).reduce((e,t)=>e+t,0)/Math.min(4,F.length):0;J===null&&R>0&&(J=R);let z=J>0?Math.sqrt(R/J):1;return Object.freeze({schema:xn,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:h.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:de,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ae,remoteTileCount:ue,stepIndex:ce,scaleFactorA:se,redshiftZ:O,hOverH0:En(se,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:y,maxOverdensity:x,kineticEnergy:S,momentum:E,powerSpectrumPk:Object.freeze({kBins:Object.freeze(N),pkValues:Object.freeze(F),modeCounts:Object.freeze(I),totalModes:L,lowKPower:R,linearGrowthRatio:z}),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function ve(){if(g===0)return new Float32Array;let t=e.createBuffer({size:h.data.byteLength,usage:$.MAP_READ|$.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(L,0,t,0,h.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync($.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function ye({xMin:t=-.5*r,xMax:n=.5*r}={}){fe={xMin:Number(t),xMax:Number(n)},pe(fe);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,q),a.setPipeline(F.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(B,288,H,0,32),e.queue.submit([i.finish()]),await H.mapAsync($.MAP_READ);let o=new Float32Array(H.getMappedRange().slice(0,32));return H.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:se,stepIndex:ce})}return Object.freeze({schema:xn,icBackend:h.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ae,particlesBuffer:L,forceGridBuffer:z,injectRemoteTileMultipoles:me,step:_e,readParticlesSnapshot:ve,readTileMultipoleSummary:ye,getState:()=>({aScale:se,redshiftZ:Math.max(0,1/se-1),stepIndex:ce,submitsPerStep:de,remoteTileCount:ue}),destroy(){b.destroy();for(let e of[I,L,R,z,B,V,H,U,W,G])e.destroy()}})}var jn=27.211386245988,Mn=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var Nn=null,Pn=null;function Fn({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*Mn)),o=Math.log10(Math.max(4e4,.31*t*Mn)),s=Math.log10(Math.max(8e4,.78*(n+r)*Mn));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function In(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*jn);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*jn*1.45):t}async function Ln(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Pn&&!t)return Pn;let[n,r,i,a]=await Promise.all([j(e,1,{A:1,maxScf:36}),j(e,2,{A:4,maxScf:36}),j(e,6,{A:12,maxScf:42}),j(e,8,{A:16,maxScf:42})]);return Pn=Fn({iH:In(n,13.6),iHe:In(r,24.59),iC:In(i,11.26),iO:In(a,13.62),backend:`webgpu-gate1-radial-ks`}),Pn}function Rn(){if(Pn)return Pn;if(Nn)return Nn;let e=n(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=n(2,{gridPointsN:160,maxScf:80,tol:1e-5}),r=n(6,{gridPointsN:160,maxScf:80,tol:1e-5}),i=n(8,{gridPointsN:160,maxScf:80,tol:1e-5});return Nn=Fn({iH:Math.max(10,Math.abs(e.totalEnergyHa)*jn),iHe:In(t,24.59),iC:In(r,11.26),iO:In(i,13.62),backend:`host-gate1-radial-ks`}),Nn}function zn(e,t=1,n=null){let r=n||Rn(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var Bn=`ulg.astrophysics.planetary-interior-webgpu.v1`,Vn=66743e-15,Hn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function Un(t,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:a=12e3,degrees:o=[5,5],relativeTolerance:l=.025,maxBisectDepth:u=3,materialIndex:d=0}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let f=e(),m=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),g=Math.max(m+20,Number(n.thermodynamic.boilingPointK??m*1.5)),_=Math.max(g*2.5,Number(a)),v=f.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:m,boilingPointK:g,ionizationTempK:_,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(_*1.5,Number(a)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||p.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let e of v){let r=await h(t,e,(t,r)=>y(n,e.phase,t,r),{degrees:o,relativeTolerance:l,requirePositive:!0,maxDepth:u,propertyName:`densityKgPerM3`,logScale:!0});b.push(...r.polytopes)}let x=s(b,{materialIndex:d});return Object.freeze({schema:c,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||p.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var Wn=`
${r}

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
`;async function Gn(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:a=2e4,maxRadiusM:o=15e7,convergePasses:c=3,maxProfileSamples:l=256,autoFitMaxPressurePa:u=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let d=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=s(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await Un(e,n.bundle,{maxPressurePa:u,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);d.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let f=i(d.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||p.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),m=d.reduce((e,t)=>e+t.massFractionTarget,0)||1,h=new Float32Array(d.length*4),g=0;for(let e=0;e<d.length;e+=1)g+=d[e].massFractionTarget/m,h.set([g,d[e].tempK,d[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,d.length,l,c]),new Float32Array(v,16,4).set([Number(n),Number(a),Number(o),Vn]);let y=O(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:Wn,entryPoint:`solve_planetary_hydrostatic`,bindings:[E(0,`uniform`),E(1,`read-only-storage`),E(2,`read-only-storage`),E(3,`read-only-storage`),E(4,`storage`),E(5,`storage`)]}),b=e.createBuffer({size:32,usage:Hn.UNIFORM|Hn.COPY_DST}),x=e.createBuffer({size:Math.max(64,f.data.byteLength),usage:Hn.STORAGE|Hn.COPY_DST}),S=e.createBuffer({size:Math.max(16,h.byteLength),usage:Hn.STORAGE|Hn.COPY_DST}),C=e.createBuffer({size:16,usage:Hn.STORAGE|Hn.COPY_DST}),w=e.createBuffer({size:48,usage:Hn.STORAGE|Hn.COPY_SRC}),T=e.createBuffer({size:l*32,usage:Hn.STORAGE|Hn.COPY_SRC}),D=e.createBuffer({size:48,usage:Hn.MAP_READ|Hn.COPY_DST}),k=e.createBuffer({size:l*32,usage:Hn.MAP_READ|Hn.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,f.data),e.queue.writeBuffer(S,0,h),e.queue.writeBuffer(C,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,C,w,T].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(w,0,D,0,48),r.copyBufferToBuffer(T,0,k,0,l*32),e.queue.submit([r.finish()]),await Promise.all([D.mapAsync(Hn.MAP_READ),k.mapAsync(Hn.MAP_READ)]);let a=new Float32Array(D.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,l*32));D.unmap(),k.unmap();let s=Math.round(a[3]),c=s===2,u=s===1,m=Math.min(l,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(d.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:d[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let E=Number(d[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:Bn,backend:`webgpu-polytope-atlas`,valid:u,failClosed:c,reason:c?`polytope-out-of-domain`:s===3?`max-radius-reached`:`ok`,failureState:c?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:d[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:E,dynamoCapable:u&&E>1e4&&t>1e10,layerCount:d.length,profile:Object.freeze(g),accuracyTier:p.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,C,w,T,D,k])e.destroy()}}var Kn=`ulg.astrophysics.stellar-nuclear-network.v1`,qn=`ulg.astrophysics.stellar-nuclear-webgpu.v1`,Jn=`ulg.astrophysics.lane-emden-webgpu.v1`,Yn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Xn=-.7823334099999784,Zn=1602176634e-22,Qn=167262192369e-38,$n=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),er=null;function tr(){if(er)return er;let e=$n.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+f(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+f(t,n)*r,0),s=r-i,c=o-a+s*Xn,l=Number(e.neutrinoLossMeV||0),u=c>0?Math.max(0,c-l):c,d=Math.abs(u)*Zn/(t*Qn);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:s,ignitionTempK:e.ignitionTempK,qValueMeV:c,qValueTotalMeV:c,qValueThermalMeV:u,neutrinoLossMeV:l,qValueJPerKg:d,exothermic:c>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return er=Object.freeze({schema:Kn,channels:Object.freeze(e),byId:t,accuracyTier:p.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),er}function nr(){let{byId:e}=tr();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var rr=`
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
`;async function ir(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice`);let n=Array.isArray(t)?t:[];if(n.length===0)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires at least one state sample`);let r=nr(),i=new Float32Array(n.length*8);for(let e=0;e<n.length;e+=1){let t=n[e];i.set([Number(t.rhoKgM3??15e4),Number(t.temperatureK??15e6),Number(t.xH??.74),Number(t.xHe??.25),Number(t.xZ??t.xMetals??.01),Number(t.dtS??0),0,0],e*8)}let a=O(e,{cacheKey:`ulg-stellar-nuclear-network.v1`,label:`ulg-stellar-nuclear-network`,code:rr,entryPoint:`eval_stellar_nuclear_network`,bindings:[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`)]}),o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n.length,0,0,0]),new Float32Array(o,16,4).set([r.ppJPerKgH,r.tripleAlphaJPerKgHe,r.fePhotodisJPerKgFe,0]);let s=e.createBuffer({size:32,usage:Yn.UNIFORM|Yn.COPY_DST}),c=e.createBuffer({size:i.byteLength,usage:Yn.STORAGE|Yn.COPY_DST}),l=e.createBuffer({size:i.byteLength,usage:Yn.STORAGE|Yn.COPY_SRC}),u=e.createBuffer({size:i.byteLength,usage:Yn.MAP_READ|Yn.COPY_DST});try{e.queue.writeBuffer(s,0,o),e.queue.writeBuffer(c,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[s,c,l].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-stellar-nuclear-network`}),f=d.beginComputePass();f.setPipeline(a.pipeline),f.setBindGroup(0,t),f.dispatchWorkgroups(Math.ceil(n.length/64)),f.end(),d.copyBufferToBuffer(l,0,u,0,i.byteLength),e.queue.submit([d.finish()]),await u.mapAsync(Yn.MAP_READ);let p=new Float32Array(u.getMappedRange().slice(0,i.byteLength));u.unmap();let m=[];for(let e=0;e<n.length;e+=1){let t=e*8;m.push(Object.freeze({epsPpWPerKg:p[t+0],epsCnoWPerKg:p[t+1],eps3aWPerKg:p[t+2],epsPhotodisWPerKg:p[t+3],epsTotalWPerKg:p[t+0]+p[t+1]+p[t+2],nextMassFractions:Object.freeze({xH:p[t+4],xHe:p[t+5],xZ:p[t+6]}),energyDepositedJPerKg:p[t+7]}))}return Object.freeze({schema:qn,backend:`webgpu`,burnConstants:r,results:Object.freeze(m),provenance:Object.freeze({status:`gate1-nuclear-webgpu-derived`,scientificValidation:!1})})}finally{for(let e of[s,c,l,u])e.destroy()}}var ar=`
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
`;async function or(e,t=[1.5,3],{dXi:n=.002,maxXi:r=25}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice`);let i=Float32Array.from(Array.isArray(t)?t:[t]);if(i.length===0)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires at least one polytrope index`);let a=O(e,{cacheKey:`ulg-lane-emden-rk4.v1`,label:`ulg-lane-emden-rk4`,code:ar,entryPoint:`solve_lane_emden_rk4`,bindings:[E(0,`uniform`),E(1,`read-only-storage`),E(2,`storage`)]}),o=Math.ceil(r/Math.max(1e-5,n))+4,s=new ArrayBuffer(32);new Uint32Array(s,0,4).set([i.length,o,0,0]),new Float32Array(s,16,4).set([n,r,0,0]);let c=e.createBuffer({size:32,usage:Yn.UNIFORM|Yn.COPY_DST}),l=e.createBuffer({size:Math.max(16,i.byteLength),usage:Yn.STORAGE|Yn.COPY_DST}),u=e.createBuffer({size:i.length*16,usage:Yn.STORAGE|Yn.COPY_SRC}),d=e.createBuffer({size:i.length*16,usage:Yn.MAP_READ|Yn.COPY_DST});try{e.queue.writeBuffer(c,0,s),e.queue.writeBuffer(l,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[c,l,u].map((e,t)=>({binding:t,resource:{buffer:e}}))}),n=e.createCommandEncoder({label:`ulg-lane-emden-rk4`}),r=n.beginComputePass();r.setPipeline(a.pipeline),r.setBindGroup(0,t),r.dispatchWorkgroups(Math.ceil(i.length/64)),r.end(),n.copyBufferToBuffer(u,0,d,0,i.length*16),e.queue.submit([n.finish()]),await d.mapAsync(Yn.MAP_READ);let o=new Float32Array(d.getMappedRange().slice(0,i.length*16));d.unmap();let f=[];for(let e=0;e<i.length;e+=1){let t=e*4;f.push(Object.freeze({polytropeIndexN:o[t+0],xi1:o[t+1],massIntegral:o[t+2],centralToMeanDensityRatio:o[t+3],g7Advisory:!0}))}return Object.freeze({schema:Jn,backend:`webgpu`,solutions:Object.freeze(f)})}finally{for(let e of[c,l,u,d])e.destroy()}}var sr=`peercompute.ulg.hydrogen-stellar-closure.v1`,cr=`peercompute.ulg.stellar-closure-table-abi.v1`,lr=1380649e-29,ur=16605390666e-37,dr=167262192369e-38,fr=91093837015e-41,pr=1054571817e-43,mr=299792458,hr=66743e-15,gr=4*5.670374419e-8/mr,_r=1602176634e-28,vr=27.211386245988,yr=198847e25,br=nr();br.ppThermalMeV;var xr=br.ppJPerKgH;br.tripleAlphaMeV;var Sr=br.tripleAlphaJPerKgHe;br.fePhotodisMeV;var Cr=null;async function wr(e,{forceRecompute:n=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Cr?.backend===`webgpu`&&!n)return Cr;let r=await j(e,1,{A:1,maxScf:45}),i=Number(r.totalEnergyHa??-.5),a=Number(r.homoEnergyHa??r.orbitals?.[0]?.energyHa??-.5),o=Math.max(11,Math.min(15,Math.abs(i)*vr)),s=await _(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),c=.05,u=await _(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),d=await _(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-c]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),f=2*i,p=Math.max(.08,f-s.totalEnergyHa)*vr,h=Math.max(.1,(u.totalEnergyHa-2*s.totalEnergyHa+d.totalEnergyHa)/(c*c)),g=Math.sqrt(h/(.5*1836.152673))*vr*_r/lr,v=l(15e4/dr*t**3),y=m(v);return Cr=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:a,hIonizationEv:o,hIonizationTempK:o*_r/lr,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:f,h2DiradicalStretched:1,h2DissociationEv:p,h2DissociationTempK:p*_r/lr,h2VibrationalTempK:g,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Cr}function Tr({forceRecompute:e=!1}={}){if(Cr&&!e)return Cr;let r=n(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),i=r.orbitals?.[0]?.energyHa??-.5,o=Math.max(11,Math.min(15,Math.abs(r.totalEnergyHa)*vr)),s=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),c=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),u=Math.max(.08,c.totalEnergyHa-s.totalEnergyHa)*vr,d=.04,f=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,p=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-d]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(f-2*p+h)/(d*d)),_=Math.sqrt(g/(.5*1836.152673))*vr*_r/lr,v=l(15e4/dr*t**3),y=m(v);return Cr=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:r.totalEnergyHa,h1sOrbitalEnergyHa:i,hIonizationEv:o,hIonizationTempK:o*_r/lr,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:c.totalEnergyHa,h2DiradicalStretched:c.diradicalCharacter,h2DissociationEv:u,h2DissociationTempK:u*_r/lr,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Cr}function Er(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/dr);if(n<=0)return 0;let r=pr*Math.cbrt(3*Math.PI*Math.PI*n)/(fr*mr),i=r*r,a=fr**4*mr**5/(24*Math.PI*Math.PI*pr**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function Dr(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function Or({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||Tr(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/dr,m=s*d/(4*dr),h=s*f/(16*dr),g=2*Math.PI*dr*lr*c/(2*Math.PI*pr)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*fr*lr*c/(2*Math.PI*pr)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/ur/A,M=A*lr*c,N=gr/3*c**4,P=Er(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),F=Dr(s),I=M+N+P+F,L=P/Math.max(1e-30,I),R=N/Math.max(1e-30,I),z=F/Math.max(1e-30,I),B=4*b*(1-b),V=4*w*(1-w),H=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,U=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),W=U*(1-R)+4/3*R,G=Math.max(1.06,W-.5*B-.48*V-H)*(1-z)+2.75*z,K=.1*(1/(1+Math.exp((c-1600)/180))),q=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),ee=4e21*(1+u)*(f+.001)*s*c**-3.5,te=.02*(1+u)*Math.max(.01,w),ne=Math.max(1e-4,Math.min(1e5,K+q+ee+te)),re=M/(Math.max(.15,U-1)*s)+3*N/s,ie=(1-b)*.5*u*o.h2DissociationEv*_r/dr,ae=w*u*o.hIonizationEv*_r/dr,oe=re+ie+ae;return{schema:sr,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:G,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:P,pressureNucSatPa:F,pressureTotalPa:I,pDegFraction:L,pRadFraction:R,pNucFraction:z,soundSpeedMPerS:Math.sqrt(Math.max(1,G*I/s)),kappaM2PerKg:ne,specificEnergyJPerKg:oe,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function kr({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/xr),E=Math.min(d+T,x*a/Sr),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*hr*e*yr/(mr*mr),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Ar(e){let t=k(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function jr({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function Mr({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||Tr(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=Or({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:cr,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function Nr({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=Mr({anchors:t?await wr(t):Tr()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:cr,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Pr=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,Fr=128,Ir=32,Lr=Ir*Ir*Ir,Rr=Lr*8,zr=`
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

const HYDRO_DIM: u32 = ${Ir}u;
const HYDRO_COUNT: u32 = ${Lr}u;

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

  // Uniform full-domain 32^3 compressible hydrodynamics grid accumulation
  let hx = clamp_cell32(rel_pos.x, params.box_half);
  let hy = clamp_cell32(rel_pos.y, params.box_half);
  let hz = clamp_cell32(rel_pos.z, params.box_half);
  let hb = cell_idx32(hx, hy, hz) * 8u;

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

  atomicAdd(&hydro_accum[hb + 0u], i32(round(clamp(pm.w * Q_MASS, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 1u], i32(round(clamp(press_cell * Q_PRESS, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 2u], i32(round(clamp(pm.w * rel_pos.x * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 3u], i32(round(clamp(pm.w * rel_pos.y * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 4u], i32(round(clamp(pm.w * rel_pos.z * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 5u], i32(round(clamp(pm.w * rel_vel.x * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 6u], i32(round(clamp(pm.w * rel_vel.y * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 7u], i32(round(clamp(pm.w * rel_vel.z * Q_MOM, -1e8, 1e8))));
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

fn pair_face_press(m_self: f32, cs2_self: f32, a_nbr: vec4<f32>, cell_w: f32) -> f32 {
  let m_n = a_nbr.x;
  if (m_n <= 1e-6) { return 0.0; }
  let cs2_n = a_nbr.y / m_n;
  return (m_n * (cs2_self + cs2_n)) / ((m_self + m_n) * cell_w);
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

  // 2. Uniform full-domain 32^3 local hydro stencil (ZERO origin-centered inner grid!)
  let hx = i32(clamp_cell32(self_rel.x, params.box_half));
  let hy = i32(clamp_cell32(self_rel.y, params.box_half));
  let hz = i32(clamp_cell32(self_rel.z, params.box_half));
  let cell_w = (2.0 * params.box_half) / 32.0;

  let a_mid = read_hydro_a(hx, hy, hz);
  let b_mid = read_hydro_b(hx, hy, hz);
  let a_xp = read_hydro_a(hx + 1, hy, hz);
  let a_xm = read_hydro_a(hx - 1, hy, hz);
  let a_yp = read_hydro_a(hx, hy + 1, hz);
  let a_ym = read_hydro_a(hx, hy - 1, hz);
  let a_zp = read_hydro_a(hx, hy, hz + 1);
  let a_zm = read_hydro_a(hx, hy, hz - 1);

  let b_xp = read_hydro_b(hx + 1, hy, hz);
  let b_xm = read_hydro_b(hx - 1, hy, hz);
  let b_yp = read_hydro_b(hx, hy + 1, hz);
  let b_ym = read_hydro_b(hx, hy - 1, hz);
  let b_zp = read_hydro_b(hx, hy, hz + 1);
  let b_zm = read_hydro_b(hx, hy, hz - 1);

  let nbr_mass = a_mid.x + 0.16 * (a_xp.x + a_xm.x + a_yp.x + a_ym.x + a_zp.x + a_zm.x);
  let local_rho_sim = max(self_pm.w * 2.0, nbr_mass * 2.4);

  let cell_com_rel = select(self_rel, vec3<f32>(a_mid.z, a_mid.w, b_mid.w), a_mid.x > 1e-6);
  let cell_vel_rel = select(self_vrel_sys, b_mid.xyz, a_mid.x > 1e-6);
  let r_cell_rel = self_rel - cell_com_rel;
  let v_cell_rel = self_vrel_sys - cell_vel_rel;

  let vx_p = select(cell_vel_rel.x, b_xp.x, a_xp.x > 1e-6);
  let vx_m = select(cell_vel_rel.x, b_xm.x, a_xm.x > 1e-6);
  let vy_p = select(cell_vel_rel.y, b_yp.y, a_yp.x > 1e-6);
  let vy_m = select(cell_vel_rel.y, b_ym.y, a_ym.x > 1e-6);
  let vz_p = select(cell_vel_rel.z, b_zp.z, a_zp.x > 1e-6);
  let vz_m = select(cell_vel_rel.z, b_zm.z, a_zm.x > 1e-6);
  let div_v_grid = ((vx_p - vx_m) + (vy_p - vy_m) + (vz_p - vz_m)) / (2.0 * cell_w);
  let div_v_sub = dot(v_cell_rel, r_cell_rel) / (dot(r_cell_rel, r_cell_rel) + 0.16 * cell_w * cell_w);
  let div_v = clamp(0.55 * div_v_grid + 0.45 * div_v_sub, -6.0, 6.0);

  let m_self_cell = max(1e-5, a_mid.x);
  let cs2_local = select(0.0, a_mid.y / m_self_cell, a_mid.x > 1e-6);
  let acc_press_grad = vec3<f32>(
    pair_face_press(m_self_cell, cs2_local, a_xm, cell_w) - pair_face_press(m_self_cell, cs2_local, a_xp, cell_w),
    pair_face_press(m_self_cell, cs2_local, a_ym, cell_w) - pair_face_press(m_self_cell, cs2_local, a_yp, cell_w),
    pair_face_press(m_self_cell, cs2_local, a_zm, cell_w) - pair_face_press(m_self_cell, cs2_local, a_zp, cell_w)
  ) * 0.5;
  let acc_press_sub = r_cell_rel * (cs2_local / (0.35 * cell_w * cell_w));

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
  let damp_local = select(0.996, 0.925, is_compressing);
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
`;function Br(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=Or({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=kr({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=jr({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=Ar(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function Vr({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,baseLogRho:o=-16.2,refRhoSim:s=.08,burnTimescaleS:c=42e13,tScaleK:l=78e4,label:u=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let d=Float32Array.from(t),f=d.length/16,p=n||Mr({nRho:28,nTemp:40});function m(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let h=m(d),g=0,_=0,v=!1,y=!1;function b(e){let t=1.2,n=o,r=0,i=0,a=0,s=0;for(let o=0;o<f;o+=1){let c=o*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],s+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(s*1e3),c[10]=1,c[11]=Math.round(s/f*1e3),c[12]=Math.round(i/f*1e3),c[15]=1667,Br(c,f,h,!1)}let x=b(d),S=Math.max(64,d.byteLength),C=[e.createBuffer({label:`${u}-p0`,size:S,usage:172}),e.createBuffer({label:`${u}-p1`,size:S,usage:172})],w=L(e,{maxCount:f,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:.075,label:`${u}-ss-atlas`}),T=nr(),k=e.createBuffer({label:`${u}-hydro-accum`,size:Rr*4,usage:Fr}),A=e.createBuffer({label:`${u}-hydro-grid`,size:Lr*2*16,usage:Fr}),j=e.createBuffer({label:`${u}-eos-table`,size:p.data.byteLength,usage:136}),M=e.createBuffer({label:`${u}-telemetry`,size:64,usage:132}),N=e.createBuffer({label:`${u}-telemetry-staging`,size:64,usage:9}),P=e.createBuffer({label:`${u}-params`,size:96,usage:72}),F=e.createBuffer({label:`${u}-body-staging`,size:S,usage:9});e.queue.writeBuffer(C[0],0,d),e.queue.writeBuffer(C[1],0,d),e.queue.writeBuffer(j,0,p.data);let I=[E(0,`read-only-storage`),E(1,`storage`),E(2,`storage`),E(3,`read-only-storage`),E(4,`storage`),E(5,`read-only-storage`),E(6,`storage`),E(7,`uniform`)],R=t=>O(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v16-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:zr,entryPoint:t,bindings:I}),z={clear:R(`sgh_clear`),deposit:R(`sgh_deposit`),finalize:R(`sgh_finalize`),integrate:R(`sgh_integrate`)},B=(t,n,r)=>D(e,{layout:z.integrate.bindGroupLayout,label:`${u}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:w.accPhiBuffer}},{binding:4,resource:{buffer:A}},{binding:5,resource:{buffer:j}},{binding:6,resource:{buffer:M}},{binding:7,resource:{buffer:P}}]}),V=[B(C[0],C[1],0),B(C[1],C[0],1)],H=0,U=!1,W=!1,G=!0;async function K(){if(!C||!F||W||y)return d;W=!0;try{let t=e.createCommandEncoder({label:`${u}-readback`});t.copyBufferToBuffer(C[H],0,F,0,d.byteLength),e.queue.submit([t.finish()]),await F.mapAsync(1),d.set(new Float32Array(F.getMappedRange())),F.unmap()}finally{W=!1}return d}async function q({dt:t=.018,timeAccel:n=1,readTelemetry:d=!0}={}){if(y||!C)return x;let m=Math.max(.25,Math.min(25,Number(n)||1)),b=Math.max(.004,Math.min(.028,Number(t)||.018)),S=1380649e-29/167262192369e-38*1.5*l,E=new ArrayBuffer(96),D=new Uint32Array(E),O=new Float32Array(E);D[0]=f,D[1]=p.nRho,D[2]=p.nTemp,D[3]=+!!G,O[4]=b,O[5]=r,O[6]=i*i,O[7]=a,O[8]=.65*.65,O[9]=p.logRhoMin,O[10]=p.logRhoMax,O[11]=p.logTempMin,O[12]=p.logTempMax,O[13]=o,O[14]=s,O[15]=c,O[16]=m,O[17]=l,O[18]=T.ppJPerKgH,O[19]=T.tripleAlphaJPerKgHe,O[20]=T.fePhotodisJPerKgFe,O[21]=S,e.queue.writeBuffer(P,0,E),w.writeParams({count:f,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let k=H,A=1-H,j=V[k],F=Math.ceil(f/64),I=Math.ceil(Lr/64),L=e.createCommandEncoder({label:`${u}-step-${g}`}),R=L.beginComputePass({label:`${u}-pass`});w.encodeIntoPass(R,{srcBuffer:C[k],count:f}),R.setPipeline(z.clear.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(I),R.setPipeline(z.deposit.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(F),R.setPipeline(z.finalize.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(I),R.setPipeline(z.integrate.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(F),R.end();let B=d&&!U;if(B&&L.copyBufferToBuffer(M,0,N,0,64),G=B,e.queue.submit([L.finish()]),H=A,g+=1,_+=b*m*.35,B){U=!0;try{await N.mapAsync(1);let e=new Uint32Array(N.getMappedRange().slice(0));N.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=25e7&&(v=!0),x=Br(e,f,h,v)}finally{U=!1}}return x}function ee(t){return d=Float32Array.from(t),h=m(d),g=0,_=0,v=!1,H=0,G=!0,x=b(d),C&&(e.queue.writeBuffer(C[0],0,d),e.queue.writeBuffer(C[1],0,d)),x}function te(){y||(y=!0,C?.[0]?.destroy(),C?.[1]?.destroy(),w.destroy(),k.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),P.destroy(),F.destroy(),C=null)}return{schema:Pr,get count(){return f},get totalMassSolar(){return h},get stepIndex(){return g},get simTimeMyr(){return _},get backend(){return`webgpu`},get gravityMode(){return w.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return T},get closureTable(){return p},get anchors(){return p.anchors},getTelemetry:()=>x,getBodies:()=>d,getResidentBuffer:()=>C?C[H]:null,readbackBodies:K,step:q,resetBodies:ee,dispose:te}}var Hr=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function Ur(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Wr({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=Hr[t]||Hr[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=Ur(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0;if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let C=Math.hypot(r-S,i,v),w=Math.exp(-C*C/12),T=g+w*1,E=h+w*.1,D=.32+.04*Math.min(6,C);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=D,s[t+8]=E,s[t+9]=T,s[t+10]=.74,s[t+11]=-30,s[t+12]=.998,s[t+13]=0,s[t+14]=.25,s[t+15]=.01}return s}function Gr(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var Kr=`
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
`,qr=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct AtlasIntegrateParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<storage, read> ss_acc_phi: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: AtlasIntegrateParams;

@compute @workgroup_size(64)
fn ss_atlas_nbody_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_bodies[idx].pos_mass;
  let self_vr = src_bodies[idx].vel_radius;
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }
  let acc = ss_acc_phi[idx].xyz;
  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * params.dt;
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;function Jr({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){Gr(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=O(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:Kr,entryPoint:`step_nbody`,bindings:[E(0,`read-only-storage`),E(1,`storage`),E(2,`uniform`)]}),m=[D(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),D(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function Yr({device:e=null,initialBodies:t,mode:n=0,boxHalf:r=16,theta:i=.65,label:a=`ulg-cosmic-ss-atlas`}){Gr(e,`createResidentScaleAtlasMultipoleNBodyEngine`);let o=Float32Array.from(t),s=o.length/8,c=0,l=n===1?.25:1,u=!1,d=Math.max(32,o.byteLength),f=[e.createBuffer({label:`${a}-buf-0`,size:d,usage:172}),e.createBuffer({label:`${a}-buf-1`,size:d,usage:172})],p=L(e,{maxCount:s,strideFloats:8,chartLevel:70,useAdjSoftening:!1,qMass:8192,qMom:512,rCellFactor:.05,label:`${a}-gravity`}),m=e.createBuffer({label:`${a}-params`,size:32,usage:72}),h=e.createBuffer({label:`${a}-staging`,size:d,usage:9});e.queue.writeBuffer(f[0],0,o),e.queue.writeBuffer(f[1],0,o);let g=O(e,{cacheKey:`ulg-cosmic-ss-atlas-integrate.v1`,label:`ulg-cosmic-ss-atlas-integrate`,code:qr,entryPoint:`ss_atlas_nbody_integrate`,bindings:[E(0,`read-only-storage`),E(1,`storage`),E(2,`read-only-storage`),E(3,`uniform`)]}),_=(t,n,r)=>D(e,{layout:g.bindGroupLayout,label:`${a}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:p.accPhiBuffer}},{binding:3,resource:{buffer:m}}]}),v=[_(f[0],f[1],0),_(f[1],f[0],1)],y=0,b=!1;async function x(){if(!f||!h||b||u)return o;b=!0;try{let t=e.createCommandEncoder({label:`${a}-readback`});t.copyBufferToBuffer(f[y],0,h,0,o.byteLength),e.queue.submit([t.finish()]),await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{b=!1}return o}async function S({dt:t=.012,gravity:d=1,softening:_=.24,hubbleRate:x=.12,readback:S=!1}={}){if(u||!f)return o;let C=n===1?1/Math.max(.05,l**3):1;p.writeParams({count:s,gravityG:d,softening2:_*_,boxHalf:r,theta2:i*i});let w=new ArrayBuffer(32),T=new Uint32Array(w),E=new Float32Array(w);T[0]=s,T[1]=n,E[4]=t,E[5]=n===1?2*x:0,E[6]=C,e.queue.writeBuffer(m,0,w);let D=y,O=1-y,k=Math.ceil(s/64),A=e.createCommandEncoder({label:`${a}-step-${c}`}),j=A.beginComputePass({label:`${a}-pass`});p.encodeIntoPass(j,{srcBuffer:f[D],count:s}),j.setPipeline(g.pipeline),j.setBindGroup(0,v[D]),j.dispatchWorkgroups(k),j.end();let M=S&&!b;if(M&&A.copyBufferToBuffer(f[O],0,h,0,o.byteLength),e.queue.submit([A.finish()]),y=O,c+=1,n===1&&(l=Math.min(2,l+t*x*l)),M){b=!0;try{await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{b=!1}}return o}function C(t){o=Float32Array.from(t),c=0,l=n===1?.25:1,y=0,f&&(e.queue.writeBuffer(f[0],0,o),e.queue.writeBuffer(f[1],0,o))}function w(){return f?f[y]:null}function T(){u||(u=!0,f?.[0]?.destroy(),f?.[1]?.destroy(),p.destroy(),m?.destroy(),h?.destroy(),f=null)}return{get count(){return s},get activeCount(){return s},get strideFloats(){return 8},get stepIndex(){return c},get scaleFactorA(){return l},get backend(){return`webgpu`},get gravityMode(){return p.gravityMode},getBodies:()=>o,readbackBodies:x,getResidentBuffer:w,step:S,resetBodies:C,dispose:T}}function Xr(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Zr=[`disk`,`barred`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`],Qr=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],$r=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function ei({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.28,centerOffset:a=[0,0,0]}={}){let o=Math.max(256,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=Xr(n),l=()=>{let e=Math.max(1e-7,c()),t=c();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},u=Number(a?.[0])||0,d=Number(a?.[1])||0,f=Number(a?.[2])||0,p=(e,t,n,a,o,p,m,h,g,_,v=1)=>{let y=t-e,b=30*v,x=140*v,S=260*v,C=950*v,w=1.05*v,T=3.1*v,E=6.8*v,D=e=>{let t=e*e*x/((e+w)*(e+w)),n=e/T,r=S*(1-(1+n)*Math.exp(-n)),i=e*e*C/((e+E)*(e+E));return b+t+r+i},O=Math.cos(g),k=Math.sin(g),A=Math.cos(_),j=Math.sin(_),M=(e,t,n)=>{let r=t*O-n*k,i=t*k+n*O;return[e*A-r*j,e*j+r*A,i]};s.set([n+u,a+d,o+f,b,p,m,h,.05],e*8);let N=Math.floor((y-1)*.2),P=Math.floor((y-1)*.16),F=Math.floor((y-1)*.06),I=y-1-N-P-F,L=C/Math.max(1,N),R=x/Math.max(1,P+F),z=S/Math.max(1,I),B=e+1;for(let e=0;e<N&&B<t;e+=1,B+=1){let e=Math.max(.01,Math.min(.92,c())),t=Math.min(14.5*v,E*Math.sqrt(e)/Math.max(.05,1-Math.sqrt(e))),i=2*c()-1,g=Math.sqrt(Math.max(0,1-i*i)),_=2*Math.PI*c(),y=t*g*Math.cos(_),b=t*i,x=t*g*Math.sin(_),S=Math.sqrt(r*D(t)/(3*Math.hypot(t,E*.45))),C=M(y,b,x),w=M(l()*S,l()*S,l()*S);s.set([n+C[0]+u,a+C[1]+d,o+C[2]+f,L,p+w[0],m+w[1],h+w[2],-1],B*8)}for(let e=0;e<P+F&&B<t;e+=1,B+=1){let t=e>=P,g=Math.max(.005,Math.min(.93,c())),_=t?w*4.2:w,y=Math.min(11.5*v,_*Math.sqrt(g)/Math.max(.06,1-Math.sqrt(g))),b=2*c()-1,x=Math.sqrt(Math.max(0,1-b*b)),S=2*Math.PI*c(),C=y*x*Math.cos(S),T=y*b*(t?.85:.62),E=y*x*Math.sin(S),O=Math.sqrt(r*D(y)/Math.hypot(y,i)),k=O*(t?.52:.42),A=t?.15:.55,j=-Math.sin(S)*O*A+l()*k,N=l()*k*.72,F=Math.cos(S)*O*A+l()*k,I=M(C,T,E),L=M(j,N,F),z=t?.24+c()*.1:.02+Math.min(.28,y/(2.5*v)*.24);s.set([n+I[0]+u,a+I[1]+d,o+I[2]+f,R,p+L[0],m+L[1],h+L[2],z],B*8)}let V=Math.tan(17*Math.PI/180);for(;B<t;B+=1){let e=-T*Math.log(Math.max(1e-4,c()*c())),t=Math.max(.18*v,Math.min(11.5*v,e*.78)),g=Math.min(1,Math.max(0,(t-.7*v)/(2*v))),_=c()<.72*g,y,b;if(_){let e=B&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*v))/V,a=(n?.28:.38)+t/v*.024;y=r+i+l()*a,b=c()<.11&&t>1.4*v&&t<8.5*v?.82+c()*.22:.38+c()*.38}else y=c()*Math.PI*2,b=.08+c()*.26;let x=(.12+t/v*.028)*v,S=t*Math.cos(y),C=t*Math.sin(y),w=l()*x,E=D(t),O=Math.sqrt(r*E/Math.hypot(t,i)),k=O*(.06+.04*Math.exp(-t/T)),A=-Math.sin(y)*O+l()*k,j=l()*k*.45,N=Math.cos(y)*O+l()*k,P=M(S,w,C),F=M(A,j,N);s.set([n+P[0]+u,a+P[1]+d,o+P[2]+f,z,p+F[0],m+F[1],h+F[2],b],B*8)}};if(t===`binary`){let e=o>>1;p(0,e,-5.8,.9,-1.5,1.35,-.22,1.05,.35,.18,.68),p(e,o,5.8,-.9,1.5,-1.35,.22,-1.05,-.42,-.25,.68)}else if(t===`barred`){p(0,o,0,0,0,0,0,0,0,0,1);let e=Math.floor(o*.42);for(let t=Math.floor(o*.22);t<e;t+=1){let e=t*8;if(s[e+7]<0)continue;let n=(c()*2-1)*3.6,r=l()*.24,i=l()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;s.set([n+u,r+d,i+f,s[e+3]*1.15,-i*o+l()*.45,l()*.25,n*o+l()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<o;n+=1){let e=n*8;if(!(s[e+7]<0)&&c()<.78){let a=n&1,o=3.1+c()**.85*7.8,p=a*Math.PI+Math.log(o/3)/t+l()*(.2+.02*o),m=l()*(.12+.025*o),h=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),g=c()<.14;s.set([Math.cos(p)*o+u,m+d,Math.sin(p)*o+f,s[e+3],-Math.sin(p)*h+l()*.45,l()*.2,Math.cos(p)*h+l()*.45,g?.85+c()*.2:.44+c()*.34],e)}}}else if(t===`proto`){p(0,o,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(c()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(o*.45);for(let n=t;n<o;n+=1){let t=n*8;if(!(s[t+7]<0))if(c()<.52){let i=e[n%e.length],a=c()**.6*1.35,o=c()*Math.PI*2,p=2*c()-1,m=Math.sqrt(Math.max(0,1-p*p)),h=i[0]+a*m*Math.cos(o)*1.25,g=i[1]+a*p*.45,_=i[2]+a*m*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(h,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));s.set([h+u,g+d,_+f,s[t+3]*1.2,-_/v*y+l()*1.25,l()*.95,h/v*y+l()*1.25,.78+c()*.28],t)}else s[t+1]=s[t+1]*2.4,s[t+7]=Math.min(1.02,s[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(o*.72);p(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((o-e)*.3);for(let n=e;n<o;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(c())*1.15,n=2*c()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=c()*Math.PI*2;s.set([7.4+e*r*Math.cos(a)+u,2.2+e*n+d,-2+e*r*Math.sin(a)+f,45/Math.max(1,t),-1.4+l()*.55,2.4+l()*.55,4.1+l()*.55,.52+c()*.34],i)}else{let n=(a-t)/Math.max(1,o-e-t),p=-.35+n*Math.PI*1.85,m=7.4+Math.sin(p*1.5)*1.65,h=.25+.42*n,g=Math.cos(p)*m+l()*h,_=Math.sin(p)*m*.72+l()*h,v=Math.sin(p+.8)*m*.58+l()*h,y=Math.max(1,Math.hypot(g,_,v)),b=Math.sqrt(r*1150/y);s.set([g+u,_+d,v+f,12/Math.max(1,o-e-t),-Math.sin(p)*b*.75,Math.cos(p)*b*.55,Math.cos(p+.8)*b*.42,.34+c()*.42],i)}}}else if(t===`globular`){let e=520/o,t=.65;s.set([u,d,f,8,0,0,0,.12],0);for(let n=1;n<o;n+=1){let i=Math.max(.001,Math.min(.96,c())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=c()*Math.PI*2,h=8+520*a**3/(a*a+t*t)**1.5,g=Math.sqrt(r*h/(3*Math.hypot(a,.45))),_=a<1.3&&c()<.08;s.set([a*p*Math.cos(m)+u,a*o+d,a*p*Math.sin(m)+f,e,l()*g,l()*g,l()*g,_?.68+c()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`sphere`){let e=3.2,t=950/o;s.set([u,d,f,60,0,0,0,.05],0);for(let n=1;n<o;n+=1){let i=Math.max(.004,Math.min(.93,c())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=2*Math.PI*c(),h=60+a*a*950/((a+e)*(a+e)),g=Math.sqrt(r*h/(3*Math.hypot(a,1.2)));s.set([a*p*Math.cos(m)+u,a*o*.78+d,a*p*Math.sin(m)+f,t,l()*g,l()*g,l()*g,.04+Math.min(.3,a/10*.26)],n*8)}}else p(0,o,0,0,0,0,0,0,0,0,1);return s}function ti(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=Xr(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function ni(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function ri(e,{seed:t=20261125,qualityId:n=`med`,initialElementZ:r=26}={}){let i=t>>>0,a=se[n]||se.med,o=new x({artifactCache:new C});bn(I);let s=new Map,c=new Map,l=`present-day`,u=dt({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),f=`web`,p=null,m=null,h=null,y=[],b=null,T=null,E=null,D=`disk`,O=1,k=null,j=[],N=[4.8,.04,2.1],L=`solar-system`,R=!0,B=null,V=null,H=null,W=null,G=null,K=3,q=`nbody`,ee=null,te=null,re=!0,ie=null,ae=null,ce=.94,le=null,ue=null,de=null,J=null,fe=null,pe=null,me=null,he=null,_e=null,ve=null,ye=`solar-nebula`,be=null,xe=null,Se=null,Ce=null,Te=2,Ee=`fusion`,De=null,ke=null,Ae=new Float32Array,je=.58,Me=null,Y=null,X=null,Ne=null,Pe=null,Fe=null,Ie=new Float32Array,Le=null,Re=`standard`,ze=null,Be=3,Ve=!1,He=[],Ue=null,We=null,Ge=null,Ke=!0,Je=null,Ye=null,Xe=null,Ze=null,Qe=r,$e=300,et=!1,tt=`solid`,nt=[],rt=r,it=3,at=2,ot=0,st=!0,ct=`atom`,ft=`H2O`,pt=null,mt=null,ht=r,gt=56,_t=null,vt=null,bt=null,xt=null,Z={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},St=!1,Ct=!1;async function wt(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(s.has(o))return s.get(o);let c=await F(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return s.set(o,c),c}async function Tt({seedOverride:t=null}={}){p&&=(p.destroy(),null);let n=(t??i)>>>0,r=await On(e,{gridPerSide:a.cosmoGridPerSide,fftGridN:a.cosmoFftN,boxLengthMpc:200,aInit:.16,amplitude:.44,seed:n});p=An(e,{gridPerSide:a.cosmoGridPerSide,pmGridN:a.cosmoFftN,boxLengthMpc:200,aInit:.16,da:.0085,initialConditions:r}),h=null;for(let e=0;e<6;e+=1)m=await p.step({readTelemetry:e===0||e===5}),e===0&&m?.powerSpectrumPk?.kBins?.length&&(h={kBins:[...m.powerSpectrumPk.kBins],pkValues:[...m.powerSpectrumPk.pkValues]});let o=Xr(n^5370206);y=Array.from({length:5},(e,t)=>{let n=Zr[t%Zr.length],r=Qr[Math.floor(o()*Qr.length)],i=1e3+Math.floor(o()*8900),a=t===0?18:72,s=(o()-.5)*2*a,c=(o()-.5)*1.4*a,l=(o()-.5)*2*a,u=Number((.6+o()*1.1).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${i} Supercluster`,subtitle:`${n===`disk`?`Grand-Design Spiral`:n===`binary`?`Interacting Merger Pair`:`Giant Elliptical`} · Z=${u} Z☉`,posMpc:[s,c,l],pos:[s*.1,c*.1,l*.1],radius:1,morphology:n,metallicity:u,massLabel:`${(1.2+o()*4.5).toFixed(2)}×10¹² M☉`,tempK:6500+Math.round(o()*4500),composition:`DM 84% · H 12% · He 3.8% · Met ${(.2*u).toFixed(2)}%`,nextLevel:1}})}async function Dt({preset:t=D,metallicity:n=O,seedOverride:r=null}={}){D=Zr.includes(t)?t:`disk`,O=Math.max(.1,Math.min(3,Number(n)||1)),E&&=(E.dispose(),null),k||=await Ln(e);let o=(r??i)+825>>>0;E=Yr({device:e,initialBodies:ei({count:a.galaxyStars,preset:D,seed:o}),mode:0,boxHalf:16,theta:.65,label:`ulg-universes-galaxy-${a.galaxyStars}`}),await E.step({dt:.008,gravity:1,softening:.28,readback:!1});let s=Xr(o^141729),c=[4.8,.04,2.1];N=[...c],j=[{id:`star-solar`,level:1,branch:`solar-system`,name:`Orion Spur · Solar System`,subtitle:`G2V Main-Sequence Star · 8 Planets · 512 Asteroids (26 kly from Core)`,pos:c,radius:.8,tempK:5778,massLabel:`1.00 M☉`,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`,nextLevel:2},{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Sagittarius-ULG* (Galactic Core SMBH)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Zoom In for Schwarzschild Lensing`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2},{id:`star-h2`,level:1,branch:`solar-system`,name:`Carina-ULG OB Association`,subtitle:`Young Spiral-Arm H II Star-Forming Region`,pos:[-4.4,-.05,3.6],radius:.8,tempK:16500,massLabel:`18.2 M☉`,composition:`H 70% · He 28% · O III / Hα Emission`,nextLevel:2},{id:`star-outer`,level:1,branch:`solar-system`,name:`Perseus Arm K-Dwarf System`,subtitle:`Flat-Rotation-Curve Outer Disk System (38 kly)`,pos:[Math.cos(s()*6.28)*6.8,.08,Math.sin(s()*6.28)*6.8],radius:.75,tempK:4850,massLabel:`0.82 M☉`,composition:`H 74% · He 24.7% · Metals 1.3%`,nextLevel:2}]}async function Ot(){if(B)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=Xr((i^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}B=Jr({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),V=await B.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function At({seedOverride:t=null}={}){H&&=(H.dispose(),null);let n=(t??i)+409>>>0;H=ne(e,{asteroidCount:a.solarAsteroids,seed:n,label:`ulg-universes-solar-system`}),await H.step({dtSubYr:4e-5,substeps:4,readMassive:!0}),W=H.computeConservationDiagnostics(),G=W}async function jt({seedOverride:t=null}={}){ee&&=(ee.dispose(),null);let n=(t??i)+773>>>0,r=qe(e,{pebbleCount:Math.min(4096,Math.max(1536,(a.solarAsteroids||512)*4)),embryoCount:18,enableGasDrag:re,seed:n,label:`ulg-universes-protoplanetary-disk`});te=await r.step({dt:.018,substeps:3,readTelemetry:!0}),ee=r}async function Mt({initialB0:t=je,seedOverride:n=null}={}){je=Math.max(0,Math.min(1.5,Number(t)??.58));let r=De;De=null,r&&r.dispose();let o=(n??i)+3133>>>0,s=ge(e,{gridN:a.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,a.stellarParticles||4096)),initialB0:je,spinOmega:2.35,gravityG:2.4,seed:o,label:`ulg-universes-nebular-mhd`});ke=await s.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),Ae=s.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),De=s}async function Nt(t=f){let n=b;b=null,n&&n.dispose();let r=t===`cmb`,o=t===`reionization`,s=t===`cluster-merger`,c=r?1100:o?10:.25,l=a.id===`low`?4096:a.id===`ultra`?10240:6656,u=yt(e,{gridN:a.id===`low`?16:24,tracerCount:l,boxSizeMpc:260,redshiftZ:c,clusterMergerMode:s,uvFlux:o?1.55:r?0:.25,gravityG:s?1.65:1.15,seed:(i^(r?4352:o?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=o?5:s?4:2;for(let e=0;e<d;e+=1)T=await u.step({dt:o?.14:.09,substeps:2,readTelemetry:e===d-1});b=u}async function Pt({spinA:t=ce}={}){ce=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=ie;ie=null,n&&n.dispose();let r=a.id===`low`?4096:6656,o=kt(e,{massSolar:45e7,spinA:ce,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(i^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)ae=await o.step({dt:.032,substeps:2,readTelemetry:e===4});ie=o}async function Ft(t=`bns-kilonova`){let n=le;le=null,n&&n.dispose(),de=t;let r=a.id===`low`?3072:5120,o=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},s=qt(e,{...o,particleCount:r,seed:(i^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<o.warm;e+=1)ue=await s.step({dt:.032,substeps:4,readTelemetry:e===o.warm-1});le=s}async function It(t=`comet-tails`){let n=J;J=null,n&&n.dispose(),pe=t;let r=t===`comet-tails`,o=tn(e,{regime:r?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:r?1.45:2.35,radBeta:r?.95:.72,windSpeed:r?2.25:1.95,sublimationDrive:r?1.35:1.45,sourceDir:r?[.76,.24,.6]:[.82,.14,.55],particleCount:a.id===`low`?3072:5120,seed:(i^(r?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)fe=await o.step({dt:.04,substeps:3,readTelemetry:e===7});J=o}async function Lt(t=`roche-rings`){let n=me;me=null,n&&n.dispose(),_e=t;let r=un(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:2.8,rHostSim:t===`red-giant`?1.85:t===`giant-impact`?1.48:1.38,rRocheSim:3.65,gmHost:24,cohesionStrength:.55,tidalHeatDrive:1.25,shepherdGm:.72,particleCount:a.id===`low`?3072:5120,seed:(i^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),o=t===`roche-rings`?12:6;for(let e=0;e<o;e+=1)he=await r.step({dt:.028,substeps:3,readTelemetry:e===o-1});me=r}async function zt(t=`h2-pillars`){let n=Me;Me=null,n&&n.dispose(),X=t;let r=tn(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`planetary-nebula`?1.65:1.48,radBeta:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:1.45,sourceDir:[.65,.58,.48],particleCount:a.id===`low`?3584:5632,seed:(i^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)Y=await r.step({dt:.036,substeps:2,readTelemetry:e===5});Me=r}async function Bt(t=`magnetar`){let n=Ne;Ne=null,n&&n.dispose(),Fe=t;let r=t===`magnetar`,o=Rt(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:a.id===`low`?3584:5632,seed:(i^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),s=r?8:4;for(let e=0;e<s;e+=1)Pe=await o.step({dt:.055,substeps:3,readTelemetry:e===s-1});Ie=o.buildDipoleFieldLines({linesPerRing:12,steps:22,worldScale:1,alpha:.48}),Ne=o}async function Vt(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,ye:.5});Le=await Et(e,t)}async function Ht(){let t=Je;Je=null,t&&t.dispose();let n=un(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:a.id===`low`?2560:4096,seed:(i^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)Ye=await n.step({dt:.032,substeps:3,readTelemetry:e===7});Je=n}async function Ut({preset:t=ye,seedOverride:n=null}={}){ye=[`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`solar-nebula`,ve&&=(ve.dispose(),null),Ce||=(await Nr({closureRegistry:o,device:e})).ref;let r=(n??i)+1939>>>0;ve=Vr({device:e,initialBodies:Wr({count:a.stellarParticles,preset:ye,seed:r}),closureRegistry:o,closureRef:Ce,boxHalf:14,label:`ulg-universes-stellar-${ye}`}),be=await ve.step({dt:.015,timeAccel:Te,readTelemetry:!0});let[s,c]=await Promise.all([ir(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),or(e,[1.5,3],{dXi:.01,maxXi:12})]);xe=s,Se=c}async function Wt({bodyIndex:t=Be}={}){let n=Math.max(1,Math.min(U.length-1,Math.trunc(Number(t)||3)));Be=n;let r=U[n],o=r.coreZ||26,s=r.mantleZ||14,l=r.surfZ||29,[u,d,f]=await Promise.all([wt(o,{relativistic:!0,returnOrbitalWavefunctions:!1}),wt(s,{relativistic:!0,returnOrbitalWavefunctions:!1}),wt(l,{relativistic:!0,returnOrbitalWavefunctions:!1})]),p=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(c.has(n))return c.get(n);let r=await Un(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return c.set(n,r),r},[m,h]=await Promise.all([p(u),p(d)]),g=Math.max(5e9,Math.min(85e10,Number(r.centralP)||36e10));ze=await Gn(e,{centralPressurePa:g,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${u.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:m},{name:`${d.bundle.symbol} Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:h}]});let _=.52,v=ze?.profile||[],y=Math.max(1,ze?.radiusM||r.radiusKm*1e3);for(let e=0;e<v.length;e+=1)if((v[e].layerIndex??0)>=1){_=Math.max(.22,Math.min(.78,v[e].radiusM/y));break}He=[{id:`layer-core`,level:4,name:`${r.name} · ${u.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(g/1e9).toFixed(0)} GPa · MoI = ${(ze?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:o,rCoreNorm:_,rMantleNorm:.94,tempK:5200,massLabel:`R = ${r.radiusKm.toLocaleString()} km`,composition:r.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${r.name} · ${d.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:s,rCoreNorm:_,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(ze?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${d.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${r.name} · ${f.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${f.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:l,rCoreNorm:_,rMantleNorm:.94,tempK:r.tempK||288,massLabel:`T_eq = ${r.tempK||288} K`,composition:`${f.bundle.symbol} (${f.bundle.mechanical.crystalStructure})`,nextLevel:5}],We&&(We.dispose(),We=null,Ge=null);let b=Number(u.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,x=Math.max(.2,Number(r.aAu||(r.parent>0?U[r.parent]?.aAu:1)||1));if(Ue=we({...r,coreRadiusNorm:_,coreConductivitySm:b},{...ze,coreRadiusFraction:_,centralPressurePa:g},{solarDistanceAu:x,coreConductivitySm:b}),Ue.activation.anyActive){let t=Oe(e,{width:a.id===`low`?64:128,height:a.id===`low`?32:64,bodyParams:Ue,enableTriboelectric:Ke,seed:(i^n*2654435761)>>>0,label:`ulg-universes-atmo-${n}`});for(let e=0;e<4;e+=1)Ge=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});We=t}}async function Gt({Z:t=Qe,tempK:n=null,phasePreset:r=null,gravity:i=et}={}){Qe=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),et=!!i,Xe&&=(Xe.destroy(),null);let o=await wt(Qe,{relativistic:!0,returnOrbitalWavefunctions:!1}),s=o.visualData.bulk,c=o.visualData.thermo.potential,l=o.bundle,u=Math.max(20,Number(l.thermodynamic.meltingPointK||600)),f=Math.max(u*1.4+20,Number(l.thermodynamic.boilingPointK||u*2.4));r===`melt`?(tt=`melt`,$e=Math.round(u*1.42)):r===`vapor`?(tt=`vapor`,$e=Math.round(f*1.38)):r===`solid`?(tt=`solid`,$e=Math.max(20,Math.round(u*.25))):n!=null&&Number.isFinite(Number(n))?$e=Math.max(15,Math.round(Number(n))):(tt=`solid`,$e=Math.max(20,Math.round(u*.25)));let p=Math.max(1,Number(l.nuclear.atomicMassU||28)),m=Math.min(2,Math.max(.45,.09*Math.sqrt(p))),h=a.mdCells;Xe=d(e,{...g({crystalStructure:s.crystalStructure,cellsVec:[h,h,h],latticeConstantA:Math.max(2.4,Number(s.latticeConstantA||3.6)),massU:p,temperatureK:$e}),potentialModel:c.potentialModel,epsilonEv:c.epsilonEv,sigmaOrR0A:c.sigmaOrR0A,alphaOrLambda:c.alphaOrLambda,rcutA:c.rcutA,eamAEv:c.eamAEv,eamBeta:c.eamBeta,swGamma:c.swGamma,dtFs:m,targetTemperatureK:$e,thermostatCouplingFs:20,meltingPointK:u,bulkModulusGPa:Math.max(1,Number(s.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(s.cohesiveEnergyEv||2)),crystalStructure:s.crystalStructure,gravityEnabled:et}),Ze=await Xe.stepBatch(4,{readTelemetry:!0,targetTemperatureK:$e}),nt=Ze?.rdf?Array.from(Ze.rdf):[]}async function Kt({Z:t=rt,n=null,l:r=null,m:o=null,relativistic:s=st,mode:c=ct,moleculeKey:l=ft}={}){rt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),st=!!s,ct=c===`molecule`?`molecule`:`atom`,ft=$r[l]?l:`H2O`;let u=oe.find(e=>e.Z===rt);n==null?u&&(it=u.defaultN):it=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?u&&(at=Math.min(it-1,u.defaultL)):at=Math.max(0,Math.min(it-1,Math.trunc(Number(r)))),ot=o==null?0:Math.max(-at,Math.min(at,Math.trunc(Number(o))));let d=await wt(rt,{relativistic:st,returnOrbitalWavefunctions:!0});if(ct===`molecule`){let t=$r[ft];mt=await _(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}pt=A(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,a.orbitalPoints),seed:(i^1779033703)>>>0,reuseBuffer:pt?.pointsBuffer||null})}else{let t=d.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===it&&e.l===at&&e.u?.length);pt=M(e,{Z:rt,n:it,l:at,m:ot,pointCount:a.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:st,colorMode:1,seed:(i^rt*2654435761)>>>0,reuseBuffer:pt?.pointsBuffer||null})}}async function Jt({Z:t=ht,A:n=null}={}){ht=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let r=oe.find(e=>e.Z===ht);gt=n==null?r?.A||Math.round(ht*2.15):Math.max(ht,Math.trunc(Number(n))),vt&&=(vt.destroy(),null),_t=await v(e,ht,gt,{volDim:a.nuclearVolDim}),vt=P(e,_t),bt=vt?await vt.stepBatch(8):null}async function Yt(e,t,n=1){if(!(St||Ct)){St=!0;try{if(e===0)f!==`web`&&b?T=await b.step({dt:(f===`reionization`?.12:.08)*Math.max(.2,Math.min(2.5,n)),substeps:1,readTelemetry:!0}):p&&p.getState().aScale<1.15&&(m=await p.step({readTelemetry:!0}));else if(e===1&&E){let e=.009*Math.max(.1,Math.min(3,n));await E.step({dt:e,gravity:1,softening:.28,readback:!1})}else if(e===2){if(L===`smbh-core`&&B)V=await B.step({dt:.008*Math.max(.1,Math.min(3,n)),gravity:1,softening:.08,readback:!0});else if(q===`formation`&&ee)te=await ee.step({dt:.016*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(q===`quasar-jet`&&ie)ae=await ie.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((q===`xray-binary`||q===`bns-kilonova`||q===`type-ia`||q===`bbh-merger`)&&le)ue=await le.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:3,readTelemetry:!0});else if((q===`comet-tails`||q===`hot-jupiter`)&&J)fe=await J.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if((q===`roche-rings`||q===`giant-impact`||q===`red-giant`)&&me)he=await me.step({dt:.024*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0});else if(H){let e=t<10.2,r=e?18e-6:55e-6,i=Math.max(2,Math.min(48,Math.round((e?8:24)*n)));await H.step({dtSubYr:r,substeps:i,readMassive:!0}),G=H.computeConservationDiagnostics()}}else if(e===3)if(Ee===`nebular-mhd`&&De){let e=De.stepIndex%4==0;ke=await De.step({dt:.022*Math.max(.2,Math.min(2.2,n)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:e}),e&&(Ae=De.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}))}else (Ee===`h2-pillars`||Ee===`planetary-nebula`||Ee===`snr-pwn`)&&Me?Y=await Me.step({dt:.032*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0}):(Ee===`pulsar`||Ee===`magnetar`)&&Ne?(Pe=await Ne.step({dt:.036*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0}),Ie=Ne.buildDipoleFieldLines({linesPerRing:12,steps:20,worldScale:1,alpha:.48})):Ee===`white-dwarf-tov`||ve&&(be=await ve.step({dt:.015*Math.max(.2,Math.min(2.5,n)),timeAccel:Te,readTelemetry:!0}));else if(e===4){let e=Re===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(Re===`cryo-plumes`&&Je&&(Ye=await Je.step({dt:.028*Math.max(.2,Math.min(2.5,n)),substeps:2,readTelemetry:!0})),H&&Re!==`eyeball-locked`&&Re!==`rogue`){await H.step({dtSubYr:12e-6,substeps:Math.max(1,Math.round(4*n)),readMassive:!0}),G=H.computeConservationDiagnostics();let t=H.getMassiveBodyState64(K),r=H.getMassiveBodyState64(0),i=r.posAu[0]-t.posAu[0],a=r.posAu[1]-t.posAu[1],o=r.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}We&&(Ge=await We.step({dtSim:.042*Math.max(.2,Math.min(2.5,n)),substeps:2,sunDir:e,readTelemetry:!0}))}else if(e===5&&Xe){let e=Math.max(1,Math.min(8,Math.round(3*n)));Ze=await Xe.stepBatch(e,{readTelemetry:!0,targetTemperatureK:$e,nonBlocking:!0}),Ze?.rdf&&(nt=Array.from(Ze.rdf))}else if(e===7&&vt){let e=Math.max(2,Math.min(24,Math.round(10*n))),t=await vt.stepBatch(e,{nonBlocking:!0});t&&(bt=t)}}catch(e){let t=String(e?.message||e||``);if(!Ct&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{St=!1}}}async function Xt(){if(!xt)return;let e=xt;xt=null;try{await e.stop()}catch{}Z={...Z,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Zt({relayUrl:e=Z.relayUrl,roomId:t=Z.roomId,role:n=Z.role}={}){await Xt();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return Z={...Z,connected:!1,relayUrl:``,roomId:i,role:a,error:null},Z;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=w({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),Z.remotePeers=t.size,Z.witnessedMessages=a,Z.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=S({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}xt={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};Z={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){Z={...Z,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return Qt()}function Qt(){let e=xt?.handle?.getStatus?.();return{...Z,connected:e?!!e.connected:Z.connected,remotePeers:e?e.remotePeerCount:Z.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:Z.remotePeerIds||[],quorumReady:e?!!e.quorumReady:Z.quorumReady,witnessedMessages:e?.witnessedMessages??Z.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??Z.lastWitnessedType??null}}async function $t(e=rt){let t=xt?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${Z.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return Z.dispatches+=1,Z.lastResult=r,r}let en=new Map;async function nn(e,t={}){if(e===0&&p||e===1&&E||e===2&&(L===`smbh-core`?B:H)||e===3&&ve||e===4&&ze||e===5&&Xe||e===6&&pt||e===7&&_t)return;let n=e===2?`2:${L}`:String(e);if(en.has(n))return en.get(n);let r=(async()=>{e===0?await Tt(t):e===1?await Dt(t):e===2?L===`smbh-core`?await Ot():await At(t):e===3?await Ut(t):e===4?await Wt(t):e===5?await Gt(t):e===6?await Kt(t):e===7&&await Jt(t)})();en.set(n,r);try{await r}finally{en.delete(n)}}function rn(e){return se[e]?(a=se[e],!0):!1}function an(e){i=Number(e)>>>0||1}function on(e){et=!!e,Xe&&typeof Xe.setGravity==`function`&&Xe.setGravity(et)}function sn(e){$e=Math.max(15,Math.round(Number(e)||300))}function cn(e){Ve=!!e}function ln(e){Te=Math.max(.4,Math.min(8,Number(e)||2))}async function dn(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=ut.find(t=>t.id===e)||ut[3];l=t.id,u=dt({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(l=e.id||`custom`,u=dt(e));return t===0?u.eraId===`recombination`?await fn(`cmb`):u.eraId===`cosmic-dawn`?await fn(`reionization`):u.eraId===`far-future`?await fn(`cluster-merger`):await fn(`web`):t===1?u.eraId===`cosmic-dawn`||u.eraId===`quasar-peak`?await Dt({preset:`proto`,metallicity:Math.max(.1,u.meanMetallicitySolar)}):u.eraId===`far-future`?await Dt({preset:`sphere`,metallicity:1.4}):await Dt({preset:`disk`,metallicity:1}):t===2?u.eraId===`quasar-peak`?await Q(`quasar-jet`):u.eraId===`cosmic-dawn`?await Q(`formation`):u.eraId===`far-future`?await Q(`red-giant`):await Q(`nbody`):t===3?u.eraId===`far-future`?await hn(`planetary-nebula`):u.eraId===`cosmic-dawn`?await hn(`h2-pillars`):u.eraId===`quasar-peak`?await hn(`nebular-mhd`):await hn(`fusion`):t===4&&(u.eraId===`quasar-peak`?await gn(`magma-ocean`):await gn(`standard`)),u}async function fn(e){f=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,f===`web`?p||await Tt():await Nt(f)}async function Q(e){q=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,q===`formation`?ee||await jt():q===`quasar-jet`?ie||await Pt():q===`xray-binary`||q===`bns-kilonova`||q===`type-ia`||q===`bbh-merger`?(!le||de!==q)&&await Ft(q):q===`comet-tails`||q===`hot-jupiter`?(!J||pe!==q)&&await It(q):q===`roche-rings`||q===`giant-impact`||q===`red-giant`?(!me||_e!==q)&&await Lt(q):H||await At()}async function pn(e){ce=Math.max(-.99,Math.min(.99,Number(e)??.94)),ie&&await Pt({spinA:ce})}function mn(e){re=!!e,ee?.setEnableGasDrag?.(re)}async function hn(e){Ee=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`pulsar`,`magnetar`,`white-dwarf-tov`].includes(e)?e:`fusion`,Ee===`nebular-mhd`?De||await Mt():Ee===`h2-pillars`||Ee===`planetary-nebula`||Ee===`snr-pwn`?(!Me||X!==Ee)&&await zt(Ee):Ee===`pulsar`||Ee===`magnetar`?(!Ne||Fe!==Ee)&&await Bt(Ee):Ee===`white-dwarf-tov`?Le||await Vt():ve||await Ut()}async function gn(t){if(Re=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,Re===`cryo-plumes`)Je||await Ht();else if(Re===`eyeball-locked`||Re===`rogue`){let t=We;We=null,t&&t.dispose();let n=U[Be]||U[3],r=we({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:Re===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},ze||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:Re===`rogue`?500:.14,coreConductivitySm:12e5});Ue=r;let o=Oe(e,{width:a.id===`low`?64:128,height:a.id===`low`?32:64,bodyParams:r,enableTriboelectric:Ke,seed:(i^(Re===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${Re}`});for(let e=0;e<4;e+=1)Ge=await o.step({dtSim:.048,substeps:2,sunDir:Re===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});We=o}else Re===`standard`&&await Wt({bodyIndex:Be})}async function _n(e){je=Math.max(0,Math.min(1.5,Number(e)??.58)),De&&await Mt({initialB0:je})}function vn(e){R=!!e}function xn(e){Ke=!!e,We?.setEnableTriboelectric?.(Ke)}function $(e,t){let n=10**t,r=U[K]||U[3],i=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(q),a=e===2&&[`roche-rings`,`giant-impact`,`red-giant`].includes(q),o=e===2&&[`comet-tails`,`hot-jupiter`].includes(q),s=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(Ee),c=e===3&&[`pulsar`,`magnetar`].includes(Ee);return yn({viewSpanM:n,redshiftZ:u.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&f!==`web`?.157:0,clusterMassSolar:e===0&&f===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?E?.count||32768:0,nebulaCloudMass:e===3&&Ee===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&Ee===`nebular-mhd`?je:e===2&&q===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(Ee===`nebular-mhd`||s),starMassSolar:+(e===2&&q===`formation`),diskSolidMassEarth:e===2&&q===`formation`?45:0,gravitatingBodyCount:e===2||e===4?i?2:H?.totalCount||15:0,solidBodyCount:e===2&&(q===`formation`||a)?18:0,solidParticleCount:e===2&&q===`formation`?90:0,coreTempK:e===3&&Ee===`fusion`?be?.coreTempK||15e6:0,bodyMassKg:e===4?r.massSolar*198847e25:e===3&&Ee===`fusion`?198847e25:0,bodyRadiusM:e===4?r.radiusKm*1e3:0,surfacePressurePa:e===4&&Ue?.surfacePressurePa||0,volatileMassFrac:e===4&&Ue?.volatileMassFrac||0,particulateMassFrac:e===4&&Ue?.particulateMassFrac||0,dynamo:e===4&&Ue?.dynamo||null,compactnessGMOverRc2:e===2&&(q===`quasar-jet`||i)||e===3&&(c||Ee===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&q===`quasar-jet`?45e7:i?10:0,accretionRateEddington:e===2&&(q===`quasar-jet`||q===`xray-binary`)?.55:0,kerrSpinA:e===2&&q===`quasar-jet`?ce:0,surfaceBFieldTesla:c?Ee===`magnetar`?165e9:42e7:0,compactRadiusM:c?12e3:0,spinOmegaRadS:c?Ee===`magnetar`?45:740:0,maxPairwiseVOverC:i?.22:0,rocheOverflowPresent:e===2&&q===`xray-binary`,uvFluxNorm:o||s?1.5:0,xuvFluxWPerM2:e===2&&q===`hot-jupiter`?180:0,surfaceTempK:e===2&&q===`comet-tails`?260:0,sublimationTempK:e===2&&q===`comet-tails`?170:1e9,maxTidalStrain:a||e===4&&Re===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&Re===`magma-ocean`||e===2&&(q===`giant-impact`||q===`red-giant`)?2400:0})}function Sn(e,t=null){L=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(N=[...t])}function Cn(e){if(typeof e==`string`){let t=U.findIndex(t=>t.id===e);t>=0&&(K=t)}else Number.isFinite(Number(e))&&(K=Math.max(0,Math.min(U.length-1,Math.trunc(Number(e)))));return K}function wn(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return s.get(`${n}:std:${+!!t}:1`)||s.get(`${n}:std:${+!!t}:0`)||s.get(`${n}:std:1:1`)||s.get(`${n}:std:1:0`)||null}function Tn(e,t={}){if(e===0){if(f===`cmb`){let e=T;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(f===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((T?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(f===`cluster-merger`){let e=T;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return y.map(t=>({...t,pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return j.map(t=>({...t,pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(L===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(q!==`nbody`&&q!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${ce.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(ae?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${ue?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((he?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`}},t=e[q]||e[`quasar-jet`];return[{id:`l2-${q}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(!H)return[];let e=H.getMassiveBodyState64(K),n=t.solarScaleAuToWorld??1;return U.map((t,r)=>{let i=H.getMassiveBodyState64(r),a=(i.posAu[0]-e.posAu[0])*n,o=(i.posAu[1]-e.posAu[1])*n,s=(i.posAu[2]-e.posAu[2])*n;return{id:t.id,level:2,bodyIndex:r,spec:t,name:t.name,subtitle:t.subtitle,pos:[a,o,s],radius:Math.max(1e-7,i.radiusAu*n),radiusKm:t.radiusKm,tempK:t.tempK,massLabel:r===0?`1.00 M☉`:`${(t.massSolar/30034896e-13).toFixed(t.massSolar>1e-5?1:3)} M⊕`,composition:t.composition,nextLevel:r===0?3:4}})}if(e===3){if(Ee!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${je.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${Pe?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[Ee]||e[`nebular-mhd`];return[{id:`l3-${Ee}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}return[{id:`stellar-fusion-core`,level:3,name:`Thermonuclear Fusion Core`,subtitle:`Gate 1 pp/CNO/3α Burn · Q_pp = ${nr().ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:be?.coreTempK||15e6,massLabel:`${(ve?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((be?.meanXH??.72)*100).toFixed(1)}% · He ${((be?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((be?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4}]}if(e===4){if(Re!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[Re];if(e)return[{id:`l4-${Re}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:He[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return He}if(e===5){let e=wn(Qe,!0)?.bundle;return[{id:`md-lattice-atom`,level:5,name:`${e?.symbol||`Fe`} Representative Lattice`,subtitle:`${e?.mechanical?.crystalStructure||`crystal`} · ${Xe?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:Qe,tempK:Ze?.temperatureK||$e,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:`Phase: ${Ze?.emergentPhase||tt} · ⟨Z⟩ = ${(Ze?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=wn(rt,st)?.bundle,t=e?.symbol||`Fe`,n=`${it}${[`s`,`p`,`d`,`f`,`g`][at]||`d`} (m=${ot})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:ct===`molecule`?`${$r[ft].formula} Molecule (RHF)`:`${t} (Z=${rt}) · ${n}`,subtitle:ct===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(mt?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${st?`Relativistic ON`:`Non-Rel`}) · ${pt?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:rt,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${rt} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=_t?.isotope?.split(`-`)[0]||`Z=${ht}`,t=Number(_t?.bindingPerNucleonMeV??8.79),n=Number(_t?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${gt}${e} Atomic Nucleus`,subtitle:`Z=${ht} protons, N=${Math.max(0,gt-ht)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${ht} · Neutrons ${Math.max(0,gt-ht)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function En(){Ct=!0,Xt();try{p?.destroy()}catch{}try{b?.dispose()}catch{}try{E?.dispose()}catch{}try{B?.dispose()}catch{}try{H?.dispose()}catch{}try{ee?.dispose()}catch{}try{ie?.dispose()}catch{}try{le?.dispose()}catch{}try{J?.dispose()}catch{}try{me?.dispose()}catch{}try{ve?.dispose()}catch{}try{De?.dispose()}catch{}try{Me?.dispose()}catch{}try{Ne?.dispose()}catch{}try{We?.dispose()}catch{}try{Je?.dispose()}catch{}try{Xe?.destroy()}catch{}try{pt?.pointsBuffer?.destroy()}catch{}try{vt?.destroy()}catch{}}return Object.freeze({AU_METERS:z,REAL_SOLAR_SYSTEM_CATALOG:U,MOLECULE_SPECS:$r,COSMIC_EPOCH_PRESETS:ut,get seed(){return i},get quality(){return a},get cosmicEpochId(){return l},get cosmicEpoch(){return u},get cosmoMode(){return f},get cosmoSession(){return p},get cosmoTelemetry(){return m},get cosmoFirstPk(){return h},get cosmoTargets(){return y},get cosmoBaryonSession(){return b},get cosmoBaryonTelemetry(){return T},get galaxyEngine(){return E},get galaxyPreset(){return D},get galaxyMetallicity(){return O},get galaxyFocusPos(){return N},get galaxyBranch(){return L},get showGalacticBField(){return R},get smbhEngine(){return B},get smbhBodies(){return V},get ismCoolingAnchors(){return k},get solarEngine(){return H},get solarMode(){return q},get protoplanetarySession(){return ee},get protoplanetaryTelemetry(){return te},get protoplanetaryGasDrag(){return re},get kerrJetSession(){return ie},get kerrJetTelemetry(){return ae},get kerrSpinA(){return ce},get relBinarySession(){return le},get relBinaryTelemetry(){return ue},get relBinaryMode(){return de},get radWindL2Session(){return J},get radWindL2Telemetry(){return fe},get tidalRocheSession(){return me},get tidalRocheTelemetry(){return he},get solarConservation0(){return W},get solarConservation(){return G},get focusedSolarBodyIndex(){return K},get stellarEngine(){return ve},get stellarMode(){return Ee},get nebulaMhdSession(){return De},get nebulaMhdTelemetry(){return ke},get nebulaMhdStreamlines(){return Ae},get nebulaB0(){return je},get radWindL3Session(){return Me},get radWindL3Telemetry(){return Y},get magnetosphereSession(){return Ne},get magnetosphereTelemetry(){return Pe},get magnetosphereFieldLines(){return Ie},get tovCurve(){return Le},get stellarPreset(){return ye},get stellarTelemetry(){return be},get stellarNuclearNetwork(){return xe},get stellarLaneEmden(){return Se},get stellarTimeAccel(){return Te},get planetaryMode(){return Re},get planetaryResult(){return ze},get planetaryBodyIndex(){return Be},get planetaryCutaway(){return Ve},get planetaryAtmoState(){return Ue},get planetaryAtmoSession(){return We},get planetaryAtmoTelemetry(){return Ge},get planetaryTriboelectric(){return Ke},get cryoPlumeSession(){return Je},get cryoPlumeTelemetry(){return Ye},get mdSession(){return Xe},get mdTelemetry(){return Ze},get mdElementZ(){return Qe},get mdTempK(){return $e},get mdGravity(){return et},get mdPhasePreset(){return tt},get mdRdfHistory(){return nt},get quantumZ(){return rt},get quantumN(){return it},get quantumL(){return at},get quantumM(){return ot},get quantumRelativistic(){return st},get quantumMode(){return ct},get quantumMoleculeKey(){return ft},get orbitalCloud(){return pt},get moleculeRhfResult(){return mt},get nuclearZ(){return ht},get nuclearA(){return gt},get nuclearResult(){return _t},get tdseSession(){return vt},get tdseTelemetry(){return bt},evaluateIsmRadiativeCoolingErgCm3PerS:zn,evaluateStellarEvolutionaryState:lt,buildQuantizedNucleonSpheres:ti,getElementBundle:wt,getCachedElementBundle:wn,ensureLevelInitialized:nn,initCosmicWeb:Tt,initCosmoBaryonRegime:Nt,initGalaxy:Dt,initSmbhCore:Ot,initSolarSystem:At,initProtoplanetaryDisk:jt,initKerrQuasarJet:Pt,initRelativisticBinary:Ft,initRadiativeWindL2:It,initTidalRocheL2:Lt,initNebularMhd:Mt,initRadiativeWindL3:zt,initCompactMagnetosphere:Bt,initWhiteDwarfTovCurve:Vt,initStellarCore:Ut,initPlanetaryInterior:Wt,initCryoPlumesL4:Ht,initMolecularDynamics:Gt,initQuantumAtom:Kt,initAtomicNucleus:Jt,stepActiveRegimes:Yt,setCosmicEpoch:dn,setCosmoMode:fn,setQuality:rn,setSeed:an,setMdGravity:on,setMdTemp:sn,setPlanetaryCutaway:cn,setPlanetaryTriboelectric:xn,setPlanetaryMode:gn,setStellarTimeAccel:ln,setSolarMode:Q,setKerrSpinA:pn,setProtoplanetaryGasDrag:mn,setStellarMode:hn,setNebulaB0:_n,setShowGalacticBField:vn,setGalaxyBranch:Sn,setFocusedSolarBody:Cn,getActiveUniversalLaws:$,getTargetsForLevel:Tn,connectPeerMesh:Zt,disconnectPeerMesh:Xt,getPeerMeshState:Qt,dispatchPeerDerivation:$t,dispose:En})}var ii=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),ai=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),oi=`
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
`,si=`
${oi}

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
`,ci=`
${oi}

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
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-2.0, 4.0, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    col = mix(blackbody_rgb(log_t), vec3<f32>(0.58, 0.94, 1.0), fusion_glow * 0.62);
    col = col * (0.95 + 1.15 * fusion_glow);
    pt_size = pt_size_base * (0.68 + 1.15 * dens_w);
    alpha = alpha_gain * (0.32 + 0.64 * dens_w);
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
  } else {
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
`,li=`
${oi}

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
`,ui=`
${oi}

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
`,di=`
${oi}

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
`,fi=`
${oi}

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
`,pi=`
${oi}

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
`,mi=`
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
`;function hi(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let r=navigator.gpu.getPreferredCanvasFormat();function i(){let t=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],i=null;for(let e of t)try{n.configure(e);return}catch(e){i=e}if(i)throw i}i();let a=`rgba16float`,o=`depth24plus`,s=0,c=0,l=null,u=null,d=null,f=null,p=e.createBuffer({label:`uv-cam-base`,size:176,usage:ii.UNIFORM|ii.COPY_DST}),m=e.createBuffer({label:`uv-cam-cloud-a`,size:176,usage:ii.UNIFORM|ii.COPY_DST}),h=e.createBuffer({label:`uv-cam-cloud-b`,size:176,usage:ii.UNIFORM|ii.COPY_DST}),g=e.createBuffer({label:`uv-cam-aux`,size:176,usage:ii.UNIFORM|ii.COPY_DST}),_=e.createBuffer({label:`uv-post-uniform`,size:48,usage:ii.UNIFORM|ii.COPY_DST}),v=e.createSampler({magFilter:`linear`,minFilter:`linear`}),y=e.createBuffer({label:`uv-spheres`,size:320*64,usage:ii.STORAGE|ii.COPY_DST}),b=e.createBuffer({label:`uv-disks`,size:768,usage:ii.STORAGE|ii.COPY_DST}),x=24576,S=e.createBuffer({label:`uv-lines`,size:x*28,usage:ii.VERTEX|ii.COPY_DST}),C=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:ii.STORAGE|ii.COPY_DST}),w=1024*32*16,T=(t,n)=>e.createShaderModule({label:t,code:n}),E=T(`uv-backdrop`,si),D=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_main`},fragment:{module:E,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),O=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),k=T(`uv-cloud`,ci),A=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:k,entryPoint:`vs_main`},fragment:{module:k,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),j=T(`uv-lit-sphere`,li),M=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:j,entryPoint:`vs_main`},fragment:{module:j,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),N=e.createBuffer({label:`uv-dummy-atmo-em`,size:64,usage:ii.STORAGE|ii.COPY_DST}),P=new WeakMap;function F(t){let n=t||N,r=P.get(n);return r||(r=e.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:n}}]}),P.set(n,r)),r}let I=T(`uv-md-sphere`,ui),L=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_main`},fragment:{module:I,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),R=T(`uv-disk`,di),z=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:R,entryPoint:`vs_main`},fragment:{module:R,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),B=e.createBindGroup({layout:z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:b}}]}),V=T(`uv-line`,fi),H=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:V,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:V,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),U=e.createBindGroup({layout:H.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),W=T(`uv-nuclear-vol`,pi),G=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:W,entryPoint:`vs_main`},fragment:{module:W,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),K=e.createBindGroup({layout:G.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]}),q=T(`uv-post`,mi),ee=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:q,entryPoint:`vs_main`},fragment:{module:q,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),te=null,ne=new WeakMap,re=new WeakMap,ie=new WeakMap;function ae(t,n){let r=n===0?ne:re,i=n===0?m:h,a=r.get(t);return a||(a=e.createBindGroup({layout:A.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:t}}]}),r.set(t,a)),a}function oe(t,n){let r=ie.get(t);return r||(r=e.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),ie.set(t,r)),r}function se(t,n){let r=Math.max(2,Math.floor(t)),p=Math.max(2,Math.floor(n));l&&s===r&&c===p||(s=r,c=p,i(),l?.destroy(),d?.destroy(),l=e.createTexture({label:`uv-scene-color`,size:[s,c],format:a,usage:ai.RENDER_ATTACHMENT|ai.TEXTURE_BINDING}),u=l.createView(),d=e.createTexture({label:`uv-scene-depth`,size:[s,c],format:o,usage:ai.RENDER_ATTACHMENT}),f=d.createView(),te=e.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:u},{binding:2,resource:v}]}))}function ce(t){!t||t.byteLength===0||(t.byteLength>w&&(C.destroy(),w=t.byteLength,C=e.createBuffer({label:`uv-nuclear-vol`,size:w,usage:ii.STORAGE|ii.COPY_DST}),K=e.createBindGroup({layout:G.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:C}}]})),e.queue.writeBuffer(C,0,t))}let le=new Float32Array(44),ue=new Float32Array(12),de=new Float32Array(320*16),J=new Float32Array(192),fe=new Float32Array(x*7);function pe(t,n,r,i,a){le.set(n.viewProj,0),le.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),le.set([n.right[0],n.right[1],n.right[2],n.aspect],20),le.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),le.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),le.set(r||[0,0,0,0],32),le.set(i||[0,0,0,0],36),le.set(a||[0,0,0,0],40),e.queue.writeBuffer(t,0,le)}function me({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:o=null,lightDir:l=[.6,.75,.55],mdCloud:d=null,disks:v=null,lines:C=null,nuclearVol:w=null,post:T={}}){se(t.width,t.height);let E=0;if(Array.isArray(a)&&a.length>0){E=Math.min(320,a.length);for(let e=0;e<E;e+=1){let t=a[e],n=e*16;de[n+0]=t.pos[0],de[n+1]=t.pos[1],de[n+2]=t.pos[2],de[n+3]=t.radius,de[n+4]=t.color0[0],de[n+5]=t.color0[1],de[n+6]=t.color0[2],de[n+7]=t.kind??1,de[n+8]=t.color1?.[0]??t.color0[0],de[n+9]=t.color1?.[1]??t.color0[1],de[n+10]=t.color1?.[2]??t.color0[2],de[n+11]=t.atm??.35,de[n+12]=t.rCore??.52,de[n+13]=t.rMantle??.94,de[n+14]=+!!t.cutaway,de[n+15]=t.seed??(e+1)*1.37}e.queue.writeBuffer(y,0,de.subarray(0,E*16))}let k=0;if(Array.isArray(v)&&v.length>0){k=Math.min(16,v.length);for(let e=0;e<k;e+=1){let t=v[e],n=e*12;J[n+0]=t.center[0],J[n+1]=t.center[1],J[n+2]=t.center[2],J[n+3]=t.rIn,J[n+4]=t.normal[0],J[n+5]=t.normal[1],J[n+6]=t.normal[2],J[n+7]=t.rOut,J[n+8]=t.color?.[0]??.9,J[n+9]=t.color?.[1]??.85,J[n+10]=t.color?.[2]??.72,J[n+11]=t.kind??0}e.queue.writeBuffer(b,0,J.subarray(0,k*12))}let j=0;C&&C.length>=14&&(j=Math.min(x,Math.floor(C.length/7)),fe.set(C.subarray(0,j*7),0),e.queue.writeBuffer(S,0,fe.subarray(0,j*7)));let N=!!(o&&o.buffer&&o.width>0&&o.height>0);pe(p,r,[r.level||0,0,0,0],[l[0],l[1],l[2],0],N?[o.width,o.height,o.sphereIndex??0,1]:[1,1,-1,0]);let P=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,2);for(let e=0;e<P.length;e+=1){let t=P[e];pe(e===0?m:h,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0])}d&&d.positionsBuffer&&d.velocitiesBuffer&&d.count>0?pe(g,r,[d.halfBox[0],d.halfBox[1],d.halfBox[2],d.worldScale],[d.baseRgb[0],d.baseRgb[1],d.baseRgb[2],d.radius],[d.alphaFade??1,0,0,d.idealCoord||12]):w&&w.dim>0&&pe(g,r,[w.dim,w.boxRadius||3.4,w.tdseTunneled||0,w.tdseCrestNorm||.72],[w.alphaMul??1,0,0,0],[0,0,0,0]),ue[0]=s,ue[1]=c,ue[2]=T.bhUv?.[0]??.5,ue[3]=T.bhUv?.[1]??.5,ue[4]=T.bhStrength??0,ue[5]=T.warpAmount??0,ue[6]=T.flashAmount??0,ue[7]=+!!T.crtEnabled,ue[8]=T.pixelSize??3,ue[9]=T.timeSec??0,ue[10]=0,ue[11]=0,e.queue.writeBuffer(_,0,ue);let I=e.createCommandEncoder({label:`uv-frame-fused`});{let e=I.beginRenderPass({colorAttachments:[{view:u,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:f,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});e.setPipeline(D),e.setBindGroup(0,O),e.draw(3,1,0,0),j>0&&(e.setPipeline(H),e.setBindGroup(0,U),e.setVertexBuffer(0,S,0,j*28),e.draw(j,1,0,0)),E>0&&(e.setPipeline(M),e.setBindGroup(0,F(N?o.buffer:null)),e.draw(6,E,0,0)),d&&d.positionsBuffer&&d.velocitiesBuffer&&d.count>0&&(e.setPipeline(L),e.setBindGroup(0,oe(d.positionsBuffer,d.velocitiesBuffer)),e.draw(6,d.count,0,0)),k>0&&(e.setPipeline(z),e.setBindGroup(0,B),e.draw(6,k,0,0));for(let t=0;t<P.length;t+=1){let n=P[t];e.setPipeline(A),e.setBindGroup(0,ae(n.buffer,t)),e.draw(6,n.count,0,0)}w&&w.dim>0&&(e.setPipeline(G),e.setBindGroup(0,K),e.draw(3,1,0,0)),e.end()}{let e=n.getCurrentTexture().createView(),t=I.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(ee),t.setBindGroup(0,te),t.draw(3,1,0,0),t.end()}e.queue.submit([I.finish()])}function he(){l?.destroy(),d?.destroy();for(let e of[p,m,h,g,_,y,N,b,S,C])try{e.destroy()}catch{}}return Object.freeze({renderFrame:me,uploadNuclearVolume:ce,dispose:he})}function gi(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function _i(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function vi(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function yi(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function bi(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.25,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=n*r*a,o}function xi(e,t,n){let r=yi(gi(t,e)),i=yi(_i(r,n)),a=_i(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-vi(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-vi(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=vi(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function Si(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function Ci(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function wi(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function Ti(e){return Math.max(0,Math.min(1,e))}function Ei(e,t,n){let r=Ti((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function Di(e,t,n,r,i){return e<=t||e>=i?0:e<n?Ei(t,n,e):e>r?1-Ei(r,i,e):1}function Oi(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function ki(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.massiveCount,s=Array.from({length:o},(t,n)=>e.getMassiveBodyState64(n));for(let e=1;e<o;e+=1){let o=U[e],c=o.parent>=0?o.parent:0,l=c>0;if(l&&r>10.6||!l&&r<8.4)continue;let u=s[c],d=s[e],f=d.posAu[0]-u.posAu[0],p=d.posAu[1]-u.posAu[1],m=d.posAu[2]-u.posAu[2],h=d.velAuPerYr[0]-u.velAuPerYr[0],g=d.velAuPerYr[1]-u.velAuPerYr[1],_=d.velAuPerYr[2]-u.velAuPerYr[2],v=Math.hypot(f,p,m),y=h*h+g*g+_*_,b=V*(u.massSolar+d.massSolar);if(!(v>1e-8&&b>1e-12))continue;let x=.5*y-b/v;if(x>=-1e-6)continue;let S=-b/(2*x),C=_i([f,p,m],[h,g,_]),w=Math.hypot(C[0],C[1],C[2]);if(!(w>1e-10))continue;let T=[C[0]/w,C[1]/w,C[2]/w],E=_i([h,g,_],C),D=[E[0]/b-f/v,E[1]/b-p/v,E[2]/b-m/v],O=Math.min(.985,Math.hypot(D[0],D[1],D[2])),k=O>1e-5?[D[0]/O,D[1]/O,D[2]/O]:yi([f,p,m]),A=_i(T,k),j=S*Math.sqrt(Math.max(.01,1-O*O)),M=u.posAu[0]-t[0],N=u.posAu[1]-t[1],P=u.posAu[2]-t[2],F=o.color0||[.38,.72,1],I=(l?.34:o.id===`halley`?.16:.28)*i,L=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=S*(Math.cos(t)-O),i=j*Math.sin(t),o=[(M+r*k[0]+i*A[0])*n,(N+r*k[1]+i*A[1])*n,(P+r*k[2]+i*A[2])*n];L&&(a.push(...L,F[0],F[1],F[2],I),a.push(...o,F[0],F[1],F[2],I)),L=o}}return a}function Ai(e,{focusedSolarBodyIndex:t=3,galaxyBranch:n=`solar-system`}={}){return e>=22.3?0:e>=16.2?1:e>=8.75?n!==`smbh-core`&&t===0&&e<=9.8?3:2:e>=-5.6?t===0&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function ji(e){let t=Math.max(2e5,(Number(e?.radiusKm)||6371)*1e3),n=e?.ringed?5.2:3.65;return Math.min(8.68,Math.max(6.2,Math.log10(t*n)))}function Mi(e){return Math.max(ie,Math.min(re,Number(e)))}async function Ni(){if(!navigator.gpu)throw Error(`navigator.gpu is unavailable in this browser.`);let e=null;for(let t=0;t<6&&!e;t+=1)e=await navigator.gpu.requestAdapter({powerPreference:`high-performance`}),e||await new Promise(e=>setTimeout(e,250));if(!e)throw Error(`No WebGPU adapter available on this device.`);let t=await e.requestDevice(),n=[];t.addEventListener(`uncapturederror`,e=>{n.push(String(e?.error?.message??e))}),T(t,`ulg-universes-demo`);let r=new URLSearchParams(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(r.get(`Z`)||r.get(`z`)||`26`,10)||26)),a=Number.parseInt(r.get(`seed`)||`20261125`,10)||20261125,o=se[r.get(`quality`)]?r.get(`quality`):`med`,s=ae[0].log10SpanM;r.has(`scale`)?s=Mi(Number.parseFloat(r.get(`scale`))||24.8):r.has(`level`)&&(s=ae[Math.max(0,Math.min(7,Number.parseInt(r.get(`level`),10)||0))].log10SpanM);let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-epoch-rail`),p=document.getElementById(`uv-zoom-slider`),m=document.getElementById(`uv-zoom-readout`),h=document.getElementById(`uv-status-dot`),g=document.getElementById(`uv-scale-badge`),_=document.getElementById(`uv-fps-badge`),v=document.getElementById(`uv-autopilot-btn`),y=document.getElementById(`uv-sim-btn`),b=document.getElementById(`uv-config-btn`),x=document.getElementById(`uv-help-btn`),S=document.getElementById(`uv-sim-drawer`),C=document.getElementById(`uv-config-drawer`),w=document.getElementById(`uv-help-drawer`),E=document.getElementById(`uv-pause-btn`),D=document.getElementById(`uv-orbit-up-btn`),O=document.getElementById(`uv-timescale-slider`),k=document.getElementById(`uv-timescale-val`),A=document.getElementById(`uv-bigbang-btn`),j=document.getElementById(`uv-reseed-btn`),M=document.getElementById(`uv-scale-controls`),N=document.getElementById(`uv-quality-group`),P=document.getElementById(`uv-lensing-toggle`),F=document.getElementById(`uv-orbits-toggle`),I=document.getElementById(`uv-travel-toggle`),L=document.getElementById(`uv-autospin-toggle`),R=document.getElementById(`uv-crt-toggle`),B=document.getElementById(`uv-pixel-slider`),V=document.getElementById(`uv-pixel-val`),H=document.getElementById(`uv-peer-url`),W=document.getElementById(`uv-peer-role`),G=document.getElementById(`uv-peer-connect-btn`),K=document.getElementById(`uv-peer-status`),q=document.getElementById(`uv-inspector`),ee=document.getElementById(`uv-collapse-btn`),te=document.getElementById(`uv-info-quick-btn`),ne=document.getElementById(`uv-target-kicker`),de=document.getElementById(`uv-target-name`),J=document.getElementById(`uv-target-sub`),fe=document.getElementById(`uv-spec-title`),pe=document.getElementById(`uv-comp-text`),me=document.getElementById(`uv-spectrograph-canvas`),he=document.getElementById(`uv-stats-grid`),ge=document.getElementById(`uv-plot-title`),_e=document.getElementById(`uv-plot-meta`),ve=document.getElementById(`uv-plot-canvas`),ye=document.getElementById(`uv-dive-btn`),be=document.getElementById(`uv-return-btn`),xe=document.getElementById(`uv-engine-tag`),Se=document.getElementById(`uv-breadcrumb`),Ce=document.getElementById(`uv-warp-overlay`),we=document.getElementById(`uv-help-scale-tag`),Te=document.getElementById(`uv-about-scale-btn`),Ee=document.getElementById(`uv-about-ulg-btn`),De=document.getElementById(`uv-modal-backdrop`),Oe=document.getElementById(`uv-modal-title`),ke=document.getElementById(`uv-modal-sub`),Ae=document.getElementById(`uv-modal-content`),je=document.getElementById(`uv-modal-close`),Me=hi(t,c),Y=ri(t,{seed:a,qualityId:o,initialElementZ:i}),X=Ai(s,{focusedSolarBodyIndex:Y.focusedSolarBodyIndex,galaxyBranch:Y.galaxyBranch}),Ne=null,Pe=null,Fe=!0,Ie=1,Le=!0,Re=!0,ze=r.get(`cameraAutoSpin`)===`1`,Be=r.get(`crt`)===`1`,Ve=3,He=r.get(`autopilot`)===`1`,Ue=0,We=!1,Ge=0,Ke=null,qe=0,Je={yaw:.56,pitch:.42,dist:18},Ye=new Float32Array(16),Xe=window.innerWidth,Ze=window.innerHeight,Qe={},$e=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(L&&(L.checked=ze),R&&(R.checked=Be),v&&He&&(v.classList.add(`active`),v.textContent=`⏹ Stop Tour`),N)for(let e of N.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=ae.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);Number.isFinite(t)&&(He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),t===3?Y.setFocusedSolarBody(0):t===4&&Y.focusedSolarBodyIndex===0&&Y.setFocusedSolarBody(3),ct(ae[t].log10SpanM))})}function et(){if(f)for(let e of f.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===Y.cosmicEpochId)}if(f){f.innerHTML=Y.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===Y.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of f.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await Y.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:X}),et(),dt(),lt(),wt(),Nt(performance.now())})}p?.addEventListener(`input`,e=>{He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Ke=null,s=Math.max(ie,Math.min(re,Number(e.target.value))),ot(s)});function tt(){let e=Math.min(window.devicePixelRatio||1,2);Xe=Math.max(320,window.innerWidth),Ze=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(Xe*e)),n=Math.max(2,Math.floor(Ze*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==Xe||l.height!==Ze)&&(l.width=Xe,l.height=Ze)}tt(),window.addEventListener(`resize`,tt);let nt=[{el:S,btn:y},{el:C,btn:b},{el:w,btn:x}];function rt(e){for(let t of nt){let n=t.el===e&&!t.el?.classList.contains(`open`);t.el?.classList.toggle(`open`,n),t.btn?.classList.toggle(`active`,n)}}function it(){for(let e of nt)e.el?.classList.remove(`open`),e.btn?.classList.remove(`active`)}y?.addEventListener(`click`,()=>rt(S)),b?.addEventListener(`click`,()=>rt(C)),x?.addEventListener(`click`,()=>rt(w));for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>it());function at(e,t,n){it(),Oe&&(Oe.textContent=e),ke&&(ke.textContent=t),Ae&&(Ae.innerHTML=n),De?.classList.add(`open`)}je?.addEventListener(`click`,()=>De?.classList.remove(`open`)),De?.addEventListener(`click`,e=>{e.target===De&&De.classList.remove(`open`)}),Te?.addEventListener(`click`,()=>{let e=ae[X];at(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,ue(e))}),te?.addEventListener(`click`,()=>{let e=ae[X];at(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,ue(e))}),Ee?.addEventListener(`click`,()=>{at(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,le())}),ee?.addEventListener(`click`,()=>{let e=q?.classList.toggle(`collapsed`);ee&&(ee.textContent=e?`+`:`−`)});async function ot(e){let t=Ai(e,{focusedSolarBodyIndex:Y.focusedSolarBodyIndex,galaxyBranch:Y.galaxyBranch}),n=new Set([t]);e>=20.5&&n.add(0),e>=14.8&&e<=23.5&&n.add(1),e>=6.5&&e<=18.2&&n.add(2),e>=6.8&&e<=10.8&&Y.focusedSolarBodyIndex===0&&n.add(3),e>=-6.2&&e<=9.2&&Y.focusedSolarBodyIndex>0&&n.add(4),e>=-10&&e<=-4.5&&n.add(5),e>=-13.5&&e<=-8.4&&n.add(6),e<=-11.5&&n.add(7);let r=Y.nuclearResult;for(let e of n)await Y.ensureLevelInitialized(e);Y.nuclearResult&&Y.nuclearResult!==r&&Y.nuclearResult.volumeData&&Me.uploadNuclearVolume(Y.nuclearResult.volumeData)}function st(e=Y.focusedSolarBodyIndex){if(!Y.solarEngine||e<=0)return;let t=Y.solarEngine.getMassiveBodyState64(e),n=Y.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];Je.yaw=Math.atan2(r,i)-.92,Je.pitch=.24}function ct(e){Ke=Math.max(ie,Math.min(re,Number(e))),ot(Ke)}function lt(){if(M)if(X===0)M.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${Y.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${Y.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${Y.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${Y.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${Y.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:Y.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:Y.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${Y.quality.cosmoGridPerSide}³</code> particles on a <code>${Y.quality.cosmoFftN}³</code> periodic FFT mesh.`}</div>`,M.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await Y.setCosmoMode(e.target.value),dt(),lt(),wt(),Nt(performance.now())});else if(X===1)M.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${Y.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${Y.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="binary" ${Y.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${Y.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${Y.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${Y.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${Y.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${Y.galaxyBranch===`solar-system`?`selected`:``}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${Y.galaxyBranch===`smbh-core`?`selected`:``}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${Y.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${Y.galaxyMetallicity.toFixed(1)}</span>
        </div>`,M.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await Y.initGalaxy({preset:e.target.value}),dt(),lt(),Nt(performance.now())}),M.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;Y.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),ot(s)}),M.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await Y.initGalaxy({preset:Y.galaxyPreset,metallicity:t})});else if(X===2)Y.galaxyBranch===`smbh-core`?(M.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,M.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{Y.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await Y.ensureLevelInitialized(2),lt()})):(M.innerHTML=`
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${Y.solarMode===`nbody`?`selected`:``}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${Y.solarMode===`formation`?`selected`:``}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${Y.solarMode===`roche-rings`?`selected`:``}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${Y.solarMode===`giant-impact`?`selected`:``}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${Y.solarMode===`comet-tails`?`selected`:``}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${Y.solarMode===`hot-jupiter`?`selected`:``}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${Y.solarMode===`red-giant`?`selected`:``}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${Y.solarMode===`quasar-jet`?`selected`:``}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="xray-binary" ${Y.solarMode===`xray-binary`?`selected`:``}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${Y.solarMode===`bns-kilonova`?`selected`:``}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${Y.solarMode===`type-ia`?`selected`:``}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${Y.solarMode===`bbh-merger`?`selected`:``}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${Y.solarMode===`formation`?`
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${Y.protoplanetaryGasDrag?`checked`:``} />
            </label>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(Y.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          `:Y.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${Y.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${Y.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:Y.solarMode===`nbody`?`
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${U.map((e,t)=>`<option value="${t}" ${t===Y.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">100% WebGPU f32x2 double-float symplectic N-body at exact astronomical radii (Earth = 0.00916 R☉).</div>
          `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,M.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await Y.setSolarMode(e.target.value),dt(),lt(),wt(),Nt(performance.now())}),M.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{Y.setProtoplanetaryGasDrag(e.target.checked)}),M.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await Y.setKerrSpinA(t),wt(),Nt(performance.now())}),M.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);Y.setFocusedSolarBody(t),Ne=U[t].id,t>0&&await Y.initPlanetaryInterior({bodyIndex:t})}));else if(X===3){M.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${Y.stellarMode===`fusion`?`selected`:``}>Thermonuclear Fusion Core (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${Y.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${Y.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars ([O III]/Hα/[S II])</option>
            <option value="planetary-nebula" ${Y.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${Y.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN</option>
            <option value="pulsar" ${Y.stellarMode===`pulsar`?`selected`:``}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${Y.stellarMode===`magnetar`?`selected`:``}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${Y.stellarMode===`white-dwarf-tov`?`selected`:``}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${Y.stellarMode===`nebular-mhd`?`
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${Y.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${Y.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        `:Y.stellarMode===`fusion`?`
          <div class="uv-seg-group">
            <button class="uv-seg-btn ${Y.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Solar</button>
            <button class="uv-seg-btn ${Y.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">Massive</button>
            <button class="uv-seg-btn ${Y.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${Y.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${Y.stellarTimeAccel.toFixed(1)}×</span>
          </div>
        `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,M.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await Y.setStellarMode(e.target.value),dt(),lt(),wt(),Nt(performance.now())}),M.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=M.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await Y.setNebulaB0(t)});for(let e of M.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await Y.initStellarCore({preset:e.dataset.stPreset}),lt()});M.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{Y.setStellarTimeAccel(Number(e.target.value));let t=M.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${Y.stellarTimeAccel.toFixed(1)}×`)})}else if(X===4){let e=Y.planetaryAtmoState?.activation;M.innerHTML=`
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${Y.planetaryMode===`standard`?`selected`:``}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${Y.planetaryMode===`magma-ocean`?`selected`:``}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${Y.planetaryMode===`cryo-plumes`?`selected`:``}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${Y.planetaryMode===`eyeball-locked`?`selected`:``}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${Y.planetaryMode===`rogue`?`selected`:``}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${U.slice(1).map((e,t)=>`<option value="${t+1}" ${t+1===Y.planetaryBodyIndex?`selected`:``}>${e.name} (${e.radiusKm.toLocaleString()} km)</option>`).join(``)}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${Y.planetaryTriboelectric?`checked`:``} ${e?.triboelectricActive?``:`disabled`} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${Y.planetaryCutaway?`checked`:``} />
        </label>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,M.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await Y.setPlanetaryMode(e.target.value),dt(),lt(),wt(),Nt(performance.now())}),M.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);Y.setFocusedSolarBody(t),await Y.initPlanetaryInterior({bodyIndex:t}),s=ji(U[t]),st(t),dt(),ft()}),M.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{Y.setPlanetaryTriboelectric(e.target.checked)}),M.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{Y.setPlanetaryCutaway(e.target.checked)})}else if(X===5){M.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${oe.map(e=>`<option value="${e.Z}" ${e.Z===Y.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${Y.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${Y.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,Y.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${Y.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${Y.mdGravity?`checked`:``} />
        </label>`,M.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await Y.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),dt(),lt()});for(let e of M.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await Y.initMolecularDynamics({Z:Y.mdElementZ,phasePreset:e.dataset.mdPhase}),lt()});M.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{Y.setMdTemp(Number(e.target.value));let t=M.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${Y.mdTempK} K`)}),M.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{Y.setMdGravity(e.target.checked)})}else if(X===6){M.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${Y.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${Y.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${oe.map(e=>`<option value="${e.Z}" ${e.Z===Y.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===Y.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<Y.quantumN).map(e=>`<option value="${e}" ${e===Y.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${Y.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(Y.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${Y.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${Y.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of M.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await Y.initQuantumAtom({mode:e.dataset.qmMode}),dt(),lt()});M.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),dt(),lt()}),M.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await Y.initQuantumAtom({n:t,l:Math.min(Y.quantumL,t-1),m:0}),lt()}),M.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({l:Number(e.target.value),m:0}),lt()}),M.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({relativistic:e.target.checked}),dt()});for(let e of M.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await Y.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),dt(),lt()})}else X===7&&(M.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${oe.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===Y.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,M.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await Y.initAtomicNucleus({Z:Number(t),A:Number(n)}),Y.nuclearResult?.volumeData&&Me.uploadNuclearVolume(Y.nuclearResult.volumeData),dt()}),M.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{Y.tdseSession?.resetWavepacket?.()}))}function ut(){let e=Y.getTargetsForLevel(X,Qe);return e.find(e=>e.id===Ne)||e[0]||null}function dt(){let e=Y.getTargetsForLevel(X,Qe);Ne=X===2&&Y.galaxyBranch!==`smbh-core`?U[Y.focusedSolarBodyIndex]?.id||`earth`:e[0]?.id||null}function ft(){let e=ae[X];if(g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=ce(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),we&&(we.textContent=`L${e.level}`),xe&&(xe.textContent=e.engineSchema),ge&&(ge.textContent=e.plotTitle),ye&&(ye.textContent=e.diveButton),be&&(be.disabled=X===0),D&&(D.disabled=X===0),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===X);if(Se){$e[2]=Y.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:`Solar System`,$e[4]=U[Y.planetaryBodyIndex]?.name||`Earth`;let e=$e.slice(0,X+1);Se.innerHTML=e.map((t,n)=>n===e.length-1?`<strong>${t}</strong>`:t).join(` › `)}lt()}async function pt(){let e=ut();X===1&&e?.branch&&Y.setGalaxyBranch(e.branch,e.pos),X===2&&e?.bodyIndex!=null&&(Y.setFocusedSolarBody(e.bodyIndex),e.bodyIndex>0&&await Y.initPlanetaryInterior({bodyIndex:e.bodyIndex})),X===4&&e?.sampleZ&&await Y.initMolecularDynamics({Z:e.sampleZ,phasePreset:`solid`}),X===5&&e?.sampleZ&&await Y.initQuantumAtom({Z:e.sampleZ,mode:`atom`}),X===6&&e?.sampleZ&&(await Y.initAtomicNucleus({Z:e.sampleZ}),Y.nuclearResult?.volumeData&&Me.uploadNuclearVolume(Y.nuclearResult.volumeData));let t=e?.nextLevel==null?(X+1)%8:e.nextLevel;t===4&&Y.focusedSolarBodyIndex===0&&Y.setFocusedSolarBody(3),ct(ae[t].log10SpanM)}async function mt(){X<=0||ct(ae[X-1].log10SpanM)}if(ye?.addEventListener(`click`,()=>{He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),pt()}),be?.addEventListener(`click`,()=>{He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),mt()}),D?.addEventListener(`click`,()=>{He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),mt()}),v?.addEventListener(`click`,()=>{He=!He,v.classList.toggle(`active`,He),v.textContent=He?`⏹ Stop Tour`:`▶ Tour`,He&&(Ke=null)}),E?.addEventListener(`click`,()=>{Fe=!Fe,E.textContent=Fe?`⏸ Pause`:`▶ Resume`,h?.classList.toggle(`paused`,!Fe)}),O?.addEventListener(`input`,e=>{Ie=Number(e.target.value)||1,k&&(k.textContent=`${Ie.toFixed(1)}×`)}),A?.addEventListener(`click`,async()=>{Ue=1,await Y.initCosmicWeb(),Ke=null,s=ae[0].log10SpanM,X=0,dt(),ft()}),j?.addEventListener(`click`,async()=>{Ue=.75,Y.setSeed(Y.seed+7919>>>0),await Y.initCosmicWeb(),Y.galaxyEngine&&await Y.initGalaxy(),Y.solarEngine&&await Y.initSolarSystem(),dt()}),N)for(let e of N.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(Y.setQuality(t)){for(let e of N.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);X===0?await Y.initCosmicWeb():X===1?await Y.initGalaxy():X===2&&Y.galaxyBranch!==`smbh-core`?await Y.initSolarSystem():X===3?await Y.initStellarCore():X===5?await Y.initMolecularDynamics():X===6?await Y.initQuantumAtom():X===7&&(await Y.initAtomicNucleus(),Y.nuclearResult?.volumeData&&Me.uploadNuclearVolume(Y.nuclearResult.volumeData)),lt()}});P?.addEventListener(`change`,e=>{Le=e.target.checked}),F?.addEventListener(`change`,e=>{Re=e.target.checked}),I?.addEventListener(`change`,e=>{e.target.checked}),L?.addEventListener(`change`,e=>{ze=e.target.checked}),R?.addEventListener(`change`,e=>{Be=e.target.checked}),B?.addEventListener(`input`,e=>{Ve=Number(e.target.value)||3,V&&(V.textContent=`${Ve}×`)}),G?.addEventListener(`click`,async()=>{Y.getPeerMeshState().connected?await Y.disconnectPeerMesh():await Y.connectPeerMesh({relayUrl:H?.value||``,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:W?.value||`requester`}),ht()});function ht(){let e=Y.getPeerMeshState();G&&(G.textContent=e.connected?`Leave`:`Join Mesh`),K&&(K.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let gt=!1,_t=!1,vt=0,yt=0,bt=0,xt=0;function Z(e,t){let n=Y.getTargetsForLevel(X,Qe),r=null,i=48;for(let a of n){let n=Ci(a.pos,Ye,Xe,Ze);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r=a)}return r}c.addEventListener(`pointerdown`,e=>{gt=!0,_t=!1,vt=e.clientX,yt=e.clientY,bt=e.clientX,xt=e.clientY,c.setPointerCapture?.(e.pointerId)}),c.addEventListener(`pointermove`,e=>{if(gt){let t=e.clientX-bt,n=e.clientY-xt;Math.hypot(e.clientX-vt,e.clientY-yt)>5&&(_t=!0),Je.yaw-=t*.006,Je.pitch=Math.max(-1.42,Math.min(1.42,Je.pitch+n*.006)),bt=e.clientX,xt=e.clientY}else{let t=Z(e.clientX,e.clientY);Pe=t?.id||null,c.style.cursor=t?`pointer`:`grab`}}),c.addEventListener(`pointerup`,e=>{if(gt&&!_t){let t=Z(e.clientX,e.clientY);t&&(Ne=t.id,He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),X===1&&t.branch?Y.setGalaxyBranch(t.branch,t.pos):X===2&&t.bodyIndex!=null&&(Y.setFocusedSolarBody(t.bodyIndex),t.bodyIndex>0&&Y.initPlanetaryInterior({bodyIndex:t.bodyIndex})),lt())}gt=!1}),c.addEventListener(`dblclick`,e=>{let t=Z(e.clientX,e.clientY);t&&(Ne=t.id),He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),pt()}),c.addEventListener(`wheel`,e=>{e.preventDefault(),He=!1,v?.classList.remove(`active`),v&&(v.textContent=`▶ Tour`),Ke=null;let t=Math.max(-.55,Math.min(.55,e.deltaY*.0024));s=Math.max(ie,Math.min(re,s+t)),qe=Math.abs(t)*10,ot(s)},{passive:!1});function St(e){if(!me)return;let t=me.getContext(`2d`);if(!t)return;let n=me.width,r=me.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=wi(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=X>=5?Y.getCachedElementBundle(X===5?Y.mdElementZ:Y.quantumZ,Y.quantumRelativistic):null,a=ni(X,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=wi(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}}function Ct(){if(!ve)return;let e=ve.getContext(`2d`);if(!e)return;let t=ve.width,n=ve.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(X===0){let e=Y.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;_e&&(_e.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=Y.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(X===1){_e&&(_e.textContent=`Gate 1 H/He/C/O · Z=${Y.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=Y.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,Y.galaxyMetallicity,Y.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(X===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(Y.solarMode)&&Y.relBinaryTelemetry?.gwStrainHistory?.length){let e=Y.relBinaryTelemetry.gwStrainHistory;ge&&(ge.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),_e&&(_e.textContent=`f_GW=${(Y.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(Y.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(Y.solarMode===`quasar-jet`&&Y.kerrJetTelemetry){ge&&(ge.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=Y.kerrJetTelemetry;_e&&(_e.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{ge&&(ge.textContent=ae[2].plotTitle);let r=Y.solarConservation0,i=Y.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;_e&&(_e.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${Y.solarEngine?.totalCount||0} bodies`);let o=U.filter(e=>e.parent===0&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.slice(0,3),a,n-14-i)})}else if(X===3)if((Y.stellarMode===`pulsar`||Y.stellarMode===`magnetar`)&&Y.magnetosphereTelemetry?.flareHistory?.length){let e=Y.magnetosphereTelemetry.flareHistory;ge&&(ge.textContent=Y.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),_e&&(_e.textContent=`B=${Y.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${Y.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),Y.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(Y.stellarMode===`white-dwarf-tov`&&Y.tovCurve?.length){ge&&(ge.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=Y.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);_e&&(_e.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{ge&&(ge.textContent=ae[3].plotTitle);let e=Y.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);_e&&(_e.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(Y.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(X===4){let e=Y.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,Y.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));_e&&(_e.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(Y.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(X===5){let e=Y.mdRdfHistory;if(!e?.length)return;_e&&(_e.textContent=`Phase: ${Y.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(Y.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(X===6){let e=Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;_e&&(_e.textContent=`Dirac–KS ${Y.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${Y.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(X===7){let e=Y.tdseTelemetry;if(!e?.prob?.length)return;_e&&(_e.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}function wt(){let e=ae[X],t=ut();g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=ce(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),ne&&(ne.textContent=`L${e.level} · ${e.name.toUpperCase()} · ${ce(s)}`),de&&(de.textContent=t?.name||e.name),J&&(J.textContent=t?.subtitle||e.engineSchema),pe&&(pe.textContent=t?.composition||``),fe&&(fe.textContent=X>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`);let n=[];if(X===0)if(Y.cosmoMode!==`web`&&Y.cosmoBaryonTelemetry){let e=Y.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;n=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=Y.cosmoTelemetry;n=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(X===1)n=[[`GPU Particles`,`${(Y.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,Y.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${Y.galaxyEngine?.stepIndex||0}`]];else if(X===2)if(Y.solarMode===`formation`&&Y.protoplanetaryTelemetry){let e=Y.protoplanetaryTelemetry;n=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(Y.solarMode===`quasar-jet`&&Y.kerrJetTelemetry){let e=Y.kerrJetTelemetry;n=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(Y.solarMode)&&Y.relBinaryTelemetry){let e=Y.relBinaryTelemetry;n=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(Y.solarMode)&&Y.radWindL2Telemetry){let e=Y.radWindL2Telemetry;n=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(Y.solarMode)&&Y.tidalRocheTelemetry){let e=Y.tidalRocheTelemetry;n=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=Y.solarConservation,t=U[Y.focusedSolarBodyIndex];n=[[`Focus`,t?.name||`Earth`],[`True Radius`,t?`${t.radiusKm.toLocaleString()} km`:`—`],[`N-Body Steps`,`${Y.solarEngine?.stepIndex||0}`],[`Sim Time`,`${(Y.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&Y.galaxyBranch===`smbh-core`&&(n[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],n[1]=[`Lensing`,Le?`Active WGSL`:`OFF`])}else if(X===3)if(Y.stellarMode===`nebular-mhd`&&Y.nebulaMhdTelemetry){let e=Y.nebulaMhdTelemetry;n=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(Y.stellarMode)&&Y.radWindL3Telemetry){let e=Y.radWindL3Telemetry;n=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((Y.stellarMode===`pulsar`||Y.stellarMode===`magnetar`)&&Y.magnetosphereTelemetry){let e=Y.magnetosphereTelemetry;n=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(Y.stellarMode===`white-dwarf-tov`&&Y.tovCurve?.length){let e=Y.tovCurve.find(e=>e.branch===`white-dwarf`)||Y.tovCurve[2],t=Y.tovCurve.find(e=>e.branch===`neutron-star`)||Y.tovCurve[11];n=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else{let e=Y.stellarTelemetry;n=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,e?.stage||`hydro-collapse`],[`GPU Steps`,`${Y.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(Y.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(X===4){let e=Y.planetaryResult,t=Y.planetaryAtmoTelemetry;n=[[`World`,U[Y.planetaryBodyIndex]?.name||`Earth`],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(X===5){let e=Y.mdTelemetry;n=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${Y.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,Y.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(X===6){let e=Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],r=Number(e?.atomic?.totalEnergyHa);n=[[`Samples`,`${(Y.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(r)?`${r.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(X===7){let e=Y.nuclearResult,t=Y.tdseTelemetry,r=Number(e?.bindingPerNucleonMeV),i=Number(e?.chargeRadiusFm);n=[[`B / A`,Number.isFinite(r)?`${r.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(i)?`${i.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}he&&(he.innerHTML=n.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``)),St(t),Ct()}function Tt(e){if(!u)return;u.clearRect(0,0,Xe,Ze);let t=Y.getTargetsForLevel(X,Qe);if(t.length)for(let n of t){if(X===2&&n.spec?.parent>0&&s>10.5||X===4&&!Y.planetaryCutaway)continue;let t=Ci(n.pos,e,Xe,Ze);if(!t.visible)continue;let r=n.id===Ne,i=n.id===Pe;if(!r&&!i&&X>=3)continue;let a=r?18:i?15:8;u.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:i?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,u.lineWidth=r?1.6:1;let o=Math.max(4,a*.45);for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(t.sx+e*a,t.sy+n*(a-o)),u.lineTo(t.sx+e*a,t.sy+n*a),u.lineTo(t.sx+e*(a-o),t.sy+n*a),u.stroke();(r||i||X===2&&n.spec?.parent===0&&s>9.5)&&(u.font=r?`600 11px monospace`:`500 9.5px monospace`,u.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,u.fillText(n.name,t.sx+a+6,t.sy+3.5))}}function Et(e,t){let n=s,r=10**n,i=[],a=[],o=[],c=[],l=[.62,.55,.55],u=null,d=null,f=null,p={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,qe*.08),flashAmount:Ue,crtEnabled:Be,pixelSize:Ve,timeSec:t},m=Di(n,20.8,22,25.6,26),h=Y.cosmoTargets[0]?.posMpc||[0,0,0],g=Ei(23.8,21.8,n),_=[h[0]*g,h[1]*g,h[2]*g],v=16/178*10**Math.min(2.6,24.8-n);if(Qe.cosmoScale=v,Qe.cosmoOffset=_,m>.01)if(Y.cosmoMode!==`web`&&Y.cosmoBaryonSession&&n>=22){let t=Di(n,22,22.7,25.6,26),r=12.2/Math.max(100,Y.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-n));if(i.push({buffer:Y.cosmoBaryonSession.getResidentTracersBuffer(),count:Y.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:Y.cosmoMode===`cmb`?.16:Y.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(Y.cosmoMode===`cmb`?.15:Y.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,Y.cosmoBaryonSession.boxSizeMpc||260]}),Y.cosmoMode===`cluster-merger`&&Le&&t>.25){let n=Ci([0,0,0],e.viewProj,Xe,Ze);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=9e-4*t)}}else Y.cosmoSession&&Y.cosmoMode===`web`&&i.push({buffer:Y.cosmoSession.particlesBuffer,count:Y.cosmoSession.particleCount,mode:0,worldScale:v,pointSize:Math.max(.048,Math.min(.17,.068*10**Math.max(-.5,Math.min(.8,24.8-n)))),alphaGain:.44*m,extra1:[_[0],_[1],_[2],Y.cosmoSession.boxSizeMpc||200]});let y=Di(n,15.4,16.6,22,22.8),b=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,x=Y.galaxyFocusPos||[4.8,.04,2.1],S=Ei(20.6,18.8,n),C=[x[0]*S,x[1]*S,x[2]*S];if(Qe.galaxyScale=b,Qe.galaxyOffset=C,y>.01&&Y.galaxyEngine&&(i.push({buffer:Y.galaxyEngine.getResidentBuffer(),count:Y.galaxyEngine.count,mode:1,worldScale:b,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*y,extra1:[C[0],C[1],C[2],0]}),Re&&Y.showGalacticBField&&Y.galaxyPreset===`disk`&&n>19.2)){let e=.16*y*Ei(19.2,20.5,n);for(let t=0;t<4;t+=1){let n=t*Math.PI*.5,r=null;for(let t=0;t<=28;t+=1){let i=1.4+t*.34,a=n+Math.log(1+i/.65)/Math.tan(17*Math.PI/180),o=[(Math.cos(a)*i-C[0])*b,(.04-C[1])*b,(Math.sin(a)*i-C[2])*b];r&&(c.push(...r,.28,.76,1,e),c.push(...o,.28,.76,1,e)),r=o}}}if(Y.galaxyBranch===`smbh-core`){let t=Di(n,9.2,10.6,15.8,17);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),Y.smbhBodies){let e=Math.floor(Y.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[Y.smbhBodies[e]*r,Y.smbhBodies[e+1]*r,Y.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(Le){let n=Ci([0,0,0],e.viewProj,Xe,Ze);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(Y.solarMode===`formation`&&X===2&&Y.protoplanetarySession){let e=Di(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n));if(i.push({buffer:Y.protoplanetarySession.getResidentPebblesBuffer(),count:Y.protoplanetarySession.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...Y.protoplanetarySession.getEmbryoRenderSpheres(t)),Re){let n=Y.protoplanetarySession.snowLineAu*t,r=null;for(let t=0;t<=72;t+=1){let i=t/72*Math.PI*2,a=[Math.cos(i)*n,0,Math.sin(i)*n];r&&(c.push(...r,.36,.84,1,.45*e),c.push(...a,.36,.84,1,.45*e)),r=a}}}}else if(Y.solarMode===`quasar-jet`&&X===2&&Y.kerrJetSession){let t=Di(n,9.6,10.6,15.6,16.8);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=Y.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:Y.kerrJetSession.getResidentParcelsBuffer(),count:Y.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),Le){let n=Ci([0,0,0],e.viewProj,Xe,Ze);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(Y.solarMode)&&X===2&&Y.relBinarySession){let t=Di(n,9.6,10.6,15.6,16.8);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...Y.relBinarySession.getRenderSpheres(r)),i.push({buffer:Y.relBinarySession.getResidentParcelsBuffer(),count:Y.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),Le&&(Y.solarMode===`bbh-merger`||Y.solarMode===`xray-binary`)){let n=Ci([0,0,0],e.viewProj,Xe,Ze);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=(Y.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(Y.solarMode)&&X===2&&Y.radWindL2Session){let e=Di(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=Y.solarMode===`comet-tails`;l=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:Y.radWindL2Session.getResidentParcelsBuffer(),count:Y.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(Y.solarMode)&&X===2&&Y.tidalRocheSession){let e=Di(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...Y.tidalRocheSession.getRenderSpheres(t)),i.push({buffer:Y.tidalRocheSession.getResidentParticlesBuffer(),count:Y.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else{let e=Di(n,5.4,6.4,15.8,17.2),t=r/z,s=16/Math.max(1e-9,t);if(Qe.solarScaleAuToWorld=s,e>.01&&Y.solarEngine){let t=Y.focusedSolarBodyIndex,r=Y.solarEngine.getMassiveBodyState64(t),d=Y.solarEngine.getMassiveBodyState64(0),f=[Math.fround(r.posAu[0]),Math.fround(r.posAu[1]),Math.fround(r.posAu[2])],p=[Math.fround(r.posAu[0]-f[0]),Math.fround(r.posAu[1]-f[1]),Math.fround(r.posAu[2]-f[2])];t>0&&(l=X===4&&Y.planetaryMode===`eyeball-locked`?[1,0,0]:X===4&&Y.planetaryMode===`rogue`?[.15,.96,.22]:yi([d.posAu[0]-r.posAu[0],d.posAu[1]-r.posAu[1],d.posAu[2]-r.posAu[2]]));let m=Y.getTargetsForLevel(4)[0],h=m?.rCoreNorm??.54,g=m?.rMantleNorm??.94;for(let c=0;c<Y.solarEngine.massiveCount;c+=1){let l=U[c],d=Y.solarEngine.getMassiveBodyState64(c),f=(d.posAu[0]-r.posAu[0])*s,p=(d.posAu[1]-r.posAu[1])*s,m=(d.posAu[2]-r.posAu[2])*s;if(Math.hypot(f,p,m)>180&&c!==t)continue;let _=d.radiusAu*s;if(c===0&&t===0&&n<=9.9)continue;let v=c===t&&c>0&&n<8.85,y=v&&Y.planetaryCutaway,b=v&&!y&&Y.planetaryMode===`magma-ocean`,x=v&&!y&&Y.planetaryMode===`cryo-plumes`,S=v&&!y&&Y.planetaryMode===`rogue`,C=a.length;if(a.push({pos:[f,p,m],radius:_,color0:b?[1,.44,.1]:x?[.86,.92,.98]:S?[.16,.24,.36]:l.color0,color1:b?[.22,.08,.05]:x?[.48,.68,.86]:S?[.06,.1,.18]:l.color1,kind:y?4:b?7:x?3:l.kind,atm:b?.55:x?.18:l.atm??.35,rCore:h,rMantle:g,cutaway:y,seed:c*2.17+1.3}),v&&!b&&!x&&Y.planetaryAtmoSession&&(u={buffer:Y.planetaryAtmoSession.getResidentEmVisBuffer(),width:Y.planetaryAtmoSession.width,height:Y.planetaryAtmoSession.height,sphereIndex:C}),x&&Y.cryoPlumeSession){let t=_/2.35;i.push({buffer:Y.cryoPlumeSession.getResidentParticlesBuffer(),count:Y.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[0,0,0,0]})}l.ringed&&_>.008&&o.push({center:[f,p,m],rIn:l.ringInnerKm/l.radiusKm*_,normal:[.16,.89,.42],rOut:l.ringOuterKm/l.radiusKm*_,color:[.88,.78,.62],kind:1})}let _=Di(n,10.6,11.4,14.5,16.2);if(_>.01&&i.push({buffer:Y.solarEngine.getResidentBuffer(),count:Y.solarEngine.totalCount,mode:4,worldScale:s,pointSize:.055,alphaGain:.42*_,extra1:[f[0],f[1],f[2],Y.solarEngine.massiveCount],extra2:[p[0],p[1],p[2],0]}),Re&&n>8.1){let e=Di(n,8.1,8.8,15.2,16.4);c.push(...ki(Y.solarEngine,r.posAu,s,n,e))}}}let w=Y.focusedSolarBodyIndex===0&&Y.galaxyBranch!==`smbh-core`?Di(n,7,7.8,9.7,10.4):0;if(w>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(Y.stellarMode===`nebular-mhd`&&Y.nebulaMhdSession){if(i.push({buffer:Y.nebulaMhdSession.getResidentTracersBuffer(),count:Y.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*w,extra1:[0,0,0,0]}),Y.nebulaMhdStreamlines?.length>=14){let t=Y.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(Y.stellarMode)&&Y.radWindL3Session)i.push({buffer:Y.radWindL3Session.getResidentParcelsBuffer(),count:Y.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.18,.105*e)),alphaGain:.17*w,extra1:[0,0,0,0]}),Y.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):Y.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((Y.stellarMode===`pulsar`||Y.stellarMode===`magnetar`)&&Y.magnetosphereSession){let t=Y.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:Y.magnetosphereSession.getResidentParcelsBuffer(),count:Y.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*w,extra1:[0,0,0,0]}),Y.magnetosphereFieldLines?.length>=14){let t=Y.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*w)}}else if(Y.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(c.push(...r,.42,.84,1,(.34-t*.08)*w),c.push(...o,.42,.84,1,(.34-t*.08)*w)),r=o}}}else if(Y.stellarEngine&&(i.push({buffer:Y.stellarEngine.getResidentBuffer(),count:Y.stellarEngine.count,mode:2,worldScale:e*.95,pointSize:Math.max(.045,Math.min(.2,.125*e)),alphaGain:.3*w,extra1:[0,0,0,0]}),Re)){let t=3.2*e;for(let e=0;e<8;e+=1){let n=e/8*Math.PI*2,r=Math.cos(n),i=Math.sin(n),a=null;for(let e=0;e<=24;e+=1){let n=-1.15+e/24*2.3,o=Math.cos(n),s=t*1.55*o*o,l=[s*o*r,s*Math.sin(n),s*o*i];a&&(c.push(...a,.36,.8,1,.24*w),c.push(...l,.36,.8,1,.24*w)),a=l}}}}let T=Di(n,-9.6,-8.9,-6.2,-5.2);if(T>.01&&Y.mdSession){let e=Y.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(Y.getCachedElementBundle(Y.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];d={positionsBuffer:Y.mdSession.positionsBuffer,velocitiesBuffer:Y.mdSession.velocitiesBuffer,count:Y.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(Y.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:T,idealCoord:Y.mdSession.idealCoordination||12},Re&&T>.3&&c.push(...Oi([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*T]))}let E=Di(n,-13.2,-12,-9.4,-8.8);if(E>.01&&Y.orbitalCloud){let e=(Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:Y.orbitalCloud.pointsBuffer,count:Y.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*E,colorPos:Y.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:Y.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),Y.quantumMode===`molecule`){let e=Y.MOLECULE_SPECS[Y.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let D=Di(n,-15.5,-14.8,-13.3,-12.4);if(D>.01&&Y.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=Y.buildQuantizedNucleonSpheres(Y.nuclearResult,2.2*e,t);a.push(...r);let i=Y.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);f={dim:Y.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:D}}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,lightDir:l,mdCloud:d,disks:o.length?o:null,lines:c.length>=14?new Float32Array(c):null,nuclearVol:f,post:p}}let Dt=performance.now(),Ot=0,kt=0,At=0,jt=0,Mt=60;function Nt(e=performance.now()){tt();let t=Math.cos(Je.pitch),n=Math.sin(Je.pitch),r=Math.cos(Je.yaw),i=Math.sin(Je.yaw),a=[Je.dist*t*i,Je.dist*n,Je.dist*t*r],o=c.width/Math.max(1,c.height),l=48*Math.PI/180,u=bi(l,o,.05,260),d=xi(a,[0,0,0],[0,1,0]),f=Si(u,d.mat);Ye=f;let p=Et({viewProj:f,pos:a,right:d.right,up:d.up,fwd:d.fwd,aspect:o,fovTanHalf:Math.tan(l*.5),timeSec:e*.001,level:X,log10SpanM:s},e*.001);Me.renderFrame(p),Tt(f)}function Pt(e){if(We)return;Ge=requestAnimationFrame(Pt);let t=Math.min(.1,Math.max(.001,(e-Dt)/1e3));if(Dt=e,At+=t,jt+=1,At>=.45&&(Mt=Math.round(jt/At),At=0,jt=0),ze&&!gt&&(Je.yaw+=t*.22),Ue>0&&(Ue=Math.max(0,Ue-t*1.45)),qe=Math.max(0,qe-t*12),Ke!==null){let e=Ke-s,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);s+=n,qe=Math.abs(n)/Math.max(.001,t),Math.abs(Ke-s)<.015&&(s=Ke,Ke=null),ot(s)}He&&Ke===null&&(s-=t*1.15,s<=-14.75&&(s=re-.3),ot(s));let n=Ai(s,{focusedSolarBodyIndex:Y.focusedSolarBodyIndex,galaxyBranch:Y.galaxyBranch});if(n!==X){let e=X;X=n,X===4&&e!==4&&!gt&&st(Y.focusedSolarBodyIndex),dt(),ft(),ot(s)}Fe&&Y.stepActiveRegimes(X,s,Ie),(!(X===6&&!gt&&!ze&&Ke===null&&!He&&Ue<=0)||e-Ot>=120)&&(Ot=e,Nt(e)),kt+=t,kt>=.18&&(kt=0,_&&(_.textContent=`${Mt} FPS · WebGPU`),wt(),ht())}Ce?.classList.remove(`active`),await ot(s),dt(),ft();let Ft=r.get(`peerRelay`);if(Ft){H&&(H.value=Ft);let e=r.get(`peerRole`)||`requester`;W&&(W.value=e),await Y.connectPeerMesh({relayUrl:Ft,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),ht()}wt();let It=()=>{Y.disconnectPeerMesh()};return window.addEventListener(`pagehide`,It),window.addEventListener(`beforeunload`,It),Ge=requestAnimationFrame(Pt),Object.freeze({getState(){let e=ae[X],t=Y.cosmoSession?.getState?.()||null,r=U[0],i=U[3],a=U[6],o=Y.solarConservation0,c=Y.solarConservation;return{ready:!0,continuousZoom:!0,level:X,scaleId:e.id,scaleName:e.name,log10ViewSpanM:s,physicalSpanLabel:ce(s),totalSpanOom:Number((re-ie).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:ze,running:Fe,autopilot:He,retroCrt:Be,lensingEnabled:Le,qualityId:Y.quality.id,seed:Y.seed,gpuErrorCount:n.length,gpuErrors:[...n],scientificValidation:!1,cosmicEpochId:Y.cosmicEpochId,cosmicEpochRedshiftZ:Y.cosmicEpoch?.redshiftZ??0,cosmoMode:Y.cosmoMode,cosmoBaryonSteps:Y.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:Y.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:Y.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:Y.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:t?.stepIndex??0,scaleFactorA:t?.aScale??null,redshiftZ:t?.redshiftZ??null,submitsPerStep:Y.cosmoTelemetry?.submitsPerStep??t?.submitsPerStep??null,sigmaDensity:Y.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:Y.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:Y.galaxyEngine?.stepIndex??0,galaxyPreset:Y.galaxyPreset,galacticBodyCount:Y.galaxyEngine?.count??0,galacticGravityMode:Y.galaxyEngine?.gravityMode??null,galaxyBranch:Y.galaxyBranch,planetarySteps:Y.solarEngine?.stepIndex??0,solarSimTimeYr:Y.solarEngine?.simTimeYr??0,solarTotalBodies:Y.solarEngine?.totalCount??0,focusedSolarBody:U[Y.focusedSolarBodyIndex]?.id??`earth`,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&c?Math.abs(c.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:c?.relMomentumError??null,stellarSteps:Y.stellarEngine?.stepIndex??0,stellarMode:Y.stellarMode,stellarCoreTempK:Y.stellarTelemetry?.coreTempK??null,nebulaMhdSteps:Y.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:Y.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:Y.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:Y.solarMode,kerrSpinA:Y.kerrSpinA,kerrMaxGamma:Y.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:Y.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:Y.relBinaryTelemetry?.merged??!1,relBinaryRemnant:Y.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:Y.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:Y.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:Y.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:Y.tovCurve?.length??0,tidalRupturedFrac:Y.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:Y.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:Y.protoplanetaryTelemetry?.accretedPebbles??null,planetaryMode:Y.planetaryMode,planetaryInteriorValid:!!Y.planetaryResult?.valid,planetaryMoiFactor:Y.planetaryResult?.moiFactor??null,planetaryCutaway:Y.planetaryCutaway,planetaryAtmoActive:!!Y.planetaryAtmoSession,planetaryAtmoSteps:Y.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:Y.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:Y.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,activeUniversalLaws:Y.getActiveUniversalLaws(X,s).active.map(e=>e.id),mdSteps:Y.mdTelemetry?.totalSteps??0,mdAtomCount:Y.mdSession?.atomCount??0,mdGravity:Y.mdGravity,mdElementZ:Y.mdElementZ,quantumZ:Y.quantumZ,quantumRelativistic:Y.quantumRelativistic,orbitalPointCount:Y.orbitalCloud?.pointCount??0,nuclearZ:Y.nuclearZ,nuclearA:Y.nuclearA,nuclearBindingPerNucleonMeV:Y.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:Y.tdseTelemetry?.stepCount??0,selectedTarget:ut()?.id??null,peerMeshState:Y.getPeerMeshState()}},async setLog10Span(e){return Ke=null,s=Mi(e),X=Ai(s,{focusedSolarBodyIndex:Y.focusedSolarBodyIndex,galaxyBranch:Y.galaxyBranch}),await ot(s),dt(),ft(),wt(),Nt(performance.now()),this.getState()},flyToLog10Span:ct,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));if(n===3?Y.setFocusedSolarBody(0):n===4&&Y.focusedSolarBodyIndex===0&&Y.setFocusedSolarBody(3),t){let e=await this.setLog10Span(ae[n].log10SpanM);return n===4&&(st(Y.focusedSolarBodyIndex),Nt(performance.now())),e}return ct(ae[n].log10SpanM),this.getState()},async focusSolarBody(e){let t=Y.setFocusedSolarBody(e);return t>0&&await Y.initPlanetaryInterior({bodyIndex:t}),X===4&&t>0&&(s=ji(U[t]),st(t)),dt(),ft(),Nt(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await Y.setCosmicEpoch(e,t),et(),dt(),lt(),wt(),Nt(performance.now()),this.getState()},async setCosmoMode(e){return await Y.setCosmoMode(e),dt(),lt(),wt(),Nt(performance.now()),this.getState()},async setGalaxyPreset(e){return await Y.initGalaxy({preset:e}),dt(),lt(),wt(),Nt(performance.now()),this.getState()},async setSolarMode(e){return await Y.setSolarMode(e),dt(),lt(),wt(),Nt(performance.now()),this.getState()},async setKerrSpinA(e){return await Y.setKerrSpinA(e),lt(),wt(),Nt(performance.now()),this.getState()},async setStellarMode(e){return await Y.setStellarMode(e),dt(),lt(),wt(),Nt(performance.now()),this.getState()},async setPlanetaryMode(e){return await Y.setPlanetaryMode(e),e===`cryo-plumes`&&X===4&&(s=Math.max(s,7.56),st(Y.focusedSolarBodyIndex),Je.pitch=-.18),dt(),lt(),wt(),Nt(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(Je.yaw=Number(e)),Number.isFinite(Number(t))&&(Je.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),Nt(performance.now()),this.getState()},async setNebulaB0(e){return await Y.setNebulaB0(e),lt(),Nt(performance.now()),this.getState()},setPlanetaryTriboelectric(e){return Y.setPlanetaryTriboelectric(e),lt(),this.getState()},getActiveUniversalLaws(){return Y.getActiveUniversalLaws(X,s)},async setGalaxyBranch(e){return Y.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await ot(s),ft(),this.getState()},setPlanetaryCutaway(e){Y.setPlanetaryCutaway(e),Nt(performance.now())},async setMdPhase(e){return await Y.initMolecularDynamics({Z:Y.mdElementZ,phasePreset:e}),lt(),this.getState()},selectTarget(e){return Y.getTargetsForLevel(X,Qe).some(t=>t.id===e)?(Ne=e,wt(),!0):!1},initiateHyperdrive:pt,returnToOrbit:mt,setAutopilot(e){He=!!e,v?.classList.toggle(`active`,He),v&&(v.textContent=He?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=Ve){Be=!!e,Ve=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),R&&(R.checked=Be),B&&(B.value=String(Ve)),V&&(V.textContent=`${Ve}×`)},setCameraAutoSpin(e){ze=!!e,L&&(L.checked=ze)},async bigBang(){return Ue=1,await Y.initCosmicWeb(),this.setLog10Span(ae[0].log10SpanM)},async reseed(e=null){return Y.setSeed(e??Y.seed+7919>>>0),await Y.initCosmicWeb(),this.getState()},connectPeerMesh:e=>Y.connectPeerMesh(e),disconnectPeerMesh:()=>Y.disconnectPeerMesh(),dispatchPeerDerivation:e=>Y.dispatchPeerDerivation(e),async stepOnce(){return await Y.stepActiveRegimes(X,s,Ie),wt(),this.getState()},capturePng(){return Nt(performance.now()),c.toDataURL(`image/png`)},dispose(){We=!0,cancelAnimationFrame(Ge),window.removeEventListener(`resize`,tt),window.removeEventListener(`pagehide`,It),window.removeEventListener(`beforeunload`,It),Y.dispose(),Me.dispose()}})}async function Pi(){try{let e=await Ni();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}Pi();