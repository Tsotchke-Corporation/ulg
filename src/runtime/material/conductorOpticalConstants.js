import conductorOpticalConstantsBank from '../../../data/material-properties/conductor-optical-constants.json' with { type: 'json' };

export const CONDUCTOR_OPTICAL_CONSTANTS_BANK = conductorOpticalConstantsBank;

function canonicalSymbol(material) {
  const raw = String(material || '');
  return raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : '';
}

const RECORDS_BY_SYMBOL = new Map(
  (conductorOpticalConstantsBank.records || []).map((record) => [record.symbol, record])
);

export function conductorOpticalConstantsRecord(material) {
  return RECORDS_BY_SYMBOL.get(canonicalSymbol(material)) || null;
}

function interpolate(values, energies, photonEnergyEv) {
  const energy = Number(photonEnergyEv);
  if (!Number.isFinite(energy) || values.length !== energies.length || energies.length === 0) return null;
  if (energy <= energies[0]) return values[0];
  const last = energies.length - 1;
  if (energy >= energies[last]) return values[last];
  for (let index = 1; index < energies.length; index += 1) {
    if (energy > energies[index]) continue;
    const lowerEnergy = energies[index - 1];
    const upperEnergy = energies[index];
    const t = (energy - lowerEnergy) / (upperEnergy - lowerEnergy);
    return values[index - 1] + (values[index] - values[index - 1]) * t;
  }
  return values[last];
}

export function interpolateConductorOpticalConstants(recordOrMaterial, photonEnergyEv) {
  const record = typeof recordOrMaterial === 'string'
    ? conductorOpticalConstantsRecord(recordOrMaterial)
    : recordOrMaterial;
  const energies = conductorOpticalConstantsBank.photonEnergyEv || [];
  if (!record || !Array.isArray(record.n) || !Array.isArray(record.k)) return null;
  const n = interpolate(record.n, energies, photonEnergyEv);
  const k = interpolate(record.k, energies, photonEnergyEv);
  return Number.isFinite(n) && Number.isFinite(k) ? { n, k } : null;
}

export function normalIncidenceReflectanceFromComplexIndex({ n, k } = {}) {
  const real = Number(n);
  const extinction = Number(k);
  if (!Number.isFinite(real) || !Number.isFinite(extinction)) return null;
  const numerator = (real - 1) ** 2 + extinction ** 2;
  const denominator = (real + 1) ** 2 + extinction ** 2;
  return denominator > 0 ? Math.min(1, Math.max(0, numerator / denominator)) : null;
}

export function absorptionCoefficientFromExtinctionPerM(wavelengthNm, k) {
  const wavelengthM = Number(wavelengthNm) * 1e-9;
  const extinction = Number(k);
  if (!(wavelengthM > 0) || !(extinction >= 0)) return null;
  return (4 * Math.PI * extinction) / wavelengthM;
}
