# Cubic Barrier Contact Integration Plan

Date: 2026-06-18 AKDT

Status update, 2026-06-20 AKDT: compact
`algorithmMaterialContactRows` now also feed material-interface force-row
production through an explicit kinematics-gated cubic-barrier response. The
pressure-interface WebGPU producer packs contact policy rows from the compact
algorithm contact rows and a parallel per-interface-element kinematics row
buffer (`gapM`, `normalVelocityMPerS`, representative mass, status). The WGSL
stage binds both buffers and computes bounded dynamic contact pressure from
gap, support radius, closing velocity, damping, and effective mass before the
existing force-row ABI reaches grid update. The CPU oracle uses the same helper.
Policy rows alone no longer fabricate material/material pressure; contact
application requires ready interface kinematics. Pressure-stage evidence now
reports policy row count, applied contact force rows, pair keys, max contact
pressure, and interface-kinematics ready/row counts. The next step is to derive
those kinematics automatically from resident interface/reaction-neighborhood
state instead of requiring element-provided fields in tests/options.

Status update, 2026-06-20 AKDT: compact
`algorithmMaterialContactRows` now also feed material-interface force-row
production. The pressure-interface WebGPU producer packs contact policy rows
from the compact algorithm contact rows, binds them as a fifth storage buffer,
and adds a bounded contact pressure term to each matching material-interface
element before the existing force-row ABI reaches grid update. The CPU oracle
uses the same matching and cap logic, and pressure stage evidence reports
policy row count, applied contact force rows, pair keys, and max contact
pressure. This was the bounded first pair-response slice; it has been replaced
by the kinematics-gated response above.

Status update, 2026-06-20 AKDT: compact
`algorithmMaterialContactRows` now feed the MLS-MPM wall-barrier grid-update
path. When an explicit wall stiffness or bulk/shear override is absent,
`resolveWallBarrierContactMaterialPolicy()` selects a representative contact
row, multiplies row `normalStiffnessPa` by grid support length, and passes the
derived stiffness into CPU/WebGPU grid update params. Grid-update and resident
step diagnostics report the contact-row schema, pair key, materials, phases,
normal stiffness, and policy source. This is still a non-authoritative
wall-contact consumer; the next contact slice is material-interface/contact
pair response inside the mechanics update path.

Status update, 2026-06-18 AKDT: the first wall-contact slice is implemented in
the MLS-MPM grid update path. `mlsMpmWallBarrierContactResponse()` remains the
small cubic-barrier dynamic response helper, and
`estimateMlsMpmWallBarrierElasticStiffness()` now derives an
elasticity-inclusive normal stiffness from material bulk/shear modulus and grid
support length when an explicit wall stiffness is not supplied. CPU and WebGPU
grid-update summaries carry the stiffness source and material modulus fields.
Focused tests cover the stiffness estimate and floor/wall contact propagation.
Next: connect representative material mechanics rows into the runtime wall
parameters, then extend the same approach to material-interface/contact pairs
inside the physics update path.

## Source

- Local reference read: `plan/cubic-barrier.pdf`.
- Paper: Ryoichi Ando, "A Cubic Barrier with Elasticity-Inclusive Dynamic
  Stiffness", ACM TOG 43(6), Article 224, December 2024,
  DOI `10.1145/3687908`.
- Reference implementation named in the paper: `st-tech/ppf-contact-solver`.

## Routing Decision

Do not replace the current MLS-MPM migration with a full PPF/IPC-style solver
rewrite. The paper is most useful to ULG as a contact and boundary-condition
design input for the existing MLS-MPM grid/contact path.

The paper's practical takeaway is that the cubic barrier itself is mainly
better for extremely tiny gaps and strain limiting. For ordinary contact, the
paper says the larger win is elasticity-inclusive dynamic stiffness. That maps
to our current P0 physics bugs: wall contact, same-material liquid contact,
solid/liquid contact, and unstable reaction/product contact impulses.

## Candidate ULG Integration

1. Add a small barrier-contact helper beside the MLS-MPM grid/wall update path.
   It should compute a finite gap `g`, contact normal `n`, representative mass
   `m`, and dynamic stiffness:

   `k_bar = m / max(g * g, eps) + n dot (H n)`

   For the first slice, approximate `n dot (H n)` from the existing material
   mechanics table bulk/shear response and current particle volume/J. Do not
   add a global Newton solve in this slice.

2. Use the barrier helper first for wall/floor contact, because wall normals
   and gaps are already explicit and the failure modes are easy to validate.
   Target the same H2O/H2O and solid/liquid probes that already expose
   contact/settling problems.

3. Extend to material-interface/contact pairs only after wall contact is
   stable. Candidate pair gaps can reuse the existing resident render/material
   interface field and reaction contact neighborhood, but the actual mechanics
   response must be applied in the MLS-MPM update path rather than as a render
   overlay or post-hoc position correction.

4. Add validation before broad tuning:
   - no penetration through floor/walls,
   - bounded `mpmJ`,
   - contact gap closes for same-material liquid/contact scenarios,
   - no high-speed contact impulses above current guard thresholds,
   - browser console remains empty under the console harness.

## Non-Goals

- Do not implement the full paper matrix assembly, PCG solver, friction stack,
  or CCD pipeline as part of this near-term slice.
- Do not spend performance time optimizing readback render bridges if the next
  architectural slice replaces them with a GPU-resident visual path.
- Do not use this as an overlay workaround. Contact response belongs in the
  physics engine state that rendering consumes.
