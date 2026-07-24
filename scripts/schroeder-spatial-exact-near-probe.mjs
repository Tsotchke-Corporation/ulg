import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SPATIAL_EXACT_NEAR_BASE_URL
  || process.env.ULG_SPATIAL_EPOCH_BASE_URL
  || 'https://127.0.0.1:5174/';
const outputPath = process.env.ULG_SPATIAL_EXACT_NEAR_OUTPUT
  || '/tmp/ulg-schroeder-spatial-exact-near-probe.json';
const iccTraceOutputPath = process.env.ULG_SPATIAL_EXACT_NEAR_ICC_TRACE_OUTPUT
  || '/tmp/ulg-schroeder-spatial-exact-near-probe.events.jsonl';

function exactNearFailClosedCase(name, {
  particleOverrides = [],
  corruptQueryEvidence = null,
  corruptHeader = null
} = {}) {
  const particles = [
    { position: [-0.25, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 30, phaseId: 1, domainId: 301, level: 0 },
    { position: [0.25, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 31, phaseId: 2, domainId: 311, level: 0 }
  ].map((particle, index) => ({ ...particle, ...(particleOverrides[index] || {}) }));
  return {
    name,
    element: { materialId: 30, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles,
    policies: [
      { materialIds: [30, 31], phaseIds: [1, 2], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25,
    corruptQueryEvidence,
    corruptHeader,
    oracleFailClosed: true
  };
}

const cases = Object.freeze([
  {
    name: 'basic',
    // Exercise more than one 64-lane workgroup so mounted pressure/contact
    // cannot be the first place a parallel-row backend hazard appears.
    elementCopies: 88,
    element: { materialId: 1, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 1, phaseId: 1, domainId: 11, level: 0 },
      { position: [0.3, 0, 0], velocity: [-2, 0, 0], mass: 3, materialId: 2, phaseId: 2, domainId: 37, level: 0 }
    ],
    policies: [
      { materialIds: [1, 2], phaseIds: [1, 2], supportRadiusM: 0.5 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5,
    maxSearchRadiusM: 0.1
  },
  {
    name: 'negative-multilevel',
    element: { materialId: 3, phaseId: 1, centroid: [-2, -1, 0.5], normal: [0, 1, 0] },
    particles: [
      { position: [-2.1, -1.4, 0.4], velocity: [0, 2, 0], mass: 4, materialId: 3, phaseId: 1, domainId: 21, level: -1 },
      { position: [-1.9, -0.7, 0.55], velocity: [0, -2, 0], mass: 4, materialId: 4, phaseId: 2, domainId: 22, level: 1 }
    ],
    policies: [
      { materialIds: [3, 4], phaseIds: [1, 2], supportRadiusM: 0.5 }
    ],
    minLevel: -1,
    maxLevel: 1,
    baseGridSpacingM: 0.5,
    maxSearchRadiusM: 0.1
  },
  {
    name: 'cylinder-corner',
    element: { materialId: 12, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.8, 0.8, 0], velocity: [1, 0, 0], mass: 1, materialId: 12, phaseId: 1, domainId: 121, level: 0 },
      { position: [0.8, -0.8, 0], velocity: [-1, 0, 0], mass: 1, materialId: 13, phaseId: 2, domainId: 131, level: 0 }
    ],
    policies: [
      { materialIds: [12, 13], phaseIds: [1, 2], supportRadiusM: 0.5 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5
  },
  {
    name: 'same-material-different-phase',
    element: { materialId: 5, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.3, 0, 0], velocity: [0.5, 0, 0], mass: 2, materialId: 5, phaseId: 1, domainId: 51, level: 0 },
      { position: [0.4, 0, 0], velocity: [-0.5, 0, 0], mass: 6, materialId: 5, phaseId: 2, domainId: 52, level: 0 }
    ],
    policies: [
      { materialIds: [5, 5], phaseIds: [1, 2], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25
  },
  {
    name: 'same-material-phase-exact-domains',
    element: { materialId: 6, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.6, 0, 0], velocity: [0.25, 0, 0], mass: 3, materialId: 6, phaseId: 1, domainId: 61, level: 0 },
      { position: [0.5, 0, 0], velocity: [-0.75, 0, 0], mass: 6, materialId: 6, phaseId: 1, domainId: 62, level: 0 },
      { position: [-0.02, 0, 0], velocity: [20, 0, 0], mass: 1, materialId: 6, phaseId: 1, domainId: 99, level: 0 }
    ],
    policies: [
      { materialIds: [6, 6], phaseIds: [1, 1], domainIds: [61, 62], supportRadiusM: 0.5 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5
  },
  {
    name: 'later-policy-larger-support',
    element: { materialId: 7, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.45, 0, 0], velocity: [1.5, 0, 0], mass: 5, materialId: 7, phaseId: 1, domainId: 71, level: 0 },
      { position: [0.45, 0, 0], velocity: [-0.5, 0, 0], mass: 5, materialId: 8, phaseId: 2, domainId: 72, level: 0 }
    ],
    policies: [
      { sourceIndex: 41, materialIds: [7, 8], phaseIds: [1, 2], supportRadiusM: 0.1 },
      { sourceIndex: 99, materialIds: [7, 8], phaseIds: [1, 2], supportRadiusM: 0.5 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5,
    maxSearchRadiusM: 0.05
  },
  {
    name: 'later-policy-larger-support-reversed',
    element: { materialId: 7, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.45, 0, 0], velocity: [1.5, 0, 0], mass: 5, materialId: 7, phaseId: 1, domainId: 71, level: 0 },
      { position: [0.45, 0, 0], velocity: [-0.5, 0, 0], mass: 5, materialId: 8, phaseId: 2, domainId: 72, level: 0 }
    ],
    policies: [
      { sourceIndex: 99, materialIds: [7, 8], phaseIds: [1, 2], supportRadiusM: 0.5 },
      { sourceIndex: 41, materialIds: [7, 8], phaseIds: [1, 2], supportRadiusM: 0.1 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5,
    maxSearchRadiusM: 0.05
  },
  {
    name: 'endpoint-b-exact-domains',
    element: { materialId: 21, phaseId: 2, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 21, phaseId: 2, domainId: 202, level: 0 },
      { position: [0.2, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 20, phaseId: 1, domainId: 201, level: 0 }
    ],
    policies: [
      { materialIds: [20, 21], phaseIds: [1, 2], domainIds: [201, 202], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25
  },
  {
    name: 'endpoint-b-exact-domains-reversed-declaration',
    element: { materialId: 21, phaseId: 2, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 21, phaseId: 2, domainId: 202, level: 0 },
      { position: [0.2, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 20, phaseId: 1, domainId: 201, level: 0 }
    ],
    policies: [
      { materialIds: [21, 20], phaseIds: [2, 1], domainIds: [202, 201], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25
  },
  {
    name: 'cross-side-material-phase-mismatch',
    element: { materialId: 18, phaseId: 2, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.25, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 18, phaseId: 1, domainId: 181, level: 0 },
      { position: [0.25, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 19, phaseId: 2, domainId: 191, level: 0 }
    ],
    policies: [
      { materialIds: [18, 19], phaseIds: [1, 2], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25
  },
  {
    name: 'non-finite-and-inactive-particles',
    element: { materialId: 10, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.2, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 10, phaseId: 1, domainId: 101, level: 0 },
      { position: [0.2, 0, 0], velocity: [Number.NaN, 0, 0], mass: 1, materialId: 11, phaseId: 2, domainId: 111, level: 0 },
      { position: [0.3, 0, 0], velocity: [0, 0, 0], mass: 0, materialId: 11, phaseId: 2, domainId: 112, level: 0 },
      { position: [0.4, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 11, phaseId: 2, domainId: 113, level: 0, status: 0 },
      { position: [Number.POSITIVE_INFINITY, 0, 0], activePosition: [0.45, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 11, phaseId: 2, domainId: 114, level: 0 }
    ],
    policies: [
      { materialIds: [10, 11], phaseIds: [1, 2], supportRadiusM: 0.5 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5
  },
  {
    name: 'stale-directory-header',
    element: { materialId: 14, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.25, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 14, phaseId: 1, domainId: 141, level: 0 },
      { position: [0.25, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 15, phaseId: 2, domainId: 151, level: 0 }
    ],
    policies: [
      { materialIds: [14, 15], phaseIds: [1, 2], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25,
    corruptHeader: 'generation',
    oracleFailClosed: true
  },
  {
    name: 'csr-corruption-control',
    element: { materialId: 22, phaseId: 1, centroid: [0.25, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.6, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 90, phaseId: 1, domainId: 901, level: 0 },
      { position: [-0.1, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 91, phaseId: 1, domainId: 911, level: 0 },
      { position: [0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 22, phaseId: 1, domainId: 221, level: 0 },
      { position: [0.3, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 23, phaseId: 2, domainId: 231, level: 0 }
    ],
    policies: [
      { materialIds: [22, 23], phaseIds: [1, 2], supportRadiusM: 1 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5
  },
  {
    name: 'corrupt-queried-csr-offset',
    element: { materialId: 22, phaseId: 1, centroid: [0.25, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.6, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 90, phaseId: 1, domainId: 901, level: 0 },
      { position: [-0.1, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 91, phaseId: 1, domainId: 911, level: 0 },
      { position: [0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 22, phaseId: 1, domainId: 221, level: 0 },
      { position: [0.3, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 23, phaseId: 2, domainId: 231, level: 0 }
    ],
    policies: [
      { materialIds: [22, 23], phaseIds: [1, 2], supportRadiusM: 1 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5,
    corruptDirectory: 'queried-offset',
    oracleFailClosed: true
  },
  {
    name: 'corrupt-queried-csr-member',
    element: { materialId: 22, phaseId: 1, centroid: [0.25, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.6, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 90, phaseId: 1, domainId: 901, level: 0 },
      { position: [-0.1, 0, 0], velocity: [0, 0, 0], mass: 1, materialId: 91, phaseId: 1, domainId: 911, level: 0 },
      { position: [0.2, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 22, phaseId: 1, domainId: 221, level: 0 },
      { position: [0.3, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 23, phaseId: 2, domainId: 231, level: 0 }
    ],
    policies: [
      { materialIds: [22, 23], phaseIds: [1, 2], supportRadiusM: 1 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.5,
    corruptDirectory: 'queried-member',
    oracleFailClosed: true
  },
  {
    name: 'invalid-active-row-header',
    element: { materialId: 16, phaseId: 1, centroid: [0, 0, 0], normal: [1, 0, 0] },
    particles: [
      { position: [-0.25, 0, 0], velocity: [1, 0, 0], mass: 2, materialId: 16, phaseId: 1, domainId: 161, level: 0 },
      { position: [0.25, 0, 0], velocity: [-1, 0, 0], mass: 2, materialId: 17, phaseId: 2, domainId: 171, level: 0, activeStatus: 32 }
    ],
    policies: [
      { materialIds: [16, 17], phaseIds: [1, 2], supportRadiusM: 0.25 }
    ],
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25,
    oracleFailClosed: true
  },
  exactNearFailClosedCase('query-row-chart-mismatch', {
    particleOverrides: [{ activeChartId: 1 }]
  }),
  exactNearFailClosedCase('query-row-level-outside-profile', {
    particleOverrides: [{ activeLevel: 1 }]
  }),
  exactNearFailClosedCase('query-row-spacing-bit-mismatch', {
    particleOverrides: [{ activeSpacingM: 0.5 }]
  }),
  exactNearFailClosedCase('query-evidence-chart-corrupt', {
    corruptQueryEvidence: 'chart'
  }),
  exactNearFailClosedCase('query-evidence-min-level-corrupt', {
    corruptQueryEvidence: 'min-level'
  }),
  exactNearFailClosedCase('query-evidence-max-level-corrupt', {
    corruptQueryEvidence: 'max-level'
  }),
  exactNearFailClosedCase('query-evidence-base-spacing-corrupt', {
    corruptQueryEvidence: 'base-spacing'
  }),
  exactNearFailClosedCase('query-source-adapter-corrupt', {
    corruptHeader: 'source-adapter'
  })
]);

function chromiumArgs() {
  const extra = String(process.env.ULG_SPATIAL_EXACT_NEAR_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function normalized3(value) {
  const length = Math.hypot(value[0], value[1], value[2]);
  return length > 1e-12
    ? value.map((component) => component / length)
    : [0, 1, 0];
}

function endpointMatches(particle, materialId, phaseId) {
  return Math.abs(particle.materialId - materialId) < 0.5
    && (phaseId <= 0.5 || Math.abs(particle.phaseId - phaseId) < 0.5);
}

function candidateComparator(left, right) {
  return left.score - right.score
    || left.domainId - right.domainId
    || left.index - right.index;
}

function pairComparator(left, right) {
  return left.score - right.score
    || left.source.domainId - right.source.domainId
    || left.target.domainId - right.target.domainId
    || left.source.index - right.source.index
    || left.target.index - right.target.index
    || left.policyIndex - right.policyIndex;
}

// Deliberately scans the particle arrays directly. It does not decode, query,
// or reuse the GPU spatial directory and therefore remains an independent
// exact-near parity oracle.
function bruteForceOracle(spec) {
  if (spec.oracleFailClosed) return Array(8).fill(0);
  const element = spec.element;
  if (
    !Number.isFinite(element.materialId)
    || !Number.isFinite(element.phaseId)
    || !element.centroid.every(Number.isFinite)
    || !element.normal.every(Number.isFinite)
  ) return Array(8).fill(0);
  const normal = normalized3(element.normal);
  const globalSearchRadius = Number(spec.maxSearchRadiusM ?? 0);
  const pairs = [];
  for (const [policyIndex, policy] of spec.policies.entries()) {
    const [materialA, materialB] = policy.materialIds;
    const [phaseA, phaseB] = policy.phaseIds;
    const supportRadius = Number(policy.supportRadiusM);
    if (
      ![materialA, materialB, phaseA, phaseB, supportRadius].every(Number.isFinite)
      || supportRadius < 0
    ) continue;
    const matchesA = Math.abs(element.materialId - materialA) < 0.5
      && (phaseA <= 0.5 || Math.abs(element.phaseId - phaseA) < 0.5);
    const matchesB = Math.abs(element.materialId - materialB) < 0.5
      && (phaseB <= 0.5 || Math.abs(element.phaseId - phaseB) < 0.5);
    const exactPhaseA = phaseA > 0.5 && Math.abs(element.phaseId - phaseA) < 0.5;
    const exactPhaseB = phaseB > 0.5 && Math.abs(element.phaseId - phaseB) < 0.5;
    let elementSide = matchesA ? 1 : (matchesB ? 2 : 0);
    if (matchesA && matchesB && exactPhaseB && !exactPhaseA) elementSide = 2;
    if (elementSide === 0) continue;
    const rawDomains = Array.isArray(policy.domainIds) ? policy.domainIds : [0, 0];
    const domains = rawDomains.map((value) => (
      Number.isSafeInteger(value) && value > 0 && value <= 0x00ff_ffff ? value : 0
    ));
    const bodySpecific = domains.some((value) => value > 0);
    const domainPairReady = domains[0] > 0 && domains[1] > 0;
    if (bodySpecific && !domainPairReady) continue;
    const elementIsA = elementSide === 1;
    const sourceMaterialId = elementIsA ? materialA : materialB;
    const sourcePhaseId = elementIsA ? phaseA : phaseB;
    const targetMaterialId = elementIsA ? materialB : materialA;
    const targetPhaseId = elementIsA ? phaseB : phaseA;
    const sourceDomainId = domainPairReady ? (elementIsA ? domains[0] : domains[1]) : 0;
    const targetDomainId = domainPairReady ? (elementIsA ? domains[1] : domains[0]) : 0;
    const support = Math.max(supportRadius, 1e-6);
    const searchRadius = Math.max(support * 2, globalSearchRadius, 1e-6);
    const searchRadius2 = searchRadius * searchRadius;
    if (!Number.isFinite(searchRadius2)) continue;
    const candidates = [];
    for (const [index, particle] of spec.particles.entries()) {
      if (
        !particle.position.every(Number.isFinite)
        || !particle.velocity.every(Number.isFinite)
        || !Number.isFinite(particle.mass)
        || particle.mass <= 0
        || !Number.isFinite(particle.materialId)
        || !Number.isFinite(particle.phaseId)
        || !Number.isFinite(particle.status ?? 1)
        || (particle.status ?? 1) <= 0
        || !Number.isSafeInteger(particle.domainId)
        || particle.domainId < 0
        || particle.domainId > 0x00ff_ffff
      ) continue;
      const delta = particle.position.map((component, axis) => component - element.centroid[axis]);
      const signed = dot3(delta, normal);
      const lateral2 = Math.max(dot3(delta, delta) - signed * signed, 0);
      if (
        !Number.isFinite(signed)
        || !Number.isFinite(lateral2)
        || Math.abs(signed) > searchRadius
        || lateral2 > searchRadius2
      ) continue;
      candidates.push({ ...particle, index, signed, lateral2 });
    }
    const scored = (endpoint, requiredMaterialId, requiredPhaseId, requiredDomainId) => (
      candidates
        .filter((candidate) => (
          endpointMatches(candidate, requiredMaterialId, requiredPhaseId)
          && (requiredDomainId === 0 || candidate.domainId === requiredDomainId)
        ))
        .map((candidate) => {
          const wrongSide = endpoint === 'source'
            ? candidate.signed > support * 0.25
            : candidate.signed < -support * 0.25;
          return {
            ...candidate,
            score: candidate.lateral2 + candidate.signed ** 2
              + (wrongSide ? searchRadius2 : 0)
          };
        })
        .sort(candidateComparator)
        .slice(0, 2)
    );
    const sources = scored('source', sourceMaterialId, sourcePhaseId, sourceDomainId);
    const targets = scored('target', targetMaterialId, targetPhaseId, targetDomainId);
    for (const source of sources) {
      for (const target of targets) {
        if (source.index === target.index) continue;
        pairs.push({
          policyIndex,
          source,
          target,
          score: source.score + target.score
        });
      }
    }
  }
  pairs.sort(pairComparator);
  const selected = pairs[0];
  if (!selected) return Array(8).fill(0);
  const signedSpan = selected.target.signed - selected.source.signed;
  const directionSign = signedSpan >= 0 ? 1 : -1;
  const velocityDelta = selected.target.velocity.map(
    (value, axis) => value - selected.source.velocity[axis]
  );
  const mass = selected.source.mass * selected.target.mass
    / Math.max(selected.source.mass + selected.target.mass, 1e-12);
  return [
    Math.max(Math.abs(signedSpan), Number(spec.gapFloorM ?? 0)),
    dot3(velocityDelta, normal.map((value) => value * directionSign)),
    mass,
    2,
    selected.source.domainId,
    selected.target.domainId,
    selected.source.domainId > 0 && selected.target.domainId > 0 ? 1 : 0,
    selected.policyIndex + 1
  ];
}

function contactPressureOracle(spec, kinematics = bruteForceOracle(spec)) {
  if (kinematics[3] !== 2) return 0;
  const policyIndex = Math.round(kinematics[7]) - 1;
  const policy = spec.policies[policyIndex];
  if (!policy) return 0;
  const supportRadius = Math.max(Number(policy.supportRadiusM), 1e-6);
  const gap = Math.max(Number(kinematics[0]), 0);
  const closingSpeed = Math.max(-Number(kinematics[1]), 0);
  if (gap > supportRadius && (closingSpeed <= 0 || gap > supportRadius * 2)) return 0;
  const effectiveGap = Math.max(gap, supportRadius * 0.001, 1e-9);
  const proximity = Math.min(1, Math.max(0, (supportRadius - gap) / supportRadius));
  const barrierGain = proximity * Math.min((supportRadius / effectiveGap) ** 2, 1_000_000);
  const normalStiffnessPa = Number(policy.normalStiffnessPa ?? 1);
  const responseScale = Number(policy.responseScale ?? 1);
  const dampingViscosityPaS = Number(policy.dampingViscosityPaS ?? 0);
  const elasticPressure = Math.max(normalStiffnessPa, 0) * Math.max(responseScale, 0)
    * barrierGain;
  const dampingPressure = Math.max(dampingViscosityPaS, 0) * closingSpeed / supportRadius;
  const inertialPressure = kinematics[2] > 0 && closingSpeed > 0
    ? kinematics[2] * closingSpeed ** 2 / effectiveGap
    : 0;
  return Math.min(
    Math.max(elasticPressure + dampingPressure + inertialPressure, 0),
    Number(policy.maxContactPressurePa ?? 1)
  );
}

function rowsNear(left, right, tolerance = 2e-5) {
  return left.length === right.length && left.every((value, index) => (
    Number.isFinite(value)
    && Number.isFinite(right[index])
    && Math.abs(value - right[index]) <= tolerance * Math.max(1, Math.abs(right[index]))
  ));
}

function evaluateChecks(raw) {
  const checks = [
    ['webgpu-executed', raw.status === 'gpu-evidence-ready'],
    ['compilation-clean', raw.compilationErrors.length === 0],
    ['validation-clean', raw.validationErrors.length === 0],
    ['internal-errors-clean', raw.internalErrors.length === 0],
    ['out-of-memory-clean', raw.outOfMemoryErrors.length === 0],
    ['uncaptured-clean', raw.uncapturedErrors.length === 0],
    ['device-not-lost', raw.deviceLost.length === 0]
  ];
  for (const spec of cases) {
    const actual = raw.cases[spec.name];
    const expected = bruteForceOracle(spec);
    const expectedContactPressurePa = contactPressureOracle(spec, expected);
    checks.push(
      [`${spec.name}:oracle-parity`, rowsNear(actual.output, expected)],
      [`${spec.name}:final-force-oracle-parity`, rowsNear(
        [actual.contactPressurePa],
        [expectedContactPressurePa]
      )],
      [`${spec.name}:force-used-borrowed-generation`, actual.forceSolverSpatialSelected === true
        && actual.forceSolverBorrowedGeneration === true
        && actual.forceSolverPrivateBuildCount === 0],
      [`${spec.name}:caller-generation-ready`, actual.generationReady === true],
      [`${spec.name}:adapter2-query-intent`, actual.generationSourceAdapterId === 2
        && actual.exactNearQueryIntentReady === true
        && actual.exactNearQueryIntentFrozen === true],
      [`${spec.name}:borrowed-generation-selected`, actual.borrowedSelected === true],
      [`${spec.name}:one-shared-directory-build`, actual.generationDirectoryBuildCount === 1
        && actual.sharedGenerationDirectoryBuildCount === 1],
      [`${spec.name}:zero-pressure-private-build`, actual.borrowedDirectoryBuildCount === 0
        && actual.privateParticleBinBuildCount === 0
        && actual.privateParticleBinSuppressed === true],
      [`${spec.name}:no-private-allocation-labels`, actual.privateAllocationLabels.length === 0],
      [`${spec.name}:borrower-did-not-release`, actual.borrowerReleaseScheduled === false
        && actual.releasedBeforeOwner === false],
      [`${spec.name}:owner-released-once-after-readback`, actual.ownerReleaseScheduled === true
        && actual.ownerReleaseCallCount === 1
        && actual.ownerReleaseResult === true
        && actual.releasedAfterOwner === true],
      [`${spec.name}:bounded-submission-ownership`, actual.submitDelta === 5]
    );
  }
  checks.push([
    'policy-order-physical-kinematics-invariant',
    rowsNear(
      raw.cases['later-policy-larger-support'].output.slice(0, 7),
      raw.cases['later-policy-larger-support-reversed'].output.slice(0, 7)
    )
  ], [
    'policy-order-token-tracks-packed-row',
    raw.cases['later-policy-larger-support'].output[7] === 2
      && raw.cases['later-policy-larger-support-reversed'].output[7] === 1
  ], [
    'exact-near-token-uses-packed-ordinal-not-source-index',
    cases.find((entry) => entry.name === 'later-policy-larger-support')
      ?.policies.map((policy) => policy.sourceIndex).join(',') === '41,99'
      && raw.cases['later-policy-larger-support'].output[7] === 2
  ], [
    'policy-order-final-force-invariant',
    rowsNear(
      [raw.cases['later-policy-larger-support'].contactPressurePa],
      [raw.cases['later-policy-larger-support-reversed'].contactPressurePa]
    )
      && raw.cases['later-policy-larger-support'].contactPressurePa > 0
  ], [
    'endpoint-b-domain-order-preserved',
    raw.cases['endpoint-b-exact-domains'].output[4] === 202
      && raw.cases['endpoint-b-exact-domains'].output[5] === 201
      && raw.cases['endpoint-b-exact-domains'].contactPressurePa > 0
  ], [
    'endpoint-declaration-order-physical-result-invariant',
    rowsNear(
      raw.cases['endpoint-b-exact-domains'].output,
      raw.cases['endpoint-b-exact-domains-reversed-declaration'].output
    )
      && rowsNear(
        [raw.cases['endpoint-b-exact-domains'].contactPressurePa],
        [raw.cases['endpoint-b-exact-domains-reversed-declaration'].contactPressurePa]
      )
  ], [
    'csr-corruption-positive-control-is-nonzero',
    raw.cases['csr-corruption-control'].output[3] === 2
      && raw.cases['csr-corruption-control'].output.some((value) => value !== 0)
      && raw.cases['csr-corruption-control'].contactPressurePa > 0
  ], [
    'queried-csr-corruption-is-exactly-fail-closed',
    raw.cases['corrupt-queried-csr-offset'].output.every((value) => value === 0)
      && raw.cases['corrupt-queried-csr-member'].output.every((value) => value === 0)
      && raw.cases['corrupt-queried-csr-offset'].contactPressurePa === 0
      && raw.cases['corrupt-queried-csr-member'].contactPressurePa === 0
  ], [
    'query-profile-row-and-tail-corruption-is-exactly-fail-closed',
    [
      'query-row-chart-mismatch',
      'query-row-level-outside-profile',
      'query-row-spacing-bit-mismatch',
      'query-evidence-chart-corrupt',
      'query-evidence-min-level-corrupt',
      'query-evidence-max-level-corrupt',
      'query-evidence-base-spacing-corrupt',
      'query-source-adapter-corrupt'
    ].every((name) => (
      raw.cases[name].output.every((value) => value === 0)
      && raw.cases[name].contactPressurePa === 0
    ))
  ], [
    'authoritative-policy-token-fail-closed',
    rowsNear([
      raw.policyTokenAdmission['authoritative-zero-token'],
      raw.policyTokenAdmission['authoritative-fractional-token'],
      raw.policyTokenAdmission['authoritative-near-integral-token'],
      raw.policyTokenAdmission['authoritative-nan-token'],
      raw.policyTokenAdmission['authoritative-out-of-range-token']
    ], [0, 0, 0, 0, 0])
  ], [
    'authoritative-status-is-exact',
    rowsNear([
      raw.policyTokenAdmission['near-authoritative-status'],
      raw.policyTokenAdmission['near-legacy-status']
    ], [0, 0])
  ], [
    'authoritative-endpoint-and-oriented-domain-mismatch-fail-closed',
    rowsNear([
      raw.policyTokenAdmission['authoritative-endpoint-mismatch'],
      raw.policyTokenAdmission['authoritative-phase-mismatch'],
      raw.policyTokenAdmission['authoritative-oriented-domain-mismatch']
    ], [0, 0, 0])
  ], [
    'authoritative-and-legacy-valid-policy-force',
    rowsNear([
      raw.policyTokenAdmission['authoritative-valid-token'],
      raw.policyTokenAdmission['authoritative-oriented-domain-match'],
      raw.policyTokenAdmission['legacy-valid-unpinned']
    ], [1, 1, 1])
  ], [
    'packed-source-index-does-not-replace-policy-ordinal',
    rowsNear(raw.policyTokenPackedSourceIndices, [91, 203, 307])
      && raw.policyTokenAdmission['authoritative-valid-token'] === 1
      && raw.policyTokenAdmission['authoritative-oriented-domain-match'] === 1
  ], [
    'legacy-cross-side-material-phase-mismatch-fail-closed',
    rowsNear([
      raw.policyTokenAdmission['legacy-cross-side-mismatch']
    ], [0])
  ]);
  const normalized = checks.map(([name, passed]) => ({ name, passed: Boolean(passed) }));
  return {
    checks: normalized,
    passed: normalized.filter((check) => check.passed).length,
    unsatisfiedChecks: normalized.filter((check) => !check.passed).map((check) => check.name),
    total: normalized.length,
    expected: Object.fromEntries(cases.map((spec) => [spec.name, bruteForceOracle(spec)]))
  };
}

async function main() {
  const pageErrors = [];
  const browser = await chromium.launch({
    executablePath: process.env.ULG_SPATIAL_EXACT_NEAR_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: chromiumArgs()
  });
  let raw;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    raw = await page.evaluate(async (caseSpecs) => {
      if (!navigator.gpu) return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const nativeDevice = await adapter.requestDevice();
      const uncapturedErrors = [];
      const deviceLost = [];
      nativeDevice.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      nativeDevice.lost.then((info) => {
        deviceLost.push({ reason: info.reason, message: info.message });
      });
      const counters = {
        submits: 0,
        createdBufferLabels: []
      };
      const shaderModules = [];
      const queueFacade = new Proxy(nativeDevice.queue, {
        get(target, property) {
          if (property === 'submit') {
            return (commandBuffers) => {
              counters.submits += 1;
              return target.submit(commandBuffers);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const runtimeDevice = new Proxy(nativeDevice, {
        get(target, property) {
          if (property === 'queue') return queueFacade;
          if (property === 'createBuffer') {
            return (descriptor) => {
              counters.createdBufferLabels.push(descriptor.label || '');
              return target.createBuffer(descriptor);
            };
          }
          if (property === 'createShaderModule') {
            return (descriptor) => {
              const module = target.createShaderModule(descriptor);
              shaderModules.push({ label: descriptor.label || '', module });
              return module;
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });

      nativeDevice.pushErrorScope('validation');
      nativeDevice.pushErrorScope('internal');
      nativeDevice.pushErrorScope('out-of-memory');
      const token = Date.now();
      const spatial = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?exactNearProbe=${token}`
      );
      const pressure = await import(
        `/src/runtime/sph/sphPressureInterfaceGpuKernel.js?exactNearProbe=${token}`
      );
      const deviceIdentity = await import(
        `/src/runtime/sph/sphGpuDeviceIdentity.js?exactNearProbe=${token}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?exactNearProbe=${token}`);
      const probeCases = {};
      const createBuffer = (label, values, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) => {
        const byteLength = Math.max(4, values.byteLength);
        const buffer = runtimeDevice.createBuffer({ label, size: byteLength, usage });
        if (values.byteLength > 0) runtimeDevice.queue.writeBuffer(buffer, 0, values);
        return deviceIdentity.tagWebGpuBufferDevice(buffer, runtimeDevice);
      };

      for (const [caseIndex, spec] of caseSpecs.entries()) {
        const submitStart = counters.submits;
        const labelStart = counters.createdBufferLabels.length;
        const particleCount = spec.particles.length;
        const epoch = 100 + caseIndex;
        const stateRows = new Float32Array(particleCount * 8);
        const thermoRows = new Float32Array(particleCount * 12);
        const identityRows = new Uint32Array(particleCount);
        const activeRows = new Float32Array(particleCount * 16);
        for (const [index, particle] of spec.particles.entries()) {
          stateRows.set([
            ...particle.position,
            particle.mass,
            ...particle.velocity,
            0
          ], index * 8);
          thermoRows.set([
            particle.materialId,
            particle.phaseId,
            300,
            1000,
            0,
            1,
            0,
            0,
            0.1,
            1,
            particle.status ?? 1,
            0.05
          ], index * 12);
          identityRows[index] = particle.domainId;
          const activePosition = particle.activePosition
            || (particle.position.every(Number.isFinite) ? particle.position : [0, 0, 0]);
          const activeLevel = particle.activeLevel ?? particle.level;
          const spacing = particle.activeSpacingM
            ?? spec.baseGridSpacingM * (2 ** activeLevel);
          activeRows.set([
            activeLevel,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            spacing,
            spacing * 2,
            index,
            particle.activeStatus ?? 1,
            ...activePosition,
            particle.activeChartId ?? 0
          ], index * 16);
        }
        const activeNodeBuffer = createBuffer(`${spec.name}-active-nodes`, activeRows);
        const stateBuffer = createBuffer(`${spec.name}-particle-state`, stateRows);
        const thermoBuffer = createBuffer(`${spec.name}-particle-thermo`, thermoRows);
        const identityBuffer = createBuffer(`${spec.name}-particle-identity`, identityRows);
        const activeNodeList = {
          schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
          status: 'schroeder-active-node-list-submitted',
          particleCount,
          activeCandidateCount: particleCount,
          activeNodeStrideFloats: 16,
          activeNodeBuffer,
          phaseVolumeAssignmentOverlayEnabled: false,
          spatialDirectorySourceSchema:
            'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
          spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
          spatialDirectorySourceReady: true,
          spatialEpochSourceSchema:
            'peercompute.ulg.schroeder-spatial-active-node-source.v1',
          spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
          spatialEpochSourceReady: true,
          spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
          spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
          spatialEpochMinLevel: spec.minLevel,
          spatialEpochMaxLevel: spec.maxLevel,
          spatialEpochBaseGridSpacingM: spec.baseGridSpacingM,
          spatialEpochChartId: 0,
          spatialEpochStorageGeneration: epoch + 1,
          spatialEpochPhysicsTick: epoch,
          spatialEpochPhysicsSubstep: 0,
          spatialEpochPositionEpoch: epoch,
          spatialEpochTopologyEpoch: 1,
          spatialEpochChartEpoch: 1,
          spatialEpochLevelEpoch: epoch,
          spatialEpochSupportEpoch: epoch
        };
        const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
          device: runtimeDevice,
          activeNodeList,
          particleCount,
          laneId: `exact-near-native-probe-${spec.name}`,
          sourceFamily: 'schroeder-active-node-particles'
        });
        const particleSource = {
          status: 'interface-contact-kinematics-particle-source-ready',
          ready: true,
          stateBuffer,
          thermoBuffer,
          identityBuffer,
          identityReady: true,
          identityRequired: true,
          identitySchema: abi.ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
          identityBufferByteLength: identityRows.byteLength,
          particleCount,
          storageGeneration: epoch + 1,
          physicsTick: epoch,
          physicsSubstep: 0,
          positionEpoch: epoch,
          topologyEpoch: 1,
          chartEpoch: 1,
          levelEpoch: epoch,
          supportEpoch: epoch
        };
        const interfaceElements = Array.from(
          { length: Math.max(1, Math.trunc(Number(spec.elementCopies) || 1)) },
          (_, elementIndex) => ({
            status: 'interface-element-ready',
            surfaceIndex: elementIndex,
            materialId: spec.element.materialId,
            phaseId: spec.element.phaseId,
            axisId: 0,
            centroidM: spec.element.centroid,
            areaM2: 1,
            normal: spec.element.normal,
            crossingSign: 0
          })
        );
        const materialInterfaceField = {
          status: 'material-interface-field-ready',
          elementCount: interfaceElements.length,
          elements: interfaceElements,
          spatialEpochInterfaceProvenanceStatus:
            'material-interface-current-particle-epoch-ready',
          spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
          spatialEpochStorageGeneration: epoch + 1,
          spatialEpochPhysicsTick: epoch,
          spatialEpochPhysicsSubstep: 0,
          spatialEpochPositionEpoch: epoch,
          spatialEpochTopologyEpoch: 1,
          spatialEpochChartEpoch: 1,
          spatialEpochLevelEpoch: epoch,
          spatialEpochSupportEpoch: epoch,
          spatialEpochSourceCount: particleCount,
          spatialEpochSourceStateBuffer: stateBuffer,
          spatialEpochSourceThermoBuffer: thermoBuffer,
          spatialEpochSourceIdentityBuffer: identityBuffer
        };
        const spatialSource = pressure.resolveSchroederPressureInterfaceSpatialEpochSource(
          activeNodeList,
          { device: runtimeDevice, particleCount }
        );
        const provenance = pressure.resolveSchroederPressureInterfaceSpatialEpochProvenance({
          spatialSource,
          materialInterfaceField,
          particleSource,
          particleCount,
          requireCompleteBufferFamily: true
        });
        const borrowed = pressure.resolveSchroederPressureInterfaceSpatialEpochGeneration(
          generation,
          { device: runtimeDevice, spatialSource, spatialProvenance: provenance, particleSource, particleCount }
        );
        if (!generation.ready || !spatialSource.ready || !provenance.ready || !borrowed.selected) {
          throw new Error(JSON.stringify({
            case: spec.name,
            generation: { status: generation.status, reason: generation.reason },
            source: { status: spatialSource.status, reason: spatialSource.reason },
            provenance: { status: provenance.status, reason: provenance.reason },
            borrowed: { status: borrowed.status, reason: borrowed.reason }
          }));
        }
        if (spec.corruptHeader === 'generation') {
          runtimeDevice.queue.writeBuffer(
            generation.execution.directoryBuffer,
            3 * Uint32Array.BYTES_PER_ELEMENT,
            new Uint32Array([(generation.execution.generationId + 1) >>> 0])
          );
        }
        if (spec.corruptHeader === 'source-adapter') {
          runtimeDevice.queue.writeBuffer(
            generation.execution.directoryBuffer,
            46 * Uint32Array.BYTES_PER_ELEMENT,
            new Uint32Array([1])
          );
        }
        if (spec.corruptQueryEvidence) {
          const queryEvidenceOffsetWords =
            generation.execution.layout.particleToCellOffsetWords + particleCount;
          const evidenceWord = {
            chart: 0,
            'min-level': 1,
            'max-level': 2,
            'base-spacing': 3
          }[spec.corruptQueryEvidence];
          let corruptValue;
          if (spec.corruptQueryEvidence === 'chart') {
            corruptValue = new Uint32Array([1]);
          } else if (spec.corruptQueryEvidence === 'min-level') {
            corruptValue = new Int32Array([spec.minLevel - 1]);
          } else if (spec.corruptQueryEvidence === 'max-level') {
            corruptValue = new Int32Array([spec.maxLevel + 1]);
          } else {
            corruptValue = new Float32Array([spec.baseGridSpacingM * 2]);
          }
          runtimeDevice.queue.writeBuffer(
            generation.execution.directoryBuffer,
            (queryEvidenceOffsetWords + evidenceWord) * Uint32Array.BYTES_PER_ELEMENT,
            corruptValue
          );
        }
        if (spec.corruptDirectory === 'queried-offset') {
          runtimeDevice.queue.writeBuffer(
            generation.execution.directoryBuffer,
            (generation.execution.layout.cellOffsetsOffsetWords + 1)
              * Uint32Array.BYTES_PER_ELEMENT,
            new Uint32Array([particleCount + 1])
          );
        }
        if (spec.corruptDirectory === 'queried-member') {
          runtimeDevice.queue.writeBuffer(
            generation.execution.directoryBuffer,
            generation.execution.layout.cellMembersOffsetWords
              * Uint32Array.BYTES_PER_ELEMENT,
            new Uint32Array([particleCount])
          );
        }
        const packedElements = pressure.packMaterialInterfaceElementRows(materialInterfaceField);
        const packedPolicy = pressure.packAlgorithmContactPolicyRows({
          schema: pressure.ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
          rows: spec.policies.map((policy, index) => ({
            index: policy.sourceIndex ?? index,
            materialIds: policy.materialIds,
            phaseIds: policy.phaseIds,
            domainIds: policy.domainIds,
            normalStiffnessPa: 1,
            dampingViscosityPaS: 0,
            supportRadiusM: policy.supportRadiusM,
            responseScale: 1,
            maxContactPressurePa: 1,
            contactPressurePa: 1
          }))
        });
        const interfaceBuffer = createBuffer(`${spec.name}-interface-elements`, packedElements.rows);
        const policyBuffer = createBuffer(`${spec.name}-contact-policy`, packedPolicy.rows);
        const derivation = pressure
          .runSphPressureInterfaceSpatialExactNearContactKinematicsWebGpu({
            device: runtimeDevice,
            packedInterfaceElements: packedElements,
            packedContactPolicy: packedPolicy,
            interfaceElementsBuffer: interfaceBuffer,
            contactPolicyBuffer: policyBuffer,
            particleSource,
            spatialBuild: borrowed,
            maxSearchRadiusM: spec.maxSearchRadiusM ?? 0,
            gapFloorM: spec.gapFloorM ?? 0
          });
        const readback = runtimeDevice.createBuffer({
          label: `${spec.name}-exact-near-readback`,
          size: 8 * Float32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const readbackEncoder = runtimeDevice.createCommandEncoder({
          label: `${spec.name}-exact-near-readback`
        });
        readbackEncoder.copyBufferToBuffer(
          derivation.buffer,
          0,
          readback,
          0,
          8 * Float32Array.BYTES_PER_ELEMENT
        );
        runtimeDevice.queue.submit([readbackEncoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const output = Array.from(new Float32Array(readback.getMappedRange()).slice(0, 8));
        readback.unmap();
        const algorithmMaterialContactRows = {
          schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
          status: 'algorithm-material-contact-rows-ready',
          rows: spec.policies.map((policy, index) => ({
            pairKey: `${spec.name}-policy-${index}`,
            materialIds: policy.materialIds,
            phaseIds: policy.phaseIds,
            domainIds: policy.domainIds,
            normalStiffnessPa: policy.normalStiffnessPa ?? 1,
            dampingViscosityPaS: policy.dampingViscosityPaS ?? 0,
            supportRadiusM: policy.supportRadiusM,
            contactPairResponseScale: policy.responseScale ?? 1,
            maxContactPressurePa: policy.maxContactPressurePa ?? 1,
            status: 'algorithm-material-contact-row-ready'
          }))
        };
        const forceResult = await pressure.runSphPressureInterfaceForceRowsWebGpu({
          device: runtimeDevice,
          pressureFeedback: { totalPressurePa: 0 },
          pressureInterfaceCoupling: {
            status: 'pressure-interface-coupling-ready-for-solver'
          },
          materialInterfaceField,
          algorithmMaterialContactRows,
          algorithmContactPairResponseScale: 1,
          algorithmContactMaxPressurePa: 1,
          sphParticleUpload: {
            ...particleSource,
            status: 'webgpu-uploaded'
          },
          particleCount,
          contactKinematicsMaxSearchRadiusM: spec.maxSearchRadiusM ?? 0,
          contactKinematicsGapFloorM: spec.gapFloorM ?? 0,
          schroederActiveNodeList: activeNodeList,
          schroederSpatialEpochGeneration: generation,
          readbackMode: 'full-parity-readback'
        });
        const forceRowValues = Array.from(
          forceResult.pressureInterfaceForceSolver.forceRowValues
        );
        const contactPressurePa = forceRowValues[14] ?? 0;
        const borrowerReleaseScheduled = generation.releaseScheduled === true
          || borrowed.releaseScheduled === true;
        const releasedBeforeOwner = generation.execution.released === true;
        let ownerReleaseCallCount = 0;
        const originalReleaseAfter = generation.runtime.releaseExecutionAfter
          .bind(generation.runtime);
        generation.runtime.releaseExecutionAfter = (...args) => {
          ownerReleaseCallCount += 1;
          return originalReleaseAfter(...args);
        };
        const ownerReleaseScheduled = spatial
          .releaseSchroederSpatialEpochGenerationAfterQueue(generation, runtimeDevice);
        const ownerReleaseResult = await generation.releasePromise;
        const releasedAfterOwner = generation.execution.released === true;
        const caseLabels = counters.createdBufferLabels.slice(labelStart);
        const privateAllocationLabels = caseLabels.filter((label) => (
          label.includes('particle-bin')
          || label.includes('ulg-sph-pressure-spatial-epoch')
        ));
        probeCases[spec.name] = {
          output,
          forceRowValues,
          contactPressurePa,
          forceSolverSpatialSelected:
            forceResult.pressureInterfaceForceSolver.schroederSpatialExactNearSelected === true,
          forceSolverBorrowedGeneration:
            forceResult.pressureInterfaceForceSolver.schroederSpatialExactNearBorrowedGeneration === true,
          forceSolverPrivateBuildCount:
            forceResult.pressureInterfaceForceSolver
              .schroederSpatialExactNearPrivateParticleBinBuildCount,
          generationReady: generation.ready === true && generation.selected === true,
          generationSourceAdapterId: generation.execution.sourceAdapterId,
          exactNearQueryIntentReady:
            generation.execution.exactNearQueryProfile?.ready === true,
          exactNearQueryIntentFrozen:
            Object.isFrozen(generation.execution.exactNearQueryProfile)
            && Object.isFrozen(generation.execution.queryGeometryEvidence),
          generationDirectoryBuildCount: generation.directoryBuildCount,
          borrowedSelected: borrowed.selected === true && borrowed.borrowed === true,
          borrowedDirectoryBuildCount: borrowed.directoryBuildCount,
          sharedGenerationDirectoryBuildCount: borrowed.sharedGenerationDirectoryBuildCount,
          privateParticleBinBuildCount: derivation.spatialExactNearPrivateParticleBinBuildCount,
          privateParticleBinSuppressed:
            derivation.spatialExactNearPrivateParticleBinBuildSuppressed === true,
          directoryOwnership: derivation.spatialExactNearDirectoryOwnership,
          borrowerReleaseScheduled,
          releasedBeforeOwner,
          ownerReleaseScheduled,
          ownerReleaseCallCount,
          ownerReleaseResult,
          releasedAfterOwner,
          privateAllocationLabels,
          submitDelta: counters.submits - submitStart
        };
        readback.destroy();
        derivation.destroyContactKinematicsBuffer();
        for (const buffer of derivation.cleanupBuffers || []) buffer.destroy?.();
        interfaceBuffer.destroy();
        policyBuffer.destroy();
        activeNodeBuffer.destroy();
        stateBuffer.destroy();
        thermoBuffer.destroy();
        identityBuffer.destroy();
      }

      const forceWgsl = await import(`/ulg-gpu-abi/src/wgsl.js?exactNearProbe=${token}`);
      const policyTokenCases = [
        { name: 'authoritative-zero-token', materialId: 7, phaseId: 1, status: 2, token: 0 },
        { name: 'authoritative-fractional-token', materialId: 7, phaseId: 1, status: 2, token: 1.5 },
        { name: 'authoritative-near-integral-token', materialId: 7, phaseId: 1, status: 2, token: 1.00005 },
        { name: 'authoritative-nan-token', materialId: 7, phaseId: 1, status: 2, token: Number.NaN },
        { name: 'authoritative-out-of-range-token', materialId: 7, phaseId: 1, status: 2, token: 4 },
        { name: 'near-authoritative-status', materialId: 7, phaseId: 1, status: 2.00005, token: 1 },
        { name: 'near-legacy-status', materialId: 7, phaseId: 1, status: 1.00005, token: 0 },
        { name: 'authoritative-endpoint-mismatch', materialId: 9, phaseId: 1, status: 2, token: 3 },
        { name: 'authoritative-phase-mismatch', materialId: 7, phaseId: 2, status: 2, token: 3 },
        {
          name: 'authoritative-oriented-domain-mismatch',
          materialId: 7,
          phaseId: 1,
          status: 2,
          token: 3,
          sourceDomainId: 72,
          targetDomainId: 71
        },
        { name: 'authoritative-oriented-domain-match', materialId: 7, phaseId: 1, status: 2, token: 3 },
        { name: 'authoritative-valid-token', materialId: 7, phaseId: 1, status: 2, token: 1 },
        { name: 'legacy-valid-unpinned', materialId: 7, phaseId: 1, status: 1, token: 0 },
        { name: 'legacy-cross-side-mismatch', materialId: 18, phaseId: 2, status: 1, token: 0 }
      ];
      const tokenInterfaceField = {
        status: 'material-interface-field-ready',
        elementCount: policyTokenCases.length,
        elements: policyTokenCases.map((entry, index) => ({
          status: 'interface-element-ready',
          surfaceIndex: index,
          materialId: entry.materialId,
          phaseId: entry.phaseId,
          axisId: 0,
          centroidM: [index, 0, 0],
          areaM2: 1,
          normal: [1, 0, 0],
          crossingSign: 0
        }))
      };
      const tokenPackedElements = pressure.packMaterialInterfaceElementRows(tokenInterfaceField);
      const tokenPackedPolicy = pressure.packAlgorithmContactPolicyRows({
        schema: pressure.ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
          rows: [
            {
            index: 91,
            materialIds: [7, 8],
            phaseIds: [1, 2],
            normalStiffnessPa: 1,
            dampingViscosityPaS: 0,
            supportRadiusM: 0.5,
            responseScale: 1,
            maxContactPressurePa: 1,
            contactPressurePa: 1
          },
          {
            index: 203,
            materialIds: [18, 19],
            phaseIds: [1, 2],
            normalStiffnessPa: 1,
            dampingViscosityPaS: 0,
            supportRadiusM: 0.5,
            responseScale: 1,
            maxContactPressurePa: 1,
            contactPressurePa: 1
          },
          {
            index: 307,
            materialIds: [7, 8],
            phaseIds: [1, 2],
            domainIds: [71, 72],
            normalStiffnessPa: 1,
            dampingViscosityPaS: 0,
            supportRadiusM: 0.5,
            responseScale: 1,
            maxContactPressurePa: 1,
            contactPressurePa: 1
          }
        ]
      });
      const tokenKinematicsRows = new Float32Array(policyTokenCases.length * 8);
      for (const [index, entry] of policyTokenCases.entries()) {
        tokenKinematicsRows.set([
          0.4,
          -2,
          1,
          entry.status,
          entry.sourceDomainId ?? 71,
          entry.targetDomainId ?? 72,
          1,
          entry.token
        ], index * 8);
      }
      const tokenElementsBuffer = createBuffer(
        'policy-token-interface-elements',
        tokenPackedElements.rows
      );
      const tokenPolicyBuffer = createBuffer('policy-token-policy-rows', tokenPackedPolicy.rows);
      const tokenKinematicsBuffer = createBuffer(
        'policy-token-contact-kinematics',
        tokenKinematicsRows
      );
      const tokenGasBuffer = createBuffer('policy-token-gas-rows', new Float32Array(12));
      // The force-row ABI always declares the gas-authority control binding,
      // even when this isolated policy-token fixture selects model 0. Mirror
      // the production kernel's zeroed sentinel so native pipeline validation
      // covers the actual bind-group shape without opting into model-2 data.
      const tokenGasAuthorityControlBuffer = createBuffer(
        'policy-token-gas-authority-control-sentinel',
        new Uint32Array(32)
      );
      const tokenParamsBuffer = createBuffer(
        'policy-token-force-params',
        pressure.createPressureInterfaceParamsArray({
          elementCount: policyTokenCases.length,
          pressurePa: 0,
          gasPressureCellCount: 0,
          pressureModelId: 0,
          contactPolicyRowCount: tokenPackedPolicy.rowCount,
          algorithmContactPairResponseScale: 1,
          algorithmContactMaxPressurePa: 1,
          algorithmContactPairResponseEnabled: true
        }),
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      );
      const tokenOutputByteLength = policyTokenCases.length * 16 * Float32Array.BYTES_PER_ELEMENT;
      const tokenOutputBuffer = runtimeDevice.createBuffer({
        label: 'policy-token-force-output',
        size: tokenOutputByteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const tokenReadbackBuffer = runtimeDevice.createBuffer({
        label: 'policy-token-force-readback',
        size: tokenOutputByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const tokenModule = runtimeDevice.createShaderModule({
        label: 'policy-token-force-shader',
        code: forceWgsl.sphPressureInterfaceForceRowsWgsl
      });
      const tokenBindGroupLayout = runtimeDevice.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
        ]
      });
      const tokenPipeline = runtimeDevice.createComputePipeline({
        label: 'policy-token-force-pipeline',
        layout: runtimeDevice.createPipelineLayout({ bindGroupLayouts: [tokenBindGroupLayout] }),
        compute: { module: tokenModule, entryPoint: 'main' }
      });
      const tokenBindGroup = runtimeDevice.createBindGroup({
        layout: tokenBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: tokenElementsBuffer } },
          { binding: 1, resource: { buffer: tokenOutputBuffer } },
          { binding: 2, resource: { buffer: tokenParamsBuffer } },
          { binding: 3, resource: { buffer: tokenGasBuffer } },
          { binding: 4, resource: { buffer: tokenPolicyBuffer } },
          { binding: 5, resource: { buffer: tokenKinematicsBuffer } },
          { binding: 6, resource: { buffer: tokenGasAuthorityControlBuffer } }
        ]
      });
      const tokenEncoder = runtimeDevice.createCommandEncoder({
        label: 'policy-token-force-dispatch'
      });
      const tokenPass = tokenEncoder.beginComputePass();
      tokenPass.setPipeline(tokenPipeline);
      tokenPass.setBindGroup(0, tokenBindGroup);
      tokenPass.dispatchWorkgroups(1);
      tokenPass.end();
      tokenEncoder.copyBufferToBuffer(
        tokenOutputBuffer,
        0,
        tokenReadbackBuffer,
        0,
        tokenOutputByteLength
      );
      runtimeDevice.queue.submit([tokenEncoder.finish()]);
      await tokenReadbackBuffer.mapAsync(GPUMapMode.READ);
      const tokenForceRows = new Float32Array(tokenReadbackBuffer.getMappedRange());
      const policyTokenAdmission = Object.fromEntries(policyTokenCases.map((entry, index) => [
        entry.name,
        tokenForceRows[index * 16 + 14]
      ]));
      const policyTokenPackedSourceIndices = Array.from(
        { length: tokenPackedPolicy.rowCount },
        (_, index) => tokenPackedPolicy.rows[index * 16 + 10]
      );
      tokenReadbackBuffer.unmap();
      for (const buffer of [
        tokenElementsBuffer,
        tokenPolicyBuffer,
        tokenKinematicsBuffer,
        tokenGasBuffer,
        tokenGasAuthorityControlBuffer,
        tokenParamsBuffer,
        tokenOutputBuffer,
        tokenReadbackBuffer
      ]) buffer.destroy();

      const compilationErrors = [];
      for (const { label, module } of shaderModules) {
        if (typeof module.getCompilationInfo !== 'function') continue;
        const info = await module.getCompilationInfo();
        for (const message of info.messages || []) {
          if (message.type === 'error') compilationErrors.push(`${label}: ${message.message}`);
        }
      }
      const outOfMemoryError = await nativeDevice.popErrorScope();
      const internalError = await nativeDevice.popErrorScope();
      const validationError = await nativeDevice.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        status: 'gpu-evidence-ready',
        cases: probeCases,
        policyTokenAdmission,
        policyTokenPackedSourceIndices,
        totalSubmits: counters.submits,
        compilationErrors,
        validationErrors: validationError ? [validationError.message] : [],
        internalErrors: internalError ? [internalError.message] : [],
        outOfMemoryErrors: outOfMemoryError ? [outOfMemoryError.message] : [],
        uncapturedErrors,
        deviceLost,
        adapterInfo: adapter.info || null
      };
    }, cases);
  } finally {
    await browser.close();
  }
  if (pageErrors.length > 0 && raw?.status === 'gpu-evidence-ready') {
    raw.pageErrors = pageErrors;
  }
  const evaluation = raw?.status === 'gpu-evidence-ready'
    ? evaluateChecks(raw)
    : {
        checks: [],
        passed: 0,
        unsatisfiedChecks: [raw?.reason || 'probe did not execute'],
        total: 0,
        expected: Object.fromEntries(cases.map((spec) => [spec.name, bruteForceOracle(spec)]))
      };
  const report = {
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-native-probe.v1',
    timestamp: new Date().toISOString(),
    baseUrl,
    status: evaluation.unsatisfiedChecks.length === 0 && pageErrors.length === 0 ? 'pass' : 'fail',
    ...evaluation,
    pageErrors,
    raw
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const iccEvent = report.status === 'pass'
    ? {
        kind: 'test_result',
        name: 'schroeder-spatial-exact-near-native-webgpu',
        status: 'PASS',
        value: {
          passed: report.passed,
          failed: 0,
          cases: cases.length,
          assertionTotal: report.total,
          reportPath: outputPath
        },
        snippet: 'Native WebGPU exact-near output matched the independent brute-force oracle.'
      }
    : {
        kind: 'failure',
        name: 'schroeder-spatial-exact-near-native-webgpu',
        status: 'FAIL',
        value: {
          passed: report.passed,
          failed: report.unsatisfiedChecks.length + report.pageErrors.length,
          cases: cases.length,
          assertionTotal: report.total,
          reportPath: outputPath
        },
        snippet: 'Native WebGPU exact-near probe did not satisfy every assertion.'
      };
  await writeFile(iccTraceOutputPath, `${JSON.stringify(iccEvent)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
