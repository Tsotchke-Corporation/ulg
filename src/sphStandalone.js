// Standalone entry for the SPH phase demo (GitHub Pages build). Mounts the demo overlay directly,
// with no surrounding multi-demo shell. Re-launches if the overlay is closed so the page is never
// left blank.
import './styles.css';
import * as peercomputeModule from '../../peercompute/peercompute/src/peercompute/index.js';
import residentMechanicsStageWorkerModuleUrl from './services/ulgMechanicsResidentStage.worker.js?worker&url';
import { mountSphPhaseDemoOverlay } from './visualization/sphPhaseDemoMount.js';

async function launch() {
  const residentComputeTaskModulePath = import.meta.env.PROD
    ? new URL('./assets/sphMlsMpmGpuStep.js', document.baseURI).href
    : undefined;
  const handle = await mountSphPhaseDemoOverlay({
    peercomputeModule,
    residentMechanicsStageWorkerModuleUrl,
    residentComputeTaskModulePath
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
