import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4 === '1';
const BASE_URL = process.env.ULG_CROSS_LEVEL_M3_BASE_URL
  || 'https://127.0.0.1:5174/';
const REQUESTED_RATIOS = process.env.ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS
  ? process.env.ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS.split(',').map(Number)
  : [1, 2, 3, 4];
if (
  REQUESTED_RATIOS.length < 1
  || REQUESTED_RATIOS.some((ratio) => ![1, 2, 3, 4].includes(ratio))
) {
  throw new RangeError(
    'ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS must contain only r=1..4'
  );
}

test('native M3 canonical controller executes authentic Vulkan WebGPU r=1..4', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4=1 for native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_CROSS_LEVEL_M3_CHROME
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
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async (requestedRatios) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      // Request the same limits the resident SPH runtime requires. A bare
      // requestDevice() caps storage buffers at the 8-per-stage default, which
      // the two-level workspace exceeds, so the harness would fail on a limit
      // the production device never hits.
      const deviceLimitsModule = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimitsModule.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      // A lost device surfaces downstream only as an opaque mapAsync abort.
      // Record the real reason so a driver-level loss is not misread as a
      // readback or validation defect.
      const deviceLost = [];
      device.lost.then((info) => {
        deviceLost.push({
          reason: info?.reason ?? null,
          message: info?.message ?? String(info)
        });
      }).catch(() => {});
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      // Vite versions dirty dependencies with ?t=... URLs. Runtime ownership
      // is WeakMap-branded, so import the exact dependency instances used by
      // the controller/coupling modules instead of creating unversioned twins.
      const [hierarchySource, couplingSource] = await Promise.all([
        fetch('/src/runtime/sph/schroederHierarchyGpu.js').then(
          (response) => response.text()
        ),
        fetch('/src/runtime/sph/schroederCrossLevelCouplingGpu.js').then(
          (response) => response.text()
        )
      ]);
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const source of sources) {
          const match = source.match(new RegExp(
            `["']([^"']*${escaped}(?:\\?[^"']*)?)["']`
          ));
          if (match) return match[1];
        }
        throw new Error(`Vite dependency URL not found for ${path}`);
      };
      const versioned = (path, ...sources) => dependencyUrl(sources, path);

      const [
        abi,
        buffersModule,
        spatialModule,
        transactionModule,
        hierarchyModule,
        couplingModule,
        gridModule,
        updateModule,
        g2pModule,
        workspaceModule,
        fusedModule,
        materialTableModule,
        mechanicsRefreshModule
      ] = await Promise.all([
        import(versioned(
          '/ulg-gpu-abi/src/index.js',
          couplingSource,
          hierarchySource
        )),
        import(versioned(
          '/src/runtime/sph/sphGpuBuffers.js',
          couplingSource,
          hierarchySource
        )),
        import(versioned(
          '/src/runtime/sph/schroederSpatialEpochGpu.js',
          hierarchySource,
          couplingSource
        )),
        import(versioned(
          '/src/runtime/sph/schroederSpatialEpochTransaction.js',
          hierarchySource,
          couplingSource
        )),
        import('/src/runtime/sph/schroederHierarchyGpu.js'),
        import('/src/runtime/sph/schroederCrossLevelCouplingGpu.js'),
        import(versioned(
          '/src/runtime/sph/sphGridGpuKernel.js',
          hierarchySource,
          couplingSource
        )),
        import(versioned(
          '/src/runtime/sph/sphGridUpdateGpuKernel.js',
          hierarchySource,
          couplingSource
        )),
        import(versioned(
          '/src/runtime/sph/sphG2pGpuKernel.js',
          hierarchySource,
          couplingSource
        )),
        import(versioned(
          '/src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js',
          couplingSource,
          hierarchySource
        )),
        import(versioned(
          '/src/runtime/sph/schroederFusedFineSubstepGpu.js',
          couplingSource,
          hierarchySource
        )),
        import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import(versioned(
          '/src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
          couplingSource,
          hierarchySource
        ))
      ]);

      const requireTrue = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const finiteArray = (values) => values.every(Number.isFinite);
      const readBuffer = async (buffer, byteLength, label) => {
        const size = Math.max(4, Math.ceil(Number(byteLength) / 4) * 4);
        const readback = device.createBuffer({
          label,
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
        try {
          await readback.mapAsync(GPUMapMode.READ);
        } catch (error) {
          // Name the readback: a device/instance teardown surfaces here as an
          // opaque AbortError with no indication of which stage died.
          throw new Error(
            `readback '${label}' (${size} bytes) failed: `
              + (error?.message || String(error))
          );
        }
        const bytes = readback.getMappedRange().slice(0, Number(byteLength));
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const readU32Words = async (buffer, wordLength, label) => (
        new Uint32Array(await readBuffer(
          buffer,
          Number(wordLength) * Uint32Array.BYTES_PER_ELEMENT,
          label
        ))
      );
      const generationIdentity = (generation) => {
        const execution = generation?.execution ?? null;
        const source = generation?.source ?? null;
        const parentFieldView = generation?.parentFieldView ?? null;
        return {
          executionGenerationId: execution?.generationId ?? null,
          generationId: parentFieldView?.generationId ?? null,
          deviceOrdinal: parentFieldView?.deviceOrdinal ?? null,
          laneOrdinal: parentFieldView?.laneOrdinal ?? null,
          leaseToken: parentFieldView?.leaseToken ?? null,
          sourceFamilyId: parentFieldView?.sourceFamilyId ?? null,
          storageGeneration: parentFieldView?.storageGeneration ?? null,
          physicsTick: source?.physicsTick ?? parentFieldView?.physicsTick ?? null,
          physicsSubstep:
            source?.physicsSubstep ?? parentFieldView?.physicsSubstep ?? null,
          positionEpoch:
            source?.positionEpoch ?? parentFieldView?.positionEpoch ?? null,
          topologyEpoch:
            source?.topologyEpoch ?? parentFieldView?.topologyEpoch ?? null,
          chartEpoch: source?.chartEpoch ?? parentFieldView?.chartEpoch ?? null,
          levelEpoch: source?.levelEpoch ?? parentFieldView?.levelEpoch ?? null,
          supportEpoch:
            source?.supportEpoch ?? parentFieldView?.supportEpoch ?? null,
          parentCompletionOrdinal: parentFieldView?.completionOrdinal ?? null,
          fineCompletionOrdinal:
            parentFieldView?.fineFieldView?.completionOrdinal ?? null,
          coarseCompletionOrdinal:
            parentFieldView?.coarseFieldView?.completionOrdinal ?? null
        };
      };
      const transactionIdentity = (transaction) => {
        const microepoch = transaction?.microepochAuthority ?? null;
        const ledger = transaction?.refluxLedger ?? null;
        return {
          substepOrdinal: transaction?.substepOrdinal ?? null,
          completionOrdinal: transaction?.completionOrdinal
            ?? transaction?.macroAuthority?.completionOrdinal
            ?? null,
          rootGenerationId: microepoch?.rootGenerationId ?? null,
          currentGenerationId: microepoch?.currentGenerationId ?? null,
          generation: generationIdentity(microepoch?.generation),
          ledgerCompletionOrdinal: ledger?.completionOrdinal ?? null,
          ledgerMacroOwnerId: ledger?.macroOwnerId ?? null,
          ledgerOwnerGeneration: ledger?.ownerGeneration ?? null,
          fieldGenerationId: transaction?.coarseFieldView?.generationId
            ?? transaction?.fineFieldView?.generationId
            ?? null,
          fieldCompletionOrdinal:
            transaction?.coarseFieldView?.completionOrdinal
              ?? transaction?.fineFieldView?.completionOrdinal
              ?? null,
          mutationInputOrdinal: transaction?.gridUpdateMutation?.expectedOrdinal
            ?? transaction?.fineCorrectionMutation?.expectedOrdinal
            ?? null,
          mutationOutputOrdinal: transaction?.gridUpdateMutation?.outputOrdinal
            ?? transaction?.fineCorrectionMutation?.outputOrdinal
            ?? null
        };
      };
      const floatBits = new Uint32Array(1);
      const floatValues = new Float32Array(floatBits.buffer);
      const f32FromWord = (word) => {
        floatBits[0] = Number(word) >>> 0;
        return floatValues[0];
      };
      const f32Add = (left, right) => Math.fround(
        Math.fround(left) + Math.fround(right)
      );
      const f32Subtract = (left, right) => Math.fround(
        Math.fround(left) - Math.fround(right)
      );
      const measuredClose = (left, right, count = 1) => {
        const nEpsilon = Math.min(
          0.25,
          Math.max(1, Number(count) || 1) * 2 ** -24
        );
        const gamma = nEpsilon / Math.max(1e-20, 1 - nEpsilon);
        const tolerance = Math.max(
          8 * 1.175494351e-38,
          gamma * (Math.abs(left) + Math.abs(right))
        );
        return Number.isFinite(left)
          && Number.isFinite(right)
          && Math.abs(left - right) <= tolerance;
      };
      const wordFromF32 = (value) => {
        floatValues[0] = Math.fround(value);
        return floatBits[0];
      };
      const terminalSealEnergyDiagnostics = (
        workspaceWords,
        execution,
        ledgerWords
      ) => {
        if (
          !ledgerWords
          || ledgerWords.length
            < abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
        ) return null;
        const coarseFieldCount = workspaceWords[22];
        const routeOffset = execution.layout.routeProposalOffsetWords;
        const routeRowWords = execution.layout.routeProposalRowWords;
        const ledgerRowOffset = ledgerWords[6];
        const ledgerRowWords = ledgerWords[5];
        let actualCoarseEnergy = 0;
        let coarseEnergySumAbs = 0;
        let causalWeightSum = 0;
        let localHeatSum = 0;
        let stateContributionSum = 0;
        let localContributionSum = 0;
        let virtualCoarseEnergy = 0;
        let virtualEnergySumAbs = 0;
        const rows = [];
        for (let index = 0; index < coarseFieldCount; index += 1) {
          const proposal = routeOffset + index * routeRowWords;
          const ledgerRow = ledgerRowOffset + index * ledgerRowWords;
          const deltaEnergy = f32FromWord(workspaceWords[proposal + 3]);
          const causalWeight = f32FromWord(ledgerWords[ledgerRow + 15]);
          const stateContributionCount = workspaceWords[proposal + 5];
          const localHeat = f32FromWord(workspaceWords[proposal + 6]);
          const localContributionCount = workspaceWords[proposal + 7];
          const virtualEnergy = f32FromWord(ledgerWords[ledgerRow + 9]);
          const ledgerCausalWeight = f32FromWord(ledgerWords[ledgerRow + 15]);
          const crossLevelPressureCompensation =
            f32FromWord(ledgerWords[ledgerRow + 16]);
          const crossLevelDragHeat =
            f32FromWord(ledgerWords[ledgerRow + 17]);
          actualCoarseEnergy = f32Add(actualCoarseEnergy, deltaEnergy);
          coarseEnergySumAbs = f32Add(
            coarseEnergySumAbs,
            Math.abs(deltaEnergy)
          );
          causalWeightSum = f32Add(causalWeightSum, causalWeight);
          localHeatSum = f32Add(localHeatSum, localHeat);
          stateContributionSum += stateContributionCount;
          localContributionSum += localContributionCount;
          virtualCoarseEnergy = f32Add(virtualCoarseEnergy, virtualEnergy);
          virtualEnergySumAbs = f32Add(
            virtualEnergySumAbs,
            Math.abs(virtualEnergy)
          );
          rows.push({
            index,
            deltaEnergy,
            causalWeight,
            stateContributionCount,
            localHeat,
            localContributionCount,
            virtualEnergy,
            ledgerCausalWeight,
            crossLevelPressureCompensation,
            crossLevelDragHeat
          });
        }
        const fineKineticEnergy = f32FromWord(ledgerWords[28]);
        const ledgerVirtualCoarseEnergy = f32FromWord(ledgerWords[29]);
        const fineRouteHeat = f32FromWord(ledgerWords[112]);
        const finePressureCompensation = f32FromWord(ledgerWords[128]);
        const coarsePressureCompensation = f32FromWord(ledgerWords[129]);
        const fineDragHeat = f32FromWord(ledgerWords[130]);
        const coarseDragHeat = f32FromWord(ledgerWords[131]);
        const closure = abi.deriveSchroederCrossLevelRefluxEnergyClosure({
          fineKineticEnergyDeltaJ: fineKineticEnergy,
          virtualCoarseKineticEnergyDeltaJ: virtualCoarseEnergy,
          actualCoarseKineticEnergyDeltaJ: actualCoarseEnergy,
          cumulativeFineRouteHeatJ: fineRouteHeat,
          fineCrossLevelPressureCompensationJ: finePressureCompensation,
          coarseCrossLevelPressureCompensationJ: coarsePressureCompensation,
          fineCrossLevelDragHeatJ: fineDragHeat,
          coarseCrossLevelDragHeatJ: coarseDragHeat,
          actualCoarseEnergyConditioningSumAbsJ: coarseEnergySumAbs,
          virtualCoarseEnergyConditioningSumAbsJ: virtualEnergySumAbs
        });
        const causalKineticResidual =
          closure.causalKineticEnergyResidualJ;
        const actualKineticResidual =
          closure.actualKineticEnergyResidualJ;
        const synchronizationWork = closure.synchronizationWorkJ;
        const synchronizationConditioningSumAbs =
          closure.synchronizationConditioningSumAbsJ;
        const synchronizationTolerance = closure.synchronizationToleranceJ;
        const causalEnergySumAbs =
          closure.causalEnergyConditioningSumAbsJ;
        const causalEnergyTolerance = closure.causalEnergyToleranceJ;
        const causalRouteHeat = closure.causalRouteHeatJ;
        const deferredUnclamped = closure.deferredRouteHeatUnclampedJ;
        const deferredRouteHeat = closure.coarseDeferredRouteHeatJ;
        const totalRouteHeat = closure.totalRouteHeatJ;
        const energySumAbs = closure.totalEnergyConditioningSumAbsJ;
        const energyTolerance = closure.totalEnergyToleranceJ;
        const causalEnergyResidual = closure.causalEnergyResidualJ;
        const totalEnergyResidual = closure.totalEnergyResidualJ;
        const virtualEnergyTolerance = Math.max(
          8 * 1.175494351e-38,
          Math.fround(
            1024 * 5.960464477539063e-8
              * f32Add(
                Math.abs(ledgerVirtualCoarseEnergy),
                virtualEnergySumAbs
              )
          )
        );
        const predicates = {
          causalKineticResidualAtMostTolerance: closure.causalValid,
          deferredUnclampedAboveNegativeTolerance: closure.causalValid,
          causalEnergyResidualWithinTolerance: closure.causalValid,
          totalEnergyResidualWithinTolerance: closure.totalValid,
          synchronizationWorkConditioned: closure.operatorSplitValid,
          virtualCoarseEnergyMatches:
            Math.abs(ledgerVirtualCoarseEnergy - virtualCoarseEnergy)
              <= virtualEnergyTolerance
        };
        return {
          coarseFieldCount,
          routeProposalOffsetWords: routeOffset,
          ledgerH28Bits: ledgerWords[28],
          ledgerH29Bits: ledgerWords[29],
          ledgerH112Bits: ledgerWords[112],
          ledgerH128Bits: ledgerWords[128],
          ledgerH129Bits: ledgerWords[129],
          ledgerH130Bits: ledgerWords[130],
          ledgerH131Bits: ledgerWords[131],
          fineKineticEnergy,
          ledgerVirtualCoarseEnergy,
          fineRouteHeat,
          finePressureCompensation,
          coarsePressureCompensation,
          fineDragHeat,
          coarseDragHeat,
          actualCoarseEnergy,
          coarseEnergySumAbs,
          causalKineticResidual,
          actualKineticResidual,
          synchronizationWork,
          synchronizationConditioningSumAbs,
          synchronizationTolerance,
          causalEnergySumAbs,
          causalEnergyTolerance,
          causalRouteHeat,
          deferredUnclamped,
          deferredRouteHeat,
          totalRouteHeat,
          energySumAbs,
          energyTolerance,
          causalEnergyResidual,
          totalEnergyResidual,
          causalWeightSum,
          localHeatSum,
          stateContributionSum,
          localContributionSum,
          virtualCoarseEnergy,
          virtualEnergySumAbs,
          virtualEnergyTolerance,
          predicates,
          energyOk: Object.values(predicates).every(Boolean),
          rows
        };
      };
      const spatialGenerationDiagnostics = (entry, fixtureInitial) => {
        const runtimeRows = (runtimes) => [...(runtimes?.entries?.() ?? [])].map(
          ([key, runtime]) => ({
            key,
            arenaCount: runtime?.arenaCount ?? null,
            activeExecutionCount: runtime?.activeExecutionCount?.() ?? null
          })
        );
        return {
          arenaCapacity: entry?.runtime?.arenaCount ?? null,
          liveGenerationCount: entry?.liveGenerations?.length ?? null,
          childRuntimeActivity: {
            mechanics: runtimeRows(entry?.mechanicsViewRuntimes),
            mechanicsField: runtimeRows(entry?.mechanicsFieldViewRuntimes),
            hierarchy: runtimeRows(entry?.hierarchyViewRuntimes),
            parentField: runtimeRows(entry?.parentFieldViewRuntimes),
            aggregate: entry?.aggregateViewRuntime ? {
              arenaCount: entry.aggregateViewRuntime.arenaCount ?? null,
              activeExecutionCount:
                entry.aggregateViewRuntime.activeExecutionCount?.() ?? null
            } : null
          },
          liveGenerations: (entry?.liveGenerations ?? []).map((liveGeneration) => ({
          generationId: liveGeneration?.execution?.generationId ?? null,
          isFixtureInitial: liveGeneration === fixtureInitial,
          sourcePhysicsTick: liveGeneration?.source?.physicsTick ?? null,
          sourcePhysicsSubstep: liveGeneration?.source?.physicsSubstep ?? null,
          releaseScheduled: liveGeneration?.releaseScheduled === true,
          releaseStatus: liveGeneration?.releaseStatus ?? null,
          releaseReason: liveGeneration?.releaseReason ?? null,
          releasePromisePresent:
            typeof liveGeneration?.releasePromise?.then === 'function',
          artifacts: {
            spatial: liveGeneration?.execution?.released === true,
            mechanics: (liveGeneration?.mechanicsLevelViews ?? []).map(
              (levelView) => ({
                level: levelView.selectedLevel,
                compact: levelView.mechanicsView?.released === true,
                field: levelView.mechanicsFieldView?.released === true
              })
            ),
            hierarchy: liveGeneration?.hierarchyView?.released === true,
            parentField: liveGeneration?.parentFieldView?.released === true,
            aggregate: liveGeneration?.aggregateView?.released === true
          }
          }))
        };
      };
      let activeDiagnosticRatio = null;
      const mechanicsFieldRuntimeInstrumentation = new WeakMap();
      const mechanicsFieldRuntimeRecordByRuntime = new WeakMap();
      const mechanicsFieldRuntimeRecords = [];
      const mechanicsFieldExecutionRecords = [];
      const mechanicsFieldExecutionRecordByExecution = new WeakMap();
      const mechanicsFieldEvents = [];
      const mechanicsFieldRuntimeRollovers = [];
      let mechanicsFieldRuntimeSerial = 0;
      let mechanicsFieldEventOrdinal = 0;
      const runtimeKeyFor = (entry, runtime) => (
        [...(entry?.mechanicsFieldViewRuntimes?.entries?.() ?? [])].find(
          ([, candidate]) => candidate === runtime
        )?.[0] ?? null
      );
      const mechanicsFieldRuntimeRecord = (
        entry,
        runtime,
        runtimeKey = runtimeKeyFor(entry, runtime)
      ) => {
        if (!runtime) return null;
        let record = mechanicsFieldRuntimeRecordByRuntime.get(runtime);
        if (record) return record;
        record = {
          entry,
          runtime,
          runtimeKey,
          runtimeId: ++mechanicsFieldRuntimeSerial,
          createdRatio: activeDiagnosticRatio,
          arenaCount: runtime.arenaCount ?? null,
          destroyCalls: 0,
          destroyed: false,
          destroyResult: null
        };
        mechanicsFieldRuntimeRecordByRuntime.set(runtime, record);
        mechanicsFieldRuntimeRecords.push(record);
        return record;
      };
      const mechanicsFieldRuntimeSnapshot = (record) => ({
        runtimeId: record.runtimeId,
        runtimeKey: record.runtimeKey,
        createdRatio: record.createdRatio,
        arenaCount: record.arenaCount,
        currentForKey:
          record.entry?.mechanicsFieldViewRuntimes?.get(record.runtimeKey)
            === record.runtime,
        activeExecutionCount:
          record.runtime.activeExecutionCount?.() ?? null,
        usableArenaCount: record.runtime.usableArenaCount?.() ?? null,
        quarantinedArenaCount:
          record.runtime.quarantinedArenaCount?.() ?? null,
        retiredArenaCount: record.runtime.retiredArenaCount?.() ?? null,
        destroyCalls: record.destroyCalls,
        destroyed: record.destroyed,
        destroyResult: record.destroyResult
      });
      const mechanicsFieldExecutionSnapshot = (record) => {
        const execution = record.execution;
        let mutation = null;
        try {
          if (execution?.released !== true) {
            mutation = record.runtime.stateMutationState?.(execution) ?? null;
          }
        } catch (error) {
          mutation = { snapshotError: error?.message ?? String(error) };
        }
        return {
          runtimeId: record.runtimeId,
          runtimeKey: record.runtimeKey,
          createdRatio: record.createdRatio,
          origin: record.origin,
          generationId: execution?.generationId ?? null,
          selectedLevel: execution?.selectedLevel ?? null,
          arenaIndex: execution?.arenaIndex ?? null,
          arenaGeneration: execution?.arenaGeneration ?? null,
          status: execution?.status ?? null,
          submitPerformed: execution?.submitPerformed === true,
          runtimeSubmitted:
            execution?.released === true
              ? false
              : record.runtime.isExecutionSubmitted?.(execution) === true,
          released: execution?.released === true,
          markSubmittedCalls: record.markSubmittedCalls,
          releaseCalls: record.releaseCalls,
          releaseAfterCalls: record.releaseAfterCalls,
          releasePromisePresent: record.releasePromisePresent,
          releaseSettled: record.releaseSettled,
          releaseResult: record.releaseResult,
          releaseError: record.releaseError,
          mutation
        };
      };
      const registerMechanicsFieldExecution = (
        entry,
        runtime,
        execution,
        origin
      ) => {
        if (!execution || mechanicsFieldExecutionRecordByExecution.has(execution)) {
          return mechanicsFieldExecutionRecordByExecution.get(execution) ?? null;
        }
        const record = {
          runtime,
          runtimeId: mechanicsFieldRuntimeRecord(entry, runtime).runtimeId,
          runtimeKey: runtimeKeyFor(entry, runtime),
          execution,
          origin,
          createdRatio: activeDiagnosticRatio,
          markSubmittedCalls: 0,
          releaseCalls: 0,
          releaseAfterCalls: 0,
          releasePromisePresent: false,
          releaseSettled: false,
          releaseResult: null,
          releaseError: null
        };
        mechanicsFieldExecutionRecords.push(record);
        mechanicsFieldExecutionRecordByExecution.set(execution, record);
        return record;
      };
      const registerGenerationMechanicsFields = (entry, generation, origin) => {
        for (const levelView of generation?.mechanicsLevelViews ?? []) {
          const execution = levelView?.mechanicsFieldView ?? null;
          const runtime = levelView?.mechanicsFieldViewRuntime
            ?? execution?.ownerRuntime
            ?? null;
          if (runtime && execution) {
            registerMechanicsFieldExecution(entry, runtime, execution, origin);
          }
        }
      };
      const instrumentMechanicsFieldRuntimes = (entry) => {
        for (const [runtimeKey, runtime] of
          entry?.mechanicsFieldViewRuntimes?.entries?.() ?? []) {
          const runtimeRecord = mechanicsFieldRuntimeRecord(
            entry,
            runtime,
            runtimeKey
          );
          if (mechanicsFieldRuntimeInstrumentation.has(runtime)) continue;
          const original = {
            encode: runtime.encode,
            markExecutionSubmitted: runtime.markExecutionSubmitted,
            releaseExecution: runtime.releaseExecution,
            releaseExecutionAfter: runtime.releaseExecutionAfter,
            destroy: runtime.destroy
          };
          mechanicsFieldRuntimeInstrumentation.set(runtime, { runtimeKey, original });
          runtime.encode = (...args) => {
            const event = {
              type: 'encode',
              ordinal: ++mechanicsFieldEventOrdinal,
              ratio: activeDiagnosticRatio,
              runtimeId: runtimeRecord.runtimeId,
              runtimeKey,
              activeBefore: runtime.activeExecutionCount?.() ?? null,
              usableBefore: runtime.usableArenaCount?.() ?? null,
              succeeded: false,
              errorCode: null
            };
            mechanicsFieldEvents.push(event);
            try {
              const execution = original.encode(...args);
              event.succeeded = true;
              event.arenaIndex = execution?.arenaIndex ?? null;
              event.activeAfter = runtime.activeExecutionCount?.() ?? null;
              registerMechanicsFieldExecution(
                entry,
                runtime,
                execution,
                'instrumented-encode'
              );
              return execution;
            } catch (error) {
              event.activeAfter = runtime.activeExecutionCount?.() ?? null;
              event.errorCode = error?.code ?? null;
              event.errorMessage = error?.message ?? String(error);
              throw error;
            }
          };
          runtime.markExecutionSubmitted = (execution, ...args) => {
            const record = registerMechanicsFieldExecution(
              entry,
              runtime,
              execution,
              'submitted-existing'
            );
            if (record) record.markSubmittedCalls += 1;
            return original.markExecutionSubmitted(execution, ...args);
          };
          runtime.releaseExecution = (execution, ...args) => {
            const record = registerMechanicsFieldExecution(
              entry,
              runtime,
              execution,
              'released-existing'
            );
            if (record) record.releaseCalls += 1;
            const result = original.releaseExecution(execution, ...args);
            if (record) {
              record.releaseSettled = true;
              record.releaseResult = result;
            }
            return result;
          };
          runtime.releaseExecutionAfter = (execution, ...args) => {
            const record = registerMechanicsFieldExecution(
              entry,
              runtime,
              execution,
              'release-after-existing'
            );
            if (record) record.releaseAfterCalls += 1;
            const result = original.releaseExecutionAfter(execution, ...args);
            if (record) {
              record.releasePromisePresent = typeof result?.then === 'function';
              Promise.resolve(result).then((value) => {
                record.releaseSettled = true;
                record.releaseResult = value;
              }, (error) => {
                record.releaseSettled = true;
                record.releaseError = {
                  code: error?.code ?? null,
                  message: error?.message ?? String(error)
                };
              });
            }
            return result;
          };
          runtime.destroy = (...args) => {
            const event = {
              type: 'destroy',
              ordinal: ++mechanicsFieldEventOrdinal,
              ratio: activeDiagnosticRatio,
              runtimeId: runtimeRecord.runtimeId,
              runtimeKey,
              activeBefore: runtime.activeExecutionCount?.() ?? null,
              usableBefore: runtime.usableArenaCount?.() ?? null,
              retiredBefore: runtime.retiredArenaCount?.() ?? null,
              succeeded: false,
              result: null,
              error: null
            };
            mechanicsFieldEvents.push(event);
            runtimeRecord.destroyCalls += 1;
            try {
              const result = original.destroy(...args);
              event.succeeded = true;
              event.result = result;
              event.activeAfter = runtime.activeExecutionCount?.() ?? null;
              runtimeRecord.destroyed = result === true || runtimeRecord.destroyed;
              runtimeRecord.destroyResult = result;
              return result;
            } catch (error) {
              event.error = {
                code: error?.code ?? null,
                message: error?.message ?? String(error)
              };
              throw error;
            }
          };
        }
      };
      const generationMechanicsFieldRuntimeSnapshot = (entry, generation) => ({
        generationId: generation?.execution?.generationId ?? null,
        released: generation?.execution?.released === true,
        levels: (generation?.mechanicsLevelViews ?? []).map((levelView) => {
          const runtime = levelView?.mechanicsFieldViewRuntime ?? null;
          const execution = levelView?.mechanicsFieldView ?? null;
          const record = mechanicsFieldRuntimeRecord(entry, runtime);
          return {
            level: levelView?.selectedLevel ?? null,
            runtime,
            execution,
            runtimeId: record?.runtimeId ?? null,
            runtimeKey: record?.runtimeKey ?? null,
            arenaCount: runtime?.arenaCount ?? null,
            executionOwnerRetained: execution?.ownerRuntime === runtime,
            executionReleased: execution?.released === true
          };
        })
      });
      const allocationBoundaryDiagnostics = (entry, controller, error) => ({
        ratio: activeDiagnosticRatio,
        error: {
          code: error?.code ?? null,
          message: error?.message ?? String(error),
          arenaCapacity: error?.arenaCapacity ?? null,
          liveGenerationCount: error?.liveGenerationCount ?? null,
          rejectedGenerationStatus: error?.rejectedGenerationStatus ?? null,
          rejectedGenerationErrorCode:
            error?.rejectedGenerationErrorCode ?? null,
          rejectedGenerationReason: error?.rejectedGenerationReason ?? null
        },
        controller: controller?.summary?.() ?? null,
        liveGenerations: (entry?.liveGenerations ?? []).map(
          (liveGeneration) => ({
            generationId: liveGeneration?.execution?.generationId ?? null,
            sourcePhysicsTick: liveGeneration?.source?.physicsTick ?? null,
            sourcePhysicsSubstep: liveGeneration?.source?.physicsSubstep ?? null,
            releaseScheduled: liveGeneration?.releaseScheduled === true,
            releasePromisePresent:
              typeof liveGeneration?.releasePromise?.then === 'function',
            releaseStatus: liveGeneration?.releaseStatus ?? null,
            releaseReason: liveGeneration?.releaseReason ?? null,
            releaseAttemptCount: liveGeneration?.releaseAttemptCount ?? null,
            releaseFailureCount: liveGeneration?.releaseFailureCount ?? null,
            releaseOperationResults:
              liveGeneration?.releaseOperationResults ?? null,
            spatial: {
              arenaIndex: liveGeneration?.execution?.arenaIndex ?? null,
              submitted: liveGeneration?.execution?.submitPerformed === true,
              released: liveGeneration?.execution?.released === true
            },
            mechanicsFields: (liveGeneration?.mechanicsLevelViews ?? []).map(
              (levelView) => {
                const execution = levelView?.mechanicsFieldView ?? null;
                const runtime = levelView?.mechanicsFieldViewRuntime
                  ?? execution?.ownerRuntime
                  ?? null;
                const record = mechanicsFieldExecutionRecordByExecution.get(
                  execution
                );
                return {
                  level: levelView?.selectedLevel ?? null,
                  runtimeKey: runtimeKeyFor(entry, runtime),
                  execution: record
                    ? mechanicsFieldExecutionSnapshot(record)
                    : null
                };
              }
            )
          })
        ),
        mechanicsFieldRuntimes: [
          ...(entry?.mechanicsFieldViewRuntimes?.entries?.() ?? [])
        ].map(([runtimeKey, runtime]) => ({
          runtimeKey,
          arenaCount: runtime?.arenaCount ?? null,
          usableArenaCount: runtime?.usableArenaCount?.() ?? null,
          quarantinedArenaCount: runtime?.quarantinedArenaCount?.() ?? null,
          retiredArenaCount: runtime?.retiredArenaCount?.() ?? null,
          activeExecutionCount: runtime?.activeExecutionCount?.() ?? null,
          executions: mechanicsFieldExecutionRecords
            .filter((record) => record.runtime === runtime)
            .map(mechanicsFieldExecutionSnapshot)
        })),
        recentEvents: mechanicsFieldEvents.slice(-40)
      });

      const runRatio = async (ratio) => {
        const ratioStartedAt = performance.now();
        activeDiagnosticRatio = ratio;
        const particleCount = 2;
        const dt = Math.fround(0.005 * ratio);
        const storageGeneration = 100 + ratio;
        const mechanicsMaterialTable =
          materialTableModule.buildMlsMpmMechanicsMaterialTable({
            h2o: {
              molarMassKgPerMol: 0.018015,
              phases: [{
                name: 'liquid',
                densityKgPerM3: 997,
                bulkModulusPa: 2.2e9,
                shearModulusPa: 0,
                cpJPerKgK: 4184,
                dynamicViscosityPaS: 0.001,
                temperatureRange: [273.15, 373.15]
              }, {
                name: 'gas',
                densityKgPerM3: 0.6,
                bulkModulusPa: null,
                shearModulusPa: 0,
                cpJPerKgK: 2010,
                dynamicViscosityPaS: 1.3e-5,
                temperatureRange: [373.15, 1000]
              }]
            }
          }, { viscosityEnabled: true });
        const materialId = mechanicsMaterialTable.metadata[0].materialId;
        const state = new Float32Array([
          0.9, 1, 1, 1, 0.2, 0, 0, 16,
          1.1, 1, 1, 1, 0, 0.2, 0, 16
        ]);
        const thermo = new Float32Array(particleCount * 12);
        const identity = new Uint32Array([101, 202]);
        const mechanics = new Float32Array(
          particleCount * abi.MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
        );
        for (let index = 0; index < particleCount; index += 1) {
          const phaseId = index === 0 ? 3 : 2;
          const restDensity = index === 0 ? 0.6 : 997;
          thermo.set([
            materialId, phaseId, index === 0 ? 500 : 300, restDensity,
            0, index === 1 ? 1 : 0, index === 0 ? 1 : 0, 0,
            0.25, 1, materialId, 0.001
          ], index * 12);
          const offset = index
            * abi.MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
          mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
          mechanics[offset + 18] = 1;
          mechanics[offset + 19] = 0.001;
          mechanics[offset + 20] = 0;
          mechanics[offset + 21] = 1;
          mechanics[offset + 27] = 1;
          mechanics[offset + 31] = 1;
        }

        const epochIdentity = {
          storageGeneration,
          bufferFamilyGeneration: storageGeneration,
          physicsTick: ratio,
          physicsSubstep: 0,
          positionEpoch: ratio,
          topologyEpoch: ratio,
          chartEpoch: ratio,
          levelEpoch: ratio,
          supportEpoch: ratio
        };
        const sphParticleState = {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          dimension: 3,
          step: ratio,
          time: 0,
          smoothingLengthM: 0.25,
          stateStrideFloats: 8,
          thermoStrideFloats: 12,
          identityStrideUints: 1,
          stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
          thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
          identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
          identitySchema: abi.ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityRequired: true,
          identityRevision: `native-m3-r${ratio}`,
          renderDomainKeys: { 101: 'fine', 202: 'coarse' },
          state,
          thermo,
          identity,
          metadata: [],
          ...epochIdentity
        };
        const mlsMpmParticleState = {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          step: ratio,
          time: 0,
          mechanicsStrideFloats:
            abi.MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length,
          mechanicsStrideBytes:
            abi.MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
            * Float32Array.BYTES_PER_ELEMENT,
          mechanicsDtS: dt,
          mechanicalSubsteps: ratio,
          gridCflFactor: 0.4,
          gravityMPerS2: [0, -9.80665, 0],
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          mechanics,
          metadata: [],
          storageGeneration
        };

        const sphParticleUpload = buffersModule.uploadSphGpuParticleBuffers(
          device,
          sphParticleState
        );
        const mlsMpmParticleUpload =
          buffersModule.uploadMlsMpmGpuParticleBuffers(
            device,
            mlsMpmParticleState
          );
        Object.assign(sphParticleUpload, {
          ...epochIdentity,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1,
          step: ratio,
          time: 0
        });
        Object.assign(mlsMpmParticleUpload, {
          ...epochIdentity,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1,
          step: ratio,
          time: 0
        });

        const assignmentRows = new Float32Array(particleCount * 16);
        for (let index = 0; index < particleCount; index += 1) {
          const level = index;
          const offset = index * 16;
          assignmentRows.set([
            level, 0.25 * (2 ** level), 1, 0.001,
            0.001, 0.001, 1, index === 0 ? 0.6 : 997,
            index === 0 ? 3 : 2, materialId, 1, 0.15,
            state[index * 8], state[index * 8 + 1], state[index * 8 + 2], 0
          ], offset);
        }
        const assignmentBuffer = device.createBuffer({
          label: `native-m3-r${ratio}-assignment`,
          size: assignmentRows.byteLength,
          usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(assignmentBuffer, 0, assignmentRows);
        const levelAssignment = {
          schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount,
          assignmentStrideFloats: 16,
          assignments: assignmentRows,
          assignmentBuffer,
          assignmentBufferByteLength: assignmentRows.byteLength,
          sourceStateBuffer: sphParticleUpload.stateBuffer,
          sourceStateBufferBorrowed: true,
          sourceMechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
          sourceMechanicsBufferBorrowed: true,
          sourceMechanicsBufferByteLength:
            mlsMpmParticleUpload.mechanicsBufferByteLength,
          ...epochIdentity,
          minLevel: 0,
          maxLevel: 1,
          chartId: 0,
          baseGridSpacingM: 0.25
        };

        const fineGrid = gridModule.createMlsMpmGridSpec({
          boxDimsM: [2, 2, 2],
          gridSpacingM: 0.25
        });
        const coarseGrid = gridModule.createMlsMpmGridSpec({
          boxDimsM: [2, 2, 2],
          gridSpacingM: 0.5
        });
        fineGrid.gridShift = fineGrid.shift;
        coarseGrid.gridShift = coarseGrid.shift;
        const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment,
          particleCount,
          particleIdentityBuffer: sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          particleBufferSet: sphParticleUpload,
            mechanicsLevels: [
              { selectedLevel: 0, mechanicsGrid: fineGrid },
              { selectedLevel: 1, mechanicsGrid: coarseGrid }
            ],
            phaseVolumeInterfaceProposalEnabled: true
        });
        requireTrue(
          generation.ready === true && generation.selected === true,
          `r=${ratio} spatial generation rejected: ${generation.status}: `
            + `${generation.reason || 'no reason'}`
        );
        requireTrue(
          generation.parentFieldView && generation.hierarchyView,
          `r=${ratio} generation lacks two-level hierarchy artifacts`
        );
        const directRuntimeEntry = generation.directRuntimeEntry;
        instrumentMechanicsFieldRuntimes(directRuntimeEntry);
        registerGenerationMechanicsFields(
          directRuntimeEntry,
          generation,
          `r${ratio}-initial-generation`
        );
        const transaction =
          transactionModule.createSchroederSpatialEpochTransaction({
            device,
            generation,
            sphParticleUpload,
            mlsMpmParticleUpload,
            twoLevelAuthoritative: true,
            phaseVolumeInterfaceProposalAuthoritative: true,
            enabledConsumerReaderIds: [],
            consumerSupportProfileIds: {}
          });
        const mechanicsMaterialPhaseUpload =
          mechanicsRefreshModule.uploadMlsMpmMechanicsMaterialPhaseRecords(
            device,
            mechanicsMaterialTable
          );
        let controller = null;
      const diagnosticSpatialGenerationRunner = async (options) => {
          const priorGenerationRuntimeSnapshots = [
            ...(directRuntimeEntry.liveGenerations ?? [])
          ].map((liveGeneration) => ({
            generation: liveGeneration,
            snapshot: generationMechanicsFieldRuntimeSnapshot(
              directRuntimeEntry,
              liveGeneration
            )
          }));
          instrumentMechanicsFieldRuntimes(directRuntimeEntry);
          try {
            const refreshedGeneration = await
              spatialModule.runSchroederSpatialEpochGenerationWithBackpressureWebGpu(
                options
              );
            instrumentMechanicsFieldRuntimes(directRuntimeEntry);
            registerGenerationMechanicsFields(
              directRuntimeEntry,
              refreshedGeneration,
              `r${ratio}-refreshed-generation`
            );
            const successorSnapshot = generationMechanicsFieldRuntimeSnapshot(
              directRuntimeEntry,
              refreshedGeneration
            );
            for (const prior of priorGenerationRuntimeSnapshots) {
              for (const priorLevel of prior.snapshot.levels) {
                const successorLevel = successorSnapshot.levels.find(
                  (candidate) => candidate.level === priorLevel.level
                );
                if (
                  !successorLevel
                  || priorLevel.runtime === successorLevel.runtime
                ) {
                  continue;
                }
                let priorRuntimeOwnsExecutionAfterSuccessor = false;
                let successorRuntimeOwnsExecution = false;
                try {
                  priorRuntimeOwnsExecutionAfterSuccessor =
                    priorLevel.runtime?.ownsExecution?.(
                      priorLevel.execution
                    ) === true;
                } catch {
                  priorRuntimeOwnsExecutionAfterSuccessor = false;
                }
                try {
                  successorRuntimeOwnsExecution =
                    successorLevel.runtime?.ownsExecution?.(
                      successorLevel.execution
                    ) === true;
                } catch {
                  successorRuntimeOwnsExecution = false;
                }
                const oldRuntimeRecord = mechanicsFieldRuntimeRecord(
                  directRuntimeEntry,
                  priorLevel.runtime
                );
                const newRuntimeRecord = mechanicsFieldRuntimeRecord(
                  directRuntimeEntry,
                  successorLevel.runtime
                );
                const rollover = {
                  ordinal: ++mechanicsFieldEventOrdinal,
                  ratio: activeDiagnosticRatio,
                  level: priorLevel.level,
                  runtimeKey: oldRuntimeRecord.runtimeKey,
                  priorGenerationId: prior.snapshot.generationId,
                  successorGenerationId: successorSnapshot.generationId,
                  oldRuntimeId: oldRuntimeRecord.runtimeId,
                  newRuntimeId: newRuntimeRecord.runtimeId,
                  oldArenaCount: oldRuntimeRecord.arenaCount,
                  newArenaCount: newRuntimeRecord.arenaCount,
                  priorGenerationStillLive:
                    directRuntimeEntry.liveGenerations.includes(
                      prior.generation
                    ),
                  priorExecutionOwnerRetained:
                    priorLevel.execution?.ownerRuntime === priorLevel.runtime,
                  priorExecutionReleasedAfterSuccessor:
                    priorLevel.execution?.released === true,
                  priorRuntimeOwnsExecutionAfterSuccessor,
                  successorExecutionOwnerExact:
                    successorLevel.execution?.ownerRuntime
                      === successorLevel.runtime,
                  successorRuntimeOwnsExecution,
                  oldActiveAfterSuccessor:
                    priorLevel.runtime?.activeExecutionCount?.() ?? null,
                  newActiveAfterSuccessor:
                    successorLevel.runtime?.activeExecutionCount?.() ?? null,
                  oldDestroyedBeforeSuccessor:
                    oldRuntimeRecord.destroyed === true,
                  newRuntimeCurrentForKey:
                    directRuntimeEntry.mechanicsFieldViewRuntimes.get(
                      newRuntimeRecord.runtimeKey
                    ) === successorLevel.runtime
                };
                mechanicsFieldRuntimeRollovers.push(rollover);
                mechanicsFieldEvents.push({
                  type: 'rollover',
                  ...rollover
                });
              }
            }
            return refreshedGeneration;
          } catch (error) {
            Object.defineProperty(error, 'nativeAllocationBoundary', {
              value: allocationBoundaryDiagnostics(
                directRuntimeEntry,
                controller,
                error
              ),
              enumerable: false,
              configurable: true
            });
            throw error;
          }
        };
        controller =
          hierarchyModule.createSchroederTwoLevelCanonicalEpochController({
            device,
            initialGeneration: generation,
            initialLevelAssignment: levelAssignment,
            initialTransaction: transaction,
            sphParticleState,
            mlsMpmParticleState,
            initialSphParticleUpload: sphParticleUpload,
            initialMlsMpmParticleUpload: mlsMpmParticleUpload,
            fineLevel: 0,
            fineMechanicsGrid: fineGrid,
            coarseMechanicsGrid: coarseGrid,
            boxDimsM: [2, 2, 2],
            phaseVolumeInterfaceTransportEnabled: true,
            spatialEpochGenerationRunner: diagnosticSpatialGenerationRunner,
            mechanicsEpochMode:
              hierarchyModule.SCHROEDER_TWO_LEVEL_CANONICAL_EPOCH_MODE_FUSED_PRIVATE
          });

        const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
        const backends = [];
        const statuses = [];
        const gridUpdateDiagnostics = [];
        const g2pDiagnostics = [];
        let terminalPreWorkspaceLedgerWords = null;
        const workspaceCaptures = [];
        const workspaceCaptureByExecution = new WeakMap();
        const diagnosticWorkspaceRuntimeFactory = (...factoryArgs) => {
          const runtime =
            workspaceModule.createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
              ...factoryArgs
            );
          const encodePredictors = runtime.encodePredictors;
          const encodeFineCorrection = runtime.encodeFineCorrection;
          const encodeCoarseTerminal = runtime.encodeCoarseTerminal;
          runtime.encodePredictors = (...args) => {
            const execution = encodePredictors(...args);
            const capture = {
              kind: 'fine',
              runtime,
              execution,
              update: null
            };
            workspaceCaptures.push(capture);
            workspaceCaptureByExecution.set(execution, capture);
            return execution;
          };
          runtime.encodeFineCorrection = (encoder, execution, options) => {
            const update = encodeFineCorrection(encoder, execution, options);
            const capture = workspaceCaptureByExecution.get(execution);
            if (capture) capture.update = update;
            return update;
          };
          runtime.encodeCoarseTerminal = (...args) => {
            const update = encodeCoarseTerminal(...args);
            const execution =
              update?.parentFieldMechanicsWorkspaceExecution ?? null;
            const capture = {
              kind: 'terminal',
              runtime,
              execution,
              update
            };
            workspaceCaptures.push(capture);
            if (execution) workspaceCaptureByExecution.set(execution, capture);
            return update;
          };
          return runtime;
        };
        let result = null;
        let closure = null;
        let cleanupComplete = false;
        try {
          result = await couplingModule.runSchroederTwoLevelMechanicsStepWebGpu({
            device,
            sphParticleState,
            mlsMpmParticleState,
            sphParticleUpload,
            mlsMpmParticleUpload,
            levelAssignment,
            generation,
            hierarchyView: generation.hierarchyView,
            fineSubstepCount: ratio,
            fineLevel: 0,
            baseGridSpacingM: 0.25,
            boxDimsM: [2, 2, 2],
            dt,
            internalPressureScale: 0,
            ambientPressurePa: 101325,
            mechanicsMaterialTable,
            mechanicsMaterialPhaseUpload,
            phaseVolumePressureScale: 0.01,
            phaseVolumeMaxImpulseFraction: 0.01,
            phaseVolumeInterfaceTransportEnabled: true,
            gridSpecFactory: gridModule.createMlsMpmGridSpec,
            p2gRunner: async (options) => {
              counts.p2g += 1;
              const projection =
                await gridModule.runMlsMpmP2gGridProjectionWebGpu(options);
              backends.push(projection.backend);
              statuses.push(projection.status);
              return projection;
            },
            gridUpdateRunner: async (options) => {
              counts.gridUpdate += 1;
              const update =
                await updateModule.runMlsMpmGridUpdateWebGpu(options);
              const transaction = options.fusedCoarseTerminalTransaction
                ?? options.fusedFineSubstepTransaction
                ?? null;
              const kind = options.fusedCoarseTerminalTransaction
                ? 'terminal-pre-workspace'
                : 'fine-pre-correction';
              const fieldView = options.fusedCoarseTerminalTransaction
                ? transaction?.coarseFieldView
                : transaction?.fineFieldView;
              const ledger = transaction?.refluxLedger ?? null;
              if (fieldView?.fieldViewBuffer && ledger?.buffer) {
                const fieldWords = await readU32Words(
                  fieldView.fieldViewBuffer,
                  fieldView.layout.wordLength,
                  `native-m3-r${ratio}-${kind}-field`
                );
                const ledgerWords = await readU32Words(
                  ledger.buffer,
                  kind === 'terminal-pre-workspace'
                    ? ledger.wordLength
                    : abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
                  `native-m3-r${ratio}-${kind}-ledger`
                );
                if (kind === 'terminal-pre-workspace') {
                  terminalPreWorkspaceLedgerWords = ledgerWords;
                }
                const receiptOffset = fieldView.layout.receiptControlOffsetWords;
                gridUpdateDiagnostics.push({
                  kind,
                  transaction: transactionIdentity(transaction),
                  update: {
                    status: update?.status ?? null,
                    mutationInputOrdinal:
                      update?.mechanicsFieldMutationInputOrdinal ?? null,
                    mutationOutputOrdinal:
                      update?.mechanicsFieldMutationOutputOrdinal ?? null,
                    mutationInputStateEncoding:
                      update?.mechanicsFieldMutationInputStateEncoding ?? null,
                    mutationOutputStateEncoding:
                      update?.mechanicsFieldMutationOutputStateEncoding ?? null,
                    energyReceiptStatus:
                      update?.mechanicsFieldEnergyReceipt?.status ?? null,
                    energyReceiptDeferSeal:
                      update?.mechanicsFieldEnergyReceipt?.deferSeal ?? null
                  },
                  fieldHeaderWords: [...fieldWords.slice(0, 64)],
                  fieldReceiptOffsetWords: receiptOffset,
                  fieldReceiptWords: [
                    ...fieldWords.slice(
                      receiptOffset,
                      receiptOffset + fieldView.layout.receiptControlWords
                    )
                  ],
                  fieldAccumulatorOffsetWords:
                    fieldView.layout.accumulatorOffsetWords,
                  fieldAccumulatorWords: [
                    ...fieldWords.slice(
                      fieldView.layout.accumulatorOffsetWords,
                      fieldView.layout.accumulatorOffsetWords
                        + fieldWords[34] * fieldView.layout.accumulatorWords
                    )
                  ],
                  fieldStateOffsetWords: fieldView.layout.stateOffsetWords,
                  fieldStateWords: [
                    ...fieldWords.slice(
                      fieldView.layout.stateOffsetWords,
                      fieldView.layout.stateOffsetWords
                        + fieldWords[34] * fieldView.layout.stateWords
                    )
                  ],
                  ledgerHeaderWords: [
                    ...ledgerWords.slice(
                      0,
                      abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
                    )
                  ]
                });
              }
              backends.push(update.backend);
              statuses.push(update.status);
              return update;
            },
            g2pRunner: async (options) => {
              counts.g2p += 1;
              const reconstruction =
                await g2pModule.runMlsMpmG2pWebGpu(options);
              const transaction = options.fusedCoarseTerminalTransaction
                ?? options.fusedFineSubstepTransaction
                ?? null;
              const fieldView = options.fusedCoarseTerminalTransaction
                ? transaction?.coarseFieldView
                : transaction?.fineFieldView;
              const ledger = transaction?.refluxLedger ?? null;
              if (fieldView?.fieldViewBuffer && ledger?.buffer) {
                const fieldWords = await readU32Words(
                  fieldView.fieldViewBuffer,
                  fieldView.layout.wordLength,
                  `native-m3-r${ratio}-g2p-field`
                );
                const ledgerWords = await readU32Words(
                  ledger.buffer,
                  abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
                  `native-m3-r${ratio}-g2p-ledger`
                );
                const receiptOffset =
                  fieldView.layout.receiptControlOffsetWords;
                g2pDiagnostics.push({
                  kind: options.fusedCoarseTerminalTransaction
                    ? 'coarse'
                    : 'fine',
                  fieldHeaderWords: [...fieldWords.slice(0, 64)],
                  fieldReceiptWords: [
                    ...fieldWords.slice(
                      receiptOffset,
                      receiptOffset + fieldView.layout.receiptControlWords
                    )
                  ],
                  ledgerHeaderWords: [...ledgerWords]
                });
              }
              const provenance = options.fusedFineSubstepTransaction ? {
                transaction: options.fusedFineSubstepTransaction,
                macroAuthority:
                  options.fusedFineSubstepTransaction.macroAuthority,
                microepochAuthority:
                  options.fusedFineSubstepTransaction.microepochAuthority,
                particleContinuation:
                  options.fusedFineSubstepTransaction.particleContinuation,
                fieldExecution:
                  options.fusedFineSubstepTransaction.fineFieldView,
                priorArtifact: options.gridUpdate,
                proposalMode: 'proposal-deferred-to-post-mechanics'
              } : {
                terminalTransaction: options.fusedCoarseTerminalTransaction,
                macroAuthority:
                  options.fusedCoarseTerminalTransaction.macroAuthority,
                microepochAuthority:
                  options.fusedCoarseTerminalTransaction.microepochAuthority,
                particleContinuation:
                  options.fusedCoarseTerminalTransaction.particleContinuation,
                fieldExecution:
                  options.fusedCoarseTerminalTransaction.coarseFieldView,
                priorArtifact: options.gridUpdate,
                proposalMode: 'proposal-deferred-to-post-mechanics'
              };
              requireTrue(
                g2pModule.validateLocallySubmittedMlsMpmFusedG2p(
                  device,
                  reconstruction,
                  provenance
                ) === true,
                `r=${ratio} G2P lost exact fused producer provenance`
              );
              backends.push(reconstruction.backend);
              statuses.push(reconstruction.status);
              return reconstruction;
            },
            invariantEvidenceRunner: async () => {
              throw new Error('native M3 must not run dense invariant evidence');
            },
            momentumAccumulationRunner: async () => {
              throw new Error('native M3 must not run dense momentum accumulation');
            },
            deltaProlongationRunner: async () => {
              throw new Error('native M3 must not run dense prolongation');
            },
            conservationSummaryRunner: async () => {
              throw new Error('native M3 must not run dense conservation');
            },
            compactSummaryRunner: async () => null,
            parentFieldMechanicsWorkspaceRuntimeFactory:
              diagnosticWorkspaceRuntimeFactory,
            canonicalEpochController: controller,
            postMechanicsConsumerReaderIds: [],
            postMechanicsConsumerSupportProfileIds: {},
            retainOutputParticleBuffers: true,
            conservationSummaryReadback: false,
            invariantEvidenceReadback: false,
            compactSummaryReadback: false
          });
          closure = result.pendingPostMechanicsClosure;
          requireTrue(
            fusedModule.validateSchroederFusedMechanicsPendingClosure(
              device,
              closure
            ) === true,
            `r=${ratio} pending S* closure is not exact`
          );
          requireTrue(
            result.parentFieldMechanicsWorkspaceBuildCount === ratio + 1
              && result.parentFieldMechanicsFineCorrectionCount === ratio
              && result.parentFieldMechanicsCoarseTerminalCount === 1
              && result.parentFieldMechanicsCoarsePublishCount === 0,
            `r=${ratio} parent-field operation counts are not exact`
          );
          requireTrue(
            counts.p2g === 2 * ratio + 1
              && counts.gridUpdate === ratio + 1
              && counts.g2p === ratio + 1,
            `r=${ratio} production runner counts are not exact: `
              + JSON.stringify(counts)
          );
          requireTrue(
            backends.length === counts.p2g + counts.gridUpdate + counts.g2p
              && backends.every((backend) => backend === 'webgpu'),
            `r=${ratio} did not execute only authentic WebGPU runners`
          );
          requireTrue(
            result.canonicalMacroStatus.producerChainAuthenticated === true
              && result.canonicalMacroStatus.operationCount === ratio + 1
              && result.canonicalEpochControllerSummary.epochCount === ratio + 1
              && result.canonicalEpochControllerSummary.committedEpochCount
                === ratio + 1
              && result.canonicalEpochControllerSummary.privateAdvancedEpochCount
                === ratio + 1
              && result.canonicalEpochControllerSummary.publishedEpochCount === 0,
            `r=${ratio} canonical private epoch summary is invalid`
          );
          requireTrue(
            result.postMechanicsEpoch === null
              && !('stateBuffer' in result)
              && !('mechanicsBuffer' in result)
              && !('nextParticleUploads' in result)
              && !('nextSphParticleState' in result)
              && !('nextMlsMpmParticleState' in result)
              && result.destroyOutputParticleBuffers() === false
              && closure.terminalSpatialEpochTransaction.state
                === 'private-advanced',
            `r=${ratio} published an intermediate or generic S* output`
          );

          const finalStateBytes = await readBuffer(
            closure.finalSphParticleUpload.stateBuffer,
            closure.finalSphParticleUpload.stateBufferByteLength,
            `native-m3-r${ratio}-final-state-readback`
          );
          const finalMechanicsBytes = await readBuffer(
            closure.finalMlsMpmParticleUpload.mechanicsBuffer,
            closure.finalMlsMpmParticleUpload.mechanicsBufferByteLength,
            `native-m3-r${ratio}-final-mechanics-readback`
          );
          const compactRefluxEvidenceByteLength =
            abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
              * Uint32Array.BYTES_PER_ELEMENT;
          requireTrue(
            result.invariantEvidenceBufferByteLength
              === compactRefluxEvidenceByteLength,
            `r=${ratio} reflux exposure is not the exact v3 compact header`
          );
          requireTrue(
            Number(result.invariantEvidenceBuffer?.size ?? 0)
              >= result.invariantEvidenceBufferByteLength,
            `r=${ratio} reflux backing ledger is smaller than its compact exposure`
          );
          const invariantBytes = await readBuffer(
            result.invariantEvidenceBuffer,
            result.invariantEvidenceBuffer.size,
            `native-m3-r${ratio}-invariant-readback`
          );
          const finalState = [...new Float32Array(finalStateBytes)];
          const finalMechanics = [...new Float32Array(finalMechanicsBytes)];
          const refluxWords = new Uint32Array(invariantBytes);
          const reflux = abi.decodeSchroederCrossLevelRefluxEvidence(
            refluxWords
          );
          requireTrue(
            finalState.length === state.length
              && finalMechanics.length === mechanics.length
              && finiteArray(finalState)
              && finiteArray(finalMechanics),
            `r=${ratio} final private particle state is non-finite or truncated`
          );
          const finalStateChanged = finalState.some((value, index) => (
            Math.abs(value - state[index]) > 1e-7
          ));
          const refluxValid = Boolean(
            reflux?.structuralValid === true
              && reflux.admitted === true
              && reflux.terminalAdmitted === true
              && reflux.invalidCount === 0
              && reflux.keyMismatchCount === 0
              && reflux.routeRejectCount === 0
              && reflux.failClosed === false
              && reflux.operatorSplit?.valid === true
              && reflux.phaseVolumeTransport?.valid === true
              && reflux.ambientBoundary?.valid === true
              && finiteArray([
                reflux.massResidualKg,
                ...reflux.linearMomentumResidualKgMPerS,
                ...reflux.angularMomentumResidualKgM2PerS,
                reflux.totalEnergyResidualJ,
                reflux.maxFineCflRatio,
                reflux.maxCoarseCflRatio,
                reflux.minimumPublishedInternalEnergyJ
              ])
          );
          const workspaceDiagnostics = [];
          for (let index = 0; index < workspaceCaptures.length; index += 1) {
            const capture = workspaceCaptures[index];
            const execution = capture.execution;
            const workspaceWords = await readU32Words(
              execution.workspaceBuffer,
              capture.kind === 'terminal'
                ? execution.layout.wordLength
                : 104,
              `native-m3-r${ratio}-workspace-${index}`
            );
            workspaceDiagnostics.push({
              index,
              kind: capture.kind,
              released: execution.released === true,
              paramsIdentity: {
                generationId: execution.generationId,
                deviceOrdinal: execution.deviceOrdinal,
                laneOrdinal: execution.laneOrdinal,
                leaseToken: execution.leaseToken,
                sourceFamilyId: execution.sourceFamilyId,
                storageGeneration: execution.storageGeneration,
                physicsTick: execution.physicsTick,
                physicsSubstep: execution.physicsSubstep,
                positionEpoch: execution.positionEpoch,
                topologyEpoch: execution.topologyEpoch,
                chartEpoch: execution.chartEpoch,
                levelEpoch: execution.levelEpoch,
                supportEpoch: execution.supportEpoch,
                completionOrdinal: execution.completionOrdinal,
                parentCompletionOrdinal: execution.parentCompletionOrdinal,
                fineCompletionOrdinal: execution.fineCompletionOrdinal,
                coarseCompletionOrdinal: execution.coarseCompletionOrdinal,
                fineSubstepOrdinal: execution.fineSubstepOrdinal,
                fineSubstepCount: execution.fineSubstepCount,
                terminalOperation: execution.terminalOperation,
                refluxCompletionOrdinal:
                  execution.refluxLedger?.completionOrdinal ?? null,
                refluxMacroOwnerId:
                  execution.refluxLedger?.macroOwnerId ?? null,
                refluxOwnerGeneration:
                  execution.refluxLedger?.ownerGeneration ?? null,
                generation: generationIdentity(
                  capture.kind === 'terminal'
                    ? execution.fusedCoarseTerminalTransaction
                      ?.microepochAuthority?.generation
                    : execution.fusedFineSubstepTransaction
                      ?.microepochAuthority?.generation
                )
              },
              update: {
                status: capture.update?.status ?? null,
                mutationInputOrdinal:
                  capture.update?.mechanicsFieldMutationInputOrdinal ?? null,
                mutationOutputOrdinal:
                  capture.update?.mechanicsFieldMutationOutputOrdinal ?? null,
                energyReceiptStatus:
                  capture.update?.mechanicsFieldEnergyReceipt?.status ?? null,
                energyReceiptDeferSeal:
                  capture.update?.mechanicsFieldEnergyReceipt?.deferSeal ?? null
              },
              workspaceHeaderWords: [...workspaceWords.slice(0, 104)],
              terminalSealEnergy: capture.kind === 'terminal'
                ? terminalSealEnergyDiagnostics(
                    workspaceWords,
                    execution,
                    terminalPreWorkspaceLedgerWords
                  )
                : null
            });
          }
          const terminalSealEnergy = workspaceDiagnostics.find(
            (diagnostic) => diagnostic.kind === 'terminal'
          )?.terminalSealEnergy ?? null;
          const expectedSynchronizationWork = terminalSealEnergy
            ? f32Subtract(
                terminalSealEnergy.actualCoarseEnergy,
                terminalSealEnergy.virtualCoarseEnergy
              )
            : Number.NaN;
          const expectedSynchronizationConditioning = terminalSealEnergy
            ? f32Add(
                terminalSealEnergy.coarseEnergySumAbs,
                terminalSealEnergy.virtualEnergySumAbs
              )
            : Number.NaN;
          const synchronizationTolerance = Math.max(
            8 * 1.175494351e-38,
            1024 * 2 ** -24 * expectedSynchronizationConditioning
          );
          const recomputedSynchronizedResidual = terminalSealEnergy
              ? f32Subtract(
                f32Add(
                  terminalSealEnergy.actualKineticResidual,
                  reflux.internalEnergyDepositJ
                ),
                reflux.operatorSplit.synchronizationWorkJ
              )
            : Number.NaN;
          const synchronizationProof = {
            actualRowDeltaBitsExact: terminalSealEnergy != null
              && refluxWords[29]
                === wordFromF32(terminalSealEnergy.actualCoarseEnergy),
            virtualRowsMatchPreterminalH29: terminalSealEnergy != null
              && Math.abs(
                terminalSealEnergy.virtualCoarseEnergy
                  - terminalSealEnergy.ledgerVirtualCoarseEnergy
              ) <= terminalSealEnergy.virtualEnergyTolerance,
            expectedSynchronizationWork,
            expectedSynchronizationConditioning,
            synchronizationTolerance,
            synchronizationWorkDifference: Math.abs(
              reflux.operatorSplit.synchronizationWorkJ
                - expectedSynchronizationWork
            ),
            synchronizationWorkMatchesRows: Math.abs(
              reflux.operatorSplit.synchronizationWorkJ
                - expectedSynchronizationWork
            ) <= synchronizationTolerance,
            conditioningBitsExact: refluxWords[127]
              === wordFromF32(expectedSynchronizationConditioning),
            synchronizationWorkConditioned:
              Math.abs(reflux.operatorSplit.synchronizationWorkJ)
                <= reflux.operatorSplit.synchronizationConditioningSumAbsJ
                  + reflux.operatorSplit.synchronizationToleranceJ,
            recomputedSynchronizedResidual,
            residualWithinH47:
              Math.abs(recomputedSynchronizedResidual)
                <= reflux.tolerance.totalEnergyJ,
            h31WithinH47:
              reflux.totalEnergyResidualJ <= reflux.tolerance.totalEnergyJ,
            decoderOperatorSplitValid: reflux.operatorSplit.valid === true
          };
          const refluxRowCount = refluxWords[4];
          const refluxRowOffset = refluxWords[6];
          const refluxRowWords = refluxWords[5];
          let coarsePressureRowSum = 0;
          // L1 of the pressure channel. The net compensation is a signed sum
          // over these rows, so this is the magnitude whose f32 accumulation
          // could manufacture or cancel that net value, and it is the correct
          // conditioning for asking whether pressure actually participated.
          let coarsePressureRowAbsSum = 0;
          let coarseDragRowSum = 0;
          let everyCoarseHeatContainsDrag = true;
          const transportRows = [];
          for (let index = 0; index < refluxRowCount; index += 1) {
            const row = refluxRowOffset + index * refluxRowWords;
            const depositedHeatJ = f32FromWord(refluxWords[row + 8]);
            const pressureCompensationJ =
              f32FromWord(refluxWords[row + 16]);
            const dragHeatJ = f32FromWord(refluxWords[row + 17]);
            coarsePressureRowSum = f32Add(
              coarsePressureRowSum,
              pressureCompensationJ
            );
            coarsePressureRowAbsSum = f32Add(
              coarsePressureRowAbsSum,
              Math.abs(pressureCompensationJ)
            );
            coarseDragRowSum = f32Add(coarseDragRowSum, dragHeatJ);
            everyCoarseHeatContainsDrag =
              everyCoarseHeatContainsDrag
              && Number.isFinite(depositedHeatJ)
              && Number.isFinite(dragHeatJ)
              && depositedHeatJ >= dragHeatJ;
            transportRows.push({
              index,
              depositedHeatJ,
              pressureCompensationJ,
              dragHeatJ
            });
          }
          const terminalCapture = workspaceCaptures.find(
            (capture) => capture.kind === 'terminal'
          );
          const terminalGridDiagnostic = gridUpdateDiagnostics.find(
            (diagnostic) => diagnostic.kind === 'terminal-pre-workspace'
          );
          requireTrue(
            terminalCapture?.execution?.coarseFieldView?.fieldViewBuffer
              && terminalGridDiagnostic,
            `r=${ratio} terminal field proof source is missing`
          );
          const finalCoarseFieldView =
            terminalCapture.execution.coarseFieldView;
          const finalCoarseFieldWords = await readU32Words(
            finalCoarseFieldView.fieldViewBuffer,
            finalCoarseFieldView.layout.wordLength,
            `native-m3-r${ratio}-final-coarse-field`
          );
          const finalAccumulatorOffset =
            finalCoarseFieldView.layout.accumulatorOffsetWords;
          const accumulatorWords =
            finalCoarseFieldView.layout.accumulatorWords;
          const finalReceiptOffset =
            finalCoarseFieldView.layout.receiptControlOffsetWords;
          let finalAccumulatorPressureSum = 0;
          let accumulatorPressureRouteExact = true;
          for (let index = 0; index < refluxRowCount; index += 1) {
            const priorPressureBits =
              terminalGridDiagnostic.fieldAccumulatorWords[
                index * accumulatorWords + 3
              ];
            const rowPressureBits = refluxWords[
              refluxRowOffset + index * refluxRowWords + 16
            ];
            const finalPressureBits = finalCoarseFieldWords[
              finalAccumulatorOffset + index * accumulatorWords + 3
            ];
            const expectedFinalPressure = f32Add(
              f32FromWord(priorPressureBits),
              f32FromWord(rowPressureBits)
            );
            accumulatorPressureRouteExact =
              accumulatorPressureRouteExact
              && finalPressureBits === wordFromF32(expectedFinalPressure);
            finalAccumulatorPressureSum = f32Add(
              finalAccumulatorPressureSum,
              f32FromWord(finalPressureBits)
            );
          }
          const finalReceiptPressureBits = [
            finalCoarseFieldWords[finalReceiptOffset + 16],
            finalCoarseFieldWords[finalReceiptOffset + 17]
          ];
          const expectedAmbientImpulseNs = [0, 0, 0];
          let expectedAmbientExternalWorkJ = 0;
          for (const diagnostic of gridUpdateDiagnostics) {
            for (let axis = 0; axis < 3; axis += 1) {
              expectedAmbientImpulseNs[axis] = f32Add(
                expectedAmbientImpulseNs[axis],
                f32FromWord(diagnostic.fieldReceiptWords[20 + axis])
              );
            }
            expectedAmbientExternalWorkJ = f32Add(
              expectedAmbientExternalWorkJ,
              f32FromWord(diagnostic.fieldReceiptWords[23])
            );
          }
          const ambientReceiptBitsExact = [0, 1, 2].every(
            (axis) => refluxWords[132 + axis]
              === wordFromF32(expectedAmbientImpulseNs[axis])
          ) && refluxWords[135] === wordFromF32(
            expectedAmbientExternalWorkJ
          );
          // Same gamma_n model the row/header comparisons above use, applied to
          // the pressure channel's own L1 magnitude.
          const pressureChannelNEpsilon = Math.min(
            0.25,
            Math.max(1, refluxRowCount * (ratio + 1)) * 2 ** -24
          );
          const pressureChannelFloorJ = Math.max(
            8 * 1.175494351e-38,
            (pressureChannelNEpsilon
              / Math.max(1e-20, 1 - pressureChannelNEpsilon))
              * coarsePressureRowAbsSum
          );
          const phaseVolumeTransportProof = {
            // Surfaced so a failing participation predicate shows whether the
            // term is genuinely absent or merely under this ledger's own
            // conditioning tolerance.
            observedFinePressureCompensationJ:
              reflux.phaseVolumeTransport
                .fineCrossLevelPressureCompensationJ,
            observedCoarsePressureCompensationJ:
              reflux.phaseVolumeTransport
                .coarseCrossLevelPressureCompensationJ,
            observedPhaseVolumeToleranceJ:
              reflux.phaseVolumeTransport.toleranceJ,
            observedPressureChannelFloorJ: pressureChannelFloorJ,
            // Condition this on the pressure channel, not on
            // phaseVolumeTransport.toleranceJ. That ledger tolerance tracks
            // total deposited heat (~4e-3 J here, dominated by ordinary
            // local/route heat), which is six orders above the cross-level
            // pressure term, so comparing against it can never succeed and
            // gets further from succeeding as the pressure scale is raised.
            // What "participated" means is that the net compensation survived
            // its own f32 accumulation rather than cancelling into noise.
            pressureParticipated:
              Math.abs(
                reflux.phaseVolumeTransport
                  .fineCrossLevelPressureCompensationJ
              ) + Math.abs(
                reflux.phaseVolumeTransport
                  .coarseCrossLevelPressureCompensationJ
              ) > pressureChannelFloorJ,
            dragParticipated:
              reflux.phaseVolumeTransport.fineCrossLevelDragHeatJ
                + reflux.phaseVolumeTransport.coarseCrossLevelDragHeatJ > 0,
            coarsePressureRowsMatchHeader: measuredClose(
              coarsePressureRowSum,
              reflux.phaseVolumeTransport
                .coarseCrossLevelPressureCompensationJ,
              refluxRowCount * (ratio + 1)
            ),
            coarsePressureRowsBitsExact:
              refluxWords[129] === wordFromF32(coarsePressureRowSum),
            coarseDragRowsMatchHeader: measuredClose(
              coarseDragRowSum,
              reflux.phaseVolumeTransport.coarseCrossLevelDragHeatJ,
              refluxRowCount * (ratio + 1)
            ),
            coarseDragRowsBitsExact:
              refluxWords[131] === wordFromF32(coarseDragRowSum),
            everyCoarseHeatContainsDrag,
            fineDragWithinRoute:
              reflux.phaseVolumeTransport.fineCrossLevelDragHeatJ
                <= reflux.heatSplit.cumulativeFineRouteHeatJ
                  + reflux.phaseVolumeTransport.toleranceJ,
            coarseDragWithinRoute:
              reflux.phaseVolumeTransport.coarseCrossLevelDragHeatJ
                <= reflux.heatSplit.coarseDeferredRouteHeatJ
                  + reflux.phaseVolumeTransport.toleranceJ,
            accumulatorPressureRouteExact,
            finalAccumulatorPressureSum,
            finalReceiptPressureExact:
              finalReceiptPressureBits[0]
                === wordFromF32(finalAccumulatorPressureSum)
              && finalReceiptPressureBits[1]
                === wordFromF32(finalAccumulatorPressureSum),
            fineRouteConsumed: measuredClose(
              reflux.heatSplit.fineParticleConsumedRouteHeatJ,
              reflux.heatSplit.cumulativeFineRouteHeatJ,
              reflux.measuredScale.contributionCount
            ),
            coarseRouteConsumed: measuredClose(
              reflux.heatSplit.coarseParticleConsumedRouteHeatJ,
              reflux.heatSplit.coarseDeferredRouteHeatJ,
              reflux.measuredScale.contributionCount
            ),
            totalHeatConsumed: measuredClose(
              reflux.particleConsumedHeatJ,
              f32Add(
                reflux.internalEnergyDepositJ,
                reflux.heatSplit.cumulativeLocalHeatJ
              ),
              reflux.measuredScale.contributionCount
            ),
            ambientParticipated:
              expectedAmbientImpulseNs.some((value) => value !== 0)
                || expectedAmbientExternalWorkJ !== 0,
            ambientReceiptBitsExact,
            expectedAmbientImpulseNs,
            expectedAmbientExternalWorkJ,
            transportRows
          };

          requireTrue(
            await fusedModule.abandonSchroederFusedMechanicsPendingClosureAfter(
              device,
              closure,
              { reason: new Error(`native M3 r=${ratio} verified cleanup`) }
            ) === true,
            `r=${ratio} pending S* cleanup was not confirmed`
          );
          requireTrue(
            await closure.completionPromise === false
              && await controller.completionPromise() === true,
            `r=${ratio} cleanup completion promises did not converge`
          );
          let replayRejected = false;
          try {
            await fusedModule.abandonSchroederFusedMechanicsPendingClosureAfter(
              device,
              closure,
              { reason: new Error(`native M3 r=${ratio} replay`) }
            );
          } catch {
            replayRejected = true;
          }
          requireTrue(replayRejected, `r=${ratio} cleanup replay was accepted`);
          cleanupComplete = true;
          const postCleanupSpatialDiagnostics = spatialGenerationDiagnostics(
            generation.directRuntimeEntry,
            generation
          );
          const mechanicsFieldRuntimeLifecycleCheckpoint = {
            ratio,
            runtimeCount: mechanicsFieldRuntimeRecords.length,
            rolloverCount: mechanicsFieldRuntimeRollovers.length,
            destroyEventCount: mechanicsFieldEvents.filter(
              (event) => event.type === 'destroy'
            ).length,
            runtimes: mechanicsFieldRuntimeRecords.map(
              mechanicsFieldRuntimeSnapshot
            )
          };

          return {
            ratio,
            durationMs: performance.now() - ratioStartedAt,
            counts,
            backendCount: backends.length,
            statuses,
            operationCount: result.canonicalMacroStatus.operationCount,
            epochCount: result.canonicalEpochControllerSummary.epochCount,
            privateAdvancedEpochCount:
              result.canonicalEpochControllerSummary.privateAdvancedEpochCount,
            publishedEpochCount:
              result.canonicalEpochControllerSummary.publishedEpochCount,
            workspaceBuildCount:
              result.parentFieldMechanicsWorkspaceBuildCount,
            fineCorrectionCount:
              result.parentFieldMechanicsFineCorrectionCount,
            coarseTerminalCount:
              result.parentFieldMechanicsCoarseTerminalCount,
            coarsePublishCount:
              result.parentFieldMechanicsCoarsePublishCount,
            finalState,
            finalStateChanged,
            finalMechanicsFinite: finiteArray(finalMechanics),
            compactRefluxEvidenceByteLength:
              result.invariantEvidenceBufferByteLength,
            fullRefluxEvidenceByteLength: invariantBytes.byteLength,
            gridUpdateDiagnostics,
            g2pDiagnostics,
            workspaceDiagnostics,
            reflux: {
              valid: refluxValid,
              structuralValid: reflux.structuralValid,
              admitted: reflux.admitted,
              terminalAdmitted: reflux.terminalAdmitted,
              failClosed: reflux.failClosed,
              statusFlags: reflux.statusFlags,
              completionOrdinal: reflux.completionOrdinal,
              committedFineSubstepCount: reflux.committedFineSubstepCount,
              consumedFineSubstepCount: reflux.consumedFineSubstepCount,
              phase: reflux.phase,
              terminalReceiptState: reflux.terminalReceiptState,
              terminalReceiptToken: reflux.terminalReceiptToken,
              capturedOperationCount: reflux.capturedOperationCount,
              expectedOperationCount: reflux.expectedOperationCount,
              exactCountStatus: reflux.exactCountStatus,
              publicationStatus: reflux.publicationStatus,
              receiptReplayRejectCount: reflux.receiptRejectCount.replay,
              receiptSkipRejectCount: reflux.receiptRejectCount.skip,
              receiptDuplicateRejectCount: reflux.receiptRejectCount.duplicate,
              mutationRollbackCount: reflux.mutationRollbackCount,
              invalidCount: reflux.invalidCount,
              keyMismatchCount: reflux.keyMismatchCount,
              routeRejectCount: reflux.routeRejectCount,
              massResidualKg: reflux.massResidualKg,
              fineKineticEnergyDeltaJ: reflux.fineKineticEnergyDeltaJ,
              coarseKineticEnergyDeltaJ: reflux.coarseKineticEnergyDeltaJ,
              internalEnergyDepositJ: reflux.internalEnergyDepositJ,
              totalEnergyResidualJ: reflux.totalEnergyResidualJ,
              totalEnergyToleranceJ: reflux.tolerance.totalEnergyJ,
              heatSplit: reflux.heatSplit,
              operatorSplit: reflux.operatorSplit,
              phaseVolumeTransport: reflux.phaseVolumeTransport,
              ambientBoundary: reflux.ambientBoundary,
              phaseVolumeTransportProof,
              synchronizationProof,
              rawHeaderWords: [
                ...refluxWords.slice(
                  0,
                  abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
                )
              ]
            },
            cleanupReplayRejected: replayRejected,
            postCleanupSpatialDiagnostics,
            mechanicsFieldRuntimeLifecycleCheckpoint
          };
        } catch (error) {
          Object.defineProperty(error, 'nativeSpatialDiagnostics', {
            value: spatialGenerationDiagnostics(
              generation.directRuntimeEntry,
              generation
            ),
            enumerable: false
          });
          throw error;
        } finally {
          if (closure && !cleanupComplete) {
            try {
              await fusedModule.abandonSchroederFusedMechanicsPendingClosureAfter(
                device,
                closure,
                { reason: new Error(`native M3 r=${ratio} failure cleanup`) }
              );
            } catch {
              // Preserve the original native failure.
            }
          }
          assignmentBuffer.destroy();
          buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
          buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
          mechanicsRefreshModule.destroyMlsMpmMechanicsMaterialPhaseUpload(
            mechanicsMaterialPhaseUpload
          );
        }
      };

      const diagnosticErrorChain = (originatingError) => {
        const chain = [];
        const seen = new Set();
        let error = originatingError;
        while (error && !seen.has(error) && chain.length < 5) {
          seen.add(error);
          chain.push({
            name: error.name ?? null,
            message: error.message ?? String(error),
            code: error.code ?? null,
            arenaCapacity: error.arenaCapacity ?? null,
            liveGenerationCount: error.liveGenerationCount ?? null,
            releaseDiagnostics: error.releaseDiagnostics ?? null,
            nativeSpatialDiagnostics: error.nativeSpatialDiagnostics ?? null,
            nativeAllocationBoundary: error.nativeAllocationBoundary ?? null,
            refreshCleanupError: error.schroederRefreshCleanupError
              ? {
                  message: error.schroederRefreshCleanupError.message
                    ?? String(error.schroederRefreshCleanupError),
                  code: error.schroederRefreshCleanupError.code ?? null
                }
              : null
          });
          error = error.cause;
        }
        return chain;
      };
      const ratios = [];
      for (const ratio of requestedRatios) {
        try {
          ratios.push(await runRatio(ratio));
        } catch (error) {
          throw new Error(
            `native M3 r=${ratio} failed: ${error?.message || String(error)}; `
              + `deviceLost=${JSON.stringify(deviceLost)}; `
              + `diagnostics=${JSON.stringify(diagnosticErrorChain(error))}`,
            { cause: error }
          );
        }
      }
      await device.queue.onSubmittedWorkDone();
      await Promise.resolve();
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const runtimeGroups = new Map();
      for (const record of mechanicsFieldRuntimeRecords) {
        const group = runtimeGroups.get(record.runtimeKey) ?? [];
        group.push(record.runtimeId);
        runtimeGroups.set(record.runtimeKey, group);
      }
      const mechanicsFieldRuntimeLifecycle = {
        exactArenaCount: 3,
        runtimeCount: mechanicsFieldRuntimeRecords.length,
        rolloverCount: mechanicsFieldRuntimeRollovers.length,
        rollovers: mechanicsFieldRuntimeRollovers,
        destroyEvents: mechanicsFieldEvents.filter(
          (event) => event.type === 'destroy'
        ),
        runtimes: mechanicsFieldRuntimeRecords.map(
          mechanicsFieldRuntimeSnapshot
        ),
        runtimeGroups: [...runtimeGroups.entries()].map(
          ([runtimeKey, runtimeIds]) => ({ runtimeKey, runtimeIds })
        )
      };
      return {
        status: 'complete',
        adapter: {
          vendor: adapter.info?.vendor || null,
          architecture: adapter.info?.architecture || null,
          device: adapter.info?.device || null,
          description: adapter.info?.description || null
        },
        ratios,
        mechanicsFieldRuntimeLifecycle,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    }, REQUESTED_RATIOS);
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native, null, 2));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native, null, 2));
  assert.deepEqual(
    native.ratios.map(({ ratio }) => ratio),
    REQUESTED_RATIOS
  );
  console.log('native M3 strict evidence', JSON.stringify({
    adapter: native.adapter,
    ratios: native.ratios.map((result) => ({
      ratio: result.ratio,
      durationMs: result.durationMs,
      counts: result.counts,
      operationCount: result.operationCount,
      epochCount: result.epochCount,
      workspaceBuildCount: result.workspaceBuildCount,
      compactRefluxEvidenceByteLength:
        result.compactRefluxEvidenceByteLength,
      fullRefluxEvidenceByteLength: result.fullRefluxEvidenceByteLength,
      reflux: {
        statusFlags: result.reflux.statusFlags,
        phase: result.reflux.phase,
        capturedOperationCount: result.reflux.capturedOperationCount,
        expectedOperationCount: result.reflux.expectedOperationCount,
        totalEnergyResidualJ: result.reflux.totalEnergyResidualJ,
        totalEnergyToleranceJ: result.reflux.totalEnergyToleranceJ,
        operatorSplit: result.reflux.operatorSplit,
        synchronizationProof: result.reflux.synchronizationProof
      },
      cleanupLiveGenerationCount:
        result.postCleanupSpatialDiagnostics.liveGenerationCount
    })),
    runtimeLifecycle: {
      runtimeCount: native.mechanicsFieldRuntimeLifecycle.runtimeCount,
      rolloverCount: native.mechanicsFieldRuntimeLifecycle.rolloverCount,
      destroyEventCount:
        native.mechanicsFieldRuntimeLifecycle.destroyEvents.length,
      rollovers: native.mechanicsFieldRuntimeLifecycle.rollovers.map(
        (rollover) => ({
          ratio: rollover.ratio,
          level: rollover.level,
          oldRuntimeId: rollover.oldRuntimeId,
          newRuntimeId: rollover.newRuntimeId
        })
      )
    }
  }));
  const runtimeLifecycle = native.mechanicsFieldRuntimeLifecycle;
  assert.equal(runtimeLifecycle.exactArenaCount, 3);
  assert.equal(
    runtimeLifecycle.runtimes.every((runtime) => runtime.arenaCount === 3),
    true,
    'mechanics-field rollover increased the fixed three-arena capacity'
  );
  for (const destroyEvent of runtimeLifecycle.destroyEvents) {
    assert.equal(
      destroyEvent.activeBefore,
      0,
      `runtime ${destroyEvent.runtimeId} was destroyed with a live execution`
    );
    assert.equal(destroyEvent.succeeded, true);
    assert.equal(destroyEvent.result, true);
    assert.equal(destroyEvent.activeAfter, 0);
  }
  for (const rollover of runtimeLifecycle.rollovers) {
    assert.notEqual(rollover.oldRuntimeId, rollover.newRuntimeId);
    assert.equal(rollover.oldArenaCount, 3);
    assert.equal(rollover.newArenaCount, 3);
    assert.equal(rollover.priorGenerationStillLive, true);
    assert.equal(rollover.priorExecutionOwnerRetained, true);
    assert.equal(rollover.priorExecutionReleasedAfterSuccessor, false);
    assert.equal(rollover.priorRuntimeOwnsExecutionAfterSuccessor, true);
    assert.equal(rollover.successorExecutionOwnerExact, true);
    assert.equal(rollover.successorRuntimeOwnsExecution, true);
    assert.equal(rollover.oldDestroyedBeforeSuccessor, false);
    assert.equal(rollover.newRuntimeCurrentForKey, true);
    assert.ok(rollover.oldActiveAfterSuccessor >= 1);
    assert.ok(rollover.newActiveAfterSuccessor >= 1);
  }
  for (const result of native.ratios) {
    const ratio = result.ratio;
    assert.deepEqual(result.counts, {
      p2g: 2 * ratio + 1,
      gridUpdate: ratio + 1,
      g2p: ratio + 1
    });
    assert.equal(result.operationCount, ratio + 1);
    assert.equal(result.epochCount, ratio + 1);
    assert.equal(result.privateAdvancedEpochCount, ratio + 1);
    assert.equal(result.publishedEpochCount, 0);
    assert.equal(result.workspaceBuildCount, ratio + 1);
    assert.equal(result.fineCorrectionCount, ratio);
    assert.equal(result.coarseTerminalCount, 1);
    assert.equal(result.coarsePublishCount, 0);
    assert.equal(result.finalState.every(Number.isFinite), true);
    assert.equal(
      result.finalStateChanged,
      true,
      JSON.stringify(result, null, 2)
    );
    assert.equal(result.finalMechanicsFinite, true);
    assert.equal(result.reflux.valid, true, JSON.stringify(result, null, 2));
    assert.equal(result.reflux.structuralValid, true);
    assert.equal(result.reflux.admitted, true);
    assert.equal(result.reflux.terminalAdmitted, true);
    assert.equal(result.reflux.failClosed, false);
    assert.equal(result.reflux.invalidCount, 0);
    assert.equal(result.reflux.keyMismatchCount, 0);
    assert.equal(result.reflux.routeRejectCount, 0);
    assert.equal(result.reflux.committedFineSubstepCount, ratio);
    assert.equal(result.reflux.consumedFineSubstepCount, ratio);
    assert.equal(result.reflux.capturedOperationCount, ratio + 1);
    assert.equal(result.reflux.expectedOperationCount, ratio + 1);
    assert.equal(result.reflux.phase, 6);
    assert.equal(result.reflux.operatorSplit.valid, true);
    assert.equal(result.reflux.phaseVolumeTransport.valid, true);
    assert.equal(result.reflux.ambientBoundary.valid, true);
    const transportProof = result.reflux.phaseVolumeTransportProof;
    for (const predicate of [
      'pressureParticipated',
      'dragParticipated',
      'coarsePressureRowsMatchHeader',
      'coarseDragRowsMatchHeader',
      'everyCoarseHeatContainsDrag',
      'fineDragWithinRoute',
      'coarseDragWithinRoute',
      'accumulatorPressureRouteExact',
      'finalReceiptPressureExact',
      'fineRouteConsumed',
      'coarseRouteConsumed',
      'totalHeatConsumed',
      'ambientParticipated',
      'ambientReceiptBitsExact'
    ]) {
      assert.equal(
        transportProof[predicate],
        true,
        `r=${ratio} Slice 9 proof failed: ${predicate}; `
          + JSON.stringify(transportProof, null, 2)
      );
    }
    if (ratio === 1) {
      assert.equal(transportProof.coarsePressureRowsBitsExact, true);
      assert.equal(transportProof.coarseDragRowsBitsExact, true);
    }
    assert.deepEqual(
      result.reflux.ambientBoundary.cumulativeImpulseNs,
      transportProof.expectedAmbientImpulseNs
    );
    assert.equal(
      result.reflux.ambientBoundary.cumulativeExternalWorkJ,
      transportProof.expectedAmbientExternalWorkJ
    );
    assert.equal(
      result.reflux.synchronizationProof.actualRowDeltaBitsExact,
      true
    );
    assert.equal(
      result.reflux.synchronizationProof.virtualRowsMatchPreterminalH29,
      true
    );
    assert.equal(
      result.reflux.synchronizationProof.synchronizationWorkMatchesRows,
      true
    );
    assert.equal(
      result.reflux.synchronizationProof.conditioningBitsExact,
      true
    );
    assert.equal(
      result.reflux.synchronizationProof.synchronizationWorkConditioned,
      true
    );
    assert.equal(
      result.reflux.synchronizationProof.residualWithinH47,
      true
    );
    assert.equal(result.reflux.synchronizationProof.h31WithinH47, true);
    assert.equal(
      result.reflux.synchronizationProof.decoderOperatorSplitValid,
      true
    );
    assert.equal(result.cleanupReplayRejected, true);
    assert.equal(result.postCleanupSpatialDiagnostics.liveGenerationCount, 0);
    assert.equal(
      result.mechanicsFieldRuntimeLifecycleCheckpoint.runtimes.every(
        (runtime) => runtime.arenaCount === 3
          && runtime.activeExecutionCount === 0
      ),
      true
    );
  }
  if (REQUESTED_RATIOS.join(',') === '1,2,3,4') {
    assert.equal(runtimeLifecycle.runtimeCount, 4);
    assert.equal(runtimeLifecycle.rolloverCount, 2);
    assert.equal(runtimeLifecycle.destroyEvents.length, 2);
    assert.equal(runtimeLifecycle.runtimeGroups.length, 2);
    assert.equal(
      runtimeLifecycle.runtimeGroups.every(
        (group) => group.runtimeIds.length === 2
      ),
      true
    );
    assert.deepEqual(
      runtimeLifecycle.rollovers.map(({ ratio, level }) => ({ ratio, level })),
      [{ ratio: 3, level: 0 }, { ratio: 3, level: 1 }]
    );
    for (const rollover of runtimeLifecycle.rollovers) {
      const destroyEvent = runtimeLifecycle.destroyEvents.find(
        (event) => event.runtimeId === rollover.oldRuntimeId
      );
      assert.ok(destroyEvent);
      assert.ok(destroyEvent.ordinal > rollover.ordinal);
    }
    const checkpoints = new Map(native.ratios.map((result) => [
      result.ratio,
      result.mechanicsFieldRuntimeLifecycleCheckpoint
    ]));
    const currentRuntimeShape = (ratio) => checkpoints.get(ratio).runtimes
      .filter((runtime) => runtime.currentForKey)
      .map((runtime) => ({
        active: runtime.activeExecutionCount,
        usable: runtime.usableArenaCount,
        retired: runtime.retiredArenaCount,
        destroyed: runtime.destroyed
      }));
    assert.deepEqual(currentRuntimeShape(1), [
      { active: 0, usable: 2, retired: 1, destroyed: false },
      { active: 0, usable: 2, retired: 1, destroyed: false }
    ]);
    assert.deepEqual(currentRuntimeShape(2), [
      { active: 0, usable: 1, retired: 2, destroyed: false },
      { active: 0, usable: 1, retired: 2, destroyed: false }
    ]);
    assert.deepEqual(currentRuntimeShape(3), [
      { active: 0, usable: 2, retired: 1, destroyed: false },
      { active: 0, usable: 2, retired: 1, destroyed: false }
    ]);
    assert.deepEqual(currentRuntimeShape(4), [
      { active: 0, usable: 1, retired: 2, destroyed: false },
      { active: 0, usable: 1, retired: 2, destroyed: false }
    ]);
    assert.deepEqual(
      native.ratios.map((result) => ({
        ratio: result.ratio,
        runtimeCount:
          result.mechanicsFieldRuntimeLifecycleCheckpoint.runtimeCount,
        rolloverCount:
          result.mechanicsFieldRuntimeLifecycleCheckpoint.rolloverCount,
        destroyEventCount:
          result.mechanicsFieldRuntimeLifecycleCheckpoint.destroyEventCount
      })),
      [
        { ratio: 1, runtimeCount: 2, rolloverCount: 0, destroyEventCount: 0 },
        { ratio: 2, runtimeCount: 2, rolloverCount: 0, destroyEventCount: 0 },
        { ratio: 3, runtimeCount: 4, rolloverCount: 2, destroyEventCount: 2 },
        { ratio: 4, runtimeCount: 4, rolloverCount: 2, destroyEventCount: 2 }
      ]
    );
  }
});
