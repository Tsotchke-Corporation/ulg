#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonOutput = args.includes('--json');
const moonlabOnly = args.includes('--moonlab-only');
const eshkolOnly = args.includes('--eshkol-only');
const projectsRoot = valueFor('--projects-root')
  || process.env.ULG_PROJECTS_ROOT
  || path.resolve(repoRoot, '..');
const createdAt = valueFor('--created-at') || process.env.ULG_STAGE_CREATED_AT || null;

const moonlabCoreRoot = path.join(projectsRoot, 'moonlab', 'bindings', 'javascript', 'packages', 'core');
const eshkolRoot = path.join(projectsRoot, 'eshkol');
const moonlabTargetDir = path.join(repoRoot, 'public', 'service-assets', 'moonlab');
const moonlabReferenceSuiteTarget = path.join(moonlabTargetDir, 'magnetar-reference-contracts.json');
const moonlabWebGpuParityScopeTarget = path.join(moonlabTargetDir, 'webgpu-complex64-parity-scope.json');
const eshkolClosureBundleName = 'magnetar-closure';
const eshkolTargetDir = path.join(repoRoot, 'public', 'service-assets', 'eshkol', 'closures', eshkolClosureBundleName);
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ESHKOL_PRODUCTION_HANDLER_BOUNDARY_SCHEMA = 'eshkol.ulg.production-handler-boundary.v0';
const PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA = 'peercompute.ulg.dispatch-service-handler-context.v0';

function valueFor(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function ensureFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function copyAsset(source, target, label) {
  ensureFile(source, label);
  if (!dryRun) {
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  return {
    label,
    source,
    target,
    byteLength: statSync(source).size,
    action: dryRun ? 'would-copy' : 'copied'
  };
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function arraysEqual(left = [], right = []) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function stageMoonLabReferenceSuite() {
  const input = path.join(moonlabCoreRoot, 'references', 'magnetar-calibrated-reference-contracts.json');
  const target = moonlabReferenceSuiteTarget;
  ensureFile(input, 'MoonLab magnetar reference contracts');

  const command = [
    'pnpm',
    'ulg:artifact',
    '--',
    '--normalize-references',
    input,
    '--canonical',
    '--strict',
    '--out',
    target
  ];

  if (!dryRun) {
    mkdirSync(path.dirname(target), { recursive: true });
    const result = spawnSync(command[0], command.slice(1), {
      cwd: moonlabCoreRoot,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error([
        `MoonLab reference suite normalization failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ].filter(Boolean).join('\n'));
    }

    const suite = JSON.parse(readFileSync(target, 'utf8'));
    const references = Array.isArray(suite.references) ? suite.references : [];
    if (suite.schema !== 'moonlab.magnetar.normalized-reference-suite.v0') {
      throw new Error('MoonLab staged reference asset is missing normalized reference-suite schema');
    }
    if (suite.status !== 'reference-contract-suite-ready' || suite.ready !== true) {
      throw new Error(`MoonLab staged reference suite is not ready: ${suite.status || 'unknown'}`);
    }
    if (references.length !== 4 || references.some((reference) => reference.ready !== true)) {
      throw new Error(`expected 4 ready MoonLab references, found ${references.filter((reference) => reference.ready === true).length}/${references.length}`);
    }
    if (suite.fidelityRuntimeScope?.schema !== 'ulg.magnetar.fidelity-runtime-scope.v0') {
      throw new Error('MoonLab staged reference suite is missing fidelity/runtime scope metadata');
    }
    if (suite.fidelityRuntimeScope.fullFidelityMagnetarSimulation !== false
      || suite.fidelityRuntimeScope.fullPhysicsValidation !== false) {
      throw new Error('MoonLab staged reference suite overstates full-fidelity physics validation');
    }
    if (references.some((reference) => reference.fidelityRuntimeScope?.schema !== 'ulg.magnetar.fidelity-runtime-scope.v0')) {
      throw new Error('MoonLab staged references are missing fidelity/runtime scope metadata');
    }
    if (references.some((reference) => (
      reference.fidelityRuntimeScope.fullFidelityMagnetarSimulation !== false
      || reference.fidelityRuntimeScope.fullPhysicsValidation !== false
    ))) {
      throw new Error('MoonLab staged references overstate full-fidelity physics validation');
    }
  }

  return {
    label: 'MoonLab normalized magnetar reference suite',
    source: input,
    target,
    command,
    contentHash: dryRun ? null : sha256File(target),
    byteLength: dryRun ? null : statSync(target).size,
    action: dryRun ? 'would-normalize' : 'normalized'
  };
}

function stageMoonLabWebGpuParityScope() {
  const target = moonlabWebGpuParityScopeTarget;
  const command = [
    'pnpm',
    'webgpu:complex64:parity',
    '--',
    '--out',
    target
  ];
  if (createdAt != null) {
    command.push('--generated-at', createdAt);
  }

  if (!dryRun) {
    mkdirSync(path.dirname(target), { recursive: true });
    const result = spawnSync(command[0], command.slice(1), {
      cwd: moonlabCoreRoot,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error([
        `MoonLab WebGPU complex64 parity scope generation failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ].filter(Boolean).join('\n'));
    }

    const artifact = JSON.parse(readFileSync(target, 'utf8'));
    if (artifact.schema !== 'moonlab.webgpu.complex64-parity-scope.v0') {
      throw new Error('MoonLab WebGPU parity scope asset is missing expected schema');
    }
    if (artifact.contractReady !== true || artifact.contractValidation?.valid !== true) {
      throw new Error('MoonLab WebGPU parity scope contract did not validate');
    }
    if (artifact.reducedFixtureOnly !== true
      || artifact.fullFidelityMagnetarSimulation !== false
      || artifact.fullPhysicsValidation !== false) {
      throw new Error('MoonLab WebGPU parity scope overstates fidelity or physics validation');
    }
    if (artifact.fidelityRuntimeScope?.schema !== 'ulg.magnetar.fidelity-runtime-scope.v0'
      || artifact.fidelityRuntimeScope.fullFidelityMagnetarSimulation !== false
      || artifact.fidelityRuntimeScope.fullPhysicsValidation !== false) {
      throw new Error('MoonLab WebGPU parity scope is missing reduced fidelity/runtime scope metadata');
    }
    if (artifact.backendAvailable !== false
      || artifact.webgpuParity?.executed !== false
      || artifact.webgpuParity?.passed !== false) {
      throw new Error('MoonLab WebGPU parity scope must remain no-backend evidence in ULG staging');
    }
    const blockers = Array.isArray(artifact.blockers) ? artifact.blockers : [];
    if (!blockers.includes('browser-webgpu-kernel-parity-not-executed')) {
      throw new Error('MoonLab WebGPU parity scope is missing the native kernel parity blocker');
    }
    if (!blockers.includes('native-webgpu-operation-coverage-not-yet-recorded')) {
      throw new Error('MoonLab WebGPU parity scope is missing the native operation coverage blocker');
    }
    if (artifact.complex64Preflight?.passed !== true) {
      throw new Error('MoonLab WebGPU parity scope complex64 preflight did not pass');
    }
    const browserKernelProbe = artifact.browserKernelProbe;
    if (browserKernelProbe?.schema !== 'moonlab.webgpu.complex64-probability-kernel-probe.v0'
      || browserKernelProbe.probeKind !== 'browser-webgpu-complex64-probability-kernel'
      || browserKernelProbe.kernel !== 'compute_probabilities') {
      throw new Error('MoonLab WebGPU parity scope is missing the browser probability-kernel probe');
    }
    if (browserKernelProbe.executed !== false
      || browserKernelProbe.passed !== false
      || browserKernelProbe.maxProbabilityAbsDiff !== null
      || !Array.isArray(browserKernelProbe.coveredNativeOperations)
      || browserKernelProbe.coveredNativeOperations.length !== 0) {
      throw new Error('MoonLab browser WebGPU kernel probe must remain declared but unexecuted in ULG staging');
    }
  }

  return {
    label: 'MoonLab WebGPU complex64 parity scope',
    source: path.join(moonlabCoreRoot, 'scripts', 'webgpu-complex64-parity.mjs'),
    target,
    command,
    contentHash: dryRun ? null : sha256File(target),
    byteLength: dryRun ? null : statSync(target).size,
    action: dryRun ? 'would-generate' : 'generated'
  };
}

function stageMoonLabAssets() {
  const staged = [
    copyAsset(
      path.join(moonlabCoreRoot, 'dist', 'moonlab.js'),
      path.join(moonlabTargetDir, 'moonlab.js'),
      'MoonLab browser loader'
    ),
    copyAsset(
      path.join(moonlabCoreRoot, 'dist', 'moonlab.wasm'),
      path.join(moonlabTargetDir, 'moonlab.wasm'),
      'MoonLab WASM module'
    )
  ];
  staged.push(stageMoonLabReferenceSuite());
  staged.push(stageMoonLabWebGpuParityScope());
  return staged;
}

function stageEshkolAssets() {
  const helper = path.join(eshkolRoot, 'scripts', 'export_ulg_closure_bundle.py');
  const input = path.join(eshkolRoot, 'examples', 'magnetar_closure.esk');
  const metadata = path.join(eshkolRoot, 'examples', 'magnetar_closure.ulg-metadata.json');
  const eshkolRun = valueFor('--eshkol-run') || process.env.ESHKOL_RUN || path.join(eshkolRoot, 'build', 'eshkol-run');
  ensureFile(helper, 'Eshkol closure bundle helper');
  ensureFile(input, 'Eshkol magnetar closure source');
  ensureFile(metadata, 'Eshkol magnetar closure metadata');
  ensureFile(eshkolRun, 'eshkol-run binary');

  const command = [
    'python3',
    helper,
    input,
    '--eshkol-run',
    eshkolRun,
    '--output-dir',
    eshkolTargetDir,
    '--name',
    eshkolClosureBundleName,
    '--metadata-json',
    metadata,
    '--require-export',
    'main'
  ];
  if (createdAt != null) {
    command.push('--created-at', createdAt);
  }

  if (!dryRun) {
    mkdirSync(eshkolTargetDir, { recursive: true });
    const result = spawnSync(command[0], command.slice(1), {
      cwd: eshkolRoot,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error([
        `Eshkol bundle export failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ].filter(Boolean).join('\n'));
    }

    const artifactPath = path.join(eshkolTargetDir, `${eshkolClosureBundleName}.ulg.json`);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    if (artifact.closureKind !== 'magnetar-closure-descriptor-fixture') {
      throw new Error(`Eshkol staged artifact has unexpected closure kind: ${artifact.closureKind || 'unknown'}`);
    }
    if (artifact.validation?.closureDescriptor?.schema !== 'eshkol.ulg.magnetar-closure-descriptor.v0') {
      throw new Error('Eshkol staged artifact is missing magnetar closure descriptor metadata');
    }
    if (artifact.validation?.closureDescriptor?.scientificValidation !== false) {
      throw new Error('Eshkol staged magnetar descriptor must not claim scientific validation');
    }
    const descriptorBinding = artifact.validation?.closureDescriptor?.descriptorBinding;
    const tensorContract = artifact.validation?.closureDescriptor?.tensorContract;
    const fidelityRuntimeScope = descriptorBinding?.fidelityRuntimeScope;
    if (fidelityRuntimeScope?.schema !== 'ulg.magnetar.fidelity-runtime-scope.v0') {
      throw new Error('Eshkol staged magnetar descriptor is missing fidelity/runtime scope metadata');
    }
    if (fidelityRuntimeScope.hostRuntimeSmokeFixture !== true
      || fidelityRuntimeScope.fullFidelityMagnetarSimulation !== false
      || fidelityRuntimeScope.fullPhysicsValidation !== false) {
      throw new Error('Eshkol staged magnetar descriptor overstates runtime or full-physics validation');
    }
    const moonlabSuite = descriptorBinding?.moonlabNormalizedReferenceSuite;
    const moonlabSuiteScope = moonlabSuite?.fidelityRuntimeScope;
    if (moonlabSuite?.schema !== 'moonlab.magnetar.normalized-reference-suite.v0') {
      throw new Error('Eshkol staged magnetar descriptor is missing MoonLab normalized reference suite binding');
    }
    if (!SHA256_DIGEST_PATTERN.test(String(moonlabSuite.contentHash || ''))) {
      throw new Error('Eshkol staged magnetar descriptor has invalid MoonLab reference suite hash');
    }
    if (existsSync(moonlabReferenceSuiteTarget) && moonlabSuite.contentHash !== sha256File(moonlabReferenceSuiteTarget)) {
      throw new Error('Eshkol staged magnetar descriptor MoonLab reference suite hash does not match staged MoonLab asset');
    }
    if (moonlabSuiteScope?.schema !== 'ulg.magnetar.fidelity-runtime-scope.v0'
      || moonlabSuiteScope.fullFidelityMagnetarSimulation !== false
      || moonlabSuiteScope.fullPhysicsValidation !== false) {
      throw new Error('Eshkol staged MoonLab reference suite binding is missing reduced fidelity/runtime scope metadata');
    }
    const interpolationTable = descriptorBinding?.ulgInterpolationTable;
    const tensorRuntimeContract = descriptorBinding?.closureTensorRuntimeContract;
    const tensorRuntimeSampleShapeValidation = tensorRuntimeContract?.sampleShapeValidation;
    const tensorRuntimeInterpolationTable = tensorRuntimeContract?.interpolationTable;
    const productionHandlerBoundary = descriptorBinding?.productionHandlerBoundary;
    if (tensorRuntimeContract?.schema !== 'eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0') {
      throw new Error('Eshkol staged magnetar descriptor is missing tensor runtime contract metadata');
    }
    if (tensorRuntimeContract.status !== 'declared-fixture-contract'
      || tensorRuntimeContract.runtimeStatus !== 'declared-not-executed'
      || tensorRuntimeContract.scientificValidation !== false
      || tensorRuntimeContract.fullPhysicsValidation !== false) {
      throw new Error('Eshkol staged tensor runtime contract overstates execution or physics validation');
    }
    if (!SHA256_DIGEST_PATTERN.test(String(tensorRuntimeContract.contractHash || ''))) {
      throw new Error('Eshkol staged tensor runtime contract hash is invalid');
    }
    if (tensorRuntimeContract.entryExport !== artifact.validation?.closureDescriptor?.entryExport
      || tensorRuntimeContract.coordinateSystem !== tensorContract?.coordinateSystem
      || !arraysEqual(tensorRuntimeContract.inputTensorIds, tensorContract?.inputIds)
      || !arraysEqual(tensorRuntimeContract.outputTensorIds, tensorContract?.outputIds)) {
      throw new Error('Eshkol staged tensor runtime contract does not match descriptor tensor ids');
    }
    if (tensorRuntimeInterpolationTable?.id !== interpolationTable?.id
      || tensorRuntimeInterpolationTable?.contentHash !== interpolationTable?.contentHash
      || tensorRuntimeInterpolationTable?.sampleCount !== interpolationTable?.sampleCount) {
      throw new Error('Eshkol staged tensor runtime contract does not match interpolation table metadata');
    }
    if (tensorRuntimeSampleShapeValidation?.schema !== 'eshkol.ulg.tensor-sample-shape-validation.v0'
      || tensorRuntimeSampleShapeValidation.status !== 'pass'
      || tensorRuntimeSampleShapeValidation.validatedSampleCount !== interpolationTable?.sampleCount
      || tensorRuntimeSampleShapeValidation.scientificValidation !== false) {
      throw new Error('Eshkol staged tensor runtime sample-shape validation is not ready');
    }
    if (productionHandlerBoundary?.schema !== ESHKOL_PRODUCTION_HANDLER_BOUNDARY_SCHEMA
      || productionHandlerBoundary.dispatchSchema !== PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA) {
      throw new Error('Eshkol staged magnetar descriptor is missing production handler boundary metadata');
    }
    if (productionHandlerBoundary.status !== 'declared-not-executed'
      || productionHandlerBoundary.handlerReady !== false
      || productionHandlerBoundary.runtimeExecution !== false
      || productionHandlerBoundary.derivativeStatus !== 'declared-not-computed'
      || productionHandlerBoundary.scientificValidation !== false
      || productionHandlerBoundary.fullPhysicsValidation !== false
      || productionHandlerBoundary.fullFidelityMagnetarSimulation !== false) {
      throw new Error('Eshkol staged production handler boundary overstates runtime readiness or physics validation');
    }
    if (productionHandlerBoundary.entryExport !== artifact.validation?.closureDescriptor?.entryExport
      || productionHandlerBoundary.runtimeAbi !== tensorRuntimeContract.runtimeAbi
      || productionHandlerBoundary.tensorMemoryModel !== tensorRuntimeContract.tensorMemoryModel
      || !arraysEqual(productionHandlerBoundary.inputTensorIds, tensorRuntimeContract.inputTensorIds)
      || !arraysEqual(productionHandlerBoundary.outputTensorIds, tensorRuntimeContract.outputTensorIds)) {
      throw new Error('Eshkol staged production handler boundary does not match tensor runtime contract');
    }
    if (productionHandlerBoundary.moduleRef?.source !== 'artifact.execution.module'
      || productionHandlerBoundary.moduleRef?.contentAddressing !== 'required'
      || productionHandlerBoundary.moduleRef?.sha256Field !== 'artifact.execution.module.sha256') {
      throw new Error('Eshkol staged production handler boundary has invalid module reference metadata');
    }
    if (productionHandlerBoundary.hostImports?.required !== artifact.validity?.requiresHostImports
      || productionHandlerBoundary.hostImports?.factory !== 'createEshkolHostImportObject') {
      throw new Error('Eshkol staged production handler boundary has invalid host import metadata');
    }
    const allowedExecutionClaims = Array.isArray(productionHandlerBoundary.allowedExecutionClaims)
      ? productionHandlerBoundary.allowedExecutionClaims
      : [];
    if (!allowedExecutionClaims.includes(tensorRuntimeContract.executionClaim)) {
      throw new Error('Eshkol staged production handler boundary does not allow the tensor runtime execution claim');
    }
    const handlerBoundaryBlockers = Array.isArray(productionHandlerBoundary.blockers)
      ? productionHandlerBoundary.blockers
      : [];
    for (const blocker of [
      'production-magnetar-handler-not-implemented',
      'wasm-tensor-memory-binding-not-executed',
      'full-physics-validation-not-run'
    ]) {
      if (!handlerBoundaryBlockers.includes(blocker)) {
        throw new Error(`Eshkol staged production handler boundary is missing blocker: ${blocker}`);
      }
    }
    if (artifact.execution?.module?.url !== `${eshkolClosureBundleName}.wasm`) {
      throw new Error(`Eshkol staged artifact has unexpected module URL: ${artifact.execution?.module?.url || 'unknown'}`);
    }
    if (artifact.execution?.serviceWorkerSafe !== true || artifact.validity?.requiresDynamicCode !== false) {
      throw new Error('Eshkol staged magnetar closure must remain service-worker-safe and dynamic-code-free');
    }
  }

  return {
    label: 'Eshkol magnetar closure descriptor bundle',
    source: input,
    target: eshkolTargetDir,
    command,
    action: dryRun ? 'would-export' : 'exported'
  };
}

function main() {
  if (moonlabOnly && eshkolOnly) {
    throw new Error('choose at most one of --moonlab-only or --eshkol-only');
  }
  const staged = [];
  if (!eshkolOnly) staged.push(...stageMoonLabAssets());
  if (!moonlabOnly) staged.push(stageEshkolAssets());

  const summary = {
    schema: 'ulg.service-assets.staging.v0',
    repoRoot,
    projectsRoot,
    createdAt,
    dryRun,
    staged
  };
  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  for (const item of staged) {
    console.log(`${item.action}: ${item.label}`);
    console.log(`  source: ${item.source}`);
    console.log(`  target: ${item.target}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
