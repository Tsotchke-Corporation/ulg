import { mountUlgUniversesDemo } from './demos/ulgUniversesDemo.js';

async function boot() {
  try {
    const api = await mountUlgUniversesDemo();
    window.__ulgUniversesDemo = api;
  } catch (err) {
    const fb = document.getElementById('uv-webgpu-fallback');
    const title = document.getElementById('uv-fallback-title');
    const msg = document.getElementById('uv-fallback-msg');
    if (title) title.textContent = 'WebGPU Initialization Failed';
    if (msg) msg.textContent = err instanceof Error ? err.message : String(err);
    fb?.classList.add('visible');
    console.error('[ULG Universes] boot failed:', err);
  }
}

void boot();
