import{At as e,Bd as t,Ff as n,Gd as r,Gn as i,It as a,Kd as o,Kn as s,Lt as c,Pt as l,Rt as u,Un as d,Vd as f,Wd as p,Wn as m,Zd as h,jn as g,ot as _,qd as v,qn as y,st as b,tf as x,vt as S,xt as C}from"./radiationClosure-DRvAgzCA.js";import{cancelQueueOrderedCleanupClaim as w,computeBufferBinding as T,createCachedExplicitComputePipeline as E,createQueueOrderedCleanupClaimIssuer as D,registerQueueOrderedCleanupClaim as ee,releaseSubmittedWorkCleanupQueueOrdered as O}from"../runtime/webgpuComputeLayout.js";var te=`canonical-contact-epoch-trust-wall-shell-v1`,ne=1e-6,k=1071494104;Object.freeze({revision:te,positionTrustDiameters:16,positionToleranceAbsoluteM:ne,positionToleranceEpsilonMultiplier:64,wallShellEuclideanUpperF32Bits:k});var A=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function j(e,t){return e>>>t|e<<32-t}function re(e){let t=e.length*8,n=Math.ceil((e.length+9)/64)*64,r=new Uint8Array(n);r.set(e),r[e.length]=128;let i=new DataView(r.buffer);i.setUint32(n-8,Math.floor(t/4294967296)),i.setUint32(n-4,t>>>0);let a=1779033703,o=3144134277,s=1013904242,c=2773480762,l=1359893119,u=2600822924,d=528734635,f=1541459225,p=new Uint32Array(64);for(let e=0;e<n;e+=64){for(let t=0;t<16;t+=1)p[t]=i.getUint32(e+t*4);for(let e=16;e<64;e+=1){let t=p[e-15],n=p[e-2],r=j(t,7)^j(t,18)^t>>>3,i=j(n,17)^j(n,19)^n>>>10;p[e]=p[e-16]+r+p[e-7]+i>>>0}let t=a,n=o,r=s,m=c,h=l,g=u,_=d,v=f;for(let e=0;e<64;e+=1){let i=j(h,6)^j(h,11)^j(h,25),a=h&g^~h&_,o=v+i+a+A[e]+p[e]>>>0,s=(j(t,2)^j(t,13)^j(t,22))+(t&n^t&r^n&r)>>>0;v=_,_=g,g=h,h=m+o>>>0,m=r,r=n,n=t,t=o+s>>>0}a=a+t>>>0,o=o+n>>>0,s=s+r>>>0,c=c+m>>>0,l=l+h>>>0,u=u+g>>>0,d=d+_>>>0,f=f+v>>>0}return[a,o,s,c,l,u,d,f].map(e=>e.toString(16).padStart(8,`0`)).join(``)}function ie(e,t){if(!(e instanceof Uint8Array))throw TypeError(`authority fingerprint input must be Uint8Array bytes`);if(typeof t!=`string`||t.length<1)throw TypeError(`authority fingerprint label must be nonempty`);return`sha256:${t}:${re(e)}`}function ae(e,t){if(typeof e!=`string`)throw TypeError(`authority fingerprint text must be a string`);return ie(new TextEncoder().encode(e),t)}function oe(e,t=`typed-array-content-v1`){if(!ArrayBuffer.isView(e))throw TypeError(`authority fingerprint input must be a typed array`);let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength);return[e.constructor?.name||`TypedArray`,e.byteLength,ie(n,t)].join(`:`)}var M=`peercompute.ulg.sph-reaction-motion-envelope.v2`,se=`peercompute.ulg.schroeder-spatial-reaction-activation-observation.v3`,ce=`ERR_ULG_REACTION_MOTION_ENVELOPE_WATCH_FATAL`,N=4294967295,P=`canonical-reaction-motion-envelope-cfl-separation-contact-thermal-phase-latch-v3`,F=`reactant-pair-material-phase-temperature-with-cfl-separation-contact-and-thermal-phase-latch`,le=`f32-cuberoot-wall-shell-contact-trust-position-store-and-thermal-phase-latch-v5`,I=`terminal-exact-when-static-trigger-positive-before-evolution`,ue=`target-horizon-thermal-phase-rest-volume-trigger-positive-v1`,L=`all-fixed-phase-carrier-slots`,de=`terminal-upper-under-declared-no-writer-premise`,R=`future-upper-unclaimed-trigger-positive`,z=16777215,fe=z,B=new Float32Array(1),pe=new Uint32Array(B.buffer),V=(pe[0]=2139095039,B[0]),me=`dt>=0;max(g2p,separation,canonicalContactTrust)+K*positionStoreRounding(maxAbsPosition,contactRadius,physicalReach)`,he=`active-terminal-position-inside-sealed-physical-box`,ge=`terminal-upper-only-with-no-rest-volume-writer-else-trigger-positive`;function _e(e){return Number.isFinite(e)&&Math.abs(e)<V}function ve(e,t,n=`reactionTable`){if(!(e instanceof Float32Array))throw TypeError(`${n} records must be a Float32Array`);if(!Number.isSafeInteger(t)||t<1||t>16777215)throw RangeError(`${n}.reactionCount must be an exact positive f32 integer`);let r=t*12;if(e.length<r)throw RangeError(`${n} does not contain every reaction header`);for(let r=0;r<t;r+=1){let t=r*12;for(let i=0;i<12;i+=1)if(!_e(e[t+i]))throw TypeError(`${n} reaction ${r} contains a non-finite motion-watch operand`);let i=e[t+8];if(![1,254,255].includes(i))throw TypeError(`${n} reaction ${r} has an unrecognized row status`);if(i!==1)continue;let a=e[t],o=e[t+1],s=e[t+2],c=e[t+3],l=e[t+5],u=e[t+6],d=e[t+7],f=e=>Number.isInteger(e)&&e>=0&&e<=fe,p=e=>Number.isInteger(e)&&e>=0&&e<=2147483647,m=Math.fround(l*l);if(!f(a)||!f(o)||a===o||!f(s)||c<0||l<0||!_e(m)||!p(u)||!p(d))throw TypeError(`${n} reaction ${r} violates the active motion-watch rule contract`)}return!0}function ye(e,t){if(typeof e!=`number`||!Number.isFinite(e)||e<=0)throw RangeError(`${t} must be a positive finite number`);B[0]=e;let n=B[0];if(!Number.isFinite(n)||n<=0||Math.abs(n)>=V)throw RangeError(`${t} must remain positive in the admitted finite f32 domain`);return Object.freeze({value:n,bits:pe[0]>>>0})}function H(e,t){if(typeof e!=`number`||!Number.isFinite(e)||e<0)throw RangeError(`${t} must be a nonnegative finite number`);B[0]=e;let n=B[0];if(!Number.isFinite(n)||n<0||Math.abs(n)>=V)throw RangeError(`${t} must remain nonnegative in the admitted finite f32 domain`);return Object.freeze({value:n,bits:pe[0]>>>0})}function be(e){if(typeof e!=`number`||!Number.isSafeInteger(e)||e<1||e>128)throw RangeError(`maxFutureSubsteps must be an integer in [1, 128]`);return e}function xe(e){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`boxDimsM must contain exactly three dimensions`);if(e.length!==3)throw RangeError(`boxDimsM must contain exactly three dimensions`);let t=Array.from(e,(e,t)=>ye(e,`boxDimsM[${t}]`));return Object.freeze({values:Object.freeze(t.map(({value:e})=>e)),bits:Object.freeze(t.map(({bits:e})=>e))})}function Se(e){if(!e||typeof e!=`object`||Array.isArray(e))return!1;try{let t=Object.getPrototypeOf(e);return t===Object.prototype||t===null}catch{return!1}}function Ce({maxFutureSubsteps:e,dtS:t,gridSpacingM:n,cflFactor:r,boxDimsM:i,separationDisplacementEnabled:a=!0,contactCorrectionEnabled:o=!1,thermalPhaseEvolutionEnabled:s=!1}={}){let c=be(e),l=H(t,`dtS`),u=ye(n,`gridSpacingM`),d=ye(r,`cflFactor`),f=xe(i),p=ye(ne,`contactPositionToleranceAbsoluteM`);if(typeof a!=`boolean`)throw TypeError(`separationDisplacementEnabled must be a boolean`);if(typeof o!=`boolean`)throw TypeError(`contactCorrectionEnabled must be a boolean`);if(typeof s!=`boolean`)throw TypeError(`thermalPhaseEvolutionEnabled must be a boolean`);return Object.freeze({schema:M,status:`reaction-motion-envelope-sealed`,predicateRevision:P,numericSafetyRevision:le,maxFutureSubsteps:c,dtS:l.value,dtF32Bits:l.bits,gridSpacingM:u.value,gridSpacingF32Bits:u.bits,cflFactor:d.value,cflFactorF32Bits:d.bits,boxDimsM:f.values,boxDimsF32Bits:f.bits,separationDisplacementEnabled:a,contactCorrectionEnabled:o,thermalPhaseLatchRevision:ue,thermalPhaseEvolutionEnabled:s,thermalPhaseEvolutionPolicy:I,thermalPhaseLatchCountPolicy:L,contactMotionBoundRevision:te,contactPositionTrustDiameters:16,contactPositionToleranceAbsoluteM:p.value,contactPositionToleranceAbsoluteF32Bits:p.bits,contactPositionToleranceEpsilonMultiplier:64,wallShellEuclideanUpperF32Bits:k,terminalPositionDomain:he,futureRestDiameterPolicy:ge,futureRestDiameterBoundStatus:s?R:de,relativeReachFormula:me,conservativeSuperset:!0})}function we(e,t){if(!Se(e)||t&&!Object.isFrozen(e)||e.schema!==`peercompute.ulg.sph-reaction-motion-envelope.v2`||e.status!==`reaction-motion-envelope-sealed`||e.predicateRevision!==`canonical-reaction-motion-envelope-cfl-separation-contact-thermal-phase-latch-v3`||e.numericSafetyRevision!==`f32-cuberoot-wall-shell-contact-trust-position-store-and-thermal-phase-latch-v5`||e.relativeReachFormula!==me||e.terminalPositionDomain!==he||e.futureRestDiameterPolicy!==ge||e.thermalPhaseEvolutionPolicy!==`terminal-exact-when-static-trigger-positive-before-evolution`||e.thermalPhaseLatchRevision!==`target-horizon-thermal-phase-rest-volume-trigger-positive-v1`||e.thermalPhaseLatchCountPolicy!==`all-fixed-phase-carrier-slots`||e.futureRestDiameterBoundStatus!==(e.thermalPhaseEvolutionEnabled?`future-upper-unclaimed-trigger-positive`:`terminal-upper-under-declared-no-writer-premise`)||e.contactMotionBoundRevision!==`canonical-contact-epoch-trust-wall-shell-v1`||e.contactPositionTrustDiameters!==16||e.contactPositionToleranceEpsilonMultiplier!==64||e.wallShellEuclideanUpperF32Bits!==1071494104||e.conservativeSuperset!==!0||typeof e.separationDisplacementEnabled!=`boolean`||typeof e.contactCorrectionEnabled!=`boolean`||typeof e.thermalPhaseEvolutionEnabled!=`boolean`||!Array.isArray(e.boxDimsM)||e.boxDimsM.length!==3||!Array.isArray(e.boxDimsF32Bits)||e.boxDimsF32Bits.length!==3||t&&(!Object.isFrozen(e.boxDimsM)||!Object.isFrozen(e.boxDimsF32Bits)))return!1;try{let t=Ce(e),n=Object.keys(e).sort(),r=Object.keys(t).sort();return n.length===r.length&&n.every((e,t)=>e===r[t])&&t.maxFutureSubsteps===e.maxFutureSubsteps&&t.dtS===e.dtS&&t.dtF32Bits===e.dtF32Bits&&t.gridSpacingM===e.gridSpacingM&&t.gridSpacingF32Bits===e.gridSpacingF32Bits&&t.cflFactor===e.cflFactor&&t.cflFactorF32Bits===e.cflFactorF32Bits&&t.boxDimsM.every((t,n)=>t===e.boxDimsM?.[n])&&t.boxDimsF32Bits.every((t,n)=>t===e.boxDimsF32Bits?.[n])&&t.separationDisplacementEnabled===e.separationDisplacementEnabled&&t.contactCorrectionEnabled===e.contactCorrectionEnabled&&t.thermalPhaseEvolutionEnabled===e.thermalPhaseEvolutionEnabled&&t.contactPositionToleranceAbsoluteM===e.contactPositionToleranceAbsoluteM&&t.contactPositionToleranceAbsoluteF32Bits===e.contactPositionToleranceAbsoluteF32Bits}catch{return!1}}function Te(e){return we(e,!0)}function Ee(e){return we(e,!1)}function U(e,t,n=`boxDimsM`){if(!Te(e))throw TypeError(`box comparison requires an exact sealed envelope`);let r=xe(t);if(!r.bits.every((t,n)=>t===e.boxDimsF32Bits[n]))throw RangeError(`${n} does not bit-match the sealed reaction motion envelope`);return r.values}var De=`
const REACTION_MOTION_F32_MAX_BITS: u32 = 0x7f7fffffu;
const REACTION_MOTION_UPWARD_ULPS: u32 = 64u;
const REACTION_MOTION_ROUNDING_PER_SUBSTEP: f32 = 0.000003814697265625;
const REACTION_MOTION_F32_EPSILON: f32 = 1.1920928955078125e-7;
const REACTION_MOTION_CONTACT_TRUST_DIAMETERS: f32 =
  16.0;
const REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M: f32 =
  ${ne};
const REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER: f32 =
  64.0;
const REACTION_MOTION_SQRT_THREE_UPPER: f32 = bitcast<f32>(
  ${k}u
);

fn reaction_motion_finite(value: f32) -> bool {
  // Reserve the largest finite f32 bit pattern as an in-band arithmetic
  // failure marker. WGSL validation rejects a constant-expression infinity,
  // while this value is portable and every watch treats it as non-finite.
  return (bitcast<u32>(value) & 0x7fffffffu)
    < REACTION_MOTION_F32_MAX_BITS;
}

fn reaction_motion_vec4_finite(value: vec4<f32>) -> bool {
  return all(vec4<bool>(
    reaction_motion_finite(value.x),
    reaction_motion_finite(value.y),
    reaction_motion_finite(value.z),
    reaction_motion_finite(value.w)
  ));
}

fn reaction_motion_upward(value: f32) -> f32 {
  if (!(value > 0.0) || !reaction_motion_finite(value)) {
    return value;
  }
  let bits = bitcast<u32>(value);
  if (bits > REACTION_MOTION_F32_MAX_BITS - REACTION_MOTION_UPWARD_ULPS) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  return bitcast<f32>(bits + REACTION_MOTION_UPWARD_ULPS);
}

fn reaction_motion_ceil_div_3(value: i32) -> i32 {
  if (value >= 0) {
    return (value + 2) / 3;
  }
  return -((-value) / 3);
}

fn reaction_motion_rest_diameter_upper(rest_volume_m3: f32) -> f32 {
  if (!(rest_volume_m3 > 0.0) || !reaction_motion_finite(rest_volume_m3)) {
    return 0.0;
  }
  // The mechanics separation kernel evaluates cbrt(max(V, 1e-18)). For a
  // positive normal f32 with unbiased exponent e, V < 2^(e+1), hence
  // cbrt(V) < 2^ceil((e+1)/3). Constructing that power directly avoids an
  // implementation-dependent pow underestimate in the safety envelope.
  // max(V, 1e-18) is normal, so no subnormal exponent branch is required.
  let bounded_volume = max(rest_volume_m3, 1.0e-18);
  let volume_bits = bitcast<u32>(bounded_volume);
  let unbiased_exponent = i32((volume_bits >> 23u) & 0xffu) - 127;
  let upper_exponent = reaction_motion_ceil_div_3(unbiased_exponent + 1);
  let upper_exponent_bits = u32(upper_exponent + 127) << 23u;
  return reaction_motion_upward(bitcast<f32>(upper_exponent_bits));
}

fn reaction_motion_box_dims_admitted(box_dims_m: vec3<f32>) -> bool {
  return all(vec3<bool>(
    reaction_motion_finite(box_dims_m.x) && box_dims_m.x > 0.0,
    reaction_motion_finite(box_dims_m.y) && box_dims_m.y > 0.0,
    reaction_motion_finite(box_dims_m.z) && box_dims_m.z > 0.0
  ));
}

fn reaction_motion_position_inside_box(
  position_m: vec3<f32>,
  box_dims_m: vec3<f32>
) -> bool {
  return reaction_motion_box_dims_admitted(box_dims_m)
    && all(position_m >= vec3<f32>(0.0))
    && all(position_m <= box_dims_m);
}

fn reaction_motion_wall_shell_transition_upper(
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>
) -> f32 {
  let minimum_box_dimension_m = min(
    box_dims_m.x,
    min(box_dims_m.y, box_dims_m.z)
  );
  let grid_clearance_upper_m = reaction_motion_upward(
    0.5 * reaction_motion_upward(grid_spacing_m)
  );
  let box_clearance_upper_m = reaction_motion_upward(
    0.49 * reaction_motion_upward(minimum_box_dimension_m)
  );
  let axis_shell_upper_m = min(
    grid_clearance_upper_m,
    box_clearance_upper_m
  );
  return reaction_motion_upward(
    REACTION_MOTION_SQRT_THREE_UPPER * axis_shell_upper_m
  );
}

fn reaction_motion_position_store_rounding_upper(
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32,
  physical_relative_reach_m: f32,
  max_future_substeps: u32
) -> f32 {
  let position_scale_m = reaction_motion_upward(
    reaction_motion_upward(max_abs_position_m)
      + reaction_motion_upward(maximum_contact_radius_m)
      + reaction_motion_upward(physical_relative_reach_m)
  );
  if (!(position_scale_m > 0.0) || !reaction_motion_finite(position_scale_m)) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  let scale_bits = bitcast<u32>(position_scale_m);
  let exponent_bits = (scale_bits >> 23u) & 0xffu;
  // One exact power-of-two quantum at eight f32 ULPs of the enclosing
  // coordinate binade covers both 3-D endpoints, their store additions, and
  // the later distance arithmetic. Clamp tiny coordinates to the minimum
  // normal quantum; this is deliberately loose and remains finite.
  var rounding_quantum_m = bitcast<f32>(0x00800000u);
  if (exponent_bits > 20u) {
    rounding_quantum_m = bitcast<f32>((exponent_bits - 20u) << 23u);
  }
  return reaction_motion_upward(
    reaction_motion_upward(f32(max_future_substeps))
      * rounding_quantum_m
  );
}

fn reaction_motion_relative_reach_upper(
  max_future_substeps: u32,
  cfl_factor: f32,
  grid_spacing_m: f32,
  max_rest_diameter_m: f32,
  separation_enabled: bool,
  contact_correction_enabled: bool,
  box_dims_m: vec3<f32>,
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32
) -> f32 {
  let advective_one_particle = reaction_motion_upward(
    reaction_motion_upward(cfl_factor) * reaction_motion_upward(grid_spacing_m)
  );
  let wall_shell_transition_m = reaction_motion_wall_shell_transition_upper(
    grid_spacing_m,
    box_dims_m
  );
  let g2p_one_particle = reaction_motion_upward(
    advective_one_particle + wall_shell_transition_m
  );
  let separation_one_particle = reaction_motion_upward(
    reaction_motion_upward(
      g2p_one_particle
        + reaction_motion_upward(0.5 * max_rest_diameter_m)
    ) + wall_shell_transition_m
  );
  let contact_trust_without_tolerance = reaction_motion_upward(
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TRUST_DIAMETERS * max_rest_diameter_m
    ) + reaction_motion_upward(
      2.0 * advective_one_particle
    ) + reaction_motion_upward(
      3.0 * wall_shell_transition_m
    )
  );
  let contact_tolerance_m = reaction_motion_upward(max(
    REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M,
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER
        * REACTION_MOTION_F32_EPSILON
        * max(contact_trust_without_tolerance, 1.0)
    )
  ));
  let contact_one_particle = reaction_motion_upward(
    contact_trust_without_tolerance + contact_tolerance_m
  );
  let one_particle_per_substep = max(
    g2p_one_particle,
    max(
      select(g2p_one_particle, separation_one_particle, separation_enabled),
      select(
        g2p_one_particle,
        contact_one_particle,
        contact_correction_enabled
      )
    )
  );
  let raw_relative = reaction_motion_upward(
    reaction_motion_upward(2.0 * f32(max_future_substeps))
      * one_particle_per_substep
  );
  let accumulated_rounding = reaction_motion_upward(
    1.0 + f32(max_future_substeps)
      * REACTION_MOTION_ROUNDING_PER_SUBSTEP
  );
  let physical_relative_reach = reaction_motion_upward(
    raw_relative * accumulated_rounding
  );
  let position_store_rounding = reaction_motion_position_store_rounding_upper(
    max_abs_position_m,
    maximum_contact_radius_m,
    physical_relative_reach,
    max_future_substeps
  );
  return reaction_motion_upward(
    physical_relative_reach + position_store_rounding
  );
}
`,Oe=`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`,ke=se,Ae=P,je=`canonical-reaction-exact-current-state-v1`,Me=`reaction-discovery`,Ne=`v12-zero-failure-biased-activation-watch`,Pe=Object.freeze([`partnerParticleIndex:f32`,`reactionIndex:f32`,`reactantRole:f32`,`distanceSquaredM2:f32`]),Fe=Object.freeze(`sourceDispatchCount:u32.directoryAdmissionCount:u32.directoryRejectionCount:u32.candidateVisitCount:u32.compatiblePairCount:u32.malformedTraversalCount:u32.proposalCount:u32.sealedRowCount:u32.sourceIdentityRejectionCount:u32.supportProfileId:u32.generationId:u32.supportEpoch:u32.particleCount:u32.reactionCount:u32.privateLookupBuildCount:u32.overflowCount:u32.ruleIndexPairLookupCount:u32.ruleIndexPairMissCount:u32.ruleIndexRuleVisitCount:u32.fullRuleScanRuleVisitCount:u32.maximumDisplacementBits:u32.displacementCertificateStatusBits:u32.authorityActiveCount:u32.currentActiveCount:u32.exactCellTreeNodeVisitCount:u32.exactCellTreeLeafVisitCount:u32.exactCellTreeMemberVisitCount:u32`.split(`.`)),W=64,Ie=3,Le=Ie*4,Re=z,G=96,ze=1065353216,Be=20,Ve=21,He=22,Ue=23,We=24,Ge=25,Ke=26,qe=N,Je=0,Ye=1,Xe=Uint32Array.BYTES_PER_ELEMENT,Ze=4*Uint32Array.BYTES_PER_ELEMENT,Qe=`peercompute.ulg.schroeder-spatial-reaction-rule-index.v1`,$e=0,et=1,tt=4,nt=4,rt=8,it=new WeakMap,at=new WeakMap,ot=new WeakMap,st=new WeakMap,K={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},ct={READ:globalThis.GPUMapMode?.READ??1};function lt(e){if(!e?.lost?.then)return null;let t=st.get(e);if(t)return t;t={observed:!1,promise:null},st.set(e,t);let n=()=>(t.observed=!0,`device-terminal`);return t.promise=Promise.resolve(e.lost).then(n,n),t}function ut(e,t){let n=e instanceof Error?e:Error(String(e));try{return Object.defineProperty(n,"reactionActivationObservationMapAsyncCount",{value:t,enumerable:!1,configurable:!1,writable:!1}),n}catch{let e=Error(n.message,{cause:n});return e.name=n.name,Object.defineProperty(e,"reactionActivationObservationMapAsyncCount",{value:t}),e}}function dt(e,t=Error){let n=e instanceof Error?e:new t(String(e));try{return Object.defineProperties(n,{code:{value:ce},reactionActivationObservationFatal:{value:!0}}),n}catch{let e=new t(n.message,{cause:n});return e.code=ce,e.reactionActivationObservationFatal=!0,e}}function ft(e,t,n=4294967295){if(typeof e!=`number`||!Number.isSafeInteger(e)||e<1||e>n)throw RangeError(`${t} must be an integer in [1, ${n}]`);return e}function pt(e,t){let n=e?.limits?.[t];if(typeof n!=`number`||!Number.isSafeInteger(n)||n<1)throw RangeError(`reaction discovery requires exact device.limits.${t}`);return n}function mt(e){let t=Object.freeze({maxBufferSize:pt(e,`maxBufferSize`),maxStorageBufferBindingSize:pt(e,`maxStorageBufferBindingSize`),maxUniformBufferBindingSize:pt(e,`maxUniformBufferBindingSize`),maxStorageBuffersPerShaderStage:pt(e,`maxStorageBuffersPerShaderStage`),maxComputeWorkgroupsPerDimension:pt(e,`maxComputeWorkgroupsPerDimension`)});if(t.maxStorageBuffersPerShaderStage<rt)throw RangeError(`reaction discovery requires eight storage buffers per shader stage`);return t}function ht(e,t,n=2**53-1){let r=1;for(let i of e){if(!Number.isSafeInteger(i)||i<1)throw RangeError(`${t} factors must be positive safe integers`);if(r>Math.floor(n/i))throw RangeError(`${t} exceeds its exact integer domain`);r*=i}return r}function gt(e,t){if(typeof e!=`number`||!Number.isFinite(e)||e<=0)throw RangeError(`${t} must be a positive finite number`);return e}function _t(e,t,n){return e?.active===!0&&typeof e.beginEncoderSpan==`function`&&typeof e.endEncoderSpan==`function`?e.beginEncoderSpan(t,n):null}function vt(e,t,n){n&&e.endEncoderSpan(t,n)}function yt(e,t,n){if(!t||i(t)!==e||!s(t,e))throw TypeError(`${n} must be a live buffer on the canonical generation device`);return t}function bt(e,t,n){if(!Number.isSafeInteger(t)||t<4)throw RangeError(`${n} requires an exact positive byte length`);if(typeof e?.size!=`number`||!Number.isSafeInteger(e.size)||e.size<t)throw RangeError(`${n} has ${String(e?.size)} bytes; ${t} required`);return e}function xt(e,t,n,r){return Ct(r,t,n),bt(e,t,n),St(r,e.size,n),e}function q(e,t){return{buffer:e,offset:0,size:t}}function St(e,t,n){if(!Number.isSafeInteger(t)||t<4)throw RangeError(`${n} byte length is not safely addressable`);if(t>e.maxBufferSize)throw RangeError(`${n} requires ${t} bytes; maxBufferSize is ${e.maxBufferSize}`);return t}function Ct(e,t,n){if(St(e,t,n),t>e.maxStorageBufferBindingSize)throw RangeError(`${n} requires ${t} bytes; maxStorageBufferBindingSize is ${e.maxStorageBufferBindingSize}`);return t}function wt(e,t,n){if(St(e,t,n),t>e.maxUniformBufferBindingSize)throw RangeError(`${n} requires ${t} bytes; maxUniformBufferBindingSize is ${e.maxUniformBufferBindingSize}`);return t}function Tt(e,t,n,r,i){St(t,r,n);let a=d(e.createBuffer({label:n,size:r,usage:i}),e);if(a?.size!==r){try{a?.destroy?.()}catch{}throw RangeError(`${n} was not created at its exact requested size`)}return a}function Et(e,t,n){St({maxBufferSize:t},e,n);let r=4;for(;r<e;){if(r>Math.floor(t/2))throw RangeError(`${n} cannot grow to an exact power-of-two capacity`);r*=2}return r}function Dt(e){let t=it.get(e);return t||(t=new Map,it.set(e,t)),t}function Ot({device:e,limits:t,generation:n,directoryAbiVersion:r,expectationBufferByteLength:i,proposalBytes:a,localReactionRecordBytes:o,observeGpuEvidence:s=!1,captureActivationObservation:c=!1}){let l=n?.execution?.arenaIndex;if(!Number.isInteger(l)||l<0)throw TypeError(`reaction discovery requires a canonical generation arena index`);if(r!==1&&r!==2)throw RangeError(`unsupported reaction discovery arena ABI version: ${r}`);if(!Number.isInteger(i)||i<4)throw RangeError(`reaction discovery expectation buffer byte length must be positive`);Ct(t,a,`reaction discovery proposal buffer`),Ct(t,27*Uint32Array.BYTES_PER_ELEMENT,`reaction discovery evidence buffer`),wt(t,i,`reaction discovery expectation buffer`),wt(t,G,`reaction discovery params buffer`),s===!0&&St(t,27*Uint32Array.BYTES_PER_ELEMENT,`reaction discovery evidence readback buffer`),c===!0&&(Ct(t,Ze,`reaction discovery activation control buffer`),St(t,Xe,`reaction discovery activation readback buffer`)),o>0&&Ct(t,o,`reaction discovery reaction record buffer`);let u=Dt(e),d=`${r}:${l}`,f=u.get(d)||null;if(f?.inUse===!0)if(f.generation?.execution?.released===!0){if(f.activationObservationLease===f.lease)throw Error(`reaction discovery arena ${l} remains pinned by a pending activation observation`);f.inUse=!1,f.generation=null,f.generationId=null,f.lease=null}else throw Error(`reaction discovery arena ${l} is already leased by generation ${f.generationId}`);if(f?.inUse===!1&&f.generation&&f.generation.execution?.released!==!0)throw Error(`reaction discovery arena ${l} remains quarantined by live generation ${f.generationId}`);let p=0;if((!f||f.destroyed===!0)&&(f={arenaKey:d,arenaIndex:l,directoryAbiVersion:r,expectationBufferByteLength:i,proposalBuffer:null,proposalCapacityBytes:0,evidenceBuffer:null,evidenceReadbackBuffer:null,activationObservationWordBuffer:null,activationObservationReadbackBuffer:null,expectationBuffer:null,paramsBuffer:null,reactionRecordBuffer:null,reactionRecordCapacityBytes:0,generation:null,generationId:null,inUse:!1,lease:null,activationObservationLease:null,destroyed:!1,totalBufferCreationCount:0,acquisitionCount:0},u.set(d,f)),f.directoryAbiVersion!==r||f.expectationBufferByteLength!==i)throw Error(`reaction discovery arena ${l} ABI identity mismatch`);f.proposalCapacityBytes<a&&(f.proposalBuffer?.destroy?.(),f.proposalCapacityBytes=Et(a,Math.min(t.maxBufferSize,t.maxStorageBufferBindingSize),`reaction discovery cached proposal buffer`),Ct(t,f.proposalCapacityBytes,`reaction discovery cached proposal buffer`),f.proposalBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-proposals-arena-${l}`,f.proposalCapacityBytes,K.STORAGE|K.COPY_SRC),p+=1),f.evidenceBuffer||(f.evidenceBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-evidence-arena-${l}`,27*Uint32Array.BYTES_PER_ELEMENT,K.STORAGE|K.COPY_SRC|K.COPY_DST),p+=1),s===!0&&!f.evidenceReadbackBuffer&&(f.evidenceReadbackBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-evidence-readback-arena-${l}`,27*Uint32Array.BYTES_PER_ELEMENT,K.MAP_READ|K.COPY_DST),p+=1),c===!0&&!f.activationObservationWordBuffer&&(f.activationObservationWordBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-activation-word-arena-${l}`,Ze,K.STORAGE|K.COPY_SRC|K.COPY_DST),p+=1),c===!0&&!f.activationObservationReadbackBuffer&&(f.activationObservationReadbackBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-activation-readback-arena-${l}`,Xe,K.MAP_READ|K.COPY_DST),p+=1),f.expectationBuffer||(f.expectationBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-expectation-v${r}-arena-${l}`,i,K.UNIFORM|K.COPY_DST),p+=1),f.paramsBuffer||(f.paramsBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-params-arena-${l}`,G,K.UNIFORM|K.COPY_DST),p+=1),o>0&&f.reactionRecordCapacityBytes<o&&(f.reactionRecordBuffer?.destroy?.(),f.reactionRecordCapacityBytes=Et(o,Math.min(t.maxBufferSize,t.maxStorageBufferBindingSize),`reaction discovery cached reaction record buffer`),Ct(t,f.reactionRecordCapacityBytes,`reaction discovery cached reaction record buffer`),f.reactionRecordBuffer=Tt(e,t,`ulg-schroeder-spatial-reaction-discovery-records-arena-${l}`,f.reactionRecordCapacityBytes,K.STORAGE|K.COPY_DST),p+=1);let m=Object.freeze({arenaIndex:l,generationId:n.execution.generationId,acquisitionOrdinal:f.acquisitionCount+1});return f.acquisitionCount+=1,f.totalBufferCreationCount+=p,f.inUse=!0,f.generation=n,f.generationId=n.execution.generationId,f.lease=m,f.activationObservationLease=c===!0?m:null,{entry:f,lease:m,bufferCreationCount:p}}function kt(e,t){return!e||e.lease!==t||e.inUse!==!0?!1:(e.inUse=!1,e.lease=null,e.activationObservationLease=null,!0)}function At(e,{device:t,generation:n,particleCount:r=n?.source?.sourceCount,reactionCount:i=e?.reactionCount,reactionTable:a=null,sourceStateBuffer:o=null,sourceThermoBuffer:c=null}={}){let l=(e,t)=>Object.freeze({schema:Oe,status:e,reason:t,ready:!1,admitted:!1}),u=at.get(e),d=null;try{d=a?oe(jt(a).combined,`reaction-table-combined-records-v2`):null}catch{return l(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`)}if(!u||u.proposal!==e||u.generation!==n||u.directoryAbiVersion!==n?.execution?.abiVersion||u.directoryAbiVersion!==e?.directoryAbiVersion||u.directoryBuffer!==n?.execution?.directoryBuffer||u.exactNearCellTree!==n?.exactNearCellTree||u.exactNearCellTree!==e?.exactNearCellTree||u.exactNearCellTreeBuffer!==e?.exactNearCellTreeBuffer||u.positionAuthorityStateBuffer!==(n?.source?.sourceStateBuffer??n?.source?.exactNearQueryProfile?.sourceStateBuffer)||u.sourceCurrentStateBuffer!==e?.sourceCurrentStateBuffer||u.sourceThermoBuffer!==e?.sourceThermoBuffer||!a||u.reactionTable!==a||u.reactionTableFingerprint!==d||u.reactionRecordBuffer!==e?.reactionRecordBuffer||u.reactionDiscoveryPayloadFingerprint!==e?.reactionDiscoveryPayloadFingerprint||u.reactionRuleIndex!==e?.reactionRuleIndex||u.displacementCertificateBuffer!==e?.displacementCertificateBuffer||!o||!c||u.sourceCurrentStateBuffer!==o||u.sourceThermoBuffer!==c||u.expectationBuffer!==e?.expectationBuffer||u.receipt!==e?.receipt)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`);if(e?.schema!==`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`||e.ready!==!0||e.released===!0)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-contract`,`reaction discovery proposal is not a live submitted v1 artifact`);if(e.consumerId!==`reaction-discovery`||e.supportProfileId!==65538||e.proposalRowStrideFloats!==4||e.traversalCount!==1||e.privateLookupBuildCount!==0||e.fixedCandidateBuildCount!==0||e.exhaustiveTraversalCount!==0||e.candidateBudget!==null||e.fullReadbackPerformed!==!1||e.directoryAbiVersion!==1&&e.directoryAbiVersion!==2||e.directoryAbiVersion!==n?.execution?.abiVersion)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-invariants`,`reaction discovery proposal violates the exact-near residency contract`);if(e.generation!==n||e.generationId!==n?.execution?.generationId||n?.execution?.released===!0||n?.releaseScheduled===!0)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-generation`,`reaction discovery proposal is not bound to the live consumer generation`);if(e.particleCount!==r||e.reactionCount!==i)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-count`,`reaction discovery proposal count does not match the chemistry consumer`);if(!b(e.receipt))return l(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt`,`reaction discovery proposal lacks an authentic finalized consumer receipt`);if(e.receipt.consumerId!==e.consumerId||e.receipt.supportProfileId!==e.supportProfileId||e.receipt.generationId!==e.generationId)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt-identity`,`reaction discovery receipt identity does not match the artifact`);if(!e.proposalBuffer||!e.evidenceBuffer||!e.reactionRecordBuffer||!e.directoryBuffer||!e.exactNearCellTree||!e.exactNearCellTreeBuffer||!e.expectationBuffer||!e.positionAuthorityStateBuffer||!e.sourceCurrentStateBuffer||!e.sourceThermoBuffer||!e.displacementCertificateBuffer||e.displacementCertificateBuffer!==e.evidenceBuffer||!s(e.proposalBuffer,t)||!s(e.evidenceBuffer,t)||!s(e.reactionRecordBuffer,t)||!s(e.directoryBuffer,t)||e.exactNearCellTree!==n?.exactNearCellTree||e.exactNearCellTree?.released===!0||e.exactNearCellTreeBuffer!==e.exactNearCellTree?.treeBuffer||!s(e.exactNearCellTreeBuffer,t)||!s(e.expectationBuffer,t)||!s(e.positionAuthorityStateBuffer,t)||!s(e.sourceCurrentStateBuffer,t)||!s(e.sourceThermoBuffer,t)||!s(e.displacementCertificateBuffer,t))return l(`schroeder-spatial-reaction-discovery-proposal-rejected-device`,`reaction discovery buffers do not belong to the consumer device`);let f=r*4*Float32Array.BYTES_PER_ELEMENT;return e.proposalBufferByteLength!==f||!Number.isSafeInteger(e.proposalBuffer.size)||e.proposalBuffer.size<f?l(`schroeder-spatial-reaction-discovery-proposal-rejected-capacity`,`reaction discovery proposal buffer is smaller than its authenticated row set`):Object.freeze({schema:Oe,status:`schroeder-spatial-reaction-discovery-proposal-admitted`,reason:null,ready:!0,admitted:!0,generation:n,proposalBuffer:e.proposalBuffer,evidenceBuffer:e.evidenceBuffer,reactionRecordBuffer:e.reactionRecordBuffer,directoryBuffer:e.directoryBuffer,exactNearCellTree:e.exactNearCellTree,exactNearCellTreeBuffer:e.exactNearCellTreeBuffer,expectationBuffer:e.expectationBuffer,positionAuthorityStateBuffer:e.positionAuthorityStateBuffer,sourceCurrentStateBuffer:e.sourceCurrentStateBuffer,sourceThermoBuffer:e.sourceThermoBuffer,displacementCertificateBuffer:e.displacementCertificateBuffer,particleCount:r,reactionCount:i,generationId:e.generationId,epochIdentity:e.epochIdentity,receipt:e.receipt})}function jt(e,{requireExactPrefixMirror:t=!1}={}){if(e?.schema!==`peercompute.ulg.sph-gpu-reaction-table.v1`)throw TypeError(`canonical reaction discovery requires a packed SPH reaction table`);let n=ft(e.reactionCount,`reactionTable.reactionCount`,Re);if(!(e.records instanceof Float32Array))throw TypeError(`reactionTable.records must be a Float32Array`);if(typeof SharedArrayBuffer==`function`&&e.records.buffer instanceof SharedArrayBuffer)throw TypeError(`reactionTable.records cannot use shared mutable storage`);let r=n*Le;if(e.records.length!==r)throw RangeError(`reactionTable.records has ${e.records.length} floats; exactly ${r} required`);let i=e.combinedRecords instanceof Float32Array?e.combinedRecords:e.records;if(typeof SharedArrayBuffer==`function`&&i.buffer instanceof SharedArrayBuffer)throw TypeError(`reactionTable.combinedRecords cannot use shared mutable storage`);if(i.length<r)throw RangeError(`reaction table combined records do not contain every reaction header`);if(t===!0&&e.combinedRecords instanceof Float32Array){for(let t=0;t<r;t+=1)if(!Object.is(e.records[t],i[t]))throw TypeError(`reaction table combined-record prefix does not match records`)}if(Object.hasOwn(e,`recordStrideFloats`)&&e.recordStrideFloats!==Le)throw RangeError(`reactionTable.recordStrideFloats must equal 12`);if(Object.hasOwn(e,`combinedRecordCount`)&&(!Number.isSafeInteger(e.combinedRecordCount)||e.combinedRecordCount!==i.length/4))throw RangeError(`reactionTable.combinedRecordCount is inconsistent`);return{reactionCount:n,combined:i}}function Mt({combined:e,reason:t}){let n=e.length%4==0?e.length/4:0;return Object.freeze({schema:Qe,mode:`full-rule-scan`,modeCode:$e,reason:t,upload:e,pairOffsetVec4s:0,pairCount:0,ruleOffsetVec4s:0,ruleCount:0,recordVec4Count:n})}function Nt({combined:e,reactionCount:t,allowIndex:n,fallbackReason:r=`material-pair-index-unavailable`}){if(n!==!0)return Mt({combined:e,reason:r});if(e.length%4!=0)return Mt({combined:e,reason:`reaction-record-prefix-not-vec4-aligned`});let i=new Map;for(let n=0;n<t;n+=1){let t=n*Le,r=Math.fround(e[t]),a=Math.fround(e[t+1]),o=Math.fround(e[t+3]),s=Math.fround(e[t+5]),c=Math.fround(e[t+6]),l=Math.fround(e[t+7]);if(Math.fround(e[t+8])!==1||!Number.isFinite(r)||!Number.isFinite(a)||r===a||!Number.isFinite(o)||!Number.isFinite(s)||s<=0||!Number.isFinite(c)||!Number.isFinite(l))continue;let u=Math.min(r,a),d=Math.max(r,a),f=`${u}:${d}`,p=i.get(f);p||(p={materialLo:u,materialHi:d,ruleIndexes:[]},i.set(f,p)),p.ruleIndexes.push(n)}let a=[...i.values()].sort((e,t)=>e.materialLo-t.materialLo||e.materialHi-t.materialHi),o=a.flatMap(e=>e.ruleIndexes),s=e.length/4,c=s+a.length,l=Math.ceil(o.length/nt)*nt,u=new Float32Array(e.length+a.length*tt+l);u.set(e);let d=e.length,f=0;for(let e of a)u[d]=e.materialLo,u[d+1]=e.materialHi,u[d+2]=f,u[d+3]=e.ruleIndexes.length,d+=tt,f+=e.ruleIndexes.length;return u.set(o,e.length+a.length*tt),Object.freeze({schema:Qe,mode:`material-pair-indexed`,modeCode:et,reason:null,upload:u,pairOffsetVec4s:s,pairCount:a.length,ruleOffsetVec4s:c,ruleCount:o.length,recordVec4Count:u.length/4})}function Pt({reactionTable:e,combined:t,reactionCount:n,allowIndex:r,fallbackReason:i,reactionTableFingerprint:a}){if(r!==!0)return Mt({combined:t,reason:i});let o=ot.get(e);if(o&&o.reactionTableFingerprint===a&&o.reactionCount===n&&o.combined===t)return o.reactionRuleIndex;let s=Nt({combined:t,reactionCount:n,allowIndex:r,fallbackReason:i});return ot.set(e,{reactionTableFingerprint:a,reactionCount:n,combined:t,reactionRuleIndex:s}),s}function Ft(e){let{reactionCount:t,combined:n}=jt(e),r=0;for(let e=0;e<t;e+=1){let t=e*Le,i=n[t+8],a=n[t+5];Math.round(i)!==1||!Number.isFinite(a)||a<=0||(r=Math.max(r,Math.fround(a)))}return r}function It({particleCount:e,reactionCount:t,maximumContactRadiusM:n,reactionRuleIndex:r,collectDiagnosticEvidence:i=!1,reactionMotionEnvelope:a=null}){let o=new ArrayBuffer(G),s=new DataView(o);return s.setUint32(0,ft(e,`particleCount`,Re),!0),s.setUint32(4,ft(t,`reactionCount`,Re),!0),s.setUint32(8,Ie,!0),s.setUint32(12,h,!0),s.setFloat32(16,n>0?gt(n,`maximumContactRadiusM`):0,!0),s.setUint32(20,16,!0),s.setUint32(24,3,!0),s.setUint32(28,2,!0),s.setUint32(32,r.modeCode,!0),s.setUint32(36,r.pairOffsetVec4s,!0),s.setUint32(40,r.pairCount,!0),s.setUint32(44,r.ruleOffsetVec4s,!0),s.setUint32(48,r.ruleCount,!0),s.setUint32(52,r.recordVec4Count,!0),s.setUint32(56,+(i===!0),!0),s.setUint32(60,+(a?.thermalPhaseEvolutionEnabled===!0),!0),s.setUint32(64,a?.maxFutureSubsteps??0,!0),s.setUint32(68,+(a?.separationDisplacementEnabled===!0),!0),s.setUint32(72,a?.cflFactorF32Bits??0,!0),s.setUint32(76,a?.gridSpacingF32Bits??0,!0),s.setUint32(80,a?.boxDimsF32Bits?.[0]??0,!0),s.setUint32(84,a?.boxDimsF32Bits?.[1]??0,!0),s.setUint32(88,a?.boxDimsF32Bits?.[2]??0,!0),s.setUint32(92,+(a?.contactCorrectionEnabled===!0),!0),o}function Lt(e){let n=e===2;if(!n&&e!==1)throw RangeError(`unsupported reaction discovery directory ABI version: ${e}`);let i=(n?r:p)({directoryBindingName:`spatial_directory`}),a=(n?f:t)({treeBindingName:`exact_near_cell_tree`,directoryBindingName:`spatial_directory`});return`
struct ReactionDiscoveryParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  support_profile_id: u32,
  maximum_contact_radius_m: f32,
  active_node_stride_floats: u32,
  thermo_stride_vec4s: u32,
  state_stride_vec4s: u32,
  reaction_rule_index_mode: u32,
  reaction_rule_index_pair_offset_vec4s: u32,
  reaction_rule_index_pair_count: u32,
  reaction_rule_index_rule_offset_vec4s: u32,
  reaction_rule_index_rule_count: u32,
  reaction_rule_index_record_vec4_count: u32,
  collect_diagnostic_evidence: u32,
  activation_thermal_phase_evolution_enabled: u32,
  activation_max_future_substeps: u32,
  activation_separation_enabled: u32,
  activation_cfl_factor: f32,
  activation_grid_spacing_m: f32,
  activation_box_dim_x_m: f32,
  activation_box_dim_y_m: f32,
  activation_box_dim_z_m: f32,
  activation_contact_correction_enabled: u32,
};

@group(0) @binding(0) var<storage, read> source_state_authority: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> exact_near_cell_tree: array<u32>;
@group(0) @binding(6) var<storage, read_write> reaction_proposals: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> spatial_expectation: ${n?`SchroederSpatialExactNearExpectationV2`:`SchroederSpatialExactNearExpectationV1`};
@group(0) @binding(9) var<uniform> params: ReactionDiscoveryParams;
@group(0) @binding(10) var<storage, read_write> reaction_activation_observation: array<atomic<u32>>;

${i}
${a}
${De}

const REACTION_DISCOVERY_INVALID_INDEX: f32 = -1.0;
const REACTION_DISCOVERY_MAX_F32: f32 = 3.402823e38;
const REACTION_DISCOVERY_CERTIFICATE_READY_BITS: u32 = 0x3f800000u;
const REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS: u32 = 0x40000000u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_FULL_SCAN: u32 = 0u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR: u32 = 1u;
const REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4: u32 = 4u;
const REACTION_DISCOVERY_EVIDENCE_OVERFLOW: u32 = 15u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: u32 = 16u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: u32 = 17u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: u32 = 18u;
const REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: u32 = 19u;
const REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS: u32 = 20u;
const REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS: u32 = 21u;
const REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT: u32 = 22u;
const REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT: u32 = 23u;
const REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: u32 = 24u;
const REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: u32 = 25u;
const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: u32 = 26u;
const REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE: u32 = 0u;
const REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS: u32 = 1u;
const REACTION_ACTIVATION_RESULT_WORD: u32 = 0u;
const REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD: u32 = 1u;
const REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD: u32 = 2u;
const REACTION_ACTIVATION_FAILURE_WORD: u32 = 3u;

fn reaction_discovery_invalid_proposal() -> vec4<f32> {
  return vec4<f32>(
    REACTION_DISCOVERY_INVALID_INDEX,
    REACTION_DISCOVERY_INVALID_INDEX,
    0.0,
    REACTION_DISCOVERY_MAX_F32
  );
}

// This is the immediate path for completion and fail-closed counters. The
// candidate/tree diagnostics below are deliberately the only batched fields.
fn reaction_discovery_increment_control_counter(counter_index: u32) {
  let previous = atomicAdd(&traversal_evidence[counter_index], 1u);
  if (previous == 0xffffffffu) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
  }
}

// S9D_HOT_COUNTER_AGGREGATION_BEGIN
// These are invocation-private accumulators. They are observable only when
// requested, and never participate in traversal, rule selection, or sealing
// except to fail closed on an arithmetic overflow.
var<private> reaction_discovery_hot_candidate_visits: u32;
var<private> reaction_discovery_hot_compatible_pairs: u32;
var<private> reaction_discovery_hot_rule_index_pair_lookups: u32;
var<private> reaction_discovery_hot_rule_index_pair_misses: u32;
var<private> reaction_discovery_hot_rule_index_rule_visits: u32;
var<private> reaction_discovery_hot_full_rule_scan_visits: u32;
var<private> reaction_discovery_hot_tree_node_visits: u32;
var<private> reaction_discovery_hot_tree_leaf_visits: u32;
var<private> reaction_discovery_hot_tree_member_visits: u32;
var<private> reaction_discovery_hot_counter_overflow: u32;

fn reaction_discovery_reset_hot_counters() {
  reaction_discovery_hot_candidate_visits = 0u;
  reaction_discovery_hot_compatible_pairs = 0u;
  reaction_discovery_hot_rule_index_pair_lookups = 0u;
  reaction_discovery_hot_rule_index_pair_misses = 0u;
  reaction_discovery_hot_rule_index_rule_visits = 0u;
  reaction_discovery_hot_full_rule_scan_visits = 0u;
  reaction_discovery_hot_tree_node_visits = 0u;
  reaction_discovery_hot_tree_leaf_visits = 0u;
  reaction_discovery_hot_tree_member_visits = 0u;
  reaction_discovery_hot_counter_overflow = 0u;
}

fn reaction_discovery_increment_hot_counter(counter_index: u32) {
  if (
    params.collect_diagnostic_evidence == 0u
    || reaction_discovery_hot_counter_overflow != 0u
  ) {
    return;
  }
  switch (counter_index) {
    case 3u: {
      if (reaction_discovery_hot_candidate_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_candidate_visits =
          reaction_discovery_hot_candidate_visits + 1u;
      }
    }
    case 4u: {
      if (reaction_discovery_hot_compatible_pairs == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_compatible_pairs =
          reaction_discovery_hot_compatible_pairs + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: {
      if (reaction_discovery_hot_rule_index_pair_lookups == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_lookups =
          reaction_discovery_hot_rule_index_pair_lookups + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: {
      if (reaction_discovery_hot_rule_index_pair_misses == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_misses =
          reaction_discovery_hot_rule_index_pair_misses + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: {
      if (reaction_discovery_hot_rule_index_rule_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_rule_visits =
          reaction_discovery_hot_rule_index_rule_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: {
      if (reaction_discovery_hot_full_rule_scan_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_full_rule_scan_visits =
          reaction_discovery_hot_full_rule_scan_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: {
      if (reaction_discovery_hot_tree_node_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_node_visits =
          reaction_discovery_hot_tree_node_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: {
      if (reaction_discovery_hot_tree_leaf_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_leaf_visits =
          reaction_discovery_hot_tree_leaf_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: {
      if (reaction_discovery_hot_tree_member_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_member_visits =
          reaction_discovery_hot_tree_member_visits + 1u;
      }
    }
    default: {}
  }
}

fn reaction_discovery_flush_hot_counter(counter_index: u32, count: u32) -> bool {
  if (count == 0u) {
    return true;
  }
  let previous = atomicAdd(&traversal_evidence[counter_index], count);
  return previous <= 0xffffffffu - count;
}

fn reaction_discovery_flush_hot_counters() -> bool {
  if (params.collect_diagnostic_evidence == 0u) {
    return true;
  }
  let candidate_visits_admitted = reaction_discovery_flush_hot_counter(
    3u,
    reaction_discovery_hot_candidate_visits
  );
  let compatible_pairs_admitted = reaction_discovery_flush_hot_counter(
    4u,
    reaction_discovery_hot_compatible_pairs
  );
  let pair_lookups_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS,
    reaction_discovery_hot_rule_index_pair_lookups
  );
  let pair_misses_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES,
    reaction_discovery_hot_rule_index_pair_misses
  );
  let rule_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS,
    reaction_discovery_hot_rule_index_rule_visits
  );
  let full_scan_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS,
    reaction_discovery_hot_full_rule_scan_visits
  );
  let tree_node_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS,
    reaction_discovery_hot_tree_node_visits
  );
  let tree_leaf_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS,
    reaction_discovery_hot_tree_leaf_visits
  );
  let tree_member_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS,
    reaction_discovery_hot_tree_member_visits
  );
  if (
    reaction_discovery_hot_counter_overflow != 0u
    || !candidate_visits_admitted
    || !compatible_pairs_admitted
    || !pair_lookups_admitted
    || !pair_misses_admitted
    || !rule_visits_admitted
    || !full_scan_visits_admitted
    || !tree_node_visits_admitted
    || !tree_leaf_visits_admitted
    || !tree_member_visits_admitted
  ) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
    return false;
  }
  return true;
}

fn reaction_discovery_increment_counter(counter_index: u32) {
  if (
    counter_index == 3u
    || counter_index == 4u
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
  ) {
    reaction_discovery_increment_hot_counter(counter_index);
    return;
  }
  reaction_discovery_increment_control_counter(counter_index);
}
// S9D_HOT_COUNTER_AGGREGATION_END

fn reaction_discovery_source_row_admitted(source_index: u32) -> bool {
  let offset = source_index * params.state_stride_vec4s;
  if (
    offset >= arrayLength(&source_state_authority)
    || offset >= arrayLength(&source_state)
  ) {
    return false;
  }
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  return all(vec3<bool>(
      ss_exact_near_finite(authority_position_mass.x),
      ss_exact_near_finite(authority_position_mass.y),
      ss_exact_near_finite(authority_position_mass.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(current_position_mass.x),
      ss_exact_near_finite(current_position_mass.y),
      ss_exact_near_finite(current_position_mass.z)
    ))
    && ss_exact_near_finite(authority_position_mass.w)
    && ss_exact_near_finite(current_position_mass.w);
}

fn reaction_discovery_position(source_index: u32) -> vec3<f32> {
  return source_state[source_index * params.state_stride_vec4s].xyz;
}

fn reaction_discovery_thermo0(source_index: u32) -> vec4<f32> {
  return source_thermo[source_index * params.thermo_stride_vec4s];
}

fn reaction_discovery_mass(source_index: u32) -> f32 {
  return source_state[source_index * params.state_stride_vec4s].w;
}

fn reaction_discovery_phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  if (
    !ss_exact_near_finite(mask_f)
    || !ss_exact_near_finite(phase_id_f)
    || mask_f < 0.0
    || phase_id_f < 0.0
  ) {
    return false;
  }
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  return phase_id < 31u && (mask & (1u << phase_id)) != 0u;
}

// One invocation authenticates one source row. Non-negative finite f32 bit
// patterns preserve numeric order as u32, so atomicMax is an exact parallel
// reduction for the maximum displacement. Dispatch ordering makes the sealed
// certificate visible to the traversal without a host fence or readback.
@compute @workgroup_size(${W})
fn prepare_displacement_certificate(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (
    source_index >= params.particle_count
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
  ) {
    return;
  }
  if (!reaction_discovery_source_row_admitted(source_index)) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  let offset = source_index * params.state_stride_vec4s;
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  let source_active = authority_position_mass.w > 0.0;
  let current_active = current_position_mass.w > 0.0;
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT],
    select(0u, 1u, source_active)
  );
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT],
    select(0u, 1u, current_active)
  );
  if (source_active != current_active) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  if (!source_active) {
    return;
  }
  let displacement_m = length(
    current_position_mass.xyz - authority_position_mass.xyz
  );
  if (!ss_exact_near_finite(displacement_m) || displacement_m < 0.0) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  atomicMax(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS],
    bitcast<u32>(displacement_m)
  );
}

struct ReactionRuleIndexInteger {
  admitted: u32,
  value: u32,
};

struct ReactionRuleIndexLookup {
  indexed: u32,
  found: u32,
  rule_begin: u32,
  rule_count: u32,
};

fn reaction_discovery_rule_index_integer(value: f32) -> ReactionRuleIndexInteger {
  if (
    !ss_exact_near_finite(value)
    || value < 0.0
    || value > 16777215.0
    || floor(value) != value
  ) {
    return ReactionRuleIndexInteger(0u, 0u);
  }
  return ReactionRuleIndexInteger(1u, u32(value));
}

fn reaction_discovery_rule_index_available() -> bool {
  if (
    params.reaction_rule_index_mode
      != REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR
    || params.reaction_rule_index_record_vec4_count
      > arrayLength(&reaction_records)
  ) {
    return false;
  }
  let reaction_prefix_vec4s =
    params.reaction_count * params.reaction_record_stride_vec4s;
  if (
    params.reaction_rule_index_pair_offset_vec4s < reaction_prefix_vec4s
    || params.reaction_rule_index_pair_offset_vec4s
      > params.reaction_rule_index_rule_offset_vec4s
    || params.reaction_rule_index_pair_count
      > params.reaction_rule_index_rule_offset_vec4s
        - params.reaction_rule_index_pair_offset_vec4s
    || params.reaction_rule_index_rule_count > 0xfffffffcu
  ) {
    return false;
  }
  let rule_vec4_count = (
    params.reaction_rule_index_rule_count
      + (REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4 - 1u)
  ) / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  return params.reaction_rule_index_rule_offset_vec4s
      <= params.reaction_rule_index_record_vec4_count
    && rule_vec4_count
      <= params.reaction_rule_index_record_vec4_count
        - params.reaction_rule_index_rule_offset_vec4s;
}

fn reaction_discovery_pair_less(
  left_lo: f32,
  left_hi: f32,
  right_lo: f32,
  right_hi: f32
) -> bool {
  return left_lo < right_lo || (left_lo == right_lo && left_hi < right_hi);
}

fn reaction_discovery_rule_index_lookup(
  self_material: f32,
  other_material: f32
) -> ReactionRuleIndexLookup {
  if (
    !reaction_discovery_rule_index_available()
    || !ss_exact_near_finite(self_material)
    || !ss_exact_near_finite(other_material)
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  let material_lo = min(self_material, other_material);
  let material_hi = max(self_material, other_material);
  var lower = 0u;
  var upper = params.reaction_rule_index_pair_count;
  var iteration = 0u;
  loop {
    if (lower >= upper || iteration >= params.reaction_rule_index_pair_count) {
      break;
    }
    let middle = lower + (upper - lower) / 2u;
    let entry = reaction_records[
      params.reaction_rule_index_pair_offset_vec4s + middle
    ];
    if (
      !ss_exact_near_finite(entry.x)
      || !ss_exact_near_finite(entry.y)
      || entry.x >= entry.y
    ) {
      return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
    }
    if (reaction_discovery_pair_less(entry.x, entry.y, material_lo, material_hi)) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
    iteration = iteration + 1u;
  }
  if (lower >= params.reaction_rule_index_pair_count) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let entry = reaction_records[
    params.reaction_rule_index_pair_offset_vec4s + lower
  ];
  if (
    !ss_exact_near_finite(entry.x)
    || !ss_exact_near_finite(entry.y)
    || entry.x >= entry.y
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  if (entry.x != material_lo || entry.y != material_hi) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let rule_begin = reaction_discovery_rule_index_integer(entry.z);
  let rule_count = reaction_discovery_rule_index_integer(entry.w);
  if (
    rule_begin.admitted == 0u
    || rule_count.admitted == 0u
    || rule_count.value == 0u
    || rule_begin.value > params.reaction_rule_index_rule_count
    || rule_count.value
      > params.reaction_rule_index_rule_count - rule_begin.value
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  return ReactionRuleIndexLookup(
    1u,
    1u,
    rule_begin.value,
    rule_count.value
  );
}

fn reaction_discovery_rule_index_rule_at(
  rule_offset: u32
) -> ReactionRuleIndexInteger {
  let row = reaction_records[
    params.reaction_rule_index_rule_offset_vec4s
      + rule_offset / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4
  ];
  let lane = rule_offset % REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  var value = row.x;
  if (lane == 1u) {
    value = row.y;
  } else if (lane == 2u) {
    value = row.z;
  } else if (lane == 3u) {
    value = row.w;
  }
  return reaction_discovery_rule_index_integer(value);
}

fn reaction_discovery_consider_reaction(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  reaction_index: u32,
  best: ptr<function, vec4<f32>>
) {
  if (reaction_index >= params.reaction_count) {
    return;
  }
  let reaction_base = reaction_index * params.reaction_record_stride_vec4s;
  let row0 = reaction_records[reaction_base];
  let row1 = reaction_records[reaction_base + 1u];
  let row2 = reaction_records[reaction_base + 2u];
  if (row2.x != 1.0 || !ss_exact_near_finite(row1.y) || row1.y <= 0.0) {
    return;
  }
  if (
    !all(vec4<bool>(
      ss_exact_near_finite(self_thermo0.x),
      ss_exact_near_finite(self_thermo0.y),
      ss_exact_near_finite(self_thermo0.z),
      ss_exact_near_finite(other_thermo0.x)
    ))
    || !ss_exact_near_finite(other_thermo0.y)
    || !ss_exact_near_finite(other_thermo0.z)
    || !ss_exact_near_finite(row0.w)
    || !ss_exact_near_finite(row1.z)
    || !ss_exact_near_finite(row1.w)
    || row0.x == row0.y
  ) {
    return;
  }
  var role = 0.0;
  var self_phase_mask = 0.0;
  var other_phase_mask = 0.0;
  if (self_material == row0.x && other_material == row0.y) {
    role = 1.0;
    self_phase_mask = row1.z;
    other_phase_mask = row1.w;
  } else if (self_material == row0.y && other_material == row0.x) {
    role = 2.0;
    self_phase_mask = row1.w;
    other_phase_mask = row1.z;
  } else {
    return;
  }
  if (
    !reaction_discovery_phase_mask_satisfied(self_phase_mask, self_thermo0.y)
    || !reaction_discovery_phase_mask_satisfied(other_phase_mask, other_thermo0.y)
    || max(self_thermo0.z, other_thermo0.z) < row0.w
  ) {
    return;
  }
  if (distance_squared > row1.y * row1.y) {
    return;
  }
  reaction_discovery_increment_counter(4u);
  let current_partner = select(0xffffffffu, u32((*best).x + 0.5), (*best).x >= 0.0);
  let current_reaction = select(0xffffffffu, u32((*best).y + 0.5), (*best).y >= 0.0);
  if (
    distance_squared < (*best).w
    || (
      distance_squared == (*best).w
      && (
        other_index < current_partner
        || (other_index == current_partner && reaction_index < current_reaction)
      )
    )
  ) {
    *best = vec4<f32>(
      f32(other_index),
      f32(reaction_index),
      role,
      distance_squared
    );
  }
}

fn reaction_discovery_consider_all_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  best: ptr<function, vec4<f32>>
) {
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_indexed_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  lookup: ReactionRuleIndexLookup,
  best: ptr<function, vec4<f32>>
) {
  var previous_reaction_index = 0u;
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let decoded = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    );
    if (
      decoded.admitted == 0u
      || decoded.value >= params.reaction_count
      || (rule_ordinal > 0u && decoded.value <= previous_reaction_index)
    ) {
      reaction_discovery_consider_all_reactions(
        self_index,
        other_index,
        self_material,
        other_material,
        self_thermo0,
        other_thermo0,
        distance_squared,
        best
      );
      return;
    }
    previous_reaction_index = decoded.value;
  }
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let reaction_index = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    ).value;
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_pair(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  self_position: vec3<f32>,
  best: ptr<function, vec4<f32>>
) {
  if (other_index == self_index || other_index >= params.particle_count) {
    return;
  }
  reaction_discovery_increment_counter(3u);
  if (!reaction_discovery_source_row_admitted(other_index)) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(other_index) <= 0.0) {
    return;
  }
  let self_thermo0 = reaction_discovery_thermo0(self_index);
  let other_thermo0 = reaction_discovery_thermo0(other_index);
  let other_material = other_thermo0.x;
  let other_position = reaction_discovery_position(other_index);
  let displacement = self_position - other_position;
  let distance_squared = dot(displacement, displacement);
  if (!ss_exact_near_finite(distance_squared)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  let lookup = reaction_discovery_rule_index_lookup(
    self_material,
    other_material
  );
  if (lookup.indexed != 0u) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    );
    if (lookup.found == 0u) {
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
      );
      return;
    }
    reaction_discovery_consider_indexed_reactions(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      lookup,
      best
    );
    return;
  }
  reaction_discovery_consider_all_reactions(
    self_index,
    other_index,
    self_material,
    other_material,
    self_thermo0,
    other_thermo0,
    distance_squared,
    best
  );
}

@compute @workgroup_size(${W})
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  reaction_discovery_reset_hot_counters();
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    )
      != REACTION_DISCOVERY_CERTIFICATE_READY_BITS
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  if (
    arrayLength(&source_thermo) < params.particle_count * params.thermo_stride_vec4s
    || arrayLength(&source_state) < params.particle_count * params.state_stride_vec4s
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_discovery_source_row_admitted(particle_index)
  ) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(particle_index) <= 0.0) {
    return;
  }
  if (
    !ss_exact_near_finite(params.maximum_contact_radius_m)
    || params.maximum_contact_radius_m < 0.0
  ) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (params.maximum_contact_radius_m == 0.0) {
    return;
  }

  let self_position = reaction_discovery_position(particle_index);
  let self_material = reaction_discovery_thermo0(particle_index).x;
  let certified_search_radius_m = params.maximum_contact_radius_m
    + max(bitcast<f32>(atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS]
    )), 0.0);
  if (!ss_exact_near_finite(certified_search_radius_m)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  var best = reaction_discovery_invalid_proposal();
  var malformed = false;

  let query_extent = vec3<f32>(certified_search_radius_m);
  let query_minimum = self_position - query_extent;
  let query_maximum = self_position + query_extent;
  let tree_cell_count = exact_near_cell_tree[18u];
  let tree_leaf_capacity = exact_near_cell_tree[20u];
  let tree_leaf_offset = tree_leaf_capacity - 1u;
  let tree_node_capacity = exact_near_cell_tree[21u];
  let tree_depth = exact_near_cell_tree[23u];
  // This is a complete-tree-depth proof, not a per-source candidate budget.
  // The builder rejects depths above 30, so all pending siblings fit here.
  var node_stack: array<u32, 32>;
  var stack_count = 0u;
  if (
    tree_node_capacity == 0u
    || tree_depth >= 32u
    || !ss_exact_near_finite(query_minimum.x)
    || !ss_exact_near_finite(query_minimum.y)
    || !ss_exact_near_finite(query_minimum.z)
    || !ss_exact_near_finite(query_maximum.x)
    || !ss_exact_near_finite(query_maximum.y)
    || !ss_exact_near_finite(query_maximum.z)
    || !all(query_minimum <= query_maximum)
  ) {
    malformed = true;
  } else {
    node_stack[0u] = 0u;
    stack_count = 1u;
    for (
      var node_iteration = 0u;
      node_iteration < tree_node_capacity && stack_count > 0u;
      node_iteration = node_iteration + 1u
    ) {
      stack_count = stack_count - 1u;
      let node_index = node_stack[stack_count];
      if (node_index >= tree_node_capacity) {
        malformed = true;
        break;
      }
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
      );
      if (!ss_exact_cell_tree_node_intersects(
        node_index,
        query_minimum,
        query_maximum
      )) {
        continue;
      }
      if (ss_exact_cell_tree_node_is_leaf(node_index)) {
        reaction_discovery_increment_counter(
          REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
        );
        let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
        if (
          node_index < tree_leaf_offset
          || cell_index >= tree_cell_count
          || cell_index >= spatial_expectation.expected_cell_capacity
        ) {
          malformed = true;
          break;
        }
        let member_range = ss_exact_near_cell_member_range(
          spatial_expectation,
          cell_index
        );
        if (member_range.admitted == 0u) {
          malformed = true;
          break;
        }
        for (
          var member_offset = member_range.begin;
          member_offset < member_range.end;
          member_offset = member_offset + 1u
        ) {
          reaction_discovery_increment_counter(
            REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
          );
          let lookup = ss_exact_near_source_at_member(
            spatial_expectation,
            member_offset
          );
          if (lookup.admitted == 0u) {
            malformed = true;
            break;
          }
          reaction_discovery_consider_pair(
            particle_index,
            lookup.source_index,
            self_material,
            self_position,
            &best
          );
        }
        if (malformed) {
          break;
        }
        continue;
      }
      if (
        node_index >= tree_leaf_offset
        || !ss_exact_cell_tree_node_is_internal(node_index)
      ) {
        malformed = true;
        break;
      }
      let left_child = node_index * 2u + 1u;
      let right_child = left_child + 1u;
      if (
        right_child >= tree_node_capacity
        || stack_count + 2u > 32u
      ) {
        malformed = true;
        break;
      }
      // Right then left preserves complete-tree canonical leaf order.
      node_stack[stack_count] = right_child;
      node_stack[stack_count + 1u] = left_child;
      stack_count = stack_count + 2u;
    }
    if (stack_count != 0u) {
      malformed = true;
    }
  }

  if (!reaction_discovery_flush_hot_counters()) {
    malformed = true;
  }
  if (malformed) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (best.x >= 0.0 && best.y >= 0.0) {
    reaction_proposals[particle_index] = best;
    reaction_discovery_increment_counter(6u);
  }
}

// This second dispatch performs no lookup. It turns any directory, source, or
// traversal rejection into a complete invalid proposal set before a later
// chemistry kernel can observe the artifact.
@compute @workgroup_size(${W})
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let fail_closed = atomicLoad(&traversal_evidence[2u]) != 0u
    || atomicLoad(&traversal_evidence[5u]) != 0u
    || atomicLoad(&traversal_evidence[8u]) != 0u
    || atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) != 0u
    || atomicLoad(&traversal_evidence[0u]) != params.particle_count
    || atomicLoad(&traversal_evidence[1u]) != params.particle_count;
  if (fail_closed) {
    reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  }
  reaction_discovery_increment_counter(7u);
}

fn reaction_activation_fail_closed() {
  atomicOr(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    0x80000000u
  );
}

fn reaction_activation_source_row_admitted(source_index: u32) -> bool {
  let state_offset = source_index * params.state_stride_vec4s;
  let thermo_offset = source_index * params.thermo_stride_vec4s;
  if (
    state_offset + 1u >= arrayLength(&source_state)
    || thermo_offset + 2u >= arrayLength(&source_thermo)
  ) {
    return false;
  }
  for (var row = 0u; row < 2u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_state[state_offset + row])) {
      return false;
    }
  }
  for (var row = 0u; row < 3u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_thermo[thermo_offset + row])) {
      return false;
    }
  }
  // The mutation shader's wildcard phase mask bypasses phase conversion.
  // Refuse a negative phase here so the watch cannot seal a false zero.
  return source_thermo[thermo_offset].y >= 0.0;
}

// Binding 0 is intentionally rebound to the terminal mechanics family for
// this entry point. The declaration is a raw vec4 array, so the exact same
// shader module can retain the canonical position authority for proposal
// production while the watch-only pipeline certifies row4.w rest volumes.
@compute @workgroup_size(${W})
fn prepare_activation_motion_bounds(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (source_index >= params.particle_count) {
    return;
  }
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || params.activation_max_future_substeps == 0u
    || !reaction_motion_finite(params.activation_cfl_factor)
    || !(params.activation_cfl_factor > 0.0)
    || !reaction_motion_finite(params.activation_grid_spacing_m)
    || !(params.activation_grid_spacing_m > 0.0)
    || params.activation_separation_enabled > 1u
    || params.activation_contact_correction_enabled > 1u
    || params.activation_thermal_phase_evolution_enabled > 1u
    || !reaction_motion_box_dims_admitted(vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    ))
    || arrayLength(&source_state_authority) < params.particle_count * 8u
    || !reaction_activation_source_row_admitted(source_index)
  ) {
    reaction_activation_fail_closed();
    return;
  }
  let mechanics_offset = source_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(
      source_state_authority[mechanics_offset + row]
    )) {
      reaction_activation_fail_closed();
      return;
    }
  }
  let position_mass = source_state[
    source_index * params.state_stride_vec4s
  ];
  if (position_mass.w <= 0.0) {
    return;
  }
  if (!reaction_motion_position_inside_box(
    position_mass.xyz,
    vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    )
  )) {
    reaction_activation_fail_closed();
    return;
  }
  if (
    params.activation_separation_enabled == 0u
    && params.activation_contact_correction_enabled == 0u
  ) {
    return;
  }
  let rest_volume_m3 = source_state_authority[source_index * 8u + 4u].w;
  let diameter_m = reaction_motion_rest_diameter_upper(rest_volume_m3);
  if (!(diameter_m > 0.0) || !reaction_motion_finite(diameter_m)) {
    reaction_activation_fail_closed();
    return;
  }
  atomicMax(
    &reaction_activation_observation[
      REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
    ],
    bitcast<u32>(diameter_m)
  );
}

fn reaction_activation_pair_triggered(
  self_index: u32,
  other_index: u32,
  relative_reach_m: f32
) -> bool {
  if (other_index == self_index || other_index >= params.particle_count) {
    return false;
  }
  if (!reaction_activation_source_row_admitted(other_index)) {
    reaction_activation_fail_closed();
    return false;
  }
  let other_position_mass = source_state[
    other_index * params.state_stride_vec4s
  ];
  if (other_position_mass.w <= 0.0) {
    return false;
  }
  let self_position_mass = source_state[
    self_index * params.state_stride_vec4s
  ];
  let self_thermo0 = source_thermo[
    self_index * params.thermo_stride_vec4s
  ];
  let other_thermo0 = source_thermo[
    other_index * params.thermo_stride_vec4s
  ];
  let distance_m = length(self_position_mass.xyz - other_position_mass.xyz);
  if (!reaction_motion_finite(distance_m)) {
    reaction_activation_fail_closed();
    return false;
  }
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    let reaction_base = reaction_index
      * params.reaction_record_stride_vec4s;
    let row0 = reaction_records[reaction_base];
    let row1 = reaction_records[reaction_base + 1u];
    let row2 = reaction_records[reaction_base + 2u];
    if (row2.x != 1.0) {
      continue;
    }
    if (
      !all(vec4<bool>(
        reaction_motion_finite(row0.x),
        reaction_motion_finite(row0.y),
        reaction_motion_finite(row0.z),
        reaction_motion_finite(row0.w)
      ))
      || !all(vec4<bool>(
        reaction_motion_finite(row1.x),
        reaction_motion_finite(row1.y),
        reaction_motion_finite(row1.z),
        reaction_motion_finite(row1.w)
      ))
      || !reaction_motion_finite(row2.x)
      || row0.x == row0.y
    ) {
      reaction_activation_fail_closed();
      continue;
    }
    // A ready zero-radius rule cannot mutate. Match the dedicated watcher by
    // treating it as a deterministic non-match instead of malformed input.
    if (!(row1.y > 0.0)) {
      continue;
    }
    var self_phase_mask = 0.0;
    var other_phase_mask = 0.0;
    if (self_thermo0.x == row0.x && other_thermo0.x == row0.y) {
      self_phase_mask = row1.z;
      other_phase_mask = row1.w;
    } else if (
      self_thermo0.x == row0.y && other_thermo0.x == row0.x
    ) {
      self_phase_mask = row1.w;
      other_phase_mask = row1.z;
    } else {
      continue;
    }
    if (
      !reaction_discovery_phase_mask_satisfied(
        self_phase_mask,
        self_thermo0.y
      )
      || !reaction_discovery_phase_mask_satisfied(
        other_phase_mask,
        other_thermo0.y
      )
      || max(self_thermo0.z, other_thermo0.z) < row0.w
    ) {
      continue;
    }
    let expanded_radius_m = reaction_motion_upward(
      row1.y + relative_reach_m
    );
    if (!reaction_motion_finite(expanded_radius_m)) {
      reaction_activation_fail_closed();
      continue;
    }
    if (distance_m <= expanded_radius_m) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(${W})
fn watch_activation_motion_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  var triggered = false;
  var malformed = false;
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_activation_source_row_admitted(particle_index)
  ) {
    malformed = true;
  }
  let position_mass = source_state[
    particle_index * params.state_stride_vec4s
  ];
  if (
    !malformed
    && params.activation_thermal_phase_evolution_enabled != 0u
  ) {
    // A dynamic thermal/phase/rest-volume writer can satisfy the reaction
    // predicate or enlarge/activate a carrier without terminal motion. Count
    // every fixed carrier slot positive before consulting terminal mass,
    // temperature, phase, rest diameter, or spatial reach.
    triggered = true;
  }
  if (!malformed && position_mass.w > 0.0 && !triggered) {
    let max_rest_diameter_m = bitcast<f32>(atomicLoad(
      &reaction_activation_observation[
        REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
      ]
    ));
    let max_abs_position_m = max(
      abs(position_mass.x),
      max(abs(position_mass.y), abs(position_mass.z))
    );
    let relative_reach_m = reaction_motion_relative_reach_upper(
      params.activation_max_future_substeps,
      params.activation_cfl_factor,
      params.activation_grid_spacing_m,
      max_rest_diameter_m,
      params.activation_separation_enabled != 0u,
      params.activation_contact_correction_enabled != 0u,
      vec3<f32>(
        params.activation_box_dim_x_m,
        params.activation_box_dim_y_m,
        params.activation_box_dim_z_m
      ),
      max_abs_position_m,
      params.maximum_contact_radius_m
    );
    let certified_search_radius_m = reaction_motion_upward(
      reaction_motion_upward(params.maximum_contact_radius_m)
        + reaction_motion_upward(bitcast<f32>(atomicLoad(
          &traversal_evidence[
            REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS
          ]
        )))
        + relative_reach_m
    );
    if (
      !reaction_motion_finite(relative_reach_m)
      || !reaction_motion_finite(certified_search_radius_m)
      || !(certified_search_radius_m >= 0.0)
    ) {
      malformed = true;
    } else if (certified_search_radius_m > 0.0) {
      let query_extent = vec3<f32>(certified_search_radius_m);
      let query_minimum = position_mass.xyz - query_extent;
      let query_maximum = position_mass.xyz + query_extent;
      let tree_cell_count = exact_near_cell_tree[18u];
      let tree_leaf_capacity = exact_near_cell_tree[20u];
      let tree_leaf_offset = tree_leaf_capacity - 1u;
      let tree_node_capacity = exact_near_cell_tree[21u];
      let tree_depth = exact_near_cell_tree[23u];
      var node_stack: array<u32, 32>;
      var stack_count = 0u;
      if (
        tree_node_capacity == 0u
        || tree_depth >= 32u
        || !all(vec3<bool>(
          reaction_motion_finite(query_minimum.x),
          reaction_motion_finite(query_minimum.y),
          reaction_motion_finite(query_minimum.z)
        ))
        || !all(vec3<bool>(
          reaction_motion_finite(query_maximum.x),
          reaction_motion_finite(query_maximum.y),
          reaction_motion_finite(query_maximum.z)
        ))
        || !all(query_minimum <= query_maximum)
      ) {
        malformed = true;
      } else {
        node_stack[0u] = 0u;
        stack_count = 1u;
        for (
          var node_iteration = 0u;
          node_iteration < tree_node_capacity && stack_count > 0u;
          node_iteration = node_iteration + 1u
        ) {
          stack_count = stack_count - 1u;
          let node_index = node_stack[stack_count];
          if (node_index >= tree_node_capacity) {
            malformed = true;
            break;
          }
          if (!ss_exact_cell_tree_node_intersects(
            node_index,
            query_minimum,
            query_maximum
          )) {
            continue;
          }
          if (ss_exact_cell_tree_node_is_leaf(node_index)) {
            let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
            if (
              node_index < tree_leaf_offset
              || cell_index >= tree_cell_count
              || cell_index >= spatial_expectation.expected_cell_capacity
            ) {
              malformed = true;
              break;
            }
            let member_range = ss_exact_near_cell_member_range(
              spatial_expectation,
              cell_index
            );
            if (member_range.admitted == 0u) {
              malformed = true;
              break;
            }
            for (
              var member_offset = member_range.begin;
              member_offset < member_range.end;
              member_offset = member_offset + 1u
            ) {
              let lookup = ss_exact_near_source_at_member(
                spatial_expectation,
                member_offset
              );
              if (lookup.admitted == 0u) {
                malformed = true;
                break;
              }
              if (reaction_activation_pair_triggered(
                particle_index,
                lookup.source_index,
                relative_reach_m
              )) {
                triggered = true;
                break;
              }
            }
            if (malformed || triggered) {
              break;
            }
            continue;
          }
          if (
            node_index >= tree_leaf_offset
            || !ss_exact_cell_tree_node_is_internal(node_index)
          ) {
            malformed = true;
            break;
          }
          let left_child = node_index * 2u + 1u;
          let right_child = left_child + 1u;
          if (right_child >= tree_node_capacity || stack_count + 2u > 32u) {
            malformed = true;
            break;
          }
          node_stack[stack_count] = right_child;
          node_stack[stack_count + 1u] = left_child;
          stack_count = stack_count + 2u;
        }
        if (stack_count != 0u && !triggered) {
          malformed = true;
        }
      }
    }
  }
  if (malformed) {
    reaction_activation_fail_closed();
  }
  if (triggered) {
    atomicAdd(
      &reaction_activation_observation[
        REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
      ],
      1u
    );
  }
  atomicAdd(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    1u
  );
}

@compute @workgroup_size(1)
fn seal_activation_motion_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&reaction_activation_observation) < 4u) {
    return;
  }
  let control = atomicLoad(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD]
  );
  let triggered_source_count = atomicLoad(
    &reaction_activation_observation[
      REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
    ]
  );
  let admitted = (control & 0x80000000u) == 0u
    && (control & 0x7fffffffu) == params.particle_count
    && triggered_source_count <= params.particle_count
    && atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[REACTION_ACTIVATION_RESULT_WORD],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      triggered_source_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}

// The schedule boundary maps only this word. An encoded one is a trustworthy
// public zero only when
// the same GPU submission proves every completion/admission field that the
// optional 27-word diagnostic readback validates on the host. Any torn,
// rejected, or overflowing traversal remains WebGPU's zero-initialized
// fail-closed word. particle_count is capped far below u32 overflow.
@compute @workgroup_size(1)
fn reduce_activation_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (
    global_id.x != 0u
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || arrayLength(&reaction_activation_observation) < 1u
  ) {
    return;
  }
  let proposal_count = atomicLoad(&traversal_evidence[6u]);
  let admitted = atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && proposal_count <= params.particle_count
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[9u]) == params.support_profile_id
    && atomicLoad(&traversal_evidence[10u])
      == spatial_expectation.expected_generation_id
    && atomicLoad(&traversal_evidence[11u])
      == spatial_expectation.expected_support_epoch
    && atomicLoad(&traversal_evidence[12u]) == params.particle_count
    && atomicLoad(&traversal_evidence[13u]) == params.reaction_count
    && atomicLoad(&traversal_evidence[14u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[0u],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      proposal_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}
`}var Rt=Lt(1),zt=Lt(2);function Bt(e){let t=e===2;if(e!==1&&!t){let t=TypeError(`reaction discovery does not support directory ABI version ${e}`);throw t.code=`ERR_SCHROEDER_REACTION_DISCOVERY_UNSUPPORTED_DIRECTORY_ABI`,t}return Object.freeze({directoryAbiVersion:e,expectationBufferByteLength:t?v:o,shaderCode:t?zt:Rt,cacheKeySuffix:`directory-v${e}`,exactNearCellTreeTraversal:t?`canonical-complete-binary-cell-aabb-leaf-streaming-v2`:`canonical-complete-binary-cell-aabb-leaf-streaming-v1`})}function Vt(e,t){let n=e?.directoryAbiVersion,r=t?.execution?.abiVersion,i=Bt(n);if(r!==n){let e=TypeError(`reaction discovery authentication/generation directory ABI mismatch`);throw e.code=`ERR_SCHROEDER_REACTION_DISCOVERY_DIRECTORY_ABI_MISMATCH`,e}if(e.expectationUniformBytes!==i.expectationBufferByteLength||e.expectationData?.byteLength!==i.expectationBufferByteLength){let e=TypeError(`reaction discovery expectation ABI does not match the directory ABI`);throw e.code=`ERR_SCHROEDER_REACTION_DISCOVERY_EXPECTATION_ABI_MISMATCH`,e}return i}function Ht(e){let t=Ne,n=e.cacheKeySuffix,r=e.directoryAbiVersion,i=[T(7,`storage`),T(8,`uniform`),T(9,`uniform`),T(10,`storage`)],a=({cacheFamily:i,label:a,entryPoint:o,bindings:s})=>Object.freeze({cacheKey:`${i}.${t}.${n}`,label:`${a}-v${r}`,code:e.shaderCode,entryPoint:o,bindings:s});return Object.freeze({schema:`peercompute.ulg.schroeder-spatial-reaction-discovery-pipeline-descriptors.v0`,directoryAbiVersion:e.directoryAbiVersion,displacement:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-displacement`,label:`ulg-schroeder-spatial-reaction-discovery-displacement`,entryPoint:`prepare_displacement_certificate`,bindings:[T(0,`read-only-storage`),T(2,`read-only-storage`),T(7,`storage`),T(9,`uniform`)]}),proposal:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-proposal`,label:`ulg-schroeder-spatial-reaction-discovery-proposal`,entryPoint:`propose`,bindings:[T(0,`read-only-storage`),T(1,`read-only-storage`),T(2,`read-only-storage`),T(3,`read-only-storage`),T(4,`read-only-storage`),T(5,`read-only-storage`),T(6,`storage`),T(7,`storage`),T(8,`uniform`),T(9,`uniform`)]}),seal:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-proposal`,label:`ulg-schroeder-spatial-reaction-discovery-seal`,entryPoint:`seal`,bindings:[T(6,`storage`),T(7,`storage`),T(9,`uniform`)]}),activationMotionBounds:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-activation-bounds`,label:`ulg-schroeder-spatial-reaction-discovery-activation-bounds`,entryPoint:`prepare_activation_motion_bounds`,bindings:[T(0,`read-only-storage`),T(1,`read-only-storage`),T(2,`read-only-storage`),T(9,`uniform`),T(10,`storage`)]}),activationMotionWatch:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-activation-watch`,label:`ulg-schroeder-spatial-reaction-discovery-activation-watch`,entryPoint:`watch_activation_motion_envelope`,bindings:[T(1,`read-only-storage`),T(2,`read-only-storage`),T(3,`read-only-storage`),T(4,`read-only-storage`),T(5,`read-only-storage`),T(7,`storage`),T(8,`uniform`),T(9,`uniform`),T(10,`storage`)]}),activationObservationWithMotion:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-activation`,label:`ulg-schroeder-spatial-reaction-discovery-activation`,entryPoint:`seal_activation_motion_watch`,bindings:i}),activationObservationWithoutMotion:a({cacheFamily:`ulg-schroeder-spatial-reaction-discovery-activation`,label:`ulg-schroeder-spatial-reaction-discovery-activation`,entryPoint:`reduce_activation_watch`,bindings:i})})}function Ut({directoryAbiVersion:e=1}={}){return Ht(Bt(e))}function Wt({directoryAbiVersions:e=[1,2]}={}){return e.flatMap(e=>{let t=Ut({directoryAbiVersion:e});return[t.displacement,t.proposal,t.seal,t.activationMotionBounds,t.activationMotionWatch,t.activationObservationWithMotion,t.activationObservationWithoutMotion]})}function Gt({authentication:e,proposalBuffer:t,evidenceBuffer:n,observedEvidence:r=null,byteLength:i,capacityByteLength:a=i}){let o=r!=null;return Object.freeze({schema:x,status:`schroeder-spatial-exact-near-gpu-authenticated`,gpuAuthenticated:!0,consumerId:e.consumerId,supportProfileId:e.supportProfileId,generationId:e.generationId,epochIdentity:e.epochIdentity,traversalCount:1,candidateVisitCount:r?.candidateVisitCount??0,exactCellTreeNodeVisitCount:r?.exactCellTreeNodeVisitCount??0,exactCellTreeLeafVisitCount:r?.exactCellTreeLeafVisitCount??0,exactCellTreeMemberVisitCount:r?.exactCellTreeMemberVisitCount??0,consumerMaskHitCount:r?.compatiblePairCount??0,migratedProposalCount:r?.proposalCount??0,ruleIndexPairLookupCount:r?.ruleIndexPairLookupCount??0,ruleIndexPairMissCount:r?.ruleIndexPairMissCount??0,ruleIndexRuleVisitCount:r?.ruleIndexRuleVisitCount??0,fullRuleScanRuleVisitCount:r?.fullRuleScanRuleVisitCount??0,candidateBytesRequired:i,candidateBytesAdmitted:i,candidateBytesCapacity:a,candidateOverflowBytes:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,overflowed:!1,partialPublication:!1,fallbackObserved:!1,fullReadbackPerformed:!1,residentCounterBuffer:n,residentProposalBuffer:t,residentCountersObserved:o,compactReadbackByteLength:o?27*Uint32Array.BYTES_PER_ELEMENT:0,observationMode:o?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,failClosedSealDispatchCount:1})}async function Kt({device:t,generation:n,sphParticleState:r=null,sphParticleUpload:i=null,positionAuthorityStateBuffer:a=null,sourceStateBuffer:o=null,sourceThermoBuffer:s=null,sourceMechanicsBuffer:c=null,reactionTable:l,reactionMotionEnvelope:u=null,boxDimsM:d=null,reactionRecordBuffer:f=null,gpuTimestampRecorder:p=null,collectGpuResidentDiagnosticEvidence:v=!1,observeGpuEvidence:y=!1,captureActivationObservation:b=!1}={}){if(!t?.createBuffer||!t.queue?.writeBuffer||!t.queue?.submit)throw TypeError(`canonical reaction discovery requires a WebGPU-like device`);let x=mt(t);if(typeof v!=`boolean`)throw TypeError(`collectGpuResidentDiagnosticEvidence must be a boolean`);if(typeof b!=`boolean`)throw TypeError(`captureActivationObservation must be a boolean`);if(u!=null&&!Te(u))throw TypeError(`reactionMotionEnvelope must be an exact sealed reaction motion envelope`);if(u&&b!==!0)throw TypeError(`reactionMotionEnvelope requires captureActivationObservation`);u&&U(u,d,`reaction discovery boxDimsM`);let C=ft(n?.source?.sourceCount,`generation.source.sourceCount`,Re);if(r?.particleCount!=null&&r.particleCount!==C)throw RangeError(`reaction discovery particle count does not match the canonical epoch`);let{reactionCount:w,combined:T}=jt(l,{requireExactPrefixMirror:b===!0});b===!0&&ve(T,w,`reactionTable`);let D=oe(T,`reaction-table-combined-records-v2`),ee=Pt({reactionTable:l,combined:T,reactionCount:w,allowIndex:f==null&&w>1,fallbackReason:f?`borrowed-caller-reaction-record-buffer`:`single-reaction-full-scan-is-cheaper`,reactionTableFingerprint:D}),O=ee.upload,te=m(O),ne=Ft(l),k=yt(t,o||i?.stateBuffer,`reaction discovery sourceStateBuffer`),A=n?.source?.sourceStateBuffer??n?.source?.exactNearQueryProfile?.sourceStateBuffer??null,j=yt(t,a||A,`reaction discovery positionAuthorityStateBuffer`);if(!A||j!==A)throw TypeError(`reaction discovery position authority must be the exact source-state buffer retained by the canonical generation`);let re=yt(t,s||i?.thermoBuffer,`reaction discovery sourceThermoBuffer`),ie=u?yt(t,c,`reaction discovery sourceMechanicsBuffer`):null,ae=yt(t,n?.source?.sourceBuffer??n?.source?.activeNodeBuffer,`reaction discovery canonical sourceBuffer`),M=ht([C,2,4,Float32Array.BYTES_PER_ELEMENT],`reaction discovery state buffer byte length`),se=ht([C,3,4,Float32Array.BYTES_PER_ELEMENT],`reaction discovery thermo buffer byte length`),ce=ht([C,8,4,Float32Array.BYTES_PER_ELEMENT],`reaction discovery mechanics buffer byte length`);xt(k,M,`reaction discovery sourceStateBuffer`,x),xt(j,M,`reaction discovery positionAuthorityStateBuffer`,x),xt(re,se,`reaction discovery sourceThermoBuffer`,x),ie&&xt(ie,ce,`reaction discovery sourceMechanicsBuffer`,x);let N=S(n,{device:t,runtime:n.runtime,consumerId:Me,supportProfileId:h,sourceBuffer:ae,expected:{generationId:n.execution?.generationId,sourceCount:C,storageGeneration:n.execution?.storageGeneration,physicsTick:n.execution?.physicsTick,physicsSubstep:n.execution?.physicsSubstep,positionEpoch:n.execution?.positionEpoch,topologyEpoch:n.execution?.topologyEpoch,supportEpoch:n.execution?.supportEpoch}});if(N?.ready!==!0||N.authenticated!==!0)throw TypeError(N?.reason||`reaction discovery could not authenticate the canonical generation`);let P=Vt(N,n),F=yt(t,N.directoryBuffer,`reaction discovery canonical directoryBuffer`),le=e(n?.exactNearCellTree,{device:t,spatialExecution:n?.execution,supportProfileId:h});if(le.ready!==!0)throw TypeError(`reaction discovery requires the submitted same-epoch exact-near cell tree`);let I=yt(t,le.treeBuffer,`reaction discovery exactNearCellTreeBuffer`);xt(F,F.size,`reaction discovery canonical directoryBuffer`,x),xt(I,I.size,`reaction discovery exactNearCellTreeBuffer`,x),Ct(x,O.byteLength,`reaction discovery reaction record buffer`);let ue=ht([C,4,Float32Array.BYTES_PER_ELEMENT],`reaction discovery proposal buffer byte length`);Ct(x,ue,`reaction discovery proposal buffer`),wt(x,P.expectationBufferByteLength,`reaction discovery expectation buffer`),wt(x,G,`reaction discovery params buffer`);let L=Math.max(1,Math.ceil(C/W));if(!Number.isSafeInteger(L)||L>x.maxComputeWorkgroupsPerDimension)throw RangeError(`reaction discovery requires ${L} workgroups; device limit is ${x.maxComputeWorkgroupsPerDimension}`);let de=Ot({device:t,limits:x,generation:n,directoryAbiVersion:P.directoryAbiVersion,expectationBufferByteLength:P.expectationBufferByteLength,proposalBytes:ue,localReactionRecordBytes:f?0:O.byteLength,observeGpuEvidence:y===!0,captureActivationObservation:b===!0}),{entry:R,lease:z}=de;try{let e=f?yt(t,f,`reaction discovery reactionRecordBuffer`):R.reactionRecordBuffer;xt(e,O.byteLength,`reaction discovery reactionRecordBuffer`,x),t.queue.writeBuffer(e,0,O);let r=R.proposalBuffer,i=new Uint32Array(27);i[9]=h,i[10]=N.generationId,i[11]=N.epochIdentity.supportEpoch,i[12]=C,i[13]=w,i[Ve]=ze;let a=R.evidenceBuffer,o=y===!0?R.evidenceReadbackBuffer:null,s=b===!0?R.activationObservationWordBuffer:null,c=b===!0?R.activationObservationReadbackBuffer:null,d=a,m=R.expectationBuffer,S=R.paramsBuffer;bt(m,P.expectationBufferByteLength,`reaction discovery expectationBuffer`),t.queue.writeBuffer(m,0,N.expectationData),t.queue.writeBuffer(S,0,It({particleCount:C,reactionCount:w,maximumContactRadiusM:ne,reactionRuleIndex:ee,collectDiagnosticEvidence:v===!0||y===!0,reactionMotionEnvelope:u})),t.queue.writeBuffer(a,0,i),b===!0&&(t.queue.writeBuffer(s,0,new Uint32Array([Je,0,0,0])),t.queue.writeBuffer(c,0,new Uint32Array([Je])));let A=Ht(P),ae=E(t,A.displacement),oe=E(t,A.proposal),fe=E(t,A.seal),B=u?E(t,A.activationMotionBounds):null,pe=u?E(t,A.activationMotionWatch):null,V=b===!0?E(t,u?A.activationObservationWithMotion:A.activationObservationWithoutMotion):null,me=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-proposal-bindings`,layout:oe.bindGroupLayout,entries:[{binding:0,resource:q(j,M)},{binding:1,resource:q(re,se)},{binding:2,resource:q(k,M)},{binding:3,resource:q(e,O.byteLength)},{binding:4,resource:q(F,F.size)},{binding:5,resource:q(I,I.size)},{binding:6,resource:q(r,ue)},{binding:7,resource:q(a,i.byteLength)},{binding:8,resource:q(m,P.expectationBufferByteLength)},{binding:9,resource:q(S,G)}]}),he=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-displacement-bindings`,layout:ae.bindGroupLayout,entries:[{binding:0,resource:q(j,M)},{binding:2,resource:q(k,M)},{binding:7,resource:q(a,i.byteLength)},{binding:9,resource:q(S,G)}]}),ge=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-seal-bindings`,layout:fe.bindGroupLayout,entries:[{binding:6,resource:q(r,ue)},{binding:7,resource:q(a,i.byteLength)},{binding:9,resource:q(S,G)}]}),_e=B?t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-activation-bounds-bindings`,layout:B.bindGroupLayout,entries:[{binding:0,resource:q(ie,ce)},{binding:1,resource:q(re,se)},{binding:2,resource:q(k,M)},{binding:9,resource:q(S,G)},{binding:10,resource:q(s,Ze)}]}):null,ve=pe?t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-activation-watch-bindings`,layout:pe.bindGroupLayout,entries:[{binding:1,resource:q(re,se)},{binding:2,resource:q(k,M)},{binding:3,resource:q(e,O.byteLength)},{binding:4,resource:q(F,F.size)},{binding:5,resource:q(I,I.size)},{binding:7,resource:q(a,i.byteLength)},{binding:8,resource:q(m,P.expectationBufferByteLength)},{binding:9,resource:q(S,G)},{binding:10,resource:q(s,Ze)}]}):null,ye=V?t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-activation-bindings`,layout:V.bindGroupLayout,entries:[{binding:7,resource:q(a,i.byteLength)},{binding:8,resource:q(m,P.expectationBufferByteLength)},{binding:9,resource:q(S,G)},{binding:10,resource:q(s,Ze)}]}):null,H=t.createCommandEncoder({label:`ulg-schroeder-spatial-reaction-discovery`}),be=e=>({producerId:`schroeder-spatial-reaction-discovery:${e}`,stage:e,spanClass:`same-production-command-encoder-profiled-pass`,generationId:N.generationId,particleCount:C,reactionCount:w,productionPassGroupingPreserved:!0}),xe=_t(p,H,be(`spatial-displacement-certificate`)),Se=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-displacement-certificate`});Se.setPipeline(ae.pipeline),Se.setBindGroup(0,he),Se.dispatchWorkgroups(L),Se.end(),vt(p,H,xe);let Ce=_t(p,H,be(`candidate-traversal`)),we=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-proposal`});we.setPipeline(oe.pipeline),we.setBindGroup(0,me),we.dispatchWorkgroups(L),we.end(),vt(p,H,Ce);let Te=_t(p,H,be(`proposal-seal`)),Ee=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-seal`});if(Ee.setPipeline(fe.pipeline),Ee.setBindGroup(0,ge),Ee.dispatchWorkgroups(L),Ee.end(),vt(p,H,Te),B){let e=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-activation-motion-bounds`});e.setPipeline(B.pipeline),e.setBindGroup(0,_e),e.dispatchWorkgroups(L),e.end();let t=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-activation-motion-watch`});t.setPipeline(pe.pipeline),t.setBindGroup(0,ve),t.dispatchWorkgroups(L),t.end()}if(V){let e=H.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-activation-reduction`});e.setPipeline(V.pipeline),e.setBindGroup(0,ye),e.dispatchWorkgroups(1),e.end(),H.copyBufferToBuffer(s,0,c,0,Xe)}y===!0&&H.copyBufferToBuffer(a,0,o,0,27*Uint32Array.BYTES_PER_ELEMENT),t.queue.submit([H.finish()]);let U=null;if(y===!0){let e,t=!1;try{await o.mapAsync(ct.READ),t=!0,e=new Uint32Array(o.getMappedRange(),0,27).slice()}catch(e){throw kt(R,z),e}finally{t&&o.unmap()}if(U=Object.freeze({sourceDispatchCount:e[0],directoryAdmissionCount:e[1],directoryRejectionCount:e[2],candidateVisitCount:e[3],compatiblePairCount:e[4],malformedTraversalCount:e[5],proposalCount:e[6],sealedRowCount:e[7],sourceIdentityRejectionCount:e[8],supportProfileId:e[9],generationId:e[10],supportEpoch:e[11],particleCount:e[12],reactionCount:e[13],privateLookupBuildCount:e[14],overflowCount:e[15],ruleIndexPairLookupCount:e[16],ruleIndexPairMissCount:e[17],ruleIndexRuleVisitCount:e[18],fullRuleScanRuleVisitCount:e[19],maximumDisplacementBits:e[Be],displacementCertificateStatusBits:e[Ve],authorityActiveCount:e[He],currentActiveCount:e[Ue],exactCellTreeNodeVisitCount:e[We],exactCellTreeLeafVisitCount:e[Ge],exactCellTreeMemberVisitCount:e[Ke]}),U.sourceDispatchCount!==C||U.directoryAdmissionCount!==C||U.directoryRejectionCount!==0||U.malformedTraversalCount!==0||U.proposalCount>C||U.sealedRowCount!==C||U.sourceIdentityRejectionCount!==0||U.supportProfileId!==65538||U.generationId!==N.generationId||U.supportEpoch!==N.epochIdentity.supportEpoch||U.particleCount!==C||U.reactionCount!==w||U.privateLookupBuildCount!==0||U.overflowCount!==0||U.displacementCertificateStatusBits!==ze)throw kt(R,z),Error(`Canonical reaction discovery GPU completion evidence was missing or rejected: ${JSON.stringify(U)}`)}let De=Gt({authentication:N,proposalBuffer:r,evidenceBuffer:a,observedEvidence:U,byteLength:ue,capacityByteLength:R.proposalCapacityBytes}),ke=_(N,De),Ne=!1,W=null,Ie=()=>!1,Le=()=>Ne?!1:(Ne=!0,W?.activationObservationInFlight===!0?(W.releaseAfterActivationObservation=!0,!0):kt(R,z)),Re={schema:Oe,status:`schroeder-spatial-reaction-discovery-proposal-submitted`,ready:!0,backend:`webgpu`,consumerId:Me,supportProfileId:h,particleCount:C,reactionCount:w,maximumContactRadiusM:ne,generation:n,generationId:N.generationId,epochIdentity:N.epochIdentity,sourcePositionAuthority:`exact-canonical-generation-source-state-buffer`,sourceCurrentStateAuthority:k===j?`same-buffer-as-canonical-position-authority`:`same-device-current-state-with-canonical-position-authority`,sourceThermalAuthority:`same-device-current-thermo-buffer`,positionAuthorityIdentityExact:!0,activationValidation:`post-thermal-proposal-filtered-and-revalidated-before-mutation`,proposalSelection:`post-thermal-nearest-phase-temperature-material-contact-then-partner-then-reaction`,displacementCertification:`gpu-parallel-e-star-to-current-state-maximum-displacement-and-active-mask-equality`,displacementCertificateBuffer:d,displacementCertificateStorage:`traversal-evidence-words-20-through-23`,sourceCurrentStateBuffer:k,sourceThermoBuffer:re,sourceMechanicsBuffer:ie,proposalBuffer:r,proposalBufferByteLength:ue,proposalBufferCapacityByteLength:R.proposalCapacityBytes,proposalRowLayout:Pe,proposalRowStrideFloats:4,reactionRecordBuffer:e,reactionTable:l,reactionTableFingerprint:D,reactionDiscoveryPayloadFingerprint:te,reactionRuleIndex:ee,reactionRecordPrefixByteLength:T.byteLength,reactionRecordUploadByteLength:O.byteLength,reactionRecordBufferOwned:!1,reactionRecordBufferOwnership:f?`borrowed-caller-buffer`:`per-device-canonical-generation-arena-cache`,reactionRecordBufferCapacityByteLength:f?Number(f.size)||T.byteLength:R.reactionRecordCapacityBytes,evidenceBuffer:a,evidenceBufferByteLength:i.byteLength,directoryBuffer:F,exactNearCellTree:le.tree,exactNearCellTreeBuffer:I,directoryAbiVersion:P.directoryAbiVersion,exactNearCellTreeTraversal:P.exactNearCellTreeTraversal,expectationBuffer:m,positionAuthorityStateBuffer:j,expectationBufferByteLength:P.expectationBufferByteLength,evidenceLayout:Fe,observedEvidence:U,evidenceObservationRequested:y===!0,evidenceObservationMode:y===!0?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,evidenceObservationReadbackByteLength:y===!0?27*Uint32Array.BYTES_PER_ELEMENT:0,activationObservationRequested:b===!0,activationObservationMode:b===!0?`deferred-schedule-terminal-four-byte-map`:`not-requested`,activationObservationReadbackByteLength:b===!0?Xe:0,activationObservationPredicateRevision:u?Ae:je,activationObservationProducerRoute:`canonical-schroeder`,activationObservationSampleStage:u?`canonical-post-thermal-pre-reaction-motion-envelope`:`canonical-post-thermal-pre-reaction-exact-current-state`,activationObservationNodeDomain:u?`fixed-phase-carrier-slot`:`primary-carrier-particle`,reactionMotionEnvelope:u,activationMotionEnvelopeEnabled:!!u,activationMotionBoundsDispatchCount:+!!u,activationMotionWatchDispatchCount:+!!u,authentication:N,gpuEvidence:De,receipt:ke,bufferOwnership:`per-device-canonical-generation-arena-cache`,spatialArenaIndex:R.arenaIndex,arenaAcquisitionOrdinal:z.acquisitionOrdinal,bufferCreationCount:de.bufferCreationCount,arenaTotalBufferCreationCount:R.totalBufferCreationCount,arenaWarmReuse:de.bufferCreationCount===0,traversalCount:1,displacementCertificateDispatchCount:1,displacementCertificateWorkgroupCount:L,displacementCertificateReductionStrategy:`particle-parallel-atomic-u32-max-and-topology-reduction`,sealDispatchCount:1,directoryBuildCount:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,candidateBudget:null,candidateMaterialization:`one-deterministic-best-row-per-source`,fallbackObserved:!1,fullReadbackPerformed:!1,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,...g({scope:`schroeder-spatial-reaction-discovery-proposal`,mapAsyncCount:+(y===!0),readbackBytes:y===!0?i.byteLength:0}),readbackMode:`no-full-readback`,cleanupTemporaryBuffersAfterSubmittedWork:Ie,destroy:Le,get released(){return Ne}};return W={proposal:Re,device:t,generation:n,directoryAbiVersion:P.directoryAbiVersion,directoryBuffer:F,exactNearCellTree:le.tree,exactNearCellTreeBuffer:I,expectationBuffer:m,positionAuthorityStateBuffer:j,sourceCurrentStateBuffer:k,sourceThermoBuffer:re,sourceMechanicsBuffer:ie,displacementCertificateBuffer:d,reactionTable:l,reactionCount:w,reactionRecords:T,reactionTableFingerprint:D,reactionDiscoveryPayloadFingerprint:te,reactionRuleIndex:ee,reactionRecordBuffer:e,reactionMotionEnvelope:u,receipt:ke,arenaEntry:R,arenaLease:z,activationObservationWordBuffer:s,activationObservationReadbackBuffer:c,activationObservationConsumed:!1,activationObservationInFlight:!1,releaseAfterActivationObservation:!1,activationObservationDeviceTerminalSignal:b===!0?lt(t):null},at.set(Re,W),Object.freeze(Re)}catch(e){throw kt(R,z),e}}function qt(e,t,n){if(!n||n!==e.device)throw dt(`reaction activation observation buffers do not match the proposal device`,TypeError);let r,i;try{r=jt(e.reactionTable,{requireExactPrefixMirror:!0}),ve(r.combined,r.reactionCount,`reactionTable`),i=oe(r.combined,`reaction-table-combined-records-v2`)}catch(e){throw dt(e,TypeError)}if(e.proposal!==t||e.generation!==t.generation||e.directoryAbiVersion!==t.directoryAbiVersion||e.reactionTable!==t.reactionTable||r.reactionCount!==e.reactionCount||r.reactionCount!==t.reactionCount||r.combined!==e.reactionRecords||e.reactionTableFingerprint!==t.reactionTableFingerprint||i!==t.reactionTableFingerprint||e.sourceCurrentStateBuffer!==t.sourceCurrentStateBuffer||e.sourceThermoBuffer!==t.sourceThermoBuffer||e.sourceMechanicsBuffer!==t.sourceMechanicsBuffer||e.reactionMotionEnvelope!==t.reactionMotionEnvelope||e.reactionMotionEnvelope!=null&&!Te(e.reactionMotionEnvelope)||e.receipt!==t.receipt||!b(t.receipt)||!e.activationObservationWordBuffer||!e.activationObservationReadbackBuffer||e.activationObservationWordBuffer!==e.arenaEntry?.activationObservationWordBuffer||e.activationObservationReadbackBuffer!==e.arenaEntry?.activationObservationReadbackBuffer||!s(e.activationObservationWordBuffer,n)||!s(e.activationObservationReadbackBuffer,n)||e.activationObservationWordBuffer.size!==Ze||e.activationObservationReadbackBuffer.size!==Xe||t.activationObservationReadbackByteLength!==Xe)throw dt(`reaction activation observation proposal failed immutable authenticity`,TypeError);return!0}async function Jt(e,{device:t=null}={}){let n=0;try{let r=at.get(e);if(!r||r.proposal!==e||e?.schema!==`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`||e.ready!==!0||e.released===!0)throw dt(`reaction activation observation requires a live authentic proposal`,TypeError);if(e.activationObservationRequested!==!0)throw dt(`reaction activation observation was not requested`,TypeError);if(r.activationObservationConsumed===!0)throw dt(`reaction activation observation was already consumed`);if(!r.arenaEntry||r.arenaEntry.inUse!==!0||r.arenaEntry.lease!==r.arenaLease||r.arenaEntry.activationObservationLease!==r.arenaLease)throw dt(`reaction activation observation lost its authenticated arena lease`,TypeError);let a=t||i(r.activationObservationReadbackBuffer);qt(r,e,a);let o=r.activationObservationReadbackBuffer;r.activationObservationConsumed=!0,r.activationObservationInFlight=!0;let s=!1,c;try{if(n=1,r.activationObservationDeviceTerminalSignal?.observed)throw Error(`reaction activation observation aborted because the WebGPU device was lost`);let e=Promise.resolve(o.mapAsync(ct.READ));if(e.catch(()=>{}),(r.activationObservationDeviceTerminalSignal?.promise?await Promise.race([e.then(()=>`mapped`),r.activationObservationDeviceTerminalSignal.promise]):await e.then(()=>`mapped`))!==`mapped`)throw Error(`reaction activation observation aborted because the WebGPU device was lost while MAP_READ was pending`);s=!0;let t=o.getMappedRange(0,Xe);if(!t||typeof t.byteLength!=`number`||t.byteLength!==Xe)throw dt(`reaction activation observation returned a malformed mapped range`,RangeError);c=new Uint32Array(t,0,1)[0]}finally{try{s&&o.unmap()}finally{r.activationObservationInFlight=!1,r.releaseAfterActivationObservation===!0&&kt(r.arenaEntry,r.arenaLease)}}qt(r,e,a);let l=c===Je;if(!l&&(!Number.isSafeInteger(c)||c<Ye||c>e.particleCount+Ye))throw dt(`reaction activation observation word exceeded its authenticated source domain`,RangeError);let u=l?null:c-Ye;if(!l&&e.reactionMotionEnvelope?.thermalPhaseEvolutionEnabled===!0&&u!==e.particleCount)throw dt(`thermal/phase-latched reaction activation observation did not trigger every fixed carrier slot`);let d=l?qe:u;return Object.freeze({schema:ke,status:l?`reaction-activation-observation-uncertain`:`reaction-activation-observation-ready`,predicateRevision:e.activationObservationPredicateRevision,producerRoute:e.activationObservationProducerRoute,sampleStage:e.activationObservationSampleStage,nodeDomain:e.activationObservationNodeDomain,motionEnvelope:e.reactionMotionEnvelope,shadowOnly:!0,routingAuthority:!1,observationSucceeded:!l,triggered:l||u>0,triggeredSourceCount:u,uncertainty:l,rawEvidenceWord:d,particleCount:e.particleCount,reactionCount:e.reactionCount,reactionTableFingerprint:e.reactionTableFingerprint,mapAsyncCount:1,readbackByteLength:Xe,fullParticleReadbackPerformed:!1})}catch(e){throw ut(e,n)}}var Yt=`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`,Xt=D({producerFamily:`schroeder-reaction-placement-source-family`}),Zt=D({producerFamily:`schroeder-reaction-placement-transferred-destination`}),Qt=`peercompute.ulg.sph-reaction-resolve-position-invariant-certificate.v1`,$t=`post-reaction-pre-placement`,en=`schroeder-shared-canonical-displaced-post-reaction-pre-placement-x-r`,tn=`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`,nn=`peercompute.ulg.schroeder-spatial-reaction-placement-liveness.v1`,rn=`peercompute.ulg.sph-reaction-warm-arena.v1`,an=`peercompute.ulg.sph-reaction-warm-arena-lease.v1`,on={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},sn=new WeakSet,cn=new WeakMap,ln=new WeakSet,J=new WeakMap,un=new WeakSet,dn=new WeakMap,fn=new WeakMap,pn=new WeakMap,mn=new WeakMap,hn=3;function Y(e,t=`CONTRACT`){let n=Error(e);return n.code=`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_${t}`,n}function X(e,t,{positive:n=!1}={}){if(typeof e!=`number`||!Number.isInteger(e)||e<+!!n||e>4294967295)throw Y(`${t} must be an exact ${n?`positive `:``}u32`,`IDENTITY`);return e}function gn(e,t){let n=X(e,t);if(n===4294967295)throw Y(`${t} exhausted the u32 identity space; wrapping would alias a live epoch`,`IDENTITY_EXHAUSTED`);return n+1}function _n(e,t){return Number.isInteger(e)&&e>=0&&e<4294967295&&Number.isInteger(t)&&t===e+1}function Z(e,t,n,r=0){if(!t||i(t)!==e||!s(t,e))throw Y(`${n} must be a tagged live buffer on the placement device`,`DEVICE_MISMATCH`);if(r>0&&Number.isFinite(Number(t.size))&&Number(t.size)<r)throw Y(`${n} has ${t.size} bytes; ${r} required`,`CAPACITY`);return t}function vn(e,t,n){if(t?.selected!==!0||t?.ready!==!0||t?.execution?.released===!0||t?.releaseScheduled===!0)throw Y(`placement epoch requires one live selected ancestor public generation`,`ANCESTOR_GENERATION`);if(t.source?.sourceCount!==n||t.execution?.sourceCount!==n)throw Y(`placement particle count does not match the ancestor public generation`,`ANCESTOR_GENERATION`);X(t.execution?.generationId,`ancestor generationId`,{positive:!0}),X(t.execution?.storageGeneration,`ancestor storageGeneration`,{positive:!0});for(let e of[`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`])X(t.execution?.[e],`ancestor ${e}`);Z(e,t.execution?.directoryBuffer,`ancestor public directory`),C(t,e);let r=t.execution?.exactNearQueryProfile;if(r?.ready!==!0||t.source?.exactNearQueryProfile?.ready!==!0||t.execution?.queryChartId!==r.chartId||t.execution?.queryMinLevel!==r.minLevel||t.execution?.queryMaxLevel!==r.maxLevel||!Object.is(t.execution?.queryBaseGridSpacingM,r.baseGridSpacingM))throw Y(`ancestor generation lacks exact authenticated query geometry`,`ANCESTOR_QUERY_GEOMETRY`);return t}function yn(e){return Object.freeze({storageGeneration:X(e?.storageGeneration,`placement storageGeneration`,{positive:!0}),physicsTick:X(e?.physicsTick,`placement physicsTick`),physicsSubstep:X(e?.physicsSubstep,`placement physicsSubstep`),positionEpoch:X(e?.positionEpoch,`placement positionEpoch`),topologyEpoch:X(e?.topologyEpoch,`placement topologyEpoch`),chartEpoch:X(e?.chartEpoch,`placement chartEpoch`),levelEpoch:X(e?.levelEpoch,`placement levelEpoch`),supportEpoch:X(e?.supportEpoch,`placement supportEpoch`)})}function bn(e,t,n){return d(e.createBuffer({label:t,size:Math.max(4,n),usage:on.STORAGE|on.COPY_SRC|on.COPY_DST}),e)}function xn(e,t,n){let r=e*t*Float32Array.BYTES_PER_ELEMENT;if(!Number.isSafeInteger(r)||r<4)throw Y(`${n} capacity is not safely addressable`,`WARM_ARENA_CAPACITY`);return r}function Sn(e,t,n){let r=[Number(e?.limits?.maxBufferSize),Number(e?.limits?.maxStorageBufferBindingSize)].filter(e=>Number.isFinite(e)&&e>0),i=r.length>0?Math.min(...r):2**53-1;if(t>i)throw Y(`${n} requires ${t} bytes; device limit is ${i}`,`WARM_ARENA_CAPACITY`);return t}function Cn(e){let t=fn.get(e);return t||(t=new Map,fn.set(e,t)),t}function wn({particleCapacity:e,productEventCapacity:t,productTermCapacity:n,packedParticleStrideFloats:r,productEventStrideFloats:i,productPlacementSummaryStrideFloats:a}){return[e,t,n,r,i,a].join(`:`)}function Q(e,t,n,r,i){let a=d(e.createBuffer({label:n,size:Math.max(4,r),usage:i}),e);return t.push(a),a}function Tn(e,{force:t=!1}={}){if(!e||e.destroyed)return!1;if(e.inFlight&&!e.deviceLost&&!t)throw Y(`cannot destroy an in-flight reaction warm arena`,`WARM_ARENA_LEASE`);e.destroyed=!0,e.terminal=!0,e.inFlight=!1,e.phase=`destroyed`;for(let t of e.ownedBuffers)try{t?.destroy?.()}catch{}return e.ownedBuffers.clear(),!0}function En(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.deviceLossStatus=`device-loss-promise-unavailable`;return}e.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined`,e.deviceLossReason=t?.message??String(t||`device lost`),Tn(e,{force:!0})},t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined-after-rejection`,e.deviceLossReason=t instanceof Error?t.message:String(t),Tn(e,{force:!0})})}function Dn(e,t,n){let{particleCapacity:r,productEventCapacity:i,productTermCapacity:a,packedParticleStrideFloats:o,productEventStrideFloats:s,productPlacementSummaryStrideFloats:d,capacityKey:f}=t,p=Sn(e,xn(r,o,`packed reaction particle rows`),`packed reaction particle rows`),m=Sn(e,xn(r,c,`reaction state rows`),`reaction state rows`),h=Sn(e,xn(r,u,`reaction thermo rows`),`reaction thermo rows`),g=Sn(e,xn(r,l,`reaction mechanics rows`),`reaction mechanics rows`),_=Sn(e,xn(i,s,`reaction product-event rows`),`reaction product-event rows`),v=Sn(e,xn(a,d,`reaction product-placement summary rows`),`reaction product-placement summary rows`),y=[],b=`ulg-sph-reaction-warm-${f}-slot-${n}`,x=on.STORAGE|on.COPY_SRC|on.COPY_DST;try{let t=Object.freeze({packedSource:Q(e,y,`${b}-packed-source`,p,x),packedOutput:Q(e,y,`${b}-packed-output`,p,x),fallbackState:Q(e,y,`${b}-fallback-state`,m,x),fallbackThermo:Q(e,y,`${b}-fallback-thermo`,h,x),fallbackMechanics:Q(e,y,`${b}-fallback-mechanics`,g,x),resolvedState:Q(e,y,`${b}-resolved-state`,m,x),resolvedThermo:Q(e,y,`${b}-resolved-thermo`,h,x),resolvedMechanics:Q(e,y,`${b}-resolved-mechanics`,g,x),placedState:Q(e,y,`${b}-placed-state`,m,x),placedThermo:Q(e,y,`${b}-placed-thermo`,h,x),placedMechanics:Q(e,y,`${b}-placed-mechanics`,g,x),productEvent:Q(e,y,`${b}-product-event`,_,x),productPlacementSummary:Q(e,y,`${b}-product-placement-summary`,v,x),reactionParams:Q(e,y,`${b}-reaction-params`,48,on.UNIFORM|on.COPY_DST),summaryParams:Q(e,y,`${b}-summary-params`,48,on.UNIFORM|on.COPY_DST)}),c=Object.freeze({schema:rn,status:`sph-reaction-warm-arena-ready`,capacityKey:f,slotIndex:n,particleCapacity:r,productEventCapacity:i,productTermCapacity:a,packedParticleStrideFloats:o,productEventStrideFloats:s,productPlacementSummaryStrideFloats:d,buffers:t}),l={device:e,arena:c,buffers:t,ownedBuffers:new Set(y),bufferCreationCount:y.length,acquisitionCount:0,warmReuseCount:0,leaseOrdinal:0,inFlight:!1,phase:`idle`,terminal:!1,deviceLost:!1,destroyed:!1,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null,releaseFence:null,boundSourceFamily:null,destinationOwnershipTransferred:!1};return pn.set(c,l),En(l),c}catch(e){for(let e of y.reverse())try{e?.destroy?.()}catch{}throw e}}function On({device:e,particleCapacity:t,productEventCapacity:n,productTermCapacity:r,packedParticleStrideFloats:i=52,productEventStrideFloats:a=32,productPlacementSummaryStrideFloats:o=32}={}){if(!e?.createBuffer||!e?.queue?.writeBuffer)throw TypeError(`reaction warm arena acquisition requires a WebGPU-like device`);let s={particleCapacity:X(t,`reaction warm particleCapacity`,{positive:!0}),productEventCapacity:X(n,`reaction warm productEventCapacity`,{positive:!0}),productTermCapacity:X(r,`reaction warm productTermCapacity`,{positive:!0}),packedParticleStrideFloats:X(i,`reaction warm packedParticleStrideFloats`,{positive:!0}),productEventStrideFloats:X(a,`reaction warm productEventStrideFloats`,{positive:!0}),productPlacementSummaryStrideFloats:X(o,`reaction warm productPlacementSummaryStrideFloats`,{positive:!0})};s.capacityKey=wn(s);let c=Cn(e),l=c.get(s.capacityKey);l||(l={records:[]},c.set(s.capacityKey,l)),l.records=l.records.filter(e=>!e.destroyed);let u=l.records.find(e=>!e.inFlight&&!e.terminal&&!e.deviceLost&&!e.destroyed)??null,d=0;if(u)u.warmReuseCount+=1;else{if(l.records.length>=hn){let e=Y(`reaction warm arena ${s.capacityKey} is under bounded backpressure`,`WARM_ARENA_BACKPRESSURE`),t=l.records.map(e=>e.releaseFence).filter(e=>e?.then);throw e.retryAfterFence=t.length>0?Promise.any(t.map(e=>Promise.resolve(e).then(e=>{if(e===!0)return!0;throw Y(`reaction warm arena release did not confirm reusable ownership`,`WARM_ARENA_BACKPRESSURE_RELEASE`)}))).then(()=>!0,()=>!1):null,e}let t=new Set(l.records.map(e=>e.arena.slotIndex)),n=0;for(;t.has(n);)n+=1;let r=Dn(e,s,n);u=pn.get(r),l.records.push(u),d=u.bufferCreationCount}u.inFlight=!0,u.phase=`leased`,u.acquisitionCount+=1,u.leaseOrdinal+=1,u.releaseFence=null,u.boundSourceFamily=null,u.destinationOwnershipTransferred=!1;let f=Object.freeze({schema:an,status:`sph-reaction-warm-arena-leased`,arena:u.arena,leaseOrdinal:u.leaseOrdinal,bufferCreationCount:d,warmReuse:d===0});return mn.set(f,{record:u,leaseOrdinal:u.leaseOrdinal,releaseScheduled:!1,released:!1}),f}async function kn(e={}){let t=typeof e.onHostQueueFenceAwait==`function`?e.onHostQueueFenceAwait:null;for(;;)try{return On(e)}catch(e){if(e?.code!==`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE`)throw e;if(!e.retryAfterFence?.then){let t=Y(`reaction warm arena is exhausted without a scheduled exact-owner release`,`WARM_ARENA_BACKPRESSURE_UNRELEASABLE`);throw t.cause=e,t}let n=!1;try{try{t?.({source:`reaction-warm-arena-backpressure`,count:1})}catch{}n=await e.retryAfterFence}catch{n=!1}if(n!==!0){let t=Y(`reaction warm arena queue fences completed without a reusable slot`,`WARM_ARENA_BACKPRESSURE_RELEASE_FAILED`);throw t.cause=e,t}}}function An(e,{device:t=null}={}){let n=mn.get(e),r=n?.record;if(!n||!r||r.destroyed||r.terminal||!r.inFlight||r.phase!==`leased`||n.releaseScheduled||n.released||n.leaseOrdinal!==r.leaseOrdinal||e?.arena!==r.arena||t&&r.device!==t)throw Y(`reaction warm arena lease is stale, terminal, or foreign`,`WARM_ARENA_LEASE`);return{leaseRecord:n,record:r}}function jn(e,{device:t,particleCapacity:n=null,productEventCapacity:r=null,productTermCapacity:i=null}={}){let{record:a}=An(e,{device:t}),o=a.arena;for(let[e,t,a]of[[`particleCapacity`,n,o.particleCapacity],[`productEventCapacity`,r,o.productEventCapacity],[`productTermCapacity`,i,o.productTermCapacity]])if(t!=null&&t!==a)throw Y(`reaction warm arena ${e} does not match this execution`,`WARM_ARENA_IDENTITY`);return o}function Mn(e,t,n){let{record:r}=An(e,{device:n});if(r.boundSourceFamily&&r.boundSourceFamily!==t)throw Y(`reaction warm arena is already bound to another placement source family`,`WARM_ARENA_IDENTITY`);return r.boundSourceFamily=t,!0}function Nn(e,t,n){let{record:r}=An(e,{device:n});if(r.boundSourceFamily!==t)throw Y(`reaction warm destination transfer requires its exact source family`,`WARM_ARENA_OWNERSHIP`);return r.destinationOwnershipTransferred?!1:(r.destinationOwnershipTransferred=!0,!0)}function Pn(e,{completionFence:t=null}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=J.get(e);if(!n||!n.destinationOwnershipTransferred||n.lifecycle.releaseScheduled!==!0||!n.finalizedPlacementArtifact||!n.positionEpochFloorReceipt)throw Y(`transferred placement destinations require their exact finalized owner handoff`,`OWNERSHIP_TRANSFER`);if(n.destinationReturnScheduled)return!1;if(n.destinationCleanupClaim!=null){if(typeof n.destinationCleanup!=`function`)throw Y(`transferred placement destination claim has no exact cleanup owner`,`OWNERSHIP_TRANSFER`);try{w(n.destinationCleanupClaim,n.device,{producerOutput:e,cleanup:n.destinationCleanup})}catch{throw Y(`sealed placement destination cleanup requires its exact queue-ordered final consumer`,`OWNERSHIP_TRANSFER`)}}let r=t??(typeof n.device.queue?.onSubmittedWorkDone==`function`?n.device.queue.onSubmittedWorkDone():null);if(!r?.then)throw Y(`transferred placement destination release requires a queue fence`,`OWNERSHIP_TRANSFER_FENCE`);let i=n.lifecycle.releasePromise?.then?n.lifecycle.releasePromise:Promise.resolve(!0),a=Promise.all([i,r]).then(([e])=>{if(e!==!0)throw Y(`placement source retirement was not confirmed before destination return`,`OWNERSHIP_TRANSFER_FENCE`);return!0});return n.destinationReturnScheduled=!0,n.reactionWarmArenaLease?(n.destinationReturnPromise=In(n.reactionWarmArenaLease,{device:n.device,completionFence:a,destinationOwner:e}),n.destinationReturnPromise):(n.destinationReturnPromise=a.then(()=>($(n,`placed-state`,n.family.placedDestinationStateBuffer),$(n,`placed-thermo`,n.family.placedDestinationThermoBuffer),$(n,`placed-mechanics`,n.family.placedDestinationMechanicsBuffer),!0)),n.destinationReturnPromise)}function Fn(e,{queueOrderedFinalConsumer:t=null}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=J.get(e);if(!n||!n.destinationOwnershipTransferred||n.lifecycle.releaseScheduled!==!0||!n.destinationCleanupClaim||!n.destinationCleanup||!t||!n.positionEpochFloorReceipt)throw Y(`queue-ordered destination release requires its exact submitted placement owner`,`OWNERSHIP_TRANSFER`);if(n.destinationReturnScheduled)return!1;n.destinationReturnScheduled=!0;let r=O(n.device,n.destinationCleanup,{queueOrderedFinalConsumer:t,producerClaim:n.destinationCleanupClaim,producerOutput:e,producerFamily:`schroeder-reaction-placement-transferred-destination`});return n.destinationReturnPromise=Promise.resolve(r).then(()=>!0),n.destinationReturnPromise}function In(e,{device:t,completionFence:n=null,destinationOwner:r=null,abandon:i=!1,destroy:a=!1}={}){let{leaseRecord:o,record:s}=An(e,{device:t});if(s.destinationOwnershipTransferred&&i!==!0&&r!==s.boundSourceFamily)throw Y(`reaction warm arena release requires the exact transferred destination owner`,`WARM_ARENA_OWNERSHIP`);let c=n??(typeof t?.queue?.onSubmittedWorkDone==`function`?t.queue.onSubmittedWorkDone():null);if(!c||typeof c.then!=`function`)throw Y(`reaction warm arena release requires a genuine queue completion fence`,`WARM_ARENA_FENCE`);return o.releaseScheduled=!0,s.phase=`retiring`,s.releaseFence=Promise.resolve(c).then(()=>(o.released=!0,s.inFlight=!1,s.boundSourceFamily=null,s.destinationOwnershipTransferred=!1,a||s.terminal||s.deviceLost?(Tn(s,{force:!0}),!1):(s.phase=`idle`,!0)),e=>(o.released=!0,s.inFlight=!1,s.terminal=!0,s.deviceLossStatus=`queue-fence-rejected-arena-quarantined`,s.deviceLossReason=e instanceof Error?e.message:String(e),Tn(s,{force:!0}),!1)),s.releaseFence}function Ln({frozenSourceStateBuffer:e,frozenSourceThermoBuffer:t,frozenSourceMechanicsBuffer:n,placedDestinationStateBuffer:r,placedDestinationThermoBuffer:i,placedDestinationMechanicsBuffer:a}){let o=[e,t,n],s=[r,i,a];if(new Set(o).size!==o.length)throw Y(`frozen placement state, thermo, and mechanics sources must be distinct buffers`,`SOURCE_ALIAS`);for(let e of s)if(o.includes(e))throw Y(`frozen placement sources and mutable placed destinations must never alias`,`SOURCE_DESTINATION_ALIAS`);if(new Set(s).size!==s.length)throw Y(`placed state, thermo, and mechanics destinations must be distinct buffers`,`DESTINATION_ALIAS`)}function Rn(e,t){let n=e.createCommandEncoder({label:`ulg-schroeder-reaction-placement-destination-initialize`});if(typeof n?.copyBufferToBuffer!=`function`)throw Y(`placement destination initialization requires copyBufferToBuffer`,`COPY_UNAVAILABLE`);return n.copyBufferToBuffer(t.frozenSourceStateBuffer,0,t.placedDestinationStateBuffer,0,t.stateBufferByteLength),n.copyBufferToBuffer(t.frozenSourceThermoBuffer,0,t.placedDestinationThermoBuffer,0,t.thermoBufferByteLength),n.copyBufferToBuffer(t.frozenSourceMechanicsBuffer,0,t.placedDestinationMechanicsBuffer,0,t.mechanicsBufferByteLength),e.queue.submit([n.finish()]),Object.freeze({schema:`peercompute.ulg.schroeder-reaction-placement-initialization-submission.v0`,status:`placement-destination-initialization-submitted`,submissionObserved:!0,hostQueueFenceCount:0,queueCompletionMethod:`same-gpu-queue-submission-order`,device:e,family:t})}function $(e,t,n){e.destroyed.has(t)||(e.destroyed.add(t),n?.destroy?.())}function zn(e){e.auxiliaryDestroyed||(e.auxiliaryDestroyed=!0,typeof e.levelAssignment?.destroyAssignmentBuffer==`function`?e.levelAssignment.destroyAssignmentBuffer():$(e,`level-assignment`,e.levelAssignment?.assignmentBuffer),e.reactionWarmArenaLease||($(e,`frozen-state`,e.family.frozenSourceStateBuffer),$(e,`frozen-thermo`,e.family.frozenSourceThermoBuffer),$(e,`frozen-mechanics`,e.family.frozenSourceMechanicsBuffer)))}function Bn(e){e.destinationOwnershipTransferred||e.reactionWarmArenaLease||(e.callerOwnedDestinations.state||$(e,`placed-state`,e.family.placedDestinationStateBuffer),e.callerOwnedDestinations.thermo||$(e,`placed-thermo`,e.family.placedDestinationThermoBuffer),e.callerOwnedDestinations.mechanics||$(e,`placed-mechanics`,e.family.placedDestinationMechanicsBuffer))}function Vn(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.lifecycle.deviceLossStatus=`device-loss-promise-unavailable`;return}e.lifecycle.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{if(e.lifecycle.releaseStatus!==`released-after-final-consumer`){e.lifecycle.deviceLossStatus=`device-loss-cleanup-running`,e.deviceLost=!0,e.lifecycle.deviceLossReason=t?.message??String(t||`device lost`);try{zn(e),Bn(e),e.lifecycle.deviceLossStatus=`device-loss-cleanup-completed`}catch(t){e.lifecycle.deviceLossStatus=`device-loss-cleanup-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)}}}).catch(t=>{e.lifecycle.deviceLossStatus=`device-loss-observer-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)})}function Hn({device:e,ancestorGeneration:t,reactionInputStateBuffer:n,reactionInputThermoBuffer:r,reactionInputMechanicsBuffer:i,transactionRollbackThermoBuffer:a,transactionRollbackMechanicsBuffer:o,frozenResolvedStateBuffer:s,particleCount:d,reactionDiscoveryProposal:f=null,reactionTable:p=null}={}){let m=X(d,`particleCount`,{positive:!0}),h=vn(e,t,m),g=Z(e,n,`reaction input state`,m*c*Float32Array.BYTES_PER_ELEMENT),_=Z(e,a,`pre-reaction transaction rollback thermo`,m*u*Float32Array.BYTES_PER_ELEMENT),v=Z(e,r,`reaction input thermo`,m*u*Float32Array.BYTES_PER_ELEMENT),b=Z(e,o,`pre-reaction transaction rollback mechanics`,m*l*Float32Array.BYTES_PER_ELEMENT),x=Z(e,i,`reaction input mechanics`,m*l*Float32Array.BYTES_PER_ELEMENT);if(v!==_||x!==b)throw Y(`reaction input thermo and mechanics must be the exact transaction rollback family`,`RESOLVE_ROLLBACK_AUTHORITY`);let S=Z(e,s,`frozen resolved state`),C=`exact-ancestor-position-authority-state`,w=X(h.execution.positionEpoch,`ancestor position epoch`),T=!1,E=w,D=null;if(f==null&&p!=null)throw Y(`reaction discovery table authority cannot be supplied without the exact branded proposal`,`RESOLVE_DISCOVERY_AUTHORITY`);if(f!=null){if(D=At(f,{device:e,generation:h,particleCount:m,reactionCount:p?.reactionCount,reactionTable:p,sourceStateBuffer:g,sourceThermoBuffer:v}),D?.ready!==!0||D.authenticated===!1||D.admitted!==!0||D.generation!==h||D.positionAuthorityStateBuffer!==h.source?.sourceStateBuffer||D.sourceCurrentStateBuffer!==g||D.sourceThermoBuffer!==v)throw Y(D?.reason||`resolve-position certificate requires the exact authenticated reaction discovery source family`,`RESOLVE_DISCOVERY_AUTHORITY`);T=g!==h.source?.sourceStateBuffer,E=T?gn(w,`post-G2P reaction discovery position epoch`):w,C=T?`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`:`authenticated-reaction-discovery-over-exact-ancestor-position-state`}else if(g!==h.source?.sourceStateBuffer)throw Y(`resolve-position certificate requires the exact ancestor source state`,`RESOLVE_SOURCE_IDENTITY`);if(n===s)throw Y(`reaction input and frozen resolved state must be distinct buffers`,`RESOLVE_ALIAS`);if(new Set([g,_,b,S]).size!==4)throw Y(`pre-reaction rollback state, thermo, mechanics, and post-reaction resolved state must not alias`,`RESOLVE_ALIAS`);let ee=Object.freeze({schema:Qt,status:`reaction-resolve-position-invariance-certified`,certified:!0,stageIdentity:`reaction-resolve`,mutationPolicy:`xyz-copied-exactly-mass-velocity-energy-material-phase-mechanics-may-change`,sourceAuthority:C,prePlacementPositionChanged:T,ancestorPositionEpoch:w,resolvedPositionEpoch:E,ancestorGenerationId:h.execution.generationId,ancestorPositionEpoch:h.execution.positionEpoch,particleCount:m,deviceId:y(e)});return sn.add(ee),cn.set(ee,{device:e,ancestorGeneration:h,reactionInputStateBuffer:g,reactionInputThermoBuffer:v,reactionInputMechanicsBuffer:x,transactionRollbackThermoBuffer:_,transactionRollbackMechanicsBuffer:b,reactionDiscoveryProposal:f,reactionTable:p,sourceAuthority:C,prePlacementPositionChanged:T,ancestorPositionEpoch:w,resolvedPositionEpoch:E,frozenResolvedStateBuffer:S,particleCount:m}),ee}function Un(e,{device:t,ancestorGeneration:n,particleCount:r}){try{if(e.reactionInputThermoBuffer!==e.transactionRollbackThermoBuffer||e.reactionInputMechanicsBuffer!==e.transactionRollbackMechanicsBuffer)return!1;Z(t,e.transactionRollbackThermoBuffer,`current pre-reaction transaction rollback thermo`,r*u*Float32Array.BYTES_PER_ELEMENT),Z(t,e.transactionRollbackMechanicsBuffer,`current pre-reaction transaction rollback mechanics`,r*l*Float32Array.BYTES_PER_ELEMENT)}catch{return!1}if(e.sourceAuthority===`exact-ancestor-position-authority-state`)return e.reactionDiscoveryProposal==null&&e.reactionTable==null&&e.reactionInputStateBuffer===n.source?.sourceStateBuffer&&e.prePlacementPositionChanged===!1&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===n.execution.positionEpoch;if(![`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`,`authenticated-reaction-discovery-over-exact-ancestor-position-state`].includes(e.sourceAuthority)||e.reactionDiscoveryProposal==null||e.reactionTable==null||e.reactionInputThermoBuffer==null)return!1;try{let i=At(e.reactionDiscoveryProposal,{device:t,generation:n,particleCount:r,reactionCount:e.reactionTable.reactionCount,reactionTable:e.reactionTable,sourceStateBuffer:e.reactionInputStateBuffer,sourceThermoBuffer:e.reactionInputThermoBuffer}),a=e.reactionInputStateBuffer!==n.source?.sourceStateBuffer,o=a?gn(n.execution.positionEpoch,`post-G2P reaction discovery position epoch`):n.execution.positionEpoch;return i?.ready===!0&&i.admitted===!0&&i.generation===n&&i.positionAuthorityStateBuffer===n.source?.sourceStateBuffer&&i.sourceCurrentStateBuffer===e.reactionInputStateBuffer&&i.sourceThermoBuffer===e.reactionInputThermoBuffer&&e.prePlacementPositionChanged===a&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===o}catch{return!1}}function Wn(e){return!!(e&&ln.has(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`&&e.ready===!0&&e.authenticated===!0)}function Gn(e,{device:t=null}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=J.get(e);if(!n||t&&n.device!==t)throw Y(`placement source family belongs to another device`,`DEVICE_MISMATCH`);if(n.deviceLost)throw Y(`placement source family is quarantined after device loss: ${n.lifecycle.deviceLossReason}`,`DEVICE_LOST`);if(n.lifecycle.releaseScheduled===!0||n.lifecycle.releaseStatus===`released-after-final-consumer`)throw Y(`placement source family is terminal or retiring`,`RETIRED`);if(Ln(e),e.generation!==n.generation||e.ancestorPublicGeneration!==n.generation||e.sharedSpatialAuthorityBorrowed!==!0||e.private!==!1||n.ownsGeneration!==!1||e.directoryBuffer!==n.generation.execution.directoryBuffer||e.directorySourceBuffer!==n.generation.source.sourceBuffer||e.directoryPositionAuthorityStateBuffer!==n.generation.source.sourceStateBuffer)throw Y(`placement source family no longer identifies its exact borrowed canonical generation`,`SOURCE_FAMILY_IDENTITY`);return e}function Kn(e,{device:t=null}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=J.get(e);if(!n||t&&n.device!==t)throw Y(`placement source family belongs to another device`,`DEVICE_MISMATCH`);return Object.freeze({schema:nn,status:n.deviceLost?`schroeder-reaction-placement-source-family-device-lost-quarantined`:n.lifecycle.releaseScheduled?`schroeder-reaction-placement-source-family-retiring`:`schroeder-reaction-placement-source-family-active`,active:!n.deviceLost&&n.lifecycle.releaseScheduled!==!0,releaseScheduled:n.lifecycle.releaseScheduled===!0,releaseStatus:n.lifecycle.releaseStatus,deviceLost:n.deviceLost===!0,deviceLossStatus:n.lifecycle.deviceLossStatus,destinationOwnershipTransferred:n.destinationOwnershipTransferred,destinationStorageGeneration:e.placedDestinationStorageGeneration,deviceId:e.deviceId,generationId:e.generationId})}async function qn(e,{placementArtifact:t}={}){let r=Gn(e),i=J.get(r);if(i.positionEpochFloorReceipt){if(i.finalizedPlacementArtifact!==t)throw Y(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return i.positionEpochFloorReceipt}let a=await n(()=>import(`./schroederSpatialReactionProductPlacementGpu-1Me7ExOp.js`),[],import.meta.url),o=Gn(e,{device:i.device});if(o!==r||J.get(o)!==i||i.generation?.execution?.released===!0||i.generation?.releaseScheduled===!0)throw Y(`placement source family retired while finalizing its position epoch floor`,`RETIRED`);if(i.positionEpochFloorReceipt){if(i.finalizedPlacementArtifact!==t)throw Y(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return i.positionEpochFloorReceipt}if(!a.isSubmittedSchroederSpatialReactionProductPlacementArtifact?.(t)||t.submitPerformed!==!0||t.gpuResident!==!0||t.authenticated!==!1||t.gpuAuthenticated!==!1||t.submissionAuthenticated!==!0||t.destinationSafetyAuthenticated!==!0||t.placementOutcomeObserved!==!1||t.transactionalPublicationGateEncoded!==!0||t.transactionalTerminalSealEncoded!==!0||t.transactionalFailClosedRecoveryEncoded!==!0||t.transactionalAuxiliaryMaterializationEncoded!==!0||t.destinationPublicationMode!==`gpu-terminal-safe-placed-or-exact-pre-reaction-fallback`||t.positionMayChange!==!0||t.topologyMayChange!==!0||t.placementSourceFamily!==e||t.generation!==i.generation||t.placedDestinationStateBuffer!==e.placedDestinationStateBuffer||t.placedDestinationThermoBuffer!==e.placedDestinationThermoBuffer||t.placedDestinationMechanicsBuffer!==e.placedDestinationMechanicsBuffer||t.frozenSourceStateBuffer!==e.frozenSourceStateBuffer||t.frozenSourceThermoBuffer!==e.frozenSourceThermoBuffer||t.frozenSourceMechanicsBuffer!==e.frozenSourceMechanicsBuffer)throw Y(`position epoch floor requires the exact one-shot resident placement-submission artifact`,`FINALIZATION`);let s=e.epochIdentity.positionEpoch,c=gn(s,`placement position epoch floor`),l=Object.freeze({schema:tn,status:`schroeder-reaction-placement-position-epoch-floor-authenticated-after-resident-submission`,finalized:!0,authenticated:!0,positionEpochFloorAuthenticated:!0,destinationSafetyAuthenticated:!0,placementOutcomeAuthenticated:!1,submitPerformed:!0,gpuCompletionObserved:!1,placementOutcomeObserved:!1,transactionalPublicationGateEncoded:!0,transactionalTerminalSealEncoded:!0,transactionalFailClosedRecoveryEncoded:!0,transactionalAuxiliaryMaterializationEncoded:!0,destinationPublicationMode:`gpu-terminal-safe-placed-or-exact-pre-reaction-fallback`,completionMode:`gpu-resident-terminal-safe-placed-or-pre-reaction-fallback`,positionMutationObserved:!1,positionMayHaveChanged:!0,positionEpochAdvanceRequired:!0,topologyMayChange:!0,conservativeTopologyAdvanceRequired:!0,sparePlacementEventCount:null,observedPositionMutationEventCount:null,sourcePositionEpoch:s,positionEpochFloor:c,destinationStorageGeneration:e.placedDestinationStorageGeneration,ancestorPublicGenerationId:e.ancestorPublicGenerationId,placementGenerationId:e.generationId,deviceId:e.deviceId});return un.add(l),dn.set(l,{device:i.device,sourceFamily:e,ancestorPublicGeneration:e.ancestorPublicGeneration,placementArtifact:t,stateBuffer:e.placedDestinationStateBuffer,thermoBuffer:e.placedDestinationThermoBuffer,mechanicsBuffer:e.placedDestinationMechanicsBuffer,sourcePositionEpoch:s,positionEpochFloor:c,destinationStorageGeneration:e.placedDestinationStorageGeneration}),i.finalizedPlacementArtifact=t,i.positionEpochFloorReceipt=l,l}function Jn(e,{device:t,ancestorPublicGeneration:n}={}){let r=dn.get(e);return!!(r&&un.has(e)&&Object.isFrozen(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`&&e.finalized===!0&&e.authenticated===!0&&e.positionEpochFloorAuthenticated===!0&&e.destinationSafetyAuthenticated===!0&&e.placementOutcomeAuthenticated===!1&&e.placementOutcomeObserved===!1&&e.transactionalPublicationGateEncoded===!0&&e.transactionalTerminalSealEncoded===!0&&e.transactionalFailClosedRecoveryEncoded===!0&&e.transactionalAuxiliaryMaterializationEncoded===!0&&e.destinationPublicationMode===`gpu-terminal-safe-placed-or-exact-pre-reaction-fallback`&&e.positionMutationObserved===!1&&e.positionMayHaveChanged===!0&&e.positionEpochAdvanceRequired===!0&&r.device===t&&e.deviceId===y(t)&&r.ancestorPublicGeneration===n&&r.sourceFamily.ancestorPublicGeneration===n&&r.sourcePositionEpoch===r.sourceFamily.epochIdentity.positionEpoch&&e.sourcePositionEpoch===r.sourcePositionEpoch&&e.positionEpochFloor===r.positionEpochFloor&&_n(e.sourcePositionEpoch,e.positionEpochFloor)&&e.sourcePositionEpoch>=n?.execution?.positionEpoch&&e.positionEpochFloor>n?.execution?.positionEpoch)}function Yn(e,{requestQueueOrderedCleanupClaim:t=!1}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=J.get(e);if(!n||n.deviceLost||n.lifecycle.releaseStatus===`released-after-final-consumer`||n.lifecycle.releaseScheduled!==!0||!n.finalizedPlacementArtifact||!n.positionEpochFloorReceipt)throw Y(`placement destination ownership can only transfer during the exact retirement handoff`,`OWNERSHIP_TRANSFER`);if(n.destinationOwnershipTransferred)return!1;n.reactionWarmArenaLease&&Nn(n.reactionWarmArenaLease,e,n.device);let r=n.reactionWarmArenaLease?()=>{let{leaseRecord:e,record:t}=An(n.reactionWarmArenaLease,{device:n.device});e.releaseScheduled=!0,e.released=!0,t.inFlight=!1,t.boundSourceFamily=null,t.destinationOwnershipTransferred=!1,t.terminal||t.deviceLost?Tn(t,{force:!0}):t.phase=`idle`}:()=>{$(n,`placed-state`,n.family.placedDestinationStateBuffer),$(n,`placed-thermo`,n.family.placedDestinationThermoBuffer),$(n,`placed-mechanics`,n.family.placedDestinationMechanicsBuffer)};t===!0&&(n.destinationCleanup=r,n.destinationCleanupClaim=ee(Zt,n.device,{producerOutput:e,cleanup:r})),n.destinationOwnershipTransferred=!0,n.lifecycle.destinationOwnership=`transferred-to-reaction-continuation`;let i=n.pendingQueueOrderedPlacementArtifact??null;return n.pendingQueueOrderedPlacementArtifact=null,i&&Zn(n,i),!0}function Xn(e){let t=J.get(e);return t?.destinationOwnershipTransferred===!0?t.destinationCleanupClaim??null:null}function Zn(e,t,{retireDestinations:n=!1}={}){e.lifecycle.releaseStatus=`borrowed-directory-family-cleanup-queue-ordered-after-placement-consumer`,e.retireDestinationsOnSourceCleanup=n===!0;let r=O(e.device,e.sourceFamilyCleanup,{queueOrderedFinalConsumer:t.queueOrderedFinalConsumerCapability,producerClaim:e.sourceFamilyCleanupClaim,producerOutput:e.family,producerFamily:`schroeder-reaction-placement-source-family`}),i=n===!0&&e.reactionWarmArenaLease?In(e.reactionWarmArenaLease,{device:e.device,completionFence:e.device.queue?.onSubmittedWorkDone?.(),abandon:!0,destroy:!0}):Promise.resolve(!0);e.lifecycle.releasePromise=Promise.all([Promise.resolve(r),Promise.resolve(i)]).then(([,e])=>e!==!1)}function Qn(e,{placementArtifact:t=null,abandon:n=!1,retireDestinations:r=!1}={}){if(!Wn(e))throw Y(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let i=J.get(e);if(!i)throw Y(`placement source family has no exact runtime owner record`,`SOURCE_FAMILY_IDENTITY`);if(i.lifecycle.releaseScheduled===!0)return!1;if(Gn(e),n!==!0&&(!t||i.finalizedPlacementArtifact!==t||!i.positionEpochFloorReceipt))throw Y(`normal placement retirement requires the exact finalized placement artifact and position-epoch-floor receipt`,`FINALIZATION`);if(i.completion.status=t?`placement-consumer-submitted`:`placement-consumer-submission-observed-without-artifact`,i.completion.placementArtifact=t,t&&t.queueOrderedReleaseAuthorized===!0&&t.queueFenceStatus===`same-queue-submission-order`&&t.hostQueueFenceCount===0&&t.arenaReuseAllowed===!0)return i.lifecycle.releaseScheduled=!0,i.destinationOwnershipTransferred!==!0&&r!==!0?(i.lifecycle.releaseStatus=`awaiting-explicit-destination-disposition`,i.lifecycle.releaseReason=`queue-ordered placement retirement requires transfer or explicit destination retirement`,i.pendingQueueOrderedPlacementArtifact=t,!0):(Zn(i,t,{retireDestinations:r}),!0);if(i.sourceFamilyCleanupClaim&&i.sourceFamilyCleanup)try{w(i.sourceFamilyCleanupClaim,i.device,{producerOutput:i.family,cleanup:i.sourceFamilyCleanup})}catch{}let a=i.initializationFence,o=t?.queueFence??(a?.submissionObserved===!0?i.device.queue?.onSubmittedWorkDone?.():a)??null;return!o?.then||t&&(t.queueFenceStatus!==`exact-queue-submission-fence`||t.arenaReuseAllowed!==!0)?(i.lifecycle.releaseStatus=`retained-without-exact-queue-fence`,i.lifecycle.releaseReason=`placement-family cleanup requires the exact submission queue fence`,!1):(i.lifecycle.releaseScheduled=!0,i.lifecycle.releaseStatus=`borrowed-directory-family-cleanup-scheduled-after-placement-consumer`,i.lifecycle.releasePromise=Promise.resolve(o).then(()=>(zn(i),Bn(i),i.reactionWarmArenaLease&&!i.destinationOwnershipTransferred&&(i.warmArenaReleasePromise=In(i.reactionWarmArenaLease,{device:i.device,completionFence:Promise.resolve(!0),abandon:!0})),i.lifecycle.releaseStatus=`released-after-final-consumer`,i.lifecycle.releaseReason=null,i.completion.status=`placement-consumer-completed`,!0)).catch(e=>{if(i.lifecycle.releaseScheduled=!1,i.lifecycle.releaseStatus=`retained-cleanup-fence-error`,i.lifecycle.releaseReason=e instanceof Error?e.message:String(e),i.reactionWarmArenaLease)try{let t=Promise.reject(e);i.warmArenaReleasePromise=In(i.reactionWarmArenaLease,{device:i.device,completionFence:t,abandon:!0})}catch{}return!1}),!0)}async function $n({device:e,ancestorPublicGeneration:t,sphParticleState:r,mlsMpmParticleState:i,sphParticleUpload:o=null,frozenSourceStateBuffer:s,frozenSourceThermoBuffer:d,frozenSourceMechanicsBuffer:f,stableIdentityBuffer:p=o?.identityBuffer??null,positionInvariantCertificate:m,placedDestinationStateBuffer:h=null,placedDestinationThermoBuffer:g=null,placedDestinationMechanicsBuffer:_=null,reactionWarmArenaLease:v=null}={}){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.submit)throw TypeError(`reaction placement epoch requires a WebGPU-like device and queue`);let b=X(r?.particleCount,`sphParticleState.particleCount`,{positive:!0});if(i?.particleCount!==b)throw Y(`SPH and MLS-MPM particle counts must match`,`PARTICLE_COUNT`);let x=vn(e,t,b),S=b*c*Float32Array.BYTES_PER_ELEMENT,C=b*u*Float32Array.BYTES_PER_ELEMENT,w=b*l*Float32Array.BYTES_PER_ELEMENT,T=(v?jn(v,{device:e,particleCapacity:b}):null)?.buffers??null,E=Z(e,s,`frozen resolved state`,S),D=Z(e,d,`frozen resolved thermo`,C),O=Z(e,f,`frozen resolved mechanics`,w),te=[E,D,O],ne=p?[...te,p]:te;if(new Set(ne).size!==ne.length)throw Y(`frozen placement state, thermo, mechanics, and identity sources must be pairwise distinct`,`SOURCE_ALIAS`);if(T&&(E!==T.resolvedState||D!==T.resolvedThermo||O!==T.resolvedMechanics))throw Y(`reaction warm arena must carry the exact frozen resolve output family`,`WARM_ARENA_IDENTITY`);let k=cn.get(m);if(!sn.has(m)||!k||k.device!==e||k.ancestorGeneration!==x||!Un(k,{device:e,ancestorGeneration:x,particleCount:b})||m.sourceAuthority!==k.sourceAuthority||m.prePlacementPositionChanged!==k.prePlacementPositionChanged||m.ancestorPositionEpoch!==k.ancestorPositionEpoch||m.resolvedPositionEpoch!==k.resolvedPositionEpoch||k.frozenResolvedStateBuffer!==E||k.particleCount!==b)throw Y(`numeric position-epoch inheritance requires the exact resolve certificate`,`POSITION_INVARIANCE`);let A=Z(e,k.reactionInputStateBuffer,`pre-reaction transaction rollback state`,S),j=Z(e,k.transactionRollbackThermoBuffer,`pre-reaction transaction rollback thermo`,C),re=Z(e,k.transactionRollbackMechanicsBuffer,`pre-reaction transaction rollback mechanics`,w);if(new Set([A,j,re,E,D,O]).size!==6)throw Y(`pre-reaction rollback and post-reaction frozen buffer families must be pairwise distinct`,`RESOLVE_ALIAS`);let ie=o?.identityRequired===!0,ae=b*a*Uint32Array.BYTES_PER_ELEMENT;(ie||p)&&Z(e,p,`stable particle identity`,ae);let{allocateSchroederSpatialSuccessorBufferFamilyIdentity:oe}=await n(async()=>{let{allocateSchroederSpatialSuccessorBufferFamilyIdentity:e}=await import(`./schroederSpatialSuccessorSourceFamily-D5HvmpSO.js`);return{allocateSchroederSpatialSuccessorBufferFamilyIdentity:e}},[],import.meta.url),M=yn(x.execution),se=oe({device:e,afterStorageGeneration:M.storageGeneration,purpose:`reaction-placement-frozen-resolved-source-family`}),ce=oe({device:e,afterStorageGeneration:se.storageGeneration,purpose:`reaction-placement-final-destination-family`}),N=h??T?.placedState??null,P=g??T?.placedThermo??null,F=_??T?.placedMechanics??null;if(T&&(N!==T.placedState||P!==T.placedThermo||F!==T.placedMechanics))throw Y(`reaction warm arena placement destinations cannot be replaced or aliased`,`WARM_ARENA_IDENTITY`);let le=[N,P,F].filter(Boolean);if(le.some(e=>te.includes(e))||le.some(e=>[A,j,re].includes(e))||new Set(le).size!==le.length)throw Y(`provided placement destinations must be distinct from every frozen source and each other`,`SOURCE_DESTINATION_ALIAS`);let I=N?Z(e,N,`placed destination state`,S):null,ue=P?Z(e,P,`placed destination thermo`,C):null,L=F?Z(e,F,`placed destination mechanics`,w):null,de=I,R=ue,z=L;try{de||=bn(e,`ulg-schroeder-reaction-placement-state-destination`,S),R||=bn(e,`ulg-schroeder-reaction-placement-thermo-destination`,C),z||=bn(e,`ulg-schroeder-reaction-placement-mechanics-destination`,w)}catch(e){throw I||de?.destroy?.(),ue||R?.destroy?.(),L||z?.destroy?.(),e}let fe=Object.freeze({state:!!h,thermo:!!g,mechanics:!!_}),B=Object.freeze({state:!!T,thermo:!!T,mechanics:!!T}),pe={frozenSourceStateBuffer:E,frozenSourceThermoBuffer:D,frozenSourceMechanicsBuffer:O,transactionRollbackStateBuffer:A,transactionRollbackThermoBuffer:j,transactionRollbackMechanicsBuffer:re,placedDestinationStateBuffer:de,placedDestinationThermoBuffer:R,placedDestinationMechanicsBuffer:z,stateBufferByteLength:S,thermoBufferByteLength:C,mechanicsBufferByteLength:w};Ln(pe);let V=Object.freeze({storageGeneration:se.storageGeneration,physicsTick:M.physicsTick,physicsSubstep:gn(M.physicsSubstep,`placement physics substep`),positionEpoch:k.resolvedPositionEpoch,topologyEpoch:M.topologyEpoch,chartEpoch:M.chartEpoch,levelEpoch:M.levelEpoch,supportEpoch:M.supportEpoch}),me=null;try{me=Rn(e,pe);let t=Object.freeze({stageIdentity:$t,sourceFamilyId:en,generationId:x.execution.generationId,...V}),n={status:`placement-consumer-not-yet-submitted`,placementArtifact:null},r={status:`shared-directory-placement-family-retained`,destinationOwnership:`placement-family-owned-destination`,releaseScheduled:!1,releaseStatus:`retained-for-placement-consumer`,releaseReason:null,releasePromise:null,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null},i={schema:Yt,status:`schroeder-spatial-reaction-placement-source-family-ready`,ready:!0,authenticated:!0,private:!1,sharedSpatialAuthorityBorrowed:!0,stageIdentity:$t,sourceFamilyId:en,deviceId:y(e),particleCount:b,generation:x,generationId:x.execution.generationId,epochIdentity:V,stageEpochTuple:t,ancestorPublicGeneration:x,ancestorPublicGenerationId:x.execution.generationId,ancestorPublicEpochIdentity:M,directoryEpochIdentity:M,queryStateEpochIdentity:V,ancestorLineageStatus:`exact-public-generation-ancestor-bound`,positionInvariantCertificate:m,positionEpochInheritance:`certified-reaction-resolve-does-not-integrate-positions`,levelAssignment:null,directoryBuffer:x.execution.directoryBuffer,directorySourceBuffer:x.source.sourceBuffer,directoryPositionAuthorityStateBuffer:x.source.sourceStateBuffer,sourceBuffer:x.source.sourceBuffer,identityBuffer:p,identityMode:p?`stable-explicit-particle-identity-buffer`:`stable-implicit-source-row-index`,...pe,placedDestinationPublicationStatus:`transactional-mutable-destination-initialized-awaiting-placement`,placedDestinationStorageGeneration:ce.storageGeneration,exactNearQueryGeometry:Object.freeze({authenticated:!0,chartId:x.execution.queryChartId,minLevel:x.execution.queryMinLevel,maxLevel:x.execution.queryMaxLevel,levelCount:x.execution.queryLevelCount,baseGridSpacingM:x.execution.queryBaseGridSpacingM,mode:x.execution.queryGeometryMode}),displacementAuthority:`gpu-envelope-max-displacement-from-canonical-directory-position-state`,directoryBuildCount:0,privateLookupBuildCount:0,privateLawSpatialBuildCount:0,levelAssignmentBuildCount:0,fullParticleReadbackPerformed:!1},a={device:e,family:i,generation:x,ownsGeneration:!1,levelAssignment:null,completion:n,lifecycle:r,deviceLost:!1,callerOwnedDestinations:fe,arenaOwnedDestinations:B,reactionWarmArenaLease:v,destinationOwnershipTransferred:!1,destinationReturnScheduled:!1,destinationReturnPromise:null,warmArenaReleasePromise:null,auxiliaryDestroyed:!1,retireDestinationsOnSourceCleanup:!1,destroyed:new Set,initializationFence:me,stageStorageAllocation:se,destinationStorageAllocation:ce,finalizedPlacementArtifact:null,positionEpochFloorReceipt:null},o=()=>{zn(a),a.retireDestinationsOnSourceCleanup===!0&&!a.reactionWarmArenaLease&&Bn(a),a.lifecycle.releaseStatus=`released-after-final-consumer-queue-ordered`,a.lifecycle.releaseReason=null,a.completion.status=`placement-consumer-completed`},s=ee(Xt,e,{producerOutput:i,cleanup:o});return a.sourceFamilyCleanup=o,a.sourceFamilyCleanupClaim=s,Object.defineProperty(i,"queueOrderedCleanupClaim",{value:s,enumerable:!1}),Object.freeze(i),v&&Mn(v,i,e),ln.add(i),J.set(i,a),Vn(a),i}catch(t){let n=()=>{!fe.state&&!B.state&&de.destroy?.(),!fe.thermo&&!B.thermo&&R.destroy?.(),!fe.mechanics&&!B.mechanics&&z.destroy?.()},r=me?.submissionObserved===!0?e.queue?.onSubmittedWorkDone?.():me??e.queue?.onSubmittedWorkDone?.();if(r?.then&&(Promise.resolve(r).then(n,()=>{}),v))try{In(v,{device:e,completionFence:r,abandon:!0})}catch{}throw t}}export{Kt as A,Te as B,Yn as C,Wt as D,ke as E,ce as F,ne as G,De as H,se as I,U as L,z as M,F as N,Jt as O,P,ve as R,Xn as S,Ae as T,ae as U,Ee as V,oe as W,In as _,Yt as a,$n as b,rn as c,Hn as d,qn as f,Fn as g,Pn as h,tn as i,N as j,At as k,On as l,Qn as m,$t as n,Qt as o,Wn as p,nn as r,an as s,en as t,kn as u,Gn as v,Jn as w,Kn as x,jn as y,Ce as z};