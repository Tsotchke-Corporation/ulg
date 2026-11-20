import { schroederSpatialGasPressureBoundaryTransportWgsl } from '../../../ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js';

// Reuse the original EOS admission, sparse-cell policy and W^T projection.
// Binding 8 is the original final parent CSR here; the boundary consumer uses
// its separately authenticated native coefficient record in chain mode.
export const sphSpatialGasChainPressureWgsl = schroederSpatialGasPressureBoundaryTransportWgsl + /* wgsl */ `
@group(0) @binding(9) var<storage,read_write> chain_pressure:array<atomic<u32>>;
@group(0) @binding(10) var<uniform> chain_pressure_params:vec4<u32>;
@compute @workgroup_size(1)
fn initialize_chain_pressure(){
  atomicStore(&chain_pressure[0],0x53435631u);atomicStore(&chain_pressure[1],1u);
  atomicStore(&chain_pressure[2],1u);atomicStore(&chain_pressure[6],chain_pressure_params.y);
  if(!gas_inputs_admitted() || !gas_control_volume_params_admitted()
    || arrayLength(&parent_field_view)<80u || parent_field_view[0]!=0x53504631u
    || parent_field_view[2]!=3u || parent_field_view[3]!=params.generation_id
    || parent_field_view[17]!=bitcast<u32>(params.gas_selected_level)
    || parent_field_view[33]!=chain_pressure_params.x || parent_field_view[37]>chain_pressure_params.x
    || arrayLength(&chain_pressure)<64u+chain_pressure_params.x
    || parent_field_view[48]>arrayLength(&parent_field_view)){
    atomicStore(&chain_pressure[3],1u);return;
  }
  if(parent_field_view[37]>(arrayLength(&parent_field_view)-parent_field_view[48])/4u){
    atomicStore(&chain_pressure[3],1u);return;
  }
  atomicStore(&chain_pressure[5],parent_field_view[37]);
}
@compute @workgroup_size(64)
fn project_chain_pressure(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let i=id.x+id.y*groups.x*64u;
  if(atomicLoad(&chain_pressure[3])!=0u || i>=atomicLoad(&chain_pressure[5])){return;}
  let node=parent_field_view[parent_field_view[48]+i*4u];
  if(node>=params.gas_grid_node_count){atomicOr(&chain_pressure[3],2u);return;}
  let sample=projected_node_gauge(parent_node_cell_key(node));
  if(sample.z==0.0 || !finite_f32(sample.x)){atomicOr(&chain_pressure[3],4u);return;}
  atomicStore(&chain_pressure[64u+i],bitcast<u32>(sample.x));
}
@compute @workgroup_size(1)
fn seal_chain_pressure(){atomicStore(&chain_pressure[2],select(3u,5u,atomicLoad(&chain_pressure[3])!=0u));}
`;
