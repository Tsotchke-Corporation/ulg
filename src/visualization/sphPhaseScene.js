// SPH phase demo renderer (three.js), following the webgpuphys MLS-MPM visual style:
// particles are treated as density samples and reconstructed as continuous metaball surfaces
// instead of visible point sprites. Colour still comes from the closure-backed demo state.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  OPTICAL_GPU_RECORD_LAYOUT,
  buildOpticalGpuLookupQueries,
  buildOpticalGpuTable,
  decodeOpticalGpuLookupOutputRows,
  requestOpticalGpuDevice,
  runOpticalGpuLookupWithOptionalWebGpu,
  sampleOpticalGpuTableCpu,
  stableOpticalStateKey,
  uploadOpticalGpuTable
} from '../runtime/material/opticalGpuBuffers.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../runtime/sph/sphGpuBuffers.js';
import { runMlsMpmMechanicsPredictWithOptionalWebGpu } from '../runtime/sph/sphMechanicsGpuKernel.js';
import { runMlsMpmP2gGridProjectionWithOptionalWebGpu } from '../runtime/sph/sphGridGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
  pressureInterfaceForceSolverAllowsGridApplication,
  pressureInterfaceGridForceAdmissionAllowsApplication,
  runMlsMpmGridUpdateWithOptionalWebGpu
} from '../runtime/sph/sphGridUpdateGpuKernel.js';
import { runMlsMpmG2pWithOptionalWebGpu } from '../runtime/sph/sphG2pGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE,
  destroyMlsMpmResidentStepsBuffers,
  normalizeMlsMpmResidentCompactSummaryMode,
  runMlsMpmResidentStepWithOptionalWebGpu,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  submitMlsMpmResidentStepsComputeTask
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
  normalizeMlsMpmResidentSummaryScope
} from '../runtime/sph/sphMlsMpmGpuSummary.js';
import {
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable,
  destroySphThermalResponseGraphBuffers,
  uploadSphThermalResponseGraphBuffers
} from '../runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable } from '../runtime/sph/sphReactionGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../runtime/sph/sphMechanicsMaterialTable.js';
import {
  SPH_GPU_RENDER_ROW_FLOATS,
  SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
  buildSphRenderFieldCpu,
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWebGpu,
  buildSphRenderMaterialMap,
  buildSphMaterialInterfaceSourceFieldWebGpu,
  buildSphPhysicsMaterialInterfaceFieldWebGpu,
  buildSphRenderSurfaceDrawMetadataWebGpu,
  buildSphRenderSurfaceVerticesWebGpu,
  decodeSphRenderRows,
  extractSphRenderRowsWebGpu,
  splitSphRenderFieldBySurface,
  summarizeSphResidentParticleUploadWebGpu,
  summarizeSphRenderFieldSurfacesWebGpu
} from '../runtime/sph/sphRenderGpuKernel.js';
import { buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu } from '../runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import {
  gasPressureInterfaceCouplingSummary,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver
} from '../runtime/sphPhaseDemo.js';
import { opticalRenderParams } from '../runtime/material/opticalClosure.js';
import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../runtime/residentBufferLease.js';
import {
  readResidentStepsCommittedWarmDelta
} from '../runtime/peercomputeResidentCommitBridge.js';

export const SPH_PHASE_RENDER_MODE = 'continuous-marching-cubes';
export const SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT = 'no-full-readback';
export const SPH_PHASE_RENDER_ORDER = Object.freeze({
  opaqueSurface: 100,
  transmissiveSurface: 200,
  vaporSurface: 300,
  alphaSurface: 320,
  containerWire: 500
});
export const SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS = 0.92;
export const SPH_SURFACE_INACTIVE_GRACE_FRAMES = 2;
export const SPH_SURFACE_RADIUS_SCALE_DEFAULT = 0.15;
export const SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN = 0.2;
export const SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES = 27;
export const SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN = 64;
export const SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN = 32;
export const SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS = 0.5;
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW = 1e-2;
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE = 5e-3;
export const SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M = 1e-6;
export const SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT = 'depth24plus';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT = 'rgba16float';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT = 'rgba8unorm';
export const SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY = 'retain-last-overlay-until-replacement-ready';
export const SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT = 100_000;
export const SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT = 8;
export const SPH_SCENE_MAX_DEVICE_PIXEL_RATIO = 2;

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function resolveSphScenePixelRatio(devicePixelRatio = globalThis.devicePixelRatio) {
  const ratio = Number(devicePixelRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.max(1, Math.min(ratio, SPH_SCENE_MAX_DEVICE_PIXEL_RATIO));
}

export function resolveSphSceneViewportSize(container, {
  fallbackWidth = 800,
  fallbackHeight = 520,
  visualViewport = globalThis.visualViewport
} = {}) {
  const rect = typeof container?.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  const candidates = {
    clientWidth: Number(container?.clientWidth),
    clientHeight: Number(container?.clientHeight),
    rectWidth: Number(rect?.width),
    rectHeight: Number(rect?.height),
    visualViewportWidth: Number(visualViewport?.width),
    visualViewportHeight: Number(visualViewport?.height)
  };
  const firstPositive = (...values) => {
    for (const value of values) {
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 1;
  };
  const width = firstPositive(
    candidates.clientWidth,
    candidates.rectWidth,
    candidates.visualViewportWidth,
    fallbackWidth
  );
  const height = firstPositive(
    candidates.clientHeight,
    candidates.rectHeight,
    candidates.visualViewportHeight,
    fallbackHeight
  );
  return {
    width,
    height,
    aspect: width / height,
    ...candidates
  };
}

const RESIDENT_FULL_READBACK_MODE = 'full-parity-readback';
const RESIDENT_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT = 'disabled';
const SPH_THREE_WEBGPU_BINDING_REASON = 'raw WebGPU canvas overlay disabled until it can share Three scene depth; using Three/MarchingCubes render-field readback';
const SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE = 'three-compact-vertices';
const SPH_THREE_COMPACT_VERTEX_BRIDGE_STATUS = 'three-compact-surface-geometry-ready';
const SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE = 'three-render-row-points';
const SPH_THREE_RENDER_ROW_POINTS_BRIDGE_STATUS = 'three-render-row-points-ready';
const SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE = 'three-render-row-spheres';
const SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_STATUS = 'three-render-row-spheres-ready';
const SPH_THREE_RENDER_ROW_SPHERES_MAX_INSTANCES = 4096;
const SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE = 'webgpu-render-row-points';
const SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_STATUS = 'webgpu-render-row-points-ready';
const SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE = 'webgpu-render-row-spheres';
const SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_STATUS = 'webgpu-render-row-spheres-ready';
const SPH_RENDER_ROW_WEBGPU_OVERLAY_CAMERA_FLOATS = 20;
const SPH_WEBGPU_RENDER_ROW_OVERLAY_PRESENTATION_ENABLED = false;

export function resolveResidentExtensionSurfaceRendererCapability({
  renderer = null,
  renderBridgeMode = null,
  readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
} = {}) {
  const mode = String(renderBridgeMode || '').trim().toLowerCase() || null;
  const normalizedReadbackMode = String(readbackMode || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT).trim().toLowerCase();
  const rendererBackend = renderer?.isWebGPURenderer
    ? 'three-webgpu'
    : renderer?.isWebGLRenderer
    ? 'three-webgl'
    : renderer?.domElement
    ? 'three-unknown'
    : 'none';
  const backendBufferBindingAvailable = Boolean(
    renderer?.backend
    && typeof renderer.backend.get === 'function'
  );
  const sameDeviceGpuBufferGeometrySupported = Boolean(
    rendererBackend === 'three-webgpu'
    && backendBufferBindingAvailable
  );
  const requestedThreeCompactReadbackBridge = mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE;
  const noFullReadback = normalizedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE;
  const visibleNoReadbackSupported = Boolean(noFullReadback && sameDeviceGpuBufferGeometrySupported);
  let status = 'extension-surface-renderer-capability-blocked';
  let reason = 'extension surface renderer capability unavailable';
  if (visibleNoReadbackSupported) {
    status = 'same-device-gpu-buffer-geometry-supported';
    reason = null;
  } else if (requestedThreeCompactReadbackBridge && !noFullReadback) {
    status = 'three-compact-readback-bridge-supported';
    reason = 'requested bridge uses full readback into Three geometry';
  } else if (rendererBackend === 'three-webgl') {
    status = 'same-device-gpu-buffer-geometry-blocked-webgl-renderer';
    reason = 'same-device GPUBuffer geometry requires Three WebGPU renderer; current scene renderer is WebGLRenderer';
  } else if (rendererBackend === 'three-webgpu' && !backendBufferBindingAvailable) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-backend-api';
    reason = 'Three WebGPU renderer did not expose backend buffer binding API';
  } else if (rendererBackend === 'none') {
    status = 'same-device-gpu-buffer-geometry-blocked-missing-renderer';
    reason = 'no engine-owned Three renderer is available';
  } else {
    status = 'same-device-gpu-buffer-geometry-blocked-unknown-renderer';
    reason = 'engine-owned renderer does not advertise a supported same-device GPUBuffer geometry path';
  }
  return {
    schema: 'peercompute.ulg.sph-resident-extension-surface-renderer-capability.v0',
    status,
    reason,
    rendererBackend,
    rendererIsWebGL: rendererBackend === 'three-webgl',
    rendererIsWebGPU: rendererBackend === 'three-webgpu',
    backendBufferBindingAvailable,
    sameDeviceGpuBufferGeometrySupported,
    visibleNoReadbackSupported,
    requestedRenderBridgeMode: mode,
    requestedThreeCompactReadbackBridge,
    readbackMode: normalizedReadbackMode,
    noFullReadback
  };
}

function isThreeResidentSurfaceBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'three-points'
    || mode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'three-spheres'
    || mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
    || mode === 'three'
    || mode === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'webgpu-points'
    || mode === 'webgpu-spheres';
}
function isWebGpuResidentRenderRowBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'webgpu-points'
    || mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'webgpu-spheres';
}
function isResidentRenderRowBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'three-points'
    || mode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'three-spheres'
    || mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
    || mode === 'three'
    || isWebGpuResidentRenderRowBridgeMode(mode);
}
const SPH_SURFACE_VERTEX_ROW_INDEX = Object.freeze({
  surfaceIndex: 0,
  materialId: 1,
  phaseId: 2,
  triangleIndex: 3,
  vertexIndex: 4,
  positionXM: 5,
  positionYM: 6,
  positionZM: 7,
  normalX: 8,
  normalY: 9,
  normalZ: 10,
  opticalStateId: 11,
  density: 12,
  isolation: 13,
  sourceVoxelLinearIndex: 14,
  status: 15
});
const GPU_TEXTURE_USAGE = {
  COPY_SRC: globalThis.GPUTextureUsage?.COPY_SRC ?? 1,
  TEXTURE_BINDING: globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 4,
  RENDER_ATTACHMENT: globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 16
};
const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const GPU_SHADER_STAGE = {
  VERTEX: globalThis.GPUShaderStage?.VERTEX ?? 1,
  FRAGMENT: globalThis.GPUShaderStage?.FRAGMENT ?? 2
};

export function normalizeResidentSurfaceDrawOverlayMode(mode = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT) {
  const normalized = String(mode ?? SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled', 'enable', 'webgpu', 'overlay', 'resident'].includes(normalized)) return 'enabled';
  if (['0', 'false', 'off', 'no', 'disabled', 'disable', 'three', 'marching-cubes', 'readback'].includes(normalized)) return 'disabled';
  return 'auto';
}

export function resolveResidentSurfaceDrawOverlayPolicy({
  mode = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  container = null,
  navigatorRef = globalThis.navigator
} = {}) {
  const normalizedMode = normalizeResidentSurfaceDrawOverlayMode(mode);
  if (normalizedMode === 'disabled') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-disabled-by-policy',
      reason: SPH_THREE_WEBGPU_BINDING_REASON
    };
  }
  if (normalizedMode === 'enabled') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: true,
      status: 'surface-draw-overlay-forced',
      reason: 'raw WebGPU canvas overlay forced by scene option'
    };
  }
  const gpu = navigatorRef?.gpu || globalThis.navigator?.gpu;
  if (!gpu?.getPreferredCanvasFormat) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: 'navigator.gpu canvas format support unavailable'
    };
  }
  if (typeof container?.ownerDocument?.createElement !== 'function') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: 'document canvas creation unavailable'
    };
  }
  try {
    const probeCanvas = container.ownerDocument.createElement('canvas');
    if (!probeCanvas?.getContext?.('webgpu')) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
        mode: normalizedMode,
        enabled: false,
        status: 'surface-draw-overlay-auto-unavailable',
        reason: 'WebGPU canvas context unavailable'
      };
    }
  } catch (error) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  return {
    schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
    mode: normalizedMode,
    enabled: true,
    status: 'surface-draw-overlay-auto-ready',
    reason: 'WebGPU canvas overlay available'
  };
}

export function residentRenderFieldReadbackModeForSurfaceOverlay(enabled) {
  return enabled ? RESIDENT_NO_FULL_READBACK_MODE : RESIDENT_FULL_READBACK_MODE;
}

function pressureFeedbackFromGasPressureSummary(gasPressureSummary) {
  if (!gasPressureSummary) return null;
  if (gasPressureSummary.pressureFeedback) return gasPressureSummary.pressureFeedback;
  if (gasPressureSummary.gasCellField || gasPressureSummary.pressureGaugePa != null) return gasPressureSummary;
  return null;
}

function sceneStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function uniqueSceneStringList(values = []) {
  return [...new Set(sceneStringList(values))];
}

function pressureInterfaceGasCellFieldFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return pressureFeedback?.gasCellField
    || gasPressureSummary?.gasCellField
    || gasPressureSummary?.localGasCellField
    || null;
}

function pressureInterfaceGasCellFieldFromProducerResult(producerResult = null) {
  return producerResult?.gasCellFieldSnapshot
    || producerResult?.gasCellField
    || producerResult?.pressureFeedback?.gasCellField
    || null;
}

function pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return gasPressureSummary?.spatialGasSpeciesLedger
    || pressureFeedback?.spatialGasSpeciesLedger
    || gasPressureSummary?.gasCellField?.spatialGasSpeciesLedger
    || null;
}

function pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger = null) {
  return spatialGasSpeciesLedger?.schema === 'peercompute.ulg.sph-spatial-gas-species-ledger.v0'
    && Array.isArray(spatialGasSpeciesLedger.cells)
    && spatialGasSpeciesLedger.cells.length > 0;
}

function pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult = null) {
  return producerResult?.retainedGasCellFieldSource
    || producerResult?.pressureInterfaceGasCellFieldImport?.retainedGasCellFieldSource
    || producerResult?.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
    || null;
}

function pressureInterfaceGasCellFieldAdmissionFromSummary(gasPressureSummary = null, explicitAdmission = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return explicitAdmission
    || gasPressureSummary?.pressureInterfaceGasCellFieldAdmission
    || gasPressureSummary?.gasCellFieldAdmission
    || pressureFeedback?.pressureInterfaceGasCellFieldAdmission
    || pressureFeedback?.gasCellFieldAdmission
    || pressureInterfaceGasCellFieldFromSummary(gasPressureSummary)?.pressureInterfaceGasCellFieldAdmission
    || null;
}

function retainedGasPressureRefsFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const gasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  return uniqueSceneStringList([
    ...sceneStringList(gasPressureSummary?.retainedGasPressureBufferRefs),
    ...sceneStringList(gasPressureSummary?.residentGasPressureBufferRefs),
    ...sceneStringList(gasPressureSummary?.pressureInterfaceRetainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.retainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.residentGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.retainedGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.residentGasPressureBufferRefs)
  ]);
}

function retainedGasPressureRefsFromProducerResult(producerResult = null) {
  const retainedSource = pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult);
  return uniqueSceneStringList([
    ...sceneStringList(producerResult?.retainedGasPressureBufferRefs),
    ...sceneStringList(producerResult?.residentGasPressureBufferRefs),
    ...sceneStringList(retainedSource?.retainedGasPressureBufferRefs)
  ]);
}

function workerRetainedGasPressureRefsFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const gasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  return uniqueSceneStringList([
    ...sceneStringList(gasPressureSummary?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.workerRetainedGasPressureBufferRefs)
  ]);
}

function workerRetainedGasPressureRefsFromProducerResult(producerResult = null) {
  const retainedSource = pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult);
  return uniqueSceneStringList([
    ...sceneStringList(producerResult?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(retainedSource?.workerRetainedGasPressureBufferRefs)
  ]);
}

function gasCellEosProducerResultFromSubmission(submission = null) {
  return submission?.result
    || submission?.taskResult
    || submission?.execution
    || submission?.value
    || submission
    || null;
}

function spatialGasLedgerProducerResultFromSubmission(submission = null) {
  return submission?.result
    || submission?.taskResult
    || submission?.execution
    || submission?.value
    || submission
    || null;
}

export async function submitSceneSpatialGasLedgerProducerStageForPressureInterface({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  residentProductMass = null,
  reactionSummary = null,
  reactionTable = null,
  preferWebGpu = true,
  navigatorRef = null,
  device = null,
  deviceResult = null,
  readbackMode = RESIDENT_NO_FULL_READBACK_MODE,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceStage = 'residentProductMass',
  boxDimsM = null
} = {}) {
  const existingLedger = pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary);
  const productEventRowCount = Math.max(0, Math.round(Number(
    residentProductMass?.productEventRowCount ?? reactionSummary?.productEventRowCount
  ) || 0));
  const productEventBufferRetained = residentProductMass?.productEventBufferRetained === true
    || reactionSummary?.productEventBufferRetained === true;
  const taskId = sourceTaskId || cacheKey || `ulg:scene-spatial-gas-ledger-producer:${source}:${stateKey || 'active'}`;
  const base = {
    schema: 'peercompute.ulg.sph-scene-spatial-gas-ledger-producer-stage-request.v0',
    source,
    sourceCadence,
    sourceStage,
    sourceTaskId: taskId,
    stateKey,
    gasPressureSummarySchema: gasPressureSummary?.schema || null,
    gasPressureSummaryStatus: gasPressureSummary?.status || null,
    existingSpatialGasSpeciesLedgerSchema: existingLedger?.schema || null,
    existingSpatialGasSpeciesLedgerStatus: existingLedger?.status || null,
    existingSpatialGasSpeciesLedgerCellCount: Array.isArray(existingLedger?.cells) ? existingLedger.cells.length : 0,
    productEventRowCount,
    productEventBufferRetained,
    spatialGasLedgerProducerStageResult: null,
    spatialGasLedgerProducerStageResultReady: false,
    spatialGasLedgerProducerRetainedSourceReady: false,
    spatialGasSpeciesLedger: null
  };
  if (pressureInterfaceSpatialGasSpeciesLedgerReady(existingLedger)) {
    return {
      ...base,
      status: 'spatial-gas-ledger-already-ready',
      blocker: null,
      spatialGasLedgerProducerStageResultReady: true,
      spatialGasSpeciesLedger: existingLedger,
      spatialGasSpeciesLedgerCellCount: Array.isArray(existingLedger.cells) ? existingLedger.cells.length : 0
    };
  }
  if (!productEventRowCount || !productEventBufferRetained) {
    return {
      ...base,
      status: 'blocked-retained-product-event-buffer-required',
      blocker: 'retained-product-event-buffer-with-rows-required'
    };
  }
  const submitter = residentAuthorityHost?.submitSpatialGasLedgerProducerStageTask;
  if (typeof submitter !== 'function') {
    return {
      ...base,
      status: 'blocked-resident-authority-host-spatial-gas-ledger-producer-submit-required',
      blocker: 'resident-authority-host-spatial-gas-ledger-producer-submit-required'
    };
  }
  try {
    const submission = await submitter.call(residentAuthorityHost, {
      taskId,
      gasPressureSummary,
      residentProductMass,
      reactionSummary,
      reactionTable,
      productEventBuffer: residentProductMass?.productEventBuffer || reactionSummary?.productEventBuffer || null,
      productEventRowCount,
      productEventStrideFloats: residentProductMass?.productEventStrideFloats
        ?? reactionSummary?.productEvents?.rowStrideFloats
        ?? undefined,
      boxDimsM: boxDimsM || gasPressureSummary?.boxDimsM || null,
      preferWebGpu,
      navigatorRef,
      device,
      deviceResult,
      readbackMode,
      stateKey,
      laneId: stateKey ? `ulg:scene-spatial-gas-ledger-producer:${stateKey}` : undefined,
      source: 'scene-mounted-pressure-interface-spatial-gas-ledger-producer'
    });
    const result = spatialGasLedgerProducerResultFromSubmission(submission);
    const spatialGasSpeciesLedger = result?.spatialGasSpeciesLedger || null;
    const resultReady = pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger);
    return {
      ...base,
      status: resultReady
        ? 'spatial-gas-ledger-producer-stage-result-ready'
        : (result?.status || 'spatial-gas-ledger-producer-stage-result-blocked'),
      blocker: resultReady ? null : (result?.reason || 'spatial-gas-ledger-producer-stage-result-not-ready'),
      submissionStatus: submission?.status || null,
      spatialGasLedgerProducerStageResult: result,
      spatialGasLedgerProducerStageResultReady: resultReady,
      spatialGasLedgerProducerRetainedSourceReady: result?.retainedSpatialGasLedgerSourceReady === true,
      spatialGasSpeciesLedger,
      spatialGasSpeciesLedgerCellCount: Array.isArray(spatialGasSpeciesLedger?.cells)
        ? spatialGasSpeciesLedger.cells.length
        : 0,
      aggregateSpatialGasLedgerFallbackUsed: result?.aggregateSpatialGasLedgerFallbackUsed === true,
      spatialGasLedgerDerivation: result?.spatialGasLedgerDerivation
        || spatialGasSpeciesLedger?.spatialGasLedgerDerivation
        || null,
      spatialGasPositionSource: result?.spatialGasPositionSource
        || spatialGasSpeciesLedger?.spatialGasPositionSource
        || null,
      compactSpatialGasRowCount: result?.compactSpatialGasRowCount ?? 0,
      compactSpatialGasReadbackByteLength: result?.compactSpatialGasReadbackByteLength ?? 0,
      fullProductEventReadbackPerformed: result?.fullProductEventReadbackPerformed === true
    };
  } catch (error) {
    return {
      ...base,
      status: 'spatial-gas-ledger-producer-stage-submit-error',
      blocker: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function submitSceneGasCellEosProducerStageForPressureInterface({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  preferWebGpu = true,
  navigatorRef = null,
  device = null,
  deviceResult = null,
  readbackMode = RESIDENT_NO_FULL_READBACK_MODE,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceStage = 'residentGasPressure',
  boxDimsM = null
} = {}) {
  const spatialGasSpeciesLedger = pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary);
  const taskId = sourceTaskId || cacheKey || `ulg:scene-gas-cell-eos-producer:${source}:${stateKey || 'active'}`;
  const base = {
    schema: 'peercompute.ulg.sph-scene-gas-cell-eos-producer-stage-request.v0',
    source,
    sourceCadence,
    sourceStage,
    sourceTaskId: taskId,
    stateKey,
    gasPressureSummarySchema: gasPressureSummary?.schema || null,
    gasPressureSummaryStatus: gasPressureSummary?.status || null,
    spatialGasSpeciesLedgerSchema: spatialGasSpeciesLedger?.schema || null,
    spatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status || null,
    spatialGasSpeciesLedgerCellCount: Array.isArray(spatialGasSpeciesLedger?.cells)
      ? spatialGasSpeciesLedger.cells.length
      : 0,
    gasCellEosProducerStageResult: null,
    gasCellEosProducerStageResultReady: false,
    gasCellEosProducerRetainedSourceReady: false
  };
  if (!pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger)) {
    return {
      ...base,
      status: 'blocked-spatial-gas-species-ledger-required',
      blocker: 'ready-spatial-gas-species-ledger-required'
    };
  }
  const submitter = residentAuthorityHost?.submitGasCellEosProducerStageTask;
  if (typeof submitter !== 'function') {
    return {
      ...base,
      status: 'blocked-resident-authority-host-gas-cell-eos-producer-submit-required',
      blocker: 'resident-authority-host-gas-cell-eos-producer-submit-required'
    };
  }
  try {
    const submission = await submitter.call(residentAuthorityHost, {
      taskId,
      gasPressureSummary,
      pressureSummary: gasPressureSummary,
      spatialGasSpeciesLedger,
      boxDimsM: boxDimsM || gasPressureSummary?.boxDimsM || null,
      preferWebGpu,
      navigatorRef,
      device,
      deviceResult,
      readbackMode,
      stateKey,
      laneId: stateKey ? `ulg:scene-gas-cell-eos-producer:${stateKey}` : undefined,
      source: 'scene-mounted-pressure-interface-gas-cell-eos-producer'
    });
    const result = gasCellEosProducerResultFromSubmission(submission);
    const gasCellField = pressureInterfaceGasCellFieldFromProducerResult(result);
    const resultReady = Boolean(
      result
        && gasCellField?.localPressureGradientReady === true
        && Array.isArray(gasCellField.cells)
        && gasCellField.cells.length > 0
    );
    const retainedSourceReady = result?.retainedGasCellFieldSourceReady === true
      || pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(result)?.status === 'pressure-interface-retained-gas-cell-field-source-ready';
    return {
      ...base,
      status: resultReady
        ? 'gas-cell-eos-producer-stage-result-ready'
        : (result?.status || 'gas-cell-eos-producer-stage-result-blocked'),
      blocker: resultReady ? null : (result?.reason || 'gas-cell-eos-producer-stage-result-not-ready'),
      submissionStatus: submission?.status || null,
      gasCellEosProducerStageResult: result,
      gasCellEosProducerStageResultReady: resultReady,
      gasCellEosProducerRetainedSourceReady: retainedSourceReady,
      retainedGasPressureBufferRefs: retainedGasPressureRefsFromProducerResult(result),
      workerRetainedGasPressureBufferRefs: workerRetainedGasPressureRefsFromProducerResult(result)
    };
  } catch (error) {
    return {
      ...base,
      status: 'gas-cell-eos-producer-stage-request-error',
      blocker: error instanceof Error ? error.message : String(error)
    };
  }
}

function blockedPressureInterfaceGasCellFieldImportPublication({
  status,
  blocker,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  gasPressureSummary = null,
  gasCellField = null,
  pressureInterfaceGasCellFieldAdmission = null,
  pressureInterfaceGasCellFieldAdmissionPublication = null,
  retainedGasPressureBufferRefs = [],
  workerRetainedGasPressureBufferRefs = []
} = {}) {
  return {
    schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
    status,
    blocker: blocker || status,
    source,
    sourceCadence,
    sourceGasPressureSummarySchema: gasPressureSummary?.schema ?? null,
    sourceGasPressureSummaryStatus: gasPressureSummary?.status ?? null,
    pressureInterfaceGasCellFieldImport: null,
    pressureInterfaceGasCellFieldImportReady: false,
    pressureInterfaceGasCellFieldImportSchema: null,
    pressureInterfaceGasCellFieldImportStatus: status,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: null,
    gasCellFieldSnapshotReady: Boolean(
      gasCellField?.localPressureGradientReady === true
      && Array.isArray(gasCellField?.cells)
      && gasCellField.cells.length > 0
    ),
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldAdmission?.schema || null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldAdmission?.status || null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureInterfaceGasCellFieldAdmission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
      && pressureInterfaceGasCellFieldAdmission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
      && pressureInterfaceGasCellFieldAdmission?.gasCellFieldConsumptionApproved === true,
    pressureInterfaceGasCellFieldAdmissionPublication,
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureInterfaceGasCellFieldAdmissionPublication?.schema || null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureInterfaceGasCellFieldAdmissionPublication?.status || null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureInterfaceGasCellFieldAdmissionPublication?.hotBufferKey || null,
    retainedGasPressureBufferRefs: [...retainedGasPressureBufferRefs],
    workerRetainedGasPressureBufferRefs: [...workerRetainedGasPressureBufferRefs],
    retainedGasPressureBufferRefCount: retainedGasPressureBufferRefs.length,
    workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
    authoritativeStateMutation: false,
    stateManagerAdmissionRequired: true,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function publishScenePressureInterfaceGasCellFieldImportSource({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  gasCellEosProducerStageResult = null,
  pressureInterfaceGasCellFieldAdmission = null,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-pressure-law',
  sourceStage = 'residentGasPressure',
  hotBufferKeyPrefix = 'ulg:scene-pressure-interface-gas-cell-field-import',
  allowSummaryGasCellFieldImport = true
} = {}) {
  const producerGasCellField = pressureInterfaceGasCellFieldFromProducerResult(gasCellEosProducerStageResult);
  const summaryGasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  const candidateGasCellField = producerGasCellField || summaryGasCellField;
  const gasCellField = producerGasCellField || (allowSummaryGasCellFieldImport ? summaryGasCellField : null);
  const sourceObject = producerGasCellField
    ? gasCellEosProducerStageResult
    : (allowSummaryGasCellFieldImport ? gasPressureSummary : null);
  const effectiveSourceStage = producerGasCellField ? 'gasCellEosProducer' : sourceStage;
  const effectiveSourceTaskId = sourceTaskId || (producerGasCellField ? gasCellEosProducerStageResult?.computeTaskId : null);
  let admission = pressureInterfaceGasCellFieldAdmissionFromSummary(
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission
  );
  const retainedGasPressureBufferRefs = uniqueSceneStringList([
    ...retainedGasPressureRefsFromProducerResult(gasCellEosProducerStageResult),
    ...retainedGasPressureRefsFromSummary(gasPressureSummary)
  ]);
  const workerRetainedGasPressureBufferRefs = uniqueSceneStringList([
    ...workerRetainedGasPressureRefsFromProducerResult(gasCellEosProducerStageResult),
    ...workerRetainedGasPressureRefsFromSummary(gasPressureSummary)
  ]);
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
  let admissionApproved = admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
    && admission?.gasCellFieldConsumptionApproved === true;
  const publisher = residentAuthorityHost?.publishPressureInterfaceGasCellFieldImportSource;
  const admissionPublisher = residentAuthorityHost?.publishPressureInterfaceGasCellFieldAdmission;
  let admissionPublication = null;
  const blockedBase = {
    source,
    sourceCadence,
    gasPressureSummary,
    gasCellField: candidateGasCellField,
    pressureInterfaceGasCellFieldAdmission: admission,
    pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  };
  if (!gasPressureSummary && !sourceObject) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-gas-pressure-summary-unavailable',
      blocker: 'gas-pressure-summary-or-gas-cell-eos-producer-result-required'
    });
  }
  if (!producerGasCellField && !allowSummaryGasCellFieldImport) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-snapshot-gas-cell-import-disabled',
      blocker: 'gas-cell-eos-producer-result-or-supplied-import-required'
    });
  }
  if (!localPressureGradientReady) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-local-gas-cell-gradient-field-unavailable',
      blocker: 'ready-local-gas-cell-gradient-field-required'
    });
  }
  if (!admissionApproved && (retainedGasPressureBufferRefs.length > 0 || workerRetainedGasPressureBufferRefs.length > 0) && typeof admissionPublisher === 'function') {
    try {
      admissionPublication = admissionPublisher.call(residentAuthorityHost, {
        cacheKey,
        stateKey,
        source: sourceObject,
        sourceTaskId: effectiveSourceTaskId,
        sourceNodeId,
        sourceStage: effectiveSourceStage,
        gasCellFieldSnapshot: gasCellField,
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs
      });
      admission = admissionPublication?.pressureInterfaceGasCellFieldAdmission || admission;
      admissionApproved = admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
        && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
        && admission?.gasCellFieldConsumptionApproved === true;
    } catch (error) {
      return blockedPressureInterfaceGasCellFieldImportPublication({
        ...blockedBase,
        pressureInterfaceGasCellFieldAdmission: admission,
        pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
        status: 'pressure-interface-gas-cell-field-admission-publication-error',
        blocker: error instanceof Error ? error.message : String(error)
      });
    }
  }
  if (!admissionApproved) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-gas-cell-field-consumption-admission-required',
      blocker: 'pressure-interface-gas-cell-field-admission-required'
    });
  }
  if (retainedGasPressureBufferRefs.length === 0 && workerRetainedGasPressureBufferRefs.length === 0) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-retained-gas-cell-buffer-ref-required',
      blocker: 'retained-gas-cell-buffer-ref-required'
    });
  }
  if (typeof publisher !== 'function') {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-resident-authority-host-publisher-unavailable',
      blocker: 'resident-authority-host-publisher-required'
    });
  }
  try {
    const publication = publisher.call(residentAuthorityHost, {
      cacheKey,
      stateKey,
      hotBufferKeyPrefix,
      source: sourceObject,
      sourceTaskId: effectiveSourceTaskId,
      sourceNodeId,
      sourceStage: effectiveSourceStage,
      gasCellFieldSnapshot: gasCellField,
      pressureInterfaceGasCellFieldAdmission: admission,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs
    });
    const importDescriptor = publication?.pressureInterfaceGasCellFieldImport || null;
    return {
      schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
      status: publication?.status || 'pressure-interface-gas-cell-field-import-published',
      blocker: null,
      source,
      sourceCadence,
      publication,
      hotBufferKey: publication?.hotBufferKey || importDescriptor?.sourceHotBufferKey || null,
      committed: publication?.committed === true,
      commitDeltaTaskId: publication?.commitDeltaTaskId || null,
      commitDeltaScope: publication?.commitDeltaScope || null,
      pressureInterfaceGasCellFieldImport: importDescriptor,
      pressureInterfaceGasCellFieldImportReady: importDescriptor?.status === 'pressure-interface-gas-cell-field-import-ready',
      pressureInterfaceGasCellFieldImportSchema: importDescriptor?.schema || null,
      pressureInterfaceGasCellFieldImportStatus: importDescriptor?.status || null,
      pressureInterfaceGasCellFieldImportSourceHotBufferKey: importDescriptor?.sourceHotBufferKey || publication?.hotBufferKey || null,
      gasCellFieldSnapshotReady: true,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionSchema: admission.schema,
      pressureInterfaceGasCellFieldAdmissionStatus: admission.status,
      pressureInterfaceGasCellFieldAdmissionApproved: true,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      pressureInterfaceGasCellFieldAdmissionPublicationSchema: admissionPublication?.schema || null,
      pressureInterfaceGasCellFieldAdmissionPublicationStatus: admissionPublication?.status || null,
      pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: admissionPublication?.hotBufferKey || null,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs,
      retainedGasPressureBufferRefCount: retainedGasPressureBufferRefs.length,
      workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
      authoritativeStateMutation: false,
      stateManagerAdmissionRequired: true,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'pressure-interface-gas-cell-field-import-publication-error',
      blocker: error instanceof Error ? error.message : String(error)
    });
  }
}

function pressureInterfaceForceRowsUploadFields(upload = null) {
  return {
    pressureInterfaceForceRowsUploadStatus: upload?.pressureInterfaceForceRowsUploadStatus ?? upload?.status ?? null,
    pressureInterfaceForceRowsUploadBlocker: upload?.blocker
      ?? upload?.pressureInterfaceForceRowsUploadBlocker
      ?? null,
    pressureInterfaceForceRowsBufferRetained: Boolean(
      upload?.bufferRetained ?? upload?.pressureInterfaceForceRowsBufferRetained
    ),
    pressureInterfaceForceRowsBufferByteLength: upload?.forceRowByteLength
      ?? upload?.pressureInterfaceForceRowsBufferByteLength
      ?? 0,
    pressureInterfaceForceRowsCandidateByteLength: upload?.candidateForceRowByteLength
      ?? upload?.pressureInterfaceForceRowsCandidateByteLength
      ?? 0,
    pressureInterfaceForceRowsUploadSignature: upload?.signature
      ?? upload?.pressureInterfaceForceRowsUploadSignature
      ?? null,
    pressureInterfaceForceRowsUploadQueueCompletionStatus: upload?.pressureInterfaceForceRowsUploadQueueCompletionStatus
      ?? upload?.queueCompletionStatus
      ?? null,
    pressureInterfaceForceRowsUploadQueueCompletionMethod: upload?.pressureInterfaceForceRowsUploadQueueCompletionMethod
      ?? upload?.queueCompletionMethod
      ?? null,
    pressureInterfaceForceRowsConsumerQueueCompletionStatus: upload?.pressureInterfaceForceRowsConsumerQueueCompletionStatus
      ?? null,
    pressureInterfaceForceRowsConsumerQueueCompletionMethod: upload?.pressureInterfaceForceRowsConsumerQueueCompletionMethod
      ?? null,
    pressureInterfaceForceRowsUploadCleanupStatus: upload?.pressureInterfaceForceRowsUploadCleanupStatus
      ?? null,
    pressureInterfaceForceRowsUploadDestroyStatus: upload?.pressureInterfaceForceRowsUploadDestroyStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSchema: upload?.pressureInterfaceGridForceAdmissionSchema
      ?? upload?.gridForceAdmissionSchema
      ?? null,
    pressureInterfaceGridForceAdmissionStatus: upload?.pressureInterfaceGridForceAdmissionStatus
      ?? upload?.gridForceAdmissionStatus
      ?? null,
    pressureInterfaceGridForceAdmissionApproved: Boolean(
      upload?.pressureInterfaceGridForceAdmissionApproved
      ?? upload?.gridForceAdmissionApproved
    ),
    pressureInterfaceGridForceAdmissionDescriptorStatus: upload?.pressureInterfaceGridForceAdmissionDescriptorStatus
      ?? upload?.gridForceAdmissionDescriptorStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: upload?.pressureInterfaceGridForceAdmissionSourceHotBufferKey
      ?? upload?.gridForceAdmissionSourceHotBufferKey
      ?? null,
    pressureInterfaceForceRowsLeaseStatus: upload?.residentBufferLeaseLedgerStatus
      ?? upload?.pressureInterfaceForceRowsLeaseStatus
      ?? null,
    pressureInterfaceForceRowsLeaseResourceCount: upload?.residentBufferLeaseResourceCount
      ?? upload?.pressureInterfaceForceRowsLeaseResourceCount
      ?? 0,
    pressureInterfaceForceRowsLeaseActiveCount: upload?.residentBufferLeaseActiveLeaseCount
      ?? upload?.pressureInterfaceForceRowsLeaseActiveCount
      ?? 0,
    pressureInterfaceForceRowsLeaseSummary: upload?.residentBufferLeaseSummary
      ?? upload?.pressureInterfaceForceRowsLeaseSummary
      ?? null
  };
}

export function buildSphResidentPressureInterfaceStateSummary({
  materialInterfaceField = null,
  gasPressureSummary = null,
  pressureInterfaceCoupling = null,
  pressureInterfaceForcePreview = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceForceRowsUpload = null,
  pressureInterfaceGridForceAdmission = null,
  pressureInterfaceGasCellFieldImportPublication = null,
  spatialGasLedgerProducerStageRequest = null,
  gasCellEosProducerStageRequest = null,
  source = 'resident-pressure-interface-state',
  sourceCadence = null
} = {}) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const preview = pressureInterfaceForcePreview || gasPressureInterfaceForcePreview({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: coupling
  });
  const solver = pressureInterfaceForceSolver || gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: coupling
  });
  const uploadFields = pressureInterfaceForceRowsUploadFields(pressureInterfaceForceRowsUpload);
  const solverReady = solver.status === 'pressure-interface-force-solver-ready';
  const uploadBlockedForAdmission = solverReady
    && uploadFields.pressureInterfaceForceRowsUploadStatus === 'blocked-pressure-interface-grid-force-admission-required';
  const rowsReady = solverReady
    && uploadFields.pressureInterfaceForceRowsBufferRetained
    && uploadFields.pressureInterfaceGridForceAdmissionApproved;
  return {
    schema: 'peercompute.ulg.sph-resident-pressure-interface-state.v0',
    status: rowsReady
      ? 'resident-pressure-interface-force-rows-ready'
      : (uploadBlockedForAdmission
          ? 'resident-pressure-interface-force-rows-admission-required'
          : solverReady
          ? 'resident-pressure-interface-force-solver-ready'
          : 'resident-pressure-interface-blocked'),
    source,
    sourceCadence,
    pressureAuthority: 'resident-pressure-interface-state',
    sourceGasPressureSummarySchema: gasPressureSummary?.schema ?? null,
    sourceGasPressureSummaryStatus: gasPressureSummary?.status ?? null,
    pressureFeedbackSchema: pressureFeedback?.schema ?? null,
    pressureFeedbackStatus: pressureFeedback?.status ?? null,
    materialInterfaceField,
    materialInterfaceFieldSchema: materialInterfaceField?.schema ?? null,
    materialInterfaceFieldStatus: materialInterfaceField?.status ?? null,
    materialInterfaceReadySurfaceCount: materialInterfaceField?.readySurfaceCount ?? 0,
    materialInterfaceTotalSurfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    materialInterfaceForceCouplingStatus: solver.forceCouplingStatus
      ?? materialInterfaceField?.forceCouplingStatus
      ?? null,
    pressureInterfaceCoupling: coupling,
    pressureInterfaceCouplingSchema: coupling.schema,
    pressureInterfaceCouplingStatus: coupling.status,
    pressureInterfaceCouplingPreSolverStatus: coupling.forceCouplingStatus,
    pressureInterfaceForceCouplingStatus: solver.forceCouplingStatus
      ?? coupling.forceCouplingStatus,
    pressureInterfaceForcePreview: preview,
    pressureInterfaceForcePreviewSchema: preview.schema,
    pressureInterfaceForcePreviewStatus: preview.status,
    pressureInterfaceForceApplicationStatus: preview.forceApplicationStatus,
    pressureInterfacePreviewedElementCount: preview.previewedElementCount,
    pressureInterfaceTotalAbsForceN: preview.totalAbsInterfaceForceN,
    pressureInterfaceForceSolver: solver,
    pressureInterfaceForceSolverSchema: solver.schema,
    pressureInterfaceForceSolverStatus: solver.status,
    pressureInterfaceSolverApplicationStatus: solver.forceApplicationStatus,
    pressureInterfaceSolverForceRowCount: solver.forceRowCount,
    pressureInterfaceSolverConservationStatus: solver.conservationStatus,
    pressureInterfaceSolverConservationResidualMagnitudeN: solver.conservationResidualMagnitudeN,
    pressureInterfaceGridForceAdmission,
    pressureInterfaceGridForceAdmissionSchema: uploadFields.pressureInterfaceGridForceAdmissionSchema
      ?? pressureInterfaceGridForceAdmission?.schema
      ?? null,
    pressureInterfaceGridForceAdmissionStatus: uploadFields.pressureInterfaceGridForceAdmissionStatus
      ?? pressureInterfaceGridForceAdmission?.status
      ?? null,
    pressureInterfaceGridForceAdmissionApproved: uploadFields.pressureInterfaceGridForceAdmissionApproved,
    pressureInterfaceGridForceAdmissionDescriptorStatus: uploadFields.pressureInterfaceGridForceAdmissionDescriptorStatus
      ?? pressureInterfaceGridForceAdmission?.publicationStatus
      ?? pressureInterfaceGridForceAdmission?.admittedStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: uploadFields.pressureInterfaceGridForceAdmissionSourceHotBufferKey
      ?? pressureInterfaceGridForceAdmission?.sourceHotBufferKey
      ?? pressureInterfaceGridForceAdmission?.hotBufferKey
      ?? null,
    pressureInterfaceGasCellFieldImportPublication,
    pressureInterfaceGasCellFieldImportPublicationSchema: pressureInterfaceGasCellFieldImportPublication?.schema ?? null,
    pressureInterfaceGasCellFieldImportPublicationStatus: pressureInterfaceGasCellFieldImportPublication?.status ?? null,
    pressureInterfaceGasCellFieldImportPublicationBlocker: pressureInterfaceGasCellFieldImportPublication?.blocker ?? null,
    pressureInterfaceGasCellFieldImportPublicationCommitted: pressureInterfaceGasCellFieldImportPublication?.committed === true,
    pressureInterfaceGasCellFieldImportPublicationHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.hotBufferKey
      ?? pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey
      ?? null,
    pressureInterfaceGasCellFieldImport: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImport ?? null,
    pressureInterfaceGasCellFieldImportSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSchema ?? null,
    pressureInterfaceGasCellFieldImportStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportStatus ?? null,
    pressureInterfaceGasCellFieldImportReady: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldAdmission: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmission ?? null,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionApproved === true,
    pressureInterfaceGasCellFieldAdmissionPublication: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublication ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs: [
      ...(pressureInterfaceGasCellFieldImportPublication?.retainedGasPressureBufferRefs || [])
    ],
    pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs: [
      ...(pressureInterfaceGasCellFieldImportPublication?.workerRetainedGasPressureBufferRefs || [])
    ],
    spatialGasLedgerProducerStageRequest,
    spatialGasLedgerProducerStageRequestSchema: spatialGasLedgerProducerStageRequest?.schema ?? null,
    spatialGasLedgerProducerStageRequestStatus: spatialGasLedgerProducerStageRequest?.status ?? null,
    spatialGasLedgerProducerStageRequestBlocker: spatialGasLedgerProducerStageRequest?.blocker ?? null,
    spatialGasLedgerProducerStageResultReady: spatialGasLedgerProducerStageRequest?.spatialGasLedgerProducerStageResultReady === true,
    spatialGasLedgerProducerRetainedSourceReady: spatialGasLedgerProducerStageRequest?.spatialGasLedgerProducerRetainedSourceReady === true,
    spatialGasLedgerProducerStageSpatialLedgerCellCount: spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedgerCellCount ?? 0,
    spatialGasLedgerProducerAggregateFallbackUsed: spatialGasLedgerProducerStageRequest?.aggregateSpatialGasLedgerFallbackUsed === true,
    spatialGasLedgerProducerSpatialGasLedgerDerivation: spatialGasLedgerProducerStageRequest?.spatialGasLedgerDerivation
      ?? spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger?.spatialGasLedgerDerivation
      ?? null,
    spatialGasLedgerProducerSpatialGasPositionSource: spatialGasLedgerProducerStageRequest?.spatialGasPositionSource
      ?? spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger?.spatialGasPositionSource
      ?? null,
    spatialGasLedgerProducerCompactSpatialGasRowCount: spatialGasLedgerProducerStageRequest?.compactSpatialGasRowCount ?? 0,
    spatialGasLedgerProducerCompactSpatialGasReadbackByteLength: spatialGasLedgerProducerStageRequest?.compactSpatialGasReadbackByteLength ?? 0,
    spatialGasLedgerProducerFullProductEventReadbackPerformed: spatialGasLedgerProducerStageRequest?.fullProductEventReadbackPerformed === true,
    gasCellEosProducerStageRequest,
    gasCellEosProducerStageRequestSchema: gasCellEosProducerStageRequest?.schema ?? null,
    gasCellEosProducerStageRequestStatus: gasCellEosProducerStageRequest?.status ?? null,
    gasCellEosProducerStageRequestBlocker: gasCellEosProducerStageRequest?.blocker ?? null,
    gasCellEosProducerStageResultReady: gasCellEosProducerStageRequest?.gasCellEosProducerStageResultReady === true,
    gasCellEosProducerRetainedSourceReady: gasCellEosProducerStageRequest?.gasCellEosProducerRetainedSourceReady === true,
    gasCellEosProducerStageSpatialLedgerCellCount: gasCellEosProducerStageRequest?.spatialGasSpeciesLedgerCellCount ?? 0,
    ...uploadFields,
    gpuAuthoritativeState: Boolean(rowsReady || materialInterfaceField?.sourceRenderFieldReadback === false),
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    pressureInterfaceValidation: false,
    fullPhysicsValidation: false
  };
}

function pressureInterfaceRenderStateFields(pressureState = null) {
  return {
    residentPressureInterfaceStateSchema: pressureState?.schema ?? null,
    residentPressureInterfaceStateStatus: pressureState?.status ?? null,
    residentPressureInterfaceStateSource: pressureState?.source ?? null,
    residentPressureInterfaceStateSourceCadence: pressureState?.sourceCadence ?? null,
    pressureAuthority: pressureState?.pressureAuthority ?? null,
    materialInterfaceForceCouplingStatus: pressureState?.materialInterfaceForceCouplingStatus ?? null,
    pressureInterfaceCoupling: pressureState?.pressureInterfaceCoupling ?? null,
    pressureInterfaceCouplingSchema: pressureState?.pressureInterfaceCouplingSchema ?? null,
    pressureInterfaceCouplingStatus: pressureState?.pressureInterfaceCouplingStatus ?? null,
    pressureInterfaceCouplingPreSolverStatus: pressureState?.pressureInterfaceCouplingPreSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: pressureState?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForcePreview: pressureState?.pressureInterfaceForcePreview ?? null,
    pressureInterfaceForcePreviewSchema: pressureState?.pressureInterfaceForcePreviewSchema ?? null,
    pressureInterfaceForcePreviewStatus: pressureState?.pressureInterfaceForcePreviewStatus ?? null,
    pressureInterfaceForceApplicationStatus: pressureState?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfacePreviewedElementCount: pressureState?.pressureInterfacePreviewedElementCount ?? 0,
    pressureInterfaceTotalAbsForceN: pressureState?.pressureInterfaceTotalAbsForceN ?? 0,
    pressureInterfaceForceSolver: pressureState?.pressureInterfaceForceSolver ?? null,
    pressureInterfaceForceSolverSchema: pressureState?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: pressureState?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceSolverApplicationStatus: pressureState?.pressureInterfaceSolverApplicationStatus ?? null,
    pressureInterfaceSolverForceRowCount: pressureState?.pressureInterfaceSolverForceRowCount ?? 0,
    pressureInterfaceSolverConservationStatus: pressureState?.pressureInterfaceSolverConservationStatus ?? null,
    pressureInterfaceSolverConservationResidualMagnitudeN: pressureState?.pressureInterfaceSolverConservationResidualMagnitudeN ?? 0,
    pressureInterfaceGridForceAdmission: pressureState?.pressureInterfaceGridForceAdmission ?? null,
    pressureInterfaceGridForceAdmissionSchema: pressureState?.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: pressureState?.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: pressureState?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: pressureState?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: pressureState?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldImportPublication: pressureState?.pressureInterfaceGasCellFieldImportPublication ?? null,
    pressureInterfaceGasCellFieldImportPublicationSchema: pressureState?.pressureInterfaceGasCellFieldImportPublicationSchema ?? null,
    pressureInterfaceGasCellFieldImportPublicationStatus: pressureState?.pressureInterfaceGasCellFieldImportPublicationStatus ?? null,
    pressureInterfaceGasCellFieldImportPublicationBlocker: pressureState?.pressureInterfaceGasCellFieldImportPublicationBlocker ?? null,
    pressureInterfaceGasCellFieldImportPublicationCommitted: pressureState?.pressureInterfaceGasCellFieldImportPublicationCommitted ?? false,
    pressureInterfaceGasCellFieldImportPublicationHotBufferKey: pressureState?.pressureInterfaceGasCellFieldImportPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldImport: pressureState?.pressureInterfaceGasCellFieldImport ?? null,
    pressureInterfaceGasCellFieldImportSchema: pressureState?.pressureInterfaceGasCellFieldImportSchema ?? null,
    pressureInterfaceGasCellFieldImportStatus: pressureState?.pressureInterfaceGasCellFieldImportStatus ?? null,
    pressureInterfaceGasCellFieldImportReady: pressureState?.pressureInterfaceGasCellFieldImportReady ?? false,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureState?.pressureInterfaceGasCellFieldImportSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldAdmission: pressureState?.pressureInterfaceGasCellFieldAdmission ?? null,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureState?.pressureInterfaceGasCellFieldAdmissionSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureState?.pressureInterfaceGasCellFieldAdmissionStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureState?.pressureInterfaceGasCellFieldAdmissionApproved ?? false,
    pressureInterfaceGasCellFieldAdmissionPublication: pressureState?.pressureInterfaceGasCellFieldAdmissionPublication ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs: [
      ...(pressureState?.pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs || [])
    ],
    pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs: [
      ...(pressureState?.pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs || [])
    ],
    ...pressureInterfaceForceRowsUploadFields(pressureState)
  };
}

const SURFACE_CONFIG = {
  h2o: {
    resolution: 18,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 24000
  },
  fe: {
    resolution: 18,
    subtract: 26,
    isolation: 82,
    maxPolyCount: 24000
  },
  // Vaporized water: a faint, diffuse cloud rather than a tight blob. Lower isolation + larger
  // ball influence makes the metaballs bleed together into a whispy volume; high transparency and
  // no depth-write let it read as steam drifting in front of the scene.
  steam: {
    resolution: 16,
    subtract: 10,
    isolation: 24,
    maxPolyCount: 20000
  },
  default: {
    resolution: 18,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 24000
  }
};

const CPU_SURFACE_ADAPTIVE_RESOLUTION = Object.freeze([
  { maxParticles: 8, resolution: 12, maxPolyCount: 9000 },
  { maxParticles: 27, resolution: 14, maxPolyCount: 14000 },
  { maxParticles: 64, resolution: 16, maxPolyCount: 19000 }
]);

export const SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) material_id: f32,
  @location(2) phase_id: f32,
  @location(3) optical_state_id: f32,
};

@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> spectral_samples: array<vec4<f32>>;

struct OitFragmentOut {
  @location(0) accum: vec4<f32>,
  @location(1) revealage: vec4<f32>,
};

struct OpticalMaterial {
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
  optical_depth: f32,
  spectral_tint_linear: vec3<f32>,
  status: f32,
  blocked: f32,
  found: f32,
};

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

fn optical_record_count() -> u32 {
  return arrayLength(&optical_records) / 6u;
}

fn optical_record_row(record_index: u32, row_index: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row_index];
}

fn spectral_sample_count() -> u32 {
  return arrayLength(&spectral_samples) / 2u;
}

fn spectral_sample_row(sample_index: u32, row_index: u32) -> vec4<f32> {
  return spectral_samples[sample_index * 2u + row_index];
}

fn spectral_wavelength_rgb(wavelength_nm: f32) -> vec3<f32> {
  let w = clamp(wavelength_nm, 380.0, 780.0);
  var rgb = vec3<f32>(0.0);
  if (w < 440.0) {
    rgb = vec3<f32>(-(w - 440.0) / 60.0, 0.0, 1.0);
  } else if (w < 490.0) {
    rgb = vec3<f32>(0.0, (w - 440.0) / 50.0, 1.0);
  } else if (w < 510.0) {
    rgb = vec3<f32>(0.0, 1.0, -(w - 510.0) / 20.0);
  } else if (w < 580.0) {
    rgb = vec3<f32>((w - 510.0) / 70.0, 1.0, 0.0);
  } else if (w < 645.0) {
    rgb = vec3<f32>(1.0, -(w - 645.0) / 65.0, 0.0);
  } else {
    rgb = vec3<f32>(1.0, 0.0, 0.0);
  }
  let edge = select(
    select(1.0, 0.3 + 0.7 * (w - 380.0) / 40.0, w < 420.0),
    0.3 + 0.7 * (780.0 - w) / 80.0,
    w > 700.0
  );
  return pow(clamp(rgb * edge, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn spectral_tint_from_samples(spectral_offset: f32, spectral_count_value: f32, transmission: f32) -> vec3<f32> {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  if (count == 0u || start >= total_samples) {
    return vec3<f32>(1.0);
  }
  var weighted = vec3<f32>(0.0);
  var weight_sum = 0.0;
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) {
      break;
    }
    let sample_index = start + local;
    if (sample_index >= total_samples) {
      break;
    }
    let row0 = spectral_sample_row(sample_index, 0u);
    let wavelength_rgb = spectral_wavelength_rgb(row0.x);
    let reflectance = clamp(row0.y, 0.0, 1.0);
    let transmittance = clamp(row0.z, 0.0, 1.0);
    let response = mix(reflectance, transmittance, clamp(transmission, 0.0, 1.0));
    weighted = weighted + wavelength_rgb * response;
    weight_sum = weight_sum + max(response, 0.0001);
  }
  if (!(weight_sum > 0.0)) {
    return vec3<f32>(1.0);
  }
  let tint = weighted / weight_sum;
  let max_channel = max(max(tint.r, tint.g), tint.b);
  return clamp(tint / max(max_channel, 0.0001), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn fallback_optical_material(phase_id: f32) -> OpticalMaterial {
  var color = vec3<f32>(0.72, 0.9, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.88, 0.88, 0.82);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.28, 0.7, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.86, 0.96, 1.0);
  }
  return OpticalMaterial(color, 0.0, 0.65, 0.0, 0.42, 1.0, vec3<f32>(1.0), 1.0e20, 0.0, 0.0, 0.0, vec3<f32>(1.0), 0.0, 1.0, 0.0);
}

fn find_optical_material(material_id: f32, phase_id: f32, optical_state_id: f32) -> OpticalMaterial {
  let count = optical_record_count();
  var fallback_index: i32 = -1;
  for (var record_index = 0u; record_index < count; record_index = record_index + 1u) {
    let row0 = optical_record_row(record_index, 0u);
    let row5 = optical_record_row(record_index, 5u);
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id)) {
      if (id_equal(row5.w, optical_state_id)) {
        let row1 = optical_record_row(record_index, 1u);
        let row2 = optical_record_row(record_index, 2u);
        let row3 = optical_record_row(record_index, 3u);
        let row4 = optical_record_row(record_index, 4u);
        let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
        return OpticalMaterial(
          clamp(mix(row1.xyz, row1.xyz * spectral_tint, 0.35), vec3<f32>(0.0), vec3<f32>(1.0)),
          clamp(row1.w, 0.0, 1.0),
          clamp(row2.x, 0.04, 1.0),
          clamp(row2.y, 0.0, 1.0),
          clamp(row2.z, 0.0, 1.0),
          max(row2.w, 1.0),
          clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
          max(row3.w, 0.00001),
          max(row4.x, 0.0),
          max(row4.y, 0.0),
          max(row5.x, 0.0),
          spectral_tint,
          row5.z,
          row5.y,
          1.0
        );
      }
      if (id_equal(row5.w, 0.0) && fallback_index < 0) {
        fallback_index = i32(record_index);
      }
    }
  }
  if (fallback_index >= 0) {
    let index = u32(fallback_index);
    let row0 = optical_record_row(index, 0u);
    let row1 = optical_record_row(index, 1u);
    let row2 = optical_record_row(index, 2u);
    let row3 = optical_record_row(index, 3u);
    let row4 = optical_record_row(index, 4u);
    let row5 = optical_record_row(index, 5u);
    let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
    return OpticalMaterial(
      clamp(mix(row1.xyz, row1.xyz * spectral_tint, 0.35), vec3<f32>(0.0), vec3<f32>(1.0)),
      clamp(row1.w, 0.0, 1.0),
      clamp(row2.x, 0.04, 1.0),
      clamp(row2.y, 0.0, 1.0),
      clamp(row2.z, 0.0, 1.0),
      max(row2.w, 1.0),
      clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
      max(row3.w, 0.00001),
      max(row4.x, 0.0),
      max(row4.y, 0.0),
      max(row5.x, 0.0),
      spectral_tint,
      row5.z,
      row5.y,
      1.0
    );
  }
  return fallback_optical_material(phase_id);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let base = vertex_index * 4u;
  let row0 = surface_vertices[base];
  let row1 = surface_vertices[base + 1u];
  let row2 = surface_vertices[base + 2u];
  let position_m = vec3<f32>(row1.y, row1.z, row1.w);
  var out: VertexOut;
  out.position = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  out.normal = normalize(row2.xyz + vec3<f32>(0.0001, 0.0002, 0.0003));
  out.material_id = row0.y;
  out.phase_id = row0.z;
  out.optical_state_id = row2.w;
  return out;
}

fn resident_surface_color(in: VertexOut) -> vec4<f32> {
  let optical = find_optical_material(in.material_id, in.phase_id, in.optical_state_id);
  let blocked = optical.blocked > 0.5 || optical.status == 255.0;
  let optical_depth = clamp(optical.optical_depth, 0.0, 16.0);
  let absorption_depth = clamp(optical.absorption_coefficient_per_m * min(optical.attenuation_distance_m, 1.0), 0.0, 16.0);
  let attenuation_weight = clamp(1.0 - exp(-max(optical_depth, absorption_depth)), 0.0, 1.0);
  let attenuated_base = mix(
    optical.base_color_linear,
    optical.base_color_linear * optical.attenuation_linear,
    attenuation_weight
  );
  let base_color = select(attenuated_base, vec3<f32>(0.55, 0.05, 0.18), blocked);
  let normal = normalize(in.normal);
  let light_dir = normalize(vec3<f32>(0.35, 0.7, 0.55));
  let view_dir = normalize(vec3<f32>(0.15, 0.25, 1.0));
  let half_dir = normalize(light_dir + view_dir);
  let ndotl = clamp(dot(normal, light_dir), 0.0, 1.0);
  let ndoth = clamp(dot(normal, half_dir), 0.0, 1.0);
  let roughness = clamp(optical.roughness, 0.04, 1.0);
  let metalness = clamp(optical.metalness, 0.0, 1.0);
  let diffuse = base_color * (1.0 - metalness) * (0.24 + 0.76 * ndotl);
  let ior = max(optical.ior, 1.0);
  let dielectric_f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fresnel = dielectric_f0 + (1.0 - dielectric_f0) * pow(1.0 - clamp(dot(normal, view_dir), 0.0, 1.0), 5.0);
  let f0 = mix(vec3<f32>(dielectric_f0), base_color, metalness);
  let specular_power = max(2.0, (1.0 - roughness) * (1.0 - roughness) * 128.0);
  let specular = (f0 + vec3<f32>(fresnel * (1.0 - metalness))) * pow(ndoth, specular_power) * (0.35 + 0.65 * ndotl);
  let scatter_haze = clamp(log2(1.0 + optical.scattering_coefficient_per_m) * 0.018, 0.0, 0.35);
  let rim = pow(1.0 - clamp(dot(normal, view_dir), 0.0, 1.0), 3.0) * (0.08 + scatter_haze) * (1.0 - roughness);
  let lit = diffuse + specular + base_color * rim;
  let is_vapor = round(in.phase_id) == 3.0;
  let transmissive_surface_alpha = optical.transmission > 0.01 && metalness < 0.1 && !is_vapor;
  let optical_alpha = clamp(1.0 - exp(-optical_depth), 0.0, 1.0);
  let vapor_alpha = max(clamp(optical.opacity, 0.0, 1.0), optical_alpha);
  let transmissive_alpha = clamp(max(0.08, 1.0 - optical.transmission * 0.72 + optical_alpha * 0.5), 0.08, 1.0);
  let base_alpha = select(clamp(optical.opacity, 0.0, 1.0), vapor_alpha, is_vapor);
  let alpha = select(base_alpha, transmissive_alpha, transmissive_surface_alpha);
  return vec4<f32>(lit * alpha, alpha);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  return resident_surface_color(in);
}

@fragment
fn fs_oit_main(in: VertexOut) -> OitFragmentOut {
  let color = resident_surface_color(in);
  let alpha = clamp(color.a, 0.0, 1.0);
  let weight = clamp(alpha * 8.0 + 0.01, 0.01, 8.0);
  var out: OitFragmentOut;
  out.accum = vec4<f32>(color.rgb * weight, alpha * weight);
  out.revealage = vec4<f32>(alpha, 0.0, 0.0, alpha);
  return out;
}
`;

export const SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL = `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var accum_texture: texture_2d<f32>;
@group(0) @binding(1) var reveal_texture: texture_2d<f32>;
@group(0) @binding(2) var linear_sampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let position = positions[vertex_index];
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let accum = textureSampleLevel(accum_texture, linear_sampler, in.uv, 0.0);
  let reveal = textureSampleLevel(reveal_texture, linear_sampler, in.uv, 0.0).r;
  let alpha = clamp(1.0 - reveal, 0.0, 1.0);
  let color = accum.rgb / max(accum.a, 0.00001);
  return vec4<f32>(color * alpha, alpha);
}
`;

export const SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
  viewport_radius_mode: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) quad_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;

const RENDER_ROW_VEC4_STRIDE: u32 = ${Math.max(1, Math.ceil(SPH_GPU_RENDER_ROW_FLOATS / 4))}u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row_color(row1: vec4<f32>, row2: vec4<f32>) -> vec4<f32> {
  let phase_id = round(row1.y);
  let render_domain_id = round(row2.w);
  var color = vec3<f32>(0.55, 0.78, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.9, 0.95, 1.0);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.1, 0.72, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.82, 1.0, 1.0);
  }
  if (render_domain_id == 2.0) {
    color = mix(color, vec3<f32>(1.0, 0.62, 0.25), 0.35);
  }
  let heat = clamp((row1.z - 300.0) / 1200.0, 0.0, 1.0);
  color = mix(color, vec3<f32>(1.0, 0.28, 0.08), heat * 0.45);
  return vec4<f32>(color, 1.0);
}

fn quad_corner(vertex_index: u32) -> vec2<f32> {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  return corners[vertex_index % 6u];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOut {
  let row0 = render_row0(instance_index);
  let row1 = render_row1(instance_index);
  let row2 = render_row2(instance_index);
  let represented_count = row2.z;
  let corner = quad_corner(vertex_index);
  var clip = camera_data.view_projection * vec4<f32>(row0.xyz, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  let viewport = max(camera_data.viewport_radius_mode.xy, vec2<f32>(1.0, 1.0));
  let radius_px = max(camera_data.viewport_radius_mode.z, 1.0);
  let pixel_scale = vec2<f32>(2.0 / viewport.x, 2.0 / viewport.y);
  let expanded_radius = radius_px * clamp(sqrt(max(represented_count, 1.0)), 1.0, 3.5);
  clip.xy = clip.xy + corner * pixel_scale * expanded_radius * clip.w;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  var out: VertexOut;
  out.position = clip;
  out.quad_uv = corner;
  out.color = render_row_color(row1, row2);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.quad_uv, in.quad_uv);
  if (r2 > 1.0) {
    discard;
  }
  let edge = 1.0 - smoothstep(0.72, 1.0, r2);
  return vec4<f32>(in.color.rgb * in.color.a * edge, in.color.a * edge);
}
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeResidentReadbackMode(value) {
  return value === RESIDENT_FULL_READBACK_MODE ? RESIDENT_FULL_READBACK_MODE : RESIDENT_NO_FULL_READBACK_MODE;
}

// Inset the simulation box inside the marching-cubes field cube so an isosurface that reaches a box
// face is NOT hard-clipped flat at the field boundary — the metaball is given room on the far side
// of the wall to close into a rounded surface, so a blob resting against the floor/wall renders as a
// complete dome instead of a sliced-off plane. The padding is mapped per-axis (below); the mesh
// scale is widened by 1/(1-2·pad) so the padded [0,1] field still aligns with the box wireframe.
// A metaball's surface extends ~radiusNorm·√((iso+sub)/iso) ≈ 1.15·radiusNorm from its centre, and
// radiusNorm is clamped to ≤0.14, so the surface reaches ~0.16 past a wall-hugging particle — the
// padding must exceed that to fully contain the dome. Resolutions are raised to keep box detail
// since the box now occupies only (1−2·pad) of each field axis.
const FIELD_PADDING = 0.22;
const RESIDENT_RENDER_FIELD_MAX_RESOLUTION = 64;

export function normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM, fieldPadding = FIELD_PADDING) {
  const radius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 0;
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  return clamp((radius / refEdge) * span, 0.001, 0.14);
}

export function surfaceRadiusMetersFromRenderFieldRadius(radiusNorm, refEdgeM, fieldPadding = FIELD_PADDING) {
  const norm = Number.isFinite(radiusNorm) && radiusNorm > 0 ? radiusNorm : 0;
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  return norm * refEdge / span;
}

export function cpuMarchingCubesCellSizeM(refEdgeM, resolution, fieldPadding = FIELD_PADDING) {
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  const res = Math.max(2, Math.round(Number(resolution) || 2));
  return (1 / (res - 1)) * (refEdge / span);
}

export function cpuMarchingCubesRadiusFloorM(
  refEdgeM,
  resolution,
  fieldPadding = FIELD_PADDING,
  floorCells = SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS
) {
  const cells = Math.max(
    1e-6,
    Number.isFinite(floorCells) && floorCells > 0
      ? floorCells
      : SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS
  );
  return cells * cpuMarchingCubesCellSizeM(refEdgeM, resolution, fieldPadding);
}

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

function adaptiveCpuSurfaceConfig(baseConfig, particleCount = Infinity) {
  const count = Number.isFinite(particleCount) ? particleCount : Infinity;
  if (count > 0 && count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES) {
    return {
      ...baseConfig,
      resolution: Math.max(baseConfig.resolution, SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN),
      maxPolyCount: Math.max(baseConfig.maxPolyCount, 24000)
    };
  }
  const adaptive = CPU_SURFACE_ADAPTIVE_RESOLUTION.find((entry) => count <= entry.maxParticles);
  if (!adaptive) {
    return {
      ...baseConfig,
      resolution: Math.max(baseConfig.resolution, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN),
      maxPolyCount: Math.max(baseConfig.maxPolyCount, 48000)
    };
  }
  return {
    ...baseConfig,
    resolution: Math.max(
      Math.min(baseConfig.resolution, adaptive.resolution),
      SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN
    ),
    maxPolyCount: Math.max(
      Math.min(baseConfig.maxPolyCount, adaptive.maxPolyCount),
      24000
    )
  };
}

function normalizeRenderDomainId(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeRenderDomainCounts(counts = null) {
  const base = Math.max(0, Math.round(Number(counts?.base) || 0));
  const drop = Math.max(0, Math.round(Number(counts?.drop) || 0));
  const total = Math.max(0, Math.round(Number(counts?.total) || (base + drop)));
  if (base <= 0 && drop <= 0) return null;
  return { base, drop, total };
}

function cohortRangesFromRenderDomainCounts(counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  if (!normalized) return null;
  return {
    schema: 'peercompute.ulg.sph-role-cohort-ranges.v0',
    source: 'initial-particle-order',
    base: {
      role: 'base',
      startIndex: 0,
      endIndex: normalized.base,
      count: normalized.base
    },
    drop: {
      role: 'drop',
      startIndex: normalized.base,
      endIndex: normalized.base + normalized.drop,
      count: normalized.drop
    },
    total: normalized.total
  };
}

function renderDomainExtractionOptions(counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  return {
    renderDomainBaseCount: normalized?.base ?? 0,
    renderDomainDropCount: normalized?.drop ?? 0
  };
}

function normalizePhysicalLawGroups(groups = null) {
  const defaults = {
    mechanics: true,
    gravity: true,
    eos: true,
    pressure: true,
    thermal: true,
    reactions: true,
    viscosity: true,
    surfaceTension: false
  };
  const normalized = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (groups && Object.prototype.hasOwnProperty.call(groups, key)) normalized[key] = groups[key] !== false;
  }
  return normalized;
}

function physicalLawGroupsSignature(groups = currentPhysicalLawGroups) {
  const normalized = normalizePhysicalLawGroups(groups);
  return ['mechanics', 'gravity', 'eos', 'pressure', 'thermal', 'reactions', 'viscosity', 'surfaceTension']
    .map((key) => `${key}:${normalized[key] ? 1 : 0}`)
    .join(',');
}

function renderDomainKeyForId(renderDomainId) {
  const id = normalizeRenderDomainId(renderDomainId);
  if (id === 1) return 'base';
  if (id === 2) return 'drop';
  return null;
}

function surfaceKeyForDescriptor({ renderKey, material, phase, opticalState = null, renderDomainId = 0, renderDomainKey = null }) {
  const base = `${renderKey}|${material}|${phase ?? 'phase-unspecified'}`;
  const opticalStateKey = stableOpticalStateKey(opticalState);
  const opticalKey = opticalStateKey === 'default' ? base : `${base}|opt:${opticalStateKey}`;
  const domainId = normalizeRenderDomainId(renderDomainId);
  if (domainId <= 0) return opticalKey;
  return `${opticalKey}|domain:${renderDomainKey || renderDomainKeyForId(domainId) || domainId}`;
}

function renderDescriptorOf(value) {
  if (value && typeof value === 'object') {
    const renderKey = materialKeyOf(value.renderKey ?? value.key ?? value.material);
    const material = materialKeyOf(value.material ?? ((renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey));
    const phase = value.phase ?? (renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null));
    const opticalState = value.opticalState || null;
    const renderDomainId = normalizeRenderDomainId(value.renderDomainId);
    const renderDomainKey = value.renderDomainKey || renderDomainKeyForId(renderDomainId);
    return {
      renderKey,
      material,
      phase,
      opticalState,
      opticalStateKey: stableOpticalStateKey(opticalState),
      renderDomainId,
      renderDomainKey,
      surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase, opticalState, renderDomainId, renderDomainKey })
    };
  }
  const renderKey = materialKeyOf(value);
  const material = (renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey;
  const phase = renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null);
  return {
    renderKey,
    material,
    phase,
    opticalState: null,
    opticalStateKey: 'default',
    renderDomainId: 0,
    renderDomainKey: null,
    surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase })
  };
}

export function materialKeyForSurfaceMaterialId(
  materialId,
  materialProperties = null,
  reactionTable = null,
  materialMap = null
) {
  const id = Math.round(Number(materialId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const map = materialMap instanceof Map
    ? materialMap
    : buildSphRenderMaterialMap(materialProperties || {}, reactionTable);
  return map.get(id) ?? null;
}

export function renderDescriptorForSurfaceRecord(
  sourceSurface = {},
  surfaceIndex = 0,
  {
    materialProperties = null,
    reactionTable = null,
    materialMap = null
  } = {}
) {
  const surfaceMaterialId = Number(sourceSurface?.materialId);
  const surfacePhaseId = Number(sourceSurface?.phaseId);
  const material = sourceSurface?.material
    ?? materialKeyForSurfaceMaterialId(surfaceMaterialId, materialProperties, reactionTable, materialMap)
    ?? `material-${Number.isFinite(surfaceMaterialId) ? Math.round(surfaceMaterialId) : surfaceIndex}`;
  const phase = sourceSurface?.phase
    ?? phaseFromGpuPhaseId(surfacePhaseId)
    ?? `phase-${Number.isFinite(surfacePhaseId) ? Math.round(surfacePhaseId) : 0}`;
  const renderKey = sourceSurface?.renderKey
    ?? renderKeyForMaterialPhase(material, phase)
    ?? sourceSurface?.material
    ?? `surface-${surfaceIndex}`;
  return renderDescriptorOf({
    material,
    phase,
    renderKey,
    opticalState: sourceSurface?.opticalState || null,
    opticalStateKey: sourceSurface?.opticalStateKey ?? 'default',
    renderDomainId: sourceSurface?.renderDomainId,
    renderDomainKey: sourceSurface?.renderDomainKey
  });
}

function materialPropertiesForSurfaceDescriptor(descriptor, materialProperties) {
  if (!materialProperties) return null;
  const materialKey = descriptor.material;
  const renderKey = descriptor.renderKey;
  return materialProperties[materialKey]
    ?? materialProperties[materialKey?.toLowerCase?.()]
    ?? materialProperties[renderKey]
    ?? materialProperties[renderKey?.toLowerCase?.()]
    ?? null;
}

function opticalQueryForDescriptor(descriptor, properties = null) {
  return {
    material: descriptor.material,
    phase: descriptor.phase ?? (descriptor.renderKey === 'steam' ? 'gas' : (descriptor.renderKey === 'ice' ? 'solid' : 'liquid')),
    properties,
    opticalState: descriptor.opticalState || null
  };
}

function opticalCoverageKey({ material, phase, opticalStateKey = null, opticalState = null }) {
  const stateKey = opticalStateKey || stableOpticalStateKey(opticalState);
  return `${material}|${phase}|${stateKey}`;
}

function opticalRecordIndex(layout = OPTICAL_GPU_RECORD_LAYOUT, fieldName) {
  return layout.findIndex((entry) => String(entry).split(':')[0] === fieldName);
}

function opticalRecordValue(table, recordIndex, fieldName, fallback = 0) {
  const layout = table?.recordLayout || OPTICAL_GPU_RECORD_LAYOUT;
  const fieldIndex = opticalRecordIndex(layout, fieldName);
  const stride = table?.recordStrideFloats || layout.length;
  const offset = recordIndex * stride + fieldIndex;
  const value = fieldIndex >= 0 ? table?.records?.[offset] : undefined;
  return Number.isFinite(value) ? value : fallback;
}

function opticalParamsFromGpuTableRecord(table, descriptor) {
  if (!table?.schema || !(table.records instanceof Float32Array) || !Array.isArray(table.recordMetadata)) return null;
  const coverage = opticalCoverageKey(descriptor);
  const record = table.recordMetadata.find((candidate) => opticalCoverageKey(candidate) === coverage);
  if (!record || !Number.isFinite(record.recordIndex)) return null;
  return {
    source: 'optical-gpu-table-row',
    material: record.material,
    phase: record.phase,
    opticalState: record.opticalState || null,
    opticalStateKey: record.opticalStateKey || 'default',
    opticalStateId: record.opticalStateId || 0,
    baseColorLinear: [
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearB', 1)
    ],
    metalness: opticalRecordValue(table, record.recordIndex, 'metalness', 0),
    roughness: opticalRecordValue(table, record.recordIndex, 'roughness', 0.5),
    transmission: opticalRecordValue(table, record.recordIndex, 'transmission', 0),
    opacity: opticalRecordValue(table, record.recordIndex, 'opacity', 1),
    ior: opticalRecordValue(table, record.recordIndex, 'ior', 1),
    attenuationLinear: [
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearB', 1)
    ],
    attenuationDistanceM: opticalRecordValue(table, record.recordIndex, 'attenuationDistanceM', 1e20),
    absorptionCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'absorptionCoefficientPerM', 0),
    scatteringCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'scatteringCoefficientPerM', 0),
    renderModelId: opticalRecordValue(table, record.recordIndex, 'renderModelId', 0),
    vertexColorPolicyId: opticalRecordValue(table, record.recordIndex, 'vertexColorPolicyId', 1),
    opticalDepth: opticalRecordValue(table, record.recordIndex, 'opticalDepth', 0),
    blocked: opticalRecordValue(table, record.recordIndex, 'blocked', 0) > 0,
    status: opticalRecordValue(table, record.recordIndex, 'status', 1),
    provenance: record.provenance || null
  };
}

function opticalSignatureForMaterial(optics = null) {
  if (!optics) return 'cpu-optical-render-params';
  return [
    optics.source || 'optics',
    optics.material || '',
    optics.phase || '',
    optics.opticalStateKey || 'default',
    optics.metalness,
    optics.roughness,
    optics.transmission,
    optics.opacity,
    optics.ior,
    optics.attenuationDistanceM,
    optics.absorptionCoefficientPerM,
    optics.scatteringCoefficientPerM,
    optics.opticalDepth,
    optics.renderModelId,
    optics.vertexColorPolicyId,
    ...(optics.baseColorLinear || optics.baseColorSrgb || [])
  ].map((value) => String(value)).join('|');
}

function surfaceRenderOrderKey(descriptorOrRow = {}) {
  if (descriptorOrRow.surfaceKey) return descriptorOrRow.surfaceKey;
  return [
    descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? '',
    descriptorOrRow.material ?? '',
    descriptorOrRow.phase ?? '',
    descriptorOrRow.opticalStateKey ?? stableOpticalStateKey(descriptorOrRow.opticalState || null),
    normalizeRenderDomainId(descriptorOrRow.renderDomainId)
  ].join('|');
}

export function stableSurfaceRenderOrder(baseOrder, surfaceKey = '') {
  const base = Number.isFinite(baseOrder) ? baseOrder : 0;
  const key = String(surfaceKey || '');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return base + ((hash >>> 0) % 1000) / 100000;
}

export function surfaceObjectRenderOrder(baseOrder, surfaceKey = '', {
  renderLayer = null,
  depthWrite = true
} = {}) {
  const base = Number.isFinite(baseOrder) ? baseOrder : 0;
  const transparentLayer = renderLayer === 'vapor-surface'
    || renderLayer === 'alpha-surface'
    || depthWrite === false;
  if (transparentLayer) return base;
  return stableSurfaceRenderOrder(base, surfaceKey);
}

export function resolveRenderFieldSurfaceVisibility({
  maxDensity = 0,
  isolation = 0,
  wasVisible = false
} = {}) {
  const density = Number.isFinite(maxDensity) ? Math.max(0, maxDensity) : 0;
  const showIsolation = Number.isFinite(isolation) ? Math.max(0, isolation) : 0;
  const hideIsolation = showIsolation * SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS;
  const visible = density >= showIsolation || (wasVisible && density >= hideIsolation);
  return {
    visible,
    retainPreviousSurface: !visible && wasVisible,
    showIsolation,
    hideIsolation,
    renderIsolation: visible && density < showIsolation ? hideIsolation : showIsolation
  };
}

export function hideRenderFieldSurfaceAfterGrace(surface, renderSource, {
  immediate = false
} = {}) {
  surface.inactiveFrameCount = Math.max(0, surface.inactiveFrameCount || 0) + 1;
  surface.mesh.userData.surfaceInactiveFrameCount = surface.inactiveFrameCount;
  surface.mesh.userData.renderSource = renderSource;
  if (!immediate && surface.inactiveFrameCount <= SPH_SURFACE_INACTIVE_GRACE_FRAMES) {
    return false;
  }
  surface.mesh.isolation = surface.config.isolation;
  surface.mesh.reset();
  surface.mesh.update();
  surface.mesh.visible = false;
  return true;
}

function opticalPhaseOf(optics = {}, descriptorOrRow = {}) {
  return descriptorOrRow.phase
    ?? optics.phase
    ?? (descriptorOrRow.renderKey === 'steam' ? 'gas' : null);
}

function isVaporOpticalSurface(optics = {}, descriptorOrRow = {}) {
  const phase = opticalPhaseOf(optics, descriptorOrRow);
  const material = descriptorOrRow.material ?? optics.material ?? null;
  const renderKey = descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? null;
  return phase === 'gas' || material === 'steam' || renderKey === 'steam';
}

function opticalDepthFromOpacity(opacity) {
  const alpha = clamp(Number.isFinite(opacity) ? opacity : 0, 0, 1);
  if (!(alpha > 0)) return 0;
  if (alpha >= 1) return Number.POSITIVE_INFINITY;
  return -Math.log(1 - alpha);
}

export function resolveOpticalSurfaceVisibility({
  optics = {},
  descriptorOrRow = {},
  wasVisible = false
} = {}) {
  if (!isVaporOpticalSurface(optics, descriptorOrRow)) {
    return {
      visible: true,
      reason: 'non-vapor-surface',
      opticalDepth: Number.isFinite(optics.opticalDepth) ? Math.max(0, optics.opticalDepth) : null,
      scatteringCoefficientPerM: Number.isFinite(optics.scatteringCoefficientPerM)
        ? Math.max(0, optics.scatteringCoefficientPerM)
        : null,
      showOpticalDepth: null,
      hideOpticalDepth: null,
      retainPreviousSurface: false
    };
  }
  const scatteringCoefficientPerM = Math.max(
    0,
    Number.isFinite(optics.scatteringCoefficientPerM) ? optics.scatteringCoefficientPerM : 0,
    Number.isFinite(optics.condensationScatter) ? optics.condensationScatter : 0,
    Number.isFinite(optics.internalScatter) ? optics.internalScatter : 0
  );
  const opticalDepth = Math.max(
    0,
    Number.isFinite(optics.opticalDepth) ? optics.opticalDepth : 0,
    opticalDepthFromOpacity(optics.opacity)
  );
  const hasScattering = scatteringCoefficientPerM >= SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M;
  const depthThreshold = wasVisible ? SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE : SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW;
  const visible = hasScattering || opticalDepth >= depthThreshold;
  return {
    visible,
    reason: visible
      ? (hasScattering ? 'derived-droplet-scattering-visible' : 'derived-vapor-optical-depth-visible')
      : 'derived-pure-vapor-optically-thin',
    opticalDepth,
    scatteringCoefficientPerM,
    showOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW,
    hideOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE,
    scatteringThresholdPerM: SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M,
    retainPreviousSurface: !visible && wasVisible
  };
}

export function renderAlphaFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const opacity = clamp(Number.isFinite(optics.opacity) ? optics.opacity : 1, 0, 1);
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const metalness = clamp(Number.isFinite(optics.metalness) ? optics.metalness : 0, 0, 1);
  const isVapor = isVaporOpticalSurface(optics, descriptorOrRow);
  if (transmission > 0.01 && metalness < 0.1 && !isVapor) {
    return 1;
  }
  return opacity;
}

export function renderDepthWriteFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const alpha = renderAlphaFromOpticalResponse(optics, descriptorOrRow);
  return alpha >= 0.999;
}

export function renderLayerFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const alpha = renderAlphaFromOpticalResponse(optics, descriptorOrRow);
  const isVapor = isVaporOpticalSurface(optics, descriptorOrRow);
  if (isVapor) return 'vapor-surface';
  if (transmission > 0.01) return 'transmissive-surface';
  if (alpha < 0.999) return 'alpha-surface';
  return 'opaque-surface';
}

export function renderOrderFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  if (layer === 'vapor-surface') return SPH_PHASE_RENDER_ORDER.vaporSurface;
  if (layer === 'transmissive-surface') return SPH_PHASE_RENDER_ORDER.transmissiveSurface;
  if (layer === 'alpha-surface') return SPH_PHASE_RENDER_ORDER.alphaSurface;
  return SPH_PHASE_RENDER_ORDER.opaqueSurface;
}

export function residentSurfaceDrawOrder(surfaces = [], {
  indirectStrideBytes = 4 * Uint32Array.BYTES_PER_ELEMENT
} = {}) {
  if (!Array.isArray(surfaces)) return [];
  return surfaces
    .map((surface, index) => {
      const surfaceIndex = Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0));
      const transparencyClassId = Number.isFinite(Number(surface?.transparencyClassId))
        ? Number(surface.transparencyClassId)
        : 0;
      const depthWriteFlag = Number.isFinite(Number(surface?.depthWriteFlag))
        ? Number(surface.depthWriteFlag)
        : (transparencyClassId > 0 ? 0 : 1);
      const renderOrder = Number.isFinite(Number(surface?.renderOrder))
        ? Number(surface.renderOrder)
        : (transparencyClassId * 1000 + surfaceIndex);
      return {
        surfaceIndex,
        renderOrder,
        transparencyClassId,
        depthWriteFlag,
        renderLayer: surface?.renderLayer ?? null,
        indirectOffsetBytes: surfaceIndex * indirectStrideBytes
      };
    })
    .sort((a, b) => (
      a.renderOrder - b.renderOrder
      || b.depthWriteFlag - a.depthWriteFlag
      || a.transparencyClassId - b.transparencyClassId
      || a.surfaceIndex - b.surfaceIndex
    ));
}

export function residentSurfaceDrawPipelineKey(draw = {}) {
  return Number(draw?.depthWriteFlag) > 0 ? 'opaque-depth-write' : 'transparent-depth-test';
}

function makeSurfaceMaterial(descriptorOrKey, properties = null, opticsOverride = null) {
  const descriptor = renderDescriptorOf(descriptorOrKey);
  // Transmission / IOR / attenuation come from the optical closure (refractive index + Beer–Lambert
  // extinction): clear media transmit according to optical depth; conductors become opaque from
  // Drude skin depth; missing optical closures block rather than falling back to fake opacity.
  const optics = opticsOverride || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
  const usesTransmission = optics.transmission > 0.01;
  const renderAlpha = renderAlphaFromOpticalResponse(optics, descriptor);
  const transparent = renderAlpha < 0.999;
  const baseColor = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  const baseColorLinear = optics.baseColorLinear || null;
  const materialColor = new THREE.Color();
  if (baseColorLinear) {
    materialColor.setRGB(baseColorLinear[0], baseColorLinear[1], baseColorLinear[2], THREE.LinearSRGBColorSpace);
  } else {
    materialColor.setRGB(baseColor[0], baseColor[1], baseColor[2], THREE.SRGBColorSpace);
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: materialColor,
    vertexColors: optics.vertexColorPolicy === 'particle-diagnostic' || Math.round(optics.vertexColorPolicyId || 0) === 2,
    side: THREE.DoubleSide,
    clearcoat: optics.metalness > 0.5 ? 0.18 : 0.05,
    metalness: optics.metalness,
    roughness: optics.roughness,
    ior: optics.ior ?? 1.5,
    transmission: optics.transmission,
    thickness: usesTransmission ? 0.6 : 0,
    envMapIntensity: optics.metalness > 0.5 ? 1.3 : 0.85,
    transparent,
    depthWrite: renderDepthWriteFromOpticalResponse(optics, descriptor),
    opacity: renderAlpha
  });
  material.userData.renderLayer = renderLayerFromOpticalResponse(optics, descriptor);
  material.userData.renderOrder = renderOrderFromOpticalResponse(optics, descriptor);
  const attenuationColor = optics.attenuationLinear || optics.attenuationColor || null;
  if (attenuationColor) {
    material.attenuationColor = new THREE.Color();
    if (optics.attenuationLinear) {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        THREE.LinearSRGBColorSpace
      );
    } else {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        THREE.SRGBColorSpace
      );
    }
    material.attenuationDistance = Math.max(0.05, optics.attenuationDistanceM);
  }
  material.userData.optical = optics;
  material.userData.opticalRenderAlpha = renderAlpha;
  material.userData.renderDescriptor = descriptor;
  return material;
}

const RENDER_ROW_SPHERE_BRIDGE_MIN_TRANSMISSIVE_OPACITY = 0.66;

function srgbLuminance(color = []) {
  const r = Number(color[0]);
  const g = Number(color[1]);
  const b = Number(color[2]);
  if (![r, g, b].every(Number.isFinite)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function fallbackBridgeColorSrgbForDescriptor(descriptor = {}) {
  const material = String(descriptor.material || descriptor.renderKey || '').toLowerCase();
  if (material === 'h2o' || material === 'water' || descriptor.renderKey === 'ice') return [0.44, 0.76, 0.91];
  if (material === 'fe' || material === 'iron') return [0.66, 0.62, 0.56];
  if (material === 'cs' || material === 'cesium') return [0.78, 0.68, 0.44];
  if (material === 'na' || material === 'sodium') return [0.72, 0.70, 0.62];
  if (material === 'csoh' || material === 'naoh') return [0.72, 0.82, 0.9];
  if (material === 'air') return [0.72, 0.86, 1.0];
  return [0.8, 0.82, 0.86];
}

function averageRenderRowColorSrgb(colorsRgb, indices = [], descriptor = {}) {
  if (!(colorsRgb instanceof Float32Array) || !Array.isArray(indices) || indices.length === 0) {
    return fallbackBridgeColorSrgbForDescriptor(descriptor);
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const index of indices) {
    const offset = Math.max(0, Math.round(Number(index) || 0)) * 3;
    const cr = colorsRgb[offset];
    const cg = colorsRgb[offset + 1];
    const cb = colorsRgb[offset + 2];
    if (![cr, cg, cb].every(Number.isFinite)) continue;
    r += clamp(cr, 0, 1);
    g += clamp(cg, 0, 1);
    b += clamp(cb, 0, 1);
    count += 1;
  }
  const color = count > 0
    ? [r / count, g / count, b / count]
    : fallbackBridgeColorSrgbForDescriptor(descriptor);
  return srgbLuminance(color) > 0.025 ? color : fallbackBridgeColorSrgbForDescriptor(descriptor);
}

export function stabilizeRenderRowSphereBridgeMaterial(material, {
  descriptor = null,
  fallbackColorSrgb = null,
  minTransmissiveOpacity = RENDER_ROW_SPHERE_BRIDGE_MIN_TRANSMISSIVE_OPACITY
} = {}) {
  if (!material) return material;
  const optics = material.userData?.optical || {};
  const fallbackColor = Array.isArray(fallbackColorSrgb)
    ? fallbackColorSrgb
    : fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {});
  let changed = false;

  if (material.vertexColors) {
    // Instanced sphere proxy geometry does not carry per-vertex colors; mobile
    // drivers can multiply PBR color by missing vertex-color attributes.
    material.vertexColors = false;
    changed = true;
  }

  const transmission = Number(material.transmission ?? optics.transmission ?? 0);
  if (Number.isFinite(transmission) && transmission > 0.01) {
    material.userData.renderRowSphereOriginalTransmission = transmission;
    material.transmission = 0;
    material.thickness = 0;
    material.opacity = Math.max(
      Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
      minTransmissiveOpacity
    );
    material.transparent = material.opacity < 0.999;
    material.userData.renderRowSphereTransmissionProxy = true;
    changed = true;
  }

  const materialColor = material.color;
  const currentLuminance = materialColor
    ? 0.2126 * materialColor.r + 0.7152 * materialColor.g + 0.0722 * materialColor.b
    : 0;
  const blockedOptics = Boolean(optics.blocked)
    || Math.round(Number(optics.vertexColorPolicyId) || 0) === 255
    || optics.vertexColorPolicy === 'blocked'
    || Number(optics.status) === 0;
  if (materialColor && (blockedOptics || currentLuminance <= 0.01)) {
    materialColor.setRGB(
      clamp(fallbackColor[0], 0, 1),
      clamp(fallbackColor[1], 0, 1),
      clamp(fallbackColor[2], 0, 1),
      THREE.SRGBColorSpace
    );
    material.opacity = Math.max(Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1, 0.72);
    material.transparent = material.opacity < 0.999;
    material.userData.renderRowSphereFallbackColor = [...fallbackColor];
    changed = true;
  }

  if (changed) material.needsUpdate = true;
  return material;
}

function applySurfaceRenderOrdering(mesh, optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  const order = renderOrderFromOpticalResponse(optics, descriptorOrRow);
  const depthWrite = renderDepthWriteFromOpticalResponse(optics, descriptorOrRow);
  const objectOrder = surfaceObjectRenderOrder(order, surfaceRenderOrderKey(descriptorOrRow), {
    renderLayer: layer,
    depthWrite
  });
  mesh.renderOrder = objectOrder;
  mesh.userData.renderLayer = layer;
  mesh.userData.renderOrderBase = order;
  mesh.userData.renderOrderPolicy = depthWrite
    ? 'stable-opaque-layer-order'
    : 'three-transparent-depth-sort-within-layer';
  if (mesh.material) {
    mesh.material.depthWrite = depthWrite;
    mesh.material.userData.renderLayer = layer;
    mesh.material.userData.renderOrder = objectOrder;
    mesh.material.userData.renderOrderBase = order;
    mesh.material.userData.renderOrderPolicy = mesh.userData.renderOrderPolicy;
  }
  return { layer, order: objectOrder, baseOrder: order, depthWrite };
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

function estimateSurfaceRadiusM(bounds, count, spacingHintM = 0.25) {
  const hint = Number.isFinite(spacingHintM) && spacingHintM > 0 ? spacingHintM : 0.25;
  if (count <= 1) return hint * 0.8;
  const spans = bounds.max.map((max, index) => Math.max(max - bounds.min[index], hint));
  const occupiedVolumeM3 = spans[0] * spans[1] * spans[2];
  const spacingM = Math.cbrt(occupiedVolumeM3 / Math.max(1, count));
  return clamp(spacingM * 1.65, hint * 0.35, hint * 1.6);
}

function estimateGlobalParticleSpacingM(positionsM, particleCount) {
  if (particleCount <= 1) return null;
  const bounds = emptyBounds();
  for (let i = 0; i < particleCount; i += 1) {
    expandBounds(bounds, positionsM[i * 3], positionsM[i * 3 + 1], positionsM[i * 3 + 2]);
  }
  const spans = bounds.max.map((max, index) => max - bounds.min[index]).filter((span) => span > 1e-9);
  if (!spans.length) return null;
  const occupiedVolumeM3 = spans.reduce((product, span) => product * span, 1);
  const dimensionalCount = Math.max(1, spans.length);
  const densityLength = dimensionalCount === 3
    ? Math.cbrt(occupiedVolumeM3 / particleCount)
    : Math.max(...spans) / Math.max(1, Math.cbrt(particleCount) - 1);
  return Number.isFinite(densityLength) && densityLength > 0 ? densityLength : null;
}

function estimateSurfaceRadiusFromParticleRadiiM(radii = []) {
  const finite = radii
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!finite.length) return null;
  const median = finite[Math.floor(finite.length / 2)];
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  return Math.max(median, mean);
}

export function createContinuousSurfaceBatches({
  positionsM,
  colorsRgb,
  materials = null,
  particleRadiiM = null,
  boxEdgeM = 10,
  boxDimsM = null,
  smoothingLengthM = null,
  particleSpacingM = null
} = {}) {
  if (!positionsM || !colorsRgb) {
    throw new Error('positionsM and colorsRgb are required for SPH continuous surfaces');
  }
  if (positionsM.length !== colorsRgb.length || positionsM.length % 3 !== 0) {
    throw new Error('positionsM and colorsRgb must be matching vec3 arrays');
  }
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  const batches = new Map();
  const particleCount = positionsM.length / 3;
  const spacingHintM = (Number.isFinite(particleSpacingM) && particleSpacingM > 0)
    ? particleSpacingM
    : ((Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
      ? smoothingLengthM
      : (estimateGlobalParticleSpacingM(positionsM, particleCount) ?? 0.25));
  for (let i = 0; i < particleCount; i += 1) {
    const descriptor = renderDescriptorOf(materials?.[i]);
    let batch = batches.get(descriptor.surfaceKey);
    if (!batch) {
      batch = {
        surfaceKey: descriptor.surfaceKey,
        renderKey: descriptor.renderKey,
        material: descriptor.material,
        phase: descriptor.phase,
        opticalState: descriptor.opticalState,
        opticalStateKey: descriptor.opticalStateKey,
        renderDomainId: descriptor.renderDomainId,
        renderDomainKey: descriptor.renderDomainKey,
        descriptor,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        particleRadiiM: [],
        bounds: emptyBounds(),
        count: 0
      };
      batches.set(descriptor.surfaceKey, batch);
    }
    const x = positionsM[i * 3];
    const y = positionsM[i * 3 + 1];
    const z = positionsM[i * 3 + 2];
    batch.positionsM.push(x, y, z);
    // Isotropic mapping: every axis is normalized by the SAME factor (the largest box edge), so a
    // metaball stays spherical in the field. A non-cubic box therefore occupies a sub-region of the
    // [0,1] field cube (the short axes don't fill it) rather than being stretched to fill it — which
    // would deform round blobs into ellipsoids. The mesh scale (below) is the matching scalar.
    const span = 1 - 2 * FIELD_PADDING;
    batch.normalizedPositions.push(
      clamp(FIELD_PADDING + (x / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (y / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (z / refEdgeM) * span, 0.001, 0.999)
    );
    batch.colorsRgb.push(
      clamp(colorsRgb[i * 3], 0, 1),
      clamp(colorsRgb[i * 3 + 1], 0, 1),
      clamp(colorsRgb[i * 3 + 2], 0, 1)
    );
    const particleRadiusM = Number(particleRadiiM?.[i]);
    if (Number.isFinite(particleRadiusM) && particleRadiusM > 0) {
      batch.particleRadiiM.push(particleRadiusM);
    }
    expandBounds(batch.bounds, x, y, z);
    batch.count += 1;
  }
  return [...batches.values()].map((batch) => ({
    ...batch,
    surfaceRadiusM: estimateSurfaceRadiusFromParticleRadiiM(batch.particleRadiiM)
      ?? estimateSurfaceRadiusM(batch.bounds, batch.count, spacingHintM)
  }));
}

export function mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches = [], options = {}) {
  if (!Array.isArray(batches) || batches.length === 0) return [];
  const phasePredicate = typeof options.phasePredicate === 'function' ? options.phasePredicate : null;
  const groupKeyForBatch = (batch) => {
    if (!batch?.material || !batch?.phase || !batch?.renderKey) return null;
    if (phasePredicate && !phasePredicate(batch.phase, batch)) return null;
    if (!(Math.max(0, Math.round(Number(batch.renderDomainId) || 0)) > 0)) return null;
    const positionCount = Math.floor(Math.max(
      Number(batch.positionsM?.length) || 0,
      Number(batch.normalizedPositions?.length) || 0
    ) / 3);
    if (positionCount <= 0) return null;
    return [
      batch.renderKey,
      batch.material,
      batch.phase,
      batch.opticalStateKey || stableOpticalStateKey(batch.opticalState || batch.descriptor?.opticalState || null)
    ].join('|');
  };
  const groups = new Map();
  for (const batch of batches) {
    const key = groupKeyForBatch(batch);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(batch);
  }
  const mergedByKey = new Map();
  for (const [key, group] of groups) {
    const domains = new Set(group.map((batch) => Math.max(0, Math.round(Number(batch.renderDomainId) || 0))));
    if (group.length <= 1 || domains.size <= 1) continue;
    const first = group[0];
    const descriptor = renderDescriptorOf({
      renderKey: first.renderKey,
      material: first.material,
      phase: first.phase,
      opticalState: first.opticalState || first.descriptor?.opticalState || null
    });
    const positionsM = [];
    const normalizedPositions = [];
    const colorsRgb = [];
    const bounds = emptyBounds();
    let count = 0;
    let surfaceRadiusM = 0;
    for (const batch of group) {
      for (const value of batch.positionsM || []) positionsM.push(value);
      for (const value of batch.normalizedPositions || []) normalizedPositions.push(value);
      for (const value of batch.colorsRgb || []) colorsRgb.push(value);
      const batchCount = Math.max(0, Math.round(Number(batch.count) || 0));
      count += batchCount;
      if (Number.isFinite(batch.surfaceRadiusM) && batch.surfaceRadiusM > surfaceRadiusM) {
        surfaceRadiusM = batch.surfaceRadiusM;
      }
      for (let index = 0; index + 2 < (batch.positionsM?.length || 0); index += 3) {
        expandBounds(bounds, batch.positionsM[index], batch.positionsM[index + 1], batch.positionsM[index + 2]);
      }
    }
    mergedByKey.set(key, {
      surfaceKey: descriptor.surfaceKey,
      renderKey: descriptor.renderKey,
      material: descriptor.material,
      phase: descriptor.phase,
      opticalState: descriptor.opticalState,
      opticalStateKey: descriptor.opticalStateKey,
      renderDomainId: 0,
      renderDomainKey: null,
      descriptor,
      positionsM,
      normalizedPositions,
      colorsRgb,
      bounds,
      count,
      surfaceRadiusM: surfaceRadiusM > 0 ? surfaceRadiusM : estimateSurfaceRadiusM(bounds, count),
      source: 'merged-same-material-phase-render-surface',
      mergedRenderDomains: group.map((batch) => ({
        renderDomainId: Math.max(0, Math.round(Number(batch.renderDomainId) || 0)),
        renderDomainKey: batch.renderDomainKey ?? batch.descriptor?.renderDomainKey ?? null,
        count: Math.max(0, Math.round(Number(batch.count) || 0)),
        surfaceKey: batch.surfaceKey
      }))
    });
  }
  const emittedGroups = new Set();
  const output = [];
  for (const batch of batches) {
    const key = groupKeyForBatch(batch);
    const merged = key ? mergedByKey.get(key) : null;
    if (merged) {
      if (!emittedGroups.has(key)) {
        output.push(merged);
        emittedGroups.add(key);
      }
      continue;
    }
    output.push(batch);
  }
  return output;
}

function materialPropertiesLookup(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function phaseFromGpuPhaseId(phaseId) {
  const rounded = Math.round(Number(phaseId) || 0);
  if (rounded === 1) return 'solid';
  if (rounded === 2) return 'liquid';
  if (rounded === 3) return 'gas';
  if (rounded === 4) return 'plasma';
  return null;
}

function phaseForProductInventoryRecord(record, term = null, materialProperties = null) {
  if (record?.routing === 'gas' || term?.routing === 'gas' || record?.routingId === 1) return 'gas';
  const phaseFromId = phaseFromGpuPhaseId(record?.phaseId ?? term?.phaseId ?? term?.targetPhaseId);
  if (phaseFromId) return phaseFromId;
  const properties = materialPropertiesLookup(record?.material ?? term?.material, materialProperties);
  const phases = Array.isArray(properties?.phases) ? properties.phases : [];
  const nonGas = phases.find((phase) => phase?.name && phase.name !== 'gas');
  return nonGas?.name ?? phases[0]?.name ?? 'liquid';
}

function renderKeyForMaterialPhase(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

export function createProductEventSurfaceBatches({
  baseBatches = [],
  reactionSummary = null,
  reactionTable = null,
  materialProperties = null,
  smoothingLengthM = null
} = {}) {
  const records = Array.isArray(reactionSummary?.productInventory?.records)
    ? reactionSummary.productInventory.records
    : [];
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  const existingKeys = new Set((baseBatches || []).map((batch) => batch.surfaceKey));
  const existingMaterialPhaseKeys = new Set((baseBatches || [])
    .filter((batch) => batch?.material && batch?.phase)
    .map((batch) => `${batch.material}|${batch.phase}`));
  const createdKeys = new Set();
  const batches = [];
  for (const record of records) {
    if (record?.status && record.status !== 'ready') continue;
    if (!(Number(record?.unplacedMassKg) > 0)) continue;
    const term = terms.find((candidate) => candidate.productTermIndex === record.productTermIndex)
      || terms[record.productTermIndex]
      || null;
    const material = record.material || term?.material || null;
    if (!material) continue;
    const phase = phaseForProductInventoryRecord(record, term, materialProperties);
    if (existingMaterialPhaseKeys.has(`${material}|${phase}`)) continue;
    const renderKey = renderKeyForMaterialPhase(material, phase);
    const descriptor = renderDescriptorOf({ material, phase, renderKey });
    if (existingKeys.has(descriptor.surfaceKey) || createdKeys.has(descriptor.surfaceKey)) continue;
    const properties = materialPropertiesLookup(material, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const color = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
    const count = Math.max(1, Math.round(Number(record.eventCount) || 1));
    const colorsRgb = [];
    for (let i = 0; i < count; i += 1) {
      colorsRgb.push(
        clamp(color[0] ?? 1, 0, 1),
        clamp(color[1] ?? 1, 0, 1),
        clamp(color[2] ?? 1, 0, 1)
      );
    }
    batches.push({
      surfaceKey: descriptor.surfaceKey,
      renderKey,
      material,
      phase,
      opticalState: descriptor.opticalState,
      opticalStateKey: descriptor.opticalStateKey,
      renderDomainId: descriptor.renderDomainId,
      renderDomainKey: descriptor.renderDomainKey,
      descriptor,
      positionsM: [],
      normalizedPositions: [],
      colorsRgb,
      bounds: emptyBounds(),
      count,
      surfaceRadiusM: (Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
        ? smoothingLengthM
        : 0.25,
      source: 'reaction-product-event-buffer',
      productTermIndex: record.productTermIndex,
      reactionIndex: record.reactionIndex,
      unplacedMassKg: record.unplacedMassKg,
      eventCount: record.eventCount
    });
    createdKeys.add(descriptor.surfaceKey);
  }
  return batches;
}

export function createOpticalGpuTableForSurfaceBatches(batches, { materialProperties = null } = {}) {
  return buildOpticalGpuTable(batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    renderKey: batch.renderKey,
    opticalState: batch.descriptor?.opticalState || null,
    properties: materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties)
  })), { materialProperties: materialProperties || {} });
}

export function createOpticalGpuLookupForSurfaceBatches(table, batches) {
  const lookup = buildOpticalGpuLookupQueries(table, batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    opticalState: batch.descriptor?.opticalState || null
  })));
  return {
    lookup,
    cpuReference: sampleOpticalGpuTableCpu(table, lookup),
    surfaceKeys: batches.map((batch) => batch.surfaceKey),
    signature: opticalGpuLookupSignature(table, lookup)
  };
}

export function residentSurfaceBatchIdentitySignature(batches = []) {
  if (!Array.isArray(batches) || batches.length === 0) return 'empty';
  return batches
    .map((batch) => {
      const descriptor = batch?.descriptor || batch || {};
      const surfaceKey = batch?.surfaceKey
        || surfaceKeyForDescriptor({
          renderKey: descriptor.renderKey ?? batch?.renderKey,
          material: descriptor.material ?? batch?.material,
          phase: descriptor.phase ?? batch?.phase,
          opticalState: descriptor.opticalState ?? batch?.opticalState ?? null
        });
      return [
        surfaceKey,
        descriptor.renderKey ?? batch?.renderKey ?? 'render-unspecified',
        descriptor.material ?? batch?.material ?? 'material-unspecified',
        descriptor.phase ?? batch?.phase ?? 'phase-unspecified',
        normalizeRenderDomainId(descriptor.renderDomainId ?? batch?.renderDomainId)
      ].join(':');
    })
    .sort()
    .join('|');
}

export function shouldRetainResidentSurfaceDrawOverlay({
  previousSurfaceBatchSignature = null,
  nextSurfaceBatchSignature = null,
  hasResidentSurfaceDraw = false,
  hasResidentRenderBridge = false,
  allowEmptySurfaceSignature = false
} = {}) {
  const signaturesMatch = Boolean(
    previousSurfaceBatchSignature
    && nextSurfaceBatchSignature
    && previousSurfaceBatchSignature === nextSurfaceBatchSignature
  );
  return Boolean(
    hasResidentSurfaceDraw
    && hasResidentRenderBridge
    && signaturesMatch
    && (
      allowEmptySurfaceSignature
      || (
        previousSurfaceBatchSignature !== 'empty'
        && nextSurfaceBatchSignature !== 'empty'
      )
    )
  );
}

export function surfaceRadiusScaleForRenderBatch(
  batch,
  requestedScale = SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  { explicitSurfaceRadius = false } = {}
) {
  const scale = Number.isFinite(requestedScale) && requestedScale > 0
    ? requestedScale
    : SPH_SURFACE_RADIUS_SCALE_DEFAULT;
  const count = Math.max(0, Math.round(Number(batch?.count) || 0));
  const usesDefaultScale = Math.abs(scale - SPH_SURFACE_RADIUS_SCALE_DEFAULT) < 1e-9;
  if (
    !explicitSurfaceRadius
    && usesDefaultScale
    && count > 0
    && count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES
  ) {
    return Math.max(scale, SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN);
  }
  return scale;
}

function opticalGpuLookupSignature(table, lookup) {
  return [
    table.recordCount,
    lookup.queryCount,
    Array.from(lookup.queries).join(','),
    Array.from(table.records).join(',')
  ].join('|');
}

export function createSphPhaseScene(container, {
  boxEdgeM = 10,
  boxDimsM = null,
  surfaceRadiusM = null,
  surfaceRadiusScale = SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  preserveDrawingBuffer = false,
  preferWebGpuOpticalLookup = true,
  residentSurfaceDrawOverlay = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  residentSurfaceDrawDiagnosticMode = 'auto',
  residentAuthorityHost = null,
  navigatorRef = globalThis.navigator
} = {}) {
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  const residentSurfaceDrawOverlayMode = normalizeResidentSurfaceDrawOverlayMode(residentSurfaceDrawOverlay);
  const residentSurfaceDrawDiagnosticModeDefault = String(residentSurfaceDrawDiagnosticMode || 'auto').trim().toLowerCase();
  const useResidentThreeSurfaceBridgeByDefault = isThreeResidentSurfaceBridgeMode(residentSurfaceDrawDiagnosticModeDefault);
  let residentSurfaceDrawOverlayPolicy = null;
  function resolveSceneResidentSurfaceDrawOverlayPolicy({ refresh = false } = {}) {
    if (refresh || !residentSurfaceDrawOverlayPolicy) {
      residentSurfaceDrawOverlayPolicy = resolveResidentSurfaceDrawOverlayPolicy({
        mode: residentSurfaceDrawOverlayMode,
        container,
        navigatorRef
      });
      scene.userData.sphResidentSurfaceDrawOverlayPolicy = residentSurfaceDrawOverlayPolicy;
    }
    return residentSurfaceDrawOverlayPolicy;
  }
  let radiusScale = surfaceRadiusScale; // mutable so the blob-size control is live (no rebuild)
  let currentWallTemperaturesK = null;
  const scene = new THREE.Scene();
  let sceneResidentAuthorityHost = residentAuthorityHost || null;
  scene.userData.residentAuthorityHost = sceneResidentAuthorityHost;
  function setResidentAuthorityHost(host = null) {
    sceneResidentAuthorityHost = host || null;
    scene.userData.residentAuthorityHost = sceneResidentAuthorityHost;
    return sceneResidentAuthorityHost;
  }
  function resolveSceneResidentAuthorityHost(host = null) {
    return host || sceneResidentAuthorityHost || globalThis.__ulgResidentAuthorityHost || null;
  }
  // A dark slate background rather than near-black: the ice/water surfaces are physically
  // transmissive (clear), so they take their look from what is behind them — a pure-black void made
  // them read dark. Transmission samples the background render, so lifting it brightens the glassy
  // surfaces without faking opacity.
  scene.background = new THREE.Color(0x18222b);

  const initialViewport = resolveSphSceneViewportSize(container);
  const width = initialViewport.width;
  const height = initialViewport.height;
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 500);
  // Aim at the box centre and pull back proportionally to the largest box edge so the whole sealed
  // box (and everything contained in it) is framed, instead of looking at the floor and cropping.
  const center = new THREE.Vector3(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  camera.position.set(center.x + refEdgeM * 0.85, center.y + refEdgeM * 0.55, center.z + refEdgeM * 1.15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Boolean(preserveDrawingBuffer) });
  renderer.setPixelRatio(resolveSphScenePixelRatio(window.devicePixelRatio));
  renderer.setSize(width, height, false);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);
  scene.userData.sphRendererBackend = renderer.isWebGPURenderer
    ? 'three-webgpu'
    : renderer.isWebGLRenderer
    ? 'three-webgl'
    : 'three-unknown';
  scene.userData.sphResidentExtensionSurfaceRendererCapability = resolveResidentExtensionSurfaceRendererCapability({
    renderer
  });
  resolveSceneResidentSurfaceDrawOverlayPolicy();

  let pmrem = null;
  let environment = null;
  let environmentRequested = false;
  function scheduleEnvironmentMap() {
    if (environmentRequested || !running) return;
    environmentRequested = true;
    const run = () => {
      if (!running || environment) return;
      pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = environment.texture;
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      window.setTimeout(run, 1500);
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(center);

  // Bright, fairly even illumination so the non-emissive surfaces (ice/water) read clearly; a
  // hemisphere light gives a soft sky/ground fill on top of the flat ambient, and two directional
  // lights (key + fill) shape the surfaces without leaving any face in the dark.
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  scene.add(new THREE.HemisphereLight(0xddffff, 0x202a30, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfe9ff, 0.5);
  fill.position.set(-6, 3, -4);
  scene.add(fill);

  // Sealed-box domain wireframe (the full Lx×Ly×Lz box) + a floor grid sized to the footprint.
  const boxGeom = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeom),
    new THREE.LineBasicMaterial({
      color: 0x36d6a4,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
  box.position.set(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  box.renderOrder = SPH_PHASE_RENDER_ORDER.containerWire;
  box.userData.renderLayer = 'container-wire';
  scene.add(box);
  const gridFootprint = Math.max(dims[0], dims[2]);
  const grid = new THREE.GridHelper(gridFootprint, 20, 0x1d8b6d, 0x0d332b);
  grid.position.set(dims[0] / 2, 0, dims[2] / 2);
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of gridMaterials) {
    if (!material) continue;
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
  }
  grid.renderOrder = SPH_PHASE_RENDER_ORDER.containerWire - 1;
  grid.userData.renderLayer = 'container-grid';
  scene.add(grid);

  const surfaces = new Map();
  let opticalGpuTable = buildOpticalGpuTable([]);
  let opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, []);
  let opticalGpuLookupGeneration = 0;
  let pendingOpticalGpuLookup = null;
  let opticalGpuDeviceResultPromise = null;
  let sphGpuParticleState = null;
  let sphGpuParticleUpload = null;
  let sphGpuParticleUploadSignature = null;
  let pendingSphGpuParticleUpload = null;
  let mlsMpmGpuParticleState = null;
  let mlsMpmGpuParticleUpload = null;
  let mlsMpmGpuParticleUploadSignature = null;
  let pendingMlsMpmGpuParticleUpload = null;
  let mlsMpmMechanicsPrediction = null;
  let mlsMpmMechanicsPredictionSignature = null;
  let pendingMlsMpmMechanicsPrediction = null;
  let mlsMpmP2gGridProjection = null;
  let mlsMpmP2gGridProjectionSignature = null;
  let pendingMlsMpmP2gGridProjection = null;
  let mlsMpmGridUpdate = null;
  let mlsMpmGridUpdateSignature = null;
  let pendingMlsMpmGridUpdate = null;
  let mlsMpmG2pReconstruction = null;
  let mlsMpmG2pReconstructionSignature = null;
  let pendingMlsMpmG2pReconstruction = null;
  let mlsMpmResidentStep = null;
  let mlsMpmResidentStepSignature = null;
  let pendingMlsMpmResidentStep = null;
  let mlsMpmResidentSteps = null;
  let mlsMpmResidentStepsSignature = null;
  let pendingMlsMpmResidentSteps = null;
  let sphThermalMaterialTable = null;
  let sphThermalClosureGraphBuffers = null;
  let sphThermalPhaseResponseTable = null;
  let sphThermalResponseGraphUpload = null;
  let sphThermalResponseGraphUploadSignature = null;
  let pendingSphThermalResponseGraphUpload = null;
  let mlsMpmMechanicsMaterialTable = null;
  let sphReactionTable = null;
  let currentMaterialProperties = null;
  let currentRenderDomainCounts = null;
  let currentPhysicalLawGroups = null;
  let sphResidentMaterialInterfaceState = null;
  let sphResidentRenderState = null;
  let sphResidentPressureInterfaceState = null;
  let sphResidentSurfaceDraw = null;
  let sphResidentSurfaceDrawRenderBridge = null;
  let sphResidentRenderSurfaceState = null;
  let pressureInterfaceForceRowsUpload = null;
  let pressureInterfaceForceRowsUploadSignature = null;
  let currentSurfaceBatchIdentitySignature = 'empty';
  scene.userData.opticalGpuTable = opticalGpuTable;
  scene.userData.opticalGpuLookup = opticalGpuLookup;
  scene.userData.opticalGpuLookupExecution = null;
  scene.userData.opticalGpuLookupDrawState = null;
  scene.userData.sphGpuParticleState = null;
  scene.userData.sphGpuParticleUpload = null;
  scene.userData.mlsMpmGpuParticleState = null;
  scene.userData.mlsMpmGpuParticleUpload = null;
  scene.userData.mlsMpmMechanicsPrediction = null;
  scene.userData.mlsMpmP2gGridProjection = null;
  scene.userData.mlsMpmGridUpdate = null;
  scene.userData.mlsMpmG2pReconstruction = null;
  scene.userData.mlsMpmResidentStep = null;
  scene.userData.mlsMpmResidentSteps = null;
  scene.userData.mlsMpmResidentRequestedReadbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
  scene.userData.sphThermalMaterialTable = null;
  scene.userData.sphThermalClosureGraphBuffers = null;
  scene.userData.sphThermalPhaseResponseTable = null;
  scene.userData.sphThermalResponseGraphUpload = null;
  scene.userData.mlsMpmMechanicsMaterialTable = null;
  scene.userData.sphReactionTable = null;
  scene.userData.sphRenderDomainCounts = null;
  scene.userData.sphPhysicalLawGroups = null;
  scene.userData.sphResidentMaterialInterfaceState = null;
  scene.userData.sphResidentRenderState = null;
  scene.userData.sphResidentPressureInterfaceState = null;
  scene.userData.sphResidentSurfaceDraw = null;
  scene.userData.sphResidentSurfaceDrawRenderBridge = null;
  scene.userData.sphResidentRenderSurfaceState = null;
  scene.userData.sphPressureInterfaceForceRowsUpload = null;

  function markSurfaceActive(surface) {
    surface.inactiveFrameCount = 0;
    surface.mesh.userData.surfaceInactiveFrameCount = 0;
  }

  function hideSurfaceAfterGrace(surface, renderSource, options = {}) {
    return hideRenderFieldSurfaceAfterGrace(surface, renderSource, options);
  }

  function applyOpticalGpuLookupExecution(execution, lookupState = opticalGpuLookup) {
    if (!execution?.outputs) return [];
    const rows = decodeOpticalGpuLookupOutputRows(execution, lookupState.lookup);
    const applied = [];
    for (const row of rows) {
      const surfaceKey = lookupState.surfaceKeys?.[row.queryIndex];
      const surface = surfaceKey ? surfaces.get(surfaceKey) : null;
      if (!surface || row.status === 255 || row.recordIndex < 0) continue;
      const { mesh } = surface;
      const material = mesh.material;
      const descriptor = surface.descriptor || row;
      material.color.setRGB(
        clamp(row.baseColorLinear[0], 0, 1),
        clamp(row.baseColorLinear[1], 0, 1),
        clamp(row.baseColorLinear[2], 0, 1),
        THREE.LinearSRGBColorSpace
      );
      const renderAlpha = renderAlphaFromOpticalResponse(row, descriptor);
      material.opacity = renderAlpha;
      material.transparent = renderAlpha < 0.999;
      material.depthWrite = renderDepthWriteFromOpticalResponse(row, descriptor);
      material.metalness = clamp(row.metalness, 0, 1);
      material.roughness = clamp(row.roughness, 0, 1);
      material.transmission = clamp(row.transmission, 0, 1);
      material.ior = Math.max(1, row.ior || 1);
      material.vertexColors = row.vertexColorPolicyId === 2;
      const ordering = applySurfaceRenderOrdering(mesh, row, descriptor);
      material.needsUpdate = true;
      mesh.userData.opticalGpuLookupOutput = { ...row, renderAlpha };
      mesh.userData.opticalGpuExecutionBackend = execution.backend;
      applied.push({ surfaceKey, row, ordering });
    }
    scene.userData.opticalGpuLookupDrawState = {
      schema: 'peercompute.ulg.optical-gpu-draw-state.v0',
      sourceExecutionSchema: execution.schema,
      backend: execution.backend,
      appliedCount: applied.length,
      rows,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    return applied;
  }

  function requestCachedOpticalGpuDevice(ref = navigatorRef) {
    if (!opticalGpuDeviceResultPromise) {
      opticalGpuDeviceResultPromise = requestOpticalGpuDevice(ref).then((result) => {
        if (result.device?.lost?.then) {
          result.device.lost.finally(() => {
            if (opticalGpuDeviceResultPromise) opticalGpuDeviceResultPromise = null;
          }).catch(() => {});
        }
        return result;
      }).catch((error) => {
        opticalGpuDeviceResultPromise = null;
        return {
          status: 'webgpu-error-fallback',
          reason: error instanceof Error ? error.message : String(error),
          device: null
        };
      });
    }
    return opticalGpuDeviceResultPromise;
  }

  async function refreshOpticalGpuLookup({
    preferWebGpu = preferWebGpuOpticalLookup,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    parityTolerance = 1e-6,
    webGpuRunner = undefined
  } = {}) {
    const generation = opticalGpuLookupGeneration;
    const currentTable = opticalGpuTable;
    const currentLookup = opticalGpuLookup;
    const signature = currentLookup.signature;
    if (
      !force
      && currentLookup.execution?.signature === signature
    ) {
      return currentLookup;
    }
    if (!force && pendingOpticalGpuLookup?.signature === signature) {
      return pendingOpticalGpuLookup.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const execution = await runOpticalGpuLookupWithOptionalWebGpu({
        table: currentTable,
        lookup: currentLookup.lookup,
        cpuReference: currentLookup.cpuReference,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || generation !== opticalGpuLookupGeneration || opticalGpuLookup.signature !== signature) {
        return {
          ...currentLookup,
          execution: {
            ...execution,
            stale: true
          }
        };
      }
      opticalGpuLookup = {
        ...currentLookup,
        execution
      };
      scene.userData.opticalGpuLookup = opticalGpuLookup;
      scene.userData.opticalGpuLookupExecution = execution;
      applyOpticalGpuLookupExecution(execution, opticalGpuLookup);
      return opticalGpuLookup;
    })();
    pendingOpticalGpuLookup = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingOpticalGpuLookup?.promise === promise) pendingOpticalGpuLookup = null;
    }
  }

  function sphGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.state?.byteLength ?? 0,
      packed.thermo?.byteLength ?? 0
    ].join('|');
  }

  function mlsMpmGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.mechanics?.byteLength ?? 0,
      packed.mechanicsDtS ?? 0,
      packed.mechanicalSubsteps ?? 1,
      packed.soundSpeedScale ?? 0,
      packed.minGasSoundSpeedMPerS ?? 0
    ].join('|');
  }

  function sphReactionTableSignature(table = sphReactionTable) {
    if (!table) return 'no-reaction-table';
    return [
      table.reactionCount ?? 0,
      table.reactionHeaderCount ?? 0,
      table.reactantTermCount ?? 0,
      table.productTermCount ?? 0,
      table.gasProductCount ?? 0,
      table.atomTermCount ?? 0,
      table.productPhaseCount ?? 0,
      Array.from(table.records || []).join(','),
      Array.from(table.productPhaseRecords || []).join(','),
      Array.from(table.reactionHeaders || []).join(','),
      Array.from(table.reactantTermRecords || []).join(','),
      Array.from(table.productTermRecords || []).join(','),
      Array.from(table.gasProductRecords || []).join(','),
      Array.from(table.atomTermRecords || []).join(',')
    ].join('|');
  }

  function pressureInterfaceForceSolverSignature(solver = sphResidentRenderState?.pressureInterfaceForceSolver) {
    if (!solver?.schema) return 'no-pressure-interface-force-solver';
    const rows = solver.forceRowValues instanceof Float32Array
      ? solver.forceRowValues
      : (solver.forceRows instanceof Float32Array ? solver.forceRows : null);
    return [
      solver.schema,
      solver.status ?? null,
      solver.forceCouplingStatus ?? null,
      solver.forceApplicationStatus ?? null,
      solver.forceRowCount ?? 0,
      solver.conservationStatus ?? null,
      solver.conservationResidualMagnitudeN ?? 0,
      rows ? Array.from(rows).join(',') : 'no-force-rows'
    ].join('|');
  }

  function pressureInterfaceForceRowsFromSolver(solver = null) {
    const rows = solver?.forceRowValues instanceof Float32Array
      ? solver.forceRowValues
      : (solver?.forceRows instanceof Float32Array ? solver.forceRows : null);
    if (!(rows instanceof Float32Array)) return null;
    const forceRowCount = Math.max(0, Math.round(Number(solver?.forceRowCount) || 0));
    const strideFloats = Math.max(1, Math.round(Number(solver?.forceRowStrideFloats) || 16));
    if (forceRowCount > 0 && rows.length < forceRowCount * strideFloats) return null;
    return rows;
  }

  function currentPressureInterfaceGridForceAdmission() {
    return sphResidentPressureInterfaceState?.pressureInterfaceGridForceAdmission
      ?? sphResidentRenderState?.pressureInterfaceGridForceAdmission
      ?? scene.userData.sphPressureInterfaceGridForceAdmission
      ?? mlsMpmResidentSteps?.pressureInterfaceSameFrameGridForceAdmission
      ?? null;
  }

  function pressureInterfaceGridForceUploadAdmission({
    pressureInterfaceForceSolver = null,
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    forceRowCount = 0
  } = {}) {
    const admission = pressureInterfaceGridForceAdmissionAllowsApplication({
      pressureInterfaceGridForceAdmission,
      pressureInterfaceForceSolver,
      forceRowCount
    });
    const solverApproved = pressureInterfaceForceSolverAllowsGridApplication(pressureInterfaceForceSolver);
    return {
      ...admission,
      schema: ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
      solverApproved,
      approved: admission.approved === true && solverApproved
    };
  }

  function blockedPressureInterfaceForceRowsUpload({
    pressureInterfaceForceSolver = null,
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    forceRowCount = 0,
    rows = null,
    signature = null,
    retainInScene = true
  } = {}) {
    const admission = pressureInterfaceGridForceUploadAdmission({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount
    });
    const upload = {
      schema: 'peercompute.ulg.sph-pressure-interface-force-rows-upload.v0',
      status: 'blocked-pressure-interface-grid-force-admission-required',
      blocker: admission.solverApproved
        ? 'pressure-interface-grid-force-consumption-admission-required'
        : 'pressure-interface-force-solver-grid-application-not-approved',
      sourceSchema: pressureInterfaceForceSolver?.schema ?? null,
      forceSolverStatus: pressureInterfaceForceSolver?.status ?? null,
      forceRowCount,
      forceRowStrideFloats: pressureInterfaceForceSolver?.forceRowStrideFloats ?? null,
      forceRowByteLength: 0,
      candidateForceRowByteLength: rows instanceof Float32Array ? rows.byteLength : 0,
      buffer: null,
      bufferRetained: false,
      signature,
      pressureInterfaceForceRowsUploadQueueCompletionStatus: null,
      pressureInterfaceForceRowsUploadQueueCompletionMethod: null,
      pressureInterfaceForceRowsConsumerQueueCompletionStatus: null,
      pressureInterfaceForceRowsConsumerQueueCompletionMethod: null,
      pressureInterfaceForceRowsUploadCleanupStatus: null,
      pressureInterfaceForceRowsUploadDestroyStatus: null,
      pressureInterfaceGridForceAdmissionSchema: admission.schema,
      pressureInterfaceGridForceAdmissionStatus: admission.status,
      pressureInterfaceGridForceAdmissionApproved: admission.approved === true,
      pressureInterfaceGridForceAdmissionDescriptorStatus: admission.descriptorStatus,
      pressureInterfaceGridForceAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
      pressureInterfaceForceRowsLeaseStatus: null,
      pressureInterfaceForceRowsLeaseResourceCount: 0,
      pressureInterfaceForceRowsLeaseActiveCount: 0,
      pressureInterfaceForceRowsLeaseSummary: null,
      retainedInScene: Boolean(retainInScene),
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    if (!retainInScene) return upload;
    destroyPressureInterfaceForceRowsUpload();
    pressureInterfaceForceRowsUpload = upload;
    pressureInterfaceForceRowsUploadSignature = signature;
    publishPressureInterfaceForceRowsUpload(upload);
    return upload;
  }

  function pressureInterfaceForceRowsUploadApproved({
    pressureInterfaceForceSolver = null,
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    forceRowCount = 0
  } = {}) {
    return pressureInterfaceGridForceUploadAdmission({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount
    }).approved === true;
  }

  function applyPressureInterfaceUploadFields(target, upload = pressureInterfaceForceRowsUpload) {
    if (!target) return target;
    Object.assign(target, pressureInterfaceForceRowsUploadFields(upload));
    return target;
  }

  function publishSphResidentMaterialInterfaceState(state) {
    sphResidentMaterialInterfaceState = state || null;
    scene.userData.sphResidentMaterialInterfaceState = sphResidentMaterialInterfaceState;
    return sphResidentMaterialInterfaceState;
  }

  function publishSphResidentPressureInterfaceState(state) {
    sphResidentPressureInterfaceState = state || null;
    scene.userData.sphResidentPressureInterfaceState = sphResidentPressureInterfaceState;
    if (sphResidentRenderState) {
      Object.assign(sphResidentRenderState, pressureInterfaceRenderStateFields(sphResidentPressureInterfaceState));
    }
    return sphResidentPressureInterfaceState;
  }

  function currentPressureInterfaceForceSolver() {
    return sphResidentPressureInterfaceState?.pressureInterfaceForceSolver
      ?? sphResidentRenderState?.pressureInterfaceForceSolver
      ?? null;
  }

  function currentPressureInterfaceForceRowsUpload(solver = currentPressureInterfaceForceSolver()) {
    if (!solver?.schema || !pressureInterfaceForceRowsUpload?.buffer) return null;
    const signature = pressureInterfaceForceSolverSignature(solver);
    if (pressureInterfaceForceRowsUploadSignature !== signature) return null;
    return pressureInterfaceForceRowsUpload;
  }

  function currentPressureInterfaceForceRowsBuffer(solver = currentPressureInterfaceForceSolver()) {
    return currentPressureInterfaceForceRowsUpload(solver)?.buffer ?? null;
  }

  function currentPressureInterfaceGasCellFieldImport() {
    return sphResidentPressureInterfaceState?.pressureInterfaceGasCellFieldImport
      ?? sphResidentRenderState?.pressureInterfaceGasCellFieldImport
      ?? scene.userData.sphPressureInterfaceGasCellFieldImport
      ?? null;
  }

  function pressureInterfaceGasCellFieldImportSignature(importDescriptor = currentPressureInterfaceGasCellFieldImport()) {
    if (!importDescriptor?.schema) return 'no-pressure-interface-gas-cell-field-import';
    return [
      importDescriptor.schema,
      importDescriptor.status ?? null,
      importDescriptor.sourceHotBufferKey ?? null,
      importDescriptor.pressureInterfaceGasPressureCellRowCount ?? 0,
      ...(importDescriptor.retainedGasPressureBufferRefs || []),
      ...(importDescriptor.workerRetainedGasPressureBufferRefs || [])
    ].join('|');
  }

  function borrowPressureInterfaceForceRowsForStage({
    pressureInterfaceForceSolver = currentPressureInterfaceForceSolver(),
    pressureInterfaceForceRowsBuffer = null,
    consumerStage = 'mls-mpm-grid-update',
    reason = 'pressure-interface-force-rows-consumed'
  } = {}) {
    const upload = currentPressureInterfaceForceRowsUpload(pressureInterfaceForceSolver);
    if (!upload?.buffer || pressureInterfaceForceRowsBuffer !== upload.buffer) return null;
    const lease = upload.addPressureInterfaceForceRowsConsumerLease?.({
      consumerStage,
      reason
    });
    if (!lease) return null;
    publishPressureInterfaceForceRowsUpload(upload);
    let released = false;
    return {
      upload,
      lease,
      release(status = 'released-after-grid-update', consumerQueueEvidence = null) {
        if (released) return null;
        released = true;
        applyPressureInterfaceForceRowsConsumerQueueEvidence(upload, consumerQueueEvidence);
        const releasedLease = upload.releasePressureInterfaceForceRowsLease?.(lease.leaseId, { status });
        publishPressureInterfaceForceRowsUpload(upload);
        return {
          pressureInterfaceForceRowsConsumerLeaseId: lease.leaseId,
          pressureInterfaceForceRowsConsumerLeaseStatus: releasedLease?.status ?? status,
          pressureInterfaceForceRowsConsumerStage: lease.consumerStage,
          pressureInterfaceForceRowsUploadQueueCompletionStatus: upload.pressureInterfaceForceRowsUploadQueueCompletionStatus ?? null,
          pressureInterfaceForceRowsUploadQueueCompletionMethod: upload.pressureInterfaceForceRowsUploadQueueCompletionMethod ?? null,
          pressureInterfaceForceRowsConsumerQueueCompletionStatus: upload.pressureInterfaceForceRowsConsumerQueueCompletionStatus ?? null,
          pressureInterfaceForceRowsConsumerQueueCompletionMethod: upload.pressureInterfaceForceRowsConsumerQueueCompletionMethod ?? null,
          pressureInterfaceForceRowsLeaseSummary: upload.residentBufferLeaseSummary ?? null,
          pressureInterfaceForceRowsLeaseActiveCount: upload.residentBufferLeaseActiveLeaseCount ?? 0
        };
      }
    };
  }

  function destroyPressureInterfaceForceRowsUpload() {
    pressureInterfaceForceRowsUpload?.releasePressureInterfaceForceRowsLeases?.();
    pressureInterfaceForceRowsUpload?.destroy?.({
      releaseLeases: true,
      reason: 'pressure-interface-force-rows-upload-replaced'
    });
    pressureInterfaceForceRowsUpload = null;
    pressureInterfaceForceRowsUploadSignature = null;
    scene.userData.sphPressureInterfaceForceRowsUpload = null;
    if (sphResidentRenderState) {
      sphResidentRenderState.pressureInterfaceForceRowsUploadStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsUploadBlocker = null;
      sphResidentRenderState.pressureInterfaceForceRowsBufferRetained = false;
      sphResidentRenderState.pressureInterfaceForceRowsBufferByteLength = 0;
      sphResidentRenderState.pressureInterfaceForceRowsCandidateByteLength = 0;
      sphResidentRenderState.pressureInterfaceForceRowsUploadSignature = null;
      sphResidentRenderState.pressureInterfaceForceRowsUploadQueueCompletionStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsUploadQueueCompletionMethod = null;
      sphResidentRenderState.pressureInterfaceForceRowsConsumerQueueCompletionStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsConsumerQueueCompletionMethod = null;
      sphResidentRenderState.pressureInterfaceForceRowsUploadCleanupStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsUploadDestroyStatus = null;
      sphResidentRenderState.pressureInterfaceGridForceAdmission = null;
      sphResidentRenderState.pressureInterfaceGridForceAdmissionSchema = null;
      sphResidentRenderState.pressureInterfaceGridForceAdmissionStatus = null;
      sphResidentRenderState.pressureInterfaceGridForceAdmissionApproved = false;
      sphResidentRenderState.pressureInterfaceGridForceAdmissionDescriptorStatus = null;
      sphResidentRenderState.pressureInterfaceGridForceAdmissionSourceHotBufferKey = null;
      sphResidentRenderState.pressureInterfaceForceRowsLeaseStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsLeaseResourceCount = 0;
      sphResidentRenderState.pressureInterfaceForceRowsLeaseActiveCount = 0;
      sphResidentRenderState.pressureInterfaceForceRowsLeaseSummary = null;
    }
    applyPressureInterfaceUploadFields(sphResidentPressureInterfaceState, null);
  }

  function publishPressureInterfaceForceRowsUpload(upload = pressureInterfaceForceRowsUpload) {
    scene.userData.sphPressureInterfaceForceRowsUpload = upload;
    applyPressureInterfaceUploadFields(sphResidentPressureInterfaceState, upload);
    if (!sphResidentRenderState) return;
    applyPressureInterfaceUploadFields(sphResidentRenderState, upload);
  }

  function pressureConsumerQueueEvidenceFromExecution(execution = null) {
    const candidates = [
      execution,
      execution?.gridUpdate,
      execution?.finalStep,
      execution?.finalStep?.gridUpdate
    ];
    for (const candidate of candidates) {
      const status = candidate?.queueCompletionStatus ?? null;
      const method = candidate?.queueCompletionMethod ?? null;
      if (status || method) return { status, method };
    }
    return null;
  }

  function pressureUploadCompletionStatusFromConsumer(consumerQueueEvidence = null) {
    const status = consumerQueueEvidence?.status ?? null;
    if (status === 'queue-work-completed' || status === 'readback-map-completed') {
      return 'ordered-before-consumer-queue-completed';
    }
    if (status) return `ordered-before-consumer-${status}`;
    return 'queue-write-enqueued-consumer-completion-unavailable';
  }

  function applyPressureInterfaceForceRowsConsumerQueueEvidence(upload = null, consumerQueueEvidence = null) {
    if (!upload) return null;
    const evidence = consumerQueueEvidence || null;
    upload.pressureInterfaceForceRowsConsumerQueueCompletionStatus = evidence?.status ?? null;
    upload.pressureInterfaceForceRowsConsumerQueueCompletionMethod = evidence?.method ?? null;
    upload.pressureInterfaceForceRowsUploadQueueCompletionStatus = pressureUploadCompletionStatusFromConsumer(evidence);
    upload.pressureInterfaceForceRowsUploadQueueCompletionMethod = evidence?.method
      ? `queue.writeBuffer -> ${evidence.method}`
      : 'queue.writeBuffer';
    upload.queueCompletionStatus = upload.pressureInterfaceForceRowsUploadQueueCompletionStatus;
    upload.queueCompletionMethod = upload.pressureInterfaceForceRowsUploadQueueCompletionMethod;
    return upload;
  }

  function destroyTemporaryPressureInterfaceForceRowsUpload({
    upload = null,
    execution = null,
    reason = 'temporary-pressure-interface-force-rows-cleanup'
  } = {}) {
    if (!upload) return null;
    const consumerQueueEvidence = pressureConsumerQueueEvidenceFromExecution(execution);
    applyPressureInterfaceForceRowsConsumerQueueEvidence(upload, consumerQueueEvidence);
    const destroyEvent = upload.destroy?.({ reason }) ?? null;
    upload.pressureInterfaceForceRowsUploadCleanupStatus = destroyEvent?.status ?? 'destroy-noop-no-destroy-fn';
    upload.pressureInterfaceForceRowsUploadDestroyStatus = destroyEvent?.status ?? null;
    return {
      pressureInterfaceForceRowsTemporaryUploadStatus: upload.status ?? null,
      pressureInterfaceForceRowsTemporaryUploadQueueCompletionStatus: upload.pressureInterfaceForceRowsUploadQueueCompletionStatus ?? null,
      pressureInterfaceForceRowsTemporaryUploadQueueCompletionMethod: upload.pressureInterfaceForceRowsUploadQueueCompletionMethod ?? null,
      pressureInterfaceForceRowsTemporaryUploadConsumerQueueCompletionStatus: upload.pressureInterfaceForceRowsConsumerQueueCompletionStatus ?? null,
      pressureInterfaceForceRowsTemporaryUploadConsumerQueueCompletionMethod: upload.pressureInterfaceForceRowsConsumerQueueCompletionMethod ?? null,
      pressureInterfaceForceRowsTemporaryUploadCleanupStatus: upload.pressureInterfaceForceRowsUploadCleanupStatus ?? null,
      pressureInterfaceForceRowsTemporaryUploadDestroyStatus: upload.pressureInterfaceForceRowsUploadDestroyStatus ?? null,
      pressureInterfaceForceRowsTemporaryUploadLeaseStatus: upload.residentBufferLeaseLedgerStatus ?? null,
      pressureInterfaceForceRowsTemporaryUploadLeaseActiveCount: upload.residentBufferLeaseActiveLeaseCount ?? 0,
      pressureInterfaceForceRowsTemporaryUploadLeaseSummary: upload.residentBufferLeaseSummary ?? null
    };
  }

  function uploadPressureInterfaceForceRowsBuffer({
    pressureInterfaceForceSolver = currentPressureInterfaceForceSolver(),
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    device = null,
    retainInScene = true
  } = {}) {
    const rows = pressureInterfaceForceRowsFromSolver(pressureInterfaceForceSolver);
    const forceRowCount = Math.max(0, Math.round(Number(pressureInterfaceForceSolver?.forceRowCount) || 0));
    if (
      !device?.createBuffer
      || !device.queue?.writeBuffer
      || !(rows instanceof Float32Array)
      || forceRowCount <= 0
      || rows.byteLength <= 0
    ) {
      if (retainInScene) destroyPressureInterfaceForceRowsUpload();
      return null;
    }
    const signature = pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver);
    if (!pressureInterfaceForceRowsUploadApproved({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount
    })) {
      return blockedPressureInterfaceForceRowsUpload({
        pressureInterfaceForceSolver,
        pressureInterfaceGridForceAdmission,
        forceRowCount,
        rows,
        signature,
        retainInScene
      });
    }
    if (
      retainInScene
      &&
      pressureInterfaceForceRowsUpload
      && pressureInterfaceForceRowsUploadSignature === signature
      && pressureInterfaceForceRowsUpload.buffer
    ) {
      publishPressureInterfaceForceRowsUpload(pressureInterfaceForceRowsUpload);
      return pressureInterfaceForceRowsUpload;
    }
    if (retainInScene) destroyPressureInterfaceForceRowsUpload();
    const buffer = device.createBuffer({
      label: 'ulg-sph-pressure-interface-force-rows',
      size: Math.max(4, rows.byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(buffer, 0, rows);
    const leaseLedger = createResidentBufferLeaseLedger({
      ledgerId: `sph-pressure-interface-force-rows:${forceRowCount}:${rows.byteLength}`,
      stateKey: 'sph-pressure-interface-force-rows',
      scope: 'sph-pressure-interface-force-rows-buffer-leases'
    });
    const resourceKey = `pressure-interface-force-rows:${forceRowCount}:${rows.byteLength}`;
    registerResidentBufferResource(leaseLedger, {
      resourceKey,
      resourceKind: 'pressure-interface-force-rows-buffer',
      stateFamily: 'pressure-interface',
      ownerStage: 'pressure-interface-force-solver',
      producerStage: 'pressure-interface-force-solver',
      source: 'uploadPressureInterfaceForceRowsBuffer',
      status: 'pressure-interface-force-rows-buffer-retained',
      retained: true,
      byteLength: rows.byteLength,
      rowCount: forceRowCount,
      bufferLabel: buffer.label,
      expectedConsumers: ['mls-mpm-grid-update', 'resident-pressure-interface-state', 'resident-render-state']
    });
    const leaseIds = retainInScene
      ? [addResidentBufferLease(leaseLedger, {
        resourceKey,
        consumerStage: 'resident-pressure-interface-state',
        reason: 'retained-pressure-interface-force-rows'
      }).leaseId]
      : [];
    let destroyed = false;
    const refreshLeaseSummary = (target) => {
      target.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(leaseLedger);
      target.residentBufferLeaseLedgerStatus = target.residentBufferLeaseSummary.status;
      target.residentBufferLeaseResourceCount = target.residentBufferLeaseSummary.resourceCount;
      target.residentBufferLeaseActiveLeaseCount = target.residentBufferLeaseSummary.activeLeaseCount;
      return target.residentBufferLeaseSummary;
    };
    const upload = {
      schema: 'peercompute.ulg.sph-pressure-interface-force-rows-upload.v0',
      status: 'webgpu-pressure-interface-force-rows-uploaded',
      sourceSchema: pressureInterfaceForceSolver.schema,
      forceSolverStatus: pressureInterfaceForceSolver.status ?? null,
      forceRowCount,
      forceRowStrideFloats: pressureInterfaceForceSolver.forceRowStrideFloats ?? null,
      forceRowByteLength: rows.byteLength,
      buffer,
      bufferRetained: true,
      signature,
      pressureInterfaceGridForceAdmission,
      pressureInterfaceGridForceAdmissionSchema: ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
      pressureInterfaceGridForceAdmissionStatus: 'pressure-interface-grid-force-consumption-approved',
      pressureInterfaceGridForceAdmissionApproved: true,
      pressureInterfaceGridForceAdmissionDescriptorStatus: pressureInterfaceGridForceAdmission?.publicationStatus
        ?? pressureInterfaceGridForceAdmission?.admittedStatus
        ?? pressureInterfaceGridForceAdmission?.status
        ?? null,
      pressureInterfaceGridForceAdmissionSourceHotBufferKey: pressureInterfaceGridForceAdmission?.sourceHotBufferKey
        ?? pressureInterfaceGridForceAdmission?.hotBufferKey
        ?? null,
      pressureInterfaceForceRowsUploadQueueCompletionStatus: 'queue-write-enqueued',
      pressureInterfaceForceRowsUploadQueueCompletionMethod: 'queue.writeBuffer',
      pressureInterfaceForceRowsConsumerQueueCompletionStatus: null,
      pressureInterfaceForceRowsConsumerQueueCompletionMethod: null,
      pressureInterfaceForceRowsUploadCleanupStatus: null,
      pressureInterfaceForceRowsUploadDestroyStatus: null,
      queueCompletionStatus: 'queue-write-enqueued',
      queueCompletionMethod: 'queue.writeBuffer',
      residentBufferLeaseLedger: leaseLedger,
      residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(leaseLedger),
      residentBufferLeaseLedgerStatus: leaseLedger.status,
      residentBufferLeaseResourceCount: leaseLedger.resourceCount,
      residentBufferLeaseActiveLeaseCount: leaseLedger.activeLeaseCount,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false,
      addPressureInterfaceForceRowsConsumerLease({
        consumerStage = 'mls-mpm-grid-update',
        reason = 'pressure-interface-force-rows-consumed'
      } = {}) {
        const lease = addResidentBufferLease(leaseLedger, {
          resourceKey,
          consumerStage,
          reason
        });
        refreshLeaseSummary(this);
        return lease;
      },
      releasePressureInterfaceForceRowsLease(leaseId, { status = 'released' } = {}) {
        const lease = releaseResidentBufferLease(leaseLedger, leaseId, { status });
        refreshLeaseSummary(this);
        return lease;
      },
      releasePressureInterfaceForceRowsLeases({ status = 'released' } = {}) {
        for (const leaseId of leaseIds) {
          this.releasePressureInterfaceForceRowsLease(leaseId, { status });
        }
        return refreshLeaseSummary(this);
      },
      destroy({ force = false, releaseLeases = false, reason = 'pressure-interface-force-rows-cleanup' } = {}) {
        if (releaseLeases) this.releasePressureInterfaceForceRowsLeases();
        const event = destroyResidentBufferWithLease(leaseLedger, resourceKey, () => {
          if (destroyed) return;
          destroyed = true;
          buffer.destroy?.();
        }, { force, reason });
        refreshLeaseSummary(this);
        return event;
      }
    };
    if (!retainInScene) return upload;
    pressureInterfaceForceRowsUpload = upload;
    pressureInterfaceForceRowsUploadSignature = signature;
    publishPressureInterfaceForceRowsUpload(pressureInterfaceForceRowsUpload);
    return pressureInterfaceForceRowsUpload;
  }

  async function refreshSphResidentMaterialInterfaceState({
    preferWebGpu = true,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    residentSteps = mlsMpmResidentSteps,
    materialProperties = currentMaterialProperties,
    gasPressureSummary = null,
    source = 'resident-physics-material-interface-extractor',
    sourceCadence = 'resident-step-completed'
  } = {}) {
    const finalStep = residentSteps?.finalStep || mlsMpmResidentStep || null;
    const nextSphParticleState = residentSteps?.nextSphParticleState || sphGpuParticleState;
    const nextMlsMpmParticleState = residentSteps?.nextMlsMpmParticleState
      || finalStep?.nextMlsMpmParticleState
      || null;
    const nextSphUpload = residentSteps?.nextParticleUploads?.sphParticleUpload
      || finalStep?.nextParticleUploads?.sphParticleUpload
      || sphGpuParticleUpload
      || null;
    const nextMlsMpmUpload = residentSteps?.nextParticleUploads?.mlsMpmParticleUpload
      || finalStep?.nextParticleUploads?.mlsMpmParticleUpload
      || mlsMpmGpuParticleUpload
      || null;
    if (!nextSphParticleState?.schema || nextSphUpload?.status !== 'webgpu-uploaded') {
      return publishSphResidentMaterialInterfaceState({
        schema: 'peercompute.ulg.sph-material-interface-field.v0',
        status: 'resident-material-interface-source-unavailable',
        source,
        sourceCadence,
        reason: 'retained resident SPH buffers are not available',
        surfaceCount: 0,
        readySurfaceCount: 0,
        totalSurfaceAreaM2: 0,
        elementCount: 0,
        elements: [],
        gpuAuthoritativeState: false,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      });
    }
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || (preferWebGpu ? await requestCachedOpticalGpuDevice(overrideNavigatorRef) : null));
    if (!resolvedDeviceResult?.device) {
      return publishSphResidentMaterialInterfaceState({
        schema: 'peercompute.ulg.sph-material-interface-field.v0',
        status: 'resident-material-interface-webgpu-unavailable',
        source,
        sourceCadence,
        reason: resolvedDeviceResult?.reason || 'WebGPU material-interface extraction not available',
        surfaceCount: 0,
        readySurfaceCount: 0,
        totalSurfaceAreaM2: 0,
        elementCount: 0,
        elements: [],
        gpuAuthoritativeState: false,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      });
    }

    let renderRowsExecution = null;
    let interfaceSourceField = null;
    try {
      const reactionResult = finalStep?.reactionStep?.result || finalStep?.reactionStep || null;
      const reactionSummary = reactionResult?.reactionSummary || null;
      const residentProductMass = finalStep?.residentProductMass || reactionResult?.residentProductMass || null;
      const productEventBuffer = residentProductMass?.productEventBuffer || reactionSummary?.productEventBuffer || null;
      const productEventCount = Math.max(0, Math.round(Number(
        residentProductMass?.productEventRowCount ?? reactionSummary?.productEventRowCount
      ) || 0));
      const needsSurfaceTableSeed = !sphResidentRenderSurfaceState?.surfaceTable?.schema;
      renderRowsExecution = await extractSphRenderRowsWebGpu({
        device: resolvedDeviceResult.device,
        sphParticleState: nextSphParticleState,
        mlsMpmParticleState: residentSteps?.nextMlsMpmParticleState || finalStep?.nextMlsMpmParticleState || null,
        sphParticleUpload: nextSphUpload,
        mlsMpmParticleUpload: residentSteps?.nextParticleUploads?.mlsMpmParticleUpload
          || finalStep?.nextParticleUploads?.mlsMpmParticleUpload
          || null,
        sourceStateBuffer: nextSphUpload.stateBuffer,
        sourceThermoBuffer: nextSphUpload.thermoBuffer,
        sourceMechanicsBuffer: residentSteps?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
          || finalStep?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
          || null,
        retainRenderRowsBuffer: true,
        readbackMode: needsSurfaceTableSeed ? 'full-parity-readback' : SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
        ...renderDomainExtractionOptions(currentRenderDomainCounts)
      });
      const hasRenderRowsReadback = renderRowsExecution.renderRows instanceof Float32Array
        && renderRowsExecution.renderRows.length > 0;
      if (needsSurfaceTableSeed && hasRenderRowsReadback) {
        const decoded = decodeSphRenderRows(renderRowsExecution.renderRows, {
          materialProperties: materialProperties || {},
          reactionTable: sphReactionTable,
          gasPressureSummary
        });
        const particleBatches = createContinuousSurfaceBatches({
          positionsM: decoded.positionsM,
          colorsRgb: decoded.colorsRgb,
          materials: decoded.materials,
          particleRadiiM: decoded.particleRadiiM,
          boxEdgeM,
          boxDimsM: dims,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
        const productEventSurfaceBatches = createProductEventSurfaceBatches({
          baseBatches: particleBatches,
          reactionSummary,
          reactionTable: sphReactionTable,
          materialProperties,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
        const fieldBatches = createResidentRenderSurfaceBatches({
          particleBatches,
          productEventSurfaceBatches,
          materialProperties,
          reactionTable: sphReactionTable,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
        rebuildOpticalStateForSurfaceBatches(fieldBatches, { materialProperties });
        captureResidentRenderSurfaceState({
          particleBatches,
          fieldBatches,
          emissiveByMaterial: decoded.emissiveByMaterial,
          materialProperties
        });
      }
      const surfaceTable = sphResidentRenderSurfaceState?.surfaceTable;
      if (!surfaceTable?.schema) {
        return publishSphResidentMaterialInterfaceState({
          schema: 'peercompute.ulg.sph-material-interface-field.v0',
          status: 'resident-material-interface-surface-table-unavailable',
          source,
          sourceCadence,
          reason: 'resident surface table is not available',
          particleCount: nextSphParticleState.particleCount,
          renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback),
          surfaceCount: 0,
          readySurfaceCount: 0,
          totalSurfaceAreaM2: 0,
          elementCount: 0,
          elements: [],
          gpuAuthoritativeState: false,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        });
      }
      interfaceSourceField = await buildSphMaterialInterfaceSourceFieldWebGpu({
        device: resolvedDeviceResult.device,
        renderRows: renderRowsExecution.renderRows,
        renderRowsBuffer: renderRowsExecution.renderRowsBuffer || null,
        productEventBuffer,
        productEventCount,
        surfaceTable,
        particleCount: renderRowsExecution.particleCount,
        fieldPadding: FIELD_PADDING,
        refEdgeM,
        readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
        source,
        sourceCadence
      });
      const materialInterfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
        device: resolvedDeviceResult.device,
        renderField: interfaceSourceField,
        source,
        sourceCadence
      });
      materialInterfaceField.renderRowsReadback = Boolean(renderRowsExecution.renderRowsReadback);
      materialInterfaceField.renderRowsReadbackMode = renderRowsExecution.readbackMode ?? null;
      materialInterfaceField.interfaceSourceFieldSchema = interfaceSourceField.schema;
      materialInterfaceField.interfaceSourceFieldStatus = interfaceSourceField.status;
      materialInterfaceField.interfaceSourceFieldQueueCompletionStatus = interfaceSourceField.queueCompletionStatus ?? null;
      materialInterfaceField.interfaceSourceFieldQueueCompletionMethod = interfaceSourceField.queueCompletionMethod ?? null;
      materialInterfaceField.renderFieldReadback = Boolean(interfaceSourceField.sourceRenderFieldReadback);
      materialInterfaceField.renderFieldReadbackMode = interfaceSourceField.sourceRenderFieldReadbackMode ?? null;
      materialInterfaceField.renderFieldQueueCompletionStatus = interfaceSourceField.sourceRenderFieldQueueCompletionStatus ?? null;
      materialInterfaceField.renderFieldQueueCompletionMethod = interfaceSourceField.sourceRenderFieldQueueCompletionMethod ?? null;
      materialInterfaceField.gpuAuthoritativeState = true;
      return publishSphResidentMaterialInterfaceState(materialInterfaceField);
    } catch (error) {
      return publishSphResidentMaterialInterfaceState({
        schema: 'peercompute.ulg.sph-material-interface-field.v0',
        status: 'resident-material-interface-error',
        source,
        sourceCadence,
        reason: error instanceof Error ? error.message : String(error),
        surfaceCount: 0,
        readySurfaceCount: 0,
        totalSurfaceAreaM2: 0,
        elementCount: 0,
        elements: [],
        gpuAuthoritativeState: false,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      });
    } finally {
      interfaceSourceField?.releaseMaterialInterfaceSourceFieldLeases?.({
        status: 'released-after-material-interface-extraction'
      });
      interfaceSourceField?.destroyMaterialInterfaceSourceFieldBuffers?.({
        releaseLeases: true,
        reason: 'material-interface-extraction-cleanup'
      });
      renderRowsExecution?.destroyRenderRowsBuffer?.();
    }
  }

  async function refreshSphResidentPressureInterfaceState({
    preferWebGpu = true,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    materialInterfaceField = sphResidentMaterialInterfaceState
      ?? sphResidentPressureInterfaceState?.materialInterfaceField
      ?? sphResidentRenderState?.materialInterfaceField
      ?? null,
    gasPressureSummary = null,
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    pressureInterfaceGasCellFieldAdmission = null,
    pressureInterfaceGasCellFieldImport = null,
    residentProductMass = null,
    reactionSummary = null,
    reactionTable = sphReactionTable,
    gasCellEosProducerStageResult = null,
    residentAuthorityHost = null,
    pressureInterfaceGasCellFieldImportSourceTaskId = null,
    pressureInterfaceGasCellFieldImportStateKey = null,
    source = 'resident-pressure-interface-physics-refresh',
    sourceCadence = null
  } = {}) {
    const effectiveResidentAuthorityHost = resolveSceneResidentAuthorityHost(residentAuthorityHost);
    const suppliedImportReady = pressureInterfaceGasCellFieldImport?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA
      && pressureInterfaceGasCellFieldImport?.status === 'pressure-interface-gas-cell-field-import-ready';
    let effectiveGasPressureSummaryForProducer = gasPressureSummary;
    let spatialGasLedgerProducerStageRequest = null;
    if (
      !suppliedImportReady
      && !gasCellEosProducerStageResult
      && !pressureInterfaceSpatialGasSpeciesLedgerReady(pressureInterfaceSpatialGasSpeciesLedgerFromSummary(effectiveGasPressureSummaryForProducer))
    ) {
      spatialGasLedgerProducerStageRequest = await submitSceneSpatialGasLedgerProducerStageForPressureInterface({
        residentAuthorityHost: effectiveResidentAuthorityHost,
        gasPressureSummary,
        residentProductMass,
        reactionSummary,
        reactionTable,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult,
        cacheKey: pressureInterfaceGasCellFieldImportSourceTaskId
          || `ulg:scene-spatial-gas-ledger-producer:${source}:${pressureInterfaceGasCellFieldImportStateKey || 'active'}`,
        stateKey: pressureInterfaceGasCellFieldImportStateKey,
        source,
        sourceCadence,
        sourceTaskId: pressureInterfaceGasCellFieldImportSourceTaskId,
        sourceStage: 'residentProductMass',
        boxDimsM: gasPressureSummary?.boxDimsM || dims
      });
      if (pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger)) {
        effectiveGasPressureSummaryForProducer = {
          ...(gasPressureSummary || {}),
          schema: gasPressureSummary?.schema || 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
          status: gasPressureSummary?.status || 'spatial-gas-ledger-producer-pressure-summary-local',
          source: gasPressureSummary?.source || 'spatial-gas-ledger-producer-stage',
          spatialGasSpeciesLedger: spatialGasLedgerProducerStageRequest.spatialGasSpeciesLedger,
          spatialGasSpeciesLedgerSchema: spatialGasLedgerProducerStageRequest.spatialGasSpeciesLedger.schema,
          spatialGasSpeciesLedgerStatus: spatialGasLedgerProducerStageRequest.spatialGasSpeciesLedger.status,
          residentSpatialGasSpeciesLedgerStatus: 'resident-spatial-gas-species-ledger-available'
        };
      }
    }
    let effectiveGasCellEosProducerStageResult = gasCellEosProducerStageResult;
    let gasCellEosProducerStageRequest = null;
    if (!suppliedImportReady && !effectiveGasCellEosProducerStageResult) {
      gasCellEosProducerStageRequest = await submitSceneGasCellEosProducerStageForPressureInterface({
        residentAuthorityHost: effectiveResidentAuthorityHost,
        gasPressureSummary: effectiveGasPressureSummaryForProducer,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult,
        cacheKey: pressureInterfaceGasCellFieldImportSourceTaskId
          || `ulg:scene-gas-cell-eos-producer:${source}:${pressureInterfaceGasCellFieldImportStateKey || 'active'}`,
        stateKey: pressureInterfaceGasCellFieldImportStateKey,
        source,
        sourceCadence,
        sourceTaskId: pressureInterfaceGasCellFieldImportSourceTaskId,
        sourceStage: 'residentGasPressure'
      });
      if (gasCellEosProducerStageRequest?.gasCellEosProducerStageResultReady) {
        effectiveGasCellEosProducerStageResult = gasCellEosProducerStageRequest.gasCellEosProducerStageResult;
      }
    }
    const pressureInterfaceGasCellFieldImportPublication = pressureInterfaceGasCellFieldImport
      ? {
          schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
          status: suppliedImportReady
            ? 'pressure-interface-gas-cell-field-import-reused'
            : 'pressure-interface-gas-cell-field-import-supplied-not-ready',
          blocker: suppliedImportReady
            ? null
            : (pressureInterfaceGasCellFieldImport.status || 'pressure-interface-gas-cell-field-import-not-ready'),
          source,
          sourceCadence,
          pressureInterfaceGasCellFieldImport,
          pressureInterfaceGasCellFieldImportReady: suppliedImportReady,
          pressureInterfaceGasCellFieldImportSchema: pressureInterfaceGasCellFieldImport.schema || null,
          pressureInterfaceGasCellFieldImportStatus: pressureInterfaceGasCellFieldImport.status || null,
          pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureInterfaceGasCellFieldImport.sourceHotBufferKey || null,
          pressureInterfaceGasCellFieldAdmission: pressureInterfaceGasCellFieldImport.pressureInterfaceGasCellFieldAdmission || null,
          pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldImport.pressureInterfaceGasCellFieldAdmission?.schema || null,
          pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldImport.pressureInterfaceGasCellFieldAdmission?.status || null,
          pressureInterfaceGasCellFieldAdmissionApproved: pressureInterfaceGasCellFieldImport.pressureInterfaceGasCellFieldAdmission?.gasCellFieldConsumptionApproved === true,
          retainedGasPressureBufferRefs: [...(pressureInterfaceGasCellFieldImport.retainedGasPressureBufferRefs || [])],
          workerRetainedGasPressureBufferRefs: [...(pressureInterfaceGasCellFieldImport.workerRetainedGasPressureBufferRefs || [])],
          authoritativeStateMutation: false,
          stateManagerAdmissionRequired: true,
          scientificValidation: false,
          gasValidation: false,
          sphValidation: false,
          fullPhysicsValidation: false
        }
      : publishScenePressureInterfaceGasCellFieldImportSource({
          residentAuthorityHost: effectiveResidentAuthorityHost,
          gasPressureSummary: effectiveGasPressureSummaryForProducer,
          gasCellEosProducerStageResult: effectiveGasCellEosProducerStageResult,
          pressureInterfaceGasCellFieldAdmission,
          cacheKey: pressureInterfaceGasCellFieldImportSourceTaskId
            || `ulg:scene-pressure-interface-gas-cell-field-import:${source}:${pressureInterfaceGasCellFieldImportStateKey || 'active'}`,
          stateKey: pressureInterfaceGasCellFieldImportStateKey,
          source,
          sourceCadence,
          sourceTaskId: pressureInterfaceGasCellFieldImportSourceTaskId,
          sourceStage: 'residentGasPressure',
          allowSummaryGasCellFieldImport: false
        });
    const effectivePressureInterfaceGasCellFieldImport = pressureInterfaceGasCellFieldImportPublication
      ?.pressureInterfaceGasCellFieldImportReady
      ? pressureInterfaceGasCellFieldImportPublication.pressureInterfaceGasCellFieldImport
      : null;
    const effectiveGasPressureSummary = effectivePressureInterfaceGasCellFieldImport?.gasCellFieldSnapshot && effectiveGasPressureSummaryForProducer
      ? {
          ...effectiveGasPressureSummaryForProducer,
          gasCellField: effectivePressureInterfaceGasCellFieldImport.gasCellFieldSnapshot,
          pressureFeedback: effectiveGasPressureSummaryForProducer.pressureFeedback
            ? {
                ...effectiveGasPressureSummaryForProducer.pressureFeedback,
                gasCellField: effectivePressureInterfaceGasCellFieldImport.gasCellFieldSnapshot
              }
            : effectiveGasPressureSummaryForProducer.pressureFeedback
        }
      : effectiveGasPressureSummaryForProducer;
    const pressureFeedback = pressureFeedbackFromGasPressureSummary(effectiveGasPressureSummary);
    const pressureInterfaceCoupling = gasPressureInterfaceCouplingSummary({
      pressureFeedback,
      materialInterfaceField
    });
    const pressureInterfaceForcePreview = gasPressureInterfaceForcePreview({
      pressureFeedback,
      materialInterfaceField,
      pressureInterfaceCoupling
    });
    const pressureInterfaceForceSolver = gasPressureInterfaceForceSolver({
      pressureFeedback,
      materialInterfaceField,
      pressureInterfaceCoupling
    });
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || (preferWebGpu ? await requestCachedOpticalGpuDevice(overrideNavigatorRef) : null));
    const pressureInterfaceForceRowsUploadForState = uploadPressureInterfaceForceRowsBuffer({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      device: device || resolvedDeviceResult?.device || null
    });
    const state = buildSphResidentPressureInterfaceStateSummary({
      materialInterfaceField,
      gasPressureSummary: effectiveGasPressureSummary,
      pressureInterfaceCoupling,
      pressureInterfaceForcePreview,
      pressureInterfaceForceSolver,
      pressureInterfaceForceRowsUpload: pressureInterfaceForceRowsUploadForState,
      pressureInterfaceGridForceAdmission,
      pressureInterfaceGasCellFieldImportPublication,
      spatialGasLedgerProducerStageRequest,
      gasCellEosProducerStageRequest,
      source,
      sourceCadence
    });
    scene.userData.sphPressureInterfaceGasCellFieldImportPublication = pressureInterfaceGasCellFieldImportPublication;
    scene.userData.sphPressureInterfaceGasCellFieldImport = state.pressureInterfaceGasCellFieldImport || null;
    return publishSphResidentPressureInterfaceState(state);
  }

  function sphThermalResponseGraphSignature({
    thermalMaterialTable = sphThermalMaterialTable,
    thermalClosureGraphBuffers = sphThermalClosureGraphBuffers,
    thermalPhaseResponseTable = sphThermalPhaseResponseTable
  } = {}) {
    const graphBank = thermalClosureGraphBuffers?.graphBank;
    if (!thermalMaterialTable || !graphBank || !thermalPhaseResponseTable) return null;
    return [
      thermalMaterialTable.materialCount ?? 0,
      thermalMaterialTable.segmentCount ?? 0,
      thermalPhaseResponseTable.materialCount ?? 0,
      thermalPhaseResponseTable.responseCount ?? 0,
      graphBank.graphCount ?? 0,
      graphBank.nodeCount ?? 0,
      graphBank.sampleCount ?? 0,
      Array.from(thermalPhaseResponseTable.records || []).join(','),
      Array.from(thermalPhaseResponseTable.responses || []).join(','),
      Array.from(graphBank.nodeRows || []).join(','),
      Array.from(graphBank.sampleRows || []).join(',')
    ].join('|');
  }

  function mlsMpmMechanicsPredictionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0]
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      dt,
      gravityMPerS2.join(','),
      dims.join(',')
    ].join('|');
  }

  function mlsMpmP2gGridProjectionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM ?? 0,
    internalPressureScale = normalizePhysicalLawGroups(currentPhysicalLawGroups).eos ? 1 : 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      internalPressureScale,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmGridUpdateSignatureFor({
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    pressureInterfaceForceSolver = null
  } = {}) {
    if (!p2gGridProjection?.schema) return null;
    return [
      p2gGridProjection.signature ?? [
        p2gGridProjection.schema,
        p2gGridProjection.backend,
        p2gGridProjection.gridNodeCount,
        p2gGridProjection.gridSpacingM,
        p2gGridProjection.dt ?? 0
      ].join(':'),
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver),
      dims.join(',')
    ].join('|');
  }

  function mlsMpmG2pReconstructionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature || !gridUpdate?.schema) return null;
    return [
      sphSignature,
      mlsSignature,
      gridUpdate.signature ?? `${gridUpdate.schema}|${gridUpdate.backend}|${gridUpdate.gridNodeCount}|${gridUpdate.dt ?? 0}`,
      dt,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmResidentStepSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
    dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    pressureInterfaceForceSolver = null,
    pressureInterfaceGasCellFieldImport = currentPressureInterfaceGasCellFieldImport(),
    wallTemperaturesK = currentWallTemperaturesK,
    physicalLawGroups = currentPhysicalLawGroups,
    internalPressureScale = normalizePhysicalLawGroups(physicalLawGroups).eos ? 1 : 0,
    fuseNoFullResidentMechanicsSequence = false,
    fuseNoFullResidentMechanicsActiveGrid = false,
    fuseNoFullResidentActiveGrid = false,
    measureFusedSequenceQueueFence = false,
    activeGridSafetyCells = undefined,
    fusedActiveGridSafetyCells = undefined
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    const normalizedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    const activeGridSafetyValue = fusedActiveGridSafetyCells ?? activeGridSafetyCells;
    const normalizedActiveGridSafetyCells = Number.isFinite(Number(activeGridSafetyValue)) && Number(activeGridSafetyValue) > 0
      ? Math.max(1, Math.round(Number(activeGridSafetyValue)))
      : 'default';
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      normalizedReadbackMode,
      internalPressureScale,
      JSON.stringify(wallTemperaturesK || {}),
      physicalLawGroupsSignature(physicalLawGroups),
      sphReactionTableSignature(),
      pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver),
      pressureInterfaceGasCellFieldImportSignature(pressureInterfaceGasCellFieldImport),
      dims.join(','),
      `fuseSeq=${Boolean(fuseNoFullResidentMechanicsSequence) ? 1 : 0}`,
      `activeGrid=${Boolean(fuseNoFullResidentMechanicsActiveGrid || fuseNoFullResidentActiveGrid) ? 1 : 0}`,
      `activeGridSafety=${normalizedActiveGridSafetyCells}`,
      `queueFence=${Boolean(measureFusedSequenceQueueFence) ? 1 : 0}`
    ].join('|');
  }

  function normalizeResidentStepCount(value) {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  }

  function mlsMpmResidentStepsSignatureFor({
    stepCount = 1,
    retainIntermediateSteps = false,
    compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
    compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
    residentSourceMode = 'cpu-packed-state',
    ...args
  } = {}) {
    const stepSignature = mlsMpmResidentStepSignatureFor(args);
    if (!stepSignature) return null;
    return [
      stepSignature,
      normalizeResidentStepCount(stepCount),
      Boolean(retainIntermediateSteps),
      normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode),
      normalizeMlsMpmResidentSummaryScope(compactSummaryScope),
      residentSourceMode
    ].join('|');
  }

  function residentContinuationBuffersFromExecution(execution = null) {
    return [
      execution?.nextParticleUploads?.sphParticleUpload?.stateBuffer,
      execution?.nextParticleUploads?.sphParticleUpload?.thermoBuffer,
      execution?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer,
      execution?.finalStep?.nextParticleUploads?.sphParticleUpload?.stateBuffer,
      execution?.finalStep?.nextParticleUploads?.sphParticleUpload?.thermoBuffer,
      execution?.finalStep?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
    ].filter(Boolean);
  }

  function clearMlsMpmResidentExecutionArtifacts({ preserveBuffers = [] } = {}) {
    if (mlsMpmResidentSteps) {
      destroyMlsMpmResidentStepsBuffers(mlsMpmResidentSteps, { preserveBuffers });
    } else {
      const preserved = new Set((preserveBuffers || []).filter(Boolean));
      const destroyUnlessPreserved = (buffer) => {
        if (!buffer || preserved.has(buffer)) return;
        buffer.destroy?.();
      };
      destroyUnlessPreserved(mlsMpmP2gGridProjection?.gpuResult?.gridBuffer);
      destroyUnlessPreserved(mlsMpmP2gGridProjection?.gridBuffer);
      destroyUnlessPreserved(mlsMpmGridUpdate?.gpuResult?.updatedGridBuffer);
      destroyUnlessPreserved(mlsMpmGridUpdate?.updatedGridBuffer);
      if (mlsMpmG2pReconstruction?.destroyOutputParticleBuffers) {
        mlsMpmG2pReconstruction.destroyOutputParticleBuffers();
      } else {
        mlsMpmG2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.();
      }
    }
    mlsMpmP2gGridProjection = null;
    mlsMpmP2gGridProjectionSignature = null;
    scene.userData.mlsMpmP2gGridProjection = null;
    mlsMpmGridUpdate = null;
    mlsMpmGridUpdateSignature = null;
    scene.userData.mlsMpmGridUpdate = null;
    mlsMpmG2pReconstruction = null;
    mlsMpmG2pReconstructionSignature = null;
    scene.userData.mlsMpmG2pReconstruction = null;
    mlsMpmResidentStep = null;
    mlsMpmResidentStepSignature = null;
    scene.userData.mlsMpmResidentStep = null;
    mlsMpmResidentSteps = null;
    mlsMpmResidentStepsSignature = null;
    scene.userData.mlsMpmResidentSteps = null;
  }

  function releaseSphResidentSurfaceDrawResources({
    surfaceDraw = null,
    renderBridge = null,
    clearOverlay = false,
    removeCanvas = false,
    status = 'surface-draw-overlay-resources-released'
  } = {}) {
    if (renderBridge) {
      if (renderBridge.threeSurfaceGroup) {
        scene.remove(renderBridge.threeSurfaceGroup);
        renderBridge.threeSurfaceGroup.traverse?.((object) => {
          if (!object?.isMesh && !object?.isPoints) return;
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material?.map?.dispose?.();
            material?.alphaMap?.dispose?.();
            material?.dispose?.();
          }
        });
        renderBridge.threeSurfaceGroup = null;
        renderBridge.threeMeshes = [];
        renderBridge.threeMeshCount = 0;
      }
      if (clearOverlay) clearSphResidentSurfaceDrawOverlayCanvas(renderBridge);
      renderBridge.cameraBuffer?.destroy?.();
      renderBridge.opticalGpuBuffers?.recordsBuffer?.destroy?.();
      renderBridge.opticalGpuBuffers?.spectralSamplesBuffer?.destroy?.();
      renderBridge.depthTexture?.destroy?.();
      renderBridge.oitAccumTexture?.destroy?.();
      renderBridge.oitRevealTexture?.destroy?.();
      if (renderBridge.renderRowsBufferOwned) {
        renderBridge.renderRowsBuffer?.destroy?.();
      }
      renderBridge.drawState = null;
      renderBridge.renderRowDrawState = null;
      renderBridge.cameraBuffer = null;
      renderBridge.opticalGpuBuffers = null;
      renderBridge.depthTexture = null;
      renderBridge.oitAccumTexture = null;
      renderBridge.oitRevealTexture = null;
      renderBridge.renderRowsBuffer = null;
      renderBridge.renderRowsBufferOwned = false;
      renderBridge.status = status;
      renderBridge.lastRenderStatus = status;
      if (removeCanvas && renderBridge.canvas?.parentNode) {
        renderBridge.canvas.parentNode.removeChild(renderBridge.canvas);
      }
      if (renderBridge === sphResidentSurfaceDrawRenderBridge) {
        scene.userData.sphResidentSurfaceDrawRenderBridge = renderBridge;
      }
	    }
	    surfaceDraw?.surfaceDraw?.releaseSurfaceDrawBufferLeases?.();
	    surfaceDraw?.surfaceDraw?.destroySurfaceDrawBuffers?.({
	      releaseLeases: true,
	      reason: status
	    });
	    surfaceDraw?.surfaceVertices?.releaseSurfaceVertexBufferLeases?.({
	      status
	    });
	    surfaceDraw?.surfaceVertices?.destroySurfaceVertexBuffers?.({
	      releaseLeases: true,
	      reason: status
	    });
	  }

  function releasePreviousSphResidentSurfaceDrawResources(previousSurfaceDraw, previousRenderBridge) {
    if (!previousSurfaceDraw && !previousRenderBridge) return;
    if (previousRenderBridge && previousRenderBridge === sphResidentSurfaceDrawRenderBridge) {
      releaseSphResidentSurfaceDrawResources({
        surfaceDraw: previousSurfaceDraw,
        renderBridge: null,
        clearOverlay: false,
        status: 'surface-draw-metadata-swapped-engine-bridge-retained'
      });
      return;
    }
    if (
      previousSurfaceDraw === sphResidentSurfaceDraw
      && previousRenderBridge === sphResidentSurfaceDrawRenderBridge
    ) {
      return;
    }
    releaseSphResidentSurfaceDrawResources({
      surfaceDraw: previousSurfaceDraw,
      renderBridge: previousRenderBridge,
      clearOverlay: false,
      status: 'surface-draw-overlay-swapped-out'
    });
  }

  function hasVisibleResidentSurfaceDrawBridge(renderBridge = sphResidentSurfaceDrawRenderBridge) {
    return Boolean(
      renderBridge?.drawState
      || renderBridge?.renderRowDrawState
      || renderBridge?.threeSurfaceGroup
      || renderBridge?.threeMeshCount > 0
    );
  }

  function retainedPreviousSurfaceDrawOverlay(surfaceDraw, renderBridge, reason) {
    if (!surfaceDraw || !hasVisibleResidentSurfaceDrawBridge(renderBridge)) return surfaceDraw;
    return {
      ...surfaceDraw,
      visibleRendererBridge: renderBridge.rendererBridge || 'webgpu-storage-indirect-overlay',
      visibleRenderSource: 'retained-previous-resident-surface-draw-buffers',
      renderBridgeSchema: renderBridge.schema ?? surfaceDraw.renderBridgeSchema ?? null,
      renderBridgeStatus: 'retained-previous-webgpu-storage-indirect-overlay',
      renderBridgeReason: reason || surfaceDraw.reason || renderBridge.reason || null,
      renderBridgeFrameCount: renderBridge.frameCount ?? 0,
      renderBridgeLastRenderStatus: renderBridge.lastRenderStatus ?? null,
      renderBridgeDrawOrderingPolicy: renderBridge.drawOrderingPolicy ?? null,
      renderBridgeDrawOrderCount: renderBridge.drawOrderCount ?? 0,
      renderBridgeDrawOrderSurfaceIndices: [...(renderBridge.drawOrderSurfaceIndices || [])],
      renderBridgeDrawOrderIndirectOffsets: [...(renderBridge.drawOrderIndirectOffsets || [])],
      renderBridgeDepthPolicy: renderBridge.depthPolicy ?? null,
      renderBridgeDepthAttachmentFormat: renderBridge.depthAttachmentFormat ?? null,
      renderBridgeDepthAttachmentReady: Boolean(renderBridge.depthAttachmentReady),
      renderBridgeTransparencyCompositeMode: renderBridge.lastTransparentCompositeMode
        || renderBridge.transparencyCompositeMode
        || null,
      renderBridgeOitAccumFormat: renderBridge.oitAccumFormat ?? null,
      renderBridgeOitRevealFormat: renderBridge.oitRevealFormat ?? null,
      renderBridgeOitTargetsReady: Boolean(renderBridge.oitTargetsReady),
      renderBridgeLastOpaqueDrawCount: renderBridge.lastOpaqueDrawCount ?? 0,
      renderBridgeLastTransparentDrawCount: renderBridge.lastTransparentDrawCount ?? 0,
      renderBridgeOpticalRenderSource: renderBridge.opticalRenderSource ?? null,
      renderBridgeOpticalRecordCount: renderBridge.opticalRecordCount ?? 0,
      renderBridgeOpticalRecordStrideFloats: renderBridge.opticalRecordStrideFloats ?? 0,
      renderBridgeOpticalSpectralSampleCount: renderBridge.opticalSpectralSampleCount ?? 0,
      renderBridgeOpticalSpectralSampleStrideFloats: renderBridge.opticalSpectralSampleStrideFloats ?? 0,
      renderBridgeTemporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
      renderBridgeRetainedPreviousOverlay: true
    };
  }

  function markSphResidentSurfaceDrawOverlayRetained(reason) {
    if (hasVisibleResidentSurfaceDrawBridge(sphResidentSurfaceDrawRenderBridge)) {
      sphResidentSurfaceDrawRenderBridge.temporalSwapPolicy = SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY;
      sphResidentSurfaceDrawRenderBridge.retainedPreviousOverlay = true;
      sphResidentSurfaceDrawRenderBridge.retentionReason = reason;
      scene.userData.sphResidentSurfaceDrawRenderBridge = sphResidentSurfaceDrawRenderBridge;
    }
    if (sphResidentSurfaceDraw) {
      sphResidentSurfaceDraw = retainedPreviousSurfaceDrawOverlay(
        sphResidentSurfaceDraw,
        sphResidentSurfaceDrawRenderBridge,
        reason
      );
      scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
    }
  }

  function clearSphResidentSurfaceDrawArtifacts({ clearOverlay = true, removeCanvas = false } = {}) {
    releaseSphResidentSurfaceDrawResources({
      surfaceDraw: sphResidentSurfaceDraw,
      renderBridge: sphResidentSurfaceDrawRenderBridge,
      clearOverlay,
      removeCanvas,
      status: clearOverlay ? 'surface-draw-overlay-cleared' : 'surface-draw-overlay-resources-released'
    });
    sphResidentSurfaceDraw = null;
    scene.userData.sphResidentSurfaceDraw = null;
    if (removeCanvas) {
      sphResidentSurfaceDrawRenderBridge = null;
      scene.userData.sphResidentSurfaceDrawRenderBridge = null;
    }
  }

  function resetResidentStateForParticleReset({
    reason = 'particle-reset',
    clearOverlay = true
  } = {}) {
    clearMlsMpmResidentExecutionArtifacts();
    clearSphResidentSurfaceDrawArtifacts({ clearOverlay });
    publishSphResidentMaterialInterfaceState(null);
    publishSphResidentPressureInterfaceState(null);
    destroyPressureInterfaceForceRowsUpload();
    sphResidentRenderState = null;
    scene.userData.sphResidentRenderState = null;
    scene.userData.sphResidentReset = {
      schema: 'peercompute.ulg.sph-resident-reset.v0',
      status: 'resident-state-reset',
      reason,
      clearOverlay: Boolean(clearOverlay),
      updatedAtMs: nowMs(),
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    return scene.userData.sphResidentReset;
  }

  function clearSphResidentSurfaceDrawOverlayCanvas(bridge = sphResidentSurfaceDrawRenderBridge) {
    try {
      if (!bridge?.device || !bridge?.context) return;
      resizeSphResidentSurfaceDrawOverlayCanvas(bridge);
      const encoder = bridge.device.createCommandEncoder({ label: 'ulg-sph-resident-surface-draw-overlay-clear' });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: bridge.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.end();
      bridge.device.queue.submit([encoder.finish()]);
    } catch {
      // Clearing the optional overlay is best-effort; the WebGL fallback remains authoritative.
    }
  }

  function ensureSphResidentSurfaceDrawOverlayCanvas() {
    const existing = sphResidentSurfaceDrawRenderBridge?.canvas;
    if (existing) return existing;
    if (typeof container.ownerDocument?.createElement !== 'function') return null;
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2';
    canvas.style.background = 'transparent';
    container.appendChild(canvas);
    return canvas;
  }

  function resizeSphResidentSurfaceDrawOverlayCanvas(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.canvas) return;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(w * pixelRatio));
    const pixelHeight = Math.max(1, Math.floor(h * pixelRatio));
    if (bridge.canvas.width !== pixelWidth) bridge.canvas.width = pixelWidth;
    if (bridge.canvas.height !== pixelHeight) bridge.canvas.height = pixelHeight;
  }

  function ensureSphResidentSurfaceDrawDepthView(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.device || !bridge?.canvas) return null;
    const widthPx = bridge.canvas.width || 1;
    const heightPx = bridge.canvas.height || 1;
    if (
      bridge.depthTexture
      && bridge.depthTextureWidth === widthPx
      && bridge.depthTextureHeight === heightPx
    ) {
      return bridge.depthTexture.createView();
    }
    bridge.depthTexture?.destroy?.();
    bridge.depthTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-depth',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
    });
    bridge.depthTextureWidth = widthPx;
    bridge.depthTextureHeight = heightPx;
    bridge.depthAttachmentReady = true;
    return bridge.depthTexture.createView();
  }

  function ensureSphResidentSurfaceDrawOitTargets(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.device || !bridge?.canvas) return null;
    const widthPx = bridge.canvas.width || 1;
    const heightPx = bridge.canvas.height || 1;
    if (
      bridge.oitAccumTexture
      && bridge.oitRevealTexture
      && bridge.oitWidth === widthPx
      && bridge.oitHeight === heightPx
    ) {
      return {
        accumView: bridge.oitAccumTexture.createView(),
        revealView: bridge.oitRevealTexture.createView()
      };
    }
    bridge.oitAccumTexture?.destroy?.();
    bridge.oitRevealTexture?.destroy?.();
    bridge.oitAccumTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-oit-accum',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
    });
    bridge.oitRevealTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-oit-reveal',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
    });
    bridge.oitWidth = widthPx;
    bridge.oitHeight = heightPx;
    bridge.oitTargetsReady = true;
    return {
      accumView: bridge.oitAccumTexture.createView(),
      revealView: bridge.oitRevealTexture.createView()
    };
  }

  function createSphResidentSurfaceDrawThreeCompactBridge({
    surfaceDrawExecution,
    materialProperties = currentMaterialProperties
  } = {}) {
    const compactedRows = surfaceDrawExecution?.compactedVertexRows;
    const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
    const schema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
    const rendererBridge = 'three-compact-surface-geometry';
    if (!(compactedRows instanceof Float32Array) || compactedRows.length < rowStride) {
      return {
        schema,
        status: 'three-compact-surface-geometry-unavailable',
        reason: 'compact surface vertex readback rows are required for the Three bridge',
        rendererBridge,
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }

    const rowCount = Math.floor(compactedRows.length / rowStride);
    const activeRowsBySurface = new Map();
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const offset = rowIndex * rowStride;
      if (!(compactedRows[offset + SPH_SURFACE_VERTEX_ROW_INDEX.status] > 0)) continue;
      const surfaceIndex = Math.max(0, Math.round(Number(
        compactedRows[offset + SPH_SURFACE_VERTEX_ROW_INDEX.surfaceIndex]
      ) || 0));
      let rows = activeRowsBySurface.get(surfaceIndex);
      if (!rows) {
        rows = [];
        activeRowsBySurface.set(surfaceIndex, rows);
      }
      rows.push(rowIndex);
    }

    const sourceSurfaces = Array.isArray(surfaceDrawExecution?.surfaces)
      ? surfaceDrawExecution.surfaces
      : [];
    const surfaceRecords = sourceSurfaces.length
      ? sourceSurfaces
      : [...activeRowsBySurface.keys()].sort((a, b) => a - b).map((surfaceIndex) => ({ surfaceIndex }));
    const materialMap = buildSphRenderMaterialMap(materialProperties || {}, sphReactionTable);
    const group = new THREE.Group();
    group.name = 'ulg-sph-resident-surface-draw-three-compact';
    group.frustumCulled = false;
    const meshes = [];
    let totalVertexCount = 0;
    let totalTriangleCount = 0;
    let geometryByteLength = 0;

    for (let recordIndex = 0; recordIndex < surfaceRecords.length; recordIndex += 1) {
      const sourceSurface = surfaceRecords[recordIndex] || {};
      const surfaceIndex = Math.max(0, Math.round(Number(sourceSurface.surfaceIndex ?? recordIndex) || 0));
      const explicitVertexOffset = Number(sourceSurface.vertexOffset);
      const explicitVertexCount = Math.max(0, Math.round(Number(sourceSurface.vertexCount) || 0));
      const rowIndices = [];
      const hasExplicitVertexRange = sourceSurface.vertexOffset != null
        && Number.isFinite(explicitVertexOffset)
        && explicitVertexOffset >= 0
        && explicitVertexCount > 0;
      if (hasExplicitVertexRange) {
        const start = Math.max(0, Math.round(explicitVertexOffset));
        const end = Math.min(rowCount, start + explicitVertexCount);
        for (let rowIndex = start; rowIndex < end; rowIndex += 1) {
          const offset = rowIndex * rowStride;
          if (compactedRows[offset + SPH_SURFACE_VERTEX_ROW_INDEX.status] > 0) rowIndices.push(rowIndex);
        }
      } else {
        rowIndices.push(...(activeRowsBySurface.get(surfaceIndex) || []));
      }
      if (rowIndices.length < 3) continue;

      const alignedVertexCount = rowIndices.length - (rowIndices.length % 3);
      if (alignedVertexCount < 3) continue;
      const positions = new Float32Array(alignedVertexCount * 3);
      const normals = new Float32Array(alignedVertexCount * 3);
      let normalMagnitude = 0;
      for (let vertexIndex = 0; vertexIndex < alignedVertexCount; vertexIndex += 1) {
        const rowOffset = rowIndices[vertexIndex] * rowStride;
        const vectorOffset = vertexIndex * 3;
        positions[vectorOffset] = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.positionXM];
        positions[vectorOffset + 1] = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.positionYM];
        positions[vectorOffset + 2] = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.positionZM];
        const nx = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.normalX];
        const ny = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.normalY];
        const nz = compactedRows[rowOffset + SPH_SURFACE_VERTEX_ROW_INDEX.normalZ];
        normals[vectorOffset] = nx;
        normals[vectorOffset + 1] = ny;
        normals[vectorOffset + 2] = nz;
        normalMagnitude += Math.abs(nx) + Math.abs(ny) + Math.abs(nz);
      }

      const descriptor = renderDescriptorForSurfaceRecord(sourceSurface, surfaceIndex, {
        materialProperties,
        reactionTable: sphReactionTable,
        materialMap
      });
      const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setDrawRange(0, alignedVertexCount);
      if (!(normalMagnitude > 0)) geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const mesh = new THREE.Mesh(
        geometry,
        makeSurfaceMaterial(descriptor, properties)
      );
      mesh.name = `ulg-sph-three-compact-${descriptor.surfaceKey}`;
      mesh.frustumCulled = false;
      mesh.visible = true;
      mesh.userData.renderMode = 'resident-surface-draw-three-compact';
      mesh.userData.renderSource = 'resident-surface-draw-three-compact-vertices';
      mesh.userData.materialKey = descriptor.material;
      mesh.userData.renderKey = descriptor.renderKey;
      mesh.userData.phase = descriptor.phase;
      mesh.userData.materialId = Number.isFinite(Number(sourceSurface.materialId))
        ? Math.round(Number(sourceSurface.materialId))
        : null;
      mesh.userData.phaseId = Number.isFinite(Number(sourceSurface.phaseId))
        ? Math.round(Number(sourceSurface.phaseId))
        : null;
      mesh.userData.surfaceIndex = surfaceIndex;
      mesh.userData.surfaceDrawVertexOffset = hasExplicitVertexRange
        ? Math.max(0, Math.round(explicitVertexOffset))
        : null;
      mesh.userData.surfaceDrawVertexCount = alignedVertexCount;
      mesh.userData.surfaceDrawTriangleCount = alignedVertexCount / 3;
      mesh.userData.surfaceDrawSource = surfaceDrawExecution.schema ?? null;
      mesh.userData.optical = mesh.material.userData.optical;
      applySurfaceRenderOrdering(mesh, mesh.material.userData.optical, descriptor);
      group.add(mesh);
      meshes.push(mesh);
      totalVertexCount += alignedVertexCount;
      totalTriangleCount += alignedVertexCount / 3;
      geometryByteLength += positions.byteLength + normals.byteLength;
    }

    if (meshes.length > 0) {
      scene.add(group);
      suppressThreeSurfaceMeshesForResidentOverlay('resident-surface-draw-three-compact-active');
    }
    const status = meshes.length > 0
      ? SPH_THREE_COMPACT_VERTEX_BRIDGE_STATUS
      : 'three-compact-surface-geometry-empty';
    const bridge = {
      schema,
      status,
      rendererBridge,
      visibleRenderSource: meshes.length > 0
        ? 'resident-surface-draw-three-compact-vertices'
        : 'resident-surface-draw-three-compact-empty',
      reason: meshes.length > 0 ? null : 'compact surface vertex readback had no active triangle rows',
      overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
      threeSurfaceGroup: group,
      threeMeshes: meshes,
      threeMeshCount: meshes.length,
      threeGeometryByteLength: geometryByteLength,
      frameCount: 0,
      lastRenderStatus: meshes.length > 0 ? 'three-compact-surface-geometry-submitted' : 'three-compact-surface-geometry-empty',
      drawOrderingPolicy: 'three-scene-render-order-depth-policy',
      drawOrderCount: meshes.length,
      drawOrderSurfaceIndices: meshes.map((mesh) => mesh.userData.surfaceIndex),
      drawOrderIndirectOffsets: [],
      depthPolicy: 'three-managed-depth-buffer',
      depthAttachmentFormat: null,
      depthAttachmentReady: true,
      transparencyCompositeMode: 'three-material-depth-sort',
      oitAccumFormat: null,
      oitRevealFormat: null,
      oitTargetsReady: false,
      lastOpaqueDrawCount: meshes.filter((mesh) => mesh.material?.depthWrite).length,
      lastTransparentDrawCount: meshes.filter((mesh) => !mesh.material?.depthWrite).length,
      opticalRenderSource: 'closure-derived-three-materials',
      opticalRecordCount: opticalGpuTable?.recordCount ?? 0,
      opticalRecordStrideFloats: opticalGpuTable?.recordStrideFloats ?? 0,
      opticalSpectralSampleCount: opticalGpuTable?.spectralSampleCount ?? 0,
      opticalSpectralSampleStrideFloats: opticalGpuTable?.spectralSampleStrideFloats ?? 0,
      temporalSwapPolicy: null,
      retainedPreviousOverlay: false,
      vertexCount: totalVertexCount,
      triangleCount: totalTriangleCount,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
    if (meshes.length > 0) {
      sphResidentSurfaceDrawRenderBridge = bridge;
      scene.userData.sphResidentSurfaceDrawRenderBridge = bridge;
    }
    return bridge;
  }

  function createSphResidentRenderRowsThreePointBridge({
    decoded,
    renderRowsExecution,
    smoothingLengthM = null,
    bridgeMode = SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
  } = {}) {
    const positionsM = decoded?.positionsM;
    const colorsRgb = decoded?.colorsRgb;
    const schema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
    const requestedBridgeMode = String(bridgeMode || SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE).trim().toLowerCase();
    if (!(positionsM instanceof Float32Array) || positionsM.length < 3) {
      return {
        schema,
        status: 'three-render-row-points-unavailable',
        reason: 'full render-row positions are required for the Three point bridge',
        rendererBridge: requestedBridgeMode,
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    const pointCount = Math.floor(positionsM.length / 3);
    const requiredFloats = pointCount * 3;
    const smoothingLength = Number.isFinite(Number(smoothingLengthM)) && Number(smoothingLengthM) > 0
      ? Number(smoothingLengthM)
      : 0.08;
    const requestedSphereBridge = requestedBridgeMode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
      || requestedBridgeMode === 'three-spheres';
    const useSphereBridge = requestedSphereBridge && pointCount <= SPH_THREE_RENDER_ROW_SPHERES_MAX_INSTANCES;
    let rendererBridge = useSphereBridge
      ? SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
      : SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE;
    let bridgeStatus = useSphereBridge
      ? SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_STATUS
      : SPH_THREE_RENDER_ROW_POINTS_BRIDGE_STATUS;
    let visibleRenderSource = useSphereBridge
      ? 'resident-render-rows-three-instanced-spheres'
      : 'resident-render-rows-three-points';
    let renderObject = null;
    let renderReason = requestedSphereBridge && !useSphereBridge
      ? `sphere bridge skipped above ${SPH_THREE_RENDER_ROW_SPHERES_MAX_INSTANCES} render-row instances`
      : null;
    let geometryByteLength = positionsM.byteLength;
    let lastOpaqueDrawCount = 0;
    let lastTransparentDrawCount = 1;
    let transparencyCompositeMode = 'three-points-alpha-depth-sort';
    let drawOrderingPolicy = 'three-points-depth-policy';
    let group = null;
    let bridgeReused = false;
    let bridgeUpdateCount = 0;
    let threeMeshes = null;
    let bridgeMaterialKeys = [];
    let minParticleRadiusM = null;
    let maxParticleRadiusM = null;
    let sphereBridgeTransmissionProxyCount = 0;
    let sphereBridgeFallbackColorCount = 0;
    const previousBridge = sphResidentSurfaceDrawRenderBridge;

    if (useSphereBridge) {
      const fallbackSphereRadius = Math.max(0.025, Math.min(0.16, smoothingLength * 0.32));
      const rowData = Array.isArray(decoded?.rows) ? decoded.rows : [];
      const groupsBySurface = new Map();
      for (let index = 0; index < pointCount; index += 1) {
        const descriptor = renderDescriptorOf(decoded?.materials?.[index] || rowData[index] || null);
        let entry = groupsBySurface.get(descriptor.surfaceKey);
        if (!entry) {
          entry = { descriptor, indices: [] };
          groupsBySurface.set(descriptor.surfaceKey, entry);
        }
        entry.indices.push(index);
      }
      group = previousBridge?.rendererBridge === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
        ? previousBridge.threeSurfaceGroup || null
        : null;
      const previousMeshesBySurfaceKey = new Map();
      let reusedSphereMeshCount = 0;
      let createdSphereMeshCount = 0;
      let disposedSphereMeshCount = 0;
      const disposeSphereMaterial = (material) => {
        if (Array.isArray(material)) {
          for (const item of material) item?.dispose?.();
        } else {
          material?.dispose?.();
        }
      };
      const disposeSphereMesh = (mesh) => {
        if (!mesh) return;
        group?.remove(mesh);
        mesh.geometry?.dispose?.();
        disposeSphereMaterial(mesh.material);
        disposedSphereMeshCount += 1;
      };
      if (group) {
        for (const child of [...group.children]) {
          const key = child?.userData?.surfaceKey;
          if (key && child.isInstancedMesh) previousMeshesBySurfaceKey.set(key, child);
          else disposeSphereMesh(child);
        }
        bridgeReused = true;
        bridgeUpdateCount = Math.max(0, Math.round(Number(previousBridge.updateCount) || 0)) + 1;
      } else {
        group = new THREE.Group();
        group.name = 'ulg-sph-resident-render-row-three-spheres';
        group.frustumCulled = false;
        scene.add(group);
      }
      if (previousBridge?.threeSurfaceGroup && previousBridge.threeSurfaceGroup !== group) {
        previousBridge.threeSurfaceGroup.visible = false;
      }
      const temp = new THREE.Object3D();
      const meshes = [];
      let transparentGroups = 0;
      let opaqueGroups = 0;
      for (const entry of groupsBySurface.values()) {
        const { descriptor, indices } = entry;
        const surfaceKey = descriptor.surfaceKey || `${descriptor.material || 'unknown'}:${descriptor.phase || 'unknown'}:${descriptor.renderDomainKey || 'domain'}`;
        const properties = materialPropertiesForSurfaceDescriptor(descriptor, currentMaterialProperties);
        const cachedOptics = opticalParamsFromGpuTableRecord(opticalGpuTable, descriptor);
        const nextOptics = cachedOptics || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
        const nextMaterialSignature = opticalSignatureForMaterial(nextOptics);
        let mesh = previousMeshesBySurfaceKey.get(surfaceKey) || null;
        previousMeshesBySurfaceKey.delete(surfaceKey);
        const instanceCapacity = Math.max(0, Math.round(Number(mesh?.instanceMatrix?.count) || Number(mesh?.count) || 0));
        const canReuseMesh = Boolean(
          mesh?.isInstancedMesh
          && mesh.geometry
          && mesh.material
          && instanceCapacity >= indices.length
        );
        if (!canReuseMesh) {
          if (mesh) disposeSphereMesh(mesh);
          const sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
          const material = makeSurfaceMaterial(descriptor, properties, nextOptics);
          material.userData.renderRowSphereMaterialSignature = nextMaterialSignature;
          mesh = new THREE.InstancedMesh(sphereGeometry, material, indices.length);
          mesh.name = `ulg-sph-three-render-row-spheres-${surfaceKey}`;
          mesh.frustumCulled = false;
          group.add(mesh);
          createdSphereMeshCount += 1;
        } else {
          reusedSphereMeshCount += 1;
        }
        let material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const previousMaterialSignature = material?.userData?.renderRowSphereMaterialSignature
          || opticalSignatureForMaterial(material?.userData?.optical);
        if (previousMaterialSignature !== nextMaterialSignature) {
          const replacementMaterial = makeSurfaceMaterial(descriptor, properties, nextOptics);
          replacementMaterial.userData.renderRowSphereMaterialSignature = nextMaterialSignature;
          const oldMaterial = mesh.material;
          mesh.material = replacementMaterial;
          disposeSphereMaterial(oldMaterial);
          material = replacementMaterial;
        }
        const bridgeFallbackColorSrgb = averageRenderRowColorSrgb(colorsRgb, indices, descriptor);
        const emissive = decoded?.emissiveByMaterial?.[descriptor.material]
          ?? decoded?.emissiveByMaterial?.[descriptor.renderKey]
          ?? null;
        if (emissive && material.emissive) {
          material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
          material.emissiveIntensity = 1.8;
        }
        applySurfaceRenderOrdering(mesh, material.userData.optical, descriptor);
        stabilizeRenderRowSphereBridgeMaterial(material, {
          descriptor,
          fallbackColorSrgb: bridgeFallbackColorSrgb
        });
        mesh.count = indices.length;
        mesh.userData.renderMode = SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE;
        mesh.userData.renderSource = visibleRenderSource;
        mesh.userData.surfaceKey = surfaceKey;
        mesh.userData.pointCount = indices.length;
        mesh.userData.materialKey = descriptor.material;
        mesh.userData.renderKey = descriptor.renderKey;
        mesh.userData.phase = descriptor.phase;
        mesh.userData.optical = material.userData.optical;
        mesh.userData.opticalState = descriptor.opticalState || null;
        mesh.userData.opticalStateKey = descriptor.opticalStateKey || 'default';
        mesh.userData.renderDomainId = descriptor.renderDomainId;
        mesh.userData.renderDomainKey = descriptor.renderDomainKey;
        mesh.userData.renderRowSphereTransmissionProxy = Boolean(material.userData.renderRowSphereTransmissionProxy);
        mesh.userData.renderRowSphereFallbackColor = material.userData.renderRowSphereFallbackColor || null;
        if (material.userData.renderRowSphereTransmissionProxy) sphereBridgeTransmissionProxyCount += 1;
        if (material.userData.renderRowSphereFallbackColor) sphereBridgeFallbackColorCount += 1;
        let groupMinRadius = Number.POSITIVE_INFINITY;
        let groupMaxRadius = Number.NEGATIVE_INFINITY;
        for (let localIndex = 0; localIndex < indices.length; localIndex += 1) {
          const index = indices[localIndex];
          const offset = index * 3;
          const rowRadius = Number(rowData[index]?.particleRadiusM);
          const particleRadius = Number.isFinite(rowRadius) && rowRadius > 0
            ? rowRadius
            : fallbackSphereRadius;
          groupMinRadius = Math.min(groupMinRadius, particleRadius);
          groupMaxRadius = Math.max(groupMaxRadius, particleRadius);
          minParticleRadiusM = minParticleRadiusM == null
            ? particleRadius
            : Math.min(minParticleRadiusM, particleRadius);
          maxParticleRadiusM = maxParticleRadiusM == null
            ? particleRadius
            : Math.max(maxParticleRadiusM, particleRadius);
          temp.position.set(positionsM[offset], positionsM[offset + 1], positionsM[offset + 2]);
          temp.scale.setScalar(particleRadius);
          temp.updateMatrix();
          mesh.setMatrixAt(localIndex, temp.matrix);
        }
        temp.scale.setScalar(1);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.sphereRadiusM = Number.isFinite(groupMaxRadius) ? groupMaxRadius : fallbackSphereRadius;
        mesh.userData.minParticleRadiusM = Number.isFinite(groupMinRadius) ? groupMinRadius : fallbackSphereRadius;
        mesh.userData.maxParticleRadiusM = Number.isFinite(groupMaxRadius) ? groupMaxRadius : fallbackSphereRadius;
        mesh.computeBoundingSphere?.();
        meshes.push(mesh);
        bridgeMaterialKeys.push(descriptor.material || descriptor.renderKey || 'unknown');
        geometryByteLength += (
          mesh.geometry?.attributes?.position?.array?.byteLength || 0
        ) + indices.length * 16 * Float32Array.BYTES_PER_ELEMENT;
        if (material.transparent || material.depthWrite === false) transparentGroups += 1;
        else opaqueGroups += 1;
      }
      for (const staleMesh of previousMeshesBySurfaceKey.values()) disposeSphereMesh(staleMesh);
      threeMeshes = meshes;
      renderObject = meshes[0] || null;
      lastOpaqueDrawCount = opaqueGroups;
      lastTransparentDrawCount = transparentGroups;
      transparencyCompositeMode = 'three-instanced-spheres-material-pbr-depth-buffer';
      drawOrderingPolicy = 'three-instanced-spheres-material-pbr-depth-policy';
      group.userData.sphereBridgeTransmissionProxyCount = sphereBridgeTransmissionProxyCount;
      group.userData.sphereBridgeFallbackColorCount = sphereBridgeFallbackColorCount;
      group.userData.sphereBridgeReusedMeshCount = reusedSphereMeshCount;
      group.userData.sphereBridgeCreatedMeshCount = createdSphereMeshCount;
      group.userData.sphereBridgeDisposedMeshCount = disposedSphereMeshCount;
    } else {
      let positions = null;
      let colors = null;
      let geometry = null;
      let points = null;
      const previousPoints = previousBridge?.rendererBridge === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
        ? previousBridge?.threeMeshes?.[0]
        : null;
      const previousGeometry = previousPoints?.geometry || null;
      const previousPosition = previousGeometry?.getAttribute?.('position') || null;
      const previousColor = previousGeometry?.getAttribute?.('color') || null;
      if (
        previousPoints?.isPoints
        && previousPosition?.array instanceof Float32Array
        && previousColor?.array instanceof Float32Array
        && previousPosition.array.length >= requiredFloats
        && previousColor.array.length >= requiredFloats
      ) {
        points = previousPoints;
        geometry = previousGeometry;
        positions = previousPosition.array;
        colors = previousColor.array;
        group = previousBridge.threeSurfaceGroup || null;
        bridgeReused = true;
        bridgeUpdateCount = Math.max(0, Math.round(Number(previousBridge.updateCount) || 0)) + 1;
      } else {
        positions = new Float32Array(requiredFloats);
        colors = new Float32Array(requiredFloats);
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      positions.set(positionsM.subarray(0, requiredFloats), 0);
      if (positions.length > requiredFloats) positions.fill(0, requiredFloats);
      if (colorsRgb instanceof Float32Array && colorsRgb.length >= requiredFloats) {
        colors.set(colorsRgb.subarray(0, requiredFloats), 0);
      } else {
        for (let index = 0; index < pointCount; index += 1) {
          const offset = index * 3;
          colors[offset] = 0.25;
          colors[offset + 1] = 0.55;
          colors[offset + 2] = 1.0;
        }
      }
      if (colors.length > requiredFloats) colors.fill(0, requiredFloats);
      geometryByteLength += colors.byteLength;
      const positionAttribute = geometry.getAttribute('position');
      const colorAttribute = geometry.getAttribute('color');
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      geometry.setDrawRange(0, pointCount);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (!points) {
        const pointSize = Math.max(0.025, Math.min(0.18, smoothingLength * 0.45));
        const material = new THREE.PointsMaterial({
          size: pointSize,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          depthTest: true
        });
        material.userData.optical = {
          alpha: material.opacity,
          transparencyClassId: 1,
          depthWriteFlag: 0
        };
        points = new THREE.Points(geometry, material);
        points.name = 'ulg-sph-three-render-row-points';
        points.frustumCulled = false;
        points.renderOrder = 1200;
      }
      points.userData.renderMode = SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE;
      points.userData.renderSource = visibleRenderSource;
      points.userData.pointCount = pointCount;
      renderObject = points;
      threeMeshes = [points];
    }
    if (!group) {
      group = new THREE.Group();
      group.name = useSphereBridge
        ? 'ulg-sph-resident-render-row-three-spheres'
        : 'ulg-sph-resident-render-row-three-points';
      group.frustumCulled = false;
      if (renderObject) group.add(renderObject);
      scene.add(group);
    } else if (renderObject && renderObject.parent !== group) {
      group.add(renderObject);
    }
    group.visible = true;
    suppressThreeSurfaceMeshesForResidentOverlay('resident-render-row-three-points-active');
    const bridge = bridgeReused && previousBridge ? previousBridge : {};
    Object.assign(bridge, {
      schema,
      status: bridgeStatus,
      rendererBridge,
      visibleRenderSource,
      reason: renderReason,
      overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
      threeSurfaceGroup: group,
      threeMeshes: threeMeshes || (renderObject ? [renderObject] : []),
      threeMeshCount: (threeMeshes || (renderObject ? [renderObject] : [])).length,
      threeGeometryByteLength: geometryByteLength,
      frameCount: 0,
      lastRenderStatus: useSphereBridge
        ? 'three-render-row-spheres-submitted'
        : 'three-render-row-points-submitted',
      drawOrderingPolicy,
      drawOrderCount: Math.max(1, (threeMeshes || []).length),
      drawOrderSurfaceIndices: [],
      drawOrderIndirectOffsets: [],
      depthPolicy: 'three-managed-depth-buffer',
      depthAttachmentFormat: null,
      depthAttachmentReady: true,
      transparencyCompositeMode,
      oitAccumFormat: null,
      oitRevealFormat: null,
      oitTargetsReady: false,
      lastOpaqueDrawCount,
      lastTransparentDrawCount,
      opticalRenderSource: useSphereBridge ? 'render-row-material-pbr' : 'render-row-vertex-colors',
      opticalRecordCount: opticalGpuTable?.recordCount ?? 0,
      opticalRecordStrideFloats: opticalGpuTable?.recordStrideFloats ?? 0,
      opticalSpectralSampleCount: opticalGpuTable?.spectralSampleCount ?? 0,
      opticalSpectralSampleStrideFloats: opticalGpuTable?.spectralSampleStrideFloats ?? 0,
      temporalSwapPolicy: null,
      retainedPreviousOverlay: false,
      vertexCount: pointCount,
      triangleCount: 0,
      pointCount,
      sphereBridgeRequested: requestedSphereBridge,
      sphereBridgeUsed: useSphereBridge,
      sphereBridgeMaxInstances: SPH_THREE_RENDER_ROW_SPHERES_MAX_INSTANCES,
      sphereBridgeMaterialKeys: bridgeMaterialKeys,
      sphereBridgeTransmissionProxyCount,
      sphereBridgeFallbackColorCount,
      sphereBridgeReusedMeshCount: useSphereBridge
        ? (group?.userData?.sphereBridgeReusedMeshCount ?? 0)
        : 0,
      sphereBridgeCreatedMeshCount: useSphereBridge
        ? (group?.userData?.sphereBridgeCreatedMeshCount ?? 0)
        : 0,
      sphereBridgeDisposedMeshCount: useSphereBridge
        ? (group?.userData?.sphereBridgeDisposedMeshCount ?? 0)
        : 0,
      minParticleRadiusM,
      maxParticleRadiusM,
      renderRowsReadback: Boolean(renderRowsExecution?.renderRowsReadback),
      engineIntegration: 'three-renderer-owned-scene-object',
      threeRenderBridgeReused: bridgeReused,
      updateCount: bridgeUpdateCount,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    });
    sphResidentSurfaceDrawRenderBridge = bridge;
    scene.userData.sphResidentSurfaceDrawRenderBridge = bridge;
    return bridge;
  }

  function createSphResidentRenderRowsWebGpuOverlayBridge({
    device,
    renderRowsExecution,
    smoothingLengthM = null,
    bridgeMode = SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
  } = {}) {
    const schema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
    const requestedBridgeMode = String(bridgeMode || SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE).trim().toLowerCase();
    const requestedSphereBridge = requestedBridgeMode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
      || requestedBridgeMode === 'webgpu-spheres';
    const rendererBridge = requestedSphereBridge
      ? SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
      : SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE;
    const bridgeStatus = requestedSphereBridge
      ? SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_STATUS
      : SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_STATUS;
    const visibleRenderSource = requestedSphereBridge
      ? 'resident-render-rows-webgpu-instanced-spheres'
      : 'resident-render-rows-webgpu-points';
    const particleCount = Math.max(0, Math.round(Number(renderRowsExecution?.particleCount) || 0));
    const renderRowsBuffer = renderRowsExecution?.renderRowsBuffer || null;
    if (!device?.createRenderPipeline || !device.queue?.writeBuffer || !renderRowsBuffer || particleCount <= 0) {
      return {
        schema,
        status: 'webgpu-render-row-overlay-unavailable',
        reason: 'retained GPU render-row buffer is required for the WebGPU render-row overlay',
        rendererBridge,
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    try {
      const gpu = navigatorRef?.gpu || globalThis.navigator?.gpu;
      const canvas = ensureSphResidentSurfaceDrawOverlayCanvas();
      const context = canvas?.getContext?.('webgpu');
      if (!canvas || !context || !gpu?.getPreferredCanvasFormat) {
        return {
          schema,
          status: 'webgpu-render-row-overlay-unavailable',
          reason: 'WebGPU canvas context unavailable',
          rendererBridge,
          visibleRenderSource: 'three-marching-cubes-fallback',
          overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
      }
      const format = gpu.getPreferredCanvasFormat();
      resizeSphResidentSurfaceDrawOverlayCanvas({ canvas });
      context.configure({
        device,
        format,
        usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
        alphaMode: 'opaque'
      });
      const module = device.createShaderModule({
        label: 'ulg-sph-resident-render-row-overlay',
        code: SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL
      });
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'ulg-sph-resident-render-row-overlay-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 1,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'uniform' }
          }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({
        label: 'ulg-sph-resident-render-row-overlay-pipeline-layout',
        bindGroupLayouts: [bindGroupLayout]
      });
      const pipeline = device.createRenderPipeline({
        label: 'ulg-sph-resident-render-row-overlay-pipeline',
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vs_main'
        },
        fragment: {
          module,
          entryPoint: 'fs_main',
          targets: [{
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        }
      });
      const cameraBuffer = device.createBuffer({
        label: 'ulg-sph-resident-render-row-overlay-camera',
        size: SPH_RENDER_ROW_WEBGPU_OVERLAY_CAMERA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      const bindGroup = device.createBindGroup({
        label: 'ulg-sph-resident-render-row-overlay-bind-group',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: renderRowsBuffer } },
          { binding: 1, resource: { buffer: cameraBuffer } }
        ]
      });
      const smoothingLength = Number.isFinite(Number(smoothingLengthM)) && Number(smoothingLengthM) > 0
        ? Number(smoothingLengthM)
        : 0.08;
      const radiusPx = requestedSphereBridge
        ? Math.max(8, Math.min(22, smoothingLength * 128))
        : Math.max(6, Math.min(16, smoothingLength * 96));
      const bridge = {
        schema,
        status: bridgeStatus,
        rendererBridge,
        visibleRenderSource,
        reason: null,
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        canvas,
        context,
        device,
        format,
        pipeline,
        cameraBuffer,
        renderRowsBuffer,
        renderRowsBufferOwned: Boolean(renderRowsExecution?.renderRowsBufferOwned),
        renderRowDrawState: {
          bindGroup,
          particleCount,
          radiusPx,
          requestedSphereBridge,
          mode: rendererBridge,
          renderRowsBuffer,
          renderRowsBufferByteLength: renderRowsExecution?.renderRowsBufferByteLength ?? 0,
          readbackMode: renderRowsExecution?.readbackMode ?? null,
          renderRowsReadback: Boolean(renderRowsExecution?.renderRowsReadback)
        },
        drawOrderingPolicy: 'webgpu-instanced-render-row-submission',
        drawOrderCount: 1,
        drawOrderSurfaceIndices: [],
        drawOrderIndirectOffsets: [],
        depthPolicy: 'opaque-canvas-overlay-no-three-depth-sharing',
        depthAttachmentFormat: null,
        depthAttachmentReady: false,
        transparencyCompositeMode: 'opaque-canvas-alpha-quads',
        oitAccumFormat: null,
        oitRevealFormat: null,
        oitTargetsReady: false,
        lastOpaqueDrawCount: 0,
        lastTransparentDrawCount: particleCount,
        opticalRenderSource: 'render-row-material-phase-fallback',
        opticalRecordCount: 0,
        opticalRecordStrideFloats: 0,
        opticalSpectralSampleCount: 0,
        opticalSpectralSampleStrideFloats: 0,
        temporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
        retainedPreviousOverlay: false,
        frameCount: 0,
        lastRenderStatus: 'webgpu-render-row-overlay-pending',
        vertexCount: particleCount * 6,
        triangleCount: particleCount * 2,
        pointCount: particleCount,
        sphereBridgeRequested: requestedSphereBridge,
        sphereBridgeUsed: requestedSphereBridge,
        renderRowsReadback: Boolean(renderRowsExecution?.renderRowsReadback),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
      sphResidentSurfaceDrawRenderBridge = bridge;
      scene.userData.sphResidentSurfaceDrawRenderBridge = bridge;
      suppressThreeSurfaceMeshesForResidentOverlay('resident-render-row-webgpu-overlay-active');
      return bridge;
    } catch (error) {
      return {
        schema,
        status: 'webgpu-render-row-overlay-error',
        reason: error instanceof Error ? error.message : String(error),
        rendererBridge,
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
  }

  function summarizeThreeCompactSurfaceVertexRows(compactedRows, surfaces = []) {
    const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
    const rowCount = compactedRows instanceof Float32Array
      ? Math.floor(compactedRows.length / rowStride)
      : 0;
    const countsBySurface = new Map();
    let vertexCount = 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const offset = rowIndex * rowStride;
      if (!(compactedRows[offset + SPH_SURFACE_VERTEX_ROW_INDEX.status] > 0)) continue;
      const surfaceIndex = Math.max(0, Math.round(Number(
        compactedRows[offset + SPH_SURFACE_VERTEX_ROW_INDEX.surfaceIndex]
      ) || 0));
      countsBySurface.set(surfaceIndex, (countsBySurface.get(surfaceIndex) || 0) + 1);
      vertexCount += 1;
    }
    const sourceSurfaces = Array.isArray(surfaces) ? surfaces : [];
    const surfaceRecords = sourceSurfaces.length
      ? sourceSurfaces.map((surface, index) => {
        const surfaceIndex = Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0));
        const surfaceVertexCount = countsBySurface.get(surfaceIndex) || 0;
        return {
          ...surface,
          surfaceIndex,
          vertexOffset: null,
          vertexCount: surfaceVertexCount,
          triangleOffset: null,
          triangleCount: Math.floor(surfaceVertexCount / 3),
          status: surfaceVertexCount > 0 ? 'surface-draw-ready' : 'surface-draw-empty'
        };
      })
      : [...countsBySurface.entries()]
        .sort(([a], [b]) => a - b)
        .map(([surfaceIndex, surfaceVertexCount]) => ({
          surfaceIndex,
          vertexOffset: null,
          vertexCount: surfaceVertexCount,
          triangleOffset: null,
          triangleCount: Math.floor(surfaceVertexCount / 3),
          status: surfaceVertexCount > 0 ? 'surface-draw-ready' : 'surface-draw-empty'
        }));
    return {
      surfaceRecords,
      activeSurfaceCount: [...countsBySurface.values()].filter((count) => count > 0).length,
      vertexCount,
      triangleCount: Math.floor(vertexCount / 3)
    };
  }

  function createSphSurfaceDrawExecutionFromSurfaceVertices(surfaceVerticesExecution) {
    const compactedVertexRows = surfaceVerticesExecution?.vertexRows instanceof Float32Array
      ? surfaceVerticesExecution.vertexRows
      : new Float32Array();
    const summary = summarizeThreeCompactSurfaceVertexRows(
      compactedVertexRows,
      surfaceVerticesExecution?.surfaces || []
    );
    const sourceVertexRowCount = Math.floor(
      compactedVertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    );
    return {
      schema: 'peercompute.ulg.sph-gpu-render-surface-draw.v0',
      backend: 'webgpu-surface-vertex-readback-bridge',
      status: summary.vertexCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty',
      reason: 'Three compact bridge skips serial surface-draw metadata shader and uses surface vertex rows directly',
      sourceSurfaceVertexSchema: surfaceVerticesExecution?.schema ?? null,
      sourceSurfaceVertexBackend: surfaceVerticesExecution?.backend ?? null,
      surfaceCount: surfaceVerticesExecution?.surfaceCount ?? summary.surfaceRecords.length,
      activeSurfaceCount: summary.activeSurfaceCount,
      vertexCount: summary.vertexCount,
      triangleCount: summary.triangleCount,
      sourceVertexRowCount,
      compactedVertexRows,
      surfaces: summary.surfaceRecords,
      drawRows: new Float32Array(),
      drawIndirectRows: new Uint32Array(),
      drawRowsBufferRetained: false,
      drawRowsBufferByteLength: 0,
      drawIndirectSchema: null,
      drawIndirectRowStrideUints: 0,
      drawIndirectRowsBufferRetained: false,
      drawIndirectRowsBufferByteLength: 0,
      compactedVertexRowsBufferRetained: false,
      compactedVertexRowsBufferByteLength: 0,
      residentBufferLeaseLedgerStatus: null,
      residentBufferLeaseResourceCount: 0,
      residentBufferLeaseActiveLeaseCount: 0,
      residentBufferLeaseSummary: null,
      readbackMode: RESIDENT_FULL_READBACK_MODE,
      surfaceDrawReadback: true,
      surfaceDrawSummaryReadback: false,
      surfaceDrawSummaryReadbackByteLength: 0,
      fullSurfaceDrawReadback: false,
      compactionMode: 'surface-vertex-readback-cpu-compact',
      queueCompletionStatus: surfaceVerticesExecution?.queueCompletionStatus ?? null,
      queueCompletionMethod: surfaceVerticesExecution?.queueCompletionMethod ?? null,
      releaseSurfaceDrawBufferLeases() {},
      destroySurfaceDrawBuffers() {}
    };
  }

  function createSphResidentSurfaceDrawRenderBridge({
    device,
    surfaceDrawExecution
  } = {}) {
    const overlayPolicy = resolveSceneResidentSurfaceDrawOverlayPolicy({ refresh: true });
    if (!overlayPolicy.enabled) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: overlayPolicy.status,
        reason: overlayPolicy.reason,
        rendererBridge: 'pending-three-webgpu-binding',
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    try {
      const gpu = navigatorRef?.gpu || globalThis.navigator?.gpu;
      if (!device?.createRenderPipeline || !surfaceDrawExecution?.compactedVertexRowsBuffer || !surfaceDrawExecution?.drawIndirectRowsBuffer) {
        return { status: 'surface-draw-overlay-unavailable', reason: 'retained compact vertex and indirect buffers are required' };
      }
      const canvas = ensureSphResidentSurfaceDrawOverlayCanvas();
      const context = canvas?.getContext?.('webgpu');
      if (!canvas || !context || !gpu?.getPreferredCanvasFormat) {
        return { status: 'surface-draw-overlay-unavailable', reason: 'WebGPU canvas context unavailable' };
      }
      const format = gpu.getPreferredCanvasFormat();
      resizeSphResidentSurfaceDrawOverlayCanvas({ canvas });
      context.configure({
        device,
        format,
        usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
        alphaMode: 'premultiplied'
      });
      const module = device.createShaderModule({
        label: 'ulg-sph-resident-surface-draw-overlay',
        code: SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
      });
      const oitCompositeModule = device.createShaderModule({
        label: 'ulg-sph-resident-surface-draw-oit-composite',
        code: SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL
      });
      const bridgeOpticalGpuTable = opticalGpuTable?.recordCount > 0
        ? opticalGpuTable
        : buildOpticalGpuTable([{ material: 'unknown', phase: 'unknown' }], {
            materialProperties: currentMaterialProperties || {}
          });
      const opticalGpuBuffers = uploadOpticalGpuTable(device, bridgeOpticalGpuTable);
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'ulg-sph-resident-surface-draw-overlay-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 1,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'uniform' }
          },
          {
            binding: 2,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 3,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            buffer: { type: 'read-only-storage' }
          }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({
        label: 'ulg-sph-resident-surface-draw-overlay-pipeline-layout',
        bindGroupLayouts: [bindGroupLayout]
      });
      const createOverlayPipeline = ({
        label,
        depthWriteEnabled,
        fragmentEntryPoint = 'fs_main',
        targets = [{
          format,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      }) => device.createRenderPipeline({
        label,
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vs_main'
        },
        fragment: {
          module,
          entryPoint: fragmentEntryPoint,
          targets
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        },
        depthStencil: {
          format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
          depthWriteEnabled,
          depthCompare: 'less-equal'
        }
      });
      const opaquePipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-opaque-depth',
        depthWriteEnabled: true
      });
      const transparentPipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-transparent-depth-test',
        depthWriteEnabled: false
      });
      const transparentOitPipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-transparent-oit',
        depthWriteEnabled: false,
        fragmentEntryPoint: 'fs_oit_main',
        targets: [
          {
            format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
            }
          },
          {
            format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
            blend: {
              color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }
        ]
      });
      const oitCompositeBindGroupLayout = device.createBindGroupLayout({
        label: 'ulg-sph-resident-surface-draw-oit-composite-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            texture: { sampleType: 'float' }
          },
          {
            binding: 1,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            texture: { sampleType: 'float' }
          },
          {
            binding: 2,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            sampler: { type: 'filtering' }
          }
        ]
      });
      const oitCompositePipelineLayout = device.createPipelineLayout({
        label: 'ulg-sph-resident-surface-draw-oit-composite-pipeline-layout',
        bindGroupLayouts: [oitCompositeBindGroupLayout]
      });
      const oitCompositePipeline = device.createRenderPipeline({
        label: 'ulg-sph-resident-surface-draw-oit-composite-pipeline',
        layout: oitCompositePipelineLayout,
        vertex: {
          module: oitCompositeModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: oitCompositeModule,
          entryPoint: 'fs_main',
          targets: [{
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        }
      });
      const oitSampler = device.createSampler({
        label: 'ulg-sph-resident-surface-draw-oit-sampler',
        magFilter: 'linear',
        minFilter: 'linear'
      });
      const cameraBuffer = device.createBuffer({
        label: 'ulg-sph-resident-surface-draw-camera',
        size: 16 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      const bindGroup = device.createBindGroup({
        label: 'ulg-sph-resident-surface-draw-overlay-bind-group',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: surfaceDrawExecution.compactedVertexRowsBuffer } },
          { binding: 1, resource: { buffer: cameraBuffer } },
          { binding: 2, resource: { buffer: opticalGpuBuffers.recordsBuffer } },
          { binding: 3, resource: { buffer: opticalGpuBuffers.spectralSamplesBuffer } }
        ]
      });
      const indirectStrideBytes = 4 * Uint32Array.BYTES_PER_ELEMENT;
      const drawOrder = residentSurfaceDrawOrder(surfaceDrawExecution.surfaces || [], {
        indirectStrideBytes
      });
      const bridge = {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: 'webgpu-storage-indirect-overlay-ready',
        rendererBridge: 'webgpu-storage-indirect-overlay',
        visibleRenderSource: 'resident-surface-draw-buffers',
        overlayPolicy,
        canvas,
        context,
        device,
        format,
        pipeline: transparentPipeline,
        opaquePipeline,
        transparentPipeline,
        transparentOitPipeline,
        oitCompositePipeline,
        oitCompositeBindGroupLayout,
        oitSampler,
        cameraBuffer,
        drawState: {
          bindGroup,
          drawIndirectRowsBuffer: surfaceDrawExecution.drawIndirectRowsBuffer,
          surfaceCount: surfaceDrawExecution.surfaceCount,
          sourceSurfaceCount: surfaceDrawExecution.surfaceCount,
          drawOrder,
          drawOrderSurfaceIndices: drawOrder.map((row) => row.surfaceIndex),
          drawOrderIndirectOffsets: drawOrder.map((row) => row.indirectOffsetBytes),
          drawOrderingPolicy: 'resident-surface-render-order-depth-policy',
          depthPolicy: 'opaque-depth-write-transparent-depth-test',
          depthAttachmentFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
          transparencyCompositeMode: 'weighted-blended-oit',
          oitAccumFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
          oitRevealFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
          opticalRenderSource: 'closure-derived-optical-gpu-table',
          opticalRecordCount: bridgeOpticalGpuTable.recordCount,
          opticalRecordStrideFloats: bridgeOpticalGpuTable.recordStrideFloats,
          opticalSpectralSampleCount: bridgeOpticalGpuTable.spectralSampleCount,
          opticalSpectralSampleStrideFloats: bridgeOpticalGpuTable.spectralSampleStrideFloats,
          temporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
          indirectStrideBytes
        },
        drawOrderingPolicy: 'resident-surface-render-order-depth-policy',
        drawOrderSurfaceIndices: drawOrder.map((row) => row.surfaceIndex),
        drawOrderIndirectOffsets: drawOrder.map((row) => row.indirectOffsetBytes),
        drawOrderCount: drawOrder.length,
        depthPolicy: 'opaque-depth-write-transparent-depth-test',
        depthAttachmentFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        depthAttachmentReady: false,
        transparencyCompositeMode: 'weighted-blended-oit',
        oitAccumFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
        oitRevealFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
        oitTargetsReady: false,
        opticalGpuBuffers,
        opticalRenderSource: 'closure-derived-optical-gpu-table',
        opticalRecordCount: bridgeOpticalGpuTable.recordCount,
        opticalRecordStrideFloats: bridgeOpticalGpuTable.recordStrideFloats,
        opticalSpectralSampleCount: bridgeOpticalGpuTable.spectralSampleCount,
        opticalSpectralSampleStrideFloats: bridgeOpticalGpuTable.spectralSampleStrideFloats,
        temporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
        retainedPreviousOverlay: false,
        frameCount: 0,
        lastRenderStatus: 'pending',
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
      sphResidentSurfaceDrawRenderBridge = bridge;
      scene.userData.sphResidentSurfaceDrawRenderBridge = bridge;
      return bridge;
    } catch (error) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: 'surface-draw-overlay-error',
        reason: error instanceof Error ? error.message : String(error),
        rendererBridge: 'pending-three-webgpu-binding',
        visibleRenderSource: 'three-marching-cubes-fallback',
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
  }

  function renderSphResidentSurfaceDrawOverlay() {
    const bridge = sphResidentSurfaceDrawRenderBridge;
    const rowDrawState = bridge?.renderRowDrawState;
    if (bridge?.device && bridge?.context && rowDrawState?.bindGroup && rowDrawState?.particleCount > 0) {
      try {
        resizeSphResidentSurfaceDrawOverlayCanvas(bridge);
        camera.updateMatrixWorld?.();
        camera.matrixWorldInverse?.copy?.(camera.matrixWorld)?.invert?.();
        const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const cameraPayload = new Float32Array(SPH_RENDER_ROW_WEBGPU_OVERLAY_CAMERA_FLOATS);
        cameraPayload.set(viewProjection.elements, 0);
        cameraPayload[16] = bridge.canvas?.width || 1;
        cameraPayload[17] = bridge.canvas?.height || 1;
        cameraPayload[18] = Number.isFinite(Number(rowDrawState.radiusPx)) && Number(rowDrawState.radiusPx) > 0
          ? Number(rowDrawState.radiusPx)
          : 4;
        cameraPayload[19] = rowDrawState.mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE ? 1 : 0;
        bridge.device.queue.writeBuffer(bridge.cameraBuffer, 0, cameraPayload);
        const encoder = bridge.device.createCommandEncoder({ label: 'ulg-sph-resident-render-row-overlay' });
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: bridge.context.getCurrentTexture().createView(),
            clearValue: { r: 0.094, g: 0.133, b: 0.169, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
        pass.setPipeline(bridge.pipeline);
        pass.setBindGroup(0, rowDrawState.bindGroup);
        pass.draw(6, rowDrawState.particleCount);
        pass.end();
        bridge.device.queue.submit([encoder.finish()]);
        bridge.frameCount += 1;
        bridge.lastRenderStatus = rowDrawState.mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
          ? 'webgpu-render-row-spheres-rendered'
          : 'webgpu-render-row-points-rendered';
        bridge.lastOpaqueDrawCount = 0;
        bridge.lastTransparentDrawCount = rowDrawState.particleCount;
        bridge.lastTransparentCompositeMode = 'opaque-canvas-alpha-quads';
        if (sphResidentSurfaceDraw) {
          sphResidentSurfaceDraw.renderBridgeFrameCount = bridge.frameCount;
          sphResidentSurfaceDraw.renderBridgeLastRenderStatus = bridge.lastRenderStatus;
          sphResidentSurfaceDraw.renderBridgeDepthAttachmentReady = false;
          sphResidentSurfaceDraw.renderBridgeDepthPolicy = bridge.depthPolicy ?? null;
          sphResidentSurfaceDraw.renderBridgeDepthAttachmentFormat = null;
          sphResidentSurfaceDraw.renderBridgeOitTargetsReady = false;
          sphResidentSurfaceDraw.renderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
          sphResidentSurfaceDraw.renderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
          sphResidentSurfaceDraw.renderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
          sphResidentSurfaceDraw.renderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
          sphResidentSurfaceDraw.renderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
        }
        if (sphResidentRenderState) {
          sphResidentRenderState.surfaceDrawRenderBridgeFrameCount = bridge.frameCount;
          sphResidentRenderState.surfaceDrawRenderBridgeLastRenderStatus = bridge.lastRenderStatus;
          sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentReady = false;
          sphResidentRenderState.surfaceDrawRenderBridgeDepthPolicy = bridge.depthPolicy ?? null;
          sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentFormat = null;
          sphResidentRenderState.surfaceDrawRenderBridgeOitTargetsReady = false;
          sphResidentRenderState.surfaceDrawRenderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
          sphResidentRenderState.surfaceDrawRenderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
          sphResidentRenderState.surfaceDrawRenderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
          sphResidentRenderState.surfaceDrawRenderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
          sphResidentRenderState.surfaceDrawRenderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
        }
      } catch (error) {
        bridge.lastRenderStatus = 'webgpu-render-row-overlay-render-error';
        bridge.reason = error instanceof Error ? error.message : String(error);
      }
      return;
    }
    const drawState = bridge?.drawState;
    if (!bridge?.device || !bridge?.context || !drawState?.bindGroup || !drawState?.drawIndirectRowsBuffer) return;
    try {
      resizeSphResidentSurfaceDrawOverlayCanvas(bridge);
      const depthView = ensureSphResidentSurfaceDrawDepthView(bridge);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      bridge.device.queue.writeBuffer(bridge.cameraBuffer, 0, new Float32Array(viewProjection.elements));
      const encoder = bridge.device.createCommandEncoder({ label: 'ulg-sph-resident-surface-draw-overlay' });
      const canvasView = bridge.context.getCurrentTexture().createView();
      const drawOrder = Array.isArray(drawState.drawOrder) && drawState.drawOrder.length
        ? drawState.drawOrder
        : residentSurfaceDrawOrder(
          Array.from({ length: drawState.surfaceCount }, (_, surfaceIndex) => ({ surfaceIndex })),
          { indirectStrideBytes: drawState.indirectStrideBytes }
        );
      const opaqueDraws = drawOrder.filter((draw) => residentSurfaceDrawPipelineKey(draw) === 'opaque-depth-write');
      const transparentDraws = drawOrder.filter((draw) => residentSurfaceDrawPipelineKey(draw) !== 'opaque-depth-write');
      const opaquePass = encoder.beginRenderPass({
        colorAttachments: [{
          view: canvasView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: depthView
          ? {
              view: depthView,
              depthClearValue: 1,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          : undefined
      });
      opaquePass.setPipeline(bridge.opaquePipeline || bridge.pipeline);
      opaquePass.setBindGroup(0, drawState.bindGroup);
      for (const draw of opaqueDraws) {
        opaquePass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
      }
      opaquePass.end();
      let transparentCompositeSubmitted = false;
      if (
        transparentDraws.length > 0
        && depthView
        && bridge.transparentOitPipeline
        && bridge.oitCompositePipeline
        && bridge.oitCompositeBindGroupLayout
      ) {
        const oitTargets = ensureSphResidentSurfaceDrawOitTargets(bridge);
        if (oitTargets?.accumView && oitTargets?.revealView) {
          const transparentPass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: oitTargets.accumView,
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store'
              },
              {
                view: oitTargets.revealView,
                clearValue: { r: 1, g: 1, b: 1, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
              }
            ],
            depthStencilAttachment: {
              view: depthView,
              depthLoadOp: 'load',
              depthStoreOp: 'store'
            }
          });
          transparentPass.setPipeline(bridge.transparentOitPipeline);
          transparentPass.setBindGroup(0, drawState.bindGroup);
          for (const draw of transparentDraws) {
            transparentPass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
          }
          transparentPass.end();
          const compositeBindGroup = bridge.device.createBindGroup({
            label: 'ulg-sph-resident-surface-draw-oit-composite-bind-group',
            layout: bridge.oitCompositeBindGroupLayout,
            entries: [
              { binding: 0, resource: bridge.oitAccumTexture.createView() },
              { binding: 1, resource: bridge.oitRevealTexture.createView() },
              { binding: 2, resource: bridge.oitSampler }
            ]
          });
          const compositePass = encoder.beginRenderPass({
            colorAttachments: [{
              view: canvasView,
              loadOp: 'load',
              storeOp: 'store'
            }]
          });
          compositePass.setPipeline(bridge.oitCompositePipeline);
          compositePass.setBindGroup(0, compositeBindGroup);
          compositePass.draw(3);
          compositePass.end();
          transparentCompositeSubmitted = true;
        }
      } else if (transparentDraws.length > 0) {
        const transparentPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: canvasView,
            loadOp: 'load',
            storeOp: 'store'
          }],
          depthStencilAttachment: depthView
            ? {
                view: depthView,
                depthLoadOp: 'load',
                depthStoreOp: 'store'
              }
            : undefined
        });
        transparentPass.setPipeline(bridge.transparentPipeline || bridge.pipeline);
        transparentPass.setBindGroup(0, drawState.bindGroup);
        for (const draw of transparentDraws) {
          transparentPass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
        }
        transparentPass.end();
      }
      bridge.device.queue.submit([encoder.finish()]);
      bridge.frameCount += 1;
      bridge.lastRenderStatus = 'webgpu-overlay-rendered';
      bridge.lastOpaqueDrawCount = opaqueDraws.length;
      bridge.lastTransparentDrawCount = transparentDraws.length;
      bridge.lastTransparentCompositeMode = transparentCompositeSubmitted ? 'weighted-blended-oit' : 'direct-alpha-depth-test';
      if (sphResidentSurfaceDraw) {
        sphResidentSurfaceDraw.renderBridgeFrameCount = bridge.frameCount;
        sphResidentSurfaceDraw.renderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentSurfaceDraw.renderBridgeDepthAttachmentReady = Boolean(bridge.depthAttachmentReady);
        sphResidentSurfaceDraw.renderBridgeDepthPolicy = bridge.depthPolicy ?? null;
        sphResidentSurfaceDraw.renderBridgeDepthAttachmentFormat = bridge.depthAttachmentFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeOitTargetsReady = Boolean(bridge.oitTargetsReady);
        sphResidentSurfaceDraw.renderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
        sphResidentSurfaceDraw.renderBridgeOitAccumFormat = bridge.oitAccumFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeOitRevealFormat = bridge.oitRevealFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
        sphResidentSurfaceDraw.renderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
        sphResidentSurfaceDraw.renderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
        sphResidentSurfaceDraw.renderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
      }
      if (sphResidentRenderState) {
        sphResidentRenderState.surfaceDrawRenderBridgeFrameCount = bridge.frameCount;
        sphResidentRenderState.surfaceDrawRenderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentReady = Boolean(bridge.depthAttachmentReady);
        sphResidentRenderState.surfaceDrawRenderBridgeDepthPolicy = bridge.depthPolicy ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentFormat = bridge.depthAttachmentFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeOitTargetsReady = Boolean(bridge.oitTargetsReady);
        sphResidentRenderState.surfaceDrawRenderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
        sphResidentRenderState.surfaceDrawRenderBridgeOitAccumFormat = bridge.oitAccumFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeOitRevealFormat = bridge.oitRevealFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
        sphResidentRenderState.surfaceDrawRenderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
        sphResidentRenderState.surfaceDrawRenderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
      }
    } catch (error) {
      bridge.lastRenderStatus = 'webgpu-overlay-render-error';
      bridge.reason = error instanceof Error ? error.message : String(error);
      bridge.drawState = null;
      if (sphResidentSurfaceDraw) {
        sphResidentSurfaceDraw.renderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentSurfaceDraw.renderBridgeReason = bridge.reason;
      }
      if (sphResidentRenderState) {
        sphResidentRenderState.surfaceDrawRenderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentRenderState.surfaceDrawRenderBridgeReason = bridge.reason;
      }
    }
  }

  function publishMlsMpmResidentStepArtifacts(step, signature, {
    stepsExecution = null,
    stepsSignature = null
  } = {}) {
    mlsMpmResidentSteps = stepsExecution;
    mlsMpmResidentStepsSignature = stepsSignature;
    scene.userData.mlsMpmResidentSteps = stepsExecution;
    mlsMpmResidentStep = step;
    mlsMpmResidentStepSignature = stepsExecution ? null : signature;
    mlsMpmP2gGridProjection = step?.p2gGridProjection ?? null;
    mlsMpmP2gGridProjectionSignature = signature;
    mlsMpmGridUpdate = step?.gridUpdate ?? null;
    mlsMpmGridUpdateSignature = signature;
    mlsMpmG2pReconstruction = step?.g2pReconstruction ?? null;
    mlsMpmG2pReconstructionSignature = signature;
    scene.userData.mlsMpmResidentStep = step;
    scene.userData.mlsMpmP2gGridProjection = mlsMpmP2gGridProjection;
    scene.userData.mlsMpmGridUpdate = mlsMpmGridUpdate;
    scene.userData.mlsMpmG2pReconstruction = mlsMpmG2pReconstruction;
  }

  async function refreshSphGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!sphGpuParticleState) {
      sphGpuParticleUpload = null;
      scene.userData.sphGpuParticleUpload = null;
      return null;
    }
    const signature = sphGpuParticleSignature(sphGpuParticleState);
    if (!force && sphGpuParticleUploadSignature === signature && sphGpuParticleUpload) {
      return sphGpuParticleUpload;
    }
    if (!force && pendingSphGpuParticleUpload?.signature === signature) {
      return pendingSphGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: 'WebGPU SPH particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadSphGpuParticleBuffers(resolvedDeviceResult.device, sphGpuParticleState);
      upload.signature = signature;
      upload.step = sphGpuParticleState.step;
      upload.time = sphGpuParticleState.time;
      if (!running || sphGpuParticleSignature(sphGpuParticleState) !== signature) {
        destroySphGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (sphGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroySphGpuParticleBuffers(sphGpuParticleUpload);
      }
      sphGpuParticleUpload = upload;
      sphGpuParticleUploadSignature = signature;
      scene.userData.sphGpuParticleUpload = upload;
      return upload;
    })();
    pendingSphGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingSphGpuParticleUpload?.promise === promise) pendingSphGpuParticleUpload = null;
    }
  }

  async function refreshMlsMpmGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!mlsMpmGpuParticleState) {
      mlsMpmGpuParticleUpload = null;
      scene.userData.mlsMpmGpuParticleUpload = null;
      return null;
    }
    const signature = mlsMpmGpuParticleSignature(mlsMpmGpuParticleState);
    if (!force && mlsMpmGpuParticleUploadSignature === signature && mlsMpmGpuParticleUpload) {
      return mlsMpmGpuParticleUpload;
    }
    if (!force && pendingMlsMpmGpuParticleUpload?.signature === signature) {
      return pendingMlsMpmGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: 'WebGPU MLS-MPM particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadMlsMpmGpuParticleBuffers(resolvedDeviceResult.device, mlsMpmGpuParticleState);
      upload.signature = signature;
      upload.step = mlsMpmGpuParticleState.step;
      upload.time = mlsMpmGpuParticleState.time;
      if (!running || mlsMpmGpuParticleSignature(mlsMpmGpuParticleState) !== signature) {
        destroyMlsMpmGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
      }
      mlsMpmGpuParticleUpload = upload;
      mlsMpmGpuParticleUploadSignature = signature;
      scene.userData.mlsMpmGpuParticleUpload = upload;
      return upload;
    })();
    pendingMlsMpmGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGpuParticleUpload?.promise === promise) pendingMlsMpmGpuParticleUpload = null;
    }
  }

  async function refreshSphThermalResponseGraphBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    const signature = sphThermalResponseGraphSignature();
    if (!signature) {
      if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = null;
      sphThermalResponseGraphUploadSignature = null;
      scene.userData.sphThermalResponseGraphUpload = null;
      return null;
    }
    if (!force && sphThermalResponseGraphUploadSignature === signature && sphThermalResponseGraphUpload) {
      return sphThermalResponseGraphUpload;
    }
    if (!force && pendingSphThermalResponseGraphUpload?.signature === signature) {
      return pendingSphThermalResponseGraphUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceMaterialTableSchema: sphThermalMaterialTable?.schema ?? null,
          materialCount: sphThermalPhaseResponseTable?.materialCount ?? 0,
          responseCount: sphThermalPhaseResponseTable?.responseCount ?? 0,
          graphCount: sphThermalClosureGraphBuffers?.graphBank?.graphCount ?? 0,
          reason: 'WebGPU SPH thermal response/graph upload not requested',
          scientificValidation: false,
          materialValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphThermalResponseGraphUpload = upload;
        sphThermalResponseGraphUploadSignature = signature;
        scene.userData.sphThermalResponseGraphUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceMaterialTableSchema: sphThermalMaterialTable?.schema ?? null,
          materialCount: sphThermalPhaseResponseTable?.materialCount ?? 0,
          responseCount: sphThermalPhaseResponseTable?.responseCount ?? 0,
          graphCount: sphThermalClosureGraphBuffers?.graphBank?.graphCount ?? 0,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-response-graph',
          scientificValidation: false,
          materialValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphThermalResponseGraphUpload = upload;
        sphThermalResponseGraphUploadSignature = signature;
        scene.userData.sphThermalResponseGraphUpload = upload;
        return upload;
      }
      const upload = uploadSphThermalResponseGraphBuffers(resolvedDeviceResult.device, {
        thermalMaterialTable: sphThermalMaterialTable,
        thermalClosureGraphSet: sphThermalClosureGraphBuffers,
        thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
        thermalPhaseResponseTable: sphThermalPhaseResponseTable
      });
      upload.signature = signature;
      if (!running || sphThermalResponseGraphSignature() !== signature) {
        destroySphThermalResponseGraphBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = upload;
      sphThermalResponseGraphUploadSignature = signature;
      scene.userData.sphThermalResponseGraphUpload = upload;
      return upload;
    })();
    pendingSphThermalResponseGraphUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingSphThermalResponseGraphUpload?.promise === promise) pendingSphThermalResponseGraphUpload = null;
    }
  }

  async function refreshMlsMpmMechanicsPrediction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0],
    parityTolerance = 2e-5,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmMechanicsPrediction = null;
      scene.userData.mlsMpmMechanicsPrediction = null;
      return null;
    }
    const signature = mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 });
    if (!force && mlsMpmMechanicsPredictionSignature === signature && mlsMpmMechanicsPrediction) {
      return mlsMpmMechanicsPrediction;
    }
    if (!force && pendingMlsMpmMechanicsPrediction?.signature === signature) {
      return pendingMlsMpmMechanicsPrediction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        dt,
        gravityMPerS2,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmMechanicsPrediction = execution;
      mlsMpmMechanicsPredictionSignature = signature;
      scene.userData.mlsMpmMechanicsPrediction = execution;
      return execution;
    })();
    pendingMlsMpmMechanicsPrediction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmMechanicsPrediction?.promise === promise) pendingMlsMpmMechanicsPrediction = null;
    }
  }

  async function refreshMlsMpmP2gGridProjection({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmP2gGridProjection = null;
      scene.userData.mlsMpmP2gGridProjection = null;
      return null;
    }
    const lawGroups = normalizePhysicalLawGroups(currentPhysicalLawGroups);
    const internalPressureScale = lawGroups.eos ? 1 : 0;
    const signature = mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM, internalPressureScale });
    if (!force && mlsMpmP2gGridProjectionSignature === signature && mlsMpmP2gGridProjection) {
      return mlsMpmP2gGridProjection;
    }
    if (!force && pendingMlsMpmP2gGridProjection?.signature === signature) {
      return pendingMlsMpmP2gGridProjection.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        gridSpacingM,
        boxDimsM: dims,
        internalPressureScale,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        retainGridBuffer: true,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM, internalPressureScale }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmP2gGridProjection = execution;
      mlsMpmP2gGridProjectionSignature = signature;
      scene.userData.mlsMpmP2gGridProjection = execution;
      return execution;
    })();
    pendingMlsMpmP2gGridProjection = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmP2gGridProjection?.promise === promise) pendingMlsMpmP2gGridProjection = null;
    }
  }

  async function refreshMlsMpmGridUpdate({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    parityTolerance = 1e-5,
    pressureInterfaceForceSolver = currentPressureInterfaceForceSolver(),
    pressureInterfaceForceRowsBuffer = currentPressureInterfaceForceRowsBuffer(pressureInterfaceForceSolver),
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    webGpuRunner = undefined
  } = {}) {
    if (!p2gGridProjection?.schema) {
      mlsMpmGridUpdate = null;
      scene.userData.mlsMpmGridUpdate = null;
      return null;
    }
    const pressureInterfaceForceRowCount = Math.max(0, Math.round(Number(pressureInterfaceForceSolver?.forceRowCount) || 0));
    const pressureInterfaceGridForceApproved = pressureInterfaceForceRowsUploadApproved({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount: pressureInterfaceForceRowCount
    });
    const effectivePressureInterfaceForceSolver = pressureInterfaceGridForceApproved ? pressureInterfaceForceSolver : null;
    const effectivePressureInterfaceForceRowsBuffer = pressureInterfaceGridForceApproved ? pressureInterfaceForceRowsBuffer : null;
    const effectivePressureInterfaceGridForceAdmission = pressureInterfaceGridForceApproved ? pressureInterfaceGridForceAdmission : null;
    const signature = mlsMpmGridUpdateSignatureFor({
      p2gGridProjection,
      dt,
      gravityMPerS2,
      cflFactor,
      pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver
    });
    if (!force && mlsMpmGridUpdateSignature === signature && mlsMpmGridUpdate) {
      return mlsMpmGridUpdate;
    }
    if (!force && pendingMlsMpmGridUpdate?.signature === signature) {
      return pendingMlsMpmGridUpdate.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      let resolvedPressureForceRowsUpload = null;
      let pressureForceRowsBorrow = null;
      try {
        pressureForceRowsBorrow = borrowPressureInterfaceForceRowsForStage({
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer,
          consumerStage: 'mls-mpm-grid-update',
          reason: 'retained-pressure-interface-force-rows-grid-update'
        });
        resolvedPressureForceRowsUpload = effectivePressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
            pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
          p2gGridProjection,
          p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
          dt,
          gravityMPerS2,
          boxDimsM: dims,
          cflFactor,
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          parityTolerance,
          retainUpdatedGridBuffer: true,
          webGpuRunner,
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          }
        });
        execution.signature = signature;
        const pressureRowsConsumerQueueEvidence = pressureConsumerQueueEvidenceFromExecution(execution);
        const pressureRowsLeaseEvidence = pressureForceRowsBorrow?.release(
          'released-after-mls-mpm-grid-update-complete',
          pressureRowsConsumerQueueEvidence
        );
        if (pressureRowsLeaseEvidence) Object.assign(execution, pressureRowsLeaseEvidence);
        const pressureRowsTemporaryUploadCleanupEvidence = destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          execution,
          reason: 'temporary-pressure-interface-force-rows-grid-update-complete'
        });
        if (pressureRowsTemporaryUploadCleanupEvidence) {
          Object.assign(execution, pressureRowsTemporaryUploadCleanupEvidence);
          resolvedPressureForceRowsUpload = null;
        }
        if (
          !running
          || mlsMpmGridUpdateSignatureFor({
            p2gGridProjection,
            dt,
            gravityMPerS2,
            cflFactor,
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        mlsMpmGridUpdate = execution;
        mlsMpmGridUpdateSignature = signature;
        scene.userData.mlsMpmGridUpdate = execution;
        return execution;
      } finally {
        pressureForceRowsBorrow?.release('released-after-mls-mpm-grid-update-cleanup');
        destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          reason: 'temporary-pressure-interface-force-rows-grid-update-cleanup'
        });
      }
    })();
    pendingMlsMpmGridUpdate = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGridUpdate?.promise === promise) pendingMlsMpmGridUpdate = null;
    }
  }

  async function refreshMlsMpmG2pReconstruction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState || !gridUpdate?.schema) {
      mlsMpmG2pReconstruction = null;
      scene.userData.mlsMpmG2pReconstruction = null;
      return null;
    }
    const signature = mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt });
    if (!force && mlsMpmG2pReconstructionSignature === signature && mlsMpmG2pReconstruction) {
      return mlsMpmG2pReconstruction;
    }
    if (!force && pendingMlsMpmG2pReconstruction?.signature === signature) {
      return pendingMlsMpmG2pReconstruction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmG2pWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        gridUpdate,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
        dt,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt }) !== signature) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmG2pReconstruction = execution;
      mlsMpmG2pReconstructionSignature = signature;
      scene.userData.mlsMpmG2pReconstruction = execution;
      return execution;
    })();
    pendingMlsMpmG2pReconstruction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmG2pReconstruction?.promise === promise) pendingMlsMpmG2pReconstruction = null;
    }
  }

  async function refreshMlsMpmResidentStep({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    parityTolerances = undefined,
    pressureInterfaceForceSolver = currentPressureInterfaceForceSolver(),
    pressureInterfaceForceRowsBuffer = currentPressureInterfaceForceRowsBuffer(pressureInterfaceForceSolver),
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    gasPressureSummary = null,
    pressureFeedback = null,
    pressureInterfaceGasCellFieldImport = currentPressureInterfaceGasCellFieldImport(),
    pressureInterfaceGasCellFieldAdmission = null,
    p2gRunner = undefined,
    gridUpdateRunner = undefined,
    g2pRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      clearMlsMpmResidentExecutionArtifacts();
      return null;
    }
    const lawGroups = normalizePhysicalLawGroups(currentPhysicalLawGroups);
    const effectiveDt = lawGroups.mechanics ? dt : 0;
    const effectiveGravity = lawGroups.gravity ? gravityMPerS2 : [0, 0, 0];
    const effectiveInternalPressureScale = lawGroups.eos ? 1 : 0;
    const pressureInterfaceForceRowCount = Math.max(0, Math.round(Number(pressureInterfaceForceSolver?.forceRowCount) || 0));
    const pressureInterfaceGridForceApproved = lawGroups.pressure && pressureInterfaceForceRowsUploadApproved({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount: pressureInterfaceForceRowCount
    });
    const effectivePressureInterfaceForceSolver = pressureInterfaceGridForceApproved ? pressureInterfaceForceSolver : null;
    const effectivePressureInterfaceForceRowsBuffer = pressureInterfaceGridForceApproved ? pressureInterfaceForceRowsBuffer : null;
    const effectivePressureInterfaceGridForceAdmission = pressureInterfaceGridForceApproved ? pressureInterfaceGridForceAdmission : null;
    const effectiveThermalMaterialTable = lawGroups.thermal ? sphThermalMaterialTable : null;
    const effectiveReactionTable = lawGroups.reactions ? sphReactionTable : null;
    const requestedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    scene.userData.mlsMpmResidentRequestedReadbackMode = requestedReadbackMode;
    const signature = mlsMpmResidentStepSignatureFor({
      gridSpacingM,
      dt: effectiveDt,
      gravityMPerS2: effectiveGravity,
      cflFactor,
      readbackMode: requestedReadbackMode,
      pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
      pressureInterfaceGasCellFieldImport,
      internalPressureScale: effectiveInternalPressureScale,
      physicalLawGroups: lawGroups
    });
    if (!force && mlsMpmResidentStepSignature === signature && mlsMpmResidentStep) {
      return mlsMpmResidentStep;
    }
    if (!force && pendingMlsMpmResidentStep?.signature === signature) {
      return pendingMlsMpmResidentStep.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const resolvedThermalResponseGraphUpload = preferWebGpu
        ? await refreshSphThermalResponseGraphBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphThermalResponseGraphUpload;
      let resolvedPressureForceRowsUpload = null;
      let pressureForceRowsBorrow = null;
      try {
        pressureForceRowsBorrow = borrowPressureInterfaceForceRowsForStage({
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer,
          consumerStage: 'mls-mpm-resident-step-grid-update',
          reason: 'retained-pressure-interface-force-rows-resident-step'
        });
        resolvedPressureForceRowsUpload = effectivePressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
            pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        const execution = await runMlsMpmResidentStepWithOptionalWebGpu({
          sphParticleState: sphGpuParticleState,
          mlsMpmParticleState: mlsMpmGpuParticleState,
          sphParticleUpload: resolvedSphUpload,
          mlsMpmParticleUpload: resolvedMlsUpload,
          gridSpacingM,
          boxDimsM: dims,
          dt: effectiveDt,
          gravityMPerS2: effectiveGravity,
          internalPressureScale: effectiveInternalPressureScale,
          cflFactor,
          preferWebGpu,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
          pressureFeedback: pressureFeedback || pressureFeedbackFromGasPressureSummary(gasPressureSummary),
          gasPressureSummary,
          pressureInterfaceGasCellFieldImport,
          pressureInterfaceGasCellFieldAdmission,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          readbackMode: requestedReadbackMode,
          thermalMaterialTable: effectiveThermalMaterialTable,
          mechanicsMaterialTable: mlsMpmMechanicsMaterialTable,
          thermalStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          reactionTable: effectiveReactionTable,
          reactionStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          cohortRanges: cohortRangesFromRenderDomainCounts(currentRenderDomainCounts),
          parityTolerances,
          p2gRunner,
          gridUpdateRunner,
          g2pRunner,
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          }
        });
        execution.requestedReadbackMode = requestedReadbackMode;
        execution.physicalLawGroups = { ...lawGroups };
        execution.signature = signature;
        const pressureRowsConsumerQueueEvidence = pressureConsumerQueueEvidenceFromExecution(execution);
        const pressureRowsLeaseEvidence = pressureForceRowsBorrow?.release(
          'released-after-mls-mpm-resident-step-complete',
          pressureRowsConsumerQueueEvidence
        );
        if (pressureRowsLeaseEvidence) Object.assign(execution, pressureRowsLeaseEvidence);
        const pressureRowsTemporaryUploadCleanupEvidence = destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          execution,
          reason: 'temporary-pressure-interface-force-rows-resident-step-complete'
        });
        if (pressureRowsTemporaryUploadCleanupEvidence) {
          Object.assign(execution, pressureRowsTemporaryUploadCleanupEvidence);
          resolvedPressureForceRowsUpload = null;
        }
        if (
          !running
          || mlsMpmResidentStepSignatureFor({
            gridSpacingM,
            dt: effectiveDt,
            gravityMPerS2: effectiveGravity,
            cflFactor,
            readbackMode: requestedReadbackMode,
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
            pressureInterfaceGasCellFieldImport,
            internalPressureScale: effectiveInternalPressureScale,
            physicalLawGroups: lawGroups
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        clearMlsMpmResidentExecutionArtifacts({
          preserveBuffers: residentContinuationBuffersFromExecution(execution)
        });
        publishMlsMpmResidentStepArtifacts(execution, signature);
        return execution;
      } finally {
        pressureForceRowsBorrow?.release('released-after-mls-mpm-resident-step-cleanup');
        destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          reason: 'temporary-pressure-interface-force-rows-resident-step-cleanup'
        });
      }
    })();
    pendingMlsMpmResidentStep = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmResidentStep?.promise === promise) pendingMlsMpmResidentStep = null;
    }
  }

  async function refreshMlsMpmResidentSteps({
    preferWebGpu = true,
    force = false,
    computeManager = null,
    computeTaskModulePath = null,
    computeTaskLaneId = 'ulg:sph-resident:scene',
    computeTaskStateKey = null,
    computeTaskDomainKey = 'sph-phase-scene',
    residentStateManager = null,
    residentAuthorityHost = null,
    sameDeviceHotBufferPublisher = null,
    requireSameDeviceHotBufferSourcePublication = false,
    requireStateManagerCommit = null,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    parityTolerances = undefined,
    p2gRunner = undefined,
    gridUpdateRunner = undefined,
    g2pRunner = undefined,
    stepCount = 1,
    retainIntermediateSteps = false,
    continueFromResidentState = false,
    compactSummaryMode = null,
    compactSummaryScope = null,
    fuseNoFullResidentMechanicsSequence = false,
    fuseNoFullResidentMechanicsActiveGrid = false,
    fuseNoFullResidentActiveGrid = false,
    measureFusedSequenceQueueFence = false,
    activeGridSafetyCells = undefined,
    fusedActiveGridSafetyCells = undefined,
    thermalStepOptions: thermalStepOptionOverrides = null,
    pressureInterfaceForceSolver = currentPressureInterfaceForceSolver(),
    pressureInterfaceForceRowsBuffer = currentPressureInterfaceForceRowsBuffer(pressureInterfaceForceSolver),
    pressureInterfaceGridForceAdmission = currentPressureInterfaceGridForceAdmission(),
    gasPressureSummary = null,
    pressureFeedback = null,
    pressureInterfaceGasCellFieldImport = currentPressureInterfaceGasCellFieldImport(),
    pressureInterfaceGasCellFieldAdmission = null
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      clearMlsMpmResidentExecutionArtifacts();
      return null;
    }
    const lawGroups = normalizePhysicalLawGroups(currentPhysicalLawGroups);
    const effectiveDt = lawGroups.mechanics ? dt : 0;
    const effectiveGravity = lawGroups.gravity ? gravityMPerS2 : [0, 0, 0];
    const effectiveInternalPressureScale = lawGroups.eos ? 1 : 0;
    const pressureInterfaceForceRowCount = Math.max(0, Math.round(Number(pressureInterfaceForceSolver?.forceRowCount) || 0));
    const pressureInterfaceGridForceApproved = lawGroups.pressure && pressureInterfaceForceRowsUploadApproved({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount: pressureInterfaceForceRowCount
    });
    const effectivePressureInterfaceForceSolver = pressureInterfaceGridForceApproved ? pressureInterfaceForceSolver : null;
    const effectivePressureInterfaceForceRowsBuffer = pressureInterfaceGridForceApproved ? pressureInterfaceForceRowsBuffer : null;
    const effectivePressureInterfaceGridForceAdmission = pressureInterfaceGridForceApproved ? pressureInterfaceGridForceAdmission : null;
    const effectiveThermalMaterialTable = lawGroups.thermal ? sphThermalMaterialTable : null;
    const effectiveReactionTable = lawGroups.reactions ? sphReactionTable : null;
    const normalizedStepCount = normalizeResidentStepCount(stepCount);
    const requestedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    const requestedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(
      compactSummaryMode ?? (
        requestedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
          ? MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE
          : MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP
      )
    );
    const requestedCompactSummaryScope = normalizeMlsMpmResidentSummaryScope(
      compactSummaryScope ?? (
        requestedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
          ? MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL
          : MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL
      )
    );
    const requestedFuseNoFullResidentMechanicsSequence = Boolean(fuseNoFullResidentMechanicsSequence);
    const requestedFuseNoFullResidentMechanicsActiveGrid = Boolean(
      fuseNoFullResidentMechanicsActiveGrid || fuseNoFullResidentActiveGrid
    );
    const requestedMeasureFusedSequenceQueueFence = Boolean(measureFusedSequenceQueueFence);
    const activeGridSafetyValue = fusedActiveGridSafetyCells ?? activeGridSafetyCells;
    const normalizedActiveGridSafetyCells = Number.isFinite(Number(activeGridSafetyValue)) && Number(activeGridSafetyValue) > 0
      ? Math.max(1, Math.round(Number(activeGridSafetyValue)))
      : undefined;
    const residentExecutionPolicy = {
      schema: 'peercompute.ulg.sph-scene-resident-execution-policy.v0',
      fuseNoFullResidentMechanicsSequence: requestedFuseNoFullResidentMechanicsSequence,
      fuseNoFullResidentMechanicsActiveGrid: requestedFuseNoFullResidentMechanicsActiveGrid,
      measureFusedSequenceQueueFence: requestedMeasureFusedSequenceQueueFence,
      activeGridSafetyCells: normalizedActiveGridSafetyCells ?? null,
      compactSummaryMode: requestedCompactSummaryMode
    };
    scene.userData.mlsMpmResidentRequestedReadbackMode = requestedReadbackMode;
    scene.userData.mlsMpmResidentCompactSummaryMode = requestedCompactSummaryMode;
    const continuationUploads = mlsMpmResidentSteps?.nextParticleUploads ?? null;
    const continuationAvailable = Boolean(
      continueFromResidentState
      && requestedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
      && mlsMpmResidentSteps?.nextSphParticleState
      && mlsMpmResidentSteps?.nextMlsMpmParticleState
      && continuationUploads?.sphParticleUpload?.status === 'webgpu-uploaded'
      && continuationUploads?.mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    );
    const sourceSphParticleState = continuationAvailable
      ? mlsMpmResidentSteps.nextSphParticleState
      : sphGpuParticleState;
    const sourceMlsMpmParticleState = continuationAvailable
      ? mlsMpmResidentSteps.nextMlsMpmParticleState
      : mlsMpmGpuParticleState;
    const residentSourceMode = continuationAvailable
      ? 'previous-gpu-resident-output'
      : 'cpu-packed-state';
    const signature = mlsMpmResidentStepsSignatureFor({
      sphParticleState: sourceSphParticleState,
      mlsMpmParticleState: sourceMlsMpmParticleState,
      gridSpacingM,
      dt: effectiveDt,
      gravityMPerS2: effectiveGravity,
      cflFactor,
      readbackMode: requestedReadbackMode,
      stepCount: normalizedStepCount,
      retainIntermediateSteps,
      compactSummaryMode: requestedCompactSummaryMode,
      compactSummaryScope: requestedCompactSummaryScope,
      residentSourceMode,
      pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
      pressureInterfaceGasCellFieldImport,
      internalPressureScale: effectiveInternalPressureScale,
      physicalLawGroups: lawGroups,
      fuseNoFullResidentMechanicsSequence: requestedFuseNoFullResidentMechanicsSequence,
      fuseNoFullResidentMechanicsActiveGrid: requestedFuseNoFullResidentMechanicsActiveGrid,
      measureFusedSequenceQueueFence: requestedMeasureFusedSequenceQueueFence,
      activeGridSafetyCells: normalizedActiveGridSafetyCells
    });
    const markResidentStepsProgress = (status, extra = {}) => {
      scene.userData.mlsMpmResidentStepsProgress = {
        schema: 'peercompute.ulg.sph-scene-resident-steps-progress.v0',
        status,
        signature,
        stepCount: normalizedStepCount,
        readbackMode: requestedReadbackMode,
        compactSummaryMode: requestedCompactSummaryMode,
        compactSummaryScope: requestedCompactSummaryScope,
        residentSourceMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        updatedAtMs: nowMs(),
        ...extra
      };
      const progressStage = extra.stage || extra.currentStage || extra.innerProgress?.stage || null;
      const progressStep = extra.stepIndex ?? extra.sequenceIndex ?? extra.innerProgress?.stepIndex ?? extra.innerProgress?.sequenceIndex ?? null;
      const progressSuffix = [
        progressStep !== null && progressStep !== undefined ? `step=${progressStep}` : null,
        progressStage ? `stage=${progressStage}` : null
      ].filter(Boolean).join(' ');
      console.debug?.(`[sph-resident-progress] ${status}${progressSuffix ? ` ${progressSuffix}` : ''}`);
    };
    if (!force && mlsMpmResidentStepsSignature === signature && mlsMpmResidentSteps) {
      markResidentStepsProgress('resident-steps-cache-hit');
      return mlsMpmResidentSteps;
    }
    if (!force && pendingMlsMpmResidentSteps) {
      markResidentStepsProgress('resident-steps-joining-pending-promise', {
        pendingSignature: pendingMlsMpmResidentSteps.signature
      });
      return pendingMlsMpmResidentSteps.promise;
    }
    markResidentStepsProgress('resident-steps-submitted');
    const promise = (async () => {
      markResidentStepsProgress('resident-steps-requesting-device');
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      markResidentStepsProgress('resident-steps-device-ready', {
        deviceStatus: resolvedDeviceResult?.status ?? null,
        deviceReason: resolvedDeviceResult?.reason ?? null
      });
      const resolvedSphUpload = continuationAvailable
        ? continuationUploads.sphParticleUpload
        : preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      markResidentStepsProgress('resident-steps-sph-upload-ready', {
        uploadStatus: resolvedSphUpload?.status ?? null,
        particleCount: resolvedSphUpload?.particleCount ?? sourceSphParticleState?.particleCount ?? null
      });
      const resolvedMlsUpload = continuationAvailable
        ? continuationUploads.mlsMpmParticleUpload
        : preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      markResidentStepsProgress('resident-steps-mls-upload-ready', {
        uploadStatus: resolvedMlsUpload?.status ?? null
      });
      const resolvedThermalResponseGraphUpload = preferWebGpu
        ? await refreshSphThermalResponseGraphBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphThermalResponseGraphUpload;
      markResidentStepsProgress('resident-steps-thermal-upload-ready', {
        uploadStatus: resolvedThermalResponseGraphUpload?.status ?? null,
        graphCount: resolvedThermalResponseGraphUpload?.graphCount ?? null
      });
      let resolvedPressureForceRowsUpload = null;
      let pressureForceRowsBorrow = null;
      try {
        markResidentStepsProgress('resident-steps-borrowing-pressure-rows', {
          pressureSolverStatus: effectivePressureInterfaceForceSolver?.status ?? null,
          pressureRowsRetained: Boolean(effectivePressureInterfaceForceRowsBuffer)
        });
        pressureForceRowsBorrow = borrowPressureInterfaceForceRowsForStage({
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer,
          consumerStage: 'mls-mpm-resident-steps-grid-update',
          reason: 'retained-pressure-interface-force-rows-resident-steps'
        });
        resolvedPressureForceRowsUpload = effectivePressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
            pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        markResidentStepsProgress('resident-steps-running-kernels', {
          pressureRowsUploadStatus: resolvedPressureForceRowsUpload?.status ?? null,
          pressureRowsRetained: Boolean(effectivePressureInterfaceForceRowsBuffer)
        });
        const residentStepsOptions = {
          sphParticleState: sourceSphParticleState,
          mlsMpmParticleState: sourceMlsMpmParticleState,
          sphParticleUpload: resolvedSphUpload,
          mlsMpmParticleUpload: resolvedMlsUpload,
          gridSpacingM,
          boxDimsM: dims,
          dt: effectiveDt,
          gravityMPerS2: effectiveGravity,
          internalPressureScale: effectiveInternalPressureScale,
          cflFactor,
          preferWebGpu,
          pressureInterfaceForceRowsBuffer: effectivePressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
          pressureInterfaceGridForceAdmission: effectivePressureInterfaceGridForceAdmission,
          pressureFeedback: pressureFeedback || pressureFeedbackFromGasPressureSummary(gasPressureSummary),
          gasPressureSummary,
          pressureInterfaceGasCellFieldImport,
          pressureInterfaceGasCellFieldAdmission,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          readbackMode: requestedReadbackMode,
          thermalMaterialTable: effectiveThermalMaterialTable,
          mechanicsMaterialTable: mlsMpmMechanicsMaterialTable,
          thermalStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload,
            wallTemperaturesK: currentWallTemperaturesK || {},
            ...(thermalStepOptionOverrides || {})
          },
          reactionTable: effectiveReactionTable,
          reactionStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          cohortRanges: cohortRangesFromRenderDomainCounts(currentRenderDomainCounts),
          parityTolerances,
          p2gRunner,
          gridUpdateRunner,
          g2pRunner,
          stepCount: normalizedStepCount,
          compactSummaryMode: requestedCompactSummaryMode,
          compactSummaryScope: requestedCompactSummaryScope,
          retainIntermediateSteps,
          onResidentStageProgress(progress = {}) {
            markResidentStepsProgress(progress.status || 'resident-steps-inner-progress', {
              innerProgress: progress,
              currentStage: progress.stage ?? null,
              stepIndex: progress.stepIndex ?? progress.sequenceIndex ?? null,
              stageElapsedMs: progress.elapsedMs ?? null
            });
          },
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          },
          fuseNoFullResidentMechanicsSequence: requestedFuseNoFullResidentMechanicsSequence,
          fuseNoFullResidentMechanicsActiveGrid: requestedFuseNoFullResidentMechanicsActiveGrid,
          measureFusedSequenceQueueFence: requestedMeasureFusedSequenceQueueFence,
          activeGridSafetyCells: normalizedActiveGridSafetyCells
        };
        let execution = null;
        if (computeManager && typeof computeManager.submitTask === 'function') {
          const continuationTaskStateKey = continueFromResidentState
            ? (mlsMpmResidentSteps?.computeManagerTask?.stateKey
              || mlsMpmResidentSteps?.stateManagerCommit?.stateKey
              || mlsMpmResidentSteps?.commitDelta?.payload?.stateKey
              || null)
            : null;
          const taskStateKey = computeTaskStateKey
            || continuationTaskStateKey
            || `ulg:sph-resident-state:${signature}`;
          const taskStateKeySource = computeTaskStateKey
            ? 'caller-provided'
            : (continuationTaskStateKey
                ? 'previous-continuation-lane-state-key'
                : 'signature-derived-initial-state-key');
          const resolvedComputeTaskModulePath = computeTaskModulePath
            || computeManager.ulgResidentComputeTaskModulePath
            || 'src/runtime/sph/sphMlsMpmGpuStep.js';
          markResidentStepsProgress('resident-steps-compute-manager-task-submitted', {
            laneId: computeTaskLaneId,
            stateKey: taskStateKey,
            stateKeySource: taskStateKeySource
          });
          const submission = await submitMlsMpmResidentStepsComputeTask({
            computeManager,
            ...residentStepsOptions,
            modulePath: resolvedComputeTaskModulePath,
            taskId: `ulg:sph-resident-steps:${signature}`,
            laneId: computeTaskLaneId,
            stateKey: taskStateKey,
            domainKey: computeTaskDomainKey
          });
          execution = submission?.result
            || submission?.taskResult
            || submission?.execution
            || submission?.value
            || submission;
          if (!execution?.finalStep) {
            throw new Error('ComputeManager resident-steps task did not return an inline execution envelope for scene-local publication');
          }
          const shouldRequireStateManagerCommit = requireStateManagerCommit ?? Boolean(residentStateManager);
          let stateManagerCommit = null;
          if (residentStateManager) {
            stateManagerCommit = readResidentStepsCommittedWarmDelta(residentStateManager, {
              delta: execution.commitDelta,
              taskId: `ulg:sph-resident-steps:${signature}`,
              scope: execution.commitDelta?.scope || 'ulg-sph-resident-pass-dag'
            });
            execution.stateManagerCommit = {
              ...stateManagerCommit,
              warmEntry: stateManagerCommit.warmEntry
                ? {
                    version: stateManagerCommit.warmEntry.version ?? null,
                    ts: stateManagerCommit.warmEntry.ts ?? null,
                    payloadSchema: stateManagerCommit.warmEntry.payload?.schema ?? null,
                    payloadStateKey: stateManagerCommit.warmEntry.payload?.stateKey ?? null,
                    payloadCompletedStepCount: stateManagerCommit.warmEntry.payload?.completedStepCount ?? null
                  }
                : null
            };
            if (!stateManagerCommit.accepted) {
              markResidentStepsProgress('resident-steps-state-manager-commit-rejected', {
                reason: stateManagerCommit.reason,
                issues: stateManagerCommit.issues
              });
              if (shouldRequireStateManagerCommit) {
                throw new Error(`ComputeManager resident-steps StateManager commit was not accepted: ${stateManagerCommit.reason || 'missing-commit'}`);
              }
            } else {
              markResidentStepsProgress('resident-steps-state-manager-commit-accepted', {
                taskId: stateManagerCommit.taskId,
                stateKey: stateManagerCommit.stateKey,
                warmEntryVersion: stateManagerCommit.warmEntryVersion
              });
            }
          } else if (shouldRequireStateManagerCommit) {
            throw new Error('ComputeManager resident-steps publication requires a StateManager commit, but no residentStateManager was provided');
          }
          execution.computeManagerTask = {
            schema: 'peercompute.ulg.sph-scene-resident-compute-manager-task.v0',
            status: stateManagerCommit?.accepted
              ? 'state-manager-committed-inline-execution-returned'
              : 'inline-execution-returned',
            laneId: computeTaskLaneId,
            stateKey: taskStateKey,
            stateKeySource: taskStateKeySource,
            domainKey: computeTaskDomainKey,
            submissionStatus: submission?.status ?? null,
            acceptedTaskId: submission?.acceptedTaskId ?? submission?.taskId ?? null,
            solverId: execution?.peerComputeSolverTask?.solverId ?? submission?.solverId ?? null,
            solverTaskCreated: execution?.peerComputeSolverTask?.created === true,
            solverTaskStatus: execution?.peerComputeSolverTask?.status ?? null,
            solverTaskSchema: execution?.peerComputeSolverTask?.solverTaskSchema ?? null,
            solverTaskAffinityKey: execution?.peerComputeSolverTask?.affinityKey ?? null,
            solverTaskWarmDeltaScope: execution?.peerComputeSolverTask?.warmDeltaScope ?? null,
            stateManagerCommitAccepted: stateManagerCommit?.accepted ?? false,
            stateManagerCommitStatus: stateManagerCommit?.status ?? null,
            stateManagerCommitReason: stateManagerCommit?.reason ?? null
          };
          markResidentStepsProgress('resident-steps-compute-manager-task-complete', {
            backend: execution?.backend ?? null,
            completedStepCount: execution?.completedStepCount ?? null,
            laneId: computeTaskLaneId,
            stateManagerCommitStatus: stateManagerCommit?.status ?? null
          });
        } else {
          execution = await runMlsMpmResidentStepsWithOptionalWebGpu(residentStepsOptions);
        }
        markResidentStepsProgress('resident-steps-kernels-complete', {
          backend: execution?.backend ?? null,
          completedStepCount: execution?.completedStepCount ?? null,
          stageTiming: execution?.finalStep?.stageTiming || null
        });
        execution.requestedReadbackMode = requestedReadbackMode;
        execution.compactSummaryMode = requestedCompactSummaryMode;
        execution.compactSummaryScope = requestedCompactSummaryScope;
        execution.residentSourceMode = residentSourceMode;
        execution.continuedFromResidentState = continuationAvailable;
        execution.continuationAvailable = Boolean(execution.nextParticleUploads);
        execution.physicalLawGroups = { ...lawGroups };
        execution.residentExecutionPolicy = residentExecutionPolicy;
        if (execution.finalStep) {
          execution.finalStep.requestedReadbackMode = requestedReadbackMode;
          execution.finalStep.compactSummaryMode = requestedCompactSummaryMode;
        }
        for (const summary of execution.stepSummaries ?? []) {
          summary.requestedReadbackMode = requestedReadbackMode;
          summary.compactSummaryMode = requestedCompactSummaryMode;
        }
        execution.signature = signature;
        const pressureRowsConsumerQueueEvidence = pressureConsumerQueueEvidenceFromExecution(execution);
        const pressureRowsLeaseEvidence = pressureForceRowsBorrow?.release(
          'released-after-mls-mpm-resident-steps-complete',
          pressureRowsConsumerQueueEvidence
        );
        if (pressureRowsLeaseEvidence) Object.assign(execution, pressureRowsLeaseEvidence);
        const pressureRowsTemporaryUploadCleanupEvidence = destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          execution,
          reason: 'temporary-pressure-interface-force-rows-resident-steps-complete'
        });
        if (pressureRowsTemporaryUploadCleanupEvidence) {
          Object.assign(execution, pressureRowsTemporaryUploadCleanupEvidence);
          resolvedPressureForceRowsUpload = null;
        }
        if (
          !running
          || mlsMpmResidentStepsSignatureFor({
            sphParticleState: sourceSphParticleState,
            mlsMpmParticleState: sourceMlsMpmParticleState,
            gridSpacingM,
            dt: effectiveDt,
            gravityMPerS2: effectiveGravity,
            cflFactor,
            readbackMode: requestedReadbackMode,
            stepCount: normalizedStepCount,
            retainIntermediateSteps,
            compactSummaryMode: requestedCompactSummaryMode,
            compactSummaryScope: requestedCompactSummaryScope,
            residentSourceMode,
            pressureInterfaceForceSolver: effectivePressureInterfaceForceSolver,
            pressureInterfaceGasCellFieldImport,
            internalPressureScale: effectiveInternalPressureScale,
            physicalLawGroups: lawGroups,
            fuseNoFullResidentMechanicsSequence: requestedFuseNoFullResidentMechanicsSequence,
            fuseNoFullResidentMechanicsActiveGrid: requestedFuseNoFullResidentMechanicsActiveGrid,
            measureFusedSequenceQueueFence: requestedMeasureFusedSequenceQueueFence,
            activeGridSafetyCells: normalizedActiveGridSafetyCells
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        const sameDeviceHotBufferPublisherFn = sameDeviceHotBufferPublisher
          || residentAuthorityHost?.publishSameDeviceHotBufferSource
          || null;
        const sameDevicePublicationStateManagerAccepted = execution?.computeManagerTask?.stateManagerCommitAccepted === true
          || execution?.stateManagerCommit?.accepted === true
          || execution?.stateManagerCommit?.status === 'committed';
        const sameDevicePublicationUploadsReady = Boolean(
          execution?.nextParticleUploads?.sphParticleUpload?.status === 'webgpu-uploaded'
          && execution?.nextParticleUploads?.sphParticleUpload?.stateBuffer
          && execution?.nextParticleUploads?.sphParticleUpload?.thermoBuffer
          && execution?.nextParticleUploads?.mlsMpmParticleUpload?.status === 'webgpu-uploaded'
          && execution?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
        );
        const sameDevicePublicationStatusBase = {
          schema: 'peercompute.ulg.sph-scene-same-device-hot-buffer-source-publication.v0',
          sourceStage: 'resident-steps',
          sourceMode: computeManager
            ? 'mounted-resident-compute-manager-output'
            : 'scene-local-resident-output',
          stateKey: execution?.computeManagerTask?.stateKey || computeTaskStateKey || null,
          sourceTaskId: execution?.computeManagerTask?.acceptedTaskId
            || execution?.commitDelta?.taskId
            || `ulg:sph-resident-steps:${signature}`,
          sourceNodeId: execution?.lawGraphNode?.nodeId || 'ulg-mls-mpm-sph-resident-pass-dag',
          uploadsReady: sameDevicePublicationUploadsReady,
          stateManagerCommitAccepted: sameDevicePublicationStateManagerAccepted,
          publisherAvailable: typeof sameDeviceHotBufferPublisherFn === 'function',
          computeManagerOwned: Boolean(computeManager)
        };
        let sameDeviceHotBufferSourcePublication = null;
        if (
          typeof sameDeviceHotBufferPublisherFn === 'function'
          && computeManager
          && sameDevicePublicationStateManagerAccepted
          && sameDevicePublicationUploadsReady
        ) {
          try {
            sameDeviceHotBufferSourcePublication = sameDeviceHotBufferPublisherFn.call(residentAuthorityHost || null, {
              cacheKey: `ulg:sph-resident-steps:${signature}`,
              stateKey: sameDevicePublicationStatusBase.stateKey,
              hotBufferKeyPrefix: 'ulg:sph-resident-same-device-source',
              sphPacked: execution.nextSphParticleState,
              mlsMpmPacked: execution.nextMlsMpmParticleState,
              sphUpload: execution.nextParticleUploads.sphParticleUpload,
              mlsMpmUpload: execution.nextParticleUploads.mlsMpmParticleUpload,
              particleCount: execution.nextSphParticleState?.particleCount
                ?? execution.nextMlsMpmParticleState?.particleCount
                ?? execution.nextParticleUploads.sphParticleUpload?.particleCount
                ?? null,
              step: execution.nextSphParticleState?.step ?? execution.nextMlsMpmParticleState?.step ?? null,
              time: execution.nextSphParticleState?.time ?? execution.nextMlsMpmParticleState?.time ?? null,
              sourceSchema: execution.computeTaskResultSchema || execution.schema || null,
              sourceMode: sameDevicePublicationStatusBase.sourceMode,
              sourceTaskId: sameDevicePublicationStatusBase.sourceTaskId,
              sourceNodeId: sameDevicePublicationStatusBase.sourceNodeId,
              sourceStage: sameDevicePublicationStatusBase.sourceStage
            });
            execution.sameDeviceHotBufferSourcePublication = sameDeviceHotBufferSourcePublication;
            execution.sameDeviceRetainedBufferImport = sameDeviceHotBufferSourcePublication?.sameDeviceRetainedBufferImport || null;
            if (execution.finalStep) {
              execution.finalStep.sameDeviceHotBufferSourcePublication = sameDeviceHotBufferSourcePublication;
              execution.finalStep.sameDeviceRetainedBufferImport = execution.sameDeviceRetainedBufferImport;
              if (execution.finalStep.g2pReconstruction && execution.sameDeviceRetainedBufferImport) {
                execution.finalStep.g2pReconstruction.sameDeviceRetainedBufferImport = {
                  ...execution.sameDeviceRetainedBufferImport
                };
                if (execution.finalStep.g2pReconstruction.gpuResult) {
                  execution.finalStep.g2pReconstruction.gpuResult.sameDeviceRetainedBufferImport = {
                    ...execution.sameDeviceRetainedBufferImport
                  };
                }
              }
            }
            scene.userData.mlsMpmResidentSameDeviceHotBufferSourcePublication = sameDeviceHotBufferSourcePublication;
            markResidentStepsProgress('resident-steps-same-device-hot-buffer-source-published', {
              hotBufferKey: sameDeviceHotBufferSourcePublication?.hotBufferKey ?? null,
              sourceTaskId: sameDevicePublicationStatusBase.sourceTaskId
            });
          } catch (error) {
            const failure = {
              ...sameDevicePublicationStatusBase,
              status: 'same-device-hot-buffer-source-publication-failed',
              error: error instanceof Error ? error.message : String(error)
            };
            execution.sameDeviceHotBufferSourcePublication = failure;
            scene.userData.mlsMpmResidentSameDeviceHotBufferSourcePublication = failure;
            markResidentStepsProgress('resident-steps-same-device-hot-buffer-source-publication-failed', {
              error: failure.error
            });
            if (requireSameDeviceHotBufferSourcePublication) throw error;
          }
        } else {
          const skipReason = !sameDevicePublicationStatusBase.publisherAvailable
            ? 'same-device-publisher-unavailable'
            : !sameDevicePublicationStatusBase.computeManagerOwned
            ? 'resident-output-not-compute-manager-owned'
            : !sameDevicePublicationStatusBase.stateManagerCommitAccepted
            ? 'state-manager-commit-not-accepted'
            : !sameDevicePublicationStatusBase.uploadsReady
            ? 'webgpu-output-handles-unavailable'
            : 'same-device-publication-not-required';
          const skipped = {
            ...sameDevicePublicationStatusBase,
            status: 'same-device-hot-buffer-source-publication-skipped',
            reason: skipReason
          };
          execution.sameDeviceHotBufferSourcePublication = skipped;
          scene.userData.mlsMpmResidentSameDeviceHotBufferSourcePublication = skipped;
          if (requireSameDeviceHotBufferSourcePublication) {
            throw new Error(`ComputeManager resident-steps same-device source publication skipped: ${skipReason}`);
          }
        }
        clearMlsMpmResidentExecutionArtifacts({
          preserveBuffers: residentContinuationBuffersFromExecution(execution)
        });
        markResidentStepsProgress('resident-steps-publishing-artifacts', {
          backend: execution?.backend ?? null,
          completedStepCount: execution?.completedStepCount ?? null
        });
        publishMlsMpmResidentStepArtifacts(execution.finalStep, signature, {
          stepsExecution: execution,
          stepsSignature: signature
        });
        markResidentStepsProgress('resident-steps-published', {
          backend: execution?.backend ?? null,
          completedStepCount: execution?.completedStepCount ?? null
        });
        return execution;
      } finally {
        pressureForceRowsBorrow?.release('released-after-mls-mpm-resident-steps-cleanup');
        destroyTemporaryPressureInterfaceForceRowsUpload({
          upload: resolvedPressureForceRowsUpload,
          reason: 'temporary-pressure-interface-force-rows-resident-steps-cleanup'
        });
      }
    })();
    pendingMlsMpmResidentSteps = { signature, promise };
    try {
      const execution = await promise;
      markResidentStepsProgress('resident-steps-complete', {
        backend: execution?.backend ?? null,
        completedStepCount: execution?.completedStepCount ?? null
      });
      return execution;
    } catch (error) {
      markResidentStepsProgress('resident-steps-error', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      if (pendingMlsMpmResidentSteps?.promise === promise) pendingMlsMpmResidentSteps = null;
    }
  }

  function ensureSurface(descriptorOrKey, properties = null, configOverride = null, opticsOverride = null) {
    const descriptor = renderDescriptorOf(descriptorOrKey);
    const key = descriptor.surfaceKey;
    const config = configOverride || SURFACE_CONFIG[descriptor.renderKey] || SURFACE_CONFIG.default;
    const optics = opticsOverride || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const opticalSignature = opticalSignatureForMaterial(optics);
    let surface = surfaces.get(key);
    if (surface) {
      if (
        surface.opticalSignature !== opticalSignature
        || surface.config.resolution !== config.resolution
        || surface.config.isolation !== config.isolation
        || surface.config.subtract !== config.subtract
        || surface.config.maxPolyCount !== config.maxPolyCount
      ) {
        scene.remove(surface.mesh);
        surface.mesh.geometry?.dispose?.();
        surface.mesh.material.dispose();
        surfaces.delete(key);
      } else {
        return surface;
      }
    }
    const mesh = new MarchingCubes(
      config.resolution,
      makeSurfaceMaterial(descriptor, properties, optics),
      false,
      true,
      config.maxPolyCount
    );
    mesh.isolation = config.isolation;
    // Isotropic scale (a single scalar) so metaballs render as spheres, not ellipsoids. With the
    // refEdge-normalized positions above, this maps field-axis [pad, 1-pad] onto world [0, refEdge];
    // a particle at box-axis coordinate L lands at world L because L/refEdge ≤ 1. Position is
    // refEdge/2 on every axis (the field origin maps to world 0 on each axis).
    mesh.scale.setScalar(refEdgeM / (2 * (1 - 2 * FIELD_PADDING)));
    mesh.position.set(refEdgeM / 2, refEdgeM / 2, refEdgeM / 2);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.userData.renderMode = SPH_PHASE_RENDER_MODE;
    mesh.userData.materialKey = descriptor.material;
    mesh.userData.renderKey = descriptor.renderKey;
    mesh.userData.phase = descriptor.phase;
    mesh.userData.optical = mesh.material.userData.optical;
    applySurfaceRenderOrdering(mesh, mesh.material.userData.optical, descriptor);
    scene.add(mesh);
    surface = { mesh, config, properties, descriptor, opticalSignature, inactiveFrameCount: 0 };
    surfaces.set(key, surface);
    return surface;
  }

  function clampSurfaceMeshToWorldBounds(mesh, {
    minWorld,
    maxWorld,
    insideStatus = 'inside-bounds',
    clippedStatus = 'clipped-to-bounds'
  } = {}) {
    const geometry = mesh?.geometry;
    const position = geometry?.attributes?.position;
    const array = position?.array;
    if (!array || !position.count) {
      return { status: 'clip-unavailable', clampedVertexCount: 0 };
    }
    const drawStart = Math.max(0, Math.round(Number(geometry.drawRange?.start) || 0));
    const rawDrawCount = Number(geometry.drawRange?.count);
    const drawCount = Number.isFinite(rawDrawCount) && rawDrawCount >= 0
      ? Math.min(position.count - drawStart, Math.round(rawDrawCount))
      : position.count - drawStart;
    const drawEnd = Math.min(position.count, drawStart + Math.max(0, drawCount));
    if (drawEnd <= drawStart) {
      return { status: insideStatus, clampedVertexCount: 0 };
    }
    const span = Math.max(1e-12, 1 - 2 * FIELD_PADDING);
    const localScaleM = refEdgeM / (2 * span);
    const minLocal = minWorld.map((value) => (value - refEdgeM / 2) / localScaleM);
    const maxLocal = maxWorld.map((value) => (value - refEdgeM / 2) / localScaleM);
    const itemSize = position.itemSize || 3;
    let clampedVertexCount = 0;
    for (let vertexIndex = drawStart; vertexIndex < drawEnd; vertexIndex += 1) {
      const offset = vertexIndex * itemSize;
      let clamped = false;
      for (let axis = 0; axis < 3; axis += 1) {
        const source = array[offset + axis];
        const next = clamp(source, minLocal[axis], maxLocal[axis]);
        if (next !== source) {
          array[offset + axis] = next;
          clamped = true;
        }
      }
      if (clamped) clampedVertexCount += 1;
    }
    if (clampedVertexCount > 0) {
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals?.();
      mesh.geometry.computeBoundingBox?.();
      mesh.geometry.computeBoundingSphere?.();
    }
    const status = clampedVertexCount > 0 ? clippedStatus : insideStatus;
    return { status, clampedVertexCount };
  }

  function clampSurfaceMeshToContainer(mesh) {
    const result = clampSurfaceMeshToWorldBounds(mesh, {
      minWorld: dims.map(() => 0),
      maxWorld: dims,
      insideStatus: 'inside-container',
      clippedStatus: 'clipped-to-container'
    });
    mesh.userData.surfaceBoxClipStatus = result.status;
    mesh.userData.surfaceBoxClipVertexCount = result.clampedVertexCount;
    return result;
  }

  function finiteSurfaceBounds(bounds = null) {
    if (!bounds?.min || !bounds?.max) return null;
    const min = bounds.min.map(Number);
    const max = bounds.max.map(Number);
    if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
    return { min, max };
  }

  function surfaceMeshWorldBounds(mesh) {
    const geometry = mesh?.geometry;
    const position = geometry?.attributes?.position;
    const array = position?.array;
    if (!array || !position.count) return null;
    const drawStart = Math.max(0, Math.round(Number(geometry.drawRange?.start) || 0));
    const rawDrawCount = Number(geometry.drawRange?.count);
    const drawCount = Number.isFinite(rawDrawCount) && rawDrawCount >= 0
      ? Math.min(position.count - drawStart, Math.round(rawDrawCount))
      : position.count - drawStart;
    const drawEnd = Math.min(position.count, drawStart + Math.max(0, drawCount));
    if (drawEnd <= drawStart) return null;
    const span = Math.max(1e-12, 1 - 2 * FIELD_PADDING);
    const localScaleM = refEdgeM / (2 * span);
    const itemSize = position.itemSize || 3;
    const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (let vertexIndex = drawStart; vertexIndex < drawEnd; vertexIndex += 1) {
      const offset = vertexIndex * itemSize;
      for (let axis = 0; axis < 3; axis += 1) {
        const world = array[offset + axis] * localScaleM + refEdgeM / 2;
        if (!Number.isFinite(world)) continue;
        if (world < min[axis]) min[axis] = world;
        if (world > max[axis]) max[axis] = world;
      }
    }
    if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
    return { min, max, vertexCount: drawEnd - drawStart };
  }

  function retainedSurfaceMeshBoundsStatus(mesh, clip = null) {
    const bounds = finiteSurfaceBounds(clip?.bounds);
    const paddingM = Number(clip?.paddingM);
    if (!bounds || !Number.isFinite(paddingM)) {
      return {
        status: 'retention-surface-bounds-unavailable',
        within: true,
        maxOutsideM: 0,
        meshBounds: null
      };
    }
    const meshBounds = surfaceMeshWorldBounds(mesh);
    if (!meshBounds) {
      return {
        status: 'retention-mesh-bounds-unavailable',
        within: false,
        maxOutsideM: Number.POSITIVE_INFINITY,
        meshBounds: null
      };
    }
    const slackM = Math.max(0.005, paddingM * 0.1);
    const expandedPaddingM = paddingM + slackM;
    let maxOutsideM = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      maxOutsideM = Math.max(maxOutsideM, bounds.min[axis] - expandedPaddingM - meshBounds.min[axis]);
      maxOutsideM = Math.max(maxOutsideM, meshBounds.max[axis] - (bounds.max[axis] + expandedPaddingM));
    }
    return {
      status: maxOutsideM > 0 ? 'retention-mesh-outside-current-surface-bounds' : 'retention-mesh-inside-current-surface-bounds',
      within: !(maxOutsideM > 0),
      maxOutsideM: Number.isFinite(maxOutsideM) ? maxOutsideM : 0,
      meshBounds,
      paddingM,
      slackM
    };
  }

  function surfaceBoundsPaddingMForBatch(batch) {
    const radius = surfaceRadiusMForBatch(batch);
    return clamp(radius * 3, 0.04, 0.15);
  }

  function clampSurfaceMeshToSurfaceBounds(mesh, clip = null) {
    const bounds = finiteSurfaceBounds(clip?.bounds);
    const paddingM = Number(clip?.paddingM);
    if (!bounds || !Number.isFinite(paddingM)) {
      mesh.userData.surfaceBoundsClipStatus = 'surface-bounds-clip-unavailable';
      mesh.userData.surfaceBoundsClipVertexCount = 0;
      mesh.userData.surfaceBoundsClipPaddingM = null;
      return { status: 'surface-bounds-clip-unavailable', clampedVertexCount: 0 };
    }
    const result = clampSurfaceMeshToWorldBounds(mesh, {
      minWorld: bounds.min.map((value) => value - paddingM),
      maxWorld: bounds.max.map((value) => value + paddingM),
      insideStatus: 'inside-surface-bounds',
      clippedStatus: 'clipped-to-surface-bounds'
    });
    mesh.userData.surfaceBoundsClipStatus = result.status;
    mesh.userData.surfaceBoundsClipVertexCount = result.clampedVertexCount;
    mesh.userData.surfaceBoundsClipPaddingM = paddingM;
    return result;
  }

  function markCurrentRenderFieldSurfaceBoundsDiagnostic(mesh, clip = null) {
    const paddingM = Number(clip?.paddingM);
    mesh.userData.surfaceBoundsClipStatus = 'surface-bounds-diagnostic-current-render-field';
    mesh.userData.surfaceBoundsClipVertexCount = 0;
    mesh.userData.surfaceBoundsClipPaddingM = Number.isFinite(paddingM) ? paddingM : null;
    return { status: mesh.userData.surfaceBoundsClipStatus, clampedVertexCount: 0 };
  }

  function rebuildOpticalStateForSurfaceBatches(batches, { materialProperties = null } = {}) {
    opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, batches);
    opticalGpuLookupGeneration += 1;
    scene.userData.opticalGpuTable = opticalGpuTable;
    scene.userData.opticalGpuLookup = opticalGpuLookup;
    scene.userData.opticalGpuLookupExecution = null;
    scene.userData.opticalGpuLookupDrawState = null;
  }

  function opticalTableCoversSurfaceBatches(table, batches = []) {
    if (!table?.schema || !Array.isArray(table.recordMetadata)) return false;
    const available = new Set(table.recordMetadata.map((record) => opticalCoverageKey(record)));
    return batches.every((batch) => available.has(opticalCoverageKey({
      material: batch.material,
      phase: batch.phase,
      opticalStateKey: batch.descriptor?.opticalStateKey,
      opticalState: batch.descriptor?.opticalState
    })));
  }

  function rebuildOpticalStateForSurfaceBatchesWithCache(batches, {
    materialProperties = currentMaterialProperties,
    cachedOpticalGpuTable = null
  } = {}) {
    if (opticalTableCoversSurfaceBatches(cachedOpticalGpuTable, batches)) {
      opticalGpuTable = {
        ...cachedOpticalGpuTable,
        status: 'static-table-cache-hit'
      };
    } else {
      opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    }
    opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, batches);
    opticalGpuLookupGeneration += 1;
    scene.userData.opticalGpuTable = opticalGpuTable;
    scene.userData.opticalGpuLookup = opticalGpuLookup;
    scene.userData.opticalGpuLookupExecution = null;
    scene.userData.opticalGpuLookupDrawState = null;
  }

  function applySurfaceBatches(batches, {
    emissiveByMaterial = null,
    materialProperties = null,
    renderSource = 'cpu-particles',
    renderRowsExecution = null
  } = {}) {
    releaseThreeSurfaceSuppression(renderSource);
    const applyStartMs = nowMs();
    const details = [];
    const totals = {
      ensureSurfaceMs: 0,
      materialMs: 0,
      resetMs: 0,
      addBallMs: 0,
      updateMs: 0,
      hideInactiveMs: 0
    };
    const addTiming = (field, startMs) => {
      const elapsed = Math.max(0, nowMs() - startMs);
      totals[field] += elapsed;
      return elapsed;
    };
    const activeKeys = new Set();
    const gpuRecordsBySurface = new Map(opticalGpuTable.recordMetadata.map((record) => [
      opticalCoverageKey(record),
      record
    ]));
    for (const batch of batches) {
      scheduleEnvironmentMap();
      const properties = materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties);
      const cachedOptics = opticalParamsFromGpuTableRecord(opticalGpuTable, batch.descriptor);
      const surfaceConfig = adaptiveCpuSurfaceConfig(
        SURFACE_CONFIG[batch.renderKey] || SURFACE_CONFIG.default,
        batch.count
      );
      const ensureStartMs = nowMs();
      const surface = ensureSurface(batch.descriptor, properties, surfaceConfig, cachedOptics);
      const ensureSurfaceMs = addTiming('ensureSurfaceMs', ensureStartMs);
      const { mesh, config } = surface;
      const materialStartMs = nowMs();
      mesh.userData.optical = mesh.material.userData.optical;
      mesh.userData.materialKey = batch.material;
      mesh.userData.renderKey = batch.renderKey;
      mesh.userData.phase = batch.phase;
      mesh.userData.renderSource = renderSource;
      mesh.userData.renderRowsExecutionSchema = renderRowsExecution?.schema || null;
      mesh.userData.renderRowsBackend = renderRowsExecution?.backend || null;
      mesh.userData.cpuSurfaceRetainedByGrace = false;
      mesh.userData.cpuSurfaceRetainRejectedReason = null;
      mesh.userData.opticalState = batch.descriptor?.opticalState || null;
      mesh.userData.opticalStateKey = batch.descriptor?.opticalStateKey || 'default';
      mesh.userData.renderDomainId = normalizeRenderDomainId(batch.descriptor?.renderDomainId ?? batch.renderDomainId);
      mesh.userData.renderDomainKey = batch.descriptor?.renderDomainKey ?? batch.renderDomainKey ?? null;
      mesh.userData.opticalGpuRecord = gpuRecordsBySurface.get(opticalCoverageKey({
        material: batch.material,
        phase: batch.phase,
        opticalStateKey: batch.descriptor?.opticalStateKey,
        opticalState: batch.descriptor?.opticalState
      })) || null;
      const opticalVisibility = resolveOpticalSurfaceVisibility({
        optics: mesh.material.userData.optical,
        descriptorOrRow: batch.descriptor,
        wasVisible: Boolean(mesh.visible)
      });
      mesh.userData.opticalSurfaceVisibility = opticalVisibility;
      const emissive = emissiveByMaterial?.[batch.material] ?? emissiveByMaterial?.[batch.renderKey] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      const materialMs = addTiming('materialMs', materialStartMs);
      if (!opticalVisibility.visible) {
        const hideStartMs = nowMs();
        const hidden = hideSurfaceAfterGrace(surface, renderSource);
        addTiming('hideInactiveMs', hideStartMs);
        mesh.userData.opticalSurfaceHiddenReason = opticalVisibility.reason;
        mesh.userData.opticalSurfaceRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        mesh.userData.particleCount = batch.count;
        mesh.userData.surfaceRadiusM = 0;
        mesh.userData.cpuMarchingCubesCellSizeM = null;
        mesh.userData.surfaceResolution = mesh.resolution || config.resolution;
        mesh.userData.surfaceMaxPolyCount = config.maxPolyCount;
        activeKeys.add(batch.surfaceKey);
        details.push({
          surfaceKey: batch.surfaceKey,
          material: batch.material,
          renderKey: batch.renderKey,
          phase: batch.phase,
          particleCount: batch.count,
          resolution: mesh.resolution || config.resolution,
          maxPolyCount: config.maxPolyCount,
          opticalSource: cachedOptics?.source || 'cpu-optical-render-params',
          opticalSurfaceVisibility: opticalVisibility.reason,
          ensureSurfaceMs,
          materialMs,
          resetMs: 0,
          addBallMs: 0,
          updateMs: 0
        });
        continue;
      }
      mesh.userData.opticalSurfaceHiddenReason = null;
      mesh.userData.opticalSurfaceRetainedByGrace = false;
      const resetStartMs = nowMs();
      mesh.isolation = config.isolation;
      mesh.reset();
      const resetMs = addTiming('resetMs', resetStartMs);
      // Isosurface (blob) size is decoupled from the container: the auto estimate (from particle
      // spacing) or an explicit override is multiplied by a user-set scale, independent of box size.
      const radiusInfo = cpuSurfaceRadiusForBatch(batch, config);
      const radiusM = radiusInfo.radiusM;
      const radiusNorm = normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM);
      const strength = (mesh.isolation + config.subtract) * radiusNorm * radiusNorm;
      const addBallStartMs = nowMs();
      for (let i = 0; i < batch.count; i += 1) {
        mesh.addBall(
          batch.normalizedPositions[i * 3],
          batch.normalizedPositions[i * 3 + 1],
          batch.normalizedPositions[i * 3 + 2],
          strength,
          config.subtract,
          [
            batch.colorsRgb[i * 3],
            batch.colorsRgb[i * 3 + 1],
            batch.colorsRgb[i * 3 + 2]
          ]
        );
      }
      const addBallMs = addTiming('addBallMs', addBallStartMs);
      const updateStartMs = nowMs();
      mesh.update();
      const surfaceClip = clampSurfaceMeshToContainer(mesh);
      const updateMs = addTiming('updateMs', updateStartMs);
      mesh.visible = batch.count > 0;
      mesh.userData.particleCount = batch.count;
      mesh.userData.surfaceRadiusM = radiusM;
      mesh.userData.requestedSurfaceRadiusM = radiusInfo.requestedRadiusM;
      mesh.userData.cpuMarchingCubesRadiusFloorM = radiusInfo.floorRadiusM;
      mesh.userData.cpuMarchingCubesCellSizeM = radiusInfo.cellSizeM;
      mesh.userData.cpuMarchingCubesRadiusFloorApplied = radiusInfo.floorApplied;
      mesh.userData.surfaceResolution = mesh.resolution || config.resolution;
      mesh.userData.surfaceMaxPolyCount = config.maxPolyCount;
      markSurfaceActive(surface);
      activeKeys.add(batch.surfaceKey);
      details.push({
        surfaceKey: batch.surfaceKey,
        material: batch.material,
        renderKey: batch.renderKey,
        phase: batch.phase,
        particleCount: batch.count,
        resolution: mesh.resolution || config.resolution,
        maxPolyCount: config.maxPolyCount,
        opticalSource: cachedOptics?.source || 'cpu-optical-render-params',
        opticalSurfaceVisibility: opticalVisibility.reason,
        ensureSurfaceMs,
        materialMs,
        resetMs,
        addBallMs,
        updateMs,
        requestedSurfaceRadiusM: radiusInfo.requestedRadiusM,
        cpuMarchingCubesRadiusFloorM: radiusInfo.floorRadiusM,
        cpuMarchingCubesCellSizeM: radiusInfo.cellSizeM,
        cpuMarchingCubesRadiusFloorApplied: radiusInfo.floorApplied,
        surfaceBoxClipStatus: surfaceClip.status,
        surfaceBoxClipVertexCount: surfaceClip.clampedVertexCount
      });
    }
    for (const [key, surface] of surfaces) {
      if (!activeKeys.has(key)) {
        if (batches.length === 0 && renderSource === 'cpu-particles') {
          surface.mesh.userData.renderSource = renderSource;
          surface.mesh.userData.cpuSurfaceRetainedByGrace = surface.mesh.visible === true;
          surface.mesh.userData.cpuSurfaceRetainRejectedReason = 'cpu-surface-batches-empty-retained';
          continue;
        }
        const hideStartMs = nowMs();
        const immediateHide = renderSource === 'cpu-particles';
        const hidden = hideSurfaceAfterGrace(surface, renderSource, { immediate: immediateHide });
        if (renderSource === 'cpu-particles') {
          surface.mesh.userData.cpuSurfaceRetainedByGrace = !hidden;
          surface.mesh.userData.cpuSurfaceRetainRejectedReason = hidden
            ? 'cpu-surface-batch-absent'
            : null;
        }
        addTiming('hideInactiveMs', hideStartMs);
      }
    }
    scene.userData.sphSurfaceApplyTiming = {
      schema: 'peercompute.ulg.sph-surface-apply-timing.v0',
      totalMs: Math.max(0, nowMs() - applyStartMs),
      totals,
      details,
      surfaceCount: details.length,
      renderSource,
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
  }

  function averageBatchColor(batch) {
    if (!batch?.colorsRgb?.length || !batch.count) return [1, 1, 1];
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < batch.count; i += 1) {
      r += batch.colorsRgb[i * 3];
      g += batch.colorsRgb[i * 3 + 1];
      b += batch.colorsRgb[i * 3 + 2];
    }
    return [r / batch.count, g / batch.count, b / batch.count].map((value) => clamp(value, 0, 1));
  }

  function surfaceRadiusMForBatch(batch) {
    const explicitSurfaceRadius = Number.isFinite(surfaceRadiusM);
    const baseRadiusM = explicitSurfaceRadius ? surfaceRadiusM : batch.surfaceRadiusM;
    return baseRadiusM * surfaceRadiusScaleForRenderBatch(batch, radiusScale, {
      explicitSurfaceRadius
    });
  }

  function cpuSurfaceRadiusForBatch(batch, config) {
    const requestedRadiusM = surfaceRadiusMForBatch(batch);
    const resolution = config?.resolution ?? SURFACE_CONFIG.default.resolution;
    const floorRadiusM = cpuMarchingCubesRadiusFloorM(refEdgeM, resolution);
    const cellSizeM = cpuMarchingCubesCellSizeM(refEdgeM, resolution);
    const radiusM = Math.max(requestedRadiusM, floorRadiusM);
    return {
      requestedRadiusM,
      floorRadiusM,
      cellSizeM,
      radiusM,
      floorApplied: radiusM > requestedRadiusM + 1e-12
    };
  }

  function diagnosticRenderFieldResolutionForBudget(surfaceCount, {
    maxFieldCells = SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT,
    maxResolution = SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT
  } = {}) {
    const count = Math.max(1, Math.round(Number(surfaceCount) || 1));
    const budget = Math.max(1, Math.round(Number(maxFieldCells) || SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT));
    const budgetResolution = Math.max(2, Math.floor(Math.cbrt(Math.max(1, budget / count))));
    const requestedMax = Math.max(2, Math.round(Number(maxResolution) || SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT));
    return Math.max(2, Math.min(requestedMax, budgetResolution, RESIDENT_RENDER_FIELD_MAX_RESOLUTION));
  }

  function createRenderFieldSurfaceTableForBatches(batches, {
    maxResolution = RESIDENT_RENDER_FIELD_MAX_RESOLUTION
  } = {}) {
    const resolvedMaxResolution = Math.max(2, Math.round(Number(maxResolution) || RESIDENT_RENDER_FIELD_MAX_RESOLUTION));
    const descriptors = batches.map((batch) => {
      const baseConfig = SURFACE_CONFIG[batch.renderKey] || SURFACE_CONFIG.default;
      const config = adaptiveCpuSurfaceConfig(baseConfig, batch.count);
      const needsAliasSafeRenderField = batch.count > 0 && (
        batch.count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES
        || batch.source === 'merged-same-material-phase-render-surface'
      );
      const renderFieldResolution = needsAliasSafeRenderField
        ? Math.max(baseConfig.resolution, SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN)
        : baseConfig.resolution;
      const radiusM = surfaceRadiusMForBatch(batch);
      const radiusNorm = normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM);
      const properties = materialPropertiesForSurfaceDescriptor(batch.descriptor, currentMaterialProperties);
      const optics = opticalParamsFromGpuTableRecord(opticalGpuTable, batch.descriptor)
        || opticalRenderParams(opticalQueryForDescriptor(batch.descriptor, properties));
      const renderLayer = renderLayerFromOpticalResponse(optics, batch.descriptor);
      const renderOrder = renderOrderFromOpticalResponse(optics, batch.descriptor);
      const depthWriteFlag = renderDepthWriteFromOpticalResponse(optics, batch.descriptor) ? 1 : 0;
      const transparencyClassId = renderLayer === 'vapor-surface'
        ? 3
        : (renderLayer === 'transmissive-surface'
          ? 2
          : (renderLayer === 'alpha-surface' ? 1 : 0));
      return {
        surfaceKey: batch.surfaceKey,
        material: batch.material,
        phase: batch.phase,
        opticalState: batch.descriptor?.opticalState || null,
        opticalStateKey: batch.descriptor?.opticalStateKey || 'default',
        renderDomainId: normalizeRenderDomainId(batch.descriptor?.renderDomainId ?? batch.renderDomainId),
        renderDomainKey: batch.descriptor?.renderDomainKey ?? batch.renderDomainKey ?? null,
        renderLayer,
        renderOrder,
        depthWriteFlag,
        transparencyClassId,
        renderKey: batch.renderKey,
        resolution: Math.min(renderFieldResolution, RESIDENT_RENDER_FIELD_MAX_RESOLUTION, resolvedMaxResolution),
        isolation: config.isolation,
        subtract: config.subtract,
        radiusNorm,
        strength: (config.isolation + config.subtract) * radiusNorm * radiusNorm,
        colorLinear: averageBatchColor(batch),
        status: 1
      };
    });
    return buildSphRenderFieldSurfaceTable(descriptors);
  }

  function materialKeysFromReactionTable(reactionTable = null) {
    const keys = new Set();
    for (const record of reactionTable?.metadata || []) {
      for (const key of [record.a, record.b, record.product]) {
        if (key) keys.add(key);
      }
      for (const term of record.productTerms || []) {
        if (term.material) keys.add(term.material);
      }
      for (const term of record.reactantTerms || []) {
        if (term.material) keys.add(term.material);
      }
    }
    for (const term of reactionTable?.productTermMetadata || []) {
      if (term.material) keys.add(term.material);
    }
    for (const term of reactionTable?.reactantTermMetadata || []) {
      if (term.material) keys.add(term.material);
    }
    return keys;
  }

  function summarizeDecodedRenderRows(decoded = null) {
    if (!Array.isArray(decoded?.rows) || decoded.rows.length === 0) return null;
    const materialPhaseCounts = {};
    const materialPhaseDomainCounts = {};
    const materialPhaseDomainBounds = {};
    const positionBoundsM = {
      status: 'position-bounds-ready',
      count: 0,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity]
    };
    const positionSumM = [0, 0, 0];
    const massWeightedPositionSumM = [0, 0, 0];
    let positionCount = 0;
    let totalMassKg = 0;
    let minParticleRadiusM = Number.POSITIVE_INFINITY;
    let maxParticleRadiusM = Number.NEGATIVE_INFINITY;
    for (const row of decoded.rows) {
      const key = `${row.material ?? 'unknown'}|${row.phase ?? 'unknown'}`;
      materialPhaseCounts[key] = (materialPhaseCounts[key] || 0) + 1;
      const domainKey = `${key}|domain:${row.renderDomainKey ?? row.renderDomainId ?? 0}`;
      materialPhaseDomainCounts[domainKey] = (materialPhaseDomainCounts[domainKey] || 0) + 1;
      const position = row.positionM;
      if (Array.isArray(position) && position.length >= 3) {
        const finitePositionM = [
          Number(position[0]),
          Number(position[1]),
          Number(position[2])
        ];
        const hasFinitePosition = finitePositionM.every(Number.isFinite);
        const bounds = materialPhaseDomainBounds[domainKey] || (materialPhaseDomainBounds[domainKey] = {
          status: 'position-bounds-ready',
          count: 0,
          min: [Infinity, Infinity, Infinity],
          max: [-Infinity, -Infinity, -Infinity]
        });
        bounds.count += 1;
        for (let axis = 0; axis < 3; axis += 1) {
          const value = Number(position[axis]);
          if (!Number.isFinite(value)) continue;
          bounds.min[axis] = Math.min(bounds.min[axis], value);
          bounds.max[axis] = Math.max(bounds.max[axis], value);
        }
        if (hasFinitePosition) {
          positionCount += 1;
          positionBoundsM.count += 1;
          for (let axis = 0; axis < 3; axis += 1) {
            const value = finitePositionM[axis];
            positionSumM[axis] += value;
            positionBoundsM.min[axis] = Math.min(positionBoundsM.min[axis], value);
            positionBoundsM.max[axis] = Math.max(positionBoundsM.max[axis], value);
          }
          const massKg = Number(row.massKg);
          if (Number.isFinite(massKg) && massKg > 0) {
            totalMassKg += massKg;
            for (let axis = 0; axis < 3; axis += 1) {
              massWeightedPositionSumM[axis] += finitePositionM[axis] * massKg;
            }
          }
        }
      }
      const particleRadiusM = Number(row.particleRadiusM);
      if (Number.isFinite(particleRadiusM) && particleRadiusM > 0) {
        minParticleRadiusM = Math.min(minParticleRadiusM, particleRadiusM);
        maxParticleRadiusM = Math.max(maxParticleRadiusM, particleRadiusM);
      }
    }
    for (const bounds of Object.values(materialPhaseDomainBounds)) {
      bounds.size = bounds.max.map((value, axis) => value - bounds.min[axis]);
    }
    if (positionBoundsM.count > 0) {
      positionBoundsM.size = positionBoundsM.max.map((value, axis) => value - positionBoundsM.min[axis]);
    }
    const centerOfMassM = totalMassKg > 0
      ? massWeightedPositionSumM.map((value) => value / totalMassKg)
      : (positionCount > 0 ? positionSumM.map((value) => value / positionCount) : null);
    const sampleRows = decoded.rows.length <= 12
      ? decoded.rows
      : [...decoded.rows.slice(0, 6), ...decoded.rows.slice(-6)];
    return {
      schema: 'peercompute.ulg.sph-render-row-decoded-summary.v0',
      particleCount: decoded.rows.length,
      positionCount,
      totalMassKg: totalMassKg > 0 ? totalMassKg : null,
      centerOfMassM,
      positionBoundsM: positionBoundsM.count > 0 ? positionBoundsM : null,
      materialPhaseCounts,
      materialPhaseDomainCounts,
      materialPhaseDomainBounds,
      minParticleRadiusM: Number.isFinite(minParticleRadiusM) ? minParticleRadiusM : null,
      maxParticleRadiusM: Number.isFinite(maxParticleRadiusM) ? maxParticleRadiusM : null,
      sampleRows: sampleRows.map((row) => ({
        index: row.index,
        materialId: row.materialId,
        material: row.material,
        phaseId: row.phaseId,
        phase: row.phase,
        renderDomainId: row.renderDomainId,
        renderDomainKey: row.renderDomainKey,
        temperatureK: row.temperatureK,
        particleRadiusM: row.particleRadiusM,
        volumeRatioJ: row.volumeRatioJ,
        pressurePa: row.pressurePa,
        status: row.status,
        positionM: row.positionM
      }))
    };
  }

  function summarizeRenderFieldCpuParity({ renderRowsExecution, renderFieldExecution, surfaceTable }) {
    if (
      !(renderRowsExecution?.renderRows instanceof Float32Array)
      || !(renderFieldExecution?.fieldRows instanceof Float32Array)
      || renderRowsExecution.renderRows.length === 0
      || renderFieldExecution.fieldRows.length === 0
      || !surfaceTable?.schema
    ) {
      return null;
    }
    const cpuField = buildSphRenderFieldCpu({
      renderRows: renderRowsExecution.renderRows,
      productEventRows: renderFieldExecution.productEventRows || null,
      surfaceTable,
      particleCount: renderRowsExecution.particleCount,
      productEventCount: renderFieldExecution.productEventCount,
      fieldPadding: FIELD_PADDING,
      refEdgeM
    });
    const cpuSurfaces = splitSphRenderFieldBySurface(cpuField);
    const gpuSurfaces = splitSphRenderFieldBySurface(renderFieldExecution);
    const surfaces = cpuSurfaces.map((cpuSurface, index) => {
      const gpuSurface = gpuSurfaces[index];
      let cpuMaxDensity = 0;
      let gpuMaxDensity = 0;
      for (const value of cpuSurface.field) if (value > cpuMaxDensity) cpuMaxDensity = value;
      for (const value of gpuSurface?.field || []) if (value > gpuMaxDensity) gpuMaxDensity = value;
      return {
        surfaceKey: cpuSurface.surfaceKey,
        material: cpuSurface.material,
        phase: cpuSurface.phase,
        renderDomainId: cpuSurface.renderDomainId,
        renderDomainKey: cpuSurface.renderDomainKey,
        resolution: cpuSurface.resolution,
        isolation: cpuSurface.isolation,
        subtract: cpuSurface.subtract,
        radiusNorm: cpuSurface.radiusNorm,
        strength: cpuSurface.strength,
        cpuMaxDensity,
        gpuMaxDensity,
        maxDensityDelta: Math.abs(cpuMaxDensity - gpuMaxDensity)
      };
    });
    return {
      schema: 'peercompute.ulg.sph-render-field-cpu-parity-summary.v0',
      status: 'render-field-cpu-parity-summarized',
      surfaceCount: surfaces.length,
      maxDensityDelta: surfaces.reduce((max, surface) => Math.max(max, surface.maxDensityDelta), 0),
      surfaces
    };
  }

  function colorForResidentSurfaceDescriptor(descriptor, materialProperties) {
    const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    return optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  }

  function createResidentRenderSurfaceBatches({
    particleBatches = [],
    productEventSurfaceBatches = [],
    materialProperties = null,
    reactionTable = null,
    smoothingLengthM = null
  } = {}) {
    const batchesByKey = new Map();
    const countByMaterial = new Map();
    const radiusByMaterial = new Map();
    const presentMaterialPhaseKeys = new Set();
    const materials = materialKeysFromReactionTable(reactionTable);
    const renderBatches = mergeSameMaterialPhaseSurfaceBatchesForRenderField([
      ...particleBatches,
      ...productEventSurfaceBatches
    ]);
    for (const batch of renderBatches) {
      if (!batch?.surfaceKey) continue;
      batchesByKey.set(batch.surfaceKey, batch);
      if (batch.material) {
        materials.add(batch.material);
        if (batch.phase) presentMaterialPhaseKeys.add(`${batch.material}|${batch.phase}`);
        countByMaterial.set(batch.material, Math.max(
          countByMaterial.get(batch.material) || 0,
          Math.max(0, Math.round(Number(batch.count) || 0))
        ));
        if (Number.isFinite(batch.surfaceRadiusM) && batch.surfaceRadiusM > 0) {
          radiusByMaterial.set(batch.material, batch.surfaceRadiusM);
        }
      }
    }
    for (const material of materials) {
      const properties = materialPropertiesLookup(material, materialProperties);
      const phases = Array.isArray(properties?.phases) ? properties.phases : [];
      for (const phaseRecord of phases) {
        const phase = phaseRecord?.name;
        if (!phase) continue;
        if (presentMaterialPhaseKeys.has(`${material}|${phase}`)) continue;
        const renderKey = renderKeyForMaterialPhase(material, phase);
        const descriptor = renderDescriptorOf({ material, phase, renderKey });
        if (batchesByKey.has(descriptor.surfaceKey)) continue;
        const count = Math.max(1, countByMaterial.get(material) || 0);
        const color = colorForResidentSurfaceDescriptor(descriptor, materialProperties);
        const colorsRgb = [];
        for (let i = 0; i < count; i += 1) {
          colorsRgb.push(
            clamp(color[0] ?? 1, 0, 1),
            clamp(color[1] ?? 1, 0, 1),
            clamp(color[2] ?? 1, 0, 1)
          );
        }
        batchesByKey.set(descriptor.surfaceKey, {
          surfaceKey: descriptor.surfaceKey,
          renderKey,
          material,
          phase,
          opticalState: descriptor.opticalState,
          opticalStateKey: descriptor.opticalStateKey,
          renderDomainId: descriptor.renderDomainId,
          renderDomainKey: descriptor.renderDomainKey,
          descriptor,
          positionsM: [],
          normalizedPositions: [],
          colorsRgb,
          bounds: emptyBounds(),
          count,
          surfaceRadiusM: radiusByMaterial.get(material)
            ?? ((Number.isFinite(smoothingLengthM) && smoothingLengthM > 0) ? smoothingLengthM : 0.25),
          source: 'resident-known-phase-surface'
        });
      }
    }
    return [...batchesByKey.values()];
  }

  function captureResidentRenderSurfaceState({
    particleBatches = [],
    fieldBatches = [],
    emissiveByMaterial = null,
    materialProperties = null
  } = {}) {
    const surfaceTable = createRenderFieldSurfaceTableForBatches(fieldBatches);
    sphResidentRenderSurfaceState = {
      schema: 'peercompute.ulg.sph-resident-render-surface-state.v0',
      status: 'resident-render-surface-table-ready',
      particleBatches,
      fieldBatches,
      surfaceTable,
      emissiveByMaterial,
      materialCount: materialProperties ? Object.keys(materialProperties).length : 0,
      surfaceCount: fieldBatches.length,
      surfaceTableSurfaceCount: surfaceTable.surfaceCount,
      surfaceTableTotalFieldCells: surfaceTable.totalFieldCells,
      materialKeys: [...new Set(fieldBatches.map((batch) => batch.material))],
      phaseKeys: [...new Set(fieldBatches.map((batch) => batch.phase))],
      signature: residentSurfaceBatchIdentitySignature(fieldBatches),
      readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    scene.userData.sphResidentRenderSurfaceState = sphResidentRenderSurfaceState;
    return sphResidentRenderSurfaceState;
  }

  function captureSkippedResidentRenderSurfaceState({
    status = 'resident-render-surface-table-skipped',
    reason = null,
    emissiveByMaterial = null,
    materialProperties = null
  } = {}) {
    const surfaceTable = {
      schema: 'peercompute.ulg.sph-render-surface-table.v0',
      status,
      reason,
      surfaceCount: 0,
      totalFieldCells: 0,
      maxFieldCellCount: 0,
      metadata: [],
      records: new Float32Array()
    };
    sphResidentRenderSurfaceState = {
      schema: 'peercompute.ulg.sph-resident-render-surface-state.v0',
      status,
      reason,
      particleBatches: [],
      fieldBatches: [],
      surfaceTable,
      emissiveByMaterial,
      materialCount: materialProperties ? Object.keys(materialProperties).length : 0,
      surfaceCount: 0,
      surfaceTableSurfaceCount: 0,
      surfaceTableTotalFieldCells: 0,
      materialKeys: [],
      phaseKeys: [],
      signature: 'empty',
      readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    scene.userData.sphResidentRenderSurfaceState = sphResidentRenderSurfaceState;
    return sphResidentRenderSurfaceState;
  }

  function applySurfaceFields(surfaceFields, {
    emissiveByMaterial = null,
    materialProperties = null,
    renderSource = 'resident-gpu-render-field',
    renderRowsExecution = null,
    renderFieldExecution = null,
    surfaceBoundsByKey = null
  } = {}) {
    releaseThreeSurfaceSuppression(renderSource);
    const activeKeys = new Set();
    const gpuRecordsBySurface = new Map(opticalGpuTable.recordMetadata.map((record) => [
      opticalCoverageKey(record),
      record
    ]));
    const authoritativeSurfaceFieldRows = surfaceFields.length > 0
      || renderSource !== 'resident-gpu-render-field'
      || Boolean(renderFieldExecution?.renderFieldReadback);
    for (const fieldSurface of surfaceFields) {
      scheduleEnvironmentMap();
      const descriptor = renderDescriptorOf({
        material: fieldSurface.material,
        phase: fieldSurface.phase,
        renderKey: fieldSurface.renderKey,
        opticalState: fieldSurface.opticalState || null,
        renderDomainId: fieldSurface.renderDomainId,
        renderDomainKey: fieldSurface.renderDomainKey
      });
      const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
      const baseConfig = SURFACE_CONFIG[descriptor.renderKey] || SURFACE_CONFIG.default;
      const cachedOptics = opticalParamsFromGpuTableRecord(opticalGpuTable, descriptor);
      const surface = ensureSurface(descriptor, properties, {
        ...baseConfig,
        resolution: fieldSurface.resolution
      }, cachedOptics);
      const { mesh } = surface;
      if (mesh.field.length !== fieldSurface.field.length || mesh.palette.length !== fieldSurface.palette.length) {
        throw new Error(`Render field size mismatch for ${descriptor.surfaceKey}`);
      }
      let maxDensity = 0;
      for (let i = 0; i < fieldSurface.field.length; i += 1) {
        if (fieldSurface.field[i] > maxDensity) maxDensity = fieldSurface.field[i];
      }
      const visibility = resolveRenderFieldSurfaceVisibility({
        maxDensity,
        isolation: fieldSurface.isolation,
        wasVisible: Boolean(mesh.visible)
      });
      const opticalVisibility = resolveOpticalSurfaceVisibility({
        optics: mesh.material.userData.optical,
        descriptorOrRow: descriptor,
        wasVisible: Boolean(mesh.visible)
      });
      mesh.userData.optical = mesh.material.userData.optical;
      mesh.userData.materialKey = descriptor.material;
      mesh.userData.renderKey = descriptor.renderKey;
      mesh.userData.phase = descriptor.phase;
      mesh.userData.renderSource = renderSource;
      mesh.userData.renderRowsExecutionSchema = renderRowsExecution?.schema || null;
      mesh.userData.renderRowsBackend = renderRowsExecution?.backend || null;
      mesh.userData.renderFieldExecutionSchema = renderFieldExecution?.schema || null;
      mesh.userData.renderFieldBackend = renderFieldExecution?.backend || null;
      mesh.userData.renderFieldInputSource = renderFieldExecution?.renderFieldInputSource || null;
      mesh.userData.opticalState = descriptor.opticalState || null;
      mesh.userData.opticalStateKey = descriptor.opticalStateKey || 'default';
      mesh.userData.renderDomainId = descriptor.renderDomainId;
      mesh.userData.renderDomainKey = descriptor.renderDomainKey;
      mesh.userData.opticalGpuRecord = gpuRecordsBySurface.get(opticalCoverageKey(descriptor)) || null;
      const emissive = emissiveByMaterial?.[descriptor.material] ?? emissiveByMaterial?.[descriptor.renderKey] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.userData.particleCount = null;
      mesh.userData.surfaceRadiusM = surfaceRadiusMetersFromRenderFieldRadius(fieldSurface.radiusNorm, refEdgeM);
      mesh.userData.renderFieldResolution = fieldSurface.resolution;
      mesh.userData.renderFieldCells = fieldSurface.fieldCellCount;
      mesh.userData.renderFieldCellSizeM = cpuMarchingCubesCellSizeM(refEdgeM, fieldSurface.resolution);
      mesh.userData.renderFieldMaxDensity = maxDensity;
      mesh.userData.renderFieldIsolation = fieldSurface.isolation;
      mesh.userData.renderFieldShowIsolation = visibility.showIsolation;
      mesh.userData.renderFieldHideIsolation = visibility.hideIsolation;
      mesh.userData.renderFieldAppliedIsolation = visibility.renderIsolation;
      mesh.userData.renderFieldRetainPreviousSurface = visibility.retainPreviousSurface;
      mesh.userData.opticalSurfaceVisibility = opticalVisibility;
      if (!opticalVisibility.visible) {
        const hidden = hideSurfaceAfterGrace(surface, renderSource);
        mesh.userData.opticalSurfaceHiddenReason = opticalVisibility.reason;
        mesh.userData.opticalSurfaceRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        mesh.userData.renderFieldRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        activeKeys.add(descriptor.surfaceKey);
        continue;
      }
      mesh.userData.opticalSurfaceHiddenReason = null;
      mesh.userData.opticalSurfaceRetainedByGrace = false;
      if (!visibility.visible) {
        const retentionBounds = retainedSurfaceMeshBoundsStatus(
          mesh,
          surfaceBoundsByKey?.get(descriptor.surfaceKey) ?? null
        );
        const immediateHide = !(maxDensity > 0) || !retentionBounds.within;
        const hidden = hideSurfaceAfterGrace(surface, renderSource, { immediate: immediateHide });
        mesh.userData.renderFieldRetainedByGrace = !hidden && visibility.retainPreviousSurface && retentionBounds.within;
        mesh.userData.renderFieldRetainBoundsStatus = retentionBounds.status;
        mesh.userData.renderFieldRetainBoundsMaxOutsideM = Number.isFinite(retentionBounds.maxOutsideM)
          ? retentionBounds.maxOutsideM
          : null;
        mesh.userData.renderFieldRetainBoundsMeshBounds = retentionBounds.meshBounds;
        mesh.userData.renderFieldRetainRejectedReason = retentionBounds.within
          ? null
          : retentionBounds.status;
        activeKeys.add(descriptor.surfaceKey);
        continue;
      }
      mesh.reset();
      mesh.field.set(fieldSurface.field);
      mesh.palette.set(fieldSurface.palette);
      mesh.isolation = visibility.renderIsolation;
      mesh.update();
      markCurrentRenderFieldSurfaceBoundsDiagnostic(mesh, surfaceBoundsByKey?.get(descriptor.surfaceKey) ?? null);
      clampSurfaceMeshToContainer(mesh);
      mesh.visible = true;
      mesh.userData.renderFieldRetainedByGrace = false;
      mesh.userData.renderFieldRetainBoundsStatus = 'visible-surface-current';
      mesh.userData.renderFieldRetainBoundsMaxOutsideM = 0;
      mesh.userData.renderFieldRetainBoundsMeshBounds = null;
      mesh.userData.renderFieldRetainRejectedReason = null;
      markSurfaceActive(surface);
      activeKeys.add(descriptor.surfaceKey);
    }
    for (const [key, surface] of surfaces) {
      if (!activeKeys.has(key)) {
        if (!authoritativeSurfaceFieldRows) {
          surface.mesh.userData.renderSource = renderSource;
          surface.mesh.userData.renderFieldRetainedByGrace = surface.mesh.visible === true;
          surface.mesh.userData.renderFieldRetainRejectedReason = 'resident-render-field-no-readback-retained';
          continue;
        }
        hideSurfaceAfterGrace(surface, renderSource, {
          immediate: renderSource === 'resident-gpu-render-field'
        });
      }
    }
  }

  function suppressThreeSurfaceMeshesForResidentOverlay(reason = 'resident-surface-draw-overlay-active') {
    let hiddenCount = 0;
    for (const surface of surfaces.values()) {
      if (!surface?.mesh) continue;
      if (surface.mesh.visible) hiddenCount += 1;
      surface.mesh.visible = false;
      surface.mesh.userData.suppressedByResidentSurfaceDrawOverlay = true;
      surface.mesh.userData.suppressedByResidentSurfaceDrawOverlayReason = reason;
    }
    scene.userData.sphThreeSurfaceSuppression = {
      schema: 'peercompute.ulg.sph-three-surface-suppression.v0',
      status: 'suppressed-for-resident-surface-draw-overlay',
      reason,
      hiddenCount,
      surfaceCount: surfaces.size
    };
    return scene.userData.sphThreeSurfaceSuppression;
  }

  function releaseThreeSurfaceSuppression(reason = 'three-render-field-readback-active') {
    let releasedCount = 0;
    for (const surface of surfaces.values()) {
      if (surface?.mesh?.userData?.suppressedByResidentSurfaceDrawOverlay) {
        releasedCount += 1;
        surface.mesh.userData.suppressedByResidentSurfaceDrawOverlay = false;
        surface.mesh.userData.suppressedByResidentSurfaceDrawOverlayReason = null;
      }
    }
    scene.userData.sphThreeSurfaceSuppression = {
      schema: 'peercompute.ulg.sph-three-surface-suppression.v0',
      status: 'not-suppressed',
      reason,
      releasedCount,
      surfaceCount: surfaces.size
    };
    return scene.userData.sphThreeSurfaceSuppression;
  }

  // Colours are precomputed by the demo (closure-backed incandescence from the radiation closure
  // for hot matter and intrinsic colour from the optical closure). The renderer reconstructs a
  // continuous density surface from particles, but it does not invent material colour.
  function setParticles({
    positionsM,
    colorsRgb,
    materials = null,
    emissiveByMaterial = null,
    materialProperties = null,
    reactions = null,
    reactionContactRadiusM = null,
    sphGpuParticleState: nextSphGpuParticleState = null,
    mlsMpmGpuParticleState: nextMlsMpmGpuParticleState = null,
    renderDomainCounts = null,
    physicalLawGroups = null,
    wallTemperaturesK = null,
    staticTableCache = null
  }) {
    const timingStartMs = nowMs();
    const stageMs = {};
    const measure = (name, fn) => {
      const startMs = nowMs();
      try {
        return fn();
      } finally {
        stageMs[name] = Math.max(0, nowMs() - startMs);
      }
    };
    const skipCpuSurfaceGeometry = useResidentThreeSurfaceBridgeByDefault;
    const batches = measure('surfaceBatching', () => (
      skipCpuSurfaceGeometry
        ? []
        : createContinuousSurfaceBatches({
          positionsM,
          colorsRgb,
          materials,
          boxEdgeM,
          boxDimsM: dims,
          smoothingLengthM: nextSphGpuParticleState?.smoothingLengthM ?? null
        })
    ));
    const cpuSurfaceBatches = measure('cpuSurfaceMerge', () => (
      skipCpuSurfaceGeometry
        ? []
        : mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches, {
          phasePredicate: (phase) => String(phase || '').toLowerCase() === 'liquid'
        })
    ));
    currentMaterialProperties = materialProperties || null;
    currentRenderDomainCounts = normalizeRenderDomainCounts(renderDomainCounts);
    currentPhysicalLawGroups = normalizePhysicalLawGroups(physicalLawGroups);
    currentWallTemperaturesK = wallTemperaturesK ? { ...wallTemperaturesK } : null;
    scene.userData.sphRenderDomainCounts = currentRenderDomainCounts ? { ...currentRenderDomainCounts } : null;
    scene.userData.sphPhysicalLawGroups = { ...currentPhysicalLawGroups };
    sphThermalMaterialTable = measure('thermalMaterialTable', () => (
      staticTableCache?.thermalMaterialTable?.schema
        ? staticTableCache.thermalMaterialTable
        : materialProperties
        ? buildSphThermalMaterialTable(materialProperties)
        : null
    ));
    sphThermalClosureGraphBuffers = measure('thermalClosureGraphs', () => (
      staticTableCache?.thermalClosureGraphSet?.schema
        ? staticTableCache.thermalClosureGraphSet
        : sphThermalMaterialTable
        ? buildSphThermalClosureGraphBuffers(sphThermalMaterialTable)
        : null
    ));
    sphThermalPhaseResponseTable = measure('thermalPhaseResponse', () => (
      staticTableCache?.thermalPhaseResponseTable?.schema
        ? staticTableCache.thermalPhaseResponseTable
        : sphThermalMaterialTable && sphThermalClosureGraphBuffers
        ? buildSphThermalPhaseResponseTable(sphThermalMaterialTable, sphThermalClosureGraphBuffers)
        : null
    ));
    mlsMpmMechanicsMaterialTable = measure('mechanicsMaterialTable', () => (
      materialProperties
        ? buildMlsMpmMechanicsMaterialTable(materialProperties, {
          soundSpeedScale: nextMlsMpmGpuParticleState?.soundSpeedScale,
          minGasSoundSpeedMPerS: nextMlsMpmGpuParticleState?.minGasSoundSpeedMPerS,
          viscosityEnabled: currentPhysicalLawGroups.viscosity,
          mlsMpmArtificialViscosityAlpha: nextMlsMpmGpuParticleState?.mlsMpmArtificialViscosityAlpha,
          viscosityLengthM: nextMlsMpmGpuParticleState?.viscosityLengthM
            ?? nextMlsMpmGpuParticleState?.gridSpacingM
            ?? nextSphGpuParticleState?.smoothingLengthM,
          surfaceTensionEnabled: currentPhysicalLawGroups.surfaceTension
        })
        : null
    ));
    const nextThermalResponseGraphSignature = sphThermalResponseGraphSignature();
    if (
      sphThermalResponseGraphUpload
      && sphThermalResponseGraphUploadSignature !== nextThermalResponseGraphSignature
    ) {
      if (sphThermalResponseGraphUpload.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = null;
      sphThermalResponseGraphUploadSignature = null;
      scene.userData.sphThermalResponseGraphUpload = null;
    }
    sphReactionTable = measure('reactionTable', () => (
      staticTableCache?.reactionTable?.schema
        ? staticTableCache.reactionTable
        : materialProperties
        ? buildSphReactionTable(reactions || [], {
        materialProperties,
        contactRadiusM: reactionContactRadiusM ?? nextSphGpuParticleState?.smoothingLengthM ?? 0
      })
        : null
    ));
    const residentFieldBatches = measure('residentSurfaceBatches', () => (
      skipCpuSurfaceGeometry
        ? []
        : createResidentRenderSurfaceBatches({
          particleBatches: batches,
          materialProperties,
          reactionTable: sphReactionTable,
          smoothingLengthM: nextSphGpuParticleState?.smoothingLengthM ?? null
        })
    ));
    const nextSurfaceBatchIdentitySignature = residentSurfaceBatchIdentitySignature(residentFieldBatches);
    measure('opticalState', () => rebuildOpticalStateForSurfaceBatchesWithCache(residentFieldBatches, {
      materialProperties,
      cachedOpticalGpuTable: staticTableCache?.opticalGpuTable || null
    }));
    const residentSurfaceState = measure('residentSurfaceTable', () => (
      skipCpuSurfaceGeometry
        ? captureSkippedResidentRenderSurfaceState({
          status: 'resident-render-surface-table-skipped-three-resident-bridge',
          reason: 'CPU surface geometry is skipped while the Three resident render-row bridge is active',
          emissiveByMaterial,
          materialProperties
        })
        : captureResidentRenderSurfaceState({
          particleBatches: batches,
          fieldBatches: residentFieldBatches,
          emissiveByMaterial,
          materialProperties
        })
    ));
    scene.userData.sphThermalMaterialTable = sphThermalMaterialTable;
    scene.userData.sphThermalClosureGraphBuffers = sphThermalClosureGraphBuffers;
    scene.userData.sphThermalPhaseResponseTable = sphThermalPhaseResponseTable;
    scene.userData.sphThermalResponseGraphUpload = sphThermalResponseGraphUpload;
    scene.userData.mlsMpmMechanicsMaterialTable = mlsMpmMechanicsMaterialTable;
    scene.userData.sphReactionTable = sphReactionTable;
    if (shouldRetainResidentSurfaceDrawOverlay({
      previousSurfaceBatchSignature: currentSurfaceBatchIdentitySignature,
      nextSurfaceBatchSignature: nextSurfaceBatchIdentitySignature,
      hasResidentSurfaceDraw: Boolean(sphResidentSurfaceDraw),
      hasResidentRenderBridge: hasVisibleResidentSurfaceDrawBridge(sphResidentSurfaceDrawRenderBridge),
      allowEmptySurfaceSignature: skipCpuSurfaceGeometry
    })) {
      markSphResidentSurfaceDrawOverlayRetained('cpu-particle-sync-pending-resident-overlay-refresh');
    } else {
      clearSphResidentSurfaceDrawArtifacts();
    }
    currentSurfaceBatchIdentitySignature = nextSurfaceBatchIdentitySignature;
    publishSphResidentMaterialInterfaceState(null);
    sphResidentRenderState = null;
    scene.userData.sphResidentRenderState = null;
    publishSphResidentPressureInterfaceState(null);
    destroyPressureInterfaceForceRowsUpload();
    if (
      sphGpuParticleUpload?.status === 'webgpu-uploaded'
      && sphGpuParticleUploadSignature !== sphGpuParticleSignature(nextSphGpuParticleState)
    ) {
      destroySphGpuParticleBuffers(sphGpuParticleUpload);
    }
    sphGpuParticleState = nextSphGpuParticleState;
    scene.userData.sphGpuParticleState = sphGpuParticleState;
    sphGpuParticleUpload = null;
    sphGpuParticleUploadSignature = null;
    scene.userData.sphGpuParticleUpload = null;
    if (
      mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded'
      && mlsMpmGpuParticleUploadSignature !== mlsMpmGpuParticleSignature(nextMlsMpmGpuParticleState)
    ) {
      destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    }
    mlsMpmGpuParticleState = nextMlsMpmGpuParticleState;
    scene.userData.mlsMpmGpuParticleState = mlsMpmGpuParticleState;
    mlsMpmGpuParticleUpload = null;
    mlsMpmGpuParticleUploadSignature = null;
    scene.userData.mlsMpmGpuParticleUpload = null;
    mlsMpmMechanicsPrediction = null;
    mlsMpmMechanicsPredictionSignature = null;
    scene.userData.mlsMpmMechanicsPrediction = null;
    clearMlsMpmResidentExecutionArtifacts();
    measure('surfaceApply', () => {
      if (skipCpuSurfaceGeometry) {
        releaseThreeSurfaceSuppression('set-particles-three-resident-bridge-fast-path');
        for (const surface of surfaces.values()) {
          surface.mesh.visible = false;
          surface.mesh.userData.renderSource = 'cpu-surface-skipped-three-resident-bridge';
          surface.mesh.userData.surfaceInactiveFrameCount = 0;
        }
        scene.userData.sphSurfaceApplyTiming = {
          schema: 'peercompute.ulg.sph-surface-apply-timing.v0',
          status: 'cpu-surface-skipped-three-resident-bridge',
          reason: 'Three resident render-row bridge is the selected surface renderer',
          totalMs: 0,
          totals: {
            ensureSurfaceMs: 0,
            materialMs: 0,
            resetMs: 0,
            addBallMs: 0,
            updateMs: 0,
            hideInactiveMs: 0
          },
          details: [],
          surfaceCount: 0,
          renderSource: 'three-resident-render-row-bridge',
          scientificValidation: false,
          sphValidation: false,
          fullPhysicsValidation: false
        };
        return;
      }
      applySurfaceBatches(cpuSurfaceBatches, {
        emissiveByMaterial,
        materialProperties,
        renderSource: 'cpu-particles'
      });
    });
    const presentationRefresh = skipCpuSurfaceGeometry
      ? {
        schema: 'peercompute.ulg.sph-scene-presentation-refresh.v0',
        status: 'presentation-refresh-skipped-three-resident-bridge',
        reason: 'CPU surface apply skipped; resident render refresh owns visible particles',
        requestedFrameCount: 0,
        completedFrameCount: 0,
        immediateRefresh: false,
        lastRefresh: null,
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false
      }
      : forceViewportRefreshBurst({
        reason: 'set-particles-cpu-surface-apply',
        frameCount: 2
      });
    scene.userData.sphSetParticlesTiming = {
      schema: 'peercompute.ulg.sph-scene-set-particles-timing.v0',
      totalMs: Math.max(0, nowMs() - timingStartMs),
      stageMs,
      particleCount: positionsM?.length ? positionsM.length / 3 : 0,
      surfaceBatchCount: batches.length,
      cpuSurfaceBatchCount: cpuSurfaceBatches.length,
      residentSurfaceBatchCount: residentFieldBatches.length,
      residentSurfaceTableCellCount: residentSurfaceState.surfaceTableTotalFieldCells,
      materialCount: materialProperties ? Object.keys(materialProperties).length : 0,
      reactionCount: sphReactionTable?.reactionCount ?? 0,
      thermalMaterialCount: sphThermalMaterialTable?.materialCount ?? 0,
      opticalRecordCount: opticalGpuTable?.recordCount ?? 0,
      staticTableCacheStatus: staticTableCache?.status || null,
      staticTableCacheFamilies: staticTableCache?.restoredFamilies || [],
      surfaceApplyTiming: scene.userData.sphSurfaceApplyTiming || null,
      presentationRefresh,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  function residentSurfaceDrawUnavailable(reason, {
    renderFieldExecution = null,
    surfaceVerticesExecution = null,
    overlayPolicy = null
  } = {}) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
      status: 'resident-surface-draw-unavailable',
      reason,
      overlayPolicy: overlayPolicy || resolveSceneResidentSurfaceDrawOverlayPolicy(),
      overlayPolicyStatus: overlayPolicy?.status ?? resolveSceneResidentSurfaceDrawOverlayPolicy().status,
      overlayPolicyMode: overlayPolicy?.mode ?? resolveSceneResidentSurfaceDrawOverlayPolicy().mode,
      sourceRenderFieldSchema: renderFieldExecution?.schema ?? null,
      sourceSurfaceVertexSchema: surfaceVerticesExecution?.schema ?? null,
      surfaceDrawSchema: null,
      surfaceCount: renderFieldExecution?.surfaceCount ?? surfaceVerticesExecution?.surfaceCount ?? 0,
      activeSurfaceCount: 0,
      vertexCount: 0,
      triangleCount: 0,
      sourceVertexRowCount: 0,
      drawRowsBufferRetained: false,
      drawRowsBufferByteLength: 0,
      drawIndirectRowsBufferRetained: false,
      drawIndirectRowsBufferByteLength: 0,
      compactedVertexRowsBufferRetained: false,
      compactedVertexRowsBufferByteLength: 0,
      readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
      surfaceDrawReadback: false,
      surfaceDrawSummaryReadback: false,
      surfaceDrawSummaryReadbackByteLength: 0,
      fullSurfaceDrawReadback: false,
      compactionMode: null,
      renderFieldBufferMode: 'not-retained',
      surfaceDrawInputBuffersReleased: false,
      visibleRendererBridge: 'pending-three-webgpu-binding',
      visibleRenderSource: 'three-marching-cubes-fallback',
      renderBridgeSchema: null,
      renderBridgeStatus: null,
      renderBridgeReason: null,
      renderBridgeFrameCount: 0,
      renderBridgeLastRenderStatus: null,
      renderBridgeDrawOrderingPolicy: null,
      renderBridgeDrawOrderCount: 0,
      renderBridgeDrawOrderSurfaceIndices: [],
      renderBridgeDrawOrderIndirectOffsets: [],
      renderBridgeDepthPolicy: null,
      renderBridgeDepthAttachmentFormat: null,
      renderBridgeDepthAttachmentReady: false,
      renderBridgeTransparencyCompositeMode: null,
      renderBridgeOitAccumFormat: null,
      renderBridgeOitRevealFormat: null,
      renderBridgeOitTargetsReady: false,
      renderBridgeLastOpaqueDrawCount: 0,
      renderBridgeLastTransparentDrawCount: 0,
      renderBridgeOpticalRenderSource: null,
      renderBridgeOpticalRecordCount: 0,
      renderBridgeOpticalRecordStrideFloats: 0,
      renderBridgeOpticalSpectralSampleCount: 0,
      renderBridgeOpticalSpectralSampleStrideFloats: 0,
      renderBridgeTemporalSwapPolicy: null,
      renderBridgeRetainedPreviousOverlay: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }

  function markSphResidentRenderProgress(status, extra = {}) {
    const progress = {
      schema: 'peercompute.ulg.sph-scene-resident-render-progress.v0',
      status,
      timestampMs: nowMs(),
      ...extra
    };
    scene.userData.sphResidentRenderProgress = progress;
    const progressStage = extra.stage || extra.currentStage || null;
    const progressSuffix = [
      progressStage ? `stage=${progressStage}` : null,
      extra.surfaceCount !== undefined ? `surfaces=${extra.surfaceCount}` : null,
      extra.totalFieldCells !== undefined ? `cells=${extra.totalFieldCells}` : null
    ].filter(Boolean).join(' ');
    console.debug?.(`[sph-render-progress] ${status}${progressSuffix ? ` ${progressSuffix}` : ''}`);
    return progress;
  }

	  async function buildSphResidentSurfaceDrawBridge({
	    device,
	    renderFieldExecution,
	    buildDrawMetadata = true,
        renderBridgeMode = null,
        materialProperties = currentMaterialProperties
	  } = {}) {
	    let surfaceVerticesExecution = null;
	    let surfaceDrawExecution = null;
	    let retainSurfaceVerticesExecution = false;
    try {
      const useThreeCompactVertexBridge = renderBridgeMode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE;
      const surfaceVertexReadbackMode = useThreeCompactVertexBridge
        ? RESIDENT_FULL_READBACK_MODE
        : SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
      markSphResidentRenderProgress('surface-draw-bridge-started', {
        stage: 'surface-draw-bridge',
        surfaceCount: renderFieldExecution?.surfaceCount ?? 0,
        totalFieldCells: renderFieldExecution?.totalFieldCells ?? 0,
        maxFieldCellCount: renderFieldExecution?.maxFieldCellCount ?? null,
        renderFieldReadback: Boolean(renderFieldExecution?.renderFieldReadback),
        readbackMode: renderFieldExecution?.readbackMode ?? null,
        renderBridgeMode: useThreeCompactVertexBridge ? SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE : 'resident-overlay'
      });
      if (
        renderFieldExecution?.schema !== 'peercompute.ulg.sph-gpu-render-field.v0'
        || renderFieldExecution.backend !== 'webgpu'
        || !renderFieldExecution.fieldRowsBuffer
        || !renderFieldExecution.surfaceBuffer
      ) {
        return residentSurfaceDrawUnavailable('retained WebGPU render-field buffers are not available', {
          renderFieldExecution
        });
      }
      markSphResidentRenderProgress('surface-draw-vertices-started', {
        stage: 'surface-vertices',
        surfaceCount: renderFieldExecution.surfaceCount,
        totalFieldCells: renderFieldExecution.totalFieldCells,
        maxFieldCellCount: renderFieldExecution.maxFieldCellCount ?? null
      });
      surfaceVerticesExecution = await buildSphRenderSurfaceVerticesWebGpu({
        device,
        renderField: renderFieldExecution,
        fieldRowsBuffer: renderFieldExecution.fieldRowsBuffer,
        surfaceBuffer: renderFieldExecution.surfaceBuffer,
        readbackMode: surfaceVertexReadbackMode,
        retainVertexRowsBuffer: !useThreeCompactVertexBridge,
        waitForQueueCompletion: !useThreeCompactVertexBridge,
        deferCleanup: false,
        onProgress(progress = {}) {
          markSphResidentRenderProgress(progress.status || 'surface-vertices-progress', {
            ...progress,
            currentStage: progress.stage || 'surface-vertices'
          });
        }
      });
	      markSphResidentRenderProgress('surface-draw-vertices-complete', {
	        stage: 'surface-vertices',
	        surfaceCount: surfaceVerticesExecution.surfaceCount,
	        totalFieldCells: surfaceVerticesExecution.totalFieldCells,
	        maxVertexRows: surfaceVerticesExecution.maxVertexRows,
        fixedSlotVertexRowsByteLength: surfaceVerticesExecution.fixedSlotVertexRowsByteLength,
	        queueCompletionStatus: surfaceVerticesExecution.queueCompletionStatus ?? null,
	        queueCompletionMethod: surfaceVerticesExecution.queueCompletionMethod ?? null
	      });
	      if (!buildDrawMetadata) {
	        retainSurfaceVerticesExecution = true;
	        markSphResidentRenderProgress('surface-draw-metadata-deferred', {
	          stage: 'surface-draw-metadata',
	          surfaceCount: surfaceVerticesExecution.surfaceCount,
	          sourceVertexRowCount: surfaceVerticesExecution.vertexRowsBufferRowCount
	            ?? surfaceVerticesExecution.maxVertexRows
	            ?? null,
	          reason: 'diagnostic retained surface vertex buffers without compact draw metadata readback'
	        });
	        const overlayPolicy = resolveSceneResidentSurfaceDrawOverlayPolicy();
	        return {
	          schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
	          status: 'resident-surface-vertex-buffers-retained',
	          reason: 'compact surface-draw metadata/readback deferred for diagnostic-only no-overlay refresh',
	          overlayPolicy,
	          overlayPolicyStatus: overlayPolicy?.status ?? null,
	          overlayPolicyMode: overlayPolicy?.mode ?? null,
	          sourceRenderFieldSchema: renderFieldExecution.schema,
	          sourceSurfaceVertexSchema: surfaceVerticesExecution.schema,
	          surfaceDrawSchema: null,
	          sourceRenderFieldBackend: renderFieldExecution.backend,
	          sourceSurfaceVertexBackend: surfaceVerticesExecution.backend,
	          surfaceDrawBackend: null,
	          surfaceCount: surfaceVerticesExecution.surfaceCount,
	          activeSurfaceCount: 0,
	          vertexCount: 0,
	          triangleCount: 0,
	          sourceVertexRowCount: surfaceVerticesExecution.vertexRowsBufferRowCount
	            ?? surfaceVerticesExecution.maxVertexRows
	            ?? 0,
	          surfaceVertexRowsBufferRetained: Boolean(surfaceVerticesExecution.vertexRowsBufferRetained),
	          surfaceVertexRowsBufferByteLength: surfaceVerticesExecution.vertexRowsBufferByteLength ?? 0,
	          drawRowsBufferRetained: false,
	          drawRowsBufferByteLength: 0,
	          drawIndirectSchema: null,
	          drawIndirectRowStrideUints: 0,
	          drawIndirectRowsBufferRetained: false,
	          drawIndirectRowsBufferByteLength: 0,
	          compactedVertexRowsBufferRetained: false,
	          compactedVertexRowsBufferByteLength: 0,
	          residentBufferLeaseLedgerStatus: surfaceVerticesExecution.residentBufferLeaseLedgerStatus ?? null,
	          residentBufferLeaseResourceCount: surfaceVerticesExecution.residentBufferLeaseResourceCount ?? 0,
	          residentBufferLeaseActiveLeaseCount: surfaceVerticesExecution.residentBufferLeaseActiveLeaseCount ?? 0,
	          residentBufferLeaseSummary: surfaceVerticesExecution.residentBufferLeaseSummary ?? null,
	          readbackMode: surfaceVerticesExecution.readbackMode,
	          surfaceDrawReadback: false,
	          surfaceDrawSummaryReadback: false,
	          surfaceDrawSummaryReadbackByteLength: 0,
	          fullSurfaceDrawReadback: false,
	          compactionMode: surfaceVerticesExecution.compactionMode,
	          renderFieldBufferMode: 'released-after-surface-vertex-diagnostic',
	          surfaceVertexBufferMode: 'retained-surface-vertex-diagnostic',
	          surfaceDrawBufferMode: 'metadata-deferred',
	          surfaceDrawInputBuffersReleased: true,
	          visibleRendererBridge: 'diagnostic-vertex-buffers-no-overlay',
	          visibleRenderSource: 'resident-surface-vertex-diagnostic-buffers',
	          renderBridgeSchema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
	          renderBridgeStatus: overlayPolicy?.status ?? null,
	          renderBridgeReason: overlayPolicy?.reason || SPH_THREE_WEBGPU_BINDING_REASON,
	          renderBridgeFrameCount: 0,
	          renderBridgeLastRenderStatus: null,
	          renderBridgeDrawOrderingPolicy: null,
	          renderBridgeDrawOrderCount: 0,
	          renderBridgeDrawOrderSurfaceIndices: [],
	          renderBridgeDrawOrderIndirectOffsets: [],
	          renderBridgeDepthPolicy: null,
	          renderBridgeDepthAttachmentFormat: null,
	          renderBridgeDepthAttachmentReady: false,
	          renderBridgeTransparencyCompositeMode: null,
	          renderBridgeOitAccumFormat: null,
	          renderBridgeOitRevealFormat: null,
	          renderBridgeOitTargetsReady: false,
	          renderBridgeLastOpaqueDrawCount: 0,
	          renderBridgeLastTransparentDrawCount: 0,
	          renderBridgeOpticalRenderSource: null,
	          renderBridgeOpticalRecordCount: 0,
	          renderBridgeOpticalRecordStrideFloats: 0,
	          renderBridgeOpticalSpectralSampleCount: 0,
	          renderBridgeOpticalSpectralSampleStrideFloats: 0,
	          renderBridgeTemporalSwapPolicy: null,
	          renderBridgeRetainedPreviousOverlay: false,
	          surfaceVertices: surfaceVerticesExecution,
	          surfaceDraw: null,
	          scientificValidation: false,
	          sphValidation: false,
	          surfaceExtractionValidation: false,
	          fullPhysicsValidation: false
	        };
	      }
      if (useThreeCompactVertexBridge) {
        markSphResidentRenderProgress('surface-draw-metadata-skipped-three-compact', {
          stage: 'surface-draw-metadata',
          surfaceCount: surfaceVerticesExecution.surfaceCount,
          sourceVertexRowCount: surfaceVerticesExecution.vertexCount ?? null,
          reason: 'Three compact bridge uses surface vertex readback directly'
        });
        surfaceDrawExecution = createSphSurfaceDrawExecutionFromSurfaceVertices(surfaceVerticesExecution);
      } else {
	      markSphResidentRenderProgress('surface-draw-metadata-started', {
          stage: 'surface-draw-metadata',
          surfaceCount: surfaceVerticesExecution.surfaceCount,
          sourceVertexRowCount: surfaceVerticesExecution.vertexRowsBufferRowCount
            ?? surfaceVerticesExecution.maxVertexRows
            ?? null
        });
        surfaceDrawExecution = await buildSphRenderSurfaceDrawMetadataWebGpu({
          device,
          surfaceVertices: surfaceVerticesExecution,
          surfaceBuffer: renderFieldExecution.surfaceBuffer,
          readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
          compactSummaryReadback: false,
          retainDrawRowsBuffer: true,
          retainDrawIndirectRowsBuffer: true,
          retainCompactedVertexRowsBuffer: true,
          waitForQueueCompletion: false,
          onProgress(progress = {}) {
            markSphResidentRenderProgress(progress.status || 'surface-draw-metadata-progress', {
              ...progress,
              currentStage: progress.stage || 'surface-draw-metadata'
            });
          }
        });
      }
      markSphResidentRenderProgress('surface-draw-metadata-complete', {
        stage: 'surface-draw-metadata',
        surfaceCount: surfaceDrawExecution.surfaceCount,
        sourceVertexRowCount: surfaceDrawExecution.sourceVertexRowCount,
        activeSurfaceCount: surfaceDrawExecution.activeSurfaceCount ?? null,
        vertexCount: surfaceDrawExecution.vertexCount ?? null,
        triangleCount: surfaceDrawExecution.triangleCount ?? null,
        queueCompletionStatus: surfaceDrawExecution.queueCompletionStatus ?? null,
        queueCompletionMethod: surfaceDrawExecution.queueCompletionMethod ?? null,
        compactSummaryReadback: Boolean(surfaceDrawExecution.surfaceDrawSummaryReadback)
      });
      markSphResidentRenderProgress('surface-draw-render-bridge-started', {
        stage: 'surface-draw-render-bridge',
        surfaceCount: surfaceDrawExecution.surfaceCount,
        renderBridgeMode: useThreeCompactVertexBridge ? SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE : 'resident-overlay'
      });
      const renderBridge = useThreeCompactVertexBridge
        ? createSphResidentSurfaceDrawThreeCompactBridge({
          surfaceDrawExecution,
          materialProperties
        })
        : createSphResidentSurfaceDrawRenderBridge({
          device,
          surfaceDrawExecution
        });
      const renderBridgeReady = renderBridge?.status === 'webgpu-storage-indirect-overlay-ready'
        || renderBridge?.status === SPH_THREE_COMPACT_VERTEX_BRIDGE_STATUS;
      const overlayPolicy = renderBridge?.overlayPolicy || resolveSceneResidentSurfaceDrawOverlayPolicy();
      markSphResidentRenderProgress('surface-draw-render-bridge-complete', {
        stage: 'surface-draw-render-bridge',
        surfaceCount: surfaceDrawExecution.surfaceCount,
        renderBridgeStatus: renderBridge?.status ?? null,
        renderBridgeMode: renderBridge?.rendererBridge ?? null,
        overlayPolicyStatus: overlayPolicy?.status ?? null
      });
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
        status: surfaceDrawExecution.status === 'surface-draw-resident'
          ? 'resident-surface-draw-buffers-retained'
          : 'resident-surface-draw-built',
        overlayPolicy,
        overlayPolicyStatus: overlayPolicy?.status ?? null,
        overlayPolicyMode: overlayPolicy?.mode ?? null,
        sourceRenderFieldSchema: renderFieldExecution.schema,
        sourceSurfaceVertexSchema: surfaceVerticesExecution.schema,
        surfaceDrawSchema: surfaceDrawExecution.schema,
        sourceRenderFieldBackend: renderFieldExecution.backend,
        sourceSurfaceVertexBackend: surfaceVerticesExecution.backend,
        surfaceDrawBackend: surfaceDrawExecution.backend,
        surfaceCount: surfaceDrawExecution.surfaceCount,
        activeSurfaceCount: surfaceDrawExecution.activeSurfaceCount ?? null,
        vertexCount: surfaceDrawExecution.vertexCount ?? null,
        triangleCount: surfaceDrawExecution.triangleCount ?? null,
        sourceVertexRowCount: surfaceDrawExecution.sourceVertexRowCount,
        drawRowsBufferRetained: Boolean(surfaceDrawExecution.drawRowsBufferRetained),
        drawRowsBufferByteLength: surfaceDrawExecution.drawRowsBufferByteLength ?? 0,
        drawIndirectSchema: surfaceDrawExecution.drawIndirectSchema ?? null,
        drawIndirectRowStrideUints: surfaceDrawExecution.drawIndirectRowStrideUints ?? 0,
        drawIndirectRowsBufferRetained: Boolean(surfaceDrawExecution.drawIndirectRowsBufferRetained),
        drawIndirectRowsBufferByteLength: surfaceDrawExecution.drawIndirectRowsBufferByteLength ?? 0,
        compactedVertexRowsBufferRetained: Boolean(surfaceDrawExecution.compactedVertexRowsBufferRetained),
        compactedVertexRowsBufferByteLength: surfaceDrawExecution.compactedVertexRowsBufferByteLength ?? 0,
        residentBufferLeaseLedgerStatus: surfaceDrawExecution.residentBufferLeaseLedgerStatus ?? null,
        residentBufferLeaseResourceCount: surfaceDrawExecution.residentBufferLeaseResourceCount ?? 0,
        residentBufferLeaseActiveLeaseCount: surfaceDrawExecution.residentBufferLeaseActiveLeaseCount ?? 0,
        residentBufferLeaseSummary: surfaceDrawExecution.residentBufferLeaseSummary ?? null,
        readbackMode: surfaceDrawExecution.readbackMode,
        surfaceDrawReadback: Boolean(surfaceDrawExecution.surfaceDrawReadback),
        surfaceDrawSummaryReadback: Boolean(surfaceDrawExecution.surfaceDrawSummaryReadback),
        surfaceDrawSummaryReadbackByteLength: surfaceDrawExecution.surfaceDrawSummaryReadbackByteLength ?? 0,
        fullSurfaceDrawReadback: Boolean(surfaceDrawExecution.fullSurfaceDrawReadback),
        compactionMode: surfaceDrawExecution.compactionMode,
        renderFieldBufferMode: 'released-after-surface-draw',
        surfaceVertexBufferMode: 'released-after-surface-draw',
        surfaceDrawBufferMode: useThreeCompactVertexBridge
          ? 'three-compact-vertex-readback'
          : 'retained-compact-draw-buffers',
        surfaceDrawInputBuffersReleased: true,
        visibleRendererBridge: renderBridgeReady
          ? renderBridge.rendererBridge
          : (useThreeCompactVertexBridge
            ? 'three-marching-cubes-fallback'
            : (renderBridge?.rendererBridge || 'pending-three-webgpu-binding')),
        visibleRenderSource: renderBridgeReady
          ? renderBridge.visibleRenderSource
          : 'three-marching-cubes-fallback',
        renderBridgeSchema: renderBridge?.schema ?? null,
        renderBridgeStatus: renderBridge?.status ?? null,
        renderBridgeReason: renderBridge?.reason ?? null,
        renderBridgeFrameCount: renderBridge?.frameCount ?? 0,
        renderBridgeLastRenderStatus: renderBridge?.lastRenderStatus ?? null,
        renderBridgeThreeMeshCount: renderBridge?.threeMeshCount ?? 0,
        renderBridgeThreeGeometryByteLength: renderBridge?.threeGeometryByteLength ?? 0,
        renderBridgeDrawOrderingPolicy: renderBridge?.drawOrderingPolicy ?? null,
        renderBridgeDrawOrderCount: renderBridge?.drawOrderCount ?? 0,
        renderBridgeDrawOrderSurfaceIndices: [...(renderBridge?.drawOrderSurfaceIndices || [])],
        renderBridgeDrawOrderIndirectOffsets: [...(renderBridge?.drawOrderIndirectOffsets || [])],
        renderBridgeDepthPolicy: renderBridge?.depthPolicy ?? null,
        renderBridgeDepthAttachmentFormat: renderBridge?.depthAttachmentFormat ?? null,
        renderBridgeDepthAttachmentReady: Boolean(renderBridge?.depthAttachmentReady),
        renderBridgeTransparencyCompositeMode: renderBridge?.transparencyCompositeMode ?? null,
        renderBridgeOitAccumFormat: renderBridge?.oitAccumFormat ?? null,
        renderBridgeOitRevealFormat: renderBridge?.oitRevealFormat ?? null,
        renderBridgeOitTargetsReady: Boolean(renderBridge?.oitTargetsReady),
        renderBridgeLastOpaqueDrawCount: renderBridge?.lastOpaqueDrawCount ?? 0,
        renderBridgeLastTransparentDrawCount: renderBridge?.lastTransparentDrawCount ?? 0,
        renderBridgeOpticalRenderSource: renderBridge?.opticalRenderSource ?? null,
        renderBridgeOpticalRecordCount: renderBridge?.opticalRecordCount ?? 0,
        renderBridgeOpticalRecordStrideFloats: renderBridge?.opticalRecordStrideFloats ?? 0,
        renderBridgeOpticalSpectralSampleCount: renderBridge?.opticalSpectralSampleCount ?? 0,
        renderBridgeOpticalSpectralSampleStrideFloats: renderBridge?.opticalSpectralSampleStrideFloats ?? 0,
        renderBridgeSphereMaterialKeys: [...(renderBridge?.sphereBridgeMaterialKeys || [])],
        renderBridgeSphereTransmissionProxyCount: renderBridge?.sphereBridgeTransmissionProxyCount ?? 0,
        renderBridgeSphereFallbackColorCount: renderBridge?.sphereBridgeFallbackColorCount ?? 0,
        renderBridgeSphereReusedMeshCount: renderBridge?.sphereBridgeReusedMeshCount ?? 0,
        renderBridgeSphereCreatedMeshCount: renderBridge?.sphereBridgeCreatedMeshCount ?? 0,
        renderBridgeSphereDisposedMeshCount: renderBridge?.sphereBridgeDisposedMeshCount ?? 0,
        renderBridgeMinParticleRadiusM: renderBridge?.minParticleRadiusM ?? null,
        renderBridgeMaxParticleRadiusM: renderBridge?.maxParticleRadiusM ?? null,
        renderBridgeTemporalSwapPolicy: renderBridge?.temporalSwapPolicy ?? null,
        renderBridgeRetainedPreviousOverlay: Boolean(renderBridge?.retainedPreviousOverlay),
        surfaceDraw: surfaceDrawExecution,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    } catch (error) {
      markSphResidentRenderProgress('surface-draw-bridge-error', {
        stage: 'surface-draw-bridge',
        reason: error instanceof Error ? error.message : String(error),
        surfaceCount: renderFieldExecution?.surfaceCount ?? 0,
        totalFieldCells: renderFieldExecution?.totalFieldCells ?? 0
      });
      surfaceDrawExecution?.releaseSurfaceDrawBufferLeases?.();
      surfaceDrawExecution?.destroySurfaceDrawBuffers?.({
        releaseLeases: true,
        reason: 'surface-draw-bridge-build-error'
      });
      return residentSurfaceDrawUnavailable(error instanceof Error ? error.message : String(error), {
        renderFieldExecution,
        surfaceVerticesExecution,
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy()
      });
	    } finally {
	      if (!retainSurfaceVerticesExecution) {
	        surfaceVerticesExecution?.releaseSurfaceVertexBufferLeases?.({
	          status: 'released-after-surface-draw-metadata'
	        });
	        surfaceVerticesExecution?.destroySurfaceVertexBuffers?.({
	          releaseLeases: true,
	          reason: 'surface-draw-bridge-input-cleanup'
	        });
	      }
	      renderFieldExecution?.releaseRenderFieldBufferLeases?.({
	        status: 'released-after-surface-draw-bridge'
      });
      renderFieldExecution?.destroyRenderFieldBuffers?.({
        releaseLeases: true,
        reason: 'surface-draw-bridge-input-cleanup'
      });
      markSphResidentRenderProgress('surface-draw-bridge-cleanup-complete', {
        stage: 'surface-draw-bridge-cleanup',
        surfaceCount: renderFieldExecution?.surfaceCount ?? 0,
        totalFieldCells: renderFieldExecution?.totalFieldCells ?? 0
      });
    }
  }

  async function refreshSphResidentSurfaceDrawFromExtension({
    extensionExecution,
    device = null,
    deviceResult = null,
    surfaceIndex = 0,
    materialId = 0,
    phaseId = 0,
    opticalStateId = 0,
    material = null,
    phase = null,
    renderKey = null,
    surfaceKey = null,
    density = 0,
    isolation = null,
    sourceVoxelLinearIndex = 0,
    fallbackNormal = [0, 1, 0],
    transparencyClassId = 0,
    depthWriteFlag = 1,
    renderOrder = null,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    renderBridgeMode = null,
    materialProperties = currentMaterialProperties,
    waitForQueueCompletion = true
  } = {}) {
    const previousResidentSurfaceDraw = sphResidentSurfaceDraw;
    const previousResidentRenderBridge = sphResidentSurfaceDrawRenderBridge;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || null);
    if (!resolvedDeviceResult?.device) {
      const unavailable = residentSurfaceDrawUnavailable(
        resolvedDeviceResult?.reason || 'caller-owned GPUDevice required for extension surface translation',
        { overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy() }
      );
      unavailable.status = 'resident-extension-surface-draw-unavailable';
      unavailable.visibleRendererBridge = 'extension-resident-surface-buffers-no-overlay';
      unavailable.visibleRenderSource = 'webgpu-marching-cubes-extension-unavailable';
      sphResidentSurfaceDraw = unavailable;
      scene.userData.sphResidentSurfaceDraw = unavailable;
      sphResidentSurfaceDrawRenderBridge = null;
      scene.userData.sphResidentSurfaceDrawRenderBridge = null;
      releasePreviousSphResidentSurfaceDrawResources(previousResidentSurfaceDraw, previousResidentRenderBridge);
      return unavailable;
    }
    let translation = null;
    try {
      markSphResidentRenderProgress('extension-surface-draw-translation-started', {
        stage: 'extension-surface-draw',
        extensionStatus: extensionExecution?.status ?? null,
        extensionVertexCount: extensionExecution?.result?.vertexCount ?? 0
      });
      const requestedThreeCompactBridge = renderBridgeMode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE;
      const translationReadbackMode = requestedThreeCompactBridge
        ? RESIDENT_FULL_READBACK_MODE
        : normalizeResidentReadbackMode(readbackMode);
      const rendererCapability = resolveResidentExtensionSurfaceRendererCapability({
        renderer,
        renderBridgeMode,
        readbackMode: translationReadbackMode
      });
      scene.userData.sphResidentExtensionSurfaceRendererCapability = rendererCapability;
      translation = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
        device: resolvedDeviceResult.device,
        extensionExecution,
        surfaceIndex,
        materialId,
        phaseId,
        opticalStateId,
        material,
        phase,
        renderKey,
        surfaceKey,
        density,
        isolation,
        sourceVoxelLinearIndex,
        fallbackNormal,
        transparencyClassId,
        depthWriteFlag,
        renderOrder,
        readbackMode: translationReadbackMode,
        compactSummaryReadback: false,
        retainVertexRowsBuffer: true,
        retainDrawRowsBuffer: true,
        retainDrawIndirectRowsBuffer: true,
        waitForQueueCompletion,
        onProgress(progress = {}) {
          markSphResidentRenderProgress(progress.status || 'extension-surface-draw-progress', {
            ...progress,
            currentStage: progress.stage || 'extension-surface-draw'
          });
        }
      });
      const surfaceVerticesExecution = translation.surfaceVertices;
      const surfaceDrawExecution = translation.surfaceDraw;
      const renderBridge = requestedThreeCompactBridge
        ? createSphResidentSurfaceDrawThreeCompactBridge({
          surfaceDrawExecution,
          materialProperties
        })
        : null;
      const renderBridgeReady = renderBridge?.status === SPH_THREE_COMPACT_VERTEX_BRIDGE_STATUS;
      const residentDraw = {
        schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
        status: 'resident-extension-surface-draw-buffers-retained',
        source: 'webgpu-marching-cubes-extension',
        reason: null,
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy(),
        overlayPolicyStatus: resolveSceneResidentSurfaceDrawOverlayPolicy()?.status ?? null,
        overlayPolicyMode: resolveSceneResidentSurfaceDrawOverlayPolicy()?.mode ?? null,
        sourceRenderFieldSchema: null,
        sourceSurfaceVertexSchema: surfaceVerticesExecution.schema,
        surfaceDrawSchema: surfaceDrawExecution.schema,
        sourceRenderFieldBackend: null,
        sourceSurfaceVertexBackend: surfaceVerticesExecution.backend,
        surfaceDrawBackend: surfaceDrawExecution.backend,
        surfaceCount: surfaceDrawExecution.surfaceCount,
        activeSurfaceCount: surfaceDrawExecution.activeSurfaceCount ?? null,
        vertexCount: surfaceDrawExecution.vertexCount ?? null,
        triangleCount: surfaceDrawExecution.triangleCount ?? null,
        sourceVertexRowCount: surfaceDrawExecution.sourceVertexRowCount,
        surfaceVertexRowsBufferRetained: Boolean(surfaceVerticesExecution.vertexRowsBufferRetained),
        surfaceVertexRowsBufferByteLength: surfaceVerticesExecution.vertexRowsBufferByteLength ?? 0,
        drawRowsBufferRetained: Boolean(surfaceDrawExecution.drawRowsBufferRetained),
        drawRowsBufferByteLength: surfaceDrawExecution.drawRowsBufferByteLength ?? 0,
        drawIndirectSchema: surfaceDrawExecution.drawIndirectSchema ?? null,
        drawIndirectRowStrideUints: surfaceDrawExecution.drawIndirectRowStrideUints ?? 0,
        drawIndirectRowsBufferRetained: Boolean(surfaceDrawExecution.drawIndirectRowsBufferRetained),
        drawIndirectRowsBufferByteLength: surfaceDrawExecution.drawIndirectRowsBufferByteLength ?? 0,
        compactedVertexRowsBufferRetained: Boolean(surfaceDrawExecution.compactedVertexRowsBufferRetained),
        compactedVertexRowsBufferByteLength: surfaceDrawExecution.compactedVertexRowsBufferByteLength ?? 0,
        residentBufferLeaseLedgerStatus: translation.residentBufferLeaseLedgerStatus ?? null,
        residentBufferLeaseResourceCount: translation.residentBufferLeaseResourceCount ?? 0,
        residentBufferLeaseActiveLeaseCount: translation.residentBufferLeaseActiveLeaseCount ?? 0,
        residentBufferLeaseSummary: translation.residentBufferLeaseSummary ?? null,
        readbackMode: translation.readbackMode,
        surfaceDrawReadback: Boolean(surfaceDrawExecution.surfaceDrawReadback),
        surfaceDrawSummaryReadback: Boolean(surfaceDrawExecution.surfaceDrawSummaryReadback),
        surfaceDrawSummaryReadbackByteLength: surfaceDrawExecution.surfaceDrawSummaryReadbackByteLength ?? 0,
        fullSurfaceDrawReadback: Boolean(surfaceDrawExecution.fullSurfaceDrawReadback),
        compactionMode: surfaceDrawExecution.compactionMode,
        renderFieldBufferMode: 'not-used-extension-surface',
        surfaceVertexBufferMode: 'retained-extension-surface-vertex-buffer',
        surfaceDrawBufferMode: 'retained-extension-surface-draw-buffers',
        surfaceDrawInputBuffersReleased: true,
        renderBridgeCapabilitySchema: rendererCapability.schema,
        renderBridgeCapabilityStatus: rendererCapability.status,
        renderBridgeCapabilityReason: rendererCapability.reason,
        renderBridgeRendererBackend: rendererCapability.rendererBackend,
        renderBridgeBackendBufferBindingAvailable: rendererCapability.backendBufferBindingAvailable,
        renderBridgeSameDeviceGpuBufferGeometrySupported: rendererCapability.sameDeviceGpuBufferGeometrySupported,
        renderBridgeVisibleNoReadbackSupported: rendererCapability.visibleNoReadbackSupported,
        renderBridgeRequestedThreeCompactReadbackBridge: rendererCapability.requestedThreeCompactReadbackBridge,
        visibleRendererBridge: renderBridgeReady
          ? renderBridge.rendererBridge
          : 'extension-resident-surface-buffers-no-overlay',
        visibleRenderSource: renderBridgeReady
          ? renderBridge.visibleRenderSource
          : 'webgpu-marching-cubes-extension-same-device-surface',
        renderBridgeSchema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        renderBridgeStatus: renderBridgeReady
          ? renderBridge.status
          : 'extension-surface-buffers-retained-no-overlay',
        renderBridgeReason: renderBridgeReady
          ? renderBridge.reason
          : (requestedThreeCompactBridge
            ? (renderBridge?.reason || 'extension surface rows were not available for the Three compact bridge')
            : (rendererCapability.reason || 'extension surface buffers are resident; renderer bridge not bound in this no-overlay path')),
        renderBridgeFrameCount: renderBridge?.frameCount ?? 0,
        renderBridgeLastRenderStatus: renderBridge?.lastRenderStatus ?? null,
        renderBridgeEngineIntegration: renderBridgeReady
          ? 'three-renderer-owned-scene-object-no-overlay'
          : 'three-renderer-owned-scene-state-no-overlay',
        renderBridgeThreeMeshCount: renderBridge?.threeMeshCount ?? 0,
        renderBridgeThreeGeometryByteLength: renderBridge?.threeGeometryByteLength ?? 0,
        renderBridgeDrawOrderingPolicy: renderBridge?.drawOrderingPolicy ?? null,
        renderBridgeDrawOrderCount: renderBridge?.drawOrderCount ?? 0,
        renderBridgeDrawOrderSurfaceIndices: [...(renderBridge?.drawOrderSurfaceIndices || [])],
        renderBridgeDrawOrderIndirectOffsets: [...(renderBridge?.drawOrderIndirectOffsets || [])],
        renderBridgeDepthPolicy: renderBridge?.depthPolicy ?? null,
        renderBridgeDepthAttachmentFormat: renderBridge?.depthAttachmentFormat ?? null,
        renderBridgeDepthAttachmentReady: Boolean(renderBridge?.depthAttachmentReady),
        renderBridgeTransparencyCompositeMode: renderBridge?.transparencyCompositeMode ?? null,
        renderBridgeOitAccumFormat: renderBridge?.oitAccumFormat ?? null,
        renderBridgeOitRevealFormat: renderBridge?.oitRevealFormat ?? null,
        renderBridgeOitTargetsReady: Boolean(renderBridge?.oitTargetsReady),
        renderBridgeLastOpaqueDrawCount: renderBridge?.lastOpaqueDrawCount ?? 0,
        renderBridgeLastTransparentDrawCount: renderBridge?.lastTransparentDrawCount ?? 0,
        renderBridgeOpticalRenderSource: renderBridge?.opticalRenderSource ?? null,
        renderBridgeOpticalRecordCount: renderBridge?.opticalRecordCount ?? 0,
        renderBridgeOpticalRecordStrideFloats: renderBridge?.opticalRecordStrideFloats ?? 0,
        renderBridgeOpticalSpectralSampleCount: renderBridge?.opticalSpectralSampleCount ?? 0,
        renderBridgeOpticalSpectralSampleStrideFloats: renderBridge?.opticalSpectralSampleStrideFloats ?? 0,
        renderBridgeTemporalSwapPolicy: renderBridge?.temporalSwapPolicy ?? null,
        renderBridgeRetainedPreviousOverlay: Boolean(renderBridge?.retainedPreviousOverlay),
        extensionSurfaceTranslation: translation,
        surfaceVertices: surfaceVerticesExecution,
        surfaceDraw: surfaceDrawExecution,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
      sphResidentSurfaceDraw = residentDraw;
      scene.userData.sphResidentSurfaceDraw = residentDraw;
      if (!renderBridgeReady) {
        sphResidentSurfaceDrawRenderBridge = null;
        scene.userData.sphResidentSurfaceDrawRenderBridge = null;
      }
      releasePreviousSphResidentSurfaceDrawResources(previousResidentSurfaceDraw, previousResidentRenderBridge);
      markSphResidentRenderProgress('extension-surface-draw-translation-complete', {
        stage: 'extension-surface-draw',
        surfaceCount: residentDraw.surfaceCount,
        sourceVertexRowCount: residentDraw.sourceVertexRowCount,
        drawRowsBufferRetained: residentDraw.drawRowsBufferRetained,
        drawIndirectRowsBufferRetained: residentDraw.drawIndirectRowsBufferRetained,
        compactedVertexRowsBufferRetained: residentDraw.compactedVertexRowsBufferRetained
      });
      return residentDraw;
    } catch (error) {
      translation?.releaseExtensionSurfaceBufferLeases?.({
        status: 'released-after-extension-surface-draw-error'
      });
      translation?.destroyExtensionSurfaceBuffers?.({
        releaseLeases: true,
        reason: 'extension-surface-draw-error-cleanup'
      });
      const unavailable = residentSurfaceDrawUnavailable(error instanceof Error ? error.message : String(error), {
        overlayPolicy: resolveSceneResidentSurfaceDrawOverlayPolicy()
      });
      unavailable.status = 'resident-extension-surface-draw-error';
      unavailable.visibleRendererBridge = 'extension-resident-surface-buffers-no-overlay';
      unavailable.visibleRenderSource = 'webgpu-marching-cubes-extension-error';
      sphResidentSurfaceDraw = unavailable;
      scene.userData.sphResidentSurfaceDraw = unavailable;
      sphResidentSurfaceDrawRenderBridge = null;
      scene.userData.sphResidentSurfaceDrawRenderBridge = null;
      releasePreviousSphResidentSurfaceDrawResources(previousResidentSurfaceDraw, previousResidentRenderBridge);
      markSphResidentRenderProgress('extension-surface-draw-translation-error', {
        stage: 'extension-surface-draw',
        reason: unavailable.reason
      });
      return unavailable;
    }
  }

  async function refreshSphResidentRenderState({
    preferWebGpu = true,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    residentSteps = mlsMpmResidentSteps,
    materialProperties = currentMaterialProperties,
    gasPressureSummary = null,
    renderFieldReadbackMode = null,
    renderRowsReadbackMode = null,
    renderFieldSurfaceSummaryMode = 'auto',
    surfaceDrawDiagnosticMode = 'auto',
    surfaceDrawDiagnosticMaxFieldCells = SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT,
    surfaceDrawDiagnosticMaxResolution = SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT,
    surfaceDrawOverlayPolicyOverride = null,
    residentAuthorityHost = null,
    pressureInterfaceGasCellFieldAdmission = null,
    pressureInterfaceGasCellFieldImport = currentPressureInterfaceGasCellFieldImport(),
    pressureInterfaceGasCellFieldImportStateKey = null,
    skipPressureInterfaceRefresh = false
  } = {}) {
    const effectiveResidentAuthorityHost = resolveSceneResidentAuthorityHost(residentAuthorityHost);
    const previousResidentSurfaceDraw = sphResidentSurfaceDraw;
    const previousResidentRenderBridge = sphResidentSurfaceDrawRenderBridge;
    const finalStep = residentSteps?.finalStep || mlsMpmResidentStep || null;
    const nextSphParticleState = residentSteps?.nextSphParticleState || sphGpuParticleState;
    const nextMlsMpmParticleState = residentSteps?.nextMlsMpmParticleState
      || finalStep?.nextMlsMpmParticleState
      || null;
    const nextSphUpload = residentSteps?.nextParticleUploads?.sphParticleUpload
      || finalStep?.nextParticleUploads?.sphParticleUpload
      || sphGpuParticleUpload
      || null;
    const nextMlsMpmUpload = residentSteps?.nextParticleUploads?.mlsMpmParticleUpload
      || finalStep?.nextParticleUploads?.mlsMpmParticleUpload
      || mlsMpmGpuParticleUpload
      || null;
    markSphResidentRenderProgress('resident-render-refresh-started', {
      stage: 'resident-render-refresh',
      particleCount: nextSphParticleState?.particleCount ?? 0,
      hasResidentUpload: nextSphUpload?.status === 'webgpu-uploaded',
      renderFieldReadbackMode,
      renderRowsReadbackMode,
      renderFieldSurfaceSummaryMode,
      surfaceDrawDiagnosticMode
    });
    if (!nextSphParticleState?.schema || nextSphUpload?.status !== 'webgpu-uploaded') {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-rows-unavailable',
        source: 'cpu-particles',
        reason: 'retained resident SPH buffers are not available',
        particleCount: nextSphParticleState?.particleCount ?? 0,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      markSphResidentRenderProgress('resident-render-refresh-unavailable', {
        stage: 'resident-render-refresh',
        reason: sphResidentRenderState.reason,
        particleCount: sphResidentRenderState.particleCount
      });
      return sphResidentRenderState;
    }
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || (preferWebGpu ? await requestCachedOpticalGpuDevice(overrideNavigatorRef) : null));
    if (!resolvedDeviceResult?.device) {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-webgpu-unavailable',
        source: 'cpu-particles',
        reason: resolvedDeviceResult?.reason || 'WebGPU render-row extraction not available',
        particleCount: nextSphParticleState.particleCount,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      markSphResidentRenderProgress('resident-render-refresh-webgpu-unavailable', {
        stage: 'resident-render-refresh',
        reason: sphResidentRenderState.reason,
        particleCount: sphResidentRenderState.particleCount
      });
      return sphResidentRenderState;
    }
    markSphResidentRenderProgress('resident-render-device-ready', {
      stage: 'resident-render-refresh',
      particleCount: nextSphParticleState.particleCount,
      deviceStatus: resolvedDeviceResult.status ?? null
    });
    let renderRowsExecution = null;
    let renderRowsBufferTransferredToBridge = false;
    try {
      const reactionResult = finalStep?.reactionStep?.result || finalStep?.reactionStep || null;
      const reactionSummary = reactionResult?.reactionSummary || null;
      const residentProductMass = finalStep?.residentProductMass || reactionResult?.residentProductMass || null;
      const productEventBuffer = residentProductMass?.productEventBuffer || reactionSummary?.productEventBuffer || null;
      const productEventCount = Math.max(0, Math.round(Number(
        residentProductMass?.productEventRowCount ?? reactionSummary?.productEventRowCount
      ) || 0));
      const extractRenderRowsForMode = (readbackMode) => extractSphRenderRowsWebGpu({
        device: resolvedDeviceResult.device,
        sphParticleState: nextSphParticleState,
        mlsMpmParticleState: nextMlsMpmParticleState,
        sphParticleUpload: nextSphUpload,
        mlsMpmParticleUpload: nextMlsMpmUpload,
        sourceStateBuffer: nextSphUpload.stateBuffer,
        sourceThermoBuffer: nextSphUpload.thermoBuffer,
        sourceMechanicsBuffer: nextMlsMpmUpload?.mechanicsBuffer || null,
        retainRenderRowsBuffer: true,
        readbackMode,
        ...renderDomainExtractionOptions(currentRenderDomainCounts)
      });
      const requestedRenderFieldSurfaceSummaryMode = ['auto', 'readback', 'skip'].includes(
        String(renderFieldSurfaceSummaryMode || '').toLowerCase()
      )
        ? String(renderFieldSurfaceSummaryMode || '').toLowerCase()
        : 'auto';
      const rawSurfaceDrawDiagnosticMode = [
        'auto',
        'metadata',
        'off',
        SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE,
        SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE,
        SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE,
        SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE,
        SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE,
        'three-points',
        'three-spheres',
        'three',
        'webgpu-points',
        'webgpu-spheres'
      ].includes(
        String(surfaceDrawDiagnosticMode || '').toLowerCase()
      )
        ? String(surfaceDrawDiagnosticMode || '').toLowerCase()
        : 'auto';
      const webGpuRenderRowOverlayRequestedButDisabled = Boolean(
        !SPH_WEBGPU_RENDER_ROW_OVERLAY_PRESENTATION_ENABLED
        && isWebGpuResidentRenderRowBridgeMode(rawSurfaceDrawDiagnosticMode)
      );
      const requestedSurfaceDrawDiagnosticMode = webGpuRenderRowOverlayRequestedButDisabled
        ? (
          rawSurfaceDrawDiagnosticMode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
            || rawSurfaceDrawDiagnosticMode === 'webgpu-spheres'
            ? SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
            : SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
        )
        : rawSurfaceDrawDiagnosticMode;
      const shouldUseWebGpuRenderRowOverlayBridge = isWebGpuResidentRenderRowBridgeMode(
        requestedSurfaceDrawDiagnosticMode
      );
      const shouldUseThreeRenderRowPointsBridge = requestedSurfaceDrawDiagnosticMode === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
        || requestedSurfaceDrawDiagnosticMode === 'three-points'
        || requestedSurfaceDrawDiagnosticMode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
        || requestedSurfaceDrawDiagnosticMode === 'three-spheres'
        || requestedSurfaceDrawDiagnosticMode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
        || requestedSurfaceDrawDiagnosticMode === 'three';
      const shouldUseResidentRenderRowBridge = shouldUseThreeRenderRowPointsBridge
        || shouldUseWebGpuRenderRowOverlayBridge;
      const shouldUseThreeCompactSurfaceDrawBridge = false;
      const requestedRenderRowsReadbackMode = shouldUseWebGpuRenderRowOverlayBridge
        ? RESIDENT_NO_FULL_READBACK_MODE
        : (shouldUseThreeRenderRowPointsBridge
          ? RESIDENT_FULL_READBACK_MODE
          : (renderRowsReadbackMode === RESIDENT_FULL_READBACK_MODE
            || renderRowsReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
            ? renderRowsReadbackMode
            : SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT));
      const requestedSurfaceDrawDiagnosticMaxFieldCells = Math.max(
        1,
        Math.round(Number(surfaceDrawDiagnosticMaxFieldCells) || SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT)
      );
      const requestedSurfaceDrawDiagnosticMaxResolution = Math.max(
        2,
        Math.round(Number(surfaceDrawDiagnosticMaxResolution) || SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT)
      );
      markSphResidentRenderProgress('resident-render-rows-started', {
        stage: 'render-rows',
        particleCount: nextSphParticleState.particleCount,
        readbackMode: requestedRenderRowsReadbackMode
      });
      renderRowsExecution = await extractRenderRowsForMode(requestedRenderRowsReadbackMode);
      markSphResidentRenderProgress('resident-render-rows-complete', {
        stage: 'render-rows',
        particleCount: renderRowsExecution.particleCount,
        readbackMode: renderRowsExecution.readbackMode ?? null,
        renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback),
        queueCompletionStatus: renderRowsExecution.queueCompletionStatus ?? null,
        queueCompletionMethod: renderRowsExecution.queueCompletionMethod ?? null
      });
      const hasRenderRowsReadback = renderRowsExecution.renderRows instanceof Float32Array
        && renderRowsExecution.renderRows.length > 0;
      let decoded = null;
      let particleBatches = [];
      if (hasRenderRowsReadback) {
        decoded = decodeSphRenderRows(renderRowsExecution.renderRows, {
          materialProperties: materialProperties || {},
          reactionTable: sphReactionTable,
          gasPressureSummary
        });
        particleBatches = shouldUseResidentRenderRowBridge
          ? []
          : createContinuousSurfaceBatches({
            positionsM: decoded.positionsM,
            colorsRgb: decoded.colorsRgb,
            materials: decoded.materials,
            particleRadiiM: decoded.particleRadiiM,
            boxEdgeM,
            boxDimsM: dims,
            smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
          });
      } else {
        particleBatches = sphResidentRenderSurfaceState?.particleBatches || [];
      }
      const productEventSurfaceBatches = shouldUseResidentRenderRowBridge
        ? []
        : createProductEventSurfaceBatches({
          baseBatches: particleBatches,
          reactionSummary,
          reactionTable: sphReactionTable,
          materialProperties,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
      const canReuseResidentSurfaceTable = !shouldUseResidentRenderRowBridge
        && !hasRenderRowsReadback
        && productEventSurfaceBatches.length === 0
        && sphResidentRenderSurfaceState?.surfaceTable?.schema;
      const fieldBatches = shouldUseResidentRenderRowBridge
        ? []
        : (canReuseResidentSurfaceTable
          ? sphResidentRenderSurfaceState.fieldBatches
          : createResidentRenderSurfaceBatches({
            particleBatches,
            productEventSurfaceBatches,
            materialProperties,
            reactionTable: sphReactionTable,
            smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
          }));
      if (!decoded) {
        decoded = {
          schema: 'peercompute.ulg.sph-gpu-render-rows-decoded.v0',
          status: 'render-rows-decode-skipped-resident-no-full-readback',
          particleCount: nextSphParticleState.particleCount,
          positionsM: new Float32Array(),
          colorsRgb: new Float32Array(),
          materials: fieldBatches.map((batch) => batch.descriptor),
          rows: [],
          emissiveByMaterial: sphResidentRenderSurfaceState?.emissiveByMaterial || {}
        };
      }
      if (!canReuseResidentSurfaceTable && !shouldUseResidentRenderRowBridge) {
        rebuildOpticalStateForSurfaceBatches(fieldBatches, { materialProperties });
        captureResidentRenderSurfaceState({
          particleBatches,
          fieldBatches,
          emissiveByMaterial: decoded.emissiveByMaterial,
          materialProperties
        });
      }
      const residentSurfaceTable = shouldUseResidentRenderRowBridge
        ? {
          schema: 'peercompute.ulg.sph-render-surface-table.v0',
          status: shouldUseWebGpuRenderRowOverlayBridge
            ? 'surface-table-skipped-webgpu-render-row-overlay'
            : 'surface-table-skipped-three-render-row-points',
          surfaceCount: 0,
          totalFieldCells: 0,
          maxFieldCellCount: 0,
          metadata: [],
          records: new Float32Array()
        }
        : (canReuseResidentSurfaceTable
          ? sphResidentRenderSurfaceState.surfaceTable
          : sphResidentRenderSurfaceState.surfaceTable);
      let decodedRenderRowsSummary = summarizeDecodedRenderRows(decoded);
      const decodedMaterialKeys = decodedRenderRowsSummary
        ? [...new Set(Object.keys(decodedRenderRowsSummary.materialPhaseCounts || {})
          .map((key) => key.split('|')[0])
          .filter((key) => key && key !== 'unknown'))]
        : [];
      const decodedPhaseKeys = decodedRenderRowsSummary
        ? [...new Set(Object.keys(decodedRenderRowsSummary.materialPhaseCounts || {})
          .map((key) => key.split('|')[1])
          .filter((key) => key && key !== 'unknown'))]
        : [];
      let renderFieldExecution = null;
      let materialInterfaceField = null;
      let renderFieldCpuParitySummary = null;
      let renderFieldSurfaceSummary = null;
      let renderFieldSurfaceSummarySkipped = null;
      let renderFieldSource = 'resident-gpu-render-field';
      let nextResidentSurfaceDraw = null;
      const surfaceOverlayPolicy = surfaceDrawOverlayPolicyOverride?.schema
        ? surfaceDrawOverlayPolicyOverride
        : resolveSceneResidentSurfaceDrawOverlayPolicy({ refresh: true });
      const useDiagnosticSurfaceTable = requestedSurfaceDrawDiagnosticMode === 'metadata'
        || shouldUseThreeCompactSurfaceDrawBridge
        || surfaceOverlayPolicy.enabled;
      const diagnosticSurfaceTableMaxResolution = useDiagnosticSurfaceTable
        ? diagnosticRenderFieldResolutionForBudget(fieldBatches.length, {
          maxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
          maxResolution: requestedSurfaceDrawDiagnosticMaxResolution
        })
        : null;
      const surfaceTable = useDiagnosticSurfaceTable
        ? createRenderFieldSurfaceTableForBatches(fieldBatches, {
          maxResolution: diagnosticSurfaceTableMaxResolution
        })
        : residentSurfaceTable;
      markSphResidentRenderProgress('resident-render-surface-table-ready', {
        stage: 'surface-table',
        surfaceCount: surfaceTable.surfaceCount,
        totalFieldCells: surfaceTable.totalFieldCells,
        maxFieldCellCount: surfaceTable.maxFieldCellCount,
        diagnosticMode: requestedSurfaceDrawDiagnosticMode,
        diagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
        diagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
        diagnosticSurfaceTableMaxResolution,
        overlayPolicyStatus: surfaceOverlayPolicy.status ?? null
      });
      const shouldBuildRetainedSurfaceDrawDiagnostics = Boolean(
        surfaceOverlayPolicy.enabled
        || requestedSurfaceDrawDiagnosticMode === 'metadata'
        || shouldUseThreeCompactSurfaceDrawBridge
      );
      const visibleRenderFieldReadbackMode = renderFieldReadbackMode === 'full-parity-readback'
        || renderFieldReadbackMode === 'no-full-readback'
        ? renderFieldReadbackMode
        : residentRenderFieldReadbackModeForSurfaceOverlay(surfaceOverlayPolicy.enabled);
      if (shouldUseResidentRenderRowBridge) {
        const renderRowBridgeIsSphereMode = requestedSurfaceDrawDiagnosticMode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
          || requestedSurfaceDrawDiagnosticMode === 'three-spheres'
          || requestedSurfaceDrawDiagnosticMode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
          || requestedSurfaceDrawDiagnosticMode === 'webgpu-spheres';
        const renderRowBridgeBackend = shouldUseWebGpuRenderRowOverlayBridge
          ? (renderRowBridgeIsSphereMode
            ? 'render-rows-webgpu-overlay-spheres'
            : 'render-rows-webgpu-overlay-points')
          : (renderRowBridgeIsSphereMode
            ? 'render-rows-three-sphere-bridge'
            : 'render-rows-three-point-bridge');
        const renderRowBridgeStatus = shouldUseWebGpuRenderRowOverlayBridge
          ? (renderRowBridgeIsSphereMode
            ? 'render-field-skipped-webgpu-render-row-spheres'
            : 'render-field-skipped-webgpu-render-row-points')
          : (renderRowBridgeIsSphereMode
            ? 'render-field-skipped-three-render-row-spheres'
            : 'render-field-skipped-three-render-row-points');
        const renderRowBridgeLabel = shouldUseWebGpuRenderRowOverlayBridge
          ? (renderRowBridgeIsSphereMode
            ? 'WebGPU render-row sphere overlay'
            : 'WebGPU render-row point overlay')
          : (renderRowBridgeIsSphereMode
            ? 'Three sphere bridge'
            : 'Three point bridge');
        renderFieldExecution = {
          schema: 'peercompute.ulg.sph-gpu-render-field.v0',
          backend: renderRowBridgeBackend,
          status: renderRowBridgeStatus,
          reason: shouldUseWebGpuRenderRowOverlayBridge
            ? `${renderRowBridgeLabel} renders directly from the retained GPU render-row buffer`
            : `${renderRowBridgeLabel} renders directly from GPU render-row readback`,
          surfaceCount: fieldBatches.length,
          totalFieldCells: 0,
          maxFieldCellCount: 0,
          productEventCount,
          productEventBufferBound: false,
          productEventBufferByteLength: 0,
          renderFieldInputSource: 'resident-render-rows',
          renderFieldReadback: false,
          readbackMode: RESIDENT_NO_FULL_READBACK_MODE,
          fieldRowByteLength: 0,
          normalHotLoopReadbackFree: shouldUseWebGpuRenderRowOverlayBridge,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        materialInterfaceField = {
          schema: 'peercompute.ulg.sph-material-interface-field.v0',
          status: shouldUseWebGpuRenderRowOverlayBridge
            ? (renderRowBridgeIsSphereMode
              ? 'material-interface-field-skipped-webgpu-render-row-spheres'
              : 'material-interface-field-skipped-webgpu-render-row-points')
            : (renderRowBridgeIsSphereMode
              ? 'material-interface-field-skipped-three-render-row-spheres'
              : 'material-interface-field-skipped-three-render-row-points'),
          reason: `${renderRowBridgeLabel} does not need a material-interface surface field`,
          sourceRenderFieldSchema: renderFieldExecution.schema,
          sourceRenderFieldStatus: renderFieldExecution.status,
          sourceRenderFieldReadback: false,
          sourceRenderFieldReadbackMode: renderFieldExecution.readbackMode,
          surfaceCount: fieldBatches.length,
          readySurfaceCount: 0,
          totalSurfaceAreaM2: 0,
          elementCount: 0,
          elements: [],
          gpuAuthoritativeState: true,
          compactRenderReadback: true,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
        publishSphResidentMaterialInterfaceState(materialInterfaceField);
        markSphResidentRenderProgress(
          shouldUseWebGpuRenderRowOverlayBridge
            ? 'resident-render-field-skipped-webgpu-render-row-overlay'
            : 'resident-render-field-skipped-three-points',
          {
            stage: 'render-field',
            surfaceCount: fieldBatches.length,
            particleCount: renderRowsExecution.particleCount
          }
        );
      } else {
        try {
          const buildRenderFieldForRows = () => buildSphRenderFieldWebGpu({
            device: resolvedDeviceResult.device,
            renderRows: renderRowsExecution.renderRows,
            renderRowsBuffer: renderRowsExecution.renderRowsBuffer || null,
            productEventBuffer,
            productEventCount,
            surfaceTable,
            particleCount: renderRowsExecution.particleCount,
            fieldPadding: FIELD_PADDING,
            refEdgeM,
            readbackMode: visibleRenderFieldReadbackMode,
            retainFieldRowsBuffer: true,
            retainSurfaceBuffer: true
          });
        const renderFieldHasPositiveDensity = (execution) => {
          if (!(execution?.fieldRows instanceof Float32Array) || execution.fieldRows.length === 0) return true;
          for (let index = 0; index < execution.fieldRows.length; index += 4) {
            if (execution.fieldRows[index] > 0) return true;
          }
          return false;
        };
        markSphResidentRenderProgress('resident-render-field-started', {
          stage: 'render-field',
          surfaceCount: surfaceTable.surfaceCount,
          totalFieldCells: surfaceTable.totalFieldCells,
          maxFieldCellCount: surfaceTable.maxFieldCellCount,
          readbackMode: visibleRenderFieldReadbackMode
        });
        renderFieldExecution = await buildRenderFieldForRows();
        markSphResidentRenderProgress('resident-render-field-complete', {
          stage: 'render-field',
          surfaceCount: renderFieldExecution.surfaceCount,
          totalFieldCells: renderFieldExecution.totalFieldCells,
          maxFieldCellCount: renderFieldExecution.maxFieldCellCount ?? null,
          renderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback),
          queueCompletionStatus: renderFieldExecution.queueCompletionStatus ?? null,
          queueCompletionMethod: renderFieldExecution.queueCompletionMethod ?? null
        });
        if (
          !renderFieldHasPositiveDensity(renderFieldExecution)
          && renderRowsExecution.renderRowsReadback === false
          && renderRowsExecution.particleCount > 0
        ) {
          renderFieldExecution?.releaseRenderFieldBufferLeases?.({
            status: 'released-before-empty-field-row-readback-retry'
          });
          renderFieldExecution?.destroyRenderFieldBuffers?.({
            releaseLeases: true,
            reason: 'empty-render-field-row-readback-retry'
          });
          renderRowsExecution?.destroyRenderRowsBuffer?.();
          markSphResidentRenderProgress('resident-render-rows-retry-started', {
            stage: 'render-rows',
            reason: 'empty-field-after-no-row-readback'
          });
          renderRowsExecution = await extractRenderRowsForMode('full-parity-readback');
          markSphResidentRenderProgress('resident-render-rows-retry-complete', {
            stage: 'render-rows',
            particleCount: renderRowsExecution.particleCount,
            readbackMode: renderRowsExecution.readbackMode ?? null,
            renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback)
          });
          if (renderRowsExecution.renderRows instanceof Float32Array && renderRowsExecution.renderRows.length > 0) {
            decoded = decodeSphRenderRows(renderRowsExecution.renderRows, {
              materialProperties: materialProperties || {},
              reactionTable: sphReactionTable,
              gasPressureSummary
            });
            decodedRenderRowsSummary = summarizeDecodedRenderRows(decoded);
          }
          markSphResidentRenderProgress('resident-render-field-retry-started', {
            stage: 'render-field',
            reason: 'empty-field-after-no-row-readback',
            surfaceCount: surfaceTable.surfaceCount,
            totalFieldCells: surfaceTable.totalFieldCells
          });
          renderFieldExecution = await buildRenderFieldForRows();
          markSphResidentRenderProgress('resident-render-field-retry-complete', {
            stage: 'render-field',
            surfaceCount: renderFieldExecution.surfaceCount,
            totalFieldCells: renderFieldExecution.totalFieldCells,
            renderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback)
          });
          renderFieldExecution.emptyFieldRetryReadback = true;
          renderFieldExecution.emptyFieldRetryReason = 'empty-field-after-no-row-readback';
        }
        if (
          (renderFieldExecution.fieldRows instanceof Float32Array && renderFieldExecution.fieldRows.length > 0)
          || renderFieldExecution.fieldRowsBuffer
        ) {
          renderFieldCpuParitySummary = summarizeRenderFieldCpuParity({
            renderRowsExecution,
            renderFieldExecution,
            surfaceTable
          });
          const shouldSkipRenderFieldSurfaceSummary = Boolean(
            requestedRenderFieldSurfaceSummaryMode === 'skip'
            && !renderFieldExecution.renderFieldReadback
          );
          if (shouldSkipRenderFieldSurfaceSummary) {
            renderFieldSurfaceSummarySkipped = {
              schema: 'peercompute.ulg.sph-render-field-surface-summary-skip.v0',
              status: 'render-field-surface-summary-skipped',
              mode: requestedRenderFieldSurfaceSummaryMode,
              reason: 'caller requested no compact surface-summary readback for routine no-full resident render refresh',
              renderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback),
              readbackMode: renderFieldExecution.readbackMode ?? null,
              fieldRowsBufferRetained: Boolean(renderFieldExecution.fieldRowsBuffer),
              surfaceBufferRetained: Boolean(renderFieldExecution.surfaceBuffer),
              surfaceCount: surfaceTable.surfaceCount,
              scientificValidation: false,
              sphValidation: false,
              surfaceExtractionValidation: false,
              fullPhysicsValidation: false
            };
          } else if (renderFieldExecution.fieldRowsBuffer) {
            markSphResidentRenderProgress('resident-render-field-summary-started', {
              stage: 'render-field-summary',
              surfaceCount: renderFieldExecution.surfaceCount,
              totalFieldCells: renderFieldExecution.totalFieldCells
            });
            renderFieldSurfaceSummary = await summarizeSphRenderFieldSurfacesWebGpu({
              device: resolvedDeviceResult.device,
              renderField: renderFieldExecution,
              fieldRowsBuffer: renderFieldExecution.fieldRowsBuffer,
              surfaceBuffer: renderFieldExecution.surfaceBuffer || null
            });
            markSphResidentRenderProgress('resident-render-field-summary-complete', {
              stage: 'render-field-summary',
              surfaceCount: renderFieldSurfaceSummary?.surfaceCount ?? renderFieldExecution.surfaceCount,
              activeSurfaceCount: renderFieldSurfaceSummary?.activeSurfaceCount ?? null,
              activeCellCount: renderFieldSurfaceSummary?.activeCellCount ?? null,
              queueCompletionStatus: renderFieldSurfaceSummary?.queueCompletionStatus ?? null,
              queueCompletionMethod: renderFieldSurfaceSummary?.queueCompletionMethod ?? null
            });
            if (
              !renderFieldExecution.renderFieldReadback
              && renderFieldSurfaceSummary?.activeSurfaceCount === 0
              && renderRowsExecution.renderRowsReadback === false
              && renderRowsExecution.particleCount > 0
            ) {
              renderFieldExecution?.releaseRenderFieldBufferLeases?.({
                status: 'released-before-empty-summary-row-readback-retry'
              });
              renderFieldExecution?.destroyRenderFieldBuffers?.({
                releaseLeases: true,
                reason: 'empty-render-field-summary-row-readback-retry'
              });
              renderRowsExecution?.destroyRenderRowsBuffer?.();
              markSphResidentRenderProgress('resident-render-rows-retry-started', {
                stage: 'render-rows',
                reason: 'empty-summary-after-no-row-readback'
              });
              renderRowsExecution = await extractRenderRowsForMode('full-parity-readback');
              markSphResidentRenderProgress('resident-render-rows-retry-complete', {
                stage: 'render-rows',
                particleCount: renderRowsExecution.particleCount,
                readbackMode: renderRowsExecution.readbackMode ?? null,
                renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback)
              });
              if (renderRowsExecution.renderRows instanceof Float32Array && renderRowsExecution.renderRows.length > 0) {
                decoded = decodeSphRenderRows(renderRowsExecution.renderRows, {
                  materialProperties: materialProperties || {},
                  reactionTable: sphReactionTable,
                  gasPressureSummary
                });
                decodedRenderRowsSummary = summarizeDecodedRenderRows(decoded);
              }
              markSphResidentRenderProgress('resident-render-field-retry-started', {
                stage: 'render-field',
                reason: 'empty-summary-after-no-row-readback',
                surfaceCount: surfaceTable.surfaceCount,
                totalFieldCells: surfaceTable.totalFieldCells
              });
              renderFieldExecution = await buildRenderFieldForRows();
              markSphResidentRenderProgress('resident-render-field-retry-complete', {
                stage: 'render-field',
                surfaceCount: renderFieldExecution.surfaceCount,
                totalFieldCells: renderFieldExecution.totalFieldCells,
                renderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback)
              });
              renderFieldExecution.emptyFieldRetryReadback = true;
              renderFieldExecution.emptyFieldRetryReason = 'empty-summary-after-no-row-readback';
              renderFieldSurfaceSummary = renderFieldExecution.fieldRowsBuffer
                ? await summarizeSphRenderFieldSurfacesWebGpu({
                  device: resolvedDeviceResult.device,
                  renderField: renderFieldExecution,
                  fieldRowsBuffer: renderFieldExecution.fieldRowsBuffer,
                  surfaceBuffer: renderFieldExecution.surfaceBuffer || null
                })
                : null;
            }
          } else if (renderFieldExecution.fieldRows instanceof Float32Array && renderFieldExecution.fieldRows.length > 0) {
            renderFieldSurfaceSummary = null;
          }
          if (renderFieldExecution.renderFieldReadback) {
            materialInterfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
              device: resolvedDeviceResult.device,
              renderField: renderFieldExecution,
              fieldRowsBuffer: renderFieldExecution.fieldRowsBuffer || null,
              surfaceBuffer: renderFieldExecution.surfaceBuffer || null,
              source: 'resident-render-refresh-physics-material-interface-extractor',
              sourceCadence: 'visual-render-refresh'
            });
            materialInterfaceField.renderRowsReadback = Boolean(renderRowsExecution.renderRowsReadback);
            materialInterfaceField.renderRowsReadbackMode = renderRowsExecution.readbackMode ?? null;
            materialInterfaceField.renderFieldReadback = Boolean(renderFieldExecution.renderFieldReadback);
            materialInterfaceField.renderFieldReadbackMode = renderFieldExecution.readbackMode ?? null;
            materialInterfaceField.renderFieldQueueCompletionStatus = renderFieldExecution.queueCompletionStatus ?? null;
            materialInterfaceField.renderFieldQueueCompletionMethod = renderFieldExecution.queueCompletionMethod ?? null;
            materialInterfaceField.gpuAuthoritativeState = true;
            publishSphResidentMaterialInterfaceState(materialInterfaceField);
            const surfaceFields = renderFieldExecution.fieldRows instanceof Float32Array && renderFieldExecution.fieldRows.length > 0
              ? splitSphRenderFieldBySurface(renderFieldExecution)
              : [];
            const surfaceBoundsByKey = new Map(fieldBatches.map((batch) => [batch.surfaceKey, {
              bounds: batch.bounds,
              paddingM: surfaceBoundsPaddingMForBatch(batch)
            }]));
            applySurfaceFields(surfaceFields, {
              emissiveByMaterial: decoded.emissiveByMaterial,
              materialProperties,
              renderSource: renderFieldSource,
              renderRowsExecution,
              renderFieldExecution,
              surfaceBoundsByKey
            });
          } else {
            materialInterfaceField = {
              schema: 'peercompute.ulg.sph-material-interface-field.v0',
              status: renderFieldSurfaceSummarySkipped
                ? 'material-interface-field-gpu-resident-summary-skipped'
                : 'material-interface-field-gpu-resident-summary-only',
              reason: renderFieldSurfaceSummarySkipped?.reason
                || 'no-full render refresh produced compact render-field summary without CPU material-interface readback',
              sourceRenderFieldSchema: renderFieldExecution.schema,
              sourceRenderFieldStatus: renderFieldExecution.status,
              sourceRenderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback),
              sourceRenderFieldReadbackMode: renderFieldExecution.readbackMode ?? null,
              renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
              renderFieldSurfaceSummaryStatus: renderFieldSurfaceSummary?.status ?? null,
              renderFieldSurfaceSummaryActiveSurfaceCount: renderFieldSurfaceSummary?.activeSurfaceCount ?? 0,
              renderFieldSurfaceSummaryActiveCellCount: renderFieldSurfaceSummary?.activeCellCount ?? 0,
              renderFieldSurfaceSummarySkipped: Boolean(renderFieldSurfaceSummarySkipped),
              renderFieldSurfaceSummarySkipReason: renderFieldSurfaceSummarySkipped?.reason ?? null,
              surfaceCount: surfaceTable.surfaceCount,
              readySurfaceCount: renderFieldSurfaceSummary?.activeSurfaceCount ?? 0,
              totalSurfaceAreaM2: 0,
              elementCount: 0,
              elements: [],
              gpuAuthoritativeState: true,
              compactRenderReadback: true,
              scientificValidation: false,
              sphValidation: false,
              surfaceExtractionValidation: false,
              fullPhysicsValidation: false
            };
            publishSphResidentMaterialInterfaceState(materialInterfaceField);
          }
        } else {
          materialInterfaceField = {
            schema: 'peercompute.ulg.sph-material-interface-field.v0',
            status: 'material-interface-field-gpu-resident-summary-pending',
            sourceRenderFieldSchema: renderFieldExecution.schema,
            sourceRenderFieldStatus: renderFieldExecution.status,
            sourceRenderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback),
            surfaceCount: surfaceTable.surfaceCount,
            readySurfaceCount: 0,
            totalSurfaceAreaM2: 0,
            elementCount: 0,
            elements: [],
            scientificValidation: false,
            sphValidation: false,
            surfaceExtractionValidation: false,
            fullPhysicsValidation: false
          };
        }
      } catch (fieldError) {
        renderFieldSource = 'resident-gpu-render-rows';
        applySurfaceBatches(particleBatches, {
          emissiveByMaterial: decoded.emissiveByMaterial,
          materialProperties,
          renderSource: renderFieldSource,
          renderRowsExecution
        });
        renderFieldExecution = {
          schema: 'peercompute.ulg.sph-gpu-render-field.v0',
          backend: 'cpu-fallback',
          status: 'render-field-fallback-to-render-rows',
          reason: fieldError instanceof Error ? fieldError.message : String(fieldError),
          surfaceCount: surfaceTable.surfaceCount,
          totalFieldCells: surfaceTable.totalFieldCells,
          productEventCount: 0,
          productEventBufferBound: false,
          productEventBufferByteLength: 0,
          renderFieldInputSource: null,
          renderFieldReadback: false,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      }
      if (renderFieldSource === 'resident-gpu-render-field') {
        if (shouldUseResidentRenderRowBridge) {
          renderFieldExecution?.releaseRenderFieldBufferLeases?.({
            status: shouldUseWebGpuRenderRowOverlayBridge
              ? 'retained-for-webgpu-render-row-overlay'
              : 'released-after-three-render-row-points'
          });
          renderFieldExecution?.destroyRenderFieldBuffers?.({
            releaseLeases: true,
            reason: shouldUseWebGpuRenderRowOverlayBridge
              ? 'webgpu-render-row-overlay-cleanup'
              : 'three-render-row-points-cleanup'
          });
          const renderBridge = shouldUseWebGpuRenderRowOverlayBridge
            ? createSphResidentRenderRowsWebGpuOverlayBridge({
              device: resolvedDeviceResult.device,
              renderRowsExecution,
              smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null,
              bridgeMode: requestedSurfaceDrawDiagnosticMode
            })
            : createSphResidentRenderRowsThreePointBridge({
              decoded,
              renderRowsExecution,
              smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null,
              bridgeMode: requestedSurfaceDrawDiagnosticMode
            });
          const renderBridgeReady = renderBridge?.status === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_STATUS
            || renderBridge?.status === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_STATUS
            || renderBridge?.status === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_STATUS
            || renderBridge?.status === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_STATUS;
          renderRowsBufferTransferredToBridge = Boolean(
            renderBridgeReady
            && shouldUseWebGpuRenderRowOverlayBridge
            && renderBridge?.renderRowsBufferOwned
          );
          nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
            renderBridgeReady
              ? `resident render rows are displayed through a ${renderBridge.rendererBridge} bridge`
              : (renderBridge?.reason || 'resident render-row Three bridge unavailable'),
            { renderFieldExecution, overlayPolicy: surfaceOverlayPolicy }
          );
          nextResidentSurfaceDraw.status = renderBridgeReady
            ? (renderBridge.rendererBridge === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
              ? 'resident-render-row-webgpu-spheres-built'
              : (renderBridge.rendererBridge === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
                ? 'resident-render-row-webgpu-points-built'
                : (renderBridge.rendererBridge === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
                  ? 'resident-render-row-spheres-built'
                  : 'resident-render-row-points-built')))
            : 'resident-render-row-points-unavailable';
          nextResidentSurfaceDraw.diagnosticOnly = false;
          nextResidentSurfaceDraw.diagnosticMode = requestedSurfaceDrawDiagnosticMode;
          nextResidentSurfaceDraw.requestedDiagnosticMode = rawSurfaceDrawDiagnosticMode;
          nextResidentSurfaceDraw.diagnosticFallbackReason = webGpuRenderRowOverlayRequestedButDisabled
            ? 'webgpu-render-row-overlay-disabled-pending-pixel-validation'
            : null;
          nextResidentSurfaceDraw.activeSurfaceCount = 0;
          nextResidentSurfaceDraw.vertexCount = renderBridge?.pointCount ?? renderBridge?.vertexCount ?? 0;
          nextResidentSurfaceDraw.triangleCount = renderBridge?.triangleCount ?? 0;
          nextResidentSurfaceDraw.renderFieldBufferMode = shouldUseWebGpuRenderRowOverlayBridge
            ? 'retained-render-row-webgpu-overlay-buffer'
            : 'released-after-three-render-row-points';
          nextResidentSurfaceDraw.visibleRendererBridge = renderBridgeReady
            ? renderBridge.rendererBridge
            : 'three-marching-cubes-fallback';
          nextResidentSurfaceDraw.visibleRenderSource = renderBridgeReady
            ? renderBridge.visibleRenderSource
            : 'three-marching-cubes-fallback';
          nextResidentSurfaceDraw.surfaceDrawReadback = Boolean(renderRowsExecution.renderRowsReadback);
          nextResidentSurfaceDraw.surfaceDrawSummaryReadback = false;
          nextResidentSurfaceDraw.surfaceDrawSummarySkipped = true;
          nextResidentSurfaceDraw.surfaceDrawSummaryReadbackByteLength = 0;
          nextResidentSurfaceDraw.renderBridgeSchema = renderBridge?.schema ?? null;
          nextResidentSurfaceDraw.renderBridgeStatus = renderBridge?.status ?? null;
          nextResidentSurfaceDraw.renderBridgeReason = renderBridge?.reason ?? null;
          nextResidentSurfaceDraw.renderBridgeFrameCount = renderBridge?.frameCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeLastRenderStatus = renderBridge?.lastRenderStatus ?? null;
          nextResidentSurfaceDraw.renderBridgeThreeMeshCount = renderBridge?.threeMeshCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeThreeGeometryByteLength = renderBridge?.threeGeometryByteLength ?? 0;
          nextResidentSurfaceDraw.renderBridgeEngineIntegration = renderBridge?.engineIntegration ?? null;
          nextResidentSurfaceDraw.renderBridgeReused = Boolean(renderBridge?.threeRenderBridgeReused);
          nextResidentSurfaceDraw.renderBridgeUpdateCount = renderBridge?.updateCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeRenderRowsBufferRetained = Boolean(renderBridge?.renderRowsBuffer);
          nextResidentSurfaceDraw.renderBridgeRenderRowsBufferByteLength = renderBridge?.renderRowDrawState?.renderRowsBufferByteLength ?? 0;
          nextResidentSurfaceDraw.renderBridgeDrawOrderingPolicy = renderBridge?.drawOrderingPolicy ?? null;
          nextResidentSurfaceDraw.renderBridgeDrawOrderCount = renderBridge?.drawOrderCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeDrawOrderSurfaceIndices = [...(renderBridge?.drawOrderSurfaceIndices || [])];
          nextResidentSurfaceDraw.renderBridgeDrawOrderIndirectOffsets = [...(renderBridge?.drawOrderIndirectOffsets || [])];
          nextResidentSurfaceDraw.renderBridgeDepthPolicy = renderBridge?.depthPolicy ?? null;
          nextResidentSurfaceDraw.renderBridgeDepthAttachmentFormat = renderBridge?.depthAttachmentFormat ?? null;
          nextResidentSurfaceDraw.renderBridgeDepthAttachmentReady = Boolean(renderBridge?.depthAttachmentReady);
          nextResidentSurfaceDraw.renderBridgeTransparencyCompositeMode = renderBridge?.transparencyCompositeMode ?? null;
          nextResidentSurfaceDraw.renderBridgeOitAccumFormat = renderBridge?.oitAccumFormat ?? null;
          nextResidentSurfaceDraw.renderBridgeOitRevealFormat = renderBridge?.oitRevealFormat ?? null;
          nextResidentSurfaceDraw.renderBridgeOitTargetsReady = Boolean(renderBridge?.oitTargetsReady);
          nextResidentSurfaceDraw.renderBridgeLastOpaqueDrawCount = renderBridge?.lastOpaqueDrawCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeLastTransparentDrawCount = renderBridge?.lastTransparentDrawCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeOpticalRenderSource = renderBridge?.opticalRenderSource ?? null;
          nextResidentSurfaceDraw.renderBridgeOpticalRecordCount = renderBridge?.opticalRecordCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeOpticalRecordStrideFloats = renderBridge?.opticalRecordStrideFloats ?? 0;
          nextResidentSurfaceDraw.renderBridgeOpticalSpectralSampleCount = renderBridge?.opticalSpectralSampleCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeOpticalSpectralSampleStrideFloats = renderBridge?.opticalSpectralSampleStrideFloats ?? 0;
          nextResidentSurfaceDraw.renderBridgeSphereMaterialKeys = [...(renderBridge?.sphereBridgeMaterialKeys || [])];
          nextResidentSurfaceDraw.renderBridgeSphereTransmissionProxyCount = renderBridge?.sphereBridgeTransmissionProxyCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeSphereFallbackColorCount = renderBridge?.sphereBridgeFallbackColorCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeSphereReusedMeshCount = renderBridge?.sphereBridgeReusedMeshCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeSphereCreatedMeshCount = renderBridge?.sphereBridgeCreatedMeshCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeSphereDisposedMeshCount = renderBridge?.sphereBridgeDisposedMeshCount ?? 0;
          nextResidentSurfaceDraw.renderBridgeMinParticleRadiusM = renderBridge?.minParticleRadiusM ?? null;
          nextResidentSurfaceDraw.renderBridgeMaxParticleRadiusM = renderBridge?.maxParticleRadiusM ?? null;
          nextResidentSurfaceDraw.renderBridgeTemporalSwapPolicy = renderBridge?.temporalSwapPolicy ?? null;
          nextResidentSurfaceDraw.renderBridgeRetainedPreviousOverlay = Boolean(renderBridge?.retainedPreviousOverlay);
        } else if (
          !shouldBuildRetainedSurfaceDrawDiagnostics
          && !renderFieldExecution?.renderFieldReadback
          && (renderFieldSurfaceSummary || renderFieldSurfaceSummarySkipped)
        ) {
          renderFieldExecution?.releaseRenderFieldBufferLeases?.({
            status: renderFieldSurfaceSummarySkipped
              ? 'released-after-render-field-summary-skipped'
              : 'released-after-render-field-summary'
          });
          renderFieldExecution?.destroyRenderFieldBuffers?.({
            releaseLeases: true,
            reason: renderFieldSurfaceSummarySkipped
              ? 'render-field-summary-skipped-cleanup'
              : 'render-field-summary-only-cleanup'
          });
          nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
            renderFieldSurfaceSummarySkipped?.reason
              || 'resident render-field compact summary available; surface vertex overlay deferred',
            { renderFieldExecution, overlayPolicy: surfaceOverlayPolicy }
          );
          nextResidentSurfaceDraw.status = renderFieldSurfaceSummarySkipped
            ? 'resident-surface-draw-summary-skipped'
            : 'resident-surface-draw-summary-only';
          nextResidentSurfaceDraw.activeSurfaceCount = renderFieldSurfaceSummary?.activeSurfaceCount ?? 0;
          nextResidentSurfaceDraw.vertexCount = 0;
          nextResidentSurfaceDraw.triangleCount = 0;
          nextResidentSurfaceDraw.renderFieldBufferMode = renderFieldSurfaceSummarySkipped
            ? 'released-after-render-field-summary-skipped'
            : 'released-after-render-field-summary';
          nextResidentSurfaceDraw.visibleRendererBridge = renderFieldSurfaceSummarySkipped
            ? 'summary-skipped-no-overlay'
            : 'summary-only-no-overlay';
          nextResidentSurfaceDraw.visibleRenderSource = renderFieldSurfaceSummarySkipped
            ? 'resident-render-field-summary-skipped'
            : 'resident-render-field-compact-summary';
          nextResidentSurfaceDraw.surfaceDrawSummaryReadback = Boolean(
            renderFieldSurfaceSummary?.renderFieldSurfaceSummaryReadback
          );
          nextResidentSurfaceDraw.surfaceDrawSummarySkipped = Boolean(renderFieldSurfaceSummarySkipped);
        } else if (shouldBuildRetainedSurfaceDrawDiagnostics) {
          const renderFieldTotalCells = Math.max(0, Math.round(Number(
            renderFieldExecution?.totalFieldCells ?? surfaceTable?.totalFieldCells
          ) || 0));
          const diagnosticOverBudget = Boolean(
            (requestedSurfaceDrawDiagnosticMode === 'metadata' || shouldUseThreeCompactSurfaceDrawBridge)
            && renderFieldTotalCells > requestedSurfaceDrawDiagnosticMaxFieldCells
          );
          if (diagnosticOverBudget) {
            renderFieldExecution?.releaseRenderFieldBufferLeases?.({
              status: 'released-after-surface-draw-diagnostic-budget-skip'
            });
            renderFieldExecution?.destroyRenderFieldBuffers?.({
              releaseLeases: true,
              reason: 'surface-draw-diagnostic-field-cell-budget-skip'
            });
            nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
              `surface draw diagnostic metadata skipped: render field has ${renderFieldTotalCells} cells, over budget ${requestedSurfaceDrawDiagnosticMaxFieldCells}`,
              { renderFieldExecution, overlayPolicy: surfaceOverlayPolicy }
            );
            nextResidentSurfaceDraw.status = 'resident-surface-draw-diagnostic-skipped';
            nextResidentSurfaceDraw.diagnosticOnly = true;
            nextResidentSurfaceDraw.diagnosticMode = requestedSurfaceDrawDiagnosticMode;
            nextResidentSurfaceDraw.diagnosticSkipped = true;
            nextResidentSurfaceDraw.diagnosticSkipReason = 'surface-draw-diagnostic-field-cell-budget-exceeded';
            nextResidentSurfaceDraw.diagnosticFieldCellCount = renderFieldTotalCells;
            nextResidentSurfaceDraw.diagnosticMaxFieldCells = requestedSurfaceDrawDiagnosticMaxFieldCells;
            nextResidentSurfaceDraw.diagnosticMaxResolution = requestedSurfaceDrawDiagnosticMaxResolution;
            nextResidentSurfaceDraw.diagnosticSurfaceTableMaxResolution = diagnosticSurfaceTableMaxResolution;
            nextResidentSurfaceDraw.renderFieldBufferMode = 'released-after-surface-draw-diagnostic-budget-skip';
            nextResidentSurfaceDraw.visibleRendererBridge = 'diagnostic-skipped-no-overlay';
            nextResidentSurfaceDraw.visibleRenderSource = 'resident-surface-draw-diagnostic-skipped';
            nextResidentSurfaceDraw.renderBridgeSchema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
            nextResidentSurfaceDraw.renderBridgeStatus = surfaceOverlayPolicy.status;
            nextResidentSurfaceDraw.renderBridgeReason = surfaceOverlayPolicy.reason || SPH_THREE_WEBGPU_BINDING_REASON;
          } else {
            markSphResidentRenderProgress('resident-render-surface-draw-diagnostic-started', {
              stage: 'surface-draw-diagnostic',
              surfaceCount: renderFieldExecution.surfaceCount,
              totalFieldCells: renderFieldTotalCells,
              diagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
              diagnosticSurfaceTableMaxResolution
            });
	            nextResidentSurfaceDraw = await buildSphResidentSurfaceDrawBridge({
	              device: resolvedDeviceResult.device,
	              renderFieldExecution,
	              buildDrawMetadata: !(
	                requestedSurfaceDrawDiagnosticMode === 'metadata'
	                && !surfaceOverlayPolicy.enabled
	              ),
                  renderBridgeMode: shouldUseThreeCompactSurfaceDrawBridge
                    ? SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
                    : null,
                  materialProperties
	            });
            markSphResidentRenderProgress('resident-render-surface-draw-diagnostic-complete', {
              stage: 'surface-draw-diagnostic',
              surfaceCount: nextResidentSurfaceDraw?.surfaceCount ?? 0,
              activeSurfaceCount: nextResidentSurfaceDraw?.activeSurfaceCount ?? null,
              vertexCount: nextResidentSurfaceDraw?.vertexCount ?? null,
              triangleCount: nextResidentSurfaceDraw?.triangleCount ?? null,
              status: nextResidentSurfaceDraw?.status ?? null
            });
            if (
              requestedSurfaceDrawDiagnosticMode === 'metadata'
              && !surfaceOverlayPolicy.enabled
              && nextResidentSurfaceDraw?.status
              && nextResidentSurfaceDraw.status !== 'resident-surface-draw-unavailable'
            ) {
              nextResidentSurfaceDraw.diagnosticOnly = true;
              nextResidentSurfaceDraw.diagnosticMode = requestedSurfaceDrawDiagnosticMode;
              nextResidentSurfaceDraw.diagnosticFieldCellCount = renderFieldTotalCells;
              nextResidentSurfaceDraw.diagnosticMaxFieldCells = requestedSurfaceDrawDiagnosticMaxFieldCells;
              nextResidentSurfaceDraw.diagnosticMaxResolution = requestedSurfaceDrawDiagnosticMaxResolution;
              nextResidentSurfaceDraw.diagnosticSurfaceTableMaxResolution = diagnosticSurfaceTableMaxResolution;
              nextResidentSurfaceDraw.visibleRendererBridge = 'diagnostic-only-no-overlay';
              nextResidentSurfaceDraw.visibleRenderSource = 'resident-surface-draw-diagnostic-buffers';
              nextResidentSurfaceDraw.renderBridgeStatus = surfaceOverlayPolicy.status;
              nextResidentSurfaceDraw.renderBridgeReason = surfaceOverlayPolicy.reason || SPH_THREE_WEBGPU_BINDING_REASON;
            }
            if (
              nextResidentSurfaceDraw?.visibleRendererBridge === 'webgpu-storage-indirect-overlay'
              || nextResidentSurfaceDraw?.visibleRendererBridge === 'three-compact-surface-geometry'
            ) {
              suppressThreeSurfaceMeshesForResidentOverlay(
                nextResidentSurfaceDraw.visibleRendererBridge === 'three-compact-surface-geometry'
                  ? 'resident-surface-draw-three-compact-active'
                  : 'resident-surface-draw-overlay-active'
              );
            }
          }
        } else {
          renderFieldExecution?.releaseRenderFieldBufferLeases?.({
            status: 'released-after-three-marching-cubes-readback'
          });
          renderFieldExecution?.destroyRenderFieldBuffers?.({
            releaseLeases: true,
            reason: 'three-marching-cubes-readback-cleanup'
          });
          nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
            surfaceOverlayPolicy.reason || SPH_THREE_WEBGPU_BINDING_REASON,
            { renderFieldExecution, overlayPolicy: surfaceOverlayPolicy }
          );
          nextResidentSurfaceDraw.visibleRendererBridge = 'three-marching-cubes';
          nextResidentSurfaceDraw.visibleRenderSource = 'three-managed-render-field-readback';
          nextResidentSurfaceDraw.renderFieldBufferMode = 'released-after-three-marching-cubes-readback';
          nextResidentSurfaceDraw.renderBridgeSchema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
          nextResidentSurfaceDraw.renderBridgeStatus = surfaceOverlayPolicy.status;
          nextResidentSurfaceDraw.renderBridgeReason = surfaceOverlayPolicy.reason || SPH_THREE_WEBGPU_BINDING_REASON;
        }
      } else {
        nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
          renderFieldExecution?.reason || 'render field fell back to render rows',
          { renderFieldExecution }
        );
      }
      if (
        nextResidentSurfaceDraw?.visibleRendererBridge === 'webgpu-storage-indirect-overlay'
        || nextResidentSurfaceDraw?.visibleRendererBridge === 'three-compact-surface-geometry'
        || nextResidentSurfaceDraw?.visibleRendererBridge === 'three-render-row-points'
        || nextResidentSurfaceDraw?.visibleRendererBridge === 'three-render-row-spheres'
        || nextResidentSurfaceDraw?.visibleRendererBridge === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
        || nextResidentSurfaceDraw?.visibleRendererBridge === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
      ) {
        sphResidentSurfaceDraw = nextResidentSurfaceDraw;
        scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
        releasePreviousSphResidentSurfaceDrawResources(previousResidentSurfaceDraw, previousResidentRenderBridge);
      } else {
        clearSphResidentSurfaceDrawArtifacts();
        sphResidentSurfaceDraw = nextResidentSurfaceDraw;
        scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
      }
      markSphResidentRenderProgress('resident-render-optical-lookup-started', {
        stage: 'optical-lookup',
        source: 'resident-render-refresh'
      });
      await refreshOpticalGpuLookup({
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult
      });
      markSphResidentRenderProgress('resident-render-optical-lookup-complete', {
        stage: 'optical-lookup',
        source: 'resident-render-refresh'
      });
      const shouldSkipPressureInterfaceRefresh = Boolean(
        skipPressureInterfaceRefresh
        || (
          surfaceOverlayPolicy.enabled
          && visibleRenderFieldReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
        )
      );
      markSphResidentRenderProgress('resident-render-pressure-interface-started', {
        stage: 'pressure-interface',
        source: 'resident-render-refresh',
        skipped: shouldSkipPressureInterfaceRefresh
      });
      const pressureInterfaceState = shouldSkipPressureInterfaceRefresh
        ? {
          schema: 'peercompute.ulg.sph-pressure-interface-state.v0',
          status: 'pressure-interface-refresh-skipped',
          source: 'resident-render-validation',
          sourceCadence: 'visual-render-refresh',
          reason: skipPressureInterfaceRefresh
            ? 'validation render refresh requested pressure-interface skip'
            : 'resident overlay render refresh skips pressure-interface producer work'
        }
        : await refreshSphResidentPressureInterfaceState({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device: device || resolvedDeviceResult?.device || null,
          deviceResult: resolvedDeviceResult,
          materialInterfaceField,
          gasPressureSummary,
          residentProductMass,
          reactionSummary,
          reactionTable: sphReactionTable,
          residentAuthorityHost: effectiveResidentAuthorityHost,
          pressureInterfaceGasCellFieldAdmission,
          pressureInterfaceGasCellFieldImport,
          pressureInterfaceGasCellFieldImportStateKey,
          source: 'resident-render-field-pressure-interface-producer',
          sourceCadence: 'visual-render-refresh'
        });
      markSphResidentRenderProgress('resident-render-pressure-interface-complete', {
        stage: 'pressure-interface',
        source: 'resident-render-refresh',
        skipped: shouldSkipPressureInterfaceRefresh,
        status: pressureInterfaceState?.status ?? null
      });
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: renderFieldSource === 'resident-gpu-render-field'
          ? 'resident-render-field-applied'
          : 'resident-render-rows-applied',
        source: renderFieldSource,
        sourceExecutionSchema: renderFieldSource === 'resident-gpu-render-field'
          ? renderFieldExecution.schema
          : renderRowsExecution.schema,
        backend: renderFieldSource === 'resident-gpu-render-field'
          ? renderFieldExecution.backend
          : renderRowsExecution.backend,
        particleCount: decoded.particleCount,
        surfaceCount: fieldBatches.length,
        rowStrideFloats: renderRowsExecution.rowStrideFloats,
        renderRowByteLength: renderRowsExecution.renderRowByteLength,
        renderRowsReadbackByteLength: renderRowsExecution.renderRowsReadbackByteLength ?? renderRowsExecution.renderRows?.byteLength ?? 0,
        renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback),
        renderRowsReadbackMode: renderRowsExecution.readbackMode ?? null,
        renderRowsGpuHandoffCopy: Boolean(renderRowsExecution.renderRowsGpuHandoffCopy),
        renderRowsHandoffMode: renderRowsExecution.renderRowsHandoffMode ?? null,
        renderRowsDecodedSummary: decodedRenderRowsSummary,
        renderRowsDecodedMaterialPhaseCounts: decodedRenderRowsSummary?.materialPhaseCounts ?? null,
        renderRowsDecodedMaterialPhaseDomainCounts: decodedRenderRowsSummary?.materialPhaseDomainCounts ?? null,
        renderRowsDecodedMaterialPhaseDomainBounds: decodedRenderRowsSummary?.materialPhaseDomainBounds ?? null,
        renderRowsDecodedPositionCount: decodedRenderRowsSummary?.positionCount ?? null,
        renderRowsDecodedTotalMassKg: decodedRenderRowsSummary?.totalMassKg ?? null,
        renderRowsDecodedCenterOfMassM: decodedRenderRowsSummary?.centerOfMassM ?? null,
        renderRowsDecodedPositionBoundsM: decodedRenderRowsSummary?.positionBoundsM ?? null,
        renderRowsDecodedMinParticleRadiusM: decodedRenderRowsSummary?.minParticleRadiusM ?? null,
        renderRowsDecodedMaxParticleRadiusM: decodedRenderRowsSummary?.maxParticleRadiusM ?? null,
        renderRowsDecodedSampleRows: decodedRenderRowsSummary?.sampleRows ?? null,
        renderFieldCellStrideFloats: renderFieldExecution?.rowStrideFloats ?? null,
        renderFieldByteLength: renderFieldExecution?.fieldRowByteLength ?? 0,
        renderFieldReadback: Boolean(renderFieldExecution?.renderFieldReadback),
        renderFieldStatus: renderFieldExecution?.status ?? null,
        renderFieldBackend: renderFieldExecution?.backend ?? null,
        renderFieldInputSource: renderFieldExecution?.renderFieldInputSource ?? null,
        renderFieldCpuParitySummary,
        renderFieldEmptyRetryReadback: Boolean(renderFieldExecution?.emptyFieldRetryReadback),
        renderFieldEmptyRetryReason: renderFieldExecution?.emptyFieldRetryReason ?? null,
        renderFieldSurfaceCount: renderFieldExecution?.surfaceCount ?? surfaceTable.surfaceCount,
        renderFieldTotalCells: renderFieldExecution?.totalFieldCells ?? surfaceTable.totalFieldCells,
        renderFieldSurfaceSummaryStatus: renderFieldSurfaceSummary?.status ?? null,
        renderFieldSurfaceSummaryReadback: Boolean(renderFieldSurfaceSummary?.renderFieldSurfaceSummaryReadback),
        renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
        renderFieldSurfaceSummarySkipped: Boolean(renderFieldSurfaceSummarySkipped),
        renderFieldSurfaceSummarySkipReason: renderFieldSurfaceSummarySkipped?.reason ?? null,
        renderFieldSurfaceSummaryByteLength: renderFieldSurfaceSummary?.summaryRowsByteLength ?? 0,
        renderFieldSurfaceSummaryActiveSurfaceCount: renderFieldSurfaceSummary?.activeSurfaceCount ?? 0,
        renderFieldSurfaceSummaryActiveCellCount: renderFieldSurfaceSummary?.activeCellCount ?? 0,
        renderFieldSurfaceSummaryMaxDensity: renderFieldSurfaceSummary?.maxDensity ?? null,
        renderFieldSurfaceSummarySurfaces: Array.isArray(renderFieldSurfaceSummary?.surfaces)
          ? renderFieldSurfaceSummary.surfaces.map((surface) => ({
            surfaceKey: surface.surfaceKey ?? null,
            material: surface.material ?? null,
            phase: surface.phase ?? null,
            renderKey: surface.renderKey ?? null,
            surfaceIndex: surface.surfaceIndex ?? null,
            activeCellCount: surface.activeCellCount ?? 0,
            maxDensity: surface.maxDensity ?? null,
            isolation: surface.isolation ?? null,
            boundsCenterM: surface.boundsCenterM ? [...surface.boundsCenterM] : null,
            boundsRadiusM: surface.boundsRadiusM ?? null,
            status: surface.status ?? null
          }))
          : [],
        surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
        surfaceDrawRequestedDiagnosticMode: rawSurfaceDrawDiagnosticMode,
        surfaceDrawDiagnosticFallbackReason: webGpuRenderRowOverlayRequestedButDisabled
          ? 'webgpu-render-row-overlay-disabled-pending-pixel-validation'
          : null,
        surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
        surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
        surfaceDrawDiagnosticSurfaceTableMaxResolution: diagnosticSurfaceTableMaxResolution,
        surfaceDrawDiagnosticsBuilt: Boolean(
          requestedSurfaceDrawDiagnosticMode === 'metadata'
          && nextResidentSurfaceDraw?.status
          && nextResidentSurfaceDraw.status !== 'resident-surface-draw-unavailable'
          && nextResidentSurfaceDraw.status !== 'resident-surface-draw-diagnostic-skipped'
        ),
        surfaceDrawDiagnosticsSkipped: Boolean(sphResidentSurfaceDraw?.diagnosticSkipped),
        surfaceDrawDiagnosticsSkipReason: sphResidentSurfaceDraw?.diagnosticSkipReason ?? null,
        surfaceDrawDiagnosticFieldCellCount: sphResidentSurfaceDraw?.diagnosticFieldCellCount ?? null,
        renderFieldBufferMode: sphResidentSurfaceDraw?.renderFieldBufferMode ?? null,
        surfaceDrawOverlayPolicyStatus: sphResidentSurfaceDraw?.overlayPolicyStatus
          ?? surfaceOverlayPolicy.status
          ?? null,
        surfaceDrawOverlayPolicyMode: sphResidentSurfaceDraw?.overlayPolicyMode
          ?? surfaceOverlayPolicy.mode
          ?? null,
        surfaceDrawOverlayPolicyEnabled: Boolean(surfaceOverlayPolicy.enabled),
        surfaceDrawSchema: sphResidentSurfaceDraw?.schema ?? null,
        surfaceDrawStatus: sphResidentSurfaceDraw?.status ?? null,
        surfaceDrawReason: sphResidentSurfaceDraw?.reason ?? null,
        surfaceDrawSourceRenderFieldSchema: sphResidentSurfaceDraw?.sourceRenderFieldSchema ?? null,
        surfaceDrawSourceSurfaceVertexSchema: sphResidentSurfaceDraw?.sourceSurfaceVertexSchema ?? null,
        surfaceDrawSurfaceDrawSchema: sphResidentSurfaceDraw?.surfaceDrawSchema ?? null,
        surfaceDrawSurfaceCount: sphResidentSurfaceDraw?.surfaceCount ?? 0,
        surfaceDrawActiveSurfaceCount: sphResidentSurfaceDraw?.activeSurfaceCount ?? null,
        surfaceDrawVertexCount: sphResidentSurfaceDraw?.vertexCount ?? null,
        surfaceDrawTriangleCount: sphResidentSurfaceDraw?.triangleCount ?? null,
        surfaceDrawSourceVertexRowCount: sphResidentSurfaceDraw?.sourceVertexRowCount ?? 0,
        surfaceDrawVertexRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.surfaceVertexRowsBufferRetained),
        surfaceDrawVertexRowsBufferByteLength: sphResidentSurfaceDraw?.surfaceVertexRowsBufferByteLength ?? 0,
        surfaceDrawRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.drawRowsBufferRetained),
        surfaceDrawRowsBufferByteLength: sphResidentSurfaceDraw?.drawRowsBufferByteLength ?? 0,
        surfaceDrawIndirectSchema: sphResidentSurfaceDraw?.drawIndirectSchema ?? null,
        surfaceDrawIndirectRowStrideUints: sphResidentSurfaceDraw?.drawIndirectRowStrideUints ?? 0,
        surfaceDrawIndirectRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.drawIndirectRowsBufferRetained),
        surfaceDrawIndirectRowsBufferByteLength: sphResidentSurfaceDraw?.drawIndirectRowsBufferByteLength ?? 0,
        surfaceDrawCompactedVertexRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.compactedVertexRowsBufferRetained),
        surfaceDrawCompactedVertexRowsBufferByteLength: sphResidentSurfaceDraw?.compactedVertexRowsBufferByteLength ?? 0,
        surfaceDrawLeaseStatus: sphResidentSurfaceDraw?.residentBufferLeaseLedgerStatus ?? null,
        surfaceDrawLeaseResourceCount: sphResidentSurfaceDraw?.residentBufferLeaseResourceCount ?? 0,
        surfaceDrawLeaseActiveCount: sphResidentSurfaceDraw?.residentBufferLeaseActiveLeaseCount ?? 0,
        surfaceDrawLeaseSummary: sphResidentSurfaceDraw?.residentBufferLeaseSummary ?? null,
        surfaceDrawReadback: Boolean(sphResidentSurfaceDraw?.surfaceDrawReadback),
        surfaceDrawSummaryReadback: Boolean(sphResidentSurfaceDraw?.surfaceDrawSummaryReadback),
        surfaceDrawSummaryReadbackByteLength: sphResidentSurfaceDraw?.surfaceDrawSummaryReadbackByteLength ?? 0,
        fullSurfaceDrawReadback: Boolean(sphResidentSurfaceDraw?.fullSurfaceDrawReadback),
        surfaceDrawReadbackMode: sphResidentSurfaceDraw?.readbackMode ?? null,
        surfaceDrawCompactionMode: sphResidentSurfaceDraw?.compactionMode ?? null,
        surfaceDrawDiagnosticOnly: Boolean(sphResidentSurfaceDraw?.diagnosticOnly),
        surfaceDrawDiagnosticOnlyMode: sphResidentSurfaceDraw?.diagnosticMode ?? null,
        surfaceDrawInputBuffersReleased: Boolean(sphResidentSurfaceDraw?.surfaceDrawInputBuffersReleased),
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeSchema: sphResidentSurfaceDraw?.renderBridgeSchema ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDraw?.renderBridgeStatus ?? null,
        surfaceDrawRenderBridgeReason: sphResidentSurfaceDraw?.renderBridgeReason ?? null,
        surfaceDrawRenderBridgeCapabilitySchema: sphResidentSurfaceDraw?.renderBridgeCapabilitySchema ?? null,
        surfaceDrawRenderBridgeCapabilityStatus: sphResidentSurfaceDraw?.renderBridgeCapabilityStatus ?? null,
        surfaceDrawRenderBridgeCapabilityReason: sphResidentSurfaceDraw?.renderBridgeCapabilityReason ?? null,
        surfaceDrawRenderBridgeRendererBackend: sphResidentSurfaceDraw?.renderBridgeRendererBackend ?? scene.userData.sphRendererBackend ?? null,
        surfaceDrawRenderBridgeBackendBufferBindingAvailable: Boolean(sphResidentSurfaceDraw?.renderBridgeBackendBufferBindingAvailable),
        surfaceDrawRenderBridgeSameDeviceGpuBufferGeometrySupported: Boolean(
          sphResidentSurfaceDraw?.renderBridgeSameDeviceGpuBufferGeometrySupported
        ),
        surfaceDrawRenderBridgeVisibleNoReadbackSupported: Boolean(
          sphResidentSurfaceDraw?.renderBridgeVisibleNoReadbackSupported
        ),
        surfaceDrawRenderBridgeRequestedThreeCompactReadbackBridge: Boolean(
          sphResidentSurfaceDraw?.renderBridgeRequestedThreeCompactReadbackBridge
        ),
        surfaceDrawRenderBridgeFrameCount: sphResidentSurfaceDraw?.renderBridgeFrameCount ?? 0,
        surfaceDrawRenderBridgeLastRenderStatus: sphResidentSurfaceDraw?.renderBridgeLastRenderStatus ?? null,
        surfaceDrawRenderBridgeThreeMeshCount: sphResidentSurfaceDraw?.renderBridgeThreeMeshCount ?? 0,
        surfaceDrawRenderBridgeThreeGeometryByteLength: sphResidentSurfaceDraw?.renderBridgeThreeGeometryByteLength ?? 0,
        surfaceDrawRenderBridgeEngineIntegration: sphResidentSurfaceDraw?.renderBridgeEngineIntegration
          ?? sphResidentSurfaceDrawRenderBridge?.engineIntegration
          ?? null,
        surfaceDrawRenderBridgeReused: Boolean(
          sphResidentSurfaceDraw?.renderBridgeReused
          || sphResidentSurfaceDrawRenderBridge?.threeRenderBridgeReused
        ),
        surfaceDrawRenderBridgeUpdateCount: sphResidentSurfaceDraw?.renderBridgeUpdateCount
          ?? sphResidentSurfaceDrawRenderBridge?.updateCount
          ?? 0,
        surfaceDrawRenderBridgeRenderRowsBufferRetained: Boolean(
          sphResidentSurfaceDraw?.renderBridgeRenderRowsBufferRetained
        ),
        surfaceDrawRenderBridgeRenderRowsBufferByteLength: sphResidentSurfaceDraw?.renderBridgeRenderRowsBufferByteLength ?? 0,
        surfaceDrawRenderBridgeDrawOrderingPolicy: sphResidentSurfaceDraw?.renderBridgeDrawOrderingPolicy ?? null,
        surfaceDrawRenderBridgeDrawOrderCount: sphResidentSurfaceDraw?.renderBridgeDrawOrderCount ?? 0,
        surfaceDrawRenderBridgeDrawOrderSurfaceIndices: [...(sphResidentSurfaceDraw?.renderBridgeDrawOrderSurfaceIndices || [])],
        surfaceDrawRenderBridgeDrawOrderIndirectOffsets: [...(sphResidentSurfaceDraw?.renderBridgeDrawOrderIndirectOffsets || [])],
        surfaceDrawRenderBridgeDepthPolicy: sphResidentSurfaceDraw?.renderBridgeDepthPolicy ?? null,
        surfaceDrawRenderBridgeDepthAttachmentFormat: sphResidentSurfaceDraw?.renderBridgeDepthAttachmentFormat ?? null,
        surfaceDrawRenderBridgeDepthAttachmentReady: Boolean(sphResidentSurfaceDraw?.renderBridgeDepthAttachmentReady),
        surfaceDrawRenderBridgeTransparencyCompositeMode: sphResidentSurfaceDraw?.renderBridgeTransparencyCompositeMode ?? null,
        surfaceDrawRenderBridgeOitAccumFormat: sphResidentSurfaceDraw?.renderBridgeOitAccumFormat ?? null,
        surfaceDrawRenderBridgeOitRevealFormat: sphResidentSurfaceDraw?.renderBridgeOitRevealFormat ?? null,
        surfaceDrawRenderBridgeOitTargetsReady: Boolean(sphResidentSurfaceDraw?.renderBridgeOitTargetsReady),
        surfaceDrawRenderBridgeLastOpaqueDrawCount: sphResidentSurfaceDraw?.renderBridgeLastOpaqueDrawCount ?? 0,
        surfaceDrawRenderBridgeLastTransparentDrawCount: sphResidentSurfaceDraw?.renderBridgeLastTransparentDrawCount ?? 0,
        surfaceDrawRenderBridgeOpticalRenderSource: sphResidentSurfaceDraw?.renderBridgeOpticalRenderSource ?? null,
        surfaceDrawRenderBridgeOpticalRecordCount: sphResidentSurfaceDraw?.renderBridgeOpticalRecordCount ?? 0,
        surfaceDrawRenderBridgeOpticalRecordStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalRecordStrideFloats ?? 0,
        surfaceDrawRenderBridgeOpticalSpectralSampleCount: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? 0,
        surfaceDrawRenderBridgeOpticalSpectralSampleStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleStrideFloats ?? 0,
        surfaceDrawRenderBridgeSphereMaterialKeys: [...(sphResidentSurfaceDraw?.renderBridgeSphereMaterialKeys || [])],
        surfaceDrawRenderBridgeSphereTransmissionProxyCount: sphResidentSurfaceDraw?.renderBridgeSphereTransmissionProxyCount ?? 0,
        surfaceDrawRenderBridgeSphereFallbackColorCount: sphResidentSurfaceDraw?.renderBridgeSphereFallbackColorCount ?? 0,
        surfaceDrawRenderBridgeSphereReusedMeshCount: sphResidentSurfaceDraw?.renderBridgeSphereReusedMeshCount ?? 0,
        surfaceDrawRenderBridgeSphereCreatedMeshCount: sphResidentSurfaceDraw?.renderBridgeSphereCreatedMeshCount ?? 0,
        surfaceDrawRenderBridgeSphereDisposedMeshCount: sphResidentSurfaceDraw?.renderBridgeSphereDisposedMeshCount ?? 0,
        surfaceDrawRenderBridgeMinParticleRadiusM: sphResidentSurfaceDraw?.renderBridgeMinParticleRadiusM ?? null,
        surfaceDrawRenderBridgeMaxParticleRadiusM: sphResidentSurfaceDraw?.renderBridgeMaxParticleRadiusM ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDraw?.renderBridgeTemporalSwapPolicy
          ?? sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy
          ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(
          sphResidentSurfaceDraw?.renderBridgeRetainedPreviousOverlay
          || sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay
        ),
        renderRowsBufferRetained: Boolean(renderRowsExecution.renderRowsBufferRetained),
        renderRowsBufferByteLength: renderRowsExecution.renderRowsBufferByteLength ?? 0,
        productEventCount,
        productEventBufferBound: Boolean(renderFieldExecution?.productEventBufferBound),
        productEventBufferByteLength: renderFieldExecution?.productEventBufferByteLength ?? 0,
        residentProductMassStatus: residentProductMass?.status ?? null,
        residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
        productEventSurfaceCount: productEventSurfaceBatches.length,
        productEventSurfaceKeys: productEventSurfaceBatches.map((batch) => batch.surfaceKey),
        compactRenderReadback: Boolean(renderRowsExecution.compactRenderReadback),
        normalHotLoopReadbackFree: Boolean(
          renderRowsExecution.normalHotLoopReadbackFree
          && renderFieldExecution?.normalHotLoopReadbackFree
          && sphResidentSurfaceDraw?.surfaceDrawReadback === false
        ),
        residentSurfaceTableStatus: sphResidentRenderSurfaceState?.status ?? null,
        residentSurfaceTableSurfaceCount: sphResidentRenderSurfaceState?.surfaceTableSurfaceCount ?? 0,
        residentSurfaceTableTotalFieldCells: sphResidentRenderSurfaceState?.surfaceTableTotalFieldCells ?? 0,
        materialKeys: [...new Set([
          ...fieldBatches.map((batch) => batch.material),
          ...decodedMaterialKeys,
          ...Object.keys(materialProperties || {})
        ].filter(Boolean))],
        phaseKeys: [...new Set([
          ...fieldBatches.map((batch) => batch.phase),
          ...decodedPhaseKeys
        ].filter(Boolean))],
        gasPressureSummaryStatus: gasPressureSummary?.status ?? null,
        gasPressureSummarySource: gasPressureSummary?.source ?? null,
        residentPressureOpticalStateApplied: decoded.materials.some((descriptor) => Boolean(descriptor.opticalState)),
        materialInterfaceField,
        materialInterfaceFieldSchema: materialInterfaceField?.schema ?? null,
        materialInterfaceFieldStatus: materialInterfaceField?.status ?? null,
        materialInterfaceReadySurfaceCount: materialInterfaceField?.readySurfaceCount ?? 0,
        materialInterfaceTotalSurfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
        ...pressureInterfaceRenderStateFields(pressureInterfaceState),
        gpuAuthoritativeState: true,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    } catch (error) {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-rows-error',
        source: 'cpu-particles',
        reason: error instanceof Error ? error.message : String(error),
        particleCount: nextSphParticleState.particleCount,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeEngineIntegration: sphResidentSurfaceDrawRenderBridge?.engineIntegration ?? null,
        surfaceDrawRenderBridgeReused: Boolean(sphResidentSurfaceDrawRenderBridge?.threeRenderBridgeReused),
        surfaceDrawRenderBridgeUpdateCount: sphResidentSurfaceDrawRenderBridge?.updateCount ?? 0,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    } finally {
      if (!renderRowsBufferTransferredToBridge) {
        renderRowsExecution?.destroyRenderRowsBuffer?.();
      }
    }
  }

  async function debugSphResidentParticleUpload({
    preferWebGpu = true,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    residentSteps = mlsMpmResidentSteps,
    includeRenderRows = true
  } = {}) {
    const finalStep = residentSteps?.finalStep || mlsMpmResidentStep || null;
    const nextSphParticleState = residentSteps?.nextSphParticleState || sphGpuParticleState;
    const nextSphUpload = residentSteps?.nextParticleUploads?.sphParticleUpload
      || finalStep?.nextParticleUploads?.sphParticleUpload
      || null;
    if (!nextSphParticleState?.schema || nextSphUpload?.status !== 'webgpu-uploaded') {
      return {
        schema: 'peercompute.ulg.sph-resident-particle-upload-debug.v0',
        status: 'resident-particle-upload-debug-source-unavailable',
        reason: 'retained resident SPH buffers are not available',
        particleCount: nextSphParticleState?.particleCount ?? 0,
        uploadStatus: nextSphUpload?.status ?? null,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || (preferWebGpu ? await requestCachedOpticalGpuDevice(overrideNavigatorRef) : null));
    if (!resolvedDeviceResult?.device) {
      return {
        schema: 'peercompute.ulg.sph-resident-particle-upload-debug.v0',
        status: 'resident-particle-upload-debug-webgpu-unavailable',
        reason: resolvedDeviceResult?.reason || 'WebGPU debug readback not available',
        particleCount: nextSphParticleState.particleCount,
        uploadStatus: nextSphUpload.status,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    return summarizeSphResidentParticleUploadWebGpu({
      device: resolvedDeviceResult.device,
      sphParticleState: nextSphParticleState,
      sphParticleUpload: nextSphUpload,
      sourceStateBuffer: nextSphUpload.stateBuffer,
      sourceThermoBuffer: nextSphUpload.thermoBuffer,
      includeRenderRows,
      ...renderDomainExtractionOptions(currentRenderDomainCounts)
    });
  }

  let running = true;
  function animate() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    renderSphResidentSurfaceDrawOverlay();
    requestAnimationFrame(animate);
  }
  animate();

  function resize({ reason = 'resize' } = {}) {
    const viewport = resolveSphSceneViewportSize(container, {
      fallbackWidth: width,
      fallbackHeight: height
    });
    const w = viewport.width;
    const h = viewport.height;
    const pixelRatio = resolveSphScenePixelRatio(window.devicePixelRatio);
    camera.aspect = viewport.aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    resizeSphResidentSurfaceDrawOverlayCanvas();
    const drawingBufferSize = renderer.getDrawingBufferSize?.(new THREE.Vector2());
    scene.userData.sphViewportResize = {
      schema: 'peercompute.ulg.sph-scene-viewport-resize.v0',
      status: 'viewport-resized',
      reason,
      cssWidth: w,
      cssHeight: h,
      backingWidth: drawingBufferSize?.x ?? renderer.domElement?.width ?? null,
      backingHeight: drawingBufferSize?.y ?? renderer.domElement?.height ?? null,
      pixelRatio,
      containerClientWidth: viewport.clientWidth || null,
      containerClientHeight: viewport.clientHeight || null,
      containerRectWidth: viewport.rectWidth || null,
      containerRectHeight: viewport.rectHeight || null,
      visualViewportWidth: viewport.visualViewportWidth || null,
      visualViewportHeight: viewport.visualViewportHeight || null,
      updatedAtMs: nowMs(),
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    return scene.userData.sphViewportResize;
  }

  function refreshViewportAndOverlay({ reason = 'manual-refresh' } = {}) {
    try {
      const resizeStatus = resize({ reason });
      controls.update();
      renderer.render(scene, camera);
      renderSphResidentSurfaceDrawOverlay();
      const rect = renderer.domElement?.getBoundingClientRect?.();
      const drawingBufferSize = renderer.getDrawingBufferSize?.(new THREE.Vector2());
      const status = {
        schema: 'peercompute.ulg.sph-scene-viewport-refresh.v0',
        status: 'viewport-refresh-rendered',
        reason,
        width: drawingBufferSize?.x ?? renderer.domElement?.width ?? null,
        height: drawingBufferSize?.y ?? renderer.domElement?.height ?? null,
        cssWidth: rect?.width ?? resizeStatus?.cssWidth ?? null,
        cssHeight: rect?.height ?? resizeStatus?.cssHeight ?? null,
        pixelRatio: resizeStatus?.pixelRatio ?? resolveSphScenePixelRatio(window.devicePixelRatio),
        resizeStatus,
        overlayCanvasWidth: sphResidentSurfaceDrawRenderBridge?.canvas?.width ?? null,
        overlayCanvasHeight: sphResidentSurfaceDrawRenderBridge?.canvas?.height ?? null,
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphViewportRefresh = status;
      return status;
    } catch (error) {
      const status = {
        schema: 'peercompute.ulg.sph-scene-viewport-refresh.v0',
        status: 'viewport-refresh-error',
        reason,
        error: error instanceof Error ? error.message : String(error),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphViewportRefresh = status;
      return status;
    }
  }

  function forceViewportRefreshBurst({ reason = 'manual-refresh-burst', frameCount = 2 } = {}) {
    const requestedFrames = Math.max(0, Math.round(Number(frameCount) || 0));
    const baseStatus = {
      schema: 'peercompute.ulg.sph-scene-viewport-refresh-burst.v0',
      status: 'viewport-refresh-burst-scheduled',
      reason,
      requestedFrameCount: requestedFrames,
      completedFrameCount: 0,
      immediateRefresh: null,
      lastRefresh: null,
      updatedAtMs: nowMs(),
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    scene.userData.sphViewportRefreshBurst = baseStatus;
    if (!running) {
      scene.userData.sphViewportRefreshBurst = {
        ...baseStatus,
        status: 'viewport-refresh-burst-skipped-not-running',
        updatedAtMs: nowMs()
      };
      return scene.userData.sphViewportRefreshBurst;
    }
    const immediateRefresh = refreshViewportAndOverlay({ reason: `${reason}:immediate` });
    scene.userData.sphViewportRefreshBurst = {
      ...baseStatus,
      status: requestedFrames > 0 ? 'viewport-refresh-burst-running' : 'viewport-refresh-burst-complete',
      immediateRefresh,
      lastRefresh: immediateRefresh,
      updatedAtMs: nowMs()
    };
    const runFrame = (index) => {
      if (index > requestedFrames) return;
      requestAnimationFrame(() => {
        if (!running) return;
        const refresh = refreshViewportAndOverlay({ reason: `${reason}:raf-${index}` });
        scene.userData.sphViewportRefreshBurst = {
          ...baseStatus,
          status: index >= requestedFrames ? 'viewport-refresh-burst-complete' : 'viewport-refresh-burst-running',
          immediateRefresh,
          lastRefresh: refresh,
          completedFrameCount: index,
          updatedAtMs: nowMs()
        };
        runFrame(index + 1);
      });
    };
    runFrame(1);
    return scene.userData.sphViewportRefreshBurst;
  }

  function scheduleVisibilityResumeRefresh(reason, frameCount = 2) {
    if (!running) return;
    forceViewportRefreshBurst({ reason, frameCount });
  }

  function handleVisibilityChange() {
    if (container.ownerDocument?.visibilityState === 'visible') {
      scheduleVisibilityResumeRefresh('document-visibility-visible');
    }
  }

  function handlePageShow() {
    scheduleVisibilityResumeRefresh('window-pageshow');
  }

  function handleWindowResize() {
    scheduleVisibilityResumeRefresh('window-resize', 1);
  }

  function handleVisualViewportResize() {
    scheduleVisibilityResumeRefresh('visual-viewport-resize', 2);
  }

  function handleOrientationChange() {
    scheduleVisibilityResumeRefresh('window-orientationchange', 3);
  }

  let resizeObserver = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      scheduleVisibilityResumeRefresh('container-resize-observer', 1);
    });
    resizeObserver.observe(container);
  }

  window.addEventListener('resize', handleWindowResize);
  window.visualViewport?.addEventListener?.('resize', handleVisualViewportResize);
  window.visualViewport?.addEventListener?.('scroll', handleVisualViewportResize);
  window.addEventListener('orientationchange', handleOrientationChange);
  container.ownerDocument?.addEventListener?.('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handlePageShow);

  function dispose() {
    running = false;
    resizeObserver?.disconnect?.();
    window.removeEventListener('resize', handleWindowResize);
    window.visualViewport?.removeEventListener?.('resize', handleVisualViewportResize);
    window.visualViewport?.removeEventListener?.('scroll', handleVisualViewportResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
    container.ownerDocument?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pageshow', handlePageShow);
    controls.dispose();
    for (const { mesh } of surfaces.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    environment?.dispose?.();
    pmrem?.dispose?.();
    if (sphGpuParticleUpload?.status === 'webgpu-uploaded') destroySphGpuParticleBuffers(sphGpuParticleUpload);
    if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
      destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
    }
    clearMlsMpmResidentExecutionArtifacts();
    clearSphResidentSurfaceDrawArtifacts();
    publishSphResidentMaterialInterfaceState(null);
    publishSphResidentPressureInterfaceState(null);
    destroyPressureInterfaceForceRowsUpload();
    if (sphResidentSurfaceDrawRenderBridge?.canvas?.parentNode) {
      sphResidentSurfaceDrawRenderBridge.canvas.parentNode.removeChild(sphResidentSurfaceDrawRenderBridge.canvas);
    }
    sphResidentSurfaceDrawRenderBridge = null;
    scene.userData.sphResidentSurfaceDrawRenderBridge = null;
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  function setSurfaceRadiusScale(scale) {
    if (Number.isFinite(scale) && scale > 0) radiusScale = scale;
  }

  return {
    setParticles,
    setSurfaceRadiusScale,
    refreshViewportAndOverlay,
    dispose,
    scene,
    camera,
    getBoxDimensionsM() {
      return [...dims];
    },
    getOpticalGpuTable() {
      return opticalGpuTable;
    },
    getOpticalGpuLookup() {
      return opticalGpuLookup;
    },
    getSphThermalMaterialTable() {
      return sphThermalMaterialTable;
    },
    getSphThermalClosureGraphBuffers() {
      return sphThermalClosureGraphBuffers;
    },
    getSphThermalPhaseResponseTable() {
      return sphThermalPhaseResponseTable;
    },
    getSphThermalResponseGraphUpload() {
      return sphThermalResponseGraphUpload;
    },
    getMlsMpmMechanicsMaterialTable() {
      return mlsMpmMechanicsMaterialTable;
    },
    getSphReactionTable() {
      return sphReactionTable;
    },
    getOpticalGpuDrawState() {
      return scene.userData.opticalGpuLookupDrawState;
    },
    getSphGpuParticleState() {
      return sphGpuParticleState;
    },
    getSphGpuParticleUpload() {
      return sphGpuParticleUpload;
    },
    getMlsMpmGpuParticleState() {
      return mlsMpmGpuParticleState;
    },
    getMlsMpmGpuParticleUpload() {
      return mlsMpmGpuParticleUpload;
    },
    getMlsMpmMechanicsPrediction() {
      return mlsMpmMechanicsPrediction;
    },
    getMlsMpmP2gGridProjection() {
      return mlsMpmP2gGridProjection;
    },
    getMlsMpmGridUpdate() {
      return mlsMpmGridUpdate;
    },
    getMlsMpmG2pReconstruction() {
      return mlsMpmG2pReconstruction;
    },
    getMlsMpmResidentStep() {
      return mlsMpmResidentStep;
    },
    getMlsMpmResidentSteps() {
      return mlsMpmResidentSteps;
    },
    getMlsMpmResidentRequestedReadbackMode() {
      return scene.userData.mlsMpmResidentRequestedReadbackMode;
    },
    getSphResidentRenderState() {
      return sphResidentRenderState;
    },
    getSphResidentMaterialInterfaceState() {
      return sphResidentMaterialInterfaceState;
    },
    getSphResidentPressureInterfaceState() {
      return sphResidentPressureInterfaceState;
    },
    getSphResidentSurfaceDraw() {
      return sphResidentSurfaceDraw;
    },
    getSphResidentSurfaceDrawRenderBridge() {
      return sphResidentSurfaceDrawRenderBridge;
    },
    getSphResidentSurfaceDrawOverlayPolicy() {
      return resolveSceneResidentSurfaceDrawOverlayPolicy();
    },
    getResidentAuthorityHost() {
      return resolveSceneResidentAuthorityHost();
    },
    setResidentAuthorityHost,
    resetResidentStateForParticleReset,
    refreshOpticalGpuLookup,
    refreshSphGpuParticleBuffers,
    refreshMlsMpmGpuParticleBuffers,
    refreshMlsMpmMechanicsPrediction,
    refreshMlsMpmP2gGridProjection,
    refreshMlsMpmGridUpdate,
    refreshMlsMpmG2pReconstruction,
    refreshMlsMpmResidentStep,
    refreshMlsMpmResidentSteps,
    refreshSphResidentMaterialInterfaceState,
    refreshSphResidentPressureInterfaceState,
    refreshSphResidentSurfaceDrawFromExtension,
    refreshSphResidentRenderState,
    debugSphResidentParticleUpload,
    requestOpticalGpuDevice: requestCachedOpticalGpuDevice
  };
}
