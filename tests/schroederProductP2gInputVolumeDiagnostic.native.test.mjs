import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PRODUCT_P2G_INPUT_VOLUME_DIAGNOSTIC === '1';
const BASE_URL =
  process.env.ULG_PRODUCT_P2G_INPUT_VOLUME_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME =
  process.env.ULG_PRODUCT_P2G_INPUT_VOLUME_CHROME
  || '/usr/bin/google-chrome';

const RECEIPT_MAGIC = 0x50325644;
const RECEIPT_VERSION = 1;
const RECEIPT_WORDS = 320;
const CASE_WORDS = 72;
const CASE_BASES = Object.freeze([4, 76, 148]);
const GLOBAL_SEAL_WORD = 223;
const STAGE_DIAGNOSTIC_BASE = 224;
const GENERATION_FIELD_SNAPSHOT_BASE = 288;
const GENERATION_FIELD_SNAPSHOT_WORDS = 17;
const GENERATION_FIELD_SNAPSHOT_MAGIC = 0x46325047;
const FIELD_CANDIDATE_SUBREASON = Object.freeze({
  SORTED_CANDIDATE_OUT_OF_RANGE: 1 << 0,
  ACTIVE_TO_PHYSICAL_MAPPING_INVALID: 1 << 1,
  UNIQUE_HEAD_PREFIX_EMPTY: 1 << 2,
  MATERIALIZED_FIELD_INDEX_OUT_OF_RANGE: 1 << 3,
  UNIQUE_KEY_ORDER_INVALID: 1 << 4,
  PARENT_NODE_MISSING: 1 << 5,
  PACKED_IDENTITY_INVALID: 1 << 6
});
const COMPACT_MECHANICS_REJECT_REASONS = Object.freeze([
  'SPATIAL_AUTHORITY_REJECT_WRAPPER',
  'P2G_FIELD_REJECT_WRAPPER',
  'COMPACT_BUFFER_TOO_SMALL',
  'COMPACT_DIRECTORY_OR_QUERY_REJECTED',
  'COMPACT_MAGIC_VERSION_INVALID',
  'COMPACT_STATUS_INVALID',
  'COMPACT_PREFLIGHT_BUFFER_TOO_SMALL',
  'COMPACT_OWNER_IDENTITY_INVALID',
  'COMPACT_STORAGE_TICK_IDENTITY_INVALID',
  'COMPACT_EPOCH_IDENTITY_INVALID',
  'COMPACT_SOURCE_COUNT_LEVEL_COMPLETION_INVALID',
  'COMPACT_GRID_DIMS_ZERO',
  'COMPACT_GRID_GEOMETRY_INVALID',
  'COMPACT_SOURCE_TOPOLOGY_COUNTS_INVALID',
  'COMPACT_STENCIL_COUNTS_INVALID',
  'COMPACT_NODE_OFFSET_OVERFLOW',
  'COMPACT_NODE_LAYOUT_INVALID',
  'COMPACT_SOURCE_ROW_LAYOUT_INVALID',
  'COMPACT_DISPATCH_HEADER_INVALID',
  'COMPACT_DISPATCH_ARGS_INVALID',
  'COMPACT_NODE_VALIDATION_BUFFER_TOO_SMALL',
  'COMPACT_NODE_VALIDATION_RANGE_INVALID',
  'COMPACT_NODE_ORDER_INVALID',
  'FIELD_MUTATION_CLAIM_PREFLIGHT_INVALID',
  'FIELD_MUTATION_CAS_INVALID'
]);
const P2G_FIELD_REJECT_REASONS = Object.freeze([
  'CONTRIBUTION_CLEAR_CANDIDATE_RANGE_INVALID',
  'CONTRIBUTION_CLEAR_BUFFER_RANGE_INVALID',
  'CONTRIBUTION_FIELD_LOOKUP_INVALID',
  'CONTRIBUTION_VALUES_INVALID',
  'CONTRIBUTION_DESTINATION_RANGE_INVALID',
  'ACTIVE_TO_PHYSICAL_MAPPING_INVALID',
  'MAIN_FIELD_NOT_ADMITTED',
  'REDUCTION_GROUP_LOWER_BOUND_INVALID',
  'REDUCTION_GROUP_ORDER_INVALID',
  'REDUCTION_CANDIDATE_ORDER_INVALID',
  'REDUCTION_FIELD_LOOKUP_INVALID',
  'REDUCTION_CONTRIBUTION_ROW_INVALID',
  'REDUCTION_ACCUMULATED_VALUES_INVALID',
  'REDUCTION_FINAL_PRESSURE_INVALID',
  'FIELD_STRUCTURAL_PREFLIGHT_INVALID',
  'FIELD_HEADER_PREFLIGHT_INVALID',
  'FIELD_LAYOUT_PREFLIGHT_INVALID',
  'FIELD_KEY_ORDER_INVALID',
  'FIELD_SEAL_ADMISSION_INVALID',
  'FIELD_PRESSURE_CONSUMER_MASK_INVALID'
]);

function decodeFieldCandidateSubreasons(bits) {
  return Object.entries(FIELD_CANDIDATE_SUBREASON)
    .filter(([, flag]) => (bits & flag) !== 0)
    .map(([name]) => name);
}

function decodeRejectReasons(bits, reasons) {
  return reasons
    .filter((_, ordinal) => (bits & (2 ** ordinal)) !== 0);
}

test('native product P2G input-volume diagnostic separates invalid V0 from invalid J', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PRODUCT_P2G_INPUT_VOLUME_DIAGNOSTIC=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.route('**/@vite/client', (route) => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
export const createHotContext = () => ({
  accept() {},
  acceptExports() {},
  decline() {},
  dispose() {},
  prune() {},
  invalidate() {},
  on() {},
  off() {},
  send() {}
});
export const injectQuery = (url) => url;
export const updateStyle = () => {};
export const removeStyle = () => {};
`
    }));
    await page.route(
      '**/ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js*',
      async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const exportNeedle = [
          'export const schroederSpatialMechanicsFieldViewV2Wgsl =',
          '  createSchroederSpatialMechanicsFieldViewV2Wgsl();'
        ].join('\n');
        const instrumentedExport = `
function instrumentProductP2gFieldCandidateSubreasons(wgsl) {
  const materializeStart = wgsl.indexOf(
    'fn materialize_stencil_field_indices_v2('
  );
  const assembleStart = wgsl.indexOf(
    'fn assemble_field_keys_v2(',
    materializeStart
  );
  const finalizeStart = wgsl.indexOf(
    'fn field_reject(',
    assembleStart
  );
  if (
    materializeStart < 0
    || assembleStart < 0
    || finalizeStart < 0
  ) {
    throw new Error(
      'product P2G field diagnostic could not locate v2 rejection kernels'
    );
  }

  let materialize = wgsl.slice(materializeStart, assembleStart);
  const materializeReplacements = [
    [
      \`if (candidate_index >= candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`,
      \`if (candidate_index >= candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.SORTED_CANDIDATE_OUT_OF_RANGE}u);
    return;
  }\`
    ],
    [
      \`if (source_index == ACTIVE_SOURCE_MISSING || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`,
      \`if (source_index == ACTIVE_SOURCE_MISSING || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.ACTIVE_TO_PHYSICAL_MAPPING_INVALID}u);
    return;
  }\`
    ],
    [
      \`if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`,
      \`if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.UNIQUE_HEAD_PREFIX_EMPTY}u);
    return;
  }\`
    ],
    [
      \`if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`,
      \`if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.MATERIALIZED_FIELD_INDEX_OUT_OF_RANGE}u);
    return;
  }\`
    ]
  ];
  for (const [needle, replacement] of materializeReplacements) {
    if (!materialize.includes(needle)) {
      throw new Error(
        'product P2G field diagnostic missed a materialize rejection branch'
      );
    }
    materialize = materialize.replace(needle, replacement);
  }

  let assemble = wgsl.slice(assembleStart, finalizeStart);
  const orderAndParentNeedle =
    \`if (!ordered || !field_parent_contains_node(node_index)) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`;
  const orderAndParentReplacement =
    \`if (!ordered) {
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.UNIQUE_KEY_ORDER_INVALID}u);
    return;
  }
  if (!field_parent_contains_node(node_index)) {
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.PARENT_NODE_MISSING}u);
    return;
  }\`;
  if (!assemble.includes(orderAndParentNeedle)) {
    throw new Error(
      'product P2G field diagnostic missed order/parent rejection'
    );
  }
  assemble = assemble.replace(
    orderAndParentNeedle,
    orderAndParentReplacement
  );
  const identityNeedle =
    \`if (!identity_admitted) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }\`;
  const identityReplacement =
    \`if (!identity_admitted) {
    atomicAdd(&field_view[58u], 1u);
    atomicOr(&field_view[59u], ${FIELD_CANDIDATE_SUBREASON.PACKED_IDENTITY_INVALID}u);
    return;
  }\`;
  if (!assemble.includes(identityNeedle)) {
    throw new Error(
      'product P2G field diagnostic missed packed-identity rejection'
    );
  }
  assemble = assemble.replace(identityNeedle, identityReplacement);

  let instrumented =
    wgsl.slice(0, materializeStart)
    + materialize
    + assemble
    + wgsl.slice(finalizeStart);
  const rejectClearNeedle =
    'for (var word = 50u; word < 60u; word = word + 1u)';
  if (!instrumented.includes(rejectClearNeedle)) {
    throw new Error(
      'product P2G field diagnostic missed fail-closed reason clearing'
    );
  }
  instrumented = instrumented.replace(
    rejectClearNeedle,
    'for (var word = 50u; word < 59u; word = word + 1u)'
  );
  const subreasonWriteCount = instrumented
    .split('atomicOr(&field_view[59u],')
    .length - 1;
  if (subreasonWriteCount != 7) {
    throw new Error(
      'product P2G field diagnostic did not instrument all seven branches'
    );
  }
  return instrumented;
}

export const schroederSpatialMechanicsFieldViewV2Wgsl =
  instrumentProductP2gFieldCandidateSubreasons(
    createSchroederSpatialMechanicsFieldViewV2Wgsl()
  );`;
        if (!source.includes(exportNeedle)) {
          throw new Error(
            'product P2G diagnostic could not install field WGSL transform'
          );
        }
        await route.fulfill({
          response,
          body: source.replace(exportNeedle, instrumentedExport),
          contentType: 'application/javascript'
        });
      }
    );
    await page.route(
      '**/src/runtime/sph/sphMlsMpmGpuStep.js*',
      async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const observedExport = [
          'export const mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl =',
          '  createActiveSourceV2MechanicsFieldP2gWgsl(',
          '    mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl',
          '  );'
        ].join('\n');
        const unobservedExport = [
          'export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl =',
          '  createActiveSourceV2MechanicsFieldP2gWgsl(',
          '    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl',
          '  );'
        ].join('\n');
        const instrumentation = `
function instrumentProductP2gRejectReasons(wgsl) {
  let compactOrdinal = 0;
  const compactCallNeedle = 'compact_mechanics_view_reject();';
  let instrumented = wgsl.replaceAll(compactCallNeedle, () => {
    const diagnosticReason = 2 ** compactOrdinal;
    compactOrdinal += 1;
    return 'compact_mechanics_view_reject('
      + diagnosticReason
      + 'u);';
  });
  if (compactOrdinal != 25) {
    throw new Error(
      'product P2G diagnostic expected 25 compact rejection sites, found '
        + compactOrdinal
    );
  }
  const compactFunctionNeedle =
    'fn compact_mechanics_view_reject() {';
  if (instrumented.split(compactFunctionNeedle).length - 1 != 1) {
    throw new Error(
      'product P2G diagnostic could not uniquely locate compact rejection'
    );
  }
  instrumented = instrumented.replace(
    compactFunctionNeedle,
    [
      'fn compact_mechanics_view_reject(diagnostic_reason: u32) {',
      '  if (arrayLength(&grid_accumulators) > 35u) {',
      '    atomicOr(',
      '      &grid_accumulators[35u],',
      '      bitcast<i32>(diagnostic_reason)',
      '    );',
      '  }'
    ].join('\\n')
  );

  let fieldOrdinal = 0;
  const fieldCallNeedle = 'p2g_field_reject();';
  instrumented = instrumented.replaceAll(fieldCallNeedle, () => {
    const diagnosticReason = 2 ** fieldOrdinal;
    fieldOrdinal += 1;
    return 'p2g_field_reject(' + diagnosticReason + 'u);';
  });
  if (fieldOrdinal != 20) {
    throw new Error(
      'product P2G diagnostic expected 20 field rejection sites, found '
        + fieldOrdinal
    );
  }
  const fieldFunctionNeedle = 'fn p2g_field_reject() {';
  if (instrumented.split(fieldFunctionNeedle).length - 1 != 1) {
    throw new Error(
      'product P2G diagnostic could not uniquely locate field rejection'
    );
  }
  instrumented = instrumented.replace(
    fieldFunctionNeedle,
    [
      'fn p2g_field_reject(diagnostic_reason: u32) {',
      '  if (arrayLength(&grid_accumulators) > 58u) {',
      '    atomicOr(',
      '      &grid_accumulators[58u],',
      '      bitcast<i32>(diagnostic_reason)',
      '    );',
      '  }'
    ].join('\\n')
  );
  return instrumented;
}
`;
        const instrumentedObservedExport = [
          'export const mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl =',
          '  instrumentProductP2gRejectReasons(',
          '    createActiveSourceV2MechanicsFieldP2gWgsl(',
          '      mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl',
          '    )',
          '  );'
        ].join('\n');
        const instrumentedUnobservedExport = [
          'export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl =',
          '  instrumentProductP2gRejectReasons(',
          '    createActiveSourceV2MechanicsFieldP2gWgsl(',
          '      mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl',
          '    )',
          '  );'
        ].join('\n');
        if (
          !source.includes(observedExport)
          || !source.includes(unobservedExport)
        ) {
          throw new Error(
            'product P2G diagnostic could not install final WGSL transform'
          );
        }
        const instrumentedSource = source
          .replace(
            observedExport,
            instrumentation + instrumentedObservedExport
          )
          .replace(unobservedExport, instrumentedUnobservedExport);
        await route.fulfill({
          response,
          body: instrumentedSource,
          contentType: 'application/javascript'
        });
      }
    );
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({
      receiptMagic,
      receiptVersion,
      receiptWords,
      caseWords,
      caseBases,
      globalSealWord,
      stageDiagnosticBase,
      generationFieldSnapshotBase,
      generationFieldSnapshotWords,
      generationFieldSnapshotMagic
    }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const deviceLimits = await import(
        '/src/runtime/webgpuDeviceLimits.js'
      );
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const [
        abi,
        buffersModule,
        hierarchyModule,
        directSpatialModule,
        gridModule,
        gridUpdateModule,
        g2pModule,
        mechanicalProposalModule,
        materialModule,
        reactionModule,
        directReactionDiscoveryModule,
        thermalModule,
        residentStepModule
      ] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import('/src/runtime/sph/sphGpuBuffers.js'),
        import('/src/runtime/sph/schroederHierarchyGpu.js'),
        import('/src/runtime/sph/schroederSpatialEpochGpu.js'),
        import('/src/runtime/sph/sphGridGpuKernel.js'),
        import('/src/runtime/sph/sphGridUpdateGpuKernel.js'),
        import('/src/runtime/sph/sphG2pGpuKernel.js'),
        import('/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'),
        import('/src/runtime/material/opticalGpuBuffers.js'),
        import('/src/runtime/sph/sphReactionGpuKernel.js'),
        import(
          '/src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js'
        ),
        import('/src/runtime/sph/sphThermalGpuKernel.js'),
        import('/src/runtime/sph/sphMlsMpmGpuStep.js')
      ]);
      const reactionGraphSpatialUrl = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => (
          url.includes('/src/runtime/sph/schroederSpatialEpochGpu.js?t=')
        ));
      const spatialModule = reactionGraphSpatialUrl
        ? await import(reactionGraphSpatialUrl)
        : directSpatialModule;
      const reactionGraphDiscoveryUrl = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => (
          url.includes(
            '/src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js?t='
          )
        ));
      const reactionDiscoveryModule = reactionGraphDiscoveryUrl
        ? await import(reactionGraphDiscoveryUrl)
        : directReactionDiscoveryModule;

      const usage = globalThis.GPUBufferUsage;
      const mapMode = globalThis.GPUMapMode;
      const receiptByteLength = receiptWords * Uint32Array.BYTES_PER_ELEMENT;
      const receiptBuffer = device.createBuffer({
        label: 'product-p2g-input-volume-diagnostic-receipt',
        size: receiptByteLength,
        usage: usage.STORAGE | usage.COPY_SRC | usage.COPY_DST
      });
      const initialReceipt = new Uint32Array(receiptWords);
      initialReceipt[0] = receiptMagic;
      initialReceipt[1] = receiptVersion;
      initialReceipt[2] = 3;
      initialReceipt[3] = caseWords;
      device.queue.writeBuffer(receiptBuffer, 0, initialReceipt);

      const dummyBuffer = device.createBuffer({
        label: 'product-p2g-input-volume-diagnostic-dummy',
        size: receiptByteLength,
        usage: usage.STORAGE | usage.COPY_DST
      });

      const probeWgsl = /* wgsl */ `
struct ProbeParams {
  case_base: u32,
  stage_flags: u32,
  fallback_physical_index: u32,
  particle_count: u32,
  product_material_id: u32,
  physical_to_active_offset: u32,
  descriptor_offset: u32,
  descriptor_words: u32,
  pressure_offset: u32,
  pressure_words: u32,
  is_last: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> mechanics: array<f32>;
@group(0) @binding(1) var<storage, read> assignments: array<f32>;
@group(0) @binding(2) var<storage, read> active_source: array<u32>;
@group(0) @binding(3) var<storage, read> mechanics_field: array<u32>;
@group(0) @binding(4) var<storage, read> phase_receipt: array<u32>;
@group(0) @binding(5) var<storage, read_write> receipt: array<u32>;
@group(0) @binding(6) var<uniform> params: ProbeParams;
@group(0) @binding(7) var<storage, read> g2p_mechanics: array<f32>;
@group(0) @binding(8) var<storage, read> thermo: array<f32>;
@group(0) @binding(9) var<storage, read> identity: array<u32>;
@group(0) @binding(10) var<storage, read> phase_moment: array<u32>;

const STAGE_ASSIGNMENT: u32 = 1u;
const STAGE_ACTIVE_SOURCE: u32 = 2u;
const STAGE_FIELD: u32 = 4u;
const STAGE_P2G: u32 = 8u;
const STAGE_G2P: u32 = 16u;
const MISSING_ORDINAL: u32 = 0xffffffffu;
const RECEIPT_MAGIC: u32 = ${receiptMagic}u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

@compute @workgroup_size(1)
fn main() {
  let base = params.case_base;
  var physical_index = params.fallback_physical_index;
  var product_match_count = 0u;
  if (params.product_material_id != 0u) {
    for (var candidate = 0u;
      candidate < params.particle_count;
      candidate += 1u) {
      let candidate_material_id = u32(round(thermo[candidate * 12u]));
      if (candidate_material_id == params.product_material_id) {
        if (product_match_count == 0u) {
          physical_index = candidate;
        }
        product_match_count += 1u;
      }
    }
  }
  let mechanics_base = physical_index * 32u;
  let assignment_base = physical_index * 16u;
  let volume_ratio_j = mechanics[mechanics_base + 18u];
  let rest_volume = mechanics[mechanics_base + 19u];
  receipt[base + 0u] = bitcast<u32>(volume_ratio_j);
  receipt[base + 1u] = bitcast<u32>(rest_volume);
  receipt[base + 2u] = select(
    1u,
    0u,
    finite_f32(volume_ratio_j) && volume_ratio_j > 0.0
  );
  receipt[base + 3u] = select(
    1u,
    0u,
    finite_f32(rest_volume) && rest_volume > 0.0
  );
  receipt[base + 4u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 10u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 5u] = select(
    0u,
    active_source[18u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  receipt[base + 6u] = select(
    MISSING_ORDINAL,
    active_source[
      params.physical_to_active_offset + physical_index
    ],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  let descriptor = params.descriptor_offset
    + physical_index * params.descriptor_words;
  receipt[base + 7u] = select(
    0u,
    mechanics_field[descriptor + 3u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 8u] = select(
    0u,
    phase_receipt[41u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 9u] = select(
    0u,
    phase_receipt[47u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 10u] = select(
    0u,
    mechanics_field[params.pressure_offset],
    (params.stage_flags & STAGE_P2G) != 0u
  );
  receipt[base + 11u] = select(
    0u,
    mechanics_field[params.pressure_offset + 2u],
    (params.stage_flags & STAGE_P2G) != 0u
  );
  receipt[base + 12u] = params.stage_flags;
  receipt[base + 13u] = select(
    0u,
    bitcast<u32>(
      g2p_mechanics[physical_index * 32u + 28u]
    ),
    (params.stage_flags & STAGE_G2P) != 0u
  );
  receipt[base + 14u] = bitcast<u32>(
    thermo[physical_index * 12u]
  );
  receipt[base + 15u] = physical_index;
  receipt[base + 16u] = identity[physical_index];
  receipt[base + 17u] = product_match_count;
  receipt[base + 18u] = select(
    0u,
    phase_receipt[2u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 19u] = select(
    0u,
    phase_receipt[44u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 20u] = select(
    0u,
    phase_receipt[42u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 21u] = select(
    0u,
    phase_receipt[43u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 22u] = select(
    0u,
    phase_receipt[48u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 23u] = select(
    0u,
    phase_receipt[16u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 24u] = select(
    0u,
    phase_receipt[20u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 25u] = select(
    0u,
    phase_receipt[18u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 26u] = select(
    0u,
    phase_receipt[59u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 27u] = select(
    0u,
    phase_moment[2u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 28u] = select(
    0u,
    phase_moment[37u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 29u] = select(
    0u,
    phase_moment[38u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 30u] = select(
    0u,
    phase_moment[39u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 31u] = select(
    0u,
    phase_moment[40u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 32u] = select(
    0u,
    phase_moment[41u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 33u] = select(
    0u,
    phase_moment[56u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 34u] = select(
    0u,
    phase_moment[18u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 35u] = select(
    0u,
    phase_moment[32u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 36u] = select(
    0u,
    phase_moment[19u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 37u] = select(
    0u,
    mechanics_field[2u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 38u] = select(
    0u,
    mechanics_field[35u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 39u] = select(
    0u,
    mechanics_field[36u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 40u] = select(
    0u,
    mechanics_field[37u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 41u] = select(
    0u,
    mechanics_field[34u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 42u] = select(
    0u,
    mechanics_field[33u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 43u] = select(
    0u,
    mechanics_field[54u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 44u] = select(
    0u,
    mechanics_field[55u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 45u] = select(
    0u,
    mechanics_field[56u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 46u] = select(
    0u,
    mechanics_field[57u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 47u] = select(
    0u,
    mechanics_field[58u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 48u] = select(
    0u,
    mechanics_field[59u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 49u] = select(
    0u,
    mechanics_field[60u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 50u] = select(
    0u,
    mechanics_field[61u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 51u] = select(
    0u,
    mechanics_field[62u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 52u] = select(
    0u,
    mechanics_field[63u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 53u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 0u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 54u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 1u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 55u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 6u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 56u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 8u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 57u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 9u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 58u] = select(
    0u,
    bitcast<u32>(assignments[assignment_base + 10u]),
    (params.stage_flags & STAGE_ASSIGNMENT) != 0u
  );
  receipt[base + 59u] = select(
    0u,
    mechanics_field[descriptor + 0u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 60u] = select(
    0u,
    mechanics_field[descriptor + 1u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 61u] = select(
    0u,
    mechanics_field[descriptor + 3u],
    (params.stage_flags & STAGE_FIELD) != 0u
  );
  receipt[base + 62u] = bitcast<u32>(thermo[physical_index * 12u + 1u]);
  receipt[base + 63u] = bitcast<u32>(thermo[physical_index * 12u + 3u]);
  receipt[base + 64u] = bitcast<u32>(mechanics[mechanics_base + 21u]);
  receipt[base + 65u] = bitcast<u32>(mechanics[mechanics_base + 27u]);
  receipt[base + 66u] = select(
    0u,
    active_source[2u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  receipt[base + 67u] = select(
    0u,
    active_source[16u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  receipt[base + 68u] = select(
    0u,
    active_source[43u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  receipt[base + 69u] = select(
    0u,
    active_source[30u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  receipt[base + 70u] = select(
    0u,
    active_source[47u],
    (params.stage_flags & STAGE_ACTIVE_SOURCE) != 0u
  );
  var case_seal = RECEIPT_MAGIC ^ base ^ params.stage_flags;
  for (var word = 0u; word + 1u < ${caseWords}u; word = word + 1u) {
    case_seal = case_seal ^ receipt[base + word];
  }
  receipt[base + ${caseWords - 1}u] = case_seal;
  if (params.is_last != 0u) {
    receipt[${globalSealWord}u] = RECEIPT_MAGIC
      ^ receipt[3u]
      ^ receipt[${caseBases[0] + caseWords - 1}u]
      ^ receipt[${caseBases[1] + caseWords - 1}u]
      ^ receipt[${caseBases[2] + caseWords - 1}u]
      ^ receipt[${stageDiagnosticBase + 63}u]
      ^ receipt[
        ${generationFieldSnapshotBase + generationFieldSnapshotWords - 1}u
      ];
  }
}
`;
      const probeModule = device.createShaderModule({
        label: 'product-p2g-input-volume-diagnostic-probe',
        code: probeWgsl
      });
      const probeCompilation = await probeModule.getCompilationInfo();
      const compilationErrors = probeCompilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      if (compilationErrors.length > 0) {
        return {
          status: 'compile-error',
          compilationErrors,
          uncapturedErrors
        };
      }
      const probePipeline = await device.createComputePipelineAsync({
        label: 'product-p2g-input-volume-diagnostic-probe',
        layout: 'auto',
        compute: { module: probeModule, entryPoint: 'main' }
      });
      const generationFieldSnapshotWgsl = /* wgsl */ `
@group(0) @binding(0)
var<storage, read> mechanics_field: array<u32>;
@group(0) @binding(1)
var<storage, read_write> receipt: array<u32>;

const SNAPSHOT_BASE: u32 = ${generationFieldSnapshotBase}u;
const SNAPSHOT_MAGIC: u32 = ${generationFieldSnapshotMagic}u;

@compute @workgroup_size(1)
fn main() {
  receipt[SNAPSHOT_BASE + 0u] = mechanics_field[2u];
  receipt[SNAPSHOT_BASE + 1u] = mechanics_field[33u];
  receipt[SNAPSHOT_BASE + 2u] = mechanics_field[34u];
  receipt[SNAPSHOT_BASE + 3u] = mechanics_field[35u];
  receipt[SNAPSHOT_BASE + 4u] = mechanics_field[58u];
  receipt[SNAPSHOT_BASE + 5u] = mechanics_field[59u];
  receipt[SNAPSHOT_BASE + 6u] = mechanics_field[44u];
  receipt[SNAPSHOT_BASE + 7u] = mechanics_field[45u];
  receipt[SNAPSHOT_BASE + 8u] = mechanics_field[46u];
  receipt[SNAPSHOT_BASE + 9u] = mechanics_field[54u];
  receipt[SNAPSHOT_BASE + 10u] = mechanics_field[55u];
  receipt[SNAPSHOT_BASE + 11u] = mechanics_field[56u];
  receipt[SNAPSHOT_BASE + 12u] = mechanics_field[57u];
  receipt[SNAPSHOT_BASE + 13u] = mechanics_field[60u];
  receipt[SNAPSHOT_BASE + 14u] = mechanics_field[61u];
  receipt[SNAPSHOT_BASE + 15u] = mechanics_field[62u];
  var seal = SNAPSHOT_MAGIC ^ SNAPSHOT_BASE;
  for (var word = 0u; word < 16u; word = word + 1u) {
    seal = seal ^ receipt[SNAPSHOT_BASE + word];
  }
  receipt[SNAPSHOT_BASE + 16u] = seal;
}
`;
      const generationFieldSnapshotModule = device.createShaderModule({
        label: 'product-p2g-generation-field-snapshot',
        code: generationFieldSnapshotWgsl
      });
      const generationFieldSnapshotCompilation =
        await generationFieldSnapshotModule.getCompilationInfo();
      compilationErrors.push(
        ...generationFieldSnapshotCompilation.messages
          .filter((message) => message.type === 'error')
          .map((message) => message.message)
      );
      if (compilationErrors.length > 0) {
        return {
          status: 'compile-error',
          compilationErrors,
          uncapturedErrors
        };
      }
      const generationFieldSnapshotPipeline =
        await device.createComputePipelineAsync({
          label: 'product-p2g-generation-field-snapshot',
          layout: 'auto',
          compute: {
            module: generationFieldSnapshotModule,
            entryPoint: 'main'
          }
        });
      const discoveryEvidenceIndex = Object.fromEntries(
        reactionDiscoveryModule
          .SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT
          .map((field, index) => [
            field.slice(0, field.indexOf(':')),
            index
          ])
      );
      const placementReceiptIndex =
        abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX;
      const stageDiagnosticWgsl = /* wgsl */ `
struct StageDiagnosticParams {
  receipt_base: u32,
  particle_count: u32,
  product_event_count: u32,
  product_material_id: u32,
};

@group(0) @binding(0)
var<storage, read> discovery_evidence: array<u32>;
@group(0) @binding(1)
var<storage, read> discovery_proposals: array<f32>;
@group(0) @binding(2)
var<storage, read> product_events: array<f32>;
@group(0) @binding(3)
var<storage, read> placement_receipt: array<u32>;
@group(0) @binding(4)
var<storage, read> reaction_applied_thermo: array<f32>;
@group(0) @binding(5)
var<storage, read> placed_thermo: array<f32>;
@group(0) @binding(6)
var<storage, read_write> receipt: array<u32>;
@group(0) @binding(7)
var<uniform> params: StageDiagnosticParams;

const PRODUCT_EVENT_STRIDE: u32 = 32u;
const THERMO_STRIDE: u32 = 12u;
const DIAGNOSTIC_SEAL: u32 = 0x53344734u;

fn material_id(value: f32) -> u32 {
  if (value != value || value < 0.0 || value > 16777215.0) {
    return 0xffffffffu;
  }
  return u32(round(value));
}

@compute @workgroup_size(1)
fn main() {
  let base = params.receipt_base;
  var admitted_proposal_count = 0u;
  var reaction_applied_product_count = 0u;
  var product_event_count = 0u;
  var matching_product_event_count = 0u;
  var first_product_event_material_id = 0xffffffffu;
  var first_product_event_status = 0u;
  var product_event_mass_kg = 0.0;
  var placed_product_event_mass_kg = 0.0;
  var unplaced_product_event_mass_kg = 0.0;

  for (var particle = 0u;
    particle < params.particle_count;
    particle += 1u) {
    let proposal_base = particle * 4u;
    let partner = discovery_proposals[proposal_base];
    let reaction = discovery_proposals[proposal_base + 1u];
    if (
      partner == partner
      && reaction == reaction
      && partner >= 0.0
      && reaction >= 0.0
    ) {
      admitted_proposal_count += 1u;
    }
    if (
      material_id(reaction_applied_thermo[particle * THERMO_STRIDE])
        == params.product_material_id
    ) {
      reaction_applied_product_count += 1u;
    }
  }

  for (var event = 0u;
    event < params.product_event_count;
    event += 1u) {
    let event_base = event * PRODUCT_EVENT_STRIDE;
    let mass_kg = product_events[event_base + 3u];
    let event_material_id = material_id(product_events[event_base + 4u]);
    let status = u32(max(round(product_events[event_base + 18u]), 0.0));
    if (status == 1u && mass_kg == mass_kg && mass_kg > 0.0) {
      if (product_event_count == 0u) {
        first_product_event_material_id = event_material_id;
        first_product_event_status = status;
      }
      product_event_count += 1u;
      product_event_mass_kg += mass_kg;
      placed_product_event_mass_kg += max(
        product_events[event_base + 12u],
        0.0
      );
      unplaced_product_event_mass_kg += max(
        product_events[event_base + 13u],
        0.0
      );
      if (event_material_id == params.product_material_id) {
        matching_product_event_count += 1u;
      }
    }
  }

  receipt[base + 0u] = discovery_evidence[
    ${discoveryEvidenceIndex.sourceDispatchCount}u
  ];
  receipt[base + 1u] = discovery_evidence[
    ${discoveryEvidenceIndex.candidateVisitCount}u
  ];
  receipt[base + 2u] = discovery_evidence[
    ${discoveryEvidenceIndex.compatiblePairCount}u
  ];
  receipt[base + 3u] = discovery_evidence[
    ${discoveryEvidenceIndex.proposalCount}u
  ];
  receipt[base + 4u] = discovery_evidence[
    ${discoveryEvidenceIndex.sealedRowCount}u
  ];
  receipt[base + 5u] = admitted_proposal_count;
  receipt[base + 6u] = reaction_applied_product_count;
  receipt[base + 7u] = product_event_count;
  receipt[base + 8u] = first_product_event_material_id;
  receipt[base + 9u] = bitcast<u32>(product_event_mass_kg);
  receipt[base + 10u] = matching_product_event_count;
  receipt[base + 11u] = placement_receipt[
    ${placementReceiptIndex.activeEventCount}u
  ];
  receipt[base + 12u] = placement_receipt[
    ${placementReceiptIndex.classifierReadyCount}u
  ];
  receipt[base + 13u] = placement_receipt[
    ${placementReceiptIndex.sparePlacementEventCount}u
  ];
  receipt[base + 14u] = placement_receipt[
    ${placementReceiptIndex.ssCaptureHitCount}u
  ];
  receipt[base + 15u] = placement_receipt[
    ${placementReceiptIndex.captureMergeEventCount}u
  ];
  receipt[base + 16u] = placement_receipt[
    ${placementReceiptIndex.fallbackEventCount}u
  ];
  receipt[base + 17u] = placement_receipt[
    ${placementReceiptIndex.rejectedEventCount}u
  ];
  receipt[base + 18u] = placement_receipt[
    ${placementReceiptIndex.unknownDispositionCount}u
  ];
  receipt[base + 19u] = placement_receipt[
    ${placementReceiptIndex.status}u
  ];
  receipt[base + 20u] = placement_receipt[
    ${placementReceiptIndex.transactionalTerminalSealPassCount}u
  ];
  receipt[base + 21u] = placement_receipt[
    ${placementReceiptIndex.transactionalTerminalStatus}u
  ];
  receipt[base + 22u] = placement_receipt[
    ${placementReceiptIndex.transactionalCommittedParticleCount}u
  ];
  receipt[base + 23u] = placement_receipt[
    ${placementReceiptIndex.transactionalFallbackParticleCount}u
  ];
  receipt[base + 24u] = placement_receipt[
    ${placementReceiptIndex.transactionalCommittedEventRowCount}u
  ];
  receipt[base + 25u] = placement_receipt[
    ${placementReceiptIndex.transactionalFallbackEventRowCount}u
  ];
  receipt[base + 26u] = material_id(placed_thermo[0u]);
  receipt[base + 27u] = material_id(placed_thermo[THERMO_STRIDE]);
  receipt[base + 28u] = material_id(placed_thermo[2u * THERMO_STRIDE]);
  receipt[base + 29u] = material_id(reaction_applied_thermo[0u]);
  receipt[base + 30u] = material_id(
    reaction_applied_thermo[THERMO_STRIDE]
  );
  receipt[base + 31u] = material_id(
    reaction_applied_thermo[2u * THERMO_STRIDE]
  );
  receipt[base + 32u] = placement_receipt[
    ${placementReceiptIndex.directOnlyEventCount}u
  ];
  receipt[base + 33u] = placement_receipt[
    ${placementReceiptIndex.spareAvailableCount}u
  ];
  receipt[base + 34u] = placement_receipt[
    ${placementReceiptIndex.spareAssignedCount}u
  ];
  receipt[base + 35u] = placement_receipt[
    ${placementReceiptIndex.applyVisitedCount}u
  ];
  receipt[base + 36u] = placement_receipt[
    ${placementReceiptIndex.subthresholdEventCount}u
  ];
  receipt[base + 37u] = placement_receipt[
    ${placementReceiptIndex.noCarrierEventCount}u
  ];
  receipt[base + 38u] = placement_receipt[
    ${placementReceiptIndex.overflowFlags}u
  ];
  receipt[base + 39u] = placement_receipt[
    ${placementReceiptIndex.envelopeAdmitted}u
  ];
  receipt[base + 40u] = first_product_event_status;
  receipt[base + 41u] = bitcast<u32>(placed_product_event_mass_kg);
  receipt[base + 42u] = bitcast<u32>(unplaced_product_event_mass_kg);
  receipt[base + 43u] = placement_receipt[
    ${placementReceiptIndex.applyPassCount}u
  ];
  receipt[base + 44u] = placement_receipt[
    ${placementReceiptIndex.transactionalPublishPassCount}u
  ];
  receipt[base + 45u] = discovery_evidence[
    ${discoveryEvidenceIndex.directoryAdmissionCount}u
  ];
  receipt[base + 46u] = discovery_evidence[
    ${discoveryEvidenceIndex.directoryRejectionCount}u
  ];
  receipt[base + 47u] = discovery_evidence[
    ${discoveryEvidenceIndex.malformedTraversalCount}u
  ];
  receipt[base + 48u] = discovery_evidence[
    ${discoveryEvidenceIndex.sourceIdentityRejectionCount}u
  ];
  receipt[base + 49u] = discovery_evidence[
    ${discoveryEvidenceIndex.overflowCount}u
  ];
  receipt[base + 50u] = discovery_evidence[
    ${discoveryEvidenceIndex.ruleIndexPairLookupCount}u
  ];
  receipt[base + 51u] = discovery_evidence[
    ${discoveryEvidenceIndex.ruleIndexPairMissCount}u
  ];
  receipt[base + 52u] = discovery_evidence[
    ${discoveryEvidenceIndex.ruleIndexRuleVisitCount}u
  ];
  receipt[base + 53u] = discovery_evidence[
    ${discoveryEvidenceIndex.fullRuleScanRuleVisitCount}u
  ];
  receipt[base + 54u] = discovery_evidence[
    ${discoveryEvidenceIndex.maximumDisplacementBits}u
  ];
  receipt[base + 55u] = discovery_evidence[
    ${discoveryEvidenceIndex.displacementCertificateStatusBits}u
  ];
  receipt[base + 56u] = discovery_evidence[
    ${discoveryEvidenceIndex.authorityActiveCount}u
  ];
  receipt[base + 57u] = discovery_evidence[
    ${discoveryEvidenceIndex.currentActiveCount}u
  ];
  receipt[base + 58u] = discovery_evidence[
    ${discoveryEvidenceIndex.exactCellTreeNodeVisitCount}u
  ];
  receipt[base + 59u] = discovery_evidence[
    ${discoveryEvidenceIndex.exactCellTreeLeafVisitCount}u
  ];
  receipt[base + 60u] = discovery_evidence[
    ${discoveryEvidenceIndex.exactCellTreeMemberVisitCount}u
  ];
  receipt[base + 61u] = discovery_evidence[
    ${discoveryEvidenceIndex.supportProfileId}u
  ];
  receipt[base + 62u] = discovery_evidence[
    ${discoveryEvidenceIndex.generationId}u
  ];
  receipt[base + 63u] = DIAGNOSTIC_SEAL
    ^ receipt[base + 0u]
    ^ receipt[base + 2u]
    ^ receipt[base + 3u]
    ^ receipt[base + 5u]
    ^ receipt[base + 6u]
    ^ receipt[base + 7u]
    ^ receipt[base + 11u]
    ^ receipt[base + 12u]
    ^ receipt[base + 19u]
    ^ receipt[base + 21u]
    ^ receipt[base + 26u]
    ^ receipt[base + 27u]
    ^ receipt[base + 28u]
    ^ receipt[base + 45u]
    ^ receipt[base + 46u]
    ^ receipt[base + 47u]
    ^ receipt[base + 48u]
    ^ receipt[base + 49u]
    ^ receipt[base + 50u]
    ^ receipt[base + 51u]
    ^ receipt[base + 52u]
    ^ receipt[base + 53u]
    ^ receipt[base + 54u]
    ^ receipt[base + 55u]
    ^ receipt[base + 56u]
    ^ receipt[base + 57u]
    ^ receipt[base + 58u]
    ^ receipt[base + 59u]
    ^ receipt[base + 60u]
    ^ receipt[base + 61u]
    ^ receipt[base + 62u];
}
`;
      const stageDiagnosticModule = device.createShaderModule({
        label: 'product-p2g-first-failing-stage-diagnostic',
        code: stageDiagnosticWgsl
      });
      const stageDiagnosticCompilation =
        await stageDiagnosticModule.getCompilationInfo();
      compilationErrors.push(
        ...stageDiagnosticCompilation.messages
          .filter((message) => message.type === 'error')
          .map((message) => message.message)
      );
      if (compilationErrors.length > 0) {
        return {
          status: 'compile-error',
          compilationErrors,
          uncapturedErrors
        };
      }
      const stageDiagnosticPipeline =
        await device.createComputePipelineAsync({
          label: 'product-p2g-first-failing-stage-diagnostic',
          layout: 'auto',
          compute: {
            module: stageDiagnosticModule,
            entryPoint: 'main'
          }
        });

      const materialProperties = {
        a: {
          molarMassKgPerMol: 0.01,
          phases: [{
            name: 'solid',
            temperatureRange: [0, 2000],
            cpJPerKgK: 1000,
            densityKgPerM3: 1000,
            bulkModulusPa: 1.0e6,
            shearModulusPa: 2.0e5
          }],
          transitions: []
        },
        b: {
          molarMassKgPerMol: 0.02,
          phases: [{
            name: 'liquid',
            temperatureRange: [0, 2000],
            cpJPerKgK: 1200,
            densityKgPerM3: 800,
            bulkModulusPa: 8.0e5,
            shearModulusPa: 0
          }],
          transitions: []
        },
        ab: {
          molarMassKgPerMol: 0.03,
          phases: [{
            name: 'liquid',
            temperatureRange: [0, 3000],
            cpJPerKgK: 1500,
            densityKgPerM3: 500,
            bulkModulusPa: 5.0e5,
            shearModulusPa: 0
          }],
          transitions: []
        }
      };
      const reactionTable = reactionModule.buildSphReactionTable([{
        a: 'a',
        b: 'b',
        product: 'ab',
        activationTemperatureK: 0,
        phaseRequirements: { b: ['liquid'] },
        specificEnthalpyJPerKg: -1000
      }], {
        materialProperties,
        contactRadiusM: 0.1
      });
      const thermalMaterialTable =
        thermalModule.buildSphThermalMaterialTable(materialProperties);
      const productMaterialId =
        materialModule.stableOpticalMaterialId('ab');
      const cases = [
        { label: 'valid-placement', volumeRatioJ: null, restVolumeM3: null },
        { label: 'invalid-v0', volumeRatioJ: 0.5, restVolumeM3: 0 },
        { label: 'invalid-j', volumeRatioJ: 0, restVolumeM3: 0.001 }
      ];
      const cleanup = [];
      const stageResults = [];
      try {
        for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
          const fixture = cases[caseIndex];
          const validPlacement = fixture.label === 'valid-placement';
          // Canonical placement requires an exact dormant destination slot
          // for product birth. The third all-zero row is the same spare
          // encoding exercised by the native segmented-placement harness;
          // only the two live A/B rows participate in discovery.
          const particleCount = validPlacement ? 3 : 1;
          const state = validPlacement
            ? new Float32Array([
                1, 1, 1, 2,
                0, 0, 0, 100,
                1.04, 1, 1, 4,
                0, 0, 0, 200,
                0, 0, 0, 0,
                0, 0, 0, 0
              ])
            : new Float32Array([
                1, 1, 1, 1,
                0, 0, 0, 100
              ]);
          const thermo = validPlacement
            ? new Float32Array([
                materialModule.stableOpticalMaterialId('a'),
                materialModule.GPU_PHASE_IDS.solid,
                600, 1000,
                1, 0, 0, 0,
                0.1, 1, 1, 0,
                materialModule.stableOpticalMaterialId('b'),
                materialModule.GPU_PHASE_IDS.liquid,
                600, 800,
                0, 1, 0, 0,
                0.1, 1, 1, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0
              ])
            : new Float32Array([
                7, 3, 300, 1,
                0, 0, 1, 0,
                0.25, 1, 1, 0.05
              ]);
          const identity = validPlacement
            ? new Uint32Array([1, 2, 3])
            : new Uint32Array([1]);
          const mechanics = new Float32Array(particleCount * 32);
          const liveReactantCount = validPlacement ? 2 : particleCount;
          for (let particleIndex = 0;
            particleIndex < liveReactantCount;
            particleIndex += 1) {
            const base = particleIndex * 32;
            mechanics.set([
              1, 0, 0,
              0, 1, 0,
              0, 0, 1
            ], base);
            mechanics[base + 18] = validPlacement
              ? 1
              : fixture.volumeRatioJ;
            mechanics[base + 19] = validPlacement
              ? 0.002
              : fixture.restVolumeM3;
            mechanics[base + 20] = particleIndex === 0 ? 1 : 0;
            mechanics[base + 21] = 1;
            mechanics[base + 22] = particleIndex === 0 ? 1.0e6 : 8.0e5;
            mechanics[base + 23] = particleIndex === 0 ? 2.0e5 : 0;
            mechanics[base + 24] = particleIndex === 0 ? 1.0e6 : 8.0e5;
            mechanics[base + 25] = 30;
            mechanics[base + 26] = 1;
            mechanics[base + 27] = 1;
            mechanics[base + 31] = 1;
          }

          const sphParticleState = {
            schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
            status: 'cpu-derived-gpu-buffer-ready',
            particleCount,
            dimension: 3,
            step: 0,
            time: 0,
            positionEpoch: 0,
            topologyEpoch: 0,
            chartEpoch: 0,
            levelEpoch: 0,
            supportEpoch: 0,
            smoothingLengthM: validPlacement ? 0.1 : 0.25,
            storageGeneration: 1,
            stateStrideFloats: 8,
            thermoStrideFloats: 12,
            identityStrideUints: 1,
            stateStrideBytes: 32,
            thermoStrideBytes: 48,
            identityStrideBytes: 4,
            identityRequired: true,
            identityRevision: `product-p2g-volume-${fixture.label}`,
            renderDomainKeys: { 1: `product-p2g-volume-${fixture.label}` },
            state,
            thermo,
            identity,
            metadata: []
          };
          const mlsMpmParticleState = {
            schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
            status: 'cpu-derived-gpu-buffer-ready',
            particleCount,
            step: 0,
            time: 0,
            storageGeneration: 1,
            mechanicsStrideFloats: 32,
            mechanicsStrideBytes: 128,
            mechanicsDtS: 0.001,
            mechanicalSubsteps: 1,
            gridCflFactor: 0.4,
            gravityMPerS2: [0, 0, 0],
            particleSeparationRelaxation: 0,
            particleSeparationVelocityDamping: 0,
            mechanics,
            metadata: [],
            algorithmMaterialContactRows: null
          };
          const sphUpload = buffersModule.uploadSphGpuParticleBuffers(
            device,
            sphParticleState
          );
          const mechanicsUpload =
            buffersModule.uploadMlsMpmGpuParticleBuffers(
              device,
              mlsMpmParticleState
            );
          sphUpload.slot = 0;
          mechanicsUpload.slot = 0;
          cleanup.push(() => {
            buffersModule.destroySphGpuParticleBuffers(sphUpload);
            buffersModule.destroyMlsMpmGpuParticleBuffers(mechanicsUpload);
          });

          let continuationSphUpload = sphUpload;
          let continuationMechanicsUpload = mechanicsUpload;
          let placementAdoption = null;
          let placementArtifactExact = false;
          let placementUploadFamilyExact = false;
          let stageDiagnosticBoundExact = false;
          if (validPlacement) {
            const reactionAssignment =
              await hierarchyModule.runSchroederLevelAssignmentWebGpu({
                device,
                sphParticleState,
                mlsMpmParticleState,
                sphParticleUpload: sphUpload,
                mlsMpmParticleUpload: mechanicsUpload,
                baseGridSpacingM: 0.25,
                minLevel: 0,
                maxLevel: 0,
                targetSupportCells: 1,
                supportRadiusScale: 1,
                chartId: 0,
                retainAssignmentBuffer: true,
                readbackMode: 'no-full-readback'
              });
            const reactionGridSpec = gridModule.createMlsMpmGridSpec({
              boxDimsM: [2, 2, 2],
              gridSpacingM: 0.25
            });
            const reactionGeneration =
              spatialModule.runSchroederSpatialEpochGenerationWebGpu({
                device,
                levelAssignment: reactionAssignment,
                particleCount,
                particleIdentityBuffer: sphUpload.identityBuffer,
                particleIdentityStrideWords: 1,
                selectedLevel: 0,
                mechanicsGrid: {
                  gridNodeCount: reactionGridSpec.gridNodeCount,
                  gridDims: reactionGridSpec.gridDims,
                  gridShift: reactionGridSpec.shift,
                  gridSpacingM: reactionGridSpec.gridSpacingM
                }
              });
            if (!reactionGeneration.ready) {
              throw new Error(
                `reaction source generation rejected: ${
                  reactionGeneration.reason || reactionGeneration.status
                }`
              );
            }
            const reactionDiscovery =
              await reactionDiscoveryModule
                .runSchroederSpatialReactionDiscoveryProposalWebGpu({
                  device,
                  generation: reactionGeneration,
                  sphParticleState,
                  sourceStateBuffer: sphUpload.stateBuffer,
                  sourceThermoBuffer: sphUpload.thermoBuffer,
                  reactionTable,
                  collectGpuResidentDiagnosticEvidence: true
                });
            const directReactionDiscoveryAdmission =
              reactionDiscoveryModule
                .resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
                  reactionDiscovery,
                  {
                    device,
                    generation: reactionGeneration,
                    particleCount,
                    reactionCount: reactionTable.reactionCount,
                    reactionTable,
                    sourceStateBuffer: sphUpload.stateBuffer,
                    sourceThermoBuffer: sphUpload.thermoBuffer
                  }
                );
            if (directReactionDiscoveryAdmission.admitted !== true) {
              throw new Error(
                `direct reaction discovery admission rejected: ${
                  directReactionDiscoveryAdmission.reason
                }`
              );
            }
            const reactionResult =
              await reactionModule.runSphReactionStepWebGpu({
                device,
                sphParticleState,
                mlsMpmParticleState,
                reactionTable,
                thermalMaterialTable,
                sphParticleUpload: sphUpload,
                mlsMpmParticleUpload: mechanicsUpload,
                sourceStateBuffer: sphUpload.stateBuffer,
                sourceThermoBuffer: sphUpload.thermoBuffer,
                sourceMechanicsBuffer: mechanicsUpload.mechanicsBuffer,
                boxDimsM: [2, 2, 2],
                retainOutputParticleBuffers: true,
                resetMechanics: false,
                dtSeconds: 0.001,
                readbackMode: 'no-full-readback',
                readCompactReactionSummary: false,
                readReactionGasSpeciesSummary: false,
                readReactionProductInventory: false,
                readReactionAtomResidual: false,
                readReactionProductPlacementSummary: false,
                schroederSpatialEpochGeneration: reactionGeneration,
                schroederSpatialReactionDiscoveryProposal:
                  reactionDiscovery,
                canonicalReactionDiscoveryResolver:
                  reactionDiscoveryModule
                    .resolveSchroederSpatialReactionDiscoveryProposalForConsumer
              });
            placementAdoption =
              residentStepModule
                .adoptSphReactionPlacementContinuationWebGpu({
                  device,
                  reactionStep: reactionResult,
                  sphParticleState,
                  mlsMpmParticleState,
                  sphParticleUpload: sphUpload,
                  mlsMpmParticleUpload: mechanicsUpload,
                  dt: 0.001
                });
            continuationSphUpload = placementAdoption.sphParticleUpload;
            continuationMechanicsUpload =
              placementAdoption.mlsMpmParticleUpload;
            placementArtifactExact = placementAdoption.placementArtifact
              === reactionResult.reactionSummary
                ?.reactionProductPlacementSubmissionArtifact;
            placementUploadFamilyExact = Boolean(
              placementAdoption.stateBuffer
                === continuationSphUpload.stateBuffer
              && placementAdoption.thermoBuffer
                === continuationSphUpload.thermoBuffer
              && placementAdoption.mechanicsBuffer
                === continuationMechanicsUpload.mechanicsBuffer
            );
            const placementArtifact = placementAdoption.placementArtifact;
            const productEventBuffer =
              reactionResult.reactionSummary?.productEventBuffer ?? null;
            const productEventCount = Number(
              reactionResult.reactionSummary?.productEventRowCount
            );
            stageDiagnosticBoundExact = Boolean(
              reactionDiscovery.evidenceBuffer
              && reactionDiscovery.proposalBuffer
              && productEventBuffer
              && placementArtifact?.productEventBuffer === productEventBuffer
              && placementArtifact.completionReceiptBuffer
              && placementArtifact.frozenSourceThermoBuffer
              && placementArtifact.placedDestinationThermoBuffer
                === continuationSphUpload.thermoBuffer
              && Number.isInteger(productEventCount)
              && productEventCount === particleCount
            );
            if (!stageDiagnosticBoundExact) {
              throw new Error(
                'first-failing-stage diagnostic buffers were not the exact '
                  + 'authenticated discovery/reaction/placement family'
              );
            }
            const stageDiagnosticParams = new Uint32Array([
              stageDiagnosticBase,
              particleCount,
              productEventCount,
              productMaterialId
            ]);
            const stageDiagnosticParamsBuffer = device.createBuffer({
              label: 'product-p2g-first-failing-stage-params',
              size: stageDiagnosticParams.byteLength,
              usage: usage.UNIFORM | usage.COPY_DST
            });
            device.queue.writeBuffer(
              stageDiagnosticParamsBuffer,
              0,
              stageDiagnosticParams
            );
            const stageDiagnosticBindGroup = device.createBindGroup({
              label: 'product-p2g-first-failing-stage-bind-group',
              layout: stageDiagnosticPipeline.getBindGroupLayout(0),
              entries: [
                {
                  binding: 0,
                  resource: { buffer: reactionDiscovery.evidenceBuffer }
                },
                {
                  binding: 1,
                  resource: { buffer: reactionDiscovery.proposalBuffer }
                },
                {
                  binding: 2,
                  resource: { buffer: productEventBuffer }
                },
                {
                  binding: 3,
                  resource: {
                    buffer: placementArtifact.completionReceiptBuffer
                  }
                },
                {
                  binding: 4,
                  resource: {
                    buffer: placementArtifact.frozenSourceThermoBuffer
                  }
                },
                {
                  binding: 5,
                  resource: {
                    buffer: placementArtifact.placedDestinationThermoBuffer
                  }
                },
                { binding: 6, resource: { buffer: receiptBuffer } },
                {
                  binding: 7,
                  resource: { buffer: stageDiagnosticParamsBuffer }
                }
              ]
            });
            const stageDiagnosticEncoder = device.createCommandEncoder({
              label: 'product-p2g-first-failing-stage'
            });
            const stageDiagnosticPass =
              stageDiagnosticEncoder.beginComputePass({
                label: 'product-p2g-first-failing-stage'
              });
            stageDiagnosticPass.setPipeline(stageDiagnosticPipeline);
            stageDiagnosticPass.setBindGroup(0, stageDiagnosticBindGroup);
            stageDiagnosticPass.dispatchWorkgroups(1);
            stageDiagnosticPass.end();
            device.queue.submit([stageDiagnosticEncoder.finish()]);
            cleanup.push(
              () => stageDiagnosticParamsBuffer.destroy(),
              () => reactionAssignment.destroyAssignmentBuffer?.(),
              () => reactionDiscovery.destroy?.(),
              () => spatialModule
                .releaseSchroederSpatialEpochGenerationAfterQueue(
                  reactionGeneration,
                  device
                ),
              () => placementAdoption.releaseAfterSubmittedWork()
            );
          }

          const assignment =
            await hierarchyModule.runSchroederLevelAssignmentWebGpu({
              device,
              sphParticleState,
              mlsMpmParticleState,
              sphParticleUpload: continuationSphUpload,
              mlsMpmParticleUpload: continuationMechanicsUpload,
              baseGridSpacingM: 0.25,
              minLevel: 0,
              maxLevel: 0,
              targetSupportCells: 1,
              supportRadiusScale: 1,
              chartId: 0,
              retainAssignmentBuffer: true,
              readbackMode: 'no-full-readback'
            });
          cleanup.push(() => assignment.destroyAssignmentBuffer?.());

          let generation = null;
          let projection = null;
          let gridUpdate = null;
          let g2p = null;
          let mechanicalProposal = null;
          let activeSource = null;
          let field = null;
          let phaseMoment = null;
          let phaseReceipt = null;
          let stageFlags = 1;
          if (validPlacement) {
            const gridSpec = gridModule.createMlsMpmGridSpec({
              boxDimsM: [2, 2, 2],
              gridSpacingM: 0.25
            });
            generation =
              spatialModule.runSchroederSpatialEpochGenerationWebGpu({
                device,
                levelAssignment: assignment,
                particleCount,
                particleIdentityBuffer: continuationSphUpload.identityBuffer,
                particleIdentityStrideWords: 1,
                selectedLevel: 0,
                mechanicsGrid: {
                  gridNodeCount: gridSpec.gridNodeCount,
                  gridDims: gridSpec.gridDims,
                  gridShift: gridSpec.shift,
                  gridSpacingM: gridSpec.gridSpacingM
                }
              });
            if (!generation.ready) {
              throw new Error(
                `valid diagnostic generation rejected: ${
                  generation.reason || generation.status
                }`
              );
            }
            activeSource = generation.activeSourceView
              ?? generation.execution?.activeSourceView
              ?? null;
            field = generation.mechanicsFieldView
              ?? generation.execution?.mechanicsFieldView
              ?? null;
            phaseMoment = generation.phaseVolumeMoment
              ?? generation.execution?.phaseVolumeMoment
              ?? generation.mechanicsLevelViews?.[0]?.phaseVolumeMoment
              ?? null;
            phaseReceipt = generation.phaseVolumeReceipt
              ?? generation.execution?.phaseVolumeReceipt
              ?? generation.mechanicsLevelViews?.[0]?.phaseVolumeReceipt
              ?? null;
            if (!field?.fieldViewBuffer) {
              throw new Error(
                'valid diagnostic generation did not expose a field buffer'
              );
            }
            const generationFieldSnapshotBindGroup =
              device.createBindGroup({
                label: 'product-p2g-generation-field-snapshot-bind-group',
                layout:
                  generationFieldSnapshotPipeline.getBindGroupLayout(0),
                entries: [
                  {
                    binding: 0,
                    resource: { buffer: field.fieldViewBuffer }
                  },
                  { binding: 1, resource: { buffer: receiptBuffer } }
                ]
              });
            const generationFieldSnapshotEncoder =
              device.createCommandEncoder({
                label: 'product-p2g-generation-field-snapshot'
              });
            const generationFieldSnapshotPass =
              generationFieldSnapshotEncoder.beginComputePass({
                label: 'product-p2g-generation-field-snapshot'
              });
            generationFieldSnapshotPass.setPipeline(
              generationFieldSnapshotPipeline
            );
            generationFieldSnapshotPass.setBindGroup(
              0,
              generationFieldSnapshotBindGroup
            );
            generationFieldSnapshotPass.dispatchWorkgroups(1);
            generationFieldSnapshotPass.end();
            device.queue.submit([
              generationFieldSnapshotEncoder.finish()
            ]);
            projection =
              await gridModule.runMlsMpmP2gGridProjectionWebGpu({
                device,
                sphParticleState,
                mlsMpmParticleState,
                sphParticleUpload: continuationSphUpload,
                mlsMpmParticleUpload: continuationMechanicsUpload,
                schroederSelectedLevel: 0,
                schroederSpatialEpochGeneration: generation,
                canonicalSpatialRequired: true,
                mechanicsFieldMode: 'required',
                gridSpacingM: 0.25,
                boxDimsM: [2, 2, 2],
                dt: 0.001,
                internalPressureScale: 1,
                ambientPressurePa: 0,
                readbackMode: 'no-full-readback'
              });
            gridUpdate =
              await gridUpdateModule.runMlsMpmGridUpdateWebGpu({
                device,
                p2gGridProjection: projection,
                mechanicsFieldMode: 'required',
                dt: 0.001,
                gravityMPerS2: [0, 0, 0],
                boxDimsM: [2, 2, 2],
                cflFactor: 0.4,
                readbackMode: 'no-full-readback'
              });
            mechanicalProposal =
              mechanicalProposalModule
                .runSchroederSpatialMechanicalProposalWebGpu({
                  device,
                  generation,
                  sphParticleState,
                  mlsMpmParticleState,
                  sphParticleUpload: continuationSphUpload,
                  mlsMpmParticleUpload: continuationMechanicsUpload,
                  boxDimsM: [2, 2, 2],
                  gridSpacingM: 0.25,
                  relaxation: 0,
                  normalVelocityDamping: 0,
                  selectedLevel: 0
                });
            g2p = await g2pModule.runMlsMpmG2pWebGpu({
              device,
              sphParticleState,
              mlsMpmParticleState,
              gridUpdate,
              sphParticleUpload: continuationSphUpload,
              mlsMpmParticleUpload: continuationMechanicsUpload,
              dt: 0.001,
              boxDimsM: [2, 2, 2],
              internalPressureScale: 1,
              liquidWallDampingAlpha: 0,
              liquidWallDampingDistanceM: 0,
              schroederSelectedLevel: 0,
              schroederSpatialEpochGeneration: generation,
              schroederSpatialMechanicalProposal: mechanicalProposal,
              canonicalSpatialRequired: true,
              mechanicsFieldMode: 'required',
              retainOutputParticleBuffers: true,
              readbackMode: 'no-full-readback'
            });
            stageFlags = 31;
            cleanup.push(() => {
              mechanicalProposal?.releaseAfterSubmittedWork?.();
              g2pModule.destroyRetainedMlsMpmG2pOutputComponents(
                g2p,
                { state: true, mechanics: true }
              );
              gridUpdate?.destroyUpdatedGridBuffer?.();
              projection?.destroyGridBuffer?.();
              spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
                generation,
                device
              );
              mechanicalProposalModule
                .destroySchroederSpatialMechanicalProposalRuntime(device);
            });
          }

          const params = new Uint32Array(12);
          params[0] = caseBases[caseIndex];
          params[1] = stageFlags;
          params[2] = 0;
          params[3] = particleCount;
          params[4] = validPlacement ? productMaterialId : 0;
          params[5] = activeSource?.layout?.physicalToActiveOffsetWords ?? 0;
          params[6] = field?.layout?.descriptorOffsetWords ?? 0;
          params[7] = field?.layout?.descriptorWords ?? 0;
          params[8] = field?.layout?.pressureOffsetWords ?? 0;
          params[9] = field?.layout?.pressureWords ?? 0;
          params[10] = caseIndex === cases.length - 1 ? 1 : 0;
          const paramsBuffer = device.createBuffer({
            label: `product-p2g-input-volume-${fixture.label}-params`,
            size: params.byteLength,
            usage: usage.UNIFORM | usage.COPY_DST
          });
          device.queue.writeBuffer(paramsBuffer, 0, params);
          cleanup.push(() => paramsBuffer.destroy());

          const bindGroup = device.createBindGroup({
            label: `product-p2g-input-volume-${fixture.label}-probe-bind-group`,
            layout: probePipeline.getBindGroupLayout(0),
            entries: [
              {
                binding: 0,
                resource: {
                  buffer: continuationMechanicsUpload.mechanicsBuffer
                }
              },
              { binding: 1, resource: { buffer: assignment.assignmentBuffer } },
              {
                binding: 2,
                resource: {
                  buffer: activeSource?.activeSourceViewBuffer ?? dummyBuffer
                }
              },
              {
                binding: 3,
                resource: { buffer: field?.fieldViewBuffer ?? dummyBuffer }
              },
              {
                binding: 4,
                resource: { buffer: phaseReceipt?.controlBuffer ?? dummyBuffer }
              },
              { binding: 5, resource: { buffer: receiptBuffer } },
              { binding: 6, resource: { buffer: paramsBuffer } },
              {
                binding: 7,
                resource: { buffer: g2p?.mechanicsBuffer ?? dummyBuffer }
              },
              {
                binding: 8,
                resource: { buffer: continuationSphUpload.thermoBuffer }
              },
              {
                binding: 9,
                resource: { buffer: continuationSphUpload.identityBuffer }
              },
              {
                binding: 10,
                resource: {
                  buffer: phaseMoment?.controlBuffer ?? dummyBuffer
                }
              }
            ]
          });
          const probeEncoder = device.createCommandEncoder({
            label: `product-p2g-input-volume-${fixture.label}-probe`
          });
          const probePass = probeEncoder.beginComputePass({
            label: `product-p2g-input-volume-${fixture.label}-probe`
          });
          probePass.setPipeline(probePipeline);
          probePass.setBindGroup(0, bindGroup);
          probePass.dispatchWorkgroups(1);
          probePass.end();
          device.queue.submit([probeEncoder.finish()]);
          stageResults.push({
            label: fixture.label,
            assignmentBufferRetained: Boolean(assignment.assignmentBuffer),
            generationReady: generation?.ready === true,
            placementAdoptionReady: placementAdoption?.ready === true,
            placementAdoptionAuthenticated:
              placementAdoption?.authenticated === true,
            placementArtifactExact,
            placementUploadFamilyExact,
            stageDiagnosticBoundExact,
            productMaterialId,
            projectionBackend: projection?.backend ?? null,
            gridUpdateBackend: gridUpdate?.backend ?? null,
            g2pBackend: g2p?.backend ?? null,
            fullReadbackPerformed:
              projection?.fullReadbackPerformed === true
              || gridUpdate?.fullReadbackPerformed === true
              || g2p?.fullReadbackPerformed === true
          });
        }

        const readbackBuffer = device.createBuffer({
          label: 'product-p2g-input-volume-diagnostic-readback',
          size: receiptByteLength,
          usage: usage.COPY_DST | usage.MAP_READ
        });
        const copyEncoder = device.createCommandEncoder({
          label: 'product-p2g-input-volume-diagnostic-copy'
        });
        copyEncoder.copyBufferToBuffer(
          receiptBuffer,
          0,
          readbackBuffer,
          0,
          receiptByteLength
        );
        device.queue.submit([copyEncoder.finish()]);
        await readbackBuffer.mapAsync(mapMode.READ);
        const words = new Uint32Array(
          readbackBuffer.getMappedRange()
        ).slice();
        readbackBuffer.unmap();
        readbackBuffer.destroy();
        await device.queue.onSubmittedWorkDone();
        const validationError = await device.popErrorScope();
        return {
          status: 'complete',
          compilationErrors,
          validationError: validationError?.message || null,
          uncapturedErrors,
          receipt: Array.from(words),
          stageResults,
          mapCount: 1,
          receiptByteLength
        };
      } finally {
        await device.queue.onSubmittedWorkDone().catch(() => {});
        for (const dispose of cleanup.reverse()) {
          try {
            const result = dispose();
            if (result?.then) await result;
          } catch {
            // Preserve the diagnostic result; validation errors are reported
            // through the explicit error scope and uncaptured-error listener.
          }
        }
        receiptBuffer.destroy();
        dummyBuffer.destroy();
        device.destroy();
      }
    }, {
      receiptMagic: RECEIPT_MAGIC,
      receiptVersion: RECEIPT_VERSION,
      receiptWords: RECEIPT_WORDS,
      caseWords: CASE_WORDS,
      caseBases: CASE_BASES,
      globalSealWord: GLOBAL_SEAL_WORD,
      stageDiagnosticBase: STAGE_DIAGNOSTIC_BASE,
      generationFieldSnapshotBase: GENERATION_FIELD_SNAPSHOT_BASE,
      generationFieldSnapshotWords: GENERATION_FIELD_SNAPSHOT_WORDS,
      generationFieldSnapshotMagic: GENERATION_FIELD_SNAPSHOT_MAGIC
    });
  } finally {
    await browser.close();
  }

  assert.equal(
    native.status,
    'complete',
    native.reason || JSON.stringify(native.compilationErrors || [])
  );
  assert.deepEqual(native.compilationErrors, []);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.mapCount, 1);
  assert.equal(
    native.receiptByteLength,
    RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT
  );

  const words = Uint32Array.from(native.receipt);
  const floats = new Float32Array(words.buffer);
  assert.equal(words[0], RECEIPT_MAGIC);
  assert.equal(words[1], RECEIPT_VERSION);
  assert.equal(words[2], 3);
  assert.equal(words[3], CASE_WORDS);

  const decodeCase = (base) => ({
    volumeRatioJ: floats[base],
    restVolumeM3: floats[base + 1],
    invalidJCount: words[base + 2],
    invalidV0Count: words[base + 3],
    assignmentStatus: floats[base + 4],
    activeCount: words[base + 5],
    physicalToActive: words[base + 6],
    descriptorStatus: words[base + 7],
    phaseInvalidSourceCount: words[base + 8],
    phaseSelectedSourceCount: words[base + 9],
    pressureVolumeMomentPaM3: floats[base + 10],
    absolutePressurePa: floats[base + 11],
    stageFlags: words[base + 12],
    g2pPublishedPressurePa: floats[base + 13],
    materialId: floats[base + 14],
    selectedPhysicalIndex: words[base + 15],
    selectedIdentity: words[base + 16],
    productMatchCount: words[base + 17],
    phaseStatus: words[base + 18],
    phaseIdentityMismatchCount: words[base + 19],
    phaseInvalidFieldCount: words[base + 20],
    phaseHeaderRejectCount: words[base + 21],
    phaseSelectedCandidateCount: words[base + 22],
    phaseGlobalSourceCount: words[base + 23],
    phaseGlobalCandidateCount: words[base + 24],
    phaseFieldCount: words[base + 25],
    phaseTerminalSeal: words[base + 26],
    momentStatus: words[base + 27],
    momentInvalidRawVolumeCount: words[base + 28],
    momentInvalidLineageCount: words[base + 29],
    momentClippedStencilCount: words[base + 30],
    momentContributionCount: words[base + 31],
    momentZeroedFieldCount: words[base + 32],
    momentActiveSourceCount: words[base + 33],
    momentFieldCount: words[base + 34],
    momentGlobalCandidateCount: words[base + 35],
    momentFieldCapacity: words[base + 36],
    fieldStatus: words[base + 37],
    fieldInvalidSourceCount: words[base + 38],
    fieldClippedStencilCount: words[base + 39],
    fieldCapacityOverflowCount: words[base + 40],
    fieldCount: words[base + 41],
    fieldGlobalCandidateCount: words[base + 42],
    fieldPhysicalSourceCount: words[base + 43],
    fieldHeaderMarker55: words[base + 44],
    fieldHeaderMarker56: words[base + 45],
    fieldHeaderMarker57: words[base + 46],
    fieldCandidateMappingErrorCount: words[base + 47],
    fieldCandidateSubreasonBits: words[base + 48],
    fieldDispatchX: words[base + 49],
    fieldDispatchY: words[base + 50],
    fieldDispatchZ: words[base + 51],
    fieldMutationOrdinal: words[base + 52],
    assignmentLevel: floats[base + 53],
    assignmentSpacingM: floats[base + 54],
    assignmentMassKg: floats[base + 55],
    assignmentPhase: floats[base + 56],
    assignmentMaterial: floats[base + 57],
    assignmentStatusExact: floats[base + 58],
    descriptorPhase: words[base + 59],
    descriptorMaterial: words[base + 60],
    descriptorStatusExact: words[base + 61],
    thermoPhase: floats[base + 62],
    thermoDensityKgPerM3: floats[base + 63],
    constitutiveStatus: floats[base + 64],
    eosStatus: floats[base + 65],
    activeSourceStatus: words[base + 66],
    activePhysicalSourceCount: words[base + 67],
    activeCandidateCount: words[base + 68],
    activeCompletionOrdinal: words[base + 69],
    activeTerminalSeal: words[base + 70],
    caseSeal: words[base + CASE_WORDS - 1]
  });
  const valid = decodeCase(CASE_BASES[0]);
  const invalidV0 = decodeCase(CASE_BASES[1]);
  const invalidJ = decodeCase(CASE_BASES[2]);
  const decodeStageDiagnostic = (base) => ({
    discoverySourceDispatchCount: words[base],
    discoveryCandidateVisitCount: words[base + 1],
    discoveryCompatiblePairCount: words[base + 2],
    discoveryProposalCount: words[base + 3],
    discoverySealedRowCount: words[base + 4],
    admittedProposalRowCount: words[base + 5],
    reactionAppliedProductSlotCount: words[base + 6],
    reactionProductEventCount: words[base + 7],
    firstProductEventMaterialId: words[base + 8],
    productEventMassKg: floats[base + 9],
    matchingProductEventCount: words[base + 10],
    placementAttemptedEventCount: words[base + 11],
    placementSelectedEventCount: words[base + 12],
    placementActivatedEventCount: words[base + 13],
    placementCaptureHitCount: words[base + 14],
    placementMergedEventCount: words[base + 15],
    placementFallbackEventCount: words[base + 16],
    placementRejectedEventCount: words[base + 17],
    placementUnknownDispositionCount: words[base + 18],
    placementStatus: words[base + 19],
    terminalSealPassCount: words[base + 20],
    terminalStatus: words[base + 21],
    committedParticleCount: words[base + 22],
    fallbackParticleCount: words[base + 23],
    committedEventRowCount: words[base + 24],
    fallbackEventRowCount: words[base + 25],
    finalThermoMaterialIds: Array.from(words.slice(base + 26, base + 29)),
    reactionAppliedThermoMaterialIds:
      Array.from(words.slice(base + 29, base + 32)),
    placementDirectOnlyEventCount: words[base + 32],
    placementSpareAvailableCount: words[base + 33],
    placementSpareAssignedCount: words[base + 34],
    placementApplyVisitedCount: words[base + 35],
    placementSubthresholdEventCount: words[base + 36],
    placementNoCarrierEventCount: words[base + 37],
    placementOverflowFlags: words[base + 38],
    placementEnvelopeAdmitted: words[base + 39],
    firstProductEventStatus: words[base + 40],
    placedProductEventMassKg: floats[base + 41],
    unplacedProductEventMassKg: floats[base + 42],
    placementApplyPassCount: words[base + 43],
    transactionalPublishPassCount: words[base + 44],
    discoveryDirectoryAdmissionCount: words[base + 45],
    discoveryDirectoryRejectionCount: words[base + 46],
    discoveryMalformedTraversalCount: words[base + 47],
    discoverySourceIdentityRejectionCount: words[base + 48],
    discoveryOverflowCount: words[base + 49],
    discoveryRuleIndexPairLookupCount: words[base + 50],
    discoveryRuleIndexPairMissCount: words[base + 51],
    discoveryRuleIndexRuleVisitCount: words[base + 52],
    discoveryFullRuleScanRuleVisitCount: words[base + 53],
    discoveryMaximumDisplacementM: floats[base + 54],
    discoveryDisplacementCertificateStatusBits: words[base + 55],
    discoveryAuthorityActiveCount: words[base + 56],
    discoveryCurrentActiveCount: words[base + 57],
    discoveryExactCellTreeNodeVisitCount: words[base + 58],
    discoveryExactCellTreeLeafVisitCount: words[base + 59],
    discoveryExactCellTreeMemberVisitCount: words[base + 60],
    discoverySupportProfileId: words[base + 61],
    discoveryGenerationId: words[base + 62],
    seal: words[base + 63]
  });
  const stageDiagnostic =
    decodeStageDiagnostic(STAGE_DIAGNOSTIC_BASE);
  const decodeGenerationFieldSnapshot = (base) => ({
    status: words[base],
    candidateCount: words[base + 1],
    fieldCount: words[base + 2],
    invalidSourceCount: words[base + 3],
    invalidFieldKeyCount: words[base + 4],
    stateEncoding: words[base + 5],
    dispatchX: words[base + 6],
    dispatchY: words[base + 7],
    dispatchZ: words[base + 8],
    descriptorCount: words[base + 9],
    keyOrdering: words[base + 10],
    continuityPolicy: words[base + 11],
    mechanicalFamilyPolicy: words[base + 12],
    indirectDispatchX: words[base + 13],
    indirectDispatchY: words[base + 14],
    indirectDispatchZ: words[base + 15],
    seal: words[base + 16]
  });
  const generationFieldSnapshot =
    decodeGenerationFieldSnapshot(GENERATION_FIELD_SNAPSHOT_BASE);
  let expectedGenerationFieldSnapshotSeal = (
    GENERATION_FIELD_SNAPSHOT_MAGIC
    ^ GENERATION_FIELD_SNAPSHOT_BASE
  ) >>> 0;
  for (let word = 0; word + 1 < GENERATION_FIELD_SNAPSHOT_WORDS; word += 1) {
    expectedGenerationFieldSnapshotSeal = (
      expectedGenerationFieldSnapshotSeal
      ^ words[GENERATION_FIELD_SNAPSHOT_BASE + word]
    ) >>> 0;
  }
  assert.equal(
    generationFieldSnapshot.seal,
    expectedGenerationFieldSnapshotSeal,
    JSON.stringify(generationFieldSnapshot)
  );
  const phaseReadyAdmitted =
    (valid.phaseStatus & 3) === 3
    && valid.phaseTerminalSeal !== 0;
  const phaseHeaderOrLineageRejected =
    !phaseReadyAdmitted
    && (
      valid.phaseHeaderRejectCount > 0
      || valid.phaseIdentityMismatchCount > 0
      || (valid.phaseStatus & ((1 << 4) | (1 << 5))) !== 0
      || (valid.momentStatus & (1 << 4)) !== 0
      || valid.momentInvalidLineageCount > 0
      || valid.fieldCandidateMappingErrorCount > 0
      || valid.fieldCandidateSubreasonBits > 0
    );
  const phaseTopologyDisposition = phaseReadyAdmitted
    ? (
        valid.phaseSelectedSourceCount > 0
          ? 'selected-admitted'
          : 'no-topology-selected-admitted'
      )
    : (
        phaseHeaderOrLineageRejected
          ? 'header-lineage-rejected'
          : 'other-fail-closed'
      );
  console.log(
    'native product P2G phase-topology-pressure receipt',
    JSON.stringify({
      ...valid,
      fieldCandidateSubreasons: decodeFieldCandidateSubreasons(
        valid.fieldCandidateSubreasonBits
      ),
      compactMechanicsRejectReasons: decodeRejectReasons(
        valid.fieldInvalidSourceCount,
        COMPACT_MECHANICS_REJECT_REASONS
      ),
      p2gFieldRejectReasons: decodeRejectReasons(
        valid.fieldCandidateMappingErrorCount,
        P2G_FIELD_REJECT_REASONS
      ),
      phaseReadyAdmitted,
      phaseHeaderOrLineageRejected,
      phaseTopologyDisposition
    })
  );
  console.log(
    'native product P2G pre-projection generation-field snapshot',
    JSON.stringify(generationFieldSnapshot)
  );
  const expectedStageDiagnosticSeal = (
    0x53344734
    ^ stageDiagnostic.discoverySourceDispatchCount
    ^ stageDiagnostic.discoveryCompatiblePairCount
    ^ stageDiagnostic.discoveryProposalCount
    ^ stageDiagnostic.admittedProposalRowCount
    ^ stageDiagnostic.reactionAppliedProductSlotCount
    ^ stageDiagnostic.reactionProductEventCount
    ^ stageDiagnostic.placementAttemptedEventCount
    ^ stageDiagnostic.placementSelectedEventCount
    ^ stageDiagnostic.placementStatus
    ^ stageDiagnostic.terminalStatus
    ^ stageDiagnostic.finalThermoMaterialIds[0]
    ^ stageDiagnostic.finalThermoMaterialIds[1]
    ^ stageDiagnostic.finalThermoMaterialIds[2]
    ^ stageDiagnostic.discoveryDirectoryAdmissionCount
    ^ stageDiagnostic.discoveryDirectoryRejectionCount
    ^ stageDiagnostic.discoveryMalformedTraversalCount
    ^ stageDiagnostic.discoverySourceIdentityRejectionCount
    ^ stageDiagnostic.discoveryOverflowCount
    ^ stageDiagnostic.discoveryRuleIndexPairLookupCount
    ^ stageDiagnostic.discoveryRuleIndexPairMissCount
    ^ stageDiagnostic.discoveryRuleIndexRuleVisitCount
    ^ stageDiagnostic.discoveryFullRuleScanRuleVisitCount
    ^ words[STAGE_DIAGNOSTIC_BASE + 54]
    ^ stageDiagnostic.discoveryDisplacementCertificateStatusBits
    ^ stageDiagnostic.discoveryAuthorityActiveCount
    ^ stageDiagnostic.discoveryCurrentActiveCount
    ^ stageDiagnostic.discoveryExactCellTreeNodeVisitCount
    ^ stageDiagnostic.discoveryExactCellTreeLeafVisitCount
    ^ stageDiagnostic.discoveryExactCellTreeMemberVisitCount
    ^ stageDiagnostic.discoverySupportProfileId
    ^ stageDiagnostic.discoveryGenerationId
  ) >>> 0;
  assert.equal(
    stageDiagnostic.seal,
    expectedStageDiagnosticSeal,
    JSON.stringify(stageDiagnostic)
  );
  console.log(
    'native product P2G first-failing-stage receipt',
    JSON.stringify(stageDiagnostic)
  );

  assert.ok(Number.isFinite(valid.volumeRatioJ) && valid.volumeRatioJ > 0);
  assert.ok(Number.isFinite(valid.restVolumeM3) && valid.restVolumeM3 > 0);
  assert.equal(valid.materialId, native.stageResults[0].productMaterialId);
  assert.ok(valid.selectedPhysicalIndex < 3);
  assert.equal(valid.selectedIdentity, valid.selectedPhysicalIndex + 1);
  assert.ok(valid.productMatchCount > 0);
  assert.equal(valid.invalidJCount, 0);
  assert.equal(valid.invalidV0Count, 0);
  assert.ok(valid.assignmentStatus > 0);
  assert.ok(valid.activeCount > 0);
  assert.ok(valid.physicalToActive < valid.activeCount);
  assert.equal(valid.descriptorStatus, 1);
  assert.equal(valid.assignmentLevel, 0);
  assert.equal(valid.assignmentSpacingM, 0.25);
  assert.ok(valid.assignmentMassKg > 0);
  assert.equal(valid.assignmentPhase, valid.thermoPhase);
  assert.equal(valid.assignmentMaterial, valid.materialId);
  assert.equal(valid.assignmentStatusExact, valid.assignmentStatus);
  assert.equal(valid.descriptorPhase, valid.assignmentPhase);
  assert.equal(valid.descriptorMaterial, valid.assignmentMaterial);
  assert.equal(valid.descriptorStatusExact, valid.descriptorStatus);
  assert.equal(valid.constitutiveStatus, 1);
  assert.equal(valid.eosStatus, 1);
  assert.equal(valid.activePhysicalSourceCount, 3);
  assert.equal(valid.activeCandidateCount, 27);
  assert.notEqual(valid.activeTerminalSeal, 0);
  assert.equal(valid.fieldStatus, 3);
  assert.equal(valid.fieldInvalidSourceCount, 0);
  assert.equal(valid.fieldClippedStencilCount, 0);
  assert.equal(valid.fieldCapacityOverflowCount, 0);
  assert.equal(valid.fieldCandidateMappingErrorCount, 0);
  // The test-only persistent subreason lane observes padded candidate-capacity
  // invocations before the production finalizer clears their transient
  // counter. They may report missing active mappings for capacity-only tails;
  // no other rejection is admissible once the final field is READY|ADMITTED.
  assert.equal(
    valid.fieldCandidateSubreasonBits
      & ~FIELD_CANDIDATE_SUBREASON.ACTIVE_TO_PHYSICAL_MAPPING_INVALID,
    0
  );
  assert.equal(valid.fieldHeaderMarker55, 1);
  assert.equal(valid.fieldHeaderMarker56, 1);
  assert.equal(valid.fieldHeaderMarker57, 1);
  assert.equal(valid.momentStatus, 3);
  assert.equal(valid.momentInvalidRawVolumeCount, 0);
  assert.equal(valid.momentInvalidLineageCount, 0);
  assert.equal(valid.momentClippedStencilCount, 0);
  assert.equal(valid.momentZeroedFieldCount, 0);
  assert.equal(valid.momentActiveSourceCount, 1);
  assert.equal(valid.momentContributionCount, 27);
  assert.equal(valid.phaseStatus, 3);
  assert.equal(valid.phaseInvalidSourceCount, 0);
  assert.equal(valid.phaseInvalidFieldCount, 0);
  assert.equal(valid.phaseIdentityMismatchCount, 0);
  assert.equal(valid.phaseHeaderRejectCount, 0);
  assert.equal(phaseTopologyDisposition, 'selected-admitted');
  assert.equal(valid.phaseSelectedSourceCount, 1);
  assert.equal(valid.phaseSelectedCandidateCount, 27);
  assert.ok(
    Number.isFinite(valid.pressureVolumeMomentPaM3)
      && valid.pressureVolumeMomentPaM3 > 0
  );
  assert.ok(
    Number.isFinite(valid.absolutePressurePa)
      && valid.absolutePressurePa > 0
  );
  assert.ok(
    Number.isFinite(valid.g2pPublishedPressurePa)
      && valid.g2pPublishedPressurePa > 0
  );
  assert.equal(valid.stageFlags, 31);

  assert.equal(invalidV0.volumeRatioJ, 0.5);
  assert.equal(invalidV0.restVolumeM3, 0);
  assert.equal(invalidV0.invalidJCount, 0);
  assert.equal(invalidV0.invalidV0Count, 1);
  assert.equal(invalidV0.assignmentStatus, 0);
  assert.equal(invalidV0.activeCount, 0);
  assert.equal(invalidV0.physicalToActive, 0xffff_ffff);
  assert.equal(invalidV0.descriptorStatus, 0);
  assert.equal(invalidV0.pressureVolumeMomentPaM3, 0);
  assert.equal(invalidV0.absolutePressurePa, 0);
  assert.equal(invalidV0.g2pPublishedPressurePa, 0);
  assert.equal(invalidV0.stageFlags, 1);

  assert.equal(invalidJ.volumeRatioJ, 0);
  assert.ok(Math.abs(invalidJ.restVolumeM3 - 0.001) < 1e-8);
  assert.equal(invalidJ.invalidJCount, 1);
  assert.equal(invalidJ.invalidV0Count, 0);
  assert.equal(invalidJ.assignmentStatus, 0);
  assert.equal(invalidJ.activeCount, 0);
  assert.equal(invalidJ.physicalToActive, 0xffff_ffff);
  assert.equal(invalidJ.descriptorStatus, 0);
  assert.equal(invalidJ.pressureVolumeMomentPaM3, 0);
  assert.equal(invalidJ.absolutePressurePa, 0);
  assert.equal(invalidJ.g2pPublishedPressurePa, 0);
  assert.equal(invalidJ.stageFlags, 1);

  for (const [caseIndex, base] of CASE_BASES.entries()) {
    let expectedSeal = (
      RECEIPT_MAGIC ^ base ^ words[base + 12]
    ) >>> 0;
    for (let word = 0; word + 1 < CASE_WORDS; word += 1) {
      expectedSeal = (expectedSeal ^ words[base + word]) >>> 0;
    }
    assert.equal(
      words[base + CASE_WORDS - 1],
      expectedSeal,
      `case ${caseIndex} terminal seal`
    );
  }
  assert.equal(
    words[GLOBAL_SEAL_WORD],
    (
      RECEIPT_MAGIC
      ^ CASE_WORDS
      ^ words[CASE_BASES[0] + CASE_WORDS - 1]
      ^ words[CASE_BASES[1] + CASE_WORDS - 1]
      ^ words[CASE_BASES[2] + CASE_WORDS - 1]
      ^ words[STAGE_DIAGNOSTIC_BASE + 63]
      ^ words[
        GENERATION_FIELD_SNAPSHOT_BASE
          + GENERATION_FIELD_SNAPSHOT_WORDS
          - 1
      ]
    ) >>> 0
  );

  assert.deepEqual(
    native.stageResults.map((result) => ({
      label: result.label,
      assignmentBufferRetained: result.assignmentBufferRetained,
      generationReady: result.generationReady,
      placementAdoptionReady: result.placementAdoptionReady,
      placementAdoptionAuthenticated:
        result.placementAdoptionAuthenticated,
      placementArtifactExact: result.placementArtifactExact,
      placementUploadFamilyExact: result.placementUploadFamilyExact,
      stageDiagnosticBoundExact: result.stageDiagnosticBoundExact,
      projectionBackend: result.projectionBackend,
      gridUpdateBackend: result.gridUpdateBackend,
      g2pBackend: result.g2pBackend,
      fullReadbackPerformed: result.fullReadbackPerformed
    })),
    [
      {
        label: 'valid-placement',
        assignmentBufferRetained: true,
        generationReady: true,
        placementAdoptionReady: true,
        placementAdoptionAuthenticated: true,
        placementArtifactExact: true,
        placementUploadFamilyExact: true,
        stageDiagnosticBoundExact: true,
        projectionBackend: 'webgpu',
        gridUpdateBackend: 'webgpu',
        g2pBackend: 'webgpu',
        fullReadbackPerformed: false
      },
      {
        label: 'invalid-v0',
        assignmentBufferRetained: true,
        generationReady: false,
        placementAdoptionReady: false,
        placementAdoptionAuthenticated: false,
        placementArtifactExact: false,
        placementUploadFamilyExact: false,
        stageDiagnosticBoundExact: false,
        projectionBackend: null,
        gridUpdateBackend: null,
        g2pBackend: null,
        fullReadbackPerformed: false
      },
      {
        label: 'invalid-j',
        assignmentBufferRetained: true,
        generationReady: false,
        placementAdoptionReady: false,
        placementAdoptionAuthenticated: false,
        placementArtifactExact: false,
        placementUploadFamilyExact: false,
        stageDiagnosticBoundExact: false,
        projectionBackend: null,
        gridUpdateBackend: null,
        g2pBackend: null,
        fullReadbackPerformed: false
      }
    ]
  );
});
