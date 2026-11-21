import './styles.css';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import childWorkerModuleUrl from './services/dummyChild.worker.js?worker&url';
import serviceWorkerModuleUrl from './services/dummyService.worker.js?worker&url';
import ulgRuntimeWorkerModuleUrl from './services/ulgRuntime.worker.js?worker&url';
import { mountUlgSimStudioApp } from './visualization/ulgSimStudioApp.js';

function rejectedSphRuntime(error) {
  const failure = error instanceof Error ? error : new Error(String(error));
  return Object.freeze({
    async runSphPhaseRebuild() {
      throw failure;
    }
  });
}

mountUlgSimStudioApp({
  container: document.querySelector('#app'),
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
