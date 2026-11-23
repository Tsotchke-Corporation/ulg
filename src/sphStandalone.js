// Standalone entry for ULG (GitHub Pages build). Drops straight into the
// empty, unallocated particle simulation studio with zero launch page.
import './styles.css';
import {
  NodeKernel,
  ComputeManager,
  StateManager,
  GPUHubManager,
  createResidentStageWorkerBackend,
  createRemoteResultQuorumValidator
} from './runtime/peercomputeCore.js';
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
