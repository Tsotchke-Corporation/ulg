import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ABI,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCHEMA,
  createSchroederSpatialPhaseVolumeTransportScratchHeader,
  schroederSpatialPhaseVolumeTransportScratchWordLength
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransport.js';
import {
  schroederSpatialPhaseVolumePressureDragOperatorWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumePressureDragOperatorWgsl.js';
import {
  schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl.js';
import {
  schroederSpatialPhaseVolumeSurfaceStressTransportWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.js';
import {
  schroederSpatialPhaseVolumeTransportWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransportWgsl.js';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('Slice 9 transport scratch has one sealed transactional row per field', () => {
  assert.equal(
    ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCHEMA,
    'peercompute.ulg.schroeder-spatial-phase-volume-transport.v1'
  );
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES, 256);
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS, 8);
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS, 12);
  assert.equal(
    schroederSpatialPhaseVolumeTransportScratchWordLength(3),
    44
  );
  const header = createSchroederSpatialPhaseVolumeTransportScratchHeader({
    fieldCapacity: 3,
    generationId: 17,
    fieldCompletionOrdinal: 23
  });
  assert.deepEqual([...header.slice(0, 7)], [
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC,
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION,
    0,
    3,
    17,
    23,
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS
  ]);
  assert.equal(
    header[7],
    (
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC
      ^ SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION
      ^ 3
      ^ 17
      ^ 23
      ^ SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS
    ) >>> 0
  );
  assert.match(
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ABI.fallbackPolicy,
    /fail-closed/
  );
});

test('Slice 9 pressure and drag share one material-neutral conservative operator', () => {
  const source = schroederSpatialPhaseVolumePressureDragOperatorWgsl;
  assert.match(source, /fn schroeder_phase_volume_pressure_drag_pair\(/);
  assert.match(
    source,
    /gas_volume \* condensed_gradient[\s\S]*condensed_volume \* gas_gradient/
  );
  assert.match(
    source,
    /condensed_velocity[\s\S]*\+ pressure_impulse \* condensed_response_inverse_mass[\s\S]*gas_velocity[\s\S]*- pressure_impulse \* gas_response_inverse_mass/
  );
  assert.match(source, /pressure_internal_compensation =\s*-pressure_kinetic_delta/);
  assert.match(source, /drag_alpha = select\([\s\S]*drag_x \/ \(1\.0 \+ drag_x\)/);
  assert.match(source, /drag_heat = max\(0\.0, -drag_kinetic_delta\)/);
  assert.doesNotMatch(source, /\b(h2o|water|steam|hydrogen|sodium)\b/i);
});

test('Slice 9 surface stress is one material-neutral torque-free central-bond operator', () => {
  const source = schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl;
  assert.match(
    source,
    /fn schroeder_phase_volume_surface_stress_component\(/
  );
  assert.match(
    source,
    /surface_tension_n_per_m[\s\S]*gradient_length_m2[\s\S]*grid_spacing_m \* grid_spacing_m \* grid_spacing_m/
  );
  assert.match(
    source,
    /fn schroeder_phase_volume_surface_stress_bond\(/
  );
  assert.match(
    source,
    /0\.5\s*\* \(left_component_pa \+ right_component_pa\)/
  );
  assert.match(
    source,
    /grid_spacing_m\s*\* grid_spacing_m\s*\/ bond_length_cells[\s\S]*\* bond_stress_pa[\s\S]*\* bond_axis/
  );
  assert.match(
    source,
    /reduced_mass = 1\.0 \/ response_inverse_mass/
  );
  assert.match(source, /bond_impulse_ns \* \(impulse_limit \/ impulse_length\)/);
  assert.doesNotMatch(source, /surface_stress_face|surface_stress_traction/);
  assert.doesNotMatch(source, /scratch|field_view|internal_compensation/);
  assert.doesNotMatch(
    source,
    /\b(h2o|water|steam|iron|sodium|cohesion|render)\b/i
  );
});

test('Slice 9 surface stress is an 18-pass sealed central-bond transaction over exact Cartesian keys', () => {
  const source = schroederSpatialPhaseVolumeSurfaceStressTransportWgsl;
  assert.match(source, /fn find_field_key\(/);
  assert.match(source, /fn surface_stress_bond_neighbor\(/);
  assert.match(source, /fn surface_stress_bond_delta\(/);
  assert.match(
    source,
    /fn stage_surface_stress_pair\([\s\S]*coordinate % 2u != parity[\s\S]*schroeder_phase_volume_surface_stress_bond\([\s\S]*left_velocity = left_initial_velocity \+ impulse_ns \/ left_mass[\s\S]*right_velocity = right_initial_velocity - impulse_ns \/ right_mass/
  );
  assert.match(
    source,
    /left_compensation_j =\s*-\(left_kinetic_after - left_kinetic_before\)[\s\S]*right_compensation_j =\s*-\(right_kinetic_after - right_kinetic_before\)/
  );
  assert.match(
    source,
    /scratch_store\(left_row \+ SCRATCH_STATUS, 0u\)[\s\S]*scratch_store\(right_row \+ SCRATCH_STATUS, 0u\)[\s\S]*scratch_add_compensation\(field_index[\s\S]*scratch_add_compensation\(neighbor[\s\S]*scratch_store\(left_row \+ SCRATCH_STATUS, SCRATCH_ROW_READY\)[\s\S]*scratch_store\(right_row \+ SCRATCH_STATUS, SCRATCH_ROW_READY\)/
  );
  for (const axis of ['x', 'y', 'z']) {
    assert.match(source, new RegExp(`fn stage_surface_stress_${axis}_even\\(`));
    assert.match(source, new RegExp(`fn stage_surface_stress_${axis}_odd\\(`));
  }
  for (const diagonal of [
    'xy_positive',
    'xy_negative',
    'xz_positive',
    'xz_negative',
    'yz_positive',
    'yz_negative'
  ]) {
    assert.match(
      source,
      new RegExp(`fn stage_surface_stress_${diagonal}_even\\(`)
    );
    assert.match(
      source,
      new RegExp(`fn stage_surface_stress_${diagonal}_odd\\(`)
    );
  }
  assert.match(source, /params\.max_impulse_fraction \/ 18\.0/);
  assert.match(
    source,
    /params\.surface_stress_enabled == 1u/
  );
  assert.match(
    source,
    /params\.phase_record_count > 0u/
  );
  assert.doesNotMatch(source, /mapAsync/i);
  assert.doesNotMatch(source, /@binding\([123]\)/);
});

test('Slice 9 same-level transport validates all staged rows before store-only commit', () => {
  const source = schroederSpatialPhaseVolumeTransportWgsl;
  assert.match(source, /@binding\(7\) var<storage, read_write> transport_scratch/);
  assert.match(source, /fn canonical_local_head_range\(/);
  assert.match(source, /fn stage_ambient_buoyancy\(/);
  assert.match(
    source,
    /if \(phase_id < PHASE_GAS \|\| params\.ambient_density_kg_per_m3 <= 0\.0\)/
  );
  assert.match(source, /fn stage_transport\(/);
  assert.match(source, /fn validate_staged_transport\(/);
  assert.match(
    source,
    /momentum_residual = mass \* \(velocity - initial_velocity\) - impulse/
  );
  assert.match(
    source,
    /momentum_residual =\s*condensed_mass[\s\S]*\+ gas_mass/
  );
  assert.match(
    source,
    /energy_residual =\s*kinetic_delta \+ deposited_pressure_compensation \+ deposited_heat/
  );
  assert.match(
    source,
    /fn validate_staged_transport\([\s\S]*scratch_row_valid\(field_index\)/
  );
  assert.match(source, /const SCRATCH_MAX_FIELD_CAPACITY: u32 = 357913940u/);
  const scratchAdmission = source.slice(
    source.indexOf('fn scratch_admitted('),
    source.indexOf('fn reject_scratch(')
  );
  assert.doesNotMatch(scratchAdmission, /\/\s*SCRATCH_ROW_WORDS/);
  assert.match(source, /fn commit_transport\(/);
  assert.match(
    source,
    /fn commit_transport\([\s\S]*scratch_load\(SCRATCH_FAILURE_WORD\) != 0u[\s\S]*Validation ran in a prior dispatch[\s\S]*field_store\(state \+ 1u/
  );
  const commit = source.slice(source.indexOf('fn commit_transport('));
  assert.doesNotMatch(commit, /scratch_row_valid\(/);
  assert.doesNotMatch(commit, /stage_gas_condensed_pair\(/);
});

test('native Slice 9 same-level transport applies pressure, drag, and ambient work transactionally', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_TRANSPORT_CHROME
      || '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const [
        fieldAbi,
        proposalAbi,
        receiptAbi,
        momentAbi,
        transportAbi,
        transportShader
      ] = await Promise.all([
        import(
          `/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js?nativeS9=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js?nativeS9=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js?nativeS9=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js?nativeS9=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransport.js?nativeS9=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransportWgsl.js?nativeS9=${nonce}`
        )
      ]);

      const module = device.createShaderModule({
        label: 'native-slice9-same-level-transport',
        code: transportShader.schroederSpatialPhaseVolumeTransportWgsl
      });
      const compilation = await module.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      if (compilationErrors.length > 0) {
        device.destroy();
        return {
          status: 'shader-error',
          compilationErrors,
          uncapturedErrors
        };
      }

      const bindGroupLayout = device.createBindGroupLayout({
        label: 'native-slice9-same-level-transport-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
          },
          ...[1, 2, 3, 4, 5].map((binding) => ({
            binding,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' }
          })),
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
          },
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
          }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({
        label: 'native-slice9-same-level-transport-pipeline-layout',
        bindGroupLayouts: [bindGroupLayout]
      });
      const pipelines = {};
      for (const entryPoint of [
        'stage_transport',
        'validate_staged_transport',
        'commit_transport'
      ]) {
        try {
          pipelines[entryPoint] = await device.createComputePipelineAsync({
            label: `native-slice9-${entryPoint}`,
            layout: pipelineLayout,
            compute: { module, entryPoint }
          });
        } catch (error) {
          const lost = await Promise.race([
            device.lost,
            new Promise((resolve) => setTimeout(
              () => resolve(null),
              1_000
            ))
          ]);
          return {
            status: 'pipeline-error',
            entryPoint,
            error: error?.message || String(error),
            deviceLost: lost
              ? { reason: lost.reason, message: lost.message }
              : null,
            uncapturedErrors
          };
        }
      }

      const f32Bits = (value) => {
        const bytes = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
        const view = new DataView(bytes);
        view.setFloat32(0, value, true);
        return view.getUint32(0, true);
      };
      const bitsF32 = (value) => {
        const bytes = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
        const view = new DataView(bytes);
        view.setUint32(0, value >>> 0, true);
        return view.getFloat32(0, true);
      };
      const identity = {
        generationId: 17,
        deviceOrdinal: 2,
        laneOrdinal: 3,
        leaseToken: 5,
        sourceFamilyId: 7,
        storageGeneration: 11,
        physicsTick: 13,
        physicsSubstep: 1,
        positionEpoch: 19,
        topologyEpoch: 23,
        chartEpoch: 29,
        levelEpoch: 31,
        supportEpoch: 37
      };
      const identityValues = [
        identity.generationId,
        identity.deviceOrdinal,
        identity.laneOrdinal,
        identity.leaseToken,
        identity.sourceFamilyId,
        identity.storageGeneration,
        identity.physicsTick,
        identity.physicsSubstep,
        identity.positionEpoch,
        identity.topologyEpoch,
        identity.chartEpoch,
        identity.levelEpoch,
        identity.supportEpoch
      ];
      const writeIdentity = (words) => {
        identityValues.forEach((value, index) => {
          words[3 + index] = value >>> 0;
        });
      };

      const sourceCapacity = 1;
      const fieldCapacity = 2;
      const fieldCount = 2;
      const gridNodeCount = 8;
      const gridSpacingM = 0.25;
      const fieldCompletionOrdinal = 41;
      const otherReceiptCompletionOrdinal = 43;
      const parentFieldCompletionOrdinal = 47;
      const mutationInputOrdinal = 1;
      const mutationOutputOrdinal = 2;
      const fieldLayout =
        fieldAbi.createSchroederSpatialMechanicsFieldViewLayout({
          sourceCapacity,
          fieldCapacity
        });
      const proposalLayout =
        proposalAbi.createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
          fineFieldCapacity: fieldCapacity,
          coarseFieldCapacity: 1
        });

      const makeFieldWords = () => {
        const words = new Uint32Array(fieldLayout.wordLength);
        writeIdentity(words);
        words[0] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
        words[1] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
        words[2] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
          | fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
        words[16] = 1;
        words[17] = 0;
        words[18] = gridNodeCount;
        words[19] = 2;
        words[20] = 2;
        words[21] = 2;
        words[22] = 1;
        words[23] = f32Bits(gridSpacingM);
        words[24] = fieldLayout.descriptorOffsetWords;
        words[25] = fieldLayout.descriptorWords;
        words[26] = fieldLayout.keyOffsetWords;
        words[27] = fieldLayout.keyWords;
        words[28] = fieldLayout.accumulatorOffsetWords;
        words[29] = fieldLayout.accumulatorWords;
        words[30] = fieldLayout.stateOffsetWords;
        words[31] = fieldLayout.stateWords;
        words[32] = fieldCapacity;
        words[33] = fieldCount;
        words[34] = fieldCount;
        words[38] = fieldCompletionOrdinal;
        words[39] = 1;
        words[40] = 1;
        words[41] = fieldLayout.wordLength;
        words[42] = fieldLayout.wordLength;
        words[43] = fieldCapacity * fieldLayout.accumulatorWords;
        words[44] = 1;
        words[45] = 1;
        words[46] = 1;
        words[53] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY;
        words[54] = 1;
        words[55] = 1;
        words[56] = 1;
        words[57] = 1;
        words[59] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY;
        words[60] = 1;
        words[61] = 1;
        words[62] = 1;
        words[63] = mutationOutputOrdinal;

        const condensedKey = fieldLayout.keyOffsetWords;
        const gasKey = condensedKey + fieldLayout.keyWords;
        words.set([3, 2, 1, 0], condensedKey);
        words.set([3, 3, 2, 0], gasKey);

        const receipt = fieldLayout.receiptControlOffsetWords;
        words[receipt] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC;
        words[receipt + 1] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION;
        words[receipt + 2] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
          | fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED;
        words[receipt + 3] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING;
        words[receipt + 5] = mutationOutputOrdinal;
        words[receipt + 6] = fieldCount;
        const pressureStatus =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
          | fieldAbi
            .SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED;
        const pressureRequiredMask =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL;
        words[receipt + 24] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC;
        words[receipt + 25] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION;
        words[receipt + 26] = pressureStatus;
        words[receipt + 27] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G;
        words[receipt + 28] = f32Bits(0);
        words[receipt + 29] = f32Bits(1);
        words[receipt + 30] = fieldCount;
        words[receipt + 31] = mutationInputOrdinal;
        words[receipt + 32] = pressureRequiredMask;
        words[receipt + 33] = pressureRequiredMask;
        words[receipt + 34] = 0;
        words[receipt + 35] = [
          words[receipt + 24],
          words[receipt + 25],
          words[receipt + 26],
          words[receipt + 27],
          words[receipt + 28],
          words[receipt + 29],
          words[receipt + 30],
          words[receipt + 31],
          words[receipt + 32],
          identity.generationId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          fieldCompletionOrdinal
        ].reduce((seal, value) => (seal ^ value) >>> 0, 0);

        const condensedState = fieldLayout.stateOffsetWords;
        const gasState = condensedState + fieldLayout.stateWords;
        words.set([
          f32Bits(2),
          f32Bits(1),
          f32Bits(0),
          f32Bits(0),
          f32Bits(1),
          f32Bits(0),
          f32Bits(0),
          1
        ], condensedState);
        words.set([
          f32Bits(1),
          f32Bits(-1),
          f32Bits(0),
          f32Bits(0),
          f32Bits(-1),
          f32Bits(0),
          f32Bits(0),
          1
        ], gasState);
        const pressureOffset = fieldLayout.stateOffsetWords
          + fieldCapacity * fieldLayout.stateWords;
        words.set([
          f32Bits(0), f32Bits(1), f32Bits(0), 1,
          f32Bits(4), f32Bits(1), f32Bits(4), 1
        ], pressureOffset);
        return words;
      };

      const makeProposalWords = () => {
        const words = new Uint32Array(
          proposalAbi
            .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS
        );
        writeIdentity(words);
        words[0] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC;
        words[1] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION;
        words[2] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY
          | proposalAbi
            .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED;
        words[16] = fieldCount;
        words[17] = fieldCapacity;
        words[18] = 1;
        words[19] = 1;
        words[20] = 1;
        words[21] = 0;
        words[22] = 0;
        words[23] = 0;
        words[24] = 1;
        words[25] = 1;
        words[26] = 1;
        words[27] = fieldCompletionOrdinal;
        words[28] = otherReceiptCompletionOrdinal;
        words[29] = parentFieldCompletionOrdinal;
        words[30] = proposalLayout.fineLocalHeadOffsetWords;
        words[31] = proposalLayout.coarseLocalHeadOffsetWords;
        words[32] = proposalLayout.localHeadCapacity;
        words[33] = proposalLayout.refluxRouteCapacity;
        words[34] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS;
        words[35] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS;
        words[36] =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS;
        words[37] =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS;
        words[39] = 3;
        words[47] = 1;
        words[50] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY;
        words[51] =
          proposalAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY;
        words[52] = 1;
        words[53] = 1;
        words[54] = 1;
        words[55] =
          proposalAbi
            .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS;
        words[49] = (
          words[0]
          ^ words[3]
          ^ words[27]
          ^ words[28]
          ^ words[29]
          ^ words[23]
          ^ words[24]
          ^ words[17]
          ^ words[19]
          ^ words[25]
          ^ words[26]
          ^ words[2]
        ) >>> 0;
        return words;
      };

      const makeLocalHeadWords = (corrupt) => {
        const words = new Uint32Array(proposalLayout.localHeadWords);
        words.set([
          0,
          3,
          corrupt ? 3 : 2,
          0,
          proposalAbi
            .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY,
          proposalAbi
            .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY
            | proposalAbi
              .SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED,
          0,
          0
        ]);
        return words;
      };

      const makeReceiptWords = () => {
        const words = new Uint32Array(
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS
        );
        writeIdentity(words);
        words[0] = receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC;
        words[1] = receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION;
        words[2] =
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY
          | receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED;
        words[16] = 1;
        words[17] = sourceCapacity;
        words[18] = fieldCount;
        words[19] = fieldCapacity;
        words[20] = fieldCount;
        words[21] = 0;
        words[22] = gridNodeCount;
        words[23] = f32Bits(gridSpacingM);
        words[24] =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS;
        words[25] =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS;
        words[26] = fieldCompletionOrdinal;
        words[47] = 1;
        words[48] = fieldCount;
        words[58] =
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS;
        words[59] = (
          words[0]
          ^ identity.generationId
          ^ fieldCompletionOrdinal
          ^ words[2]
        ) >>> 0;
        return words;
      };

      const makeMomentWords = () => {
        const words = new Uint32Array(
          fieldCapacity
            * momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
        );
        const ready =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
          | momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED;
        words.set([
          3, 2, 1, 0,
          f32Bits(1), f32Bits(1), f32Bits(0), f32Bits(0),
          1, ready, 0, 0
        ], 0);
        words.set([
          3, 3, 2, 0,
          f32Bits(1), f32Bits(-1), f32Bits(0), f32Bits(0),
          1, ready, 0, 0
        ], momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS);
        return words;
      };

      const makeParams = () => {
        const bytes = new ArrayBuffer(
          transportAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES
        );
        const view = new DataView(bytes);
        const u32 = (word, value) => view.setUint32(
          word * Uint32Array.BYTES_PER_ELEMENT,
          value >>> 0,
          true
        );
        const i32 = (word, value) => view.setInt32(
          word * Uint32Array.BYTES_PER_ELEMENT,
          value,
          true
        );
        const f32 = (word, value) => view.setFloat32(
          word * Uint32Array.BYTES_PER_ELEMENT,
          value,
          true
        );
        u32(0, gridNodeCount);
        u32(1, 2);
        u32(2, 2);
        u32(3, 2);
        u32(4, 1);
        u32(5, 0);
        u32(6, mutationInputOrdinal);
        u32(7, mutationOutputOrdinal);
        f32(8, gridSpacingM);
        f32(9, 0.01);
        f32(10, 0);
        f32(11, -9.81);
        f32(12, 0);
        f32(13, 2);
        f32(14, 2);
        f32(15, 2);
        f32(16, 0.4);
        u32(20, 1);
        u32(21, 2);
        i32(22, 0);
        u32(23, fieldCapacity);
        u32(24, proposalLayout.fineLocalHeadOffsetWords);
        u32(25, identity.generationId);
        u32(26, fieldCompletionOrdinal);
        u32(27, otherReceiptCompletionOrdinal);
        u32(28, parentFieldCompletionOrdinal);
        i32(29, 0);
        i32(30, 1);
        u32(31, 0);
        f32(32, 0);
        f32(33, 0.5);
        f32(34, 1);
        f32(35, 1);
        f32(36, 0.5);
        u32(40, identity.storageGeneration);
        u32(41, identity.physicsTick);
        u32(42, identity.physicsSubstep);
        u32(43, identity.positionEpoch);
        u32(44, identity.topologyEpoch);
        u32(45, identity.chartEpoch);
        u32(46, identity.levelEpoch);
        u32(47, identity.supportEpoch);
        return bytes;
      };

      const materialPhaseRecords = new Float32Array([
        1, 2, 1000, 0,
        0, 0, 3, 0,
        0, 1, 1, 0,
        2, 3, 1, 0,
        0, 0, 2, 0,
        0, 1, 1, 0
      ]);
      const storageUsage =
        GPUBufferUsage.STORAGE
        | GPUBufferUsage.COPY_DST
        | GPUBufferUsage.COPY_SRC;
      const upload = (label, data, usage = storageUsage) => {
        const byteLength = data.byteLength;
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, (byteLength + 3) & ~3),
          usage
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const readWords = async (encoder, source, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(source, 0, readback, 0, byteLength);
        return {
          readback,
          async finish() {
            await readback.mapAsync(GPUMapMode.READ);
            const words = new Uint32Array(
              readback.getMappedRange().slice(0)
            );
            readback.unmap();
            readback.destroy();
            return words;
          }
        };
      };

      const runCase = async (corrupt) => {
        const fieldWords = makeFieldWords();
        const scratchWords = new Uint32Array(
          transportAbi.schroederSpatialPhaseVolumeTransportScratchWordLength(
            fieldCapacity
          )
        );
        scratchWords.set(
          transportAbi.createSchroederSpatialPhaseVolumeTransportScratchHeader({
            fieldCapacity,
            generationId: identity.generationId,
            fieldCompletionOrdinal
          })
        );
        const buffers = [
          upload('native-slice9-field', fieldWords),
          upload('native-slice9-proposal', makeProposalWords()),
          upload('native-slice9-local-heads', makeLocalHeadWords(corrupt)),
          upload('native-slice9-receipt', makeReceiptWords()),
          upload('native-slice9-moments', makeMomentWords()),
          upload('native-slice9-materials', materialPhaseRecords),
          upload(
            'native-slice9-params',
            makeParams(),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
          ),
          upload('native-slice9-scratch', scratchWords)
        ];
        const bindGroup = device.createBindGroup({
          label: `native-slice9-${corrupt ? 'corrupt' : 'valid'}-bind-group`,
          layout: bindGroupLayout,
          entries: buffers.map((buffer, binding) => ({
            binding,
            resource: { buffer }
          }))
        });
        const encoder = device.createCommandEncoder({
          label: `native-slice9-${corrupt ? 'corrupt' : 'valid'}`
        });
        const pass = encoder.beginComputePass();
        for (const entryPoint of [
          'stage_transport',
          'validate_staged_transport',
          'commit_transport'
        ]) {
          pass.setPipeline(pipelines[entryPoint]);
          pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(1);
        }
        pass.end();
        const fieldRead = await readWords(
          encoder,
          buffers[0],
          fieldWords.byteLength,
          'native-slice9-field-readback'
        );
        const scratchRead = await readWords(
          encoder,
          buffers[7],
          scratchWords.byteLength,
          'native-slice9-scratch-readback'
        );
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const [fieldResult, scratchResult] = await Promise.all([
          fieldRead.finish(),
          scratchRead.finish()
        ]);
        buffers.forEach((buffer) => buffer.destroy());

        const stateRows = [0, 1].map((fieldIndex) => {
          const state =
            fieldLayout.stateOffsetWords
            + fieldIndex * fieldLayout.stateWords;
          const accumulator =
            fieldLayout.accumulatorOffsetWords
            + fieldIndex * fieldLayout.accumulatorWords;
          return {
            mass: bitsF32(fieldResult[state]),
            velocity: [
              bitsF32(fieldResult[state + 1]),
              bitsF32(fieldResult[state + 2]),
              bitsF32(fieldResult[state + 3])
            ],
            heatJ: bitsF32(
              fieldResult[
                accumulator
                + transportAbi
                  .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR
                  .localHeatJ
              ]
            ),
            heatContributionCount:
              fieldResult[
                accumulator
                + transportAbi
                  .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR
                  .localHeatContributionCount
              ],
            pressureCompensationJ: bitsF32(
              fieldResult[
                accumulator
                + transportAbi
                  .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR
                  .localPressureInternalCompensationJ
              ]
            ),
            ambientImpulseNs: [4, 5, 6].map((offset) =>
              bitsF32(fieldResult[accumulator + offset])
            ),
            ambientWorkJ: bitsF32(fieldResult[accumulator + 7])
          };
        });
        const receipt = fieldLayout.receiptControlOffsetWords;
        return {
          fieldStatus: fieldResult[2],
          receiptStatus: fieldResult[receipt + 2],
          receiptPhase: fieldResult[receipt + 3],
          indirectDispatch: [
            fieldResult[60],
            fieldResult[61],
            fieldResult[62]
          ],
          scratchFailure: scratchResult[2],
          scratchStatuses: [0, 1].map(
            (fieldIndex) =>
              scratchResult[
                transportAbi
                  .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
                + fieldIndex
                  * transportAbi
                    .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS
                + 10
              ]
          ),
          stateRows
        };
      };

      const valid = await runCase(false);
      const rejected = await runCase(true);
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'executed',
        valid,
        rejected,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'executed', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));

  const close = (actual, expected, tolerance = 2e-5) => {
    assert.ok(
      Number.isFinite(actual)
        && Math.abs(actual - expected)
          <= Math.max(tolerance, Math.abs(expected) * 2e-5),
      `expected ${actual} to be close to ${expected}; ${JSON.stringify(native)}`
    );
  };
  const condensedMass = 2;
  const gasMass = 1;
  const reducedMass = 1 / (1 / condensedMass + 1 / gasMass);
  const ambientImpulseY = 0.5 * 1 * 9.81 * 0.01;
  const ambientWorkJ =
    0.5 * gasMass * (ambientImpulseY / gasMass) ** 2;
  const pressureImpulseX = 4 * 1 * 0.01;
  const pressureKineticDelta =
    pressureImpulseX * (1 - -1)
    + 0.5 * pressureImpulseX ** 2
      * (1 / condensedMass + 1 / gasMass);
  const pressureCompensationJ = -pressureKineticDelta;
  const preDragCondensed = [
    1 + pressureImpulseX / condensedMass,
    0,
    0
  ];
  const preDragGas = [
    -1 - pressureImpulseX / gasMass,
    ambientImpulseY / gasMass,
    0
  ];
  const dragX = (
    (1 + 1) * 1 / 0.25
  ) * 0.01 / reducedMass;
  const dragAlpha = dragX / (1 + dragX);
  const dragImpulse = preDragGas.map(
    (value, axis) =>
      reducedMass * dragAlpha * (value - preDragCondensed[axis])
  );
  const expectedCondensedVelocity = preDragCondensed.map(
    (value, axis) => value + dragImpulse[axis] / condensedMass
  );
  const expectedGasVelocity = preDragGas.map(
    (value, axis) => value - dragImpulse[axis] / gasMass
  );
  const dragKineticDelta =
    dragImpulse.reduce(
      (sum, value, axis) =>
        sum + value * (preDragCondensed[axis] - preDragGas[axis]),
      0
    )
    + 0.5 * dragImpulse.reduce(
      (sum, value) => sum + value * value,
      0
    ) * (1 / condensedMass + 1 / gasMass);
  const dragHeatJ = -dragKineticDelta;

  assert.equal(native.valid.fieldStatus, 3, JSON.stringify(native));
  assert.equal(native.valid.receiptStatus, 3, JSON.stringify(native));
  assert.equal(native.valid.receiptPhase, 3, JSON.stringify(native));
  assert.equal(native.valid.scratchFailure, 0, JSON.stringify(native));
  assert.deepEqual(
    native.valid.scratchStatuses,
    [
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY,
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY
    ]
  );
  for (let axis = 0; axis < 3; axis += 1) {
    close(
      native.valid.stateRows[0].velocity[axis],
      expectedCondensedVelocity[axis]
    );
    close(
      native.valid.stateRows[1].velocity[axis],
      expectedGasVelocity[axis]
    );
  }
  const pressureTotal = native.valid.stateRows.reduce(
    (sum, row) => sum + row.pressureCompensationJ,
    0
  );
  const heatTotal = native.valid.stateRows.reduce(
    (sum, row) => sum + row.heatJ,
    0
  );
  close(pressureTotal, pressureCompensationJ);
  close(heatTotal, dragHeatJ);
  assert.ok(Math.abs(pressureTotal) > 1e-4, JSON.stringify(native));
  assert.ok(heatTotal > 1e-4, JSON.stringify(native));
  assert.deepEqual(
    native.valid.stateRows.map((row) => row.heatContributionCount),
    [1, 1]
  );
  close(native.valid.stateRows[0].ambientImpulseNs[1], 0);
  close(native.valid.stateRows[1].ambientImpulseNs[1], ambientImpulseY);
  close(native.valid.stateRows[0].ambientWorkJ, 0);
  close(native.valid.stateRows[1].ambientWorkJ, ambientWorkJ);

  const initialKineticJ =
    0.5 * condensedMass * 1 ** 2 + 0.5 * gasMass * (-1) ** 2;
  const finalKineticJ = native.valid.stateRows.reduce(
    (sum, row) =>
      sum + 0.5 * row.mass * row.velocity.reduce(
        (speed2, component) => speed2 + component * component,
        0
      ),
    0
  );
  close(
    finalKineticJ
      - initialKineticJ
      + pressureTotal
      + heatTotal
      - ambientWorkJ,
    0,
    5e-5
  );
  for (let axis = 0; axis < 3; axis += 1) {
    const momentumDelta = native.valid.stateRows.reduce(
      (sum, row, fieldIndex) => {
        const initial = axis === 0
          ? (fieldIndex === 0 ? 1 : -1)
          : 0;
        return sum + row.mass * (row.velocity[axis] - initial);
      },
      0
    );
    close(momentumDelta, axis === 1 ? ambientImpulseY : 0);
  }

  assert.equal(native.rejected.scratchFailure, 1, JSON.stringify(native));
  assert.equal(native.rejected.fieldStatus, 5, JSON.stringify(native));
  assert.equal(native.rejected.receiptStatus, 5, JSON.stringify(native));
  assert.deepEqual(native.rejected.indirectDispatch, [0, 0, 0]);
  assert.deepEqual(
    native.rejected.stateRows.map((row) => row.velocity),
    [[1, 0, 0], [-1, 0, 0]]
  );
  assert.deepEqual(
    native.rejected.stateRows.map((row) => [
      row.heatJ,
      row.pressureCompensationJ,
      row.ambientWorkJ
    ]),
    [[0, 0, 0], [0, 0, 0]]
  );
});
