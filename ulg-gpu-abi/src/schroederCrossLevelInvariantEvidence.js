export const ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-cross-level-invariant-evidence.v1';
export const ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-cross-level-invariant-evidence-execution.v1';

export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_MAGIC = 0x53434931;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_VERSION = 1;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_WORDS = 48;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES =
  SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_READY = 1 << 0;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_RESIDUAL_EXCEEDED = 1 << 4;

export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_LAYOUT = Object.freeze({
  magic: 0,
  abiVersion: 1,
  statusFlags: 2,
  generationId: 3,
  fineNodeCount: 4,
  parentNodeCount: 5,
  couplingFlags: 6,
  workgroupSize: 7,
  fineMassKg: 8,
  fineFirstMomentXKgM: 9,
  fineFirstMomentYKgM: 10,
  fineFirstMomentZKgM: 11,
  fineMomentumXKgMPerS: 12,
  fineMomentumYKgMPerS: 13,
  fineMomentumZKgMPerS: 14,
  fineAngularMomentumXKgM2PerS: 15,
  fineAngularMomentumYKgM2PerS: 16,
  fineAngularMomentumZKgM2PerS: 17,
  fineActiveNodeCount: 18,
  fineInvalidNodeCount: 19,
  parentMassKg: 20,
  parentFirstMomentXKgM: 21,
  parentFirstMomentYKgM: 22,
  parentFirstMomentZKgM: 23,
  parentMomentumXKgMPerS: 24,
  parentMomentumYKgMPerS: 25,
  parentMomentumZKgMPerS: 26,
  parentAngularMomentumXKgM2PerS: 27,
  parentAngularMomentumYKgM2PerS: 28,
  parentAngularMomentumZKgM2PerS: 29,
  parentActiveNodeCount: 30,
  parentInvalidNodeCount: 31,
  massResidualKg: 32,
  firstMomentResidualXKgM: 33,
  firstMomentResidualYKgM: 34,
  firstMomentResidualZKgM: 35,
  momentumResidualXKgMPerS: 36,
  momentumResidualYKgMPerS: 37,
  momentumResidualZKgMPerS: 38,
  angularMomentumResidualXKgM2PerS: 39,
  angularMomentumResidualYKgM2PerS: 40,
  angularMomentumResidualZKgM2PerS: 41,
  massToleranceKg: 42,
  firstMomentToleranceKgM: 43,
  momentumToleranceKgMPerS: 44,
  angularMomentumToleranceKgM2PerS: 45,
  completionOrdinal: 46,
  reserved: 47
});

export const SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_ABI = Object.freeze({
  schema: ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_SCHEMA,
  version: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_VERSION,
  magic: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_MAGIC,
  words: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_WORDS,
  byteLength: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES,
  layout: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_LAYOUT,
  quantities: Object.freeze([
    'mass',
    'first-mass-moment',
    'linear-momentum',
    'grid-orbital-angular-momentum'
  ]),
  source: 'compact-two-level-hierarchy-node-lists',
  overflowPolicy: 'fail-closed',
  readbackPolicy: 'explicit-fixed-evidence-probe-only'
});

function finiteWord(words, index) {
  return new Float32Array(words.buffer, words.byteOffset, words.length)[index];
}

export function decodeSchroederCrossLevelInvariantEvidence(words) {
  if (!(words instanceof Uint32Array)
    || words.length < SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_WORDS) {
    return null;
  }
  const layout = SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_LAYOUT;
  const f32 = (name) => finiteWord(words, layout[name]);
  const vector = (x, y, z) => [f32(x), f32(y), f32(z)];
  const statusFlags = words[layout.statusFlags];
  return Object.freeze({
    schema: ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_SCHEMA,
    magic: words[layout.magic],
    abiVersion: words[layout.abiVersion],
    statusFlags,
    admitted: (
      statusFlags & (
        SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_READY
        | SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_ADMITTED
      )
    ) === (
      SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_READY
      | SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_ADMITTED
    ),
    generationId: words[layout.generationId],
    fineNodeCount: words[layout.fineNodeCount],
    parentNodeCount: words[layout.parentNodeCount],
    fine: Object.freeze({
      massKg: f32('fineMassKg'),
      firstMassMomentKgM: vector(
        'fineFirstMomentXKgM',
        'fineFirstMomentYKgM',
        'fineFirstMomentZKgM'
      ),
      linearMomentumKgMPerS: vector(
        'fineMomentumXKgMPerS',
        'fineMomentumYKgMPerS',
        'fineMomentumZKgMPerS'
      ),
      orbitalAngularMomentumKgM2PerS: vector(
        'fineAngularMomentumXKgM2PerS',
        'fineAngularMomentumYKgM2PerS',
        'fineAngularMomentumZKgM2PerS'
      ),
      activeNodeCount: words[layout.fineActiveNodeCount],
      invalidNodeCount: words[layout.fineInvalidNodeCount]
    }),
    parent: Object.freeze({
      massKg: f32('parentMassKg'),
      firstMassMomentKgM: vector(
        'parentFirstMomentXKgM',
        'parentFirstMomentYKgM',
        'parentFirstMomentZKgM'
      ),
      linearMomentumKgMPerS: vector(
        'parentMomentumXKgMPerS',
        'parentMomentumYKgMPerS',
        'parentMomentumZKgMPerS'
      ),
      orbitalAngularMomentumKgM2PerS: vector(
        'parentAngularMomentumXKgM2PerS',
        'parentAngularMomentumYKgM2PerS',
        'parentAngularMomentumZKgM2PerS'
      ),
      activeNodeCount: words[layout.parentActiveNodeCount],
      invalidNodeCount: words[layout.parentInvalidNodeCount]
    }),
    residual: Object.freeze({
      massKg: f32('massResidualKg'),
      firstMassMomentKgM: vector(
        'firstMomentResidualXKgM',
        'firstMomentResidualYKgM',
        'firstMomentResidualZKgM'
      ),
      linearMomentumKgMPerS: vector(
        'momentumResidualXKgMPerS',
        'momentumResidualYKgMPerS',
        'momentumResidualZKgMPerS'
      ),
      orbitalAngularMomentumKgM2PerS: vector(
        'angularMomentumResidualXKgM2PerS',
        'angularMomentumResidualYKgM2PerS',
        'angularMomentumResidualZKgM2PerS'
      )
    }),
    tolerance: Object.freeze({
      massKg: f32('massToleranceKg'),
      firstMassMomentKgM: f32('firstMomentToleranceKgM'),
      linearMomentumKgMPerS: f32('momentumToleranceKgMPerS'),
      orbitalAngularMomentumKgM2PerS: f32('angularMomentumToleranceKgM2PerS')
    }),
    completionOrdinal: words[layout.completionOrdinal]
  });
}
