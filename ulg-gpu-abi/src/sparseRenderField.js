export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-plan.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-surface-table.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-directory.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-route.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-active-brick.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-capacity.v0';
export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-admission.v0';

// Structural rows are u32-only. Physical field samples remain in separately
// described f32 atlases so offsets and generation identifiers never lose
// integer precision when surface counts grow.
export const SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT = Object.freeze([
  'surfaceIndex:u32',
  'resolutionX:u32',
  'resolutionY:u32',
  'resolutionZ:u32',
  'brickSize:u32',
  'brickCountX:u32',
  'brickCountY:u32',
  'brickCountZ:u32',
  'directoryOffset:u32',
  'directoryCount:u32',
  'logicalSampleCount:u32',
  'paddedSampleCount:u32',
  'dualVoxelCount:u32',
  'generationId:u32',
  'flags:u32',
  'status:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT = Object.freeze([
  'activeBrickIndex:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT = Object.freeze([
  'routeIndex:u32',
  'sourceIndex:u32',
  'sourceKind:u32',
  'surfaceIndex:u32',
  'homeBrickX:u32',
  'homeBrickY:u32',
  'homeBrickZ:u32',
  'homeBrickLinearIndex:u32',
  'homeDirectoryIndex:u32',
  'supportRadiusCells:u32',
  'generationId:u32',
  'status:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT = Object.freeze([
  'surfaceIndex:u32',
  'brickX:u32',
  'brickY:u32',
  'brickZ:u32',
  'brickLinearIndex:u32',
  'directoryIndex:u32',
  'atlasBrickIndex:u32',
  'atlasCellOffset:u32',
  'sampleExtentX:u32',
  'sampleExtentY:u32',
  'sampleExtentZ:u32',
  'voxelCandidateCount:u32',
  'activationFlags:u32',
  'generationId:u32',
  'sourceRangeOffset:u32',
  'sourceRangeCount:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT = Object.freeze([
  'generationId:u32',
  'surfaceCount:u32',
  'directoryRequiredCount:u32',
  'directoryCapacity:u32',
  'routeRequiredCount:u32',
  'routeCapacity:u32',
  'activeBrickRequiredCount:u32',
  'activeBrickCapacity:u32',
  'atlasCellRequiredCount:u32',
  'atlasCellCapacity:u32',
  'activeVoxelRequiredCount:u32',
  'activeVoxelCapacity:u32',
  'requiredByteLengthLow:u32',
  'requiredByteLengthHigh:u32',
  'capacityByteLengthLow:u32',
  'capacityByteLengthHigh:u32',
  'overflowFlags:u32',
  'admissionFlags:u32',
  'status:u32',
  'reserved0:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT = Object.freeze([
  'generationId:u32',
  'overflowFlags:u32',
  'admissionFlags:u32',
  'generationPublicationAllowed:u32',
  'failClosed:u32',
  'retainPreviousAcceptedGeneration:u32',
  'failClosedActionId:u32',
  'status:u32'
]);
