# Greenfield Retrospective: What I Would Do Differently

Date: 2026-09-06 AKDT.

Recorded from a side conversation at the user's request. This is architectural
analysis, not an adopted replacement plan, authorization for a rewrite, or a
change to the active seven-goal campaign.

## Overall assessment

I would keep the vision, but change the construction order and make the core
much smaller. My strongest criticism is not that ULG lacks architectural ideas.
It is that integration machinery has grown faster than dependable, demonstrated
capabilities.

This assessment draws on the current campaign, spatial/law design, material-fit
plan, and representative runtime code. It is not a line-by-line audit of the
entire repository. Historical assessments are evidence of the development
trajectory, not proof that every historical gap remains unchanged today.

## 1. Establish a trustworthy local simulator before expanding the system

I would start with one GPU, one authoritative state owner, one execution path,
and one renderer. PeerCompute would still own execution, but initially through
its simplest local backend.

The first milestones would be complete physical experiments:

- Water at rest, falling, and interacting with boundaries.
- Heat exchange with measurable energy accounting.
- Melting and evaporation with conserved material.
- One reaction with identified products and accounted-for energy.

Each experiment would extend the same engine. Presets would remain data, not
alternative implementations.

I would design the interfaces for distribution and deeper-scale derivation
early, but postpone their operational complexity until these experiments were
dependable.

## 2. Make the law contract executable from the beginning

This is probably the most important architectural change.

The project already specifies what laws should declare: state access, spatial
requirements, conservation, validity, and cross-level behavior. The
[architecture assessment](ss-law-architecture-assessment.md) identifies the
historical problem accurately: those declarations were often enforced
separately by individual consumers.

I would make one structured declaration generate or check:

- Buffer layouts, named accessors, and bindings.
- Read/write dependencies and permitted accumulation.
- Resource ownership and lifetime.
- Required spatial views.
- Kernel identity and compatible state versions.

A distinction such as **rest volume versus current volume** should appear in
the interface, not depend on remembering which packed float belongs to which
configuration.

I would also avoid deriving major shader variants through source-text
replacement, as the current
[mechanics implementation](../src/runtime/sph/sphMlsMpmGpuStep.js) does in
`createMechanicsFieldG2pWgsl`. Named modules and explicit composition would make
the actual executed operator easier to inspect.

This needs a small, restricted generator, not a prerequisite project to build
an entire programming language. Generated interfaces still do not prove the
equations correct.

## 3. Treat presentation as an independent product

From day one, I would separate:

- Physics advancement.
- Publication of coherent renderable state.
- Display refresh.

The renderer would consume retained, versioned snapshots and remain responsive
to the camera while physics is busy. Display interpolation would be explicitly
bounded and unable to modify simulation state.

I would also make rendering testable with recorded simulation output. Then we
could answer:

> Is the water's geometry wrong, is its optical material wrong, or is the
> renderer receiving new state too slowly?

Those questions should not require debugging the entire
chemistry-mechanics-scheduler chain simultaneously.

The [status history](implementation-status.md) shows why this separation
matters: throughput work, optical regressions, and a mechanics rejection became
entangled.

## 4. Make cheap approximation and expensive refinement foundational

The user's representative-sampling and derived-material-function ideas belong
near the foundation of this project.

I would build the common execution pattern around:

> Use a valid inexpensive closure; detect when it becomes insufficient; refine
> only the affected region; adopt a replacement coherently.

That is also the direction of the
[scale-adaptive plan](todo/scale-adaptive-law-activation-plan.md).

Important distinctions:

- An inactive expensive solver does **not** mean its physics disappears; a
  valid closure represents its contribution.
- Generic kernels stay warm; material identity supplies data rather than
  generating reaction-specific programs.
- Regions near interfaces or changing regimes receive more attention than
  homogeneous bulk.
- Fits carry domains, provenance, residual bounds, and necessary internal
  state, not just material name and temperature.

I would start with one useful, well-bounded fitted property. I would not begin
by trying to fit all material behavior into one enormous function.

## 5. Separate spatial validity from rebuilding everything

I would define the spatial service around what consumers need to remain valid,
rather than around a prescribed rebuild schedule.

It would track changes in position, support, topology, and representation
separately. Consumers could reuse views whose assumptions still hold.

That leaves room for incremental migration, dirty-region repair, and occasional
complete rebuilds. I would benchmark those alternatives; incremental
maintenance is not automatically cheaper or simpler.

Likewise, one shared spatial authority should support different law-specific
views. It should not force contact, thermal transport, long-range interactions,
and rendering to use one universal neighbor list.

## 6. Keep correctness, scientific accuracy, and visual quality distinct

I would establish three clear kinds of evidence early:

**Implementation correctness:** GPU invariants, conservation accounting,
lifecycle tests, manufactured states, and same-device comparisons. These can
block a change.

**Scientific agreement:** comparisons against versioned external data, with
uncertainties and applicability stated. These remain the advisory release
signal the user described.

**Presentation quality:** actual desktop motion, refraction, depth, clouds,
camera response, and wall-clock cadence.

A green result in one category would never stand in for another. Neither would
thousands of structural tests substitute for a small set of convincing
end-to-end experiments.

For steam and smoke specifically, I would keep material inventory, transported
gas/aerosol state, and optical appearance separate. A plausible cloud is not
evidence that the producing physics is correct.

## 7. Change the development discipline, including the assistants' work

At review time, the scene file was about 55,600 lines and the MPM step module
about 41,500. Size alone does not establish bad design, but these are large
places in which to mix numerical operators, orchestration, compatibility, and
diagnostics.

Starting over, I would enforce narrower ownership boundaries and smaller
independently verifiable changes.

I would also be stricter about experiments:

- State the hypothesis and the observation that would reject it.
- Keep physics changes separate from presentation optimizations.
- Reject unsuccessful approaches promptly.
- Track delivered behavior, not accumulated patches, tests, or plan items.
- Keep one concise current plan; archive the narrative elsewhere.
- Use ICC to preserve evidence and decisions without letting control-plane
  work become the deliverable.

The assistants should have maintained that distinction more consistently.

## Bottom line

I would build **a small, trustworthy GPU physics laboratory that grows into an
adaptive engine**, with distribution and deep derivation added through
established boundaries.

Much of that architecture already exists in the plans. The biggest missed
opportunity was making its central contracts, and its simplest working physical
demonstrations, the foundation before expanding the surrounding machinery.

This is **not** a recommendation to throw the repository away. There is
valuable physics, GPU infrastructure, ownership work, and hard-earned
experimental evidence here. I would preserve those investments and move toward
these boundaries incrementally, rather than start another wholesale rewrite.
