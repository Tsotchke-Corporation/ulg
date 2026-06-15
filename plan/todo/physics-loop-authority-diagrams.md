# Physics Loop And Authority Diagrams

Date: 2026-06-12 AKDT

These diagrams capture the intended direction after the WebGPU-resident refactor
bugs. They are planning diagrams, not proof that the runtime already behaves
this way.

## Target Distributed Main Loop

```mermaid
flowchart TD
  NK[PeerCompute NodeKernel tick]
  SM[StateManager / DataState snapshot]
  CM[ComputeManager law graph scheduler]
  LANE[GPU resident lane manager]
  LS[Law / closure graph nodes]
  WARM[Warm Eshkol / MoonLab service hosts]
  LEASE[GPU / CPU / WASM worker leases]
  HOT[Worker-local hot WebGPU buffers]
  ADMIT[Result admission and validation]
  DELTA[Compact deltas / retained-buffer refs / artifacts]
  COMMIT[StateManager commitDelta]
  VIEW[ULG scene and diagnostics consume admitted state]

  NK --> SM
  SM --> CM
  CM --> LANE
  CM --> LS
  CM --> WARM
  LANE --> HOT
  LS --> LEASE
  WARM --> LS
  LEASE --> HOT
  HOT --> ADMIT
  ADMIT -->|accepted| DELTA
  ADMIT -->|rejected| CM
  DELTA --> COMMIT
  COMMIT --> SM
  SM --> VIEW
```

Key point: the scene observes and presents state. It should not become the
distributed authority for law scheduling or accepted mutation. The GPU lane is
an execution backend under ComputeManager, not a second scheduler.

## Resident Physics Stage Order

```mermaid
flowchart TD
  RESET[Scenario reset / setParticles]
  PACK[Pack and upload resident buffers]
  P2G[P2G: particle/product state to grid]
  GRID[Grid update: pressure, wall, force, velocity]
  G2P[G2P: authoritative particle mechanics]
  THERM[Thermal / phase update]
  REACT[Reaction, product, gas ledgers]
  PRESSURE[Pressure/interface extraction as physics stage]
  SURFACE[Render field / surface generation]
  SUMMARY[Compact diagnostics summary]
  NEXT[Next resident step]

  RESET --> PACK
  PACK --> P2G
  P2G --> GRID
  GRID --> G2P
  G2P --> THERM
  THERM --> REACT
  REACT --> PRESSURE
  PRESSURE --> SURFACE
  PRESSURE --> NEXT
  SURFACE --> SUMMARY
  SUMMARY --> NEXT
```

Authority rule: G2P owns mechanics after it runs. Thermal, reaction, pressure,
and render stages can only write their declared families unless a new stage
explicitly declares and validates a mechanics write.

## Current Bug Shape To Avoid

```mermaid
flowchart LR
  CPU[CPU mirror arrays]
  RES[Resident WebGPU buffers]
  RENDER[Render-field pass]
  PRESS[Pressure/interface rows]
  RXN[Reaction/product output]
  G2P[G2P mechanics]
  SCENE[Scene update]

  CPU -. stale fallback .-> SCENE
  RES --> RENDER
  RENDER --> PRESS
  PRESS --> G2P
  RXN -. no-op overwrite .-> G2P
  SCENE -. hidden owner .-> CPU
```

The target fix is to remove hidden authority edges:

- stale CPU mirrors cannot override resident state;
- render-field execution cannot be required for pressure physics;
- no-op reaction/thermo outputs cannot overwrite mechanics;
- retained buffers cannot be destroyed before declared consumers run.

## Law And Closure Graph

```mermaid
flowchart TD
  CTX[Scenario context and focus scale]
  GRAPH[peercompute.ulg.law-closure-graph.v0]
  MECH[Mechanics: SPH / MLS-MPM]
  THERMO[Thermo / phase / EOS]
  CHEM[Reaction / product / gas]
  OPT[Optics / radiation]
  GRAV[Gravity / astrophysics]
  PLASMA[MHD / PIC / plasma]
  Q[Quantum / many-body response]
  E[Eshkol closure and reference artifacts]
  M[MoonLab response artifacts]
  EW[Warm Eshkol host]
  MW[Warm MoonLab host]
  CACHE[Hot / warm / cold closure caches]
  ADMIT[Admission gates]

  CTX --> GRAPH
  GRAPH --> MECH
  GRAPH --> THERMO
  GRAPH --> CHEM
  GRAPH --> OPT
  GRAPH --> GRAV
  GRAPH --> PLASMA
  GRAPH --> Q
  EW --> E
  MW --> M
  E --> GRAPH
  M --> GRAPH
  GRAPH --> CACHE
  CACHE --> ADMIT
```

Multiscale rule: all scales can influence each other through closures, boundary
conditions, and correction terms, but only the active focus region should run at
the highest resolution.

## Copy Avoidance Shape

```mermaid
flowchart LR
  TASK[ComputeManager solver task]
  AFF[State-key / domain-key affinity]
  LANE[GPU resident lane]
  PASS[Same-device pass DAG]
  BUFS[Hot buffer handles]
  SUM[Compact summaries]
  REFS[Retained-buffer refs]
  DELTA[Admitted deltas]

  TASK --> AFF
  AFF --> LANE
  LANE --> PASS
  PASS --> BUFS
  PASS --> SUM
  PASS --> REFS
  SUM --> DELTA
  REFS --> DELTA
```

Copy rule: do not fan one mutable resident state through arbitrary GPU child
workers until domain ownership and boundary exchange are explicit.
