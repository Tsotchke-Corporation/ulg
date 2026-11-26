# Cosmic UFO Explorer, Deformable MLS-MPM Worlds & Kardashev / Von Neumann Game Design Roadmap

> **Status:** Active design note + Phase 1 implementation live on `feat/cosmic-ufo-sandbox-weapons-mpm-multiplayer` (`universes.html`).
> Captures what is shipping live on WebGPU now vs. deeper large-scale multiplayer/planetary simulation challenges reserved for follow-up engineering discussions.

---

## 1. Live Now (Phase 1 — 60 FPS GPU-Native Architecture)

1. **Universal 60-Foot (`18.3 m`) Flying Saucer Perspective Across All Scales (`L0 → Surface`):**
   - Iconic 32-segment smooth metallic saucer with a **glowing emerald-green translucent glass bubble**, **yellow conical tractor beam** (during Rover/Drone deployment, sampling, and rigid boulder capture), **3D Cockpit View (`V`)**, and **WebXR WebGPU (`XRGPUBinding`) + Side-by-Side Stereo VR** bridge (`src/runtime/shared/webxrWebGpuBridge.js`).
   - Realistic planetary surface proportions (`±384 m` mountain/canyon terrain with `45–160 m` ridges vs `18.3 m` UFO & `2.8 m` Rover).
2. **360° Rim-Mounted Weapons + First-Principles EM Light–Matter Physics (`src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js`):**
   - **Tunable Full-Spectrum EM Laser (`10⁻¹³ m` Gamma → `10 m` Radio, `1 kW → 100 TW`):** Evaluates Beer–Lambert / polar Microwave–Far-IR rotational loss / Mid-IR vibrational stretch / optical band-gap & Drude metal reflectance / UV photodissociation / X-ray–Gamma photoionization against the live sampled compound (`H₂O`, `SiO₂`, `Fe₂O₃`, `CH₄`, etc.).
   - **Rim-Launched Guided Missiles** & **Antimatter Beam (`E = 2mc²`, `511 keV` gamma flash + hadronic plasma)** firing dynamically from whichever point along the saucer perimeter faces the aim point.
3. **Performance-Safe Active-Zone Hybrid GPU MLS-MPM Deformable Terrain + 64 Rigid-Body Boulders (`src/runtime/astrophysics/surfaceDeformationMpmGpu.js`):**
   - **Why it stays 60 FPS:** Macroscopic terrain stays a single continuous `129×129` GPU mesh reading a persistent `128×128` GPU deformation/thermal/melt buffer (`heightDelta`, `tempK`, `meltFrac`, `charFrac`) with `+0` extra draw calls. The true **`32×24×32` GPU MLS-MPM (`@workgroup_size(64)`) ejecta / crater-slump / melt-flow kernel (`2,048` material points)** stays **strictly dormant (`0` dispatches / `0 ms`)** until a missile, laser, or antimatter impact activates a local blast zone, then auto-sleeps once ejecta settles!
   - 64 varied 3D rigid-body boulders (`0.8–9 m`) with live velocity, quaternion spin, slope rolling, boulder–boulder collisions, tractor-beam lifting/throwing, blast shockwave scatter, and thermal laser shattering.
4. **Seedable URL Share-Links, PeerCompute Multiplayer UFOs & Kardashev / Von Neumann Foundation (`src/runtime/astrophysics/ufoMultiplayerMesh.js`):**
   - Shareable `?seed=&epoch=&span=&sol=&body=&surf=&x=&y=&z=&yaw=&t=&room=&relay=` URLs recreate the exact universe, epoch, star system, planet, coordinates, and time.
   - PeerCompute WebRTC/relay + `BroadcastChannel` multiplayer renders remote players' UFOs + live beams/missiles, resolves UFO-vs-UFO shield hits, and **automatically locks simulation timescale to canonical `1.0×` synchronized network epoch time**.
   - Playable foundation for resource harvesting, reactor tier upgrades, self-replicating **Von Neumann Probes**, and continuous **Kardashev Scale (`Type 0.7 → III`)**.

---

## 2. Hard / Out-of-Budget Items Reserved for Discussion & Future Phases

| Topic | Why It Cannot Be Brute-Forced at 60 FPS Today | Proposed Phased Solution to Discuss |
|---|---|---|
| **Global Planet-Wide 1-Meter Voxel MLS-MPM (`R = 6,371 km`)** | A `1 m³` grid over Earth's surface crust alone requires `> 10¹⁶` cells (`> 10⁸ TB` VRAM). | **Sparse Chunked Active-Zone MLS-MPM Streaming:** Persist compressed height/crater delta octree tiles in IndexedDB/OPFS and dynamically stream a `64³` GPU MLS-MPM bubble strictly around each active craft/impact (`<= 32 MB` VRAM). |
| **True Planetary-Scale Destruction (Mantle Cracking / Asteroid Shattering)** | Full planetary continuum hydro (`10⁵–10⁶` SPH/MPM bodies) requires its own dedicated compute budget separate from micro-terrain. | Seamlessly promote `P > 10¹⁸ W` / multi-kilogram antimatter strikes to ULG's existing Gate 5 `planetaryTidalRocheGpu` SPH/gravitation kernel so entire asteroids & moons physically crack and form debris rings! |
| **Authoritative Cross-WAN Multiplayer Anti-Cheat & Global Crater Sync** | Pure peer-to-peer WebRTC without a public STUN/TURN + relay server cannot traverse symmetric NATs, and full `128×128` terrain grids shouldn't be broadcast raw every frame. | Replicate compact deterministic **event logs** (`{ t, kind: 'missile'|'laser'|'antimatter', pos, energyJ }`) over PeerCompute `StateManager` CRDT deltas (`~64 bytes/event`), plus deploy a lightweight STUN/TURN + signaling relay (`plan/todo/distributed-peercompute-network-stack-plan.md`). |
| **True WebXR Native WebGPU Across All Headsets Without Flags** | Chrome & Meta Quest Browser currently gate `XRGPUBinding` behind experimental flags (`#webxr-incubations`), while Safari/VisionOS WebXR WebGPU is still evolving. | Keep our native `XRGPUBinding` path wired first-class (`xrCompatible: true`) alongside our instant Side-by-Side Stereo VR preview until browser vendors flip `XRGPUBinding` to default-ON. |
| **Full Kardashev Type II–III Strategy Layer (Dyson Swarms, Stellar Lifting, Intergalactic Warp Gates)** | Requires a dedicated persistent galaxy-scale resource graph, multi-system background probe simulation, and cooperative/competitive faction rules. | Build a deterministic analytical/GPU population integrator for off-screen Von Neumann probe fleets (`dN/dt = r N (1 - N/K_system)`), visually dimming host stars via real optical depth `τ_Dyson` as swarm coverage approaches `100%` (Type II), and escalating to galactic core Penrose extraction (Type III)! |
