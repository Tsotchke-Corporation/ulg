export const ULG_COHERENT_SOLID_FRAME_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame.v0';
export const ULG_COHERENT_SOLID_MEMBER_SCHEMA =
  'peercompute.ulg.schroeder-solid-member.v0';
export const ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA =
  'peercompute.ulg.schroeder-solid-contact-proxy.v0';
export const ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA =
  'peercompute.ulg.schroeder-solid-shape-carrier.v0';
export const ULG_COHERENT_SOLID_REST_MESH_SCHEMA =
  'peercompute.ulg.schroeder-solid-rest-mesh.v0';
export const ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-solid-render-execution.v0';
export const ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA =
  'peercompute.ulg.schroeder-solid-draw-entry.v0';
export const ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA =
  'peercompute.ulg.schroeder-solid-draw-entries.v0';
export const ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA =
  'peercompute.ulg.schroeder-solid-native-executor.v0';
export const ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA =
  'peercompute.ulg.schroeder-solid-member-membership.v0';
export const ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA =
  'peercompute.ulg.schroeder-solid-member-wrench-input.v0';
export const ULG_COHERENT_SOLID_TRANSFORMED_MEMBER_SCHEMA =
  'peercompute.ulg.schroeder-solid-transformed-member.v0';
export const ULG_COHERENT_SOLID_BODY_WRENCH_SCHEMA =
  'peercompute.ulg.schroeder-solid-body-wrench.v0';
export const ULG_COHERENT_SOLID_BODY_INVARIANT_SCHEMA =
  'peercompute.ulg.schroeder-solid-body-invariant.v0';
export const ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-solid-invariant-evidence.v0';
export const ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame-step-execution.v0';
export const ULG_COHERENT_SOLID_FRAME_GPU_PLAN_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame-gpu-plan.v0';
export const ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame-mutation-candidate.v0';
export const ULG_COHERENT_SOLID_AUTHORITY_POLICY_SCHEMA =
  'peercompute.ulg.schroeder-solid-authority-policy.v0';
export const ULG_COHERENT_SOLID_WORLD_CONTACT_PROXY_SCHEMA =
  'peercompute.ulg.schroeder-solid-world-contact-proxy.v0';
export const ULG_COHERENT_SOLID_COMPUTE_TASK_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame-compute-task.v0';
export const ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA =
  'peercompute.ulg.schroeder-solid-frame-compute-task-result.v0';
export const ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA =
  'peercompute.ulg.schroeder-solid-state-delta.v0';
export const ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA =
  'peercompute.ulg.schroeder-solid-commit-delta.v0';
export const ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA =
  'peercompute.ulg.schroeder-solid-state-manager-admission.v0';
export const ULG_COHERENT_SOLID_LOCAL_RETAINED_REFS_SCHEMA =
  'peercompute.ulg.schroeder-solid-local-retained-refs.v0';
export const ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA =
  'peercompute.ulg.schroeder-solid-draw-group.v0';
export const ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA =
  'peercompute.ulg.schroeder-solid-gpu-draw-range.v0';
export const ULG_COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_SCHEMA =
  'peercompute.ulg.schroeder-solid-particle-member-wrench.v0';
export const ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-solid-proxy-compaction-evidence.v0';
export const ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA =
  'peercompute.ulg.schroeder-solid-chart-transition.v0';

export const COHERENT_SOLID_FRAME_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'component_generation:u32',
  'source_epoch:u32',
  'admission_id:u32',
  'chart_id:u32',
  'chart_reference_id:u32',
  'local_scale_exponent:i32',
  'motion_mode:u32',
  'law_mask:u32',
  'generation_id:u32',
  'lease_id:u32',
  'lease_epoch:u32',
  'state_flags:u32',
  'center_of_mass_x_m:f32',
  'center_of_mass_y_m:f32',
  'center_of_mass_z_m:f32',
  'orientation_x:f32',
  'orientation_y:f32',
  'orientation_z:f32',
  'orientation_w:f32',
  'linear_momentum_x_kg_m_s:f32',
  'linear_momentum_y_kg_m_s:f32',
  'linear_momentum_z_kg_m_s:f32',
  'pad_linear_momentum:u32',
  'world_angular_momentum_x_kg_m2_s:f32',
  'world_angular_momentum_y_kg_m2_s:f32',
  'world_angular_momentum_z_kg_m2_s:f32',
  'pad_angular_momentum:u32',
  'mass_kg:f32',
  'temperature_k:f32',
  'internal_energy_j:f32',
  'approximation_error_budget:f32',
  'body_inertia_xx_kg_m2:f32',
  'body_inertia_xy_kg_m2:f32',
  'body_inertia_xz_kg_m2:f32',
  'pad_body_inertia_0:u32',
  'body_inertia_yx_kg_m2:f32',
  'body_inertia_yy_kg_m2:f32',
  'body_inertia_yz_kg_m2:f32',
  'pad_body_inertia_1:u32',
  'body_inertia_zx_kg_m2:f32',
  'body_inertia_zy_kg_m2:f32',
  'body_inertia_zz_kg_m2:f32',
  'pad_body_inertia_2:u32',
  'body_inverse_inertia_xx_per_kg_m2:f32',
  'body_inverse_inertia_xy_per_kg_m2:f32',
  'body_inverse_inertia_xz_per_kg_m2:f32',
  'pad_body_inverse_inertia_0:u32',
  'body_inverse_inertia_yx_per_kg_m2:f32',
  'body_inverse_inertia_yy_per_kg_m2:f32',
  'body_inverse_inertia_yz_per_kg_m2:f32',
  'pad_body_inverse_inertia_1:u32',
  'body_inverse_inertia_zx_per_kg_m2:f32',
  'body_inverse_inertia_zy_per_kg_m2:f32',
  'body_inverse_inertia_zz_per_kg_m2:f32',
  'pad_body_inverse_inertia_2:u32',
  'material_id:u32',
  'phase_id:u32',
  'closure_id:u32',
  'thermal_law_id:u32',
  'rest_shape_key:u32',
  'member_set_key:u32',
  'contact_proxy_key:u32',
  'render_proxy_key:u32',
  'topology_generation:u32',
  'connectivity_generation:u32',
  'damage_summary:f32',
  'yield_summary:f32',
  'strain_summary:f32',
  'approximation_error_observed:f32',
  'descriptor_generation:u32',
  'provenance_id:u32',
  'chart_origin_x_m:f32',
  'chart_origin_y_m:f32',
  'chart_origin_z_m:f32',
  'chart_local_scale_m:f32',
  'component_count:u32',
  'render_lod:u32',
  'frame_version:u32',
  'status:u32'
]);

export const COHERENT_SOLID_MEMBER_ROW_LAYOUT = Object.freeze([
  'body_index:u32',
  'body_id:u32',
  'member_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'provenance_id:u32',
  'material_id:u32',
  'phase_id:u32',
  'local_position_x_m:f32',
  'local_position_y_m:f32',
  'local_position_z_m:f32',
  'rest_volume_m3:f32',
  'mass_kg:f32',
  'temperature_k:f32',
  'internal_energy_j:f32',
  'exposed_area_weight_m2:f32',
  'local_inertia_xx_kg_m2:f32',
  'local_inertia_xy_kg_m2:f32',
  'local_inertia_xz_kg_m2:f32',
  'pad_local_inertia_0:u32',
  'local_inertia_yx_kg_m2:f32',
  'local_inertia_yy_kg_m2:f32',
  'local_inertia_yz_kg_m2:f32',
  'pad_local_inertia_1:u32',
  'local_inertia_zx_kg_m2:f32',
  'local_inertia_zy_kg_m2:f32',
  'local_inertia_zz_kg_m2:f32',
  'pad_local_inertia_2:u32',
  'damage:f32',
  'cohesion:f32',
  'strain_summary:f32',
  'contact_support_m:f32',
  'boundary_mask:u32',
  'interface_mask:u32',
  'reaction_mask:u32',
  'refinement_mask:u32',
  'connectivity_id:u32',
  'topology_generation:u32',
  'constitutive_state_key:u32',
  'status:u32'
]);

export const COHERENT_SOLID_CONTACT_PROXY_ROW_LAYOUT = Object.freeze([
  'body_index:u32',
  'body_id:u32',
  'proxy_id:u32',
  'member_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'active_ss_level:i32',
  'flags:u32',
  'local_position_x_m:f32',
  'local_position_y_m:f32',
  'local_position_z_m:f32',
  'pad_position:u32',
  'local_normal_x:f32',
  'local_normal_y:f32',
  'local_normal_z:f32',
  'area_weight_m2:f32',
  'volume_weight_m3:f32',
  'contact_support_m:f32',
  'boundary_velocity_source_id:u32',
  'slip_law_id:u32',
  'friction_law_id:u32',
  'contact_law_id:u32',
  'sdf_key:u32',
  'feature_id:u32',
  'wet_reason_mask:u32',
  'reaction_reason_mask:u32',
  'fracture_reason_mask:u32',
  'curvature_reason_mask:u32',
  'topology_generation:u32',
  'provenance_id:u32',
  'status:u32',
  'pad0:u32'
]);

export const COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'topology_generation:u32',
  'carrier_type:u32',
  'attachment_type:u32',
  'attachment_id:u32',
  'geometry_key:u32',
  'vertex_offset:u32',
  'vertex_count:u32',
  'index_offset:u32',
  'index_count:u32',
  'embedding_offset:u32',
  'embedding_count:u32',
  'material_id:u32',
  'phase_id:u32',
  'closure_id:u32',
  'pbr_material_key:u32',
  'visibility_flags:u32',
  'fracture_visibility_mask:u32',
  'melt_visibility_mask:u32',
  'render_lod:u32',
  'contact_lod:u32',
  'bounds_center_x_m:f32',
  'bounds_center_y_m:f32',
  'bounds_center_z_m:f32',
  'bounds_radius_m:f32',
  'provenance_id:u32',
  'status:u32',
  'pad0:u32',
  'pad1:u32',
  'pad2:u32'
]);

export const COHERENT_SOLID_REST_VERTEX_ROW_LAYOUT = Object.freeze([
  'local_position_x_m:f32',
  'local_position_y_m:f32',
  'local_position_z_m:f32',
  'pad_position:f32',
  'local_normal_x:f32',
  'local_normal_y:f32',
  'local_normal_z:f32',
  'pad_normal:f32',
  'base_color_linear_r:f32',
  'base_color_linear_g:f32',
  'base_color_linear_b:f32',
  'opacity:f32'
]);

export const COHERENT_SOLID_MEMBER_WRENCH_ROW_LAYOUT = Object.freeze([
  'member_id:u32',
  'body_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'force_x_n:f32',
  'force_y_n:f32',
  'force_z_n:f32',
  'status:u32',
  'direct_torque_x_n_m:f32',
  'direct_torque_y_n_m:f32',
  'direct_torque_z_n_m:f32',
  'provenance_id:u32'
]);

export const COHERENT_SOLID_TRANSFORMED_MEMBER_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'member_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'world_position_x_m:f32',
  'world_position_y_m:f32',
  'world_position_z_m:f32',
  'pad_position:u32',
  'world_velocity_x_m_s:f32',
  'world_velocity_y_m_s:f32',
  'world_velocity_z_m_s:f32',
  'pad_velocity:u32',
  'local_position_x_m:f32',
  'local_position_y_m:f32',
  'local_position_z_m:f32',
  'rest_volume_m3:f32',
  'mass_kg:f32',
  'exposed_area_weight_m2:f32',
  'status:u32',
  'body_index:u32'
]);

export const COHERENT_SOLID_BODY_WRENCH_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'component_generation:u32',
  'source_generation_id:u32',
  'lease_id:u32',
  'force_x_n:f32',
  'force_y_n:f32',
  'force_z_n:f32',
  'pad_force:u32',
  'world_torque_x_n_m:f32',
  'world_torque_y_n_m:f32',
  'world_torque_z_n_m:f32',
  'pad_torque:u32',
  'member_count:u32',
  'invalid_member_count:u32',
  'status:u32',
  'pad0:u32'
]);

export const COHERENT_SOLID_BODY_INVARIANT_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'component_generation:u32',
  'target_generation_id:u32',
  'lease_id:u32',
  'member_count:u32',
  'invalid_member_count:u32',
  'status:u32',
  'pad0:u32',
  'member_mass_sum_kg:f32',
  'mass_relative_residual:f32',
  'local_center_of_mass_residual_m:f32',
  'transform_position_residual_m:f32',
  'transform_velocity_residual_m_s:f32',
  'quaternion_norm_residual:f32',
  'inertia_symmetry_residual_kg_m2:f32',
  'inertia_inverse_residual:f32',
  'member_inertia_relative_residual:f32',
  'linear_momentum_norm_kg_m_s:f32',
  'angular_momentum_norm_kg_m2_s:f32',
  'kinetic_energy_j:f32',
  'center_of_mass_x_m:f32',
  'center_of_mass_y_m:f32',
  'center_of_mass_z_m:f32',
  'speed_m_s:f32',
  'quaternion_norm:f32',
  'frame_mass_kg:f32',
  'declared_error_budget:f32',
  'maximum_state_magnitude:f32',
  'topology_generation:u32',
  'connectivity_generation:u32',
  'frame_version:u32',
  'pad1:u32',
  'orientation_x:f32',
  'orientation_y:f32',
  'orientation_z:f32',
  'orientation_w:f32',
  'chart_id:u32',
  'chart_reference_id:u32',
  'local_scale_exponent:i32',
  'source_epoch:u32'
]);

export const COHERENT_SOLID_INVARIANT_EVIDENCE_LAYOUT = Object.freeze([
  'target_generation_id:u32',
  'lease_id:u32',
  'lease_epoch:u32',
  'body_count:u32',
  'member_count:u32',
  'integrated_body_count:u32',
  'transformed_member_count:u32',
  'wrench_body_count:u32',
  'invalid_input_count:u32',
  'stale_generation_count:u32',
  'identity_mismatch_count:u32',
  'non_finite_count:u32',
  'max_quaternion_norm_residual:f32_bits',
  'max_mass_relative_residual:f32_bits',
  'max_local_center_of_mass_residual_m:f32_bits',
  'max_inertia_symmetry_residual_kg_m2:f32_bits',
  'max_inertia_inverse_residual:f32_bits',
  'max_member_inertia_relative_residual:f32_bits',
  'max_transform_position_residual_m:f32_bits',
  'max_transform_velocity_residual_m_s:f32_bits',
  'max_linear_momentum_update_residual:f32_bits',
  'max_angular_momentum_update_residual:f32_bits',
  'numerically_admissible:u32',
  'body_invariant_count:u32',
  'body_rejected_count:u32',
  'authority_status_flags:u32',
  'overflow_flags:u32',
  'source_generation_id:u32',
  'status:u32',
  'workgroup_size:u32',
  'submission_owned_by_caller:u32',
  'state_manager_admission_required:u32'
]);

export const COHERENT_SOLID_WORLD_CONTACT_PROXY_ROW_LAYOUT = Object.freeze([
  'body_id:u32',
  'proxy_id:u32',
  'component_generation:u32',
  'generation_id:u32',
  'world_position_x_m:f32',
  'world_position_y_m:f32',
  'world_position_z_m:f32',
  'status:u32',
  'world_normal_x:f32',
  'world_normal_y:f32',
  'world_normal_z:f32',
  'active_ss_level:i32',
  'world_velocity_x_m_s:f32',
  'world_velocity_y_m_s:f32',
  'world_velocity_z_m_s:f32',
  'chart_id:i32',
  'area_weight_m2:f32',
  'volume_weight_m3:f32',
  'contact_support_m:f32',
  'feature_id:u32',
  'topology_generation:u32',
  'hierarchy_generation:u32',
  'position_epoch:u32',
  'provenance_id:u32'
]);

export const COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_ROW_LAYOUT = Object.freeze([
  'member_id:u32',
  'body_id:u32',
  'force_x_n:f32',
  'force_y_n:f32',
  'force_z_n:f32',
  'direct_torque_x_n_m:f32',
  'direct_torque_y_n_m:f32',
  'direct_torque_z_n_m:f32',
  'status:u32',
  'provenance_id:u32',
  'position_epoch:u32',
  'pad0:u32'
]);

export const COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_LAYOUT = Object.freeze([
  'target_generation_id:u32',
  'lease_id:u32',
  'input_proxy_count:u32',
  'unique_proxy_count:u32',
  'emitted_proxy_count:u32',
  'duplicate_proxy_count:u32',
  'invalid_proxy_count:u32',
  'overflow_proxy_count:u32',
  'numerically_admissible:u32',
  'target_chart_id:i32',
  'target_level_id:i32',
  'target_hierarchy_generation:u32',
  'source_position_epoch:u32',
  'target_position_epoch:u32',
  'status:u32',
  'workgroup_size:u32'
]);

export const COHERENT_SOLID_FRAME_WORDS = COHERENT_SOLID_FRAME_ROW_LAYOUT.length;
export const COHERENT_SOLID_MEMBER_WORDS = COHERENT_SOLID_MEMBER_ROW_LAYOUT.length;
export const COHERENT_SOLID_CONTACT_PROXY_WORDS =
  COHERENT_SOLID_CONTACT_PROXY_ROW_LAYOUT.length;
export const COHERENT_SOLID_SHAPE_CARRIER_WORDS =
  COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT.length;
export const COHERENT_SOLID_REST_VERTEX_FLOATS =
  COHERENT_SOLID_REST_VERTEX_ROW_LAYOUT.length;
export const COHERENT_SOLID_MEMBER_WRENCH_WORDS =
  COHERENT_SOLID_MEMBER_WRENCH_ROW_LAYOUT.length;
export const COHERENT_SOLID_TRANSFORMED_MEMBER_WORDS =
  COHERENT_SOLID_TRANSFORMED_MEMBER_ROW_LAYOUT.length;
export const COHERENT_SOLID_BODY_WRENCH_WORDS =
  COHERENT_SOLID_BODY_WRENCH_ROW_LAYOUT.length;
export const COHERENT_SOLID_BODY_INVARIANT_WORDS =
  COHERENT_SOLID_BODY_INVARIANT_ROW_LAYOUT.length;
export const COHERENT_SOLID_INVARIANT_EVIDENCE_WORDS =
  COHERENT_SOLID_INVARIANT_EVIDENCE_LAYOUT.length;
export const COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS =
  COHERENT_SOLID_WORLD_CONTACT_PROXY_ROW_LAYOUT.length;
export const COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_WORDS =
  COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_ROW_LAYOUT.length;
export const COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_WORDS =
  COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_LAYOUT.length;

export const COHERENT_SOLID_MOTION_DYNAMIC = 1;
export const COHERENT_SOLID_MOTION_STATIC = 2;
export const COHERENT_SOLID_MOTION_KINEMATIC = 3;

export const COHERENT_SOLID_ROW_STATUS_ACTIVE = 1 << 0;
export const COHERENT_SOLID_ROW_STATUS_BOUNDARY = 1 << 1;
export const COHERENT_SOLID_ROW_STATUS_INTERIOR = 1 << 2;
export const COHERENT_SOLID_ROW_STATUS_FAIL_CLOSED = 1 << 31;

export const COHERENT_SOLID_INVARIANT_STATUS_READY = 1 << 0;
export const COHERENT_SOLID_INVARIANT_STATUS_NUMERICALLY_ADMISSIBLE = 1 << 1;
export const COHERENT_SOLID_INVARIANT_STATUS_FAIL_CLOSED = 1 << 2;
export const COHERENT_SOLID_INVARIANT_STATUS_AWAITING_STATE_MANAGER = 1 << 3;

export const COHERENT_SOLID_AUTHORITY_STATUS_NODE_KERNEL = 1 << 0;
export const COHERENT_SOLID_AUTHORITY_STATUS_COMPUTE_MANAGER = 1 << 1;
export const COHERENT_SOLID_AUTHORITY_STATUS_GPU_HUB = 1 << 2;
export const COHERENT_SOLID_AUTHORITY_STATUS_STATE_MANAGER_REQUIRED = 1 << 3;

export const COHERENT_SOLID_STATE_MANAGER_ADMITTED = 'state-manager-admitted';
export const COHERENT_SOLID_DERIVED_ADMITTED =
  'compute-manager-gpuhub-derived-admitted';

export const COHERENT_SOLID_DEFAULT_TOLERANCES = Object.freeze({
  quaternionNorm: 2e-5,
  massRelative: 2e-5,
  localCenterOfMassM: 2e-5,
  inertiaSymmetryKgM2: 2e-5,
  inertiaInverse: 5e-5,
  memberInertiaRelative: 5e-5,
  transformPositionM: 2e-5,
  transformVelocityMPerS: 2e-5,
  momentumUpdate: 2e-5
});

export const ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY = Object.freeze({
  schema: ULG_COHERENT_SOLID_AUTHORITY_POLICY_SCHEMA,
  schedulerOwner: 'peercompute-node-kernel-compute-manager',
  residentBufferOwner: 'peercompute-gpu-hub',
  authoritativeMutationOwner: 'peercompute-state-manager',
  lawContentOwner: 'ulg',
  stateFamilies: Object.freeze({
    frame: Object.freeze({
      schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
      authority: 'state-manager-admitted',
      writers: Object.freeze(['solid-frame-integrate']),
      readers: Object.freeze([
        'solid-member-transform',
        'solid-contact-proxy-transform',
        'solid-shape-transform',
        'solid-invariant-reduction'
      ])
    }),
    members: Object.freeze({
      schema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
      authority: 'state-manager-admitted-material-space',
      writers: Object.freeze(['solid-topology-apply']),
      readers: Object.freeze([
        'solid-member-transform',
        'solid-wrench-reduction',
        'solid-invariant-reduction'
      ])
    }),
    contactProxies: Object.freeze({
      schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
      authority: 'derived-generation-scoped',
      writers: Object.freeze(['solid-contact-proxy-build']),
      readers: Object.freeze(['resident-neighborhood', 'solid-interface-laws'])
    }),
    worldContactProxies: Object.freeze({
      schema: ULG_COHERENT_SOLID_WORLD_CONTACT_PROXY_SCHEMA,
      authority: 'compute-manager-gpuhub-derived-admitted',
      writers: Object.freeze(['solid-contact-proxy-transform']),
      readers: Object.freeze(['resident-neighborhood', 'solid-interface-laws'])
    }),
    proxyCompactionEvidence: Object.freeze({
      schema: ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
      authority: 'compute-manager-gpuhub-derived-admitted',
      writers: Object.freeze(['solid-contact-proxy-radix-compaction']),
      readers: Object.freeze(['state-manager-admission', 'native-webgpu-solid-render'])
    }),
    shapeCarriers: Object.freeze({
      schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
      authority: 'state-manager-admitted-topology',
      writers: Object.freeze(['solid-topology-apply']),
      readers: Object.freeze(['native-webgpu-solid-render'])
    }),
    drawEntries: Object.freeze({
      schema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
      entrySchema: ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA,
      authority: 'state-manager-admitted-presentation-view',
      writers: Object.freeze(['state-manager-solid-draw-publication']),
      readers: Object.freeze(['native-webgpu-solid-render'])
    }),
    frameMutationCandidate: Object.freeze({
      schema: ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
      authority: 'not-authoritative-until-state-manager-admission',
      writers: Object.freeze(['solid-frame-integrate']),
      readers: Object.freeze(['solid-invariant-reduction', 'state-manager-admission'])
    })
  }),
  submissionOwnership: 'caller-compute-manager-lane',
  readbackPolicy: 'fixed-evidence-only-explicit-validation',
  cpuMirrorRequired: false,
  sceneSchedulerAllowed: false
});

export const ULG_COHERENT_SOLID_ABI = Object.freeze({
  frameSchema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
  memberSchema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  contactProxySchema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  shapeCarrierSchema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  restMeshSchema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  drawEntrySchema: ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA,
  drawEntriesSchema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
  nativeExecutorSchema: ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA,
  proxyCompactionEvidenceSchema: ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  chartTransitionSchema: ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  frameLayout: COHERENT_SOLID_FRAME_ROW_LAYOUT,
  memberLayout: COHERENT_SOLID_MEMBER_ROW_LAYOUT,
  contactProxyLayout: COHERENT_SOLID_CONTACT_PROXY_ROW_LAYOUT,
  worldContactProxyLayout: COHERENT_SOLID_WORLD_CONTACT_PROXY_ROW_LAYOUT,
  particleMemberWrenchLayout: COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_ROW_LAYOUT,
  proxyCompactionEvidenceLayout: COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_LAYOUT,
  shapeCarrierLayout: COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT,
  restVertexLayout: COHERENT_SOLID_REST_VERTEX_ROW_LAYOUT,
  authority: ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY,
  rigidState: 'se3-center-of-mass-position-unit-quaternion-linear-and-world-angular-momentum',
  integration: 'momentum-first-symplectic-euler-plus-quaternion-exponential-map',
  memberTransform: 'immutable-material-coordinate-through-resident-frame',
  wrenchReduction: 'body-csr-parallel-workgroup-reduction',
  evidence: 'fixed-size-gpu-reduction-no-hot-state-readback'
});
