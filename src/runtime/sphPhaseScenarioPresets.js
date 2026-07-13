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

function preset({ id, label, controls, runtime, validation }) {
  return Object.freeze({
    schema: SPH_PHASE_SCENARIO_PRESET_SCHEMA,
    id,
    label,
    controls: Object.freeze({ ...COMMON_CONTROLS, ...controls }),
    runtime: Object.freeze({ ...(runtime || {}) }),
    validation: Object.freeze({
      ...validation,
      checkpoints: Object.freeze((validation?.checkpoints || []).map((checkpoint) => (
        Object.freeze({ ...checkpoint })
      )))
    })
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
      batches: 12,
      batchSteps: 512,
      timeoutMs: 420000,
      expectedMechanics: 'mlsmpm',
      expectedH2oVisibleSurfaceCount: 1,
      minVisualFrameTimeSpanS: 3,
      checkpoints: [
        { id: 'initial', expectation: 'two liquid water cohorts begin near 300 K' },
        { id: 'flow', expectation: 'the falling cohort merges and the liquid free surface moves' },
        { id: 'boil', expectation: 'the 400 K floor produces rising water vapor' },
        { id: 'return', expectation: 'vapor cools near the 200 K ceiling, condenses, and descends' }
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
      ironh: '2.5'
    },
    validation: {
      batches: 10,
      batchSteps: 512,
      timeoutMs: 360000,
      expectedMechanics: 'mlsmpm',
      minVisualFrameTimeSpanS: 2,
      checkpoints: [
        { id: 'initial', expectation: 'a visibly incandescent liquid iron cohort falls toward solid ice' },
        { id: 'impact', expectation: 'contact melts ice into liquid water and produces escaping steam' },
        { id: 'quench', expectation: 'iron emission falls while its solid fraction grows' },
        { id: 'late', expectation: 'steam rises into the headspace while meltwater remains below' }
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
      // time and therefore looks frozen. Amortize the resident submission and
      // present 128 ms per completed batch so the first visible continuation
      // contains real contact-driven motion. Explicit URL values still win.
      sdt: '0.001',
      cfl: '0.6',
      cflSafety: '0.4',
      avAlpha: '0',
      residentStepsPerSchedule: '128',
      residentComputeManagerMode: 'direct',
      residentInterfaceRefreshMode: 'pipelined'
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
    }
  }),
  preset({
    id: 'cesium-fluorine',
    label: 'Cesium and fluorine gas',
    controls: {
      drop: 'Cs',
      base: 'F',
      dropt: '293.15',
      baset: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      boxx: '4',
      boxy: '4',
      boxz: '4'
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
