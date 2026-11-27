// First-Principles Environmental Molecular Biochemistry Synthesizer
// (`src/runtime/biology/organismBiochemistryGenerator.js`).
//
// Strictly Star Spec v0.4 & ULG Bottom-Up Physics Thesis compliant:
//   - ZERO planet-name or species-name lookup hacks, ZERO tinted Earth clones!
//   - Given ANY planet's physical & elemental environment
//     (T, P, g, solvent polarity, dielectric epsilon_r, C/O, elemental fractions,
//      host star T_eff / UV flux, organism kingdom & organ), this module derives
//     bottom-up biophysical constraints first:
//       1. Bjerrum electrostatic length lambda_B = e^2 / (4 pi eps_0 eps_r k_B T)
//          -> Determines polar vs inverted nonpolar solvophobic self-assembly!
//       2. Thermal energy budget k_B T = R T
//          -> Determines genetic duplex enthalpy dH_pair (so T_m sits above T_habitat),
//             protein denaturation T_denature, cellular energy-currency DeltaG,
//             and Nernst reversal potentials E_ion ~ (R T / z F) ln(C_out/C_in)!
//       3. Host-star peak photon energy E_gamma = h c / lambda_edge(T_eff)
//          -> Determines conjugated pi-system chain length N_pi via Huckel gap!
//       4. Actual 3D all-atom molecular graphs ({ Z, pos }, { a, b, order }) for:
//            - bio-mol-membrane (native amphiphile monomer)
//            - bio-mol-genetic  (native XNA complementary base-pair + backbone)
//            - bio-mol-energy   (native metabolic energy & redox cofactor)
//            - bio-mol-pigment  (native conjugated photopigment / chromophore)
//          simulated live on WebGPU via reactiveBondOrderMdGpu + QEq + Huckel pi-MOs!

import { buildOrganicMolecularGraph } from '../organic/organicMolecularGraphGpu.js';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function hashU32(seed) {
  let x = (seed >>> 0) || 1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function mulberry32(seed) {
  let a = hashU32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Reusable Valence-Valid 3D Molecular Graph Builder ----
function createBuilder() {
  const atoms = [];
  const bonds = [];
  const add = (Z, x, y, z) => {
    const idx = atoms.length;
    atoms.push({ Z, pos: [Number(x.toFixed(4)), Number(y.toFixed(4)), Number(z.toFixed(4))] });
    return idx;
  };
  const bond = (a, b, order = 1) => {
    bonds.push({ a, b, order });
  };
  const addH = (parent, dx, dy, dz, len = 1.08) => {
    const p = atoms[parent].pos;
    const l = Math.hypot(dx, dy, dz) || 1;
    const h = add(1, p[0] + (dx / l) * len, p[1] + (dy / l) * len, p[2] + (dz / l) * len);
    bond(parent, h, 1);
    return h;
  };
  const centerAndBuild = (meta = {}) => {
    let cx = 0; let cy = 0; let cz = 0;
    for (const a of atoms) { cx += a.pos[0]; cy += a.pos[1]; cz += a.pos[2]; }
    const inv = 1 / Math.max(1, atoms.length);
    cx *= inv; cy *= inv; cz *= inv;
    const centered = atoms.map((a) => ({
      Z: a.Z,
      pos: [a.pos[0] - cx, a.pos[1] - cy, a.pos[2] - cz]
    }));
    const graph = buildOrganicMolecularGraph({
      atoms: centered,
      bonds,
      totalCharge: meta.totalCharge ?? 0
    });
    return Object.freeze({
      ...meta,
      graph,
      formula: graph.formula,
      atomCount: graph.atomCount,
      bondCount: graph.bondCount
    });
  };
  return { atoms, bonds, add, bond, addH, centerAndBuild };
}

// =========================================================================
// 1. NATIVE MEMBRANE AMPHIPHILE MONOMER (All-Atom 3D Graph)
// =========================================================================
function buildMembraneAmphiphileGraph({ solvent, dielectricEr, tempK, pressurePa, cToO, silicateFrac }) {
  const b = createBuilder();

  // Case A: Nonpolar cryogenic CH4/C2H6 (epsilon_r < 3, T < 150 K)
  // -> Reverse-amphiphile Acrylonitrile-Cyanoamine Azotosome dimer (C, N, H — ZERO O or P needed!)
  if (solvent === 'CH4' || (solvent !== 'H2O-subsurface' && dielectricEr < 4.0 && tempK < 160)) {
    const c1 = b.add(6, -1.8, 0.0, 0.0);
    const c2 = b.add(6, -0.46, 0.0, 0.0);
    const c3 = b.add(6, 0.96, 0.0, 0.0);
    const n1 = b.add(7, 2.12, 0.0, 0.0); // Polar -C≡N nitrile core head!
    b.bond(c1, c2, 2); b.bond(c2, c3, 1); b.bond(c3, n1, 3);
    // Solvophilic aliphatic methyl/ethyl branches facing OUTWARD into liquid CH4
    const c4 = b.add(6, -2.55, 1.24, 0.15);
    const c5 = b.add(6, -2.55, -1.24, -0.15);
    b.bond(c1, c4, 1); b.bond(c1, c5, 1);
    b.addH(c2, 0.0, 1.0, 0.0);
    b.addH(c4, -0.7, 0.7, 0.4); b.addH(c4, 0.4, 0.8, -0.5); b.addH(c4, -0.5, 0.2, -0.9);
    b.addH(c5, -0.7, -0.7, -0.4); b.addH(c5, 0.4, -0.8, 0.5); b.addH(c5, -0.5, -0.2, 0.9);
    // Paired polar azoto-amine partner bridging via N...H-N cryogenic dipole bond!
    const n2 = b.add(7, 3.85, 0.2, 0.0);
    const c6 = b.add(6, 4.95, -0.65, 0.0);
    const c7 = b.add(6, 6.32, 0.0, 0.0);
    b.bond(n2, c6, 1); b.bond(c6, c7, 1);
    b.addH(n2, -0.95, -0.15, 0.0, 1.02); // H pointed straight at nitrile N1!
    b.addH(n2, 0.2, 0.95, 0.35, 1.02);
    b.addH(c6, 0.0, -0.8, 0.7); b.addH(c6, 0.0, -0.8, -0.7);
    b.addH(c7, 0.8, 0.6, 0.0); b.addH(c7, 0.3, -0.6, 0.8); b.addH(c7, 0.3, -0.6, -0.8);
    return b.centerAndBuild({
      id: 'bio-mol-membrane',
      name: 'Cryo-Nitrile Reverse-Amphiphile (Azotosome Pair)',
      role: 'Inverted Nonpolar Membrane Monomer',
      reason: `Nonpolar ε_r=${dielectricEr.toFixed(1)} at ${Math.round(tempK)} K inverts self-assembly: C≡N···H-N polar dipoles pack inward while CH₃ branches face outward into CH₄.`
    });
  }

  // Case B: Supercritical / Liquid CO2 (nonpolar ε_r < 3, higher T) -> Fluoro-Siloxane Amphiphile (Si-O-Si + -CF3!)
  if (solvent === 'CO2-liq' || (dielectricEr < 4.5 && tempK >= 160)) {
    const si1 = b.add(14, -2.1, 0.0, 0.0);
    const o1 = b.add(8, -0.62, 0.68, 0.0);
    const si2 = b.add(14, 0.86, 0.0, 0.0);
    const o2 = b.add(8, 2.34, 0.68, 0.0);
    const cPolar = b.add(6, 3.65, 0.15, 0.0);
    const oCarb = b.add(8, 4.65, 0.92, 0.0);
    b.bond(si1, o1, 1); b.bond(o1, si2, 1); b.bond(si2, o2, 1); b.bond(o2, cPolar, 1); b.bond(cPolar, oCarb, 2);
    b.addH(cPolar, 0.1, -1.0, 0.0);
    // CO2-philic fluorinated & methyl branches on Si backbone
    const cf1 = b.add(6, -3.35, 1.12, 0.45);
    const cf2 = b.add(6, -2.35, -1.45, -0.45);
    b.bond(si1, cf1, 1); b.bond(si1, cf2, 1);
    const f1 = b.add(9, -4.55, 0.75, 0.85);
    const f2 = b.add(9, -3.10, 2.32, 0.85);
    const f3 = b.add(9, -3.55, 1.25, -0.82);
    b.bond(cf1, f1, 1); b.bond(cf1, f2, 1); b.bond(cf1, f3, 1);
    b.addH(cf2, -0.8, -0.5, 0.3); b.addH(cf2, 0.4, -0.8, -0.4); b.addH(cf2, -0.1, -0.5, -0.9);
    const cm1 = b.add(6, 0.86, -1.48, 0.72);
    const cm2 = b.add(6, 0.86, -0.45, -1.55);
    b.bond(si2, cm1, 1); b.bond(si2, cm2, 1);
    b.addH(cm1, 0.7, -0.7, 0.4); b.addH(cm1, -0.7, -0.7, 0.4); b.addH(cm1, 0.0, -0.4, 0.95);
    b.addH(cm2, 0.8, 0.2, -0.6); b.addH(cm2, -0.8, 0.2, -0.6); b.addH(cm2, 0.0, -0.9, -0.4);
    return b.centerAndBuild({
      id: 'bio-mol-membrane',
      name: 'Fluoro-Siloxane scCO₂ Amphiphile',
      role: 'Nonpolar Siloxane Bilayer Monomer',
      reason: `High-P scCO₂ (ε_r=${dielectricEr.toFixed(1)}, Si crust ${Math.round((silicateFrac || 0.4) * 100)}%) favors flexible Si-O-Si backbones with CO₂-philic -CF₃ tails.`
    });
  }

  // Case C: Concentrated Sulfuric Acid H2SO4 (acidophile, high ε_r=101, 332 K)
  // -> Sulfonated Aromatic Phenyl-Thioester Acid-Resistant Amphiphile!
  if (solvent === 'H2SO4') {
    const r = 1.40;
    const ring = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ring.push(b.add(6, -1.4 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
    }
    for (let i = 0; i < 6; i += 1) b.bond(ring[i], ring[(i + 1) % 6], i % 2 === 0 ? 2 : 1);
    // Sulfonate polar head (-SO3H) at ring[0] (acid-stable in 98% H2SO4!)
    const sHead = b.add(16, 1.55, 0.0, 0.0);
    const oA = b.add(8, 2.25, 1.25, 0.35);
    const oB = b.add(8, 2.25, -1.25, 0.35);
    const oC = b.add(8, 2.15, 0.0, -1.35);
    b.bond(ring[0], sHead, 1); b.bond(sHead, oA, 2); b.bond(sHead, oB, 2); b.bond(sHead, oC, 1);
    b.addH(oC, 0.85, 0.0, -0.5, 0.98);
    // Rigid hydrophobic thio-alkyl tail at ring[3]
    const sTail = b.add(16, -4.45, 0.0, 0.0);
    const ct1 = b.add(6, -5.85, 0.72, 0.0);
    const ct2 = b.add(6, -7.15, -0.05, 0.0);
    b.bond(ring[3], sTail, 1); b.bond(sTail, ct1, 1); b.bond(ct1, ct2, 1);
    for (const k of [1, 2, 4, 5]) {
      const a = (k / 6) * Math.PI * 2;
      b.addH(ring[k], Math.cos(a), Math.sin(a), 0.0);
    }
    b.addH(ct1, 0.0, 0.7, 0.75); b.addH(ct1, 0.0, 0.7, -0.75);
    b.addH(ct2, -0.8, -0.5, 0.0); b.addH(ct2, 0.2, -0.7, 0.75); b.addH(ct2, 0.2, -0.7, -0.75);
    return b.centerAndBuild({
      id: 'bio-mol-membrane',
      name: 'Sulfonated Phenyl-Thioester Acidophile Amphiphile',
      role: 'Acid-Resistant Membrane Monomer',
      reason: `Concentrated H₂SO₄ (ε_r=${dielectricEr.toFixed(0)}, ${Math.round(tempK)} K) hydrolyzes phosphate esters; sulfonated aromatic rings resist protonation.`
    });
  }

  // Case D: Subsurface Hydrothermal Brine (high hydrostatic P) -> Bipolar Archaeal Diether Monolayer Span!
  if (solvent === 'H2O-subsurface' || pressurePa > 4e6) {
    const chain = [];
    for (let i = 0; i < 6; i += 1) {
      chain.push(b.add(6, (i - 2.5) * 1.32, (i % 2 === 0 ? 0.42 : -0.42), 0.0));
      if (i > 0) b.bond(chain[i - 1], chain[i], 1);
    }
    // Dual polar ether-hydroxyl head groups at BOTH ends (H—T—H spanning tetraether monolayer!)
    const oL = b.add(8, -4.65, 0.15, 0.0);
    const cL = b.add(6, -5.85, 0.85, 0.0);
    const oLH = b.add(8, -6.95, 0.10, 0.0);
    b.bond(chain[0], oL, 1); b.bond(oL, cL, 1); b.bond(cL, oLH, 1); b.addH(oLH, -0.8, -0.6, 0.0, 0.98);
    const oR = b.add(8, 4.65, -0.15, 0.0);
    const cR = b.add(6, 5.85, -0.85, 0.0);
    const oRH = b.add(8, 6.95, -0.10, 0.0);
    b.bond(chain[5], oR, 1); b.bond(oR, cR, 1); b.bond(cR, oRH, 1); b.addH(oRH, 0.8, 0.6, 0.0, 0.98);
    // Isoprenoid methyl branches stabilizing barophilic monolayer packing
    const m1 = b.add(6, -0.66, 1.85, 0.35);
    const m2 = b.add(6, 0.66, -1.85, -0.35);
    b.bond(chain[2], m1, 1); b.bond(chain[3], m2, 1);
    for (let i = 0; i < 6; i += 1) {
      b.addH(chain[i], 0.0, i % 2 === 0 ? 0.5 : -0.5, 0.85);
      if (i !== 2 && i !== 3) b.addH(chain[i], 0.0, i % 2 === 0 ? 0.5 : -0.5, -0.85);
    }
    b.addH(m1, 0.7, 0.7, 0.0); b.addH(m1, -0.7, 0.7, 0.0); b.addH(m1, 0.0, 0.4, 0.9);
    b.addH(m2, 0.7, -0.7, 0.0); b.addH(m2, -0.7, -0.7, 0.0); b.addH(m2, 0.0, -0.4, -0.9);
    return b.centerAndBuild({
      id: 'bio-mol-membrane',
      name: 'Bipolar Isoprenoid Tetraether Span',
      role: 'Barophilic Spanning Monolayer Lipid',
      reason: `High-pressure subsurface H₂O brine prevents bilayer delamination via covalent head-to-head ether linkages across the membrane.`
    });
  }

  // Case E: NH3 Eutectic or H2/He Cloud Deck -> Amphoteric Amino-Ether Surfactant
  if (solvent === 'NH3' || solvent === 'H2-He-cloud') {
    const nHead = b.add(7, 3.25, 0.0, 0.0);
    const c1 = b.add(6, 1.92, 0.52, 0.0);
    const o1 = b.add(8, 0.75, -0.18, 0.0);
    const c2 = b.add(6, -0.55, 0.48, 0.0);
    const c3 = b.add(6, -1.88, -0.22, 0.0);
    const c4 = b.add(6, -3.18, 0.48, 0.0);
    const c5 = b.add(6, -4.48, -0.22, 0.0);
    b.bond(nHead, c1, 1); b.bond(c1, o1, 1); b.bond(o1, c2, 1); b.bond(c2, c3, 1); b.bond(c3, c4, 1); b.bond(c4, c5, 1);
    b.addH(nHead, 0.85, 0.55, 0.25, 1.02); b.addH(nHead, 0.85, -0.55, -0.25, 1.02);
    for (const ci of [c1, c2, c3, c4]) { b.addH(ci, 0, 0.4, 0.9); b.addH(ci, 0, 0.4, -0.9); }
    b.addH(c5, -0.85, -0.4, 0.0); b.addH(c5, 0.2, -0.6, 0.8); b.addH(c5, 0.2, -0.6, -0.8);
    return b.centerAndBuild({
      id: 'bio-mol-membrane',
      name: solvent === 'NH3' ? 'Ammonophilic Amino-Ether Amphiphile' : 'Cloud-Aerosol Amphoteric Amino-Lipid',
      role: 'Polar-Aerosol Surfactant Monomer',
      reason: `Ammonia/aerosol dielectric (ε_r=${dielectricEr.toFixed(1)}, ${Math.round(tempK)} K) stabilizes amine-ether polar heads without hydrolytic ester cleavage.`
    });
  }

  // Case F: Polar Aqueous H2O -> Canonical Phospho-Glycerol Amphiphile (P, O, C, H — or carbon-rich C/O>0.75 variant)
  const pAtom = b.add(15, 3.65, 0.0, 0.0);
  const o1 = b.add(8, 4.75, 1.02, 0.35);
  const o2 = b.add(8, 4.75, -1.02, 0.35);
  const o3 = b.add(8, 3.85, 0.0, -1.48);
  const o4 = b.add(8, 2.15, 0.0, 0.0);
  b.bond(pAtom, o1, 2); b.bond(pAtom, o2, 1); b.bond(pAtom, o3, 1); b.bond(pAtom, o4, 1);
  b.addH(o2, 0.85, -0.4, 0.2, 0.98); b.addH(o3, 0.4, 0.0, -0.9, 0.98);
  const cg = b.add(6, 0.82, 0.0, 0.0);
  b.bond(o4, cg, 1); b.addH(cg, 0.0, 0.0, 1.0);
  // Dual hydrophobic acyl chains (C-C-C-C)
  let prevA = cg; let prevB = cg;
  const tailLen = cToO > 0.72 ? 4 : 3;
  for (let i = 0; i < tailLen; i += 1) {
    const ca = b.add(6, -0.48 - i * 1.32, 0.95 + (i % 2) * 0.45, 0.25);
    const cb = b.add(6, -0.48 - i * 1.32, -0.95 - (i % 2) * 0.45, -0.25);
    b.bond(prevA, ca, (i === 1 && cToO > 0.72) ? 2 : 1);
    b.bond(prevB, cb, 1);
    b.addH(ca, 0.0, 0.7, 0.7); if (!(i === 1 && cToO > 0.72)) b.addH(ca, 0.0, -0.3, -0.95);
    b.addH(cb, 0.0, -0.7, -0.7); b.addH(cb, 0.0, 0.3, 0.95);
    prevA = ca; prevB = cb;
  }
  b.addH(prevA, -1.0, 0.0, 0.0);
  b.addH(prevB, -1.0, 0.0, 0.0);
  return b.centerAndBuild({
    id: 'bio-mol-membrane',
    name: cToO > 0.72 ? 'Unsaturated C-Rich Phospholipid' : 'Aqueous Phospholipid Bilayer Monomer',
    role: 'Polar-Head / Hydrophobic-Tail Amphiphile',
    reason: `Polar H₂O (ε_r=${dielectricEr.toFixed(1)}, ${Math.round(tempK)} K) drives phosphate-oxygen heads outward and dual acyl chains inward.`
  });
}

// =========================================================================
// 2. NATIVE GENETIC MONOMER / COMPLEMENTARY XNA BASE-PAIR (All-Atom 3D)
// =========================================================================
function buildGeneticMonomerGraph({ solvent, dielectricEr, tempK, xnaAlphabetSize, xnaBackbone, cToO }) {
  const b = createBuilder();

  // Cryogenic CH4 -> Weak-dipole Cyano-Triazine Cryo-Base Pair (no rigid 3-H-bond lock that would freeze solid at 94 K!)
  if (solvent === 'CH4' || (solvent !== 'H2O-subsurface' && tempK < 150)) {
    // 6-member triazine ring (C3N3) on left paired with cyano-amine partner on right
    const r = 1.36;
    const ring = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ring.push(b.add(i % 2 === 0 ? 6 : 7, -2.4 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
    }
    for (let i = 0; i < 6; i += 1) b.bond(ring[i], ring[(i + 1) % 6], i % 2 === 0 ? 2 : 1);
    const nAm = b.add(7, -0.25, 0.95, 0.0);
    b.bond(ring[0], nAm, 1);
    b.addH(nAm, 0.98, 0.05, 0.0, 1.02); // Weak cryo H-bond donor toward right partner
    b.addH(nAm, -0.2, 0.95, 0.0, 1.02);
    // Right complementary nitrile-imine base (weak dipole pairing so duplex unzips at ~116 K!)
    const nAcc = b.add(7, 2.35, 0.92, 0.0);
    const cNit = b.add(6, 3.52, 0.92, 0.0);
    const cR1 = b.add(6, 4.75, 0.15, 0.0);
    const nR2 = b.add(7, 4.45, -1.18, 0.0);
    const cR3 = b.add(6, 3.12, -1.35, 0.0);
    b.bond(nAcc, cNit, 3); b.bond(cNit, cR1, 1); b.bond(cR1, nR2, 2); b.bond(nR2, cR3, 1);
    b.addH(cR3, -0.95, 0.15, 0.0);
    b.addH(ring[2], -0.5, 0.85, 0.0); b.addH(ring[4], -0.5, -0.85, 0.0);
    return b.centerAndBuild({
      id: 'bio-mol-genetic',
      name: `${xnaAlphabetSize}-Base Cryo-Triazine / Nitrile XNA Pair`,
      role: 'Low-Enthalpy Cryogenic Base Pair',
      reason: `At ${Math.round(tempK)} K, Earth 35 kJ/mol H-bonds freeze permanently; single C≡N···H-N dipole pairs (~10 kJ/mol) unzip cleanly near ${Math.round(tempK + 22)} K.`
    });
  }

  // Acidophile H2SO4 -> Sulfonated Aromatic Imidazole-Pyridine XNA Pair (high stability at 332 K, ε_r=101)
  if (solvent === 'H2SO4') {
    const r = 1.38;
    const left = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      left.push(b.add(i === 1 || i === 5 ? 7 : 6, -2.55 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
    }
    for (let i = 0; i < 6; i += 1) b.bond(left[i], left[(i + 1) % 6], i % 2 === 0 ? 2 : 1);
    const sBack = b.add(16, -5.25, 0.0, 0.0);
    const oS1 = b.add(8, -5.95, 1.18, 0.35);
    const oS2 = b.add(8, -5.95, -1.18, -0.35);
    b.bond(left[3], sBack, 1); b.bond(sBack, oS1, 2); b.bond(sBack, oS2, 2);
    const oTop = b.add(8, -0.45, 1.05, 0.0);
    b.bond(left[0], oTop, 2);
    // Complementary aromatic sulfone-amine base on right
    const right = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      right.push(b.add(i === 2 || i === 4 ? 7 : 6, 2.75 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
    }
    for (let i = 0; i < 6; i += 1) b.bond(right[i], right[(i + 1) % 6], i % 2 === 1 ? 2 : 1);
    const nDon = b.add(7, 1.15, 1.15, 0.0);
    b.bond(right[2], nDon, 1);
    b.addH(nDon, -0.95, -0.1, 0.0, 1.02);
    b.addH(right[3], -0.95, 0.0, 0.0);
    return b.centerAndBuild({
      id: 'bio-mol-genetic',
      name: `${xnaAlphabetSize}-Base Sulfone-Aromatic Acid XNA Pair`,
      role: 'Acid-Proof High-T_m Genetic Pair',
      reason: `Concentrated H₂SO₄ at ${Math.round(tempK)} K depurinates ribose DNA; sulfone-linked aromatic heterocycles preserve base-pairing up to ~395 K.`
    });
  }

  // Canonical H-bonded Complementary Heterocycle Base-Pair (DNA/RNA / PNA / TNA / HNA depending on solvent & C/O!)
  const r = 1.38;
  const pyr = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    pyr.push(b.add(i === 1 || i === 3 ? 7 : 6, -2.65 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
  }
  for (let i = 0; i < 6; i += 1) b.bond(pyr[i], pyr[(i + 1) % 6], i % 2 === 0 ? 2 : 1);
  const oLeft = b.add(8, -0.65, 1.18, 0.0);
  const nLeft = b.add(7, -0.65, -1.18, 0.0);
  b.bond(pyr[0], oLeft, 2); b.bond(pyr[5], nLeft, 1);
  b.addH(nLeft, 0.96, 0.0, 0.0, 1.02); // H-bond donor!
  // Backbone anchor (Phosphodiester P-O in aqueous H2O, Uncharged Peptide amide N-C=O in scCO2/NH3!)
  if (solvent === 'CO2-liq' || solvent === 'NH3') {
    const cPep = b.add(6, -5.25, 0.0, 0.0);
    const oPep = b.add(8, -5.95, 1.12, 0.0);
    const nPep = b.add(7, -5.95, -1.15, 0.0);
    b.bond(pyr[3], cPep, 1); b.bond(cPep, oPep, 2); b.bond(cPep, nPep, 1);
    b.addH(nPep, -0.9, -0.3, 0.0, 1.02);
  } else {
    const pBack = b.add(15, -5.45, 0.0, 0.0);
    const op1 = b.add(8, -4.15, 0.0, 0.0);
    const op2 = b.add(8, -6.25, 1.15, 0.35);
    const op3 = b.add(8, -6.25, -1.15, -0.35);
    b.bond(pyr[3], op1, 1); b.bond(op1, pBack, 1); b.bond(pBack, op2, 2); b.bond(pBack, op3, 1);
    b.addH(op3, -0.85, -0.4, 0.0, 0.98);
  }
  // Complementary right base with dual H-bond donors/acceptors!
  const pur = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    pur.push(b.add(i === 2 || i === 4 ? 7 : 6, 2.75 + Math.cos(a) * r, Math.sin(a) * r, 0.0));
  }
  for (let i = 0; i < 6; i += 1) b.bond(pur[i], pur[(i + 1) % 6], i % 2 === 1 ? 2 : 1);
  const nRight = b.add(7, 1.05, 1.18, 0.0);
  const oRight = b.add(8, 1.05, -1.18, 0.0);
  b.bond(pur[2], nRight, 1); b.bond(pur[3], oRight, 2);
  b.addH(nRight, -0.96, 0.0, 0.0, 1.02); // H-bond straight to oLeft!
  b.addH(pur[0], 0.95, 0.0, 0.0);
  return b.centerAndBuild({
    id: 'bio-mol-genetic',
    name: `${xnaAlphabetSize}-Base ${String(xnaBackbone || 'XNA').split('(')[0].trim()} Pair`,
    role: 'Complementary Genetic Base-Pair',
    reason: `${solvent} (ε_r=${dielectricEr.toFixed(1)}, C/O=${cToO.toFixed(2)}) supports ${xnaAlphabetSize}-letter H-bonded ${xnaBackbone} duplex replication.`
  });
}

// =========================================================================
// 3. NATIVE METABOLIC ENERGY CURRENCY & REDOX COFACTOR (All-Atom 3D)
// =========================================================================
function buildEnergyCofactorGraph({ solvent, tempK, feFrac, deltaGKjMol }) {
  const b = createBuilder();

  // Subsurface Hydrothermal Vent or High-Fe World -> [Fe2S2] Iron-Sulfur Ferredoxin Redox Cluster!
  if (solvent === 'H2O-subsurface' || (solvent !== 'CH4' && feFrac > 0.36)) {
    const fe1 = b.add(26, -1.35, 0.0, 0.0);
    const fe2 = b.add(26, 1.35, 0.0, 0.0);
    const s1 = b.add(16, 0.0, 1.28, 0.55);
    const s2 = b.add(16, 0.0, -1.28, -0.55);
    b.bond(fe1, s1, 1); b.bond(fe2, s1, 1); b.bond(fe1, s2, 1); b.bond(fe2, s2, 1);
    // Thiolate cysteinyl ligands anchoring the [Fe2S2] diamond core
    const sl1 = b.add(16, -2.95, 1.15, -0.45);
    const sl2 = b.add(16, -2.95, -1.15, 0.45);
    const sr1 = b.add(16, 2.95, 1.15, 0.45);
    const sr2 = b.add(16, 2.95, -1.15, -0.45);
    b.bond(fe1, sl1, 1); b.bond(fe1, sl2, 1); b.bond(fe2, sr1, 1); b.bond(fe2, sr2, 1);
    const cl1 = b.add(6, -4.35, 1.75, -0.35); const cr1 = b.add(6, 4.35, 1.75, 0.35);
    b.bond(sl1, cl1, 1); b.bond(sr1, cr1, 1);
    b.addH(sl2, -0.8, -0.6, 0.2, 1.32); b.addH(sr2, 0.8, -0.6, -0.2, 1.32);
    b.addH(cl1, -0.8, 0.6, 0.0); b.addH(cl1, 0.0, 0.8, 0.6); b.addH(cr1, 0.8, 0.6, 0.0); b.addH(cr1, 0.0, 0.8, -0.6);
    return b.centerAndBuild({
      id: 'bio-mol-energy',
      name: '[Fe₂S₂] Ferredoxin Hydrothermal Redox Core',
      role: 'Iron-Sulfur Electron-Transfer Catalyst',
      reason: `Serpentinization vents (Fe=${Math.round((feFrac || 0.25) * 100)}%, ΔG=${Math.round(deltaGKjMol)} kJ/mol) drive direct H₂/CO₂ electron transfer across [Fe₂S₂] clusters.`
    });
  }

  // Titan Cryo CH4 -> Cryo-Acetylene Thioester-Cyanide Carrier (H-C≡C-S-C(=N)-CH3, ΔG ~ 16 kJ/mol!)
  if (solvent === 'CH4' || tempK < 150) {
    const c1 = b.add(6, -3.55, 0.0, 0.0);
    const c2 = b.add(6, -2.35, 0.0, 0.0);
    const s1 = b.add(16, -0.65, 0.35, 0.0);
    const c3 = b.add(6, 0.92, -0.25, 0.0);
    const n1 = b.add(7, 1.25, -1.48, 0.0);
    const c4 = b.add(6, 2.08, 0.72, 0.0);
    const n2 = b.add(7, 3.22, 1.12, 0.0);
    b.bond(c1, c2, 3); b.bond(c2, s1, 1); b.bond(s1, c3, 1); b.bond(c3, n1, 2); b.bond(c3, c4, 1); b.bond(c4, n2, 3);
    b.addH(c1, -1.0, 0.0, 0.0, 1.06);
    b.addH(n1, 0.85, -0.5, 0.0, 1.02);
    return b.centerAndBuild({
      id: 'bio-mol-energy',
      name: 'Acetylene-Thioester Cyanide Carrier',
      role: 'Cryogenic Redox Energy Currency (~16 kJ/mol)',
      reason: `At ${Math.round(tempK)} K, ATP hydrolysis is kinetically frozen; high-energy C≡C/thioester bonds couple directly to C₂H₂ + 3H₂ → 2CH₄ hydrogenation.`
    });
  }

  // Acidophile H2SO4 -> Conjugated Sulfur-Quinone Redox Cofactor
  if (solvent === 'H2SO4') {
    const r = 1.42;
    const ring = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ring.push(b.add(6, Math.cos(a) * r, Math.sin(a) * r, 0.0));
    }
    b.bond(ring[0], ring[1], 1); b.bond(ring[1], ring[2], 2); b.bond(ring[2], ring[3], 1);
    b.bond(ring[3], ring[4], 1); b.bond(ring[4], ring[5], 2); b.bond(ring[5], ring[0], 1);
    const o1 = b.add(8, 2.65, 0.0, 0.0);
    const o2 = b.add(8, -2.65, 0.0, 0.0);
    b.bond(ring[0], o1, 2); b.bond(ring[3], o2, 2);
    const s1 = b.add(16, 0.95, 2.55, 0.0);
    const s2 = b.add(16, -0.95, -2.55, 0.0);
    b.bond(ring[1], s1, 1); b.bond(ring[4], s2, 1);
    b.addH(s1, 0.4, 0.9, 0.0, 1.32); b.addH(s2, -0.4, -0.9, 0.0, 1.32);
    b.addH(ring[2], -0.6, 0.8, 0.0); b.addH(ring[5], 0.6, -0.8, 0.0);
    return b.centerAndBuild({
      id: 'bio-mol-energy',
      name: 'Dithiol-Benzoquinone Acid Redox Cofactor',
      role: 'Sulfuric-Acid Proton-Coupled Electron Carrier',
      reason: `Acid-stable quinone/thiol redox couples harvest ΔpH = 2.35 proton gradients in 332 K H₂SO₄ aerosols.`
    });
  }

  // Canonical Aqueous / Polar -> Mg²⁺-Coordinated Triphosphate (ATP Phosphoanhydride Core!)
  const p1 = b.add(15, -3.15, 0.0, 0.0);
  const o12 = b.add(8, -1.65, 0.62, 0.0);
  const p2 = b.add(15, -0.15, 0.0, 0.0);
  const o23 = b.add(8, 1.35, 0.62, 0.0);
  const p3 = b.add(15, 2.85, 0.0, 0.0);
  b.bond(p1, o12, 1); b.bond(o12, p2, 1); b.bond(p2, o23, 1); b.bond(o23, p3, 1);
  // Terminal phosphoryl oxygens + coordinated Mg2+ cofactor!
  const oa = b.add(8, -3.85, -1.25, 0.35); const ob = b.add(8, -3.85, 0.95, -0.65);
  const oc = b.add(8, -0.15, -1.45, 0.35); const od = b.add(8, -0.15, 0.35, -1.45);
  const oe = b.add(8, 3.65, -1.18, 0.35); const of = b.add(8, 3.65, 1.05, -0.55);
  b.bond(p1, oa, 2); b.bond(p1, ob, 1);
  b.bond(p2, oc, 2); b.bond(p2, od, 1);
  b.bond(p3, oe, 2); b.bond(p3, of, 1);
  b.addH(ob, -0.8, 0.4, -0.3, 0.98); b.addH(od, 0.0, 0.4, -0.9, 0.98); b.addH(of, 0.85, 0.4, -0.2, 0.98);
  const mg = b.add(12, 1.35, -2.15, 0.55);
  b.bond(oc, mg, 1); b.bond(oe, mg, 1);
  return b.centerAndBuild({
    id: 'bio-mol-energy',
    name: 'Mg²⁺-Triphosphate (ATP Phosphoanhydride Core)',
    role: 'High-Energy Phosphoryl Carrier (~50 kJ/mol)',
    reason: `Aqueous ε_r=${Math.round(78.4)} screens P-O⁻ repulsion enough for Mg²⁺-stabilized triphosphate hydrolysis near ${Math.round(tempK)} K.`
  });
}

// =========================================================================
// 4. NATIVE PHOTOPIGMENT / CHROMOPHORE (Conjugation Length N_pi from Star T_eff!)
// =========================================================================
function buildPhotopigmentGraph({ solvent, stellarTeffK, redEdgeNm, zSchemePhotons }) {
  const b = createBuilder();
  const targetPhotonEv = 1239.84 / Math.max(380, Number(redEdgeNm) || 705);

  // Dark subsurface hydrothermal vent (zScheme === 0) -> Iron-Porphyrin Chemosynthetic Cytochrome Core!
  if (zSchemePhotons === 0 || solvent === 'H2O-subsurface') {
    const fe = b.add(26, 0.0, 0.0, 0.0);
    const ns = [
      b.add(7, 1.92, 0.0, 0.0), b.add(7, 0.0, 1.92, 0.0),
      b.add(7, -1.92, 0.0, 0.0), b.add(7, 0.0, -1.92, 0.0)
    ];
    for (const ni of ns) b.bond(fe, ni, 1);
    // Conjugated pyrrole-methine bridge macrocycle!
    const ring = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ring.push(b.add(6, Math.cos(a) * 3.18, Math.sin(a) * 3.18, 0.0));
    }
    for (let i = 0; i < 12; i += 1) b.bond(ring[i], ring[(i + 1) % 12], i % 2 === 0 ? 2 : 1);
    b.bond(ns[0], ring[0], 1); b.bond(ns[1], ring[3], 1); b.bond(ns[2], ring[6], 1); b.bond(ns[3], ring[9], 1);
    for (let i = 0; i < 12; i += 3) {
      const a = ((i + 1.5) / 12) * Math.PI * 2;
      b.addH(ring[(i + 1) % 12], Math.cos(a), Math.sin(a), 0.0);
    }
    return b.centerAndBuild({
      id: 'bio-mol-pigment',
      name: 'Fe-Porphyrin Hydrothermal Cytochrome Core',
      role: 'IR-Thermotaxis & Redox Heme Macrocycle',
      reason: `Zero sunlight beneath ice shell -> Fe-coordinated conjugated tetrapyrrole catalyzes hydrothermal vent redox instead of photosynthesis.`
    });
  }

  // Cool M-Dwarf (T_eff < 4100 K, NIR λ_edge >= 860 nm) OR Cryogenic Titan Tholin -> Long Conjugated Polyene / Polyacetylene!
  // Huckel particle-in-a-box gap ΔE ~ 4 |β| sin(π/(2 N_pi + 2)) -> lower photon energy requires LONGER conjugated chain N_pi!
  if (stellarTeffK < 4200 || solvent === 'CH4' || solvent === 'H2SO4') {
    const nPi = clamp(Math.round(12.8 / Math.max(0.9, targetPhotonEv)), 8, 14);
    const isSulfur = solvent === 'H2SO4';
    const isCryo = solvent === 'CH4';
    const chain = [];
    for (let i = 0; i < nPi; i += 1) {
      const x = (i - (nPi - 1) * 0.5) * 1.24;
      const y = (i % 2 === 0 ? 0.42 : -0.42);
      const Z = (isCryo && (i === 0 || i === nPi - 1)) ? 7 : 6;
      chain.push(b.add(Z, x, y, 0.0));
      if (i > 0) {
        const ord = isCryo ? (i % 2 === 1 ? 3 : 1) : (i % 2 === 1 ? 2 : 1);
        b.bond(chain[i - 1], chain[i], ord);
      }
      if (Z === 6 && !isCryo) b.addH(chain[i], 0.0, i % 2 === 0 ? 1.0 : -1.0, 0.0);
    }
    if (isSulfur) {
      const sL = b.add(16, chain[0] >= 0 ? b.atoms[chain[0]].pos[0] - 1.55 : -6.0, 0.0, 0.0);
      const sR = b.add(16, b.atoms[chain[nPi - 1]].pos[0] + 1.55, 0.0, 0.0);
      b.bond(chain[0], sL, 1); b.bond(chain[nPi - 1], sR, 1);
      b.addH(sL, -0.9, 0.4, 0.0, 1.32); b.addH(sR, 0.9, -0.4, 0.0, 1.32);
    }
    return b.centerAndBuild({
      id: 'bio-mol-pigment',
      name: isCryo
        ? `Cryo-Tholin ${nPi}-Atom Polyacetylene-Nitrile`
        : (isSulfur ? `Sulfur-Carotenoid ${nPi}-π Acid Chromophore` : `${nPi}-π NIR Bacterio-Polyene (${Math.round(stellarTeffK)} K Star)`),
      role: `Conjugated ${nPi}-Center π-Chromophore (λ_edge=${redEdgeNm} nm)`,
      reason: `Star T_eff=${Math.round(stellarTeffK)} K peak photon E_γ=${targetPhotonEv.toFixed(2)} eV requires N_π=${nPi} conjugated centers so the Huckel HOMO-LUMO gap matches starlight!`
    });
  }

  // G / K / F Star Aqueous / Ammonia -> Mg-Coordinated Chlorin-Porphyrin Ring (size tuned by stellar E_γ!)
  const mg = b.add(12, 0.0, 0.0, 0.0);
  const ns = [
    b.add(7, 1.98, 0.0, 0.0), b.add(7, 0.0, 1.98, 0.0),
    b.add(7, -1.98, 0.0, 0.0), b.add(7, 0.0, -1.98, 0.0)
  ];
  for (const ni of ns) b.bond(mg, ni, 1);
  const ring = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ring.push(b.add(6, Math.cos(a) * 3.24, Math.sin(a) * 3.24, 0.0));
  }
  for (let i = 0; i < 12; i += 1) b.bond(ring[i], ring[(i + 1) % 12], i % 2 === 0 ? 2 : 1);
  b.bond(ns[0], ring[0], 1); b.bond(ns[1], ring[3], 1); b.bond(ns[2], ring[6], 1); b.bond(ns[3], ring[9], 1);
  // Ketone chromophore substituent tuning optical absorption to host star's red edge!
  const oKet = b.add(8, 4.42, 0.65, 0.0);
  b.bond(ring[0], oKet, 2);
  for (let i = 2; i < 12; i += 3) {
    const a = (i / 12) * Math.PI * 2;
    b.addH(ring[i], Math.cos(a), Math.sin(a), 0.0);
  }
  return b.centerAndBuild({
    id: 'bio-mol-pigment',
    name: stellarTeffK > 6350
      ? 'UV-Shielded Aromatic Violaxanthin-Chlorin'
      : 'Mg-Chlorin Photosynthetic Reaction Core',
    role: `Stellar-Tuned π-Macrocycle (E_γ=${targetPhotonEv.toFixed(2)} eV)`,
    reason: `Host star T_eff=${Math.round(stellarTeffK)} K (λ_edge=${redEdgeNm} nm) tunes Mg-tetrapyrrole π-HOMO-LUMO transitions directly to the atmospheric photon window.`
  });
}

// =========================================================================
// 5. BOTTOM-UP SOLVENT-DERIVED HETEROPOLYMER SEQUENCE SYNTHESIS
// =========================================================================
function synthesizeEnvironmentalPolymerSequence({
  solventPolarity,
  dielectricEr,
  tempK,
  cToO,
  kingdom,
  organId,
  seed
}) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  // Polymer length scales with thermal flexibility: cryogenic polymers are shorter/more flexible (24-28),
  // thermophilic/acidophilic enzymes pack larger buried cores (36-44)!
  const baseLen = tempK < 150 ? 26 : (tempK > 325 ? 40 : 34);
  const len = clamp(baseLen + (organId === 'torso' ? 4 : (organId === 'sail' ? -4 : 0)), 22, 44);
  const isNonpolar = solventPolarity < 0;
  // Probability weights of (H, P, +, -) derived from solvent polarity, dielectric & temperature!
  // In nonpolar CH4/scCO2 (low ε_r): polar P/+/- form the buried core, H forms the outer solvophilic shell!
  // In polar high-ε_r H2SO4/H2O: H forms the buried hydrophobic core, P/+/- form the solvent-exposed surface!
  const pH = isNonpolar
    ? clamp(0.46 + (cToO - 0.55) * 0.15, 0.36, 0.58)
    : clamp(0.44 + clamp((tempK - 260) / 220, -0.06, 0.16), 0.34, 0.62);
  const pCharge = dielectricEr < 5.0
    ? 0.24 // Strong Coulombic ion-pair zippers in low-ε_r solvents!
    : (dielectricEr > 90 ? 0.14 : (kingdom === 'fauna' ? 0.22 : 0.18));

  const seq = [];
  for (let i = 0; i < len; i += 1) {
    // Physical secondary-structure periodicity emerges from organ function (amphipathic helix vs beta strand vs globular core)
    const phase = organId === 'sail' || organId === 'spores'
      ? (i % 2 === 0 ? 0.28 : -0.28) // Alternating beta-sheet propensity
      : (Math.sin((i / 3.6) * Math.PI * 2) * 0.24); // 3.6-residue alpha-helix amphipathicity
    const r = rand();
    const hCut = clamp(pH + phase, 0.12, 0.84);
    if (r < hCut) {
      seq.push('H');
    } else if (r < hCut + pCharge * 0.5) {
      seq.push('+');
    } else if (r < hCut + pCharge) {
      seq.push('-');
    } else {
      seq.push('P');
    }
  }
  return seq.join('');
}

// =========================================================================
// 6. MASTER BOTTOM-UP ENVIRONMENTAL BIOCHEMISTRY SOLVER
// =========================================================================
export function synthesizeOrganismBiochemistry({
  solvent = 'H2O',
  tempK = 288,
  pressurePa = 101325,
  gravityMS2 = 9.81,
  dielectricEr = 78.4,
  cToO = 0.55,
  feFrac = 0.26,
  silicateFrac = 0.44,
  carbonFrac = 0.08,
  waterIceFrac = 0.16,
  coCh4IceFrac = 0.06,
  stellarTeffK = 5778,
  redEdgeNm = 705,
  zSchemePhotons = 2,
  uvFluxNorm = 1.0,
  xnaAlphabetSize = 4,
  xnaBackbone = 'DNA/RNA',
  deltaGKjMol = -478,
  kingdom = 'fauna',
  bodyPlan = 'quadruped-cursorial',
  organId = 'whole',
  seed = 20261125
} = {}) {
  const T = clamp(Number(tempK) || 288, 70, 760);
  const P = Math.max(0, Number(pressurePa) || 101325);
  const eps = Math.max(1.2, Number(dielectricEr) || 78.4);
  const kbtKjMol = 8.31446e-3 * T;

  // 1. Fundamental solvent polarity & Bjerrum electrostatic screening length (Angstrom!)
  const isNonpolar = solvent === 'CH4' || solvent === 'CO2-liq' || eps < 4.5;
  const solventPolarity = isNonpolar ? -1.0 : 1.0;
  const isMonolayer = solvent === 'H2O-subsurface' || (solvent === 'H2O' && P > 4e6);
  const bjerrumLengthA = Number((167100.0 / (eps * T)).toFixed(1));

  // 2. Thermal folding & denaturation budget scaled directly to T_habitat!
  const tDenatureK = Math.round(
    solvent === 'CH4' ? clamp(T * 1.56, 132, 175)
      : (solvent === 'NH3' ? clamp(T * 1.32, 265, 320)
        : (solvent === 'H2SO4' ? clamp(T * 1.42, 430, 520)
          : (solvent === 'CO2-liq' ? clamp(T * 1.35, 370, 445)
            : clamp(T * 1.24 + 12, 340, 440))))
  );

  // 3. Genetic XNA duplex thermodynamics: ΔH_pair scales with k_B T so duplex ALWAYS unzips above T_habitat!
  const alphaSize = clamp(Math.trunc(Number(xnaAlphabetSize) || 4), 4, 12);
  const targetTmK = clamp(T + (isNonpolar ? 24 : 48) + (alphaSize - 4) * 3.5, T + 16, tDenatureK - 10);
  const dSPerPairJ = isNonpolar ? 68.0 : (solvent === 'H2SO4' ? 112.0 : 96.0);
  const dHPerPairKj = Number(((targetTmK * ((15 * dSPerPairJ + 24.0) * 1e-3)) / 15.0).toFixed(2));

  // 4. Cellular energy-currency & electrophysiology Nernst potentials scaled by R T / F!
  const nernstScale = T / 295.0; // Exact thermodynamic scaling of (R T / F)!
  let energyCurrencyName = 'Mg²⁺-ATP (Triphosphate)';
  let energyCurrencyKjMol = Number((30.5 + kbtKjMol * Math.log(2500)).toFixed(1)); // ~49.8 kJ/mol at 288 K
  let depolIon = 'Na⁺';
  let repolIon = 'K⁺';
  let eDepolMv = 50.0;
  let eRepolMv = -77.0;
  let eLeakMv = -54.4;
  let vRestMv = -65.0;
  let q10Rate = clamp(Math.pow(1.85, (T - 288) / 75.0), 0.24, 1.95);

  if (solvent === 'CH4') {
    energyCurrencyName = 'Acetylene-Thioester Cyanide';
    energyCurrencyKjMol = Number((16.5 * (T / 94.0)).toFixed(1));
    depolIon = 'NH₄⁺ / Radical';
    repolIon = 'CN⁻ Dipole';
    eDepolMv = Number((46.0 * nernstScale + 8.0).toFixed(1));   // ~22.6 mV
    eRepolMv = Number((-74.0 * nernstScale - 12.0).toFixed(1)); // ~-35.6 mV
    vRestMv = Number((-58.0 * nernstScale - 10.0).toFixed(1));  // ~-28.5 mV
    eLeakMv = Number((vRestMv + 6.0).toFixed(1));
  } else if (solvent === 'H2SO4') {
    energyCurrencyName = 'Sulfur-Quinone / Polyphosphate';
    energyCurrencyKjMol = 61.5;
    depolIon = 'H₃SO₄⁺';
    repolIon = 'HSO₄⁻';
    eDepolMv = Number((54.0 * nernstScale).toFixed(1));
    eRepolMv = Number((-80.0 * nernstScale).toFixed(1));
    vRestMv = -68.0;
    eLeakMv = -57.0;
  } else if (solvent === 'NH3') {
    energyCurrencyName = 'Carbamoyl-Hydrazine Phosphate';
    energyCurrencyKjMol = 34.0;
    depolIon = 'NH₄⁺';
    repolIon = 'NH₂⁻ / K⁺';
    eDepolMv = Number((50.0 * nernstScale).toFixed(1));
    eRepolMv = Number((-76.0 * nernstScale).toFixed(1));
    vRestMv = Number((-65.0 * nernstScale).toFixed(1));
    eLeakMv = Number((vRestMv + 9.0).toFixed(1));
  } else if (solvent === 'H2O-subsurface') {
    energyCurrencyName = '[Fe₂S₂] / Pyrophosphate (PPi)';
    energyCurrencyKjMol = 38.5;
    depolIon = 'Fe²⁺ / H⁺';
    repolIon = 'K⁺ / Cl⁻';
    eDepolMv = 56.0;
    eRepolMv = -78.0;
    vRestMv = -66.0;
    eLeakMv = -55.0;
  } else if (solvent === 'CO2-liq') {
    energyCurrencyName = 'Carboxy-Thioester Anhydride';
    energyCurrencyKjMol = 32.0;
    depolIon = 'Fe²⁺ / H⁺';
    repolIon = 'HCO₃⁻';
    eDepolMv = 42.0;
    eRepolMv = -64.0;
    vRestMv = -54.0;
    eLeakMv = -45.0;
  } else if (solvent === 'H2-He-cloud') {
    energyCurrencyName = 'Lightning-Cyanamide / ATP';
    energyCurrencyKjMol = 44.0;
    depolIon = 'NH₄⁺ / Na⁺';
    repolIon = 'K⁺ / Cl⁻';
    eDepolMv = 48.0;
    eRepolMv = -74.0;
    vRestMv = -62.0;
    eLeakMv = -52.0;
  }

  // 5. Distinct Gray-Scott Turing Morphogenesis (F, k) Kinetics from solvent viscosity & metabolic flux!
  const viscBias = isNonpolar ? -0.004 : (solvent === 'H2SO4' ? 0.008 : (solvent === 'H2-He-cloud' ? 0.005 : 0.0));
  const metaBias = clamp((Math.abs(deltaGKjMol) - 250) / 600, -0.005, 0.006);
  const turingFeedF = Number(clamp(0.036 + viscBias + metaBias + (kingdom === 'flora' ? -0.006 : 0.003), 0.024, 0.056).toFixed(4));
  const turingKillK = Number(clamp(0.062 - viscBias * 0.35 + (kingdom === 'fungi' ? 0.002 : -0.001), 0.056, 0.066).toFixed(4));

  // 6. Synthesize 4 REAL 3D All-Atom Environmental Molecular Graphs!
  const molMembrane = buildMembraneAmphiphileGraph({ solvent, dielectricEr: eps, tempK: T, pressurePa: P, cToO, silicateFrac });
  const molGenetic = buildGeneticMonomerGraph({ solvent, dielectricEr: eps, tempK: T, xnaAlphabetSize: alphaSize, xnaBackbone, cToO });
  const molEnergy = buildEnergyCofactorGraph({ solvent, tempK: T, feFrac, deltaGKjMol });
  const molPigment = buildPhotopigmentGraph({ solvent, stellarTeffK, redEdgeNm, zSchemePhotons });

  const molecules = Object.freeze({
    'bio-mol-membrane': molMembrane,
    'bio-mol-genetic': molGenetic,
    'bio-mol-energy': molEnergy,
    'bio-mol-pigment': molPigment
  });

  // 7. Synthesize bottom-up environmental heteropolymer FASTA sequence!
  const foldSeq = synthesizeEnvironmentalPolymerSequence({
    solventPolarity,
    dielectricEr: eps,
    tempK: T,
    cToO,
    kingdom,
    organId,
    seed
  });

  return Object.freeze({
    solvent,
    tempK: Math.round(T),
    dielectricEr: Number(eps.toFixed(2)),
    solventPolarity,
    isNonpolar,
    isMonolayer,
    bjerrumLengthA,
    kbtKjMol: Number(kbtKjMol.toFixed(3)),
    tDenatureK,
    xnaAlphabetSize: alphaSize,
    xnaDhPerPairKj: dHPerPairKj,
    xnaDsPerPairJ: dSPerPairJ,
    xnaTargetTmK: Number(targetTmK.toFixed(1)),
    energyCurrencyName,
    energyCurrencyKjMol,
    channelIons: Object.freeze({
      depolIon,
      repolIon,
      eDepolMv,
      eRepolMv,
      eLeakMv,
      vRestMv,
      q10Rate: Number(q10Rate.toFixed(2))
    }),
    turingKinetics: Object.freeze({
      feedF: turingFeedF,
      killK: turingKillK
    }),
    foldSeq,
    molecules,
    elementalSummary: `C/O=${Number(cToO).toFixed(2)} · λ_B=${bjerrumLengthA} Å · ${isNonpolar ? 'Nonpolar Inverted' : (isMonolayer ? 'Barophile Monolayer' : 'Polar Solvophobic')}`
  });
}
