#!/usr/bin/env node
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const defaultUrl = process.env.ULG_LIVE_URL || 'http://100.86.83.35:5173/';
const url = valueFor('--url') || defaultUrl;
const timeoutMs = Number(valueFor('--timeout-ms') || process.env.ULG_LIVE_TIMEOUT_MS || 15000);
const bridge = args.includes('--bridge');

function valueFor(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.waitForFunction(
    () => window.__ulgDemo?.telemetry?.services?.length >= 2,
    null,
    { timeout: timeoutMs }
  );
  await page.waitForFunction(
    () => window.__ulgDemo?.telemetry?.artifacts?.length >= 2,
    null,
    { timeout: timeoutMs }
  );

  const status = await page.evaluate(async ({ bridgeRequested }) => {
    const telemetry = window.__ulgDemo.telemetry;
    const services = telemetry.services.map((service) => ({
      serviceId: service.serviceId,
      status: service.status,
      assetStatus: service.assetProbe?.status || null
    }));
    const artifacts = telemetry.artifacts.map((record) => ({
      sourceService: record.ref.sourceService,
      artifactKind: record.artifactKind,
      uri: record.ref.uri,
      summary: record.artifactSummary
    }));
    const moonlab = artifacts.find((record) => record.sourceService === 'moonlab')?.summary || null;
    const eshkol = artifacts.find((record) => record.sourceService === 'eshkol')?.summary || null;
    const handoff = await window.__ulgDemo.createPeerComputeHandoff();
    let bridgeAck = null;
    let bridgeError = null;
    if (bridgeRequested) {
      try {
        bridgeAck = await window.__ulgDemo.launchPeerComputeMagnetarDemo();
      } catch (error) {
        bridgeError = String(error?.message || error);
      }
    }

    return {
      schema: 'ulg.live-status.v0',
      url: window.location.href,
      serviceCount: services.length,
      artifactCount: artifacts.length,
      services,
      handoff: {
        schema: handoff.schema,
        artifactCount: handoff.artifactCount,
        artifactKinds: handoff.artifacts.map((artifact) => artifact.artifactKind),
        sourceServices: handoff.artifacts.map((artifact) => artifact.ref.sourceService)
      },
      moonlab: {
        webGpuParityScopeReady: moonlab?.moonlabWebGpuParityScopeReady ?? null,
        webGpuParityHandoffSummaryReady:
          moonlab?.moonlabWebGpuParityHandoffSummaryReady ?? null,
        webGpuParityHandoffSummarySchema:
          moonlab?.moonlabWebGpuParityHandoffSummarySchema ?? null,
        webGpuParityHandoffSummaryStatus:
          moonlab?.moonlabWebGpuParityHandoffSummaryStatus ?? null,
        webGpuParityHandoffSummaryRuntimeBackendReady:
          moonlab?.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady ?? null,
        webGpuParityHandoffSummaryReducedFixtureOnly:
          moonlab?.moonlabWebGpuParityHandoffSummaryReducedFixtureOnly ?? null,
        webGpuParityHandoffSummaryReducedFixtureWebGpuParityReady:
          moonlab?.moonlabWebGpuParityHandoffSummaryReducedFixtureWebGpuParityReady ?? null,
        webGpuParityHandoffSummaryReadinessClaim:
          moonlab?.moonlabWebGpuParityHandoffSummaryReadinessClaim ?? null,
        webGpuParityHandoffSummaryBackendPreflightStage:
          moonlab?.moonlabWebGpuParityHandoffSummaryBackendPreflightStage ?? null,
        webGpuParityHandoffSummaryCoveredOperations:
          moonlab?.moonlabWebGpuParityHandoffSummaryCoveredOperations ?? [],
        webGpuParityHandoffSummaryMissingOperations:
          moonlab?.moonlabWebGpuParityHandoffSummaryMissingOperations ?? [],
        webGpuParityHandoffSummaryExcludedOperations:
          moonlab?.moonlabWebGpuParityHandoffSummaryExcludedOperations ?? [],
        webGpuParityHandoffSummaryFullFidelityMagnetarSimulation:
          moonlab?.moonlabWebGpuParityHandoffSummaryFullFidelityMagnetarSimulation ?? null,
        webGpuParityHandoffSummaryFullPhysicsValidation:
          moonlab?.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation ?? null,
        probabilityKernelProbeDeclared: moonlab?.moonlabWebGpuProbabilityKernelProbeDeclared ?? null,
        probabilityKernel: moonlab?.moonlabWebGpuProbabilityKernel ?? null,
        probabilityKernelExecuted: moonlab?.moonlabWebGpuProbabilityKernelExecuted ?? null,
        probabilityKernelPassed: moonlab?.moonlabWebGpuProbabilityKernelPassed ?? null,
        browserBackendPreflightDeclared:
          moonlab?.moonlabWebGpuBrowserBackendPreflightDeclared ?? null,
        browserBackendPreflightStage:
          moonlab?.moonlabWebGpuBrowserBackendPreflightStage ?? null,
        browserBackendPreflightNavigatorGpuAvailable:
          moonlab?.moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable ?? null,
        browserBackendPreflightAdapterAvailable:
          moonlab?.moonlabWebGpuBrowserBackendPreflightAdapterAvailable ?? null,
        browserBackendPreflightDeviceAcquired:
          moonlab?.moonlabWebGpuBrowserBackendPreflightDeviceAcquired ?? null,
        browserBackendPreflightReason:
          moonlab?.moonlabWebGpuBrowserBackendPreflightReason ?? null,
        nativeOperationProbeDeclared: moonlab?.moonlabWebGpuNativeOperationProbeDeclared ?? null,
        nativeOperationProbeExecuted: moonlab?.moonlabWebGpuNativeOperationProbeExecuted ?? null,
        nativeOperationProbePassed: moonlab?.moonlabWebGpuNativeOperationProbePassed ?? null,
        nativeOperationCoveredOperations: moonlab?.moonlabWebGpuNativeOperationCoveredOperations ?? [],
        nativeOperationDeclaredOperations:
          moonlab?.moonlabWebGpuNativeOperationProbeDeclaredOperations ?? [],
        nativeOperationBlockedOperations:
          moonlab?.moonlabWebGpuNativeOperationProbeBlockedOperations ?? [],
        nativeOperationTargetOperations:
          moonlab?.moonlabWebGpuNativeOperationProbeTargetOperations ?? [],
        nativeOperationMissingTargetOperations:
          moonlab?.moonlabWebGpuNativeOperationProbeMissingTargetOperations ?? [],
        nativeOperationResults:
          moonlab?.moonlabWebGpuNativeOperationProbeOperationResults ?? [],
        hadamardNativeOperationDeclared: moonlab?.moonlabWebGpuHadamardNativeOperationDeclared ?? null,
        hadamardNativeOperationExecuted: moonlab?.moonlabWebGpuHadamardNativeOperationExecuted ?? null,
        hadamardNativeOperationCovered: moonlab?.moonlabWebGpuHadamardNativeOperationCovered ?? null,
        hadamardNativeOperationBlocker: moonlab?.moonlabWebGpuHadamardNativeOperationBlocker ?? null,
        pauliXNativeOperationDeclared: moonlab?.moonlabWebGpuPauliXNativeOperationDeclared ?? null,
        pauliXNativeOperationExecuted: moonlab?.moonlabWebGpuPauliXNativeOperationExecuted ?? null,
        pauliXNativeOperationCovered: moonlab?.moonlabWebGpuPauliXNativeOperationCovered ?? null,
        pauliXNativeOperationBlocker: moonlab?.moonlabWebGpuPauliXNativeOperationBlocker ?? null,
        magnetarReferenceReady: moonlab?.magnetarReferenceReady ?? null,
        magnetarCalibratedReferenceReadyCount: moonlab?.magnetarCalibratedReferenceReadyCount ?? null
      },
      eshkol: {
        validationStatus: eshkol?.validationStatus ?? null,
        descriptorReady: eshkol?.closureDescriptorReady ?? null,
        tensorRuntimeContractReady: eshkol?.closureTensorRuntimeContractReady ?? null,
        tensorRuntimeStatus: eshkol?.closureTensorRuntimeRuntimeStatus ?? null,
        tensorLinearMemoryBindingReady: eshkol?.closureTensorLinearMemoryBindingReady ?? null,
        tensorLinearMemoryStatus: eshkol?.closureTensorLinearMemoryBindingStatus ?? null,
        tensorLinearMemoryExecutionClaim: eshkol?.closureTensorLinearMemoryExecutionClaim ?? null,
        tensorLinearMemoryEntryExportConsumesOffsets:
          eshkol?.closureTensorLinearMemoryEntryExportConsumesOffsets ?? null,
        tensorLinearMemoryBaseOffset: eshkol?.closureTensorLinearMemoryBaseOffset ?? null,
        tensorLinearMemoryTotalByteLength: eshkol?.closureTensorLinearMemoryTotalByteLength ?? null,
        tensorEntryExportOffsetProbeStatus:
          eshkol?.closureTensorEntryExportOffsetProbeStatus ?? null,
        tensorEntryExportOffsetProbeBlocker:
          eshkol?.closureTensorEntryExportOffsetProbeBlocker ?? null,
        tensorEntryExportChangedBytesInDeclaredTensorRange:
          eshkol?.closureTensorEntryExportChangedBytesInDeclaredTensorRange ?? null,
        tensorEntryExportOutputTensorsProduced:
          eshkol?.closureTensorEntryExportOutputTensorsProduced ?? null,
        tensorEntryExportObservedStdoutInvariantAcrossArgs:
          eshkol?.closureTensorEntryExportObservedStdoutInvariantAcrossArgs ?? null,
        outputExpectedEntryArgs: eshkol?.closureOutputExpectedEntryArgs ?? null,
        outputExpectedStdoutSha256: eshkol?.closureOutputExpectedStdoutSha256 ?? null,
        hostImportsModule: eshkol?.closureHostImportsModule ?? null,
        hostImportsAssetStatus: eshkol?.closureHostImportsAssetStatus ?? null,
        hostImportsFactoryStatus: eshkol?.closureHostImportsFactoryStatus ?? null,
        hostImportsFactoryReady: eshkol?.closureHostImportsFactoryReady ?? null,
        hostImportsRequirementsSchema:
          eshkol?.closureHostImportsRequirementsSchema ?? null,
        hostImportsRequirementsStatus:
          eshkol?.closureHostImportsRequirementsStatus ?? null,
        hostImportsRuntimeScope: eshkol?.closureHostImportsRuntimeScope ?? null,
        hostImportsImplementationStatus:
          eshkol?.closureHostImportsImplementationStatus ?? null,
        hostImportsRequiredNonStubImportCount:
          eshkol?.closureHostImportsRequiredNonStubImportCount ?? null,
        productionHandlerBoundaryDeclared: eshkol?.closureProductionHandlerBoundaryDeclared ?? null,
        productionHandlerReady: eshkol?.closureProductionHandlerReady ?? null,
        productionHandlerRuntimeExecution: eshkol?.closureProductionHandlerRuntimeExecution ?? null,
        productionHandlerScientificValidation:
          eshkol?.closureProductionHandlerScientificValidation ?? null,
        productionHandlerFullPhysicsValidation:
          eshkol?.closureProductionHandlerFullPhysicsValidation ?? null,
        productionHandlerBoundaryBlockers:
          eshkol?.closureProductionHandlerBoundaryBlockers ?? [],
        productionHandlerAllowedExecutionClaims:
          eshkol?.closureProductionHandlerAllowedExecutionClaims ?? [],
        productionCandidateRuntimeProbeStatus:
          eshkol?.closureProductionCandidateRuntimeProbeStatus ?? null,
        productionCandidateRuntimeProbeReady:
          eshkol?.closureProductionCandidateRuntimeProbeReady ?? null,
        productionCandidateRuntimeProbeExecutionClaim:
          eshkol?.closureProductionCandidateRuntimeProbeExecutionClaim ?? null,
        productionCandidateRuntimeProbeRuntimeScope:
          eshkol?.closureProductionCandidateRuntimeProbeRuntimeScope ?? null,
        productionCandidateRuntimeProbeEntryArgs:
          eshkol?.closureProductionCandidateRuntimeProbeEntryArgs ?? [],
        productionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange:
          eshkol?.closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange ?? null,
        productionCandidateRuntimeProbeHostImportCallCounts:
          eshkol?.closureProductionCandidateRuntimeProbeHostImportCallCounts ?? null,
        productionCandidateRuntimeProbeBlocker:
          eshkol?.closureProductionCandidateRuntimeProbeBlocker ?? null,
        productionCandidateRuntimeProbeFullPhysicsValidation:
          eshkol?.closureProductionCandidateRuntimeProbeFullPhysicsValidation ?? null,
        productionHostImportsRuntimeScope:
          eshkol?.closureProductionHostImportsRuntimeScope ?? null,
        productionHostImportsImplementationStatus:
          eshkol?.closureProductionHostImportsImplementationStatus ?? null,
        productionHostImportCandidateStatus:
          eshkol?.closureProductionHostImportCandidateStatus ?? null,
        productionHostImportCandidateRuntimeSmokeStubsAllowed:
          eshkol?.closureProductionHostImportCandidateRuntimeSmokeStubsAllowed ?? null,
        productionHostImportCandidateRequiredNonStubImportCount:
          eshkol?.closureProductionHostImportCandidateRequiredNonStubImports?.length ?? null,
        productionHostImportCandidateReadinessRequires:
          eshkol?.closureProductionHostImportCandidateReadinessRequires ?? [],
        productionHostImportCandidateBlockedBy:
          eshkol?.closureProductionHostImportCandidateBlockedBy ?? [],
        productionDispatchPreflightStatus:
          eshkol?.closureProductionDispatchPreflightStatus ?? null,
        productionDispatchPreflightReady:
          eshkol?.closureProductionDispatchPreflightReady ?? null,
        productionDispatchPreflightRequiredRuntimeAbi:
          eshkol?.closureProductionDispatchPreflightRequiredRuntimeAbi ?? null,
        productionDispatchPreflightRejectedRuntimeScopes:
          eshkol?.closureProductionDispatchPreflightRejectedRuntimeScopes ?? [],
        productionDispatchPreflightBlockedBy:
          eshkol?.closureProductionDispatchPreflightBlockedBy ?? [],
        productionDispatchPreflightCheckSummarySchema:
          eshkol?.closureProductionDispatchPreflightCheckSummarySchema ?? null,
        productionDispatchPreflightTotalRequiredCheckCount:
          eshkol?.closureProductionDispatchPreflightTotalRequiredCheckCount ?? null,
        productionDispatchPreflightPassedCheckCount:
          eshkol?.closureProductionDispatchPreflightPassedCheckCount ?? null,
        productionDispatchPreflightBlockedCheckCount:
          eshkol?.closureProductionDispatchPreflightBlockedCheckCount ?? null,
        productionDispatchPreflightPassedChecks:
          eshkol?.closureProductionDispatchPreflightPassedChecks ?? [],
        productionDispatchPreflightBlockedChecks:
          eshkol?.closureProductionDispatchPreflightBlockedChecks ?? [],
        productionDispatchPreflightCheckResults:
          eshkol?.closureProductionDispatchPreflightCheckResults ?? []
      },
      bridge: bridgeRequested ? {
        ack: bridgeAck,
        error: bridgeError
      } : null
    };
  }, { bridgeRequested: bridge });

  console.log(JSON.stringify(status, null, 2));
  if (bridge && status.bridge?.error) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
