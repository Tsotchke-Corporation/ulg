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
import { MATERIAL_RESOLVER_MANIFEST_SCHEMA } from './materialResolverManifest.js';

export const MATERIAL_RESOLVER_PIPELINE_SCHEMA = 'peercompute.ulg.material-resolver-pipeline.v1';

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
 * pipeline for atomic, elemental, molecular, and quantum->A4 material closures.
 *
 * Prevents silent stale-cache reuse whenever physics solvers or relativistic
 * models change, and supports optional worker offloading without duplicating
 * authority paths.
 */
export function createMaterialResolverPipeline({
  generatorFingerprint = `${ELEMENT_CLOSURE_GENERATOR_FINGERPRINT}::${QUANTUM_DERIVATION_GENERATOR_FINGERPRINT}`,
  workerDispatch = null,
  maxEntries = 256
} = {}) {
  const entries = new Map();
  let activeFingerprint = String(generatorFingerprint);
  let hits = 0;
  let misses = 0;
  let staleEvictions = 0;

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
    const cacheKey = hashKey([
      'element',
      activeFingerprint,
      atomicNumberZ,
      functional,
      scalarRelativistic,
      includeGasPhase,
      includeClosure,
      gridPointsN
    ]);
    const cached = lookup(cacheKey);
    if (cached) {
      return {
        ...cached.value,
        resolverStatus: 'cache-hit',
        cacheKey,
        generatorFingerprint: activeFingerprint
      };
    }

    misses += 1;
    let derived;
    let backend = 'cpu-derived';
    if (typeof workerDispatch === 'function') {
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
      cacheKey,
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
      cacheKey,
      generatorFingerprint: activeFingerprint
    };
  }

  function stats() {
    return Object.freeze({
      schema: MATERIAL_RESOLVER_PIPELINE_SCHEMA,
      manifestSchema: MATERIAL_RESOLVER_MANIFEST_SCHEMA,
      generatorFingerprint: activeFingerprint,
      entryCount: entries.size,
      maxEntries,
      hits,
      misses,
      staleEvictions
    });
  }

  function clear() {
    entries.clear();
  }

  return Object.freeze({
    schema: MATERIAL_RESOLVER_PIPELINE_SCHEMA,
    resolveElement,
    resolveMolecule,
    invalidateForFingerprint,
    stats,
    clear
  });
}
