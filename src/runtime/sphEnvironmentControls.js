import { createSphRoomAirInitialization } from './sphEnvironmentInitialization.js';

export const SPH_ENVIRONMENT_CONTROL_DEFAULTS = Object.freeze({
  environmentMode: 'vacuum', environmentTemperatureK: '293.15',
  environmentPressurePa: '101325', environmentHumidityPercent: '50', environmentCellsPerAxis: '2',
  environmentNucleiPerCm3: '0',
  // First-class air (graded seeding): blank keeps uniform coarse cells.
  environmentRefineEdgeMm: '',
  // First-class air, slice 3: 'mixture' seeds one mixture parcel per cell
  // (exact composition carried, default); 'species' seeds one row per dry-air species.
  environmentAirParcels: 'mixture'
});

// Benchmark dry nuclei for the G2 integer-ledger vapor-parcel exchange: an
// ammonium-sulfate accumulation mode in three dry-radius bins. This is a
// chosen benchmark, not a measurement (Seinfeld & Pandis 2016, ch. 8;
// kappa = 0.61 from Petters & Kreidenweis 2007).
export const SPH_ENVIRONMENT_BENCHMARK_NUCLEI_SEED = Object.freeze({
  material: 'ammonium-sulfate', densityKgPerM3: 1770,
  sizeDistribution: Object.freeze([
    Object.freeze({ dryRadiusM: 2.5e-8, numberFraction: 0.3 }),
    Object.freeze({ dryRadiusM: 5e-8, numberFraction: 0.5 }),
    Object.freeze({ dryRadiusM: 1e-7, numberFraction: 0.2 })]),
  initialHydration: 'dry',
  activationModel: Object.freeze({ id: 'kappa-koehler-maxwell-mason', hygroscopicity: 0.61,
    provenance: 'kappa-Koehler (Petters & Kreidenweis 2007) with Maxwell-Mason growth and a Fuchs-Sutugin correction',
    minTemperatureK: 200, maxTemperatureK: 420, minRelativeHumidity: 0, maxRelativeHumidity: 1 }),
  provenance: 'Benchmark ammonium-sulfate accumulation mode (Seinfeld & Pandis 2016); not a measurement'
});

// Keep malformed values malformed so the shared worker-side physical-input
// validator reports them. In particular, blank input must not turn into zero.
export function sphEnvironmentOptionsFromControls(values) {
  const numeric = key => typeof values[key] === 'string' && values[key].trim() === '' ? NaN : Number(values[key]);
  const vacuum = values.environmentMode === 'vacuum';
  const nucleiPerCm3 = vacuum ? 0 : (values.environmentNucleiPerCm3 == null ? 0 : numeric('environmentNucleiPerCm3'));
  return { environment: { ...createSphRoomAirInitialization(), mode: values.environmentMode,
    temperatureK: numeric('environmentTemperatureK'),
    totalPressurePa: vacuum ? 0 : numeric('environmentPressurePa'),
    relativeHumidity: vacuum ? 0 : numeric('environmentHumidityPercent') / 100,
    nuclei: nucleiPerCm3 > 0
      ? { numberConcentrationPerM3: nucleiPerCm3 * 1e6, seed: SPH_ENVIRONMENT_BENCHMARK_NUCLEI_SEED }
      : { numberConcentrationPerM3: Number.isFinite(nucleiPerCm3) ? 0 : nucleiPerCm3, seed: null },
    provenance: nucleiPerCm3 > 0
      ? 'User-selected physical atmosphere with benchmark dry nuclei; initially zero mean flow.'
      : 'User-selected physical atmosphere; initially zero mean flow and zero dry nuclei.' },
  environmentCellsPerAxis: numeric('environmentCellsPerAxis'),
  environmentRefineEdgeM: values.environmentRefineEdgeMm == null
    || String(values.environmentRefineEdgeMm).trim() === ''
    ? null
    : numeric('environmentRefineEdgeMm') / 1000,
  environmentAirParcels: values.environmentAirParcels == null || values.environmentAirParcels === ''
    ? 'mixture'
    : String(values.environmentAirParcels) };
}
