import { expect, test } from '@playwright/test';

const MOONLAB_CANONICAL_REFERENCE_SUITE_FILE_SHA256 = 'sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455';
const ESHKOL_MAGNETAR_SOURCE_SHA256 = 'sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69';
const ESHKOL_MAGNETAR_WASM_SHA256 = 'sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa';

test('supervised service smoke renders desktop and mobile worker trees', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await expect(page.getByText('PeerCompute')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Multiscale' })).toHaveAttribute('href', /https:\/\/.*:5185\/\?scenario=magnetar/);
  await expect(page.getByRole('button', { name: 'Launch Magnetar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Handoff' })).toBeVisible();
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.length === 2);
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.some((service) => service.serviceId === 'moonlab' && service.assetProbe?.status));
  const moonlabAssetStatus = await page.evaluate(() => window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'moonlab').assetProbe.status);
  expect(moonlabAssetStatus).not.toBe('skipped');
  const eshkolAssetProbe = await page.evaluate(() => window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'eshkol').assetProbe);
  expect(eshkolAssetProbe.status).not.toBe('skipped');
  if (eshkolAssetProbe.status === 'ready') {
    expect(eshkolAssetProbe.assets.map((asset) => asset.kind).sort()).toEqual([
      'artifactModule',
      'bundleManifest',
      'schemaModule',
      'wasmModule'
    ]);
  }
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.tasks?.length === 2);
  await page.waitForTimeout(1200);
  await expect(page.getByText(/tensor-probe:runtime-smoke-passed:offsets-consumed:64b/)).toBeVisible();
  await expect(page.getByText(/handler:declared-not-executed:3-blockers/)).toBeVisible();
  await expect(page.getByText(/prod-host:requirements-declared-not-implemented:23-imports/)).toBeVisible();
  await expect(page.getByText(/webgpu-preflight:navigator-gpu-unavailable/)).toBeVisible();

  const desktopPixels = await sampledCanvasPixels(page);
  expect(desktopPixels.nonBlank).toBeGreaterThan(80);
  await page.screenshot({ path: 'test-results/ulg-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const mobilePixels = await sampledCanvasPixels(page);
  expect(mobilePixels.nonBlank).toBeGreaterThan(60);
  await page.screenshot({ path: 'test-results/ulg-mobile.png', fullPage: true });

  const fixtureProbe = await consumeMoonLabFixturesInBrowserWorker(page);
  expect(fixtureProbe.type).toBe('fixture-consumed');
  expect(fixtureProbe.serviceId).toBe('moonlab');
  expect(fixtureProbe.taskKind).toBe('moonlab.quantum.response');
  expect(fixtureProbe.resolvedCount).toBe(1);
  expect(fixtureProbe.assetProbe.locateFile.resolved).toContain('/service-assets/moonlab/moonlab.wasm');

  const moonlabArtifact = await readMoonLabArtifact(page);
  const moonlabTelemetryRecord = await readMoonLabArtifactTelemetryRecord(page);
  const eshkolArtifact = await readServiceArtifact(page, 'eshkol');
  const eshkolTelemetryRecord = await readServiceArtifactTelemetryRecord(page, 'eshkol');
  const handoff = await page.evaluate(() => window.__ulgDemo.createPeerComputeHandoff());
  const smokeHandoff = await page.evaluate(() => window.__ulgDemo.createPeerComputeEshkolSmokeHandoff());
  const hasSmokeHandoffApi = await page.evaluate(() => (
    typeof window.__ulgDemo.createPeerComputeEshkolSmokeHandoff === 'function'
  ));
  expect(hasSmokeHandoffApi).toBe(true);
  expect(handoff.schema).toBe('peercompute.ulg.demo-handoff.v0');
  expect(smokeHandoff.schema).toBe('peercompute.ulg.demo-handoff.v0');
  expect(smokeHandoff.handoffKind).toBe('eshkol-smoke-output-semantics');
  expect(smokeHandoff.artifactCount).toBe(2);
  expect(smokeHandoff.artifacts.map((artifact) => artifact.artifactKind).sort()).toEqual([
    'closure',
    'quantum-response'
  ]);
  const smokeClosureHandoff = smokeHandoff.artifacts.find((artifact) => (
    artifact.ref.sourceService === 'eshkol'
    && artifact.artifactKind === 'closure'
  ));
  expect(smokeClosureHandoff.ref.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(smokeClosureHandoff.artifact.closureKind).toBe('wasm-reference');
  expect(smokeClosureHandoff.artifact.execution.module.url).toBe('hello.wasm');
  expect(smokeClosureHandoff.artifact.execution.module.sha256).toBe('sha256:1a4699680cc14ba3cefa78634c1d52425c4d4158e590aa2e3658d3c7cae9f79c');
  expect(smokeClosureHandoff.artifact.execution.serviceWorkerSafe).toBe(true);
  expect(smokeClosureHandoff.artifact.runtime.bundleManifest.schema).toBe('eshkol.ulg.closure-bundle.v0');
  expect(smokeClosureHandoff.artifact.runtime.bundleManifest.hostImports.domFree).toBe(true);
  expect(smokeClosureHandoff.artifact.validation.status).toBe('pass');
  expect(smokeClosureHandoff.artifact.validation.validationMode).toBe('eshkol-static-closure-smoke');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.schema).toBe('eshkol.ulg.closure-output-semantics.v0');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.semanticScope).toBe('smoke-fixture');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.scientificScope).toBe('none');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.scientificValidation).toBe(false);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.entryExport).toBe('main');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.entryArgs).toEqual([0, 0]);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.expectedEntryResult).toBe(0);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.stdout.expectedText).toBe('1048560\n1048544\n');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.stdout.sha256).toBe('sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d');
  expect(smokeClosureHandoff.artifactSummary.validationStatus).toBe('pass');
  expect(smokeClosureHandoff.artifactSummary.closureOutputSemanticsReady).toBe(true);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryExport).toBe('main');
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryArgs).toEqual([0, 0]);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryResult).toBe(0);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d');
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(16);
  expect(smokeClosureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
  expect(smokeClosureHandoff.artifactSummary.closureDescriptorReady).toBe(false);
  expect(smokeClosureHandoff.wasmByteLength).toBe(33907);
  expect(smokeClosureHandoff.wasmBytes.length).toBe(33907);
  expect(smokeClosureHandoff.wasmSourceUrl).toContain('/service-assets/eshkol/closures/hello/hello.wasm');
  const smokeMoonLabHandoff = smokeHandoff.artifacts.find((artifact) => artifact.ref.sourceService === 'moonlab');
  expect(smokeMoonLabHandoff.artifactKind).toBe('quantum-response');
  expect(smokeMoonLabHandoff.artifactSummary.magnetarReferenceReady).toBe(true);
  expect(smokeMoonLabHandoff.artifactSummary.magnetarDipoleIsingReady).toBe(true);
  expect(smokeMoonLabHandoff.artifactSummary.outputReferenceCount).toBe(5);
  if (eshkolAssetProbe.status === 'ready') {
    expect(eshkolArtifact.closureKind).toBe('magnetar-closure-descriptor-fixture');
    expect(eshkolArtifact.execution.module.url).toBe('magnetar-closure.wasm');
    expect(eshkolArtifact.execution.serviceWorkerSafe).toBe(true);
    expect(eshkolArtifact.validation.status).toBe('runtime-smoke');
    expect(eshkolArtifact.validation.validationMode).toBe('eshkol-deterministic-magnetar-tensor-abi-smoke');
    expect(eshkolArtifact.runtime.bundleManifest.preserveRelativeUrls).toBe(true);
    expect(eshkolArtifact.validation.outputSemantics.schema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolArtifact.validation.outputSemantics.semanticScope).toBe('smoke-fixture');
    expect(eshkolArtifact.validation.outputSemantics.scientificScope).toBe('none');
    expect(eshkolArtifact.validation.outputSemantics.scientificValidation).toBe(false);
    expect(eshkolArtifact.validation.outputSemantics.entryExport).toBe('main');
    expect(eshkolArtifact.validation.outputSemantics.entryArgs).toEqual([131072, 131136]);
    expect(eshkolArtifact.validation.outputSemantics.expectedEntryResult).toBe(0);
    expect(eshkolArtifact.validation.outputSemantics.stdout.expectedText).toBe('');
    expect(eshkolArtifact.validation.outputSemantics.stdout.sha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(eshkolArtifact.validation.outputSemantics.stdout.byteLength).toBe(0);
    expect(eshkolArtifact.validation.closureDescriptor.schema).toBe('eshkol.ulg.magnetar-closure-descriptor.v0');
    expect(eshkolArtifact.validation.closureDescriptor.descriptorRole).toBe('magnetar-closure-contract-seed');
    expect(eshkolArtifact.validation.closureDescriptor.scientificValidation).toBe(false);
    expect(eshkolArtifact.validation.closureDescriptor.fixtureChecksum).toBe(50);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.inputIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.outputIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.interpolation).toBe('reduced-fixture-table-contract');
    const descriptorBinding = eshkolArtifact.validation.closureDescriptor.descriptorBinding;
    expect(descriptorBinding.fidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      runtimeScope: 'eshkol-host-runtime-smoke-fixture',
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    expect(descriptorBinding.moonlabNormalizedReferenceSuite.contentHash).toBe(MOONLAB_CANONICAL_REFERENCE_SUITE_FILE_SHA256);
    expect(descriptorBinding.moonlabNormalizedReferenceSuite.ready).toBe(true);
    expect(eshkolArtifact.provenance.sourceSha256).toBe(ESHKOL_MAGNETAR_SOURCE_SHA256);
    expect(eshkolArtifact.provenance.wasmSha256).toBe(ESHKOL_MAGNETAR_WASM_SHA256);
    expect(eshkolArtifact.provenance.sourceContracts[0]).toMatchObject({
      schema: 'eshkol.ulg.define-ulg-closure-source.v0',
      metadataPath: 'magnetar_closure.ulg-metadata.json',
      tensorRuntimeContract: 'eshkol:magnetar-closure-tensor-runtime-contract:v0',
      scientificValidation: false,
      fullPhysicsValidation: false
    });
    const interpolationTable = descriptorBinding.ulgInterpolationTable;
    expect(interpolationTable.schema).toBe('eshkol.ulg.magnetar-closure-interpolation-table.v0');
    expect(interpolationTable.status).toBe('computed-fixture');
    expect(interpolationTable.fixtureScope).toBe('reduced-smoke-fixture-not-magnetar-physics');
    expect(interpolationTable.scientificValidation).toBe(false);
    expect(interpolationTable.sampleCount).toBe(4);
    expect(interpolationTable.sampleIds).toEqual([
      'moonlab:magnetosphere-mhd-reference',
      'moonlab:pic-kinetic-plasma-reference',
      'moonlab:radiation-transport-reference',
      'moonlab:relativistic-correction-reference'
    ]);
    expect(interpolationTable.contentHash).toBe('sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
    expect(interpolationTable.samples.length).toBe(4);
    const tensorRuntimeContract = eshkolArtifact.validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract;
    expect(tensorRuntimeContract.schema).toBe('eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0');
    expect(tensorRuntimeContract.status).toBe('declared-fixture-contract');
    expect(tensorRuntimeContract.runtimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-smoke-v0');
    expect(tensorRuntimeContract.executionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(tensorRuntimeContract.entryExport).toBe('main');
    expect(tensorRuntimeContract.tensorMemoryModel).toBe('host-managed-linear-f64');
    expect(tensorRuntimeContract.inputTensorIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(tensorRuntimeContract.outputTensorIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(tensorRuntimeContract.interpolationTable.contentHash).toBe(interpolationTable.contentHash);
    expect(tensorRuntimeContract.sampleShapeValidation.status).toBe('pass');
    expect(tensorRuntimeContract.sampleShapeValidation.validatedSampleCount).toBe(4);
    expect(tensorRuntimeContract.sampleShapeValidation.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.linearMemoryBinding.schema).toBe('eshkol.ulg.tensor-linear-memory-binding.v0');
    expect(tensorRuntimeContract.linearMemoryBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.runtimeStatus).toBe('deterministic-host-runtime-smoke-executed');
    expect(tensorRuntimeContract.linearMemoryBinding.executionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.memoryImport.baseOffset).toBe(131072);
    expect(tensorRuntimeContract.linearMemoryBinding.memoryImport.totalByteLength).toBe(168);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.id)).toEqual([
      'magnetar-state-vector',
      'closure-control-vector',
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.byteOffset)).toEqual([
      131072,
      131136,
      131168,
      131232
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.consumedByEntryExport)).toEqual([
      true,
      true,
      true,
      true
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.outputInitialization).toBe('entry-export-produced');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.schema).toBe('eshkol.ulg.tensor-entry-export-offset-probe.v0');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.status).toBe('runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.outputTensorsProducedByEntryExport).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.changedBytesInDeclaredTensorRange).toBe(64);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.observedStdoutInvariantAcrossArgs).toBe(false);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.hostImportOptions).toMatchObject({
      factory: 'createEshkolHostImportObject',
      runtimeSmokeStubs: true,
      f64TensorMemoryImports: true,
      stubScope: 'deterministic-f64-linear-memory-smoke'
    });
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.blocker).toBe(
      'none-for-deterministic-runtime-smoke-production-physics-unvalidated'
    );
    expect(tensorRuntimeContract.contractHash).toBe('sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64');
    expect(tensorRuntimeContract.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.fullPhysicsValidation).toBe(false);
    const productionHandlerBoundary = descriptorBinding.productionHandlerBoundary;
    expect(productionHandlerBoundary.schema).toBe('eshkol.ulg.production-handler-boundary.v0');
    expect(productionHandlerBoundary.handlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(productionHandlerBoundary.handlerKind).toBe('wasm-export-tensor-closure');
    expect(productionHandlerBoundary.dispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(productionHandlerBoundary.status).toBe('declared-not-executed');
    expect(productionHandlerBoundary.handlerReady).toBe(false);
    expect(productionHandlerBoundary.runtimeExecution).toBe(false);
    expect(productionHandlerBoundary.entryExport).toBe('main');
    expect(productionHandlerBoundary.runtimeAbi).toBe(tensorRuntimeContract.runtimeAbi);
    expect(productionHandlerBoundary.tensorMemoryModel).toBe(tensorRuntimeContract.tensorMemoryModel);
    expect(productionHandlerBoundary.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.moduleRef).toMatchObject({
      source: 'artifact.execution.module',
      contentAddressing: 'required',
      sha256Field: 'artifact.execution.module.sha256'
    });
    expect(productionHandlerBoundary.hostImports).toMatchObject({
      source: 'bundle.hostImports',
      required: true,
      factory: 'createEshkolHostImportObject',
      runtimeScope: 'deterministic-runtime-smoke-stubs',
      implementationStatus: 'smoke-stubs-not-production'
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate).toMatchObject({
      schema: 'eshkol.ulg.production-host-import-candidate.v0',
      status: 'requirements-declared-not-implemented',
      productionRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      runtimeSmokeStubsAllowed: false,
      tensorMemoryImports: ['ulg_read_f64', 'ulg_write_f64']
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate.requiredNonStubImports.length).toBe(23);
    expect(productionHandlerBoundary.hostImports.productionCandidate.readinessRequires).toEqual([
      'production-magnetar-handler-implementation',
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(productionHandlerBoundary.hostImports.productionCandidate.blockedBy).toEqual([
      'production-magnetar-handler-not-implemented',
      'host-imports-are-deterministic-runtime-smoke-stubs-not-production',
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.allowedExecutionClaims).toContain('deterministic-tensor-runtime-smoke-only');
    expect(productionHandlerBoundary.blockers).toEqual([
      'production-magnetar-handler-not-implemented',
      'host-imports-are-deterministic-runtime-smoke-stubs-not-production',
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.tensorMemoryBinding).toMatchObject({
      source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
      status: 'entry-export-runtime-smoke-passed',
      executionClaim: 'deterministic-tensor-runtime-smoke-only',
      entryExportConsumesOffsets: true
    });
    expect(productionHandlerBoundary.derivativeStatus).toBe('declared-not-computed');
    expect(productionHandlerBoundary.scientificValidation).toBe(false);
    expect(productionHandlerBoundary.fullPhysicsValidation).toBe(false);
    expect(productionHandlerBoundary.fullFidelityMagnetarSimulation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.schema).toBe('peercompute.ulg.artifact-summary.v0');
    expect(eshkolTelemetryRecord.artifactSummary.artifactKind).toBe('closure');
    expect(eshkolTelemetryRecord.artifactSummary.validationStatus).toBe('runtime-smoke');
    expect(eshkolTelemetryRecord.artifactSummary.closureKind).toBe('magnetar-closure-descriptor-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureModuleUrl).toBe('magnetar-closure.wasm');
    expect(eshkolTelemetryRecord.artifactSummary.closureServiceWorkerSafe).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.parameters).toEqual(['i32', 'i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.results).toEqual(['i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureHasStartSection).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureStartFunctionIndex).toBe(null);
    expect(eshkolTelemetryRecord.artifactSummary.closureImportCount).toBe(32);
    expect(eshkolTelemetryRecord.artifactSummary.closureExportCount).toBe(2);
    expect(eshkolTelemetryRecord.artifactSummary.closureRuntimeFunctionImportCount).toBe(29);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmFunctionCount).toBe(42);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmTypeCount).toBe(111);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactory).toBe('createEshkolHostImportObject');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureBundlePreserveRelativeUrls).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsSchema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticScope).toBe('smoke-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificScope).toBe('none');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryArgs).toEqual([131072, 131136]);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryResult).toBe(0);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(0);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorSchema).toBe('eshkol.ulg.magnetar-closure-descriptor.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorRole).toBe('magnetar-closure-contract-seed');
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorFixtureChecksum).toBe(50);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorFidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      runtimeScope: 'eshkol-host-runtime-smoke-fixture',
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorInputIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorOutputIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableSchema).toBe('eshkol.ulg.magnetar-closure-interpolation-table.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableStatus).toBe('computed-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableFixtureScope).toBe('reduced-smoke-fixture-not-magnetar-physics');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTablePayloadSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableContentHash).toBe('sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractSchema).toBe('eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractStatus).toBe('declared-fixture-contract');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractHash).toBe('sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeRuntimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-smoke-v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeExecutionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidationStatus).toBe('pass');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidatedSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingSchema).toBe('eshkol.ulg.tensor-linear-memory-binding.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingStatus).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryExecutionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryEntryExportConsumesOffsets).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBaseOffset).toBe(131072);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTotalByteLength).toBe(168);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTensorIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector',
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTensors.map((tensor) => tensor.byteOffset)).toEqual([
      131072,
      131136,
      131168,
      131232
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemorySmokeBindingStatus).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOffsetProbeStatus).toBe('runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportConsumesOffsets).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOutputTensorsProduced).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportChangedBytesInDeclaredTensorRange).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportObservedStdoutInvariantAcrossArgs).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOffsetProbeBlocker).toBe(
      'none-for-deterministic-runtime-smoke-production-physics-unvalidated'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundarySchema).toBe('eshkol.ulg.production-handler-boundary.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryStatus).toBe('declared-not-executed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerKind).toBe('wasm-export-tensor-closure');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerReady).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerDerivativeStatus).toBe('declared-not-computed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullFidelityMagnetarSimulation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerAllowedExecutionClaims).toContain('deterministic-tensor-runtime-smoke-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryBlockers).toEqual([
      'production-magnetar-handler-not-implemented',
      'host-imports-are-deterministic-runtime-smoke-stubs-not-production',
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerTensorMemoryBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsRuntimeScope).toBe('deterministic-runtime-smoke-stubs');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsImplementationStatus).toBe('smoke-stubs-not-production');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateStatus).toBe('requirements-declared-not-implemented');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRuntimeSmokeStubsAllowed).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRequiredNonStubImports.length).toBe(23);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateReadinessRequires).toEqual([
      'production-magnetar-handler-implementation',
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateBlockedBy).toEqual([
      'production-magnetar-handler-not-implemented',
      'host-imports-are-deterministic-runtime-smoke-stubs-not-production',
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureReady).toBe(true);
    const closureHandoff = handoff.artifacts.find((artifact) => artifact.artifactKind === 'closure');
    expect(closureHandoff.artifactSummary.closureEntryExport).toBe('main');
    expect(closureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(closureHandoff.artifactSummary.closureDescriptorReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerReady).toBe(false);
    expect(closureHandoff.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(false);
    expect(closureHandoff.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureOutputExpectedEntryArgs).toEqual([131072, 131136]);
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(0);
    expect(closureHandoff.wasmByteLength).toBe(169528);
    expect(closureHandoff.wasmBytes.length).toBe(169528);
    expect(closureHandoff.wasmSourceUrl).toContain('/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm');
  }
  if (moonlabAssetStatus === 'ready') {
    expect(moonlabArtifact.method).toBe('moonlab-wasm-bell-phi-plus-probe');
    expect(moonlabArtifact.runtime.coreProbe.status).toBe('ready');
    expect(moonlabArtifact.outputs.bellState).toBe('bell_phi_plus');
    expect(moonlabArtifact.outputs.basisProbabilities[0]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.outputs.basisProbabilities[3]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.responseDescriptor.schema).toBe('peercompute.ulg.quantum-response-descriptor.v0');
    expect(moonlabArtifact.responseDescriptor.invariants.normalizationDelta).toBeLessThan(1e-9);
    expect(moonlabArtifact.parity.schema).toBe('peercompute.ulg.quantum-response-parity.v0');
    expect(moonlabArtifact.parity.status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-wasm-core').status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-webgpu').status).toBe('unsupported');
    expect(moonlabArtifact.validationMetrics.unsupportedParityModeCount).toBe(1);
    const webGpuParityScopeReady = moonlabArtifact.runtime.coreProbe.webGpuParityScope?.status === 'ready';
    expect(moonlabArtifact.validationMetrics.webGpuParityScopeReady).toBe(webGpuParityScopeReady);
    if (webGpuParityScopeReady) {
      expect(moonlabArtifact.webGpuParityScope.schema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabArtifact.webGpuParityScope.status).toBe('scope-ready-backend-unavailable');
      expect(moonlabArtifact.webGpuParityScope.contractReady).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.reducedFixtureOnly).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.backendAvailable).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserBackendPreflight).toMatchObject({
        schema: 'moonlab.webgpu.complex64-browser-backend-preflight.v0',
        probeKind: 'browser-webgpu-adapter-device-preflight',
        stage: 'navigator-gpu-unavailable',
        navigatorGpuAvailable: false,
        adapterAvailable: false,
        deviceAcquired: false
      });
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.executed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.passed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.schema).toBe('moonlab.webgpu.complex64-probability-kernel-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.kernel).toBe('compute_probabilities');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.executed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.passed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.coveredNativeOperations).toEqual([]);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.schema).toBe('moonlab.webgpu.complex64-native-operation-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.executed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.passed).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.coveredNativeOperations).toEqual([]);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults[0]).toMatchObject({
        operation: 'hadamard',
        executed: false,
        passed: false,
        covered: false,
        blocker: 'native-operation-probe-not-executed'
      });
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults[1]).toMatchObject({
        operation: 'pauli_x',
        executed: false,
        passed: false,
        covered: false,
        blocker: 'native-operation-probe-not-executed'
      });
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults[2]).toMatchObject({
        operation: 'pauli_z',
        executed: false,
        passed: false,
        covered: false,
        blocker: 'native-operation-probe-not-executed'
      });
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults[3]).toMatchObject({
        operation: 'cnot',
        executed: false,
        passed: false,
        covered: false,
        blocker: 'native-operation-probe-not-executed'
      });
      expect(moonlabArtifact.webGpuParityScope.complex64Preflight.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.fullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.blockers).toContain('native-webgpu-operation-coverage-not-yet-recorded');
      expect(moonlabArtifact.webGpuParityScope.blockers).toContain('browser-webgpu-kernel-parity-not-executed');
    } else {
      expect(moonlabArtifact.webGpuParityScope).toBe(null);
    }
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.schema).toBe('peercompute.ulg.magnetar-dipole-ising-calibration.v0');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.validation.status).toBe('pass');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.parity.status).toBe('pass');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.scope).toBe('calibration-probe-not-full-magnetar-simulation');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.bitString).toBe('000');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.referenceEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.energyUnits).toBe('normalized-ising');
    expect(moonlabArtifact.outputs.reference.schema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabArtifact.outputs.reference.role).toBe('peercompute-reference-tolerance-input');
    expect(moonlabArtifact.outputs.reference.contractHash).toBe('sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
    expect(moonlabArtifact.outputs.reference.energyUnits).toBe('normalized-ising');
    expect(moonlabArtifact.outputs.reference.observables.groundState.bitString).toBe('000');
    expect(moonlabArtifact.outputs.reference.observables.groundState.referenceEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabArtifact.outputs.reference.observables.energySpectrum).toHaveLength(8);
    expect(moonlabArtifact.outputs.reference.tolerances.energyAbs).toBe(1e-9);
    expect(moonlabArtifact.outputs.reference.tolerances.maxObservedEnergyDelta).toBe(0);
    expect(moonlabArtifact.outputs.reference.validation.parityPassed).toBe(true);
    expect(moonlabArtifact.outputs.reference.validation.evaluatedBitstrings).toBe(8);
    const calibratedFamilies = [
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction'
    ];
    expect(moonlabArtifact.outputs.references).toHaveLength(4);
    expect(moonlabArtifact.outputs.references.map((reference) => reference.family)).toEqual(calibratedFamilies);
    const suppliedReferenceContractsReady = moonlabArtifact.runtime.coreProbe.referenceContracts?.status === 'ready';
    const expectedOutputReferenceReadyCount = suppliedReferenceContractsReady ? 5 : 2;
    const expectedCalibratedReferenceReadyCount = suppliedReferenceContractsReady ? 4 : 1;
    const magnetosphereReference = moonlabArtifact.outputs.references[0];
    expect(magnetosphereReference.schema).toBe('moonlab.magnetar.calibrated-reference.v0');
    expect(magnetosphereReference.role).toBe('peercompute-scientific-tolerance-input');
    expect(magnetosphereReference.solverId).toBe('moonlab-analytic-dipole-field-v0');
    expect(magnetosphereReference.contractHash).toBe(moonlabArtifact.outputs.reference.contractHash);
    expect(magnetosphereReference.unitsHash).toBe('sha256:b9ef2d46ec5f2d0c1fb8a2866012e9340a67f188ebc8a579b93ce61e72f4b4a5');
    expect(magnetosphereReference.status).toBe('calibrated-reference-ready');
    expect(magnetosphereReference.ready).toBe(true);
    expect(magnetosphereReference.scientificCoverage).toBe(true);
    expect(magnetosphereReference.validation.status).toBe('pass');
    expect(magnetosphereReference.blocker).toBe(null);
    const suppliedReferences = moonlabArtifact.outputs.references.slice(1);
    for (const reference of suppliedReferences) {
      expect(reference.schema).toBe('moonlab.magnetar.calibrated-reference.v0');
      expect(reference.role).toBe('peercompute-scientific-tolerance-input');
      if (suppliedReferenceContractsReady) {
        expect(reference.status).toBe('calibrated-reference-ready');
        expect(reference.ready).toBe(true);
        expect(reference.scientificCoverage).toBe(true);
        expect(reference.validation.status).toBe('pass');
        expect(reference.contractHash).toContain('sha256:');
        expect(reference.unitsHash).toContain('sha256:');
        expect(reference.blocker).toBe(null);
      } else {
        expect(reference.status).toBe('calibrated-reference-missing');
        expect(reference.ready).toBe(false);
        expect(reference.scientificCoverage).toBe(false);
        expect(reference.validation.status).toBe('missing');
        expect(reference.contractHash).toBe(null);
        expect(reference.unitsHash).toBe(null);
      }
    }
    expect(moonlabArtifact.validationMetrics.magnetarMaxEnergyDelta).toBe(0);
    expect(moonlabArtifact.validationMetrics.magnetarEvaluatedBitstrings).toBe(8);
    expect(moonlabArtifact.validationMetrics.outputReferenceCount).toBe(5);
    expect(moonlabArtifact.validationMetrics.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabArtifact.validationMetrics.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabArtifact.outputs.magnetarDipoleIsing.evaluatedBitstrings).toBe(8);
    expect(moonlabArtifact.validation.status).toBe('pass');
    expect(moonlabTelemetryRecord.artifactSummary.schema).toBe('peercompute.ulg.artifact-summary.v0');
    expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeReady).toBe(webGpuParityScopeReady);
    if (webGpuParityScopeReady) {
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeSchema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeStatus).toBe('scope-ready-backend-unavailable');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBackendAvailable).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightStage).toBe('navigator-gpu-unavailable');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightAdapterAvailable).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeviceAcquired).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityExecuted).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityPassed).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernel).toBe('compute_probabilities');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelPassed).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelCoveredNativeOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeExecuted).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbePassed).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationCoveredOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeOperationCount).toBe(4);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeCoveredOperationCount).toBe(0);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclaredOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeTargetOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationExecuted).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationBlocker).toBe('native-operation-probe-not-executed');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationExecuted).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationBlocker).toBe('native-operation-probe-not-executed');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabComplex64PreflightPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullPhysicsValidation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBlockers).toContain('native-webgpu-operation-coverage-not-yet-recorded');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBlockers).toContain('browser-webgpu-kernel-parity-not-executed');
    }
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingReady).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingGroundState).toBe('000');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingMaxEnergyDelta).toBe(0);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingEvaluatedBitstrings).toBe(8);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceReady).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceSchema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceRole).toBe('peercompute-reference-tolerance-input');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceContractHash).toBe('sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceEnergyUnits).toBe('normalized-ising');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceGroundStateBitString).toBe('000');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceGroundStateEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceToleranceEnergyAbs).toBe(1e-9);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceMaxObservedEnergyDelta).toBe(0);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceValidationStatus).toBe('pass');
    expect(moonlabTelemetryRecord.artifactSummary.outputReferenceCount).toBe(5);
    expect(moonlabTelemetryRecord.artifactSummary.outputReferenceReadyCount).toBe(expectedOutputReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.outputReferences[0].schema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabTelemetryRecord.artifactSummary.outputReferences[0].contractHash).toBe(moonlabArtifact.outputs.reference.contractHash);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceScientificCoverageCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences.map((reference) => reference.family)).toEqual(calibratedFamilies);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].blocker).toBe(null);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].ready).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].fidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      reducedCalibratedRuntimeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    const moonlabHandoff = handoff.artifacts.find((artifact) => artifact.ref.sourceService === 'moonlab');
    expect(moonlabHandoff.artifact.outputs.references).toHaveLength(4);
    expect(moonlabHandoff.artifact.outputs.references.map((reference) => reference.family)).toEqual(calibratedFamilies);
    expect(moonlabHandoff.artifact.outputs.references[0].ready).toBe(true);
    expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityScopeReady).toBe(webGpuParityScopeReady);
    if (webGpuParityScopeReady) {
      expect(moonlabHandoff.artifact.webGpuParityScope.schema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabHandoff.artifact.webGpuParityScope.backendAvailable).toBe(false);
      expect(moonlabHandoff.artifact.webGpuParityScope.webgpuParity.executed).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toContain('pauli_z');
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toContain('cnot');
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabHandoff.artifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
    }
    expect(moonlabHandoff.artifactSummary.outputReferenceCount).toBe(5);
    expect(moonlabHandoff.artifactSummary.outputReferenceReadyCount).toBe(expectedOutputReferenceReadyCount);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
  }
});

async function sampledCanvasPixels(page) {
  return page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBlank = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      if (r + g + b > 16) {
        nonBlank += 1;
      }
    }
    return { width, height, nonBlank };
  });
}

async function consumeMoonLabFixturesInBrowserWorker(page) {
  return page.evaluate(async () => {
    const [manifest, taskCapsule] = await Promise.all([
      fetch('/ulg-gpu-abi/examples/moonlab-service-manifest.json').then((response) => response.json()),
      fetch('/ulg-gpu-abi/examples/moonlab-task-capsule.json').then((response) => response.json())
    ]);

    return new Promise((resolve, reject) => {
      const worker = new Worker('/src/services/serviceContractProbe.worker.js', {
        type: 'module',
        name: 'ulg-contract-fixture-probe'
      });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Timed out waiting for contract fixture probe worker'));
      }, 5000);
      worker.addEventListener('message', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        if (event.data.type === 'fixture-error') {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data);
      });
      worker.addEventListener('error', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(event.message));
      });
      worker.postMessage({ manifest, taskCapsule });
    });
  });
}

async function readMoonLabArtifact(page) {
  return readServiceArtifact(page, 'moonlab');
}

async function readServiceArtifact(page, serviceId) {
  await page.waitForFunction(
    (sourceService) => window.__ulgDemo?.telemetry?.artifacts?.some((record) => record.ref.sourceService === sourceService),
    serviceId,
    { timeout: 8000 }
  );
  return page.evaluate(async (sourceService) => {
    const record = window.__ulgDemo.telemetry.artifacts.find((artifact) => (
      artifact.ref.sourceService === sourceService
    ));
    return window.__ulgDemo.artifactCache.get(record.ref);
  }, serviceId);
}

async function readMoonLabArtifactTelemetryRecord(page) {
  return readServiceArtifactTelemetryRecord(page, 'moonlab');
}

async function readServiceArtifactTelemetryRecord(page, serviceId) {
  await page.waitForFunction(
    (sourceService) => window.__ulgDemo?.telemetry?.artifacts?.some((record) => record.ref.sourceService === sourceService),
    serviceId,
    { timeout: 8000 }
  );
  return page.evaluate((sourceService) => window.__ulgDemo.telemetry.artifacts.find((artifact) => (
    artifact.ref.sourceService === sourceService
  )), serviceId);
}
