// Standalone entry for ULG (GitHub Pages build). Drops straight into the
// empty, unallocated particle simulation studio with zero launch page.
import './styles.css';
import { NodeKernel } from '../../peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js';
import { ComputeManager } from '../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
import { StateManager } from '../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
import {
  GPUHubManager,
  createResidentStageWorkerBackend
} from '../../peercompute/peercompute/src/peercompute/gpu/GPUHubManager.js';
import {
  createRemoteResultQuorumValidator
} from '../../peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import childWorkerModuleUrl from './services/dummyChild.worker.js?worker&url';
import serviceWorkerModuleUrl from './services/dummyService.worker.js?worker&url';
import residentMechanicsStageWorkerModuleUrl from './services/ulgMechanicsResidentStage.worker.js?worker&url';
import ulgRuntimeWorkerModuleUrl from './services/ulgRuntime.worker.js?worker&url';
import { mountUlgSimStudioApp } from './visualization/ulgSimStudioApp.js';

const peercomputeModule = Object.freeze({
  NodeKernel,
  ComputeManager,
  StateManager,
  GPUHubManager,
  createResidentStageWorkerBackend,
  createRemoteResultQuorumValidator
});

function rejectedSphRuntime(error) {
  const failure = error instanceof Error ? error : new Error(String(error));
  return Object.freeze({
    async runSphPhaseRebuild() {
      throw failure;
    }
  });
}

const residentComputeTaskModulePath = import.meta.env.PROD
  ? new URL('./assets/sphMlsMpmGpuStep.js', document.baseURI).href
  : undefined;

mountUlgSimStudioApp({
  container: document.querySelector('#app'),
  peercomputeModule,
  residentMechanicsStageWorkerModuleUrl,
  residentComputeTaskModulePath,
  async createRuntime() {
    const canBootstrap = Boolean(
      globalThis.navigator?.gpu && typeof globalThis.Worker === 'function'
    );
    if (!canBootstrap) return null;
    return createDemoRuntime({
      deferTriadServices: true,
      deferGpuProbe: true,
      serviceWorkerModuleUrl,
      ulgRuntimeWorkerModuleUrl,
      childWorkerModuleUrl
    }).catch(rejectedSphRuntime);
  }
});
