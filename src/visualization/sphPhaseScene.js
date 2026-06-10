// SPH phase demo renderer (three.js), following the webgpuphys MLS-MPM visual style:
// particles are treated as density samples and reconstructed as continuous metaball surfaces
// instead of visible point sprites. Colour still comes from the closure-backed demo state.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { opticalRenderParams } from '../runtime/material/opticalClosure.js';

export const SPH_PHASE_RENDER_MODE = 'continuous-marching-cubes';

const SURFACE_CONFIG = {
  h2o: {
    resolution: 36,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 120000,
    opacity: 0.82,
    materialOptions: {
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.82,
      depthWrite: true
    }
  },
  fe: {
    resolution: 34,
    subtract: 26,
    isolation: 82,
    maxPolyCount: 120000,
    opacity: 1,
    materialOptions: {
      roughness: 0.36,
      metalness: 0.48,
      transparent: false,
      opacity: 1,
      depthWrite: true
    }
  },
  // Vaporized water: a faint, diffuse cloud rather than a tight blob. Lower isolation + larger
  // ball influence makes the metaballs bleed together into a whispy volume; high transparency and
  // no depth-write let it read as steam drifting in front of the scene.
  steam: {
    resolution: 28,
    subtract: 10,
    isolation: 24,
    maxPolyCount: 120000,
    opacity: 0.5,
    materialOptions: {
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    }
  },
  default: {
    resolution: 34,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 120000,
    opacity: 0.9,
    materialOptions: {
      roughness: 0.24,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      depthWrite: true
    }
  }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Inset the simulation box inside the marching-cubes field cube so surfaces touching a box face
// (e.g. the ice resting on the floor) aren't clipped at the field boundary. The mesh scale is
// widened by the same factor (below) so the inset surface still aligns with the box wireframe.
// Large enough that even a particle resting against a box face (radiusNorm up to ~0.11) keeps its
// whole metaball inside the field cube, so settled surfaces (ice pooling on the floor) aren't
// clipped after running for a while.
const FIELD_PADDING = 0.17;

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

// Map a render surface key to the optical-closure query (material + phase) that derives its
// appearance. 'steam' is gas-phase water; 'h2o' is the liquid/solid bulk.
function opticalQueryForKey(key) {
  if (key === 'fe') return { material: 'fe', phase: 'liquid' };
  if (key === 'steam') return { material: 'steam', phase: 'gas' };
  if (key === 'h2o') return { material: 'h2o', phase: 'liquid' };
  return { material: 'default', phase: 'liquid' };
}

function makeSurfaceMaterial(key) {
  const config = SURFACE_CONFIG[key] || SURFACE_CONFIG.default;
  // Transmission / IOR / attenuation come from the optical closure (refractive index + Beer–Lambert
  // extinction), not hand-picked opacities: water refracts (IOR 1.33) and tints over its path,
  // iron is opaque metal, steam barely refracts (IOR ≈ 1) and is only visible via condensation
  // scattering. opacity is still used for the steam cloud where transmission would make it vanish.
  const optics = opticalRenderParams(opticalQueryForKey(key));
  const usesTransmission = optics.transmission > 0.01;
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    clearcoat: key === 'fe' ? 0.18 : 0.05,
    metalness: optics.metalness,
    roughness: optics.roughness,
    ior: optics.ior,
    transmission: optics.transmission,
    thickness: usesTransmission ? 0.4 : 0,
    transparent: true,
    depthWrite: config.materialOptions.depthWrite,
    // With physical transmission the surface is its own see-through; opacity 1. Where transmission
    // is suppressed (steam's condensation scattering, the opaque default) fall back to the
    // closure/config opacity so the surface still shows.
    opacity: usesTransmission ? 1 : (key === 'steam' ? config.opacity : optics.opacity)
  });
  if (optics.attenuationColor) {
    material.attenuationColor = new THREE.Color(...optics.attenuationColor);
    material.attenuationDistance = Math.max(0.05, optics.attenuationDistanceM);
  }
  return material;
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

function estimateSurfaceRadiusM(bounds, count, boxEdgeM) {
  if (count <= 1) return boxEdgeM * 0.045;
  const spans = bounds.max.map((max, index) => Math.max(max - bounds.min[index], boxEdgeM * 0.025));
  const occupiedVolumeM3 = spans[0] * spans[1] * spans[2];
  const spacingM = Math.cbrt(occupiedVolumeM3 / Math.max(1, count));
  return clamp(spacingM * 1.65, boxEdgeM * 0.025, boxEdgeM * 0.11);
}

export function createContinuousSurfaceBatches({ positionsM, colorsRgb, materials = null, boxEdgeM = 10 } = {}) {
  if (!positionsM || !colorsRgb) {
    throw new Error('positionsM and colorsRgb are required for SPH continuous surfaces');
  }
  if (positionsM.length !== colorsRgb.length || positionsM.length % 3 !== 0) {
    throw new Error('positionsM and colorsRgb must be matching vec3 arrays');
  }
  const batches = new Map();
  const particleCount = positionsM.length / 3;
  for (let i = 0; i < particleCount; i += 1) {
    const key = materialKeyOf(materials?.[i]);
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        material: key,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        bounds: emptyBounds(),
        count: 0
      };
      batches.set(key, batch);
    }
    const x = positionsM[i * 3];
    const y = positionsM[i * 3 + 1];
    const z = positionsM[i * 3 + 2];
    batch.positionsM.push(x, y, z);
    const span = 1 - 2 * FIELD_PADDING;
    batch.normalizedPositions.push(
      clamp(FIELD_PADDING + (x / boxEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (y / boxEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (z / boxEdgeM) * span, 0.001, 0.999)
    );
    batch.colorsRgb.push(
      clamp(colorsRgb[i * 3], 0, 1),
      clamp(colorsRgb[i * 3 + 1], 0, 1),
      clamp(colorsRgb[i * 3 + 2], 0, 1)
    );
    expandBounds(batch.bounds, x, y, z);
    batch.count += 1;
  }
  return [...batches.values()].map((batch) => ({
    ...batch,
    surfaceRadiusM: estimateSurfaceRadiusM(batch.bounds, batch.count, boxEdgeM)
  }));
}

export function createSphPhaseScene(container, { boxEdgeM = 10, surfaceRadiusM = null } = {}) {
  const scene = new THREE.Scene();
  // A dark slate background rather than near-black: the ice/water surfaces are physically
  // transmissive (clear), so they take their look from what is behind them — a pure-black void made
  // them read dark. Transmission samples the background render, so lifting it brightens the glassy
  // surfaces without faking opacity.
  scene.background = new THREE.Color(0x18222b);

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

  // Bright, fairly even illumination so the non-emissive surfaces (ice/water) read clearly; a
  // hemisphere light gives a soft sky/ground fill on top of the flat ambient, and two directional
  // lights (key + fill) shape the surfaces without leaving any face in the dark.
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  scene.add(new THREE.HemisphereLight(0xddffff, 0x202a30, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfe9ff, 0.5);
  fill.position.set(-6, 3, -4);
  scene.add(fill);

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

  const surfaces = new Map();

  function ensureSurface(materialKey) {
    const key = materialKeyOf(materialKey);
    let surface = surfaces.get(key);
    if (surface) return surface;
    const config = SURFACE_CONFIG[key] || SURFACE_CONFIG.default;
    const mesh = new MarchingCubes(
      config.resolution,
      makeSurfaceMaterial(key),
      false,
      true,
      config.maxPolyCount
    );
    mesh.isolation = config.isolation;
    // Widen the field cube by 1/(1-2·pad) so the padded normalized positions still map onto the
    // box [0, boxEdgeM]; centre stays at the box centre.
    mesh.scale.setScalar(boxEdgeM / (2 * (1 - 2 * FIELD_PADDING)));
    mesh.position.set(boxEdgeM / 2, boxEdgeM / 2, boxEdgeM / 2);
    mesh.frustumCulled = false;
    mesh.userData.renderMode = SPH_PHASE_RENDER_MODE;
    mesh.userData.materialKey = key;
    scene.add(mesh);
    surface = { mesh, config };
    surfaces.set(key, surface);
    return surface;
  }

  ensureSurface('h2o');
  ensureSurface('fe');

  // Colours are precomputed by the demo (closure-backed incandescence from the radiation closure
  // for hot matter and intrinsic colour from the optical closure). The renderer reconstructs a
  // continuous density surface from particles, but it does not invent material colour.
  function setParticles({ positionsM, colorsRgb, materials = null, emissiveByMaterial = null }) {
    const activeKeys = new Set();
    const batches = createContinuousSurfaceBatches({ positionsM, colorsRgb, materials, boxEdgeM });
    for (const batch of batches) {
      const surface = ensureSurface(batch.material);
      const { mesh, config } = surface;
      // Incandescent surfaces (hot iron) glow: the radiation closure supplies the emissive colour,
      // which is added on top of the BRDF, so a fully-metallic surface still lights up instead of
      // rendering dark. A null/absent entry means the surface is below the glow threshold.
      const emissive = emissiveByMaterial?.[batch.material] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2]);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.reset();
      const radiusM = Number.isFinite(surfaceRadiusM) ? surfaceRadiusM : batch.surfaceRadiusM;
      const radiusNorm = clamp(radiusM / boxEdgeM, 0.006, 0.14);
      const strength = (mesh.isolation + config.subtract) * radiusNorm * radiusNorm;
      for (let i = 0; i < batch.count; i += 1) {
        mesh.addBall(
          batch.normalizedPositions[i * 3],
          batch.normalizedPositions[i * 3 + 1],
          batch.normalizedPositions[i * 3 + 2],
          strength,
          config.subtract,
          [
            batch.colorsRgb[i * 3],
            batch.colorsRgb[i * 3 + 1],
            batch.colorsRgb[i * 3 + 2]
          ]
        );
      }
      mesh.update();
      mesh.visible = batch.count > 0;
      mesh.userData.particleCount = batch.count;
      mesh.userData.surfaceRadiusM = radiusM;
      activeKeys.add(batch.material);
    }
    for (const [key, surface] of surfaces) {
      if (!activeKeys.has(key)) {
        surface.mesh.reset();
        surface.mesh.update();
        surface.mesh.visible = false;
      }
    }
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
    for (const { mesh } of surfaces.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { setParticles, dispose, scene, camera };
}
