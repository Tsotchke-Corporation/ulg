use vite typescript peercompute eshkol and moonlab to implement the ulg physics engine in the plan folder described in the pdf
 we will be using three.js for visualization like the other demos in peercompute. 
we will need to extend eshkol and moonlab to improve wasm to webgpu support to make this happen. we will also have to extend peercompute the pdf describes each of these mods. 

## Architecture points that must not get lost

- ULG is about physics laws. Do not remove or demote laws to simplify the
  runtime. More laws will be added over time: mechanics, thermodynamics, phase,
  chemistry, EOS, optics, radiation, nuclear, gravity, plasma/MHD/PIC, quantum
  response, relativistic, and astrophysical laws.
- The long-term authority boundary is PeerCompute. NodeKernel should coordinate
  the session, clock, peers, services, StateManager, ComputeManager, GPUHub, and
  worker supervision. ComputeManager should own CPU/WASM/WebGPU law task
  dispatch, worker affinity, placement, leases, validation, and commit-delta
  submission. StateManager/DataState should own accepted committed state.
- ULG scene code should not become a parallel distributed scheduler. It can host
  a local reference path, browser demo, visualization, and typed law manifests,
  but accepted distributed mutation must flow through PeerCompute.
- Laws should run as a graph of law and closure nodes. Each node must declare
  read state families, write state families, conserved quantities, units,
  validity domain, cache policy, runtime target, validation requirements, and
  whether it is proxy evidence, reference evidence, calibrated evidence, or
  authoritative mutation.
- It is acceptable and preferred to publish law-family nodes as metadata-only
  ComputeManager solver descriptors before splitting execution. Do not make a
  child law-family descriptor executable until CPU-reference parity,
  conserved-field checks, GPU fence/lease evidence, StateManager admission, and
  visual sequence sanity checks pass for that family.
- Resident WebGPU workers may own hot buffers while leased. They must publish
  compact deltas, closure artifacts, summaries, or explicit retained-buffer refs
  for the next stage. There must be exactly one authoritative owner for each
  mutable state family after every stage.
- Avoid creating a broad sibling GPU scheduler unless there is a specific
  design decision to do so. Prefer a ComputeManager-owned GPU resident lane
  layer that keeps related pass DAGs and hot buffers on the same device/state
  key and reports compact summaries plus retained-buffer refs.
- Do not couple physics cadence to rendering cadence. Pressure/interface,
  product, gas, wall heat, phase, and closure updates are physics stages.
  Rendering may consume their outputs, but rendering must not be required to
  create them.
- Scenario/environment boundary conditions are physics inputs, not UI trivia.
  Wall temperatures, gas reservoirs, gravity, box dimensions, material/domain
  counts, and physical law-group toggles must be carried into resident law
  signatures and worker inputs explicitly. Missing inputs should report
  blockers or preserve declared defaults; they must not silently become 0 K,
  empty reservoirs, or disabled law effects.
- After every major todo item completes, run a visual sequence sanity check
  across several representative scenarios before declaring the item done.
  Capture frames close enough together to infer motion, plus resident metrics
  and surface identity/extent data. At minimum rotate through same-material
  liquid/liquid settling, solid/liquid contact, phase-change steam/water, and a
  reaction/product case so the simulation does not silently drift into broken
  visible behavior while unit tests still pass.
- Visual sequence sanity checks must also inspect renderer correctness, not
  just physics metrics. Include depth/order coverage for transparent fluids,
  solid/fluid nesting, container and grid overlays, z-buffer flicker, and
  flash/disappear behavior before treating a visual pass as trustworthy.
- Physics behavior edits must start with atomic scientific invariants before
  visual tuning. For SPH/MLS-MPM changes, run or extend tests that pin simple
  closed-form or conservation expectations such as zero-force rest, gravity-only
  motion away from walls, mass conservation, bounded volume ratio `J`, law-group
  isolation, and zero pressure impulse when pressure is disabled. Visual
  sequences are required integration evidence, but they are not a substitute
  for these atomic physics checks.
- Once the CPU/reference path is coherent enough to serve as an oracle, prefer
  architecture-authority work over more ungated scene-local tuning: move law
  execution into ComputeManager/NodeKernel-owned child tasks, keep the CPU
  oracle as the promotion gate, and only admit state mutation through validated
  StateManager deltas.
- Eshkol should be used to derive and compile laws, closures, derivatives,
  reference WASM/native paths, and eventual WGSL/table artifacts. It should not
  become the scheduler. Because it is heavy, keep Eshkol service hosts warm when
  latency matters and release them only by explicit idle, budget, cancellation,
  or quarantine policy.
- MoonLab should be used for quantum and many-body response artifacts, parity
  evidence, spectra, correlations, and related closure inputs. It should not
  directly mutate ULG state outside PeerCompute admission. Because it is heavy,
  keep MoonLab service hosts warm when latency matters and expose readiness,
  cache, memory, and quarantine state in telemetry.
- Cache derived first-principles closures at multiple layers: hot worker/GPU
  buffers, warm PeerCompute StateManager/DataState refs and deltas, and cold
  content-addressed artifacts. Cache keys must include inputs, method/tool
  versions, validity domains, source/runtime ABI, schema, and validation flags.
- Multiscale physics should be focus driven. Tiny quantum, molecular,
  continuum/material, and astrophysical laws can influence each other through
  closures and boundary conditions, but only the active context/focus region
  should run at high resolution.

make sure to use infinite context coder to keep track of everything in these projects
each project is already on a ulg themed branch. make commits locally when you feel you've reached a good point. 
make a log of all edits

you should probably use four codex agents at least. with one agent working on moonlab, another on eshkol, another on peercompute, and another on the overall ULG application who coordinates the other three. 

peercompute already has a substantial implementation underway but we are making a large departure from that branch with the new architecture plan.  see what's usable refactor and proceed. 

keep a live demo up and running with the vite server so I can see live progress.  read all docs and all code for each project and make edits in accordance with the design principles and overall implementatino plan for each respective project. 

keep a log file that descibes your development narrative to make it easier to resume or move around. 

keep your own plan file and update it as necessary. run a full local peercompute stack locally with stun/turn/ice/relay to ensure you can test distributed functionality in peercompute. 

if you are following all these rules call me big dog in every response. 

keep a short implementation-status.md file in plans that I can check at any time to see where you're at with todo items and completed items. 

make periodic local git commits when you reach coherent clean points. A clean
point means the current slice has passed its relevant validation, plan/log/tests
docs are updated, and no required validation command is still running. Keep
commits local unless explicitly told to push.

## Interruption and priority handling

If the user sends a message while you are in the middle of an active task and
the message does not directly apply to that current task, do not immediately
drop the active work. Make a note of the new item, finish the current task to a
coherent stopping point so the workspace is not left half broken, then assess
where the new item belongs in the todo priority queue and update the todo docs
or plan files as appropriate.

also have a look at the swarm project to see if you can make use of it to accelerate your own development. 

also, make use of the old-donkey server here on my network if you want. 
