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

## Remaining Standing Architecture Specs, Post-1.0 Operational Stretch & Active Roadmap Items (`13` Active Docs)

| File | Category | Live-Code Reality (2026-11-25) & Remaining Scope |
|---|---|---|
| [`prompt-audit-and-backlog.md`](prompt-audit-and-backlog.md) | Master Audit & Queue | Complete chronological audit of every user request across the session (`step 0 → step 19124`), reconciling shipped/deployed work vs active `feat/cosmic-ufo-sandbox-weapons-mpm-multiplayer` vs queued priorities `P1–P5`. |
| [`scientific-validation-framework.md`](scientific-validation-framework.md) | **Active Priority #1** | Expand G7 (`scienceReleaseAudit.js`) into a live cross-scale scientific validation & calibration harness auditing actual simulation outputs against immutable public datasets (AME2020, NIST, CODATA, PubChem/CRC, Materials Project, PREM, MESA, Planck `P(k)`, PDB, HH) with advisory calibration triage. |
| [`mls-mpm-lab-performance-and-physics-overhaul.md`](mls-mpm-lab-performance-and-physics-overhaul.md) | **Active Priority #2** | Revisit `index.html` Mesoscale Continuum Lab (MLS-MPM Studio) interactive performance & speed; fix water refracting foreground objects in front of water; promote dynamic volume LOD & finer resolution to eliminate water clumping ("gnocchi") and let dense solids sink naturally. |
| [`living-worlds-sky-oceans-seasons-xenobiology.md`](living-worlds-sky-oceans-seasons-xenobiology.md) | **Active Priority #3** | Reversed-Z / Logarithmic depth buffer + dynamic solar-system surface sky (real sunrise/sunset, orbiting stars/moons/planets); 2-ring `±6 km` view distance; `planetgen`-inspired tectonics/erosion & Earth-like diversity; GPU ocean waves/currents + exotic non-water hydrology/weather (`CH₄`, `H₂SO₄`, silicate); `hyperborea`-inspired emergent orbital-tilt seasons/snow/ice/trees; `life-lab` ↔ `universes` alien xenobiology; emergent planetary civilizations & tech levels. |
| [`full-spectrum-em-sensor-stack.md`](full-spectrum-em-sensor-stack.md) | **Active Priority #4** | Dual-caret (`[λ_min ◀━━━▶ λ_max]`) logarithmic full-EM spectrum sensor stack (`10⁻¹³ m` Gamma → `10¹ m` Radio) mapping real physical emissions (Planck `B(λ, T)`, 21 cm HI, CMB, synchrotron, X-ray ICM, `511 keV`, alien technosignatures) smoothly onto the human visible spectrum across all scales. |
| [`cosmic-ufo-kardashev-roadmap.md`](cosmic-ufo-kardashev-roadmap.md) | Active Expansion (`P5` Phase 2+) | Phase 1 live on `feat/cosmic-ufo-sandbox-weapons-mpm-multiplayer` (60-ft emerald-dome UFO perspective across `L0 → Surface`, yellow tractor beam, 360° rim EM laser/missiles/antimatter, Dormant-Zero GPU MLS-MPM deformable terrain + 64 rigid boulders, 3D Cockpit + WebXR/Stereo VR, share-links, PeerCompute multiplayer + locked `1.0×` timescale, Von Neumann probes & Kardashev `K`); Phase 2+ discusses sparse chunked planet-wide MLS-MPM, planetary shattering, WAN relay, and full Kardashev II–III Dyson swarms. |
| [`organic-chemistry-and-emergent-biology-plan.md`](organic-chemistry-and-emergent-biology-plan.md) | Active Expansion | Physics gap survey + first-principles WebGPU integration plan for **Organic Chemistry** (`organic-lab.html`, Law Graph nodes #17–19) and **Emergent Biology / Biophysics** (`life-lab.html`, Law Graph nodes #20–24) with zero species/material hacks. |
| [`SS/README.md`](SS/README.md) & [`SS/schroeder-tree-and-algorithm-plan.md`](SS/schroeder-tree-and-algorithm-plan.md) | Standing Architecture | Canonical Schroeder Simulation (`SS`) immutable spatial epoch & 6 derived views contract. Zero private 4,096-bucket solid-fluid hashes remain (`Gate 6 Phase C`); `LawDagEpochScheduler`, declarative Law-IR → WGSL compiler (`ulg-gpu-abi`), and `dynamicHierarchyLod: '1'` are live. Kept as standing SS architectural specification. |
| [`scale-adaptive-law-activation-plan.md`](scale-adaptive-law-activation-plan.md) | Standing Architecture | Canonical Two Unifications (`SS` + Tier 0–3 Closure Economy) architectural specification. Kept as standing design authority. |
| [`sol-critic.md`](sol-critic.md) | Standing Contract | Canonical coherent-solid (`SOL-0..SOL-6`) numerical contract (all 6 SOL gates live & verified on Vulkan; exact momentum-conserving FLIP unilateral solid-liquid slip wired into `sphMlsMpmGpuStep.js` & zero-private-grid SS solid-fluid contact/thermal landed in `Gate 6 Phase C`). Kept as standing solid-mechanics contract. |
| [`first-class-air.md`](first-class-air.md) | Post-1.0 Continuum Stretch | 3-level `air3` verified within Section 3 GPU budgets (`Gate 3` accepted); optional future promotion: default-ON multi-level room air across all presets and retirement of the single-level implicit-atmosphere stand-in. |
| [`a6-remote-derivation.md`](a6-remote-derivation.md) | Post-1.0 Operational | Localhost 2-browser WebRTC `RTCDataChannel` proof + slim `peercompute/core.js` (`38 MB` `dist/`) + OPFS/PeerCompute hot-swap loop verified; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN validation. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Post-1.0 Operational | Official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC TreePM accepted under `Gate 5`; remaining operational stretch: physical 2-machine WAN/NAT/STUN/TURN deployment. |
