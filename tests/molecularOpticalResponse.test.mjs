import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ULG_MOLECULAR_QUANTUM_OPTICAL_RESPONSE_SCHEMA,
  clearMolecularOpticalResponseCache,
  deriveMolecularQuantumRefractiveResponse,
  resolveMolecularQuantumGeometry,
  rhfIndependentParticlePolarizability
} from '../src/runtime/material/molecularOpticalResponse.js';

const visibleWavelengthsNm = [380, 430, 480, 530, 580, 630, 680, 730, 780];
const waterProperties = {
  formula: 'H2O',
  molarMassKgPerMol: 0.01801528,
  phases: [
    { name: 'solid', densityKgPerM3: 917 },
    { name: 'liquid', densityKgPerM3: 997 },
    { name: 'gas', densityKgPerM3: 0.598 }
  ]
};

function relativeError(a, b) {
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

test('banked H2O geometry produces finite quantum-derived spectral refraction without fixed IOR targets', () => {
  clearMolecularOpticalResponseCache();
  const response = deriveMolecularQuantumRefractiveResponse({
    formula: 'H2O',
    phase: 'liquid',
    properties: waterProperties,
    wavelengthsNm: visibleWavelengthsNm
  });

  assert.equal(response.schema, ULG_MOLECULAR_QUANTUM_OPTICAL_RESPONSE_SCHEMA);
  assert.equal(response.status, 'quantum-refractive-response-derived-reduced-unvalidated');
  assert.equal(response.refractiveAuthority, true);
  assert.equal(response.responseModel, 'rhf-independent-particle-frequency-response');
  assert.equal(response.basis, 'STO-3G');
  assert.equal(response.geometrySource, 'molecular-vibrations-bank-optimized-geometry');
  assert.equal(response.provenance.source, 'rhf-dipole-response-plus-lorentz-lorenz-local-field');
  assert.equal(response.scientificValidation, false);
  assert.equal(response.spectralSamples.length, visibleWavelengthsNm.length);
  assert.ok(response.spectralSamples.every((sample) => (
    Number.isFinite(sample.n) && sample.n > 1 && sample.k === 0
  )));
  assert.ok(
    response.spectralSamples[0].n > response.spectralSamples.at(-1).n,
    'the computed nonresonant electronic response should show normal visible dispersion'
  );
  assert.notEqual(response.referenceIor, 1.333);
  assert.notEqual(response.referenceIor, 1.309);
});

test('RHF isotropic polarizability is invariant to rigid translation and rotation of the same molecule', () => {
  const geometry = resolveMolecularQuantumGeometry({ formula: 'H2O' });
  assert.ok(geometry);
  const translated = geometry.atoms.map((atom) => ({
    Z: atom.Z,
    position: atom.position.map((value, axis) => value + [2.5, -1.25, 0.75][axis])
  }));
  const rotated = geometry.atoms.map((atom) => ({
    Z: atom.Z,
    position: [-atom.position[2], atom.position[1], atom.position[0]]
  }));

  const base = rhfIndependentParticlePolarizability({
    atoms: geometry.atoms,
    wavelengthsNm: [450, 650]
  });
  const shifted = rhfIndependentParticlePolarizability({ atoms: translated, wavelengthsNm: [450, 650] });
  const turned = rhfIndependentParticlePolarizability({ atoms: rotated, wavelengthsNm: [450, 650] });
  assert.equal(base.refractiveAuthority, true);
  assert.equal(shifted.refractiveAuthority, true);
  assert.equal(turned.refractiveAuthority, true);
  for (let index = 0; index < base.spectralPolarizability.length; index += 1) {
    assert.ok(relativeError(
      base.spectralPolarizability[index].isotropicAu,
      shifted.spectralPolarizability[index].isotropicAu
    ) < 1e-9);
    assert.ok(relativeError(
      base.spectralPolarizability[index].isotropicAu,
      turned.spectralPolarizability[index].isotropicAu
    ) < 1e-6);
  }
});

test('Lorentz-Lorenz refractive response follows phase number density monotonically', () => {
  const gas = deriveMolecularQuantumRefractiveResponse({
    formula: 'H2O',
    phase: 'gas',
    properties: waterProperties,
    wavelengthsNm: [530]
  });
  const liquid = deriveMolecularQuantumRefractiveResponse({
    formula: 'H2O',
    phase: 'liquid',
    properties: waterProperties,
    wavelengthsNm: [530]
  });
  const doubledGas = deriveMolecularQuantumRefractiveResponse({
    formula: 'H2O',
    phase: 'gas',
    properties: waterProperties,
    opticalState: { densityKgPerM3: waterProperties.phases[2].densityKgPerM3 * 2 },
    wavelengthsNm: [530]
  });

  assert.ok(gas.spectralSamples[0].n > 1);
  assert.ok(doubledGas.spectralSamples[0].n > gas.spectralSamples[0].n);
  assert.ok(liquid.spectralSamples[0].n > doubledGas.spectralSamples[0].n);
});

test('missing geometry or density blocks refractive authority instead of substituting an IOR', () => {
  const missingGeometry = deriveMolecularQuantumRefractiveResponse({
    formula: 'Xe2',
    phase: 'gas',
    properties: { molarMassKgPerMol: 0.262, phases: [{ name: 'gas', densityKgPerM3: 5 }] },
    wavelengthsNm: [550]
  });
  const missingDensity = deriveMolecularQuantumRefractiveResponse({
    formula: 'H2O',
    phase: 'liquid',
    properties: { molarMassKgPerMol: 0.01801528 },
    wavelengthsNm: [550]
  });

  for (const response of [missingGeometry, missingDensity]) {
    assert.equal(response.status, 'blocked-missing-or-out-of-domain-quantum-response');
    assert.equal(response.refractiveAuthority, false);
    assert.deepEqual(response.spectralSamples, []);
    assert.equal('referenceIor' in response, false);
  }
});

test('explicit geometry provenance fails closed for blocked or underspecified artifacts', () => {
  const atoms = resolveMolecularQuantumGeometry({ formula: 'H2O' }).atoms;
  const base = {
    atoms,
    schema: 'peercompute.ulg.quantum-geometry.v0',
    method: 'rhf-sto3g-geometry-optimization'
  };

  assert.equal(resolveMolecularQuantumGeometry({
    formula: 'unbanked',
    properties: { quantumGeometry: { ...base, status: 'blocked-not-derived' } }
  }), null);
  assert.equal(resolveMolecularQuantumGeometry({
    formula: 'unbanked',
    properties: { quantumGeometry: { ...base, status: 'quantum-geometry-derived', method: null } }
  }), null);
  assert.equal(resolveMolecularQuantumGeometry({
    formula: 'unbanked',
    properties: { quantumGeometry: { ...base, status: 'quantum-geometry-derived', schema: null } }
  }), null);
  assert.equal(
    resolveMolecularQuantumGeometry({
      formula: 'unbanked',
      properties: { quantumGeometry: { ...base, status: 'quantum-geometry-derived' } }
    }).source,
    'material-property-quantum-geometry'
  );
});
