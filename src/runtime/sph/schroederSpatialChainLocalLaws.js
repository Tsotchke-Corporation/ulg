// These laws run on the published native velocities, inside the existing
// heat/pressure receipt lifecycle. Gravity and wall/contact forces have
// already run on the composite and are deliberately not inputs here.
const defaults = Object.freeze({
  mechanicsMaterialTable: null,
  mechanicsMaterialPhaseUpload: null,
  ambientPressurePa: 0,
  phaseVolumeInterfaceTransportRequired: false,
  phaseVolumePressureScale: 1,
  phaseVolumeDragScale: 1,
  phaseVolumeMaxImpulseFraction: 0.5,
  gasPressureMechanicsScale: 1,
  gasPressureMechanicsAuthoritySource: null,
  gasPressureMechanicsChartId: 0
});

export function snapshotSchroederChainLocalLaws(inputs = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)
      || Reflect.ownKeys(inputs).some(key => !Object.hasOwn(defaults, key))) {
    throw new TypeError('Chain local laws accept only explicitly composed native law inputs');
  }
  const result = { ...defaults, ...inputs };
  for (const key of ['ambientPressurePa', 'gasPressureMechanicsScale',
    'phaseVolumePressureScale', 'phaseVolumeDragScale', 'phaseVolumeMaxImpulseFraction']) {
    if (typeof result[key] !== 'number' || !Number.isFinite(result[key]) || result[key] < 0) {
      throw new TypeError(`Chain local law ${key} must be finite and nonnegative`);
    }
  }
  if (typeof result.phaseVolumeInterfaceTransportRequired !== 'boolean') {
    throw new TypeError('Chain native transport requires an explicit boolean');
  }
  if (!Number.isSafeInteger(result.gasPressureMechanicsChartId)
      || result.gasPressureMechanicsChartId < 0) {
    throw new TypeError('Chain local laws require an exact chart identifier');
  }
  return Object.freeze(result);
}

export function schroederChainLocalLawsMatch(expected, actual) {
  return expected != null && Object.keys(defaults).every(key => Object.is(expected[key], actual[key]));
}
