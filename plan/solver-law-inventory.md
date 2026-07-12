# ULG Solver And Law Inventory

Runtime source snapshot: 2026-07-11, branch
`gpu-resident-physics-refactor` at committed HEAD `b4d1a38` plus the inspected
uncommitted GPU-resident refactor worktree.

## Reading Rules

This inventory is derived from executable source, WGSL entry points, tests,
and the active plans. A name in a descriptor or todo is not enough to count as
an implementation.

Status terms:

- **Runtime:** executable in the current browser/runtime path.
- **Oracle:** executable CPU/reference path used for evidence, fallback, or
  lower-level derivation; it is not the desired hot-loop authority.
- **Reduced:** executable, but deliberately approximate, incomplete, or not
  scientifically validated for the full claimed domain.
- **Kernel suite:** individual GPU stages execute, but the intended complete
  solver still has missing representation, sparsity, coupling, or authority
  work.
- **Integration open:** the GPU producer/consumer kernels execute, but the
  normal mounted authority path still has an older host-mediated, multi-submit,
  or unadmitted edge. This is not full solver acceptance.
- **Metadata only:** a law graph or service descriptor exists without an
  independently promoted solver.
- **Missing:** no executable implementation of the planned solver/law exists.

`Implemented` does not mean scientifically validated. Most material,
chemistry, continuum, and Schroeder outputs still carry false scientific or
full-physics validation flags.

The historical CPU solvers labeled as oracles below remain useful analysis or
legacy paths, but they are not acceptance gates for new Schroeder WebGPU work.
The current refactor uses manufactured GPU states, mathematical invariants,
metamorphic GPU executions, same-device paths, and fixed-size GPU reductions;
it does not add a CPU mirror to the hot pipeline.

Rendering, cache management, scheduling, admission, and diagnostics are not
physics solvers. Their important boundaries are called out separately.

## Implemented Solvers

### Closure And Carrier Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Flat closure-law graph evaluator | CPU oracle and WebGPU runtime | Executes `tableLinear` and `tableStep` graph nodes with domain/status rows. It is not yet a general arithmetic or differential law compiler. | `src/runtime/closureLawGraph.js` |
| Two-body closure carrier | CPU oracle | One-dimensional velocity-Verlet integration over a sampled pair closure, with invariant and domain-exit evidence. | `src/runtime/carrierRuntime.js` |
| Two-body WebGPU carrier | WebGPU reduced runtime with CPU fallback/parity | GPU version of the same toy two-body carrier, not SPH, MPM, or a production material solver. | `src/runtime/webgpuCarrierKernel.js` |

`spatialHash.js`, `edgeMessages.js`, `observers.js`, and
`fieldClosureSamples.js` are implemented operator primitives, not standalone
solvers.

### Atomic And Electronic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Radial Kohn-Sham atom | CPU oracle | All-electron radial LDA SCF on the original radial grid. | `solveKohnShamAtom()` in `src/runtime/electronicStructure/radialKohnSham.js` |
| Log-grid multi-shell Kohn-Sham atom | CPU oracle | Multi-shell all-electron LDA used by the general element path. | `solveKohnShamAtomLog()` and `solveKohnShamAtomConfig()` in `radialKohnSham.js` |
| Spin-polarized atomic LSDA | CPU oracle | Separate spin channels and Hund-like moments. | `solveKohnShamAtomLSDA()` in `radialKohnSham.js` |
| Koelling-Harmon scalar-relativistic atom | CPU oracle | Scalar-relativistic radial states and SCF; no spin-orbit/full-Dirac solve. | `radialStatesKH()`, `solveKohnShamAtomKH()`, and `solveAtom()` in `radialKohnSham.js` |
| Uniform electron gas | CPU analytic solver | Thomas-Fermi kinetic, Dirac exchange, Chachiyo correlation fitted to Ceperley-Alder QMC, spin scaling, energy, and pressure. | `src/runtime/electronicStructure/uniformElectronGas.js` |
| Jellium/Ashcroft simple-metal cold curve | CPU reduced solver | Madelung plus empty-core pseudopotential equilibrium radius, density, cohesion, and bulk modulus. Reliable mainly for simple metals. | `src/runtime/electronicStructure/jelliumCohesion.js` |

### Molecular And Atomistic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Restricted Hartree-Fock | CPU oracle | STO-3G molecular SCF for the parameterized basis set. | `rhf()` in `src/runtime/electronicStructure/molecularHartreeFock.js` |
| Unrestricted Hartree-Fock | CPU oracle | Open-shell UHF with multiplicity control. | `uhf()` in `molecularHartreeFock.js` |
| MP2 correlation | CPU oracle | Closed-shell MP2 correction on the RHF solution. | `mp2()` in `molecularHartreeFock.js` |
| Molecular geometry optimizer | CPU reduced solver | Numerical gradients plus backtracking/internal-coordinate handling. | `optimizeGeometry()` in `molecularHartreeFock.js` |
| Molecular vibration solver | CPU reduced solver | Finite-difference Hessian, mass weighting, and normal-mode eigenvalues. | `vibrationalFrequencies()` in `molecularHartreeFock.js` |
| Born-Oppenheimer molecular dynamics | CPU reduced solver | Velocity-Verlet nuclear motion on numerical electronic-energy gradients. | `bornOppenheimerMD()` in `molecularHartreeFock.js` |
| Reduced molecular refractive response | CPU reduced response; WebGPU render consumer | Provenance-bearing occupied-to-virtual dipole response from a converged STO-3G RHF wavefunction, converted from dynamic molecular polarizability and phase number density to spectral refractive index with Lorentz-Lorenz. It is independent-particle, returns zero-loss refractive samples, and explicitly carries `scientificValidation: false`; it is not TDHF, periodic dielectric response, or validated condensed-phase optics. | `src/runtime/material/molecularOpticalResponse.js` |
| All-element molecular energy solver | CPU reduced solver | Atomic Kohn-Sham descriptors feeding a universal Morse-like pair Hamiltonian and saturation term for Z=1..118. It is broad coverage, not quantitative quantum chemistry. | `src/runtime/electronicStructure/allElementMolecularSolver.js` |
| Classical pair-potential molecular dynamics | CPU oracle | Periodic-box NVE/NVT velocity-Verlet, virial pressure, velocity-rescaling thermostat, and diffusion/energy samples. | `src/runtime/md/mdEngine.js` |
| Pair potential and fit solvers | CPU oracle/reduced | Lennard-Jones, tabulated potentials, Morse potential, and Morse fitting including the MoonLab H2 curve. | `src/runtime/md/pairPotential.js`, `src/runtime/md/potentialFitting.js` |
| Condensed-property scan solvers | CPU oracle | EOS scans, equilibrium density, bulk modulus, diffusion, heat capacity, and melting scans over the MD engine. | `src/runtime/md/propertyEstimators.js` |

### Material And Thermodynamic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Element material closure derivation | CPU reduced solver | Atomic DFT plus jellium or radial packing, Debye/Lindemann/Richards/Poisson reductions, and optical inputs for elements. | `deriveElementProperties()` and `elementMaterialClosure()` in `src/runtime/material/elementClosures.js` |
| Formula/compound material derivation | CPU reduced solver | Formula parsing, formula geometry, molecular/all-element energies, ideal-gas rows, condensed density/modulus estimates, and phase-transition estimates. | `src/runtime/material/materialDerivation.js`, `src/runtime/material/compoundClosure.js` |
| Phase equilibrium and enthalpy inversion | CPU runtime and GPU table consumer | Stable phase from temperature or specific energy, energy-to-temperature inversion, and latent-plateau lever-rule fractions. | `src/runtime/material/phaseEquilibrium.js`, `src/runtime/material/thermoState.js`, `src/runtime/sph/sphThermalGpuKernel.js` |
| Gruneisen thermal expansion closure | CPU reduced solver | Thermal expansion and density as a function of temperature; this is not a complete shock Mie-Gruneisen EOS. | `src/runtime/material/gruneisenEos.js` |
| Thermodynamic scenario preflight | CPU analysis solver | Energy/mass feasibility checks for the configured phase scenario. It does not advance the live simulation. | `src/runtime/thermoPreflight.js`, `src/runtime/material/thermodynamicPreflight.js` |
| Optical closure derivation, admission, and lookup | CPU reduced derivation plus WebGPU lookup/render | Derives and packs spectral/PBR rows. Refractive admission requires nonblocked provenance, exact optical-state identity, and distinct blue/green/red samples; display fallback rows cannot bend rays. The lower-level derivation is not GPU-native or scientifically validated. | `src/runtime/material/opticalClosure.js`, `src/runtime/material/opticalGpuBuffers.js`, `src/runtime/material/molecularOpticalResponse.js` |

## Material Property Determination Matrix

This table separates a property **derivation** from a runtime law that merely
consumes a supplied coefficient. In particular, conduction-electron density
and Drude plasma frequency are optical inputs; neither is an electrical
conductivity solver.

| Property family | Current derivation/consumer | Status | Missing work |
| --- | --- | --- | --- |
| Composition, formula mass, and atom/charge counts | Periodic-table constants plus formula parsing and exact stoichiometric tallying in `formula.js` and `materialDerivation.js`. | CPU runtime | GPU-side accepted atom-vector consumption exists only in reduced reaction tables; formula parsing appropriately remains control-plane work. |
| Electron configuration, valence, spin, orbitals, and ionization scale | Radial Kohn-Sham LDA/LSDA/KH and configuration rules in `radialKohnSham.js`. | CPU reduced/oracle | GPU-resident electronic solvers, spin-orbit/full Dirac treatment, and stronger correlation methods. |
| Density, atomic volume, and packing | Atomic radial-density packing or jellium cold curves for elements; molecular/formula volume estimates and phase rows for compounds. | CPU reduced | Periodic solid structure, validated phase-specific density, and GPU-native derivation. |
| Cohesive energy and cold curve | Uniform-electron-gas/jellium or radial packing; pair-potential/MD scans for parameterized systems. | CPU reduced/oracle | Periodic DFT, broad quantitative interatomic potentials, pressure-range validation, and GPU-native closure evaluation. |
| Bulk/shear modulus, Lame parameters, and sound speed | Element closure reductions and phase mechanics-table construction; MLS-MPM consumes the resulting rows. | CPU-derived, WebGPU-consumed | Validated anisotropic/plastic constitutive properties and GPU-native property derivation. |
| Heat capacity, internal energy, Debye temperature, and vibrations | Debye/statistical-mechanics laws, phase enthalpy tables, molecular vibrational analysis, and reduced MD estimators. | CPU reduced, WebGPU table-consumed | General phonon/quasiharmonic free-energy solver and GPU-native graph construction. |
| Melting, boiling, latent heat, and phase fractions | Lindemann, Richards, Trouton, Clausius-Clapeyron, piecewise enthalpy ladders, and lever-rule inversion. | CPU reduced, WebGPU table-consumed | General Gibbs minimization, nucleation, nonequilibrium phase kinetics, and validated high-pressure phase diagrams. |
| EOS and thermal expansion | Jellium cold curve, Gruneisen expansion, Tait/Cole condensed EOS, and GPU-native local ideal-gas cells. | Mixed CPU-oracle and WebGPU runtime | Stiff/shock and mixture EOS, pressure-work coupling, and broader validation. |
| Viscosity and momentum transport | MLS-MPM consumes closure-supplied phase viscosity and adds a resolution-dependent artificial-viscosity term; CPU SPH has Monaghan artificial viscosity. | Runtime constitutive law, incomplete property derivation | A general material/phase viscosity resolver, temperature dependence, and GPU transport-closure kernels. |
| Thermal conductivity and heat diffusion | The thermal kernel performs conservative pair conduction using configured global/pair rates and fixed-temperature wall exchange. | Reduced runtime law; **no general material-property solver** | Derive validated phase- and temperature-dependent thermal conductivity/diffusivity, mix it at interfaces, and model finite-capacity conductive solids/walls. |
| Electrical conductivity, resistivity, and charge transport | Element closures derive conduction-electron density and plasma frequency for Drude optics only. | **Missing as a transport/property solver** | Scattering/relaxation-time or stronger conductivity closure, resistivity versus phase/temperature, carrier transport, charge conservation, and coupling to Maxwell/MHD/PIC. |
| Diffusion and species transport | The MD property estimator can infer a diffusion coefficient from sampled trajectories; live continuum chemistry has no general species-diffusion solve. | CPU estimator; live solver missing | Resident multicomponent mass diffusion, mixing, electrochemical transport, and reaction-diffusion coupling. |
| Surface tension and interfacial energy | A supplied `surfaceTensionNPerM` coefficient can be packed into mechanics rows. | Coefficient transport only; force solver missing | Derived phase/state-dependent interfacial properties plus an admitted curvature/free-energy force law. |
| Optical dielectric response, color, IOR, absorption, scattering, and emissivity | Conductors have Drude/Drude-Lorentz plus interband spectral `n,k`; molecular absorption/scattering uses O-H overtones, electronic bands, Beer-Lambert, and Rayleigh/droplet reductions. Molecular refraction can use the reduced STO-3G RHF/Lorentz-Lorenz response. The opaque native renderer consumes admitted blue/green/red samples, requires exact provenance/state, and fails closed rather than granting fixed display IOR authority. | Mixed CPU-derived/reduced and WebGPU-consumed; **reduced unvalidated spectral refraction implemented** | Replace the reduced independent-particle/minimal-basis model with validated frequency-dependent molecular and periodic dielectric response, include loss/anisotropy/microstructure consistently, move derivation into the admitted GPU law graph where justified, and validate the combined optical chain scientifically. |
| Reaction products, energetics, and activation | Formula balancing, candidate discovery, reduced electronic/product energies, contact gating, and GPU extent/product conversion. | Mixed reduced runtime | Validated barriers/rates, reversible networks, competing reactions, electrochemistry, catalysis, and body-aware surface chemistry. |
| Nuclear and radiation material properties | Thermal blackbody/emissive closures exist; the resolver manifest reserves isotope and nuclear/radiation row families. | Thermal emission only; nuclear properties missing | Isotope inventory, half-lives, cross sections/channels, daughter products, stopping/deposition data, and validation provenance. |

`materialPropertyBank.js` validates and packs supplied records; it is not an
independent property derivation solver. Likewise, a coefficient present in a
mechanics or thermal row does not prove that ULG can derive that coefficient
for an arbitrary material.

### Continuum And Multiphysics Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Conservative SPH/PBF phase carrier | CPU oracle | Cubic-spline density, symmetric pressure/energy, Monaghan viscosity, kick-drift-kick integration, optional density projection, reduced solid grouping/contact, and phase-aware EOS. | `src/runtime/sph/sphOperators.js`, `src/runtime/sph/sphPhaseCarrier.js` |
| MLS-MPM/APIC carrier | CPU oracle | Quadratic B-spline P2G/G2P, APIC affine transfer, pressure fluid stress, fixed-corotated solid elasticity, Newtonian viscosity, gravity, walls, and phase-derived constitutive state. | `src/runtime/sph/mlsMpmCarrier.js` |
| Resident MLS-MPM/APIC solver | WebGPU runtime | Particle-parallel P2G, grid update, G2P, fused/split resident steps, retained buffers, compact summaries, and thermal/reaction sidecars. This is the default mechanics path. Pressure impulses still reach it through the older host-mediated production edge while the direct resident lane integration is completed. | `sphGridGpuKernel.js`, `sphGridUpdateGpuKernel.js`, `sphG2pGpuKernel.js`, `sphMlsMpmGpuStep.js` |
| MLS-MPM mechanics predictor and constitutive refresh | CPU oracle plus WebGPU runtime | Predicts/refreshes phase-dependent mechanics rows and reset state after thermal/reaction changes. These are stages of the resident MLS-MPM solver, not separate continuum methods. | `sphMechanicsGpuKernel.js`, `sphMechanicsRefreshGpuKernel.js` |
| Thermal and phase transport | CPU oracle plus WebGPU runtime | Pair conduction, six wall reservoirs, pair/ambient graybody radiation, temperature/phase response, and latent-energy updates. | `src/runtime/sph/thermalPhase.js`, `src/runtime/sph/sphThermalGpuKernel.js` |
| Reaction/product conversion | CPU oracle plus WebGPU runtime | Contact-pair proposals, balanced stoichiometric extent, reactant consumption, product placement, heat release, gas/product ledgers, phase reset, and atom/charge/mass diagnostics. The resident kernel now shader-initializes the 300k live rows with zero host zero upload; carrier search/placement scalability and exact live-prefix work remain open. | `src/runtime/sph/reactiveChemistry.js`, `src/runtime/sph/sphReactionGpuKernel.js`, `src/runtime/sph/sphReactionGpuSummary.js` |
| Pressure/interface force-row solver | WebGPU runtime; resident integration open | Particle-bin or packed resident-neighborhood contact kinematics, material-interface normal/area rows, local gas-cell pressure input, and cubic-barrier/damping/inertial contact pressure. The shader can consume retained GPU candidate rows and fail closed from compact metadata plus neighborhood identity; production StateManager-admitted candidate-to-force-to-grid integration is still in progress. | `src/runtime/sph/sphPressureInterfaceGpuKernel.js` |
| Resident material-interface candidate producer | WebGPU runtime; production integration open | Source-local GPU work compacts active interface candidates, source keys, and fixed metadata into retained same-device buffers without a normal-path map. A direct force consumer and caller-owned-encoder probe exist, but the mounted scene still has a host-mediated pressure edge. | `src/runtime/sph/sphRenderGpuKernel.js`, `src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js` |
| Spatial gas ledger and gas-cell EOS producer | WebGPU resident runtime; CPU diagnostic/oracle retained | Consumes retained product-event or compact gas rows, performs GPU key/radix/unique aggregation, parallel per-cell ideal-gas reduction, and lookup-indexed pressure gradients, then retains 12-float pressure rows plus compact fail-close metadata without normal-path map/decode/reupload. | `src/runtime/sph/sphSpatialGasCellEosGpu.js`; stage integration in `src/runtime/sph/sphMlsMpmGpuStep.js` |
| Coherent-solid rigid-frame suite (SOL-0/SOL-1) | WebGPU reduced kernel suite; full slice acceptance open | Versioned frame/member/contact/shape contracts, parallel body-wrench and invariant reductions, objective `SE(3)` frame integration, transformed member/contact rows, global fail-close, ComputeManager/StateManager admission, persistent two-slot resident arenas, and indirect native rest-mesh rendering. It does not yet implement SOL-2 contact dynamics, solid-liquid coupling, deformation, fracture, or orbital mechanics. | `src/runtime/solid/`, `ulg-gpu-abi/src/coherentSolid*.js` |

### Schroeder Simulation Kernel Suite

The following WebGPU stages are implemented and tested. They constitute a
two-level experimental/kernel suite, not a completed scale-independent
Schroeder solver:

- Assignment/indexing: level assignment, active-node list, phase-volume
  overlay index, bucket index, and sorted active-node index.
- Law traversal: local law queues and neighbor-candidate traversal, including
  reaction and pressure/interface masks/source spans.
- Cross-level grid work: restriction, prolongation, velocity-delta
  prolongation, cross-level coupling candidates, transfers, conservation
  summaries, pending state deltas, and admitted state-delta merge.
- Hierarchy aggregation: contribution materialization, phase-volume target
  aggregates, keyed/bucket aggregate-node reduction, far-aggregate candidates,
  force summaries, diagnostic summaries, law consumers, gas deltas/imports,
  and admitted far-force application.
- Phase-volume/storage: migration decisions, split/merge proposals and admitted
  apply rows, allocation, free-list/slot assignment, materialization, level
  updates, count summaries, and order-preserving compaction.
- Sparse representation: exact five-word chart/level/tile keys,
  radix/scan/unique compaction, byte-bounded retained and scratch arenas, an
  activity-sized open-addressed hash from compact nodes to compact grid rows,
  indirect work, and fail-closed overflow evidence. Sparse P2G, G2P,
  restriction, and prolongation shader variants consume the same lookup.
- Orchestration: same-level mechanics and the two-level mechanics step.

Two-level thermal and reaction sidecars execute. Equivalent authoritative
two-level pressure/interface continuation is still missing. Far-field gravity
rows can be computed and admission-gated, but they are not the normal mounted
self-gravity authority. The far radiation, plasma, and gas consumers are
read-only/proxy scalar responses; they are not radiation transport, Maxwell,
MHD, PIC, or plasma evolution.

Primary executable entry points are the `runSchroeder*WebGpu()` exports in:

- `src/runtime/sph/schroederHierarchyGpu.js`
- `src/runtime/sph/schroederCrossLevelCouplingGpu.js`
- `src/runtime/sph/schroederSparseHierarchyGpu.js`
- `src/runtime/sph/schroederParticleStorageCountGpu.js`
- `src/runtime/sph/schroederParticleStorageCompactionGpu.js`
- `src/runtime/webgpuRadixScanUnique.js`

The suite remains **partial**. The worktree now contains genuinely compact
two-level node and hash-backed grid kernels, but `SS-0` acceptance is still
open while the production P2G/update/G2P and cross-level path is consolidated
onto one caller-owned submission and retained conservation evidence replaces
the disabled host summary. Only two adjacent levels are admitted, several
rows remain proposal/admission artifacts, and general variable-support and
split/merge policy is unfinished. The third level remains explicitly held.

## Implemented Physical Laws And Closures

### Electronic And Molecular Laws

- Nonrelativistic radial Kohn-Sham DFT with LDA exchange/correlation.
- Spin-density LSDA and electron-configuration/Hund occupancy handling.
- Koelling-Harmon scalar-relativistic radial correction.
- Thomas-Fermi uniform-electron-gas kinetic energy.
- Dirac exchange and Chachiyo correlation fitted to Ceperley-Alder QMC,
  including spin scaling.
- Hartree-Fock Coulomb/exchange in RHF and UHF form.
- Closed-shell second-order Moller-Plesset correlation.
- Born-Oppenheimer nuclear motion on electronic potential-energy surfaces.
- Lennard-Jones 12-6, tabulated pair, and Morse pair potentials.
- Maxwell-Boltzmann velocity initialization, equipartition temperature,
  velocity-Verlet integration, virial pressure, and velocity-rescaling NVT.

### Bulk, Thermodynamic, And Phase Laws

- Jellium kinetic/exchange/correlation plus ionic Madelung and Ashcroft
  empty-core pseudopotential cold curves.
- Debye temperature, heat capacity, and internal energy; Dulong-Petit high-T
  limit.
- Ideal-gas density, pressure inputs, `Cp/Cv/gamma`, molecular rotational and
  vibrational heat capacity, Einstein-like gas energy segments, and zero-point
  energy.
- Gruneisen thermal expansion and temperature-dependent density.
- Lindemann melting estimate and isotropic Poisson-ratio shear reduction.
- Richards fusion entropy, Trouton vaporization entropy, and
  Clausius-Clapeyron pressure-dependent boiling.
- Piecewise phase enthalpy ladders, latent-heat plateaus, and lever-rule phase
  fractions.

`plasma` can appear as a phase/table label, but no plasma dynamics solver is
implemented.

### Continuum Mechanics Laws

- Uniform external Newtonian gravity.
- Cubic-spline SPH density and symmetric pressure/internal-energy operators.
- Monaghan artificial viscosity in the CPU SPH oracle.
- Phase-aware weakly-compressible EOS:
  - Tait/Cole pressure for condensed phases with a bounded tensile branch;
  - reduced linear gas pressure about phase rest density;
  - ideal-gas sound speed derived from `gamma R T / M`.
- MLS-MPM/APIC quadratic B-spline particle/grid transfers.
- Weakly-compressible fluid Cauchy stress `-pI`.
- Fixed-corotated hyperelastic solid stress with phase-derived Lame parameters.
- Newtonian deviatoric viscous stress plus closure/artificial viscosity.
- Cubic-barrier wall contact and material-interface elastic, damping, and
  inertial contact-pressure response.
- Reduced coherent-body Newton-Euler momentum updates and objective quaternion
  `SE(3)` pose integration from parallel member force/torque reductions. This
  is the implemented SOL-1 rigid-frame law, not SOL-2 collision/contact or
  SOL-3 solid-liquid coupling.
- Gas buoyancy from phase-density contrast in the CPU/reference demo path; the
  resident GPU mechanics path has no equivalent steam convection/buoyancy law.
- Hydrostatic pressure initialization/optional reduced SPH hydrostatic field.

### Thermal And Radiation Laws

- Energy-conserving pair conduction in the CPU and GPU thermal paths.
- Dirichlet heat exchange with six independently heated/cooled wall
  reservoirs and an explicit wall-energy ledger.
- Pairwise graybody radiative exchange with geometric view area.
- Stefan-Boltzmann exchange with the ambient environment.
- Planck blackbody spectrum integrated through CIE 1931 to sRGB for
  incandescence.

The implemented radiation laws cover thermal emission/exchange only. They are
not particle, neutron, gamma, or spectral radiation transport solvers.

### Chemistry Laws And Rules

- Exact formula atom counting and charge/atom-balanced stoichiometric rows.
- Active-metal plus liquid-water family producing hydroxide plus hydrogen.
- Metal/fuel oxidation, hydrogen/oxygen combustion, charge-balanced binary
  ionic synthesis, and a conservative binary-product fallback.
- Endpoint reaction enthalpy from RHF/UHF or the all-element reduced molecular
  solver when accepted; provisional heuristic signs remain explicitly marked.
- Contact/phase/temperature gating, limiting-reagent extent, mass-conserving
  reactant consumption, product/gas placement, and heat release.
- Sedenion periodic-table scope is implemented as a candidate/admission policy,
  not as a physical force or kinetics law.

### Optical Laws And Closures

- Drude and Drude-Lorentz metal dielectric/reflectance/skin-depth response.
- Scalar-relativistic interband oscillator generation from atomic orbitals.
- Beer-Lambert absorption/transmission for water and compounds.
- Rayleigh gas scattering and reduced Mie/Rayleigh droplet extinction.
- Saturation-pressure/supersaturation-derived reduced water-droplet optical
  state.
- Molecular electronic-band and band-gap absorption plus spectral-response to
  CIE/sRGB integration.
- Reduced molecular dynamic polarizability from STO-3G RHF occupied/virtual
  dipole response and Lorentz-Lorenz phase-density conversion to spectral
  refractive index. This response is explicitly scientifically unvalidated;
  it is not coupled-perturbed TDHF or periodic condensed-matter dielectric
  response.
- Fail-closed spectral refractive admission requires exact state identity,
  provenance, and distinct blue/green/red coverage. Native Fresnel/PBR ray
  bending uses those channels plus same-encoder geometric rear-surface depth;
  fixed/model display IOR cannot grant refractive authority.

These are optical/material closures and render inputs, not a Maxwell field
solver.

## Implemented Numerical Policies That Are Not Laws

The following behavior exists but must not be described as a fundamental law:

- global sound-speed/modulus scaling to satisfy the interactive CFL limit;
- CFL velocity limiting and compact-summary planning;
- liquid tensile/cavitation pressure floors;
- PBF-like density projection in the CPU SPH oracle;
- liquid velocity diffusion, wall damping, free-surface relaxation, and
  particle-separation passes;
- CPU SPH solid AABB grouping/support correction;
- phase-volume hysteresis, refinement-pressure masks, allocation admission,
  and Schroeder storage policies;
- renderer surface hysteresis and optical visibility gates.

## Law Graph Status

`createUlgResidentLawFamilyDescriptors()` publishes four named law families:

1. `ulg-mls-mpm-mechanics-law`
2. `ulg-thermal-phase-law`
3. `ulg-reaction-product-gas-law`
4. `ulg-pressure-interface-law`

Their underlying stages execute inside the resident pass DAG, but each
descriptor declares `runtime: metadata` and
`executableStatus: metadata-only-pass-dag-child`. None should be counted as an
independently promoted authoritative solver yet. The current promotion order
is mechanics, thermal/phase, reaction/product/gas, then pressure/interface.

Source: `createUlgResidentLawFamilyDescriptors()` in
`src/runtime/peercomputeBrowserResidentHost.js`.

## Live SPH Demo Law Toggles

`src/runtime/sphPhaseDemo.js` currently exposes these independently selectable
groups:

- Implemented and default-on: `mechanics`, `gravity`, `eos`, `pressure`,
  `thermal`, `reactions`, and `viscosity`.
- Pending and default-off: `surfaceTension`.
- Mechanics defaults to the resident `mlsmpm` path; `sph` selects the CPU
  reference path.

The UI/query keys are `lawmech`, `lawg`, `laweos`, `lawp`, `lawt`, `lawr`,
`lawv`, and `lawst` in `src/visualization/sphPhaseDemoMount.js`.

## Planned Or Missing Solvers And Laws

### Explicitly Missing In The Live Demo

- **Surface-tension curvature solver:** the property row and toggle exist, but
  `sphPhaseDemo.js` explicitly reports it as unimplemented. There is no CSF,
  curvature, pair-potential, or free-energy surface-tension force.
- **Broader gas-cell EOS closure:** the ideal-gas GPU lane is implemented;
  non-ideal mixtures, ionized/plasma gas closures, pressure-work energy
  feedback, and validation beyond the manufactured/metamorphic gate remain.
- **Production-admitted source-local GPU pressure path:** retained candidate,
  source-key, metadata, and force buffers now have direct GPU producer/consumer
  kernels. The normal scene still must remove its host row construction/upload
  edge and admit candidate-to-force-to-grid mutation through the production
  ComputeManager/StateManager lane.
- **Resident steam buoyancy/convection and pressure-work closure:** the CPU demo
  has a density-contrast buoyancy acceleration, but the resident GPU route
  lacks the equivalent gas rise, venting, and convection law.

### Coherent Solid Solver Status

- **SOL-0 - implemented kernel/authority suite; full acceptance open:** exact
  body/member/contact/shape schemas, PeerCompute ownership contracts, compact
  GPU body/global invariants, fail-close evidence, and bounded resident
  publication lifecycle exist. Remaining declared gates vary contact-proxy
  ordering, workgroup/dispatch partition, and admitted SS chart/level
  transitions.
- **SOL-1 - implemented reduced rigid-frame/direct-render suite; full
  acceptance open:** objective `SE(3)` pose, inertia/wrench integration,
  persistent same-device frames, indirect rest-mesh rendering, and a 120-step
  close-spaced native sequence execute. The same remaining metamorphic and
  SS-transition gates prevent checking the complete slice.
- **SOL-2 - missing:** solid-solid proxy contact with equal/opposite force and
  torque, plus derived friction/restitution behavior.
- **SOL-3 - missing:** solid-liquid mixed-cell velocity, pressure, and viscous
  traction reduced into body wrench.
- **SOL-4 - missing:** persistent material-space deformable surface, plasticity,
  and objective grid-crossing representation.
- **SOL-5 - missing:** admitted melting, solidification, fracture, and component
  merge/split topology.
- **SOL-6 - missing:** body-spanning levels, local charts/rebasing, far-field
  moments, and planetary/orbital mechanics.

The existing fixed-corotated particle elasticity and CPU solid-group contact
do not substitute for SOL-0/SOL-1 and do not satisfy SOL-2 through SOL-6.

### Adaptive MLS-MPM And Schroeder Gaps

- Per-particle support radius and normalized variable-support P2G/G2P.
- The `ocean-tiled-experimental` P2G policy has no tiled kernel and falls back;
  `resident-scatter` is the implemented backend.
- Bounded support tiers and conservation-safe general adaptive split/merge.
- Production integration of the implemented compact unique-node and
  hash-backed grid view through one activity-bounded, caller-owned two-level
  mechanics submission.
- Retained GPU conservation admission for the compact two-level route, plus
  measured tile expansion and capacity proportional to admitted activity.
- Complete cross-level affine/angular/internal-energy reflux invariants.
- General third-and-higher levels; the third level is currently on hold.
- Production refine/coarsen policy at interfaces, walls, reactions, and high
  gradients.
- Portable cross-peer rematerialization of adopted particle storage without
  raw `GPUBuffer` transfer.

### Chemistry And Phase Gaps

- Derived activation barriers and rate constants; current runtime primarily
  uses temperature/contact thresholds.
- NEB or dimer transition-state search and minimum-energy paths.
- General reaction-network competition, reversible equilibrium, catalysis,
  aqueous solvation, electrochemistry, and validated oxidation-state choice.
- Body/component-aware chemistry and exposed-area reaction quadrature; current
  products do not preserve coherent body/topology identity.
- Open-shell UMP2 and multireference bond-breaking chemistry.
- General species diffusion/mixing and closure-derived reaction kinetics.
- Nonequilibrium phase kinetics, homogeneous/heterogeneous nucleation,
  condensation/evaporation mass transfer, and resident droplet-size evolution.
  Current steam microphysics is a reduced optical state, not this solver.

### Electronic, Molecular, And Bulk Fidelity Gaps

- GGA/PBE and LDA+U or equivalent transition-metal treatment.
- Spin-orbit coupling and a full Dirac atomic solver beyond scalar KH.
- Larger molecular bases, polarization/diffuse functions, broader element
  coverage, and ECPs for heavy atoms.
- UMP2, CASSCF or spin-projected bond-breaking treatment.
- Analytic gradients/Hessians for molecular optimization and dynamics.
- Validated frequency-dependent molecular polarizability beyond the current
  independent-particle STO-3G RHF reduction (for example coupled-perturbed
  TDHF/response or validated excited-state transition moments), including
  consistent complex `n(lambda),k(lambda)`, condensed-phase local fields, and
  anisotropic/microstructure response.
- Periodic DFT with k-points, phonons, quasiharmonic free energy, and
  quantitative solid/liquid bulk closures, including periodic dielectric
  tensors and anisotropic optical response.
- The planned material-polytope response registry and adaptive property-fit
  pipeline.
- A high-fidelity stiff/shock EOS beyond the interactive weakly-compressible
  Tait/linear-gas model.
- General Gibbs/free-energy phase minimization beyond the ordered enthalpy
  ladder and local lever-rule response.

### GPU Material Resolver Gaps

- WebGPU radial Kohn-Sham, LSDA, KH, tridiagonal eigensolver, Hartree/XC, and
  SCF iteration kernels.
- WebGPU RHF/UHF/MP2/all-element molecular, geometry, vibration, and BOMD
  kernels.
- GPU-native element/formula property derivation, thermal graph construction,
  EOS row derivation, viscosity/transport closure derivation, reaction
  energetics, and optical spectral derivation.
- A general closure-law graph beyond table-linear/table-step sampling.
- Removal of main-thread/CPU table packing from the runtime material hot path.

### Frontier Laws With No ULG Solver

- Isotope inventory, radioactive decay, fission, fusion, daughter products,
  neutron/gamma/charged-particle transport, ionization, radiolysis, and energy
  deposition.
- Cherenkov source generation and spectral transport.
- General electromagnetic/Maxwell field solve, MHD, and kinetic PIC plasma.
- Long-range Newtonian N-body/Poisson gravity beyond constant local gravity and
  the partial Schroeder far-aggregate machinery.
- Relativistic orbital dynamics, GR/GRMHD, and the planned astrophysical law
  families.
- Finite-capacity conductive wall solids; current wall heat boundaries are
  fixed-temperature reservoirs.

MoonLab and Eshkol currently contribute readiness probes, reference artifacts,
and closure/handler contracts. Their staged magnetar MHD, PIC, radiation, and
relativistic records are not local ULG implementations of those solvers.

## Future Fusion, Space, And Supergalactic Solver Roadmap

The plans do cover these scales, but at different levels of specificity. This
matrix prevents a scale aspiration, external artifact, or buffer reservation
from being counted as a working ULG solver.

| Solver/law family | Current ULG status | Planned authority and scope |
| --- | --- | --- |
| Radioactive decay and isotope evolution | Missing; only a resolver-family contract exists. | Isotope inventories, decay channels/half-lives, stochastic or rate-equation kernels, daughter ledgers, and deposited-energy coupling. |
| Fission, fusion, and activation | Missing; no executable fusion/fission state evolution or reaction channel solver exists. | Validated channel/closure records, reactant/product inventories, neutron/gamma/charged-particle outputs, energy deposition, and explicit validation blockers. This is nuclear fusion, distinct from software/kernel fusion. |
| Radiation transport and Cherenkov emission | Thermal graybody exchange is implemented; transported radiation and Cherenkov are missing. | Transport/deposition grids, ionization/radiolysis coupling, and Cherenkov source rows derived from particle speed, medium IOR, and spectrum. |
| Electromagnetism and plasma | Missing; a `plasma` phase label and Schroeder far-field scalar proxy are not plasma dynamics. | Maxwell field evolution, charge/current transport, fluid MHD, kinetic PIC, and admitted coupling to material, chemistry, and thermal state. |
| General self-gravity | Constant local gravity is active; Schroeder far-aggregate gravity is partial and admission-gated. | Long-range Newtonian N-body/Poisson or aggregate gravity with conservation, error control, and chart-aware coupling. |
| Orbital and planetary dynamics | Missing as an authoritative solver; SOL-6 is a detailed plan. | Law-specific orbital root integration, spin/multipoles, body-fixed local charts, rebasing, and conservative exchange with refined surface/ocean/atmosphere lanes. |
| Relativistic orbital/gravity and GRMHD | Missing. Atomic scalar-relativistic KH is unrelated to spacetime dynamics. | Relativistic law nodes, orbital/field validation domains, and GR/GRMHD coupling where the astrophysical problem requires it. |
| Stellar and magnetar physics | No local ULG solver; Eshkol/MoonLab records are external readiness/reference artifacts. | Supervised closure/response services feeding admitted ULG law nodes for MHD/PIC/radiation/relativistic regimes without hidden state mutation. |
| Galactic and supergalactic evolution | **Architectural scale target only.** The Schroeder plan requires atomic-to-supergalactic chart/scale representation, but does not yet specify or implement a validated cosmological evolution solver. | First close sparse multilevel state, chart rebasing, long-range gravity, and distributed authority. A future concrete plan must still define any expansion, large-scale-structure, boundary/initial-condition, and validation laws before this can be called a solver. |

Primary plans are `plan/todo/webgpu-material-property-resolvers-plan.md` for
nuclear/radiation rows and transport, `plan/todo/overarching-completion-plan.md`
for frontier-law ordering, `plan/todo/sol-critic.md` for planetary/orbital
bodies, and `plan/todo/SS/schroeder-tree-and-algorithm-plan.md` for the
atomic-to-supergalactic representation target.

## Non-Solver Compute Paths

For completeness, ULG also implements the accepted source-local sparse render
field and native sparse-atlas extraction path, marching-cubes/tetrahedral
surface extraction, indirect draw metadata, optical lookup, compact
diagnostics, retained-buffer authority/admission, and PeerCompute stage
scheduling. The persistent resident-neighborhood builder/lane adds exact
five-word structural keys, radix/unique compaction, packed CSR, multichart/
multilevel support assignments, lease/epoch/device guards, and shared consumer
views for mechanics, contact, thermal, radiation, reaction,
pressure/interface, and coherent-solid kinematics. These are compute and data-
authority systems, not additional physical laws.

`FIELD-0` and the native surface resource-lifecycle repair are accepted. The
worktree also implements generation-owned packed normals, alpha-one unblended
depth-writing native PBR, the native opaque background, exact spectral optical
admission, same-encoder `depth32float` geometric thickness, and bounded two-in-
flight presentation. Those are renderer/authority mechanisms, not new physical
laws, and SURF-4/OPTICS acceptance remains open for manufactured/metamorphic
and fresh standard-matrix evidence. The resident neighborhood exists and its
focused lane/consumer probes pass, but `NEIGH-0`/`LANE-0` remain integration-
open at the production pressure and StateManager edge. GPU timestamp
instrumentation is likewise diagnostic evidence, not another solver.
