// Canonical slim PeerCompute runtime entrypoint for ULG (Gate 0A).
// Re-exports strictly from PeerCompute's official dependency-free `core.js`
// entrypoint — zero AI-inference (onnxruntime-web / transformers / wllama /
// sf3d / diffusion) modules are imported on this boundary.

export {
  NodeKernel,
  REMOTE_COMPUTE_REQUEST_SCHEMA,
  REMOTE_COMPUTE_RESULT_SCHEMA,
  REMOTE_TASK_GRAPH_REQUEST_SCHEMA,
  REMOTE_TASK_GRAPH_RESULT_SCHEMA,
  ComputeManager,
  StateManager,
  ReservationLedger,
  RESERVATION_LEDGER_SCHEMA,
  SpatialTileLeaseBroker,
  SPATIAL_TILE_LEASE_SCHEMA,
  SPATIAL_TILE_BOUNDARY_SCHEMA,
  SPATIAL_TILE_EVENT_SCHEMA,
  SPATIAL_TILE_STATES,
  DataState,
  LocalArtifactCache,
  LOCAL_ARTIFACT_CACHE_SCHEMA,
  NetworkManager,
  CONNECTION_PATHS,
  DIRECT_UNICAST_PROTOCOL,
  ICE_TRANSPORT_POLICIES,
  classifyConnectionPath,
  normalizeIceTransportPolicy,
  GPUHubManager,
  ResidentStageWorkerBackend,
  createResidentStageWorkerBackend,
  createRemoteResultQuorumValidator,
  evaluateRemoteResultQuorum,
  createPlacementAdmissionPolicy,
  evaluatePlacementAdmission,
  GpuResidentLaneManager,
  registerDefaultWorkerBootstrapURL,
  getDefaultWorkerBootstrapURL
} from '../../../peercompute/peercompute/src/peercompute/core.js';

export const PEERCOMPUTE_CORE_ENTRYPOINT_SCHEMA = 'peercompute.ulg.peercompute-core.v1';
