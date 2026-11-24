import{F as e,H as t,K as n,P as r,z as i}from"./eshkolTriadClosures-CAdZ5Pha.js";import{o as a}from"./materialFoundationAbi-FyZ8ey5s.js";import{n as o,o as s,t as c}from"./serviceContract-CmO1oQSS.js";import{t as l}from"./ArtifactCache-xlrx-gX-.js";import{t as u}from"./ClosureRegistry-DFBzDEUV.js";import{attachWebGpuUncapturedErrorTelemetry as d}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as f,createCachedExplicitBindGroup as p,createCachedExplicitComputePipeline as m}from"../runtime/webgpuComputeLayout.js";import{Er as h,K as g,Or as _,Tt as v,Xt as y,cr as b,jr as x,n as S,o as C,r as w,ta as T,un as E}from"./three.webgpu-Dqv7Ot6G.js";import{r as D}from"./nuclearStructureGpu-C34Rg1Np.js";import{t as O}from"./radiationClosure-DhdgDtJ8.js";import{a as k,c as A,n as j}from"./simulationModuleRegistry-B9GELnPw.js";import{a as M,l as N,m as P,n as F,p as I,r as L,s as R}from"./scaleAtlasAstrophysicsGravityBridge-DOfo92I6.js";import{t as z}from"./schroederScaleAtlasMultipoleGpu-DeB9nt2y.js";var B=`ulg.astrophysics.stellar-nuclear-network.v1`;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var ee=-.7823334099999784,V=1602176634e-22,H=167262192369e-38,U=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),W=null;function te(){if(W)return W;let e=U.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+D(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+D(t,n)*r,0),s=r-i,c=o-a+s*ee,l=Number(e.neutrinoLossMeV||0),u=c>0?Math.max(0,c-l):c,d=Math.abs(u)*V/(t*H);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:s,ignitionTempK:e.ignitionTempK,qValueMeV:c,qValueTotalMeV:c,qValueThermalMeV:u,neutrinoLossMeV:l,qValueJPerKg:d,exothermic:c>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return W=Object.freeze({schema:B,channels:Object.freeze(e),byId:t,accuracyTier:a.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),W}function ne(){let{byId:e}=te();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var re=`peercompute.ulg.hydrogen-stellar-closure.v1`,G=`peercompute.ulg.stellar-closure-table-abi.v1`,K=1380649e-29,ie=16605390666e-37,q=167262192369e-38,ae=91093837015e-41,oe=1054571817e-43,J=299792458,Y=66743e-15,se=4*5.670374419e-8/J,X=1602176634e-28,Z=27.211386245988,ce=198847e25,le=ne();le.ppThermalMeV;var ue=le.ppJPerKgH;le.tripleAlphaMeV;var de=le.tripleAlphaJPerKgHe;le.fePhotodisMeV;var Q=null;async function fe(n,{forceRecompute:r=!1}={}){if(!n||typeof n.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Q?.backend===`webgpu`&&!r)return Q;let a=await A(n,1,{A:1,maxScf:45}),o=Number(a.totalEnergyHa??-.5),s=Number(a.homoEnergyHa??a.orbitals?.[0]?.energyHa??-.5),c=Math.max(11,Math.min(15,Math.abs(o)*Z)),l=await k(n,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),u=.05,d=await k(n,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:l.densityMatrix}),f=await k(n,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-u]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:l.densityMatrix}),p=2*o,m=Math.max(.08,p-l.totalEnergyHa)*Z,h=Math.max(.1,(d.totalEnergyHa-2*l.totalEnergyHa+f.totalEnergyHa)/(u*u)),g=Math.sqrt(h/(.5*1836.152673))*Z*X/K,_=t(15e4/q*e**3),v=i(_);return Q=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:o,h1sOrbitalEnergyHa:s,hIonizationEv:c,hIonizationTempK:c*X/K,h2EqEnergyHa:l.totalEnergyHa,h2DissEnergyHa:p,h2DiradicalStretched:1,h2DissociationEv:m,h2DissociationTempK:m*X/K,h2VibrationalTempK:g,uegSolarCoreRsBohr:_,uegSolarCoreKineticHa:v,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Q}function pe({forceRecompute:a=!1}={}){if(Q&&!a)return Q;let o=r(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),s=o.orbitals?.[0]?.energyHa??-.5,c=Math.max(11,Math.min(15,Math.abs(o.totalEnergyHa)*Z)),l=n([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),u=n([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),d=Math.max(.08,u.totalEnergyHa-l.totalEnergyHa)*Z,f=.04,p=n([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=n([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=n([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-f]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(f*f)),_=Math.sqrt(g/(.5*1836.152673))*Z*X/K,v=t(15e4/q*e**3),y=i(v);return Q=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:o.totalEnergyHa,h1sOrbitalEnergyHa:s,hIonizationEv:c,hIonizationTempK:c*X/K,h2EqEnergyHa:l.totalEnergyHa,h2DissEnergyHa:u.totalEnergyHa,h2DiradicalStretched:u.diradicalCharacter,h2DissociationEv:d,h2DissociationTempK:d*X/K,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Q}function me(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/q);if(n<=0)return 0;let r=oe*Math.cbrt(3*Math.PI*Math.PI*n)/(ae*J),i=r*r,a=ae**4*J**5/(24*Math.PI*Math.PI*oe**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function he(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function ge({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||pe(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/q,m=s*d/(4*q),h=s*f/(16*q),g=2*Math.PI*q*K*c/(2*Math.PI*oe)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*ae*K*c/(2*Math.PI*oe)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/ie/A,M=A*K*c,N=se/3*c**4,P=me(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),F=he(s),I=M+N+P+F,L=P/Math.max(1e-30,I),R=N/Math.max(1e-30,I),z=F/Math.max(1e-30,I),B=4*b*(1-b),ee=4*w*(1-w),V=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,H=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),U=H*(1-R)+4/3*R,W=Math.max(1.06,U-.5*B-.48*ee-V)*(1-z)+2.75*z,te=.1*(1/(1+Math.exp((c-1600)/180))),ne=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),G=4e21*(1+u)*(f+.001)*s*c**-3.5,J=.02*(1+u)*Math.max(.01,w),Y=Math.max(1e-4,Math.min(1e5,te+ne+G+J)),Z=M/(Math.max(.15,H-1)*s)+3*N/s,ce=(1-b)*.5*u*o.h2DissociationEv*X/q,le=w*u*o.hIonizationEv*X/q,ue=Z+ce+le;return{schema:re,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:W,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:P,pressureNucSatPa:F,pressureTotalPa:I,pDegFraction:L,pRadFraction:R,pNucFraction:z,soundSpeedMPerS:Math.sqrt(Math.max(1,W*I/s)),kappaM2PerKg:Y,specificEnergyJPerKg:ue,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function _e({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/ue),E=Math.min(d+T,x*a/de),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*Y*e*ce/(J*J),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function ve(e){let t=O(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function ye({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function be({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||pe(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=ge({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:G,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function xe({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=be({anchors:t?await fe(t):pe()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:G,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Se=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,Ce=128,$=32,we=$*$*$,Te=we*8,Ee=`
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

const HYDRO_DIM: u32 = ${$}u;
const HYDRO_COUNT: u32 = ${we}u;

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
`;function De(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=ge({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=_e({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=ye({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=ve(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function Oe({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,baseLogRho:o=-16.2,refRhoSim:s=.08,burnTimescaleS:c=42e13,tScaleK:l=78e4,label:u=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let d=Float32Array.from(t),h=d.length/16,g=n||be({nRho:28,nTemp:40});function _(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let v=_(d),y=0,b=0,x=!1,S=!1;function C(e){let t=1.2,n=o,r=0,i=0,a=0,s=0;for(let o=0;o<h;o+=1){let c=o*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],s+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(s*1e3),c[10]=1,c[11]=Math.round(s/h*1e3),c[12]=Math.round(i/h*1e3),c[15]=1667,De(c,h,v,!1)}let w=C(d),T=Math.max(64,d.byteLength),E=[e.createBuffer({label:`${u}-p0`,size:T,usage:172}),e.createBuffer({label:`${u}-p1`,size:T,usage:172})],D=z(e,{maxCount:h,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:.075,label:`${u}-ss-atlas`}),O=ne(),k=e.createBuffer({label:`${u}-hydro-accum`,size:Te*4,usage:Ce}),A=e.createBuffer({label:`${u}-hydro-grid`,size:we*2*16,usage:Ce}),j=e.createBuffer({label:`${u}-eos-table`,size:g.data.byteLength,usage:136}),M=e.createBuffer({label:`${u}-telemetry`,size:64,usage:132}),N=e.createBuffer({label:`${u}-telemetry-staging`,size:64,usage:9}),P=e.createBuffer({label:`${u}-params`,size:96,usage:72}),F=e.createBuffer({label:`${u}-body-staging`,size:T,usage:9});e.queue.writeBuffer(E[0],0,d),e.queue.writeBuffer(E[1],0,d),e.queue.writeBuffer(j,0,g.data);let I=[f(0,`read-only-storage`),f(1,`storage`),f(2,`storage`),f(3,`read-only-storage`),f(4,`storage`),f(5,`read-only-storage`),f(6,`storage`),f(7,`uniform`)],L=t=>m(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v16-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:Ee,entryPoint:t,bindings:I}),R={clear:L(`sgh_clear`),deposit:L(`sgh_deposit`),finalize:L(`sgh_finalize`),integrate:L(`sgh_integrate`)},B=(t,n,r)=>p(e,{layout:R.integrate.bindGroupLayout,label:`${u}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:D.accPhiBuffer}},{binding:4,resource:{buffer:A}},{binding:5,resource:{buffer:j}},{binding:6,resource:{buffer:M}},{binding:7,resource:{buffer:P}}]}),ee=[B(E[0],E[1],0),B(E[1],E[0],1)],V=0,H=!1,U=!1,W=!0;async function te(){if(!E||!F||U||S)return d;U=!0;try{let t=e.createCommandEncoder({label:`${u}-readback`});t.copyBufferToBuffer(E[V],0,F,0,d.byteLength),e.queue.submit([t.finish()]),await F.mapAsync(1),d.set(new Float32Array(F.getMappedRange())),F.unmap()}finally{U=!1}return d}async function re({dt:t=.018,timeAccel:n=1,readTelemetry:d=!0}={}){if(S||!E)return w;let f=Math.max(.25,Math.min(25,Number(n)||1)),p=Math.max(.004,Math.min(.028,Number(t)||.018)),m=1380649e-29/167262192369e-38*1.5*l,_=new ArrayBuffer(96),C=new Uint32Array(_),T=new Float32Array(_);C[0]=h,C[1]=g.nRho,C[2]=g.nTemp,C[3]=+!!W,T[4]=p,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=g.logRhoMin,T[10]=g.logRhoMax,T[11]=g.logTempMin,T[12]=g.logTempMax,T[13]=o,T[14]=s,T[15]=c,T[16]=f,T[17]=l,T[18]=O.ppJPerKgH,T[19]=O.tripleAlphaJPerKgHe,T[20]=O.fePhotodisJPerKgFe,T[21]=m,e.queue.writeBuffer(P,0,_),D.writeParams({count:h,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let k=V,A=1-V,j=ee[k],F=Math.ceil(h/64),I=Math.ceil(we/64),L=e.createCommandEncoder({label:`${u}-step-${y}`}),z=L.beginComputePass({label:`${u}-pass`});D.encodeIntoPass(z,{srcBuffer:E[k],count:h}),z.setPipeline(R.clear.pipeline),z.setBindGroup(0,j),z.dispatchWorkgroups(I),z.setPipeline(R.deposit.pipeline),z.setBindGroup(0,j),z.dispatchWorkgroups(F),z.setPipeline(R.finalize.pipeline),z.setBindGroup(0,j),z.dispatchWorkgroups(I),z.setPipeline(R.integrate.pipeline),z.setBindGroup(0,j),z.dispatchWorkgroups(F),z.end();let B=d&&!H;if(B&&L.copyBufferToBuffer(M,0,N,0,64),W=B,e.queue.submit([L.finish()]),V=A,y+=1,b+=p*f*.35,B){H=!0;try{await N.mapAsync(1);let e=new Uint32Array(N.getMappedRange().slice(0));N.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=25e7&&(x=!0),w=De(e,h,v,x)}finally{H=!1}}return w}function G(t){return d=Float32Array.from(t),v=_(d),y=0,b=0,x=!1,V=0,W=!0,w=C(d),E&&(e.queue.writeBuffer(E[0],0,d),e.queue.writeBuffer(E[1],0,d)),w}function K(){S||(S=!0,E?.[0]?.destroy(),E?.[1]?.destroy(),D.destroy(),k.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),P.destroy(),F.destroy(),E=null)}return{schema:Se,get count(){return h},get totalMassSolar(){return v},get stepIndex(){return y},get simTimeMyr(){return b},get backend(){return`webgpu`},get gravityMode(){return D.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return O},get closureTable(){return g},get anchors(){return g.anchors},getTelemetry:()=>w,getBodies:()=>d,getResidentBuffer:()=>E?E[V]:null,readbackBodies:te,step:re,resetBodies:G,dispose:K}}function ke({engine:e,zeroCopy:t=!0}){let n={tensorId:`hydro_particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`mass`,`vx`,`vy`,`vz`,`hSmooth`,`log10T`,`log10Rho`,`xH`,`log10EpsNuc`,`fMol`,`xIon`,`xHe`,`xZ`]};return{method:{model:`self-gravitating-hydro`,version:1},kernel:{sourceModule:`src/runtime/sph/selfGravitatingHydroGpu.js`,entryPoint:`sgh_integrate`,wgsl:Ee,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:0,required:!0},timeAccel:{type:`number`,min:.1,required:!1},readTelemetry:{type:`boolean`,required:!1}},stateLayout:n,scaleRangeM:[1e-11,0x16345785d8a0000],async stepCapsule(r,{createSimulationArtifact:i,leaseSession:a}){let o=e.stepIndex,s=r.input?.parameters||{},l=await e.step(s),u=e.stepIndex;a.publishBuffer({resourceKey:`hydro_particles`,buffer:e.getResidentBuffer(),destroyFn:()=>!0,byteLength:e.count*64,rowCount:e.count,layout:n,stepIndex:u,portableSnapshotFn:async()=>Float32Array.from(await e.readbackBodies())});let d=a.borrowBufferReadLease({resourceKey:`hydro_particles`,consumerStage:`resident-gpu-presenter`,reason:t?`zero-copy-gpu-vertex-lease`:`cpu-instanced-render-lease`});return{artifact:i({artifactId:`${r.taskId}:self-gravitating-hydro:${u}`,taskKind:r.taskKind,closureRef:{module:`src/runtime/sph/selfGravitatingHydroGpu.js`,entryPoint:e.solverMode},representation:`self-gravitating-hydro-f32-64b`,outputs:{deltas:[{operation:`replace`,tensorId:`hydro_particles`,fromStep:o,toStep:u}],telemetry:l},execution:{backend:e.backend,stage:`self-gravitating-hydro.step`,placement:`local`,solverMode:e.solverMode,zeroCopyParticleReadbackBytes:t?0:e.count*64},validity:{finite:Number.isFinite(l.coreTempK)&&Number.isFinite(l.coreRhoKgM3),particleCount:e.count,nucleonSum:l.nucleonSum},validation:{status:`pass`,validationMode:`finite-output`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...r.provenance,sourceService:c.ulgRuntime,methodHash:r.methodHash,inputHash:r.inputHash}}),leaseHandle:d}}}}var Ae=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function je(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Me({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=Ae[t]||Ae[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=je(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0;if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let C=Math.hypot(r-S,i,v),w=Math.exp(-C*C/12),T=g+w*1,E=h+w*.1,D=.32+.04*Math.min(6,C);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=D,s[t+8]=E,s[t+9]=T,s[t+10]=.74,s[t+11]=-30,s[t+12]=.998,s[t+13]=0,s[t+14]=.25,s[t+15]=.01}return s}var Ne=Object.freeze([{id:`quantum-core`,log10:-10.8,label:`10⁻¹¹m Quantum H₂ / H`},{id:`stellar-core`,log10:9.2,label:`10⁹m Stellar Core`},{id:`protoplanetary-disk`,log10:12.6,label:`10¹²m Disk & Envelope`},{id:`molecular-nebula`,log10:16.4,label:`10¹⁷m Molecular Nebula`}]),Pe=Object.freeze({"molecular-nebula":`#a78bfa`,"larson-core":`#fb923c`,"h2-dissociation":`#f97316`,"saha-protostar":`#fbbf24`,"fusion-ignition":`#fde047`,"main-sequence":`#fef08a`,"helium-burning":`#fb7185`,supernova:`#22d3ee`,"neutron-star":`#38bdf8`,"black-hole":`#c084fc`});function Fe(t){return!(t>0)||!Number.isFinite(t)?`—`:t<1e-9?`${(t*0xe8d4a51000).toFixed(1)} pm (${(t/e).toFixed(2)} a₀)`:t<1e-6?`${(t*1e9).toFixed(2)} nm`:t<1e3?`${t.toFixed(1)} m`:t<1e9?`${(t/1e3).toFixed(0)} km`:t<0xe8d4a51000?`${(t/6957e5).toFixed(1)} R☉`:t<0x38d7ea4c68000?`${(t/149597870700).toFixed(1)} AU`:`${(t/9460730472580800).toFixed(2)} ly`}function Ie(e){return Number.isFinite(e)?e<1e4?`${Math.round(e).toLocaleString()} K`:e<1e6?`${(e/1e3).toFixed(1)}×10³ K`:e<1e9?`${(e/1e6).toFixed(2)} MK`:`${(e/1e9).toFixed(2)} GK`:`—`}function Le(e,t=``){if(!Number.isFinite(e))return`—`;if(e===0)return`0${t?` `+t:``}`;let n=Math.floor(Math.log10(Math.abs(e)));return`${(e/10**n).toFixed(2)}×10^${n}${t?` `+t:``}`}function Re(e){let t=Math.max(10,e?.coreTempK||25),n=t*8.617333262e-8,r=e?.gamowPeakKeV>0?e.gamowPeakKeV:1.22*Math.max(1e-4,t*1e-6)**(2/3);if(!(t>=12e5))return`<svg viewBox="0 0 286 84" style="width:100%;height:84px;display:block;background:rgba(4,10,20,0.82);border-radius:7px;border:1px solid rgba(148,163,184,0.22);">
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
    <text x="10" y="81" fill="#94a3b8" font-size="8" font-family="monospace">kT=${n.toFixed(2)} keV · ε=${Le(e.peakEpsNucWPerKg,`W/kg`)}</text>
  </svg>`}function ze(){let e=1100,t=new E(new _(.32,0),new b({color:16777215}),e);t.frustumCulled=!1;let n=new h,r=new g,i=88421,a=()=>(i=Math.imul(i,1664525)+1013904223>>>0,i/4294967296);for(let i=0;i<e;i+=1){let e=a()*2-1,o=a()*Math.PI*2,s=Math.sqrt(Math.max(0,1-e*e)),c=140+a()*110;n.position.set(c*s*Math.cos(o),c*e,c*s*Math.sin(o)),n.scale.setScalar(.35+a()*.85),n.updateMatrix(),t.setMatrixAt(i,n.matrix);let l=a();r.setRGB(l>.7?.96:.65,l>.3?.84:.72,1),t.setColorAt(i,r)}return t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t}async function Be(e){let t=document.createElement(`div`);t.id=`ulg-stellar-genesis-root`,t.style.cssText=[`position:fixed`,`inset:0`,`background:#03060f`,`color:#e2f1ec`,`font-family:"Inter",system-ui,-apple-system,sans-serif`,`overflow:hidden`,`user-select:none`].join(`;`),e.innerHTML=``,e.appendChild(t);let n=document.createElement(`div`);n.style.cssText=`position:absolute;inset:0;`,t.appendChild(n);let r=new URLSearchParams(window.location.search),i=Ae[r.get(`preset`)]?r.get(`preset`):`solar-nebula`,a=r.get(`scale`),f=a!==null&&Number.isFinite(Number(a))?Number(a):16,p=f,m=Number(r.get(`speed`))||4;(!Number.isFinite(m)||m<.5||m>25)&&(m=4);let h=r.get(`paused`)!==`1`,g=null,_=`WebGPU unavailable`;try{let e=await navigator.gpu?.requestAdapter?.({powerPreference:`high-performance`});e&&(g=await e.requestDevice(),d(g,{label:`stellar-genesis-demo`}),_=e.info?.description||e.info?.vendor||`WebGPU GPU`)}catch{g=null}if(!g)return t.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;">
        <div style="max-width:460px;padding:20px 24px;border-radius:12px;background:rgba(12,18,32,0.92);border:1px solid rgba(248,113,113,0.45);color:#fecaca;">
          <h2 style="margin:0 0 8px 0;font-size:16px;">WebGPU Required</h2>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#e2e8f0;">
            Stellar Genesis executes ULG's GPU-native <code>self-gravitating-hydro@1</code> solver with zero-copy WebGPU presentation. Enable WebGPU in a supported browser to run this simulation.
          </p>
        </div>
      </div>`,null;let b=new S({antialias:!0,device:g});b.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),b.setSize(window.innerWidth,window.innerHeight),b.setClearColor(198159,1),b.toneMapping=4,b.toneMappingExposure=1.24,await b.init();let E=`three-webgpu`;n.appendChild(b.domElement);let D=!!b.isWebGPURenderer,O=await xe({closureRegistry:new u({artifactCache:new l}),device:g}),k=new URLSearchParams(window.location.search).get(`cameraAutoSpin`)===`1`,A=Me({count:8192,preset:i,seed:1939}),z=Oe({device:g,initialBodies:A,eosClosureTable:O.table,label:`ulg-stellar-genesis-sgh`}),B=j();B.registerModule(ke({engine:z,zeroCopy:D}));let ee=M({moduleRegistry:B}),V=new T,H=new x(48,window.innerWidth/window.innerHeight,.01,600),U=.55,W=.34,te=new C(9156313,.72),ne=new v(16774364,1.7);ne.position.set(16,20,14),V.add(te,ne),V.add(ze());let re=new y;V.add(re);let G=I({THREE:w,TSL:P,renderer:b,bodyCount:z.count,strideFloats:16,palette:`blackbody-thermo`,initialBuffer:z.getResidentBuffer()});re.add(G.mesh);let K=new y;K.visible=!1,V.add(K);let ie=R(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:360,cloudGridDim:16,maxGridDim:24}).artifact,q=L({THREE:w,TSL:P,renderer:b,radialSamples:ie.radialProfile.samples||[],rMaxBohr:ie.radialProfile.rMaxBohr||8,r95Bohr:ie.summary.containmentRadii.r95Bohr||3.2,modeId:`total-density`,boxHalfExtent:4.8,dim:40});K.add(q.mesh);let ae=N([{Z:1,position:[-.7,0,0]},{Z:1,position:[.7,0,0]}],{formula:`H2`,basis:`6-31g`,gridDim:20}),oe=ae.artifact.grid.payloadHandles.chargeDensity.key,J=F({THREE:w,TSL:P,renderer:b,densityGrid:ae.densePayloads[oe],dimensions:ae.artifact.grid.dimensions,boxHalfExtent:4.8,provenance:`molecular-rhf-h2-charge-density`});K.add(J.mesh);let Y=document.createElement(`div`);Y.style.cssText=`position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;pointer-events:none;z-index:10;`,Y.innerHTML=`
    <div style="pointer-events:auto;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:rgba(5,11,22,0.86);border:1px solid rgba(56,189,248,0.30);backdrop-filter:blur(10px);">
      <span id="sg-stage-dot" style="width:10px;height:10px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa;"></span>
      <div>
        <div id="sg-stage-title" style="font-size:13px;font-weight:700;letter-spacing:0.01em;color:#f8fafc;">Cold Molecular H₂ Nebula</div>
        <div id="sg-scale-readout" style="font-size:11px;font-family:monospace;color:#7dd3fc;">10^16.0 m · self-gravitating-hydro@1</div>
      </div>
    </div>
    <div style="pointer-events:auto;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
      ${Object.values(Ae).map(e=>`<button type="button" data-sg-preset="${e.id}" style="padding:7px 11px;border-radius:8px;border:1px solid ${e.id===i?`#38bdf8`:`rgba(148,163,184,0.3)`};background:${e.id===i?`rgba(14,116,144,0.45)`:`rgba(10,18,32,0.86)`};color:#f0f9ff;font-size:12px;font-weight:600;cursor:pointer;">${e.shortLabel}</button>`).join(``)}
      <button id="sg-speed-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(6,40,36,0.84);color:#6ee7b7;font-size:12px;font-weight:600;font-family:monospace;cursor:pointer;">${m}×</button>
      <button id="sg-play-btn" type="button" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;">${h?`⏸ Pause`:`▶ Play`}</button>
      <button id="sg-reset-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;">↺ Reset</button>
      <a href="./cosmic-quantum.html" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(94,234,212,0.4);background:rgba(14,42,46,0.85);color:#99f6e4;font-size:12px;font-weight:600;text-decoration:none;">Cosmic ↔ Quantum ↗</a>
      <a href="./" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:rgba(38,24,10,0.85);color:#fde68a;font-size:12px;font-weight:600;text-decoration:none;">SPH Lab ↗</a>
    </div>
  `,t.appendChild(Y);let se=document.createElement(`aside`);se.id=`sg-inspector`,se.style.cssText=`position:absolute;top:72px;right:16px;width:336px;max-height:calc(100vh - 176px);overflow-x:hidden;overflow-y:auto;word-break:break-word;padding:13px 14px;border-radius:12px;background:rgba(5,11,22,0.86);border:1px solid rgba(148,186,210,0.24);backdrop-filter:blur(12px);font-size:12px;line-height:1.45;z-index:10;display:flex;flex-direction:column;gap:9px;`,t.appendChild(se);let X=document.createElement(`div`);X.style.cssText=`position:absolute;left:16px;right:16px;bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(5,11,22,0.88);border:1px solid rgba(56,189,248,0.24);backdrop-filter:blur(10px);z-index:10;display:flex;flex-direction:column;gap:8px;`,X.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m (H₂ / H)</span>
      <input id="sg-zoom-slider" type="range" min="-11.0" max="16.8" step="0.05" value="${p}" style="flex:1;accent-color:#38bdf8;cursor:pointer;" />
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10¹⁷ m (Nebula)</span>
    </div>
    <div id="sg-zoom-pills" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;"></div>
  `,t.appendChild(X);let Z=X.querySelector(`#sg-zoom-pills`),ce=new Map;for(let e of Ne){let t=document.createElement(`button`);t.type=`button`,t.dataset.sgZoom=e.id,t.textContent=e.label,t.style.cssText=`flex:1;min-width:130px;padding:5px 8px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(10,20,34,0.78);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;`,t.addEventListener(`click`,()=>{f=e.log10}),Z.appendChild(t),ce.set(e.id,t)}let le=Y.querySelector(`#sg-stage-dot`),ue=Y.querySelector(`#sg-stage-title`),de=Y.querySelector(`#sg-scale-readout`),Q=Y.querySelector(`#sg-speed-btn`),fe=Y.querySelector(`#sg-play-btn`),pe=Y.querySelector(`#sg-reset-btn`),me=X.querySelector(`#sg-zoom-slider`);function he(){for(let e of Y.querySelectorAll(`[data-sg-preset]`)){let t=e.dataset.sgPreset===i;e.style.borderColor=t?`#38bdf8`:`rgba(148,163,184,0.3)`,e.style.background=t?`rgba(14,116,144,0.45)`:`rgba(10,18,32,0.86)`}}function ge(e){if(!Ae[e])return;i=e;let t=Me({count:z.count,preset:i,seed:1939});z.resetBodies(t),G.bindResidentBuffer(z.getResidentBuffer()),he(),Se()}for(let e of Y.querySelectorAll(`[data-sg-preset]`))e.addEventListener(`click`,()=>ge(e.dataset.sgPreset));let _e=[1,4,12];Q.addEventListener(`click`,()=>{m=_e[(_e.findIndex(e=>Math.abs(e-m)<.25)+1)%_e.length],Q.textContent=`${m}×`}),fe.addEventListener(`click`,()=>{h=!h,fe.textContent=h?`⏸ Pause`:`▶ Play`}),pe.addEventListener(`click`,()=>ge(i)),me.addEventListener(`input`,()=>{f=Number(me.value)});let ve=!1,ye=0,be=0;b.domElement.addEventListener(`pointerdown`,e=>{ve=!0,ye=e.clientX,be=e.clientY}),window.addEventListener(`pointerup`,()=>{ve=!1}),window.addEventListener(`pointermove`,e=>{ve&&(U-=(e.clientX-ye)*.006,W=Math.max(-1.25,Math.min(1.25,W+(e.clientY-be)*.006)),ye=e.clientX,be=e.clientY)}),b.domElement.addEventListener(`wheel`,e=>{e.preventDefault(),f=Math.max(-11,Math.min(16.8,f+e.deltaY*.004))},{passive:!1});function Se(){let e=z.getTelemetry(),t=z.anchors,n=Ae[i],r=ee.evaluateContinuousZoomCamera(p),a=G.getStats(),o=Pe[e.stage.id]||`#38bdf8`;le.style.background=o,le.style.boxShadow=`0 0 12px ${o}`,ue.textContent=e.stage.label,de.textContent=`10^${p.toFixed(1)} m (${Fe(10**p)}) · Chart L=${r.primaryRegime.globalBaseLevel} · ${z.totalMassSolar.toFixed(1)} M☉`;let s=Math.max(0,Math.min(100,e.coreXH*100)),c=Math.max(0,Math.min(100-s,e.coreXZ*100)),l=Math.max(0,100-s-c),u=e.coreGammaEff<4/3,d=e.supernovaTriggered?`<div style="padding:6px 8px;border-radius:6px;background:rgba(192,132,252,0.16);border:1px solid rgba(192,132,252,0.45);font-family:monospace;font-size:11px;color:#e9d5ff;">
          <b>REMNANT:</b> ${e.remnantClass===`black-hole`?`Stellar Black Hole`:`Neutron Star`} · r_s=${(e.schwarzschildRadiusM/1e3).toFixed(1)} km · Bounce pts=${e.nuclearBounceCount}
        </div>`:``;se.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;letter-spacing:0.04em;font-size:11px;text-transform:uppercase;color:#94a3b8;">General ULG Runtime Laws</span>
        <span style="padding:2px 6px;border-radius:4px;background:rgba(56,189,248,0.16);color:#7dd3fc;font-family:monospace;font-size:10px;">${z.count.toLocaleString()} pts</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.4;">${n.description}</div>
      ${d}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:11px;color:#cbd5e1;line-height:1.55;">
        <div style="color:#5eead4;font-weight:700;margin-bottom:2px;">Live Emergent Core State</div>
        Core T: <span style="color:${o};font-weight:700;">${Ie(e.coreTempK)}</span> · ρ: ${Le(e.coreRhoKgM3,`kg/m³`)}<br/>
        γ_eff: <span style="color:${u?`#fb923c`:`#6ee7b7`};font-weight:700;">${e.coreGammaEff.toFixed(2)}${u?` (<4/3 COLLAPSE)`:``}</span> · μ=${e.coreMu.toFixed(2)}<br/>
        Core H₂: ${(e.coreFH2*100).toFixed(1)}% · Ionized H⁺: ${(e.coreXIonized*100).toFixed(1)}%<br/>
        Fusing pts: <span style="color:#fde047;">${e.fusingCount.toLocaleString()}</span> · P_deg/P: ${(e.corePDegFraction*100).toFixed(1)}%
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:3px;">
          <span>Core Nucleons (Σ=${e.nucleonSum.toFixed(4)})</span>
          <span>H ${s.toFixed(0)}% · He ${l.toFixed(0)}% · Z ${c.toFixed(0)}%</span>
        </div>
        <div style="height:8px;border-radius:4px;overflow:hidden;display:flex;background:#0f172a;border:1px solid rgba(148,163,184,0.25);">
          <div style="width:${s.toFixed(1)}%;background:#38bdf8;"></div>
          <div style="width:${l.toFixed(1)}%;background:#fbbf24;"></div>
          <div style="width:${c.toFixed(1)}%;background:#c084fc;"></div>
        </div>
      </div>
      ${Re(e)}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:10.5px;color:#94a3b8;line-height:1.5;">
        <div style="color:#a5b4fc;font-weight:700;margin-bottom:2px;">Composed ULG Subsystems</div>
        Module: <span style="color:#7dd3fc;">self-gravitating-hydro@1</span> (preset-free)<br/>
        ClosureRegistry: <span style="color:#6ee7b7;">${O.artifact.closureId}</span><br/>
        Anchors: KS-PBE I_H=${t.hIonizationEv.toFixed(2)} eV · CAS(2,2) D_e=${t.h2DissociationEv.toFixed(2)} eV<br/>
        Presenter: ${a.zeroCopy?`zero-copy GPU (0 B/frame)`:`fallback`} · ${E} (${_})<br/>
        Governance: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
    `}function Ce(e){let t=Math.max(0,Math.min(1,(-3-p)/5.5));if(re.visible=t<.96,K.visible=t>.04,re.visible){let e=6.2+Math.max(0,Math.min(1,(p-8.5)/8.3))*16.5;H.position.set(Math.cos(W)*Math.sin(U)*e,Math.sin(W)*e,Math.cos(W)*Math.cos(U)*e),H.lookAt(0,0,0)}else{let t=11.2;H.position.set(Math.cos(W)*Math.sin(U)*t,Math.sin(W)*t,Math.cos(W)*Math.cos(U)*t),H.lookAt(0,0,0);let n=e.coreFH2>=.5;J.mesh.visible=n,q.mesh.visible=!n}let n=Ne[0],r=1/0;for(let e of Ne){let t=Math.abs(e.log10-p);t<r&&(r=t,n=e)}for(let[e,t]of ce.entries()){let r=e===n.id;t.style.borderColor=r?`#38bdf8`:`rgba(148,163,184,0.25)`,t.style.background=r?`rgba(14,116,144,0.42)`:`rgba(10,20,34,0.78)`,t.style.color=r?`#f0f9ff`:`#cbd5e1`}me.value=String(p.toFixed(2))}let $=!1;async function we(e=null){if(!($||Ee)){$=!0;try{let t=s({taskId:`sgh-${i}-${z.stepIndex}`,serviceId:c.ulgRuntime,taskKind:o.simulationStep,method:{model:`self-gravitating-hydro`,version:1},input:{stepIndex:z.stepIndex,parameters:{dt:.018,timeAccel:e??m,readTelemetry:z.stepIndex%4==0||e!==null}}}),n=await B.dispatchSimulationStepCapsule(t,{device:g});G.bindLeaseHandle(n.leaseHandle),n.leaseHandle?.release?.()}finally{$=!1}}}let Te=0,Ee=!1,De=0;function je(){H.aspect=window.innerWidth/window.innerHeight,H.updateProjectionMatrix(),b.setSize(window.innerWidth,window.innerHeight)}window.addEventListener(`resize`,je),Se();function Be(){Ee||(Te=requestAnimationFrame(Be),p+=(f-p)*.14,k&&!ve&&(U+=.0018),h&&!$&&we(),Ce(z.getTelemetry()),De%10==0&&Se(),De+=1,b.render(V,H))}Te=requestAnimationFrame(Be);let Ve={getState(){return{presetId:i,moduleModel:`self-gravitating-hydro@1`,gravityMode:z.gravityMode,cameraAutoSpin:k,closureId:O.artifact.closureId,backend:z.backend,rendererBackend:E,zeroCopy:G.zeroCopy,readbackBytesPerFrame:G.readbackBytesPerFrame,particleCount:z.count,totalMassSolar:z.totalMassSolar,stepIndex:z.stepIndex,simTimeMyr:z.simTimeMyr,log10SpanM:p,timeScale:m,simRunning:h,telemetry:z.getTelemetry(),anchors:z.anchors,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}},selectPreset(e){return ge(e),Ve.getState()},setLog10Span(e){return f=Math.max(-11,Math.min(16.8,Number(e))),p=f,Ce(z.getTelemetry()),Se(),Ve.getState()},setTimeScale(e){return m=Math.max(.5,Math.min(25,Number(e)||4)),Q.textContent=`${m}×`,m},setPlaying(e){return h=!!e,fe.textContent=h?`⏸ Pause`:`▶ Play`,h},async stepMany(e=40,t=6){let n=h;for(h=!1;$;)await new Promise(e=>setTimeout(e,8));for(let n=0;n<e;n+=1)await we(t);return h=n,Ce(z.getTelemetry()),Se(),b.render(V,H),Ve.getState()},reset(){return ge(i),Ve.getState()},dispose(){Ee||(Ee=!0,cancelAnimationFrame(Te),window.removeEventListener(`resize`,je),G.dispose(),q.dispose(),J.dispose(),z.dispose(),b.dispose?.())}};return globalThis.__ulgStellarGenesisDemo=Ve,Ve}Be(document.getElementById(`stellar-genesis-app`)||document.body);