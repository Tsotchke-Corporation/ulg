import { SPH_ENVIRONMENT_CONTROL_DEFAULTS } from './sphEnvironmentControls.js';
import {
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyDropBase
} from './sphInitialBodies.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW
} from './sph/schroederDynamicLawRoutingContract.js';

export const SPH_PHASE_SCENARIO_PRESET_SCHEMA =
  'peercompute.ulg.sph-phase-scenario-preset.v0';

const COMMON_CONTROLS = Object.freeze({
  ...SPH_ENVIRONMENT_CONTROL_DEFAULTS,
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

// All presets share one normalized worker-owned Schroeder Spatial (SS) + GPU
// marching-cubes isosurface + participating-medium rendering pipeline.
const COMMON_RUNTIME = Object.freeze({
  reactionActivationPolicy: SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW,
  renderer: 'native-webgpu',
  surfaceDraw: 'native-webgpu-surface-consumer',
  surfaceOverlay: '0',
  renderOwnership: 'worker-owned-resident-render-producer',
  workerOffscreenPresentation: '1',
  workerParticleOverlay: '0',
  workerLivePreview: '0',
  residentWorkers: '1',
  residentComputeManagerMode: 'worker-owned-resident-lane',
  residentStepsPerSchedule: '16',
  submitBurstSteps: '4',
  thermalPotential: '1',
  rigidSolids: '1',
  contactSolver: '1',
  contactCleanupPasses: '16',
  contactInnerRounds: '1',
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

// Halved container [2, 2, 2] m and compact 3x3x3 bodies preserving exact
// cross-body pitch ratio (0.20 m / 0.12 m = 1.67) and fine support radius.
const CESIUM_FLUORINE_TWO_LEVEL_BODIES = serializeSphInitialBodies(
  sphInitialBodiesFromLegacyDropBase({
    baseMaterial: 'F',
    dropMaterial: 'Cs',
    baseSizeM: [0.6, 0.6, 0.6],
    dropSizeM: [0.36, 0.36, 0.36],
    baseCenterM: [1, 0.3, 1],
    dropCenterM: [1, 0.79, 1],
    baseTemperatureK: 293.15,
    dropTemperatureK: 293.15,
    baseParticlesPerEdge: [3, 3, 3],
    dropParticlesPerEdge: [3, 3, 3]
  })
);
const CESIUM_FLUORINE_FINE_SUPPORT_RADIUS_M = Math.cbrt(
  (3 * (0.36 / 3) ** 3) / (4 * Math.PI)
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
  summary = '',
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
    summary,
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
    label: 'Water cycle',
    summary: '400 K heated floor and 200 K chilled ceiling drive boiling, buoyant steam ascent, ceiling condensation, and return.',
    controls: {
      drop: 'h2o',
      base: 'h2o',
      dropt: '300',
      baset: '300',
      dropn: '3',
      basen: '5',
      ironh: '1.01',
      boxx: '5',
      boxy: '5',
      boxz: '5',
      wxmin: '300',
      wxmax: '300',
      wymin: '400',
      wymax: '200',
      wzmin: '300',
      wzmax: '300'
    },
    runtime: {
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
      wallModel: 'infinite-fixed-temperature-reservoir',
      cameraPositionNormalized: '0.80,0.44,1.60',
      cameraTargetNormalized: '0.50,0.34,0.50'
    },
    validation: {
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
    summary: 'Incandescent 1850 K liquid iron quenches onto -40 °C rigid ice with melting isosurfaces and volumetric steam.',
    controls: {
      drop: 'fe',
      base: 'h2o',
      dropt: '1850',
      baset: '233.15',
      wymin: '293.15',
      wymax: '293.15',
      // Full physical 28 mm ice (10x10x10) and 16.8 mm molten iron (6x6x6)
      // inside a 140 mm container at 2.8 mm thermal/hydrodynamic pitch so
      // quenching sustains melting and continuous billowing steam plumes.
      dropn: '6',
      basen: '10',
      boxx: '10',
      boxy: '10',
      boxz: '10',
      ironh: '2',
      lawst: '1'
    },
    runtime: {
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
      sceneLengthScale: '0.014',
      wallModel: 'adiabatic',
      ss: '1',
      reactionProductReserveExactDiscovery: '1',
      contactCleanupPasses: '16',
      contactInnerRounds: '1',
      cameraPositionNormalized: '0.78,0.46,1.55',
      cameraTargetNormalized: '0.50,0.34,0.50'
    },
    validation: {
      batches: 16,
      batchSteps: 512,
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
      minVisualFrameTimeSpanS: 0.128,
      checkpoints: [
        { id: 'initial', expectation: 'iron and ice carriers enter the worker-owned spatial hierarchy' },
        { id: 'surface-stress-active', expectation: 'the exact surface-stress lifecycle submits on every schedule' },
        { id: 'bounded-terminal', expectation: 'two authenticated schedules advance and present without fallback' }
      ]
    }
  }),
  preset({
    id: 'sodium-water',
    label: 'Sodium and water',
    summary: 'Alkali metal meets liquid water: first-principles reaction discovery, incandescent NaOH/H2, caustic smoke, and rising steam.',
    controls: {
      drop: 'Na',
      base: 'h2o',
      dropt: '300',
      baset: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      // Full 3 m basin with 5x5x5 water (1.0 m) and 3x3x3 sodium (0.6 m)
      // starting with a 0.2 m separation gap (bottom at 1.2 m, center at 1.5 m)
      // and 152 spare reaction-product slots so the reaction stays active and
      // sustains rising caustic smoke and steam plumes.
      dropn: '3',
      basen: '5',
      ironh: '1.2',
      boxx: '3',
      boxy: '3',
      boxz: '3'
    },
    runtime: {
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
      sdt: '0.001',
      cfl: '0.6',
      cflSafety: '0.4',
      avAlpha: '0',
      ss: '1',
      reactionProductReserveMinimumLiveFraction: '1',
      residentStepsPerSchedule: '64',
      residentComputeManagerMode: 'worker-owned-resident-lane',
      residentInterfaceRefreshMode: 'pipelined',
      contactCleanupPasses: '16',
      contactInnerRounds: '1',
      cameraPositionNormalized: '0.78,0.38,1.55',
      cameraTargetNormalized: '0.50,0.34,0.50'
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
    summary: 'Energetic alkali-halogen reaction on an authoritative two-level Schroeder Spatial hierarchy with hot CsF plume expansion.',
    controls: {
      drop: 'Cs',
      base: 'F',
      dropn: '3',
      basen: '3',
      dropt: '293.15',
      baset: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      boxx: '2',
      boxy: '2',
      boxz: '2'
    },
    runtime: {
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
      sdt: '0.0002',
      cfl: '0.8',
      cflSafety: '0.2',
      bodies: CESIUM_FLUORINE_TWO_LEVEL_BODIES,
      schroederMaxLevel: '1',
      schroederBaseGridSpacingM:
        String(CESIUM_FLUORINE_TWO_LEVEL_BASE_DX_M),
      schroederTwoLevel: '1',
      schroederTwoLevelAuthority: 'authoritative',
      schroederTwoLevelSubsteps: '2',
      schroederCrossLevelCoupling: '0',
      schroederMechanicsFieldPairV2: '1',
      cameraPositionNormalized: '0.80,0.44,1.60',
      cameraTargetNormalized: '0.50,0.34,0.50'
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
    id: 'water-realtime',
    label: 'Water dam break',
    summary: 'Real-time semi-implicit MLS-MPM liquid collapse and splash rendered through the unified GPU marching-cubes isosurface.',
    standardMatrixEnabled: false,
    controls: {
      drop: 'h2o',
      base: 'h2o',
      dropt: '293.15',
      baset: '293.15',
      // Halved per-edge resolution (16^3 + 8^3 = 4,608 particles) inside a
      // halved 6 m container, preserving the exact 0.2 m pitch.
      dropn: '8',
      basen: '16',
      ironh: '4.2',
      boxx: '6',
      boxy: '6',
      boxz: '6',
      lawt: '0',
      lawr: '0',
      lawst: '0',
      lawp: '0'
    },
    runtime: {
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
      sdt: '0.008',
      implicitPressure: '1',
      implicitCfl: '3',
      realtimePacing: '1',
      cfl: '0.6',
      cflSafety: '0.4',
      avAlpha: '0',
      ambientPressurePa: '0',
      ss: '1',
      contactSolver: '0',
      compactMechanicsView: '0',
      reactionProductReserveMinimumLiveFraction: '0',
      submitBurstSteps: '4',
      // Use the unified GPU marching-cubes isosurface pipeline like every
      // other preset (workerLivePreview=1 would disable true isosurfaces).
      workerLivePreview: '0',
      residentStepsPerSchedule: '64',
      residentComputeManagerMode: 'worker-owned-resident-lane',
      residentInterfaceRefreshMode: 'pipelined',
      schroederLawQueue: '0',
      schroederLawNeighborCandidates: '0',
      schroederPhaseVolumeMigration: '0',
      schroederActiveNodeSortedIndex: '0',
      cameraPositionNormalized: '0.80,0.45,1.60',
      cameraTargetNormalized: '0.50,0.32,0.50'
    },
    validation: {
      batches: 2,
      batchSteps: 128,
      timeoutMs: 300000,
      expectedMechanics: 'mlsmpm',
      initialMaxTemperatureK: 294,
      checkpoints: [
        { id: 'collapse', expectation: 'the water block collapses into a pool instead of standing rigid' },
        { id: 'splash', expectation: 'the falling drop visibly disturbs the pool surface' }
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
