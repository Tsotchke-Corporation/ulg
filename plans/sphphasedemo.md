# SPH Phase Demo Plan - Ice On Molten Iron In A Sealed Box

Date: 2026-06-08 AKDT

## Purpose

Build a first-principles ULG demo that simulates a 1 m ice cube resting on a
1 m molten iron cube inside a sealed, transparent 10 m box initially filled
with air at 1 atm and -40 F. The visible target is:

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
ramps, or hard-coded pressure curves. Every visible behavior must come from the
closure, field, carrier, thermodynamic, radiation, and validation chain.

## Non-Negotiables

- The 10 m box demo is a macroscopic SPH / continuum simulation. It cannot
  solve the literal many-body Schrodinger equation for every molecule and atom
  in the box. "First principles" here means ULG derives and validates continuum
  closures from lower-level Schrodinger / quantum-statistical / molecular
  simulations, then uses those closures in a conservative carrier runtime.
- Material properties, EOS, SPH dynamics, phase changes, pressure, and glow
  must stay unvalidated / blocked until their evidence artifacts exist.
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
| Boundary | Rigid, sealed mass boundary; thermal boundary must be explicit |
| Ambient | -40 F external reservoir only if wall heat transfer is modeled |
| Ice cube | 1 m edge, initially resting on iron, initial temperature from config |
| Iron cube | 1 m edge, molten, initial temperature above Fe liquidus |
| Gravity | Earth gravity unless scenario config explicitly changes it |
| Visualization | Three.js/WebGPU particle and volume rendering, no scripted phase visuals |

The boundary condition is critical. A sealed box prevents mass exchange, not
heat exchange. If the box walls are adiabatic, the final cold gray iron with ice
around it is probably impossible for the requested 1 m cubes. If the outside
ambient is intended to cool the system, the box walls need material properties,
surface area, thermal resistance, and an external -40 F reservoir in the
simulation. Energy exported through the walls must be reported.

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
  - wall/environment heat loss if enabled.
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
iron with ice around it. The demo can still reach that outcome if the walls
conduct enough heat to the -40 F ambient over enough simulated time, but the
energy sink must be explicit and audited.

## First-Principles Chain

### 1. Quantum / Molecular Inputs

MoonLab and/or lower-level reference solvers must produce or import validated
microphysical evidence for:

- H2O electronic / molecular potential information sufficient to derive water,
  ice, and vapor thermodynamics.
- Fe cohesive, electronic, and lattice information sufficient to derive solid
  and liquid thermodynamics.
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
  - surface tension.
- Fe phase / EOS closure:
  - solid/liquid free energy,
  - liquidus/solidus behavior,
  - enthalpy and internal energy,
  - density,
  - heat capacity,
  - thermal conductivity,
  - viscosity for liquid Fe,
  - emissivity / spectral opacity needed for glow.
- Air / steam mixture closure:
  - pressure from mixture composition, density, and temperature,
  - gas heat capacity,
  - diffusion / viscosity,
  - humidity, condensation, and saturation handling.
- Wall/environment closure:
  - wall heat capacity, conductivity, thickness, and outside convection if the
    -40 F ambient is meant to cool the sealed box.

Required artifact families:

- `eshkol.ulg.material-closure.v0`
- `eshkol.ulg.eos-closure.v0`
- `eshkol.ulg.phase-equilibrium-closure.v0`
- `eshkol.ulg.transport-closure.v0`
- `eshkol.ulg.radiation-closure.v0`
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
  - wall heat loss.
- Closure-domain exit handling:
  - halt or subcycle the affected region,
  - emit refresh/invalidation artifact,
  - never extrapolate silently outside a closure validity envelope.

### 4. Carrier Solver

The SPH carrier must evolve macro-particles using closures; it must not encode
material behavior directly.

Particle state fields:

- position, velocity, mass, smoothing length,
- material id and species composition,
- density, pressure,
- internal energy / enthalpy,
- temperature,
- phase fractions,
- stress / viscosity terms,
- radiation source terms,
- provenance refs for closures sampled during the step.

Required solver features:

- Deterministic neighbor search using the existing spatial hash / edge-message
  substrate.
- SPH density and gradient operators with convergence tests.
- Conservative momentum and energy update.
- Multi-material contact handling for H2O/Fe/air/wall interfaces.
- Phase-fraction update from thermodynamic equilibrium, not a visual threshold.
- Steam/water/ice mass exchange preserving H2O mass exactly within tolerance.
- Solid Fe behavior after freezing, either as an SPH solid model or a
  compatible MPM/rigid aggregate layer with the same conservation artifacts.
- Adaptive resolution near the ice/iron interface so the 1 m cubes fit inside
  the 10 m box without requiring molecular particle counts.

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
- `radiation_closure.schema.json`
- `thermodynamic_preflight.schema.json`
- `sph_phase_scenario.schema.json`
- `sph_phase_simulation_artifact.schema.json`
- `conservation_report.schema.json`

Required tests:

- Schema validation for every new artifact.
- Overclaim guards that reject `materialValidation`, `eosValidation`,
  `phaseChangeValidation`, `sphValidation`, `scientificValidation`, or
  `fullPhysicsValidation` unless the required evidence refs are present.
- Unit and dimensional consistency checks for closure tables.

### ULG Runtime Modules

Add or extend:

- `src/runtime/material/MaterialRegistry.js`
- `src/runtime/material/thermoState.js`
- `src/runtime/material/eos.js`
- `src/runtime/material/phaseEquilibrium.js`
- `src/runtime/material/transport.js`
- `src/runtime/material/radiation.js`
- `src/runtime/material/thermodynamicPreflight.js`
- `src/runtime/sph/sphState.js`
- `src/runtime/sph/sphOperators.js`
- `src/runtime/sph/sphPhaseCarrier.js`
- `src/runtime/sph/sphConservation.js`
- `src/runtime/sph/sealedBoxGas.js`
- `src/runtime/sph/wallBoundary.js`

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
- New visible status rows:
  - preflight pass/fail,
  - pressure,
  - water mass by phase,
  - iron solid fraction,
  - total energy residual,
  - wall heat export,
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
  conservation residuals, and wall heat export.
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
- Add fixtures for H2O, Fe, air, H2O/Fe interface, and wall boundary closures.
- Keep smoke-only closures separated from scientific production closures.

### MoonLab

Expected work in `/home/cos/projects/moonlab`:

- Produce microphysical reference contracts for H2O, Fe, air species, and
  H2O/Fe interface behavior.
- Provide hashes, tolerances, uncertainty, and provenance.
- Distinguish reduced reference evidence from full-fidelity quantum coverage.
- Keep WebGPU parity and full-physics readiness explicit.

## Validation And Tests

### Unit Tests

Add focused ULG tests:

- `tests/materialClosure.test.mjs`
- `tests/thermodynamicPreflight.test.mjs`
- `tests/phaseEquilibrium.test.mjs`
- `tests/sphOperators.test.mjs`
- `tests/sphPhaseCarrier.test.mjs`
- `tests/sealedBoxGas.test.mjs`
- `tests/radiationClosure.test.mjs`

Required assertions:

- Preflight computes the requested 10 m / 1 m / 1 atm / -40 F scenario with
  correct units.
- Adiabatic case refuses to claim the final cold-iron/ice-around-it outcome if
  the enthalpy budget does not support it.
- Wall-cooled case reports the exact energy exported to ambient.
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
  - packet summaries preserve pressure, phase, conservation, and validity.

### Scientific Regression Fixtures

Use small canonical problems before the full 10 m scene:

- H2O single-cell heating curve: ice -> water -> steam with latent plateaus.
- Fe single-cell cooling curve: liquid -> solid with latent plateau.
- Sealed gas control volume: steam addition increases pressure according to
  EOS at fixed volume.
- Stefan-style melting/freezing front with known reference behavior.
- Blackbody/graybody Fe radiance at fixed temperatures.
- Contact heat-transfer micro-slab H2O/Fe interface.

## Demo Acceptance Criteria

A demo run is successful only when all of these are true:

- The preflight artifact says the requested final state is thermodynamically
  possible for the selected wall/environment boundary, or the demo clearly
  reports that it is not possible.
- Initial state matches:
  - 10 m sealed transparent box,
  - 1 atm air,
  - -40 F initial gas/ambient,
  - 1 m ice cube on a 1 m molten Fe cube.
- Pressure is computed from sealed-box mass/energy/EOS and increases when steam
  production dominates condensation.
- Ice/water/steam transitions come from H2O thermodynamic closure state.
- Fe liquid/solid transition comes from Fe thermodynamic closure state.
- Iron glow comes from temperature/emissivity radiation output.
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
- Do not implement visuals yet.

### P1 - Artifact Contracts

- Add ABI schemas/builders for material closures, EOS closures, phase closures,
  preflight artifacts, SPH phase simulation artifacts, and conservation reports.
- Add overclaim guard tests.

### P2 - Material Closure Pipeline

- Add H2O/Fe/air/wall closure fixtures from MoonLab/Eshkol with provenance.
- Implement `MaterialRegistry` on top of `ClosureRegistry`.
- Add closure validity and refresh behavior for material state sampling.

### P3 - Thermodynamic Core

- Implement enthalpy/internal-energy/temperature conversion.
- Implement phase-equilibrium solver over closure free energies.
- Implement the scenario energy feasibility preflight.

### P4 - Conservative SPH Carrier

- Implement SPH density, pressure, gradient, viscosity, and energy operators.
- Add multi-material contact and wall boundary conditions.
- Keep CPU reference authoritative.

### P5 - Sealed Gas, Phase Change, And Radiation

- Add air/steam mixture EOS pressure.
- Add evaporation/condensation/freezing/melting via phase equilibrium and latent
  heat.
- Add radiation/glow from Fe temperature/emissivity closure.

### P6 - Browser And Multiscale Demo

- Add ULG browser controls/status for preflight and small CPU run.
- Add PeerCompute Multiscale scenario and visualization.
- Start with reduced particle counts, then add adaptive/high-res tiles.

### P7 - Validation And Performance

- Add convergence tests.
- Add wall-clock performance budgets.
- Add WebGPU parity and device-loss tests.
- Add full-run acceptance artifact.

## Open Physics Choices To Set Explicitly

- Is the sealed box adiabatic, or do transparent walls conduct heat to the
  -40 F ambient? The requested final state needs a heat sink.
- What is the initial iron temperature above liquidus?
- What is the initial ice temperature: exactly -40 F or a separate configured
  value?
- What are wall material, thickness, conductivity, emissivity, and heat
  capacity?
- Should the iron solid be represented as SPH elastic solid, MPM solid, or a
  rigid aggregate after solidification?
- What fidelity is required for H2O/Fe interface boiling and steam-film
  insulation?
- What pressure limits and wall failure behavior are in scope? The current demo
  assumes an unbreakable sealed box unless explicitly changed.

## Immediate Next Slice

The first implementation slice should be the thermodynamic preflight and schema
layer, not particles:

1. Add `peercompute.ulg.thermodynamic-preflight.v0`.
2. Add a scenario config for the exact 10 m / 1 m / 1 atm / -40 F setup.
3. Compute the enthalpy budget from closure-backed material constants or
   explicitly tagged reference fixtures.
4. Assert that an adiabatic run does not claim the final cold iron/ice state.
5. Add the wall-cooled boundary option and require reported wall heat export.
6. Only after this passes, wire the conservative SPH phase carrier.
