// Scientific Scale Ladder & Documentation for ULG Universes (`universes.html`).
// Defines all 8 nested real-WebGPU physical regimes spanning 40 orders of magnitude
// (`10^+25 m` Cosmic Web -> `10^-15 m` Atomic Nucleus) with honest provenance.

export const UNIVERSES_SCALES = Object.freeze([
  Object.freeze({
    level: 0,
    id: 'cosmic-web',
    shortLabel: 'Web',
    name: 'Supergalactic Cosmic Web',
    exponentLabel: '10²⁵ m',
    log10SpanM: 25.0,
    diveVerb: 'APPROACHING GALAXY',
    diveButton: '⚡ HYPERDRIVE TO GALAXY',
    engineSchema: 'ulg.astrophysics.supergalactic-flrw-treepm.v1',
    plotTitle: 'GPU MATTER POWER SPECTRUM P(k)',
    equations:
      '∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]\n' +
      'dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)',
    summary:
      'Evolves full-Nyquist Zel’dovich primordial dark-matter and baryon filaments inside a 200 Mpc/h expanding FLRW periodic universe in a single WebGPU queue.submit per step, sharing the exact same Gate 0B 3D Radix-2 FFT engine used in 10⁻⁹ m periodic crystal DFT.',
    kernels: 'buildZeldovichCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · reduce_power_spectrum_pk (16-bin live GPU P(k))'
  }),
  Object.freeze({
    level: 1,
    id: 'galaxy',
    shortLabel: 'Galaxy',
    name: 'Galactic Disk & SMBH',
    exponentLabel: '10²¹ m',
    log10SpanM: 21.0,
    diveVerb: 'APPROACHING STAR SYSTEM',
    diveButton: '⚡ HYPERDRIVE TO SYSTEM',
    engineSchema: 'webgpu-schroeder-scale-atlas-multipole',
    plotTitle: 'GATE 1 ISM COOLING CURVE Λ(T, Z)',
    equations:
      'a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]\n' +
      'Λ(T, Z) = Λ_fine(C,O) + Λ_Lyα(H) + Λ_He + Λ_met(Z) + Λ_brems(T)',
    summary:
      'Simulates 8K–65K GPU-resident stars with ULG’s canonical parallel SchroederScaleAtlas multipole gravity (zero private octrees, zero per-frame readback), paired with live Gate 1 H/He/C/O ionization cooling anchors and real-time WGSL Schwarzschild Einstein-ring lensing around the central supermassive black hole.',
    kernels: 'createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu · WGSL Schwarzschild post-pass'
  }),
  Object.freeze({
    level: 2,
    id: 'star-system',
    shortLabel: 'System',
    name: 'Planetary Star System',
    exponentLabel: '10¹² m',
    log10SpanM: 12.0,
    diveVerb: 'APPROACHING WORLD',
    diveButton: '⚡ DIVE INTO TARGET',
    engineSchema: 'ulg.astrophysics.planetary-symplectic-gpu.v1',
    plotTitle: 'ORBITAL ENERGY & EQUILIBRIUM T(r)',
    equations:
      'v(t + ½dt) = v(t) + ½dt · a(r(t)),   r(t + dt) = r(t) + dt · v(t + ½dt)\n' +
      'T_eq(a) = T_* √(R_* / 2a) (1 − A)^(1/4)   ·   Σ m_i v_i = 0 (exact barycentric recoil)',
    summary:
      'Integrates the host star and orbiting terrestrial, ocean, gas-giant, and ice worlds strictly via WebGPU symplectic tiled N-body gravity (zero hardcoded circular Math.sin orbits). Click the star to dive into its thermonuclear core (L3), or pick any planet to inspect its hydrostatic interior (L4).',
    kernels: 'createResidentTiledNBodyEngine (shared-memory tiled @workgroup_size(64) Velocity-Verlet)'
  }),
  Object.freeze({
    level: 3,
    id: 'stellar-core',
    shortLabel: 'Star',
    name: 'Stellar Core & Genesis',
    exponentLabel: '10⁹ m',
    log10SpanM: 9.0,
    diveVerb: 'SAMPLING PLANETARY MATTER',
    diveButton: '⚡ DIVE TO PLANET / ASH',
    engineSchema: 'peercompute.ulg.self-gravitating-hydro-gpu.v1',
    plotTitle: 'GAMOW TUNNELING WINDOW & FUSION ε',
    equations:
      'du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − ε_photodis − Λ_rad\n' +
      'P_Gamow(E) ∝ exp(−E/kT) · exp(−√(E_G / E))   ·   Q_pp, Q_3α from Gate 1 B(Z, A)',
    summary:
      'Runs ULG’s live self-gravitating compressible reacting-fluid GPU engine (self-gravitating-hydro@1) coupled to ClosureRegistry plasma EOS, exact Gate 1 nuclear β⁺/EC Q-values, and WebGPU RK4 Lane–Emden polytrope solutions. Zero canned star meshes — every glowing plasma parcel is rendered directly from GPU state.',
    kernels: 'createSelfGravitatingHydroEngine · evaluateStellarNuclearNetworkWebGpu · solveLaneEmdenPolytropeWebGpu'
  }),
  Object.freeze({
    level: 4,
    id: 'planetary-interior',
    shortLabel: 'Planet',
    name: 'Planetary Interior & Surface',
    exponentLabel: '10⁶ m',
    log10SpanM: 6.0,
    diveVerb: 'SAMPLING CRYSTAL LATTICE',
    diveButton: '⚡ SAMPLE LAYER IN MD',
    engineSchema: 'ulg.astrophysics.planetary-interior-webgpu.v1',
    plotTitle: 'HYDROSTATIC P(r) & ρ(r) PROFILE',
    equations:
      'dM/dr = 4π r² ρ_polytope(P, T),   dP/dr = −G M(r) ρ_polytope(P, T) / r²\n' +
      'ρ(P, T) = eval_polytope_atlas_bank_2d(A x ≤ b)   [fail-closed up to 1 TPa]',
    summary:
      'Integrates radial hydrostatic equilibrium directly on WebGPU using inline Gate 2 Convex Polytope Atlases fitted from Gate 1 DFT bundles (Fe core, SiO₂ mantle, H₂O ocean/crust). The 3D cutaway radii match the live GPU-solved core/mantle boundaries; pick any layer to dive into live atomic MD.',
    kernels: 'buildPlanetaryPolytopeAtlasWebGpu · solvePlanetaryInteriorWebGpu (inline WGSL eval_polytope_atlas_bank_2d)'
  }),
  Object.freeze({
    level: 5,
    id: 'molecular-dynamics',
    shortLabel: 'MD',
    name: 'Crystal & Fluid Molecular Dynamics',
    exponentLabel: '10⁻⁸ m',
    log10SpanM: -8.0,
    diveVerb: 'RESOLVING ELECTRON SHELLS',
    diveButton: '⚡ DIVE TO QUANTUM ATOM',
    engineSchema: 'ulg.gpumath.molecular-dynamics-webgpu.v1',
    plotTitle: 'LIVE GPU RADIAL DISTRIBUTION g(r)',
    equations:
      'm_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g\n' +
      'O(N) lock-free linked-cell Verlet + real-time Berendsen thermostat & GPU g(r) reduction',
    summary:
      'Evolves a real 3D crystal or melt of the sampled planetary/stellar element strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials. Heat it through melting and vaporization, toggle live GPU gravity, and watch coordination ⟨Z⟩ and the 64-bin GPU g(r) peak broaden in real time.',
    kernels: 'createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer rendering'
  }),
  Object.freeze({
    level: 6,
    id: 'quantum-atom',
    shortLabel: 'Atom',
    name: 'Relativistic Dirac–KS Atom & Molecule',
    exponentLabel: '10⁻¹⁰ m',
    log10SpanM: -10.0,
    diveVerb: 'PROBING STRONG FORCE CORE',
    diveButton: '⚡ DIVE TO NUCLEUS',
    engineSchema: 'ulg.electronic.orbital-cloud-webgpu.v1',
    plotTitle: 'DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS',
    equations:
      '[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]\n' +
      '|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)',
    summary:
      'Solves 4-component relativistic radial Dirac–Kohn–Sham equations directly on WebGPU (0 per-SCF CPU readbacks), then samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Toggle Relativistic Spin-Orbit ON/OFF on Gold (Z=79) to see 5d/6s contraction shift its physical sRGB color.',
    kernels: 'deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu'
  }),
  Object.freeze({
    level: 7,
    id: 'atomic-nucleus',
    shortLabel: 'Nucleus',
    name: 'Atomic Nucleus & Quantum Tunneling',
    exponentLabel: '10⁻¹⁵ m',
    log10SpanM: -15.0,
    diveVerb: 'RETURNING TO COSMIC WEB',
    diveButton: '↻ LOOP TO COSMIC WEB',
    engineSchema: 'ulg.nuclear.tunneling-tdse-webgpu.v1',
    plotTitle: 'SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²',
    equations:
      'iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]\n' +
      'ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values',
    summary:
      'Raymarches the 3D Woods–Saxon proton core and neutron skin volume generated on WebGPU by solveNuclearStructureWebGpu while evolving a live 1D symplectic Visscher quantum α-tunneling wavepacket through the nuclear Coulomb barrier. Its binding energy B(Z, A) directly closes the causal loop back up to L3 stellar fusion!',
    kernels: 'solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)'
  })
]);

export const UNIVERSES_ELEMENT_CHOICES = Object.freeze([
  { Z: 1, A: 1, sym: 'H', name: 'Hydrogen', defaultN: 1, defaultL: 0, defaultM: 0 },
  { Z: 2, A: 4, sym: 'He', name: 'Helium', defaultN: 1, defaultL: 0, defaultM: 0 },
  { Z: 6, A: 12, sym: 'C', name: 'Carbon', defaultN: 2, defaultL: 1, defaultM: 0 },
  { Z: 8, A: 16, sym: 'O', name: 'Oxygen', defaultN: 2, defaultL: 1, defaultM: 0 },
  { Z: 14, A: 28, sym: 'Si', name: 'Silicon', defaultN: 3, defaultL: 1, defaultM: 0 },
  { Z: 26, A: 56, sym: 'Fe', name: 'Iron', defaultN: 3, defaultL: 2, defaultM: 0 },
  { Z: 29, A: 63, sym: 'Cu', name: 'Copper', defaultN: 3, defaultL: 2, defaultM: 0 },
  { Z: 55, A: 133, sym: 'Cs', name: 'Cesium', defaultN: 6, defaultL: 0, defaultM: 0 },
  { Z: 79, A: 197, sym: 'Au', name: 'Gold', defaultN: 5, defaultL: 2, defaultM: 0 },
  { Z: 80, A: 202, sym: 'Hg', name: 'Mercury', defaultN: 5, defaultL: 2, defaultM: 0 },
  { Z: 82, A: 208, sym: 'Pb', name: 'Lead', defaultN: 6, defaultL: 1, defaultM: 0 },
  { Z: 92, A: 238, sym: 'U', name: 'Uranium', defaultN: 5, defaultL: 3, defaultM: 0 }
]);

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({
    id: 'low',
    cosmoGridPerSide: 14,
    cosmoFftN: 16,
    galaxyStars: 8192,
    stellarParticles: 2048,
    mdCells: 4,
    orbitalPoints: 48000,
    nuclearVolDim: 24
  }),
  med: Object.freeze({
    id: 'med',
    cosmoGridPerSide: 18,
    cosmoFftN: 32,
    galaxyStars: 16384,
    stellarParticles: 4096,
    mdCells: 5,
    orbitalPoints: 96000,
    nuclearVolDim: 28
  }),
  high: Object.freeze({
    id: 'high',
    cosmoGridPerSide: 22,
    cosmoFftN: 32,
    galaxyStars: 32768,
    stellarParticles: 6144,
    mdCells: 6,
    orbitalPoints: 160000,
    nuclearVolDim: 32
  }),
  ultra: Object.freeze({
    id: 'ultra',
    cosmoGridPerSide: 26,
    cosmoFftN: 32,
    galaxyStars: 65536,
    stellarParticles: 8192,
    mdCells: 8,
    orbitalPoints: 240000,
    nuclearVolDim: 32
  })
});

export function buildAboutUlgUniversesHtml() {
  return `
    <p><strong>ULG Universes</strong> is a single-canvas, browser-native WebGPU showcase spanning <strong>40 orders of magnitude</strong> — from the <code>10⁺²⁵ m</code> expanding supergalactic cosmic web down to the <code>10⁻¹⁵ m</code> atomic nucleus.</p>
    <p>Unlike procedural cosmos visualizers driven by scripted orbital loops or hardcoded colors, <strong>every single scale runs a real canonical ULG WebGPU compute engine</strong> on one shared <code>GPUDevice</code> with zero-copy GPU buffer presentation:</p>
    <ul>
      <li><strong>L0 Cosmic Web (10²⁵ m):</strong> 1-submit FLRW 3D-FFT TreePM cosmology + live 16-bin GPU matter power spectrum <code>P(k)</code>.</li>
      <li><strong>L1 Galaxy &amp; SMBH (10²¹ m):</strong> Parallel <code>SchroederScaleAtlas</code> multipole gravity (8K–65K stars) + Gate 1 ISM radiative cooling <code>Λ(T, Z)</code> + live WGSL Schwarzschild lensing.</li>
      <li><strong>L2 Star System (10¹² m):</strong> Symplectic tiled WebGPU Velocity-Verlet N-body with exact barycentric recoil and osculating Keplerian trails.</li>
      <li><strong>L3 Stellar Core (10⁹ m):</strong> Live self-gravitating compressible reacting-fluid hydro + Gate 1 nuclear fusion Q-values + RK4 Lane–Emden polytropes.</li>
      <li><strong>L4 Planetary Interior (10⁶ m):</strong> Fail-closed inline WGSL Convex Polytope Atlas radial hydrostatic solver driving live 3D cutaway core/mantle shells.</li>
      <li><strong>L5 Crystal &amp; Fluid MD (10⁻⁸ m):</strong> <code>O(N)</code> lock-free linked-cell GPU Molecular Dynamics with Gate 1 DFT potentials, melting/boiling thermostat, gravity toggle, and live GPU <code>g(r)</code>.</li>
      <li><strong>L6 Quantum Atom (10⁻¹⁰ m):</strong> 4-component radial Dirac–Kohn–Sham (0 SCF readbacks) + GPU inverse-CDF 3D orbital point cloud + optional molecular RHF &amp; PeerCompute 2-of-2 quorum mesh.</li>
      <li><strong>L7 Atomic Nucleus (10⁻¹⁵ m):</strong> 3D Woods–Saxon proton/neutron skin raymarcher + live symplectic Visscher 1D quantum α-tunneling TDSE whose binding energy <code>B(Z, A)</code> feeds L3 stellar fusion.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark audits against NIST, CODATA, AME2020, PREM, and cosmological references remain offline and advisory.</p>
  `;
}

export function buildAboutScaleHtml(scale) {
  if (!scale) return buildAboutUlgUniversesHtml();
  return `
    <p>${scale.summary}</p>
    <div class="uv-eq-box">${scale.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${scale.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${scale.engineSchema}</code></p>
    <p><strong>Controls:</strong> Drag to orbit, scroll to zoom, click any 3D object to inspect its emission spectrum &amp; composition, and click <strong>Initiate Hyperdrive</strong> (or double-click) to dive into the next scale level.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `;
}
