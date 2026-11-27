import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Track 3A: ULG ExoWebTUI Desktop wires all 5 PeerCompute/@exotui shaders, knobs, presets & degauss coil', async () => {
  const stackSrc = await fs.readFile(path.join(ROOT, 'src/demos/ulgDesktopShaderStack.js'), 'utf8');
  const desktopSrc = await fs.readFile(path.join(ROOT, 'src/demos/ulgExoWebTuiDesktop.js'), 'utf8');
  const desktopHtml = await fs.readFile(path.join(ROOT, 'desktop.html'), 'utf8');
  const bridgeSrc = await fs.readFile(path.join(ROOT, 'src/demos/ulgExoWebTuiBridge.js'), 'utf8');

  assert.match(stackSrc, /from '@exotui\/src\/web\/canvas_shader\.ts'/, 'Desktop shader stack must dogfood canonical @exotui canvas_shader.ts');
  for (const id of ['vhs', 'crt', 'phosphor', 'scanlines', 'degauss']) {
    assert.match(stackSrc, new RegExp(`['"]${id}['"]`), `Shader stack must wire @exotui pass "${id}"`);
  }
  assert.match(desktopSrc, /createUlgDesktopShaderStackController/);
  assert.match(desktopSrc, /presenterShader:\s*presenterRef\?\.shader/);
  assert.match(desktopSrc, /ulg-exowebtui-shader-stack/);
  assert.match(desktopSrc, /data-exo-shader-toggle/);
  assert.match(desktopSrc, /data-exo-shader-preset/);
  assert.match(desktopSrc, /data-exo-shader-id/);
  assert.match(desktopSrc, /data-exo-act="degauss"/);
  assert.match(desktopHtml, /id="exo-shader-overlay"/);
  assert.match(desktopHtml, /id="exo-degauss-btn"/);
  assert.match(bridgeSrc, /ulg-exowebtui-shader-stack/);
  assert.match(bridgeSrc, /BUILTIN_QUERY_THEMES/);
});

test('Track 3B: Linear/sRGB shader fixes, ACES filmic unification, Paper Light Theme & mobile #gpu-hud layout', async () => {
  const chemBioSrc = await fs.readFile(path.join(ROOT, 'src/demos/chemBioWebGpuRenderer.js'), 'utf8');
  const uniRenSrc = await fs.readFile(path.join(ROOT, 'src/demos/ulgUniversesRenderer.js'), 'utf8');
  const elemRenSrc = await fs.readFile(path.join(ROOT, 'src/demos/elementsLabWebGpuRenderer.js'), 'utf8');
  const elemHtml = await fs.readFile(path.join(ROOT, 'elements-lab.html'), 'utf8');
  const retroCss = await fs.readFile(path.join(ROOT, 'src/styles/ulgRetroTheme.css'), 'utf8');
  const orgSrc = await fs.readFile(path.join(ROOT, 'src/demos/organicLabDemo.js'), 'utf8');
  const lifeSrc = await fs.readFile(path.join(ROOT, 'src/demos/lifeLabDemo.js'), 'utf8');

  assert.match(chemBioSrc, /let core = ulg_srgb_to_linear\(/);
  assert.match(chemBioSrc, /ulg_srgb_to_linear\(in\.color\)\s*\*\s*\(0\.7 \+ 0\.8 \* cy\)/);
  assert.match(uniRenSrc, /pow\(max\(rgb,\s*vec3<f32>\(0\.0\)\),\s*vec3<f32>\(2\.2\)\)/);
  assert.match(uniRenSrc, /let vapor_col = ulg_srgb_to_linear\(/);
  assert.doesNotMatch(uniRenSrc, /vec3<f32>\(0\.014\)\s*\+\s*star_dir_l/);
  assert.match(elemRenSrc, /let mapped = ulg_aces_filmic\(/);
  assert.match(elemRenSrc, /ulg_linear_to_srgb\(clamp\(ulg_aces_filmic\(/);
  assert.match(elemHtml, /@media \(max-width: 640px\)\s*\{\s*#gpu-hud/);
  assert.match(retroCss, /\[data-ulg-theme-mode="light"\]\s+#gpu-hud/);
  assert.match(orgSrc, /getOrganicPlotPalette/);
  assert.match(lifeSrc, /getLifePlotPalette/);
});
