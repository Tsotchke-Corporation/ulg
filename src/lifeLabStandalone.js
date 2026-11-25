import { mountLifeLabDemo } from './demos/lifeLabDemo.js';

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    mountLifeLabDemo().catch((err) => {
      const banner = document.getElementById('error-banner');
      const txt = document.getElementById('error-text');
      if (banner && txt) {
        txt.textContent = String(err?.message || err || 'Unknown WebGPU error');
        banner.classList.add('visible');
      }
      console.error('[ULG Life Lab] Mount error:', err);
    });
  });
}
