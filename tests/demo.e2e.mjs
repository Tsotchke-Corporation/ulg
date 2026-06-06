import { expect, test } from '@playwright/test';

test('supervised service smoke renders desktop and mobile worker trees', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await expect(page.getByText('PeerCompute')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Multiscale' })).toHaveAttribute('href', /https:\/\/.*:5185\/\?scenario=magnetar/);
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
    expect(eshkolArtifact.validation.status).toBe('descriptor-only');
    expect(eshkolArtifact.validation.validationMode).toBe('eshkol-static-magnetar-closure-descriptor');
    expect(eshkolArtifact.runtime.bundleManifest.preserveRelativeUrls).toBe(true);
    expect(eshkolArtifact.validation.outputSemantics.schema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolArtifact.validation.outputSemantics.semanticScope).toBe('smoke-fixture');
    expect(eshkolArtifact.validation.outputSemantics.scientificScope).toBe('none');
    expect(eshkolArtifact.validation.outputSemantics.scientificValidation).toBe(false);
    expect(eshkolArtifact.validation.outputSemantics.entryExport).toBe('main');
    expect(eshkolArtifact.validation.outputSemantics.entryArgs).toEqual([0, 0]);
    expect(eshkolArtifact.validation.outputSemantics.expectedEntryResult).toBe(0);
    expect(eshkolArtifact.validation.outputSemantics.stdout.expectedText).toBe('1048560\n10485441048528\n');
    expect(eshkolArtifact.validation.outputSemantics.stdout.sha256).toBe('sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768');
    expect(eshkolArtifact.validation.outputSemantics.stdout.byteLength).toBe(23);
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
    expect(eshkolArtifact.validation.closureDescriptor.descriptorBinding.fidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      runtimeScope: 'eshkol-host-runtime-smoke-fixture',
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    const interpolationTable = eshkolArtifact.validation.closureDescriptor.descriptorBinding.ulgInterpolationTable;
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
    expect(tensorRuntimeContract.executionClaim).toBe('metadata-and-smoke-output-only');
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
    expect(tensorRuntimeContract.contractHash).toBe('sha256:4b0d9c61ae83f1695978fd2f6b918bdbcab1ccca550b520c0467e7159c805d28');
    expect(tensorRuntimeContract.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.fullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.schema).toBe('peercompute.ulg.artifact-summary.v0');
    expect(eshkolTelemetryRecord.artifactSummary.artifactKind).toBe('closure');
    expect(eshkolTelemetryRecord.artifactSummary.validationStatus).toBe('descriptor-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureKind).toBe('magnetar-closure-descriptor-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureModuleUrl).toBe('magnetar-closure.wasm');
    expect(eshkolTelemetryRecord.artifactSummary.closureServiceWorkerSafe).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.parameters).toEqual(['i32', 'i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.results).toEqual(['i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureHasStartSection).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureStartFunctionIndex).toBe(null);
    expect(eshkolTelemetryRecord.artifactSummary.closureImportCount).toBe(33);
    expect(eshkolTelemetryRecord.artifactSummary.closureExportCount).toBe(1);
    expect(eshkolTelemetryRecord.artifactSummary.closureRuntimeFunctionImportCount).toBe(30);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmFunctionCount).toBe(41);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmTypeCount).toBe(109);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactory).toBe('createEshkolHostImportObject');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureBundlePreserveRelativeUrls).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsSchema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticScope).toBe('smoke-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificScope).toBe('none');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryArgs).toEqual([0, 0]);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryResult).toBe(0);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(23);
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
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractHash).toBe('sha256:4b0d9c61ae83f1695978fd2f6b918bdbcab1ccca550b520c0467e7159c805d28');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeRuntimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-smoke-v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeExecutionClaim).toBe('metadata-and-smoke-output-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidationStatus).toBe('pass');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidatedSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureReady).toBe(true);
    const closureHandoff = handoff.artifacts.find((artifact) => artifact.artifactKind === 'closure');
    expect(closureHandoff.artifactSummary.closureEntryExport).toBe('main');
    expect(closureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(closureHandoff.artifactSummary.closureDescriptorReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768');
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(23);
    expect(closureHandoff.wasmByteLength).toBe(53066);
    expect(closureHandoff.wasmBytes.length).toBe(53066);
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
