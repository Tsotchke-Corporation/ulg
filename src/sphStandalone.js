// Standalone entry for the SPH phase demo (GitHub Pages build). Mounts the demo overlay directly,
// with no surrounding multi-demo shell. Re-launches if the overlay is closed so the page is never
// left blank.
import './styles.css';
import * as peercomputeModule from '../../peercompute/peercompute/src/peercompute/index.js';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import childWorkerModuleUrl from './services/dummyChild.worker.js?worker&url';
import serviceWorkerModuleUrl from './services/dummyService.worker.js?worker&url';
import residentMechanicsStageWorkerModuleUrl from './services/ulgMechanicsResidentStage.worker.js?worker&url';
import ulgRuntimeWorkerModuleUrl from './services/ulgRuntime.worker.js?worker&url';
import { mountSphPhaseDemoOverlay } from './visualization/sphPhaseDemoMount.js';

function rejectedSphRuntime(error) {
  const failure = error instanceof Error ? error : new Error(String(error));
  return Object.freeze({
    async runSphPhaseRebuild() {
      throw failure;
    }
  });
}

async function launch() {
  const residentComputeTaskModulePath = import.meta.env.PROD
    ? new URL('./assets/sphMlsMpmGpuStep.js', document.baseURI).href
    : undefined;
  // Let the overlay render its explicit prerequisite block when a browser
  // lacks WebGPU or Worker construction. When those capabilities exist, the
  // standalone page supplies the same supervised ULG runtime worker as the
  // main application; it must never fall back to a main-thread driver.
  const canBootstrapRuntime = Boolean(
    globalThis.navigator?.gpu && typeof globalThis.Worker === 'function'
  );
  const runtime = canBootstrapRuntime
    ? await createDemoRuntime({
      deferTriadServices: true,
      deferGpuProbe: true,
      serviceWorkerModuleUrl,
      ulgRuntimeWorkerModuleUrl,
      childWorkerModuleUrl
    }).catch(rejectedSphRuntime)
    : null;
  const handle = await mountSphPhaseDemoOverlay({
    peercomputeModule,
    residentMechanicsStageWorkerModuleUrl,
    residentComputeTaskModulePath,
    runtime
  });
  const overlay = handle?.overlay || document.querySelector('#sph-phase-overlay');
  const closeBtn = overlay?.querySelector('#sph-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      // The overlay removes itself on close; on the standalone page, bring it straight back.
      setTimeout(launch, 0);
    });
  }
  return handle;
}

launch();
