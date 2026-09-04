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
      const buffersModulePath = dependencyPath(
        stepModuleSource,
        'sphGpuBuffers.js'
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
      // Import through the exact Vite dependency URL used by the mechanics
      // module. A second timestamp-distinct module instance would own a
      // different private particle-borrow WeakMap and make a valid upload
      // appear lifecycle-less to the retained gas producer.
      const buffersModule = await import(buffersModulePath);
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
            cleanupPassBudget: 1024,
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
      cleanupErrors: native.cleanupErrors,
      taskEvidence: native.taskEvidence
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

test('native exact gas boundary matches the CPU oracle for asymmetric fine-to-coarse parent-adjoint weights', {
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
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const [abi, gasRuntime] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import('/src/runtime/sph/sphSpatialGasLedgerEosGpu.js')
      ]);
      const f32Bits = (value) => {
        const data = new DataView(new ArrayBuffer(4));
        data.setFloat32(0, value, true);
        return data.getUint32(0, true);
      };
      const bitsF32 = (value) => {
        const data = new DataView(new ArrayBuffer(4));
        data.setUint32(0, value, true);
        return data.getFloat32(0, true);
      };
      const setHeader = (words, layout, values) => {
        for (const [name, value] of Object.entries(values)) {
          const index = layout.findIndex((entry) => (
            entry.startsWith(`${name}:`)
          ));
          if (index < 0) {
            throw new Error(`missing ABI header field ${name}`);
          }
          words[index] = value >>> 0;
        }
      };

      const identity = {
        generationId: 17,
        storageGeneration: 11,
        physicsTick: 13,
        physicsSubstep: 1,
        positionEpoch: 19,
        topologyEpoch: 23,
        chartEpoch: 29,
        levelEpoch: 31,
        supportEpoch: 37
      };
      const fieldCapacity = 2;
      const fieldCount = 2;
      const fieldCompletionOrdinal = 41;
      const fieldMutationOrdinal = 2;
      const parentCompletionOrdinal = 47;
      const gasExecutionGeneration = 73;
      const gasStorageGeneration = 79;
      const gasDirectoryGeneration = 43;
      const chartId = 5;
      const dt = 0.125;
      const ambientPressurePa = 100;
      const pressureScale = 0.5;
      const fineGridSpacingM = 0.5;
      const gasGridSpacingM = 1;
      const fields = [
        {
          denseGridNodeId: 0,
          mechanicalFamilyId: 1,
          materialId: 7,
          continuityDomainId: 11,
          currentVolumeM3: 1,
          volumeGradientM2: [2, -1, 0.5],
          massKg: 2,
          velocityMPerS: [0.5, -0.25, 1]
        },
        {
          denseGridNodeId: 0,
          mechanicalFamilyId: 2,
          materialId: 9,
          continuityDomainId: 0,
          currentVolumeM3: 2,
          volumeGradientM2: [-1, 0.5, 3],
          massKg: 4,
          velocityMPerS: [-1, 0.75, 0.25]
        }
      ];
      const parentFieldKeys = [
        [0, 1, 7, 11],
        [0, 2, 9, 0],
        [1, 1, 7, 11],
        [1, 2, 9, 0]
      ];
      const fineEdgeOffsets = [0, 2, 4];
      const fineEdgeParentIndices = [0, 2, 1, 3];
      const fineEdgeWeights = [0.125, 0.875, 0.625, 0.375];
      const gasCells = [
        { cell: [0, 0, 0], absolutePressurePa: 140 },
        { cell: [1, 0, 0], absolutePressurePa: 340 }
      ];
      const oracle = abi
        .computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle({
          fields,
          parentFieldKeys,
          fineEdgeOffsets,
          fineEdgeParentIndices,
          fineEdgeWeights,
          gasCells,
          gasGridDimensions: [2, 1, 1],
          gasGridCellOrigin: [0, 0, 0],
          dt,
          ambientPressurePa,
          pressureScale
        });

      const fieldLayout =
        abi.createSchroederSpatialMechanicsFieldViewLayout({
          sourceCapacity: 1,
          fieldCapacity
        });
      const fieldWords = new Uint32Array(fieldLayout.wordLength);
      setHeader(
        fieldWords,
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
        {
          magic: abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
          abiVersion: abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
          statusFlags:
            abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
            | abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
          generationId: identity.generationId,
          storageGeneration: identity.storageGeneration,
          physicsTick: identity.physicsTick,
          physicsSubstep: identity.physicsSubstep,
          positionEpoch: identity.positionEpoch,
          topologyEpoch: identity.topologyEpoch,
          chartEpoch: identity.chartEpoch,
          levelEpoch: identity.levelEpoch,
          supportEpoch: identity.supportEpoch,
          sourceCount: 1,
          selectedLevel: 0,
          gridNodeCount: 1,
          gridDimX: 1,
          gridDimY: 1,
          gridDimZ: 1,
          gridShift: 0,
          gridSpacingM: f32Bits(fineGridSpacingM),
          descriptorOffsetWords: fieldLayout.descriptorOffsetWords,
          descriptorWords: fieldLayout.descriptorWords,
          keyOffsetWords: fieldLayout.keyOffsetWords,
          keyWords: fieldLayout.keyWords,
          accumulatorOffsetWords: fieldLayout.accumulatorOffsetWords,
          accumulatorWords: fieldLayout.accumulatorWords,
          stateOffsetWords: fieldLayout.stateOffsetWords,
          stateWords: fieldLayout.stateWords,
          fieldCapacity,
          candidateCount: fieldCount,
          fieldCount,
          completionOrdinal: fieldCompletionOrdinal,
          requiredWords: fieldLayout.wordLength,
          capacityWords: fieldLayout.wordLength,
          dispatchX: 1,
          dispatchY: 1,
          dispatchZ: 1,
          stateEncoding:
            abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
          dispatchIndirectX: 1,
          dispatchIndirectY: 1,
          dispatchIndirectZ: 1,
          stateMutationOrdinal: fieldMutationOrdinal
        }
      );
      const fieldReceipt = fieldLayout.receiptControlOffsetWords;
      fieldWords[fieldReceipt] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC;
      fieldWords[fieldReceipt + 1] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION;
      fieldWords[fieldReceipt + 2] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
        | abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED;
      fieldWords[fieldReceipt + 3] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING;
      fieldWords[fieldReceipt + 5] = fieldMutationOrdinal;
      fieldWords[fieldReceipt + 6] = fieldCount;
      fieldWords[fieldReceipt + 32] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL;
      fieldWords[fieldReceipt + 33] =
        abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL;
      for (const [fieldIndex, field] of fields.entries()) {
        const key = [
          field.denseGridNodeId,
          field.mechanicalFamilyId,
          field.materialId,
          field.continuityDomainId
        ];
        fieldWords.set(
          key,
          fieldLayout.keyOffsetWords + fieldIndex * fieldLayout.keyWords
        );
        fieldWords.set([
          f32Bits(field.massKg),
          ...field.velocityMPerS.map(f32Bits),
          0,
          0,
          0,
          1
        ], fieldLayout.stateOffsetWords + fieldIndex * fieldLayout.stateWords);
      }

      const momentWords = new Uint32Array(
        fieldCapacity
          * abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
      );
      const momentStatus =
        abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
        | abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED;
      for (const [fieldIndex, field] of fields.entries()) {
        momentWords.set([
          field.denseGridNodeId,
          field.mechanicalFamilyId,
          field.materialId,
          field.continuityDomainId,
          f32Bits(field.currentVolumeM3),
          ...field.volumeGradientM2.map(f32Bits),
          1,
          momentStatus,
          0,
          0
        ], fieldIndex
          * abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS);
      }

      const receiptWords = new Uint32Array(
        abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS
      );
      const receiptStatus =
        abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY
        | abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED;
      setHeader(
        receiptWords,
        abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_LAYOUT,
        {
          magic: abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC,
          abiVersion: abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION,
          statusFlags: receiptStatus,
          generationId: identity.generationId,
          storageGeneration: identity.storageGeneration,
          physicsTick: identity.physicsTick,
          physicsSubstep: identity.physicsSubstep,
          positionEpoch: identity.positionEpoch,
          topologyEpoch: identity.topologyEpoch,
          chartEpoch: identity.chartEpoch,
          levelEpoch: identity.levelEpoch,
          supportEpoch: identity.supportEpoch,
          fieldCount,
          fieldCapacity,
          selectedLevel: 0,
          gridNodeCount: 1,
          gridSpacingM: f32Bits(fineGridSpacingM),
          momentHeaderWords:
            abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
          momentRowWords:
            abi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
          momentCompletionOrdinal: fieldCompletionOrdinal,
          controlWords:
            abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
          terminalSeal:
            abi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC
            ^ identity.generationId
            ^ fieldCompletionOrdinal
            ^ receiptStatus
        }
      );

      const parentLayout = abi.createSchroederSpatialParentFieldViewLayout({
        fineFieldCapacity: fieldCapacity,
        coarseFieldCapacity: 4
      });
      const parentWords = new Uint32Array(parentLayout.wordLength);
      setHeader(
        parentWords,
        abi.SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_LAYOUT,
        {
          magic: abi.SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC,
          abiVersion: abi.SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION,
          statusFlags:
            abi.SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY
            | abi.SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED,
          generationId: identity.generationId,
          storageGeneration: identity.storageGeneration,
          physicsTick: identity.physicsTick,
          physicsSubstep: identity.physicsSubstep,
          positionEpoch: identity.positionEpoch,
          topologyEpoch: identity.topologyEpoch,
          chartEpoch: identity.chartEpoch,
          levelEpoch: identity.levelEpoch,
          supportEpoch: identity.supportEpoch,
          fineLevel: 0,
          coarseLevel: 1,
          fineGridNodeCount: 1,
          coarseGridNodeCount: 2,
          fineGridDimX: 1,
          fineGridDimY: 1,
          fineGridDimZ: 1,
          coarseGridDimX: 2,
          coarseGridDimY: 1,
          coarseGridDimZ: 1,
          fineGridShift: 0,
          coarseGridShift: 0,
          fineGridSpacingM: f32Bits(fineGridSpacingM),
          coarseGridSpacingM: f32Bits(gasGridSpacingM),
          fineFieldCapacity: fieldCapacity,
          coarseFieldCapacity: 4,
          candidateCapacity: parentLayout.candidateCapacity,
          parentFieldCapacity: parentLayout.parentFieldCapacity,
          edgeCapacity: parentLayout.edgeCapacity,
          fineFieldCount: fieldCount,
          coarseNativeFieldCount: 4,
          parentFieldCount: parentFieldKeys.length,
          edgeCount: fineEdgeParentIndices.length,
          completionOrdinal: parentCompletionOrdinal,
          hierarchyCompletionOrdinal: parentCompletionOrdinal,
          fineFieldCompletionOrdinal: fieldCompletionOrdinal,
          coarseFieldCompletionOrdinal: 43,
          parentKeyOffsetWords: parentLayout.parentKeyOffsetWords,
          parentKeyWords: parentLayout.keyWords,
          fineEdgeCountOffsetWords: parentLayout.fineEdgeCountOffsetWords,
          fineEdgeOffsetOffsetWords: parentLayout.fineEdgeOffsetOffsetWords,
          fineEdgeParentOffsetWords: parentLayout.fineEdgeParentOffsetWords,
          fineEdgeWeightOffsetWords: parentLayout.fineEdgeWeightOffsetWords,
          coarseNativeMapOffsetWords:
            parentLayout.coarseNativeMapOffsetWords,
          requiredWords: parentLayout.wordLength,
          capacityWords: parentLayout.wordLength,
          uniqueEvidenceGeneration: identity.generationId,
          uniqueEvidenceElementCount:
            fieldCount
              * abi.SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD
              + 4,
          uniqueEvidenceCount: parentFieldKeys.length + 1,
          dispatchX: 1,
          dispatchY: 1,
          dispatchZ: 1,
          finalizationOrdinal: parentCompletionOrdinal,
          fineDispatchX: 1,
          fineDispatchY: 1,
          fineDispatchZ: 1,
          exactLevelCount: 2,
          coarseDispatchX: 1,
          coarseDispatchY: 1,
          coarseDispatchZ: 1,
          emittedCandidateCount: fineEdgeParentIndices.length + 4,
          nativeCandidateCount: 4,
          fineCandidateCount: fineEdgeParentIndices.length,
          keyOrdering: 1,
          maxEdgesPerFineField:
            abi.SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
          clearedWords: parentLayout.wordLength
        }
      );
      for (const [index, key] of parentFieldKeys.entries()) {
        parentWords.set(
          key,
          parentLayout.parentKeyOffsetWords + index * parentLayout.keyWords
        );
      }
      parentWords.set([2, 2], parentLayout.fineEdgeCountOffsetWords);
      parentWords.set(fineEdgeOffsets, parentLayout.fineEdgeOffsetOffsetWords);
      parentWords.set(
        fineEdgeParentIndices,
        parentLayout.fineEdgeParentOffsetWords
      );
      for (const [index, weight] of fineEdgeWeights.entries()) {
        parentWords[parentLayout.fineEdgeWeightOffsetWords + index] =
          f32Bits(weight);
      }
      parentWords.set(
        [0, 1, 2, 3],
        parentLayout.coarseNativeMapOffsetWords
      );

      const directoryLayout = abi.createSchroederSpatialEpochLayout({
        sourceCapacity: 2,
        cellCapacity: 2
      });
      const directoryWords = new Uint32Array(directoryLayout.wordLength);
      setHeader(
        directoryWords,
        abi.SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT,
        {
          magic: abi.SCHROEDER_SPATIAL_EPOCH_MAGIC,
          abiVersion: abi.SCHROEDER_SPATIAL_EPOCH_VERSION,
          statusFlags:
            abi.SCHROEDER_SPATIAL_EPOCH_STATUS_READY
            | abi.SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
          generationId: gasDirectoryGeneration,
          storageGeneration: gasStorageGeneration,
          sourceCount: 2,
          sourceCapacity: 2,
          cellCount: 2,
          cellCapacity: 2,
          logicalRequiredWords: directoryLayout.wordLength,
          logicalAdmittedWords: directoryLayout.wordLength,
          directoryCapacityWords: directoryLayout.wordLength,
          exactKeyWordCount: abi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
          sortKeyWordCount: abi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
          sortMode: abi.SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5,
          headerWords: abi.SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
          cellKeysOffsetWords: directoryLayout.cellKeysOffsetWords,
          cellOffsetsOffsetWords: directoryLayout.cellOffsetsOffsetWords,
          cellMembersOffsetWords: directoryLayout.cellMembersOffsetWords,
          particleToCellOffsetWords:
            directoryLayout.particleToCellOffsetWords,
          buildOrdinal: 51,
          completionOrdinal: 51,
          uniqueGenerationId: gasDirectoryGeneration,
          uniqueInputCount: 2,
          primitiveUniqueCount: 2,
          primitiveAdmitted: 1,
          primitiveStatus: 1,
          consumerDispatchX: 1,
          consumerDispatchY: 1,
          consumerDispatchZ: 1,
          sourceAdapterId:
            abi.SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
          physicalAddressUpperBoundWords: directoryLayout.wordLength
        }
      );
      const signedKey = abi.encodeSchroederSignedOrderKey;
      directoryWords.set([
        chartId,
        signedKey(1),
        signedKey(0),
        signedKey(0),
        signedKey(0),
        chartId,
        signedKey(1),
        signedKey(1),
        signedKey(0),
        signedKey(0)
      ], directoryLayout.cellKeysOffsetWords);
      directoryWords.set(
        [0, 1, 2],
        directoryLayout.cellOffsetsOffsetWords
      );
      directoryWords.set(
        [0, 1],
        directoryLayout.cellMembersOffsetWords
      );
      directoryWords.set(
        [0, 1],
        directoryLayout.particleToCellOffsetWords
      );

      const pressureRows = new Float32Array([
        0, 0, 0, 1, 0.5, 0.5, 0.5, 140, 0, 0, 0, 1,
        1, 0, 0, 1, 1.5, 0.5, 0.5, 340, 0, 0, 0, 1
      ]);
      const gasControl = new Uint32Array(
        gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS
      );
      const gasAt = gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS;
      gasControl[gasAt.MAGIC] =
        gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC;
      gasControl[gasAt.VERSION] =
        gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION;
      gasControl[gasAt.STATUS_FLAGS] =
        gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED
        | gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_STATUS.COMPACT_READY
        | gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_STATUS.DIRECTORY_READY
        | gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_STATUS.EOS_READY
        | gasRuntime.SPH_SPATIAL_GAS_AUTHORITY_STATUS.PRESSURE_READY;
      gasControl[gasAt.EXECUTION_GENERATION] = gasExecutionGeneration;
      gasControl[gasAt.COMPLETION_GENERATION] = gasExecutionGeneration;
      gasControl[gasAt.SOURCE_STORAGE_GENERATION] = gasStorageGeneration;
      gasControl[gasAt.SOURCE_CAPACITY] = 2;
      gasControl[gasAt.LIVE_RESIDUAL_COUNT] = 2;
      gasControl[gasAt.DIRECTORY_GENERATION] = gasDirectoryGeneration;
      gasControl[gasAt.DIRECTORY_CELL_COUNT] = 2;
      gasControl[gasAt.READY_PRESSURE_COUNT] = 2;
      gasControl[gasAt.EOS_AGGREGATE_DISPATCH_X] = 1;
      gasControl[gasAt.EOS_AGGREGATE_DISPATCH_Y] = 1;
      gasControl[gasAt.EOS_AGGREGATE_DISPATCH_Z] = 1;
      gasControl[gasAt.EOS_GRADIENT_DISPATCH_X] = 1;
      gasControl[gasAt.EOS_GRADIENT_DISPATCH_Y] = 1;
      gasControl[gasAt.EOS_GRADIENT_DISPATCH_Z] = 1;
      gasControl[gasAt.COMPACT_STRIDE] =
        gasRuntime.SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
      gasControl[gasAt.ACTIVE_NODE_STRIDE] =
        gasRuntime.SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS;
      gasControl[gasAt.PRESSURE_STRIDE] =
        gasRuntime.SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS;
      gasControl[gasAt.FREE_VOLUME_READY_COUNT] = 2;

      const boundaryLayout =
        abi.createSchroederSpatialGasPressureBoundaryTransportLayout({
          fieldCapacity
        });
      const scratchWords =
        abi.createSchroederSpatialGasPressureBoundaryTransportScratch({
          fieldCapacity,
          generationId: identity.generationId,
          fieldCompletionOrdinal,
          gasAuthorityExecutionGeneration: gasExecutionGeneration
        });
      const params =
        abi.createSchroederSpatialGasPressureBoundaryTransportParams({
          fieldCapacity,
          generationId: identity.generationId,
          fieldCompletionOrdinal,
          fieldMutationOrdinal,
          storageGeneration: identity.storageGeneration,
          physicsTick: identity.physicsTick,
          physicsSubstep: identity.physicsSubstep,
          positionEpoch: identity.positionEpoch,
          topologyEpoch: identity.topologyEpoch,
          chartEpoch: identity.chartEpoch,
          levelEpoch: identity.levelEpoch,
          supportEpoch: identity.supportEpoch,
          selectedLevel: 0,
          gridNodeCount: 1,
          gridDimensions: [1, 1, 1],
          gridCellOrigin: [0, 0, 0],
          chartId,
          dt,
          ambientPressurePa,
          pressureScale,
          gridSpacingM: fineGridSpacingM,
          gasAuthorityExecutionGeneration: gasExecutionGeneration,
          gasAuthorityStorageGeneration: gasStorageGeneration,
          gasPressureCellCapacity: 2,
          gasDirectoryGeneration,
          gasDirectoryWordLength: directoryLayout.wordLength,
          gasDirectoryCellCapacity: 2,
          gasDirectoryCellKeysOffsetWords:
            directoryLayout.cellKeysOffsetWords,
          gasDirectoryCellOffsetsOffsetWords:
            directoryLayout.cellOffsetsOffsetWords,
          gasDirectoryCellMembersOffsetWords:
            directoryLayout.cellMembersOffsetWords,
          gasDirectoryParticleToCellOffsetWords:
            directoryLayout.particleToCellOffsetWords,
          crossLevelMappingMode: 'fine-to-coarse-parent-adjoint',
          gasSelectedLevel: 1,
          gasGridNodeCount: 2,
          gasGridDimensions: [2, 1, 1],
          gasGridCellOrigin: [0, 0, 0],
          gasGridSpacingM,
          parentGenerationId: identity.generationId,
          parentCompletionOrdinal,
          parentFieldCapacity: parentLayout.parentFieldCapacity,
          parentFieldWordCapacity: parentLayout.wordLength
        });

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          [0, 'storage'],
          [1, 'read-only-storage'],
          [2, 'read-only-storage'],
          [3, 'read-only-storage'],
          [4, 'read-only-storage'],
          [5, 'storage'],
          [6, 'read-only-storage'],
          [7, 'uniform'],
          [8, 'read-only-storage']
        ].map(([binding, type]) => ({
          binding,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type }
        }))
      });
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      });
      const shader = device.createShaderModule({
        label: 'native-asymmetric-parent-adjoint-gas-boundary',
        code: abi.schroederSpatialGasPressureBoundaryTransportWgsl
      });
      const compilation = await shader.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => (
          `${message.lineNum}:${message.linePos} ${message.message}`
        ));
      if (compilationErrors.length > 0) {
        return { status: 'shader-error', compilationErrors };
      }
      const entryPoints = [
        'prevalidate_field_boundary_transport',
        'prevalidate_source_boundary_transport',
        'initialize_boundary_transport',
        'stage_boundary_transport',
        'validate_boundary_transport',
        'commit_boundary_transport'
      ];
      const pipelines = [];
      for (const entryPoint of entryPoints) {
        pipelines.push(await device.createComputePipelineAsync({
          label: `native-asymmetric-parent-adjoint-${entryPoint}`,
          layout: pipelineLayout,
          compute: { module: shader, entryPoint }
        }));
      }

      const storageUsage =
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      const upload = (data, usage = storageUsage) => {
        const buffer = device.createBuffer({
          size: Math.max(4, (data.byteLength + 3) & ~3),
          usage
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const buffers = {
        field: upload(
          fieldWords,
          storageUsage | GPUBufferUsage.COPY_SRC
        ),
        receipt: upload(receiptWords),
        moments: upload(momentWords),
        pressure: upload(pressureRows),
        directory: upload(directoryWords),
        scratch: upload(
          scratchWords,
          storageUsage | GPUBufferUsage.COPY_SRC
        ),
        gasControl: upload(gasControl),
        params: upload(
          params,
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        ),
        parent: upload(parentWords)
      };
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          ['field', 0],
          ['receipt', 1],
          ['moments', 2],
          ['pressure', 3],
          ['directory', 4],
          ['scratch', 5],
          ['gasControl', 6],
          ['params', 7],
          ['parent', 8]
        ].map(([name, binding]) => ({
          binding,
          resource: { buffer: buffers[name] }
        }))
      });
      const fieldReadback = device.createBuffer({
        size: fieldWords.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const scratchReadback = device.createBuffer({
        size: scratchWords.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      for (const pipeline of pipelines) {
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(...boundaryLayout.dispatchWorkgroups);
      }
      pass.end();
      encoder.copyBufferToBuffer(
        buffers.field,
        0,
        fieldReadback,
        0,
        fieldWords.byteLength
      );
      encoder.copyBufferToBuffer(
        buffers.scratch,
        0,
        scratchReadback,
        0,
        scratchWords.byteLength
      );
      device.queue.submit([encoder.finish()]);
      await Promise.all([
        fieldReadback.mapAsync(GPUMapMode.READ),
        scratchReadback.mapAsync(GPUMapMode.READ)
      ]);
      const fieldOutput = new Uint32Array(
        fieldReadback.getMappedRange().slice(0)
      );
      const scratchOutput = new Uint32Array(
        scratchReadback.getMappedRange().slice(0)
      );
      fieldReadback.unmap();
      scratchReadback.unmap();
      const actual = fields.map((unused, fieldIndex) => {
        const state = fieldLayout.stateOffsetWords
          + fieldIndex * fieldLayout.stateWords;
        const accumulator = fieldLayout.accumulatorOffsetWords
          + fieldIndex * fieldLayout.accumulatorWords;
        const scratchRow =
          abi.SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS
          + fieldIndex
            * abi.SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS;
        return {
          velocityMPerS: [1, 2, 3].map((word) => (
            bitsF32(fieldOutput[state + word])
          )),
          impulseNs: [4, 5, 6].map((word) => (
            bitsF32(fieldOutput[accumulator + word])
          )),
          externalWorkJ: bitsF32(fieldOutput[accumulator + 7]),
          effectiveGaugePressurePa:
            bitsF32(scratchOutput[scratchRow + 9])
        };
      });
      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      const scratchFailure = scratchOutput[2];
      const scratchValidatedFieldCount = scratchOutput[8];
      for (const buffer of [
        ...Object.values(buffers),
        fieldReadback,
        scratchReadback
      ]) {
        buffer.destroy();
      }
      device.destroy();
      return {
        status: 'executed',
        fineEdgeParentIndices,
        fineEdgeWeights,
        oracle: {
          admitted: oracle.admitted,
          appliedFieldCount: oracle.appliedFieldCount,
          missingCellCount: oracle.missingCellCount,
          rows: oracle.rows
        },
        actual,
        scratchFailure,
        scratchValidatedFieldCount,
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
  assert.equal(native.scratchFailure, 0, JSON.stringify(native));
  assert.equal(
    native.scratchValidatedFieldCount,
    2,
    JSON.stringify(native)
  );
  assert.deepEqual(native.fineEdgeParentIndices, [0, 2, 1, 3]);
  assert.deepEqual(
    native.fineEdgeWeights,
    [0.125, 0.875, 0.625, 0.375]
  );
  assert.equal(native.oracle.admitted, true);
  assert.equal(native.oracle.appliedFieldCount, 2);
  assert.equal(native.oracle.missingCellCount, 0);
  assert.deepEqual(
    native.oracle.rows.map((row) => row.effectiveGaugePressurePa),
    [215, 115]
  );
  const assertClose = (actual, expected, label) => {
    const tolerance = 2e-5 * Math.max(1, Math.abs(expected));
    assert.ok(
      Math.abs(actual - expected) <= tolerance,
      `${label}: expected ${expected}, received ${actual}`
    );
  };
  for (const [fieldIndex, actual] of native.actual.entries()) {
    const expected = native.oracle.rows[fieldIndex];
    for (const [axis, value] of actual.velocityMPerS.entries()) {
      assertClose(
        value,
        expected.velocityMPerS[axis],
        `field ${fieldIndex} velocity ${axis}`
      );
    }
    for (const [axis, value] of actual.impulseNs.entries()) {
      assertClose(
        value,
        expected.impulseNs[axis],
        `field ${fieldIndex} impulse ${axis}`
      );
    }
    assertClose(
      actual.externalWorkJ,
      expected.externalWorkJ,
      `field ${fieldIndex} external work`
    );
    assertClose(
      actual.effectiveGaugePressurePa,
      expected.effectiveGaugePressurePa,
      `field ${fieldIndex} effective gauge`
    );
    assert.notEqual(actual.effectiveGaugePressurePa, 140);
  }
});
