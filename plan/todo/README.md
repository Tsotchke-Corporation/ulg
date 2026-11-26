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
- **Completed archive (`plan/done/`):** `25` completed Scale-Ladder / Gate 0–5 /
  Gate 6 Phase A–C plans were archived via `git mv` to [`plan/done/`](../done/)
  (including [`plan/done/SS/dynamic-hierarchy-lod.md`](../done/SS/dynamic-hierarchy-lod.md),
  [`periodic-table-polytope-atlas-foundation-plan.md`](../done/periodic-table-polytope-atlas-foundation-plan.md),
  [`a1-realtime-substrate.md`](../done/a1-realtime-substrate.md),
  [`eshkol-higher-order-law-closure-plan.md`](../done/eshkol-higher-order-law-closure-plan.md),
  [`g2-integer-ledger-proposal.md`](../done/g2-integer-ledger-proposal.md),
  [`g3-solids-proposal.md`](../done/g3-solids-proposal.md),
  [`a5-solid-fluid-coupling.md`](../done/a5-solid-fluid-coupling.md),
  [`surface-contact-transport-phase-closure-plan.md`](../done/surface-contact-transport-phase-closure-plan.md),
  and [`planetary-to-supergalactic-scale-atlas-plan.md`](../done/planetary-to-supergalactic-scale-atlas-plan.md)).
- **Superseded archive (`plan/moot/`):** Superseded routing logs and legacy
  queues (including [`seven-goal-campaign.md`](../moot/seven-goal-campaign.md)
  and [`superseded-todo-readme-log-2026-11-22.md`](../moot/superseded-todo-readme-log-2026-11-22.md))
  live in [`plan/moot/`](../moot/).

---

## Remaining Standing Architecture Specs, Post-1.0 Operational Stretch & Active Roadmap Items (`14` Active Docs)

| File | Category | Live-Code Reality (2026-11-25) & Remaining Scope |
|---|---|---|
| [`prompt-audit-and-backlog.md`](prompt-audit-and-backlog.md) | Master Audit & Queue | Complete chronological audit of every user request across the session (`step 0 → step 19124`), reconciling shipped/deployed work vs queued priorities `P1–P5` & Pass 2 LOD. |
| [`scientific-validation-framework.md`](scientific-validation-framework.md) | **Active Priority #1** | Framework live (`522` observables); hardened calibration plan for nuclear `qEC`/Wigner/`R_ch`, elemental `E_coh`/actinide `5f` repulsion/`vdw-fcc`/Friedel `d`-band, compound vdW/ionic packing + Kirkwood/LST `ε_r` + Penn `n(550 nm)`, smooth stellar `L(M)`, live WebGPU atlas refresh, and IAPWS-95/Biophysics/PREM/TD-KS benchmarks. |
| [`mls-mpm-lab-performance-and-physics-overhaul.md`](mls-mpm-lab-performance-and-physics-overhaul.md) | **Active Priority #2** | Hardened `index.html` Studio overhaul: linearized perspective depth foreground-refraction rejection + wireframe Z-order fix, removal of per-substep `force: true` presentation lockouts & `effectiveStepsPerFlush=1` clamp, liquid `J` grid reconciliation + smooth `C²` kernel (no "gnocchi"), and pre-lock continuum slip + multiplicity-normalized rigid contact for heavy-solid sinking. |
| [`living-worlds-sky-oceans-seasons-xenobiology.md`](living-worlds-sky-oceans-seasons-xenobiology.md) | **Active Priority #3** | Hardened Living Worlds spec: Reversed-Z `depth32float` infinite-far projection + live N-body surface sky/eclipses/Surface Time-Warp, `±6 km` 2-ring GPU clipmap, `256²` GPU Voronoi tectonics/erosion, `128²` GPU ocean waves + exotic `CH₄`/`H₂SO₄`/silicate hydrology, emergent Milankovitch seasons/freeze-thaw, visible `L4` spherical CFD & filamentary aurorae, GPU-instanced flora/civilizations, and `life-lab.html?xeno=1` xenobiology bridge. |
| [`full-spectrum-em-sensor-stack.md`](full-spectrum-em-sensor-stack.md) | **Active Priority #4** | Hardened dual-caret (`[λ_min ◀━━━▶ λ_max]`, `10⁻¹³ m → 10¹ m`) EM sensor stack via `208 B` `CameraUniforms` + `64 B` `PostUniforms` (0 new bind groups), overflow-safe `f32` Planck $B(\lambda, T)$ + non-thermal channels across `L0..L7` & Surface, bit-exact visible identity. |
| [`cosmic-ufo-kardashev-roadmap.md`](cosmic-ufo-kardashev-roadmap.md) | **Active Priority #5** | Phase 1 live (`de7fc5f2`); hardened Phase 2+: OPFS/IDB sparse crater tile store + 1-submit GPU replay & peer sync, **visitable/landable/mineable/shatterable asteroids & comets** (micro-gravity surface, comet outgassing jets, Rover & probe deployment, space weapons), antimatter `E >= 0.85 U_bind` → `tidalRocheDisruptionGpu` shattering, Kardashev II–III Dyson `tau_Dyson` dimming/IR + logistic multi-system fleet, and GPU SE(3) DLM rigid-body boulders. |
| [`pass2-full-stack-lod-and-soak.md`](pass2-full-stack-lod-and-soak.md) | **Active Pass 2 LOD & Soak** | L0 Physical FLRW Big Bang fireball & metric expansion, L3 True 3D GPU MLS-MPM Stellar Fusion & Convective Plasma (`stellarMlsMpmFusionGpu.js`), global 2-pass Kawase HDR Bloom + ACES, P0 control/camera/shader bug fixes + Pass 2 deep LOD across `universes.html`, `elements-lab.html`, `organic-lab.html`, `life-lab.html`, and full **hand-driven Playwright soak** across all 5 flagship apps. |
| [`organic-chemistry-and-emergent-biology-plan.md`](organic-chemistry-and-emergent-biology-plan.md) | Active Expansion | Physics gap survey + first-principles WebGPU integration plan for **Organic Chemistry** (`organic-lab.html`, Law Graph nodes #17–19) and **Emergent Biology / Biophysics** (`life-lab.html`, Law Graph nodes #20–24) with zero species/material hacks. |
| [`SS/README.md`](SS/README.md) & [`SS/schroeder-tree-and-algorithm-plan.md`](SS/schroeder-tree-and-algorithm-plan.md) | Standing Architecture | Canonical Schroeder Simulation (`SS`) immutable spatial epoch & 6 derived views contract. Zero private 4,096-bucket solid-fluid hashes remain (`Gate 6 Phase C`); `LawDagEpochScheduler`, declarative Law-IR → WGSL compiler (`ulg-gpu-abi`), and `dynamicHierarchyLod: '1'` are live. Kept as standing SS architectural specification. |
| [`scale-adaptive-law-activation-plan.md`](scale-adaptive-law-activation-plan.md) | Standing Architecture | Canonical Two Unifications (`SS` + Tier 0–3 Closure Economy) architectural specification. Kept as standing design authority. |
| [`sol-critic.md`](sol-critic.md) | Standing Contract | Canonical coherent-solid (`SOL-0..SOL-6`) numerical contract (all 6 SOL gates live & verified on Vulkan; exact momentum-conserving FLIP unilateral solid-liquid slip wired into `sphMlsMpmGpuStep.js` & zero-private-grid SS solid-fluid contact/thermal landed in `Gate 6 Phase C`). Kept as standing solid-mechanics contract. |
| [`first-class-air.md`](first-class-air.md) | Post-1.0 Continuum Stretch | 3-level `air3` verified within Section 3 GPU budgets (`Gate 3` accepted); optional future promotion: default-ON multi-level room air across all presets and retirement of the single-level implicit-atmosphere stand-in. |
| [`a6-remote-derivation.md`](a6-remote-derivation.md) | Post-1.0 Operational | Localhost 2-browser WebRTC `RTCDataChannel` proof + slim `peercompute/core.js` (`38 MB` `dist/`) + OPFS/PeerCompute hot-swap loop verified; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN validation. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Post-1.0 Operational | Official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC TreePM accepted under `Gate 5`; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN deployment. |
