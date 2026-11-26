// Documentation, Governing Equations & Provenance Catalog for ULG Biophysics & Emergent Life Lab
// (`src/demos/lifeLabDocs.js`).

export const LIFE_LAB_ABOUT_ULG = Object.freeze({
  title: 'ULG Biophysics & Emergent Life Lab — From Hydrophobic Membranes to Active Morphogenesis',
  subtitle: 'Universal Law Graph Nodes #20–24 · Pure Direct-WebGPU HDR Engine · Zero Organism/Protein Hacks',
  overview:
    'Life is not coded as an axiom in ULG — it emerges strictly from physics! Across five coupled mesoscale regimes, every vesicle, folded protein core, catalytic pocket, error-threshold quasispecies, ATP synthesis flux, neural action potential spiral, and chemotactic Turing colony arises from general continuous potentials and PDEs running natively on WebGPU.',
  laws: [
    'Node #20 — amphiphile-membrane-self-assembly@1: 3-bead amphiphile Langevin MD where strictly hydrophobic tail-tail attraction ε_hp and steric head repulsion drive spontaneous micelle/bilayer/protocell vesicle assembly (setting ε_hp = 0 dissolves everything back to an isotropic gas!).',
    'Node #21 — biopolymer-folding-catalysis@1: Arbitrary monomer sequences over {H, P, +, −} fold spontaneously via hydrophobic collapse, backbone i→i+4 hydrogen bonds, and salt bridges, creating a measurable 3D pocket electric field |E_pocket| that lowers Eyring reaction barriers (heating above 650 K denatures the fold and abolishes catalysis!).',
    'Node #22 — template-replication-evolution@1: Nearest-neighbor 2- vs 3-H-bond complementary duplex melting thermodynamics T_m(f_strong) paired with a live 1,024-replicator GPU population exhibiting Eigen’s Error Threshold (μ < μ_crit adaptive quasispecies vs μ > μ_crit error catastrophe!).',
    'Node #23 — chemiosmotic-bioenergetics-electrophysiology@1: Exact Mitchell proton-motive force Δp = |Δψ| + (2.303 RT/F)|ΔpH| driving ATP synthesis (strictly 0 when Δp = 0 or protonophore uncoupler = 1) + 128×128 WebGPU Rush–Larsen Hodgkin–Huxley excitable membrane action-potential spirals (g_Na = 0 TTX block silences spikes!).',
    'Node #24 — reaction-diffusion-active-matter@1: Coupled 128×128 Gray–Scott Turing morphogenesis PDE (D_u > D_v diffusion-driven instability) steering 2,048 self-propelled run-and-tumble chemotactic agents climbing live morphogen gradients!'
  ],
  falsifiableTests: [
    'Hydrophobic Null Limit (ε_hp = 0): Amphiphiles disperse isotropically; raising ε_hp restores cohesive hydrophobic cores.',
    'Thermal Denaturation (T > 650 K): Folded biopolymers unfold (R_g expands) and electrostatic catalytic boost collapses toward 1×.',
    'Eigen Error Catastrophe (μ > μ_crit): Raising copy mutation rate above ln(σ)/L destroys sequence identity across all 1,024 replicators.',
    'Chemiosmotic & TTX Null Limits: Setting Δp = 0 or Uncoupler = 1 yields exact 0 ATP flux; setting g_Na = 0 extinguishes all action-potential waves.',
    'Active Chemotaxis Null Limit (v_0 = 0 or Chemo Gain = 0): Chemotactic colony enrichment collapses to uniform random dispersion.'
  ]
});

export const LIFE_MODE_DOCS = Object.freeze({
  'organism-overview': {
    title: 'Interactive Xenobiology Specimen Vivarium / Containment Aquarium',
    badge: '3D Organism Overview · Interactive Lab',
    scale: '10⁻¹ → 10⁺¹ m',
    equations: [
      'Kleiber Allometry: BMR = B₀ · M^0.75 · Q₁₀^((T − T_ref)/10)  |  Euler Buckling: H_max ∝ (E / ρg)^(1/3)',
      'Bains–Petkowski–Seager (2024) 7-Solvent Framework + Kiang/Lehmer Multi-Photon Z-Scheme Photobiology',
      'Thermodynamic Redox Yield ΔG (kJ/mol e⁻) + NutMEG Biomass Scaling + 4–12 Letter XNA Eigen Threshold'
    ],
    whatYouSee:
      'A live, self-behaving alien organism (creature, plant, fungus, aero-leviathan, or chemotroph) housed inside a containment vivarium replicating its homeworld solvent, temperature, and host-star spectrum. Select a tool (Inspect, Probe, Heat, Cool, Neuro-Stim, or Biopsy) and click directly on ANY anatomical part to trigger physical, behavioral, and physiological responses or drill straight into its cellular membranes, folded proteins, XNA, and neural waves!',
    experiments: [
      'Click 👉 Probe on a creature’s head vs torso vs limbs, or on a fungus cap (eruption of glowing spores!) or plant frond (seismonastic leaf folding!).',
      'Click 🔥 Heat repeatedly to watch Q₁₀ metabolic rate surge, radiator sails flush, and thermal stress warnings near T_denature — then click 💉 Biopsy to inspect live protein unfolding in Layer 2!',
      'Switch world clades in the Vivarium selector to compare Fauna, Flora, and Fungi evolved under H₂O, Titan CH₄, M-Dwarf NIR, Venus H₂SO₄, Europa vents, and Jovian cloud decks.'
    ]
  },
  'lipid-soup': {
    title: 'Amphiphile Spontaneous Self-Assembly (Hydrophobic Micelles & Proto-Bilayers)',
    badge: '3-Bead GPU MD · ε_hp Self-Assembly',
    scale: '10⁻⁸ m',
    equations: [
      'U_tail–tail(r) = −ε_hp · cos²(π(r − r_c)/(2 w_c))  (entropic hydrophobic attraction)',
      'U_head–head(r) = WCA purely repulsive steric hydration shell',
      'Null limit: ε_hp = 0 → isotropic dispersed amphiphile gas!'
    ],
    whatYouSee:
      'Cyan hydrophilic headgroups shield warm golden hydrophobic tail pairs away from water, spontaneously coalescing from a disordered soup into dense micelles and bilayer sheets directly on the GPU.',
    experiments: [
      'Falsifiable Null Limit: Slide Hydrophobic Coupling ε_hp to 0.0 and watch all micelles immediately dissolve into an isotropic gas!',
      'Raise ε_hp back to 2.0 to watch spontaneous re-condensation and hydrophobic tail coordination climb in Plot 1.'
    ]
  },
  'protocell-vesicle': {
    title: 'Closed 3D Protocell Vesicle (Double-Leaflet Osmotic Compartmentalization)',
    badge: '3D Double-Leaflet Vesicle · Osmosis',
    scale: '10⁻⁷ m',
    equations: [
      'Inner & outer leaflets orient cyan polar heads toward aqueous compartments and lock golden tails inside the bilayer core',
      'Radial osmotic stress ΔP_osm expands or compresses vesicle radius R_vesicle dynamically'
    ],
    whatYouSee:
      'A 3D spherical bilayer compartment separating an interior lumen from the exterior environment — the physical prerequisite for retaining catalytic polymers and transmembrane ion gradients.',
    experiments: [
      'Adjust Osmotic Pressure to watch the vesicle swell or contract live in 3D.',
      'Drop ε_hp to 0.0 or heat T above 650 K to watch the membrane lose integrity and rupture!'
    ]
  },
  'lipid-bilayer': {
    title: 'Planar Fluid Mosaic Lipid Bilayer Patch',
    badge: 'Fluid Bilayer · Lateral Diffusion',
    scale: '10⁻⁸ m',
    equations: [
      'Two opposing amphiphile monolayers held together strictly by hydrophobic tail sequestration (zero hardcoded plane constraint!)'
    ],
    whatYouSee:
      'A self-held fluid bilayer patch exhibiting thermal undulations and lateral fluidity while maintaining a hydrophobic core barrier.',
    experiments: [
      'Sweep Temperature T from 200 K (gel-like) to 550 K (fluid/disordered) to observe thermal bilayer undulations.'
    ]
  },
  'amphipathic-helix-bundle': {
    title: 'Amphipathic Helix-Turn-Helix Catalyst (36-mer Biopolymer Folding)',
    badge: 'GPU Heteropolymer MD · Eyring Catalysis',
    scale: '10⁻⁹ m',
    equations: [
      'Monomer alphabet: H (hydrophobic gold), P (polar teal), + (cationic blue), − (anionic coral)',
      'U = U_backbone + U_steric + U_HBond(i→i+4) + U_HP(H–H) + U_Coul(q_i q_j / ε_r r)',
      'k_cat / k_0 = exp(ΔΔG‡_elec(|E_pocket|) / RT)'
    ],
    whatYouSee:
      'A 36-monomer chain with periodic amphipathic heptads folds spontaneously in 3D GPU Langevin MD into a compact core with an electrostatically preorganized (+/−) catalytic cleft.',
    experiments: [
      'Thermal Denaturation Test: Slide Temperature T from 300 K up to 750 K — watch the compact folded enzyme unwind (R_g expands in Plot 1) and catalytic rate boost collapse in Plot 2!',
      'Edit the H/P/+/- sequence directly in the sidebar and click Apply Sequence to fold ANY custom polymer!'
    ]
  },
  'globular-hydrophobic-core': {
    title: 'Globular Hydrophobic-Core Enzyme (44-mer Collapse & Active Cleft)',
    badge: '44-mer Globular Fold · Pocket |E|',
    scale: '10⁻⁹ m',
    equations: [
      'Buried golden H-residues minimize solvent exposure while positioning charged (+/−) residues around a rigid electrostatic pocket'
    ],
    whatYouSee:
      'A longer 44-residue heteropolymer collapsing rapidly from an extended random coil into a dense hydrophobic core.',
    experiments: [
      'Reduce Hydrophobic Coupling ε_hp toward 0 to prove that hydrophobic sequestration drives core collapse.'
    ]
  },
  'beta-hairpin-fold': {
    title: 'Antiparallel Polar-Hydrophobic Hairpin (28-mer Zipping & Salt Bridges)',
    badge: '28-mer Hairpin · Electrostatic Zip',
    scale: '10⁻⁹ m',
    equations: [
      'Alternating H–P strands zip via inter-strand hydrophobic contacts and complementary (+)/(−) salt bridges'
    ],
    whatYouSee:
      'An alternating amphipathic hairpin motif demonstrating how sequence patterning alone dictates 3D tertiary fold geometry.',
    experiments: [
      'Lower ε_hbond vs ε_hp to isolate helical backbone H-bonding from hydrophobic collapse.'
    ]
  },
  'quasispecies-evolution': {
    title: 'Template Replication, Duplex Melting & Eigen Error Threshold (1,024 GPU Replicators)',
    badge: '1,024 GPU Replicators · Eigen μ_crit',
    scale: '10⁻⁸ m',
    equations: [
      'Two-state van ’t Hoff duplex melting: θ(T) = K(T)/(1+K(T)),  T_m increases with 3-H-bond pair fraction f_strong',
      'Replication fitness w_i = exp(−β · d_Hamming(seq_i, motif*))',
      'Eigen Error Threshold: μ_crit = ln(σ) / L  (adaptive quasispecies below μ_crit, error catastrophe above!)'
    ],
    whatYouSee:
      '1,024 evolving oligomer replicators arranged in 3D fitness-radial space: bright emerald-green organisms cluster tightly near the catalytic core when mutation rate μ < μ_crit, then explosively delocalize into purple random-sequence noise the moment μ crosses Eigen’s Error Threshold!',
    experiments: [
      'Falsifiable Eigen Catastrophe: Slide Mutation Rate μ from 0.02 (emerald quasispecies locked on core) up to 0.35 (above μ_crit) and watch sequence identity collapse in real time!',
      'Adjust Strong-Pair Fraction f_strong (3-H-bond G≡C vs 2-H-bond A=T) and watch Duplex Melting Temperature T_m shift by >25 K in Plot 1!'
    ]
  },
  'excitable-spiral': {
    title: 'Hodgkin–Huxley Excitable Membrane Spiral Waves & Mitchell Chemiosmosis',
    badge: '128×128 WebGPU Rush–Larsen HH + ATP',
    scale: '10⁻³ m',
    equations: [
      'C_m ∂V/∂t = D∇²V − g_Na m³h(V − E_Na) − g_K n⁴(V − E_K) − g_L(V − E_L)',
      'Mitchell Proton-Motive Force: Δp = |Δψ| + (2.303 RT/F)|ΔpH|  →  ATP synthesis flux J_ATP'
    ],
    whatYouSee:
      'Self-sustaining blazing-gold action-potential spiral waves sweep across a 128×128 voltage-gated ion-channel membrane, trailing deep violet K⁺ refractory wakes, while Plot 3 computes live Mitchell chemiosmotic ATP synthesis energetics.',
    experiments: [
      'TTX Channel Blocker Null Limit: Slide Na⁺ Conductance g_Na to 0 mS/cm² — action potentials immediately extinguish to resting −65 mV!',
      'Chemiosmotic Uncoupler Null Limit: Slide Protonophore Uncoupler to 1.0 (or Δψ & ΔpH to 0) — PMF collapses and ATP flux drops to exact 0!'
    ]
  },
  'excitable-pulse': {
    title: 'Excitable Membrane Target Pacemaker & Propagating Action Potential Ring',
    badge: '128×128 WebGPU HH · Triggerable Pulse',
    scale: '10⁻³ m',
    equations: [
      'All-or-nothing threshold depolarization triggers a regenerative Na⁺ influx wave followed by K⁺ repolarization'
    ],
    whatYouSee:
      'Clean concentric action-potential pulses radiating across the excitable lipid membrane. Click "⚡ Stimulate Membrane" at any time to inject a fresh depolarizing current!',
    experiments: [
      'Click "⚡ Stimulate Membrane" while lowering g_Na to discover the exact excitability threshold.'
    ]
  },
  'turing-spots': {
    title: 'Turing Morphogenesis Spots & Chemotactic Active-Matter Colonies',
    badge: '128×128 Gray–Scott + 2,048 Agents',
    scale: '10⁻⁴ m',
    equations: [
      '∂u/∂t = D_u∇²u − u v² + F(1 − u),   ∂v/∂t = D_v∇²v + u v² − (F + k) v   (D_u = 2 D_v)',
      'Run-and-tumble chemotaxis: tumble rate λ = λ₀ exp(−χ · v · ∇v_morphogen)'
    ],
    whatYouSee:
      'Diffusion-driven Turing instability carves glowing emerald-gold morphogen peaks out of a uniform chemical field while 2,048 self-propelled active-matter micro-swimmers sense local gradients ∇v and assemble into living colonies atop the peaks!',
    experiments: [
      'Falsifiable Active-Matter Null Limit: Set Propulsion Speed v₀ = 0 or Chemotaxis Gain = 0 and watch chemotactic enrichment collapse toward 1.0×!',
      'Falsifiable Turing Null Limit: Set Diffusion Ratio D_u/D_v → 1.0 — Turing pattern formation shuts off!'
    ]
  },
  'turing-labyrinth': {
    title: 'Embryonic Turing Labyrinth Stripes & Guided Active Swarms',
    badge: 'Gray–Scott Stripes + 2,048 Swimmers',
    scale: '10⁻⁴ m',
    equations: [
      'Higher feed rate F = 0.042 shifts the Turing bifurcation from isolated spots to interconnected embryonic stripes'
    ],
    whatYouSee:
      'Intertwining morphogen ridges self-organize dynamically as chemotactic micro-swimmers stream along the elevated golden corridors.',
    experiments: [
      'Sweep Chemotaxis Gain from 0 → 4 to watch swimmers transition from wandering freely to tracing the labyrinth ridges.'
    ]
  },
  'mitosis-division': {
    title: 'Self-Dividing Mitosis-Like Reaction-Diffusion Droplets & Swarm Tracking',
    badge: 'Self-Replicating Spots + Active Agents',
    scale: '10⁻⁴ m',
    equations: [
      'Low feed regime (F = 0.028, k = 0.062) drives unstable activator droplets to elongate, pinch, and bud daughter spots!'
    ],
    whatYouSee:
      'Morphogen islands continuously grow, pinch in the middle, and divide into daughter droplets while active chemotactic colonies split and follow each newly budded domain.',
    experiments: [
      'Watch Plot 2 (Turing Spatial Contrast & Chemotactic Enrichment) climb as droplets proliferate across the domain.'
    ]
  }
});
