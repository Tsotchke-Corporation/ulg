# ULG Test Plan

## Local Unit Tests

Command: `npm test`

Current result: pass, 7/7 tests on 2026-06-05.

- ABI descriptor construction and complex64 round trip.
- JSON schema validation for service manifests, task capsules, closure artifacts,
  quantum response artifacts, and tolerance reports.
- Registry resolution, child-worker lease limits, artifact cache behavior, and
  GPU fallback probe behavior.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 1/1 Chromium test on 2026-06-05 after installing the
Playwright Chromium binary with `npx playwright install chromium`.

- Load the Vite app through Playwright.
- Verify two supervised services register and run.
- Verify worker telemetry appears.
- Verify the three.js canvas is nonblank at desktop and mobile viewport sizes.
- Save screenshots into `test-results/`.

## Manual Stack Follow-up

- PeerCompute sidecar verified syntax, unit, Multiscale unit, Multiscale build,
  backend dry-run, and VPN coturn dry-run in `/home/cos/projects/peercompute`.
- Bring up the peercompute relay-backed local stack after the dummy ULG service
  smoke is stable.
- Reuse peercompute's existing runtime P2P smoke harness where possible.
- Add STUN/TURN/ICE/relay coverage once the service registry integration lands
  in peercompute proper.
