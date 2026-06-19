# Material Polytope Registry And Property Fit Plan

Date: 2026-06-18 AKDT

## Purpose

Add a durable roadmap for discovering material/compound state-domain polytopes,
caching those domains next to the prebaked material property bank, sampling
first-principles closures inside accepted domains, and fitting cheap
multidimensional response functions for runtime property lookup.

This does not make fitted rows the source of truth. The authoritative path
remains the lower-level `ClosureRegistry` and first-principles material,
compound, EOS, phase, transport, optical, radiation, and reaction closures.
Polytopes, samples, and fitted functions are performance artifacts with
explicit validity envelopes, provenance, error bounds, and invalidation rules.

## Scope

- Discover polytopes for elements, compounds, mixtures, and crystalline
  structures.
- Store accepted polytope records in the prebaked material registry alongside
  precomputed material properties.
- Derive sampled data from first-principles closures over material/compound plus
  polytope domains.
- Fit response functions that let the hot path resolve property rows without
  rerunning expensive closures per particle or per UI/input change.
- Gate every cache hit by schema, generator fingerprint, source closure hashes,
  domain coverage, units, tolerances, and validation evidence.

Out of scope for this planning slice:

- No source edits, data import, schema implementation, or WebGPU renderer work.
- No hand-tuned constants promoted to first-principles evidence.
- No silent extrapolation outside a polytope or fitted response envelope.

## Polytope Model

Treat a polytope as a compact, named validity region over material state axes.
It can be a convex polytope, a set of piecewise convex cells, or a structured
grid/simplex decomposition when the state space is not globally convex.

Core axes:

- material identity: element symbol, atomic number, formula, formula
  atom-vector hash, isotope inventory, or mixture composition vector;
- phase and structure: gas/liquid/solid/plasma, phase fraction, crystal
  structure key, space group, lattice parameters, defect/dopant envelope, and
  polymorph validity range;
- thermodynamic state: temperature, pressure, density/specific volume,
  internal energy, entropy/free-energy coordinate, strain, and stress where
  mechanics rows need them;
- algorithm state: solver family, ABI row layout, material table row family,
  optical wavelength/frequency range, reaction environment, and target runtime
  tolerances.

Required polytope record fields:

- `schema`, `schemaVersion`, `polytopeId`, `materialKey`, and
  `polytopeFamily`;
- axis definitions with units, normalization, bounds, and domain topology;
- vertices, inequalities, grid cells, or simplex rows in a deterministic order;
- phase/structure metadata and fallback policy when an input omits structure;
- source closure refs, material property bank refs, and generator fingerprint;
- validation status, tolerances, uncertainty, and known blockers;
- invalidation keys for lower-level closure changes and property-bank changes.

Suggested schema families:

- `peercompute.ulg.material-polytope-registry.v0`
- `peercompute.ulg.material-polytope.element.v0`
- `peercompute.ulg.material-polytope.compound.v0`
- `peercompute.ulg.material-polytope.crystal-structure.v0`

## Discovery Tracks

### Elements

- Seed candidate domains from the element bank, existing element closures, phase
  transitions, EOS validity, optical closure wavelength ranges, and selected
  element rows already exercised in the SPH phase demo.
- Partition each element by phase, pressure/temperature range, and crystalline
  structure where relevant.
- Include high-value mechanics and rendering domains first: H, O, Na, Fe, Cs,
  H2/O2 gas support, and all currently selectable elements.
- Record when an element domain is only a warm input from
  `precomputed-json-bank` versus fully lower-level derived closure evidence.

### Compounds And Mixtures

- Discover candidate domains from formula parsing, molecular/compound closures,
  reaction product closures, gas-mixture closures, and common-compound bank
  entries when that bank exists.
- Key compound polytopes by canonical formula, formula atom-vector hash,
  charge/spin/geometry assumptions, phase, and molecular/condensed validity.
- Split domains when a property family has incompatible coverage, such as gas
  thermochemistry valid over a wider range than condensed density or optical
  PBR.
- Keep reaction-product and mixture polytopes linked to balanced reaction
  records, product ledgers, and gas-pressure/EOS consumers.

### Crystalline Structures

- Add element and compound crystalline-structure domains after the base element
  schema and provenance gates are stable.
- Store structure key, space group, lattice constants, packing fraction,
  coordination number, anisotropy flags, elastic tensor coverage, and
  temperature/pressure validity range.
- Derive particle spacing, rest density, anisotropic mechanics, and optical
  hints from structure-aware rows rather than renderer density or visual scale.
- Reject structure-polytopes that cannot prove consistent units, phase mapping,
  and source provenance.

## Registry And Cache Shape

Extend the prebaked material registry conceptually from "property rows only" to
"property rows plus accepted domain records":

- `materialPropertyBank` continues to provide warm property inputs.
- A future `materialPolytopeRegistry` provides accepted domains, structure
  domains, sampled datasets, and fit descriptors.
- `MaterialRegistry` remains the runtime authority boundary: samples must still
  resolve through `ClosureRegistry` or accepted cache artifacts that point back
  to source closures.

Cache record families:

- polytope definition records: compact domain geometry and metadata;
- sample records: deterministic sampled closure outputs over a polytope;
- response-fit records: fitted functions plus residuals and validation status;
- packed runtime rows: algorithm-shaped MLS-MPM, SPH, thermal, optical, EOS,
  reaction, and rendering rows derived from accepted response records.

Cache keys must include:

- material identity, formula/structure/phase, isotope or mixture vector;
- polytope id, axis normalization, units, and bounds hash;
- source closure ids, input hashes, method hashes, and lower-level generator
  fingerprints;
- material property bank schema/version/generator fingerprint when used as a
  warm input;
- fit algorithm, fit version, basis family, sample plan, residual tolerance, and
  output row schema;
- solver/ABI row layout version and runtime property family.

## First-Principles Sampling

Sampling should be a controlled derivation stage, not ad hoc probing.

Sampling workflow:

1. Resolve the material or compound closure graph for the polytope family.
2. Build a sample plan over the accepted axes, using sparse grids, adaptive
   simplex refinement, Latin-hypercube candidates, or Chebyshev nodes depending
   on dimensionality and smoothness.
3. Evaluate closure outputs at sample points with units, validity status,
   provenance refs, and uncertainty fields attached to each point.
4. Split the polytope if closure validity changes, phase boundaries cross the
   domain, residuals concentrate near a subregion, or property families disagree
   about validity.
5. Store sample artifacts only when all required property families have
   deterministic inputs and replayable provenance.

Sampled property families:

- EOS and phase equilibrium: pressure, density, free energy, phase fractions,
  latent heat segments, Gruneisen/Debye rows;
- mechanics and transport: bulk/shear moduli, Lame parameters, viscosity,
  thermal conductivity, sound speed, yield/plasticity hints, contact stiffness;
- optical/radiation: dielectric response, absorption/scattering, IOR, PBR
  reductions, emissive/blackbody coupling, wavelength/frequency bounds;
- chemistry/product domains: reaction energetics, product material closures,
  gas species EOS rows, atom/charge residual gates;
- algorithm rows: MLS-MPM mechanics table rows, SPH stability rows, surface
  extraction rows, timestep/CFL bounds, and compact diagnostic proof rows.

## Response Function Fitting

Fit functions are runtime approximators for accepted domains. They should answer
"what row should this particle/material/input state use now?" without rerunning
expensive first-principles derivation during the hot loop.

Candidate fit families:

- piecewise affine/simplex interpolation for strongly gated domains;
- Chebyshev or tensor-product polynomial fits for smooth low-dimensional axes;
- sparse-grid interpolation for moderate-dimensional thermodynamic domains;
- radial basis or Gaussian-process-style surrogates only when they carry
  bounded error, deterministic replay, and compact runtime form;
- monotonic or constrained fits for EOS, density, heat capacity, and stability
  quantities that must preserve physical sign/order constraints.

Fit artifacts must carry:

- `schema`, `schemaVersion`, `fitId`, `polytopeId`, material key, property
  family, and output row schema;
- input axis transforms, basis family, coefficients, piece partitions, and
  runtime evaluator version;
- train/validation sample refs and hashes;
- max/mean residuals, unit-scaled tolerances, monotonicity/sign checks,
  conservation checks, and boundary residuals;
- fallback policy: `use-fit`, `use-table-interpolation`, `rerun-closure`,
  `block-strict-mode`, or `reference-fallback-visible`;
- provenance refs to source closures, sample artifacts, and generator
  fingerprints.

Runtime rules:

- Strict mode can consume only accepted fit artifacts with source closure refs,
  in-domain inputs, matching schema/generator fingerprints, and passing
  residual gates.
- If the input leaves the fitted envelope, emit the existing refresh/invalidate
  behavior rather than extrapolating.
- If a fit is accepted for one property family but not another, runtime can use
  the accepted family while scheduling the missing family, but diagnostics must
  report the partial cache state.
- The hot path should prefer compact fit evaluation or table interpolation for
  per-particle changes, while closure rederivation happens asynchronously or in
  worker/PeerCompute lanes.

Suggested schema family:

- `peercompute.ulg.material-response-fit.v0`
- `peercompute.ulg.material-response-sample-set.v0`
- `peercompute.ulg.material-response-fit-validation.v0`

## Validation And Gates

Acceptance gates:

- schema validation for polytope, sample, fit, and packed runtime records;
- dimensional/unit consistency for every axis and output property;
- source closure refs resolve and match recorded input/method hashes;
- sample points are in the source closure validity domain;
- fit residuals pass property-family tolerances on train, validation, boundary,
  and withheld stress points;
- conservation and physics-sign checks pass where applicable: positive density,
  nonnegative heat capacity, bounded sound speed, stable EOS derivatives,
  balanced reaction mass/charge, and monotonic phase segments;
- strict mode rejects missing provenance, stale schemas, stale generator
  fingerprints, out-of-domain inputs, and hidden main-thread closure derivation.

Runtime gates:

- a material/input lookup can return `sampled`, `fit-hit`, `table-hit`,
  `cache-stale`, `out-of-domain`, `blocked-missing-closure`, or
  `reference-fallback-visible`;
- diagnostics report polytope id, fit id, cache family, source closure refs,
  residual grade, and invalidation reason;
- visual and physics probes should distinguish presentation fallback from
  closure authority failure.

## Provenance And Invalidation

Every record must be invalidated when any of these change:

- source closure input hash, method hash, schema, or lower-level generator;
- material property bank schema/version/generator fingerprint;
- polytope axes, bounds, units, structure metadata, or decomposition;
- sample plan, sample count, adaptive refinement thresholds, or property family;
- fit algorithm, basis family, evaluator version, coefficient packing, or
  residual tolerance;
- runtime ABI row schema, solver family, or output table layout;
- source license/provenance status changes or a strict-mode blocker is added.

Do not admit cache artifacts that cannot explain:

- what closure/source produced the data;
- what domain the data covers;
- what runtime property family may consume it;
- when it becomes stale;
- whether it is first-principles-derived, a warm precomputed input, a reduced
  estimate, or an explicit reference fallback.

## Todo Sequence

### Phase 0 - Inventory And Naming

- Audit existing `MaterialRegistry`, `materialPropertyBank`, resolver manifest,
  closure artifact, and material-property plan names.
- Pick schema names for polytope, sample-set, response-fit, and fit-validation
  artifacts.
- Define cache status strings and invalidation reasons before implementation.

### Phase 1 - Polytope Schema And Seed Domains

- Draft JSON schemas for element, compound, and crystal-structure polytope
  records.
- Create seed domain records for the currently exercised elements and H2O/H2/O2
  compound/gas paths.
- Validate that each seed domain carries units, provenance refs, source closure
  refs, and no source-of-truth overclaim.

### Phase 2 - Registry Integration

- Add loader/normalizer behavior for polytope records parallel to the material
  property bank loader.
- Keep property rows and polytope rows joined by material key, phase/structure
  key, schema version, and generator fingerprint.
- Add stale-record rejection for mismatched closure refs, changed property bank
  inputs, and changed polytope geometry.

### Phase 3 - Sampling Pipeline

- Build deterministic sample plans for element, compound, and structure
  polytopes.
- Evaluate first-principles closures at sample points with replayable
  provenance.
- Split domains or mark blockers when closure validity, phase boundaries, or
  property-family coverage changes inside a candidate polytope.

### Phase 4 - Response Fit Pipeline

- Fit EOS, mechanics, thermal, and optical rows first because they are reused by
  MLS-MPM, SPH, surface extraction, and rendering.
- Add compound/reaction-product fit records after formula and product closures
  expose stable provenance and balanced residual gates.
- Emit compact evaluator descriptors for worker/WebGPU paths only after CPU
  validation and deterministic replay pass.

### Phase 5 - Runtime Consumption

- Let `MaterialRegistry` and material resolver paths choose accepted fit/table
  artifacts for in-domain lookups.
- Keep closure rederivation out of the hot loop for cache hits, but schedule
  refresh work when inputs leave a domain or a cache record is stale.
- Surface fit/cache status in diagnostics so users can distinguish
  first-principles-derived fit hits from reference fallbacks.

### Phase 6 - Validation Harness

- Add unit tests for schema validation, stale-record rejection, in-domain lookup,
  out-of-domain invalidation, and strict-mode fallback behavior.
- Add property-family tests for EOS/mechanics/thermal/optical residual bounds.
- Add browser/e2e evidence after runtime wiring: dense visual probes should show
  valid material PBR, mechanics rows, phase rows, and cache status without
  hidden main-thread closure work.

## Completion Gates

- Element, compound, and crystal-structure polytope schemas are defined and
  validated.
- The prebaked material registry can associate precomputed property rows with
  accepted polytope/domain records without treating either as unquestioned
  truth.
- Sample artifacts replay first-principles closure evaluations with units,
  source refs, validity status, and deterministic hashes.
- Response-fit artifacts pass residual, conservation, sign, monotonicity, and
  boundary gates for their property family.
- Runtime material/property lookups can use fit/table hits for in-domain states
  and emit refresh/invalidation for out-of-domain states.
- Strict mode rejects stale, unprovenanced, out-of-domain, or overclaimed
  artifacts.

## Dependencies

- `plan/todo/material-property-json-bank-plan.md`
- `plan/todo/algorithm-derived-material-properties-plan.md`
- `plan/todo/webgpu-material-property-resolvers-plan.md`
- `plan/todo/reaction-stoichiometry-energetics-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
