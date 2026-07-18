export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_WORKGROUP_SIZE = 64;
export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_PARAMS_BYTES = 16;
export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_FLAG_ADMITTED = 1;

/**
 * Refresh a particle-parallel level-assignment source without rerunning level
 * selection. Assignment rows are copied as u32 words so that level, support,
 * volume, material, phase, status, hysteresis and chart identity remain
 * bit-for-bit frozen for the macro step. Only the three position words are
 * replaced from the exact retained state buffer for the current substep.
 */
export const schroederFrozenLevelAssignmentRefreshWgsl = /* wgsl */ `
struct FrozenLevelAssignmentRefreshParams {
  particle_count: u32,
  assignment_stride_words: u32,
  state_stride_words: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> prior_assignments: array<u32>;
@group(0) @binding(1) var<storage, read> current_state: array<u32>;
@group(0) @binding(2) var<storage, read_write> refreshed_assignments: array<u32>;
@group(0) @binding(3) var<uniform> params: FrozenLevelAssignmentRefreshParams;

const ASSIGNMENT_STRIDE_WORDS: u32 = 16u;
const STATE_STRIDE_WORDS: u32 = 8u;
const POSITION_X_WORD: u32 = 12u;
const POSITION_Y_WORD: u32 = 13u;
const POSITION_Z_WORD: u32 = 14u;
const FLAG_ADMITTED: u32 = ${SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_FLAG_ADMITTED}u;

@compute @workgroup_size(${SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (
    params.assignment_stride_words != ASSIGNMENT_STRIDE_WORDS
    || params.state_stride_words != STATE_STRIDE_WORDS
    || (params.flags & FLAG_ADMITTED) == 0u
  ) {
    // The output range is cleared by the caller-owned encoder before this
    // pass. Returning here therefore leaves a structurally fail-closed row.
    return;
  }

  let assignment_offset = particle_index * ASSIGNMENT_STRIDE_WORDS;
  let state_offset = particle_index * STATE_STRIDE_WORDS;
  for (var word = 0u; word < ASSIGNMENT_STRIDE_WORDS; word = word + 1u) {
    refreshed_assignments[assignment_offset + word] =
      prior_assignments[assignment_offset + word];
  }

  refreshed_assignments[assignment_offset + POSITION_X_WORD] = current_state[state_offset + 0u];
  refreshed_assignments[assignment_offset + POSITION_Y_WORD] = current_state[state_offset + 1u];
  refreshed_assignments[assignment_offset + POSITION_Z_WORD] = current_state[state_offset + 2u];
}
`;
