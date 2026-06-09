// SPH phase demo renderer (three.js), copying the webgpuphys MLS-MPM visual style:
// a particle cloud coloured cold->hot by temperature, inside a wireframe sealed-box domain,
// viewed through an orbit camera. Cold = blue (0.2,0.7,0.95), hot = red (0.95,0.2,0.2),
// matching the MLS-MPM demo's temperature colour map.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function makeParticleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSphPhaseScene(container, { boxEdgeM = 10, pointSize = 0.12 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080a);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 520;
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 500);
  const center = new THREE.Vector3(boxEdgeM / 2, 0.9, boxEdgeM / 2);
  camera.position.set(center.x + 3.2, center.y + 2.4, center.z + 4.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(center);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0x96ffe1, 0.9);
  key.position.set(4, 8, 6);
  scene.add(key);

  // Sealed-box domain wireframe (the full 10 m box) + a floor grid.
  const boxGeom = new THREE.BoxGeometry(boxEdgeM, boxEdgeM, boxEdgeM);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeom),
    new THREE.LineBasicMaterial({ color: 0x1d8b6d, transparent: true, opacity: 0.35 })
  );
  box.position.set(boxEdgeM / 2, boxEdgeM / 2, boxEdgeM / 2);
  scene.add(box);
  const grid = new THREE.GridHelper(boxEdgeM, 20, 0x1d8b6d, 0x0d332b);
  grid.position.set(boxEdgeM / 2, 0, boxEdgeM / 2);
  scene.add(grid);

  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    size: pointSize,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    alphaTest: 0.2,
    depthWrite: true,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let positions = new Float32Array(0);
  let colors = new Float32Array(0);

  // Colours are precomputed by the demo (closure-backed incandescence from the radiation closure
  // for hot matter; a flagged placeholder for not-yet-closure-backed intrinsic colour). The
  // renderer does not invent colour from temperature.
  function setParticles({ positionsM, colorsRgb }) {
    const n = positionsM.length / 3;
    if (positions.length !== n * 3) {
      positions = new Float32Array(n * 3);
      colors = new Float32Array(n * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    positions.set(positionsM);
    colors.set(colorsRgb);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  let running = true;
  function animate() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  function resize() {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  function dispose() {
    running = false;
    window.removeEventListener('resize', resize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { setParticles, dispose, scene, camera };
}
