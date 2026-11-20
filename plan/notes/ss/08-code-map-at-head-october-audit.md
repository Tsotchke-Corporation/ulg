# SS note 8: the SS code as the October audit found it (HEAD `f6f7a5e`)

Source: `~/.cache/icc/repos/ulg/full-review-20261027/synthesis.md`, the lines
for slices C011-C019, C024 and C027 of Claude's 2026-10-27 full read (one
paragraph per slice, written by its readers and partly verified by Claude).
Read by Hermes 2026-11-17. Line numbers are those of `HEAD f6f7a5e` and have
moved since. This is the baseline; `ss/09` will hold the same map from
today's tree, from this read's own code slices.

Why it matters: it shows what one SS step is made of, and therefore what the
N-level chain and A1 have to change.

## One SS step on the single-level route (Iron Ice and every preset but one)

1. **Spatial epoch build** (`schroederSpatialEpochGpu.js`).
   - "builder creates its own encoder and SUBMITS ITSELF"; the generation id
     "advances only after that submit".
   - "ARENAS CAP K: live generation holds one arena in each of up to 12
     sub-builders ...; freed only after submitted + last consumer queued";
     hard cap 8, default 3, the worker uses at least 4; "each arena has own
     radix sorter".
   - "GPU COST STAYS: exactness contract requires same-step positions → K steps
     = K full rebuilds with two sorts each"; a comment calls the field-view
     candidate sort "the largest pass in the whole generation at bulk
     capacities", and another gives the epoch build as "~22 ms/step" (N not
     stated).
   - "EVERY DISPATCH OPENS ITS OWN COMPUTE PASS."
   - No presentation coupling and no hot-path readback.
2. **Epoch transaction** (`schroederSpatialEpochTransaction.js`), "deliberately
   host-side".
   - "transaction = exactly ONE substep; identity {physicsTick, physicsSubstep,
     positionEpoch} must match on every view/receipt"; "one directory build,
     one publication ..., each reader once in fixed rank order".
   - "'submitted' is only an AUTHORITY TOKEN": queue order would satisfy the
     data dependency.
   - "PRIVATE MULTI-STEP ADVANCE EXISTS but 'reserved for zero-consumer
     authoritative two-level mechanics', forbids condensate transitions".
   - "Cell tree rebuilt every generation when any exact-near law enabled: at
     6,784 rows 16 passes, 16 dispatches, 15 writeBuffers per build, 13 of them
     constant level params rewritten every encode".
3. **Hierarchy stages** (`schroederHierarchyGpu.js`): "7 in-slice stages run
   each step: level assignment, active-node list, law queue, phase-volume
   target aggregate, node reduction, migration, split/merge proposal → EACH
   builds its own encoder + one queue.submit + fresh createBuffer for
   full-size output". "NO stage accepts the caller's encoder."
   - "No settledness: one active node per particle ..., one law-queue row per
     node". At level 0 the tree does not aggregate anything.
   - "law queue already carries per-node reaction/contact/interface bits ...,
     kept as 'the node-scoped carrier for the dynamic-law activation mask'".
   - "PER-STEP STAGES WITH NO CONFIRMED CONSUMER: law queue + four
     phase-volume stages ... apply/level-update never run (admissions null) →
     results never applied".
   - "Particle-count change = 6-stage chain with CPU admission at most stages +
     StateManager buffer swap". The worker "passes no *Admission", so the six
     phase-volume and particle-storage runners "never run".
   - "~3,500 lines ... never run on presets (cross-level/far-aggregate off)".
   - `runSchroederSameLevelMechanicsWebGpuImpl` is one function of about 9,190
     lines.
4. **Successor source family** (`schroederSpatialSuccessorSourceFamily.js`).
   - "Next step's physics level assignment ... is produced by
     `prepareFinalRenderProxyArtifacts(successorAuthority:true)` ...: RENDER-PROXY
     PREP AND PHYSICS CLASSIFICATION ARE THE SAME PASS."
   - "every publish bumps storage/level/support epochs; default policy also
     bumps topology + position every step → ... epochs can't signal
     settledness."
   - "Every step builds a final-render active-node list and RETIRING THE STEP'S
     EPOCH GENERATION REQUIRES that list's final-consumer capability →
     skipping render work on undrawn steps breaks retirement unless physics
     gets its own final consumer."
   - "each published family adds a permanent device.lost handler".

## The two-level route (cesium-fluorine only)

- **Fused fine substep** (`schroederFusedFineSubstepGpu.js`): it "waits on GPU
  after every macro step: new readback buffer, submit, onSubmittedWorkDone,
  mapAsync, CPU publish-or-CFL-retry"; "CPU-driven adaptive retry 1→4→8 child
  steps, worst ~13 readbacks per outer interval". "Each fine substep = 4
  separate queue.submit".
- **Parent-field mechanics workspace**: "two-level SS mechanics forces submits
  inside every substep"; "serial single-workgroup dispatches: 4 predictor, 6-8
  correction, 10 terminal"; `contact_parent_field_predictors` "runs
  unconditionally every substep".
- **Cross-level coupling** (`schroederCrossLevelCouplingGpu.js`): "Each fine
  substep submits predictors + correction separately + P2G-batch/grid/G2P
  runners + 4 host calls ... + 3 single-use authorities"; "Host waits when
  arenas run out". "GPU-resident reflux energy ledger per macro step exists".
  - "**Two-level route applies NO pair contact**: mechanical proposal null ...,
    separation off in fused G2P ..., wall terms 0".
- **Views and traversal**: "two-level path Barnes-Hut aggregate traversal = 1
  extra submit per SS hierarchy call ..., force application null 'deliberately
  quarantined' → dead work; aggregate view itself live (mechanical + thermal
  proposals)".
- **Split/merge**: "two awaited mapAsync readbacks in a row (count ...,
  compaction ...), single-workgroup kernels, compaction makes 7 buffers per
  call"; "Compaction OFF for exact-mass inputs ..., throws on exact-mass
  buffers".

## What this says about the plan (Hermes, INFERRED)

1. **The tree's cost is paid without the tree's benefit on the single-level
   route.** Every step rebuilds an epoch (two radix sorts, a cell tree of 16
   passes), runs seven stages with their own submits, and classifies levels,
   for a scene where every particle is its own active node on level 0 and the
   stage results are not applied. This is the concrete form of the scale
   plan's "eager inversion of the spec".
2. **The two-level runner is a different machine.** It has its own CPU-driven
   macro loop with readbacks, no pair contact, serial single-workgroup
   workspace dispatches and reactive time refinement. The N-level chain's
   phase B proposes to build "per-pair instances" of it. Carrying its
   readback-driven control loop and its missing contact into N pairs would
   multiply the slowest part of SS. The audit's own remark is that queue order
   would serve where "submitted" is only a token.
3. **Topology change needs the host.** Split and merge read counts back twice
   and need CPU admission and a StateManager swap; the worker lane passes no
   admission, so no topology change happens there. First-class air's slice 1
   (spare lineages, a GPU lineage scan, in-place materialization) is the way
   round this, and its kernel (1c) is not built.
4. **Physics classification is tied to render preparation**, and epoch
   retirement needs a render-side capability. Decoupling presentation (A1) and
   skipping draw work on undrawn steps both run into this.
5. **Epoch counters cannot say "nothing moved"**, because the default policy
   bumps them every step. A2 (incremental membership repair) and G4 (dormancy)
   both need a real settledness signal; the campaign's thermal dormancy built
   its own cell grid instead.
