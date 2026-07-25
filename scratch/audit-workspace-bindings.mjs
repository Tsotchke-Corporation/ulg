// Derive, from the workspace WGSL call graph, the set of bindings each entry
// point actually references, and compare it against the host PIPELINE_BINDINGS
// table. `layout: 'auto'` builds the real layout the same way, so any
// disagreement is a bind-group entry-count validation failure at run time.
import { schroederSpatialParentFieldMechanicsWorkspaceWgsl as CODE }
  from '../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js';

const bindingOf = new Map();
for (const match of CODE.matchAll(
  /@group\(0\) @binding\((\d+)\)\s*var(?:<[^>]*>)?\s*([A-Za-z0-9_]+)/g
)) {
  bindingOf.set(match[2], Number(match[1]));
}

// Split the module into function bodies.
const functions = new Map();
const entryPoints = new Set();
const lines = CODE.split('\n');
let current = null;
let depth = 0;
let sawCompute = false;
let bodyStarted = false;
for (const line of lines) {
  const declaration = line.match(/^fn ([A-Za-z0-9_]+)/);
  if (declaration && current === null) {
    current = declaration[1];
    functions.set(current, []);
    if (sawCompute) entryPoints.add(current);
    depth = 0;
  }
  if (/@compute/.test(line)) sawCompute = true;
  if (current !== null) {
    functions.get(current).push(line);
    const opened = (line.match(/\{/g) || []).length;
    depth += opened;
    depth -= (line.match(/\}/g) || []).length;
    if (opened > 0) bodyStarted = true;
    // Only close once the body brace has actually opened. WGSL signatures wrap
    // across lines for @builtin parameters, and closing on the signature's own
    // newline would truncate the function to its first two lines.
    if (bodyStarted && depth === 0) {
      current = null;
      sawCompute = false;
      bodyStarted = false;
    }
  }
}

const directBindings = new Map();
const directCalls = new Map();
const names = [...functions.keys()];
for (const [name, body] of functions) {
  const text = body.join('\n');
  const bindings = new Set();
  for (const [variable, index] of bindingOf) {
    if (new RegExp(`\\b${variable}\\b`).test(text)) bindings.add(index);
  }
  directBindings.set(name, bindings);
  const calls = new Set();
  for (const callee of names) {
    if (callee !== name && new RegExp(`\\b${callee}\\s*\\(`).test(text)) {
      calls.add(callee);
    }
  }
  directCalls.set(name, calls);
}

const resolve = (name, seen = new Set()) => {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const out = new Set(directBindings.get(name) ?? []);
  for (const callee of directCalls.get(name) ?? []) {
    for (const binding of resolve(callee, seen)) out.add(binding);
  }
  return out;
};

const host = await import(
  '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js'
).then(() => null).catch(() => null);
void host;

const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
  new URL(
    '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js',
    import.meta.url
  ),
  'utf8'
));
const tableMatch = source.match(/const PIPELINE_BINDINGS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
const table = new Map();
for (const entry of tableMatch[1].matchAll(
  /([A-Za-z0-9_]+):\s*(?:\n\s*)?Object\.freeze\(\[([0-9,\s]*)\]\)/g
)) {
  table.set(entry[1], entry[2].split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)));
}

const ENTRY_TO_PIPELINE = {
  initialize_parent_field_workspace: 'initialize',
  register_reflux_coarse_registry: 'registerReflux',
  restrict_fine_field_state: 'restrictFine',
  finalize_fine_parent_baseline: 'finalizeBaseline',
  inject_coarse_native_state: 'injectCoarse',
  validate_reflux_coarse_registry_mass: 'validateRegistry',
  update_parent_field_predictors: 'updatePredictors',
  contact_parent_field_predictors: 'contactPredictors',
  seal_parent_field_predictors: 'sealPredictors',
  begin_fine_velocity_correction: 'beginFine',
  validate_fine_velocity_correction: 'validateFine',
  validate_routed_coarse_cfl: 'validateRoutedCoarse',
  seal_fine_correction_alpha: 'sealFineAlpha',
  prepare_fine_transaction: 'prepareFine',
  apply_fine_velocity_correction: 'applyFine',
  apply_fine_route_heat: 'applyFineHeat',
  commit_routed_reflux: 'commitReflux',
  finalize_fine_velocity_correction: 'finalizeFine',
  admit_cross_level_phase_volume: 'admitCrossLevelPhaseVolume',
  propose_cross_level_phase_volume: 'proposeCrossLevelPhaseVolume',
  initialize_coarse_terminal_workspace: 'initializeTerminal',
  register_coarse_terminal_registry: 'registerTerminal',
  seal_coarse_terminal_workspace: 'sealTerminal',
  begin_coarse_terminal_validation: 'prevalidateCoarse',
  begin_coarse_velocity_publish: 'beginCoarse',
  validate_coarse_velocity_publish: 'validateCoarse',
  seal_coarse_velocity_publish: 'sealCoarse',
  prepare_coarse_transaction: 'prepareCoarse',
  apply_coarse_reflux_rows: 'applyCoarseRows',
  apply_coarse_velocity_publish: 'applyCoarse',
  commit_coarse_reflux: 'commitCoarse',
  finalize_coarse_velocity_publish: 'finalizeCoarse'
};

let mismatches = 0;
for (const [entry, pipelineName] of Object.entries(ENTRY_TO_PIPELINE)) {
  if (!functions.has(entry)) {
    console.log(`MISSING ENTRY IN WGSL: ${entry}`);
    continue;
  }
  const derived = [...resolve(entry)].sort((a, b) => a - b);
  const declared = (table.get(pipelineName) ?? []).slice().sort((a, b) => a - b);
  const missing = derived.filter((b) => !declared.includes(b));
  const extra = declared.filter((b) => !derived.includes(b));
  if (missing.length || extra.length) {
    mismatches += 1;
    console.log(
      `${pipelineName}: declared=[${declared}] derived=[${derived}]`
      + (missing.length ? ` MISSING=[${missing}]` : '')
      + (extra.length ? ` EXTRA=[${extra}]` : '')
    );
  }
}
console.log(mismatches === 0 ? 'ALL PIPELINE BINDINGS AGREE' : `${mismatches} mismatched pipelines`);
