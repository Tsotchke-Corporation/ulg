import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_NEIGHBOR_CHAIN_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_NEIGHBOR_CHAIN_OUTPUT
  || '/tmp/ulg-resident-neighborhood-consumer-chain.json';
const gpuTimestampProfilingRequested = process.env.ULG_NATIVE_GPU_PROFILE !== '0';

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({ gpuTimestampProfilingRequested }) => {
      const neighborhoodLaneModule = await import('/src/runtime/sph/residentNeighborhoodGpuLane.js');
      const neighborhoodBuilderModule = await import(
        '/src/runtime/sph/residentNeighborhoodGpuBuilder.js'
      );
      const pressureModule = await import('/src/runtime/sph/sphPressureInterfaceGpuKernel.js');
      const gridModule = await import('/src/runtime/sph/sphGridUpdateGpuKernel.js');
      const renderModule = await import('/src/runtime/sph/sphRenderGpuKernel.js');
      const timestampModule = await import('/src/runtime/webgpuTimestampProfiler.js');
      const wgsl = await import('/ulg-gpu-abi/src/wgsl.js');

      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      const requestedStorageBuffers = Math.min(
        16,
        Number(adapter.limits.maxStorageBuffersPerShaderStage || 8)
      );
      const timestampQuerySupported = adapter.features?.has?.('timestamp-query') === true;
      const nativeDevice = await adapter.requestDevice({
        requiredFeatures: gpuTimestampProfilingRequested && timestampQuerySupported
          ? ['timestamp-query']
          : [],
        requiredLimits: { maxStorageBuffersPerShaderStage: requestedStorageBuffers }
      });
      const bufferCreations = [];
      const bufferWrites = [];
      const queueSubmissions = [];
      const queue = new Proxy(nativeDevice.queue, {
        get(target, property) {
          if (property === 'writeBuffer') {
            return (buffer, offset, data, ...rest) => {
              bufferWrites.push({
                label: buffer?.label ?? null,
                offset,
                byteLength: data?.byteLength ?? 0
              });
              return target.writeBuffer(buffer, offset, data, ...rest);
            };
          }
          if (property === 'submit') {
            return (commands) => {
              queueSubmissions.push({ commandCount: commands?.length ?? 0 });
              return target.submit(commands);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const device = new Proxy(nativeDevice, {
        get(target, property) {
          if (property === 'queue') return queue;
          if (property === 'createBuffer') {
            return (descriptor) => {
              bufferCreations.push({
                label: descriptor?.label ?? null,
                size: descriptor?.size ?? 0,
                usage: descriptor?.usage ?? 0
              });
              return target.createBuffer(descriptor);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const validationErrors = [];
      nativeDevice.addEventListener('uncapturederror', (event) => {
        validationErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const shaderCompilationErrors = [];
      for (const [label, code] of [
        ['thermal', wgsl.sphThermalStepWgsl],
        ['reaction', wgsl.sphReactionStepWgsl],
        ['mechanics-separation', wgsl.mlsMpmParticleSeparationComputeWgsl],
        ['render-field', wgsl.sphRenderFieldWgsl],
        ['material-interface-compact', wgsl.sphMaterialInterfaceCompactCandidatesWgsl],
        ['pressure-contact', wgsl.sphPressureInterfaceContactKinematicsWgsl],
        ['pressure-force', wgsl.sphPressureInterfaceForceRowsWgsl]
      ]) {
        const module = device.createShaderModule({ label: `live-chain-${label}`, code });
        const info = await module.getCompilationInfo();
        for (const message of info.messages) {
          if (message.type === 'error') {
            shaderCompilationErrors.push(`${label}:${message.lineNum}:${message.linePos}:${message.message}`);
          }
        }
      }

      const makeBuffer = (
        label,
        data,
        usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      ) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, data.byteLength),
          usage
        });
        if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const generation = 41;
      const positionEpoch = 9;

      const stateRows = new Float32Array([
        0.40, 0.50, 0.50, 1.0, 0, 0, 0, 0,
        0.60, 0.50, 0.50, 1.0, 0, 0, 0, 0
      ]);
      const thermoRows = new Float32Array([
        1, 2, 300, 1000, 0, 1, 0, 0, 0, 0, 1, 0,
        2, 1, 300, 970, 1, 0, 0, 0, 0, 0, 1, 0
      ]);
      const stateBuffer = makeBuffer('live-chain-state', stateRows);
      const thermoBuffer = makeBuffer('live-chain-thermo', thermoRows);
      const neighborhoodLane = neighborhoodLaneModule.createResidentNeighborhoodGpuLane(device, {
        sourceCount: 2,
        supportDistanceM: 0.5,
        cellSizeM: 0.5,
        originM: [0, 0, 0],
        consumers: ['pressureInterface'],
        maxCandidatesPerSource: 2,
        candidateCapacity: 4,
        generationBase: generation,
        positionEpochBase: positionEpoch,
        leaseIdPrefix: 'live-pressure-neighborhood',
        laneId: 'compute-manager-lane-0',
        stateKey: 'simulation/hot-state/41',
        sourceFamily: 'sph-particle-state',
        label: 'live-chain-neighborhood'
      });
      const timestampProfiler = timestampModule.createWebGpuTimestampProfiler(device, {
        requested: gpuTimestampProfilingRequested,
        label: 'ulg-resident-neighborhood-consumer-chain',
        maxSpans: 256
      });
      const encoder = device.createCommandEncoder({ label: 'live-neighborhood-pressure-grid-chain' });
      const neighborhood = neighborhoodLane.encodeGeneration(encoder, {
        positionBuffer: stateBuffer,
        positionStrideU32: 8,
        leaseAuthorityIdentity: {
          schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
          authoritative: true,
          leaseId: 'live-pressure-neighborhood-lease',
          laneId: 'compute-manager-lane-0',
          stateKey: 'simulation/hot-state/41',
          sourceFamily: 'sph-particle-state',
          domainKey: 'live-native-probe',
          solverId: 'ulg-resident-neighborhood-probe',
          taskId: 'live-neighborhood-pressure-grid-chain',
          owner: 'native-probe'
        },
        timestampProfiler,
        timestampMetadata: { probe: 'resident-neighborhood-consumer-chain' },
        substepIndex: 0
      });

      const renderRows = new Float32Array([
        0.40, 0.50, 0.50, 1.0,
        1, 2, 300, 1,
        1000, 0, 1, 0,
        0.001, 0.10, 1, 0,
        0, 0, 0, 0,
        0.60, 0.50, 0.50, 1.0,
        1, 2, 300, 1,
        1000, 0, 1, 0,
        0.001, 0.10, 1, 0,
        0, 0, 0, 0
      ]);
      const renderRowsBuffer = makeBuffer('live-chain-retained-render-rows', renderRows);
      const surfaceTable = renderModule.buildSphRenderFieldSurfaceTable([{
        surfaceKey: 'live-chain-h2o-liquid',
        materialId: 1,
        phaseId: 2,
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        resolution: 8,
        isolation: 10,
        subtract: 2,
        radiusNorm: 0.20,
        colorLinear: [0.2, 0.45, 0.95]
      }]);
      const materialInterfaceSourceField = await renderModule.buildSphMaterialInterfaceSourceFieldWebGpu({
        device,
        renderRowsBuffer,
        surfaceTable,
        particleCount: 2,
        productEventCount: 0,
        fieldPadding: 0.10,
        refEdgeM: 1,
        readbackMode: 'no-full-readback',
        waitForQueueCompletion: true,
        deferCleanup: false,
        source: 'live-neighborhood-retained-material-interface-source',
        sourceCadence: 'same-device-probe-prepass'
      });
      const residentAuthority = {
        generation: neighborhood.descriptor.generation,
        leaseTokenLow: neighborhood.descriptor.lease.tokenLow,
        leaseTokenHigh: neighborhood.descriptor.lease.tokenHigh,
        positionEpoch: neighborhood.descriptor.positionValidity.positionEpoch,
        sourceCount: neighborhood.descriptor.capacityEvidence.sourceCount,
        sourceFamily: neighborhood.descriptor.lease.sourceFamily
      };
      const materialInterfaceField = await renderModule.buildSphPhysicsMaterialInterfaceFieldWebGpu({
        device,
        renderField: materialInterfaceSourceField,
        candidateReadbackMode: 'gpu-resident-summary',
        compactCandidateCapacity: surfaceTable.totalFieldCells * 3,
        commandEncoder: encoder,
        residentAuthority,
        source: 'live-neighborhood-retained-material-interface-candidates',
        sourceCadence: 'same-caller-encoder'
      });
      const algorithmMaterialContactRows = {
        schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
        status: 'algorithm-derived-contact-rows-ready',
        rowCount: 1,
        rows: [{
          schema: 'peercompute.ulg.algorithm-material-contact-row.v0',
          status: 'algorithm-derived-contact-row-ready',
          pairKey: 'water|sodium',
          roles: ['source', 'target'],
          materials: ['h2o', 'Na'],
          materialIds: [1, 2],
          phases: ['liquid', 'solid'],
          phaseIds: [2, 1],
          normalStiffnessPa: 1e6,
          supportRadiusM: 0.5,
          dampingRatio: 0.2,
          forceMutationAuthority: 'not-authoritative-contact-policy-row'
        }]
      };
      const pressureStage = await pressureModule.createSphPressureInterfaceForceRowsWebGpuEncoderStage({
        device,
        commandEncoder: encoder,
        residentNeighborhood: neighborhood,
        residentNeighborhoodValidation: neighborhood.productionLaneValidation,
        pressureFeedback: {
          schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
          status: 'wall-pressure-ledger-ready',
          totalPressurePa: 120000,
          gasCellField: {
            status: 'gas-cell-pressure-field-ready',
            uniformPressurePa: 120000,
            pressureFieldMode: 'uniform-single-cell-sealed-gas',
            pressureFieldResolution: 'lumped-sealed-box',
            gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
          }
        },
        pressureInterfaceCoupling: {
          schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
          status: 'pressure-interface-coupling-ready-for-solver',
          forceCouplingStatus: 'pressure-interface-coupling-ready'
        },
        materialInterfaceField,
        algorithmMaterialContactRows,
        particleStateBuffer: stateBuffer,
        particleThermoBuffer: thermoBuffer,
        particleCount: 2,
        contactKinematicsMaxSearchRadiusM: 0.5,
        boxDimsM: [1, 1, 1]
      });
      const staleGenerationAdmission = (await import(
        '/src/runtime/sph/residentNeighborhoodConsumer.js'
      )).resolveResidentNeighborhoodConsumer({
        residentNeighborhood: neighborhood,
        device,
        consumer: 'pressureInterface',
        sourceCount: 2,
        generation: generation + 1
      });

      const approvedSolver = {
        ...pressureStage.pressureInterfaceForceSolver,
        forceApplicationStatus: 'apply-to-mls-mpm-grid',
        gridForceApplicationApproved: true
      };
      const gridForceAdmission = {
        schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
        status: 'pressure-interface-grid-force-consumption-approved',
        gridForceApplicationApproved: true,
        committed: true,
        sourceHotBufferKey: 'live-chain-pressure-force-rows',
        pressureInterfaceForceRowCount: pressureStage.forceRowCapacity,
        outputFamilies: ['pressure-interface-force-rows']
      };
      const gridRows = new Float32Array([1, 0, 0, 0, 0.5, 0.5, 0.5, 1]);
      const gridBuffer = makeBuffer('live-chain-p2g-grid', gridRows);
      const gridStage = await gridModule.createMlsMpmGridUpdateWebGpuEncoderStage({
        device,
        commandEncoder: encoder,
        p2gGridProjection: {
          schema: 'peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0',
          projectionSchema: 'peercompute.ulg.mls-mpm-gpu-grid-projection.v0',
          backend: 'webgpu',
          particleCount: 2,
          gridSpacingM: 1,
          gridDims: [1, 1, 1],
          gridNodeCount: 1,
          gridShift: 0,
          dt: 0.01,
          gridNodeStrideFloats: 8,
          gridNodes: new Float32Array(0),
          gridBuffer
        },
        p2gGridBuffer: gridBuffer,
        pressureInterfaceForceRowsBuffer: pressureStage.forceRowsBuffer,
        pressureInterfaceForceSolver: approvedSolver,
        pressureInterfaceGridForceAdmission: gridForceAdmission,
        dt: 0.01,
        gravityMPerS2: [0, 0, 0],
        boxDimsM: [1, 1, 1],
        cflFactor: 1
      });
      const gridLegMode = 'legacy-dense-grid-update-diagnostic-awaiting-sparse-pressure-scatter';

      const timestampResolveEncoded = timestampProfiler.encodeResolve(encoder);
      const submittedAt = performance.now();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const queueFenceMs = performance.now() - submittedAt;
      const gpuTimestampProfile = await timestampProfiler.read();
      const timestampRequirements = [
        { id: 'source-metadata', metadata: { residentNeighborhoodStage: 'source-metadata' } },
        {
          id: 'key-build',
          label: neighborhoodBuilderModule.RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.keyBuild
        },
        { id: 'cell-sort-unique', metadata: { residentNeighborhoodStage: 'cell-sort-unique' } },
        {
          id: 'cell-assemble',
          label: neighborhoodBuilderModule.RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.cellAssemble
        },
        {
          id: 'candidate-count',
          label: neighborhoodBuilderModule.RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateCount
        },
        {
          id: 'candidate-count-scan',
          metadata: { residentNeighborhoodStage: 'candidate-count-scan' }
        },
        {
          id: 'finalize',
          label: neighborhoodBuilderModule.RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.finalize
        },
        {
          id: 'candidate-fill',
          label: neighborhoodBuilderModule.RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateFill
        }
      ];
      const validTimestampSpans = (gpuTimestampProfile.spans || []).filter(
        (span) => span.valid === true
      );
      const timestampCoverage = timestampRequirements.map((requirement) => ({
        ...requirement,
        matched: validTimestampSpans.some((span) => (
          (!requirement.label || span.label === requirement.label)
          && (!requirement.metadata || Object.entries(requirement.metadata).every(
            ([key, value]) => span.metadata?.[key] === value
          ))
        ))
      }));
      const missingTimestampStages = timestampCoverage
        .filter(({ matched }) => !matched)
        .map(({ id }) => id);
      const timestampUnsupported = [
        'unsupported',
        'unsupported-api',
        'allocation-failed'
      ].includes(gpuTimestampProfile.status);
      const timestampComplete = gpuTimestampProfile.status === 'timestamp-profile-complete'
        && gpuTimestampProfile.skippedSpanCount === 0
        && gpuTimestampProfile.invalidSpanCount === 0
        && missingTimestampStages.length === 0;
      const gpuTimestampEvidence = {
        schema: 'peercompute.ulg.native-gpu-timestamp-evidence.v0',
        requested: gpuTimestampProfilingRequested,
        adapterSupported: timestampQuerySupported,
        capability: timestampProfiler.capability,
        status: !gpuTimestampProfilingRequested
          ? 'not-requested'
          : (timestampUnsupported
              ? 'inconclusive-unsupported'
              : (timestampComplete ? 'pass' : 'fail')),
        sameSubmissionResolve: timestampResolveEncoded === timestampProfiler.active,
        requiredStages: timestampCoverage,
        missingStageIds: missingTimestampStages,
        skippedSpanCount: gpuTimestampProfile.skippedSpanCount,
        invalidSpanCount: gpuTimestampProfile.invalidSpanCount,
        stageTotals: gpuTimestampProfile.stageTotals,
        profile: gpuTimestampProfile
      };
      const candidateBufferUploaded = bufferWrites.some(
        ({ label }) => label === 'ulg-sph-interface-compact-candidates'
      );
      const cpuPackedInterfaceElementsUploaded = bufferWrites.some(
        ({ label }) => label === 'ulg-sph-pressure-interface-elements-in'
      );
      const candidateReadbackBufferCreated = bufferCreations.some(({ label }) => (
        label?.includes('compact-candidate-metadata-readback')
        || label?.includes('compact-candidate-readback')
        || label?.includes('source-key-readback')
      ));
      const retainedCandidateEvidence = {
        sourceFieldStatus: materialInterfaceSourceField.status,
        sourceFieldInputSource: materialInterfaceSourceField.sourceRenderField?.renderFieldInputSource ?? null,
        sourceFieldReadbackPerformed: materialInterfaceSourceField.sourceRenderFieldReadback === true,
        sourceFieldRowsBufferRetained: materialInterfaceSourceField.fieldRowsBufferRetained === true,
        sourceSurfaceBufferRetained: materialInterfaceSourceField.surfaceBufferRetained === true,
        materialInterfaceStatus: materialInterfaceField.status,
        materialInterfaceInputElementCount: materialInterfaceField.elements?.length ?? null,
        candidateRowsBufferRetained: materialInterfaceField.candidateRowsBufferRetained === true,
        candidateMetadataBufferRetained: materialInterfaceField.compactMetadataBufferRetained === true,
        candidateReadbackPerformed: materialInterfaceField.readbackPerformed === true,
        candidateMapPerformed: materialInterfaceField.mapPerformed === true,
        candidateQueueSubmitPerformed: materialInterfaceField.queueSubmitPerformed === true,
        candidateCommandEncoderOwnership: materialInterfaceField.commandEncoderOwnership,
        candidateCapacity: materialInterfaceField.candidateCompactCapacity,
        residentAuthorityStatus: materialInterfaceField.residentAuthorityStatus,
        pressureInputMode: pressureStage.materialInterfaceInputMode,
        pressureInputAuthoritative: pressureStage.materialInterfaceInputAuthoritative === true,
        pressureCandidateMetadataBorrowed: pressureStage.candidateMetadataBuffer
          === materialInterfaceField.compactMetadataBuffer,
        pressureForceRowCapacity: pressureStage.forceRowCapacity,
        pressureForceRowStatusGate: pressureStage.forceRowStatusGate
      };
      const cleanupStartedAfterFence = true;
      gridStage.cleanupSubmittedWork?.();
      pressureStage.cleanupSubmittedWork?.();
      materialInterfaceField.cleanupSubmittedWork?.();
      pressureStage.destroyForceRowsBuffer?.();
      const candidateCleanup = materialInterfaceField.destroyMaterialInterfaceFieldBuffers?.({
        reason: 'live-probe-fence-complete'
      }) ?? null;
      const sourceLeaseRelease = materialInterfaceSourceField.releaseMaterialInterfaceSourceFieldLeases?.({
        status: 'live-probe-fence-complete'
      }) ?? null;
      const sourceCleanup = materialInterfaceSourceField.destroyMaterialInterfaceSourceFieldBuffers?.({
        reason: 'live-probe-fence-complete'
      }) ?? null;
      neighborhoodLane.destroy();
      for (const buffer of [stateBuffer, thermoBuffer, renderRowsBuffer, gridBuffer]) {
        buffer.destroy();
      }
      const scopedValidationError = await device.popErrorScope();
      if (scopedValidationError) validationErrors.push(scopedValidationError.message);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const physicsPass = neighborhood.encoded === true
        && neighborhood.productionLane?.status === 'resident-neighborhood-production-generation-encoded'
        && neighborhood.productionLane?.sourceMetadataInitialization === 'uniform-gpu-expanded-same-encoder'
        && neighborhood.descriptor?.lease?.authoritative === true
        && neighborhood.descriptor?.lease?.sourceFamily === 'sph-particle-state'
        && neighborhood.queueSubmitPerformed === false
        && retainedCandidateEvidence.sourceFieldStatus === 'material-interface-source-field-ready'
        && retainedCandidateEvidence.sourceFieldInputSource === 'resident-render-rows-buffer'
        && retainedCandidateEvidence.sourceFieldReadbackPerformed === false
        && retainedCandidateEvidence.sourceFieldRowsBufferRetained === true
        && retainedCandidateEvidence.sourceSurfaceBufferRetained === true
        && retainedCandidateEvidence.materialInterfaceInputElementCount === 0
        && retainedCandidateEvidence.candidateRowsBufferRetained === true
        && retainedCandidateEvidence.candidateMetadataBufferRetained === true
        && retainedCandidateEvidence.candidateReadbackPerformed === false
        && retainedCandidateEvidence.candidateMapPerformed === false
        && retainedCandidateEvidence.candidateQueueSubmitPerformed === false
        && retainedCandidateEvidence.candidateCommandEncoderOwnership === 'caller'
        && retainedCandidateEvidence.residentAuthorityStatus === 'resident-candidate-authority-bound'
        && retainedCandidateEvidence.pressureInputMode === 'gpu-resident-compact-candidate-buffer'
        && retainedCandidateEvidence.pressureInputAuthoritative === true
        && retainedCandidateEvidence.pressureCandidateMetadataBorrowed === true
        && retainedCandidateEvidence.pressureForceRowCapacity
          === retainedCandidateEvidence.candidateCapacity
        && candidateBufferUploaded === false
        && cpuPackedInterfaceElementsUploaded === false
        && candidateReadbackBufferCreated === false
        && pressureStage.queueSubmitPerformed === false
        && pressureStage.readbackPerformed === false
        && pressureStage.residentNeighborhoodAdmission?.admitted === true
        && pressureStage.neighborhoodMode === 'resident-neighborhood-packed-csr'
        && gridStage.queueSubmitPerformed === false
        && gridStage.readbackPerformed === false
        && gridStage.pressureInterfaceGridForceAdmissionApproved === true
        && gridStage.pressureInterfaceForceRowCount === pressureStage.forceRowCapacity
        && queueSubmissions.length === 2
        && cleanupStartedAfterFence
        && candidateCleanup?.status === 'material-interface-candidate-field-buffers-destroyed'
        && sourceLeaseRelease?.activeLeaseCount === 0
        && ['resident-buffer-lease-ledger-ready', 'resident-buffer-lease-ledger-cleaned']
          .includes(sourceLeaseRelease?.status)
        && sourceCleanup?.status === 'resident-buffer-lease-ledger-cleaned'
        && staleGenerationAdmission.admitted === false
        && staleGenerationAdmission.reasonCodes.includes('generation-mismatch')
        && shaderCompilationErrors.length === 0
        && validationErrors.length === 0;
      const status = !physicsPass || gpuTimestampEvidence.status === 'fail'
        ? 'fail'
        : (gpuTimestampEvidence.status === 'inconclusive-unsupported'
            ? 'inconclusive-unsupported'
            : 'pass');

      device.destroy();
      return {
        status,
        queueFenceMs,
        oneCallerOwnedEncoder: true,
        candidatePressureSameCallerEncoder: true,
        sourceFieldPrepassSubmissionCount: 1,
        totalQueueSubmissionCount: queueSubmissions.length,
        neighborhoodStatus: neighborhood.status,
        neighborhoodEncoded: neighborhood.encoded === true,
        neighborhoodQueueSubmitPerformed: neighborhood.queueSubmitPerformed,
        pressureStatus: pressureStage.status,
        pressureNeighborhoodMode: pressureStage.neighborhoodMode,
        productionLane: neighborhood.productionLane,
        pressureQueueSubmitPerformed: pressureStage.queueSubmitPerformed,
        pressureReadbackPerformed: pressureStage.readbackPerformed,
        pressureForceRowCount: pressureStage.forceRowCount,
        pressureForceRowCapacity: pressureStage.forceRowCapacity,
        pressureForceRowStatusGate: pressureStage.forceRowStatusGate,
        retainedCandidateEvidence,
        candidateBufferUploaded,
        cpuPackedInterfaceElementsUploaded,
        candidateReadbackBufferCreated,
        cleanupStartedAfterFence,
        candidateCleanupStatus: candidateCleanup?.status ?? null,
        sourceLeaseReleaseStatus: sourceLeaseRelease?.status ?? null,
        sourceLeaseReleaseActiveCount: sourceLeaseRelease?.activeLeaseCount ?? null,
        sourceCleanupStatus: sourceCleanup?.status ?? null,
        gridQueueSubmitPerformed: gridStage.queueSubmitPerformed,
        gridReadbackPerformed: gridStage.readbackPerformed,
        gridForceAdmissionApproved: gridStage.pressureInterfaceGridForceAdmissionApproved,
        gridForceRowCount: gridStage.pressureInterfaceForceRowCount,
        gridLegMode,
        staleGenerationGuardRejected: staleGenerationAdmission.admitted === false,
        staleGenerationGuardReasons: staleGenerationAdmission.reasonCodes,
        gpuTimestampProfilingRequested,
        gpuTimestampEvidence,
        gpuTimestampStageTotals: gpuTimestampEvidence.stageTotals,
        shaderCompilationErrors,
        validationErrors
      };
    }, { gpuTimestampProfilingRequested });

    const artifact = {
      schema: 'peercompute.ulg.resident-neighborhood-consumer-chain-probe.v0',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      gpuTimestampProfilingRequested,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    if (artifact.status === 'fail') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
