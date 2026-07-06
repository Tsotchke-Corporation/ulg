# Cold-Start Cache Performance Plan

Date: 2026-06-11 AKDT

## Current Slice Status - 2026-06-11 17:02 AKDT

Implemented:

- Static thermal material tables, thermal closure graph banks, thermal
  phase-response tables, optical/PBR rows, reaction tables, and GPU warmup
  signatures now have a shared runtime cache coordinator in
  `src/runtime/sph/sphColdStartCache.js`.
- `ulg-runtime` advertises a new `sph.static-table-cache` task and computes the
  table cache records inside the supervised worker. The main thread only reads
  the existing localStorage snapshot string, persists the returned snapshot
  string, and exposes compact status.
- Static table records moved into a separate
  `peercompute.ulg.sph-static-table-cache.v1` localStorage family. The reaction
  cold-start cache no longer carries the large table payloads, so reaction cache
  lookup does not parse them on every rebuild.
- The worker result keeps the large snapshot out of the cached artifact payload,
  avoiding a main-thread `ArtifactCache.put()` hash of the full table snapshot.
- Unit tests cover typed-array round trip/rehydration, unchanged warm records,
  and generator mismatch rejection. Browser e2e waits for the worker-backed
  static table cache update and validates counts/gpu-warmup rows.

Still open:

- Warm scene/WebGPU upload reuse still needs to consume the rehydrated table
  records directly instead of rebuilding scene tables and then writing cache
  records.
- Cache parse/serialization for material closures and reaction records should
  follow the same split-storage/worker-owned pattern.
- Measured cold/warm/clear/repopulate timing deltas still need automated browser
  probes.

## Current Slice Status - 2026-06-11 17:19 AKDT

Implemented:

- Rehydrated static table records can now be converted into scene-consumable
  thermal material tables, thermal closure graph banks/sets, thermal
  phase-response tables, optical/PBR tables, and reaction tables.
- Packed thermal graph-bank rows are restored into per-graph CPU closure objects
  with local row offsets, preserving thermal phase-response CPU fallback
  behavior.
- `sphPhaseScene.setParticles()` accepts a guarded static table cache bundle and
  uses cached table families on warm syncs. It records
  `staticTableCacheStatus` and `staticTableCacheFamilies` in the scene sync
  timing row.
- Browser e2e now writes the static cache, triggers a reset/rebuild, and verifies
  `static-table-cache-bundle-hit` during `setParticles()`.

Still open:

- The first load after an empty cache still builds deterministic scene tables
  once before writing them.
- Static bundle rehydration is currently synchronous on the main thread; the
  next performance slice should preload/rehydrate via the worker before
  `setParticles()` needs it.
- Material-closure and reaction-record cache parsing still need the same
  split-storage/worker-owned treatment.

## Purpose

Fix the SPH demo behavior where performance stays extremely slow for a long
cold-start/rebuild window, then speeds up after derived closures and GPU state
are warm. The current localStorage material cache helps, but it does not cover
the dominant reaction/product/runtime work.

This plan is the remediation track for the observed root cause:

> `discoverReactions()` disables its in-memory cache when `materialProperties`
> is provided, which is the normal demo path. We also do not yet persist full
> reaction closures, product reuse decisions, thermal/optical tables, or GPU
> warmup artifacts.

Most of this work should be cacheable. The cache must remain a derived artifact
library with strict provenance/invalidation, not a place to put hand-tuned
material constants.

## Evidence From Investigation

Node timing probes:

- `createFirstPrinciplesMaterialClosures()` for the default base materials took
  about 4.1 seconds.
- `discoverReactions('Na', 'h2o', { materialProperties })` took about 7.2
  seconds, then about 5.5 seconds on immediate repeat.
- `discoverReactions('fe', 'h2o', { materialProperties })` took about 2.2
  seconds, then about 1.7 seconds on immediate repeat.
- `createSphPhaseDemo({ dropMaterial: 'Na', baseMaterial: 'h2o' })` took about
  10.8 seconds cold.
- Supplying already-derived material/product closures reduced Na/H2O startup to
  about 5.5 seconds, proving material closure cache helps but does not remove
  reaction discovery/energetics cost.

Browser HTTPS probe against `https://127.0.0.1:5173/`:

- Cold Na/H2O tiny-particle load with empty localStorage took about 23.9 seconds.
- The run wrote seven v2 material closure records:
  `h2o`, `fe`, `air`, `h2`, `o2`, `Na`, and `naoh`.
- Warm reload hit all seven records and reported `consumed=true`, but still took
  about 19.3 seconds.

## Root Causes

### 1. Material Cache Does Not Cover Reaction Closures

The browser-local cache stores material properties. It does not store a
reaction-closure artifact containing:

- balanced reactants/products,
- energy/free-energy results,
- product closure hashes,
- activation/rate blockers,
- gas byproduct routing,
- validity domain,
- provenance/generator hashes.

So product and reaction derivation can rerun after material cache hits.

### 2. Normal Reaction Discovery Bypasses Its In-Memory Cache

`discoverReactions()` disables its `discoveryCache` when
`options.materialProperties` is present. The normal SPH demo always passes
`materialProperties`, so repeated demo rebuilds still recompute expensive
material-property-backed reaction discovery.

This is the first bug to fix. `materialProperties` should not disable caching;
it should become part of the cache key through stable property/provenance hashes.

### 3. Product Closure Cache Is Written But Not Used For Discovery

The material cache can contain product materials such as `naoh`, but
`optionsWithCachedClosures()` only looks up the selected materials plus runtime
defaults (`h2o`, `fe`, `air`, `h2`, `o2`). Reaction discovery still derives or
checks product closures separately.

### 4. Worker And GPU Warmup Are Separate From localStorage

Even after material cache hits, the runtime can still pay for:

- worker module startup/structured clone of large closure objects,
- thermal material table construction,
- thermal closure graph/phase-response packing,
- optical table/lookup construction,
- WebGPU device/pipeline/buffer warmup,
- resident render-field readback/warmup.

None of these are persisted in the current localStorage material cache.

### 5. No User-Facing Cache Reset

The demo can accumulate material closure records in localStorage, but there is
no obvious UI control to clear the local derived-closure library when a developer
wants a true cold run, suspects stale cache diagnostics, or wants to verify
generator invalidation behavior manually.

## Remediation Plan

Current slice status, 2026-06-11 16:34 AKDT:

- Partial material-closure cache hits are now consumed instead of discarded when
  one runtime default is missing.
- `buildSphPhaseDemoState()` fills missing required runtime materials
  individually from the generic derivation path instead of forcing a full
  default-closure rebuild.
- Static thermal material tables, thermal closure graph banks, thermal phase
  response tables, optical/PBR tables, reaction tables, and WebGPU warmup
  signatures are now persisted as deterministic cold-start cache records.
- `ulg-runtime` is pre-spawned during demo runtime creation.
- Worker rebuild, resident MLS-MPM, and scene particle-sync stages now expose
  timing diagnostics in the overlay.
- Remaining: warm reload still needs to rehydrate the persisted static table
  row data into scene/WebGPU upload paths; cache parsing/serialization should
  move off the UI thread; measured cold/warm/clear deltas are still due.

### 0. Add A Cold-Start Cache Coordinator

- Add a small coordinator module that owns cache namespaces, schema versions,
  generator fingerprints, status summaries, and clear operations.
- Treat existing material closure records as one cache family, then add reaction,
  product decision, thermal table, optical table, and warmup cache families
  beside it.
- Return one combined status object to the SPH overlay:
  - material hits/misses/stale;
  - reaction hits/misses/stale;
  - product reuse hits/misses/stale;
  - table hits/misses/stale;
  - GPU warmup reused/rebuilt;
  - bytes/records cleared by the last clear action.
- Keep cache reads/writes worker-safe so the UI thread does not parse large
  blobs during a rebuild.

### 1. Add Reaction Closure Cache

- Create `peercompute.ulg.local-derived-reaction-cache.v0`.
- Key by reactant material/formula keys, material property hashes, balanced
  equation, solver method chain, product closure hashes, validity domain, and
  generator fingerprint.
- Cache full reaction closure records, not only product material properties.
- Reject stale reaction closures on any input/method/product/generator mismatch.
- Persist the strict/exploratory energetics status with the closure so strict
  mode never reuses a provisional reaction as executable evidence.
- Store the balanced equation, reactant/product terms, gas routing, and product
  closure refs together so the runtime can skip rediscovery on warm reload.

### 2. Enable Material-Property-Backed Reaction Memoization

- Replace the current `cacheKey = null` behavior when `materialProperties` is
  present.
- Use a provenance hash of the provided material properties instead.
- Include only stable fields in the hash:
  - material key/formula;
  - property schema/method version;
  - input hash;
  - validity-domain hash;
  - generator fingerprint;
  - lower-level closure refs/hashes where available.
- Do not hash transient UI objects, object identity, timing data, or mutable
  diagnostic fields.
- Keep the cache invalid when reduced fixture properties or reduced product
  estimates are explicitly allowed.
- Add a cache-key explanation field for diagnostics so the overlay can say why a
  material-property-backed discovery hit or missed.

### 3. Reuse Product Closures During Discovery

- Include known cached product closures in reaction discovery options.
- Before deriving a product closure, check whether a product closure with
  matching formula, atom counts, derivation method, and validity domain already
exists.
- Track whether the product closure was reused, newly derived, or rejected
  stale.
- Persist product reuse decisions separately from full reaction closures so a
  product such as `NaOH` or `Fe(OH)2` can accelerate future candidate
  evaluation even when the full reaction closure is stale.
- Key product decisions by product formula/atom counts, phase model, closure
  method, source reactant context when needed, and generator fingerprint.

### 4. Persist Thermal, Optical, And Static Table Artifacts

Persist compact artifacts that are expensive to reconstruct but deterministic
from already-derived closures:

- SPH thermal material tables;
- thermal closure graph banks;
- thermal phase-response tables;
- optical/PBR material-phase-state rows;
- optical spectral sample rows;
- stable material id maps;
- reaction product phase mechanics rows;
- WebGPU-ready static table typed arrays when schema, ABI, and generator hashes
  match.

Rules:

- Persist serialized row data and metadata, not live WebGPU buffer objects.
- Re-upload persisted rows to WebGPU during warm start.
- Include ABI schema, row layout hash, material property hash set, and generator
  fingerprint in every table cache key.
- Reject cached tables if any lower-level material, reaction, phase, optical, or
  ABI hash changed.

### 5. Add GPU Warmup Artifact Reuse

Browser WebGPU device objects and compiled driver internals are not portable
across page reloads, so we cannot persist live pipelines in localStorage. We can
still cache enough to make warm start faster:

- persist pipeline descriptor signatures;
- persist shader/source hashes and ABI layout hashes;
- persist static upload rows;
- keep in-session pipeline/bind-group caches keyed by those signatures;
- after a warm cache hit, schedule background re-upload and pipeline creation
  before the first heavy simulation step;
- expose `gpu warmup: queued/running/reused/rebuilt` in the overlay.

### 6. Add Timing Diagnostics

Add timing spans for:

- cache lookup,
- material closure derivation,
- reaction candidate enumeration,
- reaction energetics,
- product closure derivation,
- optical table construction,
- thermal graph/phase-response packing,
- worker structured clone/round trip,
- WebGPU upload/pipeline warmup,
- resident render readback.

Expose those spans in `overlay.__sphPerformanceTrace` and the status panel.
Use the spans to prove which cache families still dominate cold and warm runs.

### 7. Add A Clear Cache Button

Add a retro terminal-style `clear cache` button to the SPH demo controls.

Required behavior:

- Clear all ULG SPH local derived cache families:
  - material closures;
  - reaction closures;
  - product reuse decisions;
  - thermal/phase tables;
  - optical/PBR tables;
  - static table rows;
  - warmup metadata.
- Clear in-memory caches and signatures for the current page session, including
  reaction discovery memoization and scene-level thermal/optical upload
  signatures.
- Destroy/recreate WebGPU static upload buffers where the scene owns them, or
  mark them stale so the next rebuild uploads from freshly derived rows.
- Show a status row such as
  `cache clear : cleared material=7 reaction=2 table=4 gpu=stale`.
- Trigger a controlled rebuild from source derivation after clearing.
- Do not clear unrelated browser storage, non-ULG keys, or user UI preferences
  unless the user explicitly chooses a broader reset later.

### 8. Persist More Derived Runtime Artifacts In PeerCompute State

After localStorage caching is stable, mirror the same cache families into the
PeerCompute state representation so other peers can benefit from existing
derived closures.

These remain cache accelerators only. The lower-level derivation chain and
provenance hashes remain authoritative.

## Acceptance Tests

- A warm Na/H2O browser reload should report material cache hits and reaction
  cache hits.
- Warm reload startup should avoid `discoverReactions()` heavy solver paths
  unless the material/property/generator hash changed.
- `discoverReactions()` should memoize material-property-backed reactions by
  provenance hash.
- Cached product closures such as `naoh` should be reused when valid and
  rejected when stale.
- Status rows should distinguish material cache, reaction cache, product cache,
  table cache, and GPU warmup.
- A stale generator fingerprint should force rederivation and report the stale
  reason.
- Thermal graph/phase-response, optical/PBR, and static table cache hits should
  skip table reconstruction while still re-uploading valid rows to WebGPU.
- A `clear cache` UI action should delete only ULG SPH cache families, reset
  in-memory signatures, report cleared counts, and force the next rebuild to
  behave like a true cold start.
- A follow-up warm run after the clear-triggered cold rebuild should repopulate
  all cache families and show hits on reload.

## First Slice

Status on 2026-06-11:

- Done: timing trace scaffolding for cache lookup, worker rebuilds, cache clear,
  and cached interactive driver reconstruction.
- Done: cold-start cache namespace for persisted reaction records, product reuse
  records, placeholder static-table metadata, and placeholder GPU warmup
  metadata.
- Done: `discoverReactions()` now hashes material-property provenance into a
  stable cache key instead of disabling its cache when `materialProperties` is
  provided.
- Done: valid persisted reaction records can be supplied back into discovery and
  return `persistent-cache-hit`; in-memory hits return `memory-cache-hit`.
- Done: product closures are reused during discovery when matching persisted or
  supplied product closures exist.
- Done: the SPH overlay exposes `cold cache`, `cache clear`, and `perf trace`
  status rows plus a retro `Clear Cache` button.
- Done: worker-first startup submits initial material/reaction/view-state
  rebuilds to `ulg-runtime` when available, keeping the UI responsive while the
  worker derives first-principles closures.
- Done: if render FPS drops below 30 while CPU closure work is active, the
  warning banner says `deriving material or reaction properties`.
- Removed: the ultra-low-FPS cache-miss auto-pause path. Long 0.1 FPS
  cold-start periods must be fixed by reducing/offloading work, not by pausing
  playback.
- Done: cached interactive Step/Play can reconstruct the main-thread driver
  after the worker has populated cache records, preserving the existing manual
  reaction-step path without forcing cold derivation on initial load.
- Remaining: persist/reuse thermal graph, phase-response, optical/PBR, static
  material id/table rows, and GPU warmup artifacts.
- Remaining: move large cache serialization/parsing fully off the UI thread or
  into PeerCompute state, then add warm-reload and stale-record browser probes.
- Remaining: record cold, warm, clear, cold-after-clear, and
  warm-after-repopulate startup deltas in this plan.

## Diagnosis - 2026-07-06, Sn/Cu "hang" Is Cold Atomic DFT Cost, Not A Hang

The earlier Sn->Cu spot-check freeze (fps 0.0) reproduces in Node as plain
cold-start closure derivation, not a hang:

- `createSphPhaseDemo({ Sn, Cu })` cold: 15.8 s total; state build 13.9 s,
  reaction discovery 1.9 s.
- CPU profile: 79.7% of the state build is `nthEigenpair` (Sturm bisection)
  in `radialKohnSham.js`, i.e. the all-electron Kohn-Sham solves.
- Per-atom timings: Cu 1.7 s (LDA) / 3.7 s (scalar-relativistic KH);
  Sn 3.0 s / 7.3 s KH / 5.7 s LSDA. Heavy elements pay for grid resolution
  (1200 + 12Z points) and per-orbital energy-dependent KH iteration.
- The solver already has the intended accelerations: per-l warm-started
  orbital energies across SCF iterations and bracket-hinted bisection.

Assessment: in a headless browser worker this lands at roughly 30-60 s cold
for a heavy element pair, which reads as a hang in short probes. Warm runs
hit the localStorage closure cache. Do NOT micro-optimize the DFT solver as
a cache workaround - it is anchored, physics-critical code. The remaining
cache-plan items (worker-side rehydration, measured cold/warm deltas) stay
the remediation track; spot-check harnesses must wait out the first cold
derivation or pre-warm the cache before timing.
