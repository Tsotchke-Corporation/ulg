const e=Object.freeze({material:`eshkol.ulg.material-closure.v0`,eos:`eshkol.ulg.eos-closure.v0`,"phase-equilibrium":`eshkol.ulg.phase-equilibrium-closure.v0`,transport:`eshkol.ulg.transport-closure.v0`,mechanical:`eshkol.ulg.mechanical-closure.v0`,optical:`eshkol.ulg.optical-closure.v0`,radiation:`eshkol.ulg.radiation-closure.v0`,"wall-boundary":`eshkol.ulg.wall-boundary-closure.v0`}),t=Object.freeze([`materialValidation`,`eosValidation`,`mechanicalValidation`,`opticalValidation`,`phaseChangeValidation`,`sphValidation`,`scientificValidation`,`fullPhysicsValidation`]);Object.freeze([`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`]);function n(){let e={};for(let n of t)e[n]=!1;return e}function r(e={},{evidenceRefs:r=[]}={}){let i=Array.isArray(r)&&r.length>0,a=n();for(let n of t){let t=e[n]===!0;if(t&&!i)throw Error(`Overclaim rejected: ${n} cannot be true without validation.evidenceRefs`);a[n]=t&&i}return a}function i(e,t){if(!e||typeof e!=`object`)throw Error(`${t} closure requires a validityDomain`);let n=e.temperatureK;if(!Array.isArray(n)||n.length!==2||!(Number(n[0])<Number(n[1])))throw Error(`${t} closure validityDomain.temperatureK must be an ascending [min, max] range`)}function a({artifactId:e,species:t,producer:r={},data:i={},derived:a={},comparison:o=null,quantitative:s=!1,provenance:c={}}){if(!e||!t)throw Error(`artifactId and species are required for microphysics reference artifacts`);return{schema:`moonlab.ulg.microphysics-reference.v0`,artifactId:e,sourceService:`moonlab`,species:t,producer:r,data:i,derived:a,comparison:o,quantitative:s===!0,status:s===!0?`produced-quantitative`:`produced-model-not-quantitative`,...n(),provenance:{sourceService:`moonlab`,...c,notes:[...c.notes||[],`Produced microphysics evidence: exact ground state of a MoonLab molecular Hamiltonian.`,`Evidence only; does not by itself flip closure material/EOS/scientific validation.`]}}}function o({closureFamily:t,closureId:n,material:a,inputRefs:o=[],producer:s={},validityDomain:c={},units:l={},properties:u={},derivatives:d=!1,descriptors:f={},uncertainty:p={},tolerance:m={},validation:h={},provenance:g={}}){let _=e[t];if(!_)throw Error(`Unknown closure family: ${t}`);if(!n)throw Error(`closureId is required for material closures`);i(c,t);let v=r(h,{evidenceRefs:h.evidenceRefs});return{schema:_,closureFamily:t,closureId:n,closureKind:`sph-phase-${t}`,material:a||null,inputRefs:o,producer:{service:s.service||`eshkol`,commit:s.commit||null,toolchain:s.toolchain||null,...s},validityDomain:c,units:l,properties:u,derivatives:d,descriptors:f,uncertainty:p,tolerance:m,validation:{status:h.status||`reference-fixture-unvalidated`,evidenceRefs:Array.isArray(h.evidenceRefs)?h.evidenceRefs:[],...v},closureBacked:!0,provenance:{sourceService:`eshkol`,...g,notes:[...g.notes||[],`Closure family ${t}; values from tagged reference fixtures unless evidenceRefs are present.`,`No validated material/EOS/mechanical/optical/phase/SPH/scientific physics is claimed without evidence.`]}}}const s=Object.freeze([`generation_id:u32`,`input_count:u32`,`exclusive_total:u32`,`admitted:u32`,`overflow_flags:u32`,`level_count:u32`,`workgroup_size:u32`,`status:u32`]),c=Object.freeze([`generation_id:u32`,`input_count:u32`,`unique_count:u32`,`admitted:u32`,`overflow_flags:u32`,`key_word_count:u32`,`key_stride_words:u32`,`status:u32`]),l=Object.freeze([`workgroup_count_x:u32`,`workgroup_count_y:u32`,`workgroup_count_z:u32`]),u=Object.freeze([`element_count:u32`,`generation_seal:u32`]),d=Object.freeze(`magic:u32.abi_version:u32.status_flags:u32.expected_generation_seal:u32.observed_generation_seal:u32.live_element_count:u32.maximum_element_count:u32.overflow_count:u32.key_word_count:u32.key_stride_words:u32.radix_workgroup_count:u32.histogram_element_count:u32.consumer_workgroup_size:u32.generation_id:u32.histogram_scan_level_count:u32.head_scan_level_count:u32.authority_count_offset_words:u32.authority_seal_offset_words:u32.indirect_row_count:u32.completion_generation_seal:u32.radix_dispatch_offset_words:u32.histogram_scan_count_offset_words:u32.head_scan_count_offset_words:u32.histogram_scan_dispatch_offset_words:u32.head_scan_dispatch_offset_words:u32.control_word_count:u32.dispatch_x_limit:u32.reserved1:u32.reserved2:u32.reserved3:u32.reserved4:u32.reserved5:u32`.split(`.`));d.length,Object.freeze({schema:`peercompute.ulg.webgpu-u32-exclusive-scan.v0`,scalarEncoding:`u32`,evidenceRowLayout:s,workgroupOwnership:`caller-owned-compute-manager-gpu-lane`,submissionOwnership:`caller`,readbackPolicy:`fixed-evidence-diagnostic-only`}),Object.freeze({schema:`peercompute.ulg.webgpu-radix-unique.v0`,scalarEncoding:`u32`,evidenceRowLayout:c,dispatchRowLayout:l,keyOrdering:`lexicographic-most-significant-word-first`,sortPayload:`stable-u32-permutation-indices`,sortedGroupIndexPayload:`exclusive-unique-head-prefix-per-sorted-row`,csrTerminator:`offsets[unique_count]=input_count`,submissionOwnership:`caller`,readbackPolicy:`fixed-evidence-diagnostic-only`}),Object.freeze({schema:`peercompute.ulg.webgpu-radix-gpu-count.v1`,scalarEncoding:`u32`,authorityRowLayout:u,authorityPublication:`producer-writes-count-before-generation-seal-and-never-mutates-that-generation`,controlHeaderLayout:d,evidenceRowLayout:c,dispatchRowLayout:l,countOwnership:`authenticated-gpu-authority-buffer`,topologyOwnership:`gpu-preflight-fixed-maximum-scan-topology`,resourcePreparation:`explicit-prewarm-outside-encode`,executionConcurrency:`single-flight-per-runtime-until-discard-or-submission-fence`,inactiveDispatchPolicy:`zero-workgroup-indirect-row`,overflowPolicy:`fail-closed-zero-dispatch`,submissionOwnership:`caller`,readbackPolicy:`fixed-evidence-diagnostic-only`});const f=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.sourceCount:u32.selectedLevel:i32-bits.gridNodeCount:u32.gridDimX:u32.gridDimY:u32.gridDimZ:u32.gridShift:u32.gridSpacingM:f32-bits.occupancyWordCount:u32.nodeCapacity:u32.nodeCount:u32.invalidSourceCount:u32.overflowCount:u32.attemptedSourceCount:u32.selectedSourceCount:u32.stencilVisitCount:u32.completionOrdinal:u32.nodeOffsetWords:u32.requiredWords:u32.capacityWords:u32.sourceRowLayoutId:u32.dispatchX:u32.clearedWords:u32.directoryGenerationId:u32`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-mechanics-view.v1`,version:1,headerOffsetWords:20,headerLayout:f,nodeOffsetWords:64,dispatchOffsetWords:60,nodeIdentity:`ascending-unique-dense-grid-storage-index-u32`,construction:`directory-authenticated-particle-stencil-bitset-popcount-exclusive-scan`,sourceAuthority:`ss-spatial-epoch-v1-physical-or-v2-active-source-projection-and-physical-reverse`,dispatchAuthority:`gpu-finalized-node-count-indirect-dispatch`,directoryVersions:Object.freeze({1:Object.freeze({sourceWorkIdentity:`stable-physical-source-index`,sourceDispatchAuthority:`host-physical-count`}),2:Object.freeze({sourceWorkIdentity:`gpu-active-ordinal`,sourceDispatchAuthority:`retained-active-source-view-v1-gpu-indirect-dispatch`,publicSourceIdentity:`stable-physical-source-slot-u32`,activeCountReadback:!1,emptyActiveSet:`admitted-zero-node-zero-consumer-dispatch`})}),particleAlignment:!1,overflowPolicy:`fail-closed-zero-indirect-dispatch`,readbackPolicy:`explicit-probe-only`});const p=`peercompute.ulg.schroeder-spatial-active-source-view.v1`,m=1397970481,h=4294967295,g=Object.freeze([`magic:u32`,`abiVersion:u32`,`statusFlags:u32`,`generationId:u32`,`deviceOrdinal:u32`,`laneOrdinal:u32`,`leaseToken:u32`,`sourceFamilyId:u32`,`storageGeneration:u32`,`physicsTick:u32`,`physicsSubstep:u32`,`positionEpoch:u32`,`topologyEpoch:u32`,`chartEpoch:u32`,`levelEpoch:u32`,`supportEpoch:u32`,`physicalSourceCount:u32`,`physicalSourceCapacity:u32`,`activeSourceCount:u32`,`activeSourceCapacity:u32`,`dormantSourceCount:u32`,`invalidSourceCount:u32`,`overflowCount:u32`,`sourceRowLayoutId:u32`,`sourceRowStrideFloats:u32`,`activeToPhysicalOffsetWords:u32`,`physicalToActiveOffsetWords:u32`,`capacityWords:u32`,`logicalRequiredWords:u32`,`buildOrdinal:u32`,`completionOrdinal:u32`,`sourceFingerprint:u32`,`classifyCount:u32`,`scatterCount:u32`,`reverseCount:u32`,`scanTerminal:u32`,`activePhysicalHighWaterExclusive:u32`,`producerWorkgroupSize:u32`,`dispatchXLimit:u32`,`clearedWords:u32`,`activeDispatchOffsetWords:u32`,`candidateDispatchOffsetWords:u32`,`physicalDispatchOffsetWords:u32`,`activeCandidateCount:u32`,`activeCandidateCapacity:u32`,`capacityTierOrdinal:u32`,`overflowRequiredActiveCount:u32`,`seal:u32`,`activeDispatchX:u32`,`activeDispatchY:u32`,`activeDispatchZ:u32`,`candidateDispatchX:u32`,`candidateDispatchY:u32`,`candidateDispatchZ:u32`,`physicalDispatchX:u32`,`physicalDispatchY:u32`,`physicalDispatchZ:u32`,...Array.from({length:7},(e,t)=>`reserved${t}:u32`)]);Object.freeze({schema:p,version:1,magic:m,headerWords:64,headerLayout:g,producerWorkgroupSize:64,consumerWorkgroupSize:64,sourceRowLayoutId:1,sourceRowStrideFloats:16,ordering:`stable-ascending-physical-source-index`,forwardMap:`active-ordinal-to-physical-source-index`,reverseMap:`physical-source-index-to-active-ordinal-or-0xffffffff-for-dormant`,construction:`parallel-row-classification-exclusive-u32-scan-stable-scatter-gpu-finalize`,overflowPolicy:`fail-closed-zero-indirect-dispatch-and-publish-required-active-count`,residency:`same-generation-lease-as-the-owning-direct-spatial-epoch`});const _=`peercompute.ulg.schroeder-spatial-epoch.v1`,v=`peercompute.ulg.schroeder-spatial-epoch.v2`,y=1397966129,b=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.sourceCount:u32.sourceCapacity:u32.cellCount:u32.cellCapacity:u32.logicalRequiredWords:u32.logicalAdmittedWords:u32.directoryCapacityWords:u32.invalidSourceCount:u32.overflowCount:u32.exactKeyWordCount:u32.sortKeyWordCount:u32.sortMode:u32.headerWords:u32.cellKeysOffsetWords:u32.cellOffsetsOffsetWords:u32.cellMembersOffsetWords:u32.particleToCellOffsetWords:u32.buildOrdinal:u32.sortUniqueOrdinal:u32.completionOrdinal:u32.uniqueGenerationId:u32.uniqueInputCount:u32.primitiveUniqueCount:u32.primitiveAdmitted:u32.primitiveOverflowFlags:u32.primitiveStatus:u32.consumerDispatchX:u32.consumerDispatchY:u32.consumerDispatchZ:u32.clearedWords:u32.sourceAdapterId:u32.physicalAddressUpperBoundWords:u32`.split(`.`)),x=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.physicalSourceCount:u32.physicalSourceCapacity:u32.cellCount:u32.cellCapacity:u32.logicalRequiredWords:u32.logicalAdmittedWords:u32.directoryCapacityWords:u32.invalidSourceCount:u32.overflowCount:u32.exactKeyWordCount:u32.sortKeyWordCount:u32.sortMode:u32.headerWords:u32.cellKeysOffsetWords:u32.cellOffsetsOffsetWords:u32.cellMembersOffsetWords:u32.physicalToCellPlusOneOffsetWords:u32.buildOrdinal:u32.sortUniqueOrdinal:u32.completionOrdinal:u32.uniqueGenerationId:u32.activeSourceCount:u32.primitiveUniqueCount:u32.primitiveAdmitted:u32.primitiveOverflowFlags:u32.primitiveStatus:u32.consumerDispatchX:u32.consumerDispatchY:u32.consumerDispatchZ:u32.clearedWords:u32.sourceAdapterId:u32.physicalAddressUpperBoundWords:u32`.split(`.`)),S=Object.freeze([`chartId:u32`,`levelOrderKey:u32`,`cellXOrderKey:u32`,`cellYOrderKey:u32`,`cellZOrderKey:u32`]),C=Object.freeze({schema:_,version:1,headerLayout:b,keyLayout:S,structuralIdentity:`exact-chart-level-signed-cell-u32x5`,sortStrategies:Object.freeze([`collision-free-bounded-atlas-u32`,`exact-lexicographic-u32x5`]),membership:`stable-cell-csr-with-particle-reverse-map`,wordTelemetry:Object.freeze({logicalRequiredWords:`compact-live-payload-count-not-a-bind-or-slice-boundary`,logicalAdmittedWords:`compact-live-payload-count-only-when-gpu-admitted`,physicalAddressUpperBoundWords:`exclusive-live-high-water-when-admitted-full-capacity-bound-when-fail-closed`,directoryCapacityWords:`retained-allocation-and-consumer-binding-capacity`}),consumerDispatchLinearization:`linearGroup=workgroup.x+workgroup.y*consumerDispatchX`,arenaResidency:`configurable-complete-fence-leased-generation-arenas`,submissionOwnership:`caller`,readbackPolicy:`fixed-evidence-or-explicit-probe-only`,queryGeometryEvidence:Object.freeze({adapterId:2,wordCount:6,liveOffset:`particleToCellOffsetWords+sourceCount`,layout:Object.freeze([`chartId:u32`,`minLevel:i32-bits`,`maxLevel:i32-bits`,`baseGridSpacingM:f32-bits`,`occupiedLevelMaskLow:u32`,`occupiedLevelMaskHigh:u32`]),rowAdmission:`all-active-rows-match-single-chart-inclusive-level-range-and-exact-f32-pow2-spacing`,completionProof:`ready-admitted-no-invalid-source-and-completion-ordinal-equals-build-ordinal`}),overflowPolicy:`fail-closed-zero-consumer-dispatch`,productionConsumerStatus:`pressure-contact-exact-near-mounted-generation-owner-scope-diagnostic-only`});Object.freeze({schema:v,version:2,magic:y,headerWords:48,headerLayout:x,keyLayout:S,sourceRowLayoutId:1,sourceWorkIdentity:`gpu-active-ordinal`,publicMemberIdentity:`stable-physical-source-slot-u32`,memberCountAuthorityWord:37,reverseMap:Object.freeze({offsetWord:32,sourceIdentity:`stable-physical-source-slot-u32`,encoding:`cell-index-plus-one`,missingValue:0,encodingId:1}),sourceKeyScratch:Object.freeze({words:6,structuralKeyWords:5,physicalSourceWord:5,sortContract:`sort-only-words-0-through-4-word-5-is-unsorted-physical-identity-payload`}),activeSourceCountAuthority:Object.freeze({schema:p,headerWord:18,byteOffset:18*Uint32Array.BYTES_PER_ELEMENT,capacityField:`activeSourceCapacity`,residency:`gpu-only-no-host-numeric-count-required`}),queryGeometryEvidence:Object.freeze({adapterId:2,wordCount:6,capacityOffset:`physicalToCellPlusOneOffsetWords+physicalSourceCapacity`,layout:C.queryGeometryEvidence.layout}),compatibility:Object.freeze({levelAssignmentOnly:!0,activeNodeAndGasDirectoryVersion:1,dualDirectoryForOneLevelAssignmentGeneration:!1}),overflowPolicy:`fail-closed-zero-consumer-dispatch`,readbackPolicy:`none-gpu-authored-active-count`}),Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-view.v1`,directorySchema:_,generationAdmission:`gpu-validates-complete-v1-header-before-first-lookup`,lookup:`exact-cell-key-binary-search-sparse-prefix-csr-range`,rangeTraversal:`lexicographic-level-x-y-prefix-bounds-then-complete-occupied-z-csr`,emptyCellEnumeration:!1,candidateBudget:null,candidateOverflowPolicy:`not-applicable-no-materialized-candidate-buffer`,initialChartPolicy:`single-declared-chart`,levelSpacingPolicy:`base-grid-spacing-times-pow2-level`,overlayPolicy:`fail-closed-until-explicit-level-spacing-sidecar`,fallbackPolicy:`legacy-lookup-only-before-canonical-generation-selection`,mountedInteractiveStatus:`mounted-same-device-pre-integration-generation-owner-scope-diagnostic-only-no-mechanics-authority`}),Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-view.v2`,directorySchema:v,generationAdmission:`gpu-validates-complete-v2-header-before-first-lookup`,lookup:`exact-cell-key-binary-search-active-prefix-physical-member-csr`,reverseLookup:`physical-source-slot-to-cell-index-plus-one-zero-means-dormant-or-missing`,memberSpanBound:`directory.activeSourceCount`,memberIdentityBound:`directory.physicalSourceCount`,candidateBudget:null,candidateOverflowPolicy:`not-applicable-no-materialized-candidate-buffer`,fallbackPolicy:`none-after-level-assignment-v2-generation-selection`});function w(e,t,n,r){if(!e.includes(t))throw Error(`unable to derive Schroeder spatial v2 WGSL: ${r}`);return e.replace(t,n)}function T(){let e=`
struct SpatialEpochParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  sort_key_word_count: u32,
  sort_mode: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  lease_token: u32,
  build_ordinal: u32,
  sort_unique_ordinal: u32,
  chart_min: u32,
  chart_count: u32,
  level_min: i32,
  level_count: u32,
  cell_min_x: i32,
  cell_count_x: u32,
  cell_min_y: i32,
  cell_count_y: u32,
  cell_min_z: i32,
  cell_count_z: u32,
  header_words: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  directory_capacity_words: u32,
  required_capacity_words: u32,
  key_dispatch_x: u32,
  assemble_dispatch_x: u32,
  consumer_dispatch_x_limit: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  source_row_layout_id: u32,
  logical_count_gpu_authored: u32,
  physical_radix_count: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> exact_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> sort_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> epoch_evidence: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: SpatialEpochParams;

const ACTIVE_NODE_STRIDE: u32 = 16u;
const EXACT_KEY_WORDS: u32 = 5u;
const SORT_MODE_BOUNDED_ATLAS: u32 = 1u;
const SORT_MODE_LEXICOGRAPHIC: u32 = 2u;
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn safe_i32_f32(value: f32) -> bool {
  return finite_f32(value)
    && value >= MIN_SAFE_I32_F32
    && value <= MAX_SAFE_I32_F32;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn exact_near_query_profile_ready() -> bool {
  if (params.query_geometry_mode == QUERY_GEOMETRY_GENERIC) {
    return true;
  }
  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
  if (params.query_geometry_mode != QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    return false;
  }
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0;
}

fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}

fn write_invalid_keys(source_index: u32) {
  let exact_base = source_index * EXACT_KEY_WORDS;
  exact_keys[exact_base + 0u] = 0xffffffffu;
  exact_keys[exact_base + 1u] = 0xffffffffu;
  exact_keys[exact_base + 2u] = 0xffffffffu;
  exact_keys[exact_base + 3u] = 0xffffffffu;
  exact_keys[exact_base + 4u] = 0xffffffffu;
  let sort_base = source_index * params.sort_key_word_count;
  for (var word = 0u; word < params.sort_key_word_count; word = word + 1u) {
    sort_keys[sort_base + word] = 0xffffffffu;
  }
}

@compute @workgroup_size(64)
fn emit_spatial_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let source_index = linear_group * 64u + local_id.x;
  if (source_index >= params.physical_radix_count) {
    return;
  }
  // A caller may copy a GPU-authored logical count into params.source_count
  // after the host packs the capacity plan. The retained radix primitive still
  // sorts the fixed capacity, so the inactive suffix must receive one maximal
  // sentinel key without being counted as an invalid source.
  if (!count_contract_ready() || source_index >= effective_source_count()) {
    write_invalid_keys(source_index);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;
  let source_layout = params.source_row_layout_id;
  let level_f = source_rows[row + 0u];
  var native_spacing = 0.0;
  var source_particle_f = f32(source_index);
  var status_f = 0.0;
  if (source_layout == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
    native_spacing = source_rows[row + 1u];
    status_f = source_rows[row + 10u];
  } else if (source_layout == SOURCE_LAYOUT_ACTIVE_NODE) {
    native_spacing = source_rows[row + 8u];
    source_particle_f = source_rows[row + 10u];
    status_f = source_rows[row + 11u];
  } else {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let chart_f = source_rows[row + 15u];

  let fields_valid = integral_f32(level_f)
    && integral_f32(source_particle_f)
    && integral_f32(chart_f)
    && integral_f32(status_f)
    && status_f >= 0.0
    && status_f <= 255.0
    && finite_f32(native_spacing)
    && native_spacing > 0.0
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ));
  if (!fields_valid) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  var row_admitted = source_particle_f == f32(source_index)
    && source_index <= 16777215u
    // Low five bits carry the base assignment status. Bit 6 records an
    // admitted phase-volume overlay; bit 7 records a rejected/torn overlay.
    // The generic directory can consume admitted per-row native spacing, but
    // must fail closed on a rejected overlay.
    && (u32(round(status_f)) & 31u) > 0u
    && (u32(round(status_f)) & 128u) == 0u
    && chart_f >= 0.0
    && chart_f <= MAX_EXACT_F32_INTEGER
    && level_f >= MIN_SAFE_I32_F32
    && level_f <= MAX_SAFE_I32_F32;
  if (row_admitted && params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    let row_chart = u32(round(chart_f));
    let row_level = i32(round(level_f));
    let row_level_order = signed_order_key(row_level);
    let query_min_order = signed_order_key(params.query_min_level);
    let query_max_order = signed_order_key(params.query_max_level);
    let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(row_level));
    row_admitted = exact_near_query_profile_ready()
      && row_chart == params.query_chart_id
      && row_level_order >= query_min_order
      && row_level_order <= query_max_order
      && bitcast<u32>(native_spacing) == bitcast<u32>(expected_spacing)
      && (u32(round(status_f)) & 64u) == 0u;
  } else if (row_admitted && params.query_geometry_mode != QUERY_GEOMETRY_GENERIC) {
    row_admitted = false;
  }
  if (!row_admitted) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }

  let cell_f = floor(position / native_spacing);
  var cell_valid = safe_i32_f32(cell_f.x)
    && safe_i32_f32(cell_f.y)
    && safe_i32_f32(cell_f.z);
  if (cell_valid && params.chart_count > 0u) {
    let bounded_cell_order = vec3<u32>(
      signed_order_key(i32(cell_f.x)),
      signed_order_key(i32(cell_f.y)),
      signed_order_key(i32(cell_f.z))
    );
    let bounded_cell_min_order = vec3<u32>(
      signed_order_key(params.cell_min_x),
      signed_order_key(params.cell_min_y),
      signed_order_key(params.cell_min_z)
    );
    let bounded_cell_offset = bounded_cell_order - bounded_cell_min_order;
    cell_valid = bounded_cell_order.x >= bounded_cell_min_order.x
      && bounded_cell_offset.x < params.cell_count_x
      && bounded_cell_order.y >= bounded_cell_min_order.y
      && bounded_cell_offset.y < params.cell_count_y
      && bounded_cell_order.z >= bounded_cell_min_order.z
      && bounded_cell_offset.z < params.cell_count_z;
  }
  if (!cell_valid) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }

  let chart = u32(round(chart_f));
  let level = i32(round(level_f));
  let cell = vec3<i32>(cell_f);
  let level_order = signed_order_key(level);
  let cell_order = vec3<u32>(
    signed_order_key(cell.x),
    signed_order_key(cell.y),
    signed_order_key(cell.z)
  );
  let exact_base = source_index * EXACT_KEY_WORDS;
  exact_keys[exact_base + 0u] = chart;
  exact_keys[exact_base + 1u] = level_order;
  exact_keys[exact_base + 2u] = cell_order.x;
  exact_keys[exact_base + 3u] = cell_order.y;
  exact_keys[exact_base + 4u] = cell_order.z;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {
    let chart_offset = chart - params.chart_min;
    let chart_in = chart >= params.chart_min
      && chart_offset < params.chart_count;
    let level_min_order = signed_order_key(params.level_min);
    let cell_min_order = vec3<u32>(
      signed_order_key(params.cell_min_x),
      signed_order_key(params.cell_min_y),
      signed_order_key(params.cell_min_z)
    );
    let level_offset = level_order - level_min_order;
    let cell_offset = cell_order - cell_min_order;
    let level_in = level_order >= level_min_order
      && level_offset < params.level_count;
    let x_in = cell_order.x >= cell_min_order.x
      && cell_offset.x < params.cell_count_x;
    let y_in = cell_order.y >= cell_min_order.y
      && cell_offset.y < params.cell_count_y;
    let z_in = cell_order.z >= cell_min_order.z
      && cell_offset.z < params.cell_count_z;
    if (!(chart_in && level_in && x_in && y_in && z_in)) {
      write_invalid_keys(source_index);
      atomicAdd(&epoch_evidence[1], 1u);
      return;
    }
    var ordinal = chart_offset;
    ordinal = ordinal * params.level_count + level_offset;
    ordinal = ordinal * params.cell_count_x + cell_offset.x;
    ordinal = ordinal * params.cell_count_y + cell_offset.y;
    ordinal = ordinal * params.cell_count_z + cell_offset.z;
    sort_keys[source_index] = ordinal;
  } else if (params.sort_mode == SORT_MODE_LEXICOGRAPHIC) {
    let sort_base = source_index * EXACT_KEY_WORDS;
    for (var word = 0u; word < EXACT_KEY_WORDS; word = word + 1u) {
      sort_keys[sort_base + word] = exact_keys[exact_base + word];
    }
  } else {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  atomicAdd(&epoch_evidence[2], 1u);
}
`;return e=w(e,`@group(0) @binding(4) var<uniform> params: SpatialEpochParams;`,`@group(0) @binding(4) var<uniform> params: SpatialEpochParams;
@group(0) @binding(5) var<storage, read> active_source_view: array<u32>;`,`active-source binding`),e=w(e,`const EXACT_KEY_WORDS: u32 = 5u;`,`const EXACT_KEY_WORDS: u32 = 5u;
const SOURCE_KEY_WORDS: u32 = 6u;
const SOURCE_KEY_PHYSICAL_WORD: u32 = 5u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_STATUS_EXACT: u32 = 3u;
const ACTIVE_SOURCE_STATUS_REJECTED: u32 = 0xfcu;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;`,`v2 source-key and active-source constants`),e=w(e,`  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
`,``,`v2 GPU count query-profile admission`),e=w(e,`fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}`,`fn active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return params.logical_count_gpu_authored == 1u
    && params.physical_radix_count <= params.source_capacity
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_STATUS_EXACT) == ACTIVE_SOURCE_STATUS_EXACT
    && (status & ACTIVE_SOURCE_STATUS_REJECTED) == 0u
    && active_source_view[3u] == params.generation_id
    && active_source_view[4u] == params.device_ordinal
    && active_source_view[5u] == params.lane_ordinal
    && active_source_view[6u] == params.lease_token
    && active_source_view[7u] == params.source_family_id
    && active_source_view[8u] == params.storage_generation
    && active_source_view[9u] == params.physics_tick
    && active_source_view[10u] == params.physics_substep
    && active_source_view[11u] == params.position_epoch
    && active_source_view[12u] == params.topology_epoch
    && active_source_view[13u] == params.chart_epoch
    && active_source_view[14u] == params.level_epoch
    && active_source_view[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_count <= physical_capacity
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_count <= params.physical_radix_count
    && active_capacity == params.physical_radix_count
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == ACTIVE_NODE_STRIDE
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.build_ordinal
    && active_source_view[30u] == params.build_ordinal
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[43u] == active_count * 27u
    && active_source_view[47u] != 0u;
}

fn effective_source_count() -> u32 {
  return select(0u, active_source_view[18u], active_source_view_admitted());
}

fn physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = effective_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source] != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}`,`v2 active-source admission and projection`),e=w(e,`  let exact_base = source_index * EXACT_KEY_WORDS;`,`  let exact_base = source_index * SOURCE_KEY_WORDS;`,`v2 invalid source-key stride`),e=w(e,`  exact_keys[exact_base + 4u] = 0xffffffffu;
  let sort_base = source_index * params.sort_key_word_count;`,`  exact_keys[exact_base + 4u] = 0xffffffffu;
  exact_keys[exact_base + SOURCE_KEY_PHYSICAL_WORD] = ACTIVE_SOURCE_MISSING;
  let sort_base = source_index * params.sort_key_word_count;`,`v2 invalid physical identity word`),e=w(e,`  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let source_index = linear_group * 64u + local_id.x;
  if (source_index >= params.physical_radix_count) {
    return;
  }
  // A caller may copy a GPU-authored logical count into params.source_count
  // after the host packs the capacity plan. The retained radix primitive still
  // sorts the fixed capacity, so the inactive suffix must receive one maximal
  // sentinel key without being counted as an invalid source.
  if (!count_contract_ready() || source_index >= effective_source_count()) {
    write_invalid_keys(source_index);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;`,`  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let active_ordinal = linear_group * 64u + local_id.x;
  let active_count = effective_source_count();
  if (active_ordinal >= active_count) {
    return;
  }
  let source_index = physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING) {
    write_invalid_keys(active_ordinal);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;`,`v2 active-ordinal key invocation`),e=e.replaceAll(`write_invalid_keys(source_index);`,`write_invalid_keys(active_ordinal);`),e=w(e,`  let exact_base = source_index * EXACT_KEY_WORDS;`,`  let exact_base = active_ordinal * SOURCE_KEY_WORDS;`,`v2 admitted source-key stride`),e=w(e,`  exact_keys[exact_base + 4u] = cell_order.z;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {`,`  exact_keys[exact_base + 4u] = cell_order.z;
  exact_keys[exact_base + SOURCE_KEY_PHYSICAL_WORD] = source_index;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {`,`v2 admitted physical identity word`),e=w(e,`    sort_keys[source_index] = ordinal;`,`    sort_keys[active_ordinal] = ordinal;`,`v2 bounded sort index`),e=w(e,`    let sort_base = source_index * EXACT_KEY_WORDS;`,`    let sort_base = active_ordinal * EXACT_KEY_WORDS;`,`v2 lexicographic sort index`),e}function ee(){let e=`
struct SpatialEpochParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  sort_key_word_count: u32,
  sort_mode: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  lease_token: u32,
  build_ordinal: u32,
  sort_unique_ordinal: u32,
  chart_min: u32,
  chart_count: u32,
  level_min: i32,
  level_count: u32,
  cell_min_x: i32,
  cell_count_x: u32,
  cell_min_y: i32,
  cell_count_y: u32,
  cell_min_z: i32,
  cell_count_z: u32,
  header_words: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  directory_capacity_words: u32,
  required_capacity_words: u32,
  key_dispatch_x: u32,
  assemble_dispatch_x: u32,
  consumer_dispatch_x_limit: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  source_row_layout_id: u32,
  logical_count_gpu_authored: u32,
  physical_radix_count: u32,
};

@group(0) @binding(0) var<storage, read> exact_keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> sorted_group_indices: array<u32>;
@group(0) @binding(3) var<storage, read> unique_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(5) var<storage, read_write> epoch_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> directory: array<u32>;
@group(0) @binding(7) var<storage, read_write> consumer_dispatch: array<u32>;
@group(0) @binding(8) var<uniform> params: SpatialEpochParams;

const MAGIC: u32 = 0x53534531u;
const ABI_VERSION: u32 = 1u;
const EXACT_KEY_WORDS: u32 = 5u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SOURCE: u32 = 8u;
const STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const PRIMITIVE_STATUS_READY: u32 = 1u;
const PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const QUERY_EVIDENCE_WORDS: u32 = 6u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn exact_near_query_profile_ready() -> bool {
  if (params.query_geometry_mode == QUERY_GEOMETRY_GENERIC) {
    return true;
  }
  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
  if (params.query_geometry_mode != QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    return false;
  }
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0;
}

fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}

fn saturating_add_u32(left: u32, right: u32) -> u32 {
  if (right > 0xffffffffu - left) {
    return 0xffffffffu;
  }
  return left + right;
}

fn low_bits_mask(bit_count: u32) -> u32 {
  if (bit_count == 0u) { return 0u; }
  if (bit_count >= 32u) { return 0xffffffffu; }
  return (1u << bit_count) - 1u;
}

fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  if (!count_contract_ready() || params.source_count == 0u) {
    return 0u;
  }
  if (
    params.logical_count_gpu_authored == 0u
    || params.source_count == params.physical_radix_count
  ) {
    return primitive_unique_count;
  }
  // Stable radix ordering places the all-ones inactive suffix after every
  // admitted spatial key. The exclusive head prefix at the first suffix row
  // is therefore the exact number of live unique cells.
  return sorted_group_indices[params.source_count];
}

@compute @workgroup_size(64)
fn assemble_directory(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * params.assemble_dispatch_x;
  let sorted_position = linear_group * 64u + local_id.x;
  let live_source_count = effective_source_count();
  let unique_count = admitted_unique_count(unique_evidence[2]);
  if (sorted_position < unique_count && sorted_position < params.cell_capacity) {
    directory[params.cell_offsets_offset_words + sorted_position] =
      unique_offsets[sorted_position];
  } else if (
    sorted_position == unique_count
    && sorted_position <= params.cell_capacity
  ) {
    // The primitive's terminal offset includes the inactive sentinel suffix.
    // Seal the logical CSR boundary explicitly, including the legitimate
    // maximal-key case where the suffix shares the final live key group.
    directory[params.cell_offsets_offset_words + sorted_position] =
      live_source_count;
  }
  if (sorted_position >= live_source_count) {
    return;
  }
  let source_index = sorted_indices[sorted_position];
  var inclusive_head_count = unique_count;
  if (sorted_position + 1u < live_source_count) {
    inclusive_head_count = sorted_group_indices[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  let group_index = inclusive_head_count - 1u;
  if (
    source_index >= live_source_count
    || group_index >= unique_count
    || group_index >= params.cell_capacity
  ) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  directory[params.cell_members_offset_words + sorted_position] = source_index;
  directory[params.particle_to_cell_offset_words + source_index] = group_index;
  let is_head = sorted_position == unique_offsets[group_index];
  if (is_head) {
    let source_key = source_index * EXACT_KEY_WORDS;
    let target_key = params.cell_keys_offset_words + group_index * EXACT_KEY_WORDS;
    for (var word = 0u; word < EXACT_KEY_WORDS; word = word + 1u) {
      directory[target_key + word] = exact_keys[source_key + word];
    }
    if (params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
      let level_order = exact_keys[source_key + 1u];
      let query_min_order = signed_order_key(params.query_min_level);
      let query_max_order = signed_order_key(params.query_max_level);
      let query_level_count = query_max_order - query_min_order + 1u;
      let level_ordinal = level_order - query_min_order;
      if (
        level_order < query_min_order
        || level_order > query_max_order
        || level_ordinal >= query_level_count
        || level_ordinal >= 64u
      ) {
        atomicAdd(&epoch_evidence[3], 1u);
      } else if (level_ordinal < 32u) {
        atomicOr(&epoch_evidence[4], 1u << level_ordinal);
      } else {
        atomicOr(&epoch_evidence[5], 1u << (level_ordinal - 32u));
      }
    }
  }
}

@compute @workgroup_size(1)
fn finalize_directory() {
  let counts_ready = count_contract_ready();
  let live_source_count = effective_source_count();
  let primitive_generation = unique_evidence[0];
  let primitive_input_count = unique_evidence[1];
  let primitive_unique_count = unique_evidence[2];
  let logical_unique_count = admitted_unique_count(primitive_unique_count);
  let primitive_admitted = unique_evidence[3];
  let primitive_overflow = unique_evidence[4];
  let primitive_status = unique_evidence[7];
  let invalid_source_count = atomicLoad(&epoch_evidence[0])
    + atomicLoad(&epoch_evidence[1]);
  let assembly_overflow = atomicLoad(&epoch_evidence[3]);
  var cell_overflow = 0u;
  if (logical_unique_count > params.cell_capacity) {
    cell_overflow = logical_unique_count - params.cell_capacity;
  }
  let directory_capacity_ready = params.directory_capacity_words
    >= params.required_capacity_words;
  let primitive_overflow_count = select(0u, 1u, primitive_overflow != 0u);
  let directory_overflow_count = select(0u, 1u, !directory_capacity_ready);
  let overflow_count = saturating_add_u32(
    saturating_add_u32(
      saturating_add_u32(primitive_overflow_count, assembly_overflow),
      cell_overflow
    ),
    directory_overflow_count
  );
  let emitted_count = atomicLoad(&epoch_evidence[2]);
  let sort_mode_ready = (
    params.sort_mode == 1u
    && params.sort_key_word_count == 1u
  ) || (
    params.sort_mode == 2u
    && params.sort_key_word_count == EXACT_KEY_WORDS
  );
  let primitive_ready = primitive_admitted != 0u
    && (primitive_status & PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && primitive_overflow == 0u
    && primitive_generation == params.generation_id
    && counts_ready
    && primitive_input_count == params.physical_radix_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= params.physical_radix_count
    && sort_mode_ready
    && unique_evidence[5] == params.sort_key_word_count
    && unique_evidence[6] == params.sort_key_word_count;
  let overflow_free = primitive_overflow == 0u
    && assembly_overflow == 0u
    && logical_unique_count <= params.cell_capacity
    && directory_capacity_ready;
  let has_query_evidence =
    params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2;
  let query_level_count = select(
    0u,
    signed_order_key(params.query_max_level)
      - signed_order_key(params.query_min_level) + 1u,
    has_query_evidence
  );
  let occupied_level_mask_low = atomicLoad(&epoch_evidence[4]);
  let occupied_level_mask_high = atomicLoad(&epoch_evidence[5]);
  let allowed_level_mask_low = low_bits_mask(min(query_level_count, 32u));
  let allowed_level_mask_high = low_bits_mask(
    select(0u, query_level_count - 32u, query_level_count > 32u)
  );
  let occupied_level_mask_ready = !has_query_evidence || (
    (live_source_count == 0u
      || (occupied_level_mask_low | occupied_level_mask_high) != 0u)
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
  );
  let admitted = primitive_ready
    && invalid_source_count == 0u
    && overflow_free
    && emitted_count == live_source_count
    && exact_near_query_profile_ready()
    && occupied_level_mask_ready;
  let live_required_words = params.header_words
    + logical_unique_count * EXACT_KEY_WORDS
    + logical_unique_count + 1u
    + live_source_count * 2u
    + select(0u, QUERY_EVIDENCE_WORDS, has_query_evidence);
  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.physical_radix_count;
  let live_physical_high_water_words = max(
    max(
      select(
        params.header_words,
        params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,
        logical_unique_count > 0u
      ),
      params.cell_offsets_offset_words + logical_unique_count + 1u
    ),
    max(
      select(
        params.header_words,
        params.cell_members_offset_words + live_source_count,
        live_source_count > 0u
      ),
      max(
        select(
          params.header_words,
          params.particle_to_cell_offset_words + live_source_count,
          live_source_count > 0u
        ),
        select(
          params.header_words,
          query_evidence_offset_words + QUERY_EVIDENCE_WORDS,
          has_query_evidence
        )
      )
    )
  );

  var status = STATUS_READY;
  if (admitted) {
    status = status | STATUS_ADMITTED;
  } else {
    status = status | STATUS_FAIL_CLOSED;
  }
  if (invalid_source_count != 0u) {
    status = status | STATUS_INVALID_SOURCE;
  }
  if (!overflow_free) {
    status = status | STATUS_CAPACITY_OVERFLOW;
  }

  let admitted_cell_count = select(0u, logical_unique_count, admitted);
  if (logical_unique_count <= params.cell_capacity) {
    directory[params.cell_offsets_offset_words + logical_unique_count] =
      live_source_count;
  }
  let dispatch_group_count = (admitted_cell_count + 63u) / 64u;
  let dispatch_x_limit = max(params.consumer_dispatch_x_limit, 1u);
  let has_consumer_work = admitted && admitted_cell_count > 0u;
  let dispatch_x = select(
    0u,
    min(dispatch_group_count, dispatch_x_limit),
    has_consumer_work
  );
  let dispatch_y = select(
    0u,
    (dispatch_group_count + dispatch_x_limit - 1u) / dispatch_x_limit,
    has_consumer_work
  );
  consumer_dispatch[0] = dispatch_x;
  consumer_dispatch[1] = dispatch_y;
  consumer_dispatch[2] = select(0u, 1u, has_consumer_work);

  if (has_query_evidence) {
    directory[query_evidence_offset_words + 0u] = params.query_chart_id;
    directory[query_evidence_offset_words + 1u] = bitcast<u32>(params.query_min_level);
    directory[query_evidence_offset_words + 2u] = bitcast<u32>(params.query_max_level);
    directory[query_evidence_offset_words + 3u] =
      bitcast<u32>(params.query_base_grid_spacing_m);
    directory[query_evidence_offset_words + 4u] = occupied_level_mask_low;
    directory[query_evidence_offset_words + 5u] = occupied_level_mask_high;
  }
  // Words 4-5 are temporally borrowed while the directory is assembled, then
  // returned to the mechanics evidence ABI before any consumer dispatch.
  atomicStore(&epoch_evidence[4], 0u);
  atomicStore(&epoch_evidence[5], 0u);

  directory[0] = MAGIC;
  directory[1] = ABI_VERSION;
  directory[2] = status;
  directory[3] = params.generation_id;
  directory[4] = params.device_ordinal;
  directory[5] = params.lane_ordinal;
  directory[6] = params.lease_token;
  directory[7] = params.source_family_id;
  directory[8] = params.storage_generation;
  directory[9] = params.physics_tick;
  directory[10] = params.physics_substep;
  directory[11] = params.position_epoch;
  directory[12] = params.topology_epoch;
  directory[13] = params.chart_epoch;
  directory[14] = params.level_epoch;
  directory[15] = params.support_epoch;
  directory[16] = live_source_count;
  directory[17] = params.source_capacity;
  directory[18] = admitted_cell_count;
  directory[19] = params.cell_capacity;
  directory[20] = live_required_words;
  directory[21] = select(0u, live_required_words, admitted);
  directory[22] = params.directory_capacity_words;
  directory[23] = invalid_source_count;
  directory[24] = overflow_count;
  directory[25] = EXACT_KEY_WORDS;
  directory[26] = params.sort_key_word_count;
  directory[27] = params.sort_mode;
  directory[28] = params.header_words;
  directory[29] = params.cell_keys_offset_words;
  directory[30] = params.cell_offsets_offset_words;
  directory[31] = params.cell_members_offset_words;
  directory[32] = params.particle_to_cell_offset_words;
  directory[33] = params.build_ordinal;
  directory[34] = params.sort_unique_ordinal;
  directory[35] = select(0u, params.build_ordinal, admitted);
  directory[36] = primitive_generation;
  // Preserve the established v1 consumer invariants. Raw physical primitive
  // evidence remains in unique_evidence; the authoritative directory exposes
  // the admitted logical source and cell counts.
  directory[37] = live_source_count;
  directory[38] = admitted_cell_count;
  directory[39] = primitive_admitted;
  directory[40] = primitive_overflow;
  directory[41] = primitive_status;
  directory[42] = consumer_dispatch[0];
  directory[43] = consumer_dispatch[1];
  directory[44] = consumer_dispatch[2];
  // Spatial evidence/header/dispatch clears 55 words. The retained radix/
  // unique primitive additionally clears 8 evidence, 3 dispatch, and the
  // first unique-offset word, for 67 total cleared words per encoded epoch.
  directory[45] = params.header_words + 4u + 3u + 8u + 3u + 1u;
  directory[46] = select(
    SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
    SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    has_query_evidence
  );
  directory[47] = select(
    params.directory_capacity_words,
    live_physical_high_water_words,
    admitted
  );
}
`;return e=w(e,`const ABI_VERSION: u32 = 1u;`,`const ABI_VERSION: u32 = 2u;
const SOURCE_KEY_WORDS: u32 = 6u;
const SOURCE_KEY_PHYSICAL_WORD: u32 = 5u;`,`v2 directory version and source-key constants`),e=w(e,`  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
`,``,`v2 GPU count query-profile admission`),e=w(e,`fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}`,`fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored == 1u
    && params.source_row_layout_id == 1u
    && params.source_count <= params.source_capacity
    && params.physical_radix_count <= params.source_capacity;
}

fn effective_source_count() -> u32 {
  let active_count = unique_evidence[1u];
  return select(
    0u,
    active_count,
    count_contract_ready()
      && active_count <= params.physical_radix_count
      && active_count <= params.source_count
  );
}`,`v2 active unique-input count contract`),e=w(e,`fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  if (!count_contract_ready() || params.source_count == 0u) {
    return 0u;
  }
  if (
    params.logical_count_gpu_authored == 0u
    || params.source_count == params.physical_radix_count
  ) {
    return primitive_unique_count;
  }
  // Stable radix ordering places the all-ones inactive suffix after every
  // admitted spatial key. The exclusive head prefix at the first suffix row
  // is therefore the exact number of live unique cells.
  return sorted_group_indices[params.source_count];
}`,`fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  let active_count = effective_source_count();
  return select(
    0u,
    primitive_unique_count,
    primitive_unique_count <= active_count
      && arrayLength(&sorted_group_indices) >= params.physical_radix_count
  );
}`,`v2 unique count admission`),e=w(e,`  let source_index = sorted_indices[sorted_position];
  var inclusive_head_count = unique_count;`,`  let active_ordinal = sorted_indices[sorted_position];
  if (active_ordinal >= live_source_count) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  let source_key = active_ordinal * SOURCE_KEY_WORDS;
  let source_index = exact_keys[source_key + SOURCE_KEY_PHYSICAL_WORD];
  var inclusive_head_count = unique_count;`,`v2 physical member projection`),e=w(e,`    source_index >= live_source_count
    || group_index >= unique_count`,`    source_index >= params.source_count
    || group_index >= unique_count`,`v2 physical member bound`),e=w(e,`  directory[params.particle_to_cell_offset_words + source_index] = group_index;`,`  // Zero is the exact dormant/missing sentinel after the runtime clears
  // the retained physical reverse arena.
  directory[params.particle_to_cell_offset_words + source_index] =
    group_index + 1u;`,`v2 plus-one physical reverse`),e=w(e,`    let source_key = source_index * EXACT_KEY_WORDS;
`,``,`v2 source-key scratch index`),e=w(e,`      params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,
        logical_unique_count > 0u`,`      params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,
        logical_unique_count > 0u`,`v2 cell key high-water anchor`),e=w(e,`          params.header_words,
          params.particle_to_cell_offset_words + live_source_count,
          live_source_count > 0u`,`          params.header_words,
          params.particle_to_cell_offset_words + params.source_count,
          params.source_count > 0u`,`v2 physical reverse high-water`),e=w(e,`    && primitive_input_count == params.physical_radix_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= params.physical_radix_count`,`    && primitive_input_count == live_source_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= live_source_count`,`v2 primitive live-count evidence`),e=w(e,`    + logical_unique_count + 1u
    + live_source_count * 2u`,`    + logical_unique_count + 1u
    + live_source_count
    + params.source_count`,`v2 logical payload count`),e=w(e,`  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.physical_radix_count;`,`  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.source_capacity;`,`v2 capacity-stable query evidence`),e=w(e,`  directory[16] = live_source_count;`,`  directory[16] = params.source_count;`,`v2 physical source header`),e=w(e,`  // Preserve the established v1 consumer invariants. Raw physical primitive
  // evidence remains in unique_evidence; the authoritative directory exposes
  // the admitted logical source and cell counts.
  directory[37] = live_source_count;`,`  // V2 word 37 is the exact GPU-authored active CSR member count. Word 16
  // remains the stable physical particle identity bound.
  directory[37] = live_source_count;`,`v2 active count telemetry`),e}T(),ee();const te=1397904945,ne=8192,re=Object.freeze([`magic:u32`,`abiVersion:u32`,`statusFlags:u32`,`generationId:u32`,`deviceOrdinal:u32`,`laneOrdinal:u32`,`leaseToken:u32`,`sourceFamilyId:u32`,`storageGeneration:u32`,`physicsTick:u32`,`physicsSubstep:u32`,`positionEpoch:u32`,`topologyEpoch:u32`,`chartEpoch:u32`,`levelEpoch:u32`,`supportEpoch:u32`,`sourceCount:u32`,`sourceCapacity:u32`,`cellCount:u32`,`cellCapacity:u32`,`headerWords:u32`,`rankPrefixOffsetWords:u32`,`rankPrefixCapacity:u32`,`activeRanksOffsetWords:u32`,`activeRankCapacity:u32`,`physicalCapacityWords:u32`,`activeRankCount:u32`,`dormantRankCount:u32`,`invalidSourceCount:u32`,`sourceRowLayoutId:u32`,`sourceAdapterId:u32`,`directoryCellMembersOffsetWords:u32`,`directoryCompletionOrdinal:u32`,`completionOrdinal:u32`,`buildOrdinal:u32`,`consumerWorkgroupSize:u32`,`dispatchOffsetWords:u32`,`dispatchWords:u32`,`directoryCapacityWords:u32`,`directoryPhysicalHighWaterWords:u32`,`replayGuardToken:u32`,`headerFingerprint:u32`,`maxSupportedSourceCount:u32`,`ranksPerLane:u32`,`dispatchX:u32`,`dispatchY:u32`,`dispatchZ:u32`,`clearedWords:u32`,`physicalHighWaterWords:u32`,`activeSourceIndicesOffsetWords:u32`,`activeSourceIndexCapacity:u32`,...Array.from({length:13},(e,t)=>`reserved${t}:u32`)]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-active-rank-view.v1`,version:1,magic:te,headerWords:64,headerLayout:re,producerWorkgroupSize:256,consumerWorkgroupSize:64,maxSourceCount:ne,construction:`one-workgroup-stable-canonical-rank-scan-owned-by-the-base-spatial-epoch-arena`,rankPrefix:`exclusive-active-count-before-canonical-directory-rank-with-terminal-total`,activeRanks:`strictly-increasing-canonical-directory-ranks-for-currently-active-source-rows`,activeSourceIndices:`source-index partner captured once with each active canonical rank by the epoch producer`,cellTraversal:`activeRanks[rankPrefix[cellBegin]..rankPrefix[cellEnd])`,overflowPolicy:`unavailable-above-bounded-source-capacity; consumers-retain-classic-path`,corruptionPolicy:`gpu-authenticated-fail-closed-before-indirect-consumer-dispatch`,residency:`same-arena-same-lease-same-retirement-as-owning-spatial-epoch`});const ie=65537,ae=65538,oe=65539,se=65540,ce=65541,le=65542,ue=65543;function de({id:e,name:t,consumerFamily:n,artifactFamily:r,phase:i,exactFilter:a}){return Object.freeze({schema:`peercompute.ulg.schroeder-spatial-support-profile.v1`,version:1,id:e,name:t,consumerFamily:n,artifactFamily:r,phase:i,directorySchema:_,directorySchemas:Object.freeze([_,v]),traversal:`exact-signed-cell-key-sparse-prefix-csr-v1`,sourcePositionAuthority:`same-epoch-pre-integration-particle-state`,radiusAuthority:`consumer-uniform-f32`,broadPhaseEnvelope:`complete-axis-aligned-cell-envelope`,exactFilter:a,candidateBudget:null,candidateMaterialization:`consumer-choice-byte-bounded-only`,overflowPolicy:`fail-closed`,fallbackPolicy:`none-after-canonical-generation-selection`})}const fe=Object.freeze([de({id:ie,name:`pressure-contact-v1`,consumerFamily:`pressure-interface-contact`,artifactFamily:`spatial-exact-near-pressure-contact-interface`,phase:`pressure-contact-proposal`,exactFilter:`law-declared-contact-volume`}),de({id:ae,name:`reaction-discovery-v1`,consumerFamily:`reaction-candidate-discovery`,artifactFamily:`spatial-exact-near-reaction-discovery`,phase:`reaction-discovery-proposal`,exactFilter:`euclidean-pair-radius-and-reaction-policy`}),de({id:oe,name:`separation-v1`,consumerFamily:`particle-separation`,artifactFamily:`spatial-exact-near-separation`,phase:`separation-proposal`,exactFilter:`euclidean-symmetric-pair-radius`}),de({id:se,name:`thermal-conduction-v1`,consumerFamily:`thermal-conduction`,artifactFamily:`spatial-exact-near-thermal-conduction`,phase:`thermal-conduction-proposal`,exactFilter:`euclidean-symmetric-pair-radius-and-thermal-policy`}),de({id:ce,name:`radiation-wide-v1`,consumerFamily:`wider-support-radiation`,artifactFamily:`spatial-exact-near-thermal-radiation`,phase:`thermal-radiation-proposal`,exactFilter:`law-declared-wide-radius-and-visibility-policy`}),de({id:le,name:`material-interface-local-v1`,consumerFamily:`material-interface-local-law`,artifactFamily:`spatial-exact-near-local-material-interface`,phase:`local-material-interface-proposal`,exactFilter:`law-declared-local-radius-and-interface-policy`}),de({id:ue,name:`reaction-product-placement-v1`,consumerFamily:`reaction-product-placement`,artifactFamily:`spatial-exact-near-reaction-product-placement`,phase:`reaction-product-placement-proposal`,exactFilter:`current-live-product-material-and-resolved-phase-euclidean-capture-distance-slot-tie-break`})]);Object.freeze(Object.fromEntries(fe.map(e=>[e.id,e]))),Object.freeze(fe.map(e=>e.id)),Object.freeze(`sourceCount:u32.derivationEnabled:u32.supportProfileId:u32.chartId:u32.levelCount:u32.expectedGenerationId:u32.expectedDeviceOrdinal:u32.expectedLaneOrdinal:u32.expectedLeaseToken:u32.expectedSourceFamilyId:u32.expectedStorageGeneration:u32.expectedPhysicsTick:u32.expectedPhysicsSubstep:u32.expectedPositionEpoch:u32.expectedTopologyEpoch:u32.expectedChartEpoch:u32.expectedLevelEpoch:u32.expectedSupportEpoch:u32.minLevel:i32.baseGridSpacingM:f32.expectedCellKeysOffsetWords:u32.expectedCellOffsetsOffsetWords:u32.expectedCellMembersOffsetWords:u32.expectedParticleToCellOffsetWords:u32.expectedDirectoryCapacityWords:u32.expectedSourceCapacity:u32.expectedCellCapacity:u32`.split(`.`)).length,28*Uint32Array.BYTES_PER_ELEMENT,Object.freeze(`physicalSourceCount:u32.derivationEnabled:u32.supportProfileId:u32.chartId:u32.levelCount:u32.expectedGenerationId:u32.expectedDeviceOrdinal:u32.expectedLaneOrdinal:u32.expectedLeaseToken:u32.expectedSourceFamilyId:u32.expectedStorageGeneration:u32.expectedPhysicsTick:u32.expectedPhysicsSubstep:u32.expectedPositionEpoch:u32.expectedTopologyEpoch:u32.expectedChartEpoch:u32.expectedLevelEpoch:u32.expectedSupportEpoch:u32.minLevel:i32.baseGridSpacingM:f32.expectedCellKeysOffsetWords:u32.expectedCellOffsetsOffsetWords:u32.expectedCellMembersOffsetWords:u32.expectedPhysicalToCellPlusOneOffsetWords:u32.expectedDirectoryCapacityWords:u32.expectedPhysicalSourceCapacity:u32.expectedCellCapacity:u32`.split(`.`)).length,28*Uint32Array.BYTES_PER_ELEMENT,Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-traversal-wgsl.v1`,version:1,directoryBindingDeclaration:`var<storage, read> spatial_directory: array<u32>`,generationAdmission:`complete-v1-header-query-evidence-and-live-csr-validation-before-lookup`,keyOrder:`chart-level-signed-x-y-z-u32x5-lexicographic`,lookup:`binary-search-occupied-key-range-and-validated-csr-source-lookup`,malformedRangePolicy:`fail-closed-admitted-zero`,candidateBudget:null}),Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-traversal-wgsl.v2`,version:2,directoryBindingDeclaration:`var<storage, read> spatial_directory: array<u32>`,generationAdmission:`complete-v2-header-query-evidence-active-csr-and-physical-reverse-validation-before-lookup`,keyOrder:`chart-level-signed-x-y-z-u32x5-lexicographic`,lookup:`binary-search-occupied-key-range-and-active-csr-physical-source-lookup`,memberSpanBound:`directory.header.activeSourceCount`,memberIdentityBound:`expectation.physicalSourceCount`,reverseLookup:`physical-source-to-cell-index-plus-one-zero-means-dormant-or-missing`,malformedRangePolicy:`fail-closed-admitted-zero`,candidateBudget:null});const pe=/^[A-Za-z_][A-Za-z0-9_]*$/;function me(e){return`
// Requires the consumer shader to declare:
//   var<storage, read> ${e}: array<u32>;
// The module owns no law buffers, candidate policy, or dispatch entry point.
struct SchroederSpatialExactNearExpectationV1 {
  source_count: u32,
  derivation_enabled: u32,
  support_profile_id: u32,
  chart_id: u32,
  level_count: u32,
  expected_generation_id: u32,
  expected_device_ordinal: u32,
  expected_lane_ordinal: u32,
  expected_lease_token: u32,
  expected_source_family_id: u32,
  expected_storage_generation: u32,
  expected_physics_tick: u32,
  expected_physics_substep: u32,
  expected_position_epoch: u32,
  expected_topology_epoch: u32,
  expected_chart_epoch: u32,
  expected_level_epoch: u32,
  expected_support_epoch: u32,
  min_level: i32,
  base_grid_spacing_m: f32,
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
};

struct SchroederSpatialExactNearRangeV1 {
  admitted: u32,
  begin: u32,
  end: u32,
};

struct SchroederSpatialExactNearSourceLookupV1 {
  admitted: u32,
  source_index: u32,
};

const SS_EXACT_NEAR_MAGIC_V1: u32 = 0x53534531u;
const SS_EXACT_NEAR_ABI_VERSION_V1: u32 = 1u;
const SS_EXACT_NEAR_STATUS_READY: u32 = 1u;
const SS_EXACT_NEAR_STATUS_ADMITTED: u32 = 2u;
const SS_EXACT_NEAR_STATUS_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_NEAR_STATUS_INVALID_SOURCE: u32 = 8u;
const SS_EXACT_NEAR_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SS_EXACT_NEAR_PRIMITIVE_STATUS_READY: u32 = 1u;
const SS_EXACT_NEAR_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_NEAR_KEY_WORDS: u32 = 5u;
const SS_EXACT_NEAR_HEADER_WORDS: u32 = 48u;
const SS_EXACT_NEAR_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SS_EXACT_NEAR_SOURCE_ADAPTER_QUERY_V1: u32 = 2u;
const SS_EXACT_NEAR_QUERY_EVIDENCE_WORDS: u32 = 6u;
const SS_EXACT_NEAR_SUPPORT_PRESSURE_CONTACT_V1: u32 = ${ie}u;
const SS_EXACT_NEAR_SUPPORT_REACTION_DISCOVERY_V1: u32 = ${ae}u;
const SS_EXACT_NEAR_SUPPORT_REACTION_PRODUCT_PLACEMENT_V1: u32 = ${ue}u;
const SS_EXACT_NEAR_SUPPORT_SEPARATION_V1: u32 = ${oe}u;
const SS_EXACT_NEAR_SUPPORT_THERMAL_CONDUCTION_V1: u32 = ${se}u;
const SS_EXACT_NEAR_SUPPORT_RADIATION_WIDE_V1: u32 = ${ce}u;
const SS_EXACT_NEAR_SUPPORT_MATERIAL_INTERFACE_LOCAL_V1: u32 = ${le}u;
const SS_EXACT_NEAR_HEADER_MAGIC: u32 = 0u;
const SS_EXACT_NEAR_HEADER_VERSION: u32 = 1u;
const SS_EXACT_NEAR_HEADER_STATUS: u32 = 2u;
const SS_EXACT_NEAR_HEADER_GENERATION: u32 = 3u;
const SS_EXACT_NEAR_HEADER_DEVICE_ORDINAL: u32 = 4u;
const SS_EXACT_NEAR_HEADER_LANE_ORDINAL: u32 = 5u;
const SS_EXACT_NEAR_HEADER_LEASE_TOKEN: u32 = 6u;
const SS_EXACT_NEAR_HEADER_SOURCE_FAMILY: u32 = 7u;
const SS_EXACT_NEAR_HEADER_STORAGE_GENERATION: u32 = 8u;
const SS_EXACT_NEAR_HEADER_PHYSICS_TICK: u32 = 9u;
const SS_EXACT_NEAR_HEADER_PHYSICS_SUBSTEP: u32 = 10u;
const SS_EXACT_NEAR_HEADER_POSITION_EPOCH: u32 = 11u;
const SS_EXACT_NEAR_HEADER_TOPOLOGY_EPOCH: u32 = 12u;
const SS_EXACT_NEAR_HEADER_CHART_EPOCH: u32 = 13u;
const SS_EXACT_NEAR_HEADER_LEVEL_EPOCH: u32 = 14u;
const SS_EXACT_NEAR_HEADER_SUPPORT_EPOCH: u32 = 15u;
const SS_EXACT_NEAR_HEADER_SOURCE_COUNT: u32 = 16u;
const SS_EXACT_NEAR_HEADER_SOURCE_CAPACITY: u32 = 17u;
const SS_EXACT_NEAR_HEADER_CELL_COUNT: u32 = 18u;
const SS_EXACT_NEAR_HEADER_CELL_CAPACITY: u32 = 19u;
const SS_EXACT_NEAR_HEADER_LOGICAL_REQUIRED_WORDS: u32 = 20u;
const SS_EXACT_NEAR_HEADER_LOGICAL_ADMITTED_WORDS: u32 = 21u;
const SS_EXACT_NEAR_HEADER_DIRECTORY_CAPACITY: u32 = 22u;
const SS_EXACT_NEAR_HEADER_INVALID_SOURCE_COUNT: u32 = 23u;
const SS_EXACT_NEAR_HEADER_OVERFLOW_COUNT: u32 = 24u;
const SS_EXACT_NEAR_HEADER_EXACT_KEY_WORDS: u32 = 25u;
const SS_EXACT_NEAR_HEADER_SORT_KEY_WORDS: u32 = 26u;
const SS_EXACT_NEAR_HEADER_SORT_MODE: u32 = 27u;
const SS_EXACT_NEAR_HEADER_WORD_COUNT: u32 = 28u;
const SS_EXACT_NEAR_HEADER_CELL_KEYS_OFFSET: u32 = 29u;
const SS_EXACT_NEAR_HEADER_CELL_OFFSETS_OFFSET: u32 = 30u;
const SS_EXACT_NEAR_HEADER_CELL_MEMBERS_OFFSET: u32 = 31u;
const SS_EXACT_NEAR_HEADER_PARTICLE_TO_CELL_OFFSET: u32 = 32u;
const SS_EXACT_NEAR_HEADER_BUILD_ORDINAL: u32 = 33u;
const SS_EXACT_NEAR_HEADER_SORT_UNIQUE_ORDINAL: u32 = 34u;
const SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL: u32 = 35u;
const SS_EXACT_NEAR_HEADER_UNIQUE_GENERATION: u32 = 36u;
const SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT: u32 = 37u;
const SS_EXACT_NEAR_HEADER_UNIQUE_COUNT: u32 = 38u;
const SS_EXACT_NEAR_HEADER_UNIQUE_ADMITTED: u32 = 39u;
const SS_EXACT_NEAR_HEADER_UNIQUE_OVERFLOW: u32 = 40u;
const SS_EXACT_NEAR_HEADER_UNIQUE_STATUS: u32 = 41u;
const SS_EXACT_NEAR_HEADER_CLEARED_WORDS: u32 = 45u;
const SS_EXACT_NEAR_HEADER_SOURCE_ADAPTER: u32 = 46u;
const SS_EXACT_NEAR_HEADER_PHYSICAL_UPPER_WORDS: u32 = 47u;

fn ss_exact_near_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn ss_exact_near_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn ss_exact_near_low_bits_mask(bit_count: u32) -> u32 {
  if (bit_count == 0u) { return 0u; }
  if (bit_count >= 32u) { return 0xffffffffu; }
  return (1u << bit_count) - 1u;
}

fn ss_exact_near_support_profile_admitted(support_profile_id: u32) -> bool {
  return support_profile_id == SS_EXACT_NEAR_SUPPORT_PRESSURE_CONTACT_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_REACTION_DISCOVERY_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_REACTION_PRODUCT_PLACEMENT_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_SEPARATION_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_THERMAL_CONDUCTION_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_RADIATION_WIDE_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_MATERIAL_INTERFACE_LOCAL_V1;
}

fn ss_exact_near_directory_admitted(
  expected: SchroederSpatialExactNearExpectationV1
) -> bool {
  let bound_words = arrayLength(&${e});
  if (bound_words < SS_EXACT_NEAR_HEADER_WORDS) {
    return false;
  }
  let status = ${e}[SS_EXACT_NEAR_HEADER_STATUS];
  let required_status = SS_EXACT_NEAR_STATUS_READY | SS_EXACT_NEAR_STATUS_ADMITTED;
  let rejected_status = SS_EXACT_NEAR_STATUS_FAIL_CLOSED
    | SS_EXACT_NEAR_STATUS_INVALID_SOURCE
    | SS_EXACT_NEAR_STATUS_CAPACITY_OVERFLOW;
  let source_count = ${e}[SS_EXACT_NEAR_HEADER_SOURCE_COUNT];
  let source_capacity = ${e}[SS_EXACT_NEAR_HEADER_SOURCE_CAPACITY];
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let cell_capacity = ${e}[SS_EXACT_NEAR_HEADER_CELL_CAPACITY];
  let directory_capacity = ${e}[
    SS_EXACT_NEAR_HEADER_DIRECTORY_CAPACITY
  ];
  let logical_required = ${e}[
    SS_EXACT_NEAR_HEADER_LOGICAL_REQUIRED_WORDS
  ];
  let logical_admitted = ${e}[
    SS_EXACT_NEAR_HEADER_LOGICAL_ADMITTED_WORDS
  ];
  let physical_upper = ${e}[
    SS_EXACT_NEAR_HEADER_PHYSICAL_UPPER_WORDS
  ];
  let unique_status = ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_STATUS];
  let build_ordinal = ${e}[SS_EXACT_NEAR_HEADER_BUILD_ORDINAL];
  if (
    expected.derivation_enabled == 0u
    || !ss_exact_near_support_profile_admitted(expected.support_profile_id)
    || source_count == 0u
    || source_count > source_capacity
    || directory_capacity > bound_words
    || physical_upper > directory_capacity
    || expected.level_count == 0u
    || expected.level_count > 64u
    || expected.chart_id > 0x00ffffffu
    || !ss_exact_near_finite(expected.base_grid_spacing_m)
    || expected.base_grid_spacing_m <= 0.0
  ) {
    return false;
  }
  let min_level_order = bitcast<u32>(expected.min_level) ^ 0x80000000u;
  let max_level_delta = expected.level_count - 1u;
  if (max_level_delta > 0xffffffffu - min_level_order) {
    return false;
  }
  let expected_max_level_order = min_level_order + max_level_delta;
  let expected_max_level = bitcast<i32>(expected_max_level_order ^ 0x80000000u);
  let min_spacing = expected.base_grid_spacing_m * exp2(f32(expected.min_level));
  let max_spacing = expected.base_grid_spacing_m * exp2(f32(expected_max_level));
  if (
    !ss_exact_near_finite(min_spacing)
    || min_spacing < 0.000001
    || !ss_exact_near_finite(max_spacing)
    || max_spacing <= 0.0
  ) {
    return false;
  }
  if (
    source_count > 0xffffffffu - expected.expected_particle_to_cell_offset_words
  ) {
    return false;
  }
  let query_evidence_offset = expected.expected_particle_to_cell_offset_words
    + source_count;
  if (!ss_exact_near_range_within(
    query_evidence_offset,
    SS_EXACT_NEAR_QUERY_EVIDENCE_WORDS,
    physical_upper
  )) {
    return false;
  }
  let evidence_chart_id = ${e}[query_evidence_offset];
  let evidence_min_level_bits = ${e}[query_evidence_offset + 1u];
  let evidence_max_level_bits = ${e}[query_evidence_offset + 2u];
  let evidence_base_spacing_bits = ${e}[
    query_evidence_offset + 3u
  ];
  let occupied_level_mask_low = ${e}[
    query_evidence_offset + 4u
  ];
  let occupied_level_mask_high = ${e}[
    query_evidence_offset + 5u
  ];
  let allowed_level_mask_low = ss_exact_near_low_bits_mask(
    min(expected.level_count, 32u)
  );
  let allowed_level_mask_high = ss_exact_near_low_bits_mask(
    select(0u, expected.level_count - 32u, expected.level_count > 32u)
  );
  return ${e}[SS_EXACT_NEAR_HEADER_MAGIC]
      == SS_EXACT_NEAR_MAGIC_V1
    && ${e}[SS_EXACT_NEAR_HEADER_VERSION]
      == SS_EXACT_NEAR_ABI_VERSION_V1
    && (status & required_status) == required_status
    && (status & rejected_status) == 0u
    && ${e}[SS_EXACT_NEAR_HEADER_GENERATION]
      == expected.expected_generation_id
    && ${e}[SS_EXACT_NEAR_HEADER_DEVICE_ORDINAL]
      == expected.expected_device_ordinal
    && ${e}[SS_EXACT_NEAR_HEADER_LANE_ORDINAL]
      == expected.expected_lane_ordinal
    && ${e}[SS_EXACT_NEAR_HEADER_LEASE_TOKEN]
      == expected.expected_lease_token
    && ${e}[SS_EXACT_NEAR_HEADER_SOURCE_FAMILY]
      == expected.expected_source_family_id
    && ${e}[SS_EXACT_NEAR_HEADER_STORAGE_GENERATION]
      == expected.expected_storage_generation
    && ${e}[SS_EXACT_NEAR_HEADER_PHYSICS_TICK]
      == expected.expected_physics_tick
    && ${e}[SS_EXACT_NEAR_HEADER_PHYSICS_SUBSTEP]
      == expected.expected_physics_substep
    && ${e}[SS_EXACT_NEAR_HEADER_POSITION_EPOCH]
      == expected.expected_position_epoch
    && ${e}[SS_EXACT_NEAR_HEADER_TOPOLOGY_EPOCH]
      == expected.expected_topology_epoch
    && ${e}[SS_EXACT_NEAR_HEADER_CHART_EPOCH]
      == expected.expected_chart_epoch
    && ${e}[SS_EXACT_NEAR_HEADER_LEVEL_EPOCH]
      == expected.expected_level_epoch
    && ${e}[SS_EXACT_NEAR_HEADER_SUPPORT_EPOCH]
      == expected.expected_support_epoch
    && source_count == expected.source_count
    && source_capacity == expected.expected_source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && cell_capacity == expected.expected_cell_capacity
    && directory_capacity == expected.expected_directory_capacity_words
    && logical_required == logical_admitted
    && logical_admitted >= SS_EXACT_NEAR_HEADER_WORDS
    && logical_admitted <= physical_upper
    && ${e}[SS_EXACT_NEAR_HEADER_INVALID_SOURCE_COUNT] == 0u
    && ${e}[SS_EXACT_NEAR_HEADER_OVERFLOW_COUNT] == 0u
    && ${e}[SS_EXACT_NEAR_HEADER_EXACT_KEY_WORDS]
      == SS_EXACT_NEAR_KEY_WORDS
    && ${e}[SS_EXACT_NEAR_HEADER_SORT_KEY_WORDS]
      == SS_EXACT_NEAR_KEY_WORDS
    && ${e}[SS_EXACT_NEAR_HEADER_SORT_MODE]
      == SS_EXACT_NEAR_SORT_LEXICOGRAPHIC_U32X5
    && ${e}[SS_EXACT_NEAR_HEADER_WORD_COUNT]
      == SS_EXACT_NEAR_HEADER_WORDS
    && ${e}[SS_EXACT_NEAR_HEADER_CELL_KEYS_OFFSET]
      == expected.expected_cell_keys_offset_words
    && ${e}[SS_EXACT_NEAR_HEADER_CELL_OFFSETS_OFFSET]
      == expected.expected_cell_offsets_offset_words
    && ${e}[SS_EXACT_NEAR_HEADER_CELL_MEMBERS_OFFSET]
      == expected.expected_cell_members_offset_words
    && ${e}[SS_EXACT_NEAR_HEADER_PARTICLE_TO_CELL_OFFSET]
      == expected.expected_particle_to_cell_offset_words
    && build_ordinal != 0u
    && ${e}[SS_EXACT_NEAR_HEADER_SORT_UNIQUE_ORDINAL]
      == build_ordinal
    && ${e}[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]
      == build_ordinal
    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_GENERATION]
      == expected.expected_generation_id
    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
      == source_count
    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_COUNT] == cell_count
    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_ADMITTED] != 0u
    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_OVERFLOW] == 0u
    && (unique_status & SS_EXACT_NEAR_PRIMITIVE_STATUS_READY) != 0u
    && (unique_status & SS_EXACT_NEAR_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && ${e}[SS_EXACT_NEAR_HEADER_CLEARED_WORDS]
      >= SS_EXACT_NEAR_HEADER_WORDS
    && ${e}[SS_EXACT_NEAR_HEADER_SOURCE_ADAPTER]
      == SS_EXACT_NEAR_SOURCE_ADAPTER_QUERY_V1
    && evidence_chart_id == expected.chart_id
    && evidence_min_level_bits == bitcast<u32>(expected.min_level)
    && (evidence_max_level_bits ^ 0x80000000u) == expected_max_level_order
    && evidence_base_spacing_bits == bitcast<u32>(expected.base_grid_spacing_m)
    && (occupied_level_mask_low | occupied_level_mask_high) != 0u
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
    && ss_exact_near_range_within(
      expected.expected_cell_keys_offset_words,
      cell_count * SS_EXACT_NEAR_KEY_WORDS,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_cell_members_offset_words,
      source_count,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_particle_to_cell_offset_words,
      source_count,
      physical_upper
    )
    && ${e}[expected.expected_cell_offsets_offset_words] == 0u
    && ${e}[
      expected.expected_cell_offsets_offset_words + cell_count
    ] == source_count;
}

fn ss_exact_near_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn ss_exact_near_compare_word(left: u32, right: u32) -> i32 {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

fn ss_exact_near_compare_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> i32 {
  let key_offset = expected.expected_cell_keys_offset_words
    + cell_index * SS_EXACT_NEAR_KEY_WORDS;
  var comparison = ss_exact_near_compare_word(
    ${e}[key_offset],
    chart
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${e}[key_offset + 1u],
    level_order
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${e}[key_offset + 2u],
    cell_order.x
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${e}[key_offset + 3u],
    cell_order.y
  );
  if (comparison != 0) {
    return comparison;
  }
  return ss_exact_near_compare_word(
    ${e}[key_offset + 4u],
    cell_order.z
  );
}

fn ss_exact_near_lower_bound_cell_key_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (range_begin > range_end || range_end > cell_count) { return cell_count; }
  var lower = range_begin;
  var upper = range_end;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_exact_near_compare_cell_key(
      expected,
      middle,
      chart,
      level_order,
      cell_order
    );
    if (comparison < 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return range_end;
  }
  return lower;
}

fn ss_exact_near_upper_bound_cell_key_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (range_begin > range_end || range_end > cell_count) { return cell_count; }
  var lower = range_begin;
  var upper = range_end;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_exact_near_compare_cell_key(
      expected,
      middle,
      chart,
      level_order,
      cell_order
    );
    if (comparison <= 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return range_end;
  }
  return lower;
}

fn ss_exact_near_lower_bound_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_lower_bound_cell_key_range(
    expected,
    chart,
    level_order,
    cell_order,
    0u,
    ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT]
  );
}

fn ss_exact_near_upper_bound_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_upper_bound_cell_key_range(
    expected,
    chart,
    level_order,
    cell_order,
    0u,
    ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT]
  );
}

fn ss_exact_near_cell_key_word(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32,
  word_index: u32
) -> u32 {
  return ${e}[
    expected.expected_cell_keys_offset_words
      + cell_index * SS_EXACT_NEAR_KEY_WORDS
      + word_index
  ];
}

fn ss_exact_near_saturating_sub_radius(value: i32, radius: i32) -> i32 {
  let minimum = -2147483647 - 1;
  if (radius > 0 && value < minimum + radius) {
    return minimum;
  }
  return value - radius;
}

fn ss_exact_near_saturating_add_radius(value: i32, radius: i32) -> i32 {
  let maximum = 2147483647;
  if (radius > 0 && value > maximum - radius) {
    return maximum;
  }
  return value + radius;
}

fn ss_exact_near_invalid_range() -> SchroederSpatialExactNearRangeV1 {
  return SchroederSpatialExactNearRangeV1(0u, 0u, 0u);
}

fn ss_exact_near_cell_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  minimum_order: vec3<u32>,
  maximum_order: vec3<u32>
) -> SchroederSpatialExactNearRangeV1 {
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let begin = ss_exact_near_lower_bound_cell_key(
    expected,
    chart,
    level_order,
    minimum_order
  );
  let end = ss_exact_near_upper_bound_cell_key(
    expected,
    chart,
    level_order,
    maximum_order
  );
  if (begin > end || end > cell_count) {
    return ss_exact_near_invalid_range();
  }
  return SchroederSpatialExactNearRangeV1(1u, begin, end);
}

fn ss_exact_near_cell_member_range(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32
) -> SchroederSpatialExactNearRangeV1 {
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return ss_exact_near_invalid_range();
  }
  let member_begin = ${e}[
    expected.expected_cell_offsets_offset_words + cell_index
  ];
  let member_end = ${e}[
    expected.expected_cell_offsets_offset_words + cell_index + 1u
  ];
  if (member_begin > member_end || member_end > expected.source_count) {
    return ss_exact_near_invalid_range();
  }
  return SchroederSpatialExactNearRangeV1(1u, member_begin, member_end);
}

fn ss_exact_near_source_at_member(
  expected: SchroederSpatialExactNearExpectationV1,
  member_offset: u32
) -> SchroederSpatialExactNearSourceLookupV1 {
  if (member_offset >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  let source_index = ${e}[
    expected.expected_cell_members_offset_words + member_offset
  ];
  if (source_index >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV1(1u, source_index);
}

fn ss_exact_near_cell_for_source(
  expected: SchroederSpatialExactNearExpectationV1,
  source_index: u32
) -> SchroederSpatialExactNearSourceLookupV1 {
  if (source_index >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  let cell_index = ${e}[
    expected.expected_particle_to_cell_offset_words + source_index
  ];
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV1(1u, cell_index);
}

fn ss_exact_near_level_occupied(
  expected: SchroederSpatialExactNearExpectationV1,
  level_ordinal: u32
) -> bool {
  if (level_ordinal >= expected.level_count || level_ordinal >= 64u) {
    return false;
  }
  let query_evidence_offset = expected.expected_particle_to_cell_offset_words
    + expected.source_count;
  let mask_word = ${e}[
    query_evidence_offset + 4u + level_ordinal / 32u
  ];
  return (mask_word & (1u << (level_ordinal % 32u))) != 0u;
}
`}function he({directoryBindingName:e=`spatial_directory`}={}){if(!pe.test(e))throw TypeError(`directoryBindingName must be a WGSL identifier`);return me(e)}const ge=he();function E(e,t,n,r){if(!e.includes(t))throw Error(`unable to derive exact-near traversal v2 WGSL: ${r}`);return e.replace(t,n)}function _e(e){let t=me(e);return t=t.replaceAll(`SchroederSpatialExactNearExpectationV1`,`SchroederSpatialExactNearExpectationV2`).replaceAll(`SchroederSpatialExactNearRangeV1`,`SchroederSpatialExactNearRangeV2`).replaceAll(`SchroederSpatialExactNearSourceLookupV1`,`SchroederSpatialExactNearSourceLookupV2`).replaceAll(`SS_EXACT_NEAR_MAGIC_V1`,`SS_EXACT_NEAR_MAGIC_V2`).replaceAll(`SS_EXACT_NEAR_ABI_VERSION_V1`,`SS_EXACT_NEAR_ABI_VERSION_V2`).replaceAll(`expected.source_count`,`expected.physical_source_count`).replaceAll(`expected.expected_particle_to_cell_offset_words`,`expected.expected_physical_to_cell_plus_one_offset_words`).replaceAll(`expected.expected_source_capacity`,`expected.expected_physical_source_capacity`),t=E(t,`  source_count: u32,`,`  physical_source_count: u32,`,`physical source expectation field`),t=E(t,`  expected_particle_to_cell_offset_words: u32,`,`  expected_physical_to_cell_plus_one_offset_words: u32,`,`physical reverse expectation field`),t=E(t,`  expected_source_capacity: u32,`,`  expected_physical_source_capacity: u32,`,`physical source capacity expectation field`),t=E(t,`const SS_EXACT_NEAR_ABI_VERSION_V2: u32 = 1u;`,`const SS_EXACT_NEAR_ABI_VERSION_V2: u32 = 2u;`,`directory ABI version`),t=E(t,`  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let cell_capacity = ${e}[SS_EXACT_NEAR_HEADER_CELL_CAPACITY];`,`  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let cell_capacity = ${e}[SS_EXACT_NEAR_HEADER_CELL_CAPACITY];
  let active_source_count = ${e}[
    SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT
  ];`,`GPU-authored active source count`),t=E(t,`    source_count > 0xffffffffu - expected.expected_physical_to_cell_plus_one_offset_words`,`    expected.expected_physical_source_capacity
      > 0xffffffffu - expected.expected_physical_to_cell_plus_one_offset_words`,`capacity-stable query evidence overflow guard`),t=E(t,`  let query_evidence_offset = expected.expected_physical_to_cell_plus_one_offset_words
    + source_count;`,`  let query_evidence_offset = expected.expected_physical_to_cell_plus_one_offset_words
    + expected.expected_physical_source_capacity;`,`capacity-stable query evidence offset`),t=E(t,`    && source_count == expected.physical_source_count
    && source_capacity == expected.expected_physical_source_capacity
    && cell_count > 0u
    && cell_count <= source_count`,`    && source_count == expected.physical_source_count
    && source_capacity == expected.expected_physical_source_capacity
    && active_source_count <= source_count
    && cell_count <= active_source_count
    && (active_source_count == 0u || cell_count > 0u)`,`active source admission`),t=E(t,`    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
      == source_count`,`    && ${e}[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
      == active_source_count`,`active primitive input evidence`),t=E(t,`      expected.expected_cell_members_offset_words,
      source_count,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_physical_to_cell_plus_one_offset_words,
      source_count,`,`      expected.expected_cell_members_offset_words,
      active_source_count,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_physical_to_cell_plus_one_offset_words,
      expected.expected_physical_source_capacity,`,`active CSR and physical reverse spans`),t=E(t,`      expected.expected_cell_offsets_offset_words + cell_count
    ] == source_count;`,`      expected.expected_cell_offsets_offset_words + cell_count
    ] == active_source_count;`,`active CSR terminal offset`),t=E(t,`    && (occupied_level_mask_low | occupied_level_mask_high) != 0u
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u`,`    && (
      active_source_count == 0u
      || (
        (occupied_level_mask_low | occupied_level_mask_high) != 0u
        && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
        && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
      )
    )`,`empty active-set query evidence`),t=E(t,`  if (member_begin > member_end || member_end > expected.physical_source_count) {`,`  let active_source_count = ${e}[
    SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT
  ];
  if (member_begin > member_end || member_end > active_source_count) {`,`active cell member range`),t=E(t,`  if (member_offset >= expected.physical_source_count) {
    return SchroederSpatialExactNearSourceLookupV2(0u, 0u);
  }`,`  let active_source_count = ${e}[
    SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT
  ];
  if (member_offset >= active_source_count) {
    return SchroederSpatialExactNearSourceLookupV2(0u, 0u);
  }`,`active member offset bound`),t=E(t,`  let cell_index = ${e}[
    expected.expected_physical_to_cell_plus_one_offset_words + source_index
  ];
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return SchroederSpatialExactNearSourceLookupV2(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV2(1u, cell_index);`,`  let cell_plus_one = ${e}[
    expected.expected_physical_to_cell_plus_one_offset_words + source_index
  ];
  if (cell_plus_one == 0u) {
    return SchroederSpatialExactNearSourceLookupV2(0u, 0u);
  }
  let cell_index = cell_plus_one - 1u;
  let cell_count = ${e}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return SchroederSpatialExactNearSourceLookupV2(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV2(1u, cell_index);`,`plus-one physical reverse lookup`),t=E(t,`  let query_evidence_offset = expected.expected_physical_to_cell_plus_one_offset_words
    + expected.physical_source_count;`,`  let query_evidence_offset = expected.expected_physical_to_cell_plus_one_offset_words
    + expected.expected_physical_source_capacity;`,`level mask evidence offset`),t}function ve({directoryBindingName:e=`spatial_directory`}={}){if(!pe.test(e))throw TypeError(`directoryBindingName must be a WGSL identifier`);return _e(e)}const ye=ve(),be=`
struct SpatialExactNearContactParams {
  element_count: u32,
  particle_count: u32,
  contact_policy_row_count: u32,
  derivation_enabled: u32,
  chart_id: u32,
  level_count: u32,
  expected_generation_id: u32,
  expected_device_ordinal: u32,
  expected_lane_ordinal: u32,
  expected_lease_token: u32,
  expected_source_family_id: u32,
  expected_storage_generation: u32,
  expected_physics_tick: u32,
  expected_physics_substep: u32,
  expected_position_epoch: u32,
  expected_topology_epoch: u32,
  expected_chart_epoch: u32,
  expected_level_epoch: u32,
  expected_support_epoch: u32,
  min_level: i32,
  base_grid_spacing_m: f32,
  max_search_radius_m: f32,
  gap_floor_m: f32,
  _reserved0: f32,
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
  _reserved1: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: SpatialExactNearContactParams;
@group(0) @binding(6) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(7) var<storage, read> particle_identity: array<u32>;

${ge}

struct SpatialContactCandidate {
  valid: u32,
  particle_index: u32,
  domain_id: u32,
  material_id: f32,
  phase_id: f32,
  signed_m: f32,
  lateral2: f32,
  velocity: vec3<f32>,
  mass_kg: f32,
  score: f32,
};

struct SpatialContactPair {
  directory_valid: u32,
  ready: u32,
  policy_index: u32,
  source_index: u32,
  target_index: u32,
  score: f32,
  source_signed_m: f32,
  target_signed_m: f32,
  source_velocity: vec3<f32>,
  target_velocity: vec3<f32>,
  source_mass_kg: f32,
  target_mass_kg: f32,
  source_domain_id: u32,
  target_domain_id: u32,
};

fn ss_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn ss_state_row1(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u + 1u];
}

fn ss_thermo_row0(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u];
}

fn ss_thermo_row2(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u + 2u];
}

fn ss_phase_matches(particle_phase_id: f32, required_phase_id: f32) -> bool {
  return required_phase_id <= 0.5 || abs(particle_phase_id - required_phase_id) < 0.5;
}

fn ss_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn ss_finite3(value: vec3<f32>) -> bool {
  return ss_finite(value.x) && ss_finite(value.y) && ss_finite(value.z);
}

fn ss_endpoint_matches(
  material_id: f32,
  phase_id: f32,
  required_material_id: f32,
  required_phase_id: f32
) -> bool {
  return abs(material_id - required_material_id) < 0.5
    && ss_phase_matches(phase_id, required_phase_id);
}

fn ss_policy_element_side(
  row0: vec4<f32>,
  row2: vec4<f32>,
  material_id: f32,
  phase_id: f32
) -> u32 {
  if (
    !ss_finite(row2.y)
    || row2.y <= 0.0
    || !ss_finite(material_id)
    || !ss_finite(phase_id)
    || !ss_finite(row0.x)
    || !ss_finite(row0.y)
    || !ss_finite(row0.z)
    || !ss_finite(row0.w)
  ) {
    return 0u;
  }
  let matches_a = ss_endpoint_matches(material_id, phase_id, row0.x, row0.z);
  let matches_b = ss_endpoint_matches(material_id, phase_id, row0.y, row0.w);
  if (matches_a && matches_b) {
    let exact_phase_a = row0.z > 0.5 && abs(phase_id - row0.z) < 0.5;
    let exact_phase_b = row0.w > 0.5 && abs(phase_id - row0.w) < 0.5;
    if (exact_phase_b && !exact_phase_a) {
      return 2u;
    }
    return 1u;
  }
  if (matches_a) {
    return 1u;
  }
  if (matches_b) {
    return 2u;
  }
  return 0u;
}

fn ss_exact_domain_id(value: f32) -> u32 {
  if (
    !ss_finite(value)
    || value < 0.5
    || value > 16777215.0
    || abs(value - round(value)) > 0.25
  ) {
    return 0u;
  }
  return u32(round(value));
}

fn ss_normal_from_element(row2: vec4<f32>, row3: vec4<f32>) -> vec3<f32> {
  var normal = row2.xyz;
  if (dot(normal, normal) <= 1.0e-24) {
    normal = vec3<f32>(row2.w, row3.x, row3.y);
  }
  if (dot(normal, normal) <= 1.0e-24) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(normal);
}

fn ss_exact_near_expectation() -> SchroederSpatialExactNearExpectationV1 {
  return SchroederSpatialExactNearExpectationV1(
    params.particle_count,
    params.derivation_enabled,
    ${ie}u,
    params.chart_id,
    params.level_count,
    params.expected_generation_id,
    params.expected_device_ordinal,
    params.expected_lane_ordinal,
    params.expected_lease_token,
    params.expected_source_family_id,
    params.expected_storage_generation,
    params.expected_physics_tick,
    params.expected_physics_substep,
    params.expected_position_epoch,
    params.expected_topology_epoch,
    params.expected_chart_epoch,
    params.expected_level_epoch,
    params.expected_support_epoch,
    params.min_level,
    params.base_grid_spacing_m,
    params.expected_cell_keys_offset_words,
    params.expected_cell_offsets_offset_words,
    params.expected_cell_members_offset_words,
    params.expected_particle_to_cell_offset_words,
    params.expected_directory_capacity_words,
    params.expected_source_capacity,
    params.expected_cell_capacity
  );
}

fn ss_directory_ready() -> bool {
  return params.element_count <= arrayLength(&interface_elements) / 4u
    && params.element_count <= arrayLength(&contact_kinematics_rows) / 2u
    && params.particle_count <= arrayLength(&particle_state_rows) / 2u
    && params.particle_count <= arrayLength(&particle_thermo_rows) / 3u
    && params.particle_count <= arrayLength(&particle_identity)
    && params.contact_policy_row_count <= arrayLength(&contact_policy_rows) / 4u
    && ss_exact_near_directory_admitted(ss_exact_near_expectation());
}

fn ss_signed_order_key(value: i32) -> u32 {
  return ss_exact_near_signed_order_key(value);
}

fn ss_lower_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_lower_bound_cell_key(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order
  );
}

fn ss_upper_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_upper_bound_cell_key(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order
  );
}

fn ss_lower_bound_cell_key_range(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  return ss_exact_near_lower_bound_cell_key_range(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order,
    range_begin,
    range_end
  );
}

fn ss_upper_bound_cell_key_range(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  return ss_exact_near_upper_bound_cell_key_range(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order,
    range_begin,
    range_end
  );
}

fn ss_cell_key_word(cell_index: u32, word_index: u32) -> u32 {
  return ss_exact_near_cell_key_word(
    ss_exact_near_expectation(),
    cell_index,
    word_index
  );
}

fn ss_saturating_sub_radius(value: i32, radius: i32) -> i32 {
  return ss_exact_near_saturating_sub_radius(value, radius);
}

fn ss_saturating_add_radius(value: i32, radius: i32) -> i32 {
  return ss_exact_near_saturating_add_radius(value, radius);
}

fn ss_empty_candidate() -> SpatialContactCandidate {
  return SpatialContactCandidate(
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0,
    0.0
  );
}

fn ss_candidate_for_particle(
  particle_index: u32,
  centroid: vec3<f32>,
  normal: vec3<f32>,
  search_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var candidate = ss_empty_candidate();
  if (particle_index >= params.particle_count) {
    return candidate;
  }
  let thermo0 = ss_thermo_row0(particle_index);
  let thermo2 = ss_thermo_row2(particle_index);
  if (
    !ss_finite(thermo0.x)
    || !ss_finite(thermo0.y)
    || !ss_finite(thermo2.z)
    || thermo2.z <= 0.0
  ) {
    return candidate;
  }
  let state0 = ss_state_row0(particle_index);
  let state1 = ss_state_row1(particle_index);
  if (
    !ss_finite3(state0.xyz)
    || !ss_finite(state0.w)
    || state0.w <= 0.0
    || !ss_finite3(state1.xyz)
  ) {
    return candidate;
  }
  let delta = state0.xyz - centroid;
  let signed_m = dot(delta, normal);
  let distance2 = dot(delta, delta);
  let lateral2 = max(distance2 - signed_m * signed_m, 0.0);
  if (
    !ss_finite(signed_m)
    || !ss_finite(lateral2)
    || lateral2 > search_radius2
    || abs(signed_m) > search_radius_m
  ) {
    return candidate;
  }
  let domain_id = particle_identity[particle_index];
  if (domain_id > 16777215u) {
    return candidate;
  }
  candidate.valid = 1u;
  candidate.particle_index = particle_index;
  candidate.domain_id = domain_id;
  candidate.material_id = thermo0.x;
  candidate.phase_id = thermo0.y;
  candidate.signed_m = signed_m;
  candidate.lateral2 = lateral2;
  candidate.velocity = state1.xyz;
  candidate.mass_kg = state0.w;
  return candidate;
}

fn ss_candidate_matches_endpoint(
  candidate: SpatialContactCandidate,
  required_material_id: f32,
  required_phase_id: f32,
  required_domain_id: u32
) -> bool {
  return candidate.valid != 0u
    && ss_endpoint_matches(
      candidate.material_id,
      candidate.phase_id,
      required_material_id,
      required_phase_id
    )
    && (required_domain_id == 0u || candidate.domain_id == required_domain_id);
}

fn ss_score_candidate(
  candidate: SpatialContactCandidate,
  endpoint_ordinal: u32,
  support_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var result = candidate;
  let wrong_side = select(
    candidate.signed_m > support_radius_m * 0.25,
    candidate.signed_m < -support_radius_m * 0.25,
    endpoint_ordinal != 0u
  );
  let side_penalty = select(0.0, search_radius2, wrong_side);
  result.score = candidate.lateral2
    + candidate.signed_m * candidate.signed_m
    + side_penalty;
  return result;
}

fn ss_candidate_better(
  candidate: SpatialContactCandidate,
  incumbent: SpatialContactCandidate
) -> bool {
  if (candidate.valid == 0u) {
    return false;
  }
  if (incumbent.valid == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.domain_id < incumbent.domain_id) {
    return true;
  }
  if (candidate.domain_id > incumbent.domain_id) {
    return false;
  }
  return candidate.particle_index < incumbent.particle_index;
}

fn ss_empty_pair() -> SpatialContactPair {
  return SpatialContactPair(
    1u,
    0u,
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u
  );
}

fn ss_invalid_directory_pair() -> SpatialContactPair {
  var pair = ss_empty_pair();
  pair.directory_valid = 0u;
  return pair;
}

fn ss_pair_from_candidates(
  source_candidate: SpatialContactCandidate,
  target_candidate: SpatialContactCandidate,
  policy_index: u32
) -> SpatialContactPair {
  var pair = ss_empty_pair();
  if (
    source_candidate.valid == 0u
    || target_candidate.valid == 0u
    || source_candidate.particle_index == target_candidate.particle_index
  ) {
    return pair;
  }
  pair.ready = 1u;
  pair.policy_index = policy_index;
  pair.source_index = source_candidate.particle_index;
  pair.target_index = target_candidate.particle_index;
  pair.score = source_candidate.score + target_candidate.score;
  pair.source_signed_m = source_candidate.signed_m;
  pair.target_signed_m = target_candidate.signed_m;
  pair.source_velocity = source_candidate.velocity;
  pair.target_velocity = target_candidate.velocity;
  pair.source_mass_kg = source_candidate.mass_kg;
  pair.target_mass_kg = target_candidate.mass_kg;
  pair.source_domain_id = source_candidate.domain_id;
  pair.target_domain_id = target_candidate.domain_id;
  return pair;
}

fn ss_pair_better(candidate: SpatialContactPair, incumbent: SpatialContactPair) -> bool {
  if (candidate.ready == 0u) {
    return false;
  }
  if (incumbent.ready == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.source_domain_id < incumbent.source_domain_id) {
    return true;
  }
  if (candidate.source_domain_id > incumbent.source_domain_id) {
    return false;
  }
  if (candidate.target_domain_id < incumbent.target_domain_id) {
    return true;
  }
  if (candidate.target_domain_id > incumbent.target_domain_id) {
    return false;
  }
  if (candidate.source_index < incumbent.source_index) {
    return true;
  }
  if (candidate.source_index > incumbent.source_index) {
    return false;
  }
  if (candidate.target_index < incumbent.target_index) {
    return true;
  }
  if (candidate.target_index > incumbent.target_index) {
    return false;
  }
  return candidate.policy_index < incumbent.policy_index;
}

fn ss_pair_for_policy(
  policy_index: u32,
  element_material_id: f32,
  element_phase_id: f32,
  centroid: vec3<f32>,
  normal: vec3<f32>
) -> SpatialContactPair {
  var result = ss_empty_pair();
  let row0 = contact_policy_rows[policy_index * 4u];
  let row1 = contact_policy_rows[policy_index * 4u + 1u];
  let row2 = contact_policy_rows[policy_index * 4u + 2u];
  let row3 = contact_policy_rows[policy_index * 4u + 3u];
  let element_side = ss_policy_element_side(
    row0,
    row2,
    element_material_id,
    element_phase_id
  );
  if (
    element_side == 0u
    || !ss_finite(row1.z)
    || row1.z < 0.0
    || !ss_finite(row3.x)
    || !ss_finite(row3.y)
    || !ss_finite(row3.z)
    || !ss_finite(row3.w)
  ) {
    return result;
  }

  let body_specific = row3.z > 0.5;
  let domain_pair_ready = row3.w > 0.5;
  if (body_specific && !domain_pair_ready) {
    return result;
  }
  let domain_a = select(0u, ss_exact_domain_id(row3.x), domain_pair_ready);
  let domain_b = select(0u, ss_exact_domain_id(row3.y), domain_pair_ready);
  if (domain_pair_ready && (domain_a == 0u || domain_b == 0u)) {
    return result;
  }

  let element_is_a = element_side == 1u;
  let source_material_id = select(row0.y, row0.x, element_is_a);
  let source_phase_id = select(row0.w, row0.z, element_is_a);
  let target_material_id = select(row0.x, row0.y, element_is_a);
  let target_phase_id = select(row0.z, row0.w, element_is_a);
  let source_domain_id = select(domain_b, domain_a, element_is_a);
  let target_domain_id = select(domain_a, domain_b, element_is_a);
  let support_radius_m = max(row1.z, 1.0e-6);
  let search_radius_m = max(
    max(support_radius_m * 2.0, params.max_search_radius_m),
    1.0e-6
  );
  if (!ss_finite(search_radius_m)) {
    return result;
  }
  let search_radius2 = search_radius_m * search_radius_m;
  if (!ss_finite(search_radius2)) {
    return result;
  }
  // The accepted region is a cylinder (independent normal and lateral
  // bounds), so its axis-aligned enclosing radius is sqrt(2) * R.
  let directory_query_radius_m = search_radius_m * 1.4142135623730951;

  var source_first = ss_empty_candidate();
  var source_second = source_first;
  var target_first = source_first;
  var target_second = source_first;

  for (
    var level_ordinal = 0u;
    level_ordinal < params.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(ss_exact_near_expectation(), level_ordinal)) {
      continue;
    }
    let level = params.min_level + i32(level_ordinal);
    let spacing_m = params.base_grid_spacing_m * exp2(f32(level));
    if (!ss_finite(spacing_m) || !(spacing_m > 0.0)) {
      continue;
    }
    let center_cell = vec3<i32>(floor(centroid / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(directory_query_radius_m / spacing_m), 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_saturating_sub_radius(center_cell.x, radius_cells),
      ss_saturating_sub_radius(center_cell.y, radius_cells),
      ss_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_saturating_add_radius(center_cell.x, radius_cells),
      ss_saturating_add_radius(center_cell.y, radius_cells),
      ss_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_signed_order_key(minimum_cell.x),
      ss_signed_order_key(minimum_cell.y),
      ss_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_signed_order_key(maximum_cell.x),
      ss_signed_order_key(maximum_cell.y),
      ss_signed_order_key(maximum_cell.z)
    );

    // Traverse only occupied lexicographic x/y groups. A dense integer-cell
    // cube is catastrophically large at fine levels even when almost every
    // cell is empty. Binary searches skip directly between occupied prefixes.
    let level_begin = ss_lower_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_upper_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    if (level_begin >= level_end) {
      continue;
    }
    var x_cursor = ss_lower_bound_cell_key_range(
      params.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < params.particle_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_cell_key_word(x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_upper_bound_cell_key_range(
        params.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      // The directory header is authenticated on-device, but a sparse-prefix
      // consumer must still own its termination proof. Fail closed if a torn
      // or backend-miscompiled binary search ever violates strict progress.
      if (x_end <= x_cursor) {
        return ss_invalid_directory_pair();
      }
      var y_cursor = ss_lower_bound_cell_key_range(
        params.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < params.particle_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_cell_key_word(y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_upper_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          return ss_invalid_directory_pair();
        }
        let z_begin = ss_lower_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_upper_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_range = ss_exact_near_cell_member_range(
            ss_exact_near_expectation(),
            cell_index
          );
          if (member_range.admitted == 0u) {
            return ss_invalid_directory_pair();
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let source_lookup = ss_exact_near_source_at_member(
              ss_exact_near_expectation(),
              member_offset
            );
            if (source_lookup.admitted == 0u) {
              return ss_invalid_directory_pair();
            }
            let particle_index = source_lookup.source_index;
            let candidate = ss_candidate_for_particle(
              particle_index,
              centroid,
              normal,
              search_radius_m,
              search_radius2
            );
            if (ss_candidate_matches_endpoint(
              candidate,
              source_material_id,
              source_phase_id,
              source_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                0u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, source_first)) {
                if (source_first.particle_index != scored.particle_index) {
                  source_second = source_first;
                }
                source_first = scored;
              } else if (
                scored.particle_index != source_first.particle_index
                && ss_candidate_better(scored, source_second)
              ) {
                source_second = scored;
              }
            }
            if (ss_candidate_matches_endpoint(
              candidate,
              target_material_id,
              target_phase_id,
              target_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                1u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, target_first)) {
                if (target_first.particle_index != scored.particle_index) {
                  target_second = target_first;
                }
                target_first = scored;
              } else if (
                scored.particle_index != target_first.particle_index
                && ss_candidate_better(scored, target_second)
              ) {
                target_second = scored;
              }
            }
          }
        }
        y_cursor = y_end;
      }
      if (y_cursor < x_end) {
        return ss_invalid_directory_pair();
      }
      x_cursor = x_end;
    }
    if (x_cursor < level_end) {
      return ss_invalid_directory_pair();
    }
  }

  var candidate_pair = ss_pair_from_candidates(
    source_first,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_first,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  return result;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(0.0);
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(0.0);
  if (
    params.particle_count == 0u
    || params.contact_policy_row_count == 0u
    || params.level_count == 0u
    || !ss_finite(params.base_grid_spacing_m)
    || params.base_grid_spacing_m <= 0.0
    || !ss_finite(params.max_search_radius_m)
    || params.max_search_radius_m < 0.0
    || !ss_finite(params.gap_floor_m)
    || params.gap_floor_m < 0.0
    || !ss_directory_ready()
  ) {
    return;
  }

  let element_row0 = interface_elements[element_index * 4u];
  let element_row1 = interface_elements[element_index * 4u + 1u];
  let element_row2 = interface_elements[element_index * 4u + 2u];
  let element_row3 = interface_elements[element_index * 4u + 3u];
  let element_material_id = element_row0.y;
  let element_phase_id = element_row0.z;
  let centroid = element_row1.xyz;
  let area_m2 = element_row1.w;
  if (
    !ss_finite(element_material_id)
    || !ss_finite(element_phase_id)
    || !ss_finite3(centroid)
    || !ss_finite(area_m2)
    || area_m2 <= 0.0
    || !ss_finite3(element_row2.xyz)
    || !ss_finite(element_row2.w)
    || !ss_finite(element_row3.x)
    || !ss_finite(element_row3.y)
    || !ss_finite(element_row3.w)
    || element_row3.w <= 0.0
  ) {
    return;
  }

  let normal = ss_normal_from_element(element_row2, element_row3);
  if (!ss_finite3(normal)) {
    return;
  }
  var best_pair = ss_empty_pair();
  for (
    var policy_index = 0u;
    policy_index < params.contact_policy_row_count;
    policy_index = policy_index + 1u
  ) {
    let pair = ss_pair_for_policy(
      policy_index,
      element_material_id,
      element_phase_id,
      centroid,
      normal
    );
    if (pair.directory_valid == 0u) {
      return;
    }
    if (ss_pair_better(pair, best_pair)) {
      best_pair = pair;
    }
  }
  if (best_pair.ready == 0u) {
    return;
  }

  let signed_span_m = best_pair.target_signed_m - best_pair.source_signed_m;
  let direction_sign = select(-1.0, 1.0, signed_span_m >= 0.0);
  let gap_m = max(abs(signed_span_m), params.gap_floor_m);
  let relative_normal_velocity_m_per_s = dot(
    best_pair.target_velocity - best_pair.source_velocity,
    normal * direction_sign
  );
  var representative_mass_kg = 0.0;
  if (best_pair.source_mass_kg > 0.0 && best_pair.target_mass_kg > 0.0) {
    representative_mass_kg = (best_pair.source_mass_kg * best_pair.target_mass_kg)
      / max(best_pair.source_mass_kg + best_pair.target_mass_kg, 1.0e-12);
  }
  let source_domain_id = best_pair.source_domain_id;
  let target_domain_id = best_pair.target_domain_id;
  let domain_pair_ready = source_domain_id > 0u && target_domain_id > 0u;
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    2.0
  );
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(
    f32(source_domain_id),
    f32(target_domain_id),
    select(0.0, 1.0, domain_pair_ready),
    f32(best_pair.policy_index + 1u)
  );
}
`;function xe(){if(!be.includes(ge))throw Error(`unable to derive pressure/contact v2 WGSL: v1 traversal module missing`);return be.replace(ge,ye).replaceAll(`SchroederSpatialExactNearExpectationV1`,`SchroederSpatialExactNearExpectationV2`)}xe();const Se=1396921393,Ce=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.sourceCount:u32.sourceCapacity:u32.cellCount:u32.cellCapacity:u32.leafCapacity:u32.nodeCapacity:u32.nodeOffsetWords:u32.treeDepth:u32.directoryCapacityWords:u32.directoryCellKeysOffsetWords:u32.directoryCellOffsetsOffsetWords:u32.directoryCellMembersOffsetWords:u32.directoryParticleToCellOffsetWords:u32.directoryCompletionOrdinal:u32.leafBuildCount:u32.invalidNodeCount:u32.rootNodeIndex:u32.nodeWords:u32.reserved34:u32.reserved35:u32.reserved36:u32.reserved37:u32.reserved38:u32.reserved39:u32`.split(`.`)),we=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.physicalSourceCount:u32.physicalSourceCapacity:u32.cellCount:u32.cellCapacity:u32.leafCapacity:u32.nodeCapacity:u32.nodeOffsetWords:u32.treeDepth:u32.directoryCapacityWords:u32.directoryCellKeysOffsetWords:u32.directoryCellOffsetsOffsetWords:u32.directoryCellMembersOffsetWords:u32.directoryPhysicalToCellPlusOneOffsetWords:u32.directoryCompletionOrdinal:u32.leafBuildCount:u32.invalidNodeCount:u32.rootNodeIndex:u32.nodeWords:u32.activeSourceCount:u32.reverseEncoding:u32.reserved36:u32.reserved37:u32.reserved38:u32.reserved39:u32`.split(`.`)),Te=Object.freeze([`aabbMinXM:f32`,`aabbMinYM:f32`,`aabbMinZM:f32`,`aabbMaxXM:f32`,`aabbMaxYM:f32`,`aabbMaxZM:f32`,`nodeStatus:u32`,`cellIndexOrInvalid:u32`]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-cell-tree.v1`,version:1,magic:Se,headerWords:40,nodeWords:8,headerLayout:Ce,nodeLayout:Te,topology:`complete-power-of-two-binary-cell-aabb-tree`,sourceAuthority:`immutable-ss-spatial-epoch-v1-cell-csr`,construction:`fixed-bottom-up-union-levels-no-private-sort`,traversal:`consumer-exact-leaf-streaming-with-current-law-predicate`,materializedCandidateRows:!1,perSourceCandidateBudget:null,fallbackPolicy:`none-after-admitted-canonical-generation-selection`}),Object.freeze({schema:`peercompute.ulg.schroeder-spatial-exact-near-cell-tree.v2`,version:2,magic:Se,headerWords:40,nodeWords:8,headerLayout:we,nodeLayout:Te,topology:`complete-power-of-two-binary-cell-aabb-tree`,sourceAuthority:`immutable-ss-spatial-epoch-v2-active-cell-csr`,activeSourceCountAuthorityWord:37,memberIdentity:`stable-physical-source-slot-u32`,reverseEncoding:`cell-index-plus-one-zero-dormant`,construction:`fixed-bottom-up-union-levels-no-private-sort`,traversal:`consumer-exact-leaf-streaming-with-current-law-predicate`,materializedCandidateRows:!1,perSourceCandidateBudget:null,fallbackPolicy:`none-after-admitted-level-assignment-v2-generation-selection`});const Ee=he({directoryBindingName:`spatial_directory`}),De=ve({directoryBindingName:`spatial_directory`});function Oe({treeBindingName:e=`exact_near_cell_tree`,directoryBindingName:t=`spatial_directory`}={}){return`
const SS_EXACT_CELL_TREE_MAGIC: u32 = 0x53435431u;
const SS_EXACT_CELL_TREE_VERSION: u32 = 1u;
const SS_EXACT_CELL_TREE_HEADER_WORDS: u32 = 40u;
const SS_EXACT_CELL_TREE_NODE_WORDS: u32 = 8u;
const SS_EXACT_CELL_TREE_READY: u32 = 1u;
const SS_EXACT_CELL_TREE_ADMITTED: u32 = 2u;
const SS_EXACT_CELL_TREE_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_CELL_TREE_NODE_VALID: u32 = 1u;
const SS_EXACT_CELL_TREE_NODE_LEAF: u32 = 2u;
const SS_EXACT_CELL_TREE_NODE_INTERNAL: u32 = 4u;
const SS_EXACT_CELL_TREE_INVALID_U32: u32 = 0xffffffffu;

fn ss_exact_cell_tree_node_base(node_index: u32) -> u32 {
  return ${e}[22u] + node_index * SS_EXACT_CELL_TREE_NODE_WORDS;
}

fn ss_exact_cell_tree_admitted(
  expected: SchroederSpatialExactNearExpectationV1
) -> bool {
  let tree_word_length = arrayLength(&${e});
  if (tree_word_length < SS_EXACT_CELL_TREE_HEADER_WORDS) {
    return false;
  }
  let required_status = SS_EXACT_CELL_TREE_READY | SS_EXACT_CELL_TREE_ADMITTED;
  let cell_count = ${t}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let leaf_capacity = ${e}[20u];
  let node_capacity = ${e}[21u];
  let node_offset = ${e}[22u];
  let tree_depth = ${e}[23u];
  if (tree_depth > 30u) {
    return false;
  }
  let topology_leaf_capacity = 1u << tree_depth;
  // Divide before multiplying so an untrusted header cannot wrap an address
  // calculation and make a truncated tree look admitted.
  let whole_tree_in_bounds = node_offset <= tree_word_length
    && node_capacity <= (tree_word_length - node_offset) / SS_EXACT_CELL_TREE_NODE_WORDS;
  if (!whole_tree_in_bounds || node_capacity == 0u) {
    return false;
  }
  let root_base = node_offset;
  let root_status = ${e}[root_base + 6u];
  let expected_root_kind = select(
    SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL,
    SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_LEAF,
    leaf_capacity == 1u
  );
  return ${e}[0u] == SS_EXACT_CELL_TREE_MAGIC
    && ${e}[1u] == SS_EXACT_CELL_TREE_VERSION
    && (${e}[2u] & required_status) == required_status
    && (${e}[2u] & SS_EXACT_CELL_TREE_FAIL_CLOSED) == 0u
    && ${e}[3u] == expected.expected_generation_id
    && ${e}[4u] == expected.expected_device_ordinal
    && ${e}[5u] == expected.expected_lane_ordinal
    && ${e}[6u] == expected.expected_lease_token
    && ${e}[7u] == expected.expected_source_family_id
    && ${e}[8u] == expected.expected_storage_generation
    && ${e}[9u] == expected.expected_physics_tick
    && ${e}[10u] == expected.expected_physics_substep
    && ${e}[11u] == expected.expected_position_epoch
    && ${e}[12u] == expected.expected_topology_epoch
    && ${e}[13u] == expected.expected_chart_epoch
    && ${e}[14u] == expected.expected_level_epoch
    && ${e}[15u] == expected.expected_support_epoch
    && ${e}[16u] == expected.source_count
    && ${e}[17u] == expected.expected_source_capacity
    && ${e}[18u] == cell_count
    && ${e}[19u] == expected.expected_cell_capacity
    && cell_count > 0u
    && expected.expected_cell_capacity > 0u
    && expected.expected_cell_capacity <= leaf_capacity
    && cell_count <= leaf_capacity
    && leaf_capacity > 0u
    && leaf_capacity == topology_leaf_capacity
    && node_capacity == leaf_capacity * 2u - 1u
    && node_offset == SS_EXACT_CELL_TREE_HEADER_WORDS
    && whole_tree_in_bounds
    && ${e}[24u] == expected.expected_directory_capacity_words
    && ${e}[25u] == expected.expected_cell_keys_offset_words
    && ${e}[26u] == expected.expected_cell_offsets_offset_words
    && ${e}[27u] == expected.expected_cell_members_offset_words
    && ${e}[28u] == expected.expected_particle_to_cell_offset_words
    && ${e}[29u]
      == ${t}[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]
    && ${e}[30u] == cell_count
    && ${e}[31u] == 0u
    && ${e}[32u] == 0u
    && ${e}[33u] == SS_EXACT_CELL_TREE_NODE_WORDS
    && root_base + SS_EXACT_CELL_TREE_NODE_WORDS <= tree_word_length
    && ((root_status & (
      SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL | SS_EXACT_CELL_TREE_NODE_LEAF
    )) == expected_root_kind);
}

fn ss_exact_cell_tree_node_status(node_index: u32) -> u32 {
  return ${e}[ss_exact_cell_tree_node_base(node_index) + 6u];
}

fn ss_exact_cell_tree_node_is_leaf(node_index: u32) -> bool {
  let status = ss_exact_cell_tree_node_status(node_index);
  return (status & (
    SS_EXACT_CELL_TREE_NODE_VALID
      | SS_EXACT_CELL_TREE_NODE_LEAF
      | SS_EXACT_CELL_TREE_NODE_INTERNAL
  ))
    == (SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_LEAF);
}

fn ss_exact_cell_tree_node_is_internal(node_index: u32) -> bool {
  let status = ss_exact_cell_tree_node_status(node_index);
  return (status & (
    SS_EXACT_CELL_TREE_NODE_VALID
      | SS_EXACT_CELL_TREE_NODE_LEAF
      | SS_EXACT_CELL_TREE_NODE_INTERNAL
  ))
    == (SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL);
}

fn ss_exact_cell_tree_node_intersects(
  node_index: u32,
  query_minimum: vec3<f32>,
  query_maximum: vec3<f32>
) -> bool {
  let base = ss_exact_cell_tree_node_base(node_index);
  let status = ${e}[base + 6u];
  if ((status & SS_EXACT_CELL_TREE_NODE_VALID) == 0u) { return false; }
  let minimum = vec3<f32>(
    bitcast<f32>(${e}[base]),
    bitcast<f32>(${e}[base + 1u]),
    bitcast<f32>(${e}[base + 2u])
  );
  let maximum = vec3<f32>(
    bitcast<f32>(${e}[base + 3u]),
    bitcast<f32>(${e}[base + 4u]),
    bitcast<f32>(${e}[base + 5u])
  );
  return ss_exact_near_finite(minimum.x)
    && ss_exact_near_finite(minimum.y)
    && ss_exact_near_finite(minimum.z)
    && ss_exact_near_finite(maximum.x)
    && ss_exact_near_finite(maximum.y)
    && ss_exact_near_finite(maximum.z)
    && all(minimum <= maximum)
    && all(minimum <= query_maximum)
    && all(maximum >= query_minimum);
}

fn ss_exact_cell_tree_leaf_cell_index(node_index: u32) -> u32 {
  return ${e}[ss_exact_cell_tree_node_base(node_index) + 7u];
}
`}function D(e,t,n,r){if(!e.includes(t))throw Error(`unable to derive exact-near cell-tree v2 WGSL: ${r}`);return e.replace(t,n)}function ke({treeBindingName:e=`exact_near_cell_tree`,directoryBindingName:t=`spatial_directory`}={}){let n=Oe({treeBindingName:e,directoryBindingName:t});return n=n.replaceAll(`SchroederSpatialExactNearExpectationV1`,`SchroederSpatialExactNearExpectationV2`).replaceAll(`expected.source_count`,`expected.physical_source_count`).replaceAll(`expected.expected_source_capacity`,`expected.expected_physical_source_capacity`).replaceAll(`expected.expected_particle_to_cell_offset_words`,`expected.expected_physical_to_cell_plus_one_offset_words`),n=D(n,`const SS_EXACT_CELL_TREE_VERSION: u32 = 1u;`,`const SS_EXACT_CELL_TREE_VERSION: u32 = 2u;
const SS_EXACT_CELL_TREE_REVERSE_CELL_PLUS_ONE: u32 = 1u;`,`tree ABI version`),n=D(n,`    && ${e}[33u] == SS_EXACT_CELL_TREE_NODE_WORDS
    && root_base + SS_EXACT_CELL_TREE_NODE_WORDS <= tree_word_length`,`    && ${e}[33u] == SS_EXACT_CELL_TREE_NODE_WORDS
    && ${e}[34u]
      == ${t}[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
    && ${e}[34u] > 0u
    && ${e}[34u] <= expected.physical_source_count
    && ${e}[35u] == SS_EXACT_CELL_TREE_REVERSE_CELL_PLUS_ONE
    && root_base + SS_EXACT_CELL_TREE_NODE_WORDS <= tree_word_length`,`active count and reverse encoding admission`),n=D(n,`    && cell_count > 0u
`,``,`admitted empty active CSR`),n=D(n,`    && ${e}[32u] == 0u`,`    && ${e}[32u] == select(
      SS_EXACT_CELL_TREE_INVALID_U32,
      0u,
      cell_count > 0u
    )`,`empty root identity`),n=D(n,`    && ${e}[34u] > 0u
    && ${e}[34u] <= expected.physical_source_count`,`    && ${e}[34u] <= expected.physical_source_count
    && ((${e}[34u] == 0u) == (cell_count == 0u))`,`zero-active source admission`),n=D(n,`    && ((root_status & (
      SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL | SS_EXACT_CELL_TREE_NODE_LEAF
    )) == expected_root_kind);`,`    && select(
      root_status == 0u,
      ((root_status & (
        SS_EXACT_CELL_TREE_NODE_VALID
          | SS_EXACT_CELL_TREE_NODE_INTERNAL
          | SS_EXACT_CELL_TREE_NODE_LEAF
      )) == expected_root_kind),
      cell_count > 0u
    );`,`empty root admission`),n}const Ae=`
struct ExactNearCellTreeBuildParams {
  leaf_capacity: u32,
  node_capacity: u32,
  node_offset_words: u32,
  tree_depth: u32,
  tree_word_capacity: u32,
  cell_capacity: u32,
  node_words: u32,
  reserved: u32,
};

struct ExactNearCellTreeLevelParams {
  level_start: u32,
  level_count: u32,
};

@group(0) @binding(0) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(1) var<storage, read_write> exact_near_cell_tree: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(3) var<uniform> tree_params: ExactNearCellTreeBuildParams;
@group(0) @binding(4) var<uniform> tree_level: ExactNearCellTreeLevelParams;

${Ee}

const TREE_MAGIC: u32 = 0x53435431u;
const TREE_VERSION: u32 = 1u;
const TREE_HEADER_WORDS: u32 = 40u;
const TREE_NODE_WORDS: u32 = 8u;
const TREE_READY: u32 = 1u;
const TREE_ADMITTED: u32 = 2u;
const TREE_FAIL_CLOSED: u32 = 4u;
const TREE_INVALID_SOURCE: u32 = 8u;
const TREE_CAPACITY_OVERFLOW: u32 = 16u;
const TREE_NODE_VALID: u32 = 1u;
const TREE_NODE_LEAF: u32 = 2u;
const TREE_NODE_INTERNAL: u32 = 4u;
const TREE_INVALID_U32: u32 = 0xffffffffu;

const H_MAGIC: u32 = 0u;
const H_VERSION: u32 = 1u;
const H_STATUS: u32 = 2u;
const H_GENERATION: u32 = 3u;
const H_DEVICE: u32 = 4u;
const H_LANE: u32 = 5u;
const H_LEASE: u32 = 6u;
const H_SOURCE_FAMILY: u32 = 7u;
const H_STORAGE: u32 = 8u;
const H_TICK: u32 = 9u;
const H_SUBSTEP: u32 = 10u;
const H_POSITION: u32 = 11u;
const H_TOPOLOGY: u32 = 12u;
const H_CHART: u32 = 13u;
const H_LEVEL: u32 = 14u;
const H_SUPPORT: u32 = 15u;
const H_SOURCE_COUNT: u32 = 16u;
const H_SOURCE_CAPACITY: u32 = 17u;
const H_CELL_COUNT: u32 = 18u;
const H_CELL_CAPACITY: u32 = 19u;
const H_LEAF_CAPACITY: u32 = 20u;
const H_NODE_CAPACITY: u32 = 21u;
const H_NODE_OFFSET: u32 = 22u;
const H_TREE_DEPTH: u32 = 23u;
const H_DIRECTORY_CAPACITY: u32 = 24u;
const H_CELL_KEYS_OFFSET: u32 = 25u;
const H_CELL_OFFSETS_OFFSET: u32 = 26u;
const H_CELL_MEMBERS_OFFSET: u32 = 27u;
const H_PARTICLE_TO_CELL_OFFSET: u32 = 28u;
const H_DIRECTORY_COMPLETION: u32 = 29u;
const H_LEAF_BUILD_COUNT: u32 = 30u;
const H_INVALID_NODE_COUNT: u32 = 31u;
const H_ROOT_INDEX: u32 = 32u;
const H_NODE_WORD_COUNT: u32 = 33u;

fn tree_load(word: u32) -> u32 {
  return atomicLoad(&exact_near_cell_tree[word]);
}

fn tree_store(word: u32, value: u32) {
  atomicStore(&exact_near_cell_tree[word], value);
}

fn tree_node_base(node_index: u32) -> u32 {
  return tree_params.node_offset_words + node_index * TREE_NODE_WORDS;
}

fn tree_fail(status: u32) {
  tree_store(H_STATUS, TREE_FAIL_CLOSED | status);
}

fn tree_finite_vec3(value: vec3<f32>) -> bool {
  return ss_exact_near_finite(value.x)
    && ss_exact_near_finite(value.y)
    && ss_exact_near_finite(value.z);
}

@compute @workgroup_size(1)
fn initialize_exact_near_cell_tree() {
  if (tree_params.tree_depth > 30u) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  if (
    arrayLength(&exact_near_cell_tree) < tree_params.tree_word_capacity
    || tree_params.node_offset_words != TREE_HEADER_WORDS
    || tree_params.node_words != TREE_NODE_WORDS
    || tree_params.leaf_capacity == 0u
    || tree_params.node_capacity != tree_params.leaf_capacity * 2u - 1u
    || tree_params.leaf_capacity != (1u << tree_params.tree_depth)
    || tree_params.cell_capacity > tree_params.leaf_capacity
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  let directory_cell_count = spatial_directory[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (directory_cell_count == 0u || directory_cell_count > tree_params.cell_capacity) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_MAGIC, TREE_MAGIC);
  tree_store(H_VERSION, TREE_VERSION);
  tree_store(H_STATUS, 0u);
  tree_store(H_GENERATION, spatial_expectation.expected_generation_id);
  tree_store(H_DEVICE, spatial_expectation.expected_device_ordinal);
  tree_store(H_LANE, spatial_expectation.expected_lane_ordinal);
  tree_store(H_LEASE, spatial_expectation.expected_lease_token);
  tree_store(H_SOURCE_FAMILY, spatial_expectation.expected_source_family_id);
  tree_store(H_STORAGE, spatial_expectation.expected_storage_generation);
  tree_store(H_TICK, spatial_expectation.expected_physics_tick);
  tree_store(H_SUBSTEP, spatial_expectation.expected_physics_substep);
  tree_store(H_POSITION, spatial_expectation.expected_position_epoch);
  tree_store(H_TOPOLOGY, spatial_expectation.expected_topology_epoch);
  tree_store(H_CHART, spatial_expectation.expected_chart_epoch);
  tree_store(H_LEVEL, spatial_expectation.expected_level_epoch);
  tree_store(H_SUPPORT, spatial_expectation.expected_support_epoch);
  tree_store(H_SOURCE_COUNT, spatial_expectation.source_count);
  tree_store(H_SOURCE_CAPACITY, spatial_expectation.expected_source_capacity);
  tree_store(H_CELL_COUNT, directory_cell_count);
  tree_store(H_CELL_CAPACITY, tree_params.cell_capacity);
  tree_store(H_LEAF_CAPACITY, tree_params.leaf_capacity);
  tree_store(H_NODE_CAPACITY, tree_params.node_capacity);
  tree_store(H_NODE_OFFSET, tree_params.node_offset_words);
  tree_store(H_TREE_DEPTH, tree_params.tree_depth);
  tree_store(H_DIRECTORY_CAPACITY, spatial_expectation.expected_directory_capacity_words);
  tree_store(H_CELL_KEYS_OFFSET, spatial_expectation.expected_cell_keys_offset_words);
  tree_store(H_CELL_OFFSETS_OFFSET, spatial_expectation.expected_cell_offsets_offset_words);
  tree_store(H_CELL_MEMBERS_OFFSET, spatial_expectation.expected_cell_members_offset_words);
  tree_store(H_PARTICLE_TO_CELL_OFFSET, spatial_expectation.expected_particle_to_cell_offset_words);
  tree_store(H_DIRECTORY_COMPLETION, spatial_directory[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]);
  tree_store(H_ROOT_INDEX, 0u);
  tree_store(H_NODE_WORD_COUNT, TREE_NODE_WORDS);
}

@compute @workgroup_size(64)
fn build_exact_near_cell_tree_leaves(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let cell_index = global_id.x;
  if (tree_load(H_STATUS) != 0u || cell_index >= tree_load(H_CELL_COUNT)) {
    return;
  }
  let key_offset = spatial_expectation.expected_cell_keys_offset_words
    + cell_index * SS_EXACT_NEAR_KEY_WORDS;
  let offsets_offset = spatial_expectation.expected_cell_offsets_offset_words;
  let begin = spatial_directory[offsets_offset + cell_index];
  let end = spatial_directory[offsets_offset + cell_index + 1u];
  let level = i32(spatial_directory[key_offset + 1u] ^ 0x80000000u);
  let cell_coord = vec3<i32>(
    i32(spatial_directory[key_offset + 2u] ^ 0x80000000u),
    i32(spatial_directory[key_offset + 3u] ^ 0x80000000u),
    i32(spatial_directory[key_offset + 4u] ^ 0x80000000u)
  );
  let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
  let raw_cell_minimum = vec3<f32>(
    f32(cell_coord.x), f32(cell_coord.y), f32(cell_coord.z)
  );
  let raw_cell_maximum = raw_cell_minimum + vec3<f32>(1.0);
  let raw_minimum = raw_cell_minimum * spacing_m;
  let raw_maximum = raw_cell_maximum * spacing_m;
  // This is a spatial-index rounding envelope, not a law/material radius.
  // One cell covers ordinary rounding; the relative term keeps the leaf
  // conservative when an admitted i32 coordinate is too large for f32 to
  // represent adjacent cells exactly.
  let coordinate_magnitude = max(
    max(abs(raw_cell_minimum), abs(raw_cell_maximum)),
    vec3<f32>(1.0)
  );
  let halo_cells = vec3<f32>(2.0) + coordinate_magnitude * 0.000000476837158203125;
  let halo_m = halo_cells * spacing_m;
  let minimum = raw_minimum - halo_m;
  let maximum = raw_maximum + halo_m;
  if (
    begin >= end
    || end > spatial_expectation.source_count
    || !ss_exact_near_finite(spacing_m)
    || spacing_m <= 0.0
    || !tree_finite_vec3(minimum)
    || !tree_finite_vec3(maximum)
    || !all(minimum <= maximum)
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let node_index = tree_params.leaf_capacity - 1u + cell_index;
  if (node_index >= tree_params.node_capacity) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let base = tree_node_base(node_index);
  tree_store(base, bitcast<u32>(minimum.x));
  tree_store(base + 1u, bitcast<u32>(minimum.y));
  tree_store(base + 2u, bitcast<u32>(minimum.z));
  tree_store(base + 3u, bitcast<u32>(maximum.x));
  tree_store(base + 4u, bitcast<u32>(maximum.y));
  tree_store(base + 5u, bitcast<u32>(maximum.z));
  tree_store(base + 6u, TREE_NODE_VALID | TREE_NODE_LEAF);
  tree_store(base + 7u, cell_index);
  atomicAdd(&exact_near_cell_tree[H_LEAF_BUILD_COUNT], 1u);
}

@compute @workgroup_size(64)
fn reduce_exact_near_cell_tree_level(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let node_index = global_id.x;
  // The runtime binds this entry point once per complete-tree level.
  let level_start = tree_level.level_start;
  let level_count = tree_level.level_count;
  if (
    tree_load(H_STATUS) != 0u
    || node_index >= level_count
  ) {
    return;
  }
  let parent_index = level_start + node_index;
  let left_index = parent_index * 2u + 1u;
  let right_index = left_index + 1u;
  if (
    parent_index >= tree_params.node_capacity
    || right_index >= tree_params.node_capacity
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let left_base = tree_node_base(left_index);
  let right_base = tree_node_base(right_index);
  let left_status = tree_load(left_base + 6u);
  let right_status = tree_load(right_base + 6u);
  let left_valid = (left_status & TREE_NODE_VALID) != 0u;
  let right_valid = (right_status & TREE_NODE_VALID) != 0u;
  let parent_base = tree_node_base(parent_index);
  if (!left_valid && !right_valid) {
    tree_store(parent_base + 6u, 0u);
    tree_store(parent_base + 7u, TREE_INVALID_U32);
    return;
  }
  let left_minimum = vec3<f32>(
    bitcast<f32>(tree_load(left_base)),
    bitcast<f32>(tree_load(left_base + 1u)),
    bitcast<f32>(tree_load(left_base + 2u))
  );
  let left_maximum = vec3<f32>(
    bitcast<f32>(tree_load(left_base + 3u)),
    bitcast<f32>(tree_load(left_base + 4u)),
    bitcast<f32>(tree_load(left_base + 5u))
  );
  let right_minimum = vec3<f32>(
    bitcast<f32>(tree_load(right_base)),
    bitcast<f32>(tree_load(right_base + 1u)),
    bitcast<f32>(tree_load(right_base + 2u))
  );
  let right_maximum = vec3<f32>(
    bitcast<f32>(tree_load(right_base + 3u)),
    bitcast<f32>(tree_load(right_base + 4u)),
    bitcast<f32>(tree_load(right_base + 5u))
  );
  let minimum = select(
    right_minimum,
    select(left_minimum, min(left_minimum, right_minimum), right_valid),
    left_valid
  );
  let maximum = select(
    right_maximum,
    select(left_maximum, max(left_maximum, right_maximum), right_valid),
    left_valid
  );
  if (
    !tree_finite_vec3(minimum)
    || !tree_finite_vec3(maximum)
    || !all(minimum <= maximum)
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  tree_store(parent_base, bitcast<u32>(minimum.x));
  tree_store(parent_base + 1u, bitcast<u32>(minimum.y));
  tree_store(parent_base + 2u, bitcast<u32>(minimum.z));
  tree_store(parent_base + 3u, bitcast<u32>(maximum.x));
  tree_store(parent_base + 4u, bitcast<u32>(maximum.y));
  tree_store(parent_base + 5u, bitcast<u32>(maximum.z));
  tree_store(parent_base + 6u, TREE_NODE_VALID | TREE_NODE_INTERNAL);
  tree_store(parent_base + 7u, TREE_INVALID_U32);
}

@compute @workgroup_size(1)
fn finalize_exact_near_cell_tree() {
  let root_base = tree_node_base(0u);
  let root_status = tree_load(root_base + 6u);
  let expected_root_kind = select(
    TREE_NODE_VALID | TREE_NODE_INTERNAL,
    TREE_NODE_VALID | TREE_NODE_LEAF,
    tree_params.leaf_capacity == 1u
  );
  let valid_root = (root_status & (
    TREE_NODE_VALID | TREE_NODE_INTERNAL | TREE_NODE_LEAF
  )) == expected_root_kind;
  if (
    tree_load(H_STATUS) != 0u
    || tree_load(H_MAGIC) != TREE_MAGIC
    || tree_load(H_VERSION) != TREE_VERSION
    || tree_load(H_LEAF_BUILD_COUNT) != tree_load(H_CELL_COUNT)
    || tree_load(H_INVALID_NODE_COUNT) != 0u
    || !valid_root
  ) {
    tree_fail(TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_STATUS, TREE_READY | TREE_ADMITTED);
}
`;function je(){let e=Ae;return e=D(e,Ee,De,`embedded directory traversal`),e=e.replaceAll(`SchroederSpatialExactNearExpectationV1`,`SchroederSpatialExactNearExpectationV2`).replaceAll(`spatial_expectation.source_count`,`spatial_expectation.physical_source_count`).replaceAll(`spatial_expectation.expected_source_capacity`,`spatial_expectation.expected_physical_source_capacity`).replaceAll(`spatial_expectation.expected_particle_to_cell_offset_words`,`spatial_expectation.expected_physical_to_cell_plus_one_offset_words`),e=D(e,`const TREE_VERSION: u32 = 1u;`,`const TREE_VERSION: u32 = 2u;
const TREE_REVERSE_CELL_PLUS_ONE: u32 = 1u;`,`build tree ABI version`),e=D(e,`const H_NODE_WORD_COUNT: u32 = 33u;`,`const H_NODE_WORD_COUNT: u32 = 33u;
const H_ACTIVE_SOURCE_COUNT: u32 = 34u;
const H_REVERSE_ENCODING: u32 = 35u;`,`v2 header words`),e=D(e,`  tree_store(H_ROOT_INDEX, 0u);
  tree_store(H_NODE_WORD_COUNT, TREE_NODE_WORDS);`,`  tree_store(
    H_ROOT_INDEX,
    select(TREE_INVALID_U32, 0u, directory_cell_count > 0u)
  );
  tree_store(H_NODE_WORD_COUNT, TREE_NODE_WORDS);
  tree_store(
    H_ACTIVE_SOURCE_COUNT,
    spatial_directory[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
  );
  tree_store(H_REVERSE_ENCODING, TREE_REVERSE_CELL_PLUS_ONE);`,`v2 active and reverse header evidence`),e=D(e,`  if (directory_cell_count == 0u || directory_cell_count > tree_params.cell_capacity) {`,`  if (directory_cell_count > tree_params.cell_capacity) {`,`admitted empty directory`),e=D(e,`    begin >= end
    || end > spatial_expectation.physical_source_count`,`    begin >= end
    || end > tree_load(H_ACTIVE_SOURCE_COUNT)`,`active CSR leaf bound`),e=D(e,`  if (
    tree_load(H_STATUS) != 0u
    || tree_load(H_MAGIC) != TREE_MAGIC
    || tree_load(H_VERSION) != TREE_VERSION
    || tree_load(H_LEAF_BUILD_COUNT) != tree_load(H_CELL_COUNT)
    || tree_load(H_INVALID_NODE_COUNT) != 0u
    || !valid_root
  ) {
    tree_fail(TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_STATUS, TREE_READY | TREE_ADMITTED);`,`  if (
    tree_load(H_STATUS) != 0u
    || tree_load(H_MAGIC) != TREE_MAGIC
    || tree_load(H_VERSION) != TREE_VERSION
    || tree_load(H_LEAF_BUILD_COUNT) != tree_load(H_CELL_COUNT)
    || tree_load(H_INVALID_NODE_COUNT) != 0u
  ) {
    tree_fail(TREE_INVALID_SOURCE);
    return;
  }
  if (tree_load(H_CELL_COUNT) == 0u) {
    if (
      tree_load(H_ACTIVE_SOURCE_COUNT) != 0u
      || root_status != 0u
      || tree_load(H_ROOT_INDEX) != TREE_INVALID_U32
    ) {
      tree_fail(TREE_INVALID_SOURCE);
      return;
    }
    tree_store(H_STATUS, TREE_READY | TREE_ADMITTED);
    return;
  }
  if (!valid_root) {
    tree_fail(TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_STATUS, TREE_READY | TREE_ADMITTED);`,`empty tree finalization`),e}je(),78*Uint32Array.BYTES_PER_ELEMENT;const O=Object.freeze({PENDING:0,COMPLETE:1,CANONICAL_DECISION_REJECTED:2,CONTRACT_REJECTED:3}),Me=Object.freeze({PENDING:0,SAFE_PLACED:1,SAFE_FROZEN_FALLBACK:2,UNSAFE:3}),Ne=Object.freeze({PREFIX_SCAN_CAPACITY:1,ATOMIC_COUNTER:2,MOTION_BOUND_REJECTED:4,VOLUME_AUTHORITY:8,CONSERVATION_MOMENT:16}),Pe=Object.freeze(`magic:u32.version:u32.generationId:u32.supportProfileId:u32.eventCapacity:u32.compactCountPassCount:u32.compactScanPassCount:u32.compactScatterPassCount:u32.activeEventCount:u32.compactionInputVisitCount:u32.compactionLiveFlagCount:u32.compactionOverflowCount:u32.envelopePartialPassCount:u32.envelopeFinalizePassCount:u32.envelopeInputVisitCount:u32.envelopeAdmitted:u32.classifierPassCount:u32.classifierReadyCount:u32.classifierRejectedCount:u32.classifierUnknownCount:u32.ssCellVisitCount:u32.ssMemberVisitCount:u32.ssMaterialPhaseFilterCount:u32.ssCaptureHitCount:u32.spareFlagPassCount:u32.spareScanPassCount:u32.spareAssignPassCount:u32.spareCandidateVisitCount:u32.spareAvailableCount:u32.spareAssignedCount:u32.applyPassCount:u32.applyVisitedCount:u32.directOnlyEventCount:u32.sparePlacementEventCount:u32.captureMergeEventCount:u32.fallbackEventCount:u32.subthresholdEventCount:u32.noCarrierEventCount:u32.rejectedEventCount:u32.unknownDispositionCount:u32.serialConflictFoldPassCount:u32.serialConflictFoldEventCount:u32.maxSerialConflictFoldSize:u32.mutationConflictRetryCount:u32.privateLookupBuildCount:u32.exhaustiveTraversalCount:u32.overflowFlags:u32.status:u32.applyPreflightPassCount:u32.intentEmitPassCount:u32.mutationIntentCapacity:u32.mutationIntentCount:u32.destinationRadixPassCount:u32.destinationSegmentReducePassCount:u32.destinationApplyPassCount:u32.destinationIntentVisitedCount:u32.destinationMutationCount:u32.maxDestinationSegmentSize:u32.summaryRadixPassCount:u32.summarySegmentReducePassCount:u32.summaryApplyPassCount:u32.summaryContributionCount:u32.globalSerialEventFoldCount:u32.hostCompletionReadbackCount:u32.transactionalPublishPassCount:u32.transactionalVisitedParticleCount:u32.transactionalCommittedParticleCount:u32.transactionalFallbackParticleCount:u32.transactionalEventPublishPassCount:u32.transactionalVisitedEventRowCount:u32.transactionalCommittedEventRowCount:u32.transactionalFallbackEventRowCount:u32.transactionalSummaryPublishPassCount:u32.transactionalVisitedSummaryRowCount:u32.transactionalCommittedSummaryRowCount:u32.transactionalFallbackSummaryRowCount:u32.transactionalTerminalSealPassCount:u32.transactionalTerminalStatus:u32`.split(`.`)),k=Object.freeze(Object.fromEntries(Pe.map((e,t)=>[e.slice(0,e.indexOf(`:`)),t])));16*Uint32Array.BYTES_PER_ELEMENT,16*Uint32Array.BYTES_PER_ELEMENT;const Fe=Object.freeze({READY:1,BLOCKED:2,FAIL_CLOSED:4}),Ie=Object.freeze([`magic:u32`,`version:u32`,`statusFlags:u32`,`blockerFlags:u32`,`sourceGeneration:u32`,`completionGeneration:u32`,`seal:u32`,`reactionCount:u32`,`atomTermCount:u32`,`atomResidualCapacity:u32`,`atomTermCapacity:u32`,`atomResidualStrideVec4:u32`,`atomTermStrideVec4:u32`,`producerSequence:u32`,`shadowPlaneWordCount:u32`,`shadowLogicalWordCount:u32`]),A=Object.freeze(Object.fromEntries(Ie.map((e,t)=>[e.slice(0,e.indexOf(`:`)),t]))),Le=Object.freeze([`magic:u32`,`version:u32`,`statusFlags:u32`,`blockerFlags:u32`,`sourceGeneration:u32`,`completionGeneration:u32`,`seal:u32`,`reactionCount:u32`,`atomTermCount:u32`,`readyRowCount:u32`,`problemRowCount:u32`,`maxAbsAtomResidualMol:f32-bits`,`maxAbsChargeResidualMol:f32-bits`,`atomResidualToleranceMol:f32-bits`,`chargeResidualToleranceMol:f32-bits`,`staticBlockerFlags:u32`]),j=Object.freeze(Object.fromEntries(Le.map((e,t)=>[e.slice(0,e.indexOf(`:`)),t]))),Re=Object.freeze([`reactionCount:u32`,`atomTermCount:u32`,`atomResidualCapacity:u32`,`atomTermCapacity:u32`,`expectedSourceGeneration:u32`,`expectedCompletionGeneration:u32`,`expectedSeal:u32`,`staticBlockerFlags:u32`,`atomResidualToleranceMol:f32-bits`,`chargeResidualToleranceMol:f32-bits`,`atomResidualStrideVec4:u32`,`atomTermStrideVec4:u32`,`gateWordCount:u32`,`expectedGateVersion:u32`,`producerReceiptWordCount:u32`,`expectedProducerReceiptVersion:u32`]);Object.freeze(Object.fromEntries(Re.map((e,t)=>[e.slice(0,e.indexOf(`:`)),t]))),16*Uint32Array.BYTES_PER_ELEMENT;const ze=Object.freeze({INITIALIZED:1,EVIDENCE_COMPLETE:2,FINALIZED:4,PASS:8,BLOCKED:16,FAIL_CLOSED:32}),M=Object.freeze({MISSING_EVIDENCE:1,PROBLEM_ROW:2,NONFINITE_EVIDENCE:4,ATOM_RESIDUAL_OUT_OF_TOLERANCE:8,CHARGE_RESIDUAL_OUT_OF_TOLERANCE:16,GENERATION_MISMATCH:32,SEAL_MISMATCH:64,PROVISIONAL_ENERGETICS:128,ATOM_BALANCE_UNPROVEN:256,CHARGE_BALANCE_UNPROVEN:512,STATIC_INPUT_INVALID:1024,LAYOUT_MISMATCH:2048,BITWISE_SHADOW_MISMATCH:4096}),Be=(M.PROVISIONAL_ENERGETICS|M.ATOM_BALANCE_UNPROVEN|M.CHARGE_BALANCE_UNPROVEN|M.STATIC_INPUT_INVALID)>>>0;Object.values(ze).reduce((e,t)=>e|t,0)>>>0,Object.values(M).reduce((e,t)=>e|t,0)>>>0,`${Fe.READY}${ze.INITIALIZED}${ze.EVIDENCE_COMPLETE}${ze.FINALIZED}${ze.PASS}${ze.BLOCKED}${ze.FAIL_CLOSED}${M.MISSING_EVIDENCE}${M.PROBLEM_ROW}${M.NONFINITE_EVIDENCE}${M.ATOM_RESIDUAL_OUT_OF_TOLERANCE}${M.CHARGE_RESIDUAL_OUT_OF_TOLERANCE}${M.GENERATION_MISMATCH}${M.SEAL_MISMATCH}${M.STATIC_INPUT_INVALID}${M.LAYOUT_MISMATCH}${M.BITWISE_SHADOW_MISMATCH}${Be}${A.sourceGeneration}${A.completionGeneration}${A.seal}${A.shadowPlaneWordCount}${A.shadowLogicalWordCount}${j.magic}${j.version}${j.statusFlags}${j.blockerFlags}${j.sourceGeneration}${j.completionGeneration}${j.seal}${j.reactionCount}${j.atomTermCount}${j.atomResidualToleranceMol}${j.chargeResidualToleranceMol}${A.magic}${A.version}${A.statusFlags}${A.blockerFlags}${A.reactionCount}${A.atomTermCount}${A.atomResidualCapacity}${A.atomTermCapacity}${A.atomResidualStrideVec4}${A.atomTermStrideVec4}${A.producerSequence}${j.readyRowCount}${j.problemRowCount}${j.maxAbsAtomResidualMol}${j.maxAbsChargeResidualMol}${j.staticBlockerFlags}${j.blockerFlags}${j.statusFlags}`,Object.freeze({schema:`peercompute.ulg.sph-reaction-product-placement-law.v5`,mutationOrder:`stable-event-plan-then-conserving-capture-segment-reduction-then-disjoint-direct-pair-hyperedges`,captureReductionOrder:`stable-radix-equal-key-order-hillis-steele-fixed-binary-topology`,captureEnergyLaw:`mass-momentum-total-energy-reduction-with-relative-kinetic-energy-thermalization`,directPairSelection:`stable-last-admitted-product-event-per-disjoint-reacting-pair`,deliberateChangeFromV4:`event support volume remains routing geometry while newly materialized product mass is born at target reference density with J=1`}),`${k.status}${O.PENDING}${k.transactionalTerminalStatus}${Me.PENDING}${k.applyPreflightPassCount}${k.serialConflictFoldPassCount}${k.serialConflictFoldEventCount}${k.maxSerialConflictFoldSize}${k.globalSerialEventFoldCount}${k.status}${O.CONTRACT_REJECTED}${k.compactCountPassCount}${k.compactScanPassCount}${k.compactScatterPassCount}${k.activeEventCount}${k.compactionOverflowCount}${k.envelopePartialPassCount}${k.envelopeFinalizePassCount}${k.envelopeInputVisitCount}${k.envelopeAdmitted}${k.classifierPassCount}${k.spareFlagPassCount}${k.spareScanPassCount}${k.spareAssignPassCount}${k.overflowFlags}${k.classifierReadyCount}${k.classifierRejectedCount}${k.classifierUnknownCount}${k.status}${O.CONTRACT_REJECTED}${k.classifierUnknownCount}${k.status}${O.CANONICAL_DECISION_REJECTED}`,`${k.intentEmitPassCount}${k.applyPassCount}${k.mutationIntentCapacity}${k.activeEventCount}${k.summaryContributionCount}${k.applyVisitedCount}${k.rejectedEventCount}${k.directOnlyEventCount}${k.subthresholdEventCount}${k.noCarrierEventCount}${k.captureMergeEventCount}${k.mutationIntentCount}${k.unknownDispositionCount}${k.sparePlacementEventCount}${k.mutationIntentCount}${k.overflowFlags}${Ne.VOLUME_AUTHORITY}${k.destinationMutationCount}${k.maxDestinationSegmentSize}`,`${k.destinationApplyPassCount}${k.destinationIntentVisitedCount}${k.overflowFlags}${Ne.CONSERVATION_MOMENT}${k.overflowFlags}${Ne.CONSERVATION_MOMENT}${k.overflowFlags}${Ne.CONSERVATION_MOMENT}${k.destinationMutationCount}${k.maxDestinationSegmentSize}`,`${k.mutationIntentCount}`,`${k.destinationApplyPassCount}${k.mutationConflictRetryCount}${k.overflowFlags}${Ne.VOLUME_AUTHORITY}${k.overflowFlags}${Ne.VOLUME_AUTHORITY}${k.destinationMutationCount}${k.maxDestinationSegmentSize}`,`${k.summaryApplyPassCount}`,`${k.directOnlyEventCount}${k.sparePlacementEventCount}${k.captureMergeEventCount}${k.fallbackEventCount}${k.subthresholdEventCount}${k.noCarrierEventCount}${k.rejectedEventCount}${k.unknownDispositionCount}${k.classifierReadyCount}${k.classifierRejectedCount}${k.classifierUnknownCount}${k.mutationIntentCount}${k.magic}${k.version}${k.generationId}${k.supportProfileId}${k.eventCapacity}${k.compactCountPassCount}${k.compactScanPassCount}${k.compactScatterPassCount}${k.activeEventCount}${k.compactionInputVisitCount}${k.compactionLiveFlagCount}${k.compactionOverflowCount}${k.envelopePartialPassCount}${k.envelopeFinalizePassCount}${k.envelopeInputVisitCount}${k.envelopeAdmitted}${k.classifierPassCount}${k.classifierRejectedCount}${k.classifierUnknownCount}${k.ssCellVisitCount}${k.ssMemberVisitCount}${k.ssMaterialPhaseFilterCount}${k.ssMemberVisitCount}${k.ssCaptureHitCount}${k.ssMemberVisitCount}${k.ssCaptureHitCount}${k.classifierReadyCount}${k.spareFlagPassCount}${k.spareScanPassCount}${k.spareAssignPassCount}${k.spareCandidateVisitCount}${k.spareAssignedCount}${k.spareAvailableCount}${k.applyPreflightPassCount}${k.intentEmitPassCount}${k.applyPassCount}${k.applyVisitedCount}${k.captureMergeEventCount}${k.ssCaptureHitCount}${k.sparePlacementEventCount}${k.spareAssignedCount}${k.fallbackEventCount}${k.noCarrierEventCount}${k.rejectedEventCount}${k.unknownDispositionCount}${k.serialConflictFoldPassCount}${k.serialConflictFoldEventCount}${k.maxSerialConflictFoldSize}${k.globalSerialEventFoldCount}${k.privateLookupBuildCount}${k.exhaustiveTraversalCount}${k.overflowFlags}${k.mutationIntentCapacity}${k.mutationIntentCapacity}${k.destinationRadixPassCount}${k.destinationSegmentReducePassCount}${k.destinationApplyPassCount}${k.destinationIntentVisitedCount}${k.destinationMutationCount}${k.maxDestinationSegmentSize}${k.summaryRadixPassCount}${k.summarySegmentReducePassCount}${k.summaryApplyPassCount}${k.summaryContributionCount}${k.status}${O.CONTRACT_REJECTED}${O.COMPLETE}`,`${k.transactionalPublishPassCount}${k.status}${O.COMPLETE}${k.transactionalCommittedParticleCount}${k.transactionalFallbackParticleCount}${k.transactionalVisitedParticleCount}`,`${k.transactionalEventPublishPassCount}${k.transactionalSummaryPublishPassCount}${k.status}${O.COMPLETE}${k.transactionalCommittedEventRowCount}${k.transactionalFallbackEventRowCount}${k.transactionalVisitedEventRowCount}${k.transactionalCommittedSummaryRowCount}${k.transactionalFallbackSummaryRowCount}${k.transactionalVisitedSummaryRowCount}`,`${k.transactionalTerminalSealPassCount}${k.transactionalPublishPassCount}${k.transactionalVisitedParticleCount}${k.transactionalEventPublishPassCount}${k.transactionalVisitedEventRowCount}${k.transactionalSummaryPublishPassCount}${k.transactionalVisitedSummaryRowCount}${k.status}${O.COMPLETE}${k.transactionalCommittedParticleCount}${k.transactionalFallbackParticleCount}${k.transactionalCommittedEventRowCount}${k.transactionalFallbackEventRowCount}${k.transactionalCommittedSummaryRowCount}${k.transactionalFallbackSummaryRowCount}${O.CANONICAL_DECISION_REJECTED}${O.CONTRACT_REJECTED}${k.transactionalCommittedParticleCount}${k.transactionalFallbackParticleCount}${k.transactionalCommittedEventRowCount}${k.transactionalFallbackEventRowCount}${k.transactionalCommittedSummaryRowCount}${k.transactionalFallbackSummaryRowCount}${Me.UNSAFE}${Me.SAFE_PLACED}${Me.SAFE_FROZEN_FALLBACK}${k.transactionalTerminalStatus}`,`${k.transactionalTerminalStatus}${Me.SAFE_PLACED}`,`${k.transactionalTerminalStatus}${Me.SAFE_PLACED}`;const Ve=`

struct TensorDescriptor {
  offset_words: u32,
  length_words: u32,
  dtype: u32,
  tensor_layout: u32,
};

struct ClosureTableSample {
  axis: f32,
  value: f32,
  derivative: f32,
  _pad0: f32,
};

fn complex64_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

fn complex64_norm2(value: vec2<f32>) -> f32 {
  return dot(value, value);
}


struct CarrierBody {
  x: f32,
  v: f32,
  mass: f32,
  _pad0: f32,
};

struct ClosureLawGraphNode {
  op_id: f32,
  input_slot: f32,
  output_slot: f32,
  derivative_slot: f32,
  sample_offset: f32,
  sample_count: f32,
  domain_min: f32,
  domain_max: f32,
  edge_offset: f32,
  edge_count: f32,
  interpolation_id: f32,
  status_flag_id: f32,
  provenance_index: f32,
  material_id: f32,
  phase_id: f32,
  _pad0: f32,
};

struct ClosureLawGraphSlot {
  value: f32,
  derivative: f32,
  status: f32,
  _pad0: f32,
};

struct ClosureLawGraphStatus {
  node_id: f32,
  status: f32,
  observed_input: f32,
  limit: f32,
};

struct CarrierGraphParams {
  dt: f32,
  node_count: u32,
  slot_count: u32,
  status_count: u32,
  step: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> bodies: array<CarrierBody>;
@group(0) @binding(1) var<storage, read> graph_nodes: array<ClosureLawGraphNode>;
@group(0) @binding(2) var<storage, read> graph_samples: array<ClosureTableSample>;
@group(0) @binding(3) var<storage, read_write> graph_slots: array<ClosureLawGraphSlot>;
@group(0) @binding(4) var<storage, read_write> graph_status: array<ClosureLawGraphStatus>;
@group(0) @binding(5) var<uniform> params: CarrierGraphParams;

fn graph_u32(value: f32) -> u32 {
  return u32(max(value, 0.0));
}

fn write_graph_status(node_index: u32, status: f32, observed_input: f32, limit: f32) {
  if (node_index >= params.status_count) {
    return;
  }
  graph_status[node_index].node_id = f32(node_index);
  graph_status[node_index].status = status;
  graph_status[node_index].observed_input = observed_input;
  graph_status[node_index].limit = limit;
}

fn sample_graph_table(node: ClosureLawGraphNode, x: f32) -> vec2<f32> {
  let offset = graph_u32(node.sample_offset);
  let count = graph_u32(node.sample_count);
  var left_index = offset;
  var right_index = offset + count - 1u;
  for (var index = offset; index + 1u < offset + count; index = index + 1u) {
    let left_axis = graph_samples[index].axis;
    let right_axis = graph_samples[index + 1u].axis;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = graph_samples[left_index];
  let right = graph_samples[right_index];
  if (right.axis == left.axis) {
    return vec2<f32>(left.value, left.derivative);
  }
  let t = clamp((x - left.axis) / (right.axis - left.axis), 0.0, 1.0);
  return vec2<f32>(
    left.value + t * (right.value - left.value),
    left.derivative + t * (right.derivative - left.derivative)
  );
}

fn evaluate_derivative_from_graph(r: f32) -> f32 {
  if (params.node_count == 0u) {
    return 0.0;
  }
  let node = graph_nodes[0u];
  let input_slot = graph_u32(node.input_slot);
  let output_slot = graph_u32(node.output_slot);
  let derivative_slot = graph_u32(node.derivative_slot);
  if (node.op_id != 1.0 || input_slot >= params.slot_count || output_slot >= params.slot_count || derivative_slot >= params.slot_count) {
    write_graph_status(0u, 4.0, node.op_id, 0.0);
    return 0.0;
  }
  graph_slots[input_slot].value = r;
  graph_slots[input_slot].status = 1.0;
  if (r < node.domain_min) {
    graph_slots[output_slot].status = 2.0;
    graph_slots[derivative_slot].status = 2.0;
    write_graph_status(0u, 2.0, r, node.domain_min);
    return 0.0;
  }
  if (r > node.domain_max) {
    graph_slots[output_slot].status = 3.0;
    graph_slots[derivative_slot].status = 3.0;
    write_graph_status(0u, 3.0, r, node.domain_max);
    return 0.0;
  }
  let sampled = sample_graph_table(node, r);
  graph_slots[output_slot].value = sampled.x;
  graph_slots[output_slot].derivative = sampled.y;
  graph_slots[output_slot].status = 1.0;
  graph_slots[derivative_slot].value = sampled.y;
  graph_slots[derivative_slot].status = 1.0;
  write_graph_status(0u, 1.0, r, 0.0);
  return sampled.y;
}

fn pair_forces(left_x: f32, right_x: f32) -> vec2<f32> {
  let dx = right_x - left_x;
  let r = abs(dx);
  var direction = 1.0;
  if (dx < 0.0) {
    direction = -1.0;
  }
  let dEdr = evaluate_derivative_from_graph(r);
  return vec2<f32>(dEdr * direction, -dEdr * direction);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  let dt = params.dt;
  let first = pair_forces(bodies[0].x, bodies[1].x);
  var left_v = bodies[0].v + 0.5 * (first.x / bodies[0].mass) * dt;
  var right_v = bodies[1].v + 0.5 * (first.y / bodies[1].mass) * dt;
  bodies[0].x = bodies[0].x + left_v * dt;
  bodies[1].x = bodies[1].x + right_v * dt;
  let second = pair_forces(bodies[0].x, bodies[1].x);
  left_v = left_v + 0.5 * (second.x / bodies[0].mass) * dt;
  right_v = right_v + 0.5 * (second.y / bodies[1].mass) * dt;
  bodies[0].v = left_v;
  bodies[1].v = right_v;
}
`,He=`
struct ThermalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  material_bank_warm_input_row_count: u32,
  dt: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  wall_rate: f32,
  wall_layer_m: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  wall_x_min_k: f32,
  wall_x_max_k: f32,
  wall_y_min_k: f32,
  wall_y_max_k: f32,
  wall_z_min_k: f32,
  wall_z_max_k: f32,
  bins_enabled: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_size_m: f32,
  max_pair_support_m: f32,
  ambient_temperature_k: f32,
  _pad_b: f32,
  ambient_radiation_exchange_enabled: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> params: ThermalParams;
@group(0) @binding(9) var<storage, read> material_bank_warm_input_rows: array<vec4<f32>>;
// Shared per-substep neighbor bins (built by the separation bin-fill pass):
// counts prefix [0, cell_count) then entry slots. When bins_enabled == 0
// (standalone/legacy paths) the kernel falls back to the exhaustive pair
// scan and a tiny placeholder buffer is bound.
@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;

const PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return sph_state[index * 2u];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return sph_state[index * 2u + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 1u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 2u];
}

fn response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn response_row2(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 2u];
}

fn response_row3(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 3u];
}

fn graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn sample_temperature_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return left.y;
  }
  let t = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + t * (right.y - left.y);
}

fn temperature_slope_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return 0.0;
  }
  return (right.y - left.y) / (right.x - left.x);
}

fn thermal_carrier_phase_classification(
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> vec2<u32> {
  let epsilon = 1.0e-6;
  let fraction_sum = phase_fractions.x + phase_fractions.y
    + phase_fractions.z + phase_fractions.w;
  let valid = all(phase_fractions >= vec4<f32>(0.0))
    && all(phase_fractions <= vec4<f32>(1.0 + epsilon))
    && abs(fraction_sum - 1.0) <= epsilon;
  var positive_count = 0u;
  if (phase_fractions.x > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.y > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.z > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.w > 0.0) { positive_count = positive_count + 1u; }
  let carrier_phase = u32(clamp(round(phase_id), 0.0, 4.0));
  var pure_phase = 0u;
  if (valid && positive_count == 1u) {
    if (carrier_phase == 1u && abs(phase_fractions.x - 1.0) <= epsilon) {
      pure_phase = 1u;
    } else if (carrier_phase == 2u && abs(phase_fractions.y - 1.0) <= epsilon) {
      pure_phase = 2u;
    } else if (carrier_phase == 3u && abs(phase_fractions.z - 1.0) <= epsilon) {
      pure_phase = 3u;
    } else if (carrier_phase == 4u && abs(phase_fractions.w - 1.0) <= epsilon) {
      pure_phase = 4u;
    }
  }
  return vec2<u32>(pure_phase, select(0u, 1u, valid && positive_count >= 2u));
}

fn thermal_temperature_slope(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> f32 {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    return 0.0;
  }

  let classification = thermal_carrier_phase_classification(phase_id, phase_fractions);
  var fallback = material_response_offset;
  var fallback_found = false;
  var containing = 0xffffffffu;
  var mixed_plateau = 0xffffffffu;
  var pure_phase_response = 0xffffffffu;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    if (candidate >= params.response_count) { return 0.0; }
    let row0 = response_row0(candidate);
    let row1 = response_row1(candidate);
    if (!fallback_found) {
      fallback = candidate;
      if (specific_internal_energy <= row1.y || local + 1u == material_response_count) {
        fallback_found = true;
      }
    }
    if (specific_internal_energy >= row1.x && specific_internal_energy <= row1.y) {
      if (containing == 0xffffffffu) { containing = candidate; }
      let phase_from = u32(clamp(round(row1.z), 0.0, 4.0));
      let phase_to = u32(clamp(round(row1.w), 0.0, 4.0));
      if (
        classification.x != 0u
        && phase_from == classification.x
        && phase_to == classification.x
      ) {
        pure_phase_response = candidate;
      }
      if (classification.y == 1u && abs(row0.y - 2.0) < 0.5) {
        mixed_plateau = candidate;
      }
    }
  }

  var selected = fallback;
  if (containing != 0xffffffffu) { selected = containing; }
  if (mixed_plateau != 0xffffffffu) { selected = mixed_plateau; }
  if (pure_phase_response != 0xffffffffu) { selected = pure_phase_response; }
  let response0 = response_row0(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    return 0.0;
  }
  return temperature_slope_from_graph(u32(response0.z), specific_internal_energy);
}

fn thermal_value_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

// Resolve the finite response-energy interval that contains the live carrier.
// At an exact shared knot every adjacent containing interval participates, so
// the carrier can move in either physically valid direction without a
// phase-label-dependent deadlock. Missing or malformed response data fails
// closed with status 0.
fn thermal_carrier_energy_domain(
  material_id: f32,
  specific_internal_energy: f32
) -> vec4<f32> {
  if (!thermal_value_finite(specific_internal_energy)) {
    return vec4<f32>(0.0);
  }
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      if (record.w != 1.0 || record.y < 0.0 || record.z <= 0.0) {
        return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
      }
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }
  if (!found_material || material_response_count == 0u) {
    return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
  }

  var energy_lo = 3.402823466e+38;
  var energy_hi = -3.402823466e+38;
  var containing_count = 0u;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    if (candidate >= params.response_count) {
      return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
    }
    let response0 = response_row0(candidate);
    let response1 = response_row1(candidate);
    if (
      response0.x != material_id
      || response0.w != 1.0
      || !thermal_value_finite(response1.x)
      || !thermal_value_finite(response1.y)
      || response1.x > response1.y
    ) {
      return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
    }
    if (
      specific_internal_energy >= response1.x
      && specific_internal_energy <= response1.y
    ) {
      energy_lo = min(energy_lo, response1.x);
      energy_hi = max(energy_hi, response1.y);
      containing_count = containing_count + 1u;
    }
  }
  if (containing_count == 0u || energy_lo > energy_hi) {
    return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
  }
  return vec4<f32>(energy_lo, energy_hi, 1.0, f32(containing_count));
}

fn clamp_du_to_energy_domain(
  d_u_specific: f32,
  current_u: f32,
  energy_lo: f32,
  energy_hi: f32
) -> f32 {
  if (
    !thermal_value_finite(d_u_specific)
    || !thermal_value_finite(current_u)
    || !thermal_value_finite(energy_lo)
    || !thermal_value_finite(energy_hi)
    || energy_lo > current_u
    || energy_hi < current_u
    || energy_lo > energy_hi
  ) {
    return 0.0;
  }
  return clamp(d_u_specific, energy_lo - current_u, energy_hi - current_u);
}

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  // Non-authoritative warm-input presence probe. The value is intentionally
  // zeroed so closure-derived thermal graphs remain the only thermal source.
  return material_bank_warm_input_rows[0u].x * 0.0;
}

const STEFAN_BOLTZMANN_W_PER_M2_K4: f32 = 5.670374419e-8;
// Pair radiation is truncated where the disc-to-disc view factor falls below
// ~0.4% (d > 4*(r_i+r_j)); beyond that range the ambient term is the
// aggregate radiative sink/source.
const RADIATION_PAIR_RANGE_RADII: f32 = 4.0;

fn pow4(x: f32) -> f32 {
  let x2 = x * x;
  return x2 * x2;
}

// Gray-body emissivity for the material, packed at table build into the
// phase-response record's second vec4 (Kirchhoff: absorptivity from the
// derived optical closure). Unknown materials return 0 - no radiation is the
// fail-safe for a material without a derived absorption response.
fn thermal_emissivity(material_id: f32) -> f32 {
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      return clamp(phase_response_records[record_index * 2u + 1u].x, 0.0, 1.0);
    }
  }
  return 0.0;
}

// Exchange area between two particles modelled as discs: the emitter's disc
// pi*r_i^2 scaled by the solid-angle fraction of the receiver r_j^2/(4 d^2).
// Symmetric in (i, j), so gather-side pair exchange conserves energy. Capped
// at the parallel-plate contact limit pi*min(r_i, r_j)^2 (view factor F = 1
// across the smaller face) so contact-range radiation never exceeds the
// closed-form two-plate bound.
fn radiative_view_area_m2(r_i: f32, r_j: f32, distance_m: f32) -> f32 {
  if (r_i <= 0.0 || r_j <= 0.0) {
    return 0.0;
  }
  let d2 = max(distance_m * distance_m, 1.0e-12);
  let geometric = 3.14159265359 * r_i * r_i * (r_j * r_j) / (4.0 * d2);
  let contact_limit = 3.14159265359 * min(r_i, r_j) * min(r_i, r_j);
  return min(geometric, contact_limit);
}

fn clamp_wall_du_specific(d_u_specific: f32, temperature_k: f32, wall_temperature_k: f32, temperature_slope: f32) -> f32 {
  if (temperature_slope <= 0.0) {
    return d_u_specific;
  }
  let next_temperature_k = temperature_k + d_u_specific * temperature_slope;
  let crosses_cold_wall = temperature_k > wall_temperature_k && next_temperature_k < wall_temperature_k;
  let crosses_hot_wall = temperature_k < wall_temperature_k && next_temperature_k > wall_temperature_k;
  if (crosses_cold_wall || crosses_hot_wall) {
    return (wall_temperature_k - temperature_k) / temperature_slope;
  }
  return d_u_specific;
}

// Conduction requires contact. The global support 2h is derived from the
// condensed-phase spacing; coarse low-density particles (gases) are
// physically larger than h — a particle of mass m at rest density rho
// occupies a nominal radius r = (3m/(4*pi*rho))^(1/3). A pair conducts when
// closer than max(2h, r_i + r_j). The pair support is symmetric in (i, j),
// so gather-side energy exchange stays pairwise-consistent.
fn particle_nominal_radius_m(mass_kg: f32, rest_density_kg_per_m3: f32) -> f32 {
  if (mass_kg <= 0.0 || rest_density_kg_per_m3 <= 0.0) {
    return 0.0;
  }
  return pow(0.238732414637843 * mass_kg / rest_density_kg_per_m3, 1.0 / 3.0);
}

fn clamp_pair_conduction_energy(
  d_e: f32,
  temperature_k: f32,
  other_temperature_k: f32,
  temperature_slope: f32,
  other_temperature_slope: f32,
  mass_kg: f32,
  other_mass_kg: f32
) -> f32 {
  if (d_e == 0.0) {
    return 0.0;
  }
  let gap_k = other_temperature_k - temperature_k;
  if (gap_k == 0.0 || sign(d_e) != sign(gap_k)) {
    return d_e;
  }
  let response_per_j = temperature_slope / max(mass_kg, 1.0e-30)
    + other_temperature_slope / max(other_mass_kg, 1.0e-30);
  if (response_per_j <= 0.0) {
    return d_e;
  }
  let equalizing_energy_j = abs(gap_k) / response_per_j;
  let limit_j = equalizing_energy_j * PAIR_CONDUCTION_RELAXATION_LIMIT;
  return sign(d_e) * min(abs(d_e), limit_j);
}

fn clamp_du_to_temperature_range(
  d_u_specific: f32,
  temperature_k: f32,
  temperature_slope: f32,
  min_temperature_k: f32,
  max_temperature_k: f32
) -> f32 {
  if (temperature_slope <= 0.0 || d_u_specific == 0.0) {
    return d_u_specific;
  }
  let next_temperature_k = temperature_k + d_u_specific * temperature_slope;
  if (next_temperature_k < min_temperature_k) {
    return (min_temperature_k - temperature_k) / temperature_slope;
  }
  if (next_temperature_k > max_temperature_k) {
    return (max_temperature_k - temperature_k) / temperature_slope;
  }
  return d_u_specific;
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn write_thermal_state(index: u32, material_id: f32, next_u: f32, source_row1: vec4<f32>, source_row2: vec4<f32>) {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w);
    return;
  }

  var selected = material_response_offset;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  let response1 = response_row1(selected);
  let response2 = response_row2(selected);
  let response3 = response_row3(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w);
    return;
  }
  let denom = max(response1.y - response1.x, 1.0e-12);
  let alpha = clamp((next_u - response1.x) / denom, 0.0, 1.0);
  let temperature_k = sample_temperature_from_graph(u32(response0.z), next_u);
  let from_fraction = clamp(response3.x * alpha + response3.y, 0.0, 1.0);
  let to_fraction = clamp(response3.z * alpha + response3.w, 0.0, 1.0);
  let solid = phase_fraction(response1.z, from_fraction, 0.0, 0.0, 0.0)
    + phase_fraction(response1.w, to_fraction, 0.0, 0.0, 0.0);
  let liquid = phase_fraction(response1.z, 0.0, from_fraction, 0.0, 0.0)
    + phase_fraction(response1.w, 0.0, to_fraction, 0.0, 0.0);
  let gas = phase_fraction(response1.z, 0.0, 0.0, from_fraction, 0.0)
    + phase_fraction(response1.w, 0.0, 0.0, to_fraction, 0.0);
  let plasma = phase_fraction(response1.z, 0.0, 0.0, 0.0, from_fraction)
    + phase_fraction(response1.w, 0.0, 0.0, 0.0, to_fraction);
  var phase_id = response1.z;
  var rest_density = response2.x;
  if (response0.y == 2.0 && alpha >= 0.5 && response2.w == 1.0) {
    phase_id = response1.w;
  }
  if (response0.y == 2.0 && alpha >= 0.5 && response2.z == 1.0) {
    rest_density = response2.y;
  }

  out_sph_thermo[index * 3u] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
  out_sph_thermo[index * 3u + 1u] = vec4<f32>(solid, liquid, gas, plasma);
  out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 1.0, source_row2.w);
}

fn wall_temperature(face_index: u32) -> f32 {
  if (face_index == 0u) { return params.wall_x_min_k; }
  if (face_index == 1u) { return params.wall_x_max_k; }
  if (face_index == 2u) { return params.wall_y_min_k; }
  if (face_index == 3u) { return params.wall_y_max_k; }
  if (face_index == 4u) { return params.wall_z_min_k; }
  return params.wall_z_max_k;
}

fn wall_distance(position: vec3<f32>, face_index: u32) -> f32 {
  if (face_index == 0u) { return position.x; }
  if (face_index == 1u) { return params.box_x - position.x; }
  if (face_index == 2u) { return position.y; }
  if (face_index == 3u) { return params.box_y - position.y; }
  if (face_index == 4u) { return position.z; }
  return params.box_z - position.z;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = state_pos_mass(particle_index);
  let vel_u = state_vel_u(particle_index);
  let row0 = thermo_row0(particle_index);
  let row1 = thermo_row1(particle_index);
  let row2 = thermo_row2(particle_index);
  if (!(pos_mass.w > 0.0)) {
    out_sph_state[particle_index * 2u] = pos_mass;
    out_sph_state[particle_index * 2u + 1u] = vel_u;
    out_sph_thermo[particle_index * 3u] = row0;
    out_sph_thermo[particle_index * 3u + 1u] = row1;
    out_sph_thermo[particle_index * 3u + 2u] = row2;
    return;
  }
  let position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z);
  let mass = max(pos_mass.w, 1.0e-30);
  let temperature = row0.z;
	  let carrier_domain = thermal_carrier_energy_domain(row0.x, vel_u.w);
	  let carrier_domain_ready = carrier_domain.z == 1.0;
	  var carrier_u_lo = vel_u.w;
	  var carrier_u_hi = vel_u.w;
	  if (carrier_domain_ready) {
	    carrier_u_lo = carrier_domain.x;
	    carrier_u_hi = carrier_domain.y;
	  }
	  let temperature_slope = thermal_temperature_slope(row0.x, vel_u.w, row0.y, row1);
	  let support = 2.0 * params.smoothing_length_m;
	  let self_nominal_radius_m = particle_nominal_radius_m(mass, row0.w);
	  let self_emissivity = thermal_emissivity(row0.x);
	  var du = material_bank_warm_input_anchor();
	  var conduction_du = 0.0;
	  var neighbor_min_temperature = temperature;
	  var neighbor_max_temperature = temperature;

	  let scan_support = max(support, params.max_pair_support_m);
	  // Bins can only serve pairs their scan radius reaches. Coarse low-density
	  // scenes have contact radii spanning many bin cells (an F2 gas particle's
	  // nominal radius is metres); those scenes are also small-n, so the
	  // exhaustive pair scan is the right structure for them. Self-select.
	  let bins_cover_support = scan_support <= 5.0 * max(params.bin_cell_size_m, 1.0e-9);
	  if (params.bins_enabled == 1u && params.bin_capacity > 0u && bins_cover_support) {
	    // Neighbor-bin scan: the shared per-substep bins hold every massive
	    // particle; the scan radius covers the conduction support even when
	    // the cell size was chosen for the (smaller) separation rest distance.
	    let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
	    let scan_r = i32(clamp(u32(ceil(scan_support * inv_cell)), 1u, 5u));
	    let cx = i32(clamp(u32(max(position.x, 0.0) * inv_cell), 0u, params.bin_nx - 1u));
	    let cy = i32(clamp(u32(max(position.y, 0.0) * inv_cell), 0u, params.bin_ny - 1u));
	    let cz = i32(clamp(u32(max(position.z, 0.0) * inv_cell), 0u, params.bin_nz - 1u));
	    for (var oz = -scan_r; oz <= scan_r; oz = oz + 1) {
	      let nz = cz + oz;
	      if (nz < 0 || nz >= i32(params.bin_nz)) { continue; }
	      for (var oy = -scan_r; oy <= scan_r; oy = oy + 1) {
	        let ny = cy + oy;
	        if (ny < 0 || ny >= i32(params.bin_ny)) { continue; }
	        for (var ox = -scan_r; ox <= scan_r; ox = ox + 1) {
	          let nx = cx + ox;
	          if (nx < 0 || nx >= i32(params.bin_nx)) { continue; }
	          let cell = (u32(nz) * params.bin_ny + u32(ny)) * params.bin_nx + u32(nx);
	          let total_cells = params.bin_nx * params.bin_ny * params.bin_nz;
	          let cell_count = min(thermal_bins[cell], params.bin_capacity);
	          for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
	            let other = thermal_bins[total_cells + cell * params.bin_capacity + entry];
	            if (other == particle_index) { continue; }
	            let other_pos_mass = state_pos_mass(other);
	            if (!(other_pos_mass.w > 0.0)) { continue; }
	            let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
	            let distance = length(delta);
	            let other_row0 = thermo_row0(other);
	            let other_row1 = thermo_row1(other);
	            let other_nominal_radius_m = particle_nominal_radius_m(other_pos_mass.w, other_row0.w);
	            let pair_radii_m = self_nominal_radius_m + other_nominal_radius_m;
	            let pair_support = max(support, pair_radii_m);
	            let radiation_support = RADIATION_PAIR_RANGE_RADII * pair_radii_m;
	            if (distance < max(pair_support, radiation_support)) {
	              let other_vel_u = state_vel_u(other);
	              let other_temperature = other_row0.z;
	              neighbor_min_temperature = min(neighbor_min_temperature, other_temperature);
	              neighbor_max_temperature = max(neighbor_max_temperature, other_temperature);
	              let other_temperature_slope = thermal_temperature_slope(
	                other_row0.x,
	                other_vel_u.w,
	                other_row0.y,
	                other_row1
	              );
	              if (distance < pair_support) {
	                let weight = 1.0 - distance / pair_support;
	                let raw_dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
	                let dE = clamp_pair_conduction_energy(
	                  raw_dE,
	                  temperature,
	                  other_temperature,
	                  temperature_slope,
	                  other_temperature_slope,
	                  mass,
	                  other_pos_mass.w
	                );
	                conduction_du = conduction_du + dE / mass;
	              }
	              // Gray-body pair radiation over the disc view area; shares the
	              // conduction equalization clamp so one substep never crosses
	              // the pair equilibrium, and the aggregate neighbor-range clamp
	              // below bounds the total like conduction.
	              if (self_emissivity > 0.0 && distance < radiation_support) {
	                let other_emissivity = thermal_emissivity(other_row0.x);
	                if (other_emissivity > 0.0) {
	                  let view_area_m2 = radiative_view_area_m2(self_nominal_radius_m, other_nominal_radius_m, distance);
	                  let raw_rad_dE = self_emissivity * other_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	                    * (pow4(other_temperature) - pow4(temperature)) * view_area_m2 * params.dt;
	                  let rad_dE = clamp_pair_conduction_energy(
	                    raw_rad_dE,
	                    temperature,
	                    other_temperature,
	                    temperature_slope,
	                    other_temperature_slope,
	                    mass,
	                    other_pos_mass.w
	                  );
	                  conduction_du = conduction_du + rad_dE / mass;
	                }
	              }
	            }
	          }
	        }
	      }
	    }
	  } else {
	  for (var other = 0u; other < params.particle_count; other = other + 1u) {
	    if (other == particle_index) {
      continue;
    }
	    let other_pos_mass = state_pos_mass(other);
	    if (!(other_pos_mass.w > 0.0)) { continue; }
	    let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
	    let distance = length(delta);
	    let other_row0 = thermo_row0(other);
	    let other_row1 = thermo_row1(other);
	    let other_nominal_radius_m = particle_nominal_radius_m(other_pos_mass.w, other_row0.w);
	    let pair_radii_m = self_nominal_radius_m + other_nominal_radius_m;
	    let pair_support = max(support, pair_radii_m);
	    let radiation_support = RADIATION_PAIR_RANGE_RADII * pair_radii_m;
	    if (distance < max(pair_support, radiation_support)) {
	      let other_vel_u = state_vel_u(other);
	      let other_temperature = other_row0.z;
	      neighbor_min_temperature = min(neighbor_min_temperature, other_temperature);
	      neighbor_max_temperature = max(neighbor_max_temperature, other_temperature);
	      let other_temperature_slope = thermal_temperature_slope(
	        other_row0.x,
	        other_vel_u.w,
	        other_row0.y,
	        other_row1
	      );
	      if (distance < pair_support) {
	        let weight = 1.0 - distance / pair_support;
	        let raw_dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
	        let dE = clamp_pair_conduction_energy(
	          raw_dE,
	          temperature,
	          other_temperature,
	          temperature_slope,
	          other_temperature_slope,
	          mass,
	          other_pos_mass.w
	        );
	        conduction_du = conduction_du + dE / mass;
	      }
	      // Gray-body pair radiation over the disc view area; shares the
	      // conduction equalization clamp so one substep never crosses
	      // the pair equilibrium, and the aggregate neighbor-range clamp
	      // below bounds the total like conduction.
	      if (self_emissivity > 0.0 && distance < radiation_support) {
	        let other_emissivity = thermal_emissivity(other_row0.x);
	        if (other_emissivity > 0.0) {
	          let view_area_m2 = radiative_view_area_m2(self_nominal_radius_m, other_nominal_radius_m, distance);
	          let raw_rad_dE = self_emissivity * other_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	            * (pow4(other_temperature) - pow4(temperature)) * view_area_m2 * params.dt;
	          let rad_dE = clamp_pair_conduction_energy(
	            raw_rad_dE,
	            temperature,
	            other_temperature,
	            temperature_slope,
	            other_temperature_slope,
	            mass,
	            other_pos_mass.w
	          );
	          conduction_du = conduction_du + rad_dE / mass;
	        }
	      }
	    }
	  }
	  }
	  du = du + clamp_du_to_temperature_range(
	    conduction_du,
	    temperature,
	    temperature_slope,
	    neighbor_min_temperature,
	    neighbor_max_temperature
	  );

	  for (var face = 0u; face < 6u; face = face + 1u) {
	    let distance = wall_distance(position, face);
	    if (distance < params.wall_layer_m) {
	      let weight = 1.0 - distance / params.wall_layer_m;
	      let face_wall_temperature = wall_temperature(face);
	      let current_u = vel_u.w + du;
	      let current_temperature = temperature + du * temperature_slope;
	      let raw_du_specific = params.wall_rate * (face_wall_temperature - current_temperature) * weight * params.dt / mass;
	      let equilibrium_limited_du = clamp_wall_du_specific(
	        raw_du_specific,
	        current_temperature,
	        face_wall_temperature,
	        temperature_slope
	      );
	      du = du + clamp_du_to_energy_domain(
	        equilibrium_limited_du,
	        current_u,
	        carrier_u_lo,
	        carrier_u_hi
	      );
	    }
	  }

	  // Radiative exchange with the ambient environment (box interior at
	  // params.ambient_temperature_k): full-sphere gray-body Stefan-Boltzmann.
	  // This is a documented open-system source/sink (the environment absorbs
	  // or supplies the energy, like the wall coupling above). The crossing
	  // clamp guarantees a substep never overshoots past ambient equilibrium.
	  if (
	    params.ambient_radiation_exchange_enabled == 1u
	    && self_emissivity > 0.0
	    && self_nominal_radius_m > 0.0
	    && params.ambient_temperature_k > 0.0
	  ) {
	    let surface_area_m2 = 4.0 * 3.14159265359 * self_nominal_radius_m * self_nominal_radius_m;
	    let current_u = vel_u.w + du;
	    let current_temperature = temperature + du * temperature_slope;
	    let raw_ambient_dE = self_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	      * (pow4(params.ambient_temperature_k) - pow4(current_temperature))
	      * surface_area_m2 * params.dt;
	    let equilibrium_limited_du = clamp_wall_du_specific(
	      raw_ambient_dE / mass,
	      current_temperature,
	      params.ambient_temperature_k,
	      temperature_slope
	    );
	    du = du + clamp_du_to_energy_domain(
	      equilibrium_limited_du,
	      current_u,
	      carrier_u_lo,
	      carrier_u_hi
	    );
	  }

  var next_u = select(0.0, vel_u.w, thermal_value_finite(vel_u.w));
  let candidate_next_u = vel_u.w + du;
  if (carrier_domain_ready) {
    next_u = clamp(
      select(vel_u.w, candidate_next_u, thermal_value_finite(candidate_next_u)),
      carrier_u_lo,
      carrier_u_hi
    );
  }
  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  write_thermal_state(particle_index, row0.x, next_u, row1, row2);
}
`;`${k.compactCountPassCount}${k.compactionInputVisitCount}${k.compactScanPassCount}${k.activeEventCount}${k.compactionLiveFlagCount}${k.compactionOverflowCount}${k.compactScatterPassCount}`;const Ue=`
struct ProductEventPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  generation_id: u32,
  support_profile_id: u32,
  receipt_version: u32,
};

@group(0) @binding(0) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(5) var<storage, read_write> placement_summary: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> compact_counts: array<u32>;
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN
@group(0) @binding(9) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(10) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(11) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(12) var<storage, read_write> placement_decisions: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> placement_completion_receipt: array<u32>;

${ge}
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END

const PHASE_COMPANION_RESERVED_STATUS: f32 = 254.0;
const REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn placement_represented_entity_count_for_product_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || mass_kg != mass_kg
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return 0.0;
  }
  let represented_entity_count = mass_kg / molar_mass_kg_per_mol
    * REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL;
  return select(
    0.0,
    represented_entity_count,
    represented_entity_count == represented_entity_count
      && abs(represented_entity_count) <= 3.0e38
  );
}

fn placement_product_event_moles_match_mass(
  product_mass_kg: f32,
  product_moles: f32,
  molar_mass_kg_per_mol: f32
) -> bool {
  if (
    !(product_mass_kg > 0.0)
    || !(product_moles > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || product_mass_kg != product_mass_kg
    || product_moles != product_moles
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return false;
  }
  let derived_moles = product_mass_kg / molar_mass_kg_per_mol;
  if (
    !(derived_moles > 0.0)
    || derived_moles != derived_moles
    || abs(derived_moles) > 3.0e38
  ) {
    return false;
  }
  let tolerance = max(
    1.0e-20,
    1.0e-5 * max(abs(product_moles), abs(derived_moles))
  );
  return abs(product_moles - derived_moles) <= tolerance;
}

fn placement_summary_base(product_term_index: u32) -> u32 {
  return product_term_index * 8u;
}

fn record_placement_identity(base: u32, row1: vec4<f32>, row2: vec4<f32>) {
  placement_summary[base] = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(row2.w, 1.0, header.z, header.w);
}

fn record_ready_product(base: u32, product_mass_kg: f32, direct_placed_mass_kg: f32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z + 1.0, header.w);
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(
    counts.x + select(0.0, 1.0, direct_placed_mass_kg > 0.0),
    counts.y,
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(
    masses.x + product_mass_kg,
    masses.y + direct_placed_mass_kg,
    masses.z,
    masses.w
  );
  let maxima = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, product_mass_kg));
}

fn record_placement_candidate(base: u32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z, header.w + 1.0);
}

fn record_rejected_placement(base: u32, rejected_mass_kg: f32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + rejected_mass_kg);
}

fn record_unplaced(base: u32, mass_kg: f32, subthreshold: bool) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(
    counts.x + 1.0,
    counts.y + select(0.0, 1.0, subthreshold),
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(
    masses.x,
    masses.y + mass_kg,
    masses.z + select(0.0, mass_kg, subthreshold),
    masses.w
  );
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, mass_kg));
}

fn record_capture_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + mass_kg);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(max(distances.x, distance_m), distances.y, distances.z, distances.w);
}

fn record_fallback_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z, counts.w + 1.0);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x + mass_kg, masses.y, masses.z, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, max(distances.y, distance_m), distances.z, distances.w);
}

fn record_spare_placement(base: u32, mass_kg: f32, support_radius_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y + 1.0, counts.z, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z + mass_kg, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(max(maxima.x, mass_kg), maxima.y, maxima.z, maxima.w);
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, distances.y, max(distances.z, support_radius_m), distances.w);
}

fn record_phase_routed_event(base: u32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.xyz, counts.w + 1.0);
}

fn placement_phase_is_liquid(phase_id: f32) -> bool {
  return phase_id >= 1.5 && phase_id < 2.5;
}

fn placement_phase_is_condensed(phase_id: f32) -> bool {
  return phase_id > 0.5 && phase_id < 2.5;
}

fn placement_phase_is_gas(phase_id: f32) -> bool {
  return phase_id >= 2.5 && phase_id < 3.5;
}

fn placement_reactant_radius_m(pos_mass: vec4<f32>, thermo0: vec4<f32>) -> f32 {
  if (!(pos_mass.w > 0.0) || !(thermo0.w > 0.0)) {
    return 0.0;
  }
  return pow(
    max(3.0 * pos_mass.w / (12.5663706 * thermo0.w), 1.0e-30),
    1.0 / 3.0
  );
}

fn placement_support_fits_box(support_radius_m: f32) -> bool {
  if (params.box_clamp_enabled == 0u) {
    return true;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  return support_radius_m <= max_margin_m;
}

fn placement_clamp_to_box(position: vec3<f32>, support_margin_m: f32) -> vec3<f32> {
  if (params.box_clamp_enabled == 0u) {
    return position;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  let margin_m = clamp(support_margin_m, 0.0, max_margin_m);
  return clamp(
    position,
    vec3<f32>(margin_m),
    box_dims - vec3<f32>(margin_m)
  );
}

fn placement_pair_preserving_shift(
  source_position: vec3<f32>,
  partner_position: vec3<f32>,
  desired_shift: vec3<f32>,
  support_margin_m: f32
) -> vec4<f32> {
  if (params.box_clamp_enabled == 0u) {
    return vec4<f32>(desired_shift, 1.0);
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  if (support_margin_m > max_margin_m) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let margin_m = max(support_margin_m, 0.0);
  let lower = max(
    vec3<f32>(margin_m) - source_position,
    vec3<f32>(margin_m) - partner_position
  );
  let upper = min(
    box_dims - vec3<f32>(margin_m) - source_position,
    box_dims - vec3<f32>(margin_m) - partner_position
  );
  if (!all(lower <= upper)) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let bounded_shift = clamp(desired_shift, lower, upper);
  let shift_error = bounded_shift - desired_shift;
  if (dot(shift_error, shift_error) > 1.0e-10) {
    return vec4<f32>(desired_shift, 0.0);
  }
  return vec4<f32>(bounded_shift, 1.0);
}

// Reaction placement must use the current reacting pair rather than the
// render-cadence material-interface table: source state is fresh for this
// reaction tick, deterministic, and already GPU resident. Select the
// condensed host (liquid first, then any condensed phase, then higher rest
// density, then lower stable particle index), point toward the other carrier,
// and route the gas center beyond the other reactant's surface by the gas
// support radius. As a merged bubble grows, its center advances by the radius
// growth so its volume does not expand back through the reacting pair.
// A zero w lane means the derivation failed and callers retain the midpoint.
fn placement_gas_target(
  source_index: u32,
  partner_index: u32,
  fallback_position: vec3<f32>,
  product_support_radius_m: f32
) -> vec4<f32> {
  if (
    source_index >= params.particle_count
    || partner_index >= params.particle_count
    || source_index == partner_index
  ) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let source_pos_mass = source_state[source_index * params.state_stride_vec4];
  let partner_pos_mass = source_state[partner_index * params.state_stride_vec4];
  let source_thermo0 = source_thermo[source_index * params.thermo_stride_vec4];
  let partner_thermo0 = source_thermo[partner_index * params.thermo_stride_vec4];
  let source_radius_m = placement_reactant_radius_m(source_pos_mass, source_thermo0);
  let partner_radius_m = placement_reactant_radius_m(partner_pos_mass, partner_thermo0);
  if (!(source_radius_m > 0.0) || !(partner_radius_m > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }

  let source_liquid = placement_phase_is_liquid(source_thermo0.y);
  let partner_liquid = placement_phase_is_liquid(partner_thermo0.y);
  let source_condensed = placement_phase_is_condensed(source_thermo0.y);
  let partner_condensed = placement_phase_is_condensed(partner_thermo0.y);
  var host_is_source = source_index < partner_index;
  if (source_liquid != partner_liquid) {
    host_is_source = source_liquid;
  } else if (source_condensed != partner_condensed) {
    host_is_source = source_condensed;
  } else if (abs(source_thermo0.w - partner_thermo0.w) > 1.0e-6) {
    host_is_source = source_thermo0.w > partner_thermo0.w;
  }

  let host_position = select(partner_pos_mass.xyz, source_pos_mass.xyz, host_is_source);
  let free_position = select(source_pos_mass.xyz, partner_pos_mass.xyz, host_is_source);
  let free_radius_m = select(source_radius_m, partner_radius_m, host_is_source);
  let host_to_free = free_position - host_position;
  let separation2 = dot(host_to_free, host_to_free);
  if (!(separation2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let contact_radius_m = min(source_radius_m, partner_radius_m);
  let outward_normal = host_to_free / sqrt(separation2);
  let product_radius_m = max(product_support_radius_m, 0.0);
  if (!placement_support_fits_box(product_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let required_clearance_m = free_radius_m + product_radius_m;
  var target_position = free_position + outward_normal * required_clearance_m;
  target_position = placement_clamp_to_box(target_position, product_radius_m);
  let final_clearance_m = dot(target_position - free_position, outward_normal);
  if (final_clearance_m < required_clearance_m - 1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(target_position, contact_radius_m);
}

fn placement_route_gas_merge_position(
  original_event_position: vec3<f32>,
  routed_event_position: vec3<f32>,
  phase_id: f32,
  event_support_radius_m: f32,
  merged_rest_volume_m3: f32,
  fallback_position: vec3<f32>
) -> vec4<f32> {
  if (!placement_phase_is_gas(phase_id) || !(merged_rest_volume_m3 > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let route = routed_event_position - original_event_position;
  let route_length2 = dot(route, route);
  if (!(route_length2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let merged_support_radius_m = pow(
    max(merged_rest_volume_m3 * 0.238732414637843, 1.0e-30),
    1.0 / 3.0
  );
  if (!placement_support_fits_box(merged_support_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let growth_offset_m = max(merged_support_radius_m - event_support_radius_m, 0.0);
  let outward_normal = route / sqrt(route_length2);
  let required_position = routed_event_position + outward_normal * growth_offset_m;
  let outward_penetration_m = max(
    dot(required_position - fallback_position, outward_normal),
    0.0
  );
  let projected_position = fallback_position + outward_normal * outward_penetration_m;
  let clamped_position = placement_clamp_to_box(projected_position, merged_support_radius_m);
  if (dot(clamped_position - required_position, outward_normal) < -1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(clamped_position, 1.0);
}

fn placement_particle_rest_volume_m3(particle_index: u32) -> f32 {
  if (particle_index >= params.particle_count) {
    return 0.0;
  }
  let mechanics_row4 = next_mechanics[
    particle_index * params.mechanics_stride_vec4 + 4u
  ];
  if (mechanics_row4.w > 0.0) {
    return mechanics_row4.w;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  if (state0.w > 0.0 && thermo0.w > 0.0) {
    return state0.w / thermo0.w;
  }
  return 0.0;
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN
// LEGACY TEMPLATE-ONLY CLASSIFICATION BODY. The exported commit module removes
// this entire marked region before shader compilation. Slice 8 production uses
// sphReactionProductEventSpatialClassificationWgsl plus the parallel envelope
// module; no runtime pipeline can select the serial helper below.
struct PlacementCaptureResult {
  slot: u32,
  malformed: u32,
  distance_m: f32,
  _pad0: f32,
};

// The canonical directory indexes immutable fresh post-reaction placement
// positions, while placement observes its separately initialized destination.
// A radius/displacement envelope keeps lookup complete before exact filtering.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_BEGIN
fn placement_live_radius_and_displacement_envelope() -> vec2<f32> {
  var maximum_radius_m = 0.0;
  var maximum_displacement_m = 0.0;
  for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
    let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
    let state0 = next_state[candidate * params.state_stride_vec4];
    let thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
    // Fixed-capacity generations contain zero-mass spare rows. An activated
    // spare belongs to the placed destination, never to this frozen query.
    if (authority_state0.w <= 0.0 || state0.w <= 0.0 || thermo0.w <= 0.0) {
      continue;
    }
    let radius_m = pow(
      max(3.0 * state0.w / (12.5663706 * thermo0.w), 1.0e-30),
      1.0 / 3.0
    );
    maximum_radius_m = max(maximum_radius_m, radius_m);
    maximum_displacement_m = max(
      maximum_displacement_m,
      length(state0.xyz - authority_state0.xyz)
    );
  }
  return vec2<f32>(maximum_radius_m, maximum_displacement_m);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_END

fn placement_consider_capture_candidate(
  candidate: u32,
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  current: PlacementCaptureResult
) -> PlacementCaptureResult {
  if (candidate >= params.particle_count) {
    return current;
  }
  let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
  let candidate_state = next_state[candidate * params.state_stride_vec4];
  if (authority_state0.w <= 0.0 || candidate_state.w <= 0.0) {
    return current;
  }
  let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
  if (
    candidate_row0.x != event_material_id
    || candidate_row0.y != event_phase_id
    || !(candidate_row0.w > 0.0)
  ) {
    return current;
  }
  let candidate_radius_m = pow(
    max(3.0 * candidate_state.w / (12.5663706 * candidate_row0.w), 1.0e-30),
    1.0 / 3.0
  );
  let capture_radius_m = 4.0 * (event_support_radius_m + candidate_radius_m);
  let delta = event_position - candidate_state.xyz;
  let distance_m = length(delta);
  if (
    distance_m <= capture_radius_m
    && (
      distance_m < current.distance_m
      || (distance_m == current.distance_m && candidate < current.slot)
    )
  ) {
    return PlacementCaptureResult(candidate, current.malformed, distance_m, 0.0);
  }
  return current;
}

// Query the fresh frozen placement source by its authenticated exact-near
// directory. The source-to-destination displacement envelope ensures the
// per-carrier capture law cannot omit a valid pre-existing carrier.
fn placement_find_capture_ss(
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  maximum_live_radius_m: f32,
  maximum_live_displacement_m: f32
) -> PlacementCaptureResult {
  var result = PlacementCaptureResult(
    params.particle_count,
    0u,
    3.0e38,
    0.0
  );
  if (
    params.canonical_spatial_enabled == 0u
    || spatial_expectation.source_count != params.particle_count
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    result.malformed = select(0u, 1u, params.canonical_spatial_enabled != 0u);
    return result;
  }
  let search_radius_m = 4.0 * (
    max(event_support_radius_m, 0.0) + max(maximum_live_radius_m, 0.0)
  ) + max(maximum_live_displacement_m, 0.0);
  if (!ss_exact_near_finite(search_radius_m)) {
    result.malformed = 1u;
    return result;
  }

  var malformed = false;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(event_position / spacing_m));
    let radius_cells = max(0, i32(min(
      ceil(search_radius_m / spacing_m),
      2147483520.0
    )));
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) {
        malformed = true;
        break;
      }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          malformed = true;
          break;
        }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (var cell_index = z_begin; cell_index < z_end; cell_index = cell_index + 1u) {
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
            result = placement_consider_capture_candidate(
              lookup.source_index,
              event_position,
              event_material_id,
              event_phase_id,
              event_support_radius_m,
              result
            );
          }
          if (malformed) {
            break;
          }
        }
        if (malformed) {
          break;
        }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  result.malformed = select(0u, 1u, malformed);
  return result;
}

// Build one immutable envelope for the parallel event classifier. This is a
// source-family pass once per reaction step, rather than once per event.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_BEGIN
@compute @workgroup_size(1)
fn prepare_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&placement_control) == 0u) {
    return;
  }
  placement_control[0] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.canonical_spatial_enabled == 0u) {
    return;
  }
  let envelope = placement_live_radius_and_displacement_envelope();
  placement_control[0] = vec4<f32>(envelope, 1.0, 0.0);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_END

// Resolve the expensive exact-near capture query independently for every
// compact event. The following single-lane commit pass consumes these stable
// decisions in ascending event order, preserving deterministic reductions
// without serializing the spatial traversal itself.
@compute @workgroup_size(64)
fn classify_product_events(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let event = global_id.x;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  if (event >= active_event_count || event >= arrayLength(&placement_decisions)) {
    return;
  }
  placement_decisions[event] = vec4<f32>(
    f32(params.particle_count),
    3.0e38,
    0.0,
    0.0
  );
  let stride = params.event_stride_vec4;
  if (
    params.canonical_spatial_enabled == 0u
    || stride < 8u
    || arrayLength(&placement_control) == 0u
    || placement_control[0].z != 1.0
  ) {
    placement_decisions[event].z = 2.0;
    return;
  }
  let base = event * stride;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row7 = product_events[base + 7u];
  let event_valid = row4.z == 1.0
    && row7.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0;
  let unplaced_mass_kg = max(row3.y, 0.0);
  if (!event_valid || unplaced_mass_kg <= params.min_placed_mass_kg) {
    // Valid direct-only and subthreshold events need no capture query. The
    // commit pass still handles their provenance and disposition.
    placement_decisions[event].z = select(2.0, 1.0, event_valid);
    return;
  }
  var support_radius_m = 0.05;
  if (row5.w > 0.0) {
    support_radius_m = pow(row5.w * 0.238732414637843, 1.0 / 3.0);
  }
  var event_position = row0.xyz;
  if (placement_phase_is_gas(row2.w) && row0.w > 0.0) {
    let source_index_f = round(row1.w);
    let partner_index_f = round(row2.x);
    let pair_indices_valid = source_index_f >= 0.0
      && partner_index_f >= 0.0
      && source_index_f < f32(params.particle_count)
      && partner_index_f < f32(params.particle_count);
    if (pair_indices_valid) {
      let gas_target = placement_gas_target(
        u32(source_index_f),
        u32(partner_index_f),
        event_position,
        support_radius_m
      );
      if (gas_target.w > 0.0) {
        event_position = gas_target.xyz;
      }
    }
  }
  let capture = placement_find_capture_ss(
    event_position,
    row1.x,
    row2.w,
    support_radius_m,
    placement_control[0].x,
    placement_control[0].y
  );
  placement_decisions[event] = vec4<f32>(
    f32(capture.slot),
    capture.distance_m,
    select(1.0, 2.0, capture.malformed != 0u),
    0.0
  );
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END

// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN
fn placement_direct_carrier_matches(
  particle_index: u32,
  material_id: f32,
  phase_id: f32
) -> bool {
  if (particle_index >= params.particle_count) {
    return false;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  return state0.w > 0.0
    && abs(thermo0.x - material_id) < 0.5
    && abs(thermo0.y - phase_id) < 0.5;
}

// Direct placement can replace one freed parent before this pass. Relocate it
// only when exactly one endpoint owns this product term; two matching
// endpoints are a multi-carrier product and must retain their separation.
fn placement_route_direct_gas_carrier(
  source_index: u32,
  partner_index: u32,
  material_id: f32,
  phase_id: f32,
  original_event_position: vec3<f32>,
  target_position: vec3<f32>,
  event_support_radius_m: f32
) -> bool {
  let source_matches = placement_direct_carrier_matches(source_index, material_id, phase_id);
  let partner_matches = placement_direct_carrier_matches(partner_index, material_id, phase_id);
  if (!source_matches && !partner_matches) {
    return false;
  }
  if (source_matches && partner_matches) {
    let source_state_base = source_index * params.state_stride_vec4;
    let partner_state_base = partner_index * params.state_stride_vec4;
    let source_state0 = next_state[source_state_base];
    let partner_state0 = next_state[partner_state_base];
    let source_rest_volume_m3 = placement_particle_rest_volume_m3(source_index);
    let partner_rest_volume_m3 = placement_particle_rest_volume_m3(partner_index);
    if (!(source_rest_volume_m3 > 0.0) || !(partner_rest_volume_m3 > 0.0)) {
      return false;
    }
    let source_support_radius_m = pow(
      max(source_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let partner_support_radius_m = pow(
      max(partner_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let direct_support_radius_m = max(source_support_radius_m, partner_support_radius_m);
    let current_midpoint = 0.5 * (source_state0.xyz + partner_state0.xyz);
    let pair_separation = source_state0.xyz - partner_state0.xyz;
    let pair_support_radius_m = 0.5 * sqrt(dot(pair_separation, pair_separation))
      + direct_support_radius_m;
    let pair_support_volume_m3 = pair_support_radius_m
      * pair_support_radius_m
      * pair_support_radius_m
      / 0.238732414637843;
    let projected_route = placement_route_gas_merge_position(
      original_event_position,
      target_position,
      phase_id,
      event_support_radius_m,
      pair_support_volume_m3,
      current_midpoint
    );
    if (projected_route.w <= 0.0) {
      return false;
    }
    let shift = projected_route.xyz - current_midpoint;
    let bounded_shift = placement_pair_preserving_shift(
      source_state0.xyz,
      partner_state0.xyz,
      shift,
      direct_support_radius_m
    );
    if (bounded_shift.w <= 0.0) {
      return false;
    }
    next_state[source_state_base] = vec4<f32>(source_state0.xyz + bounded_shift.xyz, source_state0.w);
    next_state[partner_state_base] = vec4<f32>(partner_state0.xyz + bounded_shift.xyz, partner_state0.w);
    return true;
  }
  let direct_index = select(partner_index, source_index, source_matches);
  let state_base = direct_index * params.state_stride_vec4;
  let state0 = next_state[state_base];
  let direct_rest_volume_m3 = placement_particle_rest_volume_m3(direct_index);
  if (!(direct_rest_volume_m3 > 0.0)) {
    return false;
  }
  let direct_route = placement_route_gas_merge_position(
    original_event_position,
    target_position,
    phase_id,
    event_support_radius_m,
    direct_rest_volume_m3,
    state0.xyz
  );
  if (direct_route.w <= 0.0) {
    return false;
  }
  next_state[state_base] = vec4<f32>(direct_route.xyz, state0.w);
  return true;
}

@compute @workgroup_size(1)
fn place_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  if (arrayLength(&placement_completion_receipt) < 78u) {
    return;
  }
  placement_completion_receipt[0] = 1380995129u;
  placement_completion_receipt[1] = 5u;
  placement_completion_receipt[2] = params.generation_id;
  placement_completion_receipt[3] = params.support_profile_id;
  placement_completion_receipt[4] = params.event_row_count;
  placement_completion_receipt[${k.status}] = ${O.PENDING}u;
  let stride = params.event_stride_vec4;
  if (stride < 8u) {
    placement_completion_receipt[${k.status}] = ${O.CONTRACT_REJECTED}u;
    return;
  }
  var cursor = 0u;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  let classifier_ready_count = placement_completion_receipt[${k.classifierReadyCount}];
  let classifier_rejected_count = placement_completion_receipt[${k.classifierRejectedCount}];
  let classifier_unknown_count = placement_completion_receipt[${k.classifierUnknownCount}];
  if (params.canonical_spatial_enabled != 0u) {
    // Seal the complete parallel decision set before the first destination
    // mutation. Status 2 is reserved for missing/malformed canonical spatial
    // authority; one such row rejects placement for the whole batch rather
    // than publishing a partially applied prefix.
    if (
      params.receipt_version != 5u
      || placement_completion_receipt[${k.compactCountPassCount}] != 1u
      || placement_completion_receipt[${k.compactScanPassCount}] != 1u
      || placement_completion_receipt[${k.compactScatterPassCount}] != 1u
      || placement_completion_receipt[${k.activeEventCount}] != active_event_count
      || placement_completion_receipt[${k.compactionOverflowCount}] != 0u
      || placement_completion_receipt[${k.envelopePartialPassCount}] != 1u
      || placement_completion_receipt[${k.envelopeFinalizePassCount}] != 1u
      || placement_completion_receipt[${k.envelopeAdmitted}] != 1u
      || placement_completion_receipt[${k.classifierPassCount}] != 1u
      || placement_completion_receipt[${k.spareFlagPassCount}] != 2u
      || placement_completion_receipt[${k.spareScanPassCount}] != 2u
      || placement_completion_receipt[${k.spareAssignPassCount}] != 2u
      || placement_completion_receipt[${k.overflowFlags}] != 0u
      || active_event_count > arrayLength(&placement_decisions)
    ) {
      placement_completion_receipt[${k.status}] = ${O.CONTRACT_REJECTED}u;
      return;
    }
    if (
      classifier_ready_count + classifier_rejected_count
        + classifier_unknown_count != active_event_count
      || classifier_unknown_count != 0u
    ) {
      placement_completion_receipt[${k.status}] = ${O.CANONICAL_DECISION_REJECTED}u;
      return;
    }
  }
  placement_completion_receipt[${k.applyPassCount}] = 1u;
  placement_completion_receipt[${k.serialConflictFoldPassCount}] = select(0u, 1u, active_event_count > 0u);
  placement_completion_receipt[${k.serialConflictFoldEventCount}] = active_event_count;
  placement_completion_receipt[${k.maxSerialConflictFoldSize}] = active_event_count;
  // Mark every product-term accumulator row as executed only after the full
  // canonical decision set is sealed. Identity is written only by non-empty
  // events below; dense empty event rows must not overwrite a real term
  // identity. Keeping this after preflight makes rejection all-or-nothing for
  // both particle state and placement provenance.
  for (var product_term_index = 0u; product_term_index < params.product_term_count; product_term_index = product_term_index + 1u) {
    let summary_base = placement_summary_base(product_term_index);
    let header = placement_summary[summary_base + 1u];
    placement_summary[summary_base + 1u] = vec4<f32>(header.x, 1.0, header.z, header.w);
  }
  var processed_event_count = 0u;
  var capture_merge_event_count = 0u;
  var spare_placement_event_count = 0u;
  var direct_only_event_count = 0u;
  var fallback_event_count = 0u;
  var subthreshold_event_count = 0u;
  var no_carrier_event_count = 0u;
  var rejected_event_count = 0u;
  var unknown_disposition_count = 0u;
  for (var event = 0u; event < active_event_count; event = event + 1u) {
    processed_event_count = processed_event_count + 1u;
    let base = event * stride;
    let event_row0_header = product_events[base];
    let event_row1_header = product_events[base + 1u];
    let row3 = product_events[base + 3u];
    let row4 = product_events[base + 4u];
    let event_row2_header = product_events[base + 2u];
    let event_row5_header = product_events[base + 5u];
    let event_row7_header = product_events[base + 7u];
    let product_term_index = u32(max(event_row1_header.y, 0.0));
    if (product_term_index >= params.product_term_count) {
      rejected_event_count = rejected_event_count + 1u;
      continue;
    }
    let summary_base = placement_summary_base(product_term_index);
    let unplaced_mass_kg = max(row3.y, 0.0);
    let event_product_mass_kg = max(event_row0_header.w, 0.0);
    let unplaced_represented_entity_count =
      placement_represented_entity_count_for_product_mass(
        unplaced_mass_kg,
        row3.w
      );
    if (event_product_mass_kg > 0.0 || unplaced_mass_kg > 0.0) {
      record_placement_identity(summary_base, event_row1_header, event_row2_header);
    }
    let status = row4.z;
    let event_valid = !(
      status != 1.0
      || event_row7_header.z != 1.0
      || !(event_row2_header.y > 0.0)
      || !(event_row2_header.w > 0.0)
      || !(row3.w > 0.0)
      || !(row4.y > 0.0)
      || !placement_product_event_moles_match_mass(
        event_product_mass_kg,
        event_row2_header.y,
        row3.w
      )
      || (unplaced_mass_kg > 0.0
        && !(unplaced_represented_entity_count > 0.0))
    );
    if (!event_valid) {
      rejected_event_count = rejected_event_count + 1u;
      // Reject the whole non-empty event, including a direct-only event whose
      // unplaced lane is zero. Using only unplaced mass here made an invalid
      // direct placement disappear from the accumulator while the term still
      // looked executed and partition-complete.
      let rejected_payload_mass_kg = max(event_product_mass_kg, unplaced_mass_kg);
      if (rejected_payload_mass_kg > 0.0) {
        record_rejected_placement(summary_base, rejected_payload_mass_kg);
        // Invalid payloads must not remain eligible for the retained grid
        // splat or compaction consumers after the placement gate rejects them.
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 8.0);
      }
      continue;
    }
    let event_direct_placed_mass_kg = min(max(row3.x, 0.0), event_product_mass_kg);
    if (event_product_mass_kg > 0.0) {
      record_ready_product(summary_base, event_product_mass_kg, event_direct_placed_mass_kg);
    }
    var event_support_radius_m = 0.05;
    if (event_row5_header.w > 0.0) {
      event_support_radius_m = pow(
        event_row5_header.w * 0.238732414637843,
        1.0 / 3.0
      );
    }
    var event_position = event_row0_header.xyz;
    var event_phase_route_complete = false;
    if (placement_phase_is_gas(event_row2_header.w) && event_product_mass_kg > 0.0) {
      let source_index_f = round(event_row1_header.w);
      let partner_index_f = round(event_row2_header.x);
      let pair_indices_valid = source_index_f >= 0.0
        && partner_index_f >= 0.0
        && source_index_f < f32(params.particle_count)
        && partner_index_f < f32(params.particle_count);
      if (pair_indices_valid) {
        let source_index = u32(source_index_f);
        let partner_index = u32(partner_index_f);
        let gas_target = placement_gas_target(
          source_index,
          partner_index,
          event_position,
          event_support_radius_m
        );
        if (gas_target.w > 0.0) {
          event_position = gas_target.xyz;
          product_events[base] = vec4<f32>(event_position, event_row0_header.w);
          var direct_route_complete = true;
          if (event_direct_placed_mass_kg > 0.0) {
            direct_route_complete = placement_route_direct_gas_carrier(
              source_index,
              partner_index,
              event_row1_header.x,
              event_row2_header.w,
              event_row0_header.xyz,
              event_position,
              event_support_radius_m
            );
          }
          event_phase_route_complete = direct_route_complete;
        }
      }
    }
    if (unplaced_mass_kg <= 0.0) {
      direct_only_event_count = direct_only_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 2.0);
      continue;
    }
    record_placement_candidate(summary_base);
    if (unplaced_mass_kg <= params.min_placed_mass_kg) {
      subthreshold_event_count = subthreshold_event_count + 1u;
      record_unplaced(summary_base, unplaced_mass_kg, true);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 6.0);
      continue;
    }
    let event_row0 = event_row0_header;
    let event_row1 = event_row1_header;
    let event_row2 = product_events[base + 2u];
    let event_row4b = product_events[base + 4u];
    let event_row5 = product_events[base + 5u];
    let event_material_id = event_row1.x;
    let event_phase_id = event_row2.w;
    // Merge-first: with the interface-flux extent law, burning pairs emit a
    // small product event EVERY substep; minting a spare particle for each
    // would exhaust the spare pool within milliseconds. Physically the new
    // product joins the molten crown / gas bubble already at the interface,
    // so fold the event into the nearest same-material same-phase particle
    // within a capture radius (4x combined rest radii). Mass, momentum, and
    // energy move verbatim (mass-weighted merges), so conservation is exact.
    var merge_slot = params.particle_count;
    var merge_distance = 3.0e38;
    var nearest_slot = params.particle_count;
    var nearest_distance = 3.0e38;
    if (params.canonical_spatial_enabled != 0u) {
      let decision = placement_decisions[event];
      if (decision.z != 1.0) {
        // A malformed canonical traversal may not fall through to private
        // search or mutate destination particles. Retain the event mass for the
        // existing product sidecar/grid consumer and make the miss explicit.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      if (decision.x >= 0.0 && decision.x < f32(params.particle_count)) {
        merge_slot = u32(round(decision.x));
        merge_distance = decision.y;
      }
    } else {
      for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_state = next_state[candidate * params.state_stride_vec4];
        if (candidate_state.w <= 0.0) {
          continue;
        }
        let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
        if (candidate_row0.x != event_material_id) {
          continue;
        }
        let candidate_rest_density = max(candidate_row0.w, 1.0e-6);
        let candidate_radius = pow(
          max(3.0 * candidate_state.w / (12.5663706 * candidate_rest_density), 1.0e-30),
          1.0 / 3.0
        );
        let capture_radius = 4.0 * (event_support_radius_m + candidate_radius);
        let delta = event_position - candidate_state.xyz;
        let distance = length(delta);
        if (
          candidate_row0.y == event_phase_id
          && distance <= capture_radius
          && distance < merge_distance
        ) {
          merge_distance = distance;
          merge_slot = candidate;
        }
        if (distance < nearest_distance) {
          nearest_distance = distance;
          nearest_slot = candidate;
        }
      }
    }
    if (merge_slot < params.particle_count) {
      capture_merge_event_count = capture_merge_event_count + 1u;
      let state_base = merge_slot * params.state_stride_vec4;
      let particle_pos_mass = next_state[state_base];
      let particle_vel_u = next_state[state_base + 1u];
      let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
      let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
      var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
      let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
      let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
      let mechanics_base = merge_slot * params.mechanics_stride_vec4;
      let mechanics_row4 = next_mechanics[mechanics_base + 4u];
      var merged_rest_volume = mechanics_row4.w;
      if (event_row4b.y > 0.0) {
        merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
      }
      if (placement_phase_is_gas(event_phase_id)) {
        let merged_route = placement_route_gas_merge_position(
          event_row0_header.xyz,
          event_position,
          event_phase_id,
          event_support_radius_m,
          merged_rest_volume,
          merged_position
        );
        if (merged_route.w > 0.0) {
          merged_position = merged_route.xyz;
        } else {
          event_phase_route_complete = false;
        }
      }
      next_state[state_base] = vec4<f32>(merged_position, merged_mass);
      next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
      let thermo_base = merge_slot * params.thermo_stride_vec4;
      let particle_thermo0 = next_thermo[thermo_base];
      let particle_thermo2 = next_thermo[thermo_base + 2u];
      let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
      next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
      next_thermo[thermo_base + 2u] = vec4<f32>(
        particle_thermo2.x,
        particle_thermo2.y + unplaced_represented_entity_count,
        particle_thermo2.z,
        particle_thermo2.w
      );
      // Rest volume grows by the event's share so density stays consistent.
      next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
      record_capture_merge(summary_base, unplaced_mass_kg, merged_mass, merge_distance);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      // Consume the event. row3.x remains the direct/spare placed share;
      // merged mass is derived exactly as total - placed - unplaced.
      product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 4.0);
      continue;
    }
    // Canonical placement receives an ascending, prefix-scanned spare slot in
    // decision.w. The legacy route retains its cursor scan; it is unreachable
    // once fresh authenticated SS placement authority is selected.
    var slot = params.particle_count;
    if (params.canonical_spatial_enabled != 0u) {
      let assigned_spare = placement_decisions[event].w;
      if (assigned_spare >= 0.0 && assigned_spare < f32(params.particle_count)) {
        slot = u32(round(assigned_spare));
      }
    } else {
      for (var candidate = cursor; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_thermo_base = candidate * params.thermo_stride_vec4;
        let candidate_reserved_for_phase =
          abs(next_thermo[candidate_thermo_base + 2u].z - PHASE_COMPANION_RESERVED_STATUS) < 0.5;
        if (
          next_state[candidate * params.state_stride_vec4].w <= 0.0
          && !candidate_reserved_for_phase
        ) {
          slot = candidate;
          break;
        }
      }
    }
    if (slot >= params.particle_count) {
      // No later event can make an occupied or phase-reserved row available in
      // this commit. Latch exhaustion so the fixed-capacity phase-companion
      // reserve is scanned once, not once per remaining product event.
      cursor = params.particle_count;
      if (params.canonical_spatial_enabled != 0u) {
        // The canonical route never drops into an unauthenticated all-particle
        // fallback. Keep the mass resident in the event sidecar until a later
        // epoch supplies capacity or a hierarchy-authenticated fallback view.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      // Global nearest-material fallback is only needed after deterministic
      // spare exhaustion. Keep it out of the normal per-event hot path.
      if (nearest_slot >= params.particle_count) {
        for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
          let candidate_state = next_state[candidate * params.state_stride_vec4];
          if (candidate_state.w <= 0.0) {
            continue;
          }
          let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
          if (candidate_row0.x != event_material_id) {
            continue;
          }
          let distance = length(event_position - candidate_state.xyz);
          if (
            distance < nearest_distance
            || (distance == nearest_distance && candidate < nearest_slot)
          ) {
            nearest_distance = distance;
            nearest_slot = candidate;
          }
        }
      }
      if (nearest_slot < params.particle_count) {
        // No spare capacity but a same-material carrier exists somewhere:
        // terminal fallback merge (see nearest_slot rationale above).
        merge_slot = nearest_slot;
        let state_base = merge_slot * params.state_stride_vec4;
        let particle_pos_mass = next_state[state_base];
        let particle_vel_u = next_state[state_base + 1u];
        let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
        let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
        var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
        let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
        let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
        let mechanics_base = merge_slot * params.mechanics_stride_vec4;
        let mechanics_row4 = next_mechanics[mechanics_base + 4u];
        var merged_rest_volume = mechanics_row4.w;
        if (event_row4b.y > 0.0) {
          merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
        }
        let thermo_base = merge_slot * params.thermo_stride_vec4;
        let particle_thermo0 = next_thermo[thermo_base];
        let particle_thermo2 = next_thermo[thermo_base + 2u];
        if (placement_phase_is_gas(event_phase_id)) {
          if (abs(particle_thermo0.y - event_phase_id) < 0.5) {
            let merged_route = placement_route_gas_merge_position(
              event_row0_header.xyz,
              event_position,
              event_phase_id,
              event_support_radius_m,
              merged_rest_volume,
              merged_position
            );
            if (merged_route.w > 0.0) {
              merged_position = merged_route.xyz;
            } else {
              event_phase_route_complete = false;
            }
          } else {
            // Preserve the conserving terminal merge but do not teleport a
            // condensed carrier or claim that the gas reached its interface
            // route. The thermal solver remains responsible for phase change.
            event_phase_route_complete = false;
          }
        }
        next_state[state_base] = vec4<f32>(merged_position, merged_mass);
        next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
        let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
        next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
        next_thermo[thermo_base + 2u] = vec4<f32>(
          particle_thermo2.x,
          particle_thermo2.y + unplaced_represented_entity_count,
          particle_thermo2.z,
          particle_thermo2.w
        );
        next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
        record_fallback_merge(summary_base, unplaced_mass_kg, merged_mass, nearest_distance);
        fallback_event_count = fallback_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 5.0);
        continue;
      }
      // No spare capacity and no same-material carrier anywhere: the event
      // stays live and keeps feeding the grid splat ledger, so no mass is
      // lost either way.
      record_unplaced(summary_base, unplaced_mass_kg, false);
      no_carrier_event_count = no_carrier_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
      continue;
    }
    if (params.canonical_spatial_enabled == 0u) {
      cursor = slot + 1u;
    }
    let row0 = product_events[base];
    let row1 = product_events[base + 1u];
    let row2 = product_events[base + 2u];
    let row5 = product_events[base + 5u];
    let row6 = product_events[base + 6u];
    let row7 = product_events[base + 7u];
    let material_id = row1.x;
    let phase_id = row2.w;
    let temperature_k = row4.x;
    var rest_density = row4.y;
    let product_u = row4.w;
    let support_volume_m3 = row5.w;
    let state_base = slot * params.state_stride_vec4;
    next_state[state_base] = vec4<f32>(row0.x, row0.y, row0.z, unplaced_mass_kg);
    next_state[state_base + 1u] = vec4<f32>(row5.x, row5.y, row5.z, product_u);
    // Thermo rows: single-phase product at the event temperature. Phase
    // fractions are the one-hot of the product term's target phase.
    let thermo_base = slot * params.thermo_stride_vec4;
    let solid_fraction = select(0.0, 1.0, phase_id > 0.5 && phase_id < 1.5);
    let liquid_fraction = select(0.0, 1.0, phase_id >= 1.5 && phase_id < 2.5);
    let gas_fraction = select(0.0, 1.0, phase_id >= 2.5 && phase_id < 3.5);
    let plasma_fraction = select(0.0, 1.0, phase_id >= 3.5);
    // Smoothing length / visual radius from the event's support volume
    // (mass over product rest density), the same rest-volume radius the
    // demo derives at build time.
    var support_radius_m = 0.05;
    if (support_volume_m3 > 0.0) {
      support_radius_m = pow(support_volume_m3 * 0.238732414637843, 1.0 / 3.0);
    }
    next_thermo[thermo_base] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
    next_thermo[thermo_base + 1u] = vec4<f32>(solid_fraction, liquid_fraction, gas_fraction, plasma_fraction);
    next_thermo[thermo_base + 2u] = vec4<f32>(
      support_radius_m,
      unplaced_represented_entity_count,
      1.0,
      support_radius_m
    );
    // Mechanics: fresh rest state (F = I, J = 1) with the event's product
    // mechanics -- mirrors write_reacted_mechanics in the reaction kernel.
    var rest_volume = 0.0;
    if (rest_density > 0.0) {
      rest_volume = unplaced_mass_kg / rest_density;
    }
    let mechanics_base = slot * params.mechanics_stride_vec4;
    next_mechanics[mechanics_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
    next_mechanics[mechanics_base + 5u] = vec4<f32>(row7.y, row7.z, row6.x, row6.y);
    next_mechanics[mechanics_base + 6u] = vec4<f32>(row6.z, row6.w, row7.x, row7.z);
    next_mechanics[mechanics_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    record_spare_placement(summary_base, unplaced_mass_kg, support_radius_m);
    spare_placement_event_count = spare_placement_event_count + 1u;
    if (event_phase_route_complete) {
      record_phase_routed_event(summary_base);
    }
    // Consume the event: zero its unplaced share and status so the compactor
    // and the grid splat drop it this substep.
    product_events[base + 3u] = vec4<f32>(row3.x + unplaced_mass_kg, 0.0, row3.z, row3.w);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 3.0);
  }
  placement_completion_receipt[${k.applyVisitedCount}] = processed_event_count;
  placement_completion_receipt[${k.directOnlyEventCount}] = direct_only_event_count;
  placement_completion_receipt[${k.sparePlacementEventCount}] = spare_placement_event_count;
  placement_completion_receipt[${k.captureMergeEventCount}] = capture_merge_event_count;
  placement_completion_receipt[${k.fallbackEventCount}] = fallback_event_count;
  placement_completion_receipt[${k.subthresholdEventCount}] = subthreshold_event_count;
  placement_completion_receipt[${k.noCarrierEventCount}] = no_carrier_event_count;
  placement_completion_receipt[${k.rejectedEventCount}] = rejected_event_count;
  placement_completion_receipt[${k.unknownDispositionCount}] = unknown_disposition_count;
  placement_completion_receipt[${k.privateLookupBuildCount}] = 0u;
  placement_completion_receipt[${k.exhaustiveTraversalCount}] = 0u;
  placement_completion_receipt[${k.status}] = ${O.COMPLETE}u;
}
// ULG_PRODUCT_PLACEMENT_COMMIT_END
`;`${k.overflowFlags}${Ne.MOTION_BOUND_REJECTED}${k.envelopeInputVisitCount}${k.overflowFlags}${Ne.ATOMIC_COUNTER}${k.envelopePartialPassCount}${k.envelopeInputVisitCount}${k.overflowFlags}${Ne.MOTION_BOUND_REJECTED}${k.envelopeFinalizePassCount}${k.envelopeAdmitted}`,Ue.replace(/\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END\n/,`@group(0) @binding(9) var<storage, read> placement_decisions: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> placement_completion_receipt: array<u32>;
`).replace(/\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END\n/,``).replaceAll(`// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN
`,``).replaceAll(`// ULG_PRODUCT_PLACEMENT_COMMIT_END
`,``);const We=`
struct SchroederCrossLevelGridCouplingParams {
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  grid_stride: u32,
  flags: u32,
  fine_grid_spacing_m: f32,
  grid_origin_x_m: f32,
  grid_origin_y_m: f32,
  grid_origin_z_m: f32,
  grid_shift: i32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  delta_scale: f32,
  shared_accel_dt_x: f32,
  shared_accel_dt_y: f32,
  shared_accel_dt_z: f32,
  // CFL velocity ceiling of the coarse grid update (cfl * coarse_dx /
  // coarse_dt). The delta prolongation clamps its raw momentum/mass parent
  // read to this bound so it lives in the same representable velocity space
  // as the (already clamped) post-update grid. Zero disables the clamp.
  max_coarse_velocity_m_per_s: f32,
  coupling_pad0: f32,
  coupling_pad1: f32,
  coupling_pad2: f32,
};

const SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE: u32 = 64u;
const SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE: u32 = 1u;
const SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST: u32 = 2u;
const SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS: u32 = 4u;
const SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID: u32 = 8u;

fn schroeder_grid_axis_coords(index: u32, dims: vec3<u32>, flags: u32) -> vec3<u32> {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    let plane = dims.y * dims.z;
    let x = index / plane;
    let rem = index - x * plane;
    return vec3<u32>(x, rem / dims.z, rem % dims.z);
  }
  return vec3<u32>(
    index % dims.x,
    (index / dims.x) % dims.y,
    index / (dims.x * dims.y)
  );
}

fn schroeder_grid_axis_index(coords: vec3<u32>, dims: vec3<u32>, flags: u32) -> u32 {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    return coords.x * dims.y * dims.z + coords.y * dims.z + coords.z;
  }
  return coords.x + dims.x * (coords.y + dims.y * coords.z);
}

fn schroeder_fine_support_axis(coarse_axis: u32, offset: i32, shift: i32) -> i32 {
  return 2 * (i32(coarse_axis) - shift) + shift + offset;
}

fn schroeder_coarse_interpolation_axis(fine_axis: u32, shift: i32) -> vec2<f32> {
  let coordinate = f32(i32(fine_axis) - shift) * 0.5 + f32(shift);
  let lower = floor(coordinate);
  return vec2<f32>(lower, coordinate - lower);
}

fn schroeder_linear_axis_weight(offset: i32) -> f32 {
  return select(0.5, 1.0, offset == 0);
}
`,Ge=`${We}
@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> coarse_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coarse_index = global_id.x;
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_count = coarse_dims.x * coarse_dims.y * coarse_dims.z;
  if (coarse_index >= coarse_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let accumulate = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE) != 0u;
  let coarse_coords = schroeder_grid_axis_coords(coarse_index, coarse_dims, params.flags);

  var mass_kg = 0.0;
  var momentum = vec3<f32>(0.0, 0.0, 0.0);
  for (var dz = -1i; dz <= 1i; dz = dz + 1i) {
    let fz = schroeder_fine_support_axis(coarse_coords.z, dz, params.grid_shift);
    if (fz < 0 || fz >= i32(fine_dims.z)) {
      continue;
    }
    let wz = schroeder_linear_axis_weight(dz);
    for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
      let fy = schroeder_fine_support_axis(coarse_coords.y, dy, params.grid_shift);
      if (fy < 0 || fy >= i32(fine_dims.y)) {
        continue;
      }
      let wy = schroeder_linear_axis_weight(dy);
      for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
        let fx = schroeder_fine_support_axis(coarse_coords.x, dx, params.grid_shift);
        if (fx < 0 || fx >= i32(fine_dims.x)) {
          continue;
        }
        let weight = schroeder_linear_axis_weight(dx) * wy * wz;
        let fine_index = schroeder_grid_axis_index(
          vec3<u32>(u32(fx), u32(fy), u32(fz)),
          fine_dims,
          params.flags
        );
        let fine_offset = fine_index * stride;
        let node_mass = max(fine_grid[fine_offset], 0.0);
        mass_kg = mass_kg + weight * node_mass;
        momentum = momentum + weight * vec3<f32>(
          fine_grid[fine_offset + 1u],
          fine_grid[fine_offset + 2u],
          fine_grid[fine_offset + 3u]
        );
      }
    }
  }

  let coarse_spacing_m = params.fine_grid_spacing_m * 2.0;
  let coarse_offset = coarse_index * stride;
  if (accumulate) {
    let total_mass = coarse_grid[coarse_offset] + mass_kg;
    coarse_grid[coarse_offset] = total_mass;
    coarse_grid[coarse_offset + 1u] = coarse_grid[coarse_offset + 1u] + momentum.x;
    coarse_grid[coarse_offset + 2u] = coarse_grid[coarse_offset + 2u] + momentum.y;
    coarse_grid[coarse_offset + 3u] = coarse_grid[coarse_offset + 3u] + momentum.z;
    coarse_grid[coarse_offset + 7u] = select(
      coarse_grid[coarse_offset + 7u],
      1.0,
      total_mass > 0.0
    );
  } else {
    coarse_grid[coarse_offset] = mass_kg;
    coarse_grid[coarse_offset + 1u] = momentum.x;
    coarse_grid[coarse_offset + 2u] = momentum.y;
    coarse_grid[coarse_offset + 3u] = momentum.z;
    coarse_grid[coarse_offset + 4u] = params.grid_origin_x_m
      + f32(i32(coarse_coords.x) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 5u] = params.grid_origin_y_m
      + f32(i32(coarse_coords.y) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 6u] = params.grid_origin_z_m
      + f32(i32(coarse_coords.z) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 7u] = select(0.0, 1.0, mass_kg > 0.0);
  }
}
`,Ke=`${We}
@group(0) @binding(0) var<storage, read> coarse_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let velocity_grids = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS) != 0u;
  var interpolated_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_index = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        );
        let coarse_offset = coarse_index * stride;
        let coarse_mass = coarse_grid[coarse_offset];
        if (!(coarse_mass > 0.0)) {
          complete = false;
          continue;
        }
        var parent_velocity = vec3<f32>(
          coarse_grid[coarse_offset + 1u],
          coarse_grid[coarse_offset + 2u],
          coarse_grid[coarse_offset + 3u]
        );
        if (!velocity_grids) { parent_velocity = parent_velocity / coarse_mass; }
        interpolated_velocity = interpolated_velocity + weight * parent_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) {
    return;
  }
  let fine_offset = fine_index * stride;
  let fine_mass = max(fine_grid[fine_offset], 0.0);
  if (!(fine_mass > 0.0)) { return; }
  if (velocity_grids) {
    fine_grid[fine_offset + 1u] = interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = interpolated_velocity.z;
  } else {
    fine_grid[fine_offset + 1u] = fine_mass * interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = fine_mass * interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = fine_mass * interpolated_velocity.z;
  }
}
`,qe=`${We}
@group(0) @binding(0) var<storage, read> coarse_pre_grid: array<f32>;
@group(0) @binding(1) var<storage, read> coarse_post_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelGridCouplingParams;

// Delta-form prolongation (AMR velocity correction): each massive fine node
// receives a trilinear interpolation of the coarse velocity change. The same
// dyadic basis is used by restriction, so complete supports preserve POU and
// reproduce affine coarse corrections. Wall response is part of the coarse
// target; no boundary-band early return is allowed to break the basis.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_offset = fine_index * stride;
  let fine_mass = fine_grid[fine_offset];
  if (fine_mass <= 0.0) {
    return;
  }
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let vmax = params.max_coarse_velocity_m_per_s;
  var pre_velocity = vec3<f32>(0.0);
  var post_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_offset = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        ) * stride;
        let pre_mass = coarse_pre_grid[coarse_offset];
        let post_mass = coarse_post_grid[coarse_offset];
        if (
          !(pre_mass > 0.0) || !(post_mass > 0.0)
          || min(pre_mass, post_mass) < 0.5 * max(pre_mass, post_mass)
        ) {
          complete = false;
          continue;
        }
        var parent_pre_velocity = vec3<f32>(
          coarse_pre_grid[coarse_offset + 1u],
          coarse_pre_grid[coarse_offset + 2u],
          coarse_pre_grid[coarse_offset + 3u]
        );
        if ((params.flags & SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID) == 0u) {
          parent_pre_velocity = parent_pre_velocity / pre_mass;
        }
        if (vmax > 0.0) {
          let largest_pre_component = max(
            max(abs(parent_pre_velocity.x), abs(parent_pre_velocity.y)),
            abs(parent_pre_velocity.z)
          );
          if (largest_pre_component > 0.0) {
            let scaled_pre_velocity =
              parent_pre_velocity / largest_pre_component;
            let scaled_pre_length = max(
              length(scaled_pre_velocity),
              1.0e-30
            );
            if (largest_pre_component > vmax / scaled_pre_length) {
              parent_pre_velocity = scaled_pre_velocity
                * (vmax / scaled_pre_length);
            }
          }
        }
        let parent_post_velocity = vec3<f32>(
          coarse_post_grid[coarse_offset + 1u],
          coarse_post_grid[coarse_offset + 2u],
          coarse_post_grid[coarse_offset + 3u]
        );
        pre_velocity = pre_velocity + weight * parent_pre_velocity;
        post_velocity = post_velocity + weight * parent_post_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) { return; }
  // delta_scale supports subcycled fine substeps: each substep applies its
  // time-interpolated share of the coarse correction (scale 1/substeps),
  // summing to the full delta across the coarse step. Zero means 1.
  // shared_accel_dt removes velocity change the fine level integrates
  // itself (gravity and other uniform shared accelerations times the
  // coarse dt), so the transferred delta carries only coarse-grid-specific
  // information and shared forces are not double counted.
  let scale = select(params.delta_scale, 1.0, params.delta_scale == 0.0);
  let shared_accel_dt = vec3<f32>(
    params.shared_accel_dt_x,
    params.shared_accel_dt_y,
    params.shared_accel_dt_z
  );
  var delta = (post_velocity - pre_velocity - shared_accel_dt) * scale;
  // Defense in depth: one substep's correction may not exceed its share of
  // the coarse solver's own velocity range (vmax * scale). With both
  // operands clamped above this is nearly redundant, but it bounds the
  // applied delta even if a future layout change reintroduces raw reads.
  if (vmax > 0.0) {
    let delta_budget = vmax * scale;
    let delta_speed2 = dot(delta, delta);
    if (delta_speed2 > delta_budget * delta_budget) {
      delta = delta * (delta_budget / sqrt(delta_speed2));
    }
  }
  fine_grid[fine_offset + 1u] = fine_grid[fine_offset + 1u] + delta.x;
  fine_grid[fine_offset + 2u] = fine_grid[fine_offset + 2u] + delta.y;
  fine_grid[fine_offset + 3u] = fine_grid[fine_offset + 3u] + delta.z;
}
`;function Je(e,{invocationKind:t,hierarchyBinding:n,paramsBinding:r}){let i=`@group(0) @binding(${n}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`,a=`@group(0) @binding(${n}) var<storage, read> hierarchy_view: array<u32>;
@group(0) @binding(${r}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`,o=t==`fine`?`34u`:`35u`,s=t==`fine`?`48u`:`49u`,c=t==`fine`?`fine_index`:`coarse_index`,l=`let compact_${t}_index = global_id.x;
  let hierarchy_admitted = arrayLength(&hierarchy_view) >= 68u
    && hierarchy_view[0u] == 0x53485631u
    && hierarchy_view[1u] == 1u
    && (hierarchy_view[2u] & 3u) == 3u
    && hierarchy_view[18u] == params.fine_nx * params.fine_ny * params.fine_nz
    && hierarchy_view[19u] == params.coarse_nx * params.coarse_ny * params.coarse_nz
    && hierarchy_view[28u] == bitcast<u32>(params.fine_grid_spacing_m)
    && hierarchy_view[29u] == bitcast<u32>(params.fine_grid_spacing_m * 2.0);
  if (!hierarchy_admitted || compact_${t}_index >= hierarchy_view[${o}]) {
    return;
  }
  let compact_node_offset = hierarchy_view[${s}];
  if (compact_node_offset + compact_${t}_index >= arrayLength(&hierarchy_view)) {
    return;
  }
  let ${c} = hierarchy_view[compact_node_offset + compact_${t}_index];`;return e.replace(i,a).replace(`let ${c} = global_id.x;`,l)}Je(Ge,{invocationKind:`coarse`,hierarchyBinding:2,paramsBinding:3}),Je(Ke,{invocationKind:`fine`,hierarchyBinding:2,paramsBinding:3}),Je(qe,{invocationKind:`fine`,hierarchyBinding:3,paramsBinding:4}),16*Uint32Array.BYTES_PER_ELEMENT,20*Uint32Array.BYTES_PER_ELEMENT,Object.freeze({magic:4,generationId:5,p2gAttempted:6,p2gDirectoryAdmitted:7,p2gReverseAdmitted:8,p2gSelected:9,g2pAttempted:10,g2pDirectoryAdmitted:11,g2pReverseAdmitted:12,g2pSelected:13,p2gHeaderRejected:14,p2gReverseRejected:15,g2pHeaderRejected:16,g2pReverseRejected:17,p2gComplete:18,g2pComplete:19});function N(e,t,n,r){if(!e.includes(t))throw Error(`Unable to build canonical mechanics WGSL; missing ${r}`);return e.replace(t,n)}function Ye(e,t,n,r,i){let a=e.indexOf(t),o=e.indexOf(n,a+t.length);if(a<0||o<0)throw Error(`Unable to build canonical mechanics WGSL; missing ${i}`);return`${e.slice(0,a)}${r}${e.slice(o)}`}function Xe(){return N(Ye(N(`
struct P2gProjectionParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  resident_product_event_count: u32,
  internal_pressure_scale: f32,
  schroeder_filter_enabled: u32,
  schroeder_selected_level: i32,
  schroeder_assignment_stride_floats: u32,
  schroeder_spatial_directory_enabled: u32,
  schroeder_spatial_storage_generation: u32,
  grid_density_pressure_enabled: u32,
  ambient_pressure_pa: f32,
  external_gauge_pressure_pa: f32,
  external_gauge_pressure_enabled: u32,
  schroeder_spatial_position_epoch: u32,
  schroeder_spatial_topology_epoch: u32,
  schroeder_spatial_required: u32,
  schroeder_spatial_generation_id: u32,
  schroeder_spatial_device_ordinal: u32,
  schroeder_spatial_lane_ordinal: u32,
  schroeder_spatial_lease_token: u32,
  schroeder_spatial_source_family_id: u32,
  schroeder_spatial_physics_tick: u32,
  schroeder_spatial_physics_substep: u32,
  schroeder_spatial_chart_epoch: u32,
  schroeder_spatial_level_epoch: u32,
  schroeder_spatial_support_epoch: u32,
  schroeder_spatial_pad0: u32,
  schroeder_spatial_pad1: u32,
  schroeder_spatial_pad2: u32,
};

// Monaghan artificial-viscosity coefficient, applied as a BULK term under
// compression at its use site below -- never as shear viscosity.
//
// Baked as a constant rather than carried in P2gProjectionParams on purpose.
// The three params pads are aliased to different meanings in different derived
// variants -- pad0 is the spatial-evidence flag, pad1 is sourceRowLayoutId in
// the mechanics-field variant, pad2 is completionOrdinal there and an epoch
// cross-check in the base -- so no pad is free in every variant, and growing
// the struct shifts the fields that createActiveGridP2gProjectionWgsl and
// createMechanicsFieldP2gProjectionWgsl append after it. Making this
// host-configurable again means extending the struct and updating all three
// writers together.
const ARTIFICIAL_BULK_VISCOSITY_ALPHA: f32 = 0.04;

struct StressRows {
  x: vec3<f32>,
  y: vec3<f32>,
  z: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> grid_accumulators: array<atomic<i32>>;
@group(0) @binding(4) var<uniform> params: P2gProjectionParams;
@group(0) @binding(5) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;
// NOTE: P2G must stay at <= 8 storage buffers so it runs on DEFAULT WebGPU
// device limits (maxStorageBuffersPerShaderStage = 8). A binding 9 for the
// (disabled, superseded-by-separation-pass) spatial-density EOS previously
// invalidated every P2G pipeline on default-limit devices, silently zeroing
// grids for standalone/test consumers.

const P2G_ATOMIC_SCALE: f32 = 65536.0;
const P2G_ATOMIC_INV_SCALE: f32 = 1.0 / P2G_ATOMIC_SCALE;

fn p2g_quantize(value: f32) -> i32 {
  return i32(round(clamp(value * P2G_ATOMIC_SCALE, -2147483000.0, 2147483000.0)));
}

fn quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn p2g_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  return weight_at(weights, offset);
}

fn p2g_storage_index(i: u32, j: u32, k: u32) -> u32 {
  return (i * params.grid_ny + j) * params.grid_nz + k;
}

fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return true;
}

const SCHROEDER_SPATIAL_MAGIC: u32 = 0x53534531u;
const SCHROEDER_SPATIAL_VERSION: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_HEADER_WORDS: u32 = 48u;
const SCHROEDER_SPATIAL_KEY_WORDS: u32 = 5u;
const SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;

fn p2g_spatial_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn p2g_spatial_directory_admitted() -> bool {
  if (params.schroeder_spatial_directory_enabled == 0u) {
    return false;
  }
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < SCHROEDER_SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = schroeder_spatial_directory[2u];
  let source_count = schroeder_spatial_directory[16u];
  let source_capacity = schroeder_spatial_directory[17u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_capacity = schroeder_spatial_directory[19u];
  let logical_required_words = schroeder_spatial_directory[20u];
  let logical_admitted_words = schroeder_spatial_directory[21u];
  let directory_capacity_words = schroeder_spatial_directory[22u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let cell_offsets_offset_words = schroeder_spatial_directory[30u];
  let cell_members_offset_words = schroeder_spatial_directory[31u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let rejected_flags = SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let sort_key_words = schroeder_spatial_directory[26u];
  let sort_mode = schroeder_spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == SCHROEDER_SPATIAL_KEY_WORDS
  );
  let build_ordinal = schroeder_spatial_directory[33u];
  let primitive_status = schroeder_spatial_directory[41u];
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words < SCHROEDER_SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_offsets_offset_words > directory_capacity_words
    || cell_members_offset_words > directory_capacity_words
    || particle_to_cell_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words)
      / SCHROEDER_SPATIAL_KEY_WORDS
    || cell_offsets_offset_words < cell_keys_offset_words
      + cell_capacity * SCHROEDER_SPATIAL_KEY_WORDS
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words < cell_offsets_offset_words + cell_capacity + 1u
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words < cell_members_offset_words + source_capacity
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
  ) {
    return false;
  }
  return schroeder_spatial_directory[0u] == SCHROEDER_SPATIAL_MAGIC
    // v1 and v2 directory ABIs share this gate's header invariants; see the
    // authority-module version note. Pinning v1 froze all v2 mechanics.
    && (
      schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION
      || schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION + 1u
    )
    && (flags & (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED))
      == (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
    && schroeder_spatial_directory[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && schroeder_spatial_directory[4u] == params.schroeder_spatial_device_ordinal
    && schroeder_spatial_directory[5u] == params.schroeder_spatial_lane_ordinal
    && schroeder_spatial_directory[6u] == params.schroeder_spatial_lease_token
    && schroeder_spatial_directory[7u] == params.schroeder_spatial_source_family_id
    && schroeder_spatial_directory[8u] == params.schroeder_spatial_storage_generation
    && schroeder_spatial_directory[9u] == params.schroeder_spatial_physics_tick
    && schroeder_spatial_directory[10u] == params.schroeder_spatial_physics_substep
    && schroeder_spatial_directory[11u] == params.schroeder_spatial_position_epoch
    && schroeder_spatial_directory[12u] == params.schroeder_spatial_topology_epoch
    && schroeder_spatial_directory[13u] == params.schroeder_spatial_chart_epoch
    && schroeder_spatial_directory[14u] == params.schroeder_spatial_level_epoch
    && schroeder_spatial_directory[15u] == params.schroeder_spatial_support_epoch
    && source_count == params.particle_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && logical_required_words == logical_admitted_words
    && logical_admitted_words >= SCHROEDER_SPATIAL_HEADER_WORDS
    && logical_admitted_words <= physical_upper_bound_words
    && schroeder_spatial_directory[23u] == 0u
    && schroeder_spatial_directory[24u] == 0u
    && schroeder_spatial_directory[25u] == SCHROEDER_SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && schroeder_spatial_directory[28u] == SCHROEDER_SPATIAL_HEADER_WORDS
    && cell_keys_offset_words == SCHROEDER_SPATIAL_HEADER_WORDS
    && build_ordinal != 0u
    && schroeder_spatial_directory[34u] == build_ordinal
    && schroeder_spatial_directory[35u] == build_ordinal
    && schroeder_spatial_directory[36u] == params.schroeder_spatial_generation_id
    && schroeder_spatial_directory[37u] == source_count
    && schroeder_spatial_directory[38u] == cell_count
    && schroeder_spatial_directory[39u] != 0u
    && schroeder_spatial_directory[40u] == 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && schroeder_spatial_directory[45u] >= SCHROEDER_SPATIAL_HEADER_WORDS
    && (
      schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
      || schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    )
    && physical_upper_bound_words <= directory_capacity_words
    && p2g_spatial_range_within(
      cell_keys_offset_words,
      cell_count * SCHROEDER_SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_members_offset_words,
      source_count,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      physical_upper_bound_words
    );
}

fn p2g_spatial_particle_level(particle_index: u32) -> i32 {
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  // Reverse map is cell-index-plus-one ('cell-index-plus-one-zero-dormant');
  // zero = dormant/missing sentinel. A raw decode silently rejected the
  // final cell's occupants and shifted every other lookup by one cell.
  let reverse_entry = schroeder_spatial_directory[particle_to_cell_offset_words + particle_index];
  if (reverse_entry == 0u) {
    return bitcast<i32>(0x80000000u);
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    return bitcast<i32>(0x80000000u);
  }
  let level_order_key = schroeder_spatial_directory[
    cell_keys_offset_words + cell_index * SCHROEDER_SPATIAL_KEY_WORDS + 1u
  ];
  return bitcast<i32>(level_order_key ^ 0x80000000u);
}

// Canonical SS mechanics admits particles through the directory reverse map.
// The assignment-row lookup remains the safe fallback for explicitly
// noncanonical callers and for any malformed/stale GPU generation. Never turn
// a provenance failure into a zero-physics frame.
fn p2g_particle_enabled(particle_index: u32) -> bool {
  let spatial_admitted = p2g_spatial_directory_admitted();
  if (spatial_admitted) {
    let spatial_level = p2g_spatial_particle_level(particle_index);
    // A malformed reverse-map entry is a provenance failure for this
    // particle, not authority to remove it from mechanics.
    if (spatial_level != bitcast<i32>(0x80000000u)) {
      return spatial_level == params.schroeder_selected_level;
    }
  }
  if (params.schroeder_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_assignment_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}

fn p2g_try_storage_index(node_i: i32, node_j: i32, node_k: i32) -> u32 {
  let i = node_i + i32(params.shift);
  let j = node_j + i32(params.shift);
  let k = node_k + i32(params.shift);
  if (
    i < 0 || j < 0 || k < 0
    || i >= i32(params.grid_nx)
    || j >= i32(params.grid_ny)
    || k >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  let storage_i = u32(i);
  let storage_j = u32(j);
  let storage_k = u32(k);
  if (!p2g_node_enabled(storage_i, storage_j, storage_k)) {
    return params.grid_node_count;
  }
  return p2g_storage_index(storage_i, storage_j, storage_k);
}

fn p2g_atomic_add(node_index: u32, mass: f32, momentum: vec3<f32>) {
  let base = node_index * 4u;
  atomicAdd(&grid_accumulators[base], p2g_quantize(mass));
  atomicAdd(&grid_accumulators[base + 1u], p2g_quantize(momentum.x));
  atomicAdd(&grid_accumulators[base + 2u], p2g_quantize(momentum.y));
  atomicAdd(&grid_accumulators[base + 3u], p2g_quantize(momentum.z));
}

fn product_event_row0(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u];
}

fn product_event_row1(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 1u];
}

fn product_event_row2(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 2u];
}

fn product_event_row3(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 3u];
}

fn product_event_row4(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 4u];
}

fn product_event_row5(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 5u];
}

fn product_event_row6(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 6u];
}

fn product_event_row7(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 7u];
}

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn packed_pressure(density_kg_per_m3: f32, rest_density_kg_per_m3: f32, sound_speed_m_per_s: f32, eos_model_id: f32) -> f32 {
  if (density_kg_per_m3 <= 0.0 || rest_density_kg_per_m3 <= 0.0 || sound_speed_m_per_s <= 0.0) {
    return 0.0;
  }
  if (eos_model_id > 1.5 && eos_model_id < 2.5) {
    // Gas pressure push is capped near a few times the rest density so a
    // just-vaporized particle at condensed packing exerts a bounded,
    // saturation-scale expansion pressure instead of c^2*(1000 - 0.6).
    let effective_density = min(density_kg_per_m3, rest_density_kg_per_m3 * 3.0);
    return max(0.0, sound_speed_m_per_s * sound_speed_m_per_s * (effective_density - rest_density_kg_per_m3));
  }
  if (eos_model_id > 0.5 && eos_model_id < 1.5) {
    let ratio = density_kg_per_m3 / max(rest_density_kg_per_m3, 1.0e-9);
    let stiffness = rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0;
    let pressure = stiffness * (pow(ratio, 7.0) - 1.0);
    // Cavitation clamp: a liquid cannot sustain bulk-scale tension - it
    // cavitates. The unbounded signed Tait tension acted as huge artificial
    // cohesion and drove the MLS-MPM tensile pairing instability (particles
    // collapsing to mm separation and beading into pearl-string clumps).
    // Keep a small restoring band below rest density for volume correction,
    // floored at a cavitation-scale fraction of the Tait stiffness.
    return max(pressure, -0.05 * stiffness);
  }
  return 0.0;
}

fn corotated_stress(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32,
  mu: f32,
  lambda: f32
) -> StressRows {
  var r0 = f00; var r1 = f01; var r2 = f02;
  var r3 = f10; var r4 = f11; var r5 = f12;
  var r6 = f20; var r7 = f21; var r8 = f22;
  for (var it = 0u; it < 12u; it = it + 1u) {
    let rd = det3(r0, r1, r2, r3, r4, r5, r6, r7, r8);
    if (abs(rd) < 1.0e-12) {
      break;
    }
    let id = 1.0 / rd;
    let t0 = (r4 * r8 - r5 * r7) * id; let t3 = (r2 * r7 - r1 * r8) * id; let t6 = (r1 * r5 - r2 * r4) * id;
    let t1 = (r5 * r6 - r3 * r8) * id; let t4 = (r0 * r8 - r2 * r6) * id; let t7 = (r2 * r3 - r0 * r5) * id;
    let t2 = (r3 * r7 - r4 * r6) * id; let t5 = (r1 * r6 - r0 * r7) * id; let t8 = (r0 * r4 - r1 * r3) * id;
    let n0 = 0.5 * (r0 + t0); let n1 = 0.5 * (r1 + t1); let n2 = 0.5 * (r2 + t2);
    let n3 = 0.5 * (r3 + t3); let n4 = 0.5 * (r4 + t4); let n5 = 0.5 * (r5 + t5);
    let n6 = 0.5 * (r6 + t6); let n7 = 0.5 * (r7 + t7); let n8 = 0.5 * (r8 + t8);
    let diff = abs(n0 - r0) + abs(n4 - r4) + abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2;
    r3 = n3; r4 = n4; r5 = n5;
    r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1.0e-10) {
      break;
    }
  }

  let j = det3(f00, f01, f02, f10, f11, f12, f20, f21, f22);
  if (abs(j) < 1.0e-12) {
    return StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  }
  let jid = 1.0 / j;
  let ft0 = (f11 * f22 - f12 * f21) * jid; let ft3 = (f02 * f21 - f01 * f22) * jid; let ft6 = (f01 * f12 - f02 * f11) * jid;
  let ft1 = (f12 * f20 - f10 * f22) * jid; let ft4 = (f00 * f22 - f02 * f20) * jid; let ft7 = (f02 * f10 - f00 * f12) * jid;
  let ft2 = (f10 * f21 - f11 * f20) * jid; let ft5 = (f01 * f20 - f00 * f21) * jid; let ft8 = (f00 * f11 - f01 * f10) * jid;
  let c = lambda * (j - 1.0) * j;
  let p0 = 2.0 * mu * (f00 - r0) + c * ft0; let p1 = 2.0 * mu * (f01 - r1) + c * ft1; let p2 = 2.0 * mu * (f02 - r2) + c * ft2;
  let p3 = 2.0 * mu * (f10 - r3) + c * ft3; let p4 = 2.0 * mu * (f11 - r4) + c * ft4; let p5 = 2.0 * mu * (f12 - r5) + c * ft5;
  let p6 = 2.0 * mu * (f20 - r6) + c * ft6; let p7 = 2.0 * mu * (f21 - r7) + c * ft7; let p8 = 2.0 * mu * (f22 - r8) + c * ft8;
  return StressRows(
    vec3<f32>((p0 * f00 + p1 * f01 + p2 * f02) * jid, (p0 * f10 + p1 * f11 + p2 * f12) * jid, (p0 * f20 + p1 * f21 + p2 * f22) * jid),
    vec3<f32>((p3 * f00 + p4 * f01 + p5 * f02) * jid, (p3 * f10 + p4 * f11 + p5 * f12) * jid, (p3 * f20 + p4 * f21 + p5 * f22) * jid),
    vec3<f32>((p6 * f00 + p7 * f01 + p8 * f02) * jid, (p6 * f10 + p7 * f11 + p8 * f12) * jid, (p6 * f20 + p7 * f21 + p8 * f22) * jid)
  );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }

  let state_base = particle_index * 2u;
  let thermo_base = particle_index * 3u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let thermo0 = sph_thermo[thermo_base];
  let _thermo_status = sph_thermo[thermo_base + 2u].z;
  if (!(pos_mass.w > 0.0)) {
    return;
  }

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = quadratic_weights(p_grid.x - f32(base_x));
  let wy = quadratic_weights(p_grid.y - f32(base_y));
  let wz = quadratic_weights(p_grid.z - f32(base_z));

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];
  let thermo1 = sph_thermo[thermo_base + 1u];
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
  // Current volume is authoritative only when both stored V0 and J are
  // finite-positive. Do not manufacture a pressure volume by clamping an
  // invalid determinant.
  let volume = select(
    0.0,
    row4.w * row4.z,
    row4.w > 0.0 && row4.z > 0.0
  );
  var resolved_absolute_pressure_pa = max(params.ambient_pressure_pa, 0.0);
  var sigma = StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  if (volume > 0.0) {
    if (row5.x > 0.5 && row5.w > 0.0) {
      sigma = corotated_stress(
        f00, f01, f02,
        f10, f11, f12,
        f20, f21, f22,
        row5.w,
        row6.x
      );
      // Positive Cauchy trace is tensile in the corotated convention, so the
      // scalar mechanical pressure is -tr(sigma)/3.
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa
          - (sigma.x.x + sigma.y.y + sigma.z.z) / 3.0
      );
    } else {
      let density = pos_mass.w / max(volume, 1.0e-30);
      // Pressure comes from the EOS via the tracked volume ratio J only. The
      // per-particle static hydrostatic prestress (row7.x) is intentionally
      // NOT added: a depth-frozen pressure field becomes unbalanced as soon
      // as particles circulate and pumps energy into the liquid.
      // On a vaporization plateau the growing gas fraction exerts a reduced-
      // speed isothermal gas pressure. row6.y is the material sound speed
      // after the host's acoustic-CFL reduction, so admitted gas must use it
      // just like every other packed EOS. Bypassing it with P_atm/rho_rest
      // silently restored the physical sound speed and made the explicit
      // mechanics step unstable.
      //
      // rho_reference scales the standard-atmosphere rest density to the
      // configured ambient pressure. This preserves zero gauge pressure at
      // rho_rest under one atmosphere while making the stiffness c^2 and
      // therefore convergent toward the physical EOS as dt is refined.
      let gas_fraction = clamp(thermo1.z, 0.0, 1.0);
      let gas_reference_density = thermo0.w * params.ambient_pressure_pa / 101325.0;
      let gas_partial_pressure = row6.y * row6.y * (density - gas_reference_density);
      let packed_material_pressure = packed_pressure(density, thermo0.w, row6.y, row6.z);
      let gas_eos = row6.z > 1.5 && row6.z < 2.5;
      // Admitted gas uses the ambient-referenced branch; the packed bounded
      // branch remains available for positionless product-event sidecars that
      // do not carry the ambient-pressure inputs yet.
      let pressure = params.internal_pressure_scale * select(
        packed_material_pressure,
        gas_fraction * gas_partial_pressure,
        gas_eos
      );
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa + pressure
      );
      // row7.y is the material's PHYSICAL shear viscosity. Artificial
      // viscosity is deliberately not folded into it: the deviatoric terms
      // below are traceless, so anything added to row7.y resists shear and
      // does nothing in compression -- the exact opposite of what a
      // shock-stabilizing artificial viscosity is for. Folding alpha*rho*c*h
      // into it gave water ~2000 Pa.s of shear viscosity against a physical
      // 0.001, roughly two million times too much: thicker than molasses,
      // which is why liquids crept instead of flowing.
      let dynamic_viscosity = max(row7.y, 0.0);
      let div_third = (c00 + c11 + c22) / 3.0;
      // The artificial term therefore appears here, as a bulk pressure gated
      // on compression: zeta = alpha * rho * c * h, p = -zeta * div(v) when
      // div(v) < 0. It damps acoustic oscillation without opposing shear.
      //
      // It is deliberately NOT folded into resolved_absolute_pressure_pa
      // above: that lane carries thermodynamic pressure authority, and a
      // numerical stabilizer is not a physical pressure.
      let velocity_divergence = 3.0 * div_third;
      let artificial_bulk_viscosity = ARTIFICIAL_BULK_VISCOSITY_ALPHA
        * density
        * max(row6.y, 0.0)
        * params.grid_spacing_m;
      let artificial_bulk_pressure = select(
        0.0,
        -artificial_bulk_viscosity * velocity_divergence,
        velocity_divergence < 0.0
      );
      let total_pressure = pressure + artificial_bulk_pressure;
      let visc00 = 2.0 * dynamic_viscosity * (c00 - div_third);
      let visc11 = 2.0 * dynamic_viscosity * (c11 - div_third);
      let visc22 = 2.0 * dynamic_viscosity * (c22 - div_third);
      let visc01 = dynamic_viscosity * (c01 + c10);
      let visc02 = dynamic_viscosity * (c02 + c20);
      let visc12 = dynamic_viscosity * (c12 + c21);
      sigma = StressRows(
        vec3<f32>(-total_pressure + visc00, visc01, visc02),
        vec3<f32>(visc01, -total_pressure + visc11, visc12),
        vec3<f32>(visc02, visc12, -total_pressure + visc22)
      );
    }
    if (params.external_gauge_pressure_enabled != 0u) {
      // The interface gas load is an external boundary traction. Internal EOS
      // pressure is represented by -pI and expands a free body in this P2G
      // weak form; the equivalent inward gas traction therefore adds +pI.
      // solid+liquid excludes gas and plasma while remaining continuous
      // through a phase transition.
      let condensed_fraction = clamp(thermo1.x + thermo1.y, 0.0, 1.0);
      let external_pressure = params.external_gauge_pressure_pa * condensed_fraction;
      sigma = StressRows(
        sigma.x + vec3<f32>(external_pressure, 0.0, 0.0),
        sigma.y + vec3<f32>(0.0, external_pressure, 0.0),
        sigma.z + vec3<f32>(0.0, 0.0, external_pressure)
      );
    }
  }
  let stress_scale = -params.dt * volume * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
  let aff_x = vec3<f32>(
    pos_mass.w * c00 + stress_scale * sigma.x.x,
    pos_mass.w * c01 + stress_scale * sigma.x.y,
    pos_mass.w * c02 + stress_scale * sigma.x.z
  );
  let aff_y = vec3<f32>(
    pos_mass.w * c10 + stress_scale * sigma.y.x,
    pos_mass.w * c11 + stress_scale * sigma.y.y,
    pos_mass.w * c12 + stress_scale * sigma.y.z
  );
  let aff_z = vec3<f32>(
    pos_mass.w * c20 + stress_scale * sigma.z.x,
    pos_mass.w * c21 + stress_scale * sigma.z.y,
    pos_mass.w * c22 + stress_scale * sigma.z.z
  );

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        if (weight == 0.0) {
          continue;
        }
        let node_pos = vec3<f32>(
          f32(node_i) * params.grid_spacing_m,
          f32(node_j) * params.grid_spacing_m,
          f32(node_k) * params.grid_spacing_m
        );
        let dpos = node_pos - pos_mass.xyz;
        let affine_momentum = vec3<f32>(
          dot(aff_x, dpos),
          dot(aff_y, dpos),
          dot(aff_z, dpos)
        );
        let particle_momentum = pos_mass.w * vel_u.xyz + affine_momentum;
        p2g_atomic_add(node_index, weight * pos_mass.w, weight * particle_momentum);
      }
    }
  }
}

@compute @workgroup_size(64)
fn scatter_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (event_index >= params.resident_product_event_count) {
    return;
  }

  let event0 = product_event_row0(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event5 = product_event_row5(event_index);
  let event6 = product_event_row6(event_index);
  let event7 = product_event_row7(event_index);
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (event_status != 1.0 || event_unplaced_mass_kg <= 0.0) {
    return;
  }

  let event_grid = event0.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(event_grid.x - 0.5));
  let base_y = i32(floor(event_grid.y - 0.5));
  let base_z = i32(floor(event_grid.z - 0.5));
  let wx = quadratic_weights(event_grid.x - f32(base_x));
  let wy = quadratic_weights(event_grid.y - f32(base_y));
  let wz = quadratic_weights(event_grid.z - f32(base_z));
  let support_volume_m3 = max(event5.w, 0.0);
  let rest_density_kg_per_m3 = event4.y;
  let sound_speed_m_per_s = event6.w;
  let eos_model_id = event7.x;

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        if (weight == 0.0) {
          continue;
        }
        var pressure_affine = vec3<f32>(0.0);
        if (params.dt != 0.0 && support_volume_m3 > 0.0) {
          let event_density = event_unplaced_mass_kg / max(support_volume_m3, 1.0e-30);
          let event_pressure = params.internal_pressure_scale * packed_pressure(
            event_density,
            rest_density_kg_per_m3,
            sound_speed_m_per_s,
            eos_model_id
          );
          let event_stress_scale = -params.dt * support_volume_m3 * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
          let diagonal_affine = event_stress_scale * -event_pressure;
          let node_pos = vec3<f32>(
            f32(node_i) * params.grid_spacing_m,
            f32(node_j) * params.grid_spacing_m,
            f32(node_k) * params.grid_spacing_m
          );
          let event_dpos = node_pos - event0.xyz;
          pressure_affine = vec3<f32>(
            diagonal_affine * event_dpos.x,
            diagonal_affine * event_dpos.y,
            diagonal_affine * event_dpos.z
          );
        }
        p2g_atomic_add(
          node_index,
          weight * event_unplaced_mass_kg,
          weight * (event_unplaced_mass_kg * event5.xyz + pressure_affine)
        );
      }
    }
  }
}

@compute @workgroup_size(64)
fn finalize_grid(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }

  let accumulator_base = node_index * 4u;
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;
  let momentum = vec3<f32>(
    f32(atomicLoad(&grid_accumulators[accumulator_base + 1u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 2u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 3u])) * P2G_ATOMIC_INV_SCALE
  );

  let plane = params.grid_ny * params.grid_nz;
  let i = node_index / plane;
  let rem = node_index - i * plane;
  let j = rem / params.grid_nz;
  let k = rem - j * params.grid_nz;
  let node_i = i32(i) - i32(params.shift);
  let node_j = i32(j) - i32(params.shift);
  let node_k = i32(k) - i32(params.shift);
  let node_pos = vec3<f32>(
    f32(node_i) * params.grid_spacing_m,
    f32(node_j) * params.grid_spacing_m,
    f32(node_k) * params.grid_spacing_m
  );

  let status = select(0.0, 1.0, mass > 0.0);
  grid_nodes[node_index * 2u] = vec4<f32>(mass, momentum.x, momentum.y, momentum.z);
  grid_nodes[node_index * 2u + 1u] = vec4<f32>(node_pos.x, node_pos.y, node_pos.z, status);
}
`,`@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;`,`@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;`,`P2G assignment binding`),`// Canonical SS mechanics admits particles through the directory reverse map.`,`
fn p2g_finalize_node_index`,`// Canonical SS mechanics has one level/topology authority. Binding 7 is
// compact, opt-in evidence in this variant; no assignment row is declared.
// Invocation zero authenticates the immutable directory header/query once.
// Every particle independently bounds-checks its reverse-map and chart reads;
// the ordered grid finalizer globally zeroes all output if either check fails.
fn p2g_canonical_query_geometry_admitted() -> bool {
  let source_count = schroeder_spatial_directory[16u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  // The builder writes the 6-word query profile at particle_to_cell +
  // physical_radix_count (the radix CAPACITY, not the live source count),
  // and word 47's physical high water lands exactly at its end. Deriving
  // the offset from the live count read a zeroed gap whenever live !=
  // capacity, which failed base_spacing > 0 and froze mechanics via the
  // global fail-closed rollback.
  if (physical_upper_bound_words < 6u) {
    return false;
  }
  let query_offset_words = physical_upper_bound_words - 6u;
  if (
    schroeder_spatial_directory[46u]
      != SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || !p2g_spatial_range_within(query_offset_words, 6u, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_min_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 1u]);
  let query_max_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 2u]);
  let base_spacing_m = bitcast<f32>(schroeder_spatial_directory[query_offset_words + 3u]);
  let expected_spacing_m = base_spacing_m * exp2(f32(params.schroeder_selected_level));
  return query_min_level <= params.schroeder_selected_level
    && params.schroeder_selected_level <= query_max_level
    && base_spacing_m > 0.0
    && expected_spacing_m > 0.0
    && bitcast<u32>(expected_spacing_m) == bitcast<u32>(params.grid_spacing_m);
}

fn p2g_spatial_evidence_add(word: u32, value: u32) {
  if (
    params.schroeder_spatial_pad0 != 0u
    && word < arrayLength(&schroeder_spatial_authority_evidence)
  ) {
    atomicAdd(&schroeder_spatial_authority_evidence[word], value);
  }
}

fn p2g_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}

fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}

fn p2g_spatial_evidence_identity(particle_index: u32) {
  if (params.schroeder_spatial_pad0 == 0u || particle_index != 0u) {
    return;
  }
  atomicStore(&schroeder_spatial_authority_evidence[4u], 0x4d534131u);
  atomicStore(
    &schroeder_spatial_authority_evidence[5u],
    params.schroeder_spatial_generation_id
  );
}

fn p2g_authenticate_spatial_header(particle_index: u32) {
  if (particle_index != 0u) {
    return;
  }
  p2g_spatial_evidence_identity(particle_index);
  p2g_spatial_evidence_add(6u, params.particle_count);
  // Observed diagnostics split the two admission stages: word 7 gains +1
  // for the directory header check and +2 for the query-geometry check, so
  // a rejection names its stage (1 = header only, 2 = geometry only,
  // particle_count-scaled legacy semantics preserved when both pass).
  let header_admitted = p2g_spatial_directory_admitted();
  if (header_admitted) {
    p2g_spatial_evidence_add(7u, 1u);
  }
  var directory_admitted = header_admitted;
  if (directory_admitted) {
    let geometry_admitted = p2g_canonical_query_geometry_admitted();
    if (geometry_admitted) {
      p2g_spatial_evidence_add(7u, 2u);
    }
    directory_admitted = geometry_admitted;
  }
  if (!directory_admitted) {
    p2g_spatial_reject(14u);
  }
}

fn p2g_particle_enabled(particle_index: u32) -> bool {
  p2g_authenticate_spatial_header(particle_index);
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < SCHROEDER_SPATIAL_HEADER_WORDS) {
    p2g_spatial_reject(15u);
    return false;
  }
  let source_count = schroeder_spatial_directory[16u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  if (
    particle_index >= source_count
    || !p2g_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      bound_words
    )
    || cell_keys_offset_words > bound_words
    || cell_count > (bound_words - cell_keys_offset_words)
      / SCHROEDER_SPATIAL_KEY_WORDS
  ) {
    p2g_spatial_reject(15u);
    return false;
  }
  // Query profile sits at the end of the physical region (word 47 high
  // water minus its 6 words); see p2g_canonical_query_geometry_admitted.
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  if (physical_upper_bound_words < 6u) {
    p2g_spatial_reject(15u);
    return false;
  }
  let query_offset_words = physical_upper_bound_words - 6u;
  if (!p2g_spatial_range_within(query_offset_words, 6u, bound_words)) {
    p2g_spatial_reject(15u);
    return false;
  }
  // Every live directory encodes the physical reverse map as
  // cell-index-plus-one with zero as the dormant/missing sentinel
  // ('cell-index-plus-one-zero-dormant'); decoding it raw silently
  // rejected the whole final cell's particles, and the global fail-closed
  // finalize then rolled back every step's mechanics.
  let reverse_entry = schroeder_spatial_directory[
    particle_to_cell_offset_words + particle_index
  ];
  if (reverse_entry == 0u) {
    p2g_spatial_reject(15u);
    return false;
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    p2g_spatial_reject(15u);
    return false;
  }
  let cell_key_offset_words = cell_keys_offset_words
    + cell_index * SCHROEDER_SPATIAL_KEY_WORDS;
  if (
    schroeder_spatial_directory[cell_key_offset_words]
      != schroeder_spatial_directory[query_offset_words]
  ) {
    p2g_spatial_reject(15u);
    return false;
  }
  let spatial_level = bitcast<i32>(
    schroeder_spatial_directory[cell_key_offset_words + 1u] ^ 0x80000000u
  );
  p2g_spatial_evidence_add(8u, 1u);
  let selected = spatial_level == params.schroeder_selected_level;
  if (selected) {
    p2g_spatial_evidence_add(9u, 1u);
  }
  if (particle_index + 1u == params.particle_count) {
    p2g_spatial_evidence_add(18u, 1u);
  }
  return selected;
}
`,`P2G authority gate`),`  let accumulator_base = node_index * 4u;
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;`,`  let accumulator_base = node_index * 4u;
  if (p2g_spatial_authority_rejected()) {
    grid_nodes[node_index * 2u] = vec4<f32>(0.0);
    grid_nodes[node_index * 2u + 1u] = vec4<f32>(0.0);
    return;
  }
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;`,`P2G fail-closed finalize gate`)}function Ze(){return`${Ye(N(N(N(`
struct G2pParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  schroeder_active_node_filter_enabled: u32,
  schroeder_selected_level: i32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  internal_pressure_scale: f32,
  liquid_wall_damping_alpha: f32,
  liquid_wall_damping_distance_m: f32,
  schroeder_active_node_stride_floats: u32,
  schroeder_level_filter_enabled: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: G2pParams;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;

fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn g2p_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn g2p_det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn g2p_cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

const G2P_MIN_VOLUME_RATIO_J: f32 = 0.1;
const G2P_MAX_RADIUS_GROWTH_RATIO: f32 = 4.0;
const G2P_MAX_VOLUME_RATIO_J: f32 = 64.0;
// Gas particles expand until their density reaches the vacuum-expansion
// floor of 0.1% rest density (J_max = rho_rest/rho_floor = 1000) instead of
// the condensed-phase 64x volume cap. The fixed cap froze expanding gas at
// 64x rest volume, giving it a false liquid-like free surface (a discrete
// "gas top" a solid could rest in) while the pressure law kept pushing.
// With the gauge ideal-gas pressure (P proportional to rho ~ 1/J) the pair
// (pressure, volume) stays integrable as J grows: P at the floor is 1e-3 atm,
// so gas fills the domain and settles instead of pooling.
const G2P_MAX_VOLUME_RATIO_J_GAS: f32 = 1000.0;

fn g2p_max_volume_ratio_j(eos_model_id: f32) -> f32 {
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(G2P_MAX_VOLUME_RATIO_J, G2P_MAX_VOLUME_RATIO_J_GAS, is_gas);
}

fn g2p_particle_wall_clearance(rest_volume_m3: f32) -> f32 {
  if (rest_volume_m3 <= 0.0) {
    return 0.0;
  }
  var clearance = 0.5 * g2p_cubic_root_positive(rest_volume_m3);
  // The wall boundary condition operates at grid resolution: a clearance
  // larger than half a cell builds a phantom forbidden shell inside the box.
  // Low-density phases made that shell meters thick (steam rest volume is
  // ~1.7 m^3/kg, so 0.5*v0^(1/3) pinned steam mid-air, "800 K water" to the
  // floor, and quench splash to a ceiling shelf at box_y - clearance).
  // Compressible parcels overlap walls physically; sub-cell wall response
  // belongs to the pressure law, not a rigid-ball radius.
  clearance = min(clearance, 0.5 * params.grid_spacing_m);
  let min_dim = min(params.box_x, min(params.box_y, params.box_z));
  if (min_dim > 0.0) {
    clearance = min(clearance, 0.49 * min_dim);
  }
  return clearance;
}

fn g2p_clamp(value: f32, lower: f32, upper: f32) -> f32 {
  return min(max(value, lower), upper);
}

fn g2p_condensed_target_j(raw_next_j: f32, previous_j: f32) -> f32 {
  let previous_bounded = g2p_clamp(previous_j, 0.95, 1.05);
  let lower = max(0.95, previous_bounded / 1.5);
  let upper = min(1.05, previous_bounded * 1.5);
  return g2p_clamp(raw_next_j, lower, upper);
}

fn g2p_grid_index(i: i32, j: i32, k: i32) -> u32 {
  return (u32(i + i32(params.shift)) * params.grid_ny + u32(j + i32(params.shift))) * params.grid_nz + u32(k + i32(params.shift));
}

fn g2p_in_range(i: i32, j: i32, k: i32) -> bool {
  let ii = i + i32(params.shift);
  let jj = j + i32(params.shift);
  let kk = k + i32(params.shift);
  return ii >= 0 && jj >= 0 && kk >= 0
    && ii < i32(params.grid_nx)
    && jj < i32(params.grid_ny)
    && kk < i32(params.grid_nz);
}

// Level-filtered G2P with copy-through: only particles assigned to the
// selected level reconstruct from this grid; other particles copy their
// input state through unchanged so a coarser/finer pass (or the caller)
// keeps authority over them. Assignment rows are particle-parallel; the
// compacted active-node list is NOT and must never gate particles here.
fn g2p_particle_enabled(particle_index: u32) -> bool {
  if (params.schroeder_active_node_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_active_node_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn g2p_copy_input_particle(state_base: u32, mechanics_base: u32) {
  out_sph_state[state_base] = sph_state[state_base];
  out_sph_state[state_base + 1u] = sph_state[state_base + 1u];
  out_mls_mechanics[mechanics_base] = mls_mechanics[mechanics_base];
  out_mls_mechanics[mechanics_base + 1u] = mls_mechanics[mechanics_base + 1u];
  out_mls_mechanics[mechanics_base + 2u] = mls_mechanics[mechanics_base + 2u];
  out_mls_mechanics[mechanics_base + 3u] = mls_mechanics[mechanics_base + 3u];
  out_mls_mechanics[mechanics_base + 4u] = mls_mechanics[mechanics_base + 4u];
  out_mls_mechanics[mechanics_base + 5u] = mls_mechanics[mechanics_base + 5u];
  out_mls_mechanics[mechanics_base + 6u] = mls_mechanics[mechanics_base + 6u];
  out_mls_mechanics[mechanics_base + 7u] = mls_mechanics[mechanics_base + 7u];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  if (!g2p_particle_enabled(particle_index)) {
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;
  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = g2p_quadratic_weights(p_grid.x - f32(base_x));
  let wy = g2p_quadratic_weights(p_grid.y - f32(base_y));
  let wz = g2p_quadratic_weights(p_grid.z - f32(base_z));

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var c00 = 0.0; var c01 = 0.0; var c02 = 0.0;
  var c10 = 0.0; var c11 = 0.0; var c12 = 0.0;
  var c20 = 0.0; var c21 = 0.0; var c22 = 0.0;
  var sampled_weight = 0.0;

  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let node_i = base_x + a;
        let node_j = base_y + b;
        let node_k = base_z + c;
        if (!g2p_in_range(node_i, node_j, node_k)) {
          continue;
        }
        let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
        if (weight == 0.0) {
          continue;
        }
        let idx = g2p_grid_index(node_i, node_j, node_k);
        let grid_row = updated_grid_nodes[idx * 2u];
        let grid_meta = updated_grid_nodes[idx * 2u + 1u];
        if (!(grid_row.x > 0.0) && !(grid_meta.w > 0.0)) {
          continue;
        }
        sampled_weight = sampled_weight + weight;
        let grid_velocity = grid_row.yzw;
        velocity = velocity + weight * grid_velocity;
        let dpos = (vec3<f32>(f32(node_i), f32(node_j), f32(node_k)) - p_grid) * params.grid_spacing_m;
        let s = 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m * weight;
        c00 = c00 + s * grid_velocity.x * dpos.x;
        c01 = c01 + s * grid_velocity.x * dpos.y;
        c02 = c02 + s * grid_velocity.x * dpos.z;
        c10 = c10 + s * grid_velocity.y * dpos.x;
        c11 = c11 + s * grid_velocity.y * dpos.y;
        c12 = c12 + s * grid_velocity.y * dpos.z;
        c20 = c20 + s * grid_velocity.z * dpos.x;
        c21 = c21 + s * grid_velocity.z * dpos.y;
        c22 = c22 + s * grid_velocity.z * dpos.z;
      }
    }
  }
  if (sampled_weight > 1.0e-8 && sampled_weight < 0.999999) {
    let normalization = 1.0 / sampled_weight;
    velocity = velocity * normalization;
    c00 = c00 * normalization; c01 = c01 * normalization; c02 = c02 * normalization;
    c10 = c10 * normalization; c11 = c11 * normalization; c12 = c12 * normalization;
    c20 = c20 * normalization; c21 = c21 * normalization; c22 = c22 * normalization;
  }

  var position = pos_mass.xyz + params.dt * velocity;
  let wall_clearance = g2p_particle_wall_clearance(row4.w);
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let solid = row5.x > 0.5;
  let condensed = solid || (row6.z > 0.5 && row6.z < 1.5);
  if (!solid && condensed && params.liquid_wall_damping_alpha > 0.0 && params.liquid_wall_damping_distance_m > 0.0) {
    let floor_distance = max(position.y - wall_clearance, 0.0);
    if (floor_distance < params.liquid_wall_damping_distance_m) {
      let q = 1.0 - floor_distance / params.liquid_wall_damping_distance_m;
      let keep = g2p_clamp(1.0 - params.liquid_wall_damping_alpha * q * q, 0.0, 1.0);
      velocity = velocity * keep;
    }
  }
  let deformation_disabled = !solid && (row6.z < 0.5 || params.internal_pressure_scale == 0.0);
  if (deformation_disabled) {
    c00 = 0.0; c01 = 0.0; c02 = 0.0;
    c10 = 0.0; c11 = 0.0; c12 = 0.0;
    c20 = 0.0; c21 = 0.0; c22 = 0.0;
  }
  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (deformation_disabled) {
    nf00 = f00; nf01 = f01; nf02 = f02;
    nf10 = f10; nf11 = f11; nf12 = f12;
    nf20 = f20; nf21 = f21; nf22 = f22;
    next_j = row4.z;
  } else if (condensed) {
    let target_j = g2p_condensed_target_j(next_j, row4.z);
    if (!solid) {
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    } else if (next_j > 1.0e-12) {
      let scale = g2p_cubic_root_positive(target_j / next_j);
      nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
      nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
      nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    } else {
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    }
    next_j = target_j;
  } else if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = g2p_cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }
  next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < G2P_MIN_VOLUME_RATIO_J) {
    let s = g2p_cubic_root_positive(G2P_MIN_VOLUME_RATIO_J);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = G2P_MIN_VOLUME_RATIO_J;
  } else if (next_j > g2p_max_volume_ratio_j(row6.z)) {
    let max_volume_ratio_j = g2p_max_volume_ratio_j(row6.z);
    let scale = g2p_cubic_root_positive(max_volume_ratio_j / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = max_volume_ratio_j;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`,`  schroeder_level_filter_enabled: u32,
};`,`  schroeder_level_filter_enabled: u32,
  schroeder_spatial_directory_enabled: u32,
  schroeder_spatial_storage_generation: u32,
  schroeder_spatial_position_epoch: u32,
  schroeder_spatial_topology_epoch: u32,
  schroeder_spatial_required: u32,
  schroeder_spatial_generation_id: u32,
  schroeder_spatial_device_ordinal: u32,
  schroeder_spatial_lane_ordinal: u32,
  schroeder_spatial_lease_token: u32,
  schroeder_spatial_source_family_id: u32,
  schroeder_spatial_physics_tick: u32,
  schroeder_spatial_physics_substep: u32,
  schroeder_spatial_chart_epoch: u32,
  schroeder_spatial_level_epoch: u32,
  schroeder_spatial_support_epoch: u32,
  schroeder_spatial_evidence_enabled: u32,
  schroeder_spatial_pad0: u32,
};`,`G2P canonical parameter fields`),`@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;`,`@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;`,`G2P assignment binding`),`// Level-filtered G2P with copy-through:`,`
const G2P_SCHROEDER_SPATIAL_MAGIC: u32 = 0x53534531u;
const G2P_SCHROEDER_SPATIAL_VERSION: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_STATUS_READY: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED: u32 = 2u;
const G2P_SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const G2P_SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const G2P_SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const G2P_SCHROEDER_SPATIAL_HEADER_WORDS: u32 = 48u;
const G2P_SCHROEDER_SPATIAL_KEY_WORDS: u32 = 5u;
const G2P_SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;

fn g2p_spatial_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn g2p_spatial_directory_admitted() -> bool {
  if (params.schroeder_spatial_directory_enabled == 0u) {
    return false;
  }
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = schroeder_spatial_directory[2u];
  let source_count = schroeder_spatial_directory[16u];
  let source_capacity = schroeder_spatial_directory[17u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_capacity = schroeder_spatial_directory[19u];
  let logical_required_words = schroeder_spatial_directory[20u];
  let logical_admitted_words = schroeder_spatial_directory[21u];
  let directory_capacity_words = schroeder_spatial_directory[22u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let cell_offsets_offset_words = schroeder_spatial_directory[30u];
  let cell_members_offset_words = schroeder_spatial_directory[31u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let rejected_flags = G2P_SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED
    | G2P_SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE
    | G2P_SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let sort_key_words = schroeder_spatial_directory[26u];
  let sort_mode = schroeder_spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == G2P_SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == G2P_SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == G2P_SCHROEDER_SPATIAL_KEY_WORDS
  );
  let build_ordinal = schroeder_spatial_directory[33u];
  let primitive_status = schroeder_spatial_directory[41u];
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_offsets_offset_words > directory_capacity_words
    || cell_members_offset_words > directory_capacity_words
    || particle_to_cell_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words)
      / G2P_SCHROEDER_SPATIAL_KEY_WORDS
    || cell_offsets_offset_words < cell_keys_offset_words
      + cell_capacity * G2P_SCHROEDER_SPATIAL_KEY_WORDS
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words < cell_offsets_offset_words + cell_capacity + 1u
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words < cell_members_offset_words + source_capacity
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
  ) {
    return false;
  }
  return schroeder_spatial_directory[0u] == G2P_SCHROEDER_SPATIAL_MAGIC
    // The v2 directory ABI deliberately preserves every v1 consumer
    // invariant this gate checks (same header word layout; reverse map is
    // plus-one-encoded, decoded above; query geometry at the capacity
    // offset, located from the high-water word). Pinning version 1 here
    // rejected every v2 directory outright, and the global fail-closed
    // finalize then silently rolled back all mechanics on the plain
    // canonical route.
    && (
      schroeder_spatial_directory[1u] == G2P_SCHROEDER_SPATIAL_VERSION
      || schroeder_spatial_directory[1u] == G2P_SCHROEDER_SPATIAL_VERSION + 1u
    )
    && (flags & (
      G2P_SCHROEDER_SPATIAL_STATUS_READY | G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED
    )) == (
      G2P_SCHROEDER_SPATIAL_STATUS_READY | G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED
    )
    && (flags & rejected_flags) == 0u
    && schroeder_spatial_directory[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && schroeder_spatial_directory[4u] == params.schroeder_spatial_device_ordinal
    && schroeder_spatial_directory[5u] == params.schroeder_spatial_lane_ordinal
    && schroeder_spatial_directory[6u] == params.schroeder_spatial_lease_token
    && schroeder_spatial_directory[7u] == params.schroeder_spatial_source_family_id
    && schroeder_spatial_directory[8u] == params.schroeder_spatial_storage_generation
    && schroeder_spatial_directory[9u] == params.schroeder_spatial_physics_tick
    && schroeder_spatial_directory[10u] == params.schroeder_spatial_physics_substep
    && schroeder_spatial_directory[11u] == params.schroeder_spatial_position_epoch
    && schroeder_spatial_directory[12u] == params.schroeder_spatial_topology_epoch
    && schroeder_spatial_directory[13u] == params.schroeder_spatial_chart_epoch
    && schroeder_spatial_directory[14u] == params.schroeder_spatial_level_epoch
    && schroeder_spatial_directory[15u] == params.schroeder_spatial_support_epoch
    && source_count == params.particle_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && logical_required_words == logical_admitted_words
    && logical_admitted_words >= G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && logical_admitted_words <= physical_upper_bound_words
    && schroeder_spatial_directory[23u] == 0u
    && schroeder_spatial_directory[24u] == 0u
    && schroeder_spatial_directory[25u] == G2P_SCHROEDER_SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && schroeder_spatial_directory[28u] == G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && cell_keys_offset_words == G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && build_ordinal != 0u
    && schroeder_spatial_directory[34u] == build_ordinal
    && schroeder_spatial_directory[35u] == build_ordinal
    && schroeder_spatial_directory[36u] == params.schroeder_spatial_generation_id
    && schroeder_spatial_directory[37u] == source_count
    && schroeder_spatial_directory[38u] == cell_count
    && schroeder_spatial_directory[39u] != 0u
    && schroeder_spatial_directory[40u] == 0u
    && (primitive_status & G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && schroeder_spatial_directory[45u] >= G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && (
      schroeder_spatial_directory[46u]
        == G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
      || schroeder_spatial_directory[46u]
        == G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    )
    && physical_upper_bound_words <= directory_capacity_words
    && g2p_spatial_range_within(
      cell_keys_offset_words,
      cell_count * G2P_SCHROEDER_SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      cell_members_offset_words,
      source_count,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      physical_upper_bound_words
    );
}

fn g2p_spatial_particle_level(particle_index: u32) -> i32 {
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  // Reverse map is cell-index-plus-one; zero = dormant/missing sentinel.
  let reverse_entry = schroeder_spatial_directory[particle_to_cell_offset_words + particle_index];
  if (reverse_entry == 0u) {
    return bitcast<i32>(0x80000000u);
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    return bitcast<i32>(0x80000000u);
  }
  let level_order_key = schroeder_spatial_directory[
    cell_keys_offset_words + cell_index * G2P_SCHROEDER_SPATIAL_KEY_WORDS + 1u
  ];
  return bitcast<i32>(level_order_key ^ 0x80000000u);
}

fn g2p_spatial_evidence_add(word: u32, value: u32) {
  if (
    params.schroeder_spatial_evidence_enabled != 0u
    && word < arrayLength(&schroeder_spatial_authority_evidence)
  ) {
    atomicAdd(&schroeder_spatial_authority_evidence[word], value);
  }
}

fn g2p_canonical_query_geometry_admitted() -> bool {
  let source_count = schroeder_spatial_directory[16u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  // Query profile sits at the end of the physical region (word 47 high
  // water minus its 6 words); see p2g_canonical_query_geometry_admitted.
  if (physical_upper_bound_words < 6u) {
    return false;
  }
  let query_offset_words = physical_upper_bound_words - 6u;
  if (
    schroeder_spatial_directory[46u]
      != G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || !g2p_spatial_range_within(query_offset_words, 6u, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_min_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 1u]);
  let query_max_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 2u]);
  let base_spacing_m = bitcast<f32>(schroeder_spatial_directory[query_offset_words + 3u]);
  let expected_spacing_m = base_spacing_m * exp2(f32(params.schroeder_selected_level));
  return query_min_level <= params.schroeder_selected_level
    && params.schroeder_selected_level <= query_max_level
    && base_spacing_m > 0.0
    && expected_spacing_m > 0.0
    && bitcast<u32>(expected_spacing_m) == bitcast<u32>(params.grid_spacing_m);
}

fn g2p_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}

fn g2p_p2g_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}

fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[16u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[17u]) != 0u;
}

fn g2p_spatial_evidence_identity(particle_index: u32) {
  if (params.schroeder_spatial_evidence_enabled == 0u || particle_index != 0u) {
    return;
  }
  atomicStore(&schroeder_spatial_authority_evidence[4u], 0x4d534131u);
  atomicStore(
    &schroeder_spatial_authority_evidence[5u],
    params.schroeder_spatial_generation_id
  );
}

fn g2p_authenticate_spatial_header(particle_index: u32) {
  if (particle_index != 0u) {
    return;
  }
  g2p_spatial_evidence_identity(particle_index);
  g2p_spatial_evidence_add(10u, params.particle_count);
  if (g2p_p2g_authority_rejected()) {
    return;
  }
  var directory_admitted = g2p_spatial_directory_admitted();
  if (directory_admitted) {
    directory_admitted = g2p_canonical_query_geometry_admitted();
  }
  if (directory_admitted) {
    g2p_spatial_evidence_add(11u, params.particle_count);
  } else {
    g2p_spatial_reject(16u);
  }
}

// Canonical level-filtered G2P with copy-through:`,`G2P authority insertion point`),`// Canonical level-filtered G2P with copy-through:`,`
fn g2p_copy_input_particle`,`// Canonical level-filtered G2P with copy-through. Binding 7 is compact
// evidence in this variant; no particle-parallel assignment row is declared.
fn g2p_particle_enabled(particle_index: u32) -> bool {
  g2p_authenticate_spatial_header(particle_index);
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS) {
    g2p_spatial_reject(17u);
    return false;
  }
  let source_count = schroeder_spatial_directory[16u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  if (
    particle_index >= source_count
    || !g2p_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      bound_words
    )
    || cell_keys_offset_words > bound_words
    || cell_count > (bound_words - cell_keys_offset_words)
      / G2P_SCHROEDER_SPATIAL_KEY_WORDS
  ) {
    g2p_spatial_reject(17u);
    return false;
  }
  // Query profile sits at the end of the physical region (word 47 high
  // water minus its 6 words); see p2g_canonical_query_geometry_admitted.
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  if (physical_upper_bound_words < 6u) {
    g2p_spatial_reject(17u);
    return false;
  }
  let query_offset_words = physical_upper_bound_words - 6u;
  if (!g2p_spatial_range_within(query_offset_words, 6u, bound_words)) {
    g2p_spatial_reject(17u);
    return false;
  }
  // Reverse map is cell-index-plus-one; zero = dormant/missing sentinel.
  let reverse_entry = schroeder_spatial_directory[
    particle_to_cell_offset_words + particle_index
  ];
  if (reverse_entry == 0u) {
    g2p_spatial_reject(17u);
    return false;
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    g2p_spatial_reject(17u);
    return false;
  }
  let cell_key_offset_words = cell_keys_offset_words
    + cell_index * G2P_SCHROEDER_SPATIAL_KEY_WORDS;
  if (
    schroeder_spatial_directory[cell_key_offset_words]
      != schroeder_spatial_directory[query_offset_words]
  ) {
    g2p_spatial_reject(17u);
    return false;
  }
  let spatial_level = bitcast<i32>(
    schroeder_spatial_directory[cell_key_offset_words + 1u] ^ 0x80000000u
  );
  g2p_spatial_evidence_add(12u, 1u);
  let selected = spatial_level == params.schroeder_selected_level;
  if (selected) {
    g2p_spatial_evidence_add(13u, 1u);
  }
  if (particle_index + 1u == params.particle_count) {
    g2p_spatial_evidence_add(19u, 1u);
  }
  return selected;
}
`,`G2P authority gate`)}

// G2P writes particle-parallel output before every reverse-map invocation can
// know whether a sibling rejected the shared directory. A second ordered
// dispatch restores the immutable input family for every particle whenever
// any invocation rejected. Separation runs only after this global gate.
@compute @workgroup_size(64)
fn finalize_canonical_spatial_authority(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (
    g2p_p2g_authority_rejected()
    || g2p_spatial_authority_rejected()
  ) {
    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);
  }
}
`}function Qe(e){let t=e.toUpperCase();return`const ${t}_ACTIVE_SOURCE_MAGIC: u32 = ${m}u;
const ${t}_ACTIVE_SOURCE_VERSION: u32 = 1u;
const ${t}_ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ${t}_ACTIVE_SOURCE_READY_ADMITTED: u32 = 3u;
const ${t}_ACTIVE_SOURCE_REJECTED_MASK: u32 = 252u;
const ${t}_ACTIVE_SOURCE_MISSING: u32 = ${h}u;
const ${t}_ACTIVE_SOURCE_ACTIVE_DISPATCH: u32 = 48u;
const ${t}_ACTIVE_SOURCE_CANDIDATE_DISPATCH: u32 = 51u;
const ${t}_ACTIVE_SOURCE_PHYSICAL_DISPATCH: u32 = 54u;

fn ${e}_active_source_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * 0x01000193u;
}

fn ${e}_active_source_projection_seal() -> u32 {
  var value = ${e}_active_source_fold(
    active_source_view[31u],
    active_source_view[25u]
  );
  value = ${e}_active_source_fold(value, active_source_view[26u]);
  value = ${e}_active_source_fold(value, active_source_view[27u]);
  value = ${e}_active_source_fold(value, active_source_view[18u]);
  value = ${e}_active_source_fold(value, active_source_view[20u]);
  return ${e}_active_source_fold(value, active_source_view[30u]);
}

fn ${e}_active_source_dispatch_admitted(
  invocation_count: u32,
  offset: u32
) -> bool {
  let groups = invocation_count / 64u
    + select(0u, 1u, invocation_count % 64u != 0u);
  let x = active_source_view[offset];
  let y = active_source_view[offset + 1u];
  let z = active_source_view[offset + 2u];
  if (invocation_count == 0u) {
    return x == 0u && y == 1u && z == 1u;
  }
  let expected_x = min(groups, params.active_source_dispatch_x_limit);
  let expected_y = groups / expected_x
    + select(0u, 1u, groups % expected_x != 0u);
  return x == expected_x && y == expected_y && z == 1u;
}

fn ${e}_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ${t}_ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  let active_candidate_count = active_source_view[43u];
  return params.schroeder_spatial_directory_enabled != 0u
    && params.active_source_dispatch_x_limit > 0u
    && active_source_view[0u] == ${t}_ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ${t}_ACTIVE_SOURCE_VERSION
    && (active_source_view[2u] & ${t}_ACTIVE_SOURCE_READY_ADMITTED)
      == ${t}_ACTIVE_SOURCE_READY_ADMITTED
    && (active_source_view[2u] & ${t}_ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && active_source_view[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && active_source_view[4u] == params.schroeder_spatial_device_ordinal
    && active_source_view[5u] == params.schroeder_spatial_lane_ordinal
    && active_source_view[6u] == params.schroeder_spatial_lease_token
    && active_source_view[7u] == params.schroeder_spatial_source_family_id
    && active_source_view[8u] == params.schroeder_spatial_storage_generation
    && active_source_view[9u] == params.schroeder_spatial_physics_tick
    && active_source_view[10u] == params.schroeder_spatial_physics_substep
    && active_source_view[11u] == params.schroeder_spatial_position_epoch
    && active_source_view[12u] == params.schroeder_spatial_topology_epoch
    && active_source_view[13u] == params.schroeder_spatial_chart_epoch
    && active_source_view[14u] == params.schroeder_spatial_level_epoch
    && active_source_view[15u] == params.schroeder_spatial_support_epoch
    && physical_count == params.particle_count
    && physical_count > 0u
    && physical_count <= physical_capacity
    && physical_capacity == params.active_source_physical_capacity
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity == params.active_source_active_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u]
      == 1u
    && active_source_view[24u]
      == 16u
    && active_to_physical
      == params.active_source_active_to_physical_offset_words
    && active_to_physical == ${t}_ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active
      == params.active_source_physical_to_active_offset_words
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == params.active_source_view_capacity_words
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[28u] <= capacity_words
    && active_source_view[29u]
      == params.active_source_completion_ordinal
    && active_source_view[30u]
      == params.active_source_completion_ordinal
    && active_source_view[31u] == params.active_source_fingerprint
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == 64u
    && active_source_view[38u] == params.active_source_dispatch_x_limit
    && active_source_view[40u] == ${t}_ACTIVE_SOURCE_ACTIVE_DISPATCH
    && active_source_view[41u] == ${t}_ACTIVE_SOURCE_CANDIDATE_DISPATCH
    && active_source_view[42u] == ${t}_ACTIVE_SOURCE_PHYSICAL_DISPATCH
    && active_count <= 0xffffffffu / 27u
    && active_candidate_count == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && active_source_view[47u]
      == ${e}_active_source_projection_seal()
    && ${e}_active_source_dispatch_admitted(
      active_count,
      ${t}_ACTIVE_SOURCE_ACTIVE_DISPATCH
    )
    && ${e}_active_source_dispatch_admitted(
      active_candidate_count,
      ${t}_ACTIVE_SOURCE_CANDIDATE_DISPATCH
    )
    && ${e}_active_source_dispatch_admitted(
      physical_count,
      ${t}_ACTIVE_SOURCE_PHYSICAL_DISPATCH
    );
}
`}function $e(e){return`${N(Ye(Ye(Ye(N(N(e,`  schroeder_spatial_pad2: u32,
};`,`  schroeder_spatial_pad2: u32,
  active_source_physical_capacity: u32,
  active_source_active_capacity: u32,
  active_source_view_capacity_words: u32,
  active_source_active_to_physical_offset_words: u32,
  active_source_physical_to_active_offset_words: u32,
  active_source_fingerprint: u32,
  active_source_dispatch_x_limit: u32,
  active_source_completion_ordinal: u32,
  product_history_control_magic: u32,
  product_history_control_version: u32,
  product_history_control_status: u32,
  product_history_live_row_count: u32,
  product_history_row_capacity: u32,
  product_history_row_stride_vec4: u32,
  product_history_control_generation: u32,
  product_history_control_seal: u32,
  expected_product_history_generation: u32,
  expected_product_history_seal: u32,
  expected_product_history_row_capacity: u32,
  expected_product_history_row_stride_vec4: u32,
};`,`ActiveSource-v2 dense P2G parameter fields`),`@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;`,`@group(0) @binding(8) var<storage, read> active_source_view: array<u32>;`,`ActiveSource-v2 dense P2G authority binding`),`const SCHROEDER_SPATIAL_MAGIC: u32`,`
// Canonical SS mechanics has one level/topology authority.`,Qe(`p2g`),`ActiveSource-v2 dense P2G validation`),`fn p2g_canonical_query_geometry_admitted() -> bool {`,`
fn p2g_spatial_evidence_add`,`fn p2g_canonical_query_geometry_admitted() -> bool {
  // The runtime admits this compatibility shader only when the exact
  // ActiveSource query range is the selected level. That single-level
  // contract is folded into the authenticated source fingerprint.
  return p2g_spatial_directory_admitted();
}
`,`ActiveSource-v2 dense P2G query geometry`),`fn p2g_particle_enabled(particle_index: u32) -> bool {`,`
fn p2g_finalize_node_index`,`fn p2g_product_history_control_admitted() -> bool {
  // A zero expected generation selects the legacy exact-host-count route.
  // GPU-count handles always carry a positive immutable generation and must
  // authenticate every word copied from their selected control record.
  if (params.expected_product_history_generation == 0u) {
    return params.expected_product_history_seal == 0u
      && params.expected_product_history_row_capacity == 0u
      && params.expected_product_history_row_stride_vec4 == 0u
      && params.product_history_control_magic == 0u
      && params.product_history_control_version == 0u
      && params.product_history_control_status == 0u
      && params.product_history_live_row_count == 0u
      && params.product_history_row_capacity == 0u
      && params.product_history_row_stride_vec4 == 0u
      && params.product_history_control_generation == 0u
      && params.product_history_control_seal == 0u;
  }
  return params.product_history_control_magic == 0x50484731u
    && params.product_history_control_version == 1u
    && params.product_history_control_status == 1u
    && params.product_history_live_row_count
      == params.resident_product_event_count
    && params.product_history_live_row_count
      <= params.product_history_row_capacity
    && params.expected_product_history_row_capacity > 0u
    && params.expected_product_history_row_stride_vec4 == 8u
    && params.expected_product_history_row_capacity
      <= arrayLength(&product_events)
        / params.expected_product_history_row_stride_vec4
    && params.product_history_row_capacity
      == params.expected_product_history_row_capacity
    && params.product_history_row_stride_vec4
      == params.expected_product_history_row_stride_vec4
    && params.product_history_control_generation
      == params.expected_product_history_generation
    && params.product_history_control_seal
      == params.expected_product_history_seal;
}

fn p2g_particle_enabled(particle_index: u32) -> bool {
  p2g_authenticate_spatial_header(particle_index);
  if (p2g_spatial_authority_rejected()) {
    return false;
  }
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < P2G_ACTIVE_SOURCE_HEADER_WORDS
      || particle_index >= params.particle_count) {
    p2g_spatial_reject(15u);
    return false;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  if (physical_to_active > bound_words
      || particle_index >= bound_words - physical_to_active) {
    p2g_spatial_reject(15u);
    return false;
  }
  let active_ordinal =
    active_source_view[physical_to_active + particle_index];
  if (particle_index + 1u == params.particle_count) {
    p2g_spatial_evidence_add(18u, 1u);
  }
  if (active_ordinal == P2G_ACTIVE_SOURCE_MISSING) {
    return false;
  }
  if (active_ordinal >= active_source_view[18u]
      || active_to_physical > bound_words
      || active_ordinal >= bound_words - active_to_physical
      || active_source_view[active_to_physical + active_ordinal]
        != particle_index) {
    p2g_spatial_reject(15u);
    return false;
  }
  p2g_spatial_evidence_add(8u, 1u);
  p2g_spatial_evidence_add(9u, 1u);
  return true;
}
`,`ActiveSource-v2 dense P2G particle admission`),`  if (event_index >= params.resident_product_event_count) {
    return;
  }

  let event0 = product_event_row0(event_index);`,`  if (event_index >= params.resident_product_event_count) {
    return;
  }
  // Main is encoded before this dispatch. Any ActiveSource rejection must
  // suppress sidecar mass too; finalize_grid then zeroes the dense grid.
  if (p2g_spatial_authority_rejected()) {
    return;
  }

  let event0 = product_event_row0(event_index);`,`ActiveSource-v2 dense P2G product-event authority gate`)}

// Active count can be zero, and product rows can still exist. Authenticate
// the immutable authority unconditionally before either scatter dispatch.
@compute @workgroup_size(1)
fn preflight_active_source_dense_single_level() {
  if (!p2g_spatial_directory_admitted()
      || !p2g_canonical_query_geometry_admitted()
      || !p2g_product_history_control_admitted()) {
    p2g_spatial_reject(14u);
  }
}
`}function et(e){return Ye(Ye(Ye(N(N(e,`  schroeder_spatial_pad0: u32,
};`,`  schroeder_spatial_pad0: u32,
  active_source_physical_capacity: u32,
  active_source_active_capacity: u32,
  active_source_view_capacity_words: u32,
  active_source_active_to_physical_offset_words: u32,
  active_source_physical_to_active_offset_words: u32,
  active_source_fingerprint: u32,
  active_source_dispatch_x_limit: u32,
  active_source_completion_ordinal: u32,
};`,`ActiveSource-v2 dense G2P parameter fields`),`@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;`,`@group(0) @binding(8) var<storage, read> active_source_view: array<u32>;`,`ActiveSource-v2 dense G2P authority binding`),`const G2P_SCHROEDER_SPATIAL_MAGIC: u32`,`
fn g2p_spatial_evidence_add`,Qe(`g2p`),`ActiveSource-v2 dense G2P validation`),`fn g2p_canonical_query_geometry_admitted() -> bool {`,`
fn g2p_spatial_reject`,`fn g2p_canonical_query_geometry_admitted() -> bool {
  // See the P2G variant: the exact single-level query is host-authenticated
  // and folded into the GPU-checked ActiveSource fingerprint.
  return g2p_spatial_directory_admitted();
}
`,`ActiveSource-v2 dense G2P query geometry`),`fn g2p_particle_enabled(particle_index: u32) -> bool {`,`
fn g2p_copy_input_particle`,`fn g2p_particle_enabled(particle_index: u32) -> bool {
  g2p_authenticate_spatial_header(particle_index);
  if (g2p_p2g_authority_rejected()
      || g2p_spatial_authority_rejected()) {
    return false;
  }
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < G2P_ACTIVE_SOURCE_HEADER_WORDS
      || particle_index >= params.particle_count) {
    g2p_spatial_reject(17u);
    return false;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  if (physical_to_active > bound_words
      || particle_index >= bound_words - physical_to_active) {
    g2p_spatial_reject(17u);
    return false;
  }
  let active_ordinal =
    active_source_view[physical_to_active + particle_index];
  if (particle_index + 1u == params.particle_count) {
    g2p_spatial_evidence_add(19u, 1u);
  }
  if (active_ordinal == G2P_ACTIVE_SOURCE_MISSING) {
    return false;
  }
  if (active_ordinal >= active_source_view[18u]
      || active_to_physical > bound_words
      || active_ordinal >= bound_words - active_to_physical
      || active_source_view[active_to_physical + active_ordinal]
        != particle_index) {
    g2p_spatial_reject(17u);
    return false;
  }
  g2p_spatial_evidence_add(12u, 1u);
  g2p_spatial_evidence_add(13u, 1u);
  return true;
}
`,`ActiveSource-v2 dense G2P particle admission`)}const tt=Xe(),nt=Ze();function rt(e,t,n){let r=Ye(e,`fn ${t}_spatial_evidence_add(word: u32, value: u32) {`,`\nfn ${n}`,`fn ${t}_spatial_evidence_add(word: u32, value: u32) {\n}`,`${t.toUpperCase()} optional evidence helper`);return t===`p2g`?N(N(r,`fn p2g_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}`,`fn p2g_spatial_reject(word: u32) {
  atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
}`,`P2G unobserved rejection summary`),`fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}`,`fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u;
}`,`P2G unobserved rejection summary read`):N(N(N(r,`fn g2p_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}`,`fn g2p_spatial_reject(word: u32) {
  atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
}`,`G2P unobserved rejection summary`),`  if (g2p_p2g_authority_rejected()) {
    return;
  }`,`  if (g2p_p2g_authority_rejected()) {
    atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
    return;
  }`,`G2P unobserved upstream rejection normalization`),`fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[16u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[17u]) != 0u;
}`,`fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u;
}`,`G2P unobserved rejection summary read`)}const it=rt(tt,`p2g`,`p2g_spatial_reject`),at=rt(nt,`g2p`,`g2p_canonical_query_geometry_admitted`);$e(tt),$e(it),et(nt),et(at);function ot(e,{binding:t,insertion:n,gateInsertion:r,rejectionBody:i=`    return;`}){return N(N(e,n,`${n}
@group(0) @binding(${t}) var<storage, read> mechanics_spatial_authority_evidence: array<u32>;

fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u
    || mechanics_spatial_authority_evidence[15u] != 0u
    || mechanics_spatial_authority_evidence[16u] != 0u
    || mechanics_spatial_authority_evidence[17u] != 0u;
}`,`separation binding ${t}`),r,`${r}
  if (separation_mechanics_spatial_authority_rejected()) {
${i}
  }`,`separation canonical fail-closed gate`)}function st(e){return N(e,`fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u
    || mechanics_spatial_authority_evidence[15u] != 0u
    || mechanics_spatial_authority_evidence[16u] != 0u
    || mechanics_spatial_authority_evidence[17u] != 0u;
}`,`fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u;
}`,`unobserved separation rejection summary`)}const ct=ot(N(N(N(`
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
// Combined bins: [0, cell_count) = per-cell counts, then cell_count +
// cell * capacity + slot = entry indices. One buffer keeps consumers within
// the default 10-storage-buffer per-stage limit.
@group(0) @binding(2) var<storage, read_write> bins: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn bin_fill_cell_index(position: vec3<f32>) -> u32 {
  let inv = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = clamp(u32(max(position.x, 0.0) * inv), 0u, params.bin_nx - 1u);
  let cy = clamp(u32(max(position.y, 0.0) * inv), 0u, params.bin_ny - 1u);
  let cz = clamp(u32(max(position.z, 0.0) * inv), 0u, params.bin_nz - 1u);
  return (cz * params.bin_ny + cy) * params.bin_nx + cx;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  // Every massive particle is binned (gas included): the bins are shared
  // with thermal pair conduction, and the separation consumer already
  // filters phases per pair.
  let cell = bin_fill_cell_index(pos_mass.xyz);
  let cell_count = params.bin_nx * params.bin_ny * params.bin_nz;
  let slot = atomicAdd(&bins[cell], 1u);
  if (slot < params.bin_capacity) {
    atomicStore(&bins[cell_count + cell * params.bin_capacity + slot], particle_index);
  }
}
`,`@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;`,`@group(0) @binding(0) var<storage, read_write> in_state: array<vec4<f32>>;`,`separation bin-fill writable state binding`),`@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;`,`@group(0) @binding(1) var<storage, read_write> in_mechanics: array<vec4<f32>>;`,`separation bin-fill writable mechanics binding`),`@group(0) @binding(3) var<uniform> params: SeparationParams;`,`@group(0) @binding(3) var<uniform> params: SeparationParams;
@group(0) @binding(5) var<storage, read> authority_restore_state: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> authority_restore_mechanics: array<vec4<f32>>;`,`separation bin-fill immutable authority restore bindings`),{binding:4,insertion:`@group(0) @binding(3) var<uniform> params: SeparationParams;`,gateInsertion:`  if (particle_index >= params.particle_count) {
    return;
  }`,rejectionBody:`    let state_base = particle_index * 2u;
    let mechanics_base = particle_index * 8u;
    in_state[state_base] = authority_restore_state[state_base];
    in_state[state_base + 1u] = authority_restore_state[state_base + 1u];
    for (var row = 0u; row < 8u; row = row + 1u) {
      in_mechanics[mechanics_base + row] = authority_restore_mechanics[mechanics_base + row];
    }
    return;`}),lt=ot(`
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> corrections: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;
// Combined bins layout: counts prefix then entry slots (see bin-fill).
@group(0) @binding(4) var<storage, read> bins: array<u32>;

fn separation_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

// 0 = excluded (gas/plasma/unknown), 1 = liquid, 2 = solid.
fn separation_phase_class(index: u32) -> u32 {
  let row5 = in_mechanics[index * 8u + 5u];
  let row6 = in_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) {
    return 2u;
  }
  if (row6.z > 0.5 && row6.z < 1.5) {
    return 1u;
  }
  return 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  corrections[particle_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let phase_class = separation_phase_class(particle_index);
  if (phase_class == 0u) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  if (rest_volume <= 0.0) {
    return;
  }
  let velocity = in_state[particle_index * 2u + 1u].xyz;
  let d_self = separation_cbrt(rest_volume);
  let w_self = 1.0 / max(pos_mass.w, 1.0e-30);
  var dx = vec3<f32>(0.0, 0.0, 0.0);
  var dv = vec3<f32>(0.0, 0.0, 0.0);
  // The bin cell size is >= every pair rest distance, so scanning the
  // 3x3x3 cell neighborhood covers all interacting pairs.
  let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = i32(clamp(u32(max(pos_mass.x, 0.0) * inv_cell), 0u, params.bin_nx - 1u));
  let cy = i32(clamp(u32(max(pos_mass.y, 0.0) * inv_cell), 0u, params.bin_ny - 1u));
  let cz = i32(clamp(u32(max(pos_mass.z, 0.0) * inv_cell), 0u, params.bin_nz - 1u));
  for (var oz = -1; oz <= 1; oz = oz + 1) {
    let nz = cz + oz;
    if (nz < 0 || nz >= i32(params.bin_nz)) {
      continue;
    }
    for (var oy = -1; oy <= 1; oy = oy + 1) {
      let ny = cy + oy;
      if (ny < 0 || ny >= i32(params.bin_ny)) {
        continue;
      }
      for (var ox = -1; ox <= 1; ox = ox + 1) {
        let nx = cx + ox;
        if (nx < 0 || nx >= i32(params.bin_nx)) {
          continue;
        }
        let cell = (u32(nz) * params.bin_ny + u32(ny)) * params.bin_nx + u32(nx);
        let total_cells = params.bin_nx * params.bin_ny * params.bin_nz;
        let cell_count = min(bins[cell], params.bin_capacity);
        for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
          let other = bins[total_cells + cell * params.bin_capacity + entry];
          if (other == particle_index) {
            continue;
          }
          let other_pos_mass = in_state[other * 2u];
          if (other_pos_mass.w <= 0.0) {
            continue;
          }
          let other_class = separation_phase_class(other);
          if (other_class == 0u) {
            continue;
          }
          if (phase_class == 2u && other_class == 2u) {
            continue;
          }
          let other_rest_volume = max(in_mechanics[other * 8u + 4u].w, 0.0);
          if (other_rest_volume <= 0.0) {
            continue;
          }
          let pair_rest_distance = 0.5 * (d_self + separation_cbrt(other_rest_volume));
          let delta = pos_mass.xyz - other_pos_mass.xyz;
          var dist = length(delta);
          if (dist >= pair_rest_distance) {
            continue;
          }
          var normal = vec3<f32>(0.0, 1.0, 0.0);
          if (dist > 1.0e-9) {
            normal = delta / dist;
          } else {
            // Deterministic antisymmetric fallback for coincident particles:
            // hash the LOWER pair index into a unit direction so distinct
            // coincident pairs scatter isotropically instead of every twin
            // pair stacking along +/-y (reaction products spawn co-located at
            // the reacting pair's position, so y-only pushes built columns).
            // Both members hash the same index, so the pushes stay exactly
            // antisymmetric and conserve pair momentum.
            let low_index = min(particle_index, other);
            var h = low_index * 2654435761u + 0x9e3779b9u;
            h = (h ^ (h >> 16u)) * 2246822519u;
            h = h ^ (h >> 13u);
            let ux = f32(h & 1023u) / 511.5 - 1.0;
            let uy = f32((h >> 10u) & 1023u) / 511.5 - 1.0;
            let uz = f32((h >> 20u) & 1023u) / 511.5 - 1.0;
            let raw = vec3<f32>(ux, uy, uz);
            let raw_len = length(raw);
            let hashed = select(vec3<f32>(0.0, 1.0, 0.0), raw / max(raw_len, 1.0e-6), raw_len > 1.0e-4);
            normal = hashed * select(-1.0, 1.0, particle_index > other);
            dist = 0.0;
          }
          let w_other = 1.0 / max(other_pos_mass.w, 1.0e-30);
          let share = w_self / (w_self + w_other);
          dx = dx + params.relaxation * share * (pair_rest_distance - dist) * normal;
          let approach = dot(velocity - in_state[other * 2u + 1u].xyz, normal);
          if (approach < 0.0) {
            dv = dv - params.normal_velocity_damping * share * approach * normal;
          }
        }
      }
    }
  }
  // Bound the aggregate correction so deeply overlapped states relax over
  // several substeps instead of teleporting.
  let max_step = 0.5 * d_self;
  let dx_len = length(dx);
  if (dx_len > max_step) {
    dx = dx * (max_step / dx_len);
  }
  corrections[particle_index * 2u] = vec4<f32>(dx, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(dv, 0.0);
}
`,{binding:5,insertion:`@group(0) @binding(4) var<storage, read> bins: array<u32>;`,gateInsertion:`  corrections[particle_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);`}),ut=ot(`
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> corrections: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn separation_apply_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let dx = corrections[particle_index * 2u].xyz;
  let dv = corrections[particle_index * 2u + 1u].xyz;
  if (dot(dx, dx) == 0.0 && dot(dv, dv) == 0.0) {
    return;
  }
  let pos_mass = out_state[particle_index * 2u];
  let vel_u = out_state[particle_index * 2u + 1u];
  var position = pos_mass.xyz + dx;
  var velocity = vel_u.xyz + dv;
  // Same finite-volume wall clearance contract as G2P, including the
  // half-cell cap (see g2p_particle_wall_clearance for the rationale).
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * separation_apply_cbrt(rest_volume);
    if (params.grid_spacing_m > 0.0) {
      wall_clearance = min(wall_clearance, 0.5 * params.grid_spacing_m);
    }
    let min_dim = min(params.box_x, min(params.box_y, params.box_z));
    if (min_dim > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dim);
    }
  }
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }
  out_state[particle_index * 2u] = vec4<f32>(position, pos_mass.w);
  out_state[particle_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
}
`,{binding:4,insertion:`@group(0) @binding(3) var<uniform> params: SeparationParams;`,gateInsertion:`  if (particle_index >= params.particle_count) {
    return;
  }`});st(ct),st(lt),st(ut);const dt=`
struct MechanicsViewParams {
  source_count: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  occupancy_word_count: u32,
  node_capacity: u32,
  generation_id: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  device_ordinal: u32,
  lane_ordinal: u32,
  lease_token: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  completion_ordinal: u32,
  directory_capacity_words: u32,
  directory_cell_capacity: u32,
  view_capacity_words: u32,
  view_node_offset_words: u32,
  view_header_offset_words: u32,
  view_header_words: u32,
  source_adapter_id: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  query_evidence_words: u32,
  workgroup_size: u32,
  cleared_words: u32,
  directory_abi_version: u32,
  active_source_capacity: u32,
  active_source_view_capacity_words: u32,
  active_to_physical_offset_words: u32,
  physical_to_active_offset_words: u32,
  direct_dispatch_x: u32,
  active_source_fingerprint: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(2) var<storage, read_write> occupancy_words: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> occupancy_counts: array<u32>;
@group(0) @binding(4) var<storage, read> occupancy_offsets: array<u32>;
@group(0) @binding(5) var<storage, read_write> mechanics_view: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> active_source_view: array<u32>;
@group(0) @binding(7) var<uniform> params: MechanicsViewParams;

override MECHANICS_DIRECTORY_ABI_VERSION: u32 = 1u;

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION_V1: u32 = 1u;
const SPATIAL_VERSION_V2: u32 = 2u;
const SPATIAL_STATUS_READY: u32 = 1u;
const SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_HEADER_WORDS: u32 = 48u;
const SPATIAL_KEY_WORDS: u32 = 5u;
const SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SPATIAL_CLEARED_WORDS: u32 = 67u;
const SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const SPATIAL_REVERSE_CELL_PLUS_ONE: u32 = 1u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_STATUS_READY: u32 = 1u;
const ACTIVE_SOURCE_STATUS_ADMITTED: u32 = 2u;
const ACTIVE_SOURCE_STATUS_REJECTED: u32 = 0xfcu;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET: u32 = 48u;
const ACTIVE_SOURCE_CANDIDATE_DISPATCH_OFFSET: u32 = 51u;
const ACTIVE_SOURCE_PHYSICAL_DISPATCH_OFFSET: u32 = 54u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;
const MECHANICS_MAGIC: u32 = 0x534d5631u;
const MECHANICS_VERSION: u32 = 1u;
const MECHANICS_STATUS_READY: u32 = 1u;
const MECHANICS_STATUS_ADMITTED: u32 = 2u;
const MECHANICS_STATUS_FAIL_CLOSED: u32 = 4u;
const MECHANICS_STATUS_INVALID_SOURCE: u32 = 8u;
const MECHANICS_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const H_INVALID_SOURCE_COUNT: u32 = 27u;
const H_ATTEMPTED_SOURCE_COUNT: u32 = 29u;
const H_SELECTED_SOURCE_COUNT: u32 = 30u;
const H_STENCIL_VISIT_COUNT: u32 = 31u;
const DISPATCH_OFFSET_WORDS: u32 = 60u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn header_word(relative: u32) -> u32 {
  return params.view_header_offset_words + relative;
}

fn record_invalid_source() {
  atomicAdd(&mechanics_view[header_word(H_INVALID_SOURCE_COUNT)], 1u);
}

fn spatial_directory_v1_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = spatial_directory[2u];
  let rejected_flags = SPATIAL_STATUS_FAIL_CLOSED
    | SPATIAL_STATUS_INVALID_SOURCE
    | SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let source_count = spatial_directory[16u];
  let source_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let logical_admitted_words = spatial_directory[21u];
  let directory_capacity_words = spatial_directory[22u];
  let cell_keys_offset_words = spatial_directory[29u];
  let cell_offsets_offset_words = spatial_directory[30u];
  let cell_members_offset_words = spatial_directory[31u];
  let particle_to_cell_offset_words = spatial_directory[32u];
  let physical_upper_bound_words = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let sort_key_words = spatial_directory[26u];
  let sort_mode = spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == SPATIAL_KEY_WORDS
  );
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words != params.directory_capacity_words
    || physical_upper_bound_words < SPATIAL_HEADER_WORDS
    || physical_upper_bound_words > directory_capacity_words
    || logical_admitted_words < SPATIAL_HEADER_WORDS
    || logical_admitted_words > physical_upper_bound_words
    || cell_capacity != params.directory_cell_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words) / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words
      != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || cell_offsets_offset_words > directory_capacity_words
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words != cell_offsets_offset_words + cell_capacity + 1u
    || cell_members_offset_words > directory_capacity_words
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words != cell_members_offset_words + source_capacity
    || particle_to_cell_offset_words > directory_capacity_words
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
    || !range_within(cell_keys_offset_words, cell_count * SPATIAL_KEY_WORDS, physical_upper_bound_words)
    || !range_within(cell_offsets_offset_words, cell_count + 1u, physical_upper_bound_words)
    || !range_within(cell_members_offset_words, source_count, physical_upper_bound_words)
    || !range_within(particle_to_cell_offset_words, source_count, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_offset_words = particle_to_cell_offset_words + source_count;
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V1
    && (flags & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
    && spatial_directory[3u] == params.generation_id
    && spatial_directory[4u] == params.device_ordinal
    && spatial_directory[5u] == params.lane_ordinal
    && spatial_directory[6u] == params.lease_token
    && spatial_directory[7u] == params.source_family_id
    && spatial_directory[8u] == params.storage_generation
    && spatial_directory[9u] == params.physics_tick
    && spatial_directory[10u] == params.physics_substep
    && spatial_directory[11u] == params.position_epoch
    && spatial_directory[12u] == params.topology_epoch
    && spatial_directory[13u] == params.chart_epoch
    && spatial_directory[14u] == params.level_epoch
    && spatial_directory[15u] == params.support_epoch
    && source_count == params.source_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && spatial_directory[20u] == spatial_directory[21u]
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && spatial_directory[28u] == SPATIAL_HEADER_WORDS
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == params.completion_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[37u] == source_count
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == SPATIAL_CLEARED_WORDS
    && spatial_directory[46u] == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.source_adapter_id == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.query_evidence_words == 6u
    && range_within(query_offset_words, params.query_evidence_words, physical_upper_bound_words)
    && spatial_directory[query_offset_words] == params.query_chart_id
    && bitcast<i32>(spatial_directory[query_offset_words + 1u]) == params.query_min_level
    && bitcast<i32>(spatial_directory[query_offset_words + 2u]) == params.query_max_level
    && spatial_directory[query_offset_words + 3u]
      == bitcast<u32>(params.query_base_grid_spacing_m)
    && params.selected_level >= params.query_min_level
    && params.selected_level <= params.query_max_level
    && bitcast<u32>(params.grid_spacing_m)
      == bitcast<u32>(params.query_base_grid_spacing_m * exp2(f32(params.selected_level)));
}

fn active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  let dispatch_x = active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET];
  let dispatch_y = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET + 1u
  ];
  let dispatch_z = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET + 2u
  ];
  let required_groups = active_count / max(params.workgroup_size, 1u)
    + select(
      0u,
      1u,
      active_count % max(params.workgroup_size, 1u) != 0u
    );
  var dispatch_admitted =
    dispatch_x == 0u && dispatch_y == 1u && dispatch_z == 1u;
  if (active_count > 0u) {
    dispatch_admitted = dispatch_x > 0u
      && dispatch_y > 0u
      && dispatch_z == 1u
      && dispatch_x * dispatch_y >= required_groups;
  }
  return params.directory_abi_version == MECHANICS_DIRECTORY_ABI_VERSION
    && MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & (ACTIVE_SOURCE_STATUS_READY | ACTIVE_SOURCE_STATUS_ADMITTED))
      == (ACTIVE_SOURCE_STATUS_READY | ACTIVE_SOURCE_STATUS_ADMITTED)
    && (status & ACTIVE_SOURCE_STATUS_REJECTED) == 0u
    && active_source_view[3u] == params.generation_id
    && active_source_view[4u] == params.device_ordinal
    && active_source_view[5u] == params.lane_ordinal
    && active_source_view[6u] == params.lease_token
    && active_source_view[7u] == params.source_family_id
    && active_source_view[8u] == params.storage_generation
    && active_source_view[9u] == params.physics_tick
    && active_source_view[10u] == params.physics_substep
    && active_source_view[11u] == params.position_epoch
    && active_source_view[12u] == params.topology_epoch
    && active_source_view[13u] == params.chart_epoch
    && active_source_view[14u] == params.level_epoch
    && active_source_view[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_count > 0u
    && physical_count <= physical_capacity
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity == params.active_source_capacity
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == params.source_stride_floats
    && active_to_physical == params.active_to_physical_offset_words
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == params.physical_to_active_offset_words
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == params.active_source_view_capacity_words
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[30u] == params.completion_ordinal
    && active_source_view[31u] == params.active_source_fingerprint
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == params.workgroup_size
    && active_source_view[38u] > 0u
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH_OFFSET
    && active_source_view[42u] == ACTIVE_SOURCE_PHYSICAL_DISPATCH_OFFSET
    && active_source_view[43u] == active_count * 27u
    && active_source_view[47u] != 0u
    && dispatch_admitted;
}

fn spatial_directory_v2_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < SPATIAL_HEADER_WORDS || !active_source_view_admitted()) {
    return false;
  }
  let flags = spatial_directory[2u];
  let rejected_flags = SPATIAL_STATUS_FAIL_CLOSED
    | SPATIAL_STATUS_INVALID_SOURCE
    | SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let physical_count = spatial_directory[16u];
  let physical_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let logical_required_words = spatial_directory[20u];
  let logical_admitted_words = spatial_directory[21u];
  let directory_capacity_words = spatial_directory[22u];
  let cell_keys_offset_words = spatial_directory[29u];
  let cell_offsets_offset_words = spatial_directory[30u];
  let cell_members_offset_words = spatial_directory[31u];
  let physical_to_cell_plus_one_offset_words = spatial_directory[32u];
  let active_count = spatial_directory[37u];
  let physical_upper_bound_words = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let query_offset_words =
    physical_to_cell_plus_one_offset_words + physical_capacity;
  let expected_logical_words = SPATIAL_HEADER_WORDS
    + cell_count * SPATIAL_KEY_WORDS
    + cell_count + 1u
    + active_count
    + physical_count
    + params.query_evidence_words;
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words != params.directory_capacity_words
    || physical_upper_bound_words < SPATIAL_HEADER_WORDS
    || physical_upper_bound_words > directory_capacity_words
    || logical_required_words != expected_logical_words
    || logical_admitted_words != logical_required_words
    || cell_capacity != params.directory_cell_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_capacity
      > (directory_capacity_words - cell_keys_offset_words) / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words
      != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || cell_capacity + 1u
      > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words
      != cell_offsets_offset_words + cell_capacity + 1u
    || physical_capacity
      > directory_capacity_words - cell_members_offset_words
    || physical_to_cell_plus_one_offset_words
      != cell_members_offset_words + physical_capacity
    || physical_capacity
      > directory_capacity_words - physical_to_cell_plus_one_offset_words
    || query_offset_words > directory_capacity_words
    || !range_within(
      cell_keys_offset_words,
      cell_count * SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    || !range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    || !range_within(
      cell_members_offset_words,
      active_count,
      physical_upper_bound_words
    )
    || !range_within(
      physical_to_cell_plus_one_offset_words,
      physical_count,
      physical_upper_bound_words
    )
    || !range_within(
      query_offset_words,
      params.query_evidence_words,
      physical_upper_bound_words
    )
  ) {
    return false;
  }
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V2
    && (flags & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
    && spatial_directory[3u] == params.generation_id
    && spatial_directory[4u] == params.device_ordinal
    && spatial_directory[5u] == params.lane_ordinal
    && spatial_directory[6u] == params.lease_token
    && spatial_directory[7u] == params.source_family_id
    && spatial_directory[8u] == params.storage_generation
    && spatial_directory[9u] == params.physics_tick
    && spatial_directory[10u] == params.physics_substep
    && spatial_directory[11u] == params.position_epoch
    && spatial_directory[12u] == params.topology_epoch
    && spatial_directory[13u] == params.chart_epoch
    && spatial_directory[14u] == params.level_epoch
    && spatial_directory[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_count > 0u
    && physical_count <= physical_capacity
    && active_count == active_source_view[18u]
    && active_count <= physical_count
    && cell_count <= active_count
    && (active_count == 0u || cell_count > 0u)
    && cell_count <= cell_capacity
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == SPATIAL_KEY_WORDS
    && spatial_directory[26u] == SPATIAL_KEY_WORDS
    && spatial_directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[28u] == SPATIAL_HEADER_WORDS
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == params.completion_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == SPATIAL_CLEARED_WORDS
    && spatial_directory[46u] == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.source_adapter_id == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.query_evidence_words == 6u
    && spatial_directory[cell_offsets_offset_words + cell_count]
      == active_count
    && spatial_directory[query_offset_words] == params.query_chart_id
    && bitcast<i32>(spatial_directory[query_offset_words + 1u])
      == params.query_min_level
    && bitcast<i32>(spatial_directory[query_offset_words + 2u])
      == params.query_max_level
    && spatial_directory[query_offset_words + 3u]
      == bitcast<u32>(params.query_base_grid_spacing_m)
    && params.selected_level >= params.query_min_level
    && params.selected_level <= params.query_max_level
    && bitcast<u32>(params.grid_spacing_m)
      == bitcast<u32>(
        params.query_base_grid_spacing_m * exp2(f32(params.selected_level))
      );
}

fn spatial_directory_admitted() -> bool {
  if (params.directory_abi_version != MECHANICS_DIRECTORY_ABI_VERSION) {
    return false;
  }
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V1) {
    return spatial_directory_v1_admitted();
  }
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2) {
    return spatial_directory_v2_admitted();
  }
  return false;
}

fn source_work_count() -> u32 {
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2) {
    return select(0u, active_source_view[18u], active_source_view_admitted());
  }
  return params.source_count;
}

fn physical_source_for_work(source_work_index: u32) -> u32 {
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V1) {
    return select(
      ACTIVE_SOURCE_MISSING,
      source_work_index,
      source_work_index < params.source_count
    );
  }
  if (!active_source_view_admitted()) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_count = active_source_view[18u];
  if (source_work_index >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let physical_source = active_source_view[
    params.active_to_physical_offset_words + source_work_index
  ];
  if (
    physical_source >= params.source_count
    || active_source_view[
      params.physical_to_active_offset_words + physical_source
    ] != source_work_index
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn source_row_values(source_index: u32) -> vec4<f32> {
  let row = source_index * params.source_stride_floats;
  if (params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
    return vec4<f32>(
      source_rows[row],
      source_rows[row + 1u],
      source_rows[row + 10u],
      f32(source_index)
    );
  }
  return vec4<f32>(
    source_rows[row],
    source_rows[row + 8u],
    source_rows[row + 11u],
    source_rows[row + 10u]
  );
}

fn source_row_position(source_index: u32) -> vec4<f32> {
  let row = source_index * params.source_stride_floats;
  return vec4<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u],
    source_rows[row + 15u]
  );
}

fn source_row_admitted(source_index: u32) -> bool {
  let row = source_index * params.source_stride_floats;
  if (
    params.source_stride_floats != 16u
    || row > arrayLength(&source_rows)
    || params.source_stride_floats > arrayLength(&source_rows) - row
    || (params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
      && params.source_row_layout_id != SOURCE_LAYOUT_ACTIVE_NODE)
  ) {
    return false;
  }
  let values = source_row_values(source_index);
  let position_chart = source_row_position(source_index);
  let level_f = values.x;
  let native_spacing = values.y;
  let status_f = values.z;
  let source_f = values.w;
  if (
    !integral_f32(level_f)
    || !finite_f32(native_spacing)
    || !(native_spacing > 0.0)
    || !integral_f32(status_f)
    || status_f < 0.0
    || status_f > 255.0
    || !integral_f32(source_f)
    || source_f != f32(source_index)
    || !finite_f32(position_chart.x)
    || !finite_f32(position_chart.y)
    || !finite_f32(position_chart.z)
    || !integral_f32(position_chart.w)
    || position_chart.w < 0.0
  ) {
    return false;
  }
  let status = u32(round(status_f));
  if (
    (status & 31u) == 0u
    || (status & 64u) != 0u
    || (status & 128u) != 0u
  ) {
    return false;
  }
  let cell_count = spatial_directory[18u];
  let cell_keys_offset_words = spatial_directory[29u];
  let particle_to_cell_offset_words = spatial_directory[32u];
  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }
  if (cell_index >= cell_count) {
    return false;
  }
  let key = cell_keys_offset_words + cell_index * SPATIAL_KEY_WORDS;
  let cell = vec3<i32>(floor(position_chart.xyz / native_spacing));
  return spatial_directory[key] == u32(round(position_chart.w))
    && spatial_directory[key + 1u] == signed_order_key(i32(round(level_f)))
    && spatial_directory[key + 2u] == signed_order_key(cell.x)
    && spatial_directory[key + 3u] == signed_order_key(cell.y)
    && spatial_directory[key + 4u] == signed_order_key(cell.z);
}

fn grid_index(i: i32, j: i32, k: i32) -> u32 {
  let si = i + i32(params.grid_shift);
  let sj = j + i32(params.grid_shift);
  let sk = k + i32(params.grid_shift);
  if (
    si < 0 || sj < 0 || sk < 0
    || si >= i32(params.grid_nx)
    || sj >= i32(params.grid_ny)
    || sk >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  return (u32(si) * params.grid_ny + u32(sj)) * params.grid_nz + u32(sk);
}

@compute @workgroup_size(64)
fn mark_mechanics_nodes(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let source_work_index =
    linear_group * max(params.workgroup_size, 1u) + local_id.x;
  if (source_work_index >= source_work_count()) {
    return;
  }
  if (!spatial_directory_admitted()) {
    record_invalid_source();
    return;
  }
  let source_index = physical_source_for_work(source_work_index);
  if (
    source_index == ACTIVE_SOURCE_MISSING
    || !source_row_admitted(source_index)
  ) {
    record_invalid_source();
    return;
  }
  // Count an attempted source only after active-ordinal, physical-row, and
  // directory reverse/key parity are all authenticated.
  atomicAdd(&mechanics_view[header_word(H_ATTEMPTED_SOURCE_COUNT)], 1u);
  if (
    params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && !(source_rows[source_index * params.source_stride_floats + 6u] > 0.0)
  ) {
    return;
  }
  let values = source_row_values(source_index);
  let level = i32(round(values.x));
  if (level != params.selected_level) {
    return;
  }
  if (bitcast<u32>(values.y) != bitcast<u32>(params.grid_spacing_m)) {
    record_invalid_source();
    return;
  }
  atomicAdd(&mechanics_view[header_word(H_SELECTED_SOURCE_COUNT)], 1u);
  let position = source_row_position(source_index).xyz;
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_index = grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let word = node_index >> 5u;
        let bit = node_index & 31u;
        if (word >= params.occupancy_word_count || word >= arrayLength(&occupancy_words)) {
          record_invalid_source();
          continue;
        }
        atomicOr(&occupancy_words[word], 1u << bit);
        atomicAdd(&mechanics_view[header_word(H_STENCIL_VISIT_COUNT)], 1u);
      }
    }
  }
}

@compute @workgroup_size(64)
fn count_occupied_words(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.occupancy_word_count) {
    return;
  }
  occupancy_counts[word] = countOneBits(atomicLoad(&occupancy_words[word]));
}

@compute @workgroup_size(64)
fn scatter_mechanics_nodes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.occupancy_word_count) {
    return;
  }
  let bits = atomicLoad(&occupancy_words[word]);
  let destination_base = occupancy_offsets[word];
  var local_rank = 0u;
  for (var bit = 0u; bit < 32u; bit = bit + 1u) {
    if ((bits & (1u << bit)) == 0u) {
      continue;
    }
    let node_index = word * 32u + bit;
    let destination = destination_base + local_rank;
    if (
      node_index < params.grid_node_count
      && destination < params.node_capacity
      && params.view_node_offset_words + destination < arrayLength(&mechanics_view)
    ) {
      atomicStore(
        &mechanics_view[params.view_node_offset_words + destination],
        node_index
      );
    }
    local_rank = local_rank + 1u;
  }
}

@compute @workgroup_size(1)
fn finalize_mechanics_view() {
  let last_word = params.occupancy_word_count - 1u;
  let node_count = occupancy_offsets[last_word] + occupancy_counts[last_word];
  let invalid_source_count = atomicLoad(
    &mechanics_view[header_word(H_INVALID_SOURCE_COUNT)]
  );
  let attempted_source_count = atomicLoad(
    &mechanics_view[header_word(H_ATTEMPTED_SOURCE_COUNT)]
  );
  let selected_source_count = atomicLoad(
    &mechanics_view[header_word(H_SELECTED_SOURCE_COUNT)]
  );
  let stencil_visit_count = atomicLoad(
    &mechanics_view[header_word(H_STENCIL_VISIT_COUNT)]
  );
  let expected_source_work_count = source_work_count();
  let view_capacity_ready = params.view_capacity_words <= arrayLength(&mechanics_view)
    && params.view_node_offset_words <= params.view_capacity_words
    && params.node_capacity <= params.view_capacity_words - params.view_node_offset_words;
  let overflow_count = select(0u, node_count - params.node_capacity, node_count > params.node_capacity);
  let admitted = spatial_directory_admitted()
    && attempted_source_count == expected_source_work_count
    && invalid_source_count == 0u
    && overflow_count == 0u
    && view_capacity_ready;
  var flags = MECHANICS_STATUS_READY | MECHANICS_STATUS_ADMITTED;
  if (!admitted) {
    flags = MECHANICS_STATUS_FAIL_CLOSED;
    if (
      invalid_source_count != 0u
      || attempted_source_count != expected_source_work_count
    ) {
      flags = flags | MECHANICS_STATUS_INVALID_SOURCE;
    }
    if (overflow_count != 0u || !view_capacity_ready) {
      flags = flags | MECHANICS_STATUS_CAPACITY_OVERFLOW;
    }
  }
  let dispatch_x = select(
    0u,
    (node_count + max(params.workgroup_size, 1u) - 1u)
      / max(params.workgroup_size, 1u),
    admitted && node_count > 0u
  );
  atomicStore(&mechanics_view[header_word(0u)], MECHANICS_MAGIC);
  atomicStore(&mechanics_view[header_word(1u)], MECHANICS_VERSION);
  atomicStore(&mechanics_view[header_word(2u)], flags);
  atomicStore(&mechanics_view[header_word(3u)], params.generation_id);
  atomicStore(&mechanics_view[header_word(4u)], params.device_ordinal);
  atomicStore(&mechanics_view[header_word(5u)], params.lane_ordinal);
  atomicStore(&mechanics_view[header_word(6u)], params.lease_token);
  atomicStore(&mechanics_view[header_word(7u)], params.source_family_id);
  atomicStore(&mechanics_view[header_word(8u)], params.storage_generation);
  atomicStore(&mechanics_view[header_word(9u)], params.physics_tick);
  atomicStore(&mechanics_view[header_word(10u)], params.physics_substep);
  atomicStore(&mechanics_view[header_word(11u)], params.position_epoch);
  atomicStore(&mechanics_view[header_word(12u)], params.topology_epoch);
  atomicStore(&mechanics_view[header_word(13u)], params.chart_epoch);
  atomicStore(&mechanics_view[header_word(14u)], params.level_epoch);
  atomicStore(&mechanics_view[header_word(15u)], params.support_epoch);
  atomicStore(&mechanics_view[header_word(16u)], params.source_count);
  atomicStore(&mechanics_view[header_word(17u)], bitcast<u32>(params.selected_level));
  atomicStore(&mechanics_view[header_word(18u)], params.grid_node_count);
  atomicStore(&mechanics_view[header_word(19u)], params.grid_nx);
  atomicStore(&mechanics_view[header_word(20u)], params.grid_ny);
  atomicStore(&mechanics_view[header_word(21u)], params.grid_nz);
  atomicStore(&mechanics_view[header_word(22u)], params.grid_shift);
  atomicStore(&mechanics_view[header_word(23u)], bitcast<u32>(params.grid_spacing_m));
  atomicStore(&mechanics_view[header_word(24u)], params.occupancy_word_count);
  atomicStore(&mechanics_view[header_word(25u)], params.node_capacity);
  atomicStore(&mechanics_view[header_word(26u)], select(0u, node_count, admitted));
  atomicStore(&mechanics_view[header_word(27u)], invalid_source_count);
  atomicStore(&mechanics_view[header_word(28u)], overflow_count);
  atomicStore(&mechanics_view[header_word(29u)], attempted_source_count);
  atomicStore(&mechanics_view[header_word(30u)], selected_source_count);
  atomicStore(&mechanics_view[header_word(31u)], stencil_visit_count);
  atomicStore(&mechanics_view[header_word(32u)], params.completion_ordinal);
  atomicStore(&mechanics_view[header_word(33u)], params.view_node_offset_words);
  atomicStore(&mechanics_view[header_word(34u)], params.view_node_offset_words + node_count);
  atomicStore(&mechanics_view[header_word(35u)], params.view_capacity_words);
  atomicStore(&mechanics_view[header_word(36u)], params.source_row_layout_id);
  atomicStore(&mechanics_view[header_word(37u)], dispatch_x);
  atomicStore(&mechanics_view[header_word(38u)], params.cleared_words);
  atomicStore(&mechanics_view[header_word(39u)], params.generation_id);
  atomicStore(&mechanics_view[DISPATCH_OFFSET_WORDS], dispatch_x);
  atomicStore(
    &mechanics_view[DISPATCH_OFFSET_WORDS + 1u],
    select(0u, 1u, admitted && node_count > 0u)
  );
  atomicStore(
    &mechanics_view[DISPATCH_OFFSET_WORDS + 2u],
    select(0u, 1u, admitted && node_count > 0u)
  );
}
`;function ft(e,t,n){let r=`fn ${t}(`,i=e.indexOf(r);if(i<0)throw Error(`missing mechanics-view WGSL function: ${t}`);let a=e.indexOf(`{`,i+r.length);if(a<0)throw Error(`missing mechanics-view WGSL function body: ${t}`);let o=0,s=-1;for(let t=a;t<e.length;t+=1){let n=e[t];if(n===`{`&&(o+=1),n===`}`&&(--o,o===0)){s=t+1;break}}if(s<0)throw Error(`unterminated mechanics-view WGSL function: ${t}`);return e.slice(0,i)+n+e.slice(s)}function pt(e,t,n,r){if(!e.includes(t))throw Error(`missing mechanics-view WGSL specialization: ${r}`);return e.replace(t,n)}function mt(){let e=dt;return e=e.replace(`@group(0) @binding(6) var<storage, read> active_source_view: array<u32>;
`,``),e=ft(e,`active_source_view_admitted`,`fn active_source_view_admitted() -> bool {
  return false;
}`),e=ft(e,`spatial_directory_v2_admitted`,`fn spatial_directory_v2_admitted() -> bool {
  return false;
}`),e=ft(e,`spatial_directory_admitted`,`fn spatial_directory_admitted() -> bool {
  return params.directory_abi_version == SPATIAL_VERSION_V1
    && spatial_directory_v1_admitted();
}`),e=ft(e,`source_work_count`,`fn source_work_count() -> u32 {
  return params.source_count;
}`),e=ft(e,`physical_source_for_work`,`fn physical_source_for_work(source_work_index: u32) -> u32 {
  return select(
    ACTIVE_SOURCE_MISSING,
    source_work_index,
    source_work_index < params.source_count
  );
}`),e=pt(e,`  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }`,`  let cell_index =
    spatial_directory[particle_to_cell_offset_words + source_index];`,`v1 direct reverse lookup`),e=pt(e,`  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );`,`  let dispatch_x = max(params.direct_dispatch_x, 1u);`,`v1 direct dispatch`),e}function ht(){let e=dt;return e=ft(e,`spatial_directory_v1_admitted`,`fn spatial_directory_v1_admitted() -> bool {
  return false;
}`),e=ft(e,`spatial_directory_admitted`,`fn spatial_directory_admitted() -> bool {
  return params.directory_abi_version == SPATIAL_VERSION_V2
    && spatial_directory_v2_admitted();
}`),e=ft(e,`source_work_count`,`fn source_work_count() -> u32 {
  return select(
    0u,
    active_source_view[18u],
    arrayLength(&active_source_view) >= ACTIVE_SOURCE_HEADER_WORDS
  );
}`),e=ft(e,`physical_source_for_work`,`fn physical_source_for_work(source_work_index: u32) -> u32 {
  let active_count = source_work_count();
  if (source_work_index >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let physical_source = active_source_view[
    params.active_to_physical_offset_words + source_work_index
  ];
  if (
    physical_source >= params.source_count
    || active_source_view[
      params.physical_to_active_offset_words + physical_source
    ] != source_work_index
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}`),e=pt(e,`  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }`,`  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  if (encoded_cell == 0u) {
    return false;
  }
  let cell_index = encoded_cell - 1u;`,`v2 plus-one reverse lookup`),e=pt(e,`  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );`,`  let dispatch_x = max(
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET],
    1u
  );`,`v2 GPU indirect dispatch`),e}mt(),ht();const gt=1297106737;function _t(e){if(typeof e!=`number`||!Number.isInteger(e)||e<1||e>4294967295)throw RangeError(`matchingCleanupPasses must be a positive u32 integer`);return 12+8*e}const vt=_t(1024),yt=1296650801,bt=4294967295,xt=2654435761,St=4*Uint32Array.BYTES_PER_ELEMENT;Object.freeze({READY:1,ADMITTED:2,FAIL_CLOSED:4});const Ct=Object.freeze({INITIALIZED:1,SUPPORT_REDUCED:2,TRAVERSED:4,SCANNED:8,CSR_SCATTERED:16,GRAPH_VERIFIED:32,ITERATION_0:64,ITERATION_1:128,ITERATION_2:256,ITERATION_3:512,RESIDUAL_VERIFIED:1024,PROPOSAL_PUBLISHED:2048,COMMITTED:4096,ENERGY_ITERATION_0:8192,ENERGY_ITERATION_1:16384,ENERGY_ITERATION_2:32768,ENERGY_ITERATION_3:65536,ENERGY_VERIFIED:1<<17,ITERATION_4:1<<18,ITERATION_5:1<<19,ITERATION_6:1<<20,ITERATION_7:1<<21,ENERGY_ITERATION_4:1<<22,ENERGY_ITERATION_5:1<<23,ENERGY_ITERATION_6:1<<24,ENERGY_ITERATION_7:1<<25,ITERATIONS_8_15:1<<26,ENERGY_ITERATIONS_8_15:1<<27,MATCHING_CLEANUP:1<<28,MATCHING_TRUST_RESTORED:1<<29,CONTACT_INTERFACE_RECEIPT_PUBLISHED:1<<30}),wt=Object.freeze({DIRECTORY_REJECT:1,MALFORMED_TRAVERSAL:2,COUNTER_OVERFLOW:4,GRAPH_CAPACITY:8,SCAN_COUNT_MISMATCH:16,CSR_BOUNDS_OR_RANK:32,DUPLICATE_ENDPOINT:64,MISSING_RECIPROCAL:128,LEVEL_OR_SOURCE_IDENTITY:256,NONFINITE:512,ITERATION_INCOMPLETE:1024,POSITION_RESIDUAL:2048,VELOCITY_RESIDUAL:4096,HEADER_OR_EPOCH:8192,PUBLICATION_INCOMPLETE:16384,STAGE_ORDER:32768,ENERGY_GAIN:65536,ENERGY_CLOSURE:1<<17,NEGATIVE_INTERNAL_ENERGY:1<<18,CONTACT_INTERFACE_RECEIPT:1<<19}),Tt=Object.freeze(`magic:u32.abiVersion:u32.generationId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.supportEpoch:u32.selectedLevel:i32-bits.directedPairCapacity:u32.appendAttemptCount:u32.requiredDirectedPairCount:u32.publishedCsrDirectedPairCount:u32.stickyFailureBits:u32.completedStageMask:u32.validationCount:u32.verificationCount:u32.publicationCount:u32.measureCount0:u32.measureCount1:u32.measureCount2:u32.measureCount3:u32.solveCount0:u32.solveCount1:u32.solveCount2:u32.solveCount3:u32.maxPositionResidualOrderedF32:u32.maxVelocityResidualOrderedF32:u32.dispatchIndirectX:u32.dispatchIndirectY:u32.dispatchIndirectZ:u32.energyMeasureCount0:u32.energyMeasureCount1:u32.energyMeasureCount2:u32.energyMeasureCount3:u32.pairKineticDeltaJ:f32-bits.pairHeatJ:f32-bits.wallHeatJ:f32-bits.energyResidualJ:f32-bits.fullSolverPath:u32.zeroEdgeDispatchX:u32.zeroEdgeDispatchY:u32.zeroEdgeDispatchZ:u32.measureCount4:u32.measureCount5:u32.measureCount6:u32.measureCount7:u32.solveCount4:u32.solveCount5:u32.solveCount6:u32.solveCount7:u32.energyMeasureCount4:u32.energyMeasureCount5:u32.energyMeasureCount6:u32.energyMeasureCount7:u32.measureCount8:u32.measureCount9:u32.measureCount10:u32.measureCount11:u32.measureCount12:u32.measureCount13:u32.measureCount14:u32.measureCount15:u32.solveCount8:u32.solveCount9:u32.solveCount10:u32.solveCount11:u32.solveCount12:u32.solveCount13:u32.solveCount14:u32.solveCount15:u32.energyMeasureCount8:u32.energyMeasureCount9:u32.energyMeasureCount10:u32.energyMeasureCount11:u32.energyMeasureCount12:u32.energyMeasureCount13:u32.energyMeasureCount14:u32.energyMeasureCount15:u32.preSolveMaxPositionResidualOrderedF32_0:u32.preSolveMaxPositionResidualOrderedF32_1:u32.preSolveMaxPositionResidualOrderedF32_2:u32.preSolveMaxPositionResidualOrderedF32_3:u32.preSolveMaxPositionResidualOrderedF32_4:u32.preSolveMaxPositionResidualOrderedF32_5:u32.preSolveMaxPositionResidualOrderedF32_6:u32.preSolveMaxPositionResidualOrderedF32_7:u32.preSolveMaxPositionResidualOrderedF32_8:u32.preSolveMaxPositionResidualOrderedF32_9:u32.preSolveMaxPositionResidualOrderedF32_10:u32.preSolveMaxPositionResidualOrderedF32_11:u32.preSolveMaxPositionResidualOrderedF32_12:u32.preSolveMaxPositionResidualOrderedF32_13:u32.preSolveMaxPositionResidualOrderedF32_14:u32.preSolveMaxPositionResidualOrderedF32_15:u32.preSolveMaxPositionViolationRatioOrderedF32_0:u32.preSolveMaxPositionViolationRatioOrderedF32_1:u32.preSolveMaxPositionViolationRatioOrderedF32_2:u32.preSolveMaxPositionViolationRatioOrderedF32_3:u32.preSolveMaxPositionViolationRatioOrderedF32_4:u32.preSolveMaxPositionViolationRatioOrderedF32_5:u32.preSolveMaxPositionViolationRatioOrderedF32_6:u32.preSolveMaxPositionViolationRatioOrderedF32_7:u32.preSolveMaxPositionViolationRatioOrderedF32_8:u32.preSolveMaxPositionViolationRatioOrderedF32_9:u32.preSolveMaxPositionViolationRatioOrderedF32_10:u32.preSolveMaxPositionViolationRatioOrderedF32_11:u32.preSolveMaxPositionViolationRatioOrderedF32_12:u32.preSolveMaxPositionViolationRatioOrderedF32_13:u32.preSolveMaxPositionViolationRatioOrderedF32_14:u32.preSolveMaxPositionViolationRatioOrderedF32_15:u32.preSolveMaxVelocityResidualOrderedF32_0:u32.preSolveMaxVelocityResidualOrderedF32_1:u32.preSolveMaxVelocityResidualOrderedF32_2:u32.preSolveMaxVelocityResidualOrderedF32_3:u32.preSolveMaxVelocityResidualOrderedF32_4:u32.preSolveMaxVelocityResidualOrderedF32_5:u32.preSolveMaxVelocityResidualOrderedF32_6:u32.preSolveMaxVelocityResidualOrderedF32_7:u32.preSolveMaxVelocityResidualOrderedF32_8:u32.preSolveMaxVelocityResidualOrderedF32_9:u32.preSolveMaxVelocityResidualOrderedF32_10:u32.preSolveMaxVelocityResidualOrderedF32_11:u32.preSolveMaxVelocityResidualOrderedF32_12:u32.preSolveMaxVelocityResidualOrderedF32_13:u32.preSolveMaxVelocityResidualOrderedF32_14:u32.preSolveMaxVelocityResidualOrderedF32_15:u32.matchingCleanupPassCount:u32.matchingCleanupTrustRestoreCount:u32`.split(`.`)),Et=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.supportEpoch:u32.selectedLevel:i32-bits.particleCount:u32.particleCapacity:u32.directedPairCapacity:u32.appendAttemptCount:u32.stagedDirectedPairCount:u32.requiredDirectedPairCount:u32.publishedDirectedPairCount:u32.overflowCount:u32.invalidSourceCount:u32.invalidPeerCount:u32.duplicatePeerCount:u32.asymmetricPeerCount:u32.countPassCount:u32.scanPassCount:u32.scatterPassCount:u32.verifyPassCount:u32.publishPassCount:u32.measurePassCount:u32.solvePassCount:u32.maxPositionResidualOrderedF32:u32.maxVelocityResidualOrderedF32:u32.energyMeasurePassCount:u32.pairKineticDeltaJ:f32-bits.pairHeatJ:f32-bits.wallHeatJ:f32-bits.energyResidualJ:f32-bits.energyToleranceJ:f32-bits.energyGainCount:u32.negativeInternalEnergyCount:u32.candidateVisitCount:u32.aggregateSummaryPhaseMismatchCount:u32.aggregateSummaryPreflightCount:u32.aggregateHierarchyNodeVisitCount:u32.aggregateHierarchyPrunedNodeCount:u32.aggregateHierarchySourceCount:u32.aggregateSummaryLineageMaterialMismatchCount:u32.projectedPeerVisitCount:u32`.split(`.`)),Dt=Object.freeze([`dispatchX:u32`,`dispatchY:u32`,`dispatchZ:u32`]),Ot=Object.freeze([`zeroEdgeDispatchX:u32`,`zeroEdgeDispatchY:u32`,`zeroEdgeDispatchZ:u32`]);function kt(e){return Object.freeze(Object.fromEntries(e.map((e,t)=>[e.slice(0,e.indexOf(`:`)),t])))}const At=kt(Tt),jt=kt(Et),Mt=Object.freeze([`sourceIndex:u32`,`peerIndex:u32`,`sourceLocalRank:u32`]),Nt=Object.freeze([`peerIndex:u32`]),Pt=Object.freeze([`positionX:f32-bits`,`positionY:f32-bits`,`positionZ:f32-bits`,`massKg:f32-bits`,`velocityX:f32-bits`,`velocityY:f32-bits`,`velocityZ:f32-bits`,`specificInternalEnergyJPerKg:f32-bits`]),Ft=Object.freeze([`barrierDxScale:f32-bits`,`barrierDvScale:f32-bits`,`softDxScale:f32-bits`,`softDvScale:f32-bits`]),It=Object.freeze([`iterationQuadraticBudgetFraction:f32-bits`,`iterationQuadraticEnergyJ:f32-bits`,`iterationHalfLinearLossBudgetJ:f32-bits`,`iterationWallKineticLossJ:f32-bits`,`cumulativePairKineticDeltaJ:f32-bits`,`cumulativePairHeatJ:f32-bits`,`cumulativeWallHeatJ:f32-bits`,`initialSpecificInternalEnergyJPerKg:f32-bits`]),Lt=Object.freeze([`positionDeltaX:f32-bits`,`positionDeltaY:f32-bits`,`positionDeltaZ:f32-bits`,`mechanicalHeatJ:f32-bits`,`velocityDeltaX:f32-bits`,`velocityDeltaY:f32-bits`,`velocityDeltaZ:f32-bits`,`specificInternalEnergyDeltaJPerKg:f32-bits`]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-mechanical-pair-graph.v10`,version:10,controlLayout:Tt,controlWord:At,evidenceLayout:Et,evidenceWord:jt,indirectDispatchLayout:Dt,conditionalDispatchLayout:Ot,stagingRowLayout:Mt,directedRowLayout:Nt,stateRowLayout:Pt,scaleRowLayout:Ft,energyRowLayout:It,proposalRowLayout:Lt,stageBits:Ct,stickyFailureBits:wt,construction:`one-exact-near-traversal-atomic-append-source-count-exclusive-scan-deterministic-local-rank-scatter`,stagingOrder:`atomic-append-order-non-authoritative`,directedCsrOrder:`source-major-then-exact-near-deterministic-source-local-rank`,directedSourceIdentity:`implicit-csr-source-offset-range`,directedRowPayload:`peer-source-index-u32`,csrTerminator:`sourceOffsets[particleCapacity]=requiredDirectedPairCount`,reciprocityValidation:`each-source-range-rejects-duplicate-peer-and-each-peer-range-contains-exactly-one-reciprocal-source`,countPolicy:`append-attempt-and-required-total-saturating-with-sticky-overflow`,candidateVisitPolicy:`directory-member-visits-including-self-and-members-rejected-by-contact-filters-saturating-with-sticky-overflow`,projectedPeerVisitPolicy:`post-active-projection peer endpoint metadata and pair-predicate visits; dormant entries represented only by candidate accounting are excluded`,overflowPolicy:`fail-closed-zero-indirect-dispatch-and-no-truncated-prefix-publication`,controlDispatchEvidence:`control-words-29-through-31-computed-dispatch-fields-evidence-only`,indirectDispatchBufferPolicy:`dedicated-three-u32-storage-indirect-buffer-no-control-alias`,conditionalDispatchBufferPolicy:`authenticated-control-zero-edge-triplet selects certified zero-edge completion, then the full-solver path phase-reuses the dedicated storage-indirect triplet for GPU-latched matching-cleanup particle dispatch without host readback`,sortPolicy:`none-csr-order-authored-by-exclusive-scan-and-source-local-rank`,exactNearTraversalCount:1,radixSortRequired:!1,sentinelPaddingRequired:!1,readbackPolicy:`fixed-evidence-diagnostic-only`,submissionOwnership:`caller`,bytesPerDirectedPair:St}),Uint32Array.BYTES_PER_ELEMENT;const Rt=1397114421,zt=1397117491,Bt=Object.freeze([`pressureVolumeMomentPaM3:f32-bits`,`representedCurrentVolumeM3:f32-bits`,`absolutePressurePa:f32-bits`,`contributionCount:u32`]),Vt=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.phase:u32.macroSubstepOrdinal:u32.fieldMutationOrdinal:u32.fieldCount:u32.heatContributionCount:u32.totalHeatJ:f32-bits.publishedHeatJ:f32-bits.consumedHeatJ:f32-bits.maxSpecificHeatJPerKg:f32-bits.macroLedgerGeneration:u32.maxFineCflRatio:f32-bits.partitionOfUnityResidual:f32-bits.firstMomentResidualM:f32-bits.totalPressureInternalCompensationJ:f32-bits.publishedPressureInternalCompensationJ:f32-bits.consumedPressureInternalCompensationJ:f32-bits.measuredParticleInternalEnergyDeltaJ:f32-bits.totalAmbientImpulseXNs:f32-bits.totalAmbientImpulseYNs:f32-bits.totalAmbientImpulseZNs:f32-bits.totalAmbientExternalWorkJ:f32-bits.pressureMagic:u32.pressureVersion:u32.pressureStatusFlags:u32.pressureLawId:u32.pressureAmbientPa:f32-bits.pressureInternalScale:f32-bits.pressureFieldCount:u32.pressureSourceMutationOrdinal:u32.pressureRequiredConsumerMask:u32.pressureClaimedConsumerMask:u32.pressureConsumedConsumerMask:u32.pressureSeal:u32`.split(`.`)),Ht=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.sourceCount:u32.selectedLevel:i32-bits.gridNodeCount:u32.gridDimX:u32.gridDimY:u32.gridDimZ:u32.gridShift:u32.gridSpacingM:f32-bits.descriptorOffsetWords:u32.descriptorWords:u32.keyOffsetWords:u32.keyWords:u32.accumulatorOffsetWords:u32.accumulatorWords:u32.stateOffsetWords:u32.stateWords:u32.fieldCapacity:u32.candidateCount:u32.fieldCount:u32.invalidSourceCount:u32.clippedCandidateCount:u32.overflowCount:u32.completionOrdinal:u32.sourceRowLayoutId:u32.identityStrideWords:u32.requiredWords:u32.capacityWords:u32.clearedAccumulatorWords:u32.dispatchX:u32.dispatchY:u32.dispatchZ:u32.parentMechanicsViewMagic:u32.parentMechanicsViewVersion:u32.parentMechanicsNodeCapacity:u32.uniqueEvidenceGeneration:u32.uniqueEvidenceElementCount:u32.uniqueEvidenceCount:u32.uniqueEvidenceStatus:u32.descriptorCount:u32.keyOrdering:u32.continuityPolicy:u32.mechanicalFamilyPolicy:u32.invalidFieldKeyCount:u32.stateEncoding:u32.dispatchIndirectX:u32.dispatchIndirectY:u32.dispatchIndirectZ:u32.stateMutationOrdinal:u32`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-mechanics-field-view.v5`,version:5,headerLayout:Ht,key:Object.freeze([`denseGridNodeId:u32`,`mechanicalFamilyId:u32`,`materialId:u32`,`continuityDomainId:u32`]),descriptor:Object.freeze([`mechanicalFamilyId:u32`,`materialId:u32`,`continuityDomainId:u32`,`status:u32`,`stencilFieldIndex[27]:u32`,`reserved:u32`]),ordering:`stable-lexicographic-u32x4`,mechanicalFamilyPolicy:`dominant-thermodynamic-phase-id`,continuityPolicy:`solid-initial-body-domain;non-solid-material-continuum-domain-zero`,construction:`gpu-authenticated-particle-stencil-packed-u32x3-stable-radix-scan-unique-to-public-u32x4`,temporalCoarsePredictorSidecar:Object.freeze({phase:`p2g-finalized-only`,accumulatorWords:Object.freeze([0,1,2]),receiptWords:Object.freeze([13,14,15]),contributionRecordFloats:12,lifecycle:`active-source-v2-p2g-publish;parent-workspace-consume-before-grid-update;heat-clear-reuse`}),sourceAuthorities:Object.freeze({v1:Object.freeze({id:1,sourceWorkIdentity:`physical-source-index`,dispatch:`host-authenticated-direct-source-and-candidate-counts`}),v2:Object.freeze({id:2,directorySchema:v,activeSourceSchema:p,sourceWorkIdentity:`gpu-active-ordinal`,sourceProjection:`active-ordinal-to-stable-physical-source-index`,directoryAdmission:`physical-to-cell-plus-one-and-exact-cell-key-authenticated`,dispatch:`active-source-gpu-indirect-source-and-candidate-counts-no-host-active-count`})}),constructionDispatch:Object.freeze({directLinearization:`linearGroup=workgroup.x+workgroup.y*dispatchX`,sourceShape:`ceil(sourceCount/64) workgroups partitioned over device-limit-bounded x/y`,candidateShape:`ceil(candidateCount/64) workgroups partitioned over device-limit-bounded x/y`,capacityPolicy:`reject only beyond maxComputeWorkgroupsPerDimension squared`,evidence:`runtime publishes immutable source/candidate x-y-z workgroup shapes`}),consumerDispatch:Object.freeze({indirectRowWords:60,shape:`ceil(fieldCount/64) workgroups partitioned over producer-device-limit-bounded x/y with z=1`,linearization:`linearGroup=workgroup.x+workgroup.y*dispatchX;invocation=linearGroup*64+local.x`,authentication:`header-dispatch-row-equals-indirect-row;nonzero-shape-is-minimal-y-and-completely-covers-fieldCount`,failClosed:`zero-x-y-z`}),constructionEvidenceStatusWord:53,constructionEvidenceStatuses:Object.freeze({ready:1,uniformParent:2}),lookup:`generation-materialized-particle-stencil-to-field-index-o1-with-key-recheck`,overflowPolicy:`fail-closed-zero-indirect-dispatch`,mutationPolicy:`identity-layout-descriptors-keys-immutable;mechanics-may-publish-clear-evidence-state-encoding-and-fail-closed-zero-dispatch;accumulators-transition-p2g-to-local-heat-and-phase-volume-transport-ledgers-only-through-one-shot-receipt`,accumulatorLifecycle:`particle-stencil-contribution-record-emission-then-stable-radix-ordered-field-and-pressure-reduction-with-exact-contribution-count;immutable-pressure-rows-survive-field-local-heat-pressure-work-and-ambient-ledgers-until-required-consumers-complete`,pressureRows:Object.freeze({rowWords:4,rowLayout:Bt,offsetDerivation:`stateOffsetWords + fieldCapacity * stateWords; canonical field index is the row key`,law:`exact-p2g-volume-weighted-absolute-pressure`,fallbackPolicy:`fail-closed-no-density-rest-volume-render-radius-private-grid-or-ambient-substitution`}),receiptControlWords:36,receiptControlLayout:Vt,stateEncodingWord:59,stateMutationOrdinalWord:63,stateEncodings:Object.freeze({empty:0,massMomentumGradient:1,massVelocityGradient:2})});const Ut=`
struct MechanicsFieldViewParams {
  source_count: u32,
  source_capacity: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
  identity_stride_words: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  candidate_count: u32,
  field_capacity: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  lease_token: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  completion_ordinal: u32,
  descriptor_offset_words: u32,
  descriptor_words: u32,
  key_offset_words: u32,
  key_words: u32,
  accumulator_offset_words: u32,
  accumulator_words: u32,
  state_offset_words: u32,
  state_words: u32,
  capacity_words: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  parent_capacity_words: u32,
  parent_node_capacity: u32,
  workgroup_size: u32,
  stencil_size: u32,
  source_dispatch_x: u32,
  candidate_dispatch_x: u32,
  dispatch_x_limit: u32,
  source_dispatch_y: u32,
  candidate_dispatch_y: u32,
  reserved_dispatch0: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> particle_identity: array<u32>;
@group(0) @binding(2) var<storage, read_write> candidate_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> unique_keys: array<u32>;
@group(0) @binding(5) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(6) var<storage, read> parent_mechanics_view: array<u32>;
@group(0) @binding(7) var<uniform> params: MechanicsFieldViewParams;
@group(0) @binding(8) var<storage, read> sorted_candidate_indices: array<u32>;
@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;

const FIELD_MAGIC: u32 = ${Rt}u;
const FIELD_VERSION: u32 = 5u;
const FIELD_STATUS_READY: u32 = 1u;
const FIELD_STATUS_ADMITTED: u32 = 2u;
const FIELD_STATUS_FAIL_CLOSED: u32 = 4u;
const FIELD_STATUS_INVALID_SOURCE: u32 = 8u;
const FIELD_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const FIELD_HEADER_WORDS: u32 = 64u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_RADIX_KEY_WORDS: u32 = 3u;
const FIELD_RADIX_MATERIAL_MASK: u32 = 0x00ffffffu;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 = 36u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_PRESSURE_WORDS: u32 = 4u;
const FIELD_DISPATCH_OFFSET_WORDS: u32 = 60u;
const FIELD_INVALID_KEY: u32 = 0xffffffffu;
const FIELD_UNIQUE_STATUS_READY: u32 = 1u;
const FIELD_UNIQUE_STATUS_UNIFORM_PARENT: u32 = 2u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const PARENT_MAGIC: u32 = 0x534d5631u;
const PARENT_VERSION: u32 = 1u;
const PARENT_READY_ADMITTED: u32 = 3u;

fn field_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn field_integral_f32(value: f32) -> bool {
  return field_finite_f32(value) && value == trunc(value);
}

fn field_group_count(invocation_count: u32) -> u32 {
  let width = max(params.workgroup_size, 1u);
  return invocation_count / width
    + select(0u, 1u, invocation_count % width != 0u);
}

fn field_dispatch_x(group_count: u32) -> u32 {
  return min(group_count, max(params.dispatch_x_limit, 1u));
}

fn field_dispatch_y(group_count: u32, dispatch_x: u32) -> u32 {
  let width = max(dispatch_x, 1u);
  return group_count / width
    + select(0u, 1u, group_count % width != 0u);
}

fn field_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  return linear_group * params.workgroup_size + local_id.x;
}

fn field_store(word: u32, value: u32) {
  atomicStore(&field_view[word], value);
}

fn field_load(word: u32) -> u32 {
  return atomicLoad(&field_view[word]);
}

fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}

fn field_record_clipped_candidate() {
  atomicAdd(&field_view[36u], 1u);
}

fn field_write_invalid_candidate(candidate_index: u32) {
  let base = candidate_index * FIELD_RADIX_KEY_WORDS;
  candidate_keys[base] = FIELD_INVALID_KEY;
  candidate_keys[base + 1u] = FIELD_INVALID_KEY;
  candidate_keys[base + 2u] = FIELD_INVALID_KEY;
}

fn field_parent_admitted() -> bool {
  let words = arrayLength(&parent_mechanics_view);
  if (words < 64u || words != params.parent_capacity_words) {
    return false;
  }
  return parent_mechanics_view[20u] == PARENT_MAGIC
    && parent_mechanics_view[21u] == PARENT_VERSION
    && parent_mechanics_view[22u] == PARENT_READY_ADMITTED
    && parent_mechanics_view[23u] == params.generation_id
    && parent_mechanics_view[24u] == params.device_ordinal
    && parent_mechanics_view[25u] == params.lane_ordinal
    && parent_mechanics_view[26u] == params.lease_token
    && parent_mechanics_view[27u] == params.source_family_id
    && parent_mechanics_view[28u] == params.storage_generation
    && parent_mechanics_view[29u] == params.physics_tick
    && parent_mechanics_view[30u] == params.physics_substep
    && parent_mechanics_view[31u] == params.position_epoch
    && parent_mechanics_view[32u] == params.topology_epoch
    && parent_mechanics_view[33u] == params.chart_epoch
    && parent_mechanics_view[34u] == params.level_epoch
    && parent_mechanics_view[35u] == params.support_epoch
    && parent_mechanics_view[36u] == params.source_count
    && bitcast<i32>(parent_mechanics_view[37u]) == params.selected_level
    && parent_mechanics_view[38u] == params.grid_node_count
    && parent_mechanics_view[39u] == params.grid_nx
    && parent_mechanics_view[40u] == params.grid_ny
    && parent_mechanics_view[41u] == params.grid_nz
    && parent_mechanics_view[42u] == params.grid_shift
    && parent_mechanics_view[43u] == bitcast<u32>(params.grid_spacing_m)
    && parent_mechanics_view[45u] == params.parent_node_capacity
    && parent_mechanics_view[47u] == 0u
    && parent_mechanics_view[48u] == 0u
    && parent_mechanics_view[52u] == params.completion_ordinal
    && parent_mechanics_view[53u] == 64u
    && parent_mechanics_view[54u] == 64u + parent_mechanics_view[46u]
    && parent_mechanics_view[55u] == params.parent_capacity_words
    && parent_mechanics_view[56u] == params.source_row_layout_id
    && parent_mechanics_view[57u]
      == (parent_mechanics_view[46u] / 64u
        + select(0u, 1u, parent_mechanics_view[46u] % 64u != 0u))
    && parent_mechanics_view[59u] == params.generation_id
    && parent_mechanics_view[60u] == parent_mechanics_view[57u]
    && parent_mechanics_view[61u]
      == select(0u, 1u, parent_mechanics_view[46u] > 0u)
    && parent_mechanics_view[62u] == parent_mechanics_view[61u];
}

fn field_grid_index(i: i32, j: i32, k: i32) -> u32 {
  let si = i + i32(params.grid_shift);
  let sj = j + i32(params.grid_shift);
  let sk = k + i32(params.grid_shift);
  if (
    si < 0 || sj < 0 || sk < 0
    || si >= i32(params.grid_nx)
    || sj >= i32(params.grid_ny)
    || sk >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  return (u32(si) * params.grid_ny + u32(sj)) * params.grid_nz + u32(sk);
}

fn field_quadratic_weight_at(fraction: f32, offset: i32) -> f32 {
  if (offset == 0) {
    let value = 1.5 - fraction;
    return 0.5 * value * value;
  }
  if (offset == 1) {
    let value = fraction - 1.0;
    return 0.75 - value * value;
  }
  let value = fraction - 0.5;
  return 0.5 * value * value;
}

fn field_source_admitted(source_index: u32) -> bool {
  if (
    params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    || params.source_stride_floats != 16u
    || params.identity_stride_words == 0u
  ) {
    return false;
  }
  let row = source_index * params.source_stride_floats;
  let identity_row = source_index * params.identity_stride_words;
  if (
    row > arrayLength(&source_rows)
    || params.source_stride_floats > arrayLength(&source_rows) - row
    || identity_row >= arrayLength(&particle_identity)
  ) {
    return false;
  }
  let level = source_rows[row];
  let spacing = source_rows[row + 1u];
  let mass = source_rows[row + 6u];
  let phase = source_rows[row + 8u];
  let material = source_rows[row + 9u];
  let status = source_rows[row + 10u];
  let x = source_rows[row + 12u];
  let y = source_rows[row + 13u];
  let z = source_rows[row + 14u];
  let chart = source_rows[row + 15u];
  return field_integral_f32(level)
    && field_finite_f32(spacing)
    && spacing > 0.0
    && field_finite_f32(mass)
    && mass >= 0.0
    && field_integral_f32(phase)
    && phase >= 1.0
    && phase <= 4.0
    && field_integral_f32(material)
    && material >= 1.0
    && material <= 16777215.0
    && field_integral_f32(status)
    && status >= 0.0
    && status <= 255.0
    && (
      (mass == 0.0 && (u32(round(status)) & 31u) != 0u)
      || (
        mass > 0.0
        && (u32(round(status)) & 31u) != 0u
        && (u32(round(status)) & 64u) == 0u
        && (u32(round(status)) & 128u) == 0u
      )
    )
    && field_finite_f32(x)
    && field_finite_f32(y)
    && field_finite_f32(z)
    && field_integral_f32(chart)
    && chart >= 0.0;
}

@compute @workgroup_size(64)
fn emit_field_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.source_dispatch_x
  );
  if (source_index >= params.source_count) {
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (!field_parent_admitted() || !field_source_admitted(source_index)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  // Fixed-capacity product and phase-companion rows remain present while
  // empty. They are valid storage, but not mechanical sources.
  if (!(source_rows[row + 6u] > 0.0)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let level = i32(round(source_rows[row]));
  if (level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(params.grid_spacing_m)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = source_index * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}

fn field_unique_count_without_sentinel() -> u32 {
  if (arrayLength(&unique_evidence) < 8u) {
    return 0u;
  }
  let unique_count = unique_evidence[2u];
  if (unique_count == 0u || unique_count > params.field_capacity) {
    return unique_count;
  }
  let last = (unique_count - 1u) * FIELD_RADIX_KEY_WORDS;
  if (
    last <= arrayLength(&unique_keys)
    && FIELD_RADIX_KEY_WORDS <= arrayLength(&unique_keys) - last
    && unique_keys[last] == FIELD_INVALID_KEY
    && unique_keys[last + 1u] == FIELD_INVALID_KEY
    && unique_keys[last + 2u] == FIELD_INVALID_KEY
  ) {
    return unique_count - 1u;
  }
  return unique_count;
}

fn field_key_strictly_less(left: u32, right: u32) -> bool {
  let left_base = left * FIELD_RADIX_KEY_WORDS;
  let right_base = right * FIELD_RADIX_KEY_WORDS;
  for (var word = 0u; word < FIELD_RADIX_KEY_WORDS; word = word + 1u) {
    let a = unique_keys[left_base + word];
    let b = unique_keys[right_base + word];
    if (a < b) { return true; }
    if (a > b) { return false; }
  }
  return false;
}

fn field_parent_find_node(node_index: u32) -> u32 {
  let node_count = parent_mechanics_view[46u];
  let node_offset = parent_mechanics_view[53u];
  if (
    node_index >= params.grid_node_count
    || node_offset > arrayLength(&parent_mechanics_view)
    || node_count > arrayLength(&parent_mechanics_view) - node_offset
  ) {
    return FIELD_INVALID_KEY;
  }
  var lower = 0u;
  var upper = node_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = parent_mechanics_view[node_offset + middle];
    if (candidate < node_index) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (
    lower < node_count
    && parent_mechanics_view[node_offset + lower] == node_index
  ) {
    return lower;
  }
  return FIELD_INVALID_KEY;
}

fn field_parent_contains_node(node_index: u32) -> bool {
  return field_parent_find_node(node_index) != FIELD_INVALID_KEY;
}

@compute @workgroup_size(64)
fn materialize_stencil_field_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  if (
    sorted_position >= params.candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= params.candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let source_index = candidate_index / 27u;
  let stencil_ordinal = candidate_index - source_index * 27u;
  if (source_index >= params.source_count || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  // The scan output is an exclusive prefix of unique-head flags, not the
  // group index at this sorted position.  Read the following prefix (or the
  // final unique count) to obtain the inclusive head count for every member
  // of the current group, then convert that count to a zero-based index.
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < params.candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}

@compute @workgroup_size(64)
fn assemble_field_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  let field_count = field_unique_count_without_sentinel();
  if (field_index >= field_count || field_index >= params.field_capacity) {
    return;
  }
  let source_key = field_index * FIELD_RADIX_KEY_WORDS;
  let node_index = unique_keys[source_key];
  let ordered = field_index == 0u
    || field_key_strictly_less(field_index - 1u, field_index);
  if (!ordered || !field_parent_contains_node(node_index)) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let packed_identity = unique_keys[source_key + 1u];
  let mechanical_family_id = packed_identity >> 24u;
  let material_id = packed_identity & FIELD_RADIX_MATERIAL_MASK;
  let continuity_domain_id = unique_keys[source_key + 2u];
  let identity_admitted = mechanical_family_id >= 1u
    && mechanical_family_id <= 4u
    && material_id >= 1u
    && material_id <= FIELD_RADIX_MATERIAL_MASK
    && ((mechanical_family_id << 24u) | material_id) == packed_identity
    && select(
      continuity_domain_id == 0u,
      continuity_domain_id != 0u,
      mechanical_family_id == 1u
    );
  if (!identity_admitted) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let destination_key = params.key_offset_words + field_index * FIELD_KEY_WORDS;
  field_store(destination_key, node_index);
  field_store(destination_key + 1u, mechanical_family_id);
  field_store(destination_key + 2u, material_id);
  field_store(destination_key + 3u, continuity_domain_id);
}

fn field_reject(flags: u32) {
  field_store(0u, FIELD_MAGIC);
  field_store(1u, FIELD_VERSION);
  field_store(2u, FIELD_STATUS_FAIL_CLOSED | flags);
  field_store(34u, 0u);
  field_store(
    37u,
    select(0u, 1u, (flags & FIELD_STATUS_CAPACITY_OVERFLOW) != 0u)
  );
  field_store(44u, 0u);
  field_store(45u, 0u);
  field_store(46u, 0u);
  for (var word = 50u; word < 60u; word = word + 1u) {
    field_store(word, 0u);
  }
  field_store(FIELD_DISPATCH_OFFSET_WORDS, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, 0u);
  field_store(63u, 0u);
}

fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(params.source_count);
  let candidate_group_count = field_group_count(params.candidate_count);
  let expected_source_dispatch_x = field_dispatch_x(source_group_count);
  let expected_candidate_dispatch_x = field_dispatch_x(candidate_group_count);
  return field_parent_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && params.source_dispatch_x == expected_source_dispatch_x
    && params.source_dispatch_y
      == field_dispatch_y(source_group_count, expected_source_dispatch_x)
    && params.source_dispatch_y <= params.dispatch_x_limit
    && params.candidate_dispatch_x == expected_candidate_dispatch_x
    && params.candidate_dispatch_y
      == field_dispatch_y(candidate_group_count, expected_candidate_dispatch_x)
    && params.candidate_dispatch_y <= params.dispatch_x_limit
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}

fn field_publish(
  field_count: u32,
  unique_generation: u32,
  unique_input_count: u32,
  unique_count: u32,
  unique_status: u32
) {
  let consumer_group_count = field_group_count(field_count);
  let dispatch_x = field_dispatch_x(consumer_group_count);
  let dispatch_y = field_dispatch_y(consumer_group_count, dispatch_x);
  let dispatch_z = select(0u, 1u, field_count > 0u);
  field_store(0u, FIELD_MAGIC);
  field_store(1u, FIELD_VERSION);
  field_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
  field_store(3u, params.generation_id);
  field_store(4u, params.device_ordinal);
  field_store(5u, params.lane_ordinal);
  field_store(6u, params.lease_token);
  field_store(7u, params.source_family_id);
  field_store(8u, params.storage_generation);
  field_store(9u, params.physics_tick);
  field_store(10u, params.physics_substep);
  field_store(11u, params.position_epoch);
  field_store(12u, params.topology_epoch);
  field_store(13u, params.chart_epoch);
  field_store(14u, params.level_epoch);
  field_store(15u, params.support_epoch);
  field_store(16u, params.source_count);
  field_store(17u, bitcast<u32>(params.selected_level));
  field_store(18u, params.grid_node_count);
  field_store(19u, params.grid_nx);
  field_store(20u, params.grid_ny);
  field_store(21u, params.grid_nz);
  field_store(22u, params.grid_shift);
  field_store(23u, bitcast<u32>(params.grid_spacing_m));
  field_store(24u, params.descriptor_offset_words);
  field_store(25u, params.descriptor_words);
  field_store(26u, params.key_offset_words);
  field_store(27u, params.key_words);
  field_store(28u, params.accumulator_offset_words);
  field_store(29u, params.accumulator_words);
  field_store(30u, params.state_offset_words);
  field_store(31u, params.state_words);
  field_store(32u, params.field_capacity);
  field_store(33u, params.candidate_count);
  field_store(34u, field_count);
  field_store(37u, 0u);
  field_store(38u, params.completion_ordinal);
  field_store(39u, params.source_row_layout_id);
  field_store(40u, params.identity_stride_words);
  let pressure_offset = params.state_offset_words
    + params.field_capacity * FIELD_STATE_WORDS;
  field_store(
    41u,
    pressure_offset + field_count * FIELD_PRESSURE_WORDS
  );
  field_store(42u, params.capacity_words);
  // Generation construction does not clear mechanics-owned accumulators.
  // The consumer clear pass publishes/observes that boundary separately.
  field_store(43u, 0u);
  let receipt_offset = params.state_offset_words - FIELD_RECEIPT_WORDS;
  for (var word = 0u; word < FIELD_RECEIPT_WORDS; word = word + 1u) {
    field_store(receipt_offset + word, 0u);
  }
  field_store(44u, dispatch_x);
  field_store(45u, dispatch_y);
  field_store(46u, dispatch_z);
  field_store(47u, PARENT_MAGIC);
  field_store(48u, PARENT_VERSION);
  field_store(49u, params.parent_node_capacity);
  field_store(50u, unique_generation);
  field_store(51u, unique_input_count);
  field_store(52u, unique_count);
  field_store(53u, unique_status);
  field_store(54u, params.source_count);
  field_store(55u, 1u);
  field_store(56u, 1u);
  field_store(57u, 1u);
  field_store(58u, 0u);
  field_store(59u, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS, dispatch_x);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, dispatch_y);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, dispatch_z);
  // Mutable mechanics operations authenticate every in-place transition with
  // this monotonically increasing generation-local ordinal. Word 38 retains
  // the immutable topology build completion ordinal.
  field_store(63u, 0u);
}

@compute @workgroup_size(1)
fn finalize_field_view() {
  if (
    !field_layout_admitted()
    || !field_parent_admitted()
  ) {
    field_reject(0u);
    return;
  }
  let unique_ready = arrayLength(&unique_evidence) >= 8u
    && unique_evidence[0u] == params.generation_id
    && unique_evidence[1u] == params.candidate_count
    && unique_evidence[3u] == FIELD_UNIQUE_STATUS_READY
    && unique_evidence[4u] == 0u
    && unique_evidence[5u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[6u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[7u] == 1u;
  let field_count = field_unique_count_without_sentinel();
  if (field_count > params.field_capacity) {
    field_reject(FIELD_STATUS_CAPACITY_OVERFLOW);
    return;
  }
  if (!unique_ready) {
    field_reject(0u);
    return;
  }
  if (field_load(35u) != 0u || field_load(58u) != 0u) {
    field_reject(FIELD_STATUS_INVALID_SOURCE);
    return;
  }
  field_publish(
    field_count,
    unique_evidence[0u],
    unique_evidence[1u],
    unique_evidence[2u],
    unique_evidence[3u]
  );
}
`;function Wt(e,t,n,r){if(!e.includes(t))throw Error(`unable to derive mechanics-field v2 WGSL: ${r}`);return e.replace(t,n)}function Gt(){let e=Ut;return e=Wt(e,`  reserved_dispatch0: u32,`,`  source_authority_version: u32,`,`source authority parameter`),e=Wt(e,`@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;`,`@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;
@group(0) @binding(10) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(11) var<storage, read> active_source_view: array<u32>;`,`directory and active-source bindings`),e=Wt(e,`const PARENT_VERSION: u32 = 1u;`,`const PARENT_VERSION: u32 = 1u;
const SOURCE_AUTHORITY_V2: u32 = 2u;
const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION_V2: u32 = 2u;
const SPATIAL_READY_ADMITTED: u32 = 3u;
const SPATIAL_REJECTED_MASK: u32 = 28u;
const SPATIAL_PRIMITIVE_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_FAIL_CLOSED: u32 = 4u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SPATIAL_REVERSE_CELL_PLUS_ONE: u32 = 1u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_READY_ADMITTED: u32 = 3u;
const ACTIVE_SOURCE_REJECTED_MASK: u32 = 252u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_SOURCE_COUNT_WORD: u32 = 18u;
const ACTIVE_SOURCE_CANDIDATE_COUNT_WORD: u32 = 43u;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD: u32 = 48u;
const ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD: u32 = 51u;
const ACTIVE_SOURCE_COMPLETION_WORD: u32 = 30u;
const ACTIVE_SOURCE_SEAL_WORD: u32 = 47u;`,`v2 authority constants`),e=Wt(e,`fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}`,`fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}

fn field_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn field_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn field_active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[ACTIVE_SOURCE_COUNT_WORD];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return params.source_authority_version == SOURCE_AUTHORITY_V2
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_READY_ADMITTED) == ACTIVE_SOURCE_READY_ADMITTED
    && (status & ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && active_source_view[3u] == params.generation_id
    && active_source_view[4u] == params.device_ordinal
    && active_source_view[5u] == params.lane_ordinal
    && active_source_view[6u] == params.lease_token
    && active_source_view[7u] == params.source_family_id
    && active_source_view[8u] == params.storage_generation
    && active_source_view[9u] == params.physics_tick
    && active_source_view[10u] == params.physics_substep
    && active_source_view[11u] == params.position_epoch
    && active_source_view[12u] == params.topology_epoch
    && active_source_view[13u] == params.chart_epoch
    && active_source_view[14u] == params.level_epoch
    && active_source_view[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_capacity <= physical_capacity
    && active_capacity <= 0xffffffffu / 27u
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == params.source_stride_floats
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[ACTIVE_SOURCE_COMPLETION_WORD]
      == params.completion_ordinal
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == params.workgroup_size
    && active_source_view[38u] == params.dispatch_x_limit
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
    && active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
      == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && params.candidate_count == active_capacity * 27u
    && active_source_view[ACTIVE_SOURCE_SEAL_WORD] != 0u;
}

fn field_active_source_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_COUNT_WORD],
    field_active_source_view_admitted()
  );
}

fn field_active_candidate_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD],
    field_active_source_view_admitted()
  );
}

fn field_physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = field_active_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source]
      != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn field_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < 48u || !field_active_source_view_admitted()) {
    return false;
  }
  let status = spatial_directory[2u];
  let physical_count = spatial_directory[16u];
  let physical_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let directory_capacity = spatial_directory[22u];
  let active_count = spatial_directory[37u];
  let cell_keys = spatial_directory[29u];
  let cell_offsets = spatial_directory[30u];
  let cell_members = spatial_directory[31u];
  let physical_reverse = spatial_directory[32u];
  let physical_upper = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let consumer_group_count = (cell_count + 63u) / 64u;
  let consumer_dispatch_x = spatial_directory[42u];
  let consumer_dispatch_y = spatial_directory[43u];
  let consumer_dispatch_z = spatial_directory[44u];
  let consumer_dispatch_admitted = select(
    consumer_dispatch_x > 0u
      && consumer_dispatch_x <= consumer_group_count
      && consumer_dispatch_y
        == field_dispatch_y(consumer_group_count, consumer_dispatch_x)
      && consumer_dispatch_z == 1u,
    consumer_dispatch_x == 0u
      && consumer_dispatch_y == 0u
      && consumer_dispatch_z == 0u,
    cell_count == 0u
  );
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V2
    && (status & SPATIAL_READY_ADMITTED) == SPATIAL_READY_ADMITTED
    && (status & SPATIAL_REJECTED_MASK) == 0u
    && spatial_directory[3u] == params.generation_id
    && spatial_directory[4u] == params.device_ordinal
    && spatial_directory[5u] == params.lane_ordinal
    && spatial_directory[6u] == params.lease_token
    && spatial_directory[7u] == params.source_family_id
    && spatial_directory[8u] == params.storage_generation
    && spatial_directory[9u] == params.physics_tick
    && spatial_directory[10u] == params.physics_substep
    && spatial_directory[11u] == params.position_epoch
    && spatial_directory[12u] == params.topology_epoch
    && spatial_directory[13u] == params.chart_epoch
    && spatial_directory[14u] == params.level_epoch
    && spatial_directory[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_capacity == params.source_capacity
    && active_count == field_active_source_count()
    && active_count <= physical_count
    && cell_count <= active_count
    && (active_count == 0u || cell_count > 0u)
    && cell_count <= cell_capacity
    && cell_capacity <= active_source_view[19u]
    && spatial_directory[20u] == spatial_directory[21u]
    && directory_capacity <= bound_words
    && physical_upper <= directory_capacity
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == 5u
    && spatial_directory[26u] == 5u
    && spatial_directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[28u] == 48u
    && cell_keys == 48u
    && cell_offsets == cell_keys + cell_capacity * 5u
    && cell_members == cell_offsets + cell_capacity + 1u
    && physical_reverse == cell_members + physical_capacity
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == build_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_FAIL_CLOSED) == 0u
    && consumer_dispatch_admitted
    && spatial_directory[46u] == 2u
    && field_range_within(cell_keys, cell_count * 5u, physical_upper)
    && field_range_within(cell_offsets, cell_count + 1u, physical_upper)
    && field_range_within(cell_members, active_count, physical_upper)
    && field_range_within(
      physical_reverse,
      physical_capacity,
      physical_upper
    )
    && spatial_directory[cell_offsets] == 0u
    && spatial_directory[cell_offsets + cell_count] == active_count;
}

fn field_spatial_membership_admitted(physical_source: u32) -> bool {
  if (
    physical_source >= params.source_count
    || !field_spatial_directory_admitted()
  ) {
    return false;
  }
  let cell_count = spatial_directory[18u];
  let cell_offsets = spatial_directory[30u];
  let reverse = spatial_directory[32u];
  let active_count = spatial_directory[37u];
  let cell_plus_one = spatial_directory[reverse + physical_source];
  if (cell_plus_one == 0u) {
    return false;
  }
  let cell_index = cell_plus_one - 1u;
  if (cell_index >= cell_count) {
    return false;
  }
  let begin = spatial_directory[cell_offsets + cell_index];
  let end = spatial_directory[cell_offsets + cell_index + 1u];
  if (begin >= end || end > active_count) {
    return false;
  }
  let row = physical_source * params.source_stride_floats;
  let spacing = source_rows[row + 1u];
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let cell_f = floor(position / spacing);
  let cell_i32_min = -2147483520.0;
  let cell_i32_max = 2147483520.0;
  if (
    !field_integral_f32(source_rows[row])
    || !field_integral_f32(source_rows[row + 15u])
    || !field_finite_f32(spacing)
    || !(spacing > 0.0)
    || !all(vec3<bool>(
      field_finite_f32(cell_f.x),
      field_finite_f32(cell_f.y),
      field_finite_f32(cell_f.z)
    ))
    || !all(vec3<bool>(
      cell_f.x >= cell_i32_min && cell_f.x <= cell_i32_max,
      cell_f.y >= cell_i32_min && cell_f.y <= cell_i32_max,
      cell_f.z >= cell_i32_min && cell_f.z <= cell_i32_max
    ))
  ) {
    return false;
  }
  let key = spatial_directory[29u] + cell_index * 5u;
  return spatial_directory[key] == u32(round(source_rows[row + 15u]))
    && spatial_directory[key + 1u]
      == field_signed_order_key(i32(round(source_rows[row])))
    && spatial_directory[key + 2u]
      == field_signed_order_key(i32(cell_f.x))
    && spatial_directory[key + 3u]
      == field_signed_order_key(i32(cell_f.y))
    && spatial_directory[key + 4u]
      == field_signed_order_key(i32(cell_f.z));
}`,`v2 authority helpers`),e=Wt(e,`@compute @workgroup_size(64)
fn emit_field_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.source_dispatch_x
  );
  if (source_index >= params.source_count) {
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (!field_parent_admitted() || !field_source_admitted(source_index)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  // Fixed-capacity product and phase-companion rows remain present while
  // empty. They are valid storage, but not mechanical sources.
  if (!(source_rows[row + 6u] > 0.0)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let level = i32(round(source_rows[row]));
  if (level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(params.grid_spacing_m)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = source_index * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}`,`@compute @workgroup_size(64)
fn emit_field_candidates_v2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let active_ordinal = field_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD]
  );
  let active_count = field_active_source_count();
  if (active_ordinal >= active_count) {
    return;
  }
  let source_index = field_physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING) {
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (
    !field_parent_admitted()
    || !field_source_admitted(source_index)
    || !field_spatial_membership_admitted(source_index)
  ) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  let level = i32(round(source_rows[row]));
  // ActiveSource is generation-global while one mechanics field is
  // level-local. Valid empty rows and valid rows from another level are
  // therefore non-selected work, not malformed field input.
  if (!(source_rows[row + 6u] > 0.0) || level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  if (
    bitcast<u32>(source_rows[row + 1u])
      != bitcast<u32>(params.grid_spacing_m)
  ) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  let fraction = grid_position - vec3<f32>(base);
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = active_ordinal * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let support_weight =
          field_quadratic_weight_at(fraction.x, ox)
          * field_quadratic_weight_at(fraction.y, oy)
          * field_quadratic_weight_at(fraction.z, oz);
        if (support_weight == 0.0) {
          field_write_invalid_candidate(candidate_index);
          continue;
        }
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}`,`v2 active candidate emission`),e=Wt(e,`@compute @workgroup_size(64)
fn materialize_stencil_field_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  if (
    sorted_position >= params.candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= params.candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let source_index = candidate_index / 27u;
  let stencil_ordinal = candidate_index - source_index * 27u;
  if (source_index >= params.source_count || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  // The scan output is an exclusive prefix of unique-head flags, not the
  // group index at this sorted position.  Read the following prefix (or the
  // final unique count) to obtain the inclusive head count for every member
  // of the current group, then convert that count to a zero-based index.
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < params.candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}`,`@compute @workgroup_size(64)
fn materialize_stencil_field_indices_v2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let candidate_count = field_active_candidate_count();
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD]
  );
  if (
    sorted_position >= candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let active_ordinal = candidate_index / 27u;
  let stencil_ordinal = candidate_index - active_ordinal * 27u;
  let source_index = field_physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}`,`v2 physical stencil destinations`),e=Wt(e,`fn assemble_field_keys(`,`fn assemble_field_keys_v2(`,`v2 assemble entry point`),e=Wt(e,`    params.candidate_dispatch_x
  );
  let field_count = field_unique_count_without_sentinel();`,`    active_source_view[ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD]
  );
  let field_count = field_unique_count_without_sentinel();`,`v2 assemble indirect linearization`),e=Wt(e,`fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(params.source_count);
  let candidate_group_count = field_group_count(params.candidate_count);
  let expected_source_dispatch_x = field_dispatch_x(source_group_count);
  let expected_candidate_dispatch_x = field_dispatch_x(candidate_group_count);
  return field_parent_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && params.source_dispatch_x == expected_source_dispatch_x
    && params.source_dispatch_y
      == field_dispatch_y(source_group_count, expected_source_dispatch_x)
    && params.source_dispatch_y <= params.dispatch_x_limit
    && params.candidate_dispatch_x == expected_candidate_dispatch_x
    && params.candidate_dispatch_y
      == field_dispatch_y(candidate_group_count, expected_candidate_dispatch_x)
    && params.candidate_dispatch_y <= params.dispatch_x_limit
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}`,`fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(field_active_source_count());
  let candidate_group_count = field_group_count(field_active_candidate_count());
  let source_dispatch_x = active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD];
  let source_dispatch_y = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 1u
  ];
  let source_dispatch_z = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 2u
  ];
  let candidate_dispatch_x = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
  ];
  let candidate_dispatch_y = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD + 1u
  ];
  let candidate_dispatch_z = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD + 2u
  ];
  return field_parent_admitted()
    && field_active_source_view_admitted()
    && field_spatial_directory_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && source_dispatch_x == field_dispatch_x(source_group_count)
    && source_dispatch_y
      == select(
        1u,
        field_dispatch_y(source_group_count, max(source_dispatch_x, 1u)),
        field_active_source_count() > 0u
      )
    && source_dispatch_z == 1u
    && candidate_dispatch_x == field_dispatch_x(candidate_group_count)
    && candidate_dispatch_y
      == select(
        1u,
        field_dispatch_y(candidate_group_count, max(candidate_dispatch_x, 1u)),
        field_active_candidate_count() > 0u
      )
    && candidate_dispatch_z == 1u
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.candidate_count == active_source_view[44u]
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}`,`v2 layout admission`),e=e.replaceAll(`field_store(33u, params.candidate_count);`,`field_store(33u, field_active_candidate_count());`),e=Wt(e,`    && unique_evidence[1u] == params.candidate_count`,`    && unique_evidence[1u] == field_active_candidate_count()`,`v2 GPU-count evidence`),e=Wt(e,`    && unique_evidence[7u] == 1u;`,`    && unique_evidence[7u] == 3u;`,`v2 GPU-count ready-admitted status`),e}Gt();const Kt=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.sourceCount:u32.sourceCapacity:u32.fieldCount:u32.fieldCapacity:u32.selectedLevel:i32-bits.gridNodeCount:u32.gridSpacingM:f32-bits.fieldCompletionOrdinal:u32.fieldKeyOffsetWords:u32.fieldKeyWords:u32.fieldDescriptorOffsetWords:u32.fieldDescriptorWords:u32.momentRowOffsetWords:u32.momentRowWords:u32.requiredMomentWords:u32.momentCapacityWords:u32.candidateCount:u32.rawVolumeRatioJMechanicsWord:u32.rawRestVolumeMechanicsWord:u32.mechanicsStrideFloats:u32.assignmentStrideFloats:u32.invalidRawVolumeCount:u32.invalidLineageCount:u32.clippedCandidateCount:u32.candidateContributionCount:u32.zeroedFieldCount:u32.readbackPerformed:u32.fullParticleReadbackPerformed:u32.diagnosticOnly:u32.stateMutationAllowed:u32.dispatchX:u32.dispatchY:u32.dispatchZ:u32.controlWords:u32.candidateContributionStrideFloats:u32.fieldRangeWords:u32.fieldViewSchemaMagic:u32.fieldViewSchemaVersion:u32.sourceRowLayoutId:u32.reserved0:u32.reserved1:u32.reserved2:u32.reserved3:u32.reserved4:u32.reserved5:u32.reserved6:u32.reserved7:u32`.split(`.`)),qt=Object.freeze([`denseGridNodeId:u32`,`mechanicalFamilyId:u32`,`materialId:u32`,`continuityDomainId:u32`,`rawCurrentVolumeM3:f32-bits`,`volumeGradientXM2:f32-bits`,`volumeGradientYM2:f32-bits`,`volumeGradientZM2:f32-bits`,`contributionCount:u32`,`statusFlags:u32`,`reserved0:u32`,`reserved1:u32`]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-phase-volume-moment.v1`,version:1,magic:1397773873,headerWords:64,headerLayout:Kt,rowWords:12,rowLayout:qt,sourceVolumeAuthority:`finite-positive-mls-mpm-restVolumeM3-word-19-times-volumeRatioJ-word-18-only`,sourceVolumeFallbackPolicy:`fail-closed-no-density-or-phase-reference-fallback`,fieldIdentity:`exact-existing-schroeder-mechanics-field-key-u32x4`,reduction:`stable-radix-sorted-candidate-groups-serial-per-field`,residency:`same-generation-same-device-retained-diagnostic-sidecar`,mutationPolicy:`diagnostic-only;no-p2g-grid-reaction-phase-render-or-particle-state-mutation`,partialPublicationPolicy:`whole-sidecar-fail-closed-on-invalid-source-or-lineage`,sourceAuthorities:Object.freeze({v1:Object.freeze({id:1,workIdentity:`physical-source-index`,count:`host-authenticated-physical-source-count`}),v2:Object.freeze({id:2,directorySchema:v,activeSourceSchema:p,workIdentity:`gpu-active-ordinal-projected-to-stable-physical-source-index`,count:`active-source-word-43-candidate-count-with-word-30-generation-seal`})})});const Jt=1397773906,Yt=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.globalScanSourceCount:u32.globalScanSourceCapacity:u32.fieldCount:u32.fieldCapacity:u32.globalScanCandidateCount:u32.selectedLevel:i32-bits.gridNodeCount:u32.gridSpacingM:f32-bits.momentHeaderWords:u32.momentRowWords:u32.momentCompletionOrdinal:u32.sourceGroupCount:u32.fieldGroupCount:u32.partialVec4Capacity:u32.selectedSourceVolumeM3:f32-bits.fieldVolumeM3:f32-bits.volumeResidualM3:f32-bits.volumeGradientXM2:f32-bits.volumeGradientYM2:f32-bits.volumeGradientZM2:f32-bits.gradientResidualNormM2:f32-bits.volumeToleranceM3:f32-bits.gradientToleranceM2:f32-bits.volumeConditioningSumAbsM3:f32-bits.gradientConditioningSumAbsM2:f32-bits.invalidSourceCount:u32.invalidFieldCount:u32.momentRejectCount:u32.identityMismatchCount:u32.clippedStencilCount:u32.overflowCount:u32.selectedSourceCount:u32.selectedCandidateCount:u32.sourceMechanicsStrideFloats:u32.rawVolumeRatioJMechanicsWord:u32.rawRestVolumeMechanicsWord:u32.readbackPerformed:u32.fullParticleReadbackPerformed:u32.diagnosticOnly:u32.stateMutationAllowed:u32.sourceDispatchX:u32.fieldDispatchX:u32.controlWords:u32.terminalSeal:u32.reserved0:u32.reserved1:u32.reserved2:u32.reserved3:u32`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-phase-volume-receipt.v2`,version:2,magic:Jt,headerWords:64,headerLayout:Yt,sourceAuthority:`same-device-same-generation-s9a-exact-level-assignment-and-active-field-descriptor-selected-finite-positive-restVolumeM3-word-19-times-volumeRatioJ-word-18-only`,fieldAuthority:`same-s9a-v1-moment-rows-and-exact-mechanics-field-u32x4-key-only`,conservation:`exact-level-selected-source-volume-equals-unclipped-phase-field-volume;stencil-gradient-sum-zero`,fallbackPolicy:`fail-closed-no-density-render-radius-or-represented-volume-fallback`,mutationPolicy:`diagnostic-only;no-p2g-grid-g2p-reflux-particle-thermo-reaction-phase-or-render-mutation`,residency:`same-command-encoder-retained-gpu-receipt-no-hot-path-readback`,futureLawPolicy:`eligible-read-only-evidence-not-a-pressure-or-drag-operator`,sourceAuthorities:Object.freeze({v1:Object.freeze({id:1,scan:`host-physical-source-count`}),v2:Object.freeze({id:2,scan:`active-source-word-18-indirect-dispatch-and-active-ordinal-to-physical-map`,candidateCount:`active-source-word-43`,generationSeal:`active-source-word-30`})})});const Xt=Object.freeze({mechanicsField:0,phaseVolumeReceiptControl:1,phaseVolumeMomentRows:2,gasPressureRowsPrivate:3,gasDirectoryPrivate:4,scratch:5,gasAuthorityControlPrivate:6,params:7,storageBindingCount:7}),P=Object.freeze({velocityX:0,velocityY:1,velocityZ:2,externalImpulseX:3,externalImpulseY:4,externalImpulseZ:5,externalWorkJ:6,fieldMassKg:7,fieldVolumeM3:8,gaugePressurePa:9,status:10,seal:11}),Zt=Object.freeze(`transportEnabled:u32.missingCellPolicy:u32.fieldCapacity:u32.generationId:u32.fieldCompletionOrdinal:u32.fieldMutationOrdinal:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.selectedLevel:i32-bits.gridNodeCount:u32.gridDimX:u32.gridDimY:u32.gridDimZ:u32.gridCellOriginX:i32-bits.gridCellOriginY:i32-bits.gridCellOriginZ:i32-bits.chartId:u32.dt:f32-bits.ambientPressurePa:f32-bits.pressureScale:f32-bits.gridSpacingM:f32-bits.gasAuthorityExecutionGeneration:u32.gasAuthorityStorageGeneration:u32.gasPressureCellCapacity:u32.gasPressureCellStrideFloats:u32.gasDirectoryGeneration:u32.gasDirectoryWordLength:u32.gasDirectoryCellCapacity:u32.gasDirectoryCellKeysOffsetWords:u32.gasDirectoryCellOffsetsOffsetWords:u32.gasDirectoryCellMembersOffsetWords:u32.gasDirectoryParticleToCellOffsetWords:u32.dispatchX:u32.dispatchY:u32.dispatchZ:u32.reserved0:u32.reserved1:u32.reserved2:u32.reserved3:u32.reserved4:u32.reserved5:u32.reserved6:u32.reserved7:u32.reserved8:u32.reserved9:u32.reserved10:u32.reserved11:u32.reserved12:u32.reserved13:u32.reserved14:u32.reserved15:u32.reserved16:u32.reserved17:u32.reserved18:u32.reserved19:u32.reserved20:u32.reserved21:u32.reserved22:u32`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-gas-pressure-boundary-transport.v1`,version:1,workgroupSize:64,paramsBytes:256,bindings:Xt,paramsLayout:Zt,dispatchAuthority:`host-known-field-capacity-with-device-limit-bounded-two-dimensional-shape;gpu-field-count-is-never-read-back`,condensedAuthority:`exact-s9a-v0-times-j-volume-and-gradient-rows-authenticated-by-s9b;phase-1-and-2-only`,gasAuthority:`exact-v4-owner-private-pressure-rows-directory-and-control-bindings-3-4-6`,pressureLaw:`gauge-pa=absolute-v4-pressure-pa-minus-explicit-ambient-pa;node-impulse-ns=pressure-scale-times-gauge-times-summed-condensed-v0j-gradient-m2-times-dt`,distribution:`each-condensed-field-receives-node-impulse-times-field-v0j-volume-over-node-condensed-v0j-volume`,signConvention:`positive-gauge-times-s9-condensed-volume-gradient-matches-existing-schroeder-pressure-drag-condensed-impulse`,missingCellPolicies:Object.freeze({noLoad:0,failClosed:1}),transaction:`prevalidate-field-prevalidate-source-initialize-stage-validate-commit;only-store-only-commit-mutates-mechanics-field`,residency:`no-mapAsync-no-host-logical-count-no-all-cell-scan;static-authorities-validated-once-on-gpu;one-exact-directory-binary-search-per-condensed-node-head`});const Qt=1398028593,$t=1398034993,F=Object.freeze({localHeatJ:0,localHeatContributionCount:1,parentRouteHeatJ:2,localPressureInternalCompensationJ:3,localReversibleStressInternalCompensationJ:3,ambientImpulseXNs:4,ambientImpulseYNs:5,ambientImpulseZNs:6,ambientWorkJ:7});Object.freeze({schema:`peercompute.ulg.schroeder-spatial-phase-volume-transport.v1`,paramsBytes:256,workgroupSize:64,topology:`exact-s9c-sparse-local-head-ranges-with-virtual-pairs-no-materialized-pair-graph`,volumeAuthority:`s9a-current-volume-v0-times-j-only`,materialAuthority:`exact-mechanics-material-phase-records-rest-density-sound-speed-viscosity-surface-tension`,localConservation:`antisymmetric-pressure-drag-and-cartesian-surface-stress-impulses;drag-loss-to-local-heat;reversible-pressure-and-capillary-work-to-signed-compensation-ledger`,surfaceStress:`s9a-color-gradient-css-on-exact-same-level-cartesian-faces;affine-parent-routes-are-not-physical-faces`,ambientBoundary:`hydrostatic-reference-density-buoyancy-with-explicit-external-impulse-and-work-ledger`,fallbackPolicy:`fail-closed-no-density-render-radius-private-grid-cpu-or-unverified-buffer-fallback`});const I=e=>`${Number(e)>>>0}u`;`${I(64)}${I(Rt)}${I(5)}${I(3)}${I(5)}${I(4)}${I(8)}${I(8)}${I(0)}${I(36)}${I(zt)}${I(3)}${I(3)}${I(5)}${I(3)}${I(1)}${I(64)}${I(Jt)}${I(2)}${I(3)}${I(12)}${I(3)}${I(48)}${I(5)}${I(y)}${I(1)}${I(3)}${I(28)}${I(2)}${I(1)}${I(1396854833)}${I(1)}${I(12)}${I(12)}${I(1396853070)}${I(1396855385)}${I(1396852273)}${I(1396855601)}${I(P.velocityX)}${I(P.velocityY)}${I(P.velocityZ)}${I(P.externalImpulseX)}${I(P.externalImpulseY)}${I(P.externalImpulseZ)}${I(P.externalWorkJ)}${I(P.fieldMassKg)}${I(P.fieldVolumeM3)}${I(P.gaugePressurePa)}${I(P.status)}${I(P.seal)}${I(0)}${I(1)}${I(F.ambientImpulseXNs)}${I(F.ambientImpulseYNs)}${I(F.ambientImpulseZNs)}${I(F.ambientWorkJ)}${I(64)}${I(64)}${I(64)}`;const en=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.fineLevel:i32-bits.coarseLevel:i32-bits.fineGridNodeCount:u32.coarseGridNodeCount:u32.fineGridDimX:u32.fineGridDimY:u32.fineGridDimZ:u32.coarseGridDimX:u32.coarseGridDimY:u32.coarseGridDimZ:u32.fineGridShift:u32.coarseGridShift:u32.fineGridSpacingM:f32-bits.coarseGridSpacingM:f32-bits.fineFieldCapacity:u32.coarseFieldCapacity:u32.candidateCapacity:u32.parentFieldCapacity:u32.edgeCapacity:u32.fineFieldCount:u32.coarseNativeFieldCount:u32.parentFieldCount:u32.edgeCount:u32.invalidSourceCount:u32.overflowCount:u32.clippedSupportCount:u32.maxWeightResidual:f32-bits.maxFirstMomentResidualM:f32-bits.completionOrdinal:u32.hierarchyCompletionOrdinal:u32.fineFieldCompletionOrdinal:u32.coarseFieldCompletionOrdinal:u32.parentKeyOffsetWords:u32.parentKeyWords:u32.fineEdgeCountOffsetWords:u32.fineEdgeOffsetOffsetWords:u32.fineEdgeParentOffsetWords:u32.fineEdgeWeightOffsetWords:u32.coarseNativeMapOffsetWords:u32.requiredWords:u32.capacityWords:u32.uniqueEvidenceGeneration:u32.uniqueEvidenceElementCount:u32.uniqueEvidenceCount:u32.dispatchX:u32.dispatchY:u32.dispatchZ:u32.finalizationOrdinal:u32.fineDispatchX:u32.fineDispatchY:u32.fineDispatchZ:u32.exactLevelCount:u32.coarseDispatchX:u32.coarseDispatchY:u32.coarseDispatchZ:u32.invalidKeyCount:u32.emittedCandidateCount:u32.nativeCandidateCount:u32.fineCandidateCount:u32.keyOrdering:u32.maxEdgesPerFineField:u32.clearedWords:u32.fineMechanicsFieldAdmissionMask:u32.coarseMechanicsFieldAdmissionMask:u32`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-parent-field-view.v1`,version:1,headerLayout:en,key:Object.freeze([`parentDenseNodeId:u32`,`mechanicalFamilyId:u32`,`materialId:u32`,`continuityDomainId:u32`]),ordering:`stable-lexicographic-u32x4`,levelCount:2,thirdMechanicsLevel:`forbidden-fail-closed`,construction:`native-coarse-fields-plus-hierarchy-trilinear-fine-parents-stable-radix-unique`,fineToParentTopology:`compact-weighted-csr-exact-up-to-eight-topology-edges`,coarseToParentTopology:`exact-native-field-to-union-index`,transferEvidence:`partition-of-unity-and-first-spatial-moment`,mutationPolicy:`immutable-after-finalization`,overflowPolicy:`fail-closed-zero-indirect-dispatch`,readbackPolicy:`explicit-fixed-evidence-probe-only`});const tn=1397770566,nn=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.fineFieldCount:u32.fineFieldCapacity:u32.coarseFieldCount:u32.coarseFieldCapacity:u32.fineLocalHeadCount:u32.coarseLocalHeadCount:u32.refluxRouteCount:u32.fineLevel:i32-bits.coarseLevel:i32-bits.twoLevel:u32.parentRoutesEnabled:u32.fineReceiptCompletionOrdinal:u32.coarseReceiptCompletionOrdinal:u32.parentFieldCompletionOrdinal:u32.fineLocalHeadOffsetWords:u32.coarseLocalHeadOffsetWords:u32.localHeadCapacity:u32.refluxRouteCapacity:u32.localHeadWords:u32.refluxRouteWords:u32.momentHeaderWords:u32.momentRowWords:u32.parentFieldHeaderWords:u32.inputFieldRowsChecked:u32.receiptRejectedCount:u32.identityMismatchCount:u32.invalidFieldCount:u32.invalidRouteCount:u32.overflowCount:u32.readbackPerformed:u32.fullParticleReadbackPerformed:u32.diagnosticOnly:u32.stateMutationAllowed:u32.terminalSeal:u32.localPolicyId:u32.refluxPolicyId:u32.fineLocalDispatchX:u32.coarseLocalDispatchX:u32.refluxRouteDispatchX:u32.controlWords:u32.reserved0:u32.reserved1:u32.reserved2:u32.reserved3:u32.reserved4:u32.reserved5:u32.reserved6:u32.reserved7:u32`.split(`.`)),rn=Object.freeze([`fieldBegin:u32`,`denseGridNodeId:u32`,`fieldEndExclusive:u32`,`level:i32-bits`,`policyId:u32`,`statusFlags:u32`,`reserved0:u32`,`reserved1:u32`]),an=Object.freeze([`fineFieldIndex:u32`,`parentEdgeBegin:u32`,`parentEdgeEndExclusive:u32`,`fineLevel:i32-bits`,`coarseLevel:i32-bits`,`parentFieldCompletionOrdinal:u32`,`statusFlags:u32`,`policyId:u32`]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-phase-volume-interface-proposal.v1`,version:1,magic:tn,headerWords:64,headerLayout:nn,localHeadWords:8,localHeadLayout:rn,refluxRouteWords:8,refluxRouteLayout:an,localTopology:`stable-sparse-same-dense-grid-node-head-ranges-over-exact-admitted-mechanics-field-key-rows`,refluxTopology:`stable-sparse-fine-field-heads-over-exact-immutable-parent-field-csr`,pairPolicy:`no-materialized-field-pairs;future-law-must-traverse-virtual-pairs-inside-admitted-local-ranges`,authority:`same-device-same-epoch-s9b-receipt-with-exact-s9a-moment-lineage-and-mechanics-field-view-only`,fallbackPolicy:`fail-closed-no-density-render-radius-represented-volume-state-or-thermo-fallback`,mutationPolicy:`diagnostic-only;no-p2g-grid-g2p-reflux-particle-thermo-reaction-phase-eos-or-render-mutation`,residency:`same-command-encoder-retained-gpu-artifact-no-hot-path-readback`}),Object.freeze([`generationId`,`deviceOrdinal`,`laneOrdinal`,`leaseToken`,`sourceFamilyId`,`storageGeneration`,`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`]);const L=e=>`${Number(e)>>>0}u`;`${L(64)}${L(Rt)}${L(5)}${L(3)}${L(5)}${L(0)}${L(12)}${L(3)}${L(Qt)}${L(1)}${L(8)}${L(12)}${L($t)}${L(F.localPressureInternalCompensationJ)}${L(F.ambientImpulseXNs)}${L(F.ambientImpulseYNs)}${L(F.ambientImpulseZNs)}${L(F.ambientWorkJ)}${L(64)}${L(64)}${L(64)}${L(64)}`;const R=e=>`${Number(e)>>>0}u`;`${R(64)}${R(Rt)}${R(5)}${R(3)}${R(5)}${R(0)}${R(64)}${R(4)}${R(36)}${R(zt)}${R(3)}${R(3)}${R(5)}${R(3)}${R(1397769777)}${R(1)}${R(1)}${R(3)}${R(5)}${R(1)}${R(64)}${R(tn)}${R(1)}${R(3)}${R(8)}${R(1)}${R(3)}${R(64)}${R(Jt)}${R(2)}${R(3)}${R(12)}${R(3)}${R(F.localHeatJ)}${R(F.localHeatContributionCount)}${R(F.localPressureInternalCompensationJ)}${R(F.ambientImpulseXNs)}${R(F.ambientImpulseYNs)}${R(F.ambientImpulseZNs)}${R(F.ambientWorkJ)}${R(Qt)}${R(1)}${R(8)}${R(12)}${R($t)}`,Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.fineLevel:i32-bits.coarseLevel:i32-bits.fineGridNodeCount:u32.coarseGridNodeCount:u32.fineGridDimX:u32.fineGridDimY:u32.fineGridDimZ:u32.coarseGridDimX:u32.coarseGridDimY:u32.coarseGridDimZ:u32.fineGridShift:u32.coarseGridShift:u32.fineGridSpacingM:f32-bits.coarseGridSpacingM:f32-bits.fineNodeCapacity:u32.coarseNodeCapacity:u32.edgeCapacity:u32.childEdgeCapacity:u32.fineNodeCount:u32.coarseNodeCount:u32.edgeCount:u32.childEdgeCount:u32.invalidFineNodeCount:u32.invalidCoarseNodeCount:u32.overflowCount:u32.clippedEdgeCount:u32.maxWeightResidual:f32-bits.maxFirstMomentResidualM:f32-bits.completionOrdinal:u32.directoryGenerationId:u32.fineMechanicsCompletionOrdinal:u32.coarseMechanicsCompletionOrdinal:u32.fineNodeOffsetWords:u32.coarseNodeOffsetWords:u32.edgeCountOffsetWords:u32.edgeOffsetOffsetWords:u32.edgeParentOffsetWords:u32.edgeWeightOffsetWords:u32.parentOfFineOffsetWords:u32.childCountOffsetWords:u32.childOffsetOffsetWords:u32.childIndexOffsetWords:u32.requiredWords:u32.capacityWords:u32.dispatchX:u32.dispatchY:u32.dispatchZ:u32.clearedWords:u32`.split(`.`)),Object.freeze({schema:`peercompute.ulg.schroeder-spatial-hierarchy-view.v1`,version:1,headerWords:64,dispatchOffsetWords:60,fineDispatchOffsetWords:64,levelCount:2,thirdMechanicsLevel:`forbidden-fail-closed`,fineNodeIdentity:`ascending-unique-dense-fine-grid-index-u32`,coarseNodeIdentity:`ascending-unique-dense-coarse-grid-index-u32`,interpolation:`normalized-trilinear-2-to-1-partition-of-unity-first-moment`,parentTopology:`exact-integral-floor-div2-one-parent-per-fine-node`,childTopology:`compact-csr-no-fixed-candidate-budget`,overflowPolicy:`fail-closed-zero-indirect-dispatch`,readbackPolicy:`explicit-fixed-evidence-probe-only`});const on=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.generationId:u32.deviceOrdinal:u32.laneOrdinal:u32.leaseToken:u32.sourceFamilyId:u32.storageGeneration:u32.physicsTick:u32.physicsSubstep:u32.positionEpoch:u32.topologyEpoch:u32.chartEpoch:u32.levelEpoch:u32.supportEpoch:u32.fineLevel:i32-bits.coarseLevel:i32-bits.fineFieldCapacity:u32.coarseFieldCapacity:u32.parentFieldCapacity:u32.fineFieldCount:u32.coarseFieldCount:u32.parentFieldCount:u32.edgeCount:u32.accumulatorOffsetWords:u32.baselineStateOffsetWords:u32.combinedStateOffsetWords:u32.rowWords:u32.requiredWords:u32.capacityWords:u32.atomicScale:f32-bits.dt:f32-bits.deltaScale:f32-bits.cflFactor:f32-bits.maxCorrectionMPerS:f32-bits.phase:u32.invalidSourceCount:u32.overflowCount:u32.nonfiniteCount:u32.invalidKeyCount:u32.invalidCsrCount:u32.restrictedEdgeCount:u32.injectedCoarseCount:u32.baselineActiveCount:u32.combinedActiveCount:u32.prolongedFineCount:u32.publishedCoarseCount:u32.fineFirstMomentResidualM:f32-bits.fineFirstMomentSumAbsM:f32-bits.finePartitionOfUnityResidual:f32-bits.finePartitionOfUnitySumAbs:f32-bits.completionOrdinal:u32.parentCompletionOrdinal:u32.fineCompletionOrdinal:u32.coarseCompletionOrdinal:u32.fineInputStateEncoding:u32.coarseInputStateEncoding:u32.fineOutputStateEncoding:u32.coarseOutputStateEncoding:u32.parentDispatchX:u32.parentDispatchY:u32.parentDispatchZ:u32.fineDispatchX:u32.fineDispatchY:u32.fineDispatchZ:u32.coarseDispatchX:u32.coarseDispatchY:u32.coarseDispatchZ:u32.operationOrdinal:u32.finalizationOrdinal:u32.internalEnergyTransferStatus:u32.refluxEvidenceStatus:u32.fineImpulseOffsetWords:u32.fineImpulseRowWords:u32.routeProposalRowWords:u32.fineSubstepOrdinal:u32.coarsePredictorStateOffsetWords:u32.routeProposalOffsetWords:u32.parentToCoarseOrdinalOffsetWords:u32.proposedFineLinearEnergyCoefficientJ:f32-bits.proposedFineQuadraticEnergyCoefficientJ:f32-bits.proposedCoarseLinearEnergyCoefficientJ:f32-bits.proposedCoarseQuadraticEnergyCoefficientJ:f32-bits.sealedRouteCflAlpha:f32-bits.sealedCorrectionAlpha:f32-bits.routeRejectCount:u32.registryRejectCount:u32.causalChannelCount:u32.proposedFineCount:u32.proposedFineImpulseXKgMPerS:f32-bits.proposedFineImpulseYKgMPerS:f32-bits.proposedFineImpulseZKgMPerS:f32-bits.proposedCoarseImpulseXKgMPerS:f32-bits.proposedCoarseImpulseYKgMPerS:f32-bits.proposedCoarseImpulseZKgMPerS:f32-bits.proposedFineAngularImpulseXKgM2PerS:f32-bits.proposedFineAngularImpulseYKgM2PerS:f32-bits.proposedFineAngularImpulseZKgM2PerS:f32-bits.proposedCoarseAngularImpulseXKgM2PerS:f32-bits.proposedCoarseAngularImpulseYKgM2PerS:f32-bits.proposedCoarseAngularImpulseZKgM2PerS:f32-bits.proposedMomentumToleranceKgMPerS:f32-bits.proposedAngularToleranceKgM2PerS:f32-bits`.split(`.`));Object.freeze({schema:`peercompute.ulg.schroeder-spatial-parent-field-mechanics-workspace.v4`,version:4,headerLayout:on,row:Object.freeze([`mass:f32-or-fixed-i32-bits`,`momentumOrVelocityX:f32-or-fixed-i32-bits`,`momentumOrVelocityY:f32-or-fixed-i32-bits`,`momentumOrVelocityZ:f32-or-fixed-i32-bits`,`massGradientX:f32-or-fixed-i32-bits`,`massGradientY:f32-or-fixed-i32-bits`,`massGradientZ:f32-or-fixed-i32-bits`,`contributionCountOrActive:u32`]),topologyAuthority:`immutable-schroeder-spatial-parent-field-view-v1`,stateAuthority:`mutable-per-generation-operation-workspace`,transaction:`validate-and-seal-stored-fine-impulses-before-ordered-ledger-commit-then-physical-apply`,transfer:`weighted-fine-restriction-plus-exact-native-coarse-injection-and-transpose-velocity-delta-prolongation`,internalEnergyTransfer:`nonnegative-grid-kinetic-loss-deposited-through-transpose-g2p`,refluxEvidence:`keyed-equal-opposite-linear-angular-momentum-pressure-drag-and-total-energy-ledger`,parentToCoarseOrdinalEncoding:`zero-absent-u32-max-minus-ordinal-v1`,thirdLevel:`forbidden`});const sn=Object.freeze(`magic:u32.abiVersion:u32.statusFlags:u32.coarseRegistryCapacity:u32.coarseRegistryCount:u32.rowWords:u32.headerWords:u32.completionOrdinal:u32.committedFineSubstepCount:u32.coarseApplyCount:u32.correctionClampCount:u32.cflRejectCount:u32.invalidCount:u32.keyMismatchCount:u32.routeRejectCount:u32.consumedFineSubstepCount:u32.fineImpulseXKgMPerS:f32-bits.fineImpulseYKgMPerS:f32-bits.fineImpulseZKgMPerS:f32-bits.coarseImpulseXKgMPerS:f32-bits.coarseImpulseYKgMPerS:f32-bits.coarseImpulseZKgMPerS:f32-bits.fineAngularImpulseXKgM2PerS:f32-bits.fineAngularImpulseYKgM2PerS:f32-bits.fineAngularImpulseZKgM2PerS:f32-bits.coarseAngularImpulseXKgM2PerS:f32-bits.coarseAngularImpulseYKgM2PerS:f32-bits.coarseAngularImpulseZKgM2PerS:f32-bits.fineKineticEnergyDeltaJ:f32-bits.coarseKineticEnergyDeltaJ:f32-bits.internalEnergyDepositJ:f32-bits.totalEnergyResidualJ:f32-bits.massResidualKg:f32-bits.firstMassMomentResidualXKgM:f32-bits.firstMassMomentResidualYKgM:f32-bits.firstMassMomentResidualZKgM:f32-bits.linearMomentumResidualXKgMPerS:f32-bits.linearMomentumResidualYKgMPerS:f32-bits.linearMomentumResidualZKgMPerS:f32-bits.angularMomentumResidualXKgM2PerS:f32-bits.angularMomentumResidualYKgM2PerS:f32-bits.angularMomentumResidualZKgM2PerS:f32-bits.maxFineCflRatio:f32-bits.maxCoarseCflRatio:f32-bits.minimumPublishedInternalEnergyJ:f32-bits.momentumToleranceKgMPerS:f32-bits.angularMomentumToleranceKgM2PerS:f32-bits.energyToleranceJ:f32-bits.positivityStatus:u32.cflStatus:u32.massComStatus:u32.momentumStatus:u32.angularMomentumStatus:u32.energyStatus:u32.substepCount:u32.ratioNumerator:u32.ratioDenominator:u32.boundaryRejectCount:u32.chartRejectCount:u32.phase:u32.registryGeneration:u32.finalCoarseMutationInputOrdinal:u32.finalCoarseMutationOutputOrdinal:u32.finalCoarseStateEncoding:u32.finalGenerationId:u32.finalDeviceOrdinal:u32.finalLaneOrdinal:u32.finalLeaseToken:u32.finalSourceFamilyId:u32.finalStorageGeneration:u32.finalPhysicsTick:u32.finalPhysicsSubstep:u32.finalPositionEpoch:u32.finalTopologyEpoch:u32.finalChartEpoch:u32.finalLevelEpoch:u32.finalSupportEpoch:u32.fineLevel:i32-bits.coarseLevel:i32-bits.coarseGridSpacingM:f32-bits.terminalReceiptState:u32.terminalReceiptToken:u32.macroOwnerId:u32.macroOwnerGeneration:u32.particleConsumedHeatJ:f32-bits.massSumAbsKg:f32-bits.firstMassMomentSumAbsKgM:f32-bits.linearMomentumSumAbsKgMPerS:f32-bits.angularMomentumSumAbsKgM2PerS:f32-bits.totalEnergySumAbsJ:f32-bits.partitionOfUnityResidual:f32-bits.partitionOfUnitySumAbs:f32-bits.firstMomentResidualM:f32-bits.firstMomentSumAbsM:f32-bits.measurementContributionCount:u32.publicationToken:u32.terminalG2pConsumeCount:u32.capturedOperationCount:u32.expectedOperationCount:u32.finalP2gAuthorityStatus:u32.finalG2pAuthorityStatus:u32.particleHeatStatus:u32.exactCountStatus:u32.publicationStatus:u32.fineP2gAuthorityRejectCount:u32.fineG2pAuthorityRejectCount:u32.finalP2gAuthorityRejectCount:u32.finalG2pAuthorityRejectCount:u32.receiptReplayRejectCount:u32.receiptSkipRejectCount:u32.receiptDuplicateRejectCount:u32.transactionMutationToken:u32.cumulativeFineRouteHeatJ:f32-bits.coarseDeferredRouteHeatJ:f32-bits.fineParticleConsumedRouteHeatJ:f32-bits.coarseParticleConsumedRouteHeatJ:f32-bits.cumulativeLocalHeatJ:f32-bits.particleConsumedLocalHeatJ:f32-bits.localHeatStatus:u32.routeHeatStatus:u32.fineReceiptConsumeCount:u32.coarseReceiptConsumeCount:u32.mutationRollbackCount:u32.arenaGeneration:u32.statusCaptureSentinel:u32.statusCaptureMissingCount:u32.operatorSplitSynchronizationWorkJ:f32-bits.operatorSplitSynchronizationWorkConditioningSumAbsJ:f32-bits.fineCrossLevelPressureCompensationJ:f32-bits.coarseCrossLevelPressureCompensationJ:f32-bits.fineCrossLevelDragHeatJ:f32-bits.coarseCrossLevelDragHeatJ:f32-bits.cumulativeAmbientImpulseXNs:f32-bits.cumulativeAmbientImpulseYNs:f32-bits.cumulativeAmbientImpulseZNs:f32-bits.cumulativeAmbientExternalWorkJ:f32-bits`.split(`.`)),cn=Object.freeze([`coarseDenseNodeIndex:u32`,`mechanicalFamilyId:u32`,`materialId:u32`,`continuityDomainId:u32`,`frozenMassKg:f32-bits`,`refluxMomentumXKgMPerS:f32-bits`,`refluxMomentumYKgMPerS:f32-bits`,`refluxMomentumZKgMPerS:f32-bits`,`internalEnergyDepositJ:f32-bits`,`coarseKineticEnergyDeltaJ:f32-bits`,`appliedMomentumXKgMPerS:f32-bits`,`appliedMomentumYKgMPerS:f32-bits`,`appliedMomentumZKgMPerS:f32-bits`,`contributionCount:u32`,`registryFlags:u32`,`cumulativeCausalLossWeightJ:f32-bits`,`cumulativeCoarsePressureCompensationJ:f32-bits`,`cumulativeCoarseDragHeatJ:f32-bits`]);Object.freeze({schema:`peercompute.ulg.schroeder-cross-level-reflux-ledger.v3`,magic:1397902387,version:3,headerWords:136,rowWords:18,headerLayout:sn,rowLayout:cn,ownership:`private-device-lineage-plus-gpu-macro-owner-id-and-generation`,transaction:`expected-committed-consumed-substep-counts-and-terminal-consumed-publication-token`,registry:`macro-frozen-ordered-full-coarse-key-and-mass-dictionary`,accumulation:`coarse-field-ordinal-aligned-phase-separated`,route:`coherent-causal-cohort-affine-transpose`,operatorSplit:`causal-virtual-reflux-heat-plus-explicit-coarse-temporal-synchronization-work`,phaseVolumeTransport:`signed-cross-level-pressure-compensation-plus-nonnegative-drag-heat`,ambientBoundary:`sealed-external-ambient-impulse-and-kinetic-work-never-deposited-as-particle-heat`,readbackPolicy:`normal-path-gpu-canonicalization;fixed-header-explicit-audit-only`}),Object.freeze({READY:1,ADMITTED:2,FAIL_CLOSED:4,INVALID_DIRECTORY:8,INVALID_MOMENT:16,INVALID_PARENT:32,INVALID_GEOMETRY:64,OVERFILLED:128,NONFINITE_VOLUME:256,COUNT_MISMATCH:512}),Object.freeze({MAGIC:0,VERSION:1,STATUS_FLAGS:2,ERROR_FLAGS:3,GAS_FREE_VOLUME_GENERATION:4,SOURCE_GENERATION:5,DIRECTORY_GENERATION:6,STORAGE_GENERATION:7,CELL_CAPACITY:8,ROW_WORDS:9,EXACT_LEVEL_COUNT:10,SELECTED_LEVEL:11,FINE_MOMENT_GENERATION:12,COARSE_MOMENT_GENERATION:13,PARENT_COMPLETION_ORDINAL:14,COMPLETED_CELL_COUNT:15,INVALID_DIRECTORY_COUNT:16,INVALID_MOMENT_COUNT:17,INVALID_PARENT_COUNT:18,INVALID_GEOMETRY_COUNT:19,OVERFILLED_CELL_COUNT:20,NONFINITE_VOLUME_COUNT:21,DIRECTORY_CELL_COUNT:22,READBACK_PERFORMED:23,DISPATCH_X:24,DISPATCH_Y:25,DISPATCH_Z:26,REDUCTION_VERSION:27,FINE_SCATTER_DISPATCH_X:28,FINE_SCATTER_DISPATCH_Y:29,COARSE_SCATTER_DISPATCH_X:30,COARSE_SCATTER_DISPATCH_Y:31,KEYED_LOOKUP_MAX_STEPS:32});const ln=Object.freeze([`geometricVolumeM3:f32-bits`,`condensedVolumeM3:f32-bits`,`freeVolumeM3:f32-bits`,`statusFlags:u32`]);Object.freeze({sourceSchema:`peercompute.ulg.sph-spatial-gas-free-volume-source.v2`,executionSchema:`peercompute.ulg.sph-spatial-gas-free-volume-execution.v2`,magic:1397179953,version:2,controlWords:64,rowWords:4,rowLayout:ln,condensedFamilies:Object.freeze([1,2]),pressureDenominator:`box-clipped-geometric-volume-minus-solid-liquid-v0j`,twoLevelProjection:`fine-moment-parent-csr-plus-coarse-native-parent-map`,condensedReduction:`directory-keyed-binary-lookup-atomic-f32-scatter`,workComplexity:`O(C + (F + E + K) log C)`,failureCounterSemantics:`invalid-source-records-plus-invalid-output-cells`,readbackPolicy:`none`,failurePolicy:`whole-sidecar-fail-closed`});const un=`far-aggregate`,dn=`post-mechanics-far-aggregate`,fn=`spatial-aggregate-far-field-traversal`;Object.freeze({PACKED_QUERY_V0:0,LEVEL_ASSIGNMENT_V0:1});const pn=Object.freeze(`massKg:f32.firstMassMomentXKgM:f32.firstMassMomentYKgM:f32.firstMassMomentZKgM:f32.linearMomentumXKgMPerS:f32.linearMomentumYKgMPerS:f32.linearMomentumZKgMPerS:f32.orbitalAngularMomentumXKgM2PerS:f32.orbitalAngularMomentumYKgM2PerS:f32.orbitalAngularMomentumZKgM2PerS:f32.internalEnergyJ:f32.kineticEnergyJ:f32.aabbMinXM:f32.aabbMinYM:f32.aabbMinZM:f32.aabbMaxXM:f32.aabbMaxYM:f32.aabbMaxZM:f32.boundingRadiusM:f32.particleCount:u32.materialBloomMask0:u32.materialBloomMask1:u32.materialBloomMask2:u32.materialBloomMask3:u32.phaseMask:u32.homogeneousMaterialId:u32-or-ffffffff.homogeneousPhaseId:u32-or-ffffffff.recordStatus:u32.prefixKeyChart:u32.prefixKeyLevelOrder:u32.prefixKeyMortonHigh:u32.prefixKeyMortonMiddle:u32.prefixKeyMortonLow:u32.sourceBeginOrLeftChildRecordIndex:u32.sourceEndOrRightChildRecordIndex:u32.sourceCellOrNodeIndex:u32.parentRecordIndex:u32-or-ffffffff.escapeRecordIndex:u32-or-ffffffff.subtreeMortonRankBegin:u32.subtreeMortonRankEnd:u32.prefixBitCount:u32.topologyFingerprint:u32.homogeneousContinuityDomainId:u32-or-ffffffff.sourceMemberCount:u32`.split(`.`)),mn=Object.freeze([`magic:u32`,`abiVersion:u32`,`statusFlags:u32`,`generationId:u32`,`deviceOrdinal:u32`,`laneOrdinal:u32`,`leaseToken:u32`,`sourceFamilyId:u32`,`storageGeneration:u32`,`physicsTick:u32`,`physicsSubstep:u32`,`positionEpoch:u32`,`topologyEpoch:u32`,`chartEpoch:u32`,`levelEpoch:u32`,`supportEpoch:u32`,`sourceCount:u32`,`sourceCapacity:u32`,`cellCount:u32`,`cellCapacity:u32`,`recordWords:u32`,`recordOffsetWords:u32`,`recordCapacity:u32`,`leafCount:u32`,`treeArity:u32`,`internalOffsetWords:u32`,`internalCapacity:u32`,`internalCount:u32`,`rootOffsetWords:u32`,`nodeCount:u32`,`logicalRequiredWords:u32`,`capacityWords:u32`,`invalidSourceCount:u32`,`nonfiniteSourceCount:u32`,`identityMismatchCount:u32`,`overflowCount:u32`,`attemptedSourceCount:u32`,`reducedSourceCount:u32`,`reducedLeafCount:u32`,`reducedInternalCount:u32`,`completionOrdinal:u32`,`directoryGenerationId:u32`,`directoryCompletionOrdinal:u32`,`sourceRowLayoutId:u32`,`stateStrideFloats:u32`,`thermoStrideFloats:u32`,`identityStrideWords:u32`,`materialMaskMode:u32`,`phaseMaskMode:u32`,`reductionMode:u32`,`clearedWords:u32`,`topologyMode:u32`,`prefixBitCapacity:u32`,`rootRecordIndex:u32`,`totalRecordCount:u32`,`internalRecordCount:u32`,`topologyFingerprint:u32`,`traversalStatus:u32`,`traversalLeafCoverage:u32`,`malformedTopologyCount:u32`,`dispatchWords:u32`,`liveHighWaterWords:u32`,`replayGuardToken:u32`,`headerFingerprint:u32`,...Array.from({length:8},(e,t)=>`topologyReserved${t}:u32`),...Array.from({length:8},(e,t)=>`topologyCounter${t}:u32`),`traversalFirstRecordIndex:u32`,`traversalEndSentinel:u32`,`exactNearPartitionMode:u32`,`openingMode:u32`,`topologyArity:u32`,`maxTraversalSteps:u32`,`sourceAdapterId:u32`,`directoryCellKeyOffsetWords:u32`,`directoryCellOffsetOffsetWords:u32`,`directoryCellMemberOffsetWords:u32`,`directoryParticleToCellOffsetWords:u32`,...Array.from({length:21},(e,t)=>`reserved${91+t}:u32`)]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-aggregate-view.v2`,version:2,headerWords:112,recordWords:44,keyWords:5,prefixBitCount:160,treeArity:2,topologyMode:2,headerLayout:mn,recordLayout:pn,sourceAuthority:`immutable-ss-spatial-epoch-v1-or-v2-cell-csr-with-exact-active-source-lineage`,construction:`canonical-cell-derived-morton-permutation-compressed-prefix-tree-with-authenticated-ropes`,complexity:`v1:O(sourceCount*keyWords+cellCount*prefixDepth);v2:O(activeCellCount*keyWords+activeSourceCount+activeCellCount*prefixDepth)-no-candidate-rows`,traversal:`stackless-parent-child-escape-rope-opening-with-exact-near-aabb-exclusion`,partition:`each-leaf-covered-exactly-once-by-near-or-one-accepted-far-ancestor`,materialMask:`128-bit-one-hash-bloom-no-false-negatives-plus-exact-homogeneous-id`,phaseMask:`exact-u32-phase-id-mask`,overflowPolicy:`fail-closed-zero-indirect-dispatch`,readbackPolicy:`explicit-probe-only`,submissionOwnership:`caller`,materializedCandidateRows:!1,perSourceCandidateBudget:null});const hn=Object.freeze([`magic:u32`,`abiVersion:u32`,`statusFlags:u32`,`memberOffsetWords:u32`,`memberCapacity:u32`,`activeMemberCount:u32`,`sourceCount:u32`,`cellCount:u32`,`generationId:u32`,`completionOrdinal:u32`,`replayGuardToken:u32`,`sourceAdapterId:u32`,`directoryCellMemberOffsetWords:u32`,`reducedCellCount:u32`,`invalidMemberCount:u32`,`constructionMode:u32`,`physicalCapacityWords:u32`,`sourceRowLayoutId:u32`,`storageGeneration:u32`,`projectionFingerprint:u32`,`reserved:u32`]);Object.freeze({schema:`peercompute.ulg.schroeder-spatial-active-member-projection.v1`,version:1,magic:1396788529,headerOffsetWords:91,headerWords:21,headerLayout:hn,construction:`canonical-cell-original-range-prefix-compaction-by-mechanically-active-source`,memberOrdering:`canonical-directory-order-within-each-cell`,cellRangeAuthority:`aggregate-leaf-particle-count-and-directory-member-begin`,overflowPolicy:`fail-closed-with-parent-aggregate-view`,readbackPolicy:`explicit-probe-only`}),32*Uint32Array.BYTES_PER_ELEMENT;const gn=Object.freeze({MAGIC:0,VERSION:1,STATUS:2,FLAGS:3,STEP_ORDINAL:4,FINE_SUBSTEP_ORDINAL:5,PARTICLE_COUNT:6,VISITED_COUNT:7,PRIOR_ACTIVE_COUNT:8,SUCCESSOR_ACTIVE_COUNT:9,COMPARED_ACTIVE_COUNT:10,ACTIVATED_COUNT:11,DEACTIVATED_COUNT:12,MOVED_COUNT:13,SPATIAL_KEY_CHANGED_COUNT:14,SPATIAL_KEY_UNCHANGED_COUNT:15,CELL_X_CHANGED_COUNT:16,CELL_Y_CHANGED_COUNT:17,CELL_Z_CHANGED_COUNT:18,INVALID_PRIOR_COUNT:19,INVALID_SUCCESSOR_COUNT:20,DORMANT_COUNT:21,MAX_ABS_CELL_DELTA_X:22,MAX_ABS_CELL_DELTA_Y:23,MAX_ABS_CELL_DELTA_Z:24,PRIOR_POSITION_EPOCH:25,SUCCESSOR_POSITION_EPOCH:26,TOPOLOGY_EPOCH:27,CHART_EPOCH:28,LEVEL_EPOCH:29,SUPPORT_EPOCH:30,CHECKSUM:31});24*Uint32Array.BYTES_PER_ELEMENT;function z(e){return`${e>>>0}u`}const B=gn,_n=`
struct FrozenSpatialKeyChurnParams {
  particle_count: u32,
  assignment_stride_words: u32,
  state_stride_words: u32,
  flags: u32,
  step_ordinal: u32,
  fine_substep_ordinal: u32,
  prior_position_epoch: u32,
  successor_position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  cell_min_x: i32,
  cell_min_y: i32,
  cell_min_z: i32,
  cell_count_x: u32,
  cell_count_y: u32,
  cell_count_z: u32,
  exact_cell_atlas_enabled: u32,
  padding_0: u32,
};

@group(0) @binding(0) var<storage, read> prior_assignments: array<u32>;
@group(0) @binding(1) var<storage, read> current_state: array<u32>;
@group(0) @binding(2) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: FrozenSpatialKeyChurnParams;

const ASSIGNMENT_STRIDE_WORDS: u32 = 16u;
const STATE_STRIDE_WORDS: u32 = 8u;
const FLAG_ADMITTED: u32 = ${z(1)};
const RECORD_WORDS: u32 = ${z(32)};
const MAGIC: u32 = ${z(1431062347)};
const VERSION: u32 = ${z(1)};
const STATUS_READY: u32 = ${z(1)};
const STATUS_ADMITTED: u32 = ${z(2)};
const STATUS_FAIL_CLOSED: u32 = ${z(4)};
const CHECKSUM_SALT: u32 = ${z(1801812273)};
const CHECKSUM_PRIME: u32 = ${z(16777619)};
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn safe_i32_f32(value: f32) -> bool {
  return finite_f32(value)
    && value >= MIN_SAFE_I32_F32
    && value <= MAX_SAFE_I32_F32;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn assignment_f32(row: u32, word: u32) -> f32 {
  return bitcast<f32>(prior_assignments[row + word]);
}

fn query_profile_ready() -> bool {
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  let atlas_ready = params.exact_cell_atlas_enabled == 1u
    && params.cell_count_x > 0u
    && params.cell_count_y > 0u
    && params.cell_count_z > 0u
    && params.cell_count_x - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_x)
    && params.cell_count_y - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_y)
    && params.cell_count_z - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_z);
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0
    && atlas_ready;
}

fn exact_cell_atlas_admitted(cell_f: vec3<f32>) -> bool {
  if (!(
    safe_i32_f32(cell_f.x)
    && safe_i32_f32(cell_f.y)
    && safe_i32_f32(cell_f.z)
  )) {
    return false;
  }
  let cell_order = vec3<u32>(
    signed_order_key(i32(cell_f.x)),
    signed_order_key(i32(cell_f.y)),
    signed_order_key(i32(cell_f.z))
  );
  let min_order = vec3<u32>(
    signed_order_key(params.cell_min_x),
    signed_order_key(params.cell_min_y),
    signed_order_key(params.cell_min_z)
  );
  let offset = cell_order - min_order;
  return cell_order.x >= min_order.x
    && offset.x < params.cell_count_x
    && cell_order.y >= min_order.y
    && offset.y < params.cell_count_y
    && cell_order.z >= min_order.z
    && offset.z < params.cell_count_z;
}

fn structural_valid(row: u32, position: vec3<f32>) -> bool {
  let level_f = assignment_f32(row, 0u);
  let native_spacing = assignment_f32(row, 1u);
  let rest_density = assignment_f32(row, 7u);
  let phase_f = assignment_f32(row, 8u);
  let material_f = assignment_f32(row, 9u);
  let status_f = assignment_f32(row, 10u);
  let hysteresis = assignment_f32(row, 11u);
  let chart_f = assignment_f32(row, 15u);
  if (!(
    integral_f32(level_f)
    && level_f >= MIN_SAFE_I32_F32
    && level_f <= MAX_SAFE_I32_F32
    && finite_f32(native_spacing)
    && native_spacing > 0.0
    && finite_f32(rest_density)
    && integral_f32(phase_f)
    && phase_f >= 0.0
    && phase_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(material_f)
    && material_f >= 0.0
    && material_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(status_f)
    && status_f >= 0.0
    && status_f <= 255.0
    && (u32(round(status_f)) & 31u) > 0u
    && (u32(round(status_f)) & 128u) == 0u
    && (u32(round(status_f)) & 64u) == 0u
    && finite_f32(hysteresis)
    && hysteresis >= 0.0
    && integral_f32(chart_f)
    && chart_f >= 0.0
    && chart_f <= MAX_EXACT_F32_INTEGER
    && u32(round(chart_f)) == params.query_chart_id
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ))
  )) {
    return false;
  }
  let level = i32(round(level_f));
  let level_order = signed_order_key(level);
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(level));
  if (
    !query_profile_ready()
    || level_order < min_order
    || level_order > max_order
    || bitcast<u32>(native_spacing) != bitcast<u32>(expected_spacing)
  ) {
    return false;
  }
  let cell_f = floor(position / native_spacing);
  return exact_cell_atlas_admitted(cell_f);
}

fn geometry_active(row: u32) -> bool {
  let support_radius = assignment_f32(row, 2u);
  let represented_volume = assignment_f32(row, 3u);
  let rest_volume = assignment_f32(row, 4u);
  let current_volume = assignment_f32(row, 5u);
  let mass = assignment_f32(row, 6u);
  let rest_density = assignment_f32(row, 7u);
  return finite_f32(support_radius)
    && finite_f32(represented_volume)
    && finite_f32(rest_volume)
    && finite_f32(current_volume)
    && finite_f32(mass)
    && mass > 0.0
    && support_radius >= 0.0
    && represented_volume >= 0.0
    && rest_volume > 0.0
    && current_volume > 0.0
    && rest_density > 0.0;
}

fn geometry_dormant(row: u32) -> bool {
  return prior_assignments[row + 2u] == 0u
    && prior_assignments[row + 3u] == 0u
    && prior_assignments[row + 4u] == 0u
    && prior_assignments[row + 5u] == 0u
    && prior_assignments[row + 6u] == 0u;
}

fn ordered_delta(a: i32, b: i32) -> u32 {
  let ordered_a = signed_order_key(a);
  let ordered_b = signed_order_key(b);
  return select(ordered_b - ordered_a, ordered_a - ordered_b, ordered_a >= ordered_b);
}

fn store_record_identity() {
  atomicStore(&receipt[${z(B.MAGIC)}], MAGIC);
  atomicStore(&receipt[${z(B.VERSION)}], VERSION);
  atomicStore(&receipt[${z(B.STATUS)}], 0u);
  atomicStore(&receipt[${z(B.FLAGS)}], params.flags);
  atomicStore(&receipt[${z(B.STEP_ORDINAL)}], params.step_ordinal);
  atomicStore(&receipt[${z(B.FINE_SUBSTEP_ORDINAL)}], params.fine_substep_ordinal);
  atomicStore(&receipt[${z(B.PARTICLE_COUNT)}], params.particle_count);
  atomicStore(&receipt[${z(B.PRIOR_POSITION_EPOCH)}], params.prior_position_epoch);
  atomicStore(&receipt[${z(B.SUCCESSOR_POSITION_EPOCH)}], params.successor_position_epoch);
  atomicStore(&receipt[${z(B.TOPOLOGY_EPOCH)}], params.topology_epoch);
  atomicStore(&receipt[${z(B.CHART_EPOCH)}], params.chart_epoch);
  atomicStore(&receipt[${z(B.LEVEL_EPOCH)}], params.level_epoch);
  atomicStore(&receipt[${z(B.SUPPORT_EPOCH)}], params.support_epoch);
}

@compute @workgroup_size(64)
fn classify(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index == 0u && arrayLength(&receipt) >= RECORD_WORDS) {
    store_record_identity();
  }
  if (
    particle_index >= params.particle_count
    || arrayLength(&receipt) < RECORD_WORDS
    || params.assignment_stride_words != ASSIGNMENT_STRIDE_WORDS
    || params.state_stride_words != STATE_STRIDE_WORDS
    || (params.flags & FLAG_ADMITTED) == 0u
  ) {
    return;
  }
  atomicAdd(&receipt[${z(B.VISITED_COUNT)}], 1u);
  let row = particle_index * ASSIGNMENT_STRIDE_WORDS;
  let state_row = particle_index * STATE_STRIDE_WORDS;
  let prior_position = vec3<f32>(
    assignment_f32(row, 12u),
    assignment_f32(row, 13u),
    assignment_f32(row, 14u)
  );
  let successor_position = vec3<f32>(
    bitcast<f32>(current_state[state_row + 0u]),
    bitcast<f32>(current_state[state_row + 1u]),
    bitcast<f32>(current_state[state_row + 2u])
  );
  let exact_source_index = particle_index <= 16777215u;
  let prior_structural = exact_source_index
    && structural_valid(row, prior_position);
  let successor_structural = exact_source_index
    && structural_valid(row, successor_position);
  let active_geometry = geometry_active(row);
  let dormant_geometry = geometry_dormant(row);
  let prior_active = prior_structural && active_geometry;
  let successor_active = successor_structural && active_geometry;
  if (prior_active) {
    atomicAdd(&receipt[${z(B.PRIOR_ACTIVE_COUNT)}], 1u);
  } else if (prior_structural && dormant_geometry) {
    atomicAdd(&receipt[${z(B.DORMANT_COUNT)}], 1u);
  } else {
    atomicAdd(&receipt[${z(B.INVALID_PRIOR_COUNT)}], 1u);
  }
  if (successor_active) {
    atomicAdd(&receipt[${z(B.SUCCESSOR_ACTIVE_COUNT)}], 1u);
  } else if (!(successor_structural && dormant_geometry)) {
    atomicAdd(&receipt[${z(B.INVALID_SUCCESSOR_COUNT)}], 1u);
  }
  if (prior_active && !successor_active) {
    atomicAdd(&receipt[${z(B.DEACTIVATED_COUNT)}], 1u);
    return;
  }
  if (!prior_active && successor_active) {
    atomicAdd(&receipt[${z(B.ACTIVATED_COUNT)}], 1u);
    return;
  }
  if (!prior_active || !successor_active) {
    return;
  }
  atomicAdd(&receipt[${z(B.COMPARED_ACTIVE_COUNT)}], 1u);
  if (
    prior_assignments[row + 12u] != current_state[state_row + 0u]
    || prior_assignments[row + 13u] != current_state[state_row + 1u]
    || prior_assignments[row + 14u] != current_state[state_row + 2u]
  ) {
    atomicAdd(&receipt[${z(B.MOVED_COUNT)}], 1u);
  }
  let spacing = assignment_f32(row, 1u);
  let prior_cell = vec3<i32>(floor(prior_position / spacing));
  let successor_cell = vec3<i32>(floor(successor_position / spacing));
  let changed = prior_cell != successor_cell;
  if (any(changed)) {
    atomicAdd(&receipt[${z(B.SPATIAL_KEY_CHANGED_COUNT)}], 1u);
    if (changed.x) {
      atomicAdd(&receipt[${z(B.CELL_X_CHANGED_COUNT)}], 1u);
    }
    if (changed.y) {
      atomicAdd(&receipt[${z(B.CELL_Y_CHANGED_COUNT)}], 1u);
    }
    if (changed.z) {
      atomicAdd(&receipt[${z(B.CELL_Z_CHANGED_COUNT)}], 1u);
    }
  } else {
    atomicAdd(&receipt[${z(B.SPATIAL_KEY_UNCHANGED_COUNT)}], 1u);
  }
  atomicMax(
    &receipt[${z(B.MAX_ABS_CELL_DELTA_X)}],
    ordered_delta(prior_cell.x, successor_cell.x)
  );
  atomicMax(
    &receipt[${z(B.MAX_ABS_CELL_DELTA_Y)}],
    ordered_delta(prior_cell.y, successor_cell.y)
  );
  atomicMax(
    &receipt[${z(B.MAX_ABS_CELL_DELTA_Z)}],
    ordered_delta(prior_cell.z, successor_cell.z)
  );
}

@compute @workgroup_size(1)
fn seal() {
  if (arrayLength(&receipt) < RECORD_WORDS) {
    return;
  }
  let visited = atomicLoad(&receipt[${z(B.VISITED_COUNT)}]);
  let prior_active = atomicLoad(&receipt[${z(B.PRIOR_ACTIVE_COUNT)}]);
  let successor_active = atomicLoad(&receipt[${z(B.SUCCESSOR_ACTIVE_COUNT)}]);
  let compared = atomicLoad(&receipt[${z(B.COMPARED_ACTIVE_COUNT)}]);
  let activated = atomicLoad(&receipt[${z(B.ACTIVATED_COUNT)}]);
  let deactivated = atomicLoad(&receipt[${z(B.DEACTIVATED_COUNT)}]);
  let changed = atomicLoad(&receipt[${z(B.SPATIAL_KEY_CHANGED_COUNT)}]);
  let unchanged = atomicLoad(&receipt[${z(B.SPATIAL_KEY_UNCHANGED_COUNT)}]);
  let moved = atomicLoad(&receipt[${z(B.MOVED_COUNT)}]);
  let invalid_prior = atomicLoad(&receipt[${z(B.INVALID_PRIOR_COUNT)}]);
  let invalid_successor = atomicLoad(&receipt[${z(B.INVALID_SUCCESSOR_COUNT)}]);
  let dormant = atomicLoad(&receipt[${z(B.DORMANT_COUNT)}]);
  let cell_x_changed = atomicLoad(&receipt[${z(B.CELL_X_CHANGED_COUNT)}]);
  let cell_y_changed = atomicLoad(&receipt[${z(B.CELL_Y_CHANGED_COUNT)}]);
  let cell_z_changed = atomicLoad(&receipt[${z(B.CELL_Z_CHANGED_COUNT)}]);
  let max_delta_x = atomicLoad(&receipt[${z(B.MAX_ABS_CELL_DELTA_X)}]);
  let max_delta_y = atomicLoad(&receipt[${z(B.MAX_ABS_CELL_DELTA_Y)}]);
  let max_delta_z = atomicLoad(&receipt[${z(B.MAX_ABS_CELL_DELTA_Z)}]);
  let admitted = params.particle_count > 0u
    && params.assignment_stride_words == ASSIGNMENT_STRIDE_WORDS
    && params.state_stride_words == STATE_STRIDE_WORDS
    && (params.flags & FLAG_ADMITTED) != 0u
    && params.flags == FLAG_ADMITTED
    && params.step_ordinal > 0u
    && params.fine_substep_ordinal > 0u
    && params.prior_position_epoch < params.successor_position_epoch
    && query_profile_ready()
    && visited == params.particle_count
    && compared + deactivated == prior_active
    && compared + activated == successor_active
    && changed + unchanged == compared
    && prior_active + dormant + invalid_prior == params.particle_count
    && successor_active + invalid_successor <= params.particle_count
    && moved <= compared
    && changed <= moved
    && cell_x_changed <= changed
    && cell_y_changed <= changed
    && cell_z_changed <= changed
    && changed <= cell_x_changed + cell_y_changed + cell_z_changed
    && (cell_x_changed == 0u) == (max_delta_x == 0u)
    && (cell_y_changed == 0u) == (max_delta_y == 0u)
    && (cell_z_changed == 0u) == (max_delta_z == 0u);
  let status = STATUS_READY | select(STATUS_FAIL_CLOSED, STATUS_ADMITTED, admitted);
  atomicStore(&receipt[${z(B.STATUS)}], status);
  var checksum = CHECKSUM_SALT;
  for (var index = 0u; index < ${z(B.CHECKSUM)}; index = index + 1u) {
    checksum = (checksum ^ atomicLoad(&receipt[index])) * CHECKSUM_PRIME;
  }
  atomicStore(&receipt[${z(B.CHECKSUM)}], checksum);
}
`,vn=48*Uint32Array.BYTES_PER_ELEMENT,yn=Object.freeze({magic:0,abiVersion:1,statusFlags:2,generationId:3,fineNodeCount:4,parentNodeCount:5,couplingFlags:6,workgroupSize:7,fineMassKg:8,fineFirstMomentXKgM:9,fineFirstMomentYKgM:10,fineFirstMomentZKgM:11,fineMomentumXKgMPerS:12,fineMomentumYKgMPerS:13,fineMomentumZKgMPerS:14,fineAngularMomentumXKgM2PerS:15,fineAngularMomentumYKgM2PerS:16,fineAngularMomentumZKgM2PerS:17,fineActiveNodeCount:18,fineInvalidNodeCount:19,parentMassKg:20,parentFirstMomentXKgM:21,parentFirstMomentYKgM:22,parentFirstMomentZKgM:23,parentMomentumXKgMPerS:24,parentMomentumYKgMPerS:25,parentMomentumZKgMPerS:26,parentAngularMomentumXKgM2PerS:27,parentAngularMomentumYKgM2PerS:28,parentAngularMomentumZKgM2PerS:29,parentActiveNodeCount:30,parentInvalidNodeCount:31,massResidualKg:32,firstMomentResidualXKgM:33,firstMomentResidualYKgM:34,firstMomentResidualZKgM:35,momentumResidualXKgMPerS:36,momentumResidualYKgMPerS:37,momentumResidualZKgMPerS:38,angularMomentumResidualXKgM2PerS:39,angularMomentumResidualYKgM2PerS:40,angularMomentumResidualZKgM2PerS:41,massToleranceKg:42,firstMomentToleranceKgM:43,momentumToleranceKgMPerS:44,angularMomentumToleranceKgM2PerS:45,completionOrdinal:46,reserved:47});Object.freeze({schema:`peercompute.ulg.schroeder-cross-level-invariant-evidence.v1`,version:1,magic:1396918577,words:48,byteLength:vn,layout:yn,quantities:Object.freeze([`mass`,`first-mass-moment`,`linear-momentum`,`grid-orbital-angular-momentum`]),source:`compact-two-level-hierarchy-node-lists`,overflowPolicy:`fail-closed`,readbackPolicy:`explicit-fixed-evidence-probe-only`}),24*Uint32Array.BYTES_PER_ELEMENT;const bn=Object.freeze({PENDING:0,COMPLETE:1,INVALID_MASS:2,INCOMPLETE_DISPATCH:3,EPOCH_EXHAUSTED:4,CONTRACT_REJECTED:5});Object.freeze([`magic:u32`,`version:u32`,`generationId:u32`,`submissionNonce:u32`,`sourceTopologyEpoch:u32`,`sourceParticleCount:u32`,`successorParticleCount:u32`,`comparisonParticleCount:u32`,`comparePassCount:u32`,`visitedCount:u32`,`sourceActiveCount:u32`,`successorActiveCount:u32`,`activatedCount:u32`,`deactivatedCount:u32`,`activeMaskXorCount:u32`,`invalidSourceMassCount:u32`,`invalidSuccessorMassCount:u32`,`forceTopologyAdvance:u32`,`sealPassCount:u32`,`topologyChanged:u32`,`nextTopologyEpoch:u32`,`status:u32`,`reserved:u32`,`finalSeal:u32`]),`${bn.COMPLETE}${bn.INCOMPLETE_DISPATCH}${bn.INVALID_MASS}${bn.EPOCH_EXHAUSTED}${bn.COMPLETE}`;const xn=`peercompute.ulg.closure-law-graph.v0`,Sn=`peercompute.ulg.sph-gpu-thermal-material-table.v1`,Cn=`peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0`,wn=`peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0`,Tn=`peercompute.ulg.sph-gpu-thermal-phase-response-table.v1`,En=`peercompute.ulg.sph-gpu-reaction-table.v1`,Dn=`peercompute.ulg.reaction-closure.v0`;Object.freeze({invalidOrEmpty:0,pending:1,directOnly:2,spareSlot:3,radiusCaptureMerge:4,fallbackMerge:5,subthresholdUnplaced:6,noCarrierUnplaced:7,rejected:8});const On=Object.freeze([`axis:f32`,`value:f32`,`derivative:f32`,`pad0:f32`]),kn=Object.freeze([`opId:f32`,`inputSlot:f32`,`outputSlot:f32`,`derivativeSlot:f32`,`sampleOffset:f32`,`sampleCount:f32`,`domainMin:f32`,`domainMax:f32`,`edgeOffset:f32`,`edgeCount:f32`,`interpolationId:f32`,`statusFlagId:f32`,`provenanceIndex:f32`,`materialId:f32`,`phaseId:f32`,`pad0:f32`]),An=Object.freeze([`sourceSlot:f32`,`destinationNode:f32`,`unitId:f32`,`sensitivityTag:f32`]),jn=Object.freeze([`value:f32`,`derivative:f32`,`status:f32`,`pad0:f32`]),Mn=Object.freeze([`nodeId:f32`,`status:f32`,`observedInput:f32`,`limit:f32`]),Nn=Object.freeze({tableLinear:1,tableStep:2}),Pn=Object.freeze({linear:1}),Fn=Object.freeze({ok:1,outOfDomainLow:2,outOfDomainHigh:3,unsupportedOperation:4}),In=Object.freeze([`materialId:f32`,`phaseId:f32`,`spectralOffset:f32`,`spectralCount:f32`,`baseColorLinearR:f32`,`baseColorLinearG:f32`,`baseColorLinearB:f32`,`metalness:f32`,`roughness:f32`,`transmission:f32`,`opacity:f32`,`ior:f32`,`attenuationLinearR:f32`,`attenuationLinearG:f32`,`attenuationLinearB:f32`,`attenuationDistanceM:f32`,`absorptionCoefficientPerM:f32`,`scatteringCoefficientPerM:f32`,`renderModelId:f32`,`vertexColorPolicyId:f32`,`opticalDepth:f32`,`blocked:f32`,`status:f32`,`opticalStateId:f32`]),Ln=Object.freeze([`wavelengthNm:f32`,`reflectance:f32`,`transmittance:f32`,`absorptionCoefficientPerM:f32`,`scatteringCoefficientPerM:f32`,`n:f32`,`k:f32`,`pad0:f32`]),Rn=Object.freeze([`materialId:f32`,`phaseId:f32`,`opticalStateId:f32`,`pad1:f32`]),zn=Object.freeze([`baseColorLinearR:f32`,`baseColorLinearG:f32`,`baseColorLinearB:f32`,`opacity:f32`,`metalness:f32`,`roughness:f32`,`transmission:f32`,`ior:f32`,`renderModelId:f32`,`vertexColorPolicyId:f32`,`status:f32`,`recordIndex:f32`,`opticalDepth:f32`,`scatteringCoefficientPerM:f32`,`absorptionCoefficientPerM:f32`,`opticalStateId:f32`]),Bn=Object.freeze([`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`massKg:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`,`specificInternalEnergyJPerKg:f32`]),Vn=Object.freeze([`materialId:f32`,`phaseId:f32`,`temperatureK:f32`,`restDensityKgPerM3:f32`,`phaseFractionSolid:f32`,`phaseFractionLiquid:f32`,`phaseFractionGas:f32`,`phaseFractionPlasma:f32`,`smoothingLengthM:f32`,`representedEntityCount:f32`,`status:f32`,`visualParticleRadiusM:f32`]),Hn=Object.freeze([`renderDomainId:u32`]),Un=Object.freeze([`materialId:f32`,`segmentOffset:f32`,`segmentCount:f32`,`status:f32`,`emissivityGray:f32`,`pressureCarrierLawId:f32`,`referencePressurePa:f32`,`clausiusInvTemperatureLogSlopePerK:f32`]),Wn=Object.freeze([`materialId:f32`,`segmentType:f32`,`phaseFromId:f32`,`phaseToId:f32`,`energyStartJPerKg:f32`,`energyEndJPerKg:f32`,`temperatureStartK:f32`,`temperatureEndK:f32`,`densityFromKgPerM3:f32`,`densityToKgPerM3:f32`,`status:f32`,`thermalConductivityWPerMK:f32`]),Gn=Object.freeze([`materialId:f32`,`responseOffset:f32`,`responseCount:f32`,`status:f32`,`emissivityGray:f32`,`pressureCarrierLawId:f32`,`referencePressurePa:f32`,`clausiusInvTemperatureLogSlopePerK:f32`]),Kn=Object.freeze([`materialId:f32`,`segmentType:f32`,`temperatureGraphIndex:f32`,`status:f32`,`energyStartJPerKg:f32`,`energyEndJPerKg:f32`,`phaseFromId:f32`,`phaseToId:f32`,`densityFromKgPerM3:f32`,`densityToKgPerM3:f32`,`densityPolicyId:f32`,`stablePhasePolicyId:f32`,`fractionFromSlope:f32`,`fractionFromIntercept:f32`,`fractionToSlope:f32`,`fractionToIntercept:f32`]),qn=Object.freeze([`reactantAMaterialId:f32`,`reactantBMaterialId:f32`,`productMaterialId:f32`,`activationTemperatureK:f32`,`specificEnthalpyJPerKg:f32`,`contactRadiusM:f32`,`phaseMaskA:f32`,`phaseMaskB:f32`,`status:f32`,`pad0:f32`,`pad1:f32`,`pad2:f32`]),Jn=Object.freeze([`reactionIndex:f32`,`reactantTermOffset:f32`,`reactantTermCount:f32`,`productTermOffset:f32`,`productTermCount:f32`,`gasProductTermOffset:f32`,`gasProductTermCount:f32`,`specificEnthalpyJPerKg:f32`,`activationTemperatureK:f32`,`contactRadiusM:f32`,`status:f32`,`primaryProductMaterialId:f32`,`phaseMaskA:f32`,`phaseMaskB:f32`,`atomBalanceStatus:f32`,`chargeBalanceStatus:f32`]),Yn=Object.freeze([`reactionIndex:f32`,`materialId:f32`,`coefficient:f32`,`molarMassKgPerMol:f32`,`phaseMask:f32`,`roleId:f32`,`charge:f32`,`stoichiometricMoles:f32`,`materialKeyHash:f32`,`formulaHash:f32`,`status:f32`,`interfaceFluxKgPerM2S:f32`]),Xn=Object.freeze([`reactionIndex:f32`,`materialId:f32`,`coefficient:f32`,`molarMassKgPerMol:f32`,`massFraction:f32`,`routingId:f32`,`targetPhasePolicyId:f32`,`status:f32`,`formulaHash:f32`,`materialKeyHash:f32`,`phaseMask:f32`,`productPhaseRecordOffset:f32`,`productPhaseRecordCount:f32`,`gasSpeciesId:f32`,`charge:f32`,`pad0:f32`]),Zn=Object.freeze([`reactionIndex:f32`,`productTermIndex:f32`,`materialId:f32`,`molesPerExtent:f32`,`molarMassKgPerMol:f32`,`pressureRoutingId:f32`,`status:f32`,`pad0:f32`]),Qn=Object.freeze([`reactionIndex:f32`,`termKindId:f32`,`termIndex:f32`,`atomicNumberZ:f32`,`atomsPerFormula:f32`,`coefficient:f32`,`charge:f32`,`status:f32`]),$n=Object.freeze([`materialId:f32`,`phaseId:f32`,`restDensityKgPerM3:f32`,`effectiveBulkModulusPa:f32`,`shearModulusPa:f32`,`lameLambdaPa:f32`,`soundSpeedMPerS:f32`,`eosModelId:f32`,`solidFlag:f32`,`status:f32`,`dynamicViscosityPaS:f32`,`surfaceTensionNPerM:f32`]);Object.freeze([`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`massKg:f32`,`materialId:f32`,`phaseId:f32`,`temperatureK:f32`,`status:f32`,`restDensityKgPerM3:f32`,`phaseFractionGas:f32`,`representedEntityCount:f32`,`renderDomainId:f32`,`currentVolumeM3:f32`,`particleRadiusM:f32`,`volumeRatioJ:f32`,`pressurePa:f32`,`phaseFractionSolid:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`]),Object.freeze([`materialId:f32`,`phaseId:f32`,`fieldOffset:f32`,`fieldCellCount:f32`,`resolution:f32`,`isolation:f32`,`subtract:f32`,`strength:f32`,`radiusNormOrNegativeParticleRadiusScale:f32`,`colorLinearR:f32`,`colorLinearG:f32`,`colorLinearB:f32`,`renderDomainId:f32`,`opticalStateId:f32`,`pad1:f32`,`pad2:f32`]),Object.freeze([`density:f32`,`paletteLinearR:f32`,`paletteLinearG:f32`,`paletteLinearB:f32`,`temperatureK:f32`,`reserved0:f32`,`reserved1:f32`,`reserved2:f32`]);const er=Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`axisId:f32`,`centroidXM:f32`,`centroidYM:f32`,`centroidZM:f32`,`areaM2:f32`,`normalX:f32`,`normalY:f32`,`normalZ:f32`,`normalAreaXM2:f32`,`normalAreaYM2:f32`,`normalAreaZM2:f32`,`crossingSign:f32`,`status:f32`]);Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`axisId:f32`,`centroidXM:f32`,`centroidYM:f32`,`centroidZM:f32`,`areaM2:f32`,`normalX:f32`,`normalY:f32`,`normalZ:f32`,`normalAreaXM2:f32`,`normalAreaYM2:f32`,`normalAreaZM2:f32`,`crossingSign:f32`,`status:f32`]);const tr=Object.freeze([`elementIndex:f32`,`sourceParticleIndex:f32`,`status:f32`,`flags:f32`]),nr=Object.freeze([`gapM:f32`,`normalVelocityMPerS:f32`,`representativeMassKg:f32`,`status:f32`,`sourceDomainId:f32`,`targetDomainId:f32`,`domainPairReady:f32`,`selectedPolicyRowToken:f32`]);Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`opticalStateId:f32`,`activeCellCount:f32`,`crossingCellCount:f32`,`maxDensity:f32`,`isolation:f32`,`minActiveXM:f32`,`minActiveYM:f32`,`minActiveZM:f32`,`status:f32`,`maxActiveXM:f32`,`maxActiveYM:f32`,`maxActiveZM:f32`,`cellSizeM:f32`,`boundsCenterXM:f32`,`boundsCenterYM:f32`,`boundsCenterZM:f32`,`boundsRadiusM:f32`]),Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`voxelLinearIndex:f32`,`centerXM:f32`,`centerYM:f32`,`centerZM:f32`,`cellSizeM:f32`,`cornerMask:f32`,`edgeCrossingCount:f32`,`reservedTriangleCount:f32`,`reservedVertexCount:f32`,`densityMin:f32`,`densityMax:f32`,`isolation:f32`,`status:f32`]),Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`triangleIndex:f32`,`vertexIndex:f32`,`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`normalX:f32`,`normalY:f32`,`normalZ:f32`,`opticalStateId:f32`,`density:f32`,`isolation:f32`,`sourceVoxelLinearIndex:f32`,`status:f32`]),Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`opticalStateId:f32`,`vertexOffset:f32`,`vertexCount:f32`,`triangleOffset:f32`,`triangleCount:f32`,`renderOrder:f32`,`transparencyClassId:f32`,`depthWriteFlag:f32`,`status:f32`,`boundsCenterXM:f32`,`boundsCenterYM:f32`,`boundsCenterZM:f32`,`boundsRadiusM:f32`]),Object.freeze([`vertexCount:u32`,`instanceCount:u32`,`firstVertex:u32`,`firstInstance:u32`]);const rr=Object.freeze([`surfaceIndex:f32`,`materialId:f32`,`phaseId:f32`,`axisId:f32`,`centroidXM:f32`,`centroidYM:f32`,`centroidZM:f32`,`areaM2:f32`,`materialForceXN:f32`,`materialForceYN:f32`,`materialForceZN:f32`,`gasReactionForceXN:f32`,`gasReactionForceYN:f32`,`gasReactionForceZN:f32`,`pressurePa:f32`,`status:f32`]),ir=Object.freeze(`deformationF00:f32.deformationF01:f32.deformationF02:f32.deformationF10:f32.deformationF11:f32.deformationF12:f32.deformationF20:f32.deformationF21:f32.deformationF22:f32.affineC00:f32.affineC01:f32.affineC02:f32.affineC10:f32.affineC11:f32.affineC12:f32.affineC20:f32.affineC21:f32.affineC22:f32.volumeRatioJ:f32.restVolumeM3:f32.solidFlag:f32.status:f32.effectiveBulkModulusPa:f32.shearModulusPa:f32.lameLambdaPa:f32.soundSpeedMPerS:f32.eosModelId:f32.constitutiveStatus:f32.resolvedAbsolutePressurePa:f32.dynamicViscosityPaS:f32.surfaceTensionNPerM:f32.phaseVolumeReferenceMassKg:f32`.split(`.`));Object.freeze([`massKg:f32`,`momentumXKgMPerS:f32`,`momentumYKgMPerS:f32`,`momentumZKgMPerS:f32`,`nodeXM:f32`,`nodeYM:f32`,`nodeZM:f32`,`status:f32`]),Object.freeze([`massKg:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`,`nodeXM:f32`,`nodeYM:f32`,`nodeZM:f32`,`status:f32`]),Object.freeze(`particleCount:f32.gridNodeCount:f32.activeGridNodeCount:f32.sourceMassKg:f32.nextMassKg:f32.massDeltaKg:f32.sourceMomentumXKgMPerS:f32.sourceMomentumYKgMPerS:f32.sourceMomentumZKgMPerS:f32.nextMomentumXKgMPerS:f32.nextMomentumYKgMPerS:f32.nextMomentumZKgMPerS:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.maxSpeedMPerS:f32.maxDisplacementM:f32.minVolumeRatioJ:f32.maxVolumeRatioJ:f32.status:f32.phaseMassSolidKg:f32.phaseMassLiquidKg:f32.phaseMassGasKg:f32.phaseMassPlasmaKg:f32.temperatureMassWeightedMeanK:f32.minTemperatureK:f32.maxTemperatureK:f32.thermalReadyCount:f32.thermalProblemCount:f32.finiteTemperatureCount:f32.phaseMassTotalKg:f32.thermalStatus:f32.sourceCenterOfMassXM:f32.sourceCenterOfMassYM:f32.sourceCenterOfMassZM:f32.nextCenterOfMassXM:f32.nextCenterOfMassYM:f32.nextCenterOfMassZM:f32.sourceMinXM:f32.sourceMinYM:f32.sourceMinZM:f32.sourceMaxXM:f32.sourceMaxYM:f32.sourceMaxZM:f32.nextMinXM:f32.nextMinYM:f32.nextMinZM:f32.nextMaxXM:f32.nextMaxYM:f32.nextMaxZM:f32.sourcePositionBoundsStatus:f32.nextPositionBoundsStatus:f32.sourcePositionMassKg:f32.nextPositionMassKg:f32.positionBoundsPad0:f32.positionBoundsPad1:f32.cohortSummaryStatus:f32.baseCohortStartIndex:f32.baseCohortEndIndex:f32.dropCohortStartIndex:f32.dropCohortEndIndex:f32.baseCohortNextMassKg:f32.baseCohortNextCenterXM:f32.baseCohortNextCenterYM:f32.baseCohortNextCenterZM:f32.baseCohortNextMinXM:f32.baseCohortNextMinYM:f32.baseCohortNextMinZM:f32.baseCohortNextMaxXM:f32.baseCohortNextMaxYM:f32.baseCohortNextMaxZM:f32.baseCohortMaxSpeedMPerS:f32.dropCohortNextMassKg:f32.dropCohortNextCenterXM:f32.dropCohortNextCenterYM:f32.dropCohortNextCenterZM:f32.dropCohortNextMinXM:f32.dropCohortNextMinYM:f32.dropCohortNextMinZM:f32.dropCohortNextMaxXM:f32.dropCohortNextMaxYM:f32.dropCohortNextMaxZM:f32.dropCohortMaxSpeedMPerS:f32.cohortSummaryPad0:f32.h2oGasMassKg:f32.h2oGasTemperatureMassWeightedMeanK:f32.h2oGasPhaseWeight:f32.h2oGasSummaryStatus:f32`.split(`.`));const ar=Object.freeze([`levelId:f32`,`nativeGridSpacingM:f32`,`supportRadiusM:f32`,`representedVolumeM3:f32`,`restVolumeM3:f32`,`currentVolumeM3:f32`,`massKg:f32`,`restDensityKgPerM3:f32`,`phaseId:f32`,`materialId:f32`,`status:f32`,`hysteresisBand:f32`,`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`chartId:f32`]);Object.freeze([`levelId:f32`,`tileMinX:f32`,`tileMinY:f32`,`tileMinZ:f32`,`tileMaxX:f32`,`tileMaxY:f32`,`tileMaxZ:f32`,`tileSpacingM:f32`,`nativeGridSpacingM:f32`,`supportRadiusM:f32`,`sourceParticleIndex:f32`,`status:f32`,`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`chartId:f32`]),Object.freeze([`bucketOffset:u32`,`bucketCount:u32`,`pad0:u32`,`pad1:u32`]);const or=Object.freeze(`sourceParticleIndex:f32.levelId:f32.chartId:f32.status:f32.tileMinX:f32.tileMinY:f32.tileMinZ:f32.tileMaxX:f32.tileMaxY:f32.tileMaxZ:f32.tileSpacingM:f32.supportRadiusM:f32.lawMask:f32.reactionQueueEligible:f32.contactQueueEligible:f32.interfaceQueueEligible:f32.materialPhaseMask:f32.exactNearFieldRequired:f32.aggregateAdmissible:f32.sedenionScopeRequired:f32.candidateBudget:f32.estimatedCandidateCount:f32.queueModeId:f32.capacityStatus:f32.stateFamilyId:f32.admissionRequired:f32.sourceActiveNodeStatus:f32.sourceActiveNodeIndex:f32.queueEpoch:f32.pad0:f32.pad1:f32.pad2:f32`.split(`.`)),sr=Object.freeze([`sourceParticleIndex:f32`,`neighborParticleIndex:f32`,`lawMask:f32`,`status:f32`,`sourceLevelId:f32`,`neighborLevelId:f32`,`sourceChartId:f32`,`neighborChartId:f32`,`distanceM:f32`,`supportRadiusM:f32`,`candidateWeight:f32`,`queueRowIndex:f32`,`sourceMaterialPhaseMask:f32`,`neighborMaterialPhaseMask:f32`,`admissibilityFlags:f32`,`queueEpoch:f32`]),cr=Object.freeze([`sourceParticleIndex:f32`,`candidateOffset:f32`,`candidateCount:f32`,`status:f32`]);Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.aggregateNodeIndex:f32.aggregateLevelId:f32.sourceChartId:f32.aggregateChartId:f32.lawMask:f32.status:f32.distanceM:f32.aggregateNodeSizeM:f32.openingTheta:f32.openingRatio:f32.aggregateMassKg:f32.aggregateRepresentedVolumeM3:f32.aggregateMomentumXKgMPerS:f32.aggregateMomentumYKgMPerS:f32.aggregateMomentumZKgMPerS:f32.aggregateInternalEnergyJ:f32.aggregateCenterXM:f32.aggregateCenterYM:f32.aggregateCenterZM:f32.sourceXM:f32.sourceYM:f32.sourceZM:f32.nearFieldRadiusM:f32.farFieldErrorBound:f32.aggregateAdmissibilityFlags:f32.queueEpoch:f32.stateFamilyId:f32.candidateSlotIndex:f32.acceptedCandidateCount:f32.overflowFlag:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.sourceChartId:f32.lawMask:f32.candidateOffset:f32.candidateBudget:f32.acceptedCandidateCount:f32.activeCandidateCount:f32.accelerationXMPerS2:f32.accelerationYMPerS2:f32.accelerationZMPerS2:f32.potentialJPerKg:f32.totalAggregateMassKg:f32.minDistanceM:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.overflowCount:f32.blockedCandidateCount:f32.status:f32.queueEpoch:f32.stateFamilyId:f32.gravitationalConstant:f32.softeningLengthM:f32.forceModeId:f32.sourceXM:f32.sourceYM:f32.sourceZM:f32.aggregateAdmissibilityFlags:f32.stateMutationRequired:f32.fullParticleReadbackRequired:f32.pad0:f32.pad1:f32`.split(`.`)),Object.freeze(`forceSummaryRowCount:f32.activeSourceCount:f32.emptySourceCount:f32.overflowSourceCount:f32.blockedSourceCount:f32.totalAcceptedCandidateCount:f32.totalActiveCandidateCount:f32.totalOverflowCandidateCount:f32.totalBlockedCandidateCount:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.maxAccelerationMagnitudeMPerS2:f32.maxPotentialMagnitudeJPerKg:f32.totalAggregateMassKg:f32.minDistanceM:f32.maxCandidateBudget:f32.enabledFarLawMask:f32.queueEpoch:f32.stateFamilyId:f32.maxAccelerationSourceParticleIndex:f32.accelerationPressureSourceCount:f32.errorBoundPressureSourceCount:f32.openingRatioPressureSourceCount:f32.overflowPressureRatio:f32.activeCandidatePressureRatio:f32.errorBoundPressureRatio:f32.openingRatioPressureRatio:f32.summaryModeId:f32.status:f32.fullParticleReadbackRequired:f32.stateMutationRequired:f32.pad0:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.sourceChartId:f32.sourceLawMask:f32.enabledConsumerLawMask:f32.emittedConsumerLawMask:f32.status:f32.forceSummaryStatus:f32.activeCandidateCount:f32.acceptedCandidateCount:f32.totalAggregateMassKg:f32.minDistanceM:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.accelerationMagnitudeMPerS2:f32.potentialMagnitudeJPerKg:f32.radiationExposureProxy:f32.plasmaCollectiveAccelerationProxy:f32.gasDensityProxyKgPerM3:f32.gasPressureProxyPa:f32.errorPressureFlag:f32.openingPressureFlag:f32.overflowPressureFlag:f32.diagnosticStatus:f32.admissionApproved:f32.stateMutationRequired:f32.fullParticleReadbackRequired:f32.queueEpoch:f32.stateFamilyId:f32.consumerModeId:f32.consumerRowIndex:f32.pad0:f32`.split(`.`)),Object.freeze(`lawConsumerRowCount:f32.activeConsumerCount:f32.blockedConsumerCount:f32.pressureConsumerCount:f32.radiationConsumerCount:f32.plasmaConsumerCount:f32.gasSummaryConsumerCount:f32.totalRadiationExposureProxy:f32.maxRadiationExposureProxy:f32.maxPlasmaCollectiveAccelerationProxy:f32.totalGasDensityProxyKgPerM3:f32.maxGasPressureProxyPa:f32.totalAggregateMassKg:f32.maxAccelerationMagnitudeMPerS2:f32.maxPotentialMagnitudeJPerKg:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.errorPressureCount:f32.openingPressureCount:f32.overflowPressureCount:f32.enabledConsumerLawMask:f32.emittedConsumerLawMask:f32.queueEpoch:f32.stateFamilyId:f32.maxRadiationSourceParticleIndex:f32.maxGasPressureSourceParticleIndex:f32.summaryModeId:f32.status:f32.fullParticleReadbackRequired:f32.stateMutationRequired:f32.pad0:f32.pad1:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.sourceChartId:f32.emittedConsumerLawMask:f32.aggregateMassKg:f32.gasDensityProxyKgPerM3:f32.gasPressureProxyPa:f32.referencePressurePa:f32.densityDeltaKgPerM3:f32.pressureDeltaPa:f32.representedGasVolumeM3:f32.pressureWorkProxyJ:f32.activeCandidateCount:f32.acceptedCandidateCount:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.sourceLawConsumerStatus:f32.sourceDiagnosticStatus:f32.admissionApproved:f32.stateMutationRequired:f32.fullParticleReadbackRequired:f32.queueEpoch:f32.stateFamilyId:f32.targetFamilyId:f32.consumerRowIndex:f32.stateDeltaRowIndex:f32.gasStateDeltaModeId:f32.status:f32.pressureInterfaceImportRequired:f32.conservationModeId:f32.pad0:f32.pad1:f32`.split(`.`)),Object.freeze([`gridIndexX:f32`,`gridIndexY:f32`,`gridIndexZ:f32`,`status:f32`,`centerXM:f32`,`centerYM:f32`,`centerZM:f32`,`pressurePa:f32`,`pressureGradientXPaPerM:f32`,`pressureGradientYPaPerM:f32`,`pressureGradientZPaPerM:f32`,`volumeM3:f32`]),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.sourceChartId:f32.lawMask:f32.sourceMassKg:f32.accelerationXMPerS2:f32.accelerationYMPerS2:f32.accelerationZMPerS2:f32.deltaVelocityXMPerS:f32.deltaVelocityYMPerS:f32.deltaVelocityZMPerS:f32.dtS:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.impulseMagnitudeKgMPerS:f32.kineticEnergyDeltaJ:f32.potentialJPerKg:f32.activeCandidateCount:f32.acceptedCandidateCount:f32.maxOpeningRatio:f32.maxFarFieldErrorBound:f32.diagnosticStatus:f32.forceSummaryStatus:f32.admissionApproved:f32.stateMutationRequired:f32.fullParticleReadbackRequired:f32.queueEpoch:f32.stateFamilyId:f32.status:f32.applicationModeId:f32.pad0:f32`.split(`.`)),Object.freeze([`sourceParticleIndex:f32`,`childLevelId:f32`,`parentLevelId:f32`,`levelDelta:f32`,`childNativeGridSpacingM:f32`,`parentNativeGridSpacingM:f32`,`supportRadiusM:f32`,`couplingRadiusM:f32`,`parentCellX:f32`,`parentCellY:f32`,`parentCellZ:f32`,`parentTileSpacingM:f32`,`massKg:f32`,`representedVolumeM3:f32`,`status:f32`,`chartId:f32`]),Object.freeze([`candidateCount:f32`,`activeCandidateCount:f32`,`blockedCandidateCount:f32`,`sameLevelCandidateCount:f32`,`sourceMassKg:f32`,`restrictedMassKg:f32`,`massResidualKg:f32`,`sourceVolumeM3:f32`,`restrictedVolumeM3:f32`,`volumeResidualM3:f32`,`maxAbsMassResidualKg:f32`,`maxAbsVolumeResidualM3:f32`,`badWeightCount:f32`,`missingParentChildCount:f32`,`status:f32`,`pad0:f32`]),Object.freeze([`sourceParticleIndex:f32`,`childLevelId:f32`,`parentLevelId:f32`,`levelDelta:f32`,`parentCellX:f32`,`parentCellY:f32`,`parentCellZ:f32`,`chartId:f32`,`sourceMassKg:f32`,`transferMassKg:f32`,`massResidualKg:f32`,`sourceVolumeM3:f32`,`transferVolumeM3:f32`,`volumeResidualM3:f32`,`momentumXKgMPerS:f32`,`momentumYKgMPerS:f32`,`momentumZKgMPerS:f32`,`internalEnergyJ:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`,`specificInternalEnergyJPerKg:f32`,`transferWeight:f32`,`status:f32`]),Object.freeze(`sourceParticleIndex:f32.childLevelId:f32.parentLevelId:f32.levelDelta:f32.parentCellX:f32.parentCellY:f32.parentCellZ:f32.chartId:f32.sourceMassDeltaKg:f32.targetMassDeltaKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetVolumeDeltaM3:f32.volumeResidualM3:f32.sourceMomentumDeltaXKgMPerS:f32.sourceMomentumDeltaYKgMPerS:f32.sourceMomentumDeltaZKgMPerS:f32.targetMomentumDeltaXKgMPerS:f32.targetMomentumDeltaYKgMPerS:f32.targetMomentumDeltaZKgMPerS:f32.momentumResidualXKgMPerS:f32.momentumResidualYKgMPerS:f32.momentumResidualZKgMPerS:f32.sourceInternalEnergyDeltaJ:f32.targetInternalEnergyDeltaJ:f32.internalEnergyResidualJ:f32.transferWeight:f32.targetAggregateKey:f32.status:f32.stateFamilyId:f32.admissionRequired:f32.pad0:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.childLevelId:f32.parentLevelId:f32.levelDelta:f32.parentCellX:f32.parentCellY:f32.parentCellZ:f32.chartId:f32.sourceMassDeltaKg:f32.targetMassDeltaKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetVolumeDeltaM3:f32.volumeResidualM3:f32.sourceMomentumDeltaXKgMPerS:f32.sourceMomentumDeltaYKgMPerS:f32.sourceMomentumDeltaZKgMPerS:f32.targetMomentumDeltaXKgMPerS:f32.targetMomentumDeltaYKgMPerS:f32.targetMomentumDeltaZKgMPerS:f32.momentumResidualXKgMPerS:f32.momentumResidualYKgMPerS:f32.momentumResidualZKgMPerS:f32.sourceInternalEnergyDeltaJ:f32.targetInternalEnergyDeltaJ:f32.internalEnergyResidualJ:f32.transferWeight:f32.targetAggregateKey:f32.status:f32.stateFamilyId:f32.admissionApproved:f32.mergeEpoch:f32`.split(`.`)),Object.freeze([`fineMassKg:f32`,`fineMomentumXKgMPerS:f32`,`fineMomentumYKgMPerS:f32`,`fineMomentumZKgMPerS:f32`,`coarseMassKg:f32`,`coarseMomentumXKgMPerS:f32`,`coarseMomentumYKgMPerS:f32`,`coarseMomentumZKgMPerS:f32`,`massResidualKg:f32`,`momentumResidualXKgMPerS:f32`,`momentumResidualYKgMPerS:f32`,`momentumResidualZKgMPerS:f32`,`fineActiveNodeCount:f32`,`coarseActiveNodeCount:f32`,`status:f32`,`couplingEpoch:f32`]),Object.freeze([`materializationRowCount:f32`,`admittedRowCount:f32`,`writtenTargetSlotCount:f32`,`appendedTargetSlotCount:f32`,`freedSourceSlotCount:f32`,`admittedParticleCountDelta:f32`,`sourceMassKg:f32`,`targetMassKg:f32`,`maxMassResidualKg:f32`,`blockedRowCount:f32`,`sourceParticleCount:f32`,`authoritativeParticleCount:f32`,`reserved0:f32`,`reserved1:f32`,`status:f32`,`flags:f32`]),Object.freeze([`scannedSlotCount:f32`,`liveParticleCount:f32`,`freedHoleCount:f32`,`liveMassKg:f32`,`sourceParticleCount:f32`,`admittedParticleCountDelta:f32`,`reserved0:f32`,`reserved1:f32`,`reserved2:f32`,`reserved3:f32`,`reserved4:f32`,`authoritativeParticleCount:f32`,`reserved5:f32`,`reserved6:f32`,`status:f32`,`flags:f32`]),Object.freeze(`targetAggregateKey:f32.levelId:f32.chartId:f32.status:f32.parentCellX:f32.parentCellY:f32.parentCellZ:f32.stateFamilyId:f32.massKg:f32.representedVolumeM3:f32.momentumXKgMPerS:f32.momentumYKgMPerS:f32.momentumZKgMPerS:f32.internalEnergyJ:f32.sourceParticleIndex:f32.transferWeight:f32.sourceMassDeltaKg:f32.targetMassDeltaKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetVolumeDeltaM3:f32.volumeResidualM3:f32.momentumResidualXKgMPerS:f32.momentumResidualYKgMPerS:f32.momentumResidualZKgMPerS:f32.internalEnergyResidualJ:f32.mergeEpoch:f32.childLevelId:f32.levelDelta:f32.aggregateModeId:f32.admissionApproved:f32.pad0:f32`.split(`.`)),Object.freeze(`targetAggregateKey:f32.levelId:f32.chartId:f32.status:f32.parentCellX:f32.parentCellY:f32.parentCellZ:f32.stateFamilyId:f32.massKg:f32.representedVolumeM3:f32.momentumXKgMPerS:f32.momentumYKgMPerS:f32.momentumZKgMPerS:f32.internalEnergyJ:f32.firstContributionIndex:f32.matchingContributionCount:f32.suppressedDuplicateCount:f32.massResidualKg:f32.volumeResidualM3:f32.momentumResidualXKgMPerS:f32.momentumResidualYKgMPerS:f32.momentumResidualZKgMPerS:f32.internalEnergyResidualJ:f32.mergeEpoch:f32.childLevelMin:f32.childLevelMax:f32.levelDeltaMax:f32.aggregateModeId:f32.reductionModeId:f32.capacityStatus:f32.admissionApproved:f32.pad0:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.sourceSupportRadiusM:f32.targetSupportRadiusM:f32.restVolumeM3:f32.representedVolumeM3:f32.phaseVolumeRatio:f32.levelDelta:f32.phaseId:f32.materialId:f32.aggregateNodeIndex:f32.aggregateMatchingContributionCount:f32.aggregateSuppressedDuplicateCount:f32.aggregateMassKg:f32.aggregateRepresentedVolumeM3:f32.aggregateMassResidualKg:f32.aggregateVolumeResidualM3:f32.sourceGridSpacingM:f32.targetGridSpacingM:f32.aggregateVolumeRatio:f32.coarsenEligible:f32.refineRequired:f32.phaseVolumeModeId:f32.aggregateCoherenceStatus:f32.conservationResidualStatus:f32.migrationEpoch:f32.chartId:f32.migrationModeId:f32.stateAdmissionRequired:f32.refinePressureReasonMask:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.sourceSupportRadiusM:f32.targetSupportRadiusM:f32.restVolumeM3:f32.representedVolumeM3:f32.phaseVolumeRatio:f32.levelDelta:f32.phaseId:f32.materialId:f32.aggregateNodeIndex:f32.coarsenEligible:f32.refineRequired:f32.aggregateCoherenceStatus:f32.conservationResidualStatus:f32.admissionApproved:f32.migrationEpoch:f32.stateFamilyId:f32.sourceGridSpacingM:f32.targetGridSpacingM:f32.aggregateMassKg:f32.aggregateRepresentedVolumeM3:f32.aggregateMassResidualKg:f32.aggregateVolumeResidualM3:f32.updateModeId:f32.phaseVolumeModeId:f32.chartId:f32.capacityStatus:f32.stateAdmissionRequired:f32.refinePressureReasonMask:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.proposalModeId:f32.coarsenEligible:f32.refineRequired:f32.refinePressureReasonMask:f32.restVolumeM3:f32.representedVolumeM3:f32.phaseVolumeRatio:f32.levelDelta:f32.aggregateNodeIndex:f32.aggregateMatchingContributionCount:f32.aggregateMassKg:f32.aggregateRepresentedVolumeM3:f32.aggregateMassResidualKg:f32.aggregateVolumeResidualM3:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.internalEnergyDeltaJ:f32.sourceSupportRadiusM:f32.targetSupportRadiusM:f32.sourceGridSpacingM:f32.targetGridSpacingM:f32.chartId:f32.proposalEpoch:f32.stateFamilyId:f32.stateAdmissionRequired:f32.mutationDeferred:f32.capacityStatus:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.applyModeId:f32.proposalModeId:f32.admissionApproved:f32.particleCountDelta:f32.sourceMassDeltaKg:f32.targetMassKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetRepresentedVolumeM3:f32.volumeResidualM3:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.internalEnergyDeltaJ:f32.restVolumeM3:f32.representedVolumeM3:f32.phaseVolumeRatio:f32.aggregateNodeIndex:f32.aggregateMatchingContributionCount:f32.aggregateMassKg:f32.aggregateRepresentedVolumeM3:f32.aggregateMassResidualKg:f32.aggregateVolumeResidualM3:f32.sourceSupportRadiusM:f32.targetSupportRadiusM:f32.chartId:f32.applyEpoch:f32.stateFamilyId:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.allocationModeId:f32.applyModeId:f32.admissionApproved:f32.particleCountDelta:f32.sourceSlotActionId:f32.targetSlotStartIndex:f32.targetSlotCount:f32.freeSlotStartIndex:f32.freeSlotCount:f32.requiredParticleCapacity:f32.currentParticleCapacity:f32.capacityResidual:f32.sourceMassDeltaKg:f32.targetMassKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetRepresentedVolumeM3:f32.volumeResidualM3:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.internalEnergyDeltaJ:f32.aggregateNodeIndex:f32.aggregateMatchingContributionCount:f32.chartId:f32.allocatorEpoch:f32.targetStateFamilyMask:f32.stateFamilyId:f32`.split(`.`)),Object.freeze([`baseSlotIndex:f32`,`slotCapacity:f32`,`availableSlotCount:f32`,`maxSlotsPerRow:f32`,`committedEpoch:f32`,`targetStateFamilyMask:f32`,`status:f32`,`pad0:f32`]),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.assignmentModeId:f32.allocationModeId:f32.admissionApproved:f32.particleCountDelta:f32.sourceSlotActionId:f32.assignedTargetSlotStartIndex:f32.assignedTargetSlotCount:f32.assignedFreeSlotStartIndex:f32.assignedFreeSlotCount:f32.freeListBaseSlotIndex:f32.freeListCapacity:f32.freeListAvailableCount:f32.allocationCapacityResidual:f32.targetSlotCapacityResidual:f32.sourceMassDeltaKg:f32.targetMassKg:f32.massResidualKg:f32.sourceVolumeDeltaM3:f32.targetRepresentedVolumeM3:f32.volumeResidualM3:f32.momentumDeltaXKgMPerS:f32.momentumDeltaYKgMPerS:f32.momentumDeltaZKgMPerS:f32.internalEnergyDeltaJ:f32.chartId:f32.assignmentEpoch:f32.targetStateFamilyMask:f32.stateFamilyId:f32`.split(`.`)),Object.freeze(`sourceParticleIndex:f32.sourceLevelId:f32.targetLevelId:f32.status:f32.materializationModeId:f32.assignmentModeId:f32.admissionApproved:f32.particleCountDelta:f32.assignedTargetSlotStartIndex:f32.assignedTargetSlotCount:f32.assignedFreeSlotStartIndex:f32.assignedFreeSlotCount:f32.writtenTargetSlotStartIndex:f32.writtenTargetSlotCount:f32.freedSourceSlotStartIndex:f32.freedSourceSlotCount:f32.sourceMassBeforeKg:f32.targetMassKg:f32.massResidualKg:f32.sourceRepresentedVolumeM3:f32.targetRepresentedVolumeM3:f32.volumeResidualM3:f32.targetVolumeRatioJ:f32.capacityResidual:f32.targetSlotCapacityResidual:f32.targetStateFamilyMask:f32.chartId:f32.materializationEpoch:f32.stateFamilyId:f32.sourceStatusBefore:f32.targetStatusAfter:f32.freeStatusAfter:f32`.split(`.`)),Object.freeze(`migrationRowCount:f32.activeUpdateCount:f32.coarsenEligibleCount:f32.refineRequiredCount:f32.aggregateCoherentCount:f32.conservationResidualIssueCount:f32.minSourceLevelId:f32.maxSourceLevelId:f32.minTargetLevelId:f32.maxTargetLevelId:f32.maxPositiveLevelDelta:f32.maxNegativeLevelDelta:f32.totalRestVolumeM3:f32.totalRepresentedVolumeM3:f32.totalAggregateMassKg:f32.totalAggregateRepresentedVolumeM3:f32.totalAbsAggregateMassResidualKg:f32.totalAbsAggregateVolumeResidualM3:f32.steamExpansionCandidateCount:f32.admittedUpdateCount:f32.stateAdmissionRequiredCount:f32.visibleMigrationCount:f32.aggregateMissingCount:f32.levelChangedCount:f32.summaryModeId:f32.migrationEpoch:f32.status:f32.phaseVolumeExpandThreshold:f32.stateFamilyId:f32.capacityStatus:f32.refinePressureCount:f32.refinePressureReasonMask:f32`.split(`.`));const lr=Object.freeze(`particleCount:f32.reactionCount:f32.productTermCount:f32.gasProductCount:f32.changedMaterialCount:f32.changedMassCount:f32.visibleProductMassKg:f32.visibleGasProductMassKg:f32.outputGasPhaseMassKg:f32.sourceMassKg:f32.nextMassKg:f32.massDeltaKg:f32.thermalReadyCount:f32.thermalProblemCount:f32.finiteTemperatureCount:f32.summaryAvailable:f32.canonicalReactionEventCount:f32.consumedReactantMassKg:f32.expectedProductMassKg:f32.rawProductMassKg:f32.ledgerVisibleProductMassKg:f32.ledgerUnplacedProductMassKg:f32.ledgerGasProductMassKg:f32.ledgerVisibleGasProductMassKg:f32.ledgerUnplacedGasProductMassKg:f32.sealedBoxGasProductMoles:f32.reactionHeatJ:f32.ledgerMassResidualKg:f32.ledgerReadyEventCount:f32.ledgerProblemEventCount:f32.proposalMutualPairCount:f32.compactLedgerAvailable:f32`.split(`.`)),ur=Object.freeze([`materialId:f32`,`massKg:f32`,`moles:f32`,`visibleMassKg:f32`,`unplacedMassKg:f32`,`eventCount:f32`,`gasProductIndex:f32`,`status:f32`]),dr=Object.freeze([`materialId:f32`,`massKg:f32`,`visibleMassKg:f32`,`unplacedMassKg:f32`,`moles:f32`,`eventCount:f32`,`productTermIndex:f32`,`reactionIndex:f32`,`routingId:f32`,`chargeMol:f32`,`massResidualKg:f32`,`status:f32`,`coefficient:f32`,`molarMassKgPerMol:f32`,`rawMassKg:f32`,`massScale:f32`]),fr=Object.freeze(`positionXM:f32.positionYM:f32.positionZM:f32.massKg:f32.materialId:f32.productTermIndex:f32.reactionIndex:f32.sourceParticleIndex:f32.partnerParticleIndex:f32.moles:f32.routingId:f32.phaseId:f32.placedMassKg:f32.unplacedMassKg:f32.coefficient:f32.molarMassKgPerMol:f32.temperatureK:f32.restDensityKgPerM3:f32.status:f32.specificInternalEnergyJPerKg:f32.velocityXMPerS:f32.velocityYMPerS:f32.velocityZMPerS:f32.supportVolumeM3:f32.effectiveBulkModulusPa:f32.shearModulusPa:f32.lameLambdaPa:f32.soundSpeedMPerS:f32.eosModelId:f32.solidFlag:f32.mechanicsStatus:f32.dispositionId:f32`.split(`.`)),pr=Object.freeze(`materialId:f32.productTermIndex:f32.reactionIndex:f32.routingId:f32.phaseId:f32.status:f32.readyProductEventCount:f32.placementCandidateEventCount:f32.directPlacedEventCount:f32.sparePlacedEventCount:f32.captureMergedEventCount:f32.fallbackMergedEventCount:f32.unplacedEventCount:f32.subthresholdEventCount:f32.rejectedEventCount:f32.phaseRoutedEventCount:f32.readyProductMassKg:f32.directPlacedMassKg:f32.sparePlacedMassKg:f32.captureMergedMassKg:f32.fallbackMergedMassKg:f32.unplacedMassKg:f32.subthresholdMassKg:f32.rejectedMassKg:f32.maxSparePlacedEventMassKg:f32.maxMergedEventMassKg:f32.maxPostMergeParticleMassKg:f32.maxUnplacedEventMassKg:f32.maxCaptureDistanceM:f32.maxFallbackDistanceM:f32.maxSparePlacedSupportRadiusM:f32.maxReadyProductEventMassKg:f32`.split(`.`)),mr=Object.freeze([`reactionIndex:f32`,`atomicNumberZ:f32`,`atomResidualMol:f32`,`chargeResidualMol:f32`,`eventCount:f32`,`termKindId:f32`,`termIndex:f32`,`status:f32`]),hr=Object.freeze({f32:{name:`f32`,byteSize:4,lanes:1},u32:{name:`u32`,byteSize:4,lanes:1},i32:{name:`i32`,byteSize:4,lanes:1},complex64:{name:`complex64`,byteSize:8,lanes:2,scalar:`f32`}});function gr(e,t){if(e===!0)throw Error(`${t} must remain false for closure-table WGSL descriptors`);return!1}function V(e,t){let n=Number(e);if(!Number.isFinite(n))throw TypeError(`${t} must be finite`);return n}function _r(e,t,n){for(let r of t)if(e?.[r]!=null)return V(e[r],n);throw TypeError(`${n} is required`)}function vr(e,t,n){let r=e?.[t]??e?.derivative??e?.dEdr;return r==null?null:V(r,`samples[${n}].derivative`)}function yr(e,t,n,r,i){let a=vr(e[t],i,t);if(a!=null)return a;let o=Math.max(0,t-1),s=Math.min(e.length-1,t+1),c=_r(e[o],[n,`axis`,`r`,`x`],`samples[${o}].axis`),l=_r(e[s],[n,`axis`,`r`,`x`],`samples[${s}].axis`);if(l===c)return 0;let u=_r(e[o],[r,`value`,`energy`],`samples[${o}].value`);return(_r(e[s],[r,`value`,`energy`],`samples[${s}].value`)-u)/(l-c)}function br(e,{axisKey:t=`axis`,outputKey:n=`value`,derivativeKey:r=`derivative`}={}){if(!Array.isArray(e)||e.length===0)throw TypeError(`samples must be a non-empty array`);let i=new Float32Array(e.length*On.length);return e.forEach((a,o)=>{let s=o*On.length;i[s]=_r(a,[t,`axis`,`r`,`x`],`samples[${o}].axis`),i[s+1]=_r(a,[n,`value`,`energy`],`samples[${o}].value`),i[s+2]=yr(e,o,t,n,r),i[s+3]=0}),i}function xr(e){if(typeof e==`number`)return V(e,`node.opId`);let t=Nn[e||`tableLinear`];if(!t)throw RangeError(`Unsupported closure law graph op: ${e}`);return t}function Sr(e){if(typeof e==`number`)return V(e,`node.interpolationId`);let t=Pn[e||`linear`];if(!t)throw RangeError(`Unsupported closure law graph interpolation: ${e}`);return t}function H(e,t,n=0){let r=e==null?n:Number(e);if(!Number.isInteger(r)||r<0)throw TypeError(`${t} must be a non-negative integer`);return r}function Cr({graphId:e,nodeCount:t,edgeCount:n=0,sampleCount:r,slotCount:i,statusCount:a=t,strategy:o=`flat-webgpu-closure-law-graph`,scientificValidation:s=!1,fullPhysicsValidation:c=!1,materialValidation:l=!1,eosValidation:u=!1,sphValidation:d=!1,phaseChangeValidation:f=!1}={}){if(!e)throw Error(`graphId is required`);for(let[e,o]of Object.entries({nodeCount:t,edgeCount:n,sampleCount:r,slotCount:i,statusCount:a}))if(!Number.isInteger(o)||o<0)throw TypeError(`${e} must be a non-negative integer`);return{schema:xn,abiVersion:`0.5`,status:`declared-flat-closure-law-graph`,strategy:o,graphId:e,nodeCount:t,edgeCount:n,sampleCount:r,slotCount:i,statusCount:a,nodeLayout:[...kn],nodeStrideFloats:kn.length,nodeStrideBytes:kn.length*hr.f32.byteSize,edgeLayout:[...An],edgeStrideFloats:An.length,edgeStrideBytes:An.length*hr.f32.byteSize,sampleLayout:[...On],sampleStrideFloats:On.length,sampleStrideBytes:On.length*hr.f32.byteSize,slotLayout:[...jn],slotStrideFloats:jn.length,slotStrideBytes:jn.length*hr.f32.byteSize,statusLayout:[...Mn],statusStrideFloats:Mn.length,statusStrideBytes:Mn.length*hr.f32.byteSize,opIds:{...Nn},interpolationIds:{...Pn},statusIds:{...Fn},storageAddressSpace:`storage`,storageAccess:`read/read_write`,scientificValidation:gr(s,`scientificValidation`),fullPhysicsValidation:gr(c,`fullPhysicsValidation`),materialValidation:gr(l,`materialValidation`),eosValidation:gr(u,`eosValidation`),sphValidation:gr(d,`sphValidation`),phaseChangeValidation:gr(f,`phaseChangeValidation`)}}function wr(e){if(!Array.isArray(e)||e.length===0)throw TypeError(`nodes must be a non-empty array`);let t=new Float32Array(e.length*kn.length);return e.forEach((e,n)=>{let r=n*kn.length;t[r]=xr(e.opId??e.op),t[r+1]=H(e.inputSlot,`nodes[${n}].inputSlot`),t[r+2]=H(e.outputSlot,`nodes[${n}].outputSlot`),t[r+3]=H(e.derivativeSlot,`nodes[${n}].derivativeSlot`),t[r+4]=H(e.sampleOffset,`nodes[${n}].sampleOffset`),t[r+5]=H(e.sampleCount,`nodes[${n}].sampleCount`),t[r+6]=V(e.domainMin,`nodes[${n}].domainMin`),t[r+7]=V(e.domainMax,`nodes[${n}].domainMax`),t[r+8]=H(e.edgeOffset,`nodes[${n}].edgeOffset`,0),t[r+9]=H(e.edgeCount,`nodes[${n}].edgeCount`,0),t[r+10]=Sr(e.interpolationId??e.interpolation),t[r+11]=H(e.statusFlagId,`nodes[${n}].statusFlagId`,n),t[r+12]=H(e.provenanceIndex,`nodes[${n}].provenanceIndex`,0),t[r+13]=V(e.materialId??0,`nodes[${n}].materialId`),t[r+14]=V(e.phaseId??0,`nodes[${n}].phaseId`),t[r+15]=0}),t}function Tr(e=[]){let t=new Float32Array(Math.max(0,e.length)*An.length);return e.forEach((e,n)=>{let r=n*An.length;t[r]=H(e.sourceSlot,`edges[${n}].sourceSlot`),t[r+1]=H(e.destinationNode,`edges[${n}].destinationNode`),t[r+2]=H(e.unitId,`edges[${n}].unitId`,0),t[r+3]=H(e.sensitivityTag,`edges[${n}].sensitivityTag`,0)}),t}function Er(e,t={}){if(!Number.isInteger(e)||e<=0)throw TypeError(`slotCount must be a positive integer`);let n=new Float32Array(e*jn.length);for(let r=0;r<e;r+=1){let e=Array.isArray(t)?t[r]:t[String(r)],i=r*jn.length;typeof e==`number`?(n[i]=V(e,`slot[${r}].value`),n[i+2]=Fn.ok):e&&typeof e==`object`&&(n[i]=V(e.value??0,`slot[${r}].value`),n[i+1]=V(e.derivative??0,`slot[${r}].derivative`),n[i+2]=V(e.status??Fn.ok,`slot[${r}].status`))}return n}function Dr(e){if(!Number.isInteger(e)||e<0)throw TypeError(`statusCount must be a non-negative integer`);return new Float32Array(e*Mn.length)}function Or({graphId:e,nodes:t,edges:n=[],samples:r,slotCount:i,initialSlots:a={},statusCount:o=t?.length??0,...s}={}){let c=wr(t),l=Tr(n),u=br(r),d=Er(i,a),f=Dr(o);return{...Cr({graphId:e,nodeCount:t.length,edgeCount:n.length,sampleCount:r.length,slotCount:i,statusCount:o,...s}),nodeRows:c,edgeRows:l,sampleRows:u,slotRows:d,statusRows:f,nodeRowByteLength:c.byteLength,edgeRowByteLength:l.byteLength,sampleRowByteLength:u.byteLength,slotRowByteLength:d.byteLength,statusRowByteLength:f.byteLength,scientificValidation:!1,fullPhysicsValidation:!1}}function kr({status:e,toleranceProfile:t,metrics:n,provenance:r}){return{abiVersion:`0.5`,status:e,toleranceProfile:t,metrics:n,provenance:r}}function Ar({artifactId:e,sourceService:t=`ulg-runtime`,taskKind:n=`simulation.step`,closureRef:r,representation:i=`carrier-toy`,outputs:a,execution:o,validity:s,uncertainty:c={},validation:l={},provenance:u}){if(!e)throw Error(`artifactId is required for ULG simulation artifacts`);if(!r)throw Error(`closureRef is required for ULG simulation artifacts`);return{schema:`peercompute.ulg.simulation-artifact.v0`,artifactId:e,sourceService:t,taskKind:n,closureRef:r,representation:i,outputs:a,execution:o,validity:s,uncertainty:c,validation:{status:`pass`,validationMode:`cpu-reference-toy-carrier`,scientificValidation:!1,fullPhysics:!1,fullPhysicsValidation:!1,...l},provenance:u}}function jr(e){let t=Mr(e),n=2166136261;for(let e=0;e<t.length;e+=1)n^=t.charCodeAt(e),n=Math.imul(n,16777619);return`ulg:${(n>>>0).toString(16).padStart(8,`0`)}`}function Mr(e){return Array.isArray(e)?`[${e.map(e=>Mr(e)).join(`,`)}]`:e&&typeof e==`object`?`{${Object.keys(e).sort().map(t=>`${JSON.stringify(t)}:${Mr(e[t])}`).join(`,`)}}`:JSON.stringify(e)}const Nr=Object.freeze(`H.He.Li.Be.B.C.N.O.F.Ne.Na.Mg.Al.Si.P.S.Cl.Ar.K.Ca.Sc.Ti.V.Cr.Mn.Fe.Co.Ni.Cu.Zn.Ga.Ge.As.Se.Br.Kr.Rb.Sr.Y.Zr.Nb.Mo.Tc.Ru.Rh.Pd.Ag.Cd.In.Sn.Sb.Te.I.Xe.Cs.Ba.La.Ce.Pr.Nd.Pm.Sm.Eu.Gd.Tb.Dy.Ho.Er.Tm.Yb.Lu.Hf.Ta.W.Re.Os.Ir.Pt.Au.Hg.Tl.Pb.Bi.Po.At.Rn.Fr.Ra.Ac.Th.Pa.U.Np.Pu.Am.Cm.Bk.Cf.Es.Fm.Md.No.Lr.Rf.Db.Sg.Bh.Hs.Mt.Ds.Rg.Cn.Nh.Fl.Mc.Lv.Ts.Og`.split(`.`)),Pr=Object.freeze([1.008,4.0026,6.94,9.0122,10.81,12.011,14.007,15.999,18.998,20.18,22.99,24.305,26.982,28.085,30.974,32.06,35.45,39.948,39.098,40.078,44.956,47.867,50.942,51.996,54.938,55.845,58.933,58.693,63.546,65.38,69.723,72.63,74.922,78.971,79.904,83.798,85.468,87.62,88.906,91.224,92.906,95.95,98,101.07,102.91,106.42,107.87,112.41,114.82,118.71,121.76,127.6,126.9,131.29,132.91,137.33,138.91,140.12,140.91,144.24,145,150.36,151.96,157.25,158.93,162.5,164.93,167.26,168.93,173.05,174.97,178.49,180.95,183.84,186.21,190.23,192.22,195.08,196.97,200.59,204.38,207.2,208.98,209,210,222,223,226,227,232.04,231.04,238.03,237,244,243,247,247,251,252,257,258,259,266,267,268,269,270,269,278,281,282,285,286,289,290,293,294,294]);function Fr(e){return Pr[e-1]*16605390666e-37}const Ir=Object.freeze({0:2,1:6,2:10,3:14}),Lr=[`s`,`p`,`d`,`f`];function Rr(e){return Nr[e-1]??null}function zr(e){let t=Nr.indexOf(e);return t>=0?t+1:null}function Br(){let e=[];for(let t=1;t<=8;t+=1)for(let n=0;n<t&&n<=3;n+=1)e.push({n:t,l:n});return e.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n),e}const Vr=Br(),Hr={24:{"3,2":5,"4,0":1},29:{"3,2":10,"4,0":1},41:{"4,2":4,"5,0":1},42:{"4,2":5,"5,0":1},44:{"4,2":7,"5,0":1},45:{"4,2":8,"5,0":1},46:{"4,2":10,"5,0":0},47:{"4,2":10,"5,0":1},57:{"4,3":0,"5,2":1,"6,0":2},58:{"4,3":1,"5,2":1,"6,0":2},64:{"4,3":7,"5,2":1,"6,0":2},78:{"4,3":14,"5,2":9,"6,0":1},79:{"4,3":14,"5,2":10,"6,0":1},89:{"5,3":0,"6,2":1,"7,0":2},90:{"5,3":0,"6,2":2,"7,0":2},91:{"5,3":2,"6,2":1,"7,0":2},92:{"5,3":3,"6,2":1,"7,0":2},93:{"5,3":4,"6,2":1,"7,0":2},96:{"5,3":7,"6,2":1,"7,0":2}};function Ur(e,{applyAnomalies:t=!0}={}){if(!Number.isInteger(e)||e<1||e>118)throw RangeError(`Z out of range: ${e}`);let n=new Map,r=e;for(let{n:e,l:t}of Vr){if(r<=0)break;let i=Math.min(Ir[t],r);n.set(`${e},${t}`,i),r-=i}if(t&&Hr[e])for(let[t,r]of Object.entries(Hr[e]))r===0?n.delete(t):n.set(t,r);let i=[];for(let[e,t]of n){if(t<=0)continue;let[n,r]=e.split(`,`).map(Number);i.push({n,l:r,occupancy:t})}return i.sort((e,t)=>e.n-t.n||e.l-t.l),i}function Wr(e,t){let n=Ur(e,t),r=new Map(Vr.map((e,t)=>[`${e.n},${e.l}`,t]));return[...n].sort((e,t)=>(r.get(`${e.n},${e.l}`)??99)-(r.get(`${t.n},${t.l}`)??99)).map(e=>`${e.n}${Lr[e.l]}${e.occupancy}`).join(` `)}function Gr(e,t){return Ur(e,t).map(({n:e,l:t,occupancy:n})=>{let r=2*t+1,i=Math.min(n,r);return{n:e,l:t,occUp:i,occDown:n-i}})}function Kr(e,t){return Gr(e,t).reduce((e,t)=>e+(t.occUp-t.occDown),0)}function qr(e,t){let n=Ur(e,t),r=n.reduce((e,t)=>Math.max(e,t.n),0);return n.filter(e=>e.n===r&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0)}const Jr=8.314462618,Yr=Object.freeze([{species:`N2`,moleFraction:.7808,molarMassKgPerMol:.0280134,degreesOfFreedom:5},{species:`O2`,moleFraction:.2095,molarMassKgPerMol:.0319988,degreesOfFreedom:5},{species:`Ar`,moleFraction:.0093,molarMassKgPerMol:.039948,degreesOfFreedom:3},{species:`CO2`,moleFraction:4e-4,molarMassKgPerMol:.0440095,degreesOfFreedom:5}]);function Xr(e=Yr){let t=0,n=0;for(let r of e)t+=r.moleFraction*r.molarMassKgPerMol,n+=r.moleFraction*(r.degreesOfFreedom/2)*Jr;let r=n+Jr;return{derivation:`equipartition-ideal-gas`,molarMassKgPerMol:t,cvJPerKgK:n/t,cpJPerKgK:r/t,gamma:r/n}}function Zr({soundSpeedMPerS:e,numberDensityPerM3:t}){return 1054571817e-43*e/1380649e-29*Math.cbrt(6*Math.PI*Math.PI*t)}function Qr({densityKgPerM3:e,molarMassKgPerMol:t,atomsPerFormula:n=1}){return e/t*602214076e15*n}function $r(e){if(e<=0)return 1;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256,i=Math.exp(r);t+=r**4*i/(i-1)**2}return t*=e/256,3/e**3*t}function ei(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){return 3*Jr*r/n*$r(t/e)}function ti(e){if(e<=0)return 0;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256;t+=r**3/(Math.exp(r)-1)}return e/256*t}function ni(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){if(e<=0)return 0;let i=t/e;return 9*(Jr*r/n)*e*(1/i**3)*ti(i)}const ri=43597447222071e-31,ii=529177210903e-22,ai=(9*Math.PI/4)**(1/3),oi=(Math.log(2)-1)/(2*Math.PI*Math.PI),si=20.4562557,ci=(Math.log(2)-1)/(4*Math.PI*Math.PI),li=27.4203609;function ui(e){return(3/(4*Math.PI*e))**(1/3)}function di(e){return 3/(4*Math.PI*e**3)}function fi(e){let t=ai/e;return .3*t*t}function pi(e){return-(3/(4*Math.PI))*(ai/e)}function mi(e){return oi*Math.log(1+si/e+si/(e*e))}function hi(e){return ci*Math.log(1+li/e+li/(e*e))}function gi(e){return((1+e)**(4/3)+(1-e)**(4/3)-2)/(2**(4/3)-2)}function _i(e,t){return pi(e)*.5*((1+t)**(4/3)+(1-t)**(4/3))}function vi(e,t){let n=mi(e);return n+(hi(e)-n)*gi(t)}function yi(e,t){return _i(e,t)+vi(e,t)}function bi(e){return fi(e)+pi(e)+mi(e)}const xi=.0072973525693;function Si(e){if(e<=1e-12)return 0;let t=ui(e);return e*(bi(t)-Ci(t))}function Ci(e){let t=(9*Math.PI/4)**(1/3)/e;return .3*t*t}function wi(e){if(e<=1e-12)return 0;let t=e*1e-4+1e-15;return(Si(e+t)-Si(e-t))/(2*t)}function Ti(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);i[0]=t[0]/e[0],a[0]=n[0]/e[0];for(let o=1;o<r;o+=1){let s=e[o]-t[o-1]*i[o-1];i[o]=(o<r-1?t[o]:0)/s,a[o]=(n[o]-t[o-1]*a[o-1])/s}let o=new Float64Array(r);o[r-1]=a[r-1];for(let e=r-2;e>=0;--e)o[e]=a[e]-i[e]*o[e+1];return o}function Ei(e,t,n){let r=e.length,i=0,a=e[0]-n;a<0&&(i+=1);for(let o=1;o<r;o+=1)Math.abs(a)<1e-300&&(a=-1e-300),a=e[o]-n-t[o-1]*t[o-1]/a,a<0&&(i+=1);return i}function Di(e,t){let n=e.length,r=1/0,i=-1/0;for(let a=0;a<n;a+=1){let o=Math.abs(a>0?t[a-1]:0)+Math.abs(a<n-1?t[a]:0);r=Math.min(r,e[a]-o),i=Math.max(i,e[a]+o)}return{lo:r,hi:i}}function Oi(e){return Math.min(160,Math.max(48,Math.ceil(Math.log2(Math.max(e,1e-300)/1e-13))))}function ki(e,t,n,r,{lowerVecs:i=null,bounds:a=null,bracketHint:o=null}={}){let s=e.length,c,l;if(o&&Ei(e,t,o[0])<n&&Ei(e,t,o[1])>=n)[c,l]=o;else{let{lo:n,hi:r}=a??Di(e,t);c=n,l=r}let u=Oi(l-c);for(let r=0;r<u;r+=1){let r=.5*(c+l);Ei(e,t,r)>=n?l=r:c=r}let d=.5*(c+l),f=d-1e-7*(Math.abs(d)+1),p=new Float64Array(s);for(let t=0;t<s;t+=1)p[t]=e[t]-f;let m=new Float64Array(s);for(let e=0;e<s;e+=1)m[e]=Math.sin(n*Math.PI*(e+1)/(s+1));for(let e=0;e<12;e+=1){let e=Ti(p,t,m);if(i)for(let t of i){let n=0;for(let i=0;i<s;i+=1)n+=e[i]*t[i]*r;for(let r=0;r<s;r+=1)e[r]-=n*t[r]}let n=0;for(let t=0;t<s;t+=1)n+=e[t]*e[t]*r;n=Math.sqrt(n);for(let t=0;t<s;t+=1)m[t]=e[t]/n}if(m[1]<0)for(let e=0;e<s;e+=1)m[e]=-m[e];return{energyHa:d,u:m}}function Ai(e,t,n,r){let i=Di(e,t),a=[],o=[];for(let s=1;s<=n;s+=1){let n=ki(e,t,s,r,{lowerVecs:o,bounds:i});a.push(n),o.push(n.u)}return a}Object.freeze({H:{Z:1,config:[{n:1,l:0,occupancy:1}]},He:{Z:2,config:[{n:1,l:0,occupancy:2}]},Be:{Z:4,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2}]},Ne:{Z:10,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6}]},Ar:{Z:18,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6}]},Fe:{Z:26,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6},{n:4,l:0,occupancy:2},{n:3,l:2,occupancy:6}]}});function ji(e,t,n){let r=t.length,i=new Float64Array(r),a=new Float64Array(r),o=0;for(let a=0;a<r;a+=1)o+=e[a]*t[a]*t[a]*t[a]*n,i[a]=o;o=0;for(let i=r-1;i>=0;--i)o+=e[i]*t[i]*t[i]*n,a[i]=o;let s=new Float64Array(r);for(let e=0;e<r;e+=1)s[e]=4*Math.PI*(i[e]/t[e]+a[e]);return s}function Mi(e,t,n,r,i){let a=t.length,o=1/(n*n),s=new Float64Array(a),c=new Float64Array(a);for(let n=0;n<a;n+=1)s[n]=(o+.5*(r+.5)*(r+.5))/(t[n]*t[n])+e[n],n<a-1&&(c[n]=-o/(2*t[n]*t[n+1]));let l=Ai(s,c,i,n);for(let e of l){let r=new Float64Array(a);for(let n=0;n<a;n+=1)r[n]=e.u[n]/Math.sqrt(2*t[n]);let i=0;for(let e=0;e<a;e+=1)i+=r[e]*r[e]*t[e]*n;i=Math.sqrt(i);for(let e=0;e<a;e+=1)r[e]/=i;e.u=r}return l}function Ni({u:e,energyHa:t,vFull:n,r,dx:i,l:a,atomicNumberZ:o}){let s=xi*xi,c=0;for(let a=0;a<r.length;a+=1){let o=t-n[a];c+=o*o*e[a]*e[a]*r[a]*i}let l=0;if(a===0){let t=e[0]/r[0];l=s/8*o*t*t}return-.5*s*c+l}function Pi(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);for(let o=1;o<r-1;o+=1){let r=(e[o+1]-e[o-1])/(2*n),s=(e[o+1]-2*e[o]+e[o-1])/(n*n);i[o]=r/t[o],a[o]=(s-r)/(t[o]*t[o])}return i[0]=i[1],i[r-1]=i[r-2],a[0]=a[1],a[r-1]=a[r-2],{fp:i,fpp:a}}function Fi(e,t,n,r,i,a,o){let s=t.length,c=1/(n*n),l=new Float64Array(s);for(let n=0;n<s;n+=1)l[n]=-a/t[n]+e[n];let{fp:u,fpp:d}=Pi(e,t,n),f=new Float64Array(s),p=new Float64Array(s);for(let e=0;e<s;e+=1)f[e]=a/(t[e]*t[e])+u[e],p[e]=-2*a/(t[e]*t[e]*t[e])+d[e];let m=[];for(let e=0;e<i;e+=1){let i=o?.[e]??-a*a/(2*(e+r+1)*(e+r+1)),u=null;for(let a=0;a<40;a+=1){let o=new Float64Array(s);for(let e=0;e<s;e+=1)o[e]=1+26625677260334657e-21*(i-l[e]);let d=new Float64Array(s),m=new Float64Array(s);for(let e=0;e<s;e+=1){let n=-26625677260334657e-21*f[e]/o[e],i=2*o[e]*l[e]-n/t[e]+.75*n*n-.5*(-26625677260334657e-21*p[e])/o[e];d[e]=(2*c+(r+.5)*(r+.5)+t[e]*t[e]*i)/(2*o[e]*t[e]*t[e]),e<s-1&&(m[e]=-c/(2*t[e]*t[e+1]*Math.sqrt(o[e]*o[e+1])))}let h=Math.max(2,.05*Math.abs(i)),g=ki(d,m,e+1,n,{bracketHint:[i-h,i+h]}),_=g.energyHa;if(u=g.u,Math.abs(_-i)<1e-9&&a>1){i=_;break}i=_}let d=new Float64Array(s);for(let e=0;e<s;e+=1)d[e]=u[e]/Math.sqrt(2*t[e]);let h=0;for(let e=0;e<s;e+=1)h+=d[e]*d[e]*t[e]*n;h=Math.sqrt(h);for(let e=0;e<s;e+=1)d[e]/=h;m.push({energyHa:i,u:d})}return m}function Ii({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7,relativistic:c=!1,returnRadialDensity:l=!1}){let u=Math.log(r),d=(Math.log(i)-u)/(n-1),f=new Float64Array(n);for(let e=0;e<n;e+=1)f[e]=Math.exp(u+e*d);let p=new Map;for(let e of t)p.set(e.l,Math.max(p.get(e.l)||0,e.n-e.l));let m=new Float64Array(n);for(let t=0;t<n;t+=1)m[t]=e*(e**3/Math.PI)*Math.exp(-2*e*f[t]);let h=new Map,g=new Float64Array(n),_=new Float64Array(n),v=new Float64Array(n);for(let r=0;r<o;r+=1){g=ji(m,f,d);for(let t=0;t<n;t+=1)_[t]=wi(m[t]),v[t]=-e/f[t]+g[t]+_[t];h=new Map;for(let[e,t]of p)h.set(e,Mi(v,f,d,e,t));let i=new Float64Array(n);for(let e of t){let t=h.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*f[r]*f[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-m[e])*4*Math.PI*f[e]*f[e]*f[e]*d,m[e]=(1-a)*m[e]+a*i[e];if(o<s&&r>8)break}let y=0,b=0,x=0,S=[];for(let n of t){let t=h.get(n.l)[n.n-n.l-1];y+=n.occupancy*t.energyHa,b+=n.occupancy;let r={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t.energyHa};c&&(r.relativisticShiftHa=Ni({u:t.u,energyHa:t.energyHa,vFull:v,r:f,dx:d,l:n.l,atomicNumberZ:e}),x+=n.occupancy*r.relativisticShiftHa),S.push(r)}let C=0,w=0,T=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*f[e]*f[e]*f[e]*d;C+=m[e]*t,w+=.5*m[e]*g[e]*t,T+=(Si(m[e])-_[e]*m[e])*t}let ee=y-w+T;return{totalEnergyHa:ee,orbitals:S,electronCount:b,integratedElectrons:C,atomicNumberZ:e,...l?{radialGrid:{r:Array.from(f),rho:Array.from(m),dx:d}}:{},...c?{relativisticCorrectionHa:x,totalEnergyRelHa:ee+x}:{}}}function Li(e,t){let n=e+t;return n<=1e-12?0:n*yi(ui(n),Math.max(-1,Math.min(1,(e-t)/n)))}function Ri(e,t){let n=e*1e-4+1e-15,r=t*1e-4+1e-15;return{vUp:(Li(e+n,t)-Li(e-n,t))/(2*n),vDown:(Li(e,t+r)-Li(e,t-r))/(2*r)}}function zi(e,t,n,r,i){let a=new Float64Array(i),o=new Float64Array(i);for(let s of e){let e=s.n-s.l-1;if(s.occUp>0){let n=t.get(s.l)[e].u;for(let e=0;e<i;e+=1)a[e]+=s.occUp*n[e]*n[e]/(4*Math.PI*r[e]*r[e])}if(s.occDown>0){let t=n.get(s.l)[e].u;for(let e=0;e<i;e+=1)o[e]+=s.occDown*t[e]*t[e]/(4*Math.PI*r[e]*r[e])}}return{rhoUp:a,rhoDown:o}}function Bi({atomicNumberZ:e,spinConfiguration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=600,tol:s=1e-7,relativistic:c=!1}){let l=Math.log(r),u=(Math.log(i)-l)/(n-1),d=new Float64Array(n);for(let e=0;e<n;e+=1)d[e]=Math.exp(l+e*u);let f=new Map,p=new Map,m=0,h=0;for(let e of t)e.occUp>0&&f.set(e.l,Math.max(f.get(e.l)||0,e.n-e.l)),e.occDown>0&&p.set(e.l,Math.max(p.get(e.l)||0,e.n-e.l)),m+=e.occUp,h+=e.occDown;let g=m+h,_=new Float64Array(n),v=new Float64Array(n);for(let t=0;t<n;t+=1){let n=e*(e**3/Math.PI)*Math.exp(-2*e*d[t]);_[t]=m/g*n,v[t]=h/g*n}let y=new Map,b=new Map,x=new Float64Array(n),S=new Float64Array(n),C=new Float64Array(n),w=new Float64Array(n),T=new Float64Array(n);for(let r=0;r<o;r+=1){let i=new Float64Array(n);for(let e=0;e<n;e+=1)i[e]=_[e]+v[e];x=ji(i,d,u);for(let t=0;t<n;t+=1){let{vUp:n,vDown:r}=Ri(_[t],v[t]);S[t]=n,C[t]=r,w[t]=-e/d[t]+x[t]+n,T[t]=-e/d[t]+x[t]+r}y=new Map,b=new Map;for(let[e,t]of f)y.set(e,Mi(w,d,u,e,t));for(let[e,t]of p)b.set(e,Mi(T,d,u,e,t));let{rhoUp:o,rhoDown:c}=zi(t,y,b,d,n),l=0;for(let e=0;e<n;e+=1)l+=(Math.abs(o[e]-_[e])+Math.abs(c[e]-v[e]))*4*Math.PI*d[e]*d[e]*d[e]*u,_[e]=(1-a)*_[e]+a*o[e],v[e]=(1-a)*v[e]+a*c[e];if(l<s&&r>8)break}let ee=0,te=0,ne=[];for(let n of t){let t=n.n-n.l-1,r={n:n.n,l:n.l,occUp:n.occUp,occDown:n.occDown};if(n.occUp>0){let i=y.get(n.l)[t];r.energyUpHa=i.energyHa,ee+=n.occUp*i.energyHa,c&&(te+=n.occUp*Ni({u:i.u,energyHa:i.energyHa,vFull:w,r:d,dx:u,l:n.l,atomicNumberZ:e}))}if(n.occDown>0){let i=b.get(n.l)[t];r.energyDownHa=i.energyHa,ee+=n.occDown*i.energyHa,c&&(te+=n.occDown*Ni({u:i.u,energyHa:i.energyHa,vFull:T,r:d,dx:u,l:n.l,atomicNumberZ:e}))}ne.push(r)}let re=0,ie=0,ae=0,oe=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*d[e]*d[e]*d[e]*u,n=_[e]+v[e];re+=n*t,ie+=(_[e]-v[e])*t,ae+=.5*n*x[e]*t,oe+=(Li(_[e],v[e])-S[e]*_[e]-C[e]*v[e])*t}let se=ee-ae+oe;return{totalEnergyHa:se,spinMoment:ie,orbitals:ne,electronCount:g,integratedElectrons:re,atomicNumberZ:e,...c?{relativisticCorrectionHa:te,totalEnergyRelHa:se+te}:{}}}function Vi({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-6,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7}){let c=Math.log(r),l=(Math.log(i)-c)/(n-1),u=new Float64Array(n);for(let e=0;e<n;e+=1)u[e]=Math.exp(c+e*l);let d=new Map;for(let e of t)d.set(e.l,Math.max(d.get(e.l)||0,e.n-e.l));let f=new Float64Array(n);for(let t=0;t<n;t+=1)f[t]=e*(e**3/Math.PI)*Math.exp(-2*e*u[t]);let p=new Map,m=new Map,h=new Float64Array(n),g=new Float64Array(n),_=new Float64Array(n);for(let r=0;r<o;r+=1){h=ji(f,u,l);for(let e=0;e<n;e+=1)g[e]=wi(f[e]),_[e]=h[e]+g[e];p=new Map;for(let[t,n]of d){let r=Fi(_,u,l,t,n,e,m.get(t));m.set(t,r.map(e=>e.energyHa)),p.set(t,r)}let i=new Float64Array(n);for(let e of t){let t=p.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*u[r]*u[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-f[e])*4*Math.PI*u[e]*u[e]*u[e]*l,f[e]=(1-a)*f[e]+a*i[e];if(o<s&&r>8)break}let v=0,y=0,b=[];for(let e of t){let t=p.get(e.l)[e.n-e.l-1];v+=e.occupancy*t.energyHa,y+=e.occupancy,b.push({n:e.n,l:e.l,occupancy:e.occupancy,energyHa:t.energyHa})}let x=0,S=0,C=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*u[e]*u[e]*u[e]*l;x+=f[e]*t,S+=.5*f[e]*h[e]*t,C+=(Si(f[e])-g[e]*f[e])*t}return{totalEnergyHa:v-S+C,orbitals:b,electronCount:y,integratedElectrons:x,atomicNumberZ:e,relativisticMethod:`koelling-harmon`}}function Hi(e,t={}){let n=t.gridPointsN??Math.round(1200+12*e),r=t.rMaxBohr??Math.max(20,60/Math.sqrt(e));if(t.spinPolarized){let i=t.spinConfiguration??Gr(e),a=Bi({atomicNumberZ:e,spinConfiguration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:Rr(e),spinConfiguration:i,...a}}let i=t.configuration??Ur(e);if(t.scalarRelativistic){let a=Vi({atomicNumberZ:e,configuration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:Rr(e),configuration:i,...a}}let a=Ii({atomicNumberZ:e,configuration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:Rr(e),configuration:i,...a}}function Ui(e,t){let n=e.map(e=>e.slice()),r=Array.from({length:t},(e,n)=>Array.from({length:t},(e,t)=>+(n===t)));for(let e=0;e<100;e+=1){let e=0;for(let r=0;r<t;r+=1)for(let i=r+1;i<t;i+=1)e+=n[r][i]*n[r][i];if(e<1e-22)break;for(let e=0;e<t;e+=1)for(let i=e+1;i<t;i+=1){if(Math.abs(n[e][i])<1e-18)continue;let a=(n[i][i]-n[e][e])/(2*n[e][i]),o=Math.sign(a||1)/(Math.abs(a)+Math.sqrt(a*a+1)),s=1/Math.sqrt(o*o+1),c=o*s;for(let r=0;r<t;r+=1){let t=n[r][e],a=n[r][i];n[r][e]=s*t-c*a,n[r][i]=c*t+s*a}for(let r=0;r<t;r+=1){let t=n[e][r],a=n[i][r];n[e][r]=s*t-c*a,n[i][r]=c*t+s*a}for(let n=0;n<t;n+=1){let t=r[n][e],a=r[n][i];r[n][e]=s*t-c*a,r[n][i]=c*t+s*a}}}return{values:n.map((e,t)=>e[t]),vectors:r}}function Wi(e,t){let n=Array(e+1);if(t<1e-12){for(let t=0;t<=e;t+=1)n[t]=1/(2*t+1);return n}if(t>16){n[0]=.5*Math.sqrt(Math.PI/t);let r=Math.exp(-t);for(let i=1;i<=e;i+=1)n[i]=((2*i-1)*n[i-1]-r)/(2*t);return n}let r=1/(2*e+1),i=r;for(let n=1;n<300&&(r*=-t/n*(2*e+2*n-1)/(2*e+2*n+1),i+=r,!(Math.abs(r)<1e-17*Math.abs(i)));n+=1);n[e]=i;let a=Math.exp(-t);for(let r=e-1;r>=0;--r)n[r]=(2*t*n[r+1]+a)/(2*r+1);return n}function U(e,t,n,r,i,a){let o=i+a,s=i*a/o;return n<0||n>e+t?0:e===0&&t===0&&n===0?Math.exp(-s*r*r):t===0?1/(2*o)*U(e-1,t,n-1,r,i,a)-s*r/i*U(e-1,t,n,r,i,a)+(n+1)*U(e-1,t,n+1,r,i,a):1/(2*o)*U(e,t-1,n-1,r,i,a)+s*r/a*U(e,t-1,n,r,i,a)+(n+1)*U(e,t-1,n+1,r,i,a)}function Gi(e,t,n,r,i,a,o,s,c){return e===0&&t===0&&n===0?(-2*i)**r*c[r]:e>0?(e-1>0?(e-1)*Gi(e-2,t,n,r+1,i,a,o,s,c):0)+a*Gi(e-1,t,n,r+1,i,a,o,s,c):t>0?(t-1>0?(t-1)*Gi(e,t-2,n,r+1,i,a,o,s,c):0)+o*Gi(e,t-1,n,r+1,i,a,o,s,c):(n-1>0?(n-1)*Gi(e,t,n-2,r+1,i,a,o,s,c):0)+s*Gi(e,t,n-1,r+1,i,a,o,s,c)}const Ki=(e,t,n,r)=>[(e*t[0]+n*r[0])/(e+n),(e*t[1]+n*r[1])/(e+n),(e*t[2]+n*r[2])/(e+n)];function qi(e,t,n,r,i,a){let o=e+r,s=U(t[0],i[0],0,n[0]-a[0],e,r),c=U(t[1],i[1],0,n[1]-a[1],e,r),l=U(t[2],i[2],0,n[2]-a[2],e,r);return s*c*l*(Math.PI/o)**1.5}function Ji(e,t,n,r,i,a){let[o,s,c]=i,l=r*(2*(o+s+c)+3)*qi(e,t,n,r,i,a),u=-2*r*r*(qi(e,t,n,r,[o+2,s,c],a)+qi(e,t,n,r,[o,s+2,c],a)+qi(e,t,n,r,[o,s,c+2],a)),d=-.5*(o*(o-1)*qi(e,t,n,r,[o-2,s,c],a)+s*(s-1)*qi(e,t,n,r,[o,s-2,c],a)+c*(c-1)*qi(e,t,n,r,[o,s,c-2],a));return l+u+d}function Yi(e,t,n,r,i,a,o){let s=e+r,c=Ki(e,n,r,a),l=c[0]-o[0],u=c[1]-o[1],d=c[2]-o[2],f=l*l+u*u+d*d,p=Wi(t[0]+t[1]+t[2]+i[0]+i[1]+i[2],s*f),m=0;for(let o=0;o<=t[0]+i[0];o+=1){let c=U(t[0],i[0],o,n[0]-a[0],e,r);for(let f=0;f<=t[1]+i[1];f+=1){let h=U(t[1],i[1],f,n[1]-a[1],e,r);for(let g=0;g<=t[2]+i[2];g+=1){let _=U(t[2],i[2],g,n[2]-a[2],e,r);m+=c*h*_*Gi(o,f,g,0,s,l,u,d,p)}}}return 2*Math.PI/s*m}function Xi(e,t,n,r,i,a,o,s,c,l,u,d){let f=e+r,p=o+l,m=Ki(e,n,r,a),h=Ki(o,c,l,d),g=f*p/(f+p),_=m[0]-h[0],v=m[1]-h[1],y=m[2]-h[2],b=_*_+v*v+y*y,x=Wi(t[0]+t[1]+t[2]+i[0]+i[1]+i[2]+s[0]+s[1]+s[2]+u[0]+u[1]+u[2],g*b),S=0;for(let f=0;f<=t[0]+i[0];f+=1){let p=U(t[0],i[0],f,n[0]-a[0],e,r);for(let m=0;m<=t[1]+i[1];m+=1){let h=U(t[1],i[1],m,n[1]-a[1],e,r);for(let b=0;b<=t[2]+i[2];b+=1){let C=U(t[2],i[2],b,n[2]-a[2],e,r),w=p*h*C;if(w!==0)for(let e=0;e<=s[0]+u[0];e+=1){let t=U(s[0],u[0],e,c[0]-d[0],o,l);for(let n=0;n<=s[1]+u[1];n+=1){let r=U(s[1],u[1],n,c[1]-d[1],o,l);for(let i=0;i<=s[2]+u[2];i+=1){let a=U(s[2],u[2],i,c[2]-d[2],o,l),p=(e+n+i)%2==0?1:-1;S+=w*t*r*a*p*Gi(f+e,m+n,b+i,0,g,_,v,y,x)}}}}}}return S*2*Math.PI**2.5/(f*p*Math.sqrt(f+p))}function Zi(e){if(e<=0)return 1;let t=1;for(let n=e;n>0;n-=2)t*=n;return t}function Qi(e,t){let[n,r,i]=t;return Math.sqrt((2*e/Math.PI)**1.5*(4*e)**(n+r+i)/(Zi(2*n-1)*Zi(2*r-1)*Zi(2*i-1)))}function $i(e,t,n,r){let i=n.map((e,n)=>r[n]*Qi(e,t)),a=0;for(let r=0;r<n.length;r+=1)for(let o=0;o<n.length;o+=1)a+=i[r]*i[o]*qi(n[r],t,e,n[o],t,e);let o=1/Math.sqrt(a);return{center:e,lmn:t,exps:n,coeffs:i.map(e=>e*o)}}function ea(e,t,n){let r=0;for(let i=0;i<e.exps.length;i+=1)for(let a=0;a<t.exps.length;a+=1)r+=e.coeffs[i]*t.coeffs[a]*n(e.exps[i],e.lmn,e.center,t.exps[a],t.lmn,t.center);return r}const W=[.15432897,.53532814,.44463454],G=[-.09996723,.39951283,.70011547],K=[.15591627,.60768372,.39195739],ta=[-.219620369,.2255954336,.900398426],na=[.0105876043,.5951670053,.462001012],ra={1:[{l:`s`,exps:[3.42525091,.62391373,.1688554],sCoef:W}],2:[{l:`s`,exps:[6.36242139,1.158923,.31364979],sCoef:W}],3:[{l:`s`,exps:[16.11957475,2.936200663,.794650487],sCoef:W},{l:`sp`,exps:[.6362897469,.1478600533,.0480886784],sCoef:G,pCoef:K}],4:[{l:`s`,exps:[30.16787069,5.495115306,1.487192653],sCoef:W},{l:`sp`,exps:[1.31483311,.3055389383,.0993707456],sCoef:G,pCoef:K}],5:[{l:`s`,exps:[48.79111318,8.887362172,2.40526704],sCoef:W},{l:`sp`,exps:[2.236956142,.5198204999,.16906176],sCoef:G,pCoef:K}],6:[{l:`s`,exps:[71.616837,13.045096,3.5305122],sCoef:W},{l:`sp`,exps:[2.9412494,.6834831,.2222899],sCoef:G,pCoef:K}],7:[{l:`s`,exps:[99.106169,18.052312,4.8856602],sCoef:W},{l:`sp`,exps:[3.7804559,.8784966,.2857144],sCoef:G,pCoef:K}],8:[{l:`s`,exps:[130.70932,23.808861,6.4436083],sCoef:W},{l:`sp`,exps:[5.0331513,1.1695961,.380389],sCoef:G,pCoef:K}],9:[{l:`s`,exps:[166.679134,30.36081233,8.216820672],sCoef:W},{l:`sp`,exps:[6.464803249,1.502281245,.4885884864],sCoef:G,pCoef:K}],10:[{l:`s`,exps:[207.015607,37.70815124,10.20529731],sCoef:W},{l:`sp`,exps:[8.24631512,1.916266291,.6232292721],sCoef:G,pCoef:K}],11:[{l:`s`,exps:[250.77243,45.67851117,12.36238776],sCoef:W},{l:`sp`,exps:[12.04019274,2.797881859,.909958017],sCoef:G,pCoef:K},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:ta,pCoef:na}],12:[{l:`s`,exps:[299.2374137,54.50646845,14.75157752],sCoef:W},{l:`sp`,exps:[15.12182352,3.513986579,1.142857498],sCoef:G,pCoef:K},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:ta,pCoef:na}],13:[{l:`s`,exps:[351.4214767,64.01186067,17.32410761],sCoef:W},{l:`sp`,exps:[18.89939621,4.391813233,1.42835397],sCoef:G,pCoef:K},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:ta,pCoef:na}],14:[{l:`s`,exps:[407.7975514,74.28083305,20.10329229],sCoef:W},{l:`sp`,exps:[23.19365606,5.389706871,1.752899952],sCoef:G,pCoef:K},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:ta,pCoef:na}],15:[{l:`s`,exps:[468.3656378,85.31338559,23.08913156],sCoef:W},{l:`sp`,exps:[28.03263958,6.514182577,2.118614352],sCoef:G,pCoef:K},{l:`sp`,exps:[1.743103231,.4863213771,.1903428909],sCoef:ta,pCoef:na}],16:[{l:`s`,exps:[533.1257359,97.1095183,26.28162542],sCoef:W},{l:`sp`,exps:[33.32975173,7.745117521,2.518952599],sCoef:G,pCoef:K},{l:`sp`,exps:[2.029194274,.5661400518,.2215833792],sCoef:ta,pCoef:na}],17:[{l:`s`,exps:[601.3456136,109.5358542,29.64467686],sCoef:W},{l:`sp`,exps:[38.96041889,9.053563477,2.944499834],sCoef:G,pCoef:K},{l:`sp`,exps:[2.129386495,.5940934274,.232524141],sCoef:ta,pCoef:na}],18:[{l:`s`,exps:[674.4465184,122.8512753,33.24834945],sCoef:W},{l:`sp`,exps:[45.16424392,10.495199,3.413364448],sCoef:G,pCoef:K},{l:`sp`,exps:[2.621366518,.731354605,.2862472356],sCoef:ta,pCoef:na}]},ia=[[1,0,0],[0,1,0],[0,0,1]];function aa(e){let t=[];return e.forEach((e,n)=>{let r=ra[e.Z];if(!r)throw Error(`No STO-3G basis for Z=${e.Z} (have Z=1-18: H–Ar)`);for(let i of r){let r=$i(e.position,[0,0,0],i.exps,i.sCoef);if(r.atomIndex=n,t.push(r),i.l===`sp`)for(let r of ia){let a=$i(e.position,r,i.exps,i.pCoef);a.atomIndex=n,t.push(a)}}}),t}function oa(e,t){let{values:n,vectors:r}=Ui(e,t),i=Array.from({length:t},()=>Array(t).fill(0));for(let e=0;e<t;e+=1)for(let a=0;a<t;a+=1){let o=0;for(let i=0;i<t;i+=1)o+=r[e][i]*r[a][i]/Math.sqrt(n[i]);i[e][a]=o}return i}function sa(e,t){let n=aa(e),r=n.length,i=e.reduce((e,t)=>e+t.Z,0)-t,a=Array.from({length:r},()=>Array(r).fill(0)),o=Array.from({length:r},()=>Array(r).fill(0));for(let t=0;t<r;t+=1)for(let i=0;i<r;i+=1){a[t][i]=ea(n[t],n[i],qi);let r=ea(n[t],n[i],Ji);for(let a of e)r+=-a.Z*ea(n[t],n[i],(e,t,n,r,i,o)=>Yi(e,t,n,r,i,o,a.position));o[t][i]=r}let s=new Float64Array(r*r*r*r),c=(e,t,n,i)=>((e*r+t)*r+n)*r+i;for(let e=0;e<r;e+=1)for(let t=0;t<=e;t+=1)for(let i=0;i<r;i+=1)for(let r=0;r<=i;r+=1){if(e*(e+1)/2+t<i*(i+1)/2+r)continue;let a=ha(n[e],n[t],n[i],n[r]);for(let[n,o,l,u]of[[e,t,i,r],[t,e,i,r],[e,t,r,i],[t,e,r,i],[i,r,e,t],[r,i,e,t],[i,r,t,e],[r,i,t,e]])s[c(n,o,l,u)]=a}return{basis:n,n:r,nElectrons:i,S:a,Hcore:o,eri:s,idx:c,X:oa(a,r),nuclearRepulsion:ga(e)}}function ca(e,t,n){let{values:r,vectors:i}=Ui(va(va(_a(t,n),e,n),t,n),n),a=r.map((e,t)=>t).sort((e,t)=>r[e]-r[t]),o=Array.from({length:n},()=>Array(n).fill(0));for(let e=0;e<n;e+=1)for(let r=0;r<n;r+=1){let s=0;for(let o=0;o<n;o+=1)s+=t[e][o]*i[o][a[r]];o[e][r]=s}return{C:o,epsilon:a.map(e=>r[e])}}function la(e,t){let n=t.length,r=e.map((e,n)=>[...e,t[n]]);for(let e=0;e<n;e+=1){let t=e;for(let i=e+1;i<n;i+=1)Math.abs(r[i][e])>Math.abs(r[t][e])&&(t=i);if(Math.abs(r[t][e])<1e-14)return null;[r[e],r[t]]=[r[t],r[e]];for(let t=0;t<n;t+=1){if(t===e)continue;let i=r[t][e]/r[e][e];for(let a=e;a<=n;a+=1)r[t][a]-=i*r[e][a]}}return r.map((e,t)=>e[n]/r[t][t])}function ua(e,t,n,r){let i=va(va(e,t,r),n,r),a=va(va(n,t,r),e,r),o=Array.from({length:r},()=>Array(r).fill(0));for(let e=0;e<r;e+=1)for(let t=0;t<r;t+=1)o[e][t]=i[e][t]-a[e][t];return o}function da(e,t,n){let r=e.length;if(r<2)return null;let i=Array.from({length:r+1},()=>Array(r+1).fill(0));for(let e=0;e<r;e+=1){for(let r=0;r<=e;r+=1){let a=0,o=t[e],s=t[r];for(let e=0;e<n;e+=1)for(let t=0;t<n;t+=1)a+=o[e][t]*s[e][t];i[e][r]=a,i[r][e]=a}i[e][r]=-1,i[r][e]=-1}let a=Array(r+1).fill(0);a[r]=-1;let o=la(i,a);if(!o)return null;let s=Array.from({length:n},()=>Array(n).fill(0));for(let t=0;t<r;t+=1){let r=o[t],i=e[t];for(let e=0;e<n;e+=1)for(let t=0;t<n;t+=1)s[e][t]+=r*i[e][t]}return s}function fa(e,t,n,r,i){let a=Array(r).fill(0);for(let i=0;i<r;i+=1){let o=0;for(let a=0;a<n[0].length;a+=1){let s=0;for(let o=0;o<r;o+=1){let c=0;for(let n=0;n<r;n+=1)c+=t[o][n]*e[n][i];s+=n[o][a]*c}o+=s*s}a[i]=o}return a.map((e,t)=>[e,t]).sort((e,t)=>t[0]-e[0]).slice(0,i).map(([,e])=>e).sort((e,t)=>e-t)}function pa(e,{charge:t=0,maxIter:n=200,tol:r=1e-8,damping:i=.5,initialP:a=null,referenceOccupiedC:o=null}={}){let{basis:s,n:c,nElectrons:l,S:u,Hcore:d,eri:f,idx:p,X:m,nuclearRepulsion:h}=sa(e,t);if(l%2!=0)throw Error(`RHF requires an even electron count (closed shell)`);let g=l/2,_=Array.isArray(a)&&a.length===c?a.map(e=>[...e]):Array.from({length:c},()=>Array(c).fill(0)),v=0,y=!1,b=1/0,x=null,S=null,C=null,w=_,T=[],ee=[];for(let e=0;e<n;e+=1){let t=Array.from({length:c},()=>Array(c).fill(0));for(let e=0;e<c;e+=1)for(let n=0;n<c;n+=1){let r=0;for(let t=0;t<c;t+=1)for(let i=0;i<c;i+=1)r+=_[t][i]*(f[p(e,n,i,t)]-.5*f[p(e,t,i,n)]);t[e][n]=d[e][n]+r}T.push(t.map(e=>[...e])),ee.push(ua(t,_,u,c)),T.length>8&&(T.shift(),ee.shift());let{C:n,epsilon:a}=ca((e>=2?da(T,ee,c):null)||t,m,c);x=n,S=a;let s=Array.isArray(o)&&o.length===c?fa(n,u,o,c,g):null;C=s;let l=Array.from({length:c},()=>Array(c).fill(0));for(let e=0;e<c;e+=1)for(let t=0;t<c;t+=1){let r=0;for(let i=0;i<g;i+=1){let a=s?s[i]:i;r+=n[e][a]*n[t][a]}l[e][t]=2*r}let h=0;for(let e=0;e<c;e+=1)for(let n=0;n<c;n+=1)h+=.5*l[e][n]*(d[e][n]+t[e][n]);w=l;for(let e=0;e<c;e+=1)for(let t=0;t<c;t+=1)_[e][t]=i*l[e][t]+(1-i)*_[e][t];if(v=h,Math.abs(v-b)<r&&e>2){y=!0;break}b=v}let te=x?Array.from({length:c},(e,t)=>Array.from({length:g},(e,n)=>x[t][C?C[n]:n])):null;return{totalEnergyHa:v+h,electronicEnergyHa:v,nuclearRepulsionHa:h,nBasis:c,nElectrons:l,nOcc:g,C:x,orbitalEnergies:S,eri:f,idx:p,P:w,S:u,basis:s,scfConverged:y,occupiedC:te}}function ma(e,{charge:t=0,multiplicity:n=null,maxIter:r=300,tol:i=1e-9,damping:a=.6}={}){let{n:o,nElectrons:s,Hcore:c,eri:l,idx:u,X:d,nuclearRepulsion:f}=sa(e,t),p=n==null?s%2:n-1,m=(s+p)/2,h=(s-p)/2;if(!Number.isInteger(m)||h<0)throw Error(`inconsistent electron count / multiplicity`);let g=(e,t)=>{let n=Array.from({length:o},()=>Array(o).fill(0));for(let r=0;r<o;r+=1)for(let i=0;i<o;i+=1){let a=0;for(let n=0;n<t;n+=1)a+=e[r][n]*e[i][n];n[r][i]=a}return n},{C:_}=ca(c,d,o),v=g(_,m),y=g(_,h),b=0,x=!1,S=1/0;for(let e=0;e<r;e+=1){let t=Array.from({length:o},(e,t)=>Array.from({length:o},(e,n)=>v[t][n]+y[t][n])),n=Array.from({length:o},()=>Array(o).fill(0)),r=Array.from({length:o},()=>Array(o).fill(0));for(let e=0;e<o;e+=1)for(let i=0;i<o;i+=1){let a=0,s=0,d=0;for(let n=0;n<o;n+=1)for(let r=0;r<o;r+=1)a+=t[n][r]*l[u(e,i,r,n)],s+=v[n][r]*l[u(e,n,r,i)],d+=y[n][r]*l[u(e,n,r,i)];n[e][i]=c[e][i]+a-s,r[e][i]=c[e][i]+a-d}let{C:s}=ca(n,d,o),{C:f}=ca(r,d,o),p=g(s,m),_=g(f,h),C=0;for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)C+=.5*((p[e][t]+_[e][t])*c[e][t]+p[e][t]*n[e][t]+_[e][t]*r[e][t]);for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)v[e][t]=a*p[e][t]+(1-a)*v[e][t],y[e][t]=a*_[e][t]+(1-a)*y[e][t];if(b=C,Math.abs(b-S)<i&&e>2){x=!0;break}S=b}return{totalEnergyHa:b+f,electronicEnergyHa:b,nuclearRepulsionHa:f,nBasis:o,nElectrons:s,nAlpha:m,nBeta:h,scfConverged:x}}function ha(e,t,n,r){let i=0;for(let a=0;a<e.exps.length;a+=1)for(let o=0;o<t.exps.length;o+=1)for(let s=0;s<n.exps.length;s+=1)for(let c=0;c<r.exps.length;c+=1)i+=e.coeffs[a]*t.coeffs[o]*n.coeffs[s]*r.coeffs[c]*Xi(e.exps[a],e.lmn,e.center,t.exps[o],t.lmn,t.center,n.exps[s],n.lmn,n.center,r.exps[c],r.lmn,r.center);return i}function ga(e){let t=0;for(let n=0;n<e.length;n+=1)for(let r=n+1;r<e.length;r+=1){let i=e[n].position[0]-e[r].position[0],a=e[n].position[1]-e[r].position[1],o=e[n].position[2]-e[r].position[2];t+=e[n].Z*e[r].Z/Math.sqrt(i*i+a*a+o*o)}return t}const _a=(e,t)=>Array.from({length:t},(n,r)=>Array.from({length:t},(t,n)=>e[n][r]));function va(e,t,n){let r=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i+=1)for(let a=0;a<n;a+=1){let o=e[i][a];if(o!==0)for(let e=0;e<n;e+=1)r[i][e]+=o*t[a][e]}return r}function ya(e,t={}){return ma([{Z:e,position:[0,0,0]}],{multiplicity:Kr(e)+1,...t}).totalEnergyHa}function ba(e,{moleculeOptions:t={},atomCache:n=new Map}={}){let r=ma(e,t).totalEnergyHa,i=0;for(let t of e)n.has(t.Z)||n.set(t.Z,ya(t.Z)),i+=n.get(t.Z);return{atomizationEnergyHa:i-r,moleculeEnergyHa:r,atomsEnergyHa:i}}var xa={schema:`peercompute.ulg.conductor-optical-constants.v0`,schemaVersion:1,bankVersion:`johnson-christy-1972-visible-v1`,source:`P. B. Johnson and R. W. Christy, Optical Constants of the Noble Metals, Physical Review B 6, 4370-4379 (1972)`,doi:`10.1103/PhysRevB.6.4370`,referenceState:{phase:`solid`,temperature:`room-temperature laboratory measurement; numeric temperature not reported`,sample:`bulk-like evaporated films above the reported critical thickness`},notes:[`The checked-in values are measured complex refractive indices n + i*k, not selected display RGB colors.`,`Only the rows spanning the visible spectrum are retained. Runtime reflectance, absorption, spectral samples, and CIE/sRGB color are derived from n and k.`,`Use for liquid or elevated-temperature condensed phases is an explicitly labelled nearest-reference extrapolation until phase-specific optical constants are available.`],photonEnergyEv:[1.51,1.64,1.76,1.88,2.01,2.13,2.26,2.38,2.5,2.63,2.75,2.88,3,3.12,3.25,3.37,3.5],records:[{symbol:`Cu`,n:[.26,.24,.21,.22,.3,.7,1.02,1.18,1.22,1.25,1.24,1.25,1.28,1.32,1.33,1.36,1.37],k:[5.18,4.665,4.205,3.747,3.205,2.704,2.577,2.608,2.564,2.483,2.397,2.305,2.207,2.116,2.045,1.975,1.916]},{symbol:`Ag`,n:[.04,.03,.04,.05,.06,.05,.06,.05,.05,.05,.04,.04,.05,.05,.05,.07,.1],k:[5.727,5.242,4.838,4.483,4.152,3.858,3.586,3.324,3.093,2.869,2.657,2.462,2.275,2.07,1.864,1.657,1.419]},{symbol:`Au`,n:[.16,.14,.13,.14,.21,.29,.43,.62,1.04,1.31,1.38,1.45,1.46,1.47,1.46,1.48,1.5],k:[5.083,4.542,4.103,3.697,3.272,2.863,2.455,2.081,1.833,1.849,1.914,1.948,1.958,1.952,1.933,1.895,1.866]}]};const Sa=xa;function Ca(e){let t=String(e||``);return t?t[0].toUpperCase()+t.slice(1).toLowerCase():``}const wa=new Map((xa.records||[]).map(e=>[e.symbol,e]));function Ta(e){return wa.get(Ca(e))||null}function Ea(e,t,n){let r=Number(n);if(!Number.isFinite(r)||e.length!==t.length||t.length===0)return null;if(r<=t[0])return e[0];let i=t.length-1;if(r>=t[i])return e[i];for(let n=1;n<t.length;n+=1){if(r>t[n])continue;let i=t[n-1],a=t[n],o=(r-i)/(a-i);return e[n-1]+(e[n]-e[n-1])*o}return e[i]}function Da(e,t){let n=typeof e==`string`?Ta(e):e,r=xa.photonEnergyEv||[];if(!n||!Array.isArray(n.n)||!Array.isArray(n.k))return null;let i=Ea(n.n,r,t),a=Ea(n.k,r,t);return Number.isFinite(i)&&Number.isFinite(a)?{n:i,k:a}:null}function Oa({n:e,k:t}={}){let n=Number(e),r=Number(t);if(!Number.isFinite(n)||!Number.isFinite(r))return null;let i=(n-1)**2+r**2,a=(n+1)**2+r**2;return a>0?Math.min(1,Math.max(0,i/a)):null}function ka(e,t){let n=Number(e)*1e-9,r=Number(t);return!(n>0)||!(r>=0)?null:4*Math.PI*r/n}const Aa=27.211386245988,ja=6582119569e-25,Ma=Object.freeze([380,430,480,530,580,630,680,730,780]),Na=new Map,Pa=(e,t)=>ma(e,{multiplicity:t}).totalEnergyHa,Fa=new Map,Ia=461.522,La=1.225,Ra=1.000293,za=`clausius-clapeyron-droplet-scattering-v0`;function Ba(e,t,n,r){let i=(e-t)*(e<t?1/n:1/r);return Math.exp(-.5*i*i)}function Va(e){return 1.056*Ba(e,599.8,37.9,31)+.362*Ba(e,442,16,26.7)-.065*Ba(e,501.1,20.4,26.2)}function Ha(e){return .821*Ba(e,568.8,46.9,40.5)+.286*Ba(e,530.9,16.3,31.1)}function Ua(e){return 1.217*Ba(e,437,11.8,36)+.681*Ba(e,459,26,13.8)}function Wa(e){let t=Math.min(1,Math.max(0,e));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function Ga(e){let t=0,n=0,r=0,i=0;for(let a=380;a<=780;a+=5){let o=e(a);t+=o*Va(a),n+=o*Ha(a),r+=o*Ua(a),i+=Ha(a)}t/=i,n/=i,r/=i;let a=3.2406*t-1.5372*n-.4986*r,o=-.9689*t+1.8758*n+.0415*r,s=.0557*t-.204*n+1.057*r;return{r:Wa(Math.max(0,a)),g:Wa(Math.max(0,o)),b:Wa(Math.max(0,s))}}function Ka(e){let t=0,n=0;for(let r=380;r<=780;r+=5){let i=Ha(r);t+=e(r)*i,n+=i}return n>0?t/n:0}function qa(e){return Math.min(1,Math.max(0,Number.isFinite(e)?e:0))}function Ja(e){return Array.isArray(e)?[qa(e[0]),qa(e[1]),qa(e[2])]:[qa(e?.r),qa(e?.g),qa(e?.b)]}function q(e){return Number.isFinite(e)?Number(e).toPrecision(10):String(e??`null`)}function Ya(e){return e==null?`null`:Array.isArray(e)?`[${e.map(Ya).join(`,`)}]`:typeof e==`object`?`{${Xa(e)}}`:typeof e==`number`?q(e):String(e)}function Xa(e){return!e||typeof e!=`object`?`none`:Object.keys(e).sort().map(t=>`${t}:${Ya(e[t])}`).join(`|`)}function Za(e,t=null){if(!e||typeof e!=`object`)return null;let n=String(t||``).toLowerCase(),r=Array.isArray(e.phases)?e.phases.find(e=>String(e?.name||``).toLowerCase()===n)||e.phases[0]:null,i=Number(r?.densityKgPerM3??e.densityKgPerM3);return Number.isFinite(i)&&i>0?i:null}function Qa(e){return!Array.isArray(e)||e.length===0?`none`:e.map(e=>[e.from??`?`,e.to??`?`,q(e.energyEv),q(e.dampingEv),q(e.strengthWeight)].join(`:`)).join(`|`)}function $a({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r,conductionElectronDensityPerM3:i,opticalState:a=null}={}){return[e??`unknown`,t??`unknown`,q(n),Xa(a),q(i??r?.conductionElectronDensityPerM3),q(Za(r,t)),q(r?.electronicGapEv),q(r?.gasElectronicExcitationEv),q(r?.gasElectronicBandFwhmEv),q(r?.gasElectronicOscillatorStrength),Xa(r?.gasElectronicAbsorptionCrossSection),Xa(r?.conductorOpticalConstants),Qa(r?.opticalInterbandOscillators),Array.isArray(r?.intrinsicColorSrgb)?r.intrinsicColorSrgb.map(q).join(`,`):`no-intrinsic`].join(`::`)}function eo(e){return{...e,baseColorSrgb:e.baseColorSrgb?[...e.baseColorSrgb]:e.baseColorSrgb,attenuationColor:e.attenuationColor?[...e.attenuationColor]:e.attenuationColor,interbandOscillators:Array.isArray(e.interbandOscillators)?e.interbandOscillators.map(e=>({...e})):e.interbandOscillators,spectralSamples:Array.isArray(e.spectralSamples)?e.spectralSamples.map(e=>({...e})):e.spectralSamples,dropletMicrophysics:e.dropletMicrophysics?{...e.dropletMicrophysics}:e.dropletMicrophysics,pbr:e.pbr?{...e.pbr,baseColorSrgb:e.pbr.baseColorSrgb?[...e.pbr.baseColorSrgb]:e.pbr.baseColorSrgb}:e.pbr,provenance:e.provenance?{...e.provenance,inputs:e.provenance.inputs?{...e.provenance.inputs}:e.provenance.inputs}:e.provenance}}function to(e,{baseColorSrgb:t,renderModel:n,vertexColorPolicy:r=`material-pbr`,spectralSamples:i=[]}){let a=Ja(t);return{...e,baseColorSrgb:a,renderModel:n,vertexColorPolicy:r,spectralSamples:i,pbr:{baseColorSrgb:a,metalness:e.metalness,roughness:e.roughness,opacity:e.opacity,transmission:e.transmission,ior:e.ior??null,renderModel:n,vertexColorPolicy:r}}}function no(e){return e>0?1-Math.exp(-Math.min(80,e)):0}function ro(e){let t=Number(e);return t>0?611.657*Math.exp(25e5/Ia*(1/273.16-1/t)):null}function io(e,{scatteringCoefficientPerM:t,dropletRadiusM:n}){if(!(t>0))return 0;let r=Number(n);if(!(r>0))return t;let i=e*1e-9;return 2*Math.PI*r/i>=.3?t:t*(550/e)**4}function ao({temperatureK:e=null,h2oPartialPressurePa:t=null,pressurePa:n=null,dropletRadiusM:r=1e-6,pathLengthM:i=.3}={}){let a=Number(e),o=Number(t??n),s=Number(r),c=ro(a);if(!(a>0)||!(o>0)||!(c>0)||!(s>0))return{model:za,status:`pure-vapor-or-state-missing`,temperatureK:Number.isFinite(a)?a:null,h2oPartialPressurePa:Number.isFinite(o)?o:null,pressurePa:Number.isFinite(Number(n))?Number(n):null,saturationPressurePa:c,supersaturationRatio:null,condensedMassFraction:0,vaporDensityKgPerM3:0,condensedMassDensityKgPerM3:0,dropletRadiusM:Number.isFinite(s)&&s>0?s:null,dropletNumberDensityPerM3:0,dropletCrossSectionM2:0,mieExtinctionEfficiency:0,scatteringCoefficientPerM:0,opticalDepth:0,pathLengthM:i};let l=o/c,u=l>1?qa(1-1/l):0,d=o/(Ia*a),f=d*u,p=4/3*Math.PI*s**3*997,m=p>0?f/p:0,h=Math.PI*s**2,g=m*h*2,_=g*Math.max(0,Number(i)||0);return{model:za,status:u>0?`supersaturated-condensed-droplets`:`subsaturated-pure-vapor`,temperatureK:a,h2oPartialPressurePa:o,pressurePa:Number.isFinite(Number(n))?Number(n):null,saturationPressurePa:c,supersaturationRatio:l,condensedMassFraction:u,vaporDensityKgPerM3:d,condensedMassDensityKgPerM3:f,dropletRadiusM:s,dropletNumberDensityPerM3:m,dropletCrossSectionM2:h,mieExtinctionEfficiency:2,scatteringCoefficientPerM:g,opticalDepth:_,pathLengthM:i}}function oo(e,t){return[e[0]+t[0],e[1]+t[1]]}function so(e,t){return[e[0]-t[0],e[1]-t[1]]}function co(e,t){let n=t[0]*t[0]+t[1]*t[1];return[(e[0]*t[0]+e[1]*t[1])/n,(e[1]*t[0]-e[0]*t[1])/n]}function lo(e){let[t,n]=e,r=Math.hypot(t,n);return[Math.sqrt(Math.max(0,(r+t)/2)),Math.sign(n||1)*Math.sqrt(Math.max(0,(r-t)/2))]}function uo(e){let[t,n]=lo(e);return((t-1)**2+n**2)/((t+1)**2+n**2)}function fo(e,t){let[,n]=lo(t);return 4*Math.PI*Math.max(0,n)/(e*1e-9)}function po(e,t,n){let[r,i]=lo(t),a=fo(e,t);return{wavelengthNm:e,reflectance:qa(uo(t)),transmittance:Math.exp(-Math.min(80,a*Math.max(0,n))),absorptionCoefficientPerM:a,scatteringCoefficientPerM:0,n:r,k:i}}function mo(e,t){return Da(e,1239.841984/t)}function ho(e,t){return Oa(mo(e,t))??0}function go(e){let t=Ta(e);return t?Ga(e=>ho(t,e)):null}function _o(e,t){let n=t?.conductorOpticalConstants;return!n||n.bankVersion!==Sa.bankVersion?null:Ta(n.symbol||e)}function vo(e,{phase:t=`solid`,pathLengthM:n=.3,marker:r=null}={}){let i=t=>ho(e,t),a=Ka(t=>ka(t,mo(e,t)?.k)??0),o=Ka(i),s=a*Math.max(0,n),c=no(s),l=Math.exp(-Math.min(80,s)),u=Ga(i),d=Ma.map(t=>{let r=mo(e,t),a=ka(t,r?.k)??0;return{wavelengthNm:t,reflectance:i(t),transmittance:Math.exp(-Math.min(80,a*Math.max(0,n))),absorptionCoefficientPerM:a,scatteringCoefficientPerM:0,n:r?.n??null,k:r?.k??null}}),f=t===`solid`?`within-reference-phase`:`nearest-reference-condensed-phase-extrapolation`;return to({metalness:c>.5?1:c,roughness:.32,transmission:l,ior:null,opacity:c,attenuationColor:null,attenuationDistanceM:a>0?1/a:1/0,condensationScatter:0,internalScatter:0,opticalDepth:s,absorptionCoefficientPerM:a,reflectance:o,provenance:{status:`reference-fallback`,source:`johnson-christy-1972-complex-index`,method:`measured complex refractive index interpolation -> normal-incidence Fresnel reflectance + skin-depth absorption -> CIE 1931 equal-energy sRGB`,inputs:{symbol:e.symbol,phase:t,phaseApplication:f,pathLengthM:n,bankVersion:Sa.bankVersion,doi:Sa.doi,marker:r},validation:!1}},{baseColorSrgb:[u.r,u.g,u.b],renderModel:`conductor-reference-complex-index`,spectralSamples:d})}function yo(e,{absorptionCoefficientPerM:t,pathLengthM:n,reflectance:r=0,scatteringCoefficientPerM:i=0,n:a=null,k:o=null}){let s=Math.max(0,t??0);return{wavelengthNm:e,reflectance:qa(r),transmittance:Math.exp(-Math.min(80,s*Math.max(0,n))),absorptionCoefficientPerM:s,scatteringCoefficientPerM:Math.max(0,i),n:a,k:o}}function bo(e,t=1){let n=(550/Math.max(1,Number(e)||550))**4;return 11e-6*Math.max(0,Number.isFinite(t)?t:1)*n}function xo({phase:e=`gas`,pathLengthM:t=.3,properties:n=null}={}){let r=Za(n,e)??La,i=r/La,a=Ka(e=>bo(e,i)),o=a*Math.max(0,t),s=Math.exp(-Math.min(80,o)),c=no(o),l=Ga(e=>.85+.15*(450/e)**4),u=Ma.map(e=>yo(e,{absorptionCoefficientPerM:0,pathLengthM:t,reflectance:0,scatteringCoefficientPerM:bo(e,i),n:Ra,k:0}));return to({metalness:0,roughness:.92,transmission:s,ior:Ra,opacity:c,attenuationColor:[1,1,1],attenuationDistanceM:1/0,condensationScatter:0,internalScatter:a,scatteringCoefficientPerM:a,opticalDepth:o,absorptionCoefficientPerM:0,provenance:{status:`derived`,source:`dry-air-rayleigh-scattering-reference-composition`,method:`standard dry-air density + Rayleigh 1/lambda^4 molecular scattering -> optically thin transparent PBR row`,inputs:{phase:e,pathLengthM:t,densityKgPerM3:r,densityScale:i},validation:!1}},{baseColorSrgb:[l.r,l.g,l.b],renderModel:`gas-rayleigh-transparent-pbr`,spectralSamples:u})}function So(e){return typeof e!=`string`||e.length===0?null:zr(e[0].toUpperCase()+e.slice(1).toLowerCase())??null}function Co(e){return 2*(2*e+1)}function wo(e){return`${e.n}${`spdfg`[e.l]??`l${e.l}`}`}function To(e){return Ur(e).some(e=>e.l>=2&&e.occupancy>0)}function Eo(e){let t=Ur(e).map(e=>({...e})),n=(e,n)=>{let r=Math.max(e,n+1);for(;t.some(e=>e.n===r&&e.l===n);)r+=1;t.push({n:r,l:n,occupancy:0})};for(let e of[...t])if(!(e.occupancy<=0||e.l<2))for(let t of[e.l-1,e.l+1])t<0||t>4||n(e.n+1,t);return t.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l)}function Do(e,t={}){if(!To(e))return[];let n=t.gridPointsN??900,r=t.rMaxBohr??42,i=t.maxScf??160,a=`${e}:${n}:${r}:${i}`;if(Fa.has(a))return Fa.get(a);let o=Hi(e,{scalarRelativistic:!0,configuration:Eo(e),gridPointsN:n,rMaxBohr:r,maxScf:i}),s=o.orbitals.filter(e=>e.occupancy>0),c=o.orbitals.filter(e=>e.occupancy<Co(e.l)),l=[];for(let e of s)if(!(e.l<2))for(let t of c){if(t.n===e.n&&t.l===e.l||Math.abs(t.l-e.l)!==1||t.energyHa<=e.energyHa)continue;let n=(t.energyHa-e.energyHa)*Aa;if(!(n>0)||n>12)continue;let r=t.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),i=Math.min(1,Math.max(0,e.occupancy/Co(e.l))),a=Math.min(1,Math.max(0,1-t.occupancy/Co(t.l))),o=e.l>=2?1:.35,s=i*a*r*o;s>0&&l.push({from:wo(e),to:wo(t),fromL:e.l,toL:t.l,occupancy:e.occupancy,targetOccupancy:t.occupancy,rawEnergyEv:n,strengthWeight:s})}let u=l.sort((e,t)=>e.rawEnergyEv-t.rawEnergyEv||t.strengthWeight-e.strengthWeight).slice(0,6);return Fa.set(a,u),u}function Oo(e){let t=Math.max(0,e)*529177210903e-22**3;if(!(t>0))return 0;let n=(3*Math.PI*Math.PI*t)**(1/3);return Math.sqrt(4*n/Math.PI)}function ko({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n={}}={}){if(!(e>0)||!(t>0))return[];let r=Oo(t),i=.5*Aa*r*r;return Do(e,n).map(e=>{let t=e.rawEnergyEv/Aa,n=Math.sqrt(1+(r/Math.sqrt(Math.max(t,1e-6)))**2),a=.06*i*Math.sqrt(Math.max(e.strengthWeight,0)),o=e.rawEnergyEv;return{...e,energyEv:o,thomasFermiScreeningRatio:n,electronGasEnergyEv:i,bandBroadeningEv:a,thomasFermiWavevectorBohr:r,dampingEv:Math.max(.22,.35*o+a)}}).filter(e=>e.energyEv>.15&&e.energyEv<8).sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight).slice(0,6)}const Ao=1602176634e-28;function jo(e){return Math.sqrt(e*Ao*Ao/(88541878128e-22*91093837015e-41))}function Mo(e,{plasmaEnergyEv:t,dampingEv:n,oscillators:r}){let i=[1,0];i=so(i,co([t*t,0],[e*e,e*n]));for(let n of r||[]){let r=.025*t*t*n.strengthWeight;i=oo(i,co([r,0],[n.energyEv*n.energyEv-e*e,-n.dampingEv*e]))}return i}function No(e,{atomicNumberZ:t=null,conductionElectronDensityPerM3:n,interbandOptions:r={},interbandOscillators:i=null}={}){let a=ja*jo(n),o=a/30,s=Array.isArray(i)?i:t?ko({atomicNumberZ:t,conductionElectronDensityPerM3:n,options:r}):[];return uo(Mo(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}))}function Po({atomicNumberZ:e=null,conductionElectronDensityPerM3:t,interbandOptions:n={},interbandOscillators:r=null}={}){if(!(t>0))return{r:.7,g:.7,b:.7,interbandOscillators:[]};let i=Array.isArray(r)?r:e?ko({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n}):[],a=Ga(r=>No(r,{atomicNumberZ:e,conductionElectronDensityPerM3:t,interbandOptions:n,interbandOscillators:i}));return{r:a.r,g:a.g,b:a.b,plasmaRadPerS:jo(t),interbandOscillators:i}}function Fo(e,{pathLengthM:t=.3,atomicNumberZ:n=null,interbandOptions:r={},interbandOscillators:i=null}={}){let a=ja*jo(e),o=a/30,s=Array.isArray(i)?i:n?ko({atomicNumberZ:n,conductionElectronDensityPerM3:e,options:r}):[],c=e=>Mo(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}),l=e=>uo(c(e)),u=Ka(e=>fo(e,c(e))),d=Ka(l),f=u*Math.max(0,t),p=no(f),m=Math.exp(-Math.min(80,f)),h=Ga(l),g=Ma.map(e=>po(e,c(e),t));return to({metalness:p>.5?1:p,roughness:.32,transmission:m,ior:null,opacity:p,attenuationColor:null,attenuationDistanceM:u>0?1/u:1/0,condensationScatter:0,internalScatter:0,opticalDepth:f,absorptionCoefficientPerM:u,reflectance:d,interbandOscillators:s,provenance:{status:`derived`,source:s.length?`scalar-relativistic-kohn-sham-drude-lorentz-skin-depth`:`drude-free-electron-skin-depth`,method:s.length?`conduction electron density + scalar-relativistic Kohn-Sham dipole-allowed interband transitions -> Drude-Lorentz complex index -> luminous skin-depth opacity`:`conduction electron density -> plasma frequency -> complex index -> luminous absorption coefficient -> Beer-Lambert opacity`,inputs:{atomicNumberZ:n,conductionElectronDensityPerM3:e,pathLengthM:t,damping:`omega_p/30`,oscillatorCount:s.length},validation:!1}},{baseColorSrgb:[h.r,h.g,h.b],renderModel:s.length?`conductor-drude-lorentz-relativistic-interband`:`conductor-drude-free-electron`,spectralSamples:g})}let Io=null;function Lo(){if(Io!=null)return Io;let e=e=>Pa([{Z:8,position:[0,0,0]},{Z:1,position:[0,0,e]}],2),t=1.83,n=.02,r=(e(1.85)-2*e(t)+e(t-n))/(n*n),i=529177210903e-22,a=r*43597447222071e-31/(i*i);return Io=Math.sqrt(Math.max(a,0)/(15.999*1.008/17.007*16605390666e-37))/(2*Math.PI*29979245800),Io}function Ro(e){let t=Lo(),n=1e7/e,r=.001;for(let e=2;e<=9;e+=1){let i=e*t*(1-.02*e),a=.06*i,o=(n-i)/a;r+=120*.12**e*Math.exp(-o*o)}return r}function zo({material:e,phase:t=`solid`,pathLengthM:n=3,conductionElectronDensityPerM3:r=null,properties:i=null}){if(t===`gas`&&i?.gasElectronicExcitationEv>0){let e=qo({properties:i,pathLengthM:Math.min(n,.3)});if(e?.baseColorSrgb){let[t,n,r]=e.baseColorSrgb;return{r:t,g:n,b:r}}}if(t!==`gas`&&t!==`plasma`){let t=_o(e,i);if(t)return go(t.symbol)}if(r>0){let t=Po({atomicNumberZ:So(e),conductionElectronDensityPerM3:r});return{r:t.r,g:t.g,b:t.b}}if(e===`h2o`){let e=0,n=0;for(let t=380;t<=780;t+=5){let r=Ha(t);e+=Ro(t)*r,n+=r}let r=e/n,i=(t===`gas`?.03:t===`solid`?.6:1)/r;return Ga(e=>Math.exp(-Ro(e)*i))}return e===`air`?Ga(e=>.85+.15*(450/e)**4):{r:.7,g:.7,b:.7}}const Bo=Object.freeze({waterLiquid:1.333,waterIce:1.309,waterVapor:1.00025});function Vo(){let e=0,t=0;for(let n=380;n<=780;n+=5){let r=Ha(n);e+=Ro(n)*r,t+=r}let n=e/t,r=n>0?1/n:1e3,i=Ga(e=>Math.exp(-Ro(e)*r));return{attenuationColor:[i.r,i.g,i.b],attenuationDistanceM:r}}function Ho(e,{properties:t,phase:n=`solid`}){let r=t?.electronicGapEv;if(!(r>=0))return null;let i=1239.841984/e;if(i<=r)return 0;let a=Za(t,n),o=t?.molarMassKgPerMol;if(!(a>0)||!(o>0))return null;let s=a/o*602214076e15,c=(1/s)**(2/3),l=Math.min(1,Math.max(0,(i-r)/Math.max(1,i)));return s*c*l}function Uo({properties:e,phase:t=`solid`,pathLengthM:n=.3}){if(Ho(500,{properties:e,phase:t})==null)return null;let r=n=>Ho(n,{properties:e,phase:t})??0,i=Ka(r),a=i*Math.max(0,n),o=no(a),s=Ga(e=>Math.exp(-r(e)*Math.max(0,n))),c=e?.intrinsicColorSrgb??[s.r,s.g,s.b],l=Ma.map(e=>yo(e,{absorptionCoefficientPerM:r(e),pathLengthM:n,reflectance:.04,n:1.4,k:0}));return to({metalness:0,roughness:.4,transmission:Math.exp(-Math.min(80,a)),ior:1.4,opacity:o,attenuationColor:e?.intrinsicColorSrgb??null,attenuationDistanceM:i>0?1/i:1/0,condensationScatter:0,internalScatter:0,opticalDepth:a,absorptionCoefficientPerM:i,provenance:{status:`derived`,source:`molecular-gap-geometric-absorption`,method:`electronic gap + formula density -> geometric oscillator absorption -> Beer-Lambert opacity`,inputs:{electronicGapEv:e?.electronicGapEv,pathLengthM:n,phase:t},validation:!1}},{baseColorSrgb:c,renderModel:`molecular-gap-pbr`,spectralSamples:l})}function Wo(e,{excitationEv:t,numberDensityPerM3:n,bandSigmaEv:r,oscillatorStrength:i}){if(!(t>0)||!(n>0))return 0;let a=1239.841984/e,o=r>0?r:t/6,s=i>0?i:.001,c=o*0xdbea32fbe840,l=2654e-9*s/(Math.sqrt(2*Math.PI)*c),u=a-t;return n*l*Math.exp(-(u*u)/(2*o*o))}const Go=1/(2*Math.sqrt(2*Math.LN2));function Ko(e,t){let n=t?.wavelengthNm,r=t?.crossSectionM2;if(!Array.isArray(n)||!Array.isArray(r)||n.length===0||n.length!==r.length)return null;let i=Number(e);if(!Number.isFinite(i))return null;if(i<=n[0])return Math.max(0,Number(r[0])||0);let a=n.length-1;if(i>=n[a])return Math.max(0,Number(r[a])||0);for(let e=1;e<n.length;e+=1){if(i>n[e])continue;let t=Number(n[e-1]),a=Number(n[e]),o=(i-t)/(a-t),s=Number(r[e-1])||0,c=Number(r[e])||0;return Math.max(0,s+(c-s)*o)}return Math.max(0,Number(r[a])||0)}function qo({properties:e,pathLengthM:t=.3}){let n=e?.gasElectronicExcitationEv;if(!(n>0))return null;let r=Za(e,`gas`),i=e?.molarMassKgPerMol;if(!(r>0)||!(i>0))return null;let a=r/i*602214076e15,o=e?.gasElectronicBandFwhmEv>0?e.gasElectronicBandFwhmEv*Go:null,s=e?.gasElectronicOscillatorStrength??null,c=e?.gasElectronicAbsorptionCrossSection||null,l=Ko(450,c)!=null,u=l?e=>a*Ko(e,c):e=>Wo(e,{excitationEv:n,numberDensityPerM3:a,bandSigmaEv:o,oscillatorStrength:s}),d=Ka(u),f=d*Math.max(0,t),p=no(f),m=Math.exp(-Math.min(80,f)),h=1.0005,g=Ga(e=>Math.exp(-u(e)*Math.max(.01,t))),_=Ma.map(e=>yo(e,{absorptionCoefficientPerM:u(e),pathLengthM:t,reflectance:((h-1)/2.0004999999999997)**2,n:h,k:0}));return to({metalness:0,roughness:1,transmission:m,ior:h,opacity:p,attenuationColor:[g.r,g.g,g.b],attenuationDistanceM:d>0?1/d:1/0,condensationScatter:0,internalScatter:0,opticalDepth:f,absorptionCoefficientPerM:d,provenance:{status:l?`reference-fallback`:`derived`,source:l?`measured-molecular-gas-absorption-cross-section`:`delta-scf-electronic-band-gas-absorption`,method:l?`measured wavelength-resolved molecular absorption cross section -> number-density extinction -> Beer-Lambert transmission and CIE color`:`electronic band centre (banked spectroscopic or ΔSCF) -> Gaussian Franck-Condon continuum (banked FWHM or E0/6) -> Thomas-Reiche-Kuhn cross-section (banked f or 1e-3 weak-continuum estimate) -> Beer-Lambert`,inputs:{gasElectronicExcitationEv:n,bandSigmaEv:o,oscillatorStrength:s,pathLengthM:t,numberDensityPerM3:a,absorptionCrossSectionDoi:l?c.doi:null,absorptionCrossSectionTemperatureK:l?c.temperatureK:null},validation:!1}},{baseColorSrgb:[g.r,g.g,g.b],renderModel:l?`molecular-gas-reference-cross-section-pbr`:`molecular-gas-electronic-band-absorption-pbr`,spectralSamples:_})}function Jo({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r=null,conductionElectronDensityPerM3:i=null,opticalState:a=null}={}){if(t!==`gas`&&t!==`plasma`){let i=_o(e,r);if(i)return vo(i,{phase:t,pathLengthM:n,marker:r.conductorOpticalConstants})}let o=i??r?.conductionElectronDensityPerM3??null;if(o>0)return Fo(o,{pathLengthM:n,atomicNumberZ:So(e),interbandOscillators:r?.opticalInterbandOscillators});if(e===`air`)return xo({phase:t,pathLengthM:n,properties:r});if(e===`h2o`||e===`steam`||e===`ice`){let r=e===`steam`||t===`gas`,i=e===`ice`||t===`solid`,o=r?Bo.waterVapor:i?Bo.waterIce:Bo.waterLiquid,s=((o-1)/(o+1))**2,c=Vo(),l=r?[1,1,1]:c.attenuationColor,u=r?c.attenuationDistanceM*50:c.attenuationDistanceM,d=1/u,f=d*Math.max(0,n),p=r?ao({...a||{},pathLengthM:n}):null,m=p?.scatteringCoefficientPerM||0,h=f+(p?.opticalDepth||0),g=Math.exp(-Math.min(80,h)),_=Math.min(1,Math.max(0,(1-s)*g)),v=no(h),y=r?m>0?1:.9:i?.5:.08,b=r?`gas`:i?`solid`:`liquid`,x=m>0?Ga(e=>io(e,{scatteringCoefficientPerM:m,dropletRadiusM:p?.dropletRadiusM})/Math.max(m,1e-30)):null,S=r?x?[x.r,x.g,x.b]:[1,1,1]:l,C=Ma.map(e=>yo(e,{absorptionCoefficientPerM:r?Ro(e)/50:Ro(e),pathLengthM:n,reflectance:s,scatteringCoefficientPerM:r?io(e,{scatteringCoefficientPerM:m,dropletRadiusM:p?.dropletRadiusM}):0,n:o,k:0}));return to({metalness:0,roughness:y,transmission:_,ior:o,opacity:v,attenuationColor:l,attenuationDistanceM:u,condensationScatter:m,internalScatter:m,scatteringCoefficientPerM:m,dropletMicrophysics:p,opticalDepth:h,absorptionCoefficientPerM:d,provenance:{status:`derived`,source:m>0?`clausius-clapeyron-condensed-droplet-mie-rayleigh-scattering`:`beer-lambert-oh-overtone-optical-depth`,method:m>0?`saturation vapor pressure -> excess vapor condensed fraction -> droplet number density -> Mie/Rayleigh extinction + O-H absorption`:`O-H overtone absorption -> luminous attenuation distance -> Beer-Lambert opacity/transmission`,inputs:{pathLengthM:n,phase:b,opticalState:a||null},validation:!1}},{baseColorSrgb:S,renderModel:r?m>0?`molecular-condensed-droplet-scattering-pbr`:`molecular-vapor-transparent-spectrum`:`molecular-transparent-beer-lambert-pbr`,spectralSamples:C})}if(t===`gas`){let e=qo({properties:r,pathLengthM:n});if(e)return e}return Uo({properties:r,phase:t,pathLengthM:n})||to({metalness:0,roughness:.4,transmission:0,ior:1.4,opacity:0,attenuationColor:null,attenuationDistanceM:1/0,condensationScatter:0,internalScatter:0,opticalDepth:null,absorptionCoefficientPerM:null,blocked:!0,provenance:{status:`blocked`,source:`missing-optical-closure`,method:`no conduction density, water absorption model, or electronic-gap opacity available`,inputs:{material:e,phase:t},validation:!1}},{baseColorSrgb:[0,0,0],renderModel:`blocked-missing-optical-closure`,vertexColorPolicy:`blocked`,spectralSamples:[]})}function Yo(e={}){let t=$a(e),n=Na.get(t);if(n)return eo(n);let r=Jo(e);return Na.set(t,eo(r)),eo(r)}function Xo(e,t){return e.debyeTemperatureK?ni(t,{debyeTemperatureK:e.debyeTemperatureK,molarMassKgPerMol:e.molarMassKgPerMol,atomsPerFormula:e.atomsPerFormula}):e.cpJPerKgK*t}function Zo(e,t){return Xo(e,t)-Xo(e,e.tLo)}function Qo(e,t){if(!e.debyeTemperatureK)return e.tLo+t/e.cpJPerKgK;let n=e.tLo,r=e.tHi;for(let i=0;i<80;i+=1){let i=.5*(n+r);Zo(e,i)<t?n=i:r=i}return .5*(n+r)}const $o=new WeakMap;function es(e){let t=$o.get(e);if(t)return t;let n=rs(e);return $o.set(e,n),n}function ts(e,t,n,r){let i=0;for(let e of t){let t=e/Math.max(r,1e-9);t<60&&(i+=e/(Math.exp(t)-1))}return e*r+8.314462618*i/n}function ns(e,t,n,r,i){let a=e.gasVibrationsCm1.map(e=>e*1.4387768766),o=e.gasRigidRotorCpJPerKgK,s=e=>ts(o,a,r,e),c=Math.min(n,Math.max(t+1,4e3)),l=[t];for(let e=1;e<=12;e+=1)l.push(t+(c-t)*e/12);n>c&&l.push(n);let u=[],d=i;for(let t=0;t<l.length-1;t+=1){let n=l[t],i=l[t+1],a=s(i)-s(n),o={type:`phase`,phase:e.name,tLo:n,tHi:i,cpJPerKgK:a/(i-n),debyeTemperatureK:null,molarMassKgPerMol:r,atomsPerFormula:1,gasVibrationalSubSegment:!0,eStart:d};d+=a,o.eEnd=d,u.push(o)}return u}function rs(e){let t=e.phases||[],n=e.transitions||[],r=e.molarMassKgPerMol,i=e.atomsPerFormula??1,a=[],o=0;for(let e=0;e<t.length;e+=1){let s=t[e],c=s.temperatureRange[0],l=e<n.length?n[e].temperatureK:s.temperatureRange[1];if(s.name===`gas`&&Array.isArray(s.gasVibrationsCm1)&&s.gasVibrationsCm1.length>0&&Number.isFinite(s.gasRigidRotorCpJPerKgK)&&s.gasRigidRotorCpJPerKgK>0&&Number.isFinite(r)&&r>0){let t=ns(s,c,l,r,o);if(a.push(...t),o=t[t.length-1].eEnd,e<n.length){let t=n[e],r=o;o+=t.latentHeatJPerKg,a.push({type:`plateau`,from:t.from,to:t.to,temperatureK:t.temperatureK,latentHeatJPerKg:t.latentHeatJPerKg,eStart:r,eEnd:o})}continue}let u={type:`phase`,phase:s.name,tLo:c,tHi:l,cpJPerKgK:s.cpJPerKgK,debyeTemperatureK:s.debyeTemperatureK||null,molarMassKgPerMol:r,atomsPerFormula:i,eStart:o};if(o+=Zo(u,l),u.eEnd=o,a.push(u),e<n.length){let t=n[e],r=o;o+=t.latentHeatJPerKg,a.push({type:`plateau`,from:t.from,to:t.to,temperatureK:t.temperatureK,latentHeatJPerKg:t.latentHeatJPerKg,eStart:r,eEnd:o})}}return a}function is(e,t){let n=Number(t);if(!Number.isFinite(n))throw TypeError(`temperatureK must be finite`);let r=es(e);for(let e of r)if(e.type===`phase`&&n<=e.tHi){let t=Math.max(n,e.tLo);return e.eStart+Zo(e,t)}let i=r[r.length-1];return i.type===`phase`?i.eStart+Zo(i,n):i.eEnd}function as(e,t){let n=Number(t);if(!Number.isFinite(n))throw TypeError(`specificEnergyJPerKg must be finite`);let r=es(e),i=r[0],a=r[r.length-1];if(n<=i.eStart)return i.phase||i.from||i.to||null;if(n>=a.eEnd)return a.type===`phase`?a.phase:a.to;for(let e of r)if(!(n<e.eStart||n>e.eEnd))return e.type===`phase`?e.phase:(e.latentHeatJPerKg>0?(n-e.eStart)/e.latentHeatJPerKg:0)>=.5?e.to:e.from;return a.type===`phase`?a.phase:a.to}const os=new WeakMap;function ss(e,t,n){if(!t||typeof t!=`object`&&typeof t!=`function`)return cs(e,n);let r=Number(n);if(!Number.isFinite(r))throw TypeError(`specificEnergyJPerKg must be finite`);let i=os.get(t);if(i&&i.properties===e&&i.specificEnergyJPerKg===r)return i.equilibrium;let a=cs(e,r);return os.set(t,{properties:e,specificEnergyJPerKg:r,equilibrium:a}),a}function cs(e,t){let n=Number(t);if(!Number.isFinite(n))throw TypeError(`specificEnergyJPerKg must be finite`);let r=es(e),i=r[0].eStart,a=r[r.length-1].eEnd;if(n<=i){let e=r[0];return{temperatureK:e.tLo,stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:n<i?`low`:null}}if(n>=a){let e=r[r.length-1];return e.type===`phase`?{temperatureK:Qo(e,n-e.eStart),stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:n>a?`high`:null}:{temperatureK:e.temperatureK,stablePhase:e.to,phaseFractions:{[e.to]:1},clamped:n>a?`high`:null}}for(let e of r){if(n<e.eStart||n>e.eEnd)continue;if(e.type===`phase`)return{temperatureK:Qo(e,n-e.eStart),stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:null};let t=e.latentHeatJPerKg>0?(n-e.eStart)/e.latentHeatJPerKg:0,r=1-t;return{temperatureK:e.temperatureK,stablePhase:t>=.5?e.to:e.from,phaseFractions:{[e.from]:r,[e.to]:t},clamped:null}}let o=r[r.length-1];return{temperatureK:o.type===`phase`?o.tHi:o.temperatureK,stablePhase:null,phaseFractions:{},clamped:null}}const ls={COMPUTE:globalThis.GPUShaderStage?.COMPUTE??4};function us(e,t=`read-only-storage`,n={}){return{binding:e,visibility:ls.COMPUTE,buffer:{type:t,...n}}}const ds=new WeakMap;function fs(e){let t=Error(e);return t.code=`ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED`,t}function ps({producerFamily:e=``}={}){let t=typeof e==`string`?e.trim():``;if(!t)throw fs(`queue-ordered cleanup claim issuer requires one fixed producer family`);let n=Object.freeze({schema:`peercompute.ulg.queue-ordered-cleanup-claim-issuer.v0`,status:`queue-ordered-cleanup-claim-issuer`});return ds.set(n,{producerFamily:t,registrations:new WeakMap}),n}const ms=4*1024*1024*1024-4,hs=`timestamp-query`;function gs(e){let t=Number(e);return Number.isFinite(t)&&t>0?t:0}function _s(e=null){let t=e?.limits||e||{},n=gs(t.maxStorageBuffersPerShaderStage),r=gs(t.maxBufferSize),i=gs(t.maxStorageBufferBindingSize),a={maxStorageBuffersPerShaderStage:12};return r>268435456&&(a.maxBufferSize=Math.min(r,ms)),i>134217728&&(a.maxStorageBufferBindingSize=Math.min(i,ms)),{requiredLimits:a,adapterLimits:{maxStorageBuffersPerShaderStage:n||null,maxBufferSize:r||null,maxStorageBufferBindingSize:i||null}}}function vs(e=null){let t=e?.features||e;if(!t)return[];try{return[...t].map(e=>String(e))}catch{return[]}}function ys(e=null,{timestampProfilingRequested:t=!1}={}){let n=vs(e),r=n.includes(hs);return{adapterFeatures:n,requiredFeatures:t&&r?[hs]:[],timestampProfilingRequested:t===!0,timestampQuerySupported:r,timestampQueryStatus:t?r?`timestamp-query-supported-and-requested`:`timestamp-query-unsupported-by-adapter`:r?`timestamp-query-supported-not-requested`:`timestamp-query-unsupported-not-requested`}}function bs(e=null,{timestampProfilingRequested:t=!1}={}){let{requiredLimits:n}=_s(e),{requiredFeatures:r}=ys(e,{timestampProfilingRequested:t}),i={};return Object.keys(n).length>0&&(i.requiredLimits=n),r.length>0&&(i.requiredFeatures=r),Object.keys(i).length>0?i:void 0}const xs=`peercompute.ulg.material-property-bank.warm-input.v0`,Ss=`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`,Cs=`peercompute.ulg.material-property-bank.particle-size-packing-table.v0`,J=Object.freeze([`materialId:f32`,`atomicNumber:f32`,`temperatureK:f32`,`pressurePa:f32`,`targetNeighborCount:f32`,`phaseCount:f32`,`baseColorSrgbR:f32`,`baseColorSrgbG:f32`,`baseColorSrgbB:f32`,`metalness:f32`,`roughness:f32`,`ior:f32`,`strictSourceOfTruth:f32`,`status:f32`,`pad0:f32`,`pad1:f32`]),ws=Object.freeze([`roleId:f32`,`materialId:f32`,`temperatureK:f32`,`pressurePa:f32`,`particlesPerEdge:f32`,`spacingM:f32`,`volumeEquivalentParticleRadiusM:f32`,`restVolumeM3:f32`,`densityKgPerM3:f32`,`targetNeighborCount:f32`,`smoothingLengthM:f32`,`strictSourceOfTruth:f32`,`status:f32`,`crystalPackingFraction:f32`,`crystalCoordinationNumber:f32`,`crystalAtomsPerConventionalCell:f32`]),Ts=Object.freeze({ready:1,missingRoleWarmInput:255}),Es=Object.freeze({drop:1,base:2}),Ds=new Set([`precomputed-json-bank`,`reference-fallback`,`reduced-estimate`,`exact-constant`]);function Y(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Os(e){return JSON.parse(JSON.stringify(e))}function ks(e){let t=e?.roles||{};return Object.entries(t).filter(([,e])=>e?.schema===xs).sort(([e],[t])=>String(e).localeCompare(String(t)))}function As(){return{schema:Ss,status:`material-bank-gpu-warm-input-table-empty`,rowLayout:[...J],rowStrideFloats:J.length,rowStrideBytes:J.length*Float32Array.BYTES_PER_ELEMENT,rows:new Float32Array,rowCount:0,metadata:[],strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function js(){return{schema:Cs,status:`material-bank-particle-size-packing-empty`,rowLayout:[...ws],rowStrideFloats:ws.length,rowStrideBytes:ws.length*Float32Array.BYTES_PER_ELEMENT,rows:new Float32Array,rowCount:0,metadata:[],strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Ms(e){if(typeof e!=`string`)return null;let t=e.trim();return/^[A-Za-z]{1,3}$/.test(t)?`${t[0].toUpperCase()}${t.slice(1).toLowerCase()}`:t||null}function Ns(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element.v0`)throw TypeError(`material property bank record has an unknown schema`);if(!Number.isInteger(e.atomicNumber)||e.atomicNumber<1||e.atomicNumber>118)throw RangeError(`material property bank record has invalid atomic number: ${e.atomicNumber}`);if(!Array.isArray(e.phases)||e.phases.length===0)throw Error(`${e.symbol||`element`} material property bank record has no phases`);if(!Array.isArray(e.provenance)||e.provenance.length===0)throw Error(`${e.symbol||`element`} material property bank record has no provenance`);for(let t of e.provenance){if(!Ds.has(t.status))throw Error(`${e.symbol} material property bank provenance has unknown status: ${t.status}`);for(let n of[`family`,`source`,`method`,`units`,`referenceState`])if(typeof t[n]!=`string`||t[n].length===0)throw Error(`${e.symbol} material property bank provenance missing ${n}`)}return!0}function Ps(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element-crystal-structure.v0`)throw TypeError(`material crystal structure record has an unknown schema`);if(Ms(e.symbol)!==e.symbol)throw Error(`material crystal structure record has invalid symbol: ${e.symbol}`);if(e.phase!==`solid`)throw Error(`${e.symbol} material crystal structure has unsupported phase: ${e.phase}`);if(typeof e.structureKey!=`string`||e.structureKey.length===0)throw Error(`${e.symbol} material crystal structure has no structureKey`);let t=e.latticeConstants||{};for(let n of[`aAngstrom`,`bAngstrom`,`cAngstrom`,`alphaDeg`,`betaDeg`,`gammaDeg`])if(!Number.isFinite(Number(t[n]))||Number(t[n])<=0)throw Error(`${e.symbol} material crystal structure has invalid lattice constant ${n}`);let n=e.unitCell||{};for(let t of[`atomsPerConventionalCell`,`densityKgPerM3`])if(!Number.isFinite(Number(n[t]))||Number(n[t])<=0)throw Error(`${e.symbol} material crystal structure has invalid unit-cell ${t}`);if(!Number.isFinite(Number(n.packingFraction))||n.packingFraction<=0||n.packingFraction>1)throw Error(`${e.symbol} material crystal structure has invalid packingFraction`);let r=e.validity||{};for(let t of[`temperatureRangeK`,`pressureRangePa`]){let n=r[t];if(!Array.isArray(n)||n.length!==2||!n.every(e=>Number.isFinite(Number(e))))throw Error(`${e.symbol} material crystal structure has invalid ${t}`);if(Number(n[0])>Number(n[1]))throw Error(`${e.symbol} material crystal structure has descending ${t}`)}if(!Array.isArray(e.provenance)||e.provenance.length===0)throw Error(`${e.symbol} material crystal structure has no provenance`);for(let t of e.provenance){if(!Ds.has(t.status))throw Error(`${e.symbol} material crystal structure provenance has unknown status: ${t.status}`);for(let n of[`family`,`source`,`method`,`units`,`referenceState`])if(typeof t[n]!=`string`||t[n].length===0)throw Error(`${e.symbol} material crystal structure provenance missing ${n}`)}return!0}function Fs(e){if(e?.schema!==`peercompute.ulg.material-property-bank.elements.v0`)throw TypeError(`material property bank has an unknown schema`);if(!Number.isInteger(e.schemaVersion))throw RangeError(`material property bank schemaVersion must be an integer`);if(e.schemaVersion!==1)throw RangeError(`unsupported material property bank schemaVersion: ${e.schemaVersion}`);let t=(e.records||[]).map(e=>(Ns(e),Os(e))),n=new Map,r=new Map;for(let e of t){if(n.has(e.symbol))throw Error(`duplicate material property bank symbol: ${e.symbol}`);if(r.has(e.atomicNumber))throw Error(`duplicate material property bank atomic number: ${e.atomicNumber}`);n.set(e.symbol,e),r.set(e.atomicNumber,e)}return{schema:e.schema,schemaVersion:e.schemaVersion,bankFamily:e.bankFamily,generatorFingerprint:e.generatorFingerprint,generatedAt:e.generatedAt||null,recordCount:t.length,records:t,bySymbol:n,byAtomicNumber:r,strictSourceOfTruth:!1,provenanceMode:`precomputed-json-bank-warm-input`}}function Is(e){if(e?.schema!==`peercompute.ulg.material-property-bank.element-crystal-structures.v0`)throw TypeError(`material crystal structure bank has an unknown schema`);if(!Number.isInteger(e.schemaVersion))throw RangeError(`material crystal structure bank schemaVersion must be an integer`);if(e.schemaVersion!==1)throw RangeError(`unsupported material crystal structure bank schemaVersion: ${e.schemaVersion}`);let t=(e.records||[]).map(e=>(Ps(e),Os(e))),n=new Map,r=new Map;for(let e of t){if(r.has(e.structureKey))throw Error(`duplicate material crystal structure key: ${e.structureKey}`);let t=Ms(e.symbol),i=n.get(t)||[];i.push(e),n.set(t,i),r.set(e.structureKey,e)}for(let e of n.values())e.sort((e,t)=>String(e.structureKey).localeCompare(String(t.structureKey)));return{schema:e.schema,schemaVersion:e.schemaVersion,bankFamily:e.bankFamily,generatorFingerprint:e.generatorFingerprint,generatedAt:e.generatedAt||null,recordCount:t.length,records:t,bySymbol:n,byStructureKey:r,strictSourceOfTruth:!1,provenanceMode:`precomputed-json-bank-crystal-warm-input`}}function Ls(e,t){let n=e?.bySymbol instanceof Map?e:Fs(e);return n.bySymbol.get(t)||n.bySymbol.get(Ms(t))||null}function Rs(e,t,{phase:n=null}={}){let r=(e?.bySymbol instanceof Map&&e?.byStructureKey instanceof Map?e:Is(e)).bySymbol.get(Ms(t))||[];return n?r.filter(e=>e.phase===n):r}function zs(e,{temperatureK:t=e?.referenceState?.temperatureK,pressurePa:n=e?.referenceState?.pressurePa,bankFamily:r=null,bankSchemaVersion:i=null,generatorFingerprint:a=null}={}){return Ns(e),{schema:xs,status:`material-property-bank-warm-input-ready`,strictSourceOfTruth:!1,material:e.symbol,atomicNumber:e.atomicNumber,schemaVersion:1,bankFamily:r,bankSchemaVersion:i,bankRecordSchema:e.schema,temperatureK:Y(t,e.referenceState.temperatureK),pressurePa:Y(n,e.referenceState.pressurePa),phaseCount:e.phases.length,targetNeighborCount:e.mechanics.targetNeighborCount,spacingPolicy:e.mechanics.spacingPolicy||null,pbr:Os(e.opticalPbr),provenance:{source:`precomputed-json-bank`,generatorFingerprint:a,entries:Os(e.provenance)}}}function Bs(e){if(e?.identityMode===`initial-bodies`||Array.isArray(e?.bodies))return Js({initialBodies:e.bodies,materialPropertyBankWarmInputs:e});let t=ks(e);if(t.length===0)return As();let n=[],r=[];for(let[e,i]of t){let t=i.pbr||{},a=Array.isArray(t.baseColorSrgb)?t.baseColorSrgb:[0,0,0];n.push(Y(i.atomicNumber),Y(i.atomicNumber),Y(i.temperatureK),Y(i.pressurePa),Y(i.targetNeighborCount),Y(i.phaseCount),Y(a[0]),Y(a[1]),Y(a[2]),Y(t.metalness),Y(t.roughness),t.ior==null?1:Y(t.ior,1),+(i.strictSourceOfTruth===!0),Ts.ready,0,0),r.push({role:e,material:i.material,requestedMaterial:i.requestedMaterial??null,materialId:i.atomicNumber,atomicNumber:i.atomicNumber,temperatureK:i.temperatureK,pressurePa:i.pressurePa,targetNeighborCount:i.targetNeighborCount,spacingPolicy:i.spacingPolicy??null,bankFamily:i.bankFamily??null,bankSchemaVersion:i.bankSchemaVersion??null,generatorFingerprint:i.provenance?.generatorFingerprint??null,strictSourceOfTruth:!1,status:`ready`})}return{schema:Ss,status:`material-bank-gpu-warm-input-table-ready`,rowLayout:[...J],rowStrideFloats:J.length,rowStrideBytes:J.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(n),rowCount:n.length/J.length,metadata:r,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Vs(e){if(Array.isArray(e?.bodies))return Ys({initialParticleSpacing:e});let t=e?.materialPropertyBankWarmInputs,n=ks(t);if(n.length===0)return js();let r=[],i=[],a=e?.materialPropertyCrystalStructureWarmInputs?.roles||{};for(let[t,o]of n){let n=e?.[t]||{},s=a[t]||null,c=s?.unitCell||{};r.push(Es[t]??0,Y(o.atomicNumber),Y(o.temperatureK),Y(o.pressurePa),Y(n.particlesPerEdge),Y(n.spacingM),Y(n.volumeEquivalentParticleRadiusM),Y(n.restVolumeM3),Y(n.densityKgPerM3),Y(o.targetNeighborCount),Y(e?.smoothingLengthM),+(o.strictSourceOfTruth===!0),Ts.ready,Y(c.packingFraction),Y(c.coordinationNumber),Y(c.atomsPerConventionalCell)),i.push({role:t,roleId:Es[t]??0,material:o.material,requestedMaterial:o.requestedMaterial??null,materialId:o.atomicNumber,particlesPerEdge:Y(n.particlesPerEdge),spacingM:Y(n.spacingM),volumeEquivalentParticleRadiusM:Y(n.volumeEquivalentParticleRadiusM),restVolumeM3:Y(n.restVolumeM3),densityKgPerM3:Y(n.densityKgPerM3),targetNeighborCount:o.targetNeighborCount,smoothingLengthM:Y(e?.smoothingLengthM),crystalStructureKey:s?.structureKey??null,crystalStructureStatus:s?.status??null,crystalPackingFraction:Y(c.packingFraction),crystalCoordinationNumber:Y(c.coordinationNumber),crystalAtomsPerConventionalCell:Y(c.atomsPerConventionalCell),strictSourceOfTruth:!1,status:`ready`})}return{schema:Cs,status:`material-bank-particle-size-packing-ready`,rowLayout:[...ws],rowStrideFloats:ws.length,rowStrideBytes:ws.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(r),rowCount:r.length/ws.length,metadata:i,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Hs(e,t=null){let n=Array.isArray(e)?e:Array.isArray(e?.bodies)?e.bodies:Array.isArray(t?.bodies)?t.bodies:[],r=new Set,i=new Set;return n.map((e,t)=>{let n=String(e?.id??e?.bodyId??``).trim(),a=Math.round(Y(e?.domainId,0));if(!n)throw TypeError(`initial body at index ${t} has no stable id`);if(!(a>0))throw RangeError(`initial body '${n}' has no positive domain id`);if(r.has(n))throw Error(`initial body id '${n}' is duplicated`);if(i.has(a))throw Error(`initial body domain id '${a}' is duplicated`);return r.add(n),i.add(a),{...e,id:n,domainId:a,bodyOrder:t,role:e?.legacyRole||n}})}function Us(e){let t=e?.byBodyId;return t instanceof Map?t:t&&typeof t==`object`?new Map(Object.entries(t)):new Map((e?.bodies||[]).map(e=>[String(e?.bodyId??e?.id??``).trim(),e]))}function Ws(e,t){let n=e?.byBodyId;if(n instanceof Map&&n.has(t.id))return n.get(t.id);if(n&&typeof n==`object`&&n[t.id])return n[t.id];if(Array.isArray(e?.bodies)){let n=e.bodies.find(e=>String(e?.bodyId??e?.id??``).trim()===t.id);if(n)return n.warmInput??n}let r=e?.roles;return r&&typeof r==`object`?r[t.id]??r[`body:${t.id}`]??(t.legacyRole?r[t.legacyRole]:null)??null:null}function Gs({body:e,plan:t,warmInputs:n}){let r=t?.materialPropertyBankWarmInput??Ws(n,e)??null;return r?.schema===`peercompute.ulg.material-property-bank.warm-input.v0`?r:null}function Ks({body:e,plan:t,crystalWarmInputs:n}){return t?.materialPropertyCrystalStructureWarmInput??Ws(n,e)??null}function qs(e){if(!Array.isArray(e)||e.length!==3)return Y(e,0);let t=e.reduce((e,t)=>e*Math.max(0,Y(t,0)),1);return t>0?Math.cbrt(t):0}function Js({initialBodies:e=null,initialParticleSpacing:t=null,materialPropertyBankWarmInputs:n=t?.materialPropertyBankWarmInputs??null}={}){let r=Hs(e,t),i=Us(t),a=r.map(e=>({body:e,warmInput:Gs({body:e,plan:i.get(e.id),warmInputs:n})})).filter(e=>e.warmInput);if(a.length===0)return As();let o=[],s=[];for(let{body:e,warmInput:t}of a){let n=t.pbr||{},r=Array.isArray(n.baseColorSrgb)?n.baseColorSrgb:[0,0,0];o.push(Y(t.atomicNumber),Y(t.atomicNumber),Y(t.temperatureK),Y(t.pressurePa),Y(t.targetNeighborCount),Y(t.phaseCount),Y(r[0]),Y(r[1]),Y(r[2]),Y(n.metalness),Y(n.roughness),n.ior==null?1:Y(n.ior,1),+(t.strictSourceOfTruth===!0),Ts.ready,0,0),s.push({role:e.role,bodyId:e.id,domainId:e.domainId,bodyOrder:e.bodyOrder,material:t.material,requestedMaterial:t.requestedMaterial??e.material??null,materialId:t.atomicNumber,atomicNumber:t.atomicNumber,temperatureK:t.temperatureK,pressurePa:t.pressurePa,targetNeighborCount:t.targetNeighborCount,spacingPolicy:t.spacingPolicy??null,bankFamily:t.bankFamily??null,bankSchemaVersion:t.bankSchemaVersion??null,generatorFingerprint:t.provenance?.generatorFingerprint??null,identityAuthority:`initial-body-domain-id`,strictSourceOfTruth:!1,status:`ready`})}return{schema:Ss,status:`material-bank-gpu-warm-input-table-ready`,rowLayout:[...J],rowStrideFloats:J.length,rowStrideBytes:J.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(o),rowCount:o.length/J.length,metadata:s,identityMode:`initial-bodies`,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Ys({initialBodies:e=null,initialParticleSpacing:t=null,materialPropertyBankWarmInputs:n=t?.materialPropertyBankWarmInputs??null,materialPropertyCrystalStructureWarmInputs:r=t?.materialPropertyCrystalStructureWarmInputs??null}={}){let i=Hs(e,t),a=Us(t),o=i.map(e=>{let t=a.get(e.id);if(!t)throw Error(`initial body '${e.id}' has no particle plan`);return{body:e,plan:t,warmInput:Gs({body:e,plan:t,warmInputs:n}),crystalWarmInput:Ks({body:e,plan:t,crystalWarmInputs:r})}}).filter(e=>e.warmInput);if(o.length===0)return js();let s=[],c=[];for(let{body:e,plan:n,warmInput:r,crystalWarmInput:i}of o){let a=i?.unitCell||{},o=Array.isArray(n.particlesPerEdge)?n.particlesPerEdge.map(e=>Math.max(0,Math.round(Y(e,0)))):[Y(n.particlesPerEdge,0)],l=Array.isArray(n.spacingByAxisM)?n.spacingByAxisM.map(e=>Y(e,0)):[],u=Y(n.representativeCellPitchM??n.spacingM,0),d=Y(n.volumeEquivalentParticleRadiusM??n.visualParticleRadiusM,0),f=Y(n.targetNeighborCount,Y(r.targetNeighborCount,0)),p=Y(t?.smoothingLengthM,Y(n.targetSmoothingLengthM,0));s.push(e.domainId,Y(r.atomicNumber),Y(r.temperatureK,n.temperatureK),Y(r.pressurePa,n.pressurePa),qs(o),u,d,Y(n.restVolumeM3??n.visualRestVolumeM3),Y(n.densityKgPerM3),f,p,+(r.strictSourceOfTruth===!0),Ts.ready,Y(a.packingFraction),Y(a.coordinationNumber),Y(a.atomsPerConventionalCell)),c.push({role:e.role,roleId:e.domainId,bodyId:e.id,domainId:e.domainId,bodyOrder:e.bodyOrder,material:r.material,requestedMaterial:r.requestedMaterial??e.material??null,materialId:r.atomicNumber,particlesPerEdge:o,representativeParticlesPerEdge:qs(o),particleCount:Y(n.particleCount),spacingM:u,spacingByAxisM:l,volumeEquivalentParticleRadiusM:d,restVolumeM3:Y(n.restVolumeM3??n.visualRestVolumeM3),mechanicsRestVolumeM3:Y(n.mechanicsRestVolumeM3,n.continuumCellVolumeM3),densityKgPerM3:Y(n.densityKgPerM3),targetNeighborCount:f,smoothingLengthM:p,crystalStructureKey:i?.structureKey??null,crystalStructureStatus:i?.status??null,crystalPackingFraction:Y(a.packingFraction),crystalCoordinationNumber:Y(a.coordinationNumber),crystalAtomsPerConventionalCell:Y(a.atomsPerConventionalCell),identityAuthority:`initial-body-domain-id`,strictSourceOfTruth:!1,status:`ready`})}return{schema:Cs,status:`material-bank-particle-size-packing-ready`,rowLayout:[...ws],rowStrideFloats:ws.length,rowStrideBytes:ws.length*Float32Array.BYTES_PER_ELEMENT,rows:Float32Array.from(s),rowCount:s.length/ws.length,metadata:c,identityMode:`initial-bodies`,strictSourceOfTruth:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}const Xs=In.length,Zs=Ln.length;Rn.length,zn.length;const Qs=In,$s=Ln;new Float32Array(Zs),globalThis.GPUBufferUsage?.MAP_READ,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,globalThis.GPUMapMode?.READ;const ec=Object.freeze({unknown:0,solid:1,liquid:2,gas:3,plasma:4}),tc=Object.freeze({"material-pbr":1,"particle-diagnostic":2,blocked:255}),nc=Object.freeze({"conductor-drude-lorentz-relativistic-interband":1,"molecular-transparent-beer-lambert-pbr":2,"molecular-vapor-transparent-spectrum":3,"molecular-gap-pbr":4,"rayleigh-gas-transparent-spectrum":5,"conductor-drude-free-electron":6,"molecular-condensed-droplet-scattering-pbr":7,"conductor-reference-complex-index":8,"molecular-gas-reference-cross-section-pbr":9,"molecular-gas-electronic-band-absorption-pbr":10,"blocked-missing-optical-closure":255});function X(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function rc(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function ic(e){let t=Math.max(0,Math.min(1,X(e)));return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function ac(e,t=[0,0,0]){let n=Array.isArray(e)?e:t;return[ic(n[0]),ic(n[1]),ic(n[2])]}function oc(e){return ec[e]??ec.unknown}function sc(e,t){return e[t]??0}function cc(e){return typeof e==`string`?e:e?.material||e?.renderKey||null}function lc(e){return typeof e!=`string`||e.length===0?null:`${e[0].toUpperCase()}${e.slice(1).toLowerCase()}`}function uc(e){let t=2166136261;for(let n of String(e))t^=n.charCodeAt(0),t=Math.imul(t,16777619)>>>0;return 1e3+t%8e6}function dc(e){let t=Number(e);return Number.isFinite(t)?t.toPrecision(10):String(e??`null`)}function fc(e){if(!e||typeof e!=`object`)return`default`;let t=Object.keys(e).filter(t=>e[t]!=null).sort().map(t=>{let n=e[t];return n&&typeof n==`object`?`${t}:{${fc(n)}}`:`${t}:${dc(n)}`});return t.length>0?t.join(`|`):`default`}function pc(e){let t=fc(e);return t==="default"?0:uc(`optical-state:${t}`)}function mc(e){let t=lc(e);return(t?zr(t):null)??uc(String(e||`unknown`).toLowerCase())}function hc(e){return typeof e==`string`?`unknown`:e?.phase||`unknown`}function gc(e){return typeof e==`object`&&e&&e.opticalState||null}function _c(e,t=gc(e)){let n=typeof e==`object`&&e?Number(e.opticalStateId):NaN;return Number.isFinite(n)?n:pc(t)}function vc(e){return[X(e?.wavelengthNm),X(e?.reflectance),X(e?.transmittance),X(e?.absorptionCoefficientPerM),X(e?.scatteringCoefficientPerM),X(e?.n),X(e?.k),0]}function yc(e,t){if(t.length!==Xs)throw Error(`Optical GPU record must be ${Xs} floats`);e.push(...t)}function bc(e){return J.findIndex(t=>String(t).split(`:`)[0]===e)}const xc=Object.freeze({materialId:bc(`materialId`),baseColorSrgbR:bc(`baseColorSrgbR`),baseColorSrgbG:bc(`baseColorSrgbG`),baseColorSrgbB:bc(`baseColorSrgbB`),metalness:bc(`metalness`),roughness:bc(`roughness`),ior:bc(`ior`),strictSourceOfTruth:bc(`strictSourceOfTruth`),status:bc(`status`)});function Sc(e,t,n,r=0){let i=xc[n];return i>=0?X(e[t+i],r):r}function Cc(e=null){let t=new Map,n=new Map;if(e?.schema!==`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`)return{byMaterialId:t,byMaterialKey:n,sourceRowCount:0};let r=e.rows instanceof Float32Array?e.rows:new Float32Array,i=Math.max(1,Math.round(X(e.rowStrideFloats,J.length))),a=Math.max(0,Math.min(Math.round(X(e.rowCount,0)),Math.floor(r.length/i)));for(let o=0;o<a;o+=1){let a=o*i,s=e.metadata?.[o]||{},c=Sc(r,a,`status`,s.status===`ready`?Ts.ready:0);if(Math.round(c)!==Ts.ready)continue;let l=Sc(r,a,`materialId`,s.materialId),u={schema:`peercompute.ulg.optical-material-bank-pbr-warm-input-row.v0`,status:`ready`,rowIndex:o,role:s.role??null,material:s.material??null,requestedMaterial:s.requestedMaterial??null,materialId:l,atomicNumber:s.atomicNumber??l,temperatureK:s.temperatureK??null,pressurePa:s.pressurePa??null,baseColorSrgb:[Sc(r,a,`baseColorSrgbR`),Sc(r,a,`baseColorSrgbG`),Sc(r,a,`baseColorSrgbB`)],metalness:Sc(r,a,`metalness`),roughness:Sc(r,a,`roughness`),ior:Sc(r,a,`ior`,1),strictSourceOfTruth:Sc(r,a,`strictSourceOfTruth`)===1,bankFamily:s.bankFamily??null,bankSchemaVersion:s.bankSchemaVersion??null,generatorFingerprint:s.generatorFingerprint??null};Number.isFinite(l)&&t.set(l,u);for(let e of[s.material,s.requestedMaterial]){let t=String(e||``).toLowerCase();t&&n.set(t,u)}}return{byMaterialId:t,byMaterialKey:n,sourceRowCount:a}}function wc({material:e,materialId:t},n){return n.byMaterialId.get(t)||n.byMaterialKey.get(String(e||``).toLowerCase())||null}function Tc(e){if(!Array.isArray(e)||e.length<3)return null;let t=e.slice(0,3).map(e=>X(e,NaN));return t.every(Number.isFinite)?t.map(e=>Math.max(0,Math.min(1,e))):null}function Ec(e,t=null){let n=Tc(e.baseColorSrgb)||[1,1,1],r=e.ior==null?1:X(e.ior,1);return{source:`closure-derived-optical-pbr`,baseColorSrgb:n,metalness:X(e.metalness),roughness:X(e.roughness,.5),ior:r,closureBaseColorSrgb:n,closureMetalness:X(e.metalness),closureRoughness:X(e.roughness,.5),closureIor:e.ior==null?1:X(e.ior,1)}}function Dc({table:e=null,matchedRecordCount:t=0}={}){let n=e?.schema===`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`?Math.max(0,Math.round(X(e.rowCount,0))):0,r=Math.max(0,Math.round(X(t,0)));return{schema:`peercompute.ulg.optical-material-bank-pbr-warm-input-consumer.v0`,status:n<=0?`no-material-bank-pbr-warm-input-table`:r>0?`optical-gpu-table-annotated-with-material-bank-pbr-warm-inputs`:`material-bank-pbr-warm-inputs-not-matched-to-optical-records`,sourceSchema:e?.schema??null,sourceRowCount:n,matchedRecordCount:r,consumer:`optical-gpu-table`,consumedAs:r>0?`non-authoritative-pbr-warm-input-metadata-only-alongside-closure-derived-optical-rows`:`non-authoritative-pbr-warm-input-metadata-before-closure-derived-optical-rows`,strictSourceOfTruth:!1,shaderBound:!1,scientificValidation:!1,materialValidation:!1,fullPhysicsValidation:!1}}function Oc(e,{materialProperties:t={},pathLengthM:n=.25,materialPropertyBankGpuWarmInputTable:r=null}={}){if(!Array.isArray(e))throw TypeError(`buildOpticalGpuTable requires an array of material/phase descriptors`);let i=[],a=[],o=[],s=new Map,c=new Map,l=Cc(r),u=0,d=e=>(s.has(e)||s.set(e,mc(e)),s.get(e));for(let r of e){let e=cc(r);if(!e)continue;let s=hc(r),f=gc(r),p=fc(f),m=Number(r?.pathLengthM),h=Number.isFinite(m)&&m>0?m:n,g=_c(r,f),_=`${e}|${s}|${g}`,v=c.get(_);if(v!=null){if(v.opticalStateKey!==p)throw Error(`conflicting optical states share GPU binding ${_}; assign distinct stable opticalStateId values`);if(v.pathLengthM!==h)throw Error(`conflicting optical path lengths share GPU binding ${_}; assign distinct stable opticalStateId values`);continue}c.set(_,{opticalStateKey:p,pathLengthM:h});let y=Yo({material:e,phase:s,properties:typeof r==`object`&&r?.properties?r.properties:t[e],pathLengthM:h,opticalState:f}),b=d(e),x=wc({material:e,materialId:b},l);x&&(u+=1);let S=Ec(y,x),C=a.length/Zs;for(let e of y.spectralSamples||[])a.push(...vc(e));let w=a.length/Zs-C,T=ac(S.baseColorSrgb),ee=ac(y.attenuationColor,[1,1,1]),te=Math.max(X(y.scatteringCoefficientPerM),X(y.condensationScatter),X(y.internalScatter));yc(i,[b,oc(s),C,w,T[0],T[1],T[2],X(S.metalness),X(S.roughness),X(y.transmission),X(y.opacity),X(S.ior,1),ee[0],ee[1],ee[2],rc(y.attenuationDistanceM,0x56bc75e2d63100000),X(y.absorptionCoefficientPerM),te,sc(nc,y.renderModel),sc(tc,y.vertexColorPolicy),X(y.opticalDepth),+!!y.blocked,y.provenance?.status===`blocked`?255:1,g]),o.push({material:e,phase:s,opticalState:f?{...f}:null,opticalStateKey:p,opticalStateId:g,pathLengthM:h,pathLengthSource:Number.isFinite(m)&&m>0?r?.pathLengthSource||`descriptor`:`table-default`,materialId:b,phaseId:oc(s),recordIndex:o.length,spectralOffset:C,spectralCount:w,renderModel:y.renderModel,renderModelId:sc(nc,y.renderModel),vertexColorPolicy:y.vertexColorPolicy,vertexColorPolicyId:sc(tc,y.vertexColorPolicy),blocked:y.blocked===!0,provenance:y.provenance||null,baseColorSrgb:[...S.baseColorSrgb],closureBaseColorSrgb:[...S.closureBaseColorSrgb],displayPbrSource:S.source,displayPbr:{source:S.source,baseColorSrgb:[...S.baseColorSrgb],metalness:S.metalness,roughness:S.roughness,ior:S.ior},closurePbr:{baseColorSrgb:[...S.closureBaseColorSrgb],metalness:S.closureMetalness,roughness:S.closureRoughness,ior:S.closureIor},materialPropertyBankPbrWarmInput:x,materialPropertyBankPbrWarmInputStatus:x?`material-bank-pbr-warm-input-attached`:`no-material-bank-pbr-warm-input`})}let f=Dc({table:r,matchedRecordCount:u}),p=r?.schema===`peercompute.ulg.material-property-bank.gpu-warm-input-table.v0`&&r.rows instanceof Float32Array?new Float32Array(r.rows):new Float32Array,m=Math.max(0,Math.round(X(r?.rowStrideFloats,J.length)));return{schema:`peercompute.ulg.optical-gpu-table.v0`,status:`cpu-derived-gpu-buffer-ready`,recordLayout:[...Qs],spectralSampleLayout:[...$s],recordStrideFloats:Xs,spectralSampleStrideFloats:Zs,recordStrideBytes:Xs*Float32Array.BYTES_PER_ELEMENT,spectralSampleStrideBytes:Zs*Float32Array.BYTES_PER_ELEMENT,wgslStructs:`
struct OpticalMaterialRecord {
  material_id: f32,
  phase_id: f32,
  spectral_offset: f32,
  spectral_count: f32,
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  render_model_id: f32,
  vertex_color_policy_id: f32,
  optical_depth: f32,
  blocked: f32,
  status: f32,
  optical_state_id: f32,
};

struct OpticalSpectralSample {
  wavelength_nm: f32,
  reflectance: f32,
  transmittance: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  n: f32,
  k: f32,
  pad0: f32,
};
`,records:Float32Array.from(i),spectralSamples:Float32Array.from(a),recordCount:o.length,spectralSampleCount:a.length/Zs,materialPropertyBankPbrWarmInputConsumer:f,materialPropertyBankPbrWarmInputRowCount:f.sourceRowCount,materialPropertyBankPbrWarmInputRows:p,materialPropertyBankPbrWarmInputRowStrideFloats:m,materialPropertyBankPbrWarmInputMatchedRecordCount:f.matchedRecordCount,materialMap:[...s.entries()].map(([e,t])=>({material:e,materialId:t})),recordMetadata:o,colorSpace:`linear-rgb-from-display-pbr-srgb`,scientificValidation:!1,fullPhysicsValidation:!1}}const kc=`peercompute.ulg.algorithm-material-particle-initialization-rows.v0`,Ac=`peercompute.ulg.algorithm-material-particle-initialization-row.v0`,jc=`peercompute.ulg.algorithm-material-mls-mpm-mechanics-rows.v0`,Mc=`peercompute.ulg.algorithm-material-mls-mpm-mechanics-row.v0`,Nc=`peercompute.ulg.algorithm-material-contact-rows.v0`,Pc=`peercompute.ulg.algorithm-material-contact-row.v0`;function Z(e,t=0){let n=Number(e);if(Number.isFinite(n))return n;let r=Number(t);return Number.isFinite(r)?r:0}function Fc(e,t){let n=Z(e,0),r=Z(t,0);return!(n>0)||!(r>0)?0:n*Math.cbrt(3*r/(4*Math.PI))}function Ic(e,t){return e?.roles?.[t]||null}function Lc(e,t){return e?.roles?.[t]||null}function Rc({initialParticleSpacing:e=null,dropMaterial:t=null,baseMaterial:n=null,dropTemperatureK:r=null,baseTemperatureK:i=null}={}){let a=e||{},o=a.materialPropertyBankWarmInputs||null,s=a.materialPropertyCrystalStructureWarmInputs||null,c=[{role:`drop`,requestedMaterial:t,temperatureK:r},{role:`base`,requestedMaterial:n,temperatureK:i}],l=[];for(let e of c){let t=a[e.role];if(!t)continue;let n=Ic(o,e.role),r=Lc(s,e.role),i=r?.unitCell||{},c=Z(i.packingFraction,0),u=Fc(t.spacingM,c);l.push({schema:Ac,status:`algorithm-derived-particle-initialization-row-ready`,role:e.role,requestedMaterial:e.requestedMaterial,material:n?.material??e.requestedMaterial??null,materialId:Z(n?.atomicNumber,0),temperatureK:Z(n?.temperatureK,e.temperatureK),pressurePa:Z(n?.pressurePa??t.pressurePa,0),densityKgPerM3:Z(t.densityKgPerM3,0),particlesPerEdge:Z(t.particlesPerEdge,0),spacingM:Z(t.spacingM,0),restVolumeM3:Z(t.restVolumeM3,0),mechanicsRestVolumeM3:Z(t.mechanicsRestVolumeM3,t.continuumCellVolumeM3),volumeEquivalentParticleRadiusM:Z(t.volumeEquivalentParticleRadiusM,0),pressureAdjustedParticleRadiusM:Z(t.pressureAdjustedParticleRadiusM,0),targetSmoothingLengthM:Z(t.targetSmoothingLengthM,0),globalSmoothingLengthM:Z(t.globalSmoothingLengthM,0),targetNeighborCount:Z(t.targetNeighborCount??a.targetNeighborCount,0),estimatedNeighborCount:Z(t.estimatedNeighborCount,0),crystalStructureKey:r?.structureKey??null,crystalStructureStatus:r?.status??null,crystalPackingFraction:c,crystalCoordinationNumber:Z(i.coordinationNumber,0),crystalAtomsPerConventionalCell:Z(i.atomsPerConventionalCell,0),crystalPackingParticleRadiusM:u,particleRadiusPolicy:r?`global-particle-volume-authoritative-crystal-packing-diagnostic`:`global-particle-volume-authoritative`,appliedParticleRadiusM:Z(t.volumeEquivalentParticleRadiusM,0),strictSourceOfTruth:!1,provenance:{source:`algorithm-derived-material-row`,materialBankGeneratorFingerprint:o?.generatorFingerprint??null,crystalBankGeneratorFingerprint:s?.generatorFingerprint??null,materialWarmInputStatus:n?.status??null,crystalWarmInputStatus:r?.status??null}})}return{schema:kc,status:l.length>0?`algorithm-derived-particle-initialization-rows-ready`:`algorithm-derived-particle-initialization-rows-empty`,sourceSchema:a.schema??null,rowCount:l.length,rows:l,strictSourceOfTruth:!1,derivationAuthority:`fundamental-closures-with-versioned-warm-inputs`,cacheKeyParts:{sourceSchema:a.schema??null,targetNeighborCount:Z(a.targetNeighborCount,0),materialBankGeneratorFingerprint:o?.generatorFingerprint??null,crystalBankGeneratorFingerprint:s?.generatorFingerprint??null,roles:l.map(e=>({role:e.role,material:e.material,temperatureK:e.temperatureK,pressurePa:e.pressurePa,crystalStructureKey:e.crystalStructureKey}))}}}function zc(e,t=null){let n=Array.isArray(e)?e:Array.isArray(e?.bodies)?e.bodies:Array.isArray(t?.bodies)?t.bodies:[],r=new Set,i=new Set;return n.map((e,t)=>{let n=String(e?.id??e?.bodyId??``).trim();if(!n)throw TypeError(`initial body at index ${t} has no stable id`);if(r.has(n))throw Error(`initial body id '${n}' is duplicated`);r.add(n);let a=Math.round(Z(e?.domainId,0));if(!(a>0))throw RangeError(`initial body '${n}' has no positive domain id`);if(i.has(a))throw Error(`initial body domain id '${a}' is duplicated`);return i.add(a),{...e,id:n,domainId:a,bodyOrder:t}})}function Bc(e,t){if(e instanceof Map)return e;let n=e??t?.byBodyId??t?.bodies??null;return n instanceof Map?n:Array.isArray(n)?new Map(n.map(e=>[String(e?.bodyId??e?.id??``).trim(),e])):n&&typeof n==`object`?new Map(Object.entries(n)):new Map}function Vc(e,t){let n=e?.byBodyId;if(n instanceof Map&&n.has(t.id))return n.get(t.id);if(n&&typeof n==`object`&&n[t.id])return n[t.id];if(Array.isArray(e?.bodies)){let n=e.bodies.find(e=>String(e?.bodyId??e?.id??``).trim()===t.id);if(n)return n.warmInput??n}let r=e?.roles;return r&&typeof r==`object`?r[t.id]??r[`body:${t.id}`]??(t.legacyRole?r[t.legacyRole]:null)??null:null}function Hc(e,t,n){return n?.materialPropertyBankWarmInput??Vc(e,t)??null}function Uc(e,t,n){return n?.materialPropertyCrystalStructureWarmInput??Vc(e,t)??null}function Wc(e){return e.legacyRole||e.id}function Gc({initialBodies:e=null,bodyPlans:t=null,initialParticleSpacing:n=null}={}){let r=n||{},i=zc(e,r),a=Bc(t,r),o=r.materialPropertyBankWarmInputs||null,s=r.materialPropertyCrystalStructureWarmInputs||null,c=i.map(e=>{let t=a.get(e.id);if(!t)throw Error(`initial body '${e.id}' has no particle plan`);let n=String(t.bodyId??t.id??e.id).trim();if(n!==e.id)throw Error(`particle plan '${n}' does not match initial body '${e.id}'`);let i=Hc(o,e,t),c=Uc(s,e,t),l=c?.unitCell||{},u=Z(l.packingFraction,0),d=Z(t.representativeCellPitchM??t.spacingM,0),f=Array.isArray(t.particlesPerEdge)?t.particlesPerEdge.map(e=>Math.max(0,Math.round(Z(e,0)))):[],p=Array.isArray(t.spacingByAxisM)?t.spacingByAxisM.map(e=>Z(e,0)):[],m=Z(t.volumeEquivalentParticleRadiusM??t.visualParticleRadiusM,0),h=Z(t.targetSmoothingLengthM??r.smoothingLengthM,0);return{schema:Ac,status:`algorithm-derived-particle-initialization-row-ready`,role:Wc(e),bodyId:e.id,domainId:e.domainId,bodyOrder:e.bodyOrder,requestedMaterial:e.material??t.material??null,material:i?.material??t.material??e.material??null,materialId:Z(i?.atomicNumber,0),phase:t.phase??null,temperatureK:Z(i?.temperatureK,t.temperatureK??e.temperatureK),pressurePa:Z(i?.pressurePa,t.pressurePa),densityKgPerM3:Z(t.densityKgPerM3,0),particlesPerEdge:f,particlesPerAxis:f,particleCount:Z(t.particleCount,f.length===3?f[0]*f[1]*f[2]:0),spacingM:d,spacingByAxisM:p,restVolumeM3:Z(t.restVolumeM3??t.visualRestVolumeM3,0),mechanicsRestVolumeM3:Z(t.mechanicsRestVolumeM3,t.continuumCellVolumeM3),volumeEquivalentParticleRadiusM:m,pressureAdjustedParticleRadiusM:Z(t.pressureAdjustedParticleRadiusM,m),targetSmoothingLengthM:h,globalSmoothingLengthM:Z(r.smoothingLengthM,h),targetNeighborCount:Z(t.targetNeighborCount??r.targetNeighborCount??i?.targetNeighborCount,0),estimatedNeighborCount:Z(t.estimatedNeighborCount,0),crystalStructureKey:c?.structureKey??null,crystalStructureStatus:c?.status??null,crystalPackingFraction:u,crystalCoordinationNumber:Z(l.coordinationNumber,0),crystalAtomsPerConventionalCell:Z(l.atomsPerConventionalCell,0),crystalPackingParticleRadiusM:Fc(d,u),particleRadiusPolicy:c?`global-particle-volume-authoritative-crystal-packing-diagnostic`:`global-particle-volume-authoritative`,appliedParticleRadiusM:m,strictSourceOfTruth:!1,provenance:{source:`algorithm-derived-initial-body-material-row`,materialBankGeneratorFingerprint:o?.generatorFingerprint??null,crystalBankGeneratorFingerprint:s?.generatorFingerprint??null,materialWarmInputStatus:i?.status??null,crystalWarmInputStatus:c?.status??null}}});return{schema:kc,status:c.length>0?`algorithm-derived-particle-initialization-rows-ready`:`algorithm-derived-particle-initialization-rows-empty`,sourceSchema:r.schema??null,rowCount:c.length,rows:c,identityMode:`initial-bodies`,strictSourceOfTruth:!1,derivationAuthority:`fundamental-closures-with-versioned-warm-inputs`,cacheKeyParts:{sourceSchema:r.schema??null,targetNeighborCount:Z(r.targetNeighborCount,0),materialBankGeneratorFingerprint:o?.generatorFingerprint??null,crystalBankGeneratorFingerprint:s?.generatorFingerprint??null,bodies:c.map(e=>({bodyId:e.bodyId,domainId:e.domainId,bodyOrder:e.bodyOrder,role:e.role,material:e.material,temperatureK:e.temperatureK,pressurePa:e.pressurePa,particlesPerAxis:[...e.particlesPerAxis],spacingByAxisM:[...e.spacingByAxisM],crystalStructureKey:e.crystalStructureKey}))}}}function Kc(e){let t=new Map;for(let n of e?.rows||[])n?.role&&t.set(n.role,n);return t}function qc(e){let t=new Map;for(let n of e?.rows||[])n?.bodyId!=null&&t.set(String(n.bodyId),n);return t}function Jc({role:e,material:t,phase:n,initializationRow:r}){return{role:e,material:t,phase:n,initializationRow:r,particleCount:0,solidParticleCount:0,restVolumeM3Sum:0,effectiveBulkModulusPaSum:0,shearModulusPaSum:0,lameLambdaPaSum:0,soundSpeedMPerSSum:0,dynamicViscosityPaSSum:0,surfaceTensionNPerMSum:0,maxHydrostaticPressurePa:0}}function Yc({role:e,bodyId:t,domainId:n,bodyOrder:r,material:i,phase:a,initializationRow:o}){return{...Jc({role:e,material:i,phase:a,initializationRow:o}),bodyId:t,domainId:n,bodyOrder:r}}function Xc(e,{particle:t,meta:n,mechanics:r,offset:i}){e.particleCount+=1,e.solidParticleCount+=+(Z(r?.[i+20],+!!n.solid)>.5),e.restVolumeM3Sum+=Z(r?.[i+19],0),e.effectiveBulkModulusPaSum+=Z(r?.[i+22],n.effectiveBulkModulusPa),e.shearModulusPaSum+=Z(r?.[i+23],n.shearModulusPa),e.lameLambdaPaSum+=Z(r?.[i+24],n.lameLambdaPa),e.soundSpeedMPerSSum+=Z(r?.[i+25],n.soundSpeedMPerS),e.dynamicViscosityPaSSum+=Z(r?.[i+29],n.dynamicViscosityPaS),e.surfaceTensionNPerMSum+=Z(r?.[i+30],n.surfaceTensionNPerM),e.maxHydrostaticPressurePa=Math.max(e.maxHydrostaticPressurePa,Z(r?.[i+28],n.hydrostaticPressurePa))}function Zc(e){let t=Math.max(1,e.particleCount),n=e.initializationRow;return{schema:Mc,status:`algorithm-derived-mls-mpm-mechanics-row-ready`,role:e.role,bodyId:e.bodyId,domainId:e.domainId,bodyOrder:e.bodyOrder,material:e.material,phase:e.phase,particleCount:e.particleCount,solidParticleCount:e.solidParticleCount,restVolumeM3Mean:e.restVolumeM3Sum/t,effectiveBulkModulusPaMean:e.effectiveBulkModulusPaSum/t,shearModulusPaMean:e.shearModulusPaSum/t,lameLambdaPaMean:e.lameLambdaPaSum/t,soundSpeedMPerSMean:e.soundSpeedMPerSSum/t,dynamicViscosityPaSMean:e.dynamicViscosityPaSSum/t,surfaceTensionNPerMMean:e.surfaceTensionNPerMSum/t,maxHydrostaticPressurePa:e.maxHydrostaticPressurePa,crystalStructureKey:n?.crystalStructureKey??null,crystalPackingFraction:Z(n?.crystalPackingFraction,0),initializationSpacingM:Z(n?.spacingM,0),initializationSpacingByAxisM:Array.isArray(n?.spacingByAxisM)?[...n.spacingByAxisM]:[],initializationAppliedParticleRadiusM:Z(n?.appliedParticleRadiusM,0),initializationTargetSmoothingLengthM:Z(n?.targetSmoothingLengthM,0),particleInitializationRowStatus:n?.status??null,particleRadiusPolicy:n?.particleRadiusPolicy??null,strictSourceOfTruth:!1,provenance:{source:`algorithm-derived-initial-body-mls-mpm-mechanics-row`,particleInitializationRowSchema:n?.schema??null}}}function Qc({particles:e=[],metadata:t=[],mechanics:n=null,mechanicsStrideFloats:r=32,particleInitializationRows:i=null}={}){let a=qc(i),o=new Map,s=Array.isArray(e)?e.length:0;for(let i=0;i<s;i+=1){let s=e[i]||{},c=t[i]||{};if(s.spareProductSlot===!0||c.spareProductSlot===!0||s.phaseCompanionSlot===!0||c.phaseCompanionSlot===!0)continue;let l=s.initialBodyId??c.initialBodyId??null,u=l==null?null:String(l),d=u==null?null:a.get(u)||null,f=Math.max(0,Math.round(Z(s.initialBodyDomainId??s.renderDomainId??c.initialBodyDomainId??c.renderDomainId??d?.domainId,0)));if(d&&f>0&&f!==d.domainId)throw Error(`initial body '${u}' maps to domain ${f}, expected ${d.domainId}`);let p=d?.role??u??s.role??c.role??`unassigned`,m=c.material||s.material||`unknown`,h=c.phase||s.phase||`unknown`,g=`${u==null?`unassigned:${p}`:`body:${u}`}|${m}|${h}`,_=o.get(g);if(!_)_=Yc({role:p,bodyId:u,domainId:d?.domainId??f,bodyOrder:d?.bodyOrder??2**53-1,material:m,phase:h,initializationRow:d}),o.set(g,_);else if(u!=null&&f>0&&_.domainId!==f)throw Error(`initial body '${u}' maps to multiple domain ids`);Xc(_,{particle:s,meta:c,mechanics:n,offset:i*r})}let c=[...o.values()].sort((e,t)=>e.bodyOrder-t.bodyOrder||String(e.bodyId??e.role).localeCompare(String(t.bodyId??t.role))||String(e.material).localeCompare(String(t.material))||String(e.phase).localeCompare(String(t.phase))).map(Zc);return{schema:jc,status:c.length>0?`algorithm-derived-mls-mpm-mechanics-rows-ready`:`algorithm-derived-mls-mpm-mechanics-rows-empty`,rowCount:c.length,rows:c,particleCount:s,identityMode:`initial-bodies`,strictSourceOfTruth:!1,derivationAuthority:`packed-mls-mpm-mechanics-buffer-with-particle-initialization-rows`}}function $c({particles:e=[],metadata:t=[],mechanics:n=null,mechanicsStrideFloats:r=32,particleInitializationRows:i=null}={}){if(i?.identityMode===`initial-bodies`||(i?.rows||[]).some(e=>e?.bodyId!=null))return Qc({particles:e,metadata:t,mechanics:n,mechanicsStrideFloats:r,particleInitializationRows:i});let a=Kc(i),o=new Map,s=Array.isArray(e)?e.length:0;for(let i=0;i<s;i+=1){let s=e[i]||{},c=t[i]||{};if(s.spareProductSlot===!0||c.spareProductSlot===!0||s.phaseCompanionSlot===!0||c.phaseCompanionSlot===!0)continue;let l=s.role||c.role||(s.material===`h2o`?`base`:`drop`),u=c.material||s.material||`unknown`,d=c.phase||s.phase||`unknown`,f=`${l}|${u}|${d}`,p=o.get(f);p||(p=Jc({role:l,material:u,phase:d,initializationRow:a.get(l)||null}),o.set(f,p));let m=i*r;p.particleCount+=1,p.solidParticleCount+=+(Z(n?.[m+20],+!!c.solid)>.5),p.restVolumeM3Sum+=Z(n?.[m+19],0),p.effectiveBulkModulusPaSum+=Z(n?.[m+22],c.effectiveBulkModulusPa),p.shearModulusPaSum+=Z(n?.[m+23],c.shearModulusPa),p.lameLambdaPaSum+=Z(n?.[m+24],c.lameLambdaPa),p.soundSpeedMPerSSum+=Z(n?.[m+25],c.soundSpeedMPerS),p.dynamicViscosityPaSSum+=Z(n?.[m+29],c.dynamicViscosityPaS),p.surfaceTensionNPerMSum+=Z(n?.[m+30],c.surfaceTensionNPerM),p.maxHydrostaticPressurePa=Math.max(p.maxHydrostaticPressurePa,Z(n?.[m+28],c.hydrostaticPressurePa))}let c=[...o.values()].sort((e,t)=>String(e.role).localeCompare(String(t.role))||String(e.material).localeCompare(String(t.material))).map(e=>{let t=Math.max(1,e.particleCount),n=e.initializationRow;return{schema:Mc,status:`algorithm-derived-mls-mpm-mechanics-row-ready`,role:e.role,material:e.material,phase:e.phase,particleCount:e.particleCount,solidParticleCount:e.solidParticleCount,restVolumeM3Mean:e.restVolumeM3Sum/t,effectiveBulkModulusPaMean:e.effectiveBulkModulusPaSum/t,shearModulusPaMean:e.shearModulusPaSum/t,lameLambdaPaMean:e.lameLambdaPaSum/t,soundSpeedMPerSMean:e.soundSpeedMPerSSum/t,dynamicViscosityPaSMean:e.dynamicViscosityPaSSum/t,surfaceTensionNPerMMean:e.surfaceTensionNPerMSum/t,maxHydrostaticPressurePa:e.maxHydrostaticPressurePa,crystalStructureKey:n?.crystalStructureKey??null,crystalPackingFraction:Z(n?.crystalPackingFraction,0),initializationSpacingM:Z(n?.spacingM,0),initializationAppliedParticleRadiusM:Z(n?.appliedParticleRadiusM,0),initializationTargetSmoothingLengthM:Z(n?.targetSmoothingLengthM,0),particleInitializationRowStatus:n?.status??null,particleRadiusPolicy:n?.particleRadiusPolicy??null,strictSourceOfTruth:!1,provenance:{source:`algorithm-derived-mls-mpm-mechanics-row`,particleInitializationRowSchema:n?.schema??null}}});return{schema:jc,status:c.length>0?`algorithm-derived-mls-mpm-mechanics-rows-ready`:`algorithm-derived-mls-mpm-mechanics-rows-empty`,rowCount:c.length,rows:c,particleCount:s,strictSourceOfTruth:!1,derivationAuthority:`packed-mls-mpm-mechanics-buffer-with-particle-initialization-rows`}}function el(e){let t=e.map(e=>Z(e,0)).filter(e=>e>0);return t.length>0?Math.min(...t):0}function tl(e){let t=e.filter(e=>e.role===`drop`),n=e.filter(e=>e.role===`base`),r=[];for(let e of t)for(let t of n)r.push([e,t]);return r}function nl(e){let t=new Map;for(let n of e){if(n?.bodyId==null)continue;let e=String(n.bodyId),r=t.get(e);if(!r)r={bodyId:e,domainId:Math.max(0,Math.round(Z(n.domainId,0))),bodyOrder:Z(n.bodyOrder,2**53-1),rows:[]},t.set(e,r);else if(Z(n.domainId,r.domainId)>0&&r.domainId!==Math.round(Z(n.domainId,0)))throw Error(`initial body '${e}' has inconsistent mechanics-row domain ids`);r.rows.push(n)}return[...t.values()].sort((e,t)=>e.bodyOrder-t.bodyOrder||e.bodyId.localeCompare(t.bodyId))}function rl({mlsMpmMechanicsRows:e=null}={}){let t=nl(Array.isArray(e?.rows)?e.rows:[]),n=[];for(let r=0;r<t.length;r+=1){let i=t[r];for(let a=r+1;a<t.length;a+=1){let r=t[a];for(let t of i.rows)for(let a of r.rows){let o=Z(t.effectiveBulkModulusPaMean,0)+4/3*Z(t.shearModulusPaMean,0),s=Z(a.effectiveBulkModulusPaMean,0)+4/3*Z(a.shearModulusPaMean,0),c=Math.max(Z(t.initializationTargetSmoothingLengthM,0),Z(a.initializationTargetSmoothingLengthM,0),Z(t.initializationAppliedParticleRadiusM,0)+Z(a.initializationAppliedParticleRadiusM,0));n.push({schema:Pc,status:`algorithm-derived-contact-row-ready`,pairKey:`${i.bodyId}:${t.material}:${t.phase}|${r.bodyId}:${a.material}:${a.phase}`,roles:[t.role,a.role],bodyIds:[i.bodyId,r.bodyId],domainIds:[i.domainId,r.domainId],bodyOrders:[i.bodyOrder,r.bodyOrder],materials:[t.material,a.material],phases:[t.phase,a.phase],normalStiffnessPa:el([o,s]),dampingViscosityPaS:Math.max(Z(t.dynamicViscosityPaSMean,0),Z(a.dynamicViscosityPaSMean,0)),supportRadiusM:c,softerMaterial:o>0&&s>0&&o<=s?t.material:a.material,softerBodyId:o>0&&s>0&&o<=s?i.bodyId:r.bodyId,crystalStructureKeys:[t.crystalStructureKey,a.crystalStructureKey],impulsePolicy:`bounded-by-softer-constituent-and-initial-support-radius`,strictSourceOfTruth:!1,forceMutationAuthority:`not-authoritative-contact-policy-row`,provenance:{source:`algorithm-derived-initial-body-contact-row`,mechanicsRowsSchema:e?.schema??null}})}}}return{schema:Nc,status:n.length>0?`algorithm-derived-contact-rows-ready`:`algorithm-derived-contact-rows-empty`,rowCount:n.length,rows:n,bodyCount:t.length,bodyPairCount:t.length*(t.length-1)/2,identityMode:`initial-bodies`,strictSourceOfTruth:!1,derivationAuthority:`mls-mpm-mechanics-rows-contact-policy-view`}}function il({mlsMpmMechanicsRows:e=null}={}){let t=Array.isArray(e?.rows)?e.rows:[];if(e?.identityMode===`initial-bodies`||t.some(e=>e?.bodyId!=null))return rl({mlsMpmMechanicsRows:e});let n=tl(t).map(([t,n])=>{let r=Z(t.effectiveBulkModulusPaMean,0)+4/3*Z(t.shearModulusPaMean,0),i=Z(n.effectiveBulkModulusPaMean,0)+4/3*Z(n.shearModulusPaMean,0),a=Math.max(Z(t.initializationTargetSmoothingLengthM,0),Z(n.initializationTargetSmoothingLengthM,0),Z(t.initializationAppliedParticleRadiusM,0)+Z(n.initializationAppliedParticleRadiusM,0));return{schema:Pc,status:`algorithm-derived-contact-row-ready`,pairKey:`${t.role}:${t.material}|${n.role}:${n.material}`,roles:[t.role,n.role],materials:[t.material,n.material],phases:[t.phase,n.phase],normalStiffnessPa:el([r,i]),dampingViscosityPaS:Math.max(Z(t.dynamicViscosityPaSMean,0),Z(n.dynamicViscosityPaSMean,0)),supportRadiusM:a,softerMaterial:r>0&&i>0&&r<=i?t.material:n.material,crystalStructureKeys:[t.crystalStructureKey,n.crystalStructureKey],impulsePolicy:`bounded-by-softer-constituent-and-initial-support-radius`,strictSourceOfTruth:!1,forceMutationAuthority:`not-authoritative-contact-policy-row`,provenance:{source:`algorithm-derived-contact-row`,mechanicsRowsSchema:e?.schema??null}}});return{schema:Nc,status:n.length>0?`algorithm-derived-contact-rows-ready`:`algorithm-derived-contact-rows-empty`,rowCount:n.length,rows:n,strictSourceOfTruth:!1,derivationAuthority:`mls-mpm-mechanics-rows-contact-policy-view`}}function al({particleInitializationRows:e=null,mlsMpmMechanicsRows:t=null,contactRows:n=null}={}){let r=Array.isArray(t?.rows)?t.rows:[],i=new Map,a=new Map;for(let e of n?.rows||[]){for(let t of e.roles||[])i.set(t,Math.max(Z(i.get(t),0),Z(e.supportRadiusM,0)));for(let t of e.bodyIds||[])a.set(t,Math.max(Z(a.get(t),0),Z(e.supportRadiusM,0)))}let o=(e?.rows||[]).map(e=>{let o=e.bodyId==null?r.find(t=>t.role===e.role)||null:r.find(t=>t.bodyId===e.bodyId)||null,s=e.bodyId==null?i.get(e.role):a.get(e.bodyId),c=Math.max(Z(e.targetSmoothingLengthM,0),Z(o?.initializationTargetSmoothingLengthM,0),Z(s,0)),l=c>0?c/2:Z(e.spacingM,0);return{schema:`peercompute.ulg.algorithm-material-surface-extraction-row.v0`,status:`algorithm-derived-surface-extraction-row-ready`,role:e.role,...e.bodyId==null?{}:{bodyId:e.bodyId,domainId:e.domainId,bodyOrder:e.bodyOrder},material:e.material,materialId:Z(e.materialId,0),phase:o?.phase??null,isovalue:.5,isovaluePolicy:`density-kernel-half-occupancy`,smoothingRadiusM:c,voxelSizeM:l,normalScaleM:c,supportRadiusM:Z(s,c),particleRadiusM:Z(e.appliedParticleRadiusM,0),crystalStructureKey:e.crystalStructureKey??null,crystalPackingFraction:Z(e.crystalPackingFraction,0),drawPolicy:`material-phase-surface-row`,strictSourceOfTruth:!1,rendererAuthority:`not-renderer-authoritative-surface-policy-row`,provenance:{source:`algorithm-derived-surface-extraction-row`,particleInitializationRowSchema:e.schema??null,mechanicsRowsSchema:t?.schema??null,contactRowsSchema:n?.schema??null}}});return{schema:`peercompute.ulg.algorithm-material-surface-extraction-rows.v0`,status:o.length>0?`algorithm-derived-surface-extraction-rows-ready`:`algorithm-derived-surface-extraction-rows-empty`,rowCount:o.length,rows:o,strictSourceOfTruth:!1,derivationAuthority:`particle-initialization-mechanics-contact-surface-policy-view`}}const ol=Symbol.for(`peercompute.ulg.webgpu.deviceId`),sl=`__peercomputeUlgWebGpuDeviceId`;let cl=1;function ll(e){return typeof e==`object`&&!!e||typeof e==`function`}function ul(e,t,n){if(ll(e))try{Object.defineProperty(e,t,{value:n,configurable:!0})}catch{}}function dl(e){if(!ll(e))return null;if(e[ol])return e[ol];if(e[sl])return e[sl];let t=`ulg-webgpu-device:${cl}`;return cl+=1,ul(e,ol,t),ul(e,sl,t),t}$n.length,Object.freeze({disabled:0,taitCondensed:1,gasLinearized:2}),Object.freeze({ready:1,missingPhase:255});function fl(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function pl(e){if(Number.isFinite(e?.temperatureK))return e.temperatureK;if(Array.isArray(e?.temperatureRange)&&e.temperatureRange.length>=2){let t=fl(e.temperatureRange[0],293.15);return(t+fl(e.temperatureRange[1],t))/2}return 293.15}function ml(e,t){let n=String(t?.name||``).toLowerCase();if(n===`gas`){let n=fl(e?.molarMassKgPerMol,0);if(!(n>0))return 0;let r=8.314462618/n,i=fl(t?.cpJPerKgK,0),a=i>r?i/(i-r):1.33;return Math.sqrt(Math.max(a*r*pl(t),0))}let r=fl(t?.bulkModulusPa,0),i=n===`solid`?fl(t?.shearModulusPa,0):0,a=fl(t?.densityKgPerM3,0);return r>0&&a>0?Math.sqrt((r+4/3*i)/a):0}function hl(e,t,{soundSpeedScale:n=1,cflMaxSoundSpeedMPerS:r=0}={}){let i=fl(r,0);if(!(i>0))return fl(n,1);let a=ml(e,t);return a>0?Math.min(1,i/a):1}const gl=Bn.length,_l=Vn.length,vl=Hn.length,yl=ir.length,bl=Object.freeze({ready:1,energyClampedLow:2,energyClampedHigh:3,phaseCompanionReserved:254,missingMaterialProperties:255}),xl=[`solid`,`liquid`,`gas`,`plasma`],Sl=Object.freeze({disabled:0,taitCondensed:1,gasLinearized:2});globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE;const Cl=16777215;function Q(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function wl(e,{particleIndex:t=null}={}){let n=Number(e);if(!Number.isFinite(n)||n<=0)return 0;let r=Math.round(n);if(r>16777215){let e=t==null?``:` for particle ${t}`;throw RangeError(`render domain id${e} exceeds the exact GPU render range (${Cl})`)}return r}function Tl(e){let t=String(e?.role??e?.legacyRole??``).trim().toLowerCase();return t===`base`?{renderDomainId:1,renderDomainKey:`base`}:t===`drop`?{renderDomainId:2,renderDomainKey:`drop`}:{renderDomainId:0,renderDomainKey:null}}function El(e,t=null){let n=e?.initialBodyDomainId??e?.renderDomainId;if(n!=null){let r=wl(n,{particleIndex:t});return{renderDomainId:r,renderDomainKey:r>0?e?.initialBodyId??e?.renderDomainKey??null:null,source:e?.initialBodyDomainId==null?`particle-render-domain-id`:`initial-body-domain-id`}}let r=Tl(e);return{...r,source:r.renderDomainId>0?`legacy-particle-role`:`unassigned`}}function Dl(e,t={}){let n=2166136261,r=e=>{n^=e&255,n=Math.imul(n,16777619)>>>0};if(e instanceof Uint32Array)for(let t of e)r(t),r(t>>>8),r(t>>>16),r(t>>>24);for(let[e,n]of Object.entries(t).sort((e,t)=>Number(e[0])-Number(t[0]))){let t=`${e}:${n};`;for(let e=0;e<t.length;e+=1){let n=t.charCodeAt(e);r(n),r(n>>>8)}}return`fnv1a32:${e?.length??0}:${n.toString(16).padStart(8,`0`)}`}function Ol(e,t){return!t||!e?null:t[e]??t[String(e).toLowerCase()]??t[String(e).toUpperCase()]??null}function kl(e,t,n){let r=Q(n.restDensityKgPerM3,0);if(r>0)return r;let i=e?.phases?.find(e=>e.name===t),a=e?.phases?.find(e=>e.densityKgPerM3>0);return Q(i?.densityKgPerM3??a?.densityKgPerM3,0)}function Al(e,t){let n=Q(e.massKg,0),r=Q(t?.molarMassKgPerMol,0);return n>0&&r>0?n/r*602214076e15:0}function jl(){return[1,0,0,0,1,0,0,0,1]}function Ml(){return[0,0,0,0,0,0,0,0,0]}function Nl(e,t){return(e&&e.length===9?Array.from(e):t).map(e=>Q(e,0))}function Pl(e,t,n=null){return n?+!!n.solid:e.mpmSolid===!0?1:e.mpmSolid===!1?0:+(t?.stablePhase===`solid`)}function Fl(e,t){return t?e?.clamped===`low`?bl.energyClampedLow:e?.clamped===`high`?bl.energyClampedHigh:bl.ready:bl.missingMaterialProperties}function Il(e){return xl.map(t=>Q(e?.phaseFractions?.[t],0))}function Ll(e,t){return t?cs(t,Q(e.specificInternalEnergyJPerKg,0)):{temperatureK:0,stablePhase:`unknown`,phaseFractions:{},clamped:null}}function Rl(e,t){return e?.phases?.length?e.phases.find(e=>e.name===t)||e.phases[0]:null}function zl(e,{soundSpeedScale:t,minGasSoundSpeedMPerS:n,viscosityEnabled:r,mlsMpmArtificialViscosityAlpha:i,viscosityLengthM:a,liquidWallDampingAlpha:o,liquidWallDampingDistanceM:s}={}){let c=e?.gpuMechanics||{},l=e?.physicalLawGroups||c.physicalLawGroups||{},u=!!(r??l.viscosity);return{soundSpeedScale:Q(t??c.soundSpeedScale,1),cflMaxSoundSpeedMPerS:Q(c.cflMaxSoundSpeedMPerS,0),minGasSoundSpeedMPerS:Q(n??c.minGasSoundSpeedMPerS,40),viscosityEnabled:u,mlsMpmArtificialViscosityAlpha:Q(i??c.mlsMpmArtificialViscosityAlpha,.04),viscosityLengthM:Q(a??c.gridSpacingM??e?.smoothingLengthM,0),liquidWallDampingAlpha:u?Q(o??c.mlsMpmLiquidWallDampingAlpha,0):0,liquidWallDampingDistanceM:Q(s??c.mlsMpmLiquidWallDampingDistanceM,0),particleSeparationRelaxation:Q(c.mlsMpmParticleSeparationRelaxation,.5),particleSeparationVelocityDamping:Math.min(Math.max(Q(c.mlsMpmParticleSeparationVelocityDamping,0),0),1)}}function Bl(e,t,n,r,i){let a=Q(e?.molarMassKgPerMol,0),o=Q(t?.cpJPerKgK,0);if(!(a>0))return 0;let s=8.314462618/a,c=o>s?o/(o-s):1.33,l=Math.sqrt(Math.max(c*s*n,0));return Math.max(l*r,i)}function Vl(e,t,{restDensityKgPerM3:n,soundSpeedMPerS:r,viscosityEnabled:i,mlsMpmArtificialViscosityAlpha:a,viscosityLengthM:o}={}){return i?Math.max(Q(t?.dynamicViscosityPaS,0),0):0}function Hl(e,t,n,r){if(!t)return{solid:!1,effectiveBulkModulusPa:0,shearModulusPa:0,lameLambdaPa:0,soundSpeedMPerS:0,eosModelId:Sl.disabled,constitutiveStatus:bl.missingMaterialProperties,dynamicViscosityPaS:0,surfaceTensionNPerM:0};let i=n?.stablePhase||`liquid`,a=Rl(t,i),o=hl(t,a,{soundSpeedScale:Q(r.soundSpeedScale,1),cflMaxSoundSpeedMPerS:Q(r.cflMaxSoundSpeedMPerS,0)}),s=o*o,c=Q(a?.densityKgPerM3??e.restDensityKgPerM3,0),l=Q(a?.bulkModulusPa,0),u=i===`solid`?Q(a?.shearModulusPa,0):0;if(i===`gas`)return{solid:!1,effectiveBulkModulusPa:0,shearModulusPa:0,lameLambdaPa:0,soundSpeedMPerS:Bl(t,a,Q(n?.temperatureK,0),o,Q(r.minGasSoundSpeedMPerS,40)),eosModelId:Sl.gasLinearized,constitutiveStatus:bl.ready,dynamicViscosityPaS:Vl(i,a,{restDensityKgPerM3:c,soundSpeedMPerS:Bl(t,a,Q(n?.temperatureK,0),o,Q(r.minGasSoundSpeedMPerS,40)),viscosityEnabled:r.viscosityEnabled,mlsMpmArtificialViscosityAlpha:r.mlsMpmArtificialViscosityAlpha,viscosityLengthM:r.viscosityLengthM}),surfaceTensionNPerM:0};let d=l*s,f=u*s,p=c>0&&d>0?Math.sqrt(d/c):0;return{solid:i===`solid`&&f>0,effectiveBulkModulusPa:d,shearModulusPa:f,lameLambdaPa:i===`solid`?Math.max((l-2/3*u)*s,0):0,soundSpeedMPerS:p,eosModelId:d>0?Sl.taitCondensed:Sl.disabled,constitutiveStatus:bl.ready,dynamicViscosityPaS:Vl(i,a,{restDensityKgPerM3:c,soundSpeedMPerS:p,viscosityEnabled:r.viscosityEnabled,mlsMpmArtificialViscosityAlpha:r.mlsMpmArtificialViscosityAlpha,viscosityLengthM:r.viscosityLengthM}),surfaceTensionNPerM:r.surfaceTensionEnabled?Math.max(Q(a?.surfaceTensionNPerM,0),0):0}}function Ul(e,{materialProperties:t={},initialParticleSpacing:n=null}={}){if(!e?.particles||!Array.isArray(e.particles))throw TypeError(`buildSphGpuParticleBuffers requires a SPH state with particles`);let r=e.particles.length,i=new Float32Array(r*gl),a=new Float32Array(r*_l),o=new Uint32Array(r*vl),s={},c=[],l=Q(e.smoothingLengthM,0);for(let n=0;n<r;n+=1){let r=e.particles[n],u=r.material||`unknown`,d=Ol(u,t),f=Ll(r,d),p=f.stablePhase||`unknown`,m=Il(f),h=n*gl,g=n*_l,_=n*vl,v=El(r,n);i.set([Q(r.x?.[0]),Q(r.x?.[1]),Q(r.x?.[2]),Q(r.massKg),Q(r.v?.[0]),Q(r.v?.[1]),Q(r.v?.[2]),Q(r.specificInternalEnergyJPerKg)],h);let y=r.phaseCompanionSlot===!0?bl.phaseCompanionReserved:Fl(f,d);if(a.set([d?mc(u):0,oc(p),Q(f.temperatureK),kl(d,p,r),m[0],m[1],m[2],m[3],l,Al(r,d),y,Q(r.visualRestParticleRadiusM??r.visualParticleRadiusM??r.restParticleRadiusM??r.particleRadiusM,0)],g),o[_]=v.renderDomainId,v.renderDomainId>0&&v.renderDomainKey!=null){let e=String(v.renderDomainKey),t=s[v.renderDomainId];if(t!=null&&t!==e)throw RangeError(`render domain id ${v.renderDomainId} maps to both "${t}" and "${e}"`);s[v.renderDomainId]=e}c.push({id:r.id??`p${n}`,material:u,materialId:d?mc(u):0,phase:p,phaseId:oc(p),status:y,spareProductSlot:r.spareProductSlot===!0,phaseCompanionSlot:r.phaseCompanionSlot===!0,phaseCarrierPrimaryIndex:Number.isSafeInteger(r.phaseCarrierPrimaryIndex)?r.phaseCarrierPrimaryIndex:null,phaseCarrierCompanionIndex:Number.isSafeInteger(r.phaseCarrierCompanionIndex)?r.phaseCarrierCompanionIndex:null,phaseCarrierLineageIndex:Number.isSafeInteger(r.phaseCarrierLineageIndex)?r.phaseCarrierLineageIndex:null,phaseCarrierLane:Number.isSafeInteger(r.phaseCarrierLane)?r.phaseCarrierLane:null,phaseCarrierTargetPhaseId:Number.isSafeInteger(r.phaseCarrierTargetPhaseId)?r.phaseCarrierTargetPhaseId:null,initialBodyId:r.initialBodyId??null,initialBodyDomainId:wl(r.initialBodyDomainId,{particleIndex:n}),renderDomainId:v.renderDomainId,renderDomainKey:v.renderDomainKey,renderDomainIdentitySource:v.source})}let u=Bs(n?.materialPropertyBankWarmInputs),d=Vs(n);return{schema:`peercompute.ulg.sph-gpu-particle-buffer.v0`,status:`cpu-derived-gpu-buffer-ready`,particleCount:r,dimension:e.dimension??3,step:e.step??0,time:e.time??0,positionEpoch:Number.isInteger(Number(e.positionEpoch))?Number(e.positionEpoch):Math.max(0,Math.round(Number(e.step)||0)),topologyEpoch:Number.isInteger(Number(e.topologyEpoch))?Number(e.topologyEpoch):0,chartEpoch:Number.isInteger(Number(e.chartEpoch))?Number(e.chartEpoch):0,levelEpoch:Number.isInteger(Number(e.levelEpoch))?Number(e.levelEpoch):Math.max(0,Math.round(Number(e.step)||0)),supportEpoch:Number.isInteger(Number(e.supportEpoch))?Number(e.supportEpoch):Math.max(0,Math.round(Number(e.step)||0)),smoothingLengthM:l,phaseIds:{...ec},stateLayout:[...Bn],thermoLayout:[...Vn],identitySchema:`peercompute.ulg.sph-gpu-particle-identity-buffer.v0`,identityLayout:[...Hn],stateStrideFloats:gl,thermoStrideFloats:_l,identityStrideUints:vl,stateStrideBytes:gl*Float32Array.BYTES_PER_ELEMENT,thermoStrideBytes:_l*Float32Array.BYTES_PER_ELEMENT,identityStrideBytes:vl*Uint32Array.BYTES_PER_ELEMENT,identityBufferByteLength:Math.max(Uint32Array.BYTES_PER_ELEMENT,r*vl*Uint32Array.BYTES_PER_ELEMENT),state:i,thermo:a,identity:o,identityRequired:c.some(e=>e.renderDomainId>0&&e.renderDomainIdentitySource!==`legacy-particle-role`&&e.renderDomainIdentitySource!==`unassigned`),renderDomainKeys:s,identityRevision:Dl(o,s),cpuIdentityStale:!1,metadata:c,phaseCarrierPlan:e.phaseCarrierPlan?{...e.phaseCarrierPlan}:null,materialPropertyBankWarmInputTable:u,materialPropertyBankParticleSizeTable:d,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Wl(e,t={}){let{materialProperties:n={},initialParticleSpacing:r=null}=t;if(!e?.particles||!Array.isArray(e.particles))throw TypeError(`buildMlsMpmGpuParticleBuffers requires a SPH state with particles`);let i=zl(e,t),a=e.particles.length,o=new Float32Array(a*yl),s=[];for(let t=0;t<a;t+=1){let r=e.particles[t],a=r.material||`unknown`,c=Ol(a,n),l=Ll(r,c),u=Hl(r,c,l,i),d=Nl(r.mpmF,jl()),f=Nl(r.mpmC,Ml()),p=kl(c,l.stablePhase,r),m=Q(r.mpmVolume0,p>0?Q(r.massKg)/p:0),h=Q(r.mpmJ,1),g=r.phaseCompanionSlot===!0?bl.phaseCompanionReserved:Fl(l,c),_=Q(r.phaseVolumeReferenceMassKg,Q(r.massKg,0)),v=t*yl;o.set([d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],f[0],f[1],f[2],f[3],f[4],f[5],f[6],f[7],f[8],h,m,Pl(r,l,u),g,u.effectiveBulkModulusPa,u.shearModulusPa,u.lameLambdaPa,u.soundSpeedMPerS,u.eosModelId,r.phaseCompanionSlot===!0?g:u.constitutiveStatus,Math.max(Q(r.hydrostaticPressurePa,0),0),u.dynamicViscosityPaS,u.surfaceTensionNPerM,_],v),s.push({id:r.id??`p${t}`,material:a,phase:l.stablePhase,solid:u.solid,status:g,spareProductSlot:r.spareProductSlot===!0,phaseCompanionSlot:r.phaseCompanionSlot===!0,effectiveBulkModulusPa:u.effectiveBulkModulusPa,shearModulusPa:u.shearModulusPa,lameLambdaPa:u.lameLambdaPa,soundSpeedMPerS:u.soundSpeedMPerS,eosModelId:u.eosModelId,resolvedAbsolutePressurePa:Math.max(Q(r.hydrostaticPressurePa,0),0),hydrostaticPressurePa:Math.max(Q(r.hydrostaticPressurePa,0),0),dynamicViscosityPaS:u.dynamicViscosityPaS,surfaceTensionNPerM:u.surfaceTensionNPerM,phaseVolumeReferenceMassKg:_})}let c=Bs(r?.materialPropertyBankWarmInputs),l=Vs(r),u=$c({particles:e.particles,metadata:s,mechanics:o,mechanicsStrideFloats:yl,particleInitializationRows:r?.algorithmMaterialParticleInitializationRows??null}),d=il({mlsMpmMechanicsRows:u}),f=al({particleInitializationRows:r?.algorithmMaterialParticleInitializationRows??null,mlsMpmMechanicsRows:u,contactRows:d});return{schema:`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`,status:`cpu-derived-gpu-buffer-ready`,particleCount:a,step:e.step??0,time:e.time??0,mechanicsLayout:[...ir],mechanicsStrideFloats:yl,mechanicsStrideBytes:yl*Float32Array.BYTES_PER_ELEMENT,soundSpeedScale:i.soundSpeedScale,cflMaxSoundSpeedMPerS:i.cflMaxSoundSpeedMPerS,minGasSoundSpeedMPerS:i.minGasSoundSpeedMPerS,viscosityEnabled:i.viscosityEnabled,mlsMpmArtificialViscosityAlpha:i.mlsMpmArtificialViscosityAlpha,viscosityLengthM:i.viscosityLengthM,liquidWallDampingAlpha:i.liquidWallDampingAlpha,liquidWallDampingDistanceM:i.liquidWallDampingDistanceM,particleSeparationRelaxation:i.particleSeparationRelaxation,particleSeparationVelocityDamping:i.particleSeparationVelocityDamping,mechanicsDtS:Q(e.gpuMechanics?.dt,0),mechanicalSubsteps:Math.max(1,Math.round(Q(e.gpuMechanics?.mechanicalSubsteps,1))),gridCflFactor:Q(e.gpuMechanics?.gridCflFactor,0),gravityMPerS2:Array.isArray(e.gpuMechanics?.gravityMPerS2)?e.gpuMechanics.gravityMPerS2.map(e=>Q(e,0)):[0,-9.80665,0],mechanics:o,metadata:s,phaseCarrierPlan:e.phaseCarrierPlan?{...e.phaseCarrierPlan}:null,materialPropertyBankWarmInputTable:c,materialPropertyBankParticleSizeTable:l,algorithmMaterialMlsMpmMechanicsRows:u,algorithmMaterialContactRows:d,algorithmMaterialSurfaceExtractionRows:f,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}256*16*Uint32Array.BYTES_PER_ELEMENT,c.length+l.length+1,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;const $=Object.freeze({MAGIC:0,ABI_VERSION:1,STATUS_FLAGS:2,EXPECTED_GENERATION_SEAL:3,OBSERVED_GENERATION_SEAL:4,LIVE_ELEMENT_COUNT:5,MAXIMUM_ELEMENT_COUNT:6,OVERFLOW_COUNT:7,KEY_WORD_COUNT:8,KEY_STRIDE_WORDS:9,RADIX_WORKGROUP_COUNT:10,HISTOGRAM_ELEMENT_COUNT:11,CONSUMER_WORKGROUP_SIZE:12,GENERATION_ID:13,HISTOGRAM_SCAN_LEVEL_COUNT:14,HEAD_SCAN_LEVEL_COUNT:15,AUTHORITY_COUNT_OFFSET_WORDS:16,AUTHORITY_SEAL_OFFSET_WORDS:17,INDIRECT_ROW_COUNT:18,COMPLETION_GENERATION_SEAL:19,RADIX_DISPATCH_OFFSET_WORDS:20,HISTOGRAM_SCAN_COUNT_OFFSET_WORDS:21,HEAD_SCAN_COUNT_OFFSET_WORDS:22,HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS:23,HEAD_SCAN_DISPATCH_OFFSET_WORDS:24,CONTROL_WORD_COUNT:25,DISPATCH_X_LIMIT:26});`${$.MAGIC}${$.ABI_VERSION}${$.STATUS_FLAGS}${$.EXPECTED_GENERATION_SEAL}${$.OBSERVED_GENERATION_SEAL}${$.LIVE_ELEMENT_COUNT}${$.MAXIMUM_ELEMENT_COUNT}${$.OVERFLOW_COUNT}${$.KEY_WORD_COUNT}${$.KEY_STRIDE_WORDS}${$.RADIX_WORKGROUP_COUNT}${$.HISTOGRAM_ELEMENT_COUNT}${$.CONSUMER_WORKGROUP_SIZE}${$.GENERATION_ID}${$.HISTOGRAM_SCAN_LEVEL_COUNT}${$.HEAD_SCAN_LEVEL_COUNT}${$.AUTHORITY_COUNT_OFFSET_WORDS}${$.AUTHORITY_SEAL_OFFSET_WORDS}${$.INDIRECT_ROW_COUNT}${$.COMPLETION_GENERATION_SEAL}${$.RADIX_DISPATCH_OFFSET_WORDS}${$.HISTOGRAM_SCAN_COUNT_OFFSET_WORDS}${$.HEAD_SCAN_COUNT_OFFSET_WORDS}${$.HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS}${$.HEAD_SCAN_DISPATCH_OFFSET_WORDS}${$.CONTROL_WORD_COUNT}${$.DISPATCH_X_LIMIT}`,`${$.STATUS_FLAGS}${$.EXPECTED_GENERATION_SEAL}${$.COMPLETION_GENERATION_SEAL}`,`${$.STATUS_FLAGS}${$.EXPECTED_GENERATION_SEAL}${$.LIVE_ELEMENT_COUNT}${$.MAXIMUM_ELEMENT_COUNT}${$.KEY_STRIDE_WORDS}${$.RADIX_WORKGROUP_COUNT}${$.COMPLETION_GENERATION_SEAL}${$.RADIX_DISPATCH_OFFSET_WORDS}`,`${$.STATUS_FLAGS}${$.EXPECTED_GENERATION_SEAL}${$.LIVE_ELEMENT_COUNT}${$.KEY_WORD_COUNT}${$.KEY_STRIDE_WORDS}${$.CONSUMER_WORKGROUP_SIZE}${$.GENERATION_ID}${$.AUTHORITY_COUNT_OFFSET_WORDS}${$.AUTHORITY_SEAL_OFFSET_WORDS}${$.COMPLETION_GENERATION_SEAL}${$.RADIX_DISPATCH_OFFSET_WORDS}${$.DISPATCH_X_LIMIT}`,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;const Gl=Uint32Array.BYTES_PER_ELEMENT;globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,3*Gl,32*Float32Array.BYTES_PER_ELEMENT,3*Gl,2*Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,60*Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,60*Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Object.freeze([`generationId`,`deviceOrdinal`,`laneOrdinal`,`leaseToken`,`sourceFamilyId`,`storageGeneration`,`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`]),Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Object.freeze([`generationId`,`deviceOrdinal`,`laneOrdinal`,`leaseToken`,`sourceFamilyId`,`storageGeneration`,`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`]),Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;const Kl=Object.freeze([`observedMapAsyncCount`,`observedReadbackBytes`,`observedHostQueueFenceCount`]),ql=Object.freeze([`finalDiagnosticMapAsyncCount`,`finalDiagnosticReadbackBytes`,`deferredCleanupHostQueueFenceCount`,`awaitedBackpressureHostQueueFenceCount`]),Jl=Object.freeze([`unclassifiedMapAsyncCount`,`unclassifiedReadbackBytes`,`unclassifiedHostQueueFenceCount`]),Yl=Object.freeze([`mapAsyncCount`,`readbackBytes`,`hostQueueFenceCount`]),Xl=Object.freeze([...Kl,...ql]),Zl=Object.freeze([...Xl,...Jl]),Ql=Object.freeze([...Zl,...Yl]);Object.freeze([`readbackTelemetrySchema`,`readbackTelemetryComplete`,`readbackTelemetryUnknownSources`,`readbackTelemetrySourceBreakdown`,...Ql,`normalHotLoopReadbackFree`,`productionHotLoopHostDependencyFree`]),Object.freeze({FINE_SUBSTEP:`frozen-fine-substep`,MACRO_BOUNDARY:`macro-boundary-full-reclassification`,POST_CLOSURE:`post-closure-full-reclassification`}),Object.freeze({SAME_LOOKUP_TICK:`same-lookup-tick`,NEXT_TICK_SUCCESSOR:`next-tick-successor`});const $l=Uint32Array.BYTES_PER_ELEMENT,eu=ar.length,tu=Bn.length,nu=Vn.length,ru=ir.length;eu*$l,tu*$l,nu*$l,ru*$l,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;const iu=Object.freeze([us(0,`read-only-storage`),us(1,`read-only-storage`),us(2,`storage`),us(3,`uniform`)]);Object.freeze({cacheKey:`ulg-schroeder-frozen-level-assignment-refresh.v1`,label:`ulg-schroeder-frozen-level-assignment-refresh`,code:`
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
const FLAG_ADMITTED: u32 = 1u;

@compute @workgroup_size(64)
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
`,entryPoint:`main`,bindings:iu}),Object.freeze({cacheKey:`ulg-schroeder-frozen-spatial-key-churn.v0`,label:`ulg-schroeder-frozen-spatial-key-churn-classify`,code:_n,entryPoint:`classify`,bindings:iu}),Object.freeze({cacheKey:`ulg-schroeder-frozen-spatial-key-churn.v0`,label:`ulg-schroeder-frozen-spatial-key-churn-seal`,code:_n,entryPoint:`seal`,bindings:iu}),Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.INDIRECT,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;export{Pr as $,vt as $t,Zo as A,Kn as At,ba as B,Cn as Bt,Is as C,m as Cn,pr as Ct,cs as D,lr as Dt,ss as E,a as En,qn as Et,Yo as F,rr as Ft,ii as G,kr as Gt,pa as H,Tn as Ht,go as I,xn as It,bi as J,un as Jt,ri as K,jr as Kt,ao as L,Dn as Lt,za as M,nr as Mt,zo as N,tr as Nt,as as O,Un as Ot,Po as P,er as Pt,Xr as Q,yt as Qt,Sa as R,En as Rt,Fs as S,y as Sn,$n as St,ps as T,o as Tn,Yn as Tt,ma as U,Or as Ut,Ui as V,Sn as Vt,Hi as W,Ar as Wt,ei as X,bt as Xt,Qr as Y,dn as Yt,Zr as Z,xt as Zt,Ys as _,ue as _n,Zn as _t,hl as a,_t as an,qr as at,zs as b,te as bn,fr as bt,Rc as c,k as cn,kn as ct,oc as d,he as dn,On as dt,At as en,Nr as et,mc as f,ve as fn,sr as ft,Js as g,ae as gn,Qn as gt,Bs as h,ce as hn,mr as ht,El as i,Ct as in,Rr as it,is as j,Wn as jt,es as k,Gn as kt,ec as l,Oe as ln,jn as lt,Ss as m,ie as mn,or as mt,Wl as n,wt as nn,Wr as nt,dl as o,Ve as on,zr as ot,fc as p,le as pn,cr as pt,di as q,fn as qt,Ul as r,gt as rn,Ur as rt,Gc as s,He as sn,An as st,Cl as t,jt as tn,Fr as tt,Oc as u,ke as un,Mn as ut,Vs as v,oe as vn,ur as vt,bs as w,h as wn,Xn as wt,Rs as x,ne as xn,dr as xt,Ls as y,se as yn,Jn as yt,Ta as z,wn as zt};