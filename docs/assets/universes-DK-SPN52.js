import{A as e,Dt as t,Et as n,Fo as r,Io as i,It as a,Lo as o,No as s,Pt as c,a as l,g as u,jo as d,jt as f,k as p,r as m,u as h,v as g,x as _}from"./molecularDynamicsWebGpu-D3Vza8Ty.js";import{t as v}from"./ClosureRegistry-D6kjFkSv.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-BDi1EyW4.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as C,createCachedExplicitBindGroup as w,createCachedExplicitComputePipeline as T}from"../runtime/webgpuComputeLayout.js";import{t as E}from"./radiationClosure-BRkiUYv5.js";import{c as D,f as O,m as k,p as A,t as j,u as ee}from"./photonShellOpticsWebGpu-D9ydqay2.js";import{r as M}from"./schroederSpatialScaleAtlasRuntime-CFwiufjF.js";var N=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Supergalactic Cosmic Web`,exponentLabel:`10²⁵ m`,log10SpanM:25,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ HYPERDRIVE TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist Zel’dovich primordial dark-matter and baryon filaments inside a 200 Mpc/h expanding FLRW periodic universe in a single WebGPU queue.submit per step, sharing the exact same Gate 0B 3D Radix-2 FFT engine used in 10⁻⁹ m periodic crystal DFT.`,kernels:`buildZeldovichCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · reduce_power_spectrum_pk (16-bin live GPU P(k))`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Galactic Disk & SMBH`,exponentLabel:`10²¹ m`,log10SpanM:21,diveVerb:`APPROACHING STAR SYSTEM`,diveButton:`⚡ HYPERDRIVE TO SYSTEM`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
Λ(T, Z) = Λ_fine(C,O) + Λ_Lyα(H) + Λ_He + Λ_met(Z) + Λ_brems(T)`,summary:`Simulates 8K–65K GPU-resident stars with ULG’s canonical parallel SchroederScaleAtlas multipole gravity (zero private octrees, zero per-frame readback), paired with live Gate 1 H/He/C/O ionization cooling anchors and real-time WGSL Schwarzschild Einstein-ring lensing around the central supermassive black hole.`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu · WGSL Schwarzschild post-pass`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Planetary Star System`,exponentLabel:`10¹² m`,log10SpanM:12,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ DIVE INTO TARGET`,engineSchema:`ulg.astrophysics.planetary-symplectic-gpu.v1`,plotTitle:`ORBITAL ENERGY & EQUILIBRIUM T(r)`,equations:`v(t + ½dt) = v(t) + ½dt · a(r(t)),   r(t + dt) = r(t) + dt · v(t + ½dt)
T_eq(a) = T_* √(R_* / 2a) (1 − A)^(1/4)   ·   Σ m_i v_i = 0 (exact barycentric recoil)`,summary:`Integrates the host star and orbiting terrestrial, ocean, gas-giant, and ice worlds strictly via WebGPU symplectic tiled N-body gravity (zero hardcoded circular Math.sin orbits). Click the star to dive into its thermonuclear core (L3), or pick any planet to inspect its hydrostatic interior (L4).`,kernels:`createResidentTiledNBodyEngine (shared-memory tiled @workgroup_size(64) Velocity-Verlet)`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star`,name:`Stellar Core & Genesis`,exponentLabel:`10⁹ m`,log10SpanM:9,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ DIVE TO PLANET / ASH`,engineSchema:`peercompute.ulg.self-gravitating-hydro-gpu.v1`,plotTitle:`GAMOW TUNNELING WINDOW & FUSION ε`,equations:`du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − ε_photodis − Λ_rad
P_Gamow(E) ∝ exp(−E/kT) · exp(−√(E_G / E))   ·   Q_pp, Q_3α from Gate 1 B(Z, A)`,summary:`Runs ULG’s live self-gravitating compressible reacting-fluid GPU engine (self-gravitating-hydro@1) coupled to ClosureRegistry plasma EOS, exact Gate 1 nuclear β⁺/EC Q-values, and WebGPU RK4 Lane–Emden polytrope solutions. Zero canned star meshes — every glowing plasma parcel is rendered directly from GPU state.`,kernels:`createSelfGravitatingHydroEngine · evaluateStellarNuclearNetworkWebGpu · solveLaneEmdenPolytropeWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary Interior & Surface`,exponentLabel:`10⁶ m`,log10SpanM:6,diveVerb:`SAMPLING CRYSTAL LATTICE`,diveButton:`⚡ SAMPLE LAYER IN MD`,engineSchema:`ulg.astrophysics.planetary-interior-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ρ(r) PROFILE`,equations:`dM/dr = 4π r² ρ_polytope(P, T),   dP/dr = −G M(r) ρ_polytope(P, T) / r²
ρ(P, T) = eval_polytope_atlas_bank_2d(A x ≤ b)   [fail-closed up to 1 TPa]`,summary:`Integrates radial hydrostatic equilibrium directly on WebGPU using inline Gate 2 Convex Polytope Atlases fitted from Gate 1 DFT bundles (Fe core, SiO₂ mantle, H₂O ocean/crust). The 3D cutaway radii match the live GPU-solved core/mantle boundaries; pick any layer to dive into live atomic MD.`,kernels:`buildPlanetaryPolytopeAtlasWebGpu · solvePlanetaryInteriorWebGpu (inline WGSL eval_polytope_atlas_bank_2d)`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ DIVE TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + real-time Berendsen thermostat & GPU g(r) reduction`,summary:`Evolves a real 3D crystal or melt of the sampled planetary/stellar element strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials. Heat it through melting and vaporization, toggle live GPU gravity, and watch coordination ⟨Z⟩ and the 64-bin GPU g(r) peak broaden in real time.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer rendering`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ DIVE TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations directly on WebGPU (0 per-SCF CPU readbacks), then samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Toggle Relativistic Spin-Orbit ON/OFF on Gold (Z=79) to see 5d/6s contraction shift its physical sRGB color.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-15,diveVerb:`RETURNING TO COSMIC WEB`,diveButton:`↻ LOOP TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Raymarches the 3D Woods–Saxon proton core and neutron skin volume generated on WebGPU by solveNuclearStructureWebGpu while evolving a live 1D symplectic Visscher quantum α-tunneling wavepacket through the nuclear Coulomb barrier. Its binding energy B(Z, A) directly closes the causal loop back up to L3 stellar fusion!`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),P=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),F=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:14,cosmoFftN:16,galaxyStars:8192,stellarParticles:2048,mdCells:4,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:18,cosmoFftN:32,galaxyStars:16384,stellarParticles:4096,mdCells:5,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:22,cosmoFftN:32,galaxyStars:32768,stellarParticles:6144,mdCells:6,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:26,cosmoFftN:32,galaxyStars:65536,stellarParticles:8192,mdCells:8,orbitalPoints:24e4,nuclearVolDim:32})});function I(){return`
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
  `}function L(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Drag to orbit, scroll to zoom, click any 3D object to inspect its emission spectrum &amp; composition, and click <strong>Initiate Hyperdrive</strong> (or double-click) to dive into the next scale level.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:I()}var R=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,z=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),B=16,V=32,te=`
struct CosmoParams {
  particle_count: u32,
  grid_n: u32,
  step_index: u32,
  remote_tile_count: u32,
  box_l: f32,
  a_scale: f32,
  da: f32,
  h_a: f32,             // H(a) / H_0
  omega_m: f32,
  grav_pref: f32,       // (3/2) * Omega_m / a
  mean_mass_cell: f32,
  short_range_r_s: f32, // TreePM force-split scale r_s (0 => pure PM)
  prev_kick_fac: f32,   // previous step kick factor for exact KDK synchronization
  tile_x_min: f32,
  tile_x_max: f32,
  pad0: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoParams;
@group(0) @binding(1) var<storage, read_write> particles: array<CosmoParticle>;
// Fixed-point atomic CIC density grid (grid_n^3)
@group(0) @binding(2) var<storage, read_write> cic_mass_i32: array<atomic<i32>>;
// Complex density / gradient / k-space grid bound to fft3d workspace or saved k-space
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// 3-component PM force grid: vec4(fx, fy, fz, delta)
@group(0) @binding(4) var<storage, read_write> force_grid: array<vec4<f32>>;
// Float32 telemetry + 16-bin P(k) + tile multipole summary buffer:
//   [0]: vec4(sum_delta2, max_delta, sum_delta, grid_total)
//   [1]: vec4(sum_ke, px, py, pz)
//   [2..17]: 16 P(k) bins: vec4(k_sum, pk_sum, mode_count, 0.0)
//   [18]: tile multipole 0: vec4(total_mass, com_x, com_y, com_z)
//   [19]: tile multipole 1: vec4(quad_trace, particle_count, 0.0, 0.0)
@group(0) @binding(5) var<storage, read_write> telemetry_f32: array<vec4<f32>>;
// Short-range sub-cell TreePM atomic cell-multipole accumulators (grid_n^3 * 4 i32): [m, m*dx, m*dy, m*dz]
@group(0) @binding(6) var<storage, read_write> sr_cell_accum: array<atomic<i32>>;
// Resolved short-range TreePM cell multipole nodes (cell-local COM offset, NOT wrapped abs!):
//   vec4(com_off_x, com_off_y, com_off_z, cell_mass) + remote tile multipoles appended at [grid_total .. grid_total + 31]:
//   remote_tile[r]: vec4(com_x, com_y, com_z, total_mass)
@group(0) @binding(7) var<storage, read_write> sr_cell_nodes: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;
const PK_BINS: u32 = ${B}u;

var<workgroup> wg_f0: array<f32, 256>;
var<workgroup> wg_f1: array<f32, 256>;
var<workgroup> wg_f2: array<f32, 256>;
var<workgroup> wg_f3: array<f32, 256>;
var<workgroup> wg_f4: array<f32, 256>;
var<workgroup> wg_f5: array<f32, 256>;

fn wrap_coord(u: f32, L: f32) -> f32 {
  let half_l = 0.5 * L;
  var x = u + half_l;
  x = x - L * floor(x / L);
  return x - half_l;
}

fn wrap_delta(d: f32, L: f32) -> f32 {
  return d - L * round(d / L);
}

fn safe_grid_index(g: f32, n: u32) -> u32 {
  let ni = i32(n);
  let gi = i32(floor(g));
  let m = ((gi % ni) + ni) % ni;
  return u32(m);
}

fn erfc_approx(x_in: f32) -> f32 {
  let x = max(0.0, x_in);
  let t = 1.0 / (1.0 + 0.3275911 * x);
  let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * exp(-x * x);
}

fn treepm_short_range_split(r: f32, r_s: f32) -> f32 {
  let u = r / max(2.0 * r_s, 1.0e-5);
  return erfc_approx(u) + (2.0 * u * 0.5641895835) * exp(-u * u);
}

@compute @workgroup_size(64)
fn clear_grids(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx < total) {
    atomicStore(&cic_mass_i32[idx], 0);
    force_grid[idx] = vec4<f32>(0.0);
    atomicStore(&sr_cell_accum[idx * 4u + 0u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 1u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 2u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 3u], 0);
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
  if (idx < 20u) {
    telemetry_f32[idx] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn cic_deposit(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  let p = particles[i].pos_m;
  if (!(p.w > 0.0)) { return; }
  let gx = ((p.x + 0.5 * L) / L) * nf;
  let gy = ((p.y + 0.5 * L) / L) * nf;
  let gz = ((p.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);
  let wx0 = 1.0 - fx; let wy0 = 1.0 - fy; let wz0 = 1.0 - fz;
  let scale = p.w * 4096.0;

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(wx0, fx);
  let wys = array<f32, 2>(wy0, fy);
  let wzs = array<f32, 2>(wz0, fz);

  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w_i = i32(round(scale * wxs[dx] * wys[dy] * wzs[dz]));
        atomicAdd(&cic_mass_i32[cidx], w_i);
      }
    }
  }
  // Exact cell-local monopole (relative to cell center -> wrap-free self-COM subtraction!)
  let cell_len = L / nf;
  let home_idx = (iz0 * n + iy0) * n + ix0;
  let cx_center = (f32(ix0) + 0.5) * cell_len - 0.5 * L;
  let cy_center = (f32(iy0) + 0.5) * cell_len - 0.5 * L;
  let cz_center = (f32(iz0) + 0.5) * cell_len - 0.5 * L;
  let dx_loc = wrap_delta(p.x - cx_center, L);
  let dy_loc = wrap_delta(p.y - cy_center, L);
  let dz_loc = wrap_delta(p.z - cz_center, L);
  atomicAdd(&sr_cell_accum[home_idx * 4u + 0u], i32(round(p.w * 4096.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 1u], i32(round(p.w * dx_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 2u], i32(round(p.w * dy_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 3u], i32(round(p.w * dz_loc * 2048.0)));
}

@compute @workgroup_size(64)
fn prepare_poisson_rhs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (idx >= total) { return; }
  let m_cell = f32(atomicLoad(&cic_mass_i32[idx])) / 4096.0;
  let delta = (m_cell / max(params.mean_mass_cell, 1.0e-6)) - 1.0;
  fft_grid[idx] = vec2<f32>(params.grav_pref * delta, 0.0);
  force_grid[idx].w = delta;

  let sr_m = f32(atomicLoad(&sr_cell_accum[idx * 4u + 0u])) / 4096.0;
  if (sr_m > 1.0e-6) {
    let inv_m = 1.0 / sr_m;
    let ox = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 1u])) / 2048.0) * inv_m;
    let oy = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 2u])) / 2048.0) * inv_m;
    let oz = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 3u])) / 2048.0) * inv_m;
    sr_cell_nodes[idx] = vec4<f32>(ox, oy, oz, sr_m);
  } else {
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
}

// Live 16-bin GPU radial matter power spectrum P(k) reduction directly from k-space FFT!
// Dispatched with 16 workgroups (one workgroup per logarithmic k-shell), @workgroup_size(256).
@compute @workgroup_size(256)
fn reduce_power_spectrum_pk(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let bin = wid.x;
  if (bin >= PK_BINS) { return; }
  let tid = lid.x;
  let n = params.grid_n;
  let half_n = n >> 1u;
  let total = n * n * n;
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let k_min = dk;
  let k_max = dk * f32(half_n) * 1.7320508;
  let log_span = max(1e-5, log(k_max / k_min));
  let inv_pref2 = 1.0 / max(1e-12, params.grav_pref * params.grav_pref);
  let vol_norm = (params.box_l * params.box_l * params.box_l) / (f32(total) * f32(total));

  var k_sum = 0.0;
  var pk_sum = 0.0;
  var cnt = 0.0;

  var idx = tid;
  loop {
    if (idx >= total) { break; }
    if (idx != 0u) {
      let ix = idx % n;
      let iy = (idx / n) % n;
      let iz = idx / (n * n);
      let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
      let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
      let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
      let k_mag = sqrt(nx * nx + ny * ny + nz * nz) * dk;
      let u = clamp(log(max(k_min, k_mag) / k_min) / log_span, 0.0, 0.99999);
      let b_idx = min(PK_BINS - 1u, u32(u * f32(PK_BINS)));
      if (b_idx == bin) {
        let c = fft_grid[idx];
        let p2 = (c.x * c.x + c.y * c.y) * inv_pref2 * vol_norm;
        k_sum = k_sum + k_mag;
        pk_sum = pk_sum + p2;
        cnt = cnt + 1.0;
      }
    }
    idx = idx + 256u;
  }

  wg_f0[tid] = k_sum;
  wg_f1[tid] = pk_sum;
  wg_f2[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_cnt = wg_f2[0u];
    if (m_cnt > 0.0) {
      telemetry_f32[2u + bin] = vec4<f32>(wg_f0[0u] / m_cnt, wg_f1[0u] / m_cnt, m_cnt, 0.0);
    } else {
      telemetry_f32[2u + bin] = vec4<f32>(0.0);
    }
  }
}

@compute @workgroup_size(64)
fn store_force_x(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].x = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_y(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].y = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_z(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].z = -fft_grid[idx].x;
}

// CIC trilinear force interpolation + Short-Range TreePM (exact self-COM subtraction
// + empty-cell background symmetry) + Remote-Slab Multipole Coupling + Symplectic KDK!
@compute @workgroup_size(64)
fn cic_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let n_i = i32(n);
  let total_cells = n * n * n;
  let L = params.box_l;
  var pt = particles[i];
  if (!(pt.pos_m.w > 0.0)) { return; }

  let gx = ((pt.pos_m.x + 0.5 * L) / L) * nf;
  let gy = ((pt.pos_m.y + 0.5 * L) / L) * nf;
  let gz = ((pt.pos_m.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(1.0 - fx, fx);
  let wys = array<f32, 2>(1.0 - fy, fy);
  let wzs = array<f32, 2>(1.0 - fz, fz);

  var acc = vec3<f32>(0.0);
  var local_delta = 0.0;
  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w = wxs[dx] * wys[dy] * wzs[dz];
        let fg = force_grid[cidx];
        acc = acc + fg.xyz * w;
        local_delta = local_delta + fg.w * w;
      }
    }
  }

  let cell_len = L / nf;
  let g_eff = (params.grav_pref * cell_len * cell_len * cell_len) / (12.566370614 * max(params.mean_mass_cell, 1.0e-6));

  // Hybrid TreePM short-range 3x3x3 cell-multipole correction:
  //   (a) exact self-COM subtraction in home cell, AND
  //   (b) uniform -mean_mass_cell peculiar background at EVERY cell center (including empty voids!)
  if (params.short_range_r_s > 0.0) {
    let r_s = params.short_range_r_s;
    let r_cut = 2.0 * r_s;
    let r_cut2 = r_cut * r_cut;
    let eps2 = (0.55 * cell_len) * (0.55 * cell_len);
    for (var oz: i32 = -1; oz <= 1; oz = oz + 1) {
      let nz = u32(((i32(iz0) + oz) % n_i + n_i) % n_i);
      let cz_c = (f32(nz) + 0.5) * cell_len - 0.5 * L;
      for (var oy: i32 = -1; oy <= 1; oy = oy + 1) {
        let ny = u32(((i32(iy0) + oy) % n_i + n_i) % n_i);
        let cy_c = (f32(ny) + 0.5) * cell_len - 0.5 * L;
        for (var ox: i32 = -1; ox <= 1; ox = ox + 1) {
          let nx = u32(((i32(ix0) + ox) % n_i + n_i) % n_i);
          let cx_c = (f32(nx) + 0.5) * cell_len - 0.5 * L;
          let nidx = (nz * n + ny) * n + nx;
          let node = sr_cell_nodes[nidx];
          let is_home = (ox == 0 && oy == 0 && oz == 0);

          // 1. Positive mass attraction from actual particles in cell (with EXACT self-COM subtraction!)
          if (node.w > 1.0e-6) {
            let eff_m = select(node.w, max(0.0, node.w - pt.pos_m.w), is_home);
            if (eff_m > 1.0e-6) {
              var d_p = vec3<f32>(0.0);
              if (is_home) {
                let self_off = vec3<f32>(
                  wrap_delta(pt.pos_m.x - cx_c, L),
                  wrap_delta(pt.pos_m.y - cy_c, L),
                  wrap_delta(pt.pos_m.z - cz_c, L)
                );
                let other_off = (node.xyz * node.w - self_off * pt.pos_m.w) / eff_m;
                d_p = other_off - self_off;
              } else {
                let com_x = cx_c + node.x;
                let com_y = cy_c + node.y;
                let com_z = cz_c + node.z;
                d_p = vec3<f32>(
                  wrap_delta(com_x - pt.pos_m.x, L),
                  wrap_delta(com_y - pt.pos_m.y, L),
                  wrap_delta(com_z - pt.pos_m.z, L)
                );
              }
              let r2_p = dot(d_p, d_p);
              if (r2_p <= r_cut2 && r2_p > 1.0e-10) {
                let r_p = sqrt(r2_p);
                let sw_p = treepm_short_range_split(r_p, r_s);
                let inv_r3_p = 1.0 / ((r2_p + eps2) * sqrt(r2_p + eps2));
                acc = acc + d_p * (g_eff * eff_m * sw_p * inv_r3_p);
              }
            }
          }

          // 2. Uniform -mean_mass_cell background subtraction at cell center (INCLUDING empty cells!)
          let d_bg = vec3<f32>(
            wrap_delta(cx_c - pt.pos_m.x, L),
            wrap_delta(cy_c - pt.pos_m.y, L),
            wrap_delta(cz_c - pt.pos_m.z, L)
          );
          let r2_bg = dot(d_bg, d_bg);
          if (r2_bg <= r_cut2 && r2_bg > 1.0e-10) {
            let r_bg = sqrt(r2_bg);
            let sw_bg = treepm_short_range_split(r_bg, r_s);
            let inv_r3_bg = 1.0 / ((r2_bg + eps2) * sqrt(r2_bg + eps2));
            acc = acc - d_bg * (g_eff * params.mean_mass_cell * sw_bg * inv_r3_bg);
          }
        }
      }
    }
  }

  // Remote-slab cross-peer multipole gravitational coupling (multi-host PeerCompute!)
  // Direct non-wrapped displacement along slab-partitioned X avoids half-box sign-flip
  // discontinuities while retaining full periodic minimum-image wrapping along Y and Z.
  let n_rem = min(params.remote_tile_count, ${V}u);
  if (n_rem > 0u) {
    let eps_rem2 = (0.12 * L) * (0.12 * L);
    for (var r = 0u; r < n_rem; r = r + 1u) {
      let rt = sr_cell_nodes[total_cells + r];
      if (rt.w <= 1.0e-6) { continue; }
      let d_r = vec3<f32>(
        rt.x - pt.pos_m.x,
        wrap_delta(rt.y - pt.pos_m.y, L),
        wrap_delta(rt.z - pt.pos_m.z, L)
      );
      let r2_r = dot(d_r, d_r) + eps_rem2;
      let inv_r3_r = 1.0 / (r2_r * sqrt(r2_r));
      acc = acc + d_r * (g_eff * rt.w * inv_r3_r);
    }
  }

  // Canonical comoving Symplectic Kick-Drift-Kick (KDK) in scale factor a:
  //   step 0:  v_half = v_0 + 0.5 * acc_0 * kick_0;  x_1 = x_0 + v_half * drift_0
  //   step s:  v_sync = v_{s-1/2} + 0.5 * acc_s * kick_{s-1}
  //            v_half = v_sync + 0.5 * acc_s * kick_s;  x_{s+1} = x_s + v_half * drift_s
  let a = max(0.01, params.a_scale);
  let h_a = max(0.05, params.h_a);
  let da = params.da;
  let kick_fac = da / (a * a * h_a);
  let a_mid = a + 0.5 * da;
  let drift_fac = da / (a_mid * a_mid * a_mid * h_a);

  let v_sync = select(pt.vel_rho.xyz, pt.vel_rho.xyz + acc * (0.5 * params.prev_kick_fac), params.step_index > 0u);
  let v_half = v_sync + acc * (0.5 * kick_fac);
  let p_new = vec3<f32>(
    wrap_coord(pt.pos_m.x + v_half.x * drift_fac, L),
    wrap_coord(pt.pos_m.y + v_half.y * drift_fac, L),
    wrap_coord(pt.pos_m.z + v_half.z * drift_fac, L)
  );
  let rho_vis = clamp(0.18 + 0.25 * log2(max(1.0, 1.0 + local_delta)), 0.05, 1.0);
  pt.pos_m = vec4<f32>(p_new, pt.pos_m.w);
  pt.vel_rho = vec4<f32>(v_half, rho_vis);
  pt.acc_phi = vec4<f32>(acc, local_delta);
  pt.tag.z = a;
  particles[i] = pt;
}

// Pure IEEE-754 float32 parallel workgroup telemetry reduction (ZERO i32 overflow!)
// Dispatch 2 workgroups of 256 threads:
//   wid.x == 0 -> grid overdensity stats [sum_delta2, max_delta, sum_delta, total]
//   wid.x == 1 -> particle KE & linear momentum [sum_ke, px, py, pz]
@compute @workgroup_size(256)
fn reduce_telemetry_f32(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let tid = lid.x;
  if (wid.x == 0u) {
    let total = params.grid_n * params.grid_n * params.grid_n;
    var s_d2 = 0.0;
    var m_d = -1.0e30;
    var s_d = 0.0;
    var i = tid;
    loop {
      if (i >= total) { break; }
      let d = force_grid[i].w;
      s_d2 = s_d2 + d * d;
      m_d = max(m_d, d);
      s_d = s_d + d;
      i = i + 256u;
    }
    wg_f0[tid] = s_d2;
    wg_f1[tid] = m_d;
    wg_f2[tid] = s_d;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = max(wg_f1[tid], wg_f1[tid + stride]);
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[0u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], f32(total));
    }
  } else if (wid.x == 1u) {
    let n_p = params.particle_count;
    var s_ke = 0.0;
    var px = 0.0;
    var py = 0.0;
    var pz = 0.0;
    var i = tid;
    loop {
      if (i >= n_p) { break; }
      let pt = particles[i];
      let m = pt.pos_m.w;
      let v = pt.vel_rho.xyz;
      s_ke = s_ke + 0.5 * m * dot(v, v);
      px = px + m * v.x;
      py = py + m * v.y;
      pz = pz + m * v.z;
      i = i + 256u;
    }
    wg_f0[tid] = s_ke;
    wg_f1[tid] = px;
    wg_f2[tid] = py;
    wg_f3[tid] = pz;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
        wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[1u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], wg_f3[0u]);
    }
  }
}

// Parallel GPU tile multipole reduction for PeerCompute slab exchange (32-byte readback!)
@compute @workgroup_size(256)
fn reduce_tile_multipole(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n_p = params.particle_count;
  var m_sum = 0.0;
  var mx = 0.0;
  var my = 0.0;
  var mz = 0.0;
  var r2_sum = 0.0;
  var cnt = 0.0;
  var i = tid;
  loop {
    if (i >= n_p) { break; }
    let pm = particles[i].pos_m;
    if (pm.w > 0.0 && pm.x >= params.tile_x_min && pm.x < params.tile_x_max) {
      m_sum = m_sum + pm.w;
      mx = mx + pm.w * pm.x;
      my = my + pm.w * pm.y;
      mz = mz + pm.w * pm.z;
      r2_sum = r2_sum + pm.w * dot(pm.xyz, pm.xyz);
      cnt = cnt + 1.0;
    }
    i = i + 256u;
  }
  wg_f0[tid] = m_sum;
  wg_f1[tid] = mx;
  wg_f2[tid] = my;
  wg_f3[tid] = mz;
  wg_f4[tid] = r2_sum;
  wg_f5[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      wg_f4[tid] = wg_f4[tid] + wg_f4[tid + stride];
      wg_f5[tid] = wg_f5[tid] + wg_f5[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }
  if (tid == 0u) {
    let m_tot = wg_f0[0u];
    if (m_tot > 1.0e-6) {
      let cx = wg_f1[0u] / m_tot;
      let cy = wg_f2[0u] / m_tot;
      let cz = wg_f3[0u] / m_tot;
      // Exact parallel-axis identity: sum m_i |r_i - com|^2 = sum m_i |r_i|^2 - M |com|^2
      let q_trace = max(0.0, wg_f4[0u] - m_tot * (cx * cx + cy * cy + cz * cz));
      telemetry_f32[18u] = vec4<f32>(m_tot, cx, cy, cz);
      telemetry_f32[19u] = vec4<f32>(q_trace, wg_f5[0u], 0.0, 0.0);
    } else {
      telemetry_f32[18u] = vec4<f32>(0.0);
      telemetry_f32[19u] = vec4<f32>(0.0);
    }
  }
}
`,ne=`
struct ZeldParams {
  n: u32,
  seed: u32,
  axis: u32,
  pad0: u32,
  box_l: f32,
  amplitude: f32,
  k_eq: f32,
  v_pref: f32,
};

@group(0) @binding(0) var<uniform> params: ZeldParams;
@group(0) @binding(1) var<storage, read_write> k_field: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> disp_field: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v * 9u;
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn rand01(h: u32) -> f32 {
  return (f32(h & 0x00ffffffu) + 0.5) / 16777216.0;
}

// Generates Hermitian-symmetric primordial Gaussian random displacement mode Psi_k = i * (k / k^2) * delta_k
@compute @workgroup_size(64)
fn generate_zeldovich_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  if (idx == 0u) {
    k_field[0u] = vec2<f32>(0.0, 0.0);
    return;
  }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  let half_n = n >> 1u;

  // Canonical Hermitian conjugate pairing: (-k) mod N
  let cx = (n - ix) % n;
  let cy = (n - iy) % n;
  let cz = (n - iz) % n;
  let conj_idx = (cz * n + cy) * n + cx;
  let canon_idx = min(idx, conj_idx);
  let is_conj = idx > conj_idx;
  let is_self_conj = idx == conj_idx;

  let h1 = hash_u32(canon_idx * 747796405u + params.seed * 2891336453u + 17u);
  let h2 = hash_u32(h1 + 1013904223u);
  let u1 = max(1e-6, rand01(h1));
  let u2 = rand01(h2);
  let gauss_r = sqrt(-2.0 * log(u1));
  let theta = TWO_PI * u2;
  var delta_re = gauss_r * cos(theta);
  var delta_im = select(gauss_r * sin(theta), 0.0, is_self_conj);
  if (is_conj) { delta_im = -delta_im; }

  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let k_mag = sqrt(k2);
  // Eisenstein-Hu-like primordial matter power spectrum P(k) ~ k / (1 + (k/k_eq)^2)^2
  let ratio = k_mag / max(params.k_eq, 1.0e-6);
  let pk = k_mag / ((1.0 + ratio * ratio) * (1.0 + ratio * ratio));
  // Smooth Nyquist filter so small-scale modes are clean & isotropic
  let k_nyq = f32(half_n) * dk;
  let nyq_win = exp(-2.2 * (k_mag / k_nyq) * (k_mag / k_nyq));
  let amp = params.amplitude * sqrt(pk * nyq_win) * (params.box_l * 0.28) * f32(total);
  let k_comp = select(select(kz, ky, params.axis == 1u), kx, params.axis == 0u);
  // Psi_k = i * (k_comp / k^2) * delta_k -> i * (re + i im) = (-im, re)
  let fac = (k_comp / max(k2, 1.0e-12)) * amp;
  k_field[idx] = vec2<f32>(-delta_im * fac, delta_re * fac);
}

@compute @workgroup_size(64)
fn store_disp_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let total = params.n * params.n * params.n;
  let idx = id.x;
  if (idx >= total) { return; }
  var cur = disp_field[idx];
  let v = k_field[idx].x;
  if (params.axis == 0u) { cur.x = v; }
  else if (params.axis == 1u) { cur.y = v; }
  else { cur.z = v; }
  disp_field[idx] = cur;
}
`;function re(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function H(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function ie(e,{gridPerSide:t=24,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.35,seed:c=20261122,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildZeldovichCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=re(i,{omegaM:a,omegaLambda:o}),h=(a/(i**3*m*m))**.55,g=i*i*m*h,_=2*Math.PI/f*2.5,v=A(e,n),y=v.total,b=[C(0,`uniform`),C(1,`storage`),C(2,`storage`)],x=T(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-zeldovich-ic-gen`,code:ne,entryPoint:`generate_zeldovich_kspace`,bindings:b}),S=T(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-zeldovich-ic-store`,code:ne,entryPoint:`store_disp_axis`,bindings:b}),w=e.createBuffer({size:y*16,usage:z.STORAGE|z.COPY_SRC}),E=e.createBuffer({size:y*16,usage:z.MAP_READ|z.COPY_DST}),D=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([v.n,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,_,g]);let r=e.createBuffer({size:32,usage:z.UNIFORM|z.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-zeldovich-gpu-ic`}),n=Math.ceil(y/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:x.bindGroupLayout,entries:[{binding:0,resource:{buffer:D[r]}},{binding:1,resource:{buffer:v.bufferA}},{binding:2,resource:{buffer:w}}]}),a=t.beginComputePass();a.setPipeline(x.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=v.encodeInverseFrom(t,v.bufferA),s=e.createBindGroup({layout:S.bindGroupLayout,entries:[{binding:0,resource:{buffer:D[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:w}}]});a=t.beginComputePass(),a.setPipeline(S.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(w,0,E,0,y*16),e.queue.submit([t.finish()]),await E.mapAsync(z.MAP_READ);let r=new Float32Array(E.getMappedRange().slice(0,y*16));E.unmap();let a=0;for(let e=0;e<y;e+=1){let t=r[e*4+0],n=r[e*4+1],i=r[e*4+2];a+=t*t+n*n+i*i}let o=Math.sqrt(a/Math.max(1,y)),c=Math.max(.1,Number(s)||.35)*(f/24),m=o>1e-12?c/o:0;for(let e=0;e<y;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let h=v.n,_=(e,t,n)=>{let i=(e+.5*f)/f*h,a=(t+.5*f)/f*h,o=(n+.5*f)/f*h,s=(Math.floor(i)%h+h)%h,c=(Math.floor(a)%h+h)%h,l=(Math.floor(o)%h+h)%h,u=(s+1)%h,d=(c+1)%h,p=(l+1)%h,m=i-Math.floor(i),g=a-Math.floor(a),_=o-Math.floor(o),v=0,y=0,b=0,x=[s,u],S=[c,d],C=[l,p],w=[1-m,m],T=[1-g,g],E=[1-_,_];for(let e=0;e<2;e+=1)for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1){let i=((C[e]*h+S[t])*h+x[n])*4,a=w[n]*T[t]*E[e];v+=r[i+0]*a,y+=r[i+1]*a,b+=r[i+2]*a}return[v,y,b]},b=Number(u?.[0])||0,C=Number(u?.[1])||0,T=Number(u?.[2])||0,O=d*d*d,k=new Float32Array(O*16),A=0,j=0,ee=0,M=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let r=(n+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,[s,c,l]=_(r,a,o),u=H(r+s+b,f),d=H(a+c+C,f),m=H(o+l+T,f),h=g*s,v=g*c,y=g*l;A+=h,j+=v,ee+=y;let x=M*16;k[x+0]=u,k[x+1]=d,k[x+2]=m,k[x+3]=1,k[x+4]=h,k[x+5]=v,k[x+6]=y,k[x+7]=.25,k[x+12]=+(M%6==0),k[x+14]=i,M+=1}A/=O,j/=O,ee/=O;for(let e=0;e<O;e+=1)k[e*16+4]-=A,k[e*16+5]-=j,k[e*16+6]-=ee;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<O;t+=1){let n=k[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(k.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-zeldovich-full-nyquist`,particleCount:e.length,globalParticleCount:O,data:t,boxLengthMpc:f,aInit:i}}return{icBackend:`webgpu-fft3d-zeldovich-full-nyquist`,particleCount:O,globalParticleCount:O,data:k,boxLengthMpc:f,aInit:i}}finally{v.destroy(),w.destroy(),E.destroy();for(let e of D)e.destroy()}}function ae({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=re(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=H(i+s+b,f),g=H(a+c+x,f),_=H(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function oe(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:f=[0,0,0],slabBounds:p=null,initialConditions:m=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let h=m||ae({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:p,initialPositionsShift:f}),g=h.particleCount,_=h.globalParticleCount??h.particleCount,v=n,y=v**3,b=A(e,v),x=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`),C(5,`storage`),C(6,`storage`),C(7,`storage`)],S=t=>T(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:te,entryPoint:t,bindings:x}),w=S(`clear_grids`),E=S(`cic_deposit`),D=S(`prepare_poisson_rhs`),O=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),j=S(`store_force_y`),ee=S(`store_force_z`),M=S(`cic_kick_drift`),N=S(`reduce_telemetry_f32`),P=S(`reduce_tile_multipole`),F=e.createBuffer({size:64,usage:z.UNIFORM|z.COPY_DST}),I=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,h.data.byteLength),usage:z.VERTEX|z.STORAGE|z.COPY_DST|z.COPY_SRC});h.data.byteLength>0&&e.queue.writeBuffer(I,0,h.data);let L=e.createBuffer({size:y*4,usage:z.STORAGE}),ne=e.createBuffer({size:y*16,usage:z.STORAGE}),H=e.createBuffer({size:320,usage:z.STORAGE|z.COPY_SRC}),ie=e.createBuffer({size:320,usage:z.MAP_READ|z.COPY_DST}),oe=e.createBuffer({size:32,usage:z.MAP_READ|z.COPY_DST}),se=e.createBuffer({size:y*16,usage:z.STORAGE}),ce=e.createBuffer({size:(y+V)*16,usage:z.STORAGE|z.COPY_DST}),U=e.createBuffer({size:b.byteLength,usage:z.STORAGE|z.COPY_DST|z.COPY_SRC}),W=t=>e.createBindGroup({layout:w.bindGroupLayout,entries:[F,I,L,t,ne,H,se,ce].map((e,t)=>({binding:t,resource:{buffer:e}}))}),G=W(b.bufferA),K=W(b.bufferB),le=W(U),ue=e=>e===b.bufferA?G:e===b.bufferB?K:le,de=r/v,fe=(c*de)**2,pe=l?c*de:0,q=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:fe});let me=i,he=0,ge=0,_e=0,ve=1,ye=null,J={xMin:-.5*r,xMax:.5*r},be=(t=null)=>{let n=t||J,i=re(me,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,me),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,he,_e]),new Float32Array(l,16,12).set([r,me,a,i,o,c,q,pe,ge,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(F,0,l),{hA:i,gravPref:c}};function xe(t=[]){let n=Array.isArray(t)?t.slice(0,V):[],r=new Float32Array(V*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return _e=n.length,e.queue.writeBuffer(ce,y*16,r),_e}let Se=Math.ceil(y/64),Ce=Math.max(1,Math.ceil(g/64));async function we({readTelemetry:t=!0}={}){let{hA:n}=be(),i=a/(Math.max(.01,me)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${he}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,G),u.setPipeline(w.pipeline),u.dispatchWorkgroups(Se),g>0&&(u.setPipeline(E.pipeline),u.dispatchWorkgroups(Ce)),u.setPipeline(D.pipeline),u.dispatchWorkgroups(Se),u.end();let f=b.encodeForward(c);c.copyBufferToBuffer(f,0,U,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,le),u.setPipeline(O.pipeline),u.dispatchWorkgroups(B),u.end();let p=[k,j,ee];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,U,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,ue(t)),u.setPipeline(p[e-1].pipeline),u.dispatchWorkgroups(Se),u.end()}if(u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,G),g>0&&(u.setPipeline(M.pipeline),u.dispatchWorkgroups(Ce)),u.setPipeline(N.pipeline),u.dispatchWorkgroups(2),u.end(),t&&c.copyBufferToBuffer(H,0,ie,0,320),e.queue.submit([c.finish()]),ve=1,ge=i,me=Math.min(1.5,me+a),he+=1,!t)return null;await ie.mapAsync(z.MAP_READ);let m=new Float32Array(ie.getMappedRange().slice(0,320));ie.unmap();let y=Math.sqrt(Math.max(0,m[0]/Math.max(1,m[3]))),x=m[1],S=m[4],C=[m[5],m[6],m[7]],T=Math.max(0,1/me-1),A=[],P=[],F=[],I=0;for(let e=0;e<B;e+=1){let t=(2+e)*4,n=Math.round(m[t+2]);n>0&&(A.push(m[t+0]),P.push(m[t+1]),F.push(n),I+=n)}let L=P.length>0?P.slice(0,Math.min(4,P.length)).reduce((e,t)=>e+t,0)/Math.min(4,P.length):0;ye===null&&L>0&&(ye=L);let V=ye>0?Math.sqrt(L/ye):1;return Object.freeze({schema:R,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:h.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:ve,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:pe,remoteTileCount:_e,stepIndex:he,scaleFactorA:me,redshiftZ:T,hOverH0:re(me,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:y,maxOverdensity:x,kineticEnergy:S,momentum:C,powerSpectrumPk:Object.freeze({kBins:Object.freeze(A),pkValues:Object.freeze(P),modeCounts:Object.freeze(F),totalModes:I,lowKPower:L,linearGrowthRatio:V}),accuracyTier:d.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function Te(){if(g===0)return new Float32Array;let t=e.createBuffer({size:h.data.byteLength,usage:z.MAP_READ|z.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(I,0,t,0,h.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(z.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function Ee({xMin:t=-.5*r,xMax:n=.5*r}={}){J={xMin:Number(t),xMax:Number(n)},be(J);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,G),a.setPipeline(P.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(H,288,oe,0,32),e.queue.submit([i.finish()]),await oe.mapAsync(z.MAP_READ);let o=new Float32Array(oe.getMappedRange().slice(0,32));return oe.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:me,stepIndex:he})}return Object.freeze({schema:R,icBackend:h.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:pe,particlesBuffer:I,forceGridBuffer:ne,injectRemoteTileMultipoles:xe,step:we,readParticlesSnapshot:Te,readTileMultipoleSummary:Ee,getState:()=>({aScale:me,redshiftZ:Math.max(0,1/me-1),stepIndex:he,submitsPerStep:ve,remoteTileCount:_e}),destroy(){b.destroy();for(let e of[F,I,L,ne,H,ie,oe,se,ce,U])e.destroy()}})}var se=27.211386245988,ce=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var U=null,W=null;function G({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*ce)),o=Math.log10(Math.max(4e4,.31*t*ce)),s=Math.log10(Math.max(8e4,.78*(n+r)*ce));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function K(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*se);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*se*1.45):t}async function le(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(W&&!t)return W;let[n,r,i,a]=await Promise.all([k(e,1,{A:1,maxScf:36}),k(e,2,{A:4,maxScf:36}),k(e,6,{A:12,maxScf:42}),k(e,8,{A:16,maxScf:42})]);return W=G({iH:K(n,13.6),iHe:K(r,24.59),iC:K(i,11.26),iO:K(a,13.62),backend:`webgpu-gate1-radial-ks`}),W}function ue(){if(W)return W;if(U)return U;let e=n(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=n(2,{gridPointsN:160,maxScf:80,tol:1e-5}),r=n(6,{gridPointsN:160,maxScf:80,tol:1e-5}),i=n(8,{gridPointsN:160,maxScf:80,tol:1e-5});return U=G({iH:Math.max(10,Math.abs(e.totalEnergyHa)*se),iHe:K(t,24.59),iC:K(r,11.26),iO:K(i,13.62),backend:`host-gate1-radial-ks`}),U}function de(e,t=1,n=null){let r=n||ue(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var fe=`ulg.astrophysics.planetary-interior-webgpu.v1`,pe=66743e-15,q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function me(t,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:a=12e3,degrees:c=[5,5],relativeTolerance:l=.025,maxBisectDepth:u=3,materialIndex:f=0}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let m=e(),h=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),g=Math.max(h+20,Number(n.thermodynamic.boilingPointK??h*1.5)),v=Math.max(g*2.5,Number(a)),y=m.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:h,boilingPointK:g,ionizationTempK:v,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(v*1.5,Number(a)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||d.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let e of y){let r=await p(t,e,(t,r)=>_(n,e.phase,t,r),{degrees:c,relativeTolerance:l,requirePositive:!0,maxDepth:u,propertyName:`densityKgPerM3`,logScale:!0});b.push(...r.polytopes)}let x=o(b,{materialIndex:f});return Object.freeze({schema:s,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||d.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var he=`
${r}

struct PlanetParams {
  model_count: u32,
  layer_count: u32,
  max_profile_samples: u32,
  converge_passes: u32,
  surface_pressure_pa: f32,
  radial_step_m: f32,
  max_radius_m: f32,
  g_si: f32,
};

// Layer spec: vec4(cum_mass_frac, temp_k, material_id_f32, pad)
// Model spec: vec4(central_pressure_pa, initial_est_mass_kg, pad0, pad1)
// Model out (3 vec4 per model):
//   [m*3 + 0]: vec4(total_mass_kg, radius_m, moi_factor, status_code)
//              status_code: 1.0 = converged-valid, 2.0 = fail-closed-polytope-out-of-domain, 3.0 = hit-max-radius
//   [m*3 + 1]: vec4(mean_density, surface_gravity, escape_vel, sample_count)
//   [m*3 + 2]: vec4(fail_pressure_pa, fail_temp_k, fail_layer_idx, min_polytope_margin)
@group(0) @binding(0) var<uniform> params: PlanetParams;
@group(0) @binding(1) var<storage, read> atlas_bank: array<f32>;
@group(0) @binding(2) var<storage, read> layer_specs: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> model_specs: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> model_out: array<vec4<f32>>;
// Profile buffer for model 0: 2 vec4 per sample:
//   [s*2 + 0]: vec4(radius_m, pressure_pa, density_kg_m3, mass_enclosed_kg)
//   [s*2 + 1]: vec4(gravity_m_s2, layer_idx_f32, phase_code, hit_flag)
@group(0) @binding(5) var<storage, read_write> profile_out: array<vec4<f32>>;

fn pick_layer_idx(mass_frac: f32) -> u32 {
  let n = params.layer_count;
  for (var i = 0u; i < n; i = i + 1u) {
    if (mass_frac <= layer_specs[i].x || i + 1u == n) {
      return i;
    }
  }
  return max(1u, n) - 1u;
}

@compute @workgroup_size(64)
fn solve_planetary_hydrostatic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let mid = gid.x;
  if (mid >= params.model_count) { return; }

  let mspec = model_specs[mid];
  let p_center = mspec.x;
  var est_mass = max(1.0e20, mspec.y);
  let dr = max(2000.0, params.radial_step_m);
  let max_steps = u32(min(50000.0, ceil(params.max_radius_m / dr)));

  var final_mass = 0.0;
  var final_radius = 0.0;
  var final_moi = 0.0;
  var status_code = 1.0;
  var fail_p = 0.0;
  var fail_t = 0.0;
  var fail_layer = -1.0;
  var min_margin = 1.0e30;
  var sample_count = 0u;

  let passes = max(1u, params.converge_passes);
  for (var iter_pass = 0u; iter_pass < passes; iter_pass = iter_pass + 1u) {
    var r = 0.0;
    var m = 0.0;
    var p_cur = p_center;
    var I_moi_scaled = 0.0;
    var failed = false;
    var cur_samples = 0u;
    var pass_min_margin = 1.0e30;
    let is_last = (iter_pass + 1u == passes);

    for (var s = 0u; s < max_steps; s = s + 1u) {
      if (p_cur <= params.surface_pressure_pa || r >= params.max_radius_m) {
        break;
      }
      let lidx = pick_layer_idx(m / max(1.0e20, est_mass));
      let lspec = layer_specs[lidx];
      let temp_k = lspec.y;
      let mat_id = lspec.z;

      // Inline Gate 2 Convex Polytope Atlas evaluation (strictly fail-closed!)
      let eval_res = eval_polytope_atlas_bank_2d(&atlas_bank, mat_id, temp_k, p_cur);
      if (eval_res.w < 0.5 || !(eval_res.x > 0.0)) {
        failed = true;
        status_code = 2.0;
        fail_p = p_cur;
        fail_t = temp_k;
        fail_layer = f32(lidx);
        break;
      }
      let rho = eval_res.x;
      pass_min_margin = min(pass_min_margin, eval_res.y);

      // Midpoint RK2 radial hydrostatic step
      let r_mid = r + 0.5 * dr;
      let dM = 12.566370614 * r_mid * r_mid * rho * dr;
      let m_mid = m + 0.5 * dM;
      let g = select(0.0, (params.g_si * m_mid) / (r_mid * r_mid), r_mid > 1.0);
      let dP = -rho * g * dr;

      if (is_last && mid == 0u && cur_samples < params.max_profile_samples && ((s & 1u) == 0u || s < 16u)) {
        profile_out[cur_samples * 2u + 0u] = vec4<f32>(r, p_cur, rho, m);
        profile_out[cur_samples * 2u + 1u] = vec4<f32>(g, f32(lidx), eval_res.z, eval_res.w);
        cur_samples = cur_samples + 1u;
      }

      m = m + dM;
      // Scale into (Mm)^2 * (Yg) so f32 never overflows (>3.4e38) for planetary/substellar bodies
      let r_mm = r_mid * 1.0e-6;
      let dm_yg = dM * 1.0e-24;
      I_moi_scaled = I_moi_scaled + (2.0 / 3.0) * r_mm * r_mm * dm_yg;
      p_cur = p_cur + dP;
      r = r + dr;
    }

    if (failed) {
      final_mass = m;
      final_radius = r;
      final_moi = I_moi_scaled;
      sample_count = cur_samples;
      min_margin = -1.0;
      break;
    }
    status_code = select(1.0, 3.0, r >= params.max_radius_m && p_cur > params.surface_pressure_pa);
    final_mass = m;
    final_radius = r;
    final_moi = I_moi_scaled;
    est_mass = max(1.0e20, m);
    min_margin = pass_min_margin;
    sample_count = cur_samples;
  }

  let vol = (4.0 / 3.0) * 3.14159265359 * final_radius * final_radius * final_radius;
  let mean_rho = final_mass / max(1.0, vol);
  let surf_g = (params.g_si * final_mass) / max(1.0, final_radius * final_radius);
  let v_esc = sqrt((2.0 * params.g_si * final_mass) / max(1.0, final_radius));
  let r_final_mm = final_radius * 1.0e-6;
  let m_final_yg = final_mass * 1.0e-24;
  let moi_factor = final_moi / max(1.0e-20, m_final_yg * r_final_mm * r_final_mm);

  model_out[mid * 3u + 0u] = vec4<f32>(final_mass, final_radius, moi_factor, status_code);
  model_out[mid * 3u + 1u] = vec4<f32>(mean_rho, surf_g, v_esc, f32(sample_count));
  model_out[mid * 3u + 2u] = vec4<f32>(fail_p, fail_t, fail_layer, min_margin);
}
`;async function ge(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:a=2e4,maxRadiusM:s=15e7,convergePasses:c=3,maxProfileSamples:l=256,autoFitMaxPressurePa:u=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let f=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=o(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await me(e,n.bundle,{maxPressurePa:u,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);f.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let p=i(f.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||d.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),m=f.reduce((e,t)=>e+t.massFractionTarget,0)||1,h=new Float32Array(f.length*4),g=0;for(let e=0;e<f.length;e+=1)g+=f[e].massFractionTarget/m,h.set([g,f[e].tempK,f[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,f.length,l,c]),new Float32Array(v,16,4).set([Number(n),Number(a),Number(s),pe]);let y=T(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:he,entryPoint:`solve_planetary_hydrostatic`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`read-only-storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`storage`)]}),b=e.createBuffer({size:32,usage:q.UNIFORM|q.COPY_DST}),x=e.createBuffer({size:Math.max(64,p.data.byteLength),usage:q.STORAGE|q.COPY_DST}),S=e.createBuffer({size:Math.max(16,h.byteLength),usage:q.STORAGE|q.COPY_DST}),w=e.createBuffer({size:16,usage:q.STORAGE|q.COPY_DST}),E=e.createBuffer({size:48,usage:q.STORAGE|q.COPY_SRC}),D=e.createBuffer({size:l*32,usage:q.STORAGE|q.COPY_SRC}),O=e.createBuffer({size:48,usage:q.MAP_READ|q.COPY_DST}),k=e.createBuffer({size:l*32,usage:q.MAP_READ|q.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,p.data),e.queue.writeBuffer(S,0,h),e.queue.writeBuffer(w,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,w,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,l*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(q.MAP_READ),k.mapAsync(q.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,l*32));O.unmap(),k.unmap();let s=Math.round(a[3]),c=s===2,u=s===1,m=Math.min(l,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(f.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:f[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let C=Number(f[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:fe,backend:`webgpu-polytope-atlas`,valid:u,failClosed:c,reason:c?`polytope-out-of-domain`:s===3?`max-radius-reached`:`ok`,failureState:c?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:f[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:C,dynamoCapable:u&&C>1e4&&t>1e10,layerCount:f.length,profile:Object.freeze(g),accuracyTier:d.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,w,E,D,O,k])e.destroy()}}var _e=`ulg.astrophysics.stellar-nuclear-network.v1`,ve=`ulg.astrophysics.stellar-nuclear-webgpu.v1`,ye=`ulg.astrophysics.lane-emden-webgpu.v1`,J=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),be=-.7823334099999784,xe=1602176634e-22,Se=167262192369e-38,Ce=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),we=null;function Te(){if(we)return we;let e=Ce.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+u(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+u(t,n)*r,0),s=r-i,c=o-a+s*be,l=Number(e.neutrinoLossMeV||0),d=c>0?Math.max(0,c-l):c,f=Math.abs(d)*xe/(t*Se);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:s,ignitionTempK:e.ignitionTempK,qValueMeV:c,qValueTotalMeV:c,qValueThermalMeV:d,neutrinoLossMeV:l,qValueJPerKg:f,exothermic:c>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return we=Object.freeze({schema:_e,channels:Object.freeze(e),byId:t,accuracyTier:d.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),we}function Ee(){let{byId:e}=Te();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var De=`
struct NuclearNetParams {
  sample_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  pad3: f32,
};

struct NuclearSampleIn {
  // [rhoKgM3, temperatureK, xH, xHe]
  state0: vec4<f32>,
  // [xZ, dtS, pad, pad]
  state1: vec4<f32>,
};

struct NuclearSampleOut {
  // [epsPpWPerKg, epsCnoWPerKg, eps3aWPerKg, epsPhotodisWPerKg]
  rates: vec4<f32>,
  // [nextXH, nextXHe, nextXZ, energyDepositedJPerKg]
  burn: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: NuclearNetParams;
@group(0) @binding(1) var<storage, read> samples_in: array<NuclearSampleIn>;
@group(0) @binding(2) var<storage, read_write> samples_out: array<NuclearSampleOut>;

@compute @workgroup_size(64)
fn eval_stellar_nuclear_network(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.sample_count) { return; }
  let s0 = samples_in[i].state0;
  let s1 = samples_in[i].state1;
  let rho = max(0.0, s0.x);
  let temp_k = max(1.0, s0.y);
  let sum_x = max(1e-12, s0.z + s0.w + s1.x);
  var xH = max(0.0, s0.z / sum_x);
  var xHe = max(0.0, s0.w / sum_x);
  var xZ = max(0.0, s1.x / sum_x);
  let dt_s = max(0.0, s1.y);

  let rho_cgs = rho * 1e-3;
  let t6 = temp_k * 1e-6;
  let t8 = temp_k * 1e-8;
  let t9 = temp_k * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.5 && xH > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 85.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 5.0 && xH > 1e-6 && xZ > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.35 && xHe > 1e-6) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 85.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  var e_dep_j_per_kg = 0.0;
  if (dt_s > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_s) / max(1.0, params.q_pp_j_per_kg));
    let dY = min(xHe + dX, (eps_3a * dt_s) / max(1.0, params.q_3a_j_per_kg));
    let dZ_photo = min(xZ + dY, (eps_photodis * dt_s) / max(1.0, params.q_photodis_j_per_kg));
    e_dep_j_per_kg = dX * params.q_pp_j_per_kg + dY * params.q_3a_j_per_kg - dZ_photo * params.q_photodis_j_per_kg;
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY + dZ_photo);
    xZ = max(0.0, xZ + dY - dZ_photo);
    let norm = max(1e-12, xH + xHe + xZ);
    xH = xH / norm;
    xHe = xHe / norm;
    xZ = xZ / norm;
  }

  samples_out[i] = NuclearSampleOut(
    vec4<f32>(eps_pp, eps_cno, eps_3a, eps_photodis),
    vec4<f32>(xH, xHe, xZ, e_dep_j_per_kg)
  );
}
`;async function Y(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice`);let n=Array.isArray(t)?t:[];if(n.length===0)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires at least one state sample`);let r=Ee(),i=new Float32Array(n.length*8);for(let e=0;e<n.length;e+=1){let t=n[e];i.set([Number(t.rhoKgM3??15e4),Number(t.temperatureK??15e6),Number(t.xH??.74),Number(t.xHe??.25),Number(t.xZ??t.xMetals??.01),Number(t.dtS??0),0,0],e*8)}let a=T(e,{cacheKey:`ulg-stellar-nuclear-network.v1`,label:`ulg-stellar-nuclear-network`,code:De,entryPoint:`eval_stellar_nuclear_network`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n.length,0,0,0]),new Float32Array(o,16,4).set([r.ppJPerKgH,r.tripleAlphaJPerKgHe,r.fePhotodisJPerKgFe,0]);let s=e.createBuffer({size:32,usage:J.UNIFORM|J.COPY_DST}),c=e.createBuffer({size:i.byteLength,usage:J.STORAGE|J.COPY_DST}),l=e.createBuffer({size:i.byteLength,usage:J.STORAGE|J.COPY_SRC}),u=e.createBuffer({size:i.byteLength,usage:J.MAP_READ|J.COPY_DST});try{e.queue.writeBuffer(s,0,o),e.queue.writeBuffer(c,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[s,c,l].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-stellar-nuclear-network`}),f=d.beginComputePass();f.setPipeline(a.pipeline),f.setBindGroup(0,t),f.dispatchWorkgroups(Math.ceil(n.length/64)),f.end(),d.copyBufferToBuffer(l,0,u,0,i.byteLength),e.queue.submit([d.finish()]),await u.mapAsync(J.MAP_READ);let p=new Float32Array(u.getMappedRange().slice(0,i.byteLength));u.unmap();let m=[];for(let e=0;e<n.length;e+=1){let t=e*8;m.push(Object.freeze({epsPpWPerKg:p[t+0],epsCnoWPerKg:p[t+1],eps3aWPerKg:p[t+2],epsPhotodisWPerKg:p[t+3],epsTotalWPerKg:p[t+0]+p[t+1]+p[t+2],nextMassFractions:Object.freeze({xH:p[t+4],xHe:p[t+5],xZ:p[t+6]}),energyDepositedJPerKg:p[t+7]}))}return Object.freeze({schema:ve,backend:`webgpu`,burnConstants:r,results:Object.freeze(m),provenance:Object.freeze({status:`gate1-nuclear-webgpu-derived`,scientificValidation:!1})})}finally{for(let e of[s,c,l,u])e.destroy()}}var X=`
struct LaneEmdenParams {
  count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
  d_xi: f32,
  max_xi: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<uniform> params: LaneEmdenParams;
@group(0) @binding(1) var<storage, read> indices_n: array<f32>;
// Output vec4(polytropeIndexN, xi1, massIntegral, centralToMeanDensityRatio)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>;

fn le_deriv(x: f32, th: f32, dth: f32, poly_n: f32) -> vec2<f32> {
  let th_safe = max(0.0, th);
  let th_n = select(0.0, pow(th_safe, poly_n), th_safe > 0.0 || poly_n == 0.0);
  return vec2<f32>(dth, -(2.0 / x) * dth - th_n);
}

@compute @workgroup_size(64)
fn solve_lane_emden_rk4(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  let poly_n = indices_n[i];
  let dxi = params.d_xi;
  var xi = dxi;
  let xi2 = xi * xi;
  var theta = 1.0 - xi2 / 6.0 + (poly_n * xi2 * xi2) / 120.0;
  var dtheta = -xi / 3.0 + (poly_n * xi2 * xi) / 30.0;

  for (var step = 0u; step < params.max_steps; step = step + 1u) {
    if (theta <= 0.0 || xi >= params.max_xi) { break; }
    let k1 = le_deriv(xi, theta, dtheta, poly_n);
    let k2 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k1.x, dtheta + 0.5 * dxi * k1.y, poly_n);
    let k3 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k2.x, dtheta + 0.5 * dxi * k2.y, poly_n);
    let k4 = le_deriv(xi + dxi, theta + dxi * k3.x, dtheta + dxi * k3.y, poly_n);
    let next_theta = theta + (dxi / 6.0) * (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x);
    let next_dtheta = dtheta + (dxi / 6.0) * (k1.y + 2.0 * k2.y + 2.0 * k3.y + k4.y);
    if (next_theta <= 0.0) {
      let frac = theta / max(1e-12, theta - next_theta);
      xi = xi + frac * dxi;
      dtheta = dtheta + frac * (next_dtheta - dtheta);
      theta = 0.0;
      break;
    }
    xi = xi + dxi;
    theta = next_theta;
    dtheta = next_dtheta;
  }

  let mass_int = -(xi * xi * dtheta);
  let rho_ratio = -(xi / min(-1e-12, 3.0 * dtheta));
  results[i] = vec4<f32>(poly_n, xi, mass_int, rho_ratio);
}
`;async function Oe(e,t=[1.5,3],{dXi:n=.002,maxXi:r=25}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice`);let i=Float32Array.from(Array.isArray(t)?t:[t]);if(i.length===0)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires at least one polytrope index`);let a=T(e,{cacheKey:`ulg-lane-emden-rk4.v1`,label:`ulg-lane-emden-rk4`,code:X,entryPoint:`solve_lane_emden_rk4`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=Math.ceil(r/Math.max(1e-5,n))+4,s=new ArrayBuffer(32);new Uint32Array(s,0,4).set([i.length,o,0,0]),new Float32Array(s,16,4).set([n,r,0,0]);let c=e.createBuffer({size:32,usage:J.UNIFORM|J.COPY_DST}),l=e.createBuffer({size:Math.max(16,i.byteLength),usage:J.STORAGE|J.COPY_DST}),u=e.createBuffer({size:i.length*16,usage:J.STORAGE|J.COPY_SRC}),d=e.createBuffer({size:i.length*16,usage:J.MAP_READ|J.COPY_DST});try{e.queue.writeBuffer(c,0,s),e.queue.writeBuffer(l,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[c,l,u].map((e,t)=>({binding:t,resource:{buffer:e}}))}),n=e.createCommandEncoder({label:`ulg-lane-emden-rk4`}),r=n.beginComputePass();r.setPipeline(a.pipeline),r.setBindGroup(0,t),r.dispatchWorkgroups(Math.ceil(i.length/64)),r.end(),n.copyBufferToBuffer(u,0,d,0,i.length*16),e.queue.submit([n.finish()]),await d.mapAsync(J.MAP_READ);let o=new Float32Array(d.getMappedRange().slice(0,i.length*16));d.unmap();let f=[];for(let e=0;e<i.length;e+=1){let t=e*4;f.push(Object.freeze({polytropeIndexN:o[t+0],xi1:o[t+1],massIntegral:o[t+2],centralToMeanDensityRatio:o[t+3],g7Advisory:!0}))}return Object.freeze({schema:ye,backend:`webgpu`,solutions:Object.freeze(f)})}finally{for(let e of[c,l,u,d])e.destroy()}}var ke=`peercompute.ulg.hydrogen-stellar-closure.v1`,Z=`peercompute.ulg.stellar-closure-table-abi.v1`,Ae=1380649e-29,je=16605390666e-37,Me=167262192369e-38,Ne=91093837015e-41,Pe=1054571817e-43,Fe=299792458,Ie=66743e-15,Le=4*5.670374419e-8/Fe,Re=1602176634e-28,ze=27.211386245988,Be=198847e25,Ve=Ee();Ve.ppThermalMeV;var He=Ve.ppJPerKgH;Ve.tripleAlphaMeV;var Ue=Ve.tripleAlphaJPerKgHe;Ve.fePhotodisMeV;var Q=null;async function We(e,{forceRecompute:n=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Q?.backend===`webgpu`&&!n)return Q;let r=await k(e,1,{A:1,maxScf:45}),i=Number(r.totalEnergyHa??-.5),a=Number(r.homoEnergyHa??r.orbitals?.[0]?.energyHa??-.5),o=Math.max(11,Math.min(15,Math.abs(i)*ze)),s=await h(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),l=.05,u=await h(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),d=await h(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-l]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),p=2*i,m=Math.max(.08,p-s.totalEnergyHa)*ze,g=Math.max(.1,(u.totalEnergyHa-2*s.totalEnergyHa+d.totalEnergyHa)/(l*l)),_=Math.sqrt(g/(.5*1836.152673))*ze*Re/Ae,v=c(15e4/Me*t**3),y=f(v);return Q=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:a,hIonizationEv:o,hIonizationTempK:o*Re/Ae,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:p,h2DiradicalStretched:1,h2DissociationEv:m,h2DissociationTempK:m*Re/Ae,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Q}function Ge({forceRecompute:e=!1}={}){if(Q&&!e)return Q;let r=n(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),i=r.orbitals?.[0]?.energyHa??-.5,o=Math.max(11,Math.min(15,Math.abs(r.totalEnergyHa)*ze)),s=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),l=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),u=Math.max(.08,l.totalEnergyHa-s.totalEnergyHa)*ze,d=.04,p=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=a([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-d]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(d*d)),_=Math.sqrt(g/(.5*1836.152673))*ze*Re/Ae,v=c(15e4/Me*t**3),y=f(v);return Q=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:r.totalEnergyHa,h1sOrbitalEnergyHa:i,hIonizationEv:o,hIonizationTempK:o*Re/Ae,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:l.totalEnergyHa,h2DiradicalStretched:l.diradicalCharacter,h2DissociationEv:u,h2DissociationTempK:u*Re/Ae,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),Q}function Ke(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/Me);if(n<=0)return 0;let r=Pe*Math.cbrt(3*Math.PI*Math.PI*n)/(Ne*Fe),i=r*r,a=Ne**4*Fe**5/(24*Math.PI*Math.PI*Pe**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function $(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function qe({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||Ge(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/Me,m=s*d/(4*Me),h=s*f/(16*Me),g=2*Math.PI*Me*Ae*c/(2*Math.PI*Pe)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*Ne*Ae*c/(2*Math.PI*Pe)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/je/A,ee=A*Ae*c,M=Le/3*c**4,N=Ke(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),P=$(s),F=ee+M+N+P,I=N/Math.max(1e-30,F),L=M/Math.max(1e-30,F),R=P/Math.max(1e-30,F),z=4*b*(1-b),B=4*w*(1-w),V=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,te=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),ne=te*(1-L)+4/3*L,re=Math.max(1.06,ne-.5*z-.48*B-V)*(1-R)+2.75*R,H=.1*(1/(1+Math.exp((c-1600)/180))),ie=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),ae=4e21*(1+u)*(f+.001)*s*c**-3.5,oe=.02*(1+u)*Math.max(.01,w),se=Math.max(1e-4,Math.min(1e5,H+ie+ae+oe)),ce=ee/(Math.max(.15,te-1)*s)+3*M/s,U=(1-b)*.5*u*o.h2DissociationEv*Re/Me,W=w*u*o.hIonizationEv*Re/Me,G=ce+U+W;return{schema:ke,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:re,pressureIdealPa:ee,pressureRadPa:M,pressureDegPa:N,pressureNucSatPa:P,pressureTotalPa:F,pDegFraction:I,pRadFraction:L,pNucFraction:R,soundSpeedMPerS:Math.sqrt(Math.max(1,re*F/s)),kappaM2PerKg:se,specificEnergyJPerKg:G,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Je({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/He),E=Math.min(d+T,x*a/Ue),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*Ie*e*Be/(Fe*Fe),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Ye(e){let t=E(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function Xe({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function Ze({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||Ge(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=qe({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:Z,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function Qe({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=Ze({anchors:t?await We(t):Ge()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:Z,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var $e=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,et=128,tt=32,nt=tt*tt*tt,rt=nt*8,it=`
struct HydroParticle {
  pos_mass: vec4<f32>,   // [x, y, z, mass_sim]
  vel_smooth: vec4<f32>, // [vx, vy, vz, h_smooth]
  thermo: vec4<f32>,     // [log10T, log10Rho, xH, log10EpsNuc]
  state: vec4<f32>,      // [fMol, xIon, xHe, xZ]
};

struct EosClosureCell {
  eos0: vec4<f32>,       // [mu, gammaEff, fMol, xIon]
  eos1: vec4<f32>,       // [pDegFrac, log10Kappa, pNucFrac, pRadFrac]
};

struct HydroParams {
  count: u32,
  n_rho: u32,
  n_temp: u32,
  reset_peaks: u32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  theta2: f32,
  log_rho_min: f32,
  log_rho_max: f32,
  log_t_min: f32,
  log_t_max: f32,
  base_log_rho: f32,
  ref_rho_sim: f32,
  burn_timescale_s: f32,
  time_accel: f32,
  t_scale_k: f32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  u_scale_j_per_kg: f32,
  pad_f0: f32,
  pad_f1: f32,
};

@group(0) @binding(0) var<storage, read> src_particles: array<HydroParticle>;
@group(0) @binding(1) var<storage, read_write> dst_particles: array<HydroParticle>;
// Uniform full-domain 32^3 compressible hydro accumulators (32768 * 8 atomic<i32>)
@group(0) @binding(2) var<storage, read_write> hydro_accum: array<atomic<i32>>;
// Canonical SchroederScaleAtlas multipole gravity output:
//   [0..count-1]: vec4(ax, ay, az, grav_phi), [count]: vec4(R_com, M_tot), [count+1]: vec4(V_com, 0)
@group(0) @binding(3) var<storage, read> ss_acc_phi: array<vec4<f32>>;
// Uniform full-domain 32^3 hydro grid: 2 vec4 per cell:
//   [c*2 + 0]: vec4(mass_cell, press_cell, cell_com_rel_x, cell_com_rel_y)
//   [c*2 + 1]: vec4(cell_vx_rel, cell_vy_rel, cell_vz_rel, cell_com_rel_z)
@group(0) @binding(4) var<storage, read_write> hydro_grid: array<vec4<f32>>;
// Pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
@group(0) @binding(5) var<storage, read> eos_table: array<EosClosureCell>;
// 16 atomic<u32> global diagnostic telemetry slots (64 B)
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: HydroParams;

const HYDRO_DIM: u32 = ${tt}u;
const HYDRO_COUNT: u32 = ${nt}u;

const Q_MASS: f32 = 65536.0;
const Q_MOM: f32 = 4096.0;
const Q_PRESS: f32 = 64.0;

fn clamp_cell32(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(31u, u32(u * 32.0));
}

fn cell_idx32(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 1024u) + (cy * 32u) + cx;
}

fn sample_eos_table(log_rho: f32, log_t: f32) -> EosClosureCell {
  let nr = max(2u, params.n_rho);
  let nt = max(2u, params.n_temp);
  let ur = clamp((log_rho - params.log_rho_min) / max(1e-4, params.log_rho_max - params.log_rho_min), 0.0, 0.9999) * f32(nr - 1u);
  let ut = clamp((log_t - params.log_t_min) / max(1e-4, params.log_t_max - params.log_t_min), 0.0, 0.9999) * f32(nt - 1u);
  let r0 = min(nr - 2u, u32(ur));
  let t0 = min(nt - 2u, u32(ut));
  let fr = ur - f32(r0);
  let ft = ut - f32(t0);

  let c00 = eos_table[t0 * nr + r0];
  let c10 = eos_table[t0 * nr + (r0 + 1u)];
  let c01 = eos_table[(t0 + 1u) * nr + r0];
  let c11 = eos_table[(t0 + 1u) * nr + (r0 + 1u)];

  let e0_lo = mix(c00.eos0, c10.eos0, fr);
  let e0_hi = mix(c01.eos0, c11.eos0, fr);
  let e1_lo = mix(c00.eos1, c10.eos1, fr);
  let e1_hi = mix(c01.eos1, c11.eos1, fr);

  return EosClosureCell(mix(e0_lo, e0_hi, ft), mix(e1_lo, e1_hi, ft));
}

@compute @workgroup_size(64)
fn sgh_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < 16u) {
    let is_peak_slot = (i <= 2u || i == 14u);
    if (!is_peak_slot || params.reset_peaks != 0u) {
      atomicStore(&telemetry[i], 0u);
    }
  }
  if (i < HYDRO_COUNT) {
    let hb = i * 8u;
    atomicStore(&hydro_accum[hb + 0u], 0);
    atomicStore(&hydro_accum[hb + 1u], 0);
    atomicStore(&hydro_accum[hb + 2u], 0);
    atomicStore(&hydro_accum[hb + 3u], 0);
    atomicStore(&hydro_accum[hb + 4u], 0);
    atomicStore(&hydro_accum[hb + 5u], 0);
    atomicStore(&hydro_accum[hb + 6u], 0);
    atomicStore(&hydro_accum[hb + 7u], 0);
    hydro_grid[i * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[i * 2u + 1u] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn sgh_deposit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = src_particles[i];
  let pm = p.pos_mass;
  if (!(pm.w > 0.0)) { return; }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let rel_pos = pm.xyz - com_pos;
  let rel_vel = p.vel_smooth.xyz - com_vel;

  // Uniform full-domain 32^3 compressible hydrodynamics grid accumulation
  let hx = clamp_cell32(rel_pos.x, params.box_half);
  let hy = clamp_cell32(rel_pos.y, params.box_half);
  let hz = clamp_cell32(rel_pos.z, params.box_half);
  let hb = cell_idx32(hx, hy, hz) * 8u;

  let logT = clamp(p.thermo.x, 1.0, 9.6);
  let logRho = clamp(p.thermo.y, -18.0, 11.0);
  let eos = sample_eos_table(logRho, logT);
  let mu_g = max(0.45, eos.eos0.x);
  let gamma_g = clamp(eos.eos0.y, 1.05, 2.75);
  let p_deg = clamp(eos.eos1.x, 0.0, 1.0);
  let log10_kappa_dep = eos.eos1.y;
  let p_nuc = clamp(eos.eos1.z, 0.0, 1.0);
  let p_rad = clamp(eos.eos1.w, 0.0, 1.0);

  let temp_k = pow(10.0, logT);
  let u_therm = temp_k / (params.t_scale_k * mu_g);
  let opt_trap_dep = clamp((logRho + log10_kappa_dep + 6.5) / 7.5, 0.0, 1.0);
  let gamma_soft = clamp((gamma_g - 1.02) / 0.65, 0.16, 2.8);
  let cs2_thermal = clamp((gamma_g - 1.0) * u_therm, 0.0, 320.0) * gamma_soft;
  let cs2_rad = p_rad * opt_trap_dep * opt_trap_dep * 14.0;
  let cs2_deg = p_deg * 28.0;
  let cs2_nuc = p_nuc * 1600.0;
  let press_cell = pm.w * (cs2_thermal + cs2_rad + cs2_deg + cs2_nuc);

  atomicAdd(&hydro_accum[hb + 0u], i32(round(clamp(pm.w * Q_MASS, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 1u], i32(round(clamp(press_cell * Q_PRESS, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 2u], i32(round(clamp(pm.w * rel_pos.x * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 3u], i32(round(clamp(pm.w * rel_pos.y * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 4u], i32(round(clamp(pm.w * rel_pos.z * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 5u], i32(round(clamp(pm.w * rel_vel.x * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 6u], i32(round(clamp(pm.w * rel_vel.y * Q_MOM, -1e8, 1e8))));
  atomicAdd(&hydro_accum[hb + 7u], i32(round(clamp(pm.w * rel_vel.z * Q_MOM, -1e8, 1e8))));
}

@compute @workgroup_size(64)
fn sgh_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= HYDRO_COUNT) { return; }
  let hb = cell * 8u;
  let m_h = f32(atomicLoad(&hydro_accum[hb + 0u])) / Q_MASS;
  if (m_h > 1e-6) {
    let inv_m = 1.0 / m_h;
    let p_sum = f32(atomicLoad(&hydro_accum[hb + 1u])) / Q_PRESS;
    let cx = (f32(atomicLoad(&hydro_accum[hb + 2u])) / Q_MOM) * inv_m;
    let cy = (f32(atomicLoad(&hydro_accum[hb + 3u])) / Q_MOM) * inv_m;
    let cz = (f32(atomicLoad(&hydro_accum[hb + 4u])) / Q_MOM) * inv_m;
    let vx = (f32(atomicLoad(&hydro_accum[hb + 5u])) / Q_MOM) * inv_m;
    let vy = (f32(atomicLoad(&hydro_accum[hb + 6u])) / Q_MOM) * inv_m;
    let vz = (f32(atomicLoad(&hydro_accum[hb + 7u])) / Q_MOM) * inv_m;
    hydro_grid[cell * 2u + 0u] = vec4<f32>(m_h, p_sum, cx, cy);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(vx, vy, vz, cz);
  } else {
    hydro_grid[cell * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(0.0);
  }
}

fn read_hydro_a(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 0u];
}

fn read_hydro_b(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 1u];
}

fn pair_face_press(m_self: f32, cs2_self: f32, a_nbr: vec4<f32>, cell_w: f32) -> f32 {
  let m_n = a_nbr.x;
  if (m_n <= 1e-6) { return 0.0; }
  let cs2_n = a_nbr.y / m_n;
  return (m_n * (cs2_self + cs2_n)) / ((m_self + m_n) * cell_w);
}

@compute @workgroup_size(64)
fn sgh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let p = src_particles[idx];
  let self_pm = p.pos_mass;
  let self_vs = p.vel_smooth;
  if (!(self_pm.w > 0.0)) {
    dst_particles[idx] = p;
    return;
  }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let self_rel = self_pm.xyz - com_pos;
  let self_vrel_sys = self_vs.xyz - com_vel;

  // 1. Canonical SchroederScaleAtlas multipole gravity acceleration & potential |Phi_i|
  let grav_sample = ss_acc_phi[idx];
  let acc_grav = grav_sample.xyz;
  let grav_phi = grav_sample.w;

  // 2. Uniform full-domain 32^3 local hydro stencil (ZERO origin-centered inner grid!)
  let hx = i32(clamp_cell32(self_rel.x, params.box_half));
  let hy = i32(clamp_cell32(self_rel.y, params.box_half));
  let hz = i32(clamp_cell32(self_rel.z, params.box_half));
  let cell_w = (2.0 * params.box_half) / 32.0;

  let a_mid = read_hydro_a(hx, hy, hz);
  let b_mid = read_hydro_b(hx, hy, hz);
  let a_xp = read_hydro_a(hx + 1, hy, hz);
  let a_xm = read_hydro_a(hx - 1, hy, hz);
  let a_yp = read_hydro_a(hx, hy + 1, hz);
  let a_ym = read_hydro_a(hx, hy - 1, hz);
  let a_zp = read_hydro_a(hx, hy, hz + 1);
  let a_zm = read_hydro_a(hx, hy, hz - 1);

  let b_xp = read_hydro_b(hx + 1, hy, hz);
  let b_xm = read_hydro_b(hx - 1, hy, hz);
  let b_yp = read_hydro_b(hx, hy + 1, hz);
  let b_ym = read_hydro_b(hx, hy - 1, hz);
  let b_zp = read_hydro_b(hx, hy, hz + 1);
  let b_zm = read_hydro_b(hx, hy, hz - 1);

  let nbr_mass = a_mid.x + 0.16 * (a_xp.x + a_xm.x + a_yp.x + a_ym.x + a_zp.x + a_zm.x);
  let local_rho_sim = max(self_pm.w * 2.0, nbr_mass * 2.4);

  let cell_com_rel = select(self_rel, vec3<f32>(a_mid.z, a_mid.w, b_mid.w), a_mid.x > 1e-6);
  let cell_vel_rel = select(self_vrel_sys, b_mid.xyz, a_mid.x > 1e-6);
  let r_cell_rel = self_rel - cell_com_rel;
  let v_cell_rel = self_vrel_sys - cell_vel_rel;

  let vx_p = select(cell_vel_rel.x, b_xp.x, a_xp.x > 1e-6);
  let vx_m = select(cell_vel_rel.x, b_xm.x, a_xm.x > 1e-6);
  let vy_p = select(cell_vel_rel.y, b_yp.y, a_yp.x > 1e-6);
  let vy_m = select(cell_vel_rel.y, b_ym.y, a_ym.x > 1e-6);
  let vz_p = select(cell_vel_rel.z, b_zp.z, a_zp.x > 1e-6);
  let vz_m = select(cell_vel_rel.z, b_zm.z, a_zm.x > 1e-6);
  let div_v_grid = ((vx_p - vx_m) + (vy_p - vy_m) + (vz_p - vz_m)) / (2.0 * cell_w);
  let div_v_sub = dot(v_cell_rel, r_cell_rel) / (dot(r_cell_rel, r_cell_rel) + 0.16 * cell_w * cell_w);
  let div_v = clamp(0.55 * div_v_grid + 0.45 * div_v_sub, -6.0, 6.0);

  let m_self_cell = max(1e-5, a_mid.x);
  let cs2_local = select(0.0, a_mid.y / m_self_cell, a_mid.x > 1e-6);
  let acc_press_grad = vec3<f32>(
    pair_face_press(m_self_cell, cs2_local, a_xm, cell_w) - pair_face_press(m_self_cell, cs2_local, a_xp, cell_w),
    pair_face_press(m_self_cell, cs2_local, a_ym, cell_w) - pair_face_press(m_self_cell, cs2_local, a_yp, cell_w),
    pair_face_press(m_self_cell, cs2_local, a_zm, cell_w) - pair_face_press(m_self_cell, cs2_local, a_zp, cell_w)
  ) * 0.5;
  let acc_press_sub = r_cell_rel * (cs2_local / (0.35 * cell_w * cell_w));

  // 3. Local Jeans sub-grid physical density scaling from local_rho_sim & local |Phi_i|
  let prev_logT = clamp(p.thermo.x, 1.0, 9.6);
  let prev_logRho = clamp(p.thermo.y, -18.0, 10.8);
  let rho_ratio = max(1e-3, local_rho_sim / max(1e-4, params.ref_rho_sim));
  let log10_rho_ratio = log2(rho_ratio) * 0.30103;
  let phi_overburden = clamp(log2(max(1.0, grav_phi / 16.0)) * 0.30103 * 3.15, 0.0, 6.8);
  let target_logRho = clamp(
    params.base_log_rho + 6.35 * log10_rho_ratio + phi_overburden,
    -17.8,
    10.6
  );
  let logRho = mix(prev_logRho, target_logRho, min(1.0, params.dt * 12.0));

  // 4. Query pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
  let cell_eos = sample_eos_table(logRho, prev_logT);
  let mu_gas = max(0.45, cell_eos.eos0.x);
  let gamma_eff = clamp(cell_eos.eos0.y, 1.05, 2.75);
  let fMol = clamp(cell_eos.eos0.z, 0.0, 1.0);
  let xIon = clamp(cell_eos.eos0.w, 0.0, 1.0);
  let pDeg_frac = clamp(cell_eos.eos1.x, 0.0, 1.0);
  let log10_kappa = cell_eos.eos1.y;
  let pNuc_frac = clamp(cell_eos.eos1.z, 0.0, 1.0);
  let pRad_frac = clamp(cell_eos.eos1.w, 0.0, 1.0);

  // 5. General Gamow-window thermonuclear reaction network using Gate 1 Q-values
  var xH = clamp(p.thermo.z, 0.0, 1.0);
  var xHe = clamp(p.state.z, 0.0, 1.0);
  var xZ = clamp(p.state.w, 0.0, 1.0);

  let tempK = pow(10.0, prev_logT);
  let rho_cgs = pow(10.0, clamp(logRho - 3.0, -21.0, 8.5));
  let t6 = tempK * 1e-6;
  let t8 = tempK * 1e-8;
  let t9 = tempK * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.8 && xH > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 80.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 7.0 && xH > 1e-5 && xZ > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.45 && xHe > 1e-5) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 80.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  let eps_exo = eps_pp + eps_cno + eps_3a;
  let log10_eps = log2(eps_exo + 1e-30) * 0.30103;

  // 6. Exact nucleon-conserving nuclear transmutation & conservative Gate 1 Q * dX energy release
  let dt_burn = params.dt * params.burn_timescale_s * params.time_accel;
  var dX_burned = 0.0;
  var dY_burned = 0.0;
  var dZ_photo = 0.0;
  if (eps_exo > 1e-7 && dt_burn > 0.0) {
    dX_burned = min(xH, ((eps_pp + eps_cno) * dt_burn) / max(1.0, params.q_pp_j_per_kg));
    dY_burned = min(xHe + dX_burned, (eps_3a * dt_burn) / max(1.0, params.q_3a_j_per_kg));
    xH = max(0.0, xH - dX_burned);
    xHe = max(0.0, xHe + dX_burned - dY_burned);
    xZ = max(0.0, xZ + dY_burned);
    let x_sum = max(1e-6, xH + xHe + xZ);
    xH = xH / x_sum;
    xHe = xHe / x_sum;
    xZ = xZ / x_sum;
  }
  if (eps_photodis > 1.0 && dt_burn > 0.0) {
    dZ_photo = min(xZ, (eps_photodis * dt_burn) / max(1.0, params.q_photodis_j_per_kg));
  }

  // 7. True First-Law Specific Internal Energy Conservation (exact Q * dX nuclear heating!)
  let dt_eff = params.dt * params.time_accel;
  let u_prev = tempK / (params.t_scale_k * mu_gas);
  let gamma_m1 = clamp(gamma_eff - 1.0, 0.06, 0.90);

  let is_compressing = div_v_grid < -0.04 && cs2_local < 900.0;
  let damp_local = select(0.996, 0.925, is_compressing);
  let v_rel2 = dot(v_cell_rel, v_cell_rel);
  let ke_dissipated = 0.5 * (1.0 - damp_local * damp_local) * v_rel2;
  let optical_trap = clamp((logRho + log10_kappa + 6.5) / 7.5, 0.0, 1.0);

  let du_pdv = gamma_m1 * u_prev * clamp(-div_v, -6.0, 6.0) * params.dt;
  let du_visc = ke_dissipated * (0.35 + 0.65 * optical_trap);
  // Conservative nuclear specific-energy deposition from Gate 1 Q-values (J/kg -> dimensionless u):
  let e_nuc_j_per_kg = dX_burned * params.q_pp_j_per_kg + dY_burned * params.q_3a_j_per_kg;
  let e_endo_j_per_kg = dZ_photo * params.q_photodis_j_per_kg;
  let u_norm_j_per_kg = max(1e6, params.u_scale_j_per_kg);
  let du_nuc = clamp(e_nuc_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, 18.0 * dt_eff);
  let du_endo = clamp(e_endo_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, u_prev * 0.65);

  let thin_cool = (1.0 - optical_trap * 0.94) * max(0.0, u_prev - 3.5e-5) * 1.15 * params.dt;
  let thick_cool = optical_trap * (u_prev * 0.06 + 0.0005 * u_prev * u_prev / (1.0 + 0.003 * u_prev)) * params.dt;
  let du_rad = thin_cool + thick_cool;

  let u_next = max(2.0e-5, u_prev + du_pdv + du_visc + du_nuc - du_endo - du_rad);
  let next_temp_k = clamp(u_next * params.t_scale_k * mu_gas, 14.0, 3.5e9);
  let next_logT = clamp(log2(next_temp_k) * 0.30103, 1.15, 9.55);

  // 8. General Hydrodynamic Equations of Motion (100% translation- & multi-body-invariant):
  //    a_total = a_grav + (-grad P / rho) + a_sub_cell_pressure
  //    (gamma_soft is already encoded symmetrically in cell cs2 inside sgh_deposit so
  //     inter-cell face forces obey Newton's 3rd Law identically!)
  let acc_press_total = acc_press_grad + acc_press_sub;
  let acc_total = acc_grav + acc_press_total;

  var vel = com_vel + cell_vel_rel + v_cell_rel * damp_local + acc_total * params.dt;
  let v_rel_next = vel - com_vel;
  let spd_rel = length(v_rel_next);
  let v_cap = 42.0;
  if (spd_rel > v_cap) {
    vel = com_vel + v_rel_next * (v_cap / spd_rel);
  }
  var pos = self_pm.xyz + vel * params.dt;

  // Soft COM-relative outer domain confinement ONLY for bound non-escaping gas at domain edge
  let next_rel = pos - com_pos;
  let r_rel_box = length(next_rel);
  if (r_rel_box > params.box_half - 0.45 && spd_rel < 14.0) {
    pos = com_pos + next_rel * ((params.box_half - 0.45) / r_rel_box);
    vel = com_vel + (vel - com_vel) * 0.72;
  }

  dst_particles[idx] = HydroParticle(
    vec4<f32>(pos, self_pm.w),
    vec4<f32>(vel, self_vs.w),
    vec4<f32>(next_logT, logRho, xH, log10_eps),
    vec4<f32>(fMol, xIon, xHe, xZ)
  );

  // 9. 64-byte atomic global diagnostic telemetry reduction (purely physical & translation-invariant!)
  let logT_u = u32(clamp(next_logT * 1000.0, 0.0, 20000.0));
  let logRho_u = u32(clamp((logRho + 20.0) * 1000.0, 0.0, 40000.0));
  let logEps_u = u32(clamp((log10_eps + 30.0) * 1000.0, 0.0, 60000.0));
  atomicMax(&telemetry[0u], logT_u);
  atomicMax(&telemetry[1u], logRho_u);
  atomicMax(&telemetry[2u], logEps_u);
  if (log10_eps > -5.5) {
    atomicAdd(&telemetry[3u], 1u);
  }
  atomicAdd(&telemetry[4u], u32(clamp(fMol * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[5u], u32(clamp(xIon * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[6u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[7u], u32(clamp(xHe * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[8u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[9u], u32(clamp(pDeg_frac * 1000.0, 0.0, 1000.0)));
  if (logRho > -3.0) {
    atomicAdd(&telemetry[10u], 1u);
    atomicAdd(&telemetry[11u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[12u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[15u], u32(clamp(gamma_eff * 1000.0, 0.0, 3000.0)));
  }
  let v_out = select(0.0, dot(vel - com_vel, next_rel / max(0.25, r_rel_box)), r_rel_box > 0.6);
  if (v_out > 6.5) {
    atomicAdd(&telemetry[13u], 1u);
  }
  if (pNuc_frac > 0.08) {
    atomicAdd(&telemetry[14u], 1u);
  }
}
`;function at(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=qe({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=Je({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=Xe({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),ee=Ye(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:ee,stage:A}}function ot({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,baseLogRho:o=-16.2,refRhoSim:s=.08,burnTimescaleS:c=42e13,tScaleK:l=78e4,label:u=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let d=Float32Array.from(t),f=d.length/16,p=n||Ze({nRho:28,nTemp:40});function m(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let h=m(d),g=0,_=0,v=!1,y=!1;function b(e){let t=1.2,n=o,r=0,i=0,a=0,s=0;for(let o=0;o<f;o+=1){let c=o*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],s+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(s*1e3),c[10]=1,c[11]=Math.round(s/f*1e3),c[12]=Math.round(i/f*1e3),c[15]=1667,at(c,f,h,!1)}let x=b(d),S=Math.max(64,d.byteLength),E=[e.createBuffer({label:`${u}-p0`,size:S,usage:172}),e.createBuffer({label:`${u}-p1`,size:S,usage:172})],D=M(e,{maxCount:f,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:.075,label:`${u}-ss-atlas`}),O=Ee(),k=e.createBuffer({label:`${u}-hydro-accum`,size:rt*4,usage:et}),A=e.createBuffer({label:`${u}-hydro-grid`,size:nt*2*16,usage:et}),j=e.createBuffer({label:`${u}-eos-table`,size:p.data.byteLength,usage:136}),ee=e.createBuffer({label:`${u}-telemetry`,size:64,usage:132}),N=e.createBuffer({label:`${u}-telemetry-staging`,size:64,usage:9}),P=e.createBuffer({label:`${u}-params`,size:96,usage:72}),F=e.createBuffer({label:`${u}-body-staging`,size:S,usage:9});e.queue.writeBuffer(E[0],0,d),e.queue.writeBuffer(E[1],0,d),e.queue.writeBuffer(j,0,p.data);let I=[C(0,`read-only-storage`),C(1,`storage`),C(2,`storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`read-only-storage`),C(6,`storage`),C(7,`uniform`)],L=t=>T(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v16-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:it,entryPoint:t,bindings:I}),R={clear:L(`sgh_clear`),deposit:L(`sgh_deposit`),finalize:L(`sgh_finalize`),integrate:L(`sgh_integrate`)},z=(t,n,r)=>w(e,{layout:R.integrate.bindGroupLayout,label:`${u}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:D.accPhiBuffer}},{binding:4,resource:{buffer:A}},{binding:5,resource:{buffer:j}},{binding:6,resource:{buffer:ee}},{binding:7,resource:{buffer:P}}]}),B=[z(E[0],E[1],0),z(E[1],E[0],1)],V=0,te=!1,ne=!1,re=!0;async function H(){if(!E||!F||ne||y)return d;ne=!0;try{let t=e.createCommandEncoder({label:`${u}-readback`});t.copyBufferToBuffer(E[V],0,F,0,d.byteLength),e.queue.submit([t.finish()]),await F.mapAsync(1),d.set(new Float32Array(F.getMappedRange())),F.unmap()}finally{ne=!1}return d}async function ie({dt:t=.018,timeAccel:n=1,readTelemetry:d=!0}={}){if(y||!E)return x;let m=Math.max(.25,Math.min(25,Number(n)||1)),b=Math.max(.004,Math.min(.028,Number(t)||.018)),S=1380649e-29/167262192369e-38*1.5*l,C=new ArrayBuffer(96),w=new Uint32Array(C),T=new Float32Array(C);w[0]=f,w[1]=p.nRho,w[2]=p.nTemp,w[3]=+!!re,T[4]=b,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=p.logRhoMin,T[10]=p.logRhoMax,T[11]=p.logTempMin,T[12]=p.logTempMax,T[13]=o,T[14]=s,T[15]=c,T[16]=m,T[17]=l,T[18]=O.ppJPerKgH,T[19]=O.tripleAlphaJPerKgHe,T[20]=O.fePhotodisJPerKgFe,T[21]=S,e.queue.writeBuffer(P,0,C),D.writeParams({count:f,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let k=V,A=1-V,j=B[k],M=Math.ceil(f/64),F=Math.ceil(nt/64),I=e.createCommandEncoder({label:`${u}-step-${g}`}),L=I.beginComputePass({label:`${u}-pass`});D.encodeIntoPass(L,{srcBuffer:E[k],count:f}),L.setPipeline(R.clear.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(F),L.setPipeline(R.deposit.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.setPipeline(R.finalize.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(F),L.setPipeline(R.integrate.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.end();let z=d&&!te;if(z&&I.copyBufferToBuffer(ee,0,N,0,64),re=z,e.queue.submit([I.finish()]),V=A,g+=1,_+=b*m*.35,z){te=!0;try{await N.mapAsync(1);let e=new Uint32Array(N.getMappedRange().slice(0));N.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=25e7&&(v=!0),x=at(e,f,h,v)}finally{te=!1}}return x}function ae(t){return d=Float32Array.from(t),h=m(d),g=0,_=0,v=!1,V=0,re=!0,x=b(d),E&&(e.queue.writeBuffer(E[0],0,d),e.queue.writeBuffer(E[1],0,d)),x}function oe(){y||(y=!0,E?.[0]?.destroy(),E?.[1]?.destroy(),D.destroy(),k.destroy(),A.destroy(),j.destroy(),ee.destroy(),N.destroy(),P.destroy(),F.destroy(),E=null)}return{schema:$e,get count(){return f},get totalMassSolar(){return h},get stepIndex(){return g},get simTimeMyr(){return _},get backend(){return`webgpu`},get gravityMode(){return D.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return O},get closureTable(){return p},get anchors(){return p.anchors},getTelemetry:()=>x,getBodies:()=>d,getResidentBuffer:()=>E?E[V]:null,readbackBodies:H,step:ie,resetBodies:ae,dispose:oe}}var st=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function ct(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function lt({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=st[t]||st[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=ct(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0;if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let C=Math.hypot(r-S,i,v),w=Math.exp(-C*C/12),T=g+w*1,E=h+w*.1,D=.32+.04*Math.min(6,C);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=D,s[t+8]=E,s[t+9]=T,s[t+10]=.74,s[t+11]=-30,s[t+12]=.998,s[t+13]=0,s[t+14]=.25,s[t+15]=.01}return s}function ut(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}function dt(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);function ft({count:e=4096,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.22,centerOffset:a=[0,0,0]}={}){let o=Math.max(64,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=Number(a?.[0])||0,l=Number(a?.[1])||0,u=Number(a?.[2])||0,d=dt(n),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=4096/Math.max(4096,o);if(t===`binary`){let e=o>>1;for(let t=0;t<2;t+=1){let n=t===0?-1:1,a=n*6.5,m=n*1.4,h=n*-1.8,g=-n*1.15,_=n*.35,v=n*.95,y=t*e,b=t===0?e:o;s.set([a+c,m+l,h+u,180,g,_,v,.45],y*8);for(let e=y+1;e<b;e+=1){let n=e&1,o=.6+d()**1.45*5.2,x=n*Math.PI+o*.72+f()*.28,S=f()*(.18+.04*o),C=t===0?.32:-.45,w=o*Math.cos(x),T=o*Math.sin(x),E=S,D=Math.cos(C),O=Math.sin(C),k=w,A=E*D-T*O,j=E*O+T*D,ee=180+(b-y)*.08*p*(1-Math.exp(-o/2.2)),M=Math.sqrt(r*ee/Math.hypot(o,i)),N=-Math.sin(x)*M,P=Math.cos(x)*M,F=N,I=-P*O,L=P*D,R=(.05+d()*.14)*p,z=.03+.04*Math.cbrt(R);s.set([a+k+c,m+A+l,h+j+u,R,g+F,_+I,v+L,z],e*8)}}return s}if(t===`sphere`){s.set([c,l,u,120,0,0,0,.4],0);for(let e=1;e<o;e+=1){let t=Math.max(1e-4,Math.min(.995,d())),n=2.6/Math.sqrt(t**(-2/3)-1),i=Math.min(12,n),a=2*d()-1,m=Math.sqrt(Math.max(0,1-a*a)),h=2*Math.PI*d(),g=i*m*Math.cos(h),_=i*a,v=i*m*Math.sin(h),y=Math.sqrt(r*(120+o*.04*p)/Math.hypot(i,1.8))*.45,b=(.04+d()*.12)*p;s.set([g+c,_+l,v+u,b,f()*y,f()*y,f()*y,.03+.03*Math.cbrt(b)],e*8)}return s}s.set([c,l,u,260,0,0,0,.55],0);let m=o*.09*p;for(let e=1;e<o;e+=1)if(e<o*.16){let t=Math.abs(f())*1.1+.12,n=2*Math.PI*d(),a=f()*.42,o=t*Math.cos(n),h=t*Math.sin(n),g=Math.sqrt(r*(260+m*.12)/Math.hypot(t,i)),_=(.08+d()*.25)*p;s.set([o+c,a+l,h+u,_,-Math.sin(n)*g*.92+f()*.35,f()*.25,Math.cos(n)*g*.92+f()*.35,.04+.04*Math.cbrt(_)],e*8)}else{let t=e&1,n=.8+d()**1.35*9.8,a=.62*Math.log(1+n*1.45)*3.1,o=(.14+.042*n)*f(),h=t*Math.PI+a+o,g=f()*(.14+.025*n),_=n*Math.cos(h),v=n*Math.sin(h),y=260+m*(1-Math.exp(-n/3.4)),b=Math.sqrt(r*y/Math.hypot(n,i)),x=(.04+d()**2.2*.22)*p;s.set([_+c,g+l,v+u,x,-Math.sin(h)*b+f()*.16,f()*.06,Math.cos(h)*b+f()*.16,.025+.04*Math.cbrt(x)],e*8)}return s}var pt=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`,mt=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct AtlasIntegrateParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<storage, read> ss_acc_phi: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: AtlasIntegrateParams;

@compute @workgroup_size(64)
fn ss_atlas_nbody_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_bodies[idx].pos_mass;
  let self_vr = src_bodies[idx].vel_radius;
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }
  let acc = ss_acc_phi[idx].xyz;
  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * params.dt;
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;function ht({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){ut(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=T(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:pt,entryPoint:`step_nbody`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`uniform`)]}),m=[w(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),w(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function gt({device:e=null,initialBodies:t,mode:n=0,boxHalf:r=16,theta:i=.65,label:a=`ulg-cosmic-ss-atlas`}){ut(e,`createResidentScaleAtlasMultipoleNBodyEngine`);let o=Float32Array.from(t),s=o.length/8,c=0,l=n===1?.25:1,u=!1,d=Math.max(32,o.byteLength),f=[e.createBuffer({label:`${a}-buf-0`,size:d,usage:172}),e.createBuffer({label:`${a}-buf-1`,size:d,usage:172})],p=M(e,{maxCount:s,strideFloats:8,chartLevel:70,useAdjSoftening:!1,qMass:8192,qMom:512,rCellFactor:.05,label:`${a}-gravity`}),m=e.createBuffer({label:`${a}-params`,size:32,usage:72}),h=e.createBuffer({label:`${a}-staging`,size:d,usage:9});e.queue.writeBuffer(f[0],0,o),e.queue.writeBuffer(f[1],0,o);let g=T(e,{cacheKey:`ulg-cosmic-ss-atlas-integrate.v1`,label:`ulg-cosmic-ss-atlas-integrate`,code:mt,entryPoint:`ss_atlas_nbody_integrate`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`read-only-storage`),C(3,`uniform`)]}),_=(t,n,r)=>w(e,{layout:g.bindGroupLayout,label:`${a}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:p.accPhiBuffer}},{binding:3,resource:{buffer:m}}]}),v=[_(f[0],f[1],0),_(f[1],f[0],1)],y=0,b=!1;async function x(){if(!f||!h||b||u)return o;b=!0;try{let t=e.createCommandEncoder({label:`${a}-readback`});t.copyBufferToBuffer(f[y],0,h,0,o.byteLength),e.queue.submit([t.finish()]),await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{b=!1}return o}async function S({dt:t=.012,gravity:d=1,softening:_=.24,hubbleRate:x=.12,readback:S=!1}={}){if(u||!f)return o;let C=n===1?1/Math.max(.05,l**3):1;p.writeParams({count:s,gravityG:d,softening2:_*_,boxHalf:r,theta2:i*i});let w=new ArrayBuffer(32),T=new Uint32Array(w),E=new Float32Array(w);T[0]=s,T[1]=n,E[4]=t,E[5]=n===1?2*x:0,E[6]=C,e.queue.writeBuffer(m,0,w);let D=y,O=1-y,k=Math.ceil(s/64),A=e.createCommandEncoder({label:`${a}-step-${c}`}),j=A.beginComputePass({label:`${a}-pass`});p.encodeIntoPass(j,{srcBuffer:f[D],count:s}),j.setPipeline(g.pipeline),j.setBindGroup(0,v[D]),j.dispatchWorkgroups(k),j.end();let ee=S&&!b;if(ee&&A.copyBufferToBuffer(f[O],0,h,0,o.byteLength),e.queue.submit([A.finish()]),y=O,c+=1,n===1&&(l=Math.min(2,l+t*x*l)),ee){b=!0;try{await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{b=!1}}return o}function E(t){o=Float32Array.from(t),c=0,l=n===1?.25:1,y=0,f&&(e.queue.writeBuffer(f[0],0,o),e.queue.writeBuffer(f[1],0,o))}function D(){return f?f[y]:null}function O(){u||(u=!0,f?.[0]?.destroy(),f?.[1]?.destroy(),p.destroy(),m?.destroy(),h?.destroy(),f=null)}return{get count(){return s},get activeCount(){return s},get strideFloats(){return 8},get stepIndex(){return c},get scaleFactorA(){return l},get backend(){return`webgpu`},get gravityMode(){return p.gravityMode},getBodies:()=>o,readbackBodies:x,getResidentBuffer:D,step:S,resetBodies:E,dispose:O}}function _t(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var vt=[`disk`,`binary`,`sphere`],yt=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],bt=Object.freeze([{id:`terrestrial`,label:`Terrestrial Iron-Silicate World`,kind:1,a:2.8,mass:28e-5,radius:.34,color0:[.34,.56,.32],color1:[.1,.34,.72],atm:.55,centralP:36e10,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32% · SiO₂ 48% · H₂O 14% · Cu 6%`},{id:`ocean`,label:`Deep Hydrosphere Ocean World`,kind:1,a:4.3,mass:42e-5,radius:.42,color0:[.22,.62,.54],color1:[.08,.38,.86],atm:.72,centralP:42e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O 34% · SiO₂ 44% · Fe 22%`},{id:`superearth`,label:`High-Z Refractory Super-Earth`,kind:1,a:1.75,mass:18e-5,radius:.28,color0:[.68,.42,.24],color1:[.36,.22,.16],atm:.24,centralP:52e10,coreZ:79,mantleZ:26,surfZ:14,composition:`Fe 46% · SiO₂ 42% · Au/Pt 12%`},{id:`gasgiant`,label:`Ringed Jovian Gas Giant`,kind:2,a:6.4,mass:.0048,radius:.68,color0:[.84,.68,.46],color1:[.58,.4,.26],atm:.48,ringed:!0,centralP:28e10,coreZ:26,mantleZ:6,surfZ:1,composition:`H₂ 75% · He 23% · C/Fe Core 2%`},{id:`iceworld`,label:`Outer Cryogenic Ice Giant`,kind:3,a:8.6,mass:.0014,radius:.46,color0:[.46,.76,.94],color1:[.24,.46,.78],atm:.62,centralP:19e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄ 64% · SiO₂ 26% · Fe 10%`}]),xt=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function St({seed:e=101,starMass:t=12,gravity:n=1,softening:r=.02}={}){let i=_t(e),a=1+bt.length,o=new Float32Array(a*8),s=0,c=0,l=0,u=0,d=0,f=0;for(let e=0;e<bt.length;e+=1){let a=bt[e],p=i()*Math.PI*2,m=(i()-.5)*.14,h=.02+i()*.06,g=a.a*(.94+i()*.12)*(1-h),_=Math.cos(p)*g,v=Math.sin(p)*g*Math.sin(m),y=Math.sin(p)*g*Math.cos(m),b=Math.hypot(g,r),x=Math.sqrt(n*(t+a.mass)*(1+h)/b),S=-Math.sin(p)*x,C=Math.cos(p)*x*Math.sin(m),w=Math.cos(p)*x*Math.cos(m);o.set([_,v,y,a.mass,S,C,w,a.radius],(e+1)*8),s+=a.mass*_,c+=a.mass*v,l+=a.mass*y,u+=a.mass*S,d+=a.mass*C,f+=a.mass*w}return o.set([-s/t,-c/t,-l/t,t,-u/t,-d/t,-f/t,.92],0),o}function Ct(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function wt(e,{seed:t=20261125,qualityId:n=`med`,initialElementZ:r=26}={}){let i=t>>>0,a=F[n]||F.med,o=new v({artifactCache:new b}),s=new Map,c=new Map,u=null,d=null,f=null,p=[],_=null,S=`disk`,C=1,w=null,T=[],E=[0,0,0],k=null,A=null,M=[],N=[],I=5778,L=`Sol-ULG G2V`,R=null,z=`solar-nebula`,B=null,V=null,te=null,ne=null,re=2,H=null,ae=bt[0],se=!0,ce=[],U=null,W=null,G=r,K=300,ue=!1,fe=`solid`,pe=[],q=r,he=3,_e=2,ve=0,ye=!0,J=`atom`,be=`H2O`,xe=null,Se=null,Ce=r,we=56,Te=null,De=null,X=null,ke=null,Z={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},Ae=!1,je=!1;async function Me(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(s.has(o))return s.get(o);let c=await O(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return s.set(o,c),c}async function Ne({seedOverride:t=null}={}){u&&=(u.destroy(),null);let n=(t??i)>>>0,r=await ie(e,{gridPerSide:a.cosmoGridPerSide,fftGridN:a.cosmoFftN,boxLengthMpc:200,aInit:.05,amplitude:.42,seed:n});u=oe(e,{gridPerSide:a.cosmoGridPerSide,pmGridN:a.cosmoFftN,boxLengthMpc:200,aInit:.05,da:.014,initialConditions:r}),f=null,d=await u.step({readTelemetry:!0}),d?.powerSpectrumPk?.kBins?.length&&(f={kBins:[...d.powerSpectrumPk.kBins],pkValues:[...d.powerSpectrumPk.pkValues]});let o=_t(n^5370206);p=Array.from({length:5},(e,t)=>{let n=vt[t%vt.length],r=yt[Math.floor(o()*yt.length)],i=1e3+Math.floor(o()*8900),a=7.5,s=(o()-.5)*2*a,c=(o()-.5)*1.4*a,l=(o()-.5)*2*a,u=(.6+o()*3.8).toFixed(2),d=Number((.4+o()*1.4).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${i} Supercluster`,subtitle:`${n===`disk`?`Grand-Design Spiral`:n===`binary`?`Colliding Merger Pair`:`Giant Elliptical`} · Z=${d} Z☉`,pos:[s,c,l],radius:1,morphology:n,metallicity:d,massLabel:`${u}×10¹² M☉`,tempK:6200+Math.round(o()*5e3),composition:`DM 84% · H 12% · He 3.8% · Met ${(.2*d).toFixed(2)}%`,nextLevel:1}})}async function Pe({preset:t=S,metallicity:n=C,seedOverride:r=null}={}){S=vt.includes(t)?t:`disk`,C=Math.max(.1,Math.min(3,Number(n)||1)),_&&=(_.dispose(),null),w||=await le(e);let o=(r??i)+825>>>0,s=ft({count:a.galaxyStars,preset:S,seed:o});E=[s[0],s[1],s[2]],_=gt({device:e,initialBodies:s,mode:0,boxHalf:16,theta:.65,label:`ulg-universes-galaxy-${a.galaxyStars}`}),await _.step({dt:.01,gravity:1,softening:.24,readback:!1});let c=_t(o^141729),l=[{id:`smbh-core`,name:`Sagittarius-ULG* SMBH`,subtitle:`Relativistic Kerr-Schwarzschild Core · Accretion Disk`,pos:[...E],radius:1.2,tempK:28e3,massLabel:`4.3×10⁶ M☉`,isSmbh:!0,starMass:18,composition:`Relativistic Plasma · H⁺/He²⁺ · Fe Kα`,nextLevel:2},{id:`star-g2v`,name:`Helios-ULG (G2V)`,subtitle:`Main-Sequence Yellow Dwarf · 5 Planets`,pos:[4.2,.15,2.4],radius:.75,tempK:5778,massLabel:`1.00 M☉`,starMass:12,composition:`H 73.5% · He 24.8% · Fe/O/C 1.7%`,nextLevel:2},{id:`star-ob`,name:`Rigel-ULG (B8Ia)`,subtitle:`Blue Supergiant · CNO Fusion Dominated`,pos:[-5.1,-.2,3.8],radius:.85,tempK:14500,massLabel:`16.4 M☉`,starMass:22,composition:`H 70% · He 28% · CNO 2.0%`,nextLevel:2},{id:`star-k2`,name:`Kepler-ULG (K2V)`,subtitle:`Orange Dwarf · Long-Lived Habitable Zone`,pos:[2.6,.25,-5.4],radius:.7,tempK:4850,massLabel:`0.78 M☉`,starMass:10.5,composition:`H 74% · He 24.6% · Met 1.4%`,nextLevel:2},{id:`star-red`,name:`Antares-ULG (M1I)`,subtitle:`Red Supergiant · Triple-Alpha Helium Core`,pos:[-3.4,.35,-4.2],radius:.85,tempK:3650,massLabel:`11.2 M☉`,starMass:16,composition:`H 62% · He 34% · C/O/Fe 4.0%`,nextLevel:2}];for(let e=1;e<l.length;e+=1){let t=e/(l.length-1)*Math.PI*2+c()*.9,n=3.2+c()*4.8;l[e].pos=[Math.cos(t)*n,(c()-.5)*.7,Math.sin(t)*n]}T=l.map(e=>({...e,level:1}))}async function Fe({starTarget:t=null,seedOverride:n=null}={}){k&&=(k.dispose(),null);let r=(n??i)+409>>>0,a=Number(t?.starMass||12);I=Number(t?.tempK||5778),L=t?.name||`Helios-ULG (G2V)`;let o=St({seed:r,starMass:a,gravity:1,softening:.02});k=ht({device:e,initialBodies:o,mode:0,label:`ulg-universes-star-system`}),A=Float32Array.from(o),N=Array.from({length:1+bt.length},()=>[]);let s=I>1e4?[.68,.86,1]:I<4200?[1,.52,.24]:[1,.92,.68],c=I>1e4?[.35,.62,1]:[1,.45,.14];M=[{id:`host-star`,level:2,bodyIndex:0,name:L,subtitle:`Host Star · T_eff = ${I.toLocaleString()} K · Click to Dive to Core`,pos:[A[0],A[1],A[2]],radius:.92,kind:0,color0:s,color1:c,tempK:I,massLabel:`${(a/12).toFixed(2)} M☉`,composition:t?.composition||`H 73.5% · He 24.8% · Metals 1.7%`,nextLevel:3},...bt.map((e,t)=>{let n=t+1,r=n*8,i=Math.hypot(A[r],A[r+1],A[r+2])/2.8,a=Math.round(288*Math.max(.25,I/5778)**1/Math.sqrt(Math.max(.2,i)));return{id:`planet-${e.id}`,level:2,bodyIndex:n,template:e,name:`${L.split(` `)[0]} ${[`b`,`c`,`d`,`e`,`f`][t]}`,subtitle:`${e.label} · ${i.toFixed(2)} AU`,pos:[A[r],A[r+1],A[r+2]],radius:e.radius,kind:e.kind,color0:e.color0,color1:e.color1,atm:e.atm,ringed:!!e.ringed,tempK:a,massLabel:e.id===`gasgiant`?`318 M⊕`:e.id===`iceworld`?`16 M⊕`:`${(e.mass/28e-5).toFixed(2)} M⊕`,composition:e.composition,nextLevel:4}})],await He(1)}async function Ie({preset:t=z,seedOverride:n=null}={}){z=[`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`solar-nebula`,R&&=(R.dispose(),null),ne||=(await Qe({closureRegistry:o,device:e})).ref;let r=(n??i)+1939>>>0;R=ot({device:e,initialBodies:lt({count:a.stellarParticles,preset:z,seed:r}),closureRegistry:o,closureRef:ne,boxHalf:14,label:`ulg-universes-stellar-${z}`}),B=await R.step({dt:.015,timeAccel:re,readTelemetry:!0});let[s,c]=await Promise.all([Y(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),Oe(e,[1.5,3],{dXi:.01,maxXi:12})]);V=s,te=c}async function Le({template:t=ae}={}){ae=t||bt[0];let n=ae.coreZ||26,r=ae.mantleZ||14,i=ae.surfZ||29,[a,o,s]=await Promise.all([Me(n,{relativistic:!0,returnOrbitalWavefunctions:!1}),Me(r,{relativistic:!0,returnOrbitalWavefunctions:!1}),Me(i,{relativistic:!0,returnOrbitalWavefunctions:!1})]),l=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(c.has(n))return c.get(n);let r=await me(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return c.set(n,r),r},[u,d]=await Promise.all([l(a),l(o)]);H=await ge(e,{centralPressurePa:ae.centralP||36e10,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${a.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:u},{name:`${o.bundle.symbol} Silicate Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:d}]});let f=.52,p=H?.profile||[],m=Math.max(1,H?.radiusM||637e4);for(let e=0;e<p.length;e+=1)if((p[e].layerIndex??0)>=1){f=Math.max(.22,Math.min(.78,p[e].radiusM/m));break}ce=[{id:`layer-core`,level:4,name:`${a.bundle.symbol} Metallic Core`,subtitle:`High-P Gate 2 Polytope · P_c = ${((ae.centralP||36e10)/1e9).toFixed(0)} GPa`,pos:[.45,.35,.45],radius:.7,sampleZ:n,rCoreNorm:f,rMantleNorm:.94,tempK:5200,massLabel:`${((H?.massKg||597e22)/59722e20).toFixed(2)} M⊕`,composition:`${a.bundle.symbol} Core (r/R = ${f.toFixed(2)}) · MoI = ${(H?.moiFactor||.33).toFixed(3)}`,nextLevel:5},{id:`layer-mantle`,level:4,name:`${o.bundle.symbol} Silicate Mantle`,subtitle:`Compressed Gate 2 Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:r,rCoreNorm:f,rMantleNorm:.94,tempK:2200,massLabel:`R = ${(m/1e3).toFixed(0)} km`,composition:`${o.bundle.symbol}/O Mantle · g_surf = ${(H?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,nextLevel:5},{id:`layer-surface`,level:4,name:`${s.bundle.symbol} Surface Crust Specimen`,subtitle:`Gate 1 Optical Reflectance · Ready to Sample in MD`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:i,rCoreNorm:f,rMantleNorm:.94,tempK:300,massLabel:`v_esc = ${((H?.escapeVelocityMPerS||11186)/1e3).toFixed(2)} km/s`,composition:`${s.bundle.symbol} (${s.bundle.mechanical.crystalStructure}) · T_m = ${Math.round(s.bundle.thermodynamic.meltingPointK)} K`,nextLevel:5}]}async function Re({Z:t=G,tempK:n=null,phasePreset:r=null,gravity:i=ue}={}){G=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),ue=!!i,U&&=(U.destroy(),null);let o=await Me(G,{relativistic:!0,returnOrbitalWavefunctions:!1}),s=o.visualData.bulk,c=o.visualData.thermo.potential,u=o.bundle,d=Math.max(20,Number(u.thermodynamic.meltingPointK||600)),f=Math.max(d*1.4+20,Number(u.thermodynamic.boilingPointK||d*2.4));r===`melt`?(fe=`melt`,K=Math.round(d*1.38)):r===`vapor`?(fe=`vapor`,K=Math.round(f*1.35)):r===`solid`?(fe=`solid`,K=Math.max(20,Math.round(d*.28))):n!=null&&Number.isFinite(Number(n))?K=Math.max(15,Math.round(Number(n))):(fe=`solid`,K=Math.max(20,Math.round(d*.28)));let p=Math.max(1,Number(u.nuclear.atomicMassU||28)),h=Math.min(2,Math.max(.45,.09*Math.sqrt(p))),g=a.mdCells;U=l(e,{...m({crystalStructure:s.crystalStructure,cellsVec:[g,g,g],latticeConstantA:Math.max(2.4,Number(s.latticeConstantA||3.6)),massU:p,temperatureK:K}),potentialModel:c.potentialModel,epsilonEv:c.epsilonEv,sigmaOrR0A:c.sigmaOrR0A,alphaOrLambda:c.alphaOrLambda,rcutA:c.rcutA,eamAEv:c.eamAEv,eamBeta:c.eamBeta,swGamma:c.swGamma,dtFs:h,targetTemperatureK:K,thermostatCouplingFs:20,meltingPointK:d,bulkModulusGPa:Math.max(1,Number(s.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(s.cohesiveEnergyEv||2)),crystalStructure:s.crystalStructure,gravityEnabled:ue}),W=await U.stepBatch(4,{readTelemetry:!0,targetTemperatureK:K}),pe=W?.rdf?Array.from(W.rdf):[]}async function ze({Z:t=q,n=null,l:r=null,m:o=null,relativistic:s=ye,mode:c=J,moleculeKey:l=be}={}){q=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),ye=!!s,J=c===`molecule`?`molecule`:`atom`,be=xt[l]?l:`H2O`;let u=P.find(e=>e.Z===q);n==null?u&&(he=u.defaultN):he=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?u&&(_e=Math.min(he-1,u.defaultL)):_e=Math.max(0,Math.min(he-1,Math.trunc(Number(r)))),ve=o==null?0:Math.max(-_e,Math.min(_e,Math.trunc(Number(o))));let d=await Me(q,{relativistic:ye,returnOrbitalWavefunctions:!0});if(J===`molecule`){let t=xt[be];Se=await h(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}xe=ee(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,a.orbitalPoints),seed:(i^1779033703)>>>0,reuseBuffer:xe?.pointsBuffer||null})}else{let t=d.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===he&&e.l===_e&&e.u?.length);xe=D(e,{Z:q,n:he,l:_e,m:ve,pointCount:a.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:ye,colorMode:1,seed:(i^q*2654435761)>>>0,reuseBuffer:xe?.pointsBuffer||null})}}async function Be({Z:t=Ce,A:n=null}={}){Ce=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let r=P.find(e=>e.Z===Ce);we=n==null?r?.A||Math.round(Ce*2.15):Math.max(Ce,Math.trunc(Number(n))),De&&=(De.destroy(),null),Te=await g(e,Ce,we,{volDim:a.nuclearVolDim}),De=j(e,Te),X=De?await De.stepBatch(8):null}async function Ve(e,t=1){if(!(Ae||je)){Ae=!0;try{if(e===0&&u)d=await u.step({readTelemetry:!0});else if(e===1&&_){let e=.012*Math.max(.1,Math.min(3,t));await _.step({dt:e,gravity:1,softening:.24,readback:!1})}else if(e===2&&k)await He(t);else if(e===3&&R)B=await R.step({dt:.015*Math.max(.2,Math.min(2.5,t)),timeAccel:re,readTelemetry:!0});else if(e===5&&U){let e=Math.max(1,Math.min(8,Math.round(3*t)));W=await U.stepBatch(e,{readTelemetry:!0,targetTemperatureK:K,nonBlocking:!0}),W?.rdf&&(pe=Array.from(W.rdf))}else if(e===7&&De){let e=Math.max(2,Math.min(24,Math.round(10*t))),n=await De.stepBatch(e,{nonBlocking:!0});n&&(X=n)}}finally{Ae=!1}}}async function He(e=1){if(!k)return;let t=.014*Math.max(.1,Math.min(3,e));A=await k.step({dt:t,gravity:1,softening:.02,readback:!0});for(let e=0;e<M.length;e+=1){let t=e*8,n=[A[t],A[t+1],A[t+2]];M[e].pos=n;let r=N[e];if(r){let e=r[r.length-1];(!e||Math.hypot(n[0]-e[0],n[1]-e[1],n[2]-e[2])>.14)&&(r.push(n),r.length>140&&r.shift())}}}async function Ue(){if(!ke)return;let e=ke;ke=null;try{await e.stop()}catch{}Z={...Z,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Q({relayUrl:e=Z.relayUrl,roomId:t=Z.roomId,role:n=Z.role}={}){await Ue();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return Z={...Z,connected:!1,relayUrl:``,roomId:i,role:a,error:null},Z;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),Z.remotePeers=t.size,Z.witnessedMessages=a,Z.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}ke={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};Z={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){Z={...Z,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return We()}function We(){let e=ke?.handle?.getStatus?.();return{...Z,connected:e?!!e.connected:Z.connected,remotePeers:e?e.remotePeerCount:Z.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:Z.remotePeerIds||[],quorumReady:e?!!e.quorumReady:Z.quorumReady,witnessedMessages:e?.witnessedMessages??Z.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??Z.lastWitnessedType??null}}async function Ge(e=q){let t=ke?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${Z.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return Z.dispatches+=1,Z.lastResult=r,r}async function Ke(e,t={}){e===0&&!u&&await Ne(t),e===1&&!_&&await Pe(t),e===2&&!k&&await Fe(t),e===3&&!R&&await Ie(t),e===4&&!H&&await Le(t),e===5&&!U&&await Re(t),e===6&&!xe&&await ze(t),e===7&&!Te&&await Be(t)}function $(e){return F[e]?(a=F[e],!0):!1}function qe(e){i=Number(e)>>>0||1}function Je(e){ue=!!e,U&&typeof U.setGravity==`function`&&U.setGravity(ue)}function Ye(e){K=Math.max(15,Math.round(Number(e)||300))}function Xe(e){se=!!e}function Ze(e){re=Math.max(.4,Math.min(8,Number(e)||2))}function $e(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return s.get(`${n}:std:${+!!t}:1`)||s.get(`${n}:std:${+!!t}:0`)||s.get(`${n}:std:1:1`)||s.get(`${n}:std:1:0`)||null}function et(e){if(e===0)return p;if(e===1)return T;if(e===2)return M;if(e===3)return[{id:`stellar-fusion-core`,level:3,name:`Thermonuclear Fusion Core`,subtitle:`Gate 1 pp/CNO/3α Burn · Q_pp = ${Ee().ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:B?.coreTempK||15e6,massLabel:`${(R?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((B?.meanXH??.72)*100).toFixed(1)}% · He ${((B?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((B?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4},{id:`stellar-he-shell`,level:3,name:`Synthesized ⁵⁶Fe / ¹²C Ash Parcel`,subtitle:`Dive straight to Planetary / Crystal Matter`,pos:[3.2,.8,1.4],radius:1.2,tempK:Math.max(5e3,(B?.coreTempK||1e7)*.08),massLabel:`ρ_core = ${(B?.coreRhoKgM3||1e5).toExponential(1)} kg/m³`,composition:`Fe-56 · C-12 · O-16 · Si-28 Nucleosynthesis Yield`,nextLevel:4}];if(e===4)return ce;if(e===5){let e=$e(G,!0)?.bundle;return[{id:`md-lattice-atom`,level:5,name:`${e?.symbol||`Fe`} Representative Lattice Atom`,subtitle:`${e?.mechanical?.crystalStructure||`crystal`} · ${U?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:G,tempK:W?.temperatureK||K,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:`Phase: ${W?.emergentPhase||fe} · ⟨Z⟩ = ${(W?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=$e(q,ye)?.bundle,t=e?.symbol||`Fe`,n=`${he}${[`s`,`p`,`d`,`f`,`g`][_e]||`d`} (m=${ve})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:J===`molecule`?`${xt[be].formula} Molecule (RHF)`:`${t} (Z=${q}) · ${n}`,subtitle:J===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(Se?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${ye?`Relativistic ON`:`Non-Rel`}) · ${xe?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:q,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${q} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=Te?.isotope?.split(`-`)[0]||`Z=${Ce}`,t=Number(Te?.bindingPerNucleonMeV??8.79),n=Number(Te?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${we}${e} Atomic Nucleus`,subtitle:`Z=${Ce}, N=${Math.max(0,we-Ce)} · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${Ce} · Neutrons ${Math.max(0,we-Ce)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function tt(){je=!0,Ue();try{u?.destroy()}catch{}try{_?.dispose()}catch{}try{k?.dispose()}catch{}try{R?.dispose()}catch{}try{U?.destroy()}catch{}try{xe?.pointsBuffer?.destroy()}catch{}try{De?.destroy()}catch{}}return Object.freeze({get seed(){return i},get quality(){return a},get cosmoSession(){return u},get cosmoTelemetry(){return d},get cosmoFirstPk(){return f},get galaxyEngine(){return _},get galaxyPreset(){return S},get galaxyMetallicity(){return C},get galaxySmbhPos(){return E},get ismCoolingAnchors(){return w},get systemEngine(){return k},get systemBodies(){return A},get systemOrbitHistory(){return N},get systemStarTempK(){return I},get stellarEngine(){return R},get stellarPreset(){return z},get stellarTelemetry(){return B},get stellarNuclearNetwork(){return V},get stellarLaneEmden(){return te},get stellarTimeAccel(){return re},get planetaryResult(){return H},get planetaryTemplate(){return ae},get planetaryCutaway(){return se},get mdSession(){return U},get mdTelemetry(){return W},get mdElementZ(){return G},get mdTempK(){return K},get mdGravity(){return ue},get mdPhasePreset(){return fe},get mdRdfHistory(){return pe},get quantumZ(){return q},get quantumN(){return he},get quantumL(){return _e},get quantumM(){return ve},get quantumRelativistic(){return ye},get quantumMode(){return J},get quantumMoleculeKey(){return be},get orbitalCloud(){return xe},get moleculeRhfResult(){return Se},get nuclearZ(){return Ce},get nuclearA(){return we},get nuclearResult(){return Te},get tdseSession(){return De},get tdseTelemetry(){return X},PLANET_TEMPLATES:bt,MOLECULE_SPECS:xt,evaluateIsmRadiativeCoolingErgCm3PerS:de,getElementBundle:Me,getCachedElementBundle:$e,ensureLevelInitialized:Ke,initCosmicWeb:Ne,initGalaxy:Pe,initStarSystem:Fe,initStellarCore:Ie,initPlanetaryInterior:Le,initMolecularDynamics:Re,initQuantumAtom:ze,initAtomicNucleus:Be,stepLevel:Ve,setQuality:$,setSeed:qe,setMdGravity:Je,setMdTemp:Ye,setPlanetaryCutaway:Xe,setStellarTimeAccel:Ze,getTargetsForLevel:et,connectPeerMesh:Q,disconnectPeerMesh:Ue,getPeerMeshState:We,dispatchPeerDerivation:Ge,dispose:tt})}var Tt=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Et=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),Dt=`
struct CameraUniforms {
  view_proj: mat4x4<f32>,
  cam_pos: vec4<f32>,    // xyz = camera world position, w = timeSec
  cam_right: vec4<f32>,  // xyz = right basis, w = aspect
  cam_up: vec4<f32>,     // xyz = up basis, w = fovTanHalf
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = scaleAux
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
};
`,Ot=`
${Dt}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31(cell + 17.1), hash31(cell + 41.7), hash31(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.55);
  let spark = exp(-d * d * 58.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31(cell + 99.9);
  let col = mix(vec3<f32>(0.68, 0.82, 1.0), vec3<f32>(1.0, 0.86, 0.68), temp);
  return col * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let level_f = cam.extra0.x;
  let gal_band = exp(-pow(dir.y * 2.4 + dir.x * 0.65, 2.0) * 3.8);
  let neb1 = 0.5 + 0.5 * sin(dir.x * 4.2 + dir.z * 3.1) * cos(dir.y * 3.7 - dir.x * 2.5);
  let neb2 = 0.5 + 0.5 * cos(dir.z * 5.8 - dir.y * 4.1);

  let deep_col = mix(vec3<f32>(0.008, 0.014, 0.032), vec3<f32>(0.025, 0.042, 0.088), gal_band * neb1);
  let accent_tint = select(
    vec3<f32>(0.06, 0.03, 0.11),
    vec3<f32>(0.015, 0.055, 0.095),
    level_f >= 4.5
  );
  var col = deep_col + accent_tint * gal_band * neb2 * 0.42;

  // Multi-scale crisp world-space background starfield (fades gently at quantum/nuclear scales)
  let star_vis = select(1.0, 0.35, level_f >= 4.5);
  col = col + star_layer(dir, 52.0, 0.968) * 1.15 * star_vis;
  col = col + star_layer(dir, 118.0, 0.976) * 0.72 * star_vis;
  col = col + star_layer(dir, 210.0, 0.985) * 0.35 * star_vis;
  return vec4<f32>(col, 1.0);
}
`,kt=`
${Dt}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
};

fn blackbody_rgb(log10_t: f32) -> vec3<f32> {
  if (log10_t < 2.2) {
    return vec3<f32>(0.55, 0.34, 0.88);
  }
  if (log10_t < 3.45) {
    let f = clamp((log10_t - 2.2) / 1.25, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.30, 0.18), vec3<f32>(1.0, 0.56, 0.22), f);
  }
  if (log10_t < 4.1) {
    let f = clamp((log10_t - 3.45) / 0.65, 0.0, 1.0);
    return mix(vec3<f32>(1.0, 0.62, 0.25), vec3<f32>(1.0, 0.96, 0.82), f);
  }
  let f = clamp((log10_t - 4.1) / 2.2, 0.0, 1.0);
  return mix(vec3<f32>(0.96, 0.98, 1.0), vec3<f32>(0.42, 0.78, 1.0), f);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let mode = u32(round(cam.extra0.x));
  let world_scale = cam.extra0.y;
  let pt_size_base = cam.extra0.z;
  let alpha_gain = cam.extra0.w;

  var p_world = vec3<f32>(0.0);
  var col = vec3<f32>(0.6, 0.85, 1.0);
  var pt_size = pt_size_base;
  var alpha = alpha_gain;

  if (mode == 0u) {
    // L0: Supergalactic TreePM (16 floats/particle)
    let o = iid * 16u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.06, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_dm = mix(vec3<f32>(0.18, 0.34, 0.92), vec3<f32>(0.34, 0.88, 1.0), rho);
    let col_node = mix(col_dm, vec3<f32>(1.0, 0.90, 0.52), smoothstep(0.46, 0.98, rho));
    col = select(col_node, mix(vec3<f32>(0.95, 0.36, 0.24), vec3<f32>(1.0, 0.84, 0.45), rho), is_baryon);
    pt_size = pt_size_base * (0.65 + 1.55 * rho);
    alpha = alpha_gain * (0.28 + 0.72 * rho);
  } else if (mode == 1u) {
    // L1: Galactic Scale-Atlas Multipole (8 floats/star: pos, mass, vel, radius)
    let o = iid * 8u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let m = raw_f32[o + 3u];
    let vel = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let speed = length(vel);
    // Physically classify stellar population from live orbital speed & mass (ZERO origin distance check!)
    let hot = clamp((speed - 3.6) / 6.5, 0.0, 1.0);
    let is_smbh = m > 50.0;
    let blue_arm = vec3<f32>(0.42, 0.78, 1.0);
    let warm_disk = vec3<f32>(1.0, 0.84, 0.58);
    let amber_core = vec3<f32>(1.0, 0.62, 0.30);
    let mass_w = clamp(m * 14.0, 0.0, 1.0);
    col = mix(mix(amber_core, warm_disk, mass_w), blue_arm, hot * 0.85);
    if (is_smbh) {
      col = vec3<f32>(1.0, 0.94, 0.80);
      pt_size = pt_size_base * 0.4;
      alpha = 0.0; // SMBH rendered by relativistic accretion disk + lensing shader
    } else {
      pt_size = pt_size_base * (0.55 + 1.35 * clamp(raw_f32[o + 7u] * 14.0, 0.2, 1.6));
      alpha = alpha_gain * (0.35 + 0.65 * clamp(mass_w + 0.35 * hot, 0.0, 1.0));
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro Plasma (16 floats/parcel)
    let o = iid * 16u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-2.0, 4.0, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    col = mix(blackbody_rgb(log_t), vec3<f32>(0.65, 0.96, 1.0), fusion_glow * 0.55);
    col = col * (0.9 + 0.85 * fusion_glow);
    pt_size = pt_size_base * (0.7 + 1.2 * dens_w);
    alpha = alpha_gain * (0.32 + 0.68 * dens_w);
  } else {
    // L6: Quantum Orbital Point Cloud (4 floats/point: vec4(x, y, z, packed_meta))
    let o = iid * 4u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let packed_meta = raw_f32[o + 3u];
    let mag = clamp(abs(packed_meta), 0.15, 1.0);
    let pos_phase = packed_meta >= 0.0;
    let c_pos = cam.extra1.rgb;
    let c_neg = cam.extra2.rgb;
    col = select(c_neg, c_pos, pos_phase) * (0.65 + 0.85 * mag);
    pt_size = pt_size_base * (0.72 + 0.55 * mag);
    alpha = alpha_gain * (0.30 + 0.70 * mag);
  }

  let world_corner = p_world
    + cam.cam_right.xyz * (uv.x * pt_size)
    + cam.cam_up.xyz * (uv.y * pt_size);
  let clip = cam.view_proj * vec4<f32>(world_corner, 1.0);

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-5.2 * r2);
  let halo = exp(-1.9 * r2) * 0.35;
  let w = core + halo;
  return vec4<f32>(in.color.rgb * w * in.color.a, in.color.a * w);
}
`,At=`
${Dt}

// 4 vec4s (64 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=rocky/ocean, 2=gas-giant, 3=ice/moon, 4=cutaway-planet, 5=atom
//   color1: vec4(r2, g2, b2, spec/atm)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) color0: vec4<f32>,
  @location(4) color1: vec4<f32>,
  @location(5) params: vec4<f32>,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let sp = spheres[iid];
  let center = sp.pos_r.xyz;
  let radius = sp.pos_r.w;

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let dist = length(cam.cam_pos.xyz - center);
  let inflate = radius * select(1.42, 1.18, dist > radius * 2.5);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  return out;
}

fn fbm3(p: vec3<f32>) -> f32 {
  let a = sin(p.x * 2.7 + p.y * 1.9) * cos(p.z * 2.3 - p.x * 1.4);
  let b = sin(p.y * 5.3 - p.z * 4.7) * cos(p.x * 4.9 + p.y * 3.1) * 0.5;
  let c = sin(p.z * 11.1 + p.x * 9.7) * 0.25;
  return 0.5 + 0.35 * (a + b + c);
}

fn is_cutaway_octant(p_loc: vec3<f32>, cut_active: f32) -> bool {
  return cut_active > 0.5 && p_loc.x > 0.0 && p_loc.y > 0.0 && p_loc.z > 0.0;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let disc = b * b - c;

  let kind = u32(round(in.color0.w));
  let light_dir = normalize(cam.extra1.xyz);
  let cut_active = in.params.z;

  if (disc < 0.0) {
    // Soft corona glow ONLY for stars (kind 0)
    if (kind == 0u) {
      let closest = max(0.0, -b);
      let d_min = length(ro + rd * closest) / max(1e-4, r);
      if (d_min < 1.38) {
        let corona = exp(-(d_min - 1.0) * 6.5) * 0.72;
        var out_c: FsOut;
        out_c.color = vec4<f32>(in.color0.rgb * corona * 1.4, corona);
        let clip_c = cam.view_proj * vec4<f32>(in.center + ro + rd * closest, 1.0);
        out_c.depth = clamp(clip_c.z / max(1e-5, clip_c.w), 0.0, 0.9999);
        return out_c;
      }
    }
    discard;
  }

  let sqrt_d = sqrt(disc);
  var t_hit = -b - sqrt_d;
  if (t_hit < 0.001) { t_hit = -b + sqrt_d; }
  if (t_hit < 0.001) { discard; }

  var p_hit = ro + rd * t_hit;
  var n_hit = normalize(p_hit);
  var is_interior = false;

  // True 3D Cutaway Plane intersection for L4 Planetary Interior Globe
  if (kind == 4u && is_cutaway_octant(p_hit, cut_active)) {
    var best_t = 1e20;
    var best_n = vec3<f32>(0.0, 1.0, 0.0);
    // Test 3 coordinate planes x=0, y=0, z=0 inside sphere radius
    if (abs(rd.x) > 1e-5) {
      let tx = -ro.x / rd.x;
      if (tx > 0.001 && tx < best_t) {
        let q = ro + rd * tx;
        if (dot(q, q) <= r * r && q.y >= 0.0 && q.z >= 0.0) {
          best_t = tx;
          best_n = vec3<f32>(select(1.0, -1.0, rd.x > 0.0), 0.0, 0.0);
        }
      }
    }
    if (abs(rd.y) > 1e-5) {
      let ty = -ro.y / rd.y;
      if (ty > 0.001 && ty < best_t) {
        let q = ro + rd * ty;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.z >= 0.0) {
          best_t = ty;
          best_n = vec3<f32>(0.0, select(1.0, -1.0, rd.y > 0.0), 0.0);
        }
      }
    }
    if (abs(rd.z) > 1e-5) {
      let tz = -ro.z / rd.z;
      if (tz > 0.001 && tz < best_t) {
        let q = ro + rd * tz;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.y >= 0.0) {
          best_t = tz;
          best_n = vec3<f32>(0.0, 0.0, select(1.0, -1.0, rd.z > 0.0));
        }
      }
    }
    if (best_t < 1e19) {
      t_hit = best_t;
      p_hit = ro + rd * t_hit;
      n_hit = best_n;
      is_interior = true;
    } else {
      discard;
    }
  }

  let view_dir = -rd;
  let ndv = max(0.0, dot(n_hit, view_dir));
  let ndl = max(0.0, dot(n_hit, light_dir));
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 36.0);
  let fresnel = pow(1.0 - ndv, 3.2);

  var col = vec3<f32>(0.8);

  if (kind == 0u) {
    // Convective stellar photosphere with limb darkening
    let gran = fbm3(n_hit * 4.5 + vec3<f32>(in.params.w * 2.1, cam.cam_pos.w * 0.08, 0.0));
    let limb = pow(ndv, 0.45);
    col = mix(in.color1.rgb, in.color0.rgb, 0.45 + 0.55 * gran) * (0.72 + 0.65 * limb);
  } else if (is_interior) {
    // Exact GPU-solved planetary cutaway shells!
    let r_norm = length(p_hit) / max(1e-4, r);
    let r_core = clamp(in.params.x, 0.12, 0.85);
    let r_mantle = clamp(in.params.y, r_core + 0.04, 0.99);
    let r_inner = r_core * 0.48;
    var shell_col = in.color0.rgb;
    if (r_norm < r_inner) {
      // Solid crystalline Fe inner core (hot white-gold)
      shell_col = vec3<f32>(1.0, 0.92, 0.64);
    } else if (r_norm < r_core) {
      // Molten metallic Fe outer core (incandescent amber-orange)
      let f = (r_norm - r_inner) / max(0.02, r_core - r_inner);
      shell_col = mix(vec3<f32>(1.0, 0.68, 0.22), vec3<f32>(0.94, 0.36, 0.12), f);
    } else if (r_norm < r_mantle) {
      // High-pressure silicate mantle (deep crimson-ochre to olivine)
      let f = (r_norm - r_core) / max(0.02, r_mantle - r_core);
      shell_col = mix(vec3<f32>(0.76, 0.24, 0.14), vec3<f32>(0.42, 0.32, 0.24), f);
    } else {
      // Crust / Hydrosphere shell
      shell_col = in.color1.rgb;
    }
    // Crisp dark contour lines at exact GPU-solved layer transitions
    let edge_core = smoothstep(0.008, 0.018, abs(r_norm - r_core));
    let edge_mantle = smoothstep(0.008, 0.018, abs(r_norm - r_mantle));
    shell_col = shell_col * (0.55 + 0.45 * edge_core * edge_mantle);
    let shade = 0.48 + 0.52 * max(0.25, dot(n_hit, normalize(vec3<f32>(0.55, 0.7, 0.45))));
    col = shell_col * shade;
  } else if (kind == 2u) {
    // Banded Gas Giant with zonal jets
    let band = 0.5 + 0.5 * sin(n_hit.y * 19.0 + fbm3(n_hit * 5.0 + in.params.w) * 2.2);
    let base = mix(in.color0.rgb, in.color1.rgb, band);
    let atm = vec3<f32>(0.52, 0.72, 1.0) * fresnel * in.color1.w;
    col = base * (0.12 + 0.92 * ndl) + atm * (0.2 + 0.8 * ndl);
  } else if (kind == 1u || kind == 4u) {
    // Terrestrial / Ocean world with continents, water specular, & Rayleigh limb
    let cont = fbm3(n_hit * 3.4 + vec3<f32>(in.params.w * 3.7));
    let is_land = cont > 0.50;
    let base = select(in.color1.rgb, in.color0.rgb, is_land);
    let water_spec = select(spec * 0.55, spec * 0.08, is_land);
    let atm = vec3<f32>(0.36, 0.72, 1.0) * fresnel * in.color1.w;
    col = base * (0.12 + 0.92 * ndl) + vec3<f32>(1.0, 0.96, 0.9) * water_spec * ndl + atm * (0.25 + 0.75 * ndl);
  } else {
    // Ice / Metallic Atom / Molecule Nucleus / Pitch-Black Event Horizon Shadow
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(1.0 - ndv, 4.5);
      col = vec3<f32>(1.0, 0.88, 0.62) * photon_rim * 1.45;
    } else {
      let base = mix(in.color0.rgb, in.color1.rgb, 0.25 + 0.5 * fresnel);
      col = base * (0.22 + 0.78 * ndl) + vec3<f32>(1.0, 0.98, 0.95) * spec * 0.62 + base * fresnel * 0.28;
    }
  }

  let world_hit = in.center + p_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,jt=`
${Dt}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> md_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> md_vel: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) tint: vec3<f32>,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let p_raw = md_pos[iid];
  let v_raw = md_vel[iid];
  let half_box = cam.extra0.xyz;
  let world_scale = cam.extra0.w;
  let radius = cam.extra1.w;
  let ideal_coord = max(4.0, cam.extra2.w);

  let center = (p_raw.xyz - half_box) * world_scale;
  let coord_frac = clamp(p_raw.w / ideal_coord, 0.0, 1.2);
  let speed = length(v_raw.xyz);
  let heat = clamp(speed * 2.2, 0.0, 1.0);

  // Blend Gate 1 optical reflectance (solid crystal) -> warm amber (liquid) -> electric cyan (vapor)
  let base_rgb = cam.extra1.rgb;
  let liq_rgb = mix(base_rgb, vec3<f32>(1.0, 0.52, 0.18), 0.55);
  let vap_rgb = vec3<f32>(0.38, 0.86, 1.0);
  var tint = mix(vap_rgb, liq_rgb, smoothstep(0.15, 0.55, coord_frac));
  tint = mix(tint, base_rgb, smoothstep(0.55, 0.92, coord_frac));
  tint = mix(tint, vec3<f32>(1.0, 0.85, 0.55), heat * 0.25);

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * radius * 1.24) + up * (uv.y * radius * 1.24);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.tint = tint;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - in.radius * in.radius;
  let disc = b * b - c;
  if (disc < 0.0) { discard; }
  let t_hit = -b - sqrt(disc);
  if (t_hit < 0.001) { discard; }
  let p_hit = ro + rd * t_hit;
  let n = normalize(p_hit);
  let light = normalize(vec3<f32>(0.6, 0.8, 0.5));
  let view = -rd;
  let ndl = max(0.0, dot(n, light));
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 42.0);
  let rim = pow(1.0 - max(0.0, dot(n, view)), 2.8);
  let col = in.tint * (0.24 + 0.80 * ndl) + vec3<f32>(1.0, 0.98, 0.95) * spec * 0.58 + in.tint * rim * 0.25;
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,Mt=`
${Dt}

// 3 vec4s (48 bytes) per disk:
//   center_r_in: vec4(x, y, z, r_inner)
//   normal_r_out: vec4(nx, ny, nz, r_outer)
//   color_kind: vec4(r, g, b, kind)   kind: 0=relativistic-accretion-disk, 1=planetary-ring
struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> disks: array<DiskInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_xy: vec2<f32>,
  @location(1) r_in: f32,
  @location(2) r_out: f32,
  @location(3) color_kind: vec4<f32>,
  @location(4) world_pos: vec3<f32>,
  @location(5) center: vec3<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let d = disks[iid];
  let n = normalize(d.normal_r_out.xyz);
  let ref_v = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n.y) > 0.9);
  let t1 = normalize(cross(ref_v, n));
  let t2 = cross(n, t1);
  let r_out = d.normal_r_out.w;
  let world_pos = d.center_r_in.xyz + (t1 * uv.x + t2 * uv.y) * r_out;

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_pos, 1.0);
  out.local_xy = uv * r_out;
  out.r_in = d.center_r_in.w;
  out.r_out = r_out;
  out.color_kind = d.color_kind;
  out.world_pos = world_pos;
  out.center = d.center_r_in.xyz;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r = length(in.local_xy);
  if (r > in.r_out) { discard; }
  let kind = u32(round(in.color_kind.w));

  if (kind == 0u) {
    // Relativistic Doppler-Beamed Accretion Disk outside the pitch-black Event Horizon sphere
    if (r < in.r_in) { discard; }
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let ang = atan2(in.local_xy.y, in.local_xy.x);
    let shear = 0.55 + 0.45 * sin(ang * 3.0 + 14.0 / (u + 0.25) - cam.cam_pos.w * 2.4);
    // Tangent velocity vector in disk plane -> relativistic Doppler beaming
    let rel_p = in.world_pos - in.center;
    let tang = normalize(vec3<f32>(-rel_p.z, 0.0, rel_p.x) + vec3<f32>(1e-5));
    let view_dir = normalize(cam.cam_pos.xyz - in.world_pos);
    let beta = 0.42 / sqrt(max(0.2, u + 0.18));
    let doppler = clamp(1.0 + beta * dot(tang, view_dir), 0.35, 1.85);
    let beam = doppler * doppler;

    let hot_inner = vec3<f32>(0.90, 0.96, 1.0);
    let mid_gold = vec3<f32>(1.0, 0.66, 0.24);
    let cool_red = vec3<f32>(0.76, 0.18, 0.06);
    var col = mix(hot_inner, mid_gold, smoothstep(0.0, 0.35, u));
    col = mix(col, cool_red, smoothstep(0.30, 0.95, u));
    col = mix(col, vec3<f32>(0.75, 0.92, 1.0), clamp((doppler - 1.0) * 0.55, 0.0, 0.5));
    let radial_fade = (1.0 - smoothstep(0.58, 1.0, u)) * smoothstep(0.0, 0.07, u);
    let alpha = clamp(radial_fade * (0.48 + 0.52 * shear) * 0.92, 0.0, 1.0);
    return vec4<f32>(col * beam * (0.62 + 0.52 * shear) * alpha, alpha);
  } else {
    // Planetary ring system with Cassini division & subtle banding
    if (r < in.r_in) { discard; }
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let cassini = 1.0 - 0.85 * exp(-pow((u - 0.58) * 28.0, 2.0));
    let ringlets = 0.72 + 0.28 * sin(u * 68.0) * cos(u * 23.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.88, 1.0, u));
    let alpha = clamp(fade * cassini * ringlets * 0.68, 0.0, 0.85);
    return vec4<f32>(in.color_kind.rgb * (0.85 + 0.25 * ringlets) * alpha, alpha);
  }
}
`,Nt=`
${Dt}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos: vec3<f32>,
  @location(1) color: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(in.pos, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`,Pt=`
${Dt}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn fetch_vox(i: vec3<u32>, dim: u32) -> vec4<f32> {
  return vol_data[(i.z * dim + i.y) * dim + i.x];
}

fn sample_vol(p_unit: vec3<f32>, dim: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = fetch_vox(vec3<u32>(i0.x, i0.y, i0.z), dim);
  let c100 = fetch_vox(vec3<u32>(i1.x, i0.y, i0.z), dim);
  let c010 = fetch_vox(vec3<u32>(i0.x, i1.y, i0.z), dim);
  let c110 = fetch_vox(vec3<u32>(i1.x, i1.y, i0.z), dim);
  let c001 = fetch_vox(vec3<u32>(i0.x, i0.y, i1.z), dim);
  let c101 = fetch_vox(vec3<u32>(i1.x, i0.y, i1.z), dim);
  let c011 = fetch_vox(vec3<u32>(i0.x, i1.y, i1.z), dim);
  let c111 = fetch_vox(vec3<u32>(i1.x, i1.y, i1.z), dim);
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(1.0, cam.extra0.y);
  let tdse_tun = cam.extra0.z;
  let tdse_crest_r = clamp(cam.extra0.w, 0.35, 0.96);

  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = cam.cam_pos.xyz / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  // Ray-box intersection against [-1, 1]^3
  let inv_rd = 1.0 / (rd + select(vec3<f32>(0.0), vec3<f32>(1e-6), abs(rd) < vec3<f32>(1e-6)));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(0.0, max(tmin_v.x, max(tmin_v.y, tmin_v.z)));
  let t_exit = min(tmax_v.x, min(tmax_v.y, tmax_v.z));
  if (t_exit <= t_enter) { discard; }

  let steps = 56u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_vol(p, dim);
    let rho_p = v.x;
    let rho_n = v.y;
    let dens = v.w;
    let rr = length(p);

    // Proton core (rich fiery amber-orange) vs Neutron skin (vivid electric cyan)
    let skin = clamp((rho_n - rho_p) * 5.2 + smoothstep(0.36, 0.64, rr) * 0.65, 0.0, 1.0);
    let nuc_col = mix(vec3<f32>(1.0, 0.40, 0.10), vec3<f32>(0.14, 0.84, 1.0), skin);
    // Live GPU Visscher TDSE tunneling probability wave crest shell!
    let shell_ring = exp(-pow((rr - tdse_crest_r) * 18.0, 2.0)) * (0.28 + 0.72 * clamp(tdse_tun * 5.0, 0.0, 1.0));
    let shell_col = vec3<f32>(0.24, 1.0, 0.72);

    let sigma = (dens * 2.8 + shell_ring * 1.1) * dt;
    let emit = (nuc_col * pow(dens, 1.25) * 1.45 + shell_col * shell_ring * 1.85) * dt;
    accum = accum + trans * emit;
    trans = trans * exp(-sigma);
    if (trans < 0.015) { break; }
  }
  let alpha = clamp(1.0 - trans, 0.0, 1.0);
  if (alpha < 0.004) { discard; }
  return vec4<f32>(accum, alpha);
}
`,Ft=`
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,         // Projected screen UV [0..1] of active SMBH
  bh_strength: f32,         // Einstein radius squared strength (0 = disabled)
  warp_amount: f32,         // Hyperdrive radial streak strength [0..1]
  flash_amount: f32,        // Big Bang primordial flash [0..1]
  crt_enabled: f32,         // 1.0 = Retro CRT scanlines & vignette ON
  pixel_size: f32,          // Pixelation step [1..6] when CRT enabled
  time_sec: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  var uv = in.uv;
  let aspect = u.resolution.x / max(1.0, u.resolution.y);

  // Optional Retro CRT pixelation quantization
  if (u.crt_enabled > 0.5 && u.pixel_size > 1.0) {
    let step_uv = vec2<f32>(u.pixel_size) / max(vec2<f32>(1.0), u.resolution);
    uv = (floor(uv / step_uv) + 0.5) * step_uv;
  }

  // Exact Schwarzschild Einstein-ring deflection around projected active SMBH UV
  var photon_glow = vec3<f32>(0.0);
  if (u.bh_strength > 1e-6) {
    let d_aspect = vec2<f32>((uv.x - u.bh_uv.x) * aspect, uv.y - u.bh_uv.y);
    let r2 = dot(d_aspect, d_aspect);
    let r = sqrt(max(1e-6, r2));
    let rs = sqrt(u.bh_strength) * 0.65;
    let outside_shadow = smoothstep(rs * 0.72, rs * 1.18, r);
    let falloff = exp(-r2 * 24.0) * outside_shadow;
    let deflect = (u.bh_strength / max(r2 + rs * rs * 0.85, 0.0006)) * falloff;
    let dir_uv = vec2<f32>(d_aspect.x / aspect, d_aspect.y) / max(r, 1e-4);
    uv = clamp(uv - dir_uv * min(0.085, deflect * 0.095), vec2<f32>(0.001), vec2<f32>(0.999));
    // Crisp golden-white Einstein photon ring just outside the shadow radius
    let ring = exp(-pow((r - rs * 1.15) / max(0.005, rs * 0.22), 2.0)) * 0.52;
    photon_glow = vec3<f32>(1.0, 0.86, 0.62) * ring;
  }

  var col = textureSample(scene_tex, scene_samp, uv).rgb + photon_glow;

  // Hyperdrive chromatic radial warp streaks (active ONLY during warp transitions)
  if (u.warp_amount > 0.005) {
    let from_c = uv - vec2<f32>(0.5, 0.5);
    var streak = vec3<f32>(0.0);
    for (var s = 1u; s <= 5u; s = s + 1u) {
      let f = f32(s) * 0.018 * u.warp_amount;
      let uv_r = clamp(uv - from_c * (f * 1.15), vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_g = clamp(uv - from_c * f, vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_b = clamp(uv - from_c * (f * 0.85), vec2<f32>(0.001), vec2<f32>(0.999));
      streak.r += textureSample(scene_tex, scene_samp, uv_r).r;
      streak.g += textureSample(scene_tex, scene_samp, uv_g).g;
      streak.b += textureSample(scene_tex, scene_samp, uv_b).b;
    }
    col = mix(col, (col + streak * 0.28) * (1.0 + 0.45 * u.warp_amount), clamp(u.warp_amount, 0.0, 0.85));
  }

  // Big Bang flash decay
  if (u.flash_amount > 0.002) {
    let rad = length((in.uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0));
    let burst = exp(-rad * rad * 1.8) * u.flash_amount;
    col = col + vec3<f32>(1.0, 0.92, 0.78) * burst * 2.2;
  }

  col = aces_tonemap(col * 1.12);

  // Optional Retro CRT scanlines, phosphor tint & subtle vignette
  if (u.crt_enabled > 0.5) {
    let scan = 0.82 + 0.18 * sin(in.uv.y * u.resolution.y * 1.65);
    let vig_d = length((in.uv - vec2<f32>(0.5)) * 1.38);
    let vig = clamp(1.0 - vig_d * vig_d * 0.45, 0.35, 1.0);
    col = col * scan * vig;
    // Gentle cool-phosphor glow tint
    col = mix(col, col * vec3<f32>(0.92, 1.04, 1.02), 0.35);
  }

  return vec4<f32>(col, 1.0);
}
`;function It(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let r=navigator.gpu.getPreferredCanvasFormat();function i(){let t=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],i=null;for(let e of t)try{n.configure(e);return}catch(e){i=e}if(i)throw i}i();let a=`rgba8unorm`,o=`depth24plus`,s=0,c=0,l=null,u=null,d=null,f=null,p=e.createBuffer({label:`uv-cam-uniform`,size:176,usage:Tt.UNIFORM|Tt.COPY_DST}),m=e.createBuffer({label:`uv-stage-cam-uniform`,size:176,usage:Tt.UNIFORM|Tt.COPY_DST}),h=e.createBuffer({label:`uv-post-uniform`,size:48,usage:Tt.UNIFORM|Tt.COPY_DST}),g=e.createSampler({magFilter:`linear`,minFilter:`linear`}),_=e.createBuffer({label:`uv-spheres`,size:8192,usage:Tt.STORAGE|Tt.COPY_DST}),v=e.createBuffer({label:`uv-disks`,size:768,usage:Tt.STORAGE|Tt.COPY_DST}),y=16384,b=e.createBuffer({label:`uv-lines`,size:y*28,usage:Tt.VERTEX|Tt.COPY_DST}),x=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:Tt.STORAGE|Tt.COPY_DST}),S=1024*32*16,C=(t,n)=>e.createShaderModule({label:t,code:n}),w=C(`uv-backdrop`,Ot),T=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:w,entryPoint:`vs_main`},fragment:{module:w,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),E=e.createBindGroup({layout:T.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),D=C(`uv-cloud`,kt),O=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:D,entryPoint:`vs_main`},fragment:{module:D,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),k=C(`uv-lit-sphere`,At),A=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:k,entryPoint:`vs_main`},fragment:{module:k,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),j=e.createBindGroup({layout:A.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:_}}]}),ee=C(`uv-md-sphere`,jt),M=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:ee,entryPoint:`vs_main`},fragment:{module:ee,entryPoint:`fs_main`,targets:[{format:a}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!0,depthCompare:`less-equal`}}),N=C(`uv-disk`,Mt),P=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:N,entryPoint:`vs_main`},fragment:{module:N,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),F=e.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:v}}]}),I=C(`uv-line`,Nt),L=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:I,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`less-equal`}}),R=e.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}}]}),z=C(`uv-nuclear-vol`,Pt),B=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:a,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:o,depthWriteEnabled:!1,depthCompare:`always`}}),V=e.createBindGroup({layout:B.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:x}}]}),te=C(`uv-post`,Ft),ne=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:te,entryPoint:`vs_main`},fragment:{module:te,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),re=null,H=new WeakMap,ie=new WeakMap;function ae(t){let n=H.get(t);return n||(n=e.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:t}}]}),H.set(t,n)),n}function oe(t,n){let r=ie.get(t);return r||(r=e.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),ie.set(t,r)),r}function se(t,n){let r=Math.max(2,Math.floor(t)),p=Math.max(2,Math.floor(n));l&&s===r&&c===p||(s=r,c=p,i(),l?.destroy(),d?.destroy(),l=e.createTexture({label:`uv-scene-color`,size:[s,c],format:a,usage:Et.RENDER_ATTACHMENT|Et.TEXTURE_BINDING}),u=l.createView(),d=e.createTexture({label:`uv-scene-depth`,size:[s,c],format:o,usage:Et.RENDER_ATTACHMENT}),f=d.createView(),re=e.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:u},{binding:2,resource:g}]}))}function ce(t){!t||t.byteLength===0||(t.byteLength>S&&(x.destroy(),S=t.byteLength,x=e.createBuffer({label:`uv-nuclear-vol`,size:S,usage:Tt.STORAGE|Tt.COPY_DST}),V=e.createBindGroup({layout:B.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:x}}]})),e.queue.writeBuffer(x,0,t))}let U=new Float32Array(44),W=new Float32Array(12),G=new Float32Array(2048),K=new Float32Array(192),le=new Float32Array(y*7);function ue(t,n,r,i,a){U.set(n.viewProj,0),U.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),U.set([n.right[0],n.right[1],n.right[2],n.aspect],20),U.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),U.set([n.fwd[0],n.fwd[1],n.fwd[2],n.level||0],28),U.set(r||[0,0,0,0],32),U.set(i||[0,0,0,0],36),U.set(a||[0,0,0,0],40),e.queue.writeBuffer(t,0,U)}function de({camera:r,particleCloud:i=null,spheres:a=null,lightDir:o=[.6,.75,.55],mdCloud:l=null,disks:d=null,lines:g=null,nuclearVol:x=null,post:S={}}){se(t.width,t.height);let C=0;if(Array.isArray(a)&&a.length>0){C=Math.min(128,a.length);for(let e=0;e<C;e+=1){let t=a[e],n=e*16;G[n+0]=t.pos[0],G[n+1]=t.pos[1],G[n+2]=t.pos[2],G[n+3]=t.radius,G[n+4]=t.color0[0],G[n+5]=t.color0[1],G[n+6]=t.color0[2],G[n+7]=t.kind??1,G[n+8]=t.color1?.[0]??t.color0[0],G[n+9]=t.color1?.[1]??t.color0[1],G[n+10]=t.color1?.[2]??t.color0[2],G[n+11]=t.atm??.35,G[n+12]=t.rCore??.52,G[n+13]=t.rMantle??.94,G[n+14]=+!!t.cutaway,G[n+15]=t.seed??(e+1)*1.37}e.queue.writeBuffer(_,0,G.subarray(0,C*16))}let w=0;if(Array.isArray(d)&&d.length>0){w=Math.min(16,d.length);for(let e=0;e<w;e+=1){let t=d[e],n=e*12;K[n+0]=t.center[0],K[n+1]=t.center[1],K[n+2]=t.center[2],K[n+3]=t.rIn,K[n+4]=t.normal[0],K[n+5]=t.normal[1],K[n+6]=t.normal[2],K[n+7]=t.rOut,K[n+8]=t.color?.[0]??.9,K[n+9]=t.color?.[1]??.85,K[n+10]=t.color?.[2]??.72,K[n+11]=t.kind??0}e.queue.writeBuffer(v,0,K.subarray(0,w*12))}let D=0;if(g&&g.length>=14){D=Math.min(y,Math.floor(g.length/7));let t=g.subarray(0,D*7);le.set(t,0),e.queue.writeBuffer(b,0,le.subarray(0,D*7))}ue(p,r,[r.level||0,0,0,0],[o[0],o[1],o[2],0],[0,0,0,0]),i&&i.buffer&&i.count>0?ue(m,r,[i.mode,i.worldScale,i.pointSize,i.alphaGain],[...i.colorPos||[.22,.86,1],0],[...i.colorNeg||[1,.68,.24],0]):l&&l.positionsBuffer&&l.velocitiesBuffer&&l.count>0?ue(m,r,[l.halfBox[0],l.halfBox[1],l.halfBox[2],l.worldScale],[l.baseRgb[0],l.baseRgb[1],l.baseRgb[2],l.radius],[0,0,0,l.idealCoord||12]):x&&x.dim>0&&ue(m,r,[x.dim,x.boxRadius||3.4,x.tdseTunneled||0,x.tdseCrestNorm||.72],[0,0,0,0],[0,0,0,0]),W[0]=s,W[1]=c,W[2]=S.bhUv?.[0]??.5,W[3]=S.bhUv?.[1]??.5,W[4]=S.bhStrength??0,W[5]=S.warpAmount??0,W[6]=S.flashAmount??0,W[7]=+!!S.crtEnabled,W[8]=S.pixelSize??3,W[9]=S.timeSec??0,W[10]=0,W[11]=0,e.queue.writeBuffer(h,0,W);let k=e.createCommandEncoder({label:`uv-frame-fused`});{let e=k.beginRenderPass({colorAttachments:[{view:u,clearValue:{r:.01,g:.015,b:.03,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:f,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});e.setPipeline(T),e.setBindGroup(0,E),e.draw(3,1,0,0),D>0&&(e.setPipeline(L),e.setBindGroup(0,R),e.setVertexBuffer(0,b,0,D*28),e.draw(D,1,0,0)),C>0&&(e.setPipeline(A),e.setBindGroup(0,j),e.draw(6,C,0,0)),w>0&&(e.setPipeline(P),e.setBindGroup(0,F),e.draw(6,w,0,0)),i&&i.buffer&&i.count>0?(e.setPipeline(O),e.setBindGroup(0,ae(i.buffer)),e.draw(6,i.count,0,0)):l&&l.positionsBuffer&&l.velocitiesBuffer&&l.count>0?(e.setPipeline(M),e.setBindGroup(0,oe(l.positionsBuffer,l.velocitiesBuffer)),e.draw(6,l.count,0,0)):x&&x.dim>0&&(e.setPipeline(B),e.setBindGroup(0,V),e.draw(3,1,0,0)),e.end()}{let e=n.getCurrentTexture().createView(),t=k.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(ne),t.setBindGroup(0,re),t.draw(3,1,0,0),t.end()}e.queue.submit([k.finish()])}function fe(){l?.destroy(),d?.destroy();for(let e of[p,m,h,_,v,b,x])try{e.destroy()}catch{}}return Object.freeze({renderFrame:de,uploadNuclearVolume:ce,dispose:fe})}function Lt(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function Rt(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function zt(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Bt(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Vt(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.25,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=n*r*a,o}function Ht(e,t,n){let r=Bt(Lt(t,e)),i=Bt(Rt(r,n)),a=Rt(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-zt(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-zt(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=zt(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function Ut(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function Wt(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.05)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function Gt(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function Kt(e,t=[.28,.72,.96,.38]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function qt(e,t,n=1){if(!e||e.length<16)return[];let r=e[0],i=e[1],a=e[2],o=e[3],s=e[4],c=e[5],l=e[6],u=[];for(let d=1;d<t.length;d+=1){let f=d*8,p=e[f]-r,m=e[f+1]-i,h=e[f+2]-a,g=e[f+4]-s,_=e[f+5]-c,v=e[f+6]-l,y=Math.hypot(p,m,h),b=g*g+_*_+v*v,x=n*(o+e[f+3]);if(!(y>1e-4&&x>1e-4))continue;let S=.5*b-x/y;if(S>=-1e-4)continue;let C=-x/(2*S),w=Rt([p,m,h],[g,_,v]),T=Math.hypot(w[0],w[1],w[2]);if(!(T>1e-4))continue;let E=[w[0]/T,w[1]/T,w[2]/T],D=Rt([g,_,v],w),O=[D[0]/x-p/y,D[1]/x-m/y,D[2]/x-h/y],k=Math.min(.85,Math.hypot(O[0],O[1],O[2])),A=k>1e-4?[O[0]/k,O[1]/k,O[2]/k]:Bt([p,m,h]),j=Rt(E,A),ee=C*Math.sqrt(Math.max(.05,1-k*k)),M=t[d]?.color0||[.38,.72,1],N=null;for(let e=0;e<=64;e+=1){let t=e/64*Math.PI*2,n=C*(Math.cos(t)-k),o=ee*Math.sin(t),s=[r+n*A[0]+o*j[0],i+n*A[1]+o*j[1],a+n*A[2]+o*j[2]];N&&(u.push(...N,M[0],M[1],M[2],.28),u.push(...s,M[0],M[1],M[2],.28)),N=s}}return u}var Jt=Object.freeze([{yaw:.56,pitch:.36,dist:32},{yaw:.38,pitch:.58,dist:23},{yaw:.45,pitch:.52,dist:18},{yaw:.32,pitch:.28,dist:19},{yaw:.72,pitch:.44,dist:8.6},{yaw:.62,pitch:.38,dist:14.2},{yaw:.48,pitch:.3,dist:9.6},{yaw:.55,pitch:.32,dist:7.2}]);function Yt(e){let t=0,n=1/0;for(let r of N){let i=Math.abs(r.log10SpanM-e);i<n&&(n=i,t=r.level)}return t}async function Xt(){if(!navigator.gpu)throw Error(`navigator.gpu is unavailable in this browser.`);let e=null;for(let t=0;t<6&&!e;t+=1)e=await navigator.gpu.requestAdapter({powerPreference:`high-performance`}),e||await new Promise(e=>setTimeout(e,250));if(!e)throw Error(`No WebGPU adapter available on this device.`);let t=await e.requestDevice(),n=[];t.addEventListener(`uncapturederror`,e=>{n.push(String(e?.error?.message??e))}),S(t,`ulg-universes-demo`);let r=new URLSearchParams(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(r.get(`Z`)||r.get(`z`)||`26`,10)||26)),a=Number.parseInt(r.get(`seed`)||`20261125`,10)||20261125,o=F[r.get(`quality`)]?r.get(`quality`):`med`,s=0;r.has(`level`)?s=Math.max(0,Math.min(7,Number.parseInt(r.get(`level`),10)||0)):r.has(`scale`)&&(s=Yt(Number.parseFloat(r.get(`scale`))||25));let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-status-dot`),p=document.getElementById(`uv-scale-badge`),m=document.getElementById(`uv-fps-badge`),h=document.getElementById(`uv-autopilot-btn`),g=document.getElementById(`uv-sim-btn`),_=document.getElementById(`uv-config-btn`),v=document.getElementById(`uv-help-btn`),y=document.getElementById(`uv-sim-drawer`),b=document.getElementById(`uv-config-drawer`),x=document.getElementById(`uv-help-drawer`),C=document.getElementById(`uv-pause-btn`),w=document.getElementById(`uv-orbit-up-btn`),T=document.getElementById(`uv-timescale-slider`),E=document.getElementById(`uv-timescale-val`),D=document.getElementById(`uv-bigbang-btn`),O=document.getElementById(`uv-reseed-btn`),k=document.getElementById(`uv-scale-controls`),A=document.getElementById(`uv-quality-group`),j=document.getElementById(`uv-lensing-toggle`),ee=document.getElementById(`uv-orbits-toggle`),M=document.getElementById(`uv-travel-toggle`),R=document.getElementById(`uv-autospin-toggle`),z=document.getElementById(`uv-crt-toggle`),B=document.getElementById(`uv-pixel-slider`),V=document.getElementById(`uv-pixel-val`),te=document.getElementById(`uv-peer-url`),ne=document.getElementById(`uv-peer-role`),re=document.getElementById(`uv-peer-connect-btn`),H=document.getElementById(`uv-peer-status`),ie=document.getElementById(`uv-inspector`),ae=document.getElementById(`uv-collapse-btn`),oe=document.getElementById(`uv-info-quick-btn`),se=document.getElementById(`uv-target-kicker`),ce=document.getElementById(`uv-target-name`),U=document.getElementById(`uv-target-sub`),W=document.getElementById(`uv-spec-title`),G=document.getElementById(`uv-comp-text`),K=document.getElementById(`uv-spectrograph-canvas`),le=document.getElementById(`uv-stats-grid`),ue=document.getElementById(`uv-plot-title`),de=document.getElementById(`uv-plot-meta`),fe=document.getElementById(`uv-plot-canvas`),pe=document.getElementById(`uv-dive-btn`),q=document.getElementById(`uv-return-btn`),me=document.getElementById(`uv-engine-tag`),he=document.getElementById(`uv-breadcrumb`),ge=document.getElementById(`uv-warp-overlay`),_e=document.getElementById(`uv-warp-kicker`),ve=document.getElementById(`uv-warp-title`),ye=document.getElementById(`uv-warp-sub`),J=document.getElementById(`uv-help-scale-tag`),be=document.getElementById(`uv-about-scale-btn`),xe=document.getElementById(`uv-about-ulg-btn`),Se=document.getElementById(`uv-modal-backdrop`),Ce=document.getElementById(`uv-modal-title`),we=document.getElementById(`uv-modal-sub`),Te=document.getElementById(`uv-modal-content`),Ee=document.getElementById(`uv-modal-close`),De=It(t,c),Y=wt(t,{seed:a,qualityId:o,initialElementZ:i}),X=s,Oe=null,ke=null,Z=!0,Ae=1,je=!0,Me=!0,Ne=!0,Pe=r.get(`cameraAutoSpin`)===`1`,Fe=r.get(`crt`)===`1`,Ie=3,Le=r.get(`autopilot`)===`1`,Re=0,ze=0,Be=!1,Ve=!1,He=0,Ue=[`Cosmic Web`],Q={yaw:Jt[s].yaw,pitch:Jt[s].pitch,dist:Jt[s].dist,target:[0,0,0]},We=new Float32Array(16),Ge=window.innerWidth,Ke=window.innerHeight,$={active:!1,startMs:0,durationMs:680,amount:0,toLevel:0,swapped:!1,target:null};if(R&&(R.checked=Pe),z&&(z.checked=Fe),h&&Le&&h.classList.add(`active`),A)for(let e of A.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=N.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Jump to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);Number.isFinite(t)&&t!==X&&(Le=!1,h?.classList.remove(`active`),rt(t,null))})}function qe(){let e=Math.min(window.devicePixelRatio||1,2);Ge=Math.max(320,window.innerWidth),Ke=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(Ge*e)),n=Math.max(2,Math.floor(Ke*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==Ge||l.height!==Ke)&&(l.width=Ge,l.height=Ke)}qe(),window.addEventListener(`resize`,qe);let Je=[{el:y,btn:g},{el:b,btn:_},{el:x,btn:v}];function Ye(e){for(let t of Je){let n=t.el===e&&!t.el?.classList.contains(`open`);t.el?.classList.toggle(`open`,n),t.btn?.classList.toggle(`active`,n)}}function Xe(){for(let e of Je)e.el?.classList.remove(`open`),e.btn?.classList.remove(`active`)}g?.addEventListener(`click`,()=>Ye(y)),_?.addEventListener(`click`,()=>Ye(b)),v?.addEventListener(`click`,()=>Ye(x));for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>Xe());function Ze(e,t,n){Xe(),Ce&&(Ce.textContent=e),we&&(we.textContent=t),Te&&(Te.innerHTML=n),Se?.classList.add(`open`)}Ee?.addEventListener(`click`,()=>Se?.classList.remove(`open`)),Se?.addEventListener(`click`,e=>{e.target===Se&&Se.classList.remove(`open`)}),be?.addEventListener(`click`,()=>{let e=N[X];Ze(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,L(e))}),oe?.addEventListener(`click`,()=>{let e=N[X];Ze(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,L(e))}),xe?.addEventListener(`click`,()=>{Ze(`About ULG Universes`,`Universal Law Graph · 40-Order-of-Magnitude WebGPU Physics`,I())}),ae?.addEventListener(`click`,()=>{let e=ie?.classList.toggle(`collapsed`);ae&&(ae.textContent=e?`+`:`−`)});function Qe(){if(k)if(X===0)k.innerHTML=`<div style="font-size:11.5px;color:var(--muted);line-height:1.4;">FLRW 3D-FFT TreePM running at <code>${Y.quality.cosmoGridPerSide}³</code> particles on a <code>${Y.quality.cosmoFftN}³</code> periodic FFT mesh. Click any supercluster or trigger Big Bang to re-run from z = 19.</div>`;else if(X===1){k.innerHTML=`
        <div class="uv-row"><span>Morphology</span></div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.galaxyPreset===`disk`?`active`:``}" data-gal-preset="disk" type="button">Spiral</button>
          <button class="uv-seg-btn ${Y.galaxyPreset===`binary`?`active`:``}" data-gal-preset="binary" type="button">Merger</button>
          <button class="uv-seg-btn ${Y.galaxyPreset===`sphere`?`active`:``}" data-gal-preset="sphere" type="button">Elliptical</button>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${Y.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${Y.galaxyMetallicity.toFixed(1)}</span>
        </div>`;for(let e of k.querySelectorAll(`[data-gal-preset]`))e.addEventListener(`click`,async()=>{await Y.initGalaxy({preset:e.dataset.galPreset}),et(),Qe()});k.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=k.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await Y.initGalaxy({preset:Y.galaxyPreset,metallicity:t})})}else if(X===2)k.innerHTML=`<div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live symplectic tiled WebGPU N-body integrating exact barycentric recoil. Pick the host star to dive into its fusion core (L3), or pick any planet to inspect its hydrostatic interior (L4).</div>`;else if(X===3){k.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Solar</button>
          <button class="uv-seg-btn ${Y.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">Massive</button>
          <button class="uv-seg-btn ${Y.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
        </div>
        <div class="uv-row">
          <span>Burn Accel</span>
          <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${Y.stellarTimeAccel}" />
          <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${Y.stellarTimeAccel.toFixed(1)}×</span>
        </div>`;for(let e of k.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await Y.initStellarCore({preset:e.dataset.stPreset}),Qe()});k.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{Y.setStellarTimeAccel(Number(e.target.value));let t=k.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${Y.stellarTimeAccel.toFixed(1)}×`)})}else if(X===4){k.innerHTML=`
        <div class="uv-seg-group">
          ${Y.PLANET_TEMPLATES.slice(0,4).map(e=>`<button class="uv-seg-btn ${Y.planetaryTemplate.id===e.id?`active`:``}" data-pl-tpl="${e.id}" type="button">${e.id.slice(0,5)}</button>`).join(``)}
        </div>
        <label class="uv-row">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${Y.planetaryCutaway?`checked`:``} />
        </label>`;for(let e of k.querySelectorAll(`[data-pl-tpl]`))e.addEventListener(`click`,async()=>{let t=Y.PLANET_TEMPLATES.find(t=>t.id===e.dataset.plTpl);t&&(await Y.initPlanetaryInterior({template:t}),et(),Qe())});k.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{Y.setPlanetaryCutaway(e.target.checked)})}else if(X===5){k.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${P.map(e=>`<option value="${e.Z}" ${e.Z===Y.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${Y.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${Y.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,Y.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${Y.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${Y.mdGravity?`checked`:``} />
        </label>`,k.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await Y.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),et(),Qe()});for(let e of k.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await Y.initMolecularDynamics({Z:Y.mdElementZ,phasePreset:e.dataset.mdPhase}),Qe()});k.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{Y.setMdTemp(Number(e.target.value));let t=k.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${Y.mdTempK} K`)}),k.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{Y.setMdGravity(e.target.checked)})}else if(X===6){k.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${Y.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${Y.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${Y.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${P.map(e=>`<option value="${e.Z}" ${e.Z===Y.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l/m</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===Y.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<Y.quantumN).map(e=>`<option value="${e}" ${e===Y.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row" title="Toggle 4-component relativistic Dirac-KS spin-orbit contraction">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${Y.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(Y.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${Y.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${Y.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of k.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await Y.initQuantumAtom({mode:e.dataset.qmMode}),et(),Qe()});k.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),et(),Qe()}),k.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await Y.initQuantumAtom({n:t,l:Math.min(Y.quantumL,t-1),m:0}),Qe()}),k.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({l:Number(e.target.value),m:0}),Qe()}),k.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await Y.initQuantumAtom({relativistic:e.target.checked}),et()});for(let e of k.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await Y.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),et(),Qe()})}else X===7&&(k.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${P.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===Y.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,k.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await Y.initAtomicNucleus({Z:Number(t),A:Number(n)}),Y.nuclearResult?.volumeData&&De.uploadNuclearVolume(Y.nuclearResult.volumeData),et()}),k.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{Y.tdseSession?.resetWavepacket?.()}))}function $e(){let e=Y.getTargetsForLevel(X);return e.find(e=>e.id===Oe)||e[0]||null}function et(){Oe=Y.getTargetsForLevel(X)[0]?.id||null}function tt(){let e=N[X];if(p&&(p.textContent=e.exponentLabel),J&&(J.textContent=`L${e.level}`),me&&(me.textContent=e.engineSchema),ue&&(ue.textContent=e.plotTitle),pe&&(pe.textContent=e.diveButton),q&&(q.disabled=X===0),w&&(w.disabled=X===0),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===X);if(he){let e=Ue.slice(0,X+1);he.innerHTML=e.map((t,n)=>n===e.length-1?`<strong>${t}</strong>`:t).join(` › `)}Qe()}async function nt(e,t=null){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));Be=!0,f?.classList.add(`busy`);try{if(n===1&&t?.morphology)await Y.initGalaxy({preset:t.morphology,metallicity:t.metallicity||1}),Ue[1]=t.name;else if(n===2&&t)await Y.initStarSystem({starTarget:t}),Ue[2]=t.name;else if(n===3){let e=(t?.tempK||5778)>1e4?`massive-supernova`:`solar-nebula`;await Y.initStellarCore({preset:e}),Ue[3]=t?.name?`${t.name} Core`:`Stellar Core`}else if(n===4){let e=t?.template||Y.planetaryTemplate;await Y.initPlanetaryInterior({template:e}),Ue[4]=t?.name||e.label}else if(n===5){let e=t?.sampleZ||Y.mdElementZ||26;await Y.initMolecularDynamics({Z:e,phasePreset:`solid`}),Ue[5]=`${Y.getCachedElementBundle(e)?.bundle?.symbol||`Z=${e}`} Lattice`}else if(n===6){let e=t?.sampleZ||Y.mdElementZ||Y.quantumZ||26;await Y.initQuantumAtom({Z:e,mode:`atom`}),Ue[6]=`${Y.getCachedElementBundle(e)?.bundle?.symbol||`Z=${e}`} Atom`}else if(n===7){let e=t?.sampleZ||Y.quantumZ||26;await Y.initAtomicNucleus({Z:e}),Ue[7]=`${Y.nuclearA}${Y.nuclearResult?.symbol||``} Nucleus`}else await Y.ensureLevelInitialized(n);n===7&&Y.nuclearResult?.volumeData&&De.uploadNuclearVolume(Y.nuclearResult.volumeData),X=n,Ue[n]||(Ue[n]=N[n].shortLabel);let e=Jt[n];Q.yaw=e.yaw,Q.pitch=e.pitch,Q.dist=e.dist,Q.target=[0,0,0],et(),tt()}finally{Be=!1,f?.classList.remove(`busy`)}}async function rt(e,t=null){if($.active||Be)return;let n=N[X],r=N[e];$.active=!0,$.startMs=performance.now(),$.toLevel=e,$.swapped=!1,$.target=t,_e&&(_e.textContent=e>X?`HYPERDRIVE ENGAGED`:`ASCENDING SCALE LADDER`),ve&&(ve.textContent=r.name.toUpperCase()),ye&&(ye.textContent=`${n.exponentLabel} → ${r.exponentLabel}`),ge?.classList.add(`active`)}async function it(){let e=$e();await rt(e?.nextLevel==null?(X+1)%8:e.nextLevel,e)}async function at(){X<=0||await rt(X-1,null)}if(pe?.addEventListener(`click`,()=>{Le=!1,h?.classList.remove(`active`),it()}),q?.addEventListener(`click`,()=>{Le=!1,h?.classList.remove(`active`),at()}),w?.addEventListener(`click`,()=>{Le=!1,h?.classList.remove(`active`),at()}),h?.addEventListener(`click`,()=>{Le=!Le,Re=0,h.classList.toggle(`active`,Le),h.textContent=Le?`⏹ Stop Tour`:`▶ Tour`}),C?.addEventListener(`click`,()=>{Z=!Z,C.textContent=Z?`⏸ Pause`:`▶ Resume`,f?.classList.toggle(`paused`,!Z)}),T?.addEventListener(`input`,e=>{Ae=Number(e.target.value)||1,E&&(E.textContent=`${Ae.toFixed(1)}×`)}),D?.addEventListener(`click`,async()=>{ze=1,await Y.initCosmicWeb(),await nt(0)}),O?.addEventListener(`click`,async()=>{ze=.75,Y.setSeed(Y.seed+7919>>>0),await Y.initCosmicWeb(),X===1?await Y.initGalaxy():X===2?await Y.initStarSystem():X===3&&await Y.initStellarCore(),et()}),A)for(let e of A.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(Y.setQuality(t)){for(let e of A.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);X===0?await Y.initCosmicWeb():X===1?await Y.initGalaxy():X===3?await Y.initStellarCore():X===5?await Y.initMolecularDynamics():X===6?await Y.initQuantumAtom():X===7&&(await Y.initAtomicNucleus(),Y.nuclearResult?.volumeData&&De.uploadNuclearVolume(Y.nuclearResult.volumeData)),Qe()}});j?.addEventListener(`change`,e=>{je=e.target.checked}),ee?.addEventListener(`change`,e=>{Me=e.target.checked}),M?.addEventListener(`change`,e=>{Ne=e.target.checked}),R?.addEventListener(`change`,e=>{Pe=e.target.checked}),z?.addEventListener(`change`,e=>{Fe=e.target.checked}),B?.addEventListener(`input`,e=>{Ie=Number(e.target.value)||3,V&&(V.textContent=`${Ie}×`)}),re?.addEventListener(`click`,async()=>{Y.getPeerMeshState().connected?await Y.disconnectPeerMesh():await Y.connectPeerMesh({relayUrl:te?.value||``,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:ne?.value||`requester`}),ot()});function ot(){let e=Y.getPeerMeshState();re&&(re.textContent=e.connected?`Leave`:`Join Mesh`),H&&(H.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let st=!1,ct=!1,lt=0,ut=0,dt=0,ft=0;function pt(e,t){let n=Y.getTargetsForLevel(X),r=null,i=48;for(let a of n){let n=Wt(a.pos,We,Ge,Ke);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r=a)}return r}c.addEventListener(`pointerdown`,e=>{st=!0,ct=!1,lt=e.clientX,ut=e.clientY,dt=e.clientX,ft=e.clientY,c.setPointerCapture?.(e.pointerId)}),c.addEventListener(`pointermove`,e=>{if(st){let t=e.clientX-dt,n=e.clientY-ft;Math.hypot(e.clientX-lt,e.clientY-ut)>5&&(ct=!0),Q.yaw-=t*.006,Q.pitch=Math.max(-1.42,Math.min(1.42,Q.pitch+n*.006)),dt=e.clientX,ft=e.clientY}else{let t=pt(e.clientX,e.clientY);ke=t?.id||null,c.style.cursor=t?`pointer`:`grab`}}),c.addEventListener(`pointerup`,e=>{if(st&&!ct){let t=pt(e.clientX,e.clientY);t&&(Oe=t.id,Le=!1,h?.classList.remove(`active`),h&&(h.textContent=`▶ Tour`))}st=!1}),c.addEventListener(`dblclick`,e=>{let t=pt(e.clientX,e.clientY);t&&(Oe=t.id),Le=!1,h?.classList.remove(`active`),it()}),c.addEventListener(`wheel`,e=>{e.preventDefault();let t=e.deltaY>0?1.09:.92;Q.dist=Math.max(3.2,Math.min(44,Q.dist*t))},{passive:!1});function mt(e){if(!K)return;let t=K.getContext(`2d`);if(!t)return;let n=K.width,r=K.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=Gt(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=X>=5?Y.getCachedElementBundle(X===5?Y.mdElementZ:Y.quantumZ,Y.quantumRelativistic):null,a=Ct(X,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=Gt(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}}function ht(){if(!fe)return;let e=fe.getContext(`2d`);if(!e)return;let t=fe.width,n=fe.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(X===0){let e=Y.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;de&&(de.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=Y.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(X===1){de&&(de.textContent=`Gate 1 H/He/C/O · Z=${Y.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=Y.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,Y.galaxyMetallicity,Y.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(X===2){let r=Y.getTargetsForLevel(2).slice(1);de&&(de.textContent=`${r.length} worlds · Verlet N-body`);let i=(t-32)/Math.max(1,r.length);r.forEach((t,r)=>{let a=Math.min(1,Math.log10(Math.max(30,t.tempK))/3.4)*(n-26),o=16+r*i+4;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(o,n-12-a,Math.max(8,i-10),a),e.fillStyle=`#94a3b8`,e.font=`9px monospace`,e.fillText(`${t.tempK}K`,o,n-15-a)})}else if(X===3){let e=Y.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);de&&(de.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(Y.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(X===4){let e=Y.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,Y.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));de&&(de.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(Y.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(X===5){let e=Y.mdRdfHistory;if(!e?.length)return;de&&(de.textContent=`Phase: ${Y.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(Y.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(X===6){let e=Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;de&&(de.textContent=`Dirac–KS ${Y.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${Y.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(X===7){let e=Y.tdseTelemetry;if(!e?.prob?.length)return;de&&(de.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}function gt(){let e=N[X],t=$e();se&&(se.textContent=`L${e.level} · ${e.name.toUpperCase()} · ${e.exponentLabel}`),ce&&(ce.textContent=t?.name||e.name),U&&(U.textContent=t?.subtitle||e.engineSchema),G&&(G.textContent=t?.composition||``),W&&(W.textContent=X>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`);let n=[];if(X===0){let e=Y.cosmoTelemetry;n=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(X===1)n=[[`GPU Stars`,`${(Y.galaxyEngine?.count||0).toLocaleString()}`],[`Gravity`,`SS Scale-Atlas`],[`Steps`,`${Y.galaxyEngine?.stepIndex||0}`],[`SMBH Lensing`,je?`Active WGSL`:`OFF`]];else if(X===2)n=[[`Target Mass`,t?.massLabel||`—`],[`T_eq / T_eff`,t?`${t.tempK.toLocaleString()} K`:`—`],[`GPU Steps`,`${Y.systemEngine?.stepIndex||0}`],[`Integrator`,`Symplectic GPU`]];else if(X===3){let e=Y.stellarTelemetry;n=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,e?.stage||`hydro-collapse`],[`GPU Steps`,`${Y.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(Y.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(X===4){let e=Y.planetaryResult;n=[[`Radius`,e?`${(e.radiusM/1e3).toFixed(0)} km`:`—`],[`Mass`,e?`${(e.massKg/59722e20).toFixed(2)} M⊕`:`—`],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Polytope`,e?.valid?`VALID (Fail-Closed)`:`OUT-OF-DOMAIN`]]}else if(X===5){let e=Y.mdTelemetry;n=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${Y.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,Y.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(X===6){let e=Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],r=Number(e?.atomic?.totalEnergyHa);n=[[`Samples`,`${(Y.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(r)?`${r.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(X===7){let e=Y.nuclearResult,t=Y.tdseTelemetry,r=Number(e?.bindingPerNucleonMeV),i=Number(e?.chargeRadiusFm);n=[[`B / A`,Number.isFinite(r)?`${r.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(i)?`${i.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}le&&(le.innerHTML=n.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``)),mt(t),ht()}function _t(e){if(!u)return;u.clearRect(0,0,Ge,Ke);let t=Y.getTargetsForLevel(X);if(t.length)for(let n of t){let t=Wt(n.pos,e,Ge,Ke);if(!t.visible)continue;let r=n.id===Oe,i=n.id===ke;if(!r&&!i&&X>=3&&X!==4)continue;let a=r?22:i?18:11;u.strokeStyle=r?`rgba(56, 189, 248, 0.92)`:i?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.36)`,u.lineWidth=r?1.8:1.1;let o=Math.max(5,a*.42);for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(t.sx+e*a,t.sy+n*(a-o)),u.lineTo(t.sx+e*a,t.sy+n*a),u.lineTo(t.sx+e*(a-o),t.sy+n*a),u.stroke();(r||i)&&(u.font=`600 11px monospace`,u.fillStyle=r?`#e0f2fe`:`#cbd5e1`,u.fillText(n.name,t.sx+a+7,t.sy+4))}}function vt(e,t){let n={camera:e,particleCloud:null,spheres:null,lightDir:[.6,.75,.55],mdCloud:null,disks:null,lines:null,nuclearVol:null,post:{bhUv:[.5,.5],bhStrength:0,warpAmount:$.amount,flashAmount:ze,crtEnabled:Fe,pixelSize:Ie,timeSec:t}};if(X===0&&Y.cosmoSession)n.particleCloud={buffer:Y.cosmoSession.particlesBuffer,count:Y.cosmoSession.particleCount,mode:0,worldScale:20/Math.max(1,Y.cosmoSession.boxLengthMpc),pointSize:.11,alphaGain:.46},Me&&(n.lines=Kt([10,10,10],[.24,.56,.92,.25]));else if(X===1&&Y.galaxyEngine){n.particleCloud={buffer:Y.galaxyEngine.getResidentBuffer(),count:Y.galaxyEngine.count,mode:1,worldScale:1,pointSize:.095,alphaGain:.34};let t=Y.galaxySmbhPos;if(n.spheres=[{pos:t,radius:.58,color0:[0,0,0],color1:[0,0,0],kind:5}],n.disks=[{center:t,rIn:.68,normal:[.08,.97,.22],rOut:2.55,color:[1,.85,.55],kind:0}],je){let r=Wt(t,e.viewProj,Ge,Ke);r.visible&&(n.post.bhUv=[r.uvX,r.uvY],n.post.bhStrength=.0018*(22/Math.max(6,Q.dist))**1.2)}}else if(X===2&&Y.systemBodies){let e=Y.getTargetsForLevel(2),t=e[0]?.pos||[0,0,0];n.spheres=e.map((e,t)=>({pos:e.pos,radius:e.radius,color0:e.color0,kind:e.kind,color1:e.color1,atm:e.atm??.35,seed:t*2.13+1.1}));let r=$e();r&&r.bodyIndex>0&&(n.lightDir=Bt(Lt(t,r.pos)));let i=e.find(e=>e.ringed);if(i&&(n.disks=[{center:i.pos,rIn:i.radius*1.35,normal:[.18,.94,.28],rOut:i.radius*2.45,color:[.88,.78,.62],kind:1}]),Me||Ne){let i=[];if(Me){i.push(...qt(Y.systemBodies,e,1));for(let t=1;t<Y.systemOrbitHistory.length;t+=1){let n=Y.systemOrbitHistory[t];if(n.length<2)continue;let r=e[t]?.color0||[.35,.75,1];for(let e=0;e<n.length-1;e+=1){let t=.18+.62*(e/n.length);i.push(...n[e],r[0],r[1],r[2],t),i.push(...n[e+1],r[0],r[1],r[2],t)}}}Ne&&r&&r.bodyIndex>0&&(i.push(...t,.22,.88,1,.55),i.push(...r.pos,.22,.88,1,.85)),i.length>=14&&(n.lines=new Float32Array(i))}}else if(X===3&&Y.stellarEngine)n.particleCloud={buffer:Y.stellarEngine.getResidentBuffer(),count:Y.stellarEngine.count,mode:2,worldScale:.78,pointSize:.17,alphaGain:.44};else if(X===4){let e=Y.planetaryTemplate,t=Y.getTargetsForLevel(4)[0];n.spheres=[{pos:[0,0,0],radius:3.2,color0:e.color0,kind:4,color1:e.color1,atm:e.atm??.5,rCore:t?.rCoreNorm??.52,rMantle:t?.rMantleNorm??.94,cutaway:Y.planetaryCutaway,seed:4.2}],n.lightDir=[.65,.55,.52]}else if(X===5&&Y.mdSession){let e=Y.mdSession.boxLengthsA,t=7.2/Math.max(e[0],e[1],e[2],6),r=(Y.getCachedElementBundle(Y.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];n.mdCloud={positionsBuffer:Y.mdSession.positionsBuffer,velocitiesBuffer:Y.mdSession.velocitiesBuffer,count:Y.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.14,Math.min(.42,(Y.mdSession.rNearestNeighborA||2.5)*.34*t)),baseRgb:r,idealCoord:Y.mdSession.idealCoordination||12},Me&&(n.lines=Kt([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.42]))}else if(X===6&&Y.orbitalCloud){let e=(Y.getCachedElementBundle(Y.quantumZ,Y.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1];if(n.particleCloud={buffer:Y.orbitalCloud.pointsBuffer,count:Y.orbitalCloud.pointCount,mode:3,worldScale:3.6,pointSize:.036,alphaGain:.068,colorPos:Y.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:Y.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]},Y.quantumMode===`molecule`){let e=Y.MOLECULE_SPECS[Y.quantumMoleculeKey],t=3.6/4.2;n.spheres=e.atoms.map(e=>({pos:[e.position[0]*t,e.position[1]*t,e.position[2]*t],radius:e.Z===1?.22:.36,color0:e.Z===8?[.95,.28,.28]:e.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5}))}else n.spheres=[{pos:[0,0,0],radius:.14,color0:[1,.72,.32],color1:[1,.94,.72],kind:0}]}else if(X===7&&Y.nuclearResult){let e=Y.tdseTelemetry,t=20,r=-1;if(e?.prob?.length)for(let n=0;n<e.prob.length;n+=1)e.prob[n]>r&&(r=e.prob[n],t=n);n.nuclearVol={dim:Y.nuclearResult.volDim||28,boxRadius:3.2,tdseTunneled:e?.pTunneled||0,tdseCrestNorm:Math.max(.32,Math.min(.95,t/Math.max(1,(e?.prob?.length||128)-1)))}}return n}let yt=performance.now(),bt=0,xt=0,St=0,Tt=0,Et=60;function Dt(e=performance.now()){qe();let t=Math.cos(Q.pitch),n=Math.sin(Q.pitch),r=Math.cos(Q.yaw),i=Math.sin(Q.yaw),a=[Q.target[0]+Q.dist*t*i,Q.target[1]+Q.dist*n,Q.target[2]+Q.dist*t*r],o=c.width/Math.max(1,c.height),s=48*Math.PI/180,l=Vt(s,o,.1,220),u=Ht(a,Q.target,[0,1,0]),d=Ut(l,u.mat);We=d;let f=vt({viewProj:d,pos:a,right:u.right,up:u.up,fwd:u.fwd,aspect:o,fovTanHalf:Math.tan(s*.5),timeSec:e*.001,level:X},e*.001);De.renderFrame(f),_t(d)}function Ot(e){if(Ve)return;He=requestAnimationFrame(Ot);let t=Math.min(.1,Math.max(.001,(e-yt)/1e3));if(yt=e,St+=t,Tt+=1,St>=.45&&(Et=Math.round(Tt/St),St=0,Tt=0),Pe&&!st&&(Q.yaw+=t*.22),ze>0&&(ze=Math.max(0,ze-t*1.45)),$.active){let t=Math.min(1,(e-$.startMs)/$.durationMs);$.amount=Math.sin(t*Math.PI),t>=.48&&!$.swapped&&($.swapped=!0,nt($.toLevel,$.target)),t>=1&&($.active=!1,$.amount=0,ge?.classList.remove(`active`))}Le&&!$.active&&!Be&&(Re+=t,Re>=4.4&&(Re=0,it())),Z&&!Be&&Y.stepLevel(X,Ae),(!((X===4||X===6)&&!st&&!Pe&&!$.active&&ze<=0)||e-bt>=120)&&(bt=e,Dt(e)),xt+=t,xt>=.18&&(xt=0,m&&(m.textContent=`${Et} FPS · WebGPU`),gt(),ot())}await nt(s);let kt=r.get(`peerRelay`);if(kt){te&&(te.value=kt);let e=r.get(`peerRole`)||`requester`;ne&&(ne.value=e),await Y.connectPeerMesh({relayUrl:kt,roomId:r.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),ot()}gt();let At=()=>{Y.disconnectPeerMesh()};return window.addEventListener(`pagehide`,At),window.addEventListener(`beforeunload`,At),He=requestAnimationFrame(Ot),Object.freeze({getState(){let e=N[X],t=Y.cosmoSession?.getState?.()||null;return{ready:!0,level:X,scaleId:e.id,scaleName:e.name,log10ViewSpanM:e.log10SpanM,totalSpanOom:40,gpuBackend:`webgpu`,cameraAutoSpin:Pe,running:Z,autopilot:Le,retroCrt:Fe,lensingEnabled:je,qualityId:Y.quality.id,seed:Y.seed,gpuErrorCount:n.length,gpuErrors:[...n],scientificValidation:!1,cosmicWebSteps:t?.stepIndex??0,scaleFactorA:t?.aScale??null,redshiftZ:t?.redshiftZ??null,submitsPerStep:Y.cosmoTelemetry?.submitsPerStep??t?.submitsPerStep??null,sigmaDensity:Y.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:Y.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:Y.galaxyEngine?.stepIndex??0,galacticBodyCount:Y.galaxyEngine?.count??0,galacticGravityMode:Y.galaxyEngine?.gravityMode??null,planetarySteps:Y.systemEngine?.stepIndex??0,stellarSteps:Y.stellarEngine?.stepIndex??0,stellarCoreTempK:Y.stellarTelemetry?.coreTempK??null,planetaryInteriorValid:!!Y.planetaryResult?.valid,planetaryMoiFactor:Y.planetaryResult?.moiFactor??null,mdSteps:Y.mdTelemetry?.totalSteps??0,mdAtomCount:Y.mdSession?.atomCount??0,mdGravity:Y.mdGravity,mdElementZ:Y.mdElementZ,quantumZ:Y.quantumZ,quantumRelativistic:Y.quantumRelativistic,orbitalPointCount:Y.orbitalCloud?.pointCount??0,nuclearZ:Y.nuclearZ,nuclearA:Y.nuclearA,nuclearBindingPerNucleonMeV:Y.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:Y.tdseTelemetry?.stepCount??0,selectedTarget:$e()?.id??null,peerMeshState:Y.getPeerMeshState()}},async setLevel(e,{instant:t=!0,target:n=null}={}){return t?(await nt(e,n),gt()):await rt(e,n),this.getState()},selectTarget(e){return Y.getTargetsForLevel(X).some(t=>t.id===e)?(Oe=e,gt(),!0):!1},initiateHyperdrive:it,returnToOrbit:at,setAutopilot(e){Le=!!e,Re=0,h?.classList.toggle(`active`,Le),h&&(h.textContent=Le?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=Ie){Fe=!!e,Ie=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),z&&(z.checked=Fe),B&&(B.value=String(Ie)),V&&(V.textContent=`${Ie}×`)},setCameraAutoSpin(e){Pe=!!e,R&&(R.checked=Pe)},async bigBang(){return ze=1,await Y.initCosmicWeb(),await nt(0),this.getState()},async reseed(e=null){return Y.setSeed(e??Y.seed+7919>>>0),await Y.initCosmicWeb(),this.getState()},connectPeerMesh:e=>Y.connectPeerMesh(e),disconnectPeerMesh:()=>Y.disconnectPeerMesh(),dispatchPeerDerivation:e=>Y.dispatchPeerDerivation(e),async stepOnce(){return await Y.stepLevel(X,Ae),gt(),this.getState()},capturePng(){return Dt(performance.now()),c.toDataURL(`image/png`)},dispose(){Ve=!0,cancelAnimationFrame(He),window.removeEventListener(`resize`,qe),window.removeEventListener(`pagehide`,At),window.removeEventListener(`beforeunload`,At),Y.dispose(),De.dispose()}})}async function Zt(){try{let e=await Xt();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}Zt();