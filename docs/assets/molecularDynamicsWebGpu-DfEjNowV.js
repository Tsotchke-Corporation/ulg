import{$i as e,B as t,C as n,Ct as r,Dn as i,E as a,En as o,F as s,I as c,O as l,Ol as u,On as d,Qi as f,R as p,St as m,T as h,Tn as g,V as _,_ as v,da as y,ia as b,sa as x,t as S,w as C,wn as w,z as T}from"./batchedSymmetricEigensolverGpu-CwW0-2_Q.js";import{attachWebGpuUncapturedErrorTelemetry as E,residentSphWebGpuFeaturesForAdapter as D,residentSphWebGpuLimitsForAdapter as O,webGpuDeviceDescriptorForResidentSph as k}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as A,createCachedExplicitComputePipeline as j,createExplicitComputePipeline as M,deferSubmittedWorkCleanup as N,unwrapWebGpuCacheDevice as P}from"../runtime/webgpuComputeLayout.js";function ee(e,t){return function(n){e.info=n,typeof t==`function`&&t(n)}}var te=new WeakMap;function F(e){return typeof WeakRef==`function`?new WeakRef(e):{deref:()=>e}}var ne=256;function re(e,t,n){if(!e||typeof e!=`object`)return;e.info=t;let r=e.notify;if(typeof r==`function`)try{r(t)}catch(e){if(!n)return;queueMicrotask(()=>{try{r(e)}catch{}})}}function ie(e,t,n=null){if(!e?.lost?.then||!t||typeof t!=`object`)return!1;typeof n==`function`&&Object.defineProperty(t,"notify",{value:n,writable:!0,configurable:!0,enumerable:!1});let r=te.get(e);if(!r){r={watchers:new Set,lost:!1,lostInfo:null,lostFulfilled:!0,nextPruneSize:ne},te.set(e,r);let t=e=>t=>{r.lost=!0,r.lostInfo=t,r.lostFulfilled=e;let n=[...r.watchers];r.watchers.clear();for(let r of n)re(r.deref(),t,e)};Promise.resolve(e.lost).then(t(!0),t(!1))}if(r.lost)return queueMicrotask(()=>re(t,r.lostInfo,r.lostFulfilled)),!0;if(r.watchers.add(F(t)),r.watchers.size>r.nextPruneSize){for(let e of r.watchers)e.deref()||r.watchers.delete(e);r.nextPruneSize=Math.max(ne,r.watchers.size*2)}return!0}var I=new WeakMap;function ae(e,t,n){if(!e?.lost?.then||!t||typeof t!=`object`||typeof n!=`function`)return!1;let r=F(t),i={info:null};Object.defineProperty(i,"notify",{value:e=>{let t=r.deref();t&&n(t,e)},writable:!0,configurable:!0,enumerable:!1});let a=I.get(t);return a||(a=[],I.set(t,a)),a.push(i),ie(e,i)}var oe=`peercompute.ulg.material-property-bank.warm-input.v0`,L=`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`,se=`peercompute.ulg.material-property-bank.particle-size-packing-table.v0`,R=Object.freeze([`materialId:f32`,`atomicNumber:f32`,`temperatureK:f32`,`pressurePa:f32`,`targetNeighborCount:f32`,`phaseCount:f32`,`baseColorSrgbR:f32`,`baseColorSrgbG:f32`,`baseColorSrgbB:f32`,`metalness:f32`,`roughness:f32`,`ior:f32`,`strictSourceOfTruth:f32`,`status:f32`,`pad0:f32`,`pad1:f32`]),z=Object.freeze([`roleId:f32`,`materialId:f32`,`temperatureK:f32`,`pressurePa:f32`,`particlesPerEdge:f32`,`spacingM:f32`,`volumeEquivalentParticleRadiusM:f32`,`restVolumeM3:f32`,`densityKgPerM3:f32`,`targetNeighborCount:f32`,`smoothingLengthM:f32`,`strictSourceOfTruth:f32`,`status:f32`,`crystalPackingFraction:f32`,`crystalCoordinationNumber:f32`,`crystalAtomsPerConventionalCell:f32`]),ce=Object.freeze({ready:1,missingRoleWarmInput:255}),B=Object.freeze({drop:1,base:2}),le=new Set([`precomputed-json-bank`,`reference-fallback`,`reduced-estimate`,`exact-constant`]);function V(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function H(e){return JSON.parse(JSON.stringify(e))}function ue(e){let t=e?.roles||{};return Object.entries(t).filter(([,e])=>e?.schema===oe).sort(([e],[t])=>String(e).localeCompare(String(t)))}function U(){return{schema:L,status:`material-bank-gpu-warm-input-table-empty`,rowLayout:[...R],rowStrideFloats:R.length,rowStrideBytes:R.length*Float32Array.BYTES_PER_ELEMENT,rows:new Float32Array,rowCount:0,metadata:[],strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function de(){return{schema:se,status:`material-bank-particle-size-packing-empty`,rowLayout:[...z],rowStrideFloats:z.length,rowStrideBytes:z.length*Float32Array.BYTES_PER_ELEMENT,rows:new Float32Array,rowCount:0,metadata:[],strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function fe(e){if(typeof e!=`string`)return null;let t=e.trim();return/^[A-Za-z]{1,3}$/.test(t)?`${t[0].toUpperCase()}${t.slice(1).toLowerCase()}`:t||null}function pe(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element.v0`)throw TypeError(`material property bank record has an unknown schema`);if(!Number.isInteger(e.atomicNumber)||e.atomicNumber<1||e.atomicNumber>118)throw RangeError(`material property bank record has invalid atomic number: ${e.atomicNumber}`);if(!Array.isArray(e.phases)||e.phases.length===0)throw Error(`${e.symbol||`element`} material property bank record has no phases`);if(!Array.isArray(e.provenance)||e.provenance.length===0)throw Error(`${e.symbol||`element`} material property bank record has no provenance`);for(let t of e.provenance){if(!le.has(t.status))throw Error(`${e.symbol} material property bank provenance has unknown status: ${t.status}`);for(let n of[`family`,`source`,`method`,`units`,`referenceState`])if(typeof t[n]!=`string`||t[n].length===0)throw Error(`${e.symbol} material property bank provenance missing ${n}`)}return!0}function me(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element-crystal-structure.v0`)throw TypeError(`material crystal structure record has an unknown schema`);if(fe(e.symbol)!==e.symbol)throw Error(`material crystal structure record has invalid symbol: ${e.symbol}`);if(e.phase!==`solid`)throw Error(`${e.symbol} material crystal structure has unsupported phase: ${e.phase}`);if(typeof e.structureKey!=`string`||e.structureKey.length===0)throw Error(`${e.symbol} material crystal structure has no structureKey`);let t=e.latticeConstants||{};for(let n of[`aAngstrom`,`bAngstrom`,`cAngstrom`,`alphaDeg`,`betaDeg`,`gammaDeg`])if(!Number.isFinite(Number(t[n]))||Number(t[n])<=0)throw Error(`${e.symbol} material crystal structure has invalid lattice constant ${n}`);let n=e.unitCell||{};for(let t of[`atomsPerConventionalCell`,`densityKgPerM3`])if(!Number.isFinite(Number(n[t]))||Number(n[t])<=0)throw Error(`${e.symbol} material crystal structure has invalid unit-cell ${t}`);if(!Number.isFinite(Number(n.packingFraction))||n.packingFraction<=0||n.packingFraction>1)throw Error(`${e.symbol} material crystal structure has invalid packingFraction`);let r=e.validity||{};for(let t of[`temperatureRangeK`,`pressureRangePa`]){let n=r[t];if(!Array.isArray(n)||n.length!==2||!n.every(e=>Number.isFinite(Number(e))))throw Error(`${e.symbol} material crystal structure has invalid ${t}`);if(Number(n[0])>Number(n[1]))throw Error(`${e.symbol} material crystal structure has descending ${t}`)}if(!Array.isArray(e.provenance)||e.provenance.length===0)throw Error(`${e.symbol} material crystal structure has no provenance`);for(let t of e.provenance){if(!le.has(t.status))throw Error(`${e.symbol} material crystal structure provenance has unknown status: ${t.status}`);for(let n of[`family`,`source`,`method`,`units`,`referenceState`])if(typeof t[n]!=`string`||t[n].length===0)throw Error(`${e.symbol} material crystal structure provenance missing ${n}`)}return!0}function he(e){if(e?.schema!==`peercompute.ulg.material-property-bank.elements.v0`)throw TypeError(`material property bank has an unknown schema`);if(!Number.isInteger(e.schemaVersion))throw RangeError(`material property bank schemaVersion must be an integer`);if(e.schemaVersion!==1)throw RangeError(`unsupported material property bank schemaVersion: ${e.schemaVersion}`);let t=(e.records||[]).map(e=>(pe(e),H(e))),n=new Map,r=new Map;for(let e of t){if(n.has(e.symbol))throw Error(`duplicate material property bank symbol: ${e.symbol}`);if(r.has(e.atomicNumber))throw Error(`duplicate material property bank atomic number: ${e.atomicNumber}`);n.set(e.symbol,e),r.set(e.atomicNumber,e)}return{schema:e.schema,schemaVersion:e.schemaVersion,bankFamily:e.bankFamily,generatorFingerprint:e.generatorFingerprint,generatedAt:e.generatedAt||null,recordCount:t.length,records:t,bySymbol:n,byAtomicNumber:r,strictSourceOfTruth:!1,provenanceMode:`precomputed-json-bank-warm-input`}}function ge(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element-crystal-structures.v0`)throw TypeError(`material crystal structure bank has an unknown schema`);if(!Number.isInteger(e.schemaVersion))throw RangeError(`material crystal structure bank schemaVersion must be an integer`);if(e.schemaVersion!==1)throw RangeError(`unsupported material crystal structure bank schemaVersion: ${e.schemaVersion}`);let t=(e.records||[]).map(e=>(me(e),H(e))),n=new Map,r=new Map;for(let e of t){if(r.has(e.structureKey))throw Error(`duplicate material crystal structure key: ${e.structureKey}`);let t=fe(e.symbol),i=n.get(t)||[];i.push(e),n.set(t,i),r.set(e.structureKey,e)}for(let e of n.values())e.sort((e,t)=>String(e.structureKey).localeCompare(String(t.structureKey)));return{schema:e.schema,schemaVersion:e.schemaVersion,bankFamily:e.bankFamily,generatorFingerprint:e.generatorFingerprint,generatedAt:e.generatedAt||null,recordCount:t.length,records:t,bySymbol:n,byStructureKey:r,strictSourceOfTruth:!1,provenanceMode:`precomputed-json-bank-crystal-warm-input`}}function _e(e,t){let n=e?.bySymbol instanceof Map?e:he(e);return n.bySymbol.get(t)||n.bySymbol.get(fe(t))||null}function ve(e,t,{phase:n=null}={}){let r=(e?.bySymbol instanceof Map&&e?.byStructureKey instanceof Map?e:ge(e)).bySymbol.get(fe(t))||[];return n?r.filter(e=>e.phase===n):r}function ye(e,{temperatureK:t=e?.referenceState?.temperatureK,pressurePa:n=e?.referenceState?.pressurePa,bankFamily:r=null,bankSchemaVersion:i=null,generatorFingerprint:a=null}={}){return pe(e),{schema:oe,status:`material-property-bank-warm-input-ready`,strictSourceOfTruth:!1,material:e.symbol,atomicNumber:e.atomicNumber,schemaVersion:1,bankFamily:r,bankSchemaVersion:i,bankRecordSchema:e.schema,temperatureK:V(t,e.referenceState.temperatureK),pressurePa:V(n,e.referenceState.pressurePa),phaseCount:e.phases.length,targetNeighborCount:e.mechanics.targetNeighborCount,spacingPolicy:e.mechanics.spacingPolicy||null,pbr:H(e.opticalPbr),provenance:{source:`precomputed-json-bank`,generatorFingerprint:a,entries:H(e.provenance)}}}function be(e){if(e?.identityMode===`initial-bodies`||Array.isArray(e?.bodies))return De({initialBodies:e.bodies,materialPropertyBankWarmInputs:e});let t=ue(e);if(t.length===0)return U();let n=[],r=[];for(let[e,i]of t){let t=i.pbr||{},a=Array.isArray(t.baseColorSrgb)?t.baseColorSrgb:[0,0,0];n.push(V(i.atomicNumber),V(i.atomicNumber),V(i.temperatureK),V(i.pressurePa),V(i.targetNeighborCount),V(i.phaseCount),V(a[0]),V(a[1]),V(a[2]),V(t.metalness),V(t.roughness),t.ior==null?1:V(t.ior,1),+(i.strictSourceOfTruth===!0),ce.ready,0,0),r.push({role:e,material:i.material,requestedMaterial:i.requestedMaterial??null,materialId:i.atomicNumber,atomicNumber:i.atomicNumber,temperatureK:i.temperatureK,pressurePa:i.pressurePa,targetNeighborCount:i.targetNeighborCount,spacingPolicy:i.spacingPolicy??null,bankFamily:i.bankFamily??null,bankSchemaVersion:i.bankSchemaVersion??null,generatorFingerprint:i.provenance?.generatorFingerprint??null,strictSourceOfTruth:!1,status:`ready`})}return{schema:L,status:`material-bank-gpu-warm-input-table-ready`,rowLayout:[...R],rowStrideFloats:R.length,rowStrideBytes:R.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(n),rowCount:n.length/R.length,metadata:r,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function xe(e){if(Array.isArray(e?.bodies))return Oe({initialParticleSpacing:e});let t=e?.materialPropertyBankWarmInputs,n=ue(t);if(n.length===0)return de();let r=[],i=[],a=e?.materialPropertyCrystalStructureWarmInputs?.roles||{};for(let[t,o]of n){let n=e?.[t]||{},s=a[t]||null,c=s?.unitCell||{};r.push(B[t]??0,V(o.atomicNumber),V(o.temperatureK),V(o.pressurePa),V(n.particlesPerEdge),V(n.spacingM),V(n.volumeEquivalentParticleRadiusM),V(n.restVolumeM3),V(n.densityKgPerM3),V(o.targetNeighborCount),V(e?.smoothingLengthM),+(o.strictSourceOfTruth===!0),ce.ready,V(c.packingFraction),V(c.coordinationNumber),V(c.atomsPerConventionalCell)),i.push({role:t,roleId:B[t]??0,material:o.material,requestedMaterial:o.requestedMaterial??null,materialId:o.atomicNumber,particlesPerEdge:V(n.particlesPerEdge),spacingM:V(n.spacingM),volumeEquivalentParticleRadiusM:V(n.volumeEquivalentParticleRadiusM),restVolumeM3:V(n.restVolumeM3),densityKgPerM3:V(n.densityKgPerM3),targetNeighborCount:o.targetNeighborCount,smoothingLengthM:V(e?.smoothingLengthM),crystalStructureKey:s?.structureKey??null,crystalStructureStatus:s?.status??null,crystalPackingFraction:V(c.packingFraction),crystalCoordinationNumber:V(c.coordinationNumber),crystalAtomsPerConventionalCell:V(c.atomsPerConventionalCell),strictSourceOfTruth:!1,status:`ready`})}return{schema:se,status:`material-bank-particle-size-packing-ready`,rowLayout:[...z],rowStrideFloats:z.length,rowStrideBytes:z.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(r),rowCount:r.length/z.length,metadata:i,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Se(e,t=null){let n=Array.isArray(e)?e:Array.isArray(e?.bodies)?e.bodies:Array.isArray(t?.bodies)?t.bodies:[],r=new Set,i=new Set;return n.map((e,t)=>{let n=String(e?.id??e?.bodyId??``).trim(),a=Math.round(V(e?.domainId,0));if(!n)throw TypeError(`initial body at index ${t} has no stable id`);if(!(a>0))throw RangeError(`initial body '${n}' has no positive domain id`);if(r.has(n))throw Error(`initial body id '${n}' is duplicated`);if(i.has(a))throw Error(`initial body domain id '${a}' is duplicated`);return r.add(n),i.add(a),{...e,id:n,domainId:a,bodyOrder:t,role:e?.legacyRole||n}})}function Ce(e){let t=e?.byBodyId;return t instanceof Map?t:t&&typeof t==`object`?new Map(Object.entries(t)):new Map((e?.bodies||[]).map(e=>[String(e?.bodyId??e?.id??``).trim(),e]))}function we(e,t){let n=e?.byBodyId;if(n instanceof Map&&n.has(t.id))return n.get(t.id);if(n&&typeof n==`object`&&n[t.id])return n[t.id];if(Array.isArray(e?.bodies)){let n=e.bodies.find(e=>String(e?.bodyId??e?.id??``).trim()===t.id);if(n)return n.warmInput??n}let r=e?.roles;return r&&typeof r==`object`?r[t.id]??r[`body:${t.id}`]??(t.legacyRole?r[t.legacyRole]:null)??null:null}function Te({body:e,plan:t,warmInputs:n}){let r=t?.materialPropertyBankWarmInput??we(n,e)??null;return r?.schema===`peercompute.ulg.material-property-bank.warm-input.v0`?r:null}function W({body:e,plan:t,crystalWarmInputs:n}){return t?.materialPropertyCrystalStructureWarmInput??we(n,e)??null}function Ee(e){if(!Array.isArray(e)||e.length!==3)return V(e,0);let t=e.reduce((e,t)=>e*Math.max(0,V(t,0)),1);return t>0?Math.cbrt(t):0}function De({initialBodies:e=null,initialParticleSpacing:t=null,materialPropertyBankWarmInputs:n=t?.materialPropertyBankWarmInputs??null}={}){let r=Se(e,t),i=Ce(t),a=r.map(e=>({body:e,warmInput:Te({body:e,plan:i.get(e.id),warmInputs:n})})).filter(e=>e.warmInput);if(a.length===0)return U();let o=[],s=[];for(let{body:e,warmInput:t}of a){let n=t.pbr||{},r=Array.isArray(n.baseColorSrgb)?n.baseColorSrgb:[0,0,0];o.push(V(t.atomicNumber),V(t.atomicNumber),V(t.temperatureK),V(t.pressurePa),V(t.targetNeighborCount),V(t.phaseCount),V(r[0]),V(r[1]),V(r[2]),V(n.metalness),V(n.roughness),n.ior==null?1:V(n.ior,1),+(t.strictSourceOfTruth===!0),ce.ready,0,0),s.push({role:e.role,bodyId:e.id,domainId:e.domainId,bodyOrder:e.bodyOrder,material:t.material,requestedMaterial:t.requestedMaterial??e.material??null,materialId:t.atomicNumber,atomicNumber:t.atomicNumber,temperatureK:t.temperatureK,pressurePa:t.pressurePa,targetNeighborCount:t.targetNeighborCount,spacingPolicy:t.spacingPolicy??null,bankFamily:t.bankFamily??null,bankSchemaVersion:t.bankSchemaVersion??null,generatorFingerprint:t.provenance?.generatorFingerprint??null,identityAuthority:`initial-body-domain-id`,strictSourceOfTruth:!1,status:`ready`})}return{schema:L,status:`material-bank-gpu-warm-input-table-ready`,rowLayout:[...R],rowStrideFloats:R.length,rowStrideBytes:R.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(o),rowCount:o.length/R.length,metadata:s,identityMode:`initial-bodies`,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Oe({initialBodies:e=null,initialParticleSpacing:t=null,materialPropertyBankWarmInputs:n=t?.materialPropertyBankWarmInputs??null,materialPropertyCrystalStructureWarmInputs:r=t?.materialPropertyCrystalStructureWarmInputs??null}={}){let i=Se(e,t),a=Ce(t),o=i.map(e=>{let t=a.get(e.id);if(!t)throw Error(`initial body '${e.id}' has no particle plan`);return{body:e,plan:t,warmInput:Te({body:e,plan:t,warmInputs:n}),crystalWarmInput:W({body:e,plan:t,crystalWarmInputs:r})}}).filter(e=>e.warmInput);if(o.length===0)return de();let s=[],c=[];for(let{body:e,plan:n,warmInput:r,crystalWarmInput:i}of o){let a=i?.unitCell||{},o=Array.isArray(n.particlesPerEdge)?n.particlesPerEdge.map(e=>Math.max(0,Math.round(V(e,0)))):[V(n.particlesPerEdge,0)],l=Array.isArray(n.spacingByAxisM)?n.spacingByAxisM.map(e=>V(e,0)):[],u=V(n.representativeCellPitchM??n.spacingM,0),d=V(n.volumeEquivalentParticleRadiusM??n.visualParticleRadiusM,0),f=V(n.targetNeighborCount,V(r.targetNeighborCount,0)),p=V(t?.smoothingLengthM,V(n.targetSmoothingLengthM,0));s.push(e.domainId,V(r.atomicNumber),V(r.temperatureK,n.temperatureK),V(r.pressurePa,n.pressurePa),Ee(o),u,d,V(n.restVolumeM3??n.visualRestVolumeM3),V(n.densityKgPerM3),f,p,+(r.strictSourceOfTruth===!0),ce.ready,V(a.packingFraction),V(a.coordinationNumber),V(a.atomsPerConventionalCell)),c.push({role:e.role,roleId:e.domainId,bodyId:e.id,domainId:e.domainId,bodyOrder:e.bodyOrder,material:r.material,requestedMaterial:r.requestedMaterial??e.material??null,materialId:r.atomicNumber,particlesPerEdge:o,representativeParticlesPerEdge:Ee(o),particleCount:V(n.particleCount),spacingM:u,spacingByAxisM:l,volumeEquivalentParticleRadiusM:d,restVolumeM3:V(n.restVolumeM3??n.visualRestVolumeM3),mechanicsRestVolumeM3:V(n.mechanicsRestVolumeM3,n.continuumCellVolumeM3),densityKgPerM3:V(n.densityKgPerM3),targetNeighborCount:f,smoothingLengthM:p,crystalStructureKey:i?.structureKey??null,crystalStructureStatus:i?.status??null,crystalPackingFraction:V(a.packingFraction),crystalCoordinationNumber:V(a.coordinationNumber),crystalAtomsPerConventionalCell:V(a.atomsPerConventionalCell),identityAuthority:`initial-body-domain-id`,strictSourceOfTruth:!1,status:`ready`})}return{schema:se,status:`material-bank-particle-size-packing-ready`,rowLayout:[...z],rowStrideFloats:z.length,rowStrideBytes:z.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(s),rowCount:s.length/z.length,metadata:c,identityMode:`initial-bodies`,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function ke(e,t){let n=e.map(e=>e.slice()),r=Array.from({length:t},(e,n)=>Array.from({length:t},(e,t)=>+(n===t)));for(let e=0;e<100;e+=1){let e=0;for(let r=0;r<t;r+=1)for(let i=r+1;i<t;i+=1)e+=n[r][i]*n[r][i];if(e<1e-22)break;for(let e=0;e<t;e+=1)for(let i=e+1;i<t;i+=1){if(Math.abs(n[e][i])<1e-18)continue;let a=(n[i][i]-n[e][e])/(2*n[e][i]),o=Math.sign(a||1)/(Math.abs(a)+Math.sqrt(a*a+1)),s=1/Math.sqrt(o*o+1),c=o*s;for(let r=0;r<t;r+=1){let t=n[r][e],a=n[r][i];n[r][e]=s*t-c*a,n[r][i]=c*t+s*a}for(let r=0;r<t;r+=1){let t=n[e][r],a=n[i][r];n[e][r]=s*t-c*a,n[i][r]=c*t+s*a}for(let n=0;n<t;n+=1){let t=r[n][e],a=r[n][i];r[n][e]=s*t-c*a,r[n][i]=c*t+s*a}}}return{values:n.map((e,t)=>e[t]),vectors:r}}function Ae(e,t){let n=Array(e+1);if(t<1e-12){for(let t=0;t<=e;t+=1)n[t]=1/(2*t+1);return n}if(t>16){n[0]=.5*Math.sqrt(Math.PI/t);let r=Math.exp(-t);for(let i=1;i<=e;i+=1)n[i]=((2*i-1)*n[i-1]-r)/(2*t);return n}let r=1/(2*e+1),i=r;for(let n=1;n<300&&(r*=-t/n*(2*e+2*n-1)/(2*e+2*n+1),i+=r,!(Math.abs(r)<1e-17*Math.abs(i)));n+=1);n[e]=i;let a=Math.exp(-t);for(let r=e-1;r>=0;--r)n[r]=(2*t*n[r+1]+a)/(2*r+1);return n}function G(e,t,n,r,i,a){let o=i+a,s=i*a/o;return n<0||n>e+t?0:e===0&&t===0&&n===0?Math.exp(-s*r*r):t===0?1/(2*o)*G(e-1,t,n-1,r,i,a)-s*r/i*G(e-1,t,n,r,i,a)+(n+1)*G(e-1,t,n+1,r,i,a):1/(2*o)*G(e,t-1,n-1,r,i,a)+s*r/a*G(e,t-1,n,r,i,a)+(n+1)*G(e,t-1,n+1,r,i,a)}function K(e,t,n,r,i,a,o,s,c){return e===0&&t===0&&n===0?(-2*i)**r*c[r]:e>0?(e-1>0?(e-1)*K(e-2,t,n,r+1,i,a,o,s,c):0)+a*K(e-1,t,n,r+1,i,a,o,s,c):t>0?(t-1>0?(t-1)*K(e,t-2,n,r+1,i,a,o,s,c):0)+o*K(e,t-1,n,r+1,i,a,o,s,c):(n-1>0?(n-1)*K(e,t,n-2,r+1,i,a,o,s,c):0)+s*K(e,t,n-1,r+1,i,a,o,s,c)}var je=(e,t,n,r)=>[(e*t[0]+n*r[0])/(e+n),(e*t[1]+n*r[1])/(e+n),(e*t[2]+n*r[2])/(e+n)];function Me(e,t,n,r,i,a){let o=e+r,s=G(t[0],i[0],0,n[0]-a[0],e,r),c=G(t[1],i[1],0,n[1]-a[1],e,r),l=G(t[2],i[2],0,n[2]-a[2],e,r);return s*c*l*(Math.PI/o)**1.5}function Ne(e,t,n,r,i,a){let[o,s,c]=i,l=r*(2*(o+s+c)+3)*Me(e,t,n,r,i,a),u=-2*r*r*(Me(e,t,n,r,[o+2,s,c],a)+Me(e,t,n,r,[o,s+2,c],a)+Me(e,t,n,r,[o,s,c+2],a)),d=-.5*(o*(o-1)*Me(e,t,n,r,[o-2,s,c],a)+s*(s-1)*Me(e,t,n,r,[o,s-2,c],a)+c*(c-1)*Me(e,t,n,r,[o,s,c-2],a));return l+u+d}function Pe(e,t,n,r,i,a,o){let s=e+r,c=je(e,n,r,a),l=c[0]-o[0],u=c[1]-o[1],d=c[2]-o[2],f=l*l+u*u+d*d,p=Ae(t[0]+t[1]+t[2]+i[0]+i[1]+i[2],s*f),m=0;for(let o=0;o<=t[0]+i[0];o+=1){let c=G(t[0],i[0],o,n[0]-a[0],e,r);for(let f=0;f<=t[1]+i[1];f+=1){let h=G(t[1],i[1],f,n[1]-a[1],e,r);for(let g=0;g<=t[2]+i[2];g+=1){let _=G(t[2],i[2],g,n[2]-a[2],e,r);m+=c*h*_*K(o,f,g,0,s,l,u,d,p)}}}return 2*Math.PI/s*m}function Fe(e,t,n,r,i,a,o,s,c,l,u,d){let f=e+r,p=o+l,m=je(e,n,r,a),h=je(o,c,l,d),g=f*p/(f+p),_=m[0]-h[0],v=m[1]-h[1],y=m[2]-h[2],b=_*_+v*v+y*y,x=Ae(t[0]+t[1]+t[2]+i[0]+i[1]+i[2]+s[0]+s[1]+s[2]+u[0]+u[1]+u[2],g*b),S=0;for(let f=0;f<=t[0]+i[0];f+=1){let p=G(t[0],i[0],f,n[0]-a[0],e,r);for(let m=0;m<=t[1]+i[1];m+=1){let h=G(t[1],i[1],m,n[1]-a[1],e,r);for(let b=0;b<=t[2]+i[2];b+=1){let C=G(t[2],i[2],b,n[2]-a[2],e,r),w=p*h*C;if(w!==0)for(let e=0;e<=s[0]+u[0];e+=1){let t=G(s[0],u[0],e,c[0]-d[0],o,l);for(let n=0;n<=s[1]+u[1];n+=1){let r=G(s[1],u[1],n,c[1]-d[1],o,l);for(let i=0;i<=s[2]+u[2];i+=1){let a=G(s[2],u[2],i,c[2]-d[2],o,l),p=(e+n+i)%2==0?1:-1;S+=w*t*r*a*p*K(f+e,m+n,b+i,0,g,_,v,y,x)}}}}}}return S*2*Math.PI**2.5/(f*p*Math.sqrt(f+p))}function Ie(e){if(e<=0)return 1;let t=1;for(let n=e;n>0;n-=2)t*=n;return t}function Le(e,t){let[n,r,i]=t;return Math.sqrt((2*e/Math.PI)**1.5*(4*e)**(n+r+i)/(Ie(2*n-1)*Ie(2*r-1)*Ie(2*i-1)))}function Re(e,t,n,r){let i=n.map((e,n)=>r[n]*Le(e,t)),a=0;for(let r=0;r<n.length;r+=1)for(let o=0;o<n.length;o+=1)a+=i[r]*i[o]*Me(n[r],t,e,n[o],t,e);let o=1/Math.sqrt(a);return{center:e,lmn:t,exps:n,coeffs:i.map(e=>e*o)}}function ze(e,t,n){let r=0;for(let i=0;i<e.exps.length;i+=1)for(let a=0;a<t.exps.length;a+=1)r+=e.coeffs[i]*t.coeffs[a]*n(e.exps[i],e.lmn,e.center,t.exps[a],t.lmn,t.center);return r}var q=[.15432897,.53532814,.44463454],J=[-.09996723,.39951283,.70011547],Y=[.15591627,.60768372,.39195739],Be=[-.219620369,.2255954336,.900398426],Ve=[.0105876043,.5951670053,.462001012],He={1:[{l:`s`,exps:[3.42525091,.62391373,.1688554],sCoef:q}],2:[{l:`s`,exps:[6.36242139,1.158923,.31364979],sCoef:q}],3:[{l:`s`,exps:[16.11957475,2.936200663,.794650487],sCoef:q},{l:`sp`,exps:[.6362897469,.1478600533,.0480886784],sCoef:J,pCoef:Y}],4:[{l:`s`,exps:[30.16787069,5.495115306,1.487192653],sCoef:q},{l:`sp`,exps:[1.31483311,.3055389383,.0993707456],sCoef:J,pCoef:Y}],5:[{l:`s`,exps:[48.79111318,8.887362172,2.40526704],sCoef:q},{l:`sp`,exps:[2.236956142,.5198204999,.16906176],sCoef:J,pCoef:Y}],6:[{l:`s`,exps:[71.616837,13.045096,3.5305122],sCoef:q},{l:`sp`,exps:[2.9412494,.6834831,.2222899],sCoef:J,pCoef:Y}],7:[{l:`s`,exps:[99.106169,18.052312,4.8856602],sCoef:q},{l:`sp`,exps:[3.7804559,.8784966,.2857144],sCoef:J,pCoef:Y}],8:[{l:`s`,exps:[130.70932,23.808861,6.4436083],sCoef:q},{l:`sp`,exps:[5.0331513,1.1695961,.380389],sCoef:J,pCoef:Y}],9:[{l:`s`,exps:[166.679134,30.36081233,8.216820672],sCoef:q},{l:`sp`,exps:[6.464803249,1.502281245,.4885884864],sCoef:J,pCoef:Y}],10:[{l:`s`,exps:[207.015607,37.70815124,10.20529731],sCoef:q},{l:`sp`,exps:[8.24631512,1.916266291,.6232292721],sCoef:J,pCoef:Y}],11:[{l:`s`,exps:[250.77243,45.67851117,12.36238776],sCoef:q},{l:`sp`,exps:[12.04019274,2.797881859,.909958017],sCoef:J,pCoef:Y},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:Be,pCoef:Ve}],12:[{l:`s`,exps:[299.2374137,54.50646845,14.75157752],sCoef:q},{l:`sp`,exps:[15.12182352,3.513986579,1.142857498],sCoef:J,pCoef:Y},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:Be,pCoef:Ve}],13:[{l:`s`,exps:[351.4214767,64.01186067,17.32410761],sCoef:q},{l:`sp`,exps:[18.89939621,4.391813233,1.42835397],sCoef:J,pCoef:Y},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:Be,pCoef:Ve}],14:[{l:`s`,exps:[407.7975514,74.28083305,20.10329229],sCoef:q},{l:`sp`,exps:[23.19365606,5.389706871,1.752899952],sCoef:J,pCoef:Y},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:Be,pCoef:Ve}],15:[{l:`s`,exps:[468.3656378,85.31338559,23.08913156],sCoef:q},{l:`sp`,exps:[28.03263958,6.514182577,2.118614352],sCoef:J,pCoef:Y},{l:`sp`,exps:[1.743103231,.4863213771,.1903428909],sCoef:Be,pCoef:Ve}],16:[{l:`s`,exps:[533.1257359,97.1095183,26.28162542],sCoef:q},{l:`sp`,exps:[33.32975173,7.745117521,2.518952599],sCoef:J,pCoef:Y},{l:`sp`,exps:[2.029194274,.5661400518,.2215833792],sCoef:Be,pCoef:Ve}],17:[{l:`s`,exps:[601.3456136,109.5358542,29.64467686],sCoef:q},{l:`sp`,exps:[38.96041889,9.053563477,2.944499834],sCoef:J,pCoef:Y},{l:`sp`,exps:[2.129386495,.5940934274,.232524141],sCoef:Be,pCoef:Ve}],18:[{l:`s`,exps:[674.4465184,122.8512753,33.24834945],sCoef:q},{l:`sp`,exps:[45.16424392,10.495199,3.413364448],sCoef:J,pCoef:Y},{l:`sp`,exps:[2.621366518,.731354605,.2862472356],sCoef:Be,pCoef:Ve}]},Ue=[[1,0,0],[0,1,0],[0,0,1]],We=[[2,0,0],[0,2,0],[0,0,2],[1,1,0],[1,0,1],[0,1,1]],Ge={1:[{l:`s`,exps:[18.731137,2.8253937,.6401217],sCoef:[.0334946,.23472695,.81375733]},{l:`s`,exps:[.1612778],sCoef:[1]}],2:[{l:`s`,exps:[38.421634,5.77803,1.241774],sCoef:[.023766,.154679,.46963]},{l:`s`,exps:[.297964],sCoef:[1]}],3:[{l:`s`,exps:[642.41892,96.798515,22.091121,6.2010703,1.9351177,.6367358],sCoef:[.0021426,.0162089,.0773156,.2457861,.470189,.3454708]},{l:`sp`,exps:[2.3249184,.63243035,.07905344],sCoef:[-.0350917,-.1912328,1.0839878],pCoef:[.0089415,.1410095,.9453637]},{l:`sp`,exps:[.028565],sCoef:[1],pCoef:[1]}],4:[{l:`s`,exps:[1264.5857,189.93682,43.159086,12.098664,3.8063231,1.2728901],sCoef:[.0019448,.0148351,.0720906,.2371542,.4691987,.3565202]},{l:`sp`,exps:[3.1964637,.7478133,.2199603],sCoef:[-.0569285,-.0218639,1.0493026],pCoef:[.0558511,.2615505,.793972]},{l:`sp`,exps:[.0823099],sCoef:[1],pCoef:[1]}],5:[{l:`s`,exps:[2068.872,310.629,70.6487,19.8766,6.29923,2.12904],sCoef:[.001906,.014536,.070698,.234532,.46831,.362709]},{l:`sp`,exps:[4.28561,.955726,.289674],sCoef:[-.112169,.072688,.996959],pCoef:[.068009,.305582,.745303]},{l:`sp`,exps:[.100511],sCoef:[1],pCoef:[1]}],6:[{l:`s`,exps:[3047.5249,457.36951,103.94869,29.210155,9.286663,3.163927],sCoef:[.0018347,.0140373,.0688426,.2321844,.4679413,.362312]},{l:`sp`,exps:[7.8682724,1.8812885,.5442493],sCoef:[-.1193324,-.1608542,1.1434564],pCoef:[.0689991,.316424,.7443083]},{l:`sp`,exps:[.1687144],sCoef:[1],pCoef:[1]}],7:[{l:`s`,exps:[4173.511,627.4579,142.9021,40.23433,12.82021,4.390437],sCoef:[.0018348,.013995,.068587,.232241,.46907,.360455]},{l:`sp`,exps:[11.62636,2.71628,.772218],sCoef:[-.114961,-.169117,1.145852],pCoef:[.06758,.323907,.740895]},{l:`sp`,exps:[.2120313],sCoef:[1],pCoef:[1]}],8:[{l:`s`,exps:[5484.6717,825.23495,188.04696,52.9645,16.89757,5.7996353],sCoef:[.0018311,.0139502,.0684451,.2327143,.4701929,.3585209]},{l:`sp`,exps:[15.539616,3.5999336,1.0137618],sCoef:[-.1107775,-.1480263,1.130767],pCoef:[.0708743,.3397528,.7271586]},{l:`sp`,exps:[.2700058],sCoef:[1],pCoef:[1]}],9:[{l:`s`,exps:[7001.713,1051.366,239.2857,67.39745,21.51996,7.403101],sCoef:[.0018196,.013916,.068405,.233186,.471267,.356619]},{l:`sp`,exps:[20.84795,4.808308,1.34407],sCoef:[-.108507,-.146452,1.128687],pCoef:[.071628,.345912,.722471]},{l:`sp`,exps:[.3581514],sCoef:[1],pCoef:[1]}],10:[{l:`s`,exps:[8698.609,1305.059,297.2784,83.75743,26.76274,9.222962],sCoef:[.001814,.013895,.068345,.233548,.47206,.35514]},{l:`sp`,exps:[27.08194,6.234935,1.727988],sCoef:[-.10664,-.146414,1.127789],pCoef:[.072578,.350853,.718678]},{l:`sp`,exps:[.453543],sCoef:[1],pCoef:[1]}],11:[{l:`s`,exps:[10523.38,1581.53,360.75,102.075,32.7854,11.4301],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[36.026,8.4384,2.3887],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[.7681,.2435,.0642],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.0246],sCoef:[1],pCoef:[1]}],12:[{l:`s`,exps:[12581,1890,431.2,122,39.2,13.7],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[46.5,10.9,3.1],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[1.05,.34,.102],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.0398],sCoef:[1],pCoef:[1]}],13:[{l:`s`,exps:[14840,2230,509,144,46.3,16.2],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[58,13.6,3.88],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[1.38,.45,.14],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.054],sCoef:[1],pCoef:[1]}],14:[{l:`s`,exps:[17300,2600,593,168,54,18.9],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[70.5,16.5,4.72],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[1.75,.575,.185],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.077],sCoef:[1],pCoef:[1]}],15:[{l:`s`,exps:[19950,3e3,684,194,62.3,21.8],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[84,19.7,5.65],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[2.15,.71,.235],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.1],sCoef:[1],pCoef:[1]}],16:[{l:`s`,exps:[22800,3430,782,222,71.2,24.9],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[99,23.2,6.65],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[2.6,.86,.29],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.13],sCoef:[1],pCoef:[1]}],17:[{l:`s`,exps:[25850,3890,887,251,80.7,28.2],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[115,27,7.75],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[3.1,1.03,.35],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.162],sCoef:[1],pCoef:[1]}],18:[{l:`s`,exps:[29100,4380,998,283,90.8,31.8],sCoef:[.00181,.01386,.06821,.23346,.47189,.35542]},{l:`sp`,exps:[132,31,8.95],sCoef:[-.1051,-.1476,1.1268],pCoef:[.0729,.3541,.7155]},{l:`sp`,exps:[3.65,1.22,.42],sCoef:[-.2145,.159,.962],pCoef:[.025,.32,.76]},{l:`sp`,exps:[.195],sCoef:[1],pCoef:[1]}]},Ke={3:.2,4:.4,5:.6,6:.8,7:.8,8:.8,9:.8,10:.8,11:.175,12:.175,13:.325,14:.45,15:.55,16:.65,17:.75,18:.85};function qe(e,t=`sto-3g`){let n=String(t||`sto-3g`).trim().toLowerCase(),r=n===`6-31g`||n===`6-31g*`||n===`6-31g(d)`,i=n===`6-31g*`||n===`6-31g(d)`,a=r?Ge:He,o=[];return e.forEach((e,n)=>{let r=a[e.Z];if(!r)throw Error(`No ${t} basis for Z=${e.Z} (have Z=1-18: H–Ar)`);for(let t of r){let r=Re(e.position,[0,0,0],t.exps,t.sCoef);if(r.atomIndex=n,o.push(r),t.l===`sp`)for(let r of Ue){let i=Re(e.position,r,t.exps,t.pCoef);i.atomIndex=n,o.push(i)}}if(i&&Ke[e.Z]!=null){let t=Ke[e.Z];for(let r of We){let i=Re(e.position,r,[t],[1]);i.atomIndex=n,o.push(i)}}}),o}function Je(e,t){let{values:n,vectors:r}=ke(e,t),i=Array.from({length:t},()=>Array(t).fill(0));for(let e=0;e<t;e+=1)for(let a=0;a<t;a+=1){let o=0;for(let i=0;i<t;i+=1)o+=r[e][i]*r[a][i]/Math.sqrt(n[i]);i[e][a]=o}return i}var Ye=[1,.279,.1092];function Xe(e){let t=Math.max(1,Math.min(118,Math.trunc(Number(e)||1)));if(t<=2)return{Z:t,zVal:t,nCore:0,maxN:1,zeta:t===1?1.24:1.69,coreRadiusBohr:0,shells:He[t]};let r=n(t),i=r.reduce((e,t)=>Math.max(e,t.n),2),a=0,o=0,s=0,c=0,l=0;for(let e of r)e.n===i&&(e.l===0||e.l===1)?(a+=e.occupancy,s+=e.occupancy):e.n===i-1?(c+=e.occupancy,e.l===2&&e.occupancy<10&&(o+=e.occupancy)):l+=e.occupancy;let u=Math.max(1,a+o);for(;u>8;)u-=2;t-u&1&&(u=u<8?u+1:u-1);let d=Math.max(0,t-u),f=.35*Math.max(0,s-1)+.85*c+1*l,p=Math.max(1,t-f),m=i<=3?i:3.4+.32*(i-3),h=Math.max(.68,Math.min(2.75,p/m*.92)),g;if(He[t])g=[He[t][He[t].length-1]];else{let e=Math.max(.45,Math.min(5.2,.72*h*h));g=[{l:`sp`,exps:Ye.map(t=>e*t),sCoef:Be,pCoef:Ve}]}let _=d>0?Math.max(.45,Math.min(2.6,.46*m*m/p**.62)):0;return{Z:t,zVal:u,nCore:d,maxN:i,zeta:h,coreRadiusBohr:_,shells:g}}function Ze(e,t=0){let n=e.map(e=>Xe(e.Z)),r=[];e.forEach((e,t)=>{let i=n[t];for(let n of i.shells){let i=Re(e.position,[0,0,0],n.exps,n.sCoef);if(i.atomIndex=t,r.push(i),n.l===`sp`)for(let i of Ue){let a=Re(e.position,i,n.exps,n.pCoef);a.atomIndex=t,r.push(a)}}});let i=r.length,a=n.map(e=>e.zVal),o=a.reduce((e,t)=>e+t,0)-t,s=Array.from({length:i},()=>Array(i).fill(0)),c=Array.from({length:i},()=>Array(i).fill(0));for(let t=0;t<i;t+=1)for(let n=0;n<i;n+=1){s[t][n]=ze(r[t],r[n],Me);let i=ze(r[t],r[n],Ne);for(let o=0;o<e.length;o+=1){let s=a[o];i+=-s*ze(r[t],r[n],(t,n,r,i,a,s)=>Pe(t,n,r,i,a,s,e[o].position))}c[t][n]=i}let l=new Float64Array(i*i*i*i),u=(e,t,n,r)=>((e*i+t)*i+n)*i+r;for(let e=0;e<i;e+=1)for(let t=0;t<=e;t+=1)for(let n=0;n<i;n+=1)for(let i=0;i<=n;i+=1){if(e*(e+1)/2+t<n*(n+1)/2+i)continue;let a=ct(r[e],r[t],r[n],r[i]);for(let[r,o,s,c]of[[e,t,n,i],[t,e,n,i],[e,t,i,n],[t,e,i,n],[n,i,e,t],[i,n,e,t],[n,i,t,e],[i,n,t,e]])l[u(r,o,s,c)]=a}let d=0;for(let t=0;t<e.length;t+=1)for(let r=t+1;r<e.length;r+=1){let i=e[t].position,o=e[r].position,s=Math.hypot(i[0]-o[0],i[1]-o[1],i[2]-o[2]);if(s>1e-8){d+=a[t]*a[r]/s;let e=n[t].coreRadiusBohr+n[r].coreRadiusBohr,i=Math.sqrt(Math.max(0,n[t].nCore)*Math.max(0,n[r].nCore))+.25*(n[t].nCore+n[r].nCore);if(e>0&&i>0){let t=2.15/Math.max(.6,e);d+=.18*Math.sqrt(i)*Math.exp(-t*(s-.85*e))}}}return{basis:r,n:i,nElectrons:o,effCharges:a,specs:n,S:s,Hcore:c,eri:l,idx:u,X:Je(s,i),nuclearRepulsion:d}}function Qe(e,t,n,r,i=n.length){let a=i,o=Array.isArray(r)?r.length:Number(r)||0,s=ArrayBuffer.isView(e),c=ArrayBuffer.isView(t),{values:l,vectors:u}=ke(Array.from({length:a},(e,n)=>Array.from({length:a},(e,r)=>c?t[n*a+r]:t[n][r])),a),d=new Float64Array(a*a);for(let e=0;e<a;e+=1)for(let t=0;t<a;t+=1){let n=0;for(let r=0;r<a;r+=1)n+=u[e][r]*u[t][r]*Math.sqrt(Math.max(0,l[r]));d[e*a+t]=n}let f=new Float64Array(a*a);for(let t=0;t<a;t+=1)for(let n=0;n<a;n+=1){let r=0;for(let i=0;i<a;i+=1){let o=s?e[i*a+n]:e[i][n];r+=d[t*a+i]*o}f[t*a+n]=r}let p=new Float64Array(a*a);for(let e=0;e<a;e+=1)for(let t=0;t<a;t+=1){let n=0;for(let r=0;r<a;r+=1)n+=f[e*a+r]*d[r*a+t];p[e*a+t]=n}let m=Array.from({length:o},()=>Array(o).fill(0));for(let e=0;e<a;e+=1){let t=n[e]?.atomIndex??0;if(!(t>=o))for(let r=0;r<a;r+=1){let i=n[r]?.atomIndex??0;if(i>=o||t===i)continue;let s=p[e*a+r];m[t][i]+=s*s}}let h=[];for(let e=0;e<o;e+=1)for(let t=e+1;t<o;t+=1){let n=Math.max(0,.5*(m[e][t]+m[t][e]));m[e][t]=n,m[t][e]=n;let i=null;if(Array.isArray(r)&&r[e]&&r[t]){let n=Array.isArray(r[e].position)?r[e].position:[r[e].x||0,r[e].y||0,r[e].z||0],a=Array.isArray(r[t].position)?r[t].position:[r[t].x||0,r[t].y||0,r[t].z||0];i=Math.hypot(n[0]-a[0],n[1]-a[1],n[2]-a[2])}if(n>=.16&&(i==null||(n>=.55?i<7.2:i<=3.85))){let r=n>=2.45?`triple`:n>=1.55?`double`:n>=.6?`single`:`partial`;h.push(Object.freeze({a:e,b:t,order:n,kind:r,lengthBohr:i,lengthA:i==null?null:i*.529177210903}))}}return{bondOrderMatrix:m,bonds:h}}function $e(e,t,n=`sto-3g`){let r=String(n||`sto-3g`).trim().toLowerCase();if(r===`valence-sto3g`||r===`ecp-sto3g`)return Ze(e,t);let i=qe(e,n),a=i.length,o=e.map(e=>e.Z),s=e.reduce((e,t)=>e+t.Z,0)-t,c=Array.from({length:a},()=>Array(a).fill(0)),l=Array.from({length:a},()=>Array(a).fill(0));for(let t=0;t<a;t+=1)for(let n=0;n<a;n+=1){c[t][n]=ze(i[t],i[n],Me);let r=ze(i[t],i[n],Ne);for(let a of e)r+=-a.Z*ze(i[t],i[n],(e,t,n,r,i,o)=>Pe(e,t,n,r,i,o,a.position));l[t][n]=r}let u=new Float64Array(a*a*a*a),d=(e,t,n,r)=>((e*a+t)*a+n)*a+r;for(let e=0;e<a;e+=1)for(let t=0;t<=e;t+=1)for(let n=0;n<a;n+=1)for(let r=0;r<=n;r+=1){if(e*(e+1)/2+t<n*(n+1)/2+r)continue;let a=ct(i[e],i[t],i[n],i[r]);for(let[i,o,s,c]of[[e,t,n,r],[t,e,n,r],[e,t,r,n],[t,e,r,n],[n,r,e,t],[r,n,e,t],[n,r,t,e],[r,n,t,e]])u[d(i,o,s,c)]=a}return{basis:i,n:a,nElectrons:s,effCharges:o,S:c,Hcore:l,eri:u,idx:d,X:Je(c,a),nuclearRepulsion:lt(e)}}function et(e,t,n){let{values:r,vectors:i}=ke(dt(dt(ut(t,n),e,n),t,n),n),a=r.map((e,t)=>t).sort((e,t)=>r[e]-r[t]),o=Array.from({length:n},()=>Array(n).fill(0));for(let e=0;e<n;e+=1)for(let r=0;r<n;r+=1){let s=0;for(let o=0;o<n;o+=1)s+=t[e][o]*i[o][a[r]];o[e][r]=s}return{C:o,epsilon:a.map(e=>r[e])}}function tt(e,t){let n=t.length,r=e.map((e,n)=>[...e,t[n]]);for(let e=0;e<n;e+=1){let t=e;for(let i=e+1;i<n;i+=1)Math.abs(r[i][e])>Math.abs(r[t][e])&&(t=i);if(Math.abs(r[t][e])<1e-14)return null;[r[e],r[t]]=[r[t],r[e]];for(let t=0;t<n;t+=1){if(t===e)continue;let i=r[t][e]/r[e][e];for(let a=e;a<=n;a+=1)r[t][a]-=i*r[e][a]}}return r.map((e,t)=>e[n]/r[t][t])}function nt(e,t,n,r){let i=dt(dt(e,t,r),n,r),a=dt(dt(n,t,r),e,r),o=Array.from({length:r},()=>Array(r).fill(0));for(let e=0;e<r;e+=1)for(let t=0;t<r;t+=1)o[e][t]=i[e][t]-a[e][t];return o}function rt(e,t,n){let r=e.length;if(r<2)return null;let i=Array.from({length:r+1},()=>Array(r+1).fill(0));for(let e=0;e<r;e+=1){for(let r=0;r<=e;r+=1){let a=0,o=t[e],s=t[r];for(let e=0;e<n;e+=1)for(let t=0;t<n;t+=1)a+=o[e][t]*s[e][t];i[e][r]=a,i[r][e]=a}i[e][r]=-1,i[r][e]=-1}let a=Array(r+1).fill(0);a[r]=-1;let o=tt(i,a);if(!o)return null;let s=Array.from({length:n},()=>Array(n).fill(0));for(let t=0;t<r;t+=1){let r=o[t],i=e[t];for(let e=0;e<n;e+=1)for(let t=0;t<n;t+=1)s[e][t]+=r*i[e][t]}return s}function it(e,t,n,r,i){let a=Array(r).fill(0);for(let i=0;i<r;i+=1){let o=0;for(let a=0;a<n[0].length;a+=1){let s=0;for(let o=0;o<r;o+=1){let c=0;for(let n=0;n<r;n+=1)c+=t[o][n]*e[n][i];s+=n[o][a]*c}o+=s*s}a[i]=o}return a.map((e,t)=>[e,t]).sort((e,t)=>t[0]-e[0]).slice(0,i).map(([,e])=>e).sort((e,t)=>e-t)}function at(e,{charge:t=0,basis:n=`sto-3g`,maxIter:r=200,tol:i=1e-8,damping:a=.5,initialP:o=null,referenceOccupiedC:s=null}={}){let{basis:c,n:l,nElectrons:u,S:d,Hcore:f,eri:p,idx:m,X:h,nuclearRepulsion:g}=$e(e,t,n);if(u%2!=0)throw Error(`RHF requires an even electron count (closed shell)`);let _=u/2,v=Array.isArray(o)&&o.length===l?o.map(e=>[...e]):Array.from({length:l},()=>Array(l).fill(0)),y=0,b=!1,x=1/0,S=null,C=null,w=null,T=v,E=[],D=[];for(let e=0;e<r;e+=1){let t=Array.from({length:l},()=>Array(l).fill(0));for(let e=0;e<l;e+=1)for(let n=0;n<l;n+=1){let r=0;for(let t=0;t<l;t+=1)for(let i=0;i<l;i+=1)r+=v[t][i]*(p[m(e,n,i,t)]-.5*p[m(e,t,i,n)]);t[e][n]=f[e][n]+r}E.push(t.map(e=>[...e])),D.push(nt(t,v,d,l)),E.length>8&&(E.shift(),D.shift());let{C:n,epsilon:r}=et((e>=2?rt(E,D,l):null)||t,h,l);S=n,C=r;let o=Array.isArray(s)&&s.length===l?it(n,d,s,l,_):null;w=o;let c=Array.from({length:l},()=>Array(l).fill(0));for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1){let r=0;for(let i=0;i<_;i+=1){let a=o?o[i]:i;r+=n[e][a]*n[t][a]}c[e][t]=2*r}let u=0;for(let e=0;e<l;e+=1)for(let n=0;n<l;n+=1)u+=.5*c[e][n]*(f[e][n]+t[e][n]);T=c;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)v[e][t]=a*c[e][t]+(1-a)*v[e][t];if(y=u,Math.abs(y-x)<i&&e>2){b=!0;break}x=y}let O=S?Array.from({length:l},(e,t)=>Array.from({length:_},(e,n)=>S[t][w?w[n]:n])):null;return{totalEnergyHa:y+g,electronicEnergyHa:y,nuclearRepulsionHa:g,nBasis:l,nElectrons:u,nOcc:_,C:S,orbitalEnergies:C,eri:p,idx:m,P:T,S:d,basis:c,scfConverged:b,occupiedC:O}}function ot(e,{charge:t=0,basis:n=`sto-3g`,multiplicity:r=null,maxIter:i=300,tol:a=1e-9,damping:o=.6,brokenSymmetry:s=!1,brokenSymmetryPairs:c=1}={}){let{basis:l,n:u,nElectrons:d,S:f,Hcore:p,eri:m,idx:h,X:g,nuclearRepulsion:_}=$e(e,t,n),v=r==null?d%2:r-1,y=(d+v)/2,b=(d-v)/2;if(!Number.isInteger(y)||b<0)throw Error(`inconsistent electron count / multiplicity`);let x=(e,t)=>{let n=Array.from({length:u},()=>Array(u).fill(0));for(let r=0;r<u;r+=1)for(let i=0;i<u;i+=1){let a=0;for(let n=0;n<t;n+=1)a+=e[r][n]*e[i][n];n[r][i]=a}return n},{C:S}=et(p,g,u),C=S.map(e=>e.slice()),w=S.map(e=>e.slice());if(s&&y>0&&y<u){let e=Math.max(1,Math.min(Math.floor(c),y,u-y)),t=Math.SQRT1_2,n=Math.SQRT1_2;for(let r=0;r<e;r+=1){let e=y-1-r,i=y+r;for(let r=0;r<u;r+=1){let a=S[r][e],o=S[r][i];C[r][e]=t*a+n*o,C[r][i]=-n*a+t*o,w[r][e]=t*a-n*o,w[r][i]=n*a+t*o}}}let T=x(C,y),E=x(w,b),D=0,O=!1,k=1/0,A=S,j=S,M=Array(u).fill(0),N=Array(u).fill(0);for(let e=0;e<i;e+=1){let t=Array.from({length:u},(e,t)=>Array.from({length:u},(e,n)=>T[t][n]+E[t][n])),n=Array.from({length:u},()=>Array(u).fill(0)),r=Array.from({length:u},()=>Array(u).fill(0));for(let e=0;e<u;e+=1)for(let i=0;i<u;i+=1){let a=0,o=0,s=0;for(let n=0;n<u;n+=1)for(let r=0;r<u;r+=1)a+=t[n][r]*m[h(e,i,r,n)],o+=T[n][r]*m[h(e,n,r,i)],s+=E[n][r]*m[h(e,n,r,i)];n[e][i]=p[e][i]+a-o,r[e][i]=p[e][i]+a-s}let i=et(n,g,u),s=et(r,g,u);A=i.C,j=s.C,M=i.epsilon,N=s.epsilon;let c=x(i.C,y),l=x(s.C,b),d=0;for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)d+=.5*((c[e][t]+l[e][t])*p[e][t]+c[e][t]*n[e][t]+l[e][t]*r[e][t]);for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)T[e][t]=o*c[e][t]+(1-o)*T[e][t],E[e][t]=o*l[e][t]+(1-o)*E[e][t];if(D=d,Math.abs(D-k)<a&&e>2){O=!0;break}k=D}let P=.5*(y-b),ee=0;for(let e=0;e<y;e+=1)for(let t=0;t<b;t+=1){let n=0;for(let r=0;r<u;r+=1){let i=0;for(let e=0;e<u;e+=1)i+=f[r][e]*j[e][t];n+=A[r][e]*i}ee+=n*n}let te=P*(P+1)+b-ee;return{totalEnergyHa:D+_,electronicEnergyHa:D,nuclearRepulsionHa:_,nBasis:u,nElectrons:d,nAlpha:y,nBeta:b,sSquared:te,CAlpha:A,CBeta:j,epsAlpha:M,epsBeta:N,PAlpha:T,PBeta:E,S:f,basis:l,eri:m,idx:h,scfConverged:O}}function st(e,{charge:t=0,basis:n=`sto-3g`,maxIter:r=200,tol:i=1e-8,activeHomoIndex:a=null,activeLumoIndex:o=null,optimizeOrbitals:s=!0}={}){let{basis:c,n:l,nElectrons:u,S:d,Hcore:f,eri:p,idx:m,nuclearRepulsion:h}=$e(e,t,n);if(u%2!=0)throw Error(`CAS(2,2) requires an even electron count`);let g=at(e,{charge:t,basis:n,maxIter:r,tol:i}),_=g.nOcc;if(_<1||l<_+1)throw Error(`CAS(2,2) requires at least 1 occupied and 1 virtual orbital`);let v=a??_-1,y=o??_,b=[];for(let e=0;e<_;e+=1)e!==v&&b.push(e);let x=Array.from({length:l},()=>Array(l).fill(0));for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1){let n=0;for(let r of b)n+=g.C[e][r]*g.C[t][r];x[e][t]=2*n}let S=Array.from({length:l},()=>Array(l).fill(0)),C=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1){let n=0;for(let r=0;r<l;r+=1)for(let i=0;i<l;i+=1)n+=x[r][i]*(p[m(e,t,i,r)]-.5*p[m(e,r,i,t)]);S[e][t]=f[e][t]+n,C+=.5*x[e][t]*(f[e][t]+S[e][t])}let w=h+C,T=(e,t)=>{let n=0;for(let r=0;r<l;r+=1)for(let i=0;i<l;i+=1)n+=e[r]*S[r][i]*t[i];return n},E=(e,t,n,r)=>{let i=0;for(let a=0;a<l;a+=1){let o=e[a];if(o!==0)for(let e=0;e<l;e+=1){let s=o*t[e];if(s!==0)for(let t=0;t<l;t+=1){let o=s*n[t];if(o!==0)for(let n=0;n<l;n+=1)i+=o*r[n]*p[m(a,e,t,n)]}}}return i},D=Array.from({length:l},(e,t)=>g.C[t][v]),O=Array.from({length:l},(e,t)=>g.C[t][y]),k=e=>{let t=Math.cos(e),n=Math.sin(e),r=D.map((e,r)=>t*e+n*O[r]),i=D.map((e,r)=>-n*e+t*O[r]),a=T(r,r),o=T(i,i),s=T(r,i),c=E(r,r,r,r),l=E(i,i,i,i),u=E(r,r,i,i),d=E(r,i,r,i),f=E(r,r,r,i),p=E(i,i,r,i),m=[[w+2*a+c,d,Math.SQRT2*(s+f)],[d,w+2*o+l,Math.SQRT2*(s+p)],[Math.SQRT2*(s+f),Math.SQRT2*(s+p),w+a+o+u+d]],{values:h,vectors:g}=ke(m,3),_=0;h[1]<h[_]&&(_=1),h[2]<h[_]&&(_=2);let v=g[0][_],y=g[1][_],b=g[2][_],x=2*v*v+b*b,S=2*y*y+b*b,C=Math.SQRT2*b*(v+y),k=x+S,A=Math.hypot(x-S,2*C),j=.5*(k+A),M=.5*(k-A);return{totalEnergyHa:h[_],excitedEnergiesHa:h.slice().sort((e,t)=>e-t),ciCoefficients:[v,y,b],naturalOccupations:[j,M],diradicalCharacter:Math.max(0,Math.min(1,M)),theta:e,Jhh:c,Jll:l,Jhl:u,Khl:d,h11RefHa:m[0][0]}},A=k(0),j=A;if(s){let e=0;for(let t=-8;t<=8;t+=1){let n=t/16*Math.PI*.5,r=k(n);r.totalEnergyHa<j.totalEnergyHa-1e-10&&(j=r,e=n)}if(e!==0){let t=e-Math.PI/32,n=e+Math.PI/32,r=(Math.sqrt(5)-1)/2,i=n-r*(n-t),a=t+r*(n-t),o=k(i),s=k(a);for(let e=0;e<14;e+=1)o.totalEnergyHa<s.totalEnergyHa?(n=a,a=i,s=o,i=n-r*(n-t),o=k(i)):(t=i,i=a,o=s,a=t+r*(n-t),s=k(a));let c=k(.5*(t+n));c.totalEnergyHa<j.totalEnergyHa-1e-10&&(j=c)}}return{schema:`peercompute.ulg.molecular-cas22.v1`,basis:n,nBasis:l,nElectrons:u,rhfEnergyHa:g.totalEnergyHa,totalEnergyHa:j.totalEnergyHa,staticCorrelationHa:j.totalEnergyHa-g.totalEnergyHa,excitedEnergiesHa:j.excitedEnergiesHa,ciCoefficients:j.ciCoefficients,naturalOccupations:j.naturalOccupations,diradicalCharacter:j.diradicalCharacter,activeOrbitals:{homoIndex:v,lumoIndex:y,rotationAngleRad:j.theta},exchangeIntegralKhlHa:j.Khl,h11RhfConsistencyErrorHa:Math.abs(A.h11RefHa-g.totalEnergyHa),scfConverged:g.scfConverged,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function ct(e,t,n,r){let i=0;for(let a=0;a<e.exps.length;a+=1)for(let o=0;o<t.exps.length;o+=1)for(let s=0;s<n.exps.length;s+=1)for(let c=0;c<r.exps.length;c+=1)i+=e.coeffs[a]*t.coeffs[o]*n.coeffs[s]*r.coeffs[c]*Fe(e.exps[a],e.lmn,e.center,t.exps[o],t.lmn,t.center,n.exps[s],n.lmn,n.center,r.exps[c],r.lmn,r.center);return i}function lt(e){let t=0;for(let n=0;n<e.length;n+=1)for(let r=n+1;r<e.length;r+=1){let i=e[n].position[0]-e[r].position[0],a=e[n].position[1]-e[r].position[1],o=e[n].position[2]-e[r].position[2];t+=e[n].Z*e[r].Z/Math.sqrt(i*i+a*a+o*o)}return t}var ut=(e,t)=>Array.from({length:t},(n,r)=>Array.from({length:t},(t,n)=>e[n][r]));function dt(e,t,n){let r=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i+=1)for(let a=0;a<n;a+=1){let o=e[i][a];if(o!==0)for(let e=0;e<n;e+=1)r[i][e]+=o*t[a][e]}return r}function ft(e,t={}){return ot([{Z:e,position:[0,0,0]}],{multiplicity:a(e)+1,...t}).totalEnergyHa}function pt(e,{moleculeOptions:t={},atomCache:n=new Map}={}){let r=ot(e,t).totalEnergyHa,i=0;for(let t of e)n.has(t.Z)||n.set(t.Z,ft(t.Z)),i+=n.get(t.Z);return{atomizationEnergyHa:i-r,moleculeEnergyHa:r,atomsEnergyHa:i}}var mt=43597447222071e-31,ht=529177210903e-22,gt=(9*Math.PI/4)**(1/3),_t=(Math.log(2)-1)/(2*Math.PI*Math.PI),vt=20.4562557,yt=(Math.log(2)-1)/(4*Math.PI*Math.PI),bt=27.4203609;function xt(e){return(3/(4*Math.PI*e))**(1/3)}function St(e){return 3/(4*Math.PI*e**3)}function Ct(e){let t=gt/e;return .3*t*t}function wt(e){return-(3/(4*Math.PI))*(gt/e)}function Tt(e){return _t*Math.log(1+vt/e+vt/(e*e))}function Et(e){return yt*Math.log(1+bt/e+bt/(e*e))}function Dt(e){return((1+e)**(4/3)+(1-e)**(4/3)-2)/(2**(4/3)-2)}function Ot(e,t){return wt(e)*.5*((1+t)**(4/3)+(1-t)**(4/3))}function kt(e,t){let n=Tt(e);return n+(Et(e)-n)*Dt(t)}function At(e,t){return Ot(e,t)+kt(e,t)}function jt(e){return Ct(e)+wt(e)+Tt(e)}var Mt=.0072973525693;function Nt(e){if(e<=1e-12)return 0;let t=xt(e);return e*(jt(t)-Pt(t))}function Pt(e){let t=(9*Math.PI/4)**(1/3)/e;return .3*t*t}function Ft(e){if(e<=1e-12)return 0;let t=e*1e-4+1e-15;return(Nt(e+t)-Nt(e-t))/(2*t)}var It=.804,Lt=.2195149727645171,Rt=(1-Math.LN2)/(Math.PI*Math.PI),zt=.06672455060314922;function Bt(e,t){if(!(e>1e-14))return 0;let n=Math.max(0,Math.abs(t)),r=xt(e),i=Math.cbrt(3*Math.PI*Math.PI*e),a=n/(2*i*e),o=a*a,s=-.75*Math.cbrt(3/Math.PI)*Math.cbrt(e),c=s*(1.804-It/(1+Lt/It*o)),l=jt(r)-Pt(r)-s,u=n/(2*Math.sqrt(4*i/Math.PI)*e),d=u*u,f=Math.min(500,-l/Rt),p=Math.exp(f)-1,m=0;if(p>1e-30&&d>0){let e=zt/Rt/p*d,t=(1+e)/(1+e+e*e);m=Rt*Math.log(1+zt/Rt*d*t)}return e*(c+l+m)}function Vt(e,t,n){let r=t.length,{fp:i}=Qt(e,t,n),a=new Float64Array(r),o=new Float64Array(r),s=new Float64Array(r);for(let n=0;n<r;n+=1){let r=e[n],c=i[n],l=Math.abs(c);if(r<=1e-13)continue;a[n]=Bt(r,l);let u=r*1e-4+1e-15;o[n]=(Bt(r+u,l)-Bt(Math.max(1e-16,r-u),l))/(2*u);let d=l*1e-4+1e-12,f=(Bt(r,l+d)-Bt(r,Math.max(0,l-d)))/(2*d),p=c>=0?1:-1;s[n]=t[n]*t[n]*f*p}let{fp:c}=Qt(s,t,n),l=new Float64Array(r);for(let n=0;n<r;n+=1){if(e[n]<=1e-13)continue;let r=o[n]-c[n]/(t[n]*t[n]);l[n]=Number.isFinite(r)?r:Ft(e[n])}return{vXC:l,fxc:a}}function Ht(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);i[0]=t[0]/e[0],a[0]=n[0]/e[0];for(let o=1;o<r;o+=1){let s=e[o]-t[o-1]*i[o-1];i[o]=(o<r-1?t[o]:0)/s,a[o]=(n[o]-t[o-1]*a[o-1])/s}let o=new Float64Array(r);o[r-1]=a[r-1];for(let e=r-2;e>=0;--e)o[e]=a[e]-i[e]*o[e+1];return o}function Ut(e,t,n){let r=e.length,i=0,a=e[0]-n;a<0&&(i+=1);for(let o=1;o<r;o+=1)Math.abs(a)<1e-300&&(a=-1e-300),a=e[o]-n-t[o-1]*t[o-1]/a,a<0&&(i+=1);return i}function Wt(e,t){let n=e.length,r=1/0,i=-1/0;for(let a=0;a<n;a+=1){let o=Math.abs(a>0?t[a-1]:0)+Math.abs(a<n-1?t[a]:0);r=Math.min(r,e[a]-o),i=Math.max(i,e[a]+o)}return{lo:r,hi:i}}function Gt(e){return Math.min(160,Math.max(48,Math.ceil(Math.log2(Math.max(e,1e-300)/1e-13))))}function Kt(e,t,n,r,{lowerVecs:i=null,bounds:a=null,bracketHint:o=null}={}){let s=e.length,c,l;if(o&&Ut(e,t,o[0])<n&&Ut(e,t,o[1])>=n)[c,l]=o;else{let{lo:n,hi:r}=a??Wt(e,t);c=n,l=r}let u=Gt(l-c);for(let r=0;r<u;r+=1){let r=.5*(c+l);Ut(e,t,r)>=n?l=r:c=r}let d=.5*(c+l),f=d-1e-7*(Math.abs(d)+1),p=new Float64Array(s);for(let t=0;t<s;t+=1)p[t]=e[t]-f;let m=new Float64Array(s);for(let e=0;e<s;e+=1)m[e]=Math.sin(n*Math.PI*(e+1)/(s+1));for(let e=0;e<12;e+=1){let e=Ht(p,t,m);if(i)for(let t of i){let n=0;for(let i=0;i<s;i+=1)n+=e[i]*t[i]*r;for(let r=0;r<s;r+=1)e[r]-=n*t[r]}let n=0;for(let t=0;t<s;t+=1)n+=e[t]*e[t]*r;n=Math.sqrt(n);for(let t=0;t<s;t+=1)m[t]=e[t]/n}if(m[1]<0)for(let e=0;e<s;e+=1)m[e]=-m[e];return{energyHa:d,u:m}}function qt(e,t,n,r){let i=Wt(e,t),a=[],o=[];for(let s=1;s<=n;s+=1){let n=Kt(e,t,s,r,{lowerVecs:o,bounds:i});a.push(n),o.push(n.u)}return a}Object.freeze({H:{Z:1,config:[{n:1,l:0,occupancy:1}]},He:{Z:2,config:[{n:1,l:0,occupancy:2}]},Be:{Z:4,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2}]},Ne:{Z:10,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6}]},Ar:{Z:18,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6}]},Fe:{Z:26,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6},{n:4,l:0,occupancy:2},{n:3,l:2,occupancy:6}]}});function Jt(e,t,n){let r=t.length,i=new Float64Array(r),a=new Float64Array(r),o=0;for(let a=0;a<r;a+=1)o+=e[a]*t[a]*t[a]*t[a]*n,i[a]=o;o=0;for(let i=r-1;i>=0;--i)o+=e[i]*t[i]*t[i]*n,a[i]=o;let s=new Float64Array(r);for(let e=0;e<r;e+=1)s[e]=4*Math.PI*(i[e]/t[e]+a[e]);return s}function Yt(e,t,n,r,i){let a=t.length,o=1/(n*n),s=new Float64Array(a),c=new Float64Array(a);for(let n=0;n<a;n+=1)s[n]=(o+.5*(r+.5)*(r+.5))/(t[n]*t[n])+e[n],n<a-1&&(c[n]=-o/(2*t[n]*t[n+1]));let l=qt(s,c,i,n);for(let e of l){let r=new Float64Array(a);for(let n=0;n<a;n+=1)r[n]=e.u[n]/Math.sqrt(2*t[n]);let i=0;for(let e=0;e<a;e+=1)i+=r[e]*r[e]*t[e]*n;i=Math.sqrt(i);for(let e=0;e<a;e+=1)r[e]/=i;e.u=r}return l}function Xt({u:e,energyHa:t,vFull:n,r,dx:i,l:a,atomicNumberZ:o}){let s=Mt*Mt,c=0;for(let a=0;a<r.length;a+=1){let o=t-n[a];c+=o*o*e[a]*e[a]*r[a]*i}let l=0;if(a===0){let t=e[0]/r[0];l=s/8*o*t*t}return-.5*s*c+l}function Zt({u:e,energyHa:t,vElec:n,r,dx:i,l:a,atomicNumberZ:o}){if(!(a>=1))return Object.freeze({xiHa:0,splittingHa:0,shiftJMinusHa:0,shiftJPlusHa:0,energyJMinusHa:t,energyJPlusHa:t});let s=Mt*Mt*.5,{fp:c}=Qt(n,r,i),l=0;for(let a=0;a<r.length;a+=1){let u=r[a],d=-o/u+n[a],f=o/(u*u)+c[a],p=1+s*(t-d);l+=s*(f/(p*p))*e[a]*e[a]*i}let u=.5*a*l,d=-.5*(a+1)*l;return Object.freeze({xiHa:l,splittingHa:(a+.5)*l,shiftJMinusHa:d,shiftJPlusHa:u,energyJMinusHa:t+d,energyJPlusHa:t+u})}function Qt(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);for(let o=1;o<r-1;o+=1){let r=(e[o+1]-e[o-1])/(2*n),s=(e[o+1]-2*e[o]+e[o-1])/(n*n);i[o]=r/t[o],a[o]=(s-r)/(t[o]*t[o])}return i[0]=i[1],i[r-1]=i[r-2],a[0]=a[1],a[r-1]=a[r-2],{fp:i,fpp:a}}function $t(e,t,n,r,i,a,o){let s=t.length,c=1/(n*n),l=.5*Mt*Mt,u=new Float64Array(s);for(let n=0;n<s;n+=1)u[n]=-a/t[n]+e[n];let{fp:d,fpp:f}=Qt(e,t,n),p=new Float64Array(s),m=new Float64Array(s);for(let e=0;e<s;e+=1)p[e]=a/(t[e]*t[e])+d[e],m[e]=-2*a/(t[e]*t[e]*t[e])+f[e];let h=[];for(let e=0;e<i;e+=1){let i=o?.[e]??-a*a/(2*(e+r+1)*(e+r+1)),d=null;for(let a=0;a<40;a+=1){let o=new Float64Array(s);for(let e=0;e<s;e+=1)o[e]=1+l*(i-u[e]);let f=new Float64Array(s),h=new Float64Array(s);for(let e=0;e<s;e+=1){let n=-26625677260334657e-21*p[e]/o[e],i=2*o[e]*u[e]-n/t[e]+.75*n*n-.5*(-26625677260334657e-21*m[e])/o[e];f[e]=(2*c+(r+.5)*(r+.5)+t[e]*t[e]*i)/(2*o[e]*t[e]*t[e]),e<s-1&&(h[e]=-c/(2*t[e]*t[e+1]*Math.sqrt(o[e]*o[e+1])))}let g=Math.max(2,.05*Math.abs(i)),_=Kt(f,h,e+1,n,{bracketHint:[i-g,i+g]}),v=_.energyHa;if(d=_.u,Math.abs(v-i)<1e-9&&a>1){i=v;break}i=v}let f=new Float64Array(s);for(let e=0;e<s;e+=1)f[e]=d[e]/Math.sqrt(2*t[e]);let g=0;for(let e=0;e<s;e+=1)g+=f[e]*f[e]*t[e]*n;g=Math.sqrt(g);for(let e=0;e<s;e+=1)f[e]/=g;h.push({energyHa:i,u:f})}return h}function en({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7,functional:c=`lda`,relativistic:l=!1,spinOrbit:u=!1,returnRadialDensity:d=!1,returnOrbitalWavefunctions:f=!1}){let p=String(c||`lda`).toLowerCase()===`pbe`,m=Math.log(r),h=(Math.log(i)-m)/(n-1),g=new Float64Array(n);for(let e=0;e<n;e+=1)g[e]=Math.exp(m+e*h);let _=new Map;for(let e of t)_.set(e.l,Math.max(_.get(e.l)||0,e.n-e.l));let v=new Float64Array(n);for(let t=0;t<n;t+=1)v[t]=e*(e**3/Math.PI)*Math.exp(-2*e*g[t]);let y=new Map,b=new Float64Array(n),x=new Float64Array(n),S=null,C=new Float64Array(n);for(let r=0;r<o;r+=1){if(b=Jt(v,g,h),p){let t=Vt(v,g,h);x=t.vXC,S=t.fxc;for(let t=0;t<n;t+=1)C[t]=-e/g[t]+b[t]+x[t]}else for(let t=0;t<n;t+=1)x[t]=Ft(v[t]),C[t]=-e/g[t]+b[t]+x[t];y=new Map;for(let[e,t]of _)y.set(e,Yt(C,g,h,e,t));let i=new Float64Array(n);for(let e of t){let t=y.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*g[r]*g[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-v[e])*4*Math.PI*g[e]*g[e]*g[e]*h,v[e]=(1-a)*v[e]+a*i[e];if(o<s&&r>8)break}let w=new Float64Array(n);for(let e=0;e<n;e+=1)w[e]=b[e]+x[e];let T=0,E=0,D=0,O=[];for(let n of t){let t=y.get(n.l)[n.n-n.l-1];T+=n.occupancy*t.energyHa,E+=n.occupancy;let r={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t.energyHa};if(l&&(r.relativisticShiftHa=Xt({u:t.u,energyHa:t.energyHa,vFull:C,r:g,dx:h,l:n.l,atomicNumberZ:e}),D+=n.occupancy*r.relativisticShiftHa),u&&n.l>=1){let i=Zt({u:t.u,energyHa:t.energyHa,vElec:w,r:g,dx:h,l:n.l,atomicNumberZ:e});r.spinOrbitXiHa=i.xiHa,r.spinOrbitSplittingHa=i.splittingHa,r.energyJMinusHa=i.energyJMinusHa,r.energyJPlusHa=i.energyJPlusHa}O.push(r)}let k=0,A=0,j=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*g[e]*g[e]*g[e]*h;k+=v[e]*t,A+=.5*v[e]*b[e]*t;let n=p?S[e]:Nt(v[e]);j+=(n-x[e]*v[e])*t}let M=d||f,N=f?t.map(e=>{let t=y.get(e.l)[e.n-e.l-1];return{n:e.n,l:e.l,occupancy:e.occupancy,energyHa:t.energyHa,u:Array.from(t.u)}}):null,P=T-A+j;return{totalEnergyHa:P,functional:p?`pbe`:`lda`,orbitals:O,electronCount:E,integratedElectrons:k,atomicNumberZ:e,...M?{radialGrid:{r:Array.from(g),rho:Array.from(v),dx:h,...N?{orbitalWavefunctions:N}:{}}}:{},...l?{relativisticCorrectionHa:D,totalEnergyRelHa:P+D}:{}}}function tn(e,t){let n=e+t;return n<=1e-12?0:n*At(xt(n),Math.max(-1,Math.min(1,(e-t)/n)))}function nn(e,t){let n=e*1e-4+1e-15,r=t*1e-4+1e-15;return{vUp:(tn(e+n,t)-tn(e-n,t))/(2*n),vDown:(tn(e,t+r)-tn(e,t-r))/(2*r)}}function rn(e,t,n,r,i){let a=new Float64Array(i),o=new Float64Array(i);for(let s of e){let e=s.n-s.l-1;if(s.occUp>0){let n=t.get(s.l)[e].u;for(let e=0;e<i;e+=1)a[e]+=s.occUp*n[e]*n[e]/(4*Math.PI*r[e]*r[e])}if(s.occDown>0){let t=n.get(s.l)[e].u;for(let e=0;e<i;e+=1)o[e]+=s.occDown*t[e]*t[e]/(4*Math.PI*r[e]*r[e])}}return{rhoUp:a,rhoDown:o}}function an({atomicNumberZ:e,spinConfiguration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=600,tol:s=1e-7,relativistic:c=!1}){let l=Math.log(r),u=(Math.log(i)-l)/(n-1),d=new Float64Array(n);for(let e=0;e<n;e+=1)d[e]=Math.exp(l+e*u);let f=new Map,p=new Map,m=0,h=0;for(let e of t)e.occUp>0&&f.set(e.l,Math.max(f.get(e.l)||0,e.n-e.l)),e.occDown>0&&p.set(e.l,Math.max(p.get(e.l)||0,e.n-e.l)),m+=e.occUp,h+=e.occDown;let g=m+h,_=new Float64Array(n),v=new Float64Array(n);for(let t=0;t<n;t+=1){let n=e*(e**3/Math.PI)*Math.exp(-2*e*d[t]);_[t]=m/g*n,v[t]=h/g*n}let y=new Map,b=new Map,x=new Float64Array(n),S=new Float64Array(n),C=new Float64Array(n),w=new Float64Array(n),T=new Float64Array(n);for(let r=0;r<o;r+=1){let i=new Float64Array(n);for(let e=0;e<n;e+=1)i[e]=_[e]+v[e];x=Jt(i,d,u);for(let t=0;t<n;t+=1){let{vUp:n,vDown:r}=nn(_[t],v[t]);S[t]=n,C[t]=r,w[t]=-e/d[t]+x[t]+n,T[t]=-e/d[t]+x[t]+r}y=new Map,b=new Map;for(let[e,t]of f)y.set(e,Yt(w,d,u,e,t));for(let[e,t]of p)b.set(e,Yt(T,d,u,e,t));let{rhoUp:o,rhoDown:c}=rn(t,y,b,d,n),l=0;for(let e=0;e<n;e+=1)l+=(Math.abs(o[e]-_[e])+Math.abs(c[e]-v[e]))*4*Math.PI*d[e]*d[e]*d[e]*u,_[e]=(1-a)*_[e]+a*o[e],v[e]=(1-a)*v[e]+a*c[e];if(l<s&&r>8)break}let E=0,D=0,O=[];for(let n of t){let t=n.n-n.l-1,r={n:n.n,l:n.l,occUp:n.occUp,occDown:n.occDown};if(n.occUp>0){let i=y.get(n.l)[t];r.energyUpHa=i.energyHa,E+=n.occUp*i.energyHa,c&&(D+=n.occUp*Xt({u:i.u,energyHa:i.energyHa,vFull:w,r:d,dx:u,l:n.l,atomicNumberZ:e}))}if(n.occDown>0){let i=b.get(n.l)[t];r.energyDownHa=i.energyHa,E+=n.occDown*i.energyHa,c&&(D+=n.occDown*Xt({u:i.u,energyHa:i.energyHa,vFull:T,r:d,dx:u,l:n.l,atomicNumberZ:e}))}O.push(r)}let k=0,A=0,j=0,M=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*d[e]*d[e]*d[e]*u,n=_[e]+v[e];k+=n*t,A+=(_[e]-v[e])*t,j+=.5*n*x[e]*t,M+=(tn(_[e],v[e])-S[e]*_[e]-C[e]*v[e])*t}let N=E-j+M;return{totalEnergyHa:N,spinMoment:A,orbitals:O,electronCount:g,integratedElectrons:k,atomicNumberZ:e,...c?{relativisticCorrectionHa:D,totalEnergyRelHa:N+D}:{}}}function on({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-6,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7,functional:c=`lda`,spinOrbit:l=!1,returnRadialDensity:u=!1,returnOrbitalWavefunctions:d=!1}){let f=String(c||`lda`).toLowerCase()===`pbe`,p=Math.log(r),m=(Math.log(i)-p)/(n-1),h=new Float64Array(n);for(let e=0;e<n;e+=1)h[e]=Math.exp(p+e*m);let g=new Map;for(let e of t)g.set(e.l,Math.max(g.get(e.l)||0,e.n-e.l));let _=new Float64Array(n);for(let t=0;t<n;t+=1)_[t]=e*(e**3/Math.PI)*Math.exp(-2*e*h[t]);let v=new Map,y=new Map,b=new Float64Array(n),x=new Float64Array(n),S=null,C=new Float64Array(n);for(let r=0;r<o;r+=1){if(b=Jt(_,h,m),f){let e=Vt(_,h,m);x=e.vXC,S=e.fxc;for(let e=0;e<n;e+=1)C[e]=b[e]+x[e]}else for(let e=0;e<n;e+=1)x[e]=Ft(_[e]),C[e]=b[e]+x[e];v=new Map;for(let[t,n]of g){let r=$t(C,h,m,t,n,e,y.get(t));y.set(t,r.map(e=>e.energyHa)),v.set(t,r)}let i=new Float64Array(n);for(let e of t){let t=v.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*h[r]*h[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-_[e])*4*Math.PI*h[e]*h[e]*h[e]*m,_[e]=(1-a)*_[e]+a*i[e];if(o<s&&r>8)break}let w=0,T=0,E=[];for(let n of t){let t=v.get(n.l)[n.n-n.l-1];w+=n.occupancy*t.energyHa,T+=n.occupancy;let r={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t.energyHa};if(l&&n.l>=1){let i=Zt({u:t.u,energyHa:t.energyHa,vElec:C,r:h,dx:m,l:n.l,atomicNumberZ:e});r.spinOrbitXiHa=i.xiHa,r.spinOrbitSplittingHa=i.splittingHa,r.energyJMinusHa=i.energyJMinusHa,r.energyJPlusHa=i.energyJPlusHa}E.push(r)}let D=0,O=0,k=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*h[e]*h[e]*h[e]*m;D+=_[e]*t,O+=.5*_[e]*b[e]*t;let n=f?S[e]:Nt(_[e]);k+=(n-x[e]*_[e])*t}let A=u||d,j=d?t.map(e=>{let t=v.get(e.l)[e.n-e.l-1];return{n:e.n,l:e.l,occupancy:e.occupancy,energyHa:t.energyHa,u:Array.from(t.u)}}):null;return{totalEnergyHa:w-O+k,functional:f?`pbe`:`lda`,orbitals:E,electronCount:T,integratedElectrons:D,atomicNumberZ:e,...A?{radialGrid:{r:Array.from(h),rho:Array.from(_),dx:m,...j?{orbitalWavefunctions:j}:{}}}:{},relativisticMethod:l?`koelling-harmon+spin-orbit`:`koelling-harmon`}}function sn(e,t={}){let r=t.gridPointsN??Math.round(1200+12*e),i=t.rMaxBohr??Math.max(20,60/Math.sqrt(e));if(t.spinPolarized){let n=t.spinConfiguration??C(e),a=an({atomicNumberZ:e,spinConfiguration:n,gridPointsN:r,rMaxBohr:i,...t});return{symbol:h(e),spinConfiguration:n,...a}}let a=t.configuration??n(e);if(t.scalarRelativistic){let n=on({atomicNumberZ:e,configuration:a,gridPointsN:r,rMaxBohr:i,...t});return{symbol:h(e),configuration:a,...n}}let o=en({atomicNumberZ:e,configuration:a,gridPointsN:r,rMaxBohr:i,...t});return{symbol:h(e),configuration:a,...o}}var cn={schema:`peercompute.ulg.conductor-optical-constants.v0`,schemaVersion:1,bankVersion:`johnson-christy-1972-visible-v1`,source:`P. B. Johnson and R. W. Christy, Optical Constants of the Noble Metals, Physical Review B 6, 4370-4379 (1972)`,doi:`10.1103/PhysRevB.6.4370`,referenceState:{phase:`solid`,temperature:`room-temperature laboratory measurement; numeric temperature not reported`,sample:`bulk-like evaporated films above the reported critical thickness`},notes:[`The checked-in values are measured complex refractive indices n + i*k, not selected display RGB colors.`,`Only the rows spanning the visible spectrum are retained. Runtime reflectance, absorption, spectral samples, and CIE/sRGB color are derived from n and k.`,`Use for liquid or elevated-temperature condensed phases is an explicitly labelled nearest-reference extrapolation until phase-specific optical constants are available.`],photonEnergyEv:[1.51,1.64,1.76,1.88,2.01,2.13,2.26,2.38,2.5,2.63,2.75,2.88,3,3.12,3.25,3.37,3.5],records:[{symbol:`Cu`,n:[.26,.24,.21,.22,.3,.7,1.02,1.18,1.22,1.25,1.24,1.25,1.28,1.32,1.33,1.36,1.37],k:[5.18,4.665,4.205,3.747,3.205,2.704,2.577,2.608,2.564,2.483,2.397,2.305,2.207,2.116,2.045,1.975,1.916]},{symbol:`Ag`,n:[.04,.03,.04,.05,.06,.05,.06,.05,.05,.05,.04,.04,.05,.05,.05,.07,.1],k:[5.727,5.242,4.838,4.483,4.152,3.858,3.586,3.324,3.093,2.869,2.657,2.462,2.275,2.07,1.864,1.657,1.419]},{symbol:`Au`,n:[.16,.14,.13,.14,.21,.29,.43,.62,1.04,1.31,1.38,1.45,1.46,1.47,1.46,1.48,1.5],k:[5.083,4.542,4.103,3.697,3.272,2.863,2.455,2.081,1.833,1.849,1.914,1.948,1.958,1.952,1.933,1.895,1.866]}]},ln=cn;function un(e){let t=String(e||``);return t?t[0].toUpperCase()+t.slice(1).toLowerCase():``}var dn=new Map((cn.records||[]).map(e=>[e.symbol,e]));function fn(e){return dn.get(un(e))||null}function pn(e,t,n){let r=Number(n);if(!Number.isFinite(r)||e.length!==t.length||t.length===0)return null;if(r<=t[0])return e[0];let i=t.length-1;if(r>=t[i])return e[i];for(let n=1;n<t.length;n+=1){if(r>t[n])continue;let i=t[n-1],a=t[n],o=(r-i)/(a-i);return e[n-1]+(e[n]-e[n-1])*o}return e[i]}function mn(e,t){let n=typeof e==`string`?fn(e):e,r=cn.photonEnergyEv||[];if(!n||!Array.isArray(n.n)||!Array.isArray(n.k))return null;let i=pn(n.n,r,t),a=pn(n.k,r,t);return Number.isFinite(i)&&Number.isFinite(a)?{n:i,k:a}:null}function hn({n:e,k:t}={}){let n=Number(e),r=Number(t);if(!Number.isFinite(n)||!Number.isFinite(r))return null;let i=(n-1)**2+r**2,a=(n+1)**2+r**2;return a>0?Math.min(1,Math.max(0,i/a)):null}function gn(e,t){let n=Number(e)*1e-9,r=Number(t);return!(n>0)||!(r>=0)?null:4*Math.PI*r/n}var _n=529177210903e-22,vn=27.211386245988,yn=6582119569e-25,bn=.36,xn=.22,Sn=.22,Cn=.04,wn=12,Tn=6,En=Object.freeze([380,430,480,530,580,630,680,730,780]),Dn=new Map,On=(e,t)=>ot(e,{multiplicity:t}).totalEnergyHa,kn=new Map,An=461.522,jn=273.16,Mn=611.657,Nn=25e5,Pn=997,Fn=1.225,In=11e-6,Ln=1.000293,Rn=1.333,zn=55e-8,Bn=`rayleigh-lorenz-mie-geometric-optics-diffraction-sphere-v1`,Vn=`clausius-clapeyron-monodisperse-lorenz-mie-v1`,Hn=Object.freeze({rayleighMaxSizeParameter:.1,rayleighMaxInternalSizeParameter:.1,rayleighMaxContrastMagnitudeSquared:1,exactMieMaxSizeParameter:32,exactMieMaxTerms:128,exactMieMinInternalSizeParameter:1e-5,exactMieEnergyRelativeTolerance:1e-4,geometricOpticsMinSizeParameter:80,geometricOpticsMinCentralPhaseDelay:48}),Un=Hn.rayleighMaxSizeParameter,Wn=Hn.rayleighMaxInternalSizeParameter,Gn=Hn.rayleighMaxContrastMagnitudeSquared,Kn=Hn.exactMieMaxSizeParameter,qn=Hn.exactMieMaxTerms,Jn=Hn.exactMieMinInternalSizeParameter,Yn=Hn.exactMieEnergyRelativeTolerance,Xn=Hn.geometricOpticsMinSizeParameter,Zn=Hn.geometricOpticsMinCentralPhaseDelay;function Qn(e,t,n,r){let i=(e-t)*(e<t?1/n:1/r);return Math.exp(-.5*i*i)}function $n(e){return 1.056*Qn(e,599.8,37.9,31)+.362*Qn(e,442,16,26.7)-.065*Qn(e,501.1,20.4,26.2)}function er(e){return .821*Qn(e,568.8,46.9,40.5)+.286*Qn(e,530.9,16.3,31.1)}function tr(e){return 1.217*Qn(e,437,11.8,36)+.681*Qn(e,459,26,13.8)}function nr(e){let t=Math.min(1,Math.max(0,e));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function rr(e){let t=0,n=0,r=0,i=0;for(let a=380;a<=780;a+=5){let o=e(a);t+=o*$n(a),n+=o*er(a),r+=o*tr(a),i+=er(a)}t/=i,n/=i,r/=i;let a=3.2406*t-1.5372*n-.4986*r,o=-.9689*t+1.8758*n+.0415*r,s=.0557*t-.204*n+1.057*r;return{r:nr(Math.max(0,a)),g:nr(Math.max(0,o)),b:nr(Math.max(0,s))}}function ir(e){let t=0,n=0;for(let r=380;r<=780;r+=5){let i=er(r);t+=e(r)*i,n+=i}return n>0?t/n:0}function ar(e){return Math.min(1,Math.max(0,Number.isFinite(e)?e:0))}function or(e){return Array.isArray(e)?[ar(e[0]),ar(e[1]),ar(e[2])]:[ar(e?.r),ar(e?.g),ar(e?.b)]}function sr(e){return Number.isFinite(e)?Number(e).toPrecision(10):String(e??`null`)}function cr(e){return e==null?`null`:Array.isArray(e)?`[${e.map(cr).join(`,`)}]`:typeof e==`object`?`{${lr(e)}}`:typeof e==`number`?sr(e):String(e)}function lr(e){return!e||typeof e!=`object`?`none`:Object.keys(e).sort().map(t=>`${t}:${cr(e[t])}`).join(`|`)}function ur(e,t=null){if(!e||typeof e!=`object`)return null;let n=String(t||``).toLowerCase(),r=Array.isArray(e.phases)?e.phases.find(e=>String(e?.name||``).toLowerCase()===n)||e.phases[0]:null,i=Number(r?.densityKgPerM3??e.densityKgPerM3);return Number.isFinite(i)&&i>0?i:null}function dr(e){return!Array.isArray(e)||e.length===0?`none`:e.map(e=>[e.from??`?`,e.to??`?`,sr(e.energyEv),sr(e.dampingEv),sr(e.strengthWeight)].join(`:`)).join(`|`)}function fr({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r,conductionElectronDensityPerM3:i,opticalState:a=null}={}){return[e??`unknown`,t??`unknown`,sr(n),lr(a),sr(i??r?.conductionElectronDensityPerM3),sr(ur(r,t)),sr(r?.electronicGapEv),sr(r?.ior??r?.refractiveIndex),sr(r?.gasElectronicExcitationEv),sr(r?.gasElectronicBandFwhmEv),sr(r?.gasElectronicOscillatorStrength),lr(r?.gasElectronicAbsorptionCrossSection),lr(r?.conductorOpticalConstants),dr(r?.opticalInterbandOscillators),Array.isArray(r?.intrinsicColorSrgb)?r.intrinsicColorSrgb.map(sr).join(`,`):`no-intrinsic`].join(`::`)}function pr(e){return{...e,baseColorSrgb:e.baseColorSrgb?[...e.baseColorSrgb]:e.baseColorSrgb,attenuationColor:e.attenuationColor?[...e.attenuationColor]:e.attenuationColor,interbandOscillators:Array.isArray(e.interbandOscillators)?e.interbandOscillators.map(e=>({...e})):e.interbandOscillators,spectralSamples:Array.isArray(e.spectralSamples)?e.spectralSamples.map(e=>({...e})):e.spectralSamples,dropletMicrophysics:e.dropletMicrophysics?{...e.dropletMicrophysics}:e.dropletMicrophysics,pbr:e.pbr?{...e.pbr,baseColorSrgb:e.pbr.baseColorSrgb?[...e.pbr.baseColorSrgb]:e.pbr.baseColorSrgb}:e.pbr,provenance:e.provenance?{...e.provenance,inputs:e.provenance.inputs?{...e.provenance.inputs}:e.provenance.inputs}:e.provenance}}function mr(e,{baseColorSrgb:t,renderModel:n,vertexColorPolicy:r=`material-pbr`,spectralSamples:i=[]}){let a=or(t);return{...e,baseColorSrgb:a,renderModel:n,vertexColorPolicy:r,spectralSamples:i,pbr:{baseColorSrgb:a,metalness:e.metalness,roughness:e.roughness,opacity:e.opacity,transmission:e.transmission,ior:e.ior??null,renderModel:n,vertexColorPolicy:r}}}function hr(e){return e>0?1-Math.exp(-Math.min(80,e)):0}function gr(e){let t=Number(e);return t>0?Mn*Math.exp(Nn/An*(1/jn-1/t)):null}function _r(e,t){return[e[0]+t[0],e[1]+t[1]]}function vr(e,t){return[e[0]-t[0],e[1]-t[1]]}function yr(e,t){return[e[0]*t[0]-e[1]*t[1],e[0]*t[1]+e[1]*t[0]]}function br(e,t){return[e[0]*t,e[1]*t]}function xr(e,t){let n=t[0]*t[0]+t[1]*t[1];return[(e[0]*t[0]+e[1]*t[1])/n,(e[1]*t[0]-e[0]*t[1])/n]}function Sr(e){return e[0]*e[0]+e[1]*e[1]}function Cr(e,t){return e[0]*t[0]+e[1]*t[1]}function wr(e,t){let n=yr(t,t),r=xr(vr(n,[1,0]),_r(n,[2,0]));return{scatteringEfficiencyQsca:8/3*e**4*Sr(r),absorptionEfficiencyQabs:Math.max(0,4*e*r[1]),asymmetryFactorG:0}}function Tr(e,t){if(e>Un||Math.hypot(t[0],t[1])*e>Wn)return!1;let n=yr(t,t),r=_r(n,[2,0]);if(!(Sr(r)>0))return!1;let i=Sr(xr(vr(n,[1,0]),r));return Number.isFinite(i)&&i<=Gn}function Er(e,t){let n=e,r=br(t,n);if(Math.hypot(r[0],r[1])<=Jn)return{valid:!1,failureReason:`internal-size-parameter-below-numeric-floor`,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,asymmetryFactorG:0};let i=Math.ceil(n+4*Math.cbrt(n)+2),a=Math.ceil(Math.max(i+16,Math.hypot(r[0],r[1])+16));if(i>=qn||a>=qn)return null;let o=Array.from({length:a+1},()=>[0,0]);for(let e=a;e>0;--e){let t=xr([e,0],r);o[e-1]=vr(t,xr([1,0],_r(o[e],t)))}let s=Math.cos(n),c=Math.sin(n),l=-Math.sin(n),u=Math.cos(n),d=[c,-u],f=[0,0],p=[0,0],m=0,h=0,g=0;for(let e=1;e<=i;e+=1){let r=(2*e-1)/n,i=r*c-s,a=r*u-l,_=[i,-a],v=[e/n,0],y=_r(xr(o[e],t),v),b=_r(yr(t,o[e]),v),x=xr(vr(br(y,i),[c,0]),vr(yr(y,_),d)),S=xr(vr(br(b,i),[c,0]),vr(yr(b,_),d)),C=2*e+1;if(m+=C*(Sr(x)+Sr(S)),h+=C*(x[0]+S[0]),g+=C/(e*(e+1))*Cr(x,S),e>1){let t=(e-1)*(e+1)/e;g+=t*(Cr(f,x)+Cr(p,S))}f=x,p=S,s=c,c=i,l=u,u=a,d=_}let _=2/(n*n),v=Math.max(0,_*m),y=_*h,b=Yn*Math.max(1,v,Math.abs(y));return!Number.isFinite(y)||y+b<v?{valid:!1,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,asymmetryFactorG:0}:{valid:!0,scatteringEfficiencyQsca:v,absorptionEfficiencyQabs:Math.max(0,Math.max(v,y)-v),asymmetryFactorG:v>0?Math.max(-1,Math.min(1,4*g/(n*n*v))):0}}function Dr(e,t,n){if(t[1]>0)return null;if(t[0]===1)return{scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,asymmetryFactorG:0};if(e<Xn||2*e*Math.abs(t[0]-1)<Zn)return null;let r=Math.max(0,Math.min(1,1-1/(2*e*e)));return{scatteringEfficiencyQsca:2,absorptionEfficiencyQabs:0,asymmetryFactorG:Math.max(-1,Math.min(1,.5*(r+n)))}}function Or({relativeRefractiveIndexN:e,quadratureSteps:t=128}={}){let n=Number(e),r=Number(t);if(!(n>0)||!Number.isInteger(r)||r<8)throw RangeError(`sphere ray asymmetry requires positive relative index and at least eight quadrature steps`);let i=0;for(let e=0;e<r;e+=1){let t=(e+.5)/r,a=Math.sqrt(Math.max(0,1-t*t)),o=t/n,s=1,c=0;if(o<1){let e=Math.sqrt(1-o*o),r=a+n*e,i=n*a+e,l=r===0?1:(a-n*e)/r,u=i===0?1:(n*a-e)/i;s=.5*(l*l+u*u);let d=Math.asin(t),f=Math.asin(o),p=2*(d-f),m=Math.PI-2*f,h=1-2*s*Math.cos(m)+s*s;c=h>0?(1-s)**2/h*(Math.cos(p)*(1-s*Math.cos(m))-Math.sin(p)*s*Math.sin(m)):0}let l=2*t*t-1;i+=2*t/r*(s*l+c)}return Math.max(-1,Math.min(1,i))}function kr({radiusM:e,wavelengthM:t,relativeRefractiveIndexN:n,relativeExtinctionCoefficientK:r=0,largeSizeRayAsymmetryFactorG:i=null}={}){let a=Number(e),o=Number(t),s=Number(n),c=Number(r);if(!(a>0)||!(o>0)||!(s>0)||!(c>=0)||![a,o,s,c].every(Number.isFinite))throw RangeError(`sphere optical efficiency requires positive radius/wavelength/index and nonnegative extinction coefficient`);let l=2*Math.PI*a/o;if(s===1&&c===0)return Object.freeze({model:Bn,regime:`index-matched-no-scattering`,valid:!0,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,extinctionEfficiencyQext:0,asymmetryFactorG:0});let u=[s,c],d,f;if(Tr(l,u))d=`rayleigh-small-sphere`,f=wr(l,u);else if(l<=Kn){if(f=Er(l,u),f==null)return Object.freeze({model:Bn,regime:`blocked-exact-mie-term-cap`,valid:!1,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,extinctionEfficiencyQext:0,asymmetryFactorG:0});if(f?.valid===!1){let e=f.failureReason||`energy-balance-failure`;return Object.freeze({model:Bn,regime:`blocked-exact-mie-${e}`,valid:!1,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,extinctionEfficiencyQext:0,asymmetryFactorG:0})}d=`exact-lorenz-mie-series`}if(!f){d=`geometric-optics-diffraction-lossless-large-sphere-asymptotic`;let e=i==null?Or({relativeRefractiveIndexN:s}):Number(i);if(!Number.isFinite(e)||Math.abs(e)>1)throw RangeError(`large-size ray asymmetry must be finite in [-1, 1]`);if(f=Dr(l,u,e),!f)return Object.freeze({model:Bn,regime:c>0?`blocked-absorbing-large-sphere-asymptotic-unavailable`:`blocked-lossless-large-sphere-asymptotic-domain-unavailable`,valid:!1,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,extinctionEfficiencyQext:0,asymmetryFactorG:0})}return!Number.isFinite(f.scatteringEfficiencyQsca)||!Number.isFinite(f.absorptionEfficiencyQabs)||!Number.isFinite(f.asymmetryFactorG)||f.scatteringEfficiencyQsca<0||f.absorptionEfficiencyQabs<0||Math.abs(f.asymmetryFactorG)>1?Object.freeze({model:Bn,regime:`blocked-nonfinite-or-nonphysical-sphere-efficiency`,valid:!1,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,scatteringEfficiencyQsca:0,absorptionEfficiencyQabs:0,extinctionEfficiencyQext:0,asymmetryFactorG:0}):Object.freeze({model:Bn,regime:d,sizeParameter:l,referenceWavelengthM:o,relativeRefractiveIndexN:s,relativeExtinctionCoefficientK:c,valid:!0,scatteringEfficiencyQsca:f.scatteringEfficiencyQsca,absorptionEfficiencyQabs:f.absorptionEfficiencyQabs,extinctionEfficiencyQext:f.scatteringEfficiencyQsca+f.absorptionEfficiencyQabs,asymmetryFactorG:f.asymmetryFactorG})}function Ar({referenceWavelengthM:e=zn,mediumRefractiveIndexN:t=Ln}={}){let n=Number(e),r=Number(t);if(!(n>0)||!(r>0))throw RangeError(`water sphere optics require positive wavelength and medium index`);let i=Rn/r;return Object.freeze({referenceWavelengthM:n,relativeRefractiveIndexN:i,relativeExtinctionCoefficientK:0,largeSizeRayAsymmetryFactorG:Or({relativeRefractiveIndexN:i}),provenance:Object.freeze({status:`reference-fallback`,source:`hale-querry-1973-liquid-water-visible-index-550nm-lossless-approximation`,method:`Hale-Querry visible liquid-water refractive index at 550 nm, rounded to n=1.333 and made relative to the carrier gas; k=0 because no quantitative visible absorption spectrum is available to this closure`,blockers:Object.freeze([`h2o-visible-complex-index-spectrum-not-reference-anchored`,`h2o-condensate-size-distribution-not-produced`])})})}function jr(e,{scatteringCoefficientPerM:t,dropletRadiusM:n,dropletNumberDensityPerM3:r,dropletCrossSectionM2:i,relativeRefractiveIndexN:a,relativeExtinctionCoefficientK:o,largeSizeRayAsymmetryFactorG:s}){if(!(t>0))return 0;let c=Number(n);if(!(c>0)||!(r>0)||!(i>0))return 0;let l=kr({radiusM:c,wavelengthM:e*1e-9,relativeRefractiveIndexN:a,relativeExtinctionCoefficientK:o,largeSizeRayAsymmetryFactorG:s});return r*i*l.scatteringEfficiencyQsca}function Mr({temperatureK:e=null,h2oPartialPressurePa:t=null,pressurePa:n=null,conservedCondensedMassDensityKgPerM3:r=null,dropletRadiusM:i=null,pathLengthM:a=.3}={}){let o=Number(e),s=Number(t??n),c=r!=null&&Number.isFinite(Number(r))&&Number(r)>=0,l=Number(r),u=Number(i),d=gr(o),f=Ar(),p=({status:e,supersaturationRatio:t=null,condensedMassFraction:r=0,vaporDensityKgPerM3:i=0,condensedMassDensityKgPerM3:l=0})=>({model:Vn,status:e,temperatureK:Number.isFinite(o)?o:null,h2oPartialPressurePa:Number.isFinite(s)?s:null,pressurePa:Number.isFinite(Number(n))?Number(n):null,saturationPressurePa:d,supersaturationRatio:t,condensedMassFraction:r,vaporDensityKgPerM3:i,condensedMassDensityKgPerM3:l,condensedMassAuthority:c?`caller-supplied-conserved-condensed-mass-density`:null,dropletRadiusM:Number.isFinite(u)&&u>0?u:null,dropletNumberDensityPerM3:0,dropletCrossSectionM2:0,referenceWavelengthM:f.referenceWavelengthM,relativeRefractiveIndexN:f.relativeRefractiveIndexN,relativeExtinctionCoefficientK:f.relativeExtinctionCoefficientK,largeSizeRayAsymmetryFactorG:f.largeSizeRayAsymmetryFactorG,opticalEfficiencyModel:Bn,opticalEfficiencyRegime:null,mieScatteringEfficiency:0,mieAbsorptionEfficiency:0,mieExtinctionEfficiency:0,asymmetryFactorG:0,scatteringCoefficientPerM:0,absorptionCoefficientPerM:0,extinctionCoefficientPerM:0,opticalDepth:0,pathLengthM:a,provenance:f.provenance});if(!(o>0)||!(s>0)||!(d>0))return p({status:`pure-vapor-or-state-missing`});let m=s/d,h=s/(An*o);if(!c)return p({status:`condensate-optics-blocked-missing-conserved-mass`,supersaturationRatio:m,vaporDensityKgPerM3:h});let g=l,_=g>0?ar(g/(g+h)):0;if(!(_>0))return p({status:m>1?`supersaturated-zero-conserved-condensate`:`subsaturated-pure-vapor`,supersaturationRatio:m,condensedMassFraction:_,vaporDensityKgPerM3:h,condensedMassDensityKgPerM3:g});if(!(u>0))return p({status:`conserved-condensate-optics-blocked-missing-radius`,supersaturationRatio:m,condensedMassFraction:_,vaporDensityKgPerM3:h,condensedMassDensityKgPerM3:g});let v=4/3*Math.PI*u**3*Pn,y=v>0?g/v:0,b=Math.PI*u**2,x=kr({radiusM:u,wavelengthM:f.referenceWavelengthM,relativeRefractiveIndexN:f.relativeRefractiveIndexN,relativeExtinctionCoefficientK:f.relativeExtinctionCoefficientK,largeSizeRayAsymmetryFactorG:f.largeSizeRayAsymmetryFactorG});if(x.valid!==!0)return p({status:`conserved-condensate-optics-blocked-efficiency-domain`,supersaturationRatio:m,condensedMassFraction:_,vaporDensityKgPerM3:h,condensedMassDensityKgPerM3:g});let S=y*b*x.scatteringEfficiencyQsca,C=y*b*x.absorptionEfficiencyQabs,w=S+C,T=w*Math.max(0,Number(a)||0);return{model:Vn,status:`conserved-condensed-droplets`,temperatureK:o,h2oPartialPressurePa:s,pressurePa:Number.isFinite(Number(n))?Number(n):null,saturationPressurePa:d,supersaturationRatio:m,condensedMassFraction:_,vaporDensityKgPerM3:h,condensedMassDensityKgPerM3:g,condensedMassAuthority:`caller-supplied-conserved-condensed-mass-density`,dropletRadiusM:u,dropletNumberDensityPerM3:y,dropletCrossSectionM2:b,referenceWavelengthM:f.referenceWavelengthM,relativeRefractiveIndexN:f.relativeRefractiveIndexN,relativeExtinctionCoefficientK:f.relativeExtinctionCoefficientK,largeSizeRayAsymmetryFactorG:f.largeSizeRayAsymmetryFactorG,opticalEfficiencyModel:x.model,opticalEfficiencyRegime:x.regime,mieScatteringEfficiency:x.scatteringEfficiencyQsca,mieAbsorptionEfficiency:x.absorptionEfficiencyQabs,mieExtinctionEfficiency:x.extinctionEfficiencyQext,asymmetryFactorG:x.asymmetryFactorG,scatteringCoefficientPerM:S,absorptionCoefficientPerM:C,extinctionCoefficientPerM:w,opticalDepth:T,pathLengthM:a,provenance:f.provenance}}function Nr(e,t){return[e[0]+t[0],e[1]+t[1]]}function Pr(e,t){return[e[0]-t[0],e[1]-t[1]]}function Fr(e,t){let n=t[0]*t[0]+t[1]*t[1];return[(e[0]*t[0]+e[1]*t[1])/n,(e[1]*t[0]-e[0]*t[1])/n]}function Ir(e){let[t,n]=e,r=Math.hypot(t,n);return[Math.sqrt(Math.max(0,(r+t)/2)),Math.sign(n||1)*Math.sqrt(Math.max(0,(r-t)/2))]}function Lr(e){let[t,n]=Ir(e);return((t-1)**2+n**2)/((t+1)**2+n**2)}function Rr(e,t){let[,n]=Ir(t);return 4*Math.PI*Math.max(0,n)/(e*1e-9)}function zr(e,t,n){let[r,i]=Ir(t),a=Rr(e,t);return{wavelengthNm:e,reflectance:ar(Lr(t)),transmittance:Math.exp(-Math.min(80,a*Math.max(0,n))),absorptionCoefficientPerM:a,scatteringCoefficientPerM:0,n:r,k:i}}function Br(e,t){return mn(e,1239.841984/t)}function Vr(e,t){return hn(Br(e,t))??0}function Hr(e){let t=fn(e);return t?rr(e=>Vr(t,e)):null}function Ur(e,t){let n=t?.conductorOpticalConstants;return!n||n.bankVersion!==ln.bankVersion?null:fn(n.symbol||e)}function Wr(e,{phase:t=`solid`,pathLengthM:n=.3,marker:r=null}={}){let i=t=>Vr(e,t),a=ir(t=>gn(t,Br(e,t)?.k)??0),o=ir(i),s=a*Math.max(0,n),c=hr(s),l=Math.exp(-Math.min(80,s)),u=rr(i),d=En.map(t=>{let r=Br(e,t),a=gn(t,r?.k)??0;return{wavelengthNm:t,reflectance:i(t),transmittance:Math.exp(-Math.min(80,a*Math.max(0,n))),absorptionCoefficientPerM:a,scatteringCoefficientPerM:0,n:r?.n??null,k:r?.k??null}}),f=t===`solid`?`within-reference-phase`:`nearest-reference-condensed-phase-extrapolation`;return mr({metalness:c>.5?1:c,roughness:.32,transmission:l,ior:null,opacity:c,attenuationColor:null,attenuationDistanceM:a>0?1/a:1/0,condensationScatter:0,internalScatter:0,opticalDepth:s,absorptionCoefficientPerM:a,reflectance:o,provenance:{status:`reference-fallback`,source:`johnson-christy-1972-complex-index`,method:`measured complex refractive index interpolation -> normal-incidence Fresnel reflectance + skin-depth absorption -> CIE 1931 equal-energy sRGB`,inputs:{symbol:e.symbol,phase:t,phaseApplication:f,pathLengthM:n,bankVersion:ln.bankVersion,doi:ln.doi,marker:r},validation:!1}},{baseColorSrgb:[u.r,u.g,u.b],renderModel:`conductor-reference-complex-index`,spectralSamples:d})}function Gr(e,{absorptionCoefficientPerM:t,pathLengthM:n,reflectance:r=0,scatteringCoefficientPerM:i=0,n:a=null,k:o=null}){let s=Math.max(0,t??0);return{wavelengthNm:e,reflectance:ar(r),transmittance:Math.exp(-Math.min(80,s*Math.max(0,n))),absorptionCoefficientPerM:s,scatteringCoefficientPerM:Math.max(0,i),n:a,k:o}}function Kr(e,t=1){let n=(550/Math.max(1,Number(e)||550))**4;return In*Math.max(0,Number.isFinite(t)?t:1)*n}function qr({phase:e=`gas`,pathLengthM:t=.3,properties:n=null}={}){let r=ur(n,e)??Fn,i=r/Fn,a=ir(e=>Kr(e,i)),o=a*Math.max(0,t),s=Math.exp(-Math.min(80,o)),c=hr(o),l=rr(e=>.85+.15*(450/e)**4),u=En.map(e=>Gr(e,{absorptionCoefficientPerM:0,pathLengthM:t,reflectance:0,scatteringCoefficientPerM:Kr(e,i),n:Ln,k:0}));return mr({metalness:0,roughness:.92,transmission:s,ior:Ln,opacity:c,attenuationColor:[1,1,1],attenuationDistanceM:1/0,condensationScatter:0,internalScatter:a,scatteringCoefficientPerM:a,opticalDepth:o,absorptionCoefficientPerM:0,provenance:{status:`derived`,source:`dry-air-rayleigh-scattering-reference-composition`,method:`standard dry-air density + Rayleigh 1/lambda^4 molecular scattering -> optically thin transparent PBR row`,inputs:{phase:e,pathLengthM:t,densityKgPerM3:r,densityScale:i},validation:!1}},{baseColorSrgb:[l.r,l.g,l.b],renderModel:`gas-rayleigh-transparent-pbr`,spectralSamples:u})}function Jr(e){return typeof e!=`string`||e.length===0?null:l(e[0].toUpperCase()+e.slice(1).toLowerCase())??null}function Yr(e){return 2*(2*e+1)}function Xr(e){return`${e.n}${`spdfg`[e.l]??`l${e.l}`}`}function Zr(e){return n(e).some(e=>e.l>=2&&e.occupancy>0)}function Qr(e){let t=n(e).map(e=>({...e})),r=(e,n)=>{let r=Math.max(e,n+1);for(;t.some(e=>e.n===r&&e.l===n);)r+=1;t.push({n:r,l:n,occupancy:0})};for(let e of[...t])if(!(e.occupancy<=0||e.l<2))for(let t of[e.l-1,e.l+1])t<0||t>4||r(e.n+1,t);return t.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l)}function $r(e,t={}){if(!Zr(e))return[];let n=t.gridPointsN??900,r=t.rMaxBohr??42,i=t.maxScf??160,a=`${e}:${n}:${r}:${i}:so`;if(kn.has(a))return kn.get(a);let o=sn(e,{scalarRelativistic:!0,spinOrbit:!0,configuration:Qr(e),gridPointsN:n,rMaxBohr:r,maxScf:i}),s=o.orbitals.filter(e=>e.occupancy>0),c=o.orbitals.filter(e=>e.occupancy<Yr(e.l)),l=[];for(let e of s){if(e.l<2)continue;let t=Number.isFinite(e.energyJPlusHa)?e.energyJPlusHa:e.energyHa;for(let n of c){if(n.n===e.n&&n.l===e.l||Math.abs(n.l-e.l)!==1||n.energyHa<=t)continue;let r=(n.energyHa-t)*vn;if(!(r>0)||r>wn)continue;let i=n.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),a=Math.min(1,Math.max(0,e.occupancy/Yr(e.l))),o=Math.min(1,Math.max(0,1-n.occupancy/Yr(n.l))),s=e.l>=2?1:.35,c=a*o*i*s;c>0&&l.push({from:Xr(e),to:Xr(n),fromL:e.l,toL:n.l,occupancy:e.occupancy,targetOccupancy:n.occupancy,rawEnergyEv:r,strengthWeight:c})}}let u=l.sort((e,t)=>e.rawEnergyEv-t.rawEnergyEv||t.strengthWeight-e.strengthWeight).slice(0,Tn);return kn.set(a,u),u}function ei(e){let t=Math.max(0,e)*_n**3;if(!(t>0))return 0;let n=(3*Math.PI*Math.PI*t)**(1/3);return Math.sqrt(4*n/Math.PI)}function ti({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n={}}={}){if(!(e>0)||!(t>0))return[];let r=ei(t),i=.5*vn*r*r;return $r(e,n).map(e=>{let t=e.rawEnergyEv/vn,n=Math.sqrt(1+(r/Math.sqrt(Math.max(t,1e-6)))**2),a=Cn*i*Math.sqrt(Math.max(e.strengthWeight,0)),o=e.rawEnergyEv;return{...e,energyEv:o,thomasFermiScreeningRatio:n,electronGasEnergyEv:i,bandBroadeningEv:a,thomasFermiWavevectorBohr:r,dampingEv:Math.max(xn,Sn*o+a)}}).filter(e=>e.energyEv>.15&&e.energyEv<8).sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight).slice(0,Tn)}var ni=1602176634e-28,ri=88541878128e-22,ii=91093837015e-41;function ai(e){return Math.sqrt(e*ni*ni/(ri*ii))}function oi(e,{plasmaEnergyEv:t,dampingEv:n,oscillators:r}){let i=[1,0];i=Pr(i,Fr([t*t,0],[e*e,e*n]));for(let n of r||[]){let r=bn*t*t*n.strengthWeight;i=Nr(i,Fr([r,0],[n.energyEv*n.energyEv-e*e,-n.dampingEv*e]))}return i}function si(e,{atomicNumberZ:t=null,conductionElectronDensityPerM3:n,interbandOptions:r={},interbandOscillators:i=null}={}){let a=yn*ai(n),o=a/30,s=Array.isArray(i)?i:t?ti({atomicNumberZ:t,conductionElectronDensityPerM3:n,options:r}):[];return Lr(oi(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}))}function ci({atomicNumberZ:e=null,conductionElectronDensityPerM3:t,interbandOptions:n={},interbandOscillators:r=null}={}){if(!(t>0))return{r:.7,g:.7,b:.7,interbandOscillators:[]};let i=Array.isArray(r)?r:e?ti({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n}):[],a=rr(r=>si(r,{atomicNumberZ:e,conductionElectronDensityPerM3:t,interbandOptions:n,interbandOscillators:i}));return{r:a.r,g:a.g,b:a.b,plasmaRadPerS:ai(t),interbandOscillators:i}}function li(e,{pathLengthM:t=.3,atomicNumberZ:n=null,interbandOptions:r={},interbandOscillators:i=null}={}){let a=yn*ai(e),o=a/30,s=Array.isArray(i)?i:n?ti({atomicNumberZ:n,conductionElectronDensityPerM3:e,options:r}):[],c=e=>oi(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}),l=e=>Lr(c(e)),u=ir(e=>Rr(e,c(e))),d=ir(l),f=u*Math.max(0,t),p=hr(f),m=Math.exp(-Math.min(80,f)),h=rr(l),g=En.map(e=>zr(e,c(e),t));return mr({metalness:p>.5?1:p,roughness:.32,transmission:m,ior:null,opacity:p,attenuationColor:null,attenuationDistanceM:u>0?1/u:1/0,condensationScatter:0,internalScatter:0,opticalDepth:f,absorptionCoefficientPerM:u,reflectance:d,interbandOscillators:s,provenance:{status:`derived`,source:s.length?`scalar-relativistic-kohn-sham-drude-lorentz-skin-depth`:`drude-free-electron-skin-depth`,method:s.length?`conduction electron density + scalar-relativistic Kohn-Sham dipole-allowed interband transitions -> Drude-Lorentz complex index -> luminous skin-depth opacity`:`conduction electron density -> plasma frequency -> complex index -> luminous absorption coefficient -> Beer-Lambert opacity`,inputs:{atomicNumberZ:n,conductionElectronDensityPerM3:e,pathLengthM:t,damping:`omega_p/30`,oscillatorCount:s.length},validation:!1}},{baseColorSrgb:[h.r,h.g,h.b],renderModel:s.length?`conductor-drude-lorentz-relativistic-interband`:`conductor-drude-free-electron`,spectralSamples:g})}var ui=null;function di(){if(ui!=null)return ui;let e=e=>On([{Z:8,position:[0,0,0]},{Z:1,position:[0,0,e]}],2),t=1.83,n=.02,r=(e(1.85)-2*e(t)+e(t-n))/(n*n),i=529177210903e-22,a=r*43597447222071e-31/(i*i);return ui=Math.sqrt(Math.max(a,0)/(15.999*1.008/17.007*16605390666e-37))/(2*Math.PI*29979245800),ui}var fi=.12,pi=.02,mi=120;function hi(e){let t=di(),n=1e7/e,r=.001;for(let e=2;e<=9;e+=1){let i=e*t*(1-pi*e),a=.06*i,o=(n-i)/a;r+=mi*fi**e*Math.exp(-o*o)}return r}function gi({material:e,phase:t=`solid`,pathLengthM:n=3,conductionElectronDensityPerM3:r=null,properties:i=null}){if(t===`gas`&&i?.gasElectronicExcitationEv>0){let e=Oi({properties:i,pathLengthM:Math.min(n,.3)});if(e?.baseColorSrgb){let[t,n,r]=e.baseColorSrgb;return{r:t,g:n,b:r}}}if(t!==`gas`&&t!==`plasma`){let t=Ur(e,i);if(t)return Hr(t.symbol)}if(r>0){let t=ci({atomicNumberZ:Jr(e),conductionElectronDensityPerM3:r});return{r:t.r,g:t.g,b:t.b}}if(e===`h2o`){let e=0,n=0;for(let t=380;t<=780;t+=5){let r=er(t);e+=hi(t)*r,n+=r}let r=e/n,i=(t===`gas`?.03:t===`solid`?.6:1)/r;return rr(e=>Math.exp(-hi(e)*i))}return e===`air`?rr(e=>.85+.15*(450/e)**4):{r:.7,g:.7,b:.7}}var _i=Object.freeze({waterLiquid:Rn,waterIce:1.309,waterVapor:1.00025});function vi(){let e=0,t=0;for(let n=380;n<=780;n+=5){let r=er(n);e+=hi(n)*r,t+=r}let n=e/t,r=n>0?1/n:1e3,i=rr(e=>Math.exp(-hi(e)*r));return{attenuationColor:[i.r,i.g,i.b],attenuationDistanceM:r}}function yi(e,{properties:t,phase:n=`solid`}){let r=t?.electronicGapEv;if(!(r>=0))return null;let i=1239.841984/e;if(i<=r)return 0;let a=ur(t,n),o=t?.molarMassKgPerMol;if(!(a>0)||!(o>0))return null;let s=a/o*602214076e15,c=(1/s)**(2/3),l=Math.min(1,Math.max(0,(i-r)/Math.max(1,i)));return s*c*l}function bi(e){let t=Number(e?.ior??e?.refractiveIndex);if(Number.isFinite(t)&&t>1)return t;let n=Number(e?.electronicGapEv);if(Number.isFinite(n)&&n>0){let e=13.6/(n+3.47);return Math.max(1.05,Math.min(3.5,Math.sqrt(1+e*e)))}return 1.4}function xi({properties:e,phase:t=`solid`,pathLengthM:n=.3}){if(yi(500,{properties:e,phase:t})==null)return null;let r=n=>yi(n,{properties:e,phase:t})??0,i=ir(r),a=i*Math.max(0,n),o=hr(a),s=rr(e=>Math.exp(-r(e)*Math.max(0,n))),c=e?.intrinsicColorSrgb??[s.r,s.g,s.b],l=bi(e),u=((l-1)/(l+1))**2,d=En.map(e=>Gr(e,{absorptionCoefficientPerM:r(e),pathLengthM:n,reflectance:u,n:l,k:0}));return mr({metalness:0,roughness:t===`liquid`?.1:.4,transmission:Math.min(1,Math.max(0,(1-u)*Math.exp(-Math.min(80,a)))),ior:l,opacity:o,attenuationColor:e?.intrinsicColorSrgb??[s.r,s.g,s.b],attenuationDistanceM:i>0?1/i:1/0,condensationScatter:0,internalScatter:0,opticalDepth:a,absorptionCoefficientPerM:i,provenance:{status:`derived`,source:`molecular-gap-geometric-absorption`,method:`electronic gap + formula density -> Herve-Vandamme dielectric index + geometric oscillator absorption -> Beer-Lambert opacity`,inputs:{electronicGapEv:e?.electronicGapEv,ior:l,pathLengthM:n,phase:t},validation:!1}},{baseColorSrgb:c,renderModel:`molecular-gap-pbr`,spectralSamples:d})}var Si=.001,Ci=2654e-9,wi=0xdbea32fbe840;function Ti(e,{excitationEv:t,numberDensityPerM3:n,bandSigmaEv:r,oscillatorStrength:i}){if(!(t>0)||!(n>0))return 0;let a=1239.841984/e,o=r>0?r:t/6,s=i>0?i:Si,c=o*wi,l=Ci*s/(Math.sqrt(2*Math.PI)*c),u=a-t;return n*l*Math.exp(-(u*u)/(2*o*o))}var Ei=1/(2*Math.sqrt(2*Math.LN2));function Di(e,t){let n=t?.wavelengthNm,r=t?.crossSectionM2;if(!Array.isArray(n)||!Array.isArray(r)||n.length===0||n.length!==r.length)return null;let i=Number(e);if(!Number.isFinite(i))return null;if(i<=n[0])return Math.max(0,Number(r[0])||0);let a=n.length-1;if(i>=n[a])return Math.max(0,Number(r[a])||0);for(let e=1;e<n.length;e+=1){if(i>n[e])continue;let t=Number(n[e-1]),a=Number(n[e]),o=(i-t)/(a-t),s=Number(r[e-1])||0,c=Number(r[e])||0;return Math.max(0,s+(c-s)*o)}return Math.max(0,Number(r[a])||0)}function Oi({properties:e,pathLengthM:t=.3}){let n=e?.gasElectronicExcitationEv;if(!(n>0))return null;let r=ur(e,`gas`),i=e?.molarMassKgPerMol;if(!(r>0)||!(i>0))return null;let a=r/i*602214076e15,o=e?.gasElectronicBandFwhmEv>0?e.gasElectronicBandFwhmEv*Ei:null,s=e?.gasElectronicOscillatorStrength??null,c=e?.gasElectronicAbsorptionCrossSection||null,l=Di(450,c)!=null,u=l?e=>a*Di(e,c):e=>Ti(e,{excitationEv:n,numberDensityPerM3:a,bandSigmaEv:o,oscillatorStrength:s}),d=ir(u),f=d*Math.max(0,t),p=hr(f),m=Math.exp(-Math.min(80,f)),h=1.0005,g=rr(e=>Math.exp(-u(e)*Math.max(.01,t))),_=En.map(e=>Gr(e,{absorptionCoefficientPerM:u(e),pathLengthM:t,reflectance:((h-1)/2.0004999999999997)**2,n:h,k:0}));return mr({metalness:0,roughness:1,transmission:m,ior:h,opacity:p,attenuationColor:[g.r,g.g,g.b],attenuationDistanceM:d>0?1/d:1/0,condensationScatter:0,internalScatter:0,opticalDepth:f,absorptionCoefficientPerM:d,provenance:{status:l?`reference-fallback`:`derived`,source:l?`measured-molecular-gas-absorption-cross-section`:`delta-scf-electronic-band-gas-absorption`,method:l?`measured wavelength-resolved molecular absorption cross section -> number-density extinction -> Beer-Lambert transmission and CIE color`:`electronic band centre (banked spectroscopic or ΔSCF) -> Gaussian Franck-Condon continuum (banked FWHM or E0/6) -> Thomas-Reiche-Kuhn cross-section (banked f or 1e-3 weak-continuum estimate) -> Beer-Lambert`,inputs:{gasElectronicExcitationEv:n,bandSigmaEv:o,oscillatorStrength:s,pathLengthM:t,numberDensityPerM3:a,absorptionCrossSectionDoi:l?c.doi:null,absorptionCrossSectionTemperatureK:l?c.temperatureK:null},validation:!1}},{baseColorSrgb:[g.r,g.g,g.b],renderModel:l?`molecular-gas-reference-cross-section-pbr`:`molecular-gas-electronic-band-absorption-pbr`,spectralSamples:_})}function ki({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r=null,conductionElectronDensityPerM3:i=null,opticalState:a=null}={}){if(t!==`gas`&&t!==`plasma`){let i=Ur(e,r);if(i)return Wr(i,{phase:t,pathLengthM:n,marker:r.conductorOpticalConstants})}let o=i??r?.conductionElectronDensityPerM3??null;if(o>0)return li(o,{pathLengthM:n,atomicNumberZ:Jr(e),interbandOscillators:r?.opticalInterbandOscillators});if(e===`air`)return qr({phase:t,pathLengthM:n,properties:r});if(e===`h2o`||e===`steam`||e===`ice`){let r=e===`steam`||t===`gas`,i=e===`ice`||t===`solid`,o=r?_i.waterVapor:i?_i.waterIce:_i.waterLiquid,s=((o-1)/(o+1))**2,c=vi(),l=r?[1,1,1]:c.attenuationColor,u=r?c.attenuationDistanceM*50:c.attenuationDistanceM,d=1/u,f=d*Math.max(0,n),p=r?Mr({...a||{},pathLengthM:n}):null,m=p?.scatteringCoefficientPerM||0,h=f+(p?.opticalDepth||0),g=Math.exp(-Math.min(80,h)),_=Math.min(1,Math.max(0,(1-s)*g)),v=hr(h),y=r?m>0?1:.9:i?.5:.08,b=r?`gas`:i?`solid`:`liquid`,x=m>0?rr(e=>jr(e,p)/Math.max(m,1e-30)):null,S=r?x?[x.r,x.g,x.b]:[1,1,1]:l,C=En.map(e=>Gr(e,{absorptionCoefficientPerM:r?hi(e)/50:hi(e),pathLengthM:n,reflectance:s,scatteringCoefficientPerM:r?jr(e,p):0,n:o,k:0}));return mr({metalness:0,roughness:y,transmission:_,ior:o,opacity:v,attenuationColor:l,attenuationDistanceM:u,condensationScatter:m,internalScatter:m,scatteringCoefficientPerM:m,dropletMicrophysics:p,opticalDepth:h,absorptionCoefficientPerM:d,provenance:{status:`derived`,source:m>0?`conserved-condensate-monodisperse-lorenz-mie-scattering`:`beer-lambert-oh-overtone-optical-depth`,method:m>0?`caller-supplied conserved condensed mass density + monodisperse radius -> size/refractive-index-dependent Lorenz-Mie sphere efficiencies with bounded lossless geometric-optics/diffraction asymptotic; saturation is diagnostic only`:`O-H overtone absorption -> luminous attenuation distance -> Beer-Lambert opacity/transmission`,inputs:{pathLengthM:n,phase:b,opticalState:a||null},validation:!1}},{baseColorSrgb:S,renderModel:r?m>0?`molecular-condensed-droplet-scattering-pbr`:`molecular-vapor-transparent-spectrum`:`molecular-transparent-beer-lambert-pbr`,spectralSamples:C})}if(t===`gas`){let e=Oi({properties:r,pathLengthM:n});if(e)return e}return xi({properties:r,phase:t,pathLengthM:n})||mr({metalness:0,roughness:.4,transmission:0,ior:1.4,opacity:0,attenuationColor:null,attenuationDistanceM:1/0,condensationScatter:0,internalScatter:0,opticalDepth:null,absorptionCoefficientPerM:null,blocked:!0,provenance:{status:`blocked`,source:`missing-optical-closure`,method:`no conduction density, water absorption model, or electronic-gap opacity available`,inputs:{material:e,phase:t},validation:!1}},{baseColorSrgb:[0,0,0],renderModel:`blocked-missing-optical-closure`,vertexColorPolicy:`blocked`,spectralSamples:[]})}function Ai(e={}){let t=fr(e),n=Dn.get(t);if(n)return pr(n);let r=ki(e);return Dn.set(t,pr(r)),pr(r)}var ji=t.length,Mi=_.length,Ni=T.length,Pi=p.length,Fi=t,Ii=_,Li=T,Ri=p,zi=`peercompute.ulg.optical-material-bank-pbr-warm-input-consumer.v0`,Bi=new Float32Array(Mi),Vi=`
struct OpticalMaterialRecord {
  material_id: f32,
  phase_id: f32,
  spectral_offset: f32,
  spectral_count: f32,
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  render_model_id: f32,
  vertex_color_policy_id: f32,
  optical_depth: f32,
  blocked: f32,
  status: f32,
  optical_state_id: f32,
};

struct OpticalSpectralSample {
  wavelength_nm: f32,
  reflectance: f32,
  transmittance: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  n: f32,
  k: f32,
  pad0: f32,
};
`,Hi={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Ui={READ:globalThis.GPUMapMode?.READ??1},Wi=Object.freeze({unknown:0,solid:1,liquid:2,gas:3,plasma:4}),Gi=Object.freeze({"material-pbr":1,"particle-diagnostic":2,blocked:255}),Ki=Object.freeze({"conductor-drude-lorentz-relativistic-interband":1,"molecular-transparent-beer-lambert-pbr":2,"molecular-vapor-transparent-spectrum":3,"molecular-gap-pbr":4,"rayleigh-gas-transparent-spectrum":5,"conductor-drude-free-electron":6,"molecular-condensed-droplet-scattering-pbr":7,"conductor-reference-complex-index":8,"molecular-gas-reference-cross-section-pbr":9,"molecular-gas-electronic-band-absorption-pbr":10,"blocked-missing-optical-closure":255});function X(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function qi(e,t=0){let n=Number(e);return Number.isFinite(Math.fround(n))?n:t}function Ji(e){let t=Math.max(0,Math.min(1,X(e)));return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function Yi(e,t=[0,0,0]){let n=Array.isArray(e)?e:t;return[Ji(n[0]),Ji(n[1]),Ji(n[2])]}function Xi(e){return Wi[e]??Wi.unknown}function Zi(e,t){return e[t]??0}function Qi(e){return typeof e==`string`?e:e?.material||e?.renderKey||null}function $i(e){return typeof e!=`string`||e.length===0?null:`${e[0].toUpperCase()}${e.slice(1).toLowerCase()}`}function ea(e){let t=2166136261;for(let n of String(e))t^=n.charCodeAt(0),t=Math.imul(t,16777619)>>>0;return 1e3+t%8e6}function ta(e){let t=Number(e);return Number.isFinite(t)?t.toPrecision(10):String(e??`null`)}function na(e){if(!e||typeof e!=`object`)return`default`;let t=Object.keys(e).filter(t=>e[t]!=null).sort().map(t=>{let n=e[t];return n&&typeof n==`object`?`${t}:{${na(n)}}`:`${t}:${ta(n)}`});return t.length>0?t.join(`|`):`default`}function ra(e){let t=na(e);return t==="default"?0:ea(`optical-state:${t}`)}function ia(e){let t=$i(e);return(t?l(t):null)??ea(String(e||`unknown`).toLowerCase())}function aa(e){return typeof e==`string`?`unknown`:e?.phase||`unknown`}function oa(e){return typeof e==`object`&&e&&e.opticalState||null}function sa(e,t=oa(e)){let n=typeof e==`object`&&e?Number(e.opticalStateId):NaN;return Number.isFinite(n)?n:ra(t)}function ca(e){return[X(e?.wavelengthNm),X(e?.reflectance),X(e?.transmittance),X(e?.absorptionCoefficientPerM),X(e?.scatteringCoefficientPerM),X(e?.n),X(e?.k),0]}function la(e,t){if(t.length!==ji)throw Error(`Optical GPU record must be ${ji} floats`);e.push(...t)}function ua(e){return R.findIndex(t=>String(t).split(`:`)[0]===e)}var da=Object.freeze({materialId:ua(`materialId`),baseColorSrgbR:ua(`baseColorSrgbR`),baseColorSrgbG:ua(`baseColorSrgbG`),baseColorSrgbB:ua(`baseColorSrgbB`),metalness:ua(`metalness`),roughness:ua(`roughness`),ior:ua(`ior`),strictSourceOfTruth:ua(`strictSourceOfTruth`),status:ua(`status`)});function fa(e,t,n,r=0){let i=da[n];return i>=0?X(e[t+i],r):r}function pa(e=null){let t=new Map,n=new Map;if(e?.schema!==`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`)return{byMaterialId:t,byMaterialKey:n,sourceRowCount:0};let r=e.rows instanceof Float32Array?e.rows:new Float32Array,i=Math.max(1,Math.round(X(e.rowStrideFloats,R.length))),a=Math.max(0,Math.min(Math.round(X(e.rowCount,0)),Math.floor(r.length/i)));for(let o=0;o<a;o+=1){let a=o*i,s=e.metadata?.[o]||{},c=fa(r,a,`status`,s.status===`ready`?ce.ready:0);if(Math.round(c)!==ce.ready)continue;let l=fa(r,a,`materialId`,s.materialId),u={schema:`peercompute.ulg.optical-material-bank-pbr-warm-input-row.v0`,status:`ready`,rowIndex:o,role:s.role??null,material:s.material??null,requestedMaterial:s.requestedMaterial??null,materialId:l,atomicNumber:s.atomicNumber??l,temperatureK:s.temperatureK??null,pressurePa:s.pressurePa??null,baseColorSrgb:[fa(r,a,`baseColorSrgbR`),fa(r,a,`baseColorSrgbG`),fa(r,a,`baseColorSrgbB`)],metalness:fa(r,a,`metalness`),roughness:fa(r,a,`roughness`),ior:fa(r,a,`ior`,1),strictSourceOfTruth:fa(r,a,`strictSourceOfTruth`)===1,bankFamily:s.bankFamily??null,bankSchemaVersion:s.bankSchemaVersion??null,generatorFingerprint:s.generatorFingerprint??null};Number.isFinite(l)&&t.set(l,u);for(let e of[s.material,s.requestedMaterial]){let t=String(e||``).toLowerCase();t&&n.set(t,u)}}return{byMaterialId:t,byMaterialKey:n,sourceRowCount:a}}function ma({material:e,materialId:t},n){return n.byMaterialId.get(t)||n.byMaterialKey.get(String(e||``).toLowerCase())||null}function ha(e){if(!Array.isArray(e)||e.length<3)return null;let t=e.slice(0,3).map(e=>X(e,NaN));return t.every(Number.isFinite)?t.map(e=>Math.max(0,Math.min(1,e))):null}function ga(e,t=null){let n=ha(e.baseColorSrgb)||[1,1,1],r=e.ior==null?1:X(e.ior,1);return{source:`closure-derived-optical-pbr`,baseColorSrgb:n,metalness:X(e.metalness),roughness:X(e.roughness,.5),ior:r,closureBaseColorSrgb:n,closureMetalness:X(e.metalness),closureRoughness:X(e.roughness,.5),closureIor:e.ior==null?1:X(e.ior,1)}}function _a({table:e=null,matchedRecordCount:t=0}={}){let n=e?.schema===`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`?Math.max(0,Math.round(X(e.rowCount,0))):0,r=Math.max(0,Math.round(X(t,0)));return{schema:zi,status:n<=0?`no-material-bank-pbr-warm-input-table`:r>0?`optical-gpu-table-annotated-with-material-bank-pbr-warm-inputs`:`material-bank-pbr-warm-inputs-not-matched-to-optical-records`,sourceSchema:e?.schema??null,sourceRowCount:n,matchedRecordCount:r,consumer:`optical-gpu-table`,consumedAs:r>0?`non-authoritative-pbr-warm-input-metadata-only-alongside-closure-derived-optical-rows`:`non-authoritative-pbr-warm-input-metadata-before-closure-derived-optical-rows`,strictSourceOfTruth:!1,shaderBound:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function va(e,{shaderBound:t=!1,shaderBinding:n=null,shaderRowCount:r=0,bufferSource:i=null}={}){let a=e?.materialPropertyBankPbrWarmInputConsumer??_a(),o=Math.max(0,Math.round(X(r,0))),s=t===!0&&o>0;return{...a,status:s?`optical-material-bank-pbr-warm-inputs-bound-in-shader`:a.status,consumedAs:s?`non-authoritative-shader-bound-display-pbr-warm-input-over-closure-derived-optical-rows`:a.consumedAs,shaderBound:s,shaderBinding:s?n:null,shaderRowCount:s?o:0,bufferSource:s?i:null}}function ya(e,{materialProperties:t={},pathLengthM:n=.25,materialPropertyBankGpuWarmInputTable:r=null}={}){if(!Array.isArray(e))throw TypeError(`buildOpticalGpuTable requires an array of material/phase descriptors`);let i=[],a=[],o=[],s=new Map,c=new Map,l=pa(r),u=0,f=e=>(s.has(e)||s.set(e,ia(e)),s.get(e));for(let r of e){let e=Qi(r);if(!e)continue;let s=aa(r),d=oa(r),p=na(d),m=Number(r?.pathLengthM),h=Number.isFinite(m)&&m>0?m:n,g=sa(r,d),_=`${e}|${s}|${g}`,v=c.get(_);if(v!=null){if(v.opticalStateKey!==p)throw Error(`conflicting optical states share GPU binding ${_}; assign distinct stable opticalStateId values`);if(v.pathLengthM!==h)throw Error(`conflicting optical path lengths share GPU binding ${_}; assign distinct stable opticalStateId values`);continue}c.set(_,{opticalStateKey:p,pathLengthM:h});let y=Ai({material:e,phase:s,properties:typeof r==`object`&&r?.properties?r.properties:t[e],pathLengthM:h,opticalState:d}),b=f(e),x=ma({material:e,materialId:b},l);x&&(u+=1);let S=ga(y,x),C=a.length/Mi;for(let e of y.spectralSamples||[])a.push(...ca(e));let w=a.length/Mi-C,T=Yi(S.baseColorSrgb),E=Yi(y.attenuationColor,[1,1,1]),D=Math.max(X(y.scatteringCoefficientPerM),X(y.condensationScatter),X(y.internalScatter));la(i,[b,Xi(s),C,w,T[0],T[1],T[2],X(S.metalness),X(S.roughness),X(y.transmission),X(y.opacity),X(S.ior,1),E[0],E[1],E[2],qi(y.attenuationDistanceM,0x56bc75e2d63100000),X(y.absorptionCoefficientPerM),D,Zi(Ki,y.renderModel),Zi(Gi,y.vertexColorPolicy),X(y.opticalDepth),+!!y.blocked,y.provenance?.status===`blocked`?255:1,g]),o.push({material:e,phase:s,opticalState:d?{...d}:null,opticalStateKey:p,opticalStateId:g,pathLengthM:h,pathLengthSource:Number.isFinite(m)&&m>0?r?.pathLengthSource||`descriptor`:`table-default`,materialId:b,phaseId:Xi(s),recordIndex:o.length,spectralOffset:C,spectralCount:w,renderModel:y.renderModel,renderModelId:Zi(Ki,y.renderModel),vertexColorPolicy:y.vertexColorPolicy,vertexColorPolicyId:Zi(Gi,y.vertexColorPolicy),blocked:y.blocked===!0,provenance:y.provenance||null,baseColorSrgb:[...S.baseColorSrgb],closureBaseColorSrgb:[...S.closureBaseColorSrgb],displayPbrSource:S.source,displayPbr:{source:S.source,baseColorSrgb:[...S.baseColorSrgb],metalness:S.metalness,roughness:S.roughness,ior:S.ior},closurePbr:{baseColorSrgb:[...S.closureBaseColorSrgb],metalness:S.closureMetalness,roughness:S.closureRoughness,ior:S.closureIor},materialPropertyBankPbrWarmInput:x,materialPropertyBankPbrWarmInputStatus:x?`material-bank-pbr-warm-input-attached`:`no-material-bank-pbr-warm-input`})}let p=_a({table:r,matchedRecordCount:u}),m=r?.schema===`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`&&r.rows instanceof Float32Array?new Float32Array(r.rows):new Float32Array,h=Math.max(0,Math.round(X(r?.rowStrideFloats,R.length)));return{schema:d,status:`cpu-derived-gpu-buffer-ready`,recordLayout:[...Fi],spectralSampleLayout:[...Ii],recordStrideFloats:ji,spectralSampleStrideFloats:Mi,recordStrideBytes:ji*Float32Array.BYTES_PER_ELEMENT,spectralSampleStrideBytes:Mi*Float32Array.BYTES_PER_ELEMENT,wgslStructs:Vi,records:Float32Array.from(i),spectralSamples:Float32Array.from(a),recordCount:o.length,spectralSampleCount:a.length/Mi,materialPropertyBankPbrWarmInputConsumer:p,materialPropertyBankPbrWarmInputRowCount:p.sourceRowCount,materialPropertyBankPbrWarmInputRows:m,materialPropertyBankPbrWarmInputRowStrideFloats:h,materialPropertyBankPbrWarmInputMatchedRecordCount:p.matchedRecordCount,materialMap:[...s.entries()].map(([e,t])=>({material:e,materialId:t})),recordMetadata:o,colorSpace:`linear-rgb-from-display-pbr-srgb`,scientificValidation:!1,fullPhysicsValidation:!1}}function ba(e,t){let n=t*ji;return e.records.slice(n,n+ji)}function xa(e){let t=oa(e);return{material:Qi(e),phase:aa(e),opticalState:t,opticalStateKey:na(t),opticalStateId:sa(e,t)}}function Sa(e,t){if(e?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`buildOpticalGpuLookupQueries requires an optical GPU table`);if(!Array.isArray(t))throw TypeError(`buildOpticalGpuLookupQueries requires an array of descriptors`);let n=new Map(e.materialMap.map(e=>[e.material,e.materialId])),r=[],a=[];for(let e of t){let{material:t,phase:i,opticalState:o,opticalStateKey:s,opticalStateId:c}=xa(e),l=n.get(t)??0,u=Xi(i);r.push(l,u,c,0),a.push({material:t,phase:i,opticalState:o,opticalStateKey:s,opticalStateId:c,materialId:l,phaseId:u})}return{schema:i,queryLayout:[...Li],outputLayout:[...Ri],queryStrideFloats:Ni,outputStrideFloats:Pi,queries:Float32Array.from(r),queryCount:t.length,metadata:a,scientificValidation:!1,fullPhysicsValidation:!1}}function Ca(e,t){if(e?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`sampleOpticalGpuTableCpu requires an optical GPU table`);if(t?.schema!==`peercompute.ulg.optical-gpu-lookup.v0`)throw TypeError(`sampleOpticalGpuTableCpu requires lookup queries`);let n=new Float32Array(t.queryCount*Pi);for(let r=0;r<t.queryCount;r+=1){let i=r*Ni,a=t.queries[i],o=t.queries[i+1],s=t.queries[i+2],c=-1;for(let t=0;t<e.recordCount;t+=1){let i=ba(e,t);if(i[0]===a&&i[1]===o&&i[23]===s){c=t;let e=r*Pi;n.set([i[4],i[5],i[6],i[10],i[7],i[8],i[9],i[11],i[18],i[19],i[22],t,i[20],i[17],i[16],i[23]],e);break}}c<0&&n.set([0,0,0,0,0,0,0,1,0,0,255,-1,0,0,0,s],r*Pi)}return{schema:i,backend:`cpu-reference`,outputLayout:[...Ri],outputStrideFloats:Pi,queryCount:t.queryCount,outputs:n,scientificValidation:!1,fullPhysicsValidation:!1}}function wa({cpuReference:e,gpuResult:t,tolerance:n=1e-6}={}){let r=e?.outputs,i=t?.outputs;if(!(r instanceof Float32Array)||!(i instanceof Float32Array))return{schema:o,status:`fail`,tolerance:n,maxOutputAbs:1/0,lengthMismatch:!0,cpuBackend:e?.backend||null,gpuBackend:t?.backend||null,reason:`missing lookup output buffers`,scientificValidation:!1,fullPhysicsValidation:!1};let a=Math.min(r.length,i.length),s=0;for(let e=0;e<a;e+=1)s=Math.max(s,Math.abs(r[e]-i[e]));let c=r.length!==i.length;return{schema:o,status:!c&&s<=n?`pass`:`fail`,tolerance:n,maxOutputAbs:s,lengthMismatch:c,outputCount:r.length,cpuBackend:e.backend,gpuBackend:t.backend,scientificValidation:!1,fullPhysicsValidation:!1}}function Ta(e,t=null){let n=e?.outputs;if(!(n instanceof Float32Array))throw TypeError(`decodeOpticalGpuLookupOutputRows requires Float32Array lookup outputs`);let r=e.queryCount??t?.queryCount??n.length/Pi,i=[];for(let e=0;e<r;e+=1){let r=e*Pi;i.push({queryIndex:e,material:t?.metadata?.[e]?.material??null,phase:t?.metadata?.[e]?.phase??null,opticalState:t?.metadata?.[e]?.opticalState??null,opticalStateKey:t?.metadata?.[e]?.opticalStateKey??null,opticalStateId:t?.metadata?.[e]?.opticalStateId??null,materialId:t?.metadata?.[e]?.materialId??null,phaseId:t?.metadata?.[e]?.phaseId??null,baseColorLinear:[n[r],n[r+1],n[r+2]],opacity:n[r+3],metalness:n[r+4],roughness:n[r+5],transmission:n[r+6],ior:n[r+7],renderModelId:n[r+8],vertexColorPolicyId:n[r+9],status:n[r+10],recordIndex:n[r+11],opticalDepth:n[r+12],scatteringCoefficientPerM:n[r+13],absorptionCoefficientPerM:n[r+14],outputOpticalStateId:n[r+15]})}return i}function Ea(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:g,lookupResultSchema:e?.schema||`peercompute.ulg.optical-gpu-lookup.v0`,backend:e?.backend||`cpu-reference`,outputLayout:[...Ri],outputStrideFloats:Pi,queryCount:e?.queryCount??0,outputs:e?.outputs??new Float32Array,materialPropertyBankPbrWarmInputConsumer:e?.materialPropertyBankPbrWarmInputConsumer??null,materialPropertyBankPbrWarmInputRowCount:e?.materialPropertyBankPbrWarmInputRowCount??0,materialPropertyBankPbrWarmInputMatchedRecordCount:e?.materialPropertyBankPbrWarmInputMatchedRecordCount??0,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,scientificValidation:!1,fullPhysicsValidation:!1}}function Da(e){return e?.reason||e?.message||`device lost`}function Oa(e,t){e?.lost?.then&&e.lost.then(e=>{t(e)}).catch(e=>{t(e)})}async function ka(e=globalThis.navigator,{onDeviceLost:t=null,timestampProfilingRequested:n=!1}={}){if(!e?.gpu)return{status:`blocked-webgpu-unavailable`,reason:`navigator.gpu unavailable`,device:null};let r=await e.gpu.requestAdapter();if(!r)return{status:`blocked-webgpu-unavailable`,reason:`requestAdapter returned null`,device:null};let{requiredLimits:i,adapterLimits:a}=O(r),o=Number(r?.limits?.maxStorageBuffersPerShaderStage);if(Number.isFinite(o)&&o>0&&o<12)return{status:`blocked-webgpu-resident-storage-limit`,reason:`resident WebGPU requires 12 storage buffers per shader stage; adapter exposes ${a.maxStorageBuffersPerShaderStage||0}`,device:null,requiredLimits:i,requiredFeatures:[],adapterFeatures:[],enabledFeatures:[],timestampProfilingRequested:n===!0,timestampQuerySupported:!1,timestampQueryStatus:`not-requested-adapter-limit-blocked`,adapterLimits:a};let s=D(r,{timestampProfilingRequested:n}),c=k(r,{timestampProfilingRequested:n}),l=await r.requestDevice(c);return E(l,{label:`optical-resident-sph`}),typeof t==`function`&&Oa(l,t),{status:`webgpu-device-ready`,reason:`device acquired`,device:l,requiredLimits:i,requiredFeatures:[...s.requiredFeatures],adapterFeatures:[...s.adapterFeatures],enabledFeatures:l?.features?[...l.features].map(e=>String(e)):[],timestampProfilingRequested:n===!0,timestampQuerySupported:s.timestampQuerySupported,timestampQueryStatus:s.timestampQueryStatus,adapterLimits:{...a}}}function Aa(e,t,n){let r=Math.max(16,n.byteLength),i=e.createBuffer({label:t,size:r,usage:Hi.STORAGE|Hi.COPY_DST});try{n.byteLength>0&&e.queue.writeBuffer(i,0,n)}catch(e){throw i?.destroy?.(),e}return i}function ja(e,t){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`uploadOpticalGpuTable requires a WebGPU-like device with queue.writeBuffer`);if(t?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`uploadOpticalGpuTable requires a table from buildOpticalGpuTable`);let n=t.spectralSamples.length>=Mi?t.spectralSamples:Bi,r=Math.max(16,t.records.byteLength),i=Math.max(16,n.byteLength),a=null,o=null;try{return a=Aa(e,`ulg-optical-material-records`,t.records),o=Aa(e,`ulg-optical-spectral-samples`,n),{schema:w,tableSchema:t.schema,recordCount:t.recordCount,spectralSampleCount:t.spectralSampleCount,recordStrideBytes:t.recordStrideBytes,spectralSampleStrideBytes:t.spectralSampleStrideBytes,recordsBuffer:a,recordsBufferByteLength:r,spectralSamplesBuffer:o,spectralSamplesBufferByteLength:i,scientificValidation:!1,fullPhysicsValidation:!1}}catch(e){throw a?.destroy?.(),o?.destroy?.(),e}}function Ma({recordCount:e,queryCount:t,materialBankPbrWarmInputRowCount:n=0}){let r=new ArrayBuffer(16),i=new DataView(r);return i.setUint32(0,e,!0),i.setUint32(4,t,!0),i.setUint32(8,Math.max(0,Math.round(X(n,0))),!0),i.setUint32(12,0,!0),r}function Na(e,t){let n=t?.materialPropertyBankPbrWarmInputRows,r=Math.max(0,Math.round(X(t?.materialPropertyBankPbrWarmInputRowCount,0)));if(n?.byteLength>0&&r>0){let t=Aa(e,`ulg-optical-material-bank-pbr-warm-input-rows`,n);return{buffer:t,rowCount:r,bufferSource:`optical-gpu-table`,destroy(){t.destroy?.()}}}let i=Aa(e,`ulg-optical-material-bank-pbr-warm-input-rows-empty`,new Float32Array);return{buffer:i,rowCount:0,bufferSource:`empty`,destroy(){i.destroy?.()}}}async function Pa({device:e,table:t,lookup:n}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runOpticalGpuLookup requires a WebGPU-like device with queue.writeBuffer`);if(t?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`runOpticalGpuLookup requires an optical GPU table`);if(n?.schema!==`peercompute.ulg.optical-gpu-lookup.v0`)throw TypeError(`runOpticalGpuLookup requires lookup queries`);let r=n.queryCount*Pi*Float32Array.BYTES_PER_ELEMENT,a=Math.max(16,r),o=Aa(e,`ulg-optical-lookup-records`,t.records),s=Aa(e,`ulg-optical-lookup-queries`,n.queries),c=Na(e,t),l=e.createBuffer({label:`ulg-optical-lookup-outputs`,size:a,usage:Hi.STORAGE|Hi.COPY_SRC}),d=e.createBuffer({label:`ulg-optical-lookup-params`,size:16,usage:Hi.UNIFORM|Hi.COPY_DST}),f=e.createBuffer({label:`ulg-optical-lookup-readback`,size:a,usage:Hi.MAP_READ|Hi.COPY_DST});try{e.queue.writeBuffer(d,0,Ma({recordCount:t.recordCount,queryCount:n.queryCount,materialBankPbrWarmInputRowCount:c.rowCount}));let{pipeline:a,bindGroupLayout:p}=M(e,{label:`ulg-optical-lookup`,module:e.createShaderModule({code:u}),entryPoint:`main`,bindings:[A(0,`read-only-storage`),A(1,`read-only-storage`),A(2,`storage`),A(3,`uniform`),A(4,`read-only-storage`)]}),m=e.createBindGroup({layout:p,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:l}},{binding:3,resource:{buffer:d}},{binding:4,resource:{buffer:c.buffer}}]}),h=e.createCommandEncoder(),g=h.beginComputePass();g.setPipeline(a),g.setBindGroup(0,m),g.dispatchWorkgroups(Math.max(1,Math.ceil(n.queryCount/64))),g.end(),h.copyBufferToBuffer(l,0,f,0,Math.max(4,r)),e.queue.submit([h.finish()]),await f.mapAsync(Ui.READ);let _=new Float32Array(f.getMappedRange()).slice(0,n.queryCount*Pi);return f.unmap(),{schema:i,backend:`webgpu`,outputLayout:[...Ri],outputStrideFloats:Pi,queryCount:n.queryCount,outputs:_,materialPropertyBankPbrWarmInputConsumer:va(t,{shaderBound:c.rowCount>0,shaderBinding:4,shaderRowCount:c.rowCount,bufferSource:c.bufferSource}),materialPropertyBankPbrWarmInputRowCount:t.materialPropertyBankPbrWarmInputRowCount??0,materialPropertyBankPbrWarmInputMatchedRecordCount:t.materialPropertyBankPbrWarmInputMatchedRecordCount??0,scientificValidation:!1,fullPhysicsValidation:!1}}finally{o.destroy?.(),s.destroy?.(),c.destroy?.(),l.destroy?.(),d.destroy?.(),f.destroy?.()}}async function Fa({table:e,lookup:t,cpuReference:n=null,preferWebGpu:r=!1,navigatorRef:i=globalThis.navigator,device:a=null,deviceResult:o=null,parityTolerance:s=1e-6,onDeviceLost:c=null,webGpuRunner:l=Pa}={}){let u=n||Ca(e,t);if(!r)return Ea(u,{cpuReference:u,webgpuStatus:{status:`not-requested`,reason:`WebGPU optical lookup path not requested`}});try{let n={info:null},r=a?{status:`webgpu-device-ready`,reason:`provided device`,device:a}:o||await ka(i);if(r.device&&ie(r.device,n,c),!r.device)return Ea(u,{cpuReference:u,webgpuStatus:{status:r.status,reason:r.reason,fallback:`cpu-reference`}});if(await Promise.resolve(),n.info)return Ea(u,{cpuReference:u,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:Da(n.info),fallback:`cpu-reference`}});let d=await l({device:r.device,table:e,lookup:t});if(await Promise.resolve(),n.info)return Ea(u,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:Da(n.info),fallback:`cpu-reference`}});let f=wa({cpuReference:u,gpuResult:d,tolerance:s});return f.status===`pass`?Ea(d,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU optical lookup parity passed`},webgpuParity:f}):Ea(u,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU optical lookup parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:f})}catch(e){return Ea(u,{cpuReference:u,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var Ia=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function La(e,t){return e>>>t|e<<32-t}var Ra=new Uint32Array(64),za=null,Ba=null,Va=new Uint8Array(4096),Ha=new DataView(Va.buffer);function Ua(e){let t=globalThis.TextEncoder;return(t!==za||!Ba)&&(za=t,Ba=new t),Ba.encode(e)}function Wa(e){if(Va.length<e){let t=Va.length;for(;t<e;)t*=2;Va=new Uint8Array(t),Ha=new DataView(Va.buffer)}return Va}function Ga(e){return e.toString(16).padStart(8,`0`)}function Ka(e){let t=e.length,n=t*8,r=Math.ceil((t+9)/64)*64,i=Wa(r);i.set(e,0),i.fill(0,t,r),i[t]=128;let a=Ha;a.setUint32(r-8,Math.floor(n/4294967296)),a.setUint32(r-4,n>>>0);let o=1779033703,s=3144134277,c=1013904242,l=2773480762,u=1359893119,d=2600822924,f=528734635,p=1541459225,m=Ra;for(let e=0;e<r;e+=64){for(let t=0;t<16;t+=1)m[t]=a.getUint32(e+t*4);for(let e=16;e<64;e+=1){let t=m[e-15],n=m[e-2],r=La(t,7)^La(t,18)^t>>>3,i=La(n,17)^La(n,19)^n>>>10;m[e]=m[e-16]+r+m[e-7]+i>>>0}let t=o,n=s,r=c,i=l,h=u,g=d,_=f,v=p;for(let e=0;e<64;e+=1){let a=La(h,6)^La(h,11)^La(h,25),o=h&g^~h&_,s=v+a+o+Ia[e]+m[e]>>>0,c=(La(t,2)^La(t,13)^La(t,22))+(t&n^t&r^n&r)>>>0;v=_,_=g,g=h,h=i+s>>>0,i=r,r=n,n=t,t=s+c>>>0}o=o+t>>>0,s=s+n>>>0,c=c+r>>>0,l=l+i>>>0,u=u+h>>>0,d=d+g>>>0,f=f+_>>>0,p=p+v>>>0}return Ga(o)+Ga(s)+Ga(c)+Ga(l)+Ga(u)+Ga(d)+Ga(f)+Ga(p)}function qa(e,t){if(!(e instanceof Uint8Array))throw TypeError(`authority fingerprint input must be Uint8Array bytes`);if(typeof t!=`string`||t.length<1)throw TypeError(`authority fingerprint label must be nonempty`);return`sha256:${t}:${Ka(e)}`}function Ja(e,t){if(typeof e!=`string`)throw TypeError(`authority fingerprint text must be a string`);return qa(Ua(e),t)}function Ya(e,t=`typed-array-content-v1`){if(!ArrayBuffer.isView(e))throw TypeError(`authority fingerprint input must be a typed array`);let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength);return[e.constructor?.name||`TypedArray`,e.byteLength,qa(n,t)].join(`:`)}function Xa(e){return Array.from({length:e},(t,n)=>Math.cos(Math.PI*(n+.5)/e))}function Za(e){let t=e.length;return Array.from({length:t},(n,r)=>{let i=0;for(let n=0;n<t;n++)i+=e[n]*Math.cos(Math.PI*r*(n+.5)/t);return(r===0?1:2)*i/t})}function Qa(e,t){let n=0,r=0;for(let i=e.length-1;i>=1;i--){let a=2*t*n-r+e[i];r=n,n=a}let i=t*n-r+e[0],a=e.length,o=Array(a+1).fill(0);for(let t=a-1;t>=1;t--)o[t-1]=o[t+1]+2*t*e[t];o[0]/=2;let s=0,c=0;for(let e=a-2;e>=1;e--){let n=2*t*s-c+o[e];c=s,s=n}return{value:i,derivative:a>1?t*s-c+o[0]:0}}var $a=`peercompute.ulg.response-function.v1`;function eo(e,t){let n=t.map(e=>e+1),r=Float64Array.from(e);for(let e=0;e<n.length;e++){let t=n[e],i=n.slice(e+1).reduce((e,t)=>e*t,1),a=r.length/(t*i),o=new Float64Array(r.length);for(let e=0;e<a;e++)for(let n=0;n<i;n++){let a=Za(Array.from({length:t},(a,o)=>r[(e*t+o)*i+n]));for(let r=0;r<t;r++)o[(e*t+r)*i+n]=a[r]}r=o}return r}function to(e,t,n){let r=t.map(e=>e+1);return{value:(t=>{let n=Array.from(e),i=[...r];for(let e=0;e<r.length;e++){let r=i[0],a=n.length/r,o=Array(a).fill(0);for(let i=0;i<a;i++)o[i]=Qa(Array.from({length:r},(e,t)=>n[t*a+i]),t[e]).value;n=o,i=i.slice(1)}return n[0]})(n),gradient:n.map((t,i)=>{let a=Array.from(e),o=[...r];for(let e=0;e<r.length;e++){let t=o[0],r=a.length/t,s=Array(r).fill(0);for(let o=0;o<r;o++){let c=Qa(Array.from({length:t},(e,t)=>a[t*r+o]),n[e]);s[o]=e===i?c.derivative:c.value}a=s,o=o.slice(1)}return a[0]})}}function no(e){if(typeof e?.evaluate!=`function`||typeof e.regimeOf!=`function`||!Array.isArray(e.axes)||!e.axes.length||e.axes.some(e=>typeof e?.name!=`string`||typeof e?.unit!=`string`)||typeof e.outputUnit!=`string`||typeof e.sourceFingerprint!=`string`||typeof e.id!=`string`)throw TypeError(`A response generator needs id, axes [{name, unit}], outputUnit, sourceFingerprint, evaluate(xs), regimeOf(xs)`);return e}function ro({generator:e,box:t,degrees:n,signs:r=null,relativeTolerance:i=1e-6,heldOutPerAxis:a=9,safetyFactor:o=2,now:s=()=>Date.now()}={}){no(e);let c=e.axes;if(!Array.isArray(t)||t.length!==c.length||t.some(([e,t])=>!(t>e)))throw RangeError(`box needs [lo, hi] with lo < hi for every axis`);let l=e=>{let t=RangeError(e);throw t.code=`RESPONSE_FUNCTION_REFUSED`,t},u=s(),d=e=>e.map((e,n)=>t[n][0]+(e+1)*(t[n][1]-t[n][0])/2),f=n.map(e=>Xa(e+1)),p=[],m=(e,t)=>{if(e===c.length){p.push(t);return}for(let n of f[e])m(e+1,[...t,n])};m(0,[]);let h=e.regimeOf(d(p[0])),g=eo(p.map(t=>{let n=d(t);e.regimeOf(n)!==h&&l(`validity box spans regimes (${h} / ${e.regimeOf(n)})`);let r=e.evaluate(n);return Number.isFinite(r)||l(`generator returned a non-finite sample`),r}),n),_=[],v=[],y=Array.from({length:a},(e,t)=>-1+2*(t+.5)/a),b=(e,t)=>{if(e===c.length){_.push(t);return}for(let n of y)b(e+1,[...t,n])};b(0,[]);for(let e=0;e<c.length;e++)for(let t of[-1,1])for(let n of _){let r=[...n];r[e]=t,v.push(r)}let x=t=>{let i=0,a=0;for(let o of t){let t=d(o);e.regimeOf(t)!==h&&l(`held-out point in another regime`);let s=e.evaluate(t),u=to(g,n,o),f=Math.abs(u.value-s);i=Math.max(i,f),a=Math.max(a,f/Math.max(Math.abs(s),1e-300)),r&&u.gradient.forEach((e,t)=>{r[t]&&Math.sign(e)!==r[t]&&l(`declared sign of d/d${c[t].name} violated`)})}return{maxAbs:i,maxRel:a}},S=x(_),C=x(v),w=Math.max(S.maxRel,C.maxRel)*o;return w<=i||l(`relative residual bound ${w} exceeds ${i}`),Object.freeze({schema:$a,abiVersion:1,axes:Object.freeze(c.map((e,r)=>Object.freeze({...e,lo:t[r][0],hi:t[r][1],degree:n[r]}))),outputUnit:e.outputUnit,regime:h,signs:r?Object.freeze([...r]):null,provenance:Object.freeze({generatorId:e.id,generatorSourceFingerprint:e.sourceFingerprint,sampling:`tensor-chebyshev-first-kind-nodes`,sampleCount:p.length,heldOut:{interior:_.length,boundary:v.length},derivedAtMs:u,deriveMs:s()-u}),coefficients:Object.freeze(Array.from(g)),residuals:Object.freeze({kind:`held-out-empirical`,interior:S,boundary:C,safetyFactor:o,relativeBound:w})})}function io(e,t,{generator:n=null}={}){if(n&&n.sourceFingerprint!==e.provenance.generatorSourceFingerprint)return{ok:!1,reason:`stale-source`,value:null};if(t.some((t,n)=>!(t>=e.axes[n].lo&&t<=e.axes[n].hi)))return{ok:!1,reason:`out-of-domain`,value:null};if(n&&n.regimeOf(t)!==e.regime)return{ok:!1,reason:`regime-transition`,value:null};let r=t.map((t,n)=>2*(t-e.axes[n].lo)/(e.axes[n].hi-e.axes[n].lo)-1),i=to(e.coefficients,e.axes.map(e=>e.degree),r);return{ok:!0,value:i.value,gradient:i.gradient.map((t,n)=>t*2/(e.axes[n].hi-e.axes[n].lo)),relativeBound:e.residuals.relativeBound}}var ao=`peercompute.ulg.response-function-gpu-table.v1`;function oo(e){if(!Array.isArray(e)||e.length===0)throw TypeError(`packResponseFunctionsForGpu needs at least one response function`);let t=[],n=[];for(let r of e){let e=r?.axes;if(!Array.isArray(e)||e.length<1||e.length>3)throw RangeError(`a GPU response function needs 1-3 axes`);let i=e.map(e=>e.degree+1);if(i.some(e=>!Number.isInteger(e)||e<1||e>32))throw RangeError(`each axis needs 1-32 Chebyshev terms`);let a=i.reduce((e,t)=>e*t,1);if(!r.coefficients||r.coefficients.length!==a)throw RangeError(`coefficient count ${r.coefficients?.length} does not match the axis terms (${a})`);let o=r.residuals?.relativeBound;if(!Number.isFinite(o)||o<0||!Number.isFinite(Math.fround(o)))throw RangeError(`a GPU response function needs a finite nonnegative residual bound`);if(!Array.from(r.coefficients).every(e=>Number.isFinite(e)&&Number.isFinite(Math.fround(e))))throw RangeError(`GPU response coefficients must remain finite in f32`);let s=Array(16).fill(0);s[0]=e.length,s[1]=n.length,i.forEach((e,t)=>{s[2+t]=e});for(let t=e.length;t<3;t+=1)s[2+t]=1;e.forEach((e,t)=>{let n=Math.fround(e.lo),r=Math.fround(e.hi),i=Math.fround(r-n),a=Math.fround(2/i);if(!Number.isFinite(e.lo)||!Number.isFinite(e.hi)||!Number.isFinite(i)||!(r>n)||!Number.isFinite(a)||!(a>0))throw RangeError(`GPU response domains and derivative scales must be representable in f32`);s[5+2*t]=n,s[6+2*t]=r}),s[11]=o,t.push(...s),n.push(...r.coefficients)}let r=4+t.length;if(r+n.length>=2**24)throw RangeError(`response function table exceeds exact f32 indexing`);let i=new Float32Array(r+n.length);return i[0]=e.length,i[1]=r,i.set(t,4),i.set(n,r),Object.freeze({schema:ao,functionCount:e.length,data:i})}function so(e=`rf_table`){return`
fn rf_finite(x: f32) -> bool { return abs(x) <= 3.4028234e38; }
fn rf_index(x: f32) -> bool { return x >= 0.0 && x < 16777216.0 && floor(x) == x; }

struct RfCoordinates {
  base: u32,
  terms: vec3<u32>,
  t: vec3<f32>,
  scale: vec3<f32>,
  ok: u32,
};

// Validate before integer casts or indexed reads. Pending GPU tables and
// malformed artifacts never acquire validity through robust out-of-bounds zeros.
fn rf_coordinates(index: u32, x: vec3<f32>) -> RfCoordinates {
  var out: RfCoordinates;
  let length = arrayLength(&${e});
  if (length < 4u) { return out; }
  let count_f = ${e}[0];
  let base_f = ${e}[1];
  if (!rf_index(count_f) || !rf_index(base_f)) { return out; }
  let count = u32(count_f);
  let table_base = u32(base_f);
  if (count > (length - 4u) / 16u
    || index >= count || table_base > length
    || table_base < 4u + count * 16u) { return out; }
  let r = 4u + index * 16u;
  let axes_f = ${e}[r];
  let offset_f = ${e}[r + 1u];
  if (!rf_index(axes_f) || axes_f < 1.0 || axes_f > 3.0 || !rf_index(offset_f)) { return out; }
  let axes = u32(axes_f);
  let offset = u32(offset_f);
  if (offset > length - table_base) { return out; }
  out.base = table_base + offset;
  for (var a = 0u; a < 3u; a = a + 1u) {
    let terms = ${e}[r + 2u + a];
    if (!rf_index(terms) || terms < 1.0 || terms > 32.0
      || (a >= axes && terms != 1.0)) { return RfCoordinates(); }
    out.terms[a] = u32(terms);
    if (a < axes) {
      let lo = ${e}[r + 5u + 2u * a];
      let hi = ${e}[r + 6u + 2u * a];
      let width = hi - lo;
      if (!rf_finite(lo) || !rf_finite(hi) || !rf_finite(width) || !(width > 0.0)
        || !rf_finite(x[a]) || !(x[a] >= lo && x[a] <= hi)) { return RfCoordinates(); }
      out.scale[a] = 2.0 / width;
      if (!rf_finite(out.scale[a]) || !(out.scale[a] > 0.0)) { return RfCoordinates(); }
      out.t[a] = clamp(2.0 * ((x[a] - lo) / width) - 1.0, -1.0, 1.0);
    }
  }
  let terms = out.terms.x * out.terms.y * out.terms.z;
  let bound = ${e}[r + 11u];
  if (terms > length - out.base || !rf_finite(bound) || bound < 0.0) { return RfCoordinates(); }
  out.ok = 1u;
  return out;
}

fn rf_chebyshev(t: f32, n: u32) -> array<f32, 32> {
  var out: array<f32, 32>;
  out[0] = 1.0;
  if (n > 1u) { out[1] = t; }
  for (var k = 2u; k < n; k = k + 1u) { out[k] = 2.0 * t * out[k - 1u] - out[k - 2u]; }
  return out;
}

// Strict: ok = 0 outside the fitted box (no extrapolation) or for a bad index.
fn rf_eval(index: u32, x_in: vec3<f32>) -> vec2<f32> {
  let coordinates = rf_coordinates(index, x_in);
  if (coordinates.ok == 0u) { return vec2<f32>(0.0); }
  let base = coordinates.base;
  let n0 = coordinates.terms.x;
  let n1 = coordinates.terms.y;
  let n2 = coordinates.terms.z;
  let t = coordinates.t;
  let tx = rf_chebyshev(t.x, n0);
  let ty = rf_chebyshev(t.y, n1);
  let tz = rf_chebyshev(t.z, n2);
  var sum = 0.0;
  for (var i = 0u; i < n0; i = i + 1u) {
    for (var j = 0u; j < n1; j = j + 1u) {
      for (var k = 0u; k < n2; k = k + 1u) {
        sum = sum + ${e}[base + (i * n1 + j) * n2 + k] * tx[i] * ty[j] * tz[k];
      }
    }
  }
  if (!rf_finite(sum)) { return vec2<f32>(0.0); }
  return vec2<f32>(sum, 1.0);
}

struct RfBasisDifferential {
  value: array<f32, 32>,
  first: array<f32, 32>,
  second: array<f32, 32>,
};

fn rf_basis_differential(t: f32, n: u32) -> RfBasisDifferential {
  var out: RfBasisDifferential;
  out.value[0] = 1.0;
  if (n > 1u) { out.value[1] = t; out.first[1] = 1.0; }
  for (var k = 2u; k < n; k = k + 1u) {
    out.value[k] = 2.0 * t * out.value[k - 1u] - out.value[k - 2u];
    out.first[k] = 2.0 * out.value[k - 1u] + 2.0 * t * out.first[k - 1u] - out.first[k - 2u];
    out.second[k] = 4.0 * out.first[k - 1u] + 2.0 * t * out.second[k - 1u] - out.second[k - 2u];
  }
  return out;
}

struct RfDifferential {
  value: f32,
  gradient: vec3<f32>,
  hessian: mat3x3<f32>,
  ok: u32,
};

fn rf_scale_second(value: f32, first_scale: f32, second_scale: f32) -> f32 {
  // An explicit zero branch is necessary: GPU contraction can combine the
  // scales before multiplying a zero derivative, producing 0 * infinity.
  if (value == 0.0 || first_scale == 0.0 || second_scale == 0.0) { return 0.0; }
  return (value * first_scale) * second_scale;
}

fn rf_eval_differential(index: u32, x: vec3<f32>) -> RfDifferential {
  var out: RfDifferential;
  let c = rf_coordinates(index, x);
  if (c.ok == 0u) { return out; }
  let bx = rf_basis_differential(c.t.x, c.terms.x);
  let by = rf_basis_differential(c.t.y, c.terms.y);
  let bz = rf_basis_differential(c.t.z, c.terms.z);
  for (var i = 0u; i < c.terms.x; i = i + 1u) {
    for (var j = 0u; j < c.terms.y; j = j + 1u) {
      for (var k = 0u; k < c.terms.z; k = k + 1u) {
        let a = ${e}[c.base + (i * c.terms.y + j) * c.terms.z + k];
        out.value += a * bx.value[i] * by.value[j] * bz.value[k];
        out.gradient += a * vec3<f32>(bx.first[i] * by.value[j] * bz.value[k],
          bx.value[i] * by.first[j] * bz.value[k], bx.value[i] * by.value[j] * bz.first[k]);
        out.hessian[0][0] += a * bx.second[i] * by.value[j] * bz.value[k];
        out.hessian[1][1] += a * bx.value[i] * by.second[j] * bz.value[k];
        out.hessian[2][2] += a * bx.value[i] * by.value[j] * bz.second[k];
        out.hessian[0][1] += a * bx.first[i] * by.first[j] * bz.value[k];
        out.hessian[0][2] += a * bx.first[i] * by.value[j] * bz.first[k];
        out.hessian[1][2] += a * bx.value[i] * by.first[j] * bz.first[k];
      }
    }
  }
  out.gradient *= c.scale;
  for (var column = 0u; column < 3u; column += 1u) {
    for (var row = 0u; row < 3u; row += 1u) {
      out.hessian[column][row] = rf_scale_second(out.hessian[column][row], c.scale[row], c.scale[column]);
    }
    if (!all(abs(out.hessian[column]) <= vec3<f32>(3.4028234e38))) { return RfDifferential(); }
  }
  out.hessian[1][0] = out.hessian[0][1];
  out.hessian[2][0] = out.hessian[0][2];
  out.hessian[2][1] = out.hessian[1][2];
  if (!rf_finite(out.value) || !all(abs(out.gradient) <= vec3<f32>(3.4028234e38))) { return RfDifferential(); }
  out.ok = 1u;
  return out;
}
`}var co=`peercompute.ulg.eshkol-triad-closures.v1`,Z=e=>{let t=Number(e);if(!Number.isFinite(t))throw RangeError(`Eshkol triad closure parameter must be finite`);return t.toPrecision(17)};function Q(e,t){let n=Number(e);if(!Number.isFinite(n)||!(n>0))throw RangeError(`${t} must be a positive finite number`);return n}function lo({material:e=`generic`,cvJPerKgK:t=1e3,rSpecificJPerKgK:n=287.05,bulkModulusPa:r=2e9,refTemperatureK:i=300,refSpecificVolumeM3PerKg:a=.001,refInternalEnergyJPerKg:o=0}={}){let s=Q(t,`cvJPerKgK`),c=Q(n,`rSpecificJPerKgK`),l=Q(r,`bulkModulusPa`),u=Q(i,`refTemperatureK`),d=Q(a,`refSpecificVolumeM3PerKg`),f=Number(o)||0,p=`(define (helmholtz-a T v)
  (+ ${Z(f)}
     (* (- ${Z(s)}) T (- (log (/ T ${Z(u)})) 1.0))
     (* (- ${Z(c)}) T (log (/ v ${Z(d)})))
     (* 0.5 ${Z(l)} ${Z(d)} (expt (- (/ v ${Z(d)}) 1.0) 2.0))))
(define (helmholtz-s T v) (- (derivative (lambda (tau) (helmholtz-a tau v)) T)))
(define (helmholtz-p T v) (- (derivative (lambda (vol) (helmholtz-a T vol)) v)))
(define (helmholtz-cv T v) (* (- T) (derivative (lambda (tau) (derivative (lambda (t2) (helmholtz-a t2 v)) tau)) T)))
(define (helmholtz-kt T v) (* v (derivative (lambda (vol) (derivative (lambda (v2) (helmholtz-a T v2)) vol)) v)))`,m={a:(e,t)=>f-s*e*(Math.log(e/u)-1)-c*e*Math.log(t/d)+.5*l*d*(t/d-1)**2,s:(e,t)=>s*Math.log(e/u)+c*Math.log(t/d),p:(e,t)=>c*e/t-l*(t/d-1),cv:()=>s,kt:(e,t)=>c*e/t+t/d*l},h=Ja(`eshkol-helmholtz:v1:${e}:${p}`,`eshkol-helmholtz`);return Object.freeze({material:e,definition:p,call:`helmholtz-a`,closedForm:m,parameters:Object.freeze({cv:s,rs:c,k0:l,t0:u,v0:d,u0:f}),sourceFingerprint:h})}function uo({material:e=`fe-solid`,lameLambda0Pa:t=115e9,lameMu0Pa:n=82e9,thermalExpansionPerK:r=12e-6,refTemperatureK:i=300,meltTemperatureK:a=1811,softeningCoeff:o=.35}={}){let s=Q(t,`lameLambda0Pa`),c=Q(n,`lameMu0Pa`),l=Q(r,`thermalExpansionPerK`),u=Q(i,`refTemperatureK`),d=Q(a,`meltTemperatureK`),f=Math.max(0,Math.min(.8,Number(o)||.35)),p=s+2/3*c,m=.1*p,h=`(define (solid-soften T) (- 1.0 (* ${Z(f)} (/ (- T ${Z(u)}) ${Z(d)}))))
(define (solid-j-th T) (+ 1.0 (* 3.0 ${Z(l)} (- T ${Z(u)}))))
(define (solid-psi J T)
  (let ((s (solid-soften T)) (jel (/ J (solid-j-th T))))
    (+ ${Z(m)}
       (* 0.5 ${Z(p)} s (expt (- jel 1.0) 2.0))
       (* ${Z(c)} s (- (expt jel (/ 2.0 3.0)) 1.0 (* (/ 2.0 3.0) (log jel)))))))
(define (solid-pressure J T) (- (derivative (lambda (j) (solid-psi j T)) J)))
(define (solid-mu T) (* ${Z(c)} (solid-soften T)))
(define (solid-lambda T) (* ${Z(s)} (solid-soften T)))`,g=e=>Math.max(.05,1-f*((e-u)/d)),_=e=>1+3*l*(e-u),v={psi:(e,t)=>{let n=g(t),r=e/_(t);return m+.5*p*n*(r-1)**2+c*n*(Math.cbrt(r*r)-1-2/3*Math.log(r))},mu:e=>c*g(e),lambda:e=>s*g(e),alpha:()=>l},y=Ja(`eshkol-solid-hyperelastic:v1:${e}:${h}`,`eshkol-solid-hyperelastic`);return Object.freeze({material:e,definition:h,call:`solid-psi`,closedForm:v,parameters:Object.freeze({lam0:s,mu0:c,k0:p,alpha0:l,t0:u,tm:d,beta:f}),sourceFingerprint:y})}function fo({material:e=`h2o`,refTemperatureK:t=300,refDensityKgPerM3:n=1.2,sutherlandK:r=120,kRefWPerMK:i=.026,muRefPaS:a=185e-7,diffusivityRefM2PerS:o=22e-6,enskogDensityCoeff:s=.12}={}){let c=Q(t,`refTemperatureK`),l=Q(n,`refDensityKgPerM3`),u=Q(r,`sutherlandK`),d=Q(i,`kRefWPerMK`),f=Q(a,`muRefPaS`),p=Q(o,`diffusivityRefM2PerS`),m=Math.max(0,Number(s)||.12),h=`(* (expt (/ T ${Z(c)}) 1.5) (/ (+ ${Z(c)} ${Z(u)}) (+ T ${Z(u)})))`,g=`(+ 1.0 (* ${Z(m)} (/ rho ${Z(l)})))`,_=`(define (transport-k T rho) (* ${Z(d)} ${h} ${g}))
(define (transport-mu T rho) (* ${Z(f)} ${h} ${g}))
(define (transport-D T rho) (* ${Z(p)} (expt (/ T ${Z(c)}) 1.5) (/ ${Z(l)} rho)))`,v=e=>(e/c)**1.5*((c+u)/(e+u)),y=e=>1+e/l*m,b={k:(e,t)=>d*v(e)*y(t),mu:(e,t)=>f*v(e)*y(t),D:(e,t)=>p*(e/c)**1.5*(l/t)},x=Ja(`eshkol-transport:v1:${e}:${_}`,`eshkol-transport`);return Object.freeze({material:e,definition:_,calls:Object.freeze({k:`transport-k`,mu:`transport-mu`,D:`transport-D`}),closedForm:b,parameters:Object.freeze({t0:c,rho0:l,suth:u,kRef:d,muRef:f,dRef:p,bDens:m}),sourceFingerprint:x})}async function po({sample:e,definition:t,call:n,closedFormFn:r,id:i,sourceFingerprint:a,axes:o,outputUnit:s,box:c,degrees:l,signs:u=null,relativeTolerance:d=1e-5,heldOutPerAxis:f=5}){let p=[],m=new Set,h=([e,t])=>`${Number(e).toPrecision(17)}|${Number(t).toPrecision(17)}`;ro({box:c,degrees:l,relativeTolerance:1,heldOutPerAxis:f,generator:{id:`${i}:probe`,axes:o,outputUnit:s,sourceFingerprint:a,regimeOf:()=>`single-phase`,evaluate(e){let t=h(e);return m.has(t)||(m.add(t),p.push([e[0],e[1]])),1}}});let g=typeof e==`function`?await e(t,n,p):p.map(([e,t])=>r(e,t));if(!Array.isArray(g)||g.length!==p.length||!g.every(Number.isFinite))throw Error(`Eshkol sampling failed for ${n}: incomplete or non-finite batch`);let _=0,v=new Map;for(let e=0;e<p.length;e+=1){let t=p[e],n=g[e],i=r(t[0],t[1]),a=Math.max(1e-12,Math.abs(i));_=Math.max(_,Math.abs(n-i)/a),v.set(h(t),n)}if(_>1e-4)throw RangeError(`Eshkol AD sample cross-check failed for ${n}: err=${_}`);let y=ro({box:c,degrees:l,...u?{signs:u}:{},relativeTolerance:d,heldOutPerAxis:f,generator:{id:i,axes:o,outputUnit:s,sourceFingerprint:a,regimeOf:()=>`single-phase`,evaluate(e){let t=v.get(h(e));if(t===void 0)throw Error(`Unsampled point requested for ${n}`);return t}}});return Object.freeze({responseFunction:y,sampleCount:p.length,crossCheckMaxRelativeError:_})}function mo(e,t=10,n=22){let r=Math.max(1e-6,Number(e?.[0])||200),i=Math.max(r*1.01,Number(e?.[1])||1200)/r;return i>10?Math.min(n,Math.max(t,20)):i>5?Math.min(n,Math.max(t,16)):i>2.5?Math.min(n,Math.max(t,14)):t}async function ho({sample:e=null,material:t=`generic`,cvJPerKgK:n=1e3,rSpecificJPerKgK:r=287.05,bulkModulusPa:i=2e9,refTemperatureK:a=300,refSpecificVolumeM3PerKg:o=.001,refInternalEnergyJPerKg:s=0,temperatureRangeK:c=[240,600],specificVolumeRangeM3PerKg:l=[92e-5,.00108],degrees:u=null,relativeTolerance:d=1e-5}={}){let f=Array.isArray(u)?u:[mo(c,14,22),8],p=lo({material:t,cvJPerKgK:n,rSpecificJPerKgK:r,bulkModulusPa:i,refTemperatureK:a,refSpecificVolumeM3PerKg:o,refInternalEnergyJPerKg:s}),m=await po({sample:e,definition:p.definition,call:p.call,closedFormFn:p.closedForm.a,id:`a4:eshkol-helmholtz:${t}`,sourceFingerprint:p.sourceFingerprint,axes:[{name:`temperature`,unit:`K`},{name:`specificVolume`,unit:`m^3/kg`}],outputUnit:`J/kg`,box:[[Number(c[0]),Number(c[1])],[Number(l[0]),Number(l[1])]],degrees:f,relativeTolerance:d});return Object.freeze({schema:co,kind:`helmholtz-potential`,material:t,program:p,...m})}async function go({sample:e=null,material:t=`fe-solid`,lameLambda0Pa:n=115e9,lameMu0Pa:r=82e9,thermalExpansionPerK:i=12e-6,refTemperatureK:a=300,meltTemperatureK:o=1811,softeningCoeff:s=.35,jacobianRange:c=[.92,1.08],temperatureRangeK:l=[200,1400],degrees:u=[8,6],relativeTolerance:d=1e-5}={}){let f=uo({material:t,lameLambda0Pa:n,lameMu0Pa:r,thermalExpansionPerK:i,refTemperatureK:a,meltTemperatureK:o,softeningCoeff:s}),p=await po({sample:e,definition:f.definition,call:`solid-psi`,closedFormFn:f.closedForm.psi,id:`a4:eshkol-solid-psi:${t}`,sourceFingerprint:f.sourceFingerprint,axes:[{name:`jacobian`,unit:`1`},{name:`temperature`,unit:`K`}],outputUnit:`J/m^3`,box:[[Number(c[0]),Number(c[1])],[Number(l[0]),Number(l[1])]],degrees:u,relativeTolerance:d});return Object.freeze({schema:co,kind:`solid-hyperelastic`,material:t,program:f,...p})}async function _o({sample:e=null,material:t=`h2o`,refTemperatureK:n=300,refDensityKgPerM3:r=1.2,sutherlandK:i=120,kRefWPerMK:a=.026,muRefPaS:o=185e-7,diffusivityRefM2PerS:s=22e-6,enskogDensityCoeff:c=.12,temperatureRangeK:l=[220,1200],densityRangeKgPerM3:u=[.4,4],degrees:d=null,relativeTolerance:f=1e-5}={}){let p=mo(l,14,24),m=Array.isArray(d)?d:[p,6],h=Array.isArray(d)?[d[0],Math.max(24,d[1])]:[p,24],g=fo({material:t,refTemperatureK:n,refDensityKgPerM3:r,sutherlandK:i,kRefWPerMK:a,muRefPaS:o,diffusivityRefM2PerS:s,enskogDensityCoeff:c}),_=[{name:`temperature`,unit:`K`},{name:`density`,unit:`kg/m^3`}],v=[[Number(l[0]),Number(l[1])],[Number(u[0]),Number(u[1])]],y=await po({sample:e,definition:g.definition,call:g.calls.k,closedFormFn:g.closedForm.k,id:`a4:eshkol-transport-k:${t}`,sourceFingerprint:g.sourceFingerprint,axes:_,outputUnit:`W/(m*K)`,box:v,degrees:m,signs:[1,1],relativeTolerance:f}),b=await po({sample:e,definition:g.definition,call:g.calls.mu,closedFormFn:g.closedForm.mu,id:`a4:eshkol-transport-mu:${t}`,sourceFingerprint:g.sourceFingerprint,axes:_,outputUnit:`Pa*s`,box:v,degrees:m,signs:[1,1],relativeTolerance:f}),x=await po({sample:e,definition:g.definition,call:g.calls.D,closedFormFn:g.closedForm.D,id:`a4:eshkol-transport-D:${t}`,sourceFingerprint:g.sourceFingerprint,axes:_,outputUnit:`m^2/s`,box:v,degrees:h,signs:[1,-1],relativeTolerance:f});return Object.freeze({schema:co,kind:`transport-closures`,material:t,program:g,conductivity:y,viscosity:b,diffusivity:x,responseFunctions:Object.freeze([y.responseFunction,b.responseFunction,x.responseFunction])})}function vo({helmholtz:e,solidHyperelastic:t,transport:n}){let r=oo([e.responseFunction,t.responseFunction,n.conductivity.responseFunction,n.viscosity.responseFunction,n.diffusivity.responseFunction]),i=Ja([e.program.sourceFingerprint,t.program.sourceFingerprint,n.program.sourceFingerprint].join(`|`),`eshkol-triad-bundle`);return Object.freeze({schema:co,gpuTableSchema:ao,functionSlots:Object.freeze({helmholtz:0,solidHyperelastic:1,conductivity:2,viscosity:3,diffusivity:4}),sourceFingerprint:i,packed:r,evaluateHost:Object.freeze({helmholtz:(t,n)=>io(e.responseFunction,[t,n]),solidPsi:(e,n)=>io(t.responseFunction,[e,n]),k:(e,t)=>io(n.conductivity.responseFunction,[e,t]),mu:(e,t)=>io(n.viscosity.responseFunction,[e,t]),D:(e,t)=>io(n.diffusivity.responseFunction,[e,t])})})}function yo(e=`triad_a4_table`){return`
${so(e)}

struct TriadHelmholtzState {
  free_energy_j_per_kg: f32,
  entropy_j_per_kg_k: f32,
  pressure_pa: f32,
  cv_j_per_kg_k: f32,
  bulk_modulus_kt_pa: f32,
  ok: u32,
};

fn triad_eval_helmholtz(slot: u32, temperature_k: f32, specific_volume: f32) -> TriadHelmholtzState {
  var out: TriadHelmholtzState;
  if (!(temperature_k > 0.0) || !(specific_volume > 0.0)) { return out; }
  let d = rf_eval_differential(slot, vec3<f32>(temperature_k, specific_volume, 0.0));
  if (d.ok == 0u) { return out; }
  let s = -d.gradient.x;
  let p = -d.gradient.y;
  let cv = -temperature_k * d.hessian[0][0];
  let kt = specific_volume * d.hessian[1][1];
  if (!rf_finite(s) || !rf_finite(p) || !rf_finite(cv) || !rf_finite(kt) || !(cv > 0.0) || !(kt > 0.0)) {
    return out;
  }
  out.free_energy_j_per_kg = d.value;
  out.entropy_j_per_kg_k = s;
  out.pressure_pa = p;
  out.cv_j_per_kg_k = cv;
  out.bulk_modulus_kt_pa = kt;
  out.ok = 1u;
  return out;
}

// Returns vec4(psi_j_per_m3, pressure_pa, tangent_modulus_pa, ok)
fn triad_eval_solid_hyperelastic(slot: u32, jacobian: f32, temperature_k: f32) -> vec4<f32> {
  if (!(jacobian > 0.0) || !(temperature_k > 0.0)) { return vec4<f32>(0.0); }
  let d = rf_eval_differential(slot, vec3<f32>(jacobian, temperature_k, 0.0));
  if (d.ok == 0u) { return vec4<f32>(0.0); }
  let pressure = -d.gradient.x;
  let tangent_k = jacobian * d.hessian[0][0];
  if (!rf_finite(pressure) || !rf_finite(tangent_k) || !(tangent_k > 0.0)) {
    return vec4<f32>(0.0);
  }
  return vec4<f32>(d.value, pressure, tangent_k, 1.0);
}

// Returns vec4(k_w_per_mk, mu_pa_s, D_m2_per_s, ok)
fn triad_eval_transport(k_slot: u32, mu_slot: u32, d_slot: u32, temperature_k: f32, density_kg_per_m3: f32) -> vec4<f32> {
  let pt = vec3<f32>(temperature_k, density_kg_per_m3, 0.0);
  let rk = rf_eval(k_slot, pt);
  let rmu = rf_eval(mu_slot, pt);
  let rd = rf_eval(d_slot, pt);
  if (rk.y != 1.0 || rmu.y != 1.0 || rd.y != 1.0 || !(rk.x > 0.0) || !(rmu.x > 0.0) || !(rd.x > 0.0)) {
    return vec4<f32>(0.0);
  }
  return vec4<f32>(rk.x, rmu.x, rd.x, 1.0);
}
`}var bo=`peercompute.ulg.moonlab-first-principles-cold-miss-synthesis.v1`,xo=8.314462618,So=1380649e-29,Co=602214076e15,wo=1054571817e-43;function To(e,t){let n=Number(e);if(!Number.isFinite(n)||!(n>0))throw RangeError(`${t} must be a positive finite number`);return n}function Eo(e,t){let n=To(e,`temperatureK`),r=To(t,`debyeTemperatureK`),i=Math.min(40,r/n);if(i<1e-4)return 1;let a=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363],o=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763],s=.5*i,c=0;for(let e=0;e<a.length;e+=1){let t=s*(a[e]+1),n=Math.exp(t),r=(n-1)*(n-1),i=r>0?t*t*t*t*n/r:0;c+=o[e]*i}return c*=s,Math.max(1e-4,Math.min(1,3/(i*i*i)*c))}function Do({material:e,molarMassKgPerMol:t,atomsPerFormula:n=1,cohesiveEnergyEvPerAtom:r,debyeTemperatureK:i,molecularDiameterM:a,refDensityKgPerM3:o,meltTemperatureK:s=1200,quantumProbeReceipt:c=null}={}){if(typeof e!=`string`||!e.trim())throw TypeError(`MoonLab cold-miss synthesis requires a material identifier`);let l=To(t,`molarMassKgPerMol`),u=To(n,`atomsPerFormula`),d=To(r,`cohesiveEnergyEvPerAtom`),f=To(i,`debyeTemperatureK`),p=To(a,`molecularDiameterM`),m=To(o,`refDensityKgPerM3`),h=To(s,`meltTemperatureK`),g=xo/l,_=3*u*g,v=l/(Co*u*m),y=d*1602176634e-28,b=Math.max(1e7,y/v*2.2),x=.4615384615*b,S=b-2/3*x,C=Math.max(1e-6,Math.min(2e-4,.018/h)),w=l/Co,T=5/16*Math.sqrt(Math.PI*w*So*300)/(Math.PI*p*p),E=T*(Math.max(1.5*g,.75*_)+2.25*g),D=101325*l/(xo*300),O=3/8*Math.sqrt(Math.PI*So*300/w)*(1/(Math.PI*p*p*(D/w))),k=So*f/wo,A=Ja(JSON.stringify({schema:bo,material:e.trim(),M:l,atoms:u,eCohEv:d,thetaD:f,sigmaM:p,rho0:m,tMelt:h,quantumProbeFingerprint:c?.fingerprint??c?.qubits??null}),`moonlab-cold-miss-params`);return Object.freeze({material:e.trim(),molarMassKgPerMol:l,atomsPerFormula:u,rSpecificJPerKgK:g,dulongPetitCvJPerKgK:_,debyeTemperatureK:f,debyeAngularFreqRadPerS:k,bulkModulusPa:b,lameLambda0Pa:S,lameMu0Pa:x,thermalExpansionPerK:C,refDensityKgPerM3:m,gasRefDensityKgPerM3:D,meltTemperatureK:h,muRefPaS:T,kRefWPerMK:E,diffusivityRefM2PerS:O,provenanceFingerprint:A})}function Oo({dulongPetitCvJPerKgK:e,debyeTemperatureK:t,tMinK:n=60,tMaxK:r=900,sampleCount:i=17,uOriginJPerKg:a=0}={}){let o=To(e,`dulongPetitCvJPerKgK`),s=To(t,`debyeTemperatureK`),c=To(n,`tMinK`),l=To(r,`tMaxK`);if(!(l>c))throw RangeError(`tMaxK must exceed tMinK`);let u=Math.max(3,Math.min(128,Math.round(Number(i)||17))),d=[],f=Number(a)||0;d.push({u:f,temperatureK:c});let p=(l-c)/(u-1);for(let e=1;e<u;e+=1){let t=c+(e-1)*p,n=c+e*p,r=.5*(t+n),i=o*Eo(t,s),a=o*Eo(r,s),l=o*Eo(n,s),u=p/6*(i+4*a+l);if(!(u>0)||!Number.isFinite(u))throw RangeError(`Non-positive Debye caloric energy increment`);f+=u,d.push({u:f,temperatureK:n})}return Object.freeze(d.map(e=>Object.freeze(e)))}async function ko({material:e,molarMassKgPerMol:t,atomsPerFormula:n=1,cohesiveEnergyEvPerAtom:r,debyeTemperatureK:i,molecularDiameterM:a,refDensityKgPerM3:o,meltTemperatureK:s=1200,temperatureRangeK:c=[240,800],eshkolSample:l=null,quantumProbeReceipt:u=null,g6SampleCount:d=33}={}){let f=Do({material:e,molarMassKgPerMol:t,atomsPerFormula:n,cohesiveEnergyEvPerAtom:r,debyeTemperatureK:i,molecularDiameterM:a,refDensityKgPerM3:o,meltTemperatureK:s,quantumProbeReceipt:u}),p=1/f.refDensityKgPerM3,m=await ho({sample:l,material:f.material,cvJPerKgK:f.dulongPetitCvJPerKgK,rSpecificJPerKgK:f.rSpecificJPerKgK,bulkModulusPa:f.bulkModulusPa,refTemperatureK:300,refSpecificVolumeM3PerKg:p,refInternalEnergyJPerKg:2*f.dulongPetitCvJPerKgK*300,temperatureRangeK:c,specificVolumeRangeM3PerKg:[.92*p,1.08*p]}),h=Math.max(10,Math.min(f.meltTemperatureK*.9,c[1])),g=Math.max(4,Math.min(200,c[0],h*.4)),_=await go({sample:l,material:f.material,lameLambda0Pa:f.lameLambda0Pa,lameMu0Pa:f.lameMu0Pa,thermalExpansionPerK:f.thermalExpansionPerK,refTemperatureK:Math.min(300,Math.max(g,h*.8)),meltTemperatureK:f.meltTemperatureK,temperatureRangeK:[g,h]}),v=await _o({sample:l,material:f.material,refTemperatureK:300,refDensityKgPerM3:f.gasRefDensityKgPerM3,kRefWPerMK:f.kRefWPerMK,muRefPaS:f.muRefPaS,diffusivityRefM2PerS:f.diffusivityRefM2PerS,temperatureRangeK:c,densityRangeKgPerM3:[.35*f.gasRefDensityKgPerM3,3.5*f.gasRefDensityKgPerM3]}),y=vo({helmholtz:m,solidHyperelastic:_,transport:v}),b=Math.max(12,Math.min(f.meltTemperatureK,c[1])),x=Math.max(4,Math.min(60,c[0]*.5,b*.4)),S=Oo({dulongPetitCvJPerKgK:f.dulongPetitCvJPerKgK,debyeTemperatureK:f.debyeTemperatureK,tMinK:x,tMaxK:b,sampleCount:d}),C=Ja(`${f.provenanceFingerprint}|${y.sourceFingerprint}|g6:${S.length}`,`moonlab-triad-synthesis`);return Object.freeze({schema:bo,material:f.material,parameters:f,helmholtz:m,solidHyperelastic:_,transport:v,gpuBundle:y,g6DebyeSamples:S,quantumProbeReceipt:u??null,provenanceFingerprint:C})}var Ao=`peercompute.ulg.triad-closure-gpu-registry.v1`,jo=4294967295,Mo={MAP_READ:1,COPY_SRC:4,COPY_DST:8,STORAGE:128},No=Symbol.for(`ulg.triadClosureRegistryByDevice.v1`),Po=globalThis[No]??=new WeakMap;function Fo(e){if(!(e instanceof Float32Array)||e.length<4)return[];let t=Math.floor(e[0]),n=Math.floor(e[1]);if(!(t>0)||n<4+t*16)return[];let r=[];for(let i=0;i<t;i+=1){let t=4+i*16,a=e.slice(t,t+16),o=Math.max(1,Math.min(3,Math.floor(a[0]))),s=Math.max(1,Math.floor(a[2])),c=o>=2?Math.max(1,Math.floor(a[3])):1,l=o>=3?Math.max(1,Math.floor(a[4])):1,u=s*c*l,d=n+Math.floor(a[1]);if(d+u>e.length)throw RangeError(`Packed response function ${i} exceeds table length`);r.push({record:a,coefficients:e.slice(d,d+u)})}return r}function Io(e){if(!Array.isArray(e)||e.length===0)return new Float32Array(4);let t=e.length,n=4+t*16,r=0;for(let t of e)r+=t.coefficients.length;let i=new Float32Array(n+r);i[0]=t,i[1]=n;let a=0;for(let r=0;r<t;r+=1){let t=4+r*16,o=e[r].record;i.set(o,t),i[t+1]=a,i.set(e[r].coefficients,n+a),a+=e[r].coefficients.length}return i}function Lo(e){let t=P(e),n=Po.get(t);return n||(n={device:e,generation:0,gasByMaterialId:new Map,triadByMaterialId:new Map,tableBuffer:null,materialMapBuffer:null,receiptBuffer:null,tableByteLength:0,materialCount:0,functionCount:0,dirty:!1,destroyed:!1},Po.set(t,n),n)}function Ro(e,t){if(t)try{N(e,()=>{try{t.destroy?.()}catch{}})}catch{try{t.destroy?.()}catch{}}}function zo(e){let{device:t}=e;if(!t?.createBuffer||!t?.queue?.writeBuffer)return!1;let n=Array.from(new Set([...e.gasByMaterialId.keys(),...e.triadByMaterialId.keys()])).sort((e,t)=>e-t);if(n.length===0)return!1;let r=[],i=new Uint32Array(n.length*8);i.fill(jo);for(let t=0;t<n.length;t+=1){let a=n[t],o=t*8;i[o]=a>>>0;let s=e.triadByMaterialId.get(a);if(s&&s.slices.length===5){let e=r.length;for(let e of s.slices)r.push(e);i[o+1]=e,i[o+2]=e+1,i[o+3]=e+2}let c=e.gasByMaterialId.get(a);c&&(c.soundSpeed&&(i[o+4]=r.length,r.push(c.soundSpeed)),c.dynamicViscosity&&(i[o+5]=r.length,r.push(c.dynamicViscosity)),c.thermalConductivity&&(i[o+6]=r.length,r.push(c.thermalConductivity)),c.density&&(i[o+7]=r.length,r.push(c.density)))}if(r.length===0)return!1;let a=Io(r),o=t.createBuffer({label:`ulg-triad-a4-unified-table-g${e.generation+1}`,size:Math.max(16,a.byteLength),usage:Mo.STORAGE|Mo.COPY_DST});t.queue.writeBuffer(o,0,a);let s=t.createBuffer({label:`ulg-triad-a4-material-map-g${e.generation+1}`,size:Math.max(32,i.byteLength),usage:Mo.STORAGE|Mo.COPY_DST});t.queue.writeBuffer(s,0,i),e.receiptBuffer||(e.receiptBuffer=t.createBuffer({label:`ulg-triad-a4-envelope-receipt`,size:8*Uint32Array.BYTES_PER_ELEMENT,usage:Mo.STORAGE|Mo.COPY_DST|Mo.COPY_SRC}),t.queue.writeBuffer(e.receiptBuffer,0,new Uint32Array(8)));let c=e.tableBuffer,l=e.materialMapBuffer;return e.tableBuffer=o,e.materialMapBuffer=s,e.tableByteLength=a.byteLength,e.materialCount=n.length,e.functionCount=r.length,e.generation+=1,e.dirty=!1,t.queue.writeBuffer(e.receiptBuffer,7*Uint32Array.BYTES_PER_ELEMENT,new Uint32Array([e.generation])),c&&Ro(t,c),l&&Ro(t,l),Bo(e),!0}function Bo(e){let t=Vo(e);return globalThis.__ulgTriadA4ClosureStatus=t,t}function Vo(e){return Object.freeze(e?{schema:Ao,active:!!(e.tableBuffer&&e.materialMapBuffer&&e.receiptBuffer&&e.functionCount>0),generation:e.generation,materialCount:e.materialCount,triadMaterialCount:e.triadByMaterialId.size,gasMaterialCount:e.gasByMaterialId.size,functionCount:e.functionCount,tableByteLength:e.tableByteLength,triadMaterials:Object.freeze(Array.from(e.triadByMaterialId.values(),e=>e.materialKey)),gasMaterials:Object.freeze(Array.from(e.gasByMaterialId.values(),e=>e.materialKey))}:{schema:Ao,active:!1,generation:0,materialCount:0,triadMaterialCount:0,gasMaterialCount:0,functionCount:0,tableByteLength:0,triadMaterials:Object.freeze([]),gasMaterials:Object.freeze([])})}function Ho(e,{a4GasResponseTable:t=null,a4GasResponseByMaterial:n=null}={}){if(!e||!t?.data||!n)return null;let r=Fo(t.data);if(r.length===0)return null;let i=Lo(e),a=!1;for(let[e,t]of Object.entries(n)){let n=Number.isInteger(t?.materialId)?t.materialId:ia(e),o=t?.soundSpeedIndex,s=t?.dynamicViscosityIndex,c=t?.thermalConductivityIndex,l=t?.densityIndex,u={materialKey:e,soundSpeed:Number.isInteger(o)&&o<r.length?r[o]:null,dynamicViscosity:Number.isInteger(s)&&s<r.length?r[s]:null,thermalConductivity:Number.isInteger(c)&&c<r.length?r[c]:null,density:Number.isInteger(l)&&l<r.length?r[l]:null,sourceFingerprint:t?.sourceFingerprint??null},d=i.gasByMaterialId.get(n);(!d||d.sourceFingerprint!==u.sourceFingerprint)&&(i.gasByMaterialId.set(n,u),a=!0)}return(a||!i.tableBuffer)&&zo(i),Vo(i)}function Uo(e,{materialKey:t,materialId:n=null,packedData:r,sourceFingerprint:i=null,g6DebyeSamples:a=null}={}){if(!e||!t)return null;let o=r instanceof Float32Array?r:r?.data instanceof Float32Array?r.data:ArrayBuffer.isView(r)?new Float32Array(r.buffer,r.byteOffset,r.byteLength/4):null;if(!o||o.length<4)return null;let s=Fo(o);if(s.length!==5)throw RangeError(`Triad A4 closure bundle expects 5 slots, got ${s.length}`);let c=Number.isInteger(n)?n:ia(String(t)),l=Lo(e),u=l.triadByMaterialId.get(c);return u&&i&&u.sourceFingerprint===i&&l.tableBuffer?Vo(l):(l.triadByMaterialId.set(c,{materialKey:String(t),sourceFingerprint:i??null,slices:s,g6DebyeSamples:Array.isArray(a)?a:null}),zo(l),Vo(l))}function Wo(e){let t=e?Po.get(P(e)):null;return!t||!t.tableBuffer||!t.materialMapBuffer||!t.receiptBuffer||t.functionCount<=0?Object.freeze({active:!1,generation:0,materialCount:0,functionCount:0,tableBuffer:null,materialMapBuffer:null,receiptBuffer:null,status:Vo(t)}):Object.freeze({active:!0,generation:t.generation,materialCount:t.materialCount,functionCount:t.functionCount,tableBuffer:t.tableBuffer,materialMapBuffer:t.materialMapBuffer,receiptBuffer:t.receiptBuffer,status:Vo(t)})}function Go(e){return Vo(e?Po.get(P(e)):null)}function Ko(){return`
@group(0) @binding(9) var<storage, read> triad_a4_table: array<f32>;
@group(0) @binding(10) var<storage, read> triad_material_map: array<vec4<u32>>;
@group(0) @binding(11) var<storage, read_write> triad_envelope_receipt: array<atomic<u32>>;

${yo(`triad_a4_table`)}

const TRIAD_ABSENT_SLOT: u32 = ${jo}u;

struct TriadMaterialSlots {
  found: u32,
  helmholtz_slot: u32,
  solid_slot: u32,
  transport_base: u32,
  gas_sound_slot: u32,
  gas_visc_slot: u32,
  gas_cond_slot: u32,
  gas_dens_slot: u32,
};

fn triad_lookup_material_slots(material_id: u32) -> TriadMaterialSlots {
  var out: TriadMaterialSlots;
  out.found = 0u;
  out.helmholtz_slot = TRIAD_ABSENT_SLOT;
  out.solid_slot = TRIAD_ABSENT_SLOT;
  out.transport_base = TRIAD_ABSENT_SLOT;
  out.gas_sound_slot = TRIAD_ABSENT_SLOT;
  out.gas_visc_slot = TRIAD_ABSENT_SLOT;
  out.gas_cond_slot = TRIAD_ABSENT_SLOT;
  out.gas_dens_slot = TRIAD_ABSENT_SLOT;
  let row_count = arrayLength(&triad_material_map) / 2u;
  for (var i = 0u; i < row_count; i = i + 1u) {
    let r0 = triad_material_map[i * 2u];
    if (r0.x == material_id) {
      let r1 = triad_material_map[i * 2u + 1u];
      out.found = 1u;
      out.helmholtz_slot = r0.y;
      out.solid_slot = r0.z;
      out.transport_base = r0.w;
      out.gas_sound_slot = r1.x;
      out.gas_visc_slot = r1.y;
      out.gas_cond_slot = r1.z;
      out.gas_dens_slot = r1.w;
      return out;
    }
  }
  return out;
}

fn apply_triad_a4_mechanics_envelopes(
  material_id_f: f32,
  temperature_k: f32,
  current_density: f32,
  volume_ratio_j: f32,
  base: PhaseMechanics
) -> PhaseMechanics {
  var out = base;
  if (!(temperature_k > 0.0) || !(current_density > 0.0) || !(volume_ratio_j > 0.0)) {
    return out;
  }
  let mat_id = u32(max(0.0, floor(material_id_f + 0.5)));
  let slots = triad_lookup_material_slots(mat_id);
  if (slots.found == 0u) {
    return out;
  }
  atomicAdd(&triad_envelope_receipt[0u], 1u);

  // 1. A4 2-D (T, P) Gas response closures (strict in-box, CFL-ceiling safe).
  if (base.eos_model == 2.0 && slots.gas_sound_slot != TRIAD_ABSENT_SLOT) {
    let c_sq = base.sound_speed * base.sound_speed;
    let p_est = max(1.0, current_density * c_sq / 1.4);
    let r_cs = rf_eval(slots.gas_sound_slot, vec3<f32>(temperature_k, p_est, 0.0));
    if (r_cs.y == 1.0 && r_cs.x > 0.0 && rf_finite(r_cs.x)) {
      // Never exceed the CFL-admitted sound speed cap on explicit lanes.
      out.sound_speed = min(r_cs.x, max(base.sound_speed, 1.0));
      atomicAdd(&triad_envelope_receipt[4u], 1u);
    } else {
      atomicAdd(&triad_envelope_receipt[5u], 1u);
    }
    if (base.dynamic_viscosity > 0.0 && slots.gas_visc_slot != TRIAD_ABSENT_SLOT) {
      let r_mu = rf_eval(slots.gas_visc_slot, vec3<f32>(temperature_k, p_est, 0.0));
      if (r_mu.y == 1.0 && r_mu.x > 0.0 && rf_finite(r_mu.x)) {
        out.dynamic_viscosity = r_mu.x;
        atomicAdd(&triad_envelope_receipt[4u], 1u);
      } else {
        atomicAdd(&triad_envelope_receipt[5u], 1u);
      }
    }
  }

  // 2. Triad Eshkol Transport mu(T, rho) closure (only when viscosity enabled).
  if (slots.transport_base != TRIAD_ABSENT_SLOT) {
    let tr = triad_eval_transport(
      slots.transport_base,
      slots.transport_base + 1u,
      slots.transport_base + 2u,
      temperature_k,
      current_density
    );
    if (tr.w == 1.0) {
      if (base.dynamic_viscosity > 0.0 && base.eos_model != 2.0) {
        out.dynamic_viscosity = tr.y;
      }
      atomicAdd(&triad_envelope_receipt[3u], 1u);
    } else {
      atomicAdd(&triad_envelope_receipt[5u], 1u);
    }
  }

  // 3. Triad Eshkol Solid Hyperelastic Psi(J, T) tangent stiffness envelope.
  if (base.solid > 0.5 && slots.solid_slot != TRIAD_ABSENT_SLOT) {
    let sol = triad_eval_solid_hyperelastic(slots.solid_slot, volume_ratio_j, temperature_k);
    if (sol.w == 1.0) {
      atomicAdd(&triad_envelope_receipt[2u], 1u);
      if (base.bulk > 0.0 && sol.z > 0.0 && sol.z <= base.bulk) {
        out.bulk = sol.z;
      }
    } else {
      atomicAdd(&triad_envelope_receipt[5u], 1u);
    }
  }

  // 4. Triad Eshkol Fluid Helmholtz a(T, v) Maxwell-consistent K_T envelope.
  if (base.solid <= 0.5 && slots.helmholtz_slot != TRIAD_ABSENT_SLOT) {
    let v_spec = 1.0 / current_density;
    let helm = triad_eval_helmholtz(slots.helmholtz_slot, temperature_k, v_spec);
    if (helm.ok == 1u) {
      atomicAdd(&triad_envelope_receipt[1u], 1u);
      if (base.bulk > 0.0 && helm.bulk_modulus_kt_pa > 0.0 && helm.bulk_modulus_kt_pa <= base.bulk) {
        out.bulk = helm.bulk_modulus_kt_pa;
      }
    } else {
      atomicAdd(&triad_envelope_receipt[5u], 1u);
    }
  }

  return out;
}
`}var qo=`peercompute.ulg.material-polytope-registry.v0`,Jo=`peercompute.ulg.material-polytope.element.v0`,Yo=`peercompute.ulg.material-polytope.compound.v0`,Xo=`peercompute.ulg.material-polytope.crystal-structure.v0`;function Zo(e,t=null){let n=String(e||``).trim().toLowerCase();if(!n)return``;if(t==null||!Number.isFinite(Number(t)))return n;let r=Math.max(1,Math.trunc(Number(t)));return RegExp(`-${r}$`).test(n)?n:`${n}-${r}`}function Qo(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t^=e.charCodeAt(n),t=Math.imul(t,16777619)>>>0;return t.toString(16).padStart(8,`0`)}function $o({schema:e=Jo,polytopeId:t,materialKey:n,polytopeFamily:r=`element`,phase:i=`solid`,tMinK:a,tMaxK:o,pMinPa:s=1,pMaxPa:c=1e9,extraInequalities:l=[],accuracyTier:u=b.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:d=`derived-v1`,provenance:f={},crystalStructure:p=null}){let m=Math.max(.1,Number(a)),h=Math.max(m+.001,Number(o)),g=Math.max(1e-6,Number(s)),_=Math.max(g*1.01,Number(c)),v=Math.log10(g),y=Math.log10(_),x=Math.max(1e-6,h-m),S=Math.max(1e-6,y-v),C=[Object.freeze({axis:`temperatureK`,a:Object.freeze([-1,0]),b:-m,scale:x,label:`T >= ${m.toFixed(2)} K`}),Object.freeze({axis:`temperatureK`,a:Object.freeze([1,0]),b:h,scale:x,label:`T <= ${h.toFixed(2)} K`}),Object.freeze({axis:`log10PressurePa`,a:Object.freeze([0,-1]),b:-v,scale:S,label:`P >= ${g.toExponential(2)} Pa`}),Object.freeze({axis:`log10PressurePa`,a:Object.freeze([0,1]),b:y,scale:S,label:`P <= ${_.toExponential(2)} Pa`})],w=(Array.isArray(l)?l:[]).map(e=>Object.freeze({axis:e.axis||`coexistence`,a:Object.freeze([Number(e.a[0]),Number(e.a[1])]),b:Number(e.b),scale:Math.max(1e-6,Number(e.scale??Math.hypot(e.a[0]*x,e.a[1]*S))),label:String(e.label||`phase-boundary-facet`)})),T=Object.freeze([...C,...w]),E=Object.freeze([Object.freeze([m,g]),Object.freeze([h,g]),Object.freeze([h,_]),Object.freeze([m,_])]),D=w.map(e=>`${e.a[0].toFixed(4)},${e.a[1].toFixed(4)},${e.b.toFixed(4)}`).join(`;`);return Object.freeze({schema:e,schemaVersion:1,polytopeId:t,materialKey:String(n),polytopeFamily:r,phase:i,accuracyTier:u,axes:Object.freeze([Object.freeze({name:`temperatureK`,unit:`K`,min:m,max:h}),Object.freeze({name:`pressurePa`,unit:`Pa`,min:g,max:_,scale:`log10`})]),vertices:E,inequalities:T,crystalStructure:p?Object.freeze({...p}):null,invalidationKey:Qo(`${n}:${i}:${d}:${m}:${h}:${g}:${_}:${D}`),closureHash:String(d||`unhashed`),provenance:Object.freeze({...f||{},extrapolationPolicy:`fail-closed`})})}function es(e,t=null){let n=e.axes[0],r=e.axes[1],i=Math.log10(r.min),a=Math.log10(r.max),o=t===0||t==null&&(n.max-n.min)/Math.max(1,n.min)>=a-i,s=e.inequalities.slice(4);if(o){let t=(e.phase===`gas`||e.phase===`plasma`)&&n.max/Math.max(.001,n.min)>10?Math.sqrt(n.min*n.max):.5*(n.min+n.max);return[$o({...e,polytopeId:`${e.polytopeId}:tL`,tMinK:n.min,tMaxK:t,pMinPa:r.min,pMaxPa:r.max,extraInequalities:s}),$o({...e,polytopeId:`${e.polytopeId}:tR`,tMinK:t,tMaxK:n.max,pMinPa:r.min,pMaxPa:r.max,extraInequalities:s})]}let c=10**(.5*(i+a));return[$o({...e,polytopeId:`${e.polytopeId}:pL`,tMinK:n.min,tMaxK:n.max,pMinPa:r.min,pMaxPa:c,extraInequalities:s}),$o({...e,polytopeId:`${e.polytopeId}:pR`,tMinK:n.min,tMaxK:n.max,pMinPa:c,pMaxPa:r.max,extraInequalities:s})]}function ts(e,{temperatureK:t,pressurePa:n=101325,boundaryBandFraction:r=.05}={}){let i=Number(t),a=Number(n);if(!e||!Number.isFinite(i)||!Number.isFinite(a)||!(a>0))return Object.freeze({inside:!1,status:`outside-domain`,minMarginNormalized:-1/0,violatedInequalities:Object.freeze([`invalid-state-coordinates`]),extrapolate:!1});let o=e.axes[0],s=e.axes[1],c=Math.max(1e-6,o.max-o.min),l=Math.max(1e-6,Math.log10(s.max)-Math.log10(s.min)),u=[i,Math.log10(a)],d=[c,c,l,l],f=[],p=1/0;for(let t=0;t<e.inequalities.length;t+=1){let n=e.inequalities[t],r=Math.max(1e-6,Number(n.scale??d[t]??1)),i=n.b-(n.a[0]*u[0]+n.a[1]*u[1]),a=i/r;a<p&&(p=a),i<0&&f.push(n.label)}return f.length>0?Object.freeze({inside:!1,status:`outside-domain`,minMarginNormalized:p,violatedInequalities:Object.freeze(f),extrapolate:!1}):Object.freeze({inside:!0,status:p<=r?`boundary`:`accepted`,minMarginNormalized:p,violatedInequalities:Object.freeze([]),extrapolate:!1})}function ns(){let e=new Map,t=new Map,n=new Map;function r(r,i,{massNumberA:a=null}={}){let o=Zo(r,a),s=Object.freeze([...i]),c=e.get(o)||[];for(let e of c)t.delete(e.polytopeId),n.delete(e.polytopeId);e.set(o,s);for(let e of s)t.set(e.polytopeId,e),e.fit&&n.set(e.polytopeId,Object.freeze({...e.fit,polytopeId:e.polytopeId,invalidationKey:e.invalidationKey,closureHash:e.closureHash}));return s}function i({materialKey:e,massNumberA:t=null,family:n=`element`,meltingPointK:i=null,boilingPointK:a=null,ionizationTempK:o=null,meltingSlopeKPerLogP:s=0,boilingSlopeKPerLogP:c=0,maxTemperatureK:l=6e3,minPressurePa:u=1,maxPressurePa:d=1e9,accuracyTier:f=b.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:p=`derived-v1`,crystalStructure:m=null,provenance:h={}}={}){let g=String(e||``).trim();if(!g)throw TypeError(`discoverMaterialPolytopes requires a non-empty materialKey`);let _=t!=null&&Number.isFinite(Number(t))?`${g}-${Math.max(1,Math.trunc(Number(t)))}`:g,v=m?Xo:n===`compound`?Yo:Jo,y=Number(i),x=Number(a),S=Number(o),C=Math.max(Number(l)||6e3,(x||y||300)+500),w=Math.log10(101325),T=Number(s)||0,E=Number(c)||0,D=Math.log10(Math.max(1e-6,Number(u))),O=Math.log10(Math.max(Number(u)*1.01,Number(d))),k=[];if(Number.isFinite(y)&&y>1){let e=T===0?[]:[{axis:`clausius-clapeyron-melting`,a:[1,-T],b:y-T*w,label:`T <= T_m(P)`}],t=Math.max(y,y+T*(O-w),y+T*(D-w));k.push($o({schema:v,polytopeId:`${_.toLowerCase()}:solid:${Qo(p)}`,materialKey:_,polytopeFamily:n,phase:`solid`,tMinK:1,tMaxK:t,pMinPa:u,pMaxPa:d,extraInequalities:e,accuracyTier:f,closureHash:p,provenance:h,crystalStructure:m}))}if(Number.isFinite(y)&&Number.isFinite(x)&&x>y+1){let e=[];T!==0&&e.push({axis:`clausius-clapeyron-melting`,a:[-1,T],b:-(y-T*w),label:`T >= T_m(P)`}),E!==0&&e.push({axis:`clausius-clapeyron-boiling`,a:[1,-E],b:x-E*w,label:`T <= T_b(P)`});let t=Math.max(1,Math.min(y,y+T*(D-w),y+T*(O-w))),r=Math.max(x,x+E*(O-w),x+E*(D-w));k.push($o({schema:v,polytopeId:`${_.toLowerCase()}:liquid:${Qo(p)}`,materialKey:_,polytopeFamily:n,phase:`liquid`,tMinK:t,tMaxK:r,pMinPa:u,pMaxPa:d,extraInequalities:e,accuracyTier:f,closureHash:p,provenance:h}))}let A=Number.isFinite(x)&&x>1?x:Number.isFinite(y)&&y>1?y:1,j=E!==0&&Number.isFinite(x)&&x>1?[{axis:`clausius-clapeyron-boiling`,a:[-1,E],b:-(x-E*w),label:`T >= T_b(P)`}]:[],M=Number.isFinite(S)&&S>A+50?S:C,N=Math.max(1,Math.min(A,A+E*(D-w),A+E*(O-w)));return k.push($o({schema:v,polytopeId:`${_.toLowerCase()}:gas:${Qo(p)}`,materialKey:_,polytopeFamily:n,phase:`gas`,tMinK:N,tMaxK:M,pMinPa:u,pMaxPa:d,extraInequalities:j,accuracyTier:f,closureHash:p,provenance:h})),Number.isFinite(S)&&S>A+50&&k.push($o({schema:v,polytopeId:`${_.toLowerCase()}:plasma:${Qo(p)}`,materialKey:_,polytopeFamily:n,phase:`plasma`,tMinK:S,tMaxK:Math.max(C,S*10),pMinPa:u,pMaxPa:d,accuracyTier:f,closureHash:p,provenance:h})),r(_,k)}function a(t,{temperatureK:r,pressurePa:i=101325,closureHash:a=null,massNumberA:o=null}={}){let s=e.get(Zo(t,o))||[],c=null;for(let e of s){if(a&&e.closureHash!==a)continue;let t=ts(e,{temperatureK:r,pressurePa:i});t.inside&&(!c||t.minMarginNormalized>c.membership.minMarginNormalized)&&(c={polytope:e,membership:t})}if(!c)return Object.freeze({found:!1,status:`outside-domain`,polytope:null,membership:null,fit:null});let l=n.get(c.polytope.polytopeId)??null,u=!!(l&&l.invalidationKey===c.polytope.invalidationKey);return Object.freeze({found:!0,status:c.membership.status,polytope:c.polytope,membership:c.membership,fit:u?l:null})}function o(e,r){let i=t.get(e);if(!i)throw RangeError(`Unknown polytopeId: ${e}`);let a=Object.freeze({...r,polytopeId:e,invalidationKey:i.invalidationKey,closureHash:i.closureHash});return n.set(e,a),a}function s(t,{materialIndex:r=0,massNumberA:i=null}={}){return y((e.get(Zo(t,i))||[]).map(e=>({...e,fit:n.get(e.polytopeId)??e.fit??null})),{materialIndex:r})}function c(){let r={};for(let[t,i]of e.entries())r[t]=i.map(e=>({...e,fit:n.get(e.polytopeId)??e.fit??null}));return Object.freeze({schema:x,schemaVersion:1,materialCount:e.size,polytopeCount:t.size,fittedCount:n.size,materials:r})}function l(){return Object.freeze({schema:qo,materialCount:e.size,polytopeCount:t.size,fittedCount:n.size})}return Object.freeze({schema:qo,discoverMaterialPolytopes:i,registerMaterialPolytopes:r,resolveState:a,registerResponseFit:o,packMaterialAtlasGpu:s,exportPolytopeAtlas:c,getPolytopes:(t,{massNumberA:n=null}={})=>e.get(Zo(t,n))||Object.freeze([]),snapshot:l})}var rs=`peercompute.ulg.a4-response-function-fit-gpu.v1`,is=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),as=`
struct FitParams {
  // dim (1 or 2), n0 (nodes axis 0), n1 (nodes axis 1, 1 for 1D), heldout_count
  dims: vec4<u32>,
  // deg0, deg1, coeff_count, flags
  degrees: vec4<u32>,
  // lo0, hi0, lo1, hi1
  box_bounds: vec4<f32>,
  // rel_tol, abs_floor, safety_factor, unused
  tol: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FitParams;
// Chebyshev-node samples: length = n0 * n1 (row-major i0 * n1 + i1)
@group(0) @binding(1) var<storage, read> node_samples: array<f32>;
// Held-out probe rows: vec4<f32>(x0, x1, expected_y, 0.0)
@group(0) @binding(2) var<storage, read> heldout_samples: array<vec4<f32>>;
// Output Chebyshev coefficients: length = (deg0 + 1) * (deg1 + 1)
@group(0) @binding(3) var<storage, read_write> coeffs: array<f32>;
// Receipt: [0]=valid(1/0), [1]=nonfinite_count, [2]=max_rel_err_nano (1e9 scaled), [3]=max_abs_err_micro (1e6 scaled)
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;

const PI: f32 = 3.14159265358979323846;

fn finite_f32(v: f32) -> bool {
  return v == v && abs(v) <= 3.402823e38;
}

@compute @workgroup_size(64)
fn reset_fit_receipt(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 4u) {
    atomicStore(&receipt[id.x], select(0u, 1u, id.x == 0u));
  }
}

// Gauss-Chebyshev first-kind discrete cosine projection (exact for polynomials <= degree):
//   c_{k0,k1} = scale0 * scale1 * sum_{j0=0..n0-1} sum_{j1=0..n1-1} f(x_{j0}, x_{j1})
//               * cos(k0 * (j0 + 0.5) * pi / n0) * cos(k1 * (j1 + 0.5) * pi / n1)
@compute @workgroup_size(64)
fn project_chebyshev_coeffs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let c0 = params.degrees.x + 1u;
  let c1 = params.degrees.y + 1u;
  let total_coeffs = c0 * c1;
  if (idx >= total_coeffs) { return; }
  let k0 = idx / c1;
  let k1 = idx % c1;
  let n0 = params.dims.y;
  let n1 = max(1u, params.dims.z);
  let inv_n0 = 1.0 / f32(n0);
  let inv_n1 = 1.0 / f32(n1);
  let scale0 = select(2.0 * inv_n0, inv_n0, k0 == 0u);
  let scale1 = select(select(2.0 * inv_n1, inv_n1, k1 == 0u), 1.0, params.dims.x == 1u);

  var sum = 0.0;
  for (var j0 = 0u; j0 < n0; j0 = j0 + 1u) {
    let t0 = cos(f32(k0) * (f32(j0) + 0.5) * PI * inv_n0);
    for (var j1 = 0u; j1 < n1; j1 = j1 + 1u) {
      let val = node_samples[j0 * n1 + j1];
      if (!finite_f32(val)) {
        atomicAdd(&receipt[1], 1u);
        atomicStore(&receipt[0], 0u);
        coeffs[idx] = 0.0;
        return;
      }
      let t1 = select(cos(f32(k1) * (f32(j1) + 0.5) * PI * inv_n1), 1.0, params.dims.x == 1u);
      sum = sum + val * t0 * t1;
    }
  }
  coeffs[idx] = scale0 * scale1 * sum;
}

fn clenshaw_1d(u: f32, base: u32, count: u32) -> f32 {
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u = 2.0 * u;
  for (var step = 0u; step < count; step = step + 1u) {
    let k = count - 1u - step;
    if (k == 0u) {
      return coeffs[base] + u * b1 - b2;
    }
    let b0 = coeffs[base + k] + two_u * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

fn eval_fitted(x0: f32, x1: f32) -> f32 {
  let u0 = clamp(
    2.0 * (x0 - params.box_bounds.x) / max(params.box_bounds.y - params.box_bounds.x, 1.0e-30) - 1.0,
    -1.0, 1.0
  );
  let c0 = params.degrees.x + 1u;
  let c1 = params.degrees.y + 1u;
  if (params.dims.x == 1u) {
    return clenshaw_1d(u0, 0u, c0);
  }
  let u1 = clamp(
    2.0 * (x1 - params.box_bounds.z) / max(params.box_bounds.w - params.box_bounds.z, 1.0e-30) - 1.0,
    -1.0, 1.0
  );
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u0 = 2.0 * u0;
  for (var step = 0u; step < c0; step = step + 1u) {
    let k0 = c0 - 1u - step;
    let row_val = clenshaw_1d(u1, k0 * c1, c1);
    if (k0 == 0u) {
      return row_val + u0 * b1 - b2;
    }
    let b0 = row_val + two_u0 * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

@compute @workgroup_size(64)
fn verify_heldout(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.dims.w) { return; }
  let sample = heldout_samples[p];
  let expected = sample.z;
  let predicted = eval_fitted(sample.x, sample.y);
  if (!finite_f32(expected) || !finite_f32(predicted)) {
    atomicAdd(&receipt[1], 1u);
    atomicStore(&receipt[0], 0u);
    return;
  }
  let abs_err = abs(predicted - expected);
  let denom = max(params.tol.y, abs(expected));
  let rel_err = abs_err / denom;
  let rel_nano = u32(clamp(rel_err * 1.0e9, 0.0, 4294967000.0));
  let abs_micro = u32(clamp(abs_err * 1.0e6, 0.0, 4294967000.0));
  atomicMax(&receipt[2], rel_nano);
  atomicMax(&receipt[3], abs_micro);
  if (rel_err > params.tol.x) {
    atomicStore(&receipt[0], 0u);
  }
}
`;function os(e,t,n){let r=new Float64Array(n),i=.5*(e+t),a=.5*(t-e);for(let e=0;e<n;e+=1)r[e]=i+a*Math.cos((e+.5)*Math.PI/n);return r}async function ss(e,{box:t,degrees:n,nodeSamples:r,heldOutSamples:i,relativeTolerance:a=1e-4,absoluteFloor:o=1e-12,safetyFactor:s=2,id:c=`a4-gpu-fit`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`fitResponseFunctionWebGpu requires a live WebGPU GPUDevice`);let l=Array.isArray(t)?t.length:0;if(l!==1&&l!==2)throw RangeError(`fitResponseFunctionWebGpu supports 1D and 2D closures (got dim=${l})`);let u=Math.max(0,Math.min(31,Math.trunc(Number(n?.[0])||0))),d=l===2?Math.max(0,Math.min(31,Math.trunc(Number(n?.[1])||0))):0,f=u+1,p=l===2?d+1:1,m=f*p,h=r instanceof Float32Array?r:Float32Array.from(r);if(h.length!==m)throw RangeError(`nodeSamples length ${h.length} must equal ${m}`);let g=Math.max(1,Math.floor((i?.length??0)/4)),_=i instanceof Float32Array?i:Float32Array.from(i?.length?i:[t[0][0],l===2?t[1][0]:0,h[0],0]),v=[A(0,`uniform`),A(1,`read-only-storage`),A(2,`read-only-storage`),A(3,`storage`),A(4,`storage`)],y=j(e,{cacheKey:`ulg-a4-rf-fit-reset.v1`,label:`ulg-a4-rf-fit-reset`,code:as,entryPoint:`reset_fit_receipt`,bindings:v}),b=j(e,{cacheKey:`ulg-a4-rf-fit-project.v1`,label:`ulg-a4-rf-fit-project`,code:as,entryPoint:`project_chebyshev_coeffs`,bindings:v}),x=j(e,{cacheKey:`ulg-a4-rf-fit-verify.v1`,label:`ulg-a4-rf-fit-verify`,code:as,entryPoint:`verify_heldout`,bindings:v}),S=new ArrayBuffer(64),C=new Uint32Array(S),w=new Float32Array(S);C.set([l,f,p,g],0),C.set([u,d,m,0],4),w.set([Number(t[0][0]),Number(t[0][1]),l===2?Number(t[1][0]):0,l===2?Number(t[1][1]):1],8),w.set([Number(a),Number(o),Number(s),0],12);let T=(t,n,r)=>{let i=typeof n==`number`?Math.max(16,n):Math.max(16,n.byteLength),a=e.createBuffer({label:t,size:i,usage:r|is.COPY_DST});return typeof n!=`number`&&e.queue.writeBuffer(a,0,n),a},E=T(`ulg-a4-fit-params`,S,is.UNIFORM),D=T(`ulg-a4-fit-samples`,h,is.STORAGE),O=T(`ulg-a4-fit-heldout`,_,is.STORAGE),k=T(`ulg-a4-fit-coeffs`,m*4,is.STORAGE|is.COPY_SRC),M=T(`ulg-a4-fit-receipt`,16,is.STORAGE|is.COPY_SRC),N=e.createBuffer({label:`ulg-a4-fit-read-coeffs`,size:Math.max(16,m*4),usage:is.MAP_READ|is.COPY_DST}),P=e.createBuffer({label:`ulg-a4-fit-read-receipt`,size:16,usage:is.MAP_READ|is.COPY_DST});try{let n=e.createBindGroup({layout:b.bindGroupLayout,entries:[E,D,O,k,M].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-a4-rf-fit`}),i=r.beginComputePass({label:`ulg-a4-rf-fit-pass`});i.setBindGroup(0,n),i.setPipeline(y.pipeline),i.dispatchWorkgroups(1),i.setPipeline(b.pipeline),i.dispatchWorkgroups(Math.ceil(m/64)),i.setPipeline(x.pipeline),i.dispatchWorkgroups(Math.ceil(g/64)),i.end(),r.copyBufferToBuffer(k,0,N,0,m*4),r.copyBufferToBuffer(M,0,P,0,16),e.queue.submit([r.finish()]),await Promise.all([N.mapAsync(is.MAP_READ),P.mapAsync(is.MAP_READ)]);let a=new Float32Array(N.getMappedRange().slice(0,m*4)),o=new Uint32Array(P.getMappedRange().slice(0,16));N.unmap(),P.unmap();let f=o[2]/1e9,p=o[3]/1e6,h=o[1],_=o[0]===1&&h===0,v=20+m,S=new Float32Array(v);return S[0]=1,S[4]=l,S[5]=u,S[6]=d,S[7]=0,S[8]=Number(t[0][0]),S[9]=Number(t[0][1]),S[10]=l===2?Number(t[1][0]):0,S[11]=l===2?Number(t[1][1]):0,S[12]=0,S[13]=0,S[14]=20,S[15]=m,S[16]=p*s,S[17]=f,S[18]=+!!_,S[19]=0,S.set(a,20),Object.freeze({schema:rs,id:c,backend:`webgpu`,dim:l,degrees:Object.freeze(l===1?[u]:[u,d]),box:Object.freeze(t.map(([e,t])=>Object.freeze([Number(e),Number(t)]))),coefficients:a,valid:_,nonFiniteCount:h,maxRelativeError:f,maxAbsoluteError:p,uncertaintyBound:p*s,packedGpuTable:Object.freeze({schema:ao,functionCount:1,data:S})})}finally{for(let e of[E,D,O,k,M,N,P])e.destroy()}}var cs=`ulg.gpumath.polytope-chebyshev-fit.v1`;function ls(e,t,n,r,i,a,o=`linear`){let s=t+1,c=n+1,l=Math.max(-1,Math.min(1,2*(i-r[0][0])/Math.max(r[0][1]-r[0][0],1e-30)-1)),u=Math.max(-1,Math.min(1,2*(a-r[1][0])/Math.max(r[1][1]-r[1][0],1e-30)-1)),d=(t,n,r)=>{let i=0,a=0;for(let o=r-1;o>=1;--o){let r=e[n+o]+2*t*i-a;a=i,i=r}return e[n]+t*i-a},f=0,p=0;for(let e=s-1;e>=1;--e){let t=d(u,e*c,c)+2*l*f-p;p=f,f=t}let m=d(u,0,c)+l*f-p;return o===`exp`?Math.exp(Math.max(-80,Math.min(80,m))):m}async function us(e,t,n,{degrees:r=[5,4],relativeTolerance:i=.01,requirePositive:a=!0,maxDepth:o=2,propertyName:s=`densityKgPerM3`,logScale:c=!1}={}){let l=async(t,u)=>{let d=t.axes[0].min,f=t.axes[0].max,p=Math.log10(Math.max(1e-12,t.axes[1].min)),m=Math.log10(Math.max(1e-12,t.axes[1].max)),h=r[0]+1,g=r[1]+1,_=os(d,f,h),v=os(p,m,g),y=new Float32Array(h*g),b=1/0;for(let e=0;e<h;e+=1)for(let t=0;t<g;t+=1){let r=Number(n(_[e],10**v[t]));r<b&&(b=r),y[e*g+t]=c?Math.log(Math.max(1e-30,r)):r}let x=[];for(let e=1;e<=5;e+=1)x.push(d+e/6*(f-d));let S=f/Math.max(.001,d);if(S>2.5)for(let e=1;e<=5;e+=1)x.push(d*S**(e/6));300>d&&300<f&&x.push(300);let C=[],w=[];for(let e of x)for(let r=1;r<=5;r+=1){let i=p+r/6*(m-p),a=10**i;if(ts(t,{temperatureK:e,pressurePa:a}).inside){let t=Number(n(e,a));w.push([e,i,t]),C.push(e,i,c?Math.log(Math.max(1e-30,t)):t,0)}}if(C.length===0){let e=.5*(d+f),t=.5*(p+m),r=Number(n(e,10**t));w.push([e,t,r]),C.push(e,t,c?Math.log(Math.max(1e-30,r)):r,0)}let T=await ss(e,{id:`${t.polytopeId}:${s}`,box:[[d,f],[p,m]],degrees:r,nodeSamples:y,heldOutSamples:Float32Array.from(C),relativeTolerance:c?Math.max(i,.5):i}),E=T.maxRelativeError,D=.5*(d+f);if(c&&T.coefficients){let e=0,t=[[d,f],[p,m]];for(let[n,i,a]of w){let o=ls(T.coefficients,r[0],r[1],t,n,i,`exp`),s=Math.abs(o-a)/Math.max(1e-30,Math.abs(a));s>e&&(e=s,D=n)}E=e}let O=c?Number.isFinite(E)&&E<=i:T.valid,k=!a||b>0;if((!O||!k)&&u<o){let e=0,n=0;for(let t=1;t<h-1;t+=1)for(let n=0;n<g;n+=1){let r=Math.abs(y[(t+1)*g+n]-2*y[t*g+n]+y[(t-1)*g+n]);r>e&&(e=r)}for(let e=0;e<h;e+=1)for(let t=1;t<g-1;t+=1){let r=Math.abs(y[e*g+(t+1)]-2*y[e*g+t]+y[e*g+(t-1)]);r>n&&(n=r)}let[r,i]=es(t,c&&S>6&&e>=.25*n&&D<d+.35*(f-d)?0:n>e*1.05?1:e>n*1.05?0:u%2),[a,o]=await Promise.all([l(r,u+1),l(i,u+1)]);return[...a,...o]}return[Object.freeze({...t,fit:Object.freeze({...T,maxRelativeError:E,uncertaintyBound:c?Math.max(E*1.15,1e-4):T.uncertaintyBound,valueTransform:c?`exp`:`linear`,propertyName:s,valid:O&&k,positivityOk:k})})]},u=await l(t,0),d=y(u);return Object.freeze({schema:cs,propertyName:s,polytopes:Object.freeze(u),packedGpuAtlas:d})}var ds=`ulg.polytope-atlas-persistent-cache.v1`,fs=`ulg-polytope-atlas-cache-v1`,ps=`ulg-polytope-atlas-cache-v1`,ms=`atlases`;function hs(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+(r&255),2246822507)>>>0}return`${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}function gs(e){return String(e||`mat`).replace(/[^a-zA-Z0-9_-]/g,`_`).slice(0,40)||`mat`}function _s(e={}){let t=String(e.materialKey||``).trim();if(!t)throw TypeError(`Polytope atlas cache descriptor requires materialKey`);let n=String(e.family||`element`),r=String(e.closureHash||``),i=String(e.generatorFingerprint||`ulg-foundation-v1`),a=String(e.builderSchema||`ulg.polytope-atlas-builder.v1`),o=Math.max(.001,Number(e.pressureRangePa?.[0]??100)),s=Math.max(o*10,Number(e.pressureRangePa?.[1]??1e10)),c=Math.max(1,Math.trunc(Number(e.degrees?.[0]??5))),l=Math.max(1,Math.trunc(Number(e.degrees?.[1]??5))),u=Number(e.relativeTolerance??.02),d=Math.max(0,Math.trunc(Number(e.maxBisectDepth??3))),f=Math.max(0,Math.trunc(Number(e.materialIndex??0))),p={schema:ds,builderSchema:a,materialKey:t,family:n,closureHash:r,generatorFingerprint:i,pressureRangePa:[o,s],degrees:[c,l],relativeTolerance:u,maxBisectDepth:d,materialIndex:f},m=hs(JSON.stringify(p)),h=`${gs(t)}-${m}`;return Object.freeze({...p,pressureRangePa:Object.freeze(p.pressureRangePa),degrees:Object.freeze(p.degrees),cacheKey:h})}function vs(e){let t=e?.fit?.coefficients,n=t instanceof Float32Array?Array.from(t):Array.isArray(t)?t.map(Number):[];return{polytopeId:String(e.polytopeId||``),materialKey:String(e.materialKey||``),family:String(e.family||`element`),phase:String(e.phase||`solid`),accuracyTier:e.accuracyTier,closureHash:String(e.closureHash||``),invalidationKey:String(e.invalidationKey||e.closureHash||``),axes:Array.isArray(e.axes)?e.axes.map(e=>({...e})):[],inequalities:Array.isArray(e.inequalities)?e.inequalities.map(e=>({...e,a:Array.isArray(e.a)?e.a.map(Number):[]})):[],crystalStructure:e.crystalStructure?{...e.crystalStructure}:null,provenance:e.provenance?{...e.provenance}:null,fit:e.fit?{...e.fit,degrees:Array.isArray(e.fit.degrees)?e.fit.degrees.map(Number):[0,0],coefficients:n}:null}}function ys(e,t){let n=e.cacheKey?e:_s(e);if(!t||!Array.isArray(t.polytopes)||t.polytopes.length===0)throw TypeError(`Cannot cache empty or malformed polytope atlas`);let r=t.packedGpuAtlas?.data;if(!(r instanceof Float32Array)||r.length<16)throw TypeError(`Cannot cache polytope atlas without packed Float32Array GPU data`);return{schema:ds,atlasSchema:t.schema||`ulg.polytope-atlas.v1`,builderSchema:n.builderSchema,cacheKey:n.cacheKey,storedAtMs:Date.now(),materialKey:n.materialKey,family:n.family,accuracyTier:t.accuracyTier,closureHash:n.closureHash,generatorFingerprint:n.generatorFingerprint,pressureRangePa:[n.pressureRangePa[0],n.pressureRangePa[1]],degrees:[n.degrees[0],n.degrees[1]],relativeTolerance:n.relativeTolerance,maxBisectDepth:n.maxBisectDepth,materialIndex:n.materialIndex,polytopeCount:t.polytopes.length,polytopes:t.polytopes.map(vs),packedGpuAtlas:{schema:t.packedGpuAtlas.schema||`ulg.polytope-atlas-gpu-buffer.v1`,polytopeCount:t.packedGpuAtlas.polytopeCount,totalFacets:t.packedGpuAtlas.totalFacets,totalCoeffs:t.packedGpuAtlas.totalCoeffs,data:Array.from(r)}}}function bs(e,t,n=`memory`){let r=t.cacheKey?t:_s(t);if(!e||typeof e!=`object`)return{ok:!1,reason:`envelope-not-object`};if(e.schema!==`ulg.polytope-atlas-persistent-cache.v1`)return{ok:!1,reason:`schema-mismatch:${e.schema}`};if(e.cacheKey!==r.cacheKey)return{ok:!1,reason:`cache-key-mismatch`};if(e.materialKey!==r.materialKey)return{ok:!1,reason:`material-key-mismatch`};if(e.closureHash!==r.closureHash)return{ok:!1,reason:`closure-hash-stale`};if(e.generatorFingerprint!==r.generatorFingerprint)return{ok:!1,reason:`generator-fingerprint-stale`};if(!Array.isArray(e.pressureRangePa)||e.pressureRangePa.length!==2||Math.abs(Number(e.pressureRangePa[0])-r.pressureRangePa[0])>1e-6*Math.max(1,r.pressureRangePa[0])||Math.abs(Number(e.pressureRangePa[1])-r.pressureRangePa[1])>1e-6*Math.max(1,r.pressureRangePa[1]))return{ok:!1,reason:`pressure-range-mismatch`};if(!Array.isArray(e.polytopes)||e.polytopes.length===0)return{ok:!1,reason:`empty-polytopes`};if(e.polytopeCount!==e.polytopes.length)return{ok:!1,reason:`polytope-count-mismatch`};let i=[];for(let t=0;t<e.polytopes.length;t+=1){let n=e.polytopes[t];if(!n||typeof n!=`object`||!n.fit||n.fit.valid!==!0)return{ok:!1,reason:`invalid-polytope-fit:${t}`};let r=n.fit.degrees;if(!Array.isArray(r)||r.length<2||!(r[0]>=0)||!(r[1]>=0))return{ok:!1,reason:`invalid-degrees:${t}`};let a=(Math.trunc(r[0])+1)*(Math.trunc(r[1])+1);if(!Array.isArray(n.fit.coefficients)||n.fit.coefficients.length!==a)return{ok:!1,reason:`coeff-length-mismatch:${t}`};let o=new Float32Array(a);for(let e=0;e<a;e+=1){let r=Number(n.fit.coefficients[e]);if(!Number.isFinite(r))return{ok:!1,reason:`non-finite-coeff:${t}:${e}`};o[e]=r}if(!Array.isArray(n.axes)||n.axes.length<2||!Array.isArray(n.inequalities))return{ok:!1,reason:`invalid-geometry:${t}`};for(let e of n.inequalities){if(!e||!Array.isArray(e.a)||e.a.length<2||!Number.isFinite(Number(e.b)))return{ok:!1,reason:`invalid-inequality:${t}`};if(!Number.isFinite(Number(e.a[0]))||!Number.isFinite(Number(e.a[1])))return{ok:!1,reason:`non-finite-inequality:${t}`}}i.push(Object.freeze({...n,axes:Object.freeze(n.axes.map(e=>Object.freeze({...e}))),inequalities:Object.freeze(n.inequalities.map(e=>Object.freeze({...e,a:Object.freeze([...e.a])}))),fit:Object.freeze({...n.fit,degrees:Object.freeze([Math.trunc(r[0]),Math.trunc(r[1])]),coefficients:o,valid:!0})}))}let a=e.packedGpuAtlas;if(!a||!Array.isArray(a.data)||a.data.length<16)return{ok:!1,reason:`missing-packed-gpu-data`};let o=new Float32Array(a.data.length);for(let e=0;e<a.data.length;e+=1){let t=Number(a.data[e]);if(!Number.isFinite(t))return{ok:!1,reason:`non-finite-packed-float:${e}`};o[e]=t}if(Math.round(o[0])!==i.length)return{ok:!1,reason:`packed-header-count-mismatch`};let s=y(i,{materialIndex:r.materialIndex});if(s.data.length!==o.length)return{ok:!1,reason:`packed-layout-length-mismatch`};let c=ns();return c.registerMaterialPolytopes(r.materialKey,i),{ok:!0,atlas:Object.freeze({schema:e.atlasSchema||`ulg.polytope-atlas.v1`,builderSchema:r.builderSchema,materialKey:r.materialKey,family:r.family,accuracyTier:e.accuracyTier,closureHash:r.closureHash,pressureRangePa:r.pressureRangePa,polytopeCount:i.length,polytopes:Object.freeze(i),packedGpuAtlas:Object.freeze({schema:a.schema||`ulg.polytope-atlas-gpu-buffer.v1`,polytopeCount:i.length,totalFacets:Number(a.totalFacets??s.totalFacets),totalCoeffs:Number(a.totalCoeffs??s.totalCoeffs),data:o}),registry:c,cacheStatus:`hit`,cacheBackend:n,cacheKey:r.cacheKey})}}function xs(e){let t=null,n=async()=>(t||=(async()=>(await e()).getDirectoryHandle(fs,{create:!0}))(),t),r=e=>`${e}.json`;return{name:`opfs`,async readRaw(e){let t=await n();try{return await(await(await t.getFileHandle(r(e),{create:!1})).getFile()).text()}catch(e){if(e?.name===`NotFoundError`)return null;throw e}},async writeRaw(e,t){let i=await(await n()).getFileHandle(r(e),{create:!0});if(typeof i.createWritable!=`function`)throw Error(`OPFS FileSystemFileHandle.createWritable unavailable`);let a=await i.createWritable();await a.write(t),await a.close()},async deleteKey(e){let t=await n();try{await t.removeEntry(r(e))}catch(e){if(e?.name!==`NotFoundError`)throw e}},async listKeys(){let e=await n(),t=[];if(typeof e.keys==`function`)for await(let n of e.keys())String(n).endsWith(`.json`)&&t.push(String(n).slice(0,-5));else if(typeof e.entries==`function`)for await(let[n]of e.entries())String(n).endsWith(`.json`)&&t.push(String(n).slice(0,-5));return t},async clear(){let e=await this.listKeys();for(let t of e)await this.deleteKey(t)}}}function Ss(e,t=ps){let n=null,r=()=>(n||=new Promise((n,r)=>{let i=e.open(t,1);i.onupgradeneeded=()=>{let e=i.result;e.objectStoreNames.contains(`atlases`)||e.createObjectStore(ms)},i.onsuccess=()=>n(i.result),i.onerror=()=>r(i.error||Error(`IndexedDB open failed`))}),n),i=async(e,t)=>{let n=await r();return new Promise((r,i)=>{let a=t(n.transaction(ms,e).objectStore(ms));a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error||Error(`IndexedDB request failed`))})};return{name:`indexeddb`,async readRaw(e){let t=await i(`readonly`,t=>t.get(e));return t==null?null:String(t)},async writeRaw(e,t){await i(`readwrite`,n=>n.put(t,e))},async deleteKey(e){await i(`readwrite`,t=>t.delete(e))},async listKeys(){let e=await i(`readonly`,e=>e.getAllKeys());return Array.isArray(e)?e.map(String):[]},async clear(){await i(`readwrite`,e=>e.clear())}}}function Cs(){let e=new Map;return{name:`memory`,async readRaw(t){return e.has(t)?e.get(t):null},async writeRaw(t,n){e.set(t,String(n))},async deleteKey(t){e.delete(t)},async listKeys(){return[...e.keys()]},async clear(){e.clear()}}}function ws({backend:e=`auto`,opfsGetDirectory:t=null,indexedDBFactory:n=null,dbName:r=ps,maxEntries:i=192}={}){let a={backend:`uninitialized`,hits:0,misses:0,writes:0,evictions:0,staleRejections:0,errors:0,bytesWritten:0,lastRejectionReason:null},o=null,s=async()=>o||(o=(async()=>{let i=e===`auto`||e===`opfs`,o=e===`auto`||e===`indexeddb`,s=t||(typeof globalThis.navigator?.storage?.getDirectory==`function`?()=>globalThis.navigator.storage.getDirectory():null);if(i&&s)try{let e=xs(s),t=`__ulg_opfs_probe__`;return await e.writeRaw(t,`{"ok":true}`),await e.deleteKey(t),a.backend=`opfs`,e}catch{if(e===`opfs`)return a.backend=`memory`,Cs()}let c=n||(globalThis.indexedDB===void 0?null:globalThis.indexedDB);if(o&&c&&typeof c.open==`function`)try{let e=Ss(c,r);return await e.listKeys(),a.backend=`indexeddb`,e}catch{}return a.backend=`memory`,Cs()})(),o);return Object.freeze({schema:ds,async getBackend(){return(await s()).name},async get(e){let t=e?.cacheKey?e:_s(e),n=await s(),r=null;try{r=await n.readRaw(t.cacheKey)}catch{return a.errors+=1,a.misses+=1,null}if(r==null)return a.misses+=1,null;let i=null;try{i=JSON.parse(r)}catch{a.evictions+=1,a.staleRejections+=1,a.lastRejectionReason=`corrupt-json`;try{await n.deleteKey(t.cacheKey)}catch{}return a.misses+=1,null}let o=bs(i,t,n.name);if(!o.ok){a.evictions+=1,a.staleRejections+=1,a.lastRejectionReason=o.reason;try{await n.deleteKey(t.cacheKey)}catch{}return a.misses+=1,null}return a.hits+=1,o.atlas},async set(e,t){let n=e?.cacheKey?e:_s(e),r=await s(),o=ys(n,t),c=JSON.stringify(o);try{let e=await r.listKeys();if(e.length>=i&&!e.includes(n.cacheKey)){let t=e.length-i+1;for(let n=0;n<t;n+=1)await r.deleteKey(e[n]),a.evictions+=1}return await r.writeRaw(n.cacheKey,c),a.writes+=1,a.bytesWritten+=c.length,Object.freeze({ok:!0,cacheKey:n.cacheKey,backend:r.name,bytes:c.length})}catch(e){return a.errors+=1,Object.freeze({ok:!1,cacheKey:n.cacheKey,backend:r.name,error:String(e?.message||e)})}},async writeRawForTest(e,t){await(await s()).writeRaw(String(e),String(t))},async delete(e){await(await s()).deleteKey(String(e))},async listKeys(){return(await s()).listKeys()},async clear(){await(await s()).clear()},getStats(){return Object.freeze({...a})}})}var Ts=Symbol.for(`ulg.polytopeAtlasPersistentCache.v1`);function Es(){return globalThis[Ts]||(globalThis[Ts]=ws({backend:`auto`})),globalThis[Ts]}var Ds=`peercompute.ulg.closure-regime-key.v0`,Os=Object.freeze({VALIDATED:`validated`,WARN:`warn-unvalidated`,REJECTED:`rejected`}),ks=(e,t)=>{let n=Number(e);if(!Number.isFinite(n))throw RangeError(`${t} must be finite, got ${e}`);return n};function As(e){if(!e||typeof e!=`object`)throw RangeError(`regime composition is required (materialKey -> fraction)`);let t=Object.entries(e).map(([e,t])=>[String(e).trim().toLowerCase(),ks(t,`composition[${e}]`)]).filter(([,e])=>e>0).sort(([e],[t])=>e<t?-1:+(e>t));if(t.length===0)throw RangeError(`regime composition must name at least one material`);let n=t.reduce((e,[,t])=>e+t,0);return t.map(([e,t])=>[e,t/n])}function js([e,t],n){let r=ks(e,`${n}[0]`),i=ks(t,`${n}[1]`);if(!(r<=i))throw RangeError(`${n} must be an ordered range`);return[r,i]}function Ms({lawId:e,composition:t,temperatureRangeK:n,pressureRangePa:r=null,densityRangeKgM3:i=null,ensemble:a=`classical-equilibrium`,chartClass:o=`uniform-cartesian`,latticePerDecade:s=8}={}){let c=String(e??``).trim();if(!c)throw RangeError(`lawId is required for a regime key`);let l=As(t),u=js(n,`temperatureRangeK`),d=r==null?null:js(r,`pressureRangePa`),f=i==null?null:js(i,`densityRangeKgM3`),p=Math.max(1,Math.round(Number(s)||8)),m=e=>e===0?`z`:`${e<0?`n`:`p`}${Math.round(Math.log10(Math.abs(e))*p)}`,h=e=>e==null?`none`:`${m(e[0])}..${m(e[1])}`,g=[`regime`,c,l.map(([e,t])=>`${e}:${t.toFixed(4)}`).join(`,`),`T:${h(u)}`,`P:${h(d)}`,`rho:${h(f)}`,`ens:${String(a).trim().toLowerCase()}`,`chart:${String(o).trim().toLowerCase()}`].join(`|`);return Object.freeze({schema:Ds,id:g,lawId:c,composition:Object.freeze(l.map(e=>Object.freeze([...e]))),temperatureRangeK:Object.freeze(u),pressureRangePa:d?Object.freeze(d):null,densityRangeKgM3:f?Object.freeze(f):null,ensemble:String(a).trim().toLowerCase(),chartClass:String(o).trim().toLowerCase(),latticePerDecade:p})}function Ns(e,t){return t==null||e>=t[0]&&e<=t[1]}function Ps(e){let t=2166136261,n=16777619;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t^=i,t=Math.imul(t,16777619)>>>0,n^=i+r&255,n=Math.imul(n,668265261)>>>0}return`${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}function Fs(e){if(!e||typeof e!=`object`)throw RangeError(`canonicalClosureDomainHash requires an envelope object`);let t=e=>e==null?`none`:`${Number(e[0]).toPrecision(12)}..${Number(e[1]).toPrecision(12)}`,n=e.homogeneityTest,r=n==null?`none`:typeof n==`function`?`fn:${n.name||`anon`}:${Ps(String(n))}`:Object.keys(n).filter(e=>e!==`predicate`&&e!==`fn`).sort().map(e=>`${e}=${Array.isArray(n[e])?n[e].join(`,`):String(n[e])}`).join(`;`);return`dom:${Ps([`T:${t(e.temperatureRangeK)}`,`P:${t(e.pressureRangePa)}`,`rho:${t(e.densityRangeKgM3)}`,`phase:${e.phase??`any`}`,`structure:${e.structure??`any`}`,`homog:${r}`].join(`|`))}`}function Is(e,t,n){if(e==null)return{admitted:!0,reason:null};if(typeof e==`function`)try{let r=e(t,n);return r===!0||r&&typeof r==`object`&&r.admitted===!0?{admitted:!0,reason:null}:{admitted:!1,reason:r&&typeof r==`object`&&r.reason||`homogeneity-predicate-rejected`,detail:r&&typeof r==`object`?r:null}}catch(e){return{admitted:!1,reason:`homogeneity-predicate-error`,detail:e instanceof Error?e.message:String(e)}}if(e.kind===`predicate-fn`&&typeof e.fn==`function`)return Is(e.fn,t,n);let r=t?.homogeneity??t??{};if(Array.isArray(e.requiredFields))for(let n of e.requiredFields){let e=Number(r?.[n]??t?.[n]);if(!Number.isFinite(e))return{admitted:!1,reason:`homogeneity-missing-${n}`,field:n}}if(e.requiredPhase!=null){let n=String(r?.phase??t?.phase??``).trim().toLowerCase();if(!n)return{admitted:!1,reason:`homogeneity-missing-phase`,field:`phase`};if(n!==e.requiredPhase)return{admitted:!1,reason:`homogeneity-phase-mismatch`,field:`phase`,value:n,expected:e.requiredPhase}}for(let[n,i]of[[`maxTemperatureVarianceK2`,`temperatureVarianceK2`],[`maxTemperatureSpanK`,`temperatureSpanK`],[`maxTemperatureGradientKPerM`,`temperatureGradientKPerM`],[`maxDensityVarianceKg2M6`,`densityVarianceKg2M6`],[`maxRelativeDensitySpan`,`relativeDensitySpan`],[`maxPhaseFractionSpread`,`phaseFractionSpread`],[`maxPlasticStrain`,`plasticStrain`],[`maxStrainRatePerS`,`strainRatePerS`],[`maxJensenResidual`,`jensenResidual`]]){if(e[n]==null)continue;let a=r?.[i]??t?.[i],o=Number(a);if(a==null||!Number.isFinite(o)||o<0)return{admitted:!1,reason:`homogeneity-missing-${i}`,field:i,limit:e[n]};if(o>e[n])return{admitted:!1,reason:`homogeneity-exceeded-${i}`,field:i,value:o,limit:e[n]}}return typeof e.predicate==`function`?Is(e.predicate,t,n):{admitted:!0,reason:null}}function Ls(e,t){if(!e)return{admitted:!1,reason:`missing-envelope`};let n=[[`temperatureK`,e.temperatureRangeK],[`pressurePa`,e.pressureRangePa],[`densityKgM3`,e.densityRangeKgM3]];for(let[e,r]of n){if(r==null)continue;let n=t?.[e],i=Number(n);if(n==null||!Number.isFinite(i))return{admitted:!1,reason:`query-missing-${e}`};if(!Ns(i,r))return{admitted:!1,reason:`envelope-exit-${e}`,field:e,value:i,range:[...r]}}if(e.homogeneityTest!=null){let n=Is(e.homogeneityTest,t,e);if(!n.admitted)return n}return{admitted:!0,reason:null}}function Rs({inputHash:e,methodHash:t,domainHash:n=null,envelope:r=null,schemaVersion:i,abiVersion:a,validationStatus:o}){for(let[n,r]of[[`inputHash`,e],[`methodHash`,t],[`schemaVersion`,i],[`abiVersion`,a]])if(!String(r??``).trim())throw RangeError(`closure invalidation key requires ${n}`);if(!Object.values(Os).includes(o))throw RangeError(`validationStatus must be one of ${Object.values(Os).join(`, `)}`);let s=n!=null&&String(n).trim()?String(n).trim():r?Fs(r):null;return s?`${e}|${t}|${s}|${i}|${a}|${o}`:`${e}|${t}|${i}|${a}|${o}`}var zs=Object.freeze({"sph-particle-state":m,"sph-thermo-phase":r,"mls-mpm-mechanics":c,"mls-mpm-grid-velocity":s});function Bs(t,{resourceLayouts:n=zs,workgroupSize:r=64,includeEnvelopeWatch:i=!0,requireExtendedDescriptor:a=!0}={}){if(!t||t.schema!==`peercompute.ulg.law-ir.v1`)throw TypeError(`compileDeclarativeLawIrToWgsl requires schema "${f}"`);let o=v(t.descriptor,{requireExtendedMetadata:a});if(!o.valid){let e=Error(`Law-IR "${t.id||`unknown`}" failed Law Adapter Contract validation: ${o.errors.join(`, `)}`);throw e.code=`ERR_LAW_IR_DESCRIPTOR_INVALID`,e.errors=o.errors,e}return e(t,{resourceLayouts:{...zs,...n||{}},workgroupSize:r,includeEnvelopeWatch:i})}var Vs=`peercompute.ulg.eshkol-law-object.v1`,Hs=`peercompute.ulg.eshkol-approximated-law.v1`,Us=`peercompute.ulg.eshkol-compiled-wgsl-law.v1`,Ws=Object.freeze({STRICT:`strict`,ASYNC:`async`,FROZEN:`frozen`});Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Object.freeze([Object.freeze({z:-2.8569700138728056,w:.01125741132772069}),Object.freeze({z:-1.355626179974266,w:.22207592200561263}),Object.freeze({z:0,w:.5333333333333333}),Object.freeze({z:1.355626179974266,w:.22207592200561263}),Object.freeze({z:2.8569700138728056,w:.01125741132772069})]);function Gs(e,t){if(!Array.isArray(e)||e.length===0)throw RangeError(`${t} must name at least one physical coordinate`);return Object.freeze(e.map((e,n)=>{let r=String(e?.name??``).trim();if(!r)throw RangeError(`${t}[${n}].name is required`);return Object.freeze({name:r,unit:String(e?.unit??`1`).trim()||`1`,referenceValue:Number.isFinite(Number(e?.referenceValue))?Number(e.referenceValue):null})}))}function Ks(e={}){let t=Array.isArray(e?.reads)?[...e.reads].map(String):[],n=Array.isArray(e?.writes)?[...e.writes].map(String):[],r=Array.isArray(e?.accumulates)?[...e.accumulates].map(String):[],i=e?.memoryState?Object.freeze({name:String(e.memoryState.name||`z`),dimension:Math.max(1,Math.round(Number(e.memoryState.dimension)||1)),unit:String(e.memoryState.unit||`1`),ownedBy:`ss-physical-state`,replaySafe:!0}):null;return Object.freeze({reads:Object.freeze(t),writes:Object.freeze(n),accumulates:Object.freeze(r),memoryState:i})}function qs(e={}){let t={};if(e?.ranges&&typeof e.ranges==`object`)for(let[n,r]of Object.entries(e.ranges)){let e=Number(r?.[0]),i=Number(r?.[1]);if(!Number.isFinite(e)||!Number.isFinite(i)||!(i>e))throw RangeError(`envelope.ranges.${n} must be [lo, hi] with lo < hi`);t[n]=Object.freeze([e,i])}let n=e?.temperatureRangeK?Object.freeze([Number(e.temperatureRangeK[0]),Number(e.temperatureRangeK[1])]):t.temperature??t.temperatureK??Object.freeze([1,1e6]),r=e?.pressureRangePa?Object.freeze([Number(e.pressureRangePa[0]),Number(e.pressureRangePa[1])]):t.pressure??t.pressurePa??null,i=e?.densityRangeKgM3?Object.freeze([Number(e.densityRangeKgM3[0]),Number(e.densityRangeKgM3[1])]):t.density??t.densityKgM3??null;return Object.freeze({temperatureRangeK:n,pressureRangePa:r,densityRangeKgM3:i,ranges:Object.freeze(t),phase:e?.phase??null,structure:e?.structure??null,homogeneityTest:e?.homogeneityTest??null})}function Js({id:e,version:t=`1.0.0`,inputs:n,output:r={name:`response`,unit:`1`},parameters:i={},stateContract:a={},conservationInvariants:o=[],envelope:s={},fallbackPolicy:c=Ws.ASYNC,sourceMethod:l=`analytic-law`,eshkolBody:u=null,evaluate:d}={}){let f=String(e??``).trim();if(!f)throw RangeError(`defineLawObject requires a non-empty id`);if(typeof d!=`function`)throw TypeError(`law ${f} requires an evaluate(inputObj, params) function`);if(!Object.values(Ws).includes(c))throw RangeError(`Unsupported fallbackPolicy: ${c}`);let p=Gs(n,`${f}.inputs`),m=Object.freeze({name:String(r?.name??`response`).trim()||`response`,unit:String(r?.unit??`1`).trim()||`1`}),h=Object.freeze({...i}),g=Ks(a),_=qs(s),v=Fs(_),y=u?String(u):`(define (${f.replace(/[^a-zA-Z0-9_-]/g,`-`)} ${p.map(e=>e.name).join(` `)}) 'compiled-body)`,b=Ja(JSON.stringify({schema:Vs,lawId:f,version:t,inputs:p,output:m,parameters:h,stateContract:g,conservationInvariants:o,domainHash:v,sourceMethod:l,eshkolBody:y}),`eshkol-law`);return Object.freeze({schema:Vs,id:f,version:t,inputs:p,output:m,parameters:h,stateContract:g,conservationInvariants:Object.freeze([...o].map(String)),envelope:_,domainHash:v,fallbackPolicy:c,sourceMethod:String(l),eshkolBody:y,sourceHash:b,dependencies:Object.freeze([b]),evaluate:(e,t=null)=>d(e,t?{...h,...t}:h)})}function Ys(e,{axis:t,order:n=1,step:r=1e-5,exactDerivative:i=null,id:a=null}={}){if(e?.schema!==`peercompute.ulg.eshkol-law-object.v1`)throw TypeError(`differentiateLaw requires a law object from defineLawObject`);let o=e.inputs.find(e=>e.name===t);if(!o)throw RangeError(`law ${e.id} has no input axis named ${t}`);let s=Math.round(Number(n)||1);if(s!==1&&s!==2)throw RangeError(`differentiateLaw supports order 1 or 2`);let c=Math.max(1e-8,Math.min(.01,Number(r)||1e-5)),l=s===1?`${e.output.unit}/${o.unit}`:`${e.output.unit}/(${o.unit})^2`,u=a||`${e.id}:d${s}_${t}`,d=typeof i==`function`?i:(n,r)=>{let i=Number(n[t]),a=Math.max(1e-7,Math.abs(i)*c),o=e.evaluate({...n,[t]:i+a},r),l=e.evaluate({...n,[t]:i-a},r);if(s===1){let s=e.evaluate({...n,[t]:i+2*a},r),c=e.evaluate({...n,[t]:i-2*a},r);return(-s+8*o-8*l+c)/(12*a)}return(o-2*e.evaluate(n,r)+l)/(a*a)},f=s===1?`(derivative (lambda (${t}) (${e.id} ${e.inputs.map(e=>e.name).join(` `)})) ${t})`:`(derivative (lambda (${t}) (derivative (lambda (${t}) (${e.id} ${e.inputs.map(e=>e.name).join(` `)})) ${t})) ${t})`,p=Js({id:u,version:e.version,inputs:e.inputs,output:{name:`d${s}_${e.output.name}_d${t}`,unit:l},parameters:e.parameters,stateContract:e.stateContract,conservationInvariants:e.conservationInvariants,envelope:e.envelope,fallbackPolicy:e.fallbackPolicy,sourceMethod:`differentiate(${e.sourceMethod}, ${t}, order=${s})`,eshkolBody:f,evaluate:d});return Object.freeze({...p,derivativeAxis:t,derivativeOrder:s,dependencies:Object.freeze([...e.dependencies,p.sourceHash])})}function Xs(e,{representation:t=`chebyshev`,box:n=null,degrees:r=null,relativeTolerance:i=1e-4,heldOutPerAxis:a=5,composition:o={generic:1},regimeStore:s=null,memoryStateUpdate:c=null,memoryStateResponse:l=null,memoryStateDim:u=1}={}){if(e?.schema!==`peercompute.ulg.eshkol-law-object.v1`)throw TypeError(`approximateLaw requires a law object from defineLawObject`);if(t===`memory-state`){if(typeof c!=`function`||typeof l!=`function`)throw TypeError(`memory-state approximation requires memoryStateUpdate(z, inputs, dt) and memoryStateResponse(z, inputs)`);let t=Math.max(1,Math.round(Number(u)||1)),n=Object.freeze({schema:`peercompute.ulg.memory-state-law-contract.v1`,ownedBy:`ss-physical-state`,stateDimension:t,replaySafe:!0,hiddenRecurrentStateForbidden:!0});return Object.freeze({schema:Hs,representation:`memory-state`,lawId:e.id,sourceHash:e.sourceHash,domainHash:e.domainHash,dependencies:e.dependencies,envelope:e.envelope,fallbackPolicy:e.fallbackPolicy,memoryContract:n,stepState:(t,n,r)=>{if(!Number.isFinite(r)||r<0)throw RangeError(`memory-state step requires finite dt >= 0`);let i=Ls(e.envelope,n),a=c(t,n,r),o=l(a,n);return Object.freeze({zNext:a,response:o,admitted:i.admitted,admissionReason:i.reason,debtRecorded:!i.admitted})},errorBudget:Object.freeze({sourceMethodUncertainty:`declared-unvalidated`,surrogateRelativeBound:0,gpuF32RoundingBound:12e-8}),scientificValidation:!1,fullPhysicsValidation:!1})}if(t!==`chebyshev`)throw RangeError(`Unsupported approximation representation: ${t}`);if(e.inputs.length<1||e.inputs.length>3)throw RangeError(`Chebyshev approximation supports 1-3 axes (got ${e.inputs.length})`);let d=n||e.inputs.map(t=>{let n=e.envelope.ranges?.[t.name];if(!n)throw RangeError(`Missing approximation box for axis ${t.name}`);return[n[0],n[1]]}),f=Array.isArray(r)?r:e.inputs.map(()=>e.inputs.length===1?12:10),p=ro({box:d,degrees:f,relativeTolerance:i,heldOutPerAxis:a,generator:{id:`eshkol-approx:${e.id}`,axes:e.inputs.map(e=>({name:e.name,unit:e.unit})),outputUnit:e.output.unit,sourceFingerprint:e.sourceHash,regimeOf:()=>e.envelope.phase||`single-phase`,evaluate(t){let n={};for(let r=0;r<e.inputs.length;r+=1)n[e.inputs[r].name]=t[r];return e.evaluate(n)}}}),m=oo([p]),h=Ms({lawId:e.id,composition:o,temperatureRangeK:e.envelope.temperatureRangeK,pressureRangePa:e.envelope.pressureRangePa,densityRangeKgM3:e.envelope.densityRangeKgM3}),g=Object.freeze({inputHash:e.sourceHash,methodHash:`eshkol-chebyshev-v1:${f.join(`x`)}`,domainHash:e.domainHash,schemaVersion:Hs,abiVersion:`gpu-abi-a4-v1`,validationStatus:Os.WARN}),_=Rs(g),v=null;return s&&typeof s.registerClosure==`function`&&(v=s.registerClosure({regimeKey:h,envelope:e.envelope,artifact:{packed:m,responseFunction:p},provenance:{kind:`derived-eshkol-higher-order-law`,lawId:e.id,sourceMethod:e.sourceMethod,sourceHash:e.sourceHash},invalidation:g})),Object.freeze({schema:Hs,representation:`chebyshev`,lawId:e.id,inputs:e.inputs,output:e.output,sourceHash:e.sourceHash,domainHash:e.domainHash,dependencies:e.dependencies,envelope:e.envelope,fallbackPolicy:e.fallbackPolicy,responseFunction:p,packed:m,regimeKey:h,invalidation:g,invalidationKey:_,regimeRecord:v,evaluateHost:e=>io(p,e),errorBudget:Object.freeze({sourceMethodUncertainty:`declared-unvalidated`,surrogateRelativeBound:p.residuals.relativeBound,gpuF32RoundingBound:12e-8}),scientificValidation:!1,fullPhysicsValidation:!1})}function Zs(e,{fnPrefix:t=`eshkol_law`,generation:n=1,resourceLayouts:r=zs,workgroupSize:i=64,includeEnvelopeWatch:a=!0}={}){if(e?.schema===`peercompute.ulg.law-ir.v1`)return Bs(e,{resourceLayouts:r,workgroupSize:i,includeEnvelopeWatch:a});if(e?.schema!==`peercompute.ulg.eshkol-approximated-law.v1`||e.representation!==`chebyshev`)throw TypeError(`compileLawToWgsl requires a chebyshev approximatedLaw or a peercompute.ulg.law-ir.v1 object`);let o=String(t).replace(/[^a-zA-Z0-9_]/g,`_`)||`eshkol_law`,s=e.responseFunction.axes,c=e.envelope?.homogeneityTest,l=Number.isFinite(Number(c?.maxTemperatureVarianceK2))?Number(c.maxTemperatureVarianceK2):1e30,u=Number.isFinite(Number(c?.maxTemperatureGradientKPerM))?Number(c.maxTemperatureGradientKPerM):1e30,d=Number.isFinite(Number(c?.maxJensenResidual))?Number(c.maxJensenResidual):1e30,f=!!(c&&(c.maxTemperatureVarianceK2!=null||c.maxTemperatureGradientKPerM!=null||c.maxJensenResidual!=null)),p=[0,1,2].map(e=>Math.fround(s[e]?.lo??-1e30)),m=[0,1,2].map(e=>Math.fround(s[e]?.hi??1e30)),h=s.length,g=e.fallbackPolicy===Ws.STRICT?0:e.fallbackPolicy===Ws.FROZEN?2:1,_=`
// Generated by ULG Eshkol Higher-Order Law Compiler (${Us})
// Law: ${e.lawId} | sourceHash: ${e.sourceHash} | domainHash: ${e.domainHash}
struct ${o}_Params {
  query_count: u32,
  generation: u32,
  fallback_policy: u32, // 0=strict, 1=async, 2=frozen
  homogeneity_enabled: u32,
  homog_limits: vec4<f32>, // (maxVarT, maxGradT, maxJensen, 0)
};

@group(0) @binding(0) var<uniform> ${o}_params: ${o}_Params;
@group(0) @binding(1) var<storage, read> ${o}_table: array<f32>;
@group(0) @binding(2) var<storage, read> ${o}_queries: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> ${o}_homog: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> ${o}_outputs: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> ${o}_receipt: array<atomic<u32>>;

${so(`${o}_table`)}

fn ${o}_envelope_status(x: vec3<f32>, h: vec4<f32>) -> vec2<f32> {
  let lo = vec3<f32>(${p[0]}, ${p[1]}, ${p[2]});
  let hi = vec3<f32>(${m[0]}, ${m[1]}, ${m[2]});
  var overshoot = 0.0;
  for (var a = 0u; a < ${h}u; a = a + 1u) {
    let v = x[a];
    if (!(v == v) || abs(v) > 3.4028234e38) {
      return vec2<f32>(4.0, 1.0); // non-finite input
    }
    let span = max(1e-12, hi[a] - lo[a]);
    if (v < lo[a]) {
      overshoot = max(overshoot, (lo[a] - v) / span);
      return vec2<f32>(1.0, overshoot); // domain exit low
    }
    if (v > hi[a]) {
      overshoot = max(overshoot, (v - hi[a]) / span);
      return vec2<f32>(2.0, overshoot); // domain exit high
    }
  }
  if (${o}_params.homogeneity_enabled == 1u) {
    // Missing/negative homogeneity summary fails CLOSED (h.w < 0.5 means missing)
    if (h.w < 0.5 || !(h.x == h.x) || !(h.y == h.y) || !(h.z == h.z) || h.x < 0.0 || h.y < 0.0 || h.z < 0.0) {
      return vec2<f32>(3.0, 1.0);
    }
    if (h.x > ${o}_params.homog_limits.x || h.y > ${o}_params.homog_limits.y || h.z > ${o}_params.homog_limits.z) {
      return vec2<f32>(3.0, 1.0);
    }
  }
  return vec2<f32>(0.0, 0.0); // admitted
}

@compute @workgroup_size(64)
fn ${o}_eval_watched(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= ${o}_params.query_count) { return; }
  if (idx == 0u) {
    atomicStore(&${o}_receipt[7], ${o}_params.generation);
  }
  let q = ${o}_queries[idx];
  let h = ${o}_homog[idx];
  let env = ${o}_envelope_status(q.xyz, h);
  let code = u32(env.x);
  if (code == 0u) {
    let d = rf_eval_differential(0u, q.xyz);
    if (d.ok == 1u) {
      atomicAdd(&${o}_receipt[0], 1u);
      ${o}_outputs[idx] = vec4<f32>(d.value, d.gradient.x, d.gradient.y, 1.0);
      return;
    }
  }
  // Envelope breach: record exact exit reason & debt — never silently extrapolate!
  if (code == 1u) { atomicAdd(&${o}_receipt[1], 1u); }
  else if (code == 2u) { atomicAdd(&${o}_receipt[2], 1u); }
  else if (code == 3u) { atomicAdd(&${o}_receipt[3], 1u); }
  else { atomicAdd(&${o}_receipt[4], 1u); }
  let dist_micro = u32(clamp(env.y * 1000000.0, 0.0, 4294967000.0));
  atomicMax(&${o}_receipt[6], dist_micro);
  if (${o}_params.fallback_policy == 0u) {
    // Strict policy: hold/reject output (ok = 0.0)
    ${o}_outputs[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }
  // Async / frozen policy: evaluate clamped boundary + increment explicit debt counter
  atomicAdd(&${o}_receipt[5], 1u);
  let lo = vec3<f32>(${p[0]}, ${p[1]}, ${p[2]});
  let hi = vec3<f32>(${m[0]}, ${m[1]}, ${m[2]});
  let clamped = clamp(q.xyz, lo, hi);
  let d = rf_eval_differential(0u, clamped);
  ${o}_outputs[idx] = vec4<f32>(d.value, d.gradient.x, d.gradient.y, 0.0);
}
`,v=Ja(_,`eshkol-wgsl`);return Object.freeze({schema:Us,lawId:e.lawId,fnPrefix:o,entryPoint:`${o}_eval_watched`,generation:Math.max(1,Math.round(Number(n)||1)),fallbackPolicy:e.fallbackPolicy,fallbackCode:g,hasHomogeneityGate:f,homogeneityLimits:Object.freeze([l,u,d,0]),sourceHash:e.sourceHash,domainHash:e.domainHash,wgslHash:v,packed:e.packed,wgsl:_})}var Qs=`ulg.polytope-atlas-builder.v1`,$s=8.314462618;function ec(e,{phase:t=`solid`,temperatureRangeK:n=null,log10PressureRange:r=[2,8],degrees:i=[6,8],relativeTolerance:a=.02}={}){let o=Math.max(15,Number(e.thermodynamic.meltingPointK??300)),s=Math.max(o+20,Number(e.thermodynamic.boilingPointK??1e3)),c=n||(t===`solid`?[Math.max(10,o*.15),Math.max(20,o*.95)]:t===`liquid`?[o*1.02,Math.max(o*1.15,s*.96)]:[s*1.05,Math.max(s*2,4e3)]),l=String(e.materialKey||`mat`).replace(/[^a-zA-Z0-9_-]/g,`_`),u=(n,r,o=``)=>{let s=Js({id:`ulg:polytope-eos:${l}:${t}${o}`,inputs:[{name:`temperatureK`,unit:`K`,referenceValue:.5*(c[0]+c[1])},{name:`log10PressurePa`,unit:`log10(Pa)`,referenceValue:.5*(n+r)}],output:{name:`densityKgPerM3`,unit:`kg/m^3`},parameters:{materialKey:e.materialKey,phase:t,closureHash:e.closureHash},stateContract:{reads:[`temperatureK`,`pressurePa`],writes:[`densityKgPerM3`],accumulates:[]},conservationInvariants:[`positivity:density>0`,`thermodynamic-stability:dRho/dP>=0`],envelope:{temperatureRangeK:c,pressureRangePa:[10**n,10**r],phase:t,ranges:{temperatureK:c,log10PressurePa:[n,r]}},fallbackPolicy:Ws.ASYNC,sourceMethod:`eshkol-higher-order-polytope-eos(${e.accuracyTier})`,eshkolBody:`(lambda (T log10P) (polytope-eos "${e.materialKey}" '${t} T (expt 10 log10P)))`,evaluate:({temperatureK:n,log10PressurePa:r})=>rc(e,t,n,10**r)});return{law:s,approx:Xs(s,{representation:`chebyshev`,degrees:i,relativeTolerance:a,composition:{[e.materialKey]:1}}),lo:n,hi:r}},d=[],f=(e,t,n=0,r=``)=>{try{d.push(u(e,t,r))}catch(i){if(n>=4||t-e<.25)throw i;let a=.5*(e+t);f(e,a,n+1,`${r}L`),f(a,t,n+1,`${r}H`)}};f(r[0],r[1],0,``);let p=d.find(e=>e.lo<=5.01&&e.hi>=5)||d[0],m=p.law,h=p.approx,g=Ys(m,{id:`ulg:polytope-eos:${l}:${t}:dRho_dT`,axis:`temperatureK`}),_=Ys(m,{id:`ulg:polytope-eos:${l}:${t}:dRho_dLogP`,axis:`log10PressurePa`}),v=Zs(h,{fnPrefix:`eshkol_${l}_${t}`.slice(0,36)});return Object.freeze({schema:`ulg.eshkol.polytope-higher-order-laws.v1`,materialKey:e.materialKey,phase:t,densityLaw:m,thermalExpTangent:g,compressibilityTangent:_,approximatedDensity:h,subPolytopeCount:d.length,subPolytopes:Object.freeze(d.map(e=>Object.freeze({log10PressureRange:[e.lo,e.hi],surrogateRelativeBound:e.approx.errorBudget.surrogateRelativeBound}))),compiledWgsl:v,surrogateRelativeBound:Math.max(...d.map(e=>e.approx.errorBudget.surrogateRelativeBound))})}async function tc(e,{eshkolSample:t=null,quantumProbeReceipt:n=null,temperatureRangeK:r=null}={}){let i=Math.max(1,Number(e.nuclear.atomicMassU??e.nuclear.molarMassU??28)),a=Math.max(1,Number(e.nuclear.atomsPerFormula??1)),o=Math.max(.05,Number(e.mechanical.cohesiveEnergyEv??1)/a),s=Math.max(30,Number(e.mechanical.debyeTempK??250)),c=Math.max(1.5,Number(e.mechanical.latticeConstantA??3.8)),l=Math.max(15e-11,c*.72*1e-10),u=Math.max(50,Number(e.mechanical.densityKgPerM3??1e3)),d=Math.max(20,Number(e.thermodynamic.meltingPointK??300)),f=Math.max(15,Math.min(240,d*.4)),p=Math.max(f+80,Math.min(2400,d*1.4));return ko({material:e.materialKey,molarMassKgPerMol:i*.001,atomsPerFormula:a,cohesiveEnergyEvPerAtom:o,debyeTemperatureK:s,molecularDiameterM:l,refDensityKgPerM3:u,meltTemperatureK:d,temperatureRangeK:r||[f,p],eshkolSample:t,quantumProbeReceipt:n||{fingerprint:e.closureHash,accuracyTier:e.accuracyTier}})}async function nc(e,t,n={}){let r=await tc(t,n),i=Uo(e,{materialKey:t.materialKey,materialId:n.materialId??null,packedData:r.gpuBundle.packed.data,sourceFingerprint:r.provenanceFingerprint,g6DebyeSamples:r.g6DebyeSamples});return Object.freeze({materialKey:t.materialKey,triad:r,gpuRegistryStatus:i})}function rc(e,t,n,r){let i=Math.max(1,Number(n)),a=Math.max(.001,Number(r)),o=Math.max(1,Number(e?.mechanical?.densityKgPerM3??1e3)),s=Math.max(1e6,Number(e?.mechanical?.bulkModulusPa??2e9)),c=Math.max(1e-6,Math.min(.005,Number(e?.thermodynamic?.thermalExpansionVolPerK??4e-5))),l=Number(e?.thermodynamic?.temperatureK??300),u=Number(e?.nuclear?.atomicMassU??e?.nuclear?.molarMassU??e?.molarMassU??e?.atomicMassU??(e?.molarMassKgPerMol?e.molarMassKgPerMol*1e3:28))*.001;if(t===`solid`){let t=Math.max(10,Number(e.thermodynamic.meltingPointK??300)),n=Math.min(l,.5*t),r=Math.min(c,.45/Math.max(10,t)),u=Math.exp(-r*(i-n)),d=(1+4*a/s)**.25;return o*u*d}if(t===`liquid`){let t=Math.max(1,Number(e.thermodynamic.liquidDensityKgPerM3??o*.92)),n=Math.max(10,Number(e.thermodynamic.meltingPointK??300)),r=Math.max(n+20,Number(e.thermodynamic.boilingPointK??n*1.5)),l=Math.min(2.2*c,.5/Math.max(20,r-n)),u=Math.exp(-l*(i-n)),d=(1+4*a/Math.max(5e8,s*.45))**.25;return t*u*d}let d=t===`plasma`?1.85:1,f=a*u/(d*$s*i);return f/(1+1/Math.max(10,o*.65)*f)}async function ic(e,t,{degrees:n=[5,5],relativeTolerance:r=.02,maxBisectDepth:i=3,materialIndex:a=0,pressureRangePa:o=[100,1e10],persistentCache:s=null,useSharedPersistentCache:c=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildMaterialPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);let l=Math.max(.001,Number(o?.[0]??100)),u=Math.max(l*10,Number(o?.[1]??1e10)),d=Object.freeze([l,u]),f=s||(c?Es():null),p=f?_s({builderSchema:Qs,materialKey:t.materialKey,family:t.family,closureHash:t.closureHash,generatorFingerprint:t.generatorFingerprint||`ulg-foundation-v1`,pressureRangePa:d,degrees:n,relativeTolerance:r,maxBisectDepth:i,materialIndex:a}):null;if(f&&p){let e=await f.get(p);if(e)return e}let m=ns(),h=Number(t.thermodynamic.meltingPointK),g=Number(t.thermodynamic.boilingPointK),_=Math.max(g*2.5,6500),v=m.discoverMaterialPolytopes({materialKey:t.materialKey,family:t.family,meltingPointK:h,boilingPointK:g,ionizationTempK:_,meltingSlopeKPerLogP:Number(t.thermodynamic.meltingSlopeKPerLogP??15),boilingSlopeKPerLogP:Number(t.thermodynamic.boilingSlopeKPerLogP??180),maxTemperatureK:Math.max(_*2,16e3),minPressurePa:l,maxPressurePa:u,accuracyTier:t.accuracyTier,closureHash:t.closureHash,crystalStructure:{id:t.mechanical.crystalStructure,spaceGroup:t.mechanical.spaceGroup,latticeConstantA:t.mechanical.latticeConstantA},provenance:t.provenance}),b=[];for(let a of v){let o=a.phase===`gas`||a.phase===`plasma`,s=await us(e,a,(e,n)=>rc(t,a.phase,e,n),{degrees:n,relativeTolerance:r,requirePositive:!0,maxDepth:o?Math.max(i,5):i,propertyName:`densityKgPerM3`,logScale:o});b.push(...s.polytopes)}m.registerMaterialPolytopes(t.materialKey,b);let S=y(b,{materialIndex:a}),C=`bypass`,w=null,T={schema:x,builderSchema:Qs,materialKey:t.materialKey,family:t.family,accuracyTier:t.accuracyTier,closureHash:t.closureHash,pressureRangePa:d,polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:S,registry:m};if(f&&p){let e=await f.set(p,T);C=e?.ok?`miss-stored`:`miss-store-failed`,w=e?.backend??null}return Object.freeze({...T,cacheStatus:C,cacheBackend:w,cacheKey:p?.cacheKey??null})}var ac=`ulg.electronic.molecular-hf-webgpu.v1`,oc=27.211386245988,sc=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),cc=`
struct MolVolParams {
  dim: u32,
  atom_count: u32,
  mode: u32, // 0 = total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  pad0: u32,
  box_half_bohr: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
};

// Per-atom compact orbital envelope: vec4(x, y, z, zeta), vec4(occ_weight, homo_coeff, lumo_coeff, Z)
@group(0) @binding(0) var<uniform> params: MolVolParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
// Output dim^3 vec4(pos_amp, neg_amp, core_norm, density)
@group(0) @binding(3) var<storage, read_write> volume_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn sample_molecular_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let p = vec3<f32>(fx, fy, fz) * params.box_half_bohr;

  var rho_tot = 0.0;
  var psi_orb = 0.0;
  var min_r = 1e9;
  for (var a = 0u; a < params.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(p - az.xyz);
    min_r = min(min_r, r);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, params.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (params.mode == 0u) {
    let d = clamp(pow(max(0.0, rho_tot * 0.65), 0.72), 0.0, 1.0);
    let bond_glow = clamp(abs(psi_orb) * 0.85, 0.0, 1.0);
    volume_out[idx] = vec4<f32>(
      clamp(d * 0.82 + bond_glow * 0.25, 0.0, 1.0),
      clamp(d * 0.48 + bond_glow * 0.55, 0.0, 1.0),
      clamp(d * 1.05 + bond_glow * 0.35, 0.0, 1.0),
      d
    );
  } else {
    let pos_a = clamp(max(0.0, psi_orb), 0.0, 1.0);
    let neg_a = clamp(max(0.0, -psi_orb), 0.0, 1.0);
    let d = clamp(abs(psi_orb), 0.0, 1.0);
    volume_out[idx] = vec4<f32>(pos_a, neg_a, clamp(min_r / max(params.box_half_bohr, 1.0), 0.0, 1.0), d);
  }
}
`;function lc(e,t=`auto`){let n=String(t||`auto`).trim().toLowerCase();if(n===`valence-sto3g`||n===`ecp-sto3g`||e.some(e=>e.Z>18))return`valence-sto3g`;if(n===`auto`){let t=0;for(let n of e)t+=n.Z<=2?1:n.Z<=10?5:9;return t>28?`valence-sto3g`:`sto-3g`}return n}async function uc(e,t,{maxScf:n=35,tol:r=1e-5,damping:i=.35,volDim:a=24,volumeMode:o=0,basisName:s=`auto`,charge:c=0,sampleVolume:l=!0,initialP:u=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveMoleculeRhfWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(t)||t.length===0)throw TypeError(`solveMoleculeRhfWebGpu requires non-empty atoms array`);let d=t.map(e=>{let t=Array.isArray(e.position)?e.position:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0];return{Z:Math.max(1,Math.min(118,Math.trunc(e.Z))),x:t[0],y:t[1],z:t[2],position:t}}),f=lc(d,s),{basis:p,n:m,nElectrons:h,effCharges:g,S:_,Hcore:v,eri:y,idx:x,nuclearRepulsion:C}=$e(d,c,f),w=Array.isArray(g)&&g.length===d.length?g:d.map(e=>e.Z),T=h,E=Math.max(1,Math.min(m,Math.floor(T/2))),D=new Float32Array(m*m),O=new Float64Array(m*m);for(let e=0;e<m;e+=1)for(let t=0;t<m;t+=1)D[e*m+t]=_[e][t],O[e*m+t]=v[e][t];let k=u&&u.length===m*m?new Float64Array(u):new Float64Array(m*m),M=0,N=new Float32Array(m),P=new Float32Array(m*m),ee=0;for(let t=0;t<n;t+=1){ee=t+1;let n=new Float64Array(m*m);for(let e=0;e<m;e+=1)for(let t=0;t<m;t+=1){let r=0;for(let n=0;n<m;n+=1)for(let i=0;i<m;i+=1){let a=k[n*m+i];a!==0&&(r+=a*(y[x(e,t,n,i)]-.5*y[x(e,i,n,t)]))}n[e*m+t]=O[e*m+t]+r}let a=await S(e,{fockMatrices:Float32Array.from(n),overlapMatrices:D,n:m,batchCount:1,maxSweeps:28,tolerance:1e-6});N=a.eigenvalues,P=a.eigenvectors;let o=new Float64Array(m*m);for(let e=0;e<m;e+=1)for(let t=0;t<m;t+=1){let n=0;for(let r=0;r<Math.min(E,m);r+=1)n+=2*P[e*m+r]*P[t*m+r];o[e*m+t]=(1-i)*n+i*k[e*m+t]}let s=0;for(let e=0;e<m*m;e+=1)s+=.5*o[e]*(O[e]+n[e]);let c=s+C;if(k=o,t>1&&Math.abs(c-M)<r){M=c;break}M=c}let te=Math.max(0,Math.min(m-1,E-1)),F=Math.min(m-1,E),ne=N[te],re=E<m?N[F]:ne+.4,ie=Math.max(.1,(re-ne)*oc),I=new Float64Array(d.length);for(let e=0;e<d.length;e+=1)I[e]=w[e];for(let e=0;e<m;e+=1){let t=0;for(let n=0;n<m;n+=1)t+=k[e*m+n]*_[n][e];let n=p[e].atomIndex??0;n<I.length&&(I[n]-=t)}let ae=0,oe=0,L=0;for(let e=0;e<d.length;e+=1)ae+=I[e]*d[e].x,oe+=I[e]*d[e].y,L+=I[e]*d[e].z;let se=2.541746,R=Object.freeze([ae*se,oe*se,L*se]),z=Math.hypot(R[0],R[1],R[2]),{bondOrderMatrix:ce,bonds:B}=Qe(k,_,p,d,m);if(!l)return Object.freeze({schema:ac,backend:`webgpu`,basisUsed:f,basisCount:m,electronCount:T,atoms:Object.freeze(d.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:ee,totalEnergyHa:M,nuclearRepulsionHa:C,homoEnergyHa:ne,lumoEnergyHa:re,homoLumoGapEv:ie,dipoleDebye:z,dipoleVecDebye:R,mullikenCharges:Array.from(I),bonds:Object.freeze(B),bondOrderMatrix:ce,densityMatrix:k,accuracyTier:b.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:f===`valence-sto3g`?`gpumath-rhf-lowdin-valence-sto3g`:`gpumath-rhf-lowdin-sto3g`})});let le=j(e,{cacheKey:`ulg-mol-hf-volume.v1`,label:`ulg-mol-hf-volume`,code:cc,entryPoint:`sample_molecular_volume`,bindings:[A(0,`uniform`),A(1,`read-only-storage`),A(2,`read-only-storage`),A(3,`storage`)]}),V=new Float32Array(d.length*4),H=new Float32Array(d.length*4),ue=1.5;for(let e=0;e<d.length;e+=1){let t=d[e];ue=Math.max(ue,Math.hypot(t.x,t.y,t.z)+2.5),V[e*4+0]=t.x,V[e*4+1]=t.y,V[e*4+2]=t.z,V[e*4+3]=Math.max(.85,Math.min(2.6,.9+.14*Math.sqrt(t.Z)));let n=0,r=0,i=0;for(let t=0;t<m;t+=1)(p[t].atomIndex??0)===e&&(n+=P[t*m+te],r+=P[t*m+F],i+=k[t*m+t]);H[e*4+0]=Math.max(.5,i),H[e*4+1]=n,H[e*4+2]=r,H[e*4+3]=t.Z}let U=a**3,de=new ArrayBuffer(32);new Uint32Array(de,0,4).set([a,d.length,o,0]),new Float32Array(de,16,4).set([ue,0,0,0]);let fe=e.createBuffer({size:32,usage:sc.UNIFORM|sc.COPY_DST});e.queue.writeBuffer(fe,0,de);let pe=e.createBuffer({size:Math.max(16,V.byteLength),usage:sc.STORAGE|sc.COPY_DST});e.queue.writeBuffer(pe,0,V);let me=e.createBuffer({size:Math.max(16,H.byteLength),usage:sc.STORAGE|sc.COPY_DST});e.queue.writeBuffer(me,0,H);let he=e.createBuffer({size:U*16,usage:sc.STORAGE|sc.COPY_SRC}),ge=e.createBuffer({size:U*16,usage:sc.MAP_READ|sc.COPY_DST}),_e=e.createBindGroup({layout:le.bindGroupLayout,entries:[fe,pe,me,he].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ve=e.createCommandEncoder({label:`ulg-mol-hf-volume`}),ye=ve.beginComputePass({label:`ulg-mol-hf-volume-pass`});ye.setPipeline(le.pipeline),ye.setBindGroup(0,_e),ye.dispatchWorkgroups(Math.ceil(U/64)),ye.end(),ve.copyBufferToBuffer(he,0,ge,0,U*16),e.queue.submit([ve.finish()]);try{await ge.mapAsync(sc.MAP_READ);let e=new Float32Array(ge.getMappedRange().slice(0,U*16));return ge.unmap(),Object.freeze({schema:ac,backend:`webgpu`,basisUsed:f,basisCount:m,electronCount:T,atoms:Object.freeze(d.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:ee,totalEnergyHa:M,nuclearRepulsionHa:C,homoEnergyHa:ne,lumoEnergyHa:re,homoLumoGapEv:ie,dipoleDebye:z,dipoleVecDebye:R,mullikenCharges:Array.from(I),bonds:Object.freeze(B),bondOrderMatrix:ce,orbitalEnergiesHa:Array.from(N),volDim:a,boxHalfBohr:ue,volumeData:e,atomOrbitalParams:Object.freeze({posZeta:new Float32Array(V),weights:new Float32Array(H),boxHalfBohr:ue,homoIdx:te,lumoIdx:F}),accuracyTier:b.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:f===`valence-sto3g`?`gpumath-rhf-lowdin-valence-sto3g`:`gpumath-rhf-lowdin-sto3g`})})}finally{for(let e of[fe,pe,me,he,ge])e.destroy()}}var dc=`ulg.electronic.ci-neb-webgpu.v1`;async function fc(e,t,n,{nImages:r=5,maxSteps:i=5,springK:a=.08,stepSize:o=.14,climbStartStep:s=1,forceTol:c=.015,gradH:l=.0025,maxScf:u=22,tol:d=1e-4,basisName:f=`auto`,oneSidedGrad:p=!1,saddleOnlyGrad:m=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`climbingImageNEBWebGpu requires a live WebGPU GPUDevice`);let h=e=>Array.isArray(e.position)?[Number(e.position[0])||0,Number(e.position[1])||0,Number(e.position[2])||0]:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0],g=t.map(e=>Math.trunc(e.Z)),_=g.length,v=t.map(h),y=n.map(h),b=[];for(let e=0;e<r;e+=1){let t=e/Math.max(1,r-1),n=v.map((e,n)=>[e[0]+t*(y[n][0]-e[0]),e[1]+t*(y[n][1]-e[1]),e[2]+t*(y[n][2]-e[2])]);if(e>0&&e<r-1&&_>=3)for(let e=0;e<6;e+=1)for(let e=0;e<_;e+=1)for(let t=e+1;t<_;t+=1){let r=g[e]===1||g[t]===1?1.4:2.15,i=n[t][0]-n[e][0],a=n[t][1]-n[e][1],o=n[t][2]-n[e][2],s=Math.hypot(i,a,o);if(s<r){s<1e-4&&(i=0,a=.5,o=.866);let c=Math.max(1e-4,Math.hypot(i,a,o)),l=.52*(r-s);n[e][0]-=i/c*l,n[e][1]-=a/c*l,n[e][2]-=o/c*l,n[t][0]+=i/c*l,n[t][1]+=a/c*l,n[t][2]+=o/c*l}}b.push(n)}let x=(e,t)=>{let n=[];for(let r=0;r<_;r+=1)n.push(e[r][0]-t[r][0],e[r][1]-t[r][1],e[r][2]-t[r][2]);return n},S=(e,t)=>e.reduce((e,n,r)=>e+n*t[r],0),C=e=>Math.sqrt(S(e,e)),w=e=>e.map((e,t)=>({Z:g[t],position:e})),T=Array(r).fill(null),E=0;async function D(t,n,r){let i=await uc(e,w(n),{maxScf:u,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]});if(E+=1,T[t]=i.densityMatrix,!r)return{energyHa:i.totalEnergyHa,grad:Array(3*_).fill(0)};let a=Array(3*_).fill(0),o=n.map(e=>[...e]),s=+(_>=2);for(let n=s;n<_;n+=1)for(let r=0;r<3;r+=1){let c=o[n][r];o[n][r]=c+l;let u=(await uc(e,w(o),{maxScf:12,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]})).totalEnergyHa;E+=1;let m;if(p)m=(u-i.totalEnergyHa)/l;else{o[n][r]=c-l;let i=(await uc(e,w(o),{maxScf:12,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]})).totalEnergyHa;E+=1,m=(u-i)/(2*l)}o[n][r]=c,a[n*3+r]=m,s===1&&(a[r]-=m)}return{energyHa:i.totalEnergyHa,grad:a}}let O=Array(r).fill(0),k=1/0,A=!1,j=0,M=await D(0,b[0],!1),N=await D(r-1,b[r-1],!1);for(let e=0;e<i;e+=1){j=e+1;let t=Array(r);if(O=Array(r),O[0]=M.energyHa,t[0]=M.grad,O[r-1]=N.energyHa,t[r-1]=N.grad,m){for(let e=1;e<r-1;e+=1){let n=await D(e,b[e],!1);O[e]=n.energyHa,t[e]=n.grad}let e=1;for(let t=2;t<r-1;t+=1)O[t]>O[e]&&(e=t);let n=await D(e,b[e],!0);O[e]=n.energyHa,t[e]=n.grad}else for(let e=1;e<r-1;e+=1){let n=await D(e,b[e],!0);O[e]=n.energyHa,t[e]=n.grad}let n=1;for(let e=2;e<r-1;e+=1)O[e]>O[n]&&(n=e);let i=Array(r);k=0;for(let o=1;o<r-1;o+=1){let r=x(b[o+1],b[o]),c=x(b[o],b[o-1]),l;if(O[o+1]>O[o]&&O[o]>O[o-1])l=r;else if(O[o+1]<O[o]&&O[o]<O[o-1])l=c;else{let e=Math.max(Math.abs(O[o+1]-O[o]),Math.abs(O[o-1]-O[o])),t=Math.min(Math.abs(O[o+1]-O[o]),Math.abs(O[o-1]-O[o]));l=O[o+1]>O[o-1]?r.map((n,r)=>n*e+c[r]*t):r.map((n,r)=>n*t+c[r]*e)}let u=Math.max(1e-12,C(l)),d=l.map(e=>e/u),f=t[o].map(e=>-e),p=S(f,d),m;if(e>=s&&o===n)m=f.map((e,t)=>e-2*p*d[t]);else{let e=f.map((e,t)=>e-p*d[t]),t=a*(C(r)-C(c));m=e.map((e,n)=>e+t*d[n])}i[o]=m,k=Math.max(k,...m.map(Math.abs))}if(k<c&&e>=s){A=!0;break}for(let e=1;e<r-1;e+=1){let t=i[e],n=Math.max(1e-12,C(t)),r=Math.min(o,.08/n);for(let n=0;n<_;n+=1)b[e][n][0]+=r*t[n*3],b[e][n][1]+=r*t[n*3+1],b[e][n][2]+=r*t[n*3+2]}}let P=1;for(let e=2;e<r-1;e+=1)O[e]>O[P]&&(P=e);return Object.freeze({schema:dc,backend:`webgpu`,gpuRhfCalls:E,images:Object.freeze(b.map(e=>Object.freeze(e.map((e,t)=>Object.freeze({Z:g[t],position:[...e]}))))),energiesHa:Object.freeze([...O]),saddleImageIndex:P,transitionStateAtoms:Object.freeze(b[P].map((e,t)=>Object.freeze({Z:g[t],position:[...e]}))),forwardBarrierHa:Math.max(0,O[P]-O[0]),reverseBarrierHa:Math.max(0,O[P]-O[r-1]),reactionEnergyHa:O[r-1]-O[0],maxForceHaPerBohr:k,steps:j,converged:A,provenance:Object.freeze({status:`webgpu-derived`,solver:`gpumath-rhf-ci-neb`,scientificValidation:!1})})}function pc(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`molecular-rhf-gpu`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/molecularHartreeFockWebGpu.js`,entryPoint:`sample_molecular_volume`,workgroupSize:64,wgsl:cc},parameterSchema:{atoms:{type:`array`},basisName:{type:`string`,default:`auto`},maxScf:{type:`number`,min:4,max:120}},stateLayout:{tensorId:`molecular_rhf_density_and_wiberg_bonds`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`molecular-rhf-gpu@1 requires a WebGPU device`);let r=e?.parameters||{};return{status:`ok`,result:await uc(n,r.atoms||[],{basisName:r.basisName??`auto`,maxScf:r.maxScf??30,sampleVolume:r.sampleVolume!==!1})}}})}var mc=`peercompute.ulg.optical-resolver-webgpu.v1`,hc=6582119569e-25,gc=1,_c=`
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
`;function vc(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var yc=vc(_c),bc=new WeakMap;function xc(e){let t=bc.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-optical-resolver-wgsl`,code:_c}),r=e.createBindGroupLayout({label:`ulg-optical-resolver-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`read-only-storage`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({label:`ulg-optical-resolver-pl`,bindGroupLayouts:[r]});return t={pipeline:e.createComputePipeline({label:`ulg-optical-resolver-pipeline`,layout:i,compute:{module:n,entryPoint:`resolve_optical_materials`}}),bindGroupLayout:r},bc.set(e,t),t}function Sc(e=[]){let t=Array.isArray(e)?e:[],n=new Float32Array(Math.max(1,t.length)*8),r=[],i=Array(t.length).fill(`none`);for(let e=0;e<t.length;e+=1){let a=t[e]||{},o=Number.isInteger(a.mode)?a.mode:0,s=e*8;if(o===0){let t=Number.isFinite(a.plasmaRadPerS)?a.plasmaRadPerS:ai(Math.max(1e10,Number(a.conductionElectronDensityPerM3)||1e28)),o=Number.isFinite(a.plasmaEnergyEv)?a.plasmaEnergyEv:hc*t,c=Number.isFinite(a.dampingEv)?a.dampingEv:o/30,l=Array.isArray(a.interbandOscillators),u=l?a.interbandOscillators:a.atomicNumberZ?ti({atomicNumberZ:a.atomicNumberZ,conductionElectronDensityPerM3:a.conductionElectronDensityPerM3,options:a.interbandOptions||{}}):[];i[e]=l?`caller-supplied`:a.atomicNumberZ?`cpu-radial-ks-interband`:`drude-only`;let d=r.length;for(let e of u)r.push([Number(e.energyEv)||0,Number(e.dampingEv)||.22,Number(e.strengthWeight)||0,0]);n[s+0]=o,n[s+1]=c,n[s+2]=Number.isFinite(a.pathLengthM)?a.pathLengthM:.3,n[s+3]=d,n[s+4]=u.length,n[s+5]=0,n[s+6]=0,n[s+7]=0}else if(o===1){let t=Number.isFinite(Number(a.refractiveIndex))&&Number(a.refractiveIndex)>=1?Number(a.refractiveIndex):1;n[s+0]=Number.isFinite(a.chargeZ)?a.chargeZ:1,n[s+1]=0,n[s+2]=0,n[s+3]=0,n[s+4]=0,n[s+5]=1,n[s+6]=Math.max(0,Math.min(.9999999,Number(a.beta)||0)),n[s+7]=t,i[e]=`frank-tamm-webgpu`}else{let t=Number.isFinite(Number(a.refractiveIndex??a.ior))&&Number(a.refractiveIndex??a.ior)>1?Number(a.refractiveIndex??a.ior):0;n[s+0]=t,n[s+1]=0,n[s+2]=Number.isFinite(a.pathLengthM)?a.pathLengthM:.3,n[s+3]=0,n[s+4]=0,n[s+5]=2,n[s+6]=Math.max(0,Number(a.electronicGapEv)||0),n[s+7]=Math.max(0,Number(a.densityCrossSectionPerM)||0),i[e]=t>1?`band-gap-explicit-ior`:`band-gap-herve-vandamme-webgpu`}}let a=new Float32Array(Math.max(1,r.length)*4);for(let e=0;e<r.length;e+=1){let t=r[e],n=e*4;a[n+0]=t[0],a[n+1]=t[1],a[n+2]=t[2],a[n+3]=t[3]}return{materialCount:t.length,oscillatorCount:r.length,oscSources:i,descData:n,oscData:a}}async function Cc(e,t=[],{keepResident:n=!1,readback:r=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`resolveOpticalBatchWebGpu requires a valid WebGPU GPUDevice.`);let i=Sc(t),a=i.materialCount;if(a===0)return{schema:mc,resolverStatus:`webgpu-derived`,webgpuProgramHash:yc,results:[],residentBuffers:null};let o=r!==!1||!n,{pipeline:s,bindGroupLayout:c}=xc(e),l=e.createBuffer({label:`ulg-opt-desc`,size:i.descData.byteLength,usage:136}),u=e.createBuffer({label:`ulg-opt-osc`,size:i.oscData.byteLength,usage:136}),d=a*16*Float32Array.BYTES_PER_ELEMENT,f=e.createBuffer({label:`ulg-opt-out`,size:d,usage:132}),p=a*9*4*Float32Array.BYTES_PER_ELEMENT,m=e.createBuffer({label:`ulg-opt-spec`,size:p,usage:132}),h=o?e.createBuffer({label:`ulg-opt-out-read`,size:d,usage:9}):null,g=o?e.createBuffer({label:`ulg-opt-spec-read`,size:p,usage:9}):null;try{e.queue.writeBuffer(l,0,i.descData),e.queue.writeBuffer(u,0,i.oscData);let t=e.createBindGroup({label:`ulg-opt-bg`,layout:c,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:u}},{binding:2,resource:{buffer:f}},{binding:3,resource:{buffer:m}}]}),r=e.createCommandEncoder({label:`ulg-opt-resolver-enc`}),_=r.beginComputePass({label:`ulg-opt-resolver-pass`});_.setPipeline(s),_.setBindGroup(0,t),_.dispatchWorkgroups(a,1,1),_.end(),o&&(r.copyBufferToBuffer(f,0,h,0,d),r.copyBufferToBuffer(m,0,g,0,p)),e.queue.submit([r.finish()]);let v=null;if(o){await Promise.all([h.mapAsync(gc),g.mapAsync(gc)]);let e=new Float32Array(h.getMappedRange().slice(0)),t=new Float32Array(g.getMappedRange().slice(0));h.unmap(),g.unmap(),v=[];for(let n=0;n<a;n+=1){let r=n*16,a=Math.round(e[r+15]),o=[];for(let e=0;e<9;e+=1){let r=(n*9+e)*4;o.push({wavelengthNm:t[r+0],reflectance:t[r+1],absorptionCoefficientPerM:t[r+2],nRe:t[r+3]})}let s=[e[r+0],e[r+1],e[r+2]];v.push({mode:a,baseColorSrgb:s,r:s[0],g:s[1],b:s[2],reflectance:e[r+3],absorptionCoefficientPerM:a===1?0:e[r+4],photonsPerMeter:a===1?e[r+4]:0,opticalDepth:a===1?0:e[r+5],cherenkovAngleDeg:a===1?e[r+5]:0,opacity:a===1?0:e[r+6],active:a===1?e[r+6]>.5:!0,transmission:e[r+7],metalness:e[r+8],roughness:e[r+9],cieXYZ:[e[r+10],e[r+11],e[r+12]],plasmaEnergyEv:e[r+13],oscillatorCount:Math.round(e[r+14]),oscillatorSource:i.oscSources[n],spectralSamples:o,resolverStatus:i.oscSources[n]===`cpu-radial-ks-interband`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:yc,validation:Object.freeze({scientificValidation:!1,opticalValidation:!1,webgpuParity:!1})})}}return{schema:mc,resolverStatus:i.oscSources.includes(`cpu-radial-ks-interband`)?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,webgpuProgramHash:yc,materialCount:a,readbackSkipped:!o,results:v,residentBuffers:n?{outputBuffer:f,spectralBuffer:m,destroy(){f.destroy(),m.destroy()}}:null}}finally{l.destroy(),u.destroy(),h?.destroy(),g?.destroy(),n||(f.destroy(),m.destroy())}}var wc=`ulg.gpumath.molecular-dynamics-webgpu.v1`,Tc=Object.freeze({LENNARD_JONES:0,MORSE_EAM:1,STILLINGER_WEBER:2}),Ec=Object.freeze({EQUILIBRIUM:0,STRAIN:1,ACOUSTIC:2,SHEAR_NEMD:3,THERMAL_NEMD:4,SURFACE_SLAB:5}),$=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Dc=10.1805057,Oc=8617333262e-14,kc=128,Ac=131072,jc=`
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

  var nb_vec: array<vec3<f32>, 12>;
  var nb_r: array<f32, 12>;
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
                if (model == 2u && nb_count < 12u) {
                  nb_vec[nb_count] = -d;
                  nb_r[nb_count] = r;
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
      if (model == 2u && nb_count < 12u) {
        nb_vec[nb_count] = -d;
        nb_r[nb_count] = r;
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

  // Stillinger-Weber 3-body tetrahedral term when model == 2 (covalent sp3 bonding)
  if (model == 2u && params.pot0.z > 0.0 && nb_count >= 2u) {
    let lambda_sw = params.pot0.z;
    let gamma_sw = max(params.pot1.z, 1.2);
    let a_sw = rcut / sig;
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
`;function Mc(e,{positions:t,velocities:n,boxLengthsA:r,potentialModel:i=Tc.LENNARD_JONES,epsilonEv:a=.0103,sigmaOrR0A:o=3.405,alphaOrLambda:s=1.5,rcutA:c=8.5,eamAEv:l=0,eamBeta:u=1.2,swGamma:d=1.2,dtFs:f=2,targetTemperatureK:p=0,thermostatCouplingFs:m=0,rNearestNeighborA:h=null,idealCoordination:g=null,meltingPointK:_=null,bulkModulusGPa:v=null,cohesiveEnergyEv:y=null,crystalStructure:b=null,gravityEnabled:x=!1,gravityAccelInternal:S=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createMolecularDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let C=t instanceof Float32Array?t:Float32Array.from(t),w=n instanceof Float32Array?n:Float32Array.from(n),T=Math.floor(C.length/4);if(!(T>=2&&w.length===T*4))throw RangeError(`Invalid MD buffers: atomCount=${T}, velFloats=${w.length}`);let E=Number(e.limits?.maxStorageBufferBindingSize)||128*1024*1024;if(T*32>E)throw RangeError(`MD init_state (${T*32} B) exceeds device maxStorageBufferBindingSize (${E} B)`);let D=Array.isArray(r)?[Number(r[0]),Number(r[1]),Number(r[2])]:[Number(r),Number(r),Number(r)],O=String(b||``).toLowerCase(),k=Number.isFinite(Number(h))&&Number(h)>.8?Number(h):i===Tc.LENNARD_JONES?Number(o)*2**(1/6):Number(o),M=Number.isFinite(Number(g))&&Number(g)>=4?Number(g):O===`bcc`||O.startsWith(`cscl`)?14:O===`diamond`||O.startsWith(`zincblende`)||O.startsWith(`cristobalite`)?4:12,N=Number.isFinite(Number(_))&&Number(_)>1?Number(_):Math.max(50,Number(p)||600),P=Number.isFinite(Number(v))&&Number(v)>.2?Number(v):Math.max(2,Math.min(350,Number(a)*160.22/Math.max(4,k**3)*28)),ee=Math.max(1,Number(w[3])||28),te=Number.isFinite(Number(y))&&Number(y)>.01?Number(y):Math.max(.04,Number(a)*6+Number(l)*1.6),F=T<=2e3?1e4:Math.max(10,Math.floor(2e7/T)),ne=T<=2e3?1e4:Math.max(2,Math.floor(2e6/T)),re=T<=2e3?1e5:Math.max(10,Math.floor(2e7/T)),ie=T<=8e3?100:10,I=T<=4096?1:Math.max(2,Math.floor(T/4096)),ae=Math.ceil(T/I),oe=[A(0,`uniform`),A(1,`storage`),A(2,`storage`),A(3,`storage`),A(4,`storage`),A(5,`read-only-storage`),A(6,`storage`),A(7,`storage`)],L=t=>j(e,{cacheKey:`ulg-gpumath-md-${t}.v6`,label:`ulg-gpumath-md-${t}`,code:jc,entryPoint:t,bindings:oe}),se=L(`reset_telemetry`),R=L(`clear_cell_list`),z=L(`build_cell_list`),ce=L(`apply_affine_strain`),B=L(`inject_acoustic_pulse`),le=L(`vv_half_kick_drift`),V=L(`compute_eam_density`),H=L(`compute_forces`),ue=L(`vv_second_kick_reduce`),U=T*16,de=(t,n,r)=>{let i=e.createBuffer({label:t,size:Math.max(16,n?n.byteLength:U),usage:r});return n&&e.queue.writeBuffer(i,0,n),i},fe=e.createBuffer({label:`ulg-md-params`,size:176,usage:$.UNIFORM|$.COPY_DST}),pe=de(`ulg-md-pos`,C,$.STORAGE|$.COPY_DST|$.COPY_SRC),me=de(`ulg-md-vel`,w,$.STORAGE|$.COPY_DST|$.COPY_SRC),he=de(`ulg-md-force`,new Float32Array(T*4),$.STORAGE|$.COPY_DST|$.COPY_SRC),ge=de(`ulg-md-unwrapped`,C,$.STORAGE|$.COPY_DST|$.COPY_SRC),_e=new Float32Array(T*8);_e.set(C,0),_e.set(w,T*4);let ve=de(`ulg-md-init-state`,_e,$.STORAGE|$.COPY_DST),ye=e.createBuffer({label:`ulg-md-telemetry`,size:kc*4,usage:$.STORAGE|$.COPY_SRC}),be=e.createBuffer({label:`ulg-md-telemetry-read`,size:kc*4,usage:$.MAP_READ|$.COPY_DST}),xe=Math.min(E,(Ac+T+64)*4),Se=Math.max(1,Math.min(Ac,Math.floor(xe/4)-T-16)),Ce=e.createBuffer({label:`ulg-md-linked-cell-grid`,size:Math.max(64,(Se+T+16)*4),usage:$.STORAGE}),we=e.createBindGroup({layout:H.bindGroupLayout,entries:[fe,pe,me,he,ge,ve,ye,Ce].map((e,t)=>({binding:t,resource:{buffer:e}}))}),Te=Number(f)/Dc,W=[...D],Ee=Math.max(1,Number(p)||300),De=Ee*1.25,Oe=Math.max(1,Ee*.75),ke=0,Ae=0,G=!1,K=Ec.EQUILIBRIUM,je=0,Me=0,Ne=0,Pe=0,Fe=0,Ie=!!x,Le=Number.isFinite(Number(S))&&Number(S)>0?Number(S):null,Re=1,ze=0,q=null,J=!1,Y=()=>{if(!Ie)return 0;if(Le!=null)return Le*Re;let e=2*te/Math.max(1,ee*Math.max(12,D[1])),t=.14*te/Math.max(1,ee*Math.max(1.5,k));return Math.max(15e-6,Math.min(t,e))*Re},Be=()=>{let e=Math.max(.5,Number(c)),t=Math.max(1,Math.floor(D[0]/e)),n=Math.max(1,Math.floor(D[1]/e)),r=Math.max(1,Math.floor(D[2]/e));if(t*n*r>Se){let e=Math.cbrt(Se/(t*n*r));for(t=Math.max(1,Math.floor(t*e)),n=Math.max(1,Math.floor(n*e)),r=Math.max(1,Math.floor(r*e));t*n*r>Se;)if(t>=n&&t>=r&&t>1)--t;else if(n>=r&&n>1)--n;else if(r>1)--r;else break}let i=t*n*r,a=+(T>=128&&i>=8);return{nx:t,ny:n,nz:r,totalCells:i,useCellList:a,nextBase:a?i:0}},Ve=({collectTelemetry:t=!1,scaleVel:n=1,useThermostat:r=!1,hotScale:h=1,coldScale:g=1,strainSx:_=1,strainSy:v=1,strainSz:y=1,shearXY:b=0,pulseAmp:x=0,pulsePol:S=0,dtScale:C=1}={})=>{let w=Math.max(.05,Math.min(1,Number(C)||1)),E=Number(f)*w,O=Te*w,A=Be(),j=r?Math.max(.45,.28*k/Math.max(.02,O)):0,P=Y(),te=Ie&&P>0,ae=Math.min(.85*k,.14*D[1]),oe=te?.025*ee/Math.max(4e-4,O*O):0,L=new ArrayBuffer(176),se=!!r|(te?2:0)|(K&15)<<8;return new Uint32Array(L,0,4).set([T,i,I,se]),new Float32Array(L,16,4).set([D[0],D[1],D[2],O]),new Float32Array(L,32,4).set([a,o,s,c]),new Float32Array(L,48,4).set([l,u,d,p]),new Float32Array(L,64,4).set([m>0?E/m:0,n,+!!t,je]),new Float32Array(L,80,4).set([h,g,_,v]),new Float32Array(L,96,4).set([y,b,x,S]),new Uint32Array(L,112,4).set([A.nx,A.ny,A.nz,A.nextBase]),new Float32Array(L,128,4).set([k,M,N,j]),new Float32Array(L,144,4).set([F,ne,re,ie]),new Float32Array(L,160,4).set([P,te?ze:0,ae,oe]),e.queue.writeBuffer(fe,0,L),A},He=Math.ceil(T/64);function Ue(e,t){t.nextBase>0&&(e.setPipeline(R.pipeline),e.dispatchWorkgroups(Math.max(1,Math.ceil(t.totalCells/64))),e.setPipeline(z.pipeline),e.dispatchWorkgroups(He)),i===Tc.MORSE_EAM&&(e.setPipeline(V.pipeline),e.dispatchWorkgroups(He)),e.setPipeline(H.pipeline),e.dispatchWorkgroups(He)}function We(e,{shearWallVel:t=0,thermalDeltaT:n=0}={}){K=Math.max(0,Math.min(5,Math.trunc(Number(e)||0))),je=Number(t)||0,Me=Number(n)||0}function Ge(e,{accelInternal:t=null,strength:n=null}={}){let r=!!e;return t!==void 0&&(Le=t!=null&&Number.isFinite(Number(t))&&Number(t)>0?Number(t):null),n!=null&&Number.isFinite(Number(n))&&Number(n)>0&&(Re=Math.max(.1,Math.min(5,Number(n)))),r!==Ie&&(Ie=r,ze=0,G=!1),Ke()}function Ke(){let e=Y(),t=e*(1e6/(Dc*Dc));return{enabled:Ie,strength:Re,accelInternal:e,accelAPerPs2:t}}function qe({strainX:t=0,strainY:n=0,strainZ:r=0,shearXY:i=0}={}){if(J)return;let a=Math.max(.82,Math.min(1.22,1+Number(t||0))),o=Math.max(.82,Math.min(1.22,1+Number(n||0))),s=Math.max(.82,Math.min(1.22,1+Number(r||0))),c=Math.max(-.22,Math.min(.22,Number(i||0))),l=Math.max(W[0]*.78,Math.min(W[0]*2.35,D[0]*a)),u=Math.max(W[1]*.78,Math.min(W[1]*2.35,D[1]*o)),d=Math.max(W[2]*.78,Math.min(W[2]*2.35,D[2]*s)),f=l/Math.max(1e-6,D[0]),p=u/Math.max(1e-6,D[1]),m=d/Math.max(1e-6,D[2]);D[0]=l,D[1]=u,D[2]=d,Ne=(D[0]-W[0])/Math.max(1e-6,W[0]),Pe=(D[1]-W[1])/Math.max(1e-6,W[1]),Fe+=c,Ve({strainSx:f,strainSy:p,strainSz:m,shearXY:c});let h=e.createCommandEncoder({label:`ulg-md-apply-strain`}),g=h.beginComputePass();g.setBindGroup(0,we),g.setPipeline(ce.pipeline),g.dispatchWorkgroups(He),g.end(),e.queue.submit([h.finish()]),G=!1}function Je({polarization:t=`longitudinal`,amplitude:n=.36}={}){if(J)return;let r=+(t===`transverse`);Ve({pulseAmp:Number(n)||.36,pulsePol:r});let i=e.createCommandEncoder({label:`ulg-md-inject-acoustic`}),a=i.beginComputePass();a.setBindGroup(0,we),a.setPipeline(B.pipeline),a.dispatchWorkgroups(He),a.end(),e.queue.submit([i.finish()])}function Ye(){if(J)return;let t=e.createCommandEncoder({label:`ulg-md-reset-vacf`});t.copyBufferToBuffer(me,0,ve,U,U),e.queue.submit([t.finish()])}function Xe(){if(J)return;let t=e.createCommandEncoder({label:`ulg-md-reset-msd`});t.copyBufferToBuffer(ge,0,ve,0,U),t.copyBufferToBuffer(me,0,ve,U,U),e.queue.submit([t.finish()])}async function Ze(t=10,{readTelemetry:n=!0,temperatureK:r=p,nptBarostatGPa:i=null,nonBlocking:a=!1,dtScale:o=1}={}){if(J)return null;if(n&&q){if(a)return null;try{await q}catch{}if(J)return null}let s=Math.max(1,Math.trunc(Number(t))),l=Math.max(.05,Math.min(1,Number(o)||1)),u=Number(f)*l,d=Number(r)>0&&Number(m)>0,h=1;if(d&&Ee>0){let e=Math.max(1,Number(r)),t=Math.max(u,Number(m)),n=Math.exp(-(s*u)/t),i=e+(Ee-e)*n;h=Math.max(.15,Math.min(6,i/Math.max(.5,Ee)))**(.5/s)}let g=Math.max(5,Number(r)||300),_=Math.max(10,Math.min(g*.65,Me||g*.35)),v=g+_,y=Math.max(5,g-_),b=Math.max(1,Math.min(s,14)),x=Math.max(.5,Math.min(2.8,v/Math.max(10,De))),S=Math.max(.3,Math.min(1.6,y/Math.max(10,Oe))),C=Math.max(.96,Math.min(1.018,x**(.5/b))),w=Math.max(.955,Math.min(1.015,S**(.5/b)));if(!G||s>1){let t=e.createCommandEncoder({label:`ulg-md-batch-${s}`});if(!G){let e=Ve({collectTelemetry:!1,scaleVel:1,useThermostat:!1,hotScale:1,coldScale:1,dtScale:l}),n=t.beginComputePass({label:`ulg-md-init-forces`});n.setBindGroup(0,we),Ue(n,e),n.end(),G=!0}if(s>1){let e=Ve({collectTelemetry:!1,scaleVel:h,useThermostat:d,hotScale:C,coldScale:w,dtScale:l}),n=t.beginComputePass({label:`ulg-md-steps-loop`});n.setBindGroup(0,we);for(let t=0;t<s-1;t+=1)n.setPipeline(le.pipeline),n.dispatchWorkgroups(He),Ue(n,e),n.setPipeline(ue.pipeline),n.dispatchWorkgroups(He);n.end()}e.queue.submit([t.finish()])}let E=e.createCommandEncoder({label:`ulg-md-final-step`}),O=Ve({collectTelemetry:n,scaleVel:h,useThermostat:d,hotScale:C,coldScale:w,dtScale:l}),A=E.beginComputePass({label:`ulg-md-final-pass`});if(A.setBindGroup(0,we),n&&(A.setPipeline(se.pipeline),A.dispatchWorkgroups(2)),A.setPipeline(le.pipeline),A.dispatchWorkgroups(He),Ue(A,O),A.setPipeline(ue.pipeline),A.dispatchWorkgroups(He),A.end(),n&&E.copyBufferToBuffer(ye,0,be,0,kc*4),e.queue.submit([E.finish()]),ke+=s,Ae+=s*u,!n)return null;let j=(async()=>{if(await be.mapAsync($.MAP_READ),J){try{be.unmap()}catch{}return null}let e=new Int32Array(be.getMappedRange().slice(0,kc*4));be.unmap();let t=e[0]/F,n=e[1]/F,r=t+n,a=e[2]/F,o=e[3]/(ne*T),s=[e[4]/F,e[5]/F,e[6]/F],l=D[0]*D[1]*D[2],d=Math.max(1,3*T-3),f=T*ee,p=s[1]/Math.max(1e-6,f),m=Ie?.5*(s[0]*s[0]+s[1]*s[1]+s[2]*s[2])/Math.max(1e-6,f):0,h=2*Math.max(1e-9,t-m)/(d*Oc);Ee=Number.isFinite(h)&&h>0?h:Ee,ze=Ie&&Number.isFinite(p)?p:0;let g=160.2176634,_=(2*t+a)/(3*l)*g,v=[e[7]/F/l*g,e[8]/F/l*g,e[9]/F/l*g],y=[(e[13]/F+e[10]/F)/l*g,(e[14]/F+e[11]/F)/l*g,(e[15]/F+e[12]/F)/l*g],b=Math.max(0,.5*D[2]*(.5*(y[0]+y[1])-y[2])*.1),x=e[81]/re,S=x>1e-6?Math.max(-1.2,Math.min(1.2,e[80]/re/x)):0,C=e[82]/re,w=e[83]/re,E=e[116]/(ie*T),A=Math.max(0,e[117]),j=Math.max(0,e[118]),N=Math.max(0,e[119]),te=e[120]/(ie*T),I=Ke(),oe=A/T,L=j/T,se=N/T,R=Math.sqrt(Math.max(0,o))/Math.max(1.2,k),z=`solid`;se>=.45?z=`vapor`:se>=.18&&L+oe>=.25?z=`boiling`:(L>=oe||R>=.28)&&(z=`liquid`);let ce=new Float32Array(8),B=new Float32Array(8),le=new Float32Array(8),V=new Float32Array(8);for(let t=0;t<8;t+=1){let n=84+t*4,r=Math.max(0,e[n]);ce[t]=r,r>0&&(B[t]=2*(e[n+1]/F)/(3*r*Oc),le[t]=e[n+2]/F/r,V[t]=e[n+3]/F/r)}if(K===Ec.THERMAL_NEMD){let e=(B[0]+B[1])*.5,t=(B[4]+B[5])*.5;e>1&&(De=e),t>1&&(Oe=t)}let H=null;if(K===Ec.SHEAR_NEMD&&je>1e-4){let e=Math.max(10,Math.abs(le[6]-le[1])*9822.7||2*je*9822.7)/Math.max(1e-10,D[1]*.65*1e-10),t=Math.abs(v[0])*1e9;e>1&&t>0&&(H=t/e)}let ue=null;if(K===Ec.THERMAL_NEMD){let e=Math.max(1,Math.abs(B[0]-B[4])),t=Math.max(1e-10,.5*D[0]*1e-10),n=Math.max(1e-20,D[1]*D[2]*1e-20),r=.5*(Math.abs(C)+Math.abs(w))*1602176634e-28/(2*n*Math.max(1e-16,u*1e-15));r>0&&(ue=r/(e/t))}if(i!=null&&Number.isFinite(Number(i))){let e=Number(i),t=Math.max(5e-4,Math.min(.012,.065/Math.max(2,P)));if(K===Ec.STRAIN){let n=Math.max(.99,Math.min(1.01,1+t*(y[1]-e))),r=Math.max(.99,Math.min(1.01,1+t*(y[2]-e)));(Math.abs(n-1)>1e-5||Math.abs(r-1)>1e-5)&&qe({strainY:n-1,strainZ:r-1})}else{let n=Math.max(.985,Math.min(1.018,1+t*(_-e)));Math.abs(n-1)>1e-5&&qe({strainX:n-1,strainY:n-1,strainZ:n-1})}}let U=new Float32Array(64),de=c/64,fe=T/l;for(let t=0;t<64;t+=1){let n=(t+.5)*de,r=4*Math.PI*n*n*de,i=Math.max(1e-9,ae*fe*r);U[t]=e[16+t]/i}let pe=l/Math.max(1e-6,W[0]*W[1]*W[2]),me=Math.abs(Ne)>.005?Math.max(-.2,Math.min(.49,-Pe/Ne)):null;return Object.freeze({schema:wc,backend:`webgpu`,usedCellList:O.nextBase>0,cellDims:Object.freeze([O.nx,O.ny,O.nz]),experimentMode:K,totalSteps:ke,timeFs:Ae,atomCount:T,boxLengthsA:Object.freeze([...D]),initBoxLengthsA:Object.freeze([...W]),volumeRatio:pe,strainX:Ne,strainY:Pe,shearXY:Fe,poissonMeasured:me,kineticEnergyEv:t,potentialEnergyEv:n,totalEnergyEv:r,temperatureK:h,pressureGPa:_,diagPressureGPa:Object.freeze(y),msdA2:o,lindemannRatio:R,meanCoordination:E,idealCoordination:M,solidFraction:oe,liquidFraction:L,vaporFraction:se,emergentPhase:z,gravityEnabled:I.enabled,gravityAccelInternal:I.accelInternal,gravityAccelAPerPs2:I.accelAPerPs2,meanYFrac:te,vacf:S,momentum:s,stressOffDiagGPa:v,surfaceTensionNPerM:b,nemdViscosityPaS:H,nemdThermalCondWPerMK:ue,slabTempK:B,slabVx:le,slabVy:V,rdf:U})})();q=j;try{return await j}finally{q===j&&(q=null)}}async function Qe(){let t=e.createBuffer({size:U,usage:$.MAP_READ|$.COPY_DST}),n=e.createBuffer({size:U,usage:$.MAP_READ|$.COPY_DST}),r=e.createCommandEncoder({label:`ulg-md-read-pos-vel`});r.copyBufferToBuffer(pe,0,t,0,U),r.copyBufferToBuffer(me,0,n,0,U),e.queue.submit([r.finish()]);try{await Promise.all([t.mapAsync($.MAP_READ),n.mapAsync($.MAP_READ)]);let e=new Float32Array(t.getMappedRange().slice(0,U)),r=new Float32Array(n.getMappedRange().slice(0,U));return t.unmap(),n.unmap(),{positions:e,velocities:r}}finally{t.destroy(),n.destroy()}}return Object.freeze({schema:wc,atomCount:T,rNearestNeighborA:k,idealCoordination:M,get boxLengthsA(){return[...D]},get initBoxLengthsA(){return[...W]},positionsBuffer:pe,velocitiesBuffer:me,forcesBuffer:he,setExperimentMode:We,setGravity:Ge,getGravity:Ke,applyStrain:qe,injectAcousticPulse:Je,resetVacfOrigin:Ye,resetMsdOrigin:Xe,stepBatch:Ze,readPositionsAndVelocities:Qe,destroy(){J=!0;for(let e of[fe,pe,me,he,ge,ve,ye,be,Ce])try{e.destroy()}catch{}}})}function Nc(e,t=8,n=32){let r=Array.isArray(e)?e.length:0,i=new Float32Array(n),a=new Float32Array(n);if(r<4)return{freqsThz:i,vdos:a,peakThz:0,effectiveDebyeK:0};let o=Math.min(24,500/Math.max(1,t)),s=1e-6,c=0;for(let l=0;l<n;l+=1){let u=(l+.5)/n*o;i[l]=u;let d=2*Math.PI*u*.001,f=0;for(let n=0;n<r;n+=1){let i=.5*(1+Math.cos(Math.PI*n/Math.max(1,r-1)));f+=e[n]*i*Math.cos(d*n*t)}let p=Math.max(0,f);a[l]=p,p>s&&(s=p,c=l)}for(let e=0;e<n;e+=1)a[e]/=s;let l=i[c];return{freqsThz:i,vdos:a,peakThz:l,effectiveDebyeK:l*47.99243*1.25}}function Pc(e){return!e||typeof e.registerModule!=`function`?null:{mechMod:e.registerModule({method:{model:`md-mechanical-probe`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`apply_affine_strain`,workgroupSize:64,wgsl:jc},parameterSchema:{strainX:{type:`number`,min:-.18,max:.18},shearXY:{type:`number`,min:-.18,max:.18},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_crystal_stress_strain`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-mechanical-probe@1 requires a WebGPU device`);let r=e?.parameters||{},i=Mc(n,{...Fc(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:100}),...r.potential||{}});try{i.setExperimentMode(Ec.STRAIN);let e=await i.stepBatch(6,{readTelemetry:!0,temperatureK:r.temperatureK??100});return i.applyStrain({strainX:r.strainX??-.02,shearXY:r.shearXY??0}),{status:`ok`,baseline:e,strained:await i.stepBatch(r.steps??12,{readTelemetry:!0,temperatureK:r.temperatureK??100})}}finally{i.destroy()}}}),nemdMod:e.registerModule({method:{model:`md-nemd-transport`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`vv_second_kick_reduce`,workgroupSize:64,wgsl:jc},parameterSchema:{mode:{type:`number`,min:0,max:5},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_nemd_slab_transport`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-nemd-transport@1 requires a WebGPU device`);let r=e?.parameters||{},i=Mc(n,{...Fc(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:300}),...r.potential||{}});try{return i.setExperimentMode(r.mode??Ec.THERMAL_NEMD,{shearWallVel:r.shearWallVel??.12,thermalDeltaT:r.thermalDeltaT??120}),{status:`ok`,telemetry:await i.stepBatch(r.steps??20,{readTelemetry:!0,temperatureK:r.temperatureK??300})}}finally{i.destroy()}}})}}function Fc({crystalStructure:e=`fcc`,cellsPerSide:t=3,cellsVec:n=null,vacuumZFactor:r=1,chamberScale:i=1,vacancyFraction:a=0,latticeConstantA:o=4.05,massU:s=26.982,temperatureK:c=300,seed:l=1337}={}){let u=Math.max(2,Math.trunc(t)),d=Array.isArray(n)?Math.max(2,Math.trunc(n[0])):u,f=Array.isArray(n)?Math.max(2,Math.trunc(n[1])):u,p=Array.isArray(n)?Math.max(2,Math.trunc(n[2])):u,m=Math.max(1,Number(r)||1),h=Math.max(1,Math.min(3,Number(i)||1)),g=Math.max(0,Math.min(.08,Number(a)||0)),_=Number(o),v=String(e||`fcc`).toLowerCase(),y,b=[1,1,1],x=_/Math.SQRT2,S=12;if(v===`bcc`||v.startsWith(`cscl`))y=[[0,0,0],[.5,.5,.5]],x=_*Math.sqrt(3)/2,S=14;else if(v===`diamond`||v.startsWith(`zincblende`)||v.startsWith(`cristobalite`))y=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]],x=_*Math.sqrt(3)/4,S=4;else if(v===`hcp`){let e=_/Math.SQRT2;b=[e/_,Math.sqrt(3)*e/_,1.632993*e/_],y=[[0,0,0],[.5,.5,0],[0,1/3,.5],[.5,5/6,.5]],x=e,S=12}else y=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5]],x=_/Math.SQRT2,S=12;let C=l>>>0,w=()=>(C=Math.imul(1664525,C)+1013904223>>>0,(C+.5)/4294967296),T=()=>Math.sqrt(-2*Math.log(w()))*Math.cos(2*Math.PI*w()),E=y.length,D=E*d*f*p,O=null,k=0;if(g>0&&D>=64){k=Math.max(1,Math.min(Math.floor(D*.05),Math.round(D*g)));let e=Math.max(3,Math.floor(D/(k+1)));O=new Set;for(let t=1;t<=k;t+=1)O.add((t*e+Math.floor(e*.5))%D);k=O.size}let A=D-k,j=new Float32Array(A*4),M=new Float32Array(A*4),N=_*b[0],P=_*b[1],ee=_*b[2],te=d*N,F=f*P,ne=p*ee,re=te*h,ie=F*h,I=ne*m*h,ae=h>1.01?.5*(re-te):0,oe=h>1.01?.5*(ie-F):0,L=m>1.01||h>1.01?.5*(I-ne):0,se=Math.sqrt(Math.max(1e-9,Oc*c/Math.max(s,1e-6))),R=0,z=0,ce=0,B=0,le=0;for(let e=0;e<d;e+=1)for(let t=0;t<f;t+=1)for(let n=0;n<p;n+=1)for(let r=0;r<E;r+=1){let i=O!==null&&O.has(R);if(R+=1,i)continue;let a=y[r],o=z*4;j[o+0]=(e+a[0])*N+ae,j[o+1]=(t+a[1])*P+oe,j[o+2]=(n+a[2])*ee+L,j[o+3]=1;let c=T()*se,l=T()*se,u=T()*se;M[o+0]=c,M[o+1]=l,M[o+2]=u,M[o+3]=s,ce+=c,B+=l,le+=u,z+=1}ce/=A,B/=A,le/=A;let V=0;for(let e=0;e<A;e+=1){let t=e*4,n=M[t+0]-ce,r=M[t+1]-B,i=M[t+2]-le;M[t+0]=n,M[t+1]=r,M[t+2]=i,V+=.5*s*(n*n+r*r+i*i)}let H=.5*(3*A-3)*Oc*c,ue=V>0?Math.sqrt(H/V):0;for(let e=0;e<A;e+=1){let t=e*4;M[t+0]*=ue,M[t+1]*=ue,M[t+2]*=ue}return{crystalStructure:v,atomCount:A,rNearestNeighborA:x,idealCoordination:S,positions:j,velocities:M,boxLengthsA:[re,ie,I]}}export{Vn as $,oo as A,ye as At,Sa as B,Go as C,R as Ct,Ko as D,Oe as Dt,Uo as E,De as Et,Wi as F,ie as Ft,Fa as G,Ta as H,ji as I,ae as It,ra as J,Ca as K,Fi as L,ro as M,he as Mt,Ja as N,ge as Nt,ko as O,xe as Ot,Ya as P,ee as Pt,Hn as Q,Mi as R,ns as S,ot as St,Ho as T,be as Tt,Xi as U,ya as V,ka as W,ja as X,na as Y,Bn as Z,Xs as _,xt as _t,Mc as a,Or as at,Es as b,ke as bt,fc as c,fn as ct,ic as d,mt as dt,gi as et,ec as f,Tt as ft,Ws as g,jt as gt,tc as h,St as ht,Nc as i,rr as it,so as j,ve as jt,ao as k,_e as kt,pc as l,sn as lt,nc as m,Ct as mt,Tc as n,Ai as nt,Pc as o,Ar as ot,rc as p,wt as pt,ia as q,Fc as r,Hr as rt,Cc as s,ln as st,Ec as t,ci as tt,uc as u,ht as ut,Zs as v,pt as vt,Wo as w,L as wt,us as x,at as xt,Js as y,st as yt,Vi as z};