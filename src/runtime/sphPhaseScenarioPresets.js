import {
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyDropBase
} from './sphInitialBodies.js';

export const SPH_PHASE_SCENARIO_PRESET_SCHEMA =
  'peercompute.ulg.sph-phase-scenario-preset.v0';

const COMMON_CONTROLS = Object.freeze({
  mech: 'mlsmpm',
  wxmin: '293.15',
  wxmax: '293.15',
  wzmin: '293.15',
  wzmax: '293.15',
  iceh: '0',
  ironh: '1.01',
  dropn: '3',
  basen: '5',
  boxx: '5',
  boxy: '5',
  boxz: '5',
  lawmech: '1',
  lawg: '1',
  laweos: '1',
  lawp: '1',
  lawt: '1',
  lawr: '1',
  lawv: '1',
  lawst: '0',
  blob: '1'
});

// UI presets and automated standard fixtures share one architecture source of
// truth. Quantitative scenario tuning can still override these values, but a
// menu selection now exercises the worker-owned SS lane instead of silently
// falling back to a different main-thread topology.
const COMMON_RUNTIME = Object.freeze({
  renderer: 'native-webgpu',
  surfaceDraw: 'native-webgpu-surface-consumer',
  surfaceOverlay: '0',
  renderOwnership: 'worker-owned-resident-render-producer',
  workerOffscreenPresentation: '1',
  workerParticleOverlay: '0',
  residentWorkers: '1',
  residentComputeManagerMode: 'worker-owned-resident-lane',
  // This is the requested authenticated batch. Interactive presentation may
  // apply a smaller safety maximum; the mounted controls publish both values
  // instead of pretending the request is the effective schedule size.
  residentStepsPerSchedule: '16',
  contactSolver: '1',
  ss: '1',
  schroederLevel: '0',
  schroederMinLevel: '0',
  schroederMaxLevel: '0',
  schroederPortableSummary: '1',
  schroederActiveNodeIndex: '1',
  schroederActiveNodeSortedIndex: '1',
  schroederLawQueue: '1',
  schroederLawNeighborCandidates: '1',
  schroederCrossLevelCoupling: '0',
  schroederPhaseVolumeMigration: '1',
  schroederTwoLevel: '0',
  schroederMechanicsFieldPairV2: '0'
});

const CESIUM_FLUORINE_TWO_LEVEL_BODIES = serializeSphInitialBodies(
  sphInitialBodiesFromLegacyDropBase({
    baseMaterial: 'F',
    dropMaterial: 'Cs',
    baseSizeM: [1, 1, 1],
    dropSizeM: [0.6, 0.6, 0.6],
    baseCenterM: [2, 0.5, 2],
    dropCenterM: [2, 1.31, 2],
    baseTemperatureK: 293.15,
    dropTemperatureK: 293.15,
    baseParticlesPerEdge: [5, 5, 5],
    dropParticlesPerEdge: [5, 5, 5]
  })
);
const CESIUM_FLUORINE_FINE_SUPPORT_RADIUS_M = Math.cbrt(
  (3 * (0.6 / 5) ** 3) / (4 * Math.PI)
);
const CESIUM_FLUORINE_TWO_LEVEL_BASE_DX_M =
  CESIUM_FLUORINE_FINE_SUPPORT_RADIUS_M / 1.5;

function freezeValidation(validation) {
  return Object.freeze({
    ...validation,
    checkpoints: Object.freeze((validation?.checkpoints || []).map((checkpoint) => (
      Object.freeze({ ...checkpoint })
    )))
  });
}

function preset({
  id,
  label,
  controls,
  runtime,
  validation,
  frameworkValidation = null,
  standardMatrixEnabled = true
}) {
  const frozenValidation = freezeValidation(validation);
  return Object.freeze({
    schema: SPH_PHASE_SCENARIO_PRESET_SCHEMA,
    id,
    label,
    standardMatrixEnabled: standardMatrixEnabled !== false,
    controls: Object.freeze({ ...COMMON_CONTROLS, ...controls }),
    runtime: Object.freeze({ ...COMMON_RUNTIME, ...(runtime || {}) }),
    validation: frozenValidation,
    ...(frameworkValidation
      ? {
          frameworkValidation: freezeValidation({
            ...validation,
            ...frameworkValidation,
            checkpoints:
              frameworkValidation.checkpoints ?? validation?.checkpoints
          })
        }
      : {})
  });
}

export const SPH_PHASE_SCENARIO_PRESETS = Object.freeze([
  preset({
    id: 'water-cycle',
    label: 'Water cycle - hot floor / cold ceiling',
    controls: {
      drop: 'h2o',
      base: 'h2o',
      dropt: '300',
      baset: '300',
      wxmin: '300',
      wxmax: '300',
      wymin: '400',
      wymax: '200',
      wzmin: '300',
      wzmax: '300'
    },
    validation: {
      // The first frozen steam lineage reaches the cold ceiling near 3.33 s.
      // Retain five post-contact checkpoints so the standard gate observes
      // same-lineage gas loss and return instead of stopping at plume rise.
      batches: 18,
      batchSteps: 512,
      timeoutMs: 1200000,
      expectedMechanics: 'mlsmpm',
      expectedH2oVisibleSurfaceCount: 1,
      minVisualFrameTimeSpanS: 4.5,
      checkpoints: [
        { id: 'initial', expectation: 'two liquid water cohorts begin near 300 K' },
        { id: 'flow', expectation: 'the falling cohort merges and the liquid free surface moves' },
        { id: 'boil', expectation: 'the 400 K floor produces rising water vapor' },
        { id: 'return', expectation: 'vapor cools near the 200 K ceiling, condenses, and descends' }
      ]
    },
    frameworkValidation: {
      acceptanceTrack: 'framework-liveness',
      batches: 2,
      batchSteps: 128,
      // The bounded framework arm proves that both worker schedules reach the
      // visible native surface. The 4.5 s span above remains exclusive to the
      // scientific water-cycle calibration arm.
      minVisualFrameTimeSpanS: 0.128,
      checkpoints: [
        { id: 'initial', expectation: 'both water cohorts enter the worker-owned spatial hierarchy' },
        { id: 'thermal-active', expectation: 'mechanics, wall thermal transport, and phase-carrier closure execute' },
        { id: 'bounded-terminal', expectation: 'two authenticated schedules advance and present without fallback' }
      ]
    }
  }),
  preset({
    id: 'iron-ice-quench',
    label: 'Molten iron on ice',
    controls: {
      drop: 'fe',
      base: 'h2o',
      dropt: '1850',
      baset: '233.15',
      wymin: '293.15',
      wymax: '293.15',
      // Resolve the same physical 28 mm ice / 16.8 mm iron experiment at
      // twice the legacy linear sampling density.  The reference controls are
      // doubled while sceneLengthScale is halved, so every physical body,
      // wall, initial contact position, density, mass, and temperature is
      // unchanged.  Only the carrier pitch changes (5.6 mm -> 2.8 mm).
      dropn: '6',
      basen: '10',
      boxx: '10',
      boxy: '10',
      boxz: '10',
      ironh: '2',
      // This standard gate is the first production visual route admitted to
      // the exact single-level Schroeder surface-stress lifecycle.
      lawst: '1'
    },
    runtime: {
      // See the controls above: this is an exact spatial refinement, not a
      // miniature substitute for the requested physical experiment.
      sceneLengthScale: '0.014',
      wallModel: 'adiabatic',
      // Surface stress is mechanics-field authoritative. Keep the direct
      // ?scenario=iron-ice-quench route on the canonical spatial authority
      // instead of admitting lawst and then rejecting its first P2G batch.
      ss: '1'
    },
    validation: {
      // The refined initial-rate screen crosses one-carrier vapor demand near
      // 2.19 s, while the resolved front is still melting new carriers at
      // 2.56 s. Retain enough post-onset checkpoints to observe both vapor
      // birth and sustained rise instead of treating the minimum frame span
      // as a phase-transition deadline.
      batches: 16,
      batchSteps: 512,
      // The exact 2x spatial refinement carries 8x as many live carriers.
      // Keep the production proof fail-closed, but allow the memory-capped
      // browser run to finish on the reference Vulkan/WebGPU workstation.
      timeoutMs: 1200000,
      expectedMechanics: 'mlsmpm',
      minVisualFrameTimeSpanS: 2,
      checkpoints: [
        { id: 'initial', expectation: 'a visibly incandescent liquid iron cohort falls toward solid ice' },
        { id: 'impact', expectation: 'contact melts ice into liquid water and produces escaping steam' },
        { id: 'quench', expectation: 'iron emission falls while its solid fraction grows' },
        { id: 'late', expectation: 'steam rises into the headspace while meltwater remains below' }
      ]
    },
    frameworkValidation: {
      acceptanceTrack: 'framework-liveness',
      batches: 2,
      batchSteps: 128,
      // Keep the full 2 s quench horizon on the scientific arm while requiring
      // the bounded framework capture to span both 128-step worker schedules.
      minVisualFrameTimeSpanS: 0.128,
      checkpoints: [
        { id: 'initial', expectation: 'refined iron and ice carriers enter the worker-owned spatial hierarchy' },
        { id: 'surface-stress-active', expectation: 'the exact surface-stress lifecycle submits on every schedule' },
        { id: 'bounded-terminal', expectation: 'two authenticated schedules advance and present without fallback' }
      ]
    }
  }),
  preset({
    id: 'sodium-water',
    label: 'Sodium and water',
    controls: {
      drop: 'Na',
      base: 'h2o',
      dropt: '300',
      baset: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      boxx: '3',
      boxy: '3',
      boxz: '3'
    },
    runtime: {
      // The sodium starts 1 cm above the water. At the stable 1 ms preview
      // step, a 32-step visual batch ends before the ~45 ms free-fall contact
      // time and therefore looks frozen. A 64-step worker batch crosses that
      // contact horizon, drains the shared compute/presentation queue every 16
      // steps, and reaches one authority-admitting terminal drain at the chunk
      // boundary. The former single-fence 128-step default could lose the
      // browser WebGPU device before admission. Explicit URL values still win.
      sdt: '0.001',
      cfl: '0.6',
      cflSafety: '0.4',
      avAlpha: '0',
      // Sodium-water acceptance requires real NaOH/H2 mechanics carriers.
      // The non-SS resident-product sidecar can render/account reaction mass,
      // but it cannot transport an H2 plume. Route the preset through the
      // canonical single-level spatial placement authority by default; an
      // explicit ?ss=0 remains available for degraded-path diagnostics.
      ss: '1',
      // The default product reserve is one quarter of the live population.
      // This 2.56 s canned horizon empirically activates about 0.84 product
      // carriers per initial live particle, so provision one full live cohort
      // while the placement transaction still fails closed at exhaustion.
      reactionProductReserveMinimumLiveFraction: '1',
      residentStepsPerSchedule: '64',
      // Keep the menu preset on the same worker-owned authority route as the
      // standard fixture. `direct` here used to override COMMON_RUNTIME and
      // made this one canned scenario silently exercise the retired page-side
      // continuation path.
      residentComputeManagerMode: 'worker-owned-resident-lane',
      residentInterfaceRefreshMode: 'pipelined',
      // Interactive real-time contact budget, measured on this preset
      // (RTX 5060 Ti / Vulkan, 150 s sustained runs, branch `performance`):
      // 48 cleanup passes with 2 inner rounds per pass sustain 32 steps/s
      // over 4,000+ steps at ~96 effective selection/apply rounds per step
      // — deeper resolution than the 96-pass single-round config, which
      // sustains only 22. The compiled 512-pass budget degrades to ~7
      // steps/s once the reaction saturates the owner. Explicit URL values
      // still win (e.g. ?contactCleanupPasses=512&contactInnerRounds=1
      // restores the archival-quality budget for validation runs).
      contactCleanupPasses: '48',
      contactInnerRounds: '2',
      // Look across the contact band instead of down through the remaining
      // opaque sodium. These values are normalized by the box dimensions, so
      // the real NaOH and H2 product layers stay exposed on desktop and Pixel
      // without moving particles or inflating their rendered surfaces.
      cameraPositionNormalized: '0.78,0.31,1.55',
      cameraTargetNormalized: '0.50,0.31,0.50'
    },
    validation: {
      batches: 10,
      batchSteps: 256,
      timeoutMs: 300000,
      expectedMechanics: 'mlsmpm',
      initialMaxTemperatureK: 300,
      minimumReactionTemperatureRiseK: 50,
      minimumHydrogenRiseM: 0.05,
      expectedMaterialPresent: Object.freeze(['naoh', 'h2']),
      minReactionEventsTotal: 1,
      checkpoints: [
        { id: 'initial', expectation: 'sodium reaches the water surface without reacting at a distance' },
        { id: 'ignition', expectation: 'surface reaction generates heat, hydrogen, and sodium hydroxide' },
        { id: 'plume', expectation: 'hot products expand upward with evolving vapor and smoke color' },
        { id: 'late', expectation: 'reactants and products remain mass-bounded after the violent transient' }
      ]
    },
    frameworkValidation: {
      acceptanceTrack: 'framework-liveness',
      batches: 2,
      batchSteps: 128,
      minVisualFrameTimeSpanS: 0.128,
      checkpoints: [
        { id: 'initial', expectation: 'sodium and water enter the worker-owned spatial hierarchy' },
        { id: 'reaction-active', expectation: 'thermal, reaction-discovery, reaction-product, and carrier stages execute' },
        { id: 'bounded-terminal', expectation: 'two authenticated schedules advance and present without fallback' }
      ]
    }
  }),
  preset({
    id: 'cesium-fluorine',
    label: 'Cesium and fluorine gas',
    controls: {
      drop: 'Cs',
      base: 'F',
      dropn: '5',
      basen: '5',
      dropt: '293.15',
      baset: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      boxx: '4',
      boxy: '4',
      boxz: '4'
    },
    runtime: {
      // Cs/F is deliberately an energetic architecture fixture. Keep the
      // execution CFL below one cell per step, but soften the preview-only
      // modulus cap so the two-level worker route exercises and verifies its
      // real operators instead of immediately rolling the whole step back.
      // Scientific CFL/stiffness convergence remains a later calibration
      // gate; neither value weakens the fail-closed terminal receipt.
      cfl: '0.8',
      cflSafety: '0.2',
      bodies: CESIUM_FLUORINE_TWO_LEVEL_BODIES,
      schroederMaxLevel: '1',
      schroederBaseGridSpacingM:
        String(CESIUM_FLUORINE_TWO_LEVEL_BASE_DX_M),
      schroederTwoLevel: '1',
      schroederTwoLevelAuthority: 'authoritative',
      schroederTwoLevelSubsteps: '2',
      // Generic coupling candidates are observation-only. Authoritative
      // adjacent-level communication uses paired fields + terminal reflux.
      schroederCrossLevelCoupling: '0',
      schroederMechanicsFieldPairV2: '1'
    },
    validation: {
      batches: 10,
      batchSteps: 256,
      timeoutMs: 300000,
      expectedMechanics: 'mlsmpm',
      initialMaxTemperatureK: 293.15,
      minimumReactionTemperatureRiseK: 500,
      expectedMaterialPresent: Object.freeze(['csf']),
      minReactionEventsTotal: 1,
      checkpoints: [
        { id: 'initial', expectation: 'cesium falls into a visible fluorine gas volume' },
        { id: 'ignition', expectation: 'contact produces an immediate exothermic CsF reaction front' },
        { id: 'runaway', expectation: 'radiation and conduction spread heat beyond the first contact layer' },
        { id: 'late', expectation: 'the hot product cloud cools without losing mass or leaving frozen rows' }
      ]
    },
    frameworkValidation: {
      // This bounded arm owns refactor/framework acceptance: it reaches real
      // CsF creation, melting, cooling, two-level continuation, terminal
      // reflux admission, StateManager commit, and worker presentation. The
      // longer validation horizon above remains a separate fail-closed
      // scientific-calibration diagnostic until its energetic mechanics are
      // calibrated; it is not silently weakened or treated as passing.
      acceptanceTrack: 'framework-liveness',
      batches: 2,
      batchSteps: 128,
      minVisualFrameTimeSpanS: 0.128,
      checkpoints: [
        { id: 'initial', expectation: 'cesium and fluorine populate the declared adjacent mechanics levels' },
        { id: 'reaction-active', expectation: 'the exact worker route creates and advects hot CsF products' },
        { id: 'bounded-terminal', expectation: 'two terminal reflux receipts commit and present advancing state' }
      ]
    }
  }),
  preset({
    id: 'bulk-water',
    label: 'Bulk water - adaptive-laws Tier 0 substrate',
    // The bulk substrate's acceptance gate is the Phase-A performance
    // criterion (plan/todo/scale-adaptive-law-activation-plan.md): N-vs-
    // steps/s on the worker lane. It is a laws-quiescent scenario, so the
    // standard visual-liveness contract (resident diagnostics, thermal/
    // reaction milestones) does not apply and it stays out of the
    // standard matrix and the release receipt until that gate exists.
    standardMatrixEnabled: false,
    controls: {
      drop: 'h2o',
      base: 'h2o',
      dropt: '293.15',
      baset: '293.15',
      // Live particle count scales as dropn^3 + basen^3 at the fixed body
      // pitch; basen=32 seeds 32,769+8 live particles and the phase-carrier
      // lane topology multiplies capacity by 4. Raise basen (and the box)
      // for the 100k-live acceptance runs: basen=47 -> 103,824 live.
      dropn: '2',
      basen: '32',
      // The drop bottom rides the ironh height control; 9.6 m clears the
      // base cube's top at every supported basen (9.4 m at basen=47), so
      // the initial-geometry preflight never sees an overlap.
      ironh: '9.6',
      // Box must contain the base cube: edge = 0.2 m x basen (9.4 m at
      // basen=47), plus headroom for the settle splash.
      boxx: '12',
      boxy: '12',
      boxz: '12',
      // Adaptive-laws Tier 0: the bulk substrate runs mechanics, gravity,
      // EOS, and viscosity only. No thermal table, no reactions (single
      // material also makes the reaction set empty), no surface tension.
      lawt: '0',
      lawr: '0',
      lawst: '0',
      // The pressure-interface law's force rows would block the fused
      // mechanics path; bulk water's free surface is owned by the MPM
      // grid + EOS + separation.
      lawp: '0'
    },
    runtime: {
      sdt: '0.001',
      cfl: '0.6',
      cflSafety: '0.4',
      avAlpha: '0',
      // Vacuum ambient: with ambient pressure zero, ambient gas buoyancy is
      // legitimately zero force, which also admits the fused mechanics path.
      ambientPressurePa: '0',
      ss: '1',
      // KNOWN GAP (2026-08-28): contactSolver=0 hangs worker admission at
      // "submitting initial material state" — the canonical lane cannot yet
      // run contact-free. Tier 0 wants the solver off; until that gap is
      // fixed, run it at the floor budget and let the convergence latch
      // idle it (bulk same-material water resolves proximity via the MPM
      // grid and the binned separation passes).
      contactSolver: '1',
      contactCleanupPasses: '16',
      // Single material -> the reserve term multiplier is already zero;
      // declare the intent explicitly anyway.
      reactionProductReserveMinimumLiveFraction: '0',
      // M4 submit burst: hold command buffers and flush one queue.submit
      // per K steps. Worker-derived eligibility (law-activation receipt: all
      // law families quiescent) gates it; measured 2026-08-28 on this lane:
      // +7% steps/s at 1k-13.8k, +3% at 32.8k (this preset's default N),
      // -7% at 104k (inter-schedule turnaround grows; documented in the
      // plan). Raise basen past ~64k and this knob is worth turning off.
      submitBurstSteps: '8',
      residentStepsPerSchedule: '64',
      residentComputeManagerMode: 'worker-owned-resident-lane',
      residentInterfaceRefreshMode: 'pipelined',
      // Tier-0 sparsity: no law consumes neighbor candidates in bulk water
      // (reaction table empty, contact latch idle, no thermal), and no phase
      // change exists without a thermal table, so the law-queue/neighbor
      // expander (measured 101.8 ms/step at 55k carriers - the
      // quadratic-in-active-nodes bucket-miss fallback) and phase-volume
      // migration (9.5 ms/step) encode nothing but waste here.
      schroederLawQueue: '0',
      schroederLawNeighborCandidates: '0',
      schroederPhaseVolumeMigration: '0',
      // With the neighbor expander off, the sorted-radix active-node index
      // has no consumer (10+ ms/step of pure build cost at bulk N).
      schroederActiveNodeSortedIndex: '0',
      cameraPositionNormalized: '0.80,0.45,1.60',
      cameraTargetNormalized: '0.50,0.30,0.50'
    },
    validation: {
      batches: 2,
      batchSteps: 128,
      timeoutMs: 300000,
      expectedMechanics: 'mlsmpm',
      initialMaxTemperatureK: 294,
      checkpoints: [
        { id: 'settle', expectation: 'the water block settles under gravity without instability' },
        { id: 'bounded-terminal', expectation: 'terminal reflux receipts commit and present advancing state' }
      ]
    }
  })
]);

const PRESET_BY_ID = new Map(SPH_PHASE_SCENARIO_PRESETS.map((entry) => [entry.id, entry]));

export function sphPhaseScenarioPresetById(id) {
  return PRESET_BY_ID.get(String(id || '').trim()) || null;
}

export function sphPhaseScenarioPresetUrl(id, extraParams = {}) {
  const entry = sphPhaseScenarioPresetById(id);
  if (!entry) return null;
  const params = new URLSearchParams({
    scenario: entry.id,
    ...entry.controls,
    ...entry.runtime,
    ...extraParams
  });
  return `/?${params.toString()}`;
}
