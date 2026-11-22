import {
  dyadicLevelSpanOrdersOfMagnitude,
  dyadicScaleSpacingM,
  splitFloat64ToDoubleFloat
} from '../../../ulg-gpu-abi/src/index.js';
import { createDynamicSchroederScaleAtlasRuntime } from './schroederSpatialScaleAtlasRuntime.js';
import { canonicalSimulationMethodKey } from '../simulationModuleRegistry.js';

export const ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA =
  'peercompute.ulg.cosmic-quantum-scale-bridge.v1';

/**
 * Canonical 6-regime scale ladder spanning 38+ orders of magnitude
 * (`10^-11 m` Bohr orbital scale through `10^27 m` observable-universe
 * comoving headroom), fitting natively inside Schroeder's dyadic scale atlas
 * (`L in [-64, +96]`, > 48 OOM).
 */
export const COSMIC_QUANTUM_SCALE_REGIMES = Object.freeze([
  Object.freeze({
    id: 'atomic-orbital',
    label: 'Atomic / Orbital (Schrödinger KS-DFT)',
    globalBaseLevel: -37, // 2^-37 ≈ 7.28e-12 m
    log10MinM: -11.5,
    log10MaxM: -9.5,
    moduleMethod: Object.freeze({ model: 'quantum-material-derivation', version: 1 }),
    comoving: false
  }),
  Object.freeze({
    id: 'molecular-lattice',
    label: 'Molecular / Lattice (6-31G(d) UMP2 + QHA)',
    globalBaseLevel: -30, // 2^-30 ≈ 9.31e-10 m
    log10MinM: -9.5,
    log10MaxM: -6.5,
    moduleMethod: Object.freeze({ model: 'quantum-material-derivation', version: 1 }),
    comoving: false
  }),
  Object.freeze({
    id: 'continuum-sph-solids',
    label: 'Continuum / Lab Matter (Schroeder MLS-MPM + Solids)',
    globalBaseLevel: 0, // 2^0 = 1.0 m
    log10MinM: -6.5,
    log10MaxM: 4.0,
    moduleMethod: Object.freeze({ model: 'sph-mlsmpm-continuum', version: 1 }),
    comoving: false
  }),
  Object.freeze({
    id: 'planetary-orbital',
    label: 'Planetary / Stellar Orbital',
    globalBaseLevel: 33, // 2^33 ≈ 8.59e9 m
    log10MinM: 4.0,
    log10MaxM: 14.5,
    moduleMethod: Object.freeze({ model: 'nbody-gravity', version: 1 }),
    comoving: false
  }),
  Object.freeze({
    id: 'galactic-nbody',
    label: 'Galactic N-Body (Eshkol Barnes–Hut)',
    globalBaseLevel: 70, // 2^70 ≈ 1.18e21 m (~125 kly)
    log10MinM: 14.5,
    log10MaxM: 22.5,
    moduleMethod: Object.freeze({ model: 'nbody-gravity', version: 1 }),
    comoving: false
  }),
  Object.freeze({
    id: 'supergalactic-cosmic',
    label: 'Supergalactic / Observable Universe Headroom',
    globalBaseLevel: 90, // 2^90 ≈ 1.24e27 m (~131 Gly, observable universe ~8.8e26 m)
    log10MinM: 22.5,
    log10MaxM: 27.5,
    moduleMethod: Object.freeze({ model: 'cosmology-comoving-nbody', version: 1 }),
    comoving: true
  })
]);

/**
 * Create a continuous-zoom cosmic-to-quantum scale bridge backed by ULG's
 * 40+ OOM `SchroederScaleAtlas` runtime. Computes exact double-float
 * floating-origin camera transforms and smooth portal transitions across all
 * 6 scale regimes without Float32 precision loss.
 */
export function createCosmicQuantumScaleBridge({
  referenceSpacingM = 1.0,
  cosmology = { scaleFactorA: 1.0, hubbleH0KmPerSPerMpc: 67.4, omegaMatter: 0.315, omegaLambda: 0.685 },
  portalBlendHalfWidthDecades = 0.65,
  moduleRegistry = null
} = {}) {
  const atlasRuntime = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM,
    rootGlobalBaseLevel: 0,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2,
    rootLabel: 'continuum-sph-solids',
    maxActiveCharts: 32
  });

  const chartByRegimeId = new Map();
  chartByRegimeId.set('continuum-sph-solids', 0);

  for (const regime of COSMIC_QUANTUM_SCALE_REGIMES) {
    if (regime.id === 'continuum-sph-solids') continue;
    const ensured = atlasRuntime.ensureChartForScaleLevel({
      targetGlobalLevel: regime.globalBaseLevel,
      parentChartId: 0,
      originInParentUnits: [0, 0, 0],
      localSpanLevels: 3,
      forceNew: true,
      label: regime.id
    });
    chartByRegimeId.set(regime.id, ensured.chartId);
  }

  const atlasPlan = atlasRuntime.snapshotAtlas();
  const minLog10 = COSMIC_QUANTUM_SCALE_REGIMES[0].log10MinM;
  const maxLog10 = COSMIC_QUANTUM_SCALE_REGIMES[COSMIC_QUANTUM_SCALE_REGIMES.length - 1].log10MaxM;

  function hubbleParameterPerS(a = cosmology.scaleFactorA) {
    const aClamped = Math.max(1e-6, Number(a) || 1.0);
    const mpcM = 3.085677581491367e22;
    const h0PerS = (Number(cosmology.hubbleH0KmPerSPerMpc || 67.4) * 1000) / mpcM;
    const om = Number(cosmology.omegaMatter ?? 0.315);
    const ol = Number(cosmology.omegaLambda ?? 0.685);
    return h0PerS * Math.sqrt(om / (aClamped ** 3) + ol);
  }

  function evaluateContinuousZoomCamera(log10ViewSpanM, {
    focusWorldChartLocalF64 = [0, 0, 0],
    cameraOffsetNormalized = [0, 0.35, 1.4],
    comovingScaleFactorA = cosmology.scaleFactorA
  } = {}) {
    const s = Math.max(minLog10, Math.min(maxLog10, Number(log10ViewSpanM) || 0));
    const viewSpanM = 10 ** s;

    let primaryIdx = COSMIC_QUANTUM_SCALE_REGIMES.length - 1;
    for (let i = 0; i < COSMIC_QUANTUM_SCALE_REGIMES.length; i += 1) {
      const r = COSMIC_QUANTUM_SCALE_REGIMES[i];
      if (s >= r.log10MinM && s <= r.log10MaxM) {
        primaryIdx = i;
        break;
      }
    }
    const primary = COSMIC_QUANTUM_SCALE_REGIMES[primaryIdx];
    const primaryChartId = chartByRegimeId.get(primary.id);
    const primarySpacingM = dyadicScaleSpacingM(primary.globalBaseLevel, referenceSpacingM);

    // Smooth cross-fade portal weight when approaching an adjacent regime boundary.
    let secondary = null;
    let portalAlpha = 0;
    const bw = Math.max(0.05, Number(portalBlendHalfWidthDecades) || 0.65);
    if (primaryIdx > 0 && (s - primary.log10MinM) < bw) {
      secondary = COSMIC_QUANTUM_SCALE_REGIMES[primaryIdx - 1];
      portalAlpha = 0.5 * (1 - (s - primary.log10MinM) / bw);
    } else if (primaryIdx < COSMIC_QUANTUM_SCALE_REGIMES.length - 1 && (primary.log10MaxM - s) < bw) {
      secondary = COSMIC_QUANTUM_SCALE_REGIMES[primaryIdx + 1];
      portalAlpha = 0.5 * (1 - (primary.log10MaxM - s) / bw);
    }

    // Floating-origin camera coordinates expressed in active-chart units (O(1) magnitude -> zero f32 jitter!).
    const spanInChartUnits = viewSpanM / primarySpacingM;
    const camPosLocalF64 = [
      focusWorldChartLocalF64[0] + cameraOffsetNormalized[0] * spanInChartUnits,
      focusWorldChartLocalF64[1] + cameraOffsetNormalized[1] * spanInChartUnits,
      focusWorldChartLocalF64[2] + cameraOffsetNormalized[2] * spanInChartUnits
    ];
    const [cxHi, cxLo] = splitFloat64ToDoubleFloat(camPosLocalF64[0]);
    const [cyHi, cyLo] = splitFloat64ToDoubleFloat(camPosLocalF64[1]);
    const [czHi, czLo] = splitFloat64ToDoubleFloat(camPosLocalF64[2]);

    const primaryMethodKey = canonicalSimulationMethodKey(primary.moduleMethod);
    const secondaryMethodKey = secondary ? canonicalSimulationMethodKey(secondary.moduleMethod) : null;

    return Object.freeze({
      schema: ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA,
      log10ViewSpanM: s,
      viewSpanM,
      primaryRegime: primary,
      primaryChartId,
      primarySpacingM,
      primaryMethodKey,
      primaryModuleRegistered: moduleRegistry ? moduleRegistry.hasModule(primary.moduleMethod) : null,
      secondaryRegime: secondary,
      secondaryChartId: secondary ? chartByRegimeId.get(secondary.id) : null,
      secondaryMethodKey,
      portalBlendAlpha: portalAlpha,
      floatingOriginCamera: Object.freeze({
        chartId: primaryChartId,
        spanInChartUnits,
        cameraPosHi: Object.freeze([cxHi, cyHi, czHi]),
        cameraPosLo: Object.freeze([cxLo, cyLo, czLo]),
        focusOffsetNormalized: Object.freeze([0, 0, 0]),
        nearClipChartUnits: Math.max(1e-5, spanInChartUnits * 1e-4),
        farClipChartUnits: spanInChartUnits * 1e3
      }),
      cosmologyFrame: primary.comoving
        ? Object.freeze({
          comoving: true,
          scaleFactorA: Number(comovingScaleFactorA) || 1.0,
          hubbleParameterPerS: hubbleParameterPerS(comovingScaleFactorA)
        })
        : Object.freeze({ comoving: false, scaleFactorA: 1.0, hubbleParameterPerS: 0 })
    });
  }

  function summary() {
    const atlasSummary = atlasRuntime.summary();
    return Object.freeze({
      schema: ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA,
      regimeCount: COSMIC_QUANTUM_SCALE_REGIMES.length,
      minLog10M: minLog10,
      maxLog10M: maxLog10,
      totalSpanOrdersOfMagnitude: dyadicLevelSpanOrdersOfMagnitude(
        atlasSummary.globalMinLevel,
        atlasSummary.globalMaxLevel
      ),
      activeChartCount: atlasSummary.activeChartCount,
      globalMinLevel: atlasSummary.globalMinLevel,
      globalMaxLevel: atlasSummary.globalMaxLevel,
      chartByRegimeId: Object.freeze(Object.fromEntries(chartByRegimeId.entries()))
    });
  }

  return Object.freeze({
    schema: ULG_COSMIC_QUANTUM_SCALE_BRIDGE_SCHEMA,
    atlasRuntime,
    atlasPlan,
    regimes: COSMIC_QUANTUM_SCALE_REGIMES,
    evaluateContinuousZoomCamera,
    summary
  });
}
