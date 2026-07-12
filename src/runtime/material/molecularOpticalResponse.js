import {
  contract2,
  primitiveOverlap,
  rhf
} from '../electronicStructure/molecularHartreeFock.js';
import molecularVibrationsBank from '../../../data/material-properties/molecular-vibrations.json' with { type: 'json' };

export const ULG_MOLECULAR_QUANTUM_OPTICAL_RESPONSE_SCHEMA =
  'peercompute.ulg.molecular-quantum-optical-response.v0';

const BOHR_M = 5.29177210903e-11;
const HARTREE_EV = 27.211386245988;
const PHOTON_ENERGY_EV_NM = 1239.8419843320026;
const AVOGADRO = 6.02214076e23;
const FOUR_PI_OVER_THREE = (4 * Math.PI) / 3;
const responseCache = new Map();

function blocked(reason, extra = {}) {
  return {
    schema: ULG_MOLECULAR_QUANTUM_OPTICAL_RESPONSE_SCHEMA,
    status: 'blocked-missing-or-out-of-domain-quantum-response',
    reason,
    refractiveAuthority: false,
    spectralSamples: [],
    scientificValidation: false,
    ...extra
  };
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cloneAtoms(atoms) {
  return atoms.map((atom) => ({
    Z: Math.round(Number(atom.Z)),
    position: atom.position.map(Number)
  }));
}

function validAtoms(atoms) {
  return Array.isArray(atoms)
    && atoms.length > 0
    && atoms.every((atom) => (
      Number.isInteger(Number(atom?.Z))
      && Number(atom.Z) > 0
      && Array.isArray(atom.position)
      && atom.position.length === 3
      && atom.position.every((value) => Number.isFinite(Number(value)))
    ));
}

function producedQuantumGeometryStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return false;
  if (/(?:^|-)(?:blocked|failed|rejected|pending|heuristic|guessed|fallback|unverified|invalid)(?:-|$)/.test(status)) {
    return false;
  }
  if (/(?:^|-)not-(?:derived|closed|converged|optimized)(?:-|$)/.test(status)) return false;
  return /(?:^|-)(?:derived|closed|converged|optimized)(?:-|$)/.test(status);
}

function bankGeometryForFormula(formula) {
  const normalized = String(formula || '').toLowerCase();
  const record = molecularVibrationsBank?.records?.find((candidate) => (
    String(candidate?.formula || candidate?.key || '').toLowerCase() === normalized
  ));
  const atoms = record?.optimizedAtoms?.map((atom) => ({
    Z: Number(atom.Z),
    position: Array.isArray(atom.positionBohr) ? atom.positionBohr.map(Number) : null
  }));
  const method = record?.method ?? molecularVibrationsBank.method ?? null;
  if (
    !validAtoms(atoms)
    || !producedQuantumGeometryStatus(record?.status)
    || typeof method !== 'string'
    || method.trim().length === 0
    || typeof molecularVibrationsBank.schema !== 'string'
    || molecularVibrationsBank.schema.length === 0
  ) return null;
  return {
    atoms: cloneAtoms(atoms),
    source: 'molecular-vibrations-bank-optimized-geometry',
    sourceSchema: molecularVibrationsBank.schema ?? null,
    generatorFingerprint: molecularVibrationsBank.generatorFingerprint ?? null,
    recordMethod: method,
    recordStatus: record.status ?? null
  };
}

function explicitGeometry(properties) {
  const artifact = properties?.quantumGeometry;
  const atoms = artifact?.atoms;
  if (!atoms) return null;
  const status = String(artifact.status || '').trim().toLowerCase();
  if (
    !validAtoms(atoms)
    || !producedQuantumGeometryStatus(status)
    || typeof artifact.schema !== 'string'
    || artifact.schema.length === 0
    || typeof artifact.method !== 'string'
    || artifact.method.trim().length === 0
  ) return null;
  return {
    atoms: cloneAtoms(atoms),
    source: 'material-property-quantum-geometry',
    sourceSchema: artifact.schema ?? null,
    generatorFingerprint: artifact.generatorFingerprint ?? null,
    recordMethod: artifact.method ?? null,
    recordStatus: artifact.status
  };
}

export function resolveMolecularQuantumGeometry({ formula = null, properties = null } = {}) {
  return explicitGeometry(properties) || bankGeometryForFormula(formula);
}

function geometryKey(atoms) {
  return atoms.map((atom) => [
    atom.Z,
    ...atom.position.map((value) => Number(value).toPrecision(12))
  ].join(':')).join('|');
}

function primitiveDipoleIntegral(axis, a, la, A, b, lb, B) {
  const raised = [...lb];
  raised[axis] += 1;
  return primitiveOverlap(a, la, A, b, raised, B)
    + B[axis] * primitiveOverlap(a, la, A, b, lb, B);
}

function aoDipoleMatrix(basis, axis) {
  const count = basis.length;
  const matrix = Array.from({ length: count }, () => new Float64Array(count));
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      const value = contract2(
        basis[row],
        basis[column],
        (a, la, A, b, lb, B) => primitiveDipoleIntegral(axis, a, la, A, b, lb, B)
      );
      matrix[row][column] = value;
      matrix[column][row] = value;
    }
  }
  return matrix;
}

function moMatrixElement(coefficients, matrix, left, right) {
  let value = 0;
  for (let mu = 0; mu < coefficients.length; mu += 1) {
    const leftCoefficient = coefficients[mu][left];
    if (leftCoefficient === 0) continue;
    for (let nu = 0; nu < coefficients.length; nu += 1) {
      value += leftCoefficient * matrix[mu][nu] * coefficients[nu][right];
    }
  }
  return value;
}

function normalizeWavelengths(wavelengthsNm) {
  if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
    throw new TypeError('molecular optical response requires nonempty wavelengthsNm');
  }
  return wavelengthsNm.map((value) => {
    const wavelength = finitePositive(value);
    if (wavelength == null) throw new RangeError('molecular optical wavelengths must be positive');
    return wavelength;
  });
}

export function rhfIndependentParticlePolarizability({ atoms, wavelengthsNm } = {}) {
  if (!validAtoms(atoms)) return blocked('valid closed-shell molecular geometry is required');
  const wavelengths = normalizeWavelengths(wavelengthsNm);
  const cacheKey = `${geometryKey(atoms)}::${wavelengths.map((value) => value.toPrecision(10)).join(',')}`;
  const cached = responseCache.get(cacheKey);
  if (cached) return structuredClone(cached);

  let wavefunction;
  try {
    wavefunction = rhf(cloneAtoms(atoms));
  } catch (error) {
    return blocked(error instanceof Error ? error.message : String(error));
  }
  if (!wavefunction?.scfConverged) {
    return blocked('RHF response wavefunction did not converge');
  }
  const { basis, C, orbitalEnergies, nOcc } = wavefunction;
  if (!Array.isArray(basis) || !Array.isArray(C) || !Array.isArray(orbitalEnergies)
    || !(nOcc > 0) || !(nOcc < orbitalEnergies.length)) {
    return blocked('RHF response wavefunction lacks occupied/virtual orbital data');
  }

  const dipoleMatrices = [0, 1, 2].map((axis) => aoDipoleMatrix(basis, axis));
  const transitions = [];
  for (let occupied = 0; occupied < nOcc; occupied += 1) {
    for (let virtual = nOcc; virtual < orbitalEnergies.length; virtual += 1) {
      const energyHa = orbitalEnergies[virtual] - orbitalEnergies[occupied];
      if (!(energyHa > 0) || !Number.isFinite(energyHa)) continue;
      transitions.push({
        occupied,
        virtual,
        energyHa,
        dipoleBohr: dipoleMatrices.map((matrix) => moMatrixElement(C, matrix, occupied, virtual))
      });
    }
  }
  if (transitions.length === 0) return blocked('RHF response has no finite occupied-to-virtual transitions');
  const minTransitionEnergyHa = Math.min(...transitions.map((transition) => transition.energyHa));
  const maxPhotonEnergyHa = Math.max(...wavelengths.map((wavelengthNm) => (
    (PHOTON_ENERGY_EV_NM / wavelengthNm) / HARTREE_EV
  )));
  if (!(minTransitionEnergyHa > maxPhotonEnergyHa)) {
    return blocked('visible photon range reaches the undamped RHF transition domain', {
      minTransitionEnergyEv: minTransitionEnergyHa * HARTREE_EV,
      maxPhotonEnergyEv: maxPhotonEnergyHa * HARTREE_EV
    });
  }

  const spectralPolarizability = wavelengths.map((wavelengthNm) => {
    const photonEnergyHa = (PHOTON_ENERGY_EV_NM / wavelengthNm) / HARTREE_EV;
    const tensorDiagonalAu = [0, 1, 2].map((axis) => {
      let sum = 0;
      for (const transition of transitions) {
        const denominator = transition.energyHa ** 2 - photonEnergyHa ** 2;
        sum += (4 * transition.energyHa * transition.dipoleBohr[axis] ** 2) / denominator;
      }
      return sum;
    });
    return {
      wavelengthNm,
      photonEnergyEv: PHOTON_ENERGY_EV_NM / wavelengthNm,
      tensorDiagonalAu,
      isotropicAu: tensorDiagonalAu.reduce((sum, value) => sum + value, 0) / 3
    };
  });
  if (spectralPolarizability.some((sample) => (
    !Number.isFinite(sample.isotropicAu) || !(sample.isotropicAu > 0)
  ))) {
    return blocked('RHF response produced a non-positive or non-finite polarizability');
  }

  const response = {
    schema: ULG_MOLECULAR_QUANTUM_OPTICAL_RESPONSE_SCHEMA,
    status: 'quantum-response-derived-reduced-unvalidated',
    reason: null,
    refractiveAuthority: true,
    responseModel: 'rhf-independent-particle-frequency-response',
    basis: 'STO-3G',
    transitionCount: transitions.length,
    minTransitionEnergyEv: minTransitionEnergyHa * HARTREE_EV,
    spectralPolarizability,
    scientificValidation: false,
    limitations: [
      'uncoupled occupied-virtual RHF response rather than coupled-perturbed TDHF',
      'minimal STO-3G basis lacks diffuse and polarization functions',
      'condensed-phase intermolecular response enters only through the local-field density law'
    ]
  };
  responseCache.set(cacheKey, structuredClone(response));
  return response;
}

function phaseDensityKgPerM3(properties, phase, opticalState) {
  const stateDensity = finitePositive(
    opticalState?.densityKgPerM3
      ?? opticalState?.vaporDensityKgPerM3
      ?? opticalState?.massDensityKgPerM3
  );
  if (stateDensity != null) return stateDensity;
  const phaseName = String(phase || '').toLowerCase();
  const phaseRecord = properties?.phases?.find((candidate) => (
    String(candidate?.name || '').toLowerCase() === phaseName
  ));
  return finitePositive(phaseRecord?.densityKgPerM3 ?? properties?.densityKgPerM3);
}

function lorentzLorenzIndexFromPolarizability({ polarizabilityAu, numberDensityPerM3 }) {
  const refractivity = FOUR_PI_OVER_THREE
    * numberDensityPerM3
    * BOHR_M ** 3
    * polarizabilityAu;
  if (!Number.isFinite(refractivity) || refractivity < 0 || refractivity >= 1) return null;
  const nSquared = (1 + 2 * refractivity) / (1 - refractivity);
  return Number.isFinite(nSquared) && nSquared >= 1 ? Math.sqrt(nSquared) : null;
}

export function deriveMolecularQuantumRefractiveResponse({
  formula = null,
  phase = 'liquid',
  properties = null,
  opticalState = null,
  wavelengthsNm
} = {}) {
  const geometry = resolveMolecularQuantumGeometry({ formula, properties });
  if (!geometry) {
    return blocked('no produced quantum molecular geometry is available', { formula, phase });
  }
  const densityKgPerM3 = phaseDensityKgPerM3(properties, phase, opticalState);
  const molarMassKgPerMol = finitePositive(properties?.molarMassKgPerMol);
  if (densityKgPerM3 == null || molarMassKgPerMol == null) {
    return blocked('phase density and molar mass are required for refractive response', {
      formula,
      phase,
      geometrySource: geometry.source
    });
  }
  const polarizability = rhfIndependentParticlePolarizability({
    atoms: geometry.atoms,
    wavelengthsNm
  });
  if (polarizability.refractiveAuthority !== true) {
    return {
      ...polarizability,
      formula,
      phase,
      geometrySource: geometry.source
    };
  }
  const numberDensityPerM3 = (densityKgPerM3 / molarMassKgPerMol) * AVOGADRO;
  const spectralSamples = polarizability.spectralPolarizability.map((sample) => ({
    wavelengthNm: sample.wavelengthNm,
    n: lorentzLorenzIndexFromPolarizability({
      polarizabilityAu: sample.isotropicAu,
      numberDensityPerM3
    }),
    k: 0,
    polarizabilityAu: sample.isotropicAu,
    tensorDiagonalAu: [...sample.tensorDiagonalAu]
  }));
  if (spectralSamples.some((sample) => sample.n == null)) {
    return blocked('Lorentz-Lorenz local-field response is outside its finite domain', {
      formula,
      phase,
      densityKgPerM3,
      numberDensityPerM3,
      geometrySource: geometry.source
    });
  }
  const referenceSample = spectralSamples.reduce((best, sample) => (
    Math.abs(sample.wavelengthNm - 550) < Math.abs(best.wavelengthNm - 550) ? sample : best
  ));
  return {
    ...polarizability,
    status: 'quantum-refractive-response-derived-reduced-unvalidated',
    formula,
    phase,
    densityKgPerM3,
    molarMassKgPerMol,
    numberDensityPerM3,
    geometrySource: geometry.source,
    geometrySourceSchema: geometry.sourceSchema,
    geometryGeneratorFingerprint: geometry.generatorFingerprint,
    geometryMethod: geometry.recordMethod,
    spectralSamples,
    referenceWavelengthNm: referenceSample.wavelengthNm,
    referenceIor: referenceSample.n,
    provenance: {
      status: 'lower-level-simulation-reduced',
      source: 'rhf-dipole-response-plus-lorentz-lorenz-local-field',
      method: 'RHF occupied-virtual dipole response -> dynamic molecular polarizability -> phase-number-density Lorentz-Lorenz refractive index',
      inputs: {
        formula,
        phase,
        densityKgPerM3,
        molarMassKgPerMol,
        geometryGeneratorFingerprint: geometry.generatorFingerprint,
        basis: polarizability.basis
      },
      validation: false
    }
  };
}

export function clearMolecularOpticalResponseCache() {
  responseCache.clear();
}
