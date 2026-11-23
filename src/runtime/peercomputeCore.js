// Canonical slim PeerCompute runtime entrypoint for ULG (Gate 0A).
// Exposes strictly scheduling, state, reservation, network, and GPUHub
// primitives — zero AI-inference (onnxruntime-web / transformers / wllama /
// sf3d / diffusion) modules are imported on this boundary.

export {
  NodeKernel,
  REMOTE_COMPUTE_REQUEST_SCHEMA,
  REMOTE_COMPUTE_RESULT_SCHEMA,
  REMOTE_TASK_GRAPH_REQUEST_SCHEMA,
  REMOTE_TASK_GRAPH_RESULT_SCHEMA
} from '../../../peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js';
export { ComputeManager } from '../../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
export { StateManager } from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
export {
  ReservationLedger,
  RESERVATION_LEDGER_SCHEMA
} from '../../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';
export { DataState } from '../../../peercompute/peercompute/src/peercompute/stateManager/DataState.js';
export {
  GPUHubManager,
  ResidentStageWorkerBackend,
  createResidentStageWorkerBackend
} from '../../../peercompute/peercompute/src/peercompute/gpu/GPUHubManager.js';
export {
  createRemoteResultQuorumValidator,
  evaluateRemoteResultQuorum
} from '../../../peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js';
export {
  createPlacementAdmissionPolicy,
  evaluatePlacementAdmission
} from '../../../peercompute/peercompute/src/peercompute/computeManager/PlacementAdmissionPolicy.js';
export { GpuResidentLaneManager } from '../../../peercompute/peercompute/src/peercompute/computeManager/GpuResidentLaneManager.js';
export {
  LOCAL_ARTIFACT_CACHE_SCHEMA,
  LocalArtifactCache
} from '../../../peercompute/peercompute/src/peercompute/stateManager/LocalArtifactCache.js';

export const PEERCOMPUTE_CORE_ENTRYPOINT_SCHEMA = 'peercompute.ulg.peercompute-core.v1';
