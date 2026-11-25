import{computeBufferBinding as e,createCachedExplicitComputePipeline as t}from"../runtime/webgpuComputeLayout.js";var n=`ulg.material-property-bundle.v1`,r=`ulg.polytope-atlas.v1`,i=`ulg.polytope-atlas-gpu-buffer.v1`,a=`ulg.polytope-atlas-bank-gpu-buffer.v1`,o=Object.freeze({TIER_1_QUANTITATIVE:`tier-1-quantitative`,TIER_2_REPRESENTATIVE_EFFECTIVE:`tier-2-representative-effective`,TIER_3_THEORETICAL_ENVELOPE:`tier-3-theoretical-envelope`}),s=new Set(Object.values(o)),c=Object.freeze([`nuclear`,`atomic`,`electromagnetic`,`mechanical`,`thermodynamic`]);function l(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t^=e.charCodeAt(n),t=Math.imul(t,16777619)>>>0;return`ulg:${t.toString(16).padStart(8,`0`)}`}function u({materialKey:e,symbol:t=null,formula:r=null,atomicNumber:i=null,family:a=`element`,accuracyTier:u=o.TIER_2_REPRESENTATIVE_EFFECTIVE,generatorFingerprint:d=`ulg-foundation-v1`,nuclear:f,atomic:p,electromagnetic:m,mechanical:h,thermodynamic:g,provenance:_={},g7Advisory:v=null}={}){let y=String(e||t||r||``).trim();if(!y)throw TypeError(`createMaterialPropertyBundle requires materialKey, symbol, or formula`);if(!s.has(u))throw RangeError(`Invalid accuracyTier: ${u}`);let b={nuclear:f,atomic:p,electromagnetic:m,mechanical:h,thermodynamic:g};for(let e of c)if(!b[e]||typeof b[e]!=`object`)throw TypeError(`ulg.material-property-bundle.v1 missing required domain "${e}" for ${y}`);let x=l(JSON.stringify({key:y,family:a,atomicNumber:i,generatorFingerprint:d,domains:b}));return Object.freeze({schema:n,schemaVersion:1,materialKey:y,symbol:t?String(t):null,formula:r?String(r):null,atomicNumber:Number.isInteger(i)?i:null,family:a,accuracyTier:u,generatorFingerprint:String(d),closureHash:x,nuclear:Object.freeze({...f}),atomic:Object.freeze({...p}),electromagnetic:Object.freeze({...m}),mechanical:Object.freeze({...h}),thermodynamic:Object.freeze({...g}),provenance:Object.freeze({scientificValidation:!1,extrapolationPolicy:`fail-closed`,..._}),g7Advisory:v?Object.freeze({...v}):null})}function d(e){let t=[];if(!e||typeof e!=`object`)return Object.freeze({ok:!1,errors:Object.freeze([`bundle-not-object`])});e.schema!==`ulg.material-property-bundle.v1`&&t.push(`invalid-schema:${e.schema}`),e.materialKey||t.push(`missing-materialKey`),s.has(e.accuracyTier)||t.push(`invalid-accuracyTier:${e.accuracyTier}`);for(let n of c)(!e[n]||typeof e[n]!=`object`)&&t.push(`missing-domain:${n}`);return e.closureHash||t.push(`missing-closureHash`),e.provenance?.extrapolationPolicy!==`fail-closed`&&t.push(`extrapolation-policy-must-be-fail-closed`),Object.freeze({ok:t.length===0,errors:Object.freeze(t)})}var f=4,p=16,m=4,h=4,g=4,_=Object.freeze({solid:0,liquid:1,gas:2,supercritical:2,plasma:3}),v=Object.freeze({[o.TIER_1_QUANTITATIVE]:1,[o.TIER_2_REPRESENTATIVE_EFFECTIVE]:2,[o.TIER_3_THEORETICAL_ENVELOPE]:3});function y(e,{materialIndex:t=0}={}){let n=Array.isArray(e)?e:[],r=0,a=0;for(let e of n){let t=Array.isArray(e?.inequalities)?e.inequalities:[];r+=t.length;let n=e?.fit?.coefficients;a+=n?n.length:0}let o=4+n.length*16,s=o+r*4,c=Math.max(16,s+a),l=new Float32Array(c);l[0]=n.length,l[1]=8,l[2]=16,l[3]=1;let u=o,d=s;for(let e=0;e<n.length;e+=1){let r=n[e],i=4+e*16,a=Array.isArray(r?.inequalities)?r.inequalities:[],o=r?.axes?.[0]??{min:1,max:6e3},s=r?.axes?.[1]??{min:1,max:1e9},c=Math.log10(Math.max(1e-12,Number(s.min))),f=Math.log10(Math.max(1e-12,Number(s.max))),p=r?.fit??null,m=p?.coefficients??null,h=p?.degrees?.[0]??0,g=p?.degrees?.[1]??0;l[i+0]=_[r?.phase]??2,l[i+1]=a.length,l[i+2]=Number(o.min),l[i+3]=Number(o.max),l[i+4]=c,l[i+5]=f,l[i+6]=h,l[i+7]=g,l[i+8]=u,l[i+9]=m?d:-1,l[i+10]=Number(p?.maxRelativeError??0),l[i+11]=Number(p?.uncertaintyBound??0),l[i+12]=v[r?.accuracyTier]??2,l[i+13]=Number(t),l[i+14]=p?p.valid?p.valueTransform===`exp`?2:1:0:1,l[i+15]=parseInt(String(r?.invalidationKey||`0`).slice(0,6),16)||0;for(let e of a)l[u+0]=Number(e.a?.[0]??0),l[u+1]=Number(e.a?.[1]??0),l[u+2]=Number(e.b??0),l[u+3]=Math.max(1e-6,Number(e.scale??1)),u+=4;m&&m.length>0&&(l.set(m,d),d+=m.length)}return Object.freeze({schema:i,polytopeCount:n.length,totalFacets:r,totalCoeffs:a,data:l})}function b(e=[]){let t=Array.isArray(e)?e.filter(e=>e&&Number.isFinite(Number(e.materialId))):[],n=[],r=0;for(let e=0;e<t.length;e+=1){let i=t[e],a=i.packedGpuAtlas?.data instanceof Float32Array?i.packedGpuAtlas:y(i.polytopes||[],{materialIndex:e});n.push({materialId:Number(i.materialId),materialKey:String(i.materialKey||``),tierCode:v[i.accuracyTier]??2,packed:a}),r+=a.data.length}let i=4+n.length*4,o=Math.max(16,i+r),s=new Float32Array(o);s[0]=n.length,s[1]=1,s[2]=0,s[3]=0;let c=i;for(let e=0;e<n.length;e+=1){let t=n[e],r=4+e*4;s[r+0]=t.materialId,s[r+1]=c,s[r+2]=t.packed.polytopeCount,s[r+3]=t.tierCode,s.set(t.packed.data,c),c+=t.packed.data.length}return Object.freeze({schema:a,materialCount:n.length,totalFloats:o,data:s})}var x=`
fn polytope_clenshaw_1d(atlas: ptr<storage, array<f32>, read>, u: f32, base: u32, count: u32) -> f32 {
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u = 2.0 * u;
  for (var step = 0u; step < count; step = step + 1u) {
    let k = count - 1u - step;
    if (k == 0u) {
      return (*atlas)[base] + u * b1 - b2;
    }
    let b0 = (*atlas)[base + k] + two_u * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

fn eval_polytope_atlas_2d_at(
  atlas: ptr<storage, array<f32>, read>,
  base_off: u32,
  temperature_k: f32,
  pressure_pa: f32
) -> vec4<f32> {
  let count = u32((*atlas)[base_off]);
  if (count == 0u || !(pressure_pa > 0.0) || !(temperature_k > 0.0)) {
    return vec4<f32>(0.0, -1.0, -1.0, 0.0);
  }
  let log_p = log2(pressure_pa) * 0.3010299956639812;
  var best_idx = 0xffffffffu;
  var best_margin = -1.0e30;
  for (var i = 0u; i < count; i = i + 1u) {
    let r = base_off + 4u + i * 16u;
    if ((*atlas)[r + 14u] < 0.5) { continue; }
    let facet_count = u32((*atlas)[r + 1u]);
    let facet_off = base_off + u32((*atlas)[r + 8u]);
    var inside = true;
    var min_margin = 1.0e30;
    for (var f = 0u; f < facet_count; f = f + 1u) {
      let fo = facet_off + f * 4u;
      let a_t = (*atlas)[fo + 0u];
      let a_lp = (*atlas)[fo + 1u];
      let b_val = (*atlas)[fo + 2u];
      let sc = max(1.0e-6, (*atlas)[fo + 3u]);
      let slack = b_val - (a_t * temperature_k + a_lp * log_p);
      if (slack < 0.0) {
        inside = false;
        break;
      }
      min_margin = min(min_margin, slack / sc);
    }
    if (inside && min_margin > best_margin) {
      best_margin = min_margin;
      best_idx = i;
    }
  }
  if (best_idx == 0xffffffffu) {
    return vec4<f32>(0.0, -1.0, -1.0, 0.0);
  }
  let r = base_off + 4u + best_idx * 16u;
  let phase_code = (*atlas)[r + 0u];
  let coeff_off_f = (*atlas)[r + 9u];
  if (coeff_off_f < 0.0) {
    return vec4<f32>(0.0, best_margin, phase_code, 1.0);
  }
  let t_min = (*atlas)[r + 2u];
  let t_max = (*atlas)[r + 3u];
  let lp_min = (*atlas)[r + 4u];
  let lp_max = (*atlas)[r + 5u];
  let c0 = u32((*atlas)[r + 6u]) + 1u;
  let c1 = u32((*atlas)[r + 7u]) + 1u;
  let coeff_off = base_off + u32(coeff_off_f);
  let u0 = clamp(2.0 * (temperature_k - t_min) / max(t_max - t_min, 1.0e-30) - 1.0, -1.0, 1.0);
  let u1 = clamp(2.0 * (log_p - lp_min) / max(lp_max - lp_min, 1.0e-30) - 1.0, -1.0, 1.0);
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u0 = 2.0 * u0;
  var val = 0.0;
  for (var step = 0u; step < c0; step = step + 1u) {
    let k0 = c0 - 1u - step;
    let row_val = polytope_clenshaw_1d(atlas, u1, coeff_off + k0 * c1, c1);
    if (k0 == 0u) {
      val = row_val + u0 * b1 - b2;
    } else {
      let b0 = row_val + two_u0 * b1 - b2;
      b2 = b1;
      b1 = b0;
    }
  }
  let valid_mode = (*atlas)[r + 14u];
  let out_val = select(val, exp(clamp(val, -80.0, 80.0)), valid_mode > 1.5);
  return vec4<f32>(out_val, best_margin, phase_code, 1.0);
}

fn eval_polytope_atlas_2d(
  atlas: ptr<storage, array<f32>, read>,
  temperature_k: f32,
  pressure_pa: f32
) -> vec4<f32> {
  return eval_polytope_atlas_2d_at(atlas, 0u, temperature_k, pressure_pa);
}

fn eval_polytope_atlas_bank_2d(
  atlas: ptr<storage, array<f32>, read>,
  material_id: f32,
  temperature_k: f32,
  pressure_pa: f32
) -> vec4<f32> {
  let mat_count = u32((*atlas)[0u]);
  if (mat_count == 0u || !(pressure_pa > 0.0) || !(temperature_k > 0.0)) {
    return vec4<f32>(0.0, -1.0, -1.0, 0.0);
  }
  for (var m = 0u; m < mat_count; m = m + 1u) {
    let d = 4u + m * 4u;
    if (abs((*atlas)[d + 0u] - material_id) < 0.5) {
      let base_off = u32((*atlas)[d + 1u]);
      return eval_polytope_atlas_2d_at(atlas, base_off, temperature_k, pressure_pa);
    }
  }
  return vec4<f32>(0.0, -1.0, -1.0, 0.0);
}
`,S=`peercompute.ulg.law-adapter-contract.v1`,C=Object.freeze({CELL_LOCAL:`cell-local`,EXACT_NEAR:`exact-near`,CROSS_LEVEL:`cross-level`,AGGREGATE_FAR:`aggregate-far`,SOLID_PROXY:`solid-proxy`,SURFACE_INTERFACE:`surface-interface`,GLOBAL_REDUCTION:`global-reduction`}),w=new Set(Object.values(C)),T=Object.freeze({CANONICAL_SS_EPOCH:`canonical-ss-epoch`,LEGACY_PRIVATE_GRID:`legacy-private-grid`}),E=new Set(Object.values(T)),D=Object.freeze({STRICT:`strict`,ASYNC:`async`,FROZEN:`frozen`,EXACT_SUBSTEP:`exact-substep`,DIRECT_PAIR:`direct-pair`,DORMANT_SKIP:`dormant-skip`,FAIL_CLOSED:`fail-closed`}),O=new Set(Object.values(D)),k=Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`,`exact-energy-ledger`,`exact-mass-ledger`,`solid-rigid-frames`]);function A(e){return Array.isArray(e)?[...new Set(e.map(e=>String(e??``).trim()).filter(Boolean))]:[]}function j(e,{requireExtendedMetadata:t=!1}={}){let n=[],r=[];if(!e||typeof e!=`object`)return Object.freeze({valid:!1,errors:Object.freeze([`law-adapter-not-object`]),debt:Object.freeze([])});let i=String(e.id??e.lawId??``).trim();i||n.push(`law-adapter-missing-id`),A(e.reads);let a=A(e.writes),o=A(e.accumulates),s=new Set(a);for(let e of o)s.has(e)&&n.push(`stage-writes-and-accumulates-same-resource:${i||`unknown`}:${e}`);if((e.adapterMode!==void 0||t)&&(w.has(e.adapterMode)||n.push(`invalid-adapter-mode:${i||`unknown`}:${String(e.adapterMode)}`)),(e.fallbackPolicy!==void 0||t)&&(O.has(e.fallbackPolicy)||n.push(`invalid-fallback-policy:${i||`unknown`}:${String(e.fallbackPolicy)}`)),(e.spatialAuthority!==void 0||t)&&(E.has(e.spatialAuthority)?e.spatialAuthority===T.LEGACY_PRIVATE_GRID&&r.push(`legacy-private-grid:${i||`unknown`}`):n.push(`invalid-spatial-authority:${i||`unknown`}:${String(e.spatialAuthority)}`)),t){Array.isArray(e.conservedQuantities)||n.push(`missing-conserved-quantities:${i||`unknown`}`),(!e.validityDomain||typeof e.validityDomain!=`object`)&&n.push(`missing-validity-domain:${i||`unknown`}`);let t=e.pairedVolumeState;t!==`not-applicable`&&!(t&&typeof t==`object`&&typeof t.v0Lane==`string`&&typeof t.jLane==`string`)&&n.push(`invalid-paired-volume-state:${i||`unknown`}`)}return Object.freeze({valid:n.length===0,errors:Object.freeze(n),debt:Object.freeze(r)})}function M(e,{requireExtendedMetadata:t=!1,handoffCompatibleResources:n=k}={}){let r=[],i=[];if(!e||typeof e!=`object`||!Array.isArray(e.stages))return Object.freeze({schema:S,valid:!1,errors:Object.freeze([`fused-law-plan-invalid-structure`]),debt:Object.freeze([]),stageCount:0,exclusiveWritersByResource:Object.freeze({}),accumulatorsByResource:Object.freeze({})});let a=Array.isArray(e.requiredStageOrder)?e.requiredStageOrder:[],o=new Map(a.map((e,t)=>[e,t])),s=new Set(n),c=new Set,l=new Map,u=new Map;for(let n of e.stages){if(!n||typeof n!=`object`){r.push(`stage-entry-not-object`);continue}let e=String(n.id??n.lawId??``).trim();if(!e){r.push(`stage-missing-id`);continue}c.has(e)&&r.push(`duplicate-stage-id:${e}`),c.add(e),!t&&(!n.lawNodeId||!n.orderConstraint)&&r.push(`stage-missing-contract-metadata:${e}`);let a=j(n,{requireExtendedMetadata:t});for(let e of a.errors)r.push(e);for(let e of a.debt)i.push(e);let d=A(n.reads),f=A(n.writes),p=A(n.accumulates);for(let t of p)u.has(t)||u.set(t,[]),u.get(t).push(e);for(let t of f){l.has(t)||l.set(t,[]);let n=l.get(t);if(n.length>0){let i=o.get(e),a=o.get(n[n.length-1]);s.has(t)&&Number.isInteger(a)&&Number.isInteger(i)&&i>a&&d.includes(t)||r.push(`illegal-double-writer:${t}:${n[n.length-1]}+${e}`)}n.push(e)}}return Object.freeze({schema:S,valid:r.length===0,errors:Object.freeze(r),debt:Object.freeze(i),stageCount:e.stages.length,exclusiveWritersByResource:Object.freeze(Object.fromEntries([...l.entries()].map(([e,t])=>[e,Object.freeze([...t])]))),accumulatorsByResource:Object.freeze(Object.fromEntries([...u.entries()].map(([e,t])=>[e,Object.freeze([...t])])))})}function N(e,t={}){let n=M(e,t);if(!n.valid){let e=Error(`Invalid ULG law adapter schedule: ${n.errors.join(`, `)}`);throw e.code=`ERR_LAW_ADAPTER_SCHEDULE_INVALID`,e.validation=n,e}return n}var P=Object.freeze([Object.freeze({id:`mls-mpm-p2g`,lawNodeId:`law:mechanics-p2g`,orderConstraint:`before:mls-mpm-grid-update`,adapterMode:C.CELL_LOCAL,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([`mls-mpm-grid-momentum`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolume`,jLane:`mls-mpm-mechanics.F`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({cflMax:1,requiresFiniteF:!0}),fallbackPolicy:D.EXACT_SUBSTEP}),Object.freeze({id:`mls-mpm-grid-update`,lawNodeId:`law:mechanics-grid-update`,orderConstraint:`after:mls-mpm-p2g`,adapterMode:C.CELL_LOCAL,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`mls-mpm-grid-velocity`,`mls-mpm-grid-momentum`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`linear-momentum`]),validityDomain:Object.freeze({finiteGravity:!0}),fallbackPolicy:D.FAIL_CLOSED}),Object.freeze({id:`implicit-pressure-solve`,lawNodeId:`law:implicit-pressure-projection`,orderConstraint:`after:mls-mpm-grid-update`,adapterMode:C.CELL_LOCAL,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([`implicit-pressure-cg-scratch`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`linear-momentum`,`incompressibility-divergence`]),validityDomain:Object.freeze({cavitationFloorGaugePa:0,eshkolStiffnessDomain:Object.freeze([.9,1.1])}),fallbackPolicy:D.DORMANT_SKIP}),Object.freeze({id:`mls-mpm-g2p`,lawNodeId:`law:mechanics-g2p`,orderConstraint:`after:implicit-pressure-solve`,adapterMode:C.CELL_LOCAL,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`]),writes:Object.freeze([`sph-particle-state`,`mls-mpm-mechanics`]),accumulates:Object.freeze([]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`]),validityDomain:Object.freeze({maxDisplacementCells:1}),fallbackPolicy:D.EXACT_SUBSTEP}),Object.freeze({id:`thermal-conduction-radiation`,lawNodeId:`law:thermal-conduction-radiation`,orderConstraint:`after:mls-mpm-g2p`,adapterMode:C.EXACT_NEAR,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-energy-ledger`]),writes:Object.freeze([`sph-thermo-phase`,`exact-energy-ledger`]),accumulates:Object.freeze([`thermal-flux-proposals`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`internal-energy-minus-entropy-2e-149`]),validityDomain:Object.freeze({temperatureMinK:.001,usesG6Uncertainty:!0}),fallbackPolicy:D.DORMANT_SKIP}),Object.freeze({id:`reaction-discovery-apply`,lawNodeId:`law:chemistry-reaction`,orderConstraint:`after:thermal-conduction-radiation`,adapterMode:C.EXACT_NEAR,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([`reaction-proposals`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass-2e-149`,`atoms`,`internal-energy-2e-149`]),validityDomain:Object.freeze({requiresBalancedStoichiometry:!0}),fallbackPolicy:D.DORMANT_SKIP}),Object.freeze({id:`phase-carrier-transfer`,lawNodeId:`law:phase-change`,orderConstraint:`after:reaction-discovery-apply`,adapterMode:C.CELL_LOCAL,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolume`,jLane:`mls-mpm-mechanics.F`}),conservedQuantities:Object.freeze([`mass-2e-149`,`internal-energy-2e-149`,`linear-momentum`]),validityDomain:Object.freeze({usesPhaseWindowsAndG6Uncertainty:!0}),fallbackPolicy:D.DORMANT_SKIP}),Object.freeze({id:`phase-slot-refinement`,lawNodeId:`law:dynamic-material-volume-lod`,orderConstraint:`after:phase-carrier-transfer`,adapterMode:C.SURFACE_INTERFACE,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([`phase-slot-refinement-evidence`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`mass-2e-149`,`internal-energy-minus-entropy-2e-149`,`linear-momentum`,`first-moment`,`represented-volume`]),validityDomain:Object.freeze({fluidLanes:Object.freeze([1,2]),requiresStateManagerAdmission:!0}),fallbackPolicy:D.DORMANT_SKIP}),Object.freeze({id:`coherent-solids-rigid-and-coupling`,lawNodeId:`law:coherent-solids`,orderConstraint:`after:phase-slot-refinement`,adapterMode:C.SOLID_PROXY,spatialAuthority:T.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`sph-particle-state`,`sph-thermo-phase`]),writes:Object.freeze([`solid-rigid-frames`,`sph-particle-state`,`sph-thermo-phase`]),accumulates:Object.freeze([`solid-impulse-ledger`]),pairedVolumeState:Object.freeze({v0Lane:`solid-members.restVolume`,jLane:`solid-frames.pose`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`internal-energy`]),validityDomain:Object.freeze({requiresNonDegenerateInertia:!0}),fallbackPolicy:D.FAIL_CLOSED})]),F=globalThis.GPUShaderStage?.COMPUTE??4;function I(e,t,{visibility:n=F,uniformBindings:r=[]}={}){let i=j(e);if(!i.valid){let e=Error(`Cannot derive bind-group layout for invalid law descriptor: ${i.errors.join(`, `)}`);throw e.code=`ERR_LAW_DESCRIPTOR_INVALID`,e}if(!t||typeof t!=`object`)throw TypeError(`resourceBindingTable must map resource names to non-negative integer binding indices`);let a=A(e.reads),o=A(e.writes),s=A(e.accumulates),c=new Set([...o,...s]),l=[...new Set([...a,...o,...s])],u=new Map;for(let r of l){let i=t[r];if(!Number.isSafeInteger(i)||i<0){let t=RangeError(`Law "${e.id}" declares resource "${r}" which has no valid binding index in resourceBindingTable`);throw t.code=`ERR_LAW_BINDING_MISSING`,t}if(u.has(i)){let t=Error(`Law "${e.id}" binding index ${i} collision between "${u.get(i).resource}" and "${r}"`);throw t.code=`ERR_LAW_BINDING_COLLISION`,t}u.set(i,{resource:r,entry:Object.freeze({binding:i,visibility:n,buffer:Object.freeze({type:c.has(r)?`storage`:`read-only-storage`})})})}for(let t of r){let r=typeof t==`number`?t:t?.binding,i=typeof t==`object`&&t?.minBindingSize>0?t.minBindingSize:void 0;if(!Number.isSafeInteger(r)||r<0)throw RangeError(`Law "${e.id}" uniform binding index must be a non-negative integer`);if(u.has(r)){let t=Error(`Law "${e.id}" uniform binding ${r} collides with storage resource "${u.get(r).resource}"`);throw t.code=`ERR_LAW_BINDING_COLLISION`,t}u.set(r,{resource:`uniform:${r}`,entry:Object.freeze({binding:r,visibility:n,buffer:Object.freeze({type:`uniform`,...i===void 0?{}:{minBindingSize:i}})})})}let d=[...u.entries()].sort((e,t)=>e[0]-t[0]).map(([,e])=>e.entry);return Object.freeze(d)}function L(e,t,n,r={}){let i=I(e,t,r);if(!Array.isArray(n))throw TypeError(`Law "${e.id}": boundEntries must be an array`);let a=i.map(e=>e.binding),o=n.map(e=>e?.binding),s=new Set(o);if(s.size!==n.length){let t=Error(`Law "${e.id}": duplicate binding index in bind-group entries`);throw t.code=`ERR_LAW_BIND_GROUP_DUPLICATE`,t}let c=a.filter(e=>!s.has(e)),l=o.filter(e=>!a.includes(e));if(c.length>0||l.length>0){let t=Error(`Law "${e.id}": bind-group mismatch (missing=[${c.join(`,`)}], extra=[${l.join(`,`)}])`);throw t.code=`ERR_LAW_BIND_GROUP_MISMATCH`,t.missing=Object.freeze(c),t.extra=Object.freeze(l),t}return i}var R=`ulg.gpumath.batched-symmetric-eigensolver.v1`,z=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),B=`
struct EigenParams {
  n: u32,
  batch_count: u32,
  max_sweeps: u32,
  stride: u32, // n * n
  tol: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: EigenParams;
// In-place symmetric matrices A (length = batch_count * n * n); diagonal holds sorted eigenvalues on exit.
@group(0) @binding(1) var<storage, read_write> a_mat: array<f32>;
// Output eigenvectors V (column-major columns: column j is eigenvector j -> v_mat[base + row * n + col]).
@group(0) @binding(2) var<storage, read_write> v_mat: array<f32>;
// Output sorted eigenvalues (length = batch_count * n).
@group(0) @binding(3) var<storage, read_write> eigvals: array<f32>;

var<workgroup> sh_c: f32;
var<workgroup> sh_s: f32;
var<workgroup> sh_skip: u32;
var<workgroup> sh_sweep_max: f32;
var<workgroup> sh_done: u32;

@compute @workgroup_size(64)
fn jacobi_symmetric_batched(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = wg_id.x;
  if (b >= params.batch_count) { return; }
  let lid = local_id.x;
  let n = params.n;
  let stride = params.stride;
  let base = b * stride;

  // Initialize V = I cooperatively
  for (var idx = lid; idx < stride; idx = idx + 64u) {
    let r = idx / n;
    let c = idx % n;
    v_mat[base + idx] = select(0.0, 1.0, r == c);
  }
  if (lid == 0u) {
    sh_done = 0u;
  }
  workgroupBarrier();

  for (var sweep = 0u; sweep < params.max_sweeps; sweep = sweep + 1u) {
    if (lid == 0u) {
      sh_sweep_max = 0.0;
    }
    workgroupBarrier();

    for (var p = 0u; p + 1u < n; p = p + 1u) {
      for (var q = p + 1u; q < n; q = q + 1u) {
        if (lid == 0u) {
          let apq = a_mat[base + p * n + q];
          let abs_apq = abs(apq);
          if (abs_apq > sh_sweep_max) {
            sh_sweep_max = abs_apq;
          }
          if (sh_done != 0u || abs_apq <= params.tol) {
            sh_skip = 1u;
          } else {
            sh_skip = 0u;
            let app = a_mat[base + p * n + p];
            let aqq = a_mat[base + q * n + q];
            let tau = (aqq - app) / (2.0 * apq);
            let t = select(-1.0 / (-tau + sqrt(1.0 + tau * tau)), 1.0 / (tau + sqrt(1.0 + tau * tau)), tau >= 0.0);
            let c = 1.0 / sqrt(1.0 + t * t);
            let s = t * c;
            sh_c = c;
            sh_s = s;
          }
        }
        workgroupBarrier();

        if (sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          // Update off-diagonal rows/cols k != p, q in parallel
          for (var k = lid; k < n; k = k + 64u) {
            if (k != p && k != q) {
              let akp = a_mat[base + k * n + p];
              let akq = a_mat[base + k * n + q];
              let new_kp = c * akp - s * akq;
              let new_kq = s * akp + c * akq;
              a_mat[base + k * n + p] = new_kp;
              a_mat[base + p * n + k] = new_kp;
              a_mat[base + k * n + q] = new_kq;
              a_mat[base + q * n + k] = new_kq;
            }
            // Accumulate eigenvectors V = V * J
            let vkp = v_mat[base + k * n + p];
            let vkq = v_mat[base + k * n + q];
            v_mat[base + k * n + p] = c * vkp - s * vkq;
            v_mat[base + k * n + q] = s * vkp + c * vkq;
          }
        }
        workgroupBarrier();

        if (lid == 0u && sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          let app = a_mat[base + p * n + p];
          let aqq = a_mat[base + q * n + q];
          let apq = a_mat[base + p * n + q];
          let c2 = c * c;
          let s2 = s * s;
          let cs2 = 2.0 * c * s * apq;
          a_mat[base + p * n + p] = c2 * app - cs2 + s2 * aqq;
          a_mat[base + q * n + q] = s2 * app + cs2 + c2 * aqq;
          a_mat[base + p * n + q] = 0.0;
          a_mat[base + q * n + p] = 0.0;
        }
        workgroupBarrier();
      }
    }

    if (lid == 0u && sh_sweep_max <= params.tol) {
      sh_done = 1u;
    }
    workgroupBarrier();
  }

  // Extract eigenvalues and sort ascending along with eigenvector columns
  for (var i = lid; i < n; i = i + 64u) {
    eigvals[b * n + i] = a_mat[base + i * n + i];
  }
  workgroupBarrier();

  // Parallel column-swap selection sort (small N <= 256, deterministic)
  for (var i = 0u; i + 1u < n; i = i + 1u) {
    if (lid == 0u) {
      var min_j = i;
      var min_v = eigvals[b * n + i];
      for (var j = i + 1u; j < n; j = j + 1u) {
        let v = eigvals[b * n + j];
        if (v < min_v) {
          min_v = v;
          min_j = j;
        }
      }
      sh_skip = min_j;
      if (min_j != i) {
        eigvals[b * n + min_j] = eigvals[b * n + i];
        eigvals[b * n + i] = min_v;
      }
    }
    workgroupBarrier();
    let swap_j = sh_skip;
    if (swap_j != i) {
      for (var r = lid; r < n; r = r + 64u) {
        let tmp = v_mat[base + r * n + i];
        v_mat[base + r * n + i] = v_mat[base + r * n + swap_j];
        v_mat[base + r * n + swap_j] = tmp;
      }
    }
    workgroupBarrier();
  }
}
`,V=`
struct MulParams {
  n: u32,
  batch_count: u32,
  mode: u32, // 0: X = U * diag(1/sqrt(d)) * U^T, 1: out = A * B, 2: out = X * A * X (uses temp)
  stride: u32,
};

@group(0) @binding(0) var<uniform> params: MulParams;
@group(0) @binding(1) var<storage, read> lhs: array<f32>;
@group(0) @binding(2) var<storage, read> rhs: array<f32>;
@group(0) @binding(3) var<storage, read_write> out_mat: array<f32>;

@compute @workgroup_size(64)
fn mat_op(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.batch_count * params.stride;
  if (idx >= total) { return; }
  let b = idx / params.stride;
  let local = idx % params.stride;
  let n = params.n;
  let r = local / n;
  let c = local % n;
  let base = b * params.stride;
  var acc = 0.0;
  if (params.mode == 0u) {
    // lhs = eigenvectors U, rhs = eigenvalues d (length batch*n)
    for (var k = 0u; k < n; k = k + 1u) {
      let dk = max(rhs[b * n + k], 1.0e-12);
      acc = acc + lhs[base + r * n + k] * (1.0 / sqrt(dk)) * lhs[base + c * n + k];
    }
  } else {
    // out = lhs * rhs
    for (var k = 0u; k < n; k = k + 1u) {
      acc = acc + lhs[base + r * n + k] * rhs[base + k * n + c];
    }
  }
  out_mat[idx] = acc;
}
`;async function H(n,{matrices:r,n:i,batchCount:a=1,maxSweeps:o=32,tolerance:s=1e-6,keepResident:c=!1}={}){if(!n||typeof n.createBuffer!=`function`)throw TypeError(`solveSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let l=Math.trunc(Number(i)),u=Math.max(1,Math.trunc(Number(a)));if(!(l>=1&&l<=256))throw RangeError(`Unsupported matrix dimension n=${l} (expected 1..256)`);let d=l*l,f=u*d,p=r instanceof Float32Array?r:Float32Array.from(r);if(p.length!==f)throw RangeError(`Expected ${f} matrix floats for batch=${u}, n=${l}; got ${p.length}`);let m=t(n,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:B,entryPoint:`jacobi_symmetric_batched`,bindings:[e(0,`uniform`),e(1,`storage`),e(2,`storage`),e(3,`storage`)]}),h=new ArrayBuffer(32);new Uint32Array(h,0,4).set([l,u,Math.max(1,Math.trunc(o)),d]),new Float32Array(h,16,4).set([Number(s),0,0,0]);let g=n.createBuffer({label:`ulg-gpumath-eig-params`,size:32,usage:z.UNIFORM|z.COPY_DST});n.queue.writeBuffer(g,0,h);let _=n.createBuffer({label:`ulg-gpumath-eig-a`,size:Math.max(16,f*4),usage:z.STORAGE|z.COPY_DST|z.COPY_SRC});n.queue.writeBuffer(_,0,p);let v=n.createBuffer({label:`ulg-gpumath-eig-v`,size:Math.max(16,f*4),usage:z.STORAGE|z.COPY_SRC}),y=n.createBuffer({label:`ulg-gpumath-eig-vals`,size:Math.max(16,u*l*4),usage:z.STORAGE|z.COPY_SRC}),b=n.createBindGroup({layout:m.bindGroupLayout,entries:[g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),x=n.createCommandEncoder({label:`ulg-gpumath-jacobi-eig`}),S=x.beginComputePass({label:`ulg-gpumath-jacobi-eig-pass`});if(S.setPipeline(m.pipeline),S.setBindGroup(0,b),S.dispatchWorkgroups(u),S.end(),c)return n.queue.submit([x.finish()]),g.destroy(),_.destroy(),Object.freeze({schema:R,backend:`webgpu`,n:l,batchCount:u,eigenvaluesBuffer:y,eigenvectorsBuffer:v,destroy(){y.destroy(),v.destroy()}});let C=n.createBuffer({label:`ulg-gpumath-eig-read-vals`,size:Math.max(16,u*l*4),usage:z.MAP_READ|z.COPY_DST}),w=n.createBuffer({label:`ulg-gpumath-eig-read-vecs`,size:Math.max(16,f*4),usage:z.MAP_READ|z.COPY_DST});x.copyBufferToBuffer(y,0,C,0,u*l*4),x.copyBufferToBuffer(v,0,w,0,f*4),n.queue.submit([x.finish()]);try{await Promise.all([C.mapAsync(z.MAP_READ),w.mapAsync(z.MAP_READ)]);let e=new Float32Array(C.getMappedRange().slice(0,u*l*4)),t=new Float32Array(w.getMappedRange().slice(0,f*4));return C.unmap(),w.unmap(),Object.freeze({schema:R,backend:`webgpu`,n:l,batchCount:u,eigenvalues:e,eigenvectors:t})}finally{for(let e of[g,_,v,y,C,w])e.destroy()}}async function U(n,{fockMatrices:r,overlapMatrices:i,n:a,batchCount:o=1,maxSweeps:s=32,tolerance:c=1e-6}={}){if(!n||typeof n.createBuffer!=`function`)throw TypeError(`solveGeneralizedSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let l=Math.trunc(Number(a)),u=Math.max(1,Math.trunc(Number(o))),d=l*l,f=u*d,p=r instanceof Float32Array?r:Float32Array.from(r),m=await H(n,{matrices:i instanceof Float32Array?i:Float32Array.from(i),n:l,batchCount:u,maxSweeps:s,tolerance:c,keepResident:!0}),h=t(n,{cacheKey:`ulg-gpumath-mat-op.v1`,label:`ulg-gpumath-mat-op`,code:V,entryPoint:`mat_op`,bindings:[e(0,`uniform`),e(1,`read-only-storage`),e(2,`read-only-storage`),e(3,`storage`)]}),g=t(n,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:B,entryPoint:`jacobi_symmetric_batched`,bindings:[e(0,`uniform`),e(1,`storage`),e(2,`storage`),e(3,`storage`)]}),_=e=>{let t=n.createBuffer({size:16,usage:z.UNIFORM|z.COPY_DST});return n.queue.writeBuffer(t,0,new Uint32Array(e)),t},v=_([l,u,0,d]),y=_([l,u,1,d]),b=new ArrayBuffer(32);new Uint32Array(b,0,4).set([l,u,s,d]),new Float32Array(b,16,4).set([c,0,0,0]);let x=n.createBuffer({size:32,usage:z.UNIFORM|z.COPY_DST});n.queue.writeBuffer(x,0,b);let S=Math.max(16,f*4),C=n.createBuffer({size:S,usage:z.STORAGE|z.COPY_DST});n.queue.writeBuffer(C,0,p);let w=n.createBuffer({size:S,usage:z.STORAGE}),T=n.createBuffer({size:S,usage:z.STORAGE}),E=n.createBuffer({size:S,usage:z.STORAGE}),D=n.createBuffer({size:S,usage:z.STORAGE}),O=n.createBuffer({size:S,usage:z.STORAGE|z.COPY_SRC}),k=n.createBuffer({size:Math.max(16,u*l*4),usage:z.STORAGE|z.COPY_SRC}),A=n.createBuffer({size:Math.max(16,u*l*4),usage:z.MAP_READ|z.COPY_DST}),j=n.createBuffer({size:S,usage:z.MAP_READ|z.COPY_DST}),M=(e,t)=>n.createBindGroup({layout:e,entries:t.map((e,t)=>({binding:t,resource:{buffer:e}}))}),N=M(h.bindGroupLayout,[v,m.eigenvectorsBuffer,m.eigenvaluesBuffer,w]),P=M(h.bindGroupLayout,[y,w,C,T]),F=M(h.bindGroupLayout,[y,T,w,E]),I=M(g.bindGroupLayout,[x,E,D,k]),L=M(h.bindGroupLayout,[y,w,D,O]),U=Math.ceil(f/64),W=n.createCommandEncoder({label:`ulg-gpumath-gen-eig`}),G=W.beginComputePass({label:`ulg-gpumath-gen-eig-pass`});G.setPipeline(h.pipeline),G.setBindGroup(0,N),G.dispatchWorkgroups(U),G.setBindGroup(0,P),G.dispatchWorkgroups(U),G.setBindGroup(0,F),G.dispatchWorkgroups(U),G.setPipeline(g.pipeline),G.setBindGroup(0,I),G.dispatchWorkgroups(u),G.setPipeline(h.pipeline),G.setBindGroup(0,L),G.dispatchWorkgroups(U),G.end(),W.copyBufferToBuffer(k,0,A,0,u*l*4),W.copyBufferToBuffer(O,0,j,0,f*4),n.queue.submit([W.finish()]);try{await Promise.all([A.mapAsync(z.MAP_READ),j.mapAsync(z.MAP_READ)]);let e=new Float32Array(A.getMappedRange().slice(0,u*l*4)),t=new Float32Array(j.getMappedRange().slice(0,f*4));return A.unmap(),j.unmap(),Object.freeze({schema:R,backend:`webgpu`,generalized:!0,n:l,batchCount:u,eigenvalues:e,eigenvectors:t})}finally{m.destroy();for(let e of[v,y,x,C,w,T,E,D,O,k,A,j])e.destroy()}}export{x as C,d as E,u as S,y as T,o as _,D as a,i as b,N as c,M as d,g as f,p as g,f as h,C as i,I as l,m,H as n,T as o,h as p,P as r,L as s,U as t,j as u,n as v,b as w,r as x,a as y};