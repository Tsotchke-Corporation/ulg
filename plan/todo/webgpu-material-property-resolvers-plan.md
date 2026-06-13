# WebGPU Material Property Resolver Migration Plan

Date: 2026-06-11 AKDT

## Current Answer

The relativistic optical closures are not fully implemented in WebGPU.

Current state:

- `src/runtime/material/opticalClosure.js` derives scalar-relativistic
  interband oscillator rows, Drude/Drude-Lorentz response, spectral samples,
  opacity, and PBR parameters in JavaScript on the CPU.
- `src/runtime/material/elementClosures.js` calls that CPU optical path while
  deriving element properties.
- `src/runtime/material/opticalGpuBuffers.js` packs already-derived
  `opticalRenderParams()` rows into uploadable typed arrays.
- `ulg-gpu-abi/src/wgsl.js` has `opticalLookupWgsl`, but that kernel only
  matches material/phase ids and copies packed optical rows to output. It does
  not derive Koelling-Harmon transitions, Drude-Lorentz dielectric response,
  CIE integration, opacity, or spectral PBR rows.

So WebGPU currently accelerates lookup/consumption of optical closure data, not
the lower-level relativistic optical derivation itself.

## Goal

Move expensive material-property resolution from JavaScript into GPU-resident
WebGPU kernels while keeping the honesty contract:

- properties remain derived from lower-level electronic, molecular,
  thermodynamic, and reaction chains;
- cached records are performance artifacts, never source-of-truth constants;
- CPU validates schemas, inputs, generator fingerprints, and provenance once;
- the hot path consumes and updates compact GPU buffers without dropping back to
  CPU closure resolution;
- CPU fallback remains available but visibly reports `cpu-closure-active` and
  never silently blocks the UI.

## Migration Boundary

Keep these on CPU/control plane:

- formula parsing and UI input validation;
- schema validation and overclaim guards;
- cache-key construction and stale-record rejection;
- WebGPU device/pipeline creation and bind-group wiring;
- PeerCompute/localStorage persistence;
- small diagnostic readbacks.

Move these to WebGPU or worker/PeerCompute fallback:

- any SCF/eigensolver/reduction/linear-algebra-heavy lower-level solve;
- optical, thermal, EOS, phase, reaction, and radiation numeric resolution;
- per-material table sampling and runtime closure graph evaluation;
- per-frame and per-rebuild particle/material conversion work.

## Resolver Inventory

### 1. Atomic Electronic Structure

Current CPU anchors:

- `src/runtime/electronicStructure/radialKohnSham.js`
- `solveAtom()`, `solveKohnShamAtomLog()`, `solveKohnShamAtomLSDA()`,
  `solveKohnShamAtomKH()`, `radialStatesKH()`
- `src/runtime/electronicStructure/periodicTable.js`

Derived outputs:

- total energy;
- orbital energies and occupancies;
- spin/LSDA channel energies;
- Koelling-Harmon scalar-relativistic states;
- radial density and containment radii;
- outer orbital binding scale;
- valence/bonding electron counts.

WebGPU work:

- add fixed-layout radial grid buffers;
- add tridiagonal eigensolver kernels;
- add Hartree potential prefix/integral kernels;
- add XC/LSDA potential kernels;
- add SCF iteration kernels with residual summaries;
- add KH scalar-relativistic state kernels;
- cache per-Z electronic-structure closure records by solver/grid/generator
  hash.

### 2. Element Bulk Property Closure

Current CPU anchors:

- `src/runtime/material/elementClosures.js`
- `deriveElementProperties()`
- `elementMaterialClosure()`
- `src/runtime/electronicStructure/jelliumCohesion.js`
- `src/runtime/electronicStructure/uniformElectronGas.js`

Derived outputs:

- density;
- Wigner-Seitz radius;
- empty-core radius;
- bulk modulus;
- shear modulus;
- sound speed;
- Debye temperature;
- heat capacity;
- Lindemann melting point;
- liquid density;
- latent heat;
- conduction electron density;
- plasma frequency;
- intrinsic color and interband oscillators.

WebGPU work:

- port jellium/electron-gas cold curve evaluation;
- port radial-density packing branch for transition/non-free-electron elements;
- port Debye/Lindemann/Richards property reductions;
- write an element-property output row set consumed by thermal, mechanics,
  optical, and reaction kernels.

### 3. Molecular And Compound Electronic Closure

Current CPU anchors:

- `src/runtime/electronicStructure/molecularHartreeFock.js`
- `src/runtime/electronicStructure/allElementMolecularSolver.js`
- `src/runtime/electronicStructure/molecularThermochemistry.js`
- `src/runtime/material/materialDerivation.js`
- `src/runtime/material/compoundClosure.js`

Derived outputs:

- RHF/UHF/MP2 energies where valid;
- all-element approximate molecular energies;
- atomization/cohesion energy;
- HOMO-LUMO or molecular gap;
- optimized geometry;
- partial charges and bond orders;
- vibrational frequencies;
- zero-point and thermal corrections;
- gas heat capacity and ideal gas constants;
- condensed density and phase transition estimates.

WebGPU work:

- add dense/symmetric matrix kernels for overlap/Fock/eigensolve paths;
- add batched small-molecule SCF kernels;
- add geometry optimization/Born-Oppenheimer step kernels;
- add vibrational Hessian/eigenvalue kernels for accepted small systems;
- add all-element molecular-pair Hamiltonian kernels for broad coverage;
- cache formula/geometry/spin/method closure records by generator hash.

### 4. Formula, Mixture, And Gas Closure

Current CPU anchors:

- `src/runtime/material/materialDerivation.js`
- `deriveFormulaMaterialProperties()`
- `deriveMixtureProperties()`
- `src/runtime/material/statisticalMechanics.js`
- `gasMixtureThermal()`, `idealGasHeatCapacity()`

Derived outputs:

- molar mass;
- atom count per formula;
- gas density/EOS inputs;
- Cp/Cv/gamma;
- mixture composition;
- molecular degrees of freedom;
- phase model and validity domain.

WebGPU work:

- keep formula parsing CPU-side, then upload atom-count vectors;
- run mixture reductions and ideal-gas thermodynamics on GPU;
- cache formula/mixture property rows using formula atom-vector and component
  closure hashes.

### 5. Phase Equilibrium And Thermal State

Current CPU anchors:

- `src/runtime/material/phaseEquilibrium.js`
- `src/runtime/material/phaseTransitions.js`
- `src/runtime/material/thermoState.js`
- `src/runtime/sph/thermalPhase.js`
- `src/runtime/sph/sphThermalGpuKernel.js`

Derived outputs:

- phase from specific internal energy;
- phase fractions;
- temperature;
- density by phase;
- latent heat segments;
- vapor/condensed state;
- wall heat exchange response.

Current GPU status:

- resident thermal step and phase-response lookup exist;
- response/graph table construction is still CPU-side.

WebGPU work:

- move thermal graph and phase-response construction/sampling into GPU kernels;
- keep graph validation CPU-side;
- persist graph banks by material/phase/generator hashes;
- ensure phase-state output is used by optics, mechanics, gas, and renderer
  without CPU translation.

### 6. Mechanics, EOS, Viscosity, And Transport

Current CPU/GPU anchors:

- `src/runtime/sph/multiMaterialEos.js`
- `src/runtime/material/gruneisenEos.js`
- `src/runtime/sph/mlsMpmCarrier.js`
- `src/runtime/sph/sphMechanicsGpuKernel.js`
- `src/runtime/sph/sphGridGpuKernel.js`
- `src/runtime/sph/sphGridUpdateGpuKernel.js`
- `src/runtime/sph/sphG2pGpuKernel.js`

Derived outputs:

- rest density;
- pressure law/EOS rows;
- bulk/shear moduli;
- Lame parameters;
- sound speed;
- solid/liquid/gas flags;
- viscosity/transport coefficients;
- mechanics reset rows by product phase.

Current GPU status:

- resident MLS-MPM mechanics, grid projection/update, G2P, and summaries exist;
- material property derivation and table packing are still CPU-side.

WebGPU work:

- port EOS and phase-aware material sampling;
- add transport/viscosity closure kernels;
- make mechanics reset rows direct consumers of GPU phase/material outputs;
- remove CPU hot-loop table repacking.

### 7. Optical, PBR, Emission, And Opacity

Current CPU anchors:

- `src/runtime/material/opticalClosure.js`
- `relativisticInterbandOscillators()`
- `metalRelativisticColorSrgb()`
- `metalOpticalRenderParams()`
- `compoundGapRenderParams()`
- `opticalRenderParams()`
- `src/runtime/material/opticalGpuBuffers.js`

Derived outputs:

- plasma frequency;
- scalar-relativistic interband oscillators;
- Drude/Drude-Lorentz dielectric response;
- spectral reflectance/transmission/absorption;
- CIE/sRGB base color;
- opacity;
- IOR;
- roughness/metalness/transmission;
- attenuation distance/color;
- vapor/condensed/droplet scattering;
- emissive/glow response from temperature.

Current GPU status:

- `opticalLookupWgsl` consumes packed rows only.

WebGPU work:

- port oscillator generation from electronic-structure rows;
- port Drude-Lorentz complex dielectric evaluation;
- port spectral sample reduction and CIE integration;
- port Beer-Lambert/molecular-gap/Rayleigh/droplet scattering paths;
- add blackbody/thermal emission closure rows for glowing hot materials;
- cache by material, phase, thermodynamic state bucket, optical path length,
  microstructure/droplet summary, and generator hash.

### 8. Reaction Discovery And Energetics

Current CPU anchors:

- `src/runtime/chemistry/formula.js`
- `src/runtime/chemistry/reactionCandidates.js`
- `src/runtime/sph/reactionDiscovery.js`
- `src/runtime/sph/reactiveChemistry.js`
- `src/runtime/sph/sphReactionGpuKernel.js`

Derived outputs:

- balanced candidate equations;
- reactant/product term rows;
- product material closures;
- reaction enthalpy/free energy;
- activation/rate blockers;
- gas byproduct routing;
- sealed-box pressure contribution;
- atom/mass/charge/energy ledgers.

Current GPU status:

- resident pair-contact product conversion exists for the current reduced
  reaction table;
- candidate enumeration, product closure derivation, and energetics are
  CPU-side;
- current runtime still needs full multi-product stoichiometry and gas routing.

WebGPU work:

- keep formula parsing/validation CPU-side, upload atom vectors and candidate
  rows;
- add GPU integer balance/reduction support where useful;
- port reaction closure evaluation and product/gas extent updates;
- consume balanced multi-product tables in WebGPU runtime;
- cache reaction closures by reactant/product/material-property/generator
  hashes.

### 9. Radiation, Nuclear, And Cherenkov Closure

Current CPU anchors:

- `src/runtime/material/radiationClosure.js`

Derived outputs:

- isotope/radioactive inventory;
- decay channels and half-lives;
- fission/fusion channels;
- neutron/gamma/charged-particle energy deposition;
- daughter product inventory;
- ionization/radiolysis inputs;
- Cherenkov threshold/emission response when particles exceed medium phase
  velocity of light.

WebGPU work:

- define isotope/channel buffer ABI;
- add stochastic or rate-equation decay kernels;
- add radiation transport/deposition grids;
- couple deposited energy into thermal/gas/chemistry buffers;
- derive Cherenkov optical source rows from particle speed, medium IOR, and
  spectral response, not from material-specific visual patches.

### 10. Cache, Provenance, And Resolver Graph

Current CPU anchors:

- `src/runtime/material/propertyProvenance.js`
- `src/runtime/material/MaterialRegistry.js`
- `src/visualization/sphPhaseDemoMount.js`
- `src/services/ulgRuntime.worker.js`
- `plan/todo/cold-start-cache-performance-plan.md`

Derived outputs:

- provenance ledgers;
- method/input/validity/generator hashes;
- cache hit/miss/stale diagnostics;
- localStorage/PeerCompute state records;
- closure graph node/edge descriptors.

WebGPU work:

- build and validate closure graphs on CPU once;
- flatten accepted graphs into GPU-resident node/edge/program rows;
- run graph evaluation kernels without JS function dispatch;
- store graph/program hashes with every derived GPU table;
- expose warning banners when any resolver falls back to CPU.

## Implementation Phases

### Phase 1 - Audit And ABI

- Add a resolver manifest listing every material-property resolver, input
  schema, output row schema, cache key fields, and current CPU entrypoint.
- Add ABI descriptors for electronic, molecular, optical-derivation,
  thermal-graph-build, reaction-closure, and radiation row families.
- Add runtime diagnostics that distinguish `webgpu-derived`, `webgpu-consumed`,
  `worker-cpu-derived`, `main-thread-cpu-derived`, and `cache-hit`.

### Phase 2 - GPU Numeric Kernels For Existing Tables

- Port optical Drude-Lorentz/CIE/opacity evaluation first, because the current
  GPU path is only lookup.
- Port thermal graph/phase-response construction or precompute on a worker and
  consume resident GPU graph rows.
- Port EOS/material table sampling so mechanics and pressure no longer depend
  on CPU table translation.
- Preserve CPU parity tests for every kernel.

### Phase 3 - WebGPU Closure Law Graph

- Compile validated closure graphs into flat GPU node/program rows.
- Support universal opcodes needed by material properties: polynomial/rational
  math, interpolation, reductions, complex arithmetic, table lookup,
  eigen-solver work queues, phase segmentation, and provenance/status writes.
- Keep graph construction and overclaim validation CPU-side.
- Keep graph execution and per-state sampling GPU-resident.

### Phase 4 - Electronic And Molecular Solvers

- Port radial Kohn-Sham/KH/LSDA kernels for element closure derivation.
- Port batched small-molecule HF/UHF/all-element molecular solver kernels for
  compound and reaction energetics.
- Use PeerCompute CPU/WASM workers as the nonblocking fallback until the GPU
  solvers are authoritative.

### Phase 5 - Reaction, Radiation, And Runtime Coupling

- Move balanced reaction closure execution to WebGPU with multi-product and gas
  byproduct buffers.
- Add radioactive decay/fission/fusion/radiation/Cherenkov closure tables and
  WebGPU transport/deposition kernels.
- Couple all outputs to thermal, optical, chemistry, pressure, and render
  buffers without full particle readback.

### Phase 6 - Persistence And Performance Gate

- Persist derived material, optical, thermal, reaction, radiation, and packed
  static GPU-table records in the PeerCompute state representation and mirror to
  localStorage.
- Invalidate caches on schema, generator, input, validity, lower-level closure,
  or program-hash changes.
- Profile cold and warm runs after each phase.
- Treat hidden main-thread closure derivation during a running demo as a bug.

## Acceptance Criteria

- The SPH demo can report which resolver families are GPU-derived, GPU-consumed,
  CPU-worker-derived, or main-thread CPU-derived.
- Relativistic/interband optical response for metals is derived in WebGPU from
  electronic/element rows and matches CPU reference within declared tolerance.
- Molecular/compound optics and opacity are state/phase keyed and can be
  derived without material-specific patches.
- Element and compound mechanical/thermal/EOS properties are generated through
  the same graph-backed resolver interface.
- Reaction closures are cached and executed as balanced multi-product reactions
  with gas byproducts and pressure coupling.
- Radioactive/nuclear/radiation closure families have explicit buffers,
  provenance, and validation blockers even before full scientific validation.
- Browser UI shows warnings for unsupported WebGPU, CPU closure fallbacks, and
  main-thread closure work.
- Warm reloads reuse valid PeerCompute/localStorage derived closure libraries
  and stale records are ignored with visible stale reasons.
