import { expect, test } from '@playwright/test';

const MOONLAB_CANONICAL_REFERENCE_SUITE_FILE_SHA256 = 'sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455';
const ESHKOL_MAGNETAR_SOURCE_SHA256 = 'sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69';
const ESHKOL_MAGNETAR_WASM_SHA256 = 'sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa';
const MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS = [
  'hadamard',
  'pauli_x',
  'pauli_z',
  'cnot',
  'compute_probabilities'
];
const MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS = ['phase'];

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
      'hostImportsModule',
      'schemaModule',
      'wasmModule'
    ]);
    expect(eshkolAssetProbe.bundleHostImports).toMatchObject({
      status: 'ready',
      factoryReady: true,
      tensorBindingReady: true,
      requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
      requirementsStatus: 'production-candidate-runtime-imports-implemented',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      requiredNonStubImportCount: 23
    });
  }
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.tasks?.length === 2);
  await page.waitForTimeout(1200);
  await expect(page.getByText(/tensor-probe:runtime-smoke-passed:offsets-consumed:64b/)).toBeVisible();
  await expect(page.getByText(/handler:production-handler-runtime-smoke-executed:1-blockers/)).toBeVisible();
  await expect(page.getByText(/prod-host:production-candidate-runtime-imports-implemented:23-imports/)).toBeVisible();
  await expect(page.getByText(/prod-probe:production-candidate-runtime-smoke-passed:64b/)).toBeVisible();
  await expect(page.getByText(/webgpu-preflight:device-acquired/)).toBeVisible();
  await expect(page.getByText(/webgpu-handoff:reduced:5ops/)).toBeVisible();

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
  expect(smokeClosureHandoff.artifactSummary.closureHostImportsAssetStatus).toBe('ready');
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
    expect(eshkolArtifact.runtime.hostImportsFactory).toMatchObject({
      status: 'ready',
      factoryReady: true,
      tensorBindingReady: true,
      requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
      requirementsStatus: 'production-candidate-runtime-imports-implemented',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      requiredNonStubImportCount: 23
    });
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
    expect(tensorRuntimeContract.runtimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0');
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
    expect(tensorRuntimeContract.contractHash).toBe('sha256:7bc3955f9514d894def892e547d26288b305aceb0ae48fb732e2268b0d305985');
    expect(tensorRuntimeContract.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.fullPhysicsValidation).toBe(false);
    const productionHandlerBoundary = descriptorBinding.productionHandlerBoundary;
    expect(productionHandlerBoundary.schema).toBe('eshkol.ulg.production-handler-boundary.v0');
    expect(productionHandlerBoundary.handlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(productionHandlerBoundary.handlerKind).toBe('wasm-export-tensor-closure');
    expect(productionHandlerBoundary.dispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(productionHandlerBoundary.status).toBe('production-handler-runtime-smoke-executed');
    expect(productionHandlerBoundary.handlerReady).toBe(true);
    expect(productionHandlerBoundary.runtimeExecution).toBe(true);
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
    expect(productionHandlerBoundary.productionHandlerContract).toMatchObject({
      schema: 'eshkol.ulg.production-handler-contract.v0',
      status: 'implemented-runtime-smoke-pending-full-physics',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      tensorMemoryModel: tensorRuntimeContract.tensorMemoryModel,
      invocation: {
        moduleSource: 'artifact.execution.module',
        entryExport: 'main',
        argumentMode: 'linear-memory-offsets',
        parameterTypes: ['i32', 'i32'],
        resultTypes: ['i32'],
        inputOffsetParam: 0,
        outputOffsetParam: 1,
        expectedReturn: 0
      }
    });
    expect(productionHandlerBoundary.productionHandlerContract.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.productionHandlerContract.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.productionHandlerContract.requiredEvidence).toEqual([
      'content-addressed-wasm-module',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-candidate-host-imports',
      'validated-f64-tensor-memory-binding',
      'production-candidate-runtime-probe',
      'production-magnetar-handler-implementation',
      'production-handler-runtime-execution',
      'full-physics-validation-pass'
    ]);
    expect(productionHandlerBoundary.productionHandlerContract.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.productionHandlerImplementation).toMatchObject({
      schema: 'eshkol.ulg.production-handler-implementation.v0',
      status: 'implemented-production-candidate-runtime-smoke',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      handlerKind: 'wasm-export-tensor-closure',
      implementationScope: 'deterministic-magnetar-tensor-abi-smoke',
      moduleSource: 'artifact.execution.module',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      tensorMemoryModel: tensorRuntimeContract.tensorMemoryModel,
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.productionHandlerImplementation.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.productionHandlerImplementation.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.productionHandlerImplementation.evidence).toEqual([
      'content-addressed-wasm-module',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-candidate-host-imports',
      'validated-f64-tensor-memory-binding',
      'production-candidate-runtime-probe'
    ]);
    expect(productionHandlerBoundary.hostImports).toMatchObject({
      source: 'bundle.hostImports',
      required: true,
      factory: 'createEshkolHostImportObject',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present'
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate).toMatchObject({
      schema: 'eshkol.ulg.production-host-import-candidate.v0',
      status: 'production-candidate-runtime-imports-implemented',
      productionRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      runtimeSmokeStubsAllowed: false,
      tensorMemoryImports: ['ulg_read_f64', 'ulg_write_f64']
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate.requiredNonStubImports.length).toBe(23);
    expect(productionHandlerBoundary.hostImports.productionCandidate.readinessRequires).toEqual([
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(productionHandlerBoundary.hostImports.productionCandidate.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.allowedExecutionClaims).toEqual([
      'deterministic-tensor-runtime-smoke-only',
      'production-candidate-host-import-runtime-smoke-only'
    ]);
    expect(productionHandlerBoundary.blockers).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.tensorMemoryBinding).toMatchObject({
      source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
      status: 'entry-export-runtime-smoke-passed',
      executionClaim: 'deterministic-tensor-runtime-smoke-only',
      entryExportConsumesOffsets: true
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe).toMatchObject({
      schema: 'eshkol.ulg.production-candidate-runtime-probe.v0',
      status: 'production-candidate-runtime-smoke-passed',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      entryExport: 'main',
      entryArgs: [131072, 131136],
      expectedEntryResult: 0,
      changedBytesInDeclaredTensorRange: 64,
      outputTensorsProducedByEntryExport: true,
      productionHandlerReady: true,
      productionHandlerRuntimeExecution: true,
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blocker: 'full-physics-validation-not-run'
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe.hostImportOptions).toMatchObject({
      factory: 'createEshkolHostImportObject',
      productionCandidateRuntimeImports: true,
      runtimeSmokeStubs: false,
      f64TensorMemoryImports: true
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe.hostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(productionHandlerBoundary.productionHandlerRuntimeExecution).toMatchObject({
      schema: 'eshkol.ulg.production-handler-runtime-execution.v0',
      status: 'production-handler-runtime-smoke-executed',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      moduleSource: 'artifact.execution.module',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      runtimeScope: 'production-candidate-host-imports',
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      argumentMode: 'linear-memory-offsets',
      parameterTypes: ['i32', 'i32'],
      resultTypes: ['i32'],
      entryArgs: [131072, 131136],
      entryResult: 0,
      changedBytesInDeclaredTensorRange: 64,
      outputTensorsProducedByEntryExport: true,
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.productionHandlerRuntimeExecution.hostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements).toMatchObject({
      schema: 'eshkol.ulg.full-physics-validation-requirements.v0',
      status: 'declared-not-run',
      ready: false,
      validationScope: 'magnetar-production-handler-full-physics',
      producerSchema: 'peercompute.multiscale.scenario-runtime-evidence-manifest.v0',
      requiredValidationSchema: 'peercompute.multiscale.scenario-scientific-runtime-validation.v0',
      requiredValidationScope: 'magnetar-scientific-runtime-reference-validation',
      requiredHashFields: ['referenceHash', 'toleranceHash', 'runtimeOutputHash', 'evidenceHash'],
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements.requiredRuntimeEvidenceFamilies).toEqual([
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction',
      'cross-family-conservation-coupling'
    ]);
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements.requiredRuntimeEvidence).toHaveLength(5);
    expect(productionHandlerBoundary.dispatchPreflight).toMatchObject({
      schema: 'eshkol.ulg.production-handler-dispatch-preflight.v0',
      status: 'blocked',
      ready: false,
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      entryExport: 'main',
      currentRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      requiredRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      moduleContentAddressing: 'required',
      moduleSha256Field: 'artifact.execution.module.sha256',
      tensorMemoryBindingSource: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
      hostImportsCandidateSource: 'productionHandlerBoundary.hostImports.productionCandidate',
      rejectedRuntimeScopes: ['deterministic-runtime-smoke-stubs'],
      runtimeSmokeStubsAllowed: false,
      handlerReadyRequired: true,
      runtimeExecutionRequired: true,
      fullPhysicsValidationRequired: true,
      scientificValidationRequired: true
    });
    expect(productionHandlerBoundary.dispatchPreflight.requiredChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true',
      'full-physics-validation-evidence-present'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary).toMatchObject({
      schema: 'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0',
      status: 'blocked',
      ready: false,
      totalRequiredCheckCount: 10,
      passedCount: 9,
      blockedCount: 1
    });
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary.passedChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary.blockedChecks).toEqual([
      'full-physics-validation-evidence-present'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkResults.map((entry) => entry.check)).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true',
      'full-physics-validation-evidence-present'
    ]);
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
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsAssetStatus).toBe('ready');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactoryStatus).toBe('ready');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactoryReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequirementsSchema).toBe('eshkol.ulg.production-host-import-candidate.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequirementsStatus).toBe('production-candidate-runtime-imports-implemented');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRuntimeScope).toBe('production-candidate-host-imports');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsImplementationStatus).toBe('production-candidate-runtime-imports-present');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequiredNonStubImportCount).toBe(23);
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
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractHash).toBe('sha256:7bc3955f9514d894def892e547d26288b305aceb0ae48fb732e2268b0d305985');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeRuntimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0');
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
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryStatus).toBe('production-handler-runtime-smoke-executed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerKind).toBe('wasm-export-tensor-closure');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerDerivativeStatus).toBe('declared-not-computed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullFidelityMagnetarSimulation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerAllowedExecutionClaims).toEqual([
      'deterministic-tensor-runtime-smoke-only',
      'production-candidate-host-import-runtime-smoke-only'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryBlockers).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerTensorMemoryBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractSchema).toBe(
      'eshkol.ulg.production-handler-contract.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractStatus).toBe(
      'implemented-runtime-smoke-pending-full-physics'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationArgumentMode).toBe(
      'linear-memory-offsets'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationParameterTypes).toEqual([
      'i32',
      'i32'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationResultTypes).toEqual([
      'i32'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractRequiredEvidenceCount).toBe(8);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationStatus).toBe(
      'implemented-production-candidate-runtime-smoke'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationEvidenceCount).toBe(5);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionStatus).toBe(
      'production-handler-runtime-smoke-executed'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionEntryArgs).toEqual([
      131072,
      131136
    ]);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionChangedBytesInDeclaredTensorRange
    ).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionHostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsStatus).toBe(
      'declared-not-run'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsReady).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies).toEqual([
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction',
      'cross-family-conservation-coupling'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredRuntimeEvidenceCount).toBe(5);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredHashFields).toEqual([
      'referenceHash',
      'toleranceHash',
      'runtimeOutputHash',
      'evidenceHash'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsRuntimeScope).toBe('production-candidate-host-imports');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsImplementationStatus).toBe('production-candidate-runtime-imports-present');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateStatus).toBe('production-candidate-runtime-imports-implemented');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRuntimeSmokeStubsAllowed).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRequiredNonStubImports.length).toBe(23);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateReadinessRequires).toEqual([
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeSchema).toBe(
      'eshkol.ulg.production-candidate-runtime-probe.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeStatus).toBe(
      'production-candidate-runtime-smoke-passed'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeExecutionClaim).toBe(
      'production-candidate-host-import-runtime-smoke-only'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeRuntimeScope).toBe(
      'production-candidate-host-imports'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeEntryArgs).toEqual([
      131072,
      131136
    ]);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange
    ).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeOutputTensorsProduced).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeHostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeProductionHandlerReady).toBe(true);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeProductionHandlerRuntimeExecution
    ).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeBlocker).toBe(
      'full-physics-validation-not-run'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightSchema).toBe(
      'eshkol.ulg.production-handler-dispatch-preflight.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightStatus).toBe('blocked');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightReady).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRequiredRuntimeAbi).toBe(
      'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRuntimeSmokeStubsAllowed).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRejectedRuntimeScopes).toEqual([
      'deterministic-runtime-smoke-stubs'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightCheckSummarySchema).toBe(
      'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightTotalRequiredCheckCount).toBe(10);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightPassedCheckCount).toBe(9);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedCheckCount).toBe(1);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightPassedChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedChecks).toEqual([
      'full-physics-validation-evidence-present'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureReady).toBe(true);
    const closureHandoff = handoff.artifacts.find((artifact) => artifact.artifactKind === 'closure');
    expect(closureHandoff.artifactSummary.closureEntryExport).toBe('main');
    expect(closureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(closureHandoff.artifactSummary.closureDescriptorReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerContractDeclared).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionDispatchPreflightReady).toBe(false);
    expect(closureHandoff.artifactSummary.closureProductionCandidateRuntimeProbeReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionDispatchPreflightPassedCheckCount).toBe(9);
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
    const webGpuParityHandoffSummaryReady = (
      moonlabArtifact.runtime.coreProbe.webGpuParityHandoffSummary?.status === 'ready'
    );
    expect(moonlabArtifact.validationMetrics.webGpuParityScopeReady).toBe(webGpuParityScopeReady);
    expect(moonlabArtifact.validationMetrics.webGpuParityHandoffSummaryReady).toBe(webGpuParityHandoffSummaryReady);
    if (webGpuParityScopeReady) {
      expect(moonlabArtifact.webGpuParityScope.schema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabArtifact.webGpuParityScope.status).toBe('scope-ready-backend-detected');
      expect(moonlabArtifact.webGpuParityScope.contractReady).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.reducedFixtureOnly).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.backendAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.requireBackend).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserBackendPreflight).toMatchObject({
        schema: 'moonlab.webgpu.complex64-browser-backend-preflight.v0',
        probeKind: 'browser-webgpu-adapter-device-preflight',
        stage: 'device-acquired',
        navigatorGpuAvailable: true,
        adapterAvailable: true,
        deviceAcquired: true
      });
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.maxProbabilityAbsDiff).toBeLessThanOrEqual(
        moonlabArtifact.webGpuParityScope.webgpuParity.tolerance
      );
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.schema).toBe('moonlab.webgpu.complex64-probability-kernel-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.kernel).toBe('compute_probabilities');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.coveredNativeOperations).toEqual(['compute_probabilities']);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.schema).toBe('moonlab.webgpu.complex64-native-operation-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.coveredNativeOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      for (const operation of ['hadamard', 'pauli_x', 'pauli_z', 'cnot']) {
        const operationResult = moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults
          .find((entry) => entry.operation === operation);
        expect(operationResult).toMatchObject({
          operation,
          executed: true,
          passed: true,
          covered: true
        });
        expect(operationResult.blocker).toBeUndefined();
        expect(operationResult.maxAmplitudeAbsDiff).toBeLessThanOrEqual(operationResult.tolerance);
      }
      expect(moonlabArtifact.webGpuParityScope.complex64Preflight.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.fullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.blockers).toEqual([]);
      expect(webGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.schema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.sourceSchema).toBe(
        'moonlab.webgpu.complex64-parity-scope.v0'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.status).toBe('scope-ready-backend-detected');
      expect(moonlabArtifact.webGpuParityHandoffSummary.reducedFixtureOnly).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.reducedFixtureWebGpuParityReady).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.runtimeBackendReady).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.requireBackend).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.contractValidationValid).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.readinessClaim).toBe(
        'integration-tolerance-gate-only'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.fullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.fullPhysicsValidation).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.stage).toBe('device-acquired');
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.navigatorGpuAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.adapterAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.deviceAcquired).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.required).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.covered).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.missing).toEqual([]);
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.excluded).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.webgpuParity.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.webgpuParity.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.blockers).toEqual([]);
      expect(moonlabArtifact.webGpuParityHandoffSummary.validationErrors).toEqual([]);
    } else {
      expect(moonlabArtifact.webGpuParityScope).toBe(null);
      expect(moonlabArtifact.webGpuParityHandoffSummary).toBe(null);
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
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeStatus).toBe('scope-ready-backend-detected');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBackendAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightStage).toBe('device-acquired');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightAdapterAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeviceAcquired).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernel).toBe('compute_probabilities');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelCoveredNativeOperations).toEqual(['compute_probabilities']);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbePassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationCoveredOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeOperationCount).toBe(4);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeCoveredOperationCount).toBe(4);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclaredOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeTargetOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationBlocker).toBe(null);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationBlocker).toBe(null);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabComplex64PreflightPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullPhysicsValidation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBlockers).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummarySchema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryStatus).toBe(
        'scope-ready-backend-detected'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReducedFixtureOnly).toBe(true);
      expect(
        moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReducedFixtureWebGpuParityReady
      ).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReadinessClaim).toBe(
        'integration-tolerance-gate-only'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryCoveredOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryMissingOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryExcludedOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryBlockers).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryValidationErrors).toEqual([]);
      expect(
        moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryFullFidelityMagnetarSimulation
      ).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation).toBe(false);
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
      expect(moonlabHandoff.artifact.webGpuParityScope.backendAvailable).toBe(true);
      expect(moonlabHandoff.artifact.webGpuParityScope.webgpuParity.executed).toBe(true);
      expect(moonlabHandoff.artifact.webGpuParityScope.webgpuParity.passed).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toEqual([]);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabHandoff.artifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.schema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.runtimeBackendReady).toBe(false);
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.nativeCoverage.covered).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryCoveredOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation).toBe(false);
    }
    expect(moonlabHandoff.artifactSummary.outputReferenceCount).toBe(5);
    expect(moonlabHandoff.artifactSummary.outputReferenceReadyCount).toBe(expectedOutputReferenceReadyCount);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
  }
});

test('SPH phase demo runs derived material properties by default', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto('/');
  await page.locator('#run-sph-phase').click();
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.getByText('SPH PHASE — two materials interacting')).toBeVisible();
  const materialLabels = await page.locator('#sph-elements select').first().locator('option').evaluateAll(
    (options) => options.map((option) => option.textContent)
  );
  expect(materialLabels).toContain('Iron (Fe, Z=26) - derived element');
  expect(materialLabels).toContain('Gold (Au, Z=79) - derived element');
  await page.locator('#sph-elements .sph-picker-button').first().click({ force: true });
  await expect(page.locator('.sph-element-picker-overlay')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gold (Au, Z=79) - derived element' })).toBeVisible();
  await page.locator('.sph-element-picker').getByRole('button', { name: 'close' }).click();
  await expect(page.locator('.sph-element-picker-overlay')).toHaveCount(0);
  await expect(page.locator('#sph-status')).toContainText('preflight        : preflight-feasible-derived-closures');
  await expect(page.locator('#sph-status')).not.toContainText('first-principles material properties are required');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const canvas = overlay?.querySelector('canvas');
    return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getOpticalGpuLookup?.()?.execution?.schema
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getSphGpuParticleUpload?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleUpload?.()?.schema
      && scene?.getMlsMpmMechanicsPrediction?.()?.schema
      && scene?.getMlsMpmP2gGridProjection?.()?.schema
      && scene?.getMlsMpmGridUpdate?.()?.schema
      && scene?.getMlsMpmG2pReconstruction?.()?.schema
      && scene?.getMlsMpmResidentStep?.()?.schema
      && scene?.getMlsMpmResidentSteps?.()?.schema
    );
  });
  await page.waitForFunction(() => {
    const text = document.querySelector('#sph-status')?.textContent ?? '';
    return text.includes('resident readback: requested=no-full-readback actual=')
      && !text.includes('actual=pending');
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const steps = overlay?.__sphScene?.getMlsMpmResidentSteps?.();
    if (!steps?.schema) return false;
    if (steps.backend !== 'webgpu' || steps.readbackMode !== 'no-full-readback') return true;
    return steps.continuedFromResidentState === true
      && steps.residentSourceMode === 'previous-gpu-resident-output';
  });
  const derivedSummary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const canvas = overlay.querySelector('canvas');
    const scene = overlay.__sphScene;
    const opticalGpuTable = scene?.getOpticalGpuTable?.();
    const opticalGpuLookup = scene?.getOpticalGpuLookup?.();
    const opticalGpuExecution = opticalGpuLookup?.execution;
    const opticalGpuDrawState = scene?.getOpticalGpuDrawState?.();
    const sphGpuParticleState = scene?.getSphGpuParticleState?.();
    const sphGpuParticleUpload = scene?.getSphGpuParticleUpload?.();
    const mlsMpmGpuParticleState = scene?.getMlsMpmGpuParticleState?.();
    const mlsMpmGpuParticleUpload = scene?.getMlsMpmGpuParticleUpload?.();
    const mlsMpmMechanicsPrediction = scene?.getMlsMpmMechanicsPrediction?.();
    const mlsMpmP2gGridProjection = scene?.getMlsMpmP2gGridProjection?.();
    const mlsMpmGridUpdate = scene?.getMlsMpmGridUpdate?.();
    const mlsMpmG2pReconstruction = scene?.getMlsMpmG2pReconstruction?.();
    const mlsMpmResidentStep = scene?.getMlsMpmResidentStep?.();
    const mlsMpmResidentSteps = scene?.getMlsMpmResidentSteps?.();
    const visibleSurfaces = [];
    scene?.scene?.traverse((node) => {
      if (node.userData?.renderMode === 'continuous-marching-cubes') {
        visibleSurfaces.push({
          materialKey: node.userData.materialKey,
          visible: node.visible,
          lookupOutputRecordIndex: node.userData.opticalGpuLookupOutput?.recordIndex ?? null,
          lookupBackend: node.userData.opticalGpuExecutionBackend ?? null
        });
      }
    });
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      driverReady: Boolean(overlay.__sphDriver),
      overlayResidentRequestedReadbackMode: overlay.__mlsMpmResidentRequestedReadbackMode,
      statusText: overlay.querySelector('#sph-status')?.textContent ?? '',
      opticalGpuTable: {
        schema: opticalGpuTable?.schema,
        recordCount: opticalGpuTable?.recordCount,
        spectralSampleCount: opticalGpuTable?.spectralSampleCount
      },
      opticalGpuLookup: {
        schema: opticalGpuLookup?.lookup?.schema,
        queryCount: opticalGpuLookup?.lookup?.queryCount,
        outputCount: opticalGpuLookup?.cpuReference?.outputs?.length,
        executionSchema: opticalGpuExecution?.schema,
        executionBackend: opticalGpuExecution?.backend,
        executionStatus: opticalGpuExecution?.webgpuStatus?.status,
        paritySchema: opticalGpuExecution?.webgpuParity?.schema,
        parityStatus: opticalGpuExecution?.webgpuParity?.status,
        parityMaxOutputAbs: opticalGpuExecution?.webgpuParity?.maxOutputAbs ?? null,
        parityTolerance: opticalGpuExecution?.webgpuParity?.tolerance ?? null
      },
      opticalGpuDrawState: {
        schema: opticalGpuDrawState?.schema,
        sourceExecutionSchema: opticalGpuDrawState?.sourceExecutionSchema,
        backend: opticalGpuDrawState?.backend,
        appliedCount: opticalGpuDrawState?.appliedCount
      },
      sphGpuParticleState: {
        schema: sphGpuParticleState?.schema,
        particleCount: sphGpuParticleState?.particleCount,
        stateStrideFloats: sphGpuParticleState?.stateStrideFloats,
        thermoStrideFloats: sphGpuParticleState?.thermoStrideFloats,
        phaseSolidId: sphGpuParticleState?.phaseIds?.solid,
        firstMaterial: sphGpuParticleState?.metadata?.[0]?.material
      },
      sphGpuParticleUpload: {
        schema: sphGpuParticleUpload?.schema,
        status: sphGpuParticleUpload?.status,
        sourceSchema: sphGpuParticleUpload?.sourceSchema,
        particleCount: sphGpuParticleUpload?.particleCount
      },
      mlsMpmGpuParticleState: {
        schema: mlsMpmGpuParticleState?.schema,
        particleCount: mlsMpmGpuParticleState?.particleCount,
        mechanicsStrideFloats: mlsMpmGpuParticleState?.mechanicsStrideFloats,
        firstSolidFlag: mlsMpmGpuParticleState?.mechanics?.[20] ?? null,
        firstStatus: mlsMpmGpuParticleState?.mechanics?.[21] ?? null
      },
      mlsMpmGpuParticleUpload: {
        schema: mlsMpmGpuParticleUpload?.schema,
        status: mlsMpmGpuParticleUpload?.status,
        sourceSchema: mlsMpmGpuParticleUpload?.sourceSchema,
        particleCount: mlsMpmGpuParticleUpload?.particleCount
      },
      mlsMpmMechanicsPrediction: {
        schema: mlsMpmMechanicsPrediction?.schema,
        predictionSchema: mlsMpmMechanicsPrediction?.predictionSchema,
        backend: mlsMpmMechanicsPrediction?.backend,
        webgpuStatus: mlsMpmMechanicsPrediction?.webgpuStatus?.status,
        paritySchema: mlsMpmMechanicsPrediction?.webgpuParity?.schema,
        parityStatus: mlsMpmMechanicsPrediction?.webgpuParity?.status,
        parityMaxStateAbs: mlsMpmMechanicsPrediction?.webgpuParity?.maxStateAbs ?? null,
        parityMaxMechanicsAbs: mlsMpmMechanicsPrediction?.webgpuParity?.maxMechanicsAbs ?? null,
        parityTolerance: mlsMpmMechanicsPrediction?.webgpuParity?.tolerance ?? null,
        particleCount: mlsMpmMechanicsPrediction?.particleCount,
        stateStrideFloats: mlsMpmMechanicsPrediction?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmMechanicsPrediction?.mechanicsStrideFloats,
        p2gValidation: mlsMpmMechanicsPrediction?.p2gValidation,
        gridValidation: mlsMpmMechanicsPrediction?.gridValidation,
        g2pValidation: mlsMpmMechanicsPrediction?.g2pValidation,
        sphValidation: mlsMpmMechanicsPrediction?.sphValidation,
        phaseChangeValidation: mlsMpmMechanicsPrediction?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmMechanicsPrediction?.fullPhysicsValidation
      },
      mlsMpmP2gGridProjection: {
        schema: mlsMpmP2gGridProjection?.schema,
        projectionSchema: mlsMpmP2gGridProjection?.projectionSchema,
        backend: mlsMpmP2gGridProjection?.backend,
        webgpuStatus: mlsMpmP2gGridProjection?.webgpuStatus?.status,
        paritySchema: mlsMpmP2gGridProjection?.webgpuParity?.schema,
        parityStatus: mlsMpmP2gGridProjection?.webgpuParity?.status,
        parityMaxGridAbs: mlsMpmP2gGridProjection?.webgpuParity?.maxGridAbs ?? null,
        parityTolerance: mlsMpmP2gGridProjection?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmP2gGridProjection?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmP2gGridProjection?.normalHotLoopReadbackFree,
        particleCount: mlsMpmP2gGridProjection?.particleCount,
        gridNodeCount: mlsMpmP2gGridProjection?.gridNodeCount,
        gridNodeStrideFloats: mlsMpmP2gGridProjection?.gridNodeStrideFloats,
        p2gProjectionValidation: mlsMpmP2gGridProjection?.p2gProjectionValidation,
        stressProjectionValidation: mlsMpmP2gGridProjection?.stressProjectionValidation,
        gridValidation: mlsMpmP2gGridProjection?.gridValidation,
        g2pValidation: mlsMpmP2gGridProjection?.g2pValidation,
        sphValidation: mlsMpmP2gGridProjection?.sphValidation,
        phaseChangeValidation: mlsMpmP2gGridProjection?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmP2gGridProjection?.fullPhysicsValidation
      },
      mlsMpmGridUpdate: {
        schema: mlsMpmGridUpdate?.schema,
        updateSchema: mlsMpmGridUpdate?.updateSchema,
        backend: mlsMpmGridUpdate?.backend,
        webgpuStatus: mlsMpmGridUpdate?.webgpuStatus?.status,
        paritySchema: mlsMpmGridUpdate?.webgpuParity?.schema,
        parityStatus: mlsMpmGridUpdate?.webgpuParity?.status,
        parityMaxGridAbs: mlsMpmGridUpdate?.webgpuParity?.maxGridAbs ?? null,
        parityTolerance: mlsMpmGridUpdate?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmGridUpdate?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmGridUpdate?.normalHotLoopReadbackFree,
        particleCount: mlsMpmGridUpdate?.particleCount,
        gridNodeCount: mlsMpmGridUpdate?.gridNodeCount,
        gridNodeStrideFloats: mlsMpmGridUpdate?.gridNodeStrideFloats,
        dt: mlsMpmGridUpdate?.dt,
        cflFactor: mlsMpmGridUpdate?.cflFactor,
        p2gProjectionValidation: mlsMpmGridUpdate?.p2gProjectionValidation,
        stressProjectionValidation: mlsMpmGridUpdate?.stressProjectionValidation,
        gridUpdateValidation: mlsMpmGridUpdate?.gridUpdateValidation,
        gridValidation: mlsMpmGridUpdate?.gridValidation,
        g2pValidation: mlsMpmGridUpdate?.g2pValidation,
        sphValidation: mlsMpmGridUpdate?.sphValidation,
        phaseChangeValidation: mlsMpmGridUpdate?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmGridUpdate?.fullPhysicsValidation
      },
      mlsMpmG2pReconstruction: {
        schema: mlsMpmG2pReconstruction?.schema,
        reconstructionSchema: mlsMpmG2pReconstruction?.reconstructionSchema,
        backend: mlsMpmG2pReconstruction?.backend,
        webgpuStatus: mlsMpmG2pReconstruction?.webgpuStatus?.status,
        paritySchema: mlsMpmG2pReconstruction?.webgpuParity?.schema,
        parityStatus: mlsMpmG2pReconstruction?.webgpuParity?.status,
        parityMaxStateAbs: mlsMpmG2pReconstruction?.webgpuParity?.maxStateAbs ?? null,
        parityMaxMechanicsAbs: mlsMpmG2pReconstruction?.webgpuParity?.maxMechanicsAbs ?? null,
        parityTolerance: mlsMpmG2pReconstruction?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmG2pReconstruction?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmG2pReconstruction?.normalHotLoopReadbackFree,
        particleCount: mlsMpmG2pReconstruction?.particleCount,
        gridNodeCount: mlsMpmG2pReconstruction?.gridNodeCount,
        stateStrideFloats: mlsMpmG2pReconstruction?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmG2pReconstruction?.mechanicsStrideFloats,
        dt: mlsMpmG2pReconstruction?.dt,
        p2gProjectionValidation: mlsMpmG2pReconstruction?.p2gProjectionValidation,
        stressProjectionValidation: mlsMpmG2pReconstruction?.stressProjectionValidation,
        gridUpdateValidation: mlsMpmG2pReconstruction?.gridUpdateValidation,
        g2pValidation: mlsMpmG2pReconstruction?.g2pValidation,
        gridValidation: mlsMpmG2pReconstruction?.gridValidation,
        sphValidation: mlsMpmG2pReconstruction?.sphValidation,
        phaseChangeValidation: mlsMpmG2pReconstruction?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmG2pReconstruction?.fullPhysicsValidation
      },
      mlsMpmResidentStep: {
        schema: mlsMpmResidentStep?.schema,
        stepSchema: mlsMpmResidentStep?.stepSchema,
        backend: mlsMpmResidentStep?.backend,
        status: mlsMpmResidentStep?.status,
        stageStatus: mlsMpmResidentStep?.stageStatus,
        stageBackends: mlsMpmResidentStep?.stageBackends,
        residentBuffersRetained: mlsMpmResidentStep?.residentBuffersRetained,
        stageBuffersRetained: mlsMpmResidentStep?.stageBuffersRetained,
        g2pOutputBuffersRetained: mlsMpmResidentStep?.g2pOutputBuffersRetained,
        residentBufferMode: mlsMpmResidentStep?.residentBufferMode,
        nextParticleBufferMode: mlsMpmResidentStep?.nextParticleBufferMode,
        nextParticleStateBufferByteLength: mlsMpmResidentStep?.nextParticleStateBufferByteLength,
        nextParticleMechanicsBufferByteLength: mlsMpmResidentStep?.nextParticleMechanicsBufferByteLength,
        particlePingPong: mlsMpmResidentStep?.particlePingPong,
        requestedReadbackMode: mlsMpmResidentStep?.requestedReadbackMode,
        readbackMode: mlsMpmResidentStep?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmResidentStep?.normalHotLoopReadbackFree,
        renderStateReadbackAvailable: mlsMpmResidentStep?.renderStateReadbackAvailable,
        gpuAuthoritativeState: mlsMpmResidentStep?.gpuAuthoritativeState,
        particleCount: mlsMpmResidentStep?.particleCount,
        gridNodeCount: mlsMpmResidentStep?.gridNodeCount,
        stateStrideFloats: mlsMpmResidentStep?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmResidentStep?.mechanicsStrideFloats,
        diagnostics: {
          particleCount: mlsMpmResidentStep?.diagnostics?.particleCount,
          gridNodeCount: mlsMpmResidentStep?.diagnostics?.gridNodeCount,
          activeGridNodeCount: mlsMpmResidentStep?.diagnostics?.activeGridNodeCount,
          massDeltaKg: mlsMpmResidentStep?.diagnostics?.massDeltaKg,
          maxSpeedMPerS: mlsMpmResidentStep?.diagnostics?.maxSpeedMPerS,
          maxDisplacementM: mlsMpmResidentStep?.diagnostics?.maxDisplacementM,
          readbackMode: mlsMpmResidentStep?.diagnostics?.readbackMode,
          compactGpuSummaryAvailable: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryAvailable,
          compactGpuSummaryStatus: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryStatus,
          compactGpuSummaryReadbackMode: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryReadbackMode,
          compactReadbackByteLength: mlsMpmResidentStep?.diagnostics?.compactReadbackByteLength,
          compactSummaryReductionStrategy: mlsMpmResidentStep?.diagnostics?.compactSummaryReductionStrategy,
          fullPhysicsValidation: mlsMpmResidentStep?.diagnostics?.fullPhysicsValidation
        },
        p2gProjectionValidation: mlsMpmResidentStep?.p2gProjectionValidation,
        stressProjectionValidation: mlsMpmResidentStep?.stressProjectionValidation,
        gridUpdateValidation: mlsMpmResidentStep?.gridUpdateValidation,
        g2pValidation: mlsMpmResidentStep?.g2pValidation,
        gridValidation: mlsMpmResidentStep?.gridValidation,
        sphValidation: mlsMpmResidentStep?.sphValidation,
        phaseChangeValidation: mlsMpmResidentStep?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmResidentStep?.fullPhysicsValidation
      },
      mlsMpmResidentSteps: {
        schema: mlsMpmResidentSteps?.schema,
        backend: mlsMpmResidentSteps?.backend,
        status: mlsMpmResidentSteps?.status,
        stepCount: mlsMpmResidentSteps?.stepCount,
        completedStepCount: mlsMpmResidentSteps?.completedStepCount,
        retainIntermediateSteps: mlsMpmResidentSteps?.retainIntermediateSteps,
        retainedIntermediateStepCount: mlsMpmResidentSteps?.retainedIntermediateStepCount,
        finalStepSchema: mlsMpmResidentSteps?.finalStep?.schema,
        finalStepStatus: mlsMpmResidentSteps?.finalStep?.status,
        stepSummaries: mlsMpmResidentSteps?.stepSummaries,
        requestedReadbackMode: mlsMpmResidentSteps?.requestedReadbackMode,
        readbackMode: mlsMpmResidentSteps?.readbackMode,
        residentSourceMode: mlsMpmResidentSteps?.residentSourceMode,
        continuedFromResidentState: mlsMpmResidentSteps?.continuedFromResidentState,
        continuationAvailable: mlsMpmResidentSteps?.continuationAvailable,
        nextParticleBufferMode: mlsMpmResidentSteps?.nextParticleBufferMode,
        normalHotLoopReadbackFree: mlsMpmResidentSteps?.normalHotLoopReadbackFree,
        renderStateReadbackAvailable: mlsMpmResidentSteps?.renderStateReadbackAvailable,
        gpuAuthoritativeState: mlsMpmResidentSteps?.gpuAuthoritativeState,
        scientificValidation: mlsMpmResidentSteps?.scientificValidation,
        sphValidation: mlsMpmResidentSteps?.sphValidation,
        phaseChangeValidation: mlsMpmResidentSteps?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmResidentSteps?.fullPhysicsValidation
      },
      visibleSurfaces: visibleSurfaces.filter((surface) => surface.visible)
    };
  });
  expect(derivedSummary.canvasWidth).toBeGreaterThan(100);
  expect(derivedSummary.canvasHeight).toBeGreaterThan(100);
  expect(derivedSummary.driverReady).toBe(true);
  expect(derivedSummary.overlayResidentRequestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback');
  expect(derivedSummary.statusText).toContain('resident source  :');
  expect(derivedSummary.statusText).toContain('compact summary  :');
  expect(derivedSummary.statusText).toContain('gpu authoritative: false');
  expect(derivedSummary.opticalGpuTable.schema).toBe('peercompute.ulg.optical-gpu-table.v0');
  expect(derivedSummary.opticalGpuTable.recordCount).toBeGreaterThan(0);
  expect(derivedSummary.opticalGpuTable.spectralSampleCount).toBeGreaterThan(0);
  expect(derivedSummary.opticalGpuLookup.schema).toBe('peercompute.ulg.optical-gpu-lookup.v0');
  expect(derivedSummary.opticalGpuLookup.queryCount).toBe(derivedSummary.opticalGpuTable.recordCount);
  expect(derivedSummary.opticalGpuLookup.outputCount).toBe(derivedSummary.opticalGpuLookup.queryCount * 12);
  expect(derivedSummary.opticalGpuLookup.executionSchema).toBe('peercompute.ulg.optical-gpu-lookup-execution.v0');
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.opticalGpuLookup.executionBackend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.opticalGpuLookup.executionStatus);
  if (derivedSummary.opticalGpuLookup.executionBackend === 'webgpu') {
    expect(derivedSummary.opticalGpuLookup.executionStatus).toBe('webgpu-executed');
    expect(derivedSummary.opticalGpuLookup.paritySchema).toBe('peercompute.ulg.optical-gpu-lookup-parity.v0');
    expect(derivedSummary.opticalGpuLookup.parityStatus).toBe('pass');
    expect(derivedSummary.opticalGpuLookup.parityMaxOutputAbs).toBeLessThanOrEqual(derivedSummary.opticalGpuLookup.parityTolerance);
  }
  expect(derivedSummary.opticalGpuDrawState.schema).toBe('peercompute.ulg.optical-gpu-draw-state.v0');
  expect(derivedSummary.opticalGpuDrawState.sourceExecutionSchema).toBe('peercompute.ulg.optical-gpu-lookup-execution.v0');
  expect(derivedSummary.opticalGpuDrawState.backend).toBe(derivedSummary.opticalGpuLookup.executionBackend);
  expect(derivedSummary.opticalGpuDrawState.appliedCount).toBeGreaterThan(0);
  expect(derivedSummary.sphGpuParticleState.schema).toBe('peercompute.ulg.sph-gpu-particle-buffer.v0');
  expect(derivedSummary.sphGpuParticleState.particleCount).toBeGreaterThan(0);
  expect(derivedSummary.sphGpuParticleState.stateStrideFloats).toBe(8);
  expect(derivedSummary.sphGpuParticleState.thermoStrideFloats).toBe(12);
  expect(derivedSummary.sphGpuParticleState.phaseSolidId).toBe(1);
  expect(derivedSummary.sphGpuParticleUpload.schema).toBe('peercompute.ulg.sph-gpu-particle-buffer-set.v0');
  expect(derivedSummary.sphGpuParticleUpload.sourceSchema).toBe('peercompute.ulg.sph-gpu-particle-buffer.v0');
  expect(derivedSummary.sphGpuParticleUpload.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(['webgpu-uploaded', 'blocked-webgpu-unavailable', 'webgpu-error-fallback']).toContain(
    derivedSummary.sphGpuParticleUpload.status
  );
  expect(derivedSummary.mlsMpmGpuParticleState.schema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer.v0');
  expect(derivedSummary.mlsMpmGpuParticleState.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmGpuParticleState.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmGpuParticleState.firstSolidFlag).toBe(1);
  expect(derivedSummary.mlsMpmGpuParticleState.firstStatus).toBe(1);
  expect(derivedSummary.mlsMpmGpuParticleUpload.schema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0');
  expect(derivedSummary.mlsMpmGpuParticleUpload.sourceSchema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer.v0');
  expect(derivedSummary.mlsMpmGpuParticleUpload.particleCount).toBe(derivedSummary.mlsMpmGpuParticleState.particleCount);
  expect(['webgpu-uploaded', 'blocked-webgpu-unavailable', 'webgpu-error-fallback']).toContain(
    derivedSummary.mlsMpmGpuParticleUpload.status
  );
  expect(derivedSummary.mlsMpmMechanicsPrediction.schema).toBe('peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0');
  expect(derivedSummary.mlsMpmMechanicsPrediction.predictionSchema).toBe('peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0');
  expect(derivedSummary.mlsMpmMechanicsPrediction.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmMechanicsPrediction.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmMechanicsPrediction.mechanicsStrideFloats).toBe(32);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmMechanicsPrediction.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmMechanicsPrediction.webgpuStatus);
  if (derivedSummary.mlsMpmMechanicsPrediction.backend === 'webgpu') {
    expect(derivedSummary.mlsMpmMechanicsPrediction.webgpuStatus).toBe('webgpu-executed');
    expect(derivedSummary.mlsMpmMechanicsPrediction.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-mechanics-parity.v0');
    expect(derivedSummary.mlsMpmMechanicsPrediction.parityStatus).toBe('pass');
    expect(derivedSummary.mlsMpmMechanicsPrediction.parityMaxStateAbs).toBeLessThanOrEqual(
      derivedSummary.mlsMpmMechanicsPrediction.parityTolerance
    );
    expect(derivedSummary.mlsMpmMechanicsPrediction.parityMaxMechanicsAbs).toBeLessThanOrEqual(
      derivedSummary.mlsMpmMechanicsPrediction.parityTolerance
    );
  }
  expect(derivedSummary.mlsMpmMechanicsPrediction.p2gValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.schema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0');
  expect(derivedSummary.mlsMpmP2gGridProjection.projectionSchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection.v0');
  expect(derivedSummary.mlsMpmP2gGridProjection.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridNodeCount).toBeGreaterThan(0);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridNodeStrideFloats).toBe(8);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmP2gGridProjection.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus);
  if (derivedSummary.mlsMpmP2gGridProjection.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus);
    expect(derivedSummary.mlsMpmP2gGridProjection.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection-parity.v0');
    if (derivedSummary.mlsMpmP2gGridProjection.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityStatus).toBe('not-run-no-full-readback');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityMaxGridAbs).toBe(null);
      expect(derivedSummary.mlsMpmP2gGridProjection.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityMaxGridAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmP2gGridProjection.parityTolerance
      );
      expect(derivedSummary.mlsMpmP2gGridProjection.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmP2gGridProjection.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.schema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update-execution.v0');
  expect(derivedSummary.mlsMpmGridUpdate.updateSchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update.v0');
  expect(derivedSummary.mlsMpmGridUpdate.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmGridUpdate.gridNodeCount).toBe(derivedSummary.mlsMpmP2gGridProjection.gridNodeCount);
  expect(derivedSummary.mlsMpmGridUpdate.gridNodeStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmGridUpdate.dt).toBeGreaterThan(0);
  expect(derivedSummary.mlsMpmGridUpdate.cflFactor).toBeGreaterThan(0);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmGridUpdate.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmGridUpdate.webgpuStatus);
  if (derivedSummary.mlsMpmGridUpdate.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmGridUpdate.webgpuStatus);
    expect(derivedSummary.mlsMpmGridUpdate.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update-parity.v0');
    if (derivedSummary.mlsMpmGridUpdate.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmGridUpdate.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect(derivedSummary.mlsMpmGridUpdate.parityStatus).toBe('not-run-no-full-readback');
      expect(derivedSummary.mlsMpmGridUpdate.parityMaxGridAbs).toBe(null);
      expect(derivedSummary.mlsMpmGridUpdate.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmGridUpdate.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmGridUpdate.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmGridUpdate.parityMaxGridAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmGridUpdate.parityTolerance
      );
      expect(derivedSummary.mlsMpmGridUpdate.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmGridUpdate.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.schema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-execution.v0');
  expect(derivedSummary.mlsMpmG2pReconstruction.reconstructionSchema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction.v0');
  expect(derivedSummary.mlsMpmG2pReconstruction.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmG2pReconstruction.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmG2pReconstruction.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmG2pReconstruction.dt).toBeGreaterThan(0);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmG2pReconstruction.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus);
  if (derivedSummary.mlsMpmG2pReconstruction.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus);
    expect(derivedSummary.mlsMpmG2pReconstruction.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-parity.v0');
    if (derivedSummary.mlsMpmG2pReconstruction.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityStatus).toBe('not-run-no-full-readback');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxStateAbs).toBe(null);
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxMechanicsAbs).toBe(null);
      expect(derivedSummary.mlsMpmG2pReconstruction.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxStateAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmG2pReconstruction.parityTolerance
      );
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxMechanicsAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmG2pReconstruction.parityTolerance
      );
      expect(derivedSummary.mlsMpmG2pReconstruction.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmG2pReconstruction.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.schema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(['cpu-reference', 'webgpu', 'mixed-fallback']).toContain(derivedSummary.mlsMpmResidentSteps.backend);
  expect(derivedSummary.mlsMpmResidentSteps.status).toBe('resident-steps-executed');
  expect(derivedSummary.mlsMpmResidentSteps.stepCount).toBe(2);
  expect(derivedSummary.mlsMpmResidentSteps.completedStepCount).toBe(2);
  expect(derivedSummary.mlsMpmResidentSteps.retainIntermediateSteps).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.retainedIntermediateStepCount).toBe(0);
  expect(derivedSummary.mlsMpmResidentSteps.finalStepSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0');
  expect([
    'resident-step-cpu-or-fallback',
    'resident-step-webgpu-executed'
  ]).toContain(derivedSummary.mlsMpmResidentSteps.finalStepStatus);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries).toHaveLength(2);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries[0].particlePingPong.sourceSlot).toBe(0);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries[0].particlePingPong.nextSlot).toBe(1);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries[1].particlePingPong.sourceSlot).toBe(1);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries[1].particlePingPong.nextSlot).toBe(0);
  expect(derivedSummary.mlsMpmResidentSteps.requestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.mlsMpmResidentSteps.gpuAuthoritativeState).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.scientificValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.schema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0');
  expect(derivedSummary.mlsMpmResidentStep.stepSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step.v0');
  expect(['cpu-reference', 'webgpu', 'mixed-fallback']).toContain(derivedSummary.mlsMpmResidentStep.backend);
  expect([
    'resident-step-cpu-or-fallback',
    'resident-step-webgpu-executed'
  ]).toContain(derivedSummary.mlsMpmResidentStep.status);
  expect(derivedSummary.mlsMpmResidentStep.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmResidentStep.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmResidentStep.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmResidentStep.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmResidentStep.requestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.mlsMpmResidentStep.gpuAuthoritativeState).toBe(false);
  if (derivedSummary.mlsMpmResidentStep.backend === 'webgpu') {
    expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback actual=no-full-readback');
    expect(derivedSummary.statusText).toContain('resident source  : previous-gpu-resident-output continued=true next=true');
    expect(derivedSummary.statusText).toContain('compact summary  : status=compact-summary-ready mode=compact-summary-readback');
    expect(derivedSummary.statusText).toContain('render readback  : available=false hot-loop-no-full=true');
    expect(derivedSummary.mlsMpmResidentSteps.readbackMode).toBe('no-full-readback');
    expect(derivedSummary.mlsMpmResidentSteps.residentSourceMode).toBe('previous-gpu-resident-output');
    expect(derivedSummary.mlsMpmResidentSteps.continuedFromResidentState).toBe(true);
    expect(derivedSummary.mlsMpmResidentSteps.continuationAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentSteps.nextParticleBufferMode).toBe('retained-g2p-output-buffers');
    expect(derivedSummary.mlsMpmResidentSteps.normalHotLoopReadbackFree).toBe(true);
    expect(derivedSummary.mlsMpmResidentSteps.renderStateReadbackAvailable).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.stepSummaries.every((summary) => (
      summary.requestedReadbackMode === 'no-full-readback'
      && summary.readbackMode === 'no-full-readback'
      && summary.normalHotLoopReadbackFree === true
      && summary.renderStateReadbackAvailable === false
    ))).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.readbackMode).toBe('no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.normalHotLoopReadbackFree).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.renderStateReadbackAvailable).toBe(false);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.readbackMode).toBe('no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryStatus).toBe('compact-summary-ready');
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryReadbackMode).toBe('compact-summary-readback');
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactReadbackByteLength).toBe(80);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactSummaryReductionStrategy).toBe(
      'two-pass-workgroup-reduction'
    );
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCount).toBeGreaterThan(0);
    expect(Math.abs(derivedSummary.mlsMpmResidentStep.diagnostics.massDeltaKg)).toBeLessThan(1e-3);
    expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.diagnostics.maxSpeedMPerS)).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.p2g).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.gridUpdate).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.g2p).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.residentBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.stageBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.g2pOutputBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.residentBufferMode).toBe('retained-stage-and-output-buffers');
    expect(derivedSummary.mlsMpmResidentStep.nextParticleBufferMode).toBe('retained-g2p-output-buffers');
    expect(derivedSummary.mlsMpmResidentStep.nextParticleStateBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.nextParticleMechanicsBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.sourceSlot).toBe(1);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextSlot).toBe(0);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextStep).toBe(
      derivedSummary.mlsMpmResidentStep.particlePingPong.step + 1
    );
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextTime).toBeGreaterThan(
      derivedSummary.mlsMpmResidentStep.particlePingPong.time
    );
  } else {
    expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback actual=full-parity-readback');
    expect(derivedSummary.statusText).toContain('resident source  : cpu-packed-state continued=false');
    expect(derivedSummary.statusText).toContain('render readback  : available=true hot-loop-no-full=false');
    expect(derivedSummary.mlsMpmResidentSteps.readbackMode).toBe('full-parity-readback');
    expect(derivedSummary.mlsMpmResidentSteps.residentSourceMode).toBe('cpu-packed-state');
    expect(derivedSummary.mlsMpmResidentSteps.continuedFromResidentState).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.normalHotLoopReadbackFree).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.renderStateReadbackAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.readbackMode).toBe('full-parity-readback');
    expect(derivedSummary.mlsMpmResidentStep.normalHotLoopReadbackFree).toBe(false);
    expect(derivedSummary.mlsMpmResidentStep.renderStateReadbackAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.readbackMode).toBe('full-parity-readback');
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCount).toBeGreaterThan(0);
    expect(Math.abs(derivedSummary.mlsMpmResidentStep.diagnostics.massDeltaKg)).toBeLessThan(1e-3);
    expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.diagnostics.maxSpeedMPerS)).toBe(true);
  }
  expect(derivedSummary.mlsMpmResidentStep.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.visibleSurfaces.length).toBeGreaterThan(0);
  expect(derivedSummary.visibleSurfaces.every((surface) => surface.lookupOutputRecordIndex != null)).toBe(true);
  expect(derivedSummary.visibleSurfaces.every((surface) => surface.lookupBackend === derivedSummary.opticalGpuLookup.executionBackend)).toBe(true);
});

test('SPH phase demo reacts room-temperature Na + H2O through derived product closure', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 720 });
  await page.goto('/#drop=Na&base=h2o&dropt=293.15&baset=293.15&ironh=1');
  await page.locator('#run-sph-phase').click();
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.locator('#sph-status')).toContainText('preflight        :');
  await expect(page.locator('#sph-status')).toContainText('Na+h2o');
  const stepped = await page.evaluate(() => document.querySelector('#sph-phase-overlay').__sphStep(2));
  expect(stepped.blocked).not.toBe(true);
  expect(stepped.particlesByMaterial.naoh).toBeGreaterThan(0);
});

test('ULG oscillator demo consumes a cached closure and emits a simulation artifact', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Run Oscillator' })).toBeVisible();
  await page.waitForFunction(() => typeof window.__ulgDemo?.runOscillatorDemo === 'function');
  const result = await page.evaluate(async () => {
    const run = await window.__ulgDemo.runOscillatorDemo({
      steps: 32,
      dt: 0.002,
      backendPreference: ['webgpu', 'cpu-reference']
    });
    const artifact = await window.__ulgDemo.artifactCache.get(run.artifactRef);
    const summary = await window.__ulgDemo.artifactCache.getSummary(run.artifactRef);
    const closureArtifact = await window.__ulgDemo.artifactCache.get(run.closureRef);
    return {
      status: run.status,
      closureValidity: run.closureValidity,
      artifactRef: run.artifactRef,
      closureRef: run.closureRef,
      closureArtifact,
      artifact,
      summary,
      closureRegistry: window.__ulgDemo.closureRegistry.list(),
      services: window.__ulgDemo.telemetry.services.map((service) => service.serviceId)
    };
  });
  expect(result.status).toBe('complete');
  expect(result.closureValidity).toBe('in-range');
  expect(result.artifactRef.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(result.closureRef.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(result.closureArtifact.tableDescriptor.wgslTableDescriptor.schema).toBe(
    'peercompute.ulg.closure-table-wgsl-descriptor.v0'
  );
  expect(result.closureArtifact.execution.wgslTableDescriptor.status).toBe('declared-table-wgsl-layout');
  expect(result.closureArtifact.execution.wgslTableDescriptor.sampleStruct).toBe('ClosureTableSample');
  expect(result.closureArtifact.execution.wgslTableDescriptor.sampleStrideFloats).toBe(4);
  expect(result.closureArtifact.execution.wgslTableDescriptor.rowLayout).toEqual([
    'axis:f32',
    'value:f32',
    'derivative:f32',
    'pad0:f32'
  ]);
  expect(result.closureArtifact.execution.wgslTableDescriptor.scientificValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.fullPhysicsValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.materialValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.eosValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.sphValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.phaseChangeValidation).toBe(false);
  expect(result.artifact.schema).toBe('peercompute.ulg.simulation-artifact.v0');
  expect(result.artifact.sourceService).toBe('ulg-runtime');
  expect(result.artifact.representation).toBe('carrier-toy');
  expect(['cpu-reference', 'webgpu']).toContain(result.artifact.execution.backend);
  expect(result.artifact.execution.webgpuStatus.status).not.toBe('not-requested');
  expect(result.artifact.execution.steps).toBe(32);
  if (result.artifact.execution.backend === 'webgpu') {
    expect(result.artifact.execution.webgpuStatus.status).toBe('webgpu-executed');
    expect(result.artifact.execution.webgpuParity.schema).toBe('peercompute.ulg.carrier-webgpu-parity.v0');
    expect(result.artifact.execution.webgpuParity.status).toBe('pass');
  } else {
    expect([
      'blocked-webgpu-unavailable',
      'webgpu-device-lost-fallback',
      'webgpu-error-fallback',
      'webgpu-parity-failed'
    ]).toContain(
      result.artifact.execution.webgpuStatus.status
    );
  }
  expect(result.artifact.outputs.deltas.length).toBe(32);
  expect(result.artifact.outputs.deltas[0].edgeMessageSummary.schema).toBe('peercompute.ulg.edge-message-summary.v0');
  expect(result.artifact.outputs.deltas[0].edgeMessageSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldObserverSummary.schema).toBe('peercompute.ulg.field-observer-summary.v0');
  expect(result.artifact.outputs.deltas[0].fieldObserverSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.schema).toBe('peercompute.ulg.field-closure-sample-summary.v0');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.validityStatus).toBe('in-range');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.closureRefreshRequest.status).toBe('not-needed');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.closureRefreshRecommended).toBe(false);
  expect(result.artifact.outputs.invariants.status).toBe('pass');
  expect(result.artifact.validation.scientificValidation).toBe(false);
  expect(result.artifact.validation.fullPhysicsValidation).toBe(false);
  expect(result.summary.artifactKind).toBe('simulation-delta');
  expect(result.summary.simulationBackend).toBe(result.artifact.execution.backend);
  expect(result.summary.simulationWebGpuStatus).toBe(result.artifact.execution.webgpuStatus.status);
  expect(result.summary.simulationInvariantStatus).toBe('pass');
  expect(result.summary.simulationDeltaCount).toBe(32);
  expect(result.summary.simulationEdgeMessageSummarySchema).toBe('peercompute.ulg.edge-message-summary.v0');
  expect(result.summary.simulationEdgeMessageSummaryStatus).toBe('pass');
  expect(result.summary.simulationEdgeMessageSummaryCount).toBe(32);
  expect(result.summary.simulationEdgeMessageMaxNetForceAbs).toBe(0);
  expect(result.summary.simulationEdgeMessageMaxAntisymmetricResidualAbs).toBe(0);
  expect(result.summary.simulationEdgeMessageOutOfRangeCount).toBe(0);
  expect(result.summary.simulationEdgeMessageScientificValidation).toBe(false);
  expect(result.summary.simulationEdgeMessageFullPhysicsValidation).toBe(false);
  expect(result.summary.simulationFieldObserverSummarySchema).toBe('peercompute.ulg.field-observer-summary.v0');
  expect(result.summary.simulationFieldObserverSummaryStatus).toBe('pass');
  expect(result.summary.simulationFieldObserverSummaryCount).toBe(32);
  expect(result.summary.simulationFieldObserverObservedFieldNames).toEqual([
    'positionX',
    'velocityX',
    'mass',
    'kineticEnergy',
    'closureAxisR'
  ]);
  expect(result.summary.simulationFieldObserverZeroWeightCount).toBe(0);
  expect(result.summary.simulationFieldObserverScientificValidation).toBe(false);
  expect(result.summary.simulationFieldObserverFullPhysicsValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleSummarySchema).toBe('peercompute.ulg.field-closure-sample-summary.v0');
  expect(result.summary.simulationFieldClosureSampleSummaryStatus).toBe('pass');
  expect(result.summary.simulationFieldClosureSampleSummaryCount).toBe(32);
  expect(result.summary.simulationFieldClosureSampleValidityStatus).toBe('in-range');
  expect(result.summary.simulationFieldClosureSampleFieldName).toBe('closureAxisR');
  expect(result.summary.simulationFieldClosureSampleAxisName).toBe('r');
  expect(result.summary.simulationFieldClosureSampleCount).toBe(2);
  expect(result.summary.simulationFieldClosureSampleOutOfRangeCount).toBe(0);
  expect(result.summary.simulationFieldClosureSampleNullFieldCount).toBe(0);
  expect(result.summary.simulationFieldClosureSampleMinSampledValue).toBeGreaterThanOrEqual(0);
  expect(result.summary.simulationFieldClosureSampleMaxSampledValue).toBeGreaterThanOrEqual(
    result.summary.simulationFieldClosureSampleMinSampledValue
  );
  expect(result.summary.simulationFieldClosureSampleRefreshRequestSchema).toBe('peercompute.ulg.closure-refresh-request.v0');
  expect(result.summary.simulationFieldClosureSampleRefreshRequestStatus).toBe('not-needed');
  expect(result.summary.simulationFieldClosureSampleRefreshRecommended).toBe(false);
  expect(result.summary.simulationFieldClosureSampleInvalidationRecommended).toBe(false);
  expect(result.summary.simulationFieldClosureSampleRefreshRegistryAction).toBe('none');
  expect(result.summary.simulationFieldClosureSampleMaterialValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleEosValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleSphValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSamplePhaseChangeValidation).toBe(false);
  if (result.artifact.execution.webgpuParity) {
    expect(result.summary.simulationWebGpuParitySchema).toBe('peercompute.ulg.carrier-webgpu-parity.v0');
    expect(result.summary.simulationWebGpuParityStatus).toBe(result.artifact.execution.webgpuParity.status);
  }
  expect(result.summary.simulationScientificValidation).toBe(false);
  expect(result.summary.simulationFullPhysicsValidation).toBe(false);
  expect(result.closureRegistry.some((entry) => (
    entry.closureKind === 'toy-two-particle-oscillator'
    && entry.status === 'valid'
  ))).toBe(true);
  expect(result.services).toContain('ulg-runtime');
  await expect(page.getByText(/simulation:carrier-toy/)).toBeVisible();
  await expect(page.getByText(/edge:pass/)).toBeVisible();
  await expect(page.getByText(/field:pass/)).toBeVisible();
  await expect(page.getByText(/closure-field:pass/)).toBeVisible();
  await expect(page.getByText(new RegExp(`sim-gpu:${result.summary.simulationWebGpuStatus}`))).toBeVisible();
  if (result.summary.simulationWebGpuParityStatus) {
    await expect(page.getByText(new RegExp(`sim-parity:${result.summary.simulationWebGpuParityStatus}`))).toBeVisible();
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
