# Direction note 4: the Eshkol higher-order law and material closure plan

Source: `plan/todo/eshkol-higher-order-law-closure-plan.md` (384 lines,
2026-09-22, "planned; no runtime implementation claimed by this document").
Read by Hermes in full, 2026-11-17. The SS README links it as the law-derivation
follow-on, and the owner's 2026-11-16 hope ("Eshkol approximated functions for
complex underlying behavior") points here. It is the design behind G6, A4 and
A6, and the law half of A3.

## Purpose (`:9-33`)

"Use Eshkol to transform physical law programs into reusable, differentiable
material responses with executable validity envelopes. SS consumes those
responses through its existing spatial authority and law-admission path;
PeerCompute owns scheduling, resource leases, and accepted state mutation."

"The higher-order operation is a program accepting a law or law subgraph and
producing another law artifact: specialize, compose, differentiate,
coarse-grain, approximate, validate, and compile. Tables, polynomials, reduced
models, and neural networks are alternative implementations of an explicit
response contract."

Sequencing: it "supports Goals 4-6"; "The first integrated deliverable belongs
to Goal 6"; the order is preserved: "finish the earlier visible physics and
coherent-solid requirements, generalize node activation in Goal 4, and
establish the needed bounded reservations in Goal 5 before integrated Goal 6
adoption."

"Assume forthcoming Eshkol WebGPU support as the backend direction. ... Backend
availability alone does not establish general GPU AD or arbitrary Scheme
execution in shaders."

## Gaps it records in existing code (`:35-57`)

- The SS Law Adapter Contract is declared and not enforced
  (`ss-law-architecture-assessment.md`).
- `src/runtime/closureLawGraph.js` "currently compiles table-interpolation
  closures. Its independently interpolated value and derivative channels need
  not describe one differentiated interpolant."
- `src/runtime/closureRegimeStore.js` has regime keys and invalidation
  metadata; "storing a `homogeneityTest` does not execute it"; its invalidation
  key lacks an explicit domain hash.
- `schroederDynamicLawRoutingContract.js` "provides the reaction activation
  seed, with shadow routing as the default. General per-law envelope
  activation and the online factory remain work to do." (G4's starting point.)
- "New closures must consume that [canonical SS] generation rather than
  construct private grids."

## A law as an object (`:59-90`)

A numerical body plus a machine-readable contract: input/output schemas, units
and reference configurations; "Read, write, and accumulate state families;
ownership and generation bindings"; spatial support, boundary conditions,
chart/scale range, ensemble and aggregation assumptions; conserved quantities,
symmetries, stability, residuals, derivative requirements, error targets,
fallback policy.

Six transformations ("Proposed ..., not existing public Eshkol/ULG APIs"):
specialize, compose, differentiate, coarse-grain, approximate, compile.
"Generate layout accessors and bindings from declarations; do not assume
language types alone prove units, ownership, conservation, or physical
correctness." "This changes execution cost without removing laws or upgrading
their scientific evidence."

## Response plus envelope (`:92-123`)

"A response model evaluates behavior. Its envelope declares when that behavior
is admitted. Store both". Field groups: identity, coordinates, physical scope,
closure state, evaluator, evidence, lifecycle.

- Separate four errors: source-method uncertainty, surrogate error,
  coarse-graining/integration error, GPU numerical error.
- "missing phase, composition, history, or homogeneity evidence cannot be
  treated as a wildcard."
- "Reuse artifacts by physical regime, not scenario name."

## Shared potentials (`:125-168`)

Fit a specific Helmholtz free energy `a(T, v, c)` and generate pressure,
entropy, energy and heat capacity from the same representation. For solids,
`Psi(F, T, c, z)`; "EOS target density must not silently become geometry
authority". Memory-dependent behaviour uses `z_next = g(z, inputs, dt)`;
"SS owns `z` as a declared mutable physical state family."

## SS aggregation and scale validity (`:196-210`): the rule A3 has to obey

"An accepted mean temperature/density is insufficient: generally,
`mean(f(x)) != f(mean(x))`." Envelope watches may need extrema, variance, phase
fractions, gradients, representative volume and relaxation times. "Missing
required summaries cause activation or refinement, not unconditional
acceptance." For coarse-grained models, "compare resolved evolution followed by
restriction with coarse evolution of the restricted state". "Preserve SS
conservative restriction/prolongation and exact-near requirements; no
universal aggregate approximation is presumed."

## Runtime lifecycle (`:212-268`)

SS node asks for a response → accepted envelope? → yes: resident GPU closure
evaluation; no: PeerCompute schedules a scoped derivation → detailed law or
MoonLab samples → Eshkol fit for a precompiled evaluator → validate candidate
and envelope → boundary admission of an immutable generation → evaluation →
proposed deltas and conservation evidence → existing SS admission and commit.

- No NN-owned spatial grid; no hot-state mirror; "no full-particle
  readback/reupload loop".
- "Training never changes coefficients or weights read by an active schedule."
- Adoption only "through the existing fenced admission boundary".
- "do not introduce mid-run variant generation or shader compilation on an
  envelope miss."
- Policies `strict`, `async`, `frozen`; "a fit does not become newly emergent
  or silently upgrade WARN to PASS."
- "A CPU worker may produce offline/scoped samples without becoming a CPU
  mirror or acceptance oracle for the GPU simulation." (The owner tightened
  this on 2026-11-16: the A3 sampler moved to the GPU.)

## Stages (`:270-339`; "All implementation checkboxes below are open")

| Stage | Content |
|---|---|
| S0 | Contract and backend readiness: pick one smooth thermal/EOS closure family; pin the Eshkol backend and ULG ABI; define the response/envelope/evidence schema; predeclare tolerances and budgets |
| S1 | One generated response and resident evaluator connected "to one real SS consumer" |
| S2 | One local online fit/cache cycle: "the Goal 6 deliverable". Uses the Goal 4 activation and Goal 5 reservation interfaces; a GPU-detected envelope exit triggers one bounded derive/fit job; replacement admitted at a recorded boundary; a later cache hit in a second SS region; conservation across adoption; measured latency and cost |
| S3 | Neural and additional response backends, kept only where they beat the cheaper representation |
| S4 | Composed and multiscale law transformations; "Extend remote derivation only after the local lifecycle and provenance reuse are accepted" |

"S0-S2 constitute the bounded first deliverable. A NN, remote provider, general
graph compiler, graph-wide AD, or new SS level is not required to close it."

## A warning that applies to today's open items (`:364-366`)

"Do not use a trained correction to conceal invalid phase-volume geometry,
double-counted mass/energy, rejected mechanics generations, or other unresolved
Goal 2/3 solver defects. Repair the underlying constraints and ledgers first."

## Against what Claude's notes say was built (Hermes; to verify in code)

- G6 is recorded as delivered by `localClosureFitCache.js` with 7 host tests.
  S2 above asks for a GPU-detected envelope exit, a Goal 5 reservation, a
  boundary admission, a second-region cache hit and conservation evidence in a
  mounted run. Whether the delivered slice does those in the live app, or as
  host logic only, needs checking.
- A4's live consumer is the Tait stiffness in the implicit pressure solve
  (water-realtime). That is S1 ("one real SS consumer") for one function.
- A6 runs Eshkol and MoonLab in browser workers. The plan put remote
  derivation after S2's acceptance; the owner reordered it (2026-11-14,
  "eshkol and moonlab should be running in the client under wasm").
