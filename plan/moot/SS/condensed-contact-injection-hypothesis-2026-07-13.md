# Moot Condensed-Contact Injection Hypothesis

This investigation was opened after the reaction-enabled sodium scene diverged
between `0.256 s` and `0.512 s`, while the reaction-disabled control remained
bounded. The working hypothesis was that reaction-product placement or
condensed/gas contact injected energy into the shared grid and needed a
manufactured contact limiter test.

Compact material/phase mechanics evidence rejected that explanation. Newly
placed H2 was valid, but the WebGPU ideal-gas stress was referenced to a vacuum
because the host never populated the existing ambient-pressure uniform. At
`J=1`, an atmospheric-temperature H2 carrier therefore started with roughly
`101325 Pa` of false gauge stress. Supplying the scene's external pressure
removes the divergence without changing contact, damping, placement, or the
renderer: the `0.512 s` native sodium run is bounded at `2.43234 m/s`, and H2
remains at `0.823205 m/s` and `J=0.976154..0.992270`.

Do not resume this contact-injection hypothesis unless later evidence shows an
independent energy increase with correct ambient gauge provenance. Remaining
work is the visibly coarse water surface and visually indistinct reaction, plus
CPU/WebGPU gas-EOS parity and closure-derived gas drag as separate tasks.
