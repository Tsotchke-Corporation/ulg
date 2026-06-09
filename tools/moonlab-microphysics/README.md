# MoonLab microphysics reference producer

`h2_h2o_microphysics.c` computes ab-initio molecular ground-state energies by exact
diagonalization of the molecular qubit Hamiltonians that MoonLab constructs (Jordan-Wigner of
the molecular integrals). MoonLab does the hard physics — building the Hamiltonian — and this
driver finds its exact ground state via shifted power iteration (FCI in the minimal basis), which
is faster and deterministic compared to the shot-based VQE solver.

It produces:

- an H2 dissociation curve E(bond length), and
- the H2O ground-state energy (8-qubit model Hamiltonian).

## Build & run

It links MoonLab's prebuilt `libquantumsim.so`:

```bash
cd /home/cos/projects/moonlab
gcc -O2 /home/cos/projects/ulg/tools/moonlab-microphysics/h2_h2o_microphysics.c \
    -I. -L. -lquantumsim -lm -Wl,-rpath,$(pwd) -o /tmp/ulg_microphysics
/tmp/ulg_microphysics   # prints JSON to stdout
```

The committed dataset in `src/runtime/material/microphysicsData.js` is the output of this driver.
Because the computation is exact diagonalization, the numbers are deterministic and reproducible.

## Honesty / scope

- The **H2** result is quantitatively meaningful: the curve minimum is at 0.7414 Å (the
  experimental H2 bond length) and the energy is within ~5 mHa of the FCI reference
  (-1.137284 Ha). Bond energy comes out ~3.87 eV (minimal basis underbinds vs the experimental
  4.48 eV — the right order of magnitude).
- The **H2O** result is the exact ground state of MoonLab's 8-qubit *model* Hamiltonian, which is
  not a quantitative water energy (the full ab-initio value is ~-76.4 Ha). It is recorded as a
  produced-but-model reference; it does not flip `materialValidation`.
- These references are produced microphysics evidence. Material/EOS/SPH/phase validation stays
  false until a quantitative basis + validation tolerances are met.
