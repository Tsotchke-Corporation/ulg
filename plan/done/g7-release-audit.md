# G7 offline advisory scientific release audit

## Accepted — 2026-11-18 UTC

All three original `ulg-g7-release-audit` criteria pass: candidate review,
offline audit capability, and integrity/advisory policy. The exact development
receipt bundle has three unique PASS events, one input source, no dropped
criteria or events, and a matching oracle. Root and independent native-agent
reviews cover source, real snapshots, executed tests, original reports and
artifact hashes. This completes G7 only; the other twelve campaign targets
remain open. No commit, release or physics acceptance is implied.

The acceptance review found and fixed a null-manifest exception, false clean
reports for empty/partial caches, and use of faulted references in comparisons.
Malformed provenance and directory/manifest identity conflicts now produce
faults. Missing reference families produce missing-data rows. Snapshot ingestion
claims each version with atomic directory creation and exclusive file writes;
concurrent or repeated ingestion cannot overwrite it.

Current tests: **8 pass, 0 fail, 0 skip**, including eight competing ingestion
processes and actual CLI runs with network entry points disabled. Both real
cached datasets reverify with zero faults and 118 records each. The operator
report remains 170 agreements, 144 missing values and 130 deviations. These
deviations remain advisory and never gate runtime or workflow.

Evidence: `/home/cos/.cache/icc/repos/ulg/g5-g7-acceptance-20261118/`:
`source-manifest.json`, `executed-checks.json`, `verified-report/`,
`independent-review.md`, `final-bundle-signoff.md`,
`g7-reviewed-receipts.jsonl` and `g7-oracle.json`.
The source and snapshot hashes were unchanged through verification. Earlier
failed checks are retained. Production audit has only the expected low-severity
uncommitted-source notice; the full-tree guard has no violations.

The following November 14 record is historical; its three-test count is
superseded by the acceptance above.

Date: 2026-11-14. Task: ICC `ulg-g7-release-audit`. Oracle:
`ulg-g7-release-audit`.

**Host.** "shitbox" is the GPU workstation that runs the probes; the tailnet
now names it `fastbox`. Snapshots are cached locally at
`~/.cache/ulg/science-snapshots` (override: `ULG_SCIENCE_SNAPSHOT_DIR`).

## Delivered

**`src/tools/scienceReleaseAudit.js`:**
- **Parsers.**
  - PubChem PUG REST periodic table (JSON): u, K, K, and g/cm³ converted to
    kg/m³.
  - NIST Atomic Weights and Isotopic Compositions (SRD 144, ascii2): u, with
    concise `(n)` uncertainties and intervals as midpoint ± half-width.
- **Snapshot loader.** It verifies:
  - the manifest schema and required provenance (source URL, retrieval
    time, license, parser);
  - the SHA-256 of the raw bytes and of the normalized records;
  - that the records are exactly the declared parser's output of the raw
    bytes;
  - the declared units against the parser's units;
  - the record count.

  Faults are returned, never thrown.
- **`auditElementBank`.** Compares the material property bank
  (`data/material-properties/elements.json`) with the snapshots: atomic
  mass, melting and boiling points, and reference-state density.
  - Gas density is compared at the reference's 273.15 K with an ideal-gas
    rescale, and the adjustment is recorded on the comparison.
  - Each comparison gets a status: agrees (within the source uncertainty or
    a declared tolerance), deviates, or missing data, with the deviation
    and uncertainty.
  - The report states `advisory: true`, `runtimeAuthority: false` and
    `blocksWorkflow: false`.

**`scripts/science-snapshot-ingest.mjs`.** The operator ingests a downloaded
file as an immutable version: files are written read-only, and an existing
version is never overwritten.

**`scripts/science-release-audit.mjs`.** Offline: `fetch` is stubbed to
throw. It writes `report.json` and `report.md` and always exits 0.

## Snapshots cached (2026-11-14)

| Dataset | Version | Records | Raw SHA-256 |
| --- | --- | --- | --- |
| `pubchem-periodic-table` | 2026-11-14 | 118 | `6abc1932…` |
| `nist-atomic-weights` | 2026-11-14 | 118 | `b26d80a3…` |

## First report

`~/.cache/icc/repos/ulg/g7-release-audit-20261114/report.md`:
- integrity OK;
- 170 agree, 130 deviate, 144 missing data.

**Advisory finding: melting points.** Many melting points in the bank are far
from the references. For example:
- Hg: 2,377 K against 234 K;
- Br: 9,694 K against 266 K;
- Pd: 20,228 K against 1,828 K.

They look like the output of a first-principles estimator rather than seeded
reference data. The preset elements (H, N, O, F, Na, Cl, K, Fe, Cs) agree.

## Tests: `tests/scienceReleaseAudit.test.mjs`, 3 of 3 pass

- NIST uncertainty and interval parsing.
- A clean fixture audits offline: agree, deviate and missing data are all
  reported; the gas density is reference-state adjusted; the report is
  advisory.
- Faults are detected:
  - tampered raw bytes;
  - forged records with a self-consistent hash (not the parser's output);
  - missing license and source URL;
  - a unit mismatch (degC against K);
  - a missing manifest.

  The audit flags integrity and still reports.
