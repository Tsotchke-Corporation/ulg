// Gate 5D Top-Anchor Interactive Supergalactic FLRW TreePM Demo (`src/demos/supergalacticDemo.js`).
// Evolves full-Nyquist GPU Zel'dovich P(k) dark-matter + baryon cosmic-web filaments
// live on WebGPU using Gate 0B's `fft3dWebGpu` (1 queue.submit/step, live 16-bin
// GPU P(k) power-spectrum telemetry) and renders via zero-copy WebGPU compute->render
// instanced billboards synchronously inside requestAnimationFrame.
// Locked camera by default (`cameraAutoSpin: false`; opt-in via `?cameraAutoSpin=1`)
// with interactive pointer-drag orbit controls.

import {
  buildZeldovichCosmologyICsWebGpu,
  createSupergalacticTreePmSessionWebGpu
} from '../runtime/astrophysics/supergalacticTreePmGpu.js';
import { attachWebGpuUncapturedErrorTelemetry } from '../runtime/webgpuDeviceLimits.js';

const canvas = document.getElementById('viewport');
const pkCanvas = document.getElementById('pk-canvas');
const hudAz = document.getElementById('hud-az');
const hudSigma = document.getElementById('hud-sigma');
const hudDmax = document.getElementById('hud-dmax');
const hudN = document.getElementById('hud-n');
const hudStatus = document.getElementById('hud-status');
const toggleBtn = document.getElementById('toggle-run');
const resetBtn = document.getElementById('reset-sim');
const spinBtn = document.getElementById('toggle-spin');

const urlParams = new URLSearchParams(window.location.search);
let cameraAutoSpin = urlParams.get('cameraAutoSpin') === '1';

const renderWgsl = /* wgsl */ `
struct RenderUniforms {
  angle_y: f32,
  angle_x: f32,
  inv_half_box: f32,
  aspect: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> particles: array<CosmoParticle>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) quad_uv: vec2<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let pt = particles[iid];
  let p = pt.pos_m.xyz * u.inv_half_box;
  let cy = cos(u.angle_y); let sy = sin(u.angle_y);
  let cx = cos(u.angle_x); let sx = sin(u.angle_x);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cx - z1 * sx;
  let z2 = p.y * sx + z1 * cx + 2.6;
  let inv_z = 1.65 / max(0.35, z2);
  let center = vec2<f32>((x1 * inv_z) / max(0.5, u.aspect), y2 * inv_z);

  let rho = clamp(pt.vel_rho.w, 0.08, 1.0);
  let is_baryon = pt.tag.x > 0.5;
  let pt_size = (0.0055 + 0.011 * rho) * inv_z;
  let ndc = center + vec2<f32>((uv.x * pt_size) / max(0.5, u.aspect), uv.y * pt_size);

  let col_dm = mix(vec3<f32>(0.22, 0.35, 0.85), vec3<f32>(0.38, 0.86, 1.0), rho);
  let col_hi = mix(col_dm, vec3<f32>(1.0, 0.88, 0.50), smoothstep(0.50, 1.0, rho));
  let col = select(col_hi, mix(vec3<f32>(0.90, 0.38, 0.22), vec3<f32>(1.0, 0.82, 0.48), rho), is_baryon);

  var out: VsOut;
  out.pos = vec4<f32>(ndc, clamp(z2 * 0.08, 0.0, 0.999), 1.0);
  out.color = vec4<f32>(col, 0.22 + 0.55 * rho);
  out.quad_uv = uv;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.quad_uv, in.quad_uv);
  if (r2 > 1.0) { discard; }
  let glow = exp(-3.4 * r2);
  return vec4<f32>(in.color.rgb * glow, in.color.a * glow);
}
`;

let device = null;
let session = null;
let running = true;
let stepping = false;
let angleY = 0.42;
let angleX = 0.28;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let firstPkSnapshot = null;

function drawPowerSpectrum(pk) {
  if (!pkCanvas || !pk || !pk.kBins?.length) return;
  const ctx2d = pkCanvas.getContext('2d');
  if (!ctx2d) return;
  const w = pkCanvas.width;
  const h = pkCanvas.height;
  ctx2d.fillStyle = '#050b16';
  ctx2d.fillRect(0, 0, w, h);

  if (!firstPkSnapshot && pk.pkValues.some((v) => v > 0)) {
    firstPkSnapshot = { kBins: [...pk.kBins], pkValues: [...pk.pkValues] };
  }

  const logK = pk.kBins.map((k) => Math.log10(Math.max(1e-4, k)));
  const logP = pk.pkValues.map((p) => Math.log10(Math.max(1e-6, p)));
  const kMin = Math.min(...logK);
  const kMax = Math.max(kMin + 0.2, ...logK);
  const allP = [...logP, ...(firstPkSnapshot ? firstPkSnapshot.pkValues.map((p) => Math.log10(Math.max(1e-6, p))) : [])];
  const pMin = Math.min(...allP) - 0.3;
  const pMax = Math.max(pMin + 1.0, ...allP) + 0.3;

  const mapX = (lk) => 12 + ((lk - kMin) / (kMax - kMin)) * (w - 22);
  const mapY = (lp) => (h - 14) - ((lp - pMin) / (pMax - pMin)) * (h - 28);

  ctx2d.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx2d.lineWidth = 1;
  ctx2d.strokeRect(10, 12, w - 20, h - 24);

  if (firstPkSnapshot) {
    ctx2d.beginPath();
    ctx2d.strokeStyle = 'rgba(148,163,184,0.55)';
    ctx2d.setLineDash([3, 3]);
    firstPkSnapshot.kBins.forEach((k, i) => {
      const x = mapX(Math.log10(Math.max(1e-4, k)));
      const y = mapY(Math.log10(Math.max(1e-6, firstPkSnapshot.pkValues[i])));
      if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
    });
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  }

  ctx2d.beginPath();
  ctx2d.strokeStyle = '#38bdf8';
  ctx2d.lineWidth = 2;
  logK.forEach((lk, i) => {
    const x = mapX(lk);
    const y = mapY(logP[i]);
    if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
  });
  ctx2d.stroke();

  ctx2d.fillStyle = '#94a3b8';
  ctx2d.font = '10px monospace';
  ctx2d.fillText(`GPU P(k) · D(a)/D0=${(pk.linearGrowthRatio || 1).toFixed(2)}x`, 12, 10);
}

canvas.addEventListener('pointerdown', (ev) => {
  dragging = true;
  lastPointerX = ev.clientX;
  lastPointerY = ev.clientY;
  canvas.setPointerCapture?.(ev.pointerId);
});
canvas.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const dx = ev.clientX - lastPointerX;
  const dy = ev.clientY - lastPointerY;
  lastPointerX = ev.clientX;
  lastPointerY = ev.clientY;
  angleY += dx * 0.008;
  angleX = Math.max(-1.45, Math.min(1.45, angleX + dy * 0.008));
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

async function boot() {
  let adapter = null;
  for (let attempt = 0; attempt < 8 && !adapter; attempt += 1) {
    adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) {
    hudStatus.textContent = 'WebGPU unavailable (fail-closed)';
    return;
  }
  device = await adapter.requestDevice();
  attachWebGpuUncapturedErrorTelemetry(device, { label: 'supergalactic-demo' });

  const ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const resize = () => {
    canvas.width = Math.max(320, Math.floor(window.innerWidth * window.devicePixelRatio));
    canvas.height = Math.max(240, Math.floor(window.innerHeight * window.devicePixelRatio));
    ctx.configure({
      device,
      format,
      alphaMode: 'opaque',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
  };
  resize();
  window.addEventListener('resize', resize);

  const shader = device.createShaderModule({ code: renderWgsl });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' }
  });
  const uBuf = device.createBuffer({ size: 16, usage: 0x40 | 0x08 });
  let renderBg = null;

  const initSession = async () => {
    if (session) session.destroy();
    firstPkSnapshot = null;
    const gpuIc = await buildZeldovichCosmologyICsWebGpu(device, {
      gridPerSide: 24,
      fftGridN: 32,
      boxLengthMpc: 200,
      aInit: 0.05,
      amplitude: 0.42
    });
    session = createSupergalacticTreePmSessionWebGpu(device, {
      gridPerSide: 24,
      pmGridN: 32,
      boxLengthMpc: 200,
      aInit: 0.05,
      da: 0.012,
      initialConditions: gpuIc
    });
    renderBg = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: { buffer: session.particlesBuffer } }
      ]
    });
    hudN.textContent = `${session.particleCount.toLocaleString()} / 32³ FFT`;
    hudStatus.textContent = 'running (1-submit GPU TreePM)';
  };
  await initSession();

  toggleBtn.addEventListener('click', () => {
    running = !running;
    toggleBtn.textContent = running ? 'Pause' : 'Resume';
  });
  resetBtn.addEventListener('click', () => { void initSession(); });
  if (spinBtn) {
    spinBtn.textContent = cameraAutoSpin ? 'Auto-Orbit: On' : 'Auto-Orbit: Off';
    spinBtn.addEventListener('click', () => {
      cameraAutoSpin = !cameraAutoSpin;
      spinBtn.textContent = cameraAutoSpin ? 'Auto-Orbit: On' : 'Auto-Orbit: Off';
    });
  }

  function kickPhysicsStep() {
    if (!running || stepping || !session) return;
    stepping = true;
    session.step({ readTelemetry: true }).then((tel) => {
      if (tel) {
        hudAz.textContent = `a=${tel.scaleFactorA.toFixed(3)} · z=${tel.redshiftZ.toFixed(2)}`;
        hudSigma.textContent = tel.sigmaDensity.toFixed(3);
        hudDmax.textContent = tel.maxOverdensity.toFixed(2);
        drawPowerSpectrum(tel.powerSpectrumPk);
        window.__ulgSupergalacticState = {
          ...tel,
          cameraAutoSpin,
          cameraAngles: [angleY, angleX],
          gpuErrorCount: (globalThis.__ulgWebGpuUncapturedErrors || []).filter((e) => e.label === 'supergalactic-demo').length
        };
      }
      if (session && session.getState().aScale >= 1.25) {
        void initSession();
      }
    }).catch((err) => {
      console.error('TreePM step error:', err);
    }).finally(() => {
      stepping = false;
    });
  }

  function frame() {
    if (session && renderBg) {
      if (cameraAutoSpin && !dragging) angleY += 0.004;
      const aspect = canvas.width / Math.max(1, canvas.height);
      device.queue.writeBuffer(uBuf, 0, Float32Array.from([angleY, angleX, 2 / session.boxLengthMpc, aspect]));
      const enc = device.createCommandEncoder({ label: 'ulg-supergalactic-render' });
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          clearValue: { r: 0.015, g: 0.025, b: 0.055, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, renderBg);
      pass.draw(6, session.particleCount);
      pass.end();
      device.queue.submit([enc.finish()]);
    }
    kickPhysicsStep();
    requestAnimationFrame(frame);
  }

  window.__ulgCaptureSupergalacticPng = async () => {
    if (!session || !renderBg) return null;
    const w = Math.min(1280, Math.max(320, canvas.width));
    const h = Math.min(800, Math.max(240, canvas.height));
    const bpr = Math.ceil((w * 4) / 256) * 256;
    const tex = device.createTexture({
      size: [w, h, 1],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const staging = device.createBuffer({
      size: bpr * h,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(uBuf, 0, Float32Array.from([angleY, angleX, 2 / session.boxLengthMpc, w / h]));
    const enc = device.createCommandEncoder({ label: 'ulg-supergalactic-capture' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: tex.createView(),
        clearValue: { r: 0.015, g: 0.025, b: 0.055, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, renderBg);
    pass.draw(6, session.particleCount);
    pass.end();
    enc.copyTextureToBuffer({ texture: tex }, { buffer: staging, bytesPerRow: bpr }, [w, h, 1]);
    device.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const raw = new Uint8Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    tex.destroy();
    const rgba = new Uint8ClampedArray(w * h * 4);
    const isBgra = format.includes('bgra');
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const s = y * bpr + x * 4;
        const d = (y * w + x) * 4;
        rgba[d] = isBgra ? raw[s + 2] : raw[s];
        rgba[d + 1] = raw[s + 1];
        rgba[d + 2] = isBgra ? raw[s] : raw[s + 2];
        rgba[d + 3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
    return off.toDataURL('image/png');
  };

  requestAnimationFrame(frame);
}

boot();
