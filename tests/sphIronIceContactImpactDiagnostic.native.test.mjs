import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC === '1';
const NATIVE_BASE_URL =
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_BASE_URL
  || 'https://127.0.0.1:5174/';
const STEP_COUNT = Math.max(
  2,
  Math.round(Number(
    process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS
  ) || 64)
);
const HYDROSTATIC_INITIALIZATION =
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_HYDRO_INIT;
const SURFACE_TENSION_LAW =
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_SURFACE_TENSION;
const requestedSurfaceMaxImpulseFraction = Number(
  process.env
    .ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_SURFACE_MAX_IMPULSE_FRACTION
);
const SURFACE_MAX_IMPULSE_FRACTION =
  Number.isFinite(requestedSurfaceMaxImpulseFraction)
  && requestedSurfaceMaxImpulseFraction >= 0
    ? requestedSurfaceMaxImpulseFraction
    : null;
const requestedIronHeightScale = Number(
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_IRON_HEIGHT
);
const IRON_HEIGHT_SCALE = Number.isFinite(requestedIronHeightScale)
  && requestedIronHeightScale > 0
  ? requestedIronHeightScale
  : null;
const requestedBaseTemperatureK = Number(
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_BASE_TEMPERATURE_K
);
const BASE_TEMPERATURE_K = Number.isFinite(requestedBaseTemperatureK)
  && requestedBaseTemperatureK > 0
  ? requestedBaseTemperatureK
  : null;
const requestedDropParticlesPerEdge = Math.round(Number(
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_DROP_PARTICLES_PER_EDGE
));
const DROP_PARTICLES_PER_EDGE = Number.isSafeInteger(
  requestedDropParticlesPerEdge
)
  && requestedDropParticlesPerEdge >= 1
  && requestedDropParticlesPerEdge <= 128
  ? requestedDropParticlesPerEdge
  : null;
const PROFILE_STATE_STEP_LIMIT = 4;
const requestedProfileStateSteps =
  String(
    process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_PROFILE_STATE_STEPS
    || ''
  )
    .split(',')
    .map((value) => Math.round(Number(value)))
    .filter((value, index, values) => (
      Number.isSafeInteger(value)
      && value >= 1
      && value <= STEP_COUNT
      && values.indexOf(value) === index
    ));
if (requestedProfileStateSteps.length > PROFILE_STATE_STEP_LIMIT) {
  throw new RangeError(
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_PROFILE_STATE_STEPS '
      + `accepts at most ${PROFILE_STATE_STEP_LIMIT} unique checkpoints`
  );
}
const PROFILE_STATE_STEPS = Object.freeze(requestedProfileStateSteps);
const STAR_PROFILE_STEP_LIMIT = 4;
const requestedStarProfileSteps =
  String(
    process.env
      .ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STAR_PROFILE_STEPS
    || ''
  )
    .split(',')
    .map((value) => Math.round(Number(value)))
    .filter((value, index, values) => (
      Number.isSafeInteger(value)
      && value >= 1
      && value <= STEP_COUNT
      && values.indexOf(value) === index
    ));
if (requestedStarProfileSteps.length > STAR_PROFILE_STEP_LIMIT) {
  throw new RangeError(
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STAR_PROFILE_STEPS '
      + `accepts at most ${STAR_PROFILE_STEP_LIMIT} unique checkpoints`
  );
}
const STAR_PROFILE_STEPS = Object.freeze(requestedStarProfileSteps);
const TRACE_STEP_LIMIT = 4;
const requestedTraceSteps =
  String(
    process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_STEPS
    || ''
  )
    .split(',')
    .map((value) => Math.round(Number(value)))
    .filter((value, index, values) => (
      Number.isSafeInteger(value)
      && value >= 1
      && value <= STEP_COUNT
      && values.indexOf(value) === index
    ));
if (requestedTraceSteps.length > TRACE_STEP_LIMIT) {
  throw new RangeError(
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_STEPS '
      + `accepts at most ${TRACE_STEP_LIMIT} unique checkpoints`
  );
}
const TRACE_STEPS = Object.freeze(requestedTraceSteps);
const traceTargetSpec = String(
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_TARGETS
  || ''
).trim();
const requestedTraceTargets = traceTargetSpec === ''
  ? []
  : traceTargetSpec.split(';').map((group, groupIndex) => {
      const targets = group.split(':').map((value) => Number(value));
      if (
        targets.length !== 2
        || targets.some((value) => (
          !Number.isSafeInteger(value)
          || value < 0
          || value > 0xffff_ffff
        ))
        || targets[0] === targets[1]
      ) {
        throw new RangeError(
          'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_TARGETS '
            + `group ${groupIndex + 1} must be two distinct u32 indices`
        );
      }
      return Object.freeze(targets);
    });
if (
  requestedTraceTargets.length > 0
  && requestedTraceTargets.length !== TRACE_STEPS.length
) {
  throw new RangeError(
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_TARGETS '
      + 'must provide one semicolon-delimited pair per trace step'
  );
}
const TRACE_TARGETS = Object.freeze(requestedTraceTargets);
const DEFAULT_NATIVE_TIMEOUT_MS =
  STEP_COUNT >= 1927
    ? 2_700_000
    : STEP_COUNT >= 1024
      ? 1_800_000
      : STEP_COUNT >= 497
        ? 900_000
        : 300_000;
const requestedNativeTimeoutMs = Number(
  process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TIMEOUT_MS
);
const NATIVE_TIMEOUT_MS = Number.isFinite(requestedNativeTimeoutMs)
  && requestedNativeTimeoutMs > 0
  ? Math.max(
      DEFAULT_NATIVE_TIMEOUT_MS,
      Math.round(requestedNativeTimeoutMs)
    )
  : DEFAULT_NATIVE_TIMEOUT_MS;
const NATIVE_SCENE_READY_TIMEOUT_MS = 45_000;
const NATIVE_MOUNT_IDLE_TIMEOUT_MS = 15_000;
const NATIVE_STAGE_PREFIX = 'ulg-iron-ice-native-stage:';
const requestedResidentHostSubmissionBudgetMs = Number(
  process.env
    .ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_MAX_RESIDENT_HOST_SUBMISSION_MS
);
// This is a post-run host regression assertion, not a GPU-runtime watchdog.
const MAX_RESIDENT_HOST_SUBMISSION_MS =
  Number.isFinite(requestedResidentHostSubmissionBudgetMs)
  && requestedResidentHostSubmissionBudgetMs > 0
    ? Math.round(requestedResidentHostSubmissionBudgetMs)
    : null;

test('native mounted iron/ice impact contact diagnostic', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC=1 for native WebGPU',
  timeout: NATIVE_TIMEOUT_MS
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath:
      process.env.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_CHROME
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
    const browserDiagnostics = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith(NATIVE_STAGE_PREFIX)) {
        process.stdout.write(`# ${text}\n`);
      }
      if (message.type() === 'error' || message.type() === 'warning') {
        browserDiagnostics.push({
          kind: `console-${message.type()}`,
          text
        });
      }
    });
    page.on('pageerror', (error) => {
      browserDiagnostics.push({
        kind: 'pageerror',
        text: error?.message || String(error)
      });
    });
    const scenarioUrl = new URL(
      '/?scenario=iron-ice-quench'
        + '&renderer=native-webgpu'
        + '&renderOwnership=main-thread-renderer'
        + '&surfaceDraw=native-webgpu-surface-consumer'
        + '&ss=1'
        // Diagnostic context: declare the batch cleanup horizon explicitly.
        // The demo route otherwise presets the interactive 512-pass budget,
        // which cannot cover the measured ~890-pass contact-chain worst case
        // this diagnostic exists to exercise.
        + '&contactCleanupPasses=1024'
        + '&contactJacobiIterations=16'
        + '&schroederLevel=0'
        + '&schroederMinLevel=0'
        + '&schroederMaxLevel=0'
        + '&schroederPortableSummary=1'
        + '&schroederActiveNodeIndex=1'
        + '&schroederTwoLevel=0'
        + '&schroederCrossLevelCoupling=0'
        + '&schroederPhaseVolumeMigration=1'
        + '&schroederLawQueue=1'
        + '&schroederLawNeighborCandidates=1'
        + (
          HYDROSTATIC_INITIALIZATION == null
            ? ''
            : `&hydroInit=${
              HYDROSTATIC_INITIALIZATION === '0'
              || HYDROSTATIC_INITIALIZATION === 'false'
                ? '0'
                : '1'
            }`
        )
        + (
          SURFACE_TENSION_LAW == null
            ? ''
            : `&lawst=${
              SURFACE_TENSION_LAW === '0'
              || SURFACE_TENSION_LAW === 'false'
                ? '0'
                : '1'
            }`
        )
        + (
          IRON_HEIGHT_SCALE == null
            ? ''
            : `&ironh=${IRON_HEIGHT_SCALE}`
        )
        + (
          BASE_TEMPERATURE_K == null
            ? ''
            : `&baset=${BASE_TEMPERATURE_K}`
        )
        + (
          DROP_PARTICLES_PER_EDGE == null
            ? ''
            : `&dropn=${DROP_PARTICLES_PER_EDGE}`
        )
        + '&residentAuto=0',
      NATIVE_BASE_URL
    ).toString();
    await page.goto(scenarioUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    process.stdout.write(`# ${NATIVE_STAGE_PREFIX}dom-content-loaded\n`);
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      return Boolean(
        overlay?.__sphScene?.getSphGpuParticleState?.()?.schema
      );
    }, null, { timeout: NATIVE_SCENE_READY_TIMEOUT_MS });
    process.stdout.write(`# ${NATIVE_STAGE_PREFIX}scene-ready\n`);
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      return !overlay?.__mlsMpmResidentStepsPending;
    }, null, { timeout: NATIVE_MOUNT_IDLE_TIMEOUT_MS });
    process.stdout.write(`# ${NATIVE_STAGE_PREFIX}mount-idle\n`);

    native = await page.evaluate(async ({
      stepCount,
      profileStateSteps,
      starProfileSteps,
      traceSteps,
      traceTargets,
      surfaceMaxImpulseFraction
    }) => {
      console.info('ulg-iron-ice-native-stage:evaluation-start');
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      if (!scene?.refreshMlsMpmResidentSteps) {
        return {
          status: 'unavailable',
          reason: 'mounted scene resident-step API unavailable'
        };
      }
      // The mounted scene reaches its resident-step and proposal modules
      // through Vite's transformed dependency URLs.  Do not inject a runner
      // from a bare proposal URL: a `?t` split would duplicate the private
      // buffer/device and epoch-authority maps used by the proposal contract.
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const { source, url } of sources) {
          const match = source.match(new RegExp(
            `[\"']([^\"']*${escaped}(?:\\?[^\"']*)?)[\"']`
          ));
          if (match) return new URL(match[1], new URL(url, location.href)).href;
        }
        throw new Error(`Vite dependency URL not found for ${path}`);
      };
      const sceneModuleUrl = '/src/visualization/sphPhaseScene.js';
      const sceneModuleSource = await fetch(sceneModuleUrl).then((response) => {
        if (!response.ok) {
          throw new Error(`mounted scene module fetch failed: ${response.status}`);
        }
        return response.text();
      });
      const residentStepModuleUrl = dependencyUrl(
        [{ source: sceneModuleSource, url: sceneModuleUrl }],
        '/sphMlsMpmGpuStep.js'
      );
      const residentStepModuleSource = await fetch(residentStepModuleUrl).then(
        (response) => {
          if (!response.ok) {
            throw new Error(
              `resident-step module fetch failed: ${response.status}`
            );
          }
          return response.text();
        }
      );
      const proposalModuleUrl = dependencyUrl(
        [{ source: residentStepModuleSource, url: residentStepModuleUrl }],
        '/schroederSpatialMechanicalProposalsGpu.js'
      );
      const gridUpdateModuleUrl = dependencyUrl(
        [{ source: residentStepModuleSource, url: residentStepModuleUrl }],
        '/sphGridUpdateGpuKernel.js'
      );
      const proposalModuleSource = await fetch(proposalModuleUrl).then(
        (response) => {
          if (!response.ok) {
            throw new Error(
              `mechanical proposal module fetch failed: ${response.status}`
            );
          }
          return response.text();
        }
      );
      const spatialEpochModuleUrl = dependencyUrl(
        [{ source: proposalModuleSource, url: proposalModuleUrl }],
        '/schroederSpatialEpochGpu.js'
      );
      const deviceIdentityModuleUrl = dependencyUrl(
        [{ source: proposalModuleSource, url: proposalModuleUrl }],
        '/sphGpuDeviceIdentity.js'
      );
      const [
        proposalModule,
        thermalProposalModule,
        spatialEpochModule,
        deviceIdentityModule,
        gridUpdateModule
      ] = await Promise.all([
        import(proposalModuleUrl),
        import('/src/runtime/sph/schroederSpatialThermalProposalsGpu.js'),
        // Import the exact transformed dependencies as part of the same graph
        // before the injected runner is invoked. Their module instances carry
        // the private identity authority used by proposal construction.
        import(spatialEpochModuleUrl),
        import(deviceIdentityModuleUrl),
        import(gridUpdateModuleUrl)
      ]);
      // Keep the exact transformed modules live in this evaluation scope. The
      // proposal runner above shares their browser module instances.
      void spatialEpochModule;
      void deviceIdentityModule;
      const pairGraphAbi = await import(
        '/ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js'
      );
      const controlWord =
        pairGraphAbi.SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD;
      const solverIterationCount =
        proposalModule.SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
      const matchingCleanupPassCount =
        proposalModule.SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
      const velocityResidualToleranceMPerS =
        proposalModule
          .SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S;
      const targetedTraceEnabled =
        traceTargets.length > 0
        && traceTargets.length === traceSteps.length;
      const diagnosticTraceBytes = targetedTraceEnabled
        ? proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES
        : proposalModule.SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES;
      const diagnosticTraceWords = targetedTraceEnabled
        ? proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS
        : proposalModule.SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS;
      const deepDiagnosticCaptureRequested = Boolean(
        profileStateSteps.length > 0
        || starProfileSteps.length > 0
        || traceSteps.length > 0
      );
      const mechanicalProposalCapture = deepDiagnosticCaptureRequested
        ? null
        : proposalModule.createSchroederSpatialMechanicalProposalCapture({
            sequenceStepCount: stepCount
          });
      let observedProposal = null;
      let observedThermalProposal = null;
      let previousObservedThermalProposal = null;
      let observedDevice = null;
      let proposalHistoryBuffer = null;
      let mechanicalSnapshotStateBuffer = null;
      let mechanicalSnapshotThermoBuffer = null;
      let mechanicalSnapshotMechanicsBuffer = null;
      let mechanicalSnapshotIdentityBuffer = null;
      let mechanicalProposalCaptureLayout = null;
      let profiledStateBuffer = null;
      let profiledMechanicsBuffer = null;
      let profiledTerminalStateBuffer = null;
      let profiledTerminalMechanicsBuffer = null;
      let profiledTerminalThermoBuffer = null;
      let profiledThermalRowsBuffer = null;
      let profiledInterfaceReceiptBuffer = null;
      let profiledInterfaceReceiptByteLength = 0;
      let profiledMechanicsFieldBuffer = null;
      let profiledMechanicsFieldStrideByteLength = 0;
      let starProfileScratchBBuffer = null;
      let starProfileMechanicsBuffer = null;
      let starProfileSourceOffsetsBuffer = null;
      let starProfileDirectedPeersBuffer = null;
      let starProfileGraphControlBuffer = null;
      let starProfileMatchingControlBuffer = null;
      let starProfileStateStrideByteLength = 0;
      let starProfileMechanicsStrideByteLength = 0;
      let starProfileSourceOffsetsStrideByteLength = 0;
      let starProfileDirectedPeersStrideByteLength = 0;
      let starProfileGraphControlStrideByteLength = 0;
      let starProfileMatchingControlStrideByteLength = 0;
      let observedGridUpdateCount = 0;
      const profiledMechanicsFieldMetadata = profileStateSteps.map(() => null);
      let diagnosticTraceBuffer = null;
      const profiledCapture = {
        matchedState: profileStateSteps.map(() => false),
        mechanics: profileStateSteps.map(() => false),
        terminalState: profileStateSteps.map(() => false),
        terminalMechanics: profileStateSteps.map(() => false),
        terminalThermo: profileStateSteps.map(() => false),
        thermalRows: profileStateSteps.map(() => false),
        interfaceReceipt: profileStateSteps.map(() => false),
        mechanicsField: profileStateSteps.map(() => false),
        thermalDtS: profileStateSteps.map(() => null)
      };
      const starProfileCapture = starProfileSteps.map(() => false);
      const observedGridUpdateRunner = async (options) => {
        const update = await gridUpdateModule.runMlsMpmGridUpdateWebGpu(
          options
        );
        const step = observedGridUpdateCount + 1;
        observedGridUpdateCount += 1;
        const profileSlot = profileStateSteps.indexOf(step);
        if (profileSlot < 0) return update;
        const fieldBuffer = update.mechanicsFieldViewBuffer;
        const fieldByteLength = Number(update.mechanicsFieldViewByteLength);
        if (!fieldBuffer || !(fieldByteLength > 0)) {
          profiledMechanicsFieldMetadata[profileSlot] = {
            available: false,
            reason: 'mechanics-field-view-unavailable'
          };
          return update;
        }
        if (!profiledMechanicsFieldBuffer) {
          profiledMechanicsFieldStrideByteLength = fieldByteLength;
          profiledMechanicsFieldBuffer = options.device.createBuffer({
            label: 'iron-ice-impact-profiled-mechanics-field-snapshots',
            size: profileStateSteps.length * fieldByteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          });
        }
        if (fieldByteLength !== profiledMechanicsFieldStrideByteLength) {
          throw new Error(
            `profiled step ${step} mechanics field layout changed`
          );
        }
        const encoder = options.device.createCommandEncoder({
          label: `iron-ice-impact-profiled-mechanics-field-step-${step}`
        });
        encoder.copyBufferToBuffer(
          fieldBuffer,
          0,
          profiledMechanicsFieldBuffer,
          profileSlot * fieldByteLength,
          fieldByteLength
        );
        options.device.queue.submit([encoder.finish()]);
        profiledMechanicsFieldMetadata[profileSlot] = {
          available: true,
          gridSpacingM: options.p2gGridProjection.gridSpacingM,
          gridDims: [...options.p2gGridProjection.gridDims]
        };
        profiledCapture.mechanicsField[profileSlot] = true;
        return update;
      };
      let observedProposalCount = 0;
      const observedProposalRunner = (options) => {
        observedDevice = options.device;
        const historyIndex = observedProposalCount;
        observedProposalCount += 1;
        if (traceSteps.length > 0 && !diagnosticTraceBuffer) {
          diagnosticTraceBuffer = observedDevice.createBuffer({
            label: 'iron-ice-impact-contact-diagnostic-trace',
            size: traceSteps.length * diagnosticTraceBytes,
            usage:
              GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
              | GPUBufferUsage.STORAGE
          });
        }
        const traceSlot = traceSteps.indexOf(historyIndex + 1);
        const proposal =
          proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
            ...options,
            diagnosticTrace: traceSlot >= 0
              ? {
                  buffer: diagnosticTraceBuffer,
                  byteOffset: traceSlot * diagnosticTraceBytes,
                  materialAId: 3061144,
                  materialBId: 26,
                  targetIndices: targetedTraceEnabled
                    ? traceTargets[traceSlot]
                    : undefined
                }
              : null
          });
        observedProposal = proposal;
        const controlByteLength =
          proposal.contactGraph.layout.bufferLayouts.control.byteLength;
        const evidenceByteLength =
          proposal.evidence.wordCount * Uint32Array.BYTES_PER_ELEMENT;
        const matchingCleanupByteLength =
          proposal.contactGraph.layout.bufferLayouts.matchingCleanupControl
            .byteLength;
        const historyStrideByteLength =
          controlByteLength + evidenceByteLength + matchingCleanupByteLength;
        if (!proposalHistoryBuffer) {
          proposalHistoryBuffer = observedDevice.createBuffer({
            label: 'iron-ice-impact-contact-proposal-history',
            size: stepCount * historyStrideByteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          });
          const particleCount = proposal.particleCount;
          const snapshotBuffer = (label, size) => observedDevice.createBuffer({
            label,
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          });
          mechanicalSnapshotStateBuffer = snapshotBuffer(
            'iron-ice-impact-contact-mechanical-state-snapshot',
            particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
          );
          mechanicalSnapshotThermoBuffer = snapshotBuffer(
            'iron-ice-impact-contact-mechanical-thermo-snapshot',
            particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
          );
          mechanicalSnapshotMechanicsBuffer = snapshotBuffer(
            'iron-ice-impact-contact-mechanical-mechanics-snapshot',
            particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
          );
          mechanicalSnapshotIdentityBuffer = snapshotBuffer(
            'iron-ice-impact-contact-mechanical-identity-snapshot',
            particleCount * Uint32Array.BYTES_PER_ELEMENT
          );
          if (profileStateSteps.length > 0) {
            const profileCount = profileStateSteps.length;
            const stateByteLength =
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
            const thermoByteLength =
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT;
            const mechanicsByteLength =
              particleCount * 32 * Float32Array.BYTES_PER_ELEMENT;
            const thermalRowsByteLength =
              particleCount
                * thermalProposalModule
                  .SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
                * Float32Array.BYTES_PER_ELEMENT;
            profiledInterfaceReceiptByteLength =
              proposal.contactGraph.layout.bufferLayouts.interfaceReceipt
                .byteLength;
            profiledStateBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-state-snapshots',
              profileCount * stateByteLength
            );
            profiledMechanicsBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-mechanics-snapshots',
              profileCount * mechanicsByteLength
            );
            profiledTerminalStateBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-terminal-state-snapshots',
              profileCount * stateByteLength
            );
            profiledTerminalMechanicsBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-terminal-mechanics-snapshots',
              profileCount * mechanicsByteLength
            );
            profiledTerminalThermoBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-terminal-thermo-snapshots',
              profileCount * thermoByteLength
            );
            profiledThermalRowsBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-thermal-row-snapshots',
              profileCount * thermalRowsByteLength
            );
            profiledInterfaceReceiptBuffer = snapshotBuffer(
              'iron-ice-impact-contact-profiled-interface-receipt-snapshots',
              profileCount * profiledInterfaceReceiptByteLength
            );
          }
          if (starProfileSteps.length > 0) {
            const starProfileCount = starProfileSteps.length;
            starProfileStateStrideByteLength =
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
            starProfileMechanicsStrideByteLength =
              particleCount * 32 * Float32Array.BYTES_PER_ELEMENT;
            starProfileSourceOffsetsStrideByteLength =
              proposal.contactGraph.layout.bufferLayouts.sourceOffsets
                .byteLength;
            starProfileDirectedPeersStrideByteLength =
              proposal.contactGraph.layout.bufferLayouts.directedPeers
                .byteLength;
            starProfileGraphControlStrideByteLength = controlByteLength;
            starProfileMatchingControlStrideByteLength =
              matchingCleanupByteLength;
            starProfileScratchBBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-scratch-b-snapshots',
              starProfileCount * starProfileStateStrideByteLength
            );
            starProfileMechanicsBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-mechanics-snapshots',
              starProfileCount * starProfileMechanicsStrideByteLength
            );
            starProfileSourceOffsetsBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-source-offset-snapshots',
              starProfileCount * starProfileSourceOffsetsStrideByteLength
            );
            starProfileDirectedPeersBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-directed-peer-snapshots',
              starProfileCount * starProfileDirectedPeersStrideByteLength
            );
            starProfileGraphControlBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-graph-control-snapshots',
              starProfileCount * starProfileGraphControlStrideByteLength
            );
            starProfileMatchingControlBuffer = snapshotBuffer(
              'iron-ice-impact-star-profile-matching-control-snapshots',
              starProfileCount * starProfileMatchingControlStrideByteLength
            );
          }
        }
        const descriptors = Object.getOwnPropertyDescriptors(proposal);
        descriptors.encodeApply = {
          configurable: false,
          enumerable: true,
          writable: false,
          value(encoder, applyOptions) {
            const particleCount = proposal.particleCount;
            const stateByteLength =
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
            const thermoByteLength =
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT;
            const mechanicsByteLength =
              particleCount * 32 * Float32Array.BYTES_PER_ELEMENT;
            const thermalRowsByteLength =
              particleCount
                * thermalProposalModule
                  .SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
                * Float32Array.BYTES_PER_ELEMENT;
            const starProfileSlot = starProfileSteps.indexOf(
              historyIndex + 1
            );
            if (starProfileSlot >= 0) {
              encoder.copyBufferToBuffer(
                applyOptions.mechanicsBuffer
                  ?? options.mlsMpmParticleUpload.mechanicsBuffer,
                0,
                starProfileMechanicsBuffer,
                starProfileSlot * starProfileMechanicsStrideByteLength,
                starProfileMechanicsStrideByteLength
              );
            }
            const result = proposal.encodeApply(encoder, applyOptions);
            if (starProfileSlot >= 0) {
              encoder.copyBufferToBuffer(
                proposal.scratchStateBBuffer,
                0,
                starProfileScratchBBuffer,
                starProfileSlot * starProfileStateStrideByteLength,
                starProfileStateStrideByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.sourceOffsetBuffer,
                0,
                starProfileSourceOffsetsBuffer,
                starProfileSlot * starProfileSourceOffsetsStrideByteLength,
                starProfileSourceOffsetsStrideByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.directedPeerBuffer,
                0,
                starProfileDirectedPeersBuffer,
                starProfileSlot * starProfileDirectedPeersStrideByteLength,
                starProfileDirectedPeersStrideByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.graphControlBuffer,
                0,
                starProfileGraphControlBuffer,
                starProfileSlot * starProfileGraphControlStrideByteLength,
                starProfileGraphControlStrideByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.matchingCleanupControlBuffer,
                0,
                starProfileMatchingControlBuffer,
                starProfileSlot * starProfileMatchingControlStrideByteLength,
                starProfileMatchingControlStrideByteLength
              );
              starProfileCapture[starProfileSlot] = true;
            }
            encoder.copyBufferToBuffer(
              applyOptions.stateBuffer,
              0,
              mechanicalSnapshotStateBuffer,
              0,
              stateByteLength
            );
            encoder.copyBufferToBuffer(
              proposal.contactGraph.sourceThermoBuffer,
              0,
              mechanicalSnapshotThermoBuffer,
              0,
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
            );
            encoder.copyBufferToBuffer(
              applyOptions.mechanicsBuffer
                ?? options.mlsMpmParticleUpload.mechanicsBuffer,
              0,
              mechanicalSnapshotMechanicsBuffer,
              0,
              particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
            );
            encoder.copyBufferToBuffer(
              proposal.contactGraph.sourceIdentityBuffer,
              0,
              mechanicalSnapshotIdentityBuffer,
              0,
              particleCount * Uint32Array.BYTES_PER_ELEMENT
            );
            const profiledStateSlot = profileStateSteps.indexOf(
              historyIndex + 1
            );
            if (profiledStateSlot >= 0) {
              encoder.copyBufferToBuffer(
                applyOptions.stateBuffer,
                0,
                profiledStateBuffer,
                profiledStateSlot * stateByteLength,
                stateByteLength
              );
              encoder.copyBufferToBuffer(
                applyOptions.mechanicsBuffer
                  ?? options.mlsMpmParticleUpload.mechanicsBuffer,
                0,
                profiledMechanicsBuffer,
                profiledStateSlot * mechanicsByteLength,
                mechanicsByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.contactInterfaceReceipt.buffer,
                0,
                profiledInterfaceReceiptBuffer,
                profiledStateSlot * profiledInterfaceReceiptByteLength,
                profiledInterfaceReceiptByteLength
              );
              profiledCapture.matchedState[profiledStateSlot] = true;
              profiledCapture.mechanics[profiledStateSlot] = true;
              profiledCapture.interfaceReceipt[profiledStateSlot] = true;
            }
            // Step S+1 consumes the exact terminal successor uploads from
            // step S. Its thermal artifact is prepared before this hook but
            // does not clear its row arena until the later thermal encoder,
            // so the previous artifact's row payload is still exact here.
            const previousStepSlot = profileStateSteps.indexOf(historyIndex);
            if (previousStepSlot >= 0) {
              if (
                !previousObservedThermalProposal
                || previousObservedThermalProposal.particleCount
                  !== particleCount
              ) {
                throw new Error(
                  `profiled step ${historyIndex} thermal predecessor unavailable`
                );
              }
              encoder.copyBufferToBuffer(
                options.sphParticleUpload.stateBuffer,
                0,
                profiledTerminalStateBuffer,
                previousStepSlot * stateByteLength,
                stateByteLength
              );
              encoder.copyBufferToBuffer(
                options.sphParticleUpload.thermoBuffer,
                0,
                profiledTerminalThermoBuffer,
                previousStepSlot * thermoByteLength,
                thermoByteLength
              );
              encoder.copyBufferToBuffer(
                options.mlsMpmParticleUpload.mechanicsBuffer,
                0,
                profiledTerminalMechanicsBuffer,
                previousStepSlot * mechanicsByteLength,
                mechanicsByteLength
              );
              encoder.copyBufferToBuffer(
                previousObservedThermalProposal.proposalBuffer,
                previousObservedThermalProposal.proposalRowByteOffset,
                profiledThermalRowsBuffer,
                previousStepSlot * thermalRowsByteLength,
                thermalRowsByteLength
              );
              profiledCapture.terminalState[previousStepSlot] = true;
              profiledCapture.terminalMechanics[previousStepSlot] = true;
              profiledCapture.terminalThermo[previousStepSlot] = true;
              profiledCapture.thermalRows[previousStepSlot] = true;
              profiledCapture.thermalDtS[previousStepSlot] =
                previousObservedThermalProposal.preparedLawConfig?.dtS
                ?? null;
            }
            if (historyIndex < stepCount) {
              const historyByteOffset =
                historyIndex * historyStrideByteLength;
              encoder.copyBufferToBuffer(
                proposal.graphControlBuffer,
                0,
                proposalHistoryBuffer,
                historyByteOffset,
                controlByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.evidence.buffer,
                0,
                proposalHistoryBuffer,
                historyByteOffset + controlByteLength,
                evidenceByteLength
              );
              encoder.copyBufferToBuffer(
                proposal.matchingCleanupControlBuffer,
                0,
                proposalHistoryBuffer,
                historyByteOffset + controlByteLength + evidenceByteLength,
                matchingCleanupByteLength
              );
            }
            return result;
          }
        };
        return Object.freeze(Object.defineProperties({}, descriptors));
      };
      const observedThermalProposalObserver = (proposal) => {
        previousObservedThermalProposal = observedThermalProposal;
        observedThermalProposal = proposal;
      };

      console.info('ulg-iron-ice-native-stage:resident-refresh-start');
      const residentRefreshStartedAtMs = performance.now();
      // With no queue fence, this is host encode/submission/publication time.
      // GPU completion is intentionally observed only by the terminal readback.
      let residentSubmissionHostElapsedMs = null;
      const compactResidentProgress = () => {
        const progress =
          scene.scene?.userData?.mlsMpmResidentStepsProgress
          ?? scene.userData?.mlsMpmResidentStepsProgress
          ?? null;
        const innerProgress = progress?.innerProgress ?? null;
        return {
          status: progress?.status ?? null,
          stepIndex:
            progress?.stepIndex
            ?? progress?.sequenceIndex
            ?? innerProgress?.stepIndex
            ?? innerProgress?.sequenceIndex
            ?? null,
          currentStage:
            progress?.currentStage
            ?? progress?.stage
            ?? innerProgress?.stage
            ?? null,
          innerStatus: innerProgress?.status ?? null,
          updatedAtMs: progress?.updatedAtMs ?? null,
          elapsedMs: performance.now() - residentRefreshStartedAtMs
        };
      };
      const emitResidentProgress = (label) => {
        console.info(
          `ulg-iron-ice-native-stage:${label}:`
            + JSON.stringify(compactResidentProgress())
        );
      };
      const residentProgressHeartbeat = setInterval(() => {
        emitResidentProgress('resident-host-heartbeat');
      }, 5_000);
      let execution;
      try {
        execution = await scene.refreshMlsMpmResidentSteps({
          preferWebGpu: true,
          force: true,
          stepCount,
          readbackMode: 'no-full-readback',
          compactSummaryMode: deepDiagnosticCaptureRequested
            ? 'final-only'
            : 'none',
          compactSummaryScope: 'particle-visual',
          continueFromResidentState: false,
          schroederSimulation: true,
          // Diagnostic context: declare the batch cleanup horizon. The scene
          // otherwise presets the interactive 512-pass budget, which cannot
          // cover this diagnostic's measured ~890-pass contact-chain worst
          // case.
          schroederContactJacobiIterations: 16,
          schroederContactCleanupPassBudget: 1024,
          schroederSelectedLevel: 0,
          schroederMinLevel: 0,
          schroederMaxLevel: 0,
          schroederEnablePortableSummary: true,
          schroederEnableActiveNodeIndex: true,
          schroederEnableTwoLevelMechanics: false,
          schroederEnableCrossLevelCoupling: false,
          schroederEnablePhaseVolumeMigration: true,
          schroederEnableLawQueue: true,
          schroederEnableLawNeighborCandidates: true,
          ...(surfaceMaxImpulseFraction == null
            ? {}
            : { phaseVolumeMaxImpulseFraction: surfaceMaxImpulseFraction }),
          ...(deepDiagnosticCaptureRequested
            ? {
                gridUpdateRunner: observedGridUpdateRunner,
                spatialMechanicalProposalRunner: observedProposalRunner
              }
            : { spatialMechanicalProposalCapture: mechanicalProposalCapture }),
          spatialThermalProposalObserver: observedThermalProposalObserver
        });
      } catch (error) {
        emitResidentProgress('resident-refresh-failed-progress');
        const sceneDeviceLoss =
          scene.scene?.userData?.sphNativeWebGpuSurfaceDeviceLoss
          ?? scene.userData?.sphNativeWebGpuSurfaceDeviceLoss
          ?? null;
        const renderBridge =
          scene.getSphResidentSurfaceDrawRenderBridge?.() ?? null;
        const failureDiagnostics = {
          error: {
            name: error?.name ?? null,
            message: error?.message ?? String(error),
            code: error?.code ?? null,
            status: error?.status ?? null,
            cause: {
              reason: error?.cause?.reason ?? null,
              message: error?.cause?.message ?? null
            }
          },
          sceneDeviceLoss: sceneDeviceLoss ? {
            status: sceneDeviceLoss.status ?? null,
            reason: sceneDeviceLoss.reason ?? null,
            info: {
              reason: sceneDeviceLoss.info?.reason ?? null,
              message: sceneDeviceLoss.info?.message ?? null
            },
            consumerUpdateCount:
              sceneDeviceLoss.consumerUpdateCount ?? null,
            renderBridgeUpdated:
              sceneDeviceLoss.renderBridgeUpdated ?? null
          } : null,
          renderBridge: renderBridge ? {
            deviceLost: renderBridge.deviceLost === true,
            deviceLostReason: renderBridge.deviceLostReason ?? null,
            deviceLostInfo: {
              reason: renderBridge.deviceLostInfo?.reason ?? null,
              message: renderBridge.deviceLostInfo?.message ?? null
            }
          } : null
        };
        console.info(
          'ulg-iron-ice-native-stage:resident-refresh-failure-diagnostics:'
            + JSON.stringify(failureDiagnostics).slice(0, 4096)
        );
        throw error;
      } finally {
        residentSubmissionHostElapsedMs =
          performance.now() - residentRefreshStartedAtMs;
        clearInterval(residentProgressHeartbeat);
      }
      emitResidentProgress('resident-refresh-host-return-progress');
      console.info('ulg-iron-ice-native-stage:resident-refresh-host-return');
      if (!deepDiagnosticCaptureRequested) {
        const captureDescription =
          proposalModule.describeSchroederSpatialMechanicalProposalCapture(
            mechanicalProposalCapture
          );
        if (
          captureDescription.complete !== true
          || captureDescription.encodedStepCount !== stepCount
          || !captureDescription.buffer
          || !captureDescription.layout
          || !captureDescription.lastProposal
          || !captureDescription.device
        ) {
          throw new Error('canonical mechanical proposal capture did not complete');
        }
        observedProposal = captureDescription.lastProposal;
        observedDevice = captureDescription.device;
        observedProposalCount = captureDescription.encodedStepCount;
        proposalHistoryBuffer = captureDescription.buffer;
        mechanicalSnapshotStateBuffer = captureDescription.buffer;
        mechanicalSnapshotThermoBuffer = captureDescription.buffer;
        mechanicalSnapshotMechanicsBuffer = captureDescription.buffer;
        mechanicalSnapshotIdentityBuffer = captureDescription.buffer;
        mechanicalProposalCaptureLayout = captureDescription.layout;
      }
      if (!observedProposal || !observedThermalProposal || !observedDevice) {
        return {
          status: 'unavailable',
          reason: 'mounted scene did not publish mechanical and thermal proposals'
        };
      }
      const gridSpacingM = Number(
        execution?.nextSphParticleState?.smoothingLengthM
          ?? scene.getSphGpuParticleState?.()?.smoothingLengthM
      );
      if (!Number.isFinite(gridSpacingM) || !(gridSpacingM > 0)) {
        throw new Error('terminal APIC grid spacing unavailable');
      }

      const readBuffers = async (requests, label) => {
        let totalByteLength = 0;
        const layouts = requests.map((request) => {
          const size = Math.ceil(Number(request.byteLength) / 4) * 4;
          const layout = {
            ...request,
            destinationByteOffset: totalByteLength,
            size
          };
          totalByteLength += size;
          return layout;
        });
        const readback = observedDevice.createBuffer({
          label,
          size: totalByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = observedDevice.createCommandEncoder({ label });
        for (const layout of layouts) {
          encoder.copyBufferToBuffer(
            layout.buffer,
            layout.sourceByteOffset ?? 0,
            readback,
            layout.destinationByteOffset,
            layout.size
          );
        }
        observedDevice.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        try {
          const mapped = readback.getMappedRange();
          return layouts.map((layout) => new Uint32Array(
            mapped.slice(
              layout.destinationByteOffset,
              layout.destinationByteOffset + layout.size
            )
          ));
        } finally {
          readback.unmap();
          readback.destroy();
        }
      };
      const readBuffer = async (
        buffer,
        byteLength,
        label,
        sourceByteOffset = 0
      ) => {
        const [words] = await readBuffers([
          { buffer, byteLength, sourceByteOffset }
        ], label);
        return words;
      };

      const finalStateUpload =
        execution?.nextParticleUploads?.sphParticleUpload;
      const finalMechanicsUpload =
        execution?.nextParticleUploads?.mlsMpmParticleUpload;
      const finalProfileSlot = profileStateSteps.indexOf(stepCount);
      if (finalProfileSlot >= 0) {
        const particleCount = observedProposal.particleCount;
        const stateByteLength =
          particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
        const thermoByteLength =
          particleCount * 12 * Float32Array.BYTES_PER_ELEMENT;
        const thermalRowsByteLength =
          particleCount
            * thermalProposalModule
              .SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
            * Float32Array.BYTES_PER_ELEMENT;
        if (
          !finalStateUpload?.stateBuffer
          || !finalStateUpload?.thermoBuffer
          || !finalMechanicsUpload?.mechanicsBuffer
        ) {
          throw new Error('profiled final successor uploads unavailable');
        }
        const encoder = observedDevice.createCommandEncoder({
          label: 'iron-ice-impact-contact-final-profile-capture'
        });
        encoder.copyBufferToBuffer(
          finalStateUpload.stateBuffer,
          0,
          profiledTerminalStateBuffer,
          finalProfileSlot * stateByteLength,
          stateByteLength
        );
        encoder.copyBufferToBuffer(
          finalStateUpload.thermoBuffer,
          0,
          profiledTerminalThermoBuffer,
          finalProfileSlot * thermoByteLength,
          thermoByteLength
        );
        encoder.copyBufferToBuffer(
          finalMechanicsUpload.mechanicsBuffer,
          0,
          profiledTerminalMechanicsBuffer,
          finalProfileSlot * particleCount * 32
            * Float32Array.BYTES_PER_ELEMENT,
          particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
        );
        encoder.copyBufferToBuffer(
          observedThermalProposal.proposalBuffer,
          observedThermalProposal.proposalRowByteOffset,
          profiledThermalRowsBuffer,
          finalProfileSlot * thermalRowsByteLength,
          thermalRowsByteLength
        );
        observedDevice.queue.submit([encoder.finish()]);
        profiledCapture.terminalState[finalProfileSlot] = true;
        profiledCapture.terminalMechanics[finalProfileSlot] = true;
        profiledCapture.terminalThermo[finalProfileSlot] = true;
        profiledCapture.thermalRows[finalProfileSlot] = true;
        profiledCapture.thermalDtS[finalProfileSlot] =
          observedThermalProposal.preparedLawConfig?.dtS ?? null;
      }
      for (let slot = 0; slot < profileStateSteps.length; slot += 1) {
        for (const field of [
          'matchedState',
          'mechanics',
          'terminalState',
          'terminalMechanics',
          'terminalThermo',
          'thermalRows',
          'interfaceReceipt'
        ]) {
          if (profiledCapture[field][slot] !== true) {
            throw new Error(
              `profiled step ${profileStateSteps[slot]} missing ${field}`
            );
          }
        }
      }
      for (let slot = 0; slot < starProfileSteps.length; slot += 1) {
        if (starProfileCapture[slot] !== true) {
          throw new Error(
            `star-profiled step ${starProfileSteps[slot]} missing graph capture`
          );
        }
      }
      console.info('ulg-iron-ice-native-stage:terminal-readback-start');
      const terminalGpuDrainAndReadbackStartedAtMs = performance.now();
      const [
        evidence,
        control,
        proposal,
        scales,
        proposalHistory,
        thermalProposal,
        conductionEvidence,
        radiationEvidence,
        finalState,
        interfaceReceipt,
        finalMechanics,
        matchingCleanupOwnerWorkspaceHeader,
        mechanicalSnapshotState,
        mechanicalSnapshotThermo,
        mechanicalSnapshotMechanics,
        mechanicalSnapshotIdentity
      ] = await readBuffers([
        {
          buffer: observedProposal.evidence.buffer,
          byteLength: observedProposal.evidence.wordCount * 4
        },
        {
          buffer: observedProposal.graphControlBuffer,
          byteLength:
            observedProposal.contactGraph.layout.bufferLayouts.control.byteLength
        },
        {
          buffer: observedProposal.proposalBuffer,
          byteLength: observedProposal.proposalBufferByteLength
        },
        {
          buffer: observedProposal.scaleBuffer,
          byteLength:
            observedProposal.particleCount
              * 4
              * Float32Array.BYTES_PER_ELEMENT
        },
        {
          buffer: proposalHistoryBuffer,
          byteLength: stepCount * (
            observedProposal.contactGraph.layout.bufferLayouts.control.byteLength
              + observedProposal.evidence.wordCount
                * Uint32Array.BYTES_PER_ELEMENT
              + observedProposal.contactGraph.layout.bufferLayouts
                .matchingCleanupControl.byteLength
          )
        },
        {
          buffer: observedThermalProposal.proposalBuffer,
          byteLength: observedThermalProposal.activeProposalByteLength
        },
        {
          buffer: observedThermalProposal.conductionEvidenceBuffer,
          byteLength:
            observedThermalProposal.evidenceWordCount
              * Uint32Array.BYTES_PER_ELEMENT
        },
        {
          buffer: observedThermalProposal.radiationEvidenceBuffer,
          byteLength:
            observedThermalProposal.evidenceWordCount
              * Uint32Array.BYTES_PER_ELEMENT
        },
        {
          buffer: finalStateUpload.stateBuffer,
          byteLength:
            finalStateUpload.stateBufferByteLength
              ?? finalStateUpload.stateBuffer.size
        },
        {
          buffer: observedProposal.contactInterfaceReceipt.buffer,
          byteLength:
            observedProposal.contactGraph.layout.bufferLayouts
              .interfaceReceipt.byteLength
        },
        {
          buffer: finalMechanicsUpload.mechanicsBuffer,
          byteLength:
            finalMechanicsUpload.mechanicsBufferByteLength
              ?? finalMechanicsUpload.mechanicsBuffer.size
        },
        {
          buffer: observedProposal.conditionalDispatchBuffer,
          byteLength: 5 * Uint32Array.BYTES_PER_ELEMENT
        },
        {
          buffer: mechanicalSnapshotStateBuffer,
          byteLength:
            observedProposal.particleCount
              * 8
              * Float32Array.BYTES_PER_ELEMENT,
          sourceByteOffset:
            mechanicalProposalCaptureLayout?.final?.state?.byteOffset ?? 0
        },
        {
          buffer: mechanicalSnapshotThermoBuffer,
          byteLength:
            observedProposal.particleCount
              * 12
              * Float32Array.BYTES_PER_ELEMENT,
          sourceByteOffset:
            mechanicalProposalCaptureLayout?.final?.thermo?.byteOffset ?? 0
        },
        {
          buffer: mechanicalSnapshotMechanicsBuffer,
          byteLength:
            observedProposal.particleCount
              * 32
              * Float32Array.BYTES_PER_ELEMENT,
          sourceByteOffset:
            mechanicalProposalCaptureLayout?.final?.mechanics?.byteOffset ?? 0
        },
        {
          buffer: mechanicalSnapshotIdentityBuffer,
          byteLength:
            observedProposal.particleCount * Uint32Array.BYTES_PER_ELEMENT,
          sourceByteOffset:
            mechanicalProposalCaptureLayout?.final?.identity?.byteOffset ?? 0
        }
      ], 'iron-ice-impact-terminal-batch-readback');
      const terminalGpuDrainAndReadbackElapsedMs =
        performance.now() - terminalGpuDrainAndReadbackStartedAtMs;
      console.info('ulg-iron-ice-native-stage:terminal-readback-complete');
      if (deepDiagnosticCaptureRequested) {
        for (const buffer of [
          mechanicalSnapshotStateBuffer,
          mechanicalSnapshotThermoBuffer,
          mechanicalSnapshotMechanicsBuffer,
          mechanicalSnapshotIdentityBuffer
        ]) {
          buffer.destroy();
        }
      }
      const readSnapshotAndDestroy = async (
        buffer,
        byteLength,
        label
      ) => {
        if (!buffer) return new Uint32Array();
        try {
          return await readBuffer(buffer, byteLength, label);
        } finally {
          buffer.destroy();
        }
      };
      const profileCount = profileStateSteps.length;
      const particleCount = observedProposal.particleCount;
      const profiledStateSnapshots = await readSnapshotAndDestroy(
        profiledStateBuffer,
        profileCount * particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
        'iron-ice-impact-contact-profiled-state-snapshots-readback'
      );
      const profiledMechanicsSnapshots = await readSnapshotAndDestroy(
        profiledMechanicsBuffer,
        profileCount * particleCount * 32 * Float32Array.BYTES_PER_ELEMENT,
        'iron-ice-impact-contact-profiled-mechanics-snapshots-readback'
      );
      const profiledTerminalStateSnapshots = await readSnapshotAndDestroy(
        profiledTerminalStateBuffer,
        profileCount * particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
        'iron-ice-impact-contact-profiled-terminal-state-snapshots-readback'
      );
      const profiledTerminalMechanicsSnapshots =
        await readSnapshotAndDestroy(
          profiledTerminalMechanicsBuffer,
          profileCount
            * particleCount
            * 32
            * Float32Array.BYTES_PER_ELEMENT,
          'iron-ice-impact-contact-profiled-terminal-mechanics-snapshots-readback'
        );
      const profiledTerminalThermoSnapshots = await readSnapshotAndDestroy(
        profiledTerminalThermoBuffer,
        profileCount * particleCount * 12 * Float32Array.BYTES_PER_ELEMENT,
        'iron-ice-impact-contact-profiled-terminal-thermo-snapshots-readback'
      );
      const profiledThermalRowSnapshots = await readSnapshotAndDestroy(
        profiledThermalRowsBuffer,
        profileCount
          * particleCount
          * thermalProposalModule
            .SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
          * Float32Array.BYTES_PER_ELEMENT,
        'iron-ice-impact-contact-profiled-thermal-row-snapshots-readback'
      );
      const profiledInterfaceReceiptSnapshots =
        await readSnapshotAndDestroy(
          profiledInterfaceReceiptBuffer,
          profileCount * profiledInterfaceReceiptByteLength,
          'iron-ice-impact-contact-profiled-interface-receipt-snapshots-readback'
        );
      const profiledMechanicsFieldSnapshots =
        await readSnapshotAndDestroy(
          profiledMechanicsFieldBuffer,
          profileCount * profiledMechanicsFieldStrideByteLength,
          'iron-ice-impact-profiled-mechanics-field-snapshots-readback'
        );
      const starProfileCount = starProfileSteps.length;
      const starProfileScratchBSnapshots = await readSnapshotAndDestroy(
        starProfileScratchBBuffer,
        starProfileCount * starProfileStateStrideByteLength,
        'iron-ice-impact-star-profile-scratch-b-snapshots-readback'
      );
      const starProfileMechanicsSnapshots = await readSnapshotAndDestroy(
        starProfileMechanicsBuffer,
        starProfileCount * starProfileMechanicsStrideByteLength,
        'iron-ice-impact-star-profile-mechanics-snapshots-readback'
      );
      const starProfileSourceOffsetsSnapshots =
        await readSnapshotAndDestroy(
          starProfileSourceOffsetsBuffer,
          starProfileCount * starProfileSourceOffsetsStrideByteLength,
          'iron-ice-impact-star-profile-source-offset-snapshots-readback'
        );
      const starProfileDirectedPeersSnapshots =
        await readSnapshotAndDestroy(
          starProfileDirectedPeersBuffer,
          starProfileCount * starProfileDirectedPeersStrideByteLength,
          'iron-ice-impact-star-profile-directed-peer-snapshots-readback'
        );
      const starProfileGraphControlSnapshots =
        await readSnapshotAndDestroy(
          starProfileGraphControlBuffer,
          starProfileCount * starProfileGraphControlStrideByteLength,
          'iron-ice-impact-star-profile-graph-control-snapshots-readback'
        );
      const starProfileMatchingControlSnapshots =
        await readSnapshotAndDestroy(
          starProfileMatchingControlBuffer,
          starProfileCount * starProfileMatchingControlStrideByteLength,
          'iron-ice-impact-star-profile-matching-control-snapshots-readback'
        );
      const diagnosticTraceSnapshots = await readSnapshotAndDestroy(
        diagnosticTraceBuffer,
        traceSteps.length * diagnosticTraceBytes,
        'iron-ice-impact-contact-diagnostic-trace-readback'
      );

      const bitCastBuffer = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT);
      const bitCastU32 = new Uint32Array(bitCastBuffer);
      const bitCastF32 = new Float32Array(bitCastBuffer);
      const bitsToFloat = (bits) => {
        bitCastU32[0] = bits;
        return bitCastF32[0];
      };
      const traceStatusEntries = Object.entries(
        proposalModule
          .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS
      );
      const targetTailStatusEntries = Object.entries(
        proposalModule
          .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
      );
      const targetRowStatusEntries = Object.entries(
        proposalModule
          .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
      );
      const invalidIndexOrNull = (value) => (
        value === 0xffff_ffff ? null : value
      );
      const decodeTargetTail = (base) => {
        if (!targetedTraceEnabled) return null;
        const tailHeader =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
        const rowStart =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD;
        const targetCount =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
        const rowWords =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
        const word = (offset) => (
          diagnosticTraceSnapshots[base + offset] ?? 0
        );
        const statusFlags = word(tailHeader + 2);
        const expectedPassCount = word(tailHeader + 3);
        const executedPassCount = Math.min(
          word(14),
          expectedPassCount
        );
        const targetIndices = [
          word(tailHeader + 6),
          word(tailHeader + 7)
        ];
        const localCaptureCount = word(tailHeader + 8);
        const postWallCaptureCount = word(tailHeader + 9);
        const expectedCaptureCount = executedPassCount * targetCount;
        const localCompleteFlag =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
            .LOCAL_CAPTURE_COMPLETE;
        const postWallCompleteFlag =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
            .POST_WALL_CAPTURE_COMPLETE;
        const activeRows = [];
        let omittedIdleRowCount = 0;
        let incompleteRowCount = 0;
        let rowIdentityMismatchCount = 0;
        let nonfiniteRowCount = 0;
        for (
          let passIndex = 0;
          passIndex < executedPassCount;
          passIndex += 1
        ) {
          for (
            let targetSlot = 0;
            targetSlot < targetCount;
            targetSlot += 1
          ) {
            const row =
              rowStart
              + (passIndex * targetCount + targetSlot) * rowWords;
            const rowStatusFlags = word(row + 7);
            if (
              (rowStatusFlags & localCompleteFlag) === 0
              || (rowStatusFlags & postWallCompleteFlag) === 0
            ) {
              incompleteRowCount += 1;
            }
            if (
              word(row) !== passIndex
              || word(row + 1) !== targetIndices[targetSlot]
            ) {
              rowIdentityMismatchCount += 1;
            }
            const responseNormal = [
              bitsToFloat(word(row + 8)),
              bitsToFloat(word(row + 9)),
              bitsToFloat(word(row + 10))
            ];
            const preApplyPositionM = [
              bitsToFloat(word(row + 11)),
              bitsToFloat(word(row + 12)),
              bitsToFloat(word(row + 13))
            ];
            const preApplyVelocityMPerS = [
              bitsToFloat(word(row + 14)),
              bitsToFloat(word(row + 15)),
              bitsToFloat(word(row + 16))
            ];
            const localPositionM = [
              bitsToFloat(word(row + 17)),
              bitsToFloat(word(row + 18)),
              bitsToFloat(word(row + 19))
            ];
            const localVelocityMPerS = [
              bitsToFloat(word(row + 20)),
              bitsToFloat(word(row + 21)),
              bitsToFloat(word(row + 22))
            ];
            const postWallPositionM = [
              bitsToFloat(word(row + 23)),
              bitsToFloat(word(row + 24)),
              bitsToFloat(word(row + 25))
            ];
            const postWallVelocityMPerS = [
              bitsToFloat(word(row + 26)),
              bitsToFloat(word(row + 27)),
              bitsToFloat(word(row + 28))
            ];
            const preApproachResidualMPerS =
              bitsToFloat(word(row + 29));
            const postLocalApproachResidualMPerS =
              bitsToFloat(word(row + 30));
            const peerMassKg = bitsToFloat(word(row + 31));
            if (![
              ...responseNormal,
              ...preApplyPositionM,
              ...preApplyVelocityMPerS,
              ...localPositionM,
              ...localVelocityMPerS,
              ...postWallPositionM,
              ...postWallVelocityMPerS,
              preApproachResidualMPerS,
              postLocalApproachResidualMPerS,
              peerMassKg
            ].every(Number.isFinite)) {
              nonfiniteRowCount += 1;
            }
            const meaningfulFlags =
              proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
                .SELECTED
              | proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
                .APPLIED
              | proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
                .POST_WALL_CHANGED;
            if ((rowStatusFlags & meaningfulFlags) === 0) {
              omittedIdleRowCount += 1;
              continue;
            }
            activeRows.push({
              passIndex: word(row),
              targetSlot,
              targetIndex: word(row + 1),
              selectedPeer: invalidIndexOrNull(word(row + 2)),
              targetCursor: invalidIndexOrNull(word(row + 3)),
              reciprocalCursor: invalidIndexOrNull(word(row + 4)),
              signedConstraintCode: word(row + 5) | 0,
              refinementRoundCount: word(row + 6),
              statusFlags: rowStatusFlags,
              statusNames: targetRowStatusEntries
                .filter(([, bit]) => (rowStatusFlags & bit) !== 0)
                .map(([name]) => name),
              responseNormal,
              preApplyPositionM,
              preApplyVelocityMPerS,
              localPositionM,
              localVelocityMPerS,
              postWallPositionM,
              postWallVelocityMPerS,
              preApproachResidualMPerS,
              postLocalApproachResidualMPerS,
              peerMassKg
            });
          }
        }
        const captureCompleteStatus =
          proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
            .LOCAL_CAPTURE_COMPLETE
          | proposalModule
            .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
            .POST_WALL_CAPTURE_COMPLETE;
        return {
          magic: word(tailHeader),
          version: word(tailHeader + 1),
          statusFlags,
          statusNames: targetTailStatusEntries
            .filter(([, bit]) => (statusFlags & bit) !== 0)
            .map(([name]) => name),
          valid:
            word(tailHeader)
              === proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC
            && word(tailHeader + 1)
              === proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION
            && (
              statusFlags
              & proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
                .HEADER_VALID
            ) !== 0
            && (
              statusFlags
              & proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
                .INVALID
            ) === 0
            && (statusFlags & captureCompleteStatus)
              === captureCompleteStatus
            && localCaptureCount === expectedCaptureCount
            && postWallCaptureCount === expectedCaptureCount
            && incompleteRowCount === 0
            && rowIdentityMismatchCount === 0
            && nonfiniteRowCount === 0,
          expectedPassCount,
          executedPassCount,
          targetCount,
          rowWords: word(tailHeader + 5),
          targetIndices,
          expectedCaptureCount,
          localCaptureCount,
          postWallCaptureCount,
          winnerMatchBits: word(tailHeader + 10),
          winnerExactPairMatch: (word(tailHeader + 10) & 4) !== 0,
          omittedIdleRowCount,
          incompleteRowCount,
          rowIdentityMismatchCount,
          nonfiniteRowCount,
          activeRows
        };
      };
      const contactTrace = traceSteps.map((step, traceSlot) => {
        const base = traceSlot * diagnosticTraceWords;
        const word = (offset) => diagnosticTraceSnapshots[base + offset] ?? 0;
        const statusFlags = word(2);
        return {
          step,
          magic: word(0),
          version: word(1),
          statusFlags,
          statusNames: traceStatusEntries
            .filter(([, bit]) => (statusFlags & bit) !== 0)
            .map(([name]) => name),
          valid:
            word(0)
              === proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC
            && word(1)
              === proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION
            && (
              statusFlags
              & proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS
                .HEADER_VALID
            ) !== 0
            && (
              statusFlags
              & proposalModule
                .SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.INVALID
            ) === 0,
          execution: {
            generationId: word(3),
            storageGeneration: word(4),
            physicsTick: word(5),
            physicsSubstep: word(6),
            positionEpoch: word(7),
            topologyEpoch: word(8),
            supportEpoch: word(9),
            particleCount: word(10),
            expectedCleanupPasses: word(11)
          },
          configuredMaterials: [
            bitsToFloat(word(12)),
            bitsToFloat(word(13))
          ],
          tracedCleanupPassCount: word(14),
          terminalGraphStickyBits: word(15),
          configuredAppliedPairCount: word(16),
          allCrossMaterialAppliedPairCount: word(17),
          firstConfiguredApplicationPass: invalidIndexOrNull(word(18)),
          lastConfiguredApplicationPass: invalidIndexOrNull(word(19)),
          cumulativeMaterialAImpulseKgMPerS: [
            bitsToFloat(word(20)),
            bitsToFloat(word(21)),
            bitsToFloat(word(22))
          ],
          cumulativeMaterialBImpulseKgMPerS: [
            bitsToFloat(word(23)),
            bitsToFloat(word(24)),
            bitsToFloat(word(25))
          ],
          cumulativePairMomentumResidualKgMPerS: [
            bitsToFloat(word(26)),
            bitsToFloat(word(27)),
            bitsToFloat(word(28))
          ],
          largestSinglePairLateralImpulseKgMPerS: bitsToFloat(word(29)),
          largestSinglePair: {
            lowIndex: invalidIndexOrNull(word(30)),
            highIndex: invalidIndexOrNull(word(31))
          },
          measuredTerminalMaxVelocityResidualMPerS: bitsToFloat(word(32)),
          winningDirectedCursor: invalidIndexOrNull(word(33)),
          winner: {
            sourceIndex: invalidIndexOrNull(word(34)),
            peerIndex: invalidIndexOrNull(word(35)),
            lowIndex: invalidIndexOrNull(word(36)),
            highIndex: invalidIndexOrNull(word(37)),
            reciprocalCursor: invalidIndexOrNull(word(38)),
            signedConstraintCode: word(39) | 0,
            positionResidualM: bitsToFloat(word(40)),
            velocityResidualMPerS: bitsToFloat(word(41)),
            responseNormal: [
              bitsToFloat(word(42)),
              bitsToFloat(word(43)),
              bitsToFloat(word(44))
            ],
            constraintNormal: [
              bitsToFloat(word(45)),
              bitsToFloat(word(46)),
              bitsToFloat(word(47))
            ],
            lowMaterialId: word(48),
            highMaterialId: word(49),
            lowPhaseClass: word(50),
            highPhaseClass: word(51),
            lowDomainId: word(52),
            highDomainId: word(53),
            lowMassKg: bitsToFloat(word(54)),
            highMassKg: bitsToFloat(word(55)),
            relativeVelocityMPerS: [
              bitsToFloat(word(56)),
              bitsToFloat(word(57)),
              bitsToFloat(word(58))
            ],
            lowBarrierVelocityDeltaMPerS: [
              bitsToFloat(word(59)),
              bitsToFloat(word(60)),
              bitsToFloat(word(61))
            ]
          },
          productionMaxVelocityResidualMPerS: bitsToFloat(word(62)),
          measuredActiveDirectedConstraintCount: word(63),
          targetTail: decodeTargetTail(base)
        };
      });
      const validateContactInterfaceReceiptLayout = () => {
        const headerWords = observedProposal.interfaceReceiptHeaderWords;
        const rowWords = observedProposal.interfaceReceiptRowWords;
        const particleCount = observedProposal.particleCount;
        const directedPairCapacity = interfaceReceipt[11];
        const offsetWordCount = interfaceReceipt[12];
        const publishedRowCount = interfaceReceipt[13];
        const materializedRowCount = interfaceReceipt[14];
        const statusFlags = interfaceReceipt[15];
        const offsetBase = headerWords;
        const rowBase = offsetBase + particleCount + 1;
        const admittedStatus = (
          pairGraphAbi
            .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY
          | pairGraphAbi
            .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED
        );
        const base = {
          headerWords,
          rowWords,
          particleCount,
          directedPairCapacity,
          offsetWordCount,
          publishedRowCount,
          materializedRowCount,
          statusFlags,
          admitted: statusFlags === admittedStatus,
          rowBoundsValid: false,
          rowBoundsReason: null,
          invalidOffsetIndex: null,
          invalidOffsetValue: null,
          previousOffsetValue: null
        };
        const invalid = (
          rowBoundsReason,
          invalidOffsetIndex = null,
          invalidOffsetValue = null,
          previousOffsetValue = null
        ) => ({
          ...base,
          rowBoundsReason,
          invalidOffsetIndex,
          invalidOffsetValue,
          previousOffsetValue
        });
        if (
          interfaceReceipt[0]
            !== pairGraphAbi
              .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC
          || interfaceReceipt[1]
            !== pairGraphAbi
              .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION
          || interfaceReceipt[10] !== particleCount
        ) {
          return invalid('invalid-header');
        }
        if (statusFlags !== admittedStatus) {
          return invalid('receipt-not-admitted');
        }
        if (
          !Number.isSafeInteger(headerWords)
          || headerWords < 16
          || !Number.isSafeInteger(rowWords)
          || rowWords < 2
          || !Number.isSafeInteger(particleCount)
          || particleCount < 0
          || !Number.isSafeInteger(directedPairCapacity)
          || directedPairCapacity < 0
          || !Number.isSafeInteger(publishedRowCount)
          || publishedRowCount < 0
          || publishedRowCount > directedPairCapacity
          || materializedRowCount !== publishedRowCount
          || offsetWordCount !== particleCount + 1
          || !Number.isSafeInteger(rowBase)
          || rowBase > interfaceReceipt.length
          || publishedRowCount
            > Math.floor((interfaceReceipt.length - rowBase) / rowWords)
        ) {
          return invalid('invalid-layout');
        }
        let previousOffsetValue = null;
        for (let index = 0; index <= particleCount; index += 1) {
          const value = interfaceReceipt[offsetBase + index];
          if (
            !Number.isSafeInteger(value)
            || value < 0
            || value > publishedRowCount
            || (previousOffsetValue != null && value < previousOffsetValue)
            || (index === 0 && value !== 0)
          ) {
            return invalid(
              'invalid-offset',
              index,
              value ?? null,
              previousOffsetValue
            );
          }
          previousOffsetValue = value;
        }
        if (previousOffsetValue !== publishedRowCount) {
          return invalid(
            'terminal-offset-mismatch',
            particleCount,
            previousOffsetValue,
            previousOffsetValue
          );
        }
        return {
          ...base,
          rowBoundsValid: true
        };
      };
      const contactInterfaceReceiptLayout =
        validateContactInterfaceReceiptLayout();
      const summarizeContactInterfaceReceipt = () => {
        const headerWords = observedProposal.interfaceReceiptHeaderWords;
        const rowWords = observedProposal.interfaceReceiptRowWords;
        const particleCount = observedProposal.particleCount;
        const lineageCapacity =
          observedProposal.contactInterfaceReceipt.phaseLineageCapacity;
        const publishedRowCount = interfaceReceipt[13] ?? 0;
        const offsetBase = headerWords;
        const rowBase = offsetBase + particleCount + 1;
        const summaryHeader = {
          magic: interfaceReceipt[0] ?? null,
          version: interfaceReceipt[1] ?? null,
          particleCount: interfaceReceipt[10] ?? null,
          directedPairCapacity: interfaceReceipt[11] ?? null,
          offsetWordCount: interfaceReceipt[12] ?? null,
          publishedRowCount,
          materializedRowCount: interfaceReceipt[14] ?? null,
          statusFlags: interfaceReceipt[15] ?? null,
          admitted: contactInterfaceReceiptLayout.admitted,
          rowBoundsValid: contactInterfaceReceiptLayout.rowBoundsValid,
          rowBoundsReason: contactInterfaceReceiptLayout.rowBoundsReason,
          invalidOffsetIndex:
            contactInterfaceReceiptLayout.invalidOffsetIndex,
          invalidOffsetValue:
            contactInterfaceReceiptLayout.invalidOffsetValue,
          previousOffsetValue:
            contactInterfaceReceiptLayout.previousOffsetValue
        };
        const emptySummary = {
          activeDirectedRowCount: 0,
          inactiveDirectedRowCount: 0,
          activeDirectedFaceAreaM2: 0,
          feH2oActiveDirectedRowCount: 0,
          feH2oInactiveDirectedRowCount: 0,
          feH2oActiveDirectedFaceAreaM2: 0,
          feH2oLiveActiveDirectedRowCount: 0,
          feH2oLiveInactiveDirectedRowCount: 0,
          feH2oLiveActiveDirectedFaceAreaM2: 0
        };
        if (!contactInterfaceReceiptLayout.rowBoundsValid) {
          return {
            ...summaryHeader,
            ...emptySummary
          };
        }
        const materialFamily = (index) => {
          const lineageIndex = index % lineageCapacity;
          if (lineageIndex < 1000) return 'h2o';
          if (lineageIndex < 1216) return 'fe';
          return 'other';
        };
        let activeDirectedRowCount = 0;
        let inactiveDirectedRowCount = 0;
        let activeDirectedFaceAreaM2 = 0;
        let feH2oActiveDirectedRowCount = 0;
        let feH2oInactiveDirectedRowCount = 0;
        let feH2oActiveDirectedFaceAreaM2 = 0;
        let feH2oLiveActiveDirectedRowCount = 0;
        let feH2oLiveInactiveDirectedRowCount = 0;
        let feH2oLiveActiveDirectedFaceAreaM2 = 0;
        const particleLive = (index) => (
          bitsToFloat(finalState[index * 8 + 3]) > 0
        );
        for (let selfIndex = 0; selfIndex < particleCount; selfIndex += 1) {
          const begin = interfaceReceipt[offsetBase + selfIndex] ?? 0;
          const end = interfaceReceipt[offsetBase + selfIndex + 1] ?? 0;
          for (let cursor = begin; cursor < end; cursor += 1) {
            const row = rowBase + cursor * rowWords;
            const otherIndex = interfaceReceipt[row];
            const signedAreaM2 = bitsToFloat(interfaceReceipt[row + 1]);
            if (signedAreaM2 > 0) {
              activeDirectedRowCount += 1;
              activeDirectedFaceAreaM2 += signedAreaM2;
            } else if (signedAreaM2 < 0) {
              inactiveDirectedRowCount += 1;
            }
            const selfFamily = materialFamily(selfIndex);
            const otherFamily = materialFamily(otherIndex);
            const isFeH2o = (
              (selfFamily === 'fe' && otherFamily === 'h2o')
              || (selfFamily === 'h2o' && otherFamily === 'fe')
            );
            if (!isFeH2o) continue;
            if (signedAreaM2 > 0) {
              feH2oActiveDirectedRowCount += 1;
              feH2oActiveDirectedFaceAreaM2 += signedAreaM2;
              if (particleLive(selfIndex) && particleLive(otherIndex)) {
                feH2oLiveActiveDirectedRowCount += 1;
                feH2oLiveActiveDirectedFaceAreaM2 += signedAreaM2;
              }
            } else if (signedAreaM2 < 0) {
              feH2oInactiveDirectedRowCount += 1;
              if (particleLive(selfIndex) && particleLive(otherIndex)) {
                feH2oLiveInactiveDirectedRowCount += 1;
              }
            }
          }
        }
        return {
          ...summaryHeader,
          activeDirectedRowCount,
          inactiveDirectedRowCount,
          activeDirectedFaceAreaM2,
          feH2oActiveDirectedRowCount,
          feH2oInactiveDirectedRowCount,
          feH2oActiveDirectedFaceAreaM2,
          feH2oLiveActiveDirectedRowCount,
          feH2oLiveInactiveDirectedRowCount,
          feH2oLiveActiveDirectedFaceAreaM2
        };
      };
      const contactInterfaceReceipt = summarizeContactInterfaceReceipt();
      const summarizeCrossMaterialProximity = () => {
        const offsetBase = observedProposal.interfaceReceiptHeaderWords;
        const rowWords = observedProposal.interfaceReceiptRowWords;
        const rowBase = offsetBase + observedProposal.particleCount + 1;
        const particleCount = observedProposal.particleCount;
        const lineageCapacity =
          observedProposal.contactInterfaceReceipt.phaseLineageCapacity;
        const family = (index) => {
          const lineageIndex = index % lineageCapacity;
          if (lineageIndex < 1000) return 'h2o';
          if (lineageIndex < 1216) return 'fe';
          return 'other';
        };
        const positions = (index) => [
          bitsToFloat(mechanicalSnapshotState[index * 8]),
          bitsToFloat(mechanicalSnapshotState[index * 8 + 1]),
          bitsToFloat(mechanicalSnapshotState[index * 8 + 2])
        ];
        const edgeM = (index) => Math.cbrt(Math.max(
          bitsToFloat(mechanicalSnapshotMechanics[index * 32 + 19]),
          0
        ));
        const h2o = [];
        const fe = [];
        for (let index = 0; index < particleCount; index += 1) {
          if (!(
            bitsToFloat(mechanicalSnapshotState[index * 8 + 3]) > 0
          )) continue;
          if (family(index) === 'h2o') h2o.push(index);
          if (family(index) === 'fe') fe.push(index);
        }
        let minimumDistanceM = Number.POSITIVE_INFINITY;
        let minimumChebyshevGapM = Number.POSITIVE_INFINITY;
        let finiteVolumeFaceContactPairCount = 0;
        let minimumChebyshevPair = null;
        for (const h2oIndex of h2o) {
          const h2oPosition = positions(h2oIndex);
          const h2oEdgeM = edgeM(h2oIndex);
          for (const feIndex of fe) {
            const fePosition = positions(feIndex);
            const feEdgeM = edgeM(feIndex);
            const delta = h2oPosition.map(
              (value, axis) => Math.abs(value - fePosition[axis])
            );
            const halfSumM = 0.5 * (h2oEdgeM + feEdgeM);
            const chebyshevGapM = Math.max(...delta) - halfSumM;
            minimumDistanceM = Math.min(
              minimumDistanceM,
              Math.hypot(...delta)
            );
            if (chebyshevGapM < minimumChebyshevGapM) {
              const separation = delta.map((value) => value - halfSumM);
              let normalAxis = 0;
              if (separation[1] > separation[normalAxis]) normalAxis = 1;
              if (separation[2] > separation[normalAxis]) normalAxis = 2;
              const tangentAxes = normalAxis === 0
                ? [1, 2]
                : normalAxis === 1
                  ? [0, 2]
                  : [0, 1];
              const tangentOverlapM = tangentAxes.map((axis) => Math.max(
                0,
                Math.min(
                  h2oEdgeM,
                  feEdgeM,
                  halfSumM - delta[axis]
                )
              ));
              minimumChebyshevGapM = chebyshevGapM;
              minimumChebyshevPair = {
                h2oIndex,
                feIndex,
                h2oLineageIndex: h2oIndex % lineageCapacity,
                feLineageIndex: feIndex % lineageCapacity,
                h2oPosition,
                fePosition,
                delta,
                distanceM: Math.hypot(...delta),
                h2oEdgeM,
                feEdgeM,
                halfSumM,
                chebyshevGapM,
                normalAxis,
                tangentAxes,
                tangentOverlapM
              };
            }
            if (chebyshevGapM <= Math.max(1e-5, halfSumM * 1e-5)) {
              finiteVolumeFaceContactPairCount += 1;
            }
          }
        }
        const receiptValue = (selfIndex, otherIndex) => {
          if (!contactInterfaceReceiptLayout.rowBoundsValid) return null;
          const begin = interfaceReceipt[offsetBase + selfIndex] ?? 0;
          const end = interfaceReceipt[offsetBase + selfIndex + 1] ?? 0;
          for (let cursor = begin; cursor < end; cursor += 1) {
            const row = rowBase + cursor * rowWords;
            if (interfaceReceipt[row] === otherIndex) {
              return bitsToFloat(interfaceReceipt[row + 1]);
            }
          }
          return null;
        };
        if (minimumChebyshevPair) {
          const { h2oIndex, feIndex } = minimumChebyshevPair;
          minimumChebyshevPair.h2oThermo = {
            materialId: bitsToFloat(mechanicalSnapshotThermo[h2oIndex * 12]),
            phaseId: bitsToFloat(
              mechanicalSnapshotThermo[h2oIndex * 12 + 1]
            )
          };
          minimumChebyshevPair.feThermo = {
            materialId: bitsToFloat(mechanicalSnapshotThermo[feIndex * 12]),
            phaseId: bitsToFloat(
              mechanicalSnapshotThermo[feIndex * 12 + 1]
            )
          };
          minimumChebyshevPair.h2oMechanics = {
            solidFlag: bitsToFloat(
              mechanicalSnapshotMechanics[h2oIndex * 32 + 20]
            ),
            eosModelId: bitsToFloat(
              mechanicalSnapshotMechanics[h2oIndex * 32 + 26]
            )
          };
          minimumChebyshevPair.feMechanics = {
            solidFlag: bitsToFloat(
              mechanicalSnapshotMechanics[feIndex * 32 + 20]
            ),
            eosModelId: bitsToFloat(
              mechanicalSnapshotMechanics[feIndex * 32 + 26]
            )
          };
          minimumChebyshevPair.h2oDomainId =
            mechanicalSnapshotIdentity[h2oIndex];
          minimumChebyshevPair.feDomainId =
            mechanicalSnapshotIdentity[feIndex];
          minimumChebyshevPair.h2oToFeReceiptValue = receiptValue(
            h2oIndex,
            feIndex
          );
          minimumChebyshevPair.feToH2oReceiptValue = receiptValue(
            feIndex,
            h2oIndex
          );
        }
        return {
          h2oLiveParticleCount: h2o.length,
          feLiveParticleCount: fe.length,
          evaluatedPairCount: h2o.length * fe.length,
          minimumDistanceM: Number.isFinite(minimumDistanceM)
            ? minimumDistanceM
            : null,
          minimumChebyshevGapM: Number.isFinite(minimumChebyshevGapM)
            ? minimumChebyshevGapM
            : null,
          finiteVolumeFaceContactPairCount,
          minimumChebyshevPair
        };
      };
      const crossMaterialProximity = summarizeCrossMaterialProximity();
      const summarizeProfiledContactStates = () => {
        if (profileStateSteps.length === 0) return [];
        const particleCount = observedProposal.particleCount;
        const lineageCapacity =
          observedProposal.contactInterfaceReceipt.phaseLineageCapacity;
        const stateStrideWords = particleCount * 8;
        const mechanicsStrideWords = particleCount * 32;
        const edgeM = (profileSlot, index) => Math.cbrt(Math.max(
          bitsToFloat(
            profiledMechanicsSnapshots[
              profileSlot * mechanicsStrideWords + index * 32 + 19
            ]
          ),
          0
        ));
        const rows = [];
        for (
          let profileSlot = 0;
          profileSlot < profileStateSteps.length;
          profileSlot += 1
        ) {
          const stateBase = profileSlot * stateStrideWords;
          const particleState = (index) => {
            const base = stateBase + index * 8;
            return {
              position: [
                bitsToFloat(profiledStateSnapshots[base]),
                bitsToFloat(profiledStateSnapshots[base + 1]),
                bitsToFloat(profiledStateSnapshots[base + 2])
              ],
              massKg: bitsToFloat(profiledStateSnapshots[base + 3]),
              velocity: [
                bitsToFloat(profiledStateSnapshots[base + 4]),
                bitsToFloat(profiledStateSnapshots[base + 5]),
                bitsToFloat(profiledStateSnapshots[base + 6])
              ]
            };
          };
          const h2o = [];
          const fe = [];
          for (let index = 0; index < particleCount; index += 1) {
            const state = particleState(index);
            if (!(state.massKg > 0)) continue;
            const lineage = index % lineageCapacity;
            if (lineage < 1000) h2o.push({ index, ...state });
            if (lineage >= 1000 && lineage < 1216) {
              fe.push({ index, ...state });
            }
          }
          let maximumPositionResidualM = 0;
          let maximumVelocityResidualMPerS = 0;
          let maximumPriorityPair = null;
          const faceOrientation = Object.fromEntries(
            ['x-', 'x+', 'y-', 'y+', 'z-', 'z+'].map((label) => [
              label,
              {
                pairCount: 0,
                faceAreaM2: 0,
                closingPairCount: 0,
                closingVelocityResidualMPerS: 0,
                maximumPositionResidualM: 0,
                maximumVelocityResidualMPerS: 0
              }
            ])
          );
          for (const h2oState of h2o) {
            const h2oEdgeM = edgeM(profileSlot, h2oState.index);
            for (const feState of fe) {
              const feEdgeM = edgeM(profileSlot, feState.index);
              const halfSumM = 0.5 * (h2oEdgeM + feEdgeM);
              const signedDelta = h2oState.position.map(
                (value, axis) => value - feState.position[axis]
              );
              const separation = signedDelta.map(
                (value) => Math.abs(value) - halfSumM
              );
              if (separation.some((value) => value > 0)) continue;
              let normalAxis = 0;
              if (separation[1] > separation[normalAxis]) normalAxis = 1;
              if (separation[2] > separation[normalAxis]) normalAxis = 2;
              const tangentAxes = normalAxis === 0
                ? [1, 2]
                : normalAxis === 1
                  ? [0, 2]
                  : [0, 1];
              const tangentOverlapM = tangentAxes.map((axis) => (
                Math.min(
                  h2oEdgeM,
                  feEdgeM,
                  halfSumM - Math.abs(signedDelta[axis])
                )
              ));
              if (tangentOverlapM.some((overlapM) => overlapM <= 0)) {
                continue;
              }
              const normalSign = signedDelta[normalAxis] >= 0 ? 1 : -1;
              const positionResidualM = Math.max(
                halfSumM - Math.abs(signedDelta[normalAxis]),
                0
              );
              const relativeNormalVelocityMPerS = normalSign * (
                h2oState.velocity[normalAxis]
                  - feState.velocity[normalAxis]
              );
              const velocityResidualMPerS = Math.max(
                -relativeNormalVelocityMPerS,
                0
              );
              const orientationLabel = `${'xyz'[normalAxis]}${
                normalSign < 0 ? '-' : '+'
              }`;
              const orientation = faceOrientation[orientationLabel];
              orientation.pairCount += 1;
              orientation.faceAreaM2 +=
                tangentOverlapM[0] * tangentOverlapM[1];
              orientation.closingPairCount += Number(
                velocityResidualMPerS > 0
              );
              orientation.closingVelocityResidualMPerS +=
                velocityResidualMPerS;
              orientation.maximumPositionResidualM = Math.max(
                orientation.maximumPositionResidualM,
                positionResidualM
              );
              orientation.maximumVelocityResidualMPerS = Math.max(
                orientation.maximumVelocityResidualMPerS,
                velocityResidualMPerS
              );
              const positionToleranceM = Math.max(1e-5, 0.02 * halfSumM);
              const priority = Math.max(
                positionResidualM / positionToleranceM,
                velocityResidualMPerS / velocityResidualToleranceMPerS
              );
              maximumPositionResidualM = Math.max(
                maximumPositionResidualM,
                positionResidualM
              );
              maximumVelocityResidualMPerS = Math.max(
                maximumVelocityResidualMPerS,
                velocityResidualMPerS
              );
              if (!maximumPriorityPair || priority > maximumPriorityPair.priority) {
                const lowerWallContact = (state, edge) => (
                  state.position.map(
                    (value) => value <= 0.5 * edge + 1e-6
                  )
                );
                maximumPriorityPair = {
                  priority,
                  normalAxis,
                  normalSign,
                  positionResidualM,
                  positionToleranceM,
                  velocityResidualMPerS,
                  h2o: {
                    index: h2oState.index,
                    massKg: h2oState.massKg,
                    edgeM: h2oEdgeM,
                    position: h2oState.position,
                    velocity: h2oState.velocity,
                    lowerWallContact: lowerWallContact(
                      h2oState,
                      h2oEdgeM
                    )
                  },
                  fe: {
                    index: feState.index,
                    massKg: feState.massKg,
                    edgeM: feEdgeM,
                    position: feState.position,
                    velocity: feState.velocity,
                    lowerWallContact: lowerWallContact(feState, feEdgeM)
                  }
                };
              }
            }
          }
          rows.push({
            step: profileStateSteps[profileSlot],
            h2oLiveParticleCount: h2o.length,
            feLiveParticleCount: fe.length,
            maximumPositionResidualM,
            maximumVelocityResidualMPerS,
            faceOrientation,
            maximumPriorityPair
          });
        }
        return rows;
      };
      const profiledContactStates = summarizeProfiledContactStates();
      const summarizeStarProfiles = () => {
        if (starProfileSteps.length === 0) return [];
        const particleCount = observedProposal.particleCount;
        const lineageCapacity =
          observedProposal.contactInterfaceReceipt.phaseLineageCapacity;
        const tracedStarIndices = new Set(traceTargets.flat());
        const stateStrideWords =
          starProfileStateStrideByteLength / Uint32Array.BYTES_PER_ELEMENT;
        const mechanicsStrideWords =
          starProfileMechanicsStrideByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const offsetStrideWords =
          starProfileSourceOffsetsStrideByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const peerStrideWords =
          starProfileDirectedPeersStrideByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const controlStrideWords =
          starProfileGraphControlStrideByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const matchingStrideWords =
          starProfileMatchingControlStrideByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const materialFamily = (index) => {
          const lineage = index % lineageCapacity;
          if (lineage < 1000) return 'h2o';
          if (lineage < 1216) return 'fe';
          return 'other';
        };
        const stateAt = (words, slot, index) => {
          const base = slot * stateStrideWords + index * 8;
          return {
            position: [
              bitsToFloat(words[base]),
              bitsToFloat(words[base + 1]),
              bitsToFloat(words[base + 2])
            ],
            massKg: bitsToFloat(words[base + 3]),
            velocity: [
              bitsToFloat(words[base + 4]),
              bitsToFloat(words[base + 5]),
              bitsToFloat(words[base + 6])
            ]
          };
        };
        const edgeMAt = (slot, index) => Math.cbrt(Math.max(
          bitsToFloat(
            starProfileMechanicsSnapshots[
              slot * mechanicsStrideWords + index * 32 + 19
            ]
          ),
          0
        ));
        const phaseClassAt = (slot, index) => {
          const base = slot * mechanicsStrideWords + index * 32;
          if (bitsToFloat(starProfileMechanicsSnapshots[base + 20]) > 0.5) {
            return 2;
          }
          const liquidFlag = bitsToFloat(
            starProfileMechanicsSnapshots[base + 26]
          );
          return liquidFlag > 0.5 && liquidFlag < 1.5 ? 1 : 0;
        };
        const analyzeState = (words, slot, includeStars) => {
          const offsetBase = slot * offsetStrideWords;
          const peerBase = slot * peerStrideWords;
          const controlBase = slot * controlStrideWords;
          const publishedDirectedPairCount =
            starProfileGraphControlSnapshots[controlBase + 12] ?? 0;
          const adjacency = includeStars
            ? Array.from({ length: particleCount }, () => [])
            : null;
          let activeUndirectedPairCount = 0;
          let maximumVelocityResidualMPerS = 0;
          let maximumPositionResidualM = 0;
          let maximumPriorityPair = null;
          for (let selfIndex = 0; selfIndex < particleCount; selfIndex += 1) {
            const begin =
              starProfileSourceOffsetsSnapshots[offsetBase + selfIndex] ?? 0;
            const end =
              starProfileSourceOffsetsSnapshots[offsetBase + selfIndex + 1]
              ?? 0;
            if (begin > end || end > publishedDirectedPairCount) continue;
            for (let cursor = begin; cursor < end; cursor += 1) {
              const peerIndex =
                starProfileDirectedPeersSnapshots[peerBase + cursor]
                & 0x7fff_ffff;
              if (
                peerIndex <= selfIndex
                || peerIndex >= particleCount
              ) continue;
              const selfFamily = materialFamily(selfIndex);
              const peerFamily = materialFamily(peerIndex);
              const crossIronWater = (
                (selfFamily === 'h2o' && peerFamily === 'fe')
                || (selfFamily === 'fe' && peerFamily === 'h2o')
              );
              const touchesTracedStar =
                tracedStarIndices.has(selfIndex)
                || tracedStarIndices.has(peerIndex);
              if (
                (!crossIronWater && !touchesTracedStar)
                || phaseClassAt(slot, selfIndex) === 0
                || phaseClassAt(slot, peerIndex) === 0
              ) continue;
              const selfState = stateAt(words, slot, selfIndex);
              const peerState = stateAt(words, slot, peerIndex);
              if (!(selfState.massKg > 0) || !(peerState.massKg > 0)) {
                continue;
              }
              const selfEdgeM = edgeMAt(slot, selfIndex);
              const peerEdgeM = edgeMAt(slot, peerIndex);
              if (!(selfEdgeM > 0) || !(peerEdgeM > 0)) continue;
              const halfSumM = 0.5 * (selfEdgeM + peerEdgeM);
              const delta = selfState.position.map(
                (value, axis) => value - peerState.position[axis]
              );
              const separation = delta.map(
                (value) => Math.abs(value) - halfSumM
              );
              let normalAxis = 0;
              if (separation[1] > separation[normalAxis]) normalAxis = 1;
              if (separation[2] > separation[normalAxis]) normalAxis = 2;
              const geometricScaleM = Math.max(
                Math.abs(delta[0]),
                Math.abs(delta[1]),
                Math.abs(delta[2]),
                selfEdgeM,
                peerEdgeM,
                halfSumM,
                1e-12
              );
              const normalToleranceM = Math.min(
                8 * 1.1920929e-7 * geometricScaleM,
                1e-4 * halfSumM
              );
              if (separation[normalAxis] > normalToleranceM) continue;
              const tangentToleranceM =
                16 * 1.1920929e-7 * geometricScaleM;
              const tangentAxes = normalAxis === 0
                ? [1, 2]
                : normalAxis === 1
                  ? [0, 2]
                  : [0, 1];
              if (tangentAxes.some((axis) => (
                halfSumM - Math.abs(delta[axis]) <= tangentToleranceM
              ))) continue;
              activeUndirectedPairCount += 1;
              const normalSign = delta[normalAxis] >= 0 ? 1 : -1;
              const relativeNormalVelocityMPerS = normalSign * (
                selfState.velocity[normalAxis]
                  - peerState.velocity[normalAxis]
              );
              const velocityResidualMPerS = Math.max(
                -relativeNormalVelocityMPerS,
                0
              );
              const positionResidualM = Math.max(
                halfSumM - Math.abs(delta[normalAxis]),
                0
              );
              const positionToleranceM = Math.max(1e-5, 0.02 * halfSumM);
              const priority = Math.max(
                positionResidualM / positionToleranceM,
                velocityResidualMPerS / velocityResidualToleranceMPerS
              );
              const pair = {
                lowIndex: selfIndex,
                highIndex: peerIndex,
                normalAxis,
                normalSign,
                positionResidualM,
                positionToleranceM,
                velocityResidualMPerS,
                priority,
                low: {
                  family: selfFamily,
                  massKg: selfState.massKg,
                  edgeM: selfEdgeM,
                  position: selfState.position,
                  velocity: selfState.velocity
                },
                high: {
                  family: peerFamily,
                  massKg: peerState.massKg,
                  edgeM: peerEdgeM,
                  position: peerState.position,
                  velocity: peerState.velocity
                }
              };
              maximumVelocityResidualMPerS = Math.max(
                maximumVelocityResidualMPerS,
                velocityResidualMPerS
              );
              maximumPositionResidualM = Math.max(
                maximumPositionResidualM,
                positionResidualM
              );
              if (
                !maximumPriorityPair
                || priority > maximumPriorityPair.priority
              ) maximumPriorityPair = pair;
              if (adjacency) {
                adjacency[selfIndex].push({
                  peerIndex,
                  peerMassKg: peerState.massKg,
                  peerFamily,
                  normalAxis,
                  normalSign,
                  positionResidualM,
                  velocityResidualMPerS,
                  priority
                });
                adjacency[peerIndex].push({
                  peerIndex: selfIndex,
                  peerMassKg: selfState.massKg,
                  peerFamily: selfFamily,
                  normalAxis,
                  normalSign: -normalSign,
                  positionResidualM,
                  velocityResidualMPerS,
                  priority
                });
              }
            }
          }
          const summary = {
            activeUndirectedPairCount,
            maximumPositionResidualM,
            maximumVelocityResidualMPerS,
            maximumPriorityPair
          };
          if (!adjacency) return summary;
          const endpointSummary = (index) => {
            const center = stateAt(words, slot, index);
            const contacts = adjacency[index]
              .slice()
              .sort((left, right) => (
                right.priority - left.priority
                || left.peerIndex - right.peerIndex
              ));
            const heavierContacts = contacts.filter(
              ({ peerMassKg }) => peerMassKg > center.massKg
            );
            const violatingContacts = contacts.filter(
              ({ velocityResidualMPerS }) => (
                velocityResidualMPerS
                  > velocityResidualToleranceMPerS
              )
            );
            const heavierViolatingContacts = heavierContacts.filter(
              ({ velocityResidualMPerS }) => (
                velocityResidualMPerS
                  > velocityResidualToleranceMPerS
              )
            );
            return {
              index,
              family: materialFamily(index),
              massKg: center.massKg,
              activeContactCount: contacts.length,
              heavierActiveContactCount: heavierContacts.length,
              violatingContactCount: violatingContacts.length,
              heavierViolatingContactCount:
                heavierViolatingContacts.length,
              contacts: contacts.slice(0, 24)
            };
          };
          const winnerEndpoints = maximumPriorityPair
            ? [
                endpointSummary(maximumPriorityPair.lowIndex),
                endpointSummary(maximumPriorityPair.highIndex)
              ]
            : [];
          const degreeLeaders = [];
          for (let index = 0; index < particleCount; index += 1) {
            if (adjacency[index].length === 0) continue;
            const endpoint = endpointSummary(index);
            if (
              endpoint.heavierActiveContactCount === 0
              && endpoint.violatingContactCount === 0
            ) continue;
            degreeLeaders.push({
              index,
              family: endpoint.family,
              massKg: endpoint.massKg,
              activeContactCount: endpoint.activeContactCount,
              heavierActiveContactCount:
                endpoint.heavierActiveContactCount,
              violatingContactCount: endpoint.violatingContactCount,
              heavierViolatingContactCount:
                endpoint.heavierViolatingContactCount
            });
          }
          degreeLeaders.sort((left, right) => (
            right.heavierViolatingContactCount
              - left.heavierViolatingContactCount
            || right.heavierActiveContactCount
              - left.heavierActiveContactCount
            || right.violatingContactCount - left.violatingContactCount
            || right.activeContactCount - left.activeContactCount
            || left.index - right.index
          ));
          return {
            ...summary,
            winnerEndpoints,
            degreeLeaders: degreeLeaders.slice(0, 16)
          };
        };
        return starProfileSteps.map((step, slot) => {
          const controlBase = slot * controlStrideWords;
          const matchingBase = slot * matchingStrideWords;
          return {
            step,
            graph: {
              publishedDirectedPairCount:
                starProfileGraphControlSnapshots[controlBase + 12] ?? null,
              stickyFailureBits:
                starProfileGraphControlSnapshots[controlBase + 14] ?? null,
              completedStageMask:
                starProfileGraphControlSnapshots[controlBase + 15] ?? null,
              maxPositionResidualM: bitsToFloat(
                starProfileGraphControlSnapshots[controlBase + 27]
              ),
              maxVelocityResidualMPerS: bitsToFloat(
                starProfileGraphControlSnapshots[controlBase + 28]
              ),
              matchingPassCount:
                starProfileGraphControlSnapshots[
                  controlBase
                    + controlWord.matchingCleanupPassCount
                ] ?? null,
              matchingControlHeader: Array.from(
                starProfileMatchingControlSnapshots.slice(
                  matchingBase,
                  matchingBase + 12
                )
              )
            },
            scratchB: analyzeState(
              starProfileScratchBSnapshots,
              slot,
              true
            )
          };
        });
      };
      const starProfiles = summarizeStarProfiles();
      const summarizeProfiledMechanicsFields = () => {
        if (profileStateSteps.length === 0) return [];
        if (!(profiledMechanicsFieldStrideByteLength > 0)) {
          return profileStateSteps.map((step, profileSlot) => ({
            step,
            available: false,
            reason:
              profiledMechanicsFieldMetadata[profileSlot]?.reason
              ?? 'mechanics-field-view-unavailable'
          }));
        }
        const strideWords =
          profiledMechanicsFieldStrideByteLength
          / Uint32Array.BYTES_PER_ELEMENT;
        const summarizeMaterial = (profileSlot, materialId) => {
          const snapshotBase = profileSlot * strideWords;
          const load = (word) => (
            profiledMechanicsFieldSnapshots[snapshotBase + word]
          );
          const fieldCount = load(34);
          const keyOffsetWords = load(26);
          const keyRowWords = load(27);
          const accumulatorOffsetWords = load(28);
          const accumulatorRowWords = load(29);
          const stateOffsetWords = load(30);
          const stateRowWords = load(31);
          const metadata = profiledMechanicsFieldMetadata[profileSlot];
          const gridSpacing = Number(metadata?.gridSpacingM);
          const gridDims = metadata?.gridDims;
          if (
            !(fieldCount > 0)
            || keyRowWords !== 4
            || accumulatorRowWords !== 8
            || stateRowWords !== 8
            || !Number.isFinite(gridSpacing)
            || !(gridSpacing > 0)
            || !Array.isArray(gridDims)
            || gridDims.length !== 3
          ) {
            return null;
          }
          const yz = gridDims[1] * gridDims[2];
          let rowCount = 0;
          let massKg = 0;
          let kineticEnergyJ = 0;
          let pressureInternalCompensationJ = 0;
          let pressureInternalCompensationAbsJ = 0;
          let pressureInternalCompensationRowCount = 0;
          const positionMassMomentKgM = [0, 0, 0];
          const momentumKgMPerS = [0, 0, 0];
          const angularMomentumAboutOriginKgM2PerS = [0, 0, 0];
          for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
            const key = keyOffsetWords + fieldIndex * keyRowWords;
            if (load(key + 2) !== materialId) continue;
            const state = stateOffsetWords + fieldIndex * stateRowWords;
            const accumulator = accumulatorOffsetWords
              + fieldIndex * accumulatorRowWords;
            const mass = bitsToFloat(load(state));
            const velocity = [
              bitsToFloat(load(state + 1)),
              bitsToFloat(load(state + 2)),
              bitsToFloat(load(state + 3))
            ];
            if (!(mass > 0) || !velocity.every(Number.isFinite)) continue;
            const node = load(key);
            const x = Math.floor(node / yz);
            const remainder = node - x * yz;
            const y = Math.floor(remainder / gridDims[2]);
            const z = remainder - y * gridDims[2];
            const position = [
              x * gridSpacing,
              y * gridSpacing,
              z * gridSpacing
            ];
            rowCount += 1;
            massKg += mass;
            kineticEnergyJ += 0.5 * mass * (
              velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2
            );
            const pressureInternalCompensation = bitsToFloat(
              load(accumulator + 3)
            );
            if (Number.isFinite(pressureInternalCompensation)) {
              pressureInternalCompensationJ +=
                pressureInternalCompensation;
              pressureInternalCompensationAbsJ += Math.abs(
                pressureInternalCompensation
              );
              if (pressureInternalCompensation !== 0) {
                pressureInternalCompensationRowCount += 1;
              }
            }
            for (let axis = 0; axis < 3; axis += 1) {
              positionMassMomentKgM[axis] += mass * position[axis];
              momentumKgMPerS[axis] += mass * velocity[axis];
            }
            angularMomentumAboutOriginKgM2PerS[0] += mass * (
              position[1] * velocity[2] - position[2] * velocity[1]
            );
            angularMomentumAboutOriginKgM2PerS[1] += mass * (
              position[2] * velocity[0] - position[0] * velocity[2]
            );
            angularMomentumAboutOriginKgM2PerS[2] += mass * (
              position[0] * velocity[1] - position[1] * velocity[0]
            );
          }
          const centerOfMassM = massKg > 0
            ? positionMassMomentKgM.map((value) => value / massKg)
            : null;
          const centerOfMassVelocityMPerS = massKg > 0
            ? momentumKgMPerS.map((value) => value / massKg)
            : null;
          const orbitalAngularMomentumKgM2PerS = centerOfMassM
            ? [
                centerOfMassM[1] * momentumKgMPerS[2]
                  - centerOfMassM[2] * momentumKgMPerS[1],
                centerOfMassM[2] * momentumKgMPerS[0]
                  - centerOfMassM[0] * momentumKgMPerS[2],
                centerOfMassM[0] * momentumKgMPerS[1]
                  - centerOfMassM[1] * momentumKgMPerS[0]
              ]
            : null;
          const angularMomentumAboutCenterOfMassKgM2PerS =
            orbitalAngularMomentumKgM2PerS
              ? angularMomentumAboutOriginKgM2PerS.map(
                  (value, axis) => value
                    - orbitalAngularMomentumKgM2PerS[axis]
                )
              : null;
          const centerOfMassKineticEnergyJ = centerOfMassVelocityMPerS
            ? 0.5 * massKg * centerOfMassVelocityMPerS.reduce(
                (sum, value) => sum + value * value,
                0
              )
            : null;
          return {
            rowCount,
            massKg,
            centerOfMassM,
            centerOfMassVelocityMPerS,
            angularMomentumAboutCenterOfMassKgM2PerS,
            kineticEnergyJ,
            pressureInternalCompensationJ,
            pressureInternalCompensationAbsJ,
            pressureInternalCompensationRowCount,
            centerOfMassKineticEnergyJ,
            relativeKineticEnergyJ:
              Number.isFinite(centerOfMassKineticEnergyJ)
                ? Math.max(0, kineticEnergyJ - centerOfMassKineticEnergyJ)
                : null
          };
        };
        return profileStateSteps.map((step, profileSlot) => {
          if (profiledCapture.mechanicsField[profileSlot] !== true) {
            return {
              step,
              available: false,
              reason:
                profiledMechanicsFieldMetadata[profileSlot]?.reason
                ?? 'mechanics-field-view-unavailable'
            };
          }
          return {
            step,
            available: true,
            gridSpacingM:
              profiledMechanicsFieldMetadata[profileSlot]?.gridSpacingM
              ?? null,
            gridDims:
              profiledMechanicsFieldMetadata[profileSlot]?.gridDims ?? null,
            header: {
              status: profiledMechanicsFieldSnapshots[
                profileSlot * strideWords + 2
              ],
              fieldCount: profiledMechanicsFieldSnapshots[
                profileSlot * strideWords + 34
              ]
            },
            h2o: summarizeMaterial(profileSlot, 3061144),
            iron: summarizeMaterial(profileSlot, 26)
          };
        });
      };
      const profiledMechanicsFieldCheckpoints =
        summarizeProfiledMechanicsFields();
      const summarizeProfiledThermalCheckpoints = () => {
        if (profileStateSteps.length === 0) return [];
        const particleCount = observedProposal.particleCount;
        const lineageCapacity =
          observedProposal.contactInterfaceReceipt.phaseLineageCapacity;
        const stateStrideWords = particleCount * 8;
        const thermoStrideWords = particleCount * 12;
        const mechanicsStrideWords = particleCount * 32;
        const thermalRowWords =
          thermalProposalModule.SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS;
        const thermalStrideWords = particleCount * thermalRowWords;
        const receiptStrideWords =
          profiledInterfaceReceiptByteLength
            / Uint32Array.BYTES_PER_ELEMENT;
        const matchedStateFloats = new Float32Array(
          profiledStateSnapshots.buffer,
          profiledStateSnapshots.byteOffset,
          profiledStateSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const terminalStateFloats = new Float32Array(
          profiledTerminalStateSnapshots.buffer,
          profiledTerminalStateSnapshots.byteOffset,
          profiledTerminalStateSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const terminalMechanicsFloats = new Float32Array(
          profiledTerminalMechanicsSnapshots.buffer,
          profiledTerminalMechanicsSnapshots.byteOffset,
          profiledTerminalMechanicsSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const terminalThermoFloats = new Float32Array(
          profiledTerminalThermoSnapshots.buffer,
          profiledTerminalThermoSnapshots.byteOffset,
          profiledTerminalThermoSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const thermalRowFloats = new Float32Array(
          profiledThermalRowSnapshots.buffer,
          profiledThermalRowSnapshots.byteOffset,
          profiledThermalRowSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const profiledMechanicsFloats = new Float32Array(
          profiledMechanicsSnapshots.buffer,
          profiledMechanicsSnapshots.byteOffset,
          profiledMechanicsSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const interfaceReceiptFloats = new Float32Array(
          profiledInterfaceReceiptSnapshots.buffer,
          profiledInterfaceReceiptSnapshots.byteOffset,
          profiledInterfaceReceiptSnapshots.byteLength
            / Float32Array.BYTES_PER_ELEMENT
        );
        const materialFamily = (index) => {
          const lineage = index % lineageCapacity;
          if (lineage < 1000) return 'h2o';
          if (lineage < 1216) return 'fe';
          return 'other';
        };
        const phaseNames = ['solid', 'liquid', 'gas', 'plasma'];
        const inLineageRange = (index, begin, end) => {
          const lineage = index % lineageCapacity;
          return lineage >= begin && lineage < end;
        };
        const finiteVectorOrNull = (values) => (
          values.every(Number.isFinite) ? values : null
        );
        const summarizeTerminalMaterial = (
          profileSlot,
          lineageBegin,
          lineageEnd
        ) => {
          const stateBase = profileSlot * stateStrideWords;
          const mechanicsBase = profileSlot * mechanicsStrideWords;
          const thermoBase = profileSlot * thermoStrideWords;
          let liveParticleCount = 0;
          let nonfiniteRowCount = 0;
          let massKg = 0;
          let internalEnergyJ = 0;
          let temperatureMassMomentKgK = 0;
          let temperatureMassKg = 0;
          let minimumTemperatureK = Number.POSITIVE_INFINITY;
          let maximumTemperatureK = Number.NEGATIVE_INFINITY;
          const positionMassMomentKgM = [0, 0, 0];
          const momentumKgMPerS = [0, 0, 0];
          const angularMomentumAboutOriginKgM2PerS = [0, 0, 0];
          const affineAngularMomentumKgM2PerS = [0, 0, 0];
          let kineticEnergyJ = 0;
          const minimumPositionM = [
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY
          ];
          const maximumPositionM = [
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY
          ];
          const phaseMassKg = {
            solid: 0,
            liquid: 0,
            gas: 0,
            plasma: 0
          };
          const phaseCarrierCount = {
            solid: 0,
            liquid: 0,
            gas: 0,
            plasma: 0
          };
          let transitionCarrierCount = 0;
          for (let index = 0; index < particleCount; index += 1) {
            if (!inLineageRange(index, lineageBegin, lineageEnd)) continue;
            const stateOffset = stateBase + index * 8;
            const thermoOffset = thermoBase + index * 12;
            const mechanicsOffset = mechanicsBase + index * 32;
            const mass = terminalStateFloats[stateOffset + 3];
            if (!(mass > 0)) continue;
            const position = [
              terminalStateFloats[stateOffset],
              terminalStateFloats[stateOffset + 1],
              terminalStateFloats[stateOffset + 2]
            ];
            const velocity = [
              terminalStateFloats[stateOffset + 4],
              terminalStateFloats[stateOffset + 5],
              terminalStateFloats[stateOffset + 6]
            ];
            const specificInternalEnergyJPerKg =
              terminalStateFloats[stateOffset + 7];
            const temperatureK =
              terminalThermoFloats[thermoOffset + 2];
            const phaseFractions = [
              terminalThermoFloats[thermoOffset + 4],
              terminalThermoFloats[thermoOffset + 5],
              terminalThermoFloats[thermoOffset + 6],
              terminalThermoFloats[thermoOffset + 7]
            ];
            const affineCPerS = Array.from(
              terminalMechanicsFloats.slice(
                mechanicsOffset + 9,
                mechanicsOffset + 18
              )
            );
            if (
              !Number.isFinite(mass)
              || !position.every(Number.isFinite)
              || !velocity.every(Number.isFinite)
              || !Number.isFinite(specificInternalEnergyJPerKg)
              || !Number.isFinite(temperatureK)
              || !phaseFractions.every(Number.isFinite)
              || !affineCPerS.every(Number.isFinite)
            ) {
              nonfiniteRowCount += 1;
              continue;
            }
            liveParticleCount += 1;
            massKg += mass;
            internalEnergyJ += mass * specificInternalEnergyJPerKg;
            temperatureMassMomentKgK += mass * temperatureK;
            temperatureMassKg += mass;
            minimumTemperatureK = Math.min(
              minimumTemperatureK,
              temperatureK
            );
            maximumTemperatureK = Math.max(
              maximumTemperatureK,
              temperatureK
            );
            for (let axis = 0; axis < 3; axis += 1) {
              positionMassMomentKgM[axis] += mass * position[axis];
              momentumKgMPerS[axis] += mass * velocity[axis];
              minimumPositionM[axis] = Math.min(
                minimumPositionM[axis],
                position[axis]
              );
              maximumPositionM[axis] = Math.max(
                maximumPositionM[axis],
                position[axis]
              );
            }
            angularMomentumAboutOriginKgM2PerS[0] += mass * (
              position[1] * velocity[2] - position[2] * velocity[1]
            );
            angularMomentumAboutOriginKgM2PerS[1] += mass * (
              position[2] * velocity[0] - position[0] * velocity[2]
            );
            angularMomentumAboutOriginKgM2PerS[2] += mass * (
              position[0] * velocity[1] - position[1] * velocity[0]
            );
            const apicMomentM2 = gridSpacingM * gridSpacingM * 0.25;
            affineAngularMomentumKgM2PerS[0] += mass * apicMomentM2 * (
              affineCPerS[7] - affineCPerS[5]
            );
            affineAngularMomentumKgM2PerS[1] += mass * apicMomentM2 * (
              affineCPerS[2] - affineCPerS[6]
            );
            affineAngularMomentumKgM2PerS[2] += mass * apicMomentM2 * (
              affineCPerS[3] - affineCPerS[1]
            );
            kineticEnergyJ += 0.5 * mass * (
              velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2
            );
            phaseMassKg.solid += mass * phaseFractions[0];
            phaseMassKg.liquid += mass * phaseFractions[1];
            phaseMassKg.gas += mass * phaseFractions[2];
            phaseMassKg.plasma += mass * phaseFractions[3];
            let positivePhaseCount = 0;
            for (
              let phaseIndex = 0;
              phaseIndex < phaseFractions.length;
              phaseIndex += 1
            ) {
              if (!(phaseFractions[phaseIndex] > 0)) continue;
              phaseCarrierCount[phaseNames[phaseIndex]] += 1;
              positivePhaseCount += 1;
            }
            if (positivePhaseCount > 1) transitionCarrierCount += 1;
          }
          const centerOfMassM = massKg > 0
            ? positionMassMomentKgM.map((value) => value / massKg)
            : null;
          const centerOfMassVelocityMPerS = massKg > 0
            ? momentumKgMPerS.map((value) => value / massKg)
            : null;
          const orbitalAngularMomentumKgM2PerS = centerOfMassM
            ? [
                centerOfMassM[1] * momentumKgMPerS[2]
                  - centerOfMassM[2] * momentumKgMPerS[1],
                centerOfMassM[2] * momentumKgMPerS[0]
                  - centerOfMassM[0] * momentumKgMPerS[2],
                centerOfMassM[0] * momentumKgMPerS[1]
                  - centerOfMassM[1] * momentumKgMPerS[0]
              ]
            : null;
          const angularMomentumAboutCenterOfMassKgM2PerS =
            orbitalAngularMomentumKgM2PerS
              ? angularMomentumAboutOriginKgM2PerS.map(
                  (value, axis) => value
                    - orbitalAngularMomentumKgM2PerS[axis]
                )
              : null;
          const totalAngularMomentumAboutCenterOfMassKgM2PerS =
            angularMomentumAboutCenterOfMassKgM2PerS
              ? angularMomentumAboutCenterOfMassKgM2PerS.map(
                  (value, axis) => value
                    + affineAngularMomentumKgM2PerS[axis]
                )
              : null;
          const centerOfMassKineticEnergyJ = centerOfMassVelocityMPerS
            ? 0.5 * massKg * centerOfMassVelocityMPerS.reduce(
                (sum, value) => sum + value * value,
                0
              )
            : null;
          return {
            liveParticleCount,
            nonfiniteRowCount,
            massKg,
            centerOfMassM,
            centerOfMassVelocityMPerS,
            angularMomentumAboutCenterOfMassKgM2PerS:
              angularMomentumAboutCenterOfMassKgM2PerS
                ? finiteVectorOrNull(
                    angularMomentumAboutCenterOfMassKgM2PerS
                  )
                : null,
            affineAngularMomentumKgM2PerS:
              finiteVectorOrNull(affineAngularMomentumKgM2PerS),
            totalAngularMomentumAboutCenterOfMassKgM2PerS:
              totalAngularMomentumAboutCenterOfMassKgM2PerS
                ? finiteVectorOrNull(
                    totalAngularMomentumAboutCenterOfMassKgM2PerS
                  )
                : null,
            kineticEnergyJ,
            centerOfMassKineticEnergyJ,
            relativeKineticEnergyJ:
              Number.isFinite(centerOfMassKineticEnergyJ)
                ? Math.max(0, kineticEnergyJ - centerOfMassKineticEnergyJ)
                : null,
            minimumPositionM: finiteVectorOrNull(minimumPositionM),
            maximumPositionM: finiteVectorOrNull(maximumPositionM),
            temperatureK: {
              minimum: Number.isFinite(minimumTemperatureK)
                ? minimumTemperatureK
                : null,
              maximum: Number.isFinite(maximumTemperatureK)
                ? maximumTemperatureK
                : null,
              massWeightedMean: temperatureMassKg > 0
                ? temperatureMassMomentKgK / temperatureMassKg
                : null
            },
            phaseMassKg,
            phaseCarrierCount,
            transitionCarrierCount,
            internalEnergyJ
          };
        };
        const summarizeThermalTransfer = (
          profileSlot,
          lineageBegin,
          lineageEnd,
          dtS
        ) => {
          const stateBase = profileSlot * stateStrideWords;
          const thermalBase = profileSlot * thermalStrideWords;
          const totals = {
            conduction: {
              nonzeroRowCount: 0,
              positiveEnergyJ: 0,
              negativeEnergyJ: 0,
              netEnergyJ: 0,
              sumAbsEnergyJ: 0,
              maxAbsRowEnergyJ: 0
            },
            radiation: {
              nonzeroRowCount: 0,
              positiveEnergyJ: 0,
              negativeEnergyJ: 0,
              netEnergyJ: 0,
              sumAbsEnergyJ: 0,
              maxAbsRowEnergyJ: 0
            }
          };
          for (let index = 0; index < particleCount; index += 1) {
            if (!inLineageRange(index, lineageBegin, lineageEnd)) continue;
            const mass = matchedStateFloats[
              stateBase + index * 8 + 3
            ];
            if (!(mass > 0) || !Number.isFinite(mass)) continue;
            const thermalOffset = thermalBase + index * thermalRowWords;
            const rowEnergiesJ = [
              mass * thermalRowFloats[thermalOffset],
              mass * thermalRowFloats[thermalOffset + 1]
            ];
            for (let lane = 0; lane < rowEnergiesJ.length; lane += 1) {
              const family = lane === 0
                ? totals.conduction
                : totals.radiation;
              const energyJ = rowEnergiesJ[lane];
              if (!Number.isFinite(energyJ) || energyJ === 0) continue;
              family.nonzeroRowCount += 1;
              if (energyJ > 0) {
                family.positiveEnergyJ += energyJ;
              } else {
                family.negativeEnergyJ += energyJ;
              }
              family.netEnergyJ += energyJ;
              const absoluteEnergyJ = Math.abs(energyJ);
              family.sumAbsEnergyJ += absoluteEnergyJ;
              family.maxAbsRowEnergyJ = Math.max(
                family.maxAbsRowEnergyJ,
                absoluteEnergyJ
              );
            }
          }
          for (const family of [
            totals.conduction,
            totals.radiation
          ]) {
            family.netPowerW = Number.isFinite(dtS) && dtS > 0
              ? family.netEnergyJ / dtS
              : null;
          }
          return totals;
        };
        const summarizeProfiledCrossMaterialProximity = (profileSlot) => {
          const stateBase = profileSlot * stateStrideWords;
          const mechanicsBase = profileSlot * mechanicsStrideWords;
          const h2oIndices = [];
          const ironIndices = [];
          for (let index = 0; index < particleCount; index += 1) {
            if (!(matchedStateFloats[stateBase + index * 8 + 3] > 0)) {
              continue;
            }
            const family = materialFamily(index);
            if (family === 'h2o') h2oIndices.push(index);
            if (family === 'fe') ironIndices.push(index);
          }
          let minimumDistanceM = Number.POSITIVE_INFINITY;
          let minimumChebyshevGapM = Number.POSITIVE_INFINITY;
          let minimumChebyshevPair = null;
          let finiteVolumeFaceContactPairCount = 0;
          for (const h2oIndex of h2oIndices) {
            const h2oStateOffset = stateBase + h2oIndex * 8;
            const h2oEdgeM = Math.cbrt(Math.max(
              profiledMechanicsFloats[
                mechanicsBase + h2oIndex * 32 + 19
              ],
              0
            ));
            for (const ironIndex of ironIndices) {
              const ironStateOffset = stateBase + ironIndex * 8;
              const ironEdgeM = Math.cbrt(Math.max(
                profiledMechanicsFloats[
                  mechanicsBase + ironIndex * 32 + 19
                ],
                0
              ));
              const deltaX = Math.abs(
                matchedStateFloats[h2oStateOffset]
                  - matchedStateFloats[ironStateOffset]
              );
              const deltaY = Math.abs(
                matchedStateFloats[h2oStateOffset + 1]
                  - matchedStateFloats[ironStateOffset + 1]
              );
              const deltaZ = Math.abs(
                matchedStateFloats[h2oStateOffset + 2]
                  - matchedStateFloats[ironStateOffset + 2]
              );
              const halfSumM = 0.5 * (h2oEdgeM + ironEdgeM);
              const distanceM = Math.hypot(deltaX, deltaY, deltaZ);
              const chebyshevGapM =
                Math.max(deltaX, deltaY, deltaZ) - halfSumM;
              minimumDistanceM = Math.min(minimumDistanceM, distanceM);
              if (chebyshevGapM < minimumChebyshevGapM) {
                minimumChebyshevGapM = chebyshevGapM;
                minimumChebyshevPair = {
                  h2oIndex,
                  ironIndex,
                  distanceM,
                  h2oEdgeM,
                  ironEdgeM
                };
              }
              if (
                chebyshevGapM
                  <= Math.max(1e-5, halfSumM * 1e-5)
              ) {
                finiteVolumeFaceContactPairCount += 1;
              }
            }
          }
          return {
            h2oLiveParticleCount: h2oIndices.length,
            ironLiveParticleCount: ironIndices.length,
            evaluatedPairCount: h2oIndices.length * ironIndices.length,
            minimumDistanceM: Number.isFinite(minimumDistanceM)
              ? minimumDistanceM
              : null,
            minimumChebyshevGapM:
              Number.isFinite(minimumChebyshevGapM)
                ? minimumChebyshevGapM
                : null,
            finiteVolumeFaceContactPairCount,
            minimumChebyshevPair
          };
        };
        const summarizeProfiledInterfaceReceipt = (profileSlot) => {
          const headerWords = observedProposal.interfaceReceiptHeaderWords;
          const rowWords = observedProposal.interfaceReceiptRowWords;
          const receiptBase = profileSlot * receiptStrideWords;
          const offsetBase = receiptBase + headerWords;
          const rowBase = offsetBase + particleCount + 1;
          const receiptEnd = receiptBase + receiptStrideWords;
          const publishedRowCount =
            profiledInterfaceReceiptSnapshots[receiptBase + 13] ?? 0;
          const materializedRowCount =
            profiledInterfaceReceiptSnapshots[receiptBase + 14] ?? 0;
          const statusFlags =
            profiledInterfaceReceiptSnapshots[receiptBase + 15] ?? 0;
          let layoutValid = Boolean(
            profiledInterfaceReceiptSnapshots[receiptBase]
              === pairGraphAbi
                .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC
            && profiledInterfaceReceiptSnapshots[receiptBase + 1]
              === pairGraphAbi
                .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION
            && profiledInterfaceReceiptSnapshots[receiptBase + 10]
              === particleCount
            && profiledInterfaceReceiptSnapshots[receiptBase + 12]
              === particleCount + 1
            && materializedRowCount === publishedRowCount
            && rowBase + publishedRowCount * rowWords <= receiptEnd
          );
          let feH2oActiveDirectedRowCount = 0;
          let feH2oActiveDirectedFaceAreaM2 = 0;
          let feH2oLiveActiveDirectedRowCount = 0;
          let feH2oLiveActiveDirectedFaceAreaM2 = 0;
          const feH2oActiveDirectedFaceAreasM2 = [];
          const matchedStateBase = profileSlot * stateStrideWords;
          const particleLive = (index) => (
            matchedStateFloats[matchedStateBase + index * 8 + 3] > 0
          );
          if (layoutValid) {
            for (
              let selfIndex = 0;
              selfIndex < particleCount;
              selfIndex += 1
            ) {
              const begin =
                profiledInterfaceReceiptSnapshots[
                  offsetBase + selfIndex
                ] ?? 0;
              const end =
                profiledInterfaceReceiptSnapshots[
                  offsetBase + selfIndex + 1
                ] ?? 0;
              if (begin > end || end > publishedRowCount) {
                layoutValid = false;
                break;
              }
              const selfFamily = materialFamily(selfIndex);
              if (selfFamily === 'other') continue;
              for (let cursor = begin; cursor < end; cursor += 1) {
                const row = rowBase + cursor * rowWords;
                const otherIndex =
                  profiledInterfaceReceiptSnapshots[row];
                if (
                  otherIndex >= particleCount
                  || materialFamily(otherIndex) === selfFamily
                  || materialFamily(otherIndex) === 'other'
                ) continue;
                const signedAreaM2 = interfaceReceiptFloats[row + 1];
                if (Number.isFinite(signedAreaM2) && signedAreaM2 > 0) {
                  feH2oActiveDirectedRowCount += 1;
                  feH2oActiveDirectedFaceAreaM2 += signedAreaM2;
                  feH2oActiveDirectedFaceAreasM2.push(signedAreaM2);
                  if (particleLive(selfIndex) && particleLive(otherIndex)) {
                    feH2oLiveActiveDirectedRowCount += 1;
                    feH2oLiveActiveDirectedFaceAreaM2 += signedAreaM2;
                  }
                }
              }
            }
          }
          return {
            magic:
              profiledInterfaceReceiptSnapshots[receiptBase] ?? null,
            version:
              profiledInterfaceReceiptSnapshots[receiptBase + 1] ?? null,
            publishedRowCount,
            materializedRowCount,
            statusFlags,
            admitted: statusFlags === (
              pairGraphAbi
                .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY
              | pairGraphAbi
                .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED
            ),
            layoutValid,
            feH2oActiveDirectedRowCount,
            feH2oActiveDirectedFaceAreaM2,
            feH2oLiveActiveDirectedRowCount,
            feH2oLiveActiveDirectedFaceAreaM2,
            feH2oActiveDirectedFaceAreaDistribution: (() => {
              const sorted = feH2oActiveDirectedFaceAreasM2
                .slice()
                .sort((left, right) => left - right);
              const quantile = (fraction) => sorted.length > 0
                ? sorted[Math.min(
                    sorted.length - 1,
                    Math.floor(fraction * (sorted.length - 1))
                  )]
                : null;
              return {
                count: sorted.length,
                minimumM2: sorted[0] ?? null,
                p25M2: quantile(0.25),
                p50M2: quantile(0.5),
                p75M2: quantile(0.75),
                p90M2: quantile(0.9),
                maximumM2: sorted.at(-1) ?? null,
                countAtMost1e12M2: sorted.filter(
                  (areaM2) => areaM2 <= 1e-12
                ).length,
                countAtMost1e10M2: sorted.filter(
                  (areaM2) => areaM2 <= 1e-10
                ).length,
                countAtMost1e8M2: sorted.filter(
                  (areaM2) => areaM2 <= 1e-8
                ).length,
                countAtMost1e7M2: sorted.filter(
                  (areaM2) => areaM2 <= 1e-7
                ).length,
                countAtMost1e6M2: sorted.filter(
                  (areaM2) => areaM2 <= 1e-6
                ).length,
                smallestM2: sorted.slice(0, 12),
                transitionM2: sorted.slice(
                  Math.max(0, sorted.length - 90),
                  Math.max(0, sorted.length - 60)
                ),
                largestM2: sorted.slice(-12)
              };
            })()
          };
        };

        return profileStateSteps.map((step, profileSlot) => {
          const dtS = profiledCapture.thermalDtS[profileSlot];
          const h2o = summarizeTerminalMaterial(
            profileSlot,
            0,
            1000
          );
          const iron = summarizeTerminalMaterial(
            profileSlot,
            1000,
            1216
          );
          const h2oTransfer = summarizeThermalTransfer(
            profileSlot,
            0,
            1000,
            dtS
          );
          const ironTransfer = summarizeThermalTransfer(
            profileSlot,
            1000,
            1216,
            dtS
          );
          return {
            step,
            timeS: Number.isFinite(dtS) ? step * dtS : null,
            dtS,
            capture: {
              matchedState: profiledCapture.matchedState[profileSlot],
              mechanics: profiledCapture.mechanics[profileSlot],
              terminalState: profiledCapture.terminalState[profileSlot],
              terminalThermo: profiledCapture.terminalThermo[profileSlot],
              thermalRows: profiledCapture.thermalRows[profileSlot],
              interfaceReceipt:
                profiledCapture.interfaceReceipt[profileSlot]
            },
            crossMaterialProximity:
              summarizeProfiledCrossMaterialProximity(profileSlot),
            contactInterfaceReceipt:
              summarizeProfiledInterfaceReceipt(profileSlot),
            h2o: {
              ...h2o,
              thermalTransfer: h2oTransfer
            },
            iron: {
              ...iron,
              thermalTransfer: ironTransfer
            },
            totalInternalEnergyJ:
              h2o.internalEnergyJ + iron.internalEnergyJ,
            combinedThermalTransfer: {
              conductionEnergyJ:
                h2oTransfer.conduction.netEnergyJ
                  + ironTransfer.conduction.netEnergyJ,
              radiationEnergyJ:
                h2oTransfer.radiation.netEnergyJ
                  + ironTransfer.radiation.netEnergyJ
            }
          };
        });
      };
      const profiledThermalCheckpoints =
        summarizeProfiledThermalCheckpoints();
      const controlWordCount =
        observedProposal.contactGraph.layout.bufferLayouts.control.byteLength
          / Uint32Array.BYTES_PER_ELEMENT;
      const matchingCleanupWordCount =
        observedProposal.contactGraph.layout.bufferLayouts
          .matchingCleanupControl.byteLength / Uint32Array.BYTES_PER_ELEMENT;
      const historyStrideWords =
        controlWordCount
          + observedProposal.evidence.wordCount
          + matchingCleanupWordCount;
      const historyEntryCount = Math.min(
        stepCount,
        observedProposalCount
      );
      let firstFailureStep = null;
      let lastFailureStep = null;
      let failureStepCount = 0;
      let admittedStepCount = 0;
      let stickyFailureBitsUnion = 0;
      let positionResidualFailureStepCount = 0;
      let velocityResidualFailureStepCount = 0;
      let maxHistoricalPositionResidualM = 0;
      let maxHistoricalVelocityResidualMPerS = 0;
      let matchingActiveStepCount = 0;
      let firstMatchingActiveStep = null;
      let lastMatchingActiveStep = null;
      let totalMatchingAppliedPairCount = 0;
      const maxMatchingAppliedPairCountByPass =
        Array(matchingCleanupPassCount).fill(0);
      const maxMatchingPositionRatioByPass =
        Array(matchingCleanupPassCount).fill(0);
      const maxMatchingVelocityResidualMPerSByPass =
        Array(matchingCleanupPassCount).fill(0);
      const matchingProfilesAtFormerFailureSteps = {};
      const matchingProfileSteps = new Set([
        541,
        626,
        629,
        652,
        655,
        766,
        767,
        769,
        790,
        791,
        792,
        ...profileStateSteps,
        ...traceSteps
      ]);
      const maxPreSolvePositionResidualMByIteration =
        Array(solverIterationCount).fill(0);
      const maxPreSolvePositionViolationRatioByIteration =
        Array(solverIterationCount).fill(0);
      const maxPreSolveVelocityResidualMPerSByIteration =
        Array(solverIterationCount).fill(0);
      const maxFailedPreSolvePositionResidualMByIteration =
        Array(solverIterationCount).fill(0);
      const maxFailedPreSolvePositionViolationRatioByIteration =
        Array(solverIterationCount).fill(0);
      const maxFailedPreSolveVelocityResidualMPerSByIteration =
        Array(solverIterationCount).fill(0);
      let firstFailureRoundProfile = null;
      let worstVelocityFailureRoundProfile = null;
      const failureRanges = [];
      let openFailureRange = null;
      for (let index = 0; index < historyEntryCount; index += 1) {
        const base = index * historyStrideWords;
        const evidenceBase = base + controlWordCount;
        const matchingBase =
          evidenceBase + observedProposal.evidence.wordCount;
        const statusFlags = proposalHistory[evidenceBase + 2];
        const stickyFailureBits = proposalHistory[base + 14];
        const publicationCount = proposalHistory[base + 18];
        const positionResidualM = bitsToFloat(proposalHistory[base + 27]);
        const velocityResidualMPerS = bitsToFloat(
          proposalHistory[base + 28]
        );
        const preSolvePositionResidualM = Array.from(
          { length: solverIterationCount },
          (_, iteration) => bitsToFloat(proposalHistory[
            base
              + controlWord.preSolveMaxPositionResidualOrderedF32_0
              + iteration
          ])
        );
        const preSolvePositionViolationRatio = Array.from(
          { length: solverIterationCount },
          (_, iteration) => bitsToFloat(proposalHistory[
            base
              + controlWord.preSolveMaxPositionViolationRatioOrderedF32_0
              + iteration
          ])
        );
        const preSolveVelocityResidualMPerS = Array.from(
          { length: solverIterationCount },
          (_, iteration) => bitsToFloat(proposalHistory[
            base
              + controlWord.preSolveMaxVelocityResidualOrderedF32_0
              + iteration
          ])
        );
        const matchingSelectionCountWord = 12;
        const matchingAppliedPairCountWord =
          matchingSelectionCountWord + 4 * matchingCleanupPassCount;
        const matchingMaxPositionRatioWord =
          matchingAppliedPairCountWord + matchingCleanupPassCount;
        const matchingMaxVelocityResidualWord =
          matchingMaxPositionRatioWord + matchingCleanupPassCount;
        const matchingAppliedPairCountByPass = Array.from(
          { length: matchingCleanupPassCount },
          (_, pass) => proposalHistory[
            matchingBase + matchingAppliedPairCountWord + pass
          ]
        );
        const matchingPositionRatioByPass = Array.from(
          { length: matchingCleanupPassCount },
          (_, pass) => bitsToFloat(
            proposalHistory[
              matchingBase + matchingMaxPositionRatioWord + pass
            ]
          )
        );
        const matchingVelocityResidualMPerSByPass = Array.from(
          { length: matchingCleanupPassCount },
          (_, pass) => bitsToFloat(
            proposalHistory[
              matchingBase + matchingMaxVelocityResidualWord + pass
            ]
          )
        );
        const matchingAppliedPairCount = matchingAppliedPairCountByPass.reduce(
          (sum, value) => sum + value,
          0
        );
        if (matchingAppliedPairCount > 0) {
          const step = index + 1;
          matchingActiveStepCount += 1;
          firstMatchingActiveStep ??= step;
          lastMatchingActiveStep = step;
          totalMatchingAppliedPairCount += matchingAppliedPairCount;
        }
        for (
          let pass = 0;
          pass < matchingCleanupPassCount;
          pass += 1
        ) {
          maxMatchingAppliedPairCountByPass[pass] = Math.max(
            maxMatchingAppliedPairCountByPass[pass],
            matchingAppliedPairCountByPass[pass]
          );
          maxMatchingPositionRatioByPass[pass] = Math.max(
            maxMatchingPositionRatioByPass[pass],
            matchingPositionRatioByPass[pass]
          );
          maxMatchingVelocityResidualMPerSByPass[pass] = Math.max(
            maxMatchingVelocityResidualMPerSByPass[pass],
            matchingVelocityResidualMPerSByPass[pass]
          );
        }
        if (matchingProfileSteps.has(index + 1)) {
          matchingProfilesAtFormerFailureSteps[index + 1] = {
            appliedPairCountByPass: matchingAppliedPairCountByPass,
            maxPositionRatioByPass: matchingPositionRatioByPass,
            maxVelocityResidualMPerSByPass:
              matchingVelocityResidualMPerSByPass
          };
        }
        for (
          let iteration = 0;
          iteration < solverIterationCount;
          iteration += 1
        ) {
          maxPreSolvePositionResidualMByIteration[iteration] = Math.max(
            maxPreSolvePositionResidualMByIteration[iteration],
            preSolvePositionResidualM[iteration]
          );
          maxPreSolvePositionViolationRatioByIteration[iteration] = Math.max(
            maxPreSolvePositionViolationRatioByIteration[iteration],
            preSolvePositionViolationRatio[iteration]
          );
          maxPreSolveVelocityResidualMPerSByIteration[iteration] = Math.max(
            maxPreSolveVelocityResidualMPerSByIteration[iteration],
            preSolveVelocityResidualMPerS[iteration]
          );
        }
        maxHistoricalPositionResidualM = Math.max(
          maxHistoricalPositionResidualM,
          positionResidualM
        );
        maxHistoricalVelocityResidualMPerS = Math.max(
          maxHistoricalVelocityResidualMPerS,
          velocityResidualMPerS
        );
        const failed =
          statusFlags !== 3
          || stickyFailureBits !== 0
          || publicationCount !== observedProposal.particleCount;
        if (!failed) {
          admittedStepCount += 1;
          if (openFailureRange) {
            failureRanges.push(openFailureRange);
            openFailureRange = null;
          }
          continue;
        }
        const step = index + 1;
        firstFailureStep ??= step;
        lastFailureStep = step;
        failureStepCount += 1;
        const roundProfile = {
          step,
          preSolvePositionResidualM,
          preSolvePositionViolationRatio,
          preSolveVelocityResidualMPerS,
          matchingAppliedPairCountByPass,
          matchingPositionRatioByPass,
          matchingVelocityResidualMPerSByPass,
          finalPositionResidualM: positionResidualM,
          finalVelocityResidualMPerS: velocityResidualMPerS
        };
        firstFailureRoundProfile ??= roundProfile;
        if (
          !worstVelocityFailureRoundProfile
          || velocityResidualMPerS
            > worstVelocityFailureRoundProfile.finalVelocityResidualMPerS
        ) {
          worstVelocityFailureRoundProfile = roundProfile;
        }
        for (
          let iteration = 0;
          iteration < solverIterationCount;
          iteration += 1
        ) {
          maxFailedPreSolvePositionResidualMByIteration[iteration] = Math.max(
            maxFailedPreSolvePositionResidualMByIteration[iteration],
            preSolvePositionResidualM[iteration]
          );
          maxFailedPreSolvePositionViolationRatioByIteration[iteration] =
            Math.max(
              maxFailedPreSolvePositionViolationRatioByIteration[iteration],
              preSolvePositionViolationRatio[iteration]
            );
          maxFailedPreSolveVelocityResidualMPerSByIteration[iteration] =
            Math.max(
              maxFailedPreSolveVelocityResidualMPerSByIteration[iteration],
              preSolveVelocityResidualMPerS[iteration]
            );
        }
        stickyFailureBitsUnion |= stickyFailureBits;
        if ((stickyFailureBits & (1 << 11)) !== 0) {
          positionResidualFailureStepCount += 1;
        }
        if ((stickyFailureBits & (1 << 12)) !== 0) {
          velocityResidualFailureStepCount += 1;
        }
        if (
          !openFailureRange
          || openFailureRange.stickyFailureBits !== stickyFailureBits
        ) {
          if (openFailureRange) failureRanges.push(openFailureRange);
          openFailureRange = {
            beginStep: step,
            endStep: step,
            stickyFailureBits,
            maxPositionResidualM: positionResidualM,
            maxVelocityResidualMPerS: velocityResidualMPerS
          };
        } else {
          openFailureRange.endStep = step;
          openFailureRange.maxPositionResidualM = Math.max(
            openFailureRange.maxPositionResidualM,
            positionResidualM
          );
          openFailureRange.maxVelocityResidualMPerS = Math.max(
            openFailureRange.maxVelocityResidualMPerS,
            velocityResidualMPerS
          );
        }
      }
      if (openFailureRange) failureRanges.push(openFailureRange);
      if (deepDiagnosticCaptureRequested) {
        proposalHistoryBuffer.destroy();
      } else if (
        proposalModule.destroySchroederSpatialMechanicalProposalCapture(
          mechanicalProposalCapture
        ) !== true
      ) {
        throw new Error('canonical mechanical proposal capture did not release');
      }
      const proposalFloats = new Float32Array(proposal.buffer);
      const thermalProposalFloats = new Float32Array(thermalProposal.buffer);
      let nonzeroConductionRowCount = 0;
      let nonzeroRadiationRowCount = 0;
      let maxAbsConductionSpecificEnergyDeltaJPerKg = 0;
      let maxAbsRadiationSpecificEnergyDeltaJPerKg = 0;
      for (
        let index = 0;
        index < observedThermalProposal.particleCount;
        index += 1
      ) {
        const offset =
          observedThermalProposal.proposalHeaderWords
          + index * observedThermalProposal.proposalRowWords;
        const conductionDelta = thermalProposalFloats[offset];
        const radiationDelta = thermalProposalFloats[offset + 1];
        if (conductionDelta !== 0) nonzeroConductionRowCount += 1;
        if (radiationDelta !== 0) nonzeroRadiationRowCount += 1;
        maxAbsConductionSpecificEnergyDeltaJPerKg = Math.max(
          maxAbsConductionSpecificEnergyDeltaJPerKg,
          Math.abs(conductionDelta)
        );
        maxAbsRadiationSpecificEnergyDeltaJPerKg = Math.max(
          maxAbsRadiationSpecificEnergyDeltaJPerKg,
          Math.abs(radiationDelta)
        );
      }
      const publicationAdmitted =
        evidence[2] === 3
        && control[14] === 0
        && control[18] === observedProposal.particleCount;
      let correctionSummary = null;
      if (publicationAdmitted) {
        let correctedParticleCount = 0;
        let maxPositionDeltaM = 0;
        let maxVelocityDeltaMPerS = 0;
        for (
          let index = 0;
          index < observedProposal.particleCount;
          index += 1
        ) {
          const offset =
            observedProposal.proposalHeaderWords
            + index * observedProposal.proposalRowWords;
          const positionDelta = Math.hypot(
            proposalFloats[offset],
            proposalFloats[offset + 1],
            proposalFloats[offset + 2]
          );
          const velocityDelta = Math.hypot(
            proposalFloats[offset + 4],
            proposalFloats[offset + 5],
            proposalFloats[offset + 6]
          );
          if (positionDelta > 0 || velocityDelta > 0) {
            correctedParticleCount += 1;
          }
          maxPositionDeltaM = Math.max(maxPositionDeltaM, positionDelta);
          maxVelocityDeltaMPerS = Math.max(
            maxVelocityDeltaMPerS,
            velocityDelta
          );
        }
        correctionSummary = {
          correctedParticleCount,
          maxPositionDeltaM,
          maxVelocityDeltaMPerS
        };
      }

      const scaleFloats = new Float32Array(scales.buffer);
      let finiteScaleRowCount = 0;
      let zeroRemainingTrustCount = 0;
      let minPositionDegreeScale = Number.POSITIVE_INFINITY;
      let maxPositionDegreeScale = Number.NEGATIVE_INFINITY;
      let sumPositionDegreeScale = 0;
      let minVelocityStabilityScale = Number.POSITIVE_INFINITY;
      let maxVelocityStabilityScale = Number.NEGATIVE_INFINITY;
      let sumVelocityStabilityScale = 0;
      for (
        let index = 0;
        index < observedProposal.particleCount;
        index += 1
      ) {
        const offset = index * 4;
        const positionDegreeScale = scaleFloats[offset];
        const velocityStabilityScale = scaleFloats[offset + 1];
        if (
          !Number.isFinite(positionDegreeScale)
          || !Number.isFinite(velocityStabilityScale)
        ) {
          continue;
        }
        finiteScaleRowCount += 1;
        minPositionDegreeScale = Math.min(
          minPositionDegreeScale,
          positionDegreeScale
        );
        maxPositionDegreeScale = Math.max(
          maxPositionDegreeScale,
          positionDegreeScale
        );
        sumPositionDegreeScale += positionDegreeScale;
        minVelocityStabilityScale = Math.min(
          minVelocityStabilityScale,
          velocityStabilityScale
        );
        maxVelocityStabilityScale = Math.max(
          maxVelocityStabilityScale,
          velocityStabilityScale
        );
        sumVelocityStabilityScale += velocityStabilityScale;
        if (scaleFloats[offset + 3] <= 1.0e-12) {
          zeroRemainingTrustCount += 1;
        }
      }
      const finiteOrNull = (value) => Number.isFinite(value) ? value : null;

      const stateFloats = new Float32Array(finalState.buffer);
      const mechanicsFloats = new Float32Array(finalMechanics.buffer);
      const phaseLaneStride = 1368;
      const phaseLaneCount = 4;
      const summarizeLineages = (begin, end) => {
        let liveCount = 0;
        let massKg = 0;
        const massMomentKgM = [0, 0, 0];
        const momentumKgMPerS = [0, 0, 0];
        const angularMomentumAboutOriginKgM2PerS = [0, 0, 0];
        const affineAngularMomentumKgM2PerS = [0, 0, 0];
        let kineticEnergyJ = 0;
        let massMomentYKgM = 0;
        let minYM = Number.POSITIVE_INFINITY;
        let maxYM = Number.NEGATIVE_INFINITY;
        for (let lane = 0; lane < phaseLaneCount; lane += 1) {
          for (let lineage = begin; lineage < end; lineage += 1) {
            const index = lane * phaseLaneStride + lineage;
            const offset = index * 8;
            const mass = stateFloats[offset + 3];
            if (!(mass > 0)) continue;
            const position = stateFloats.slice(offset, offset + 3);
            const velocity = stateFloats.slice(offset + 4, offset + 7);
            const mechanicsOffset = index * 32;
            const affineCPerS = mechanicsFloats.slice(
              mechanicsOffset + 9,
              mechanicsOffset + 18
            );
            const y = stateFloats[offset + 1];
            liveCount += 1;
            massKg += mass;
            massMomentYKgM += mass * y;
            for (let axis = 0; axis < 3; axis += 1) {
              massMomentKgM[axis] += mass * position[axis];
              momentumKgMPerS[axis] += mass * velocity[axis];
            }
            angularMomentumAboutOriginKgM2PerS[0] += mass * (
              position[1] * velocity[2] - position[2] * velocity[1]
            );
            angularMomentumAboutOriginKgM2PerS[1] += mass * (
              position[2] * velocity[0] - position[0] * velocity[2]
            );
            angularMomentumAboutOriginKgM2PerS[2] += mass * (
              position[0] * velocity[1] - position[1] * velocity[0]
            );
            const apicMomentM2 = gridSpacingM * gridSpacingM * 0.25;
            affineAngularMomentumKgM2PerS[0] += mass * apicMomentM2 * (
              affineCPerS[7] - affineCPerS[5]
            );
            affineAngularMomentumKgM2PerS[1] += mass * apicMomentM2 * (
              affineCPerS[2] - affineCPerS[6]
            );
            affineAngularMomentumKgM2PerS[2] += mass * apicMomentM2 * (
              affineCPerS[3] - affineCPerS[1]
            );
            kineticEnergyJ += 0.5 * mass * (
              velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2
            );
            minYM = Math.min(minYM, y);
            maxYM = Math.max(maxYM, y);
          }
        }
        const centerOfMassM = massKg > 0
          ? massMomentKgM.map((value) => value / massKg)
          : null;
        const centerOfMassVelocityMPerS = massKg > 0
          ? momentumKgMPerS.map((value) => value / massKg)
          : null;
        const orbitalAngularMomentumKgM2PerS = centerOfMassM
          ? [
              centerOfMassM[1] * momentumKgMPerS[2]
                - centerOfMassM[2] * momentumKgMPerS[1],
              centerOfMassM[2] * momentumKgMPerS[0]
                - centerOfMassM[0] * momentumKgMPerS[2],
              centerOfMassM[0] * momentumKgMPerS[1]
                - centerOfMassM[1] * momentumKgMPerS[0]
            ]
          : null;
        const angularMomentumAboutCenterOfMassKgM2PerS =
          orbitalAngularMomentumKgM2PerS
            ? angularMomentumAboutOriginKgM2PerS.map(
                (value, axis) => value
                  - orbitalAngularMomentumKgM2PerS[axis]
              )
            : null;
        const totalAngularMomentumAboutCenterOfMassKgM2PerS =
          angularMomentumAboutCenterOfMassKgM2PerS
            ? angularMomentumAboutCenterOfMassKgM2PerS.map(
                (value, axis) => value
                  + affineAngularMomentumKgM2PerS[axis]
              )
            : null;
        const centerOfMassKineticEnergyJ = centerOfMassVelocityMPerS
          ? 0.5 * massKg * centerOfMassVelocityMPerS.reduce(
              (sum, value) => sum + value * value,
              0
            )
          : null;
        return {
          liveCount,
          massKg,
          centerOfMassM,
          centerOfMassYM: massKg > 0 ? massMomentYKgM / massKg : null,
          centerOfMassVelocityMPerS,
          angularMomentumAboutCenterOfMassKgM2PerS:
            angularMomentumAboutCenterOfMassKgM2PerS?.every(Number.isFinite)
              ? angularMomentumAboutCenterOfMassKgM2PerS
              : null,
          affineAngularMomentumKgM2PerS:
            affineAngularMomentumKgM2PerS.every(Number.isFinite)
              ? affineAngularMomentumKgM2PerS
              : null,
          totalAngularMomentumAboutCenterOfMassKgM2PerS:
            totalAngularMomentumAboutCenterOfMassKgM2PerS
              ?.every(Number.isFinite)
              ? totalAngularMomentumAboutCenterOfMassKgM2PerS
              : null,
          kineticEnergyJ,
          centerOfMassKineticEnergyJ,
          relativeKineticEnergyJ:
            Number.isFinite(centerOfMassKineticEnergyJ)
              ? Math.max(0, kineticEnergyJ - centerOfMassKineticEnergyJ)
              : null,
          minYM: Number.isFinite(minYM) ? minYM : null,
          maxYM: Number.isFinite(maxYM) ? maxYM : null
        };
      };
      const summarizeLineageThermalEnergy = (begin, end) => {
        let liveRowCount = 0;
        let nonzeroConductionRowCount = 0;
        let positiveConductionRowCount = 0;
        let negativeConductionRowCount = 0;
        let conductionEnergyJ = 0;
        let sumAbsConductionEnergyJ = 0;
        let maxAbsConductionEnergyJ = 0;
        let nonzeroRadiationRowCount = 0;
        let positiveRadiationRowCount = 0;
        let negativeRadiationRowCount = 0;
        let radiationEnergyJ = 0;
        let sumAbsRadiationEnergyJ = 0;
        let maxAbsRadiationEnergyJ = 0;
        for (let lane = 0; lane < phaseLaneCount; lane += 1) {
          for (let lineage = begin; lineage < end; lineage += 1) {
            const index = lane * phaseLaneStride + lineage;
            const stateOffset = index * 8;
            const massKg = stateFloats[stateOffset + 3];
            if (!(massKg > 0)) continue;
            liveRowCount += 1;
            const proposalOffset =
              observedThermalProposal.proposalHeaderWords
              + index * observedThermalProposal.proposalRowWords;
            const rowConductionEnergyJ =
              massKg * thermalProposalFloats[proposalOffset];
            const rowRadiationEnergyJ =
              massKg * thermalProposalFloats[proposalOffset + 1];
            if (rowConductionEnergyJ !== 0) {
              nonzeroConductionRowCount += 1;
              if (rowConductionEnergyJ > 0) {
                positiveConductionRowCount += 1;
              } else {
                negativeConductionRowCount += 1;
              }
              conductionEnergyJ += rowConductionEnergyJ;
              const absoluteEnergyJ = Math.abs(rowConductionEnergyJ);
              sumAbsConductionEnergyJ += absoluteEnergyJ;
              maxAbsConductionEnergyJ = Math.max(
                maxAbsConductionEnergyJ,
                absoluteEnergyJ
              );
            }
            if (rowRadiationEnergyJ !== 0) {
              nonzeroRadiationRowCount += 1;
              if (rowRadiationEnergyJ > 0) {
                positiveRadiationRowCount += 1;
              } else {
                negativeRadiationRowCount += 1;
              }
              radiationEnergyJ += rowRadiationEnergyJ;
              const absoluteEnergyJ = Math.abs(rowRadiationEnergyJ);
              sumAbsRadiationEnergyJ += absoluteEnergyJ;
              maxAbsRadiationEnergyJ = Math.max(
                maxAbsRadiationEnergyJ,
                absoluteEnergyJ
              );
            }
          }
        }
        return {
          liveRowCount,
          conduction: {
            nonzeroRowCount: nonzeroConductionRowCount,
            positiveRowCount: positiveConductionRowCount,
            negativeRowCount: negativeConductionRowCount,
            netEnergyJ: conductionEnergyJ,
            sumAbsEnergyJ: sumAbsConductionEnergyJ,
            maxAbsRowEnergyJ: maxAbsConductionEnergyJ
          },
          radiation: {
            nonzeroRowCount: nonzeroRadiationRowCount,
            positiveRowCount: positiveRadiationRowCount,
            negativeRowCount: negativeRadiationRowCount,
            netEnergyJ: radiationEnergyJ,
            sumAbsEnergyJ: sumAbsRadiationEnergyJ,
            maxAbsRowEnergyJ: maxAbsRadiationEnergyJ
          }
        };
      };

      console.info('ulg-iron-ice-native-stage:analysis-complete');
      return {
        status: 'executed',
        stepCount,
        executionStatus: execution?.status ?? null,
        completedStepCount: execution?.completedStepCount ?? null,
        residentSubmissionHostElapsedMs,
        terminalGpuDrainAndReadbackElapsedMs,
        nextTimeS: execution?.nextSphParticleState?.time ?? null,
        gridSpacingM,
        proposalHistory: {
          observedProposalCount,
          historyEntryCount,
          admittedStepCount,
          failureStepCount,
          firstFailureStep,
          lastFailureStep,
          stickyFailureBitsUnion,
          positionResidualFailureStepCount,
          velocityResidualFailureStepCount,
          maxPositionResidualM: maxHistoricalPositionResidualM,
          maxVelocityResidualMPerS:
            maxHistoricalVelocityResidualMPerS,
          matchingCleanup: {
            matchingActiveStepCount,
            firstMatchingActiveStep,
            lastMatchingActiveStep,
            totalMatchingAppliedPairCount,
            maxAppliedPairCountByPass: maxMatchingAppliedPairCountByPass,
            maxPositionRatioByPass: maxMatchingPositionRatioByPass,
            maxVelocityResidualMPerSByPass:
              maxMatchingVelocityResidualMPerSByPass,
            formerFailureStepProfiles:
              matchingProfilesAtFormerFailureSteps
          },
          roundTelemetry: {
            solverIterationCount,
            maxPreSolvePositionResidualMByIteration,
            maxPreSolvePositionViolationRatioByIteration,
            maxPreSolveVelocityResidualMPerSByIteration,
            maxFailedPreSolvePositionResidualMByIteration,
            maxFailedPreSolvePositionViolationRatioByIteration,
            maxFailedPreSolveVelocityResidualMPerSByIteration,
            firstFailureRoundProfile,
            worstVelocityFailureRoundProfile
          },
          failureRanges
        },
        thermalProposal: {
          directoryAbiVersion: observedThermalProposal.directoryAbiVersion,
          activeSourceProjectionMode:
            observedThermalProposal.activeSourceProjectionMode,
          conductionInvalidCount: thermalProposal[6],
          radiationInvalidCount: thermalProposal[7],
          publishedRowCount: thermalProposal[15],
          nonzeroConductionRowCount,
          nonzeroRadiationRowCount,
          maxAbsConductionSpecificEnergyDeltaJPerKg,
          maxAbsRadiationSpecificEnergyDeltaJPerKg,
          conductionEvidence: Array.from(conductionEvidence),
          radiationEvidence: Array.from(radiationEvidence)
        },
        proposal: {
          directoryAbiVersion: observedProposal.directoryAbiVersion,
          projectionMode: observedProposal.spatialProjectionMode,
          statusFlags: evidence[2],
          appendAttemptCount: evidence[14],
          publishedDirectedPairCount: evidence[17],
          invalidSourceCount: evidence[19],
          candidateVisitCount: evidence[40],
          projectedPeerVisitCount: evidence[47],
          stickyFailureBits: control[14],
          completedStageMask: control[15],
          publicationCount: control[18],
          maxPositionResidualM: bitsToFloat(control[27]),
          maxVelocityResidualMPerS: bitsToFloat(control[28]),
          correctionSummary,
          matchingCleanupOwnerWorkspaceHeader: {
            dispatch: Array.from(
              matchingCleanupOwnerWorkspaceHeader.slice(0, 3)
            ),
            activeParticleCount:
              matchingCleanupOwnerWorkspaceHeader[3] ?? null,
            activeIncidentCursorCount:
              matchingCleanupOwnerWorkspaceHeader[4] ?? null
          },
          scales: {
            finiteScaleRowCount,
            zeroRemainingTrustCount,
            minPositionDegreeScale: finiteOrNull(minPositionDegreeScale),
            maxPositionDegreeScale: finiteOrNull(maxPositionDegreeScale),
            meanPositionDegreeScale: finiteScaleRowCount > 0
              ? sumPositionDegreeScale / finiteScaleRowCount
              : null,
            minVelocityStabilityScale: finiteOrNull(
              minVelocityStabilityScale
            ),
            maxVelocityStabilityScale: finiteOrNull(
              maxVelocityStabilityScale
            ),
            meanVelocityStabilityScale: finiteScaleRowCount > 0
              ? sumVelocityStabilityScale / finiteScaleRowCount
              : null
          }
        },
        contactInterfaceReceipt,
        crossMaterialProximity,
        contactTrace,
        profiledContactStates,
        starProfiles,
        profiledMechanicsFieldCheckpoints,
        profiledThermalCheckpoints,
        h2o: {
          ...summarizeLineages(0, 1000),
          thermalEnergy: summarizeLineageThermalEnergy(0, 1000)
        },
        iron: {
          ...summarizeLineages(1000, 1216),
          thermalEnergy: summarizeLineageThermalEnergy(1000, 1216)
        }
      };
    }, {
      stepCount: STEP_COUNT,
      profileStateSteps: PROFILE_STATE_STEPS,
      starProfileSteps: STAR_PROFILE_STEPS,
      traceSteps: TRACE_STEPS,
      traceTargets: TRACE_TARGETS,
      surfaceMaxImpulseFraction: SURFACE_MAX_IMPULSE_FRACTION
    }).catch((error) => {
      const rejectionEvidence = {
        error: {
          name: error?.name ?? null,
          message: error?.message ?? String(error)
        },
        browserDiagnostics: browserDiagnostics.slice(-64).map((entry) => ({
          kind: entry?.kind ?? null,
          text: String(entry?.text ?? '').slice(0, 1024)
        }))
      };
      process.stdout.write(
        `# ${NATIVE_STAGE_PREFIX}page-evaluate-rejected:`
          + `${JSON.stringify(rejectionEvidence).slice(0, 8192)}\n`
      );
      throw error;
    });
    native = {
      ...native,
      browserDiagnostics
    };
  } finally {
    await browser.close();
  }

  console.log(`IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC ${JSON.stringify(native)}`);
  assert.equal(native.status, 'executed', JSON.stringify(native));
  assert.equal(native.completedStepCount, STEP_COUNT, JSON.stringify(native));
  if (MAX_RESIDENT_HOST_SUBMISSION_MS != null) {
    assert.ok(
      Number.isFinite(native.residentSubmissionHostElapsedMs)
        && native.residentSubmissionHostElapsedMs
          <= MAX_RESIDENT_HOST_SUBMISSION_MS,
      JSON.stringify({
        residentSubmissionHostElapsedMs:
          native.residentSubmissionHostElapsedMs,
        maxResidentHostSubmissionMs: MAX_RESIDENT_HOST_SUBMISSION_MS
      })
    );
  }
  assert.equal(
    native.proposalHistory.observedProposalCount,
    STEP_COUNT,
    JSON.stringify(native)
  );
  assert.equal(
    native.proposalHistory.historyEntryCount,
    STEP_COUNT,
    JSON.stringify(native)
  );
  assert.equal(
    native.contactTrace.length,
    TRACE_STEPS.length,
    JSON.stringify(native)
  );
  for (const [traceIndex, trace] of native.contactTrace.entries()) {
    assert.equal(trace.valid, true, JSON.stringify(trace));
    assert.deepEqual(
      trace.configuredMaterials,
      [3061144, 26],
      JSON.stringify(trace)
    );
    assert.ok(
      trace.tracedCleanupPassCount > 0
        && trace.tracedCleanupPassCount
          <= trace.execution.expectedCleanupPasses,
      JSON.stringify(trace)
    );
    if (TRACE_TARGETS.length > 0) {
      assert.equal(trace.targetTail?.valid, true, JSON.stringify(trace));
      assert.deepEqual(
        trace.targetTail.targetIndices,
        TRACE_TARGETS[traceIndex],
        JSON.stringify(trace)
      );
      assert.equal(
        trace.targetTail.executedPassCount,
        trace.tracedCleanupPassCount,
        JSON.stringify(trace)
      );
      assert.equal(
        trace.targetTail.localCaptureCount,
        trace.tracedCleanupPassCount * 2,
        JSON.stringify(trace)
      );
      assert.equal(
        trace.targetTail.postWallCaptureCount,
        trace.tracedCleanupPassCount * 2,
        JSON.stringify(trace)
      );
      const expectedWinnerExactPairMatch =
        trace.winner.lowIndex != null
        && trace.winner.highIndex != null
        && TRACE_TARGETS[traceIndex].includes(trace.winner.lowIndex)
        && TRACE_TARGETS[traceIndex].includes(trace.winner.highIndex);
      assert.equal(
        trace.targetTail.winnerExactPairMatch,
        expectedWinnerExactPairMatch,
        JSON.stringify(trace)
      );
      assert.equal(
        trace.targetTail.incompleteRowCount
          + trace.targetTail.rowIdentityMismatchCount
          + trace.targetTail.nonfiniteRowCount,
        0,
        JSON.stringify(trace)
      );
      for (const row of trace.targetTail.activeRows) {
        assert.ok(
          row.selectedPeer == null
            || row.selectedPeer < trace.execution.particleCount,
          JSON.stringify(row)
        );
      }
    }
  }
  assert.equal(native.proposal.directoryAbiVersion, 2, JSON.stringify(native));
  assert.equal(
    native.proposalHistory.failureStepCount,
    0,
    JSON.stringify(native)
  );
  if (STEP_COUNT >= 687) {
    assert.ok(
      native.proposalHistory.matchingCleanup.matchingActiveStepCount > 0,
      JSON.stringify(native)
    );
  }
  assert.equal(native.proposal.statusFlags, 3, JSON.stringify(native));
  assert.equal(native.proposal.stickyFailureBits, 0, JSON.stringify(native));
  assert.equal(
    native.contactInterfaceReceipt.rowBoundsValid,
    true,
    JSON.stringify(native.contactInterfaceReceipt)
  );
  assert.ok(
    native.proposal.publishedDirectedPairCount > 0,
    JSON.stringify(native)
  );
  assert.equal(
    native.profiledThermalCheckpoints.length,
    PROFILE_STATE_STEPS.length,
    JSON.stringify(native)
  );
  for (
    let checkpointIndex = 0;
    checkpointIndex < PROFILE_STATE_STEPS.length;
    checkpointIndex += 1
  ) {
    const checkpoint = native.profiledThermalCheckpoints[checkpointIndex];
    assert.equal(
      checkpoint.step,
      PROFILE_STATE_STEPS[checkpointIndex],
      JSON.stringify(checkpoint)
    );
    assert.deepEqual(
      checkpoint.capture,
      {
        matchedState: true,
        mechanics: true,
        terminalState: true,
        terminalThermo: true,
        thermalRows: true,
        interfaceReceipt: true
      },
      JSON.stringify(checkpoint)
    );
    assert.equal(
      checkpoint.contactInterfaceReceipt.layoutValid,
      true,
      JSON.stringify(checkpoint)
    );
    assert.equal(
      checkpoint.contactInterfaceReceipt.admitted,
      true,
      JSON.stringify(checkpoint)
    );
    assert.equal(checkpoint.h2o.nonfiniteRowCount, 0, JSON.stringify(checkpoint));
    assert.equal(checkpoint.iron.nonfiniteRowCount, 0, JSON.stringify(checkpoint));
    assert.ok(checkpoint.h2o.massKg > 0, JSON.stringify(checkpoint));
    assert.ok(checkpoint.iron.massKg > 0, JSON.stringify(checkpoint));
    assert.ok(
      Math.abs(checkpoint.combinedThermalTransfer.conductionEnergyJ) <= 2e-3,
      JSON.stringify(checkpoint)
    );
    assert.ok(
      Math.abs(checkpoint.combinedThermalTransfer.radiationEnergyJ) <= 2e-3,
      JSON.stringify(checkpoint)
    );
  }
});
