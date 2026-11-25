// Documentation, Governing Equations & Provenance Catalog for ULG Organic Chemistry Lab
// (`src/demos/organicLabDocs.js`).

export const ORGANIC_LAB_ABOUT_ULG = Object.freeze({
  title: 'ULG Organic Chemistry Lab — First-Principles Bonding, Chirality, Reactions & Prebiotic Kinetics',
  subtitle: 'Universal Law Graph Nodes #17–19 · Pure Direct-WebGPU HDR Engine · Zero Molecule-Name Hacks',
  overview:
    'Every molecule, orbital, partial charge, acid-base pKa, conformational barrier, and autocatalytic network in this lab emerges strictly from general first-principles laws operating on atomic nuclear charge Z, electronegativity χ, chemical hardness η, bond graph topology, and dielectric screening ε_r — never from hardcoded molecule lookup tables or scripted animations.',
  laws: [
    'Node #17 — organic-molecular-graph-hybridization@1: Automated valence hybridization (sp/sp²/sp³), graph ring & conjugated π-cluster discovery, Gate 0B GPU Jacobi Extended-Hückel π-MO eigenproblem (4n+2 Hückel aromaticity vs 4n anti-aromaticity), Rappé–Goddard QEq charge equilibration, Born dielectric solvation, and exact 3D signed-volume CIP chirality (R/S).',
    'Node #18 — reactive-bond-order-md@1: Parallel WebGPU Langevin Velocity-Verlet molecular dynamics (@workgroup_size(64)) coupling continuous Morse bond-order forces, hybridization angle bending, periodic dihedral torsions, dielectric-screened Coulomb/LJ, emergent directional D–H···A hydrogen bonds, and continuous SN2 Walden inversion / Diels–Alder [4+2] reaction drives.',
    'Node #19 — acid-base-catalysis-kinetics@1: Topology- and resonance-derived Brønsted–Lowry pKa & pH 0..14 speciation with Born ε_r shifts, plus a live 128×128 WebGPU spatial reaction-diffusion solver executing Frank chiral symmetry breaking, Oregonator Belousov–Zhabotinsky spirals, and open-system prebiotic RAF autocatalysis.'
  ],
  falsifiableTests: [
    'Hückel 4n+2 vs 4n: Benzene (6π) stabilizes deeply with a wide HOMO–LUMO gap, whereas Cyclobutadiene (4π) collapses to a degenerate non-bonding diradical (gap = 0 eV, resonance ≈ 0 eV).',
    'Mirror Chirality (R ↔ S): Clicking "Mirror Enantiomer" applies exact (x,y,z) → (−x,y,z) reflection, flipping L-Alanine (S) ↔ D-Alanine (R) while preserving total energy and dipole magnitude.',
    'Frank Chiral Null Limit: Setting chiral antagonism k_inhib → 0 abolishes spontaneous chiral symmetry breaking and leaves the 128×128 field racemic (ee → 0).'
  ]
});

export const ORGANIC_MODE_DOCS = Object.freeze({
  benzene: {
    title: 'Benzene (C₆H₆) — 6π Hückel (4n+2) Aromatic Delocalization',
    badge: '4n+2 Aromatic · GPU Jacobi π-MO',
    scale: '10⁻¹⁰ m',
    equations: [
      'H_π c_k = E_k c_k  (Gate 0B WebGPU Cooperative Jacobi Eigensolver)',
      'E_res = Σ_k n_k E_k − E_localized < 0  (6π closed-shell resonance stabilization)',
      'p_ij = Σ_k n_k c_ik c_jk  (Coulson π-bond order equalized at 2/3 around ring)'
    ],
    whatYouSee:
      'Six planar sp² carbons share a delocalized 6π electron cloud computed live on the GPU. Toggle HOMO / LUMO to inspect the cyan (+) and magenta (−) 2p_z nodal planes above and below the ring, and compare directly against anti-aromatic Cyclobutadiene (C₄H₄) and red-shifted Naphthalene (C₁₀H₈).',
    experiments: [
      'Switch to Cyclobutadiene (C₄H₄): watch the HOMO–LUMO gap collapse to 0 eV and resonance energy vanish!',
      'Switch to Naphthalene (C₁₀H₈): watch the 10π conjugated system narrow the HOMO–LUMO gap and red-shift UV-Vis λ_max.',
      'Raise Temperature T to 800 K to observe thermal C–H and ring-breathing vibrations in live GPU MD.'
    ]
  },
  cyclobutadiene: {
    title: 'Cyclobutadiene (C₄H₄) — 4π Anti-Aromatic Diradical Contrast',
    badge: '4n Anti-Aromatic · Degenerate E=0',
    scale: '10⁻¹⁰ m',
    equations: [
      'Hückel 4-ring eigenvalues: E = α + 2β, α, α, α − 2β',
      'Hund occupancy of degenerate non-bonding pair → HOMO–LUMO gap = 0 eV',
      'E_res = 0 eV (zero aromatic stabilization vs two isolated C=C bonds)'
    ],
    whatYouSee:
      'With only 4π electrons (4n, n=1), the exact same GPU Hückel eigensolver that stabilizes Benzene naturally produces a doubly degenerate non-bonding frontier shell with zero HOMO–LUMO gap — demonstrating Hückel’s rule without a single aromaticity lookup table.',
    experiments: [
      'Inspect Plot 1 (π-MO Energy Levels): observe the two half-filled non-bonding orbitals sitting directly at E = 0 eV.',
      'Compare back-to-back with Benzene (C₆H₆) to see the closed-shell gap open immediately.'
    ]
  },
  naphthalene: {
    title: 'Naphthalene (C₁₀H₈) — Fused 10π Polycyclic Aromatic Hydrocarbon',
    badge: '10π Aromatic · Red-Shifted UV-Vis',
    scale: '10⁻¹⁰ m',
    equations: [
      '10×10 Hückel π-Hamiltonian solved via WebGPU Jacobi eigensolver',
      'λ_max = hc / ΔE_(HOMO→LUMO)  (longer conjugation → smaller gap → longer λ_max)'
    ],
    whatYouSee:
      'Extending conjugation across two fused sp² rings (10π electrons = 4(2)+2) increases nodal richness in the frontier orbitals and shifts UV-Vis absorption toward longer wavelengths.',
    experiments: [
      'Cycle through HOMO−1, HOMO, LUMO, LUMO+1 to inspect the shifting nodal planes across the fused ring bridge.'
    ]
  },
  butadiene: {
    title: '1,3-Butadiene (C₄H₆) — Linear Conjugated 4π Polyene',
    badge: '4π Linear Conjugation',
    scale: '10⁻¹⁰ m',
    equations: [
      '4-center linear π-chain: partial central C2–C3 Coulson bond order p₂₃ > 0.4',
      'V(φ) = V₂(1 − cos 2φ) enforces planar s-trans π-overlap'
    ],
    whatYouSee:
      'Electron delocalization across C1=C2–C3=C4 gives the central C2–C3 bond partial double-bond character and locks the molecule near s-trans planarity.',
    experiments: [
      'Toggle MO orbitals between bonding (MO 0, zero internal nodes) and HOMO (1 central node) to see why C2–C3 resists twisting.'
    ]
  },
  adenine: {
    title: 'Adenine (C₅H₅N₅) — Heteroaromatic Purine Nucleobase',
    badge: '10π Heteroaromatic · H-Bond Edges',
    scale: '10⁻¹⁰ m',
    equations: [
      'Heteroatom Hückel α_N = α_C − 0.5|β| + QEq electronegativity χ_N > χ_C',
      'Polarized N–H donors (q_H > +0.2) & ring =N– acceptors (q_N < −0.3) enable base pairing'
    ],
    whatYouSee:
      'Five nitrogens polarize the planar 10π purine ring, creating strong alternating electrostatic donor/acceptor edges — the direct chemical bridge from organic heteroaromatics to Watson–Crick genetic replication in the Life Lab!',
    experiments: [
      'Toggle "ESP Charge Colors" to see the sharply polarized blue (+) donor hydrogens and red (−) ring nitrogen acceptors.',
      'Sweep pH from 1 to 13 in Plot 3 to observe protonation of the basic imine ring nitrogens.'
    ]
  },
  cyclohexane: {
    title: 'Cyclohexane (C₆H₁₂) — Strain-Free sp³ Chair Conformation & Ring Flips',
    badge: 'sp³ Torsional MD · Chair–Boat',
    scale: '10⁻¹⁰ m',
    equations: [
      'θ_eq(sp³) = 109.47°  (zero angle strain in puckered chair)',
      'V_tors(φ) = Σ V₃(1 + cos 3φ)  (staggered axial/equatorial C–H bonds)'
    ],
    whatYouSee:
      'All six carbons are tetrahedral sp³ centers (zero π-MOs). Live GPU Langevin MD maintains the staggered chair geometry at 300 K and excites dynamic chair–boat conformational fluctuations when heated.',
    experiments: [
      'Slide Temperature T from 150 K up to 850 K to watch thermal ring-puckering and axial/equatorial fluctuations intensify.'
    ]
  },
  butane: {
    title: 'n-Butane (C₄H₁₀) — Canonical sp³ Dihedral Rotor (Anti / Gauche / Eclipsed)',
    badge: 'Dihedral Potential V(φ)',
    scale: '10⁻¹⁰ m',
    equations: [
      'V(φ) = V₁(1+cos φ)/2 + V₃(1+cos 3φ)/2  + steric H···H LJ repulsion',
      'Global minimum: anti (φ = 180°); local minima: gauche (φ = ±60°)'
    ],
    whatYouSee:
      'Live GPU conformational dynamics around the central C2–C3 bond, paired with Plot 2 showing the exact rotational energy profile across anti, gauche, and eclipsed states.',
    experiments: [
      'Heat T above 600 K to watch thermal barrier crossings between anti and gauche conformers in real time.'
    ]
  },
  'l-alanine': {
    title: 'L-Alanine (C₃H₇NO₂) — Chiral (S)-Amino Acid & Zwitterionic pH Titration',
    badge: 'Chiral (S) · Amphoteric pKa',
    scale: '10⁻¹⁰ m',
    equations: [
      'Signed tetrahedral volume det[r₁−r₀, r₂−r₀, r₃−r₀] ranked by atomic CIP priority → (S) vs (R)',
      'Q(pH) = +1/(1+10^(pH−pKa₂)) − 1/(1+10^(pKa₁−pH))  (Zwitterion near pH 6!)'
    ],
    whatYouSee:
      'The α-carbon bonds to four distinct substituents (–NH₂, –COOH, –CH₃, –H), giving a nonzero 3D stereocenter. Plot 3 displays the emergent two-step amphoteric titration curve from cationic (+1) at low pH through the neutral zwitterion to anionic (−1) at high pH.',
    experiments: [
      'Click "🪞 Mirror Enantiomer" to reflect (x,y,z) → (−x,y,z) and watch CIP chirality flip cleanly (S) ↔ (R) with identical dipole moment!',
      'Sweep Dielectric ε_r from 78.4 (Water) down to 2.0 (Nonpolar) to watch the Born solvation shift push acid pKa sharply upward.'
    ]
  },
  'd-alanine': {
    title: 'D-Alanine (C₃H₇NO₂) — Exact Mirror-Image (R)-Enantiomer',
    badge: 'Chiral (R) · Mirror Enantiomer',
    scale: '10⁻¹⁰ m',
    equations: [
      'Parity reflection P: r → (−x, y, z) inverts signed stereocenter volume while conserving |μ| and E'
    ],
    whatYouSee:
      'Exact spatial mirror image of L-Alanine. Identical intramolecular physics in an achiral environment — proving why biological homochirality requires an autocatalytic symmetry-breaking mechanism (see Frank Chiral Network below!).',
    experiments: [
      'Click "🪞 Mirror Enantiomer" to toggle back and forth between (R) and (S) hands live in 3D.'
    ]
  },
  ethanol: {
    title: 'Ethanol (C₂H₆O) — Polar Protic Isomer (Compare With Dimethyl Ether!)',
    badge: 'C₂H₆O Isomer · Protic O–H',
    scale: '10⁻¹⁰ m',
    equations: [
      'Identical formula C₂H₆O to Dimethyl Ether, yet O–H polarity creates strong QEq q_H > +0.24 & H-bond donation'
    ],
    whatYouSee:
      'Toggle between Ethanol and Dimethyl Ether to see how changing ONLY bond connectivity (same atoms!) transforms dipole moment, electrostatic potential, and protic acidity.',
    experiments: [
      'Turn on "ESP Charge Colors", note the bright blue acidic O–H proton, then click "Dimethyl Ether" to watch it vanish!'
    ]
  },
  'dimethyl-ether': {
    title: 'Dimethyl Ether (C₂H₆O) — Aprotic Constitutional Isomer of Ethanol',
    badge: 'C₂H₆O Isomer · Zero O–H Donors',
    scale: '10⁻¹⁰ m',
    equations: [
      'C–O–C connectivity eliminates protic O–H sites (0 acidic protons, weaker intermolecular cohesion)'
    ],
    whatYouSee:
      'Exact same C₂H₆O stoichiometry as Ethanol, yet zero protic O–H donors emerge from topology — demonstrating isomer emergence strictly from bond graphs.',
    experiments: [
      'Compare Plot 3 (Titration) and Dipole Moment directly against Ethanol.'
    ]
  },
  'ethanol-water-hbond': {
    title: 'Ethanol–Water Hydrogen-Bonding Network (Emergent Directional D–H···A)',
    badge: 'Live GPU H-Bonds · Dielectric ε_r',
    scale: '10⁻¹⁰ m',
    equations: [
      'E_HB = −ε_HB · f(r_HA) · cos⁴(θ_DHA)  activated purely when q_H > +0.16 & q_A < −0.22',
      'Screened Coulomb: F_coul = k_e q_i q_j / (ε_r r²)'
    ],
    whatYouSee:
      'Dashed glowing cyan hydrogen-bond beams form and break dynamically in 3D GPU MD purely from QEq partial charges and D–H···A geometry — zero pre-wired H-bond indices!',
    experiments: [
      'Raise Temperature T above 650 K to watch thermal agitation dynamically rupture the cyan hydrogen-bond network!',
      'Lower T to 150 K to watch the polar network lock into crisp directional H-bonds.'
    ]
  },
  'acetic-acid': {
    title: 'Acetic Acid (CH₃COOH) — Carboxylate Resonance pKa & Born Dielectric Shift',
    badge: 'Resonance Acid · pKa ≈ 4.7',
    scale: '10⁻¹⁰ m',
    equations: [
      'Adjacent C=O π-withdrawal delocalizes negative charge on –COO⁻, dropping pKa by ~11 units vs ethanol!',
      'ΔpKa_Born = C_Born · (1/ε_r − 1/78.4)  (nonpolar solvents suppress ionization)'
    ],
    whatYouSee:
      'The carbonyl π-cloud stabilizes the deprotonated conjugate base, shifting the sigmoid inflection in Plot 3 cleanly down to pH ~4.7 in water.',
    experiments: [
      'Sweep pH from 1 → 9 to track deprotonated acetate fraction [CH₃COO⁻] / C_tot.',
      'Lower Solvent Dielectric ε_r from 78.4 → 4.0 and watch pKa shift steeply upward in Plot 3!'
    ]
  },
  'sn2-walden': {
    title: 'SN2 Backside Attack (Cl⁻ + CH₃Br → ClCH₃ + Br⁻) — Walden Umbrella Inversion',
    badge: 'Reactive Bond-Order MD · Inversion',
    scale: '10⁻¹⁰ m',
    equations: [
      'Continuous bond orders: b_C–Cl(ξ) increases 0→1 while b_C–Br(ξ) cleaves 1→0',
      'Planar pentacoordinate transition state at ξ = 0.50 flips the three C–H bonds like an umbrella!'
    ],
    whatYouSee:
      'Scrub Reaction Drive ξ (or let Auto-Cycle play) to watch Cl⁻ attack from 180° backside as the C–Cl bond tube thickens smoothly, the central CH₃ passes through a planar trigonal-bipyramidal transition state, and Br⁻ departs with complete stereochemical inversion.',
    experiments: [
      'Pause Auto-Cycle and drag Reaction Drive ξ slowly across 0.45–0.55 to inspect the planar pentacoordinate transition state!'
    ]
  },
  'diels-alder': {
    title: 'Diels–Alder [4+2] Cycloaddition (1,3-Butadiene + Ethene → Cyclohexene)',
    badge: 'Pericyclic [4+2] · Concerted Ring Closure',
    scale: '10⁻¹⁰ m',
    equations: [
      'Concerted synchronous bond-order flow: two new σ C–C bonds form while central C2–C3 gains π bond order',
      'Woodward–Hoffmann thermally allowed [π4s + π2s] ring synthesis'
    ],
    whatYouSee:
      'Watch a 4π diene and 2π dienophile converge synchronously in 3D GPU MD, dynamically forging two new σ-bonds to snap shut into a six-membered cyclohexene ring!',
    experiments: [
      'Toggle Auto-Cycle or drag Reaction Drive ξ from 0 → 1 to observe continuous σ-bond formation and π-bond redistribution.'
    ]
  },
  'frank-chiral': {
    title: 'Frank Autocatalytic Chiral Symmetry Breaking (Origin of Biological Homochirality)',
    badge: '128×128 WebGPU RD · L vs D Domains',
    scale: '10⁻⁶ m',
    equations: [
      '∂L/∂t = D∇²L + k_a A·L − k_inhib L·D − k_d L   (cyan = L-enantiomer)',
      '∂D/∂t = D∇²D + k_a A·D − k_inhib L·D − k_d D   (magenta = D-enantiomer)',
      'Enantiomeric excess ee = (L − D)/(L + D) spontaneously breaks symmetry when k_inhib > 0!'
    ],
    whatYouSee:
      'Starting from a nearly 50/50 racemic soup with tiny thermal noise, mutual chiral antagonism (L + D → inactive P) amplifies microscopic fluctuations into pure electric-cyan (L) and vivid-magenta (D) homochiral domains separated by dark racemic walls.',
    experiments: [
      'Falsifiable Null Limit: Slide Mutual Antagonism k_inhib down to 0.0 — chiral symmetry breaking collapses and the field returns to a mixed racemic state!'
    ]
  },
  'belousov-zhabotinsky': {
    title: 'Belousov–Zhabotinsky Oregonator — Non-Equilibrium Chemical Spiral Waves',
    badge: '128×128 WebGPU RD · Spiral Waves',
    scale: '10⁻⁴ m',
    equations: [
      'ε ∂u/∂t = D_u∇²u + u(1 − u) − f·v·(u − q)/(u + q)',
      '∂v/∂t = D_v∇²v + u − v'
    ],
    whatYouSee:
      'Far-from-equilibrium autocatalytic oxidation waves self-organize into rotating incandescent-gold and cyan spiral rotors directly on the GPU.',
    experiments: [
      'Adjust Feed Rate / Excitability to modulate spiral wave curvature and firing cadence.'
    ]
  },
  'prebiotic-raf': {
    title: 'Prebiotic Open-System Autocatalytic RAF Network (Feedstock → Catalyst → Polymer)',
    badge: '128×128 WebGPU RD · Open-System Metabolism',
    scale: '10⁻⁶ m',
    equations: [
      '∂F/∂t = D_F∇²F + Feed·(1 − F) − k₁ F·X',
      '∂X/∂t = D_X∇²X + k₁ F·X + k₂ F·Y − k_d X   (emerald autocatalyst)',
      '∂Y/∂t = D_Y∇²Y + k₃ X²·F − k_p Y           (violet catalytic polymer)'
    ],
    whatYouSee:
      'An open chemical reactor driven by continuous feedstock flux sustains self-reproducing emerald autocatalyst + violet polymer islands — bridging abiotic organic chemistry directly into protocellular life.',
    experiments: [
      'Drop Feedstock Flux toward 0 to observe thermodynamic extinction when free-energy throughput stops!'
    ]
  }
});
