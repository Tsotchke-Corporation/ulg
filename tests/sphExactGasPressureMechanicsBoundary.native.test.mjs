import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_EXACT_GAS_PRESSURE_MECHANICS === '1';
const BASE_URL =
  process.env.ULG_EXACT_GAS_PRESSURE_MECHANICS_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME =
  process.env.ULG_EXACT_GAS_PRESSURE_MECHANICS_CHROME
  || '/usr/bin/google-chrome';

test('native exact-v4 gas pressure executes the readback-free five-stage standalone mechanics route', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_EXACT_GAS_PRESSURE_MECHANICS=1 for native Vulkan WebGPU',
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
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return {
          status: 'unsupported',
          reason: 'WebGPU adapter unavailable'
        };
      }

      const stepModulePath = '/src/runtime/sph/sphMlsMpmGpuStep.js';
      const stepModuleSource = await fetch(stepModulePath).then(
        (response) => response.text()
      );
      const dependencyPath = (source, fileName) => {
        const escaped = fileName.replaceAll('.', '\\.');
        const resolved = source.match(
          new RegExp(`from "([^"]*/${escaped}[^"]*)"`)
        )?.[1];
        if (!resolved) {
          throw new Error(`Unable to resolve ${fileName} from served source`);
        }
        return resolved;
      };
      const transactionModulePath = dependencyPath(
        stepModuleSource,
        'schroederSpatialEpochTransaction.js'
      );
      const productHistoryModulePath = dependencyPath(
        stepModuleSource,
        'sphResidentProductHistoryGpu.js'
      );
      const proposalModulePath = dependencyPath(
        stepModuleSource,
        'schroederSpatialMechanicalProposalsGpu.js'
      );
      const gasModulePath = dependencyPath(
        stepModuleSource,
        'sphSpatialGasLedgerEosGpu.js'
      );
      const gasModuleSource = await fetch(gasModulePath).then(
        (response) => response.text()
      );
      const spatialModulePath = dependencyPath(
        gasModuleSource,
        'schroederSpatialEpochGpu.js'
      );

      const limitsModule = await import('/src/runtime/webgpuDeviceLimits.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const buffersModule = await import('/src/runtime/sph/sphGpuBuffers.js');
      const hierarchyModule = await import(
        '/src/runtime/sph/schroederHierarchyGpu.js'
      );
      const spatialModule = await import(spatialModulePath);
      const transactionModule = await import(transactionModulePath);
      const gridModule = await import('/src/runtime/sph/sphGridGpuKernel.js');
      const identityModule = await import(
        '/src/runtime/sph/sphGpuDeviceIdentity.js'
      );
      const productHistoryModule = await import(productHistoryModulePath);
      const proposalModule = await import(proposalModulePath);
      const gasModule = await import(gasModulePath);
      const stepModule = await import(stepModulePath);
      const boundaryWgslModule = await import(
        '/ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js'
      );

      const device = await adapter.requestDevice(
        limitsModule.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      let deviceLostInfo = null;
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.lost.then((info) => {
        deviceLostInfo = {
          reason: info?.reason || null,
          message: info?.message || null
        };
      }).catch((error) => {
        deviceLostInfo = {
          reason: 'device-lost-promise-rejected',
          message: error instanceof Error ? error.message : String(error)
        };
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      let levelAssignment = null;
      let generation = null;
      let sphParticleUpload = null;
      let mlsMpmParticleUpload = null;
      let residentProductMass = null;
      let productCountControlBuffer = null;
      let mechanicalProposal = null;
      let step = null;
      let routeError = null;
      const cleanupErrors = [];
      const submittedTaskExports = [];
      const taskEvidence = [];
      let laneContract = null;
      let exactSourceBeforeGrid = false;
      let boundaryCompilationMessages = [];

      try {
        const boundaryShaderModule = device.createShaderModule({
          label: 'ulg-native-exact-pressure-boundary-preflight',
          code: boundaryWgslModule
            .schroederSpatialGasPressureBoundaryTransportWgsl
        });
        const compilationInfo = await boundaryShaderModule
          .getCompilationInfo();
        boundaryCompilationMessages = compilationInfo.messages.map(
          (message) => ({
            type: message.type,
            message: message.message,
            lineNum: message.lineNum,
            linePos: message.linePos
          })
        );
        const compilationErrors = boundaryCompilationMessages.filter(
          (message) => message.type === 'error'
        );
        if (compilationErrors.length > 0) {
          throw new Error(
            `boundary WGSL compilation failed: ${
              JSON.stringify(compilationErrors)
            }`
          );
        }
        for (const entryPoint of [
          'initialize_boundary_transport',
          'stage_boundary_transport',
          'validate_boundary_transport',
          'commit_boundary_transport'
        ]) {
          try {
            await device.createComputePipelineAsync({
              label: `ulg-native-exact-pressure-${entryPoint}-preflight`,
              layout: 'auto',
              compute: { module: boundaryShaderModule, entryPoint }
            });
          } catch (error) {
            throw new Error(
              `boundary pipeline ${entryPoint} failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }

        const particleCount = 4;
        const state = new Float32Array(particleCount * 8);
        const thermo = new Float32Array(particleCount * 12);
        const identity = new Uint32Array(particleCount);
        const mechanics = new Float32Array(particleCount * 32);
        const positions = [
          [0.75, 0.75, 0.75],
          [1.00, 0.75, 0.75],
          [0.75, 1.00, 0.75],
          [1.00, 1.00, 0.75]
        ];
        for (let index = 0; index < particleCount; index += 1) {
          state.set([...positions[index], 1, 0, 0, 0, 0], index * 8);
          thermo.set([
            7, 1, 300, 1000,
            1, 0, 0, 0,
            0.25, 1, 1, 0.1
          ], index * 12);
          identity[index] = 1;
          const offset = index * 32;
          mechanics[offset] = 1;
          mechanics[offset + 4] = 1;
          mechanics[offset + 8] = 1;
          mechanics[offset + 18] = 1;
          mechanics[offset + 19] = 0.001;
          mechanics[offset + 20] = 1;
          mechanics[offset + 21] = 1;
          mechanics[offset + 27] = 1;
          mechanics[offset + 31] = 1;
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
          smoothingLengthM: 0.25,
          storageGeneration: 1,
          stateStrideFloats: 8,
          thermoStrideFloats: 12,
          identityStrideUints: 1,
          stateStrideBytes: 32,
          thermoStrideBytes: 48,
          identityStrideBytes: 4,
          identityRequired: true,
          identityRevision: 'native-exact-pressure-mechanics',
          renderDomainKeys: { 1: 'native-exact-pressure-body' },
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
          gravityMPerS2: [0, -9.80665, 0],
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          mechanics,
          metadata: [],
          algorithmMaterialContactRows: null
        };

        sphParticleUpload = buffersModule.uploadSphGpuParticleBuffers(
          device,
          sphParticleState
        );
        mlsMpmParticleUpload =
          buffersModule.uploadMlsMpmGpuParticleBuffers(
            device,
            mlsMpmParticleState
          );
        sphParticleUpload.slot = 0;
        mlsMpmParticleUpload.slot = 0;

        levelAssignment =
          await hierarchyModule.runSchroederLevelAssignmentWebGpu({
            device,
            sphParticleState,
            mlsMpmParticleState,
            sphParticleUpload,
            mlsMpmParticleUpload,
            baseGridSpacingM: 0.25,
            minLevel: 0,
            maxLevel: 0,
            targetSupportCells: 1,
            supportRadiusScale: 1,
            chartId: 0,
            retainAssignmentBuffer: true
          });
        const gridSpec = gridModule.createMlsMpmGridSpec({
          boxDimsM: [2, 2, 2],
          gridSpacingM: 0.25
        });
        generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment,
          particleCount,
          particleIdentityBuffer: sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          mechanicsGrid: {
            gridNodeCount: gridSpec.gridNodeCount,
            gridDims: gridSpec.gridDims,
            gridShift: gridSpec.shift,
            gridSpacingM: gridSpec.gridSpacingM
          },
          exactNearCellTreeEnabled: false
        });
        if (
          generation?.ready !== true
          || !generation.mechanicsFieldView
          || !generation.mechanicsLevelViews?.[0]?.phaseVolumeMoment
        ) {
          throw new Error(
            `single-level generation rejected: ${
              generation?.reason || generation?.status || 'unknown'
            }`
          );
        }

        mechanicalProposal =
          proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
            device,
            generation,
            sphParticleState,
            mlsMpmParticleState,
            sphParticleUpload,
            mlsMpmParticleUpload,
            boxDimsM: [2, 2, 2],
            gridSpacingM: 0.25,
            relaxation: 0,
            normalVelocityDamping: 0,
            selectedLevel: 0
          });
        if (mechanicalProposal?.ready !== true) {
          throw new Error(
            `mechanical proposal rejected: ${
              mechanicalProposal?.reason
              || mechanicalProposal?.status
              || 'unknown'
            }`
          );
        }

        const transaction =
          transactionModule.createSchroederSpatialEpochTransaction({
            device,
            generation,
            sphParticleUpload,
            mlsMpmParticleUpload
          });
        const cleanupCapability =
          transactionModule
            .createSchroederSingleLevelQueueOrderedCleanupCapability(
              transaction,
              {
                device,
                generation,
                sphParticleUpload,
                mlsMpmParticleUpload,
                readbackMode: 'no-full-readback'
              }
            );

        const productRows = new Float32Array(4 * 32);
        const setProduct = (row, {
          position,
          massKg,
          materialId,
          productTermIndex,
          moles,
          temperatureK,
          supportVolumeM3
        }) => {
          const offset = row * 32;
          productRows.set(position, offset);
          productRows[offset + 3] = massKg;
          productRows[offset + 4] = materialId;
          productRows[offset + 5] = productTermIndex;
          productRows[offset + 9] = moles;
          productRows[offset + 10] = 1;
          productRows[offset + 12] = 0;
          productRows[offset + 13] = massKg;
          productRows[offset + 16] = temperatureK;
          productRows[offset + 17] = massKg / supportVolumeM3;
          productRows[offset + 18] = 1;
          productRows[offset + 23] = supportVolumeM3;
        };
        setProduct(0, {
          position: [0.80, 0.80, 0.80],
          massKg: 0.1,
          materialId: 9,
          productTermIndex: 0,
          moles: 1,
          temperatureK: 350,
          supportVolumeM3: 0.02
        });
        setProduct(1, {
          position: [0.90, 0.80, 0.80],
          massKg: 0.1,
          materialId: 17,
          productTermIndex: 1,
          moles: 1.5,
          temperatureK: 450,
          supportVolumeM3: 0.02
        });
        setProduct(2, {
          position: [1.05, 0.90, 0.80],
          massKg: 0.1,
          materialId: 9,
          productTermIndex: 0,
          moles: 1,
          temperatureK: 550,
          supportVolumeM3: 0.02
        });
        const productEventBuffer = identityModule.tagWebGpuBufferDevice(
          device.createBuffer({
            label: 'native-exact-pressure-products',
            size: productRows.byteLength,
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          }),
          device
        );
        device.queue.writeBuffer(productEventBuffer, 0, productRows);
        let activeBorrowCount = 0;
        residentProductMass = {
          schema: 'peercompute.ulg.sph-resident-product-mass.v0',
          status: 'resident-product-mass-buffer-retained',
          productEventBuffer,
          productEventBufferRetained: true,
          productEventBufferByteLength: productRows.byteLength,
          productEventRowCount: 4,
          productEventStrideFloats: 32,
          productEventDevice: device
        };
        Object.defineProperty(residentProductMass, '__ulgActiveBorrowCount', {
          get() { return activeBorrowCount; },
          set(value) {
            activeBorrowCount = Math.max(0, Number(value) | 0);
          }
        });
        identityModule.tagResidentProductMassDevice(
          residentProductMass,
          device
        );
        productCountControlBuffer = identityModule.tagWebGpuBufferDevice(
          device.createBuffer({
            label: 'native-exact-pressure-product-count-authority',
            size: productHistoryModule
              .SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES,
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          }),
          device
        );
        device.queue.writeBuffer(
          productCountControlBuffer,
          0,
          productHistoryModule.createResidentProductEventCountControlWords({
            liveRowCount: 3,
            rowCapacity: 4,
            rowStrideVec4: 8,
            generation: 37,
            seal: 0x5a17c0de
          })
        );
        productHistoryModule.registerResidentProductEventCountAuthority(
          residentProductMass,
          {
            device,
            controlBuffer: productCountControlBuffer,
            controlOffsetBytes: 0,
            rowCapacity: 4,
            rowStrideFloats: 32,
            generation: 37,
            seal: 0x5a17c0de
          }
        );

        const computeManager = {
          async submitTask(task) {
            submittedTaskExports.push(task.exportName);
            const result = await stepModule[task.exportName]({
              ...task.data,
              device
            });
            const stageTaskEvidence =
              result?.mechanicsP2gStageTaskEvidence
              || result?.spatialGasLedgerProducerStageTaskEvidence
              || result?.gasCellEosProducerStageTaskEvidence
              || result?.mechanicsGridUpdateStageTaskEvidence
              || result?.mechanicsG2pStageTaskEvidence
              || null;
            taskEvidence.push({
              exportName: task.exportName,
              backend: result?.backend || null,
              normalHotLoopReadbackFree:
                result?.normalHotLoopReadbackFree === true,
              observedMapAsyncCount: result?.observedMapAsyncCount ?? null,
              observedHostQueueFenceCount:
                result?.observedHostQueueFenceCount ?? null,
              readbackSources: (
                result?.readbackTelemetrySourceBreakdown || []
              ).map((entry) => ({
                source: entry.source,
                mapAsyncCount: entry.mapAsyncCount,
                hostQueueFenceCount: entry.hostQueueFenceCount,
                readbackBytes: entry.readbackBytes
              })),
              evidencePassed: stageTaskEvidence?.passed === true,
              evidenceReason: stageTaskEvidence?.reason || null,
              resultStatus: result?.status || null,
              particleCount: result?.particleCount ?? null,
              stateBufferPresent: Boolean(result?.stateBuffer),
              mechanicsBufferPresent: Boolean(result?.mechanicsBuffer),
              stateBufferByteLength: result?.stateBufferByteLength ?? null,
              mechanicsBufferByteLength:
                result?.mechanicsBufferByteLength ?? null,
              retainedOutputParticleBuffers:
                result?.retainedOutputParticleBuffers === true,
              gridNodeCount: result?.gridNodeCount ?? null,
              gridNodeStrideBytes: result?.gridNodeStrideBytes ?? null,
              boundaryRequired:
                result?.gasPressureMechanicsBoundaryRequired === true,
              boundarySubmitted:
                result?.gasPressureBoundarySubmitted === true,
              boundarySubmission: result?.gasPressureBoundarySubmission
                ? {
                    submitted:
                      result.gasPressureBoundarySubmission.submitted === true,
                    authorityRetiredQueueOrdered:
                      result.gasPressureBoundarySubmission
                        .authorityRetiredQueueOrdered === true,
                    temporaryBuffersRetiredQueueOrdered:
                      result.gasPressureBoundarySubmission
                        .temporaryBuffersRetiredQueueOrdered === true,
                    hostQueueFenceCount:
                      result.gasPressureBoundarySubmission.hostQueueFenceCount,
                    mapAsyncCount:
                      result.gasPressureBoundarySubmission.mapAsyncCount,
                    hostLogicalCountReadCount:
                      result.gasPressureBoundarySubmission
                        .hostLogicalCountReadCount
                  }
                : null
            });
            if (
              task.exportName
              === 'runSphGasCellEosProducerStageComputeTask'
            ) {
              exactSourceBeforeGrid =
                gasModule.isExactSphSpatialGasPressureAuthoritySource(
                  result?.retainedGasCellFieldSource
                );
            }
            return result;
          },
          acquireGpuResidentLaneLease(spec) {
            laneContract = spec.residentSequenceLaneContract;
            return {
              leaseId: `${spec.laneId}:native-exact-pressure-lease`,
              laneId: spec.laneId,
              stateKey: spec.stateKey,
              residentSequenceLaneContract: laneContract
            };
          },
          async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
            const stageResults = [];
            let input = options.input || null;
            for (const stage of laneContract.passDagStages) {
              const stageResult = await options.stageExecutors[stage.id]({
                stage,
                input,
                leaseId,
                context: options.context || {}
              });
              stageResults.push({
                stageId: stage.id,
                status: 'completed',
                summary: stageResult.summary || null,
                retainedBufferRefs: stageResult.retainedBufferRefs || []
              });
              input = stageResult.value;
            }
            return {
              schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
              status: 'completed',
              completedStageCount: stageResults.length,
              dependencyMode: 'declared-dag-sequential-execution',
              parallelStageExecution: false,
              executionBatches: stageResults.map(({ stageId }) => [stageId]),
              stageResults,
              retainedBufferRefs: []
            };
          },
          completeGpuResidentLaneLease(leaseId, options = {}) {
            return {
              status: options.status || 'same-device-queue-ordering-established',
              lease: { leaseId, status: 'completed' },
              gpuFence: {
                schema: 'peercompute.compute.gpu-fence-report.v0',
                status: options.status
                  || 'same-device-queue-ordering-established',
                required: true,
                fenceSatisfied: true,
                structuralQueueOrdering: true
              }
            };
          },
          rejectGpuResidentLaneLease(leaseId, reason) {
            return { leaseId, reason, status: 'rejected' };
          }
        };

        step = await stepModule
          .runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
            sphParticleState,
            mlsMpmParticleState,
            computeManager,
            modulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
            stageTaskIdPrefix: 'ulg:native:exact-v4-pressure-mechanics',
            useNativeTaskGraph: false,
            useGpuHubResidentStageExecutors: false,
            gasPressureMechanicsBoundaryEnabled: true,
            canonicalSpatialRequired: true,
            preferWebGpu: true,
            readbackMode: 'no-full-readback',
            residentProductMass,
            schroederLevelAssignment: levelAssignment,
            schroederSelectedLevel: 0,
            schroederSpatialEpochGeneration: generation,
            schroederSpatialEpochTransaction: transaction,
            schroederSingleLevelQueueOrderedCleanupCapability:
              cleanupCapability,
            schroederSpatialMechanicalProposal: mechanicalProposal,
            sphParticleUpload,
            mlsMpmParticleUpload,
            gridSpacingM: 0.25,
            boxDimsM: [2, 2, 2],
            dt: 0.001,
            gravityMPerS2: [0, -9.80665, 0],
            cflFactor: 0.4,
            internalPressureScale: 0.75,
            ambientPressurePa: 101325,
            includePressureInterfaceStage: false,
            device
          });
      } catch (error) {
        routeError = {
          message: error instanceof Error ? error.message : String(error),
          code: error?.code || null,
          stack: error?.stack || null
        };
      }

      try {
        await device.queue.onSubmittedWorkDone();
      } catch (error) {
        cleanupErrors.push(
          `queue completion: ${error instanceof Error ? error.message : error}`
        );
      }
      const popErrorScope = async (scope) => {
        try {
          return await device.popErrorScope();
        } catch (error) {
          return {
            message: `${scope} popErrorScope failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          };
        }
      };
      const outOfMemoryError = await popErrorScope('out-of-memory');
      const internalError = await popErrorScope('internal');
      const validationError = await popErrorScope('validation');

      const chain = step?.mechanicsStageTaskChain || null;
      const result = {
        status: routeError ? 'error' : 'complete',
        reason: routeError?.message || null,
        errorCode: routeError?.code || null,
        errorStack: routeError?.stack || null,
        laneStageOrder:
          laneContract?.passDagStages?.map((stage) => stage.id) || [],
        laneSequenceMode: laneContract?.sequenceMode || null,
        laneQueueFencePolicy: laneContract?.queueFencePolicy || null,
        laneReadFamilies: [...(laneContract?.readFamilies || [])],
        submittedTaskExports,
        taskEvidence,
        exactSourceBeforeGrid,
        boundaryCompilationMessages,
        chain: chain ? {
          boundaryRequired: chain.gasPressureMechanicsBoundaryRequiredThisStep,
          boundaryStatus: chain.gasPressureMechanicsBoundaryStatus,
          legacyPressureInterfaceSuppressed:
            chain.gasPressureMechanicsLegacyPressureInterfaceSuppressed,
          uniformGaugeSuppressed:
            chain.gasPressureMechanicsUniformGaugeSuppressed,
          fusedMechanicsSuppressed:
            chain.gasPressureMechanicsFusedMechanicsSuppressed,
          gridBoundarySubmitted:
            chain.gasPressureMechanicsGridBoundarySubmitted,
          finalConsumerKind: chain.gasPressureMechanicsFinalConsumerKind,
          sourceRetirementScope:
            chain.gasPressureMechanicsSourceRetirementScope,
          queueFencePolicy: chain.gasPressureMechanicsStageQueueFencePolicy,
          hostQueueFenceCount: chain.gasPressureMechanicsHostQueueFenceCount,
          mapAsyncCount: chain.gasPressureMechanicsMapAsyncCount,
          hostLogicalCountReadCount:
            chain.gasPressureMechanicsHostLogicalCountReadCount,
          stageExecutionStatus: chain.gpuResidentLaneStageExecutionStatus,
          stageExecutionCompletedStageCount:
            chain.gpuResidentLaneStageExecutionCompletedStageCount,
          stageExecutionStageOrder:
            chain.gpuResidentLaneStageExecutionStageOrder,
          observedHostQueueFenceCount: step.observedHostQueueFenceCount,
          observedMapAsyncCount: step.observedMapAsyncCount,
          normalHotLoopReadbackFree: step.normalHotLoopReadbackFree,
          productionHotLoopHostDependencyFree:
            step.productionHotLoopHostDependencyFree,
          readbackSources: (
            step.readbackTelemetrySourceBreakdown || []
          ).map((entry) => ({
            source: entry.source,
            mapAsyncCount: entry.mapAsyncCount,
            hostQueueFenceCount: entry.hostQueueFenceCount,
            readbackBytes: entry.readbackBytes
          })),
          submission: chain.gasPressureMechanicsBoundarySubmission
            ? {
                submitted:
                  chain.gasPressureMechanicsBoundarySubmission.submitted,
                authorityRetiredQueueOrdered:
                  chain.gasPressureMechanicsBoundarySubmission
                    .authorityRetiredQueueOrdered,
                temporaryBuffersRetiredQueueOrdered:
                  chain.gasPressureMechanicsBoundarySubmission
                    .temporaryBuffersRetiredQueueOrdered,
                hostQueueFenceCount:
                  chain.gasPressureMechanicsBoundarySubmission
                    .hostQueueFenceCount,
                mapAsyncCount:
                  chain.gasPressureMechanicsBoundarySubmission.mapAsyncCount,
                hostLogicalCountReadCount:
                  chain.gasPressureMechanicsBoundarySubmission
                    .hostLogicalCountReadCount
              }
            : null
        } : null,
        validationError: validationError?.message || null,
        internalError: internalError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        uncapturedErrors,
        deviceLostInfo,
        cleanupErrors
      };

      try {
        if (step) stepModule.destroyMlsMpmResidentStepBuffers(step);
        mechanicalProposal?.releaseAfterSubmittedWork?.();
        if (generation) {
          const scheduled =
            spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
              generation,
              device
            );
          if (scheduled && generation.releasePromise) {
            await generation.releasePromise;
          }
        }
        if (mechanicalProposal?.releasePromise) {
          await mechanicalProposal.releasePromise;
        }
        levelAssignment?.destroyAssignmentBuffer?.();
        if (sphParticleUpload) {
          buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
        }
        if (mlsMpmParticleUpload) {
          buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
        }
        residentProductMass?.productEventBuffer?.destroy?.();
        productCountControlBuffer?.destroy?.();
      } catch (error) {
        result.cleanupErrors.push(
          error instanceof Error ? error.message : String(error)
        );
      }
      return result;
    });
  } finally {
    await browser.close();
  }

  assert.equal(
    native.status,
    'complete',
    `${native.reason || 'native exact-pressure route did not run'}\n${
      native.errorStack || ''
    }\n${JSON.stringify({
      validationError: native.validationError,
      internalError: native.internalError,
      outOfMemoryError: native.outOfMemoryError,
      uncapturedErrors: native.uncapturedErrors,
      deviceLostInfo: native.deviceLostInfo,
      cleanupErrors: native.cleanupErrors
    })}`
  );
  assert.deepEqual(native.laneStageOrder, [
    'p2g',
    'spatialGasLedgerProducer',
    'gasCellEosProducer',
    'gridUpdate',
    'g2p'
  ]);
  assert.equal(
    native.laneSequenceMode,
    'mechanics-plus-exact-v4-gas-pressure-boundary-stage-task-chain'
  );
  assert.equal(
    native.laneQueueFencePolicy,
    'same-device-queue-ordering-before-admission'
  );
  assert.equal(
    native.laneReadFamilies.includes('sph-material-interface-field'),
    false
  );
  assert.deepEqual(native.submittedTaskExports, [
    'runMlsMpmMechanicsP2gStageComputeTask',
    'runSphSpatialGasLedgerProducerStageComputeTask',
    'runSphGasCellEosProducerStageComputeTask',
    'runMlsMpmMechanicsGridUpdateStageComputeTask',
    'runMlsMpmMechanicsG2pStageComputeTask'
  ]);
  assert.equal(native.exactSourceBeforeGrid, true);
  assert.deepEqual(
    native.boundaryCompilationMessages.filter(
      (message) => message.type === 'error'
    ),
    []
  );
  assert.equal(native.taskEvidence.length, 5);
  for (const evidence of native.taskEvidence) {
    assert.equal(evidence.backend, 'webgpu', evidence.exportName);
    assert.equal(
      evidence.normalHotLoopReadbackFree,
      true,
      evidence.exportName
    );
    assert.equal(
      evidence.evidencePassed,
      true,
      JSON.stringify(evidence)
    );
  }
  assert.deepEqual(native.chain, {
    boundaryRequired: true,
    boundaryStatus: 'exact-v4-gas-pressure-mechanics-boundary-submitted',
    legacyPressureInterfaceSuppressed: true,
    uniformGaugeSuppressed: true,
    fusedMechanicsSuppressed: true,
    gridBoundarySubmitted: true,
    finalConsumerKind: 'mechanics-grid-v4',
    sourceRetirementScope: 'source-consumer-lease-only',
    queueFencePolicy: 'same-device-queue-ordering-before-admission',
    hostQueueFenceCount: 0,
    mapAsyncCount: 0,
    hostLogicalCountReadCount: 0,
    stageExecutionStatus: 'completed',
    stageExecutionCompletedStageCount: 5,
    stageExecutionStageOrder: [
      'p2g',
      'spatialGasLedgerProducer',
      'gasCellEosProducer',
      'gridUpdate',
      'g2p'
    ],
    observedHostQueueFenceCount: 0,
    observedMapAsyncCount: 0,
    normalHotLoopReadbackFree: true,
    productionHotLoopHostDependencyFree: true,
    readbackSources: [],
    submission: {
      submitted: true,
      authorityRetiredQueueOrdered: true,
      temporaryBuffersRetiredQueueOrdered: true,
      hostQueueFenceCount: 0,
      mapAsyncCount: 0,
      hostLogicalCountReadCount: 0
    }
  });
  assert.equal(native.validationError, null);
  assert.equal(native.internalError, null);
  assert.equal(native.outOfMemoryError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.deviceLostInfo, null);
  assert.deepEqual(native.cleanupErrors, []);
});
