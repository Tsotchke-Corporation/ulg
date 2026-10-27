import { createSphSpatialGasFreeVolumeWgsl } from '../../../ulg-gpu-abi/src/sphSpatialGasFreeVolumeWgsl.js';
import { SPH_SPATIAL_GAS_FREE_VOLUME_STATUS } from '../../../ulg-gpu-abi/src/sphSpatialGasFreeVolume.js';

// Reuse the original quadratic B, adjacent-level geometric A and cell-volume
// W projection. History stays a distinct owner and is never an aerosol parcel.
export function createSphExactHistoryGasVolumeWgsl(layout) {
  let code = createSphSpatialGasFreeVolumeWgsl(layout, { aerosols: true });
  const replace = (before, after) => {
    if (code.split(before).length !== 2) throw new Error(`Original free-volume shader changed: ${before}`);
    code = code.replace(before, after);
  };
  replace('  let authority_errors = atomicLoad(&output_control[3u]);', `
  if (!history_volume_complete()) { fail(INVALID_HISTORY | COUNT_MISMATCH, 51u); }
  let authority_errors = atomicLoad(&output_control[3u]);`);
  replace('fn finalize_gas_free_volume() {', `fn finalize_gas_free_volume() {
  atomicStore(&output_control[44u],1u);
  atomicStore(&output_control[45u],history_params.y);
  atomicStore(&output_control[46u],history_params.z);
  atomicStore(&output_control[47u],history_params.x);
  atomicStore(&output_control[48u],history_count[3u]);
  atomicStore(&output_control[53u],history_params.w);
  atomicStore(&output_control[54u],1u);
  if (!history_volume_complete()) { fail(INVALID_HISTORY | COUNT_MISMATCH, 51u); }
`);
  replace('    atomicStore(&output_control[2u], READY | ADMITTED);',
    `    atomicStore(&output_control[2u], READY | ADMITTED);
    atomicStore(&output_control[52u],params.generation_id);`);
  return code + /* wgsl */ `
@group(0) @binding(11) var<storage,read> history_events:array<f32>;
@group(0) @binding(12) var<storage,read> history_count:array<u32>;
@group(0) @binding(13) var<storage,read> history_validation:array<u32>;
@group(0) @binding(14) var<uniform> history_params:vec4<u32>;
const INVALID_HISTORY:u32=${SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_HISTORY}u;

fn history_volume_source_ready()->bool {
  return arrayLength(&history_count)>=12u && arrayLength(&history_validation)>=2u
    && history_validation[0u]==0u && history_validation[1u]==0x48503247u
    && history_params.x>0u && history_params.x<=arrayLength(&history_events)/32u
    && history_count[0u]==0x50484731u && history_count[1u]==1u && history_count[2u]==1u
    && history_count[3u]<=history_params.x && history_count[4u]==history_params.x
    && history_count[5u]==history_params.w && history_count[6u]==history_params.y
    && history_count[7u]==history_params.z && history_count[11u]==0u;
}
fn history_volume_complete()->bool {
  return history_volume_source_ready() && atomicLoad(&output_control[49u])==history_params.x;
}
@compute @workgroup_size(64)
fn scatter_history_condensed_volume(@builtin(local_invocation_id) local_id:vec3<u32>,
  @builtin(workgroup_id) workgroup_id:vec3<u32>, @builtin(num_workgroups) groups:vec3<u32>) {
  let slot=(workgroup_id.x+workgroup_id.y*groups.x+workgroup_id.z*groups.x*groups.y)*64u+local_id.x;
  if(slot>=history_params.x){return;}
  atomicAdd(&output_control[49u],1u);
  if(!history_volume_source_ready()){fail(INVALID_HISTORY,51u);return;}
  if(atomicLoad(&output_control[3u])!=0u||slot>=history_count[3u]){return;}
  if(aerosol_geometry.fine_nx*aerosol_geometry.fine_ny*aerosol_geometry.fine_nz!=params.fine_grid_node_count
    || !(params.fine_grid_spacing_m>0.0)||!finite_f32(params.fine_grid_spacing_m)
    || (params.exact_level_count==1u && (aerosol_geometry.fine_nx!=params.nx
      || aerosol_geometry.fine_ny!=params.ny || aerosol_geometry.fine_nz!=params.nz
      || aerosol_geometry.fine_grid_shift!=params.grid_shift))
    || (params.exact_level_count==2u && params.grid_spacing_m!=2.0*params.fine_grid_spacing_m)){
    fail(INVALID_HISTORY|INVALID_GEOMETRY,51u);return;
  }
  let at=slot*32u;let phase=history_events[at+11u];let routing=history_events[at+10u];
  let position=vec3<f32>(history_events[at],history_events[at+1u],history_events[at+2u]);
  let volume=history_events[at+23u];let mass=history_events[at+13u];
  if(history_events[at+18u]!=1.0||!finite_f32(volume)||!(volume>0.0)||!finite_f32(mass)||!(mass>0.0)
    || !finite_f32(position.x)||!finite_f32(position.y)||!finite_f32(position.z)){
    fail(INVALID_HISTORY,51u);return;
  }
  if(phase==3.0 && routing==1.0){return;}
  if((phase!=1.0 && phase!=2.0)||routing!=0.0){fail(INVALID_HISTORY,51u);return;}
  let grid_position=position*(1.0/params.fine_grid_spacing_m);
  if(!finite_f32(grid_position.x)||!finite_f32(grid_position.y)||!finite_f32(grid_position.z)
    || any(abs(grid_position)>vec3<f32>(2147483000.0))){fail(INVALID_HISTORY|INVALID_GEOMETRY,51u);return;}
  let base_f=floor(grid_position-vec3<f32>(0.5));let base=vec3<i32>(base_f);let fraction=grid_position-base_f;
  atomicAdd(&output_control[50u],1u);
  for(var stencil=0u;stencil<27u;stencil++){
    let offset=vec3<u32>(stencil/9u,(stencil%9u)/3u,stencil%3u);
    let weight=aerosol_quadratic_weight(fraction.x,offset.x)*aerosol_quadratic_weight(fraction.y,offset.y)
      *aerosol_quadratic_weight(fraction.z,offset.z);
    if(weight==0.0){continue;}
    if(!aerosol_project_fine_node(base+vec3<i32>(offset),volume*weight)){
      fail(INVALID_HISTORY|INVALID_GEOMETRY,51u);return;
    }
  }
}
`;
}
