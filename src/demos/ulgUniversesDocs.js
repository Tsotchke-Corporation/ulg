// Scientific Scale Ladder & Documentation for ULG Universes (`universes.html`).
// Continuous 40-Order-of-Magnitude physical scale coordinate (`log10SpanM` from +25.5 -> -15.2)
// spanning 8 real WebGPU physics engines with seamless overlapping zoom handoffs.

export const LOG10_SPAN_MAX = 25.4; // ~2.5 x 10^25 m (~800 Mpc)
export const LOG10_SPAN_MIN = -14.8; // ~16 fm

export const UNIVERSES_SCALES = Object.freeze([
  Object.freeze({
    level: 0,
    id: 'cosmic-web',
    shortLabel: 'Web',
    name: 'Supergalactic Cosmic Web',
    exponentLabel: '10²⁵ m',
    log10SpanM: 24.8,
    minLog10: 21.8,
    maxLog10: 25.5,
    diveVerb: 'APPROACHING GALAXY',
    diveButton: '⚡ ZOOM TO GALAXY',
    engineSchema: 'ulg.astrophysics.supergalactic-flrw-treepm.v1',
    plotTitle: 'GPU MATTER POWER SPECTRUM P(k)',
    equations:
      '∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]\n' +
      'dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)',
    summary:
      'Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).',
    kernels: 'build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu'
  }),
  Object.freeze({
    level: 1,
    id: 'galaxy',
    shortLabel: 'Galaxy',
    name: 'Spiral Galaxy & Halo',
    exponentLabel: '10²¹ m',
    log10SpanM: 21.0,
    minLog10: 15.8,
    maxLog10: 22.8,
    diveVerb: 'APPROACHING SOLAR SYSTEM',
    diveButton: '⚡ ZOOM TO TARGET',
    engineSchema: 'webgpu-schroeder-scale-atlas-multipole',
    plotTitle: 'GATE 1 ISM COOLING CURVE Λ(T, Z)',
    equations:
      'a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]\n' +
      'v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O',
    summary:
      'Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).',
    kernels: 'createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu'
  }),
  Object.freeze({
    level: 2,
    id: 'star-system',
    shortLabel: 'System',
    name: 'Solar System & Protoplanetary Formation',
    exponentLabel: '10¹² m',
    log10SpanM: 12.6,
    minLog10: 7.9,
    maxLog10: 16.8,
    diveVerb: 'APPROACHING WORLD',
    diveButton: '⚡ ZOOM TO SELECTED BODY',
    engineSchema: 'ulg.astrophysics.solar-system-nbody-webgpu.v1',
    plotTitle: 'SYMPLECTIC N-BODY & ACCRETION DISK',
    equations:
      'd²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]\n' +
      'v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals',
    summary:
      'Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.',
    kernels: 'createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu'
  }),
  Object.freeze({
    level: 3,
    id: 'stellar-core',
    shortLabel: 'Star/MHD',
    name: 'MHD Nebular Collapse & Stellar Fusion',
    exponentLabel: '10⁹ m',
    log10SpanM: 9.2,
    minLog10: 7.4,
    maxLog10: 10.6,
    diveVerb: 'SAMPLING PLANETARY MATTER',
    diveButton: '⚡ ZOOM TO EARTH / MATTER',
    engineSchema: 'ulg.astrophysics.nebular-mhd-collapse-webgpu.v1',
    plotTitle: 'GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY',
    equations:
      '∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]\n' +
      'du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]',
    summary:
      'Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).',
    kernels: 'createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu'
  }),
  Object.freeze({
    level: 4,
    id: 'planetary-interior',
    shortLabel: 'Planet',
    name: 'Planetary World, Atmosphere & Electrodynamics',
    exponentLabel: '10⁷ m',
    log10SpanM: 7.2,
    minLog10: -5.8,
    maxLog10: 8.6,
    diveVerb: 'DIVING TO CRYSTAL LATTICE',
    diveButton: '⚡ ZOOM TO ATOMIC LATTICE',
    engineSchema: 'ulg.astrophysics.planetary-atmosphere-em-webgpu.v1',
    plotTitle: 'HYDROSTATIC P(r) & ATMOSPHERIC EM',
    equations:
      'dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge\n' +
      'dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae',
    summary:
      'Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball circulation, and dark Rogue-World geothermal storms purely from physical state — plus toggleable Gate 2 Polytope Atlas cutaway.',
    kernels: 'createPlanetaryAtmosphereElectricSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu'
  }),
  Object.freeze({
    level: 5,
    id: 'molecular-dynamics',
    shortLabel: 'MD',
    name: 'Crystal & Fluid Molecular Dynamics',
    exponentLabel: '10⁻⁸ m',
    log10SpanM: -8.2,
    minLog10: -9.5,
    maxLog10: -5.2,
    diveVerb: 'RESOLVING ELECTRON SHELLS',
    diveButton: '⚡ ZOOM TO QUANTUM ATOM',
    engineSchema: 'ulg.gpumath.molecular-dynamics-webgpu.v1',
    plotTitle: 'LIVE GPU RADIAL DISTRIBUTION g(r)',
    equations:
      'm_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g\n' +
      'O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)',
    summary:
      'Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.',
    kernels: 'createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer'
  }),
  Object.freeze({
    level: 6,
    id: 'quantum-atom',
    shortLabel: 'Atom',
    name: 'Relativistic Dirac–KS Atom & Molecule',
    exponentLabel: '10⁻¹⁰ m',
    log10SpanM: -10.0,
    minLog10: -13.2,
    maxLog10: -9.0,
    diveVerb: 'PROBING STRONG FORCE CORE',
    diveButton: '⚡ ZOOM TO NUCLEUS',
    engineSchema: 'ulg.electronic.orbital-cloud-webgpu.v1',
    plotTitle: 'DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS',
    equations:
      '[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]\n' +
      '|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)',
    summary:
      'Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.',
    kernels: 'deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu'
  }),
  Object.freeze({
    level: 7,
    id: 'atomic-nucleus',
    shortLabel: 'Nucleus',
    name: 'Atomic Nucleus & Quantum Tunneling',
    exponentLabel: '10⁻¹⁵ m',
    log10SpanM: -14.3,
    minLog10: -15.2,
    maxLog10: -12.6,
    diveVerb: 'ZOOMING OUT TO COSMOS',
    diveButton: '↻ FLY OUT TO COSMIC WEB',
    engineSchema: 'ulg.nuclear.tunneling-tdse-webgpu.v1',
    plotTitle: 'SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²',
    equations:
      'iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]\n' +
      'ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values',
    summary:
      'Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.',
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
    cosmoGridPerSide: 22,
    cosmoFftN: 16,
    galaxyStars: 16384,
    solarAsteroids: 256,
    stellarParticles: 2048,
    mdCells: 6,
    orbitalPoints: 48000,
    nuclearVolDim: 24
  }),
  med: Object.freeze({
    id: 'med',
    cosmoGridPerSide: 28,
    cosmoFftN: 32,
    galaxyStars: 32768,
    solarAsteroids: 512,
    stellarParticles: 4096,
    mdCells: 7,
    orbitalPoints: 96000,
    nuclearVolDim: 28
  }),
  high: Object.freeze({
    id: 'high',
    cosmoGridPerSide: 32,
    cosmoFftN: 32,
    galaxyStars: 49152,
    solarAsteroids: 1024,
    stellarParticles: 6144,
    mdCells: 8,
    orbitalPoints: 160000,
    nuclearVolDim: 32
  }),
  ultra: Object.freeze({
    id: 'ultra',
    cosmoGridPerSide: 36,
    cosmoFftN: 32,
    galaxyStars: 65536,
    solarAsteroids: 1536,
    stellarParticles: 8192,
    mdCells: 9,
    orbitalPoints: 240000,
    nuclearVolDim: 32
  })
});

export function formatPhysicalSpan(log10SpanM) {
  const m = Math.pow(10, log10SpanM);
  if (log10SpanM >= 22.0) return `${(m / 3.08567758e22).toFixed(1)} Mpc`;
  if (log10SpanM >= 19.0) return `${(m / 9.46073047e18).toFixed(1)} kly`;
  if (log10SpanM >= 15.8) return `${(m / 9.46073047e15).toFixed(2)} ly`;
  if (log10SpanM >= 10.6) return `${(m / 1.495978707e11).toFixed(2)} AU`;
  if (log10SpanM >= 8.7) return `${(m / 6.957e8).toFixed(2)} R☉`;
  if (log10SpanM >= 4.0) return `${Math.round(m / 1e3).toLocaleString()} km`;
  if (log10SpanM >= 0.0) return `${m.toFixed(1)} m`;
  if (log10SpanM >= -3.0) return `${(m * 1e3).toFixed(1)} mm`;
  if (log10SpanM >= -6.0) return `${(m * 1e6).toFixed(1)} μm`;
  if (log10SpanM >= -9.2) return `${(m * 1e9).toFixed(2)} nm`;
  if (log10SpanM >= -11.5) return `${(m * 1e10).toFixed(2)} Å`;
  if (log10SpanM >= -13.0) return `${(m * 1e12).toFixed(2)} pm`;
  return `${(m * 1e15).toFixed(1)} fm`;
}

export function buildAboutUlgUniversesHtml() {
  return `
    <p><strong>ULG Universes</strong> is a single-canvas, <strong>continuous-zoom 40-order-of-magnitude</strong> WebGPU cosmos spanning <code>10⁺²⁵ m</code> supergalactic filaments down to <code>10⁻¹⁵ m</code> atomic nuclei — paired with a continuous <strong>Cosmic Epoch Spine</strong> from CMB Recombination (<code>z = 1100</code>) through Cosmic Dawn (<code>z = 10</code>), Cosmic Noon / Quasar Peak (<code>z = 2.8</code>), and Present Day (<code>z = 0</code>) into the <code>+5 Gyr</code> Red-Giant &amp; Remnant Era.</p>
    <p>Every astronomical entity emerges dynamically from ULG’s <strong>15-node Universal Law Graph</strong> on WebGPU — zero hardcoded entity/planet hacks or scripted animations:</p>
    <ul>
      <li><strong>L0 Cosmology (10²⁵ m):</strong> 2LPT 1-submit FLRW 3D-FFT TreePM Cosmic Web + Eisenstein–Hu BAO/CMB ΔT/T shell (<code>z=1100</code>), Pop III Reionization bubbles (<code>z=10</code>), and Bullet-Cluster X-ray ICM / 2D gravitational lensing.</li>
      <li><strong>L1 Galaxies &amp; Clusters (10²¹ m):</strong> <code>16K–65K</code> GPU stars on parallel <code>SchroederScaleAtlas</code> multipole gravity across Spiral, Barred Spiral, Major Merger, Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf &amp; Halo Stream, and Core-Collapsed Globular Cluster + Gate 1 ISM cooling <code>Λ(T, Z)</code>.</li>
      <li><strong>L2 Planetary, Small-Body &amp; Relativistic Systems (10¹² m → 10⁷ m):</strong> Double-float (<code>f32x2</code>) symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption &amp; Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment, Kerr Blandford–Znajek Quasar/Blazar Jets (live Doppler beaming), Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW-Chirp BNS Kilonova &amp; BBH Mergers.</li>
      <li><strong>L3 Stars, Nebulae &amp; Compact Remnants (10⁹ m):</strong> Thermonuclear Fusion Core, 3D Resistive MHD Nebular Collapse &amp; Bipolar Jets, Strömgren Photoionized H II Pillars, Bipolar Planetary Nebulae, SNR / Crab PWN, Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).</li>
      <li><strong>L4 Planetary Worlds (10⁷ m):</strong> Spherical baroclinic atmosphere, triboelectric Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean, Cryovolcanic Icy Plumes, Tidally Locked Eyeball &amp; Rogue Worlds, plus Gate 2 Polytope Atlas cutaway.</li>
      <li><strong>L5–L7 Microphysics (10⁻⁸ m → 10⁻¹⁵ m):</strong> Linked-cell GPU MD, 4-component Dirac–KS Atoms + RHF Molecules + PeerCompute 2-of-2 quorum mesh, and quantized Woods–Saxon Atomic Nuclei + Visscher α-tunneling TDSE.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark comparisons remain offline and advisory.</p>
  `;
}

export function buildAboutScaleHtml(scale) {
  if (!scale) return buildAboutUlgUniversesHtml();
  return `
    <p>${scale.summary}</p>
    <div class="uv-eq-box">${scale.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${scale.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${scale.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `;
}
