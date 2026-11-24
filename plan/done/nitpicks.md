# Studio & Demo UX Nitpicks (Open Backlog)

> **2026-11-22 Live-Code Status (`23a961c4`):** Moved from `plan/nitpicks.md`
> into `plan/todo/`. Verified against `src/visualization/ulgSimStudioApp.js`,
> `src/visualization/ulgSimStudioModel.js`, `src/visualization/sphPhaseDemoMount.js`,
> and `src/runtime/sphInitialBodies.js`. Active routing:
> [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

## Original Owner Notes (Verbatim)

1. editing the controls should trigger a "pause" and don't try to dynamically update anything until the user hits play or reset.
2. axis-aligned edge lengths should be inferred from the material properties and the "particles per edge" control.
3. if volumes overlap or are out of bounds. correct them by moving them around or expanding the box size rather than generating an error.
4. the world/global origin should be the center of the floor of the box.
5. water does not flow correctly or settle realistically. it currently behaves more like a gel.

## Verified Status at HEAD `23a961c4`

- **1 (Pause & stage on edit):** **Partial.** `sphPhaseDemoMount.js` pauses/stages general controls (`stageControlEdit`), but body-card edits (`commitInitialBodyCard` / `applyInitialBodiesMutation`, `:7122-7147`) still trigger debounced rebuilds. `ulgSimStudioApp.js` stages config edits without restarting live physics (`markStagedCustom`), but does **not** pause the active run when controls are edited.
- **2 (Material-derived edge lengths):** **Open.** `deriveSphInitialBodySizeM` (`src/runtime/sphInitialBodies.js:340-354`) only scales existing `sizeM` to preserve particle pitch — independent of material properties.
- **3 (Auto-resolve overlaps/OOB + box expansion):** **Open.** `validateStagedSimulationConfig` (`ulgSimStudioModel.js:358-448`) still blocks Launch with hard errors; user must manually click `"Fit & Separate Bodies"`, which never expands the box.
- **4 (Floor-center origin):** **Done in Studio UI** (`floor-centered` converted via `floorCenteredToInternalCenterM`); legacy `sphPhaseDemoMount.js` still edits internal `[0, L]`.
- **5 (Water flow vs gel):** **Major cause fixed; residual drag remains.** The artificial `~1,970 Pa·s` shear viscosity bug was fixed (`sphMechanicsMaterialTable.js:163-170`), but canonical presets still run `contactSolver: '1'` and G2P excluded-volume PBD (`MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT = 0.5`, `sphGpuBuffers.js:86`).
