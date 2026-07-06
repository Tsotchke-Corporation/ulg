import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
  const writeIndex = source.indexOf(`device.queue.writeBuffer(paramsBuffer, 0, ${factoryName}(`, labelIndex);
  assert.notEqual(writeIndex, -1, `${label} must be written with ${factoryName}()`);
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

const CONTRACTS = [
  {
    file: 'src/runtime/sph/sphGridGpuKernel.js',
    label: 'ulg-mls-mpm-p2g-params',
    factory: 'createProjectionParamsArray',
    wgslStruct: 'P2gProjectionParams',
    // 64 -> 80: grid_density_pressure_enabled + pads (spatial-density EOS
    // term sampled from the previous substep's finalized grid).
    bytes: 80
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
    bytes: 32
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
    // 80 -> 96: shared neighbor-bin fields (bins_enabled, capacity, dims,
    // cell size) for binned pair conduction.
    bytes: 96
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
    bytes: 32
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
    const wgslBytes = wgslScalarParamStructByteLengths(wgslSource, contract.wgslStruct);

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
