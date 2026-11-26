import{So as e,bo as t,is as n,ko as r,wo as i}from"./sphMechanicsRefreshGpuKernel-DfdoYcu0.js";import"./src-Cs8BLS_9.js";import{h as a}from"./thermalPotentialGpu-RUJ_WC2i.js";const o=`peercompute.ulg.spatial-gas-caloric-authority.v1`,s=8,c=8,l=Object.freeze([`materialId`,`molarMassKgPerMol`,`cvJPerKgK`,`energyMinJPerKg`,`energyMaxJPerKg`,`temperatureMinK`,`temperatureMaxK`,`status`]),u=Object.freeze({READY:1,INVALID_MEMBER:2,UNKNOWN_MATERIAL:4,MOLAR_MASS_MISMATCH:8,CALORIC_STATE_MISMATCH:16,OUTSIDE_DOMAIN:32,NUMERIC_FAILURE:64}),d=1e-5,f=new WeakMap,p=e=>{throw TypeError(`Gas caloric authority: ${e}`)},m=e=>typeof e==`number`&&Number.isFinite(e)&&Number.isFinite(Math.fround(e))&&Math.fround(e)>0;function h(e,t=new Set){if(e===null)return[`null`];let n=typeof e;if(n===`number`)return[`number`,Object.is(e,-0)?`-0`:String(e)];if(n===`string`||n===`boolean`)return[n,e];if(n===`undefined`)return[`undefined`];(n!==`object`||t.has(e))&&p(`cold inputs must be acyclic data`),t.add(e);let r;if(ArrayBuffer.isView(e)){let t=e instanceof Float32Array&&e.constructor===Float32Array,n=e instanceof Uint32Array&&e.constructor===Uint32Array;(!t&&!n||typeof SharedArrayBuffer<`u`&&e.buffer instanceof SharedArrayBuffer)&&p(`cold arrays must be ordinary Float32Array or Uint32Array storage`),r=[t?`Float32Array`:`Uint32Array`,Array.from(new Uint8Array(e.buffer,e.byteOffset,e.byteLength))]}else{let n=Object.getPrototypeOf(e);n!==Object.prototype&&n!==Array.prototype&&n!==null&&p(`cold metadata must be plain data`);let i=Reflect.ownKeys(e);i.some(e=>typeof e!=`string`)&&p(`symbol cold metadata is unsupported`),r=[Array.isArray(e)?`array`:`object`,i.sort().map(n=>{let r=Object.getOwnPropertyDescriptor(e,n);return Object.hasOwn(r,`value`)||p(`cold data accessors are not authority`),[n,h(r.value,t)]})]}return t.delete(e),r}const g=e=>JSON.stringify(h(e)),_=(e,t)=>e.length>=t.length&&t.every((t,n)=>Object.is(e[n],t));function v(e){(e?.schema!==`peercompute.ulg.sph-gpu-thermal-material-table.v1`||!Number.isSafeInteger(e.materialCount)||e.materialCount<=0||!Number.isSafeInteger(e.segmentCount)||e.segmentCount<=0||!(e.records instanceof Float32Array)||!(e.segments instanceof Float32Array)||e.records.length!==e.materialCount*8||e.segments.length!==e.segmentCount*12||e.recordStrideFloats!==8||e.segmentStrideFloats!==12||!Array.isArray(e.metadata)||e.metadata.length!==e.materialCount||!Array.isArray(e.segmentMetadata)||e.segmentMetadata.length!==e.segmentCount)&&p(`complete actual thermal rows and metadata required`);let t=new Set;for(let n=0;n<e.materialCount;n+=1){let r=e.records.subarray(n*8,n*8+8);(!r.every(Number.isFinite)||!Number.isInteger(r[0])||r[0]<1||r[0]>16777215||t.has(r[0])||!Number.isInteger(r[1])||!Number.isInteger(r[2])||r[1]<0||r[2]<=0||r[1]+r[2]>e.segmentCount)&&p(`invalid or duplicate thermal material`),t.add(r[0])}}function y(e,t,n,r,i){let{thermalClosureGraphSet:a,thermalPhaseResponseTable:o}=e,s=a.metadata.filter(e=>e.segmentIndex===t);s.length!==1&&p(`missing or ambiguous actual phase graph`);let c=s[0].graphIndex,l=a.graphs[c],u=[];for(let e=0;e<o.responseCount;e+=1){let t=o.responses.subarray(e*16,e*16+16);t[0]===n&&t[6]===r&&u.push(t)}let d=[n,i.caloricSegmentType,c,1,i.eStart,i.eEnd,r,r,i.restDensityKgPerM3,i.restDensityKgPerM3,1,1,0,1,0,0];(u.length!==1||!_(u[0],d)||l?.nodeCount!==1||l.sampleCount!==2||l.sampleRows?.length!==8||l.nodeRows?.[0]!==1||l.nodeRows[1]!==0||l.nodeRows[2]!==1||l.nodeRows[4]!==0||l.nodeRows[5]!==2||l.nodeRows[6]!==i.eStart||l.nodeRows[7]!==i.eEnd||l.nodeRows[10]!==1)&&p(`explicit phase needs the exact affine thermal graph`);let f=Math.fround((i.tHi-i.tLo)/(i.eEnd-i.eStart));_(l.sampleRows,[i.eStart,i.tLo,f,0,i.eEnd,i.tHi,f,0])||p(`phase graph differs from the declared packed model`)}function b({thermalMaterialTable:s,condensableThermodynamicsByMaterial:c}={}){let l=g(s);v(s),(!c||typeof c!=`object`||Array.isArray(c))&&p(`explicit models by material required`),g(c);let u=Object.entries(c);u.length||p(`at least one explicitly enrolled model required`);let d=a({thermalMaterialTable:s,requireExactContent:!0}),h=[],b=new Set;for(let[a,o]of u.sort(([e],[t])=>e.localeCompare(t))){r(o)||p(`original created explicit model required`);let c=n(a);b.has(c)&&p(`duplicate enrolled material identity`),b.add(c);let l=s.metadata.filter(e=>e.materialId===c),u=[];for(let e=0;e<s.materialCount;e+=1)s.records[e*8]===c&&u.push(e);(l.length!==1||u.length!==1||l[0].material!==a||l[0].phaseCaloric!==!0||l[0].caloricEnergyBasis!==o.energyBasis||l[0].caloricProvenance!==o.provenance||g(l[0].caloricInitializationProperties)!==g(t(o)))&&p(`thermal material lacks matching explicit model identity, M or Cp`);let f=s.records.subarray(u[0]*8,u[0]*8+8),v=f[1],x=i(o),S=o.solidCaloric,C=S?[2,Math.fround(S.referencePressurePa),Math.fround(S.referenceTemperatureK)]:[0,0,0];(f[2]!==x.length||f[3]!==1||f[5]!==C[0]||f[6]!==C[1]||f[7]!==C[2]||l[0].segmentOffset!==v||l[0].segmentCount!==x.length)&&p(`enrolled material must contain its complete declared pure-phase roster`);for(let t=0;t<x.length;t+=1){let n=x[t],r=e[n.phase],i=v+t,o=s.segments.subarray(i*12,i*12+12),l=s.segmentMetadata[i];(!_(o,[c,n.caloricSegmentType,r,r,n.eStart,n.eEnd,n.tLo,n.tHi,n.restDensityKgPerM3,n.restDensityKgPerM3,1])||!Number.isFinite(o[11])||o[11]<0||l?.material!==a||l.materialId!==c||l.segmentIndex!==i||l.phaseCaloric!==!0||Object.entries(n).some(([e,t])=>!Object.is(l[e],t))||l.debyeTemperatureK)&&p(`actual phase rows differ from the declared model`),y(d,i,c,r,n)}let w=x.find(e=>e.phase===`gas`),T=Math.fround(o.molarMassKgPerMol),E=Math.fround((w.eEnd-w.eStart)/(w.tHi-w.tLo));(!m(T)||!m(E))&&p(`unrepresentable material M or Cv`),h.push(c,T,E,w.eStart,w.eEnd,w.tLo,w.tHi,1)}g(s)!==l&&p(`thermal input changed during compilation`);let x=Object.freeze({schema:o,materialCount:u.length,exchangeIntervalAdmitted:!1,scientificValidation:!1});return f.set(x,{thermalMaterialTable:s,tableSnapshot:l,records:new Float32Array(h),models:u.sort(([e],[t])=>e.localeCompare(t))}),x}function x(e,t){let n=f.get(e);return(!n||n.thermalMaterialTable!==t||g(t)!==n.tableSnapshot)&&p(`unissued, copied or stale caloric authority`),n}function S(e,{thermalMaterialTable:t}={}){return x(e,t),!0}function C(e,{thermalMaterialTable:t}={}){let n=x(e,t);return Object.freeze({schema:e.schema,records:n.records.slice(),materialCount:e.materialCount,recordStrideFloats:8,exchangeIntervalAdmitted:!1,scientificValidation:!1})}function w(e,{thermalMaterialTable:t,surfaceModels:r}={}){let a=x(e,t);g(r),(!r||typeof r!=`object`||Array.isArray(r))&&p(`explicit surface models by material required`);let o=new Set(a.models.map(([e])=>e));Object.keys(r).some(e=>!o.has(e))&&p(`surface model material is not enrolled in the exact caloric authority`);let s=[],c=[];for(let[e,t]of a.models){let a=i(t),o=a.find(e=>e.phase===`liquid`),l=a.find(e=>e.phase===`gas`),u=Object.hasOwn(r,e)?r[e]:null,d=0,f=0,h=0;if(u!=null){o||p(`gas-only material cannot declare a liquid surface or mass-exchange law`);let e=[`schema`,`provenance`,`interceptNPerM`,`slopeNPerMK`,`minTemperatureK`,`maxTemperatureK`];(u.schema!==`peercompute.ulg.linear-pure-interface.v1`||typeof u.provenance!=`string`||!u.provenance.trim()||Reflect.ownKeys(u).some(t=>!e.includes(t))||!e.every(e=>Object.hasOwn(u,e))||!Number.isFinite(u.minTemperatureK)||!Number.isFinite(u.maxTemperatureK)||!(u.minTemperatureK>0)||u.minTemperatureK>o.tLo||u.maxTemperatureK<o.tHi)&&p(`complete covering linear pure-interface model required`),d=Math.fround(u.interceptNPerM),f=Math.fround(u.slopeNPerMK);let t=e=>Math.fround(d+Math.fround(f*e));(typeof u.interceptNPerM!=`number`||typeof u.slopeNPerMK!=`number`||!Number.isFinite(d)||!(d>0)||!Number.isFinite(f)||!m(t(o.tLo))||!m(t(o.tHi)))&&p(`finite positive surface internal energy and tension throughout the packed domain required`),h=1}let g=Math.fround((l.eEnd-l.eStart)/(l.tHi-l.tLo)),_=Math.fround(1+t.specificGasConstantJPerKgK/g),v=[n(e),Math.fround(t.molarMassKgPerMol),l.eStart,l.eEnd,o?.eStart??0,o?.eEnd??0,l.tLo,l.tHi,o?.restDensityKgPerM3??0,d,f,h,g,_,Math.fround(t.maxPressurePa),+!o];(!v.every(Number.isFinite)||!(_>1)||!(v[14]>0))&&p(`unrepresentable exchange material coefficients`),s.push(...v),c.push(e)}return x(e,t),Object.freeze({records:new Float32Array(s),materialCount:c.length,recordStrideFloats:16,materials:Object.freeze(c),surfaceModel:`linear-pure-interface`,kineticAuthorization:!1,exchangeIntervalAdmitted:!1,scientificValidation:!1})}function T(e,{thermalMaterialTable:t,surfaceModels:n,rateModels:r}={}){let i=x(e,t),a=w(e,{thermalMaterialTable:t,surfaceModels:n});g(r),(!r||Array.isArray(r)||typeof r!=`object`||!Object.keys(r).length)&&p(`explicit rate models by liquid material required`);let o=a.materials,s=o.length;Object.keys(r).some(e=>!o.includes(e))&&p(`rate material is not enrolled`);let c=new Float32Array(s*16+s*s),l=(e,t,n=!1)=>{let r=Math.fround(e);return(typeof e!=`number`||!Number.isFinite(r)||e<0||n&&e===0||e!==0&&r<2**-126)&&p(`representable ${t} required`),r};for(let[e,[t,n]]of i.models.entries()){if(!Object.hasOwn(r,t))continue;let i=r[t],u=[`schema`,`provenance`,`massMobilityPerAreaKg2KPerJsM2`,`maxAbsAffinityJPerKgK`,`maxTemperatureDifferenceK`,`heatTransferCoefficientsWPerM2K`];(!i||typeof i!=`object`||i.schema!==`peercompute.ulg.near-equilibrium-onsager.v1`||typeof i.provenance!=`string`||!i.provenance.trim()||Reflect.ownKeys(i).some(e=>!u.includes(e))||!u.every(e=>Object.hasOwn(i,e))||a.records[e*16+11]!==1)&&p(`complete bounded liquid rate model required`);let d=i.heatTransferCoefficientsWPerM2K;(!d||typeof d!=`object`||Array.isArray(d)||Reflect.ownKeys(d).length!==s||!o.every(e=>Object.hasOwn(d,e)))&&p(`explicit heat coefficients for every enrolled gas material required`),c.set([1,n.referenceTemperatureK,n.referencePressurePa,n.vaporizationReferenceEnthalpyJPerKg,n.liquidCpJPerKgK,n.vaporCpJPerKgK,n.specificGasConstantJPerKgK,n.vaporCvJPerKgK,n.vaporReferenceInternalEnergyJPerKg,l(i.massMobilityPerAreaKg2KPerJsM2,`mass mobility`),l(i.maxAbsAffinityJPerKgK,`affinity domain`,!0),l(i.maxTemperatureDifferenceK,`temperature-jump domain`,!0),0,0,0,0],e*16);for(let t=0;t<s;t++)c[s*16+e*s+t]=l(d[o[t]],`heat coefficient`)}return c.every(Number.isFinite)||p(`unrepresentable rate thermodynamics`),x(e,t),Object.freeze({records:c,model:`near-equilibrium-onsager`,integration:`frozen-initial-rate`,scientificValidation:!1})}const E=`
@group(0) @binding(12) var<storage, read> gas_caloric_materials: array<f32>;
@group(0) @binding(13) var<storage, read_write> gas_caloric_cells: array<f32>;
struct GasCaloricState {
  heat_capacity: f32,
  centered_energy: f32,
  anchor_temperature: f32,
  min_temperature: f32,
  max_temperature: f32,
  member_count: u32,
  errors: u32,
};
fn gas_caloric_empty() -> GasCaloricState {
  return GasCaloricState(0.0, 0.0, 0.0, 0.0, 0.0, 0u, 0u);
}
fn gas_caloric_add(acc: GasCaloricState, row: u32) -> GasCaloricState {
  var next = acc;
  if (params.compact_stride != 16u || row > arrayLength(&compact_rows)
    || arrayLength(&compact_rows) - row < 16u || acc.member_count >= 16777215u) {
    next.errors = next.errors | 2u; return next;
  }
  let id = compact_rows[row + 3u];
  let mass = compact_rows[row + 4u];
  let moles = compact_rows[row + 5u];
  let u = compact_rows[row + 12u];
  let raw_temperature = compact_rows[row + 13u];
  if (!finite_f32(id) || id < 1.0 || id > 16777215.0 || floor(id) != id
    || !finite_f32(mass) || !(mass > 0.0) || !finite_f32(moles) || !(moles > 0.0)
    || !finite_f32(u) || !finite_f32(raw_temperature) || !(raw_temperature > 0.0)
    || compact_rows[row + 10u] != 1.0 || compact_rows[row + 11u] != 1.0
    || compact_rows[row + 14u] != 3.0 || compact_rows[row + 15u] != 0.0) {
    next.errors = next.errors | 2u; return next;
  }
  var material = 0u;
  var matches = 0u;
  for (var offset = 0u; offset + 7u < arrayLength(&gas_caloric_materials); offset = offset + 8u) {
    if (gas_caloric_materials[offset] == id) { material = offset; matches = matches + 1u; }
  }
  if (matches != 1u || arrayLength(&gas_caloric_materials) % 8u != 0u) {
    next.errors = next.errors | 4u; return next;
  }
  for (var lane = 0u; lane < 8u; lane = lane + 1u) {
    if (!finite_f32(gas_caloric_materials[material + lane])) {
      next.errors = next.errors | 64u; return next;
    }
  }
  let molar_mass = gas_caloric_materials[material + 1u];
  let cv = gas_caloric_materials[material + 2u];
  let u_lo = gas_caloric_materials[material + 3u];
  let u_hi = gas_caloric_materials[material + 4u];
  let t_lo = gas_caloric_materials[material + 5u];
  let t_hi = gas_caloric_materials[material + 6u];
  let span_u = u_hi - u_lo;
  let span_t = t_hi - t_lo;
  if (!(molar_mass > 0.0) || !(cv > 0.0) || !(t_lo > 0.0) || !(span_t > 0.0)
    || !finite_f32(span_u) || !(span_u > 0.0) || !finite_f32(span_t)
    || gas_caloric_materials[material + 7u] != 1.0) {
    next.errors = next.errors | 64u; return next;
  }
  let expected_mass = moles * molar_mass;
  if (!finite_f32(expected_mass) || !(expected_mass > 0.0)
    || abs(mass - expected_mass) > 1.0e-5 * max(mass, expected_mass)) {
    next.errors = next.errors | 8u; return next;
  }
  if (u < u_lo || u > u_hi || raw_temperature < t_lo || raw_temperature > t_hi) {
    next.errors = next.errors | 32u; return next;
  }
  let above_lo = u - u_lo;
  let resolved_temperature = t_lo + (above_lo / span_u) * span_t;
  let temperature_budget = max(1.0e-4, t_hi * 1.0e-6);
  if (!finite_f32(above_lo) || !finite_f32(resolved_temperature)
    || abs(raw_temperature - resolved_temperature) > temperature_budget) {
    next.errors = next.errors | 16u; return next;
  }
  // Center each member's ACTUAL U on the first member's resolved temperature.
  // Subtract its own Ulo first, so independent material energy-zero shifts
  // never pollute the sum with absolute formation/reference energies.
  let anchor = select(acc.anchor_temperature, resolved_temperature, acc.member_count == 0u);
  let anchor_above_lo = (anchor - t_lo) * cv;
  let centered_u = above_lo - anchor_above_lo;
  let capacity = mass * cv;
  let centered_energy = mass * centered_u;
  next.heat_capacity = acc.heat_capacity + capacity;
  next.centered_energy = acc.centered_energy + centered_energy;
  next.anchor_temperature = anchor;
  next.min_temperature = select(max(acc.min_temperature, t_lo), t_lo, acc.member_count == 0u);
  next.max_temperature = select(min(acc.max_temperature, t_hi), t_hi, acc.member_count == 0u);
  next.member_count = acc.member_count + 1u;
  if (!finite_f32(anchor_above_lo) || !finite_f32(centered_u)
    || !finite_f32(capacity) || !(capacity > 0.0) || !finite_f32(centered_energy)
    || !finite_f32(next.heat_capacity) || !finite_f32(next.centered_energy)) {
    next.errors = next.errors | 64u;
  }
  if (next.min_temperature > next.max_temperature) { next.errors = next.errors | 32u; }
  return next;
}
fn gas_caloric_write(cell_index: u32, acc: GasCaloricState) {
  let row = cell_index * 8u;
  for (var lane = 0u; lane < 8u; lane = lane + 1u) { gas_caloric_cells[row + lane] = 0.0; }
  var errors = acc.errors;
  if (acc.member_count == 0u || !(acc.heat_capacity > 0.0)) { errors = errors | 2u; }
  var temperature = 0.0;
  if (errors == 0u) {
    temperature = acc.anchor_temperature + acc.centered_energy / acc.heat_capacity;
    if (!finite_f32(temperature)) { errors = errors | 64u; }
    if (temperature < acc.min_temperature || temperature > acc.max_temperature) { errors = errors | 32u; }
  }
  if (errors != 0u) { gas_caloric_cells[row + 7u] = f32(errors); return; }
  gas_caloric_cells[row] = acc.heat_capacity;
  gas_caloric_cells[row + 1u] = acc.centered_energy;
  gas_caloric_cells[row + 2u] = acc.anchor_temperature;
  gas_caloric_cells[row + 3u] = temperature;
  gas_caloric_cells[row + 4u] = acc.min_temperature;
  gas_caloric_cells[row + 5u] = acc.max_temperature;
  gas_caloric_cells[row + 6u] = f32(acc.member_count);
  gas_caloric_cells[row + 7u] = 1.0;
}
`;function D(e){if(!(e instanceof Float32Array)||e.length%8!=0)throw TypeError(`Caloric admission needs complete eight-float rows`);let t=[];for(let n=0;n<e.length;n+=8){let r=e.subarray(n,n+8),i=r[7]===1;if(!Number.isInteger(r[7])||r[7]<0||r[7]>127||r[7]!==1&&r[7]&1||i&&(!r.every(Number.isFinite)||!(r[0]>0)||!(r[2]>0)||!(r[4]>0)||r[4]>r[5]||r[3]<r[4]||r[3]>r[5]||!Number.isInteger(r[6])||r[6]<1||r[6]>16777215))throw TypeError(`Malformed caloric admission result`);t.push(Object.freeze({cellIndex:n/8,ready:i,statusFlags:r[7],heatCapacityJPerK:i?r[0]:null,centeredEnergyJ:i?r[1]:null,anchorTemperatureK:i?r[2]:null,equilibriumTemperatureK:i?r[3]:null,minDomainTemperatureK:i?r[4]:null,maxDomainTemperatureK:i?r[5]:null,memberCount:i?r[6]:null,caloricClosureAdmitted:i,exchangeIntervalAdmitted:!1,scientificValidation:!1}))}return Object.freeze(t)}export{o as SPH_SPATIAL_GAS_CALORIC_AUTHORITY_SCHEMA,c as SPH_SPATIAL_GAS_CALORIC_CELL_ROW_FLOATS,l as SPH_SPATIAL_GAS_CALORIC_MATERIAL_LAYOUT,s as SPH_SPATIAL_GAS_CALORIC_MATERIAL_ROW_FLOATS,d as SPH_SPATIAL_GAS_CALORIC_MOLAR_MASS_RELATIVE_BUDGET,u as SPH_SPATIAL_GAS_CALORIC_STATUS,b as createSphSpatialGasCaloricAuthority,D as decodeSphSpatialGasCaloricAdmissionRows,C as resolveSphSpatialGasCaloricAuthority,w as resolveSphSpatialGasExchangeMaterials,T as resolveSphSpatialGasExchangeRates,E as sphSpatialGasCaloricAdmissionWgsl,S as validateSphSpatialGasCaloricAuthority};