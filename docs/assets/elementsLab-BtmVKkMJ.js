import{Fo as e,O as t,Qt as n,Zt as r,_ as i,a,c as o,d as s,f as c,h as l,i as u,jo as d,l as f,m as p,o as m,p as h,r as g,rn as _,t as v,tn as y,u as b,x,y as S}from"./molecularDynamicsWebGpu-D3Vza8Ty.js";import{t as C}from"./ClosureRegistry-D6kjFkSv.js";import{f as w,i as T,n as E,r as D,t as O}from"./recursiveCompoundPipeline-Cu6AF2hD.js";import{c as k,i as A}from"./nuclearCherenkovClosure-Dg0oiXUf.js";import{a as ee,c as te,d as ne,f as j,h as re,i as ie,l as ae,n as oe,o as se,p as ce,r as le,s as ue,t as de,u as fe}from"./simulationModuleRegistry-CBHe6Lbb.js";var pe=`ulg.chemistry.reaction-pathway-webgpu.v1`,me=27.211386245988,he=96485.33212,ge=8617333262e-14,_e=1380649e-29,ve=662607015e-42,ye=8.314462618;function be(e){if(!e.length)return[];let t=0,n=0,r=0;for(let i of e)t+=i.x,n+=i.y,r+=i.z;let i=1/e.length;return e.map(e=>({Z:e.Z,x:e.x-t*i,y:e.y-n*i,z:e.z-r*i}))}function xe(e){let t=.85;for(let n of e)t=Math.max(t,Math.hypot(n.x,n.y,n.z)+.9);return t}function Se(e,t=1){let n=[];for(let t of e){let e=Math.max(1,Math.round(Number(t.coefficient)||1)),r=be(O(t.formula));for(let i=0;i<e;i+=1)n.push({formula:t.formula,atoms:r,radius:xe(r)})}if(n.length===0)return[];if(n.length===1)return n[0].atoms.map(e=>({Z:e.Z,position:[e.x,e.y,e.z]}));let r=[];if(n.length===2){let e=.5*Math.max(2.6,(n[0].radius+n[1].radius)*.88*t);for(let t of n[0].atoms)r.push({Z:t.Z,position:[t.x-e,t.y,t.z]});for(let t of n[1].atoms)r.push({Z:t.Z,position:[-t.x+e,t.y,t.z]})}else{let e=n.reduce((e,t)=>e+t.radius,0)/n.length,i=Math.max(2.3,e*.92*t*(1+.18*(n.length-2)));for(let e=0;e<n.length;e+=1){let t=e/n.length*Math.PI*2,a=Math.cos(t)*i,o=Math.sin(t)*i,s=(e%2==0?1:-1)*.25;for(let t of n[e].atoms)r.push({Z:t.Z,position:[t.x+a,t.y+o,t.z+s]})}}let i=0,a=0,o=0;for(let e of r)i+=e.position[0],a+=e.position[1],o+=e.position[2];let s=1/r.length;return r.map(e=>({Z:e.Z,position:[e.position[0]-i*s,e.position[1]-a*s,e.position[2]-o*s]}))}function Ce(e){let t=0;for(let n of e){let e=Math.max(1,Math.round(Number(n.coefficient)||1)),r=w(n.formula).elements.reduce((e,t)=>e+t.count,0);t+=e*r}return t}function we(e,t){let n=Array(t.length).fill(!1),r=Array(e.length),i=new Set(e.map(e=>e.Z));for(let a of i){let i=[],o=[];if(e.forEach((e,t)=>{e.Z===a&&i.push(t)}),t.forEach((e,t)=>{e.Z===a&&o.push(t)}),i.length!==o.length)throw Error(`Atom conservation mismatch for Z=${a}: reactants=${i.length}, products=${o.length}`);let s=i.length;if(s<=6){let a=1/0,c=o.slice(),l=o.slice(),u=(n,r)=>{if(r>=a)return;if(n===s){a=r,c=l.slice();return}let o=e[i[n]].position;for(let e=n;e<s;e+=1){[l[n],l[e]]=[l[e],l[n]];let i=t[l[n]].position,a=(o[0]-i[0])**2+(o[1]-i[1])**2+(o[2]-i[2])**2;u(n+1,r+a),[l[n],l[e]]=[l[e],l[n]]}};u(0,0);for(let e=0;e<s;e+=1)r[i[e]]=t[c[e]],n[c[e]]=!0}else for(let a of i){let i=e[a].position,s=-1,c=1/0;for(let e of o){if(n[e])continue;let r=t[e].position,a=(i[0]-r[0])**2+(i[1]-r[1])**2+(i[2]-r[2])**2;a<c&&(c=a,s=e)}n[s]=!0,r[a]=t[s]}}return r}function Te(e,{maxAtoms:t=10}={}){if(!e?.reactants?.length||!e?.products?.length)throw TypeError(`buildReactionComplexGeometries requires a reaction candidate with reactants and products`);let n=e.reactants.map(e=>({coefficient:Number(e.coefficient)||1,formula:e.formula})),r=e.products.map(e=>({coefficient:Number(e.coefficient)||1,formula:e.formula})),i=Ce(n),a=!1;if(i>t&&[...n,...r].every(e=>e.coefficient%2==0)&&(n=n.map(e=>({...e,coefficient:e.coefficient/2})),r=r.map(e=>({...e,coefficient:e.coefficient/2})),i=Ce(n),a=!0),i>t)throw RangeError(`Reaction complex has ${i} atoms (> maxAtoms=${t}) for interactive GPU CI-NEB`);n.reduce((e,t)=>{let n=w(t.formula);return e+t.coefficient*n.elements.reduce((e,t)=>e+t.Z*t.count,0)},0)%2!=0&&i*2<=t&&(n=n.map(e=>({...e,coefficient:e.coefficient*2})),r=r.map(e=>({...e,coefficient:e.coefficient*2})),i*=2);let o=Se(n,1),s=we(o,Se(r,.96)),c=o.reduce((e,t)=>e+t.Z,0),l=s.reduce((e,t)=>e+t.Z,0);if(c!==l)throw Error(`Proton count mismatch across reaction: reactants=${c}, products=${l}`);return Object.freeze({equation:e.equation||`${n.map(e=>e.formula).join(` + `)} -> ${r.map(e=>e.formula).join(` + `)}`,scaledHalf:a,atomCount:o.length,totalElectrons:c,isClosedShell:c%2==0,reactantAtoms:Object.freeze(o),productAtoms:Object.freeze(s)})}function Ee(e,t,{deltaSJPerMolK:n=-35,tempsK:r=null}={}){let i=Math.max(.02,Number(e)||.5),a=(Number(t)||0)*he,o=Array.isArray(r)&&r.length>=2?r:Array.from({length:28},(e,t)=>200+t/27*1800),s=[],c=[],l=[],u=[];for(let e of o){let t=Math.max(50,Number(e)),r=_e*t/ve,o=Math.log(r)-i/(ge*t),d=a-t*n,f=-d/(ye*t);s.push(1e3/t),c.push(Math.max(-35,Math.min(20,o/Math.LN10))),l.push(d*.001),u.push(Math.max(-40,Math.min(40,f/Math.LN10)))}let d=(a-298.15*n)*.001,f=Math.max(-40,Math.min(40,-d*1e3/(ye*298.15*Math.LN10))),p=Math.abs(n)>.001?a/n:null;return Object.freeze({tempsK:Object.freeze(o),invT1000PerK:Object.freeze(s),log10KRate:Object.freeze(c),deltaGKjPerMol:Object.freeze(l),log10Keq:Object.freeze(u),deltaH298KjPerMol:a*.001,deltaS298JPerMolK:n,deltaG298KjPerMol:d,log10Keq298:f,crossoverTempK:p!=null&&p>0?p:null,spontaneousAt298K:d<0})}async function De(e,{candidate:t=null,reactantAtoms:n=null,productAtoms:r=null,equation:i=null,nImages:a=7,maxNebSteps:s=null,basisName:c=`auto`,sampleVolumes:l=!0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveReactionPathwayWebGpu requires a live WebGPU GPUDevice`);let u=n,f=r,p=i,m=null;(!u||!f)&&(m=Te(t,{maxAtoms:10}),u=m.reactantAtoms,f=m.productAtoms,p||=m.equation);let h=u.length,g=u.reduce((e,t)=>e+t.Z,0);if(g%2!=0)throw RangeError(`Closed-shell GPU RHF CI-NEB requires even total electron count (got ${g})`);let _=u.reduce((e,t)=>e+(t.Z<=2?1:t.Z<=10?5:9),0),v=h>=6||_>24,y=s??(v?1:_<=9?3:2),x=Math.max(5,h>=5?Math.min(a,5):a),S=c===`auto`&&_>10?`valence-sto3g`:c,C=await o(e,u,f,{nImages:x,maxSteps:y,stepSize:.14,climbStartStep:+!v,maxScf:_<=9?20:12,tol:4e-4,basisName:S,oneSidedGrad:!0,saddleOnlyGrad:v}),w=C.energiesHa[0],T=[],E=S,D=0;for(let t=0;t<C.images.length;t+=1){let n=C.images[t],r=await b(e,n,{maxScf:24,tol:1e-4,volDim:16,basisName:S,sampleVolume:l});D+=1,E=r.basisUsed||E,T.push(Object.freeze({imageIndex:t,xi:t/Math.max(1,C.images.length-1),isTransitionState:t===C.saddleImageIndex,atoms:r.atoms,energyHa:r.totalEnergyHa,energyEv:(r.totalEnergyHa-w)*me,bonds:r.bonds,bondOrderMatrix:r.bondOrderMatrix,mullikenCharges:r.mullikenCharges,dipoleDebye:r.dipoleDebye,dipoleVecDebye:r.dipoleVecDebye,homoLumoGapEv:r.homoLumoGapEv,atomOrbitalParams:r.atomOrbitalParams||null}))}let O=T.map(e=>e.energyEv),k=1;for(let e=2;e<T.length-1;e+=1)O[e]>O[k]&&(k=e);let A=Math.max(.05,O[k]-O[0]),ee=O[T.length-1]-O[0],te=Math.max(.05,O[k]-O[T.length-1]),ne=t?.reactants?.reduce((e,t)=>e+(Number(t.coefficient)||1),0)??2,j=((t?.products?.reduce((e,t)=>e+(Number(t.coefficient)||1),0)??2)-ne)*42-12,re=t?.energetics?.reactionEnthalpyJPerBalancedEquation==null?ee:t.energetics.reactionEnthalpyJPerBalancedEquation/he,ie=Ee(A,re,{deltaSJPerMolK:j});return Object.freeze({schema:pe,backend:`webgpu`,equation:p||`A + B -> C + D`,pathwayLabel:`Multi-Molecule GPU CI-NEB (${p||`A+B → C+D`})`,basisUsed:E,atomCount:h,gpuRhfCalls:C.gpuRhfCalls+D,steps:C.steps,converged:C.converged,saddleImageIndex:k,forwardBarrierEv:A,reverseBarrierEv:te,reactionEnergyEv:ee,candidateEnthalpyEv:re,energiesHa:Object.freeze(T.map(e=>e.energyHa)),energiesEv:Object.freeze(O),images:Object.freeze(T),imageOrbitalParams:Object.freeze(T.map(e=>e.atomOrbitalParams).filter(Boolean)),thermodynamics:ie,accuracyTier:d.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,solver:`gpumath-rhf-ci-neb-multimolecule`,scientificValidation:!1})})}async function Oe({closureRegistry:e,equation:t=`A + B -> C + D`,pathway:n=null}={}){let r={closureId:`ulg-reaction-pathway:${String(t).replace(/[^a-zA-Z0-9_-]/g,`_`)}.v1`,closureKind:`molecular-reaction-pathway-ci-neb`,inputHash:`${t}:Ea=${(n?.forwardBarrierEv??0).toFixed(3)}:dE=${(n?.reactionEnergyEv??0).toFixed(3)}`,methodHash:`gpumath-rhf-ci-neb-wiberg-webgpu.v1`,execution:{mode:`webgpu-ci-neb`,equation:t,basisUsed:n?.basisUsed??`auto`,forwardBarrierEv:n?.forwardBarrierEv??null,reverseBarrierEv:n?.reverseBarrierEv??null,reactionEnergyEv:n?.reactionEnergyEv??null,saddleImageIndex:n?.saddleImageIndex??null},validity:{temperatureK:[100,5e3]},provenance:{schema:pe,sourceModule:`src/runtime/chemistry/reactionPathwayWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(r):null,artifact:r}}function ke(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`molecular-reaction-path`,version:`1`},kernel:{sourceModule:`src/runtime/chemistry/reactionPathwayWebGpu.js`,entryPoint:`solveReactionPathwayWebGpu`,workgroupSize:64},parameterSchema:{candidate:{type:`object`},nImages:{type:`number`,min:3,max:15},maxNebSteps:{type:`number`,min:1,max:20}},stateLayout:{tensorId:`reaction_pathway_neb_images_and_wiberg_bonds`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`molecular-reaction-path@1 requires a WebGPU device`);return{status:`ok`,pathway:await De(n,e?.parameters||{})}}})}var Ae=`ulg.chemistry.molecular-vibrations-webgpu.v1`,je=1822.888486,Me=219474.6313705,Ne=27.211386245988,Pe=.0001239841984,Fe=.529177210903;function Ie(e){return e.map(e=>{let t=Array.isArray(e.position)?e.position:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0];return{Z:Math.max(1,Math.min(118,Math.trunc(e.Z))),position:[t[0],t[1],t[2]]}})}function Le(e,t=1e-7){let n=[];for(let r of e){let e=r.slice();for(let t of n){let n=0;for(let r=0;r<e.length;r+=1)n+=e[r]*t[r];for(let r=0;r<e.length;r+=1)e[r]-=n*t[r]}let i=Math.hypot(...e);i>t&&n.push(e.map(e=>e/i))}return n}function Re(e,t){let n=e.length,r=3*n,i=0,a=[0,0,0];for(let r=0;r<n;r+=1)i+=t[r],a[0]+=t[r]*e[r][0],a[1]+=t[r]*e[r][1],a[2]+=t[r]*e[r][2];a[0]/=i,a[1]/=i,a[2]/=i;let o=[];for(let e=0;e<3;e+=1){let i=Array(r).fill(0);for(let r=0;r<n;r+=1)i[r*3+e]=Math.sqrt(t[r]);o.push(i)}for(let i of[[1,0,0],[0,1,0],[0,0,1]]){let s=Array(r).fill(0);for(let r=0;r<n;r+=1){let n=e[r][0]-a[0],o=e[r][1]-a[1],c=e[r][2]-a[2],l=Math.sqrt(t[r]);s[r*3+0]=l*(i[1]*c-i[2]*o),s[r*3+1]=l*(i[2]*n-i[0]*c),s[r*3+2]=l*(i[0]*o-i[1]*n)}o.push(s)}return Le(o,1e-6)}async function ze(e,t,{maxSteps:n=8,stepSize:r=.28,maxDispBohr:i=.14,gradH:a=.004,gradTol:o=.008,maxScf:s=22,tol:c=1e-4,basisName:l=`auto`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`optimizeMolecularGeometryWebGpu requires a live WebGPU GPUDevice`);let u=Ie(t),d=u.length,f=u.map(e=>e.Z),p=u.map(e=>[...e.position]),m=e=>e.map((e,t)=>({Z:f[t],position:e})),h=null,g=0;async function _(t,n=s){let r=await b(e,m(t),{maxScf:n,tol:c,basisName:l,sampleVolume:!1,initialP:h});return g+=1,h=r.densityMatrix,r}let v=await _(p,s+4),y=v.totalEnergyHa,x=[{step:0,energyHa:v.totalEnergyHa,energyEvRel:0,maxForceHaPerBohr:0,atoms:v.atoms,bonds:v.bonds}],S=!1,C=1/0;for(let e=1;e<=n;e+=1){let t=Array.from({length:d},()=>[0,0,0]),n=p.map(e=>[...e]),c=+(d>=2);for(let e=c;e<d;e+=1)for(let r=0;r<3;r+=1){let i=n[e][r];n[e][r]=i+a;let o=(await _(n,14)).totalEnergyHa;n[e][r]=i-a;let s=(await _(n,14)).totalEnergyHa;n[e][r]=i;let l=(o-s)/(2*a);t[e][r]=l,c===1&&(t[0][r]-=l)}C=0;for(let e=0;e<d;e+=1)for(let n=0;n<3;n+=1)C=Math.max(C,Math.abs(t[e][n]));if(x[x.length-1].maxForceHaPerBohr=C,C<o){S=!0;break}let l=Math.min(r,i/Math.max(1e-8,C)),u=!1;for(let e=0;e<6;e+=1){let e=p.map((e,n)=>[e[0]-l*t[n][0],e[1]-l*t[n][1],e[2]-l*t[n][2]]),n=await _(e,s);if(n.totalEnergyHa<=v.totalEnergyHa+1e-6){p=e,v=n,u=!0;break}l*=.45}if(x.push({step:e,energyHa:v.totalEnergyHa,energyEvRel:(v.totalEnergyHa-y)*Ne,maxForceHaPerBohr:C,atoms:v.atoms,bonds:v.bonds}),!u)break}let w=await b(e,m(p),{maxScf:s+8,tol:1e-5,volDim:16,basisName:l,sampleVolume:!0,initialP:h});return g+=1,Object.freeze({schema:`ulg.chemistry.geometry-optimization-webgpu.v1`,backend:`webgpu`,basisUsed:w.basisUsed,converged:S,steps:x.length-1,gpuRhfCalls:g,initialEnergyHa:y,finalEnergyHa:w.totalEnergyHa,relaxationEv:(w.totalEnergyHa-y)*Ne,maxForceHaPerBohr:C,atoms:w.atoms,bonds:w.bonds,rhfResult:w,trajectory:Object.freeze(x)})}function Be(e,t,n){if(n<0)return`Imaginary (TS mode)`;if(t.length===2)return`Bond Stretch`;let r=0,i=0,a=0;for(let n=0;n<t.length;n+=1)for(let o=n+1;o<t.length;o+=1){let s=t[o].position[0]-t[n].position[0],c=t[o].position[1]-t[n].position[1],l=t[o].position[2]-t[n].position[2],u=Math.hypot(s,c,l);if(u>.4&&u<4.5){let t=((e[o][0]-e[n][0])*s+(e[o][1]-e[n][1])*c+(e[o][2]-e[n][2])*l)/u;r+=t,i+=Math.abs(t),a+=1}}return a===0?`Internal Mode`:i/a<.28?`Angle Bend / Deformation`:Math.abs(r)>.65*i?`Symmetric Stretch`:`Asymmetric Stretch`}async function Ve(e,t,{massesU:n=null,gradH:i=.012,maxScf:a=18,tol:o=2e-4,basisName:c=`auto`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`computeVibrationalModesWebGpu requires a live WebGPU GPUDevice`);let l=Ie(t),u=l.length;if(u<2)throw RangeError(`Vibrational normal-mode analysis requires at least 2 atoms`);let f=3*u,p=l.map(e=>e.Z),m=l.map(e=>[...e.position]),h=l.map((e,t)=>{let i=Array.isArray(n)&&Number.isFinite(Number(n[t]))?Number(n[t]):null;return Math.max(.5,i??(r[e.Z-1]||e.Z*2))}),g=h.map(e=>e*je),_=e=>e.map((e,t)=>({Z:p[t],position:e})),v=0,y=await b(e,_(m),{maxScf:a+8,tol:1e-5,basisName:c,sampleVolume:!1});v+=1;let x=y.densityMatrix,S=y.totalEnergyHa,C=y.basisUsed||c;async function w(t){let n=await b(e,_(t),{maxScf:a,tol:o,basisName:C,sampleVolume:!1,initialP:x});return v+=1,n}let T=Array.from({length:f},()=>new Float64Array(f)),E=new Float64Array(f),D=new Float64Array(f),O=Array.from({length:f},()=>[0,0,0]),k=m.map(e=>[...e]);for(let e=0;e<f;e+=1){let t=Math.floor(e/3),n=e%3,r=k[t][n];k[t][n]=r+i;let a=await w(k);E[e]=a.totalEnergyHa,k[t][n]=r-i;let o=await w(k);D[e]=o.totalEnergyHa,k[t][n]=r,T[e][e]=(E[e]-2*S+D[e])/(i*i);for(let t=0;t<3;t+=1)O[e][t]=((a.dipoleVecDebye?.[t]??0)-(o.dipoleVecDebye?.[t]??0))/(2*i)}for(let e=0;e<f;e+=1){let t=Math.floor(e/3),n=e%3,r=k[t][n];for(let a=e+1;a<f;a+=1){let o=Math.floor(a/3),s=a%3,c=k[o][s];k[t][n]=r+i,k[o][s]=c+i;let l=(await w(k)).totalEnergyHa;k[t][n]=r-i,k[o][s]=c-i;let u=(await w(k)).totalEnergyHa;k[t][n]=r,k[o][s]=c;let d=(l+u-E[e]-D[e]-E[a]-D[a]+2*S)/(2*i*i);T[e][a]=d,T[a][e]=d}}let A=Array.from({length:f},()=>new Float64Array(f));for(let e=0;e<f;e+=1){let t=Math.sqrt(g[Math.floor(e/3)]);for(let n=0;n<f;n+=1){let r=Math.sqrt(g[Math.floor(n/3)]);A[e][n]=T[e][n]/(t*r)}}let ee=Re(m,g),te=Array.from({length:f},(e,t)=>{let n=new Float64Array(f);n[t]=1;for(let e of ee)for(let r=0;r<f;r+=1)n[r]-=e[t]*e[r];return n}),ne=Array.from({length:f},()=>new Float64Array(f));for(let e=0;e<f;e+=1)for(let t=0;t<f;t+=1){let n=0;for(let r=0;r<f;r+=1)n+=te[e][r]*A[r][t];ne[e][t]=n}let j=new Float32Array(f*f);for(let e=0;e<f;e+=1)for(let t=0;t<=e;t+=1){let n=0;for(let r=0;r<f;r+=1)n+=ne[e][r]*te[r][t];j[e*f+t]=n,j[t*f+e]=n}let re=await s(e,{matrices:j,n:f,batchCount:1,maxSweeps:32,tolerance:1e-7}),ie=[];for(let e=0;e<f;e+=1){let t=re.eigenvalues[e],n=new Float64Array(f);for(let t=0;t<f;t+=1)n[t]=re.eigenvectors[t*f+e];let r=0;for(let e of ee){let t=0;for(let r=0;r<f;r+=1)t+=e[r]*n[r];r+=t*t}ie.push({k:e,lam:t,vec:n,trProj:r})}let ae=[...ie].sort((e,t)=>t.trProj-e.trProj),oe=new Set(ae.slice(0,ee.length).map(e=>e.k)),se=ie.filter(e=>!oe.has(e.k)).sort((e,t)=>e.lam-t.lam),ce=[],le=0;for(let e=0;e<se.length;e+=1){let t=se[e],n=(t.lam>=0?1:-1)*Math.sqrt(Math.abs(t.lam))*Me,r=n>0?.5*n*Pe:0;le+=r;let i=[],a=1e-8,o=[0,0,0];for(let e=0;e<u;e+=1){let n=1/Math.sqrt(g[e]),r=t.vec[e*3+0]*n,s=t.vec[e*3+1]*n,c=t.vec[e*3+2]*n;i.push([r,s,c]),a=Math.max(a,Math.hypot(r,s,c));for(let t=0;t<3;t+=1)o[t]+=O[e*3+0][t]*r+O[e*3+1][t]*s+O[e*3+2][t]*c}let s=(o[0]**2+o[1]**2+o[2]**2)*je/Fe**2*42.256,c=i.map(e=>[e[0]/a,e[1]/a,e[2]/a]),d=0;for(let e=0;e<u;e+=1)for(let t=e+1;t<u;t+=1){let n=m[t][0]-m[e][0],r=m[t][1]-m[e][1],i=m[t][2]-m[e][2],a=Math.hypot(n,r,i);if(a>.4&&a<4.8){let o=((c[t][0]-c[e][0])*n+(c[t][1]-c[e][1])*r+(c[t][2]-c[e][2])*i)/a;d+=o}}let f=Math.max(.05,d*d*18+.35);ce.push(Object.freeze({modeIndex:e,freqCm1:n,isImaginary:n<0,zpeEv:r,irIntensityKmPerMol:s,ramanActivity:f,label:Be(c,l,n),displacements:Object.freeze(c.map(e=>Object.freeze(e)))}))}let ue=Math.max(2500,...ce.map(e=>Math.max(0,e.freqCm1)))+500,de=new Float32Array(120),fe=new Float32Array(120),pe=new Float32Array(120),me=Math.max(45,ue*.018);for(let e=0;e<120;e+=1){let t=e/119*ue;de[e]=t;let n=0,r=0;for(let e of ce){if(e.freqCm1<=10)continue;let i=t-e.freqCm1,a=me*me/(i*i+me*me);n+=e.irIntensityKmPerMol*a,r+=e.ramanActivity*a}fe[e]=n,pe[e]=r}return Object.freeze({schema:Ae,backend:`webgpu`,basisUsed:C,gpuRhfCalls:v,massesU:Object.freeze(h),atoms:y.atoms,bonds:y.bonds,projectedNullModes:ee.length,modes:Object.freeze(ce),totalZpeEv:le,totalZpeKjPerMol:le*96.48533212,spectrum:Object.freeze({wavenumbersCm1:de,irSpectrum:fe,ramanSpectrum:pe}),accuracyTier:d.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,solver:`gpumath-rhf-hessian-eckart-eigen`,scientificValidation:!1})})}async function He({closureRegistry:e,formula:t=`unknown`,vibrations:n=null}={}){let r={closureId:`ulg-molecular-vibrations:${String(t).replace(/[^a-zA-Z0-9_-]/g,`_`)}.v1`,closureKind:`molecular-vibrational-hessian-ir-raman`,inputHash:`${t}:zpe=${(n?.totalZpeEv??0).toFixed(4)}:modes=${n?.modes?.length??0}`,methodHash:`gpumath-rhf-hessian-eckart-webgpu.v1`,execution:{mode:`webgpu-hessian-eigen`,formula:t,totalZpeEv:n?.totalZpeEv??null,frequenciesCm1:n?.modes?.map(e=>e.freqCm1)??[]},validity:{harmonicApproximation:!0},provenance:{schema:Ae,sourceModule:`src/runtime/chemistry/molecularVibrationsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(r):null,artifact:r}}function Ue(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`molecular-vibrations-gpu`,version:`1`},kernel:{sourceModule:`src/runtime/chemistry/molecularVibrationsWebGpu.js`,entryPoint:`computeVibrationalModesWebGpu`,workgroupSize:64},parameterSchema:{atoms:{type:`array`},massesU:{type:`array`}},stateLayout:{tensorId:`molecular_vibrational_normal_modes`,dtype:`f32`,components:3},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`molecular-vibrations-gpu@1 requires a WebGPU device`);let r=e?.parameters||{};return{status:`ok`,result:await Ve(n,r.atoms||[],r)}}})}var We=`ulg.chemistry.reactive-md-webgpu.v1`,Ge=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Ke=8617333262e-14,qe=`
struct RxMdUniforms {
  counts_meta: vec4<u32>,  // (n_particles, step_idx, collect_obs, thermostat_on)
  phys0: vec4<f32>,        // (dt, box_half, sigma_coll, react_radius)
  phys1: vec4<f32>,        // (ea_fwd_sim, ea_rev_sim, delta_h_sim, temp_target_sim)
  phys2: vec4<f32>,        // (spark_strength, catalyst_scale, mass_ab_ratio, 0)
};

// pos: vec4(x, y, z, species_id) where 0=A, 1=B, 2=C, 3=D
// vel: vec4(vx, vy, vz, flash_glow)
@group(0) @binding(0) var<uniform> u: RxMdUniforms;
@group(0) @binding(1) var<storage, read> pos_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> vel_in: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> pos_out: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> vel_out: array<vec4<f32>>;
// partner_idx[i] = closest reactive partner j within react_radius (0xffffffffu if none)
@group(0) @binding(5) var<storage, read_write> partner_idx: array<u32>;
// obs[0..7] = [countA, countB, countC, countD, sumKe*1000, fwdEvents, revEvents, sumFlash*1000]
@group(0) @binding(6) var<storage, read_write> obs: array<atomic<i32>>;

const NO_PARTNER: u32 = 0xffffffffu;

fn complementary_species(sp: u32) -> u32 {
  if (sp == 0u) { return 1u; }
  if (sp == 1u) { return 0u; }
  if (sp == 2u) { return 3u; }
  return 2u;
}

fn reacted_species(sp: u32) -> u32 {
  if (sp == 0u) { return 2u; }
  if (sp == 1u) { return 3u; }
  if (sp == 2u) { return 0u; }
  return 1u;
}

@compute @workgroup_size(64)
fn reset_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

// Pass 1: Deterministic mutual-nearest-neighbor reactive pair matching!
// Each molecule i proposes its closest complementary partner j within react_radius
// whose pair approach energy exceeds the effective activation barrier.
@compute @workgroup_size(64)
fn match_reactive_partners(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = u.counts_meta.x;
  if (i >= n) { return; }

  let pi = pos_in[i];
  let vi = vel_in[i];
  let spi = u32(round(pi.w));
  let want = complementary_species(spi);
  let r_cut = u.phys0.w;
  let r_cut2 = r_cut * r_cut;
  let ea_eff = select(u.phys1.y, u.phys1.x, spi < 2u) * u.phys2.y;

  var best_j = NO_PARTNER;
  var best_d2 = r_cut2;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let pj = pos_in[j];
    if (u32(round(pj.w)) != want) { continue; }
    let dr = pj.xyz - pi.xyz;
    let d2 = dot(dr, dr);
    if (d2 < best_d2 && d2 > 1e-6) {
      let vj = vel_in[j];
      let dv = vj.xyz - vi.xyz;
      // Pair kinetic energy in center-of-mass frame (reduced mass mu = 0.5 in sim units)
      let e_rel = 0.25 * dot(dv, dv);
      let approaching = dot(dr, dv) < 0.15;
      if (e_rel >= ea_eff && approaching) {
        best_d2 = d2;
        best_j = j;
      }
    }
  }
  partner_idx[i] = best_j;
}

// Pass 2: Execute mutually-agreed 1:1 stoichiometric reactions, WCA elastic
// collisions, spark heating, reflecting walls, and exact GPU telemetry!
@compute @workgroup_size(64)
fn step_reactive_md(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = u.counts_meta.x;
  if (i >= n) { return; }

  var p = pos_in[i].xyz;
  var sp = u32(round(pos_in[i].w));
  var v = vel_in[i].xyz;
  var flash = max(0.0, vel_in[i].w * 0.92 - 0.004);

  let dt = u.phys0.x;
  let box_h = u.phys0.y;
  let sigma = u.phys0.z;
  let sigma2 = sigma * sigma;

  // 1. Check mutual reactive pairing: partner_idx[i] == j AND partner_idx[j] == i
  let pj_idx = partner_idx[i];
  var reacted = false;
  if (pj_idx != NO_PARTNER && pj_idx < n && partner_idx[pj_idx] == i) {
    let p_other = pos_in[pj_idx].xyz;
    let v_other = vel_in[pj_idx].xyz;
    let v_cm = 0.5 * (v + v_other);
    var v_rel = v - v_cm;
    let rel_speed2 = max(1e-5, dot(v_rel, v_rel));
    let is_fwd = sp < 2u;
    // Exothermic forward reaction (delta_h < 0) INCREASES relative KE by -delta_h (0.5 per partner)!
    // Reverse endothermic reaction decreases relative KE by +delta_h (bounded >= 0.04).
    let d_ke_per_mol = select(u.phys1.z * 0.5, -u.phys1.z * 0.5, is_fwd);
    let new_speed2 = max(0.04, rel_speed2 + 2.0 * d_ke_per_mol);
    // Outgoing unit vector pushed gently apart along collision axis so pair separates cleanly
    let sep = p - p_other;
    let sep_len = length(sep);
    let out_dir = normalize(select(v_rel / sqrt(rel_speed2), sep / max(1e-4, sep_len), sep_len > 1e-4));
    v = v_cm + out_dir * sqrt(new_speed2);
    sp = reacted_species(sp);
    flash = 1.0;
    reacted = true;
    if (i < pj_idx && u.counts_meta.z != 0u) {
      if (is_fwd) {
        atomicAdd(&obs[5u], 1);
      } else {
        atomicAdd(&obs[6u], 1);
      }
    }
  }

  // 2. Short-range soft-sphere / WCA repulsive collisions with all neighbors
  var accel = vec3<f32>(0.0);
  if (!reacted) {
    for (var j = 0u; j < n; j = j + 1u) {
      if (j == i) { continue; }
      let dr = p - pos_in[j].xyz;
      let d2 = dot(dr, dr);
      if (d2 < sigma2 && d2 > 1e-6) {
        let d = sqrt(d2);
        let overlap = (sigma - d) / sigma;
        accel = accel + (dr / d) * (overlap * 28.0);
      }
    }
  }

  // 3. Optional Ignition Spark in central zone (r < 0.48 * box_h)
  if (u.phys2.x > 0.01) {
    let rc = length(p);
    let spark_w = exp(-rc * rc / (0.28 * box_h * box_h));
    if (spark_w > 0.08) {
      let dir = normalize(v + vec3<f32>(sin(f32(i) * 1.7), cos(f32(i) * 2.3), sin(f32(i) * 0.9)) * 0.25);
      v = v + dir * (u.phys2.x * spark_w);
      flash = max(flash, spark_w * 0.85);
    }
  }

  // 4. Symplectic velocity & position update + reflecting reaction chamber walls
  v = v + accel * dt;

  // Optional gentle Berendsen bath coupling when thermostat_on == 1
  if (u.counts_meta.w != 0u) {
    let target_v2 = max(0.08, 3.0 * u.phys1.w);
    let cur_v2 = max(1e-4, dot(v, v));
    let scale = clamp(1.0 + 0.015 * (sqrt(target_v2 / cur_v2) - 1.0), 0.94, 1.06);
    v = v * scale;
  }

  // Safety velocity clamp so intense exothermic sparks never blow up dt
  let sp_mag = length(v);
  if (sp_mag > 12.0) { v = v * (12.0 / sp_mag); }
  p = p + v * dt;

  let wall = box_h - sigma * 0.4;
  if (p.x < -wall) { p.x = -wall; v.x = abs(v.x); }
  if (p.x >  wall) { p.x =  wall; v.x = -abs(v.x); }
  if (p.y < -wall) { p.y = -wall; v.y = abs(v.y); }
  if (p.y >  wall) { p.y =  wall; v.y = -abs(v.y); }
  if (p.z < -wall) { p.z = -wall; v.z = abs(v.z); }
  if (p.z >  wall) { p.z =  wall; v.z = -abs(v.z); }

  pos_out[i] = vec4<f32>(p, f32(sp));
  vel_out[i] = vec4<f32>(v, flash);

  // 5. Compact GPU atomic telemetry reduction
  if (u.counts_meta.z != 0u) {
    if (sp < 4u) { atomicAdd(&obs[sp], 1); }
    let ke = 0.5 * dot(v, v);
    atomicAdd(&obs[4u], i32(round(ke * 1000.0)));
    atomicAdd(&obs[7u], i32(round(flash * 1000.0)));
  }
}
`;function Je({equation:e=`A + B -> C + D`,speciesLabels:t=[`A`,`B`,`C`,`D`],forwardBarrierEv:n=.85,reactionEnthalpyEv:r=-1.2,temperatureK:i=300,catalystEnabled:a=!1,thermostatEnabled:o=!1}={}){let s=Ke*600,c=Math.max(.08,Math.min(6,Number(n)||.85)),l=Math.max(-6,Math.min(3.5,Number(r)||-1)),u=Math.max(.35,Math.min(3.2,.55+.42*c)),d=Math.max(-2.6,Math.min(2.2,l*.55)),f=Math.max(.35,u-d);return Object.freeze({equation:e,speciesLabels:Object.freeze(t.slice(0,4)),forwardBarrierEv:c,reactionEnthalpyEv:l,tempUnitK:600,kBTUnitEv:s,eaFwdSim:u,eaRevSim:f,deltaHSim:d,temperatureK:Math.max(50,Number(i)||300),catalystEnabled:!!a,thermostatEnabled:!!o})}function Ye(e,t={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createReactiveChemistryMdSessionWebGpu requires a live WebGPU GPUDevice`);let n=Je(t),r=Math.max(32,Math.min(512,Math.trunc(t.moleculeCount??192))),i=Math.floor(r/2),a=i*2,o=.14,s=n.temperatureK,c=n.catalystEnabled,l=n.thermostatEnabled,u=0,d=0,f=0,p=0,m=0,h=!1,g=null,_=e.createShaderModule({code:qe,label:`ulg-reactive-chem-md`}),v=e.createBindGroupLayout({label:`ulg-reactive-chem-bgl`,entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),y=e.createPipelineLayout({bindGroupLayouts:[v]}),b=e.createComputePipeline({layout:y,compute:{module:_,entryPoint:`reset_obs`}}),x=e.createComputePipeline({layout:y,compute:{module:_,entryPoint:`match_reactive_partners`}}),S=e.createComputePipeline({layout:y,compute:{module:_,entryPoint:`step_reactive_md`}}),C=a*16,w=e.createBuffer({size:C,usage:Ge.STORAGE|Ge.COPY_DST|Ge.COPY_SRC}),T=e.createBuffer({size:C,usage:Ge.STORAGE|Ge.COPY_DST|Ge.COPY_SRC}),E=e.createBuffer({size:C,usage:Ge.STORAGE|Ge.COPY_DST|Ge.COPY_SRC}),D=e.createBuffer({size:C,usage:Ge.STORAGE|Ge.COPY_DST|Ge.COPY_SRC}),O=e.createBuffer({size:a*4,usage:Ge.STORAGE|Ge.COPY_DST}),k=e.createBuffer({size:32,usage:Ge.STORAGE|Ge.COPY_SRC|Ge.COPY_DST}),A=e.createBuffer({size:32,usage:Ge.MAP_READ|Ge.COPY_DST}),ee=Array.from({length:16},()=>e.createBuffer({size:64,usage:Ge.UNIFORM|Ge.COPY_DST})),te=(t,n,r,i,a)=>e.createBindGroup({layout:v,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:r}},{binding:3,resource:{buffer:i}},{binding:4,resource:{buffer:a}},{binding:5,resource:{buffer:O}},{binding:6,resource:{buffer:k}}]}),ne=ee.map(e=>te(e,w,E,T,D)),j=ee.map(e=>te(e,T,D,w,E));function re({temperatureK:t=s,seed:r=42}={}){s=Math.max(50,Number(t)||300);let i=new Float32Array(a*4),c=new Float32Array(a*4),l=r>>>0||42,h=()=>(l=Math.imul(l,1664525)+1013904223>>>0,l/4294967296),g=Math.sqrt(s/n.tempUnitK),_=Math.ceil(Math.cbrt(a)),v=(1-o)*1.85;for(let e=0;e<a;e+=1){let t=e%_,n=Math.floor(e/_)%_,r=Math.floor(e/(_*_)),a=(h()-.5)*.12,o=(h()-.5)*.12,s=(h()-.5)*.12;i[e*4+0]=((t+.5)/_-.5)*v+a,i[e*4+1]=((n+.5)/_-.5)*v+o,i[e*4+2]=((r+.5)/_-.5)*v+s,i[e*4+3]=e%2==0?0:1;let l=Math.max(1e-6,h()),u=h(),d=Math.max(1e-6,h()),f=h();c[e*4+0]=Math.sqrt(-2*Math.log(l))*Math.cos(2*Math.PI*u)*g,c[e*4+1]=Math.sqrt(-2*Math.log(l))*Math.sin(2*Math.PI*u)*g,c[e*4+2]=Math.sqrt(-2*Math.log(d))*Math.cos(2*Math.PI*f)*g,c[e*4+3]=0}e.queue.writeBuffer(w,0,i),e.queue.writeBuffer(T,0,i),e.queue.writeBuffer(E,0,c),e.queue.writeBuffer(D,0,c),m=0,d=0,f=0,p=0,u=0}re({temperatureK:s,seed:t.seed??1337});function ie(t,r,i,u,d=1){let f=Math.max(.05,Math.min(1,Number(d)||1)),p=new ArrayBuffer(64);new Uint32Array(p,0,4).set([a>>>0,r>>>0,+!!i,+!!l]),new Float32Array(p,16,4).set([.016*f,1,o,.23]),new Float32Array(p,32,4).set([n.eaFwdSim,n.eaRevSim,n.deltaHSim,s/n.tempUnitK]),new Float32Array(p,48,4).set([u,c?.52:1,1,0]),e.queue.writeBuffer(t,0,p)}function ae(e=2.6){u=Math.max(u,Number(e)||2.6)}function oe(t=4,{temperatureK:n=null,catalyst:r=null,thermostat:i=null,collectObsOnLast:o=!1,dtScale:f=1}={}){if(h)return;n!=null&&Number.isFinite(Number(n))&&(s=Math.max(50,Number(n))),r!=null&&(c=!!r),i!=null&&(l=!!i);let p=Math.max(1,Math.min(16,Math.trunc(t)));for(let e=0;e<p;e+=1){let t=e===0&&u>0?u:0;e===0&&(u=0),ie(ee[e],d+e,o&&e===p-1,t,f)}let g=Math.ceil(a/64),_=e.createCommandEncoder({label:`ulg-reactive-md-batch`}),v=_.beginComputePass({label:`ulg-reactive-md-pass`});for(let e=0;e<p;e+=1){let t=m===0?ne[e]:j[e];o&&e===p-1&&(v.setPipeline(b),v.setBindGroup(0,t),v.dispatchWorkgroups(1)),v.setPipeline(x),v.setBindGroup(0,t),v.dispatchWorkgroups(g),v.setPipeline(S),v.setBindGroup(0,t),v.dispatchWorkgroups(g),m^=1}v.end(),e.queue.submit([_.finish()]),d+=p}async function se({nonBlocking:t=!1}={}){if(h)return null;if(g){if(t)return null;try{await g}catch{}if(h)return null}let r=(async()=>{if(h)return null;let t=e.createCommandEncoder({label:`ulg-reactive-md-read`});if(t.copyBufferToBuffer(k,0,A,0,32),e.queue.submit([t.finish()]),await A.mapAsync(Ge.MAP_READ),h){try{A.unmap()}catch{}return null}let r=new Int32Array(A.getMappedRange().slice(0,32));A.unmap();let o=r[0],u=r[1],m=r[2],g=r[3],_=2/3*(r[4]/1e3/Math.max(1,a))*n.tempUnitK,v=Math.max(0,r[5]),y=Math.max(0,r[6]);f+=v,p+=y;let b=r[7]/1e3/Math.max(1,a),x=(m+g)/Math.max(1,a);return Object.freeze({schema:We,stepIndex:d,moleculeCount:a,equation:n.equation,speciesLabels:n.speciesLabels,countA:o,countB:u,countC:m,countD:g,fracA:o/Math.max(1,a),fracB:u/Math.max(1,a),fracC:m/Math.max(1,a),fracD:g/Math.max(1,a),conversionFrac:x,stoichiometryConserved:o+m===i&&u+g===i,temperatureK:_,targetTemperatureK:s,catalystEnabled:c,thermostatEnabled:l,forwardBarrierEv:n.forwardBarrierEv,reactionEnthalpyEv:n.reactionEnthalpyEv,stepFwdEvents:v,stepRevEvents:y,totalFwdEvents:f,totalRevEvents:p,flashActivity:b})})();g=r;try{return await r}finally{g===r&&(g=null)}}async function ce(e=8,{temperatureK:t=null,catalyst:n=null,thermostat:r=null,readObs:i=!0,nonBlocking:a=!1,dtScale:o=1}={}){let s=Math.max(1,Math.trunc(e));for(;s>0;){let e=Math.min(16,s);oe(e,{temperatureK:t,catalyst:n,thermostat:r,collectObsOnLast:i&&s===e,dtScale:o}),s-=e}return i?se({nonBlocking:a}):null}function le(){h=!0;for(let e of[w,T,E,D,O,k,A,...ee])try{e.destroy()}catch{}}return Object.freeze({schema:We,moleculeCount:a,params:n,getActivePosBuffer:()=>m===0?w:T,getActiveVelBuffer:()=>m===0?E:D,getStepIndex:()=>d,igniteSpark:ae,reset:(e={})=>re(e),stepSync:oe,stepBatch:ce,readTelemetry:se,destroy:le})}async function Xe({closureRegistry:e,equation:t=`A + B -> C + D`,telemetry:n=null}={}){let r={closureId:`ulg-reactive-md:${String(t).replace(/[^a-zA-Z0-9_-]/g,`_`)}.v1`,closureKind:`reactive-chemistry-collision-kinetics-md`,inputHash:`${t}:Ea=${(n?.forwardBarrierEv??0).toFixed(2)}:conv=${(n?.conversionFrac??0).toFixed(3)}`,methodHash:`webgpu-mutual-pair-reactive-md-3d.v1`,execution:{mode:`webgpu-3d-reactive-md`,equation:t,telemetry:n},validity:{temperatureK:[50,8e3]},provenance:{schema:We,sourceModule:`src/runtime/chemistry/reactiveChemistryMdWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(r):null,artifact:r}}function Ze(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`reactive-chemistry-md`,version:`1`},kernel:{sourceModule:`src/runtime/chemistry/reactiveChemistryMdWebGpu.js`,entryPoint:`step_reactive_md`,workgroupSize:64,wgsl:qe},parameterSchema:{forwardBarrierEv:{type:`number`,min:.05,max:10},reactionEnthalpyEv:{type:`number`,min:-15,max:10},temperatureK:{type:`number`,min:50,max:8e3},steps:{type:`number`,min:1,max:4096}},stateLayout:{tensorId:`reactive_md_3d_species_pos_vel`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`reactive-chemistry-md@1 requires a WebGPU device`);let r=e?.parameters||{},i=Ye(n,r);try{return r.spark&&i.igniteSpark(r.spark),{status:`ok`,telemetry:await i.stepBatch(r.steps??32,{readObs:!0})}}finally{i.destroy()}}})}var Qe=Object.freeze(`Hydrogen.Helium.Lithium.Beryllium.Boron.Carbon.Nitrogen.Oxygen.Fluorine.Neon.Sodium.Magnesium.Aluminum.Silicon.Phosphorus.Sulfur.Chlorine.Argon.Potassium.Calcium.Scandium.Titanium.Vanadium.Chromium.Manganese.Iron.Cobalt.Nickel.Copper.Zinc.Gallium.Germanium.Arsenic.Selenium.Bromine.Krypton.Rubidium.Strontium.Yttrium.Zirconium.Niobium.Molybdenum.Technetium.Ruthenium.Rhodium.Palladium.Silver.Cadmium.Indium.Tin.Antimony.Tellurium.Iodine.Xenon.Cesium.Barium.Lanthanum.Cerium.Praseodymium.Neodymium.Promethium.Samarium.Europium.Gadolinium.Terbium.Dysprosium.Holmium.Erbium.Thulium.Ytterbium.Lutetium.Hafnium.Tantalum.Tungsten.Rhenium.Osmium.Iridium.Platinum.Gold.Mercury.Thallium.Lead.Bismuth.Polonium.Astatine.Radon.Francium.Radium.Actinium.Thorium.Protactinium.Uranium.Neptunium.Plutonium.Americium.Curium.Berkelium.Californium.Einsteinium.Fermium.Mendelevium.Nobelium.Lawrencium.Rutherfordium.Dubnium.Seaborgium.Bohrium.Hassium.Meitnerium.Darmstadtium.Roentgenium.Copernicium.Nihonium.Flerovium.Moscovium.Livermorium.Tennessine.Oganesson`.split(`.`)),$e=Object.freeze({alkali:{label:`Alkali Metal`,color:`#fb923c`},"alkaline-earth":{label:`Alkaline Earth`,color:`#facc15`},transition:{label:`Transition Metal`,color:`#60a5fa`},"post-transition":{label:`Post-Transition`,color:`#38bdf8`},metalloid:{label:`Metalloid`,color:`#2dd4bf`},nonmetal:{label:`Reactive Nonmetal`,color:`#34d399`},halogen:{label:`Halogen`,color:`#4ade80`},noble:{label:`Noble Gas`,color:`#c084fc`},lanthanide:{label:`Lanthanide`,color:`#f472b6`},actinide:{label:`Actinide`,color:`#fb7185`}}),et=new Set([3,11,19,37,55,87]),tt=new Set([4,12,20,38,56,88]),nt=new Set([5,14,32,33,51,52,84]),rt=new Set([1,6,7,8,15,16,34]),it=new Set([9,17,35,53,85,117]),at=new Set([2,10,18,36,54,86,118]),ot=new Set([13,31,49,50,81,82,83,113,114,115,116]),st=new Set([26,27,28,64,66]),ct=new Set([13,22,23,30,41,42,43,44,49,50,57,73,74,75,76,77,80,81,82,90]),lt=new Set([3,11,12,13,19,20,30,37,38,55,56,87,88]);function ut(e){return e>=57&&e<=71?`lanthanide`:e>=89&&e<=103?`actinide`:et.has(e)?`alkali`:tt.has(e)?`alkaline-earth`:at.has(e)?`noble`:it.has(e)?`halogen`:rt.has(e)?`nonmetal`:nt.has(e)?`metalloid`:ot.has(e)?`post-transition`:`transition`}function dt(e){return e===1?{row:1,col:1}:e===2?{row:1,col:18}:e<=4?{row:2,col:e-2}:e<=10?{row:2,col:e+8}:e<=12?{row:3,col:e-10}:e<=18?{row:3,col:e}:e<=36?{row:4,col:e-18}:e<=54?{row:5,col:e-36}:e<=56?{row:6,col:e-54}:e<=71?{row:8,col:e-53}:e<=86?{row:6,col:e-68}:e<=88?{row:7,col:e-86}:e<=103?{row:9,col:e-85}:{row:7,col:e-100}}function ft(){let e=[];for(let t=1;t<=118;t+=1){let i=dt(t),a=ut(t);e.push({Z:t,symbol:n[t-1],name:Qe[t-1],massU:r[t-1],row:i.row,col:i.col,family:a,isFerromagnet:st.has(t),isSuperconductor:ct.has(t),isReactiveMetal:lt.has(t)})}return e}var pt=Object.freeze([`nuclear`,`atomic`,`crystal`,`md`,`compound`,`polytope`]),mt=Object.freeze({nuclear:Object.freeze([`tdse`,`fission`,`bateman`]),atomic:Object.freeze([`cloud`,`volume`]),crystal:Object.freeze([`photon-shell`,`lattice`,`bloch`,`tdks-atom`,`spin-llg`,`transport`]),md:Object.freeze([`equilibrium`,`strain`,`acoustic`,`shear`,`thermal`,`surface`]),compound:Object.freeze([`molecule`,`reaction-path`,`vibrations`,`reactive-md`]),polytope:Object.freeze([`3d-surface`,`2d-facets`,`residual-map`])}),ht=Object.freeze({nuclear:`tdse`,atomic:`cloud`,crystal:`photon-shell`,md:`equilibrium`,compound:`molecule`,polytope:`3d-surface`}),gt=new Map;for(let e=0;e<n.length;e+=1)gt.set(n[e].toLowerCase(),e+1);var _t=new Map;for(let[e,t]of Object.entries(mt))for(let n of t)_t.set(n,e);var vt=Object.freeze({ey:0,ez:1,circ:2,circular:2,lcp:2}),yt=Object.freeze([`ey`,`ez`,`circ`]),bt=Object.freeze({vol:0,volume:0,scatt:1,scattered:1,cut:2}),xt=Object.freeze([`vol`,`scatt`,`cut`]),St=new Set([`valence`,`d2`,`d0`,`p0`,`s0`,`f0`]);function Ct(e){if(e==null)return null;let t=String(e).trim();if(!t)return null;if(/^\d+$/.test(t)){let e=Math.trunc(Number(t));return e>=1&&e<=118?e:null}let n=t.replace(/[-\s]?\d+$/,``).toLowerCase();return gt.get(n)??null}function wt(e){if(!e)return null;let t=String(e).trim().match(/^[A-Za-z]{1,3}[-\s]?(\d{1,3})$/);return t?Math.trunc(Number(t[1])):null}function Tt(e){let t=String(e||``).trim();return!t||t.length>48||!/^[A-Za-z0-9()[\]\s+\-.,]+$/.test(t)?null:t.replace(/\s+/g,``)}function Et(e){let t=String(e||``).trim();if(!t)return null;let n=t.split(/[,|+\s]+/).map(e=>Tt(e)).filter(Boolean);return n.length<2?null:[n[0],n[1]]}function Dt(e=``){let t=new URLSearchParams(String(e||``).replace(/^\?/,``)),n=Et(t.get(`react`)),r=Tt(t.get(`compound`)||t.get(`formula`)),i=Ct(t.get(`el`)||t.get(`element`)||t.get(`z`)),a=wt(t.get(`el`)||t.get(`element`)),o=`element`,s=i??26,c=null,l=null,u=null;if(n)o=`reaction`,u=n;else if(r)o=`compound`,l=r;else{o=`element`;let e=t.get(`a`),n=e!=null&&e.trim()!==``&&Number.isFinite(Number(e))?Math.trunc(Number(e)):a;n!=null&&n>=s&&n<=310&&(c=n)}let d=String(t.get(`view`)||``).trim().toLowerCase(),f=String(t.get(`tab`)||``).trim().toLowerCase(),p=pt.includes(f)?f:null;!p&&d&&_t.has(d)&&(p=_t.get(d)),p||(o===`reaction`||o===`compound`)&&(p=`compound`);let m=(mt[p||`nuclear`]||[]).includes(d)?d:null,h=t.has(`n`)&&Number.isFinite(Number(t.get(`n`))),g=t.has(`l`)&&Number.isFinite(Number(t.get(`l`))),_=t.has(`m`)&&Number.isFinite(Number(t.get(`m`))),v=h||g||_,y=h?Math.max(1,Math.min(7,Math.trunc(Number(t.get(`n`))))):null,b=g?Math.max(0,Math.min((y??7)-1,Math.trunc(Number(t.get(`l`))))):null,x=_?Math.max(-(b??6),Math.min(b??6,Math.trunc(Number(t.get(`m`))))):null,S=String(t.get(`xc`)||``).trim().toLowerCase(),C=S===`pbe`||S===`lda`||S===`bare`?S:null,w=t.get(`rel`),T=w==null?null:!(w===`0`||w.toLowerCase()===`false`),E=String(t.get(`orb`)||``).trim().toLowerCase(),D=St.has(E)?E:null,O=String(t.get(`pol`)||``).trim().toLowerCase(),k=Object.prototype.hasOwnProperty.call(vt,O)?vt[O]:/^[012]$/.test(O)?Number(O):null,A=String(t.get(`fview`)||``).trim().toLowerCase(),ee=Object.prototype.hasOwnProperty.call(bt,A)?bt[A]:/^[012]$/.test(A)?Number(A):null,te=t.get(`lam`),ne=te!=null&&Number.isFinite(Number(te))?Math.max(380,Math.min(780,Math.round(Number(te)))):null,j=t.get(`mono`),re=j==null?ne==null?null:!0:j===`1`||j.toLowerCase()===`true`,ie=t.get(`b2`),ae=ie!=null&&Number.isFinite(Number(ie))?Math.max(0,Math.min(1.35,Number(ie))):null,oe=t.get(`T`)??t.get(`temp`),se=oe!=null&&Number.isFinite(Number(oe))?Math.max(.5,Math.min(12e3,Number(oe))):null,ce=t.get(`mep`),le=ce==null?null:+(ce===`1`||ce.toLowerCase()===`true`),ue=t.get(`orbCloud`),de=ue==null?null:ue===`1`||ue.toLowerCase()===`true`,fe=t.get(`deut`),pe=fe==null?null:fe===`1`||fe.toLowerCase()===`true`,me=String(t.get(`regime`)||``).trim().toLowerCase(),he=me===`planetary`||me===`lab`?me:null,ge=t.get(`speed`),_e=ge!=null&&Number.isFinite(Number(ge))?Math.max(.05,Math.min(2,Number(ge))):null,ve=t.get(`grav`),ye=ve==null?null:ve===`1`||ve.toLowerCase()===`true`,be=null,xe=t.get(`cam`);if(xe){let e=xe.split(`,`).map(e=>Number(e));e.length>=2&&e.every(e=>Number.isFinite(e))&&(be={yaw:Math.max(-6.3,Math.min(6.3,e[0])),pitch:Math.max(-1.4,Math.min(1.4,e[1])),dist:e.length>=3?Math.max(1.2,Math.min(6,e[2])):null})}return Object.freeze({specimenKind:o,Z:s,A:c,formula:l,reactants:u,tab:p,view:m,hasExplicitQuantumNumbers:v,n:y,l:b,m:x,functional:C,relativisticSpinOrbit:T,tdksOrbitalPreset:D,tdksPolMode:k,tdksFieldView:ee,probeWavelengthNm:ne,photonModeMono:re,fissionBeta2:ae,tempK:se,molColorMode:le,molShowOrbitalOverlay:de,vibDeuterated:pe,polytopeRegime:he,simSpeed:_e,mdGravity:ye,camera:be})}function Ot({specimenKind:e=`element`,Z:t=26,A:n=null,formula:r=null,reactants:i=null,tab:a=`nuclear`,view:o=null,n:s=null,l:c=null,m:u=null,functional:d=`pbe`,relativisticSpinOrbit:f=!0,tdksOrbitalPreset:p=`valence`,tdksPolMode:m=0,tdksFieldView:h=0,photonModeMono:g=!1,probeWavelengthNm:v=440,fissionBeta2:y=0,tempK:b=null,molColorMode:x=0,molShowOrbitalOverlay:S=!1,vibDeuterated:C=!1,polytopeRegime:w=`lab`,simSpeed:T=1,mdGravity:E=!1,camera:D=null}={},{includeCamera:O=!1}={}){let k=new URLSearchParams,A=pt.includes(a)?a:`nuclear`;if(e===`reaction`&&Array.isArray(i)&&i.length>=2)k.set(`react`,`${i[0]},${i[1]}`);else if(e===`compound`&&r)k.set(`compound`,String(r).trim());else{let e=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));k.set(`el`,_(e));let r=l(e);n!=null&&Number.isFinite(Number(n))&&Math.trunc(Number(n))!==r&&k.set(`a`,String(Math.trunc(Number(n))))}k.set(`tab`,A);let ee=mt[A]||[];if(o&&ee.includes(o)&&k.set(`view`,o),A===`nuclear`?o===`fission`&&Number(y)>.01&&k.set(`b2`,Number(y).toFixed(2)):A===`atomic`?e===`element`&&(Number.isFinite(s)&&k.set(`n`,String(Math.trunc(s))),Number.isFinite(c)&&k.set(`l`,String(Math.trunc(c))),Number.isFinite(u)&&k.set(`m`,String(Math.trunc(u))),d&&d!==`pbe`&&k.set(`xc`,d),f===!1&&k.set(`rel`,`0`)):A===`crystal`?(e===`element`&&f===!1&&k.set(`rel`,`0`),o===`tdks-atom`?(p&&p!==`valence`&&k.set(`orb`,p),m>0&&yt[m]&&k.set(`pol`,yt[m]),h>0&&xt[h]&&k.set(`fview`,xt[h]),g&&k.set(`lam`,String(Math.round(v||440)))):o===`photon-shell`?g&&k.set(`lam`,String(Math.round(v||440))):(o===`spin-llg`||o===`transport`)&&Number.isFinite(b)&&Math.abs(b-300)>=1&&k.set(`T`,b<20?Number(b).toFixed(1):String(Math.round(b)))):A===`md`?(Number.isFinite(b)&&k.set(`T`,String(Math.round(b))),E&&k.set(`grav`,`1`)):A===`compound`?(x===1&&k.set(`mep`,`1`),S&&k.set(`orbCloud`,`1`),o===`vibrations`&&C&&k.set(`deut`,`1`),o===`reactive-md`&&Number.isFinite(b)&&Math.abs(b-340)>=5&&k.set(`T`,String(Math.round(b)))):A===`polytope`&&w===`planetary`&&k.set(`regime`,`planetary`),T!=null&&Number.isFinite(Number(T))&&Number(T)>0&&Math.abs(Number(T)-1)>=.025&&k.set(`speed`,Number(T).toFixed(2).replace(/0+$/,``).replace(/\.$/,``)),O&&D&&Number.isFinite(D.yaw)&&Number.isFinite(D.pitch)&&!(Math.abs(D.yaw-.42)<.03&&Math.abs(D.pitch-.28)<.03&&(!Number.isFinite(D.dist)||Math.abs(D.dist-2.85)<.05))){let e=Number.isFinite(D.dist)?`,${D.dist.toFixed(2)}`:``;k.set(`cam`,`${D.yaw.toFixed(2)},${D.pitch.toFixed(2)}${e}`)}return`?${k.toString()}`}function kt({specimenKind:e=`element`,Z:t=26,A:n=null,formula:r=null,reactants:i=null,tab:a=`nuclear`,view:o=null}={}){let s={tdse:`Nuclear TDSE`,fission:`3D Nuclear Fission`,bateman:`Bateman Decay`,cloud:`3D Dirac–KS Orbital`,volume:`Spin Volume`,"photon-shell":`2D Maxwell Optical Slab`,lattice:`3D Crystal Cell`,bloch:`3D Bloch Bands`,"tdks-atom":`3D Maxwell–KS Atom`,"spin-llg":`3D Spin Lattice`,transport:`Electron Transport / BCS`,equilibrium:`Live MD & Phonons`,strain:`MD Stress–Strain`,acoustic:`Acoustic Crystal Bar`,shear:`Couette Viscosity`,thermal:`Thermal Transport`,surface:`Surface Tension Slab`,molecule:`3D Molecule & Bonds`,"reaction-path":`GPU CI-NEB Reaction`,vibrations:`IR/Raman Vibrations`,"reactive-md":`3D Reactive MD`,"3d-surface":`3D Polytope Atlas`,"2d-facets":`2D Polytope Facets`,"residual-map":`Chebyshev Residuals`},c;if(e===`reaction`&&Array.isArray(i)&&i.length>=2)c=`${i[0]} + ${i[1]}`;else if(e===`compound`&&r)c=r;else{let e=_(Math.max(1,Math.min(118,Math.trunc(Number(t)||26)))),r=l(Math.max(1,Math.min(118,Math.trunc(Number(t)||26))));c=n!=null&&Math.trunc(Number(n))!==r?`${e}-${Math.trunc(Number(n))}`:e}let u=s[o]||s[ht[a]]||a;return`${c} · ${u} — ULG Material Physics Lab`}var At=`ulg.electronic.atom-tdks-3d-webgpu.v1`,jt=512,Mt=256,Nt=1/137.035999084,Pt=1239.841984,M=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function Ft(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function It(e,t){return t<0||t>e?0:Ft(e)/(Ft(t)*Ft(e-t))}function Lt(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*It(e+t,e-a)/Ft(a)*i,i*=n}return r}function Rt(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function zt(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)))}function Bt(e,t,n,r){if(!r)return e;let i=(Nt*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function Vt({Z:e=79,n0:t=5,l0:n=2,n1:r=6,l1:i=1,m:a=0,rGrid:o=null,u0:s=null,u1:c=null,screeningExchange:l=!0,relativisticSpinOrbit:u=!0}={}){let d=Math.max(1,Math.min(8,Math.trunc(t))),f=Math.max(0,Math.min(d-1,Math.trunc(n))),p=Math.max(1,Math.min(8,Math.trunc(r))),m=Math.max(0,Math.min(p-1,Math.trunc(i))),h=Math.max(-f,Math.min(f,Math.trunc(a))),g=Math.abs(h),_=(t,n,r)=>{let i=new Float32Array(jt),a=Array.isArray(o)&&o.length>=32&&r&&r.length===o.length,s=6;if(a){let e=0,t=new Float64Array(o.length);for(let n=0;n<o.length;n+=1){let i=n===0?o[1]-o[0]:n===o.length-1?o[n]-o[n-1]:.5*(o[n+1]-o[n-1]),a=r[n]*r[n]*Math.max(1e-8,i);t[n]=a,e+=a}let a=0;s=Math.max(1.5,o[o.length-1]*.5);for(let n=0;n<o.length;n+=1)if(a+=t[n],a>=e*.992){s=Math.max(.8,Math.min(34,o[n]*1.15));break}let c=0;for(let e=0;e<jt;e+=1){let t=(e+.5)/jt,a=t*s;for(;c+1<o.length&&o[c+1]<a;)c+=1;let l=Math.min(o.length-2,c),u=o[l],d=Math.max(u+1e-9,o[l+1]),f=Math.max(0,Math.min(1,(a-u)/(d-u)));i[e]=(r[l]*(1-f)+r[l+1]*f)/Math.max(n===0?.08:.12,t)}}else{let r=Bt(zt(e,t,n,l),t,n,u),a=(3*t*t-n*(n+1))/(2*Math.max(.5,r));s=Math.max(1.2,Math.min(40,a*2.5+1.4/Math.sqrt(Math.max(1,r))));let o=Math.sqrt((2*r/t)**3*(Ft(t-n-1)/(2*t*Ft(t+n))));for(let e=0;e<jt;e+=1){let a=(e+.5)/jt*s,c=2*r*a/t,l=Lt(t-n-1,2*n+1,c);i[e]=o*Math.exp(-.5*c)*c**+n*l}}let c=1e-12;for(let e=0;e<jt;e+=1)c=Math.max(c,Math.abs(i[e]));let d=1/c;for(let e=0;e<jt;e+=1)i[e]*=d;return{arr:i,rExtent:s}},v=_(d,f,s),y=_(p,m,c),b=new Float32Array(jt*4);for(let e=0;e<jt;e+=1)b[e*4+0]=(e+.5)/jt,b[e*4+1]=v.arr[e],b[e*4+2]=y.arr[e],b[e*4+3]=0;let x=Math.min(m,g),S=new Float32Array(Mt),C=new Float32Array(Mt),w=1e-12,T=1e-12;for(let e=0;e<Mt;e+=1){let t=-1+(e+.5)/Mt*2;S[e]=Rt(f,g,t),C[e]=Rt(m,x,t),w=Math.max(w,Math.abs(S[e])),T=Math.max(T,Math.abs(C[e]))}let E=new Float32Array(Mt*4);for(let e=0;e<Mt;e+=1){let t=-1+(e+.5)/Mt*2;E[e*4+0]=t,E[e*4+1]=S[e]/w,E[e*4+2]=C[e]/T,E[e*4+3]=0}return Object.freeze({radialTable:b,polarTable:E,n0:d,l0:f,n1:p,l1:m,m:h,mAbs:g,rExtentBohr:Math.max(v.rExtent,y.rExtent)})}var Ht=`
struct ChiBuildParams {
  grid_n: u32,
  radial_bins: u32,
  polar_bins: u32,
  m_abs: u32,
  m_signed: i32,
  world_half: f32,
  atom_radius: f32,
  chi_gain: f32,
};

@group(0) @binding(0) var<uniform> cb: ChiBuildParams;
@group(0) @binding(1) var<storage, read> rad_tab: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pol_tab: array<vec4<f32>>;
// chi3d[idx] = vec4(chi_density, psi0_psi1_overlap, psi0_signed, sponge_damp)
@group(0) @binding(3) var<storage, read_write> chi3d: array<vec4<f32>>;
// axis3d[idx] = vec4(lobe_nx, lobe_ny, lobe_nz, r_norm)
@group(0) @binding(4) var<storage, read_write> axis3d: array<vec4<f32>>;

fn eval_psi_at(p: vec3<f32>) -> vec3<f32> {
  let r_w = length(p);
  let r_norm = r_w / max(0.2, cb.atom_radius);
  if (r_norm >= 1.05) {
    return vec3<f32>(0.0);
  }
  let rf = clamp(r_norm, 0.0, 0.999) * f32(cb.radial_bins - 1u);
  let ri = u32(floor(rf));
  let ri1 = min(cb.radial_bins - 1u, ri + 1u);
  let rt = fract(rf);
  let r_s = mix(rad_tab[ri], rad_tab[ri1], rt);

  let cos_th = select(1.0, clamp(p.y / max(1e-5, r_w), -1.0, 1.0), r_w > 1e-5);
  let pf = clamp((cos_th + 1.0) * 0.5, 0.0, 0.999) * f32(cb.polar_bins - 1u);
  let pi0 = u32(floor(pf));
  let pi1 = min(cb.polar_bins - 1u, pi0 + 1u);
  let pt = fract(pf);
  let p_s = mix(pol_tab[pi0], pol_tab[pi1], pt);

  var az = 1.0;
  if (cb.m_abs > 0u) {
    let phi = atan2(p.z, p.x);
    let mf = f32(cb.m_abs);
    az = select(sin(mf * phi), cos(mf * phi), cb.m_signed > 0);
  }

  let env = smoothstep(1.05, 0.86, r_norm);
  let psi0 = r_s.y * p_s.y * az * env;
  let psi1 = r_s.z * p_s.z * az * env;
  return vec3<f32>(psi0, psi1, r_norm);
}

@compute @workgroup_size(64)
fn build_orbital_chi_3d(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = cb.grid_n;
  let tot = n * n * n;
  let idx = gid.x;
  if (idx >= tot) { return; }

  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  let fn_f = f32(n);
  let pos = ((vec3<f32>(f32(ix), f32(iy), f32(iz)) + 0.5) / fn_f * 2.0 - 1.0) * cb.world_half;

  let v = eval_psi_at(pos);
  let psi0 = v.x;
  let psi1 = v.y;
  let r_norm = v.z;

  // Finite-difference orbital lobe direction vector (gradient of |psi0|^2 + radial lobe vector)
  let eps = (2.0 * cb.world_half) / fn_f;
  let px_p = eval_psi_at(pos + vec3<f32>(eps, 0.0, 0.0)).x;
  let px_m = eval_psi_at(pos - vec3<f32>(eps, 0.0, 0.0)).x;
  let py_p = eval_psi_at(pos + vec3<f32>(0.0, eps, 0.0)).x;
  let py_m = eval_psi_at(pos - vec3<f32>(0.0, eps, 0.0)).x;
  let pz_p = eval_psi_at(pos + vec3<f32>(0.0, 0.0, eps)).x;
  let pz_m = eval_psi_at(pos - vec3<f32>(0.0, 0.0, eps)).x;
  let grad_psi = vec3<f32>(px_p - px_m, py_p - py_m, pz_p - pz_m);
  let r_dir = select(vec3<f32>(0.0, 1.0, 0.0), normalize(pos), length(pos) > 1e-4);
  let g_len = length(grad_psi);
  // Blend radial lobe vector with wavefunction gradient so polarizability aligns naturally along orbital lobes!
  let raw_axis = select(r_dir, normalize(grad_psi) * 0.55 + r_dir * 0.45, g_len > 1e-5);
  let lobe_axis = normalize(raw_axis + vec3<f32>(1e-6, 0.0, 0.0));

  // Smooth quadratic 4-voxel absorbing sponge boundary on all 6 faces
  let bx = min(ix, n - 1u - ix);
  let by = min(iy, n - 1u - iy);
  let bz = min(iz, n - 1u - iz);
  let bmin = f32(min(bx, min(by, bz)));
  let sponge_w = 4.0;
  let s_frac = clamp((sponge_w - bmin) / sponge_w, 0.0, 1.0);
  let damp = 1.0 - 0.16 * s_frac * s_frac;

  // Orbital probability density & dipole transition density
  let rho0 = psi0 * psi0;
  let rho1 = psi1 * psi1;
  // Crisp soft-saturated lobe susceptibility (0 strictly on nodal planes!)
  let chi_dens = tanh((rho0 * 2.2 + rho1 * 0.45) * cb.chi_gain);
  let ov = clamp(psi0 * psi1 * 2.4, -1.0, 1.0);

  chi3d[idx] = vec4<f32>(chi_dens, ov, clamp(psi0 * 1.4, -1.0, 1.0), damp);
  axis3d[idx] = vec4<f32>(lobe_axis, clamp(r_norm, 0.0, 2.5));
}

struct FdtdStepParams {
  grid_n: u32,
  step_idx: u32,
  pol_mode: u32,      // 0 = linear E_y, 1 = linear E_z, 2 = circular LCP (E_y + i E_z)
  mode_mono: u32,     // 0 = broadband RGB white pulse, 1 = monochromatic single lambda
  courant_s: f32,     // 0.40 (< 1/sqrt(3) = 0.577)
  omega0: f32,        // atom Dirac-KS transition frequency (rad / step)
  gamma0: f32,        // atom transition damping (1 / step)
  omega_probe: f32,   // probe wavepacket carrier frequency (rad / step)
  omega_r: f32,       // red 610nm frequency (rad / step)
  omega_g: f32,       // green 535nm frequency (rad / step)
  omega_b: f32,       // blue 440nm frequency (rad / step)
  chi_couple: f32,    // electromagnetic susceptibility coupling strength
  pulse_t0: f32,      // source pulse peak step
  pulse_width: f32,   // source pulse width (steps)
  src_amp: f32,       // incident wave amplitude
  beam_waist_frac: f32,
};

@group(0) @binding(0) var<uniform> fp: FdtdStepParams;
@group(0) @binding(1) var<storage, read> chi_buf: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> axis_buf: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> e_tot: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> h_tot: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> e_inc: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> h_inc: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> pol_buf: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> j_buf: array<vec4<f32>>;

fn vidx(ix: u32, iy: u32, iz: u32, n: u32) -> u32 {
  return (iz * n + iy) * n + ix;
}

fn eval_source_pair(t: f32) -> vec2<f32> {
  let dt = t - fp.pulse_t0;
  let env = exp(-0.5 * (dt / max(2.0, fp.pulse_width)) * (dt / max(2.0, fp.pulse_width)));
  if (fp.mode_mono > 0u) {
    return vec2<f32>(
      fp.src_amp * env * cos(fp.omega_probe * dt),
      fp.src_amp * env * sin(fp.omega_probe * dt)
    );
  }
  // Coherent broadband white-light pulse spanning R/G/B optical frequencies
  let c_sum = 0.36 * cos(fp.omega_r * dt) + 0.36 * cos(fp.omega_g * dt) + 0.42 * cos(fp.omega_b * dt);
  let s_sum = 0.36 * sin(fp.omega_r * dt) + 0.36 * sin(fp.omega_g * dt) + 0.42 * sin(fp.omega_b * dt);
  return vec2<f32>(fp.src_amp * env * c_sum, fp.src_amp * env * s_sum);
}

// Pass 1: Exact 3D Yee Curl-E -> H update for BOTH total and free-space reference fields
@compute @workgroup_size(64)
fn step_h_3d(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = fp.grid_n;
  let tot = n * n * n;
  let idx = gid.x;
  if (idx >= tot) { return; }

  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix >= n - 1u || iy >= n - 1u || iz >= n - 1u) { return; }

  let damp = chi_buf[idx].w;
  let s = fp.courant_s;

  let ec = e_tot[idx].xyz;
  let ex_p = e_tot[vidx(ix + 1u, iy, iz, n)].xyz;
  let ey_p = e_tot[vidx(ix, iy + 1u, iz, n)].xyz;
  let ez_p = e_tot[vidx(ix, iy, iz + 1u, n)].xyz;

  let curl_e = vec3<f32>(
    (ey_p.z - ec.z) - (ez_p.y - ec.y),
    (ez_p.x - ec.x) - (ex_p.z - ec.z),
    (ex_p.y - ec.y) - (ey_p.x - ec.x)
  );
  var h_new = h_tot[idx].xyz * damp - s * curl_e;

  // Identical free-space reference field for exact live E_scatt = E_tot - E_inc!
  let ic = e_inc[idx].xyz;
  let ix_p = e_inc[vidx(ix + 1u, iy, iz, n)].xyz;
  let iy_p = e_inc[vidx(ix, iy + 1u, iz, n)].xyz;
  let iz_p = e_inc[vidx(ix, iy, iz + 1u, n)].xyz;
  let curl_ei = vec3<f32>(
    (iy_p.z - ic.z) - (iz_p.y - ic.y),
    (iz_p.x - ic.x) - (ix_p.z - ic.z),
    (ix_p.y - ic.y) - (iy_p.x - ic.x)
  );
  var hi_new = h_inc[idx].xyz * damp - s * curl_ei;

  // Soft unidirectional magnetic injection on left source plane (ix == 4)
  if (ix == 4u && iy >= 4u && iy < n - 4u && iz >= 4u && iz < n - 4u) {
    let yc = (f32(iy) + 0.5) / f32(n) * 2.0 - 1.0;
    let zc = (f32(iz) + 0.5) / f32(n) * 2.0 - 1.0;
    let w2 = fp.beam_waist_frac * fp.beam_waist_frac;
    let waist = exp(-0.5 * (yc * yc + zc * zc) / max(0.02, w2));
    let src = eval_source_pair(f32(fp.step_idx) + 0.5) * waist * 0.55;
    if (fp.pol_mode == 0u) {
      h_new.z = h_new.z + src.x;
      hi_new.z = hi_new.z + src.x;
    } else if (fp.pol_mode == 1u) {
      h_new.y = h_new.y - src.x;
      hi_new.y = hi_new.y - src.x;
    } else {
      h_new.z = h_new.z + src.x;
      h_new.y = h_new.y - src.y;
      hi_new.z = hi_new.z + src.x;
      hi_new.y = hi_new.y - src.y;
    }
  }

  h_tot[idx] = vec4<f32>(clamp(h_new, vec3<f32>(-8.0), vec3<f32>(8.0)), 0.0);
  h_inc[idx] = vec4<f32>(clamp(hi_new, vec3<f32>(-8.0), vec3<f32>(8.0)), 0.0);
}

// Pass 2: Exact 3D Yee Curl-H -> E + Semi-Implicit Anisotropic 3D Orbital
// Lorentz-Bloch Polarization P(r,t), Current J(r,t), Local rho_11(r,t) & Absorption!
@compute @workgroup_size(64)
fn step_e_pol_3d(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = fp.grid_n;
  let tot = n * n * n;
  let idx = gid.x;
  if (idx >= tot) { return; }

  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix == 0u || iy == 0u || iz == 0u || ix >= n - 1u || iy >= n - 1u || iz >= n - 1u) {
    e_tot[idx] = vec4<f32>(0.0);
    e_inc[idx] = vec4<f32>(0.0);
    return;
  }

  let chi4 = chi_buf[idx];
  let ax4 = axis_buf[idx];
  let chi_dens = chi4.x;
  let damp = chi4.w;
  let s = fp.courant_s;

  let hc = h_tot[idx].xyz;
  let hx_m = h_tot[vidx(ix - 1u, iy, iz, n)].xyz;
  let hy_m = h_tot[vidx(ix, iy - 1u, iz, n)].xyz;
  let hz_m = h_tot[vidx(ix, iy, iz - 1u, n)].xyz;
  let curl_h = vec3<f32>(
    (hc.z - hy_m.z) - (hc.y - hz_m.y),
    (hc.x - hz_m.x) - (hc.z - hx_m.z),
    (hc.y - hx_m.y) - (hc.x - hy_m.x)
  );

  let hic = h_inc[idx].xyz;
  let hix_m = h_inc[vidx(ix - 1u, iy, iz, n)].xyz;
  let hiy_m = h_inc[vidx(ix, iy - 1u, iz, n)].xyz;
  let hiz_m = h_inc[vidx(ix, iy, iz - 1u, n)].xyz;
  let curl_hi = vec3<f32>(
    (hic.z - hiy_m.z) - (hic.y - hiz_m.y),
    (hic.x - hiz_m.x) - (hic.z - hix_m.z),
    (hic.y - hix_m.y) - (hic.x - hiy_m.x)
  );

  let e_old = e_tot[idx].xyz;
  var e_free = e_old * damp + s * curl_h;
  var ei_new = e_inc[idx].xyz * damp + s * curl_hi;

  // Soft 3D Gaussian-waist photon wavepacket injection on ix == 4
  if (ix == 4u && iy >= 4u && iy < n - 4u && iz >= 4u && iz < n - 4u) {
    let yc = (f32(iy) + 0.5) / f32(n) * 2.0 - 1.0;
    let zc = (f32(iz) + 0.5) / f32(n) * 2.0 - 1.0;
    let w2 = fp.beam_waist_frac * fp.beam_waist_frac;
    let waist = exp(-0.5 * (yc * yc + zc * zc) / max(0.02, w2));
    let src = eval_source_pair(f32(fp.step_idx)) * waist * 0.55;
    if (fp.pol_mode == 0u) {
      e_free.y = e_free.y + src.x;
      ei_new.y = ei_new.y + src.x;
    } else if (fp.pol_mode == 1u) {
      e_free.z = e_free.z + src.x;
      ei_new.z = ei_new.z + src.x;
    } else {
      e_free.y = e_free.y + src.x;
      e_free.z = e_free.z + src.y;
      ei_new.y = ei_new.y + src.x;
      ei_new.z = ei_new.z + src.y;
    }
  }

  // Local 3D Orbital-Geometry Anisotropic Lorentz-Bloch Polarization!
  // Positive-definite susceptibility tensor: chi_ij = chi_dens * (0.45 I + 1.15 n_lobe n_lobe^T)
  // Generates genuine lobe-aligned polarization currents AND cross-polarized 3D scattering!
  var p4 = pol_buf[idx];
  var j4 = j_buf[idx];
  var e_new = e_free;

  if (chi_dens > 1e-4) {
    let n_lobe = ax4.xyz;
    let e_proj = n_lobe * dot(e_free, n_lobe);
    let e_aniso = e_free * 0.45 + e_proj * 1.15;

    let w0 = fp.omega0;
    let w0_sq = w0 * w0;
    let gam = fp.gamma0;
    // Bloch inversion saturation factor (1 - rho11) smoothly limits upper-state population
    let inv_sat = max(0.18, 1.0 - 0.85 * p4.w);
    let drive = e_aniso * (chi_dens * fp.chi_couple * w0_sq * inv_sat);

    // Unconditionally stable Crank-Nicolson ADE update for (P, J = dP/dt):
    let a_den = 1.0 + 0.5 * gam + 0.25 * w0_sq;
    let a_num = 1.0 - 0.5 * gam - 0.25 * w0_sq;
    let j_new = (a_num * j4.xyz - w0_sq * p4.xyz + drive) / a_den;
    let p_new = p4.xyz + 0.5 * (j4.xyz + j_new);

    // Self-consistent electromagnetic back-reaction: E^{n+1} = E_free - J_atom
    // Coupled smoothly with passive denominator so scattering never blows up!
    let back_react = j_new * 0.72;
    e_new = e_free - back_react;

    // Local electromagnetic work done on orbital electron cloud: E · J
    let p_abs = max(0.0, dot(0.5 * (e_old + e_new), j_new));
    let gamma_pop = gam * 0.14;
    let rho11_new = clamp(p4.w * (1.0 - gamma_pop) + p_abs * (1.65 / max(0.12, chi_dens)), 0.0, 0.96);
    let abs_accum = j4.w * 0.985 + p_abs;

    pol_buf[idx] = vec4<f32>(clamp(p_new, vec3<f32>(-4.0), vec3<f32>(4.0)), rho11_new);
    j_buf[idx] = vec4<f32>(clamp(j_new, vec3<f32>(-4.0), vec3<f32>(4.0)), min(25.0, abs_accum));
  } else {
    pol_buf[idx] = vec4<f32>(0.0);
    j_buf[idx] = vec4<f32>(0.0);
  }

  let e_scatt = e_new - ei_new;
  e_tot[idx] = vec4<f32>(clamp(e_new, vec3<f32>(-8.0), vec3<f32>(8.0)), length(e_scatt));
  e_inc[idx] = vec4<f32>(clamp(ei_new, vec3<f32>(-8.0), vec3<f32>(8.0)), 0.0);
}

// Pass 3: Compact Fixed-Size GPU Telemetry Reduction (Zero Full-Volume Readback!)
// Reduces 8 exact 3D physical quantities into obs_out[0..7] via fixed-point atomics:
//   [0] total incident energy sum |E_inc|^2
//   [1] total 3D scattered energy sum |E_scatt|^2
//   [2] total lobe absorbed energy sum (E·J accum)
//   [3] weighted excited population sum (chi * rho11)
//   [4] polar scattering energy (|y| > |z| shell -> proves 3D angular pattern!)
//   [5] equatorial scattering energy (|z| >= |y| shell)
//   [6] cross-polarized scattered energy (|E_scatt_x|^2 + |E_scatt_perp|^2)
//   [7] total susceptibility weight sum (chi)
@group(0) @binding(9) var<storage, read_write> obs_atomic: array<atomic<u32>>;

@compute @workgroup_size(64)
fn reduce_obs_3d(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = fp.grid_n;
  let tot = n * n * n;
  let idx = gid.x;
  if (idx >= tot) { return; }

  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix < 4u || ix >= n - 4u || iy < 4u || iy >= n - 4u || iz < 4u || iz >= n - 4u) { return; }

  let et = e_tot[idx];
  let ei = e_inc[idx].xyz;
  let es = et.xyz - ei;
  let es2 = dot(es, es);
  let ei2 = dot(ei, ei);
  let chi = chi_buf[idx].x;
  let rho11 = pol_buf[idx].w;
  let abs_e = j_buf[idx].w;

  let scale = 1024.0;
  if (ei2 > 1e-6) {
    atomicAdd(&obs_atomic[0], u32(min(50000.0, ei2 * scale)));
  }
  if (es2 > 1e-6) {
    atomicAdd(&obs_atomic[1], u32(min(50000.0, es2 * scale)));
    let dy = abs(f32(iy) + 0.5 - 0.5 * f32(n));
    let dz = abs(f32(iz) + 0.5 - 0.5 * f32(n));
    if (dy > dz) {
      atomicAdd(&obs_atomic[4], u32(min(50000.0, es2 * scale)));
    } else {
      atomicAdd(&obs_atomic[5], u32(min(50000.0, es2 * scale)));
    }
    // Cross-polarized scattered energy (proves true 3D orbital tensor coupling!)
    let cross2 = select(
      es.x * es.x + es.y * es.y,
      es.x * es.x + es.z * es.z,
      fp.pol_mode == 0u
    );
    if (cross2 > 1e-6) {
      atomicAdd(&obs_atomic[6], u32(min(50000.0, cross2 * scale)));
    }
  }
  if (abs_e > 1e-6) {
    atomicAdd(&obs_atomic[2], u32(min(50000.0, abs_e * scale)));
  }
  if (chi > 1e-4) {
    atomicAdd(&obs_atomic[3], u32(min(50000.0, chi * rho11 * scale)));
    atomicAdd(&obs_atomic[7], u32(min(50000.0, chi * scale)));
  }
}
`,Ut=new WeakMap;function Wt(e){let t=Ut.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-atom-tdks-3d`,code:Ht});return t={chiPipe:e.createComputePipeline({label:`ulg-atom-tdks-3d-chi`,layout:`auto`,compute:{module:n,entryPoint:`build_orbital_chi_3d`}}),hPipe:e.createComputePipeline({label:`ulg-atom-tdks-3d-h`,layout:`auto`,compute:{module:n,entryPoint:`step_h_3d`}}),ePipe:e.createComputePipeline({label:`ulg-atom-tdks-3d-e`,layout:`auto`,compute:{module:n,entryPoint:`step_e_pol_3d`}}),obsPipe:e.createComputePipeline({label:`ulg-atom-tdks-3d-obs`,layout:`auto`,compute:{module:n,entryPoint:`reduce_obs_3d`}})},Ut.set(e,t),t}function Gt(e,t={},{Z:n=79,n0:r=5,l0:i=2,n1:a=6,l1:o=1,m:s=0,rGrid:c=null,u0:l=null,u1:u=null,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,gridN:p=32,probeWavelengthNm:m=440,polMode:h=0,modeMono:g=!1}={}){let _=Math.max(16,Math.min(48,Math.trunc(p))),v=_*_*_,y=v*16,b=1.05,{chiPipe:x,hPipe:S,ePipe:C,obsPipe:w}=Wt(e),T=e.createBuffer({size:32,usage:M.UNIFORM|M.COPY_DST}),E=e.createBuffer({size:jt*16,usage:M.STORAGE|M.COPY_DST}),D=e.createBuffer({size:Mt*16,usage:M.STORAGE|M.COPY_DST}),O=e.createBuffer({size:64,usage:M.UNIFORM|M.COPY_DST}),k=e.createBuffer({label:`ulg-tdks3d-chi`,size:y,usage:M.STORAGE|M.COPY_DST}),A=e.createBuffer({label:`ulg-tdks3d-axis`,size:y,usage:M.STORAGE|M.COPY_DST}),ee=e.createBuffer({label:`ulg-tdks3d-etot`,size:y,usage:M.STORAGE|M.COPY_DST}),te=e.createBuffer({label:`ulg-tdks3d-htot`,size:y,usage:M.STORAGE|M.COPY_DST}),ne=e.createBuffer({label:`ulg-tdks3d-einc`,size:y,usage:M.STORAGE|M.COPY_DST}),j=e.createBuffer({label:`ulg-tdks3d-hinc`,size:y,usage:M.STORAGE|M.COPY_DST}),re=e.createBuffer({label:`ulg-tdks3d-pol`,size:y,usage:M.STORAGE|M.COPY_DST}),ie=e.createBuffer({label:`ulg-tdks3d-j`,size:y,usage:M.STORAGE|M.COPY_DST}),ae=e.createBuffer({size:32,usage:M.STORAGE|M.COPY_SRC|M.COPY_DST}),oe=e.createBuffer({size:32,usage:M.MAP_READ|M.COPY_DST}),se=new Float32Array(v*4),ce=new Uint32Array(8),le=e.createBindGroup({layout:x.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:E}},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:k}},{binding:4,resource:{buffer:A}}]}),ue=e.createBindGroup({layout:S.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:k}},{binding:3,resource:{buffer:ee}},{binding:4,resource:{buffer:te}},{binding:5,resource:{buffer:ne}},{binding:6,resource:{buffer:j}}]}),de=e.createBindGroup({layout:C.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:ee}},{binding:4,resource:{buffer:te}},{binding:5,resource:{buffer:ne}},{binding:6,resource:{buffer:j}},{binding:7,resource:{buffer:re}},{binding:8,resource:{buffer:ie}}]}),fe=e.createBindGroup({layout:w.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:k}},{binding:3,resource:{buffer:ee}},{binding:5,resource:{buffer:ne}},{binding:7,resource:{buffer:re}},{binding:8,resource:{buffer:ie}},{binding:9,resource:{buffer:ae}}]}),pe=4.6,me=.45,he=`Valence→Cond`,ge=Math.max(380,Math.min(780,Number(m)||440)),_e=Math.max(0,Math.min(2,Math.trunc(h))),ve=!!g,ye=0,be=null,xe=!1,Se={Z:n,n0:r,l0:i,n1:a,l1:o,m:s};function Ce(e){let t=!!e?.isMetal,n=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[];if(t&&n.length>0){let e=n.find(e=>e.energyEv>=2&&e.energyEv<=4.3)||n[0];pe=Math.max(.8,Number(e.energyEv)||3.1),me=Math.max(.24,Number(e.dampingEv)||.55),he=e.transitionLabel||`d→p`}else if(t){let t=Math.max(1.2,Math.min(8.5,Number(e?.plasmaEnergyEv)||4.5));pe=t,me=Math.max(.22,Math.min(1.1,(Number(e?.drudeDampingEv)||.25)*1.4)),he=`Plasma/Valence (${t.toFixed(2)} eV)`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.2);pe=Math.max(2.4,Math.min(6.5,t+1.1)),me=t<3.4?.38:.18,he=`Valence→Cond (${pe.toFixed(1)} eV)`}}Ce(t);function we(t={}){let n={Z:t.Z??Se.Z,n0:t.n0??Se.n0,l0:t.l0??Se.l0,n1:t.n1??Se.n1,l1:t.l1??Se.l1,m:t.m??Se.m,rGrid:t.rGrid===void 0?c:t.rGrid,u0:t.u0===void 0?l:t.u0,u1:t.u1===void 0?u:t.u1,screeningExchange:t.screeningExchange??d,relativisticSpinOrbit:t.relativisticSpinOrbit??f},r=Vt(n);Se={Z:n.Z,n0:r.n0,l0:r.l0,n1:r.n1,l1:r.l1,m:r.m};let i=new ArrayBuffer(32),a=new Uint32Array(i),o=new Int32Array(i),s=new Float32Array(i);a[0]=_>>>0,a[1]=jt>>>0,a[2]=Mt>>>0,a[3]=r.mAbs>>>0,o[4]=r.m,s[5]=2,s[6]=b,s[7]=1.85,e.queue.writeBuffer(T,0,i),e.queue.writeBuffer(E,0,r.radialTable),e.queue.writeBuffer(D,0,r.polarTable);let p=e.createCommandEncoder({label:`ulg-tdks3d-chi-enc`}),m=p.beginComputePass();return m.setPipeline(x),m.setBindGroup(0,le),m.dispatchWorkgroups(Math.ceil(v/64)),m.end(),e.queue.submit([p.finish()]),Se}function Te(){let t=e=>Math.max(.14,Math.min(.72,e*.142)),n=t(pe),r=Math.max(.025,Math.min(.28,me*.142)),i=t(Pt/ge),a=t(Pt/610),o=t(Pt/535),s=t(Pt/440),c=new ArrayBuffer(64),l=new Uint32Array(c),u=new Float32Array(c);l[0]=_>>>0,l[1]=ye>>>0,l[2]=_e>>>0,l[3]=+!!ve,u[4]=.4,u[5]=n,u[6]=r,u[7]=i,u[8]=a,u[9]=o,u[10]=s,u[11]=1.12,u[12]=18,u[13]=9.5,u[14]=1.95,u[15]=.36,e.queue.writeBuffer(O,0,c)}function Ee({nextProbeWavelengthNm:t=null,nextPolMode:n=null,nextModeMono:r=null}={}){xe||(t!=null&&(ge=Math.max(380,Math.min(780,Number(t)||440))),n!=null&&(_e=Math.max(0,Math.min(2,Math.trunc(n)))),r!=null&&(ve=!!r),ye=0,e.queue.writeBuffer(ee,0,se),e.queue.writeBuffer(te,0,se),e.queue.writeBuffer(ne,0,se),e.queue.writeBuffer(j,0,se),e.queue.writeBuffer(re,0,se),e.queue.writeBuffer(ie,0,se))}function De(t=1){if(xe)return;let n=Math.max(1,Math.min(64,Math.trunc(t))),r=Math.ceil(v/64);for(let t=0;t<n;t+=1){Te();let t=e.createCommandEncoder({label:`ulg-tdks3d-step`}),n=t.beginComputePass();n.setPipeline(S),n.setBindGroup(0,ue),n.dispatchWorkgroups(r),n.end();let i=t.beginComputePass();i.setPipeline(C),i.setBindGroup(0,de),i.dispatchWorkgroups(r),i.end(),e.queue.submit([t.finish()]),ye+=1}}async function Oe({nonBlocking:t=!1}={}){if(xe)return null;if(be){if(t)return null;try{await be}catch{}if(xe)return null}let n=(async()=>{Te(),e.queue.writeBuffer(ae,0,ce);let t=e.createCommandEncoder({label:`ulg-tdks3d-obs`}),n=t.beginComputePass();n.setPipeline(w),n.setBindGroup(0,fe),n.dispatchWorkgroups(Math.ceil(v/64)),n.end(),t.copyBufferToBuffer(ae,0,oe,0,32),e.queue.submit([t.finish()]),await oe.mapAsync(1);let r=new Uint32Array(oe.getMappedRange().slice(0));oe.unmap();let i=1/1024,a=r[0]*i,o=r[1]*i,s=r[2]*i,c=r[3]*i,l=r[4]*i,u=r[5]*i,d=r[6]*i,f=Math.max(1e-4,r[7]*i),p=Math.min(.98,c/f),m=o/Math.max(.001,a+o),h=(l-u)/Math.max(1e-5,l+u),g=d/Math.max(1e-5,o);return Object.freeze({schema:At,gridN:_,stepIndex:ye,polMode:_e,modeMono:ve,probeWavelengthNm:ge,transEv:pe,gammaEv:me,transLabel:he,orbital:{...Se},incEnergy:a,scattEnergy:o,absorbedEnergy:s,meanRho11:p,scattRatio:m,polarScatt:l,eqScatt:u,angularAnisotropy:h,crossPolFraction:g})})();be=n;try{return await n}finally{be===n&&(be=null)}}async function ke(e=16,{readObs:t=!0,nonBlocking:n=!1}={}){return De(e),t?Oe({nonBlocking:n}):null}function Ae(){if(!xe){xe=!0;for(let e of[T,E,D,O,k,A,ee,te,ne,j,re,ie,ae,oe])try{e.destroy()}catch{}}}return we(),Ee(),Object.freeze({schema:At,gridN:_,worldHalf:2,atomRadius:b,chiBuffer:k,axisBuffer:A,eFieldBuffer:ee,hFieldBuffer:te,eIncBuffer:ne,polBuffer:re,jBuffer:ie,getStepIndex:()=>ye,getPolMode:()=>_e,getModeMono:()=>ve,getOrbitalMeta:()=>({...Se}),getTransEv:()=>pe,getTransLabel:()=>he,rebuildOrbitalSusceptibility:we,resetPulse:Ee,stepSync:De,stepBatch:ke,readTelemetry:Oe,destroy:Ae})}function Kt(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`quantum-tdks-maxwell3d`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/atomTdks3dWebGpu.js`,entryPoint:`step_e_pol_3d`,workgroupSize:64,wgsl:Ht},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n0:{type:`number`,min:1,max:8},l0:{type:`number`,min:0,max:7},m:{type:`number`,min:-7,max:7},gridN:{type:`number`,min:16,max:48},probeWavelengthNm:{type:`number`,min:380,max:780},polMode:{type:`number`,min:0,max:2}},stateLayout:{tensorId:`tdks_3d_maxwell_fields_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-maxwell3d@1 requires a WebGPU device`);let r=e?.parameters||{},i=Gt(n,r.electromagnetic||{},r);try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??36,{readObs:!0})}}finally{i.destroy()}}})}async function qt({closureRegistry:e,materialKey:t,telemetry:n}={}){return!e||!n?null:e.register({family:`quantum-tdks-maxwell3d`,key:`${t||`atom`}:n${n.orbital?.n0||1}l${n.orbital?.l0||0}m${n.orbital?.m||0}`,schema:At,scientificValidation:!1,accuracyTier:`tier-2-representative-effective`,payload:n})}var Jt=`ulg.magnetic.spin-lattice-llg-webgpu.v1`,Yt=8617333262e-14,Xt=5788381806e-14,Zt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function Qt(e={},t={}){let n=String(e?.magneticPhase||`diamagnetic`),r=Math.max(4,Math.min(12,Number(t?.coordinationNumber)||6)),i=Number(e?.magneticMomentMuB)||0,a=Math.max(0,Number(e?.curieOrNeelTempK)||0),o=Number(e?.magneticSusceptibilitySi)||-1e-5,s=Number(e?.stonerProduct)||0,c=0,l=Math.max(.5,i),u=0,d=1;n===`ferromagnetic`?(c=.693*Yt*Math.max(25,a||500),l=Math.max(.6,i||2),u=.08*c):n===`antiferromagnetic`?(c=-.693*Yt*Math.max(25,a||180),l=Math.max(.6,i||1.2),u=.055*Math.abs(c)):n===`paramagnetic`?(c=0,l=Math.max(1,i||1.73),u=0):(c=0,l=.35,u=0,d=-1);let f=Math.max(.008,Math.abs(c),l*Xt*5);return Object.freeze({magneticPhase:n,exchangeJEv:c,momentMuB:l,anisotropyEv:u,diamagneticSign:d,curieOrNeelTempK:a,stonerProduct:s,magneticSusceptibilitySi:o,coordinationNumber:r,refEnergyEv:f})}var $t=`
struct SpinParams {
  // x=nx, y=ny, z=nz, w=step_index
  dims: vec4<u32>,
  // x=j_over_eref, y=k_anis_over_eref, z=bz_mu_over_eref, w=temp_over_eref
  ham: vec4<f32>,
  // x=alpha_damping, y=dt_dimless, z=dia_sign (+1 or -1), w=collect_obs (0/1)
  ctrl: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: SpinParams;
// spins: vec4(sx, sy, sz, local_energy_norm)
@group(0) @binding(1) var<storage, read> spins_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> spins_out: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_mx, [1]=sum_my, [2]=sum_mz, [3]=sum_stag_x, [4]=sum_stag_y, [5]=sum_stag_z,
// [6]=sum_energy, [7]=sum_domain_align
@group(0) @binding(3) var<storage, read_write> obs: array<atomic<i32>>;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return v;
}

fn rand_normal_pair(seed0: u32, seed1: u32) -> vec2<f32> {
  let u1 = max(1.0e-5, f32(hash_u32(seed0) & 0x00ffffffu) / 16777216.0);
  let u2 = f32(hash_u32(seed1) & 0x00ffffffu) / 16777216.0;
  let r = sqrt(-2.0 * log(u1));
  let th = 6.283185307 * u2;
  return vec2<f32>(r * cos(th), r * sin(th));
}

fn idx3(x: u32, y: u32, z: u32) -> u32 {
  return (z * p.dims.y + y) * p.dims.x + x;
}

fn llg_rhs(s: vec3<f32>, h: vec3<f32>, alpha: f32) -> vec3<f32> {
  let sxh = cross(s, h);
  let sx_sxh = cross(s, sxh);
  return -(sxh + alpha * sx_sxh) / (1.0 + alpha * alpha);
}

@compute @workgroup_size(64)
fn reset_spin_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_spin_llg(@builtin(global_invocation_id) gid: vec3<u32>) {
  let nx = p.dims.x;
  let ny = p.dims.y;
  let nz = p.dims.z;
  let n_tot = nx * ny * nz;
  let idx = gid.x;
  if (idx >= n_tot) { return; }

  let x = idx % nx;
  let y = (idx / nx) % ny;
  let z = idx / (nx * ny);

  let xm = (x + nx - 1u) % nx;
  let xp = (x + 1u) % nx;
  let ym = (y + ny - 1u) % ny;
  let yp = (y + 1u) % ny;
  let zm = (z + nz - 1u) % nz;
  let zp = (z + 1u) % nz;

  let s0 = normalize(spins_in[idx].xyz);
  let sum_nn =
    spins_in[idx3(xm, y, z)].xyz + spins_in[idx3(xp, y, z)].xyz +
    spins_in[idx3(x, ym, z)].xyz + spins_in[idx3(x, yp, z)].xyz +
    spins_in[idx3(x, y, zm)].xyz + spins_in[idx3(x, y, zp)].xyz;

  // Stochastic thermal Langevin field satisfying Fluctuation-Dissipation Theorem:
  //   Var(h_th) = 2 * alpha * (k_B T / E_ref) / dt
  let step_i = p.dims.w;
  let base_seed = ((idx + 1u) * 747796405u) ^ ((step_i + 1u) * 2891336453u);
  let g01 = rand_normal_pair(base_seed, base_seed + 17u);
  let g23 = rand_normal_pair(base_seed + 31u, base_seed + 53u);
  let alpha = p.ctrl.x;
  let dt = p.ctrl.y;
  let temp_norm = max(0.0, p.ham.w);
  let sigma_th = sqrt(max(0.0, (2.0 * alpha * temp_norm) / max(1.0e-4, dt)));
  let h_th = vec3<f32>(g01.x, g01.y, g23.x) * sigma_th;

  let j_n = p.ham.x;
  let k_anis = p.ham.y;
  // External Zeeman field along Z (+ 4.5-degree polycrystal canting so unstable collinear poles nucleate domain reversal!)
  let bz_eff = p.ham.z * p.ctrl.z;
  let b_vec = vec3<f32>(bz_eff * 0.08, 0.0, bz_eff);

  // Predictor-corrector (Heun) sLLG step preserving |s_i| = 1 strictly
  let h0 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s0.z) + h_th;
  let k1 = llg_rhs(s0, h0, alpha);
  let s_pred = normalize(s0 + dt * k1);

  let h1 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s_pred.z) + h_th;
  let k2 = llg_rhs(s_pred, h1, alpha);
  let s_next = normalize(s0 + 0.5 * dt * (k1 + k2));

  // Local dimensionless Heisenberg + Zeeman energy per spin
  let e_loc = -0.5 * j_n * dot(s_next, sum_nn) - dot(s_next, b_vec) - k_anis * s_next.z * s_next.z;
  let align = dot(s_next, sum_nn) / 6.0;
  spins_out[idx] = vec4<f32>(s_next, align);

  if (p.ctrl.w > 0.5) {
    let parity = select(-1.0, 1.0, ((x + y + z) & 1u) == 0u);
    atomicAdd(&obs[0], i32(clamp(s_next.x * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[1], i32(clamp(s_next.y * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[2], i32(clamp(s_next.z * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[3], i32(clamp(s_next.x * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[4], i32(clamp(s_next.y * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[5], i32(clamp(s_next.z * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[6], i32(clamp(e_loc * 1.0e4, -2.0e7, 2.0e7)));
    atomicAdd(&obs[7], i32(clamp(align * 1.0e4, -2.0e6, 2.0e6)));
  }
}
`,en=new WeakMap;function tn(e){let t=en.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-spin-llg-wgsl`,code:$t}),r=e.createBindGroupLayout({label:`ulg-spin-llg-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,resetPipe:e.createComputePipeline({label:`ulg-spin-reset-obs`,layout:i,compute:{module:n,entryPoint:`reset_spin_obs`}}),stepPipe:e.createComputePipeline({label:`ulg-spin-step-llg`,layout:i,compute:{module:n,entryPoint:`step_spin_llg`}})},en.set(e,t),t}function nn(e,t={},n={},{nx:r=10,ny:i=10,nz:a=10,temperatureK:o=300,fieldBZTesla:s=0,alphaDamping:c=.5,seed:l=1337}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createSpinLatticeSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:u,resetPipe:d,stepPipe:f}=tn(e),p=Qt(t,n),m=r*i*a,h=m*16,g=e.createBuffer({label:`ulg-spin-buf-a`,size:h,usage:Zt.STORAGE|Zt.COPY_DST|Zt.COPY_SRC}),_=e.createBuffer({label:`ulg-spin-buf-b`,size:h,usage:Zt.STORAGE|Zt.COPY_DST|Zt.COPY_SRC}),v=e.createBuffer({label:`ulg-spin-obs`,size:32,usage:Zt.STORAGE|Zt.COPY_SRC}),y=e.createBuffer({label:`ulg-spin-obs-read`,size:32,usage:Zt.MAP_READ|Zt.COPY_DST}),b=Array.from({length:24},()=>e.createBuffer({size:48,usage:Zt.UNIFORM|Zt.COPY_DST})),x=b.map(t=>e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}}]})),S=b.map(t=>e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:g}},{binding:3,resource:{buffer:v}}]})),C=0,w=0,T=Math.max(1,Number(o)||300),E=Number(s)||0,D=null,O=!1;function k({orderedBias:t=0,initSeed:n=l}={}){let r=new Float32Array(m*4),i=n>>>0||1,a=()=>(i=Math.imul(1664525,i)+1013904223>>>0,i/4294967296);for(let e=0;e<m;e+=1){let n=2*a()-1+t,i=2*Math.PI*a(),o=Math.sqrt(Math.max(.01,1-Math.max(-.98,Math.min(.98,n))**2)),s=o*Math.cos(i),c=o*Math.sin(i),l=Math.max(-.99,Math.min(.99,n)),u=1/Math.hypot(s,c,l);r[e*4+0]=s*u,r[e*4+1]=c*u,r[e*4+2]=l*u,r[e*4+3]=0}e.queue.writeBuffer(g,0,r),e.queue.writeBuffer(_,0,r),C=0,w=0}k({orderedBias:p.magneticPhase===`ferromagnetic`?.35:0});function A(t,n,o,s=1){let l=Math.max(.05,Math.min(1,Number(s)||1)),u=p.refEnergyEv,d=p.exchangeJEv/u,f=p.anisotropyEv/u,m=p.magneticPhase===`ferromagnetic`||p.magneticPhase===`antiferromagnetic`?Math.max(Xt*p.momentMuB,.62*Math.abs(p.exchangeJEv)):Math.max(Xt*p.momentMuB*40,.004),h=E*m/u,g=Yt*T/u,_=Math.max(1,6*Math.abs(d)+Math.abs(h)+2*Math.abs(f)),v=Math.min(.095,.26/_)*l,y=new ArrayBuffer(48);new Uint32Array(y,0,4).set([r,i,a,n>>>0]),new Float32Array(y,16,4).set([d,f,h,g]),new Float32Array(y,32,4).set([c,v,p.diamagneticSign,+!!o]),e.queue.writeBuffer(t,0,y)}function ee(t=8,{temperatureK:n=null,fieldBZTesla:r=null,collectObsOnLast:i=!1,dtScale:a=1}={}){if(O)return;n!=null&&Number.isFinite(Number(n))&&(T=Math.max(1,Number(n))),r!=null&&Number.isFinite(Number(r))&&(E=Number(r));let o=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<o;e+=1)A(b[e],w+e,i&&e===o-1,a);let s=Math.ceil(m/64),c=e.createCommandEncoder({label:`ulg-spin-llg-batch`}),l=c.beginComputePass({label:`ulg-spin-llg-pass`});for(let e=0;e<o;e+=1){let t=C===0?x[e]:S[e];i&&e===o-1&&(l.setPipeline(d),l.setBindGroup(0,t),l.dispatchWorkgroups(1)),l.setPipeline(f),l.setBindGroup(0,t),l.dispatchWorkgroups(s),C^=1}l.end(),e.queue.submit([c.finish()]),w+=o}async function te({nonBlocking:t=!1}={}){if(O)return null;if(D){if(t)return null;try{await D}catch{}if(O)return null}let n=(async()=>{if(O)return null;let t=e.createCommandEncoder({label:`ulg-spin-read-obs`});if(t.copyBufferToBuffer(v,0,y,0,32),e.queue.submit([t.finish()]),await y.mapAsync(Zt.MAP_READ),O){try{y.unmap()}catch{}return null}let n=new Int32Array(y.getMappedRange().slice(0,32));y.unmap();let o=1/(m*1e4),s=n[0]*o,c=n[1]*o,l=n[2]*o,u=Math.hypot(s,c,l),d=n[3]*o,f=n[4]*o,h=n[5]*o,g=Math.hypot(d,f,h),_=n[6]*o*p.refEnergyEv,b=n[7]*o,x=p.diamagneticSign<0?l*Math.min(.25,Math.abs(E)*.04):l;return Object.freeze({schema:Jt,stepIndex:w,spinCount:m,dims:Object.freeze([r,i,a]),magneticPhase:p.magneticPhase,temperatureK:T,fieldBZTesla:E,curieOrNeelTempK:p.curieOrNeelTempK,exchangeJEv:p.exchangeJEv,momentMuB:p.momentMuB,magnetizationVec:Object.freeze([s,c,x]),magnetizationZ:x,magnetizationMag:p.diamagneticSign<0?Math.abs(x):u,staggeredOrderMag:g,neighborAlign:b,energyPerSpinEv:_})})();D=n;try{return await n}finally{D===n&&(D=null)}}async function ne(e=16,{temperatureK:t=null,fieldBZTesla:n=null,readObs:r=!0,nonBlocking:i=!1,dtScale:a=1}={}){let o=Math.max(1,Math.trunc(e));for(;o>0;){let e=Math.min(24,o);ee(e,{temperatureK:t,fieldBZTesla:n,collectObsOnLast:r&&o===e,dtScale:a}),o-=e}return r?te({nonBlocking:i}):null}function j(){O=!0;for(let e of[g,_,v,y,...b])try{e.destroy()}catch{}}return Object.freeze({schema:Jt,dims:Object.freeze([r,i,a]),spinCount:m,params:p,getActiveSpinsBuffer:()=>C===0?g:_,getStepIndex:()=>w,getTemperatureK:()=>T,getFieldBZTesla:()=>E,resetDomains:(e={})=>k(e),stepSync:ee,stepBatch:ne,readTelemetry:te,destroy:j})}async function rn({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},mechanical:r={},telemetry:i=null}={}){let a=Qt(n,r),o={closureId:`ulg-spin-lattice-llg:${t}.v1`,closureKind:`magnetic-spin-lattice-llg`,inputHash:`${t}:phase=${a.magneticPhase}:J=${a.exchangeJEv.toFixed(5)}:mu=${a.momentMuB.toFixed(2)}`,methodHash:`stochastic-llg-heun-3d-webgpu.v1`,execution:{mode:`webgpu-3d-sllg`,params:a,telemetry:i},validity:{temperatureK:[1,1e4],fieldTesla:[-20,20]},provenance:{schema:Jt,sourceModule:`src/runtime/material/spinLatticeMagnetismWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function an(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`spin-lattice-llg`,version:`1`},kernel:{sourceModule:`src/runtime/material/spinLatticeMagnetismWebGpu.js`,entryPoint:`step_spin_llg`,workgroupSize:64,wgsl:$t},parameterSchema:{temperatureK:{type:`number`,min:1,max:1e4},fieldBZTesla:{type:`number`,min:-20,max:20},steps:{type:`number`,min:1,max:4096}},stateLayout:{tensorId:`spin_lattice_3d_unit_vectors`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`spin-lattice-llg@1 requires a WebGPU device`);let r=e?.parameters||{},i=nn(n,r.electromagnetic||{},r.mechanical||{},{temperatureK:r.temperatureK??300,fieldBZTesla:r.fieldBZTesla??0});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??64,{readObs:!0})}}finally{i.destroy()}}})}var on=`ulg.electromagnetic.electron-transport-webgpu.v1`,sn=1602176634e-28,cn=91093837015e-41,ln=1054571817e-43,un=1380649e-29,dn=1602176634e-28,fn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function pn(e={},t={},{temperatureK:n=300,eFieldVPerM:r=1e4}={}){let i=Math.max(.5,Number(n)||300),a=!!e?.isMetal,o=Math.max(0,Number(e?.bandGapEv)||0),s=Math.max(25,Number(t?.debyeTemperatureK)||250),c=Math.max(0,Number(e?.superconductingTcK)||0),l=Math.max(.05,Number(e?.dosAtFermiStatesPerEvAtom)||.5),u=Math.max(0,Number(e?.plasmaEnergyEv)||(a?8.5:0)),d=Math.max(1e-18,Number(e?.electricalConductivitySPerM)||(a?1e7:1e-6)),f=u*dn/ln,p=a?Math.max(1e27,88541878128e-22*cn*f*f/(sn*sn)):0,m=a?Math.max(.08,Math.min(1.8,.14+.16*l*(300/s))):.25,h=i/s,g=h>=.4?1:(h/.4)**4,_=2*Math.PI*m*un*i/ln*g,v=2e11,y=a&&c>.05&&i<c,b=y?Math.max(.05,1-(i/c)**4):0,x=1,S=p;if(!a){let e=o*dn,t=2*(cn*un*i/(2*Math.PI*ln*ln))**1.5;S=Math.max(1e8,t*Math.exp(-e/(2*un*i)));let n=Math.exp(-o/Math.max(.06,8617333e-11*i*14));x=Math.max(0,Math.min(1,n))}let C=y?(1-b)*(_+v):_+v,w=y?0:Math.max(.004,Math.min(.65,C/0xec77f7a44000)),T=Math.min(.22,.018*Math.sqrt(i/Math.max(25,s))),E=d;if(y)E=1/0;else if(a)E=p*sn*sn/(cn*Math.max(1e11,C));else{let e=.05*(300/Math.max(10,i))**1.5;E=Math.max(1e-18,S*sn*e)}return Object.freeze({isMetal:a,isSuperconducting:y,cooperFraction:b,bandGapEv:o,debyeTempK:s,superconductingTcK:c,temperatureK:i,eFieldVPerM:Number(r)||0,nCarrierM3:S,activeCarrierFraction:x,lambdaEp:m,totalScatterHz:C,scatterProbStep:w,phononVibAmp:T,analyticSigmaSPerM:E,analyticResistivityOhmM:y?0:1/Math.max(1e-20,E)})}var mn=`
struct TransportParams {
  // x=carrier_count, y=step_index, z=is_metal (0/1), w=collect_obs (0/1)
  counts: vec4<u32>,
  // x=e_accel (unit/step), y=scatter_prob, z=v_thermal, w=cooper_fraction
  phys: vec4<f32>,
  // x=active_carrier_frac, y=phonon_vib_amp, z=dt_step, w=0
  env: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: TransportParams;
// pos: xyz in [-1, 1]^3, w = carrier_type (-1 = electron, +1 = hole, -2 = Cooper pair, 0 = bound valence)
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (box-units/step), w = scatter_flash [0..1] (decays after phonon collision!)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_jx (current density -q*vx), [1]=sum_speed, [2]=scatter_events, [3]=mobile_count, [4]=cooper_count
@group(0) @binding(3) var<storage, read_write> obs: array<atomic<i32>>;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return v;
}

fn rand01(seed: u32) -> f32 {
  return f32(hash_u32(seed) & 0x00ffffffu) / 16777216.0;
}

@compute @workgroup_size(64)
fn reset_transport_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_electron_transport(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.counts.x;
  if (i >= n) { return; }

  let step_i = p.counts.y;
  let seed = ((i + 1u) * 2654435761u) ^ ((step_i + 1u) * 2246822519u);
  let r0 = rand01(seed);
  let r1 = rand01(seed + 13u);
  let r2 = rand01(seed + 29u);
  let r3 = rand01(seed + 47u);

  var p4 = pos[i];
  var v4 = vel[i];
  let frac_i = (f32(i) + 0.5) / f32(n);

  // Classify carrier strictly from active physics (metal / superconductor / thermally activated semiconductor)
  var ctype = -1.0; // mobile conduction electron (q = -1)
  if (p.counts.z == 1u) {
    if (frac_i < p.phys.w) {
      ctype = -2.0; // superconducting Cooper pair (lossless condensate)
    } else {
      ctype = -1.0; // normal Drude electron
    }
  } else {
    if (frac_i < p.env.x) {
      // Equal electron (-1) and hole (+1) pairs excited across band gap E_g!
      ctype = select(1.0, -1.0, (i & 1u) == 0u);
    } else {
      ctype = 0.0; // bound valence electron oscillating near lattice site
    }
  }

  let dt = p.env.z;
  var flash = max(0.0, v4.w - 0.10);
  var scattered = 0i;

  if (ctype == 0.0) {
    // Bound valence state: damped thermal jitter around home lattice node, zero net drift
    let jitter = (vec3<f32>(r0, r1, r2) - 0.5) * 0.015 * max(0.1, p.env.y * 5.0);
    v4 = vec4<f32>(jitter, 0.0);
    p4 = vec4<f32>(p4.xyz, 0.0);
  } else if (ctype < -1.5) {
    // Superconducting Cooper pair: ballistic zero-scattering supercurrent along -E (capped at critical velocity v_c)
    let a_sc = -p.phys.x * 1.4;
    var vx = clamp(v4.x + a_sc * dt, -0.58, 0.58);
    // Smooth phase coherence: transverse thermal momentum damps to coherent condensate flow
    let vy = v4.y * 0.88;
    let vz = v4.z * 0.88;
    v4 = vec4<f32>(vx, vy, vz, 0.0);
    var np = p4.xyz + v4.xyz * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
  } else {
    // Normal Drude-Boltzmann carrier (electron q=-1 or hole q=+1): accelerate under E, scatter off phonons!
    let q_sign = select(-1.0, 1.0, ctype > 0.0);
    var v_new = v4.xyz + vec3<f32>(q_sign * p.phys.x * dt, 0.0, 0.0);
    // Soft Fermi/saturation ceiling keeps numeric velocity bounded under strong E
    v_new = clamp(v_new, vec3<f32>(-0.95), vec3<f32>(0.95));

    if (r0 < p.phys.y) {
      // Phonon scattering collision: randomize direction onto isotropic thermal sphere of radius v_thermal!
      let cos_t = 2.0 * r1 - 1.0;
      let sin_t = sqrt(max(0.0, 1.0 - cos_t * cos_t));
      let phi = 6.283185307 * r2;
      let v_mag = p.phys.z * (0.65 + 0.7 * r3);
      v_new = vec3<f32>(sin_t * cos(phi), sin_t * sin(phi), cos_t) * v_mag;
      flash = 1.0;
      scattered = 1i;
    }

    var np = p4.xyz + v_new * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
    v4 = vec4<f32>(v_new, flash);
  }

  pos[i] = p4;
  vel[i] = v4;

  if (p.counts.w != 0u) {
    if (ctype != 0.0) {
      let q_s = select(-1.0, 1.0, ctype > 0.0);
      // Electric current contribution J_x = q * v_x (electrons drift along -E => q*v_x > 0 for E > 0!)
      let jx = q_s * v4.x;
      atomicAdd(&obs[0], i32(clamp(jx * 1.0e4, -2.0e6, 2.0e6)));
      atomicAdd(&obs[1], i32(clamp(length(v4.xyz) * 1.0e4, 0.0, 2.0e6)));
      atomicAdd(&obs[2], scattered);
      atomicAdd(&obs[3], 1i);
      if (ctype < -1.5) { atomicAdd(&obs[4], 1i); }
    }
  }
}
`,hn=new WeakMap;function gn(e){let t=hn.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-electron-transport-wgsl`,code:mn}),r=e.createBindGroupLayout({label:`ulg-electron-transport-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,resetPipe:e.createComputePipeline({label:`ulg-tr-reset-obs`,layout:i,compute:{module:n,entryPoint:`reset_transport_obs`}}),stepPipe:e.createComputePipeline({label:`ulg-tr-step`,layout:i,compute:{module:n,entryPoint:`step_electron_transport`}})},hn.set(e,t),t}function _n(e,t={},n={},{carrierCount:r=1024,temperatureK:i=300,eFieldVPerM:a=1e4,seed:o=4242}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createElectronTransportSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:s,resetPipe:c,stepPipe:l}=gn(e),u=Math.max(64,Math.min(4096,Math.trunc(r))),d=u*16,f=e.createBuffer({label:`ulg-tr-pos`,size:d,usage:fn.STORAGE|fn.COPY_DST|fn.COPY_SRC}),p=e.createBuffer({label:`ulg-tr-vel`,size:d,usage:fn.STORAGE|fn.COPY_DST|fn.COPY_SRC}),m=e.createBuffer({label:`ulg-tr-obs`,size:32,usage:fn.STORAGE|fn.COPY_SRC}),h=e.createBuffer({label:`ulg-tr-obs-read`,size:32,usage:fn.MAP_READ|fn.COPY_DST}),g=Array.from({length:16},()=>e.createBuffer({size:48,usage:fn.UNIFORM|fn.COPY_DST})),_=g.map(t=>e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:p}},{binding:3,resource:{buffer:m}}]})),v=Math.max(.5,Number(i)||300),y=Number(a)||1e4,b=pn(t,n,{temperatureK:v,eFieldVPerM:y}),x=0,S=null,C=!1;function w(t=o){let n=new Float32Array(u*4),r=new Float32Array(u*4),i=t>>>0||1,a=()=>(i=Math.imul(1664525,i)+1013904223>>>0,i/4294967296);for(let e=0;e<u;e+=1)n[e*4+0]=a()*2-1,n[e*4+1]=a()*2-1,n[e*4+2]=a()*2-1,n[e*4+3]=b.isMetal?-1:0,r[e*4+0]=(a()-.5)*.25,r[e*4+1]=(a()-.5)*.25,r[e*4+2]=(a()-.5)*.25,r[e*4+3]=0;e.queue.writeBuffer(f,0,n),e.queue.writeBuffer(p,0,r),x=0}w();function T(t,n,r,i=1){let a=Math.max(.05,Math.min(1,Number(i)||1)),o=.16*Math.max(-2.5,Math.min(2.5,y/1e4)),s=Math.max(.05,Math.min(.45,.14*Math.sqrt(v/300))),c=1-Math.max(0,1-b.scatterProbStep)**+a,l=new ArrayBuffer(48);new Uint32Array(l,0,4).set([u,n>>>0,+!!b.isMetal,+!!r]),new Float32Array(l,16,4).set([o,c,s,b.cooperFraction]),new Float32Array(l,32,4).set([b.activeCarrierFraction,b.phononVibAmp,.28*a,0]),e.queue.writeBuffer(t,0,l)}function E(r=4,{temperatureK:i=null,eFieldVPerM:a=null,collectObsOnLast:o=!1,dtScale:s=1}={}){if(C)return;let d=!1;i!=null&&Number.isFinite(Number(i))&&(v=Math.max(.5,Number(i)),d=!0),a!=null&&Number.isFinite(Number(a))&&(y=Number(a),d=!0),d&&(b=pn(t,n,{temperatureK:v,eFieldVPerM:y}));let f=Math.max(1,Math.min(16,Math.trunc(r)));for(let e=0;e<f;e+=1)T(g[e],x+e,o&&e===f-1,s);let p=Math.ceil(u/64),m=e.createCommandEncoder({label:`ulg-tr-batch`}),h=m.beginComputePass({label:`ulg-tr-pass`});for(let e=0;e<f;e+=1){let t=_[e];o&&e===f-1&&(h.setPipeline(c),h.setBindGroup(0,t),h.dispatchWorkgroups(1)),h.setPipeline(l),h.setBindGroup(0,t),h.dispatchWorkgroups(p)}h.end(),e.queue.submit([m.finish()]),x+=f}async function D({nonBlocking:t=!1}={}){if(C)return null;if(S){if(t)return null;try{await S}catch{}if(C)return null}let n=(async()=>{if(C)return null;let t=e.createCommandEncoder({label:`ulg-tr-read-obs`});if(t.copyBufferToBuffer(m,0,h,0,32),e.queue.submit([t.finish()]),await h.mapAsync(fn.MAP_READ),C){try{h.unmap()}catch{}return null}let n=new Int32Array(h.getMappedRange().slice(0,32));h.unmap();let r=Math.max(0,n[3]),i=Math.max(0,n[4]),a=Math.max(0,n[2]),o=r>0?n[0]/1e4/r:0,s=n[0]/1e4/u,c=r>0?n[1]/1e4/r:0,l=r>0?a/r:0,d=Math.max(.05,Math.abs(y/1e4)),f=Math.abs(s)/(d*.25),p=b.isSuperconducting?1/0:b.isMetal?Math.max(1e3,b.analyticSigmaSPerM*Math.max(.35,Math.min(2.2,f*1.4+.45))):b.analyticSigmaSPerM*(r>0?Math.max(.4,Math.min(2,f*3+.5)):1);return Object.freeze({schema:on,stepIndex:x,carrierCount:u,mobileCount:r,cooperCount:i,scatterEvents:a,temperatureK:v,eFieldVPerM:y,isMetal:b.isMetal,isSuperconducting:b.isSuperconducting,superconductingTcK:b.superconductingTcK,bandGapEv:b.bandGapEv,phononVibAmp:b.phononVibAmp,avgCurrentPerCarrier:o,meanDriftNorm:s,meanSpeedNorm:c,measuredScatterRateFrac:l,sigmaGpuSPerM:p,resistivityGpuOhmM:b.isSuperconducting?0:1/Math.max(1e-20,p),analyticSigmaSPerM:b.analyticSigmaSPerM})})();S=n;try{return await n}finally{S===n&&(S=null)}}async function O(e=12,{temperatureK:t=null,eFieldVPerM:n=null,readObs:r=!0,nonBlocking:i=!1,dtScale:a=1}={}){let o=Math.max(1,Math.trunc(e));for(;o>0;){let e=Math.min(16,o);E(e,{temperatureK:t,eFieldVPerM:n,collectObsOnLast:r&&o===e,dtScale:a}),o-=e}return r?D({nonBlocking:i}):null}function k(){C=!0;for(let e of[f,p,m,h,...g])try{e.destroy()}catch{}}return Object.freeze({schema:on,carrierCount:u,posBuffer:f,velBuffer:p,getParams:()=>b,getStepIndex:()=>x,resetCarriers:w,stepSync:E,stepBatch:O,readTelemetry:D,destroy:k})}async function vn({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},mechanical:r={},telemetry:i=null}={}){let a=pn(n,r),o={closureId:`ulg-electron-transport:${t}.v1`,closureKind:`electrical-drude-boltzmann-transport`,inputHash:`${t}:metal=${+!!a.isMetal}:Tc=${a.superconductingTcK.toFixed(2)}:Eg=${a.bandGapEv.toFixed(2)}`,methodHash:`drude-boltzmann-phonon-bcs-webgpu.v1`,execution:{mode:`webgpu-3d-electron-transport`,params:a,telemetry:i},validity:{temperatureK:[.5,5e3],eFieldVPerM:[-1e6,1e6]},provenance:{schema:on,sourceModule:`src/runtime/material/electronTransportWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function yn(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`electron-transport-gpu`,version:`1`},kernel:{sourceModule:`src/runtime/material/electronTransportWebGpu.js`,entryPoint:`step_electron_transport`,workgroupSize:64,wgsl:mn},parameterSchema:{temperatureK:{type:`number`,min:.5,max:5e3},eFieldVPerM:{type:`number`,min:-1e6,max:1e6},steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`electron_transport_carriers_3d`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`electron-transport-gpu@1 requires a WebGPU device`);let r=e?.parameters||{},i=_n(n,r.electromagnetic||{},r.mechanical||{},{temperatureK:r.temperatureK??300,eFieldVPerM:r.eFieldVPerM??1e4});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48,{readObs:!0})}}finally{i.destroy()}}})}var N=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),bn=`
struct CompNucParams {
  dim: u32,
  site_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> params: CompNucParams;
// site_pos_r: vec4(x_unit, y_unit, z_unit, radius_unit)
@group(0) @binding(1) var<storage, read> site_pos_r: array<vec4<f32>>;
// site_meta: vec4(Z, N, skin_ratio, weight)
@group(0) @binding(2) var<storage, read> site_meta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn build_composite_nuclear_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  var accum_col = vec3<f32>(0.0);
  var accum_d = 0.0;
  let n_sites = params.site_count;
  for (var s = 0u; s < n_sites; s = s + 1u) {
    let pr = site_pos_r[s];
    let smeta = site_meta[s];
    let d = length(p - pr.xyz);
    let r0 = max(0.08, pr.w);
    let diff_a = max(0.025, r0 * 0.24);
    let rho_p = 1.0 / (1.0 + exp((d - r0) / diff_a));
    let rho_n = 1.0 / (1.0 + exp((d - r0 * smeta.z) / diff_a));
    let n_frac = smeta.y / max(1.0, smeta.x + smeta.y);
    let core_c = mix(vec3<f32>(1.0, 0.54, 0.24), vec3<f32>(0.32, 0.78, 1.0), clamp((rho_n - rho_p) * 3.0 + n_frac * 0.35, 0.0, 1.0));
    let w = max(rho_p, rho_n) * smeta.w;
    accum_col = accum_col + core_c * w;
    accum_d = accum_d + w;
  }
  let dens = clamp(accum_d, 0.0, 1.0);
  let col = select(vec3<f32>(0.0), accum_col / max(1.0e-5, accum_d), accum_d > 1.0e-5);
  vol_out[idx] = vec4<f32>(col, dens);
}
`,xn=`
${e}

struct ProbeParams {
  temperature_k: f32,
  pressure_pa: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: ProbeParams;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;
@group(0) @binding(2) var<storage, read_write> probe_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn probe_polytope_point(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x != 0u) { return; }
  probe_out[0u] = eval_polytope_atlas_2d(&polytope_atlas, params.temperature_k, params.pressure_pa);
}
`,Sn=`
struct AtomVolParams {
  dim: u32,
  n_grid: u32,
  valence_l: u32,
  unpaired_count: u32,
  r_max_bohr: f32,
  spin_fraction: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: AtomVolParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> rho_grid: array<f32>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

fn sample_radial_rho(rr: f32) -> f32 {
  let n = params.n_grid;
  if (n < 2u || rr >= r_grid[n - 1u]) { return 0.0; }
  if (rr <= r_grid[0u]) { return rho_grid[0u]; }
  var lo = 0u;
  var hi = n - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (r_grid[mid] < rr) { lo = mid; } else { hi = mid; }
  }
  let r0 = r_grid[lo];
  let r1 = max(r0 + 1e-6, r_grid[hi]);
  let t = clamp((rr - r0) / (r1 - r0), 0.0, 1.0);
  return mix(rho_grid[lo], rho_grid[hi], t);
}

fn angular_ylm_sq(dir: vec3<f32>, l: u32) -> f32 {
  let ct = dir.y;
  let st2 = max(0.0, 1.0 - ct * ct);
  let c2p = select(1.0, (dir.x * dir.x - dir.z * dir.z) / max(1e-5, st2), st2 > 1e-5);
  if (l == 0u) {
    return 1.0;
  } else if (l == 1u) {
    // p_z orbital lobe |Y_10|^2 ~ 3 cos^2(theta)
    return 0.25 + 2.25 * ct * ct;
  } else if (l == 2u) {
    // d_{z^2} / d_{x^2-y^2} hybrid valence lobe |Y_20|^2 + |Y_22|^2
    let d0 = (3.0 * ct * ct - 1.0);
    let d2 = st2 * c2p;
    return 0.22 + 0.55 * (d0 * d0) + 0.95 * (d2 * d2);
  }
  // f-shell octupolar |Y_30|^2
  let f0 = ct * (5.0 * ct * ct - 3.0);
  return 0.2 + 0.45 * f0 * f0;
}

@compute @workgroup_size(64)
fn build_atomic_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim) * 2.0 - 1.0) * params.r_max_bohr;
  let rr = length(p);
  let dir = p / max(1e-5, rr);
  let rho = max(0.0, sample_radial_rho(rr));
  let shell_prob = pow(clamp(4.0 * 3.14159265 * rr * rr * rho * 0.28, 0.0, 4.0), 0.55);
  let ang = angular_ylm_sq(dir, params.valence_l);
  let core_w = exp(-rr * 0.85);
  let valence_w = 1.0 - core_w;
  let total_d = clamp(shell_prob * (core_w + valence_w * ang * 0.72), 0.0, 1.0);

  // Spin density (rho_up - rho_down): positive lobes (amber/gold) vs negative spin-nodal phase (cyan)
  let spin_mag = clamp(params.spin_fraction * valence_w * shell_prob * ang * 1.15, 0.0, 1.0);
  let sign_lobe = select(1.0, sign(3.0 * dir.y * dir.y - 1.0), params.valence_l >= 2u);
  let r_col = clamp(0.18 * total_d + max(0.0, sign_lobe) * spin_mag * 0.95, 0.0, 1.0);
  let g_col = clamp(0.68 * total_d + spin_mag * 0.35, 0.0, 1.0);
  let b_col = clamp(0.98 * total_d + max(0.0, -sign_lobe) * spin_mag * 0.85, 0.0, 1.0);
  vol_out[idx] = vec4<f32>(r_col, g_col, b_col, total_d);
}
`,Cn=`
struct VolRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  dim: u32,
  channels: u32,
  mode_flags: u32, // bit 0: show Fermi isosurface contour
  pad0: u32,
  tint: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: VolRenderUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> scalar_data: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid];
  return out;
}

fn rotate_cam(v: vec3<f32>, yaw: f32, pitch: f32) -> vec3<f32> {
  let cp = cos(pitch); let sp = sin(pitch);
  let cy = cos(yaw); let sy = sin(yaw);
  let v1 = vec3<f32>(v.x, v.y * cp - v.z * sp, v.y * sp + v.z * cp);
  return vec3<f32>(v1.x * cy + v1.z * sy, v1.y, -v1.x * sy + v1.z * cy);
}

fn fetch_voxel(i: vec3<u32>) -> vec4<f32> {
  let dim = u.dim;
  let idx = (i.z * dim + i.y) * dim + i.x;
  if (u.channels == 4u) {
    return vol_data[idx];
  }
  let s = scalar_data[idx];
  // Contrast-stretched periodic Bloch charge peaks + sharp Fermi isosurface shell (never over-exposed!)
  let mod_s = pow(clamp((s - 0.12) / 0.88, 0.0, 1.0), 2.4);
  let iso = select(0.0, exp(-pow((s - 0.52) * 18.0, 2.0)), (u.mode_flags & 1u) != 0u);
  let col = mix(u.tint.rgb * (0.25 + 0.90 * mod_s), vec3<f32>(1.0, 0.84, 0.35), iso * 0.85);
  return vec4<f32>(col, clamp(mod_s * 0.24 + iso * 0.38, 0.0, 0.65));
}

fn sample_voxel(p_unit: vec3<f32>) -> vec4<f32> {
  let d = f32(u.dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(u.dim - 1u));
  let f = fract(g);
  let c000 = fetch_voxel(vec3<u32>(i0.x, i0.y, i0.z));
  let c100 = fetch_voxel(vec3<u32>(i1.x, i0.y, i0.z));
  let c010 = fetch_voxel(vec3<u32>(i0.x, i1.y, i0.z));
  let c110 = fetch_voxel(vec3<u32>(i1.x, i1.y, i0.z));
  let c001 = fetch_voxel(vec3<u32>(i0.x, i0.y, i1.z));
  let c101 = fetch_voxel(vec3<u32>(i1.x, i0.y, i1.z));
  let c011 = fetch_voxel(vec3<u32>(i0.x, i1.y, i1.z));
  let c111 = fetch_voxel(vec3<u32>(i1.x, i1.y, i1.z));
  let c00 = mix(c000, c100, f.x);
  let c10 = mix(c010, c110, f.x);
  let c01 = mix(c001, c101, f.x);
  let c11 = mix(c011, c111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

@fragment
fn fs_raymarch(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let inv_portrait = 1.0 / max(0.35, min(1.0, aspect));
  let ndc = vec2<f32>(in.uv.x * aspect, in.uv.y) * inv_portrait;
  let ro = rotate_cam(vec3<f32>(0.0, 0.0, 2.85), u.yaw, u.pitch);
  let rd = normalize(rotate_cam(normalize(vec3<f32>(ndc * 0.62, -1.0)), u.yaw, u.pitch));

  // Ray-box intersection against [-1, 1]^3
  let inv_rd = 1.0 / select(rd, vec3<f32>(1e-5), abs(rd) < vec3<f32>(1e-5));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(max(tmin_v.x, tmin_v.y), max(tmin_v.z, 0.0));
  let t_exit = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

  // Clean deep-space scientific lab backdrop
  let bg = vec3<f32>(0.020, 0.035, 0.067) + 0.022 * exp(-dot(ndc, ndc) * 1.4) * u.tint.rgb;
  if (t_exit <= t_enter) {
    return vec4<f32>(bg, 1.0);
  }

  let steps = 56u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum_rgb = vec3<f32>(0.0);
  var accum_a = 0.0;
  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_voxel(p);
    let alpha = clamp(v.w * dt * 2.1, 0.0, 0.92);
    let rem = 1.0 - accum_a;
    accum_rgb = accum_rgb + rem * v.rgb * alpha * 1.55;
    accum_a = accum_a + rem * alpha;
    if (accum_a > 0.985) { break; }
  }

  // Subtle bounding-box edge highlight at enter/exit planes
  let p_in = abs(ro + rd * t_enter);
  let edge_d = max(min(abs(1.0 - p_in.x), abs(1.0 - p_in.y)), min(abs(1.0 - p_in.y), abs(1.0 - p_in.z)));
  let box_wire = smoothstep(0.022, 0.0, edge_d) * 0.16;

  let final_rgb = accum_rgb + (1.0 - accum_a) * bg + vec3<f32>(0.34, 0.76, 1.0) * box_wire;
  return vec4<f32>(clamp(final_rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`,wn=`
struct AtomRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  box_l: vec4<f32>,        // (Lx, Ly, Lz, atomRadiusWorldA)
  ref_box_cam: vec4<f32>,  // (refLx, refLy, refLz, camDist)
  base_tint: vec4<f32>,    // (r, g, b, meltingTempK)
  render_cfg: vec4<f32>,   // (colorMode: 0=Temp 1=Phase/Coord 2=E_pot, eCohEv, wireMode: 0=live 1=refGhost, pad)
};

@group(0) @binding(0) var<uniform> u: AtomRenderUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> forces: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) view_z: f32,
  @location(3) view_rad: f32,
  @location(4) glow: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

fn world_to_view(p_norm: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.yaw); let sy = sin(u.yaw);
  let cp = cos(u.pitch); let sp = sin(u.pitch);
  let x1 = p_norm.x * cy - p_norm.z * sy;
  let z1 = p_norm.x * sy + p_norm.z * cy;
  let y2 = p_norm.y * cp - z1 * sp;
  let z2 = p_norm.y * sp + z1 * cp + max(1.65, u.ref_box_cam.w);
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_atom(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = positions[iid];
  let vel4 = velocities[iid];
  let f4 = forces[iid];
  let half_box = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let ref_half = max(half_box, u.ref_box_cam.xyz * 0.5);
  let norm_half = max(ref_half.x, max(ref_half.y, ref_half.z));
  let p_norm = (pos4.xyz - half_box) / norm_half;
  let view = world_to_view(p_norm);

  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let rad_world = u.box_l.w / norm_half;
  // Keep 100K-atom nanoscale spheres crisp without sub-pixel flicker or overdraw mush!
  let min_px_rad = (1.35 * max(0.5, view.z)) / max(1.0, min(u.resolution.x, u.resolution.y) * 0.5 * fov_scale);
  let rad = clamp(max(rad_world, min_px_rad), 0.004, 0.16);
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let rx = (rad * fov_scale) / max(0.35, view.z * aspect);
  let ry = (rad * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);

  let cmode = u32(round(u.render_cfg.x));
  var col = u.base_tint.rgb;
  var glow = 0.0;

  if (cmode == 1u) {
    // Emergent Structural Phase / First-Shell Coordination z_i / Z_ideal from GPU pos.w!
    let z_norm = clamp(pos4.w, 0.0, 1.25);
    let solid_c = mix(vec3<f32>(0.26, 0.72, 1.0), u.base_tint.rgb, 0.42);
    let liq_c = vec3<f32>(0.22, 0.88, 0.62);
    let surf_c = vec3<f32>(0.98, 0.74, 0.24);
    let vap_c = vec3<f32>(0.98, 0.42, 0.68);
    if (z_norm < 0.22) {
      col = vap_c;
      glow = 0.26;
    } else if (z_norm < 0.55) {
      col = mix(surf_c, liq_c, clamp((z_norm - 0.22) / 0.33, 0.0, 1.0));
      glow = 0.10;
    } else {
      col = mix(liq_c, solid_c, clamp((z_norm - 0.55) / 0.35, 0.0, 1.0));
      glow = 0.02;
    }
  } else if (cmode == 2u) {
    // Per-Atom Potential Energy / Local Strain Stress from GPU forcesBuffer.w!
    let e_scale = max(0.05, u.render_cfg.y);
    let u_rel = clamp(1.0 + f4.w / e_scale, 0.0, 1.4);
    let deep_c = vec3<f32>(0.22, 0.48, 0.96);
    let mid_c = vec3<f32>(0.22, 0.86, 0.72);
    let high_c = vec3<f32>(1.0, 0.48, 0.20);
    col = select(
      mix(deep_c, mid_c, clamp(u_rel * 1.4, 0.0, 1.0)),
      mix(mid_c, high_c, clamp((u_rel - 0.7) * 1.4, 0.0, 1.0)),
      u_rel > 0.7
    );
    glow = clamp((u_rel - 0.85) * 0.4, 0.0, 0.28);
  } else {
    // True Physical Per-Atom Kinetic Temperature T_i = m * v^2 / (3 k_B) normalized by T_m!
    let m_u = max(1.0, vel4.w);
    let v2 = dot(vel4.xyz, vel4.xyz);
    let t_atom_k = (m_u * v2) / (3.0 * 8.617333262e-5);
    let t_melt = max(25.0, u.base_tint.w);
    let heat = clamp(t_atom_k / (2.35 * t_melt), 0.0, 1.0);
    let cold_col = mix(vec3<f32>(0.28, 0.68, 1.0), u.base_tint.rgb, 0.52);
    let melt_col = vec3<f32>(1.0, 0.58, 0.18);
    let hot_col = vec3<f32>(1.0, 0.94, 0.64);
    col = select(
      mix(cold_col, melt_col, heat * 2.0),
      mix(melt_col, hot_col, (heat - 0.5) * 2.0),
      heat > 0.5
    );
    glow = clamp((heat - 0.62) * 0.55, 0.0, 0.28);
  }

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.view_z = view.z;
  out.view_rad = rad;
  out.glow = glow;
  return out;
}

@fragment
fn fs_atom(in: VsOut) -> FsOut {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let key_l = normalize(vec3<f32>(-0.42, 0.64, 0.64));
  let fill_l = normalize(vec3<f32>(0.62, -0.35, 0.55));
  let diff = max(0.16, dot(n, key_l)) + 0.18 * max(0.0, dot(n, fill_l));
  let half_v = normalize(key_l + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 34.0) * 0.68;
  let rim = pow(1.0 - nz, 2.4) * (0.26 + in.glow * 0.65);
  let ao = 0.84 + 0.16 * nz;
  let fog = clamp(1.0 - max(0.0, in.view_z - 3.6) * 0.10, 0.58, 1.0);
  let lit = (in.color * diff * ao + vec3<f32>(1.0) * spec + mix(vec3<f32>(0.38, 0.78, 1.0), in.color, 0.45) * rim + in.color * in.glow * 0.35) * fog;

  var out: FsOut;
  out.color = vec4<f32>(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
  out.depth = clamp((in.view_z - nz * in.view_rad - 0.35) / 10.0, 0.001, 0.999);
  return out;
}

struct WireOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

// Periodic Simulation-Box Wireframe Lines (24 vertices = 12 edges + optional 24-vertex gravity floor grid!)
@vertex
fn vs_wire(@builtin(vertex_index) vid: u32) -> WireOut {
  var edges = array<vec3<f32>, 24>(
    vec3<f32>(-1,-1,-1), vec3<f32>( 1,-1,-1),
    vec3<f32>(-1, 1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1, 1,-1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1,-1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1,-1, 1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1,-1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1, 1,-1), vec3<f32>( 1, 1, 1)
  );
  let live_half = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let ref_half = max(live_half, u.ref_box_cam.xyz * 0.5);
  let norm_half = max(ref_half.x, max(ref_half.y, ref_half.z));
  let is_ghost = u.render_cfg.z > 0.5;
  let grav_on = u.render_cfg.w > 0.5;
  let active_half = select(live_half, max(vec3<f32>(0.5), u.ref_box_cam.xyz * 0.5), is_ghost);
  let box_scale = active_half / norm_half;

  var p_unit = vec3<f32>(0.0);
  var col = select(vec4<f32>(0.34, 0.76, 1.0, 0.38), vec4<f32>(0.98, 0.80, 0.28, 0.36), is_ghost);
  if (vid < 24u) {
    p_unit = edges[vid];
    if (!is_ghost && grav_on && p_unit.y < -0.5) {
      col = vec4<f32>(0.98, 0.78, 0.34, 0.64);
    }
  } else {
    // 12 crisp floor grid lines (6 X-lines + 6 Z-lines) on the bottom gravity plane y = -1!
    let gi = vid - 24u;
    let line_id = gi / 2u;
    let end_id = gi % 2u;
    let is_z = line_id >= 6u;
    let frac = (f32((line_id % 6u) + 1u) / 7.0) * 2.0 - 1.0;
    let span = select(-1.0, 1.0, end_id == 1u);
    p_unit = select(vec3<f32>(frac, -1.0, span), vec3<f32>(span, -1.0, frac), is_z);
    col = vec4<f32>(0.96, 0.74, 0.32, 0.30);
  }
  let view = world_to_view(p_unit * box_scale);
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  var out: WireOut;
  out.clip_pos = vec4<f32>(cx, cy, depth_z, 1.0);
  out.color = col;
  return out;
}

@fragment
fn fs_wire(in: WireOut) -> @location(0) vec4<f32> {
  return in.color;
}
`,Tn=`
${e}

struct PolyRenderUniforms {
  log_t_min: f32,
  log_t_max: f32,
  log_p_min: f32,
  log_p_max: f32,
  probe_fx: f32,
  probe_fy: f32,
  probe_active: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> u: PolyRenderUniforms;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_poly(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_poly(in: VsOut) -> @location(0) vec4<f32> {
  // Subtle frame margin
  if (in.uv.x < 0.06 || in.uv.x > 0.96 || in.uv.y < 0.08 || in.uv.y > 0.90) {
    return vec4<f32>(0.024, 0.042, 0.078, 1.0);
  }
  let fx = (in.uv.x - 0.06) / 0.90;
  let fy = (in.uv.y - 0.08) / 0.82;
  let log_t = mix(u.log_t_min, u.log_t_max, fx);
  let log_p = mix(u.log_p_min, u.log_p_max, fy);
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);

  let eval_res = eval_polytope_atlas_2d(&polytope_atlas, T, P);
  var col = vec3<f32>(0.04, 0.05, 0.08);
  if (eval_res.w < 0.5) {
    // Fail-closed outside-domain hatching
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.075;
    col = vec3<f32>(0.06, 0.045, 0.075) + vec3<f32>(hatch, hatch * 0.45, hatch * 0.55);
  } else {
    let rho = max(1e-6, eval_res.x);
    let margin = eval_res.y;
    let pcode = u32(max(0.0, floor(eval_res.z + 0.5)));
    var base_col = vec3<f32>(0.34, 0.76, 1.0); // solid
    if (pcode == 1u) { base_col = vec3<f32>(0.20, 0.83, 0.60); } // liquid
    else if (pcode == 2u) { base_col = vec3<f32>(0.98, 0.57, 0.24); } // gas
    else if (pcode >= 3u) { base_col = vec3<f32>(0.75, 0.52, 0.99); } // plasma

    // Density contour lines in log10(rho) + crisp slanted coexistence facet edge highlight
    let log_rho = log2(rho) * 0.3010299956639812;
    let iso_shade = 0.58 + 0.32 * clamp((log_rho + 2.0) / 6.5, 0.0, 1.0);
    let contour = smoothstep(0.06, 0.0, abs(fract(log_rho * 1.5) - 0.5)) * 0.22;
    let facet_edge = smoothstep(0.018, 0.0, margin) * 0.65;
    col = base_col * iso_shade + vec3<f32>(contour) + vec3<f32>(0.95, 0.98, 1.0) * facet_edge;
  }

  // Interactive GPU (T, log10 P) probe crosshair & glowing reticle
  if (u.probe_active > 0.5) {
    let dx = abs(fx - u.probe_fx);
    let dy = abs(fy - u.probe_fy);
    let d_pt = sqrt(dx * dx + dy * dy);
    let line_x = smoothstep(0.0038, 0.0, dx) * 0.34;
    let line_y = smoothstep(0.0042, 0.0, dy) * 0.34;
    let ring = smoothstep(0.006, 0.0, abs(d_pt - 0.022)) * 0.95;
    let dot_c = smoothstep(0.007, 0.0, d_pt) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.95, 0.62), clamp(line_x + line_y + ring + dot_c, 0.0, 1.0));
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`,En=`
struct OrbitalCloudUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_style: vec4<f32>,     // (cam_dist, point_size, opacity, alt_shell_colors)
  color_a: vec4<f32>,       // (r, g, b, show_guides)
  color_b: vec4<f32>,       // (r, g, b, nuc_radius)
  stark: vec4<f32>,         // (stark_mix_lambda, e_field_norm, 0, 0)
};

@group(0) @binding(0) var<uniform> u: OrbitalCloudUniforms;
@group(0) @binding(1) var<storage, read> points: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_pt(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_style.x;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pt = points[iid];
  // First-order Stark perturbation dipolar cloud shift opposite to applied +X electric field:
  // outer valence shells polarize more strongly (~r^2) than tight core shells!
  let r2_pt = dot(pt.xyz, pt.xyz);
  let stark_lam = u.stark.x;
  let pos_eff = pt.xyz - vec3<f32>(stark_lam * (0.42 + 0.85 * min(1.8, r2_pt)), 0.0, 0.0);
  let view = project_pt(pos_eff);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.25, view.z);
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;

  // Ultra-crisp MoonLab dusty sprite radius & delicate per-point alpha (zero solid-white core blowout!)
  let min_px = 0.95 / max(1.0, u.res_yaw_pitch.y);
  let world_r = max(min_px * 1.15, u.cam_style.y * 0.65 * fov * inv_z);
  let rx = world_r / aspect;
  let ry = world_r;

  let shade = abs(pt.w);
  let is_a = pt.w >= 0.0;
  var base_rgb = select(
    u.color_a.rgb,
    select(u.color_b.rgb, u.color_a.rgb, is_a),
    u.cam_style.w > 0.5
  );
  if (abs(stark_lam) > 0.01) {
    let pol_side = clamp(-pos_eff.x * sign(stark_lam) * 1.4, -1.0, 1.0);
    let pol_col = select(vec3<f32>(1.0, 0.55, 0.28), vec3<f32>(0.32, 0.88, 1.0), pol_side >= 0.0);
    base_rgb = mix(base_rgb, pol_col, min(0.55, abs(stark_lam) * 1.15) * abs(pol_side));
  }

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, 0.5, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(base_rgb * shade, u.cam_style.z * 0.22);
  return out;
}

@fragment
fn fs_cloud(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.2) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}

// Nucleus core billboard at (0, 0, 0)
@vertex
fn vs_nucleus(@builtin(vertex_index) vid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let view = project_pt(vec3<f32>(0.0));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.25, view.z);
  let rad = max(0.012, u.color_b.w * fov * inv_z);
  var out: VsOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.4, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(0.95, 0.96, 1.0, 0.9);
  return out;
}

@fragment
fn fs_nucleus(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-r2 * 4.5);
  return vec4<f32>(in.color.rgb * core, core * 0.92);
}

// Cartesian floor grid + XYZ axes (matches MoonLab "Show cartesian grid + axes"!)
struct GuideOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) col: vec4<f32>,
};

@vertex
fn vs_guides(@builtin(vertex_index) vid: u32) -> GuideOut {
  // 22 grid lines (11 along X, 11 along Z -> 44 verts) + 3 RGB axes (6 verts) = 50 verts
  var p = vec3<f32>(0.0);
  var col = vec4<f32>(0.24, 0.28, 0.36, 0.45);
  if (vid < 22u) {
    let line_i = vid / 2u;
    let end_i = vid % 2u;
    let z_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let x_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else if (vid < 44u) {
    let k = vid - 22u;
    let line_i = k / 2u;
    let end_i = k % 2u;
    let x_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let z_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else {
    let a = vid - 44u;
    if (a == 0u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 1u) { p = vec3<f32>(1.15, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 2u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 3u) { p = vec3<f32>(0.0, 0.15, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 4u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
    else { p = vec3<f32>(0.0, -1.0, 1.15); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
  }
  let view = project_pt(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.25, view.z);
  var out: GuideOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, 0.5, 1.0);
  out.col = col;
  return out;
}

@fragment
fn fs_guides(in: GuideOut) -> @location(0) vec4<f32> {
  return in.col;
}
`,Dn=`
struct PhotonSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  grid_meta: vec4<f32>,     // (nx, ny, slab_x0, slab_x1)
  wave_meta: vec4<f32>,     // (mode_mono, is_metal, shell_pts_per_atom, cam_dist)
  slab_tint: vec4<f32>,     // (srgb.r, srgb.g, srgb.b, shell_opacity)
  probe_rgb: vec4<f32>,     // (probe.r, probe.g, probe.b, wave_gain)
};

@group(0) @binding(0) var<uniform> u: PhotonSceneUniforms;
@group(0) @binding(1) var<storage, read> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read> shell_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> shell_pts: array<vec4<f32>>;

struct WavePlaneOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn project_ps(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.wave_meta.w;
  return vec3<f32>(x1, y2, z2);
}

fn world_to_clip(p: vec3<f32>) -> vec4<f32> {
  let view = project_ps(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85 * min(1.0, aspect);
  let z_safe = max(0.3, view.z);
  // True perspective-correct clip coordinates (w = z_safe) so quad UV interpolation has ZERO diagonal kink!
  return vec4<f32>(view.x * fov / aspect, view.y * fov, 0.5 * z_safe, z_safe);
}

// 1. High-resolution 2D Maxwell Wave-Field Plane (bilinearly sampled 128x128x4 GPU EM field!)
//    Renders real incident white photon packet, real reflected Gold/Silver packet, real Snell
//    refraction & wavelength compression inside dielectrics, and real local shell absorption glow!
@vertex
fn vs_wave_plane(@builtin(vertex_index) vid: u32) -> WavePlaneOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let uv = quad[vid];
  // Map 2D optical cavity [0,1]^2 onto tilted 3D world plane [-1.45, +1.45] x [-1.45, +1.45]
  let wx = (uv.x * 2.0 - 1.0) * 1.45;
  let wz = (uv.y * 2.0 - 1.0) * 1.45;
  var out: WavePlaneOut;
  out.clip_pos = world_to_clip(vec3<f32>(wx, 0.0, wz));
  out.uv = uv;
  return out;
}

fn bilerp_ez(ch: u32, gx: f32, gy: f32) -> f32 {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = ez_field[base + y0 * nx + x0];
  let v10 = ez_field[base + y0 * nx + (x0 + 1u)];
  let v01 = ez_field[base + (y0 + 1u) * nx + x0];
  let v11 = ez_field[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

fn bilerp_shell(ch: u32, gx: f32, gy: f32) -> vec4<f32> {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = shell_state[base + y0 * nx + x0];
  let v10 = shell_state[base + y0 * nx + (x0 + 1u)];
  let v01 = shell_state[base + (y0 + 1u) * nx + x0];
  let v11 = shell_state[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

@fragment
fn fs_wave_plane(in: WavePlaneOut) -> @location(0) vec4<f32> {
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx = in.uv.x * (nx - 1.0);
  let gy = in.uv.y * (ny - 1.0);

  let in_slab = gx >= u.grid_meta.z && gx <= u.grid_meta.w && gy >= 12.0 && gy <= ny - 13.0;
  // Crisp micro-cavity spatial ruler grid (every 8 cells = 160 nm) so wavelength compression is obvious!
  let grid_x = smoothstep(0.06, 0.0, abs(fract(gx / 8.0) - 0.5));
  let grid_y = smoothstep(0.06, 0.0, abs(fract(gy / 8.0) - 0.5));
  let grid_line = max(grid_x, grid_y) * 0.055;

  var bg = vec3<f32>(0.012, 0.019, 0.036) + vec3<f32>(0.24, 0.38, 0.58) * grid_line;
  if (in_slab) {
    bg = bg + u.slab_tint.rgb * select(0.08, 0.13, u.wave_meta.y > 0.5);
  }
  // Sharp Fresnel optical interface highlight at x = slab_x0 and x = slab_x1
  let face0 = exp(-pow((gx - u.grid_meta.z) * 1.1, 2.0)) * select(0.0, 0.55, gy >= 12.0 && gy <= ny - 13.0);
  let face1 = exp(-pow((gx - u.grid_meta.w) * 1.1, 2.0)) * select(0.0, 0.32, gy >= 12.0 && gy <= ny - 13.0);
  bg = bg + (u.slab_tint.rgb * 0.65 + vec3<f32>(0.35)) * (face0 + face1);

  let gain = u.probe_rgb.w;
  var wave_rgb = vec3<f32>(0.0);
  var shell_glow = vec3<f32>(0.0);

  if (u.wave_meta.x > 0.5) {
    // Single-lambda coherent wave visualization: positive crests bright spectral color, troughs deep complementary!
    let ez = bilerp_ez(3u, gx, gy) * gain;
    let ss = bilerp_shell(3u, gx, gy);
    let pos_w = max(0.0, ez);
    let neg_w = max(0.0, -ez);
    let crest_col = u.probe_rgb.rgb;
    let trough_col = mix(u.probe_rgb.rgb * 0.45, vec3<f32>(0.18, 0.42, 0.85), 0.45);
    wave_rgb = crest_col * pow(min(1.8, pos_w * 2.4), 0.85) + trough_col * pow(min(1.6, neg_w * 2.1), 0.9);
    let abs_e = clamp(abs(ss.z) * 28.0 + abs(ss.x) * 0.6, 0.0, 1.0);
    shell_glow = vec3<f32>(0.85, 0.55, 1.0) * abs_e * 0.55;
  } else {
    // Real RGB 3-Channel White Light Maxwell Wavepacket:
    //   Incident beam: E_R ≈ E_G ≈ E_B -> PURE LUMINOUS WHITE WAVEFRONTS!
    //   Reflected off Relativistic Gold: Blue absorbed by 5d shells -> RADIANT GOLDEN REFLECTED WAVEFRONTS!
    //   Reflected off Non-Relativistic Gold / Silver: E_R ≈ E_G ≈ E_B -> MIRROR SILVER-WHITE WAVEFRONTS!
    //   Refracted inside Dielectric (H2O, Diamond, NaCl): Snell-bent compressed wavefronts!
    let er = bilerp_ez(0u, gx, gy) * gain;
    let eg = bilerp_ez(1u, gx, gy) * gain;
    let eb = bilerp_ez(2u, gx, gy) * gain;

    // Show crisp wave crests (phase-preserving brightness so individual wavefronts are razor sharp!)
    let ar = abs(er);
    let ag = abs(eg);
    let ab = abs(eb);
    let amp_rgb = vec3<f32>(ar, ag, ab);
    let peak = max(ar, max(ag, ab));
    // Soft tone-mapped luminous optical intensity keeping true RGB ratios intact!
    let tone = pow(clamp(peak * 2.5, 0.0, 3.0), 0.82) / max(1e-4, peak);
    let phase_boost = 0.72 + 0.38 * smoothstep(-0.15, 0.25, (er + eg + eb) * 0.33);
    wave_rgb = amp_rgb * tone * 0.52 * phase_boost;

    // Real local shell dipole excitation / blue-absorption glow inside slab
    if (in_slab) {
      let s0 = bilerp_shell(0u, gx, gy);
      let s1 = bilerp_shell(1u, gx, gy);
      let s2 = bilerp_shell(2u, gx, gy);
      let b_abs = clamp(abs(s2.z) * 34.0, 0.0, 1.0);
      let tot_p = clamp((abs(s0.x) + abs(s1.x) + abs(s2.x)) * 0.45, 0.0, 1.0);
      shell_glow = vec3<f32>(0.65, 0.32, 1.0) * b_abs * 0.65 + u.slab_tint.rgb * tot_p * 0.32;
    }
  }

  let col = bg + wave_rgb + shell_glow;
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// 2. MoonLab-Grade 3D Atomic Electron-Shell Point Clouds Embedded Inside the Optical Slab!
//    Every electron sample reads the live 2D Maxwell field shell_state(x, y) directly on GPU,
//    physically oscillating vertically along E_z proportional to bound polarization P(x,y,t) & J_D(x,y,t)
//    and glowing brightly where photons resonantly excite the electron shells!
struct ShellDotOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_driven_shells(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> ShellDotOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pts_per_atom = max(1u, u32(u.wave_meta.z));
  let site_idx = iid / pts_per_atom;
  let pt_idx = iid % pts_per_atom;
  let raw_pt = shell_pts[pt_idx];

  // Tile 4 (X) x 5 (Z) = 20 real 3D Dirac-KS atomic electron-shell clouds cleanly across the slab!
  let sx = site_idx % 4u;
  let sz = (site_idx / 4u) % 5u;
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx_site = mix(u.grid_meta.z + 5.0, u.grid_meta.w - 5.0, (f32(sx) + 0.5) / 4.0);
  let gy_site = mix(22.0, ny - 23.0, (f32(sz) + 0.5) / 5.0);

  let cx_w = ((gx_site / (nx - 1.0)) * 2.0 - 1.0) * 1.45;
  let cz_w = ((gy_site / (ny - 1.0)) * 2.0 - 1.0) * 1.45;
  let atom_rad = 0.145;
  var wpos = vec3<f32>(cx_w, 0.08, cz_w) + raw_pt.xyz * atom_rad;

  // Read live 2D Maxwell polarization & shell absorption at this atom's exact (gx, gy) cell!
  let cell_x = u32(clamp(gx_site, 1.0, nx - 2.0));
  let cell_y = u32(clamp(gy_site, 1.0, ny - 2.0));
  let nx_u = u32(nx);
  let ny_u = u32(ny);
  let cell_off = cell_y * nx_u + cell_x;

  var pol_disp = 0.0;
  var abs_excite = 0.0;
  var blue_abs = 0.0;
  if (u.wave_meta.x > 0.5) {
    let sp = shell_state[3u * nx_u * ny_u + cell_off];
    pol_disp = sp.x * 0.45 + sp.y * 2.4;
    abs_excite = clamp(abs(sp.z) * 28.0 + abs(sp.x) * 0.85, 0.0, 1.0);
  } else {
    let s0 = shell_state[0u * nx_u * ny_u + cell_off];
    let s1 = shell_state[1u * nx_u * ny_u + cell_off];
    let s2 = shell_state[2u * nx_u * ny_u + cell_off];
    pol_disp = 0.22 * (s0.x + s1.x + s2.x) + 1.4 * (s0.y + s1.y + s2.y);
    abs_excite = clamp((abs(s0.z) + abs(s1.z) + abs(s2.z)) * 22.0 + abs(pol_disp) * 0.55, 0.0, 1.0);
    blue_abs = clamp(abs(s2.z) * 38.0, 0.0, 1.0);
  }

  // Real physical electron-cloud dipole oscillation driven by live GPU Maxwell field E_z!
  wpos.y = wpos.y + clamp(pol_disp * 0.16, -0.24, 0.24);

  let view = project_ps(wpos);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.3, view.z);
  let rad = max(1.5 / max(1.0, u.res_yaw_pitch.y), 0.0095 * fov * inv_z);

  let is_a = raw_pt.w >= 0.0;
  let shade = abs(raw_pt.w);
  let base_shell = select(
    mix(vec3<f32>(0.42, 0.22, 0.92), u.slab_tint.rgb, 0.35),
    mix(vec3<f32>(0.92, 0.95, 1.0), u.slab_tint.rgb, 0.50),
    is_a
  );
  let excite_col = mix(vec3<f32>(1.0, 0.85, 0.36), vec3<f32>(0.72, 0.40, 1.0), blue_abs);
  let final_rgb = mix(base_shell, excite_col, abs_excite * 0.82) * shade * (0.85 + 1.15 * abs_excite);

  var out: ShellDotOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(final_rgb, clamp(u.slab_tint.w * 0.32 + abs_excite * 0.20, 0.04, 0.36));
  return out;
}

@fragment
fn fs_shell_dot(in: ShellDotOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.0) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`,On=`
struct TdksUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_grid: vec4<f32>,      // (cam_dist, grid_n, world_half, field_view_mode)
  bloch_state: vec4<f32>,   // (rho00, rho11, 2*Re[rho01], e_now)
  wave_meta: vec4<f32>,     // (pol_mode, mode_mono, time_fs, point_size)
  refl_srgb: vec4<f32>,     // (emergent_r, emergent_g, emergent_b, blue_rho11)
  probe_rgb: vec4<f32>,     // (probe_r, probe_g, probe_b, atom_radius)
};

@group(0) @binding(0) var<uniform> u: TdksUniforms;
@group(0) @binding(1) var<storage, read> pair_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pair_amp: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> e_tot_3d: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> e_inc_3d: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> pol_3d: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> j_3d: array<vec4<f32>>;

struct TdksVolOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

fn project_tdks(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_grid.x;
  return vec3<f32>(x1, y2, z2);
}

// Exact mathematical inverse of project_tdks rotation (M^T = R_y(-yaw) * R_x(-pitch))
fn inv_rot_tdks(v: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let vx1 = v.x;
  let vy1 = v.y * cp + v.z * sp;
  let vz1 = -v.y * sp + v.z * cp;
  return vec3<f32>(
    vx1 * cy + vz1 * sy,
    vy1,
    -vx1 * sy + vz1 * cy
  );
}

fn grid_idx3(ix: u32, iy: u32, iz: u32, n: u32) -> u32 {
  return (iz * n + iy) * n + ix;
}

fn sample_grid_trilin_e_tot(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = e_tot_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = e_tot_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = e_tot_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = e_tot_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = e_tot_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = e_tot_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = e_tot_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = e_tot_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_e_inc(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = e_inc_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = e_inc_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = e_inc_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = e_inc_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = e_inc_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = e_inc_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = e_inc_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = e_inc_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_pol(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = pol_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = pol_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = pol_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = pol_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = pol_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = pol_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = pol_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = pol_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_j(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = j_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = j_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = j_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = j_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = j_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = j_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = j_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = j_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

// Pass 1: Full-screen TRUE 3D Volumetric Raymarcher of Live N^3 Maxwell-KS Fields
@vertex
fn vs_tdks_field(@builtin(vertex_index) vid: u32) -> TdksVolOut {
  var tri = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  let ndc = tri[vid];
  var out: TdksVolOut;
  out.clip_pos = vec4<f32>(ndc, 0.5, 1.0);
  out.ndc = ndc;
  return out;
}

@fragment
fn fs_tdks_field(in: TdksVolOut) -> @location(0) vec4<f32> {
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92 * min(1.0, aspect);
  let d_view = normalize(vec3<f32>(in.ndc.x * aspect / fov, in.ndc.y / fov, 1.0));
  let ro = inv_rot_tdks(vec3<f32>(0.0, 0.0, -u.cam_grid.x));
  let rd = normalize(inv_rot_tdks(d_view));

  // Ray-sphere intersection against spherical optical cavity (R = 1.88 -> ZERO box edges ever!)
  let rad_cav = min(1.88, u.cam_grid.z * 0.94);
  let b_sph = dot(ro, rd);
  let c_sph = dot(ro, ro) - rad_cav * rad_cav;
  let disc = b_sph * b_sph - c_sph;
  if (disc <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let sq = sqrt(disc);
  let t0 = max(0.05, -b_sph - sq);
  let t1 = -b_sph + sq;
  if (t1 <= t0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }

  // Deterministic blue-noise-like screen jitter to eliminate volume slicing bands
  let jitter = fract(sin(dot(in.clip_pos.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  let steps = 56u;
  let dt = (t1 - t0) / f32(steps);

  let mode_mono = u.wave_meta.y > 0.5;
  let fview = u.cam_grid.w; // 0 = 3D Volume, 1 = Scattered Only, 2 = 3D Volume + Phase Cut
  let scatt_tint = select(
    clamp(u.refl_srgb.rgb * 1.10, vec3<f32>(0.24), vec3<f32>(1.0)),
    mix(u.probe_rgb.rgb, vec3<f32>(1.0, 0.84, 0.42), 0.28),
    mode_mono
  );
  let inc_tint_pos = select(vec3<f32>(0.52, 0.88, 1.00), mix(u.probe_rgb.rgb, vec3<f32>(0.45, 0.92, 1.0), 0.40), mode_mono);
  let inc_tint_neg = select(vec3<f32>(0.18, 0.36, 0.96), mix(u.probe_rgb.rgb * 0.42, vec3<f32>(0.24, 0.28, 0.96), 0.55), mode_mono);

  var acc_rgb = vec3<f32>(0.0);
  var acc_a = 0.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t0 + (f32(s) + jitter) * dt;
    let p = ro + rd * t;
    let r = length(p);
    let sph_fade = smoothstep(rad_cav, rad_cav * 0.68, r);
    if (sph_fade <= 0.002) { continue; }

    let et4 = sample_grid_trilin_e_tot(p);
    let ei4 = sample_grid_trilin_e_inc(p);
    let es = et4.xyz - ei4.xyz;
    let es_mag = length(es);

    // 1. Live 3D Incident Photon Wavefront Sheets (sharp curved iso-crests, ZERO flat haze!)
    var step_rgb = vec3<f32>(0.0);
    var step_d = 0.0;
    if (fview < 0.5 || fview > 1.5) {
      let pol_signed = select(
        select(ei4.y, ei4.z, u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5),
        ei4.y * 0.707 + ei4.z * 0.707,
        u.wave_meta.x > 1.5
      );
      // Thin iso-crest sheets around peaks & troughs -> unmistakable 3D marching wavefront planes!
      let a_pol = abs(pol_signed);
      let crest_sheet = smoothstep(0.24, 0.62, max(0.0, pol_signed));
      let trough_sheet = smoothstep(0.24, 0.62, max(0.0, -pol_signed));
      let crest_sharp = pow(crest_sheet, 2.0);
      let trough_sharp = pow(trough_sheet, 2.0);
      // Slight outer-beam rim highlight so the 3D cylindrical wavepacket reads cleanly from any angle
      let beam_r = length(p.yz);
      let rim_w = 0.65 + 0.55 * smoothstep(0.18, 0.72, beam_r) * smoothstep(1.35, 0.78, beam_r);
      step_rgb = step_rgb + (inc_tint_pos * crest_sharp * 1.15 + inc_tint_neg * trough_sharp * 0.72) * rim_w;
      step_d = step_d + (crest_sharp * 0.068 + trough_sharp * 0.044) * rim_w * clamp(a_pol, 0.0, 1.5);
    }

    // 2. Live 3D Scattered Multipole Wave Shells (E_scatt = E_tot - E_inc) curving & rippling off the orbital lobes!
    if (es_mag > 0.012) {
      let es_signed = select(
        select(es.y, es.z, u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5),
        es.y * 0.707 + es.z * 0.707,
        u.wave_meta.x > 1.5
      );
      // Crisp positive/negative scattered wavefront crests wrapping in 3D around the lobes!
      let sc_pos = pow(smoothstep(0.025, 0.24, max(0.0, es_signed)), 1.45);
      let sc_neg = pow(smoothstep(0.025, 0.24, max(0.0, -es_signed)), 1.45);
      let cross_mag = select(length(vec2<f32>(es.x, es.z)), length(vec2<f32>(es.x, es.y)), u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5);
      let sc_cross = pow(smoothstep(0.022, 0.20, cross_mag), 1.4);
      let sc_boost = select(1.0, 1.85, fview > 0.5 && fview < 1.5);
      let c_pos = select(scatt_tint, mix(scatt_tint, vec3<f32>(1.00, 0.86, 0.44), 0.22), mode_mono);
      let c_neg = vec3<f32>(0.98, 0.34, 0.72);
      let c_xpol = vec3<f32>(0.22, 0.96, 0.88);
      step_rgb = step_rgb + (c_pos * sc_pos * 1.75 + c_neg * sc_neg * 1.15 + c_xpol * sc_cross * 1.35) * sc_boost;
      step_d = step_d + (sc_pos * 0.095 + sc_neg * 0.065 + sc_cross * 0.075) * sc_boost;
    }

    // 3. Local 3D Orbital Energy Absorption Glow (E · J strictly inside struck lobes)
    if (r < 1.18) {
      let p4 = sample_grid_trilin_pol(p);
      let j4 = sample_grid_trilin_j(p);
      let abs_g = clamp(j4.w * 0.75 + p4.w * 0.55, 0.0, 1.2);
      if (abs_g > 0.05) {
        let abs_col = mix(vec3<f32>(1.0, 0.72, 0.18), vec3<f32>(1.0, 0.32, 0.74), clamp(p4.w * 1.3, 0.0, 1.0));
        step_rgb = step_rgb + abs_col * abs_g * 0.42;
        step_d = step_d + abs_g * 0.022;
      }
    }

    // Subtle crisp nucleus pinpoint at r = 0
    let nuc = exp(-r * r * 180.0);
    if (nuc > 0.02) {
      step_rgb = step_rgb + vec3<f32>(1.0, 0.94, 0.76) * nuc * 1.8;
      step_d = step_d + nuc * 0.18;
    }

    let a_step = clamp(step_d * sph_fade * (dt * 14.0), 0.0, 0.42);
    acc_rgb = acc_rgb + (1.0 - acc_a) * step_rgb * sph_fade * dt * 1.85;
    acc_a = acc_a + (1.0 - acc_a) * a_step;
    if (acc_a > 0.92) { break; }
  }

  // Optional crisp circular equatorial wave-diffraction phase cut (fview == 2, ZERO square edges!)
  if (fview > 1.5 && abs(rd.z) > 0.05) {
    let tz = -ro.z / rd.z;
    if (tz > 0.05) {
      let pz = ro + rd * tz;
      let rz = length(pz.xy);
      if (rz < 1.72) {
        let etz = sample_grid_trilin_e_tot(pz);
        let eiz = sample_grid_trilin_e_inc(pz);
        let esz = etz.xyz - eiz.xyz;
        let fade_z = smoothstep(1.72, 1.18, rz);
        let ph_val = etz.y + etz.z;
        let line_c = smoothstep(0.09, 0.0, abs(fract(ph_val * 2.2) - 0.5)) * smoothstep(0.05, 0.25, length(etz.xyz));
        let ring = smoothstep(0.012, 0.0, abs(rz - 1.05)) * 0.14;
        let cut_col = mix(vec3<f32>(0.28, 0.74, 1.0), scatt_tint, clamp(length(esz) * 2.4, 0.0, 1.0));
        acc_rgb = acc_rgb + (cut_col * (line_c * 0.28 + length(esz) * 0.42) + vec3<f32>(0.35, 0.55, 0.85) * ring) * fade_z;
        acc_a = clamp(acc_a + (line_c * 0.16 + ring) * fade_z, 0.0, 0.94);
      }
    }
  }

  // Soft filmic tone curve so overlapping 3D wavefronts stay vivid & legible without clipping!
  let mapped = acc_rgb / (vec3<f32>(1.0) + acc_rgb * 0.72);
  return vec4<f32>(mapped, clamp(acc_a, 0.0, 0.92));
}

// Pass 2: Dynamically Coupled 180K-Point 3D Dirac-KS Electron Cloud!
// Every point samples the LIVE 3D GPU polarization P(r,t), E_scatt(r,t), and local
// excited density rho_11(r,t) at its exact 3D position -> front lobes flex & light up
// BEFORE back lobes with true finite-c phase lag and razor-sharp nodal shells!
struct TdksPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_tdks_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TdksPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = pair_pos[iid];
  let amp4 = pair_amp[iid];

  let atom_r = max(0.5, u.probe_rgb.w);
  let p_base = pos4.xyz * (atom_r * 1.16);

  // LIVE 3D GPU FIELD COUPLING at this electron sample's exact 3D coordinate!
  let e_loc = sample_grid_trilin_e_tot(p_base);
  let ei_loc = sample_grid_trilin_e_inc(p_base);
  let pol_loc = sample_grid_trilin_pol(p_base);
  let j_loc = sample_grid_trilin_j(p_base);
  let e_scatt_loc = e_loc.xyz - ei_loc.xyz;

  // Local retarded 3D polarization deformation (front lobes react before rear lobes!)
  let disp = pol_loc.xyz * 0.26 + e_scatt_loc * 0.085;
  let p_world = p_base + disp;

  let rho11_loc = clamp(pol_loc.w * 0.90 + u.bloch_state.y * 0.22, 0.0, 0.96);
  let rho00_loc = max(0.10, 1.0 - rho11_loc);
  // Local dipole projection of P(r,t) along radial lobe vector drives opposite-parity interference!
  let r_hat = select(vec3<f32>(0.0, 1.0, 0.0), normalize(pos4.xyz), length(pos4.xyz) > 1e-4);
  let pol_proj = clamp(dot(pol_loc.xyz, r_hat) * 2.6 + u.bloch_state.z * 0.25, -1.6, 1.6);

  let p0_sq = amp4.x * amp4.x;
  let p1_sq = amp4.y * amp4.y;
  let cross = pol_proj * amp4.x * amp4.y;
  let prob_w = max(0.0, rho00_loc * p0_sq * 1.35 + rho11_loc * p1_sq * 0.95 + cross * 0.72);

  let view = project_tdks(p_world);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.3, view.z);

  let min_px = 1.0 / max(1.0, u.res_yaw_pitch.y);
  let world_r = clamp(u.wave_meta.w * 0.56 * fov * inv_z, min_px * 1.15, 0.0155);

  // High-contrast jewel-like MoonLab orbital lobes + crisp struck-lobe glow (ZERO white washout!):
  let base_gnd = select(vec3<f32>(0.48, 0.26, 1.00), vec3<f32>(0.88, 0.94, 1.00), amp4.w >= 0.0);
  let exc_col = vec3<f32>(1.00, 0.80, 0.22);
  let dip_col = select(vec3<f32>(0.20, 0.94, 1.00), vec3<f32>(1.00, 0.36, 0.82), pol_proj >= 0.0);

  let pol_mag = clamp(length(pol_loc.xyz) * 3.0 + length(j_loc.xyz) * 1.8, 0.0, 1.0);
  let exc_glow = clamp(rho11_loc * 1.45 + j_loc.w * 0.75, 0.0, 1.0);

  var rgb = mix(base_gnd, dip_col, pol_mag * 0.72);
  rgb = mix(rgb, exc_col, exc_glow * 0.78);

  // Crisp lobe definition with gentle core density cap so radial nodes & cloverleaf petals pop!
  let radial_att = mix(0.28, 1.0, smoothstep(0.06, 0.36, pos4.w));
  let shade = clamp(0.94 - 0.18 * pos4.w, 0.42, 0.98);
  let excite_boost = 1.0 + pol_mag * 0.48 + exc_glow * 0.52;
  let alpha = clamp(0.022 * pow(prob_w, 0.65) * radial_att * excite_boost, 0.0, 0.064);

  var out: TdksPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * world_r / aspect,
    view.y * fov * inv_z + corner.y * world_r,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(rgb * shade, alpha);
  return out;
}

@fragment
fn fs_tdks_cloud(in: TdksPtOut) -> @location(0) vec4<f32> {
  if (in.color.a <= 0.0008) { discard; }
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.6) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`,kn=`
struct SpinSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  dims_cam: vec4<f32>,      // (nx, ny, nz, cam_dist)
  field_meta: vec4<f32>,    // (bz_tesla, is_afm, arrow_scale, 0)
};

@group(0) @binding(0) var<uniform> u: SpinSceneUniforms;
@group(0) @binding(1) var<storage, read> spins: array<vec4<f32>>;

struct SpinArrowOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) shade: f32,
};

fn project_spin(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.dims_cam.w;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_spin_arrow(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> SpinArrowOut {
  let nx = u32(max(1.0, u.dims_cam.x));
  let ny = u32(max(1.0, u.dims_cam.y));
  let nz = u32(max(1.0, u.dims_cam.z));
  let n_tot = nx * ny * nz;

  // Last instance (iid == n_tot) renders a large translucent external B_z field indicator beside the lattice!
  var center = vec3<f32>(0.0);
  var dir = vec3<f32>(0.0, 1.0, 0.0);
  var arrow_len = u.field_meta.z;
  var arrow_w = arrow_len * 0.28;
  var col = vec3<f32>(1.0, 0.85, 0.35);

  if (iid < n_tot) {
    let ix = iid % nx;
    let iy = (iid / nx) % ny;
    let iz = iid / (nx * ny);
    let fx = (f32(ix) / max(1.0, f32(nx - 1u))) * 2.0 - 1.0;
    let fy = (f32(iy) / max(1.0, f32(ny - 1u))) * 2.0 - 1.0;
    let fz = (f32(iz) / max(1.0, f32(nz - 1u))) * 2.0 - 1.0;
    center = vec3<f32>(fx, fz, fy) * 0.92; // Map physical magnetic z-axis UP onto world Y!
    let s4 = spins[iid];
    // Map spin (sx, sy, sz) -> world (sx, sz, sy) so +z magnetization points cleanly UP!
    dir = normalize(vec3<f32>(s4.x, s4.z, s4.y) + vec3<f32>(1e-5, 0.0, 0.0));
    let sz = clamp(s4.z, -1.0, 1.0);
    // Color by spin z-projection: -1 deep sapphire blue -> 0 emerald teal -> +1 radiant solar gold/crimson!
    let c_down = vec3<f32>(0.22, 0.50, 1.0);
    let c_mid = vec3<f32>(0.20, 0.88, 0.68);
    let c_up = vec3<f32>(1.0, 0.72, 0.22);
    col = select(mix(c_down, c_mid, sz + 1.0), mix(c_mid, c_up, sz), sz >= 0.0);
  } else {
    // External applied B_z field indicator on the right margin of the lattice
    let bz = u.field_meta.x;
    center = vec3<f32>(1.30, 0.0, 0.0);
    dir = vec3<f32>(0.0, select(-1.0, 1.0, bz >= 0.0), 0.0);
    arrow_len = clamp(abs(bz) * 0.14, 0.0, 0.65);
    arrow_w = select(0.0, 0.085, arrow_len > 0.02);
    col = select(vec3<f32>(0.35, 0.72, 1.0), vec3<f32>(1.0, 0.90, 0.35), bz >= 0.0);
  }

  // 2D camera-facing billboard arrow aligned strictly along the projected 3D spin direction!
  let view_c = project_spin(center);
  let view_tip = project_spin(center + dir * arrow_len);
  let view_tail = project_spin(center - dir * (arrow_len * 0.45));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);

  let inv_z_c = 1.0 / max(0.35, view_c.z);
  let p_tip = vec2<f32>(view_tip.x * fov / (max(0.35, view_tip.z) * aspect), view_tip.y * fov / max(0.35, view_tip.z));
  let p_tail = vec2<f32>(view_tail.x * fov / (max(0.35, view_tail.z) * aspect), view_tail.y * fov / max(0.35, view_tail.z));
  let axis_2d = p_tip - p_tail;
  let axis_len = max(0.008, length(axis_2d));
  let fwd = axis_2d / axis_len;
  let perp = vec2<f32>(-fwd.y / aspect, fwd.x * aspect);
  let perp_n = normalize(perp);

  // 9 vertices = 3 triangles: shaft quad (6 verts) + arrowhead triangle (3 verts)
  var local = array<vec2<f32>, 9>(
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62, -0.26), vec2<f32>(0.62,  0.26),
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62,  0.26), vec2<f32>(0.0,   0.26),
    vec2<f32>(0.54, -0.78), vec2<f32>(1.00,  0.00), vec2<f32>(0.54,  0.78)
  );
  let lv = local[vid];
  let half_w = arrow_w * fov * inv_z_c;
  let ndc = p_tail + fwd * (lv.x * axis_len) + vec2<f32>(perp_n.x / aspect, perp_n.y) * (lv.y * half_w);
  let depth_z = clamp((view_c.z - 0.35) / 8.0, 0.001, 0.999);

  var out: SpinArrowOut;
  out.clip_pos = vec4<f32>(ndc.x, ndc.y, depth_z, 1.0);
  out.color = col;
  out.shade = 0.55 + 0.45 * lv.x;
  return out;
}

@fragment
fn fs_spin_arrow(in: SpinArrowOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color * in.shade, 1.0);
}
`,An=`
struct TransportSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_env: vec4<f32>,       // (cam_dist, phonon_vib_amp, time_s, is_superconducting)
  field_meta: vec4<f32>,    // (e_field_norm, carrier_count, 0, 0)
};

@group(0) @binding(0) var<uniform> u: TransportSceneUniforms;
@group(0) @binding(1) var<storage, read> c_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> c_vel: array<vec4<f32>>;

struct TrPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_tr(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_env.x;
  return vec3<f32>(x1, y2, z2);
}

// Pass 1: 4x4x4 = 64 vibrating crystal ion cores oscillating with Debye phonon amplitude!
@vertex
fn vs_phonon_ions(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let ix = iid % 4u;
  let iy = (iid / 4u) % 4u;
  let iz = iid / 16u;
  var p = (vec3<f32>(f32(ix), f32(iy), f32(iz)) / 3.0) * 1.72 - 0.86;
  // Acoustic phonon displacement wave driven by exact bundle thermal phonon amplitude!
  let ph = u.cam_env.z * 7.5 + f32(ix) * 1.3 + f32(iy) * 1.7 + f32(iz) * 2.1;
  let amp = u.cam_env.y * 0.42;
  p = p + vec3<f32>(sin(ph), cos(ph * 1.13), sin(ph * 0.87 + 1.0)) * amp;

  let view = project_tr(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let r = 0.048 * fov * inv_z;
  let col = select(vec3<f32>(0.28, 0.42, 0.62), vec3<f32>(0.36, 0.72, 0.88), u.cam_env.w > 0.5);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * r / aspect,
    view.y * fov * inv_z + corner.y * r,
    0.55, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(col, 0.45);
  return out;
}

// Pass 2: Streaming conduction electrons, holes, Cooper pairs & red phonon scattering flashes!
@vertex
fn vs_carriers(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let p4 = c_pos[iid];
  let v4 = c_vel[iid];
  let ctype = p4.w;
  let flash = clamp(v4.w, 0.0, 1.0);

  let p_w = p4.xyz * 0.96;
  let view = project_tr(p_w);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);

  // Elongate moving carriers along velocity vector so drift vs random thermal motion is visually unmistakable!
  let view_tip = project_tr(p_w + v4.xyz * 0.24);
  let inv_zt = 1.0 / max(0.35, view_tip.z);
  let p0_2d = vec2<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z);
  let p1_2d = vec2<f32>(view_tip.x * fov * inv_zt / aspect, view_tip.y * fov * inv_zt);
  let dv_2d = p1_2d - p0_2d;
  let dv_len = length(dv_2d);
  let fwd = select(vec2<f32>(1.0, 0.0), dv_2d / max(1e-5, dv_len), dv_len > 0.002);
  let perp = normalize(vec2<f32>(-fwd.y / aspect, fwd.x * aspect));

  let base_r = select(0.022, 0.032, ctype < -1.5) * fov * inv_z;
  let stretch = select(1.0, clamp(1.0 + dv_len / max(0.008, base_r), 1.0, 4.5), ctype != 0.0);
  let rad_x = base_r * stretch + flash * base_r * 1.4;
  let rad_y = base_r * (1.0 + flash * 1.2);
  let offset = fwd * (corner.x * rad_x) + vec2<f32>(perp.x / aspect, perp.y) * (corner.y * rad_y);

  var col = vec3<f32>(0.24, 0.84, 1.0); // normal electron: electric cyan
  var alpha = 0.78;
  if (ctype == 0.0) {
    col = vec3<f32>(0.42, 0.30, 0.65); // bound valence state: subtle violet
    alpha = 0.24;
  } else if (ctype > 0.5) {
    col = vec3<f32>(1.0, 0.38, 0.76); // thermally activated hole (+): radiant magenta
    alpha = 0.85;
  } else if (ctype < -1.5) {
    col = vec3<f32>(1.0, 0.86, 0.34); // superconducting Cooper pair: radiant gold!
    alpha = 0.92;
  }
  // Phonon scattering burst highlights collision site in bright orange-red!
  col = mix(col, vec3<f32>(1.0, 0.34, 0.14), flash * 0.90);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(p0_2d.x + offset.x, p0_2d.y + offset.y, 0.45, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(col, alpha);
  return out;
}

@fragment
fn fs_tr_dot(in: TrPtOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 2.8) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`,jn=`
struct MolSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_meta: vec4<f32>,      // (cam_dist, scale_norm, color_mode (0=CPK, 1=MEP), time_s)
  center_off: vec4<f32>,    // (cx, cy, cz, show_box)
  box_half: vec4<f32>,      // (hx, hy, hz, 0)
};

// atoms_pos_r: vec4(x, y, z, radius_world)
// atoms_meta:  vec4(cpk_r, cpk_g, cpk_b, mulliken_charge)
// seg_a:       vec4(ax, ay, az, radius_world)
// seg_b:       vec4(bx, by, bz, flags_and_order) -> flags: 0=solid bond, 1=dashed TS‡, 2=dipole arrow shaft, 3=dipole head
@group(0) @binding(0) var<uniform> u: MolSceneUniforms;
@group(0) @binding(1) var<storage, read> atoms_pos_r: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_meta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> seg_a: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> seg_b: array<vec4<f32>>;

struct MolAtomOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) rim_tint: vec3<f32>,
};

struct MolBondOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv_along: vec2<f32>, // x in [0,1] along bond, y in [-1,1] across cylinder
  @location(1) color: vec3<f32>,
  @location(2) mode_order: vec2<f32>, // (mode, order)
};

fn project_mol(p_raw: vec3<f32>) -> vec3<f32> {
  let p = (p_raw - u.center_off.xyz) * u.cam_meta.y;
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_meta.x;
  return vec3<f32>(x1, y2, z2);
}

fn mep_color(q: f32) -> vec3<f32> {
  // Mulliken Electrostatic Potential coloring: δ- crimson-amber <-> 0 pearl <-> δ+ electric sapphire
  let t = clamp(q * 1.65, -1.0, 1.0);
  let c_neg = vec3<f32>(0.96, 0.28, 0.24);
  let c_mid = vec3<f32>(0.88, 0.91, 0.96);
  let c_pos = vec3<f32>(0.20, 0.56, 1.00);
  return select(mix(c_mid, c_neg, -t), mix(c_mid, c_pos, t), t >= 0.0);
}

@vertex
fn vs_mol_atom(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> MolAtomOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pr = atoms_pos_r[iid];
  let ameta = atoms_meta[iid];
  let view = project_mol(pr.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let rad = pr.w * u.cam_meta.y;
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;
  let rx = rad * fov * inv_z / aspect;
  let ry = rad * fov * inv_z;
  let depth_z = clamp((view.z - rad * 0.62 - 0.35) / 10.0, 0.001, 0.999);

  let is_mep = u.cam_meta.z > 0.5;
  let col = select(ameta.rgb, mep_color(ameta.w), is_mep);
  let rim = select(vec3<f32>(0.42, 0.78, 1.0), mep_color(ameta.w * 1.4), is_mep);

  var out: MolAtomOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.rim_tint = rim;
  return out;
}

@fragment
fn fs_mol_atom(in: MolAtomOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light1 = normalize(vec3<f32>(-0.42, 0.65, 0.63));
  let light2 = normalize(vec3<f32>(0.55, -0.30, 0.78));
  let diff = max(0.16, dot(n, light1)) * 0.86 + max(0.0, dot(n, light2)) * 0.24;
  let half_v = normalize(light1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 34.0) * 0.78;
  let rim = pow(1.0 - nz, 2.6) * 0.32;
  let rgb = in.color * diff + vec3<f32>(1.0) * spec + in.rim_tint * rim;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_mol_bond(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> MolBondOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let q = quad[vid];
  let sa = seg_a[iid];
  let sb = seg_b[iid];
  let va = project_mol(sa.xyz);
  let vb = project_mol(sb.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);

  let za = max(0.35, va.z);
  let zb = max(0.35, vb.z);
  let pa = vec2<f32>(va.x * fov / (za * aspect), va.y * fov / za);
  let pb = vec2<f32>(vb.x * fov / (zb * aspect), vb.y * fov / zb);
  let axis = pb - pa;
  let axis_len = max(1e-4, length(axis));
  let dir = axis / axis_len;
  let perp_raw = vec2<f32>(-dir.y * aspect, dir.x / aspect);
  let perp_n = normalize(perp_raw + vec2<f32>(1e-6, 0.0));

  let z_interp = mix(za, zb, q.x);
  let mode = floor(sb.w + 0.001);
  let order = fract(sb.w) * 4.0;
  let taper = select(1.0, max(0.0, 1.0 - q.x), mode >= 2.5);
  let half_w = sa.w * u.cam_meta.y * fov / z_interp * taper;
  let base_p = mix(pa, pb, q.x);
  let ndc = base_p + vec2<f32>(perp_n.x / aspect, perp_n.y) * (q.y * half_w);
  let depth_z = clamp((z_interp - 0.35) / 10.0 + 0.002, 0.001, 0.999);

  var col = vec3<f32>(0.74, 0.82, 0.94);
  if (mode >= 0.5 && mode < 1.5) {
    col = vec3<f32>(1.0, 0.62, 0.26);
  } else if (mode >= 1.5) {
    col = vec3<f32>(1.0, 0.86, 0.24);
  }

  var out: MolBondOut;
  out.clip_pos = vec4<f32>(ndc.x, ndc.y, depth_z, 1.0);
  out.uv_along = q;
  out.color = col;
  out.mode_order = vec2<f32>(mode, max(0.2, order));
  return out;
}

@fragment
fn fs_mol_bond(in: MolBondOut) -> @location(0) vec4<f32> {
  let mode = in.mode_order.x;
  if (mode >= 0.5 && mode < 1.5) {
    let dash = fract(in.uv_along.x * 7.5 - u.cam_meta.w * 0.35);
    if (dash > 0.54) { discard; }
  }
  let y = clamp(in.uv_along.y, -1.0, 1.0);
  let cyl_z = sqrt(max(0.02, 1.0 - y * y));
  let shade = 0.32 + 0.68 * max(0.0, y * 0.45 + cyl_z * 0.88);
  let spec = pow(max(0.0, y * 0.35 + cyl_z * 0.93), 18.0) * 0.45;
  let pulse = select(1.0, 0.85 + 0.25 * sin(u.cam_meta.w * 4.5), mode >= 0.5 && mode < 1.5);
  let rgb = (in.color * shade + vec3<f32>(0.95) * spec) * pulse;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_mol_box(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var edges = array<vec3<f32>, 24>(
    vec3<f32>(-1,-1,-1), vec3<f32>( 1,-1,-1),
    vec3<f32>(-1, 1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1, 1,-1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1,-1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1,-1, 1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1,-1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1, 1,-1), vec3<f32>( 1, 1, 1)
  );
  let p = u.center_off.xyz + edges[vid] * u.box_half.xyz;
  let view = project_mol(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  return vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
}

@fragment
fn fs_mol_box() -> @location(0) vec4<f32> {
  return vec4<f32>(0.36, 0.78, 1.0, 0.36);
}
`,Mn=`
struct RxRenderUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_meta: vec4<f32>,      // (cam_dist, radius_world, box_half, 0)
};

@group(0) @binding(0) var<uniform> u: RxRenderUniforms;
@group(0) @binding(1) var<storage, read> pos_sp: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> vel_flash: array<vec4<f32>>;

struct RxOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) flash: f32,
};

fn project_rx(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_meta.x;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_rx_mol(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> RxOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let ps = pos_sp[iid];
  let vf = vel_flash[iid];
  let sp = u32(round(ps.w));
  let flash = clamp(vf.w, 0.0, 1.0);
  let view = project_rx(ps.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let rad = u.cam_meta.y * (1.0 + flash * 0.55);
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;
  let rx = rad * fov * inv_z / aspect;
  let ry = rad * fov * inv_z;
  let depth_z = clamp((view.z - 0.35) / 9.0, 0.001, 0.999);

  var col = vec3<f32>(0.22, 0.74, 0.98);
  if (sp == 1u) { col = vec3<f32>(0.99, 0.58, 0.22); }
  else if (sp == 2u) { col = vec3<f32>(0.20, 0.86, 0.60); }
  else if (sp >= 3u) { col = vec3<f32>(0.91, 0.46, 0.98); }

  var out: RxOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.flash = flash;
  return out;
}

@fragment
fn fs_rx_mol(in: RxOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light = normalize(vec3<f32>(-0.4, 0.65, 0.64));
  let diff = max(0.18, dot(n, light));
  let half_v = normalize(light + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 26.0) * 0.72;
  let rim = pow(1.0 - nz, 2.4) * 0.32;
  let base_rgb = in.color * diff + vec3<f32>(1.0) * spec + in.color * rim;
  let burst_rgb = vec3<f32>(1.0, 0.94, 0.62) * (0.95 + 0.45 * nz);
  let rgb = mix(base_rgb, burst_rgb, in.flash * 0.82);
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_rx_box(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var edges = array<vec3<f32>, 24>(
    vec3<f32>(-1,-1,-1), vec3<f32>( 1,-1,-1),
    vec3<f32>(-1, 1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1, 1,-1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1,-1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1,-1, 1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1,-1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1, 1,-1), vec3<f32>( 1, 1, 1)
  );
  let view = project_rx(edges[vid] * u.cam_meta.z);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 9.0, 0.001, 0.999);
  return vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
}

@fragment
fn fs_rx_box() -> @location(0) vec4<f32> {
  return vec4<f32>(0.42, 0.78, 1.0, 0.34);
}
`,Nn=`
${e}

struct Poly3DUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  bounds: vec4<f32>,        // (min_lt, max_lt, min_lp, max_lp)
  height_cam: vec4<f32>,    // (min_lrho, max_lrho, cam_dist, grid_n)
  probe_state: vec4<f32>,   // (probe_fx, probe_fy, probe_active, mode: 0=3d-surface, 2=residual-2d)
  md_beacon: vec4<f32>,     // (md_fx, md_fy, md_active, show_wire_facets)
};

@group(0) @binding(0) var<uniform> u: Poly3DUniforms;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;

struct Poly3DOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv_tp: vec2<f32>,
  @location(1) world_pos: vec3<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) eval_vec: vec4<f32>,
};

struct LineOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

fn project_p3d(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  // Positive pitch looks cleanly DOWN from above onto the 3D phase relief surface!
  let y2 = p.y * cp + z1 * sp;
  let z2 = -p.y * sp + z1 * cp + u.height_cam.z;
  return vec3<f32>(x1, y2, z2);
}

fn eval_surface_height(fx: f32, fy: f32) -> vec4<f32> {
  let log_t = mix(u.bounds.x, u.bounds.y, clamp(fx, 0.0, 1.0));
  let log_p = mix(u.bounds.z, u.bounds.w, clamp(fy, 0.0, 1.0));
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);
  let res = eval_polytope_atlas_2d(&polytope_atlas, T, P);
  if (res.w < 0.5) {
    return vec4<f32>(-0.58, res.y, -1.0, 0.0);
  }
  let lrho = log2(max(1e-5, res.x)) * 0.3010299956639812;
  let h_norm = clamp((lrho - u.height_cam.x) / max(0.5, u.height_cam.y - u.height_cam.x), 0.0, 1.0);
  let y_world = h_norm * 1.12 - 0.50;
  return vec4<f32>(y_world, res.y, res.z, 1.0);
}

fn lookup_polytope_rel_err(T: f32, P: f32, fx: f32, fy: f32) -> vec2<f32> {
  let count = u32(polytope_atlas[0u]);
  let log_p = log2(max(1e-12, P)) * 0.3010299956639812;
  let lt_span = max(0.5, u.bounds.y - u.bounds.x);
  let lp_span = max(0.5, u.bounds.w - u.bounds.z);
  var best_err = -1.0;
  var best_margin = -1e9;
  var best_edge_dist = 1.0;
  for (var i = 0u; i < count; i = i + 1u) {
    let rec = 4u + i * 16u;
    let valid_flag = polytope_atlas[rec + 14u];
    if (valid_flag < 0.5) { continue; }
    let t_min = polytope_atlas[rec + 2u];
    let t_max = polytope_atlas[rec + 3u];
    let lp_min = polytope_atlas[rec + 4u];
    let lp_max = polytope_atlas[rec + 5u];
    if (T < t_min || T > t_max || log_p < lp_min || log_p > lp_max) { continue; }
    let f_count = u32(polytope_atlas[rec + 1u]);
    let f_off = u32(polytope_atlas[rec + 8u]);
    var min_slack = 1e9;
    var min_screen_d = 1.0;
    var inside = true;
    for (var fi = 0u; fi < f_count; fi = fi + 1u) {
      let fo = f_off + fi * 4u;
      let a_t = polytope_atlas[fo + 0u];
      let a_p = polytope_atlas[fo + 1u];
      let b_v = polytope_atlas[fo + 2u];
      let raw_s = b_v - (a_t * T + a_p * log_p);
      let slack = raw_s / max(1e-6, polytope_atlas[fo + 3u]);
      if (slack < -1e-4) { inside = false; break; }
      min_slack = min(min_slack, max(0.0, slack));
      // Normalize facet gradient into screen (fx, fy) coordinates so hairline width is uniform across all log-T decades!
      let g_fx = a_t * T * 2.30258509 * lt_span;
      let g_fy = a_p * lp_span;
      let screen_d = max(0.0, raw_s) / max(1e-5, length(vec2<f32>(g_fx, g_fy)));
      min_screen_d = min(min_screen_d, screen_d);
    }
    if (inside && min_slack >= best_margin) {
      best_margin = min_slack;
      best_err = polytope_atlas[rec + 10u];
      best_edge_dist = min_screen_d;
    }
  }
  return vec2<f32>(best_err, best_edge_dist);
}

@vertex
fn vs_poly3d_mesh(@builtin(vertex_index) vid: u32) -> Poly3DOut {
  let gn = u32(max(8.0, u.height_cam.w));
  let cell_idx = vid / 6u;
  let tri_v = vid % 6u;
  let cx = cell_idx % gn;
  let cy = cell_idx / gn;

  var offsets = array<vec2<u32>, 6>(
    vec2<u32>(0u, 0u), vec2<u32>(1u, 0u), vec2<u32>(1u, 1u),
    vec2<u32>(0u, 0u), vec2<u32>(1u, 1u), vec2<u32>(0u, 1u)
  );
  let off = offsets[tri_v];
  let fx = f32(cx + off.x) / f32(gn);
  let fy = f32(cy + off.y) / f32(gn);

  let ev = eval_surface_height(fx, fy);
  let eps = 1.0 / f32(gn);
  let ev_r = eval_surface_height(min(1.0, fx + eps), fy);
  let ev_u = eval_surface_height(fx, min(1.0, fy + eps));

  let world_x = (fx * 2.0 - 1.0) * 1.15;
  let world_z = (fy * 2.0 - 1.0) * 1.15;
  let world_y = ev.x;
  let wpos = vec3<f32>(world_x, world_y, world_z);

  let dx = 2.30 * eps;
  let tx = vec3<f32>(dx, ev_r.x - ev.x, 0.0);
  let tz = vec3<f32>(0.0, ev_u.x - ev.x, dx);
  let nrm = normalize(cross(tz, tx));

  let view = project_p3d(wpos);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);

  var out: Poly3DOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
  out.uv_tp = vec2<f32>(fx, fy);
  out.world_pos = wpos;
  out.normal = nrm;
  out.eval_vec = ev;
  return out;
}

@fragment
fn fs_poly3d_mesh(in: Poly3DOut) -> @location(0) vec4<f32> {
  let log_t = mix(u.bounds.x, u.bounds.y, in.uv_tp.x);
  let log_p = mix(u.bounds.z, u.bounds.w, in.uv_tp.y);
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);
  let res = eval_polytope_atlas_2d(&polytope_atlas, T, P);

  let n = normalize(in.normal);
  let light1 = normalize(vec3<f32>(-0.45, 0.80, 0.40));
  let light2 = normalize(vec3<f32>(0.65, 0.45, -0.55));
  let diff = max(0.24, dot(n, light1)) * 0.85 + max(0.0, dot(n, light2)) * 0.28;
  let half_v = normalize(light1 + vec3<f32>(0.0, 0.35, 0.94));
  let spec = pow(max(0.0, dot(n, half_v)), 26.0) * 0.34;

  if (res.w < 0.5) {
    let hatch = step(0.84, fract((in.uv_tp.x + in.uv_tp.y) * 26.0)) * 0.14;
    let col = vec3<f32>(0.09, 0.04, 0.07) + vec3<f32>(hatch, hatch * 0.25, hatch * 0.35);
    return vec4<f32>(col, 1.0);
  }

  let rho = max(1e-5, res.x);
  let margin = res.y;
  let pcode = u32(max(0.0, floor(res.z + 0.5)));
  var base_col = vec3<f32>(0.24, 0.72, 1.00);
  if (pcode == 1u) { base_col = vec3<f32>(0.16, 0.85, 0.60); }
  else if (pcode == 2u) { base_col = vec3<f32>(0.99, 0.58, 0.22); }
  else if (pcode >= 3u) { base_col = vec3<f32>(0.76, 0.48, 1.00); }

  let lrho = log2(rho) * 0.3010299956639812;
  let contour = smoothstep(0.055, 0.0, abs(fract(lrho * 1.5) - 0.5)) * 0.11;
  let er_edge = lookup_polytope_rel_err(T, P, in.uv_tp.x, in.uv_tp.y).y;
  let facet_glow = select(0.0, smoothstep(0.008, 0.0, er_edge) * 0.48, u.md_beacon.w > 0.5);
  let cliff = smoothstep(0.50, 0.96, 1.0 - abs(n.y)) * 0.14;

  var col = base_col * diff + vec3<f32>(spec * 0.7 + contour) + vec3<f32>(0.96, 0.92, 0.72) * facet_glow + base_col * cliff;
  if (u.probe_state.z > 0.5) {
    let d_pr = length(in.uv_tp - u.probe_state.xy);
    let ring = smoothstep(0.012, 0.0, abs(d_pr - 0.028)) * 0.95;
    let dot_p = smoothstep(0.014, 0.0, d_pr) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.94, 0.45), clamp(ring + dot_p, 0.0, 1.0));
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_poly3d_lines(@builtin(vertex_index) vid: u32) -> LineOut {
  var p = vec3<f32>(0.0);
  var col = vec4<f32>(0.36, 0.72, 1.0, 0.32);

  let bx = 1.15;
  let y0 = -0.58;
  let y1 = 0.66;

  if (vid < 24u) {
    var box_e = array<vec3<f32>, 24>(
      vec3<f32>(-bx, y0, -bx), vec3<f32>( bx, y0, -bx),
      vec3<f32>(-bx, y0,  bx), vec3<f32>( bx, y0,  bx),
      vec3<f32>(-bx, y0, -bx), vec3<f32>(-bx, y0,  bx),
      vec3<f32>( bx, y0, -bx), vec3<f32>( bx, y0,  bx),
      vec3<f32>(-bx, y1, -bx), vec3<f32>( bx, y1, -bx),
      vec3<f32>(-bx, y1,  bx), vec3<f32>( bx, y1,  bx),
      vec3<f32>(-bx, y1, -bx), vec3<f32>(-bx, y1,  bx),
      vec3<f32>( bx, y1, -bx), vec3<f32>( bx, y1,  bx),
      vec3<f32>(-bx, y0, -bx), vec3<f32>(-bx, y1, -bx),
      vec3<f32>( bx, y0, -bx), vec3<f32>( bx, y1, -bx),
      vec3<f32>(-bx, y0,  bx), vec3<f32>(-bx, y1,  bx),
      vec3<f32>( bx, y0,  bx), vec3<f32>( bx, y1,  bx)
    );
    p = box_e[vid];
    if (vid < 2u) { col = vec4<f32>(1.0, 0.62, 0.32, 0.78); }
    else if (vid == 4u || vid == 5u) { col = vec4<f32>(0.34, 0.86, 1.0, 0.78); }
    else if (vid == 16u || vid == 17u) { col = vec4<f32>(0.34, 0.96, 0.66, 0.78); }
  } else if (vid < 40u) {
    let gi = vid - 24u;
    let line_id = gi / 2u;
    let end_id = gi % 2u;
    let is_z = line_id >= 4u;
    let k = f32((line_id % 4u) + 1u) / 5.0;
    let coord = (k * 2.0 - 1.0) * bx;
    let span = select(-bx, bx, end_id == 1u);
    p = select(vec3<f32>(coord, y0, span), vec3<f32>(span, y0, coord), is_z);
    col = vec4<f32>(0.34, 0.56, 0.82, 0.22);
  } else if (vid < 44u) {
    if (u.probe_state.z > 0.5) {
      let fx = clamp(u.probe_state.x, 0.0, 1.0);
      let fy = clamp(u.probe_state.y, 0.0, 1.0);
      let ev = eval_surface_height(fx, fy);
      let wx = (fx * 2.0 - 1.0) * bx;
      let wz = (fy * 2.0 - 1.0) * bx;
      let wy_top = select(y0 + 0.35, ev.x + 0.24, ev.w > 0.5);
      let pi = vid - 40u;
      if (pi == 0u) { p = vec3<f32>(wx, y0, wz); }
      else if (pi == 1u) { p = vec3<f32>(wx, wy_top, wz); }
      else if (pi == 2u) { p = vec3<f32>(wx - 0.08, wy_top, wz); }
      else { p = vec3<f32>(wx + 0.08, wy_top, wz); }
      col = select(vec4<f32>(1.0, 0.32, 0.32, 1.0), vec4<f32>(1.0, 0.92, 0.35, 1.0), ev.w > 0.5);
    } else {
      col = vec4<f32>(0.0);
    }
  } else {
    if (u.md_beacon.z > 0.5) {
      let fx = clamp(u.md_beacon.x, 0.0, 1.0);
      let fy = clamp(u.md_beacon.y, 0.0, 1.0);
      let ev = eval_surface_height(fx, fy);
      let wx = (fx * 2.0 - 1.0) * bx;
      let wz = (fy * 2.0 - 1.0) * bx;
      p = select(vec3<f32>(wx, y0, wz), vec3<f32>(wx, ev.x + 0.28, wz), vid == 45u);
      col = vec4<f32>(0.22, 0.96, 1.0, 0.95);
    } else {
      col = vec4<f32>(0.0);
    }
  }

  let view = project_p3d(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  var out: LineOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
  out.color = col;
  return out;
}

@fragment
fn fs_poly3d_lines(in: LineOut) -> @location(0) vec4<f32> {
  if (in.color.a <= 0.01) { discard; }
  return in.color;
}

struct ResOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_poly_residual(@builtin(vertex_index) vid: u32) -> ResOut {
  var pts = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var out: ResOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_poly_residual(in: ResOut) -> @location(0) vec4<f32> {
  if (in.uv.x < 0.06 || in.uv.x > 0.96 || in.uv.y < 0.08 || in.uv.y > 0.90) {
    return vec4<f32>(0.024, 0.042, 0.078, 1.0);
  }
  let fx = (in.uv.x - 0.06) / 0.90;
  let fy = (in.uv.y - 0.08) / 0.82;
  let T = pow(10.0, mix(u.bounds.x, u.bounds.y, fx));
  let P = pow(10.0, mix(u.bounds.z, u.bounds.w, fy));
  let er = lookup_polytope_rel_err(T, P, fx, fy);
  var col = vec3<f32>(0.05, 0.04, 0.07);
  if (er.x < 0.0) {
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.085;
    col = vec3<f32>(0.07, 0.04, 0.07) + vec3<f32>(hatch, hatch * 0.35, hatch * 0.45);
  } else {
    let log_e = log2(max(1e-5, er.x)) * 0.3010299956639812;
    let t = clamp((log_e + 4.5) / 3.2, 0.0, 1.0);
    let c0 = vec3<f32>(0.12, 0.24, 0.64);
    let c1 = vec3<f32>(0.14, 0.78, 0.66);
    let c2 = vec3<f32>(0.98, 0.78, 0.22);
    let c3 = vec3<f32>(0.96, 0.26, 0.28);
    if (t < 0.35) { col = mix(c0, c1, t / 0.35); }
    else if (t < 0.72) { col = mix(c1, c2, (t - 0.35) / 0.37); }
    else { col = mix(c2, c3, (t - 0.72) / 0.28); }
    let edge = smoothstep(0.0055, 0.0, er.y) * 0.68;
    col = mix(col, vec3<f32>(0.96, 0.98, 1.0), edge);
  }
  if (u.probe_state.z > 0.5) {
    let d_pt = length(vec2<f32>(fx - u.probe_state.x, fy - u.probe_state.y));
    let ring = smoothstep(0.006, 0.0, abs(d_pt - 0.022)) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.95, 0.55), ring);
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;function Pn(e){let t=Math.max(1,Math.min(118,Math.trunc(Number(e)||1)));return t===1?[.95,.97,1]:t===6?[.36,.4,.46]:t===7?[.24,.5,.98]:t===8?[.95,.24,.24]:t===9||t===17?[.22,.88,.46]:t===15?[1,.55,.16]:t===16?[.98,.86,.22]:t===35?[.76,.26,.22]:t===53?[.64,.24,.86]:t===3||t===11||t===19||t===37||t===55||t===87?[.68,.46,.98]:t===4||t===12||t===20||t===38||t===56||t===88?[.3,.84,.36]:t===13||t===14||t===31||t===32||t===50||t===82?[.68,.76,.86]:t===26?[.9,.46,.26]:t===29?[.92,.54,.3]:t===47?[.85,.88,.94]:t===79?[.98,.82,.28]:t===30?[.56,.62,.86]:t===2||t===10||t===18||t===36||t===54||t===86||t===118?[.36,.88,.96]:[.72,.76,.86]}function Fn(e){let t=Math.max(1,Math.min(118,Math.trunc(Number(e)||1)));return t===1?.54:t<=2?.58:t<=10?.78:t<=18?.94:t<=36?1.04:1.14}function In(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`Failed to acquire WebGPU canvas context on #gpu-canvas`);let r=navigator.gpu.getPreferredCanvasFormat(),i=Math.max(2048,Number(e.limits?.maxTextureDimension2D)||4096),a=0,o=0;function s(s,c){let l=Math.max(64,Math.min(i,Math.trunc(s))),u=Math.max(64,Math.min(i,Math.trunc(c)));t.width=l,t.height=u;let d=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],f=!1,p=null;for(let e of d)try{n.configure(e),f=!0;break}catch(e){p=e}if(!f&&p)throw p;a=l,o=u}let c=t.getBoundingClientRect(),l=typeof window<`u`&&(window.innerWidth<1120||window.matchMedia?.(`(pointer: coarse)`)?.matches),u=Math.min(typeof window<`u`&&window.devicePixelRatio||1,l?1.5:2);s(Math.max(64,Math.round((c.width||t.clientWidth||640)*u)),Math.max(64,Math.round((c.height||t.clientHeight||480)*u)));let d=e.createShaderModule({code:Sn,label:`ulg-lab-atomic-vol-cs`}),f=e.createComputePipeline({label:`ulg-lab-atomic-vol-pipe`,layout:`auto`,compute:{module:d,entryPoint:`build_atomic_volume`}}),p=e.createShaderModule({code:Cn,label:`ulg-lab-vol-raymarch`}),m=e.createRenderPipeline({label:`ulg-lab-vol-raymarch-pipe`,layout:`auto`,vertex:{module:p,entryPoint:`vs_fullscreen`},fragment:{module:p,entryPoint:`fs_raymarch`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),h=e.createShaderModule({code:wn,label:`ulg-lab-instanced-atoms`}),g=e.createRenderPipeline({label:`ulg-lab-instanced-atoms-pipe`,layout:`auto`,vertex:{module:h,entryPoint:`vs_atom`},fragment:{module:h,entryPoint:`fs_atom`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),_=e.createRenderPipeline({label:`ulg-lab-md-wireframe-pipe`,layout:`auto`,vertex:{module:h,entryPoint:`vs_wire`},fragment:{module:h,entryPoint:`fs_wire`,targets:[{format:r,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),v=e.createShaderModule({code:Tn,label:`ulg-lab-polytope-shader`}),y=e.createRenderPipeline({label:`ulg-lab-polytope-pipe`,layout:`auto`,vertex:{module:v,entryPoint:`vs_poly`},fragment:{module:v,entryPoint:`fs_poly`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),b=e.createShaderModule({code:bn,label:`ulg-lab-comp-nuc-cs`}),x=e.createComputePipeline({label:`ulg-lab-comp-nuc-pipe`,layout:`auto`,compute:{module:b,entryPoint:`build_composite_nuclear_volume`}}),S=e.createShaderModule({code:xn,label:`ulg-lab-poly-probe-cs`}),C=e.createComputePipeline({label:`ulg-lab-poly-probe-pipe`,layout:`auto`,compute:{module:S,entryPoint:`probe_polytope_point`}}),w={color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}},T={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},E=e.createShaderModule({code:En,label:`ulg-lab-orbital-cloud`}),D=e.createRenderPipeline({label:`ulg-lab-orbital-cloud-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_cloud`},fragment:{module:E,entryPoint:`fs_cloud`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),O=e.createRenderPipeline({label:`ulg-lab-orbital-nuc-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_nucleus`},fragment:{module:E,entryPoint:`fs_nucleus`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),k=e.createRenderPipeline({label:`ulg-lab-orbital-guides-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_guides`},fragment:{module:E,entryPoint:`fs_guides`,targets:[{format:r,blend:T}]},primitive:{topology:`line-list`}}),A=e.createShaderModule({code:Dn,label:`ulg-lab-photon-shell-scene`}),ee=e.createRenderPipeline({label:`ulg-lab-ps-wave-plane-pipe`,layout:`auto`,vertex:{module:A,entryPoint:`vs_wave_plane`},fragment:{module:A,entryPoint:`fs_wave_plane`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),te=e.createRenderPipeline({label:`ulg-lab-ps-shells-pipe`,layout:`auto`,vertex:{module:A,entryPoint:`vs_driven_shells`},fragment:{module:A,entryPoint:`fs_shell_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),ne=e.createBuffer({size:80,usage:N.UNIFORM|N.COPY_DST}),j=e.createBuffer({size:80,usage:N.UNIFORM|N.COPY_DST}),re=e.createBuffer({size:256,usage:N.STORAGE|N.COPY_DST}),ie=e.createBuffer({size:256,usage:N.STORAGE|N.COPY_DST}),ae=e.createShaderModule({code:kn,label:`ulg-lab-spin-llg-render`}),oe=e.createRenderPipeline({label:`ulg-lab-spin-arrow-pipe`,layout:`auto`,vertex:{module:ae,entryPoint:`vs_spin_arrow`},fragment:{module:ae,entryPoint:`fs_spin_arrow`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),se=e.createBuffer({size:48,usage:N.UNIFORM|N.COPY_DST}),ce=e.createShaderModule({code:An,label:`ulg-lab-electron-tr-render`}),le=e.createRenderPipeline({label:`ulg-lab-tr-ions-pipe`,layout:`auto`,vertex:{module:ce,entryPoint:`vs_phonon_ions`},fragment:{module:ce,entryPoint:`fs_tr_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),ue=e.createRenderPipeline({label:`ulg-lab-tr-carriers-pipe`,layout:`auto`,vertex:{module:ce,entryPoint:`vs_carriers`},fragment:{module:ce,entryPoint:`fs_tr_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),de=e.createBuffer({size:48,usage:N.UNIFORM|N.COPY_DST}),fe=e.createShaderModule({code:On,label:`ulg-lab-tdks-photon-cloud`}),pe=e.createRenderPipeline({label:`ulg-lab-tdks-field-pipe`,layout:`auto`,vertex:{module:fe,entryPoint:`vs_tdks_field`},fragment:{module:fe,entryPoint:`fs_tdks_field`,targets:[{format:r,blend:T}]},primitive:{topology:`triangle-list`}}),me=e.createRenderPipeline({label:`ulg-lab-tdks-cloud-pipe`,layout:`auto`,vertex:{module:fe,entryPoint:`vs_tdks_cloud`},fragment:{module:fe,entryPoint:`fs_tdks_cloud`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),he=e.createBuffer({size:96,usage:N.UNIFORM|N.COPY_DST}),ge=e.createShaderModule({code:jn,label:`ulg-lab-mol-3d`}),_e=e.createRenderPipeline({label:`ulg-lab-mol-atom-pipe`,layout:`auto`,vertex:{module:ge,entryPoint:`vs_mol_atom`},fragment:{module:ge,entryPoint:`fs_mol_atom`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),ve=e.createRenderPipeline({label:`ulg-lab-mol-bond-pipe`,layout:`auto`,vertex:{module:ge,entryPoint:`vs_mol_bond`},fragment:{module:ge,entryPoint:`fs_mol_bond`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),ye=e.createRenderPipeline({label:`ulg-lab-mol-box-pipe`,layout:`auto`,vertex:{module:ge,entryPoint:`vs_mol_box`},fragment:{module:ge,entryPoint:`fs_mol_box`,targets:[{format:r,blend:T}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),be=e.createBuffer({size:64,usage:N.UNIFORM|N.COPY_DST}),xe=e.createBuffer({size:256*16,usage:N.STORAGE|N.COPY_DST}),Se=e.createBuffer({size:256*16,usage:N.STORAGE|N.COPY_DST}),Ce=e.createBuffer({size:512*16,usage:N.STORAGE|N.COPY_DST}),we=e.createBuffer({size:512*16,usage:N.STORAGE|N.COPY_DST}),Te=256,Ee=512,De=e.createShaderModule({code:Mn,label:`ulg-lab-reactive-md-render`}),Oe=e.createRenderPipeline({label:`ulg-lab-rx-mol-pipe`,layout:`auto`,vertex:{module:De,entryPoint:`vs_rx_mol`},fragment:{module:De,entryPoint:`fs_rx_mol`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),ke=e.createRenderPipeline({label:`ulg-lab-rx-box-pipe`,layout:`auto`,vertex:{module:De,entryPoint:`vs_rx_box`},fragment:{module:De,entryPoint:`fs_rx_box`,targets:[{format:r,blend:T}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),Ae=e.createBuffer({size:32,usage:N.UNIFORM|N.COPY_DST}),je=e.createShaderModule({code:Nn,label:`ulg-lab-polytope-3d`}),Me=e.createRenderPipeline({label:`ulg-lab-poly3d-mesh-pipe`,layout:`auto`,vertex:{module:je,entryPoint:`vs_poly3d_mesh`},fragment:{module:je,entryPoint:`fs_poly3d_mesh`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),Ne=e.createRenderPipeline({label:`ulg-lab-poly3d-lines-pipe`,layout:`auto`,vertex:{module:je,entryPoint:`vs_poly3d_lines`},fragment:{module:je,entryPoint:`fs_poly3d_lines`,targets:[{format:r,blend:T}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),Pe=e.createRenderPipeline({label:`ulg-lab-poly-residual-pipe`,layout:`auto`,vertex:{module:je,entryPoint:`vs_poly_residual`},fragment:{module:je,entryPoint:`fs_poly_residual`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),Fe=e.createBuffer({size:80,usage:N.UNIFORM|N.COPY_DST}),Ie=e.createBuffer({size:48,usage:N.UNIFORM|N.COPY_DST}),Le=e.createBuffer({size:80,usage:N.UNIFORM|N.COPY_DST}),Re=e.createBuffer({size:80,usage:N.UNIFORM|N.COPY_DST}),ze=e.createBuffer({size:32,usage:N.UNIFORM|N.COPY_DST}),Be=e.createBuffer({size:16,usage:N.UNIFORM|N.COPY_DST}),Ve=e.createBuffer({size:16,usage:N.STORAGE|N.COPY_SRC}),He=e.createBuffer({size:16,usage:N.MAP_READ|N.COPY_DST}),Ue=e.createBuffer({size:16,usage:N.UNIFORM|N.COPY_DST}),We=null,Ge=0,Ke=!1,qe=e.createBuffer({size:16,usage:N.STORAGE|N.COPY_DST}),Je=e.createBuffer({size:16,usage:N.STORAGE|N.COPY_DST}),Ye=null,Xe=0,Ze=0,Qe=null,$e=0,et=null,tt=0,nt=null,rt=0,it=null,at=0,ot=null,st=0,ct=null,lt=0,ut=e.createBuffer({size:32,usage:N.UNIFORM|N.COPY_DST}),dt=null,ft=0,pt=null,mt=0,ht=null,gt=null,_t=null,vt=null;function yt(){let n=t.getBoundingClientRect();if(n.width<2||n.height<2)return{w:a||320,h:o||240};let r=typeof window<`u`&&(window.innerWidth<1120||window.matchMedia?.(`(pointer: coarse)`)?.matches),c=Math.min(typeof window<`u`&&window.devicePixelRatio||1,r?1.5:2),l=Math.max(64,Math.min(i,Math.round(n.width*c))),u=Math.max(64,Math.min(i,Math.round(n.height*c)));return(t.width!==l||t.height!==u||a!==l||o!==u)&&s(l,u),(!Ye||Xe!==l||Ze!==u)&&(Ye&&Ye.destroy(),Ye=e.createTexture({size:[l,u],format:`depth24plus`,usage:16}),Xe=l,Ze=u),{w:l,h:u}}function bt({rGrid:t,rhoGrid:n,valenceL:r=0,unpairedCount:i=0,totalElectrons:a=1,dim:o=32}){let s=t.length,c=o*o*o,l=c*16;(!it||at!==o)&&(it&&it.destroy(),it=e.createBuffer({label:`ulg-lab-atomic-vol-3d`,size:l,usage:N.STORAGE}),at=o);let u=Math.max(16,s*4);(!ot||st<u)&&(ot=e.createBuffer({size:u,usage:N.STORAGE|N.COPY_DST}),st=u),(!ct||lt<u)&&(ct=e.createBuffer({size:u,usage:N.STORAGE|N.COPY_DST}),lt=u);let d=Float32Array.from(t),p=Float32Array.from(n),m=Math.min(8.5,d[s-1]||8),h=i>0?Math.min(1,i/Math.max(1,Math.min(10,a))*1.4):0,g=new ArrayBuffer(32);new Uint32Array(g,0,4).set([o,s,r>>>0,i>>>0]),new Float32Array(g,16,4).set([m,h,0,0]),e.queue.writeBuffer(ot,0,d),e.queue.writeBuffer(ct,0,p),e.queue.writeBuffer(ut,0,g);let _=e.createBindGroup({layout:f.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ut}},{binding:1,resource:{buffer:ot}},{binding:2,resource:{buffer:ct}},{binding:3,resource:{buffer:it}}]}),v=e.createCommandEncoder({label:`ulg-lab-atomic-vol-enc`}),y=v.beginComputePass();return y.setPipeline(f),y.setBindGroup(0,_),y.dispatchWorkgroups(Math.ceil(c/64)),y.end(),e.queue.submit([v.finish()]),{buffer:it,dim:o}}function xt({gpuVec4Buffer:t=null,vec4Data:r=null,scalarData:i=null,dim:a=24,channels:o=4,yaw:s=.48,pitch:c=.28,tint:l=[.34,.76,1],showFermiIso:u=!1}){let{w:d,h:f}=yt(),p=qe,h=Je;if(o===4){if(t)p=t;else if(r){let t=Math.max(16,r.byteLength);(!Qe||$e<t)&&(Qe&&Qe.destroy(),Qe=e.createBuffer({size:t,usage:N.STORAGE|N.COPY_DST}),$e=t,ht=null),ht!==r&&(e.queue.writeBuffer(Qe,0,r),ht=r),p=Qe}}else if(i){let t=Math.max(16,i.byteLength);(!et||tt<t)&&(et&&et.destroy(),et=e.createBuffer({size:t,usage:N.STORAGE|N.COPY_DST}),tt=t,gt=null),gt!==i&&(e.queue.writeBuffer(et,0,i),gt=i),h=et}let g=new ArrayBuffer(48);new Float32Array(g,0,4).set([d,f,s,c]),new Uint32Array(g,16,4).set([a>>>0,o>>>0,+!!u,0]),new Float32Array(g,32,4).set([l[0]??.34,l[1]??.76,l[2]??1,1]),e.queue.writeBuffer(Ie,0,g);let _=e.createBindGroup({layout:m.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ie}},{binding:1,resource:{buffer:p}},{binding:2,resource:{buffer:h}}]}),v=e.createCommandEncoder({label:`ulg-lab-render-vol`}),y=v.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});y.setPipeline(m),y.setBindGroup(0,_),y.draw(3),y.end(),e.queue.submit([v.finish()])}function St({positionsBuffer:t,velocitiesBuffer:r,forcesBuffer:i=null,atomCount:a,boxLengthsA:o,initBoxLengthsA:s=null,rNearestNeighborA:c=null,meltingPointK:l=600,cohesiveEnergyEv:u=1.5,colorMode:d=0,gravityEnabled:f=!1,yaw:p=.45,pitch:m=.32,camDist:h=3.25,tint:v=[.65,.8,.96]}){if(!t||!r||!(a>0))return;let{w:y,h:b}=yt(),x=Number(o?.[0]||10),S=Number(o?.[1]||x),C=Number(o?.[2]||x),w=Number(s?.[0]||x),T=Number(s?.[1]||S),E=Number(s?.[2]||C),D=Math.min(x,S,C),O=Number.isFinite(Number(c))&&Number(c)>.8?Math.max(.65,Math.min(2.6,.43*Number(c))):Math.max(.65,.48/Math.cbrt(Math.max(8,a))*D),k=Math.max(1.75,Math.min(6.4,Number(h)||3.25)),A=Math.max(25,Number(l)||600),ee=Math.max(.08,Number(u)||1.5),te=+!!f,ne=new Float32Array([y,b,p,m,x,S,C,O,w,T,E,k,v[0]??.65,v[1]??.8,v[2]??.96,A,Number(d)||0,ee,0,te]);e.queue.writeBuffer(Le,0,ne);let j=x*S*C/Math.max(1e-6,w*T*E),re=Math.abs(j-1)>.025;if(re){let t=new Float32Array(ne);t[18]=1,e.queue.writeBuffer(Re,0,t)}let ie=e.createBindGroup({layout:g.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}},{binding:3,resource:{buffer:i||r}}]}),ae=e.createBindGroup({layout:_.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Le}}]}),oe=e.createCommandEncoder({label:`ulg-lab-render-md`}),se=oe.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});if(se.setPipeline(g),se.setBindGroup(0,ie),se.draw(6,a),se.setPipeline(_),se.setBindGroup(0,ae),se.draw(f?48:24,1),re){let t=e.createBindGroup({layout:_.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Re}}]});se.setBindGroup(0,t),se.draw(24,1)}se.end(),e.queue.submit([oe.finish()])}function Ct({positions:t,velocities:n,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s}){if(!t||!n||!(r>0))return;let c=Math.max(16,t.byteLength),l=Math.max(16,n.byteLength);(!dt||ft<c)&&(dt=e.createBuffer({size:c,usage:N.STORAGE|N.COPY_DST}),ft=c,vt=null),(!pt||mt<l)&&(pt=e.createBuffer({size:l,usage:N.STORAGE|N.COPY_DST}),mt=l,vt=null),vt!==t&&(e.queue.writeBuffer(dt,0,t),e.queue.writeBuffer(pt,0,n),vt=t),St({positionsBuffer:dt,velocitiesBuffer:pt,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s,velocityColorScale:1})}function wt(e){if(!e?.polytopes?.length)return{minLt:1,maxLt:4.2,minLp:2,maxLp:10};let t=Math.log10(Math.max(1,Math.min(...e.polytopes.map(e=>e.axes[0].min)))),n=Math.log10(Math.max(10,Math.max(...e.polytopes.map(e=>e.axes[0].max)))),r=Math.min(...e.polytopes.map(e=>Math.log10(e.axes[1].min))),i=Math.max(...e.polytopes.map(e=>Math.log10(e.axes[1].max))),a=Math.max(.12,(n-t)*.08),o=Math.max(.35,(i-r)*.08);return{minLt:t-a,maxLt:n+a,minLp:r-o,maxLp:i+o}}function Tt(t){let n=t.packedGpuAtlas.data,r=Math.max(64,n.byteLength);return(!nt||rt<r)&&(nt&&nt.destroy(),nt=e.createBuffer({size:r,usage:N.STORAGE|N.COPY_DST}),rt=r,_t=null),_t!==n&&(e.queue.writeBuffer(nt,0,n),_t=n),nt}function Et(t=[],n=24){if(!Array.isArray(t)||t.length===0)return null;let r=n*n*n,i=r*16;(!We||Ge!==n)&&(We&&We.destroy(),We=e.createBuffer({label:`ulg-lab-comp-nuc-vol-3d`,size:i,usage:N.STORAGE}),Ge=n);let a=Math.min(16,t.length),o=new Float32Array(a*4),s=new Float32Array(a*4),c=.01;for(let e=0;e<a;e+=1)c=Math.max(c,Math.abs(t[e].x||0),Math.abs(t[e].y||0),Math.abs(t[e].z||0));let l=a===1?0:.58/c;for(let e=0;e<a;e+=1){let n=t[e],r=Math.max(1.2,Number(n.chargeRadiusFm||3)),i=Math.max(.14,Math.min(.36,.12+.032*r));o.set([(n.x||0)*l,(n.y||0)*l,(n.z||0)*l,i],e*4),s.set([Math.max(1,Number(n.Z||1)),Math.max(0,Number(n.N||0)),1.05,.95],e*4)}e.queue.writeBuffer(Ue,0,new Uint32Array([n>>>0,a>>>0,0,0])),e.queue.writeBuffer(re,0,o),e.queue.writeBuffer(ie,0,s);let u=e.createBindGroup({layout:x.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ue}},{binding:1,resource:{buffer:re}},{binding:2,resource:{buffer:ie}},{binding:3,resource:{buffer:We}}]}),d=e.createCommandEncoder({label:`ulg-lab-comp-nuc-enc`}),f=d.beginComputePass();return f.setPipeline(x),f.setBindGroup(0,u),f.dispatchWorkgroups(Math.ceil(r/64)),f.end(),e.queue.submit([d.finish()]),{buffer:We,dim:n}}async function Dt(t,n,r){if(!t?.packedGpuAtlas?.data||Ke)return null;Ke=!0;try{let i=Tt(t);e.queue.writeBuffer(Be,0,new Float32Array([Number(n),Number(r),0,0]));let a=e.createBindGroup({layout:C.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Be}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:Ve}}]}),o=e.createCommandEncoder({label:`ulg-lab-poly-probe`}),s=o.beginComputePass();s.setPipeline(C),s.setBindGroup(0,a),s.dispatchWorkgroups(1),s.end(),o.copyBufferToBuffer(Ve,0,He,0,16),e.queue.submit([o.finish()]),await He.mapAsync(N.MAP_READ);let c=new Float32Array(He.getMappedRange().slice(0,16));He.unmap();let l=c[3]>.5,u=Math.round(c[2]);return Object.freeze({temperatureK:Number(n),pressurePa:Number(r),hit:l,failClosed:!l,densityKgPerM3:l?c[0]:null,margin:c[1],phaseCode:l?u:-1,phase:l?[`solid`,`liquid`,`gas`,`plasma`][Math.max(0,Math.min(3,u))]||`solid`:`OUT OF DOMAIN (FAIL-CLOSED)`})}finally{Ke=!1}}function Ot(t,r=null){if(!t?.packedGpuAtlas?.data||!t?.polytopes?.length)return;yt();let i=Tt(t),{minLt:a,maxLt:o,minLp:s,maxLp:c}=wt(t),l=r&&Number.isFinite(r.fx)&&Number.isFinite(r.fy)?1:0;e.queue.writeBuffer(ze,0,new Float32Array([a,o,s,c,l>.5?r.fx:-1,l>.5?r.fy:-1,l,0]));let u=e.createBindGroup({layout:y.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ze}},{binding:1,resource:{buffer:i}}]}),d=e.createCommandEncoder({label:`ulg-lab-render-polytope`}),f=d.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});f.setPipeline(y),f.setBindGroup(0,u),f.draw(3),f.end(),e.queue.submit([d.finish()])}function kt({pointsBuffer:t,pointCount:r,yaw:i=.48,pitch:a=.3,camDist:o=2.65,pointSize:s=.011,opacity:c=.22,alternateShellColors:l=!0,colorA:u=[1,1,1],colorB:d=[.38,.17,.87],showGuides:f=!1,showNucleus:p=!0,starkMixLambda:m=0,eFieldNorm:h=0}){if(!t||!(r>0))return;let{w:g,h:_}=yt();e.queue.writeBuffer(ne,0,new Float32Array([g,_,i,a,o,s,c,+!!l,u[0]??1,u[1]??1,u[2]??1,+!!f,d[0]??.38,d[1]??.17,d[2]??.87,.018,m,h,0,0]));let v=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}},{binding:1,resource:{buffer:t}}]}),y=e.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}}]}),b=f?e.createBindGroup({layout:k.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}}]}):null,x=e.createCommandEncoder({label:`ulg-lab-render-orbital-cloud`}),S=x.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.011,b:.02,a:1}}]});f&&b&&(S.setPipeline(k),S.setBindGroup(0,b),S.draw(50)),S.setPipeline(D),S.setBindGroup(0,v),S.draw(6,r),p&&(S.setPipeline(O),S.setBindGroup(0,y),S.draw(6)),S.end(),e.queue.submit([x.finish()])}function At({photonSession:t,shellPointsBuffer:r,shellPointCount:i=1800,yaw:a=.08,pitch:o=1.05,camDist:s=3.25,modeMono:c=!1,probeRgb:l=[.22,.96,.44],slabTint:u=[.94,.85,.52],waveGain:d=1}){if(!t?.ezFieldBuffer||!t?.shellStateBuffer)return;let{w:f,h:p}=yt(),m=r?Math.floor(r.size/16):0,h=Math.max(256,Math.min(2e3,m,Math.trunc(i))),g=t.getParams();e.queue.writeBuffer(j,0,new Float32Array([f,p,a,o,t.nx,t.ny,t.slabX0,t.slabX1,+!!c,+!!g.isMetal,h,s,u[0]??.85,u[1]??.85,u[2]??.9,.24,l[0]??.25,l[1]??.92,l[2]??.45,d]));let _=e.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:j}},{binding:1,resource:{buffer:t.ezFieldBuffer}},{binding:2,resource:{buffer:t.shellStateBuffer}}]}),v=r&&h>0?e.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:j}},{binding:2,resource:{buffer:t.shellStateBuffer}},{binding:3,resource:{buffer:r}}]}):null,y=e.createCommandEncoder({label:`ulg-lab-render-photon-shell`}),b=y.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.012,b:.024,a:1}}]});b.setPipeline(ee),b.setBindGroup(0,_),b.draw(6),v&&(b.setPipeline(te),b.setBindGroup(0,v),b.draw(6,h*20)),b.end(),e.queue.submit([y.finish()])}function jt({pairCloud:t,blochSession:r,tdks3dSession:i=null,yaw:a=.24,pitch:o=.2,camDist:s=3.15,modeMono:c=!1,polMode:l=0,fieldViewMode:u=0,probeRgb:d=[.35,.55,1],emergentReflSrgb:f=[.94,.86,.65],pointSize:p=.012}){if(!t?.posBuffer||!t?.ampBuffer||!r)return;let{w:m,h}=yt(),g=c?r.channels[3]:r.channels[2],_=r.channels[0],v=r.channels[1],y=r.channels[2],b=c?g.rho11:Math.max(y.rho11,.5*(_.rho11+v.rho11)),x=Math.max(.02,1-b),S=c?2*g.rho01Re:.75*_.rho01Re+.75*v.rho01Re+1.1*y.rho01Re,C=c?g.eNow:(_.eNow+v.eNow+y.eNow)*.45,w=i?.gridN||1,T=i?.worldHalf||2,E=i?.atomRadius||1.05,D=i?.eFieldBuffer||qe,O=i?.eIncBuffer||qe,k=i?.polBuffer||qe,A=i?.jBuffer||qe;e.queue.writeBuffer(he,0,new Float32Array([m,h,a,o,s,w,T,u,x,b,S,C,l,+!!c,r.getTimeFs(),p,f[0]??.9,f[1]??.85,f[2]??.7,y.rho11,d[0]??.35,d[1]??.55,d[2]??1,E]));let ee=e.createBindGroup({layout:pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:he}},{binding:3,resource:{buffer:D}},{binding:4,resource:{buffer:O}},{binding:5,resource:{buffer:k}},{binding:6,resource:{buffer:A}}]}),te=e.createBindGroup({layout:me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:he}},{binding:1,resource:{buffer:t.posBuffer}},{binding:2,resource:{buffer:t.ampBuffer}},{binding:3,resource:{buffer:D}},{binding:4,resource:{buffer:O}},{binding:5,resource:{buffer:k}},{binding:6,resource:{buffer:A}}]}),ne=e.createCommandEncoder({label:`ulg-lab-render-tdks`}),j=ne.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.006,g:.01,b:.022,a:1}}]});i&&(j.setPipeline(pe),j.setBindGroup(0,ee),j.draw(3)),j.setPipeline(me),j.setBindGroup(0,te),j.draw(6,t.pointCount),j.end(),e.queue.submit([ne.finish()])}function Mt({spinsBuffer:t,dims:r=[10,10,10],yaw:i=.48,pitch:a=.32,camDist:o=3.1,fieldBZTesla:s=0,isAntiferro:c=!1}){if(!t)return;let{w:l,h:u}=yt(),[d,f,p]=r,m=1.65/Math.max(d,f,p);e.queue.writeBuffer(se,0,new Float32Array([l,u,i,a,d,f,p,o,s,+!!c,m,0]));let h=e.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:se}},{binding:1,resource:{buffer:t}}]}),g=e.createCommandEncoder({label:`ulg-lab-render-spins`}),_=g.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.014,g:.022,b:.044,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});_.setPipeline(oe),_.setBindGroup(0,h),_.draw(9,d*f*p+1),_.end(),e.queue.submit([g.finish()])}function Nt({posBuffer:t,velBuffer:r,carrierCount:i=1024,yaw:a=.42,pitch:o=.28,camDist:s=2.95,eFieldVPerM:c=1e4,phononVibAmp:l=.03,timeS:u=0,isSuperconducting:d=!1}){if(!t||!r||!(i>0))return;let{w:f,h:p}=yt();e.queue.writeBuffer(de,0,new Float32Array([f,p,a,o,s,l,u,+!!d,c/1e4,i,0,0]));let m=e.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}}]}),h=e.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}}]}),g=e.createCommandEncoder({label:`ulg-lab-render-transport`}),_=g.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:d?{r:.012,g:.02,b:.056,a:1}:{r:.01,g:.016,b:.034,a:1}}]});_.setPipeline(le),_.setBindGroup(0,m),_.draw(6,64),_.setPipeline(ue),_.setBindGroup(0,h),_.draw(6,i),_.end(),e.queue.submit([g.finish()])}function Pt(t,n){let r=Math.max(16,t);r>Te&&(Te=Math.max(r,Te*2),xe.destroy(),Se.destroy(),xe=e.createBuffer({size:Te*16,usage:N.STORAGE|N.COPY_DST}),Se=e.createBuffer({size:Te*16,usage:N.STORAGE|N.COPY_DST}));let i=Math.max(16,n);i>Ee&&(Ee=Math.max(i,Ee*2),Ce.destroy(),we.destroy(),Ce=e.createBuffer({size:Ee*16,usage:N.STORAGE|N.COPY_DST}),we=e.createBuffer({size:Ee*16,usage:N.STORAGE|N.COPY_DST}))}function M({atoms:t=[],bonds:r=[],mullikenCharges:i=null,dipoleVecDebye:a=null,displacements:o=null,vibPhase:s=0,vibAmplitude:c=.28,colorMode:l=0,showDipole:u=!0,orbitalCloud:d=null,yaw:f=.45,pitch:p=.28,camDist:m=3.1,timeS:h=0}){if(!Array.isArray(t)||t.length===0)return;let{w:g,h:_}=yt(),v=t.length,y=o?Math.sin(s)*c:0,b=t.map((e,t)=>{let n=Array.isArray(e.position)?e.position[0]:e.x||0,r=Array.isArray(e.position)?e.position[1]:e.y||0,i=Array.isArray(e.position)?e.position[2]:e.z||0,a=o?.[t];return[n+(a?a[0]*y:0),r+(a?a[1]*y:0),i+(a?a[2]*y:0)]}),x=0,S=0,C=0;for(let e of b)x+=e[0],S+=e[1],C+=e[2];x/=v,S/=v,C/=v;let w=1.65;for(let e=0;e<v;e+=1){let n=b[e];w=Math.max(w,Math.hypot(n[0]-x,n[1]-S,n[2]-C)+Fn(t[e].Z))}let T=1.25/w,E=[];for(let e of r||[]){let t=b[e.a],n=b[e.b];if(!t||!n)continue;let r=n[0]-t[0],i=n[1]-t[1],a=n[2]-t[2],o=Math.hypot(r,i,a);if(o<1e-4)continue;let s=r/o,c=i/o,l=a/o,u=Math.abs(l)<.85?[0,0,1]:[0,1,0],d=c*u[2]-l*u[1],f=l*u[0]-s*u[2],p=s*u[1]-c*u[0],m=Math.max(1e-5,Math.hypot(d,f,p));d/=m,f/=m,p/=m;let h=Math.max(.16,Math.min(3.5,Number(e.order)||1)),g=e.kind||(h>=2.45?`triple`:h>=1.55?`double`:h>=.6?`single`:`partial`),_=Math.min(.99,h/4);if(g===`partial`)E.push({a:t,b:n,r:.11+.08*h,modeOrder:1+_});else if(g===`double`){let e=.16;for(let r of[-1,1])E.push({a:[t[0]+d*e*r,t[1]+f*e*r,t[2]+p*e*r],b:[n[0]+d*e*r,n[1]+f*e*r,n[2]+p*e*r],r:.11,modeOrder:0+_})}else if(g===`triple`){let e=.2;for(let r of[-1,0,1])E.push({a:[t[0]+d*e*r,t[1]+f*e*r,t[2]+p*e*r],b:[n[0]+d*e*r,n[1]+f*e*r,n[2]+p*e*r],r:.095,modeOrder:0+_})}else E.push({a:t,b:n,r:.15,modeOrder:0+_})}if(u&&Array.isArray(a)&&a.length===3){let e=Math.hypot(a[0],a[1],a[2]);if(e>.08){let t=Math.min(w*.95,.7+e*.36),n=a[0]/e,r=a[1]/e,i=a[2]/e,o=[x-n*t*.45,S-r*t*.45,C-i*t*.45],s=[x+n*t*.35,S+r*t*.35,C+i*t*.35],c=[x+n*t*.72,S+r*t*.72,C+i*t*.72];E.push({a:o,b:s,r:.09,modeOrder:2.25}),E.push({a:s,b:c,r:.24,modeOrder:3.25})}}Pt(v,Math.max(1,E.length));let O=new Float32Array(v*4),k=new Float32Array(v*4);for(let e=0;e<v;e+=1){let n=b[e],r=Pn(t[e].Z),a=Array.isArray(i)&&Number(i[e])||0;O.set([n[0],n[1],n[2],Fn(t[e].Z)],e*4),k.set([r[0],r[1],r[2],a],e*4)}let A=new Float32Array(Math.max(1,E.length)*4),ee=new Float32Array(Math.max(1,E.length)*4);for(let e=0;e<E.length;e+=1){let t=E[e];A.set([t.a[0],t.a[1],t.a[2],t.r],e*4),ee.set([t.b[0],t.b[1],t.b[2],t.modeOrder],e*4)}e.queue.writeBuffer(be,0,new Float32Array([g,_,f,p,m,T,l,h,x,S,C,0,w,w,w,0])),e.queue.writeBuffer(xe,0,O),e.queue.writeBuffer(Se,0,k),e.queue.writeBuffer(Ce,0,A),e.queue.writeBuffer(we,0,ee);let te=e.createBindGroup({layout:_e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:be}},{binding:1,resource:{buffer:xe}},{binding:2,resource:{buffer:Se}}]}),j=E.length>0?e.createBindGroup({layout:ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:be}},{binding:3,resource:{buffer:Ce}},{binding:4,resource:{buffer:we}}]}):null,re=e.createCommandEncoder({label:`ulg-lab-render-mol3d`}),ie=re.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.012,g:.02,b:.04,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});if(j&&(ie.setPipeline(ve),ie.setBindGroup(0,j),ie.draw(6,E.length)),ie.setPipeline(_e),ie.setBindGroup(0,te),ie.draw(6,v),ie.end(),d?.pointsBuffer&&d.pointCount>0){e.queue.writeBuffer(ne,0,new Float32Array([g,_,f,p,m,.013,.24,1,1,.64,.3,0,.38,.72,1,.014,0,0,0,0]));let t=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}},{binding:1,resource:{buffer:d.pointsBuffer}}]}),r=re.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`load`,storeOp:`store`}]});r.setPipeline(D),r.setBindGroup(0,t),r.draw(6,d.pointCount),r.end()}e.queue.submit([re.finish()])}function Ft({crystal:t,colorMode:r=0,yaw:i=.48,pitch:a=.3,camDist:o=3.25}){if(!t?.positions||!(t.atomCount>0))return;let{w:s,h:c}=yt(),l=t.atomCount,u=t.bondCount||0,d=t.boxLengthsA?.[0]||8,f=t.boxLengthsA?.[1]||d,p=t.boxLengthsA?.[2]||d,m=d*.5,h=f*.5,g=p*.5,_=Math.max(d,f,p)*.5,v=1.05/Math.max(1,_);Pt(l,Math.max(1,u));let y=new Float32Array(l*4),b=new Float32Array(l*4);for(let e=0;e<l;e+=1){let n=t.positions[e*4+0],r=t.positions[e*4+1],i=t.positions[e*4+2],a=t.positions[e*4+3],o=t.speciesMeta[e*4+0],s=t.speciesMeta[e*4+1],c=Pn(o);y.set([n,r,i,Math.max(.28,Math.min(.68,a*.42))],e*4),b.set([c[0],c[1],c[2],s*.55],e*4)}let x=new Float32Array(Math.max(1,u)*4),S=new Float32Array(Math.max(1,u)*4);for(let e=0;e<u;e+=1){let n=t.bonds[e*2+0],r=t.bonds[e*2+1];x.set([t.positions[n*4],t.positions[n*4+1],t.positions[n*4+2],.11],e*4),S.set([t.positions[r*4],t.positions[r*4+1],t.positions[r*4+2],.25],e*4)}e.queue.writeBuffer(be,0,new Float32Array([s,c,i,a,o,v,r,0,m,h,g,1,d*.5,f*.5,p*.5,0])),e.queue.writeBuffer(xe,0,y),e.queue.writeBuffer(Se,0,b),e.queue.writeBuffer(Ce,0,x),e.queue.writeBuffer(we,0,S);let C=e.createBindGroup({layout:_e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:be}},{binding:1,resource:{buffer:xe}},{binding:2,resource:{buffer:Se}}]}),w=u>0?e.createBindGroup({layout:ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:be}},{binding:3,resource:{buffer:Ce}},{binding:4,resource:{buffer:we}}]}):null,T=e.createBindGroup({layout:ye.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:be}}]}),E=e.createCommandEncoder({label:`ulg-lab-render-multispecies-crystal`}),D=E.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.012,g:.02,b:.042,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});w&&(D.setPipeline(ve),D.setBindGroup(0,w),D.draw(6,u)),D.setPipeline(_e),D.setBindGroup(0,C),D.draw(6,l),D.setPipeline(ye),D.setBindGroup(0,T),D.draw(24,1),D.end(),e.queue.submit([E.finish()])}function It({posBuffer:t,velBuffer:r,moleculeCount:i=192,yaw:a=.45,pitch:o=.28,camDist:s=3.15}){if(!t||!r||!(i>0))return;let{w:c,h:l}=yt();e.queue.writeBuffer(Ae,0,new Float32Array([c,l,a,o,s,.078,1,0]));let u=e.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ae}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}}]}),d=e.createBindGroup({layout:ke.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ae}}]}),f=e.createCommandEncoder({label:`ulg-lab-render-reactive-md`}),p=f.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.012,g:.018,b:.036,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});p.setPipeline(Oe),p.setBindGroup(0,u),p.draw(6,i),p.setPipeline(ke),p.setBindGroup(0,d),p.draw(24,1),p.end(),e.queue.submit([f.finish()])}function Lt({atlas:t,viewMode:r=`3d-surface`,probe:i=null,mdTempK:a=null,yaw:o=.62,pitch:s=.56,camDist:c=3.25,showFacetEdges:l=!0}){if(!t?.packedGpuAtlas?.data||!t?.polytopes?.length)return;if(r===`2d-facets`){Ot(t,i);return}let{w:u,h:d}=yt(),f=Tt(t),{minLt:p,maxLt:m,minLp:h,maxLp:g}=wt(t),_=i&&Number.isFinite(i.fx)&&Number.isFinite(i.fy)?1:0,v=Number.isFinite(a)&&a>0?1:0,y=v>.5?Math.max(0,Math.min(1,(Math.log10(Math.max(1,a))-p)/Math.max(1e-6,m-p))):.5,b=Math.max(0,Math.min(1,(Math.log10(101325)-h)/Math.max(1e-6,g-h)));if(e.queue.writeBuffer(Fe,0,new Float32Array([u,d,o,s,p,m,h,g,-2.2,4.4,c,68,_>.5?i.fx:-1,_>.5?i.fy:-1,_,r===`residual-map`?2:0,y,b,v,+!!l])),r===`residual-map`){let t=e.createBindGroup({layout:Pe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:f}}]}),r=e.createCommandEncoder({label:`ulg-lab-render-poly-res`}),i=r.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});i.setPipeline(Pe),i.setBindGroup(0,t),i.draw(3),i.end(),e.queue.submit([r.finish()]);return}let x=e.createBindGroup({layout:Me.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:f}}]}),S=e.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:f}}]}),C=e.createCommandEncoder({label:`ulg-lab-render-poly3d`}),w=C.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.012,g:.02,b:.042,a:1}}],depthStencilAttachment:{view:Ye.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});w.setPipeline(Me),w.setBindGroup(0,x),w.draw(4624*6),w.setPipeline(Ne),w.setBindGroup(0,S),w.draw(46),w.end(),e.queue.submit([C.finish()])}return Object.freeze({backend:`webgpu`,format:r,buildAtomicVolumeOnGpu:bt,buildCompositeNuclearVolumeOnGpu:Et,renderVolume3D:xt,renderOrbitalPointCloud:kt,renderPhotonShellScene:At,renderTdksPhotonCloudScene:jt,renderSpinLatticeScene:Mt,renderElectronTransportScene:Nt,renderMoleculeScene:M,renderMultiSpeciesCrystalScene:Ft,renderReactiveMdScene:It,renderLiveMd:St,renderStaticCrystalLattice:Ct,renderPolytopeAtlas:Ot,renderPolytopeAtlas3D:Lt,probePolytopeAtlasOnGpu:Dt,getPolytopeAxisBounds:wt})}var Ln=Object.freeze({githubUlg:`https://github.com/Tsotchke-Corporation/ulg`,githubPeerCompute:`https://github.com/MetaverseJS/peercompute`,githubEshkol:`https://github.com/tsotchke/eshkol`,githubMoonlab:`https://github.com/tsotchke/moonlab`,demos:Object.freeze([{href:`./index.html`,title:`Studio Continuum`,scale:`10⁻³ → 10⁺² m`,desc:`Interactive macroscopic 3D WebGPU MLS-MPM fluid, phase transitions, volumetric optics, and reactive continuum studio.`},{href:`./universes.html`,title:`ULG Universes ↗`,scale:`10⁺²⁵ → 10⁻¹⁵ m`,desc:`Interactive 40-order-of-magnitude WebGPU explorer spanning FLRW Cosmic Web, Galaxies with SMBH lensing, Star Systems, Stellar Cores, Planetary Cutaways, MD, Dirac–KS Atoms, and Atomic Nuclei.`}])}),Rn=Object.freeze({title:`About ULG & the Material Physics Lab`,subtitle:`Universal Law Graph — First-Principles Browser-Native WebGPU Multiscale Physics`,whatIsThisLab:`This interactive Material Physics Lab runs live WebGPU compute shaders directly on your GPU to derive physical matter from first principles across the entire periodic table (Z = 1..118), arbitrary (Z, A) isotopes, multi-species crystals, chemical reactions, vibrational spectra, reactive molecular dynamics, and 3D thermodynamic phase polytopes. No hardcoded per-element color tables or canned preset animations are used: Gold turns yellow from relativistic spin-orbit contraction, Cesium turns pale gold from its screened low-density Drude plasma edge, Lead turns superconducting below T_c, and H₂O bends light via real-time Maxwell–FDTD.`,whatIsUlg:`ULG (Universal Law Graph) is a first-principles multiscale physics engine spanning 40 orders of magnitude — from atomic nuclei (10⁻¹⁵ m) through atoms, crystals, chemistry, macroscopic fluids and solids (10⁻⁶..10⁺² m), planets, stars, galaxies, and supergalactic cosmic structure (10⁺²⁵ m). Rather than simulating 10²⁶ individual atoms in a macroscopic scene, ULG runs representative sub-simulations at scale S−1 (like the live GPU engines in this lab) and compiles their outputs and strict validity envelopes into Convex Polytope Atlases (A x ≤ b + GPU Chebyshev tables) that scale S evaluates in nanoseconds on the GPU.`,architectureBullets:Object.freeze([`Star Spec Physics-First: Macroscopic behavior emerges strictly from activated laws and validity-bounded closures — never from hardcoded material branches.`,`Schroeder Simulation (SS) Scale Atlas: One GPU-resident hierarchical spatial epoch serving near-field mechanics, cross-level coupling, multipole far-field gravity, solids, and rendering.`,`Tier 0–3 Closure Economy: Fast bulk substrate (Tier 0), fail-closed cached Chebyshev polytopes (Tier 1), representative on-demand GPU sampling (Tier 2), and warm WASM/WebGPU derivation (Tier 3).`,`The ULG Triad: PeerCompute handles distributed scheduling, leases, and peer sync; Eshkol compiles higher-order automatic derivatives and closures; Moonlab provides quantum reference states and correlations.`]),honestyNote:`All runtime derivations in this lab run live on your browser GPU and are transparently labeled scientificValidation: false; offline NIST/CODATA/AME2020/CRC comparisons in the Graphs & Data panel are strictly advisory.`}),zn=Object.freeze({"nuclear:tdse":{title:`Nuclear Fermi Density & α-Decay TDSE`,scale:`10⁻¹⁵ m (Nuclear)`,moduleKey:`nuclear-tunneling-tdse@1`,whatYouSee:`A 3D volumetric rendering of the active nucleus (proton/neutron Fermi charge distribution and nuclear skin) paired with a live 1D quantum wavepacket bouncing inside the nuclear potential well and tunneling through the Coulomb barrier.`,gpuPhysics:`Solves the semi-empirical liquid-drop + shell-corrected nuclear binding energy B(Z, A), finite charge radius R_nuc, and evolves a 1D time-dependent Schrödinger equation (TDSE) on WebGPU using a norm-preserving symplectic Visscher leapfrog integrator.`,whyInUlg:`Nuclear masses, finite charge radii, spin/parity, and Q-values anchor the very bottom rung (10⁻¹⁵ m) of ULG’s 40-OOM Scale Ladder — feeding isotopic mass shifts in chemistry/phonons, nuclear hyperfine coupling, and stellar fusion energetics.`,tryThis:[`Select U-235 or Po-212 in the Periodic Table to watch barrier height and WKB α-tunneling probability respond to Q_α.`,`Click any nuclide on the Chart of Nuclides plot in the Graphs & Data dock to jump straight to that (Z, A) isotope.`,`Lower Sim Speed to 0.25× or click ⏭ +1 to watch the α-wavepacket reflect and leak through the Coulomb barrier step by step.`]},"nuclear:fission":{title:`3D Bohr–Wheeler Quadrupole Fission`,scale:`10⁻¹⁵ m (Nuclear)`,moduleKey:`nuclear-fission-ldm@1`,whatYouSee:`A live 3D raymarched nuclear density volume deforming smoothly from a sphere (β₂ = 0) through an elongated prolate saddle (β*) to necking and binary scission (β₂ > 1.0), alongside the Bohr–Wheeler surface-vs-Coulomb barrier curve.`,gpuPhysics:`Computes the nuclear fissility parameter x = E_Coulomb / (2 E_surface), solves the quadrupole/hexadecapole liquid-drop deformation energy landscape E(β₂), and rasterizes the 3D deformed Woods–Saxon nucleon density directly on WebGPU.`,whyInUlg:`Demonstrates how macroscopic nuclear stability and actinide fission barriers emerge directly from competing short-range strong-force surface tension and long-range Coulomb repulsion — without hardcoded fission tables.`,tryThis:[`Load ²³⁵U (Z=92, A=235) and click Play Fission or drag the β₂ slider past Saddle β* to see necking and scission.`,`Compare U-235 (low barrier E_f ≈ 3 MeV) against Fe-56 (enormous barrier — iron sits at the peak of nuclear stability!).`]},"nuclear:bateman":{title:`Bateman Radioactive Decay Chain`,scale:`10⁻¹⁵ m → macro time`,moduleKey:`nuclear-decay-ledger@1`,whatYouSee:`The parent nucleus volume alongside exact nucleon-conserving parent → daughter → granddaughter population curves plotted in multiples of the primary half-life.`,gpuPhysics:`Constructs the α/β⁻/β⁺/EC decay network directly from first-principles Q-values and integrates the coupled Bateman rate equations with strict nucleon conservation.`,whyInUlg:`Powers radiogenic heating in planetary interiors (Gate 5) and isotope inventory conservation across long-timescale nuclear and astrophysical simulations.`,tryThis:[`Try Co-60 (Z=27, A=60) or U-235 (Z=92, A=235) to see multi-step daughter growth and decay curves in the Graphs & Data dock.`]},"atomic:cloud":{title:`3D Relativistic Dirac–KS Orbital Cloud`,scale:`10⁻¹⁰ m (Atomic QM)`,moduleKey:`quantum-orbital-cloud@1`,whatYouSee:`Up to 500,000 Monte Carlo points sampled directly on the GPU from the active atom’s exact 3D Kohn–Sham probability density |ψ_{n,l,m}(r, θ, φ)|², colored by alternating radial nodal shells or ±ψ wavefunction phase.`,gpuPhysics:`Solves the finite-nucleus Koelling–Harmon scalar-relativistic + spin-orbit radial Kohn–Sham SCF equations on WebGPU (zero per-SCF CPU readbacks), then samples (r, θ, φ) via inverse-CDF binary search on the GPU. Supports live static Stark electric-field polarization (α₀) and matched-grid ΔSCF cation ionization (I₁).`,whyInUlg:`Atomic orbital wavefunctions, radii, spin-orbit splittings, and polarizabilities are the sole inputs to ULG’s crystal DFT, optical spectra, magnetism, and chemical bonding engines.`,tryThis:[`Drag the n slider or switch l and m to inspect s spheres, p dumbbells, d cloverleafs, and f octupoles with crisp radial nodal shells.`,`Drag Stark E to polarize the electron cloud and measure induced dipole moment, or click Ionize −1e⁻ (ΔSCF) to watch the cation shell contract on the GPU.`]},"atomic:volume":{title:`Volumetric 3D Atomic Spin & Charge Density`,scale:`10⁻¹⁰ m (Atomic QM)`,moduleKey:`quantum-orbital-cloud@1`,whatYouSee:`A smooth 3D WebGPU raymarched volume of the atom’s total electron charge and unpaired-spin density distribution.`,gpuPhysics:`Uploads the converged GPU Kohn–Sham radial density ρ(r) and angular valence envelope into a 3D storage volume and raymarches it directly on the GPU.`,whyInUlg:`Visualizes total electron screening and shell compactness that govern core polarizability, atomic volume, and interatomic repulsion in solids and molecules.`,tryThis:[`Toggle Relativistic+SO on heavy elements like Au (Z=79) or switch XC between PBE GGA, LDA, and Bare Z to see screening expand the cloud.`]},"crystal:photon-shell":{title:`2D Maxwell–ADE-FDTD Optical Slab (Snell & Metal Color)`,scale:`10⁻⁹ → 10⁻⁷ m (Optics)`,moduleKey:`photon-shell-fdtd@1`,whatYouSee:`An oblique Gaussian photon wavepacket hitting a slab of the active element or backfed compound containing 20 driven 3D atomic shells: watch metals reflect color-selectively (Gold reflects red/green and absorbs blue!) and dielectrics like H₂O refract according to Snell’s law.`,gpuPhysics:`Runs a 4-channel (610nm R, 535nm G, 440nm B, plus tunable λ) 128×128 time-symmetric symplectic Yee–Taflove 2D Maxwell–ADE-FDTD solver on WebGPU coupled to Drude free-electron currents and Dirac–KS Lorentz interband oscillators.`,whyInUlg:`Proves that metallic luster, color (Au gold, Cu copper, Cs pale gold, Ag silver), and dielectric refraction emerge directly from live Maxwell wave equations + quantum electronic structure.`,tryThis:[`Select Au (Gold) and toggle Relativistic (Au) OFF vs ON — watch Gold turn into Silver when relativistic 5d–6s contraction is disabled!`,`Backfeed H₂O from Chemistry and slow Sim Speed to 0.25× to watch the oblique wave bend inside water and match Snell’s law.`]},"crystal:lattice":{title:`3D Multi-Species Crystal Unit Cell`,scale:`10⁻⁹ m (Condensed Matter)`,moduleKey:`periodic-bulk-dft@1`,whatYouSee:`An interactive 3D ball-and-stick crystal unit cell showing distinct ionic/covalent species sizes, CPK or formal-charge (±) coloring, and nearest-neighbor coordination bonds.`,gpuPhysics:`Derives equilibrium Bravais lattice symmetry (fcc, bcc, hcp, diamond, vdw-fcc) and multi-species Wyckoff prototypes (rocksalt-B1, CsCl-B2, zincblende-B3, fluorite-C1, rutile-C4, corundum-D51) directly from atomic radii, electronegativity ionicity, and Birch–Murnaghan GPU bulk DFT.`,whyInUlg:`Crystal symmetry and lattice constants determine elastic moduli, density, slip systems, and phonon spectra used in ULG’s continuum solids.`,tryThis:[`Click NaCl Crystal in Quick Showcases and toggle between CPK Species and Formal Charge (±) to inspect alternating Na⁺ / Cl⁻ coordination.`]},"crystal:bloch":{title:`3D Periodic Bloch Density & Electronic Bands`,scale:`10⁻⁹ m (Solid-State DFT)`,moduleKey:`periodic-bulk-dft@1`,whatYouSee:`A 3D volumetric rendering of the periodic crystal’s ground-state Bloch charge density reconstructed by WebGPU 3D FFT, paired with Brillouin-zone band dispersion E(k), Fermi level E_F, and electronic density of states g(E).`,gpuPhysics:`Solves 17 high-symmetry k-point plane-wave Bloch Hamiltonians in one batched WebGPU symmetric eigensolver dispatch and transforms eigenvectors to real space using ULG’s shared 3D Radix-2 GPU FFT.`,whyInUlg:`Separates metals (g(E_F) > 0, zero gap) from semiconductors and insulators (finite band gap), feeding conductivity, magnetism, superconductivity, and optics.`,tryThis:[`Compare a metal like Cu or Fe against a semiconductor like Si (Z=14) in the Graphs & Data panel to see the band gap open at E_F.`]},"crystal:tdks-atom":{title:`3D Self-Consistent Maxwell–Kohn–Sham (Photon ↔ Orbital)`,scale:`10⁻¹⁰ m (Quantum Optics)`,moduleKey:`quantum-tdks-maxwell3d@1`,whatYouSee:`A true 3D volumetric raymarch of a live vector electromagnetic wavepacket (E_tot, E_inc, and scattered multipole wave E_scatt = E_tot − E_inc) striking and deforming a 180,000-point 3D Dirac–KS electron orbital cloud in real time.`,gpuPhysics:`Projects the active orbital’s exact 3D radial wavefunction u_nl(r) and spherical harmonic Y_lm(θ, φ) into a 32³ anisotropic susceptibility tensor χ_ij(r) on WebGPU, steps coupled 3D vector Yee Maxwell curl equations with semi-implicit Lorentz–Bloch polarization P(r,t) and absorption E·J, and dynamically flexes every electron point from the live 3D polarization field.`,whyInUlg:`Demonstrates genuine light-matter geometry coupling: orbital nodal planes stay strictly zero, 2p_y dumbbells obey dipole polarization selection rules (E_y vs E_z), and anisotropic d/f lobes generate real cross-polarized multipole scattering.`,tryThis:[`Set Orbital to 2p_y Dumbbell and switch Pol between E_y (parallel to lobes) and E_z (perpendicular) to observe dipole selection-rule scattering!`,`Switch Field View to Scattered E_scatt and orbit 360° in 3D at 0.25× slow-motion to inspect pure multipole scattering shells.`]},"crystal:spin-llg":{title:`3D Stochastic LLG Spin-Lattice Magnetism`,scale:`10⁻⁹ m (Magnetism)`,moduleKey:`spin-lattice-llg@1`,whatYouSee:`A 3D crystal lattice of live magnetic spin arrows colored by M_z orientation (red +z, blue −z), forming ferromagnetic domains, Néel alternating antiferromagnetic checkerboards, or thermally disordered paramagnets.`,gpuPhysics:`Integrates the 3D stochastic Landau–Lifshitz–Gilbert (sLLG) equation ds_i/dt = −γ/(1+α²)[s_i × H_eff + α s_i × (s_i × H_eff)] on WebGPU with a Heun predictor-corrector using Stoner-derived exchange coupling J, anisotropy K, external field B_z, and Langevin thermal fluctuations.`,whyInUlg:`Connects microscopic spin-orbit & Stoner exchange physics to emergent Curie/Néel phase transitions (T_C / T_N), hysteresis loops M(B), and macroscopic magnetic permeability.`,tryThis:[`Load Fe Magnet and click Sweep B to trace a live ferromagnetic hysteresis loop in the Graphs & Data panel, then click Heat > T_c to melt magnetic order.`,`Select Cr (Z=24) to watch spontaneous alternating antiferromagnetic Néel ordering!`]},"crystal:transport":{title:`3D Electron Transport, Semiconductors & BCS Superconductivity`,scale:`10⁻⁹ m (Transport)`,moduleKey:`electron-transport-gpu@1`,whatYouSee:`1,024 live charge carriers drifting through a 3D crystal under an electric field E: normal electrons scatter off thermal phonons (flashing red), while below T_c cyan Cooper pairs flow frictionlessly with zero scattering!`,gpuPhysics:`Runs a 3D WebGPU Drude–Boltzmann carrier integrator with Bloch–Grüneisen electron-phonon scattering, thermal intrinsic carrier activation across band gaps, and McMillan–Hopfield BCS superconducting condensate fraction.`,whyInUlg:`Derives temperature-dependent electrical conductivity σ(T), resistivity ρ(T), and superconducting critical temperatures T_c directly from bulk DFT bands and Debye phonons.`,tryThis:[`Click Pb Supercond in Quick Showcases and click Cryo T < T_c to watch Lead condense into frictionless cyan Cooper pairs (ρ = 0 Ω·m)!`,`Click Si Semi and slide Temperature from 80 K up to 900 K to watch thermal e⁻/h⁺ carriers flood the conduction band.`]},"md:equilibrium":{title:`Live 3D WebGPU Molecular Dynamics & Phase Transitions`,scale:`10⁻⁸ m (Atomistic MD)`,moduleKey:`md-mechanical-probe@1`,whatYouSee:`From 500 up to 100,000+ live interacting atoms rendered zero-copy with depth-correct spherical shading directly from WebGPU storage buffers. In Drop & Vapor open-chamber mode, watch a faceted solid crystal melt from its free surfaces into a cohesive liquid droplet and boil off into a chamber-filling vapor gas; in Bulk NPT mode, watch the periodic lattice expand visibly inside the gold V₀ reference wireframe.`,gpuPhysics:`Runs an O(N) lock-free linked-cell 3D spatial grid Velocity-Verlet integrator on WebGPU (scaling cleanly past 100,000 atoms within the universal 8-storage-buffer baseline) with DFT-fitted Morse+Finnis–Sinclair EAM, Shifted-Force Lennard-Jones, or 3-body Stillinger–Weber potentials, exact exponential thermostatting, adaptive-compressibility Berendsen NPT barostat, live GPU per-atom coordination z_i & Solid/Liquid/Vapor phase classification, g(r), MSD, Lindemann δ_L, and VACF phonon VDOS.`,whyInUlg:`Representative MD cells bridge atomic DFT up to macroscopic continuum equations of state, melting/boiling coexistence curves, and Polytope Atlases.`,tryThis:[`Click Solid, Melt, and Vapor to watch the faceted crystal physically melt into a diffusing liquid droplet and then boil into fast gas atoms (color by Phase to see sapphire solid → emerald liquid → magenta vapor live!).`,`Toggle Gravity ↓ ON to activate downward body acceleration (−m g ŷ) and a smooth harmonic chamber floor — watch a solid crystal drop and land on the floor, a melted droplet pool into a sessile liquid puddle, or vapor settle into a barometric atmosphere!`,`Scale Atoms up to 10K, 50K, or 100K to watch a true 100,000-atom nanoscale crystal evolve on WebGPU, or switch Chamber to Bulk NPT and drop Sim Speed to 0.25×.`]},"md:strain":{title:`MD Mechanical Stress–Strain Tensor (K, G, ν)`,scale:`10⁻⁸ m (Nanomechanics)`,moduleKey:`md-mechanical-probe@1`,whatYouSee:`A live 3D crystal cell undergoing affine uniaxial compression, tension, or shear deformation with lateral NPT Poisson relaxation and live virial stress-strain curves.`,gpuPhysics:`Applies exact affine deformation tensors to GPU atomic coordinates and periodic box vectors, measuring the full 6-component microscopic virial stress tensor P_αβ directly on WebGPU.`,whyInUlg:`Directly measures bulk modulus K, shear modulus G, and Poisson’s ratio ν for ULG’s continuum solid-mechanics solvers.`,tryThis:[`Click Compress −3%, Stretch +3%, or Shear γ_xy +4% and watch diagonal stress P_xx and lateral Poisson contraction respond live!`]},"md:acoustic":{title:`Acoustic Crystal Bar (Longitudinal v_L & Transverse v_T)`,scale:`10⁻⁸ m (Acoustics)`,moduleKey:`md-mechanical-probe@1`,whatYouSee:`An elongated 3:1 3D crystal bar carrying live longitudinal compression (P-wave) or transverse shear (S-wave) pulses across 8 spatial velocity slabs.`,gpuPhysics:`Injects localized momentum wavepackets into the GPU MD lattice and tracks real-time mechanical wave propagation across the bar.`,whyInUlg:`Validates emergent sound speeds c_L and c_T against elastic constants C_11 and C_44 used in macroscopic shock and acoustic solvers.`,tryThis:[`Lower Sim Speed to 0.25× and click Fire P-Wave (v_L) or Fire S-Wave (v_T) to watch the acoustic wavefront travel down the crystal bar.`]},"md:shear":{title:`NEMD Couette Shear Viscosity (η)`,scale:`10⁻⁸ m (Transport NEMD)`,moduleKey:`md-nemd-transport@1`,whatYouSee:`A 3D fluid/solid slab driven in opposite directions at the top and bottom boundary walls, creating a live linear Couette velocity gradient v_x(y).`,gpuPhysics:`Applies non-equilibrium boundary wall momentum forcing on WebGPU and computes dynamic shear viscosity η = |σ_xy| / (dv_x/dy) directly from the off-diagonal GPU virial stress.`,whyInUlg:`Supplies first-principles fluid viscosity η(T, ρ) to ULG’s continuum MLS-MPM Navier–Stokes solvers without empirical viscosity tables.`,tryThis:[`Heat the specimen above T_m (click Melt) to see a clean linear fluid shear profile form in the slab velocity plot.`]},"md:thermal":{title:`NEMD Hot/Cold Slab Thermal Conductivity (κ_ph)`,scale:`10⁻⁸ m (Heat Transport)`,moduleKey:`md-nemd-transport@1`,whatYouSee:`A 3D crystal/liquid held hot on the left slab and cold on the right slab (atoms glowing warm orange-red on the hot side and cool blue on the cold side) with a live spatial temperature profile T(x).`,gpuPhysics:`Maintains dual hot/cold slab thermostats on WebGPU, meters exact heat flux J_q = ΔQ / (2 A Δt), and derives phonon thermal conductivity κ_ph = J_q / |dT/dx| via Fourier’s law.`,whyInUlg:`Feeds first-principles thermal conductivity into ULG’s continuum heat-conduction and quench simulations (e.g., Iron Ice Quench).`,tryThis:[`Adjust target T and open Graphs & Data to inspect the 8-slab spatial temperature gradient T(x) and live κ_ph readout.`]},"md:surface":{title:`Free-Surface Vacuum Slab (Surface Tension γ)`,scale:`10⁻⁸ m (Interfaces)`,moduleKey:`md-nemd-transport@1`,whatYouSee:`A condensed 3D slab suspended between two vacuum interfaces along Z, showing surface atomic relaxation, evaporation at high T, and interface tension.`,gpuPhysics:`Computes the microscopic Kirkwood–Buff mechanical surface tension γ = (L_z / 2)[½(P_xx + P_yy) − P_zz] directly from the anisotropic GPU virial stress tensor.`,whyInUlg:`Derives surface tension γ(T) for droplets, bubbles, and phase interfaces in ULG’s macroscopic continuum renderer and solver.`,tryThis:[`Heat near T_m (Melt) to observe free-surface capillary fluctuations and occasional surface atoms evaporating into the vacuum gap.`]},"compound:molecule":{title:`3D Quantum Molecule, Wiberg Bonds & MEP`,scale:`10⁻¹⁰ m (Quantum Chemistry)`,moduleKey:`molecular-rhf-gpu@1`,whatYouSee:`A 3D WebGPU molecule with exact single/double/triple cylinders sized by Wiberg bond order, CPK or Mulliken electrostatic potential (MEP δ⁻ red ↔ δ⁺ blue) atom coloring, a 3D electric dipole arrow μ, and optional Total ρ / HOMO / LUMO orbital cloud.`,gpuPhysics:`Solves closed-shell Restricted Hartree–Fock (RHF) self-consistent field equations on WebGPU using a Slater-shielded valence STO-3G effective core potential covering all Z = 1..118, then computes exact Löwdin–Wiberg bond orders and Mulliken charges.`,whyInUlg:`Derives molecular geometry, bond energies, dipole moments, and polarizability for arbitrary newly discovered reaction products, which can then be backfed into every crystal, optical, MD, and Polytope simulation.`,tryThis:[`Try H₂O (bent polar single bonds, μ > 1 D) and CO₂ (linear double bonds, Wiberg order ~2.0, μ = 0) or derive any formula like NH3, CH4, or NaCl.`,`Toggle MEP (±q) and Orbital Cloud (HOMO / LUMO) to inspect nucleophilic vs electrophilic regions.`]},"compound:reaction-path":{title:`GPU CI-NEB Reaction Path (A + B → TS‡ → C + D)`,scale:`10⁻¹⁰ m (Reaction Kinetics)`,moduleKey:`molecular-reaction-path@1`,whatYouSee:`An interactive 3D molecular encounter complex transitioning from Reactants (ξ = 0) through the Transition State saddle point (TS‡) to Products (ξ = 1), with live bond breaking/forming cylinders and Eyring/Arrhenius k(T) plots.`,gpuPhysics:`Assembles atom-conserved 3D encounter complexes and relaxes a multi-image Climbing-Image Nudged Elastic Band (CI-NEB) chain directly via GPU RHF energy & force evaluations to determine activation barrier E_a and reaction enthalpy ΔH.`,whyInUlg:`Computes first-principles activation barriers and rate constants k(T) that govern reactive chemistry chambers and macroscopic exothermic continuum reactions (like Na + H₂O).`,tryThis:[`Click HCl+NaOH or Na+H₂O in the Reaction Combiner, then scrub ξ or click Play Path / Jump TS‡ to watch old bonds break as new bonds form.`]},"compound:vibrations":{title:`GPU Geometry Optimization & Vibrational Normal Modes`,scale:`10⁻¹⁰ m (IR / Raman Spectroscopy)`,moduleKey:`molecular-vibrations-gpu@1`,whatYouSee:`Live 3D normal-mode vibrational animations (stretching and bending) of the relaxed molecule, paired with harmonic IR/Raman stick spectra and zero-point energy (ZPE).`,gpuPhysics:`Relaxes atomic coordinates via GPU RHF gradients, builds the finite-difference GPU Hessian matrix, projects out exact 5 (linear) or 6 (nonlinear) Eckart translational/rotational null modes, and diagonalizes the mass-weighted dynamical matrix.`,whyInUlg:`Quantifies molecular zero-point energy, heat capacity, infrared signatures, and kinetic isotope effects (e.g., H₂O vs D₂O).`,tryThis:[`Derive H2O, switch to Vibrations, pick symmetric/asymmetric stretch vs bend modes, and toggle H→D Isotope Shift to watch frequencies drop by ~1/√2!`]},"compound:reactive-md":{title:`3D WebGPU Reactive Chemistry MD Chamber`,scale:`10⁻⁸ m (Chemical Kinetics)`,moduleKey:`reactive-chemistry-md@1`,whatYouSee:`A 3D collision chamber of reactant molecules (A + B) colliding, flashing when they clear the activation barrier E_a, converting into products (C + D) with strict 1:1 stoichiometry, and releasing exothermic heat.`,gpuPhysics:`Runs an all-GPU @workgroup_size(64) multi-species molecular collision and Arrhenius/Eyring mutual-nearest-neighbor reaction kernel seeded with barriers E_a and enthalpies ΔH from ULG’s GPU CI-NEB solver.`,whyInUlg:`Links microscopic quantum reaction barriers to macroscopic reaction kinetics, ignition runaway, catalysis, and thermal feedback.`,tryThis:[`Click ⚡ Ignition Spark to trigger exothermic chain conversion, or toggle Catalyst (−48% E_a) to see the reaction ignite at much lower temperature!`]},"polytope:3d-surface":{title:`3D Convex Polytope Phase Surface (T, P, ρ)`,scale:`10⁻⁶ → 10⁺⁷ m (Closure Atlas)`,moduleKey:`chebyshev-polytope-atlas@1`,whatYouSee:`An orbitable 3D WebGPU phase-density relief surface over (log₁₀ T, log₁₀ P) with height = log₁₀ ρ: crisp vertical Clausius–Clapeyron phase cliffs separating Solid, Liquid, Gas, and Supercritical regions, a hatched fail-closed baseplate outside valid polytopes, and a glowing vertical GPU probe pin.`,gpuPhysics:"Evaluates ULG’s exact inline WGSL `eval_polytope_atlas_2d` half-space classifier (A x ≤ b) and 2D tensor Chebyshev polynomials directly inside the WebGPU shader — identical math to ULG’s continuum and planetary interior solvers.",whyInUlg:`This is the master bridge of ULG’s Scale Ladder: every element and discovered compound compiles into a fail-closed Convex Polytope Atlas that macroscopic continuum and planetary engines evaluate in nanoseconds on the GPU.`,tryThis:[`Switch between Lab 10 GPa and Planetary 1 TPa regimes, drag log₁₀T / log₁₀P, or click Fail-Closed Test to verify out-of-domain queries refuse silent extrapolation!`]},"polytope:2d-facets":{title:`2D Exact Convex Polytope Facet Map`,scale:`10⁻⁶ → 10⁺⁷ m (Closure Atlas)`,moduleKey:`chebyshev-polytope-atlas@1`,whatYouSee:`A top-down exact 2D (log₁₀ T, log₁₀ P) phase map displaying every convex polytope cell’s half-space boundaries (A x ≤ b), iso-density contours, and live hover/click GPU probe cursor.`,gpuPhysics:`Runs the exact GPU half-space membership test and Chebyshev density evaluation at every pixel and at the interactive cursor point.`,whyInUlg:`Lets you inspect exact polytope domain coverage, bisected phase-boundary refinements, and fail-closed margins directly.`,tryThis:[`Hover or click anywhere across the solid, liquid, gas, and supercritical polytope cells to read live GPU density and exact boundary margin.`]},"polytope:residual-map":{title:`Chebyshev Closure Residual Error Map (%)`,scale:`10⁻⁶ → 10⁺⁷ m (Verification)`,moduleKey:`chebyshev-polytope-atlas@1`,whatYouSee:`A quantitative error heatmap comparing the Tier-1 GPU Chebyshev polytope surrogate directly against the underlying first-principles equation of state across the entire (T, P) domain.`,gpuPhysics:`Evaluates |ρ_Chebyshev − ρ_EOS| / ρ_EOS pixel-by-pixel across every interior polytope cell to verify approximation accuracy and locate high-curvature regions near phase transitions.`,whyInUlg:`Enforces Star Spec Rule 2: closures carry explicit accuracy bounds and never hide approximation error from higher-scale solvers.`,tryThis:[`Compare Lab 10 GPa vs Planetary 1 TPa residual maps to see where bisection tightens the fit along phase coexistence curves.`]}});function Bn(e,t){let n=`${e}:${t}`;return zn[n]?zn[n]:zn[Object.keys(zn).find(t=>t.startsWith(`${e}:`))]||zn[`nuclear:tdse`]}try{te(de),Kt(de),ee(de),an(de),yn(de),m(de),i(de),f(de),ke(de),Ue(de),Ze(de)}catch{}var Vn=new Map,Hn=0,Un=new C({artifactCache:{async put(e){Hn+=1;let t=`ulg-lab://closure/${e.closureId||`item`}#${Hn}`;return Vn.set(t,e),{uri:t,hash:e.inputHash||String(Hn)}},async get(e){return Vn.get(e?.uri)||null}}}),Wn=document.getElementById(`gpu-canvas`),Gn=document.getElementById(`gpu-hud-title`),Kn=document.getElementById(`gpu-hud-sub`),qn=document.getElementById(`gpu-overlay-bottom`),Jn=document.getElementById(`sim-controls`),Yn=document.getElementById(`active-specimen-pill`),Xn=document.getElementById(`specimen-history`),Zn=document.getElementById(`plot1`),Qn=document.getElementById(`plot2`),$n=document.getElementById(`plot3`),er=document.getElementById(`z-input`),tr=document.getElementById(`a-input`),nr=document.getElementById(`reset-a-btn`),rr=document.getElementById(`solve-z-btn`),ir=document.getElementById(`reactant-a`),ar=document.getElementById(`reactant-b`),or=document.getElementById(`run-reaction-btn`),sr=document.getElementById(`reaction-results`),cr=document.getElementById(`compound-input`),lr=document.getElementById(`solve-compound-btn`),ur=document.getElementById(`status-badge`),dr=document.getElementById(`bundle-readout`),fr=document.getElementById(`g7-card`),pr=document.getElementById(`plot1-title`),mr=document.getElementById(`plot2-title`),hr=document.getElementById(`plot3-title`),gr=document.getElementById(`mobile-drawer-btn`),_r=document.getElementById(`mobile-drawer-close`),vr=document.getElementById(`data-dock-toggle-btn`),yr=document.getElementById(`dock-reopen-tab`),br=document.getElementById(`data-dock-close`),xr=document.getElementById(`drawer-backdrop`),Sr=document.getElementById(`help-menu-btn`),Cr=document.getElementById(`help-menu-popover`),wr=document.getElementById(`menu-about-sim`),Tr=document.getElementById(`menu-about-ulg`),Er=document.getElementById(`menu-about-sim-badge`),Dr=document.getElementById(`menu-about-sim-desc`),Or=document.getElementById(`about-modal`),kr=document.getElementById(`about-modal-title`),Ar=document.getElementById(`about-modal-body`),jr=document.getElementById(`about-modal-close`),Mr=document.getElementById(`about-tab-sim`),Nr=document.getElementById(`about-tab-ulg`),Pr=document.getElementById(`canvas-about-sim-btn`),Fr=document.getElementById(`ulg-tooltip`),Ir=document.getElementById(`sidebar-sim-speed`),Lr=document.getElementById(`sidebar-speed-lbl`),Rr=document.getElementById(`sidebar-step-once-btn`),zr=document.getElementById(`speed-preset-chips`),Br=document.getElementById(`canvas-reset-view-btn`),Vr=document.getElementById(`webgpu-fallback`),Hr=document.getElementById(`webgpu-fallback-title`),Ur=document.getElementById(`webgpu-fallback-msg`),Wr=document.getElementById(`webgpu-reload-btn`),Gr=document.getElementById(`pt-modal`),Kr=document.getElementById(`iupac-pt-grid`),qr=document.getElementById(`pt-search`),Jr=document.getElementById(`pt-action-mode`),Yr=document.getElementById(`pt-modal-close`),Xr=document.getElementById(`pt-filter-chips`),Zr=document.getElementById(`pt-hover-text`),Qr=document.getElementById(`pt-modal-a`),$r=document.getElementById(`pt-legend`),ei=document.getElementById(`open-pt-btn`),ti=document.getElementById(`element-tile-btn`),ni=document.getElementById(`bar-open-pt-btn`),ri=document.getElementById(`share-link-btn`),ii=document.getElementById(`mobile-open-pt-btn`),ai=document.getElementById(`tile-z`),oi=document.getElementById(`tile-sym`),si=document.getElementById(`tile-name`),ci=document.getElementById(`tile-sub`),li=document.getElementById(`accordion-nav`),ui=typeof window<`u`&&(window.matchMedia?.(`(pointer: coarse)`)?.matches||window.innerWidth<900||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||``));function di(){return typeof window<`u`&&window.innerWidth<1120}function fi(){if(!xr)return;let e=document.body.classList.contains(`drawer-open`)||document.body.classList.contains(`data-dock-open`);xr.setAttribute(`aria-hidden`,e?`false`:`true`)}function pi(e){let t=!!e&&di();t&&document.body.classList.remove(`data-dock-open`),document.body.classList.toggle(`drawer-open`,t),fi()}function mi(){return di()?document.body.classList.contains(`data-dock-open`):!document.body.classList.contains(`data-dock-collapsed`)}function hi(){let e=mi();vr&&(vr.classList.toggle(`active-hdr`,e),vr.setAttribute(`aria-expanded`,e?`true`:`false`))}function gi(e){let t=!!e;if(Cr?.classList.toggle(`open`,t),Sr?.classList.toggle(`active-hdr`,t),Sr?.setAttribute(`aria-expanded`,t?`true`:`false`),t){let e=Bn(I,Oo(I));Er&&(Er.textContent=e.scale),Dr&&(Dr.textContent=e.title)}}function _i(e=`sim`){if(!Ar||!kr)return;let t=e===`ulg`;if(Mr?.classList.toggle(`active-toggle`,!t),Nr?.classList.toggle(`active-toggle`,t),t)kr.textContent=Rn.title,Ar.innerHTML=`
      <div class="about-hero-meta">
        <span class="badge">${Rn.subtitle}</span>
      </div>
      <div class="about-block">
        <h4>What Is This Material Physics Lab?</h4>
        <p>${Rn.whatIsThisLab}</p>
      </div>
      <div class="about-block">
        <h4>What Is ULG (Universal Law Graph)?</h4>
        <p>${Rn.whatIsUlg}</p>
        <ul>${Rn.architectureBullets.map(e=>`<li>${e}</li>`).join(``)}</ul>
      </div>
      <div class="about-block">
        <h4>Other ULG Demos &amp; Source Repositories</h4>
        <div class="about-links-row">
          <a href="${Ln.githubUlg}" target="_blank" rel="noopener noreferrer">↗ GitHub: ULG</a>
          <a href="${Ln.githubPeerCompute}" target="_blank" rel="noopener noreferrer">↗ PeerCompute</a>
          <a href="${Ln.githubEshkol}" target="_blank" rel="noopener noreferrer">↗ Eshkol</a>
          <a href="${Ln.githubMoonlab}" target="_blank" rel="noopener noreferrer">↗ Moonlab</a>
        </div>
        <div class="about-links-row" style="margin-top:7px;">
          ${Ln.demos.map(e=>`<a href="${e.href}" title="${e.desc}">${e.title} (${e.scale})</a>`).join(``)}
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--muted);">${Rn.honestyNote}</div>`;else{let e=Oo(I),t=Bn(I,e);kr.textContent=t.title,Ar.innerHTML=`
      <div class="about-hero-meta">
        <span class="badge">${t.scale}</span>
        <span class="chip" style="cursor:default;">Module: ${t.moduleKey}</span>
      </div>
      <div class="about-block">
        <h4>What You’re Seeing</h4>
        <p>${t.whatYouSee}</p>
      </div>
      <div class="about-block">
        <h4>What Runs on Your GPU</h4>
        <p>${t.gpuPhysics}</p>
      </div>
      <div class="about-block">
        <h4>Why This Simulation Exists in ULG</h4>
        <p>${t.whyInUlg}</p>
      </div>
      ${Array.isArray(t.tryThis)&&t.tryThis.length?`
      <div class="about-block">
        <h4>Interactive Things to Try</h4>
        <ul>${t.tryThis.map(e=>`<li>${e}</li>`).join(``)}</ul>
      </div>`:``}`}}function vi(e=`sim`){gi(!1),_i(e),Or?.classList.add(`open`)}function yi(){Or?.classList.remove(`open`)}function bi(){if(!Fr||typeof window>`u`||!(window.matchMedia?.(`(hover: hover) and (pointer: fine)`)?.matches??!0))return;let e=null,t=e=>{let t=e.getBoundingClientRect(),n=Fr.getBoundingClientRect(),r=t.left+(t.width-n.width)*.5;r=Math.max(8,Math.min(window.innerWidth-n.width-8,r));let i=t.bottom+7;i+n.height+8>window.innerHeight&&(i=Math.max(8,t.top-n.height-7)),Fr.style.left=`${Math.round(r)}px`,Fr.style.top=`${Math.round(i)}px`},n=n=>{if(!n)return;let r=n.getAttribute(`data-tip`);if(!r){let e=n.getAttribute(`title`);if(!e)return;r=e,n.setAttribute(`data-tip`,e),n.removeAttribute(`title`)}e=n,Fr.textContent=r,Fr.setAttribute(`aria-hidden`,`false`),Fr.classList.add(`visible`),t(n)},r=()=>{e=null,Fr.classList.remove(`visible`),Fr.setAttribute(`aria-hidden`,`true`)};document.addEventListener(`pointerover`,t=>{let i=t.target?.closest?.(`[data-tip],[title]`);i&&i!==e?n(i):!i&&e&&r()},{passive:!0}),document.addEventListener(`pointerout`,t=>{e&&!e.contains(t.relatedTarget)&&r()},{passive:!0}),document.addEventListener(`pointerdown`,r,{passive:!0}),window.addEventListener(`scroll`,r,!0)}function xi(e){let t=!!e;di()?(t&&document.body.classList.remove(`drawer-open`),document.body.classList.toggle(`data-dock-open`,t),fi()):(document.body.classList.remove(`data-dock-open`),document.body.classList.toggle(`data-dock-collapsed`,!t)),hi(),setTimeout(()=>{F&&Q()},230),window.__ulgElementsLabState&&(window.__ulgElementsLabState.dataDockOpen=mi())}function Si(e,t){Hr&&e&&(Hr.textContent=e),Ur&&t&&(Ur.textContent=t),Vr?.classList.add(`visible`)}function Ci(){Vr?.classList.remove(`visible`)}var P=null,F=null,I=`nuclear`,L=`element`,R=null,wi=null,z=null,Ti=null,Ei=null,Di=null,Oi=null,ki=!0,Ai=``,B=null,ji=null,Mi=null,Ni=[],V=26,Pi=null,Fi=[],Ii=null,Li=null,Ri=null,zi=null,H=null,Bi=null,Vi=!1,Hi=null,Ui=null,Wi=!1,Gi=null,Ki=null,qi=!1,U=null,Ji=null,Yi=[],Xi=[],Zi=[],Qi=!1,$i=null,ea=null,ta=null,na=[],ra=!1,ia=null,aa=null,oa=[],sa=!1,ca=null,la=null,ua=null,da=null,fa=null,W=null,pa=null,ma=null,ha=null,G=null,ga=null,_a=[],va=!1,ya=0,ba=`all`,K={simSpeed:1,nuclearViewMode:`tdse`,tdsePlaying:!0,fissionBeta2:0,fissionPlaying:!1,atomicViewMode:`cloud`,n:3,l:2,m:0,functional:`pbe`,relativisticSpinOrbit:!0,starkFieldVPerA:0,ionizedCation:!1,pointCount:ui?9e4:24e4,pointSize:ui?.015:.012,opacity:ui?.3:.24,alternateShellColors:!0,colorMode:0,shellColorA:`#ffffff`,shellColorB:`#612bde`,showGuides:!1,autoRotate:!1,cloudSeed:1,molOrbitalMode:0,crystalViewMode:`photon-shell`,crystalColorMode:0,photonPlaying:!0,photonModeMono:!1,probeWavelengthNm:440,tdksPolMode:0,tdksFieldView:0,tdksOrbitalPreset:`valence`,spinTempK:300,spinFieldBTesla:.5,spinSweepB:!1,spinSweepDir:1,spinPlaying:!0,transportTempK:300,transportEFieldVPerM:1e4,transportPlaying:!0,mdMode:`equilibrium`,mdChamberMode:`drop`,mdColorMode:1,mdSizePreset:ui?`small`:`medium`,mdPhasePreset:`solid`,mdNptBarostat:!0,mdGravity:!1,mdPlaying:!0,mdTargetTempK:300,chemViewMode:`molecule`,molColorMode:0,molShowDipole:!0,molShowOrbitalOverlay:!1,nebImageIdx:0,nebPlaying:!1,nebLastTickMs:0,vibModeIdx:0,vibPlaying:!0,vibIsotopeDeuterated:!1,rxMdTempK:340,rxMdCatalyst:!1,rxMdThermostat:!1,rxMdPlaying:!0,polytopeViewMode:`3d-surface`,polytopeShowFacets:!0,polytopeRegime:`lab`,polytopeProbe:null},q=.42,J=.28,xa=2.85,Sa=!1,Ca=0,wa=0,Ta=[`s`,`p`,`d`,`f`,`g`,`h`],Ea=new Set([2,10,18,36,54,86,118]),Da=new Set([9,17,35,53,85,117]);function Oa(e){let t=String(e||`#ffffff`).replace(`#`,``).trim();if(t.length!==6)return[1,1,1];let n=Number.parseInt(t,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function ka(e){let t=Math.max(380,Math.min(780,Number(e)||550)),n=0,r=0,i=0;return t<440?(n=-(t-440)/60,i=1):t<490?(r=(t-440)/50,i=1):t<510?(r=1,i=-(t-510)/20):t<580?(n=(t-510)/70,r=1):t<645?(n=1,r=-(t-645)/65):n=1,[Math.max(.05,n),Math.max(.05,r),Math.max(.05,i)]}function Aa(e){let t=Array.isArray(e)&&e.length===3?e:[.7,.75,.85];return`rgb(${Math.round(Math.max(0,Math.min(1,t[0]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[1]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[2]))*255)})`}function Y(e,t=3){return e==null||!Number.isFinite(e)?String(e??`—`):Math.abs(e)>=1e4||Math.abs(e)>0&&Math.abs(e)<.01?e.toExponential(2):e.toFixed(t)}function ja(){return L===`compound`&&z?.bundle?z.bundle:R?.bundle||null}function Ma(){return L===`compound`&&z?.bundle?z.bundle.electromagnetic:R?.visualData?.em||R?.bundle?.electromagnetic||null}function Na(e){let t=y(e),n=t.reduce((e,t)=>Math.max(e,t.n),1),r=[...t].reverse().find(e=>e.l===2&&e.occupancy>0&&e.n>=n-1);if(r&&r.n>=3)return{n:r.n,l:r.l,m:2};let i=t.find(e=>e.occupancy<2*(2*e.l+1));if(i)return{n:i.n,l:i.l,m:i.l>=2?2:0};let a=t[t.length-1]||{n:1,l:0};return{n:a.n,l:a.l,m:0}}function Pa(e,t){let n=y(e),r=n.reduce((e,t)=>Math.max(e,t.n),1),i=[...n].reverse().find(e=>e.l===2&&e.occupancy>0&&e.n>=r-1);if(i)return{n0:i.n,l0:2,n1:i.n+1,l1:1,m:0};let a=[...n].reverse().find(e=>e.l===1&&e.occupancy>0&&e.n===r);if(a)return{n0:a.n,l0:1,n1:a.n+1,l1:0,m:0};let o=[...n].reverse().find(e=>e.l===0&&e.occupancy>0&&e.n===r);if(o)return{n0:o.n,l0:0,n1:Math.max(2,o.n),l1:1,m:0};let s=n[n.length-1]||{n:1,l:0};return{n0:s.n,l0:0,n1:Math.max(2,s.n),l1:1,m:0}}function Fa(e){let t=_(e);if(Ea.has(e))return{formula:`H2O`,reactA:`Na`,reactB:`H2O`};if(Da.has(e))return{formula:`H${t}`,reactA:t===`F`?`Cs`:`Na`,reactB:`${t}2`};if(e===1)return{formula:`H2`,reactA:`H2`,reactB:`O2`};if(e===6)return{formula:`CH4`,reactA:`CH4`,reactB:`O2`};if(e===7)return{formula:`NH3`,reactA:`N2`,reactB:`H2`};if(e===8)return{formula:`H2O`,reactA:`H2`,reactB:`O2`};let n=y(e),r=n.reduce((e,t)=>Math.max(e,t.n),1),i=n.find(e=>e.n===r&&e.l===0)?.occupancy??0,a=n.find(e=>e.n===r&&e.l===1)?.occupancy??0;return i===1&&a===0?{formula:`${t}H`,reactA:t,reactB:`H2O`}:a>=1&&a<=3?{formula:`${t}H3`,reactA:t,reactB:`O2`}:{formula:`${t}O`,reactA:t,reactB:`HCl`}}function Ia(e,t,n=`valence`){return n===`d2`?{n0:5,l0:2,n1:6,l1:3,m:2}:n===`d0`?{n0:5,l0:2,n1:6,l1:1,m:0}:n===`p0`?{n0:2,l0:1,n1:3,l1:0,m:0}:n===`s0`?{n0:3,l0:0,n1:3,l1:1,m:0}:n===`f0`?{n0:4,l0:3,n1:5,l1:2,m:0}:Pa(e,t)}function La(e,t){Gn&&(Gn.textContent=e),Kn&&(Kn.textContent=t)}function Ra(e){qn&&(qn.innerHTML=e||``)}function za(e){let t=`${e.kind}:${e.label}`,n=Fi.findIndex(e=>`${e.kind}:${e.label}`===t);n>=0&&Fi.splice(n,1),Fi.unshift(e),Fi.length>6&&Fi.pop(),Ba()}function Ba(){let e=ja();if(!e)return;let t=Aa(e.electromagnetic?.opticalSrgb||[.7,.78,.9]),n=L===`compound`;Yn.className=`specimen-pill${n?` backfed`:``}`,Yn.innerHTML=`<i class="swatch" style="background:${t};"></i>`+(n?`<span>BACKFED COMPOUND: ${e.materialKey}</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Y(e.electromagnetic.bandGapEv,2)} eV`})</span>`:`<span>ELEMENT: ${e.nuclear.isotope} (Z=${e.atomicNumber})</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Y(e.electromagnetic.bandGapEv,2)} eV`})</span>`),Xn.innerHTML=Fi.map((e,t)=>`<button class="chip${e.kind===`compound`?` react`:``}" data-hist-idx="${t}">${e.label}</button>`).join(``);for(let e of Xn.querySelectorAll(`[data-hist-idx]`))e.addEventListener(`click`,()=>{let t=Fi[Number(e.dataset.histIdx)];t&&(t.kind===`element`?(V=t.Z,Pi=t.A??null,er.value=String(V),tr&&(tr.value=String(Pi??l(V))),Bo(V,Pi)):(cr.value=t.formula,Go(t.formula,{backfeedAllTabs:!0})))})}async function Va(e,t=!1){if(I!==`polytope`||!B||!F)return;let n=Wn.getBoundingClientRect(),r=(e.clientX-n.left)/Math.max(1,n.width),i=1-(e.clientY-n.top)/Math.max(1,n.height);if(r<.06||r>.96||i<.08||i>.9)return;let a=(r-.06)/.9,o=(i-.08)/.82,s=F.getPolytopeAxisBounds(B),c=s.minLt+a*(s.maxLt-s.minLt),l=s.minLp+o*(s.maxLp-s.minLp),u=10**c,d=10**l,f=await F.probePolytopeAtlasOnGpu(B,u,d);if(!f)return;let p=ja(),m=f.hit&&p?x(p,f.phase,u,d):null,h=f.hit&&m>0?Math.abs(f.densityKgPerM3-m)/m*100:null;K.polytopeProbe={...f,fx:a,fy:o,logT:c,logP:l,eosRho:m,relErrPct:h,locked:t},window.__ulgElementsLabState&&(window.__ulgElementsLabState.polytopeProbe=K.polytopeProbe),Q()}function Ha(){q=.42,J=.28,xa=2.85,Do()}function Ua(){return I===`polytope`&&K.polytopeViewMode!==`3d-surface`}function Wa(){let e=!1,t=new Map,n=0,r=null,i=null;function a(){let e=[...t.values()];return e.length<2?0:Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y)}Wn.addEventListener(`pointerdown`,e=>{if(Ua()){t.set(e.pointerId,{x:e.clientX,y:e.clientY});try{Wn.setPointerCapture?.(e.pointerId)}catch{}Va(e,!0);return}t.set(e.pointerId,{x:e.clientX,y:e.clientY});try{Wn.setPointerCapture?.(e.pointerId)}catch{}t.size===1?(Sa=!0,Ca=e.clientX,wa=e.clientY,n=0,r={id:e.pointerId,x:e.clientX,y:e.clientY,moved:!1,t:performance.now(),pointerType:e.pointerType}):t.size>=2&&(Sa=!1,r=null,i=null,n=a())}),Wn.addEventListener(`pointermove`,i=>{if(Ua()){if(i.pointerType!==`mouse`&&!t.has(i.pointerId))return;e||(e=!0,Va(i,t.has(i.pointerId)).finally(()=>{e=!1}));return}if(!t.has(i.pointerId))return;if(t.set(i.pointerId,{x:i.clientX,y:i.clientY}),r&&r.id===i.pointerId&&Math.hypot(i.clientX-r.x,i.clientY-r.y)>8&&(r.moved=!0),t.size>=2){let e=a();if(n>4&&e>4){let t=n/e;xa=Math.max(1.3,Math.min(5.4,xa*t)),Do()}n=e;return}if(!Sa)return;let o=i.clientX-Ca,s=i.clientY-wa;Ca=i.clientX,wa=i.clientY;let c=i.pointerType===`touch`?.0105:.008;q+=o*c,J=Math.max(-1.25,Math.min(1.25,J+s*c)),Do()});let o=e=>{let a=!!(r&&r.id===e.pointerId&&!r.moved&&t.size===1&&performance.now()-r.t<280),o=r?.pointerType||e.pointerType;if(t.delete(e.pointerId),t.size===1){let e=[...t.values()][0];Ca=e.x,wa=e.y,Sa=!Ua(),n=0}else{if(Sa=!1,n=0,a&&I===`polytope`&&K.polytopeViewMode===`3d-surface`)Va(e,!0);else if(a&&o===`touch`&&!Ua()){let t=performance.now();i&&t-i.t<300&&Math.hypot(e.clientX-i.x,e.clientY-i.y)<32?(i=null,Ha()):i={x:e.clientX,y:e.clientY,t}}r=null}};Wn.addEventListener(`pointerup`,o),Wn.addEventListener(`pointercancel`,o),Wn.addEventListener(`dblclick`,()=>{Ua()||Ha()}),Wn.addEventListener(`wheel`,e=>{Ua()||(e.preventDefault(),xa=Math.max(1.3,Math.min(5.4,xa+Math.sign(e.deltaY)*.18)),Do())},{passive:!1}),Br?.addEventListener(`click`,()=>Ha())}var Ga=ft();function Ka(e=!0,{actionMode:t=null}={}){Gr&&(t&&Jr&&(Jr.value=t),Gr.classList.toggle(`open`,!!e),e&&(Qr&&(Qr.value=Pi?String(Pi):``),qr?.focus?.(),qa()))}function qa(){if(!Kr)return;let e=String(qr?.value||``).trim().toLowerCase();for(let t of Kr.querySelectorAll(`.pt-cell`)){let n=Number(t.dataset.z),r=Ga[n-1],i=!0;ba===`ferromagnet`?i=r.isFerromagnet:ba===`superconductor`?i=r.isSuperconductor:ba===`reactive-metal`?i=r.isReactiveMetal:ba!==`all`&&(i=r.family===ba);let a=!0;e&&(a=String(n)===e||r.symbol.toLowerCase().includes(e)||r.name.toLowerCase().includes(e)||r.family.includes(e)),t.classList.toggle(`dimmed`,!(i&&a))}}function Ja(){if(!Kr)return;Kr.innerHTML=``;let e=(e,t,n,r)=>{let i=document.createElement(`div`);return i.className=`pt-placeholder`,i.style.gridRow=String(e),i.style.gridColumn=String(t),i.innerHTML=`<span>${r}</span><span style="font-size:7.5px;opacity:0.8;">${n}</span>`,i};Kr.appendChild(e(6,3,`La–Lu`,`57–71`)),Kr.appendChild(e(7,3,`Ac–Lr`,`89–103`));for(let e of Ga){let t=document.createElement(`button`);t.type=`button`,t.className=`pt-cell pt-fam-${e.family}${e.Z===V&&L===`element`?` active`:``}`,t.dataset.z=String(e.Z);let n=e.row>=8?e.row+1:e.row;t.style.gridRow=String(n),t.style.gridColumn=String(e.col),t.innerHTML=`<span class="c-z">${e.Z}</span><span class="c-sym">${e.symbol}</span><span class="c-name">${e.name}</span>`,t.title=`${e.name} (${e.symbol}, Z=${e.Z}) · ${$e[e.family]?.label||e.family} · ${e.massU} u`,t.addEventListener(`mouseenter`,()=>{if(Zr){let t=$e[e.family]?.label||e.family,n=[e.isFerromagnet?`Ferromagnet`:null,e.isSuperconductor?`BCS Superconductor`:null,e.isReactiveMetal?`Water/Acid Reactive`:null].filter(Boolean).join(` · `);Zr.innerHTML=`<b>${e.symbol} (Z=${e.Z}) · ${e.name}</b> — ${t} · ${e.massU} u · A*=${l(e.Z)}${n?` · <span style="color:#facc15">${n}</span>`:``}`}}),t.addEventListener(`click`,()=>{let t=Jr?.value||`solve`;if(t===`reactant-a`){ir&&(ir.value=e.symbol),Ka(!1),qo(`compound`);return}if(t===`reactant-b`){ar&&(ar.value=e.symbol),Ka(!1),qo(`compound`);return}let n=Qr?.value?.trim(),r=n?Math.trunc(Number(n)):null,i=r&&r>=e.Z&&r<=310?r:null;V=e.Z,Pi=i,er.value=String(e.Z),tr.value=String(i??l(e.Z)),Ka(!1),pi(!1),Bo(e.Z,i)}),Kr.appendChild(t)}$r&&($r.innerHTML=Object.entries($e).map(([,e])=>`<span><i style="background:${e.color};"></i>${e.label}</span>`).join(``)),qr?.addEventListener(`input`,qa);for(let e of Xr?.querySelectorAll(`[data-pt-filter]`)||[])e.addEventListener(`click`,()=>{ba=e.dataset.ptFilter||`all`;for(let t of Xr.querySelectorAll(`[data-pt-filter]`))t.classList.toggle(`gold`,t===e);qa()});if(ei?.addEventListener(`click`,()=>Ka(!0)),ti?.addEventListener(`click`,()=>Ka(!0)),Yn?.addEventListener(`click`,()=>Ka(!0)),ni?.addEventListener(`click`,()=>Ka(!0)),ii?.addEventListener(`click`,()=>Ka(!0)),Yr?.addEventListener(`click`,()=>Ka(!1)),Gr?.addEventListener(`click`,e=>{e.target===Gr&&Ka(!1)}),li){for(let e of li.querySelectorAll(`.acc-header`))e.addEventListener(`click`,()=>{let t=e.closest(`.acc-group`);if(!t)return;let n=e.dataset.accTab;n?I===n?t.classList.toggle(`open`):(t.classList.add(`open`),qo(n)):t.classList.toggle(`open`)});for(let e of li.querySelectorAll(`.acc-item-btn[data-nav-tab]`))e.addEventListener(`click`,async()=>{let t=e.dataset.navTab,n=e.dataset.navSub;if(t===`nuclear`)K.nuclearViewMode=n,n===`fission`&&go();else if(t===`atomic`)K.atomicViewMode=n;else if(t===`crystal`)K.crystalViewMode=n,n===`spin-llg`&&!ea&&yo(),n===`transport`&&!ia&&bo();else if(t===`md`)Co(null,n,{preserveColorMode:!1});else if(t===`compound`){if(K.chemViewMode=n,n===`reactive-md`&&!G)wo();else if(n===`vibrations`&&!ma){qo(t),await To(),await Eo();return}else if(!z&&n!==`reactive-md`){qo(t),await To();return}}else t===`polytope`&&(K.polytopeViewMode=n);qo(t)})}}function Ya(){if(Kr)for(let e of Kr.querySelectorAll(`.pt-cell`))e.classList.toggle(`active`,L===`element`&&Number(e.dataset.z)===V);let e=ja();if(L===`compound`&&e)ai&&(ai.textContent=`ΣZ=${e.nuclear.totalProtonsZ}`),oi&&(oi.textContent=String(e.materialKey||`Cmpd`).slice(0,4)),si&&(si.textContent=`Compound: ${e.materialKey}`),ci&&(ci.textContent=`${e.mechanical.crystalStructure} · ${Y(e.nuclear.molarMassU,2)} u`);else{let e=Ga[Math.max(0,Math.min(117,V-1))],t=R?.bundle?.nuclear?.A??Pi??l(V),n=$e[e.family]?.label||e.family;ai&&(ai.textContent=String(e.Z)),oi&&(oi.textContent=e.symbol),si&&(si.textContent=`${e.name} (${e.symbol}-${t})`),ci&&(ci.textContent=`${n} · ${e.massU} u`)}}var Xa=`nuclear`;function Za(){if(!Jn||!li)return;let e=li.querySelector(`.acc-group[data-acc-tab="${I}"]`)?.querySelector(`.acc-body`);if(!e)return;let t=e.querySelector(`.acc-item-btn.active`)||e.querySelector(`.acc-item-btn`);t?t.nextElementSibling!==Jn&&t.insertAdjacentElement(`afterend`,Jn):Jn.parentElement!==e&&e.appendChild(Jn);let n=Jn.children.length>0&&Jn.textContent.trim().length>0;Jn.style.display=n?`flex`:`none`}function Qa(){if(!li)return;let e=L===`element`;e||((K.nuclearViewMode===`fission`||K.nuclearViewMode===`bateman`)&&(K.nuclearViewMode=`tdse`),K.crystalViewMode===`bloch`&&(K.crystalViewMode=`photon-shell`));for(let e of li.querySelectorAll(`.acc-group[data-acc-tab]`)){let t=e.dataset.accTab,n=t===I;e.classList.toggle(`active-group`,n),n?e.classList.add(`open`):t===Xa&&t!==`compound`&&e.classList.remove(`open`)}Xa=I;let t={nuclear:K.nuclearViewMode,atomic:K.atomicViewMode,crystal:K.crystalViewMode,md:K.mdMode,compound:K.chemViewMode,polytope:K.polytopeViewMode};for(let n of li.querySelectorAll(`.acc-item-btn[data-nav-tab]`)){let r=n.dataset.navTab,i=n.dataset.navSub,a=r===`nuclear`&&(i===`fission`||i===`bateman`)||r===`crystal`&&i===`bloch`;n.style.display=!e&&a?`none`:``;let o=r===I&&i===t[I];n.classList.toggle(`active`,o)}Za()}function $a(e,t=null){let n=e.nuclear.dominantMode?`${e.nuclear.spinI}${e.nuclear.parity} (μ=${Y(e.nuclear.magneticMomentMuN,2)} μ_N) · ${e.nuclear.dominantMode}`:`M=${Y(e.nuclear.molarMassU,3)} u`,r=t&&t.steps?.length>0?`${t.steps.slice(0,3).map(e=>`${e.isotope}→${e.daughterIsotope}(${e.mode})`).join(` → `)}${t.steps.length>3?` …→${t.endIsotope}`:``}`:e.nuclear.dominantMode===`stable`?`Stable (no decay chain)`:`—`,i=e.atomic?.hyperfineSplittingHz,a=e.electromagnetic?.interbandOscillators||[],o=a.length?a.slice(0,2).map(e=>`${e.transitionLabel||`d→p`} ${Y(e.energyEv,2)}eV`).join(`, `):e.electromagnetic.isMetal?`Drude free-e`:`UV gap ${Y(e.electromagnetic.bandGapEv,2)}eV`,s=[[`Specimen / Family`,`${e.materialKey} (${e.family})`],[`Accuracy Tier`,e.accuracyTier],[`Nuclear`,e.nuclear.isotope?`${e.nuclear.isotope} (M=${Y(e.nuclear.atomicMassU,3)} u) · B/A=${Y(e.nuclear.bindingPerNucleonMeV,2)} MeV · R=${Y(e.nuclear.chargeRadiusFm,2)} fm`:`Z=${e.nuclear.totalProtonsZ}, A=${e.nuclear.totalNucleonsA}`],[`Spin / Mode`,n],...t?[[`Decay Chain`,r]]:[],[`Quantum Solver`,e.atomic.totalEnergyHa==null?`Ionic/Covalent DFT`:`${Y(e.atomic.totalEnergyHa,2)} Ha (${e.atomic.relativisticMethod||`GPU RHF`})`],...Number.isFinite(i)?[[`Isotope HFS / NMS`,`${Y(i*1e-6,2)} MHz · ΔE=${Y(e.atomic.isotopeMassShiftHa,2)} Ha`]]:[],[`Crystal / Density`,`${e.mechanical.crystalStructure} · ${Y(e.mechanical.densityKgPerM3,0)} kg/m³`],[`Moduli / Debye`,`K=${Y(e.mechanical.bulkModulusPa*1e-9,1)} GPa · Θ_D=${Y(e.mechanical.debyeTemperatureK,0)} K`],[`EM / Band Gap`,`${e.electromagnetic.isMetal?`Metal (ω_p=${Y(e.electromagnetic.plasmaEnergyEv,1)} eV)`:`Gap ${Y(e.electromagnetic.bandGapEv,2)} eV`} · σ=${Y(e.electromagnetic.electricalConductivitySPerM)} S/m`],[`Shell Transitions`,o],[`Optics (550 nm)`,`n=${Y(e.electromagnetic.refractiveIndex550Nm,2)} · R=${Y((e.electromagnetic.reflectance550Nm??0)*100,1)}%`],[`Magnetism`,`${e.electromagnetic.magneticPhase}${e.electromagnetic.magneticMomentMuB?` (${Y(e.electromagnetic.magneticMomentMuB,2)} μ_B)`:``}`],[`Melting / Boiling`,`${Y(e.thermodynamic.meltingPointK,1)} K / ${Y(e.thermodynamic.boilingPointK,1)} K`],[`Thermal k / C_p`,`${Y(e.thermodynamic.thermalConductivityWPerMK,2)} W/mK · ${Y(e.thermodynamic.heatCapacityCpJPerKgK,0)} J/kgK`]];dr.innerHTML=`<h3>5-Domain Bundle (${e.materialKey})</h3>`+s.map(([e,t])=>`<div class="kv"><span>${e}</span><span>${t}</span></div>`).join(``)}function eo(e,t){let n=Aa(e.electromagnetic.opticalSrgb||[.7,.75,.8]),r=Ui?.emergentReflectedSrgb?Aa(Ui.emergentReflectedSrgb):null,i=`<h3>Accuracy Tier &amp; G7 Advisory</h3>
    <div class="kv"><span>Status</span><span>${e.provenance.status} (scientificValidation: false)</span></div>
    <div class="kv"><span>Tier</span><span>${e.accuracyTier}</span></div>
    <div class="kv"><span>GPU Optical Color</span><span><i class="swatch" style="background:${n};"></i> ${n}</span></div>`;r&&(i+=`<div class="kv"><span>FDTD Reflected Color</span><span><i class="swatch" style="background:${r};"></i> ${r}</span></div>`),t?.hasReference?i+=`
      <div class="kv"><span>G7 B/A Error</span><span>${Y(t.bindingPerNucleonRelErr*100,2)}%</span></div>
      <div class="kv"><span>G7 Density Error</span><span>${Y(t.densityRelErr*100,1)}%</span></div>
      <div class="kv"><span>G7 Magnetic Match</span><span>${t.magneticPhaseMatch?`YES`:`DIFF`} (ref: ${t.reference.mag})</span></div>`:t?.note&&(i+=`<div style="font-size:10.5px;color:var(--muted);margin-top:4px;">${t.note}</div>`),fr.innerHTML=i}function to(e){let t=e.getBoundingClientRect();if(t.width>=120&&t.height>=60){let n=Math.round(t.width),r=Math.round(t.height);(Math.abs(e.width-n)>2||Math.abs(e.height-r)>2)&&(e.width=n,e.height=r)}return e.getContext(`2d`,{willReadFrequently:!0})}function no(e,t,{label:n=``,yMin:r=null,yMax:i=null,hLine:a=null,vLine:o=null,xTicks:s=null}={}){let c=to(e),l=e.width,u=e.height;c.fillStyle=`#060b14`,c.fillRect(0,0,l,u);let d=t.filter(e=>e.xs?.length>=2&&e.ys?.length>=2);if(!d.length)return;let f=1/0,p=-1/0,m=1/0,h=-1/0;for(let e of d){for(let t of e.xs)t<f&&(f=t),t>p&&(p=t);for(let t of e.ys)t<m&&(m=t),t>h&&(h=t)}r!=null&&(m=r),i!=null&&(h=i),a!=null&&(m=Math.min(m,a.y),h=Math.max(h,a.y));let g=Math.max(1e-9,p-f),_=Math.max(1e-9,h-m),v=e=>26+(e-f)/g*(l-26-10),y=e=>u-18-(e-m)/_*(u-19-18);if(c.strokeStyle=`rgba(148,163,184,0.14)`,c.lineWidth=1,c.beginPath(),c.moveTo(26,u-18),c.lineTo(l-10,u-18),c.stroke(),a!=null){let e=y(a.y);c.save(),c.strokeStyle=a.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(26,e),c.lineTo(l-10,e),c.stroke(),c.fillStyle=a.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(a.label||``,l-10-46,Math.max(27,e-3)),c.restore()}if(o!=null){let e=v(o.x);c.save(),c.strokeStyle=o.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(e,19),c.lineTo(e,u-18),c.stroke(),c.fillStyle=o.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(o.label||``,Math.min(l-42,e+3),29),c.restore()}for(let e of d){c.strokeStyle=e.color||`#56c2ff`,c.lineWidth=e.width||1.75,c.beginPath();for(let t=0;t<e.xs.length;t+=1){let n=v(e.xs[t]),r=y(e.ys[t]);t===0?c.moveTo(n,r):c.lineTo(n,r)}c.stroke(),e.fill&&(c.lineTo(v(e.xs[e.xs.length-1]),u-18),c.lineTo(v(e.xs[0]),u-18),c.closePath(),c.fillStyle=e.fill,c.fill())}if(Array.isArray(s)){c.fillStyle=`#94a3b8`,c.font=`9.5px Inter, sans-serif`;for(let e of s){let t=v(e.x);c.fillText(e.label,Math.max(26,Math.min(l-22,t-5)),u-4)}}c.fillStyle=`#a5bce0`,c.font=`10px Inter, sans-serif`,c.fillText(n,8,13)}function X(e,t,n,r={}){no(e,[{xs:t,ys:n,color:r.color||`#56c2ff`,width:r.width||1.8}],r)}function ro(e,t){let n=to(e),r=e.width,i=e.height;if(n.fillStyle=`#060b14`,n.fillRect(0,0,r,i),!t?.chartData)return;let{maxZ:a,maxN:o}=t.chartDims,s=[null,`#22c55e`,`#38bdf8`,`#f472b6`,`#facc15`,`#ef4444`];for(let e=1;e<=a;e+=1)for(let c=0;c<o;c+=1){let l=Math.round(t.chartData[((e-1)*o+c)*4+3]);if(l<=0)continue;n.fillStyle=s[l]||`#fff`;let u=12+c/o*(r-24),d=i-12-e/a*(i-24);n.fillRect(u,d,2,2)}let c=12+t.N/o*(r-24),l=i-12-t.Z/a*(i-24);n.strokeStyle=`#ffffff`,n.lineWidth=1.5,n.strokeRect(c-4,l-4,8,8)}function io(e,t,n){if(!n){X(e,Array.from(t.alphaWkb.rFm),Array.from(t.alphaWkb.vMeV),{label:`V_nuc + V_coul (MeV vs fm)`,color:`#facc15`});return}let r=Array.from(n.rGridFm),i=Array.from(n.potRawMeV),a=Array.from(n.prob),o=Math.max(12,...i),s=Math.max(1e-6,...a),c=a.map(e=>n.qEffMeV+e/s*(o*.65));no(e,[{xs:r,ys:i,color:`#facc15`,width:1.8},{xs:r,ys:c,color:`#38bdf8`,width:1.8,fill:`rgba(56, 189, 248, 0.24)`}],{label:`GPU TDSE |ψ(r,t)|² (cyan) vs V(r) (gold) · P_tunnel=${Y(n.pTunneled*100,2)}%`,hLine:{y:n.qEffMeV,color:`#f472b6`,label:`Q=${Y(n.qEffMeV,1)}MeV`}})}function ao(e,t,n=``){let r=to(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.channels){r.fillStyle=`#94a3b8`,r.font=`11px Inter, sans-serif`,r.fillText(`Stepping Maxwell-ADE-FDTD photon wavepackets on WebGPU…`,10,68);return}let o=t.channels,s=[`610nm R`,`535nm G`,`440nm B`,`${Math.round(o[3].wavelengthNm)}nm`],c=[`#ef4444`,`#22c55e`,`#3b82f6`,Aa(ka(o[3].wavelengthNm))],l=(i-12-78)/4;r.fillStyle=`#a5bce0`,r.font=`10px Inter, sans-serif`,r.fillText(`${n}Live GPU FDTD: Reflectance R (solid) vs Shell Absorption A (hatch)`,8,13);for(let e=0;e<4;e+=1){let n=o[e],i=12+e*l,u=Math.max(12,l*.34),d=a-22-22,f=Math.min(1,n.reflectance)*d,p=Math.min(1,n.absorption)*d,m=Math.min(1,n.transmittance)*d;r.fillStyle=c[e],r.fillRect(i+3,a-22-f,u,f),r.fillStyle=`rgba(192, 132, 252, 0.85)`,r.fillRect(i+5+u,a-22-p,u*.72,p),!t.isMetal&&m>1&&(r.strokeStyle=`#38bdf8`,r.lineWidth=1.5,r.strokeRect(i+3,a-22-m,u,m)),r.fillStyle=`#cbd5e1`,r.font=`9px ui-monospace, monospace`,r.fillText(s[e],i+2,a-7),r.fillText(`R${Math.round(n.reflectance*100)}%`,i+2,Math.max(30,a-22-f-2))}let u=i-66;r.fillStyle=Aa(t.emergentReflectedSrgb),r.fillRect(u,26,54,48),r.strokeStyle=`rgba(255,255,255,0.6)`,r.lineWidth=1.2,r.strokeRect(u,26,54,48),r.fillStyle=`#e2e8f0`,r.font=`9px Inter, sans-serif`,r.fillText(`Emergent`,u+4,86),r.fillText(`FDTD RGB`,u+3,97)}function oo(e,t,n,r,i,a){if(Array.isArray(t)&&t.length>=2&&Array.isArray(n)){let o=[{xs:t,ys:n.map(e=>e*100),color:`#fbbf24`,width:2}];if(Array.isArray(r)&&r.length===t.length){let e=Math.max(1,...r);o.push({xs:t,ys:r.map(t=>t/e*80),color:`#38bdf8`,width:1.4})}if(no(e,o,{label:`UV-Vis R(λ)% (gold) & scaled n(λ) (blue) — ${a}`,yMin:0,yMax:105,xTicks:[{x:380,label:`380nm`},{x:550,label:`550nm`},{x:740,label:`780nm`}]}),Array.isArray(i)&&i.length===3){let t=to(e);t.fillStyle=Aa(i),t.fillRect(e.width-34,6,24,13),t.strokeStyle=`rgba(255,255,255,0.45)`,t.strokeRect(e.width-34,6,24,13)}}else X(e,[380,550,780],[0,0,0],{label:`No spectral samples available`,color:`#64748b`,yMin:0,yMax:100})}function so(e,t,n,r,i){let a=to(e),o=e.width,s=e.height;a.fillStyle=`#060b14`,a.fillRect(0,0,o,s);let c=o*.5,l=s*.54,u=Math.min(o,s)*.36;a.strokeStyle=`rgba(148,163,184,0.18)`,a.lineWidth=1,a.beginPath(),a.arc(c,l,u,0,Math.PI*2),a.moveTo(c-u,l),a.lineTo(c+u,l),a.moveTo(c,l-u),a.lineTo(c,l+u),a.stroke();let d=e=>{let r=Math.cos(e),i=Math.sin(e),a=Math.abs(n);return t===0?.72:t===1?a===0?r:i:t===2?a===0?.5*(3*r*r-1):a===1?1.5*i*r:.75*i*i:.5*r*(5*r*r-3)};for(let e of[1,-1]){a.beginPath();let t=!1;for(let n=0;n<=180;n+=1){let r=n/180*Math.PI*2,i=d(r),o=i*e>0?Math.abs(i)*u:0,s=c+o*Math.sin(r),f=l-o*Math.cos(r);t?a.lineTo(s,f):(a.moveTo(s,f),t=!0)}a.closePath(),a.fillStyle=e>0?`rgba(255, 255, 255, 0.25)`:`rgba(97, 43, 222, 0.35)`,a.fill(),a.strokeStyle=e>0?`#ffffff`:`#8b5cf6`,a.lineWidth=1.6,a.stroke()}a.fillStyle=`#a5bce0`,a.font=`10px Inter, sans-serif`,a.fillText(`${r} · |Y_${t},${n}(θ)| polar slice · unpaired=${i}`,8,13)}function co(e,t,n=null){let r=to(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.polytopes?.length)return;let o={solid:`rgba(86, 194, 255, 0.36)`,liquid:`rgba(52, 211, 153, 0.38)`,gas:`rgba(251, 146, 60, 0.34)`,plasma:`rgba(192, 132, 252, 0.36)`},s={solid:`#56c2ff`,liquid:`#34d399`,gas:`#fb923c`,plasma:`#c084fc`},c=Math.log10(Math.max(1,Math.min(...t.polytopes.map(e=>e.axes[0].min)))),l=Math.log10(Math.max(10,Math.max(...t.polytopes.map(e=>e.axes[0].max)))),u=Math.min(...t.polytopes.map(e=>Math.log10(e.axes[1].min))),d=Math.max(...t.polytopes.map(e=>Math.log10(e.axes[1].max))),f=e=>30+(Math.log10(Math.max(1,e))-c)/Math.max(1e-6,l-c)*(i-30-10),p=e=>a-20-(e-u)/Math.max(1e-6,d-u)*(a-18-20);for(let e of t.polytopes){let t=Math.log10(e.axes[1].min),n=Math.log10(e.axes[1].max),i=[],a=[];for(let r=0;r<=12;r+=1){let o=t+r/12*(n-t),s=e.axes[0].min,c=e.axes[0].max;for(let t of e.inequalities||[]){let e=t.a[0],n=t.a[1],r=t.b;if(Math.abs(e)>1e-9){let t=(r-n*o)/e;e>0?c=Math.min(c,t):s=Math.max(s,t)}}c>s&&(i.push([f(s),p(o)]),a.push([f(c),p(o)]))}if(i.length>=2){r.beginPath(),r.moveTo(i[0][0],i[0][1]);for(let e of i)r.lineTo(e[0],e[1]);for(let e=a.length-1;e>=0;--e)r.lineTo(a[e][0],a[e][1]);r.closePath(),r.fillStyle=o[e.phase]||`rgba(255,255,255,0.2)`,r.fill(),r.strokeStyle=s[e.phase]||`#93c5fd`,r.lineWidth=1.2,r.stroke()}}if(n){let e=f(n.temperatureK),t=p(Math.log10(Math.max(1e-6,n.pressurePa)));r.strokeStyle=n.hit?`#facc15`:`#f87171`,r.lineWidth=1.8,r.beginPath(),r.arc(e,t,5,0,Math.PI*2),r.stroke()}r.fillStyle=`#a5bce0`,r.font=`9.5px Inter, sans-serif`,r.fillText(`A x <= b (${t.materialKey}, ${t.polytopeCount} cells)`,30,12),r.fillText(`T: ${Math.round(10**c)}..${Math.round(10**l)} K`,30,a-5),r.fillText(`log10 P: ${u.toFixed(0)}..${d.toFixed(0)}`,i-102,a-5)}function lo(){if(!P)return;if(L===`compound`&&z?.visualData?.molQm?.atomOrbitalParams){let e=z.visualData.molQm.atomOrbitalParams,t=Li?.pointsBuffer??null;if(Li=ne(P,{posZeta:e.posZeta,weights:e.weights,boxHalfBohr:e.boxHalfBohr,mode:K.molOrbitalMode,pointCount:Math.min(24e4,K.pointCount),seed:K.cloudSeed,reuseBuffer:t}),t&&t!==Li?.pointsBuffer)try{t.destroy()}catch{}return}if(!R?.visualData?.atom)return;let e=R.visualData.atom;K.l=Math.max(0,Math.min(K.n-1,K.l)),K.m=Math.max(-K.l,Math.min(K.l,K.m));let t=null;if(Array.isArray(e.orbitalWavefunctions)&&Array.isArray(e.orbitals)){let n=e.orbitals.findIndex(e=>e.n===K.n&&e.l===K.l);n>=0&&e.orbitalWavefunctions[n]&&(t=e.orbitalWavefunctions[n])}let n=Ii?.pointsBuffer??null;if(Ii=ae(P,{Z:e.atomicNumberZ,n:K.n,l:K.l,m:K.m,pointCount:K.pointCount,rGrid:e.radialGrid?.r||null,orbitalU:t,screeningExchange:K.functional!==`bare`,relativisticSpinOrbit:K.relativisticSpinOrbit,colorMode:K.colorMode,seed:K.cloudSeed,reuseBuffer:n}),n&&n!==Ii?.pointsBuffer)try{n.destroy()}catch{}uo()}function uo({resetField:e=!0}={}){if(!P)return;let t=Ma(),n=V,r=null,i=()=>null;if(L===`compound`&&z)n=(z.bundle?.nuclear?.isotopologueSites||[]).reduce((e,t)=>Math.max(e,t.Z||1),8);else if(R?.visualData?.atom){let e=R.visualData.atom;n=e.atomicNumberZ,r=e.radialGrid?.r||null,i=(t,n)=>{if(!Array.isArray(e.orbitalWavefunctions)||!Array.isArray(e.orbitals))return null;let r=e.orbitals.findIndex(e=>e.n===t&&e.l===n);return r>=0?e.orbitalWavefunctions[r]:null}}let a=Ia(n,R?.visualData?.atom||null,K.tdksOrbitalPreset),o=i(a.n0,a.l0),s=i(a.n1,a.l1),c=Ri?.posBuffer??null,l=Ri?.ampBuffer??null;if(Ri=fe(P,{Z:n,n0:a.n0,l0:a.l0,n1:a.n1,l1:a.l1,m:a.m,rGrid:r,u0:o,u1:s,pointCount:ui?75e3:18e4,screeningExchange:K.functional!==`bare`,relativisticSpinOrbit:K.relativisticSpinOrbit,seed:K.cloudSeed,reusePosBuffer:c,reuseAmpBuffer:l}),H){try{H.destroy()}catch{}H=null}Bi=null,t&&(H=Gt(P,t,{Z:n,n0:a.n0,l0:a.l0,n1:a.n1,l1:a.l1,m:a.m,rGrid:r,u0:o,u1:s,screeningExchange:K.functional!==`bare`,relativisticSpinOrbit:K.relativisticSpinOrbit,gridN:ui?24:32,probeWavelengthNm:K.probeWavelengthNm,polMode:K.tdksPolMode,modeMono:K.photonModeMono}),e&&(H.stepSync(34),H.readTelemetry().then(e=>{if(!e)return;Bi=e;let t=ja();t&&qt({closureRegistry:Un,materialKey:t.materialKey,telemetry:e}).catch(()=>{}),window.__ulgElementsLabState&&(window.__ulgElementsLabState.tdks3dTelemetry=e),I===`crystal`&&K.crystalViewMode===`tdks-atom`&&Q()}).catch(()=>{})))}function fo(){return L===`compound`&&Li?.pointsBuffer?Li:Ii}function po(){if(!P)return;if(Hi){try{Hi.destroy()}catch{}Hi=null}Ui=null;let e=Ma();if(e){zi=ue(e,{probeWavelengthNm:K.probeWavelengthNm});for(let e=0;e<45;e+=1)zi.stepFs(.08);uo({resetField:!0}),Hi=le(P,e,{probeWavelengthNm:K.probeWavelengthNm});for(let e=0;e<5;e+=1)Hi.stepSync(24);Hi.readTelemetry().then(t=>{if(!t)return;Ui=t;let n=ja();n&&ie({closureRegistry:Un,materialKey:n.materialKey,electromagnetic:e,telemetry:t}).catch(()=>{}),I===`crystal`&&Q()}).catch(()=>{})}}function mo(){if(!P)return;if(Gi){try{Gi.destroy()}catch{}Gi=null}Ki=null;let e=R?.visualData?.nuclear;e&&(Gi=oe(P,e))}function ho(e){if(!e?.steps?.length)return null;let t=e.steps,n=Math.max(1e-6,Math.min(1e24,Number(t[0].halfLifeS)||1)),r={};for(let e of t)r[e.isotope]=e;let i=[t[0].isotope,t[0].daughterIsotope];t.length>=2&&!i.includes(t[1].daughterIsotope)&&i.push(t[1].daughterIsotope),e.endIsotope&&!i.includes(e.endIsotope)&&i.push(e.endIsotope);let a=[],o=i.map(e=>({name:e,frac:[]})),s=1e6,c=[{isotope:t[0].isotope,A:t[0].A,atomCount:s}],l=n*6/35;for(let e=0;e<36;e+=1){a.push(e*l/n);for(let e=0;e<i.length;e+=1){let t=c.find(t=>t.isotope===i[e]);o[e].frac.push((t?.atomCount||0)/s)}e<35&&(c=k(c,l,{channels:r}).nextInventory)}return{tHalfUnits:a,firstHalfLifeS:n,curves:o}}function go(){if(!P||L!==`element`||!R?.visualData?.nuclear)return;let e=R.visualData.nuclear;la=c(e.Z,e.A),ca=h(P,e,{beta2:K.fissionBeta2,dim:ui?24:28,reuseBuffer:ca?.buffer??null})}function _o(){let e=K.ionizedCation&&da?.cationAtom?da.cationAtom:R?.visualData?.atom;if(!e){fa=null;return}fa=se({atomResult:e,eFieldVPerA:K.starkFieldVPerA})}async function vo(e){if(!P||L!==`element`||!R?.visualData?.atom)return;if(K.ionizedCation=!!e,K.ionizedCation&&(!da||da.Z!==V)){ur.textContent=`Solving ΔSCF ${_(V)}⁺…`;let e=R.visualData.atom,t=R.visualData.nuclear;da=await j(P,{Z:V,solveAtomFullWebGpu:re,baseConfiguration:y(V),baseAtomResult:e,functional:K.functional,scalarRelativistic:K.relativisticSpinOrbit,spinOrbit:K.relativisticSpinOrbit,nuclearChargeRadiusBohr:t?.chargeRadiusBohr,nuclearMassU:t?.atomicMassU}),ur.textContent=`${_(V)}⁺ I₁=${Y(da?.ionizationEnergyEv,2)} eV`}let t=K.ionizedCation&&da?.cationAtom?da.cationAtom:R.visualData.atom;if(t){let e=null;if(Array.isArray(t.orbitalWavefunctions)&&Array.isArray(t.orbitals)){let n=t.orbitals.findIndex(e=>e.n===K.n&&e.l===K.l);n>=0&&(e=t.orbitalWavefunctions[n])}let n=Ii?.pointsBuffer??null;Ii=ae(P,{Z:K.ionizedCation?t.atomicNumberZ+.65:t.atomicNumberZ,n:K.n,l:K.l,m:K.m,pointCount:K.pointCount,rGrid:t.radialGrid?.r||null,orbitalU:e,screeningExchange:K.functional!==`bare`,relativisticSpinOrbit:K.relativisticSpinOrbit,colorMode:K.colorMode,seed:K.cloudSeed,reuseBuffer:n})}_o(),Z(),Q(),$()}function yo(){if(!P)return;if(ea){try{ea.destroy()}catch{}ea=null}ta=null,na=[];let e=ja(),t=Ma();if(!e||!t)return;let n=Number(t.curieOrNeelTempK)||0;K.spinTempK=(t.magneticPhase===`ferromagnetic`||t.magneticPhase===`antiferromagnetic`)&&n>20?Math.max(10,Math.round(n*.45)):300;let r=ui?8:10;ea=nn(P,t,e.mechanical||{},{nx:r,ny:r,nz:r,temperatureK:K.spinTempK,fieldBZTesla:K.spinFieldBTesla}),ea.stepBatch(18,{readObs:!0}).then(n=>{n&&(ta=n,na.push({B:n.fieldBZTesla,Mz:n.magnetizationZ,Mmag:n.magnetizationMag,Mstag:n.staggeredOrderMag,T:n.temperatureK}),rn({closureRegistry:Un,materialKey:e.materialKey,electromagnetic:t,mechanical:e.mechanical,telemetry:n}).catch(()=>{}),I===`crystal`&&K.crystalViewMode===`spin-llg`&&Q(),$())}).catch(()=>{})}function bo(e=null){if(!P)return;if(ia){try{ia.destroy()}catch{}ia=null}aa=null,oa=[];let t=ja(),n=Ma();if(!t||!n)return;let r=Number(n.superconductingTcK)||0;e==null?r>.8&&K.crystalViewMode===`transport`?K.transportTempK=Math.max(.5,Number((r*.35).toFixed(1))):K.transportTempK=300:K.transportTempK=Math.max(.5,Number(e)),ia=_n(P,n,t.mechanical||{},{carrierCount:ui?512:1024,temperatureK:K.transportTempK,eFieldVPerM:K.transportEFieldVPerM}),ia.stepBatch(16,{readObs:!0}).then(e=>{e&&(aa=e,oa.push({T:e.temperatureK,drift:e.meanDriftNorm,scatter:e.measuredScatterRateFrac,sigma:e.sigmaGpuSPerM}),vn({closureRegistry:Un,materialKey:t.materialKey,electromagnetic:n,mechanical:t.mechanical,telemetry:e}).catch(()=>{}),I===`crystal`&&K.crystalViewMode===`transport`&&Q(),$())}).catch(()=>{})}function xo(e,t,n=`medium`){let r=String(e||`fcc`).toLowerCase(),i=r===`bcc`||r.startsWith(`cscl`),a=r===`diamond`||r.startsWith(`zincblende`),o={small:0,medium:1,"2k":2,"10k":3,"50k":4,"100k":5,large:2}[n]??1;return t===`acoustic`?i?[[6,2,2],[9,3,3],[16,6,5],[27,10,9],[46,17,16],[58,21,21]][o]:a?[[5,2,2],[7,2,2],[10,4,4],[17,7,6],[30,11,10],[37,13,13]][o]:[[6,2,2],[8,3,3],[13,5,4],[22,8,7],[37,13,13],[46,17,16]][o]:t===`thermal`?i?[[5,3,3],[8,3,3],[15,6,6],[25,10,10],[42,17,17],[53,22,22]][o]:a?[[4,2,2],[6,2,2],[9,4,4],[16,7,6],[26,11,11],[33,14,14]][o]:[[4,2,2],[6,3,3],[12,5,5],[20,8,8],[34,14,14],[42,17,17]][o]:t===`surface`?i?[[4,4,4],[5,5,5],[10,10,10],[17,17,17],[29,29,30],[37,37,37]][o]:a?[[2,2,2],[3,3,3],[6,6,6],[11,11,11],[18,18,19],[23,23,24]][o]:[[3,3,3],[4,4,4],[8,8,8],[14,14,13],[23,23,24],[29,29,30]][o]:i?[[4,4,4],[6,6,6],[10,10,10],[17,17,17],[29,29,30],[37,37,37]][o]:a?[[3,3,3],[4,4,4],[6,6,6],[11,11,11],[18,18,19],[23,23,24]][o]:[[3,3,3],[5,5,5],[8,8,8],[14,14,13],[23,23,24],[29,29,30]][o]}function So(e,t,n=1){let r=Math.max(20,Number(e)||600),i=Math.max(r*1.25+10,Number(t)||r*2.4),a=Number(n)===0,o=Math.max(15,Math.round(.3*r)),s=Math.round(a?Math.min(.92*i,Math.max(1.25*r,.5*(r+i))):Math.min(.84*i,Math.max(1.65*r,.52*(r+i)))),c=Math.round(a?Math.max(2.15*i,3.6*r):Math.max(2.55*i,6.5*r)),l=Math.max(1500,Math.round(Math.max(c*1.25,i*3)));return{tMelt:Math.round(r),tBoil:Math.round(i),tSolid:o,tMeltLiquid:s,tVapor:c,tMax:l}}function Co(e=null,t=null,{preserveColorMode:n=!0}={}){let r=K.mdMode;if(t&&(K.mdMode=t),!n&&t&&t!==r&&(t===`thermal`||t===`acoustic`||t===`shear`?K.mdColorMode=0:t===`strain`?K.mdColorMode=2:t===`equilibrium`&&(K.mdColorMode=1)),U){try{U.destroy()}catch{}U=null}if(Qi=!1,Ji=null,Yi=[],Xi=[],Zi=[],$i=null,!P)return;let i=K.mdMode||`equilibrium`,o={equilibrium:v.EQUILIBRIUM,strain:v.STRAIN,acoustic:v.ACOUSTIC,shear:v.SHEAR_NEMD,thermal:v.THERMAL_NEMD,surface:v.SURFACE_SLAB}[i]??v.EQUILIBRIUM,s=i===`surface`?2.5:1,c=i===`equilibrium`&&K.mdChamberMode===`drop`?2.35:1,l=i===`equilibrium`&&K.mdChamberMode===`bulk`?.015:0;if(L===`compound`&&z?.visualData?.mdConfig){let t=z.visualData.mdConfig,n=z.bundle,r=Math.max(20,Number(n.thermodynamic.meltingPointK||300)),o=Math.max(r*1.25+10,Number(n.thermodynamic.boilingPointK||r*2.2)),u=So(r,o,t.potentialModel),d=i===`shear`?u.tMeltLiquid:u.tSolid,f=e??d;K.mdTargetTempK=Math.round(f),K.mdPhasePreset=e==null&&i===`equilibrium`?`solid`:K.mdPhasePreset;let p=xo(t.crystalStructure,i,K.mdSizePreset),m=Math.max(1.5,Number(n.mechanical?.bulkModulusPa||12e9)/1e9),h=Math.max(.05,Number(n.mechanical?.cohesiveEnergyEv||t.epsilonEv*8||.6)),_=g({crystalStructure:t.crystalStructure,cellsVec:p,vacuumZFactor:s,chamberScale:c,vacancyFraction:l,latticeConstantA:t.latticeConstantA,massU:t.massU,temperatureK:f});U=a(P,{..._,potentialModel:t.potentialModel,epsilonEv:t.epsilonEv,sigmaOrR0A:t.sigmaOrR0A,alphaOrLambda:t.alphaOrLambda,rcutA:t.rcutA,eamAEv:t.eamAEv,eamBeta:t.eamBeta,dtFs:t.dtFs,targetTemperatureK:f,thermostatCouplingFs:18,meltingPointK:r,bulkModulusGPa:m,cohesiveEnergyEv:h,gravityEnabled:K.mdGravity}),$i={label:n.materialKey,crystalStructure:t.crystalStructure,modelName:t.modelName,potentialModel:t.potentialModel,rcutA:t.rcutA,dtFs:t.dtFs,meltingPointK:r,boilingPointK:o,cohesiveEnergyEv:h,rNearestNeighborA:_.rNearestNeighborA,idealCoordination:_.idealCoordination},Ji=z.visualData.mdTelemetry}else if(R?.visualData?.thermo?.potential){let t=R.visualData.bulk,n=R.visualData.thermo.potential,r=R.bundle,o=Math.max(1,Number(r.nuclear.atomicMassU||28)),u=Math.max(20,Number(r.thermodynamic.meltingPointK||600)),d=Math.max(u*1.25+10,Number(r.thermodynamic.boilingPointK||u*2.4)),f=So(u,d,n.potentialModel),p=i===`shear`?f.tMeltLiquid:f.tSolid,m=e??p;K.mdTargetTempK=Math.round(m),K.mdPhasePreset=e==null&&i===`equilibrium`?`solid`:K.mdPhasePreset;let h=Math.min(2,Math.max(.45,.09*Math.sqrt(o))),_=xo(t.crystalStructure,i,K.mdSizePreset),v=Math.max(1,Number(t.bulkModulusPa||4e10)/1e9),y=Math.max(.05,Number(t.cohesiveEnergyEv||2)),b=g({crystalStructure:t.crystalStructure,cellsVec:_,vacuumZFactor:s,chamberScale:c,vacancyFraction:l,latticeConstantA:Math.max(2.4,Number(t.latticeConstantA||3.6)),massU:o,temperatureK:m});U=a(P,{...b,potentialModel:n.potentialModel,epsilonEv:n.epsilonEv,sigmaOrR0A:n.sigmaOrR0A,alphaOrLambda:n.alphaOrLambda,rcutA:n.rcutA,eamAEv:n.eamAEv,eamBeta:n.eamBeta,swGamma:n.swGamma,dtFs:h,targetTemperatureK:m,thermostatCouplingFs:18,meltingPointK:u,bulkModulusGPa:v,cohesiveEnergyEv:y,gravityEnabled:K.mdGravity}),$i={label:r.nuclear.isotope||r.symbol,crystalStructure:t.crystalStructure,modelName:n.modelName,potentialModel:n.potentialModel,rcutA:n.rcutA,dtFs:h,meltingPointK:u,boilingPointK:d,cohesiveEnergyEv:y,rNearestNeighborA:b.rNearestNeighborA,idealCoordination:b.idealCoordination},Ji=R.visualData.thermo.mdTelemetry}if(U){U.setExperimentMode(o,{shearWallVel:i===`shear`?.14:0,thermalDeltaT:i===`thermal`?Math.max(40,Math.round(K.mdTargetTempK*.4)):0}),i===`acoustic`&&U.injectAcousticPulse({polarization:`longitudinal`,amplitude:.4});let e=U;Qi=!0,e.stepBatch(2,{readTelemetry:!0,temperatureK:K.mdTargetTempK,nptBarostatGPa:null,nonBlocking:!0}).then(t=>{!t||U!==e||(Ji=t,Yi.push({t:t.timeFs,T:t.temperatureK,msd:t.msdA2}),window.__ulgElementsLabState&&(window.__ulgElementsLabState.mdTelemetry=t),I===`md`&&Q())}).catch(()=>{}).finally(()=>{U===e&&(Qi=!1)})}Ji&&Yi.length===0&&Yi.push({t:0,T:Ji.temperatureK,msd:Ji.msdA2})}function wo(e={}){if(!P)return;if(G){try{G.destroy()}catch{}G=null}ga=null,_a=[];let t=Di?.candidates?.[0]||null,n=W,r=e.equation||n?.equation||t?.equation||`2 Na + 2 H2O -> 2 NaOH + H2`,i=t?.reactants?.map(e=>e.formula)||[`A`,`B`],a=t?.products?.map(e=>e.formula)||[`C`,`D`],o=[i[0]||`A`,i[1]||i[0]||`B`,a[0]||`C`,a[1]||a[0]||`D`],s=e.forwardBarrierEv??n?.forwardBarrierEv??.95,c=e.reactionEnthalpyEv??(t?.energetics?.reactionEnthalpyJPerBalancedEquation==null?-1.65:Math.max(-4.5,Math.min(2.5,t.energetics.reactionEnthalpyJPerBalancedEquation/96485.3)));G=Ye(P,{equation:r,speciesLabels:o,moleculeCount:ui?128:192,forwardBarrierEv:s,reactionEnthalpyEv:c,temperatureK:K.rxMdTempK,catalystEnabled:K.rxMdCatalyst,thermostatEnabled:K.rxMdThermostat}),G.stepBatch(6,{readObs:!0}).then(e=>{e&&(ga=e,_a.push({step:e.stepIndex,fA:e.fracA,fB:e.fracB,fC:e.fracC,fD:e.fracD,T:e.temperatureK}),Xe({closureRegistry:Un,equation:r,telemetry:e}).catch(()=>{}),I===`compound`&&K.chemViewMode===`reactive-md`&&Q(),$())}).catch(()=>{})}async function To(){if(z||!P)return z;if(L===`element`){let e=Fa(V);return ir&&(ir.value=e.reactA),ar&&(ar.value=e.reactB),cr&&(cr.value=e.formula),await Go(e.formula,{backfeedAllTabs:!1,switchToTab:`compound`,previewOnly:!0}),z}return await Go(cr?.value||`H2O`,{backfeedAllTabs:!1,switchToTab:`compound`}),z}async function Eo({deuterated:e=K.vibIsotopeDeuterated}={}){if(!P)return null;await To();let t=z?.visualData?.molQm,n=z?.bundle?.materialKey||`H2O`;if(!t?.atoms?.length||t.atoms.length<2||t.atoms.length>6)return null;K.vibIsotopeDeuterated=!!e,ur.textContent=`GPU Opt & Hessian (${n}${e?` [D]`:``})…`;try{(!pa||pa.formula!==n)&&(pa={...await ze(P,t.atoms,{maxSteps:t.atoms.length<=3?6:4,basisName:t.basisUsed||`auto`}),formula:n});let r=pa.atoms,i=r.map(e=>e.Z===1&&K.vibIsotopeDeuterated?2.01410178:null),a=await Ve(P,r,{massesU:i,basisName:pa.basisUsed||`auto`});return ma={...a,formula:n,deuterated:K.vibIsotopeDeuterated},K.vibModeIdx=Math.min(K.vibModeIdx,Math.max(0,a.modes.length-1)),await He({closureRegistry:Un,formula:`${n}${e?`-D`:``}`,vibrations:a}).catch(()=>{}),ur.textContent=`${n} · ${a.modes.length} GPU Modes (ZPE=${Y(a.totalZpeEv,2)} eV)`,Z(),Q(),$(),ma}catch(e){return ur.textContent=`Vib err: ${e.message}`,null}}function Z(){if(!Jn)return;let e=ja(),t=Bn(I,Oo(I)),n=`<button id="ctrl-about-sim" class="action about-sim-btn" type="button" title="Open explanation of what ${t.title} shows, its GPU physics, and why it exists in ULG"><span>ⓘ About This Simulation</span><span style="opacity:0.75;font-size:9.5px;">${t.scale}</span></button>`;if(I===`nuclear`){let e=L===`element`;K.nuclearViewMode===`fission`&&e?Jn.innerHTML=`${n}
        <div class="ctrl-group">
          <div class="ctrl-row">
            <label title="Quadrupole nuclear deformation parameter β₂ (0 = spherical, β* = saddle barrier, >1 = scission)">β₂=<b id="lbl-fiss-b2">${K.fissionBeta2.toFixed(2)}</b></label>
            <input id="ctrl-fiss-b2" type="range" min="0" max="1.35" step="0.03" value="${K.fissionBeta2}" title="Drag to deform the 3D nucleus from spherical (0) past saddle β* to binary scission (1.35)" />
          </div>
          <div class="ctrl-row">
            <button id="ctrl-fiss-play" class="action gold-btn" title="Animate continuous nuclear deformation across the Bohr–Wheeler fission barrier">${K.fissionPlaying?`Pause`:`Play Fission`}</button>
            <button id="ctrl-fiss-saddle" class="action" title="Snap deformation β₂ directly to the Bohr–Wheeler saddle-point barrier β*">Saddle β*</button>
          </div>
        </div>`:K.nuclearViewMode===`bateman`&&e?Jn.innerHTML=`${n}`:Jn.innerHTML=`${n}
        <div class="ctrl-group">
          <button id="ctrl-tdse-play" class="action" title="Play or pause the live 1D symplectic Visscher quantum α-tunneling TDSE">${K.tdsePlaying?`Pause TDSE`:`Play TDSE`}</button>
          <button id="ctrl-tdse-reset" class="action" title="Re-initialize the α-particle wavepacket inside the nuclear potential well">Reset α-Wavepacket</button>
        </div>`,document.getElementById(`ctrl-fiss-b2`)?.addEventListener(`input`,e=>{K.fissionBeta2=Number(e.target.value),document.getElementById(`lbl-fiss-b2`).textContent=K.fissionBeta2.toFixed(2),go(),Q()}),document.getElementById(`ctrl-fiss-play`)?.addEventListener(`click`,()=>{K.fissionPlaying=!K.fissionPlaying,Z()}),document.getElementById(`ctrl-fiss-saddle`)?.addEventListener(`click`,()=>{K.fissionBeta2=la?.saddleBeta??.72,K.fissionPlaying=!1,go(),Z(),Q()}),document.getElementById(`ctrl-tdse-play`)?.addEventListener(`click`,()=>{K.tdsePlaying=!K.tdsePlaying,Z()}),document.getElementById(`ctrl-tdse-reset`)?.addEventListener(`click`,()=>{Gi?.resetWavepacket(),Q()})}else if(I===`atomic`){if(L===`compound`&&z?.visualData?.molQm){Jn.innerHTML=`${n}
        <div class="ctrl-group">
          <label title="Select molecular orbital density to sample on WebGPU">MO</label>
          <button class="action${K.molOrbitalMode===0?` active-toggle`:``}" data-mol-mode="0" title="Sample total converged molecular electron density ρ(r)">Total ρ(r)</button>
          <button class="action${K.molOrbitalMode===1?` active-toggle`:``}" data-mol-mode="1" title="Sample Highest Occupied Molecular Orbital (HOMO) lobes &amp; phase">HOMO</button>
          <button class="action${K.molOrbitalMode===2?` active-toggle`:``}" data-mol-mode="2" title="Sample Lowest Unoccupied Molecular Orbital (LUMO) lobes &amp; phase">LUMO</button>
        </div>
        <div class="ctrl-group">
          <label title="Toggle 3D Cartesian coordinate axes and reference grid"><input id="ctrl-guides" type="checkbox" title="Toggle 3D Cartesian coordinate axes and reference grid" ${K.showGuides?`checked`:``} /> Grid+Axes</label>
          <button id="ctrl-rotate" class="action${K.autoRotate?` active-toggle`:``}" title="Toggle gentle continuous 3D camera turntable rotation">${K.autoRotate?`Pause Rot`:`Rotate`}</button>
        </div>`;for(let e of Jn.querySelectorAll(`[data-mol-mode]`))e.addEventListener(`click`,()=>{K.molOrbitalMode=Number(e.dataset.molMode),lo(),Z(),Q()})}else{let e=Array.from({length:K.n},(e,t)=>`<option value="${t}" ${t===K.l?`selected`:``}>l=${t} (${Ta[t]||t})</option>`).join(``),t=Array.from({length:2*K.l+1},(e,t)=>{let n=t-K.l;return`<option value="${n}" ${n===K.m?`selected`:``}>m=${n}</option>`}).join(``),r=K.atomicViewMode===`cloud`;Jn.innerHTML=`${n}
        <div class="ctrl-group">
          <div class="ctrl-row">
            <label title="Principal quantum number n (controls shell size and radial nodes n − l − 1)">n=<b id="lbl-n">${K.n}</b></label>
            <input id="ctrl-n" type="range" min="1" max="7" value="${K.n}" title="Principal quantum number n (1..7)" />
            <button id="ctrl-valence" class="action" title="Snap quantum numbers (n, l, m) to this element's active valence subshell">Valence</button>
            <button id="ctrl-rand-nlm" class="action" title="Pick a random element and (n, l, m) orbital to explore">Rand</button>
          </div>
          <div class="ctrl-row">
            <select id="ctrl-l" title="Angular momentum quantum number l (0=s sphere, 1=p dumbbell, 2=d cloverleaf, 3=f octupole)">${e}</select>
            <select id="ctrl-m" title="Magnetic quantum number m (−l..+l controls 3D lobe orientation and azimuthal nodes)">${t}</select>
          </div>
        </div>
        <div class="ctrl-group">
          <label title="Exchange-correlation functional used inside the WebGPU Kohn–Sham SCF solver">XC</label>
          <select id="ctrl-xc" title="Re-solve GPU Kohn-Sham SCF with PBE GGA, LDA, or unscreened Bare Nucleus (Z/r)">
            <option value="pbe" ${K.functional===`pbe`?`selected`:``}>PBE GGA</option>
            <option value="lda" ${K.functional===`lda`?`selected`:``}>LDA</option>
            <option value="bare" ${K.functional===`bare`?`selected`:``}>Bare Z</option>
          </select>
          <label title="Enable Koelling–Harmon scalar-relativistic contraction + spin-orbit coupling (re-solves live on GPU)">
            <input id="ctrl-rel" type="checkbox" title="Enable Koelling–Harmon scalar-relativistic contraction + spin-orbit coupling" ${K.relativisticSpinOrbit?`checked`:``} /> Relativistic+SO
          </label>
        </div>
        ${r?`
        <div class="ctrl-group">
          <div class="ctrl-row">
            <label title="Number of GPU Monte Carlo probability samples drawn from |ψ_{n,l,m}|²">Pts <b id="lbl-pts">${Math.round(K.pointCount/1e3)}K</b></label>
            <input id="ctrl-pts" type="range" min="50000" max="500000" step="25000" value="${K.pointCount}" title="Adjust 3D orbital point cloud sample count (50K to 500K GPU points)" />
          </div>
          <div class="ctrl-row">
            <label title="Screen-space radius of each electron probability sample">Size</label>
            <input id="ctrl-psize" type="range" min="0.006" max="0.045" step="0.002" value="${K.pointSize}" title="Adjust rendered point radius for crispness vs smooth glow" />
            <label title="Per-sample additive blending opacity">Opac</label>
            <input id="ctrl-opac" type="range" min="0.08" max="0.80" step="0.04" value="${K.opacity}" title="Adjust point cloud brightness and optical depth" />
          </div>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-row">
            <select id="ctrl-cmode" title="Color electron samples by alternating radial nodal shells or ±ψ wavefunction sign">
              <option value="0" ${K.colorMode===0?`selected`:``}>Radial Shells</option>
              <option value="1" ${K.colorMode===1?`selected`:``}>±ψ Phase</option>
            </select>
            <input id="ctrl-col-a" type="color" value="${K.shellColorA}" title="Primary orbital shell / positive phase (+ψ) color" />
            <input id="ctrl-col-b" type="color" value="${K.shellColorB}" title="Alternating nodal shell / negative phase (−ψ) color" />
          </div>
          <div class="ctrl-row">
            <label title="Toggle 3D Cartesian axes and reference ring"><input id="ctrl-guides" type="checkbox" title="Toggle 3D Cartesian axes and reference ring" ${K.showGuides?`checked`:``} /> Grid</label>
            <button id="ctrl-regen" class="action" title="Draw a fresh GPU Monte Carlo random sample seed from |ψ|²">Resample</button>
            <button id="ctrl-rotate" class="action${K.autoRotate?` active-toggle`:``}" title="Toggle gentle continuous 3D camera turntable rotation">${K.autoRotate?`Pause`:`Rotate`}</button>
          </div>
        </div>`:`
        <div class="ctrl-group">
          <label title="Toggle 3D Cartesian axes and reference ring"><input id="ctrl-guides" type="checkbox" title="Toggle 3D Cartesian axes and reference ring" ${K.showGuides?`checked`:``} /> Grid</label>
          <button id="ctrl-rotate" class="action${K.autoRotate?` active-toggle`:``}" title="Toggle gentle continuous 3D camera turntable rotation">${K.autoRotate?`Pause`:`Rotate`}</button>
        </div>`}
        <div class="ctrl-group">
          <div class="ctrl-row">
            <label title="Apply static electric field E (V/Å) to polarize the electron cloud and measure polarizability α₀ &amp; Stark shift">Stark E=<b id="lbl-stark">${K.starkFieldVPerA.toFixed(1)}</b> V/Å</label>
            <input id="ctrl-stark" type="range" min="-5" max="5" step="0.5" value="${K.starkFieldVPerA}" title="Static electric field E (−5 to +5 V/Å) inducing atomic dipole p = α₀ E" />
          </div>
          <button id="ctrl-ionize" class="action${K.ionizedCation?` active-toggle`:``}" style="width:100%;" title="Remove 1 valence electron and re-solve the GPU Dirac–KS cation to compute ΔSCF ionization energy I₁ and orbital contraction">${K.ionizedCation?`Cation +1 (ΔSCF ON)`:`Ionize −1e⁻ (ΔSCF)`}</button>
        </div>`,document.getElementById(`ctrl-n`)?.addEventListener(`input`,e=>{K.n=Number(e.target.value),K.l=Math.min(K.l,K.n-1),K.m=Math.max(-K.l,Math.min(K.l,K.m)),lo(),Z(),Q()}),document.getElementById(`ctrl-l`)?.addEventListener(`change`,e=>{K.l=Number(e.target.value),K.m=Math.max(-K.l,Math.min(K.l,K.m)),lo(),Z(),Q()}),document.getElementById(`ctrl-m`)?.addEventListener(`change`,e=>{K.m=Number(e.target.value),lo(),Q()}),document.getElementById(`ctrl-valence`)?.addEventListener(`click`,()=>{let e=Na(V);K.n=e.n,K.l=e.l,K.m=e.m,lo(),Z(),Q()}),document.getElementById(`ctrl-rand-nlm`)?.addEventListener(`click`,()=>{let e=1+Math.floor(Math.random()*92),t=2+Math.floor(Math.random()*5),n=Math.floor(Math.random()*t),r=Math.floor(Math.random()*(2*n+1))-n;V=e,Pi=null,er.value=String(e),K.n=t,K.l=n,K.m=r,Bo(e,null,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-xc`)?.addEventListener(`change`,e=>{K.functional=e.target.value,Bo(V,Pi,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-rel`)?.addEventListener(`change`,e=>{K.relativisticSpinOrbit=!!e.target.checked,Bo(V,Pi,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-pts`)?.addEventListener(`change`,e=>{K.pointCount=Number(e.target.value),document.getElementById(`lbl-pts`).textContent=`${Math.round(K.pointCount/1e3)}K`,lo(),Q()}),document.getElementById(`ctrl-psize`)?.addEventListener(`input`,e=>{K.pointSize=Number(e.target.value),Do()}),document.getElementById(`ctrl-opac`)?.addEventListener(`input`,e=>{K.opacity=Number(e.target.value),Do()}),document.getElementById(`ctrl-cmode`)?.addEventListener(`change`,e=>{K.colorMode=Number(e.target.value),lo(),Do()}),document.getElementById(`ctrl-col-a`)?.addEventListener(`input`,e=>{K.shellColorA=e.target.value,Do()}),document.getElementById(`ctrl-col-b`)?.addEventListener(`input`,e=>{K.shellColorB=e.target.value,Do()}),document.getElementById(`ctrl-regen`)?.addEventListener(`click`,()=>{K.cloudSeed+=1,lo(),Do()}),document.getElementById(`ctrl-stark`)?.addEventListener(`input`,e=>{K.starkFieldVPerA=Number(e.target.value),document.getElementById(`lbl-stark`).textContent=K.starkFieldVPerA.toFixed(1),_o(),Q()}),document.getElementById(`ctrl-ionize`)?.addEventListener(`click`,()=>{vo(!K.ionizedCation)})}document.getElementById(`ctrl-guides`)?.addEventListener(`change`,e=>{K.showGuides=!!e.target.checked,Do()}),document.getElementById(`ctrl-rotate`)?.addEventListener(`click`,()=>{K.autoRotate=!K.autoRotate,Z()})}else if(I===`crystal`){let e=L===`element`,t=Ma(),r=Math.max(100,Math.round(Number(t?.curieOrNeelTempK)||400)),i=Math.max(1200,Math.round(r*2.2)),a=Number(t?.superconductingTcK)||0,o=K.crystalViewMode===`tdks-atom`||K.crystalViewMode===`photon-shell`,s=K.crystalViewMode===`spin-llg`,c=K.crystalViewMode===`transport`;Jn.innerHTML=`${n}
      ${o?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <button id="ctrl-ps-rgb" class="action${K.photonModeMono?``:` active-toggle`}" title="Illuminate simultaneously with broadband Red (610nm), Green (535nm) &amp; Blue (440nm) light">White Light (RGB)</button>
          <button id="ctrl-ps-mono" class="action${K.photonModeMono?` active-toggle`:``}" title="Illuminate with a single monochromatic laser wavelength λ">Single λ</button>
        </div>
        <div class="ctrl-row">
          <label title="Monochromatic photon probe wavelength λ (380 nm violet → 780 nm deep red)">λ=<b id="lbl-lambda">${K.probeWavelengthNm}</b>nm</label>
          <input id="ctrl-lambda" type="range" min="380" max="780" step="10" value="${K.probeWavelengthNm}" title="Sweep visible photon wavelength λ across 380–780 nm to probe resonances and dispersion" />
        </div>
      </div>
      ${K.crystalViewMode===`tdks-atom`?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="Select which 3D atomic orbital geometry is projected into the 3D Maxwell susceptibility tensor χ_ij(r)">Orbital</label>
          <select id="ctrl-tdks-orb" title="Switch 3D orbital geometry inside the 3D Maxwell–Kohn–Sham Yee FDTD solver">
            <option value="valence" ${K.tdksOrbitalPreset===`valence`?`selected`:``}>Active Valence</option>
            <option value="d2" ${K.tdksOrbitalPreset===`d2`?`selected`:``}>5d m=2 Cloverleaf</option>
            <option value="d0" ${K.tdksOrbitalPreset===`d0`?`selected`:``}>5d m=0 Axial+Ring</option>
            <option value="p0" ${K.tdksOrbitalPreset===`p0`?`selected`:``}>2p_y Dumbbell</option>
            <option value="s0" ${K.tdksOrbitalPreset===`s0`?`selected`:``}>3s Sphere</option>
            <option value="f0" ${K.tdksOrbitalPreset===`f0`?`selected`:``}>4f Octupole</option>
          </select>
        </div>
        <div class="ctrl-row">
          <label title="Electric-field polarization vector of the incident 3D photon wavepacket">Pol</label>
          <button class="action${K.tdksPolMode===0?` active-toggle`:``}" data-tpol="0" title="Linear E_y polarization (parallel to 2p_y dumbbell axis)">E_y</button>
          <button class="action${K.tdksPolMode===1?` active-toggle`:``}" data-tpol="1" title="Linear E_z polarization (perpendicular to 2p_y dumbbell axis)">E_z</button>
          <button class="action${K.tdksPolMode===2?` active-toggle`:``}" data-tpol="2" title="Left-circularly polarized (LCP) rotating electric field wavepacket">Circ ↻</button>
          <select id="ctrl-tdks-view" title="Choose 3D Maxwell volumetric visualization: full wavefield, pure scattered multipole E_scatt, or equatorial phase cut">
            <option value="0" ${K.tdksFieldView===0?`selected`:``}>3D Volume</option>
            <option value="1" ${K.tdksFieldView===1?`selected`:``}>Scattered E_scatt</option>
            <option value="2" ${K.tdksFieldView===2?`selected`:``}>Vol + Phase Cut</option>
          </select>
        </div>
      </div>`:``}
      <div class="ctrl-group">
        <button id="ctrl-ps-fire" class="action gold-btn" title="Re-launch a fresh Gaussian photon wavepacket from the source plane">Fire Pulse</button>
        <button id="ctrl-ps-play" class="action" title="Play or pause real-time Maxwell FDTD wave propagation">${K.photonPlaying?`Pause`:`Play`}</button>
        ${e?`<label title="Toggle Koelling–Harmon relativistic contraction + spin-orbit (turns Au from Silver into Gold!)"><input id="ctrl-ps-rel" type="checkbox" title="Toggle Koelling–Harmon relativistic contraction + spin-orbit (turns Au from Silver into Gold!)" ${K.relativisticSpinOrbit?`checked`:``} /> Relativistic (Au)</label>`:``}
      </div>`:``}
      ${s?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="Lattice temperature T (K) driving stochastic Langevin thermal spin noise">T=<b id="lbl-spin-t">${Math.round(K.spinTempK)}</b>K${r>0&&t?.curieOrNeelTempK>0?` (T_c=${Math.round(t.curieOrNeelTempK)}K)`:``}</label>
          <input id="ctrl-spin-t" type="range" min="10" max="${i}" step="10" value="${Math.min(i,Math.round(K.spinTempK))}" title="Sweep temperature T across Curie/Néel critical temperature T_c to melt or restore magnetic order" />
        </div>
        <div class="ctrl-row">
          <label title="External applied magnetic field B_z (Tesla) along the vertical axis">B_z=<b id="lbl-spin-b">${K.spinFieldBTesla.toFixed(1)}</b>T</label>
          <input id="ctrl-spin-b" type="range" min="-5" max="5" step="0.2" value="${K.spinFieldBTesla}" title="Apply external magnetic field B_z (−5 to +5 T) to flip ferromagnetic domains" />
        </div>
      </div>
      <div class="ctrl-group">
        <button id="ctrl-spin-sweep" class="action${K.spinSweepB?` active-toggle`:` gold-btn`}" title="Continuously sweep B_z between −4.8 T and +4.8 T to trace a live M(B) hysteresis loop">${K.spinSweepB?`Stop Sweep`:`Sweep B`}</button>
        <button id="ctrl-spin-hot" class="action" title="Heat lattice above Curie/Néel T_c to observe paramagnetic disorder">Heat &gt; T_c</button>
        <button id="ctrl-spin-reset" class="action" title="Randomize initial 3D spin orientations to watch spontaneous domain nucleation">Randomize</button>
      </div>`:``}
      ${K.crystalViewMode===`lattice`?`
      <div class="ctrl-group">
        <label title="Choose atom/ion shading scheme for the 3D crystal cell">Color</label>
        <button id="ctrl-cry-cpk" class="action${K.crystalColorMode===0?` active-toggle`:``}" title="Color each ion/atom by standard CPK chemical element color">CPK Species</button>
        <button id="ctrl-cry-mep" class="action${K.crystalColorMode===1?` active-toggle`:``}" title="Color cations blue (+q) and anions red (−q) by derived formal charge">Formal Charge (±)</button>
      </div>`:``}
      ${c?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="Crystal temperature T (K) controlling phonon scattering, semiconductor carriers &amp; BCS condensation">T=<b id="lbl-tr-t">${K.transportTempK<20?K.transportTempK.toFixed(1):Math.round(K.transportTempK)}</b>K${a>.1?` (T_c=${a.toFixed(1)}K)`:``}</label>
          <input id="ctrl-tr-t" type="range" min="1" max="1200" step="1" value="${Math.min(1200,Math.round(K.transportTempK))}" title="Sweep temperature T from 1 K (cryogenic) to 1200 K" />
        </div>
        <div class="ctrl-row">
          <label title="Applied driving electric field E (kV/m) accelerating charge carriers">E=<b id="lbl-tr-e">${(K.transportEFieldVPerM/1e3).toFixed(0)}</b> kV/m</label>
          <input id="ctrl-tr-e" type="range" min="-20000" max="20000" step="2000" value="${K.transportEFieldVPerM}" title="Adjust applied electric field E (−20 to +20 kV/m) driving electron drift" />
        </div>
      </div>
      <div class="ctrl-group">
        ${a>.1?`<button id="ctrl-tr-cryo" class="action gold-btn" title="Cool below BCS critical temperature T_c to condense electrons into frictionless Cooper pairs">Cryo T&lt;T_c (${Math.max(1,a*.35).toFixed(1)}K)</button>`:``}
        <button class="action" data-tr-t="80" title="Set liquid-nitrogen temperature (80 K)">80K</button>
        <button class="action" data-tr-t="300" title="Set ambient room temperature (300 K)">300K</button>
        <button class="action" data-tr-t="900" title="Set high temperature (900 K) to increase phonon scattering / semiconductor carriers">900K</button>
        <button id="ctrl-tr-play" class="action" title="Play or pause 3D electron transport integration">${K.transportPlaying?`Pause`:`Play`}</button>
      </div>`:``}`,document.getElementById(`ctrl-spin-t`)?.addEventListener(`input`,e=>{K.spinTempK=Number(e.target.value),document.getElementById(`lbl-spin-t`).textContent=String(Math.round(K.spinTempK))}),document.getElementById(`ctrl-spin-b`)?.addEventListener(`input`,e=>{K.spinFieldBTesla=Number(e.target.value),K.spinSweepB=!1,document.getElementById(`lbl-spin-b`).textContent=K.spinFieldBTesla.toFixed(1)}),document.getElementById(`ctrl-spin-sweep`)?.addEventListener(`click`,()=>{K.spinSweepB=!K.spinSweepB,K.spinSweepB&&(na=[]),Z()}),document.getElementById(`ctrl-spin-hot`)?.addEventListener(`click`,()=>{K.spinTempK=Math.min(i,Math.round(Math.max(600,r*1.55))),K.spinFieldBTesla=0,K.spinSweepB=!1,Z()}),document.getElementById(`ctrl-spin-reset`)?.addEventListener(`click`,()=>{ea?.resetDomains({orderedBias:0,initSeed:Math.floor(Math.random()*1e6)+1}),na=[],Q()}),document.getElementById(`ctrl-tr-t`)?.addEventListener(`input`,e=>{K.transportTempK=Number(e.target.value),document.getElementById(`lbl-tr-t`).textContent=String(Math.round(K.transportTempK))}),document.getElementById(`ctrl-tr-e`)?.addEventListener(`input`,e=>{K.transportEFieldVPerM=Number(e.target.value),document.getElementById(`lbl-tr-e`).textContent=(K.transportEFieldVPerM/1e3).toFixed(0)}),document.getElementById(`ctrl-tr-cryo`)?.addEventListener(`click`,()=>{K.transportTempK=Math.max(.5,Number((a*.35).toFixed(1))),Z()});for(let e of Jn.querySelectorAll(`[data-tr-t]`))e.addEventListener(`click`,()=>{K.transportTempK=Number(e.dataset.trT),Z()});document.getElementById(`ctrl-tr-play`)?.addEventListener(`click`,()=>{K.transportPlaying=!K.transportPlaying,Z()}),document.getElementById(`ctrl-ps-rgb`)?.addEventListener(`click`,()=>{K.photonModeMono=!1,H?.resetPulse({nextModeMono:!1}),H?.stepSync(32),Z(),Q()}),document.getElementById(`ctrl-ps-mono`)?.addEventListener(`click`,()=>{K.photonModeMono=!0,H?.resetPulse({nextModeMono:!0,nextProbeWavelengthNm:K.probeWavelengthNm}),H?.stepSync(32),Z(),Q()}),document.getElementById(`ctrl-tdks-orb`)?.addEventListener(`change`,e=>{K.tdksOrbitalPreset=e.target.value||`valence`,uo({resetField:!0}),Z(),Q()});for(let e of Jn.querySelectorAll(`[data-tpol]`))e.addEventListener(`click`,()=>{K.tdksPolMode=Number(e.dataset.tpol)||0,H?.resetPulse({nextPolMode:K.tdksPolMode}),H?.stepSync(34),Z(),Q()});document.getElementById(`ctrl-tdks-view`)?.addEventListener(`change`,e=>{K.tdksFieldView=Number(e.target.value)||0,Do()}),document.getElementById(`ctrl-lambda`)?.addEventListener(`input`,e=>{K.probeWavelengthNm=Number(e.target.value),document.getElementById(`lbl-lambda`).textContent=String(K.probeWavelengthNm),K.photonModeMono=!0,zi?.reset(K.probeWavelengthNm);for(let e=0;e<35;e+=1)zi?.stepFs(.08);H?.resetPulse({nextProbeWavelengthNm:K.probeWavelengthNm,nextModeMono:!0}),H?.stepSync(34),Hi?.reset(null,{nextProbeWavelengthNm:K.probeWavelengthNm}),Hi?.stepSync(100),Z(),Q()}),document.getElementById(`ctrl-ps-fire`)?.addEventListener(`click`,()=>{zi?.reset(K.probeWavelengthNm),H?.resetPulse({nextProbeWavelengthNm:K.probeWavelengthNm,nextPolMode:K.tdksPolMode,nextModeMono:K.photonModeMono}),H?.stepSync(16),Hi?.reset(null,{nextProbeWavelengthNm:K.probeWavelengthNm}),Hi?.stepSync(60),K.photonPlaying=!0,Z(),Q()}),document.getElementById(`ctrl-ps-play`)?.addEventListener(`click`,()=>{K.photonPlaying=!K.photonPlaying,Z()}),document.getElementById(`ctrl-cry-cpk`)?.addEventListener(`click`,()=>{K.crystalColorMode=0,Z(),Q()}),document.getElementById(`ctrl-cry-mep`)?.addEventListener(`click`,()=>{K.crystalColorMode=1,Z(),Q()}),document.getElementById(`ctrl-ps-rel`)?.addEventListener(`change`,e=>{K.relativisticSpinOrbit=!!e.target.checked,Bo(V,Pi,{preserveQuantumNumbers:!0})})}else if(I===`md`){let{tMelt:t,tBoil:r,tSolid:i,tMeltLiquid:a,tVapor:o,tMax:s}=So($i?.meltingPointK||e?.thermodynamic?.meltingPointK||600,$i?.boilingPointK||e?.thermodynamic?.boilingPointK||1500,$i?.potentialModel??1),c=K.mdMode;Jn.innerHTML=`${n}
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="Exact exponential thermostat target temperature T (K) relative to derived melting point T_m and boiling point T_b">T=<b id="lbl-md-t">${K.mdTargetTempK}</b>K <span style="opacity:0.7;">(T_m=${t} · T_b=${r})</span></label>
        </div>
        <div class="ctrl-row">
          <input id="ctrl-md-t" type="range" min="15" max="${s}" step="${s>4e3?25:10}" value="${Math.min(s,K.mdTargetTempK)}" title="Adjust live WebGPU MD thermostat target temperature T (K) from cryogenic solid through liquid melting to boiling vapor" />
        </div>
        ${c===`equilibrium`?`
        <div class="ctrl-row">
          <button id="ctrl-md-ch-drop" class="action${K.mdChamberMode===`drop`?` active-toggle`:``}" title="Open Chamber (Drop &amp; Vapor): free crystal surfaces eliminate periodic superheating so you watch faceted Solid → cohesive Liquid Droplet → chamber-filling Vapor!">Drop &amp; Vapor</button>
          <button id="ctrl-md-ch-bulk" class="action${K.mdChamberMode===`bulk`?` active-toggle`:``}" title="Periodic Bulk (NPT): space-filling crystal with physical thermal vacancies and constant-pressure volume expansion">Bulk NPT</button>
        </div>
        ${K.mdChamberMode===`bulk`?`<label title="Enable adaptive Berendsen NPT constant-pressure barostat to measure live thermal expansion α_V(T) &amp; vaporization volume growth"><input id="ctrl-md-npt" type="checkbox" title="Enable adaptive Berendsen NPT constant-pressure barostat to measure live thermal expansion α_V(T)" ${K.mdNptBarostat?`checked`:``} /> NPT α_V Barostat (P=0)</label>`:``}`:``}
      </div>
      ${c===`strain`?`
      <div class="ctrl-group">
        <button id="ctrl-md-comp" class="action gold-btn" title="Apply −3% uniaxial compressive strain along X and measure virial stress P_xx &amp; Poisson lateral expansion">Compress −3%</button>
        <button id="ctrl-md-stretch" class="action" title="Apply +3% uniaxial tensile strain along X and measure elastic stress response">Stretch +3%</button>
        <button id="ctrl-md-shear" class="action" title="Apply +4% affine XY shear strain γ_xy to measure shear modulus G">Shear γ_xy +4%</button>
        <button id="ctrl-md-reset" class="action" title="Reset crystal lattice and atomic velocities to unstrained equilibrium">Reset</button>
      </div>`:c===`acoustic`?`
      <div class="ctrl-group">
        <button id="ctrl-md-pwave" class="action gold-btn" title="Inject a longitudinal compression pulse along the elongated crystal bar to measure sound speed v_L">Fire P-Wave (v_L)</button>
        <button id="ctrl-md-swave" class="action" title="Inject a transverse shear pulse along the elongated crystal bar to measure shear wave speed v_T">Fire S-Wave (v_T)</button>
        <button id="ctrl-md-reset" class="action" title="Reset the elongated crystal bar to rest">Reset Bar</button>
      </div>`:`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <button class="action${K.mdPhasePreset===`solid`?` active-toggle`:``}" data-md-phase="solid" title="Cool to crystalline solid (${i} K = 0.30 × T_m) with sharp Bragg g(r) peaks and high coordination">Solid</button>
          <button class="action${K.mdPhasePreset===`melt`?` active-toggle`:` gold-btn`}" data-md-phase="melt" title="Heat above melting point (${a} K) to melt the crystal into a diffusing cohesive liquid">Melt</button>
          <button class="action${K.mdPhasePreset===`vapor`?` active-toggle`:` danger-btn`}" data-md-phase="vapor" title="Heat above boiling point (${o} K) to overcome cohesive energy and boil atoms into free vapor gas">Vapor</button>
        </div>
        <div class="ctrl-row">
          <button id="ctrl-md-play" class="action" title="Play or pause real-time GPU Velocity-Verlet molecular dynamics">${K.mdPlaying?`Pause`:`Play`}</button>
          <button id="ctrl-md-reset" class="action" title="Rebuild a pristine crystal lattice at the current target temperature">Reset Crystal</button>
        </div>
      </div>`}
      <div class="ctrl-group">
        <div class="ctrl-row">
          <button id="ctrl-md-grav" class="action${K.mdGravity?` active-toggle`:``}" title="Toggle live GPU downward gravity (−m g ŷ, Bond-scaled MD acceleration) with physical harmonic floor &amp; ceiling walls so crystals land, melted droplets pool into sessile puddles, and vapor forms a barometric atmosphere!">Gravity ↓ ${K.mdGravity?`ON`:`OFF`}</button>
        </div>
        <div class="ctrl-row">
          <label title="Choose physical GPU quantity driving per-atom 3D coloring">Color</label>
          <button class="action${K.mdColorMode===0?` active-toggle`:``}" data-md-col="0" title="Color each atom by its true local kinetic temperature T_i = m v² / (3 k_B) relative to T_m">Temp</button>
          <button class="action${K.mdColorMode===1?` active-toggle`:``}" data-md-col="1" title="Color by live GPU first-shell coordination z_i: sapphire Solid, emerald-gold Liquid, magenta Vapor">Phase</button>
          <button class="action${K.mdColorMode===2?` active-toggle`:``}" data-md-col="2" title="Color by live GPU per-atom potential energy E_pot,i to highlight surfaces, vacancies &amp; strain">Stress</button>
        </div>
        <div class="ctrl-row">
          <label title="Supercell particle count powered by ULG's lock-free O(N) WebGPU linked-cell spatial grid (scales up to 100,000+ atoms!)">Atoms</label>
          <button class="action${K.mdSizePreset===`medium`||K.mdSizePreset===`small`?` active-toggle`:``}" data-md-size="${ui?`small`:`medium`}" title="Fast interactive supercell (~${ui?`200`:`500`} atoms, instant melting &amp; boiling)">${ui?`200`:`500`}</button>
          <button class="action${K.mdSizePreset===`2k`||K.mdSizePreset===`large`?` active-toggle`:``}" data-md-size="2k" title="2,000-atom nanoscale crystal supercell on O(N) WebGPU linked cells">2K</button>
          <button class="action${K.mdSizePreset===`10k`?` active-toggle`:``}" data-md-size="10k" title="10,000-atom mesoscale crystal/droplet on O(N) WebGPU linked cells">10K</button>
          ${ui?``:`<button class="action${K.mdSizePreset===`50k`?` active-toggle`:``}" data-md-size="50k" title="50,000-atom high-resolution WebGPU MD simulation">50K</button>
          <button class="action${K.mdSizePreset===`100k`?` active-toggle`:``}" data-md-size="100k" title="100,000-atom extreme-scale WebGPU MD crystal, liquid droplet &amp; vapor cloud!">100K</button>`}
        </div>
      </div>`,document.getElementById(`ctrl-md-t`)?.addEventListener(`input`,e=>{K.mdTargetTempK=Number(e.target.value),K.mdPhasePreset=null,document.getElementById(`lbl-md-t`).textContent=String(K.mdTargetTempK)}),document.getElementById(`ctrl-md-ch-drop`)?.addEventListener(`click`,()=>{K.mdChamberMode=`drop`,Co(K.mdTargetTempK,K.mdMode),Z(),Q()}),document.getElementById(`ctrl-md-ch-bulk`)?.addEventListener(`click`,()=>{K.mdChamberMode=`bulk`,K.mdNptBarostat=!0,Co(K.mdTargetTempK,K.mdMode),Z(),Q()}),document.getElementById(`ctrl-md-npt`)?.addEventListener(`change`,e=>{K.mdNptBarostat=!!e.target.checked}),document.getElementById(`ctrl-md-grav`)?.addEventListener(`click`,()=>{K.mdGravity=!K.mdGravity,U?.setGravity?.(K.mdGravity),Z(),Q(),$()}),document.getElementById(`ctrl-md-comp`)?.addEventListener(`click`,()=>{U?.applyStrain({strainX:-.03})}),document.getElementById(`ctrl-md-stretch`)?.addEventListener(`click`,()=>{U?.applyStrain({strainX:.03})}),document.getElementById(`ctrl-md-shear`)?.addEventListener(`click`,()=>{U?.applyStrain({shearXY:.04})}),document.getElementById(`ctrl-md-pwave`)?.addEventListener(`click`,()=>{U?.injectAcousticPulse({polarization:`longitudinal`,amplitude:.4})}),document.getElementById(`ctrl-md-swave`)?.addEventListener(`click`,()=>{U?.injectAcousticPulse({polarization:`transverse`,amplitude:.4})});for(let e of Jn.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,()=>{let t=e.dataset.mdPhase,n=t===`solid`?i:t===`melt`?a:o;K.mdPhasePreset=t,K.mdTargetTempK=Math.max(15,Math.min(s,n)),K.mdPlaying=!0,K.mdChamberMode===`bulk`&&(K.mdNptBarostat=!0),U?.resetMsdOrigin?.(),Yi=[],Xi=[],Z(),Q()});for(let e of Jn.querySelectorAll(`[data-md-col]`))e.addEventListener(`click`,()=>{K.mdColorMode=Number(e.dataset.mdCol)||0,Z(),Do()});for(let e of Jn.querySelectorAll(`[data-md-size]`))e.addEventListener(`click`,()=>{K.mdSizePreset=e.dataset.mdSize||`medium`,Co(K.mdTargetTempK,K.mdMode),Z(),Q()});document.getElementById(`ctrl-md-play`)?.addEventListener(`click`,()=>{K.mdPlaying=!K.mdPlaying,Z()}),document.getElementById(`ctrl-md-reset`)?.addEventListener(`click`,()=>{Co(K.mdTargetTempK,K.mdMode),Z(),Q()})}else if(I===`compound`){let e=K.chemViewMode,t=z?.bundle?.materialKey||cr.value||`H2O`,r=W||Mi,i=r?.energiesEv?.length||0,a=!!z?.visualData?.molQm?.atoms?.some(e=>e.Z===1);Jn.innerHTML=`${n}
      ${e===`molecule`||e===`reaction-path`?`
      <div class="ctrl-group">
        <button id="ctrl-mol-cpk" class="action${K.molColorMode===0?` active-toggle`:``}" title="Color atoms using standard CPK chemical element colors">CPK</button>
        <button id="ctrl-mol-mep" class="action${K.molColorMode===1?` active-toggle`:``}" title="Color atoms by GPU Mulliken Electrostatic Potential (δ⁻ red nucleophilic ↔ δ⁺ blue electrophilic)">MEP (±q)</button>
        <label title="Toggle 3D molecular electric dipole moment arrow μ (Debye)"><input id="ctrl-mol-dip" type="checkbox" title="Toggle 3D molecular electric dipole moment arrow μ (Debye)" ${K.molShowDipole?`checked`:``} /> Dipole μ</label>
        <label title="Overlay 3D GPU RHF molecular orbital point cloud (Total ρ / HOMO / LUMO)"><input id="ctrl-mol-orb" type="checkbox" title="Overlay 3D GPU RHF molecular orbital point cloud (Total ρ / HOMO / LUMO)" ${K.molShowOrbitalOverlay?`checked`:``} /> Orbital</label>
      </div>`:``}
      ${e===`reaction-path`&&i>=2?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="CI-NEB reaction progress coordinate ξ from Reactants (0) through Transition State (‡) to Products (1)">ξ=<b id="lbl-neb-xi">${(K.nebImageIdx/Math.max(1,i-1)).toFixed(2)}</b> (#${K.nebImageIdx}/${i-1}${K.nebImageIdx===r.saddleImageIndex?` ‡ TS`:``})</label>
          <input id="ctrl-neb-xi" type="range" min="0" max="${i-1}" step="1" value="${Math.min(K.nebImageIdx,i-1)}" title="Scrub along the GPU CI-NEB reaction pathway to watch bonds break and form" />
        </div>
        <div class="ctrl-row">
          <button id="ctrl-neb-play" class="action" title="Animate continuously along the GPU CI-NEB reaction pathway">${K.nebPlaying?`Pause`:`Play Path`}</button>
          <button id="ctrl-neb-ts" class="action gold-btn" title="Jump directly to the highest-energy Transition State saddle image (TS‡)">Jump TS‡</button>
        </div>
      </div>`:``}
      ${(e===`molecule`||e===`reaction-path`)&&K.molShowOrbitalOverlay?`
      <div class="ctrl-group">
        <button class="action${K.molOrbitalMode===0?` active-toggle`:``}" data-c-mol="0" title="Display total molecular electron density ρ(r)">Total ρ</button>
        <button class="action${K.molOrbitalMode===1?` active-toggle`:``}" data-c-mol="1" title="Display Highest Occupied Molecular Orbital (HOMO)">HOMO</button>
        <button class="action${K.molOrbitalMode===2?` active-toggle`:``}" data-c-mol="2" title="Display Lowest Unoccupied Molecular Orbital (LUMO)">LUMO</button>
      </div>`:``}
      ${e===`vibrations`?`
      <div class="ctrl-group">
        <button id="ctrl-vib-run" class="action gold-btn" style="width:100%;" title="Relax geometry and compute Eckart-projected GPU Hessian vibrational normal modes &amp; IR/Raman spectra">Solve GPU Opt + Hessian</button>
        ${ma?.modes?.length?`
        <div class="ctrl-row">
          <select id="ctrl-vib-mode" title="Select which harmonic vibrational normal mode to animate in 3D">${ma.modes.map((e,t)=>`<option value="${t}" ${t===K.vibModeIdx?`selected`:``}>Mode ${t+1}: ${Math.round(e.freqCm1)} cm⁻¹ (${e.label})</option>`).join(``)}</select>
          <button id="ctrl-vib-play" class="action" title="Play or pause 3D normal-mode vibrational oscillation">${K.vibPlaying?`Pause`:`Animate`}</button>
        </div>`:``}
        ${a?`<label title="Substitute Hydrogen (1.008 u) with Deuterium (2.014 u) to observe the ~1/√2 vibrational frequency &amp; ZPE redshift"><input id="ctrl-vib-deut" type="checkbox" title="Substitute Hydrogen (1.008 u) with Deuterium (2.014 u) to observe the ~1/√2 vibrational frequency &amp; ZPE redshift" ${K.vibIsotopeDeuterated?`checked`:``} /> H→D Isotope Shift</label>`:``}
      </div>`:``}
      ${e===`reactive-md`?`
      <div class="ctrl-group">
        <div class="ctrl-row">
          <button id="ctrl-rx-spark" class="action danger-btn" title="Inject a localized thermal ignition spark to overcome activation barrier E_a and ignite exothermic conversion">⚡ Ignition Spark</button>
          <button id="ctrl-rx-cat" class="action${K.rxMdCatalyst?` active-toggle`:``}" title="Lower activation barrier E_a by 48% to simulate surface/homogeneous catalysis">Catalyst (−48% E_a)</button>
        </div>
        <div class="ctrl-row">
          <label title="Initial / thermostat bath temperature T₀ (K) for the 3D reactive collision chamber">T₀=<b id="lbl-rx-t">${K.rxMdTempK}</b>K</label>
          <input id="ctrl-rx-t" type="range" min="150" max="1800" step="25" value="${K.rxMdTempK}" title="Adjust chamber temperature T₀ (150–1800 K)" />
        </div>
        <div class="ctrl-row">
          <label title="Toggle isothermal heat bath (OFF = adiabatic chamber showing real exothermic heating!)"><input id="ctrl-rx-therm" type="checkbox" title="Toggle isothermal heat bath (OFF = adiabatic chamber showing real exothermic heating!)" ${K.rxMdThermostat?`checked`:``} /> Bath</label>
          <button id="ctrl-rx-play" class="action" title="Play or pause 3D GPU reactive collision kinetics">${K.rxMdPlaying?`Pause`:`Play`}</button>
          <button id="ctrl-rx-reset" class="action" title="Reset chamber back to 100% unreacted A + B stoichiometric mixture">Reset</button>
        </div>
      </div>`:``}
      ${z&&e===`molecule`?`<div class="ctrl-group">
        <button id="ctrl-backfeed-now" class="action gold-btn" style="width:100%;" title="Promote ${t} as the active specimen across ALL 6 labs (Nuclear, Orbital, Crystal/Optics, MD &amp; 3D Polytope)">Backfeed ${t} → All Tabs</button>
      </div>`:``}`,document.getElementById(`ctrl-mol-cpk`)?.addEventListener(`click`,()=>{K.molColorMode=0,Z(),Q()}),document.getElementById(`ctrl-mol-mep`)?.addEventListener(`click`,()=>{K.molColorMode=1,Z(),Q()}),document.getElementById(`ctrl-mol-dip`)?.addEventListener(`change`,e=>{K.molShowDipole=!!e.target.checked,Do()}),document.getElementById(`ctrl-mol-orb`)?.addEventListener(`change`,e=>{K.molShowOrbitalOverlay=!!e.target.checked,Z(),Do()}),document.getElementById(`ctrl-neb-xi`)?.addEventListener(`input`,e=>{K.nebImageIdx=Number(e.target.value),K.nebPlaying=!1,Z(),Q()}),document.getElementById(`ctrl-neb-play`)?.addEventListener(`click`,()=>{K.nebPlaying=!K.nebPlaying,Z()}),document.getElementById(`ctrl-neb-ts`)?.addEventListener(`click`,()=>{r&&(K.nebImageIdx=r.saddleImageIndex??0,K.nebPlaying=!1,Z(),Q())});for(let e of Jn.querySelectorAll(`[data-c-mol]`))e.addEventListener(`click`,()=>{K.molOrbitalMode=Number(e.dataset.cMol),lo(),Vo(),Z(),Q()});document.getElementById(`ctrl-vib-run`)?.addEventListener(`click`,()=>Eo()),document.getElementById(`ctrl-vib-mode`)?.addEventListener(`change`,e=>{K.vibModeIdx=Number(e.target.value),Q()}),document.getElementById(`ctrl-vib-play`)?.addEventListener(`click`,()=>{K.vibPlaying=!K.vibPlaying,Z()}),document.getElementById(`ctrl-vib-deut`)?.addEventListener(`change`,e=>{Eo({deuterated:!!e.target.checked})}),document.getElementById(`ctrl-rx-spark`)?.addEventListener(`click`,()=>{G||wo(),G?.igniteSpark(2.85),K.rxMdPlaying=!0,Z()}),document.getElementById(`ctrl-rx-cat`)?.addEventListener(`click`,()=>{K.rxMdCatalyst=!K.rxMdCatalyst,Z()}),document.getElementById(`ctrl-rx-therm`)?.addEventListener(`change`,e=>{K.rxMdThermostat=!!e.target.checked}),document.getElementById(`ctrl-rx-t`)?.addEventListener(`input`,e=>{K.rxMdTempK=Number(e.target.value),document.getElementById(`lbl-rx-t`).textContent=String(K.rxMdTempK)}),document.getElementById(`ctrl-rx-play`)?.addEventListener(`click`,()=>{K.rxMdPlaying=!K.rxMdPlaying,Z()}),document.getElementById(`ctrl-rx-reset`)?.addEventListener(`click`,()=>{wo(),Z(),Q()}),document.getElementById(`ctrl-backfeed-now`)?.addEventListener(`click`,()=>{Wo(z,`crystal`)})}else if(I===`polytope`){let e=K.polytopeViewMode,t=B&&F?F.getPolytopeAxisBounds(B):{minLt:1,maxLt:4.2,minLp:2,maxLp:10},r=K.polytopeProbe?Math.log10(Math.max(1,K.polytopeProbe.temperatureK)):Math.log10(300),i=K.polytopeProbe?Math.log10(Math.max(1e-6,K.polytopeProbe.pressurePa)):Math.log10(101325);Jn.innerHTML=`${n}
      <div class="ctrl-group">
        <button id="ctrl-poly-lab" class="action${K.polytopeRegime===`lab`?` active-toggle`:``}" title="Fit Convex Polytope Atlas over laboratory pressures up to 10 GPa">Lab 10 GPa</button>
        <button id="ctrl-poly-plan" class="action${K.polytopeRegime===`planetary`?` active-toggle`:``}" title="Fit Convex Polytope Atlas up to planetary interior pressures (1 TPa = 10¹² Pa)">Planetary 1 TPa</button>
        ${e===`3d-surface`?`<label title="Toggle convex half-space polytope cell boundary lines on the 3D phase surface"><input id="ctrl-poly-facets" type="checkbox" title="Toggle convex half-space polytope cell boundary lines on the 3D phase surface" ${K.polytopeShowFacets?`checked`:``} /> Facets</label>`:``}
      </div>
      <div class="ctrl-group">
        <div class="ctrl-row">
          <label title="Probe temperature log₁₀(T / K) evaluated live on WebGPU">log₁₀T=<b id="lbl-p-lt">${r.toFixed(2)}</b></label>
          <input id="ctrl-p-lt" type="range" min="${t.minLt.toFixed(2)}" max="${t.maxLt.toFixed(2)}" step="0.03" value="${Math.max(t.minLt,Math.min(t.maxLt,r)).toFixed(2)}" title="Move the 3D GPU probe pin along the temperature axis log₁₀(T)" />
        </div>
        <div class="ctrl-row">
          <label title="Probe pressure log₁₀(P / Pa) evaluated live on WebGPU">log₁₀P=<b id="lbl-p-lp">${i.toFixed(1)}</b></label>
          <input id="ctrl-p-lp" type="range" min="${t.minLp.toFixed(2)}" max="${t.maxLp.toFixed(2)}" step="0.1" value="${Math.max(t.minLp,Math.min(t.maxLp,i)).toFixed(2)}" title="Move the 3D GPU probe pin along the pressure axis log₁₀(P)" />
        </div>
        <div class="ctrl-row">
          <button id="ctrl-p-amb" class="action" title="Evaluate the GPU Polytope Atlas at ambient Earth surface conditions (300 K, 1 atm)">300K / 1atm</button>
          <button id="ctrl-p-oos" class="action danger-btn" title="Query extreme out-of-domain state (1 K, 100 TPa) to verify strict fail-closed rejection (no silent extrapolation)">Fail-Closed Test</button>
        </div>
      </div>`,document.getElementById(`ctrl-poly-lab`)?.addEventListener(`click`,()=>zo(`lab`)),document.getElementById(`ctrl-poly-plan`)?.addEventListener(`click`,()=>zo(`planetary`)),document.getElementById(`ctrl-poly-facets`)?.addEventListener(`change`,e=>{K.polytopeShowFacets=!!e.target.checked,Do()});let a=async()=>{let e=Number(document.getElementById(`ctrl-p-lt`)?.value??2.48),t=Number(document.getElementById(`ctrl-p-lp`)?.value??5),n=document.getElementById(`lbl-p-lt`),r=document.getElementById(`lbl-p-lp`);n&&(n.textContent=e.toFixed(2)),r&&(r.textContent=t.toFixed(1)),await window.__ulgElementsLabApi?.probePolytope?.(10**e,10**t)};document.getElementById(`ctrl-p-lt`)?.addEventListener(`input`,a),document.getElementById(`ctrl-p-lp`)?.addEventListener(`input`,a),document.getElementById(`ctrl-p-amb`)?.addEventListener(`click`,()=>window.__ulgElementsLabApi?.probePolytope?.(300,101325)),document.getElementById(`ctrl-p-oos`)?.addEventListener(`click`,()=>window.__ulgElementsLabApi?.probePolytope?.(1,0x5af3107a4000))}document.getElementById(`ctrl-about-sim`)?.addEventListener(`click`,()=>vi(`sim`)),Za()}function Do(){if(F)if(I===`nuclear`){if(L===`compound`&&Ti)F.renderVolume3D({gpuVec4Buffer:Ti.buffer,dim:Ti.dim,channels:4,yaw:q,pitch:J,tint:[1,.58,.3]});else if(K.nuclearViewMode===`fission`&&ca)F.renderVolume3D({gpuVec4Buffer:ca.buffer,dim:ca.dim,channels:4,yaw:q,pitch:J,tint:[1,.62,.34]});else if(R?.visualData?.nuclear){let e=R.visualData.nuclear;F.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:q,pitch:J,tint:[1,.62,.34]})}}else if(I===`atomic`)if(L===`compound`&&z?.visualData?.molQm)if(K.atomicViewMode===`cloud`&&Li)F.renderOrbitalPointCloud({pointsBuffer:Li.pointsBuffer,pointCount:Li.pointCount,yaw:q,pitch:J,camDist:xa,pointSize:K.pointSize*1.15,opacity:Math.min(.65,K.opacity*1.4),alternateShellColors:!0,colorA:[1,.65,.32],colorB:[.36,.72,1],showGuides:K.showGuides,showNucleus:!1});else{let e=z.visualData.molQm;F.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:q,pitch:J,tint:[.75,.52,.99]})}else L===`compound`&&Ei?F.renderStaticCrystalLattice({...Ei,yaw:q,pitch:J,tint:z?.bundle?.electromagnetic?.opticalSrgb||[.75,.82,.95]}):K.atomicViewMode===`cloud`&&Ii?F.renderOrbitalPointCloud({pointsBuffer:Ii.pointsBuffer,pointCount:Ii.pointCount,yaw:q,pitch:J,camDist:xa,pointSize:K.pointSize,opacity:K.opacity,alternateShellColors:K.alternateShellColors,colorA:Oa(K.shellColorA),colorB:Oa(K.shellColorB),showGuides:K.showGuides,showNucleus:!0,starkMixLambda:fa?.starkMixLambda??0,eFieldNorm:(K.starkFieldVPerA||0)/5}):wi&&F.renderVolume3D({gpuVec4Buffer:wi.buffer,dim:wi.dim,channels:4,yaw:q,pitch:J,tint:[.34,.76,1]});else if(I===`crystal`){let e=Ma();if(K.crystalViewMode===`tdks-atom`&&Ri&&zi){let t=Ui?.emergentReflectedSrgb,n=Array.isArray(t)&&t[0]+t[1]+t[2]>.15;F.renderTdksPhotonCloudScene({pairCloud:Ri,blochSession:zi,tdks3dSession:H,yaw:q,pitch:J,camDist:Math.max(1.9,Math.min(4.8,xa-.15)),modeMono:K.photonModeMono,polMode:K.tdksPolMode,fieldViewMode:K.tdksFieldView,probeRgb:ka(K.probeWavelengthNm),emergentReflSrgb:n?t:e?.opticalSrgb||[.94,.86,.65],pointSize:K.pointSize})}else if(K.crystalViewMode===`photon-shell`&&Hi){let t=fo(),n=ui?700:1800;F.renderPhotonShellScene({photonSession:Hi,shellPointsBuffer:t?.pointsBuffer??null,shellPointCount:Math.min(n,t?.pointCount||n),yaw:(q-.42)*.45,pitch:Math.max(.25,Math.min(1.48,1.08+(J-.28)*.6)),camDist:Math.max(2.2,Math.min(4.6,xa+.3)),modeMono:K.photonModeMono,probeRgb:ka(K.probeWavelengthNm),slabTint:e?.opticalSrgb||[.82,.86,.94],waveGain:1.05})}else if(K.crystalViewMode===`spin-llg`&&ea)F.renderSpinLatticeScene({spinsBuffer:ea.getActiveSpinsBuffer(),dims:ea.dims,yaw:q,pitch:J,camDist:Math.max(2.1,Math.min(5,xa+.25)),fieldBZTesla:K.spinFieldBTesla,isAntiferro:ea.params.magneticPhase===`antiferromagnetic`});else if(K.crystalViewMode===`transport`&&ia){let e=ia.getParams();F.renderElectronTransportScene({posBuffer:ia.posBuffer,velBuffer:ia.velBuffer,carrierCount:ia.carrierCount,yaw:q,pitch:J,camDist:xa,eFieldVPerM:K.transportEFieldVPerM,phononVibAmp:e.phononVibAmp,timeS:performance.now()*.001,isSuperconducting:e.isSuperconducting})}else if(K.crystalViewMode===`bloch`&&L===`element`&&R?.visualData?.bulk){let t=R.visualData.bulk;F.renderVolume3D({scalarData:t.blochDensity3d,dim:t.blochDensityGridN,channels:1,yaw:q,pitch:J,tint:e?.opticalSrgb||[.34,.88,.65],showFermiIso:t.isMetal})}else if(K.crystalViewMode===`lattice`){let t=L===`compound`?z?.visualData?.multiSpeciesCrystal:ha;t?F.renderMultiSpeciesCrystalScene({crystal:t,colorMode:K.crystalColorMode,yaw:q,pitch:J,camDist:Math.max(2,Math.min(5.2,xa+.35))}):U&&F.renderLiveMd({positionsBuffer:U.positionsBuffer,velocitiesBuffer:U.velocitiesBuffer,atomCount:U.atomCount,boxLengthsA:U.boxLengthsA,yaw:q,pitch:J,tint:e?.opticalSrgb||[.65,.82,.96],velocityColorScale:16})}else U&&F.renderLiveMd({positionsBuffer:U.positionsBuffer,velocitiesBuffer:U.velocitiesBuffer,atomCount:U.atomCount,boxLengthsA:U.boxLengthsA,yaw:q,pitch:J,tint:e?.opticalSrgb||[.65,.82,.96],velocityColorScale:16})}else if(I===`md`&&U){let e=Ma();F.renderLiveMd({positionsBuffer:U.positionsBuffer,velocitiesBuffer:U.velocitiesBuffer,forcesBuffer:U.forcesBuffer,atomCount:U.atomCount,boxLengthsA:U.boxLengthsA,initBoxLengthsA:U.initBoxLengthsA,rNearestNeighborA:$i?.rNearestNeighborA??U.rNearestNeighborA,meltingPointK:$i?.meltingPointK??600,cohesiveEnergyEv:$i?.cohesiveEnergyEv??1.5,colorMode:K.mdColorMode,gravityEnabled:K.mdGravity,yaw:q,pitch:J,camDist:Math.max(1.85,Math.min(6.2,xa+.35)),tint:e?.opticalSrgb||[.65,.8,.96]})}else if(I===`compound`){let e=K.chemViewMode,t=performance.now()*.001;if(e===`reactive-md`&&G)F.renderReactiveMdScene({posBuffer:G.getActivePosBuffer(),velBuffer:G.getActiveVelBuffer(),moleculeCount:G.moleculeCount,yaw:q,pitch:J,camDist:Math.max(2.1,Math.min(5.2,xa+.3))});else if(e===`vibrations`&&ma?.atoms?.length){let e=ma.modes?.[K.vibModeIdx]||null;F.renderMoleculeScene({atoms:ma.atoms,bonds:ma.bonds||[],mullikenCharges:pa?.rhfResult?.mullikenCharges||z?.visualData?.molQm?.mullikenCharges||null,dipoleVecDebye:pa?.rhfResult?.dipoleVecDebye||null,displacements:e?.displacements||null,vibPhase:ya,vibAmplitude:.32,colorMode:K.molColorMode,showDipole:K.molShowDipole,orbitalCloud:null,yaw:q,pitch:J,camDist:Math.max(2,Math.min(5,xa+.25)),timeS:t})}else if(e===`reaction-path`&&(W?.images?.length||Mi?.images?.length)){let e=W?.images||Mi?.images,n=Math.max(0,Math.min(e.length-1,K.nebImageIdx)),r=e[n],i=K.molShowOrbitalOverlay&&Ni[n]||null;F.renderMoleculeScene({atoms:r.atoms||r,bonds:r.bonds||[],mullikenCharges:r.mullikenCharges||null,dipoleVecDebye:r.dipoleVecDebye||null,colorMode:K.molColorMode,showDipole:K.molShowDipole,orbitalCloud:i,yaw:q,pitch:J,camDist:Math.max(2,Math.min(5.2,xa+.3)),timeS:t})}else if(z?.visualData?.molQm?.atoms?.length){let e=z.visualData.molQm;F.renderMoleculeScene({atoms:e.atoms,bonds:e.bonds||[],mullikenCharges:e.mullikenCharges||null,dipoleVecDebye:e.dipoleVecDebye||null,colorMode:K.molColorMode,showDipole:K.molShowDipole,orbitalCloud:K.molShowOrbitalOverlay?Li:null,yaw:q,pitch:J,camDist:Math.max(2,Math.min(5,xa+.25)),timeS:t})}else z?.visualData?.multiSpeciesCrystal?F.renderMultiSpeciesCrystalScene({crystal:z.visualData.multiSpeciesCrystal,colorMode:K.molColorMode,yaw:q,pitch:J,camDist:Math.max(2.1,Math.min(5.2,xa+.35))}):Ei&&F.renderStaticCrystalLattice({...Ei,yaw:q,pitch:J,tint:z?.bundle?.electromagnetic?.opticalSrgb||[.75,.82,.95]})}else I===`polytope`&&B&&F.renderPolytopeAtlas3D({atlas:B,viewMode:K.polytopeViewMode,probe:K.polytopeProbe,mdTempK:Ji?.temperatureK??K.mdTargetTempK??null,yaw:q+.22,pitch:Math.max(.16,Math.min(1.32,J+.3)),camDist:Math.max(2.1,Math.min(5.4,xa+.35)),showFacetEdges:K.polytopeShowFacets})}function Oo(e=I){return e===`nuclear`?K.nuclearViewMode:e===`atomic`?K.atomicViewMode:e===`crystal`?K.crystalViewMode:e===`md`?K.mdMode:e===`compound`?K.chemViewMode:e===`polytope`?K.polytopeViewMode:null}function ko(){let e=!!(Oi&&L===`compound`&&I===`compound`&&(K.chemViewMode===`reaction-path`||K.chemViewMode===`reactive-md`)),t=e?`reaction`:L===`compound`?`compound`:`element`,n=I===`md`?K.mdTargetTempK:I===`crystal`&&K.crystalViewMode===`spin-llg`?K.spinTempK:I===`crystal`&&K.crystalViewMode===`transport`?K.transportTempK:I===`compound`&&K.chemViewMode===`reactive-md`?K.rxMdTempK:null;return{specimenKind:t,Z:V,A:Pi??R?.bundle?.nuclear?.A??null,formula:z?.bundle?.materialKey||cr?.value||null,reactants:e?Oi:null,tab:I,view:Oo(I),n:K.n,l:K.l,m:K.m,functional:K.functional,relativisticSpinOrbit:K.relativisticSpinOrbit,tdksOrbitalPreset:K.tdksOrbitalPreset,tdksPolMode:K.tdksPolMode,tdksFieldView:K.tdksFieldView,photonModeMono:K.photonModeMono,probeWavelengthNm:K.probeWavelengthNm,fissionBeta2:K.fissionBeta2,tempK:n,molColorMode:K.molColorMode,molShowOrbitalOverlay:K.molShowOrbitalOverlay,vibDeuterated:K.vibIsotopeDeuterated,polytopeRegime:K.polytopeRegime,simSpeed:K.simSpeed,mdGravity:K.mdGravity,camera:{yaw:q,pitch:J,dist:xa}}}function Ao({includeCamera:e=!0}={}){let t=Ot(ko(),{includeCamera:e});return typeof window>`u`?t:`${window.location.origin}${window.location.pathname}${t}`}function jo({force:e=!1}={}){if(ki||typeof window>`u`||!window.history?.replaceState)return;let t=ko(),n=Ot(t,{includeCamera:!1});if(!(!e&&n===Ai)){Ai=n;try{window.history.replaceState(null,``,`${window.location.pathname}${n}`),document.title=kt(t)}catch{}}}function Q(){if(F){if(Do(),jo(),Ra(``),I===`nuclear`){if(L===`compound`&&z){let e=z.bundle,t=e.nuclear.isotopologueSites||[];La(`WebGPU 3D Composite Nuclear Fermi Volume — ${e.materialKey} (Backfed Compound)`,`Total Z=${e.nuclear.totalProtonsZ} · A=${e.nuclear.totalNucleonsA} · Molar Mass=${Y(e.nuclear.molarMassU,3)} u · ΣB=${Y(e.nuclear.totalBindingEnergyMeV,1)} MeV`),R?.visualData?.nuclear&&(pr.textContent=`GPU 118×200 Chart of Nuclides (Click Any Isotope)`,ro(Zn,R.visualData.nuclear)),mr.textContent=`Constituent Nuclei Binding Energy B/A (${e.materialKey})`;let n=t.map((e,t)=>t),r=t.map(e=>p(e.Z,e.A).bindingPerNucleonMeV);X(Qn,n.length>=2?n:[0,1],r.length>=2?r:[r[0]||0,r[0]||0],{label:`Constituent sites: ${t.map(e=>`${_(e.Z)}-${e.A}`).join(`, `)}`,color:`#facc15`,yMin:0}),hr.textContent=`Constituent Nuclear Charge Radii R_rms (fm)`;let i=t.map(e=>p(e.Z,e.A).chargeRadiusFm);X($n,n.length>=2?n:[0,1],i.length>=2?i:[i[0]||0,i[0]||0],{label:`Fermi charge radius R_rms (fm) per atomic site`,color:`#ff9c54`,yMin:0})}else if(R?.visualData?.nuclear){let e=R.visualData.nuclear;if(K.nuclearViewMode===`fission`&&la){let t=la,n=K.fissionBeta2>=t.scissionBeta?`SCISSION (2 FRAGMENTS)`:K.fissionBeta2>=t.saddleBeta*.85?`NEAR SADDLE BARRIER`:`ELONGATING`;La(`WebGPU 3D Bohr–Wheeler Nuclear Fission — ${e.isotope} (β₂=${K.fissionBeta2.toFixed(2)} · ${n})`,`Fissility x=${Y(t.fissility,3)} · Barrier E_f=${Y(t.barrierMeV,2)} MeV (β*=${Y(t.saddleBeta,2)}) · E_surf0=${Y(t.eSurf0MeV,1)} MeV · E_coul0=${Y(t.eCoul0MeV,1)} MeV`),Ra(`<div class="live-meter">Live 3D Liquid-Drop Fission: β₂=${K.fissionBeta2.toFixed(2)} · Saddle β*=${Y(t.saddleBeta,2)} · E_f=${Y(t.barrierMeV,2)} MeV · ${n}</div>`),pr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ro(Zn,e),mr.textContent=`Bohr–Wheeler Deformation Barrier ΔE(β₂) — ${e.isotope}`,X(Qn,Array.from(t.betas),Array.from(t.deltaEMeV),{label:`ΔE(β₂) MeV · Barrier E_f=${Y(t.barrierMeV,1)} MeV`,color:`#fb923c`,hLine:{y:0,color:`#64748b`,label:`0 MeV`},vLine:{x:K.fissionBeta2,color:`#38bdf8`,label:`β=${K.fissionBeta2.toFixed(2)}`}})}else if(K.nuclearViewMode===`bateman`)if(La(`Exact Nucleon-Conserving Bateman Decay Kinetics — ${e.isotope}`,ji?.steps?.length?`Chain: ${ji.steps.slice(0,4).map(e=>`${e.isotope}→${e.daughterIsotope}(${e.mode})`).join(` → `)} · Total Q=${Y(ji.totalEnergyMeV,2)} MeV`:`${e.isotope} is stable (zero decay flux; try U-235, Co-60, or C-14!)`),pr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ro(Zn,e),mr.textContent=`Bateman Isotope Populations N_i(t)/N₀ — ${e.isotope}`,ua?.curves?.length){let e=[`#facc15`,`#38bdf8`,`#c084fc`,`#34d399`];no(Qn,ua.curves.map((t,n)=>({xs:ua.tHalfUnits,ys:t.frac,color:e[n%e.length],width:2})),{label:ua.curves.map(e=>e.name).join(` → `)+` vs t / t½`,yMin:0,yMax:1.05}),Ra(`<div class="live-meter">Bateman Ledger: ${ua.curves.map(e=>e.name).join(` → `)} (t½=${Y(ua.firstHalfLifeS,2)} s · ΣA_i N_i exact)</div>`)}else X(Qn,[0,1,2,3],[1,1,1,1],{label:`${e.isotope} stable (N/N₀ = 1.0)`,color:`#34d399`,yMin:0,yMax:1.1});else La(`WebGPU 3D Volumetric Nuclear Fermi Density — ${e.isotope} (R_rms = ${Y(e.chargeRadiusFm,2)} fm)`,`B/A = ${Y(e.bindingPerNucleonMeV,3)} MeV · I^π = ${e.spinI}${e.parity} · μ_I = ${Y(e.magneticMomentMuN,2)} μ_N · Mode: ${e.dominantMode}`),Ki&&Ra(`<div class="live-meter">Live GPU TDSE (step ${Ki.stepCount}): P_well=${Y(Ki.pInside*100,1)}% · P_barrier=${Y(Ki.pBarrier*100,2)}% · P_tunneled=${Y(Ki.pTunneled*100,3)}%</div>`),pr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ro(Zn,e),mr.textContent=`Live GPU TDSE Tunneling vs WKB Gamow Barrier (Q_α = ${Y(e.qAlphaMeV,2)} MeV)`,io(Qn,e,Ki);hr.textContent=`Fermi Proton/Neutron Skin Profile ρ(r) — ${e.isotope}`;let t=Array.from({length:40},(t,n)=>n/39*Math.max(8,e.chargeRadiusFm*2.1)),n=t.map(t=>1/(1+Math.exp((t-e.chargeRadiusFm)/.54))),r=t.map(t=>e.N/Math.max(1,e.Z)/(1+Math.exp((t-e.chargeRadiusFm*1.03)/.55)));no($n,[{xs:t,ys:n,color:`#ff9c54`,width:2},{xs:t,ys:r,color:`#38bdf8`,width:1.6}],{label:`Proton (orange) vs Neutron (blue) density vs r (fm)`,yMin:0})}}else if(I===`atomic`){if(L===`compound`&&z){let e=z.bundle,t=z.visualData.molQm;if(La(`WebGPU 3D Molecular RHF ${[`Total Electron Density ρ(r)`,`HOMO Signed Orbital ψ`,`LUMO Signed Orbital ψ`][K.molOrbitalMode]||`Total ρ`} — ${e.materialKey} (Backfed Compound)`,t?`GPU Löwdin RHF · ${Li?.pointCount?.toLocaleString()||`0`} GPU samples · E = ${Y(t.totalEnergyHa,3)} Ha · μ = ${Y(t.dipoleDebye,2)} D · Gap = ${Y(t.homoLumoGapEv,2)} eV`:`Ionic/Covalent Crystal Prototype (${e.mechanical.crystalStructure}) · Pauling Ionicity = ${Y(e.atomic.paulingIonicity,2)}`),t?.orbitalEnergiesHa){pr.textContent=`GPU Molecular Orbital Spectrum (${e.materialKey})`,X(Zn,t.orbitalEnergiesHa.map((e,t)=>t),t.orbitalEnergiesHa,{label:`MO Energy (Ha) · HOMO-LUMO Gap = ${Y(t.homoLumoGapEv,2)} eV`,color:`#c084fc`}),mr.textContent=`Mulliken Atomic Charges q_i (${e.materialKey})`;let n=t.mullikenCharges||[0,0];X(Qn,n.map((e,t)=>t),n,{label:`Atomic charges (e): ${n.map(e=>Y(e,2)).join(`, `)}`,color:`#34d399`,hLine:{y:0,color:`#64748b`,label:`0e`}})}hr.textContent=`Derived Optical Dispersion — ${e.materialKey}`,oo($n,e.electromagnetic.spectralWavelengthsNm,e.electromagnetic.spectralReflectance,e.electromagnetic.spectralNRe,e.electromagnetic.opticalSrgb,e.materialKey)}else if(R?.visualData?.atom){let e=R.visualData.atom,t=e.radialGrid,n=R.bundle.atomic.unpairedElectrons||0,r=Ii?.sourceKind===`webgpu-kohn-sham-eigenstate`?`EXACT GPU Kohn–Sham Eigenstate u_nl(r)`:`Slater-KS Screened Associated Laguerre R_nl(r)`;La(`WebGPU 3D Schrödinger / Dirac–KS Orbital |ψ_${K.n}${Ta[K.l]||K.l},${K.m}|² — ${e.symbol}${K.ionizedCation?`⁺ (ΔSCF Cation)`:``} (Z=${e.atomicNumberZ})`,`${Ii?.pointCount?.toLocaleString()||`0`} GPU samples · ${r} · ${e.relativisticMethod} · E = ${Y(e.totalEnergyHa,2)} Ha`);let i=fa?` · α₀=${Y(fa.alpha0Angstrom3,2)} Å³ (${Y(fa.alpha0Bohr3,1)} a₀³)${Math.abs(K.starkFieldVPerA)>.05?` · p=${Y(fa.inducedDipoleDebye,2)} D · ΔE=${Y(fa.starkShiftEv*1e3,1)} meV`:``}`:``,a=K.ionizedCation&&da?` · ΔSCF I₁=${Y(da.ionizationEnergyEv,2)} eV (−1e⁻ ${da.removedShell})`:``;Ra(`<div class="live-meter">n=${K.n}, l=${K.l} (${Ta[K.l]||K.l}), m=${K.m} · Nodes=${Ii?.radialNodeCount??K.n-K.l-1}${i}${a}</div>`),pr.textContent=`Radial Probability 4πr²ρ(r) & Selected Subshell |u_nl(r)|²`;let o=t.r.map((e,n)=>4*Math.PI*e*e*t.rho[n]),s=t.r.findIndex(e=>e>Math.max(6,(Ii?.rExtentBohr||6)*1.1)),c=s>12?s:t.r.length,l=[{xs:t.r.slice(0,c),ys:o.slice(0,c),color:`#56c2ff`,width:1.8}],u=e.orbitals.findIndex(e=>e.n===K.n&&e.l===K.l);if(u>=0&&e.orbitalWavefunctions?.[u]){let n=e.orbitalWavefunctions[u],r=Math.max(1e-5,...o.slice(0,c)),i=Math.max(1e-8,...Array.from(n.slice(0,c),e=>e*e));l.push({xs:t.r.slice(0,c),ys:Array.from(n.slice(0,c),e=>e*e/i*r*.9),color:`#a78bfa`,width:2})}no(Zn,l,{label:`Total 4πr²ρ (blue) & Active ${K.n}${Ta[K.l]} |u|² (violet)`,yMin:0}),mr.textContent=`Relativistic Orbital Eigenvalues ε_nl & Spin-Orbit j± (Ha)`;let d=e.orbitals.filter(e=>Number(e.occupancy??1)>0),f=d.map((e,t)=>t);no(Qn,[{xs:f,ys:d.map(e=>e.energyHa),color:`#34d399`,width:2},{xs:f,ys:d.map(e=>e.energyJPlusHa??e.energyHa),color:`#facc15`,width:1.3},{xs:f,ys:d.map(e=>e.energyJMinusHa??e.energyHa),color:`#f472b6`,width:1.3}],{label:`Subshell ε_nl (green), j+ (gold), j− (pink) · ${K.relativisticSpinOrbit?`Rel+SO ON`:`Non-Rel`}`}),hr.textContent=`Angular Spherical Harmonic |Y_${K.l},${K.m}(θ)| Cross-Section`,so($n,K.l,K.m,e.symbol,n)}}else if(I===`crystal`){let e=ja(),t=Ma(),n=Ui;if(K.crystalViewMode===`spin-llg`&&e){let n=ta,r=n?.magneticPhase||t?.magneticPhase||`diamagnetic`;if(La(`Live WebGPU 3D Stochastic LLG Spin-Lattice — ${e.materialKey} (${r.toUpperCase()})`,n?`${n.spinCount} GPU spins · J=${Y(n.exchangeJEv*1e3,2)} meV · T=${Math.round(n.temperatureK)} K${n.curieOrNeelTempK>0?` (T_c=${Math.round(n.curieOrNeelTempK)} K)`:``} · B_z=${n.fieldBZTesla.toFixed(1)} T · M_z=${Y(n.magnetizationZ,3)} · |M_stag|=${Y(n.staggeredOrderMag,3)}`:`Stepping 3D sLLG spin lattice on WebGPU…`),n&&Ra(`<div class="live-meter">Phase: <b>${r.toUpperCase()}</b> · M_z=<b>${Y(n.magnetizationZ,3)}</b> · |M|=<b>${Y(n.magnetizationMag,3)}</b> · Néel |M_stag|=<b>${Y(n.staggeredOrderMag,3)}</b> · ⟨s_i·s_j⟩=${Y(n.neighborAlign,3)}</div>`),pr.textContent=`Live Spin Hysteresis / Field Response M_z(B_z) — ${e.materialKey}`,na.length>=2){X(Zn,na.map(e=>e.B),na.map(e=>e.Mz),{label:`M_z vs B_z (T) · Sweep B to trace ferromagnetic hysteresis!`,color:`#facc15`,yMin:-1.05,yMax:1.05,hLine:{y:0,color:`#64748b`,label:`0`}}),mr.textContent=`Ferro |M| (gold) vs Néel Antiferro |M_stag| (cyan)`;let e=na.map((e,t)=>t);no(Qn,[{xs:e,ys:na.map(e=>e.Mmag),color:`#facc15`,width:2},{xs:e,ys:na.map(e=>e.Mstag),color:`#38bdf8`,width:2}],{label:`|M| vs |M_stag| order parameters (drops to ~0 above T_c!)`,yMin:0,yMax:1.05})}}else if(K.crystalViewMode===`transport`&&e){let n=aa,r=n?.isSuperconducting?`SUPERCONDUCTING BCS CONDENSATE (ρ = 0 Ω·m!)`:n?.isMetal?`DRUDE–BLOCH–GRÜNEISEN METAL`:`SEMICONDUCTOR / INSULATOR (E_g=${Y(t?.bandGapEv,2)} eV)`;if(La(`Live WebGPU 3D Electron–Phonon & BCS Transport — ${e.materialKey}`,n?`${r} · T=${n.temperatureK<20?n.temperatureK.toFixed(1):Math.round(n.temperatureK)} K · Mobile=${n.mobileCount}/${n.carrierCount}${n.cooperCount>0?` · Cooper=${n.cooperCount}`:``} · Scatters=${n.scatterEvents}/step`:`Stepping 3D Drude–Boltzmann electron transport on WebGPU…`),n&&Ra(`<div class="live-meter">GPU σ(T)=<b>${n.isSuperconducting?`∞ S/m (ZERO RESISTANCE!)`:`${Y(n.sigmaGpuSPerM,2)} S/m (ρ=${Y(n.resistivityGpuOhmM,2)} Ω·m)`}</b> · Drift ⟨J_x⟩=${Y(n.meanDriftNorm,3)} · Phonon Scatters=${n.scatterEvents}/step</div>`),pr.textContent=`Live GPU Carrier Drift & Phonon Scattering — ${e.materialKey}`,oa.length>=2){let e=oa.map((e,t)=>t);no(Zn,[{xs:e,ys:oa.map(e=>Math.abs(e.drift)*4),color:`#38bdf8`,width:2},{xs:e,ys:oa.map(e=>e.scatter),color:`#fb923c`,width:1.8}],{label:`Scaled Drift Current (cyan) vs Phonon Scatter Rate (orange)`,yMin:0})}mr.textContent=`Conductivity Curve log10 σ(T) (1..1200 K) — ${e.materialKey}`;let i=Array.from({length:30},(e,t)=>1+t/29*1199);X(Qn,i,i.map(n=>{let r=Number(t?.superconductingTcK)||0;if(t?.isMetal&&r>.1&&n<r)return 12;Math.max(25,e.mechanical?.debyeTemperatureK||250);let i=Math.max(1e-18,t?.electricalConductivitySPerM||1e6);if(t?.isMetal)return Math.log10(Math.max(1,300/Math.max(15,n)*i));let a=Math.max(.1,t?.bandGapEv||2);return Math.max(-18,Math.min(8,Math.log10(i)+a/(2*8617e-8)*(1/300-1/Math.max(10,n))/Math.LN10))}),{label:`log10 σ(T) S/m vs T(K)`,color:`#34d399`,vLine:{x:K.transportTempK,color:`#facc15`,label:`${Math.round(K.transportTempK)}K`}})}else if((K.crystalViewMode===`tdks-atom`||K.crystalViewMode===`photon-shell`)&&e){let r=n?.channels?.[0],i=n?.channels?.[1],a=n?.channels?.[2],o=n?.channels?.[3],s=i?.nMeasuredFdtd??o?.nMeasuredFdtd??r?.nMeasuredFdtd;if(zi?.channels?.[K.photonModeMono?3:2],K.crystalViewMode===`tdks-atom`&&Ri&&zi){let t=`${Ri.n0}${Ta[Ri.l0]||``}(m=${Ri.m})`,n=`${Ri.n1}${Ta[Ri.l1]||``}`,r=[`E_y`,`E_z`,`Circular LCP`][K.tdksPolMode]||`E_y`,i=H?.gridN||32,a=Bi?`${Y(Bi.scattRatio*100,1)}%`:`…`,o=Bi?`${Y(Bi.crossPolFraction*100,1)}%`:`…`;La(`Live WebGPU 3D (${i}³) Maxwell–Kohn–Sham Wavepacket ↔ Orbital — ${e.materialKey} (${t} ↔ ${n})`,`3D Yee FDTD + ${Ri.pointCount.toLocaleString()}-pt Dirac–KS · Pol=${r} · ΔE=${Y(zi.transEv,2)} eV · 3D Scatt=${a} (Cross-Pol ${o}) · t=${Y(zi.getTimeFs(),2)} fs`)}else if(n){let t=n.oscillators.filter(e=>e.active).slice(0,2).map(e=>`${e.label} @ ${Y(e.energyEv,2)} eV`).join(` | `)||`Drude Free-Electron Gas`;La(`Live WebGPU 2D (128×128) Maxwell–ADE-FDTD Bulk Optical Cavity — ${e.materialKey}`,`${n.isMetal?`Drude ω_p=${Y(n.plasmaEv,2)} eV`:`Dielectric Gap=${Y(e.electromagnetic.bandGapEv,2)} eV`} · ${t} · t=${Y(n.simTimeFs,2)} fs`)}if(n&&r&&i&&a){let o=r.reflectance+i.reflectance+a.reflectance>.04,c=Aa(o?n.emergentReflectedSrgb:t?.opticalSrgb||n.analyticReflectedSrgb),l=i.refractAngleDeg==null?``:` · Snell θ_t=${Y(i.refractAngleDeg,1)}°`,u;if(K.crystalViewMode===`tdks-atom`&&zi){let e=zi.channels[0],t=zi.channels[1],n=zi.channels[2],r=Bi;u=`${r?`3D Maxwell–KS: Scatt=<b>${Y(r.scattRatio*100,1)}%</b> · Cross-Pol=<b>${Y(r.crossPolFraction*100,1)}%</b> · Lobe Abs=<b>${Y(r.absorbedEnergy,1)}</b> · Aniso=<b>${Y(r.angularAnisotropy,2)}</b> | `:``}|c₁|²: <span style="color:#f87171">610nm=${Y(e.rho11*100,1)}%</span> · <span style="color:#4ade80">535nm=${Y(t.rho11*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Y(n.rho11*100,1)}%</span>`}else u=n.isMetal?`2D FDTD Reflected R: <span style="color:#f87171">610nm=${Y(r.reflectance*100,1)}%</span> · <span style="color:#4ade80">535nm=${Y(i.reflectance*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Y(a.reflectance*100,1)}%</span> | Blue Shell Abs=${Y(a.absorption*100,1)}%`:`Live 2D FDTD n(λ) = <b>${s?Y(s,3):`propagating…`}</b> (analytic ${Y(i.analyticNRe,2)})${l} · T=${Y(i.transmittance*100,1)}%`;Ra(`<div class="live-meter">${u}</div><div class="live-meter"><i class="swatch" style="background:${c};"></i> ${o?`Emergent FDTD Reflected Color`:`GPU Optical Reflected Color`} ${L===`element`?K.relativisticSpinOrbit?`(Relativistic ON)`:`(Relativistic OFF)`:`(Backfed Compound)`}</div>`),pr.textContent=`Live 2D Maxwell–FDTD R(λ) vs Electron-Shell Absorption A(λ)`,ao(Zn,n,`${e.materialKey} · `)}}else if(L===`element`&&R?.visualData?.bulk){let e=R.visualData.bulk;La(`WebGPU 3D FFT Bloch Charge Density & Fermi Isosurface — ${e.symbol} (${e.crystalStructure})`,`a₀ = ${Y(e.latticeConstantA,2)} Å · ρ = ${Y(e.densityKgPerM3,0)} kg/m³ · E_F = ${Y(e.fermiEnergyEv,2)} eV · Gap = ${Y(e.bandGapEv,2)} eV · ${t.magneticPhase}`),pr.textContent=`All Brillouin Bands E_n(k) & Fermi Level E_F`;let n=e.bandsEv[0]?.length||1,r=e.bandsEv.map((e,t)=>t),i=[`#56c2ff`,`#a78bfa`,`#34d399`,`#f472b6`,`#fb923c`,`#38bdf8`,`#c084fc`,`#94a3b8`],a=Array.from({length:n},(t,n)=>({xs:r,ys:e.bandsEv.map(e=>e[n]),color:i[n%i.length],width:n<4?1.7:1.15})),o=(e.kPathLabels||[]).map((e,t)=>e?{x:t,label:e}:null).filter(Boolean);no(Zn,a,{label:`${n} Bloch Bands (eV) · E_F=${Y(e.fermiEnergyEv,1)} eV`,hLine:{y:e.fermiEnergyEv,color:`#facc15`,label:`E_F`},xTicks:o})}else e&&La(`WebGPU 3D Crystal Lattice — ${e.materialKey} (${e.mechanical.crystalStructure})`,`a₀ = ${Y(e.mechanical.latticeConstantA,2)} Å · ρ = ${Y(e.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Y(e.electromagnetic.bandGapEv,2)} eV`);if(!(K.crystalViewMode===`spin-llg`||K.crystalViewMode===`transport`)){if(L===`element`&&R?.visualData?.bulk){let e=R.visualData.bulk;mr.textContent=`Electronic DOS g(E) & Brillouin Fermi Level`,no(Qn,[{xs:Array.from(e.dosEnergyEv),ys:Array.from(e.dosValues),color:`#f472b6`,width:2}],{label:`g(E_F)=${Y(e.dosAtFermiStatesPerEvAtom,2)} · ${t.magneticPhase}`,yMin:0,vLine:{x:e.fermiEnergyEv,color:`#facc15`,label:`E_F`}})}else if(n){mr.textContent=`FDTD Channel Energy Balance (R + T + A = 1.0)`;let e=n.channels.map(e=>e.wavelengthNm);no(Qn,[{xs:e,ys:n.channels.map(e=>e.reflectance*100),color:`#facc15`,width:2},{xs:e,ys:n.channels.map(e=>e.transmittance*100),color:`#38bdf8`,width:2},{xs:e,ys:n.channels.map(e=>e.absorption*100),color:`#c084fc`,width:1.8}],{label:`FDTD R% (gold), T% (cyan), Shell Abs% (violet)`,yMin:0,yMax:105})}}hr.textContent=`GPU Optical UV-Vis Reflectance R(λ) & n(λ) (380–780 nm)`,oo($n,t?.spectralWavelengthsNm,t?.spectralReflectance,t?.spectralNRe,t?.opticalSrgb,`${e?.materialKey||``} (${K.relativisticSpinOrbit?`Rel`:`NonRel`})`)}else if(I===`md`){let e=ja(),t=Ji,n=$i,r=K.mdMode;if(La(`Zero-Copy WebGPU MD [${{equilibrium:`Equilibrium + Phonon VDOS`,strain:`Uniaxial/Shear Stress–Strain (K, G, ν)`,acoustic:`Acoustic Phonon Wave (v_L, v_T)`,shear:`Couette Shear NEMD Viscosity (η)`,thermal:`Hot/Cold Slab NEMD Thermal Cond. (κ)`,surface:`Free-Surface Vacuum Slab (γ)`}[r]||r}] — ${n?.label||e?.materialKey||``} (${n?.crystalStructure||``})`,t?`Atoms: ${Number(t.atomCount||0).toLocaleString()}${t.usedCellList?` (O(N) ${t.cellDims?t.cellDims.join(`×`):`Grid`})`:``} | t=${Y(t.timeFs,1)} fs | T=${Y(t.temperatureK,0)} K | ⟨Z⟩=${Y(t.meanCoordination??0,1)}/${t.idealCoordination??12} | δ_L=${Y(t.lindemannRatio??0,2)} | MSD=${Y(t.msdA2,2)} Å²`:`Initializing live WebGPU MD buffers…`),t)if(r===`strain`){let e=t.diagPressureGPa?.[0]??t.pressureGPa,n=t.stressOffDiagGPa?.[0]??0,r=t.poissonMeasured==null?`compress to measure`:Y(t.poissonMeasured,3);Ra(`<div class="live-meter">Strain ε_x=${Y((t.strainX||0)*100,1)}% · γ_xy=${Y((t.shearXY||0)*100,1)}% · σ_xx=${Y(e,2)} GPa · σ_xy=${Y(n,2)} GPa · Live ν=${r}</div>`)}else if(r===`shear`){let n=t.nemdViscosityPaS==null?`equilibrating…`:`${Y(t.nemdViscosityPaS*1e3,2)} mPa·s`;Ra(`<div class="live-meter">Live Couette NEMD: σ_xy=${Y(t.stressOffDiagGPa?.[0]??0,3)} GPa · GPU η=<b>${n}</b> (closure ${Y((e?.thermodynamic?.dynamicViscosityLiquidPaS||0)*1e3,2)} mPa·s)</div>`)}else if(r===`thermal`){let e=t.nemdThermalCondWPerMK==null?`building dT/dx…`:`${Y(t.nemdThermalCondWPerMK,1)} W/m·K`;Ra(`<div class="live-meter">Live Thermal NEMD: T_hot=${Y(t.slabTempK?.[0]??t.temperatureK,0)} K → T_cold=${Y(t.slabTempK?.[4]??t.temperatureK,0)} K · GPU κ_ph=<b>${e}</b></div>`)}else if(r===`surface`)Ra(`<div class="live-meter">Free-Surface Vacuum Slab (L_z=${Y(t.boxLengthsA?.[2]??0,1)} Å): Kirkwood–Buff GPU γ=<b>${Y(t.surfaceTensionNPerM??0,3)} N/m</b> (closure ${Y(e?.thermodynamic?.surfaceTensionNPerM??0,3)} N/m)</div>`);else if(r===`acoustic`)Ra(`<div class="live-meter">Acoustic Crystal Bar (L_x=${Y(t.boxLengthsA?.[0]??0,1)} Å): DFT v_L=${Y(e?.mechanical?.soundSpeedLongMPerS??0,0)} m/s · v_T=${Y(e?.mechanical?.soundSpeedTransMPerS??0,0)} m/s</div>`);else{let e=String(t.emergentPhase||`solid`).toUpperCase();Ra(`<div class="live-meter">Emergent Phase: <b style="color:${e===`VAPOR`?`#f472b6`:e===`BOILING`?`#fb923c`:e===`LIQUID`?`#34d399`:`#38bdf8`}">${e}</b> · <span style="color:#38bdf8">Solid ${Math.round((t.solidFraction??1)*100)}%</span> · <span style="color:#34d399">Liq ${Math.round((t.liquidFraction??0)*100)}%</span> · <span style="color:#f472b6">Vap ${Math.round((t.vaporFraction??0)*100)}%</span>${K.mdChamberMode===`bulk`&&K.mdNptBarostat?` · V/V₀=<b>${Y(t.volumeRatio??1,3)}</b> · P=${Y(t.pressureGPa,2)} GPa`:` · Drop/Vapor Chamber`}${t.gravityEnabled?` · <span style="color:#facc15">g↓ ${Y(t.gravityAccelAPerPs2,1)} Å/ps²</span> · ⟨y⟩=${Math.round((t.meanYFrac??.5)*100)}%`:``}</div>`)}if(t?.rdf&&(pr.textContent=`GPU Radial Distribution Function g(r) (Order → Melting)`,X(Zn,Array.from(t.rdf).map((e,r)=>(r+.5)/t.rdf.length*(n?.rcutA||5.5)),Array.from(t.rdf),{label:`g(r) vs r (Å) — sharp peaks=solid, broad=liquid`,color:`#34d399`,yMin:0})),r===`shear`&&t?.slabVx?(mr.textContent=`Live Couette Shear Velocity Profile v_x(y)`,X(Qn,[0,1,2,3,4,5,6,7],Array.from(t.slabVx),{label:`8-slab Couette v_x(y) (Å/t₀) across Y`,color:`#38bdf8`,hLine:{y:0,color:`#64748b`,label:`0`}})):r===`thermal`&&t?.slabTempK?(mr.textContent=`Live NEMD Spatial Temperature Gradient T(x)`,X(Qn,[0,1,2,3,4,5,6,7],Array.from(t.slabTempK),{label:`8-slab T(x) K (Hot slab #0–1 → Cold slab #4–5)`,color:`#fb923c`,yMin:0})):r===`acoustic`&&t?.slabVx&&t?.slabVy?(mr.textContent=`Live Acoustic Wavefront Profile v_x (P) & v_y (S)`,no(Qn,[{xs:[0,1,2,3,4,5,6,7],ys:Array.from(t.slabVx),color:`#facc15`,width:2},{xs:[0,1,2,3,4,5,6,7],ys:Array.from(t.slabVy),color:`#38bdf8`,width:2}],{label:`P-wave v_x (gold) & S-wave v_y (cyan) across crystal bar`,hLine:{y:0,color:`#64748b`,label:`0`}})):r===`strain`&&Zi.length>=2?(mr.textContent=`Live GPU Virial Stress vs Strain σ_xx(ε_x)`,X(Qn,Zi.map(e=>e.eps*100),Zi.map(e=>e.pxx),{label:`σ_xx (GPa) vs ε_x (%) · slope = elastic stiffness`,color:`#facc15`,hLine:{y:0,color:`#64748b`,label:`0`}})):(mr.textContent=`Live MD Temperature T(t) (${n?.label||``})`,Yi.length>=2&&no(Qn,[{xs:Yi.map(e=>e.t),ys:Yi.map(e=>e.T),color:`#ff9c54`,width:2}],{label:`T(t) K · T_m=${Y(n?.meltingPointK||600,0)} K`,yMin:0,hLine:{y:n?.meltingPointK||600,color:`#facc15`,label:`T_m`}})),Xi.length>=8&&(r===`equilibrium`||r===`acoustic`)){let e=u(Xi,(n?.dtFs||1)*4,32);hr.textContent=`GPU Phonon Vibrational DOS g(ω) (Peak ${Y(e.peakThz,1)} THz)`,X($n,Array.from(e.freqsThz),Array.from(e.vdos),{label:`VACF FFT g(f) vs THz · Θ_D,eff≈${Math.round(e.effectiveDebyeK)} K`,color:`#c084fc`,yMin:0,yMax:1.08})}else Yi.length>=2&&(hr.textContent=`Live MD Mean-Squared Displacement MSD(t) (Å²)`,X($n,Yi.map(e=>e.t),Yi.map(e=>e.msd),{label:`MSD(t) Å² · Diffusion slope spikes above T_m!`,color:`#38bdf8`,yMin:0}))}else if(I===`compound`){let e=K.chemViewMode,t=z?.visualData?.molQm||null,n=z?.bundle||null,r=W||Mi;if(e===`reactive-md`&&G){let e=ga,t=e?.speciesLabels||G.params.speciesLabels;if(La(`Live WebGPU 3D Reactive Chemistry MD Chamber — ${G.params.equation}`,e?`${e.moleculeCount} GPU molecules · T=${Math.round(e.temperatureK)} K · Conversion=${Y(e.conversionFrac*100,1)}% · Fwd=${e.totalFwdEvents} · Rev=${e.totalRevEvents} · Stoich=${e.stoichiometryConserved?`EXACT`:`ERR`}`:`Stepping 3D WebGPU reactive collision chamber…`),e&&Ra(`<div class="live-meter"><span style="color:#38bdf8">${t[0]}=${e.countA}</span> · <span style="color:#fb923c">${t[1]}=${e.countB}</span> → <span style="color:#34d399">${t[2]}=${e.countC}</span> + <span style="color:#e879f9">${t[3]}=${e.countD}</span> · E_a=${Y(e.forwardBarrierEv,2)} eV${e.catalystEnabled?` (CATALYST −48%)`:``} · ΔH=${Y(e.reactionEnthalpyEv,2)} eV</div>`),pr.textContent=`Live Species Populations [A],[B],[C],[D](t)`,_a.length>=2){let e=_a.map(e=>e.step);no(Zn,[{xs:e,ys:_a.map(e=>e.fA*100),color:`#38bdf8`,width:2},{xs:e,ys:_a.map(e=>e.fB*100),color:`#fb923c`,width:1.6},{xs:e,ys:_a.map(e=>e.fC*100),color:`#34d399`,width:2.2},{xs:e,ys:_a.map(e=>e.fD*100),color:`#e879f9`,width:1.6}],{label:`${t[0]}/${t[1]} (cyan/amber) → ${t[2]}/${t[3]} (green/pink) %`,yMin:0,yMax:55}),mr.textContent=`Live Exothermic Chamber Temperature T(t) (K)`,X(Qn,e,_a.map(e=>e.T),{label:`Chamber T(t) K (spikes on exothermic ignition!)`,color:`#facc15`,yMin:0})}let n=W?.thermodynamics||Ee(G.params.forwardBarrierEv,G.params.reactionEnthalpyEv);hr.textContent=`Arrhenius Rate log₁₀ k(T) vs 1000/T (K⁻¹)`,X($n,Array.from(n.invT1000PerK),Array.from(n.log10KRate),{label:`log10 k(T) · ΔG°₂₉₈=${Y(n.deltaG298KjPerMol,1)} kJ/mol`,color:`#c084fc`})}else if(e===`vibrations`){let e=ma,t=e?.modes?.[K.vibModeIdx]||null;if(La(e?`WebGPU Geometry Opt & Vibrational Normal Modes — ${e.formula}${e.deuterated?` (Deuterated D)`:``}`:`Click "Solve GPU Opt + Hessian" to compute live GPU vibrational normal modes`,e&&t?`Mode ${K.vibModeIdx+1}/${e.modes.length}: ν=${Y(t.freqCm1,1)} cm⁻¹ (${t.label}) · IR=${Y(t.irIntensityKmPerMol,1)} km/mol · ZPE=${Y(e.totalZpeEv,3)} eV (${Y(e.totalZpeKjPerMol,1)} kJ/mol)`:`Eckart-projected GPU RHF Hessian diagonalized on WebGPU via Gate 0B eigensolver`),e&&Ra(`<div class="live-meter">GPU Hessian Modes (${e.basisUsed}): ${e.modes.map((e,t)=>`${t===K.vibModeIdx?`<b>`:``}${Math.round(e.freqCm1)} cm⁻¹${t===K.vibModeIdx?`</b>`:``}`).join(` · `)} | Total ZPE = <b>${Y(e.totalZpeEv,3)} eV</b></div>`),pa?.trajectory?.length>=2&&(pr.textContent=`GPU Geometry Relaxation ΔE(step) (${pa.steps} steps)`,X(Zn,pa.trajectory.map(e=>e.step),pa.trajectory.map(e=>e.energyEvRel),{label:`ΔE_relax = ${Y(pa.relaxationEv,3)} eV · GPU RHF calls=${pa.gpuRhfCalls}`,color:`#34d399`})),e?.spectrum){mr.textContent=`GPU IR (gold) & Raman (cyan) Vibrational Spectrum — ${e.formula}${e.deuterated?` [D]`:``}`;let n=Math.max(.001,...e.spectrum.irSpectrum),r=Math.max(.001,...e.spectrum.ramanSpectrum);no(Qn,[{xs:Array.from(e.spectrum.wavenumbersCm1),ys:Array.from(e.spectrum.irSpectrum,e=>e/n*100),color:`#facc15`,width:2},{xs:Array.from(e.spectrum.wavenumbersCm1),ys:Array.from(e.spectrum.ramanSpectrum,e=>e/r*85),color:`#38bdf8`,width:1.5}],{label:`Normalized IR |∂μ/∂Q|² (gold) & Raman (cyan) vs ν (cm⁻¹)`,yMin:0,yMax:108,vLine:t&&t.freqCm1>0?{x:t.freqCm1,color:`#f472b6`,label:`${Math.round(t.freqCm1)}`}:null}),hr.textContent=`Normal-Mode Frequencies ν_k (cm⁻¹) & IR Intensities`,X($n,e.modes.map((e,t)=>t+1),e.modes.map(e=>e.freqCm1),{label:`Masses: ${e.massesU.map(e=>e.toFixed(1)).join(`, `)} u · ZPE=${Y(e.totalZpeEv,3)} eV`,color:`#c084fc`,yMin:0})}}else if(e===`reaction-path`&&r){let e=r.images||[],t=Math.max(0,Math.min(Math.max(0,e.length-1),K.nebImageIdx)),i=e[t],a=t/Math.max(1,(r.energiesEv?.length||2)-1);if(La(`WebGPU Multi-Molecule CI-NEB Pathway — ${r.equation||n?.materialKey||``}`,`Image #${t}/${Math.max(0,(r.energiesEv?.length||1)-1)} (ξ=${a.toFixed(2)}${t===r.saddleImageIndex?` ‡ TRANSITION STATE`:``}) · E_a=${Y(r.forwardBarrierEv,2)} eV · ΔE=${Y(r.energiesEv?.[t]??0,2)} eV · GPU RHF=${r.gpuRhfCalls}`),i?.bonds?.length){let e=i.bonds.slice(0,5).map(e=>{let t=i.atoms?.[e.a]?.Z,n=i.atoms?.[e.b]?.Z;return`${`${_(t)||t}${e.kind===`triple`?`≡`:e.kind===`double`?`=`:e.kind===`partial`?`⋯‡`:`–`}${_(n)||n}`}(${e.order.toFixed(2)})`}).join(` · `);Ra(`<div class="live-meter">Live Wiberg Bonds at ξ=${a.toFixed(2)}: ${e} · μ=${Y(i.dipoleDebye,2)} D</div>`)}if(r.energiesEv?.length>=3&&(pr.textContent=`WebGPU CI-NEB Barrier (E_a = ${Y(r.forwardBarrierEv,2)} eV)`,X(Zn,r.energiesEv.map((e,t)=>t/(r.energiesEv.length-1)),r.energiesEv,{label:`GPU MEP ΔE (eV) · TS‡ #${r.saddleImageIndex} (${r.basisUsed||`sto-3g`})`,color:`#ff9c54`,yMin:Math.min(0,...r.energiesEv),vLine:{x:a,color:`#38bdf8`,label:`ξ=${a.toFixed(2)}`}})),e.length>=3&&e[0]?.bondOrderMatrix){mr.textContent=`Wiberg Bond-Order Evolution B_AB(ξ) (Breaking vs Forming!)`;let t=e[0].atoms.length,n=[];for(let r=0;r<t;r+=1)for(let i=r+1;i<t;i+=1){let t=e.map(e=>e.bondOrderMatrix?.[r]?.[i]??0),a=Math.max(...t)-Math.min(...t);Math.max(...t)>.25&&n.push({a:r,b:i,vals:t,span:a})}n.sort((e,t)=>t.span-e.span);let r=n.slice(0,4),i=[`#f87171`,`#34d399`,`#38bdf8`,`#facc15`],o=e.map(e=>e.xi);r.length>0&&no(Qn,r.map((e,t)=>({xs:o,ys:e.vals,color:i[t%i.length],width:2})),{label:r.map(t=>`${_(e[0].atoms[t.a].Z)}–${_(e[0].atoms[t.b].Z)}`).join(`, `)+` vs ξ`,yMin:0,vLine:{x:a,color:`#ffffff`,label:``}})}if(r.thermodynamics){let e=r.thermodynamics;hr.textContent=`Van 't Hoff ΔG(T) (ΔG°₂₉₈ = ${Y(e.deltaG298KjPerMol,1)} kJ/mol)`,X($n,Array.from(e.tempsK),Array.from(e.deltaGKjPerMol),{label:`ΔG(T) kJ/mol vs T(K) · ${e.spontaneousAt298K?`Spontaneous at 298K`:`Endergonic at 298K`}`,color:`#34d399`,hLine:{y:0,color:`#facc15`,label:`ΔG=0`}})}}else if(n){let e=t?.bonds||[];if(La(t?`WebGPU 3D Molecular Structure, Wiberg Bonds & MEP — ${n.materialKey} (${t.basisUsed})`:`WebGPU 3D Multi-Species Crystal — ${n.materialKey} (${n.mechanical.crystalStructure})`,t?`E = ${Y(t.totalEnergyHa,3)} Ha · μ = ${Y(t.dipoleDebye,2)} D · Gap = ${Y(t.homoLumoGapEv,2)} eV · ${e.length} Wiberg bond${e.length===1?``:`s`}`:`a₀ = ${Y(n.mechanical.latticeConstantA,2)} Å · ρ = ${Y(n.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Y(n.electromagnetic.bandGapEv,2)} eV`),t&&Ra(`<div class="live-meter">Wiberg Bonds: ${e.slice(0,5).map(e=>{let n=t.atoms[e.a]?.Z,r=t.atoms[e.b]?.Z;return`${`${_(n)||n}${e.kind===`triple`?`≡`:e.kind===`double`?`=`:e.kind===`partial`?`⋯`:`–`}${_(r)||r}`} (${e.order.toFixed(2)}, ${Y(e.lengthA,2)} Å)`}).join(` · `)||`Ionic/Van der Waals complex`} · |μ|=${Y(t.dipoleDebye,2)} D · Mode=${K.molColorMode===1?`Mulliken MEP (±q)`:`CPK`}</div>`),t?.orbitalEnergiesHa){pr.textContent=`GPU Molecular Orbital Spectrum (${n.materialKey})`,X(Zn,t.orbitalEnergiesHa.map((e,t)=>t),t.orbitalEnergiesHa,{label:`MO Energy (Ha) | HOMO-LUMO Gap = ${Y(t.homoLumoGapEv,2)} eV`,color:`#c084fc`}),mr.textContent=`Mulliken Atomic Charges q_i & Wiberg Bond Orders (${n.materialKey})`;let e=t.mullikenCharges||[0,0];X(Qn,e.map((e,t)=>t),e,{label:`Charges: ${t.atoms.map((t,n)=>`${_(t.Z)}:${e[n]>=0?`+`:``}${Y(e[n],2)}`).join(` `)}`,color:`#34d399`,hLine:{y:0,color:`#64748b`,label:`0e`}})}else pr.textContent=`Multi-Species Crystal Moduli (${n.materialKey})`,X(Zn,[0,1,2],[n.mechanical.bulkModulusPa*1e-9,n.mechanical.shearModulusPa*1e-9,n.electromagnetic.bandGapEv*10],{label:`K=${Y(n.mechanical.bulkModulusPa*1e-9,1)} GPa · G=${Y(n.mechanical.shearModulusPa*1e-9,1)} GPa`,color:`#c084fc`,yMin:0}),mr.textContent=`Compound Phase Transitions (${n.materialKey})`,X(Qn,[0,1,2],[0,n.thermodynamic.meltingPointK,n.thermodynamic.boilingPointK],{label:`T_m = ${Y(n.thermodynamic.meltingPointK,0)} K · T_b = ${Y(n.thermodynamic.boilingPointK,0)} K`,color:`#38bdf8`,yMin:0});hr.textContent=`Compound GPU Optical UV-Vis Spectrum (${n.materialKey})`,oo($n,n.electromagnetic.spectralWavelengthsNm,n.electromagnetic.spectralReflectance,n.electromagnetic.spectralNRe,n.electromagnetic.opticalSrgb,n.materialKey)}}else if(I===`polytope`&&B){let e=K.polytopeProbe,t=K.polytopeViewMode;La(`WebGPU ${t===`3d-surface`?`3D Convex Phase Surface (log₁₀ T, log₁₀ P, log₁₀ ρ)`:t===`residual-map`?`GPU Chebyshev Fit Residual Error Map`:`2D Exact GPU Facet Map`} — ${B.materialKey} (${B.polytopeCount} Cells · ${K.polytopeRegime===`planetary`?`1 TPa`:`10 GPa`})`,t===`3d-surface`?`Drag to 3D orbit · Tap/Click or slide (log₁₀T, log₁₀P) to drop glowing GPU probe pin · Cyan pin = Live MD state · Red skirt = fail-closed`:`Slanted Clausius–Clapeyron A x <= b · Live GPU eval_polytope_atlas_2d · Hover/Tap to probe`),e&&(e.hit?Ra(`<div class="live-meter">GPU Probe (${Y(e.temperatureK,1)} K, ${Y(e.pressurePa*1e-5,2)} bar): Phase=<b>${e.phase.toUpperCase()}</b> · ρ_GPU=<b>${Y(e.densityKgPerM3,2)} kg/m³</b>${e.eosRho?` (EOS ${Y(e.eosRho,2)}, err ${Y(e.relErrPct,2)}%)`:``} · margin=${Y(e.margin,3)}</div>`):Ra(`<div class="live-meter fail-closed">GPU Probe (${Y(e.temperatureK,1)} K, ${Y(e.pressurePa*1e-5,2)} bar): <b>OUT OF DOMAIN (FAIL-CLOSED · hitFlag=0)</b> — triggers Tier-2/3 synthesis, never silent extrapolation!</div>`)),pr.textContent=`Convex Polytopes (${B.materialKey}): ${B.polytopeCount} Cells`,co(Zn,B,e),mr.textContent=`GPU Chebyshev Max Relative Residuals (%)`;let n=B.polytopes.map(e=>(e.fit?.maxRelativeError??0)*100);X(Qn,n.map((e,t)=>t),n,{label:`Max Rel Error (%) per Polytope`,color:`#38bdf8`,yMin:0}),hr.textContent=`1 atm Multi-Phase Density Curve log10 ρ(T)`;let r=ja();if(r){let e=r.thermodynamic.meltingPointK,t=r.thermodynamic.boilingPointK,n=Array.from({length:32},(n,r)=>10**(Math.log10(Math.max(5,e*.25))+r/31*(Math.log10(Math.max(t*3,5e3))-Math.log10(Math.max(5,e*.25))))),i=n.map(n=>Math.log10(Math.max(1e-5,x(r,n<e?`solid`:n<t?`liquid`:`gas`,n,101325))));X($n,n.map(e=>Math.log10(e)),i,{label:`log10 ρ(kg/m³) vs log10 T(K) at 1 atm (solid→liquid→gas)`,color:`#34d399`})}}}}var Mo={tdks3d:0,photon2d:0,tdse:0};function No(e){let t=Math.max(.05,Math.min(2,Math.round((Number(e)||1)*20)/20));if(K.simSpeed=t,Lr&&(Lr.textContent=`${t.toFixed(2)}×`),Ir&&(Ir.value=String(t)),zr)for(let e of zr.querySelectorAll(`[data-speed-preset]`)){let n=Number(e.dataset.speedPreset);e.classList.toggle(`active-speed`,Math.abs(n-t)<.02)}jo(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.simSpeed=K.simSpeed)}async function Po(){let e=Math.max(.05,Math.min(1,K.simSpeed));if(I===`nuclear`){if(K.nuclearViewMode===`fission`&&L===`element`)K.fissionPlaying=!1,K.fissionBeta2=K.fissionBeta2+.03>1.35?0:Number((K.fissionBeta2+.03).toFixed(2)),go(),Z(),Q();else if(Gi){K.tdsePlaying=!1;let e=await Gi.stepBatch(1);e&&(Ki=e),Z(),Q()}}else if(I===`crystal`){if(K.crystalViewMode===`tdks-atom`&&H){K.photonPlaying=!1,zi?.stepFs(.065*e);let t=await H.stepBatch(1,{readObs:!0});t&&(Bi=t),Z(),Q()}else if(K.crystalViewMode===`photon-shell`&&Hi){K.photonPlaying=!1;let e=await Hi.stepBatch(1,{readObs:!0});e&&(Ui=e),Z(),Q()}else if(K.crystalViewMode===`spin-llg`&&ea){K.spinPlaying=!1;let t=await ea.stepBatch(1,{temperatureK:K.spinTempK,fieldBZTesla:K.spinFieldBTesla,readObs:!0,dtScale:e});t&&(ta=t,na.push({B:t.fieldBZTesla,Mz:t.magnetizationZ,Mmag:t.magnetizationMag,Mstag:t.staggeredOrderMag,T:t.temperatureK})),Z(),Q()}else if(K.crystalViewMode===`transport`&&ia){K.transportPlaying=!1;let t=await ia.stepBatch(1,{temperatureK:K.transportTempK,eFieldVPerM:K.transportEFieldVPerM,readObs:!0,dtScale:e});t&&(aa=t,oa.push({T:t.temperatureK,drift:t.meanDriftNorm,scatter:t.measuredScatterRateFrac,sigma:t.sigmaGpuSPerM})),Z(),Q()}}else if(I===`md`&&U){K.mdPlaying=!1;let t=K.mdMode===`strain`||K.mdMode===`equilibrium`&&K.mdChamberMode===`bulk`&&K.mdNptBarostat?0:null,n=await U.stepBatch(1,{readTelemetry:!0,temperatureK:K.mdTargetTempK,nptBarostatGPa:t,dtScale:e});n&&(Ji=n,Yi.push({t:n.timeFs,T:n.temperatureK,msd:n.msdA2})),Z(),Q()}else if(I===`compound`)if(K.chemViewMode===`reactive-md`&&G){K.rxMdPlaying=!1;let t=await G.stepBatch(1,{temperatureK:K.rxMdTempK,catalyst:K.rxMdCatalyst,thermostat:K.rxMdThermostat,readObs:!0,dtScale:e});t&&(ga=t,_a.push({step:t.stepIndex,fA:t.fracA,fB:t.fracB,fC:t.fracC,fD:t.fracD,T:t.temperatureK})),Z(),Q()}else if(K.chemViewMode===`reaction-path`){let e=W||Mi;e?.energiesEv?.length>=2&&(K.nebPlaying=!1,K.nebImageIdx=(K.nebImageIdx+1)%e.energiesEv.length,Z(),Q())}else K.chemViewMode===`vibrations`&&ma&&(K.vibPlaying=!1,ya+=.25*Math.max(.2,e),Z(),Q());$()}var Fo=0,Io=null;function Lo(){document.hidden||Io!=null||(Io=requestAnimationFrame(Ro))}function Ro(e){if(Io=null,document.hidden)return;Fo+=1;let t=Math.max(.05,Math.min(2,Number(K.simSpeed)||1)),n=Math.min(1,t);if(K.autoRotate&&(I===`atomic`||I===`compound`)&&(q+=.008*t),I===`crystal`&&(K.crystalViewMode===`tdks-atom`||K.crystalViewMode===`photon-shell`)&&K.photonPlaying){if(zi&&zi.stepFs(.065*t),K.crystalViewMode===`tdks-atom`&&H){Mo.tdks3d+=t;let e=Math.floor(Mo.tdks3d);e>=1&&(Mo.tdks3d-=e,H.getStepIndex()>=115?(H.resetPulse({nextProbeWavelengthNm:K.probeWavelengthNm,nextPolMode:K.tdksPolMode,nextModeMono:K.photonModeMono}),H.stepSync(10)):H.stepSync(Math.min(4,e))),!Vi&&Fo%8==0&&(Vi=!0,H.readTelemetry({nonBlocking:!0}).then(e=>{e&&(Bi=e,window.__ulgElementsLabState&&(window.__ulgElementsLabState.tdks3dTelemetry=e),I===`crystal`&&K.crystalViewMode===`tdks-atom`&&Q())}).catch(()=>{}).finally(()=>{Vi=!1}))}if(Hi){Mo.photon2d+=3*t;let e=Math.floor(Mo.photon2d);e>=1&&(Mo.photon2d-=e,Hi.getStepIndex()>=380?(Hi.reset(null,{nextProbeWavelengthNm:K.probeWavelengthNm}),Hi.stepSync(24)):Hi.stepSync(Math.min(8,e))),!Wi&&Fo%8==0&&(Wi=!0,Hi.readTelemetry({nonBlocking:!0}).then(e=>{if(!e)return;Ui=e,window.__ulgElementsLabState&&(window.__ulgElementsLabState.photonTelemetry=e);let t=ja();t&&eo(t,L===`element`?R?.g7Advisory:{hasReference:!1,note:`Backfed compound live Maxwell–FDTD optics.`}),I===`crystal`&&Q()}).catch(()=>{}).finally(()=>{Wi=!1}))}}if(I===`crystal`&&K.crystalViewMode===`spin-llg`&&ea&&K.spinPlaying&&!ra&&Fo%2==0){if(K.spinSweepB){K.spinFieldBTesla+=K.spinSweepDir*.16*t,K.spinFieldBTesla>=4.8&&(K.spinFieldBTesla=4.8,K.spinSweepDir=-1),K.spinFieldBTesla<=-4.8&&(K.spinFieldBTesla=-4.8,K.spinSweepDir=1);let e=document.getElementById(`lbl-spin-b`);e&&(e.textContent=K.spinFieldBTesla.toFixed(1))}ra=!0;let e=t>1?Math.min(16,Math.round(8*t)):8;ea.stepBatch(e,{temperatureK:K.spinTempK,fieldBZTesla:K.spinFieldBTesla,readObs:!0,nonBlocking:!0,dtScale:n}).then(e=>{e&&(ta=e,na.push({B:e.fieldBZTesla,Mz:e.magnetizationZ,Mmag:e.magnetizationMag,Mstag:e.staggeredOrderMag,T:e.temperatureK}),na.length>90&&na.shift(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.spinTelemetry=e),I===`crystal`&&K.crystalViewMode===`spin-llg`&&Q())}).catch(()=>{}).finally(()=>{ra=!1})}if(I===`crystal`&&K.crystalViewMode===`transport`&&ia&&K.transportPlaying&&!sa&&Fo%2==0){sa=!0;let e=t>1?Math.min(8,Math.round(3*t)):3;ia.stepBatch(e,{temperatureK:K.transportTempK,eFieldVPerM:K.transportEFieldVPerM,readObs:!0,nonBlocking:!0,dtScale:n}).then(e=>{e&&(aa=e,oa.push({T:e.temperatureK,drift:e.meanDriftNorm,scatter:e.measuredScatterRateFrac,sigma:e.sigmaGpuSPerM}),oa.length>70&&oa.shift(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.transportTelemetry=e),I===`crystal`&&K.crystalViewMode===`transport`&&Q())}).catch(()=>{}).finally(()=>{sa=!1})}if(I===`nuclear`&&L===`element`&&K.nuclearViewMode===`fission`&&K.fissionPlaying&&Fo%3==0){K.fissionBeta2+=.025*t,K.fissionBeta2>1.35&&(K.fissionBeta2=0);let e=document.getElementById(`ctrl-fiss-b2`),n=document.getElementById(`lbl-fiss-b2`);e&&(e.value=String(K.fissionBeta2)),n&&(n.textContent=K.fissionBeta2.toFixed(2)),go(),Q()}if(I===`nuclear`&&L===`element`&&K.nuclearViewMode===`tdse`&&Gi&&K.tdsePlaying&&!qi){Mo.tdse+=4.67*t;let e=Math.floor(Mo.tdse);e>=1&&(Fo%3==0||e>=14)&&(Mo.tdse-=e,qi=!0,Gi.stepBatch(Math.min(28,e),{nonBlocking:!0}).then(e=>{e&&(Ki=e,e.stepCount>=1400&&Gi.resetWavepacket(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.tdseTelemetry={stepCount:e.stepCount,pInside:e.pInside,pBarrier:e.pBarrier,pTunneled:e.pTunneled}),I===`nuclear`&&Q())}).catch(()=>{}).finally(()=>{qi=!1}))}if(I===`compound`&&K.nebPlaying&&Mi?.energiesEv?.length>=2&&e-K.nebLastTickMs>=520/t&&(K.nebLastTickMs=e,K.nebImageIdx=(K.nebImageIdx+1)%Mi.energiesEv.length,Z(),Q()),Do(),I===`md`&&U&&K.mdPlaying&&!Qi){let e=U;Qi=!0;let r=K.mdMode===`strain`||K.mdMode===`equilibrium`&&K.mdChamberMode===`bulk`&&K.mdNptBarostat?0:null,i=e.atomCount||500,a=i>=45e3?1:i>=8e3?3:i>=1500?5:ui?6:10,o=t>1?Math.min(i>=45e3?2:20,Math.max(1,Math.round(a*t))):a;e.stepBatch(o,{readTelemetry:!0,temperatureK:K.mdTargetTempK,nptBarostatGPa:r,nonBlocking:!0,dtScale:n}).then(t=>{!t||U!==e||(Ji=t,Yi.push({t:t.timeFs,T:t.temperatureK,msd:t.msdA2}),Yi.length>80&&Yi.shift(),Xi.push(t.vacf??0),Xi.length>64&&Xi.shift(),K.mdMode===`strain`&&(Zi.push({eps:t.strainX||0,pxx:t.diagPressureGPa?.[0]??t.pressureGPa}),Zi.length>60&&Zi.shift()),window.__ulgElementsLabState&&(window.__ulgElementsLabState.mdTelemetry=t),I===`md`&&Q())}).catch(()=>{}).finally(()=>{U===e&&(Qi=!1)})}if(I===`compound`){if(K.chemViewMode===`vibrations`&&ma&&K.vibPlaying){let e=Math.abs(ma.modes?.[K.vibModeIdx]?.freqCm1||1500);ya+=(.08+Math.min(.14,e/26e3))*t}let r=W||Mi;if(K.chemViewMode===`reaction-path`&&K.nebPlaying&&r?.energiesEv?.length>=2&&e-K.nebLastTickMs>460/t&&(K.nebLastTickMs=e,K.nebImageIdx=(K.nebImageIdx+1)%r.energiesEv.length,Z(),Q()),K.chemViewMode===`reactive-md`&&G&&K.rxMdPlaying&&!va&&Fo%2==0){va=!0;let e=t>1?Math.min(8,Math.round(3*t)):3;G.stepBatch(e,{temperatureK:K.rxMdTempK,catalyst:K.rxMdCatalyst,thermostat:K.rxMdThermostat,readObs:!0,nonBlocking:!0,dtScale:n}).then(e=>{e&&(ga=e,_a.push({step:e.stepIndex,fA:e.fracA,fB:e.fracB,fC:e.fracC,fD:e.fracD,T:e.temperatureK}),_a.length>80&&_a.shift(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.reactiveMdTelemetry=e),I===`compound`&&K.chemViewMode===`reactive-md`&&Q())}).catch(()=>{}).finally(()=>{va=!1})}}Lo()}async function zo(e){let n=ja();if(!(!P||!n)){K.polytopeRegime=e,K.polytopeProbe=null,ur.textContent=`Fitting ${n.materialKey} ${e} Atlas…`;try{B=await S(P,n,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,e===`planetary`?0xe8d4a51000:1e10],materialIndex:n.atomicNumber||0,useSharedPersistentCache:!0}),window.__ulgElementsLabState&&(window.__ulgElementsLabState.atlasPolytopeCount=B.polytopeCount,window.__ulgElementsLabState.lastAtlasCacheStatus=B.cacheStatus||`bypass`,window.__ulgElementsLabState.lastAtlasCacheBackend=B.cacheBackend||null,window.__ulgElementsLabState.polytopeCacheStats=t().getStats());let r=B.cacheStatus===`hit`?` · ${String(B.cacheBackend||`cache`).toUpperCase()} warm`:``;return ur.textContent=`${n.materialKey} · ${e} Atlas OK${r}`,Z(),Q(),$(),B}catch(e){return ur.textContent=`Atlas err: ${e.message}`,null}}}async function Bo(e,t=null,{preserveQuantumNumbers:n=!1,switchToTab:r=null}={}){if(!P)return;let i=t!=null&&Number.isFinite(Number(t))?Math.max(e,Math.min(310,Math.trunc(Number(t)))):null;ur.textContent=`Solving ${i==null?`${_(e)} (Z=${e})`:`${_(e)}-${i}`}…`,Oi=null,L=`element`,z=null,pa=null,ma=null,Mi=null,Ya();try{R=await ce(P,e,{massNumberA:i,runNuclearGpuVolume:!0,runLiveMd:!0,mdSteps:16,atomicMaxScf:50,nuclearVolDim:24,blochGridN:16,functional:K.functional,scalarRelativistic:K.relativisticSpinOrbit,spinOrbit:K.relativisticSpinOrbit,returnOrbitalWavefunctions:!0});let t=R.visualData.atom,a=R.bundle.atomic.unpairedElectrons||0;if(!n){let t=Na(e);K.n=t.n,K.l=t.l,K.m=t.m}wi=F.buildAtomicVolumeOnGpu({rGrid:t.radialGrid.r,rhoGrid:t.radialGrid.rho,valenceL:K.l,unpairedCount:a,totalElectrons:t.electronCount,dim:32}),K.ionizedCation=!1,da=null,_o(),lo(),po(),yo(),bo(),mo();let o=R.bundle.nuclear.A;tr&&(tr.value=String(o)),ji=A(e,o,{maxDepth:12}),ua=ho(ji),go();let s=K.polytopeRegime===`planetary`?0xe8d4a51000:1e10;B=await S(P,R.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,s],materialIndex:e,useSharedPersistentCache:!0}),K.polytopeProbe=null;try{ha=E(R.bundle.symbol||_(e),{crystalStructure:R.bundle.mechanical.crystalStructure,latticeConstantA:R.bundle.mechanical.latticeConstantA,cellsPerSide:2,paulingIonicity:0})}catch{ha=null}Co(),Ya(),$a(R.bundle,ji),eo(R.bundle,R.g7Advisory),za({kind:`element`,Z:e,A:o,label:R.bundle.nuclear.isotope}),r?qo(r):(Z(),Q()),ur.textContent=`${R.bundle.nuclear.isotope} · WebGPU OK`,$()}catch(e){ur.textContent=`Error: ${e.message}`,console.error(e)}}async function Vo(){for(let e of Ni)if(e?.pointsBuffer)try{e.pointsBuffer.destroy()}catch{}Ni=[];let e=W?.imageOrbitalParams||Mi?.imageOrbitalParams||[];if(!(!P||!e.length))for(let t of e){let e=ne(P,{posZeta:t.posZeta,weights:t.weights,boxHalfBohr:t.boxHalfBohr,mode:K.molOrbitalMode,pointCount:ui?45e3:95e3,seed:1});Ni.push(e)}}async function Ho(e){let t=e?.visualData?.molQm?.atoms;if(!P||!Array.isArray(t)||t.length<2||t.length>6)return null;let n=t.map(e=>({Z:e.Z,position:[e.x,e.y,e.z]})),r,i;t.length>=3?(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x,-e.y,e.z]}),i=`molecular inversion TS (WebGPU)`):(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x*1.85,e.y*1.85,e.z*1.85]}),i=`bond stretch MEP (WebGPU)`);try{return await De(P,{reactantAtoms:n,productAtoms:r,equation:`${e.bundle.materialKey} (${i})`,nImages:5,maxNebSteps:3,basisName:e.visualData.molQm.basisUsed||`auto`,sampleVolumes:!0})}catch{return null}}function Uo(e){if(!F||!e)return null;let t=e.visualData?.molQm?.atoms,n=e.bundle.nuclear.isotopologueSites||[],r=[];if(Array.isArray(t)&&t.length>0)r=t.map((e,t)=>{let r=n[t]||{Z:e.Z,A:l(e.Z)},i=p(r.Z,r.A);return{x:e.x,y:e.y,z:e.z,Z:i.Z,N:i.N,chargeRadiusFm:i.chargeRadiusFm}});else{let e=[];for(let t of n){let n=p(t.Z,t.A);for(let r=0;r<Math.min(4,t.count||1);r+=1)e.push(n)}let t=Math.max(1,e.length);r=e.map((e,n)=>{let r=n/t*Math.PI*2;return{x:t===1?0:Math.cos(r),y:t===1?0:Math.sin(r)*.5,z:t===1?0:Math.sin(r)*.7,Z:e.Z,N:e.N,chargeRadiusFm:e.chargeRadiusFm}})}return F.buildCompositeNuclearVolumeOnGpu(r,24)}async function Wo(e,t=`crystal`){if(!P||!e)return;Oi=null,z=e;let n=K.polytopeRegime===`planetary`?0xe8d4a51000:1e10;B=await S(P,e.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,n],useSharedPersistentCache:!0}),K.polytopeProbe=null,L=`compound`,Ya(),Ti=Uo(e),Ei=g({crystalStructure:e.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(e.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(e.bundle.nuclear.molarMassU||28)),temperatureK:300}),lo(),po(),yo(),bo(),Co(),$a(e.bundle),eo(e.bundle,{hasReference:!1,note:`Backfed compound running live across Nuclear, RHF QM, Maxwell Photon–Shell Optics, WebGPU MD & Polytope Atlas.`}),za({kind:`compound`,formula:e.bundle.materialKey,label:e.bundle.materialKey}),qo(t),ur.textContent=`${e.bundle.materialKey} · Backfed OK`,$()}async function Go(e,{backfeedAllTabs:t=!1,switchToTab:n=`compound`,previewOnly:r=!1}={}){if(P){r||(Oi=null),ur.textContent=r?`Chemistry preview ${e}…`:`Deriving ${e}…`;try{z=await D(P,e,{runLiveMd:!r,mdSteps:10,mdCellsPerSide:2,reactionContext:{source:`elements-lab-interactive`}}),pa=null,ma=null,W=null;let i=(z?.visualData?.molQm?.atoms||[]).reduce((e,t)=>e+(t.Z<=2?1:t.Z<=10?5:9),0);if(!r&&i>0&&i<=10&&(!t||n===`compound`)?(Mi=await Ho(z),K.nebImageIdx=Mi?Mi.saddleImageIndex:0,await Vo()):(Mi=null,K.nebImageIdx=0),t||(K.chemViewMode=`molecule`),r){I===`compound`&&(Z(),Q()),ur.textContent=`${_(V)} · Chem preview ${e}`,$();return}Ti=Uo(z),Ei=g({crystalStructure:z.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(z.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(z.bundle.nuclear.molarMassU||28)),temperatureK:300});let a=K.polytopeRegime===`planetary`?0xe8d4a51000:1e10;B=await S(P,z.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,a],useSharedPersistentCache:!0}),K.polytopeProbe=null,L=`compound`,Ya(),lo(),po(),yo(),bo(),Co(),$a(z.bundle),eo(z.bundle,{hasReference:!1,note:`Recursive compound feedback bundle (zero hardcoded compound table).`}),za({kind:`compound`,formula:z.bundle.materialKey,label:z.bundle.materialKey}),qo(t?n:`compound`),ur.textContent=`${e} · Compound OK`,$()}catch(e){ur.textContent=`Error: ${e.message}`,console.error(e)}}}async function Ko(e,t){if(!P)return;let n=String(e||``).trim(),r=String(t||``).trim();if(!(!n||!r)){ur.textContent=`Reacting ${n} + ${r}…`;try{let e=await T(P,[n,r],{runLiveMd:!0,mdSteps:10,mdCellsPerSide:2});if(Di=e,!e.derivedProducts.length){sr.innerHTML=`<div class="product-card" style="border-color:rgba(248,113,113,0.45);">No balanced reaction candidate found for <b>${n} + ${r}</b>. Try e.g. Na+H2O, H2+O2, Na+Cl2, Fe+O2, Cs+F2.</div>`,ur.textContent=`No reaction candidate`;return}let t=e.candidates?.[0],i=t?.energetics?.reactionEnthalpyJPerBalancedEquation==null?`derived`:`${Y(t.energetics.reactionEnthalpyJPerBalancedEquation*.001,1)} kJ/mol`,a=`<div class="product-card">
      <div style="font-weight:700;color:#e9d5ff;margin-bottom:3px;">${t?.equation||`${n} + ${r} → ${e.productFormulas.join(` + `)}`}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${t?.familyLabel||`Stoichiometric discovery`} · ΔH = ${i}</div>`;e.derivedProducts.forEach((e,t)=>{let n=e.bundle;a+=`<button class="action backfeed-btn" data-bf-idx="${t}">Backfeed ${n.materialKey} (ρ=${Y(n.mechanical.densityKgPerM3,0)} · T_m=${Y(n.thermodynamic.meltingPointK,0)}K · n=${Y(n.electromagnetic.refractiveIndex550Nm,2)}) → All Sims</button>`}),a+=`</div>`,sr.innerHTML=a;for(let t of sr.querySelectorAll(`[data-bf-idx]`))t.addEventListener(`click`,()=>{let n=e.derivedProducts[Number(t.dataset.bfIdx)];pi(!1),n&&Wo(n,`crystal`)});Oi=[n,r];let o=e.derivedProducts[0];if(cr.value=o.bundle.materialKey,z=o,Ti=Uo(o),Ei=g({crystalStructure:o.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(o.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(o.bundle.nuclear.molarMassU||28)),temperatureK:300}),pa=null,ma=null,W=null,t)try{ur.textContent=`Solving GPU CI-NEB (${t.equation})…`,W=await De(P,{candidate:t,nImages:5,sampleVolumes:!0}),await Oe({closureRegistry:Un,equation:t.equation,pathway:W}).catch(()=>{})}catch{W=null}Mi=W||await Ho(o),K.nebImageIdx=Mi?Mi.saddleImageIndex:0,K.chemViewMode=W?`reaction-path`:`molecule`,await Vo(),wo(),L=`compound`,Ya(),lo(),po(),yo(),bo(),Co(),B=await S(P,o.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2}),$a(o.bundle),eo(o.bundle,{hasReference:!1,note:`Discovered from ${n} + ${r}; click Backfeed to run across all tabs.`}),za({kind:`compound`,formula:o.bundle.materialKey,label:o.bundle.materialKey}),qo(`compound`),ur.textContent=`${n}+${r} → ${e.productFormulas.join(`+`)} OK`,$()}catch(e){ur.textContent=`Reaction err: ${e.message}`,console.error(e)}}}function qo(e){I=e;for(let t of document.querySelectorAll(`.tab-btn`)){let n=t.dataset.tab===e;t.classList.toggle(`active`,n),n&&di()&&t.scrollIntoView?.({behavior:`smooth`,inline:`nearest`,block:`nearest`})}if(Qa(),e===`compound`&&L===`element`&&!Oi){let e=Fa(V);ir&&(ir.value=e.reactA),ar&&(ar.value=e.reactB),cr&&(cr.value=e.formula)}e===`compound`&&!z&&K.chemViewMode!==`reactive-md`&&P&&To(),e===`compound`&&K.chemViewMode===`reactive-md`&&!G&&P&&wo(),Z(),Q(),$()}function $(){let e=ja(),n=L===`compound`;jo(),window.__ulgElementsLabState={mode:n?`compound`:`element`,activeSpecimenKind:L,currentTab:I,chemViewMode:K.chemViewMode,polytopeViewMode:K.polytopeViewMode,rendererBackend:`webgpu`,isMobileProfile:ui,simSpeed:K.simSpeed,dataDockOpen:mi(),camera:{yaw:q,pitch:J,dist:xa},cameraAutoSpin:!1,mdPerFrameCpuPositionReadback:!1,Z:n?null:V,A:n?null:R?.bundle?.nuclear?.A??Pi,isotope:n?null:R?.bundle?.nuclear?.isotope??null,formula:n?z?.bundle?.materialKey??null:null,backfedFormula:n?z?.bundle?.materialKey??null:null,relativisticSpinOrbit:K.relativisticSpinOrbit,functional:K.functional,bundle:e,decayChain:ji,nebBackend:(W||Mi)?.backend??null,nebBarrier:W||Mi,reactionPathway:W?{equation:W.equation,basisUsed:W.basisUsed,imageCount:W.images.length,saddleImageIndex:W.saddleImageIndex,forwardBarrierEv:W.forwardBarrierEv,reactionEnergyEv:W.reactionEnergyEv,gpuRhfCalls:W.gpuRhfCalls,saddleBonds:W.images[W.saddleImageIndex]?.bonds||[]}:null,vibrations:ma?{formula:ma.formula,deuterated:ma.deuterated,totalZpeEv:ma.totalZpeEv,modesCm1:ma.modes.map(e=>e.freqCm1),irIntensities:ma.modes.map(e=>e.irIntensityKmPerMol)}:null,geomOpt:pa?{formula:pa.formula,steps:pa.steps,relaxationEv:pa.relaxationEv,converged:pa.converged}:null,reactiveMdTelemetry:ga,multiSpeciesCrystal:(n?z?.visualData?.multiSpeciesCrystal:ha)?{prototype:(n?z.visualData.multiSpeciesCrystal:ha).prototype,atomCount:(n?z.visualData.multiSpeciesCrystal:ha).atomCount,bondCount:(n?z.visualData.multiSpeciesCrystal:ha).bondCount,speciesLegend:(n?z.visualData.multiSpeciesCrystal:ha).speciesLegend}:null,atlasPolytopeCount:B?.polytopeCount??0,polytopeProbe:K.polytopeProbe,photonTelemetry:Ui,tdks3dTelemetry:Bi,spinTelemetry:ta,transportTelemetry:aa,mdTelemetry:Ji,starkState:fa,deltaScfResult:da?{ionizationEnergyEv:da.ionizationEnergyEv,removedShell:da.removedShell}:null,fissionCurve:la?{fissility:la.fissility,barrierMeV:la.barrierMeV,saddleBeta:la.saddleBeta}:null,batemanCurves:ua?.curves?.length??0,tdseTelemetry:Ki?{stepCount:Ki.stepCount,pInside:Ki.pInside,pTunneled:Ki.pTunneled}:null,orbitalCloudStats:Ii?{pointCount:Ii.pointCount,n:Ii.n,l:Ii.l,m:Ii.m,sourceKind:Ii.sourceKind}:null,registeredModules:de.listModules().map(e=>e.methodKey),closureCount:Vn.size,lastAtlasCacheStatus:B?.cacheStatus||`bypass`,lastAtlasCacheBackend:B?.cacheBackend||null,lastAtlasCacheKey:B?.cacheKey||null,lastAtlasPressureRangePa:B?.pressureRangePa?Array.from(B.pressureRangePa):null,polytopeCacheStats:t().getStats(),g7Advisory:n?null:R?.g7Advisory},window.__ulgElementsLabApi={setTab:e=>qo(e),getPolytopeCacheStats:()=>t().getStats(),clearPolytopeCache:async()=>(await t().clear(),$(),t().getStats()),corruptPolytopeCacheEntryForTest:async(e,n=`{corrupt`)=>{await t().writeRawForTest(e,n)},rebuildPolytopeAtlas:async(e=K.polytopeRegime)=>{let t=await zo(e);return t?{polytopeCount:t.polytopeCount,cacheStatus:t.cacheStatus,cacheBackend:t.cacheBackend,cacheKey:t.cacheKey,pressureRangePa:t.pressureRangePa?Array.from(t.pressureRangePa):null}:null},setSimSpeed:e=>No(e),stepSimOnce:()=>Po(),setDataDockOpen:e=>xi(e),openAboutModal:(e=`sim`)=>vi(e),setHelpMenuOpen:(e=!0)=>gi(e),openPeriodicTableModal:(e=!0,t={})=>Ka(e,t),setChemViewMode:async e=>{K.chemViewMode=e,e===`reactive-md`&&!G&&wo(),e===`vibrations`&&!ma&&await Eo(),qo(`compound`)},setMoleculeStyle:({colorMode:e=null,showDipole:t=null,showOrbitalOverlay:n=null}={})=>{e!=null&&(K.molColorMode=Number(e)),t!=null&&(K.molShowDipole=!!t),n!=null&&(K.molShowOrbitalOverlay=!!n),Z(),Q(),$()},setNebImage:e=>{K.nebImageIdx=Math.max(0,Math.trunc(Number(e)||0)),K.nebPlaying=!1,Z(),Q(),$()},runGeometryOptAndVibrations:(e={})=>Eo(e),stepReactiveMd:async(e=24,{spark:t=0,catalyst:n=null,thermostat:r=null,temperatureK:i=null}={})=>{if(G||wo(),!G)return null;i!=null&&(K.rxMdTempK=i),n!=null&&(K.rxMdCatalyst=!!n),r!=null&&(K.rxMdThermostat=!!r),t>0&&G.igniteSpark(t);let a=await G.stepBatch(e,{temperatureK:K.rxMdTempK,catalyst:K.rxMdCatalyst,thermostat:K.rxMdThermostat,readObs:!0});return a&&(ga=a,_a.push({step:a.stepIndex,fA:a.fracA,fB:a.fracB,fC:a.fracC,fD:a.fracD,T:a.temperatureK})),Q(),$(),a},setPolytopeViewMode:e=>{K.polytopeViewMode=e,Qa(),Z(),Q(),$()},solveElement:(e,t=null,n={})=>(V=e,Pi=t,er.value=String(e),tr&&(tr.value=String(t??l(e))),Bo(e,t,n)),setRelativistic:e=>(K.relativisticSpinOrbit=!!e,Bo(V,Pi,{preserveQuantumNumbers:!0})),setOrbital:(e,t,n)=>{K.n=e,K.l=t,K.m=n,lo(),Z(),Q()},setCrystalViewMode:e=>{K.crystalViewMode=e,Qa(),Z(),Q()},stepTdks:(e=40)=>{if(!zi)return null;for(let t=0;t<e;t+=1)zi.stepFs(.065);return H&&H.stepSync(Math.max(1,Math.min(48,Math.trunc(e)))),Q(),zi.channels.map(e=>({nm:e.wavelengthNm,rho11:e.rho11,dipole:e.dipole,absorbed:e.absorbedEnergy}))},setTdksConfig:({orbitalPreset:e=null,polMode:t=null,fieldView:n=null,modeMono:r=null,probeWavelengthNm:i=null,playing:a=null}={})=>{let o=!1;e!=null&&e!==K.tdksOrbitalPreset&&(K.tdksOrbitalPreset=String(e),o=!0),t!=null&&(K.tdksPolMode=Number(t)||0),n!=null&&(K.tdksFieldView=Number(n)||0),r!=null&&(K.photonModeMono=!!r),i!=null&&(K.probeWavelengthNm=Number(i)||440),a!=null&&(K.photonPlaying=!!a),o&&uo({resetField:!1}),H?.resetPulse({nextProbeWavelengthNm:K.probeWavelengthNm,nextPolMode:K.tdksPolMode,nextModeMono:K.photonModeMono}),Z(),Q(),$()},stepTdks3d:async(e=34)=>{if(!H)return null;let t=await H.stepBatch(e,{readObs:!0});return t&&(Bi=t),Q(),$(),t},setCamera:(e,t,n=null)=>{Number.isFinite(Number(e))&&(q=Number(e)),Number.isFinite(Number(t))&&(J=Number(t)),n!=null&&Number.isFinite(Number(n))&&(xa=Number(n)),Do(),$()},getShareUrl:(e={})=>Ao(e),stepPhotonFdtd:async(e=220)=>{if(!Hi)return null;let t=await Hi.stepBatch(e,{readObs:!0});return t&&(Ui=t),Q(),$(),t},stepTdse:async(e=120)=>{if(!Gi)return null;let t=await Gi.stepBatch(e);return t&&(Ki=t),Q(),$(),t},runReaction:(e,t)=>Ko(e,t),backfeedCompound:(e,t=`crystal`)=>Go(e,{backfeedAllTabs:!0,switchToTab:t}),probePolytope:async(e,t)=>{if(!B||!F)return null;let n=await F.probePolytopeAtlasOnGpu(B,e,t),r=F.getPolytopeAxisBounds(B),i=(Math.log10(Math.max(1,e))-r.minLt)/Math.max(1e-6,r.maxLt-r.minLt),a=(Math.log10(Math.max(1e-6,t))-r.minLp)/Math.max(1e-6,r.maxLp-r.minLp);return K.polytopeProbe={...n,fx:i,fy:a},Q(),$(),n},captureCanvasDataUrl:()=>new Promise(e=>{requestAnimationFrame(()=>{Do(),e(Wn.toDataURL(`image/png`))})}),getCamera:()=>({yaw:q,pitch:J,dist:xa}),setNuclearMode:(e,t=null)=>{K.nuclearViewMode=e,t!=null&&(K.fissionBeta2=Number(t)),e===`fission`&&go(),Qa(),Z(),Q(),$()},setStarkField:e=>(K.starkFieldVPerA=Number(e)||0,_o(),Z(),Q(),$(),fa),triggerDeltaScfIonize:async(e=!0)=>(await vo(e),da?{ionizationEnergyEv:da.ionizationEnergyEv,removedShell:da.removedShell}:null),stepSpinLattice:async(e=48,{temperatureK:t=null,fieldBZTesla:n=null}={})=>{if(ea||yo(),!ea)return null;t!=null&&(K.spinTempK=t),n!=null&&(K.spinFieldBTesla=n);let r=await ea.stepBatch(e,{temperatureK:K.spinTempK,fieldBZTesla:K.spinFieldBTesla,readObs:!0});return r&&(ta=r,na.push({B:r.fieldBZTesla,Mz:r.magnetizationZ,Mmag:r.magnetizationMag,Mstag:r.staggeredOrderMag,T:r.temperatureK})),Q(),$(),r},stepElectronTransport:async(e=32,{temperatureK:t=null,eFieldVPerM:n=null}={})=>{if(ia||bo(t),!ia)return null;t!=null&&(K.transportTempK=t),n!=null&&(K.transportEFieldVPerM=n);let r=await ia.stepBatch(e,{temperatureK:K.transportTempK,eFieldVPerM:K.transportEFieldVPerM,readObs:!0});return r&&(aa=r,oa.push({T:r.temperatureK,drift:r.meanDriftNorm,scatter:r.measuredScatterRateFrac,sigma:r.sigmaGpuSPerM})),Q(),$(),r},setMdMode:(e,t=null,n={})=>{n?.chamberMode&&(K.mdChamberMode=n.chamberMode);let r=n?.colorMode!=null;r&&(K.mdColorMode=Number(n.colorMode)||0),n?.sizePreset&&(K.mdSizePreset=n.sizePreset),n?.gravity!=null&&(K.mdGravity=!!n.gravity),Co(t,e,{preserveColorMode:r}),Qa(),Z(),Q(),$()},setMdGravity:(e,t={})=>{K.mdGravity=!!e;let n=U?.setGravity?.(K.mdGravity,t)||{enabled:K.mdGravity};return Z(),Q(),$(),n},setMdPhasePreset:e=>{let t=ja(),n=So($i?.meltingPointK||t?.thermodynamic?.meltingPointK||600,$i?.boilingPointK||t?.thermodynamic?.boilingPointK||1500,$i?.potentialModel??1),r=e===`solid`?n.tSolid:e===`melt`?n.tMeltLiquid:n.tVapor;return K.mdPhasePreset=e,K.mdTargetTempK=r,U?.resetMsdOrigin?.(),Yi=[],Xi=[],Z(),Q(),$(),{phase:e,targetTempK:r,...n}},stepMd:async(e=16,{strainX:t=0,shearXY:n=0,pulse:r=null,npt:i=!1,temperatureK:a=null}={})=>{if(!U)return null;a!=null&&(K.mdTargetTempK=Number(a)),(t||n)&&U.applyStrain({strainX:t,shearXY:n}),r&&U.injectAcousticPulse({polarization:r,amplitude:.4});let o=await U.stepBatch(e,{readTelemetry:!0,temperatureK:K.mdTargetTempK,nptBarostatGPa:i?0:null});return o&&(Ji=o,Yi.push({t:o.timeFs,T:o.temperatureK,msd:o.msdA2}),Xi.push(o.vacf??0),K.mdMode===`strain`&&Zi.push({eps:o.strainX||0,pxx:o.diagPressureGPa?.[0]??o.pressureGPa})),Q(),$(),o}}}async function Jo(){if(Ja(),Wa(),gr?.addEventListener(`click`,()=>{gi(!1),pi(!document.body.classList.contains(`drawer-open`))}),_r?.addEventListener(`click`,()=>pi(!1)),vr?.addEventListener(`click`,()=>{gi(!1),xi(!mi())}),yr?.addEventListener(`click`,()=>xi(!0)),br?.addEventListener(`click`,()=>xi(!1)),xr?.addEventListener(`click`,()=>{pi(!1),di()&&xi(!1)}),Sr?.addEventListener(`click`,e=>{e.stopPropagation(),gi(!Cr?.classList.contains(`open`))}),document.addEventListener(`click`,e=>{Cr?.classList.contains(`open`)&&!Cr.contains(e.target)&&e.target!==Sr&&gi(!1)}),wr?.addEventListener(`click`,()=>vi(`sim`)),Tr?.addEventListener(`click`,()=>vi(`ulg`)),Pr?.addEventListener(`click`,()=>vi(`sim`)),Mr?.addEventListener(`click`,()=>_i(`sim`)),Nr?.addEventListener(`click`,()=>_i(`ulg`)),jr?.addEventListener(`click`,()=>yi()),Or?.addEventListener(`click`,e=>{e.target===Or&&yi()}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&(gi(!1),yi(),Ka(!1),pi(!1),di()&&xi(!1))}),hi(),bi(),Ir?.addEventListener(`input`,e=>No(Number(e.target.value))),Rr?.addEventListener(`click`,()=>Po()),zr)for(let e of zr.querySelectorAll(`[data-speed-preset]`))e.addEventListener(`click`,()=>No(Number(e.dataset.speedPreset)));Wr?.addEventListener(`click`,()=>window.location.reload());for(let e of document.querySelectorAll(`.tab-btn`))e.addEventListener(`click`,()=>qo(e.dataset.tab));for(let e of document.querySelectorAll(`#hero-presets [data-hero-z], #mobile-quick-presets [data-hero-z]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.heroZ),n=e.dataset.heroA?Number(e.dataset.heroA):null,r=e.dataset.heroTab||null,i=e.dataset.heroCview||null;V=t,Pi=n,er.value=String(t),tr&&(tr.value=String(n??l(t))),r===`crystal`&&(K.crystalViewMode=i||`photon-shell`),r===`nuclear`&&t>=90&&(K.nuclearViewMode=`fission`,K.fissionBeta2=.72),pi(!1),Bo(t,n,{switchToTab:r})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-compound], #mobile-quick-presets [data-hero-compound]`))e.addEventListener(`click`,()=>{let t=e.dataset.heroCompound,n=e.dataset.heroTab||`crystal`,r=e.dataset.heroCview||null,i=e.dataset.heroChem||null;cr.value=t,n===`crystal`&&(K.crystalViewMode=r||`photon-shell`),n===`compound`&&i&&(K.chemViewMode=i),pi(!1),Go(t,{backfeedAllTabs:!0,switchToTab:n})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-react], #mobile-quick-presets [data-hero-react]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.heroReact.split(`|`);ir&&(ir.value=t),ar&&(ar.value=n),pi(!1),Ko(t,n)});for(let e of document.querySelectorAll(`#reaction-presets [data-rxn]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.rxn.split(`|`);ir&&(ir.value=t),ar&&(ar.value=n),pi(!1),Ko(t,n)});rr.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(er.value)||26))),t=tr?.value?.trim(),n=t?Math.trunc(Number(t)):null;V=e,Pi=n&&n>=e&&n<=310?n:null,pi(!1),Bo(e,Pi)}),nr?.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(er.value)||V)));V=e,Pi=null,tr&&(tr.value=String(l(e))),pi(!1),Bo(e,null)}),or?.addEventListener(`click`,()=>{pi(!1),Ko(ir?.value,ar?.value)}),lr.addEventListener(`click`,()=>{pi(!1),Go(cr.value||`H2O`)}),Zn.style.cursor=`crosshair`,Zn.addEventListener(`click`,e=>{if(I!==`nuclear`||!R?.visualData?.nuclear?.chartDims)return;let t=Zn.getBoundingClientRect(),n=(e.clientX-t.left)/Math.max(1,t.width)*Zn.width,r=(e.clientY-t.top)/Math.max(1,t.height)*Zn.height,{maxZ:i,maxN:a}=R.visualData.nuclear.chartDims,o=Math.round((n-12)/Math.max(1,Zn.width-24)*a),s=Math.round((Zn.height-12-r)/Math.max(1,Zn.height-24)*i);s>=1&&s<=i&&o>=0&&o<a&&(V=s,Pi=s+o,er.value=String(V),tr&&(tr.value=String(Pi)),Bo(V,Pi))});let e=null;if(!navigator.gpu){ur.textContent=`WebGPU unavailable (fail-closed)`,Si(`WebGPU Not Supported in This Browser`,`ULG Material Physics Lab runs live Dirac–KS, TD-KS, 2D Maxwell–FDTD, MD, and Polytope compute shaders on WebGPU. Use Chrome 121+ on Android/Desktop or Safari 26+ on iOS/macOS over HTTPS.`);return}for(let t=0;t<8&&!e;t+=1){try{e=await navigator.gpu.requestAdapter(t<4?{powerPreference:`high-performance`}:void 0)}catch{e=null}e||await new Promise(e=>setTimeout(e,200))}if(!e){ur.textContent=`WebGPU adapter unavailable`,Si(`WebGPU GPU Adapter Unavailable`,`Your browser exposes navigator.gpu, but no compatible WebGPU hardware adapter was returned. Ensure hardware acceleration / WebGPU is enabled in browser settings and retry.`);return}try{P=await e.requestDevice()}catch(e){ur.textContent=`WebGPU device error`,Si(`WebGPU Device Initialization Failed`,e?.message||String(e));return}Ci(),P.addEventListener(`uncapturederror`,e=>console.error(`WebGPU error:`,e.error?.message||String(e.error))),P.lost?.then(e=>{ur.textContent=`WebGPU context lost`,Si(`WebGPU Context Paused / Lost`,`Mobile OS or GPU driver reclaimed the WebGPU device (${e?.reason||`unknown`}). Tap below to restore live GPU simulations.`)}),F=In(P,Wn);let t=null,n=()=>{di()||(pi(!1),document.body.classList.remove(`data-dock-open`),fi()),hi(),t&&clearTimeout(t),t=setTimeout(()=>{t=null,Q()},60)};typeof ResizeObserver==`function`&&Wn.parentElement&&new ResizeObserver(n).observe(Wn.parentElement),window.addEventListener(`resize`,n,{passive:!0}),window.addEventListener(`orientationchange`,n,{passive:!0}),document.addEventListener(`visibilitychange`,()=>{document.hidden||(Q(),Lo())}),ri?.addEventListener(`click`,async()=>{let e=Ao({includeCamera:!0});try{window.history?.replaceState?.(null,``,e),Ai=new URL(e).search}catch{}let t=!1;try{navigator.clipboard?.writeText&&(await navigator.clipboard.writeText(e),t=!0)}catch{}if(!t)try{let n=document.createElement(`textarea`);n.value=e,n.style.position=`fixed`,n.style.opacity=`0`,document.body.appendChild(n),n.select(),t=document.execCommand(`copy`),n.remove()}catch{}if(ri){let e=ri.textContent;ri.textContent=t?`✓ Link Copied!`:`✓ URL Updated`,setTimeout(()=>{ri.textContent=e||`🔗 Share Link`},1800)}});let r=Dt(window.location.search);if(r.functional&&(K.functional=r.functional),r.relativisticSpinOrbit!=null&&(K.relativisticSpinOrbit=r.relativisticSpinOrbit),r.tdksOrbitalPreset&&(K.tdksOrbitalPreset=r.tdksOrbitalPreset),r.tdksPolMode!=null&&(K.tdksPolMode=r.tdksPolMode),r.tdksFieldView!=null&&(K.tdksFieldView=r.tdksFieldView),r.probeWavelengthNm!=null&&(K.probeWavelengthNm=r.probeWavelengthNm),r.photonModeMono!=null&&(K.photonModeMono=r.photonModeMono),r.fissionBeta2!=null&&(K.fissionBeta2=r.fissionBeta2),r.molColorMode!=null&&(K.molColorMode=r.molColorMode),r.molShowOrbitalOverlay!=null&&(K.molShowOrbitalOverlay=r.molShowOrbitalOverlay),r.vibDeuterated!=null&&(K.vibIsotopeDeuterated=r.vibDeuterated),r.polytopeRegime&&(K.polytopeRegime=r.polytopeRegime),r.simSpeed!=null&&No(r.simSpeed),r.mdGravity!=null&&(K.mdGravity=!!r.mdGravity),r.hasExplicitQuantumNumbers&&(r.n!=null&&(K.n=r.n),r.l!=null&&(K.l=Math.min(K.n-1,r.l)),r.m!=null&&(K.m=Math.max(-K.l,Math.min(K.l,r.m)))),r.tab&&(I=r.tab),r.view){let e=r.tab||`nuclear`;e===`nuclear`?K.nuclearViewMode=r.view:e===`atomic`?K.atomicViewMode=r.view:e===`crystal`?K.crystalViewMode=r.view:e===`md`?K.mdMode=r.view:e===`compound`?K.chemViewMode=r.view:e===`polytope`&&(K.polytopeViewMode=r.view)}if(Qa(),Z(),r.camera&&(q=r.camera.yaw,J=r.camera.pitch,r.camera.dist!=null&&(xa=r.camera.dist)),r.specimenKind===`reaction`&&r.reactants){let[e,t]=r.reactants;ir&&(ir.value=e),ar&&(ar.value=t),await Ko(e,t),r.tab===`compound`&&r.view?(K.chemViewMode=r.view,r.view===`reactive-md`?(r.tempK!=null&&(K.rxMdTempK=r.tempK),wo()):r.view===`vibrations`&&await Eo({deuterated:K.vibIsotopeDeuterated}),qo(`compound`)):r.tab&&r.tab!==`compound`&&qo(r.tab)}else if(r.specimenKind===`compound`&&r.formula){cr&&(cr.value=r.formula);let e=r.tab||`compound`;await Go(r.formula,{backfeedAllTabs:!0,switchToTab:e}),e===`compound`&&r.view?(K.chemViewMode=r.view,r.view===`vibrations`?await Eo({deuterated:K.vibIsotopeDeuterated}):r.view===`reactive-md`&&(r.tempK!=null&&(K.rxMdTempK=r.tempK),wo()),qo(`compound`)):e===`md`&&r.tempK!=null?(Co(r.tempK,r.view||K.mdMode),qo(`md`)):e===`crystal`&&r.view===`transport`&&r.tempK!=null?(bo(r.tempK),qo(`crystal`)):e===`crystal`&&r.view===`spin-llg`&&r.tempK!=null&&(K.spinTempK=r.tempK,qo(`crystal`))}else V=r.Z,Pi=r.A,er.value=String(V),tr&&(tr.value=String(Pi??l(V))),ki=!1,await Bo(V,Pi,{preserveQuantumNumbers:r.hasExplicitQuantumNumbers,switchToTab:r.tab||null}),r.tab===`nuclear`&&r.view===`fission`?(go(),Q()):r.tab===`md`&&r.tempK!=null?(Co(r.tempK,r.view||K.mdMode),Q()):r.tab===`crystal`&&r.view===`transport`&&r.tempK!=null?(bo(r.tempK),Q()):r.tab===`crystal`&&r.view===`spin-llg`&&r.tempK!=null&&(K.spinTempK=r.tempK,Q());ki=!1,jo({force:!0}),$(),Lo()}Jo();