import{Ha as e,na as t,o_ as n,qa as r}from"./src-B-qApvaQ.js";import{Br as i,Nr as a}from"./wgsl-Bn5GD31a.js";import{$t as o,Bt as s,Ct as c,D as l,Dt as u,It as d,Nt as f,Ot as p,Pt as m,Qt as h,Rt as g,St as _,_t as v,dt as y,en as b,f as x,ht as S,in as C,kt as w,nn as T,on as E,p as D,r as O,s as k,sn as A,tn as j,vt as M,wt as N,yt as P,zt as F}from"./molecularHartreeFockWebGpu-DpThQ3nH.js";import{g as I,m as L}from"./webgpuComputeLayout-CHUyeeFd.js";var ee=w/p**3,te=27.211386245988,ne=-.895929;function R(e,{emptyCoreRadiusBohr:t=0,madelungCoefficient:n=ne,valence:r=1}={}){let i=n*r**(2/3)/e,a=1.5*r*t*t/(e*e*e);return m(e)+i+a}function re(e={},{lo:t=1,hi:n=8,iterations:r=200}={}){let i=(Math.sqrt(5)-1)/2,a=t,o=n,s=o-i*(o-a),c=a+i*(o-a),l=t=>R(t,e);for(let e=0;e<r;e+=1)l(s)<l(c)?o=c:a=s,s=o-i*(o-a),c=a+i*(o-a);return .5*(a+o)}function ie(e,t={}){let n=e=>4*Math.PI/3*e**3,r=e=>(3*e/(4*Math.PI))**(1/3),i=n(e),a=i*.001,o=R(r(i+a),t),s=R(e,t),c=R(r(i-a),t);return i*((o-2*s+c)/(a*a))*ee}function z({atomicMassKg:e,valenceElectronsPerAtom:t=1,emptyCoreRadiusBohr:n=0,madelungCoefficient:r=ne}){let i={emptyCoreRadiusBohr:n,madelungCoefficient:r,valence:t},a=re(i);return{equilibriumRsBohr:a,equilibriumDensityKgPerM3:e/(t*(4*Math.PI/3*(a*p)**3)),bulkModulusPa:ie(a,i),bindingEnergyEvPerElectron:R(a,i)*te,numberDensityPerBohr3:f(a)}}var ae=8.314462618,B=1054571817e-43,oe=1380649e-29,se=602214076e15,V=Object.freeze([{species:`N2`,moleFraction:.7808,molarMassKgPerMol:.0280134,degreesOfFreedom:5},{species:`O2`,moleFraction:.2095,molarMassKgPerMol:.0319988,degreesOfFreedom:5},{species:`Ar`,moleFraction:.0093,molarMassKgPerMol:.039948,degreesOfFreedom:3},{species:`CO2`,moleFraction:4e-4,molarMassKgPerMol:.0440095,degreesOfFreedom:5}]);function ce(e=V){let t=0,n=0;for(let r of e)t+=r.moleFraction*r.molarMassKgPerMol,n+=r.moleFraction*(r.degreesOfFreedom/2)*ae;let r=n+ae;return{derivation:`equipartition-ideal-gas`,molarMassKgPerMol:t,cvJPerKgK:n/t,cpJPerKgK:r/t,gamma:r/n}}function le({soundSpeedMPerS:e,numberDensityPerM3:t}){return B*e/oe*Math.cbrt(6*Math.PI*Math.PI*t)}function H({densityKgPerM3:e,molarMassKgPerMol:t,atomsPerFormula:n=1}){return e/t*se*n}function U(e){if(e<=0)return 1;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256,i=Math.exp(r);t+=r**4*i/(i-1)**2}return t*=e/256,3/e**3*t}function W(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){return 3*ae*r/n*U(t/e)}function ue(e){if(e<=0)return 0;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256;t+=r**3/(Math.exp(r)-1)}return e/256*t}function de(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){if(e<=0)return 0;let i=t/e;return 9*(ae*r/n)*e*(1/i**3)*ue(i)}var fe=`ulg.material-property-provenance.v0`,G=Object.freeze({LOWER_LEVEL_SIMULATION:`lower-level-simulation`,DERIVED_FROM_LOWER_LEVEL:`derived-from-lower-level`,PHYSICAL_LAW:`physical-law`,EXACT_CONSTANT:`exact-constant`,REFERENCE_FALLBACK:`reference-fallback`,REDUCED_ESTIMATE:`reduced-estimate`,BLOCKED:`blocked`});new Set([G.LOWER_LEVEL_SIMULATION,G.DERIVED_FROM_LOWER_LEVEL,G.PHYSICAL_LAW,G.EXACT_CONSTANT]);var pe=new Set([G.REFERENCE_FALLBACK,G.REDUCED_ESTIMATE,G.BLOCKED]),me=class extends Error{constructor(e,{material:t=null,context:n=null,blockers:r=[],summary:i=null}={}){super(e),this.name=`MaterialFirstPrinciplesResolutionError`,this.code=`material-properties-not-first-principles`,this.material=t,this.context=n,this.blockers=r,this.summary=i}};function he(e){if(!Array.isArray(e)||e.length===0)throw TypeError(`provenance entry requires non-empty paths`);return e.map(e=>{if(typeof e!=`string`||e.length===0)throw TypeError(`provenance path must be a non-empty string`);return e})}function K({paths:e,status:t,source:n,method:r,inputs:i=[],accuracy:a=`evidence-only`,blockers:o=[]}){if(!Object.values(G).includes(t))throw TypeError(`unknown property derivation status: ${t}`);return{paths:he(e),status:t,source:n,method:r,inputs:i,accuracy:a,blockers:o}}function ge(e){let t=[];for(let n of e.phases||[]){let e=`phases.${n.name}`;for(let r of[`cpJPerKgK`,`densityKgPerM3`,`thermalConductivityWPerMK`,`bulkModulusPa`,`shearModulusPa`,`debyeTemperatureK`])n[r]!==void 0&&n[r]!==null&&t.push(`${e}.${r}`);if(Array.isArray(n.temperatureRange)&&t.push(`${e}.temperatureRange`),n.eos)for(let r of[`gruneisen`,`bulkModulusPa`,`referenceDensityKgPerM3`,`referenceTemperatureK`])n.eos[r]!==void 0&&n.eos[r]!==null&&t.push(`${e}.eos.${r}`)}return t}function q(e){let t=[];for(let n of e.transitions||[]){let e=`${n.from}->${n.to}`;for(let r of[`temperatureK`,`latentHeatJPerKg`])n[r]!==void 0&&n[r]!==null&&t.push(`transitions.${e}.${r}`)}return t}function _e(e){let t=e.dispersedMediumOpticalClosure;if(!t||typeof t!=`object`||Array.isArray(t))return[];let n=[];for(let e of[`schema`,`morphologyModel`,`morphologyModelId`,`condensedDensityKgPerM3`,`scatteringEfficiencyQsca`,`absorptionEfficiencyQabs`,`asymmetryFactorG`,`effectiveRadiusM`,`relativeRefractiveIndexN`,`relativeExtinctionCoefficientK`,`largeSizeRayAsymmetryFactorG`,`referenceWavelengthM`,`provenance`,`scientificValidation`])t[e]!==void 0&&t[e]!==null&&n.push(`dispersedMediumOpticalClosure.${e}`);return n}function ve(e={}){let t=[];for(let n of[`molarMassKgPerMol`,`atomsPerFormula`,`conductionElectronDensityPerM3`,`intrinsicColorSrgb`,`conductorOpticalConstants`,`gasElectronicAbsorptionCrossSection`,`opticalInterbandOscillators`,`idealGas`])e[n]!==void 0&&e[n]!==null&&t.push(n);return t.push(...ge(e)),t.push(...q(e)),t.push(..._e(e)),t}function ye(e,t){if(e===t||e===`*`)return!0;let n=e.split(`.`),r=t.split(`.`);return n.length===r.length?n.every((e,t)=>e===`*`||e===r[t]):!1}function be(e={},t){return(e.propertyProvenance?.entries||[]).filter(e=>e.paths.some(e=>ye(e,t)))}function xe(e={}){return ve(e).filter(t=>be(e,t).length===0)}function J({entries:e,notes:t=[]}={}){if(!Array.isArray(e))throw TypeError(`property provenance ledger requires entries`);return{schema:fe,entries:e,notes:t}}function Se(e,{entries:t,notes:n=[]}){return{...e,propertyProvenance:J({entries:t,notes:n})}}function Ce(e={}){let t=e.propertyProvenance?.entries||[],n={};for(let e of t)n[e.status]=(n[e.status]||0)+e.paths.length;let r=xe(e),i=t.filter(e=>pe.has(e.status)),a=[...new Set(i.flatMap(e=>e.blockers||[]))];return{schema:fe,trackedPropertyCount:ve(e).length,entryCount:t.length,counts:n,unprovenanced:r,fullyLowerLevelDerived:r.length===0&&i.length===0,hasReferenceFallbacks:i.some(e=>e.status===G.REFERENCE_FALLBACK),hasReducedEstimates:i.some(e=>e.status===G.REDUCED_ESTIMATE),blockers:a}}function we(e={}){let t=xe(e);if(t.length>0)throw Error(`material properties missing provenance: ${t.join(`, `)}`);return!0}function Te(e={},{material:t=null,context:n=`material-resolution`,allowedFallbackSources:r=[]}={}){we(e);let i=Ce(e);if(!i.fullyLowerLevelDerived){let a=new Set(r),o=(e.propertyProvenance?.entries||[]).filter(e=>pe.has(e.status)&&!a.has(e.source));if(a.size>0&&o.length===0)return!0;throw new me(`${t?`${t} `:``}material properties are not first-principles-derived`,{material:t,context:n,blockers:i.blockers,summary:i})}return!0}function Ee(e={},{context:t=`material-map`,allowedFallbackSources:n=[]}={}){for(let[r,i]of Object.entries(e))Te(i,{material:r,context:t,allowedFallbackSources:n});return!0}var De=`element-closures.pbe-kh-so-vdw-dband.v3`,Oe=1054571817e-43,ke=1380649e-29,Ae=91093837015e-41,je=602214076e15,Y=1602176634e-28,Me=27.211386245988,Ne=1e6,Pe=293.15,Fe=.3,Ie=.07,Le=8.314462618,Re=88,ze=.88,Be=.001,Ve=new Set([2,10,18,36,54,86,118]),He=new Map;function Ue(e,t={}){let n=String(t.functional||`pbe`).toLowerCase(),r=t.scalarRelativistic!==!1,i=t.spinOrbit!==!1,a=Math.max(220,Math.floor(t.gridPointsN??500)),o=t.rMaxBohr??36,s=t.maxScf??250,c=t.tol??1e-6,l=`${De}:${e}:${n}:${r?`kh`:`nr`}:${i?`so`:`noso`}:${a}:${o}:${s}`;if(He.has(l))return He.get(l);let d=T(e),f=u(e,{configuration:d,functional:n,scalarRelativistic:r,spinOrbit:i,returnRadialDensity:!0,gridPointsN:a,rMaxBohr:o,maxScf:s,tol:c}),p=d.reduce((e,t)=>Math.max(e,t.n),0),m=d.find(e=>e.n===p&&e.l===0)||null,h=d.find(e=>e.n===p&&e.l===1)||null,g=d.find(e=>e.n===p-1&&e.l===2)||null,_=d.find(e=>e.n===p-2&&e.l===3)||null,v=f.orbitals.find(e=>e.n===p&&e.l===0)||null,y=f.orbitals.find(e=>e.n===p&&e.l===1)||null,b=f.orbitals.find(e=>e.n===p-1&&e.l===2)||null,{r:x,rho:S,dx:C}=f.radialGrid,w=E(e),D=e-w,O=0,k=0,A=0,j=0,M=0;for(let t=0;t<x.length;t+=1){let n=x[t],r=S[t]*4*Math.PI*n*n*n*C;O+=r,!k&&D>0&&O>=D&&(k=n),!A&&O>=e-.5&&(A=n),S[t]>=Be&&(j=n),O>D&&(M+=r*n*n)}let N=Math.max(...f.orbitals.map(e=>e.energyHa)),P=Math.max(.06,-N),F=2/3*(M/Math.max(.08,P)),I={atom:f,cfg:d,maxN:p,sSub:m,pSub:h,dSub:g,fSub:_,sOrb:v,pOrb:y,dOrb:b,val:w,rCore:k,rHalf:Math.max(.8,A||x[x.length-1]),rVdw:Math.max(A||1.2,j||A||1.2),valR2:M,iEffHa:P,alphaBohr3:F,functional:n,scalarRelativistic:r,spinOrbit:i};return He.size>512&&He.clear(),He.set(l,I),I}function We(e){let t=2*(2*e.l+1);return e.occupancy<=0||e.occupancy>=t?0:e.occupancy}function Ge(e){let t=T(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.filter(e=>e.n===n&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0),i=t.filter(e=>e.l===2||e.l===3).reduce((e,t)=>e+We(t),0);return Math.max(1,r+i)}function Ke(e,t,n={}){let r=S({atomicNumberZ:e,conductionElectronDensityPerM3:t,interbandOptions:n.opticalInterbandOptions||{}});return{srgb:[r.r,r.g,r.b],plasmaRadPerS:r.plasmaRadPerS??0,interbandOscillators:r.interbandOscillators||[]}}function qe(e,t,n){return e<t?`solid`:e<n?`liquid`:`gas`}function Je(e,t={}){let n=C(e),r=E(e),i=Ge(e),a=b(e),o=a*je,s=Ue(e,t),c=s.sSub?.occupancy||0,l=s.pSub?.occupancy||0,u=s.dSub?.occupancy||0,d=s.fSub?.occupancy||0,f=u>0&&u<10,m=d>0&&d<14,h=u===10,g=s.sOrb?Math.abs(s.sOrb.energyHa)*Me:0,_=s.pOrb?Math.abs(s.pOrb.energyHa)*Me:0,v=s.dOrb?Math.abs(s.dOrb.energyHa)*Me:0;if(Ve.has(e)){let t=Math.max(2,s.rVdw*1.92),c=.75*s.iEffHa*s.alphaBohr3*s.alphaBohr3,l=Math.max(4e-4,6*(c/t**6)*Me*.22),u=l*Y*je,d=4*Math.PI/3*(s.rVdw*p)**3/.74,f=a/d,m=Math.max(1e6,8*l*Y/d),h=Math.max(4,u/Re),g=Math.max(1,h*.85);return{atomicNumberZ:e,symbol:n,configuration:j(e),valenceElectrons:r,bondingElectrons:i,molarMassKgPerMol:o,bondingClass:`noble-gas-vdw`,metallicModelApplicable:!1,condensedModelApplicable:!1,standardPhaseAt298K:qe(Pe,g,h),vdwGasProperties:Object.freeze({condensedDensityKgPerM3:f,bulkModulusPa:m,cohesiveEnergyEv:l,cohesiveEnergyJPerMol:u,meltingPointK:g,boilingPointK:h,latentHeatVaporizationJPerKg:u/o,polarizabilityBohr3:s.alphaBohr3,vdwRadiusBohr:s.rVdw}),note:`noble gas: closed shell (van-der-Waals dispersion properties reported under vdwGasProperties)`,relativisticMethod:s.atom.relativisticMethod||(s.scalarRelativistic?`koelling-harmon`:`non-relativistic`),functional:s.functional,generatorFingerprint:De,closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}}}let y,x=!1,S,w,T,D,O,k,A=null,M=Ie,N=r,P,F=c===1&&l===0&&s.maxN===1;if(!f&&!m&&(F||l>=3&&_>=4.75)){y=`molecular-vdw`;let e=F?1:6-l,t=!F&&e>=2&&s.maxN>=3&&e<=3,n=F?.25:t?2.6:1,r=2/3*(s.valR2/Math.max(.12,s.iEffHa))*(F?.65:.42),i=.75*s.iEffHa*r*r,o=Math.max(2.4,s.rVdw*1.805);T=Math.max(.001,6*(i/o**6)*Me*n),k=s.rVdw*.8;let c=4*Math.PI/3*(k*p)**3/.64;S=a/c,w=Math.max(1e7,8*T*Y/c);let u=T*Y*je;O=Math.max(8,u/Re),D=Math.max(5,O*(t?.62:.76)),N=0,P=`relativistic PBE-KH atomic polarizability + Bader VdW contact radius -> London C6 dispersion cohesion -> Trouton boiling & melting`}else if(!f&&!m&&l>=1&&l<=2&&_>=3){y=`covalent-network`;let e=s.rHalf*.76;k=e;let t=4*Math.PI/3*(e*p)**3/.34;S=a/t;let n=.26*(g*c+_*l)/Math.max(1.8,e);T=Math.max(.8,n*1.15),w=Math.max(1e9,3.8*T*Y/t),D=Math.max(500,.044*(T*Y/ke));let r=T*Y*je;O=Math.max(D*1.35,r/Re),N=0,P=`relativistic PBE-KH sp3 orbital energies & covalent packing -> Rose EOS curvature -> cohesive melting & Trouton boiling`}else if(f||m||h&&c===1&&l===0){y=h?`noble-sd-metal`:`transition-df-metal`,x=!0,M=.05;let e=s.rHalf*(h?.755:.735);k=e;let t=4*Math.PI/3*(e*p)**3;S=a/t;let n=f?u*(10-u)/25:0,r=Math.abs(g-v),i=h?1/(1+(r/3.2)**2):.45/(1+(r/4)**2),o=1+.16*Math.max(0,s.maxN-4);T=Math.max(.5,.62*(1.7+4.4*n+2.1*i)*o*(g/4.8)),w=Math.max(1e9,3.4*T*Y/t),D=Math.max(300,.036*(T*Y/ke));let l=T*Y*je;O=Math.max(D*1.65,l/Re),N=Math.max(1,c),P=`relativistic PBE-KH Friedel d-band + s-d hybridization cohesion -> Rose EOS curvature -> Debye thermal, cohesive melt & Trouton boil; spin-orbit Drude-Lorentz colour`}else if(h&&c===2&&l===0){y=`closed-d10-s2-metal`,x=!0,M=.055;let e=s.rHalf*.84;k=e;let t=4*Math.PI/3*(e*p)**3;S=a/t;let n=2/t,r=Oe*Oe/(2*Ae)*(3*Math.PI*Math.PI*n)**(2/3)/Y/Math.max(1,g),i=Math.max(.08,r/1.9)**4;T=Math.max(.32,2.35*i),w=Math.max(1e9,5.2*T*Y/t),D=Math.max(150,.042*(T*Y/ke));let o=T*Y*je;O=Math.max(D*1.5,o/Re),N=2,P=`relativistic PBE-KH closed d10-s2 inert-pair suppression (E_F / |ε_ns|) -> Rose EOS curvature -> cohesive melt & Trouton boil; spin-orbit Drude-Lorentz colour`}else{let e=h&&l>0;y=e?`post-transition-inert-pair-metal`:`simple-sp-metal`,x=!0;let t=Math.max(1,r),n=Math.max(0,g-_);if(e){let e=c*Math.exp(-Math.max(0,n-4.2)*.65);t=Math.max(1,l+e)}A=s.rCore*ze;let i=z({atomicMassKg:a,valenceElectronsPerAtom:t,emptyCoreRadiusBohr:A});k=i.equilibriumRsBohr,S=i.equilibriumDensityKgPerM3,w=i.bulkModulusPa;let o=S/a,u=le({soundSpeedMPerS:Math.sqrt(Math.max(w,0)/S),numberDensityPerM3:o}),d=(1/o)**(1/3);if(D=Ie*Ie/3*d*d*a*ke*u*u/(Oe*Oe),e){let e=.68/Math.max(1,l);D=Math.max(260,D*Math.exp(-Math.max(0,n-4.3)*e))}T=Math.max(.4,D/.045*ke/Y);let f=T*Y*je;O=Math.max(D*1.6,f/Re),N=t,P=e?`relativistic PBE-KH Ashcroft jellium + Δ_sp inert-pair suppression -> Debye-Lindemann melt & Trouton boil; Drude-Lorentz colour`:`relativistic PBE-KH core radius -> polyvalent jellium cohesion (density, B) -> Debye (cp, θ_D) -> Lindemann melt & Trouton boil; Drude-Lorentz colour`}let I=S/a,L=Math.sqrt(Math.max(w,0)/S),ee=le({soundSpeedMPerS:L,numberDensityPerM3:I}),te=W(300,{debyeTemperatureK:ee,molarMassKgPerMol:o,atomsPerFormula:1}),ne=w*(3*(1-2*Fe))/(2*1.3),R=N*I,re=R>0?Ke(e,R,t):{srgb:[.76,.8,.86],plasmaRadPerS:0,interbandOscillators:[]},ie=T*Y*je,ae=ie/o,B=qe(Pe,D,O);return{atomicNumberZ:e,symbol:n,configuration:j(e),valenceElectrons:r,bondingElectrons:i,molarMassKgPerMol:o,bondingClass:y,metallicModelApplicable:x,condensedModelApplicable:!0,emptyCoreRadiusBohr:A,radialPackingRadiusBohr:s.rHalf,vdwRadiusBohr:s.rVdw,polarizabilityBohr3:s.alphaBohr3,equilibriumWignerSeitzRadiusBohr:k,densityKgPerM3:S,bulkModulusPa:w,shearModulusPa:ne,soundSpeedMPerS:L,debyeTemperatureK:ee,cpJPerKgK:te,cohesiveEnergyEv:T,cohesiveEnergyJPerMol:ie,conductionElectronDensityPerM3:R,opticalColorSrgb:re.srgb,opticalInterbandOscillators:re.interbandOscillators,plasmaFrequencyRadPerS:re.plasmaRadPerS,meltingPointK:D,boilingPointK:O,latentHeatVaporizationJPerKg:ae,standardPhaseAt298K:B,lindemannRatio:M,outerSOrbitalEnergyEv:-g,outerPOrbitalEnergyEv:s.pOrb?-_:null,outerDOrbitalEnergyEv:s.dOrb?-v:null,relativisticMethod:s.atom.relativisticMethod||(s.scalarRelativistic?`koelling-harmon`:`non-relativistic`),functional:s.functional,generatorFingerprint:De,derivation:P,closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}}}var Ye=new Map;function Xe(e,t={}){let n=t.allowReducedEstimates===!0,r=t.includeGasPhase===!0,i=`${De}:${e}:${String(t.functional||`pbe`).toLowerCase()}:${t.scalarRelativistic===!1?`nr`:`kh`}:${r?`3p`:`2p`}`;if(Ye.has(i)){let e=Ye.get(i);return e&&!n&&Te(e.properties,{material:e.symbol,context:`elementMaterialClosure`}),e}let a=Je(e,t);if(!a.condensedModelApplicable&&!a.metallicModelApplicable)return Ye.set(i,null),null;let o=a.meltingPointK,s=a.boilingPointK,c=a.densityKgPerM3*(1-3*a.lindemannRatio*a.lindemannRatio),l=o*Le/a.molarMassKgPerMol,u=a.latentHeatVaporizationJPerKg,d=Le/a.molarMassKgPerMol,f=101325*a.molarMassKgPerMol/(Le*Math.max(10,s)),p=(a.bondingClass===`molecular-vdw`?3.5:2.5)*d,m=[{name:`solid`,cpJPerKgK:a.cpJPerKgK,densityKgPerM3:a.densityKgPerM3,temperatureRange:[0,o],debyeTemperatureK:a.debyeTemperatureK,bulkModulusPa:a.bulkModulusPa,shearModulusPa:a.shearModulusPa},{name:`liquid`,cpJPerKgK:a.cpJPerKgK*(1+a.lindemannRatio),densityKgPerM3:c,temperatureRange:[o,r?s:Ne],bulkModulusPa:a.bulkModulusPa*(c/a.densityKgPerM3),shearModulusPa:0}],h=[{from:`solid`,to:`liquid`,temperatureK:o,latentHeatJPerKg:l}];r&&(m.push({name:`gas`,cpJPerKgK:p,densityKgPerM3:f,temperatureRange:[s,Ne],bulkModulusPa:101325,shearModulusPa:0}),h.push({from:`liquid`,to:`gas`,temperatureK:s,latentHeatJPerKg:u}));let g=[`conductionElectronDensityPerM3`,`intrinsicColorSrgb`,`opticalInterbandOscillators`,`cohesiveEnergyJPerMol`,`boilingPointK`,`standardPhaseAt298K`,`bondingClass`,`phases.solid.cpJPerKgK`,`phases.solid.densityKgPerM3`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.solid.debyeTemperatureK`,`phases.solid.temperatureRange`,`transitions.solid->liquid.temperatureK`,`phases.liquid.cpJPerKgK`,`phases.liquid.densityKgPerM3`,`phases.liquid.bulkModulusPa`,`phases.liquid.temperatureRange`],_=[`phases.liquid.shearModulusPa`],v=[`transitions.solid->liquid.latentHeatJPerKg`,`latentHeatVaporizationJPerKg`];r&&(g.push(`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.bulkModulusPa`,`phases.gas.temperatureRange`,`transitions.liquid->gas.temperatureK`),_.push(`phases.gas.shearModulusPa`),v.push(`transitions.liquid->gas.latentHeatJPerKg`));let y=Se({molarMassKgPerMol:a.molarMassKgPerMol,atomsPerFormula:1,heatCapacityModel:{solid:`debye`,liquid:`derived-high-temperature-debye-limit`,...r?{gas:`ideal-gas-equipartition`}:{}},derivation:a.derivation,bondingClass:a.bondingClass,cohesiveEnergyJPerMol:a.cohesiveEnergyJPerMol,boilingPointK:s,latentHeatVaporizationJPerKg:u,standardPhaseAt298K:a.standardPhaseAt298K,conductionElectronDensityPerM3:a.conductionElectronDensityPerM3,intrinsicColorSrgb:a.opticalColorSrgb,opticalInterbandOscillators:a.opticalInterbandOscillators,phases:m,transitions:h,closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}},{entries:[K({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:G.EXACT_CONSTANT,source:`periodic-table-atomic-mass`,method:`element formula mass from atomic mass`}),K({paths:g,status:G.LOWER_LEVEL_SIMULATION,source:`relativistic-atomic-dft+universal-bonding-debye-trouton`,method:`relativistic PBE-KH+SO atomic DFT plus universal bonding cold curve, Debye/Lindemann thermal-melting, and Trouton boiling closure`}),K({paths:_,status:G.PHYSICAL_LAW,source:`continuum-mechanics`,method:`fluid phases have zero static shear modulus`}),K({paths:v,status:G.PHYSICAL_LAW,source:`richards-and-trouton-rules`,method:`universal fusion (Richards) and vaporization (Trouton) entropy laws applied to derived transitions`})],notes:[`Element closure is derived across the periodic table from relativistic PBE-KH+SO DFT; validation stays false until benchmarked against DFT/MD reference suites.`]}),b={symbol:a.symbol,atomicNumberZ:e,generatorFingerprint:De,properties:y,materialDerivation:Ce(y)};return Ye.set(i,b),n||Te(y,{material:a.symbol,context:`elementMaterialClosure`}),b}function Ze(){let e=[];for(let t=1;t<=118;t+=1)Ve.has(t)||e.push({Z:t,symbol:C(t)});return e}var Qe=529177210903e-22,$e=new Map;function et(e){let t=2*(2*e.l+1);return e.occupancy<=0||e.occupancy>=t?0:e.occupancy}function tt(e){let t=T(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.filter(e=>e.n===n&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0),i=t.filter(e=>e.l===2||e.l===3).reduce((e,t)=>e+et(t),0);return Math.max(1,Math.min(8,r+i))}function nt(e,t){let{r:n,rho:r,dx:i}=e.radialGrid,a=0;for(let e=0;e<n.length;e+=1)if(a+=r[e]*4*Math.PI*n[e]*n[e]*n[e]*i,a>=t)return n[e];return n[n.length-1]}function rt(e,t){let n=T(t),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=new Set(n.filter(e=>e.n===r||(e.l===2||e.l===3)&&et(e)>0).map(e=>`${e.n}:${e.l}`)),a=0,o=0;for(let t of e.orbitals||[])i.has(`${t.n}:${t.l}`)&&(a+=Math.abs(t.energyHa)*t.occupancy,o+=t.occupancy);return o>0?a/o:Math.abs(e.orbitals?.at(-1)?.energyHa??.05)}function it(e,t={}){let n=`${e}:${t.gridPointsN??520}:${t.rMaxBohr??42}`;if($e.has(n))return $e.get(n);let r=u(e,{returnRadialDensity:!0,gridPointsN:t.gridPointsN??520,rMaxBohr:t.rMaxBohr??42,maxScf:t.maxScf??200}),i=tt(e),a=nt(r,Math.max(.2,e-i/2)),o=nt(r,Math.max(.5,e-.25)),s=rt(r,e),c={Z:e,symbol:C(e),atomicEnergyHa:r.totalEnergyHa,atomicMassKg:b(e),valenceElectrons:E(e),bondingElectrons:i,coreRadiusBohr:a,valenceRadiusBohr:o,orbitalBindingHa:s,electronegativityHa:s,radialSolve:{totalEnergyHa:r.totalEnergyHa,integratedElectrons:r.integratedElectrons,configuration:r.configuration}};return $e.set(n,c),c}function at(e,t){let n=e.position[0]-t.position[0],r=e.position[1]-t.position[1],i=e.position[2]-t.position[2];return Math.sqrt(n*n+r*r+i*i)}function ot(e,t){let n=e.coreRadiusBohr+t.coreRadiusBohr,r=e.valenceRadiusBohr+t.valenceRadiusBohr,i=Math.max(.9,.42*n+.18*r),a=Math.sqrt(Math.max(e.electronegativityHa*t.electronegativityHa,1e-8)),o=Math.abs(e.electronegativityHa-t.electronegativityHa)/Math.max(e.electronegativityHa+t.electronegativityHa,1e-8),s=Math.sqrt(e.bondingElectrons*t.bondingElectrons);return{equilibriumBohr:i,depthHa:Math.max(.005,a*(.05+.04*o)*Math.min(3,s)/2),stiffness:1.55/Math.max(i,.9),polarity:o,capacity:s}}function st(e,t){let n=Math.exp(-t.stiffness*(e-t.equilibriumBohr));return t.depthHa*(n*n-2*n)}function ct(e){return e.reduce((e,t)=>e+t.Z,0)}function lt(e,t={}){if(!Array.isArray(e)||e.length===0)throw TypeError(`atoms must be a non-empty array`);let n=e.map(e=>it(e.Z,t)),r=n.reduce((e,t)=>e+t.atomicEnergyHa,0),i=0,a=[];for(let t=0;t<e.length;t+=1)for(let r=t+1;r<e.length;r+=1){let o=at(e[t],e[r]),s=ot(n[t],n[r]),c=st(o,s);i+=c,a.push({i:t,j:r,Zi:e[t].Z,Zj:e[r].Z,distanceBohr:o,energyHa:c,...s})}let o=e.length*(e.length-1)/2,s=n.reduce((e,t)=>e+t.bondingElectrons,0)/2,c=o>s?.015*(o-s)**2:0;return{method:`atomic-kohn-sham-tight-binding-v0`,totalEnergyHa:r+i+c,atomicReferenceEnergyHa:r,pairEnergyHa:i,saturationPenaltyHa:c,nAtoms:e.length,nElectrons:ct(e),descriptors:n,pairTerms:a,provenance:{source:`atomic-kohn-sham-radial-density-universal-pair-hamiltonian`,lowerLevelInputs:[`atomic Kohn-Sham total energy`,`radial density containment radii`,`outer orbital energies`,`ground-state electron configuration`],validation:!1}}}function ut(e,t={}){return lt(Array.isArray(e)?e:e.atoms,t).totalEnergyHa}function dt(e,t,n={}){return ot(it(e,n),it(t,n)).equilibriumBohr*Qe}var ft={schema:`peercompute.ulg.molecular-electronic-bands.v0`,source:`spectroscopic-absorption-maximum`,notes:[`Gas-phase visible/near-UV electronic absorption continua: band centre (absorption maximum),`,`FWHM, and integrated oscillator strength from standard spectroscopy references. These anchor`,`the delta-SCF derived band centre (reference-fallback provenance, like the CRC transition`,`anchors) because minimal-basis delta-SCF overshoots sigma* band centres by several eV`,`(F2: 8.4 eV derived vs 4.34 eV observed) and the Gaussian tail into the visible is`,`exponentially sensitive to the centre. Strict mode can rerun the pure delta-SCF path.`],records:[{formula:`F2`,bandCenterEv:4.34,bandFwhmEv:1.6,oscillatorStrength:.0025,absorptionCrossSection:{schema:`peercompute.ulg.molecular-gas-absorption-cross-section.v0`,source:`R. K. Steunenberg and R. C. Vogel, The Absorption Spectrum of Fluorine, JACS 78, 901-902 (1956)`,doi:`10.1021/ja01586a007`,temperatureK:298,wavelengthNm:[380,390,400,410,420,430,440,450,500],crossSectionM2:[24e-26,16e-26,11e-26,8e-26,54e-27,38e-27,27e-27,23e-27,0]},note:`1Pi_u <- X continuum, lambda_max ~285 nm; measured visible-tail cross sections produce the pale-yellow gas response`},{formula:`Cl2`,bandCenterEv:3.76,bandFwhmEv:1.4,oscillatorStrength:.0025,note:`1Pi_u <- X continuum, lambda_max ~330 nm; yellow-green`},{formula:`Br2`,bandCenterEv:2.99,bandFwhmEv:1.2,oscillatorStrength:.003,note:`lambda_max ~415 nm; red-brown vapour`},{formula:`I2`,bandCenterEv:2.36,bandFwhmEv:.9,oscillatorStrength:.005,note:`B <- X, lambda_max ~525 nm; violet vapour`},{formula:`O3`,bandCenterEv:2.07,bandFwhmEv:.8,oscillatorStrength:1e-5,note:`Chappuis band, lambda_max ~600 nm; faint blue`},{formula:`NO2`,bandCenterEv:3.1,bandFwhmEv:1.3,oscillatorStrength:.01,note:`visible band, lambda_max ~400 nm; brown`},{formula:`N2`,bandCenterEv:12.5,bandFwhmEv:1,oscillatorStrength:1e-4,note:`first dipole-allowed b1Pi_u deep in vacuum UV; colourless`},{formula:`O2`,bandCenterEv:8.6,bandFwhmEv:1.2,oscillatorStrength:.002,note:`Schumann-Runge B3Sigma_u- <- X; vacuum UV; colourless`},{formula:`CO2`,bandCenterEv:8.9,bandFwhmEv:1,oscillatorStrength:1e-4,note:`1B2 <- X vacuum UV; colourless`},{formula:`H2`,bandCenterEv:11.3,bandFwhmEv:1,oscillatorStrength:.3,note:`Lyman B1Sigma_u+ <- X vacuum UV; colourless`}]},pt={schema:`peercompute.ulg.material-property-bank.element-crystal-structures.v0`,schemaVersion:1,bankFamily:`element-crystal-structures`,generatorFingerprint:`ulg-element-crystal-structures-phase2-seed-2026-06-20`,generatedAt:`2026-06-20T00:00:00-08:00`,records:[{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Li`,phase:`solid`,structureKey:`li-bcc-alpha`,structureName:`body-centered cubic lithium`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:3.51,bAngstrom:3.51,cAngstrom:3.51,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:534,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,453.65],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Phase 2 seed provides a non-authoritative crystal packing warm input for solid lithium.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid lithium alpha phase`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Na`,phase:`solid`,structureKey:`na-bcc-alpha`,structureName:`body-centered cubic sodium`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:4.29,bAngstrom:4.29,cAngstrom:4.29,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:968,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,370.87],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Active Na/H2O reaction probes need a stable solid sodium packing warm input.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid sodium alpha phase`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`K`,phase:`solid`,structureKey:`k-bcc-alpha`,structureName:`body-centered cubic potassium`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:5.23,bAngstrom:5.23,cAngstrom:5.23,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:862,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,336.53],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Active alkali/H2O coverage should use a crystal packing seed when solid K is initialized.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid potassium alpha phase`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Rb`,phase:`solid`,structureKey:`rb-bcc-alpha`,structureName:`body-centered cubic rubidium`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:5.59,bAngstrom:5.59,cAngstrom:5.59,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:1532,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,312.46],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`The selectable alkali material family should share the same Phase 2 crystal warm-input contract.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid rubidium alpha phase`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Cs`,phase:`solid`,structureKey:`cs-bcc-alpha`,structureName:`body-centered cubic cesium`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:6.05,bAngstrom:6.05,cAngstrom:6.05,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:1873,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,301.59],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Active Cs/H2O reaction coverage needs a stable solid cesium packing warm input near room temperature.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid cesium alpha phase`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Fe`,phase:`solid`,structureKey:`fe-bcc-alpha`,structureName:`body-centered cubic alpha iron`,strukturbericht:`A2`,crystalSystem:`cubic`,spaceGroup:{number:229,symbol:`Im-3m`},latticeConstants:{aAngstrom:2.866,bAngstrom:2.866,cAngstrom:2.866,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:2,densityKgPerM3:7874,packingFraction:.68,coordinationNumber:8},validity:{temperatureRangeK:[0,1185],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-alpha-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Fe/H2O and iron-on-ice scenarios need a crystal packing hint for solid iron particles.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient alpha iron`,quality:`approximate-warm-input`}]},{schema:`peercompute.ulg.material-property-bank.element-crystal-structure.v0`,symbol:`Pd`,phase:`solid`,structureKey:`pd-fcc`,structureName:`face-centered cubic palladium`,strukturbericht:`A1`,crystalSystem:`cubic`,spaceGroup:{number:225,symbol:`Fm-3m`},latticeConstants:{aAngstrom:3.89,bAngstrom:3.89,cAngstrom:3.89,alphaDeg:90,betaDeg:90,gammaDeg:90},unitCell:{atomsPerConventionalCell:4,densityKgPerM3:12023,packingFraction:.74,coordinationNumber:12},validity:{temperatureRangeK:[0,1828.05],pressureRangePa:[0,2e8],referenceState:{temperatureK:293.15,pressurePa:101325}},fallbackPolicy:{whenUnspecified:`use-ambient-fcc-solid-structure`,particleInitialization:`derive spacing from rest density, packing fraction, and target neighbor count`,reason:`Pd PBR/mobile probes need solid transition-metal crystal packing metadata.`},provenance:[{family:`element-crystal-structure`,source:`ULG Phase 2 reviewed seed`,method:`ambient crystallographic reference rounded for warm-start use`,status:`reference-fallback`,units:`angstrom, kg/m3, dimensionless packing fraction`,referenceState:`ambient solid palladium`,quality:`approximate-warm-input`}]}]},mt=x,ht=pt,gt=1380649e-29,_t=602214076e15,vt=gt*_t;function yt(e){let t=Math.max(.3,Math.min(1e3,Number(e)));return 1.16145*t**-.14874+.52487*Math.exp(-.7732*t)+2.16178*Math.exp(-2.43787*t)}function bt({molarMassKgPerMol:e,sigmaM:t,epsilonJ:n,temperatureK:r=298.15,cvMolarJPerMolK:i=1.5*vt}={}){let a=Number(e),o=Number(t),s=Number(n),c=Number(r),l=Number(i);if(!(a>0)||!(o>0)||!(s>0)||!(c>0))return null;let u=a/_t,d=gt*c/s,f=yt(d),p=5/16*Math.sqrt(Math.PI*u*gt*c)/(Math.PI*o*o*f),m=Number.isFinite(l)&&l>0?l:1.5*vt,h=p/a*(1.32*m+1.77*vt);return Object.freeze({dynamicViscosityPaS:p,thermalConductivityWPerMK:h,reducedTemperature:d,omega22:f,temperatureK:c,method:`chapman-enskog-modified-eucken-lj`})}var xt=ft,St=`crc-standard-reference-data`;function Ct(e){return Array.isArray(e?.transitions)&&e.transitions.length>0&&(e.provenance||[]).some(e=>e?.source===St)}function wt(e){let t=String(e||``).toLowerCase();return(D.records||[]).find(e=>e.key===t||String(e.formula||``).toLowerCase()===t)||null}function Tt(e){let t=String(e||``),n=t?t[0].toUpperCase()+t.slice(1).toLowerCase():``;return(mt.records||[]).find(e=>e.symbol===n)||null}function Et(e){let t=String(e||``).trim().toLowerCase();if(!t)return null;let n=(l.compounds||[]).find(e=>String(e.materialKey||``).toLowerCase()===t||String(e.formula||``).toLowerCase()===t)||(l.elements||[]).find(e=>String(e.materialKey||``).toLowerCase()===t||String(e.formula||``).toLowerCase()===t)||null;if(!n)return null;let r=Number(n.thermodynamic?.meltingPointK??300),i=Number(n.thermodynamic?.boilingPointK??1e3),a=Number(n.mechanical?.densityKgPerM3??1e3),o=Number(n.thermodynamic?.heatCapacityCpJPerKgK??1e3),s=Number(n.thermodynamic?.thermalConductivityWPerMK??1);return Object.freeze({schema:`ulg.foundation-polytope-compound-record.v1`,key:String(n.materialKey).toLowerCase(),formula:n.formula||n.materialKey,accuracyTier:n.accuracyTier,closureHash:n.closureHash,phases:Object.freeze([Object.freeze({name:`solid`,temperatureRangeK:[0,r],densityKgPerM3:a,heatCapacityJPerKgK:o,thermalConductivityWPerMK:s}),Object.freeze({name:`liquid`,temperatureRangeK:[r,i],densityKgPerM3:a*.92,heatCapacityJPerKgK:o*1.15,thermalConductivityWPerMK:s*.6}),Object.freeze({name:`gas`,temperatureRangeK:[i,1e6],densityKgPerM3:Math.max(.08,(n.nuclear?.molarMassU||28)*.04),heatCapacityJPerKgK:o*.9,thermalConductivityWPerMK:.03})]),transitions:Object.freeze([Object.freeze({name:`melting`,temperatureK:r,latentHeatJPerKg:Number(n.thermodynamic?.latentHeatFusionJPerKg??1e5)}),Object.freeze({name:`boiling`,temperatureK:i,latentHeatJPerKg:Number(n.thermodynamic?.latentHeatVaporizationJPerKg??1e6)})]),provenance:Object.freeze([Object.freeze({family:`phase-transitions`,source:`ulg-gate2-foundation-polytope-atlas`,method:`recursive-compound-first-principles-derivation`,status:`reduced-estimate`,accuracyTier:n.accuracyTier,closureHash:n.closureHash,scientificValidation:!1})])})}function Dt(e,{preferFoundationPolytopeAtlas:t=!1}={}){if(t===!0){let t=Et(e);if(t)return{record:t,bank:`foundation-polytope-atlas`}}let n=wt(e);if(n&&Ct(n))return{record:n,bank:`compounds`};let r=Tt(e);return r&&Ct(r)?{record:r,bank:`elements`}:null}function Ot(e,t){return(e.transitions||[]).find(e=>e.name===t)||null}function kt(e,t){return(e.phases||[]).find(e=>e.name===t)||null}function At(e,t){return(e.provenance||[]).find(e=>e?.family===t)||null}function jt(e,t,n){let r=At(e,`thermal-conductivity`)??At(e,`phase-mechanics-optical`)??null;return{schema:`peercompute.ulg.material-thermal-conductivity-provenance.v0`,status:r?.status??`reference-fallback`,source:r?.source??`material-property-reference-bank`,method:r?.method??`bank reference value held constant within runtime phase segment`,units:r?.units??`W/(m K)`,referenceState:r?.referenceState??e.referenceState??null,quality:r?.quality??null,applicationPolicy:r?.applicationPolicy??`reference-state-value-held-constant-within-runtime-phase`,references:[...r?.references||[]],bank:t,record:e.key||e.symbol||null,phase:n}}var Mt=new Map((ft?.records||[]).filter(e=>e?.formula&&e.bandCenterEv>0).map(e=>[e.formula,e]));function Nt(e,t){let n=e?.formula,r=n?Mt.get(n):null,i=(e?.phases||[]).some(e=>e?.name===`gas`);if(!r||!i)return{properties:e,anchored:!1,residuals:null,anchoredPaths:[]};let a={gasElectronicBand:{derivedExcitationEv:e.gasElectronicExcitationEv??null,referenceBandCenterEv:r.bandCenterEv}},o=[`gasElectronicExcitationEv`,`gasElectronicBandFwhmEv`,`gasElectronicOscillatorStrength`],s=r.absorptionCrossSection?{...r.absorptionCrossSection,wavelengthNm:[...r.absorptionCrossSection.wavelengthNm||[]],crossSectionM2:[...r.absorptionCrossSection.crossSectionM2||[]]}:null;return s&&o.push(`gasElectronicAbsorptionCrossSection`),{properties:{...e,gasElectronicExcitationEv:r.bandCenterEv,gasElectronicBandFwhmEv:r.bandFwhmEv??null,gasElectronicOscillatorStrength:r.oscillatorStrength??null,...s?{gasElectronicAbsorptionCrossSection:s}:{},referenceBankAnchoring:{schema:`peercompute.ulg.material-reference-bank-anchoring.v0`,bank:e.referenceBankAnchoring?.bank??`molecular-electronic-bands`,recordSchema:e.referenceBankAnchoring?.recordSchema??ft.schema,source:e.referenceBankAnchoring?.source??ft.source,derivationResiduals:{...e.referenceBankAnchoring?.derivationResiduals||{},...a}},propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],K({paths:o,status:G.REFERENCE_FALLBACK,source:`material-property-reference-bank`,method:s?`gas-phase band centre plus measured wavelength-resolved absorption cross section; derived ΔSCF/Gaussian values retained as fallbacks and derivationResiduals`:`gas-phase electronic band centre/FWHM/oscillator strength anchored to spectroscopic absorption maxima; derived ΔSCF value retained as derivationResiduals`,inputs:s?[r.formula,s.doi]:[r.formula]})],notes:[...e.propertyProvenance?.notes||[],`Gas electronic band anchored to spectroscopic reference (${r.formula}); derivation residuals recorded.`]}},anchored:!0,residuals:a,anchoredPaths:o}}function Pt(e,t){let n=N(t),r=n?M(n.symbol):null;if(!n||!r)return{properties:e,anchored:!1,residuals:null,anchoredPaths:[]};let i=c.photonEnergyEv||[],a={schema:c.schema,bankVersion:c.bankVersion,symbol:n.symbol,source:c.source,doi:c.doi,referencePhase:c.referenceState?.phase??`solid`,energyRangeEv:i.length>0?[i[0],i.at(-1)]:null,applicationPolicy:`measured-solid-spectrum-with-labelled-nearest-condensed-phase-extrapolation`},o=[r.r,r.g,r.b],s={conductorOpticalConstants:{derivedIntrinsicColorSrgb:e?.intrinsicColorSrgb??null,referenceComplexIndexColorSrgb:o,recordSymbol:n.symbol,bankVersion:c.bankVersion}},l=[`conductorOpticalConstants`,`intrinsicColorSrgb`],u={bank:`conductor-optical-constants`,schema:c.schema,bankVersion:c.bankVersion,symbol:n.symbol,source:c.source,doi:c.doi};return{properties:{...e,conductorOpticalConstants:a,intrinsicColorSrgb:o,referenceBankAnchoring:{schema:`peercompute.ulg.material-reference-bank-anchoring.v0`,bank:e.referenceBankAnchoring?.bank??`conductor-optical-constants`,recordSchema:e.referenceBankAnchoring?.recordSchema??c.schema,source:e.referenceBankAnchoring?.source??c.source,referenceDatasets:[...e.referenceBankAnchoring?.referenceDatasets||[],u],derivationResiduals:{...e.referenceBankAnchoring?.derivationResiduals||{},...s}},propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],K({paths:l,status:G.REFERENCE_FALLBACK,source:`material-property-reference-bank`,method:`measured complex refractive index n,k anchors conductor optics; lower-level Drude-Lorentz color retained as derivationResiduals`,inputs:[n.symbol,c.bankVersion,c.doi]})],notes:[...e.propertyProvenance?.notes||[],`Conductor optical constants anchored to ${c.doi} (${n.symbol}); derived color retained as a residual.`]}},anchored:!0,residuals:s,anchoredPaths:l}}function Ft(e,t){let n=Number(e?.molarMassKgPerMol);if(!(n>0))return null;let r=Array.isArray(e?.phases)?e.phases:[],i=r.find(e=>e?.name===`liquid`&&Number(e?.densityKgPerM3)>0)??r.find(e=>e?.name===`solid`&&Number(e?.densityKgPerM3)>0),a=Number(i?.densityKgPerM3),o=a>0?n/a:25e-6,s=.841*Math.cbrt(o/602214076e15),c=e?.phaseTransitions,l=Number(e?.boilingPointK)||Number(Array.isArray(c)?c.find(e=>e?.name===`boiling`)?.temperatureK:c?.boiling?.temperatureK)||273.15,u=1.15*Math.max(4,l)*1380649e-29,d=Math.max(20,Number(t?.referenceTemperatureK)||Math.max(298.15,l*1.05)),f=Number(t?.specificHeatCapacityJPerKgK);return bt({molarMassKgPerMol:n,sigmaM:s,epsilonJ:u,temperatureK:d,cvMolarJPerMolK:f>0?f*n:1.5*8.314462618})}function It(e,t){let n=wt(t)??Tt(t),r=At(n||{},`gas-transport`),i=n?kt(n,`gas`):null,a=e?.phases,o=Array.isArray(a)?a.findIndex(e=>e?.name===`gas`):-1,s=Number(i?.thermalConductivityWPerMK),c=Number(i?.dynamicViscosityPaS),l=o>=0?Ft(e,a[o]):null;if(!r||r.source!==St||o<0||!(s>0)){if(o>=0&&l&&!(Number(a[o]?.dynamicViscosityPaS)>0)){let n=a[o],r={...n,thermalConductivityWPerMK:Number(n.thermalConductivityWPerMK)>0?n.thermalConductivityWPerMK:l.thermalConductivityWPerMK,dynamicViscosityPaS:l.dynamicViscosityPaS,thermalConductivityProvenance:{schema:`peercompute.ulg.material-thermal-conductivity-provenance.v0`,status:G.PHYSICAL_LAW,source:`pair-potential-chapman-enskog`,method:l.method,units:`W/(m K), Pa s`,transportTemperatureK:l.temperatureK,reducedTemperature:l.reducedTemperature,omega22:l.omega22}},i=[`phases.gas.dynamicViscosityPaS`];return Number(n.thermalConductivityWPerMK)>0||i.unshift(`phases.gas.thermalConductivityWPerMK`),{properties:{...e,phases:a.map((e,t)=>t===o?r:e),propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],K({paths:i,status:G.PHYSICAL_LAW,source:`pair-potential-chapman-enskog`,method:`${l.method} at ${l.temperatureK.toFixed(1)} K`,inputs:[String(t)]})],notes:[...e.propertyProvenance?.notes||[],`Dilute-gas transport (k, mu) derived via Chapman-Enskog / Modified Eucken for ${String(t)}.`]}},anchored:!1,residuals:{gasTransportChapmanEnskog:l},anchoredPaths:[]}}return{properties:e,anchored:!1,residuals:null,anchoredPaths:[]}}let u=a[o],d={...u,thermalConductivityWPerMK:s,thermalConductivityProvenance:{schema:`peercompute.ulg.material-thermal-conductivity-provenance.v0`,status:r.status??`reference-fallback`,source:r.source,method:r.method,units:r.units??`W/(m K), Pa s`,referenceState:r.referenceState??n.referenceState??null,quality:r.quality??null,applicationPolicy:r.applicationPolicy??`dilute-gas reference value held constant within the runtime gas phase segment`,references:[...r.references||[]],bank:n.symbol?`elements`:`compounds`,record:n.key||n.symbol||null,phase:`gas`,family:`gas-transport`,transportTemperatureK:Number(i.transportTemperatureK)||null},...c>0?{dynamicViscosityPaS:c}:{}},f=[`phases.gas.thermalConductivityWPerMK`];c>0&&f.push(`phases.gas.dynamicViscosityPaS`);let p={gasTransport:{derivedThermalConductivityWPerMK:u.thermalConductivityWPerMK??l?.thermalConductivityWPerMK??null,referenceThermalConductivityWPerMK:s,derivedDynamicViscosityPaS:u.dynamicViscosityPaS??l?.dynamicViscosityPaS??null,referenceDynamicViscosityPaS:c>0?c:null,chapmanEnskogDerived:l}};return{properties:{...e,phases:a.map((e,t)=>t===o?d:e),referenceBankAnchoring:{schema:`peercompute.ulg.material-reference-bank-anchoring.v0`,...e.referenceBankAnchoring||{},bank:e.referenceBankAnchoring?.bank??(n.symbol?`elements`:`compounds`),source:e.referenceBankAnchoring?.source??St,derivationResiduals:{...e.referenceBankAnchoring?.derivationResiduals||{},...p}},propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],K({paths:f,status:G.REFERENCE_FALLBACK,source:`material-property-reference-bank`,method:`dilute-gas thermal conductivity and dynamic viscosity at ${r.referenceState} (${r.method})`,inputs:[n.formula??n.symbol??String(t)]})],notes:[...e.propertyProvenance?.notes||[],`Gas transport (k, mu) anchored to the reference bank for ${n.formula??n.symbol}.`]}},anchored:!0,residuals:p,anchoredPaths:f}}function Lt(e,t){let n=Rt(e,t),r=Nt(n.properties,t),i=Pt(r.properties,t),a=It(i.properties,t),o=[n,r,i,a].filter(e=>e.anchored);return o.length===0?{properties:a.properties,anchored:!1,residuals:a.residuals??null,anchoredPaths:[]}:{properties:a.properties,anchored:!0,residuals:Object.assign({},...o.map(e=>e.residuals||{})),anchoredPaths:o.flatMap(e=>e.anchoredPaths||[])}}function Rt(e,t){let n=Dt(t);if(!n||!e?.phases?.length)return{properties:e,anchored:!1,residuals:null,anchoredPaths:[]};let{record:r,bank:i}=n,a=Ot(r,`melting`),o=Ot(r,`boiling`);if(!a&&!o)return{properties:e,anchored:!1,residuals:null,anchoredPaths:[]};let s={},c=[],l=e.phases.map(e=>({...e})),u=(e.transitions||[]).map(e=>({...e})),d=(e,t,n,r)=>{if(!n)return;let i=u.find(n=>n.from===e&&n.to===t);i&&(s[r]={derivedTemperatureK:i.temperatureK,referenceTemperatureK:n.temperatureK,derivedLatentHeatJPerKg:i.latentHeatJPerKg,referenceLatentHeatJPerKg:n.latentHeatJPerKg},i.temperatureK=n.temperatureK,i.latentHeatJPerKg=n.latentHeatJPerKg,c.push(`transitions.${e}->${t}.temperatureK`,`transitions.${e}->${t}.latentHeatJPerKg`))};d(`solid`,`liquid`,a,`melting`),d(`liquid`,`gas`,o,`boiling`);let f=u.some(e=>e.from===`solid`&&e.to===`liquid`);if(a&&!f&&l.some(e=>e.name===`liquid`)){u.unshift({from:`solid`,to:`liquid`,temperatureK:a.temperatureK,latentHeatJPerKg:a.latentHeatJPerKg}),c.push(`transitions.solid->liquid.temperatureK`,`transitions.solid->liquid.latentHeatJPerKg`),s.melting={derivedTemperatureK:null,referenceTemperatureK:a.temperatureK,derivedLatentHeatJPerKg:null,referenceLatentHeatJPerKg:a.latentHeatJPerKg};let e=l.find(e=>e.name===`liquid`);if(Array.isArray(e?.temperatureRange)&&(e.temperatureRange=[a.temperatureK,e.temperatureRange[1]]),!l.some(e=>e.name===`solid`)){let t=kt(r,`solid`),n=Number(t?.densityKgPerM3)>0?Number(t.densityKgPerM3):Number(e?.densityKgPerM3)||2e3,i=Number(t?.heatCapacityJPerKgK??t?.cpJPerKgK)>0?Number(t.heatCapacityJPerKgK??t.cpJPerKgK):Number(e?.cpJPerKgK)||800,o=Number(e?.bulkModulusPa)>0?Number(e.bulkModulusPa):1e9;l.unshift({name:`solid`,cpJPerKgK:i,densityKgPerM3:n,temperatureRange:[0,a.temperatureK],bulkModulusPa:o,shearModulusPa:0}),c.push(`phases.solid.temperatureRange`,`phases.solid.densityKgPerM3`,`phases.solid.cpJPerKgK`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`)}}let p=u.some(e=>e.from===`liquid`&&e.to===`gas`);if(o&&!p&&l.some(e=>e.name===`liquid`)){u.push({from:`liquid`,to:`gas`,temperatureK:o.temperatureK,latentHeatJPerKg:o.latentHeatJPerKg}),c.push(`transitions.liquid->gas.temperatureK`,`transitions.liquid->gas.latentHeatJPerKg`),s.boiling={derivedTemperatureK:null,referenceTemperatureK:o.temperatureK,derivedLatentHeatJPerKg:null,referenceLatentHeatJPerKg:o.latentHeatJPerKg};let t=l.find(e=>e.name===`liquid`);if(Array.isArray(t?.temperatureRange)&&(t.temperatureRange=[t.temperatureRange[0],o.temperatureK]),!l.some(e=>e.name===`gas`)){let t=Number(e.molarMassKgPerMol)||0,n=t>0?101325*t/(8.314462618*o.temperatureK):.5,r=t>0?29.100619163/t:1e3;l.push({name:`gas`,cpJPerKgK:r,densityKgPerM3:n,temperatureRange:[o.temperatureK,1e6],bulkModulusPa:null,shearModulusPa:0}),c.push(`phases.gas.temperatureRange`,`phases.gas.densityKgPerM3`,`phases.gas.cpJPerKgK`,`phases.gas.bulkModulusPa`,`phases.gas.shearModulusPa`)}}for(let e of l){let t=Array.isArray(e.temperatureRange)?[...e.temperatureRange]:null;t&&(e.name===`solid`&&a&&(t[1]=a.temperatureK),e.name===`liquid`&&(a&&(t[0]=a.temperatureK),o&&(t[1]=o.temperatureK)),e.name===`gas`&&o&&(t[0]=o.temperatureK),e.temperatureRange=t,c.push(`phases.${e.name}.temperatureRange`));let n=kt(r,e.name);if(n){Number.isFinite(n.densityKgPerM3)&&n.densityKgPerM3>0&&(s[`${e.name}Density`]={derivedDensityKgPerM3:e.densityKgPerM3,referenceDensityKgPerM3:n.densityKgPerM3},e.densityKgPerM3=n.densityKgPerM3,c.push(`phases.${e.name}.densityKgPerM3`));let t=n.heatCapacityJPerKgK??n.cpJPerKgK;Number.isFinite(t)&&t>0&&(s[`${e.name}Cp`]={derivedCpJPerKgK:e.cpJPerKgK,referenceCpJPerKgK:t},e.cpJPerKgK=t,c.push(`phases.${e.name}.cpJPerKgK`));let a=n.thermalConductivityWPerMK;Number.isFinite(a)&&a>0&&(s[`${e.name}ThermalConductivity`]={derivedThermalConductivityWPerMK:e.thermalConductivityWPerMK??null,referenceThermalConductivityWPerMK:a},e.thermalConductivityWPerMK=a,e.thermalConductivityProvenance=jt(r,i,e.name),c.push(`phases.${e.name}.thermalConductivityWPerMK`));let o=n.dynamicViscosityPaS;Number.isFinite(o)&&o>=0&&(s[`${e.name}DynamicViscosity`]={derivedDynamicViscosityPaS:e.dynamicViscosityPaS??null,referenceDynamicViscosityPaS:o},e.dynamicViscosityPaS=o,c.push(`phases.${e.name}.dynamicViscosityPaS`));let l=n.surfaceTensionNPerM;Number.isFinite(l)&&l>=0&&(s[`${e.name}SurfaceTension`]={derivedSurfaceTensionNPerM:e.surfaceTensionNPerM??null,referenceSurfaceTensionNPerM:l},e.surfaceTensionNPerM=l,c.push(`phases.${e.name}.surfaceTensionNPerM`))}}return{properties:{...e,phases:l,transitions:u,referenceBankAnchoring:{schema:`peercompute.ulg.material-reference-bank-anchoring.v0`,bank:i,recordSchema:r.schema,source:St,derivationResiduals:s},propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],K({paths:c,status:G.REFERENCE_FALLBACK,source:`material-property-reference-bank`,method:`bank reference anchoring (${i}); derived values retained as derivationResiduals`,inputs:[r.key||r.symbol||String(t)]})],notes:[...e.propertyProvenance?.notes||[],`Phase boundaries anchored to ${i} reference bank; derivation residuals recorded.`]}},anchored:!0,residuals:s,anchoredPaths:c}}var zt=8.314462618,Bt=1.4387768766;function Vt(e){let t=e.map(e=>h[e.Z-1]),n=t.reduce((e,t)=>e+t,0),r=[0,0,0];e.forEach((e,n)=>{for(let i=0;i<3;i+=1)r[i]+=t[n]*e.position[i]});for(let e=0;e<3;e+=1)r[e]/=n;let i=[[0,0,0],[0,0,0],[0,0,0]];return e.forEach((e,n)=>{let a=e.position.map((e,t)=>e-r[t]),o=a[0]*a[0]+a[1]*a[1]+a[2]*a[2];for(let e=0;e<3;e+=1)for(let r=0;r<3;r+=1)i[e][r]+=t[n]*((e===r?o:0)-a[e]*a[r])}),g(i,3).values.slice().sort((e,t)=>e-t)}function Ht(e){if(e.length<=2)return!0;let t=Vt(e),n=t[2];return t[0]<.001*n}function Ut(e,t){if(e<=0)return 0;let n=Bt*e/t;if(n>60)return 0;let r=Math.exp(n);return n*n*r/((r-1)*(r-1))}function Wt(e,t,n){let r=Ht(e),i=r?1:1.5,a=0;for(let e of t)a+=Ut(e,n);let o=1.5+i+a;return{cvJPerMolK:o*zt,cpJPerMolK:(o+1)*zt,linear:r,rotationalDof:r?2:3,vibrationalCvOverR:a}}var Gt={schema:`peercompute.ulg.molecular-vibrations-bank.v1`,method:`rhf-sto3g-optimized-geometry-numerical-hessian-harmonic-frequencies`,generatorFingerprint:`ulg:55e32a93`,records:[{schema:`peercompute.ulg.molecular-vibrations-record.v1`,key:`H2O`,formula:`H2O`,status:`harmonic-minimum-closed`,method:`rhf-sto3g-optimized-geometry-numerical-hessian-harmonic-frequencies`,linear:!1,optimizedAtoms:[{Z:8,positionBohr:[0,0,0]},{Z:1,positionBohr:[1.4325157,0,1.201428]},{Z:1,positionBohr:[-1.4325157,0,1.201428]}],vibrationsCm1:[2169.67,4140.12,4397.72],expectedModeCount:3,internalCoordinateSummary:{method:`internal-coordinate-golden-section-descent`,bondLengthBohr:1.86963,bendAngleDeg:100.028,energyHa:-74.96590125},molarMassKgPerMol:.01801499999,cpJPerMolKAt298K:33.2837,derivationMs:26190},{schema:`peercompute.ulg.molecular-vibrations-record.v1`,key:`CO2`,formula:`CO2`,status:`harmonic-minimum-closed`,method:`rhf-sto3g-optimized-geometry-numerical-hessian-harmonic-frequencies`,linear:!0,optimizedAtoms:[{Z:6,positionBohr:[0,0,0]},{Z:8,positionBohr:[2.2448936,0,.0012932263]},{Z:8,positionBohr:[-2.2448936,0,.0012932263]}],vibrationsCm1:[565.611,565.845,1436.81,2534.99],expectedModeCount:4,internalCoordinateSummary:{method:`internal-coordinate-golden-section-descent`,bondLengthBohr:2.24489,bendAngleDeg:179.934,energyHa:-185.0683905},molarMassKgPerMol:.04400899998,cpJPerMolKAt298K:38.747,derivationMs:625650}]},Kt=`peercompute.ulg.reference-material-fixture.v0`,qt=Object.freeze({gasConstantJPerMolK:8.314462618,avogadroPerMol:602214076e15,standardAtmospherePa:101325}),Jt=Object.freeze({h2o:{schema:Kt,key:`h2o`,name:`water`,formula:`H2O`,molarMassKgPerMol:.0180153,densityKgPerM3:{solid:917,liquid:1e3,gas:.804},meltingPointK:273.15,boilingPointK:373.15,latentHeatFusionJPerKg:333550,latentHeatVaporizationJPerKg:2256e3,cpJPerKgK:{solid:2090,liquid:4186,gas:1996},provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Standard reference constants for H2O ice/liquid/vapor near 1 atm.`,`Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).`]}},fe:{schema:Kt,key:`fe`,name:`iron`,formula:`Fe`,molarMassKgPerMol:.055845,densityKgPerM3:{solid:7874,liquid:7e3},meltingPointK:1811,latentHeatFusionJPerKg:247e3,cpJPerKgK:{solid:449,liquid:820},provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Standard reference constants for solid/liquid Fe.`,`Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).`]}},air:{schema:Kt,key:`air`,name:`air`,formula:`N2-O2-Ar mixture`,molarMassKgPerMol:.0289647,cpJPerKgK:1005,cvJPerKgK:718,provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Dry-air mean molar mass and specific heats near standard conditions.`,`Sealed rigid box uses cv (constant volume); humidity/condensation deferred to demo plan P5.`]}}});function Yt(e,t){let n=Number(e);if(!Number.isFinite(n)||n<=0)throw TypeError(`${t} must be a positive finite number`);return n}function Xt({pressurePa:e,temperatureK:t,molarMassKgPerMol:n}={}){let r=Yt(e,`pressurePa`),i=Yt(t,`temperatureK`);return r*Yt(n,`molarMassKgPerMol`)/(qt.gasConstantJPerMolK*i)}var Zt=8.314462618;function Qt({meltingPointK:e,molarMassKgPerMol:t,entropyOfFusionJPerMolK:n=Zt}){return e*n/t}var $t=1.8897259886,en=602214076e15,tn=8.314462618,nn=27.211386245988,rn=43597447222071e-31,an=1e6,on=273.15,sn=18,cn=`reference-index-runtime-radius-sphere-optics`,ln=cn,un=Object.freeze([`h2o-condensate-size-distribution-not-produced`,`h2o-visible-complex-index-spectrum-not-reference-anchored`,`compact-carrier-optics-resolution-dependence-not-validated`,`sphere-efficiency-regime-transition-not-scientifically-validated`]);function dn({condensedDensityKgPerM3:e}={}){let t=Number(e);if(!Number.isFinite(t)||!(t>0))throw RangeError(`H2O dispersed-medium optical closure requires positive condensed density`);let n=_();return Object.freeze({schema:i,morphologyModel:a.singleCompactSphereComplexIndex,condensedDensityKgPerM3:t,relativeRefractiveIndexN:n.relativeRefractiveIndexN,relativeExtinctionCoefficientK:n.relativeExtinctionCoefficientK,largeSizeRayAsymmetryFactorG:n.largeSizeRayAsymmetryFactorG,referenceWavelengthM:n.referenceWavelengthM,provenance:Object.freeze({status:G.REFERENCE_FALLBACK,source:cn,accuracy:`physical-sphere-efficiency-model-unvalidated-and-resolution-dependent`,method:`derive compact-sphere radius from conserved condensed mass and density, then evaluate ${y} from relative visible refractive index, lossless-dielectric k, and reference wavelength`,opticalInputs:n.provenance,densitySource:Object.freeze({status:G.REFERENCE_FALLBACK,source:`h2o-reference-liquid-density`,method:`declared liquid-water density copied without optical interpretation`}),blockers:un}),scientificValidation:!1})}function fn({densitySource:e,densityMethod:t,densityInputs:n=[]}={}){if(typeof e!=`string`||e.length===0)throw TypeError(`H2O dispersed-medium density provenance requires a source`);if(typeof t!=`string`||t.length===0)throw TypeError(`H2O dispersed-medium density provenance requires a method`);return[K({paths:[`dispersedMediumOpticalClosure.schema`,`dispersedMediumOpticalClosure.scientificValidation`],status:G.EXACT_CONSTANT,source:`ulg-gpu-abi-contract`,method:`typed dispersed-medium optical property schema with an explicit false validation claim`}),K({paths:[`dispersedMediumOpticalClosure.condensedDensityKgPerM3`],status:G.REFERENCE_FALLBACK,source:e,method:t,inputs:n,blockers:[`h2o-condensed-phase-md-or-dft-eos-not-produced`]}),K({paths:[`dispersedMediumOpticalClosure.morphologyModel`,`dispersedMediumOpticalClosure.relativeRefractiveIndexN`,`dispersedMediumOpticalClosure.relativeExtinctionCoefficientK`,`dispersedMediumOpticalClosure.largeSizeRayAsymmetryFactorG`,`dispersedMediumOpticalClosure.referenceWavelengthM`,`dispersedMediumOpticalClosure.provenance`],status:G.REFERENCE_FALLBACK,source:cn,accuracy:`physical-sphere-efficiency-model-unvalidated-and-resolution-dependent`,method:`runtime conserved-mass radius plus relative visible refractive index feed ${y}; the lossless k=0 approximation avoids treating render-scaled absorption as quantitative optical data`,inputs:[`already-conserved-condensed-mass`,`h2o-reference-liquid-density`,`hale-querry-1973-liquid-water-visible-index-550nm-lossless-approximation`],blockers:un})]}function pn(e){let t=e.phases?.find(e=>e?.name===`liquid`)?.densityKgPerM3;return{...e,dispersedMediumOpticalClosure:dn({condensedDensityKgPerM3:t}),propertyProvenance:{...e.propertyProvenance||{},entries:[...e.propertyProvenance?.entries||[],...fn({densitySource:`material-property-reference-bank`,densityMethod:`reference-bank liquid-water density copied into the dispersed-condensate closure`,densityInputs:[`h2o:liquid:densityKgPerM3`]})],notes:[...e.propertyProvenance?.notes||[],`Dispersed H2O optics are explicitly unvalidated and resolution-dependent; no droplet radius or size distribution is invented.`]}}}var mn=2,hn=.07,gn=.35,_n=.8,vn=.14,yn=Object.freeze({h2:{formula:`H2`,phaseModel:`ideal-gas`},o2:{formula:`O2`,phaseModel:`ideal-gas`},n2:{formula:`N2`,phaseModel:`ideal-gas`},co2:{formula:`CO2`,phaseModel:`ideal-gas`},ar:{formula:`Ar`,phaseModel:`ideal-gas`},h2o:{formula:`H2O`,phaseModel:`molecular-condensed`},air:{phaseModel:`ideal-gas-mixture`,components:[{formula:`N2`,moleFraction:.7808},{formula:`O2`,moleFraction:.2095},{formula:`Ar`,moleFraction:.0093},{formula:`CO2`,moleFraction:4e-4}]}}),bn=Object.freeze({H:{formula:`H2`,phaseModel:`ideal-gas`},N:{formula:`N2`,phaseModel:`ideal-gas`},O:{formula:`O2`,phaseModel:`ideal-gas`},F:{formula:`F2`,phaseModel:`ideal-gas`},Cl:{formula:`Cl2`,phaseModel:`ideal-gas`},Br:{formula:`Br2`,phaseModel:`molecular-condensed`},I:{formula:`I2`,phaseModel:`molecular-condensed`}});function xn(e){let t=typeof e==`string`?e[0].toUpperCase()+e.slice(1).toLowerCase():``,n=bn[t];return n?{...n,elementSymbol:t,elementalMolecularReference:!0,source:`ambient-elemental-molecular-reference-state`}:null}function Sn(e,t,n=1){for(let[r,i]of Object.entries(t))e[r]=(e[r]||0)+i*n;return e}function Cn(e){if(typeof e!=`string`||e.length===0)throw TypeError(`formula must be a non-empty string`);let t=0,n=()=>{let n=``;for(;t<e.length&&/[0-9]/.test(e[t]);)n+=e[t++];return n?Number(n):1},r=()=>{let i={};for(;t<e.length;){let a=e[t];if(a===`)`){t+=1;break}if(a===`(`){t+=1,Sn(i,r(),n());continue}if(!/[A-Z]/.test(a))throw Error(`invalid formula '${e}' at '${a}'`);let o=e[t++];t<e.length&&/[a-z]/.test(e[t])&&(o+=e[t++]);let s=A(o);if(s==null)throw Error(`unknown element symbol '${o}' in formula '${e}'`);i[s]=(i[s]||0)+n()}return i},i=r();if(t!==e.length)throw Error(`could not parse formula '${e}'`);return i}function wn(e){return Object.entries(e).sort(([e],[t])=>Number(e)-Number(t)).map(([e,t])=>`${C(Number(e))}${t===1?``:t}`).join(``)}function Tn(e){return Object.entries(e).reduce((e,[t,n])=>e+Number(n)*b(Number(t))*en,0)}function En(e){return Object.values(e).reduce((e,t)=>e+t,0)}function Dn(e){let t=[];for(let[n,r]of Object.entries(e).sort(([e],[t])=>Number(t)-Number(e)))for(let e=0;e<r;e+=1)t.push(Number(n));return t}function On(e,t){if(t===1)return[0,0,1];let n=Math.acos(1-2*(e+.5)/t),r=Math.PI*(1+Math.sqrt(5))*e;return[Math.sin(n)*Math.cos(r),Math.sin(n)*Math.sin(r),Math.cos(n)]}function kn(e){let t=Dn(e);if(t.length===0)return[];if(t.length===1)return[{Z:t[0],position:[0,0,0]}];if(t.length===2){let e=1.15*$t;return[{Z:t[0],position:[0,0,-.5*e]},{Z:t[1],position:[0,0,.5*e]}]}let n=e=>{let t=E(e);return Math.min(t,Math.max(1,8-t))},r=0;for(let e=1;e<t.length;e+=1)n(t[e])>n(t[r])&&(r=e);let i=[{Z:t.splice(r,1)[0],position:[0,0,0]}],a=1*$t;return t.forEach((e,n)=>{let r=On(n,t.length);i.push({Z:e,position:r.map(e=>e*a)})}),i}var An=24;function jn(e){let t=Number(e);return t<=2?1:t<=10?5:9}function Mn(e){let t=0;for(let[n,r]of Object.entries(e||{})){let e=Number(n);if(!(e<=sn))return!1;t+=jn(e)*Math.max(0,Number(r)||0)}return t>0&&t<=An}function Nn(e){if(!Array.isArray(e)||e.length===0)return null;let t=0;for(let n of e){if(!(Number(n?.Z)<=sn))return null;t+=jn(n.Z)}if(t>An)return null;try{let t=F(e),n=t.orbitalEnergies;if(n&&t.nOcc>0&&t.nOcc<n.length){let e=(n[t.nOcc]-n[t.nOcc-1])*nn;if(!(e>0))return{color:[.55,.55,.58],gapEv:e};let r=1239.841984/e;if(r<380)return{color:[.93,.95,.97],gapEv:e};if(r>780)return{color:[.3,.28,.32],gapEv:e};let i=(r-380)/400;return{color:[Math.max(.08,1-.9*(1-i)),Math.max(.08,1-.55*Math.sin(Math.PI*i)),Math.max(.08,1-.9*i)],gapEv:e}}}catch{}return null}var Pn=new Map;function Fn(e,t){if(!Mn(e)||!Array.isArray(t)||t.length<2)return null;let n=wn(e);if(Pn.has(n))return Pn.get(n);let r=In(e,t);return Pn.set(n,r),r}function In(e,t){let n=Object.entries(e).reduce((e,[t,n])=>e+Number(t)*Number(n),0);if(!Number.isFinite(n)||n<2||n%2!=0)return null;try{let n=zn.get(wn(e)),r=n?n.optimizedAtoms.map(e=>({Z:e.Z,position:[...e.positionBohr]})):null,i=null;if(r)i=s(r,{multiplicity:1});else{let e=e=>t.map(t=>({Z:t.Z,position:t.position.map(t=>t*e)})),n=null;for(let t=.9;t<=1.6001;t+=.1){let r=null;try{r=s(e(t),{multiplicity:1})}catch{continue}r?.scfConverged&&(!n||r.totalEnergyHa<n.energyHa)&&(n={s:t,energyHa:r.totalEnergyHa,result:r})}if(!n)return null;for(let t of[n.s-.05,n.s+.05])try{let r=s(e(t),{multiplicity:1});r?.scfConverged&&r.totalEnergyHa<n.energyHa&&(n={s:t,energyHa:r.totalEnergyHa,result:r})}catch{}r=e(n.s),i=n.result}let a=s(r,{multiplicity:3});if(!i?.scfConverged||!a?.scfConverged)return null;let o=(a.totalEnergyHa-i.totalEnergyHa)*nn;return o>0?o:null}catch{return null}}function Ln(e,t){let n=0,r=0,i=0,a=0;for(let[o,s]of Object.entries(e)){let e=Number(o),c=Number(s),l=Je(e,t),u=l.densityKgPerM3??0,d=u>0?b(e)/u:b(e)/1;n+=c*d,r+=c*d*(l.bulkModulusPa??1e5),i+=c*(l.conductionElectronDensityPerM3??0)*d,a+=c}return{volumePerFormulaM3:n,bulkPa:n>0?r/n:1e5,conductionElectronDensityPerM3:n>0?i/n:null,totalAtoms:a}}function Rn(e,t,n,r={}){if(Mn(e))try{let e=d(t,{moleculeOptions:r.moleculeOptions||{}});if(e.atomizationEnergyHa>0)return{value:e.atomizationEnergyHa*rn*hn,source:`molecular-hartree-fock-atomization-energy`,atomizationEnergyHa:e.atomizationEnergyHa}}catch{}try{let e=lt(t,r.allElementMolecularOptions||{}),n=e.atomicReferenceEnergyHa-e.totalEnergyHa;if(n>0)return{value:n*rn*hn,source:`all-element-atomic-kohn-sham-tight-binding-atomization-energy`,atomizationEnergyHa:n}}catch{}return{value:Math.max(1e-22,n.bulkPa*n.volumePerFormulaM3*gn),source:`atomic-dft-derived-elemental-cohesion-density`,atomizationEnergyHa:null}}var zn=new Map((Gt?.records||[]).filter(e=>e?.status===`harmonic-minimum-closed`&&Array.isArray(e.vibrationsCm1)&&Array.isArray(e.optimizedAtoms)&&e.vibrationsCm1.every(e=>e>50&&e<8e3)).map(e=>[e.key,e]));function Bn(e,t,n,r){let i=zn.get(wn(e));if(i){let e=Wt(i.optimizedAtoms.map(e=>({Z:e.Z,position:[...e.positionBohr]})),i.vibrationsCm1,n),t=(1.5+(e.linear?1:1.5)+1)*tn;return{cpJPerKgK:e.cpJPerMolK/r,rigidRotorCpJPerKgK:t/r,linear:e.linear,model:`molecular-rrho-harmonic-vibrations-banked`,method:i.method,vibrationsCm1:[...i.vibrationsCm1]}}if(Mn(e))try{return{cpJPerKgK:Wt(t,[],n).cpJPerMolK/r,model:`molecular-equipartition`,vibrationsCm1:null}}catch{}let a=En(e);return{cpJPerKgK:((1.5+(a<=1?0:a===2?1:1.5))*tn+tn)/r,model:`atom-count-equipartition`,vibrationsCm1:null}}function Vn({key:e=null,formula:t=null,atomCounts:n=null,geometry:r=null,phaseModel:i=`molecular-condensed`,options:a={}}={}){let o=n||Cn(t),s=t||wn(o),c=Tn(o),l=En(o),u=r||kn(o);if(i===`ideal-gas`){let t=Bn(o,u,on,c),n=t.cpJPerKgK,r=Xt({pressurePa:qt.standardAtmospherePa,temperatureK:on,molarMassKgPerMol:c}),i=a?.deriveGasElectronicExcitation?Fn(o,u):null;return Se({molarMassKgPerMol:c,atomsPerFormula:l,formula:s,idealGas:!0,heatCapacityModel:{gas:t.model},gasVibrationsCm1:t.vibrationsCm1,gasElectronicExcitationEv:i,gasElectronicBandFwhmEv:null,gasElectronicOscillatorStrength:null,phases:[{name:`gas`,cpJPerKgK:n,gasVibrationsCm1:t.vibrationsCm1,gasRigidRotorCpJPerKgK:t.rigidRotorCpJPerKgK??null,densityKgPerM3:r,temperatureRange:[0,an],bulkModulusPa:null,shearModulusPa:0}],transitions:[]},{entries:[K({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:G.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`formula molar mass and atom count from parsed chemical formula`,inputs:[s]}),K({paths:[`idealGas`,`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.temperatureRange`,`phases.gas.shearModulusPa`],status:G.PHYSICAL_LAW,source:`molecular-statistical-mechanics+ideal-gas-law`,method:t.vibrationsCm1?`rigid-rotor plus banked harmonic-vibration Einstein heat capacity plus rho=pM/RT`:`rigid-rotor/equipartition heat capacity plus rho=pM/RT`}),K({paths:[`gasElectronicExcitationEv`,`gasElectronicBandFwhmEv`,`gasElectronicOscillatorStrength`],status:G.PHYSICAL_LAW,source:`delta-scf-uhf-vertical-triplet-excitation`,method:`UHF total-energy difference E(triplet)-E(singlet) at the breathing-mode-relaxed ground geometry; null unless derivation requested (reference-bank anchoring supplies runtime band values)`})],notes:[`${e||s} gas closure is derived from formula mass and molecular statistical mechanics.`]})}let d=Ln(o,a),f=d.volumePerFormulaM3*mn,p=c/(en*f),m=Rn(o,u,d,a),h=m.value/f,g=Math.max(1e6,h*_n),_=g*.35,v=H({densityKgPerM3:p,molarMassKgPerMol:c,atomsPerFormula:l}),y=le({soundSpeedMPerS:Math.sqrt(g/p),numberDensityPerM3:v}),b=W(on,{debyeTemperatureK:y,molarMassKgPerMol:c,atomsPerFormula:l}),x=3*tn*l/c,S=(f/Math.max(1,l))**(1/3),C=c/en,w=Math.max(1,vn**2/3*S*S*C*1380649e-29*y*y/1054571817e-43**2),T=Qt({meltingPointK:w,molarMassKgPerMol:c,entropyOfFusionJPerMolK:tn*Math.sqrt(l)}),E=Math.max(m.value*en/c,T*2),D=tn*(10+Math.sqrt(l)),O=Math.max(w*1.15,E*c/D),k=Bn(o,u,O,c),A=k.cpJPerKgK,j=Xt({pressurePa:qt.standardAtmospherePa,temperatureK:O,molarMassKgPerMol:c}),M=Nn(u)||{color:d.conductionElectronDensityPerM3>0?[.74,.74,.76]:[.9,.92,.94],gapEv:null};return Se({molarMassKgPerMol:c,atomsPerFormula:l,formula:s,compound:!0,derivation:`generic-formula-material: ${m.source}; atomic-volume packing; Debye/Lindemann phase model`,intrinsicColorSrgb:M.color,electronicGapEv:M.gapEv,phases:[{name:`solid`,cpJPerKgK:b,densityKgPerM3:p,temperatureRange:[0,w],debyeTemperatureK:y,bulkModulusPa:g,shearModulusPa:_},{name:`liquid`,cpJPerKgK:x*1.1400000000000001,densityKgPerM3:p*(1-3*vn*vn),temperatureRange:[w,O],bulkModulusPa:g*.75,shearModulusPa:0},{name:`gas`,cpJPerKgK:A,gasVibrationsCm1:k.vibrationsCm1,gasRigidRotorCpJPerKgK:k.rigidRotorCpJPerKgK??null,densityKgPerM3:j,temperatureRange:[O,an],bulkModulusPa:null,shearModulusPa:0}],transitions:[{from:`solid`,to:`liquid`,temperatureK:w,latentHeatJPerKg:T},{from:`liquid`,to:`gas`,temperatureK:O,latentHeatJPerKg:E}],closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}},{entries:[K({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:G.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`formula molar mass and atom count from parsed chemical formula`,inputs:[s]}),K({paths:[`intrinsicColorSrgb`,`phases.*.cpJPerKgK`,`phases.*.densityKgPerM3`,`phases.solid.debyeTemperatureK`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.liquid.bulkModulusPa`,`phases.*.temperatureRange`,`transitions.*.temperatureK`,`transitions.*.latentHeatJPerKg`],status:G.LOWER_LEVEL_SIMULATION,source:`generic-formula-electronic-structure+atomic-dft+statistical-mechanics`,method:`formula geometry/electronic energy or atomic DFT cohesion -> condensed EOS -> Debye/Lindemann phase model`}),K({paths:[`phases.liquid.shearModulusPa`,`phases.gas.shearModulusPa`],status:G.PHYSICAL_LAW,source:`continuum-mechanics`,method:`fluid phases have no static shear modulus`})],notes:[`${e||s} closure uses the generic formula pipeline; validation remains evidence-only.`]})}function Hn({key:e,components:t}){let n=0,r=0,i=[];for(let e of t){let t=Cn(e.formula),a=Tn(t),o=Bn(t,kn(t),on,a).cpJPerKgK*a-tn;n+=e.moleFraction*a,r+=e.moleFraction*o,i.push(`${e.formula}:${e.moleFraction}`)}if(!(n>0)){let e=ce();n=e.molarMassKgPerMol,r=e.cvJPerKgK*e.molarMassKgPerMol}let a=Xt({pressurePa:qt.standardAtmospherePa,temperatureK:on,molarMassKgPerMol:n});return Se({molarMassKgPerMol:n,idealGas:!0,mixture:!0,heatCapacityModel:{gas:`component-statistical-mechanics`},phases:[{name:`gas`,cpJPerKgK:(r+tn)/n,cvJPerKgK:r/n,densityKgPerM3:a,temperatureRange:[0,an],bulkModulusPa:null,shearModulusPa:0}],transitions:[]},{entries:[K({paths:[`molarMassKgPerMol`],status:G.EXACT_CONSTANT,source:`declared-gas-mixture-composition`,method:`mole-fraction-weighted formula molar mass`,inputs:i}),K({paths:[`idealGas`,`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.temperatureRange`,`phases.gas.shearModulusPa`],status:G.PHYSICAL_LAW,source:`component-statistical-mechanics+ideal-gas-law`,method:`component ideal-gas heat capacities mixed by mole fraction plus rho=pM/RT`})],notes:[`${e} is a declared ideal-gas mixture; composition is an input condition, not a material-property fallback.`]})}function Un(e,t={}){if(t[e])return t[e];let n=typeof e==`string`?e.toLowerCase():e;if(yn[n])return yn[n];let r=e?e[0].toUpperCase()+e.slice(1).toLowerCase():``,i=xn(r);if(i)return i;if(A(r)!=null)return{formula:r,phaseModel:`element`};if(/^[A-Z][A-Za-z0-9()]*$/.test(e||``))return{formula:e,phaseModel:`molecular-condensed`};if(/^[a-z0-9()]+$/.test(e||``))return{formula:e.replace(/(^|[0-9(])([a-z])/g,(e,t,n)=>`${t}${n.toUpperCase()}`),phaseModel:`molecular-condensed`};throw Error(`Cannot resolve material spec for '${e}'`)}function Wn(e,t={}){let n=Un(e,t.materialSpecs||{});if(n.phaseModel===`ideal-gas-mixture`)return Hn({key:e,components:n.components});if(n.phaseModel===`element`){let r=Xe(A(n.formula),t.elementOptions||{});return r?r.properties:Vn({key:e,formula:n.formula,phaseModel:`ideal-gas`,options:t.elementOptions||{}})}return Vn({key:e,formula:n.formula,atomCounts:n.atomCounts,geometry:n.geometry,phaseModel:n.phaseModel,options:t.elementOptions||{}})}function Gn(e,r={}){let i=Lt(Wn(e,r),e);if(!i.anchored)return Kn(e,r);let a=String(e).trim().toLowerCase()===`h2o`?pn(i.properties):i.properties;we(a);let o=Ce(a),s=r.validityDomain||{temperatureK:[0,6e3],pressurePa:[1,1e9],composition:a.formula||`pure`},c=t({material:e,spec:Un(e,r.materialSpecs||{}),provenance:a.propertyProvenance}),l=t({method:`ulg.reference-anchored-material-derivation.v0`,properties:a}),u=n({closureFamily:`material`,closureId:`ulg-reference-anchored-${e}-material-closure`,material:e,inputRefs:[{schema:`ulg.first-principles-material-input.v0`,material:e,status:`produced`,inputHash:c}],producer:{service:`ulg-runtime`,commit:null,toolchain:`generic-derivation+reference-bank-anchoring`},validityDomain:s,units:{density:`kg/m^3`,heatCapacity:`J/(kg*K)`,thermalConductivity:`W/(m*K)`,specificInternalEnergy:`J/kg`,latentHeat:`J/kg`,temperature:`K`},properties:a,derivatives:!0,materialDerivation:o,validation:{status:`reference-bank-anchored-model-unvalidated`,evidenceRefs:[]},provenance:{source:`generic-first-principles-material-derivation+reference-bank-anchoring`,inputHash:c,methodHash:l,notes:[`Material closure for ${e}; phase boundaries anchored to the reference bank (residuals retained).`,`Anchored paths: ${i.anchoredPaths.join(`, `)}.`]}});return{...u,materialDerivation:o,referenceBankAnchoring:a.referenceBankAnchoring,inputHash:c,methodHash:l,execution:{mode:`generic-first-principles-material-derivation+reference-bank-anchoring`},validity:{temperatureK:s.temperatureK},provenance:{...u.provenance,inputHash:c,methodHash:l}}}function Kn(e,r={}){let i=Wn(e,r);we(i),Te(i,{material:e,context:`createDerivedMaterialClosure`});let a=Ce(i),o=r.validityDomain||{temperatureK:[0,6e3],pressurePa:[1,1e9],composition:i.formula||(i.mixture?`declared-mixture`:`pure`)},s=t({material:e,spec:Un(e,r.materialSpecs||{}),provenance:i.propertyProvenance}),c=t({method:`ulg.generic-first-principles-material-derivation.v2`,properties:i}),l=n({closureFamily:`material`,closureId:`ulg-derived-${e}-material-closure`,material:e,inputRefs:[{schema:`ulg.first-principles-material-input.v0`,material:e,status:`produced`,inputHash:s}],producer:{service:`ulg-runtime`,commit:null,toolchain:`generic-electronic-statmech-material-derivation`},validityDomain:o,units:{density:`kg/m^3`,heatCapacity:`J/(kg*K)`,specificInternalEnergy:`J/kg`,latentHeat:`J/kg`,temperature:`K`},properties:i,derivatives:!0,materialDerivation:a,validation:{status:`first-principles-model-unvalidated`,evidenceRefs:[]},provenance:{source:`generic-first-principles-material-derivation`,inputHash:s,methodHash:c,notes:[`Material closure for ${e}; fullyLowerLevelDerived=${a.fullyLowerLevelDerived}.`,`Derived values are model evidence, not measured validation.`]}});return{...l,materialDerivation:a,inputHash:s,methodHash:c,execution:{mode:`generic-first-principles-material-derivation`},validity:{temperatureK:o.temperatureK},provenance:{...l.provenance,inputHash:s,methodHash:c}}}function qn(e,t={}){return Object.fromEntries(e.map(e=>[e,Kn(e,t)]))}var Jn=new Map(o.map(e=>[e.toLowerCase(),e])),Yn=new Map(o.map((e,t)=>[e,t+1])),Xn=Object.freeze({h2:`H2`,o2:`O2`,n2:`N2`,f2:`F2`,cl2:`Cl2`,br2:`Br2`,i2:`I2`,h2o:`H2O`,co:`CO`,co2:`CO2`,no:`NO`,no2:`NO2`,nh3:`NH3`,ch4:`CH4`});function Zn(e){return Object.fromEntries(Object.entries(e).map(([e,t])=>[String(Number(e)),Number(t)]))}function Qn(e){try{return Cn(e)}catch{return null}}function $n(e){let t=e.toLowerCase(),n=t.length,r=Array(n+1).fill(null);r[n]={tokenCount:0,symbols:[]};for(let e=n-1;e>=0;--e)for(let n of[1,2]){let i=t.slice(e,e+n),a=Jn.get(i),o=r[e+n];if(!a||!o)continue;let s={tokenCount:o.tokenCount+1,symbols:[a,...o.symbols]};(!r[e]||s.tokenCount<r[e].tokenCount)&&(r[e]=s)}if(!r[0])throw Error(`could not normalize formula run '${e}'`);return r[0].symbols.join(``)}function er(e){let t=``,n=0;for(;n<e.length;){let r=e[n];if(/[A-Za-z]/.test(r)){let r=n+1;for(;r<e.length&&/[A-Za-z]/.test(e[r]);)r+=1;t+=$n(e.slice(n,r)),n=r;continue}if(!/[0-9()]/.test(r))throw Error(`unsupported formula character '${r}'`);t+=r,n+=1}return t}function tr(e){if(typeof e!=`string`||e.trim().length===0)throw TypeError(`chemical formula input must be a non-empty string`);let t=e.trim(),n=Qn(t);if(n)return nr(t,t,n);let r=Xn[t.toLowerCase()];if(r){let e=Qn(r);if(e)return nr(t,r,e)}let i=er(t),a=Qn(i);if(!a)throw Error(`could not parse chemical formula '${e}'`);return nr(t,i,a)}function nr(e,t,n){let r=Zn(n),i=Object.entries(r).sort(([e],[t])=>Number(e)-Number(t));return{input:e,formula:t,atomCounts:r,atomCount:i.reduce((e,[,t])=>e+t,0),elementCount:i.length,elements:i.map(([e,t])=>({Z:Number(e),symbol:C(Number(e)),count:t})),canonicalFormula:wn(r),molarMassKgPerMol:Tn(r)}}function rr(e,t){let n=new Set([...Object.keys(e||{}),...Object.keys(t||{})]);for(let r of n)if((e?.[r]||0)!==(t?.[r]||0))return!1;return!0}function ir(e,t,n=1){for(let[r,i]of Object.entries(t||{}))e[r]=(e[r]||0)+Number(i)*n;return e}function ar(e){let t={};for(let n of e)ir(t,n.atomCounts,n.coefficient);return t}function or(e){if(typeof e!=`string`||e.trim().length===0)throw TypeError(`isotopologue formula input must be a non-empty string`);let t=e.trim(),n=/^([A-Za-z]{1,2})-(\d{1,3})$/.exec(t);if(n){let e=Jn.get(n[1].toLowerCase()),r=Math.trunc(Number(n[2])),i=e?Yn.get(e):null;if(i&&r>=i&&r<=320){let n=k(i,r),a=[Object.freeze({Z:i,symbol:e,A:r,count:1,atomicMassU:n.atomicMassU})],o={[String(i)]:1};return Object.freeze({input:t,formula:t,canonicalFormula:e,canonicalIsotopologue:`${e}-${r}`,hasExplicitIsotopes:!0,sites:Object.freeze(a),elements:Object.freeze([{Z:i,symbol:e,count:1,A:r}]),atomCounts:o,atomCount:1,elementCount:1,molarMassKgPerMol:n.atomicMassU*.001})}}let r=[new Map],i=0,a=!1,o=(e,t,n)=>{let i=r[r.length-1],a=`${e}:${t??`nat`}`,o=i.get(a),s=C(e);o?o.count+=n:i.set(a,{Z:e,symbol:s,A:t??null,count:n})},s=()=>{let e=i;for(;e<t.length&&t[e]>=`0`&&t[e]<=`9`;)e+=1;if(e===i)return null;let n=Number(t.slice(i,e));return i=e,n},c=()=>{if(i>=t.length)return null;let e=i+1<t.length&&/[a-z]/.test(t[i+1])?t.slice(i,i+2):null;if(e&&Yn.has(e))return i+=2,{Z:Yn.get(e),A:null};let n=t[i];return n===`D`?(i+=1,a=!0,{Z:1,A:2}):n===`T`?(i+=1,a=!0,{Z:1,A:3}):Yn.has(n)?(i+=1,{Z:Yn.get(n),A:null}):null},l=!0;for(;i<t.length;){let e=t[i];if(e===`(`){r.push(new Map),i+=1;continue}if(e===`)`){if(r.length<=1){l=!1;break}i+=1;let e=s()??1,t=r.pop();for(let n of t.values())o(n.Z,n.A,n.count*e);continue}if(e===`[`){i+=1;let e=s(),n=c();if(!e||!n||t[i]!==`]`){l=!1;break}if(i+=1,e<n.Z||e>320){l=!1;break}a=!0;let r=s()??1;o(n.Z,e,r);continue}if(e>=`0`&&e<=`9`){let e=s(),t=c();if(!e||!t||e<t.Z||e>320){l=!1;break}a=!0;let n=s()??1;o(t.Z,e,n);continue}if(e>=`A`&&e<=`Z`){let e=c();if(!e){l=!1;break}let t=s()??1;o(e.Z,e.A,t);continue}l=!1;break}if(!l||r.length!==1||r[0].size===0){let e=tr(t),n=e.elements.map(e=>Object.freeze({Z:e.Z,symbol:e.symbol,A:null,count:e.count,atomicMassU:h[e.Z-1]}));return Object.freeze({...e,canonicalIsotopologue:e.canonicalFormula,hasExplicitIsotopes:!1,sites:Object.freeze(n)})}let u=[],d={},f=0,p=0;for(let e of r[0].values()){let t=e.A==null?h[e.Z-1]:k(e.Z,e.A).atomicMassU;f+=t*e.count,p+=e.count,d[String(e.Z)]=(d[String(e.Z)]||0)+e.count,u.push(Object.freeze({Z:e.Z,symbol:e.symbol,A:e.A,count:e.count,atomicMassU:t}))}u.sort((e,t)=>e.Z-t.Z||(e.A??0)-(t.A??0));let m=Object.entries(d).sort(([e],[t])=>Number(e)-Number(t)).map(([e,t])=>({Z:Number(e),symbol:C(Number(e)),count:t})),g=a?u.length===1&&u[0].count===1&&u[0].A!=null?`${u[0].symbol}-${u[0].A}`:u.map(e=>`${e.A==null?e.symbol:e.Z===1&&e.A===2?`D`:e.Z===1&&e.A===3?`T`:`[${e.A}${e.symbol}]`}${e.count===1?``:e.count}`).join(``):wn(d);return Object.freeze({input:t,formula:t,canonicalFormula:wn(d),canonicalIsotopologue:g,hasExplicitIsotopes:a,sites:Object.freeze(u),elements:Object.freeze(m),atomCounts:d,atomCount:p,elementCount:m.length,molarMassKgPerMol:f*.001})}var sr=`peercompute.ulg.optical-resolver-webgpu.v1`,cr=6582119569e-25,lr=1,ur=`
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
`;function dr(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var fr=dr(ur),pr=new WeakMap;function mr(e){let t=pr.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-optical-resolver-wgsl`,code:ur}),r=e.createBindGroupLayout({label:`ulg-optical-resolver-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`read-only-storage`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({label:`ulg-optical-resolver-pl`,bindGroupLayouts:[r]});return t={pipeline:e.createComputePipeline({label:`ulg-optical-resolver-pipeline`,layout:i,compute:{module:n,entryPoint:`resolve_optical_materials`}}),bindGroupLayout:r},pr.set(e,t),t}function hr(e=[]){let t=Array.isArray(e)?e:[],n=new Float32Array(Math.max(1,t.length)*8),r=[],i=Array(t.length).fill(`none`);for(let e=0;e<t.length;e+=1){let a=t[e]||{},o=Number.isInteger(a.mode)?a.mode:0,s=e*8;if(o===0){let t=Number.isFinite(a.plasmaRadPerS)?a.plasmaRadPerS:v(Math.max(1e10,Number(a.conductionElectronDensityPerM3)||1e28)),o=Number.isFinite(a.plasmaEnergyEv)?a.plasmaEnergyEv:cr*t,c=Number.isFinite(a.dampingEv)?a.dampingEv:o/30,l=Array.isArray(a.interbandOscillators),u=l?a.interbandOscillators:a.atomicNumberZ?P({atomicNumberZ:a.atomicNumberZ,conductionElectronDensityPerM3:a.conductionElectronDensityPerM3,options:a.interbandOptions||{}}):[];i[e]=l?`caller-supplied`:a.atomicNumberZ?`cpu-radial-ks-interband`:`drude-only`;let d=r.length;for(let e of u)r.push([Number(e.energyEv)||0,Number(e.dampingEv)||.22,Number(e.strengthWeight)||0,0]);n[s+0]=o,n[s+1]=c,n[s+2]=Number.isFinite(a.pathLengthM)?a.pathLengthM:.3,n[s+3]=d,n[s+4]=u.length,n[s+5]=0,n[s+6]=0,n[s+7]=0}else if(o===1){let t=Number.isFinite(Number(a.refractiveIndex))&&Number(a.refractiveIndex)>=1?Number(a.refractiveIndex):1;n[s+0]=Number.isFinite(a.chargeZ)?a.chargeZ:1,n[s+1]=0,n[s+2]=0,n[s+3]=0,n[s+4]=0,n[s+5]=1,n[s+6]=Math.max(0,Math.min(.9999999,Number(a.beta)||0)),n[s+7]=t,i[e]=`frank-tamm-webgpu`}else{let t=Number.isFinite(Number(a.refractiveIndex??a.ior))&&Number(a.refractiveIndex??a.ior)>1?Number(a.refractiveIndex??a.ior):0;n[s+0]=t,n[s+1]=0,n[s+2]=Number.isFinite(a.pathLengthM)?a.pathLengthM:.3,n[s+3]=0,n[s+4]=0,n[s+5]=2,n[s+6]=Math.max(0,Number(a.electronicGapEv)||0),n[s+7]=Math.max(0,Number(a.densityCrossSectionPerM)||0),i[e]=t>1?`band-gap-explicit-ior`:`band-gap-herve-vandamme-webgpu`}}let a=new Float32Array(Math.max(1,r.length)*4);for(let e=0;e<r.length;e+=1){let t=r[e],n=e*4;a[n+0]=t[0],a[n+1]=t[1],a[n+2]=t[2],a[n+3]=t[3]}return{materialCount:t.length,oscillatorCount:r.length,oscSources:i,descData:n,oscData:a}}async function gr(e,t=[],{keepResident:n=!1,readback:r=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`resolveOpticalBatchWebGpu requires a valid WebGPU GPUDevice.`);let i=hr(t),a=i.materialCount;if(a===0)return{schema:sr,resolverStatus:`webgpu-derived`,webgpuProgramHash:fr,results:[],residentBuffers:null};let o=r!==!1||!n,{pipeline:s,bindGroupLayout:c}=mr(e),l=e.createBuffer({label:`ulg-opt-desc`,size:i.descData.byteLength,usage:136}),u=e.createBuffer({label:`ulg-opt-osc`,size:i.oscData.byteLength,usage:136}),d=a*16*Float32Array.BYTES_PER_ELEMENT,f=e.createBuffer({label:`ulg-opt-out`,size:d,usage:132}),p=a*9*4*Float32Array.BYTES_PER_ELEMENT,m=e.createBuffer({label:`ulg-opt-spec`,size:p,usage:132}),h=o?e.createBuffer({label:`ulg-opt-out-read`,size:d,usage:9}):null,g=o?e.createBuffer({label:`ulg-opt-spec-read`,size:p,usage:9}):null;try{e.queue.writeBuffer(l,0,i.descData),e.queue.writeBuffer(u,0,i.oscData);let t=e.createBindGroup({label:`ulg-opt-bg`,layout:c,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:u}},{binding:2,resource:{buffer:f}},{binding:3,resource:{buffer:m}}]}),r=e.createCommandEncoder({label:`ulg-opt-resolver-enc`}),_=r.beginComputePass({label:`ulg-opt-resolver-pass`});_.setPipeline(s),_.setBindGroup(0,t),_.dispatchWorkgroups(a,1,1),_.end(),o&&(r.copyBufferToBuffer(f,0,h,0,d),r.copyBufferToBuffer(m,0,g,0,p)),e.queue.submit([r.finish()]);let v=null;if(o){await Promise.all([h.mapAsync(lr),g.mapAsync(lr)]);let e=new Float32Array(h.getMappedRange().slice(0)),t=new Float32Array(g.getMappedRange().slice(0));h.unmap(),g.unmap(),v=[];for(let n=0;n<a;n+=1){let r=n*16,a=Math.round(e[r+15]),o=[];for(let e=0;e<9;e+=1){let r=(n*9+e)*4;o.push({wavelengthNm:t[r+0],reflectance:t[r+1],absorptionCoefficientPerM:t[r+2],nRe:t[r+3]})}let s=[e[r+0],e[r+1],e[r+2]];v.push({mode:a,baseColorSrgb:s,r:s[0],g:s[1],b:s[2],reflectance:e[r+3],absorptionCoefficientPerM:a===1?0:e[r+4],photonsPerMeter:a===1?e[r+4]:0,opticalDepth:a===1?0:e[r+5],cherenkovAngleDeg:a===1?e[r+5]:0,opacity:a===1?0:e[r+6],active:a===1?e[r+6]>.5:!0,transmission:e[r+7],metalness:e[r+8],roughness:e[r+9],cieXYZ:[e[r+10],e[r+11],e[r+12]],plasmaEnergyEv:e[r+13],oscillatorCount:Math.round(e[r+14]),oscillatorSource:i.oscSources[n],spectralSamples:o,resolverStatus:i.oscSources[n]===`cpu-radial-ks-interband`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:fr,validation:Object.freeze({scientificValidation:!1,opticalValidation:!1,webgpuParity:!1})})}}return{schema:sr,resolverStatus:i.oscSources.includes(`cpu-radial-ks-interband`)?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:fr,materialCount:a,readbackSkipped:!o,results:v,residentBuffers:n?{outputBuffer:f,spectralBuffer:m,destroy(){f.destroy(),m.destroy()}}:null}}finally{l.destroy(),u.destroy(),h?.destroy(),g?.destroy(),n||(f.destroy(),m.destroy())}}var _r=`ulg.gpumath.molecular-dynamics-webgpu.v1`,vr=Object.freeze({LENNARD_JONES:0,MORSE_EAM:1,STILLINGER_WEBER:2}),yr=Object.freeze({EQUILIBRIUM:0,STRAIN:1,ACOUSTIC:2,SHEAR_NEMD:3,THERMAL_NEMD:4,SURFACE_SLAB:5}),X=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),br=10.1805057,xr=8617333262e-14,Sr=128,Cr=131072,wr=`
struct MdParams {
  // x=atomCount, y=potentialModel (0=LJ, 1=Morse+EAM, 2=SW), z=rdfStride (>=1),
  // w=thermostatActive (bit0) | wallYActive (bit1) | (expMode << 8)
  counts: vec4<u32>,
  // x=boxLx, y=boxLy, z=boxLz, w=dt_internal
  box_dt: vec4<f32>,
  // x=epsilon_ev, y=sigma_or_r0_A, z=alpha_or_lambda, w=rcut_A
  pot0: vec4<f32>,
  // x=eam_A_ev, y=eam_beta, z=sw_gamma_or_p, w=target_temp_k
  pot1: vec4<f32>,
  // x=thermostat_alpha (dt / tau), y=scale_factor, z=collect_telemetry, w=shear_wall_vel
  ctrl: vec4<f32>,
  // x=hot_vel_scale, y=cold_vel_scale, z=strain_sx, w=strain_sy
  nemd: vec4<f32>,
  // x=strain_sz, y=shear_xy, z=pulse_amp, w=pulse_pol (0=longitudinal X, 1=transverse Y)
  nemd2: vec4<f32>,
  // x=cellNx, y=cellNy, z=cellNz, w=nextBase (0 = direct O(N^2), >0 = O(N) linked-list active & atom_next base offset)
  cell_cfg: vec4<u32>,
  // x=r_nn_A, y=ideal_coord, z=melting_t_k, w=max_dv_step
  phase_cfg: vec4<f32>,
  // x=energyScale, y=msdScale, z=vacfScale, w=coordScale (dynamic anti-overflow scaling up to 100K+ atoms!)
  scale_cfg: vec4<f32>,
  // x=gravity_acc_int (A/t0^2 along -Y), y=v_cm_y (COM-frame thermostat), z=wall_dc_A, w=wall_k_ev_per_A2
  grav_cfg: vec4<f32>,
};

const EMPTY_CELL_U: u32 = 0xFFFFFFFFu;
const MAX_CELL_WALK_U: u32 = 4096u;

@group(0) @binding(0) var<uniform> params: MdParams;
// pos: xyz in [0, box), w = normalized local first-shell coordination (z_i / Z_ideal)
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (A/t0), w = mass (u)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// force: fxyz (eV/A), w = per-atom potential energy (eV)
@group(0) @binding(3) var<storage, read_write> force: array<vec4<f32>>;
// unwrapped: xyz unwrapped coords for exact MSD, w = EAM embedding derivative F'(rho)
@group(0) @binding(4) var<storage, read_write> unwrapped: array<vec4<f32>>;
// init_state: [0..n-1] = pos_init (MSD ref), [n..2n-1] = vel_init (VACF/VDOS ref)
@group(0) @binding(5) var<storage, read> init_state: array<vec4<f32>>;
// telemetry: fixed-point scaled atomic accumulators (scaled dynamically by scale_cfg!)
//   [0]=E_kin*eS, [1]=E_pot*eS, [2]=virial*eS, [3]=msd*mS,
//   [4]=px*eS, [5]=py*eS, [6]=pz*eS, [7]=sxy*eS, [8]=sxz*eS, [9]=syz*eS,
//   [10]=vir_x*eS, [11]=vir_y*eS, [12]=vir_z*eS, [13]=kin_x*eS, [14]=kin_y*eS, [15]=kin_z*eS,
//   [16..79]=RDF histogram bins, [80]=vacf_num*vS, [81]=vacf_den*vS, [82]=heat_add*vS, [83]=heat_rem*vS,
//   [84..115]=8 spatial slabs * 4 (count, ke*eS, vx*eS, vy*eS),
//   [116]=coord_sum*cS, [117]=solid_count, [118]=liquid_count, [119]=vapor_count
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<i32>>;
// cell_grid (single lock-free linked-cell buffer — total storage buffers = 7 <= 8 WebGPU baseline!):
//   [0 .. nextBase-1]           = cell_head[cid] (EMPTY_CELL_U if empty)
//   [nextBase .. nextBase+n-1]  = atom_next[i]   (next atom index in cell)
@group(0) @binding(7) var<storage, read_write> cell_grid: array<atomic<u32>>;

fn min_image(d: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return d - box_l * round(d / box_l);
}

fn min_image_cfg(d: vec3<f32>, box_l: vec3<f32>, wall_y: bool) -> vec3<f32> {
  var out = d - box_l * round(d / box_l);
  if (wall_y) {
    out.y = d.y;
  }
  return out;
}

fn wrap_box(p: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return p - box_l * floor(p / box_l);
}

fn atom_cell_coord(p: vec3<f32>, box_l: vec3<f32>, dims: vec3<u32>) -> vec3<u32> {
  let f = clamp(p / max(vec3<f32>(1.0e-5), box_l), vec3<f32>(0.0), vec3<f32>(0.999999));
  let c = vec3<u32>(floor(f * vec3<f32>(dims)));
  return min(c, dims - vec3<u32>(1u));
}

fn cell_linear_idx(c: vec3<u32>, dims: vec3<u32>) -> u32 {
  return (c.z * dims.y + c.y) * dims.x + c.x;
}

@compute @workgroup_size(64)
fn reset_telemetry(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 128u) {
    atomicStore(&telemetry[id.x], 0);
  }
}

@compute @workgroup_size(64)
fn clear_cell_list(@builtin(global_invocation_id) id: vec3<u32>) {
  let total_cells = params.cell_cfg.w;
  if (id.x < total_cells) {
    atomicStore(&cell_grid[id.x], EMPTY_CELL_U);
  }
}

@compute @workgroup_size(64)
fn build_cell_list(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let next_base = params.cell_cfg.w;
  if (i >= params.counts.x || next_base == 0u) { return; }
  let dims = max(params.cell_cfg.xyz, vec3<u32>(1u));
  let cc = atom_cell_coord(pos[i].xyz, params.box_dt.xyz, dims);
  let cid = cell_linear_idx(cc, dims);
  let prev = atomicExchange(&cell_grid[cid], i);
  atomicStore(&cell_grid[next_base + i], prev);
}

@compute @workgroup_size(64)
fn apply_affine_strain(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let box_l = params.box_dt.xyz;
  let wall_y = (params.counts.w & 2u) != 0u;
  let s_vec = vec3<f32>(params.nemd.z, params.nemd.w, params.nemd2.x);
  var p3 = pos[i].xyz * s_vec;
  p3.x = p3.x + params.nemd2.y * (p3.y - 0.5 * box_l.y);
  var p_wrapped = wrap_box(p3, box_l);
  if (wall_y) {
    let y_pad = min(0.15, 0.04 * box_l.y);
    p_wrapped.y = clamp(p3.y, y_pad, box_l.y - y_pad);
  }
  pos[i] = vec4<f32>(p_wrapped, pos[i].w);
  var u3 = unwrapped[i].xyz * s_vec;
  u3.x = u3.x + params.nemd2.y * (u3.y - 0.5 * box_l.y);
  unwrapped[i] = vec4<f32>(u3, unwrapped[i].w);
}

@compute @workgroup_size(64)
fn inject_acoustic_pulse(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let box_l = params.box_dt.xyz;
  let fx = pos[i].x / max(1.0e-5, box_l.x);
  let d = fx - 0.14;
  let env = exp(-(d * d) / (2.0 * 0.055 * 0.055));
  let env_back = exp(-((fx - 0.86) * (fx - 0.86)) / (2.0 * 0.055 * 0.055));
  let amp = params.nemd2.z * (env - 0.25 * env_back);
  var v4 = vel[i];
  if (params.nemd2.w < 0.5) {
    v4.x = v4.x + amp; // Longitudinal P-wave (v_L)
  } else {
    v4.y = v4.y + amp; // Transverse S-wave (v_T)
  }
  vel[i] = v4;
}

@compute @workgroup_size(64)
fn vv_half_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let box_l = params.box_dt.xyz;
  let wall_y = (params.counts.w & 2u) != 0u;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  let f3 = force[i].xyz;
  var dv = (0.5 * dt / m) * f3;
  let max_dv = params.phase_cfg.w;
  if (max_dv > 0.0) {
    let dv_len = length(dv);
    if (dv_len > max_dv) {
      dv = dv * (max_dv / dv_len);
    }
  }
  var v_half = v4.xyz + dv;
  let dr = v_half * dt;
  let p_raw = pos[i].xyz + dr;
  var p_new = wrap_box(p_raw, box_l);
  if (wall_y) {
    let y_pad = min(0.15, 0.04 * box_l.y);
    var py = p_raw.y;
    if (py < y_pad) {
      py = y_pad + (y_pad - py) * 0.5;
      if (v_half.y < 0.0) { v_half.y = -v_half.y * 0.85; }
    } else if (py > box_l.y - y_pad) {
      py = (box_l.y - y_pad) - (py - (box_l.y - y_pad)) * 0.5;
      if (v_half.y > 0.0) { v_half.y = -v_half.y * 0.85; }
    }
    p_new.y = clamp(py, y_pad, box_l.y - y_pad);
  }
  pos[i] = vec4<f32>(p_new, pos[i].w);
  unwrapped[i] = vec4<f32>(unwrapped[i].xyz + dr, unwrapped[i].w);
  vel[i] = vec4<f32>(v_half, m);
}

// Pre-pass for Finnis-Sinclair EAM metallic electron density rho_i = sum_j phi(r_ij)
@compute @workgroup_size(64)
fn compute_eam_density(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n || params.counts.y != 1u) { return; }
  let box_l = params.box_dt.xyz;
  let wall_y = (params.counts.w & 2u) != 0u;
  let r0 = params.pot0.y;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let beta = max(params.pot1.y, 0.25);
  let pi = pos[i].xyz;
  var rho = 0.0;

  let next_base = params.cell_cfg.w;
  if (next_base > 0u) {
    let dims = max(params.cell_cfg.xyz, vec3<u32>(1u));
    let ci = atom_cell_coord(pi, box_l, dims);
    let dx_min = select(0i, -1i, dims.x >= 3u);
    let dx_max = select(i32(dims.x) - 1i, 1i, dims.x >= 3u);
    let dy_min = select(0i, -1i, dims.y >= 3u);
    let dy_max = select(i32(dims.y) - 1i, 1i, dims.y >= 3u);
    let dz_min = select(0i, -1i, dims.z >= 3u);
    let dz_max = select(i32(dims.z) - 1i, 1i, dims.z >= 3u);
    for (var dz = dz_min; dz <= dz_max; dz = dz + 1i) {
      let cz = select(u32(dz), u32((i32(ci.z) + dz + i32(dims.z)) % i32(dims.z)), dims.z >= 3u);
      for (var dy = dy_min; dy <= dy_max; dy = dy + 1i) {
        let cy_raw = select(dy, i32(ci.y) + dy, dims.y >= 3u);
        if (wall_y && (cy_raw < 0i || cy_raw >= i32(dims.y))) { continue; }
        let cy = select(u32(cy_raw), u32((cy_raw + i32(dims.y)) % i32(dims.y)), !wall_y && dims.y >= 3u);
        for (var dx = dx_min; dx <= dx_max; dx = dx + 1i) {
          let cx = select(u32(dx), u32((i32(ci.x) + dx + i32(dims.x)) % i32(dims.x)), dims.x >= 3u);
          let cid = cell_linear_idx(vec3<u32>(cx, cy, cz), dims);
          var j = atomicLoad(&cell_grid[cid]);
          var guard = 0u;
          while (j != EMPTY_CELL_U && guard < MAX_CELL_WALK_U) {
            if (j != i) {
              let d = min_image_cfg(pi - pos[j].xyz, box_l, wall_y);
              let r2 = dot(d, d);
              if (r2 < rcut2 && r2 > 1.0e-8) {
                let r = sqrt(r2);
                let sf = 1.0 - r / rcut;
                rho = rho + exp(-beta * (r - r0)) * sf * sf;
              }
            }
            j = atomicLoad(&cell_grid[next_base + j]);
            guard = guard + 1u;
          }
        }
      }
    }
  } else {
    for (var j = 0u; j < n; j = j + 1u) {
      if (j == i) { continue; }
      let d = min_image_cfg(pi - pos[j].xyz, box_l, wall_y);
      let r2 = dot(d, d);
      if (r2 < rcut2 && r2 > 1.0e-8) {
        let r = sqrt(r2);
        let sf = 1.0 - r / rcut;
        rho = rho + exp(-beta * (r - r0)) * sf * sf;
      }
    }
  }

  let a_eam = params.pot1.x;
  let dF = -0.5 * a_eam / sqrt(max(rho, 1.0e-6));
  unwrapped[i].w = dF;
  force[i].w = -a_eam * sqrt(max(rho, 0.0));
}

@compute @workgroup_size(64)
fn compute_forces(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n) { return; }
  let model = params.counts.y;
  let rdf_stride = max(1u, params.counts.z);
  let sample_rdf = params.ctrl.z > 0.5 && (i % rdf_stride) == 0u;
  let wall_y = (params.counts.w & 2u) != 0u;
  let box_l = params.box_dt.xyz;
  let eps = params.pot0.x;
  let sig = params.pot0.y;
  let alpha = params.pot0.z;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let r_coord_cut = 1.25 * max(1.2, params.phase_cfg.x);
  let r_coord_cut2 = r_coord_cut * r_coord_cut;
  let ideal_coord = max(4.0, params.phase_cfg.y);
  let pi = pos[i].xyz;

  var fi = vec3<f32>(0.0);
  var epot_i = select(0.0, force[i].w, model == 1u);
  var vir_v = vec3<f32>(0.0);
  var sxy = 0.0;
  var sxz = 0.0;
  var syz = 0.0;
  var coord_i = 0u;

  let inv_rc = sig / rcut;
  let sr2_c = inv_rc * inv_rc;
  let sr6_c = sr2_c * sr2_c * sr2_c;
  let lj_ecut = 4.0 * eps * (sr6_c * sr6_c - sr6_c);
  let lj_fcut = 24.0 * eps * (2.0 * sr6_c * sr6_c - sr6_c) / rcut;

  let dFi = unwrapped[i].w;
  let beta = max(params.pot1.y, 0.25);

  var nb_vec: array<vec3<f32>, 16>;
  var nb_r: array<f32, 16>;
  var nb_idx: array<u32, 16>;
  var nb_count = 0u;

  let next_base = params.cell_cfg.w;
  if (next_base > 0u) {
    let dims = max(params.cell_cfg.xyz, vec3<u32>(1u));
    let ci = atom_cell_coord(pi, box_l, dims);
    let dx_min = select(0i, -1i, dims.x >= 3u);
    let dx_max = select(i32(dims.x) - 1i, 1i, dims.x >= 3u);
    let dy_min = select(0i, -1i, dims.y >= 3u);
    let dy_max = select(i32(dims.y) - 1i, 1i, dims.y >= 3u);
    let dz_min = select(0i, -1i, dims.z >= 3u);
    let dz_max = select(i32(dims.z) - 1i, 1i, dims.z >= 3u);
    for (var dz = dz_min; dz <= dz_max; dz = dz + 1i) {
      let cz = select(u32(dz), u32((i32(ci.z) + dz + i32(dims.z)) % i32(dims.z)), dims.z >= 3u);
      for (var dy = dy_min; dy <= dy_max; dy = dy + 1i) {
        let cy_raw = select(dy, i32(ci.y) + dy, dims.y >= 3u);
        if (wall_y && (cy_raw < 0i || cy_raw >= i32(dims.y))) { continue; }
        let cy = select(u32(cy_raw), u32((cy_raw + i32(dims.y)) % i32(dims.y)), !wall_y && dims.y >= 3u);
        for (var dx = dx_min; dx <= dx_max; dx = dx + 1i) {
          let cx = select(u32(dx), u32((i32(ci.x) + dx + i32(dims.x)) % i32(dims.x)), dims.x >= 3u);
          let cid = cell_linear_idx(vec3<u32>(cx, cy, cz), dims);
          var j = atomicLoad(&cell_grid[cid]);
          var guard = 0u;
          while (j != EMPTY_CELL_U && guard < MAX_CELL_WALK_U) {
            if (j != i) {
              let d = min_image_cfg(pi - pos[j].xyz, box_l, wall_y);
              let r2 = dot(d, d);
              if (r2 < rcut2 && r2 > 1.0e-8) {
                let r = sqrt(r2);
                if (r2 < r_coord_cut2) { coord_i = coord_i + 1u; }
                if (model == 2u && nb_count < 16u) {
                  nb_vec[nb_count] = -d;
                  nb_r[nb_count] = r;
                  nb_idx[nb_count] = j;
                  nb_count = nb_count + 1u;
                }
                if (sample_rdf) {
                  let bin = u32(clamp((r / rcut) * 64.0, 0.0, 63.0));
                  atomicAdd(&telemetry[16u + bin], 1);
                }
                var f_scalar = 0.0;
                var u_pair = 0.0;
                if (model == 0u) {
                  let sr = sig / r;
                  let sr2 = sr * sr;
                  let sr6 = sr2 * sr2 * sr2;
                  let sr12 = sr6 * sr6;
                  u_pair = 4.0 * eps * (sr12 - sr6) - lj_ecut + (r - rcut) * lj_fcut;
                  let f_mag = 24.0 * eps * (2.0 * sr12 - sr6) / r - lj_fcut;
                  f_scalar = f_mag / r;
                } else if (model == 1u) {
                  let ex = exp(-alpha * (r - sig));
                  let sf = 1.0 - r / rcut;
                  let sf2 = sf * sf;
                  let u_morse = eps * (ex * ex - 2.0 * ex);
                  let du_morse = 2.0 * eps * alpha * (ex - ex * ex);
                  u_pair = u_morse * sf2;
                  let du_dr = du_morse * sf2 - u_morse * (2.0 * sf / rcut);
                  let ex_rho = exp(-beta * (r - sig));
                  let drho_dr = ex_rho * (-beta * sf2 - 2.0 * sf / rcut);
                  let dFj = unwrapped[j].w;
                  let f_mag = -du_dr - (dFi + dFj) * drho_dr;
                  f_scalar = f_mag / r;
                } else {
                  let rs = r / sig;
                  let a_sw = rcut / sig;
                  let denom = rs - a_sw;
                  if (denom < -1.0e-4) {
                    let ex_sw = exp(1.0 / denom);
                    let inv_r4 = 1.0 / (rs * rs * rs * rs);
                    let term = 0.6022245584 * inv_r4 - 1.0;
                    u_pair = 7.049556277 * eps * term * ex_sw;
                    let dterm = -4.0 * 0.6022245584 * inv_r4 / rs;
                    let du_drs = 7.049556277 * eps * ex_sw * (dterm - term / (denom * denom));
                    f_scalar = -(du_drs / sig) / r;
                  }
                }
                let fij = d * f_scalar;
                fi = fi + fij;
                epot_i = epot_i + 0.5 * u_pair;
                vir_v = vir_v + 0.5 * (d * fij);
                sxy = sxy + 0.5 * d.x * fij.y;
                sxz = sxz + 0.5 * d.x * fij.z;
                syz = syz + 0.5 * d.y * fij.z;
              }
            }
            j = atomicLoad(&cell_grid[next_base + j]);
            guard = guard + 1u;
          }
        }
      }
    }
  } else {
    for (var j = 0u; j < n; j = j + 1u) {
      if (j == i) { continue; }
      let d = min_image_cfg(pi - pos[j].xyz, box_l, wall_y);
      let r2 = dot(d, d);
      if (r2 >= rcut2 || r2 <= 1.0e-8) { continue; }
      let r = sqrt(r2);
      if (r2 < r_coord_cut2) { coord_i = coord_i + 1u; }
      if (model == 2u && nb_count < 16u) {
        nb_vec[nb_count] = -d;
        nb_r[nb_count] = r;
        nb_idx[nb_count] = j;
        nb_count = nb_count + 1u;
      }
      if (sample_rdf) {
        let bin = u32(clamp((r / rcut) * 64.0, 0.0, 63.0));
        atomicAdd(&telemetry[16u + bin], 1);
      }
      var f_scalar = 0.0;
      var u_pair = 0.0;
      if (model == 0u) {
        let sr = sig / r;
        let sr2 = sr * sr;
        let sr6 = sr2 * sr2 * sr2;
        let sr12 = sr6 * sr6;
        u_pair = 4.0 * eps * (sr12 - sr6) - lj_ecut + (r - rcut) * lj_fcut;
        let f_mag = 24.0 * eps * (2.0 * sr12 - sr6) / r - lj_fcut;
        f_scalar = f_mag / r;
      } else if (model == 1u) {
        let ex = exp(-alpha * (r - sig));
        let sf = 1.0 - r / rcut;
        let sf2 = sf * sf;
        let u_morse = eps * (ex * ex - 2.0 * ex);
        let du_morse = 2.0 * eps * alpha * (ex - ex * ex);
        u_pair = u_morse * sf2;
        let du_dr = du_morse * sf2 - u_morse * (2.0 * sf / rcut);
        let ex_rho = exp(-beta * (r - sig));
        let drho_dr = ex_rho * (-beta * sf2 - 2.0 * sf / rcut);
        let dFj = unwrapped[j].w;
        let f_mag = -du_dr - (dFi + dFj) * drho_dr;
        f_scalar = f_mag / r;
      } else {
        let rs = r / sig;
        let a_sw = rcut / sig;
        let denom = rs - a_sw;
        if (denom < -1.0e-4) {
          let ex_sw = exp(1.0 / denom);
          let inv_r4 = 1.0 / (rs * rs * rs * rs);
          let term = 0.6022245584 * inv_r4 - 1.0;
          u_pair = 7.049556277 * eps * term * ex_sw;
          let dterm = -4.0 * 0.6022245584 * inv_r4 / rs;
          let du_drs = 7.049556277 * eps * ex_sw * (dterm - term / (denom * denom));
          f_scalar = -(du_drs / sig) / r;
        }
      }
      let fij = d * f_scalar;
      fi = fi + fij;
      epot_i = epot_i + 0.5 * u_pair;
      vir_v = vir_v + 0.5 * (d * fij);
      sxy = sxy + 0.5 * d.x * fij.y;
      sxz = sxz + 0.5 * d.x * fij.z;
      syz = syz + 0.5 * d.y * fij.z;
    }
  }

  // Stillinger-Weber 3-body tetrahedral term when model == 2 (covalent sp3 bonding):
  //   1. Center-vertex (i) triplets (i, j, k): f_i += grad_j + grad_k + exact triplet virial W_ijk = -r_ij x grad_j - r_ik x grad_k!
  //   2. Outer-arm gather on neighbor j triplets (j, i, k): f_i -= grad_i(j, i, k) -> exact Newton's 3rd Law (f_i + f_j + f_k == 0)!
  if (model == 2u && params.pot0.z > 0.0 && nb_count >= 1u) {
    let lambda_sw = params.pot0.z;
    let gamma_sw = max(params.pot1.z, 1.2);
    let a_sw = rcut / sig;
    if (nb_count >= 2u) {
      for (var a = 0u; a + 1u < nb_count; a = a + 1u) {
        let ra = nb_r[a] / sig;
        let da = ra - a_sw;
        if (da >= -1.0e-3) { continue; }
        let ea = exp(gamma_sw / da);
        let ua = nb_vec[a] / nb_r[a];
        for (var b = a + 1u; b < nb_count; b = b + 1u) {
          let rb = nb_r[b] / sig;
          let db = rb - a_sw;
          if (db >= -1.0e-3) { continue; }
          let eb = exp(gamma_sw / db);
          let ub = nb_vec[b] / nb_r[b];
          let cos_t = clamp(dot(ua, ub), -1.0, 1.0);
          let diff = cos_t + 0.33333333;
          let pre = lambda_sw * eps * ea * eb;
          let u3 = pre * diff * diff;
          epot_i = epot_i + u3;
          let d_cos_dj = (ub - ua * cos_t) / nb_r[a];
          let d_cos_dk = (ua - ub * cos_t) / nb_r[b];
          let d_ea_dr = -(gamma_sw / (da * da * sig));
          let d_eb_dr = -(gamma_sw / (db * db * sig));
          let grad_j = pre * (2.0 * diff * d_cos_dj + diff * diff * d_ea_dr * ua);
          let grad_k = pre * (2.0 * diff * d_cos_dk + diff * diff * d_eb_dr * ub);
          fi = fi + grad_j + grad_k;
          // Exact 3-body virial contribution W_ijk = r_ij * (-grad_j) + r_ik * (-grad_k)
          vir_v = vir_v - nb_vec[a] * grad_j - nb_vec[b] * grad_k;
          sxy = sxy - nb_vec[a].x * grad_j.y - nb_vec[b].x * grad_k.y;
          sxz = sxz - nb_vec[a].x * grad_j.z - nb_vec[b].x * grad_k.z;
          syz = syz - nb_vec[a].y * grad_j.z - nb_vec[b].y * grad_k.z;
        }
      }
    }
    // Outer-arm reciprocal forces from every neighbor j acting as central vertex of (j, i, k):
    for (var a = 0u; a < nb_count; a = a + 1u) {
      let ra = nb_r[a] / sig;
      let da = ra - a_sw;
      if (da >= -1.0e-3) { continue; }
      let j_idx = nb_idx[a];
      let pj = pos[j_idx].xyz;
      let ea = exp(gamma_sw / da);
      let u_ji = -nb_vec[a] / nb_r[a]; // unit vector from j -> i
      let d_ea_dr = -(gamma_sw / (da * da * sig));
      if (next_base > 0u) {
        let dims = max(params.cell_cfg.xyz, vec3<u32>(1u));
        let cj = atom_cell_coord(pj, box_l, dims);
        let dx_min = select(0i, -1i, dims.x >= 3u);
        let dx_max = select(i32(dims.x) - 1i, 1i, dims.x >= 3u);
        let dy_min = select(0i, -1i, dims.y >= 3u);
        let dy_max = select(i32(dims.y) - 1i, 1i, dims.y >= 3u);
        let dz_min = select(0i, -1i, dims.z >= 3u);
        let dz_max = select(i32(dims.z) - 1i, 1i, dims.z >= 3u);
        for (var dz = dz_min; dz <= dz_max; dz = dz + 1i) {
          let cz = select(u32(dz), u32((i32(cj.z) + dz + i32(dims.z)) % i32(dims.z)), dims.z >= 3u);
          for (var dy = dy_min; dy <= dy_max; dy = dy + 1i) {
            let cy_raw = select(dy, i32(cj.y) + dy, dims.y >= 3u);
            if (wall_y && (cy_raw < 0i || cy_raw >= i32(dims.y))) { continue; }
            let cy = select(u32(cy_raw), u32((cy_raw + i32(dims.y)) % i32(dims.y)), !wall_y && dims.y >= 3u);
            for (var dx = dx_min; dx <= dx_max; dx = dx + 1i) {
              let cx = select(u32(dx), u32((i32(cj.x) + dx + i32(dims.x)) % i32(dims.x)), dims.x >= 3u);
              let cid = cell_linear_idx(vec3<u32>(cx, cy, cz), dims);
              var k = atomicLoad(&cell_grid[cid]);
              var guard_k = 0u;
              while (k != EMPTY_CELL_U && guard_k < MAX_CELL_WALK_U) {
                if (k != j_idx && k != i) {
                  let r_jk_vec = min_image_cfg(pos[k].xyz - pj, box_l, wall_y);
                  let r_jk2 = dot(r_jk_vec, r_jk_vec);
                  if (r_jk2 < rcut2 && r_jk2 > 1.0e-8) {
                    let r_jk = sqrt(r_jk2);
                    let db = r_jk / sig - a_sw;
                    if (db < -1.0e-3) {
                      let eb = exp(gamma_sw / db);
                      let u_jk = r_jk_vec / r_jk;
                      let cos_t = clamp(dot(u_ji, u_jk), -1.0, 1.0);
                      let diff = cos_t + 0.33333333;
                      let pre = lambda_sw * eps * ea * eb;
                      let d_cos_di = (u_jk - u_ji * cos_t) / nb_r[a];
                      let grad_i = pre * (2.0 * diff * d_cos_di + diff * diff * d_ea_dr * u_ji);
                      fi = fi - grad_i;
                    }
                  }
                }
                k = atomicLoad(&cell_grid[next_base + k]);
                guard_k = guard_k + 1u;
              }
            }
          }
        }
      } else {
        for (var k = 0u; k < n; k = k + 1u) {
          if (k == j_idx || k == i) { continue; }
          let r_jk_vec = min_image_cfg(pos[k].xyz - pj, box_l, wall_y);
          let r_jk2 = dot(r_jk_vec, r_jk_vec);
          if (r_jk2 >= rcut2 || r_jk2 <= 1.0e-8) { continue; }
          let r_jk = sqrt(r_jk2);
          let db = r_jk / sig - a_sw;
          if (db >= -1.0e-3) { continue; }
          let eb = exp(gamma_sw / db);
          let u_jk = r_jk_vec / r_jk;
          let cos_t = clamp(dot(u_ji, u_jk), -1.0, 1.0);
          let diff = cos_t + 0.33333333;
          let pre = lambda_sw * eps * ea * eb;
          let d_cos_di = (u_jk - u_ji * cos_t) / nb_r[a];
          let grad_i = pre * (2.0 * diff * d_cos_di + diff * diff * d_ea_dr * u_ji);
          fi = fi - grad_i;
        }
      }
    }
  }

  // Optional universal gravity body force (-m * g * y_hat) & smooth C^1 harmonic floor/ceiling walls
  let g_acc = params.grav_cfg.x;
  let m_i = max(vel[i].w, 1.0e-6);
  if (g_acc > 0.0) {
    fi.y = fi.y - m_i * g_acc;
    epot_i = epot_i + m_i * g_acc * pi.y;
  }
  if (wall_y) {
    let dc = max(0.35, params.grav_cfg.z);
    let kw = max(0.0, params.grav_cfg.w);
    if (pi.y < dc) {
      let pen = dc - pi.y;
      fi.y = fi.y + kw * pen;
      epot_i = epot_i + 0.5 * kw * pen * pen;
    } else if (pi.y > box_l.y - dc) {
      let pen = pi.y - (box_l.y - dc);
      fi.y = fi.y - kw * pen;
      epot_i = epot_i + 0.5 * kw * pen * pen;
    }
  }

  pos[i] = vec4<f32>(pi, clamp(f32(coord_i) / ideal_coord, 0.0, 1.5));
  force[i] = vec4<f32>(fi, epot_i);

  if (params.ctrl.z > 0.5) {
    let e_s = params.scale_cfg.x;
    let c_s = params.scale_cfg.w;
    let vir_i = vir_v.x + vir_v.y + vir_v.z;
    atomicAdd(&telemetry[1], i32(clamp(epot_i * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[2], i32(clamp(vir_i * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[7], i32(clamp(sxy * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[8], i32(clamp(sxz * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[9], i32(clamp(syz * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[10], i32(clamp(vir_v.x * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[11], i32(clamp(vir_v.y * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[12], i32(clamp(vir_v.z * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[116], i32(f32(coord_i) * c_s));
  }
}

@compute @workgroup_size(64)
fn vv_second_kick_reduce(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let box_l = params.box_dt.xyz;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  var dv = (0.5 * dt / m) * force[i].xyz;
  let max_dv = params.phase_cfg.w;
  if (max_dv > 0.0) {
    let dv_len = length(dv);
    if (dv_len > max_dv) {
      dv = dv * (max_dv / dv_len);
    }
  }
  var v_new = v4.xyz + dv;
  let therm_on = (params.counts.w & 1u) != 0u;
  let exp_mode = (params.counts.w >> 8u) & 15u;
  let p4 = pos[i];
  let p3 = p4.xyz;
  var heat_delta_add = 0.0;
  var heat_delta_rem = 0.0;

  if (exp_mode == 3u) {
    let fy = p3.y / max(1.0e-5, box_l.y);
    let v_wall = params.ctrl.w;
    if (fy < 0.18) {
      v_new.x = mix(v_new.x, -v_wall, 0.25);
    } else if (fy > 0.82) {
      v_new.x = mix(v_new.x, v_wall, 0.25);
    }
    if (therm_on) {
      v_new.y = v_new.y * params.ctrl.y;
      v_new.z = v_new.z * params.ctrl.y;
    }
  } else if (exp_mode == 4u) {
    let fx = p3.x / max(1.0e-5, box_l.x);
    let ke_before = 0.5 * m * dot(v_new, v_new);
    if (fx < 0.20) {
      v_new = v_new * params.nemd.x;
      let ke_after = 0.5 * m * dot(v_new, v_new);
      heat_delta_add = ke_after - ke_before;
    } else if (fx >= 0.50 && fx < 0.70) {
      v_new = v_new * params.nemd.y;
      let ke_after = 0.5 * m * dot(v_new, v_new);
      heat_delta_rem = ke_before - ke_after;
    }
  } else if (therm_on) {
    let vy_cm = select(0.0, params.grav_cfg.y, params.grav_cfg.x > 0.0);
    v_new = vec3<f32>(
      v_new.x * params.ctrl.y,
      vy_cm + (v_new.y - vy_cm) * params.ctrl.y,
      v_new.z * params.ctrl.y
    );
  }

  vel[i] = vec4<f32>(v_new, m);

  if (params.ctrl.z > 0.5) {
    let e_s = params.scale_cfg.x;
    let m_s = params.scale_cfg.y;
    let v_s = params.scale_cfg.z;
    let ekin = 0.5 * m * dot(v_new, v_new);
    let kin_v = m * (v_new * v_new);
    let disp = unwrapped[i].xyz - init_state[i].xyz;
    let msd_i = dot(disp, disp);
    let v0 = init_state[params.counts.x + i].xyz;
    let vacf_i = dot(v_new, v0);
    let vacf_d = dot(v0, v0);

    let r_nn = max(1.2, params.phase_cfg.x);
    let disp_norm = sqrt(max(0.0, msd_i)) / r_nn;
    let z_norm = p4.w;
    if (z_norm < 0.22) {
      atomicAdd(&telemetry[119], 1i);
    } else if (z_norm >= 0.45 && disp_norm < 0.36) {
      atomicAdd(&telemetry[117], 1i);
    } else {
      atomicAdd(&telemetry[118], 1i);
    }

    atomicAdd(&telemetry[0], i32(clamp(ekin * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[3], i32(clamp(msd_i * m_s, 0.0, 1.0e7)));
    atomicAdd(&telemetry[4], i32(clamp(m * v_new.x * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[5], i32(clamp(m * v_new.y * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[6], i32(clamp(m * v_new.z * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[13], i32(clamp(kin_v.x * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[14], i32(clamp(kin_v.y * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[15], i32(clamp(kin_v.z * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[80], i32(clamp(vacf_i * v_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[81], i32(clamp(vacf_d * v_s, 0.0, 1.0e7)));
    atomicAdd(&telemetry[82], i32(clamp(heat_delta_add * v_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[83], i32(clamp(heat_delta_rem * v_s, -1.0e7, 1.0e7)));

    let coord_f = select(p3.x / max(1.0e-5, box_l.x), p3.y / max(1.0e-5, box_l.y), exp_mode == 3u);
    let slab = u32(clamp(floor(coord_f * 8.0), 0.0, 7.0));
    let sbase = 84u + slab * 4u;
    atomicAdd(&telemetry[sbase + 0u], 1i);
    atomicAdd(&telemetry[sbase + 1u], i32(clamp(ekin * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[sbase + 2u], i32(clamp(v_new.x * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[sbase + 3u], i32(clamp(v_new.y * e_s, -1.0e7, 1.0e7)));
    atomicAdd(&telemetry[120], i32(clamp(p3.y / max(1.0e-5, box_l.y), 0.0, 1.0) * params.scale_cfg.w));
  }
}
`;function Tr(e,{positions:t,velocities:n,boxLengthsA:r,potentialModel:i=vr.LENNARD_JONES,epsilonEv:a=.0103,sigmaOrR0A:o=3.405,alphaOrLambda:s=1.5,rcutA:c=8.5,eamAEv:l=0,eamBeta:u=1.2,swGamma:d=1.2,dtFs:f=2,targetTemperatureK:p=0,thermostatCouplingFs:m=0,rNearestNeighborA:h=null,idealCoordination:g=null,meltingPointK:_=null,bulkModulusGPa:v=null,cohesiveEnergyEv:y=null,crystalStructure:b=null,gravityEnabled:x=!1,gravityAccelInternal:S=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createMolecularDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let C=t instanceof Float32Array?t:Float32Array.from(t),w=n instanceof Float32Array?n:Float32Array.from(n),T=Math.floor(C.length/4);if(!(T>=2&&w.length===T*4))throw RangeError(`Invalid MD buffers: atomCount=${T}, velFloats=${w.length}`);let E=Number(e.limits?.maxStorageBufferBindingSize)||128*1024*1024;if(T*32>E)throw RangeError(`MD init_state (${T*32} B) exceeds device maxStorageBufferBindingSize (${E} B)`);let D=Array.isArray(r)?[Number(r[0]),Number(r[1]),Number(r[2])]:[Number(r),Number(r),Number(r)],O=String(b||``).toLowerCase(),k=Number.isFinite(Number(h))&&Number(h)>.8?Number(h):i===vr.LENNARD_JONES?Number(o)*2**(1/6):Number(o),A=Number.isFinite(Number(g))&&Number(g)>=4?Number(g):O===`bcc`||O.startsWith(`cscl`)?14:O===`diamond`||O.startsWith(`zincblende`)||O.startsWith(`cristobalite`)?4:12,j=Number.isFinite(Number(_))&&Number(_)>1?Number(_):Math.max(50,Number(p)||600),M=Number.isFinite(Number(v))&&Number(v)>.2?Number(v):Math.max(2,Math.min(350,Number(a)*160.22/Math.max(4,k**3)*28)),N=Math.max(1,Number(w[3])||28),P=Number.isFinite(Number(y))&&Number(y)>.01?Number(y):Math.max(.04,Number(a)*6+Number(l)*1.6),F=T<=2e3?1e4:Math.max(10,Math.floor(2e7/T)),ee=T<=2e3?1e4:Math.max(2,Math.floor(2e6/T)),te=T<=2e3?1e5:Math.max(10,Math.floor(2e7/T)),ne=T<=8e3?100:10,R=T<=4096?1:Math.max(2,Math.floor(T/4096)),re=Math.ceil(T/R),ie=[L(0,`uniform`),L(1,`storage`),L(2,`storage`),L(3,`storage`),L(4,`storage`),L(5,`read-only-storage`),L(6,`storage`),L(7,`storage`)],z=t=>I(e,{cacheKey:`ulg-gpumath-md-${t}.v6`,label:`ulg-gpumath-md-${t}`,code:wr,entryPoint:t,bindings:ie}),ae=z(`reset_telemetry`),B=z(`clear_cell_list`),oe=z(`build_cell_list`),se=z(`apply_affine_strain`),V=z(`inject_acoustic_pulse`),ce=z(`vv_half_kick_drift`),le=z(`compute_eam_density`),H=z(`compute_forces`),U=z(`vv_second_kick_reduce`),W=T*16,ue=(t,n,r)=>{let i=e.createBuffer({label:t,size:Math.max(16,n?n.byteLength:W),usage:r});return n&&e.queue.writeBuffer(i,0,n),i},de=e.createBuffer({label:`ulg-md-params`,size:176,usage:X.UNIFORM|X.COPY_DST}),fe=ue(`ulg-md-pos`,C,X.STORAGE|X.COPY_DST|X.COPY_SRC),G=ue(`ulg-md-vel`,w,X.STORAGE|X.COPY_DST|X.COPY_SRC),pe=ue(`ulg-md-force`,new Float32Array(T*4),X.STORAGE|X.COPY_DST|X.COPY_SRC),me=ue(`ulg-md-unwrapped`,C,X.STORAGE|X.COPY_DST|X.COPY_SRC),he=new Float32Array(T*8);he.set(C,0),he.set(w,T*4);let K=ue(`ulg-md-init-state`,he,X.STORAGE|X.COPY_DST),ge=e.createBuffer({label:`ulg-md-telemetry`,size:Sr*4,usage:X.STORAGE|X.COPY_SRC}),q=e.createBuffer({label:`ulg-md-telemetry-read`,size:Sr*4,usage:X.MAP_READ|X.COPY_DST}),_e=Math.min(E,(Cr+T+64)*4),ve=Math.max(1,Math.min(Cr,Math.floor(_e/4)-T-16)),ye=e.createBuffer({label:`ulg-md-linked-cell-grid`,size:Math.max(64,(ve+T+16)*4),usage:X.STORAGE}),be=e.createBindGroup({layout:H.bindGroupLayout,entries:[de,fe,G,pe,me,K,ge,ye].map((e,t)=>({binding:t,resource:{buffer:e}}))}),xe=Number(f)/br,J=[...D],Se=Math.max(1,Number(p)||300),Ce=Se*1.25,we=Math.max(1,Se*.75),Te=0,Ee=0,De=!1,Oe=yr.EQUILIBRIUM,ke=0,Ae=0,je=0,Y=0,Me=0,Ne=!!x,Pe=Number.isFinite(Number(S))&&Number(S)>0?Number(S):null,Fe=1,Ie=0,Le=null,Re=!1,ze=()=>{if(!Ne)return 0;if(Pe!=null)return Pe*Fe;let e=2*P/Math.max(1,N*Math.max(12,D[1])),t=.14*P/Math.max(1,N*Math.max(1.5,k));return Math.max(15e-6,Math.min(t,e))*Fe},Be=()=>{let e=Math.max(.5,Number(c)),t=Math.max(1,Math.floor(D[0]/e)),n=Math.max(1,Math.floor(D[1]/e)),r=Math.max(1,Math.floor(D[2]/e));if(t*n*r>ve){let e=Math.cbrt(ve/(t*n*r));for(t=Math.max(1,Math.floor(t*e)),n=Math.max(1,Math.floor(n*e)),r=Math.max(1,Math.floor(r*e));t*n*r>ve;)if(t>=n&&t>=r&&t>1)--t;else if(n>=r&&n>1)--n;else if(r>1)--r;else break}let i=t*n*r,a=+(T>=128&&i>=8);return{nx:t,ny:n,nz:r,totalCells:i,useCellList:a,nextBase:a?i:0}},Ve=({collectTelemetry:t=!1,scaleVel:n=1,useThermostat:r=!1,hotScale:h=1,coldScale:g=1,strainSx:_=1,strainSy:v=1,strainSz:y=1,shearXY:b=0,pulseAmp:x=0,pulsePol:S=0,dtScale:C=1}={})=>{let w=Math.max(.05,Math.min(1,Number(C)||1)),E=Number(f)*w,O=xe*w,M=Be(),P=r?Math.max(.45,.28*k/Math.max(.02,O)):0,I=ze(),L=Ne&&I>0,re=Math.min(.85*k,.14*D[1]),ie=L?.025*N/Math.max(4e-4,O*O):0,z=new ArrayBuffer(176),ae=!!r|(L?2:0)|(Oe&15)<<8;return new Uint32Array(z,0,4).set([T,i,R,ae]),new Float32Array(z,16,4).set([D[0],D[1],D[2],O]),new Float32Array(z,32,4).set([a,o,s,c]),new Float32Array(z,48,4).set([l,u,d,p]),new Float32Array(z,64,4).set([m>0?E/m:0,n,+!!t,ke]),new Float32Array(z,80,4).set([h,g,_,v]),new Float32Array(z,96,4).set([y,b,x,S]),new Uint32Array(z,112,4).set([M.nx,M.ny,M.nz,M.nextBase]),new Float32Array(z,128,4).set([k,A,j,P]),new Float32Array(z,144,4).set([F,ee,te,ne]),new Float32Array(z,160,4).set([I,L?Ie:0,re,ie]),e.queue.writeBuffer(de,0,z),M},He=Math.ceil(T/64);function Ue(e,t){t.nextBase>0&&(e.setPipeline(B.pipeline),e.dispatchWorkgroups(Math.max(1,Math.ceil(t.totalCells/64))),e.setPipeline(oe.pipeline),e.dispatchWorkgroups(He)),i===vr.MORSE_EAM&&(e.setPipeline(le.pipeline),e.dispatchWorkgroups(He)),e.setPipeline(H.pipeline),e.dispatchWorkgroups(He)}function We(e,{shearWallVel:t=0,thermalDeltaT:n=0}={}){Oe=Math.max(0,Math.min(5,Math.trunc(Number(e)||0))),ke=Number(t)||0,Ae=Number(n)||0}function Ge(e,{accelInternal:t=null,strength:n=null}={}){let r=!!e;return t!==void 0&&(Pe=t!=null&&Number.isFinite(Number(t))&&Number(t)>0?Number(t):null),n!=null&&Number.isFinite(Number(n))&&Number(n)>0&&(Fe=Math.max(.1,Math.min(5,Number(n)))),r!==Ne&&(Ne=r,Ie=0,De=!1),Ke()}function Ke(){let e=ze(),t=e*(1e6/(br*br));return{enabled:Ne,strength:Fe,accelInternal:e,accelAPerPs2:t}}function qe({strainX:t=0,strainY:n=0,strainZ:r=0,shearXY:i=0}={}){if(Re)return;let a=Math.max(.82,Math.min(1.22,1+Number(t||0))),o=Math.max(.82,Math.min(1.22,1+Number(n||0))),s=Math.max(.82,Math.min(1.22,1+Number(r||0))),c=Math.max(-.22,Math.min(.22,Number(i||0))),l=Math.max(J[0]*.78,Math.min(J[0]*2.35,D[0]*a)),u=Math.max(J[1]*.78,Math.min(J[1]*2.35,D[1]*o)),d=Math.max(J[2]*.78,Math.min(J[2]*2.35,D[2]*s)),f=l/Math.max(1e-6,D[0]),p=u/Math.max(1e-6,D[1]),m=d/Math.max(1e-6,D[2]);D[0]=l,D[1]=u,D[2]=d,je=(D[0]-J[0])/Math.max(1e-6,J[0]),Y=(D[1]-J[1])/Math.max(1e-6,J[1]),Me+=c,Ve({strainSx:f,strainSy:p,strainSz:m,shearXY:c});let h=e.createCommandEncoder({label:`ulg-md-apply-strain`}),g=h.beginComputePass();g.setBindGroup(0,be),g.setPipeline(se.pipeline),g.dispatchWorkgroups(He),g.end(),e.queue.submit([h.finish()]),De=!1}function Je({polarization:t=`longitudinal`,amplitude:n=.36}={}){if(Re)return;let r=+(t===`transverse`);Ve({pulseAmp:Number(n)||.36,pulsePol:r});let i=e.createCommandEncoder({label:`ulg-md-inject-acoustic`}),a=i.beginComputePass();a.setBindGroup(0,be),a.setPipeline(V.pipeline),a.dispatchWorkgroups(He),a.end(),e.queue.submit([i.finish()])}function Ye(){if(Re)return;let t=e.createCommandEncoder({label:`ulg-md-reset-vacf`});t.copyBufferToBuffer(G,0,K,W,W),e.queue.submit([t.finish()])}function Xe(){if(Re)return;let t=e.createCommandEncoder({label:`ulg-md-reset-msd`});t.copyBufferToBuffer(me,0,K,0,W),t.copyBufferToBuffer(G,0,K,W,W),e.queue.submit([t.finish()])}async function Ze(t=10,{readTelemetry:n=!0,temperatureK:r=p,nptBarostatGPa:i=null,nonBlocking:a=!1,dtScale:o=1}={}){if(Re)return null;if(n&&Le){if(a)return null;try{await Le}catch{}if(Re)return null}let s=Math.max(1,Math.trunc(Number(t))),l=Math.max(.05,Math.min(1,Number(o)||1)),u=Number(f)*l,d=Number(r)>0&&Number(m)>0,h=1;if(d&&Se>0){let e=Math.max(1,Number(r)),t=Math.max(u,Number(m)),n=Math.exp(-(s*u)/t),i=e+(Se-e)*n;h=Math.max(.15,Math.min(6,i/Math.max(.5,Se)))**(.5/s)}let g=Math.max(5,Number(r)||300),_=Math.max(10,Math.min(g*.65,Ae||g*.35)),v=g+_,y=Math.max(5,g-_),b=Math.max(1,Math.min(s,14)),x=Math.max(.5,Math.min(2.8,v/Math.max(10,Ce))),S=Math.max(.3,Math.min(1.6,y/Math.max(10,we))),C=Math.max(.96,Math.min(1.018,x**(.5/b))),w=Math.max(.955,Math.min(1.015,S**(.5/b)));if(!De||s>1){let t=e.createCommandEncoder({label:`ulg-md-batch-${s}`});if(!De){let e=Ve({collectTelemetry:!1,scaleVel:1,useThermostat:!1,hotScale:1,coldScale:1,dtScale:l}),n=t.beginComputePass({label:`ulg-md-init-forces`});n.setBindGroup(0,be),Ue(n,e),n.end(),De=!0}if(s>1){let e=Ve({collectTelemetry:!1,scaleVel:h,useThermostat:d,hotScale:C,coldScale:w,dtScale:l}),n=t.beginComputePass({label:`ulg-md-steps-loop`});n.setBindGroup(0,be);for(let t=0;t<s-1;t+=1)n.setPipeline(ce.pipeline),n.dispatchWorkgroups(He),Ue(n,e),n.setPipeline(U.pipeline),n.dispatchWorkgroups(He);n.end()}e.queue.submit([t.finish()])}let E=e.createCommandEncoder({label:`ulg-md-final-step`}),O=Ve({collectTelemetry:n,scaleVel:h,useThermostat:d,hotScale:C,coldScale:w,dtScale:l}),j=E.beginComputePass({label:`ulg-md-final-pass`});if(j.setBindGroup(0,be),n&&(j.setPipeline(ae.pipeline),j.dispatchWorkgroups(2)),j.setPipeline(ce.pipeline),j.dispatchWorkgroups(He),Ue(j,O),j.setPipeline(U.pipeline),j.dispatchWorkgroups(He),j.end(),n&&E.copyBufferToBuffer(ge,0,q,0,Sr*4),e.queue.submit([E.finish()]),Te+=s,Ee+=s*u,!n)return null;let P=(async()=>{if(await q.mapAsync(X.MAP_READ),Re){try{q.unmap()}catch{}return null}let e=new Int32Array(q.getMappedRange().slice(0,Sr*4));q.unmap();let t=e[0]/F,n=e[1]/F,r=t+n,a=e[2]/F,o=e[3]/(ee*T),s=[e[4]/F,e[5]/F,e[6]/F],l=D[0]*D[1]*D[2],d=Math.max(1,3*T-3),f=T*N,p=s[1]/Math.max(1e-6,f),m=Ne?.5*(s[0]*s[0]+s[1]*s[1]+s[2]*s[2])/Math.max(1e-6,f):0,h=2*Math.max(1e-9,t-m)/(d*xr);Se=Number.isFinite(h)&&h>0?h:Se,Ie=Ne&&Number.isFinite(p)?p:0;let g=160.2176634,_=(2*t+a)/(3*l)*g,v=[e[7]/F/l*g,e[8]/F/l*g,e[9]/F/l*g],y=[(e[13]/F+e[10]/F)/l*g,(e[14]/F+e[11]/F)/l*g,(e[15]/F+e[12]/F)/l*g],b=Math.max(0,.5*D[2]*(.5*(y[0]+y[1])-y[2])*.1),x=e[81]/te,S=x>1e-6?Math.max(-1.2,Math.min(1.2,e[80]/te/x)):0,C=e[82]/te,w=e[83]/te,E=e[116]/(ne*T),j=Math.max(0,e[117]),P=Math.max(0,e[118]),I=Math.max(0,e[119]),L=e[120]/(ne*T),R=Ke(),ie=j/T,z=P/T,ae=I/T,B=Math.sqrt(Math.max(0,o))/Math.max(1.2,k),oe=`solid`;ae>=.45?oe=`vapor`:ae>=.18&&z+ie>=.25?oe=`boiling`:(z>=ie||B>=.28)&&(oe=`liquid`);let se=new Float32Array(8),V=new Float32Array(8),ce=new Float32Array(8),le=new Float32Array(8);for(let t=0;t<8;t+=1){let n=84+t*4,r=Math.max(0,e[n]);se[t]=r,r>0&&(V[t]=2*(e[n+1]/F)/(3*r*xr),ce[t]=e[n+2]/F/r,le[t]=e[n+3]/F/r)}if(Oe===yr.THERMAL_NEMD){let e=(V[0]+V[1])*.5,t=(V[4]+V[5])*.5;e>1&&(Ce=e),t>1&&(we=t)}let H=null;if(Oe===yr.SHEAR_NEMD&&ke>1e-4){let e=Math.max(10,Math.abs(ce[6]-ce[1])*9822.7||2*ke*9822.7)/Math.max(1e-10,D[1]*.65*1e-10),t=Math.abs(v[0])*1e9;e>1&&t>0&&(H=t/e)}let U=null;if(Oe===yr.THERMAL_NEMD){let e=Math.max(1,Math.abs(V[0]-V[4])),t=Math.max(1e-10,.5*D[0]*1e-10),n=Math.max(1e-20,D[1]*D[2]*1e-20),r=.5*(Math.abs(C)+Math.abs(w))*1602176634e-28/(2*n*Math.max(1e-16,u*1e-15));r>0&&(U=r/(e/t))}if(i!=null&&Number.isFinite(Number(i))){let e=Number(i),t=Math.max(5e-4,Math.min(.012,.065/Math.max(2,M)));if(Oe===yr.STRAIN){let n=Math.max(.99,Math.min(1.01,1+t*(y[1]-e))),r=Math.max(.99,Math.min(1.01,1+t*(y[2]-e)));(Math.abs(n-1)>1e-5||Math.abs(r-1)>1e-5)&&qe({strainY:n-1,strainZ:r-1})}else{let n=Math.max(.985,Math.min(1.018,1+t*(_-e)));Math.abs(n-1)>1e-5&&qe({strainX:n-1,strainY:n-1,strainZ:n-1})}}let W=new Float32Array(64),ue=c/64,de=T/l;for(let t=0;t<64;t+=1){let n=(t+.5)*ue,r=4*Math.PI*n*n*ue,i=Math.max(1e-9,re*de*r);W[t]=e[16+t]/i}let fe=l/Math.max(1e-6,J[0]*J[1]*J[2]),G=Math.abs(je)>.005?Math.max(-.2,Math.min(.49,-Y/je)):null;return Object.freeze({schema:_r,backend:`webgpu`,usedCellList:O.nextBase>0,cellDims:Object.freeze([O.nx,O.ny,O.nz]),experimentMode:Oe,totalSteps:Te,timeFs:Ee,atomCount:T,boxLengthsA:Object.freeze([...D]),initBoxLengthsA:Object.freeze([...J]),volumeRatio:fe,strainX:je,strainY:Y,shearXY:Me,poissonMeasured:G,kineticEnergyEv:t,potentialEnergyEv:n,totalEnergyEv:r,temperatureK:h,pressureGPa:_,diagPressureGPa:Object.freeze(y),msdA2:o,lindemannRatio:B,meanCoordination:E,idealCoordination:A,solidFraction:ie,liquidFraction:z,vaporFraction:ae,emergentPhase:oe,gravityEnabled:R.enabled,gravityAccelInternal:R.accelInternal,gravityAccelAPerPs2:R.accelAPerPs2,meanYFrac:L,vacf:S,momentum:s,stressOffDiagGPa:v,surfaceTensionNPerM:b,nemdViscosityPaS:H,nemdThermalCondWPerMK:U,slabTempK:V,slabVx:ce,slabVy:le,rdf:W})})();Le=P;try{return await P}finally{Le===P&&(Le=null)}}async function Qe(){let t=e.createBuffer({size:W,usage:X.MAP_READ|X.COPY_DST}),n=e.createBuffer({size:W,usage:X.MAP_READ|X.COPY_DST}),r=e.createCommandEncoder({label:`ulg-md-read-pos-vel`});r.copyBufferToBuffer(fe,0,t,0,W),r.copyBufferToBuffer(G,0,n,0,W),e.queue.submit([r.finish()]);try{await Promise.all([t.mapAsync(X.MAP_READ),n.mapAsync(X.MAP_READ)]);let e=new Float32Array(t.getMappedRange().slice(0,W)),r=new Float32Array(n.getMappedRange().slice(0,W));return t.unmap(),n.unmap(),{positions:e,velocities:r}}finally{t.destroy(),n.destroy()}}return Object.freeze({schema:_r,atomCount:T,rNearestNeighborA:k,idealCoordination:A,get boxLengthsA(){return[...D]},get initBoxLengthsA(){return[...J]},positionsBuffer:fe,velocitiesBuffer:G,forcesBuffer:pe,setExperimentMode:We,setGravity:Ge,getGravity:Ke,applyStrain:qe,injectAcousticPulse:Je,resetVacfOrigin:Ye,resetMsdOrigin:Xe,stepBatch:Ze,readPositionsAndVelocities:Qe,destroy(){Re=!0;for(let e of[de,fe,G,pe,me,K,ge,q,ye])try{e.destroy()}catch{}}})}function Er(e,t=8,n=32){let r=Array.isArray(e)?e.length:0,i=new Float32Array(n),a=new Float32Array(n);if(r<4)return{freqsThz:i,vdos:a,peakThz:0,effectiveDebyeK:0};let o=Math.min(24,500/Math.max(1,t)),s=1e-6,c=0;for(let l=0;l<n;l+=1){let u=(l+.5)/n*o;i[l]=u;let d=2*Math.PI*u*.001,f=0;for(let n=0;n<r;n+=1){let i=.5*(1+Math.cos(Math.PI*n/Math.max(1,r-1)));f+=e[n]*i*Math.cos(d*n*t)}let p=Math.max(0,f);a[l]=p,p>s&&(s=p,c=l)}for(let e=0;e<n;e+=1)a[e]/=s;let l=i[c];return{freqsThz:i,vdos:a,peakThz:l,effectiveDebyeK:l*47.99243*1.25}}function Dr(e){return!e||typeof e.registerModule!=`function`?null:{mechMod:e.registerModule({method:{model:`md-mechanical-probe`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`apply_affine_strain`,workgroupSize:64,wgsl:wr},parameterSchema:{strainX:{type:`number`,min:-.18,max:.18},shearXY:{type:`number`,min:-.18,max:.18},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_crystal_stress_strain`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-mechanical-probe@1 requires a WebGPU device`);let r=e?.parameters||{},i=Tr(n,{...Or(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:100}),...r.potential||{}});try{i.setExperimentMode(yr.STRAIN);let e=await i.stepBatch(6,{readTelemetry:!0,temperatureK:r.temperatureK??100});return i.applyStrain({strainX:r.strainX??-.02,shearXY:r.shearXY??0}),{status:`ok`,baseline:e,strained:await i.stepBatch(r.steps??12,{readTelemetry:!0,temperatureK:r.temperatureK??100})}}finally{i.destroy()}}}),nemdMod:e.registerModule({method:{model:`md-nemd-transport`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`vv_second_kick_reduce`,workgroupSize:64,wgsl:wr},parameterSchema:{mode:{type:`number`,min:0,max:5},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_nemd_slab_transport`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-nemd-transport@1 requires a WebGPU device`);let r=e?.parameters||{},i=Tr(n,{...Or(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:300}),...r.potential||{}});try{return i.setExperimentMode(r.mode??yr.THERMAL_NEMD,{shearWallVel:r.shearWallVel??.12,thermalDeltaT:r.thermalDeltaT??120}),{status:`ok`,telemetry:await i.stepBatch(r.steps??20,{readTelemetry:!0,temperatureK:r.temperatureK??300})}}finally{i.destroy()}}})}}function Or({crystalStructure:e=`fcc`,cellsPerSide:t=3,cellsVec:n=null,vacuumZFactor:r=1,chamberScale:i=1,vacancyFraction:a=0,latticeConstantA:o=4.05,massU:s=26.982,temperatureK:c=300,seed:l=1337}={}){let u=Math.max(2,Math.trunc(t)),d=Array.isArray(n)?Math.max(2,Math.trunc(n[0])):u,f=Array.isArray(n)?Math.max(2,Math.trunc(n[1])):u,p=Array.isArray(n)?Math.max(2,Math.trunc(n[2])):u,m=Math.max(1,Number(r)||1),h=Math.max(1,Math.min(3,Number(i)||1)),g=Math.max(0,Math.min(.08,Number(a)||0)),_=Number(o),v=String(e||`fcc`).toLowerCase(),y,b=[1,1,1],x=_/Math.SQRT2,S=12;if(v===`bcc`||v.startsWith(`cscl`))y=[[0,0,0],[.5,.5,.5]],x=_*Math.sqrt(3)/2,S=14;else if(v===`diamond`||v.startsWith(`zincblende`)||v.startsWith(`cristobalite`))y=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]],x=_*Math.sqrt(3)/4,S=4;else if(v===`hcp`){let e=_/Math.SQRT2;b=[e/_,Math.sqrt(3)*e/_,1.632993*e/_],y=[[0,0,0],[.5,.5,0],[0,1/3,.5],[.5,5/6,.5]],x=e,S=12}else y=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5]],x=_/Math.SQRT2,S=12;let C=l>>>0,w=()=>(C=Math.imul(1664525,C)+1013904223>>>0,(C+.5)/4294967296),T=()=>Math.sqrt(-2*Math.log(w()))*Math.cos(2*Math.PI*w()),E=y.length,D=E*d*f*p,O=null,k=0;if(g>0&&D>=64){k=Math.max(1,Math.min(Math.floor(D*.05),Math.round(D*g)));let e=Math.max(3,Math.floor(D/(k+1)));O=new Set;for(let t=1;t<=k;t+=1)O.add((t*e+Math.floor(e*.5))%D);k=O.size}let A=D-k,j=new Float32Array(A*4),M=new Float32Array(A*4),N=_*b[0],P=_*b[1],F=_*b[2],I=d*N,L=f*P,ee=p*F,te=I*h,ne=L*h,R=ee*m*h,re=h>1.01?.5*(te-I):0,ie=h>1.01?.5*(ne-L):0,z=m>1.01||h>1.01?.5*(R-ee):0,ae=Math.sqrt(Math.max(1e-9,xr*c/Math.max(s,1e-6))),B=0,oe=0,se=0,V=0,ce=0;for(let e=0;e<d;e+=1)for(let t=0;t<f;t+=1)for(let n=0;n<p;n+=1)for(let r=0;r<E;r+=1){let i=O!==null&&O.has(B);if(B+=1,i)continue;let a=y[r],o=oe*4;j[o+0]=(e+a[0])*N+re,j[o+1]=(t+a[1])*P+ie,j[o+2]=(n+a[2])*F+z,j[o+3]=1;let c=T()*ae,l=T()*ae,u=T()*ae;M[o+0]=c,M[o+1]=l,M[o+2]=u,M[o+3]=s,se+=c,V+=l,ce+=u,oe+=1}se/=A,V/=A,ce/=A;let le=0;for(let e=0;e<A;e+=1){let t=e*4,n=M[t+0]-se,r=M[t+1]-V,i=M[t+2]-ce;M[t+0]=n,M[t+1]=r,M[t+2]=i,le+=.5*s*(n*n+r*r+i*i)}let H=.5*(3*A-3)*xr*c,U=le>0?Math.sqrt(H/le):0;for(let e=0;e<A;e+=1){let t=e*4;M[t+0]*=U,M[t+1]*=U,M[t+2]*=U}return{crystalStructure:v,atomCount:A,rNearestNeighborA:x,idealCoordination:S,positions:j,velocities:M,boxLengthsA:[te,ne,R]}}var kr=`peercompute.ulg.sedenion-reaction-scope.v0`,Ar=`sedenion-periodic-table-pdf:peercompute/plan/refs/sedenion periodic table.pdf`,jr=[kr,`fano-triples:123-145-167-246-257-347-356`,`cd-partners:e1/e9-e7/e15`,`period-proxy:v1`].join(`|`),Mr=Object.freeze([Object.freeze([1,2,3]),Object.freeze([1,4,5]),Object.freeze([1,6,7]),Object.freeze([2,4,6]),Object.freeze([2,5,7]),Object.freeze([3,4,7]),Object.freeze([3,5,6])]),Nr=Object.freeze([Object.freeze({lowerIndex:1,period:1,zRange:[1,2],nobleGas:`He`,partnerIndex:9,layer:`C`}),Object.freeze({lowerIndex:2,period:2,zRange:[3,10],nobleGas:`Ne`,partnerIndex:10,layer:`H`}),Object.freeze({lowerIndex:3,period:3,zRange:[11,18],nobleGas:`Ar`,partnerIndex:11,layer:`H`}),Object.freeze({lowerIndex:4,period:4,zRange:[19,36],nobleGas:`Kr`,partnerIndex:12,layer:`O`}),Object.freeze({lowerIndex:5,period:5,zRange:[37,54],nobleGas:`Xe`,partnerIndex:13,layer:`O`}),Object.freeze({lowerIndex:6,period:6,zRange:[55,86],nobleGas:`Rn`,partnerIndex:14,layer:`O`}),Object.freeze({lowerIndex:7,period:7,zRange:[87,118],nobleGas:`Og`,partnerIndex:15,layer:`O`})]);new Map(Nr.map(e=>[e.lowerIndex,e]));var Pr=new Set(Nr.map(e=>e.zRange[1])),Fr=Object.freeze({scientificValidation:!1,chemistryValidation:!1,thermochemicalValidation:!1,kineticsValidation:!1,fullPhysicsValidation:!1});function Ir(e=16){return Array(e).fill(0)}function Lr(e,t=16){let n=Ir(t);for(let t of e)n[t.index]+=t.coefficient??1;return n}function Rr(e){let t=e.length/2;return[e.slice(0,t),e.slice(t)]}function zr(e,t){return e.map((e,n)=>e+t[n])}function Br(e,t){return e.map((e,n)=>e-t[n])}function Vr(e,t){return e.map(e=>e*t)}function Hr(e){if(e.length===1)return e.slice();let[t,n]=Rr(e);return Hr(t).concat(Vr(n,-1))}function Ur(e,t){if(e.length!==t.length)throw Error(`sedenion length mismatch: ${e.length} !== ${t.length}`);if(e.length===1)return[e[0]*t[0]];let[n,r]=Rr(e),[i,a]=Rr(t),o=Br(Ur(n,i),Ur(Hr(a),r)),s=zr(Ur(a,n),Ur(r,Hr(i)));return o.concat(s)}function Wr(e){return e.reduce((e,t)=>e+t*t,0)}function Gr(e){return e.every(e=>e===0)}function Kr(e){let t=e.map((e,t)=>({coefficient:e,index:t})).filter(e=>e.coefficient!==0);return t.length===0?`0`:t.map(({coefficient:e,index:t},n)=>{let r=e<0?`-`:`+`,i=Math.abs(e),a=t===0?`1`:`e${t}`,o=i===1?a:`${i}${a}`;return n===0?e<0?`-${o}`:o:` ${r} ${o}`}).join(``)}function qr({lowerIndex:e,upperIndex:t,sign:n}){let r=n>=0?1:-1,i=Lr([{index:e,coefficient:1},{index:t,coefficient:r}]);return{id:`e${e}${r>=0?`+`:`-`}e${t}`,lowerIndex:e,upperIndex:t,sign:r,label:Kr(i),norm:Wr(i),element:i}}function Jr(e){let t=[];for(let n=9;n<=15;n+=1)n!==e+8&&(t.push(qr({lowerIndex:e,upperIndex:n,sign:1})),t.push(qr({lowerIndex:e,upperIndex:n,sign:-1})));return t}function Yr(e){return e===`cation`||e===`metal`?1:e===`anion`||e===`nonmetal`?-1:null}function Xr(e,t){let n=Yr(t);return n==null?e:e.slice().sort((e,t)=>(e.sign===n?0:1)-(t.sign===n?0:1)||e.upperIndex-t.upperIndex)}function Zr(e,t){let n=Mr.find(n=>n.includes(e)&&n.includes(t))||Mr.find(t=>t.includes(e))||Mr.find(e=>e.includes(t))||null;return n?{id:`fano-line-${n.join(`-`)}`,lowerIndices:n.slice()}:null}function Qr(e){return e?.elementCount===1?e.elements[0]:null}function $r(e){let t=Number(e);return Nr.find(e=>t>=e.zRange[0]&&t<=e.zRange[1])||null}function ei(e,t,n={}){return{schema:kr,sourceRef:Ar,fingerprint:jr,status:e,reactiveClass:t,validation:Fr,scientificValidation:!1,...n}}function ti(e,t){return{input:e?.input??null,formula:e?.formula??null,canonicalFormula:e?.canonicalFormula??null,elementSymbol:t?.symbol??null,atomicNumber:t?.Z??null,count:t?.count??null}}function ni(e){return e?{id:e.id,label:e.label,lowerIndex:e.lowerIndex,upperIndex:e.upperIndex,sign:e.sign,norm:e.norm}:null}function ri(e,t,n,r){let i=Xr(Jr(e.lowerIndex),n),a=Xr(Jr(t.lowerIndex),r);for(let e of i)for(let t of a){let n=Ur(e.element,t.element),r=Wr(n),i=r-e.norm*t.norm;if(Gr(n)||i===-4)return{leftState:e,rightState:t,productLabel:Kr(n),productNorm:r,delta:i,zeroDivisor:Gr(n)}}return null}function ii(e,t,{familyId:n=null,leftRole:r=null,rightRole:i=null,preferredBondType:a=null}={}){let o=Qr(e),s=Qr(t),c={familyId:n,left:ti(e,o),right:ti(t,s),leftRole:r,rightRole:i,preferredBondType:a};if(!o||!s)return ei(`symbolic-prefilter-not-applicable`,`unknown`,{role:`compound-or-multi-element`,reactiveClassReason:`sedenion grammar currently scopes elemental reactant channels only`,bondTypePrior:a||`unknown`,normDefectPrior:null,fanoGroup:null,symbolicConfidence:0,blockers:[`compound-or-multi-element-species`],input:c});let l=$r(o.Z),u=$r(s.Z);if(!l||!u)return ei(`symbolic-prefilter-unmapped-period`,`unknown`,{role:`unmapped-period`,bondTypePrior:a||`unknown`,normDefectPrior:null,fanoGroup:null,symbolicConfidence:0,blockers:[`element-period-not-mapped-to-sedenion-lower-index`],input:c});let d={leftPeriod:{...l},rightPeriod:{...u},fanoGroup:Zr(l.lowerIndex,u.lowerIndex),input:c};if(Pr.has(o.Z)||Pr.has(s.Z))return ei(`inert-cd-partner-channel`,`inert`,{...d,role:`cd-partner-inert-endpoint`,bondTypePrior:`inert`,normDefectPrior:null,zeroDivisorPrior:!1,symbolicConfidence:.9,blockers:[`noble-gas-cd-partner-channel`]});let f=ri(l,u,r,i);return f?ei(`sedenion-zero-divisor-prior`,`reactive`,{...d,role:`${r||`unspecified`}-${i||`unspecified`}`,bondTypePrior:f.delta===-4||f.zeroDivisor?`ionic`:a||`unknown`,normDefectPrior:f.delta,zeroDivisorPrior:f.zeroDivisor,leftState:ni(f.leftState),rightState:ni(f.rightState),productLabel:f.productLabel,productNorm:f.productNorm,symbolicConfidence:.7,blockers:[]}):ei(`sedenion-period-proxy-no-zero-divisor-path`,`unknown`,{...d,role:`${r||`unspecified`}-${i||`unspecified`}`,bondTypePrior:a||`unknown`,normDefectPrior:null,zeroDivisorPrior:!1,symbolicConfidence:.35,blockers:[`element-to-sedenion-state-bijection-not-derived`]})}var Z=1,Q=8,ai=Object.freeze({scientificValidation:!1,thermochemicalValidation:!1,kineticsValidation:!1}),oi=`provisional-heuristic-not-scientifically-validated`,si=`active-metal-water-hydroxide`,ci=`binary-ionic-synthesis`,li=`binary-covalent-synthesis`,ui=`acid-base-neutralization`,di=`fuel-and-hydrocarbon-combustion`,fi=`metal-oxide-redox-displacement`,pi=`metal-acid-displacement`,mi=6,hi=7,gi=16,_i=new Set([9,17,35,53]),vi=new Map([[55,100],[37,98],[19,96],[3,95],[56,92],[38,90],[20,88],[11,86],[12,80],[4,76],[13,72],[22,66],[25,62],[30,58],[24,54],[26,50],[27,45],[28,43],[50,40],[82,38],[1,35],[29,25],[47,15],[80,12],[78,8],[79,5]]),yi=new Map([[1,2.2],[5,2.04],[6,2.55],[7,3.04],[8,3.44],[9,3.98],[14,1.9],[15,2.19],[16,2.58],[17,3.16],[33,2.18],[34,2.55],[35,2.96],[52,2.1],[53,2.66]]),bi=new Map([[1,1],[5,3],[6,4],[7,3],[14,4],[15,3],[16,4],[33,3],[34,4],[52,4]]),xi=new Map([[1,1],[6,4],[7,3],[8,2],[9,1],[15,3],[16,2],[17,1],[34,2],[35,1],[53,1]]),Si=new Set([3,11,19,37,55,87]),Ci=new Set([4,12,20,38,56,88]),wi=new Set([...Si,20,38,56,88]),Ti=new Map([[13,3],[21,3],[22,4],[23,5],[24,3],[25,2],[26,2],[27,2],[28,2],[29,1],[30,2],[31,3],[47,1],[48,2],[49,3],[50,2],[79,1],[80,2],[81,1],[82,2]]),Ei=new Map([[9,1],[17,1],[35,1],[53,1],[85,1],[8,2],[16,2],[34,2],[52,2],[7,3],[15,3],[33,3],[6,4],[14,4]]);function Di(e,t){let n=Math.abs(e),r=Math.abs(t);for(;r;)[n,r]=[r,n%r];return n||1}function Oi(e,t){return Math.abs(e*t)/Di(e,t)}function ki(e){return e.elementCount===1?e.elements[0]:null}function Ai(e){return rr(e.atomCounts,{[Z]:2,[Q]:1})}function ji(e){return Si.has(e)?1:Ci.has(e)?2:Ti.has(e)?Ti.get(e):e>=39&&e<=46||e>=72&&e<=78||e>=57&&e<=71||e>=89&&e<=103?3:null}function Mi(e){return Ei.get(e)??null}function Ni(e){return Si.has(e)?`alkali-metal-water-reactive`:wi.has(e)?`alkaline-earth-water-reactive`:null}function $(e,t,n=null){return{coefficient:e,formula:typeof t==`string`?t:t.formula,atomCounts:n||t.atomCounts}}function Pi({coefficient:e,formula:t}){return e===1?t:`${e} ${t}`}function Fi(e,t){return`${e.map(Pi).join(` + `)} -> ${t.map(Pi).join(` + `)}`}function Ii(e){return e.toLowerCase().replace(/[^a-z0-9]/g,``)}function Li(e,t){let n=ar(e),r=ar(t);return{balanced:rr(n,r),reactants:n,products:r}}function Ri({model:e,perProductFormulaJPerMol:t,productCoefficient:n,productAtomCounts:r,notes:i}){let a=Tn(r),o=t*n;return{model:e,status:oi,provisional:!0,reactionEnthalpyJPerBalancedEquation:o,specificEnthalpyJPerKgProduct:o/(n*a),validation:ai,notes:i}}function zi({familyId:e,familyLabel:t,reactants:n,products:r,productFormula:i,productAtomCounts:a,energetics:o,limitations:s,sedenionScope:c=null}){let l=Li(n,r);return{familyId:e,familyLabel:t,reactants:n,products:r,equation:Fi(n,r),productFormula:i,productKey:Ii(i),productAtomCounts:a,atomBalance:l,energetics:o,sedenionScope:c,validation:ai,scientificValidation:!1,limitations:s}}function Bi(e,t){return t===1?`${e}OH`:`${e}(OH)${t}`}function Vi(e,t){return{[e]:1,[Q]:t,[Z]:t}}function Hi(e,t){let n=ki(e);if(!n)return null;let r=Ni(n.Z);if(!r)return null;let i=ji(n.Z);if(!i)return null;let a=Oi(n.count,i%2==0?1:2),o=a/n.count,s=i*a,c=i*a/2,l=Bi(n.symbol,i),u=Vi(n.Z,i);return zi({familyId:si,familyLabel:`active metal + water -> metal hydroxide + hydrogen`,reactants:[$(o,e),$(s,t)],products:[$(a,l,u),$(c,`H2`,{[Z]:2})],productFormula:l,productAtomCounts:u,energetics:Ri({model:`heuristic-active-metal-water-stoichiometry-v0`,perProductFormulaJPerMol:-16e4*Math.max(1,i),productCoefficient:a,productAtomCounts:u,notes:[`Stoichiometry is charge-balanced by common cation charge and exact atom conservation.`,`Heat release is a provisional heuristic for ranking/contact gating only; it is not validated thermochemistry.`,`Room-temperature water reactivity class: ${r}.`]}),sedenionScope:ii(e,t,{familyId:si,leftRole:`cation`,rightRole:`compound`,preferredBondType:`ionic`}),limitations:[`Common ion charge is a first-pass heuristic; oxidation state selection is not yet solved from electronic structure.`,`Activation barriers and aqueous solvation are not derived in this layer.`,`The zero-barrier water family is restricted to metals with a conservative room-temperature water-reactivity class.`]})}function Ui(e,t,n,r){let i=C(e),a=C(n),o=e=>e===1?``:String(e);return`${i}${o(t)}${a}${o(r)}`}function Wi(e,t){let n=ki(e),r=ki(t);if(!n||!r||n.Z===r.Z)return null;let i=ji(n.Z),a=Mi(r.Z);if(!i||!a)return null;let o=Di(i,a),s=a/o,c=i/o,l=Oi(n.count/Di(s,n.count),r.count/Di(c,r.count)),u=s*l/n.count,d=c*l/r.count,f=Ui(n.Z,s,r.Z,c),p={[n.Z]:s,[r.Z]:c},m=[$(u,e),$(d,t)],h=[$(l,f,p)],g=ii(e,t,{familyId:ci,leftRole:`cation`,rightRole:`anion`,preferredBondType:`ionic`});return zi({familyId:ci,familyLabel:`metal + elemental nonmetal -> charge-balanced binary compound`,reactants:m,products:h,productFormula:f,productAtomCounts:p,energetics:Ri({model:`heuristic-binary-ionic-lattice-stoichiometry-v0`,perProductFormulaJPerMol:-18e4*Math.sqrt(i*a),productCoefficient:l,productAtomCounts:p,notes:[`Candidate formula is generated from common ion charges and exact atom conservation.`,`Energetics are provisional ionic-strength heuristics; lattice, molecular, and phase effects are not validated.`]}),sedenionScope:g,limitations:[`Only elemental nonmetal reactants are handled in this first binary-ionic pass.`,`Multiple oxidation states, kinetics, and competing products are not ranked by validated chemistry.`]})}function Gi(e,t){let n=ki(e),r=ki(t);if(!n||!r||n.Z===r.Z||n.Z===Z&&r.Z===Q||n.Z===Q&&r.Z===Z||ji(n.Z)!=null||ji(r.Z)!=null)return null;let i=yi.get(n.Z),a=yi.get(r.Z);if(!(i>0)||!(a>0))return null;let o=a-i;if(!(o>=.35)||n.Z===7&&o<.85||r.Z===7&&o<.65)return null;let s=bi.get(n.Z),c=xi.get(r.Z);if(!s||!c)return null;let l=n.Z===Z&&(r.Z===6||r.Z===7||r.Z===14||r.Z===15||r.Z===16),u=Di(s,c),d=c/u,f=s/u,p=Oi(n.count/Di(d,n.count),r.count/Di(f,r.count)),m=d*p/n.count,h=f*p/r.count,g=l?Ui(r.Z,f,n.Z,d):Ui(n.Z,d,r.Z,f),_={[n.Z]:d,[r.Z]:f},v=[$(m,e),$(h,t)],y=[$(p,g,_)],b=ii(e,t,{familyId:li,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`covalent`});return zi({familyId:li,familyLabel:`nonmetal + nonmetal -> valence-balanced covalent binary compound`,reactants:v,products:y,productFormula:g,productAtomCounts:_,energetics:Ri({model:`heuristic-binary-covalent-electronegativity-v0`,perProductFormulaJPerMol:o*o*-96e3*Math.max(1,s*d),productCoefficient:p,productAtomCounts:_,notes:[`Stoichiometry is valence-balanced from periodic-table covalent octet counts and exact atom conservation.`,`Energetics are provisional Pauling polar-bond heuristics until superseded by electronic-structure or reference thermochemistry.`]}),sedenionScope:b,limitations:[`Selects the primary covalent oxidation state; multi-oxide/kinetics competition is not yet solved from electronic structure.`]})}function Ki(e){if(e.elementCount!==2||(e.atomCounts[Z]||0)!==1)return null;let t=e.elements.find(e=>e.Z!==Z);return!t||t.count!==1||!_i.has(t.Z)?null:{halogenZ:t.Z,halogenSymbol:t.symbol,protons:1}}function qi(e){return e.elementCount===3&&e.atomCounts[Z]===2&&e.atomCounts[gi]===1&&e.atomCounts[Q]===4?{anionFormula:`SO4`,anionCharge:2,anionCounts:{[gi]:1,[Q]:4},protons:2}:null}function Ji(e){if(e.elementCount!==3)return null;let t=e.atomCounts[Z]||0,n=e.atomCounts[Q]||0;if(!(t>=1)||t!==n)return null;let r=e.elements.find(e=>e.Z!==Z&&e.Z!==Q);if(!r||r.count!==1)return null;let i=ji(r.Z);return!i||i!==t?null:{metalZ:r.Z,metalSymbol:r.symbol,charge:i}}function Yi(e){return rr(e.atomCounts,{[hi]:1,[Z]:3})}function Xi(e){let t=ki(e);return!!(t&&t.Z===Q&&t.count===2)}function Zi(e){let t=ki(e);return!!(t&&t.Z===Z&&t.count===2)}function Qi(e){if(e.elementCount!==2)return null;let t=e.atomCounts[Q]||0;if(!(t>=1))return null;let n=e.elements.find(e=>e.Z!==Q);return!n||ji(n.Z)==null?null:{metalZ:n.Z,metalSymbol:n.symbol,metalCount:n.count,oxygenCount:t}}function $i(e,t){let n=Ki(e),r=n?null:qi(e);if(!n&&!r)return null;if(n&&Yi(t)){let r=`NH4${n.halogenSymbol}`,i={[hi]:1,[Z]:4,[n.halogenZ]:1};return zi({familyId:ui,familyLabel:`Brønsted acid + ammonia -> ammonium halide salt`,reactants:[$(1,e),$(1,t)],products:[$(1,r,i)],productFormula:r,productAtomCounts:i,energetics:Ri({model:`heuristic-acid-base-neutralization-v0`,perProductFormulaJPerMol:-176e3,productCoefficient:1,productAtomCounts:i,notes:[`Stoichiometry conserves protons and heavy atoms for Brønsted proton transfer.`,`Heat release is a provisional heuristic estimate; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:ui,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`ionic`}),limitations:[`Provisional acid-base proton transfer energetics; solvation and gas-solid sublimation equilibria are not validated.`]})}let i=Ji(t);if(!i)return null;if(n){let r=i.charge,a=Ui(i.metalZ,1,n.halogenZ,r),o={[i.metalZ]:1,[n.halogenZ]:r};return zi({familyId:ui,familyLabel:`acid + metal hydroxide -> ionic salt + water neutralization`,reactants:[$(r,e),$(1,t)],products:[$(1,a,o),$(r,`H2O`,{[Z]:2,[Q]:1})],productFormula:a,productAtomCounts:o,energetics:Ri({model:`heuristic-acid-base-neutralization-v0`,perProductFormulaJPerMol:-57300*r,productCoefficient:1,productAtomCounts:o,notes:[`Exact charge and proton-hydroxide stoichiometric neutralization.`,`Neutralization enthalpy is a provisional heuristic (-57.3 kJ/mol per H2O); not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:ui,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`ionic`}),limitations:[`Provisional neutralization energetics; aqueous ionic strength and precipitation kinetics are not validated.`]})}let a=Di(i.charge,2),o=2/a,s=i.charge/a,c=i.charge*o,l=s,u=o,d=`${o===1?i.metalSymbol:`${i.metalSymbol}${o}`}${s===1?`SO4`:`(SO4)${s}`}`,f={[i.metalZ]:o,[gi]:s,[Q]:4*s};return zi({familyId:ui,familyLabel:`sulfuric acid + metal hydroxide -> sulfate salt + water neutralization`,reactants:[$(l,e),$(u,t)],products:[$(1,d,f),$(c,`H2O`,{[Z]:2,[Q]:1})],productFormula:d,productAtomCounts:f,energetics:Ri({model:`heuristic-acid-base-neutralization-v0`,perProductFormulaJPerMol:-57300*c,productCoefficient:1,productAtomCounts:f,notes:[`Exact stoichiometric proton-hydroxide neutralization.`,`Neutralization enthalpy is a provisional heuristic; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:ui,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`ionic`}),limitations:[`Provisional neutralization energetics; bisulfate intermediate equilibria are not modeled.`]})}function ea(e,t){if(!Xi(t)||e.elementCount<2)return null;let n=e.atomCounts[mi]||0,r=e.atomCounts[Z]||0,i=e.atomCounts[Q]||0;if(!(n>=1)||!Object.keys(e.atomCounts).every(e=>{let t=Number(e);return t===mi||t===Z||t===Q})||!(2*n+.5*r-i>1e-6))return null;let a=Math.round(4*n+r-2*i);if(a<=0)return null;let o=4/Di(a,4),s=o,c=a*o/4,l=n*o,u=r*o/2;if(!Number.isInteger(c)||!Number.isInteger(u))return null;let d=Di(Di(s,c),u>0?Di(l,u):l),f=s/d,p=c/d,m=l/d,h=u/d,g={[mi]:1,[Q]:2},_={[Z]:2,[Q]:1},v=[$(f,e),$(p,t)],y=[$(m,`CO2`,g)];return h>0&&y.push($(h,`H2O`,_)),zi({familyId:di,familyLabel:`carbonaceous fuel + O2 -> CO2 (+ H2O) complete combustion`,reactants:v,products:y,productFormula:`CO2`,productAtomCounts:g,energetics:Ri({model:`heuristic-oxy-combustion-bond-stoichiometry-v0`,perProductFormulaJPerMol:-418e3*p/Math.max(1,m),productCoefficient:m,productAtomCounts:g,notes:[`Complete combustion stoichiometry strictly conserves C, H, and O.`,`Heat release follows provisional Thornton O2-consumption heuristic; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:di,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`covalent`}),limitations:[`Complete oxidation product limit; radical chain kinetics and partial oxidation (CO/soot) are not resolved here.`]})}function ta(e,t){let n=Qi(t);if(!n)return null;if(Zi(e)){if((vi.get(n.metalZ)??50)>55)return null;let r=n.oxygenCount,i=n.metalCount,a=n.oxygenCount,o=Di(Di(1,r),Di(i,a));return zi({familyId:fi,familyLabel:`hydrogen reduction of metal oxide -> metal + water`,reactants:[$(r/o,e),$(1/o,t)],products:[$(i/o,n.metalSymbol,{[n.metalZ]:1}),$(a/o,`H2O`,{[Z]:2,[Q]:1})],productFormula:n.metalSymbol,productAtomCounts:{[n.metalZ]:1},energetics:Ri({model:`heuristic-redox-displacement-v0`,perProductFormulaJPerMol:-85e3*(n.oxygenCount/Math.max(1,n.metalCount)),productCoefficient:i/o,productAtomCounts:{[n.metalZ]:1},notes:[`Exact oxygen-transfer redox stoichiometry.`,`Energetics are provisional activity-series heuristics; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:fi,leftRole:`donor`,rightRole:`acceptor`,preferredBondType:`ionic`}),limitations:[`Provisional redox displacement ranking; high-temperature Ellingham equilibria are not validated.`]})}let r=ki(e);if(!r||r.Z===n.metalZ)return null;let i=ji(r.Z);if(!i)return null;let a=vi.get(r.Z),o=vi.get(n.metalZ);if(a==null||o==null||a<=o+8)return null;let s=Di(i,2),c=2/s,l=i/s,u=Ui(r.Z,c,Q,l),d={[r.Z]:c,[Q]:l},f=Oi(n.oxygenCount,l),p=f/n.oxygenCount,m=f/l,h=m*c,g=r.count/Di(h,r.count),_=h*g/r.count,v=p*g,y=m*g,b=v*n.metalCount,x=Di(Di(_,v),Di(y,b));return zi({familyId:fi,familyLabel:`active metal + metal oxide -> oxide redox displacement (thermite)`,reactants:[$(_/x,e),$(v/x,t)],products:[$(y/x,u,d),$(b/x,n.metalSymbol,{[n.metalZ]:1})],productFormula:u,productAtomCounts:d,energetics:Ri({model:`heuristic-redox-displacement-v0`,perProductFormulaJPerMol:-22e3*(a-o)*l,productCoefficient:y/x,productAtomCounts:d,notes:[`Exact charge-balanced thermite/redox displacement stoichiometry.`,`Energetics are provisional electrochemical activity heuristics; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:fi,leftRole:`cation`,rightRole:`compound`,preferredBondType:`ionic`}),limitations:[`Provisional redox ranking; ignition activation temperature and molten phase dynamics require kinetic modeling.`]})}function na(e,t){let n=ki(e),r=Ki(t);if(!n||!r)return null;let i=ji(n.Z);if(!i)return null;let a=vi.get(n.Z),o=vi.get(Z)??35;if(a==null||a<=o)return null;let s=Oi(n.count,i%2==0?1:2),c=s/n.count,l=i*s,u=i*s/2,d=Ui(n.Z,1,r.halogenZ,i),f={[n.Z]:1,[r.halogenZ]:i};return zi({familyId:pi,familyLabel:`active metal + hydrohalic acid -> metal halide + hydrogen`,reactants:[$(c,e),$(l,t)],products:[$(s,d,f),$(u,`H2`,{[Z]:2})],productFormula:d,productAtomCounts:f,energetics:Ri({model:`heuristic-metal-acid-displacement-v0`,perProductFormulaJPerMol:-155e3*i,productCoefficient:s,productAtomCounts:f,notes:[`Exact charge-balanced single-displacement stoichiometry.`,`Heat release is a provisional heuristic; not validated thermochemistry.`]}),sedenionScope:ii(e,t,{familyId:pi,leftRole:`cation`,rightRole:`compound`,preferredBondType:`ionic`}),limitations:[`Provisional metal-acid displacement energetics; passivation oxide films and aqueous pH kinetics are not modeled.`]})}function ra(e){let t=e?.sedenionScope?.reactiveClass;return t===`reactive`?0:t===`inert`?2:1}function ia(e){let t=new Set;return e.filter(e=>{let n=`${e.familyId}:${e.equation}`;return t.has(n)?!1:(t.add(n),!0)}).map((e,t)=>({item:e,idx:t,rank:ra(e)})).sort((e,t)=>e.rank-t.rank||e.idx-t.idx).map(e=>e.item)}function aa(e,t,n={}){let r=tr(e),i=tr(t),a=[],o=ii(r,i,{familyId:`formula-pair-symbolic-prefilter`});if(rr(r.atomCounts,i.atomCounts))return{inputs:{left:r,right:i},candidates:a,note:`same formula on both sides: no reaction candidate emitted`,sedenionScope:o,validation:ai,scientificValidation:!1};for(let[e,t]of[[r,i],[i,r]]){if(Ai(t)){let r=Hi(e,t,n);r&&a.push(r)}let r=Wi(e,t,n);r&&a.push(r);let i=Gi(e,t,n);i&&a.push(i);let o=$i(e,t,n);o&&a.push(o);let s=ea(e,t,n);s&&a.push(s);let c=ta(e,t,n);c&&a.push(c);let l=na(e,t,n);l&&a.push(l)}return{inputs:{left:r,right:i},candidates:ia(a),note:a.length>0?`reaction candidates discovered from formula parsing and stoichiometric family rules`:`no supported reaction family matched these formulas`,sedenionScope:o,validation:ai,scientificValidation:!1}}var oa=`ulg.compound.recursive-pipeline-webgpu.v1`,sa=`ulg-recursive-compound-feedback-webgpu.v1`,ca=602214076e15,la=8.314462618,ua=1602176634e-28,da=1602176634e-28,fa=88541878128e-22,pa=529177210903e-22;function ma(e){let t=T(e),n=t.reduce((e,t)=>Math.max(e,t.n),0);if(n===1)return!0;let r=t.find(e=>e.n===n&&e.l===1)?.occupancy??0;return r>0&&(r>=n||n===2&&r>=1||n===3&&r>=2||n>=6&&r>=5)}function ha(e){if(!Array.isArray(e)||e.length!==2)return null;let t=[...e].sort((e,t)=>e.count-t.count);if(t[0].count!==1||t[1].count!==2)return null;let n=t[0],r=t[1],i=T(n.Z),a=i.reduce((e,t)=>Math.max(e,t.n),0),o=i.find(e=>e.n===a&&e.l===1)?.occupancy??0,s=i.find(e=>e.n===a&&e.l===0)?.occupancy??0,c=T(r.Z),l=c.reduce((e,t)=>Math.max(e,t.n),0),u=c.find(e=>e.n===l&&e.l===1)?.occupancy??0;return o===2&&s===2&&a>=3&&u===4&&va(r.Z)>va(n.Z)+.35?Object.freeze({center:n,ligand:r,maxNA:a,maxNX:l}):null}var ga=Object.freeze([{id:`rocksalt-B1`,spaceGroup:`Fm-3m (225)`,madelung:1.74756,coord:6,packing:.68,stoich:`AB`},{id:`cscl-B2`,spaceGroup:`Pm-3m (221)`,madelung:1.76267,coord:8,packing:.72,stoich:`AB`},{id:`zincblende-B3`,spaceGroup:`F-43m (216)`,madelung:1.63806,coord:4,packing:.56,stoich:`AB`},{id:`fluorite-C1`,spaceGroup:`Fm-3m (225)`,madelung:2.51939,coord:8,packing:.66,stoich:`AB2`},{id:`rutile-C4`,spaceGroup:`P4_2/mnm (136)`,madelung:2.408,coord:6,packing:.62,stoich:`AB2`},{id:`corundum-D51`,spaceGroup:`R-3c (167)`,madelung:4.1719,coord:6,packing:.65,stoich:`A2B3`},{id:`cristobalite-C9`,spaceGroup:`Fd-3m (227)`,madelung:2.201,coord:4,packing:.43,stoich:`AX2-covalent`}]);function _a(e){let t=T(e).reduce((e,t)=>Math.max(e,t.n),1),n=1+.55*(Math.max(1,E(e))-1)+(t>3?.8:0);return Math.max(.65,Math.min(4.8,t*t/n*.72))}function va(e){let t=T(e),n=t.reduce((e,t)=>Math.max(e,t.n),1);if(n===1)return e===1?2.2:3.2;let r=0,i=0,a=0;for(let e of t)e.n===n&&(e.l===0||e.l===1)?r+=e.occupancy:e.n===n-1?i+=e.occupancy:a+=e.occupancy;let o=.35*Math.max(0,r-1)+.85*i+1*a,s=Math.max(1,e-o),c=n<=3?n:3.4+.3*(n-3),l=Math.max(.55,Math.min(2.6,.385*c*c/s**.68));return Math.max(.7,Math.min(4,.359*(s/(l*l))+.744))}function ya(e){let t=or(e).elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count}));if(t.length===0)throw RangeError(`Cannot parse formula: ${e}`);let n=[];for(let e of t)for(let t=0;t<e.count&&n.length<12;t+=1)n.push({sym:e.sym,Z:e.Z,r:_a(e.Z)});if(n.length===1)return[{Z:n[0].Z,x:0,y:0,z:0}];if(n.length===2){let e=Math.max(1.4,(n[0].r+n[1].r)*.88);return[{Z:n[0].Z,x:-.5*e,y:0,z:0},{Z:n[1].Z,x:.5*e,y:0,z:0}]}let r=new Map;for(let e of n)r.set(e.Z,(r.get(e.Z)||0)+1);n.sort((e,t)=>{let n=+(e.Z===1),i=+(t.Z===1);if(n!==i)return n-i;let a=r.get(e.Z)||99,o=r.get(t.Z)||99;if(a!==o)return a-o;let s=va(e.Z),c=va(t.Z);return Math.abs(s-c)>.05?s-c:t.Z-e.Z});let i=n[0],a=n.slice(1),o=[[.8165,.5774,0],[-.8165,.5774,0],[0,-.5774,.8165],[0,-.5774,-.8165],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[.577,.577,.577]],s=E(i.Z),c=a.length===2&&(s===4||s===2),l=[{Z:i.Z,x:0,y:0,z:0}];for(let e=0;e<a.length;e+=1){let t=a[e],n=Math.max(1.75,(i.r+t.r)*1.15),r=o[e%o.length];c&&(r=e===0?[1,0,0]:[-1,0,0]),l.push({Z:t.Z,x:r[0]*n,y:r[1]*n,z:r[2]*n})}return l}function ba(e,{crystalStructure:t=`rocksalt-B1`,latticeConstantA:n=5.2,cellsPerSide:r=2,paulingIonicity:i=.65}={}){let a=or(e),o=a.elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count,en:va(e.Z),rA:Math.max(.45,Math.min(2.3,_a(e.Z)*.529177))}));if(o.length===0)throw RangeError(`Cannot build crystal for formula: ${e}`);let s=[...o].sort((e,t)=>e.en-t.en||t.Z-e.Z),c=s[0],l=s[s.length-1],u=s.length,d=s.map((e,t)=>u===1?0:t===0?Number((i*(s.length===2?Math.max(1,l.count/c.count):1)).toFixed(2)):t===u-1?Number((-i*Math.max(1,c.count/l.count)).toFixed(2)):0),f,p=`Fm-3m (225)`,m=1,h=String(t||`rocksalt-B1`).toLowerCase();if(h.includes(`rocksalt`)||h.includes(`b1`))p=`Fm-3m (225)`,f=[[0,0,0,0],[.5,.5,0,0],[.5,0,.5,0],[0,.5,.5,0],[.5,0,0,1],[0,.5,0,1],[0,0,.5,1],[.5,.5,.5,1]];else if(h.includes(`cscl`)||h.includes(`b2`))p=`Pm-3m (221)`,f=[[0,0,0,0],[.5,.5,.5,1]];else if(h.includes(`zincblende`)||h.includes(`b3`))p=`F-43m (216)`,f=[[0,0,0,0],[.5,.5,0,0],[.5,0,.5,0],[0,.5,.5,0],[.25,.25,.25,1],[.75,.75,.25,1],[.75,.25,.75,1],[.25,.75,.75,1]];else if(h.includes(`fluorite`)||h.includes(`c1`))p=`Fm-3m (225)`,f=[[0,0,0,0],[.5,.5,0,0],[.5,0,.5,0],[0,.5,.5,0],[.25,.25,.25,1],[.75,.25,.25,1],[.25,.75,.25,1],[.25,.25,.75,1],[.75,.75,.25,1],[.75,.25,.75,1],[.25,.75,.75,1],[.75,.75,.75,1]];else if(h.includes(`rutile`)||h.includes(`c4`))p=`P4_2/mnm (136)`,m=.65,f=[[0,0,0,0],[.5,.5,.5,0],[.305,.305,0,1],[.695,.695,0,1],[.805,.195,.5,1],[.195,.805,.5,1]];else if(h.includes(`corundum`)||h.includes(`d51`))p=`R-3c (167)`,m=1.35,f=[[.16,.16,.15,0],[.66,.66,.35,0],[.16,.66,.65,0],[.66,.16,.85,0],[0,.42,.25,1],[.42,0,.25,1],[.5,.5,.08,1],[0,.92,.75,1],[.92,0,.75,1],[.5,.5,.58,1]];else if(h.includes(`cristobalite`)||h.includes(`c9`))p=`Fd-3m (227)`,f=[[0,0,0,0],[.5,.5,0,0],[.5,0,.5,0],[0,.5,.5,0],[.25,.25,.25,0],[.75,.75,.25,0],[.75,.25,.75,0],[.25,.75,.75,0],[.125,.125,.125,1],[.875,.875,.125,1],[.875,.125,.875,1],[.125,.875,.875,1],[.625,.625,.125,1],[.375,.375,.125,1],[.375,.625,.875,1],[.625,.375,.875,1],[.625,.125,.625,1],[.375,.875,.625,1],[.375,.125,.375,1],[.625,.875,.375,1],[.125,.625,.625,1],[.875,.375,.625,1],[.875,.625,.375,1],[.125,.375,.375,1]];else{p=h.includes(`alloy`)?`Fm-3m (225)`:`P1 (molecular crystal)`;let t=ya(e),r=[[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]],i=.529177/Math.max(2.5,n);f=[];for(let e of r)if(h.includes(`alloy`)){let t=f.length%s.length;f.push([e[0],e[1],e[2],t])}else for(let n of t){let t=Math.max(0,s.findIndex(e=>e.Z===n.Z));f.push([e[0]+n.x*i*.72,e[1]+n.y*i*.72,e[2]+n.z*i*.72,t])}}let g=Math.max(2.6,Number(n)||5.2),_=g*m,v=Math.max(1,Math.min(3,Math.trunc(r))),y=v,b=v,x=v*g,S=y*g,C=b*_,w=[];for(let e=0;e<v;e+=1)for(let t=0;t<y;t+=1)for(let n=0;n<b;n+=1)for(let[r,i,a,o]of f){let c=o===1?s.length-1:Math.min(s.length-1,o),l=s[c],u=(e+r+10)%v*g,f=(t+i+10)%y*g,p=(n+a+10)%b*_;w.push({x:u,y:f,z:p,Z:l.Z,charge:d[c]??0,rA:l.rA,spIdx:c})}let T=w.length,E=new Float32Array(T*4),D=new Float32Array(T*4);for(let e=0;e<T;e+=1){let t=w[e];E[e*4+0]=t.x,E[e*4+1]=t.y,E[e*4+2]=t.z,E[e*4+3]=t.rA,D[e*4+0]=t.Z,D[e*4+1]=t.charge,D[e*4+2]=t.rA,D[e*4+3]=t.spIdx}let O=[],k=g*(h.includes(`cristobalite`)||h.includes(`c9`)?.28:h.includes(`cscl`)||h.includes(`b2`)?.94:h.includes(`rocksalt`)||h.includes(`b1`)?.58:h.includes(`zincblende`)||h.includes(`b3`)||h.includes(`fluorite`)||h.includes(`c1`)?.52:.78);for(let e=0;e<T;e+=1)for(let t=e+1;t<T;t+=1){if(s.length>=2&&!h.includes(`alloy`)&&w[e].spIdx===w[t].spIdx)continue;let n=Math.hypot(w[e].x-w[t].x,w[e].y-w[t].y,w[e].z-w[t].z);n>.55&&n<=k&&O.push(e,t)}let A=s.map((e,t)=>Object.freeze({Z:e.Z,symbol:e.sym,formalCharge:d[t]??0,radiusA:e.rA,count:w.filter(e=>e.spIdx===t).length}));return Object.freeze({formula:a.canonicalFormula,prototype:t,spaceGroup:p,latticeConstantA:g,boxLengthsA:Object.freeze([x,S,C]),atomCount:T,positions:E,speciesMeta:D,bonds:new Uint32Array(O),bondCount:O.length/2,speciesLegend:Object.freeze(A)})}async function xa(t,n,{temperatureK:i=300,runLiveMd:a=!0,mdSteps:o=12,mdCellsPerSide:s=3,reactionContext:c=null}={}){let l=String(n||``).trim(),u=or(l),d=u.elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count})),f=u.sites,p=Object.fromEntries(d.map(e=>[e.sym,e.count]));if(d.length===0)throw RangeError(`Invalid compound formula: ${n}`);let m=0,g=0,_=0,v=0,y=0,b=0,x=!0,S=1/0,C=-1/0,w=0;for(let e of f){let t=k(e.Z,e.A);m+=e.Z*e.count,g+=t.A*e.count,_+=t.bindingEnergyMeV*e.count,v+=e.atomicMassU*e.count,y+=(h[e.Z-1]||t.atomicMassU)*e.count,b=Math.max(b,t.chargeRadiusFm),w+=e.count,ma(e.Z)||(x=!1);let n=va(e.Z);n<S&&(S=n),n>C&&(C=n)}let D=v/Math.max(1e-6,y),A=0,j=0;for(let e of f)e.Z===1&&(A+=e.atomicMassU*e.count,j+=e.count);let M=j>0?A/j:h[0],N=Math.max(0,C-S),P=1-Math.exp(-.25*N*N),F=ha(d),I=!!F,L=!I&&!x&&P>=.3,ee=!I&&!x&&!L,te=v*.001,ne=te/ca,R=null,re=w<=10&&m%2==0;if(t&&typeof t.createBuffer==`function`&&re){let e=ya(l);try{R=await O(t,e,{maxScf:25,volDim:20,basisName:`auto`})}catch{R=null}}let ie=`molecular-fcc`,z=`P1 (molecular)`,ae=4.5,B=1e3,oe=22e8,se=0,V=.45,ce=Number.isFinite(R?.homoEnergyHa)&&R.homoEnergyHa<-.05?-R.homoEnergyHa*27.211386245988:null,le=ce==null?R?Math.max(1.2,Math.min(13.5,R.homoLumoGapEv*.45)):5.5:Math.max(1.5,Math.min(13.5,ce*.74)),H=ee,U=273,W=373,ue=260,de=e=>{let t=T(e),n=t.reduce((e,t)=>Math.max(e,t.n),1);if(n===1)return e===1?.37:.32;let r=0,i=0,a=0;for(let e of t)e.n===n&&(e.l===0||e.l===1)?r+=e.occupancy:e.n===n-1?i+=e.occupancy:a+=e.occupancy;let o=Math.max(1,e-(.35*Math.max(0,r-1)+.85*i+a)),s=n<=3?n:3.4+.3*(n-3);return Math.max(.55,Math.min(2.4,.385*s*s/o**.68))},fe=(e,t)=>{let n=T(e).reduce((e,t)=>Math.max(e,t.n),1);if(t>0){let e=Math.max(1,n-1),r=e<=3?e:3.4+.25*(e-3),i=.275*r*r+.22;return Math.max(.45,Math.min(1.85,i/Math.max(1,t)**.36))}return Math.max(1.25,Math.min(2.25,de(e)+.72+.08*Math.abs(t)))};if(I){let{center:e,ligand:t}=F,n=Math.max(135e-12,(_a(e.Z)+_a(t.Z))*pa*.62),r=8*n/Math.sqrt(3),i=Math.max(2e-29,r**3/8);ie=`cristobalite-C9`,z=`Fd-3m (227)`,ae=r*1e10,B=Math.max(1200,Math.min(9e3,ne/i));let a=Math.max(2.2,Math.min(5.8,32e-11/n*(1.28+.52*N)));V=Math.max(5.5,Math.min(20,2.55*a)),oe=Math.max(18e9,Math.min(12e10,V*ua*.16/i)),se=.72*oe,le=Math.max(4.5,Math.min(10.5,4.2+2.6*N)),H=!1,ue=Math.max(260,Math.min(950,128*Math.sqrt(oe*1e-9/Math.max(.5,B*.001)))),U=Math.max(1150,Math.min(2600,155*V+260)),W=Math.max(U*1.35,U+750)}else if(L){let e=[...d].sort((e,t)=>va(e.Z)-va(t.Z)),t=e[0],n=e[e.length-1],r=d.map(e=>e.count).sort((e,t)=>e-t),i=r.length>=2&&r[0]===1&&r[1]===2?`AB2`:r.length>=2&&r[0]===2&&r[1]===3?`A2B3`:`AB`,a=Math.max(1,Math.min(3,8-E(n.Z))),o=Math.max(1,Math.min(4,Math.round(a*n.count/Math.max(1,t.count)))),s=Math.max(1,Math.min(6,o*a)),c=fe(t.Z,o),l=fe(n.Z,-a),u=c/Math.max(.5,l),f=Math.max(175e-12,(c+l)*1e-10),p=ga.filter(e=>!(e.stoich!==i||e.id===`cscl-B2`&&u<.732)),m=p[0]||ga[0],h=1/0;for(let e of p.length?p:ga){let t=-(e.madelung*s*da*da/(4*Math.PI*fa*f))*(1-1/9);t<h&&(h=t,m=e)}ie=m.id,z=m.spaceGroup,V=Math.max(1.8,Math.min(14,Math.abs(h)/ua/Math.max(1,i===`A2B3`?2.5:1)));let g=i===`A2B3`&&o>=3?.58:1,_=Math.max(18e-30,d.reduce((e,n)=>{let r=(n.Z===t.Z?c:l)*1e-10;return e+4*Math.PI/3*r**3*n.count},0)*g/m.packing);B=Math.max(600,Math.min(24e3,ne/_)),ae=Math.cbrt(_*4)*1e10,oe=Math.max(8e9,8*Math.abs(h)/(9*_)),se=.44*oe,le=T(t.Z).find(e=>e.l===2&&e.occupancy>0&&e.occupancy<10)?Math.max(1.8,Math.min(4.2,1.55+1.15*P)):Math.max(2.5,Math.min(11.5,3.2+5.5*P)),H=!1,ue=Math.max(150,Math.min(950,120*Math.sqrt(oe*1e-9/(B*.001)))),U=Math.max(450,Math.min(3100,145*V+120)),W=Math.max(U*1.45,U+550)}else if(ee){ie=`fcc-alloy`,z=`Fm-3m (225)`;let e=d.reduce((e,t)=>e+4*Math.PI/3*(_a(t.Z)*pa*1.22)**3*t.count,0),t=d.reduce((e,t)=>e+Math.max(1,E(t.Z))*t.count,0)/Math.max(1,w),n=Math.cbrt(e/Math.max(1,w)*3/(4*Math.PI))/pa;B=Math.max(600,Math.min(24e3,ne/Math.max(1e-29,e))),ae=Math.cbrt(e/Math.max(1,w)*4)*1e10,V=Math.max(.6,Math.min(9.5,1.45*t/Math.max(1.4,n)*w*.65)),oe=Math.max(5e9,1.9*V*ua/Math.max(1e-29,e)),se=.44*oe,le=0,H=!0,ue=Math.max(60,Math.min(1200,118*Math.sqrt(oe*1e-9/(B*.001)))),U=Math.max(250,Math.min(3600,360*V/Math.max(1,w)+120)),W=Math.max(U*1.5,U+600)}else{let e=R?.dipoleDebye??(N>.3?1.4*N:0),t=!!p.H,n=!!(p.N||p.O||p.F),r=t&&n?.21*Math.min(p.H,2*((p.N||0)+(p.O||0)+(p.F||0))):0,a=r>0?r*.095*(1-Math.sqrt(h[0]/Math.max(.5,M))):0,o=.012*y**.72+.045*e*e;V=Math.max(.01,o+r+a);let s=d.reduce((e,t)=>{let n=t.Z===1?1.15:Math.min(2.3,de(t.Z)+.85);return e+4*Math.PI/3*n**3*t.count*(w>1?.52:1)},0),c=t&&n?.44:w===3&&!t?.68:.54,l=Math.max(16e-30,s*1e-30/c);B=Math.max(40,Math.min(4500,ne/l)),ae=Math.cbrt(l*4)*1e10,oe=Math.max(2e8,V*ua/l*1.8),U=Math.max(12,Math.min(600,460*V+12)),se=i<U?.35*oe:0,W=Math.max(U*1.18+5,V*ua*ca/(t&&n?132:94)),ue=Math.max(60,Math.min(450,U*.9/Math.sqrt(Math.max(.2,D))))}let G=Math.max(2,d.reduce((e,t)=>e+Math.max(1,E(t.Z))*t.count,0)),pe=B/Math.max(1e-27,ne),me=pe*G,he=3713e-17*Math.sqrt(Math.max(1e24,me)),K=1,ge=1/0;if(!H)if(L||I){let e=Math.max(2.854,Math.max(le+1.6,1.25*le)),t=1/Math.max(.25,1-(2.254/e)**2),n=1+(he/e)**2*(.34+.08*t);K=Math.max(1.15,Math.min(3.4,Math.sqrt(n))),ge=n+(I?1.15*P**2+.7:Math.max(1.2,5.4*P**1.6*(.65+.35*Math.min(2.5,G/8))))}else{let e=Math.max(12,le+10.5),t=Math.min(.65,.22*(he/e)**2),n=(1+2*t)/Math.max(.18,1-t);K=Math.max(1.02,Math.min(2.2,Math.sqrt(n)));let r=w===3&&!p.H&&d.some(e=>e.count===1&&E(e.Z)===4)||w===5&&p.H===4&&d.length===2,a=R?.dipoleDebye??(N>.3?1.4*N:0),o=r?0:a,s=!!p.H,c=!!(p.N||p.O||p.F),l=s&&c&&o>.8?2.65:1,u=o*333564e-35,f=Math.max(80,Math.min(450,Math.max(i,U*1.05))),m=n+pe*l*u*u/(9*fa*1380649e-29*f)*(n+2)**2;ge=Math.max(n,(m+Math.sqrt(m*m+8*n*n))/4)}let q=null;t&&typeof t.createBuffer==`function`&&(q=(await gr(t,[H?{mode:0,conductionElectronDensityPerM3:Math.max(1e27,B/Math.max(1e-27,ne)*w),interbandOscillators:[],pathLengthM:.2}:{mode:2,electronicGapEv:Math.max(.25,le),refractiveIndex:K,pathLengthM:.2}]))?.results?.[0]??null);let _e=Math.max(15,Math.min(i,.65*U)),ve=ne/Math.max(1,B)*1e30,ye=ie.startsWith(`cscl`)||ie===`bcc`?2:ie.startsWith(`zincblende`)||ie===`diamond`||ie.startsWith(`cristobalite`)?8:4,be=Math.max(2.6,Math.min(9.5,Math.cbrt(ve*ye))),xe=be*(ye===2?Math.sqrt(3)/2:ye===8?Math.sqrt(3)/4:1/Math.SQRT2),J=Object.freeze({crystalStructure:ie,latticeConstantA:be,massU:Math.max(2,v),potentialModel:I?vr.STILLINGER_WEBER:L?vr.MORSE_EAM:vr.LENNARD_JONES,modelName:I?`Stillinger-Weber (Tetrahedral Covalent Network)`:L?`Morse+EAM (Ionic Lattice)`:`Lennard-Jones (Molecular/Dispersion)`,epsilonEv:I?Math.max(.35,Math.min(2.6,V/5)):Math.max(.005,Math.min(1.5,V/8)),sigmaOrR0A:I?Math.max(1.5,xe/1.1225):L?Math.max(1.8,xe*1.08):Math.max(1.8,xe/2**(1/6)),alphaOrLambda:I?21:1.4,eamAEv:L?V*.2:0,eamBeta:1.4,swGamma:I?1.2:0,rcutA:I?Math.min(be*1.35,xe/1.1225*1.8):Math.max(4.5,be*1.25),dtFs:Math.min(2,Math.max(.5,.14*Math.sqrt(Math.max(2,v)))),defaultTemperatureK:_e}),Se=null;if(a&&t&&typeof t.createBuffer==`function`){let e=Tr(t,{...Or({crystalStructure:J.crystalStructure,cellsPerSide:s,latticeConstantA:J.latticeConstantA,massU:J.massU,temperatureK:_e}),potentialModel:J.potentialModel,epsilonEv:J.epsilonEv,sigmaOrR0A:J.sigmaOrR0A,alphaOrLambda:J.alphaOrLambda,eamAEv:J.eamAEv,eamBeta:J.eamBeta,swGamma:J.swGamma,rcutA:J.rcutA,dtFs:J.dtFs,targetTemperatureK:_e,thermostatCouplingFs:40});try{Se=await e.stepBatch(o,{readTelemetry:!0,temperatureK:_e})}finally{e.destroy()}}let Ce=Math.max(2e3,V*ua*ca*.92),we=la*1.4*U/te,Te=Ce/te,Ee=(e,t)=>{let n=Math.max(.001,Math.min(40,t/Math.max(1,e))),r=n/16,i=0;for(let e=0;e<16;e+=1){let t=(e+.5)*r,n=Math.exp(Math.min(60,t)),a=(n-1)*(n-1);a>1e-18&&Number.isFinite(a)&&(i+=t**4*n/a*r)}return Math.max(.01,Math.min(1,3/n**3*i))},De=(e,t)=>{let n=Math.min(50,Math.max(.001,t/Math.max(1,e))),r=Math.exp(n);return n*n*r/Math.max(1e-18,(r-1)*(r-1))},Oe;if(I||L||H||i<U*.96){let e=Ee(i,Math.max(80,ue*(I?1.42:L?1.24:1))),t=1+.045*Math.min(1.5,i/Math.max(250,U));Oe=3*w*la*e*t}else{let e=w===2||w===3&&!p.H&&d.some(e=>e.count===1&&E(e.Z)===4),t=w<=1?0:e?2:3,n=Math.max(0,3*w-3-t),r=!!p.H,a=r?4200:1950,o=r?1950:960,s=Math.min(n,Math.max(1,w-1)),c=Math.max(0,n-s),l=s*De(i,a)+c*De(i,o);if(i<W*1.04){let e=p.H&&(p.N||p.O||p.F)&&N>.5?6:3.2;Oe=((3+t)*.5+l+e)*la}else Oe=((3+t)*.5+l+1)*la}let ke=Oe/te,Ae=B*.92,je=1/Math.max(1,Ae)-1/Math.max(1,B),Y=Math.max(-40,Math.min(180,U*je/Math.max(1e3,we)*101325*Math.LN10)),Me=Math.max(8,Math.min(600,la*W*W*Math.LN10/Ce)),Ne=q?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||q?.spectralSamples?.[Math.floor((q?.spectralSamples?.length||1)/2)]||null,Pe=Array.isArray(q?.baseColorSrgb)&&q.baseColorSrgb.length===3?q.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):H?[.74,.76,.79]:[.85,.9,.96],Fe=Number.isFinite(Ne?.nRe)&&Ne.nRe>0?Ne.nRe:K,Ie=Number.isFinite(Ne?.reflectance)?Ne.reflectance:Number.isFinite(q?.reflectance)?q.reflectance:H?.72:.04,Le=H?Math.max(5e5,300/Math.max(50,i)*25e6*(ue/300)):Math.max(1e-16,1e-4*Math.exp(-le/(2*8617e-8*Math.max(100,i)))),Re=H?2.44300455e-8*Le*i:0,ze=L?1.5:2,Be=Math.cbrt(ne/Math.max(1,B)/Math.max(1,w))*1e10,Ve=Math.max(.04,Math.min(120,v/Math.max(1,w)*31e-9*Be*ue**3/Math.max(1,ze*ze*i*w**(2/3)))),He=Math.min(1200,Re+Ve),Ue=r({materialKey:u.canonicalIsotopologue,formula:l,canonicalFormula:u.canonicalFormula,canonicalIsotopologue:u.canonicalIsotopologue,hasExplicitIsotopes:u.hasExplicitIsotopes,family:`compound`,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,generatorFingerprint:sa,nuclear:{totalProtonsZ:m,totalNucleonsA:g,molarMassU:v,isotopeMassRatio:D,totalBindingEnergyMeV:_,maxNuclearRadiusFm:b,stoichiometry:p,isotopologueSites:f},atomic:{molecularRhfSolvedOnGpu:!!R,basisUsed:R?.basisUsed??null,totalEnergyHa:R?.totalEnergyHa??null,homoLumoGapEv:R?.homoLumoGapEv??le,dipoleDebye:R?.dipoleDebye??0,dipoleVecDebye:R?.dipoleVecDebye??null,paulingIonicity:P,mullikenCharges:R?.mullikenCharges??null,bonds:R?.bonds??null},electromagnetic:{isMetal:H,bandGapEv:le,plasmaEnergyEv:H?Math.max(1.5,Number(q?.plasmaEnergyEv)||8):0,drudeDampingEv:H?.45:.08,interbandOscillators:[],electricalConductivitySPerM:Le,staticDielectricConstant:ge,magneticPhase:m%2==1?`paramagnetic`:`diamagnetic`,opticalSrgb:Pe,refractiveIndex550Nm:Fe,reflectance550Nm:Ie,spectralWavelengthsNm:q?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:q?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:q?.spectralSamples?.map(e=>e.nRe??Fe)??null,spectralAbsorptionPerM:q?.spectralSamples?.map(e=>e.absorptionPerM??0)??null},mechanical:{crystalStructure:ie,spaceGroup:z,latticeConstantA:ae,densityKgPerM3:B,cohesiveEnergyEv:V,bulkModulusPa:oe,shearModulusPa:se,debyeTemperatureK:ue},thermodynamic:{temperatureK:i,heatCapacityCvJPerKgK:ke*.92,heatCapacityCpJPerKgK:ke,meltingPointK:U,boilingPointK:W,latentHeatFusionJPerKg:we,latentHeatVaporizationJPerKg:Te,meltingSlopeKPerLogP:Y,boilingSlopeKPerLogP:Me,liquidDensityKgPerM3:Ae,dynamicViscosityLiquidPaS:Math.max(1e-4,4e-4*Math.exp(U/Math.max(i,U)*1.8)),surfaceTensionNPerM:Math.max(.005,.14*V*ua/(ne/Ae)**(2/3)),thermalConductivityWPerMK:He,mdTempK:Se?.temperatureK??null,mdEnergyEv:Se?.totalEnergyEv??null,mdPressureGPa:Se?.pressureGPa??null},provenance:{status:R||Se||q?`webgpu-derived`:`reduced-estimate`,gpuStagesExecuted:{molecularRhf:!!R,opticalSpectrum:!!q,molecularDynamics:!!Se},scientificValidation:!1,extrapolationPolicy:`fail-closed`,reactionContext:c}}),We=ba(l,{crystalStructure:ie,latticeConstantA:J.latticeConstantA,cellsPerSide:2,paulingIonicity:P});return Object.freeze({schema:oa,bundle:Ue,visualData:Object.freeze({molQm:R,optics:q,mdTelemetry:Se,mdConfig:J,multiSpeciesCrystal:We})})}function Sa(e,t){let n,r;try{n=or(e),r=or(t)}catch{return null}if(n.elements.length!==1||r.elements.length!==1)return null;let i=n.elements[0].Z===1?{f:e,d:n}:r.elements[0].Z===1?{f:t,d:r}:null,a=n.elements[0].Z===8?{f:e,d:n}:r.elements[0].Z===8?{f:t,d:r}:null;if(!i||!a)return null;let o=i.d.sites[0],s=o.A===2?`D`:o.A===3?`T`:`H`,c=i.d.elements[0].count,l=a.d.elements[0].count,u=`${s}2O`,d=c===1&&l===1?1:2,f=2*d/c,p=d/l,m=(e,t)=>e===1?t:`${e} ${t}`;return Object.freeze({familyId:`hydrogen-oxygen-synthesis`,familyLabel:`hydrogen + oxygen -> water synthesis`,equation:`${m(f,i.f)} + ${m(p,a.f)} -> ${m(d,u)}`,reactants:[{coefficient:f,formula:i.f,atomCounts:{1:c}},{coefficient:p,formula:a.f,atomCounts:{8:l}}],products:[{coefficient:d,formula:u,atomCounts:{1:2,8:1}}],productFormula:u,atomBalance:{balanced:!0,reactants:{1:2*d,8:d},products:{1:2*d,8:d}},energetics:{model:`provisional-hydrogen-oxygen-combustion-v0`,provisional:!0,reactionEnthalpyJPerBalancedEquation:-241800*d},sedenionScope:{reactiveClass:`reactive`},scientificValidation:!1})}async function Ca(e,t,n={}){let r=Array.isArray(t)?t:[t],i=[];for(let e=0;e<r.length;e+=1)for(let t=e+1;t<r.length;t+=1){let a=aa(r[e],r[t],n.discoveryOptions||{});if(Array.isArray(a?.candidates)&&a.candidates.length>0)i.push(...a.candidates);else{let n=Sa(r[e],r[t]);n&&i.push(n)}}let a=[],o=new Set;for(let e of i)for(let t of e.products||[]){let e=String(t.formula||t.material||``).trim();e&&!o.has(e)&&(o.add(e),a.push(e))}let s=[];for(let t of a){let i=await xa(e,t,{runLiveMd:n.runLiveMd!==!1,mdSteps:n.mdSteps??10,mdCellsPerSide:n.mdCellsPerSide??2,reactionContext:{source:`discoverAndDeriveReactionProductsWebGpu`,reactants:r}});s.push(i)}return Object.freeze({schema:`ulg.reaction-feedback-pipeline-webgpu.v1`,reactants:Object.freeze([...r]),candidateCount:i.length,candidates:Object.freeze(i),productFormulas:Object.freeze(a),derivedProducts:Object.freeze(s)})}export{de as $,Un as A,ut as B,dn as C,Tn as D,Wn as E,xt as F,G,Je as H,Lt as I,K as J,we as K,mt as L,qt as M,Jt as N,kn as O,Xt as P,H as Q,ht as R,qn as S,Vn as T,Xe as U,Ze as V,me as W,Te as X,Ee as Y,Se as Z,gr as _,oi as a,ln as b,aa as c,yr as d,le as et,vr as f,Dr as g,Tr as h,Ca as i,Qt as j,fn as k,Ni as l,Er as m,ba as n,Mi as o,Or as p,Ce as q,xa as r,ji as s,ya as t,ce as tt,jr as u,tr as v,Gn as w,Kn as x,or as y,dt as z};