import { createSphRoomAirInitialization } from './sphEnvironmentInitialization.js';

export const SPH_ENVIRONMENT_CONTROL_DEFAULTS = Object.freeze({
  environmentMode: 'vacuum', environmentTemperatureK: '293.15',
  environmentPressurePa: '101325', environmentHumidityPercent: '50', environmentCellsPerAxis: '2'
});

// Keep malformed values malformed so the shared worker-side physical-input
// validator reports them. In particular, blank input must not turn into zero.
export function sphEnvironmentOptionsFromControls(values) {
  const numeric = key => typeof values[key] === 'string' && values[key].trim() === '' ? NaN : Number(values[key]);
  const vacuum = values.environmentMode === 'vacuum';
  return { environment: { ...createSphRoomAirInitialization(), mode: values.environmentMode,
    temperatureK: numeric('environmentTemperatureK'),
    totalPressurePa: vacuum ? 0 : numeric('environmentPressurePa'),
    relativeHumidity: vacuum ? 0 : numeric('environmentHumidityPercent') / 100,
    provenance: 'User-selected physical atmosphere; initially zero mean flow and zero dry nuclei.' },
  environmentCellsPerAxis: numeric('environmentCellsPerAxis') };
}
