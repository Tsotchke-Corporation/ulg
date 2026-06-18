# Precomputed Material Property JSON Bank Plan

Date: 2026-06-18 AKDT

Status update, 2026-06-18 AKDT: Phase 1 has a first checked-in seed, not a
complete bank. `data/material-properties/elements.json` now contains
non-authoritative warm-input records for the currently exercised elements
`H`, `O`, `Na`, `Fe`, and `Cs`; JSON schemas and
`scripts/material-properties/validate-material-property-bank.mjs` validate
those rows; `src/runtime/material/materialPropertyBank.js` normalizes lookup
and emits provenance-preserving warm inputs. Next: wire the loader through the
material resolver/cache path, expand to all selectable elements, add stale
schema/provenance rejection tests, then add crystalline structures before
starting the top-1000 compound import.

## Purpose

Add a versioned repo-local JSON material property bank that gives ULG a fast,
deterministic seed for material setup, cold-start cache construction, renderer
PBR defaults, and GPU table packing.

This bank is not the source of truth for first-principles claims. Runtime
resolvers must treat it as a precomputed closure artifact with schema version,
units, reference state, validity domain, provenance, generator fingerprint, and
stale-record rejection. Strict derivation mode must still be able to ignore or
audit these records and fall back to the lower-level resolver graph.

## Scope Ladder

### Phase 1 - Elements First

Create `data/material-properties/elements.json` with one canonical record per
element.

Required fields:

- schema id and schema version;
- symbol, name, atomic number, atomic mass, isotope notes when relevant;
- reference temperature and pressure for each tabulated value;
- phase-specific density, heat capacity, thermal conductivity, melting point,
  boiling point, latent heats, and EOS seeds;
- elastic/mechanics seeds: bulk modulus, shear modulus, Poisson ratio, sound
  speed, MLS-MPM/SPH material class hints, viscosity/surface tension where
  physically meaningful;
- optical/PBR seeds: base color, metalness, roughness, IOR, absorption,
  emissive/blackbody coupling hints, and spectral references where available;
- provenance entries per property family, including source, method, units,
  uncertainty or quality grade, and generator/input hash;
- validity domain and fallback reason for values that are estimates rather than
  accepted reference data.

### Phase 2 - Elements Plus Crystalline Structures

Create `data/material-properties/element-crystal-structures.json` keyed by
element, phase, crystal structure, and reference state.

Required fields:

- structure key, space group, Strukturbericht/common name where applicable;
- lattice constants, unit-cell density, packing fraction, coordination number,
  and anisotropy metadata;
- phase or polymorph validity ranges in temperature and pressure;
- anisotropic elastic, thermal, and optical rows where available;
- mapping back to the base element record and resolver/cache key ingredients;
- fallback policy when a scenario does not specify a crystalline structure.

This phase should feed particle initialization. Initial spacing or particle size
should derive from material, temperature, pressure, phase/rest-density closure,
target neighbor count, crystal/packing hints, and support-radius constraints.

### Phase 3 - Common Compound Bank

Create `data/material-properties/common-compounds.json` for the top 1000 common
compounds after the element and element-crystal schemas are stable.

Required fields:

- canonical formula, aliases, registry identifiers where licenses permit, and
  formula atom-vector hash;
- ranked inclusion reason, such as common simulation material, atmospheric or
  aqueous chemistry relevance, industrial/common-use occurrence, biology,
  geology, or ULG demo importance;
- phase-specific density, thermal, EOS, transport, mechanics, optical/PBR, and
  radiation fields where applicable;
- reaction/product closure links for compounds that commonly appear as products
  in ULG scenarios;
- provenance and generator fingerprints compatible with the resolver manifest.

Do not start the top-1000 compound import until the schema validator, provenance
model, and element records have passed acceptance gates.

## Runtime Integration

- Add a schema validator and fixture tests before broad data import.
- Load JSON records through the material resolver/cache layer, not through
  renderer-only code.
- Mark every loaded row with `precomputed-json-bank` provenance and the bank
  schema version.
- Reject records with missing units, missing reference state, unknown property
  families, stale schema versions, or source/license blockers.
- Let the WebGPU material resolver migration consume accepted rows as warm
  inputs for CPU/WASM/WebGPU derivation and GPU table packing.
- Keep generated large data separated from hand-authored schemas and import
  scripts so diffs stay reviewable.

## Proposed File Layout

- `data/material-properties/schemas/material-property-bank.schema.json`
- `data/material-properties/schemas/element.schema.json`
- `data/material-properties/schemas/element-crystal-structure.schema.json`
- `data/material-properties/schemas/common-compound.schema.json`
- `data/material-properties/elements.json`
- `data/material-properties/element-crystal-structures.json`
- `data/material-properties/common-compounds.json`
- `scripts/material-properties/validate-material-property-bank.mjs`
- `scripts/material-properties/generate-material-property-bank.mjs`

## Completion Gates

- JSON schemas exist and validate all checked-in records.
- Element bank covers all currently selectable elements in the SPH phase demo,
  then all periodic-table elements.
- Loader integrates through `MaterialRegistry` or the material resolver
  manifest path with provenance preserved.
- Tests prove unit consistency, stale-schema rejection, fallback to derived
  closures, strict-mode audit/ignore behavior, and PBR restoration for mobile
  and desktop render paths.
- Dense visual probes show material-specific PBR, particle initialization, and
  phase/mechanics setup using the same accepted material property rows.

## Risks

- Treating precomputed values as unquestioned truth would undermine the
  first-principles contract.
- Mixing phase, temperature, pressure, and crystal reference states can produce
  worse simulation behavior than a slower derived closure.
- Imported source data may have licensing or provenance constraints that make it
  unsuitable for checked-in JSON.
- A large top-1000 compound file can slow cold parse if it is not chunked,
  indexed, or loaded through worker/PeerCompute cache paths.
