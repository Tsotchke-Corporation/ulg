import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  mlsMpmG2pReconstructCanonicalSpatialWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationApplyCanonicalSpatialWgsl,
  mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl,
  mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationComputeCanonicalSpatialWgsl,
  mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl,
  schroederSpatialAggregateStacklessTraversalWgsl,
  schroederSpatialAggregateViewWgsl
} from '../ulg-gpu-abi/src/index.js';
import {
  sphThermalStepWgsl as canonicalSphThermalStepWgsl
} from '../src/runtime/sph/sphThermalGpuKernel.js';

function readRepoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveNumericExpression(source, expression) {
  const trimmed = String(expression).trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  const match = source.match(new RegExp(`const\\s+${escapeRegExp(trimmed)}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `could not resolve numeric expression ${trimmed}`);
  return Number.parseInt(match[1], 10);
}

function extractFunctionBody(source, functionName) {
  const needle = `function ${functionName}`;
  const start = source.indexOf(needle);
  assert.notEqual(start, -1, `missing ${functionName}`);
  const parenOpen = source.indexOf('(', start);
  assert.notEqual(parenOpen, -1, `missing ${functionName} parameter list`);
  let parenDepth = 0;
  let parenClose = -1;
  for (let index = parenOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') parenDepth += 1;
    if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        parenClose = index;
        break;
      }
    }
  }
  assert.notEqual(parenClose, -1, `unterminated ${functionName} parameter list`);
  const open = source.indexOf('{', parenClose);
  assert.notEqual(open, -1, `missing ${functionName} body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`unterminated ${functionName} body`);
}

function paramsArrayByteLength(source, functionName) {
  const body = extractFunctionBody(source, functionName);
  const direct = body.match(/new\s+ArrayBuffer\(\s*([^)]+?)\s*\)/);
  assert.ok(direct, `${functionName} must create or delegate to a fixed ArrayBuffer`);
  return resolveNumericExpression(source, direct[1]);
}

function uniformBufferByteLength(source, label) {
  const pattern = new RegExp(
    `label:\\s*['"]${escapeRegExp(label)}['"][\\s\\S]*?size:\\s*([^,\\n]+)`,
    'm'
  );
  const match = source.match(pattern);
  assert.ok(match, `${label} must be created with an explicit uniform size`);
  return resolveNumericExpression(source, match[1]);
}

function writeUsesFactory(source, label, factoryName) {
  const labelIndex = source.indexOf(`label: '${label}'`);
  assert.notEqual(labelIndex, -1, `${label} label is missing`);
  const tail = source.slice(labelIndex);
  const relativeWrite = tail.search(
    /device\.queue\.writeBuffer\(\s*paramsBuffer\s*,\s*0\s*,/
  );
  assert.notEqual(relativeWrite, -1, `${label} params write is missing`);
  const writeIndex = labelIndex + relativeWrite;
  const nextWrite = source.indexOf('device.queue.writeBuffer(', writeIndex + 1);
  assert.match(
    source.slice(writeIndex, nextWrite < 0 ? source.length : nextWrite),
    new RegExp(`\\b${escapeRegExp(factoryName)}\\s*\\(`),
    `${label} must be written with ${factoryName}()`
  );
}

function wgslScalarParamStructByteLengths(wgslSource, structName) {
  const pattern = new RegExp(`struct\\s+${escapeRegExp(structName)}\\s*\\{([\\s\\S]*?)\\};`, 'g');
  const byteLengths = [];
  for (const match of wgslSource.matchAll(pattern)) {
    const body = match[1];
    const fields = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));
    let offset = 0;
    for (const field of fields) {
      const fieldMatch = field.match(/^[_A-Za-z][_A-Za-z0-9]*:\s*([A-Za-z0-9_<>]+),?$/);
      assert.ok(fieldMatch, `${structName} has an unsupported field declaration: ${field}`);
      assert.match(fieldMatch[1], /^(u32|i32|f32)$/, `${structName} must stay scalar-only for this ABI guard`);
      offset += 4;
    }
    byteLengths.push(Math.ceil(offset / 16) * 16);
  }
  assert.ok(byteLengths.length > 0, `missing WGSL struct ${structName}`);
  return byteLengths;
}

function wgslStorageBindingIndices(wgslSource) {
  return [...wgslSource.matchAll(
    /@group\(0\)\s+@binding\((\d+)\)\s+var<storage(?:,\s*[^>]+)?>/g
  )].map((match) => Number.parseInt(match[1], 10));
}

const CONTRACTS = [
  {
    file: 'src/runtime/sph/sphGridGpuKernel.js',
    label: 'ulg-mls-mpm-p2g-params',
    factory: 'createProjectionParamsArray',
    wgslStruct: 'P2gProjectionParams',
    // 64 -> 80: grid-density pressure fields. 80 -> 96: canonical SS
    // generation/storage/position/topology identity and admission. 96 -> 144:
    // the remaining device/lane/lease/source/tick/chart/level/support identity
    // fields required to reject a stale or cross-lane directory in WGSL.
    // The mechanics-field specialization appends a separate 16-byte mutation
    // claim tail without changing this base ABI.
    bytes: 144
  },
  {
    file: 'src/runtime/sph/sphGridUpdateGpuKernel.js',
    label: 'ulg-mls-mpm-grid-update-params',
    factory: 'createGridUpdateParamsArray',
    wgslStruct: 'GridUpdateParams',
    bytes: 80
  },
  {
    file: 'src/runtime/sph/sphPressureInterfaceGpuKernel.js',
    label: 'ulg-sph-pressure-interface-force-params',
    factory: 'createPressureInterfaceParamsArray',
    wgslStruct: 'PressureInterfaceParams',
    // Exact GPU gas-pressure authority adds execution/storage generation,
    // row-capacity, and row-stride authentication words.
    bytes: 48
  },
  {
    file: 'src/runtime/sph/sphG2pGpuKernel.js',
    label: 'ulg-mls-mpm-g2p-params',
    factory: 'createParamsArray',
    wgslStruct: 'G2pParams',
    bytes: 80
  },
  {
    file: 'src/runtime/sph/sphThermalGpuKernel.js',
    label: 'ulg-sph-thermal-params',
    factory: 'createParamsArray',
    wgslStruct: 'ThermalParams',
    wgslSource: canonicalSphThermalStepWgsl,
    // 80 -> 96: shared neighbor-bin fields (bins_enabled, capacity, dims,
    // cell size) for binned pair conduction.
    // 96 -> 112: max_pair_support_m (+16B pad) so the neighbor scan covers
    // rest-volume contact radii of coarse low-density particles. 112 -> 144:
    // canonical SS proposal/generation identity and admission fields.
    bytes: 144
  },
  {
    file: 'src/runtime/sph/sphReactionGpuKernel.js',
    label: 'ulg-sph-reaction-params',
    factory: 'createParamsArray',
    wgslStruct: 'ReactionParams',
    bytes: 48
  },
  {
    file: 'src/runtime/sph/sphReactionGpuSummary.js',
    label: 'ulg-sph-reaction-summary-params',
    factory: 'createSummaryParamsArray',
    wgslStruct: 'ReactionSummaryParams',
    bytes: 48
  },
  {
    file: 'src/runtime/sph/sphMechanicsGpuKernel.js',
    label: 'ulg-mls-mpm-predict-params',
    factory: 'createParamsArray',
    wgslStruct: 'MechanicsParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
    label: 'ulg-mls-mpm-mechanics-refresh-params',
    factory: 'createParamsArray',
    wgslStruct: 'MechanicsRefreshParams',
    bytes: 16
  },
  {
    file: 'src/runtime/sph/sphMlsMpmGpuSummary.js',
    label: 'ulg-mls-mpm-resident-summary-params',
    factory: 'createSummaryParamsArray',
    wgslStruct: 'ResidentSummaryParams',
    bytes: 48
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-render-rows-params',
    factory: 'createParamsArray',
    wgslStruct: 'RenderRowsParams',
    bytes: 48
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-render-field-params',
    factory: 'createRenderFieldParamsArray',
    wgslStruct: 'RenderFieldParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-interface-candidate-params',
    factory: 'createMaterialInterfaceCandidateParamsArray',
    wgslStruct: 'InterfaceCandidateParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-render-field-surface-summary-params',
    factory: 'createRenderFieldSurfaceSummaryParamsArray',
    wgslStruct: 'SurfaceSummaryParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-marching-cube-cell-params',
    factory: 'createMarchingCubesCandidateParamsArray',
    arrayFactory: 'createMaterialInterfaceCandidateParamsArray',
    wgslStruct: 'MarchingCubesCandidateParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-surface-vertex-params',
    factory: 'createSurfaceVerticesParamsArray',
    wgslStruct: 'SurfaceVertexParams',
    bytes: 32
  },
  {
    file: 'src/runtime/sph/sphRenderGpuKernel.js',
    label: 'ulg-sph-surface-draw-params',
    factory: 'createSurfaceDrawParamsArray',
    wgslStruct: 'SurfaceDrawParams',
    bytes: 16
  }
];

test('SPH WebGPU params structs match JS packing and uniform buffer sizes', () => {
  const wgslSource = readRepoText('ulg-gpu-abi/src/wgsl.js');
  const sourceCache = new Map();
  for (const contract of CONTRACTS) {
    const source = sourceCache.get(contract.file) ?? readRepoText(contract.file);
    sourceCache.set(contract.file, source);
    const arrayBytes = paramsArrayByteLength(source, contract.arrayFactory ?? contract.factory);
    const uniformBytes = uniformBufferByteLength(source, contract.label);
    const wgslBytes = wgslScalarParamStructByteLengths(
      contract.wgslSource ?? wgslSource,
      contract.wgslStruct
    );

    assert.equal(arrayBytes, contract.bytes, `${contract.factory} ArrayBuffer byte length drifted`);
    assert.equal(uniformBytes, contract.bytes, `${contract.label} uniform buffer byte length drifted`);
    assert.deepEqual(
      [...new Set(wgslBytes)],
      [contract.bytes],
      `${contract.wgslStruct} WGSL byte length drifted`
    );
    writeUsesFactory(source, contract.label, contract.factory);
  }
});

test('SPH WGSL source avoids reserved local identifiers rejected by browsers', () => {
  const wgslSource = readRepoText('ulg-gpu-abi/src/wgsl.js');
  assert.doesNotMatch(
    wgslSource,
    /\b(?:let|var|const)\s+active\b/,
    'WGSL parser rejects active as a reserved local identifier'
  );
});

test('Schroeder Morton-prefix aggregate and stackless traversal match their JS ABI', () => {
  assert.deepEqual(
    wgslScalarParamStructByteLengths(
      schroederSpatialAggregateViewWgsl,
      'AggregateParams'
    ),
    [256]
  );
  assert.deepEqual(
    wgslScalarParamStructByteLengths(
      schroederSpatialAggregateStacklessTraversalWgsl,
      'AggregateTraversalParams'
    ),
    [128]
  );
  const buildBindings = wgslStorageBindingIndices(
    schroederSpatialAggregateViewWgsl
  );
  assert.equal(new Set(buildBindings).size, buildBindings.length);
  assert.equal(buildBindings.length, 9);
  const traversalBindings = wgslStorageBindingIndices(
    schroederSpatialAggregateStacklessTraversalWgsl
  );
  assert.equal(new Set(traversalBindings).size, traversalBindings.length);
  assert.equal(traversalBindings.length, 3);
  const runtimeSource = readRepoText(
    'src/runtime/sph/schroederSpatialAggregateViewGpu.js'
  );
  assert.match(
    runtimeSource,
    /dispatchWorkgroupsIndirect\(buffer, offset\)/,
    'aggregate prefix passes must execute from a separate indirect-dispatch buffer'
  );
  assert.match(
    runtimeSource,
    /indirectDispatchBuffer:\s*arena\.dispatchBuffer/,
    'aggregate execution must expose the separate indirect-dispatch authority'
  );
  assert.doesNotMatch(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /candidate_(?:rows|budget)/i
  );
  assert.doesNotMatch(
    schroederSpatialAggregateViewWgsl,
    /\b(?:let|var|const)\s+target\b/,
    'WGSL parser rejects target as a reserved local identifier'
  );
});

test('MLS-MPM P2G shader scatters particles in parallel instead of scanning particle_count per grid node', () => {
  const wgslSource = readRepoText('ulg-gpu-abi/src/wgsl.js');
  const match = wgslSource.match(/export const mlsMpmP2gGridProjectionWgsl = `([\s\S]*?)`;/);
  assert.ok(match, 'missing mlsMpmP2gGridProjectionWgsl export');
  const p2gSource = match[1];

  assert.match(p2gSource, /let particle_index = global_id\.x;/);
  assert.match(p2gSource, /atomicAdd\(&grid_accumulators/);
  assert.match(p2gSource, /fn finalize_grid/);
  assert.doesNotMatch(
    p2gSource,
    /for\s*\(\s*var\s+particle_index\s*=\s*0u;\s*particle_index\s*<\s*params\.particle_count/,
    'MLS-MPM P2G must not scan every particle inside each grid-node invocation'
  );
});

test('canonical Schroeder mechanics P2G and G2P use one directory authority without assignment lookup', () => {
  const canonicalMechanicsShaders = [
    ['P2G', mlsMpmP2gGridProjectionCanonicalSpatialWgsl],
    ['G2P', mlsMpmG2pReconstructCanonicalSpatialWgsl]
  ];

  for (const [label, wgslSource] of canonicalMechanicsShaders) {
    assert.doesNotMatch(
      wgslSource,
      /var<storage[^>]*>\s+schroeder_level_assignments\b/,
      `${label} must not declare the pre-canonical assignment buffer`
    );
    assert.doesNotMatch(
      wgslSource,
      /\bschroeder_level_assignments\s*\[/,
      `${label} must not perform a pre-canonical assignment lookup`
    );
    assert.match(
      wgslSource,
      /@group\(0\)\s+@binding\(7\)\s+var<storage,\s*read_write>\s+schroeder_spatial_authority_evidence:\s*array<atomic<u32>>;/,
      `${label} must bind shared mechanics authority evidence at binding 7`
    );
    assert.match(
      wgslSource,
      /@group\(0\)\s+@binding\(8\)\s+var<storage,\s*read>\s+schroeder_spatial_directory:\s*array<u32>;/,
      `${label} must bind the canonical spatial directory at binding 8`
    );
    assert.match(
      wgslSource,
      /schroeder_spatial_directory\s*\[/,
      `${label} must resolve spatial membership from the canonical directory`
    );
  }
});

test('canonical particle separation is fail-closed on shared mechanics authority evidence', () => {
  const canonicalSeparationShaders = [
    ['bin fill', 4, mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl],
    ['compute', 5, mlsMpmParticleSeparationComputeCanonicalSpatialWgsl],
    ['apply', 4, mlsMpmParticleSeparationApplyCanonicalSpatialWgsl]
  ];

  for (const [label, binding, wgslSource] of canonicalSeparationShaders) {
    assert.match(
      wgslSource,
      new RegExp(
        `@group\\(0\\)\\s+@binding\\(${binding}\\)\\s+var<storage,\\s*read>`
          + '\\s+mechanics_spatial_authority_evidence:\\s*array<u32>;'
      ),
      `${label} must bind the shared mechanics authority evidence`
    );
    for (const rejectedWord of [14, 15, 16, 17]) {
      assert.match(
        wgslSource,
        new RegExp(`mechanics_spatial_authority_evidence\\[${rejectedWord}u\\]\\s*!=\\s*0u`),
        `${label} must reject evidence word ${rejectedWord}`
      );
    }
    if (label === 'bin fill') {
      assert.match(
        wgslSource,
        /if\s*\(separation_mechanics_spatial_authority_rejected\(\)\)[\s\S]*in_state\[state_base\]\s*=\s*authority_restore_state\[state_base\][\s\S]*in_mechanics\[mechanics_base \+ row\]\s*=\s*authority_restore_mechanics\[mechanics_base \+ row\][\s\S]*return;/,
        'bin fill must globally restore immutable particle rows before stopping'
      );
    } else {
      assert.match(
        wgslSource,
        /if\s*\(separation_mechanics_spatial_authority_rejected\(\)\)\s*\{\s*return;/,
        `${label} must stop before mutating particles when authority was rejected`
      );
    }
  }
});

test('canonical G2P globally restores immutable inputs after any reverse-map rejection', () => {
  assert.match(
    mlsMpmG2pReconstructCanonicalSpatialWgsl,
    /fn\s+g2p_spatial_authority_rejected\(\)[\s\S]*atomicLoad\(&schroeder_spatial_authority_evidence\[16u\]\)[\s\S]*atomicLoad\(&schroeder_spatial_authority_evidence\[17u\]\)/
  );
  assert.match(
    mlsMpmG2pReconstructCanonicalSpatialWgsl,
    /@compute\s+@workgroup_size\(64\)\s+fn\s+finalize_canonical_spatial_authority[\s\S]*g2p_spatial_authority_rejected\(\)[\s\S]*g2p_copy_input_particle\(particle_index \* 2u, particle_index \* 8u\)/
  );
  assert.match(
    mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl,
    /authority_restore_state[\s\S]*authority_restore_mechanics[\s\S]*separation_mechanics_spatial_authority_rejected\(\)[\s\S]*in_state\[state_base\]\s*=\s*authority_restore_state\[state_base\]/
  );
});

test('unobserved canonical mechanics retains one mandatory rejection summary without success atomics', () => {
  for (const [label, prefix, wgslSource] of [
    ['P2G', 'p2g', mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl],
    ['G2P', 'g2p', mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl]
  ]) {
    assert.match(
      wgslSource,
      new RegExp(`fn ${prefix}_spatial_evidence_add\\(word: u32, value: u32\\) \\{\\s*\\}`),
      `${label} must compile optional success evidence out of the production hot path`
    );
    assert.match(
      wgslSource,
      new RegExp(
        `fn ${prefix}_spatial_reject\\(word: u32\\)[\\s\\S]*atomicStore\\(`
          + '&schroeder_spatial_authority_evidence\\[14u\\], 1u\\)'
      ),
      `${label} must preserve a mandatory rejection summary`
    );
  }

  for (const [label, wgslSource] of [
    ['bin fill', mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl],
    ['compute', mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl],
    ['apply', mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl]
  ]) {
    assert.match(
      wgslSource,
      /fn separation_mechanics_spatial_authority_rejected\(\) -> bool \{\s*return mechanics_spatial_authority_evidence\[14u\] != 0u;\s*\}/,
      `${label} must consume the production rejection summary`
    );
  }
});

test('canonical Schroeder mechanics shaders stay within eight storage bindings', () => {
  const shaders = [
    ['P2G', mlsMpmP2gGridProjectionCanonicalSpatialWgsl],
    ['P2G unobserved', mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl],
    ['G2P', mlsMpmG2pReconstructCanonicalSpatialWgsl],
    ['G2P unobserved', mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl],
    ['separation bin fill', mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl],
    ['separation bin fill unobserved', mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl],
    ['separation compute', mlsMpmParticleSeparationComputeCanonicalSpatialWgsl],
    ['separation compute unobserved', mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl],
    ['separation apply', mlsMpmParticleSeparationApplyCanonicalSpatialWgsl],
    ['separation apply unobserved', mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl]
  ];

  for (const [label, wgslSource] of shaders) {
    const bindings = wgslStorageBindingIndices(wgslSource);
    assert.equal(
      new Set(bindings).size,
      bindings.length,
      `${label} must not redeclare a storage binding`
    );
    assert.ok(
      bindings.length <= 8,
      `${label} uses ${bindings.length} storage bindings; portable WebGPU allows eight`
    );
  }

  const fusedStepSource = readRepoText('src/runtime/sph/sphMlsMpmGpuStep.js');
  const activeGridTransform = extractFunctionBody(
    fusedStepSource,
    'createActiveGridP2gProjectionWgsl'
  );
  assert.doesNotMatch(
    activeGridTransform,
    /@group\(|@binding\(/,
    'the active-grid transform must preserve the canonical P2G storage-binding set'
  );
  assert.match(
    fusedStepSource,
    /createActiveGridP2gProjectionWgsl\(mlsMpmP2gGridProjectionCanonicalSpatialWgsl\)/,
    'the observed active-grid variant must derive from the guarded canonical shader'
  );
  assert.match(
    fusedStepSource,
    /createActiveGridP2gProjectionWgsl\(\s*mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl\s*\)/,
    'the production active-grid variant must derive from the guarded canonical shader'
  );
});
