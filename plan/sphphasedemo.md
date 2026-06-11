# SPH Phase Demo Plan - Ice On Molten Iron In A Sealed Box

Date: 2026-06-08 AKDT
Updated: 2026-06-10 AKDT

## Purpose

Build a first-principles ULG demo that simulates a 1 m ice cube resting on a
1 m molten iron cube inside a sealed, transparent 10 m box initially filled
with air at 1 atm and -40 F. Each of the six box faces has its own absolute
temperature control, exposed as one slider per side. The visible target is:

1. Molten iron glows because its temperature and emissivity produce thermal
   radiation.
2. Ice melts into water and steam because heat, phase equilibrium, and latent
   heat demand it.
3. Steam raises pressure inside the sealed box when vapor mass and gas
   temperature increase.
4. Iron cools, solidifies, and eventually becomes a cold gray solid while water
   recondenses/freezes around it if the modeled heat sinks make that physically
   possible.

The demo must not fake the outcome with scripted phase toggles, arbitrary color
ramps, arbitrary material constants, or hard-coded pressure curves. Every
visible behavior and every material property must come from the closure, field,
carrier, thermodynamic, radiation, mechanical, and validation chain.

Implementation checkpoint, 2026-06-10 AKDT: the live browser demo now uploads
closure-derived optical lookup rows, SPH particle state/thermo rows, and
MLS-MPM mechanics rows into WebGPU storage buffers. The mechanics buffer holds
`F`, `C`, `J`, rest volume, solid flag, and status for each macro-particle.
It also runs a first WebGPU mechanics prediction kernel from those resident rows
and accepts the result only after CPU parity. A first gather-form WebGPU P2G
grid projection now also writes grid mass/momentum rows from those resident
particles with CPU parity. The next required implementation step is still to
replace the CPU-authoritative MLS-MPM carrier with WebGPU stress projection,
grid update/contact/wall handling, G2P, and heat/phase kernels.

## Non-Negotiables

- The 10 m box demo is a macroscopic SPH / continuum simulation. It cannot
  solve the literal many-body Schrodinger equation for every molecule and atom
  in the box. "First principles" here means ULG derives and validates continuum
  closures from lower-level Schrodinger / quantum-statistical / molecular
  simulations, then uses those closures in a conservative carrier runtime.
- Material properties, EOS, SPH dynamics, phase changes, pressure, and glow
  must stay unvalidated / blocked until their evidence artifacts exist.
- Color, opacity, viscosity, density, heat capacity, conductivity, bulk modulus,
  Young's modulus, shear modulus, Poisson ratio, yield behavior, and phase
  behavior must be derived from low-level validated closures. They cannot be
  tuned per demo to make the scene look right.
- The user must be able to set the macro-particle count. Each SPH particle
  represents a computed number of H2O molecules, Fe atoms, or air molecules.
  Particle count changes resolution and convergence error; it must not change
  the underlying material law.
- If the specified geometry and boundary conditions cannot produce the expected
  final state, the successful result is a failing physics preflight that says
  why. The renderer must not force a cold iron lump or ice shell when the energy
  budget does not support it.
- The current ULG substrate is closure/provenance/operator evidence only:
  closure registry, table descriptors, carrier topology, edge messages, field
  observers, field-closure sampling, and closure invalidation. This demo must
  extend that substrate; it must not pivot to a demo-only SPH shortcut.

## Scenario Definition

| Parameter | Required value |
| --- | --- |
| Scenario id | `sph-phase-ice-on-molten-iron` |
| Box | Transparent sealed cube, 10 m edge, 1000 m3 volume |
| Initial gas | Air mixture at 1 atm, -40 F / -40 C / 233.15 K |
| Boundary | Rigid, sealed mass boundary with six independent thermal sides |
| Wall temperature controls | `xMin`, `xMax`, `yMin`, `yMax`, `zMin`, `zMax`, each an absolute temperature in K |
| Ice cube | 1 m edge, initially resting on iron, initial temperature from config |
| Iron cube | 1 m edge, molten, initial temperature above Fe liquidus |
| Particle controls | User-selected macro-particle counts for H2O, Fe, and gas, plus total budget |
| Gravity | Earth gravity unless scenario config explicitly changes it |
| Visualization | Three.js/WebGPU particle and volume rendering, no scripted phase visuals |

The boundary condition is critical. A sealed box prevents mass exchange, not
heat exchange. This demo should not use a single ambient-temperature shortcut.
Each wall face is a fixed-temperature reservoir selected by the user. The
runtime must compute heat flux into or out of each side separately and report
the per-side energy ledger. If all sides are adiabatic or set too warm, the
final cold gray iron with ice around it is probably impossible for the requested
1 m cubes.

## Energy Feasibility Gate

Before running particles, implement a deterministic thermodynamic preflight for
the scenario:

- Estimate iron mass from the liquid/solid Fe density closure.
- Estimate ice mass from the H2O ice density closure.
- Integrate enthalpy for:
  - molten Fe cooling to its melting point,
  - Fe latent heat of fusion,
  - solid Fe cooling below melting,
  - ice warming to 0 C,
  - H2O latent heat of fusion,
  - liquid water warming,
  - H2O latent heat of vaporization,
  - vapor/gas mixture heating,
  - heat exported to or imported from each absolute-temperature wall.
- Emit a `peercompute.ulg.thermodynamic-preflight.v0` artifact before the demo
  is allowed to claim the target final state.

Order-of-magnitude expectation for the requested dimensions:

- 1 m3 ice is about 917 kg.
- 1 m3 molten iron is roughly 6900-7100 kg.
- Cooling and solidifying that much iron from a molten temperature down near
  freezing can release about 7 GJ.
- Warming, melting, boiling, and vaporizing all of the ice is about 2.8 GJ,
  before additional steam heating.

That means an adiabatic sealed box should not be expected to end as cold gray
iron with ice around it. The demo can still reach that outcome if the six
fixed-temperature walls conduct enough heat out of the box over enough simulated
time, but the energy sink must be explicit and audited per wall.

## First-Principles Chain

### 1. Quantum / Molecular Inputs

MoonLab and/or lower-level reference solvers must produce or import validated
microphysical evidence for:

- H2O electronic / molecular potential information sufficient to derive water,
  ice, and vapor thermodynamics.
- Fe cohesive, electronic, and lattice information sufficient to derive solid
  and liquid thermodynamics.
- Elastic and transport response sufficient to derive bulk modulus, Young's
  modulus, shear modulus, Poisson ratio, viscosity, thermal expansion, sound
  speed, plastic/yield behavior, and phase-dependent stress response.
- Optical / radiative response sufficient to derive color, emissivity,
  absorption, scattering, and temperature-dependent glow for Fe, H2O phases,
  and steam/air mixtures.
- Air species properties for N2, O2, Ar, CO2 trace handling if included, and
  H2O vapor mixing.
- Interface evidence for H2O/Fe heat transfer, wetting, steam-film formation,
  and nucleation if those mechanisms are represented.
- Reference hashes, tolerances, validity envelopes, and uncertainty summaries.

Required artifact families:

- `moonlab.ulg.h2o-microphysics-reference.v0`
- `moonlab.ulg.fe-microphysics-reference.v0`
- `moonlab.ulg.air-mixture-reference.v0`
- `moonlab.ulg.interface-reference.v0`
- `moonlab.ulg.mechanical-response-reference.v0`
- `moonlab.ulg.optical-response-reference.v0`

Until those exist and pass, downstream artifacts must carry
`scientificValidation = false` and `fullPhysicsValidation = false`.

### 2. Closure Derivation

Eshkol must compile material closure kernels from the microphysical references.
These closures are the only source of material behavior in the SPH demo.

Required closure groups:

- H2O phase / EOS closure:
  - density as a function of temperature, pressure, and phase fraction,
  - enthalpy and internal energy,
  - Gibbs / Helmholtz free energy,
  - saturation vapor pressure,
  - latent heat of fusion and vaporization,
  - heat capacity,
  - thermal conductivity,
  - viscosity,
  - surface tension,
  - elastic response for ice including bulk modulus, Young's modulus, shear
    modulus, Poisson ratio, thermal expansion, and fracture/yield scope if
    represented.
- Fe phase / EOS closure:
  - solid/liquid free energy,
  - liquidus/solidus behavior,
  - enthalpy and internal energy,
  - density,
  - heat capacity,
  - thermal conductivity,
  - viscosity for liquid Fe,
  - bulk modulus, Young's modulus, shear modulus, Poisson ratio, yield/plastic
    response for solid Fe,
  - surface tension for liquid Fe,
  - emissivity / spectral opacity needed for glow.
- Air / steam mixture closure:
  - pressure from mixture composition, density, and temperature,
  - gas heat capacity,
  - diffusion / viscosity,
  - humidity, condensation, and saturation handling.
- Wall/environment closure:
  - fixed-temperature face ids,
  - wall heat capacity / conductivity if walls are modeled as finite solids,
  - Dirichlet heat-transfer boundary coupling for each side.
- Mechanical closure:
  - bulk modulus,
  - Young's modulus,
  - shear modulus,
  - Poisson ratio,
  - viscosity,
  - yield/plasticity and fracture scope,
  - speed of sound,
  - phase-dependent stress response.
- Optical / rendering closure:
  - spectral emissivity,
  - absorption and scattering coefficients,
  - refractive index / optical constants when needed,
  - temperature-to-spectral-radiance mapping,
  - RGB display transform provenance.

### 2A. Generalized Spectral Optical / PBR Closure

The optical/rendering closure must apply to every element, molecule, compound,
and mixture through one generalized pipeline. Water and gold are not allowed to
remain renderer special cases. They can have distinctive behavior only because
their derived spectra are distinctive.

Required derivation chain:

1. Resolve formula, element, phase, density, temperature, and composition.
2. Derive or load lower-level electronic and vibrational evidence:
   - element Drude/intraband response from derived conduction-electron density,
   - element interband response from localized atomic transitions now and
     periodic band / Brillouin-zone transitions in the full solver,
   - molecular electronic absorption from excited-state or transition-dipole
     evidence,
   - molecular vibrational/overtone absorption from normal modes and
     anharmonicity,
   - scattering and condensed-phase broadening from MD/statistical evidence.
3. Build a spectral optical response table:
   - wavelengths,
   - reflectance,
   - transmittance,
   - absorption coefficient,
   - scattering coefficient,
   - complex dielectric or `n,k` samples when available,
   - validity domains and provenance refs.
4. Derive display/PBR parameters from the same spectral table:
   - base color,
   - metalness,
   - roughness source/provenance,
   - opacity,
   - transmission,
   - IOR,
   - attenuation color/distance,
   - emissive coupling to the radiation closure,
   - vertex-color policy.
5. Cache the derived table by material identity, phase, validity domain, and
   input artifact hash.
6. Upload the compact spectral/PBR table to GPU buffers and sample it by
   material id + phase id during rendering.

Renderer rules:

- Three.js `MeshPhysicalMaterial` is allowed as an interim PBR display layer,
  but its parameters must come from the optical closure record.
- Surface particle colors may visualize diagnostics only when the optical
  closure explicitly marks `vertexColorPolicy = particle-diagnostic`.
- Conductive materials must use conductor PBR parameters (`metalness = 1`,
  opaque skin-depth transmission, spectral base color / complex Fresnel
  approximation).
- Transparent molecular phases must use transmission/refraction plus
  Beer-Lambert attenuation from the generic molecular spectrum, not a fixed
  blue water color.
- Steam/cloud visibility requires a scattering/condensation closure. Pure
  water vapor may remain nearly invisible if the spectrum and phase state say
  so.
- Missing optical evidence must block or visibly degrade with provenance; it
  must not fall back to arbitrary color/opacity.

GPU-resident requirement:

- Material/phase optical records are resolved and cached before the hot loop.
- The hot loop samples WebGPU buffers/textures, not JavaScript material
  resolvers.
- Closure-domain exits are detected into compact GPU status buffers.
- Candidate optical closures may be derived asynchronously, validated on the
  CPU control plane, then swapped into resident GPU bind groups at safe frame
  boundaries.

Current implementation checkpoint (2026-06-10):

- The first optical/PBR GPU buffer ABI is implemented:
  `peercompute.ulg.optical-gpu-table.v0` and
  `peercompute.ulg.optical-gpu-buffer-set.v0`.
- The first optical/PBR GPU lookup ABI is implemented:
  `peercompute.ulg.optical-gpu-lookup.v0`, with query/output rows and an
  `opticalLookupWgsl` material/phase lookup kernel.
- The SPH renderer now builds a packed optical table for active material/phase
  surface batches and exposes it through `getOpticalGpuTable()`.
- The SPH renderer now also builds active material/phase lookup queries and
  CPU-reference lookup outputs through `getOpticalGpuLookup()`, using the same
  lookup ABI that can dispatch on WebGPU.
- The live SPH overlay now schedules optional browser WebGPU execution for that
  lookup through `peercompute.ulg.optical-gpu-lookup-execution.v0`, accepts the
  WebGPU output only after CPU parity
  (`peercompute.ulg.optical-gpu-lookup-parity.v0`), and otherwise keeps the CPU
  reference output.
- The accepted lookup output is decoded into
  `peercompute.ulg.optical-gpu-draw-state.v0` rows and applied to the matching
  visible continuous surfaces by active surface key.
- The first SPH particle GPU buffer ABI/runtime packer is implemented:
  `peercompute.ulg.sph-gpu-particle-buffer.v0` and
  `peercompute.ulg.sph-gpu-particle-buffer-set.v0`. It packs CPU-authored
  particle position, velocity, mass, internal energy, material id, closure phase,
  temperature, rest density, phase fractions, smoothing length, and represented
  entity count into f32x4-aligned WebGPU storage-buffer rows.
- The live SPH overlay now builds that particle snapshot during particle sync,
  exposes it through `getSphGpuParticleState()`, and optionally uploads it to
  WebGPU storage buffers through `getSphGpuParticleUpload()`.
- The first MLS-MPM mechanics-state GPU buffer ABI/runtime packer is implemented
  for deformation gradient, affine velocity field, volume ratio, rest volume,
  solid flag, and status:
  `peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`.
- Each packed table contains closure-derived PBR material records plus spectral
  sample rows suitable for WebGPU storage-buffer upload.
- The runtime can sample packed records by material/phase id through a CPU
  parity path or a WebGPU dispatch helper.
- Material ids are stable for GPU residency: elements use atomic number, while
  compounds use deterministic f32-exact hashed ids.
- The demo still renders through Three.js `MeshPhysicalMaterial`; the draw state
  can now come from accepted lookup output, but a WebGPU renderer does not yet
  consume those buffers directly. The particle GPU buffers are uploaded as a
  scene snapshot but not yet consumed by a GPU mechanics loop. MLS-MPM mechanics
  state is pack/upload ready but not yet wired into the live scene.

Validation remains false until quantitative optical-response evidence exists.
The current scalar-relativistic atomic Drude-Lorentz path is useful reference
evidence for elements but is not the final periodic band solver. The current
O-H overtone path is useful reference evidence for water but must be folded
into the generic molecular vibrational pipeline rather than kept as a renderer
exception.

### 2B. Nuclear, Decay, Fission, Fusion, And Ionizing-Radiation Closures

The material pipeline must distinguish chemical/electronic material identity
from isotope and nuclear state. Element symbols alone are insufficient once
radioactive decay, neutron activation, fission, fusion, or ionizing radiation
are in scope. A particle may represent many atoms or molecules, and therefore
must carry isotope inventories when nuclear physics is enabled.

Required nuclear derivation chain:

1. Resolve isotope composition for each material:
   - nuclide id `(Z,A,metastable state)`,
   - abundance / particle inventory,
   - nuclear mass and binding energy,
   - spin/parity and energy levels when needed by reaction channels,
   - provenance and validity of each nuclear datum.
2. Derive radioactive decay closure:
   - allowed decay modes from mass-energy differences and selection rules,
   - half-life / decay constant from nuclear matrix elements or validated
     reference evidence,
   - branching ratios,
   - emitted alpha, beta, gamma, neutrino, neutron, or daughter recoil spectra,
   - daughter isotope production and heat deposition.
3. Derive fission closure:
   - fissionability and barrier evidence,
   - spontaneous and neutron-induced fission rates / cross sections,
   - neutron-energy-dependent channels,
   - fragment yield distributions,
   - prompt and delayed neutron spectra,
   - prompt and delayed gamma spectra,
   - fission energy partition into fragments, neutrons, photons, beta decays,
     neutrinos, and local heat.
4. Derive fusion closure:
   - reaction channels from isotope pairs,
   - Coulomb barrier / tunneling probability,
   - plasma-screening and temperature/density dependence when applicable,
   - cross sections or reactivities with provenance,
   - product isotope and radiation spectra,
   - deposited versus escaping energy accounting.
5. Derive ionizing-radiation transport closure:
   - alpha/beta charged-particle stopping power,
   - gamma opacity / Compton / photoelectric / pair-production terms,
   - neutron scattering, absorption, moderation, and activation terms,
   - secondary radiation production,
   - energy deposition and dose/heat source terms.

Runtime handling requirements:

- Nuclear state is optional for ordinary SPH material demos, but when enabled
  it must be conserved and evolved from isotope inventories, not inferred from
  display material names.
- Decay/reaction events update isotope inventories, emitted-radiation fields,
  internal energy, gas/species products if applicable, and provenance ledgers.
- Ionizing radiation is not the same as thermal glow. Thermal incandescence
  remains the optical/radiation closure; nuclear photons and particles require
  radiation-transport source terms and deposition kernels.
- Fission/fusion must be blocked outside their validated temperature, density,
  neutron spectrum, and isotope domains. A demo may show a blocker/status
  artifact, but it must not invent reaction rates.
- CPU control-plane code may validate nuclear artifacts and compile/upload
  tables. Per-step isotope updates, reaction-rate sampling, transport, and heat
  deposition should be WebGPU-resident once the GPU runtime path exists.

Required additional artifact families:

- `moonlab.ulg.nuclear-structure-reference.v0`
- `moonlab.ulg.nuclear-cross-section-reference.v0`
- `moonlab.ulg.decay-chain-reference.v0`
- `moonlab.ulg.fission-reference.v0`
- `moonlab.ulg.fusion-reference.v0`
- `moonlab.ulg.ionizing-radiation-transport-reference.v0`
- `eshkol.ulg.isotope-inventory-closure.v0`
- `eshkol.ulg.radioactive-decay-closure.v0`
- `eshkol.ulg.fission-closure.v0`
- `eshkol.ulg.fusion-closure.v0`
- `eshkol.ulg.ionizing-radiation-closure.v0`

For the ice/iron SPH phase demo these nuclear closures are normally inactive.
They become required when a scenario introduces radioactive isotopes, neutron
fields, plasma fusion conditions, fissile materials, activation, or ionizing
radiation heat sources. Validation remains false until quantitative nuclear
benchmarks and conservation ledgers exist.

Required artifact families:

- `eshkol.ulg.material-closure.v0`
- `eshkol.ulg.eos-closure.v0`
- `eshkol.ulg.phase-equilibrium-closure.v0`
- `eshkol.ulg.transport-closure.v0`
- `eshkol.ulg.mechanical-closure.v0`
- `eshkol.ulg.optical-closure.v0`
- `eshkol.ulg.radiation-closure.v0`
- `eshkol.ulg.isotope-inventory-closure.v0`
- `eshkol.ulg.radioactive-decay-closure.v0`
- `eshkol.ulg.fission-closure.v0`
- `eshkol.ulg.fusion-closure.v0`
- `eshkol.ulg.ionizing-radiation-closure.v0`
- `eshkol.ulg.wall-boundary-closure.v0`

Each closure must include:

- content-addressed input refs,
- producer commit and toolchain metadata,
- validity domain for temperature, pressure, density, and composition,
- units,
- derivative support,
- interpolation layout and WGSL/WASM descriptors,
- uncertainty and tolerance fields,
- explicit false overclaim guards until validated.

### 3. ULG Runtime Consumption

ULG must consume the closures through `ClosureRegistry`, invalidate and rerun
when a state leaves a closure domain, and emit provenance for every derived
field used by the carrier runtime.

Required runtime capabilities:

- Material registry resolving H2O, Fe, air, wall, and interface closures by
  material id and validity domain.
- Mechanical property sampling for bulk modulus, Young's modulus, shear
  modulus, Poisson ratio, viscosity, yield/plasticity, thermal expansion, and
  sound speed.
- Optical/radiation property sampling for temperature-dependent color,
  emissivity, absorption, scattering, and opacity.
- Thermodynamic state conversion:
  - internal energy <-> temperature,
  - density/pressure from EOS,
  - phase fractions from free-energy minimization,
  - entropy/enthalpy residual checks.
- Conservative source terms:
  - heat conduction,
  - contact heat transfer,
  - convection,
  - radiation,
  - latent heat,
  - pressure work,
  - gravity and contact forces,
  - per-side fixed-temperature wall heat exchange.
- Closure-domain exit handling:
  - halt or subcycle the affected region,
  - emit refresh/invalidation artifact,
  - never extrapolate silently outside a closure validity envelope.

### 4. Carrier Solver

The SPH carrier must evolve user-configurable macro-particles using closures;
it must not encode material behavior directly. A particle is a coarse-grained
representative parcel, not one molecule/atom. It carries mass plus a computed
`representedEntityCount`:

- H2O particles represent many water molecules.
- Fe particles represent many iron atoms.
- Air/steam particles or gas cells represent many gas molecules by species.

The represented count is derived from total material mass, molar mass, species
composition, and the user-selected particle allocation. Changing particle count
changes resolution, smoothing length, and convergence error only; material
properties remain closure-derived.

Particle state fields:

- position, velocity, mass, smoothing length,
- represented entity count,
- material id and species composition,
- density, pressure,
- internal energy / enthalpy,
- temperature,
- phase fractions,
- stress, strain, viscosity, modulus, yield/plasticity, and sound-speed terms,
- radiation source terms,
- provenance refs for closures sampled during the step.

Required solver features:

- Deterministic neighbor search using the existing spatial hash / edge-message
  substrate.
- SPH density and gradient operators with convergence tests.
- Conservative momentum and energy update.
- Multi-material contact handling for H2O/Fe/air/wall interfaces.
- Six fixed-temperature boundary faces:
  - `xMin`,
  - `xMax`,
  - `yMin`,
  - `yMax`,
  - `zMin`,
  - `zMax`.
  Each face is a user-set absolute-temperature reservoir. Heat flux and energy
  exchange must be integrated and reported independently per face.
- Phase-fraction update from thermodynamic equilibrium, not a visual threshold.
- Steam/water/ice mass exchange preserving H2O mass exactly within tolerance.
- Solid Fe behavior after freezing, either as an SPH solid model or a
  compatible MPM/rigid aggregate layer with the same conservation artifacts.
- Adaptive resolution near the ice/iron interface so the 1 m cubes fit inside
  the 10 m box without requiring molecular particle counts.
- Particle-count controls for total particles and per-material allocation.
- Convergence reporting across at least two particle-count settings before the
  demo can claim stable behavior.

### 4A. Particle Resolution Controls

The UI must expose particle controls as simulation-resolution inputs:

- total macro-particle budget,
- H2O particle count,
- Fe particle count,
- gas particle or gas-cell count,
- optional adaptive refinement budget near the H2O/Fe interface,
- displayed represented molecules/atoms per particle for each material.

The runtime must derive:

- H2O molecules per H2O particle from ice/water/steam mass and molar mass,
- Fe atoms per Fe particle from iron mass and molar mass,
- gas molecules per gas particle/cell from pressure, temperature, volume, and
  gas mixture EOS.

Acceptance requires a convergence artifact showing whether key outputs change
with particle count:

- peak pressure,
- total vapor mass,
- final Fe solid fraction,
- wall heat export per side,
- total energy residual,
- H2O and Fe mass residuals.

### 4B. Six Wall Temperature Controls

The demo must expose one slider per box side:

- `xMinWallTemperatureK`,
- `xMaxWallTemperatureK`,
- `yMinWallTemperatureK`,
- `yMaxWallTemperatureK`,
- `zMinWallTemperatureK`,
- `zMaxWallTemperatureK`.

Sliders may display Fahrenheit/Celsius labels for usability, but the scenario
artifact and runtime must store absolute Kelvin values. A side set to 233.15 K
is a fixed -40 F thermal reservoir. Different sides may be set to different
temperatures, and the solver must not collapse them into one ambient field.

The wall energy report must include:

- heat flux by side,
- cumulative energy exchanged by side,
- wall-side closure refs,
- wall-temperature slider value,
- whether the boundary is fixed-temperature, finite-capacity, or adiabatic.

### 5. Sealed-Box Gas And Pressure

Steam pressure must emerge from mass, energy, volume, and EOS:

- Track air species and H2O vapor mass in the fixed 1000 m3 box.
- Compute pressure from the air/steam mixture closure per cell or control
  volume.
- Condense vapor when local temperature/partial pressure crosses saturation.
- Couple pressure forces back onto SPH particles and walls.
- Report total pressure, partial pressures, vapor mass, condensed mass, and
  uncertainty each frame.

Expected behavior:

- Pressure should rise when enough H2O enters vapor phase in the sealed volume.
- Pressure may later fall if vapor condenses/freezes on cold walls or cold Fe.
- The test should assert the physically computed trend for the configured
  boundary condition, not a hard-coded monotonic pressure curve.

### 6. Radiation And Glow

The glowing iron must be rendered from temperature and radiation closure data:

- Compute spectral radiance using blackbody or graybody radiation with Fe
  emissivity supplied by closure.
- Integrate spectral radiance into display RGB through a documented color
  matching transform.
- Account for cooling: as Fe temperature drops below visible incandescence, the
  glow naturally fades to gray.
- Water/steam opacity and scattering can be approximate at first, but must be
  derived from closure fields and tagged with validation scope.

No fixed "molten iron orange" material is acceptable as the source of truth.
The renderer may cache a palette only if it is generated from the radiation
closure and temperature domain.

## Exact Implementation Work

### ULG ABI / Schemas

Add schema builders under `ulg-gpu-abi/src/index.js` and JSON schemas under
`ulg-gpu-abi/src/schemas/`:

- `material_closure.schema.json`
- `eos_closure.schema.json`
- `phase_equilibrium_closure.schema.json`
- `transport_closure.schema.json`
- `mechanical_closure.schema.json`
- `optical_closure.schema.json`
- `radiation_closure.schema.json`
- `wall_temperature_boundary.schema.json`
- `particle_resolution_config.schema.json`
- `particle_convergence_report.schema.json`
- `thermodynamic_preflight.schema.json`
- `sph_phase_scenario.schema.json`
- `sph_phase_simulation_artifact.schema.json`
- `conservation_report.schema.json`

Required tests:

- Schema validation for every new artifact.
- Overclaim guards that reject `materialValidation`, `eosValidation`,
  `mechanicalValidation`, `opticalValidation`,
  `phaseChangeValidation`, `sphValidation`, `scientificValidation`, or
  `fullPhysicsValidation` unless the required evidence refs are present.
- Unit and dimensional consistency checks for closure tables.
- Rejection of particle-count configs that change total material mass when
  resolution changes.
- Rejection of wall-boundary configs that omit any of the six side
  temperatures.

### ULG Runtime Modules

Add or extend:

- `src/runtime/material/MaterialRegistry.js`
- `src/runtime/material/thermoState.js`
- `src/runtime/material/eos.js`
- `src/runtime/material/phaseEquilibrium.js`
- `src/runtime/material/transport.js`
- `src/runtime/material/mechanical.js`
- `src/runtime/material/radiation.js`
- `src/runtime/material/optical.js`
- `src/runtime/material/thermodynamicPreflight.js`
- `src/runtime/sph/particleResolution.js`
- `src/runtime/sph/sphState.js`
- `src/runtime/sph/sphOperators.js`
- `src/runtime/sph/sphPhaseCarrier.js`
- `src/runtime/sph/sphConservation.js`
- `src/runtime/sph/sealedBoxGas.js`
- `src/runtime/sph/wallBoundary.js`
- `src/runtime/sph/wallTemperatureControls.js`

Reuse and extend current primitives:

- `src/runtime/ClosureRegistry.js`
- `src/runtime/carrierRuntime.js`
- `src/runtime/spatialHash.js`
- `src/runtime/edgeMessages.js`
- `src/runtime/observers.js`
- `src/runtime/fieldClosureSamples.js`
- `src/runtime/webgpuCarrierKernel.js`

Required behavior:

- All material sampling goes through `ClosureRegistry`.
- Any closure-domain exit emits the existing refresh/invalidation pathway.
- All step artifacts include conservation, closure refs, validity status, and
  non-overclaim flags.
- CPU reference remains authoritative until WebGPU parity is proven.

### ULG Worker / Demo Runtime

Extend:

- `src/services/ulgRuntime.worker.js`
- `src/runtime/demoRuntime.js`
- `src/runtime/artifactSummary.js`
- `src/main.js`
- `tests/demo.e2e.mjs`

Required features:

- New task kind: `simulation.sph-phase.step`.
- New browser API:
  - `window.__ulgDemo.runSphPhaseDemoPreflight()`
  - `window.__ulgDemo.runSphPhaseDemoStep()`
  - `window.__ulgDemo.runSphPhaseDemo()`
- Six independent wall-temperature sliders:
  - left / `xMin`,
  - right / `xMax`,
  - bottom / `yMin`,
  - top / `yMax`,
  - back / `zMin`,
  - front / `zMax`.
- Particle-count controls:
  - total macro-particle budget,
  - H2O macro-particles,
  - Fe macro-particles,
  - gas macro-particles/cells,
  - adaptive refinement budget.
- New visible status rows:
  - preflight pass/fail,
  - pressure,
  - water mass by phase,
  - iron solid fraction,
  - represented molecules/atoms per macro-particle,
  - material closure status for optical/mechanical properties,
  - six wall temperatures,
  - total energy residual,
  - wall heat export per side,
  - closure invalidation status.
- The UI can include a launch button, but it must report readiness blockers
  before allowing a full-physics claim.

### PeerCompute / Multiscale

PeerCompute should host the heavier demo and distributed execution once ULG can
emit the required artifacts.

Expected work in `/home/cos/projects/peercompute`:

- Add scenario config under `demos/multiscale` for
  `scenario=sph-phase-ice-on-iron`.
- Extend Multiscale ingestion to accept ULG `sph_phase_simulation_artifact`
  packets and material closure summaries.
- Add compute placement for SPH tiles, gas cells, closure derivation tasks, and
  renderer updates through existing WorkerSupervisor / ComputeManager paths.
- Add diagnostics panels for pressure, phase fractions, closure validity,
  conservation residuals, particle resolution/convergence, represented
  molecules/atoms per particle, six wall-temperature settings, and per-side
  wall heat export.
- Keep all scientific readiness gates false until ULG artifacts prove the
  material/EOS/SPH/phase stack.

Likely files:

- `demos/multiscale/src/simulation/multiscaleModel.js`
- `demos/multiscale/src/compute/*`
- `demos/multiscale/src/visualization/*`
- `demos/multiscale/tests/multiscaleModel.test.mjs`
- `peercompute/tests/unit/serviceOrchestration.test.js`

### Eshkol

Expected work in `/home/cos/projects/eshkol`:

- Compile material closure kernels to WASM and WGSL-compatible table layouts.
- Support tensor/closure memory layouts for multi-output thermodynamic closures.
- Emit closure artifacts with validity envelopes, derivative outputs, and
  non-stub production handler evidence.
- Add fixtures for H2O, Fe, air, H2O/Fe interface, wall boundary, mechanical,
  optical, and radiation closures.
- Ensure mechanical closures expose bulk modulus, Young's modulus, shear
  modulus, Poisson ratio, viscosity, yield/plasticity scope, thermal expansion,
  and sound speed where applicable.
- Ensure optical closures expose spectral emissivity, absorption/scattering, and
  display-transform provenance for material color.
- Keep smoke-only closures separated from scientific production closures.

### MoonLab

Expected work in `/home/cos/projects/moonlab`:

- Produce microphysical reference contracts for H2O, Fe, air species, and
  H2O/Fe interface behavior.
- Produce or import reference contracts for mechanical response and optical /
  radiative response, including the low-level evidence used to derive material
  constants and visible color.
- Provide hashes, tolerances, uncertainty, and provenance.
- Distinguish reduced reference evidence from full-fidelity quantum coverage.
- Keep WebGPU parity and full-physics readiness explicit.

## Validation And Tests

### Unit Tests

Add focused ULG tests:

- `tests/materialClosure.test.mjs`
- `tests/thermodynamicPreflight.test.mjs`
- `tests/phaseEquilibrium.test.mjs`
- `tests/mechanicalClosure.test.mjs`
- `tests/opticalClosure.test.mjs`
- `tests/particleResolution.test.mjs`
- `tests/sphOperators.test.mjs`
- `tests/sphPhaseCarrier.test.mjs`
- `tests/sealedBoxGas.test.mjs`
- `tests/wallTemperatureBoundary.test.mjs`
- `tests/radiationClosure.test.mjs`

Required assertions:

- Preflight computes the requested 10 m / 1 m / 1 atm / -40 F scenario with
  correct units.
- Adiabatic case refuses to claim the final cold-iron/ice-around-it outcome if
  the enthalpy budget does not support it.
- Wall-cooled case reports the exact energy exported/imported by each wall side.
- Each of the six wall sliders maps to an independent absolute Kelvin boundary.
- Wall heat flux and cumulative energy are reported independently per side.
- Particle-count controls preserve total material mass while changing
  represented molecules/atoms per macro-particle.
- Changing macro-particle count does not alter closure-derived material
  constants.
- Mechanical properties come from closures: bulk modulus, Young's modulus,
  shear modulus, Poisson ratio, viscosity, thermal expansion, and yield/plastic
  scope where represented.
- Optical/color properties come from closures: spectral emissivity, absorption,
  scattering, opacity, and display-transform provenance.
- H2O mass is conserved across ice, liquid, vapor, and condensed/frozen deposits.
- Fe mass is conserved across liquid and solid fractions.
- Total energy is conserved within tolerance when wall heat export and radiation
  are included.
- Pressure comes from gas mixture EOS and fixed volume.
- Phase fractions come from closure/free-energy minimization.
- Radiation RGB is generated from spectral/graybody temperature output.
- Closure-domain exits trigger invalidation and halt/subcycle rather than
  silent extrapolation.

### Integration Tests

Add ULG and PeerCompute integration coverage:

- Browser e2e preflight:
  - scenario loads,
  - preflight artifact appears,
  - all six wall-temperature sliders are visible and reflected in the scenario
    artifact,
  - particle-count controls update represented molecule/atom counts without
    changing total mass,
  - readiness blockers are visible if closures are missing.
- CPU reference SPH micro-run:
  - small ice/iron/air fixture runs a few steps,
  - conservation artifacts pass,
  - phase and pressure summaries are present.
- WebGPU parity:
  - only enabled after CPU reference output is stable,
  - rejects parity drift,
  - preserves CPU fallback on device loss.
- Multiscale handoff:
  - ULG exports closure/simulation artifacts,
  - PeerCompute ingests them,
  - packet summaries preserve pressure, phase, conservation, particle
    resolution, wall temperatures, per-side wall heat export, and validity.

### Scientific Regression Fixtures

Use small canonical problems before the full 10 m scene:

- H2O single-cell heating curve: ice -> water -> steam with latent plateaus.
- Fe single-cell cooling curve: liquid -> solid with latent plateau.
- Sealed gas control volume: steam addition increases pressure according to
  EOS at fixed volume.
- Stefan-style melting/freezing front with known reference behavior.
- Blackbody/graybody Fe radiance at fixed temperatures.
- Closure-derived visible color for ice, liquid water, steam, solid Fe, and
  molten Fe from optical/radiation references.
- Mechanical-response fixtures for ice and solid Fe modulus/yield behavior.
- Contact heat-transfer micro-slab H2O/Fe interface.

## Demo Acceptance Criteria

A demo run is successful only when all of these are true:

- The preflight artifact says the requested final state is thermodynamically
  possible for the selected six-side wall-temperature boundary, or the demo
  clearly reports that it is not possible.
- Initial state matches:
  - 10 m sealed transparent box,
  - 1 atm air,
  - -40 F initial gas,
  - 1 m ice cube on a 1 m molten Fe cube,
  - six explicit wall-temperature values.
- The user can set macro-particle counts, and the run reports represented
  molecules/atoms per particle plus convergence status.
- Pressure is computed from sealed-box mass/energy/EOS and increases when steam
  production dominates condensation.
- Ice/water/steam transitions come from H2O thermodynamic closure state.
- Fe liquid/solid transition comes from Fe thermodynamic closure state.
- Iron glow comes from temperature/emissivity radiation output.
- Ice, water, steam, solid Fe, and molten Fe colors/opacities come from
  optical/radiation closures, not renderer constants.
- Viscosity, bulk modulus, Young's modulus, shear modulus, Poisson ratio, and
  related material behavior come from mechanical/transport closures.
- Mass conservation residuals stay within configured tolerance.
- Energy conservation residuals stay within tolerance after wall heat export and
  radiation are included.
- Momentum residuals stay within tolerance for internal SPH forces.
- Every rendered phase/color/opacity field has a source artifact and closure ref.
- The final cold-gray-iron / ice-around-it outcome is shown only if the simulated
  heat sinks and phase equilibria produce it.

## Milestones

### P0 - Planning And Feasibility

- Add this plan.
- Add thermodynamic preflight design to ULG plan/test docs.
- Add six absolute wall-temperature controls to the demo requirements.
- Add macro-particle count/resolution controls to the demo requirements.
- Do not implement visuals yet.

### P1 - Artifact Contracts

- Add ABI schemas/builders for material closures, EOS closures, phase closures,
  mechanical closures, optical closures, wall-temperature boundaries,
  particle-resolution configs, preflight artifacts, SPH phase simulation
  artifacts, convergence reports, and conservation reports.
- Add overclaim guard tests.

### P2 - Material Closure Pipeline

- Add H2O/Fe/air/wall closure fixtures from MoonLab/Eshkol with provenance.
- Add mechanical and optical closure fixtures for H2O phases and Fe phases.
- Implement `MaterialRegistry` on top of `ClosureRegistry`.
- Add closure validity and refresh behavior for material state sampling.

### P3 - Thermodynamic Core

- Implement enthalpy/internal-energy/temperature conversion.
- Implement phase-equilibrium solver over closure free energies.
- Implement the scenario energy feasibility preflight.
- Include six fixed-temperature wall reservoirs and per-side heat ledgers in
  the preflight.

### P4 - Conservative SPH Carrier

- Implement SPH density, pressure, gradient, viscosity, and energy operators.
- Add multi-material contact and wall boundary conditions.
- Add user-selectable macro-particle resolution with represented entity counts
  and convergence artifacts.
- Keep CPU reference authoritative.

### P5 - Sealed Gas, Phase Change, And Radiation

- Add air/steam mixture EOS pressure.
- Add evaporation/condensation/freezing/melting via phase equilibrium and latent
  heat.
- Add radiation/glow and material color/opacity from optical/radiation closures.

### P6 - Browser And Multiscale Demo

- Add ULG browser controls/status for preflight and small CPU run.
- Add six side sliders and particle-count controls to the visible demo.
- Add PeerCompute Multiscale scenario and visualization.
- Start with reduced particle counts, then add adaptive/high-res tiles.

### P7 - Validation And Performance

- Add convergence tests.
- Add wall-clock performance budgets.
- Add WebGPU parity and device-loss tests.
- Add full-run acceptance artifact.

## Open Physics Choices To Set Explicitly

- What is the default absolute temperature for each wall side? The likely
  default is 233.15 K (-40 F) for all six sides, but the user must be able to
  change them independently.
- Are fixed-temperature walls infinite thermal reservoirs, or finite-capacity
  wall materials clamped by external controllers? The slider means absolute
  side temperature either way, but the energy ledger must label the model.
- What is the initial iron temperature above liquidus?
- What is the initial ice temperature: exactly -40 F or a separate configured
  value?
- What are wall material, thickness, conductivity, emissivity, and heat
  capacity if finite wall bodies are represented in addition to fixed
  temperature faces?
- What are the default macro-particle counts for H2O, Fe, and gas, and what
  convergence threshold is required before the demo claims stable behavior?
- Should the iron solid be represented as SPH elastic solid, MPM solid, or a
  rigid aggregate after solidification?
- Which mechanical model is in scope first: linear elastic, viscoelastic,
  plastic/yield, fracture, or a staged sequence with explicit validation flags?
- What fidelity is required for H2O/Fe interface boiling and steam-film
  insulation?
- What fidelity is required for optical properties: graybody only first, then
  spectral absorption/scattering, or full spectral from the start?
- What pressure limits and wall failure behavior are in scope? The current demo
  assumes an unbreakable sealed box unless explicitly changed.

## Immediate Next Slice

The first implementation slice should be the thermodynamic preflight and schema
layer, not particles:

1. Add `peercompute.ulg.thermodynamic-preflight.v0`.
2. Add a scenario config for the exact 10 m / 1 m / 1 atm / -40 F setup.
3. Add six required wall-temperature fields, one per side, stored in Kelvin.
4. Add particle-resolution config fields and represented molecule/atom counts.
5. Compute the enthalpy budget from closure-backed material constants or
   explicitly tagged reference fixtures.
6. Assert that a no-heat-sink or insufficient-wall-cooling run does not claim
   the final cold iron/ice state.
7. Add fixed-temperature wall-side energy ledgers and require reported heat
   export/import per side.
8. Add mechanical/optical closure schemas with overclaim guards.
9. Only after this passes, wire the conservative SPH phase carrier.

## 2026-06-10 GPU MLS-MPM Stress P2G Checkpoint

Completed since the prior GPU P2G checkpoint:

- The mechanics particle buffer now stores closure-derived mechanical constants
  per macro-particle: effective bulk modulus, shear modulus, Lame lambda,
  sound speed, EOS model id, and constitutive status.
- The live demo propagates its CFL-derived sound-speed/modulus scale into GPU
  particle packing, so the GPU projection uses the same reduced but
  first-principles-derived material stiffness as the current interactive
  carrier.
- The WebGPU P2G projection now includes stress momentum:
  `aff = m*C + (-dt*V*4/dx^2)*sigma`.
- Fluid stress uses pressure derived from packed rest density, current
  density, EOS model, and sound speed.
- Solid stress uses the fixed-corotated elastic model with packed shear modulus
  and Lame lambda.

Validation evidence:

- Focused ABI/SPH-buffer/P2G/mechanics tests passed `32/32`.
- Browser e2e for the default derived-material SPH demo passed against the
  live HTTPS server.
- Live WebGPU probe reported P2G `webgpu-executed`, parity `pass`,
  `maxGridAbs=0.00006866455078125`, `dt=0.0005`, and mechanics stride `32`.
- Full `npm test` passed `258/258`; production build passed with the known
  large-chunk warning.

Remaining before this satisfies the demo's physical acceptance criteria:

- Implement WebGPU grid velocity update with gravity, CFL clamp, sealed-box
  wall/contact constraints, and pressure/steam diagnostics.
- Implement WebGPU G2P reconstruction for velocity, affine `C`, deformation
  gradient `F`, and volume ratio `J`.
- Move thermal conduction, six wall heat exchange, phase equilibrium,
  vapor/condensation pressure, and reaction updates onto GPU-resident buffers.
- Keep all material properties and optical behavior closure-derived; no
  per-material visual or mechanical patches.
