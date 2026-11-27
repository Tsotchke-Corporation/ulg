# ULG Active Todo Index (Post-Gate 0–5 + Gate 6 Architecture 1.0, 2026-11-25)

- **Start here:** Read [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) first for
  the full **40-order-of-magnitude bottom-up + bidirectional roadmap
  (`10⁻¹⁵ m` Nuclear → `10⁺²⁵ m` Supergalactic)**, honest formal ICC gate
  scorecard (**ALL 8/8 Scale-Ladder gates formally accepted:** `G5`, `G7`,
  [`Gate 0`](../done/gate0-foundation-arch.md),
  [`Gate 1`](../done/gate1-periodic-table.md),
  [`Gate 2`](../done/gate2-reactions-polytope-atlas.md),
  [`Gate 3`](../done/gate3-continuum-substrate-and-physics.md),
  [`Gate 4`](../done/gate4-studio-presentation.md), and
  [`Gate 5`](../done/gate5-planetary-to-supergalactic.md)), Section 3 GPU
  budgets, and Gate 6 Architecture 1.0 status.
- **Completed archive (`plan/done/`):** `36` completed Scale-Ladder / Gate 0–6 /
  Grand Campaign P1–P5 / Emergent Alien Ecosystems (`U12`) / Round-3 Anti-Pigeonhole,
  LOD & Visible Seasons (`U15–U16`) / ExoWebTUI Multi-Window Desktop, Retro UI &
  Mobile Fixes (`U17–U19`) / Full-Stack Scientific Audit (`U1–U14`) / Law-Graph
  & Schroeder Integration plans are archived via `git mv` in [`plan/done/`](../done/)
  (including [`exowebtui-retro-ui-and-mobile-plan.md`](../done/exowebtui-retro-ui-and-mobile-plan.md),
  [`emergent-alien-ecosystems-and-unique-complex-life-plan.md`](../done/emergent-alien-ecosystems-and-unique-complex-life-plan.md),
  [`round3-anti-pigeonhole-and-lod-audit-2026-11-27.md`](../done/round3-anti-pigeonhole-and-lod-audit-2026-11-27.md),
  [`full-stack-scientific-realism-audit-2026-11-26.md`](../done/full-stack-scientific-realism-audit-2026-11-26.md),
  [`living-worlds-sky-oceans-seasons-xenobiology.md`](../done/living-worlds-sky-oceans-seasons-xenobiology.md),
  [`full-spectrum-em-sensor-stack.md`](../done/full-spectrum-em-sensor-stack.md),
  [`cosmic-ufo-kardashev-roadmap.md`](../done/cosmic-ufo-kardashev-roadmap.md),
  [`pass2-full-stack-lod-and-soak.md`](../done/pass2-full-stack-lod-and-soak.md),
  [`scientific-validation-framework.md`](../done/scientific-validation-framework.md),
  [`mls-mpm-lab-performance-and-physics-overhaul.md`](../done/mls-mpm-lab-performance-and-physics-overhaul.md),
  [`organic-chemistry-and-emergent-biology-plan.md`](../done/organic-chemistry-and-emergent-biology-plan.md),
  [`plan/done/SS/dynamic-hierarchy-lod.md`](../done/SS/dynamic-hierarchy-lod.md),
  [`periodic-table-polytope-atlas-foundation-plan.md`](../done/periodic-table-polytope-atlas-foundation-plan.md),
  [`a1-realtime-substrate.md`](../done/a1-realtime-substrate.md),
  [`eshkol-higher-order-law-closure-plan.md`](../done/eshkol-higher-order-law-closure-plan.md),
  [`surface-contact-transport-phase-closure-plan.md`](../done/surface-contact-transport-phase-closure-plan.md),
  and [`planetary-to-supergalactic-scale-atlas-plan.md`](../done/planetary-to-supergalactic-scale-atlas-plan.md)).
- **Superseded archive (`plan/moot/`):** Superseded routing logs and legacy
  queues (including [`seven-goal-campaign.md`](../moot/seven-goal-campaign.md)
  and [`superseded-todo-readme-log-2026-11-22.md`](../moot/superseded-todo-readme-log-2026-11-22.md))
  live in [`plan/moot/`](../moot/).

---

## Remaining Standing Architecture Specs, Active Audits & Post-1.0 Operational Stretches (`8` Docs)

| File | Category | Live-Code Reality (2026-11-27) & Remaining Scope |
|---|---|---|
| [`ulg-cross-layer-dogfooding-audit-2026-11-27.md`](ulg-cross-layer-dogfooding-audit-2026-11-27.md) | **ACTIVE Cross-Layer ULG Dogfooding Audit (`big dog` 2026-11-27, Waves D1–D5)** | 4-auditor audit at `HEAD 43dd21cd` enforcing the highest-level **Strict ULG Dogfooding** rule ([`AGENTS.md`](../../AGENTS.md) §1.6): fixes dead `spectralKIm`/metal-`F0` crush in `materialPbrOpticsBridge`, uploads `pbrOptics` to `SphereInstance`/terrain, fixes Elements Lab `uiState.Z`/`mdTempK` & linear/sRGB gamma across Universes/ChemBio/Studio, fixes `organicMolecularGraphGpu` 105-element collapse, wires live `U12` Stages 1/2/4/5, connects L3–L7 compound/RHF/nuclear/solvent closures, fixes ExoWebTUI Paper light theme & CRT/handoff seams, and closes Studio DAG/Law-IR/A3/LOD dogfooding gaps. |
| [`prompt-audit-and-backlog.md`](prompt-audit-and-backlog.md) | Master Audit Log | Complete chronological audit of user requests reconciled against shipped code (`P1–P5`, Pass 2 LOD, Phase B–D, `U1–U19`, 6-stage Emergent Alien Ecosystems, ExoWebTUI Multi-Window Desktop, Retro UI, Mobile Audit, Wave 1 MLS-MPM optimizations, Star-System Planet Diversity, and Universal ULG Material-Physics Cook-Torrance GGX PBR). |
| [`SS/README.md`](SS/README.md) & [`SS/schroeder-tree-and-algorithm-plan.md`](SS/schroeder-tree-and-algorithm-plan.md) | Standing Architecture | Canonical Schroeder Simulation (`SS`) immutable spatial epoch & 6 derived views contract. Zero private 4,096-bucket solid-fluid hashes remain (`Gate 6 Phase C`); linear-time `O(A)` atomic-claim phase-slot materializer (`1->8`/`8->1` + conservative APIC shear), `LawDagEpochScheduler`, declarative Law-IR → WGSL compiler (`ulg-gpu-abi`), live 40-OOM `createDynamicSchroederScaleAtlasRuntime` in `universes.html`, and `dynamicHierarchyLod: '1'` are live. Kept as standing SS architectural specification. |
| [`scale-adaptive-law-activation-plan.md`](scale-adaptive-law-activation-plan.md) | Standing Architecture | Canonical Two Unifications (`SS` + Tier 0–3 Closure Economy) architectural specification. Kept as standing design authority. |
| [`sol-critic.md`](sol-critic.md) | Standing Contract | Canonical coherent-solid (`SOL-0..SOL-6`) numerical contract (all 6 SOL gates live & verified on Vulkan; exact momentum-conserving FLIP unilateral solid-liquid slip wired into `sphMlsMpmGpuStep.js` & zero-private-grid SS solid-fluid contact/thermal landed in `Gate 6 Phase C`). Kept as standing solid-mechanics contract. |
| [`first-class-air.md`](first-class-air.md) | Post-1.0 Continuum Stretch | 3-level `air3` verified within Section 3 GPU budgets (`2.28 steps/s`, `1.56 submits/step`, `8.22 passes/step`, `2.60 indirect/step`, `0` errors) + `O(A)` phase-slot split/merge & Chapman–Enskog transport live; optional future stretch: promote multi-level room air to default-ON across all presets and retire the single-level implicit-atmosphere stand-in. |
| [`a6-remote-derivation.md`](a6-remote-derivation.md) | Post-1.0 Operational (Excluded per User) | Localhost 2-browser WebRTC `RTCDataChannel` proof + slim `peercompute/core.js` + OPFS/PeerCompute hot-swap loop verified; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN/ICE validation. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Post-1.0 Operational (Excluded per User) | Official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC TreePM accepted under `Gate 5`; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN/ICE deployment. |
