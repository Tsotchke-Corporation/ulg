// SPH phase demo renderer (three.js), following the webgpuphys MLS-MPM visual style:
// particles are treated as density samples and reconstructed as continuous metaball surfaces
// instead of visible point sprites. Colour still comes from the closure-backed demo state.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildOpticalGpuLookupQueries,
  buildOpticalGpuTable,
  decodeOpticalGpuLookupOutputRows,
  requestOpticalGpuDevice,
  runOpticalGpuLookupWithOptionalWebGpu,
  sampleOpticalGpuTableCpu
} from '../runtime/material/opticalGpuBuffers.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../runtime/sph/sphGpuBuffers.js';
import { runMlsMpmMechanicsPredictWithOptionalWebGpu } from '../runtime/sph/sphMechanicsGpuKernel.js';
import { runMlsMpmP2gGridProjectionWithOptionalWebGpu } from '../runtime/sph/sphGridGpuKernel.js';
import { runMlsMpmGridUpdateWithOptionalWebGpu } from '../runtime/sph/sphGridUpdateGpuKernel.js';
import { runMlsMpmG2pWithOptionalWebGpu } from '../runtime/sph/sphG2pGpuKernel.js';
import { runMlsMpmResidentStepWithOptionalWebGpu } from '../runtime/sph/sphMlsMpmGpuStep.js';
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

export function createOpticalGpuLookupForSurfaceBatches(table, batches) {
  const lookup = buildOpticalGpuLookupQueries(table, batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase
  })));
  return {
    lookup,
    cpuReference: sampleOpticalGpuTableCpu(table, lookup),
    surfaceKeys: batches.map((batch) => batch.surfaceKey),
    signature: opticalGpuLookupSignature(table, lookup)
  };
}

function opticalGpuLookupSignature(table, lookup) {
  return [
    table.recordCount,
    lookup.queryCount,
    Array.from(lookup.queries).join(','),
    Array.from(table.records).join(',')
  ].join('|');
}

export function createSphPhaseScene(container, {
  boxEdgeM = 10,
  boxDimsM = null,
  surfaceRadiusM = null,
  surfaceRadiusScale = 1,
  preferWebGpuOpticalLookup = true,
  navigatorRef = globalThis.navigator
} = {}) {
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
  let opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, []);
  let opticalGpuLookupGeneration = 0;
  let pendingOpticalGpuLookup = null;
  let opticalGpuDeviceResultPromise = null;
  let sphGpuParticleState = null;
  let sphGpuParticleUpload = null;
  let sphGpuParticleUploadSignature = null;
  let pendingSphGpuParticleUpload = null;
  let mlsMpmGpuParticleState = null;
  let mlsMpmGpuParticleUpload = null;
  let mlsMpmGpuParticleUploadSignature = null;
  let pendingMlsMpmGpuParticleUpload = null;
  let mlsMpmMechanicsPrediction = null;
  let mlsMpmMechanicsPredictionSignature = null;
  let pendingMlsMpmMechanicsPrediction = null;
  let mlsMpmP2gGridProjection = null;
  let mlsMpmP2gGridProjectionSignature = null;
  let pendingMlsMpmP2gGridProjection = null;
  let mlsMpmGridUpdate = null;
  let mlsMpmGridUpdateSignature = null;
  let pendingMlsMpmGridUpdate = null;
  let mlsMpmG2pReconstruction = null;
  let mlsMpmG2pReconstructionSignature = null;
  let pendingMlsMpmG2pReconstruction = null;
  let mlsMpmResidentStep = null;
  let mlsMpmResidentStepSignature = null;
  let pendingMlsMpmResidentStep = null;
  scene.userData.opticalGpuTable = opticalGpuTable;
  scene.userData.opticalGpuLookup = opticalGpuLookup;
  scene.userData.opticalGpuLookupExecution = null;
  scene.userData.opticalGpuLookupDrawState = null;
  scene.userData.sphGpuParticleState = null;
  scene.userData.sphGpuParticleUpload = null;
  scene.userData.mlsMpmGpuParticleState = null;
  scene.userData.mlsMpmGpuParticleUpload = null;
  scene.userData.mlsMpmMechanicsPrediction = null;
  scene.userData.mlsMpmP2gGridProjection = null;
  scene.userData.mlsMpmGridUpdate = null;
  scene.userData.mlsMpmG2pReconstruction = null;
  scene.userData.mlsMpmResidentStep = null;

  function applyOpticalGpuLookupExecution(execution, lookupState = opticalGpuLookup) {
    if (!execution?.outputs) return [];
    const rows = decodeOpticalGpuLookupOutputRows(execution, lookupState.lookup);
    const applied = [];
    for (const row of rows) {
      const surfaceKey = lookupState.surfaceKeys?.[row.queryIndex];
      const surface = surfaceKey ? surfaces.get(surfaceKey) : null;
      if (!surface || row.status === 255 || row.recordIndex < 0) continue;
      const { mesh } = surface;
      const material = mesh.material;
      material.color.setRGB(
        clamp(row.baseColorLinear[0], 0, 1),
        clamp(row.baseColorLinear[1], 0, 1),
        clamp(row.baseColorLinear[2], 0, 1),
        THREE.LinearSRGBColorSpace
      );
      material.opacity = clamp(row.opacity, 0, 1);
      material.transparent = row.transmission > 0.01 || material.opacity < 0.999;
      material.depthWrite = !material.transparent || material.opacity > 0.5;
      material.metalness = clamp(row.metalness, 0, 1);
      material.roughness = clamp(row.roughness, 0, 1);
      material.transmission = clamp(row.transmission, 0, 1);
      material.ior = Math.max(1, row.ior || 1);
      material.vertexColors = row.vertexColorPolicyId === 2;
      material.needsUpdate = true;
      mesh.userData.opticalGpuLookupOutput = row;
      mesh.userData.opticalGpuExecutionBackend = execution.backend;
      applied.push({ surfaceKey, row });
    }
    scene.userData.opticalGpuLookupDrawState = {
      schema: 'peercompute.ulg.optical-gpu-draw-state.v0',
      sourceExecutionSchema: execution.schema,
      backend: execution.backend,
      appliedCount: applied.length,
      rows,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    return applied;
  }

  function requestCachedOpticalGpuDevice(ref = navigatorRef) {
    if (!opticalGpuDeviceResultPromise) {
      opticalGpuDeviceResultPromise = requestOpticalGpuDevice(ref).then((result) => {
        if (result.device?.lost?.then) {
          result.device.lost.finally(() => {
            if (opticalGpuDeviceResultPromise) opticalGpuDeviceResultPromise = null;
          }).catch(() => {});
        }
        return result;
      }).catch((error) => {
        opticalGpuDeviceResultPromise = null;
        return {
          status: 'webgpu-error-fallback',
          reason: error instanceof Error ? error.message : String(error),
          device: null
        };
      });
    }
    return opticalGpuDeviceResultPromise;
  }

  async function refreshOpticalGpuLookup({
    preferWebGpu = preferWebGpuOpticalLookup,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    parityTolerance = 1e-6,
    webGpuRunner = undefined
  } = {}) {
    const generation = opticalGpuLookupGeneration;
    const currentTable = opticalGpuTable;
    const currentLookup = opticalGpuLookup;
    const signature = currentLookup.signature;
    if (
      !force
      && currentLookup.execution?.signature === signature
    ) {
      return currentLookup;
    }
    if (!force && pendingOpticalGpuLookup?.signature === signature) {
      return pendingOpticalGpuLookup.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const execution = await runOpticalGpuLookupWithOptionalWebGpu({
        table: currentTable,
        lookup: currentLookup.lookup,
        cpuReference: currentLookup.cpuReference,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || generation !== opticalGpuLookupGeneration || opticalGpuLookup.signature !== signature) {
        return {
          ...currentLookup,
          execution: {
            ...execution,
            stale: true
          }
        };
      }
      opticalGpuLookup = {
        ...currentLookup,
        execution
      };
      scene.userData.opticalGpuLookup = opticalGpuLookup;
      scene.userData.opticalGpuLookupExecution = execution;
      applyOpticalGpuLookupExecution(execution, opticalGpuLookup);
      return opticalGpuLookup;
    })();
    pendingOpticalGpuLookup = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingOpticalGpuLookup?.promise === promise) pendingOpticalGpuLookup = null;
    }
  }

  function sphGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.state?.byteLength ?? 0,
      packed.thermo?.byteLength ?? 0
    ].join('|');
  }

  function mlsMpmGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.mechanics?.byteLength ?? 0,
      packed.mechanicsDtS ?? 0,
      packed.soundSpeedScale ?? 0,
      packed.minGasSoundSpeedMPerS ?? 0
    ].join('|');
  }

  function mlsMpmMechanicsPredictionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0]
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      dt,
      gravityMPerS2.join(','),
      dims.join(',')
    ].join('|');
  }

  function mlsMpmP2gGridProjectionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM ?? 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmGridUpdateSignatureFor({
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6
  } = {}) {
    if (!p2gGridProjection?.schema) return null;
    return [
      p2gGridProjection.signature ?? [
        p2gGridProjection.schema,
        p2gGridProjection.backend,
        p2gGridProjection.gridNodeCount,
        p2gGridProjection.gridSpacingM,
        p2gGridProjection.dt ?? 0
      ].join(':'),
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmG2pReconstructionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature || !gridUpdate?.schema) return null;
    return [
      sphSignature,
      mlsSignature,
      gridUpdate.signature ?? `${gridUpdate.schema}|${gridUpdate.backend}|${gridUpdate.gridNodeCount}|${gridUpdate.dt ?? 0}`,
      dt,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmResidentStepSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
    dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmParticleState?.gridCflFactor || 0.6
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      dims.join(',')
    ].join('|');
  }

  async function refreshSphGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!sphGpuParticleState) {
      sphGpuParticleUpload = null;
      scene.userData.sphGpuParticleUpload = null;
      return null;
    }
    const signature = sphGpuParticleSignature(sphGpuParticleState);
    if (!force && sphGpuParticleUploadSignature === signature && sphGpuParticleUpload) {
      return sphGpuParticleUpload;
    }
    if (!force && pendingSphGpuParticleUpload?.signature === signature) {
      return pendingSphGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: 'WebGPU SPH particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadSphGpuParticleBuffers(resolvedDeviceResult.device, sphGpuParticleState);
      upload.signature = signature;
      upload.step = sphGpuParticleState.step;
      upload.time = sphGpuParticleState.time;
      if (!running || sphGpuParticleSignature(sphGpuParticleState) !== signature) {
        destroySphGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (sphGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroySphGpuParticleBuffers(sphGpuParticleUpload);
      }
      sphGpuParticleUpload = upload;
      sphGpuParticleUploadSignature = signature;
      scene.userData.sphGpuParticleUpload = upload;
      return upload;
    })();
    pendingSphGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingSphGpuParticleUpload?.promise === promise) pendingSphGpuParticleUpload = null;
    }
  }

  async function refreshMlsMpmGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!mlsMpmGpuParticleState) {
      mlsMpmGpuParticleUpload = null;
      scene.userData.mlsMpmGpuParticleUpload = null;
      return null;
    }
    const signature = mlsMpmGpuParticleSignature(mlsMpmGpuParticleState);
    if (!force && mlsMpmGpuParticleUploadSignature === signature && mlsMpmGpuParticleUpload) {
      return mlsMpmGpuParticleUpload;
    }
    if (!force && pendingMlsMpmGpuParticleUpload?.signature === signature) {
      return pendingMlsMpmGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: 'WebGPU MLS-MPM particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadMlsMpmGpuParticleBuffers(resolvedDeviceResult.device, mlsMpmGpuParticleState);
      upload.signature = signature;
      upload.step = mlsMpmGpuParticleState.step;
      upload.time = mlsMpmGpuParticleState.time;
      if (!running || mlsMpmGpuParticleSignature(mlsMpmGpuParticleState) !== signature) {
        destroyMlsMpmGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
      }
      mlsMpmGpuParticleUpload = upload;
      mlsMpmGpuParticleUploadSignature = signature;
      scene.userData.mlsMpmGpuParticleUpload = upload;
      return upload;
    })();
    pendingMlsMpmGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGpuParticleUpload?.promise === promise) pendingMlsMpmGpuParticleUpload = null;
    }
  }

  async function refreshMlsMpmMechanicsPrediction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0],
    parityTolerance = 2e-5,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmMechanicsPrediction = null;
      scene.userData.mlsMpmMechanicsPrediction = null;
      return null;
    }
    const signature = mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 });
    if (!force && mlsMpmMechanicsPredictionSignature === signature && mlsMpmMechanicsPrediction) {
      return mlsMpmMechanicsPrediction;
    }
    if (!force && pendingMlsMpmMechanicsPrediction?.signature === signature) {
      return pendingMlsMpmMechanicsPrediction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        dt,
        gravityMPerS2,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmMechanicsPrediction = execution;
      mlsMpmMechanicsPredictionSignature = signature;
      scene.userData.mlsMpmMechanicsPrediction = execution;
      return execution;
    })();
    pendingMlsMpmMechanicsPrediction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmMechanicsPrediction?.promise === promise) pendingMlsMpmMechanicsPrediction = null;
    }
  }

  async function refreshMlsMpmP2gGridProjection({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmP2gGridProjection = null;
      scene.userData.mlsMpmP2gGridProjection = null;
      return null;
    }
    const signature = mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM });
    if (!force && mlsMpmP2gGridProjectionSignature === signature && mlsMpmP2gGridProjection) {
      return mlsMpmP2gGridProjection;
    }
    if (!force && pendingMlsMpmP2gGridProjection?.signature === signature) {
      return pendingMlsMpmP2gGridProjection.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        gridSpacingM,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        retainGridBuffer: true,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmP2gGridProjection = execution;
      mlsMpmP2gGridProjectionSignature = signature;
      scene.userData.mlsMpmP2gGridProjection = execution;
      return execution;
    })();
    pendingMlsMpmP2gGridProjection = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmP2gGridProjection?.promise === promise) pendingMlsMpmP2gGridProjection = null;
    }
  }

  async function refreshMlsMpmGridUpdate({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    parityTolerance = 1e-5,
    webGpuRunner = undefined
  } = {}) {
    if (!p2gGridProjection?.schema) {
      mlsMpmGridUpdate = null;
      scene.userData.mlsMpmGridUpdate = null;
      return null;
    }
    const signature = mlsMpmGridUpdateSignatureFor({
      p2gGridProjection,
      dt,
      gravityMPerS2,
      cflFactor
    });
    if (!force && mlsMpmGridUpdateSignature === signature && mlsMpmGridUpdate) {
      return mlsMpmGridUpdate;
    }
    if (!force && pendingMlsMpmGridUpdate?.signature === signature) {
      return pendingMlsMpmGridUpdate.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
        p2gGridProjection,
        p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
        dt,
        gravityMPerS2,
        boxDimsM: dims,
        cflFactor,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        retainUpdatedGridBuffer: true,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmGridUpdateSignatureFor({ p2gGridProjection, dt, gravityMPerS2, cflFactor }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmGridUpdate = execution;
      mlsMpmGridUpdateSignature = signature;
      scene.userData.mlsMpmGridUpdate = execution;
      return execution;
    })();
    pendingMlsMpmGridUpdate = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGridUpdate?.promise === promise) pendingMlsMpmGridUpdate = null;
    }
  }

  async function refreshMlsMpmG2pReconstruction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState || !gridUpdate?.schema) {
      mlsMpmG2pReconstruction = null;
      scene.userData.mlsMpmG2pReconstruction = null;
      return null;
    }
    const signature = mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt });
    if (!force && mlsMpmG2pReconstructionSignature === signature && mlsMpmG2pReconstruction) {
      return mlsMpmG2pReconstruction;
    }
    if (!force && pendingMlsMpmG2pReconstruction?.signature === signature) {
      return pendingMlsMpmG2pReconstruction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmG2pWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        gridUpdate,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
        dt,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt }) !== signature) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmG2pReconstruction = execution;
      mlsMpmG2pReconstructionSignature = signature;
      scene.userData.mlsMpmG2pReconstruction = execution;
      return execution;
    })();
    pendingMlsMpmG2pReconstruction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmG2pReconstruction?.promise === promise) pendingMlsMpmG2pReconstruction = null;
    }
  }

  async function refreshMlsMpmResidentStep({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    parityTolerances = undefined,
    p2gRunner = undefined,
    gridUpdateRunner = undefined,
    g2pRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmResidentStep = null;
      scene.userData.mlsMpmResidentStep = null;
      return null;
    }
    const signature = mlsMpmResidentStepSignatureFor({
      gridSpacingM,
      dt,
      gravityMPerS2,
      cflFactor
    });
    if (!force && mlsMpmResidentStepSignature === signature && mlsMpmResidentStep) {
      return mlsMpmResidentStep;
    }
    if (!force && pendingMlsMpmResidentStep?.signature === signature) {
      return pendingMlsMpmResidentStep.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmResidentStepWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        gridSpacingM,
        boxDimsM: dims,
        dt,
        gravityMPerS2,
        cflFactor,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerances,
        p2gRunner,
        gridUpdateRunner,
        g2pRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmResidentStepSignatureFor({ gridSpacingM, dt, gravityMPerS2, cflFactor }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      if (mlsMpmP2gGridProjection !== execution.p2gGridProjection) {
        mlsMpmP2gGridProjection?.gpuResult?.destroyGridBuffer?.();
        mlsMpmP2gGridProjection?.destroyGridBuffer?.();
      }
      if (mlsMpmGridUpdate !== execution.gridUpdate) {
        mlsMpmGridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
        mlsMpmGridUpdate?.destroyUpdatedGridBuffer?.();
      }
      mlsMpmResidentStep = execution;
      mlsMpmResidentStepSignature = signature;
      mlsMpmP2gGridProjection = execution.p2gGridProjection;
      mlsMpmP2gGridProjectionSignature = signature;
      mlsMpmGridUpdate = execution.gridUpdate;
      mlsMpmGridUpdateSignature = signature;
      mlsMpmG2pReconstruction = execution.g2pReconstruction;
      mlsMpmG2pReconstructionSignature = signature;
      scene.userData.mlsMpmResidentStep = execution;
      scene.userData.mlsMpmP2gGridProjection = mlsMpmP2gGridProjection;
      scene.userData.mlsMpmGridUpdate = mlsMpmGridUpdate;
      scene.userData.mlsMpmG2pReconstruction = mlsMpmG2pReconstruction;
      return execution;
    })();
    pendingMlsMpmResidentStep = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmResidentStep?.promise === promise) pendingMlsMpmResidentStep = null;
    }
  }

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
  function setParticles({ positionsM, colorsRgb, materials = null, emissiveByMaterial = null, materialProperties = null, sphGpuParticleState: nextSphGpuParticleState = null, mlsMpmGpuParticleState: nextMlsMpmGpuParticleState = null }) {
    const activeKeys = new Set();
    const batches = createContinuousSurfaceBatches({ positionsM, colorsRgb, materials, boxEdgeM, boxDimsM: dims });
    opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, batches);
    opticalGpuLookupGeneration += 1;
    scene.userData.opticalGpuTable = opticalGpuTable;
    scene.userData.opticalGpuLookup = opticalGpuLookup;
    scene.userData.opticalGpuLookupExecution = null;
    scene.userData.opticalGpuLookupDrawState = null;
    if (
      sphGpuParticleUpload?.status === 'webgpu-uploaded'
      && sphGpuParticleUploadSignature !== sphGpuParticleSignature(nextSphGpuParticleState)
    ) {
      destroySphGpuParticleBuffers(sphGpuParticleUpload);
    }
    sphGpuParticleState = nextSphGpuParticleState;
    scene.userData.sphGpuParticleState = sphGpuParticleState;
    sphGpuParticleUpload = null;
    sphGpuParticleUploadSignature = null;
    scene.userData.sphGpuParticleUpload = null;
    if (
      mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded'
      && mlsMpmGpuParticleUploadSignature !== mlsMpmGpuParticleSignature(nextMlsMpmGpuParticleState)
    ) {
      destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    }
    mlsMpmGpuParticleState = nextMlsMpmGpuParticleState;
    scene.userData.mlsMpmGpuParticleState = mlsMpmGpuParticleState;
    mlsMpmGpuParticleUpload = null;
    mlsMpmGpuParticleUploadSignature = null;
    scene.userData.mlsMpmGpuParticleUpload = null;
    mlsMpmMechanicsPrediction = null;
    mlsMpmMechanicsPredictionSignature = null;
    scene.userData.mlsMpmMechanicsPrediction = null;
    mlsMpmP2gGridProjection?.gpuResult?.destroyGridBuffer?.();
    mlsMpmP2gGridProjection?.destroyGridBuffer?.();
    mlsMpmP2gGridProjection = null;
    mlsMpmP2gGridProjectionSignature = null;
    scene.userData.mlsMpmP2gGridProjection = null;
    mlsMpmGridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
    mlsMpmGridUpdate?.destroyUpdatedGridBuffer?.();
    mlsMpmGridUpdate = null;
    mlsMpmGridUpdateSignature = null;
    scene.userData.mlsMpmGridUpdate = null;
    mlsMpmG2pReconstruction = null;
    mlsMpmG2pReconstructionSignature = null;
    scene.userData.mlsMpmG2pReconstruction = null;
    mlsMpmResidentStep = null;
    mlsMpmResidentStepSignature = null;
    scene.userData.mlsMpmResidentStep = null;
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
    if (sphGpuParticleUpload?.status === 'webgpu-uploaded') destroySphGpuParticleBuffers(sphGpuParticleUpload);
    if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    mlsMpmP2gGridProjection?.gpuResult?.destroyGridBuffer?.();
    mlsMpmP2gGridProjection?.destroyGridBuffer?.();
    mlsMpmGridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
    mlsMpmGridUpdate?.destroyUpdatedGridBuffer?.();
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
    },
    getOpticalGpuLookup() {
      return opticalGpuLookup;
    },
    getOpticalGpuDrawState() {
      return scene.userData.opticalGpuLookupDrawState;
    },
    getSphGpuParticleState() {
      return sphGpuParticleState;
    },
    getSphGpuParticleUpload() {
      return sphGpuParticleUpload;
    },
    getMlsMpmGpuParticleState() {
      return mlsMpmGpuParticleState;
    },
    getMlsMpmGpuParticleUpload() {
      return mlsMpmGpuParticleUpload;
    },
    getMlsMpmMechanicsPrediction() {
      return mlsMpmMechanicsPrediction;
    },
    getMlsMpmP2gGridProjection() {
      return mlsMpmP2gGridProjection;
    },
    getMlsMpmGridUpdate() {
      return mlsMpmGridUpdate;
    },
    getMlsMpmG2pReconstruction() {
      return mlsMpmG2pReconstruction;
    },
    getMlsMpmResidentStep() {
      return mlsMpmResidentStep;
    },
    refreshOpticalGpuLookup,
    refreshSphGpuParticleBuffers,
    refreshMlsMpmGpuParticleBuffers,
    refreshMlsMpmMechanicsPrediction,
    refreshMlsMpmP2gGridProjection,
    refreshMlsMpmGridUpdate,
    refreshMlsMpmG2pReconstruction,
    refreshMlsMpmResidentStep,
    requestOpticalGpuDevice: requestCachedOpticalGpuDevice
  };
}
