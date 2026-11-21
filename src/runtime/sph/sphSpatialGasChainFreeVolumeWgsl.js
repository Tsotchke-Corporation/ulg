import { createSphSpatialGasFreeVolumeWgsl } from '../../../ulg-gpu-abi/src/sphSpatialGasFreeVolumeWgsl.js';
import { SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS } from '../../../ulg-gpu-abi/src/schroederSpatialScaleAtlas.js';

// W consumes the actual final CSR keys and the authenticated R volume record.
// No inherited row is presented as a native phase-volume moment.
export function createSphSpatialGasChainFreeVolumeWgsl(layout) {
  return createSphSpatialGasFreeVolumeWgsl(layout) + /* wgsl */ `
@group(0) @binding(9) var<storage,read> chain_volume:array<u32>;
@group(0) @binding(10) var<storage,read> chain_topology:array<u32>;
@group(0) @binding(11) var<uniform> chain_params:vec4<u32>;

@compute @workgroup_size(1)
fn validate_chain_gas_free_volume_authority() {
  if(params.exact_level_count<3u || params.exact_level_count>${SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS}u
    || !control_volume_geometry_ready()){fail(INVALID_GEOMETRY,19u);return;}
  if(!directory_ready()){fail(INVALID_DIRECTORY,16u);return;}
  if((params.aerosol_enabled==0u && (params.aerosol_family_id!=0u
      || params.aerosol_generation!=0u || params.aerosol_capacity!=0u || params.aerosol_version!=0u))
    || (params.aerosol_enabled!=0u && (params.aerosol_enabled!=1u
      || params.aerosol_family_id==0u || params.aerosol_capacity==0u || params.aerosol_version!=AEROSOL_VERSION))){
    fail(INVALID_AEROSOL,41u);return;
  }
  if(arrayLength(&chain_volume)<64u || arrayLength(&chain_topology)<80u){fail(INVALID_PARENT,18u);return;}
  let capacity=chain_params.x;let count=chain_volume[5];
  if(chain_volume[0]!=0x53435631u || chain_volume[1]!=1u || chain_volume[2]!=3u || chain_volume[3]!=0u
    || chain_volume[4]!=capacity || count>capacity || capacity>arrayLength(&chain_volume)-64u
    || chain_volume[6]!=chain_params.y || chain_volume[7]!=0u
    || chain_volume[21]!=bitcast<u32>(params.selected_level)
    || chain_volume[22]!=params.parent_completion_ordinal
    || chain_topology[0]!=0x53504631u || chain_topology[1]!=1u || chain_topology[2]!=3u
    || chain_topology[17]!=bitcast<u32>(params.selected_level) || chain_topology[33]!=capacity
    || chain_topology[37]!=count || chain_topology[44]!=params.parent_completion_ordinal
    || chain_topology[23]!=params.nx || chain_topology[24]!=params.ny || chain_topology[25]!=params.nz
    || chain_topology[27]!=bitcast<u32>(params.grid_shift)
    || bitcast<f32>(chain_topology[29])!=params.grid_spacing_m
    || chain_topology[48]>arrayLength(&chain_topology)) {fail(INVALID_PARENT,18u);return;}
  if(count>(arrayLength(&chain_topology)-chain_topology[48])/4u){fail(INVALID_PARENT,18u);return;}
  let identity=array<u32,13>(params.source_generation,params.source_device_ordinal,
    params.source_lane_ordinal,params.source_lease_token,params.source_family_id,
    params.storage_generation,params.source_physics_tick,params.source_physics_substep,
    params.source_position_epoch,params.source_topology_epoch,params.source_chart_epoch,
    params.source_level_epoch,params.source_support_epoch);
  for(var i=0u;i<13u;i++){
    if(chain_volume[8u+i]!=identity[i] || chain_topology[3u+i]!=identity[i]){fail(INVALID_PARENT,18u);return;}
  }
}

@compute @workgroup_size(64)
fn scatter_chain_condensed_volume(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(num_workgroups) groups:vec3<u32>) {
  if(atomicLoad(&output_control[3u])!=0u){return;}
  let field=id.x+id.y*groups.x*64u;
  if(field>=chain_volume[5] || field>=chain_params.x){return;}
  let key=chain_topology[48]+field*4u;
  let volume=bitcast<f32>(chain_volume[64u+field]);
  if(!finite_f32(volume) || volume<0.0){fail(NONFINITE_VOLUME,21u);return;}
  if(!condensed_family(chain_topology[key+1u])){
    if(volume!=0.0){fail(INVALID_MOMENT,17u);}return;
  }
  if(chain_topology[key]>=params.coarse_grid_node_count
    || !scatter_to_gas_cell(chain_topology[key],volume)){fail(INVALID_PARENT,18u);}
}
`;
}
