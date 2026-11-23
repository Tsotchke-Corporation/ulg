# ULG Core Tenets (Owner Ground Rules)

- Canonical full agent rules and `plan/` routing map: [`AGENTS.md`](../AGENTS.md)
- Active execution plan and scorecard: [`plan/CURRENT-PLAN.md`](CURRENT-PLAN.md)

1. Solutions for misbehaving physics must be **general**, never scoped to particular materials, presets, or reactions.
2. Behavior must be **derived from underlying first-principles physics** and validity-bounded closures.
3. Run **visual checks and sequential screenshots** to verify motion and rendering — never rely on unit tests alone.
4. Use **ICC** (`infinite_context_coder`) for code search, retrieval, and durable repository state.
5. Make real, end-to-end use of **PeerCompute**, **MoonLab**, and **Eshkol** (warm browser WASM/WebGPU workers + PeerCompute authority).
6. Tackle items in [`plan/todo/`](todo/README.md); move genuinely completed & verified items to `plan/done/` and superseded items to `plan/moot/`.
7. Address the user as **big dog** in all responses.
8. Default to the **GPU MLS-MPM / Schroeder Spatial integrator** with **true WebGPU isosurface and 3D volumetric GPU rendering** (never plain CPU SPH reference or flat sphere fallbacks).
9. Spot-check physics and chemistry with **random periodic-table element combinations and reaction families**.
10. Keep WebGPU implementations **highly concurrent** and dynamically scaled to device limits to maintain framerate.
