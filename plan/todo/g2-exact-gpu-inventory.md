# G2 exact GPU inventory integration

Started 2026-10-24 from `0f7540c`, under `ulg-g2-conserved-plumes` /
`activation-energy-exchange`. The user authorized the order recommended after
review of the October 24 handoff. Full G2 acceptance remains unchanged.

## Representation decision

Authoritative mass is a nonnegative integer in little-endian u32 limbs,
multiplied by an immutable run-wide binary quantum in kilograms. The initial
format is nine limbs with quantum `2^-149 kg`. It represents every finite f32
mass and f32 packet exactly, including the handoff's cross-binade example.
The capacity is `2^139 - 2^-149 kg`; accumulation overflow is an error.

The ABI also supports finer/wider explicit formats, up to 66 limbs, so a
required seed or packet outside the initial format cannot force silent
rounding. Cold binary64 ingress is decoded bit-for-bit and rejects any nonzero
discarded bit. The format must be chosen before initialization from the full
physical input and packet domain. Changing it during a run requires an exact
migration; raw limbs from distinct formats cannot be interchanged.

This is exact accounting of the admitted numerical packets, not an assertion
that numerical kinetics equal an analytic continuous flux. A future fractional
partition must choose one executed allocation and retain its exact remainder.
Independent rounded child allocations are not conservative. Unexecuted flux
does not count as transferred mass, optical volume, or latent energy.

f32 projections are derived values only. They cannot determine exact zero,
depletion, available mass, split allocation, or continuing inventory. Even a
projection whose bits are unchanged can represent a changed exact inventory.
Projection overflow/underflow is reported without erasing the mass. GPU ingress
and projection operate on raw integer encodings: the
[WGSL floating-point rules](https://www.w3.org/TR/2026/CRD-WGSL-20261021/#floating-point-evaluation)
permit subnormal flushing, including intermediate bit reinterpretations.

## Implemented foundation

- `ulg-gpu-abi/src/sphExactMassInventory.js`: immutable numeric format, exact
  cold-input codec, diagnostic decoding and correctly rounded f32 bit projection.
- `src/runtime/sph/sphExactMassWgsl.js`: integer comparison, addition,
  subtraction, paired transfer, f32-bit ingress and projection.
- `src/runtime/sph/sphExactMassInventoryGpu.js`: private resident ownership,
  same-format/device/generation reads, fenced retirement, explicit initial
  inventory and GPU-buffer transfer candidates. Success observes only a
  64-byte verdict. Diagnostic tests read inventory separately.
- `src/runtime/sph/sphExactMassTransferWgsl.js`: immutable-source shared-endpoint
  gather, separate stored-state validation and terminal verdict. Outgoing
  reservations cannot spend incoming packets from the same interval. Invalid
  edges, aliases, overspending or overflow reject the entire candidate family.
- `src/runtime/sph/sphExactMassParticleSeed.js` and the existing
  `sphGpuBuffers.js` owner: optional cold carrier initialization through
  `buildSphGpuParticleBuffers(state, { exactMass: { format, reference } })`.
  Capture binary64 masses once, use that capture for initial packing, validate
  private packed bytes and row bindings, then upload private snapshots.
  Inventory reads pin both the existing particle owner and numeric storage.
  Copied descriptors, substituted arrays/strides/epochs, stale mirrors, and
  unauthenticated raw-buffer mutation paths reject. Legacy initialization adds
  no exact allocation.

These are **mass-only numeric candidates**. They do not authorize a physical
interval, material/phase conversion, coupled momentum/energy, preset enrollment,
or outer publication. No default preset enrolls this family yet; the explicitly initialized standard
and single-step/multi-step fused solvers can preserve it through the authenticated continuation below. The current
gather costs `O(rows * edges)` and needs physical cell batching before large
live enrollment. A numerical owner is not a replacement source-authority layer.

## Consumer integration map

Cold carrier ownership, standard and fused G2P/thermal/refresh continuation,
dense multi-step fused terminal ownership, and single-level SS publication/next-generation
continuation are implemented.
The remaining integrations below are still pending. Preserve the existing current-gas source
and outer-publication machinery; extend its actual owned families.

| Path | Existing source/writer | Required exact-inventory integration |
|---|---|---|
| Cold carrier | `sphGpuBuffers.js`, S[3], T[9], M[19]/M[31] | Initial exact mass, private owner and full SPH/MLS epoch initialization implemented. Complete mass/mole/volume projections remain pending. |
| Product history | `sphResidentProductHistoryGpu.js`, H[3]/H[12]/H[13] and H[9] | Bind exact placed/unplaced partitions to live row membership, generation and count ownership. |
| Aerosol | `sphAerosolParcelGpu.js`, parcel word 3 | Bind exact mass to family lifetime; retain separate dry-core and condensed-water components for nuclei. |
| Source propagation | `sphMlsMpmGpuStep.js` successor upload constructors and retained-buffer lists | Standard and single-step fused dense/canonical preserving continuation implemented, including shared identity lifetime and predecessor retirement. Dense fused multi-step terminal ownership is implemented with an owned cold thermo copy or genuine final thermal/refresh outputs. Two-level branches and carrier topology changes remain pending. |
| Current closure | `sphMlsMpmPostMechanicsClosure.js` retained stages and final tuple | Genuine G2P plus existing thermal/refresh seals authenticate the preserving S/T/M chain and original continuation claim. Product history and mass-changing stages remain pending. |
| Publication | `schroederSpatialSuccessorSourceFamily.js` | Existing transaction/closure/preparation/commit records now authenticate one exact preserving successor, sealed after final epochs and activated only in the original publication window. Existing SS leases retain the physical read through retirement. |
| Vapor/aerosol exchange | `sphVaporAerosolExchange*`, `sphSpatialGasLedgerEosGpu.js` | Use one executed integer packet, with complete mass/energy/momentum coupling and refreshed successor volume/EOS. |
| EOS | `sphSpatialGasLedgerEosGpu.js` carrier entity count and residual-product mole scaling | Replace independently rounded mass/mole coordinates with common inventory/material projections. |
| Occupancy | `schroederSpatialPhaseVolumeMomentWgsl.js`, `sphSpatialGasFreeVolumeWgsl.js` | Compute volume from complete successor inventory with matched generation and exact activity. |
| Mechanics | `wgsl.js` P2G/G2P and canonical/fused variants | Preserve inventory through motion and explicitly derive mechanics projections. Grid momentum arithmetic is not an inventory ledger. |
| Phase transfer | `sphPhaseCarrierTransferGpu.js` aggregate/split/slot clearing | Allocate exact conserved partitions and retain the remainder; exact zero replaces mass-epsilon deletion. |
| Chemistry and placement | `wgsl.js` reaction debit, product allocation and placement | Bind one reactant debit to complete product/residual partitions and conserved element accounting. |
| Thermal | `sphThermalGpuKernel.js` and shared WGSL | Preserve exact mass while deriving the coupled energy response; mass precision alone cannot validate latent/surface energy. |
| Extraction and optics | `sphAerosolCondensateExtractionWgsl.js`, dispersed-medium producer | Carry both exact physical partitions and the optical subset; do not infer transferred mass from rounded before/after projections. |
| Transport/topology | particle materialization/compaction and future parcel transport/deposition | Remap and transfer the complete inventory and source lineage, never a projection alone. |

An exact family reaching an unsupported writer must reject before submission.
Such a rejection is a temporary migration boundary, not G2 acceptance. A
mass-preserving stage may explicitly retain its immutable inventory; a mass
writer must issue the matched successor. Public feature booleans do not prove
that the underlying family or writer is compatible.

The admitted continuation executes real G2P, thermal and mechanics-refresh
producers, captures their original private records, and binds the same inventory
to the existing particle owner through the original closure claim and complete
envelope. Source reads are reserved before asynchronous G2P execution and held
until successor binding. Shared numeric storage and identity retire only after
the final physical owner. The successor retains neither the previous closure
nor an unbounded ancestor chain. Failed thermal execution and late rejected
binding retire submitted outputs behind the queue fence.

Native evidence runs two actual moving/heating GPU steps in each of standard
dense, standard SS, fused dense and fused SS execution, with each predecessor
retired before the next step, and verifies every exact word survives. This
proves inventory preservation. Mechanics and thermal response still consume f32
projections; it does not prove complete low-part momentum/energy coupling.
CPU tests separately cover original-record authentication, shared identity
lifetime, successive owners and failure cleanup. No injected producer substitutes
for the native sequence.

Migration guards still reject unintegrated two-level entry, phase transfer,
materialization, reaction/placement, extraction, product history, gas-pressure
coupling and compaction when an exact source is supplied. Direct raw-buffer
thermal entry and CPU fallback also reject. Real presets remain unchanged.
These guards are temporary migration boundaries, not all-consumer acceptance.

The SS path uses the actual classifier, selected generation, mechanical contact
and thermal proposals, G2P, refresh, commit and publication. It preserves the
original continuation envelope and both upload objects. G2P provenance binds
the actual transaction, generation and duration. Private weak predecessor
identities preserve historical validation without retaining the ancestor chain.
Prepared owners reject reads; copied plans, claims, receipts and descriptors
reject. Pending failure drains ownership, while exceptions after authenticated
publication preserve the published successor for recovery. Synchronous and
lease-based SS retirement both join the physical read's queue fence.

The first native SS run exposed an unspecified cold CFL sentinel being passed
as an explicit zero, which stopped motion. The hierarchy now delegates that
absence to the resident default; an explicitly supplied outer zero is unchanged.
Native follow-up proves two moving/heating SS steps with final epoch agreement,
exact mass words, predecessor retirement and final held-lease retirement.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-ss-exact-20261025-0guXN6/`.

Next integrate the two-level physical continuation, product residuals,
aerosol and all mass-changing consumers through their existing owners.
Product exact inventory is the **unplaced residual**, not historical total plus
placed plus unplaced (which double-counts).

The actual dense fused sequence now carries exact inventory across K real
mechanics substeps and optional thermal/refresh stages. Private one-use thermal
capabilities bind actual encoders and inputs; terminal ownership binds the
selected outputs after cleanup registration. Genuine cold and continuation MLS
owners support paired physical reads, with shared terminal retirement and safe
auxiliary ownership transfer. The cold terminal owns a GPU thermo copy, so
predecessor retirement does not leave a dangling allocation. Source epochs must
match at a complete tick; canonical immutable-generation restrictions remain.

Native evidence in
`/home/cos/.cache/icc/repos/ulg/g2-fused-sequence-20261025-8oFazV/native-final-r3.json`
adds eight cold/heated batches with K=2/3 (20 real substeps) to the previous
single-step matrix. Every exact word, motion/heating and terminal epoch delta
passes after predecessor retirement. This does not prove complete low-part
mechanics/thermal coupling, mass-changing consumers or preset enrollment.

## Implementation order and acceptance

1. Numeric ABI, private resident owner, and native adversarial conservation
   proof (current foundation).
2. Actual source-family propagation and retention, then exact exchange and
   successor projections.
3. All mass-changing phase, extraction, reaction, placement and topology paths,
   then all derived consumers and consecutive native continuation proof.
4. Shared normalized environment initialization, documented physical closure
   domains and coefficients; resolve ice/gas-only/zero-vapor cases and the
   legacy versus explicit caloric phase rule.
5. Matched-interval coupled growth, actual air/humidity and nuclei enrollment
   with their real UI controls, then transport/deposition and full domain proof.

Tests must include invisible-in-f32 packets, the odd low bit across a binade,
later steps spending that bit, carries/borrows, complete depletion and birth,
shared endpoints, permutation/cancellation, gross overspend, aggregate overflow,
format mismatch, corruption of a stored low limb, incomplete dispatch, source
immutability, retirement while borrowed, and confirmed-loss cleanup.

Final G2 still requires GPU conservation, traced iron/ice and sodium/water
plumes, and environment UI/URL/restart round trips. G1 stays deferred and the
publication hold remains. This document does not close the all-consumer gate.
