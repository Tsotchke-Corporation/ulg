import { mountOrganicLabDemo } from './demos/organicLabDemo.js';

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    mountOrganicLabDemo().catch((err) => {
      const banner = document.getElementById('error-banner');
      const txt = document.getElementById('error-text');
      if (banner && txt) {
        txt.textContent = String(err?.message || err || 'Unknown WebGPU error');
        banner.classList.add('visible');
      }
      console.error('[ULG Organic Lab] Mount error:', err);
    });
  });
}
