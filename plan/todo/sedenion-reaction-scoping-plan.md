# Sedenion Reaction Scoping Plan

Date: 2026-06-12 AKDT

## Purpose

Use the sedenion periodic-table reference as a symbolic reaction-channel
prefilter for ULG chemistry. This should help decide which reaction candidates
are worth deriving from first principles, without pretending the sedenion layer
is itself validated thermochemistry.

Reference:

- `/home/cos/projects/peercompute/plan/refs/sedenion periodic table.pdf`

## Current Status

ULG does not currently use the sedenion periodic-table reference in runtime
reaction discovery. The reaction plan mentioned it as a discovery prior, and
PeerCompute Schrodinger notes describe the sedenion/Fano reactor layer as a
future symbolic prefilter, but there is no active ULG `sedenionScope` field,
candidate score, or cache artifact yet.

## Allowed Role

Use sedenion/Fano structure as:

- a reactive/inert symbolic prefilter;
- a bond-event taxonomy;
- a candidate-priority signal for expensive lower-level derivation;
- a way to tag candidate families with symbolic channel evidence;
- a cacheable, provenance-bearing discovery artifact.

The reference can help avoid trying every chemically implausible pair first. It
can also help group candidate channels before Eshkol, MoonLab, or electronic
solvers spend time on them.

## Not Allowed

Do not use the sedenion layer as:

- final product stoichiometry;
- final energetics;
- a reaction-rate model;
- proof of physical bond formation;
- scientific validation;
- a substitute for atom, charge, mass, enthalpy, free-energy, and residual
  ledgers.

Every candidate admitted by the sedenion prefilter still needs ordinary
first-principles closure derivation, balancing, validation flags, and strict
overclaim guards.

## Planned Candidate Contract

Add a field such as `candidate.sedenionScope`:

```js
{
  schema: 'peercompute.ulg.sedenion-reaction-scope.v0',
  sourceRef: 'peercompute/plan/refs/sedenion periodic table.pdf',
  status: 'symbolic-prefilter-ready',
  role: 'reaction-channel-prior-not-validation',
  reactiveClass: 'reactive' | 'inert' | 'unknown',
  bondTypePrior: 'ionic' | 'covalent' | 'metallic-or-anti' | 'unknown',
  normDefectPrior: -4 | 0 | 4 | null,
  fanoGroup: string | null,
  symbolicConfidence: number,
  blockers: [],
  scientificValidation: false,
  chemistryValidation: false,
  fullPhysicsValidation: false
}
```

## Required Work

1. Extract a small versioned symbolic table artifact from the reference PDF or a
   checked-in derivative source:
   - reactive/inert channel tags;
   - Fano group/channel tags;
   - bond-type prior tags;
   - source hash and extraction method hash.
2. Add a resolver that maps parsed formulas/elements to symbolic sedenion
   channel inputs.
3. Add `sedenionScope` to `discoverReactionCandidates()` output.
4. Keep the candidate in `blocked` or `needs-derivation` status when the
   sedenion prefilter is favorable but lower-level closures are absent.
5. Add cache/provenance keys so a changed symbolic table invalidates stale
   reaction discovery records.
6. Add tests proving:
   - favorable symbolic scope only prioritizes a candidate;
   - unfavorable or unknown scope does not delete manually balanced candidates;
   - strict mode still rejects provisional energetics;
   - no sedenion-scoped candidate reports scientific validation as true.

## Acceptance Gates

- Reaction candidates expose `sedenionScope` as a symbolic prior.
- Candidate ordering can prefer scoped reactive channels without suppressing
  balanced chemistry that lacks a symbolic mapping.
- The UI/debug overlay can explain when sedenion scope helped choose a candidate.
- No strict runtime path treats sedenion evidence as validated energetics,
  stoichiometry, kinetics, or product topology.
