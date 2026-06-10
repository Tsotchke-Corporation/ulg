// Standalone entry for the SPH phase demo (GitHub Pages build). Mounts the demo overlay directly,
// with no surrounding multi-demo shell. Re-launches if the overlay is closed so the page is never
// left blank.
import './styles.css';
import { mountSphPhaseDemoOverlay } from './visualization/sphPhaseDemoMount.js';

function launch() {
  const handle = mountSphPhaseDemoOverlay();
  const overlay = document.querySelector('#sph-phase-overlay');
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
