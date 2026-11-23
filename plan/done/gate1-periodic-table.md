# Gate 1 — Complete First-Principles Periodic Table Engine (`Z = 1..118`)

## Accepted — 2026-11-23 UTC

All three `ulg-gate1-periodic-table-engine` criteria pass on one exact,
committed, source-bound receipt bundle (`feat/star-spec-generalization-audit` @
`b9e8681143674d029ccf7b9fc3d3222418aec191`, `dirty: false`):

1. `gate1-periodic-table-candidate-review`: **PASS**
2. `gate1-nuclear-atomic-em-solid-md-z118`: **PASS**
3. `gate1-real-gpu-quantum-visualizations`: **PASS**

ICC selected `HEAD:.icc/completion-oracles.yaml` (`ulg-gate1-periodic-table-engine`),
reporting `status: "complete"`, `criterion_count: 3`, `summary: { PASS: 3 }`,
`source_count: 1`, `truncated: false`, `dropped_event_count: 0`,
`dropped_criterion_count: 0`, `criteria_truncated: false`, and `warnings: []`.

## Adversarial 3-Round Independent Review Lineage

Acceptance followed three rigorous independent audit rounds by read-only
research subagents, with both earlier honest FAIL reports preserved on disk:

- **Round 1 FAIL (`52d471fd`, `independent-review-baseline-fail.md`):** Found
  silent `bandGapEv` optical schema mismatch + CPU interband oscillator
  fallback, uniform `fcc` bulk crystal collapse & `+1,470 GPa` MD stress, 2D
  projected sphere viewport with camera auto-spin in `elements-lab.html`, and
  silent constant-solid density fabrication in unfitted polytope hydration.
- **Round 2 FAIL (`66aa79f5`, `independent-review-round2-fail.md`):** Confirmed
  all 5 Round-1 remedies, then surfaced two remaining surgical defects in Gate 1
  (`G1-A`: `hcp.atomsPerConv = 2` vs 4-atom HCP MD cell causing 2× volume
  mismatch on 50 HCP elements; `G1-B`: `Pd` `Z = 46` `4d¹⁰ 5s⁰` misclassified
  as insulating cryogenic `vdw-fcc`), plus MSD `1e3` fixed-point zero
  truncation on 36 elements.
- **Round 3 ACCEPT (`b9e86811`, `independent-review.md`):** Independent reviewer
  verified `34/34` source manifest SHA-256 hashes, `10/10` Wayland Vulkan PNG
  hashes, `50/50` exact HCP 4-atom volumes (`a0^3 / V_atom === 4.000`, `0`
  mismatches; median HCP MD pressure shifted `-25.97 → +12.93 GPa`), `Pd (Z=46)`
  metallic `fcc` (`σ = 2.86e7 S/m`, `opticalSrgb = [0.845, 0.761, 0.775]`),
  `0/118` zero-MSD truncations, `0` `reference-fallback`, and `0`
  `"scientificValidation": true`.

## Delivered & Verified Evidence (`b9e86811`)

- **5-Domain WebGPU Periodic Table + End-to-End `(Z, A)` Isotopes (`Z = 1..118`):**
  - Nuclear (`nuclearStructureGpu.js`): Weizsäcker + Strutinsky shells +
    pairing `B(Z, A)`, finite charge radius `R_nuc(A)`, Woods–Saxon `I^π, μ_I`,
    `α/β±/EC/SF` Q-values & WKB tunneling, generalized arbitrary `(Z, A)` decay
    chains in `nuclearCherenkovClosure.js`.
  - Relativistic Atomic QM (`radialKohnShamWebGpu.js`): 100% GPU-resident
    Koelling–Harmon scalar-relativistic + finite-nucleus + QED + two-body
    reduced-mass & Fermi-contact hyperfine splitting (`zeroPerScfReadbacksAll118:
    true`), solving dipole-allowed (`Δl = ±1`) virtual `occupancy: 0` subshells
    strictly on WebGPU (`zeroCpuOscillatorFallbacks: true`).
  - Bulk Solid DFT, EM, Magnetism & Optics (`periodicBulkDftWebGpu.js`,
    `electromagneticClosureWebGpu.js`): Pettifor `s/p/d/f` orbital-filling
    crystal symmetry selection across all 5 classes (`{ vdw-fcc: 16, bcc: 21,
    hcp: 50, diamond: 5, fcc: 26 }`), isotope mass/ZPE/Debye propagation,
    caller-supplied GPU interband + Drude optics (`95` distinct element sRGBs;
    relativistic gold `Au = [0.943, 0.900, 0.771]` vs iron `Fe = [1.000, 0.889,
    0.905]`).
  - Live WebGPU MD (`molecularDynamicsWebGpu.js`, `elementMdClosureWebGpu.js`):
    Symmetry-exact `buildCrystalMdState`, balanced Morse+EAM `r_0`, `1e6`
    fixed-point MSD precision (`allElementsMdRan: true`, `0/118` zero-MSD
    truncations, `Fe` MD pressure `0.71 GPa`).
  - Material Banks: `data/material-properties/elements.json` (`118/118` incl.
    all 7 noble gases) and `data/material-properties/foundation-polytope-atlas.json`
    (`118` elements with mirrored `provenance`, `0` `reference-fallback`,
    offline G7 advisory scorecard).
- **Real Live WebGPU Visualizations (`elements-lab.html`, `elementsLabWebGpuRenderer.js`, `elementsLabDemo.js`):**
  - Real WebGPU compute/render pipelines (`build_atomic_volume` 3D raymarcher
    for Nuclear, Atomic, Bloch+Fermi, and Molecular volumes; zero-copy instanced
    3D Phong/Fresnel MD reading `liveMdSession.positionsBuffer`/`velocitiesBuffer`
    directly on GPU with `mdPerFrameCpuPositionReadback: false` and
    `cameraAutoSpin: false`; software-backed 2D diagnostic plots across all 6
    tabs including clickable `118×200` Chart of Nuclides and `#a-input` isotope
    selector).
  - Visually verified on visible Wayland Vulkan Chrome (`10` PNGs inspected,
    `mdVisibleContentAdvanced: true`, `116,314` changed pixels / `11.36%` frame,
    `maxChannelDelta: 250`, `pageErrors: []`, `gpuErrors: []`).
- **Executed Verification Matrix:**
  - Live WebGPU `Z = 1..118` + `20` compounds atlas regeneration: `54.75 s`,
    `exit 0`.
  - Native Vulkan proofs (`ULG_RUN_NATIVE_WEBGPU=1 --test-concurrency=1`):
    **`6 pass / 0 fail / 0 skipped`** (`gate0GpuMath`, `gate1PeriodicTable`,
    `gate2ReactionsAndPolytopeAtlas`, `priority1Isotopes`,
    `priority3PolytopeContinuumBridge`).
  - Full host suite: **`6,209 pass / 0 fail / 0 cancelled`** (`197` opt-in
    skips, `6,406` total).
  - Production Vite build: **`3.49 s`**, `dist/ = 37 MB`, `0` AI/WASM assets.
  - Kernel check (`journalctl -k`): **`KERNEL_CLEAN`** (`0` NVIDIA Xid/NVRM/OOM).

## Scope Honesty & Disclosed Non-Blocking Limitations

- `scientificValidation: false` is preserved throughout; G7 comparisons against
  external scientific databases remain strictly offline and advisory (never a
  runtime admission gate).
- Disclosed non-blocking items recorded in `independent-review.md` for optional
  post-acceptance fidelity refinement: `Pu/Am/Bk` super-stiff `5f` actinide
  Morse+EAM `alpha` clamp leaves residual negative MD virial pressure under
  exact `V_atom_MD === V_atom_DFT`; `Au` 192-pt vs 256-pt SCF grid sensitivity;
  `Au-193` LDM `A*`; valence-envelope spin plot on Tab 2; and future upgrade
  from scalar-relativistic Koelling–Harmon toward full 4-component Dirac–KS /
  spin-polarized `DFT+U`.
- Formal acceptance covers `ulg-gate1-periodic-table-engine` only; Gates 0, 3,
  4, and 5 remain open (`in_progress`).

## Evidence Bundle

`/home/cos/.cache/icc/repos/ulg/gate1-gate2-acceptance-20261123/`:
`source-manifest.json`, `executed-checks.json`, `root-review.md`,
`independent-review.md`, `independent-review-baseline-fail.md`,
`independent-review-round2-fail.md`, `final-bundle-signoff.md`,
`gate1-reviewed-receipts.jsonl`, `gate1-oracle.json`,
`webgpu-z118-and-compounds-report.json`, `atlas-regen.log`, `visuals-run.log`,
`native-vulkan-proofs.log`, `build.log`, `host-suite.log`, `kernel-check.log`,
and `visuals/` (`10` PNGs + `visual-report.json`).
