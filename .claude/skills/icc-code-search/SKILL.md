---
name: icc-code-search
description: Use the Infinite Context Coder (ICC) index for ALL code searches, symbol lookups, dependency traces, and architecture questions in this repo. Trigger whenever locating a function/symbol/file, tracing callers or callees, mapping module structure, or asking "where is X defined/used". Prefer ICC over raw grep for semantic or structural lookups; refresh the index after committing changes.
---

# ICC code search (repo `ulg`)

This repo is indexed by the Infinite Context Coder at
`/home/cos/projects/infinite_context_coder/scripts/codebase_tool.py`,
registered as repo `ulg`. Use it for code lookup and retrieval instead of
scanning large files (several source files here exceed 14k-29k lines).

## Refresh the index (run after landing commits)

```bash
npm run icc:update
```

## Common commands

All subcommands require `--repo ulg`.

```bash
ICC=/home/cos/projects/infinite_context_coder/scripts/codebase_tool.py

# Find a symbol (function/const/class) - fuzzy by default, --exact to pin
python3 $ICC find-symbol --repo ulg --symbol runMlsMpmG2pWebGpu

# Semantic/keyword chunk search (short, concrete phrases work best)
python3 $ICC search-chunks --repo ulg --query "render row bridge" --limit 8 --include-content

# Read a line range without opening the whole file
python3 $ICC read-lines --repo ulg --path src/visualization/sphPhaseScene.js --start 25000 --end 25100

# Locate a file by name fragment
python3 $ICC find-file --repo ulg --name schroederCrossLevel

# Trace who calls / what is called by a symbol
python3 $ICC trace-callers --repo ulg --symbol createSchroederParticleStorageAdoption
python3 $ICC trace-callees --repo ulg --symbol runSchroederSameLevelMechanicsWebGpu

# Module overview / architecture
python3 $ICC module-info --repo ulg --path src/runtime/sph/schroederHierarchyGpu.js
python3 $ICC architecture-summary --repo ulg
```

## Notes

- There is no `search` subcommand; use `search-chunks` (keyword) or
  `find-symbol` (identifier).
- `search-chunks` matches literal-ish tokens; if it returns zero matches,
  try a shorter query or `find-symbol` before falling back to `rg`.
- Exact-string hunting (error messages, WGSL literals) is still fine with
  `rg`/`grep`; ICC is for symbols, structure, and semantics.
- The index goes stale as you edit: re-run `npm run icc:update` after each
  commit so lookups reflect the current tree.
