import './styles.css';
import { registerDefaultWorkerBootstrapURL } from './runtime/peercomputeCore.js';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import childWorkerModuleUrl from './services/dummyChild.worker.js?worker&url';
import serviceWorkerModuleUrl from './services/dummyService.worker.js?worker&url';
import ulgRuntimeWorkerModuleUrl from './services/ulgRuntime.worker.js?worker&url';
import { mountUlgSimStudioApp } from './visualization/ulgSimStudioApp.js';

if (import.meta.env.PROD) {
  registerDefaultWorkerBootstrapURL(
    new URL('./assets/peercomputeCompute.worker.js', document.baseURI).href
  );
}

function rejectedSphRuntime(error) {
  const failure = error instanceof Error ? error : new Error(String(error));
  return Object.freeze({
    async runSphPhaseRebuild() {
      throw failure;
    }
  });
}

const residentMechanicsStageWorkerModuleUrl = import.meta.env.PROD
  ? new URL('./assets/ulgMechanicsResidentStage.worker.js', document.baseURI).href
  : undefined;
const residentComputeTaskModulePath = import.meta.env.PROD
  ? new URL('./assets/sphMlsMpmGpuStep.js', document.baseURI).href
  : undefined;

mountUlgSimStudioApp({
  container: document.querySelector('#app'),
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
