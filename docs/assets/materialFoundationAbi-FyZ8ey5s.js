var e=`ulg.material-property-bundle.v1`,t=`ulg.polytope-atlas.v1`,n=`ulg.polytope-atlas-gpu-buffer.v1`,r=`ulg.polytope-atlas-bank-gpu-buffer.v1`,i=Object.freeze({TIER_1_QUANTITATIVE:`tier-1-quantitative`,TIER_2_REPRESENTATIVE_EFFECTIVE:`tier-2-representative-effective`,TIER_3_THEORETICAL_ENVELOPE:`tier-3-theoretical-envelope`}),a=new Set(Object.values(i)),o=Object.freeze([`nuclear`,`atomic`,`electromagnetic`,`mechanical`,`thermodynamic`]);function s(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t^=e.charCodeAt(n),t=Math.imul(t,16777619)>>>0;return`ulg:${t.toString(16).padStart(8,`0`)}`}function c({materialKey:t,symbol:n=null,formula:r=null,atomicNumber:c=null,family:l=`element`,accuracyTier:u=i.TIER_2_REPRESENTATIVE_EFFECTIVE,generatorFingerprint:d=`ulg-foundation-v1`,nuclear:f,atomic:p,electromagnetic:m,mechanical:h,thermodynamic:g,provenance:_={},g7Advisory:v=null}={}){let y=String(t||n||r||``).trim();if(!y)throw TypeError(`createMaterialPropertyBundle requires materialKey, symbol, or formula`);if(!a.has(u))throw RangeError(`Invalid accuracyTier: ${u}`);let b={nuclear:f,atomic:p,electromagnetic:m,mechanical:h,thermodynamic:g};for(let e of o)if(!b[e]||typeof b[e]!=`object`)throw TypeError(`ulg.material-property-bundle.v1 missing required domain "${e}" for ${y}`);let x=s(JSON.stringify({key:y,family:l,atomicNumber:c,generatorFingerprint:d,domains:b}));return Object.freeze({schema:e,schemaVersion:1,materialKey:y,symbol:n?String(n):null,formula:r?String(r):null,atomicNumber:Number.isInteger(c)?c:null,family:l,accuracyTier:u,generatorFingerprint:String(d),closureHash:x,nuclear:Object.freeze({...f}),atomic:Object.freeze({...p}),electromagnetic:Object.freeze({...m}),mechanical:Object.freeze({...h}),thermodynamic:Object.freeze({...g}),provenance:Object.freeze({scientificValidation:!1,extrapolationPolicy:`fail-closed`,..._}),g7Advisory:v?Object.freeze({...v}):null})}function l(e){let t=[];if(!e||typeof e!=`object`)return Object.freeze({ok:!1,errors:Object.freeze([`bundle-not-object`])});e.schema!==`ulg.material-property-bundle.v1`&&t.push(`invalid-schema:${e.schema}`),e.materialKey||t.push(`missing-materialKey`),a.has(e.accuracyTier)||t.push(`invalid-accuracyTier:${e.accuracyTier}`);for(let n of o)(!e[n]||typeof e[n]!=`object`)&&t.push(`missing-domain:${n}`);return e.closureHash||t.push(`missing-closureHash`),e.provenance?.extrapolationPolicy!==`fail-closed`&&t.push(`extrapolation-policy-must-be-fail-closed`),Object.freeze({ok:t.length===0,errors:Object.freeze(t)})}var u=4,d=16,f=4,p=4,m=4,h=Object.freeze({solid:0,liquid:1,gas:2,supercritical:2,plasma:3}),g=Object.freeze({[i.TIER_1_QUANTITATIVE]:1,[i.TIER_2_REPRESENTATIVE_EFFECTIVE]:2,[i.TIER_3_THEORETICAL_ENVELOPE]:3});function _(e,{materialIndex:t=0}={}){let r=Array.isArray(e)?e:[],i=0,a=0;for(let e of r){let t=Array.isArray(e?.inequalities)?e.inequalities:[];i+=t.length;let n=e?.fit?.coefficients;a+=n?n.length:0}let o=4+r.length*16,s=o+i*4,c=Math.max(16,s+a),l=new Float32Array(c);l[0]=r.length,l[1]=8,l[2]=16,l[3]=1;let u=o,d=s;for(let e=0;e<r.length;e+=1){let n=r[e],i=4+e*16,a=Array.isArray(n?.inequalities)?n.inequalities:[],o=n?.axes?.[0]??{min:1,max:6e3},s=n?.axes?.[1]??{min:1,max:1e9},c=Math.log10(Math.max(1e-12,Number(s.min))),f=Math.log10(Math.max(1e-12,Number(s.max))),p=n?.fit??null,m=p?.coefficients??null,_=p?.degrees?.[0]??0,v=p?.degrees?.[1]??0;l[i+0]=h[n?.phase]??2,l[i+1]=a.length,l[i+2]=Number(o.min),l[i+3]=Number(o.max),l[i+4]=c,l[i+5]=f,l[i+6]=_,l[i+7]=v,l[i+8]=u,l[i+9]=m?d:-1,l[i+10]=Number(p?.maxRelativeError??0),l[i+11]=Number(p?.uncertaintyBound??0),l[i+12]=g[n?.accuracyTier]??2,l[i+13]=Number(t),l[i+14]=p?p.valid?p.valueTransform===`exp`?2:1:0:1,l[i+15]=parseInt(String(n?.invalidationKey||`0`).slice(0,6),16)||0;for(let e of a)l[u+0]=Number(e.a?.[0]??0),l[u+1]=Number(e.a?.[1]??0),l[u+2]=Number(e.b??0),l[u+3]=Math.max(1e-6,Number(e.scale??1)),u+=4;m&&m.length>0&&(l.set(m,d),d+=m.length)}return Object.freeze({schema:n,polytopeCount:r.length,totalFacets:i,totalCoeffs:a,data:l})}function v(e=[]){let t=Array.isArray(e)?e.filter(e=>e&&Number.isFinite(Number(e.materialId))):[],n=[],i=0;for(let e=0;e<t.length;e+=1){let r=t[e],a=r.packedGpuAtlas?.data instanceof Float32Array?r.packedGpuAtlas:_(r.polytopes||[],{materialIndex:e});n.push({materialId:Number(r.materialId),materialKey:String(r.materialKey||``),tierCode:g[r.accuracyTier]??2,packed:a}),i+=a.data.length}let a=4+n.length*4,o=Math.max(16,a+i),s=new Float32Array(o);s[0]=n.length,s[1]=1,s[2]=0,s[3]=0;let c=a;for(let e=0;e<n.length;e+=1){let t=n[e],r=4+e*4;s[r+0]=t.materialId,s[r+1]=c,s[r+2]=t.packed.polytopeCount,s[r+3]=t.tierCode,s.set(t.packed.data,c),c+=t.packed.data.length}return Object.freeze({schema:r,materialCount:n.length,totalFloats:o,data:s})}var y=`
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
`;export{d as a,r as c,c as d,y as f,l as h,u as i,n as l,_ as m,p as n,i as o,v as p,f as r,e as s,m as t,t as u};