import {
  ELEMENT_CLOSURE_GENERATOR_FINGERPRINT,
  deriveElementProperties,
  deriveMolecularBulkClosure,
  elementMaterialClosure
} from './elementClosures.js';
import {
  QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
  buildMaterialDerivationVisualizationBundle
} from '../electronicStructure/quantumDerivationArtifacts.js';
import {
  RADIAL_KS_WEBGPU_PROGRAM_HASH,
  solveAtomWebGpu
} from '../electronicStructure/radialKohnShamWebGpu.js';
import {
  OPTICAL_RESOLVER_MODE_CHERENKOV,
  OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
  resolveMetalOpticalWebGpu,
  resolveOpticalBatchWebGpu
} from './opticalResolverWebGpu.js';
import { evaluateCherenkovClosure } from './nuclearCherenkovClosure.js';
import { MATERIAL_RESOLVER_MANIFEST_SCHEMA } from './materialResolverManifest.js';

export const MATERIAL_RESOLVER_PIPELINE_SCHEMA = 'peercompute.ulg.material-resolver-pipeline.v1';

export const MATERIAL_RESOLVER_DEFAULT_FINGERPRINT =
  `${ELEMENT_CLOSURE_GENERATOR_FINGERPRINT}::${QUANTUM_DERIVATION_GENERATOR_FINGERPRINT}`
  + `::${OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH}::${RADIAL_KS_WEBGPU_PROGRAM_HASH}`;

function hashKey(parts) {
  const text = JSON.stringify(parts);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `fnv1a64:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Unified content-addressed, generator-fingerprint-guarded material resolver
 * pipeline for atomic, elemental, optical, nuclear/Cherenkov, molecular, and
 * quantum->A4 material closures.
 *
 * When supplied with a WebGPU `device`, runs native WGSL Drude-Lorentz/CIE
 * optical derivation and WGSL radial Kohn-Sham Hartree/PBE-XC/spin-orbit passes
 * reporting `resolverStatus: 'webgpu-derived'`. Falls back cleanly to worker
 * or CPU derivation without duplicating authority paths.
 */
export function createMaterialResolverPipeline({
  generatorFingerprint = MATERIAL_RESOLVER_DEFAULT_FINGERPRINT,
  workerDispatch = null,
  device = null,
  maxEntries = 256
} = {}) {
  const entries = new Map();
  let activeFingerprint = String(generatorFingerprint);
  let activeDevice = device || null;
  let hits = 0;
  let misses = 0;
  let webgpuDerivations = 0;
  let staleEvictions = 0;

  function setDevice(nextDevice) {
    activeDevice = nextDevice || null;
  }

  function pruneIfNeeded() {
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
    }
  }

  function lookup(cacheKey) {
    const record = entries.get(cacheKey);
    if (!record) return null;
    if (record.generatorFingerprint !== activeFingerprint) {
      entries.delete(cacheKey);
      staleEvictions += 1;
      return null;
    }
    hits += 1;
    return record;
  }

  function store(cacheKey, value, meta) {
    entries.set(cacheKey, Object.freeze({
      cacheKey,
      generatorFingerprint: activeFingerprint,
      storedAtMs: Date.now(),
      ...meta,
      value
    }));
    pruneIfNeeded();
  }

  function invalidateForFingerprint(nextFingerprint) {
    const next = String(nextFingerprint || '').trim();
    if (!next || next === activeFingerprint) return 0;
    const evicted = entries.size;
    entries.clear();
    staleEvictions += evicted;
    activeFingerprint = next;
    return evicted;
  }

  async function resolveElement(atomicNumberZ, options = {}) {
    const functional = String(options.functional || 'pbe').toLowerCase();
    const scalarRelativistic = options.scalarRelativistic !== false;
    const includeGasPhase = options.includeGasPhase === true;
    const includeClosure = options.includeClosure !== false;
    const gridPointsN = options.gridPointsN ?? 500;
    const gpuDevice = options.device !== undefined ? options.device : activeDevice;
    const useWebGpu = Boolean(gpuDevice && typeof gpuDevice.createComputePipeline === 'function' && options.useWebGpu !== false);

    const cacheKey = hashKey([
      'element',
      activeFingerprint,
      atomicNumberZ,
      functional,
      scalarRelativistic,
      includeGasPhase,
      includeClosure,
      gridPointsN,
      useWebGpu ? 'webgpu' : 'cpu'
    ]);
    const cached = lookup(cacheKey);
    if (cached) {
      return {
        ...cached.value,
        resolverStatus: 'cache-hit',
        derivedBackend: cached.backend,
        cacheKey,
        generatorFingerprint: activeFingerprint
      };
    }

    misses += 1;
    let derived;
    let backend = 'cpu-derived';
    if (useWebGpu) {
      const properties = deriveElementProperties(atomicNumberZ, {
        ...options,
        functional,
        scalarRelativistic,
        gridPointsN
      });
      const gpuAtom = await solveAtomWebGpu(gpuDevice, atomicNumberZ, {
        functional,
        spinOrbit: true,
        gridPointsN: Math.min(256, gridPointsN),
        maxScf: options.webgpuMaxScf ?? 64,
        tol: options.webgpuTol ?? 5e-4,
        returnRadialDensity: true
      });
      let gpuOptical = null;
      if (properties.conductionElectronDensityPerM3 > 0) {
        gpuOptical = await resolveMetalOpticalWebGpu(gpuDevice, {
          atomicNumberZ,
          conductionElectronDensityPerM3: properties.conductionElectronDensityPerM3,
          interbandOscillators: properties.opticalInterbandOscillators || null,
          interbandOptions: options.opticalInterbandOptions || {}
        });
      }
      const enrichedProperties = {
        ...properties,
        ...(gpuOptical ? {
          opticalColorSrgb: gpuOptical.baseColorSrgb,
          webgpuOptical: gpuOptical
        } : {}),
        webgpuAtomicStructure: {
          schema: gpuAtom.schema,
          resolverStatus: gpuAtom.resolverStatus,
          totalEnergyHa: gpuAtom.totalEnergyHa,
          integratedElectrons: gpuAtom.integratedElectrons,
          scfIterations: gpuAtom.scfIterations,
          scfL1Delta: gpuAtom.scfL1Delta,
          orbitals: gpuAtom.orbitals,
          webgpuProgramHash: gpuAtom.webgpuProgramHash
        },
        derivationStages: Object.freeze({
          atomicScf: gpuAtom.resolverStatus,
          opticalSpectral: gpuOptical ? gpuOptical.resolverStatus : 'not-applicable',
          bulkClosures: 'cpu-derived'
        }),
        webgpuDerived: true
      };
      const closure = includeClosure
        ? elementMaterialClosure(atomicNumberZ, {
          ...options,
          functional,
          scalarRelativistic,
          includeGasPhase,
          gridPointsN
        })
        : null;
      if (closure && gpuOptical) {
        closure.properties = {
          ...closure.properties,
          opticalColorSrgb: gpuOptical.baseColorSrgb,
          webgpuOptical: gpuOptical,
          webgpuDerived: true
        };
      }
      derived = {
        properties: enrichedProperties,
        closure,
        webgpuAtom: gpuAtom,
        webgpuOptical: gpuOptical,
        derivationStages: enrichedProperties.derivationStages,
        webgpuProgramHashes: Object.freeze({
          optical: OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
          radialKohnSham: RADIAL_KS_WEBGPU_PROGRAM_HASH
        })
      };
      backend = 'hybrid-webgpu-atomic-optical-cpu-bulk';
      webgpuDerivations += 1;
    } else if (typeof workerDispatch === 'function') {
      const workerResult = await workerDispatch({
        kind: 'material.resolve-element',
        atomicNumberZ,
        options: { functional, scalarRelativistic, includeGasPhase, includeClosure, gridPointsN },
        generatorFingerprint: activeFingerprint
      });
      if (workerResult) {
        derived = workerResult;
        backend = workerResult.resolverStatus || 'worker-cpu-derived';
      }
    }
    if (!derived) {
      const properties = deriveElementProperties(atomicNumberZ, {
        ...options,
        functional,
        scalarRelativistic,
        gridPointsN
      });
      const closure = includeClosure
        ? elementMaterialClosure(atomicNumberZ, {
          ...options,
          functional,
          scalarRelativistic,
          includeGasPhase,
          gridPointsN
        })
        : null;
      derived = { properties, closure };
    }

    store(cacheKey, derived, { family: 'electronic-structure-band-optics', backend });
    return {
      ...derived,
      resolverStatus: backend,
      derivedBackend: backend,
      cacheKey,
      generatorFingerprint: activeFingerprint
    };
  }

  async function resolveOpticalBatch(requests = [], options = {}) {
    const gpuDevice = options.device !== undefined ? options.device : activeDevice;
    if (gpuDevice && typeof gpuDevice.createComputePipeline === 'function' && options.useWebGpu !== false) {
      const batch = await resolveOpticalBatchWebGpu(gpuDevice, requests, {
        keepResident: options.keepResident === true,
        readback: options.readback !== false
      });
      webgpuDerivations += 1;
      return {
        ...batch,
        generatorFingerprint: activeFingerprint
      };
    }
    const list = Array.isArray(requests) ? requests : [];
    const hasNonCherenkov = list.some((req) => (req?.mode ?? 0) !== OPTICAL_RESOLVER_MODE_CHERENKOV);
    if (hasNonCherenkov) {
      throw new Error(
        'resolveOpticalBatch requires a valid WebGPU GPUDevice for Drude-Lorentz/band-gap spectral integration (refusing to echo uncomputed requests as cpu-derived).'
      );
    }
    return {
      schema: MATERIAL_RESOLVER_PIPELINE_SCHEMA,
      resolverStatus: 'cpu-derived',
      generatorFingerprint: activeFingerprint,
      results: list.map((req) => evaluateCherenkovClosure({
        ...req,
        refractiveIndex: Number.isFinite(Number(req?.refractiveIndex)) ? Number(req.refractiveIndex) : 1.0
      })),
      residentBuffers: null
    };
  }

  async function resolveCherenkov(params = {}, options = {}) {
    const gpuDevice = options.device !== undefined ? options.device : activeDevice;
    // Fail closed to vacuum (n = 1.0) when refractiveIndex is omitted (never assume H2O 1.333)
    const refractiveIndex = Number.isFinite(Number(params?.refractiveIndex)) && Number(params.refractiveIndex) >= 1.0
      ? Number(params.refractiveIndex)
      : 1.0;
    if (gpuDevice && typeof gpuDevice.createComputePipeline === 'function' && options.useWebGpu !== false) {
      const batch = await resolveOpticalBatchWebGpu(gpuDevice, [{
        mode: OPTICAL_RESOLVER_MODE_CHERENKOV,
        beta: params.beta,
        refractiveIndex,
        chargeZ: params.chargeZ ?? 1
      }]);
      webgpuDerivations += 1;
      const row = batch.results[0];
      return {
        ...row,
        srgb: row.baseColorSrgb,
        beta: params.beta,
        thresholdBeta: 1 / refractiveIndex,
        resolverStatus: 'webgpu-derived',
        generatorFingerprint: activeFingerprint
      };
    }
    return {
      ...evaluateCherenkovClosure({ ...params, refractiveIndex }),
      resolverStatus: 'cpu-derived',
      generatorFingerprint: activeFingerprint
    };
  }

  async function resolveMolecule({
    formula = 'H2O',
    atoms,
    basis = 'sto-3g',
    functional = 'pbe',
    includeVisualizationBundle = false,
    gridDim = 12
  } = {}) {
    const cacheKey = hashKey([
      'molecule',
      activeFingerprint,
      formula,
      atoms,
      basis,
      functional,
      includeVisualizationBundle,
      gridDim
    ]);
    const cached = lookup(cacheKey);
    if (cached) {
      return {
        ...cached.value,
        resolverStatus: 'cache-hit',
        derivedBackend: cached.backend,
        cacheKey,
        generatorFingerprint: activeFingerprint
      };
    }

    misses += 1;
    let derived;
    let backend = 'cpu-derived';
    if (typeof workerDispatch === 'function') {
      const workerResult = await workerDispatch({
        kind: 'material.resolve-molecule',
        formula,
        atoms,
        basis,
        functional,
        includeVisualizationBundle,
        gridDim,
        generatorFingerprint: activeFingerprint
      });
      if (workerResult) {
        derived = workerResult;
        backend = workerResult.resolverStatus || 'worker-cpu-derived';
      }
    }
    if (!derived) {
      const bulkClosure = deriveMolecularBulkClosure({ formula, atoms, basis });
      const visualizationBundle = includeVisualizationBundle
        ? buildMaterialDerivationVisualizationBundle({
          materialKey: String(formula).toLowerCase(),
          formula,
          atoms,
          basis,
          functional,
          gridDim,
          includeUmp2: false,
          includeQhaClosure: false,
          includeTriadA4Replay: true
        })
        : null;
      derived = { bulkClosure, visualizationBundle };
    }

    store(cacheKey, derived, { family: 'molecular-geometry-md', backend });
    return {
      ...derived,
      resolverStatus: backend,
      derivedBackend: backend,
      cacheKey,
      generatorFingerprint: activeFingerprint
    };
  }

  function stats() {
    return Object.freeze({
      schema: MATERIAL_RESOLVER_PIPELINE_SCHEMA,
      manifestSchema: MATERIAL_RESOLVER_MANIFEST_SCHEMA,
      generatorFingerprint: activeFingerprint,
      webgpuDeviceAttached: Boolean(activeDevice),
      webgpuProgramHashes: Object.freeze({
        optical: OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
        radialKohnSham: RADIAL_KS_WEBGPU_PROGRAM_HASH
      }),
      entryCount: entries.size,
      maxEntries,
      hits,
      misses,
      webgpuDerivations,
      staleEvictions
    });
  }

  function clear() {
    entries.clear();
  }

  return Object.freeze({
    schema: MATERIAL_RESOLVER_PIPELINE_SCHEMA,
    setDevice,
    resolveElement,
    resolveMolecule,
    resolveOpticalBatch,
    resolveCherenkov,
    invalidateForFingerprint,
    stats,
    clear
  });
}
