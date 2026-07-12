import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SOLID_PRODUCTION_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_SOLID_PRODUCTION_OUTPUT
  || '/tmp/ulg-coherent-solid-production-bridge.json';
const frameDirectory = process.env.ULG_SOLID_PRODUCTION_FRAME_DIR
  || '/tmp/ulg-coherent-solid-production-bridge';
const timeoutMs = Math.max(30_000, Number(process.env.ULG_SOLID_PRODUCTION_TIMEOUT_MS) || 240_000);
const injectionEnabled = process.env.ULG_SOLID_PRODUCTION_INJECTION === '1';
const requireSceneBridge = process.env.ULG_SOLID_REQUIRE_SCENE_BRIDGE === '1';

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

function targetUrl() {
  const target = new URL(baseUrl);
  for (const [key, value] of Object.entries({
    drop: 'h2o',
    base: 'h2o',
    dropt: '300',
    baset: '300',
    dropn: '1',
    basen: '2',
    boxx: '24',
    boxy: '24',
    boxz: '24',
    mech: 'mlsmpm',
    renderer: 'native-webgpu',
    renderOwnership: 'main-thread-renderer',
    surfaceDraw: 'native-webgpu-surface-consumer'
  })) target.searchParams.set(key, value);
  if (requireSceneBridge) target.searchParams.set('gpuProfile', '1');
  return target.toString();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function capture(canvas, name) {
  const bytes = await canvas.screenshot({ type: 'png' });
  const framePath = path.join(frameDirectory, `${name}.png`);
  await writeFile(framePath, bytes);
  return {
    name,
    path: framePath,
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    bytes
  };
}

async function comparePngs(page, left, right) {
  return page.evaluate(async ({ leftUrl, rightUrl }) => {
    const pixels = async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        values: context.getImageData(0, 0, canvas.width, canvas.height).data
      };
    };
    const [a, b] = await Promise.all([pixels(leftUrl), pixels(rightUrl)]);
    if (a.width !== b.width || a.height !== b.height) return { status: 'dimension-mismatch' };
    let differingPixelCount = 0;
    let absoluteChannelDifference = 0;
    for (let index = 0; index < a.values.length; index += 4) {
      const delta = Math.abs(a.values[index] - b.values[index])
        + Math.abs(a.values[index + 1] - b.values[index + 1])
        + Math.abs(a.values[index + 2] - b.values[index + 2]);
      if (delta > 24) differingPixelCount += 1;
      absoluteChannelDifference += delta;
    }
    const pixelCount = a.width * a.height;
    return {
      status: 'ready',
      pixelCount,
      differingPixelCount,
      differingPixelRatio: differingPixelCount / pixelCount,
      meanAbsoluteChannelDifference: absoluteChannelDifference / (pixelCount * 3)
    };
  }, {
    leftUrl: `data:image/png;base64,${left.toString('base64')}`,
    rightUrl: `data:image/png;base64,${right.toString('base64')}`
  });
}

async function analyzePng(page, bytes) {
  return page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nearBlackPixelCount = 0;
    let luminanceSum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red < 4 && green < 4 && blue < 4) nearBlackPixelCount += 1;
      luminanceSum += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
    const pixelCount = canvas.width * canvas.height;
    return {
      width: canvas.width,
      height: canvas.height,
      pixelCount,
      nearBlackPixelCount,
      nearBlackPixelRatio: nearBlackPixelCount / pixelCount,
      meanLuminance: luminanceSum / pixelCount
    };
  }, `data:image/png;base64,${bytes.toString('base64')}`);
}

function compactFrame(frame) {
  const { bytes: _bytes, ...compact } = frame;
  return compact;
}

async function main() {
  const startedAt = new Date().toISOString();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(frameDirectory, { recursive: true });
  if (!injectionEnabled) {
    const skipped = {
      schema: 'peercompute.ulg.coherent-solid-production-bridge-probe.v0',
      status: 'skipped',
      reason: 'set ULG_SOLID_PRODUCTION_INJECTION=1 to run the authoritative production probe',
      startedAt,
      completedAt: new Date().toISOString()
    };
    await writeFile(outputPath, `${JSON.stringify(skipped, null, 2)}\n`);
    console.log(JSON.stringify(skipped, null, 2));
    return;
  }

  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  const consoleMessages = [];
  const pageErrors = [];
  let artifact;
  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 760 },
      ignoreHTTPSErrors: true
    });
    page.on('console', (message) => {
      if (!['warning', 'error'].includes(message.type())) return;
      const entry = { type: message.type(), text: message.text() };
      if (
        consoleMessages.length < 100
        && !consoleMessages.some((value) => value.type === entry.type && value.text === entry.text)
      ) consoleMessages.push(entry);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
    await page.goto(targetUrl(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
    await page.waitForFunction((sceneBridgeRequired) => {
      const sceneApi = document.querySelector('#sph-phase-overlay')?.__sphScene;
      const host = sceneApi?.getResidentAuthorityHost?.();
      const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.();
      return Boolean(
        host?.status === 'ready'
        && sceneApi?.setAdmittedCoherentSolidDrawEntries
        && navigator.gpu
        && (!sceneBridgeRequired || (
          bridge?.rendererBridge === 'native-webgpu-surface-consumer'
          && bridge?.device
          && bridge?.drawState
          && bridge?.cameraBuffer
          && bridge?.canvas
        ))
      );
    }, requireSceneBridge, { timeout: timeoutMs });
    await page.evaluate(async (sceneBridgeRequired) => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay.__sphScene;
      let bridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.() || null;
      if (!bridge && sceneBridgeRequired) {
        throw new Error('mounted coherent-solid production probe requires the scene native surface bridge');
      }
      if (!bridge) {
        const nativeModule = await import(
          `/src/runtime/solid/coherentSolidNativeBridge.js?standaloneProbe=${Date.now()}`
        );
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('standalone coherent-solid surface probe has no WebGPU adapter');
        const device = await adapter.requestDevice();
        const canvas = document.createElement('canvas');
        canvas.width = 1100;
        canvas.height = 760;
        Object.assign(canvas.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          zIndex: '100',
          display: 'block'
        });
        overlay.append(canvas);
        const context = canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        const depthFormat = 'depth24plus';
        context.configure({ device, format, alphaMode: 'opaque' });
        const depthTexture = device.createTexture({
          label: 'coherent-solid-standalone-depth',
          size: [canvas.width, canvas.height, 1],
          format: depthFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        const cameraBuffer = device.createBuffer({
          label: 'coherent-solid-standalone-camera',
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const dims = sceneApi.getBoxDimensionsM?.() || [24, 24, 24];
        const camera = new Float32Array([
          2 / dims[0], 0, 0, 0,
          0, 2 / dims[1], 0, 0,
          0, 0, -1 / (2 * dims[2]), 0,
          -1, -1, 0.75, 1
        ]);
        device.queue.writeBuffer(cameraBuffer, 0, camera);
        let pipelineBundle = null;
        let executor = null;
        let frameCount = 0;
        let presentationSerial = 0;
        const render = async (publication = null) => {
          const contract = publication ? nativeModule.resolveAdmittedCoherentSolidDrawEntries({
            solidDrawEntries: publication,
            device,
            source: 'standalone-native-webgpu-surface-consumer',
            stateManagerAdmissionValidated:
              sceneApi.getResidentAuthorityHost().validateCoherentSolidDrawPublication(publication)
              === publication
          }) : null;
          executor?.destroy?.();
          executor = contract?.ready
            ? nativeModule.createCoherentSolidNativeWebGpuExecutor({
              contract,
              device,
              format,
              depthFormat,
              cameraBuffer,
              pipelineBundle,
              source: 'standalone-native-webgpu-surface-consumer'
            })
            : null;
          pipelineBundle ||= executor?.pipelineBundle || null;
          const encoder = device.createCommandEncoder({
            label: `coherent-solid-standalone-present-${presentationSerial + 1}`
          });
          const pass = encoder.beginRenderPass({
            label: 'coherent-solid-standalone-surface-pass',
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0.025, g: 0.035, b: 0.04, a: 1 },
              loadOp: 'clear',
              storeOp: 'store'
            }],
            depthStencilAttachment: {
              view: depthTexture.createView(),
              depthClearValue: 1,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          });
          const opaque = executor?.executeOpaque(pass) || { drawCommandCount: 0 };
          const transparent = executor?.executeTransparent(pass) || { drawCommandCount: 0 };
          pass.end();
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          frameCount += 1;
          presentationSerial += 1;
          Object.assign(bridge, {
            frameCount,
            coherentSolidNativeExecutor: executor,
            coherentSolidNativeExecutorStatus: executor?.status || 'standalone-background-only',
            coherentSolidNativeOpaqueDrawCount: opaque.drawCommandCount,
            coherentSolidNativeTransparentDrawCount: transparent.drawCommandCount,
            lastCoherentSolidNativeOpaqueSubmitStatus:
              executor ? 'coherent-solid-native-opaque-submitted-to-pass' : 'not-submitted',
            coherentSolidCpuFrameTransformUploadPerformed: false,
            nativeSurfacePresentationOwner: 'native-webgpu-surface-consumer-scheduler',
            nativeSurfacePresentationSerial: presentationSerial,
            nativeSurfacePresentationOwnershipStatus: 'single-owner-presented',
            nativeSurfaceCurrentTextureAcquisitionSerial: presentationSerial,
            lastNativeSurfaceCurrentTexturePresentationSerial: presentationSerial,
            lastNativeSurfaceCurrentTextureOwner: 'native-webgpu-surface-consumer-scheduler',
            nativeSurfaceCurrentTextureAcquisitionsPerPresentation: 1
          });
          return {
            status: contract?.ready
              ? 'admitted-coherent-solid-draw-entries-ready'
              : 'standalone-background-ready',
            ready: contract?.ready === true,
            reason: contract?.reason || null,
            publicationGeneration: publication?.publicationGeneration ?? null,
            drawGroupCount: contract?.drawGroupCount ?? 0
          };
        };
        bridge = {
          rendererBridge: 'native-webgpu-surface-consumer',
          source: 'standalone-production-validation-surface',
          device,
          drawState: {},
          cameraBuffer,
          canvas,
          frameCount,
          presentCoherentSolidPublication: render,
          destroy() {
            executor?.destroy?.();
            cameraBuffer.destroy();
            depthTexture.destroy();
            canvas.remove();
          }
        };
        window.__ulgCoherentSolidStandaloneBridge = bridge;
        await render();
      }
      const play = document.querySelector('#sph-play');
      if (/Pause/i.test(play?.textContent || '')) play.click();
      bridge.canvas.dataset.coherentSolidProductionProbe = 'true';
    }, requireSceneBridge);
    await page.addStyleTag({
      content: [
        '#sph-phase-overlay #sph-panel',
        '#sph-phase-overlay #sph-toggle',
        '#sph-phase-overlay #sph-warning-bar',
        '#sph-phase-overlay .sph-element-picker-overlay'
      ].join(',') + '{visibility:hidden!important;}'
    });
    const canvas = page.locator('canvas[data-coherent-solid-production-probe="true"]');
    await canvas.waitFor({ state: 'visible', timeout: timeoutMs });
    await page.waitForTimeout(400);
    const baseline = await capture(canvas, 'baseline');

    const setup = await page.evaluate(async (sceneBridgeRequired) => {
      const sceneApi = document.querySelector('#sph-phase-overlay').__sphScene;
      const bridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.()
        || window.__ulgCoherentSolidStandaloneBridge;
      const host = sceneApi.getResidentAuthorityHost();
      const device = bridge.device;
      const abi = await import(`/ulg-gpu-abi/src/coherentSolid.js?authorityProbe=${Date.now()}`);
      const fixtureModule = await import(
        `/src/runtime/solid/coherentSolidValidationFixture.js?authorityProbe=${Date.now()}`
      );
      const rendererModule = await import(
        `/src/runtime/solid/coherentSolidShapeRenderer.js?authorityProbe=${Date.now()}`
      );
      const taskModule = await import(
        `/src/runtime/solid/coherentSolidResidentTask.js?authorityProbe=${Date.now()}`
      );
      const validationModule = await import(
        `/src/runtime/solid/coherentSolidMetamorphicValidationGpu.js?authorityProbe=${Date.now()}`
      );
      const fixture = fixtureModule.createAsymmetricCoherentSolidFixture({
        geometryKey: 0x534f4c91,
        densityKgM3: 3,
        materialId: 26,
        phaseId: 1,
        closureId: 4,
        pbrMaterialKey: 9
      });
      const dims = sceneApi.getBoxDimensionsM();
      const restMesh = rendererModule.createCoherentSolidRestMeshGpu(
        device,
        fixture.restMesh,
        { label: 'sol-authority-production-rest-mesh' }
      );
      const uploadBuffers = [];
      const metamorphicSnapshots = [];
      const metamorphicValidator = validationModule.createCoherentSolidMetamorphicValidationGpu(
        device,
        { label: 'sol-authority-production-metamorphic' }
      );
      const uncapturedErrors = [];
      const onUncapturedError = (event) => {
        const message = event.error?.message || String(event.error);
        if (uncapturedErrors.length < 60 && !uncapturedErrors.includes(message)) {
          uncapturedErrors.push(message);
        }
      };
      device.addEventListener('uncapturederror', onUncapturedError);
      const upload = (label, data) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, data.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(buffer, 0, data);
        uploadBuffers.push(buffer);
        return buffer;
      };
      const makeRawSources = ({
        stateKey,
        leaseId,
        bodyId,
        bodyCount = 1,
        proxyCount = null,
        proxyPermutation = null,
        duplicateProxyIdentity = false,
        staleProxyGeneration = false
      }) => {
        const mass = fixture.totalMassKg;
        const makeBodyRows = (bodyIndex) => (
          fixtureModule.createAsymmetricCoherentSolidGpuInputRows(fixture, {
            bodyId: bodyId + bodyIndex,
            generationId: 1,
            memberGenerationId: 1,
            leaseId,
            leaseEpoch: 0,
            positionM: [dims[0] * 0.34, dims[1] * 0.58, dims[2] * 0.5],
            linearMomentumKgMPerS: [mass * 1.1, mass * 0.08, 0],
            angularMomentumKgM2PerS: [80, 120, 160],
            chartId: 0,
            levelId: 0,
            hierarchyGeneration: 1,
            positionEpoch: 1
          })
        );
        const firstRows = makeBodyRows(0);
        const resolvedBodyCount = Math.max(1, Math.trunc(Number(bodyCount) || 1));
        const membersPerBody = firstRows.memberCount;
        const proxiesPerBody = firstRows.proxyCount;
        const frameRows = new Uint32Array(
          resolvedBodyCount * abi.COHERENT_SOLID_FRAME_WORDS
        );
        const memberRows = new Uint32Array(
          resolvedBodyCount * membersPerBody * abi.COHERENT_SOLID_MEMBER_WORDS
        );
        const membershipOffsets = new Uint32Array(resolvedBodyCount + 1);
        const membershipIndices = new Uint32Array(resolvedBodyCount * membersPerBody);
        const sourceProxyRows = new Uint32Array(
          resolvedBodyCount * proxiesPerBody * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS
        );
        for (let bodyIndex = 0; bodyIndex < resolvedBodyCount; bodyIndex += 1) {
          const rows = bodyIndex === 0 ? firstRows : makeBodyRows(bodyIndex);
          frameRows.set(rows.frameRows, bodyIndex * abi.COHERENT_SOLID_FRAME_WORDS);
          const memberOffset = bodyIndex * membersPerBody;
          for (let localMemberIndex = 0; localMemberIndex < membersPerBody; localMemberIndex += 1) {
            const sourceBase = localMemberIndex * abi.COHERENT_SOLID_MEMBER_WORDS;
            const targetBase = (memberOffset + localMemberIndex)
              * abi.COHERENT_SOLID_MEMBER_WORDS;
            memberRows.set(rows.memberRows.subarray(
              sourceBase,
              sourceBase + abi.COHERENT_SOLID_MEMBER_WORDS
            ), targetBase);
            memberRows[targetBase] = bodyIndex;
            memberRows[targetBase + 2] = 20_000 + memberOffset + localMemberIndex;
            membershipIndices[memberOffset + localMemberIndex] = memberOffset + localMemberIndex;
          }
          membershipOffsets[bodyIndex] = memberOffset;
          const proxyOffset = bodyIndex * proxiesPerBody;
          for (let localProxyIndex = 0; localProxyIndex < proxiesPerBody; localProxyIndex += 1) {
            const sourceBase = localProxyIndex * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
            const targetBase = (proxyOffset + localProxyIndex)
              * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
            sourceProxyRows.set(rows.localContactProxyRows.subarray(
              sourceBase,
              sourceBase + abi.COHERENT_SOLID_CONTACT_PROXY_WORDS
            ), targetBase);
            sourceProxyRows[targetBase] = bodyIndex;
            sourceProxyRows[targetBase + 2] = 10_000 + proxyOffset + localProxyIndex;
          }
        }
        membershipOffsets[resolvedBodyCount] = resolvedBodyCount * membersPerBody;
        const sourceProxyCount = resolvedBodyCount * proxiesPerBody;
        const resolvedProxyCount = proxyCount == null ? sourceProxyCount : proxyCount;
        const proxyRows = new Uint32Array(
          resolvedProxyCount * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS
        );
        for (let index = 0; index < resolvedProxyCount; index += 1) {
          const sourceIndex = index % sourceProxyCount;
          const sourceBase = sourceIndex * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
          const targetBase = index * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
          proxyRows.set(sourceProxyRows.subarray(
            sourceBase,
            sourceBase + abi.COHERENT_SOLID_CONTACT_PROXY_WORDS
          ), targetBase);
          proxyRows[targetBase + 2] = 10_000 + index;
        }
        if (duplicateProxyIdentity && resolvedProxyCount > 1) {
          proxyRows[abi.COHERENT_SOLID_CONTACT_PROXY_WORDS + 2] = proxyRows[2];
        }
        if (staleProxyGeneration && resolvedProxyCount > 0) proxyRows[5] = 999;
        let orderedProxyRows = proxyRows;
        if (proxyPermutation) {
          orderedProxyRows = new Uint32Array(proxyRows.length);
          proxyPermutation.forEach((sourceIndex, targetIndex) => {
            const sourceBase = sourceIndex * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
            const targetBase = targetIndex * abi.COHERENT_SOLID_CONTACT_PROXY_WORDS;
            orderedProxyRows.set(proxyRows.subarray(
              sourceBase,
              sourceBase + abi.COHERENT_SOLID_CONTACT_PROXY_WORDS
            ), targetBase);
          });
        }
        return {
          frameSource: {
            schema: abi.ULG_COHERENT_SOLID_FRAME_SCHEMA,
            device,
            buffer: upload(`${stateKey}-raw-frames`, frameRows),
            bodyCount: resolvedBodyCount,
            strideWords: abi.COHERENT_SOLID_FRAME_WORDS,
            generationId: firstRows.frameGenerationId,
            leaseId,
            leaseEpoch: firstRows.leaseEpoch
          },
          memberSource: {
            schema: abi.ULG_COHERENT_SOLID_MEMBER_SCHEMA,
            device,
            buffer: upload(`${stateKey}-raw-members`, memberRows),
            memberCount: resolvedBodyCount * membersPerBody,
            strideWords: abi.COHERENT_SOLID_MEMBER_WORDS,
            generationId: firstRows.memberGenerationId,
            leaseId,
            leaseEpoch: firstRows.leaseEpoch
          },
          membershipSource: {
            schema: abi.ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
            device,
            offsetBuffer: upload(`${stateKey}-raw-membership-offsets`, membershipOffsets),
            indexBuffer: upload(`${stateKey}-raw-membership-indices`, membershipIndices),
            bodyCount: resolvedBodyCount,
            indexCount: resolvedBodyCount * membersPerBody,
            exactPartition: true,
            generationId: firstRows.memberGenerationId,
            leaseId,
            leaseEpoch: firstRows.leaseEpoch
          },
          localContactProxySource: {
            schema: abi.ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
            device,
            buffer: upload(`${stateKey}-raw-contact-proxies`, orderedProxyRows),
            proxyCount: resolvedProxyCount,
            strideWords: abi.COHERENT_SOLID_CONTACT_PROXY_WORDS,
            generationId: firstRows.frameGenerationId,
            leaseId,
            leaseEpoch: firstRows.leaseEpoch,
            hierarchyGeneration: firstRows.hierarchyGeneration,
            topologyGeneration: fixture.restMesh.topologyGeneration,
            positionEpoch: firstRows.positionEpoch
          }
        };
      };
      const bootstrapState = async ({
        stateKey,
        laneId,
        leaseId,
        bodyId,
        rawOptions = {},
        workgroupSize = 64,
        dispatchWorkgroupLimit = 65535,
        proxyOutputLimit = null
      }) => {
        const raw = makeRawSources({ stateKey, leaseId, bodyId, ...rawOptions });
        const bootstrap = await host.admitInitialCoherentSolidState({
          stateKey,
          laneId,
          sourceFamily: 'coherent-solid-frame',
          device,
          ...raw,
          restMesh,
          shapeCarrier: fixture.shapeCarrier,
          chartId: 0,
          levelId: 0,
          hierarchyGeneration: 1,
          positionEpoch: 1,
          thirdLevelHold: true,
          workgroupSize,
          dispatchWorkgroupLimit,
          proxyOutputLimit: proxyOutputLimit ?? raw.localContactProxySource.proxyCount,
          presentation: { opacity: 1, exposure: 2.4, renderOrder: 120 }
        });
        return {
          stateKey,
          laneId,
          bootstrap,
          publication: bootstrap.publication,
          localContactProxySource: bootstrap.localContactProxySource,
          stepCount: 0
        };
      };
      const taskSummary = (submitted, previousPublication, previousHotBufferKey) => ({
        generation: submitted.publication.publicationGeneration,
        positionEpoch: submitted.publication.sourceEpoch,
        peerLeaseId: submitted.result.laneLeaseIdentity.leaseId,
        queueSubmissionCount: submitted.result.queueSubmissionCount,
        copyBudget: submitted.result.commitDelta.payload.copyBudget,
        fullStateReadbackPerformed: submitted.result.fullStateReadbackPerformed,
        compactEvidenceReadbackPerformed: submitted.result.compactEvidenceReadbackPerformed,
        rawGpuBufferTransferDetected: submitted.result.commitDelta.payload.rawGpuBufferTransferDetected,
        cacheAtExecution: submitted.result.residentLaneCache,
        cacheAfterRollover: submitted.result.localRetainedRefs.getResidentLaneCacheEvidence(),
        executionShape: submitted.result.commitDelta.payload.executionShape,
        proxyOrderReused:
          submitted.result.localRetainedRefs.proxyCompactionEvidence.orderReused === true,
        chartTransition: submitted.result.chartTransition,
        previousPublicationRetired:
          !previousPublication || host.validateCoherentSolidDrawPublication(previousPublication) === null,
        previousHotBufferCleared:
          !previousHotBufferKey || host.getStateManager().getHotBuffer(previousHotBufferKey) == null
      });
      const stepState = async (state, dtS, options = {}) => {
        const previousPublication = state.publication;
        const previousHotBufferKey = previousPublication.stateManagerAdmission.hotBufferKey;
        const frameSource = previousPublication.drawGroups[0].frameSource;
        const shapeCarrier = previousPublication.drawGroups[0].shapeCarrier;
        const chartId = options.chartId ?? frameSource.chartId;
        const levelId = options.levelId ?? frameSource.levelId;
        const hierarchyGeneration = options.hierarchyGeneration
          ?? frameSource.hierarchyGeneration;
        const targetPositionEpoch = frameSource.positionEpoch + 1;
        const chartTransition = (
          chartId !== frameSource.chartId
          || levelId !== frameSource.levelId
          || hierarchyGeneration !== frameSource.hierarchyGeneration
        ) ? taskModule.createCoherentSolidChartTransition({
          sourceChartId: frameSource.chartId,
          sourceLevelId: frameSource.levelId,
          sourceHierarchyGeneration: frameSource.hierarchyGeneration,
          sourcePositionEpoch: frameSource.positionEpoch,
          targetChartId: chartId,
          targetLevelId: levelId,
          targetHierarchyGeneration: hierarchyGeneration,
          targetPositionEpoch,
          geometryKey: restMesh.geometryKey,
          topologyGeneration: restMesh.topologyGeneration,
          proxyGenerationId: state.localContactProxySource.generationId
        }) : null;
        const submitted = await host.submitCoherentSolidFrameTask({
          stateKey: state.stateKey,
          laneId: state.laneId,
          sourceFamily: 'coherent-solid-frame',
          device,
          frameSource,
          memberSource: state.bootstrap.memberSource,
          membershipSource: state.bootstrap.membershipSource,
          localContactProxySource: state.localContactProxySource,
          restMesh,
          shapeCarrier,
          targetGenerationId: frameSource.generationId + 1,
          dtS,
          externalAcceleration: [0, 0, 0],
          chartId,
          levelId,
          hierarchyGeneration,
          chartTransition,
          sourcePositionEpoch: frameSource.positionEpoch,
          targetPositionEpoch,
          finiteMagnitudeLimit: options.finiteMagnitudeLimit ?? 1e30,
          workgroupSize: options.workgroupSize ?? 64,
          dispatchWorkgroupLimit: options.dispatchWorkgroupLimit ?? 65535,
          proxyOutputLimit:
            options.proxyOutputLimit ?? state.localContactProxySource.proxyCount,
          presentation: { opacity: 1, exposure: 2.4, renderOrder: 120 }
        });
        state.publication = submitted.publication;
        state.localContactProxySource = submitted.localContactProxySource;
        state.stepCount += 1;
        return taskSummary(submitted, previousPublication, previousHotBufferKey);
      };
      const f32 = (word) => new Float32Array(new Uint32Array([word]).buffer)[0];
      const i32 = (word) => new Int32Array(new Uint32Array([word]).buffer)[0];
      const readCheckpoint = async (publication) => {
        const group = publication.drawGroups[0];
        const admission = publication.stateManagerAdmission;
        const bodyWords = admission.bodyInvariants.strideWords;
        const bodyBytes = bodyWords * 4;
        const evidenceBytes = admission.invariantEvidence.byteLength;
        const indirectBytes = group.gpuDrawRange.indirectByteLength;
        const contactBytes = admission.worldContactProxies.proxyCount > 0
          ? abi.COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS * 4
          : 0;
        const proxyEvidenceBytes = admission.proxyCompactionEvidence.byteLength;
        const proxyDispatchBytes = admission.proxyCompactionEvidence.dispatchIndirectByteLength;
        const evidenceOffset = bodyBytes;
        const indirectOffset = evidenceOffset + evidenceBytes;
        const contactOffset = indirectOffset + indirectBytes;
        const proxyEvidenceOffset = contactOffset + contactBytes;
        const proxyDispatchOffset = proxyEvidenceOffset + proxyEvidenceBytes;
        const totalBytes = proxyDispatchOffset + proxyDispatchBytes;
        const readback = device.createBuffer({
          label: `solid-fixed-evidence-${publication.publicationGeneration}`,
          size: Math.max(4, totalBytes),
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(admission.bodyInvariants.buffer, 0, readback, 0, bodyBytes);
        encoder.copyBufferToBuffer(
          admission.invariantEvidence.buffer,
          0,
          readback,
          evidenceOffset,
          evidenceBytes
        );
        encoder.copyBufferToBuffer(
          group.gpuDrawRange.drawIndexedIndirectBuffer,
          group.gpuDrawRange.indirectOffsetBytes,
          readback,
          indirectOffset,
          indirectBytes
        );
        if (contactBytes > 0) {
          encoder.copyBufferToBuffer(
            admission.worldContactProxies.buffer,
            0,
            readback,
            contactOffset,
            contactBytes
          );
        }
        encoder.copyBufferToBuffer(
          admission.proxyCompactionEvidence.buffer,
          0,
          readback,
          proxyEvidenceOffset,
          proxyEvidenceBytes
        );
        encoder.copyBufferToBuffer(
          admission.proxyCompactionEvidence.dispatchIndirectBuffer,
          0,
          readback,
          proxyDispatchOffset,
          proxyDispatchBytes
        );
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(readback.getMappedRange().slice(0));
        readback.unmap();
        readback.destroy();
        const body = words.slice(0, bodyWords);
        const evidenceStart = evidenceOffset / 4;
        const evidence = words.slice(evidenceStart, evidenceStart + evidenceBytes / 4);
        const indirectStart = indirectOffset / 4;
        const indirect = Array.from(words.slice(indirectStart, indirectStart + indirectBytes / 4));
        const contactStart = contactOffset / 4;
        const contact = contactBytes > 0
          ? words.slice(contactStart, contactStart + contactBytes / 4)
          : null;
        const proxyEvidenceStart = proxyEvidenceOffset / 4;
        const proxyEvidence = words.slice(
          proxyEvidenceStart,
          proxyEvidenceStart + proxyEvidenceBytes / 4
        );
        const proxyDispatchStart = proxyDispatchOffset / 4;
        return {
          generation: publication.publicationGeneration,
          positionEpoch: publication.sourceEpoch,
          mappedEvidenceBytes: totalBytes,
          fullFrameStateReadbackBytes: 0,
          body: {
            status: body[6],
            invalidMemberCount: body[5],
            linearMomentumNormKgMPerS: f32(body[17]),
            angularMomentumNormKgM2PerS: f32(body[18]),
            kineticEnergyJ: f32(body[19]),
            centerOfMassM: [f32(body[20]), f32(body[21]), f32(body[22])],
            speedMPerS: f32(body[23]),
            quaternionNorm: f32(body[24]),
            topologyGeneration: body[28],
            connectivityGeneration: body[29],
            frameVersion: body[30],
            orientation: [f32(body[32]), f32(body[33]), f32(body[34]), f32(body[35])],
            chartId: i32(body[36]),
            chartReferenceId: body[37],
            localScaleExponent: i32(body[38]),
            sourceEpoch: body[39]
          },
          evidence: {
            generation: evidence[0],
            leaseId: evidence[1],
            leaseEpoch: evidence[2],
            bodyCount: evidence[3],
            memberCount: evidence[4],
            invalidInputCount: evidence[8],
            staleGenerationCount: evidence[9],
            identityMismatchCount: evidence[10],
            nonFiniteCount: evidence[11],
            numericallyAdmissible: evidence[22],
            rejectedBodyCount: evidence[24],
            sourceGeneration: evidence[27],
            status: evidence[28]
          },
          indirect,
          proxyEvidence: {
            generation: proxyEvidence[0],
            leaseId: proxyEvidence[1],
            inputProxyCount: proxyEvidence[2],
            uniqueProxyCount: proxyEvidence[3],
            emittedProxyCount: proxyEvidence[4],
            duplicateProxyCount: proxyEvidence[5],
            invalidProxyCount: proxyEvidence[6],
            overflowProxyCount: proxyEvidence[7],
            numericallyAdmissible: proxyEvidence[8],
            chartId: i32(proxyEvidence[9]),
            levelId: i32(proxyEvidence[10]),
            hierarchyGeneration: proxyEvidence[11],
            sourcePositionEpoch: proxyEvidence[12],
            targetPositionEpoch: proxyEvidence[13],
            status: proxyEvidence[14],
            workgroupSize: proxyEvidence[15]
          },
          proxyDispatch: Array.from(words.slice(proxyDispatchStart, proxyDispatchStart + 3)),
          contact: contact ? {
            bodyId: contact[0],
            proxyId: contact[1],
            generation: contact[3],
            status: contact[7],
            worldPositionM: [f32(contact[4]), f32(contact[5]), f32(contact[6])],
            levelId: i32(contact[11]),
            chartId: i32(contact[15]),
            topologyGeneration: contact[20],
            hierarchyGeneration: contact[21],
            positionEpoch: contact[22]
          } : null
        };
      };
      const metamorphicSource = (publication) => {
        const group = publication.drawGroups[0];
        const admission = publication.stateManagerAdmission;
        return Object.freeze({
          device,
          generationId: publication.publicationGeneration,
          chartId: publication.chartId,
          levelId: publication.levelId,
          hierarchyGeneration: publication.hierarchyGeneration,
          positionEpoch: publication.sourceEpoch,
          frameSource: admission.frameSource,
          worldContactProxies: admission.worldContactProxies,
          instanceBodyIndexBuffer: group.gpuDrawRange.instanceBodyIndexBuffer,
          drawCount: group.frameSource.bodyCount
        });
      };
      const compareMetamorphicSources = async (left, right, mode) => {
        const encoder = device.createCommandEncoder({
          label: `solid-metamorphic-${mode}`
        });
        const execution = metamorphicValidator.encode(encoder, {
          left,
          right,
          mode,
          absoluteTolerance: 2e-5,
          relativeTolerance: 2e-5
        });
        const readback = device.createBuffer({
          label: `solid-metamorphic-fixed-evidence-${mode}`,
          size: execution.evidenceByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.evidenceBuffer,
          0,
          readback,
          0,
          execution.evidenceByteLength
        );
        try {
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const words = new Uint32Array(readback.getMappedRange().slice(0));
          readback.unmap();
          return Object.freeze({
            ...validationModule.decodeCoherentSolidMetamorphicEvidence(words),
            executionShape: execution.executionShape
          });
        } finally {
          if (readback.mapState === 'mapped') readback.unmap();
          readback.destroy();
          execution.release();
        }
      };
      const compareMetamorphicPublications = (left, right, mode) => (
        compareMetamorphicSources(
          metamorphicSource(left),
          metamorphicSource(right),
          mode
        )
      );
      const captureMetamorphicSource = async (publication) => {
        const encoder = device.createCommandEncoder({
          label: `solid-metamorphic-snapshot-${publication.publicationGeneration}`
        });
        const snapshot = validationModule.encodeCoherentSolidMetamorphicSnapshotGpu(
          device,
          encoder,
          metamorphicSource(publication),
          { label: `solid-chart-source-${publication.publicationGeneration}` }
        );
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        metamorphicSnapshots.push(snapshot);
        return snapshot;
      };
      const publish = async (publication) => {
        const beforeFrame = bridge.frameCount || 0;
        const admission = bridge.presentCoherentSolidPublication
          ? await bridge.presentCoherentSolidPublication(publication)
          : sceneApi.setAdmittedCoherentSolidDrawEntries(
            publication,
            { reason: 'compute-manager-state-manager-authoritative-solid-publication' }
          );
        await new Promise((resolve) => {
          const started = performance.now();
          const poll = () => {
            if ((bridge.frameCount || 0) > beforeFrame || performance.now() - started > 15_000) {
              resolve();
              return;
            }
            requestAnimationFrame(poll);
          };
          poll();
        });
        await device.queue.onSubmittedWorkDone();
        let productionRasterProfile = null;
        if (sceneBridgeRequired) {
          productionRasterProfile = await new Promise((resolve, reject) => {
            const started = performance.now();
            const poll = () => {
              const telemetry = bridge.coherentSolidDirectShapeRenderGpuProfileTelemetry || null;
              const identityMatches = Boolean(
                telemetry
                && telemetry.publicationGeneration === publication.publicationGeneration
                && telemetry.admissionId === publication.admissionId
              );
              const terminal = Boolean(
                identityMatches
                && !bridge.coherentSolidDirectShapeRenderGpuProfileReadbackInFlight
                && (
                  telemetry.complete
                  || telemetry.partial
                  || telemetry.unsupported
                  || [
                    'timestamp-profile-encode-failed',
                    'timestamp-readback-failed',
                    'no-profiled-passes'
                  ].includes(telemetry.status)
                )
              );
              if (terminal) {
                resolve(telemetry);
                return;
              }
              if (performance.now() - started > 15_000) {
                reject(new Error(
                  `coherent-solid production raster profile did not settle for publication ${publication.publicationGeneration}`
                ));
                return;
              }
              requestAnimationFrame(poll);
            };
            poll();
          });
        }
        return {
          status: admission.status,
          ready: admission.ready,
          reason: admission.reason,
          publicationGeneration: admission.publicationGeneration,
          admissionId: publication.admissionId ?? null,
          drawGroupCount: admission.drawGroupCount,
          bridgeFrameCount: bridge.frameCount,
          rendererBridge: bridge.rendererBridge,
          nativeExecutorStatus: bridge.coherentSolidNativeExecutorStatus,
          nativeOpaqueDrawCount: bridge.coherentSolidNativeOpaqueDrawCount,
          nativeTransparentDrawCount: bridge.coherentSolidNativeTransparentDrawCount,
          nativeOpaqueSubmitStatus: bridge.lastCoherentSolidNativeOpaqueSubmitStatus,
          nativeSurfacePresentationOwner: bridge.nativeSurfacePresentationOwner ?? null,
          nativeSurfacePresentationSerial: bridge.nativeSurfacePresentationSerial ?? null,
          nativeSurfacePresentationOwnershipStatus:
            bridge.nativeSurfacePresentationOwnershipStatus ?? null,
          nativeSurfaceCurrentTextureAcquisitionSerial:
            bridge.nativeSurfaceCurrentTextureAcquisitionSerial ?? null,
          lastNativeSurfaceCurrentTexturePresentationSerial:
            bridge.lastNativeSurfaceCurrentTexturePresentationSerial ?? null,
          lastNativeSurfaceCurrentTextureOwner:
            bridge.lastNativeSurfaceCurrentTextureOwner ?? null,
          nativeSurfaceCurrentTextureAcquisitionsPerPresentation:
            bridge.nativeSurfaceCurrentTextureAcquisitionsPerPresentation ?? null,
          gpuCompactedIndirectDraw:
            bridge.coherentSolidNativeExecutor?.gpuCompactedIndirectDraw === true,
          perBodyCpuDrawLoopUsed:
            bridge.coherentSolidNativeExecutor?.perBodyCpuDrawLoopUsed === true,
          cpuFrameTransformUploadPerformed: bridge.coherentSolidCpuFrameTransformUploadPerformed,
          coherentSolidDirectShapeRenderGpuProfileRequested:
            bridge.coherentSolidDirectShapeRenderGpuProfileRequested === true,
          coherentSolidDirectShapeRenderGpuProfileSupported:
            bridge.coherentSolidDirectShapeRenderGpuProfileSupported === true,
          coherentSolidDirectShapeRenderGpuProfileComplete:
            bridge.coherentSolidDirectShapeRenderGpuProfileComplete === true,
          coherentSolidDirectShapeRenderGpuProfilePartial:
            bridge.coherentSolidDirectShapeRenderGpuProfilePartial === true,
          coherentSolidDirectShapeRenderGpuProfileUnsupported:
            bridge.coherentSolidDirectShapeRenderGpuProfileUnsupported === true,
          coherentSolidDirectShapeRenderGpuProfileReadbackInFlight:
            bridge.coherentSolidDirectShapeRenderGpuProfileReadbackInFlight === true,
          productionRasterProfile
        };
      };
      const adoptForContinuation = async (publication) => {
        const beforeFrame = bridge.frameCount || 0;
        const admission = bridge.presentCoherentSolidPublication
          ? await bridge.presentCoherentSolidPublication(publication)
          : sceneApi.setAdmittedCoherentSolidDrawEntries(
            publication,
            { reason: 'compute-manager-state-manager-solid-publication-continuation' }
          );
        if (admission?.ready !== true) {
          throw new Error(
            `coherent-solid continuation publication was not admitted: ${admission?.reason || admission?.status || 'unknown reason'}`
          );
        }
        await new Promise((resolve, reject) => {
          const started = performance.now();
          const poll = () => {
            const presentationAdvanced = (bridge.frameCount || 0) > beforeFrame;
            const livenessPending = Boolean(
              bridge.nativeSurfaceConsumerSubmitFencePending
              || bridge.pixelValidationPending
              || bridge.offscreenValidationPending
              || (bridge.nativeSurfaceDeferredResourceReleasePending || 0) > 0
            );
            if (presentationAdvanced && !livenessPending) {
              resolve();
              return;
            }
            if (performance.now() - started > 15_000) {
              reject(new Error(
                `coherent-solid continuation presentation did not release its predecessor for publication ${publication.publicationGeneration}`
              ));
              return;
            }
            requestAnimationFrame(poll);
          };
          poll();
        });
        await device.queue.onSubmittedWorkDone();
        return {
          status: admission.status,
          publicationGeneration: admission.publicationGeneration,
          admissionId: publication.admissionId ?? null
        };
      };
      const mainState = await bootstrapState({
        stateKey: 'solid-production-main',
        laneId: 'ulg:coherent-solid:production-main',
        leaseId: 41,
        bodyId: 9101
      });
      const initialCheckpoint = await readCheckpoint(mainState.publication);
      const initialPresentation = await publish(mainState.publication);
      window.__ulgCoherentSolidProductionProbe = {
        abi,
        device,
        host,
        sceneApi,
        bridge,
        fixture,
        restMesh,
        uploadBuffers,
        metamorphicSnapshots,
        metamorphicValidator,
        metamorphicModes: validationModule.COHERENT_SOLID_METAMORPHIC_MODE,
        uncapturedErrors,
        onUncapturedError,
        bootstrapState,
        stepState,
        readCheckpoint,
        metamorphicSource,
        compareMetamorphicSources,
        compareMetamorphicPublications,
        captureMetamorphicSource,
        publish,
        adoptForContinuation,
        mainState
      };
      return {
        status: 'authoritative-solid-production-ready',
        authorityMode: 'compute-manager-gpuhub-state-manager',
        productionAuthorityClaim: true,
        rendererBridge: bridge.rendererBridge,
        surfaceBridgeSource: bridge.source || 'scene-native-webgpu-surface-consumer',
        dims,
        restMeshVertexCount: restMesh.vertexCount,
        restMeshIndexCount: restMesh.indexCount,
        restMeshPersistent: restMesh.persistent,
        cpuVertexTransformPerformed: restMesh.cpuVertexTransformPerformed,
        bootstrap: {
          status: mainState.bootstrap.status,
          generation: mainState.bootstrap.frameSource.generationId,
          evidenceSchema: mainState.bootstrap.bootstrapEvidence.schema,
          evidenceByteLength: mainState.bootstrap.bootstrapEvidence.byteLength,
          evidenceGeneration: mainState.bootstrap.bootstrapEvidence.generationId,
          cache: mainState.bootstrap.residentLaneCacheEvidence,
          task: mainState.bootstrap.bootstrapTaskEvidence
        },
        initialCheckpoint,
        initialPresentation
      };
    }, requireSceneBridge);
    await page.waitForTimeout(200);
    const initialFrame = await capture(canvas, 'step-000-a');
    await page.waitForTimeout(120);
    const initialFollowupFrame = await capture(canvas, 'step-000-b');

    const checkpoints = [];
    const checkpointVisualFrames = [];
    for (const targetStep of [1, 30, 60, 120]) {
      const checkpoint = await page.evaluate(async (target) => {
        const probe = window.__ulgCoherentSolidProductionProbe;
        let lastTask = null;
        while (probe.mainState.stepCount < target) {
          lastTask = await probe.stepState(probe.mainState, 1 / 120);
          await probe.adoptForContinuation(probe.mainState.publication);
        }
        const fixedEvidence = await probe.readCheckpoint(probe.mainState.publication);
        const presentation = await probe.publish(probe.mainState.publication);
        return {
          step: probe.mainState.stepCount,
          lastTask,
          fixedEvidence,
          presentation
        };
      }, targetStep);
      checkpoints.push(checkpoint);
      await page.waitForTimeout(150);
      const frameLabel = `step-${String(targetStep).padStart(3, '0')}`;
      const firstFrame = await capture(canvas, `${frameLabel}-a`);
      await page.waitForTimeout(120);
      const followupFrame = await capture(canvas, `${frameLabel}-b`);
      checkpoint.frames = [compactFrame(firstFrame), compactFrame(followupFrame)];
      checkpointVisualFrames.push([firstFrame, followupFrame]);
    }

    const auxiliary = await page.evaluate(async () => {
      const probe = window.__ulgCoherentSolidProductionProbe;
      const failState = await probe.bootstrapState({
        stateKey: 'solid-production-fail-closed',
        laneId: 'ulg:coherent-solid:production-fail-closed',
        leaseId: 42,
        bodyId: 9201
      });
      const rejectedTask = await probe.stepState(failState, 1 / 120, {
        finiteMagnitudeLimit: 1e-6
      });
      const rejected = await probe.readCheckpoint(failState.publication);
      const consumedTask = await probe.stepState(failState, 1 / 120);
      const consumed = await probe.readCheckpoint(failState.publication);
      await probe.host.retireCoherentSolidDrawPublication(failState.publication);

      const coarse = await probe.bootstrapState({
        stateKey: 'solid-production-metamer-coarse',
        laneId: 'ulg:coherent-solid:metamer-coarse',
        leaseId: 43,
        bodyId: 9301
      });
      const fine = await probe.bootstrapState({
        stateKey: 'solid-production-metamer-fine',
        laneId: 'ulg:coherent-solid:metamer-fine',
        leaseId: 44,
        bodyId: 9401
      });
      await probe.stepState(coarse, 1 / 60);
      await probe.stepState(fine, 1 / 120);
      await probe.stepState(fine, 1 / 120);
      const coarseEvidence = await probe.readCheckpoint(coarse.publication);
      const fineEvidence = await probe.readCheckpoint(fine.publication);
      const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
      const qa = coarseEvidence.body.orientation;
      const qb = fineEvidence.body.orientation;
      const quaternionDot = Math.min(1, Math.abs(qa.reduce(
        (sum, value, index) => sum + value * qb[index],
        0
      )));
      const metamorphic = {
        coarse: coarseEvidence,
        fine: fineEvidence,
        centerDifferenceM: distance(
          coarseEvidence.body.centerOfMassM,
          fineEvidence.body.centerOfMassM
        ),
        orientationDifferenceRad: 2 * Math.acos(quaternionDot),
        kineticEnergyRelativeDifference: Math.abs(
          coarseEvidence.body.kineticEnergyJ - fineEvidence.body.kineticEnergyJ
        ) / Math.max(1e-30, Math.abs(fineEvidence.body.kineticEnergyJ))
      };
      await probe.host.retireCoherentSolidDrawPublication(coarse.publication);
      await probe.host.retireCoherentSolidDrawPublication(fine.publication);

      const proxyCount = 65;
      const reverseProxyOrder = Array.from({ length: proxyCount }, (_, index) => (
        proxyCount - index - 1
      ));
      const workgroup32 = await probe.bootstrapState({
        stateKey: 'solid-production-workgroup-32',
        laneId: 'ulg:coherent-solid:workgroup-32',
        leaseId: 45,
        bodyId: 9501,
        rawOptions: { bodyCount: 2, proxyCount },
        workgroupSize: 32,
        dispatchWorkgroupLimit: 2
      });
      const workgroup64 = await probe.bootstrapState({
        stateKey: 'solid-production-workgroup-64',
        laneId: 'ulg:coherent-solid:workgroup-64',
        leaseId: 46,
        bodyId: 9501,
        rawOptions: { bodyCount: 2, proxyCount, proxyPermutation: reverseProxyOrder },
        workgroupSize: 64,
        dispatchWorkgroupLimit: 2
      });
      const workgroup64Ordered = await probe.bootstrapState({
        stateKey: 'solid-production-workgroup-64-ordered',
        laneId: 'ulg:coherent-solid:workgroup-64-ordered',
        leaseId: 50,
        bodyId: 9501,
        rawOptions: { bodyCount: 2, proxyCount },
        workgroupSize: 64,
        dispatchWorkgroupLimit: 2
      });
      const workgroup32Task = await probe.stepState(workgroup32, 1 / 120, {
        workgroupSize: 32,
        dispatchWorkgroupLimit: 2
      });
      const workgroup64Task = await probe.stepState(workgroup64, 1 / 120, {
        workgroupSize: 64,
        dispatchWorkgroupLimit: 2
      });
      const workgroup64OrderedTask = await probe.stepState(workgroup64Ordered, 1 / 120, {
        workgroupSize: 64,
        dispatchWorkgroupLimit: 2
      });
      const workgroup32Evidence = await probe.readCheckpoint(workgroup32.publication);
      const workgroup64Evidence = await probe.readCheckpoint(workgroup64.publication);
      const workgroup64OrderedEvidence = await probe.readCheckpoint(
        workgroup64Ordered.publication
      );
      const workgroupPartitionEvidence = await probe.compareMetamorphicPublications(
        workgroup32.publication,
        workgroup64Ordered.publication,
        probe.metamorphicModes.partitionEquivalence
      );
      const proxyPermutationEvidence = await probe.compareMetamorphicPublications(
        workgroup64Ordered.publication,
        workgroup64.publication,
        probe.metamorphicModes.partitionEquivalence
      );
      await probe.host.retireCoherentSolidDrawPublication(workgroup32.publication);
      await probe.host.retireCoherentSolidDrawPublication(workgroup64.publication);
      await probe.host.retireCoherentSolidDrawPublication(workgroup64Ordered.publication);

      const partitionBodyCount = 600;
      const partition16 = await probe.bootstrapState({
        stateKey: 'solid-production-body-member-partition-16',
        laneId: 'ulg:coherent-solid:body-member-partition-16',
        leaseId: 51,
        bodyId: 9801,
        rawOptions: { bodyCount: partitionBodyCount, proxyCount: 0 },
        workgroupSize: 16,
        dispatchWorkgroupLimit: 32
      });
      const partition32 = await probe.bootstrapState({
        stateKey: 'solid-production-body-member-partition-32',
        laneId: 'ulg:coherent-solid:body-member-partition-32',
        leaseId: 52,
        bodyId: 9801,
        rawOptions: { bodyCount: partitionBodyCount, proxyCount: 0 },
        workgroupSize: 32,
        dispatchWorkgroupLimit: 32
      });
      const partition16Task = await probe.stepState(partition16, 1 / 120, {
        workgroupSize: 16,
        dispatchWorkgroupLimit: 32
      });
      const partition32Task = await probe.stepState(partition32, 1 / 120, {
        workgroupSize: 32,
        dispatchWorkgroupLimit: 32
      });
      const partition16Evidence = await probe.readCheckpoint(partition16.publication);
      const partition32Evidence = await probe.readCheckpoint(partition32.publication);
      const bodyMemberMetamorphicEvidence = await probe.compareMetamorphicPublications(
        partition16.publication,
        partition32.publication,
        probe.metamorphicModes.partitionEquivalence
      );
      await probe.host.retireCoherentSolidDrawPublication(partition16.publication);
      await probe.host.retireCoherentSolidDrawPublication(partition32.publication);

      const negativeState = async ({ suffix, leaseId, rawOptions, proxyOutputLimit = null }) => {
        const state = await probe.bootstrapState({
          stateKey: `solid-production-proxy-${suffix}`,
          laneId: `ulg:coherent-solid:proxy-${suffix}`,
          leaseId,
          bodyId: 9601 + leaseId,
          rawOptions,
          proxyOutputLimit
        });
        const initial = await probe.readCheckpoint(state.publication);
        const retryTask = await probe.stepState(state, 1 / 120);
        const retry = await probe.readCheckpoint(state.publication);
        await probe.host.retireCoherentSolidDrawPublication(state.publication);
        return { initial, retryTask, retry };
      };
      const duplicateProxy = await negativeState({
        suffix: 'duplicate',
        leaseId: 47,
        rawOptions: { duplicateProxyIdentity: true }
      });
      const staleProxy = await negativeState({
        suffix: 'stale',
        leaseId: 48,
        rawOptions: { staleProxyGeneration: true }
      });
      const overflowProxy = await negativeState({
        suffix: 'overflow',
        leaseId: 49,
        rawOptions: {},
        proxyOutputLimit: 2
      });
      return {
        failClosed: { rejectedTask, rejected, consumedTask, consumed },
        timestepSplit: metamorphic,
        workgroupDispatchPermutation: {
          workgroup32Task,
          workgroup64Task,
          workgroup64OrderedTask,
          workgroup32Evidence,
          workgroup64Evidence,
          workgroup64OrderedEvidence,
          partitionMetamorphicEvidence: workgroupPartitionEvidence,
          permutationMetamorphicEvidence: proxyPermutationEvidence
        },
        bodyMemberPartition: {
          bodyCount: partitionBodyCount,
          memberCount: partitionBodyCount * 3,
          partition16Task,
          partition32Task,
          partition16Evidence,
          partition32Evidence,
          metamorphicEvidence: bodyMemberMetamorphicEvidence
        },
        proxyNegatives: { duplicateProxy, staleProxy, overflowProxy }
      };
    });

    const transitionBefore = await page.evaluate(async () => {
      const probe = window.__ulgCoherentSolidProductionProbe;
      const state = probe.mainState;
      const checkpoint = await probe.readCheckpoint(state.publication);
      const snapshot = await probe.captureMetamorphicSource(state.publication);
      const presentation = await probe.publish(state.publication);
      probe.transitionState = state;
      probe.transitionSnapshot = snapshot;
      return {
        checkpoint,
        presentation,
        snapshot: {
          schema: snapshot.schema,
          copiedBytes: snapshot.copiedBytes,
          hostMappedBytes: snapshot.hostMappedBytes,
          fullStateReadbackPerformed: snapshot.fullStateReadbackPerformed
        }
      };
    });
    await page.waitForTimeout(120);
    const transitionBeforeFrame = await capture(canvas, 'chart-transition-before');
    const transitionAfter = await page.evaluate(async () => {
      const probe = window.__ulgCoherentSolidProductionProbe;
      const task = await probe.stepState(probe.transitionState, 0, {
        chartId: 7,
        levelId: 1,
        hierarchyGeneration: 2
      });
      const checkpoint = await probe.readCheckpoint(probe.transitionState.publication);
      const publication = probe.transitionState.publication;
      const metamorphicEvidence = await probe.compareMetamorphicSources(
        probe.transitionSnapshot.source,
        probe.metamorphicSource(publication),
        probe.metamorphicModes.chartTransitionContinuity
      );
      const partitionNegativeEvidence = await probe.compareMetamorphicSources(
        probe.transitionSnapshot.source,
        probe.metamorphicSource(publication),
        probe.metamorphicModes.partitionEquivalence
      );
      const presentation = await probe.publish(publication);
      return {
        task,
        checkpoint,
        metamorphicEvidence,
        partitionNegativeEvidence,
        presentation,
        publication: {
          chartId: publication.chartId,
          levelId: publication.levelId,
          hierarchyGeneration: publication.hierarchyGeneration,
          transition: publication.chartTransition,
          restShapeContinuity: publication.stateManagerAdmission.restShapeContinuity,
          localContact: {
            chartId: publication.localContactProxySource.chartId,
            levelId: publication.localContactProxySource.levelId,
            hierarchyGeneration: publication.localContactProxySource.hierarchyGeneration,
            positionEpoch: publication.localContactProxySource.positionEpoch
          },
          restMeshSameObject:
            publication.restMesh === probe.transitionState.bootstrap.restMesh,
          shapeCarrierGeneration: publication.drawGroups[0].shapeCarrier.generationId
        }
      };
    });
    await page.waitForTimeout(120);
    const transitionAfterFrame = await capture(canvas, 'chart-transition-after');
    const transitionVisual = {
      frames: [transitionBeforeFrame.name, transitionAfterFrame.name],
      first: await analyzePng(page, transitionBeforeFrame.bytes),
      followup: await analyzePng(page, transitionAfterFrame.bytes),
      delta: await comparePngs(page, transitionBeforeFrame.bytes, transitionAfterFrame.bytes)
    };
    auxiliary.chartTransition = {
      before: transitionBefore,
      after: transitionAfter,
      visual: transitionVisual
    };

    const cleanup = await page.evaluate(async () => {
      const probe = window.__ulgCoherentSolidProductionProbe;
      const finalCache = probe.mainState.publication.stateManagerAdmission
        ? probe.host.getStateManager().getHotBuffer(
          probe.mainState.publication.stateManagerAdmission.hotBufferKey
        )?.localRetainedRefs?.getResidentLaneCacheEvidence?.()
        : null;
      if (probe.transitionState?.publication) {
        await probe.host.retireCoherentSolidDrawPublication(probe.transitionState.publication);
      }
      const metamorphicSnapshotCleanupCount = probe.metamorphicSnapshots
        .filter((snapshot) => snapshot.release())
        .length;
      probe.metamorphicValidator.destroy();
      probe.device.removeEventListener('uncapturederror', probe.onUncapturedError);
      delete probe.bridge.canvas.dataset.coherentSolidProductionProbe;
      const result = {
        finalPublicationValid:
          probe.host.validateCoherentSolidDrawPublication(probe.mainState.publication)
          === probe.mainState.publication,
        finalCache,
        metamorphicSnapshotCleanupCount,
        uncapturedErrors: [...probe.uncapturedErrors]
      };
      if (probe.bridge.source === 'standalone-production-validation-surface') {
        probe.bridge.destroy();
        delete window.__ulgCoherentSolidStandaloneBridge;
      }
      return result;
    });

    const baselineDelta = await comparePngs(page, baseline.bytes, initialFollowupFrame.bytes);
    const earlyMotion = await comparePngs(
      page,
      initialFollowupFrame.bytes,
      checkpointVisualFrames[1][1].bytes
    );
    const lateMotion = await comparePngs(
      page,
      checkpointVisualFrames[1][1].bytes,
      checkpointVisualFrames[3][1].bytes
    );
    const closeSpacedFrameGroups = [
      [initialFrame, initialFollowupFrame],
      ...checkpointVisualFrames
    ];
    const closeSpacedVisual = [];
    for (const [firstFrame, followupFrame] of closeSpacedFrameGroups) {
      closeSpacedVisual.push({
        frames: [firstFrame.name, followupFrame.name],
        first: await analyzePng(page, firstFrame.bytes),
        followup: await analyzePng(page, followupFrame.bytes),
        delta: await comparePngs(page, firstFrame.bytes, followupFrame.bytes)
      });
    }
    const firstEvidence = setup.initialCheckpoint;
    const finalEvidence = checkpoints.at(-1).fixedEvidence;
    const relativeDrift = (initial, final) => Math.abs(final - initial)
      / Math.max(1e-30, Math.abs(initial));
    const physics = {
      kineticEnergyRelativeDrift: relativeDrift(
        firstEvidence.body.kineticEnergyJ,
        finalEvidence.body.kineticEnergyJ
      ),
      linearMomentumRelativeDrift: relativeDrift(
        firstEvidence.body.linearMomentumNormKgMPerS,
        finalEvidence.body.linearMomentumNormKgMPerS
      ),
      angularMomentumRelativeDrift: relativeDrift(
        firstEvidence.body.angularMomentumNormKgM2PerS,
        finalEvidence.body.angularMomentumNormKgM2PerS
      ),
      centerDisplacementM: Math.hypot(...finalEvidence.body.centerOfMassM.map(
        (value, index) => value - firstEvidence.body.centerOfMassM[index]
      )),
      maximumQuaternionNormError: Math.max(
        ...[setup.initialCheckpoint, ...checkpoints.map(({ fixedEvidence }) => fixedEvidence)]
          .map(({ body }) => Math.abs(body.quaternionNorm - 1))
      )
    };
    const gpuConsoleErrors = consoleMessages.filter(({ text }) => (
      /WebGPU|GPUValidationError|invalid command|invalid bind|shader/i.test(text)
    ));
    const allCheckpoints = [setup.initialCheckpoint, ...checkpoints.map(({ fixedEvidence }) => fixedEvidence)];
    const allPresentations = [
      setup.initialPresentation,
      ...checkpoints.map(({ presentation }) => presentation)
    ];
    const completeProductionRasterProfile = (presentation) => {
      const telemetry = presentation.productionRasterProfile;
      const profile = telemetry?.profile;
      const spans = Array.isArray(profile?.spans) ? profile.spans : [];
      return Boolean(
        telemetry?.requested === true
        && telemetry.supported === true
        && telemetry.complete === true
        && telemetry.partial === false
        && telemetry.unsupported === false
        && telemetry.readbackInFlight === false
        && telemetry.status === 'timestamp-profile-complete'
        && profile?.status === 'timestamp-profile-complete'
        && profile.spanCount > 0
        && profile.validSpanCount === profile.spanCount
        && profile.skippedSpanCount === 0
        && profile.invalidSpanCount === 0
        && profile.stageTotals?.coherentSolidDirectShapeRender?.validSpanCount
          === profile.spanCount
        && telemetry.publicationGeneration === presentation.publicationGeneration
        && telemetry.admissionId === presentation.admissionId
        && Number.isInteger(telemetry.presentationSerial)
        && telemetry.presentationSerial > 0
        && spans.every((span) => (
          span.label === 'coherentSolidDirectShapeRender'
          && span.valid === true
          && ['opaque', 'transparent'].includes(span.metadata?.passKind)
          && Number.isInteger(span.metadata?.drawCount)
          && span.metadata.drawCount > 0
          && span.metadata.publicationGeneration === presentation.publicationGeneration
          && span.metadata.admissionId === presentation.admissionId
          && span.metadata.presentationSerial === telemetry.presentationSerial
        ))
      );
    };
    const workgroup = auxiliary.workgroupDispatchPermutation;
    const bodyMemberPartition = auxiliary.bodyMemberPartition;
    const transition = auxiliary.chartTransition;
    const metamorphicEvidence = [
      workgroup.partitionMetamorphicEvidence,
      workgroup.permutationMetamorphicEvidence,
      bodyMemberPartition.metamorphicEvidence,
      transition.after.metamorphicEvidence,
      transition.after.partitionNegativeEvidence
    ];
    const presentationLeaseRetainedAcrossStep =
      setup.surfaceBridgeSource !== 'standalone-production-validation-surface';
    const expectedLiveGenerationsAfterRollover = presentationLeaseRetainedAcrossStep ? 2 : 1;
    const expectedPresentationConsumerCount = presentationLeaseRetainedAcrossStep ? 1 : 0;
    const checks = [
      { id: 'production-authority', pass: setup.productionAuthorityClaim === true },
      { id: 'native-webgpu-surface', pass:
        setup.rendererBridge === 'native-webgpu-surface-consumer'
        && (!requireSceneBridge
          || setup.surfaceBridgeSource !== 'standalone-production-validation-surface') },
      { id: 'bootstrap-compute-manager-evidence', pass: setup.bootstrap.evidenceByteLength === 128 },
      { id: 'persistent-rest-shape', pass: setup.restMeshPersistent && !setup.cpuVertexTransformPerformed },
      { id: 'sequential-generations', pass: checkpoints.every((value, index) => (
        value.fixedEvidence.generation === setup.bootstrap.generation + value.step
        && (index === 0 || value.fixedEvidence.generation > checkpoints[index - 1].fixedEvidence.generation)
      )) },
      { id: 'state-manager-rollover', pass: checkpoints.every(({ lastTask }) => (
        lastTask.previousPublicationRetired && lastTask.previousHotBufferCleared
      )) },
      { id: 'bounded-cache', pass: checkpoints.every(({ lastTask }) => (
        lastTask.cacheAfterRollover.liveGenerationCount
          === expectedLiveGenerationsAfterRollover
        && lastTask.cacheAfterRollover.maxLiveGenerationCount === 2
        && lastTask.cacheAfterRollover.presentationConsumerCount
          === expectedPresentationConsumerCount
        && lastTask.cacheAfterRollover.producerReleasePending
          .filter(Boolean).length === expectedPresentationConsumerCount
      )) },
      { id: 'pipeline-cache', pass: setup.bootstrap.cache.pipelineCreationCount === 24
        && checkpoints.every(({ lastTask }) => lastTask.cacheAtExecution.pipelinesCreatedThisExecution === 0) },
      { id: 'retained-buffer-cache', pass: setup.bootstrap.cache.retainedBufferAllocationCount === 40
        && checkpoints.every(({ lastTask }) => lastTask.cacheAtExecution.retainedBuffersAllocatedThisExecution === 0) },
      { id: 'one-submit-per-step', pass: checkpoints.every(({ lastTask }) => lastTask.queueSubmissionCount === 1) },
      { id: 'no-hot-state-readback', pass: checkpoints.every(({ lastTask }) => (
        !lastTask.fullStateReadbackPerformed && lastTask.copyBudget.fullStateReadbackBytes === 0
      )) },
      { id: 'fixed-evidence-only', pass: allCheckpoints.every((value) => (
        value.mappedEvidenceBytes <= 512 && value.fullFrameStateReadbackBytes === 0
      )) && metamorphicEvidence.every((value) => (
        value.mappedEvidenceBytes === 128
        && value.fullStateReadbackPerformed === false
        && value.readbackMode === 'fixed-gpu-reduction-evidence-only'
      ))
        && transition.before.snapshot.hostMappedBytes === 0
        && transition.before.snapshot.fullStateReadbackPerformed === false },
      { id: 'gpu-invariants-admissible', pass: allCheckpoints.every((value) => (
        value.evidence.numericallyAdmissible === 1
        && value.evidence.rejectedBodyCount === 0
        && value.body.invalidMemberCount === 0
      )) },
      { id: 'proxy-ordering-admissible', pass: allCheckpoints.every((value) => (
        value.proxyEvidence.numericallyAdmissible === 1
        && value.proxyEvidence.uniqueProxyCount === value.proxyEvidence.inputProxyCount
        && value.proxyEvidence.emittedProxyCount === value.proxyEvidence.inputProxyCount
        && value.proxyEvidence.duplicateProxyCount === 0
        && value.proxyEvidence.invalidProxyCount === 0
        && value.proxyEvidence.overflowProxyCount === 0
        && value.proxyEvidence.status === 3
        && value.proxyEvidence.workgroupSize === 64
      )) && checkpoints.every(({ lastTask }) => lastTask.proxyOrderReused === true) },
      { id: 'momentum-conserved', pass: physics.linearMomentumRelativeDrift < 2e-5
        && physics.angularMomentumRelativeDrift < 2e-5 },
      { id: 'energy-bounded', pass: physics.kineticEnergyRelativeDrift < 2e-3 },
      { id: 'objective-motion', pass: physics.centerDisplacementM > 0.5
        && physics.maximumQuaternionNormError < 2e-5 },
      { id: 'contact-proxy-continuity', pass: allCheckpoints.every((value) => (
        value.contact?.generation === value.generation
        && value.contact?.positionEpoch === value.positionEpoch
        && value.contact?.chartId === 0
        && value.contact?.levelId === 0
        && value.contact?.hierarchyGeneration === 1
      )) },
      { id: 'gpu-indirect-visible', pass: allCheckpoints.every((value) => value.indirect[1] === 1) },
      { id: 'native-indirect-composition', pass: checkpoints.every(({ presentation }) => (
        presentation.ready
        && presentation.drawGroupCount === 1
        && presentation.nativeOpaqueDrawCount === 1
        && presentation.gpuCompactedIndirectDraw === true
        && presentation.perBodyCpuDrawLoopUsed === false
        && presentation.cpuFrameTransformUploadPerformed === false
      )) },
      { id: 'production-solid-raster-gpu-profile', pass:
        !requireSceneBridge || allPresentations.every(completeProductionRasterProfile) },
      { id: 'single-native-presentation-owner', pass: allPresentations.every((presentation) => (
        presentation.nativeSurfacePresentationOwner
          === 'native-webgpu-surface-consumer-scheduler'
        && presentation.lastNativeSurfaceCurrentTextureOwner
          === 'native-webgpu-surface-consumer-scheduler'
        && presentation.lastNativeSurfaceCurrentTexturePresentationSerial
          === presentation.nativeSurfacePresentationSerial
        && presentation.nativeSurfaceCurrentTextureAcquisitionsPerPresentation === 1
      )) },
      { id: 'fail-closed-global-rejection', pass:
        auxiliary.failClosed.rejected.evidence.numericallyAdmissible === 0
        && auxiliary.failClosed.rejected.indirect[1] === 0
        && auxiliary.failClosed.consumed.indirect[1] === 0 },
      { id: 'timestep-split-metamorphic', pass:
        auxiliary.timestepSplit.centerDifferenceM < 2e-4
        && auxiliary.timestepSplit.orientationDifferenceRad < 2e-3
        && auxiliary.timestepSplit.kineticEnergyRelativeDifference < 2e-4 },
      { id: 'workgroup-partition-invariance', pass:
        workgroup.partitionMetamorphicEvidence.numericallyAdmissible === true
        && workgroup.workgroup32Evidence.proxyEvidence.workgroupSize === 32
        && workgroup.workgroup64OrderedEvidence.proxyEvidence.workgroupSize === 64
        && workgroup.workgroup32Evidence.proxyEvidence.numericallyAdmissible === 1
        && workgroup.workgroup64OrderedEvidence.proxyEvidence.numericallyAdmissible === 1
        && workgroup.workgroup32Task.proxyOrderReused === true
        && workgroup.workgroup64OrderedTask.proxyOrderReused === true
        && workgroup.partitionMetamorphicEvidence.executionShape.validationExtent === 65
        && JSON.stringify(workgroup.partitionMetamorphicEvidence.executionShape.dispatch)
          === JSON.stringify([2, 1, 1]) },
      { id: 'body-member-2d-dispatch-partition-invariance', pass:
        bodyMemberPartition.metamorphicEvidence.numericallyAdmissible === true
        && bodyMemberPartition.partition16Evidence.evidence.bodyCount
          === bodyMemberPartition.bodyCount
        && bodyMemberPartition.partition16Evidence.evidence.memberCount
          === bodyMemberPartition.memberCount
        && bodyMemberPartition.partition32Evidence.evidence.bodyCount
          === bodyMemberPartition.bodyCount
        && bodyMemberPartition.partition32Evidence.evidence.memberCount
          === bodyMemberPartition.memberCount
        && JSON.stringify(bodyMemberPartition.partition16Task.executionShape.bodyReductionDispatch)
          === JSON.stringify([32, 19, 1])
        && JSON.stringify(bodyMemberPartition.partition32Task.executionShape.bodyReductionDispatch)
          === JSON.stringify([32, 19, 1])
        && JSON.stringify(bodyMemberPartition.partition16Task.executionShape.bodyLinearDispatch)
          === JSON.stringify([32, 2, 1])
        && JSON.stringify(bodyMemberPartition.partition32Task.executionShape.bodyLinearDispatch)
          === JSON.stringify([19, 1, 1])
        && JSON.stringify(bodyMemberPartition.partition16Task.executionShape.memberLinearDispatch)
          === JSON.stringify([32, 4, 1])
        && JSON.stringify(bodyMemberPartition.partition32Task.executionShape.memberLinearDispatch)
          === JSON.stringify([32, 2, 1])
        && bodyMemberPartition.partition16Evidence.indirect[1] === bodyMemberPartition.bodyCount
        && bodyMemberPartition.partition32Evidence.indirect[1] === bodyMemberPartition.bodyCount
        && bodyMemberPartition.metamorphicEvidence.leftDrawIdentityMismatchCount === 0
        && bodyMemberPartition.metamorphicEvidence.rightDrawIdentityMismatchCount === 0
        && bodyMemberPartition.metamorphicEvidence.drawIndexMismatchCount === 0
        && bodyMemberPartition.metamorphicEvidence.executionShape.validationExtent === 600
        && JSON.stringify(bodyMemberPartition.metamorphicEvidence.executionShape.dispatch)
          === JSON.stringify([10, 1, 1]) },
      { id: 'indirect-dispatch-partition-invariance', pass:
        JSON.stringify(workgroup.workgroup32Evidence.proxyDispatch) === JSON.stringify([2, 2, 1])
        && JSON.stringify(workgroup.workgroup64OrderedEvidence.proxyDispatch)
          === JSON.stringify([2, 1, 1])
        && workgroup.workgroup32Evidence.indirect[1] === 2
        && workgroup.workgroup64OrderedEvidence.indirect[1] === 2 },
      { id: 'permutation-invariant-proxy-identity', pass:
        workgroup.permutationMetamorphicEvidence.numericallyAdmissible === true
        && workgroup.workgroup64OrderedEvidence.proxyEvidence.workgroupSize === 64
        && workgroup.workgroup64Evidence.proxyEvidence.workgroupSize === 64
        && workgroup.workgroup64OrderedTask.proxyOrderReused === true
        && workgroup.workgroup64Task.proxyOrderReused === true
        && workgroup.permutationMetamorphicEvidence.leftProxyCount === 65
        && workgroup.permutationMetamorphicEvidence.rightProxyCount === 65
        && workgroup.permutationMetamorphicEvidence.leftProxyOrderViolationCount === 0
        && workgroup.permutationMetamorphicEvidence.rightProxyOrderViolationCount === 0
        && workgroup.permutationMetamorphicEvidence.proxyIdentityMismatchCount === 0
        && workgroup.permutationMetamorphicEvidence.proxyStaticMismatchCount === 0
        && workgroup.permutationMetamorphicEvidence.proxyMetadataMismatchCount === 0 },
      { id: 'proxy-duplicate-fail-closed', pass:
        auxiliary.proxyNegatives.duplicateProxy.initial.proxyEvidence.duplicateProxyCount > 0
        && auxiliary.proxyNegatives.duplicateProxy.initial.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.duplicateProxy.initial.indirect[1] === 0
        && auxiliary.proxyNegatives.duplicateProxy.retryTask.proxyOrderReused === true
        && auxiliary.proxyNegatives.duplicateProxy.retry.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.duplicateProxy.retry.indirect[1] === 0 },
      { id: 'proxy-stale-generation-fail-closed', pass:
        auxiliary.proxyNegatives.staleProxy.initial.proxyEvidence.invalidProxyCount > 0
        && auxiliary.proxyNegatives.staleProxy.initial.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.staleProxy.initial.indirect[1] === 0
        && auxiliary.proxyNegatives.staleProxy.retryTask.proxyOrderReused === true
        && auxiliary.proxyNegatives.staleProxy.retry.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.staleProxy.retry.indirect[1] === 0 },
      { id: 'proxy-overflow-fail-closed', pass:
        auxiliary.proxyNegatives.overflowProxy.initial.proxyEvidence.overflowProxyCount > 0
        && auxiliary.proxyNegatives.overflowProxy.initial.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.overflowProxy.initial.indirect[1] === 0
        && auxiliary.proxyNegatives.overflowProxy.retryTask.proxyOrderReused === true
        && auxiliary.proxyNegatives.overflowProxy.retry.proxyEvidence.numericallyAdmissible === 0
        && auxiliary.proxyNegatives.overflowProxy.retry.indirect[1] === 0 },
      { id: 'state-manager-chart-transition-continuity', pass:
        transition.after.metamorphicEvidence.numericallyAdmissible === true
        && transition.after.metamorphicEvidence.leftProxyOrderViolationCount === 0
        && transition.after.metamorphicEvidence.rightProxyOrderViolationCount === 0
        && transition.after.metamorphicEvidence.proxyIdentityMismatchCount === 0
        && transition.after.metamorphicEvidence.proxyMetadataMismatchCount === 0
        && transition.after.metamorphicEvidence.bodyIdentityMismatchCount === 0
        && transition.after.metamorphicEvidence.bodyMetadataMismatchCount === 0
        && transition.after.metamorphicEvidence.executionShape.validationExtent === 16
        && transition.before.checkpoint.body.chartId === 0
        && transition.before.checkpoint.body.chartReferenceId === 1
        && transition.before.checkpoint.body.localScaleExponent === 0
        && transition.after.checkpoint.body.chartId === 7
        && transition.after.checkpoint.body.chartReferenceId === 2
        && transition.after.checkpoint.body.localScaleExponent === 1
        && transition.after.checkpoint.body.sourceEpoch
          === transition.before.checkpoint.body.sourceEpoch + 1
        && transition.after.publication.chartId === 7
        && transition.after.publication.levelId === 1
        && transition.after.publication.hierarchyGeneration === 2
        && transition.after.publication.transition?.schema
          === 'peercompute.ulg.schroeder-solid-chart-transition.v0'
        && transition.after.publication.transition?.preserveWorldPose === true
        && transition.after.publication.transition?.preserveWorldMomentum === true
        && transition.after.publication.transition?.preserveRestShape === true
        && transition.after.publication.transition?.preserveContactIdentity === true
        && transition.after.publication.restShapeContinuity
          ?.preservedAcrossChartTransition === true
        && transition.after.publication.restMeshSameObject === true
        && transition.after.publication.localContact.chartId === 7
        && transition.after.publication.localContact.levelId === 1
        && transition.after.publication.localContact.hierarchyGeneration === 2
        && transition.after.publication.localContact.positionEpoch
          === transition.after.checkpoint.positionEpoch
        && transition.after.publication.shapeCarrierGeneration
          === transition.after.checkpoint.generation },
      { id: 'chart-transition-not-partition-equivalent', pass:
        transition.after.partitionNegativeEvidence.numericallyAdmissible === false
        && transition.after.partitionNegativeEvidence.bodyMetadataMismatchCount > 0
        && transition.after.partitionNegativeEvidence.mappedEvidenceBytes === 128
        && transition.after.partitionNegativeEvidence.fullStateReadbackPerformed === false },
      { id: 'chart-transition-native-draw-authority', pass:
        transition.after.presentation.ready === true
        && transition.after.presentation.gpuCompactedIndirectDraw === true
        && transition.after.presentation.perBodyCpuDrawLoopUsed === false
        && transition.after.presentation.cpuFrameTransformUploadPerformed === false
        && transition.after.presentation.nativeSurfacePresentationOwner
          === 'native-webgpu-surface-consumer-scheduler'
        && transition.after.presentation.lastNativeSurfaceCurrentTextureOwner
          === 'native-webgpu-surface-consumer-scheduler' },
      { id: 'chart-transition-visual-continuity', pass:
        transition.visual.first.nearBlackPixelRatio < 0.85
        && transition.visual.followup.nearBlackPixelRatio < 0.85
        && transition.visual.delta.differingPixelRatio < 0.25 },
      { id: 'visible-rest-shape', pass: baselineDelta.differingPixelCount > 250 },
      { id: 'visible-sequential-motion', pass: earlyMotion.differingPixelCount > 100
        && lateMotion.differingPixelCount > 100 },
      { id: 'close-spaced-surface-continuity', pass: closeSpacedVisual.every((sample) => (
        sample.first.nearBlackPixelRatio < 0.85
        && sample.followup.nearBlackPixelRatio < 0.85
        && sample.delta.differingPixelRatio < 0.25
      )) },
      { id: 'gpu-errors', pass: cleanup.uncapturedErrors.length === 0
        && pageErrors.length === 0 && gpuConsoleErrors.length === 0 }
    ];
    artifact = {
      schema: 'peercompute.ulg.coherent-solid-production-bridge-probe.v0',
      status: checks.every(({ pass }) => pass) ? 'passed' : 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      targetUrl: targetUrl(),
      authorityMode: setup.authorityMode,
      productionAuthorityClaim: setup.productionAuthorityClaim,
      requireSceneBridge,
      setup,
      checkpoints,
      auxiliary,
      physics,
      performance: {
        cache: cleanup.finalCache,
        taskSubmissionCount: 121,
        retainedPipelineCount: setup.bootstrap.cache.pipelineCreationCount,
        retainedBufferAllocationCount: setup.bootstrap.cache.retainedBufferAllocationCount,
        retainedBufferBytes: setup.bootstrap.cache.retainedBufferBytes,
        perGenerationPipelineCreationCount: 0,
        perGenerationRetainedBufferAllocationCount: 0,
        productionRasterProfiles: allPresentations.map((presentation) => (
          presentation.productionRasterProfile
        ))
      },
      visual: {
        frames: [
          compactFrame(baseline),
          compactFrame(initialFrame),
          compactFrame(initialFollowupFrame),
          ...checkpoints.flatMap(({ frames }) => frames),
          compactFrame(transitionBeforeFrame),
          compactFrame(transitionAfterFrame)
        ],
        baselineDelta,
        earlyMotion,
        lateMotion,
        closeSpacedVisual
      },
      cleanup,
      checks,
      pageErrors,
      consoleMessages
    };
  } catch (error) {
    artifact = {
      schema: 'peercompute.ulg.coherent-solid-production-bridge-probe.v0',
      status: 'error',
      startedAt,
      completedAt: new Date().toISOString(),
      targetUrl: targetUrl(),
      reason: error instanceof Error ? error.stack || error.message : String(error),
      pageErrors,
      consoleMessages
    };
  } finally {
    await browser.close();
  }
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify(artifact, null, 2));
  if (artifact.status !== 'passed') process.exitCode = 1;
}

await main();
