// SPH phase demo renderer (three.js), following the webgpuphys MLS-MPM visual style:
// particles are treated as density samples and reconstructed as continuous metaball surfaces
// instead of visible point sprites. Colour still comes from the closure-backed demo state.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildOpticalGpuTable } from '../runtime/material/opticalGpuBuffers.js';
import { opticalRenderParams } from '../runtime/material/opticalClosure.js';

export const SPH_PHASE_RENDER_MODE = 'continuous-marching-cubes';

const SURFACE_CONFIG = {
  h2o: {
    resolution: 48,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 120000
  },
  fe: {
    resolution: 46,
    subtract: 26,
    isolation: 82,
    maxPolyCount: 120000
  },
  // Vaporized water: a faint, diffuse cloud rather than a tight blob. Lower isolation + larger
  // ball influence makes the metaballs bleed together into a whispy volume; high transparency and
  // no depth-write let it read as steam drifting in front of the scene.
  steam: {
    resolution: 36,
    subtract: 10,
    isolation: 24,
    maxPolyCount: 120000
  },
  default: {
    resolution: 46,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 120000
  }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Inset the simulation box inside the marching-cubes field cube so an isosurface that reaches a box
// face is NOT hard-clipped flat at the field boundary — the metaball is given room on the far side
// of the wall to close into a rounded surface, so a blob resting against the floor/wall renders as a
// complete dome instead of a sliced-off plane. The padding is mapped per-axis (below); the mesh
// scale is widened by 1/(1-2·pad) so the padded [0,1] field still aligns with the box wireframe.
// A metaball's surface extends ~radiusNorm·√((iso+sub)/iso) ≈ 1.15·radiusNorm from its centre, and
// radiusNorm is clamped to ≤0.14, so the surface reaches ~0.16 past a wall-hugging particle — the
// padding must exceed that to fully contain the dome. Resolutions are raised to keep box detail
// since the box now occupies only (1−2·pad) of each field axis.
const FIELD_PADDING = 0.22;

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

function renderDescriptorOf(value) {
  if (value && typeof value === 'object') {
    const renderKey = materialKeyOf(value.renderKey ?? value.key ?? value.material);
    const material = materialKeyOf(value.material ?? ((renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey));
    const phase = value.phase ?? (renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null));
    return {
      renderKey,
      material,
      phase,
      surfaceKey: `${renderKey}|${material}|${phase ?? 'phase-unspecified'}`
    };
  }
  const renderKey = materialKeyOf(value);
  return {
    renderKey,
    material: (renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey,
    phase: renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null),
    surfaceKey: `${renderKey}|${(renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey}|${renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : 'phase-unspecified')}`
  };
}

function materialPropertiesForSurfaceDescriptor(descriptor, materialProperties) {
  if (!materialProperties) return null;
  const materialKey = descriptor.material;
  const renderKey = descriptor.renderKey;
  return materialProperties[materialKey]
    ?? materialProperties[materialKey?.toLowerCase?.()]
    ?? materialProperties[renderKey]
    ?? materialProperties[renderKey?.toLowerCase?.()]
    ?? null;
}

function opticalQueryForDescriptor(descriptor, properties = null) {
  return {
    material: descriptor.material,
    phase: descriptor.phase ?? (descriptor.renderKey === 'steam' ? 'gas' : (descriptor.renderKey === 'ice' ? 'solid' : 'liquid')),
    properties
  };
}

function makeSurfaceMaterial(descriptorOrKey, properties = null) {
  const descriptor = renderDescriptorOf(descriptorOrKey);
  // Transmission / IOR / attenuation come from the optical closure (refractive index + Beer–Lambert
  // extinction): clear media transmit according to optical depth; conductors become opaque from
  // Drude skin depth; missing optical closures block rather than falling back to fake opacity.
  const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
  const usesTransmission = optics.transmission > 0.01;
  const transparent = usesTransmission || optics.opacity < 0.999;
  const baseColor = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(baseColor[0], baseColor[1], baseColor[2], THREE.SRGBColorSpace),
    vertexColors: optics.vertexColorPolicy === 'particle-diagnostic',
    side: THREE.DoubleSide,
    clearcoat: optics.metalness > 0.5 ? 0.18 : 0.05,
    metalness: optics.metalness,
    roughness: optics.roughness,
    ior: optics.ior ?? 1.5,
    transmission: optics.transmission,
    thickness: usesTransmission ? 0.6 : 0,
    envMapIntensity: optics.metalness > 0.5 ? 1.3 : 0.85,
    transparent,
    depthWrite: !transparent || optics.opacity > 0.5,
    opacity: clamp(optics.opacity, 0, 1)
  });
  if (optics.attenuationColor) {
    material.attenuationColor = new THREE.Color().setRGB(
      optics.attenuationColor[0],
      optics.attenuationColor[1],
      optics.attenuationColor[2],
      THREE.SRGBColorSpace
    );
    material.attenuationDistance = Math.max(0.05, optics.attenuationDistanceM);
  }
  material.userData.optical = optics;
  material.userData.renderDescriptor = descriptor;
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

export function createContinuousSurfaceBatches({ positionsM, colorsRgb, materials = null, boxEdgeM = 10, boxDimsM = null } = {}) {
  if (!positionsM || !colorsRgb) {
    throw new Error('positionsM and colorsRgb are required for SPH continuous surfaces');
  }
  if (positionsM.length !== colorsRgb.length || positionsM.length % 3 !== 0) {
    throw new Error('positionsM and colorsRgb must be matching vec3 arrays');
  }
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  const batches = new Map();
  const particleCount = positionsM.length / 3;
  for (let i = 0; i < particleCount; i += 1) {
    const descriptor = renderDescriptorOf(materials?.[i]);
    let batch = batches.get(descriptor.surfaceKey);
    if (!batch) {
      batch = {
        surfaceKey: descriptor.surfaceKey,
        renderKey: descriptor.renderKey,
        material: descriptor.material,
        phase: descriptor.phase,
        descriptor,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        bounds: emptyBounds(),
        count: 0
      };
      batches.set(descriptor.surfaceKey, batch);
    }
    const x = positionsM[i * 3];
    const y = positionsM[i * 3 + 1];
    const z = positionsM[i * 3 + 2];
    batch.positionsM.push(x, y, z);
    // Isotropic mapping: every axis is normalized by the SAME factor (the largest box edge), so a
    // metaball stays spherical in the field. A non-cubic box therefore occupies a sub-region of the
    // [0,1] field cube (the short axes don't fill it) rather than being stretched to fill it — which
    // would deform round blobs into ellipsoids. The mesh scale (below) is the matching scalar.
    const span = 1 - 2 * FIELD_PADDING;
    batch.normalizedPositions.push(
      clamp(FIELD_PADDING + (x / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (y / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (z / refEdgeM) * span, 0.001, 0.999)
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
    surfaceRadiusM: estimateSurfaceRadiusM(batch.bounds, batch.count, refEdgeM)
  }));
}

export function createOpticalGpuTableForSurfaceBatches(batches, { materialProperties = null } = {}) {
  return buildOpticalGpuTable(batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    renderKey: batch.renderKey,
    properties: materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties)
  })), { materialProperties: materialProperties || {} });
}

export function createSphPhaseScene(container, { boxEdgeM = 10, boxDimsM = null, surfaceRadiusM = null, surfaceRadiusScale = 1 } = {}) {
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  let radiusScale = surfaceRadiusScale; // mutable so the blob-size control is live (no rebuild)
  const scene = new THREE.Scene();
  // A dark slate background rather than near-black: the ice/water surfaces are physically
  // transmissive (clear), so they take their look from what is behind them — a pure-black void made
  // them read dark. Transmission samples the background render, so lifting it brightens the glassy
  // surfaces without faking opacity.
  scene.background = new THREE.Color(0x18222b);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 520;
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 500);
  // Aim at the box centre and pull back proportionally to the largest box edge so the whole sealed
  // box (and everything contained in it) is framed, instead of looking at the floor and cropping.
  const center = new THREE.Vector3(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  camera.position.set(center.x + refEdgeM * 0.85, center.y + refEdgeM * 0.55, center.z + refEdgeM * 1.15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;

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

  // Sealed-box domain wireframe (the full Lx×Ly×Lz box) + a floor grid sized to the footprint.
  const boxGeom = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeom),
    new THREE.LineBasicMaterial({ color: 0x36d6a4, transparent: true, opacity: 0.6 })
  );
  box.position.set(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  scene.add(box);
  const gridFootprint = Math.max(dims[0], dims[2]);
  const grid = new THREE.GridHelper(gridFootprint, 20, 0x1d8b6d, 0x0d332b);
  grid.position.set(dims[0] / 2, 0, dims[2] / 2);
  scene.add(grid);

  const surfaces = new Map();
  let opticalGpuTable = buildOpticalGpuTable([]);
  scene.userData.opticalGpuTable = opticalGpuTable;

  function ensureSurface(descriptorOrKey, properties = null) {
    const descriptor = renderDescriptorOf(descriptorOrKey);
    const key = descriptor.surfaceKey;
    let surface = surfaces.get(key);
    if (surface) {
      if (surface.properties !== properties) {
        surface.mesh.material.dispose();
        surface.mesh.material = makeSurfaceMaterial(descriptor, properties);
        surface.properties = properties;
        surface.descriptor = descriptor;
      }
      return surface;
    }
    const config = SURFACE_CONFIG[descriptor.renderKey] || SURFACE_CONFIG.default;
    const mesh = new MarchingCubes(
      config.resolution,
      makeSurfaceMaterial(descriptor, properties),
      false,
      true,
      config.maxPolyCount
    );
    mesh.isolation = config.isolation;
    // Isotropic scale (a single scalar) so metaballs render as spheres, not ellipsoids. With the
    // refEdge-normalized positions above, this maps field-axis [pad, 1-pad] onto world [0, refEdge];
    // a particle at box-axis coordinate L lands at world L because L/refEdge ≤ 1. Position is
    // refEdge/2 on every axis (the field origin maps to world 0 on each axis).
    mesh.scale.setScalar(refEdgeM / (2 * (1 - 2 * FIELD_PADDING)));
    mesh.position.set(refEdgeM / 2, refEdgeM / 2, refEdgeM / 2);
    mesh.frustumCulled = false;
    mesh.userData.renderMode = SPH_PHASE_RENDER_MODE;
    mesh.userData.materialKey = descriptor.material;
    mesh.userData.renderKey = descriptor.renderKey;
    mesh.userData.phase = descriptor.phase;
    mesh.userData.optical = mesh.material.userData.optical;
    scene.add(mesh);
    surface = { mesh, config, properties, descriptor };
    surfaces.set(key, surface);
    return surface;
  }

  ensureSurface('h2o');
  ensureSurface('fe');

  // Colours are precomputed by the demo (closure-backed incandescence from the radiation closure
  // for hot matter and intrinsic colour from the optical closure). The renderer reconstructs a
  // continuous density surface from particles, but it does not invent material colour.
  function setParticles({ positionsM, colorsRgb, materials = null, emissiveByMaterial = null, materialProperties = null }) {
    const activeKeys = new Set();
    const batches = createContinuousSurfaceBatches({ positionsM, colorsRgb, materials, boxEdgeM, boxDimsM: dims });
    opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    scene.userData.opticalGpuTable = opticalGpuTable;
    const gpuRecordsBySurface = new Map(opticalGpuTable.recordMetadata.map((record) => [
      `${record.material}|${record.phase}`,
      record
    ]));
    for (const batch of batches) {
      const properties = materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties);
      const surface = ensureSurface(batch.descriptor, properties);
      const { mesh, config } = surface;
      mesh.userData.optical = mesh.material.userData.optical;
      mesh.userData.materialKey = batch.material;
      mesh.userData.renderKey = batch.renderKey;
      mesh.userData.phase = batch.phase;
      mesh.userData.opticalGpuRecord = gpuRecordsBySurface.get(`${batch.material}|${batch.phase}`) || null;
      // Incandescent surfaces (hot iron) glow: the radiation closure supplies the emissive colour,
      // which is added on top of the BRDF, so a fully-metallic surface still lights up instead of
      // rendering dark. A null/absent entry means the surface is below the glow threshold.
      const emissive = emissiveByMaterial?.[batch.material] ?? emissiveByMaterial?.[batch.renderKey] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.reset();
      // Isosurface (blob) size is decoupled from the container: the auto estimate (from particle
      // spacing) or an explicit override is multiplied by a user-set scale, independent of box size.
      const radiusM = (Number.isFinite(surfaceRadiusM) ? surfaceRadiusM : batch.surfaceRadiusM) * radiusScale;
      const radiusNorm = clamp(radiusM / refEdgeM, 0.006, 0.14);
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
      activeKeys.add(batch.surfaceKey);
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
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  function setSurfaceRadiusScale(scale) {
    if (Number.isFinite(scale) && scale > 0) radiusScale = scale;
  }

  return {
    setParticles,
    setSurfaceRadiusScale,
    dispose,
    scene,
    camera,
    getOpticalGpuTable() {
      return opticalGpuTable;
    }
  };
}
