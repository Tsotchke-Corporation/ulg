# ULG Implementation Log

## 2026-06-05 15:05:57 AKDT

Prompt: "read the agents.md file and get to work we are already on relevant branches for moonlab eshkol and peercompute. they're all in ~/projects."

Actions attempted:

- Read `/home/cos/projects/ulg/agents.md`.
- Read `/home/cos/projects/AGENTS.md`.
- Checked `plan/agents.md`, which is currently empty.
- Checked repo status for ULG, peercompute, Eshkol, and MoonLab.
- Extracted text from `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` with `pdftotext`.
- Reviewed the spec sections for service manifests, task capsules, worker
  supervision, GPU broker, Milestones 0.6 and 0.7, Demo A, library extension
  plans, and schema sketches.
- Checked npm registry versions for Vite, three, Ajv, and Playwright.
- Used ICC status and architecture summaries for MoonLab and peercompute.
- Spawned four sidecar agents:
  - MoonLab implementation surface review.
  - Eshkol implementation surface review.
  - peercompute orchestration/runtime review.
  - ICC/swarm tooling review.

Commands run:

```bash
rg --files -g 'AGENTS.md' -g 'agents.md' /home/cos/projects/ulg /home/cos/projects
rg -n "moonlab|MoonLab|eshkol|peercompute|ulg" /home/cos/.codex/memories/MEMORY.md
sed -n '1,240p' agents.md
sed -n '1,220p' /home/cos/projects/AGENTS.md
sed -n '1,240p' plan/agents.md
git status --short --branch
find plan -maxdepth 3 -type f | sort
pdfinfo plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf
pdftotext -layout plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf /tmp/ulg_triad_spec.txt
npm view vite version
npm view three version
npm view ajv version
npm view @playwright/test version
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo moonlab
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo peercompute
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py architecture-summary --repo moonlab --bundle --include-cheatsheet
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py architecture-summary --repo peercompute --bundle --include-cheatsheet
```

Files touched:

- `README.md`
- `package.json`
- `index.html`
- `.gitignore`
- `plan/plan.md`
- `plan/tests.md`
- `plan/implementation-status.md`
- `plan/log.md`
- `src/**`
- `ulg-gpu-abi/**`
- `tests/**`

Test results:

- `npm install` completed with 0 vulnerabilities.
- First `npm test` failed because plain Ajv did not load the draft-2020 schema meta-schema.
- Patched `tests/abi.test.mjs` to use `ajv/dist/2020.js`.
- `npm test` passed: 7/7 tests.
- `npm run build` passed with the expected large-chunk warning from three.js.
- First `npm run test:e2e` failed because the Playwright Chromium binary was missing.
- Ran `npx playwright install chromium`.
- `npm run test:e2e` passed: 1/1 Chromium test.
- Visual screenshots checked:
  - `test-results/ulg-desktop.png`
  - `test-results/ulg-mobile.png`

Failures and open questions:

- A parallel `pdftotext` extraction/read raced once; reran reads after the text file existed.
- Cross-repo code edits are deferred until sidecar reports return and the ULG local smoke is stable.
- MoonLab sidecar found JS unit failures and missing WASM dist packaging:
  `pnpm --filter @moonlab/quantum-core test:unit` fails 2/90, and integration
  tests fail because `packages/core/dist/moonlab.js` is missing.
- peercompute sidecar verified the current branch is clean and core tests/builds pass.
- ICC/swarm sidecar found ICC indexes for MoonLab and peercompute, but parser refresh
  dependencies are missing until `make install-parsers` runs.
- Eshkol sidecar is still pending as of this update.

Additional commands run:

```bash
npm install
npm test
npm run build
npm run test:e2e
npx playwright install chromium
npm run test:e2e
```
