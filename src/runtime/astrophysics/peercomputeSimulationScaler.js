// PeerCompute Client Capability Detection & Multiscale SPH Workload Scaler
// (`src/runtime/astrophysics/peercomputeSimulationScaler.js`).
//
// Uses PeerCompute's official read-only hardware capability probe (`probeCapabilities`)
// and declarative workload sizers (`sizeCountWorkload`, `sizeGrid3dWorkload`,
// `sizeGrid2dWorkload`, `selectQualityPreset`) to dynamically scale ULG Universes'
// first-principles GPU simulations (L0 Cosmic Web, L1 Galactic Collapse, L2 Nebular
// Coalescence, L4 3D Multi-Material SPH Planetary Genesis & Spherical Geology) to get
// the most out of each client device — from smartphones up to high-end discrete GPU
// workstations and clusters — while strictly honoring `device.limits`!

import {
  CAPABILITIES_SCHEMA,
  defaultTierBudgets,
  inferHardwareTier,
  probeCapabilities,
  readCapabilityOverrides,
  selectQualityPreset,
  sizeCountWorkload,
  sizeGrid2dWorkload,
  sizeGrid3dWorkload
} from '../peercomputeCore.js';

export const ULG_PEERCOMPUTE_SIM_SCALER_SCHEMA = 'ulg.astrophysics.peercompute-sim-scaler.v1';

const MANUAL_QUALITY_SCALE = Object.freeze({
  low: 0.42,
  med: 1.0,
  high: 2.0,
  ultra: 3.4
});

const QUALITY_PRESET_CANDIDATES = Object.freeze([
  Object.freeze({ id: 'low', minTier: 'mobile', minPerfScale: 0.1, estimatedGpuBytes: 48 * 1024 * 1024 }),
  Object.freeze({ id: 'med', minTier: 'laptop', minPerfScale: 0.85, estimatedGpuBytes: 128 * 1024 * 1024 }),
  Object.freeze({ id: 'high', minTier: 'workstation', minPerfScale: 1.65, estimatedGpuBytes: 256 * 1024 * 1024 }),
  Object.freeze({ id: 'ultra', minTier: 'cluster', minPerfScale: 3.0, estimatedGpuBytes: 512 * 1024 * 1024 })
]);

function extractLiveDeviceLimits(device) {
  const lim = device?.limits;
  if (!lim || typeof lim !== 'object') return {};
  const keys = [
    'maxBufferSize',
    'maxStorageBufferBindingSize',
    'maxComputeWorkgroupStorageSize',
    'maxComputeInvocationsPerWorkgroup',
    'maxComputeWorkgroupsPerDimension',
    'maxStorageBuffersPerShaderStage',
    'maxTextureDimension2D',
    'maxTextureDimension3D'
  ];
  const out = {};
  for (const k of keys) {
    const v = Number(lim[k]);
    if (Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
  }
  return out;
}

function normalizeCapabilitiesWithDevice(rawCaps, device, overrides) {
  const devLimits = extractLiveDeviceLimits(device);
  const adapterLimits = rawCaps?.webgpu?.limits || {};
  const mergedLimits = { ...adapterLimits, ...devLimits };
  const isFallback = Boolean(rawCaps?.webgpu?.isFallbackAdapter);
  const gpuAvailable = Boolean(device || rawCaps?.webgpu?.available);

  const cpuCores = Math.max(1, Math.floor(Number(overrides?.cpuCores ?? rawCaps?.cpu?.cores) || 4));
  const deviceMemoryGiB = Number(overrides?.deviceMemoryGiB ?? rawCaps?.memory?.deviceMemoryGiB) || null;
  const os = rawCaps?.environment?.os || 'other';
  const isMobileOs = os === 'android' || os === 'ios';

  // Honor PeerCompute's hardware tier inference, and upgrade desktop discrete GPUs with
  // large WebGPU storage-buffer ceilings (>= 512 MB) when browser deviceMemory is capped at 8 GiB!
  let tier = overrides?.tier || rawCaps?.tier || inferHardwareTier({
    cpuCores,
    deviceMemoryGiB,
    gpuAvailable,
    isMobileOs
  });
  const maxStorageBytes = Number(mergedLimits.maxStorageBufferBindingSize || mergedLimits.maxBufferSize || 0);
  if (!overrides?.tier && !isMobileOs && !isFallback && gpuAvailable) {
    if (tier === 'laptop' && maxStorageBytes >= 512 * 1024 * 1024 && cpuCores >= 8) {
      tier = 'workstation';
    } else if (tier === 'workstation' && maxStorageBytes >= 2 * 1024 * 1024 * 1024 && cpuCores >= 24) {
      tier = 'cluster';
    }
  }
  if (isFallback && !overrides?.tier) {
    tier = 'mobile';
  }

  const baseBudgets = defaultTierBudgets(tier);
  const memoryBudgetMB = Number(overrides?.memoryBudgetMB ?? rawCaps?.planningBudgets?.memoryBudgetMB ?? baseBudgets.memoryBudgetMB);
  const gpuMemoryBudgetMB = Number(overrides?.gpuMemoryBudgetMB ?? rawCaps?.planningBudgets?.gpuMemoryBudgetMB ?? baseBudgets.gpuMemoryBudgetMB);
  const budgetScale = Number(overrides?.budgetScale ?? rawCaps?.planningBudgets?.budgetScale ?? 1.0);

  return {
    schema: rawCaps?.schema || CAPABILITIES_SCHEMA,
    tier,
    cpu: { cores: cpuCores, source: rawCaps?.cpu?.source || 'probe' },
    memory: { deviceMemoryGiB, ...(rawCaps?.memory || {}) },
    environment: rawCaps?.environment || { kind: 'browser', browser: 'other', os },
    webgpu: {
      ...(rawCaps?.webgpu || {}),
      available: gpuAvailable,
      isFallbackAdapter: isFallback,
      limits: mergedLimits,
      info: rawCaps?.webgpu?.info || (device?.adapterInfo ? {
        vendor: device.adapterInfo.vendor || '',
        architecture: device.adapterInfo.architecture || '',
        device: device.adapterInfo.device || '',
        description: device.adapterInfo.description || ''
      } : {})
    },
    planningBudgets: {
      memoryBudgetMB,
      gpuMemoryBudgetMB,
      budgetScale: Number.isFinite(budgetScale) && budgetScale > 0 ? budgetScale : 1.0
    }
  };
}

/**
 * Pure deterministic multiscale simulation workload planner built directly on
 * PeerCompute's `selectQualityPreset`, `sizeCountWorkload`, `sizeGrid3dWorkload`,
 * and `sizeGrid2dWorkload`.
 */
export function buildPeerComputeSimulationProfile(capabilities = {}, {
  device = null,
  qualityMode = 'auto',
  overrides = null
} = {}) {
  const effectiveOverrides = overrides && typeof overrides === 'object' ? { ...overrides } : {};
  const isManualQuality = qualityMode && qualityMode !== 'auto' && Object.prototype.hasOwnProperty.call(MANUAL_QUALITY_SCALE, qualityMode);
  const normalizedCaps = normalizeCapabilitiesWithDevice(capabilities, device, effectiveOverrides);

  // If the user explicitly picks LOW/MED/HIGH/ULTRA, translate that into a PeerCompute budgetScale
  // while STILL clamping strictly to real GPU hardware limits (`maxStorageBufferBindingSize`, VRAM)!
  const sizingOverrides = { ...effectiveOverrides };
  if (isManualQuality) {
    sizingOverrides.tier = qualityMode === 'low'
      ? 'mobile'
      : (qualityMode === 'med' ? 'laptop' : (qualityMode === 'high' ? 'workstation' : 'cluster'));
    sizingOverrides.budgetScale = 1.0;
  }

  const ctx = {
    capabilities: normalizedCaps,
    overrides: sizingOverrides
  };

  const presetChoice = selectQualityPreset({
    name: 'ulg-universes-quality',
    presets: QUALITY_PRESET_CANDIDATES
  }, ctx);
  const qualityId = isManualQuality ? qualityMode : presetChoice.presetId;

  // 1. L0 Cosmic Web (3D FLRW TreePM particles & FFT grid)
  const cosmoGrid = sizeGrid3dWorkload({
    name: 'l0-cosmic-web-particles',
    minDim: 22,
    baseDim: 28,
    maxDim: 40,
    step: 2,
    cellStrideBytes: 32,
    buffersCount: 2,
    memoryFraction: 0.15
  }, ctx);
  const cosmoFftN = cosmoGrid.x >= 26 ? 32 : 16;

  // 2. L1 Galactic Collapse & Spiral Particle-Mesh
  const galaxyStarsSizing = sizeCountWorkload({
    name: 'l1-galaxy-stars',
    minCount: 16384,
    baseCount: 32768,
    maxCount: 98304,
    multiple: 4096,
    strideBytes: 32,
    buffersCount: 2,
    memoryFraction: 0.18,
    workgroupSize: 64
  }, ctx);

  // 3. L2 Whole-Star-System GPU Nebular Coalescence (high-resolution 32K..131K parcels on desktop/workstation/cluster!)
  const nebularParcelsSizing = sizeCountWorkload({
    name: 'l2-nebular-parcels',
    minCount: 4096,
    baseCount: 32768,
    maxCount: 131072,
    multiple: 2048,
    strideBytes: 64,
    buffersCount: 2,
    memoryFraction: 0.20,
    workgroupSize: 64
  }, ctx);
  const nebularRadialBins = nebularParcelsSizing.count >= 16384 ? 128 : (nebularParcelsSizing.count >= 8192 ? 96 : 64);

  // 3B. L3 3D MLS-MPM Stellar Core Fusion + Schroeder Scale-Atlas Multipole Self-Gravity
  const stellarParcelsSizing = sizeCountWorkload({
    name: 'l3-stellar-fusion-parcels',
    minCount: 3072,
    baseCount: 8192,
    maxCount: 24576,
    multiple: 1024,
    strideBytes: 64,
    buffersCount: 2,
    memoryFraction: 0.16,
    workgroupSize: 64
  }, ctx);
  const stellarGridN = stellarParcelsSizing.count >= 12288 ? 32 : 24;

  // 4. L4 3D Multi-Material WebGPU SPH Planetary Genesis & Spherical Geology
  const sphParcelsSizing = sizeCountWorkload({
    name: 'l4-planetary-sph-parcels',
    minCount: 5120,
    baseCount: 16384,
    maxCount: 57344,
    multiple: 2048,
    strideBytes: 64,
    buffersCount: 2,
    memoryFraction: 0.20,
    workgroupSize: 64
  }, ctx);

  // 3D spatial SPH grid: 32^3 (mobile) -> 40^3 (laptop) -> 48^3 (workstation) -> 64^3 (cluster)!
  const sphGridSizing = sizeGrid3dWorkload({
    name: 'l4-planetary-sph-grid',
    minDim: 32,
    baseDim: 40,
    maxDim: 64,
    step: 8,
    cellStrideBytes: 64,
    buffersCount: 2,
    memoryFraction: 0.22,
    workgroupSize: 64
  }, ctx);

  // Spherical geology projection map: 512x256 (mobile) -> 768x384 (laptop) -> 1024x512 (workstation/cluster)!
  const sphMapSizing = sizeGrid2dWorkload({
    name: 'l4-planetary-sph-geology-map',
    minWidth: 512,
    baseWidth: 768,
    maxWidth: 1024,
    aspectRatio: 0.5,
    step: 128,
    cellStrideBytes: 56, // 24 B atomic acc + 16 B geoA + 16 B geoB
    buffersCount: 1,
    memoryFraction: 0.22
  }, ctx);

  // 5. Watchable Long-Horizon Multi-Substep GPU Coalescence Pacing!
  //    Each animation frame batches many GPU compute substeps inside ONE `queue.submit`
  //    (with cadenced canonical SS 3D Multipole updates on L2) so:
  //      - L1 Galaxy Collapse unfolds over 360..1,800 dynamical steps (real mergers, cold streams, triaxial relaxation!)
  //      - L2 Solar-System Nebular Coalescence runs 10x longer (2,800..16,800 steps = 250-500+ inner Keplerian orbits!)
  //        with a fast 10x-deeper discovery burst (640..2,400 substeps) on [Crystallize Into Orbits]!
  //      - L4 Planetary 3D SPH runs fast through Formation (240..1,560 steps), then NEVER stops — seamlessly
  //        downshifting into continuous Secular Live Gear (mantle convection + live 3D Fe-core Geodynamo!)
  const perfScale = presetChoice.perfScale;
  const tier = sizingOverrides.tier || normalizedCaps.tier;
  const l1TargetSteps = tier === 'cluster' ? 1800 : (tier === 'workstation' ? 1400 : (tier === 'laptop' ? 840 : 360));
  const l1SubstepsPerFrame = tier === 'cluster' ? 6 : (tier === 'workstation' ? 5 : (tier === 'laptop' ? 3 : 2));
  const l2TargetSteps = tier === 'cluster' ? 16800 : (tier === 'workstation' ? 12800 : (tier === 'laptop' ? 7200 : 2800));
  const l2SubstepsPerFrame = tier === 'cluster' ? 28 : (tier === 'workstation' ? 24 : (tier === 'laptop' ? 16 : 8));
  const l2GravityCadence = 4;
  const l4TargetSteps = tier === 'cluster' ? 1560 : (tier === 'workstation' ? 1180 : (tier === 'laptop' ? 640 : 240));
  const l4SubstepsPerFrame = tier === 'cluster' ? 8 : (tier === 'workstation' ? 6 : (tier === 'laptop' ? 4 : 2));
  const l4SecularSubstepsPerFrame = 1;
  const l3SubstepsPerFrame = tier === 'cluster' ? 4 : (tier === 'workstation' ? 3 : 2);
  const sphErosionPasses = tier === 'cluster' ? 40 : (tier === 'workstation' ? 34 : (tier === 'laptop' ? 24 : 16));
  // Re-project spherical geology smoothly every 24-36 substeps during live 3D SPH formation (keeping 60 FPS!)
  const l4MapUpdateCadence = sphParcelsSizing.count >= 24576 ? 32 : (sphParcelsSizing.count >= 12288 ? 24 : 14);
  // Chunked burst substeps used when clicking [Finish / Crystallize] or pre-computing non-observed worlds:
  // L2 burst is 10x deeper (640..2,400 substeps across 32K..131K parcels) for real secular planetary core accretion!
  const l4BurstSubsteps = tier === 'cluster' ? 240 : (tier === 'workstation' ? 200 : (tier === 'laptop' ? 150 : 96));
  const l2BurstSubsteps = tier === 'cluster' ? 2400 : (tier === 'workstation' ? 1800 : (tier === 'laptop' ? 1200 : 640));

  const gpuInfo = normalizedCaps.webgpu.info || {};
  const gpuLabel = [gpuInfo.vendor, gpuInfo.architecture, gpuInfo.description]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .join(' · ')
    .slice(0, 64) || (normalizedCaps.webgpu.isFallbackAdapter ? 'Software WebGPU' : 'Hardware WebGPU');
  const maxStorageMB = Math.round((normalizedCaps.webgpu.limits?.maxStorageBufferBindingSize || 0) / (1024 * 1024));

  return Object.freeze({
    schema: ULG_PEERCOMPUTE_SIM_SCALER_SCHEMA,
    capabilitySchema: normalizedCaps.schema,
    mode: isManualQuality ? 'manual' : 'auto',
    qualityId,
    tier,
    detectedTier: normalizedCaps.tier,
    perfScale,
    cpuCores: normalizedCaps.cpu.cores,
    deviceMemoryGiB: normalizedCaps.memory.deviceMemoryGiB,
    gpuLabel,
    maxStorageMB,
    isMobileOs: normalizedCaps.environment.os === 'android' || normalizedCaps.environment.os === 'ios',
    isSoftwareGpu: Boolean(normalizedCaps.webgpu.isFallbackAdapter),
    capabilities: normalizedCaps,
    summaryLabel: `${tier.toUpperCase()} (${qualityId.toUpperCase()}) · ${sphParcelsSizing.count.toLocaleString()} SPH · ${sphGridSizing.x}³ Grid · ${sphMapSizing.width}×${sphMapSizing.height}`,
    workloads: Object.freeze({
      cosmoGridPerSide: cosmoGrid.x,
      cosmoFftN,
      galaxyStars: galaxyStarsSizing.count,
      l1TargetSteps,
      l1SubstepsPerFrame,
      nebularParcels: nebularParcelsSizing.count,
      nebularRadialBins,
      l2TargetSteps,
      l2SubstepsPerFrame,
      l2GravityCadence,
      l2BurstSubsteps,
      stellarParcels: stellarParcelsSizing.count,
      stellarGridN,
      l3SubstepsPerFrame,
      sphParcels: sphParcelsSizing.count,
      sphGridN: sphGridSizing.x,
      sphMapWidth: sphMapSizing.width,
      sphMapHeight: sphMapSizing.height,
      sphErosionPasses,
      l4TargetSteps,
      l4SubstepsPerFrame,
      l4SecularSubstepsPerFrame,
      l4MapUpdateCadence,
      l4BurstSubsteps,
      surfaceGridN: tier === 'mobile' ? 81 : (tier === 'laptop' ? 129 : 161),
      surfaceParticles: tier === 'mobile' ? 1024 : (tier === 'laptop' ? 2048 : 4096)
    }),
    rawSizing: Object.freeze({
      presetChoice,
      cosmoGrid,
      galaxyStarsSizing,
      nebularParcelsSizing,
      sphParcelsSizing,
      sphGridSizing,
      sphMapSizing
    })
  });
}

/**
 * Probe live client hardware capabilities via PeerCompute (`probeCapabilities`) and
 * compute ULG Universes' scaled multiscale SPH & astrophysics workload profile!
 */
export async function resolvePeerComputeSimulationProfile({
  device = null,
  qualityMode = 'auto',
  search = typeof globalThis?.location?.search === 'string' ? globalThis.location.search : '',
  timeoutMs = 1500
} = {}) {
  const overrides = readCapabilityOverrides(search);
  let rawCaps = null;
  try {
    rawCaps = await probeCapabilities({
      timeoutMs,
      includeWebGL: false,
      includeStorageEstimate: false,
      overrides
    });
  } catch {
    rawCaps = null;
  }
  return buildPeerComputeSimulationProfile(rawCaps || {}, {
    device,
    qualityMode,
    overrides
  });
}
