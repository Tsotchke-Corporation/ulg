// Reuse the canonical native heat/pressure lifecycle. This stage consumes
// already-computed force proposals; it does not evaluate any force a second time.
export function schroederSpatialNativePublicationWgsl(gridUpdateSource) {
  const anchor = 'fn begin_heat_receipt() {';
  if (!gridUpdateSource.includes(anchor)) throw new Error('Native heat lifecycle entry missing');
  return gridUpdateSource.replace(anchor, `${anchor}
  if (!chain_publication_source_admitted()) {
    chain_publication_reject(17u); return;
  }`) + /* wgsl */ `
@group(0) @binding(1) var<storage,read> chain_proposal:array<u32>;
@group(0) @binding(3) var<storage,read_write> chain_control:array<atomic<u32>>;
@group(0) @binding(4) var<uniform> chain_expected:vec4<u32>;

fn chain_publication_reject(reason:u32) {
  atomicStore(&chain_control[2],5u);
  atomicOr(&chain_control[18],0x100u);
  atomicStore(&chain_control[20],5u);
  if (field_structurally_admitted()) { field_receipt_reject_reason(reason); }
}
fn chain_publication_source_admitted()->bool {
  if (!field_structurally_admitted() || arrayLength(&chain_proposal)<64u
    || arrayLength(&chain_control)<64u || chain_expected.w!=0x534e5031u
    || atomicLoad(&chain_control[0])!=0x53435331u || atomicLoad(&chain_control[1])!=1u
    || atomicLoad(&chain_control[2])!=3u || atomicLoad(&chain_control[18])!=0u
    || atomicLoad(&chain_control[16])!=chain_expected.z
    || atomicLoad(&chain_control[17])!=chain_expected.x
    || atomicLoad(&chain_control[19])!=chain_expected.y
    || chain_proposal[0]!=0x534d4331u || chain_proposal[1]!=1u
    || chain_proposal[2]!=3u || chain_proposal[27]!=0u
    || chain_proposal[16]!=field_word(17u) || chain_proposal[17]!=field_word(34u)
    || chain_proposal[18]!=field_word(32u) || chain_proposal[19]!=64u
    || chain_proposal[20]!=8u || chain_proposal[23]!=chain_expected.x
    || chain_proposal[22]!=field_word(38u) || chain_proposal[25]!=params.pad_u1
    || chain_proposal[28]!=1u || chain_proposal[24]!=select(2u,1u,chain_expected.y==0u)
    || chain_proposal[17]>(arrayLength(&chain_proposal)-64u)/8u) { return false; }
  for(var w=3u;w<=15u;w++) {
    if(chain_proposal[w]!=field_word(w) || atomicLoad(&chain_control[w])!=field_word(w)) { return false; }
  }
  return true;
}
fn chain_finite(v:f32)->bool { return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u; }
@compute @workgroup_size(64)
fn apply_chain_rows(@builtin(local_invocation_id) local_id:vec3<u32>,@builtin(workgroup_id) group:vec3<u32>) {
  if(direct_dispatch_excludes(group)) { return; }
  let i=field_linear_invocation(local_id,group);
  if(!field_operation_admitted(0u) || i>=field_word(34u)
    || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_BUILDING)) { return; }
  let source=64u+i*8u;let native_row=field_word(30u)+i*8u;
  let mass=bitcast<f32>(chain_proposal[source]);
  let momentum=vec3<f32>(bitcast<f32>(chain_proposal[source+1u]),bitcast<f32>(chain_proposal[source+2u]),bitcast<f32>(chain_proposal[source+3u]));
  let budget=bitcast<f32>(chain_proposal[source+7u]);
  for(var w=0u;w<8u;w++) {
    if(!chain_finite(bitcast<f32>(chain_proposal[source+w]))) { chain_publication_reject(18u); return; }
  }
  if(chain_proposal[source]!=field_word(native_row) || mass<0.0 || budget<0.0) { chain_publication_reject(19u);return; }
  for(var w=4u;w<7u;w++) {
    if(chain_proposal[source+w]!=field_word(native_row+w)) { chain_publication_reject(20u);return; }
  }
  var velocity=vec3<f32>(0.0);var kinetic=0.0;
  if(mass>0.0) { velocity=momentum/mass;kinetic=0.5*mass*dot(velocity,velocity); }
  else if(any(momentum!=vec3<f32>(0.0)) || budget!=0.0) { chain_publication_reject(21u);return; }
  let residual=budget-kinetic;
  if(!chain_finite(kinetic) || !all(vec3<bool>(chain_finite(velocity.x),chain_finite(velocity.y),chain_finite(velocity.z)))
    || residual < -max(1e-12,abs(budget)*3e-5)) { chain_publication_reject(22u);return; }
  // Native heat is nonnegative. Only the proposal validator's bounded f32
  // cancellation tolerance may be rounded to zero here.
  if(!field_heat_add(i,max(0.0,residual))) { chain_publication_reject(23u);return; }
  field_store(native_row+1u,bitcast<u32>(velocity.x));
  field_store(native_row+2u,bitcast<u32>(velocity.y));
  field_store(native_row+3u,bitcast<u32>(velocity.z));
}
@compute @workgroup_size(1)
fn complete_chain_level() {
  let receipt=field_receipt_offset();
  if(atomicLoad(&chain_control[2])!=3u || !field_structurally_admitted()
    || field_word(59u)!=2u || field_word(63u)!=params.pad_u2
    || !field_receipt_admitted(FIELD_RECEIPT_PHASE_ENERGY_READY)
    || !field_pressure_receipt_admitted()
    || field_word(receipt+32u)!=field_word(receipt+33u)
    || field_word(receipt+32u)!=field_word(receipt+34u)) { chain_publication_reject(24u);return; }
  let completed=atomicAdd(&chain_control[19],1u)+1u;
  atomicStore(&chain_control[20],select(1u,3u,completed==chain_expected.z));
}

// Local pressure and surface laws run after prolongation. A subsequent
// invalid/CFL result must reject the whole chain, including earlier levels.
// Do not clamp away a real pressure impulse or omit its work receipt.
@compute @workgroup_size(64)
fn validate_chain_local_rows(@builtin(local_invocation_id) local_id:vec3<u32>,@builtin(workgroup_id) group:vec3<u32>) {
  if(direct_dispatch_excludes(group)) { return; }
  let i=field_linear_invocation(local_id,group);
  if(!field_operation_admitted(0u) || i>=field_word(34u)
    || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_BUILDING)) { return; }
  let s=field_word(30u)+i*8u;
  let velocity=vec3<f32>(bitcast<f32>(field_word(s+1u)),bitcast<f32>(field_word(s+2u)),bitcast<f32>(field_word(s+3u)));
  let speed=length(velocity);
  let bound=params.cfl_factor*params.grid_spacing_m/params.dt;
  if(!chain_finite(speed) || !chain_finite(bound) || !(bound>0.0)
    || speed>bound*(1.0+0.00003)) { chain_publication_reject(25u); }
}
`;
}
