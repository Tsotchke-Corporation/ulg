# Gate 2 — Chemical Reactions, Recursive Compound Feedback & Convex Polytope Atlas

## Accepted — 2026-11-23 UTC

All three `ulg-gate2-reactions-and-polytope-atlas` criteria pass on one exact,
committed, source-bound receipt bundle (`feat/star-spec-generalization-audit` @
`b9e8681143674d029ccf7b9fc3d3222418aec191`, `dirty: false`):

1. `gate2-reactions-polytope-candidate-review`: **PASS**
2. `gate2-reactions-and-compound-feedback`: **PASS**
3. `gate2-convex-polytope-atlas`: **PASS**

ICC selected `HEAD:.icc/completion-oracles.yaml`
(`ulg-gate2-reactions-and-polytope-atlas`), reporting `status: "complete"`,
`criterion_count: 3`, `summary: { PASS: 3 }`, `source_count: 1`,
`truncated: false`, `dropped_event_count: 0`, `dropped_criterion_count: 0`,
`criteria_truncated: false`, and `warnings: []`.

## Adversarial 3-Round Independent Review Lineage

Acceptance followed three independent audit rounds by read-only research
subagents, with both earlier honest FAIL reports preserved on disk:

- **Round 1 FAIL (`52d471fd`, `independent-review-baseline-fail.md`):** Found
  silent constant-solid density fabrication on unfitted polytopes in
  `hydrateFoundationPolytopes`, omitted persisted Chebyshev coefficients in
  `foundation-polytope-atlas.json`, CPU-only `molecularHartreeFock.js` CI-NEB
  import in `elements-lab.html`, broken `discoverReactionCandidates` call in
  `discoverAndDeriveReactionProductsWebGpu`, and simplified ionic radius mis-
  classifying `NaCl` as `fcc-alloy`.
- **Round 2 FAIL (`66aa79f5`, `independent-review-round2-fail.md`):** Confirmed
  100% WebGPU CI-NEB, Slater + Allred–Rochow ionic crystals, persisted 4-phase
  log-density Chebyshev fits, and fail-closed hydration, then caught defect
  `G2-A`: linear `T` held-out probes missed `20%–86%` relative density errors
  at ambient `300 K, 1 atm` on ultra-wide gas/plasma polytopes, and missed
  mirroring `provenance` onto top-level JSON entries.
- **Round 3 ACCEPT (`b9e86811`, `independent-review.md`):** Independent reviewer
  verified `34/34` source manifest SHA-256 hashes, `10/10` Wayland Vulkan PNG
  hashes (including the upgraded 19-cell `H2O` Tab 6 atlas), `0` invalid fits,
  `0` missing phases, `provenance` mirrored onto all `138/138` atlas entries
  (with `gpuStagesExecuted` on all `20/20` compounds), and independently
  evaluated **142,457 adversarial interior Chebyshev probes** confirming
  `< 0.6%` error on ambient `300 K, 1 atm` gases (`N2: 0.585%`, `O2: 0.543%`,
  `H2: 0.087%`, `CH4: 0.105%`, `Cl2: 0.281%`, `SiO2: 0.117%`, `H..Xe:
  0.201%–0.371%`, `H2O @ 900 K: 0.089%`, `Fe/Pd/Au @ 300 K: 0.040%–0.788%`) and
  `< 3.40%` across the full structured interior grid (`138/138` materials).

## Delivered & Verified Evidence (`b9e86811`)

- **100% WebGPU Molecular QM & CI-NEB Reactions (`molecularHartreeFockWebGpu.js`):**
  - GPU Löwdin RHF + 3D molecular electron density + `climbingImageNEBWebGpu`
    (`158` warm-started GPU RHF evaluations, symmetric `H2O`/`D2O` inversion
    barrier `E_a = 3.91 eV`, `backend: "webgpu"`, zero CPU HF imports in
    `elementsLabDemo.js`).
  - Generalized reaction discovery & recursive product derivation via
    `discoverAndDeriveReactionProductsWebGpu` (verified `Na + H2O → NaOH + H2`)
    plus isotopologue parsing (`describeIsotopologueFormula` for `D2O`, `T2O`,
    `[2H]2O`, `235UF6`, `238UF6`, `14CO2`, `60Co`, `3He`) and H-site quantum
    ZPE feedback.
- **Recursive Compound Feedback Loop (`recursiveCompoundPipeline.js`):**
  - Textbook Slater shielding + Allred–Rochow electronegativity driving ionic &
    covalent crystal selection (`Al2O3` `corundum-D51` insulator `E_g = 7.79 eV`,
    `NaCl` `cscl-B2` ionic insulator `E_g = 6.56 eV`, `Fe2O3` `corundum-D51`,
    `Na2O` `fluorite-C1`), exact `basisCount * formulaVolA3` MD lattice scaling
    (`allCompoundsMdRan: true`, `allCompoundsGasLessThanSolid: true`), and
    `20/20` compounds covering **`15/15` (`100%`)** of legacy `compounds.json`
    with `0` `reference-fallback` rows and explicit `provenance.gpuStagesExecuted`.
- **Piecewise-Convex 4-Phase GPU Chebyshev Polytope Atlas (`chebyshevPolytopeFitGpu.js`, `materialFoundationAbi.js`, `materialPolytopeRegistry.js`, `polytopeAtlasBuilder.js`, `foundationPolytopeAtlasGpuBridge.js`):**
  - Slanted Clausius–Clapeyron `A x <= b` half-spaces across all 4 phases
    (`solid`, `liquid`, `gas`, `plasma`) with log-density `valueTransform: "exp"`
    (`valid_mode = 2` in WGSL `eval_polytope_atlas_2d`), degree `[5, 4]`,
    geometric `T` + balanced `T`/`log10 P` covolume bisection (`maxDepth = 5`),
    and log-spaced + explicit `300 K` ambient held-out residual gates.
  - Persisted validated GPU Chebyshev coefficients across all **`118` elements
    + `20` compounds** in `data/material-properties/foundation-polytope-atlas.json`
    (`allElementsPolytopesFittedValid: true`, `maxElementGpuPolytopeRelErr:
    0.049202`, `allCompoundsPolytopesFittedValid: true`,
    `maxCompoundGpuPolytopeRelErr: 0.048928`, `allInteriorProbesUnder5Pct: true`,
    `maxElementTrueInteriorRelErr: 0.033986`,
    `maxCompoundTrueInteriorRelErr: 0.031034`).
  - Strictly fail-closed hydration (`valid: false`, `coefficients: []` on
    unfitted polytopes; `unfittedFailedClosed: true`) and live WebGPU
    `eval_polytope_atlas_2d` out-of-domain rejection (`hitFlag == 0`) with
    Eshkol AD + MoonLab 5-slot Triad GPU miss escalation and live WGSL fragment
    rendering on `elements-lab.html` Tab 6.
- **Executed Verification Matrix:**
  - Live WebGPU `Z = 1..118` + `20` compounds atlas regeneration (`54.75 s`,
    `exit 0`), `6/6` native Vulkan proofs (`gate0GpuMath`, `gate1PeriodicTable`,
    `gate2ReactionsAndPolytopeAtlas`, `priority1Isotopes`,
    `priority3PolytopeContinuumBridge`), `6,209 pass / 0 fail` full host suite,
    `3.49 s` / `37 MB` / `0` AI assets build, `10` inspected Wayland Vulkan
    PNGs (`nebBackend: "webgpu"`, `pageErrors: []`, `gpuErrors: []`), and
    `KERNEL_CLEAN`.

## Scope Honesty & Disclosed Non-Blocking Limitations

- `scientificValidation: false` is preserved throughout; G7 comparisons remain
  strictly offline and advisory.
- Disclosed non-blocking items recorded in `independent-review.md`: `SiO2`
  takes the `allNonMetal` molecular-vdW branch rather than an extended covalent
  quartz/cristobalite network prototype, and degree-5 Chebyshev interpolation
  shows `7.4%–7.7%` Lebesgue boundary overshoot at extreme `2%`-edge `1 GPa`
  plasma / `31.6 MPa` gas corners (outside the `< 3.40%` structured interior).
- Formal acceptance covers `ulg-gate2-reactions-and-polytope-atlas` only; Gates
  0, 3, 4, and 5 remain open (`in_progress`).

## Evidence Bundle

`/home/cos/.cache/icc/repos/ulg/gate1-gate2-acceptance-20261123/`:
`source-manifest.json`, `executed-checks.json`, `root-review.md`,
`independent-review.md`, `independent-review-baseline-fail.md`,
`independent-review-round2-fail.md`, `final-bundle-signoff.md`,
`gate2-reviewed-receipts.jsonl`, `gate2-oracle.json`,
`webgpu-z118-and-compounds-report.json`, `atlas-regen.log`, `visuals-run.log`,
`native-vulkan-proofs.log`, `build.log`, `host-suite.log`, `kernel-check.log`,
and `visuals/` (`10` PNGs + `visual-report.json`).
