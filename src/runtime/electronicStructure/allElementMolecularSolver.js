// All-element molecular/reaction energy solver.
//
// The existing molecularHartreeFock.js path is an all-electron STO-3G solver, but its basis is
// intentionally limited to H-Ar. This module supplies the next rung for arbitrary elements:
//
//   atomic Kohn-Sham radial solve for each element
//        -> valence/bonding electron count, orbital energy scale, radial size
//        -> universal pair Hamiltonian / Morse-like Born-Oppenheimer energy
//        -> molecular and reaction energies for formulas containing any Z=1..118
//
// It is not a validated quantum-chemistry package and does not claim chemical accuracy. It is a
// lower-level electronic model with one general parameter set, intended to remove the hard STO-3G
// basis wall without adding material-specific reaction patches.

import { solveAtom } from './radialKohnSham.js';
import {
  atomicMassKg,
  electronConfiguration,
  symbolForZ,
  valenceElectronCount
} from './periodicTable.js';

const BOHR_TO_M = 5.29177210903e-11;
const HARTREE_TO_J = 4.3597447222071e-18;
const EV_TO_HA = 1 / 27.211386245988;
const descriptorCache = new Map();

function openSubshellElectrons(subshell) {
  const capacity = 2 * (2 * subshell.l + 1);
  if (subshell.occupancy <= 0 || subshell.occupancy >= capacity) return 0;
  return subshell.occupancy;
}

function bondingElectronCount(Z) {
  const config = electronConfiguration(Z);
  const maxN = config.reduce((m, s) => Math.max(m, s.n), 0);
  const outerSP = config
    .filter((s) => s.n === maxN && (s.l === 0 || s.l === 1))
    .reduce((sum, s) => sum + s.occupancy, 0);
  const openDF = config
    .filter((s) => s.l === 2 || s.l === 3)
    .reduce((sum, s) => sum + openSubshellElectrons(s), 0);
  return Math.max(1, Math.min(8, outerSP + openDF));
}

function radialContainmentRadius(atom, targetElectrons) {
  const { r, rho, dx } = atom.radialGrid;
  let cumulative = 0;
  for (let i = 0; i < r.length; i += 1) {
    cumulative += rho[i] * 4 * Math.PI * r[i] * r[i] * r[i] * dx;
    if (cumulative >= targetElectrons) return r[i];
  }
  return r[r.length - 1];
}

function outerOrbitalBindingHa(atom, Z) {
  const config = electronConfiguration(Z);
  const maxN = config.reduce((m, s) => Math.max(m, s.n), 0);
  const active = new Set(config
    .filter((s) => s.n === maxN || ((s.l === 2 || s.l === 3) && openSubshellElectrons(s) > 0))
    .map((s) => `${s.n}:${s.l}`));
  let weighted = 0;
  let occ = 0;
  for (const orbital of atom.orbitals || []) {
    if (!active.has(`${orbital.n}:${orbital.l}`)) continue;
    weighted += Math.abs(orbital.energyHa) * orbital.occupancy;
    occ += orbital.occupancy;
  }
  return occ > 0 ? weighted / occ : Math.abs(atom.orbitals?.at(-1)?.energyHa ?? 0.05);
}

export function atomicMolecularDescriptor(Z, options = {}) {
  const key = `${Z}:${options.gridPointsN ?? 520}:${options.rMaxBohr ?? 42}`;
  if (descriptorCache.has(key)) return descriptorCache.get(key);
  const atom = solveAtom(Z, {
    returnRadialDensity: true,
    gridPointsN: options.gridPointsN ?? 520,
    rMaxBohr: options.rMaxBohr ?? 42,
    maxScf: options.maxScf ?? 200
  });
  const bondingElectrons = bondingElectronCount(Z);
  const targetElectrons = Math.max(0.2, Z - bondingElectrons / 2);
  const coreRadiusBohr = radialContainmentRadius(atom, targetElectrons);
  const valenceRadiusBohr = radialContainmentRadius(atom, Math.max(0.5, Z - 0.25));
  const orbitalBindingHa = outerOrbitalBindingHa(atom, Z);
  const descriptor = {
    Z,
    symbol: symbolForZ(Z),
    atomicEnergyHa: atom.totalEnergyHa,
    atomicMassKg: atomicMassKg(Z),
    valenceElectrons: valenceElectronCount(Z),
    bondingElectrons,
    coreRadiusBohr,
    valenceRadiusBohr,
    orbitalBindingHa,
    electronegativityHa: orbitalBindingHa,
    radialSolve: {
      totalEnergyHa: atom.totalEnergyHa,
      integratedElectrons: atom.integratedElectrons,
      configuration: atom.configuration
    }
  };
  descriptorCache.set(key, descriptor);
  return descriptor;
}

function distanceBohr(a, b) {
  const dx = a.position[0] - b.position[0];
  const dy = a.position[1] - b.position[1];
  const dz = a.position[2] - b.position[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pairParameters(left, right) {
  const radiusSum = left.coreRadiusBohr + right.coreRadiusBohr;
  const valenceRadiusSum = left.valenceRadiusBohr + right.valenceRadiusBohr;
  const equilibriumBohr = Math.max(0.9, 0.42 * radiusSum + 0.18 * valenceRadiusSum);
  const chiMean = Math.sqrt(Math.max(left.electronegativityHa * right.electronegativityHa, 1e-8));
  const polarity = Math.abs(left.electronegativityHa - right.electronegativityHa)
    / Math.max(left.electronegativityHa + right.electronegativityHa, 1e-8);
  const capacity = Math.sqrt(left.bondingElectrons * right.bondingElectrons);
  const depthHa = Math.max(
    0.005,
    chiMean * (0.05 + 0.04 * polarity) * Math.min(3, capacity) / 2
  );
  const stiffness = 1.55 / Math.max(equilibriumBohr, 0.9);
  return { equilibriumBohr, depthHa, stiffness, polarity, capacity };
}

function morsePairEnergyHa(rBohr, params) {
  const x = Math.exp(-params.stiffness * (rBohr - params.equilibriumBohr));
  return params.depthHa * (x * x - 2 * x);
}

function electronCount(atoms) {
  return atoms.reduce((sum, atom) => sum + atom.Z, 0);
}

export function allElementMolecularEnergy(atoms, options = {}) {
  if (!Array.isArray(atoms) || atoms.length === 0) throw new TypeError('atoms must be a non-empty array');
  const descriptors = atoms.map((atom) => atomicMolecularDescriptor(atom.Z, options));
  const atomicReferenceEnergyHa = descriptors.reduce((sum, d) => sum + d.atomicEnergyHa, 0);
  let pairEnergyHa = 0;
  const pairTerms = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const r = distanceBohr(atoms[i], atoms[j]);
      const params = pairParameters(descriptors[i], descriptors[j]);
      const energyHa = morsePairEnergyHa(r, params);
      pairEnergyHa += energyHa;
      pairTerms.push({
        i,
        j,
        Zi: atoms[i].Z,
        Zj: atoms[j].Z,
        distanceBohr: r,
        energyHa,
        ...params
      });
    }
  }
  // A small many-body saturation term prevents large formula-unit clusters from gaining unlimited
  // pair energy just by packing every atom near every other atom. It is universal and depends only
  // on over-coordination relative to the Kohn-Sham-derived bonding electron counts.
  const pairCount = atoms.length * (atoms.length - 1) / 2;
  const bondCapacity = descriptors.reduce((sum, d) => sum + d.bondingElectrons, 0) / 2;
  const saturationPenaltyHa = pairCount > bondCapacity
    ? 0.015 * (pairCount - bondCapacity) ** 2
    : 0;
  return {
    method: 'atomic-kohn-sham-tight-binding-v0',
    totalEnergyHa: atomicReferenceEnergyHa + pairEnergyHa + saturationPenaltyHa,
    atomicReferenceEnergyHa,
    pairEnergyHa,
    saturationPenaltyHa,
    nAtoms: atoms.length,
    nElectrons: electronCount(atoms),
    descriptors,
    pairTerms,
    provenance: {
      source: 'atomic-kohn-sham-radial-density-universal-pair-hamiltonian',
      lowerLevelInputs: ['atomic Kohn-Sham total energy', 'radial density containment radii', 'outer orbital energies', 'ground-state electron configuration'],
      validation: false
    }
  };
}

export function allElementSpeciesEnergyHa(species, options = {}) {
  const atoms = Array.isArray(species) ? species : species.atoms;
  return allElementMolecularEnergy(atoms, options).totalEnergyHa;
}

function tallyAtoms(speciesList) {
  const tally = {};
  for (const species of speciesList) {
    const atoms = Array.isArray(species) ? species : species.atoms;
    const count = Array.isArray(species) ? 1 : (species.count || 1);
    for (const atom of atoms) tally[atom.Z] = (tally[atom.Z] || 0) + count;
  }
  return tally;
}

export function allElementReactionEnergyHa(reactants, products, options = {}) {
  const left = tallyAtoms(reactants);
  const right = tallyAtoms(products);
  for (const Z of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if ((left[Z] || 0) !== (right[Z] || 0)) throw new Error(`reaction not balanced for Z=${Z}`);
  }
  const sum = (list) => list.reduce((total, species) => total + (species.count || 1) * allElementSpeciesEnergyHa(species, options), 0);
  return {
    method: 'atomic-kohn-sham-tight-binding-v0',
    reactionEnergyHa: sum(products) - sum(reactants),
    validation: false
  };
}

export function allElementBondEnergyJ(atoms, options = {}) {
  const energy = allElementMolecularEnergy(atoms, options);
  return -energy.pairEnergyHa * HARTREE_TO_J;
}

export function allElementBondLengthMeters(Za, Zb, options = {}) {
  const params = pairParameters(atomicMolecularDescriptor(Za, options), atomicMolecularDescriptor(Zb, options));
  return params.equilibriumBohr * BOHR_TO_M;
}

export function allElementBondDepthEv(Za, Zb, options = {}) {
  const params = pairParameters(atomicMolecularDescriptor(Za, options), atomicMolecularDescriptor(Zb, options));
  return params.depthHa / EV_TO_HA;
}
